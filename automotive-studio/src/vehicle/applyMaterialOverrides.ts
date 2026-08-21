import {
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  type Material,
  type Texture,
} from 'three'
import type { MaterialNodeOverride, MaterialOverrideProps, StageSurfaceMaps } from '../persistence/schema'
import { resolveSemanticNode } from '../hotspots/resolveAnchor'
import { loadStageTexture } from '../stage/stageMaterials'
import { syncMaterialMapProjection } from './materialTriplanar'

/**
 * Re-apply authored material overrides after polish / quality switch / restore.
 * Scalars apply synchronously; map textures resolve from IndexedDB asynchronously.
 *
 * `shared-material` updates every mesh material with the same name — many vehicle
 * GLBs clone materials per panel instead of sharing one instance.
 */
export function applyMaterialOverrides(root: Object3D, overrides: MaterialNodeOverride[] | null | undefined) {
  if (!overrides?.length) return 0
  let applied = 0
  for (const entry of overrides) {
    const node = resolveSemanticNode(root, entry.node)
    if (!node) continue
    if (entry.props.visible != null) node.visible = entry.props.visible
    const targets = collectOverrideMaterials(root, entry, node)
    for (const mat of targets) {
      applyProps(mat, entry.props, root)
      applied++
    }
  }
  return applied
}

/** Load + assign uploaded / cleared map slots after a sync `applyMaterialOverrides`. */
export async function applyMaterialOverrideMaps(
  root: Object3D,
  overrides: MaterialNodeOverride[] | null | undefined,
): Promise<number> {
  if (!overrides?.length) return 0
  let applied = 0
  for (const entry of overrides) {
    if (
      !entry.props.maps &&
      entry.props.normalYFlip == null &&
      entry.props.mapRepeat == null &&
      entry.props.mapProjection == null &&
      entry.props.mapTriSeed == null &&
      entry.props.mapTriVariation == null
    ) {
      continue
    }
    const node = resolveSemanticNode(root, entry.node)
    if (!node) continue
    const targets = collectOverrideMaterials(root, entry, node)
    for (const mat of targets) {
      await applyMaps(
        mat,
        entry.props.maps,
        entry.props.normalYFlip,
        entry.props.mapRepeat,
        entry.props.mapProjection,
        entry.props.mapTriSeed,
        entry.props.mapTriVariation,
        root,
      )
      applied++
    }
  }
  return applied
}

/**
 * Materials that should receive a shared-material override.
 * Prefer same `material.name` across the vehicle; fall back to the resolved slot.
 */
export function collectOverrideMaterials(
  root: Object3D,
  entry: MaterialNodeOverride,
  node: Object3D,
): MeshStandardMaterial[] {
  const mesh = node as Mesh
  const primary =
    mesh.isMesh ? (resolveMaterialSlot(mesh, entry) as MeshStandardMaterial | null) : null
  if (entry.scope === 'mesh-local') {
    return primary && primary.isMeshStandardMaterial ? [primary] : []
  }

  const name = entry.materialName || primary?.name
  if (name) {
    const found: MeshStandardMaterial[] = []
    const seen = new Set<MeshStandardMaterial>()
    root.traverse((obj) => {
      const m = obj as Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) continue
        const std = mat as MeshStandardMaterial
        if (std.name !== name) continue
        if (seen.has(std)) continue
        seen.add(std)
        found.push(std)
      }
    })
    if (found.length) return found
  }

  return primary && primary.isMeshStandardMaterial ? [primary] : []
}

function resolveMaterialSlot(mesh: Mesh, entry: MaterialNodeOverride): Material | null {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (entry.materialName) {
    const byName = mats.find((m) => m?.name === entry.materialName)
    if (byName) return byName
  }
  return mats[entry.materialSlot] ?? mats[0] ?? null
}

function applyProps(std: MeshStandardMaterial, props: MaterialOverrideProps, root: Object3D) {
  const physical = std as MeshPhysicalMaterial
  if (props.color != null) std.color.set(props.color)
  if (props.metalness != null) std.metalness = clamp01(props.metalness)
  if (props.roughness != null) std.roughness = clamp01(props.roughness)
  if (props.emissive != null) std.emissive.set(props.emissive)
  if (props.emissiveIntensity != null) std.emissiveIntensity = Math.max(0, props.emissiveIntensity)
  if (props.opacity != null) {
    std.opacity = clamp01(props.opacity)
    if (std.opacity < 0.999) std.transparent = true
  }
  if (props.transparent != null) std.transparent = props.transparent
  if (props.envMapIntensity != null) std.envMapIntensity = Math.max(0, props.envMapIntensity)
  if (physical.isMeshPhysicalMaterial) {
    if (props.clearcoat != null) physical.clearcoat = clamp01(props.clearcoat)
    if (props.clearcoatRoughness != null) physical.clearcoatRoughness = clamp01(props.clearcoatRoughness)
    if (props.transmission != null) {
      physical.transmission = clamp01(props.transmission)
      if (physical.transmission > 0.01) {
        std.transparent = true
        physical.thickness = Math.max(physical.thickness || 0, 0.2)
      }
    }
  }
  if (props.normalYFlip != null) {
    std.normalScale = new Vector2(1, props.normalYFlip ? -1 : 1)
  }
  if (props.mapRepeat != null && props.mapProjection !== 'triplanar') {
    applyTextureRepeat(std, props.mapRepeat)
  }
  syncMaterialMapProjection(
    std,
    props.mapProjection,
    props.mapRepeat,
    props.mapTriSeed,
    props.mapTriVariation,
    root,
  )
  std.needsUpdate = true
}

async function applyMaps(
  std: MeshStandardMaterial,
  maps: StageSurfaceMaps | undefined,
  normalYFlip?: boolean,
  mapRepeat?: number,
  mapProjection?: 'uv' | 'triplanar',
  mapTriSeed?: number,
  mapTriVariation?: number,
  root?: Object3D | null,
) {
  if (!maps) {
    if (normalYFlip != null) {
      std.normalScale = new Vector2(1, normalYFlip ? -1 : 1)
      std.needsUpdate = true
    }
    if (mapRepeat != null && mapProjection !== 'triplanar') applyTextureRepeat(std, mapRepeat)
    syncMaterialMapProjection(std, mapProjection, mapRepeat, mapTriSeed, mapTriVariation, root)
    return
  }

  const assign = async (
    key: keyof StageSurfaceMaps,
    setter: (tex: Texture | null) => void,
  ) => {
    if (!(key in maps)) return
    const assetId = maps[key]
    if (assetId == null) {
      setter(null)
      return
    }
    const tex = await loadStageTexture(assetId)
    setter(tex)
  }

  // Clone so each material gets its own Texture wrapper (shared image).
  // Sharing one Texture across UV + triplanar mats made repeat/matrix fight
  // and panels pick up different UV densities from the GLB.
  await assign('mapAssetId', (tex) => {
    const next = tex ? tex.clone() : null
    if (next) next.colorSpace = SRGBColorSpace
    std.map = next
  })
  await assign('normalMapAssetId', (tex) => {
    std.normalMap = tex ? tex.clone() : null
  })
  await assign('roughnessMapAssetId', (tex) => {
    std.roughnessMap = tex ? tex.clone() : null
  })
  await assign('metalnessMapAssetId', (tex) => {
    std.metalnessMap = tex ? tex.clone() : null
  })
  await assign('displacementMapAssetId', (tex) => {
    std.displacementMap = tex ? tex.clone() : null
    // Car body meshes aren't dense enough for height — keep slot but don't extrude.
    std.displacementScale = 0
    std.displacementBias = 0
  })
  await assign('aoMapAssetId', (tex) => {
    std.aoMap = tex ? tex.clone() : null
    if (std.aoMap) std.aoMapIntensity = 1
  })
  await assign('emissiveMapAssetId', (tex) => {
    const next = tex ? tex.clone() : null
    if (next) next.colorSpace = SRGBColorSpace
    std.emissiveMap = next
  })

  if (normalYFlip != null || maps.normalMapAssetId) {
    const flip = normalYFlip === true
    std.normalScale = new Vector2(1, flip ? -1 : 1)
  }
  if (mapProjection !== 'triplanar' && mapRepeat != null) applyTextureRepeat(std, mapRepeat)
  syncMaterialMapProjection(std, mapProjection, mapRepeat, mapTriSeed, mapTriVariation, root)
  std.needsUpdate = true
}

function applyTextureRepeat(std: MeshStandardMaterial, repeat: number) {
  const r = Math.max(0.0625, Math.min(1024, repeat))
  const textures = [
    std.map,
    std.normalMap,
    std.roughnessMap,
    std.metalnessMap,
    std.displacementMap,
    std.aoMap,
    std.emissiveMap,
  ]
  for (const tex of textures) {
    if (!tex) continue
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(r, r)
    tex.updateMatrix()
    tex.needsUpdate = true
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

/** Stable id for an override keyed by path + slot (quality-switch friendly). */
export function materialOverrideKey(nodePath: string, materialSlot: number): string {
  return `${nodePath}#${materialSlot}`
}
