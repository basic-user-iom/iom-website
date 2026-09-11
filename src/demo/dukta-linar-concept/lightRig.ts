import type { LinarLightPlacement } from './types'

/**
 * Presentation-light limits. These are visual-study values rather than
 * manufacturer or photometric data.
 */
export const LINAR_LIGHT_NEAR_SURFACE_CLEARANCE_M = 0.04
export const LINAR_LIGHT_DEFAULT_SURFACE_CLEARANCE_M = 0.45
export const LINAR_LIGHT_FAR_SURFACE_CLEARANCE_M = 4.2

// Let the handle travel slightly below and clearly above the panel while the
// displayed value remains an honest percentage of panel-local height.
export const LINAR_LIGHT_MIN_HEIGHT_PERCENT = -15
export const LINAR_LIGHT_MAX_HEIGHT_PERCENT = 125

export type LinarLightPlanBounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  heightM: number
}

export type LinarLightLocalPosition = {
  x: number
  y: number
  z: number
}

export type LinarLightPositionState = {
  placement: LinarLightPlacement
  u: number
  v: number
  radius: number
}

export function clampLinarLightCoordinate(value: number, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : fallback
}

export function linarLightHeightPercent(value: number): number {
  const normalised = (clampLinarLightCoordinate(value) + 1) * 0.5
  return (
    LINAR_LIGHT_MIN_HEIGHT_PERCENT +
    (LINAR_LIGHT_MAX_HEIGHT_PERCENT - LINAR_LIGHT_MIN_HEIGHT_PERCENT) * normalised
  )
}

export function linarLightValueForHeightPercent(percent: number): number {
  const bounded = Math.max(
    LINAR_LIGHT_MIN_HEIGHT_PERCENT,
    Math.min(LINAR_LIGHT_MAX_HEIGHT_PERCENT, percent),
  )
  const progress =
    (bounded - LINAR_LIGHT_MIN_HEIGHT_PERCENT) /
    (LINAR_LIGHT_MAX_HEIGHT_PERCENT - LINAR_LIGHT_MIN_HEIGHT_PERCENT)
  return progress * 2 - 1
}

export function linarLightOrbitDegrees(value: number, mounted: boolean): number {
  return clampLinarLightCoordinate(value) * (mounted ? 90 : 180)
}

export function linarLightValueForOrbitDegrees(
  degrees: number,
  mounted: boolean,
): number {
  return clampLinarLightCoordinate(degrees / (mounted ? 90 : 180))
}

export function linarLightSurfaceClearanceM(value: number): number {
  const radius = clampLinarLightCoordinate(value)
  const from =
    radius < 0
      ? LINAR_LIGHT_NEAR_SURFACE_CLEARANCE_M
      : LINAR_LIGHT_DEFAULT_SURFACE_CLEARANCE_M
  const to =
    radius < 0
      ? LINAR_LIGHT_DEFAULT_SURFACE_CLEARANCE_M
      : LINAR_LIGHT_FAR_SURFACE_CLEARANCE_M
  const progress = radius < 0 ? radius + 1 : radius
  return Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * progress)
}

/** Inverse of the logarithmic distance slider, for direct centimetre entry. */
export function linarLightValueForSurfaceClearanceM(distanceM: number): number {
  if (!Number.isFinite(distanceM)) return 0
  const distance = Math.max(LINAR_LIGHT_NEAR_SURFACE_CLEARANCE_M,
    Math.min(LINAR_LIGHT_FAR_SURFACE_CLEARANCE_M, distanceM))
  const near = distance < LINAR_LIGHT_DEFAULT_SURFACE_CLEARANCE_M
  const from = near ? LINAR_LIGHT_NEAR_SURFACE_CLEARANCE_M : LINAR_LIGHT_DEFAULT_SURFACE_CLEARANCE_M
  const to = near ? LINAR_LIGHT_DEFAULT_SURFACE_CLEARANCE_M : LINAR_LIGHT_FAR_SURFACE_CLEARANCE_M
  const progress = (Math.log(distance) - Math.log(from)) / (Math.log(to) - Math.log(from))
  return clampLinarLightCoordinate(near ? progress - 1 : progress)
}

export function formatLinarLightSurfaceClearance(value: number): string {
  const distanceM = linarLightSurfaceClearanceM(value)
  if (distanceM < 1) return `${Math.round(distanceM * 100)} cm`
  return `${distanceM.toFixed(distanceM < 2 ? 2 : 1).replace(/\.0$/, '')} m`
}

/**
 * Maps the three controls to independent panel-local coordinates:
 *
 * - `u` moves around the panel at a constant height;
 * - `v` changes only panel-local height;
 * - `radius` changes only the clearance beyond the panel envelope.
 *
 * Mounted Room/Behind selections each own one 180-degree half-orbit. Together
 * they cover the complete installation without allowing a room-side control to
 * silently cross through the wall or ceiling. Freestanding uses a full orbit.
 */
export function setLinarLightLocalPosition(
  out: LinarLightLocalPosition,
  state: LinarLightPositionState,
  bounds: LinarLightPlanBounds,
  mounted: boolean,
  inspectionFlipped: boolean,
): LinarLightLocalPosition {
  const u = clampLinarLightCoordinate(state.u)
  const angle = u * (mounted ? Math.PI * 0.5 : Math.PI)
  const flipSign = inspectionFlipped ? -1 : 1
  const placementSign = mounted && state.placement === 'behind' ? -1 : 1
  const directionX = Math.sin(angle) * flipSign
  const directionZ = Math.cos(angle) * placementSign * flipSign
  const centreX = (bounds.minX + bounds.maxX) * 0.5
  const centreZ = (bounds.minZ + bounds.maxZ) * 0.5

  let exitDistance = Number.POSITIVE_INFINITY
  let exitNormalComponent = 1
  if (Math.abs(directionX) > 0.000001) {
    const edgeDistance =
      directionX > 0 ? bounds.maxX - centreX : centreX - bounds.minX
    const candidate = Math.max(edgeDistance, 0.001) / Math.abs(directionX)
    if (candidate < exitDistance) {
      exitDistance = candidate
      exitNormalComponent = Math.abs(directionX)
    }
  }
  if (Math.abs(directionZ) > 0.000001) {
    const edgeDistance =
      directionZ > 0 ? bounds.maxZ - centreZ : centreZ - bounds.minZ
    const candidate = Math.max(edgeDistance, 0.001) / Math.abs(directionZ)
    if (candidate < exitDistance) {
      exitDistance = candidate
      exitNormalComponent = Math.abs(directionZ)
    }
  }
  if (!Number.isFinite(exitDistance)) exitDistance = 0

  const clearanceM = linarLightSurfaceClearanceM(state.radius)

  // Move beyond the box until the *shortest* plan distance back to its
  // surface equals the displayed clearance. Simply adding clearance along
  // the ray is only correct while one face is active; around a corner it can
  // put the source farther away than the control reports. Distance from an
  // AABB is monotonic along this centre-out ray, so a short binary solve is
  // both robust and inexpensive (one light is evaluated per frame).
  let radialMinimum = exitDistance
  let radialMaximum =
    exitDistance + clearanceM / Math.max(exitNormalComponent, 0.001)
  for (let iteration = 0; iteration < 36; iteration += 1) {
    const candidate = (radialMinimum + radialMaximum) * 0.5
    const x = centreX + directionX * candidate
    const z = centreZ + directionZ * candidate
    const outsideX = Math.max(bounds.minX - x, 0, x - bounds.maxX)
    const outsideZ = Math.max(bounds.minZ - z, 0, z - bounds.maxZ)
    if (Math.hypot(outsideX, outsideZ) < clearanceM) {
      radialMinimum = candidate
    } else {
      radialMaximum = candidate
    }
  }
  const radialDistance = (radialMinimum + radialMaximum) * 0.5
  out.x = centreX + directionX * radialDistance
  out.y = bounds.heightM * (linarLightHeightPercent(state.v) / 100)
  out.z = centreZ + directionZ * radialDistance
  return out
}
