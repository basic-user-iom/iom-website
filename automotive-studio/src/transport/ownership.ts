/**
 * Transform / track ownership rules (Phase 1 skeleton).
 * Full conflict resolution expands in later phases.
 */

export type OwnerKind =
  | 'none'
  | 'turntable'
  | 'vehicle-route'
  | 'embedded-root-motion'
  | 'shot-sequence'
  | 'manual-orbit'
  | 'gizmo-edit'
  | 'hotspot-action'

export interface OwnershipState {
  vehicleRoot: Exclude<OwnerKind, 'shot-sequence' | 'manual-orbit'>
  camera: 'shot-sequence' | 'manual-orbit' | 'none'
  wheelRolling: 'route-distance' | 'embedded-clip' | 'off'
}

export function createDefaultOwnership(): OwnershipState {
  return {
    vehicleRoot: 'none',
    camera: 'none',
    wheelRolling: 'off',
  }
}

export function claimVehicleRoot(
  state: OwnershipState,
  next: OwnershipState['vehicleRoot'],
): OwnershipState {
  if (state.vehicleRoot !== 'none' && state.vehicleRoot !== next && next !== 'none') {
    // Mutually exclusive root owners — last explicit claim wins after release.
    return { ...state, vehicleRoot: next }
  }
  return { ...state, vehicleRoot: next }
}

export function releaseCameraToFree(state: OwnershipState): OwnershipState {
  return { ...state, camera: 'manual-orbit' }
}
