import {
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  type Material,
} from 'three'
import type { MaterialNodeOverride, MaterialOverrideProps } from '../persistence/schema'
import { resolveSemanticNode } from '../hotspots/resolveAnchor'

/**
 * Re-apply authored material overrides after polish / quality switch / restore.
 */
export function applyMaterialOverrides(root: Object3D, overrides: MaterialNodeOverride[] | null | undefined) {
  if (!overrides?.length) return 0
  let applied = 0
  for (const entry of overrides) {
    const node = resolveSemanticNode(root, entry.node)
    if (!node) continue
    if (entry.props.visible != null) node.visible = entry.props.visible
    const mesh = node as Mesh
    if (!mesh.isMesh) {
      applied++
      continue
    }
    const mat = resolveMaterialSlot(mesh, entry)
    if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) continue
    applyProps(mat as MeshStandardMaterial, entry.props)
    applied++
  }
  return applied
}

function resolveMaterialSlot(mesh: Mesh, entry: MaterialNodeOverride): Material | null {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (entry.materialName) {
    const byName = mats.find((m) => m?.name === entry.materialName)
    if (byName) return byName
  }
  return mats[entry.materialSlot] ?? mats[0] ?? null
}

function applyProps(std: MeshStandardMaterial, props: MaterialOverrideProps) {
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
  std.needsUpdate = true
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

/** Stable id for an override keyed by path + slot (quality-switch friendly). */
export function materialOverrideKey(nodePath: string, materialSlot: number): string {
  return `${nodePath}#${materialSlot}`
}
