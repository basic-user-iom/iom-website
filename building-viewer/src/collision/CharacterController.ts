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
const DESCENT_GUARD_STEPS = 36

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
  private volumeClimbLock = 0
  private readonly volumeClimbDirection = new Vector3()
  private descentGuard = 0
  private readonly descentDirection = new Vector3()
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
    // A teleport/drop must earn grounding again at the new location. Keeping
    // the previous floor's state lets callers observe "grounded" before the
    // first simulation frame has snapped and visually synced the new pose.
    this.onGround = false
    this.accumulator = 0
    this.jumpQueued = false
    this.climbScore = 0
    this.climbLock = 0
    this.resetVolumeClimb()
    this.resetDescentGuard()
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
    if (moving && this.descentGuard > 0) {
      this.descentGuard -= 1
      if (this.descentGuard === 0) this.descentDirection.set(0, 0, 0)
    }

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
      if (
        missed ||
        this.detectStepAhead(_before, _tmp) ||
        (inWell && this.volumeClimbLock > 0)
      ) {
        const moveLength = Math.hypot(_tmp.x, _tmp.z)
        const continuingVolumeAscent =
          this.volumeClimbLock > 0 &&
          moveLength > 1e-8 &&
          (_tmp.x * this.volumeClimbDirection.x + _tmp.z * this.volumeClimbDirection.z) /
            moveLength >
            0.55
        const reversingVolumeAscent =
          this.volumeClimbLock > 0 &&
          this.volumeClimbDirection.lengthSq() > 0.5 &&
          !continuingVolumeAscent
        const continuingDescent =
          this.descentGuard > 0 &&
          moveLength > 1e-8 &&
          (_tmp.x * this.descentDirection.x + _tmp.z * this.descentDirection.z) /
            moveLength >
            0.55
        if (this.descentGuard > 0 && !continuingDescent) this.resetDescentGuard()
        // A latched solid-stair climb has a reliable travel direction. Reject
        // an upper lip immediately when input reverses; normal ascent must
        // still be allowed to test the next positive-rise tread first.
        if (reversingVolumeAscent) this.latchDescent(_tmp)
        const knownDescending = continuingDescent || reversingVolumeAscent
        if (knownDescending) this.resetVolumeClimb()

        if (!knownDescending && this.tryStepUp(_before, _tmp, missed)) {
          this.resetVolumeClimb()
          if (this.velocity.y < 0) this.velocity.y = 0
          this.onGround = true
          this.climbScore = Math.min(1.5, this.climbScore + 0.85)
          this.climbLock = 10
          this.snapToGround()
          this.updateStairsIntent(moving)
          return
        }
        // Solid CAD risers may need a short volume fallback. Never start it from
        // AABB membership alone: landings and descending routes share that AABB.
        // While bridging an oversized stair-only riser, the lower base floor
        // remains visible to downward probes. It is not a descent request when
        // input is still aligned with the latched ascent direction.
        const probedDescending =
          !continuingVolumeAscent &&
          !knownDescending &&
          this.hasDescendingTread(_before, _tmp)
        if (probedDescending) this.latchDescent(_tmp)
        const descending = continuingVolumeAscent
          ? false
          : knownDescending || probedDescending
        const canVolume =
          !descending &&
          Boolean(
            (missed && wallHit?.stairZone) ||
              (continuingVolumeAscent && inWell),
          )
        if (canVolume) {
          // Cross-layer solid stair volumes must own the grounding query before
          // the fallback performs its internal snap; otherwise the old layer's
          // floor immediately pulls the successful climb back to its base.
          const previousLayer = world.getQueryLayer?.() ?? null
          if (wallHit?.layerId) world.setQueryLayer?.(wallHit.layerId)
          if (this.tryStairVolumeClimb(_before, _tmp, dt, well)) {
            this.updateStairsIntent(moving)
            return
          }
          if (wallHit?.layerId && wallHit.layerId !== previousLayer) {
            world.setQueryLayer?.(previousLayer)
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
    if (this.volumeClimbLock > 0) {
      this.volumeClimbLock -= 1
      if (this.volumeClimbLock === 0) this.volumeClimbDirection.set(0, 0, 0)
    }
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
    const moveLen = Math.hypot(moveXZ.x, moveXZ.z)
    if (moveLen < 1e-8) return false
    const nx = moveXZ.x / moveLen
    const nz = moveXZ.z / moveLen
    if (this.volumeClimbLock > 0 && this.volumeClimbDirection.lengthSq() > 0.5) {
      const alignment = nx * this.volumeClimbDirection.x + nz * this.volumeClimbDirection.z
      if (alignment < 0.55) {
        // Reversing or crossing a flight must use ordinary ground snap. The
        // volume fallback has no tread geometry from which to infer descent.
        this.resetVolumeClimb()
        return false
      }
    }
    const climb = Math.min(p.stepHeight, 3.6 * dt)
    let nextY = from.y + climb
    if (well) nextY = Math.min(nextY, well.maxY)
    this.position.set(from.x + moveXZ.x, nextY, from.z + moveXZ.z)

    _origin.set(this.position.x, this.position.y + p.playerHeight * 0.55, this.position.z)
    const headHit = world.raycast(_origin, _up, p.playerHeight * 0.5)
    if (
      headHit &&
      !headHit.stairZone &&
      headHit.distance > 0.05 &&
      headHit.distance < 0.28
    ) {
      this.position.copy(from)
      return false
    }

    this.volumeClimbDirection.set(nx, 0, nz)
    this.volumeClimbLock = 12
    this.climbLock = 12
    this.onGround = true
    this.velocity.y = 0
    this.climbScore = Math.min(1.6, this.climbScore + 0.35)
    this.snapToGround()
    return true
  }

  /** True when a lower tread is present in the requested travel direction. */
  private hasDescendingTread(from: Vector3, moveXZ: Vector3): boolean {
    const world = this.world
    if (!world) return false
    const p = this.params
    const len = Math.hypot(moveXZ.x, moveXZ.z)
    if (len < 1e-8) return false
    const nx = moveXZ.x / len
    const nz = moveXZ.z / len
    const forwards = [
      Math.max(len, p.playerRadius * 0.9, 0.16),
      Math.max(p.playerRadius * 1.35, 0.24),
      Math.max(p.playerRadius * 2.0, 0.36),
    ]
    const maxDrop = p.stepHeight + p.groundSnapDistance + 0.1
    let descendingProbes = 0
    for (const forward of forwards) {
      // Start below the next ascending riser. A probe launched above the whole
      // step range can select the higher/current tread first while travelling
      // downhill, hiding the lower tread and restarting the volume-ascent
      // fallback from the back side of a stair.
      _stepProbe.set(from.x + nx * forward, from.y + 0.08, from.z + nz * forward)
      const probeDistance = maxDrop + 0.2
      const ground =
        world.raycastBestGround?.(_stepProbe, probeDistance, p.maxSlope) ??
        world.raycast(_stepProbe, _down, probeDistance)
      if (!ground) continue
      let normal = ground.normal
      if (normal.dot(_up) < 0) normal = _nflip.copy(normal).negate()
      if (normal.dot(_up) < p.maxSlope) continue
      const rise = ground.point.y - from.y
      // Imported CAD treads contain narrow seams where one ray can land a few
      // centimetres below its neighbours. Treating that single sample as a
      // descent permanently suppresses step-up on oblique auditorium aisles.
      // A real downhill route remains visible to multiple forward probes.
      if (rise < -0.025 && rise >= -maxDrop) {
        descendingProbes += 1
        if (descendingProbes >= 2) return true
      }
    }
    return false
  }

  private resetVolumeClimb(): void {
    this.volumeClimbLock = 0
    this.volumeClimbDirection.set(0, 0, 0)
  }

  private latchDescent(moveXZ: Vector3): void {
    const length = Math.hypot(moveXZ.x, moveXZ.z)
    if (length < 1e-8) return
    this.descentDirection.set(moveXZ.x / length, 0, moveXZ.z / length)
    this.descentGuard = DESCENT_GUARD_STEPS
  }

  private resetDescentGuard(): void {
    this.descentGuard = 0
    this.descentDirection.set(0, 0, 0)
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
    if (dy > 0.012) {
      this.resetDescentGuard()
      this.climbScore = Math.min(1.6, this.climbScore + 0.45)
    } else if (dy < -0.012) {
      this.latchDescent(this.velocity)
      this.climbScore = Math.max(-1.6, this.climbScore - 0.45)
    }
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
    // Only pre-emptively climb a tread within the capsule's immediate reach.
    // Far probes are useful after an actual collision (tryStepUp still has
    // them), but using them here lets every frame skip to the following tread.
    const lookDistances = [Math.max(len, p.playerRadius * 0.9, 0.16)]
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

  private tryStepUp(from: Vector3, moveXZ: Vector3, allowForwardSnap = false): boolean {
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
    const maxAdvance = allowForwardSnap ? Math.max(moveLen, 0.08) : moveLen

    let best: {
      x: number
      y: number
      z: number
      rise: number
      layerId?: string
    } | null = null

    for (const forward of forwards) {
      // Raising the capsule is safe only when its footprint can already reach
      // the probed tread after the capped horizontal move.
      if (forward - maxAdvance > p.playerRadius + 0.03) continue
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
      if (
        headHit &&
        !headHit.stairZone &&
        headHit.distance > 0.06 &&
        headHit.distance < 0.35
      ) {
        log(`head clearance ${headHit.distance.toFixed(3)}`)
        continue
      }

      if (!best || rise < best.rise - 0.01) {
        best = {
          x: ground.point.x,
          y: ground.point.y,
          z: ground.point.z,
          rise,
          layerId: ground.layerId,
        }
      }
    }

    if (!best) return false

    // The probe identifies the height of the next tread. During ordinary
    // look-ahead, keep horizontal travel limited to this frame's requested
    // motion. A collider that has actually blocked that motion may require a
    // one-off placement onto the tread to clear malformed CAD risers.
    const probedAdvance = Math.hypot(best.x - from.x, best.z - from.z)
    const advance = Math.min(probedAdvance, maxAdvance)
    const nextX = from.x + nx * advance
    const nextZ = from.z + nz * advance
    // The candidate's probe position can be ahead of the capped placement.
    // Re-check the actual capsule location so a low beam behind the tread does
    // not get bypassed by the successful-step early return.
    _origin.set(nextX, best.y + 0.18, nextZ)
    const placementHeadHit = world.raycast(_origin, _up, Math.max(0.55, p.playerHeight - 0.25))
    if (
      placementHeadHit &&
      !placementHeadHit.stairZone &&
      placementHeadHit.distance > 0.06 &&
      placementHeadHit.distance < 0.35
    ) {
      log(`placement head clearance ${placementHeadHit.distance.toFixed(3)}`)
      return false
    }
    // Commit cross-layer ownership only after all placement checks pass.
    // Resolving the capsule against solid stair CAD would undo the climb.
    if (best.layerId) world.setQueryLayer?.(best.layerId)
    this.position.set(nextX, best.y, nextZ)
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
    // Ordinary grounding must begin just above the feet. Starting every probe
    // a full step higher lets an overhanging/offset auditorium tread hide the
    // valid lower approach floor, leaving the capsule airborne underneath it.
    // A short-lived climb lock may still look across the full step height so a
    // successful step/solid-volume climb can stay attached to its next tread.
    const probeLift = this.climbLock > 0 ? p.stepHeight + 0.05 : 0.05
    _origin.set(this.position.x, this.position.y + probeLift, this.position.z)
    const searchDist = probeLift + p.groundSnapDistance + 0.25
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
            if (hit.layerId) world.setQueryLayer?.(hit.layerId)
          }
          this.onGround = true
          return
        }
        if (gap >= -0.05 && gap <= p.groundSnapDistance) {
          this.position.y = feetY
          if (this.velocity.y < 0) this.velocity.y = 0
          this.onGround = true
          if (hit.layerId) world.setQueryLayer?.(hit.layerId)
          return
        }
        // A surface above the feet is an obstruction, not ground. The former
        // one-sided comparison marked any negative gap (even metres) grounded.
        this.onGround = gap >= -0.05 && gap <= 0.08
        if (this.onGround && hit.layerId) world.setQueryLayer?.(hit.layerId)
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
