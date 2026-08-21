import {
  BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  type BufferGeometry,
  type Texture,
} from 'three'

/**
 * Soft-blend world-space triplanar for vehicle PBR.
 *
 * Why not UV / hard box bake:
 * - Car GLB atlases → different density per panel
 * - Hard dominant-axis UV bake → staircase seams on curves (exactly the foil bug)
 *
 * Proper approach (Catlike Coding / Keijiro StandardTriplanar):
 * sample map on YZ / XZ / XY from world position, blend by pow(|n|, sharpness).
 *
 * Cost: 3 taps for albedo + normal; 1 planar tap for rough/metal/ao/emissive.
 * Scale/seed/variation are uniforms (stable program cache key).
 */

type TriUniforms = {
  uTriScale: { value: number }
  uTriSeed: { value: number }
  uTriVariation: { value: number }
  uTriSharp: { value: number }
}

const triUniforms = new WeakMap<MeshStandardMaterial, TriUniforms>()

const PROGRAM_KEY = 'iom-mat-triplanar-v8-soft'

const TRI_VERTEX_DECL = /* glsl */ `
varying vec3 vIomTriPos;
varying vec3 vIomTriNormal;
`

const TRI_VERTEX_BODY = /* glsl */ `
vIomTriPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vIomTriNormal = normalize( mat3( modelMatrix ) * objectNormal );
`

const TRI_FRAGMENT_HELPERS = /* glsl */ `
uniform float uTriScale;
uniform float uTriSeed;
uniform float uTriVariation;
uniform float uTriSharp;
varying vec3 vIomTriPos;
varying vec3 vIomTriNormal;

vec3 iomTriBlend( vec3 n ) {
  vec3 b = pow( max( abs( normalize( n ) ), vec3( 0.0001 ) ), vec3( max( uTriSharp, 1.0 ) ) );
  return b / ( b.x + b.y + b.z );
}

float iomHash( float n ) {
  return fract( sin( n ) * 43758.5453 );
}

vec2 iomJitterUv( vec2 uv, float seedMul ) {
  if ( uTriVariation < 0.001 ) return uv;
  float cell = floor( uv.x ) + floor( uv.y ) * 47.0;
  float h = iomHash( cell + uTriSeed * seedMul );
  float h2 = iomHash( cell + uTriSeed * seedMul + 19.0 );
  float q = floor( h * 4.0 );
  vec2 r = uv;
  if ( q < 1.5 ) r = vec2( -uv.y, uv.x );
  else if ( q < 2.5 ) r = -uv;
  else if ( q < 3.5 ) r = vec2( uv.y, -uv.x );
  vec2 off = ( vec2( h, h2 ) - 0.5 ) * uTriVariation;
  return mix( uv, r + off, uTriVariation );
}

vec4 iomTri2D( sampler2D tex, vec3 pos, vec3 n, float scale ) {
  vec3 w = iomTriBlend( n );
  vec2 ux = iomJitterUv( pos.zy * scale, 1.0 );
  vec2 uy = iomJitterUv( pos.xz * scale, 1.7 );
  vec2 uz = iomJitterUv( pos.xy * scale, 2.3 );
  return texture2D( tex, ux ) * w.x
       + texture2D( tex, uy ) * w.y
       + texture2D( tex, uz ) * w.z;
}

vec4 iomPlanar2D( sampler2D tex, vec3 pos, vec3 n, float scale ) {
  vec3 an = abs( n );
  if ( an.y >= an.x && an.y >= an.z ) {
    return texture2D( tex, iomJitterUv( pos.xz * scale, 1.7 ) );
  }
  if ( an.x >= an.z ) {
    return texture2D( tex, iomJitterUv( pos.zy * scale, 1.0 ) );
  }
  return texture2D( tex, iomJitterUv( pos.xy * scale, 2.3 ) );
}
`

const MAP_FRAGMENT_TRI = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = iomTri2D( map, vIomTriPos, vIomTriNormal, uTriScale );
  diffuseColor *= sampledDiffuseColor;
#endif
`

const ROUGHNESS_FRAGMENT_TRI = /* glsl */`
float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  vec4 texelRoughness = iomPlanar2D( roughnessMap, vIomTriPos, vIomTriNormal, uTriScale );
  roughnessFactor *= texelRoughness.g;
#endif
`

const METALNESS_FRAGMENT_TRI = /* glsl */`
float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
  vec4 texelMetalness = iomPlanar2D( metalnessMap, vIomTriPos, vIomTriNormal, uTriScale );
  metalnessFactor *= texelMetalness.b;
#endif
`

const AO_FRAGMENT_TRI = /* glsl */`
#ifdef USE_AOMAP
  float ambientOcclusion = ( iomPlanar2D( aoMap, vIomTriPos, vIomTriNormal, uTriScale ).r - 1.0 ) * aoMapIntensity + 1.0;
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

const EMISSIVE_FRAGMENT_TRI = /* glsl */`
#ifdef USE_EMISSIVEMAP
  vec4 emissiveColor = iomPlanar2D( emissiveMap, vIomTriPos, vIomTriNormal, uTriScale );
  totalEmissiveRadiance *= emissiveColor.rgb;
#endif
`

const NORMAL_FRAGMENT_TRI = /* glsl */`
#if defined( USE_NORMALMAP ) || defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_NORMALMAP_OBJECTSPACE )
  vec3 mapN = iomTri2D( normalMap, vIomTriPos, vIomTriNormal, uTriScale ).xyz * 2.0 - 1.0;
  mapN.xy *= normalScale;
  normal = normalize( normal + 0.35 * mapN );
#endif
`

export type MaterialMapProjection = 'uv' | 'triplanar'

export type TriplanarOptions = {
  scale?: number
  seed?: number
  variation?: number
  /** Soft blend sharpness (higher = less axis bleed). Default 4. */
  sharpness?: number
  /** Vehicle root — used to restore any previous UV-bake leftovers. */
  root?: Object3D | null
}

export function setMaterialMapProjection(
  mat: MeshStandardMaterial,
  mode: MaterialMapProjection,
  opts: TriplanarOptions | number = {},
) {
  const options: TriplanarOptions = typeof opts === 'number' ? { scale: opts } : opts
  const tiles = Math.max(0.05, Math.min(64, options.scale ?? 2))
  const seed =
    options.seed != null && Number.isFinite(options.seed)
      ? options.seed
      : typeof mat.userData.iomTriSeed === 'number'
        ? (mat.userData.iomTriSeed as number)
        : 1
  const variation = Math.max(
    0,
    Math.min(
      1,
      options.variation != null && Number.isFinite(options.variation)
        ? options.variation
        : typeof mat.userData.iomTriVariation === 'number'
          ? (mat.userData.iomTriVariation as number)
          : 0.25,
    ),
  )
  const sharpness =
    options.sharpness != null && Number.isFinite(options.sharpness)
      ? Math.max(1, Math.min(16, options.sharpness))
      : 4
  const root = options.root ?? null

  if (mode !== 'triplanar') {
    if (!mat.userData.iomTriplanar) {
      if (root) restoreUvBakesForMaterial(root, mat)
      return
    }
    if (root) restoreUvBakesForMaterial(root, mat)
    delete mat.userData.iomTriplanar
    delete mat.userData.iomTriUvBound
    delete mat.userData.iomTriScale
    delete mat.userData.iomTriSeed
    delete mat.userData.iomTriVariation
    delete mat.userData.iomTriplanarHooked
    mat.onBeforeCompile = () => {}
    mat.customProgramCacheKey = () => ''
    mat.needsUpdate = true
    return
  }

  // Undo hard box UV bake from the previous approach (staircase artifacts).
  if (root) restoreUvBakesForMaterial(root, mat)
  delete mat.userData.iomTriUvBound

  let uniforms = triUniforms.get(mat)
  if (!uniforms) {
    uniforms = {
      uTriScale: { value: tiles },
      uTriSeed: { value: seed },
      uTriVariation: { value: variation },
      uTriSharp: { value: sharpness },
    }
    triUniforms.set(mat, uniforms)
  } else {
    uniforms.uTriScale.value = tiles
    uniforms.uTriSeed.value = seed
    uniforms.uTriVariation.value = variation
    uniforms.uTriSharp.value = sharpness
  }

  mat.userData.iomTriplanar = true
  mat.userData.iomTriScale = tiles
  mat.userData.iomTriSeed = seed
  mat.userData.iomTriVariation = variation

  const owned = uniforms
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTriScale = owned.uTriScale
    shader.uniforms.uTriSeed = owned.uTriSeed
    shader.uniforms.uTriVariation = owned.uTriVariation
    shader.uniforms.uTriSharp = owned.uTriSharp

    if (!shader.vertexShader.includes('vIomTriPos')) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${TRI_VERTEX_DECL}`)
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>\n${TRI_VERTEX_BODY}`,
        )
    }

    if (!shader.fragmentShader.includes('iomTri2D')) {
      let frag =
        TRI_FRAGMENT_HELPERS +
        shader.fragmentShader
          .replace('#include <map_fragment>', MAP_FRAGMENT_TRI)
          .replace('#include <roughnessmap_fragment>', ROUGHNESS_FRAGMENT_TRI)
          .replace('#include <metalnessmap_fragment>', METALNESS_FRAGMENT_TRI)
          .replace('#include <aomap_fragment>', AO_FRAGMENT_TRI)
          .replace('#include <emissivemap_fragment>', EMISSIVE_FRAGMENT_TRI)
          .replace('#include <normal_fragment_maps>', NORMAL_FRAGMENT_TRI)

      // Fallback if a Three revision already expanded map_fragment.
      if (frag.includes('texture2D( map, vMapUv )')) {
        frag = frag.replace(
          /texture2D\(\s*map\s*,\s*vMapUv\s*\)/g,
          'iomTri2D( map, vIomTriPos, vIomTriNormal, uTriScale )',
        )
      }
      shader.fragmentShader = frag
    }
  }
  mat.customProgramCacheKey = () => PROGRAM_KEY
  mat.userData.iomTriplanarHooked = true
  prepareMapsForProjection(mat)
  mat.needsUpdate = true
}

export function syncMaterialMapProjection(
  mat: MeshStandardMaterial,
  mode: MaterialMapProjection | undefined,
  mapRepeat: number | undefined,
  mapTriSeed?: number,
  mapTriVariation?: number,
  root?: Object3D | null,
) {
  const projection: MaterialMapProjection =
    mode === 'triplanar'
      ? 'triplanar'
      : mode === 'uv'
        ? 'uv'
        : isTriplanarEnabled(mat)
          ? 'triplanar'
          : 'uv'
  const scale =
    mapRepeat != null
      ? mapRepeat
      : typeof mat.userData.iomTriScale === 'number'
        ? (mat.userData.iomTriScale as number)
        : 2
  setMaterialMapProjection(mat, projection, {
    scale,
    seed: mapTriSeed,
    variation: mapTriVariation,
    root: root ?? null,
  })
}

export function prepareMapsForProjection(mat: MeshStandardMaterial) {
  const maps: Array<Texture | null | undefined> = [
    mat.map,
    mat.normalMap,
    mat.roughnessMap,
    mat.metalnessMap,
    mat.aoMap,
    mat.emissiveMap,
  ]
  for (const tex of maps) {
    if (!tex) continue
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    if (mat.userData.iomTriplanar) {
      tex.repeat.set(1, 1)
      tex.offset.set(0, 0)
      tex.center.set(0, 0)
      tex.rotation = 0
      tex.updateMatrix()
    }
    tex.needsUpdate = true
  }
}

export function isTriplanarEnabled(mat: MeshStandardMaterial) {
  return Boolean(mat.userData.iomTriplanar)
}

export function readTriplanarSeed(mat: MeshStandardMaterial): number {
  const s = mat.userData.iomTriSeed
  return typeof s === 'number' && Number.isFinite(s) ? s : 1
}

export function readTriplanarVariation(mat: MeshStandardMaterial): number {
  const v = mat.userData.iomTriVariation
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.25
}

type UvBackup = {
  uv: BufferAttribute
  uv1: BufferAttribute | null
  tangent: BufferAttribute | null
}

/** Restore meshes that still carry the old hard box-map UV bake. */
function restoreUvBakesForMaterial(root: Object3D, mat: MeshStandardMaterial) {
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (!mats.includes(mat)) return
    restoreMeshUVs(mesh.geometry)
  })
}

function restoreMeshUVs(geom: BufferGeometry) {
  const backup = geom.userData.iomUvBackup as UvBackup | undefined
  if (!backup) {
    delete geom.userData.iomTriProjected
    return
  }
  geom.setAttribute('uv', backup.uv.clone())
  if (backup.uv1) geom.setAttribute('uv1', backup.uv1.clone())
  else geom.deleteAttribute('uv1')
  if (backup.tangent) geom.setAttribute('tangent', backup.tangent.clone())
  else geom.deleteAttribute('tangent')
  delete geom.userData.iomUvBackup
  delete geom.userData.iomTriProjected
  if (geom.attributes.uv) geom.attributes.uv.needsUpdate = true
}
