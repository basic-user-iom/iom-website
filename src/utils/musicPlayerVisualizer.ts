import * as THREE from 'three'
import { getDeviceProfile } from './device'
import type { MusicPlayerVisualizerLike } from './musicPlayerVisualizerTypes'

const MOON_SPOTLIGHT_TEXTURE = '/assets/textures/moon-spotlight.png'

const SHARED_NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  int limit = min(octaves, uFbmOctaves);
  for (int i = 0; i < 6; i++) {
    if (i >= limit) break;
    value += amp * snoise(p * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return value;
}

float crater(vec2 p, float seed) {
  float d = length(p - vec2(sin(seed * 3.7), cos(seed * 2.1)) * 0.32);
  return smoothstep(0.5, 0.18, d) * 0.1;
}

float terrainHeight(vec2 xz) {
  float t = uTime * uAnim;
  vec2 drift = vec2(sin(t * 0.012), cos(t * 0.009)) * 0.035 * uEnergy;
  vec3 samplePos = vec3((xz + drift) * 0.52, t * 0.02);
  float base = fbm(samplePos, 3);
  float detail = fbm(samplePos * (0.9 + uDetail * 0.35) + vec3(0.0, t * 0.025, 0.0), 2)
    * (0.04 + uDetail * 0.07);
  float craterA = crater(xz * 0.85 + vec2(0.3, -0.2), 1.7);
  float craterB = crater(xz * 1.0 + vec2(-0.45, 0.35), 4.2) * 0.4;
  float ridges = abs(snoise(vec3(xz * 0.95, t * 0.018 + 1.4)));
  ridges = pow(1.0 - ridges, 1.6) * (0.02 + uMids * 0.06);
  float h = base * 0.62 + detail + ridges - craterA - craterB;
  float amp = 0.55 + uBass * 0.85 + uEnergy * 0.18;
  return h * amp;
}

vec3 terrainNormal(vec2 xz) {
  float eps = 0.07;
  float h = terrainHeight(xz);
  float hx = terrainHeight(xz + vec2(eps, 0.0));
  float hz = terrainHeight(xz + vec2(0.0, eps));
  return normalize(vec3(h - hx, eps * 2.0, h - hz));
}
`

const RAYMARCH_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
uniform float uAnim;
uniform float uBass;
uniform float uMids;
uniform float uHighs;
uniform float uEnergy;
uniform float uDetail;
uniform float uAspect;
uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform vec3 uCamTarget;
uniform float uFov;
uniform int uMaxSteps;
uniform int uFbmOctaves;
uniform int uCausticOctaves;
uniform float uLowQuality;
uniform vec2 uInteract;
uniform sampler2D uMoonMap;
uniform float uMoonMapReady;

${SHARED_NOISE_GLSL}

float map(vec3 p) {
  return p.y - terrainHeight(p.xz);
}

float raymarch(vec3 ro, vec3 rd, out float steps, out float surfaceDist) {
  float t = 0.0;
  steps = 0.0;
  surfaceDist = 1e4;
  for (int i = 0; i < 96; i++) {
    if (i >= uMaxSteps) break;
    vec3 p = ro + rd * t;
    float d = map(p);
    surfaceDist = d;
    if (d < 0.0035) break;
    if (t > 55.0) break;
    t += max(d * 0.62, 0.014);
    steps += 1.0;
  }
  return t;
}

vec3 acesTone(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 sampleSkyReflection(vec3 reflDir) {
  float horizon = smoothstep(-0.08, 0.42, reflDir.y);
  vec3 zenith = vec3(0.008, 0.01, 0.018);
  vec3 horizonCol = vec3(0.012, 0.016, 0.028);
  vec3 sky = mix(horizonCol, zenith, horizon);
  vec3 moonDir = normalize(vec3(0.28, 0.88, -0.35));
  float moonGlow = pow(max(dot(reflDir, moonDir), 0.0), 96.0);
  sky += vec3(0.18, 0.2, 0.24) * moonGlow * 0.12;
  return sky;
}

float fresnelSchlick(vec3 viewDir, vec3 normal, float f0) {
  float cosTheta = max(dot(viewDir, normal), 0.0);
  return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
}

float ggxSpecular(vec3 normal, vec3 lightDir, vec3 viewDir, float roughness) {
  vec3 halfDir = normalize(lightDir + viewDir);
  float ndoth = max(dot(normal, halfDir), 0.0);
  float ndotl = max(dot(normal, lightDir), 0.0);
  float ndotv = max(dot(normal, viewDir), 0.0);
  float alpha = roughness * roughness;
  float alpha2 = alpha * alpha;
  float denom = ndoth * ndoth * (alpha2 - 1.0) + 1.0;
  float d = alpha2 / (3.14159 * denom * denom);
  float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
  float vis = ndotv / (ndotv * (1.0 - k) + k) * ndotl / (ndotl * (1.0 - k) + k);
  return d * vis;
}

float causticPattern(vec2 xz, float t) {
  vec2 p = xz * (uLowQuality > 0.5 ? 3.4 : 4.6);
  float time = t * (0.34 + uAnim * 0.06);
  vec3 q1 = vec3(p + vec2(sin(time * 0.62), cos(time * 0.48)) * 0.42, time * 0.2);
  float a = abs(snoise(q1));
  float c = 1.0 - a;
  c = pow(c, 3.8);
  if (uCausticOctaves > 1) {
    vec3 q2 = vec3(p * 1.58 - vec2(cos(time * 0.51), sin(time * 0.73)) * 0.36, time * 0.26 + 1.4);
    float b = abs(snoise(q2));
    c = 1.0 - min(a, b);
    c = pow(c, 3.8);
    float ripple = abs(snoise(vec3(p * 2.8 + vec2(time * 0.18, -time * 0.14), time * 0.35)));
    c += pow(1.0 - ripple, 5.0) * (0.077 + uDetail * 0.063);
  }
  return clamp(c * (1.15 + uMids * 0.32 + uHighs * 0.18) * 0.35, 0.0, 0.56);
}

vec3 evalMoonSpotlight(vec3 hit, vec3 moonDir, vec3 spotGround) {
  if (uMoonMapReady < 0.5) return vec3(0.0);

  // Cone origin sits high above the target ground patch, aimed straight down
  // the moon direction. spotGround tracks the camera so the projection stays
  // in view during the endless forward glide.
  vec3 spotOrigin = spotGround + moonDir * 60.0;
  vec3 spotAxis = -moonDir;
  vec3 toHit = hit - spotOrigin;
  float along = dot(toHit, spotAxis);
  if (along <= 0.4) return vec3(0.0);

  vec3 L = normalize(toHit);
  float halfAngle = radians(4.9 + uBass * 0.36 + uEnergy * 0.18);
  float cosOuter = cos(halfAngle * 1.45);
  float cosInner = cos(halfAngle * 0.22);
  float cosTheta = dot(spotAxis, L);
  float cone = smoothstep(cosOuter, cosInner, cosTheta);
  if (cone < 0.001) return vec3(0.0);

  vec3 worldUp = abs(spotAxis.y) > 0.94 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 spotRight = normalize(cross(worldUp, spotAxis));
  vec3 spotUp = cross(spotAxis, spotRight);

  float invProj = 1.0 / along;
  vec2 planar = vec2(dot(toHit, spotRight), dot(toHit, spotUp)) * invProj;
  float tanHalf = tan(halfAngle);
  vec2 centered = planar / tanHalf; // -1..1 across the cone footprint

  float radial = length(centered);
  float discMask = 1.0 - smoothstep(0.47, 0.54, radial);
  if (discMask < 0.001) return vec3(0.0);

  // moon-spotlight.png is a right-side crescent (868²) — map the full lit arc
  // into the cone footprint. Soft edge fade replaces hard UV rejection that
  // clipped the top/right of the crescent.
  vec2 uv = centered * vec2(0.17, 0.23) + vec2(0.66, 0.5);
  vec2 edgeFade = smoothstep(vec2(0.0), vec2(0.035), uv)
    * smoothstep(vec2(0.0), vec2(0.035), vec2(1.0) - uv);
  float uvMask = edgeFade.x * edgeFade.y;
  if (uvMask < 0.001) return vec3(0.0);

  vec4 moonSample = texture2D(uMoonMap, uv);
  float alpha = moonSample.a;
  if (alpha < 0.05) return vec3(0.0);

  // Premultiply RGB by alpha so hidden black pixels in transparent areas
  // do not paint dark crescent/rectangle artifacts on the water.
  vec3 moonTex = moonSample.rgb * alpha;
  moonTex = pow(max(moonTex, vec3(0.0)), vec3(0.78)) * 1.35;

  float distFalloff = 1.0 / (1.0 + along * along * 0.00006);
  float intensity = 1.15 + uMids * 0.18 + uEnergy * 0.14 + uHighs * 0.1;

  return moonTex * cone * discMask * alpha * uvMask * distFalloff * intensity;
}

vec3 seabedShading(vec2 xz, float t, vec3 moonDir, vec3 moonCol) {
  vec3 sand = vec3(0.024, 0.038, 0.055);
  vec3 rock = vec3(0.014, 0.022, 0.036);
  float floorVar = fbm(vec3(xz * 0.38, t * 0.012), 2);
  vec3 floorCol = mix(sand, rock, smoothstep(-0.08, 0.22, floorVar));
  float caust = causticPattern(xz, t);
  floorCol += moonCol * caust * (0.294 + uMids * 0.154 + uEnergy * 0.084);
  float moonReach = max(dot(normalize(vec3(moonDir.x, -0.35, moonDir.z)), vec3(0.0, 1.0, 0.0)), 0.0);
  floorCol *= 0.55 + moonReach * 0.35;
  return floorCol;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
  uv.x *= uAspect;

  vec3 forward = normalize(uCamTarget - uCamPos);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);
  float tanHalfFov = tan(radians(uFov * 0.5));
  vec3 rd = normalize(forward + right * uv.x * tanHalfFov + up * uv.y * tanHalfFov);

  float steps;
  float surfaceDist;
  float t = raymarch(uCamPos, rd, steps, surfaceDist);
  vec3 hit = uCamPos + rd * t;
  // Robust hit test: accept a genuine surface crossing OR any march that
  // stopped inside the terrain band, so we never fall back to a black frame.
  bool terrainHit = (t < 55.0) && (surfaceDist < 0.08 || map(hit) < 0.05);

  // Moonlit night sea — deep navy water, dark sky, silver crest highlights.
  vec3 skyHigh = vec3(0.02, 0.028, 0.048);
  vec3 skyLow = vec3(0.035, 0.048, 0.072);
  vec3 deepWater = vec3(0.055, 0.11, 0.165);
  vec3 midWater = vec3(0.08, 0.15, 0.22);
  vec3 crestCol = vec3(0.72, 0.8, 0.9);
  vec3 moonCol = vec3(0.88, 0.92, 0.98);
  vec3 fogColor = vec3(0.03, 0.045, 0.065);

  float skyFade = smoothstep(-0.85, 0.85, rd.y);
  vec3 bg = mix(skyLow, skyHigh, skyFade);
  vec3 moonDir = normalize(vec3(0.28, 0.88, -0.35));
  // There is no sky moon geometry; this analytical disc is still faded
  // defensively when the camera is looking almost straight down.
  float skyMoonVisibility = smoothstep(-0.42, -0.12, forward.y);
  float moonDisc = pow(max(dot(rd, moonDir), 0.0), 180.0);
  bg += moonCol * moonDisc * 0.08 * skyMoonVisibility;

  vec3 color = bg;
  float alpha = 0.0;

  if (terrainHit) {
    vec3 normal = terrainNormal(hit.xz);
    vec3 lightDir = normalize(vec3(
      moonDir.x + uInteract.x * 0.08,
      moonDir.y,
      moonDir.z + uInteract.y * 0.06
    ));
    float ndotl = max(dot(normal, lightDir), 0.0);
    float shade = clamp(0.22 + ndotl * (0.62 + uMids * 0.18), 0.0, 1.0);

    float crest = smoothstep(-0.15, 0.55, hit.y + uBass * 0.1);
    vec3 water = mix(deepWater, midWater, crest);
    vec3 surfaceColor = water * shade;

    vec3 viewDir = normalize(uCamPos - hit);
    float animTime = uTime * uAnim;

    // pointer spotlight — water surface only, no sky contribution
    vec2 lightFocus = hit.xz + uInteract * vec2(2.5, 2.5);
    float spotDist = length(hit.xz - lightFocus);
    float spot = exp(-spotDist * spotDist * 0.06);
    surfaceColor += moonCol * spot * (0.06 + uEnergy * 0.08 + uMids * 0.04);

    // animated caustic ripples on the surface and through the water column
    float surfaceCaustics = causticPattern(hit.xz * 1.08 + vec2(animTime * 0.04, -animTime * 0.03), animTime);
    surfaceColor += moonCol * surfaceCaustics * (0.07 + uMids * 0.056 + uHighs * 0.035) * (0.55 + crest * 0.45);

    // moon texture projected through spotlight cone onto the water.
    // Anchor the lit patch where the view center ray meets the water plane so
    // the projection stays framed ahead during low forward glide.
    float moonGroundT = uCamPos.y / max(-forward.y, 0.01);
    vec3 moonGround = uCamPos + forward * (moonGroundT * 1.12 + 2.0);
    moonGround.y = 0.0;
    vec3 moonSpot = evalMoonSpotlight(hit, moonDir, moonGround);

    // silver moon specular on wave crests
    float spec = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 52.0 + uHighs * 16.0);
    surfaceColor += crestCol * spec * (0.18 + uHighs * 0.35) * crest;
    surfaceColor += crestCol * surfaceCaustics * spec * 0.098;

    // Fresnel: low f0 keeps center clearer, edges pick up sky reflection
    float fresnel = fresnelSchlick(viewDir, normal, 0.007);
    float grazing = pow(fresnel, 0.9);

    // seabed + caustics visible through transparent water
    vec3 seabed = seabedShading(hit.xz, animTime, moonDir, moonCol);
    float viewThrough = max(dot(normal, viewDir), 0.0);
    float depthReveal = smoothstep(0.12, 0.78, viewThrough);
    vec3 deepColumn = mix(seabed, deepWater * 0.22, 0.42);
    deepColumn += moonCol * surfaceCaustics * 0.042 * depthReveal;
    float waterOpacity = mix(0.22, 0.74, grazing);
    waterOpacity = mix(waterOpacity, waterOpacity * 0.58, depthReveal * 0.62);
    color = mix(deepColumn, surfaceColor, waterOpacity);

    vec3 refl = sampleSkyReflection(reflect(-viewDir, normal));
    color = mix(color, refl, grazing * (0.38 + uHighs * 0.1));

    float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.5) * (0.04 + uHighs * 0.06);
    color += rim * vec3(0.12, 0.14, 0.18);

    float dist = length(hit - uCamPos);
    float fog = clamp(1.0 - exp(-dist * 0.032), 0.0, 0.72);
    color = mix(color, fogColor, fog);

    // Add exactly one surface projection after fog so it remains coherent
    // instead of ghosting through several water, seabed, and post-fog layers.
    color += moonSpot * (0.92 + crest * 0.14);

    // center more transparent, edges more opaque — keep alpha above floor to avoid holes
    alpha = clamp(mix(0.34, 0.84, grazing), 0.32, 0.9);
    alpha = mix(alpha, alpha * 0.72, depthReveal * 0.52);
  }

  color = acesTone(color * (1.18 + uEnergy * 0.1));
  gl_FragColor = vec4(color, alpha);
}
`

const BLOOM_EXTRACT_SHADER = /* glsl */ `
uniform sampler2D uTexture;
uniform float uThreshold;
varying vec2 vUv;

void main() {
  vec4 c = texture2D(uTexture, vUv);
  float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  float bright = max(luma - uThreshold, 0.0) / max(1.0 - uThreshold, 0.001);
  gl_FragColor = vec4(c.rgb * bright * c.a, c.a);
}
`

const BLUR_SHADER = /* glsl */ `
uniform sampler2D uTexture;
uniform vec2 uDirection;
uniform vec2 uTexelSize;
varying vec2 vUv;

void main() {
  vec2 off = uDirection * uTexelSize;
  vec4 sum = texture2D(uTexture, vUv) * 0.227027;
  sum += texture2D(uTexture, vUv + off * 1.0) * 0.1945946;
  sum += texture2D(uTexture, vUv - off * 1.0) * 0.1945946;
  sum += texture2D(uTexture, vUv + off * 2.0) * 0.1216216;
  sum += texture2D(uTexture, vUv - off * 2.0) * 0.1216216;
  sum += texture2D(uTexture, vUv + off * 3.0) * 0.054054;
  sum += texture2D(uTexture, vUv - off * 3.0) * 0.054054;
  sum += texture2D(uTexture, vUv + off * 4.0) * 0.016216;
  sum += texture2D(uTexture, vUv - off * 4.0) * 0.016216;
  gl_FragColor = sum;
}
`

const COMPOSITE_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uTime;
uniform float uAspect;
uniform vec2 uResolution;
uniform vec2 uInteract;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 acesTone(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec4 scene = texture2D(uScene, vUv);
  vec3 bloom = texture2D(uBloom, vUv).rgb;
  vec3 color = scene.rgb + bloom * uBloomStrength * (1.0 - dot(scene.rgb, vec3(0.299, 0.587, 0.114)));

  vec2 toCenter = vUv - 0.5;
  toCenter.x *= uAspect;
  float vignette = 1.0 - dot(toCenter, toCenter) * 1.1;
  color *= clamp(vignette, 0.62, 1.0);

  float grain = (hash(vUv * uResolution + uTime * 14.0) - 0.5) * 0.014;
  color += grain;

  color = acesTone(color * 0.98);
  gl_FragColor = vec4(color, 1.0);
}
`

const POST_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function bandAverage(data: Uint8Array, start: number, end: number) {
  const from = Math.max(0, Math.floor(start))
  const to = Math.min(data.length, Math.ceil(end))
  if (to <= from) return 0
  let sum = 0
  for (let i = from; i < to; i += 1) sum += data[i]
  return sum / (to - from) / 255
}

type VisualizerOptions = {
  lowPower: boolean
  maxPixelRatio: number
  maxRaySteps: number
  bloomPasses: number
  fbmOctaves: number
  causticOctaves: number
  lowQuality: number
  renderScale: number
}

function createFullscreenQuad(material: THREE.Material) {
  const geometry = new THREE.PlaneGeometry(2, 2)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  return mesh
}

function createRenderTarget(width: number, height: number) {
  return new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
  })
}

export class MusicPlayerVisualizer implements MusicPlayerVisualizerLike {
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera | null = null
  private raymarchMaterial: THREE.ShaderMaterial | null = null
  private raymarchMesh: THREE.Mesh | null = null
  private compositeMaterial: THREE.ShaderMaterial | null = null
  private compositeMesh: THREE.Mesh | null = null
  private bloomExtractMesh: THREE.Mesh | null = null
  private blurMesh: THREE.Mesh | null = null
  private bloomExtractMaterial: THREE.ShaderMaterial | null = null
  private blurMaterial: THREE.ShaderMaterial | null = null
  private moonTexture: THREE.Texture | null = null
  private sceneTarget: THREE.WebGLRenderTarget | null = null
  private bloomTargetA: THREE.WebGLRenderTarget | null = null
  private bloomTargetB: THREE.WebGLRenderTarget | null = null
  private container: HTMLElement | null = null
  private freqData: Uint8Array | null = null
  private phase = 0
  private smoothedBass = 0
  private smoothedMids = 0
  private smoothedHighs = 0
  private smoothedTransient = 0
  private smoothedSwell = 0
  private prevInstantEnergy = 0
  private travelZ = 0
  private camPos = new THREE.Vector3(0, 1.85, 14)
  private camTarget = new THREE.Vector3(0, 0.35, 6.5)
  private tiltedCamTarget = new THREE.Vector3()
  private camForward = new THREE.Vector3()
  private camRight = new THREE.Vector3()
  private camUp = new THREE.Vector3()
  private worldUp = new THREE.Vector3(0, 1, 0)
  private targetTiltX = 0
  private targetTiltY = 0
  private smoothedTiltX = 0
  private smoothedTiltY = 0
  private pointerActive = false
  private deviceTiltX = 0
  private deviceTiltY = 0
  private deviceTiltActive = false
  private prefersReducedMotion = false
  private options: VisualizerOptions = {
    lowPower: true,
    maxPixelRatio: 1,
    maxRaySteps: 48,
    bloomPasses: 0,
    fbmOctaves: 6,
    causticOctaves: 2,
    lowQuality: 0,
    renderScale: 1,
  }
  private baseMaxPixelRatio: number
  private baseMaxRaySteps: number
  private baseBloomPasses: number
  private fullscreenMode = false
  private width = 1
  private height = 1
  private disposed = false
  private paused = false
  private savedPixelRatio: number | null = null

  constructor() {
    const profile = getDeviceProfile()
    this.prefersReducedMotion = profile.prefersReducedMotion
    this.baseMaxPixelRatio = profile.visualizerMaxPixelRatio
    this.baseMaxRaySteps = profile.visualizerMaxRaySteps
    this.baseBloomPasses = profile.visualizerBloomPasses
    this.applyPerformanceOptions()
  }

  private applyPerformanceOptions() {
    const fs = this.fullscreenMode
    const profile = getDeviceProfile()
    this.options = {
      lowPower: profile.isLowPower,
      maxPixelRatio: fs
        ? Math.min(window.devicePixelRatio || 1, profile.isMobile ? 1 : 1.25)
        : this.baseMaxPixelRatio,
      maxRaySteps: fs
        ? Math.max(28, Math.floor(this.baseMaxRaySteps * (profile.isMobile ? 0.72 : 0.62)))
        : this.baseMaxRaySteps,
      bloomPasses: fs ? 0 : this.baseBloomPasses,
      fbmOctaves: fs ? 3 : 6,
      causticOctaves: fs ? 1 : 2,
      lowQuality: fs ? 1 : 0,
      renderScale: fs ? (profile.isMobile ? 0.82 : 0.72) : 1,
    }
    if (this.raymarchMaterial) {
      this.raymarchMaterial.uniforms.uMaxSteps.value = this.options.maxRaySteps
      this.raymarchMaterial.uniforms.uFbmOctaves.value = this.options.fbmOctaves
      this.raymarchMaterial.uniforms.uCausticOctaves.value = this.options.causticOctaves
      this.raymarchMaterial.uniforms.uLowQuality.value = this.options.lowQuality
    }
    if (this.compositeMaterial) {
      this.compositeMaterial.uniforms.uBloomStrength.value = fs ? 0 : 0.18
    }
    if (this.renderer && this.container) {
      this.resize(this.width, this.height)
    }
  }

  setFullscreenMode(enabled: boolean) {
    if (this.fullscreenMode === enabled) return
    this.fullscreenMode = enabled
    this.applyPerformanceOptions()
  }

  /** @deprecated Use setFullscreenMode — kept for call-site compatibility. */
  setFullscreenBoost(enabled: boolean) {
    this.setFullscreenMode(enabled)
  }

  mount(container: HTMLElement) {
    if (this.container === container && this.renderer) return
    this.dispose()
    this.disposed = false
    this.travelZ = 0
    this.container = container

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: this.options.lowPower ? 'low-power' : 'high-performance',
    })
    renderer.setClearColor(0x040406, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.className = 'music-player-canvas'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    container.prepend(renderer.domElement)
    this.renderer = renderer

    const scene = new THREE.Scene()
    this.scene = scene

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.camera = camera

    const raymarchUniforms = {
      uTime: { value: 0 },
      uAnim: { value: 0.05 },
      uBass: { value: 0 },
      uMids: { value: 0 },
      uHighs: { value: 0 },
      uEnergy: { value: 0.18 },
      uDetail: { value: 0.2 },
      uAspect: { value: 1 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uCamPos: { value: new THREE.Vector3() },
      uCamTarget: { value: new THREE.Vector3() },
      uFov: { value: 64 },
      uMaxSteps: { value: this.options.maxRaySteps },
      uFbmOctaves: { value: this.options.fbmOctaves },
      uCausticOctaves: { value: this.options.causticOctaves },
      uLowQuality: { value: this.options.lowQuality },
      uInteract: { value: new THREE.Vector2() },
      uMoonMap: { value: null as THREE.Texture | null },
      uMoonMapReady: { value: 0 },
    }

    const raymarchMaterial = new THREE.ShaderMaterial({
      uniforms: raymarchUniforms,
      vertexShader: POST_VERTEX_SHADER,
      fragmentShader: RAYMARCH_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
    this.raymarchMaterial = raymarchMaterial
    this.raymarchMesh = createFullscreenQuad(raymarchMaterial)
    scene.add(this.raymarchMesh)

    this.moonTexture?.dispose()
    this.moonTexture = null
    raymarchUniforms.uMoonMapReady.value = 0
    const moonLoader = new THREE.TextureLoader()
    moonLoader.load(
      MOON_SPOTLIGHT_TEXTURE,
      (texture) => {
        if (this.disposed || this.raymarchMaterial !== raymarchMaterial) {
          texture.dispose()
          return
        }
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = false
        this.moonTexture = texture
        raymarchUniforms.uMoonMap.value = texture
        raymarchUniforms.uMoonMapReady.value = 1
      },
      undefined,
      () => {
        raymarchUniforms.uMoonMapReady.value = 0
      },
    )

    this.bloomExtractMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: null },
        uThreshold: { value: 0.5 },
      },
      vertexShader: POST_VERTEX_SHADER,
      fragmentShader: BLOOM_EXTRACT_SHADER,
      depthWrite: false,
      depthTest: false,
    })

    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: null },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uTexelSize: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: POST_VERTEX_SHADER,
      fragmentShader: BLUR_SHADER,
      depthWrite: false,
      depthTest: false,
    })

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uScene: { value: null },
        uBloom: { value: null },
        uBloomStrength: { value: 0.18 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uInteract: { value: new THREE.Vector2() },
      },
      vertexShader: POST_VERTEX_SHADER,
      fragmentShader: COMPOSITE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
    this.compositeMesh = createFullscreenQuad(this.compositeMaterial)
    scene.add(this.compositeMesh)

    this.bloomExtractMesh = createFullscreenQuad(this.bloomExtractMaterial)
    this.blurMesh = createFullscreenQuad(this.blurMaterial)
    scene.add(this.bloomExtractMesh)
    scene.add(this.blurMesh)
    this.bloomExtractMesh.visible = false
    this.blurMesh.visible = false
    this.compositeMesh.visible = false

    this.resize(container.clientWidth, container.clientHeight)
  }

  private ensureTargets() {
    if (!this.renderer) return
    const scale = this.options.renderScale
    const w = Math.max(1, Math.floor(this.width * this.renderer.getPixelRatio() * scale))
    const h = Math.max(1, Math.floor(this.height * this.renderer.getPixelRatio() * scale))

    const needsResize =
      !this.sceneTarget ||
      this.sceneTarget.width !== w ||
      this.sceneTarget.height !== h

    if (!needsResize) return

    this.sceneTarget?.dispose()
    this.bloomTargetA?.dispose()
    this.bloomTargetB?.dispose()

    this.sceneTarget = createRenderTarget(w, h)
    this.bloomTargetA = createRenderTarget(w, h)
    this.bloomTargetB = createRenderTarget(w, h)
  }

  setPointer(normalizedX: number, normalizedY: number) {
    if (this.prefersReducedMotion) return
    this.targetTiltX = clamp(normalizedX, -1, 1)
    this.targetTiltY = clamp(normalizedY, -1, 1)
    this.pointerActive = true
  }

  resetPointer() {
    this.pointerActive = false
    this.targetTiltX = 0
    this.targetTiltY = 0
  }

  setDeviceOrientation(beta: number | null, gamma: number | null) {
    if (this.prefersReducedMotion || beta == null || gamma == null) {
      this.deviceTiltActive = false
      return
    }
    const pitchRange = 38
    const rollRange = 42
    this.deviceTiltY = clamp((beta - 45) / pitchRange, -1, 1)
    this.deviceTiltX = clamp(gamma / rollRange, -1, 1)
    this.deviceTiltActive = true
  }

  clearDeviceOrientation() {
    this.deviceTiltActive = false
    this.deviceTiltX = 0
    this.deviceTiltY = 0
  }

  private applyCameraTilt() {
    const maxYaw = 0.19
    const maxPitch = 0.14
    const tiltYaw = this.smoothedTiltX * maxYaw
    const tiltPitch = this.smoothedTiltY * maxPitch

    this.camForward.subVectors(this.camTarget, this.camPos).normalize()
    this.camRight.crossVectors(this.worldUp, this.camForward).normalize()
    this.camUp.crossVectors(this.camForward, this.camRight)

    this.tiltedCamTarget
      .copy(this.camTarget)
      .sub(this.camPos)
      .applyAxisAngle(this.camRight, tiltPitch)
      .applyAxisAngle(this.camUp, tiltYaw)
      .add(this.camPos)
  }

  resize(width: number, height: number) {
    if (!this.renderer || !this.raymarchMaterial || !this.compositeMaterial) return
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)

    const aspect = this.width / this.height
    const dpr = Math.min(window.devicePixelRatio || 1, this.options.maxPixelRatio)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(this.width, this.height, false)

    const renderW = this.width * dpr
    const renderH = this.height * dpr
    this.raymarchMaterial.uniforms.uAspect.value = aspect
    this.raymarchMaterial.uniforms.uResolution.value.set(renderW, renderH)
    this.compositeMaterial.uniforms.uAspect.value = aspect
    this.compositeMaterial.uniforms.uResolution.value.set(
      this.width * dpr,
      this.height * dpr,
    )

    this.ensureTargets()
  }

  private ensureBuffers(analyser: AnalyserNode | null) {
    if (!analyser) {
      this.freqData = null
      return
    }
    if (!this.freqData || this.freqData.length !== analyser.frequencyBinCount) {
      this.freqData = new Uint8Array(analyser.frequencyBinCount)
    }
  }

  private renderBloom(source: THREE.WebGLRenderTarget) {
    if (this.options.bloomPasses <= 0) return null

    if (
      !this.renderer ||
      !this.scene ||
      !this.camera ||
      !this.bloomExtractMaterial ||
      !this.blurMaterial ||
      !this.bloomExtractMesh ||
      !this.blurMesh ||
      !this.bloomTargetA ||
      !this.bloomTargetB
    ) {
      return this.bloomTargetA
    }

    this.raymarchMesh!.visible = false
    this.compositeMesh!.visible = false
    this.bloomExtractMesh.visible = true
    this.blurMesh.visible = false

    this.bloomExtractMaterial.uniforms.uTexture.value = source.texture
    this.renderer.setRenderTarget(this.bloomTargetA)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    let read = this.bloomTargetA
    let write = this.bloomTargetB
    const texel = this.blurMaterial.uniforms.uTexelSize.value as THREE.Vector2

    this.bloomExtractMesh.visible = false
    this.blurMesh.visible = true

    for (let pass = 0; pass < this.options.bloomPasses; pass += 1) {
      const scale = Math.pow(2, pass)
      texel.set(scale / read.width, scale / read.height)

      this.blurMaterial.uniforms.uTexture.value = read.texture
      ;(this.blurMaterial.uniforms.uDirection.value as THREE.Vector2).set(1, 0)
      this.renderer.setRenderTarget(write)
      this.renderer.render(this.scene, this.camera)

      this.blurMaterial.uniforms.uTexture.value = write.texture
      ;(this.blurMaterial.uniforms.uDirection.value as THREE.Vector2).set(0, 1)
      this.renderer.setRenderTarget(read)
      this.renderer.render(this.scene, this.camera)
    }

    this.blurMesh.visible = false
    return read
  }

  pause() {
    if (this.paused || this.disposed) return
    this.paused = true
    if (this.renderer) {
      this.savedPixelRatio = this.renderer.getPixelRatio()
      this.renderer.setPixelRatio(1)
    }
  }

  resume() {
    if (!this.paused || this.disposed) return
    this.paused = false
    if (this.renderer && this.savedPixelRatio != null) {
      this.renderer.setPixelRatio(this.savedPixelRatio)
      this.savedPixelRatio = null
    }
  }

  isPaused() {
    return this.paused
  }

  update(
    delta: number,
    time: number,
    isPlaying: boolean,
    analyser: AnalyserNode | null,
  ) {
    if (
      !this.renderer ||
      !this.scene ||
      !this.camera ||
      !this.raymarchMaterial ||
      !this.compositeMaterial ||
      !this.compositeMesh ||
      !this.raymarchMesh ||
      this.disposed ||
      this.paused
    ) {
      return
    }

    this.ensureBuffers(analyser)
    this.ensureTargets()

    const targetPhase = isPlaying ? 1 : 0
    const phaseRate = isPlaying ? 7.5 : 9
    this.phase = clamp(this.phase + (targetPhase - this.phase) * delta * phaseRate, 0, 1)

    const idleBreath = 0.14 + Math.sin(time * 0.35) * 0.05
    const liveEnergy =
      0.28 + this.phase * 0.55 + this.smoothedBass * 0.22 + this.smoothedTransient * 0.12
    const energy = isPlaying ? liveEnergy : Math.max(0.16, idleBreath)
    const anim = isPlaying ? 0.06 + this.phase * 0.72 : 0.05 + idleBreath * 0.12

    let bass = 0
    let mids = 0
    let highs = 0
    let transient = 0

    if (analyser && this.freqData && isPlaying) {
      analyser.getByteFrequencyData(this.freqData)
      const len = this.freqData.length
      const rawBass = bandAverage(this.freqData, 0, len * 0.1)
      const rawMids = bandAverage(this.freqData, len * 0.08, len * 0.48)
      const rawHighs = bandAverage(this.freqData, len * 0.42, len)

      bass = Math.pow(rawBass, 0.82) * 1.6
      mids = Math.pow(rawMids, 0.85) * 1.3
      highs = Math.pow(rawHighs, 0.88) * 1.5

      const instant = rawBass * 1.35 + rawMids * 0.55 + rawHighs * 0.95
      transient = Math.max(0, instant - this.prevInstantEnergy)
      this.prevInstantEnergy = lerp(this.prevInstantEnergy, instant, delta * 14)
    } else {
      bass = idleBreath * 0.22 + Math.sin(time * 0.9) * 0.04
      mids = idleBreath * 0.18 + Math.sin(time * 1.3 + 1.1) * 0.03
      highs = idleBreath * 0.14 + Math.sin(time * 1.8 + 2.2) * 0.025
      transient = 0
      this.prevInstantEnergy = lerp(this.prevInstantEnergy, 0, delta * 8)
    }

    const smooth = isPlaying ? 20 : 12
    this.smoothedBass = lerp(this.smoothedBass, bass, delta * smooth)
    this.smoothedMids = lerp(this.smoothedMids, mids, delta * smooth)
    this.smoothedHighs = lerp(this.smoothedHighs, highs, delta * smooth)
    this.smoothedTransient = lerp(this.smoothedTransient, transient, delta * (isPlaying ? 24 : 10))
    const swellRate = isPlaying ? 2.2 : 1.6
    this.smoothedSwell = lerp(
      this.smoothedSwell,
      this.smoothedBass * 0.7 + this.smoothedMids * 0.3,
      delta * swellRate,
    )

    const uniforms = this.raymarchMaterial.uniforms
    uniforms.uTime.value = time
    uniforms.uAnim.value = anim
    uniforms.uBass.value = this.smoothedBass
    uniforms.uMids.value = this.smoothedMids
    uniforms.uHighs.value = this.smoothedHighs
    uniforms.uEnergy.value = energy
    uniforms.uDetail.value =
      0.06 + this.phase * 0.04 + this.smoothedMids * 0.28 + this.smoothedHighs * 0.18

    const baseCamY = 1.85
    const baseCamZ = 14
    const baseTargetY = 0.35
    const baseTargetZ = 6.5
    const bobScale = isPlaying ? 0.55 + this.smoothedSwell * 0.22 : 0.35
    const t = time

    // Low forward glide over the sea — skimming the wave tops.
    const forwardSpeed = isPlaying ? 0.52 : 0.34
    this.travelZ -= delta * forwardSpeed

    const heave =
      (Math.sin(t * 0.24) * 0.032 + Math.sin(t * 0.37 + 1.3) * 0.011) * bobScale
    const wavePitch =
      (Math.sin(t * 0.24 + 0.3) * 0.024 + Math.sin(t * 0.41 + 1.7) * 0.009) * bobScale
    const pitch = Math.sin(t * 0.18 + 0.6) * 0.014 * bobScale + wavePitch
    const roll = Math.sin(t * 0.14 + 2.0) * 0.016 * bobScale
    const swayX = Math.sin(t * 0.08 + 0.4) * 0.022 * bobScale
    const swayZ = Math.sin(t * 0.06 + 1.1) * 0.014 * bobScale

    const z = baseCamZ + this.travelZ
    this.camPos.set(swayX, baseCamY + heave, z + swayZ)
    this.camTarget.set(
      roll * 0.6,
      baseTargetY + pitch * 1.8,
      baseTargetZ + this.travelZ + roll * 0.1 + wavePitch * 2.4,
    )

    const interactTargetX = this.pointerActive
      ? this.targetTiltX
      : this.deviceTiltActive
        ? this.deviceTiltX
        : 0
    const interactTargetY = this.pointerActive
      ? this.targetTiltY
      : this.deviceTiltActive
        ? this.deviceTiltY
        : 0
    const tiltLerp = this.pointerActive || this.deviceTiltActive ? 9 : 5
    this.smoothedTiltX = lerp(this.smoothedTiltX, interactTargetX, delta * tiltLerp)
    this.smoothedTiltY = lerp(this.smoothedTiltY, interactTargetY, delta * tiltLerp)

    this.applyCameraTilt()

    uniforms.uCamPos.value.copy(this.camPos)
    uniforms.uCamTarget.value.copy(this.tiltedCamTarget)
    ;(uniforms.uInteract.value as THREE.Vector2).set(this.smoothedTiltX, this.smoothedTiltY)

    if (!this.sceneTarget) return

    this.raymarchMesh.visible = true
    this.compositeMesh.visible = false
    this.renderer.setRenderTarget(this.sceneTarget)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    const bloomTarget = this.renderBloom(this.sceneTarget)

    this.raymarchMesh.visible = false
    this.compositeMesh.visible = true
    this.compositeMaterial.uniforms.uScene.value = this.sceneTarget.texture
    this.compositeMaterial.uniforms.uBloom.value =
      bloomTarget?.texture ?? this.sceneTarget.texture
    this.compositeMaterial.uniforms.uBloomStrength.value = bloomTarget
      ? this.fullscreenMode
        ? 0
        : isPlaying
          ? 0.1 + energy * 0.08 + this.smoothedHighs * 0.05 + this.smoothedTransient * 0.06
          : 0.02 + idleBreath * 0.015
      : 0
    this.compositeMaterial.uniforms.uTime.value = time
    ;(this.compositeMaterial.uniforms.uInteract.value as THREE.Vector2).set(
      this.smoothedTiltX,
      this.smoothedTiltY,
    )

    this.renderer.setRenderTarget(null)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
  }

  getBandLevels() {
    return {
      bass: this.smoothedBass,
      mids: this.smoothedMids,
      highs: this.smoothedHighs,
      phase: this.phase,
    }
  }

  dispose() {
    this.disposed = true
    this.paused = false
    this.savedPixelRatio = null
    if (this.raymarchMesh) {
      this.raymarchMesh.geometry.dispose()
      this.raymarchMesh = null
    }
    if (this.compositeMesh) {
      this.compositeMesh.geometry.dispose()
      this.compositeMesh = null
    }
    if (this.bloomExtractMesh) {
      this.bloomExtractMesh.geometry.dispose()
      this.bloomExtractMesh = null
    }
    if (this.blurMesh) {
      this.blurMesh.geometry.dispose()
      this.blurMesh = null
    }
    if (this.raymarchMaterial) {
      this.raymarchMaterial.dispose()
      this.raymarchMaterial = null
    }
    if (this.compositeMaterial) {
      this.compositeMaterial.dispose()
      this.compositeMaterial = null
    }
    if (this.bloomExtractMaterial) {
      this.bloomExtractMaterial.dispose()
      this.bloomExtractMaterial = null
    }
    if (this.blurMaterial) {
      this.blurMaterial.dispose()
      this.blurMaterial = null
    }
    if (this.moonTexture) {
      this.moonTexture.dispose()
      this.moonTexture = null
    }
    this.sceneTarget?.dispose()
    this.bloomTargetA?.dispose()
    this.bloomTargetB?.dispose()
    this.sceneTarget = null
    this.bloomTargetA = null
    this.bloomTargetB = null
    if (this.renderer) {
      this.renderer.dispose()
      if (this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
      }
      this.renderer = null
    }
    this.scene = null
    this.camera = null
    this.container = null
    this.freqData = null
  }
}
