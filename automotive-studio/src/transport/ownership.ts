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
  camera: 'shot-sequence' | 'manual-orbit' | 'route-chase' | 'none'
  wheelRolling: 'route-distance' | 'embedded-clip' | 'off'
}

export type OwnershipClaim = {
  state: OwnershipState
  accepted: boolean
  reason?: string
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
): OwnershipClaim {
  const active = state.vehicleRoot
  const exclusive = new Set<OwnershipState['vehicleRoot']>([
    'vehicle-route',
    'embedded-root-motion',
    'hotspot-action',
  ])
  if (next !== 'none' && active !== 'none' && active !== next && exclusive.has(active) && exclusive.has(next)) {
    return {
      state,
      accepted: false,
      reason: `Vehicle root is owned by ${active}; release it before claiming ${next}.`,
    }
  }
  return { state: { ...state, vehicleRoot: next }, accepted: true }
}

export function releaseVehicleRoot(state: OwnershipState): OwnershipState {
  return { ...state, vehicleRoot: 'none' }
}

export function claimCamera(
  state: OwnershipState,
  next: OwnershipState['camera'],
): OwnershipClaim {
  const active = state.camera
  if (next !== 'none' && active !== 'none' && active !== next) {
    return {
      state,
      accepted: false,
      reason: `Camera is owned by ${active}; release it before claiming ${next}.`,
    }
  }
  return { state: { ...state, camera: next }, accepted: true }
}

export function releaseCamera(state: OwnershipState): OwnershipState {
  return { ...state, camera: 'none' }
}

export function claimRouteChase(state: OwnershipState) {
  return claimCamera(state, 'route-chase')
}

export function claimShotSequence(state: OwnershipState) {
  return claimCamera(state, 'shot-sequence')
}

export function claimManualOrbit(state: OwnershipState) {
  return claimCamera(state, 'manual-orbit')
}

export function releaseCameraToFree(state: OwnershipState): OwnershipState {
  return claimCamera(releaseCamera(state), 'manual-orbit').state
}
