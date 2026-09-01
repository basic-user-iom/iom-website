import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  DoubleSide,
  FrontSide,
  LinearFilter,
  Mesh,
  NoColorSpace,
  RGBAFormat,
  RingGeometry,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  type IUniform,
  type Texture,
} from 'three';

import {
  degreesToRadians,
  sampleDatedStormState,
  sampleGreatRedSpotState,
  sampleJetSpeedMps,
  sampleRingProfile,
  type GiantAtmosphereProfile,
  type GiantPlanetId,
  type RingSystemProfile,
} from './GiantPlanetProfiles';
import type { VisualQuality } from './VisualQuality';

export interface GiantPlanetMaterialBundle {
  readonly material: ShaderMaterial;
  readonly jetProfileTexture: DataTexture;
  readonly ringProfileTexture: DataTexture;
}

export interface RingSystemVisualBundle {
  readonly mesh: Mesh<RingGeometry, ShaderMaterial>;
  readonly material: ShaderMaterial;
  readonly geometry: RingGeometry;
  readonly profileTexture: DataTexture;
  readonly boundingRadiusMultiplier: number;
}

const JET_TEXTURE_WIDTH = 256;
const RING_TEXTURE_WIDTH = 4096;
const MAX_RING_OPTICAL_DEPTH = 5;

export function createGiantPlanetMaterialBundle(
  profile: GiantAtmosphereProfile,
  fallbackMap: Texture,
  ringProfile: RingSystemProfile | null,
): GiantPlanetMaterialBundle {
  const jetProfileTexture = createJetProfileTexture(profile);
  const ringProfileTexture = createRingProfileTexture(ringProfile);
  const greatRedSpot = profile.greatRedSpot;
  const datedStorm = profile.datedStorms?.[0];
  const ringInnerRatio = ringProfile?.innerRadiusKm === undefined
    ? 0
    : ringProfile.innerRadiusKm / profile.meanRadiusKm;
  const ringOuterRatio = ringProfile?.outerRadiusKm === undefined
    ? 0
    : ringProfile.outerRadiusKm / profile.meanRadiusKm;

  const material = new ShaderMaterial({
    name: `phase-5-${profile.bodyId}-differential-atmosphere`,
    side: FrontSide,
    transparent: false,
    depthWrite: true,
    uniforms: {
      uMap: { value: fallbackMap },
      uGrsDetailMap: { value: fallbackMap },
      uJetProfile: { value: jetProfileTexture },
      uRingProfile: { value: ringProfileTexture },
      uHasMap: { value: 0 },
      uHasGrsDetailMap: { value: 0 },
      uPlanetKind: { value: giantPlanetKind(profile.bodyId) },
      uBaseColor: { value: new Color(profile.baseColor) },
      uZoneColor: { value: new Color(profile.zoneColor) },
      uHazeColor: { value: new Color(profile.hazeColor) },
      uSunDirectionWorld: { value: new Vector3(-1, 0, 0) },
      uSunDirectionBodyLocal: { value: new Vector3(-1, 0, 0) },
      uOcclusion: { value: 1 },
      uRelativeIrradiance: { value: 1 },
      uTimeDays: { value: 0 },
      uAtmosphereTimeDays: { value: 0 },
      uQuality: { value: 2 },
      uEquatorialRadiusM: { value: profile.equatorialRadiusKm * 1_000 },
      uEquatorialRadiusRatio: { value: profile.equatorialRadiusKm / profile.meanRadiusKm },
      uPolarRadiusRatio: { value: profile.polarRadiusKm / profile.meanRadiusKm },
      uMaximumJetSpeedMps: { value: profile.maximumJetSpeedMps },
      uHasRingShadow: { value: profile.bodyId === 'saturn' ? 1 : 0 },
      uRingInnerRatio: { value: ringInnerRatio },
      uRingOuterRatio: { value: ringOuterRatio },
      uRingDisplayGain: { value: ringProfile?.displayOpticalDepthGain ?? 1 },
      uHasGreatRedSpot: { value: greatRedSpot === undefined ? 0 : 1 },
      uGrsCenterLatitudeRad: {
        value: degreesToRadians(greatRedSpot?.centerLatitudeDeg ?? 0),
      },
      uGrsCenterLongitudeRad: {
        value: degreesToRadians(greatRedSpot?.centerLongitudeAtEpochDeg ?? 0),
      },
      uGrsSourceLongitudeRad: {
        value: degreesToRadians(greatRedSpot?.sourceMapCenterLongitudeDeg ?? 0),
      },
      uGrsRadiusLatitudeRad: {
        value: degreesToRadians(greatRedSpot?.angularRadiusLatitudeDeg ?? 1),
      },
      uGrsRadiusLongitudeRad: {
        value: degreesToRadians(greatRedSpot?.angularRadiusLongitudeDeg ?? 1),
      },
      uGrsVortexPhase: { value: 0 },
      uGrsFilamentStrength: { value: greatRedSpot?.filamentStrength ?? 0 },
      uGrsPulsationScale: { value: 1 },
      uStormActive: { value: 0 },
      uStormCenterLatitudeRad: {
        value: degreesToRadians(datedStorm?.centerLatitudeDeg ?? 0),
      },
      uStormCenterLongitudeRad: {
        value: degreesToRadians(datedStorm?.centerLongitudeAtEpochDeg ?? 0),
      },
      uStormRadiusLatitudeRad: {
        value: degreesToRadians(datedStorm?.angularRadiusLatitudeDeg ?? 1),
      },
      uStormRadiusLongitudeRad: {
        value: degreesToRadians(datedStorm?.angularRadiusLongitudeDeg ?? 1),
      },
      uStormContrast: { value: datedStorm?.contrast ?? 0 },
      uStormLifetimeProgress: { value: 0 },
    },
    vertexShader: GIANT_PLANET_VERTEX_SHADER,
    fragmentShader: GIANT_PLANET_FRAGMENT_SHADER,
  });

  return { material, jetProfileTexture, ringProfileTexture };
}

export function createRingSystemVisualBundle(
  atmosphere: GiantAtmosphereProfile,
  profile: RingSystemProfile,
  sharedProfileTexture?: DataTexture,
): RingSystemVisualBundle {
  const innerRatio = profile.innerRadiusKm / atmosphere.meanRadiusKm;
  const outerRatio = profile.outerRadiusKm / atmosphere.meanRadiusKm;
  const geometry = new RingGeometry(innerRatio, outerRatio, 768, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.name = `phase-5-${profile.bodyId}-annulus-geometry`;
  const profileTexture = sharedProfileTexture ?? createRingProfileTexture(profile);
  const spokes = profile.spokes;
  const material = new ShaderMaterial({
    name: `phase-5-${profile.bodyId}-ring-optical-depth`,
    side: DoubleSide,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    premultipliedAlpha: true,
    uniforms: {
      uRingProfile: { value: profileTexture },
      uRingInnerRatio: { value: innerRatio },
      uRingOuterRatio: { value: outerRatio },
      uRingDisplayGain: { value: profile.displayOpticalDepthGain },
      uRingKind: { value: ringSystemKind(profile.bodyId) },
      uSunDirectionWorld: { value: new Vector3(-1, 0, 0) },
      uSunDirectionBodyLocal: { value: new Vector3(-1, 0, 0) },
      uOcclusion: { value: 1 },
      uRelativeIrradiance: { value: 1 },
      uTimeDays: { value: 0 },
      uQuality: { value: 2 },
      uPlanetEquatorialRatio: { value: atmosphere.equatorialRadiusKm / atmosphere.meanRadiusKm },
      uPlanetPolarRatio: { value: atmosphere.polarRadiusKm / atmosphere.meanRadiusKm },
      uSpokeInnerRatio: {
        value: spokes === undefined ? 0 : spokes.innerRadiusKm / atmosphere.meanRadiusKm,
      },
      uSpokeOuterRatio: {
        value: spokes === undefined ? 0 : spokes.outerRadiusKm / atmosphere.meanRadiusKm,
      },
      uSpokeStrength: { value: 0 },
    },
    vertexShader: RING_VERTEX_SHADER,
    fragmentShader: RING_FRAGMENT_SHADER,
  });
  material.forceSinglePass = true;
  const mesh = new Mesh(geometry, material);
  mesh.name = `phase-5-${profile.bodyId}-rings`;
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;
  return {
    mesh,
    material,
    geometry,
    profileTexture,
    boundingRadiusMultiplier: outerRatio,
  };
}

export function updateGiantPlanetMaterial(
  material: ShaderMaterial,
  profile: GiantAtmosphereProfile,
  jdTdb: number,
): void {
  // The supported ephemeris window is close enough to J2000 for Float32 shader
  // precision to remain sub-pixel. Do not modulo this value: latitude-dependent
  // wind periods are not commensurate and would visibly snap at every wrap.
  setUniformNumber(material, 'uAtmosphereTimeDays', jdTdb - 2_451_545);
  if (profile.greatRedSpot !== undefined) {
    const state = sampleGreatRedSpotState(profile.greatRedSpot, jdTdb);
    setUniformNumber(material, 'uGrsCenterLongitudeRad', state.centerLongitudeRad);
    setUniformNumber(material, 'uGrsVortexPhase', state.vortexPhaseRad);
    setUniformNumber(material, 'uGrsPulsationScale', state.pulsationScale);
  }
  const storm = profile.datedStorms?.[0];
  if (storm !== undefined) {
    const state = sampleDatedStormState(storm, jdTdb);
    setUniformNumber(material, 'uStormActive', state.active ? 1 : 0);
    setUniformNumber(material, 'uStormCenterLongitudeRad', state.centerLongitudeRad);
    setUniformNumber(material, 'uStormLifetimeProgress', state.lifetimeProgress);
  }
}

export function applyGiantPlanetQuality(
  material: ShaderMaterial,
  bodyId: GiantPlanetId,
  quality: VisualQuality,
): void {
  setUniformNumber(material, 'uQuality', qualityIndex(quality));
  if (bodyId === 'saturn') {
    setUniformNumber(
      material,
      'uSpokeStrength',
      quality === 'ultra' ? 0.28 : quality === 'high' ? 0.18 : 0,
    );
  }
}

export function createJetProfileTexture(profile: GiantAtmosphereProfile): DataTexture {
  const data = new Uint8Array(JET_TEXTURE_WIDTH * 4);
  for (let index = 0; index < JET_TEXTURE_WIDTH; index += 1) {
    const latitudeDeg = -90 + index / (JET_TEXTURE_WIDTH - 1) * 180;
    const speed = sampleJetSpeedMps(profile, latitudeDeg);
    const normalized = Math.min(1, Math.max(-1, speed / profile.maximumJetSpeedMps));
    const offset = index * 4;
    data[offset] = Math.round((normalized * 0.5 + 0.5) * 255);
    data[offset + 1] = Math.round(Math.abs(normalized) * 255);
    data[offset + 2] = speed >= 0 ? 255 : 0;
    data[offset + 3] = 255;
  }
  return configureDataTexture(data, JET_TEXTURE_WIDTH, `phase-5-${profile.bodyId}-jet-profile`);
}

export function createRingProfileTexture(profile: RingSystemProfile | null): DataTexture {
  if (profile === null) {
    return configureDataTexture(new Uint8Array([0, 0, 0, 0]), 1, 'phase-5-empty-ring-profile');
  }
  const data = new Uint8Array(RING_TEXTURE_WIDTH * 4);
  const radialSpan = profile.outerRadiusKm - profile.innerRadiusKm;
  for (let index = 0; index < RING_TEXTURE_WIDTH; index += 1) {
    let opticalDepthSum = 0;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let contributingSamples = 0;
    for (let subSample = 0; subSample < 8; subSample += 1) {
      const samplePosition = (index + (subSample + 0.5) / 8) / RING_TEXTURE_WIDTH;
      const radiusKm = profile.innerRadiusKm + samplePosition * radialSpan;
      const sample = sampleRingProfile(profile, radiusKm);
      if (sample.opticalDepth <= 0) continue;
      const color = new Color(sample.color).convertSRGBToLinear();
      opticalDepthSum += sample.opticalDepth;
      redSum += color.r * sample.opticalDepth;
      greenSum += color.g * sample.opticalDepth;
      blueSum += color.b * sample.opticalDepth;
      contributingSamples += 1;
    }
    const opticalDepth = opticalDepthSum / 8;
    const colorWeight = Math.max(opticalDepthSum, 1e-9);
    const stableStructure = opticalDepth <= 0
      ? 0
      : 0.88 + 0.12 * Math.sin(index * 0.173 + Math.sin(index * 0.019) * 3.1);
    const structuredDepth = Math.min(
      MAX_RING_OPTICAL_DEPTH,
      opticalDepth * stableStructure,
    );
    const offset = index * 4;
    data[offset] = contributingSamples === 0
      ? 0
      : Math.round(Math.min(1, Math.max(0, redSum / colorWeight)) * 255);
    data[offset + 1] = contributingSamples === 0
      ? 0
      : Math.round(Math.min(1, Math.max(0, greenSum / colorWeight)) * 255);
    data[offset + 2] = contributingSamples === 0
      ? 0
      : Math.round(Math.min(1, Math.max(0, blueSum / colorWeight)) * 255);
    data[offset + 3] = Math.round(
      Math.sqrt(structuredDepth / MAX_RING_OPTICAL_DEPTH) * 255,
    );
  }
  return configureDataTexture(data, RING_TEXTURE_WIDTH, `phase-5-${profile.bodyId}-ring-profile`);
}

function configureDataTexture(data: Uint8Array, width: number, name: string): DataTexture {
  const texture = new DataTexture(data, width, 1, RGBAFormat, UnsignedByteType);
  texture.name = name;
  texture.colorSpace = NoColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function giantPlanetKind(bodyId: GiantPlanetId): number {
  switch (bodyId) {
    case 'jupiter': return 0;
    case 'saturn': return 1;
    case 'uranus': return 2;
    case 'neptune': return 3;
  }
}

function ringSystemKind(bodyId: RingSystemProfile['bodyId']): number {
  switch (bodyId) {
    case 'saturn': return 0;
    case 'uranus': return 1;
    case 'neptune': return 2;
  }
}

function qualityIndex(quality: VisualQuality): number {
  switch (quality) {
    case 'low': return 0;
    case 'medium': return 1;
    case 'high': return 2;
    case 'ultra': return 3;
  }
}

function setUniformNumber(material: ShaderMaterial, name: string, value: number): void {
  const uniform = material.uniforms[name] as IUniform<number> | undefined;
  if (uniform !== undefined) uniform.value = value;
}

const SHARED_NOISE_GLSL = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise31(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z
    );
  }

  float fbm31(vec3 p) {
    float value = 0.0;
    float amplitude = 0.52;
    for (int octave = 0; octave < 4; octave++) {
      value += noise31(p) * amplitude;
      p = p * 2.03 + vec3(7.1, 3.7, 5.9);
      amplitude *= 0.49;
    }
    return value;
  }

  float wrappedAngleDelta(float left, float right) {
    const float PI = 3.141592653589793;
    const float TWO_PI = 6.283185307179586;
    return mod(left - right + PI, TWO_PI) - PI;
  }
`;

const GIANT_PLANET_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vVisualNormal;

  void main() {
    vUv = uv;
    vVisualNormal = normalize(normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const GIANT_PLANET_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uGrsDetailMap;
  uniform sampler2D uJetProfile;
  uniform sampler2D uRingProfile;
  uniform float uHasMap;
  uniform float uHasGrsDetailMap;
  uniform float uPlanetKind;
  uniform vec3 uBaseColor;
  uniform vec3 uZoneColor;
  uniform vec3 uHazeColor;
  uniform vec3 uSunDirectionWorld;
  uniform vec3 uSunDirectionBodyLocal;
  uniform float uOcclusion;
  uniform float uRelativeIrradiance;
  uniform float uTimeDays;
  uniform float uAtmosphereTimeDays;
  uniform float uQuality;
  uniform float uEquatorialRadiusM;
  uniform float uEquatorialRadiusRatio;
  uniform float uPolarRadiusRatio;
  uniform float uMaximumJetSpeedMps;
  uniform float uHasRingShadow;
  uniform float uRingInnerRatio;
  uniform float uRingOuterRatio;
  uniform float uRingDisplayGain;
  uniform float uHasGreatRedSpot;
  uniform float uGrsCenterLatitudeRad;
  uniform float uGrsCenterLongitudeRad;
  uniform float uGrsSourceLongitudeRad;
  uniform float uGrsRadiusLatitudeRad;
  uniform float uGrsRadiusLongitudeRad;
  uniform float uGrsVortexPhase;
  uniform float uGrsFilamentStrength;
  uniform float uGrsPulsationScale;
  uniform float uStormActive;
  uniform float uStormCenterLatitudeRad;
  uniform float uStormCenterLongitudeRad;
  uniform float uStormRadiusLatitudeRad;
  uniform float uStormRadiusLongitudeRad;
  uniform float uStormContrast;
  uniform float uStormLifetimeProgress;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vVisualNormal;
  ${SHARED_NOISE_GLSL}

  const float PI = 3.141592653589793;
  const float TWO_PI = 6.283185307179586;
  const float SECONDS_PER_DAY = 86400.0;
  const float MAX_RING_TAU = 5.0;
  const float RING_PROFILE_TEXEL = 0.000244140625;
  const float SATURN_SOLAR_ANGULAR_RADIUS = 0.00049;

  vec2 visualAngles(vec3 direction) {
    vec3 n = normalize(direction);
    return vec2(atan(n.z, n.x), asin(clamp(n.y, -1.0, 1.0)));
  }

  vec2 anglesToUv(vec2 angles) {
    return vec2(fract(0.5 - angles.x / TWO_PI), clamp(0.5 + angles.y / PI, 0.001, 0.999));
  }

  vec3 cleanJupiterMap(vec2 uv) {
    vec3 authored = texture2D(uMap, uv).rgb;
    vec2 sourceAngles = vec2(uGrsSourceLongitudeRad, uGrsCenterLatitudeRad);
    vec2 sampleAngles = vec2((0.5 - uv.x) * TWO_PI, (uv.y - 0.5) * PI);
    vec2 delta = vec2(
      wrappedAngleDelta(sampleAngles.x, sourceAngles.x) / uGrsRadiusLongitudeRad,
      (sampleAngles.y - sourceAngles.y) / uGrsRadiusLatitudeRad
    );
    float sourceSpot = 1.0 - smoothstep(0.8, 1.2, length(delta));
    vec3 leadingBand = texture2D(uMap, vec2(fract(uv.x - 0.038), uv.y)).rgb;
    vec3 trailingBand = texture2D(uMap, vec2(fract(uv.x + 0.038), uv.y)).rgb;
    vec3 neighboringBand = mix(
      leadingBand,
      trailingBand,
      smoothstep(-0.85, 0.85, delta.x)
    );
    return mix(authored, neighboringBand, sourceSpot);
  }

  vec3 proceduralBands(float latitude, float longitude, float jetSpeed) {
    float bandFrequency = uPlanetKind < 0.5
      ? 43.0
      : (uPlanetKind < 1.5 ? 34.0 : (uPlanetKind < 2.5 ? 18.0 : 25.0));
    float flow = jetSpeed / max(uMaximumJetSpeedMps, 1.0);
    vec3 flowPoint = vVisualNormal * (uPlanetKind < 1.5 ? 8.5 : 6.0);
    flowPoint += vec3(longitude * 0.7 + flow * uAtmosphereTimeDays * 0.11, latitude * 2.0, 0.0);
    float broadNoise = fbm31(flowPoint);
    float fineNoise = noise31(flowPoint * 2.7 + vec3(1.3, 7.9, 2.1));
    float bands = 0.5 + 0.5 * sin(latitude * bandFrequency + broadNoise * 3.2);
    float contrast = uPlanetKind < 0.5
      ? 0.78
      : (uPlanetKind < 1.5 ? 0.18 : (uPlanetKind < 2.5 ? 0.24 : 0.48));
    vec3 color = mix(uBaseColor, uZoneColor, mix(0.5, bands, contrast));
    float fineStrength = uPlanetKind < 0.5 ? 0.09 : (uPlanetKind < 1.5 ? 0.035 : 0.055);
    color *= 0.88 + broadNoise * 0.18 +
      (fineNoise - 0.5) * (uQuality > 1.5 ? fineStrength : fineStrength * 0.4);
    if (uPlanetKind > 1.5 && uPlanetKind < 2.5) {
      float polarHaze = smoothstep(0.42, 0.94, abs(sin(latitude)));
      color = mix(color, uZoneColor, polarHaze * 0.2);
    }
    if (uPlanetKind > 2.5) {
      float methaneCloud = smoothstep(0.76, 0.94, fineNoise + 0.12 * sin(longitude * 12.0));
      color += uHazeColor * methaneCloud * 0.24;
    }
    return color;
  }

  vec3 applyGreatRedSpot(vec3 baseColor, vec2 angles) {
    if (uHasGreatRedSpot < 0.5 || uHasMap < 0.5) return baseColor;
    float longitudeScale = max(cos(uGrsCenterLatitudeRad), 0.3);
    vec2 ellipse = vec2(
      wrappedAngleDelta(angles.x, uGrsCenterLongitudeRad) * longitudeScale /
        (uGrsRadiusLongitudeRad * uGrsPulsationScale),
      (angles.y - uGrsCenterLatitudeRad) /
        (uGrsRadiusLatitudeRad / uGrsPulsationScale)
    );
    float radius = length(ellipse);
    float mask = 1.0 - smoothstep(0.8, 1.16, radius);
    if (mask <= 0.0) return baseColor;

    // Preserve the observed OPAL cloud structure. A coherent counterclockwise
    // circulation plus a small, periodic collar lag avoids the old painted
    // spiral and remains continuous when the phase wraps by a full turn.
    float collar = smoothstep(0.1, 0.48, radius) *
      (1.0 - smoothstep(0.78, 1.08, radius));
    float collarLag = sin(uGrsVortexPhase * 2.0 + radius * 4.0) *
      uGrsFilamentStrength * 0.12 * collar;
    float rotation = uGrsVortexPhase + collarLag;
    mat2 vortex = mat2(cos(rotation), sin(rotation), -sin(rotation), cos(rotation));
    vec2 warped = vortex * ellipse;
    vec2 sourceAngles = vec2(
      uGrsSourceLongitudeRad + warped.x * uGrsRadiusLongitudeRad / longitudeScale,
      uGrsCenterLatitudeRad + warped.y * uGrsRadiusLatitudeRad
    );
    vec3 detail = texture2D(uMap, anglesToUv(sourceAngles)).rgb;
    if (uHasGrsDetailMap > 0.5) {
      // PIA23606 contributes only local luminance residuals, not its enhanced
      // color. OPAL therefore remains authoritative for the dated palette and
      // sampled cloud structure while the higher-resolution JunoCam mosaic
      // restores small cloud structure inside the vortex. Both observations are disclosed as
      // a mixed-date visualization rather than a single scientific frame.
      vec2 detailUv = clamp(
        vec2(0.5) + warped * vec2(0.32, 0.31),
        vec2(0.001),
        vec2(0.999)
      );
      float encodedResidual = texture2D(uGrsDetailMap, detailUv).r;
      float luminanceResidual = (encodedResidual - 0.5019607843) * 2.0;
      float innerDetailMask = 1.0 - smoothstep(0.58, 0.92, radius);
      float qualityStrength = mix(0.28, 0.46, smoothstep(0.5, 2.5, uQuality));
      detail *= 1.0 + luminanceResidual * qualityStrength * innerDetailMask;
      detail = clamp(detail, vec3(0.0), vec3(1.0));
    }
    return mix(baseColor, detail, mask);
  }

  vec3 applyDatedNeptuneStorm(vec3 baseColor, vec2 angles) {
    if (uStormActive < 0.5) return baseColor;
    vec2 ellipse = vec2(
      wrappedAngleDelta(angles.x, uStormCenterLongitudeRad) *
        max(cos(uStormCenterLatitudeRad), 0.3) / uStormRadiusLongitudeRad,
      (angles.y - uStormCenterLatitudeRad) / uStormRadiusLatitudeRad
    );
    float radius = length(ellipse);
    float mask = 1.0 - smoothstep(0.72, 1.08, radius);
    float lifecycleFade = pow(max(sin(uStormLifetimeProgress * PI), 0.0), 0.32);
    float curl = 0.82 + 0.18 * sin(atan(ellipse.y, ellipse.x) * 5.0 + radius * 15.0);
    vec3 darkVortex = baseColor * (1.0 - uStormContrast * curl * lifecycleFade);
    float companion = smoothstep(0.76, 0.94, ellipse.x) *
      (1.0 - smoothstep(0.85, 1.18, abs(ellipse.y + 0.22))) * mask;
    darkVortex += uHazeColor * companion * 0.35 * lifecycleFade;
    return mix(baseColor, darkVortex, mask * lifecycleFade);
  }

  float ringShadowTransmittanceSample(float radialUv, float incidence) {
    if (radialUv <= 0.0 || radialUv >= 1.0) return 1.0;
    float encodedDepth = texture2D(uRingProfile, vec2(radialUv, 0.5)).a;
    float opticalDepth = encodedDepth * encodedDepth * MAX_RING_TAU;
    return exp(-opticalDepth * uRingDisplayGain / incidence);
  }

  float filteredRingShadowTransmittance(
    float radialUv,
    float filterWidth,
    float incidence
  ) {
    // The generated profile intentionally retains fine radial structure for a
    // close ring-plane view. Integrating seven taps across the projected pixel
    // and solar-disc footprint prevents that structure from becoming dark
    // barcode bands when it is projected onto Saturn's curved cloud tops.
    float transmittance = 0.0;
    transmittance += ringShadowTransmittanceSample(radialUv - filterWidth, incidence) * 0.07;
    transmittance += ringShadowTransmittanceSample(radialUv - filterWidth * 0.55, incidence) * 0.11;
    transmittance += ringShadowTransmittanceSample(radialUv - filterWidth * 0.22, incidence) * 0.18;
    transmittance += ringShadowTransmittanceSample(radialUv, incidence) * 0.28;
    transmittance += ringShadowTransmittanceSample(radialUv + filterWidth * 0.22, incidence) * 0.18;
    transmittance += ringShadowTransmittanceSample(radialUv + filterWidth * 0.55, incidence) * 0.11;
    transmittance += ringShadowTransmittanceSample(radialUv + filterWidth, incidence) * 0.07;
    return transmittance;
  }

  float saturnRingTransmittance(vec3 sunVisual) {
    if (uHasRingShadow < 0.5 || abs(sunVisual.y) < 0.0005) return 1.0;
    vec3 point = vec3(
      vVisualNormal.x * uEquatorialRadiusRatio,
      vVisualNormal.y * uPolarRadiusRatio,
      vVisualNormal.z * uEquatorialRadiusRatio
    );
    float travel = -point.y / sunVisual.y;
    vec3 ringHit = point + sunVisual * travel;
    float radius = length(ringHit.xz);
    float ringSpan = max(uRingOuterRatio - uRingInnerRatio, 0.0001);
    float radialUv = (radius - uRingInnerRatio) / ringSpan;
    float projectedFootprint = fwidth(radialUv) * 1.35;
    float solarPenumbra = abs(travel) * SATURN_SOLAR_ANGULAR_RADIUS / ringSpan;
    float filterWidth = clamp(
      max(max(projectedFootprint, solarPenumbra), RING_PROFILE_TEXEL * 2.0),
      RING_PROFILE_TEXEL * 2.0,
      0.018
    );
    if (travel <= 0.0 || radialUv <= -filterWidth || radialUv >= 1.0 + filterWidth) {
      return 1.0;
    }
    float incidence = max(abs(sunVisual.y), 0.045);
    float transmittance = filteredRingShadowTransmittance(
      radialUv,
      filterWidth,
      incidence
    );
    // Saturn's upper haze and the rings themselves scatter light into the
    // nominal umbra. Keep the shadow strong without crushing cloud detail to
    // black, and fade it gradually as direct sunlight approaches the limb.
    float scatteredTransmittance = mix(1.0, max(0.1, transmittance), 0.88);
    float illuminatedHemisphere = smoothstep(0.0, 0.24, dot(vVisualNormal, sunVisual));
    return mix(1.0, scatteredTransmittance, illuminatedHemisphere);
  }

  void main() {
    vec2 angles = visualAngles(vVisualNormal);
    float latitudeUv = clamp(angles.y / PI + 0.5, 0.002, 0.998);
    float encodedJet = texture2D(uJetProfile, vec2(latitudeUv, 0.5)).r;
    float jetSpeed = (encodedJet * 2.0 - 1.0) * uMaximumJetSpeedMps;
    vec3 procedural = proceduralBands(angles.y, angles.x, jetSpeed);
    vec3 albedo = procedural;
    if (uHasMap > 0.5) {
      vec3 staticMap = cleanJupiterMap(vUv);
      // OPAL has no reliable extreme-polar coverage. Fade only those latitudes
      // to the deterministic atmosphere instead of displaying black map rows.
      float observedCoverage = 1.0 - smoothstep(1.38, 1.5, abs(angles.y));
      albedo = mix(procedural, staticMap, observedCoverage);
    }
    albedo = applyGreatRedSpot(albedo, angles);
    albedo = applyDatedNeptuneStorm(albedo, angles);

    vec3 normal = normalize(vWorldNormal);
    vec3 lightDirection = normalize(uSunDirectionWorld);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 halfDirection = normalize(lightDirection + viewDirection);
    vec3 sunVisual = normalize(vec3(
      uSunDirectionBodyLocal.x,
      uSunDirectionBodyLocal.z,
      -uSunDirectionBodyLocal.y
    ));
    float irradianceScale = clamp(pow(max(uRelativeIrradiance, 0.0001), 0.25), 0.48, 1.65);
    float ringTransmittance = saturnRingTransmittance(sunVisual);
    float solarCosine = dot(normal, lightDirection);
    float terminator = smoothstep(-0.012, 0.012, solarCosine);
    float direct = max(solarCosine, 0.0) * terminator *
      clamp(uOcclusion, 0.0, 1.0) * irradianceScale * ringTransmittance;
    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.4);
    float specular = pow(max(dot(normal, halfDirection), 0.0), 44.0) * direct * 0.14;
    float dayHaze = smoothstep(-0.025, 0.08, solarCosine);
    vec3 color = albedo * (0.012 + direct * 0.988);
    color += uHazeColor * fresnel * (0.018 + dayHaze * 0.035 + direct * 0.24) +
      vec3(1.0, 0.92, 0.78) * specular;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const RING_VERTEX_SHADER = /* glsl */ `
  varying vec3 vVisualPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vRingRadius;

  void main() {
    vVisualPosition = position;
    vRingRadius = length(position.xz);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const RING_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uRingProfile;
  uniform float uRingInnerRatio;
  uniform float uRingOuterRatio;
  uniform float uRingDisplayGain;
  uniform float uRingKind;
  uniform vec3 uSunDirectionWorld;
  uniform vec3 uSunDirectionBodyLocal;
  uniform float uOcclusion;
  uniform float uRelativeIrradiance;
  uniform float uTimeDays;
  uniform float uQuality;
  uniform float uPlanetEquatorialRatio;
  uniform float uPlanetPolarRatio;
  uniform float uSpokeInnerRatio;
  uniform float uSpokeOuterRatio;
  uniform float uSpokeStrength;
  varying vec3 vVisualPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vRingRadius;
  ${SHARED_NOISE_GLSL}

  const float MAX_RING_TAU = 5.0;

  vec3 bodySunToVisual(vec3 direction) {
    return normalize(vec3(direction.x, direction.z, -direction.y));
  }

  float planetShadow(vec3 point, vec3 sunVisual) {
    vec3 scaledPoint = vec3(
      point.x / uPlanetEquatorialRatio,
      point.y / uPlanetPolarRatio,
      point.z / uPlanetEquatorialRatio
    );
    vec3 scaledDirection = vec3(
      sunVisual.x / uPlanetEquatorialRatio,
      sunVisual.y / uPlanetPolarRatio,
      sunVisual.z / uPlanetEquatorialRatio
    );
    float denominator = dot(scaledDirection, scaledDirection);
    float travel = -dot(scaledPoint, scaledDirection) / max(denominator, 0.00001);
    if (travel <= 0.0) return 1.0;
    float clearance = length(scaledPoint + scaledDirection * travel);
    float penumbra = 0.025 + min(travel, 3.0) * 0.006;
    float visibility = smoothstep(1.0 - penumbra, 1.0 + penumbra, clearance);
    return mix(0.08, 1.0, visibility);
  }

  float saturnSpokes(float radius, float angle) {
    if (uSpokeStrength <= 0.0) return 0.0;
    float inner = smoothstep(uSpokeInnerRatio, uSpokeInnerRatio + 0.08, radius);
    float outer = 1.0 - smoothstep(uSpokeOuterRatio - 0.08, uSpokeOuterRatio, radius);
    float drift = uTimeDays * 0.12;
    float primaryWindow = exp(-pow(wrappedAngleDelta(angle, drift) / 0.34, 2.0));
    float secondaryWindow = exp(-pow(wrappedAngleDelta(angle, drift + 2.42) / 0.24, 2.0)) * 0.58;
    float filament = 0.5 + 0.5 * sin(
      angle * 43.0 + radius * 19.0 - uTimeDays * 0.8
    );
    float localizedFilaments = (primaryWindow + secondaryWindow) *
      mix(0.26, 1.0, filament);
    float envelope = 0.55 + 0.45 * sin(uTimeDays * 0.31 + 1.7);
    return inner * outer * localizedFilaments * envelope * uSpokeStrength;
  }

  float neptuneArcGain(float radiusUv, float angle) {
    if (uRingKind < 1.5 || radiusUv < 0.982) return 1.0;
    float arcs = 0.0;
    arcs += pow(max(cos(angle - 0.35), 0.0), 42.0);
    arcs += pow(max(cos(angle - 0.92), 0.0), 54.0);
    arcs += pow(max(cos(angle - 1.38), 0.0), 48.0);
    arcs += pow(max(cos(angle - 1.78), 0.0), 58.0);
    return 1.0 + arcs * 7.5;
  }

  void main() {
    float radiusUv = clamp(
      (vRingRadius - uRingInnerRatio) / max(uRingOuterRatio - uRingInnerRatio, 0.0001),
      0.0,
      1.0
    );
    vec4 profile = texture2D(uRingProfile, vec2(radiusUv, 0.5));
    float opticalDepth = profile.a * profile.a * MAX_RING_TAU;
    if (opticalDepth <= 0.000001) discard;

    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 lightDirection = normalize(uSunDirectionWorld);
    vec3 sunVisual = bodySunToVisual(uSunDirectionBodyLocal);
    vec3 ringNormal = normalize(vWorldNormal);
    float viewMu = max(abs(dot(ringNormal, viewDirection)), 0.055);
    float sunMu = max(abs(dot(ringNormal, lightDirection)), 0.035);
    float angle = atan(vVisualPosition.z, vVisualPosition.x);
    float arcGain = neptuneArcGain(radiusUv, angle);
    float effectiveDepth = opticalDepth * uRingDisplayGain * arcGain;
    float alpha = min(0.94, 1.0 - exp(-effectiveDepth / viewMu));
    float shadow = planetShadow(vVisualPosition, sunVisual);
    float irradianceScale = clamp(pow(max(uRelativeIrradiance, 0.0001), 0.25), 0.5, 1.55);
    float forwardPhase = pow(max(dot(-lightDirection, viewDirection), 0.0), 9.0);
    // The sampled optical-depth profile already carries radial structure.
    // A second high-frequency carrier creates moire at oblique views.
    float stableSparkle = 1.0;
    float spoke = uRingKind < 0.5 ? saturnSpokes(vRingRadius, angle) : 0.0;
    vec3 color = profile.rgb * stableSparkle;
    color *= (0.055 + sunMu * 0.945 * shadow * clamp(uOcclusion, 0.0, 1.0) * irradianceScale);
    color += profile.rgb * forwardPhase * (0.18 + 0.35 * (1.0 - sunMu));
    color *= 1.0 - spoke * 0.72;
    alpha *= 1.0 - spoke * 0.28;
    gl_FragColor = vec4(color * alpha, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
