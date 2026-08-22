/**
 * Mouse Arcball Orbit Tool (desktop)
 *
 * Same mathematical language as the mobile Relative Arcball Orbit Tool:
 * pointer positions project onto a unit hemisphere (Shoemake Arcball, 1992).
 * Drag rotates the stone along the great-circle arc; release keeps a damped
 * angular velocity (inertia). Double-click or the Orbit Tool button resets.
 *
 * Parallax stays for idle pointer motion; while dragging / coasting, orbit
 * owns orientation so the two systems do not fight.
 */

import * as THREE from 'three'

export type MouseOrbitStatus = 'unsupported' | 'ready' | 'active'

export type MouseOrbitSample = {
  pitch: number
  yaw: number
  roll: number
  /** 0–1 drag / coast intensity for UI */
  engagement: number
  live: boolean
  /** True while primary-button drag is held */
  dragging: boolean
}

export const MOUSE_ORBIT = {
  /** Virtual sphere radius in NDC (−1…1). Smaller = more sensitive near center. */
  sphereRadius: 0.92,
  /** Scale applied to each drag delta angle. */
  gain: 1.35,
  /** Exponential decay of angular speed after release (1/s). */
  inertiaDecay: 2.6,
  /** Faster stop when prefers-reduced-motion. */
  reducedInertiaDecay: 7.2,
  /** Drop inertia below this rad/s. */
  inertiaCutoff: 0.035,
  /** Soft clamp of release angular speed (rad/s). */
  maxAngularSpeed: 6.5,
  /** Reduced-motion scales drag gain and shortens coast. */
  reducedMotionScale: 0.32,
  /** After coast ends, how long engagement fades in the UI. */
  engageFade: 2.8,
  /** Idle Y spin damp while orbit is engaged (matches gyro feel). */
  idleSpinScale: 0.18,
} as const

export function canOfferMouseOrbit(): boolean {
  if (typeof window === 'undefined') return false
  const fine = window.matchMedia('(pointer: fine)').matches
  const hover = window.matchMedia('(hover: hover)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  return fine && hover && !coarse
}

function projectToSphere(nx: number, ny: number, radius: number): THREE.Vector3 {
  const inv = 1 / Math.max(radius, 1e-3)
  let x = nx * inv
  let y = -ny * inv
  const r2 = x * x + y * y
  if (r2 <= 1) {
    return new THREE.Vector3(x, y, Math.sqrt(1 - r2))
  }
  const s = 1 / Math.sqrt(r2)
  return new THREE.Vector3(x * s, y * s, 0)
}

function pointerToNdc(clientX: number, clientY: number, rect: DOMRect): { nx: number; ny: number } {
  const x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
  const y = ((clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1
  return { nx: x, ny: y }
}

export type MouseOrbitController = {
  status: MouseOrbitStatus
  sample: MouseOrbitSample
  /** Orientation applied on top of idle spin (object space). */
  orientation: THREE.Quaternion
  /** True while dragging or coasting with meaningful speed. */
  engaged: boolean
  tick: (dt: number, reducedMotion: boolean) => void
  pointerDown: (clientX: number, clientY: number, rect: DOMRect) => void
  pointerMove: (clientX: number, clientY: number, rect: DOMRect) => void
  pointerUp: () => void
  /** Snap back to identity (button / double-click). */
  reset: () => void
  setStatus: (status: MouseOrbitStatus) => void
  dispose: () => void
}

export function createMouseOrbitController(): MouseOrbitController {
  let status: MouseOrbitStatus = 'unsupported'
  let dragging = false
  let hasLast = false
  let reducedMotion = false
  const lastPoint = new THREE.Vector3(0, 0, 1)
  const orientation = new THREE.Quaternion()
  const coastAxis = new THREE.Vector3(0, 1, 0)
  let coastSpeed = 0
  let lastMoveTime = 0
  let engage = 0
  let pitch = 0
  let yaw = 0
  let roll = 0

  const scratchFrom = new THREE.Vector3()
  const scratchAxis = new THREE.Vector3()
  const scratchQuat = new THREE.Quaternion()
  const scratchEuler = new THREE.Euler(0, 0, 0, 'YXZ')

  const sample: MouseOrbitSample = {
    pitch: 0,
    yaw: 0,
    roll: 0,
    engagement: 0,
    live: false,
    dragging: false,
  }

  const syncSample = (live: boolean) => {
    scratchEuler.setFromQuaternion(orientation, 'YXZ')
    pitch = scratchEuler.x
    yaw = scratchEuler.y
    roll = scratchEuler.z
    sample.pitch = pitch
    sample.yaw = yaw
    sample.roll = roll
    sample.engagement = engage
    sample.live = live
    sample.dragging = dragging
  }

  const applyDelta = (from: THREE.Vector3, to: THREE.Vector3, reducedMotion: boolean) => {
    scratchAxis.copy(from).cross(to)
    const axisLen = scratchAxis.length()
    if (axisLen < 1e-8) return 0
    scratchAxis.multiplyScalar(1 / axisLen)
    const dot = THREE.MathUtils.clamp(from.dot(to), -1, 1)
    let angle = Math.acos(dot) * MOUSE_ORBIT.gain
    if (reducedMotion) angle *= MOUSE_ORBIT.reducedMotionScale
    if (angle < 1e-8) return 0
    scratchQuat.setFromAxisAngle(scratchAxis, angle)
    orientation.premultiply(scratchQuat)
    orientation.normalize()
    return angle
  }

  const controller: MouseOrbitController = {
    get status() {
      return status
    },
    sample,
    orientation,
    get engaged() {
      return dragging || coastSpeed > MOUSE_ORBIT.inertiaCutoff
    },
    setStatus(next) {
      status = next
    },
    pointerDown(clientX, clientY, rect) {
      if (status === 'unsupported') return
      const { nx, ny } = pointerToNdc(clientX, clientY, rect)
      lastPoint.copy(projectToSphere(nx, ny, MOUSE_ORBIT.sphereRadius))
      hasLast = true
      dragging = true
      coastSpeed = 0
      lastMoveTime = performance.now()
      status = 'active'
      engage = Math.max(engage, 0.35)
      syncSample(true)
    },
    pointerMove(clientX, clientY, rect) {
      if (!dragging || !hasLast) return
      const { nx, ny } = pointerToNdc(clientX, clientY, rect)
      scratchFrom.copy(lastPoint)
      const next = projectToSphere(nx, ny, MOUSE_ORBIT.sphereRadius)
      const now = performance.now()
      const dt = Math.max(1e-3, (now - lastMoveTime) / 1000)
      lastMoveTime = now
      // Gain already applied inside; reducedMotion unknown here — use full, tick will damp.
      const angle = applyDelta(scratchFrom, next, reducedMotion)
      lastPoint.copy(next)
      if (angle > 0) {
        coastAxis.copy(scratchAxis)
        const speedScale = reducedMotion ? 1 / Math.max(MOUSE_ORBIT.reducedMotionScale, 0.08) : 1
        coastSpeed = Math.min(MOUSE_ORBIT.maxAngularSpeed, (angle * speedScale) / dt)
        if (reducedMotion) coastSpeed *= MOUSE_ORBIT.reducedMotionScale
        engage = Math.min(1, Math.max(engage, angle * 4 + 0.45))
      }
      syncSample(true)
    },
    pointerUp() {
      if (!dragging) return
      dragging = false
      hasLast = false
      if (coastSpeed <= MOUSE_ORBIT.inertiaCutoff) {
        coastSpeed = 0
        if (status === 'active') status = 'ready'
      }
      syncSample(coastSpeed > MOUSE_ORBIT.inertiaCutoff)
    },
    reset() {
      orientation.identity()
      coastSpeed = 0
      dragging = false
      hasLast = false
      engage = 0
      if (status === 'active') status = 'ready'
      syncSample(false)
    },
    tick(dt, reduced) {
      reducedMotion = reduced
      if (status === 'unsupported') {
        syncSample(false)
        return
      }

      if (dragging) {
        // Soft decay of UI engagement while holding still mid-drag.
        engage += (0.55 - engage) * (1 - Math.exp(-MOUSE_ORBIT.engageFade * dt))
        syncSample(true)
        return
      }

      if (coastSpeed > MOUSE_ORBIT.inertiaCutoff) {
        const decay = reducedMotion ? MOUSE_ORBIT.reducedInertiaDecay : MOUSE_ORBIT.inertiaDecay
        const step = coastSpeed * dt
        scratchQuat.setFromAxisAngle(coastAxis, step)
        orientation.premultiply(scratchQuat)
        orientation.normalize()
        coastSpeed *= Math.exp(-decay * dt)
        if (coastSpeed <= MOUSE_ORBIT.inertiaCutoff) {
          coastSpeed = 0
          status = 'ready'
        } else {
          status = 'active'
        }
        engage = Math.min(1, 0.25 + coastSpeed / MOUSE_ORBIT.maxAngularSpeed)
        syncSample(true)
        return
      }

      coastSpeed = 0
      engage += (0 - engage) * (1 - Math.exp(-MOUSE_ORBIT.engageFade * dt))
      if (status === 'active') status = 'ready'
      syncSample(engage > 0.02)
    },
    dispose() {
      dragging = false
      hasLast = false
      coastSpeed = 0
    },
  }

  return controller
}
