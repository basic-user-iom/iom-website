import {
  Color,
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
const textureCache = new Map<string, Texture>()
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

export async function loadStageTexture(assetId: string | null | undefined): Promise<Texture | null> {
  if (!assetId) return null
  const cached = textureCache.get(assetId)
  if (cached) return cached
  const blob = await idbGetAssetBlob(assetId)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  objectUrls.set(assetId, url)
  const texture = await new Promise<Texture>((resolve, reject) => {
    textureLoader.load(url, resolve, undefined, reject)
  })
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.anisotropy = stageAnisotropy
  textureCache.set(assetId, texture)
  return texture
}

export function disposeStageTextureCache() {
  for (const tex of textureCache.values()) tex.dispose()
  textureCache.clear()
  for (const url of objectUrls.values()) URL.revokeObjectURL(url)
  objectUrls.clear()
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
  if (opts?.polygonOffset) {
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

  const setMap = (key: keyof MeshStandardMaterial, tex: Texture | null, srgb = false) => {
    const current = mat[key] as Texture | null
    if (current && current !== tex && !textureCacheHas(current)) {
      // leave shared cache textures alone
    }
    ;(mat as unknown as Record<string, Texture | null>)[key] = tex
    if (tex) {
      tex.repeat.set(repeat, repeat)
      tex.anisotropy = stageAnisotropy
      tex.needsUpdate = true
      if (srgb) tex.colorSpace = SRGBColorSpace
    }
  }

  setMap('map', map, true)
  setMap('normalMap', normalMap)
  setMap('roughnessMap', roughnessMap)
  setMap('metalnessMap', metalnessMap)
  setMap('displacementMap', displacementMap)
  setMap('aoMap', aoMap)
  setMap('emissiveMap', emissiveMap, true)

  if (normalMap) mat.normalScale = new Vector2(1, 1)
  mat.needsUpdate = true
}

function textureCacheHas(tex: Texture): boolean {
  for (const value of textureCache.values()) {
    if (value === tex) return true
  }
  return false
}
