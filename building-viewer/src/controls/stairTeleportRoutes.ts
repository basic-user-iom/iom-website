import { SURVEYED_STAIR_ROUTES } from './stairTeleportSurvey'
﻿import { Vector3 } from 'three'

export type StairTeleportRoute = {
  id: string
  label: string
  layerId: string
  bottom: readonly [number, number, number]
  top: readonly [number, number, number]
  /** Smaller circles fit the narrow wooden upper landings. */
  radius?: number
  bottomRadius?: number
  topRadius?: number
  bottomLayerId?: string
  topLayerId?: string
  /** Facing toward the stair from each landing; arrival faces back into that landing. */
  bottomYaw?: number
  topYaw?: number
  sourceObjects?: readonly string[]
}

/** Surveyed landing centres in the reviewed ICM model's rest pose, in metres. */
export const ICM_STAIR_TELEPORTS: readonly StairTeleportRoute[] = SURVEYED_STAIR_ROUTES

export const TELEPORT_RADIUS = 0.6
export const TELEPORT_HEIGHT_TOLERANCE = 0.22

export type StairPortal = {
  id: string
  route: StairTeleportRoute
  point: Vector3
  destination: Vector3
  arrivalYaw: number
  approachYaw: number
  radius: number
  up: boolean
  layerId: string
  destinationLayerId: string
  destinationRadius: number
}

export function stairPortals(routes: readonly StairTeleportRoute[]): StairPortal[] {
  return routes.flatMap(route => {
    const bottom = new Vector3(...route.bottom)
    const top = new Vector3(...route.top)
    const yaw = Math.atan2(bottom.x - top.x, bottom.z - top.z)
    const bottomRadius = route.bottomRadius ?? route.radius ?? TELEPORT_RADIUS
    const topRadius = route.topRadius ?? route.radius ?? TELEPORT_RADIUS
    const bottomYaw = route.bottomYaw ?? yaw
    const topYaw = route.topYaw ?? yaw + Math.PI
    return [
      { id: route.id + ':up', route, point: bottom, destination: top, arrivalYaw: topYaw + Math.PI, approachYaw: bottomYaw, radius: bottomRadius, up: true, layerId: route.bottomLayerId ?? route.layerId, destinationLayerId: route.topLayerId ?? route.layerId, destinationRadius: topRadius },
      { id: route.id + ':down', route, point: top, destination: bottom, arrivalYaw: bottomYaw + Math.PI, approachYaw: topYaw, radius: topRadius, up: false, layerId: route.topLayerId ?? route.layerId, destinationLayerId: route.bottomLayerId ?? route.layerId, destinationRadius: bottomRadius },
    ]
  })
}

/** Edge-triggered zones, with exit hysteresis instead of a timer that can bounce. */
export class StairTeleportGate {
  private occupied = new Set<string>()

  blockAt(feet: Vector3, portals: readonly StairPortal[]): void {
    this.occupied.clear()
    for (const portal of portals) if (this.contains(portal, feet, 0.25)) this.occupied.add(portal.id)
  }

  private contains(portal: StairPortal, feet: Vector3, margin = 0): boolean {
    return Math.abs(feet.y - portal.point.y) <= TELEPORT_HEIGHT_TOLERANCE + margin &&
      Math.hypot(feet.x - portal.point.x, feet.z - portal.point.z) <= portal.radius + margin
  }

  update(feet: Vector3, grounded: boolean, portals: readonly StairPortal[]): StairPortal | null {
    for (const id of this.occupied) {
      const portal = portals.find(p => p.id === id)
      if (!portal || !this.contains(portal, feet, 0.25)) this.occupied.delete(id)
    }
    if (!grounded) return null
    for (const portal of portals) {
      if (!this.occupied.has(portal.id) && this.contains(portal, feet)) {
        // A rejected destination must not be retried every frame while standing still.
        this.occupied.add(portal.id)
        return portal
      }
    }
    return null
  }
}
