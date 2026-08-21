import { Object3D, PerspectiveCamera, Vector3 } from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const _forward = new Vector3()
const _side = new Vector3()
const _desired = new Vector3()
const _look = new Vector3()
const UP = new Vector3(0, 1, 0)

export type ChaseOrbitPreset =
  | 'rear'
  | 'three-quarter-left'
  | 'three-quarter-right'
  | 'side-left'
  | 'side-right'
  | 'front'
  | 'high'

export const CHASE_ORBIT_PRESETS: Record<
  ChaseOrbitPreset,
  { yawDeg: number; pitchDeg: number; distance: number; lookAhead: number; label: string }
> = {
  rear: { yawDeg: 0, pitchDeg: 16, distance: 7.5, lookAhead: 0.8, label: 'Rear' },
  'three-quarter-left': { yawDeg: -28, pitchDeg: 18, distance: 7.8, lookAhead: 1.0, label: '¾ L' },
  'three-quarter-right': { yawDeg: 28, pitchDeg: 18, distance: 7.8, lookAhead: 1.0, label: '¾ R' },
  'side-left': { yawDeg: -90, pitchDeg: 14, distance: 8.5, lookAhead: 1.1, label: 'Side L' },
  'side-right': { yawDeg: 90, pitchDeg: 14, distance: 8.5, lookAhead: 1.1, label: 'Side R' },
  front: { yawDeg: 180, pitchDeg: 12, distance: 8.2, lookAhead: 0.4, label: 'Front' },
  high: { yawDeg: 35, pitchDeg: 55, distance: 11, lookAhead: 1.2, label: 'High' },
}

/**
 * Cinematic follow cam for an active Vehicle Route.
 * Orbit yaw/pitch are relative to vehicle heading (0° = straight behind).
 */
export class ChaseCamera {
  private camera: PerspectiveCamera | null = null
  private controls: OrbitControls | null = null
  private canvas: HTMLElement | null = null
  private enabled = false
  private initialized = false

  /** Metres from look target to camera. */
  distance = 7.8
  /**
   * Orbit around the vehicle, degrees.
   * 0 = behind travel direction, + = camera moves to the right of travel (¾ R).
   */
  orbitYawDeg = 28
  /** Elevation above the horizon, degrees (5–70). */
  orbitPitchDeg = 18
  /** Look-at height above the vehicle origin. */
  lookHeight = 0.95
  /** Metres along the nose from placement origin (positive = toward front). */
  lookAhead = 1.0
  /** Metres to the vehicle's right of the look target (fine lateral recenter). */
  lookSide = 0
  /** Exponential smoothing time constant (seconds). Lower = snappier. */
  smoothing = 0.22
  /** Default duration when blending between chase presets / vehicle shots. */
  orbitTransitionSeconds = 0.9

  private dragActive = false
  private dragMode: 'orbit' | 'frame' = 'orbit'
  private lastPointerX = 0
  private lastPointerY = 0
  private onOrbitChange: ((state: ChaseOrbitState) => void) | null = null
  /** Beam gizmo / similar — ignore drag & wheel so TransformControls owns the pointer. */
  private inputBlocked = false
  /** Freeze follow so the view doesn't slide while dragging a gizmo. */
  private updateBlocked = false
  /** Smooth orbit-parameter blend (presets / saved vehicle shots). */
  private orbitTransition: {
    from: ChaseOrbitState
    to: ChaseOrbitState
    elapsed: number
    duration: number
  } | null = null

  private readonly onPointerDown = (e: PointerEvent) => {
    if (!this.enabled || this.inputBlocked || this.updateBlocked) return
    if (e.button !== 0 && e.button !== 2) return
    if ((e.target as HTMLElement | null)?.closest?.('[data-route-edit]')) return
    this.dragActive = true
    // Shift or right-drag = nudge look target (frame) without extra UI chrome.
    this.dragMode = e.shiftKey || e.button === 2 ? 'frame' : 'orbit'
    this.lastPointerX = e.clientX
    this.lastPointerY = e.clientY
    this.canvas?.setPointerCapture(e.pointerId)
    if (this.canvas) this.canvas.style.cursor = this.dragMode === 'frame' ? 'move' : 'grabbing'
    e.preventDefault()
  }

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.dragActive || !this.enabled || this.inputBlocked || this.updateBlocked) return
    const dx = e.clientX - this.lastPointerX
    const dy = e.clientY - this.lastPointerY
    this.lastPointerX = e.clientX
    this.lastPointerY = e.clientY

    if (this.dragMode === 'frame') {
      // Drag up / right → look further forward / toward vehicle right.
      this.lookAhead = clamp(this.lookAhead - dy * 0.012, -1.5, 4)
      this.lookSide = clamp(this.lookSide + dx * 0.012, -2.5, 2.5)
    } else {
      this.orbitYawDeg = wrapDeg(this.orbitYawDeg + dx * 0.35)
      this.orbitPitchDeg = clamp(this.orbitPitchDeg + dy * 0.22, 5, 70)
    }
    this.initialized = false
    this.emitOrbit()
  }

  private readonly onPointerUp = (e: PointerEvent) => {
    if (!this.dragActive) return
    this.dragActive = false
    this.dragMode = 'orbit'
    if (this.canvas) this.canvas.style.cursor = this.enabled ? 'grab' : ''
    try {
      this.canvas?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  private readonly onContextMenu = (e: Event) => {
    if (this.enabled) e.preventDefault()
  }

  private readonly onWheel = (e: WheelEvent) => {
    if (!this.enabled || this.inputBlocked || this.updateBlocked) return
    e.preventDefault()
    if (e.shiftKey) {
      this.lookAhead = clamp(this.lookAhead + (e.deltaY > 0 ? -0.15 : 0.15), -1.5, 4)
    } else {
      const factor = e.deltaY > 0 ? 1.06 : 0.94
      this.distance = clamp(this.distance * factor, 3.5, 24)
    }
    this.initialized = false
    this.emitOrbit()
  }

  bind(camera: PerspectiveCamera, controls: OrbitControls, canvas?: HTMLElement) {
    this.unbindPointer()
    this.camera = camera
    this.controls = controls
    this.canvas = canvas ?? (controls.domElement as HTMLElement)
    this.initialized = false
    this.bindPointer()
  }

  setOnOrbitChange(cb: ((state: ChaseOrbitState) => void) | null) {
    this.onOrbitChange = cb
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    this.initialized = false
    this.endPointerDrag()
    if (enabled && this.controls) {
      this.controls.enabled = false
    }
    if (this.canvas) {
      this.canvas.style.cursor = enabled && !this.inputBlocked && !this.updateBlocked ? 'grab' : ''
    }
  }

  /**
   * Block chase drag/zoom (e.g. while beam-gizmo edit is on) so TransformControls
   * receives pointer events on the shared canvas.
   */
  setInputBlocked(blocked: boolean) {
    this.inputBlocked = blocked
    if (blocked) this.endPointerDrag()
    if (this.canvas && this.enabled) {
      this.canvas.style.cursor = blocked || this.updateBlocked ? '' : 'grab'
    }
  }

  /** Freeze follow framing while dragging a gizmo — camera stays put. */
  setUpdateBlocked(blocked: boolean) {
    this.updateBlocked = blocked
    if (blocked) this.endPointerDrag()
    if (this.canvas && this.enabled) {
      this.canvas.style.cursor = blocked || this.inputBlocked ? '' : 'grab'
    }
  }

  private endPointerDrag() {
    this.dragActive = false
    this.dragMode = 'orbit'
  }

  isEnabled() {
    return this.enabled
  }

  getOrbitState(): ChaseOrbitState {
    return {
      yawDeg: this.orbitYawDeg,
      pitchDeg: this.orbitPitchDeg,
      distance: this.distance,
      lookAhead: this.lookAhead,
      lookSide: this.lookSide,
    }
  }

  setOrbit(partial: Partial<ChaseOrbitState>, snap = false) {
    this.orbitTransition = null
    if (partial.yawDeg != null) this.orbitYawDeg = wrapDeg(partial.yawDeg)
    if (partial.pitchDeg != null) this.orbitPitchDeg = clamp(partial.pitchDeg, 5, 70)
    if (partial.distance != null) this.distance = clamp(partial.distance, 3.5, 24)
    if (partial.lookAhead != null) this.lookAhead = clamp(partial.lookAhead, -1.5, 4)
    if (partial.lookSide != null) this.lookSide = clamp(partial.lookSide, -2.5, 2.5)
    if (snap) this.initialized = false
  }

  /**
   * Blend orbit framing over time (keeps follow locked to the car).
   * Yaw takes the shortest path so ¾ L ↔ ¾ R doesn't spin the long way.
   */
  transitionToOrbit(partial: Partial<ChaseOrbitState>, durationSeconds = this.orbitTransitionSeconds) {
    const from = this.getOrbitState()
    const to: ChaseOrbitState = {
      yawDeg: partial.yawDeg != null ? wrapDeg(partial.yawDeg) : from.yawDeg,
      pitchDeg: partial.pitchDeg != null ? clamp(partial.pitchDeg, 5, 70) : from.pitchDeg,
      distance: partial.distance != null ? clamp(partial.distance, 3.5, 24) : from.distance,
      lookAhead: partial.lookAhead != null ? clamp(partial.lookAhead, -1.5, 4) : from.lookAhead,
      lookSide: partial.lookSide != null ? clamp(partial.lookSide, -2.5, 2.5) : from.lookSide,
    }
    let toYaw = to.yawDeg
    let delta = toYaw - from.yawDeg
    while (delta > 180) {
      toYaw -= 360
      delta -= 360
    }
    while (delta < -180) {
      toYaw += 360
      delta += 360
    }
    to.yawDeg = toYaw
    const duration = Math.max(0.05, durationSeconds)
    if (duration <= 0.06) {
      this.setOrbit(to, false)
      this.emitOrbit()
      return
    }
    this.orbitTransition = { from, to, elapsed: 0, duration }
    // UI reflects the destination framing while the camera eases there.
    this.onOrbitChange?.({ ...to, yawDeg: wrapDeg(to.yawDeg) })
  }

  applyPreset(preset: ChaseOrbitPreset, durationSeconds = this.orbitTransitionSeconds) {
    const p = CHASE_ORBIT_PRESETS[preset]
    this.transitionToOrbit(
      {
        yawDeg: p.yawDeg,
        pitchDeg: p.pitchDeg,
        distance: p.distance,
        lookAhead: p.lookAhead,
        lookSide: 0,
      },
      durationSeconds,
    )
  }

  /**
   * Drive the camera from the vehicle placement root.
   * `headingYaw` is the visual nose heading in radians (path direction after alignment).
   */
  update(placement: Object3D | null, dtSeconds: number, headingYaw?: number | null) {
    if (!this.enabled || this.updateBlocked || !this.camera || !placement) return

    if (this.orbitTransition && Number.isFinite(dtSeconds) && dtSeconds > 0) {
      this.orbitTransition.elapsed += dtSeconds
      const u = easeInOutCubic(
        Math.min(1, this.orbitTransition.elapsed / this.orbitTransition.duration),
      )
      const { from, to } = this.orbitTransition
      this.orbitYawDeg = from.yawDeg + (to.yawDeg - from.yawDeg) * u
      this.orbitPitchDeg = from.pitchDeg + (to.pitchDeg - from.pitchDeg) * u
      this.distance = from.distance + (to.distance - from.distance) * u
      this.lookAhead = from.lookAhead + (to.lookAhead - from.lookAhead) * u
      this.lookSide = from.lookSide + (to.lookSide - from.lookSide) * u
      if (u >= 1) {
        this.orbitYawDeg = wrapDeg(to.yawDeg)
        this.orbitTransition = null
        this.emitOrbit()
      }
    }

    const yaw = headingYaw != null && Number.isFinite(headingYaw) ? headingYaw : placement.rotation.y
    _forward.set(Math.sin(yaw), 0, Math.cos(yaw))
    _side.crossVectors(UP, _forward).normalize()

    const az = (this.orbitYawDeg * Math.PI) / 180
    const el = (this.orbitPitchDeg * Math.PI) / 180
    const cosEl = Math.cos(el)
    const sinEl = Math.sin(el)
    const backWeight = Math.cos(az) * cosEl
    const sideWeight = Math.sin(az) * cosEl

    _look
      .copy(placement.position)
      .addScaledVector(_forward, this.lookAhead)
      .addScaledVector(_side, this.lookSide)
      .addScaledVector(UP, this.lookHeight)

    _desired
      .copy(_look)
      .addScaledVector(_forward, -this.distance * backWeight)
      .addScaledVector(_side, this.distance * sideWeight)
      .addScaledVector(UP, this.distance * sinEl)

    if (!this.initialized || !Number.isFinite(dtSeconds) || dtSeconds <= 0) {
      this.camera.position.copy(_desired)
      if (this.controls) this.controls.target.copy(_look)
      this.camera.lookAt(_look)
      this.initialized = true
      return
    }

    const alpha = 1 - Math.exp(-dtSeconds / Math.max(0.04, this.smoothing))
    this.camera.position.lerp(_desired, alpha)
    if (this.controls) {
      this.controls.target.lerp(_look, alpha)
      this.camera.lookAt(this.controls.target)
    } else {
      this.camera.lookAt(_look)
    }
  }

  dispose() {
    this.unbindPointer()
    this.camera = null
    this.controls = null
    this.canvas = null
  }

  private emitOrbit() {
    this.onOrbitChange?.(this.getOrbitState())
  }

  private bindPointer() {
    if (!this.canvas) return
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerUp)
    this.canvas.addEventListener('contextmenu', this.onContextMenu)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  private unbindPointer() {
    if (!this.canvas) return
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerUp)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)
    this.canvas.removeEventListener('wheel', this.onWheel)
  }
}

export type ChaseOrbitState = {
  yawDeg: number
  pitchDeg: number
  distance: number
  lookAhead: number
  lookSide: number
}

function vec3Components(
  v: Vector3 | readonly [number, number, number],
): [number, number, number] {
  if (v instanceof Vector3) return [v.x, v.y, v.z]
  return [v[0], v[1], v[2]]
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

function wrapDeg(deg: number) {
  let d = deg
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Convert a world-space camera/target pose into chase orbit relative to the car heading.
 * Framing sticks to the vehicle even after free-drive moves it.
 */
export function deriveChaseOrbitFromWorld(
  headingYaw: number,
  cameraPosition: Vector3 | readonly [number, number, number],
  cameraTarget: Vector3 | readonly [number, number, number],
): ChaseOrbitState {
  const [cx, cy, cz] = vec3Components(cameraPosition)
  const [tx, ty, tz] = vec3Components(cameraTarget)

  const ox = cx - tx
  const oy = cy - ty
  const oz = cz - tz
  const distance = clamp(Math.hypot(ox, oy, oz), 3.5, 24)
  if (distance < 1e-4) {
    return { yawDeg: 0, pitchDeg: 18, distance: 7.8, lookAhead: 1, lookSide: 0 }
  }

  const pitchDeg = clamp((Math.asin(clamp(oy / distance, -1, 1)) * 180) / Math.PI, 5, 70)
  _forward.set(Math.sin(headingYaw), 0, Math.cos(headingYaw))
  _side.crossVectors(UP, _forward).normalize()
  const flatLen = Math.hypot(ox, oz)
  if (flatLen < 1e-8) {
    return { yawDeg: 0, pitchDeg, distance, lookAhead: 1, lookSide: 0 }
  }
  const fx = ox / flatLen
  const fz = oz / flatLen
  // Flat camera direction from look: -forward·cos(az) + side·sin(az)
  const cosAz = clamp(-(fx * _forward.x + fz * _forward.z), -1, 1)
  const sinAz = clamp(fx * _side.x + fz * _side.z, -1, 1)
  const yawDeg = wrapDeg((Math.atan2(sinAz, cosAz) * 180) / Math.PI)
  return { yawDeg, pitchDeg, distance, lookAhead: 1, lookSide: 0 }
}
