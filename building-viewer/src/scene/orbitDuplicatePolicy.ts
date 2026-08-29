import type { Mesh } from 'three'
import { isVisibilityCriticalAssembly } from './assetSemantics'

/**
 * Explicit metadata contract for visual ownership between the animated and
 * exterior layers. `orbitDuplicateOf` is expected to come from glTF extras.
 * Runtime preparation may assign the narrow `facade-shutter` role.
 */
export type OrbitDuplicateRole = 'facade-shutter'

export function isOrbitDuplicateMesh(mesh: Mesh): boolean {
  if (
    mesh.userData?.collisionOnly ||
    mesh.userData?.cadOverlay ||
    mesh.userData?.architecturalGlass ||
    isVisibilityCriticalAssembly(mesh)
  ) {
    return false
  }

  if (mesh.userData?.orbitDuplicateOf === 'icm-ext') return true

  const role = mesh.userData?.orbitDuplicateRole as OrbitDuplicateRole | undefined
  return role === 'facade-shutter'
}
