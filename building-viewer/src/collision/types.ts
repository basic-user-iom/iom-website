import { Vector3 } from 'three'

export type CharacterParams = {
  playerHeight: number
  playerRadius: number
  eyeHeight: number
  walkSpeed: number
  runSpeed: number
  gravity: number
  maxSlope: number
  stepHeight: number
  groundSnapDistance: number
  /** Upward speed applied on jump (m/s). */
  jumpSpeed: number
}

export const DEFAULT_CHARACTER_PARAMS: CharacterParams = {
  playerHeight: 1.7,
  // Keep the capsule diameter within typical 0.28–0.30 m tread depth. A wider
  // capsule overlaps adjacent CAD risers and gets pushed sideways off stairs.
  playerRadius: 0.14,
  eyeHeight: 1.55,
  walkSpeed: 3.2,
  runSpeed: 6.5,
  gravity: 18,
  maxSlope: Math.cos((50 * Math.PI) / 180), // walkable inclines / stair nosings
  /** Max riser height the character can step onto (stairs / curbs). */
  stepHeight: 0.42,
  groundSnapDistance: 0.45,
  jumpSpeed: 6.2,
}

export type CollisionHit = {
  point: Vector3
  normal: Vector3
  distance: number
  /** Model layer that supplied the hit, when the backend can identify it. */
  layerId?: string
  /** Collision chunk/source label for diagnostics. */
  sourceName?: string
  /** True when the hit belongs to a stair/ramp collision chunk. */
  stairZone?: boolean
  /** Cross-layer circulation surface that must remain queryable without stair-volume logic. */
  layerBridge?: boolean
}

export type CapsuleQueryResult = {
  depth: number
  normal: Vector3
  /** True when the deepest contact is a stair / ramp chunk. */
  stairZone?: boolean
  /** Model layer that supplied the deepest contact. */
  layerId?: string
  /** Collision chunk/source label for diagnostics. */
  sourceName?: string
  /** Cross-layer circulation surface that must remain queryable without stair-volume logic. */
  layerBridge?: boolean
}

/**
 * Collision backend interface — BVH implementation now; Rapier can replace later.
 */
export interface ICollisionWorld {
  rebuild(fromRoot: import('three').Object3D): Promise<{ ms: number; triangles: number }>
  /**
   * Restrict locomotion queries to the layer selected by visible-surface
   * placement. `null` restores all-layer picking while orbiting/placing.
   */
  setQueryLayer?(layerId: string | null): void
  getQueryLayer?(): string | null
  raycast(origin: Vector3, direction: Vector3, maxDistance?: number): CollisionHit | null
  /**
   * Downward ground probe — among hits, prefer the highest walkable surface
   * (fixes dual-layer floors where a lower slab would otherwise win).
   */
  raycastBestGround?(
    origin: Vector3,
    maxDistance?: number,
    minUpDot?: number,
  ): CollisionHit | null
  /** Stair-chunk AABB containing this point (hollow flights still count). */
  stairWellAt?(x: number, y: number, z: number): { minY: number; maxY: number } | null
  capsuleIntersect(
    start: Vector3,
    end: Vector3,
    radius: number,
  ): CapsuleQueryResult | null
  dispose(): void
}

export type SpawnValidationResult = {
  ok: boolean
  reason?: string
  point?: Vector3
  normal?: Vector3
}
