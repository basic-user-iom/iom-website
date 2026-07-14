import * as THREE from 'three'

const OCEAN_SIM_VERTEX = /* glsl */ `
varying vec2 vUV;
void main() {
  vUV = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position, 1.0);
}
`

const OCEAN_SUBTRANSFORM_FRAGMENT = /* glsl */ `
const float PI = 3.14159265359;
uniform sampler2D u_input;
uniform float u_transformSize;
uniform float u_subtransformSize;
varying vec2 vUV;

vec2 multiplyComplex(vec2 a, vec2 b) {
  return vec2(a[0] * b[0] - a[1] * b[1], a[1] * b[0] + a[0] * b[1]);
}

void main() {
  #ifdef HORIZONTAL
    float index = vUV.x * u_transformSize - 0.5;
  #else
    float index = vUV.y * u_transformSize - 0.5;
  #endif

  float evenIndex = floor(index / u_subtransformSize) * (u_subtransformSize * 0.5) + mod(index, u_subtransformSize * 0.5);

  #ifdef HORIZONTAL
    vec4 even = texture2D(u_input, vec2(evenIndex + 0.5, gl_FragCoord.y) / u_transformSize).rgba;
    vec4 odd = texture2D(u_input, vec2(evenIndex + u_transformSize * 0.5 + 0.5, gl_FragCoord.y) / u_transformSize).rgba;
  #else
    vec4 even = texture2D(u_input, vec2(gl_FragCoord.x, evenIndex + 0.5) / u_transformSize).rgba;
    vec4 odd = texture2D(u_input, vec2(gl_FragCoord.x, evenIndex + u_transformSize * 0.5 + 0.5) / u_transformSize).rgba;
  #endif

  float twiddleArgument = -2.0 * PI * (index / u_subtransformSize);
  vec2 twiddle = vec2(cos(twiddleArgument), sin(twiddleArgument));

  vec2 outputA = even.xy + multiplyComplex(twiddle, odd.xy);
  vec2 outputB = even.zw + multiplyComplex(twiddle, odd.zw);

  gl_FragColor = vec4(outputA, outputB);
}
`

const OCEAN_INITIAL_SPECTRUM_FRAGMENT = /* glsl */ `
const float PI = 3.14159265359;
const float G = 9.81;
const float KM = 370.0;
const float CM = 0.23;

uniform vec2 u_wind;
uniform float u_resolution;
uniform float u_size;

float square(float x) { return x * x; }
float omega(float k) { return sqrt(G * k * (1.0 + square(k / KM))); }
float tanhApprox(float x) { return (1.0 - exp(-2.0 * x)) / (1.0 + exp(-2.0 * x)); }

void main() {
  vec2 coordinates = gl_FragCoord.xy - 0.5;
  float n = (coordinates.x < u_resolution * 0.5) ? coordinates.x : coordinates.x - u_resolution;
  float m = (coordinates.y < u_resolution * 0.5) ? coordinates.y : coordinates.y - u_resolution;

  vec2 K = (2.0 * PI * vec2(n, m)) / u_size;
  float k = length(K);
  float l_wind = length(u_wind);

  float Omega = 0.84;
  float kp = G * square(Omega / l_wind);
  float c = omega(k) / k;
  float cp = omega(kp) / kp;

  float Lpm = exp(-1.25 * square(kp / k));
  float gamma = 1.7;
  float sigma = 0.08 * (1.0 + 4.0 * pow(Omega, -3.0));
  float Gamma = exp(-square(sqrt(k / kp) - 1.0) / 2.0 * square(sigma));
  float Jp = pow(gamma, Gamma);
  float Fp = Lpm * Jp * exp(-Omega / sqrt(10.0) * (sqrt(k / kp) - 1.0));
  float alphap = 0.006 * sqrt(Omega);
  float Bl = 0.5 * alphap * cp / c * Fp;

  float z0 = 0.000037 * square(l_wind) / G * pow(l_wind / cp, 0.9);
  float uStar = 0.41 * l_wind / log(10.0 / z0);
  float alpham = 0.01 * ((uStar < CM) ? (1.0 + log(uStar / CM)) : (1.0 + 3.0 * log(uStar / CM)));
  float Fm = exp(-0.25 * square(k / KM - 1.0));
  float Bh = 0.5 * alpham * CM / c * Fm * Lpm;

  float a0 = log(2.0) / 4.0;
  float am = 0.13 * uStar / CM;
  float Delta = tanhApprox(a0 + 4.0 * pow(c / cp, 2.5) + am * pow(CM / c, 2.5));
  float cosPhi = dot(normalize(u_wind), normalize(K));

  float S = (1.0 / (2.0 * PI)) * pow(k, -4.0) * (Bl + Bh) * (1.0 + Delta * (2.0 * cosPhi * cosPhi - 1.0));
  float dk = 2.0 * PI / u_size;
  float h = sqrt(S / 2.0) * dk;

  if (K.x == 0.0 && K.y == 0.0) h = 0.0;
  gl_FragColor = vec4(h, 0.0, 0.0, 0.0);
}
`

const OCEAN_PHASE_FRAGMENT = /* glsl */ `
const float PI = 3.14159265359;
const float G = 9.81;
const float KM = 370.0;

varying vec2 vUV;
uniform sampler2D u_phases;
uniform float u_deltaTime;
uniform float u_resolution;
uniform float u_size;

float omega(float k) { return sqrt(G * k * (1.0 + k * k / KM * KM)); }

void main() {
  vec2 coordinates = gl_FragCoord.xy - 0.5;
  float n = (coordinates.x < u_resolution * 0.5) ? coordinates.x : coordinates.x - u_resolution;
  float m = (coordinates.y < u_resolution * 0.5) ? coordinates.y : coordinates.y - u_resolution;
  vec2 waveVector = (2.0 * PI * vec2(n, m)) / u_size;

  float phase = texture2D(u_phases, vUV).r;
  float deltaPhase = omega(length(waveVector)) * u_deltaTime;
  phase = mod(phase + deltaPhase, 2.0 * PI);

  gl_FragColor = vec4(phase, 0.0, 0.0, 0.0);
}
`

const OCEAN_SPECTRUM_FRAGMENT = /* glsl */ `
const float PI = 3.14159265359;
const float G = 9.81;
const float KM = 370.0;

varying vec2 vUV;
uniform float u_size;
uniform float u_resolution;
uniform float u_choppiness;
uniform sampler2D u_phases;
uniform sampler2D u_initialSpectrum;

vec2 multiplyComplex(vec2 a, vec2 b) {
  return vec2(a[0] * b[0] - a[1] * b[1], a[1] * b[0] + a[0] * b[1]);
}
vec2 multiplyByI(vec2 z) { return vec2(-z[1], z[0]); }
float omega(float k) { return sqrt(G * k * (1.0 + k * k / KM * KM)); }

void main() {
  vec2 coordinates = gl_FragCoord.xy - 0.5;
  float n = (coordinates.x < u_resolution * 0.5) ? coordinates.x : coordinates.x - u_resolution;
  float m = (coordinates.y < u_resolution * 0.5) ? coordinates.y : coordinates.y - u_resolution;
  vec2 waveVector = (2.0 * PI * vec2(n, m)) / u_size;

  float phase = texture2D(u_phases, vUV).r;
  vec2 phaseVector = vec2(cos(phase), sin(phase));

  vec2 h0 = texture2D(u_initialSpectrum, vUV).rg;
  vec2 h0Star = texture2D(u_initialSpectrum, vec2(1.0 - vUV + 1.0 / u_resolution)).rg;
  h0Star.y *= -1.0;

  vec2 h = multiplyComplex(h0, phaseVector) + multiplyComplex(h0Star, vec2(phaseVector.x, -phaseVector.y));
  vec2 hX = -multiplyByI(h * (waveVector.x / length(waveVector))) * u_choppiness;
  vec2 hZ = -multiplyByI(h * (waveVector.y / length(waveVector))) * u_choppiness;

  if (waveVector.x == 0.0 && waveVector.y == 0.0) {
    h = vec2(0.0);
    hX = vec2(0.0);
    hZ = vec2(0.0);
  }

  gl_FragColor = vec4(hX + multiplyByI(h), hZ);
}
`

const OCEAN_NORMALS_FRAGMENT = /* glsl */ `
varying vec2 vUV;
uniform sampler2D u_displacementMap;
uniform float u_resolution;
uniform float u_size;

void main() {
  float texel = 1.0 / u_resolution;
  float texelSize = u_size / u_resolution;

  vec3 center = texture2D(u_displacementMap, vUV).rgb;
  vec3 right = vec3(texelSize, 0.0, 0.0) + texture2D(u_displacementMap, vUV + vec2(texel, 0.0)).rgb - center;
  vec3 left = vec3(-texelSize, 0.0, 0.0) + texture2D(u_displacementMap, vUV + vec2(-texel, 0.0)).rgb - center;
  vec3 top = vec3(0.0, 0.0, -texelSize) + texture2D(u_displacementMap, vUV + vec2(0.0, -texel)).rgb - center;
  vec3 bottom = vec3(0.0, 0.0, texelSize) + texture2D(u_displacementMap, vUV + vec2(0.0, texel)).rgb - center;

  vec3 topRight = cross(right, top);
  vec3 topLeft = cross(top, left);
  vec3 bottomLeft = cross(left, bottom);
  vec3 bottomRight = cross(bottom, right);

  gl_FragColor = vec4(normalize(topRight + topLeft + bottomLeft + bottomRight), 1.0);
}
`

const SCREENPLANE_PARS_VERTEX = /* glsl */ `
const float infinite = 150000.0;
const float screenScale = 2.4;
const vec3 groundNormal = vec3(0.0, 1.0, 0.0);
const float groundHeight = 0.0;

varying vec3 vCamPosition;

vec3 interceptPlane(vec3 source, vec3 dir, vec3 normal, float height) {
  float distance = (-height - dot(normal, source)) / dot(normal, dir);
  if (distance < 0.0) return source + dir * distance;
  return -(vec3(source.x, height, source.z) + vec3(dir.x, height, dir.z) * infinite);
}

mat3 getRotation() {
  return mat3(viewMatrix[0].xyz, viewMatrix[1].xyz, viewMatrix[2].xyz);
}

vec3 getCameraPos(mat3 rotation) {
  return -viewMatrix[3].xyz * rotation;
}

vec2 getImagePlan() {
  float focal = projectionMatrix[0].x;
  float aspect = projectionMatrix[1].y;
  return vec2((uv.x - 0.5) * screenScale * aspect, (uv.y - 0.5) * screenScale * focal);
}

vec3 getCamRay(mat3 rotation, vec2 screenUV) {
  return vec3(screenUV.x, screenUV.y, projectionMatrix[0].x) * rotation;
}

vec3 computeProjectedPosition() {
  mat3 cameraRotation = getRotation();
  vec3 camPosition = getCameraPos(cameraRotation);
  vCamPosition = camPosition;

  if (camPosition.y < groundHeight) return vec3(0.0);

  vec2 screenUV = getImagePlan();
  vec3 ray = getCamRay(cameraRotation, screenUV);
  vec3 finalPos = interceptPlane(camPosition, ray, groundNormal, groundHeight);

  float distance = length(finalPos);
  if (distance > infinite) finalPos *= infinite / distance;

  return finalPos;
}
`

const OCEAN_MAIN_VERTEX = /* glsl */ `
precision highp float;

varying vec3 vWorldPosition;
varying vec4 vReflectCoordinates;

uniform mat4 u_mirrorMatrix;
uniform sampler2D u_displacementMap;
uniform float u_geometrySize;
uniform float u_size;
uniform vec2 u_oceanScroll;
uniform float u_oceanUvScale;
${SCREENPLANE_PARS_VERTEX}

void main() {
  vec4 screenPlaneWorldPosition = vec4(computeProjectedPosition(), 1.0);
  vec4 worldPosition = screenPlaneWorldPosition;

  vec3 displacement = texture2D(u_displacementMap, (worldPosition.xz + u_oceanScroll) * u_oceanUvScale).rgb * (u_geometrySize / u_size);
  vec4 oceanfftWorldPosition = worldPosition + vec4(displacement, 0.0);

  vWorldPosition = oceanfftWorldPosition.xyz;
  vReflectCoordinates = u_mirrorMatrix * oceanfftWorldPosition;
  gl_Position = projectionMatrix * viewMatrix * oceanfftWorldPosition;
}
`

const OCEAN_MAIN_VERTEX_NO_TEX = /* glsl */ `
precision highp float;

varying vec3 vWorldPosition;
varying vec4 vReflectCoordinates;

uniform mat4 u_mirrorMatrix;

${SCREENPLANE_PARS_VERTEX}

void main() {
  vec4 screenPlaneWorldPosition = vec4(computeProjectedPosition(), 1.0);
  vWorldPosition = screenPlaneWorldPosition.xyz;
  vReflectCoordinates = u_mirrorMatrix * screenPlaneWorldPosition;
  gl_Position = projectionMatrix * viewMatrix * screenPlaneWorldPosition;
}
`

const OCEAN_MAIN_FRAGMENT = /* glsl */ `
varying vec3 vWorldPosition;
varying vec4 vReflectCoordinates;
varying vec3 vCamPosition;

uniform sampler2D u_reflection;
uniform sampler2D u_normalMap;
uniform vec2 u_oceanScroll;
uniform float u_oceanUvScale;
uniform vec3 u_oceanColor;
uniform vec3 u_skyColor;
uniform vec3 u_sunDirection;
uniform float u_exposure;

vec3 hdr(vec3 color, float exposure) {
  return 1.0 - exp(-color * exposure);
}

void main() {
  vec3 rawNormal = texture2D(u_normalMap, (vWorldPosition.xz + u_oceanScroll) * u_oceanUvScale).rgb;
  vec3 view = normalize(vCamPosition - vWorldPosition);

  vec3 reflection = normalize(reflect(-u_sunDirection, rawNormal));
  float sunSpec = pow(max(0.0, dot(view, reflection)), 480.0) * 12.0;
  float broadSpec = pow(max(0.0, dot(view, reflection)), 64.0) * 0.18;

  vec3 distortion = 200.0 * rawNormal * vec3(1.0, 0.0, 0.1);
  vec3 reflectionColor = texture2DProj(u_reflection, vReflectCoordinates.xyz + distortion).xyz;
  reflectionColor = max(reflectionColor, vec3(0.04, 0.05, 0.07));

  float distanceRatio = min(1.0, log(1.0 / length(vCamPosition - vWorldPosition) * 3000.0 + 1.0));
  distanceRatio *= distanceRatio;
  distanceRatio = distanceRatio * 0.7 + 0.3;
  vec3 normal = (distanceRatio * rawNormal + vec3(0.0, 1.0 - distanceRatio, 0.0)) * 0.5;
  normal /= length(normal);

  float fresnel = pow(1.0 - dot(normal, view), 2.0);
  float skyFactor = (fresnel + 0.14) * 6.5;
  vec3 waterColor = (1.0 - fresnel) * u_oceanColor;

  float steepness = 1.0 - clamp(rawNormal.y, 0.0, 1.0);
  float crestFoam = smoothstep(0.05, 0.22, steepness);
  crestFoam *= smoothstep(0.2, 0.85, dot(rawNormal, -u_sunDirection) * 0.5 + 0.5);
  float foamSparkle = pow(max(0.0, dot(view, reflection)), 90.0) * crestFoam * 8.0;
  vec3 foamColor = vec3(0.72, 0.76, 0.82) * (crestFoam * 0.32 + foamSparkle);

  vec3 skyTint = u_skyColor * (0.035 + fresnel * 0.055);
  vec3 color =
    (skyFactor + sunSpec + broadSpec + waterColor) * reflectionColor +
    waterColor * 0.38 +
    skyTint +
    foamColor;
  color = hdr(color, u_exposure);
  color = max(color, vec3(0.022, 0.028, 0.038));

  gl_FragColor = vec4(color, 1.0);
}
`

export function supportsFloatTextures(gl: WebGLRenderingContext) {
  const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
  if (isWebGL2 || 'createVertexArray' in gl) {
    return Boolean(
      gl.getExtension('EXT_color_buffer_float') ??
        gl.getExtension('EXT_color_buffer_half_float'),
    )
  }
  return Boolean(gl.getExtension('OES_texture_float') && gl.getExtension('OES_texture_float_linear'))
}

export function createSimMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: OCEAN_SIM_VERTEX,
    fragmentShader,
    depthTest: false,
    blending: THREE.NoBlending,
  })
}

export function createSubtransformMaterial(horizontal: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      u_input: { value: null },
      u_transformSize: { value: 128 },
      u_subtransformSize: { value: null },
    },
    vertexShader: OCEAN_SIM_VERTEX,
    fragmentShader: `${horizontal ? '#define HORIZONTAL\n' : ''}${OCEAN_SUBTRANSFORM_FRAGMENT}`,
    depthTest: false,
    blending: THREE.NoBlending,
  })
}

export function createOceanRenderMaterial(supportsVertexTextures: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      u_displacementMap: { value: null },
      u_reflection: { value: null },
      u_normalMap: { value: null },
      u_geometrySize: { value: 128 },
      u_size: { value: 120 },
      u_mirrorMatrix: { value: new THREE.Matrix4() },
      u_oceanColor: { value: new THREE.Vector3(0.06, 0.1, 0.14) },
      u_skyColor: { value: new THREE.Vector3(2.2, 2.8, 3.4) },
      u_sunDirection: { value: new THREE.Vector3(-0.28, 0.52, -0.38) },
      u_exposure: { value: 0.1 },
      u_oceanScroll: { value: new THREE.Vector2(0, 0) },
      u_oceanUvScale: { value: 0.018 },
    },
    vertexShader: supportsVertexTextures ? OCEAN_MAIN_VERTEX : OCEAN_MAIN_VERTEX_NO_TEX,
    fragmentShader: OCEAN_MAIN_FRAGMENT,
    side: THREE.FrontSide,
    blending: THREE.NoBlending,
  })
}

export {
  OCEAN_INITIAL_SPECTRUM_FRAGMENT,
  OCEAN_PHASE_FRAGMENT,
  OCEAN_SPECTRUM_FRAGMENT,
  OCEAN_NORMALS_FRAGMENT,
}
