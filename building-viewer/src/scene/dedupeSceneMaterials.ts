import {
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type Object3D,
  type Texture,
} from 'three'

const TEX_KEYS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'alphaMap',
  'bumpMap',
  'displacementMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'transmissionMap',
  'thicknessMap',
  'specularColorMap',
  'specularIntensityMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'lightMap',
] as const

function round(n: number, step = 0.002): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n / step) * step
}

function colorKey(color: { r: number; g: number; b: number } | undefined): string {
  if (!color) return 'none'
  return `${round(color.r)}:${round(color.g)}:${round(color.b)}`
}

function texKey(tex: Texture | null | undefined): string {
  if (!tex) return 'none'
  const image = tex.image as { uuid?: string; width?: number; height?: number } | undefined
  const id = tex.uuid || image?.uuid || ''
  const w = image?.width ?? 0
  const h = image?.height ?? 0
  return `${id}:${w}x${h}`
}

function materialSignature(mat: Material): string {
  const m = mat as Material & Record<string, unknown>
  const std =
    mat instanceof MeshStandardMaterial || mat instanceof MeshPhysicalMaterial
      ? (mat as MeshStandardMaterial)
      : null

  const parts: Record<string, unknown> = {
    type: mat.type,
    side: mat.side,
    transparent: mat.transparent ? 1 : 0,
    opacity: round(mat.opacity),
    alphaTest: round((mat as Material & { alphaTest?: number }).alphaTest ?? 0),
    color: colorKey(std?.color),
    emissive: colorKey(std?.emissive),
    metalness: round(std?.metalness ?? 0),
    roughness: round(std?.roughness ?? 1),
    emissiveIntensity: round(std?.emissiveIntensity ?? 1),
  }

  if (mat instanceof MeshPhysicalMaterial) {
    parts.transmission = round(mat.transmission)
    parts.thickness = round(mat.thickness)
    parts.ior = round(mat.ior)
    parts.clearcoat = round(mat.clearcoat)
    parts.clearcoatRoughness = round(mat.clearcoatRoughness)
    parts.specularIntensity = round(mat.specularIntensity)
    parts.specularColor = colorKey(mat.specularColor)
  }

  for (const key of TEX_KEYS) {
    parts[key] = texKey(m[key] as Texture | null | undefined)
  }

  return JSON.stringify(parts)
}

export type MaterialDedupeStats = {
  before: number
  after: number
  merged: number
}

/**
 * Merge mesh materials that share the same visual signature after GLTF load.
 * Run before prepareArchitecturalMeshes so glass/water cloning shares fewer sources.
 */
export function dedupeSceneMaterials(root: Object3D): MaterialDedupeStats {
  /** @type {Set<Material>} */
  const unique = new Set<Material>()
  root.traverse((obj) => {
    if (!(obj as Mesh).isMesh) return
    const mesh = obj as Mesh
    if (mesh.userData?.collisionOnly) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (mat) unique.add(mat)
    }
  })

  const bySig = new Map<string, Material>()
  const remap = new Map<Material, Material>()
  let merged = 0

  for (const mat of unique) {
    const sig = materialSignature(mat)
    const canonical = bySig.get(sig)
    if (canonical) {
      remap.set(mat, canonical)
      merged += 1
    } else {
      bySig.set(sig, mat)
    }
  }

  if (!merged) {
    return { before: unique.size, after: unique.size, merged: 0 }
  }

  root.traverse((obj) => {
    if (!(obj as Mesh).isMesh) return
    const mesh = obj as Mesh
    if (mesh.userData?.collisionOnly) return
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => (m && remap.get(m)) || m)
    } else if (mesh.material && remap.has(mesh.material)) {
      mesh.material = remap.get(mesh.material)!
    }
  })

  return { before: unique.size, after: bySig.size, merged }
}
