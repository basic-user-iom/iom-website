import {
  ClampToEdgeWrapping,
  DoubleSide,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  TextureLoader,
  type Material,
  type Object3D,
  type Texture,
} from 'three'
import type { ModelManifestEntry } from '../scene/types'

type LightMapMaterial = Material & {
  lightMap?: Texture | null
  lightMapIntensity?: number
  envMapIntensity?: number
  transparent?: boolean
  opacity?: number
  transmission?: number
  forceSinglePass?: boolean
}

const loader = new TextureLoader()
const cache = new Map<string, Promise<Texture>>()

function loadLightmap(url: string): Promise<Texture> {
  const hit = cache.get(url)
  if (hit) return hit
  const pending = new Promise<Texture>((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.flipY = false
        tex.colorSpace = LinearSRGBColorSpace
        tex.channel = 1
        // Atlas islands sit on black padding — mipmaps sample neighbors and shimmer.
        tex.generateMipmaps = false
        tex.minFilter = LinearFilter
        tex.magFilter = LinearFilter
        tex.wrapS = ClampToEdgeWrapping
        tex.wrapT = ClampToEdgeWrapping
        tex.needsUpdate = true
        resolve(tex)
      },
      undefined,
      (err) => reject(err),
    )
  })
  cache.set(url, pending)
  return pending
}

function lightmapChannel(mesh: Mesh): number | null {
  const geom = mesh.geometry
  if (!geom) return null
  if (geom.getAttribute('uv1')) return 1
  if (geom.getAttribute('uv2')) return 2
  return null
}

function shouldSkip(mesh: Mesh, mat: LightMapMaterial): boolean {
  if (mesh.userData?.cadOverlay || mesh.userData?.collisionOnly) return true
  if ((mat.transmission ?? 0) > 0.02) return true
  if (mat.transparent && (mat.opacity ?? 1) < 0.95) return true
  return false
}

/**
 * Bind a project lightmap to meshes that already have TEXCOORD_1 (Three.js uv1).
 * glTF has no core lightmap slot; this is the viewer-side contract.
 */
export async function applyLightmaps(root: Object3D, entry: ModelManifestEntry): Promise<number> {
  const url = entry.lightmap
  if (!url) return 0
  const tex = await loadLightmap(url)
  const intensity = entry.lightMapIntensity ?? 1.35
  let bound = 0
  root.traverse((obj) => {
    if (!(obj as Mesh).isMesh) return
    const mesh = obj as Mesh
    const channel = lightmapChannel(mesh)
    if (channel == null) return
    mesh.userData.lightmappedSlice = true
    mesh.userData.detailLodIgnore = true
    mesh.userData.floorZoneAlways = true
    if (!mesh.userData?.architecturalGlass) {
      mesh.castShadow = false
      mesh.receiveShadow = false
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const raw of mats) {
      if (!raw) continue
      const mat = raw as LightMapMaterial
      if (!('lightMap' in mat) || shouldSkip(mesh, mat)) continue
      if (tex.channel !== channel) tex.channel = channel
      mat.lightMap = tex
      mat.lightMapIntensity = intensity
      if (mat.envMapIntensity != null) {
        mat.envMapIntensity = Math.min(mat.envMapIntensity, 0.45)
      }
      if (!mesh.userData?.shutter) {
        mat.side = DoubleSide
        mat.forceSinglePass = true
      }
      mat.polygonOffset = true
      mat.polygonOffsetFactor = -1
      mat.polygonOffsetUnits = -1
      mat.needsUpdate = true
      bound += 1
    }
  })
  if (bound > 0) {
    console.info(`[Viewer] bound lightmap on ${bound} material(s) for ${entry.id}`)
  }
  return bound
}
