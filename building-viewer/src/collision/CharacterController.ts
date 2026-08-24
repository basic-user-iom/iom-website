import { Vector3, Euler } from 'three'
import type { ICollisionWorld, SpawnValidationResult, CapsuleQueryResult } from './types'
import { DEFAULT_CHARACTER_PARAMS, type CharacterParams } from './types'

const _down = new Vector3(0, -1, 0)
const _up = new Vector3(0, 1, 0)
const _origin = new Vector3()
const _start = new Vector3()
const _end = new Vector3()
const _wish = new Vector3()
const _vel = new Vector3()
const _tmp = new Vector3()
const _before = new Vector3()
const _flat = new Vector3()
const _stepProbe = new Vector3()
const _nflip = new Vector3()

const FIXED_DT = 1 / 60
const MAX_SUBSTEPS = 3

export class CharacterController {
  params: CharacterParams
  readonly position = new Vector3()
  readonly velocity = new Vector3()
  yaw = 0
  pitch = 0
  onGround = false
  /**
   * Stair locomotion hint for animation:
   * 1 = ascending, -1 = descending, 0 = flat.
   */
  stairsIntent: -1 | 0 | 1 = 0
  /** When true, logs step-up rejection reasons (use ?collisionDebug=1). */
  debugSteps = false
  private world: ICollisionWorld | null = null
  private accumulator = 0
  private jumpQueued = false
  private climbScore = 0
  private climbLock = 0
  private prevFeetY = 0
  private prevFeetYValid = false

  constructor(params: Partial<CharacterParams> = {}) {
    this.params = { ...DEFAULT_CHARACTER_PARAMS, ...params }
  }

  setWorld(world: ICollisionWorld | null): void {
    this.world = world
  }

  setParams(partial: Partial<CharacterParams>): void {
    this.params = { ...this.params, ...partial }
  }

  /** Queue a jump for the next simulation step (only applies when grounded). */
  requestJump(): void {
    this.jumpQueued = true
  }

  /** Feet position. */
  setFeetPosition(feet: Vector3, yaw?: number): void {
    this.position.copy(feet)
    if (yaw != null) this.yaw = yaw
    this.velocity.set(0, 0, 0)
    this.accumulator = 0
    this.jumpQueued = false
    this.climbScore = 0
    this.climbLock = 0
    this.stairsIntent = 0
    this.prevFeetY = feet.y
    this.prevFeetYValid = true
  }

  getEyePosition(out = new Vector3()): Vector3 {
    return out.set(
      this.position.x,
      this.position.y + this.params.eyeHeight,
      this.position.z,
    )
  }

  getCapsule(outStart = new Vector3(), outEnd = new Vector3()): { start: Vector3; end: Vector3; radius: number } {
    const r = this.params.playerRadius
    const h = Math.max(this.params.playerHeight, r * 2 + 0.05)
    outStart.set(this.position.x, this.position.y + r, this.position.z)
    outEnd.set(this.position.x, this.position.y + h - r, this.position.z)
    return { start: outStart, end: outEnd, radius: r }
  }

  /**
   * Fixed-step integration for stable walking during frame spikes.
   * wishDir should be unit xz in world space; speed already includes walk/run.
   */
  update(dt: number, wishDir: Vector3, speed: number): void {
    this.accumulator += Math.min(dt, 0.05)
    let steps = 0
    while (this.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.step(FIXED_DT, wishDir, speed)
      this.accumulator -= FIXED_DT
      steps += 1
    }
    if (this.accumulator > FIXED_DT) this.accumulator = 0
  }

  private step(dt: number, wishDir: Vector3, speed: number): void {
    const world = this.world
    const p = this.params

    _wish.set(wishDir.x, 0, wishDir.z)
    if (_wish.lengthSq() > 1e-6) _wish.normalize().multiplyScalar(speed)
    else _wish.set(0, 0, 0)

    this.velocity.x = _wish.x
    this.velocity.z = _wish.z

    if (this.jumpQueued && this.onGround) {
      this.velocity.y = p.jumpSpeed
      this.onGround = false
      this.jumpQueued = false
    } else {
      this.jumpQueued = false
      this.velocity.y -= p.gravity * dt
    }

    _tmp.set(this.velocity.x * dt, 0, this.velocity.z * dt)
    const moving = _tmp.lengthSq() > 1e-10

    _before.copy(this.position)
    this.position.add(_tmp)
    const wallHit = this.resolveCollisions(true)
    _flat.copy(this.position)

    // Classic step-up: blocked motion or a tread detected ahead.
    if (moving && this.onGround && world && p.stepHeight > 0) {
      const missed =
        Math.hypot(this.position.x - (_before.x + _tmp.x), this.position.z - (_before.z + _tmp.z)) >
        0.002
      const well = world.stairWellAt?.(_before.x, _before.y, _before.z)
      const inWell = Boolean(well && _before.y < well.maxY - 0.12)
      if (missed || this.detectStepAhead(_before, _tmp) || this.climbLock > 0 || inWell) {
        if (this.tryStepUp(_before, _tmp)) {
          if (this.velocity.y < 0) this.velocity.y = 0
          this.onGround = true
          this.climbScore = Math.min(1.5, this.climbScore + 0.85)
          this.climbLock = 10
          this.snapToGround()
          this.updateStairsIntent(moving)
          return
        }
        // Hollow U-stair wells (foyer Mesh2148) often don't block XZ — still climb.
        const canVolume =
          inWell ||
          (missed && (wallHit?.stairZone || this.climbLock > 0 || this.hasClimbableTread()))
        if (canVolume) {
          if (this.tryStairVolumeClimb(_before, _tmp, dt, well)) {
            this.updateStairsIntent(moving)
            return
          }
        }
        this.position.copy(_flat)
      }
    }

    this.position.y += this.velocity.y * dt
    this.resolveCollisions(false)
    this.snapToGround()
    this.updateStairsIntent(moving)
    if (this.climbLock > 0) this.climbLock -= 1
  }

  /**
   * Interior CAD stairs are often one solid volume with no tread tops.
   * Keep forward motion and rise until a landing / ramp catches us.
   */
  private tryStairVolumeClimb(
    from: Vector3,
    moveXZ: Vector3,
    dt: number,
    well?: { minY: number; maxY: number } | null,
  ): boolean {
    const world = this.world
    if (!world) return false
    const p = this.params
    const climb = Math.min(p.stepHeight, 3.6 * dt)
    let nextY = from.y + climb
    if (well) nextY = Math.min(nextY, well.maxY)
    this.position.set(from.x + moveXZ.x, nextY, from.z + moveXZ.z)

    _origin.set(this.position.x, this.position.y + p.playerHeight * 0.55, this.position.z)
    const headHit = world.raycast(_origin, _up, p.playerHeight * 0.5)
    if (headHit && headHit.distance > 0.05 && headHit.distance < 0.28) {
      this.position.copy(from)
      return false
    }

    this.climbLock = 12
    this.onGround = true
    this.velocity.y = 0
    this.climbScore = Math.min(1.6, this.climbScore + 0.35)
    this.snapToGround()
    return true
  }

  /** True when a walkable tread exists under/just ahead of the capsule. */
  private hasClimbableTread(): boolean {
    const world = this.world
    if (!world) return false
    const p = this.params
    _stepProbe.set(this.position.x, this.position.y + p.stepHeight + 0.1, this.position.z)
    const ground =
      world.raycastBestGround?.(_stepProbe, p.stepHeight + 0.35, p.maxSlope) ??
      world.raycast(_stepProbe, _down, p.stepHeight + 0.35)
    if (!ground) return false
    let normal = ground.normal
    if (normal.dot(_up) < 0) normal = _nflip.copy(normal).negate()
    if (normal.dot(_up) < p.maxSlope) return false
    const rise = ground.point.y - this.position.y
    return rise > 0.02 && rise <= p.stepHeight + 0.04
  }

  private updateStairsIntent(moving: boolean): void {
    if (!this.onGround || !moving) {
      this.climbScore *= 0.75
      if (Math.abs(this.climbScore) < 0.2) this.climbScore = 0
      this.stairsIntent = 0
      this.prevFeetY = this.position.y
      this.prevFeetYValid = true
      return
    }
    if (!this.prevFeetYValid) {
      this.prevFeetY = this.position.y
      this.prevFeetYValid = true
      return
    }
    const dy = this.position.y - this.prevFeetY
    this.prevFeetY = this.position.y
    if (dy > 0.012) this.climbScore = Math.min(1.6, this.climbScore + 0.45)
    else if (dy < -0.012) this.climbScore = Math.max(-1.6, this.climbScore - 0.45)
    else this.climbScore *= 0.88

    if (this.climbScore > 0.35) this.stairsIntent = 1
    else if (this.climbScore < -0.35) this.stairsIntent = -1
    else this.stairsIntent = 0
  }

  private detectStepAhead(from: Vector3, moveXZ: Vector3): boolean {
    const world = this.world
    if (!world) return false
    const p = this.params
    const len = Math.hypot(moveXZ.x, moveXZ.z)
    if (len < 1e-8) return false
    const nx = moveXZ.x / len
    const nz = moveXZ.z / len
    const lookDistances = [
      Math.max(p.playerRadius * 1.15, 0.2),
      Math.max(p.playerRadius * 2.0, 0.36),
      Math.max(p.playerRadius * 2.8, 0.5),
    ]
    for (const look of lookDistances) {
      _stepProbe.set(from.x + nx * look, from.y + p.stepHeight + 0.12, from.z + nz * look)
      const ground =
        world.raycastBestGround?.(_stepProbe, p.stepHeight + 0.4, p.maxSlope) ??
        world.raycast(_stepProbe, _down, p.stepHeight + 0.4)
      if (!ground) continue
      let normal = ground.normal
      if (normal.dot(_up) < 0) normal = _nflip.copy(normal).negate()
      if (normal.dot(_up) < p.maxSlope) continue
      const rise = ground.point.y - from.y
      if (rise > 0.025 && rise <= p.stepHeight + 0.04) return true
    }
    return false
  }

  private tryStepUp(from: Vector3, moveXZ: Vector3): boolean {
    const world = this.world
    if (!world) return false
    const p = this.params
    const log = (reason: string) => {
      if (this.debugSteps) console.info(`[StepUp] reject: ${reason}`)
    }

    const moveLen = Math.hypot(moveXZ.x, moveXZ.z)
    if (moveLen < 1e-8) return false
    const nx = moveXZ.x / moveLen
    const nz = moveXZ.z / moveLen
    const forwards = [
      Math.max(moveLen, p.playerRadius * 0.9, 0.16),
      Math.max(p.playerRadius * 1.35, 0.24),
      Math.max(p.playerRadius * 2.0, 0.36),
      Math.max(p.playerRadius * 2.7, 0.48),
    ]

    let best: { x: number; y: number; z: number; rise: number } | null = null

    for (const forward of forwards) {
      // Cast from above so we hit the tread, not the vertical riser / solid CAD face.
      _stepProbe.set(from.x + nx * forward, from.y + p.stepHeight + 0.12, from.z + nz * forward)
      const ground =
        world.raycastBestGround?.(_stepProbe, p.stepHeight + 0.45, p.maxSlope) ??
        world.raycast(_stepProbe, _down, p.stepHeight + 0.45)
      if (!ground) {
        log(`no tread @ fwd=${forward.toFixed(2)}`)
        continue
      }

      let normal = ground.normal
      if (normal.dot(_up) < 0) normal = _nflip.copy(normal).negate()
      if (normal.dot(_up) < p.maxSlope) {
        log(`slope ${normal.dot(_up).toFixed(3)}`)
        continue
      }

      const rise = ground.point.y - from.y
      if (rise < 0.025 || rise > p.stepHeight + 0.04) {
        log(`rise ${rise.toFixed(3)} (stepHeight ${p.stepHeight})`)
        continue
      }

      _origin.set(ground.point.x, ground.point.y + 0.18, ground.point.z)
      const headHit = world.raycast(_origin, _up, Math.max(0.55, p.playerHeight - 0.25))
      if (headHit && headHit.distance > 0.06 && headHit.distance < 0.35) {
        log(`head clearance ${headHit.distance.toFixed(3)}`)
        continue
      }

      if (!best || rise < best.rise - 0.01) {
        best = { x: ground.point.x, y: ground.point.y, z: ground.point.z, rise }
      }
    }

    if (!best) return false

    // Place on the tread. Resolving the capsule against solid stair CAD undoes the climb.
    this.position.set(best.x, best.y, best.z)
    this.onGround = true
    if (this.debugSteps) console.info(`[StepUp] ok rise=${best.rise.toFixed(3)}`)
    return true
  }

  private snapToGround(): void {
    const world = this.world
    if (!world) {
      this.onGround = false
      return
    }
    if (this.velocity.y > 0.5) {
      this.onGround = false
      return
    }
    const p = this.params
    _origin.set(this.position.x, this.position.y + p.stepHeight + 0.05, this.position.z)
    const searchDist = p.stepHeight + p.groundSnapDistance + 0.25
    const hit =
      world.raycastBestGround?.(_origin, searchDist, p.maxSlope) ??
      world.raycast(_origin, _down, searchDist)
    if (hit) {
      let normal = hit.normal
      if (normal.dot(_up) < 0) normal = _nflip.copy(normal).negate()
      if (normal.dot(_up) >= p.maxSlope) {
        const feetY = hit.point.y
        const gap = this.position.y - feetY
        if (this.climbLock > 0) {
          // Stick only to a surface within a few cm of the feet — never pull
          // down onto the floor slab under a hollow stair well (volume climb).
          if (feetY >= this.position.y - 0.05 && feetY <= this.position.y + 0.12) {
            this.position.y = feetY
            if (this.velocity.y < 0) this.velocity.y = 0
          }
          this.onGround = true
          return
        }
        if (gap >= -0.05 && gap <= p.groundSnapDistance) {
          this.position.y = feetY
          if (this.velocity.y < 0) this.velocity.y = 0
          this.onGround = true
          return
        }
        this.onGround = gap <= 0.08
        return
      }
    }
    if (this.climbLock > 0) {
      this.onGround = true
      return
    }
    this.onGround = false
  }

  private resolveCollisions(horizontalOnly: boolean): CapsuleQueryResult | null {
    const world = this.world
    if (!world) return null
    const { start, end, radius } = this.getCapsule(_start, _end)
    const iterations = horizontalOnly ? 3 : 2
    let last: CapsuleQueryResult | null = null
    for (let i = 0; i < iterations; i++) {
      const hit = world.capsuleIntersect(start, end, radius)
      if (!hit || hit.depth <= 0) break
      last = hit
      _vel.copy(hit.normal)
      if (horizontalOnly) {
        if (hit.normal.y > 0.55) break
        if (hit.stairZone && this.climbLock > 0) break
        if (hit.normal.y < 0.35 && this.onGround && this.hasClimbableTread()) break
        _vel.y = 0
        if (_vel.lengthSq() < 1e-8) break
        _vel.normalize()
      }
      this.position.addScaledVector(_vel, hit.depth + 0.002)
      start.addScaledVector(_vel, hit.depth + 0.002)
      end.addScaledVector(_vel, hit.depth + 0.002)
      if (!horizontalOnly && hit.normal.y > 0.3 && this.velocity.y < 0) {
        this.velocity.y = 0
      }
    }
    return last
  }

  lookDelta(dx: number, dy: number, sensitivity = 0.0022): void {
    this.yaw -= dx * sensitivity
    this.pitch -= dy * sensitivity
    const limit = Math.PI / 2 - 0.05
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch))
  }

  getLookEuler(out = new Euler()): Euler {
    return out.set(this.pitch, this.yaw, 0, 'YXZ')
  }
}

export function isValidSpawnPoint(
  world: ICollisionWorld,
  hitPoint: Vector3,
  hitNormal: Vector3,
  params: CharacterParams,
  objectName = '',
): SpawnValidationResult {
  if (/^NO_WALK_/i.test(objectName)) {
    return { ok: false, reason: 'Surface marked NO_WALK_' }
  }

  const normal = hitNormal.dot(_up) < 0 ? hitNormal.clone().negate() : hitNormal.clone()

  const upDot = normal.dot(_up)
  if (upDot < params.maxSlope) {
    return { ok: false, reason: 'Surface too steep' }
  }

  const feet = hitPoint.clone()

  const clearOrigin = _origin.set(feet.x, feet.y + params.playerRadius + 0.05, feet.z)
  const headHit = world.raycast(clearOrigin, _up, params.playerHeight)
  if (headHit && headHit.distance < params.playerHeight * 0.55) {
    return { ok: false, reason: 'Insufficient head clearance' }
  }

  const r = params.playerRadius
  const h = params.playerHeight
  _start.set(feet.x, feet.y + r + 0.04, feet.z)
  _end.set(feet.x, feet.y + h - r, feet.z)
  const blocked = world.capsuleIntersect(_start, _end, r * 0.9)
  if (blocked && blocked.depth > r * 0.35 && blocked.normal.y < 0.45) {
    return { ok: false, reason: 'Intersects geometry' }
  }

  return {
    ok: true,
    point: feet,
    normal,
  }
}
