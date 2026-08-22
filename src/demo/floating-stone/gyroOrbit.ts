/**
 * Relative Arcball Orbit Tool
 *
 * Unusual pattern (not plain Euler α/β/γ → rotation):
 * Treat the phone as a handheld virtual trackball. Relative tilt from a
 * calibrated rest pose is projected onto a unit sphere (Shoemake Arcball,
 * 1992). The stone follows the great-circle rotation from rest → current
 * sphere point. A deadzone + spring return (Kratz-style tilt UX) keeps it
 * calm when the hand is still; excess tilt is soft-clamped.
 *
 * Inspiration:
 * - Ken Shoemake, ARCBALL (1992) / virtual trackball taxonomy
 * - Kratz et al., tilt-based object navigation with deadzone + proportional feel
 * - Gyro-enabled OrbitControls (Novak UM demo) — orbit around a target via tilt
 * - CAD “orientation mouse” — device pose rotates the model, not the camera
 */

export type GyroOrbitStatus =
  | 'unsupported'
  | 'needs-permission'
  | 'ready'
  | 'active'
  | 'denied'

export type GyroOrbitSample = {
  /** Arcball-derived pitch (X), radians — applied on top of idle motion */
  pitch: number
  /** Arcball-derived yaw (Y), radians */
  yaw: number
  /** Subtle roll (Z), radians */
  roll: number
  /** 0–1 how far the phone is from the rest pose (for UI) */
  engagement: number
  /** True once we have a live filtered sample */
  live: boolean
}

export const GYRO_ORBIT = {
  /** Soft clamp of relative tilt before sphere projection (degrees). */
  maxTiltDeg: 38,
  /** Deadzone around rest pose (degrees) — ignore micro-jitter. */
  deadzoneDeg: 3.2,
  /** How strongly the stone follows the arcball (radians at full tilt). */
  pitchGain: 0.72,
  yawGain: 0.95,
  rollGain: 0.18,
  /** Exponential filter rates (higher = snappier). */
  followLerp: 5.4,
  springLerp: 2.1,
  /** Seconds of near-rest before spring return engages fully. */
  idleSettle: 0.55,
  /** Reduced-motion scales all gains. */
  reducedMotionScale: 0.22,
  /** Recalibrate if phone orientation jumps hard (screen rotate / pocket). */
  recalibrateJumpDeg: 55,
} as const

type DeviceOrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export function deviceOrientationPermissionRequired(): boolean {
  if (typeof DeviceOrientationEvent === 'undefined') return false
  const ctor = DeviceOrientationEvent as DeviceOrientationConstructor
  return typeof ctor.requestPermission === 'function'
}

export function canOfferGyroOrbit(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof DeviceOrientationEvent === 'undefined') return false
  // Prefer coarse / touch devices; desktop with fine pointer keeps mouse parallax.
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const noHover = window.matchMedia('(hover: none)').matches
  const narrow = window.matchMedia('(max-width: 900px)').matches
  return coarse || noHover || narrow
}

export async function requestGyroPermission(): Promise<'granted' | 'denied'> {
  const ctor = DeviceOrientationEvent as DeviceOrientationConstructor
  if (typeof ctor.requestPermission !== 'function') return 'granted'
  try {
    return await ctor.requestPermission()
  } catch {
    return 'denied'
  }
}

/** Project relative tilt onto the unit hemisphere (arcball). */
export function tiltToArcball(
  dBetaDeg: number,
  dGammaDeg: number,
  maxTiltDeg: number,
): { x: number; y: number; z: number; engagement: number } {
  const inv = 1 / Math.max(maxTiltDeg, 1e-3)
  let x = THREE_CLAMP(dGammaDeg * inv, -1, 1)
  let y = THREE_CLAMP(-dBetaDeg * inv, -1, 1)
  const r2 = x * x + y * y
  let z: number
  if (r2 <= 1) {
    z = Math.sqrt(1 - r2)
  } else {
    const s = 1 / Math.sqrt(r2)
    x *= s
    y *= s
    z = 0
  }
  // Chord length from rest (0,0,1) ≈ engagement.
  const engagement = Math.min(1, Math.hypot(x, y, z - 1) / Math.SQRT2)
  return { x, y, z, engagement }
}

function THREE_CLAMP(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function applyDeadzone(valueDeg: number, deadzoneDeg: number): number {
  const a = Math.abs(valueDeg)
  if (a <= deadzoneDeg) return 0
  const signed = valueDeg < 0 ? -1 : 1
  return signed * (a - deadzoneDeg)
}

/**
 * Mutable filter state owned by the App and read by FloatingStone each frame.
 */
export type GyroOrbitController = {
  status: GyroOrbitStatus
  sample: GyroOrbitSample
  /** Call from useFrame — advances filters with dt. */
  tick: (dt: number, reducedMotion: boolean) => void
  /** Feed a raw deviceorientation reading. */
  pushOrientation: (beta: number | null, gamma: number | null, absolute?: boolean) => void
  /** Reset baseline to the current orientation. */
  recalibrate: () => void
  setStatus: (status: GyroOrbitStatus) => void
  enableListening: () => void
  disableListening: () => void
  dispose: () => void
}

export function createGyroOrbitController(): GyroOrbitController {
  let status: GyroOrbitStatus = 'unsupported'
  let listening = false
  let hasBase = false
  let baseBeta = 0
  let baseGamma = 0
  let rawBeta = 0
  let rawGamma = 0
  let hasRaw = false
  let idleTimer = 0
  let targetPitch = 0
  let targetYaw = 0
  let targetRoll = 0
  let targetEngage = 0
  let pitch = 0
  let yaw = 0
  let roll = 0
  let engagement = 0
  let live = false

  const sample: GyroOrbitSample = {
    pitch: 0,
    yaw: 0,
    roll: 0,
    engagement: 0,
    live: false,
  }

  const syncSample = () => {
    sample.pitch = pitch
    sample.yaw = yaw
    sample.roll = roll
    sample.engagement = engagement
    sample.live = live
  }

  const recomputeTargets = (reducedMotion: boolean) => {
    if (!hasRaw || !hasBase) {
      targetPitch = 0
      targetYaw = 0
      targetRoll = 0
      targetEngage = 0
      return
    }

    let dBeta = applyDeadzone(rawBeta - baseBeta, GYRO_ORBIT.deadzoneDeg)
    let dGamma = applyDeadzone(rawGamma - baseGamma, GYRO_ORBIT.deadzoneDeg)

    // Soft clamp before sphere map so extremes don't hard-stop.
    const soft = GYRO_ORBIT.maxTiltDeg
    dBeta = soft * Math.tanh(dBeta / soft)
    dGamma = soft * Math.tanh(dGamma / soft)

    const ball = tiltToArcball(dBeta, dGamma, soft)
    // Great-circle from rest (0,0,1) → (x,y,z): axis = rest × p, angle = acos(dot).
    // For rest = +Z, axis = (-y, x, 0), angle = acos(z).
    const angle = Math.acos(THREE_CLAMP(ball.z, -1, 1))
    const axisLen = Math.hypot(ball.x, ball.y)
    const scale = reducedMotion ? GYRO_ORBIT.reducedMotionScale : 1

    if (axisLen > 1e-5 && angle > 1e-5) {
      const ax = -ball.y / axisLen
      const ay = ball.x / axisLen
      // Map arcball rotation into stone pitch/yaw (object stays upright-ish via small roll).
      targetPitch = ax * angle * GYRO_ORBIT.pitchGain * scale
      targetYaw = ay * angle * GYRO_ORBIT.yawGain * scale
      targetRoll = ball.x * angle * GYRO_ORBIT.rollGain * scale
    } else {
      targetPitch = 0
      targetYaw = 0
      targetRoll = 0
    }
    targetEngage = ball.engagement
  }

  const onOrient = (event: DeviceOrientationEvent) => {
    if (event.beta == null || event.gamma == null) return
    rawBeta = event.beta
    rawGamma = event.gamma
    hasRaw = true

    if (!hasBase) {
      baseBeta = rawBeta
      baseGamma = rawGamma
      hasBase = true
    } else {
      const jump =
        Math.abs(rawBeta - baseBeta) > GYRO_ORBIT.recalibrateJumpDeg ||
        Math.abs(rawGamma - baseGamma) > GYRO_ORBIT.recalibrateJumpDeg
      // Large jumps usually mean the user flipped the phone; re-home gently.
      if (jump && Math.hypot(pitch, yaw) < 0.08) {
        baseBeta = rawBeta
        baseGamma = rawGamma
      }
    }

    if (status === 'ready' || status === 'active') {
      status = 'active'
    }
  }

  const controller: GyroOrbitController = {
    get status() {
      return status
    },
    sample,
    setStatus(next) {
      status = next
    },
    pushOrientation(beta, gamma) {
      if (beta == null || gamma == null) return
      onOrient({ beta, gamma } as DeviceOrientationEvent)
    },
    recalibrate() {
      if (!hasRaw) return
      baseBeta = rawBeta
      baseGamma = rawGamma
      hasBase = true
      idleTimer = 0
    },
    enableListening() {
      if (listening) return
      listening = true
      window.addEventListener('deviceorientation', onOrient, true)
    },
    disableListening() {
      if (!listening) return
      listening = false
      window.removeEventListener('deviceorientation', onOrient, true)
    },
    tick(dt, reducedMotion) {
      if (status !== 'active' && status !== 'ready') {
        const k = 1 - Math.exp(-GYRO_ORBIT.springLerp * dt)
        pitch += (0 - pitch) * k
        yaw += (0 - yaw) * k
        roll += (0 - roll) * k
        engagement += (0 - engagement) * k
        live = false
        syncSample()
        return
      }

      recomputeTargets(reducedMotion)

      const nearRest = targetEngage < 0.04
      if (nearRest) idleTimer += dt
      else idleTimer = 0

      const springing = nearRest && idleTimer > GYRO_ORBIT.idleSettle
      const rate = springing ? GYRO_ORBIT.springLerp : GYRO_ORBIT.followLerp
      const k = 1 - Math.exp(-rate * dt)
      const aimPitch = springing ? 0 : targetPitch
      const aimYaw = springing ? 0 : targetYaw
      const aimRoll = springing ? 0 : targetRoll
      const aimEngage = springing ? 0 : targetEngage

      pitch += (aimPitch - pitch) * k
      yaw += (aimYaw - yaw) * k
      roll += (aimRoll - roll) * k
      engagement += (aimEngage - engagement) * k
      live = hasRaw
      syncSample()
    },
    dispose() {
      controller.disableListening()
    },
  }

  return controller
}
