import { Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, type Material } from 'three'

const INTERIOR =
  /interior|seat|dash|cabin|carpet|console|headliner|upholstery|fabric|leather|screen|steering/i
const EXTERIOR_PAINT = /carpaint|paint|chrome|body|exterior|wheel|tire|tyre|caliper|rotor|rim|spoke/i
const GLASS = /glass|window|windscreen|windshield|transparent|lens/i

/** Enable shadow casting/receiving on every mesh under `root`. */
export function enableShadows(root: Object3D, opts: { cast?: boolean; receive?: boolean } = {}) {
  const cast = opts.cast !== false
  const receive = opts.receive !== false
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = cast
    mesh.receiveShadow = receive
  })
}

function materialLabel(mat: Material | Material[] | undefined): string {
  if (!mat) return ''
  if (Array.isArray(mat)) return mat.map((m) => m.name || '').join(' ')
  return mat.name || ''
}

function meshLabel(mesh: Mesh): string {
  return `${mesh.name || ''} ${materialLabel(mesh.material)}`
}

function isGlassMesh(mesh: Mesh): boolean {
  const label = meshLabel(mesh)
  if (GLASS.test(label)) return true
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const mat of mats) {
    if (!mat) continue
    const std = mat as MeshStandardMaterial
    const physical = mat as MeshPhysicalMaterial
    if (physical.transmission != null && physical.transmission > 0.05) return true
    if (std.transparent && std.opacity < 0.85 && (std.metalness ?? 0) < 0.25) return true
  }
  return false
}

function isInteriorCabinMesh(mesh: Mesh): boolean {
  const label = meshLabel(mesh)
  if (GLASS.test(label) || EXTERIOR_PAINT.test(label)) return false
  return INTERIOR.test(label)
}

export type VehicleShadowStats = {
  interiorReceive: number
  glassNoCast: number
  bodyCast: number
}

/**
 * Vehicle shadows tuned for cabin readability:
 * - Body/paint cast onto the floor (no receive → no paint acne)
 * - Glass does NOT cast — otherwise windows seal the cabin in the shadow map
 *   and seats never see patterned light from the sun
 * - Interior meshes cast + receive so seats/dash get pillar and self-shadows
 */
export function enableVehicleShadows(root: Object3D): VehicleShadowStats {
  const stats: VehicleShadowStats = { interiorReceive: 0, glassNoCast: 0, bodyCast: 0 }
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return

    if (isGlassMesh(mesh)) {
      // Critical: opaque glass shadows black-out the entire cabin.
      mesh.castShadow = false
      mesh.receiveShadow = false
      stats.glassNoCast += 1
      return
    }

    if (isInteriorCabinMesh(mesh)) {
      mesh.castShadow = true
      mesh.receiveShadow = true
      stats.interiorReceive += 1
      return
    }

    mesh.castShadow = true
    mesh.receiveShadow = false
    stats.bodyCast += 1
  })
  return stats
}
