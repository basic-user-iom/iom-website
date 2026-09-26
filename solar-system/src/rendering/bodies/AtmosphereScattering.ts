import { impactDepthUniforms, IMPACT_DEPTH_GLSL } from '../impact/ImpactDepthContext';
import {
  BackSide, Color, CustomBlending, OneFactor, OneMinusSrcAlphaFactor,
  ShaderMaterial, Vector3, Vector4,
} from 'three';
import { EARTH_ATMOSPHERE_PARAMETERS as EARTH, type AtmosphereLutBundle } from './AtmosphereLut';

export const EARTH_ATMOSPHERE_SHELL_RADIUS = EARTH.atmosphereRadiusM / EARTH.planetRadiusM;

interface AtmosphereMaterialOptions {
  readonly color: number;
  readonly luts: AtmosphereLutBundle;
  readonly earthLike: boolean;
  readonly density: number;
  readonly limbPower: number;
  readonly innerFade: number;
  readonly eclipseScatterFloor: number;
  readonly shellRadius: number;
  readonly groundRadius?: number;
  readonly name?: string;
}

/** Bounded single-scattering approximation, evaluated in planet-radius units.
 * Earth uses the existing SI density profiles and transmittance LUT. Other
 * planets use tinted haze profiles, not a claim of measured spectral models.
 */
export function createAtmosphereMaterial(options: AtmosphereMaterialOptions): ShaderMaterial {
  const ground = options.groundRadius ?? 1;
  const thickness = options.shellRadius - ground;
  const height = options.earthLike ? EARTH.rayleighScaleHeightM / EARTH.planetRadiusM : thickness / 7;
  const tint = new Color(options.color);
  const rayleigh = options.earthLike
    ? new Vector3(...EARTH.rayleighScatteringRgbPerM).multiplyScalar(EARTH.planetRadiusM)
    : new Vector3(tint.r, tint.g, tint.b).multiplyScalar(options.density * 0.07 / height);
  return new ShaderMaterial({
    name: options.name ?? 'planet-atmosphere-scattering',
    side: BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    premultipliedAlpha: true,
    uniforms: {
      ...impactDepthUniforms,
      uTransmittanceLut: { value: options.luts.transmittance.texture },
      uMultiScatteringLut: { value: options.luts.multiScattering.texture },
      uSkyViewLut: { value: options.luts.skyView.texture },
      uUseAtmosphereLut: { value: options.earthLike ? 1 : 0 },
      uLutCapable: { value: options.earthLike ? 1 : 0 },
      uEarthLike: { value: options.earthLike ? 1 : 0 },
      uSunPositionWorld: { value: new Vector3() },
      uSunDirectionWorld: { value: new Vector3(-1, 0, 0) },
      uSunDirectionBodyLocal: { value: new Vector3(-1, 0, 0) },
      uAtmosphereColor: { value: tint },
      uDensity: { value: options.density },
      uShellRadius: { value: options.shellRadius },
      uGroundRadius: { value: ground },
      uGroundCut: { value: new Vector4(0, 0, 0, 2) },
      uRayleighHeight: { value: height },
      uRayleigh: { value: rayleigh },
      uMieHeight: { value: options.earthLike ? EARTH.mieScaleHeightM / EARTH.planetRadiusM : height * 0.45 },
      uMie: { value: options.earthLike ? EARTH.mieScatteringRgbPerM[0] * EARTH.planetRadiusM : options.density * 0.012 / height },
      uEclipseScatterFloor: { value: options.eclipseScatterFloor },
      uOcclusion: { value: 1 },
      uRelativeIrradiance: { value: 1 },
      uTimeDays: { value: 0 },
      uQuality: { value: 2 },
    },
    vertexShader: ATMOSPHERE_VERTEX_SHADER,
    fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
  });
}

const ATMOSPHERE_VERTEX_SHADER = /* glsl */ `
  uniform float uShellRadius;
  uniform vec3 uSunDirectionWorld;
  varying vec3 vLocalPosition;
  varying vec3 vCameraLocal;
  varying vec3 vSunLocal;
  void main() {
    // Undo rotation AND each ellipsoid axis scale before ray intersection.
    vec3 x = modelMatrix[0].xyz;
    vec3 y = modelMatrix[1].xyz;
    vec3 z = modelMatrix[2].xyz;
    vec3 delta = cameraPosition - modelMatrix[3].xyz;
    vCameraLocal = vec3(dot(delta,x)/dot(x,x), dot(delta,y)/dot(y,y), dot(delta,z)/dot(z,z)) * uShellRadius;
    vSunLocal = normalize(vec3(
      dot(uSunDirectionWorld,x)/dot(x,x),
      dot(uSunDirectionWorld,y)/dot(y,y),
      dot(uSunDirectionWorld,z)/dot(z,z)
    ));
    vLocalPosition = position * uShellRadius;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
  ${IMPACT_DEPTH_GLSL}
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform sampler2D uTransmittanceLut;
  uniform sampler2D uMultiScatteringLut;
  uniform float uUseAtmosphereLut;
  uniform float uEarthLike;
  uniform float uShellRadius;
  uniform float uGroundRadius;
  uniform vec4 uGroundCut;
  uniform float uRayleighHeight;
  uniform float uMieHeight;
  uniform vec3 uRayleigh;
  uniform float uMie;
  uniform float uOcclusion;
  uniform float uEclipseScatterFloor;
  uniform float uRelativeIrradiance;
  uniform float uQuality;
  varying vec3 vLocalPosition;
  varying vec3 vCameraLocal;
  varying vec3 vSunLocal;

  vec2 sphereInterval(vec3 origin, vec3 direction, float radius) {
    float along = dot(origin, direction);
    vec3 perpendicular = cross(origin, direction);
    float discriminant = radius * radius - dot(perpendicular, perpendicular);
    if (discriminant < 0.0) return vec2(1.0, -1.0);
    float halfChord = sqrt(discriminant);
    return vec2(-along - halfChord, -along + halfChord);
  }
  vec3 densityAt(vec3 p) {
    float altitude = max(0.0, length(p) - uGroundRadius);
    float topFade = 1.0 - smoothstep(0.8, 1.0, altitude / (uShellRadius - uGroundRadius));
    float ozone = uEarthLike * max(0.0, 1.0 - abs(altitude * 6360000.0 - 25000.0) / 15000.0);
    return vec3(exp(-altitude/uRayleighHeight), exp(-altitude/uMieHeight), ozone) * topFade;
  }
  vec3 extinction(vec3 density) {
    return uRayleigh * density.x + vec3(uMie * 1.111) * density.y
      + vec3(0.65e-6, 1.881e-6, 0.085e-6) * 6360000.0 * density.z;
  }
  vec2 lutUv(float mu, float altitude, vec2 size) {
    vec2 uv = vec2(mu * 0.5 + 0.5, sqrt(clamp(altitude / (uShellRadius - uGroundRadius), 0.0, 1.0)));
    return (uv * (size - 1.0) + 0.5) / size;
  }
  vec3 sunlightAt(vec3 p, vec3 sun) {
    vec2 ground = sphereInterval(p, sun, uGroundRadius);
    if (ground.y >= ground.x && ground.x > 0.000001) return vec3(0.0);
    float altitude = max(0.0, length(p) - uGroundRadius);
    if (uUseAtmosphereLut > 0.5) {
      return texture2D(uTransmittanceLut, lutUv(dot(normalize(p),sun), altitude, vec2(96.0,32.0))).rgb;
    }
    float distanceToSpace = max(0.0, sphereInterval(p,sun,uShellRadius).y);
    float stepSize = distanceToSpace / 6.0;
    vec3 depth = vec3(0.0);
    for (int i=0; i<6; i++) {
      depth += extinction(densityAt(p + sun * (float(i)+0.5) * stepSize)) * stepSize;
    }
    return exp(-depth);
  }
  void main() {
    vec3 ray = normalize(vLocalPosition - vCameraLocal);
    vec3 sun = normalize(vSunLocal);
    vec2 atmosphere = sphereInterval(vCameraLocal, ray, uShellRadius);
    float start = max(0.0, atmosphere.x);
    float end = atmosphere.y;
    vec2 ground = sphereInterval(vCameraLocal, ray, uGroundRadius);
    float opaqueDepth = uImpactDepthEnabled > 0.5 ? texture2D(uImpactDepth,gl_FragCoord.xy/uImpactViewport).r : 1.0;
    if (uImpactDepthEnabled > 0.5 && opaqueDepth < 1.0) {
      vec3 rayView = (modelViewMatrix * vec4(ray/uShellRadius,0.0)).xyz;
      float opaqueDistance = impactViewDepth(opaqueDepth) / max(1e-20,-rayView.z);
      end = min(end,opaqueDistance);
    }
    if (ground.y >= ground.x && ground.x > 0.0) {
      vec3 groundPoint = normalize(vCameraLocal + ray * ground.x);
      bool localTerrain = uImpactDepthEnabled > 0.5
        && dot(groundPoint, uGroundCut.xyz) > uGroundCut.w;
      // The coarse globe's triangles lie below the analytic surface. Using
      // their depth as the bottom of the air integrates fictitious dense air
      // inside every face, exposing a latitude/longitude grid. Only the local
      // terrain cutout may extend below the reference ellipsoid (craters).
      if (!localTerrain) end = min(end, ground.x);
    }
    if (end <= start || (uImpactDepthEnabled < 0.5 && length(vCameraLocal) < uGroundRadius)) discard;

    // Rasterize the shell's back face, but depth-test at the front of the
    // integrated segment. This also works when the camera is inside the air.
    vec4 clip = projectionMatrix * modelViewMatrix
      * vec4((vCameraLocal + ray * start) / uShellRadius, 1.0);
    gl_FragDepth = start > 0.0 ? clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0) : 0.0;

    float sampleCount = uQuality > 2.5 ? 24.0 : (uQuality > 1.5 ? 16.0 : 8.0);
    float stepSize = (end-start) / sampleCount;
    float mu = dot(ray, sun);
    float phaseR = 0.0596831 * (1.0 + mu*mu);
    float g = 0.76;
    float phaseM = 0.1193662 * (1.0-g*g) * (1.0+mu*mu)
      / ((2.0+g*g) * pow(max(0.01,1.0+g*g-2.0*g*mu),1.5));
    vec3 depth = vec3(0.0);
    vec3 radiance = vec3(0.0);
    for(int i=0; i<24; i++) {
      if(float(i)>=sampleCount) break;
      vec3 p = vCameraLocal + ray * (start + (float(i)+0.5)*stepSize);
      vec3 density = densityAt(p);
      vec3 segment = extinction(density) * stepSize;
      vec3 transmission = exp(-depth - segment*0.5);
      vec3 incident = sunlightAt(p,sun);
      vec3 scattering = uRayleigh * density.x * phaseR + vec3(uMie * density.y * phaseM);
      radiance += transmission * incident * scattering * stepSize;
      if(uUseAtmosphereLut > 0.5) {
        vec2 uv = lutUv(dot(normalize(p),sun), max(0.0,length(p)-uGroundRadius), vec2(32.0,16.0));
        vec3 multi = -log(max(vec3(1.0)-texture2D(uMultiScatteringLut,uv).rgb,vec3(1.0/255.0))) / 12.0;
        radiance += transmission * multi * (uRayleigh*density.x + vec3(uMie*density.y)) * stepSize;
      }
      depth += segment;
    }
    vec3 transmittance = exp(-depth);
    float alpha = clamp(1.0 - dot(transmittance,vec3(0.333333)),0.0,0.98);
    if(alpha < 0.0001) discard;
    float eclipse = mix(uEclipseScatterFloor,1.0,clamp(uOcclusion,0.0,1.0));
    float irradiance = clamp(pow(max(uRelativeIrradiance,0.0001),0.25),0.55,1.8);
    vec3 color = radiance * 7.0 * irradiance * eclipse;
    gl_FragColor = vec4(color / max(alpha,0.0001),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`;
