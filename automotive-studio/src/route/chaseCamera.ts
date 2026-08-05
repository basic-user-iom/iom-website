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

  private dragActive = false
  private dragMode: 'orbit' | 'frame' = 'orbit'
  private lastPointerX = 0
  private lastPointerY = 0
  private onOrbitChange: ((state: ChaseOrbitState) => void) | null = null

  private readonly onPointerDown = (e: PointerEvent) => {
    if (!this.enabled) return
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
    if (!this.dragActive || !this.enabled) return
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
    if (!this.enabled) return
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
    this.dragActive = false
    if (enabled && this.controls) {
      this.controls.enabled = false
    }
    if (this.canvas) {
      this.canvas.style.cursor = enabled ? 'grab' : ''
    }
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
    if (partial.yawDeg != null) this.orbitYawDeg = wrapDeg(partial.yawDeg)
    if (partial.pitchDeg != null) this.orbitPitchDeg = clamp(partial.pitchDeg, 5, 70)
    if (partial.distance != null) this.distance = clamp(partial.distance, 3.5, 24)
    if (partial.lookAhead != null) this.lookAhead = clamp(partial.lookAhead, -1.5, 4)
    if (partial.lookSide != null) this.lookSide = clamp(partial.lookSide, -2.5, 2.5)
    if (snap) this.initialized = false
  }

  applyPreset(preset: ChaseOrbitPreset) {
    const p = CHASE_ORBIT_PRESETS[preset]
    this.setOrbit(
      {
        yawDeg: p.yawDeg,
        pitchDeg: p.pitchDeg,
        distance: p.distance,
        lookAhead: p.lookAhead,
        lookSide: 0,
      },
      true,
    )
    this.emitOrbit()
  }

  /**
   * Drive the camera from the vehicle placement root.
   * `headingYaw` is the visual nose heading in radians (path direction after alignment).
   */
  update(placement: Object3D | null, dtSeconds: number, headingYaw?: number | null) {
    if (!this.enabled || !this.camera || !placement) return

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

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

function wrapDeg(deg: number) {
  let d = deg
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}
