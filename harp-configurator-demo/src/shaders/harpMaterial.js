import { Color } from 'three'
import { PRODUCT } from '../config/productConfig.js'
import { HARDWARE_FINISHES, WOOD_FINISHES } from '../config/materials.js'

const WOOD_VERT = /* glsl */ `
#include <common>
varying vec3 vHarpWorld;
varying vec3 vHarpNormal;
attribute float harpPart;
varying float vHarpPart;
`

const WOOD_VERT_END = /* glsl */ `
vHarpWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vHarpNormal = normalize(mat3(modelMatrix) * objectNormal);
vHarpPart = harpPart;
`

const WOOD_FRAG = /* glsl */ `
uniform sampler2D uWoodRoughMap;
uniform sampler2D uWoodNormalMap;
uniform vec3 uWoodTint;
uniform float uWoodGain;
uniform float uWoodContrast;
uniform float uWoodHue;
uniform float uWoodSat;
uniform float uWoodRough;
uniform float uWoodStain;
uniform float uWoodScale;
uniform vec3 uMetalColor;
uniform float uMetalRough;
uniform float uMetalMetal;
uniform float uSheenSweep;
varying vec3 vHarpWorld;
varying vec3 vHarpNormal;
varying float vHarpPart;

vec3 harpTriBlend(vec3 n) {
  vec3 b = pow(abs(n), vec3(4.0));
  return b / (b.x + b.y + b.z + 1.0e-5);
}

// Source grain runs along U. Map U to world Y so fibers follow the column.
vec2 harpWoodUvX(vec3 p) { return vec2(p.y, p.z); }
vec2 harpWoodUvY(vec3 p) { return vec2(p.x, p.z); }
vec2 harpWoodUvZ(vec3 p) { return vec2(p.y, p.x); }
`

const WOOD_SAMPLE_FNS = /* glsl */ `
#ifdef USE_MAP
vec4 harpTriplanarAlbedo(vec3 pos, vec3 n, float scale) {
  vec3 b = harpTriBlend(n);
  vec3 p = pos * scale;
  return texture2D(map, harpWoodUvX(p)) * b.x
    + texture2D(map, harpWoodUvY(p)) * b.y
    + texture2D(map, harpWoodUvZ(p)) * b.z;
}

float harpTriplanarRoughness(vec3 pos, vec3 n, float scale) {
  vec3 b = harpTriBlend(n);
  vec3 p = pos * scale;
  return texture2D(uWoodRoughMap, harpWoodUvX(p)).r * b.x
    + texture2D(uWoodRoughMap, harpWoodUvY(p)).r * b.y
    + texture2D(uWoodRoughMap, harpWoodUvZ(p)).r * b.z;
}

vec3 harpTriplanarWoodNormal(vec3 pos, vec3 surfaceNormal, float scale) {
  vec3 b = harpTriBlend(surfaceNormal);
  vec3 p = pos * scale;
  vec3 xSample = texture2D(uWoodNormalMap, harpWoodUvX(p)).xyz * 2.0 - 1.0;
  vec3 ySample = texture2D(uWoodNormalMap, harpWoodUvY(p)).xyz * 2.0 - 1.0;
  vec3 zSample = texture2D(uWoodNormalMap, harpWoodUvZ(p)).xyz * 2.0 - 1.0;
  xSample.xy *= 0.34;
  ySample.xy *= 0.34;
  zSample.xy *= 0.34;
  float sx = surfaceNormal.x < 0.0 ? -1.0 : 1.0;
  float sy = surfaceNormal.y < 0.0 ? -1.0 : 1.0;
  float sz = surfaceNormal.z < 0.0 ? -1.0 : 1.0;
  vec3 xNormal = normalize(vec3(xSample.z * sx, xSample.x, xSample.y));
  vec3 yNormal = normalize(vec3(ySample.x, ySample.z * sy, ySample.y));
  vec3 zNormal = normalize(vec3(zSample.y, zSample.x, zSample.z * sz));
  return normalize(xNormal * b.x + yNormal * b.y + zNormal * b.z);
}
#endif
`

const WOOD_MAP = /* glsl */ `
#ifdef USE_MAP
  float woodPartUse = 1.0 - smoothstep(0.25, 0.75, abs(vHarpPart));
  float metalPartUse = 1.0 - smoothstep(0.25, 0.75, abs(vHarpPart - 1.0));
  float stringUse = 1.0 - smoothstep(0.25, 0.75, abs(vHarpPart - 2.0));
  float legacyCrestUse = 1.0 - smoothstep(0.25, 0.75, abs(vHarpPart - 3.0));
  if (legacyCrestUse > 0.5) discard;
  float woodFill = woodPartUse;
  float metalUse = metalPartUse;

#ifdef USE_EMISSIVEMAP
  vec3 originalColor = texture2D(emissiveMap, vMapUv).rgb;
#else
  vec3 originalColor = diffuseColor.rgb;
#endif

  float luma = dot(originalColor, vec3(0.299, 0.587, 0.114));

  vec3 woodSample = harpTriplanarAlbedo(vHarpWorld, vHarpNormal, uWoodScale).rgb;
  float woodRoughSample = harpTriplanarRoughness(vHarpWorld, vHarpNormal, uWoodScale);
  float woodLuma = dot(woodSample, vec3(0.299, 0.587, 0.114));
  vec3 woodGrain = woodSample / max(vec3(woodLuma), vec3(0.04));
  vec3 graded = woodSample * uWoodGain;
  graded = mix(vec3(dot(graded, vec3(0.333))), graded, uWoodSat);
  graded = (graded - 0.5) * uWoodContrast + 0.5;
  vec3 stained = uWoodTint * (0.2 + woodLuma * 1.45) * mix(vec3(1.0), woodGrain, 0.86);
  vec3 woodColor = mix(graded, stained, uWoodStain);

  // Floor the metal albedo: where the source is near-black, a polished metal
  // reflects only the dark side of the environment and reads as a black patch.
  vec3 metalColor = mix(originalColor, uMetalColor * (0.58 + luma * 0.62), 0.94);

  vec3 configured = mix(originalColor, woodColor, woodFill);
  configured = mix(configured, metalColor, metalUse);
  diffuseColor.rgb = mix(configured, originalColor, stringUse);
#endif
`

const WOOD_NORMAL = /* glsl */ `
#ifdef USE_MAP
  vec3 harpMappedWorldNormal = harpTriplanarWoodNormal(vHarpWorld, normalize(vHarpNormal), uWoodScale);
  vec3 harpMappedViewNormal = normalize((viewMatrix * vec4(harpMappedWorldNormal, 0.0)).xyz);
  normal = normalize(mix(normal, harpMappedViewNormal, woodFill));
#endif
`

const WOOD_ROUGH = /* glsl */ `
#ifdef USE_MAP
  float mappedWoodRough = clamp(mix(uWoodRough, woodRoughSample, 0.58), 0.2, 0.78);
  roughnessFactor = mix(roughnessFactor, mappedWoodRough, woodFill);
  roughnessFactor = mix(roughnessFactor, uMetalRough, metalUse);
  roughnessFactor = mix(roughnessFactor, 0.3, stringUse);
#endif
`

const WOOD_METAL = /* glsl */ `
#ifdef USE_MAP
  metalnessFactor = mix(metalnessFactor, 0.02, woodFill);
  metalnessFactor = mix(metalnessFactor, uMetalMetal, metalUse);
  metalnessFactor = mix(metalnessFactor, 0.58, stringUse);
#endif
`

const WOOD_LIGHT = /* glsl */ `
#ifdef USE_MAP
  float sweep = 1.0 - abs(vHarpWorld.x * 1.8 + vHarpWorld.y * 0.6 - (uSheenSweep * 1.6 - 0.4));
  sweep = smoothstep(0.72, 1.0, sweep) * woodFill;
  outgoingLight += vec3(0.16, 0.13, 0.09) * sweep * step(0.0, uSheenSweep);
#endif
`

export function createHarpUniforms() {
  return {
    uWoodRoughMap: { value: null },
    uWoodNormalMap: { value: null },
    uWoodTint: { value: new Color(WOOD_FINISHES.natural.tint) },
    uWoodGain: { value: WOOD_FINISHES.natural.gain },
    uWoodContrast: { value: WOOD_FINISHES.natural.contrast },
    uWoodHue: { value: WOOD_FINISHES.natural.hue },
    uWoodSat: { value: WOOD_FINISHES.natural.sat },
    uWoodRough: { value: WOOD_FINISHES.natural.roughness },
    uWoodStain: { value: WOOD_FINISHES.natural.stain },
    uWoodScale: { value: PRODUCT.wood.scale ?? 2.25 },
    uMetalColor: { value: new Color(HARDWARE_FINISHES.bright.color) },
    uMetalRough: { value: HARDWARE_FINISHES.bright.roughness },
    uMetalMetal: { value: HARDWARE_FINISHES.bright.metalness },
    uSheenSweep: { value: -1 },
  }
}

export function applyHarpShader(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', WOOD_VERT)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${WOOD_VERT_END}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WOOD_FRAG}`)
      .replace(
        '#include <clipping_planes_pars_fragment>',
        `#include <clipping_planes_pars_fragment>\n${WOOD_SAMPLE_FNS}`,
      )
      .replace('#include <map_fragment>', `#include <map_fragment>\n${WOOD_MAP}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${WOOD_NORMAL}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${WOOD_ROUGH}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${WOOD_METAL}`)
      .replace('#include <opaque_fragment>', `${WOOD_LIGHT}\n#include <opaque_fragment>`)
  }
  material.customProgramCacheKey = () => 'harp-configurator-material-v21-hide-legacy-crest'
  material.needsUpdate = true
  return material
}

const _woodTint = new Color()
const _metalColor = new Color()

export function lerpUniforms(uniforms, wood, hardware, alpha = 1) {
  uniforms.uWoodTint.value.lerp(_woodTint.set(wood.tint), alpha)
  uniforms.uWoodGain.value += (wood.gain - uniforms.uWoodGain.value) * alpha
  uniforms.uWoodContrast.value += (wood.contrast - uniforms.uWoodContrast.value) * alpha
  uniforms.uWoodHue.value += (wood.hue - uniforms.uWoodHue.value) * alpha
  uniforms.uWoodSat.value += ((wood.sat ?? 1) - uniforms.uWoodSat.value) * alpha
  uniforms.uWoodRough.value += (wood.roughness - uniforms.uWoodRough.value) * alpha
  uniforms.uWoodStain.value += ((wood.stain ?? 0.2) - uniforms.uWoodStain.value) * alpha
  uniforms.uMetalColor.value.lerp(_metalColor.set(hardware.color), alpha)
  uniforms.uMetalRough.value += (hardware.roughness - uniforms.uMetalRough.value) * alpha
  uniforms.uMetalMetal.value += (hardware.metalness - uniforms.uMetalMetal.value) * alpha
}
