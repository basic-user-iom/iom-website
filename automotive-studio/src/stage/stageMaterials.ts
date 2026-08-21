import {
  Color,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
} from 'three'
import type { StageSurface } from '../persistence/schema'
import { idbGetAssetBlob } from '../persistence/localDb'

const textureLoader = new TextureLoader()
/** Immutable GPU sources keyed by asset ID — never mutate transform/colorSpace here. */
const textureCache = new Map<string, Texture>()
const inflightLoads = new Map<string, Promise<Texture | null>>()
const objectUrls = new Map<string, string>()
let stageAnisotropy = 1

/**
 * Renderer-dependent, so `createRenderer` reports it once. Without it, heavily
 * tiled floors turn to noise at grazing angles.
 */
export function setStageTextureAnisotropy(value: number) {
  const next = Math.max(1, Math.floor(value) || 1)
  if (next === stageAnisotropy) return
  stageAnisotropy = next
  for (const tex of textureCache.values()) {
    tex.anisotropy = stageAnisotropy
    tex.needsUpdate = true
  }
}

async function loadStageTextureSource(assetId: string): Promise<Texture | null> {
  const cached = textureCache.get(assetId)
  if (cached) return cached
  const pending = inflightLoads.get(assetId)
  if (pending) return pending

  const promise = (async (): Promise<Texture | null> => {
    try {
      const blob = await idbGetAssetBlob(assetId)
      if (!blob) return null
      // Replace any stale object URL for this id before creating a new one.
      const prevUrl = objectUrls.get(assetId)
      if (prevUrl) URL.revokeObjectURL(prevUrl)
      const url = URL.createObjectURL(blob)
      objectUrls.set(assetId, url)
      const texture = await new Promise<Texture>((resolve, reject) => {
        textureLoader.load(url, resolve, undefined, reject)
      })
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.generateMipmaps = true
      texture.minFilter = LinearMipmapLinearFilter
      texture.anisotropy = stageAnisotropy
      textureCache.set(assetId, texture)
      return texture
    } finally {
      inflightLoads.delete(assetId)
    }
  })()
  inflightLoads.set(assetId, promise)
  return promise
}

/**
 * Binding-owned texture clone. Transform / colorSpace mutations stay local so
 * the same asset can be used on multiple stage surfaces with different settings.
 */
export async function loadStageTexture(assetId: string | null | undefined): Promise<Texture | null> {
  if (!assetId) return null
  const source = await loadStageTextureSource(assetId)
  if (!source) return null
  const clone = source.clone()
  clone.wrapS = RepeatWrapping
  clone.wrapT = RepeatWrapping
  clone.generateMipmaps = source.generateMipmaps
  clone.minFilter = source.minFilter
  clone.anisotropy = stageAnisotropy
  return clone
}

export function disposeStageTextureCache() {
  for (const tex of textureCache.values()) tex.dispose()
  textureCache.clear()
  inflightLoads.clear()
  for (const url of objectUrls.values()) URL.revokeObjectURL(url)
  objectUrls.clear()
}

type TileVariationUniforms = {
  uTileVariation: { value: number }
  uTileSeed: { value: number }
}

const tileVariationUniforms = new WeakMap<MeshStandardMaterial, TileVariationUniforms>()

/**
 * De-tiling without relying on textureLod / mipmaps (many uploaded maps are non-POT and
 * have no mips, which made the old coarse/average ratio a no-op).
 *
 * Primary sample is replaced (not just post-multiplied) by a blend of two differently
 * rotated lookups, weighted by a low-frequency cell hash — that is what kills the grid
 * on grayscale roughness / AO maps where a blotch multiply still left seams obvious.
 */
const DETILE_HELPERS = /* glsl */ `
uniform float uTileVariation;
uniform float uTileSeed;
vec2 iomDetileUv( vec2 uv, float scale, float seedMul ) {
  float s = sin( uTileSeed * seedMul );
  float c = cos( uTileSeed * seedMul );
  return mat2( c, -s, s, c ) * uv * scale
    + vec2( fract( uTileSeed * 0.37 * seedMul ), fract( uTileSeed * 0.61 * seedMul ) );
}
float iomDetileCell( vec2 uv, float seedMul ) {
  float cell = floor( uv.x * 0.41 ) + floor( uv.y * 0.41 ) * 19.0;
  return fract( sin( ( cell + uTileSeed * seedMul ) * 12.9898 ) * 43758.5453 );
}
float iomDetileSampleG( sampler2D tex, vec2 uv, float seedMul ) {
  float w = smoothstep( 0.18, 0.82, iomDetileCell( uv, seedMul ) );
  float a = texture2D( tex, iomDetileUv( uv, 1.0, seedMul ) ).g;
  float b = texture2D( tex, iomDetileUv( uv, 0.91, seedMul + 1.17 ) ).g;
  return mix( a, b, w );
}
vec3 iomDetileSampleRgb( sampler2D tex, vec2 uv, float seedMul ) {
  float w = smoothstep( 0.18, 0.82, iomDetileCell( uv, seedMul ) );
  vec3 a = texture2D( tex, iomDetileUv( uv, 1.0, seedMul ) ).rgb;
  vec3 b = texture2D( tex, iomDetileUv( uv, 0.91, seedMul + 1.17 ) ).rgb;
  return mix( a, b, w );
}
`

const MAP_FRAGMENT_DETILE = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  if ( uTileVariation > 0.001 ) {
    sampledDiffuseColor.rgb = mix(
      sampledDiffuseColor.rgb,
      iomDetileSampleRgb( map, vMapUv, 1.0 ),
      uTileVariation
    );
  }
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif
`

const NORMAL_FRAGMENT_DETILE = /* glsl */ `
#if defined( USE_NORMALMAP_TANGENTSPACE )
  if ( uTileVariation > 0.001 ) {
    float nW = smoothstep( 0.18, 0.82, iomDetileCell( vNormalMapUv, 1.17 ) ) * uTileVariation;
    vec2 nUv = iomDetileUv( vNormalMapUv, 0.97, 1.17 );
    vec3 mapN2 = texture2D( normalMap, nUv ).xyz * 2.0 - 1.0;
    mapN2.xy *= normalScale;
    vec3 nAlt = normalize( tbn * mapN2 );
    normal = normalize( mix( normal, nAlt, nW * 0.9 ) );
  }
#endif
`

const ROUGHNESS_FRAGMENT_DETILE = /* glsl */ `
float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  float roughnessTexel = texture2D( roughnessMap, vRoughnessMapUv ).g;
  if ( uTileVariation > 0.001 ) {
    roughnessTexel = mix(
      roughnessTexel,
      iomDetileSampleG( roughnessMap, vRoughnessMapUv, 1.31 ),
      uTileVariation
    );
  }
  roughnessFactor *= roughnessTexel;
#endif
`

const METALNESS_FRAGMENT_DETILE = /* glsl */ `
float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
  float metalnessTexel = texture2D( metalnessMap, vMetalnessMapUv ).b;
  if ( uTileVariation > 0.001 ) {
    // ORM packs metalness in B; sampleG uses .g — use rgb.b via a dedicated blend.
    float w = smoothstep( 0.18, 0.82, iomDetileCell( vMetalnessMapUv, 1.47 ) );
    float a = texture2D( metalnessMap, iomDetileUv( vMetalnessMapUv, 1.0, 1.47 ) ).b;
    float b = texture2D( metalnessMap, iomDetileUv( vMetalnessMapUv, 0.91, 2.64 ) ).b;
    metalnessTexel = mix( metalnessTexel, mix( a, b, w ), uTileVariation );
  }
  metalnessFactor *= metalnessTexel;
#endif
`

const AO_FRAGMENT_DETILE = /* glsl */ `
#ifdef USE_AOMAP
  float ambientOcclusionTexel = texture2D( aoMap, vAoMapUv ).r;
  if ( uTileVariation > 0.001 ) {
    float w = smoothstep( 0.18, 0.82, iomDetileCell( vAoMapUv, 1.63 ) );
    float a = texture2D( aoMap, iomDetileUv( vAoMapUv, 1.0, 1.63 ) ).r;
    float b = texture2D( aoMap, iomDetileUv( vAoMapUv, 0.91, 2.8 ) ).r;
    ambientOcclusionTexel = mix( ambientOcclusionTexel, mix( a, b, w ), uTileVariation );
  }
  float ambientOcclusion = ( ambientOcclusionTexel - 1.0 ) * aoMapIntensity + 1.0;
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  #if defined( USE_CLEARCOAT )
    clearcoatSpecularIndirect *= ambientOcclusion;
  #endif
  #if defined( USE_SHEEN )
    sheenSpecularIndirect *= ambientOcclusion;
  #endif
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
  #endif
#endif
`

const EMISSIVE_FRAGMENT_DETILE = /* glsl */ `
#ifdef USE_EMISSIVEMAP
  vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
  if ( uTileVariation > 0.001 ) {
    emissiveColor.rgb = mix(
      emissiveColor.rgb,
      iomDetileSampleRgb( emissiveMap, vEmissiveMapUv, 1.79 ),
      uTileVariation
    );
  }
  #ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
    emissiveColor = sRGBTransferEOTF( emissiveColor );
  #endif
  totalEmissiveRadiance *= emissiveColor.rgb;
#endif
`

function applyTileVariation(mat: MeshStandardMaterial, strength: number, seed: number) {
  let uniforms = tileVariationUniforms.get(mat)
  if (!uniforms) {
    uniforms = { uTileVariation: { value: 0 }, uTileSeed: { value: 0 } }
    tileVariationUniforms.set(mat, uniforms)
  }
  const owned = uniforms
  // Rebind every apply so shader version bumps (and HMR) replace stale hooks.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTileVariation = owned.uTileVariation
    shader.uniforms.uTileSeed = owned.uTileSeed
    shader.fragmentShader =
      DETILE_HELPERS +
      shader.fragmentShader
        .replace('#include <map_fragment>', MAP_FRAGMENT_DETILE)
        .replace(
          '#include <normal_fragment_maps>',
          '#include <normal_fragment_maps>\n' + NORMAL_FRAGMENT_DETILE,
        )
        .replace('#include <roughnessmap_fragment>', ROUGHNESS_FRAGMENT_DETILE)
        .replace('#include <metalnessmap_fragment>', METALNESS_FRAGMENT_DETILE)
        .replace('#include <aomap_fragment>', AO_FRAGMENT_DETILE)
        .replace('#include <emissivemap_fragment>', EMISSIVE_FRAGMENT_DETILE)
  }
  mat.customProgramCacheKey = () => 'iom-stage-detile-v4-blend'
  uniforms.uTileVariation.value = Math.max(0, Math.min(1, strength || 0))
  uniforms.uTileSeed.value = Number.isFinite(seed) ? seed : 1
}

function parseColor(hex: string, fallback: number): Color {
  const c = new Color()
  try {
    c.set(hex || fallback)
  } catch {
    c.setHex(fallback)
  }
  return c
}

/**
 * Apply serializable stage surface settings + optional IDB-backed maps onto a mesh.
 */
export async function applyStageSurfaceMaterial(
  mesh: Mesh,
  surface: StageSurface,
  opts?: { polygonOffset?: boolean },
): Promise<void> {
  const mat =
    mesh.material instanceof MeshStandardMaterial
      ? mesh.material
      : new MeshStandardMaterial()
  if (mesh.material !== mat) {
    const prev = mesh.material
    mesh.material = mat
    if (Array.isArray(prev)) prev.forEach((m) => m.dispose())
    else (prev as { dispose?: () => void }).dispose?.()
  }

  mat.color.copy(parseColor(surface.color, 0x161a22))
  mat.metalness = Math.max(0, Math.min(1, surface.metalness))
  mat.roughness = Math.max(0, Math.min(1, surface.roughness))
  // Three.js multiplies emissive × intensity; black emissive yields no glow even at high intensity.
  const emissive = parseColor(surface.emissive, 0x000000)
  const intensity = Math.max(0, Math.min(8, surface.emissiveIntensity))
  if (intensity > 0 && emissive.r + emissive.g + emissive.b < 0.004) {
    emissive.copy(mat.color)
  }
  mat.emissive.copy(emissive)
  mat.emissiveIntensity = intensity
  mat.displacementScale = Math.max(0, Math.min(1, surface.displacementScale))
  // Mid-grey (0.5) → zero offset so ambientCG / PH height maps sit around the mesh.
  mat.displacementBias = mat.displacementScale > 0 ? -mat.displacementScale * 0.5 : 0
  if (opts?.polygonOffset) {
    mat.polygonOffset = true
    mat.polygonOffsetFactor = -2
    mat.polygonOffsetUnits = -2
  } else if (mesh.name === 'StudioFloor') {
    mat.polygonOffset = true
    mat.polygonOffsetFactor = 2
    mat.polygonOffsetUnits = 2
  } else if (mesh.name === 'StudioCyclorama') {
    // Prefer wall over floor skirt at the pad join when maps are noisy.
    mat.polygonOffset = true
    mat.polygonOffsetFactor = -1
    mat.polygonOffsetUnits = -1
  }

  const repeat = Math.max(0.0625, Math.min(1024, surface.mapRepeat || 1))
  const maps = surface.maps ?? {}

  const [
    map,
    normalMap,
    roughnessMap,
    metalnessMap,
    displacementMap,
    aoMap,
    emissiveMap,
  ] = await Promise.all([
    loadStageTexture(maps.mapAssetId),
    loadStageTexture(maps.normalMapAssetId),
    loadStageTexture(maps.roughnessMapAssetId),
    loadStageTexture(maps.metalnessMapAssetId),
    loadStageTexture(maps.displacementMapAssetId),
    loadStageTexture(maps.aoMapAssetId),
    loadStageTexture(maps.emissiveMapAssetId),
  ])

  const variation = Math.max(0, Math.min(1, surface.tileVariation ?? 0))
  const seed = Number.isFinite(surface.tileSeed) ? (surface.tileSeed as number) : 1

  const setMap = (
    key: keyof MeshStandardMaterial,
    tex: Texture | null,
    slot: number,
    srgb = false,
  ) => {
    const current = mat[key] as Texture | null
    // Binding-owned clones (not cache sources) can be disposed when replaced.
    if (current && current !== tex && !textureCacheHas(current)) {
      current.dispose()
    }
    ;(mat as unknown as Record<string, Texture | null>)[key] = tex
    if (tex) {
      tex.repeat.set(repeat, repeat)
      applyTileVariationTransform(tex, seed, variation, slot)
      tex.anisotropy = stageAnisotropy
      tex.needsUpdate = true
      if (srgb) tex.colorSpace = SRGBColorSpace
    }
  }

  // Distinct slot indices so each map gets its own UV spin — the tile grids fall
  // out of register across albedo / normal / rough / AO, which is what kills the pattern.
  setMap('map', map, 0, true)
  setMap('normalMap', normalMap, 1)
  setMap('roughnessMap', roughnessMap, 2)
  setMap('metalnessMap', metalnessMap, 3)
  setMap('displacementMap', displacementMap, 4)
  setMap('aoMap', aoMap, 5)
  setMap('emissiveMap', emissiveMap, 6, true)

  if (normalMap) {
    mat.normalScale = new Vector2(1, surface.normalYFlip ? -1 : 1)
  }
  if (aoMap) {
    mat.aoMapIntensity = 1
    // Three.js aoMap samples uv2 — stage geometries only author `uv`.
    const geo = mesh.geometry
    if (geo?.attributes?.uv && !geo.attributes.uv2) {
      geo.setAttribute('uv2', geo.attributes.uv)
    }
  }
  applyTileVariation(mat, variation, seed)
  mat.needsUpdate = true
}

/** Low-frequency UV shift (legacy helper for infinite-floor world lock). */
export function tileVariationUvOffset(seed: number, strength: number, out = new Vector2()): Vector2 {
  if (!(strength > 0)) return out.set(0, 0)
  const s = Number.isFinite(seed) ? seed : 1
  const wrap = (v: number) => ((v % 1) + 1) % 1
  return out.set(wrap(s * 0.37), wrap(s * 0.61))
}

/**
 * Per-map UV transform. Slot changes the phase so Randomise moves Albedo, Normal,
 * Rough, Metal, Depth, AO and Emit independently instead of sliding them as one stamp.
 */
export function applyTileVariationTransform(
  tex: Texture,
  seed: number,
  strength: number,
  slot = 0,
) {
  tex.center.set(0.5, 0.5)
  if (!(strength > 0)) {
    tex.offset.set(0, 0)
    tex.rotation = 0
    return
  }
  const s = (Number.isFinite(seed) ? seed : 1) + slot * 17.23
  const wrap = (v: number) => ((v % 1) + 1) % 1
  tex.offset.set(wrap(s * 0.37) * strength, wrap(s * 0.61) * strength)
  // Up to ~full turn at full strength, unique per slot.
  tex.rotation = wrap(s * 0.19) * Math.PI * 2 * (0.2 + 0.8 * strength)
}

function textureCacheHas(tex: Texture): boolean {
  for (const value of textureCache.values()) {
    if (value === tex) return true
  }
  return false
}
