import { PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { SceneBounds } from '../scene/SceneBounds'
import { nearFarFromBounds } from '../scene/SceneBounds'
import { easeInOutCubic } from './CameraViews'

export type OrbitCameraState = {
  position: Vector3
  target: Vector3
  fov?: number
}

/**
 * Default viewer mode — OrbitControls with model-aware framing and zoom limits.
 */
export class OrbitMode {
  readonly controls: OrbitControls
  private saved: OrbitCameraState | null = null
  private framing = false
  private frameFrom = new Vector3()
  private frameTo = new Vector3()
  private frameTargetFrom = new Vector3()
  private frameTargetTo = new Vector3()
  private frameFovFrom = 55
  private frameFovTo = 55
  private frameT = 1
  private frameDuration = 0.55
  transitionsStarted = 0

  constructor(
    private readonly camera: PerspectiveCamera,
    domElement: HTMLElement,
  ) {
    this.controls = new OrbitControls(camera, domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.screenSpacePanning = true
    this.controls.enablePan = true
    this.controls.touches.ONE = 0 // ROTATE
    this.controls.touches.TWO = 2 // DOLLY_PAN — pinch zooms
    this.controls.addEventListener('start', () => this.cancelTransition())
  }

  setEnabled(enabled: boolean): void {
    this.controls.enabled = enabled
  }

  saveState(): OrbitCameraState {
    this.saved = {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      fov: this.camera.fov,
    }
    return this.saved
  }

  getSavedState(): OrbitCameraState | null {
    return this.saved
  }

  restoreState(state?: OrbitCameraState | null): void {
    const s = state ?? this.saved
    if (!s) return
    this.cancelTransition()
    this.camera.position.copy(s.position)
    this.controls.target.copy(s.target)
    if (s.fov != null) {
      this.camera.fov = s.fov
      this.camera.updateProjectionMatrix()
    }
    this.controls.update()
  }

  frameBounds(bounds: SceneBounds, animate = true): void {
    const { near, far } = nearFarFromBounds(bounds)
    this.camera.near = near
    this.camera.far = far
    this.camera.updateProjectionMatrix()

    const fitOffset = 1.35
    const fov = (this.camera.fov * Math.PI) / 180
    const fitHeight = bounds.radius / Math.sin(fov / 2)
    const fitWidth = fitHeight / this.camera.aspect
    const distance = fitOffset * Math.max(fitHeight, fitWidth)

    const dir = new Vector3(0.65, 0.45, 0.85).normalize()
    const targetPos = bounds.center.clone().addScaledVector(dir, distance)

    this.controls.minDistance = Math.max(bounds.radius * 0.05, near * 4)
    this.controls.maxDistance = Math.max(bounds.radius * 8, distance * 2.5)
    this.controls.target.copy(bounds.center)

    if (!animate) {
      this.camera.position.copy(targetPos)
      this.controls.update()
      this.frameT = 1
      this.framing = false
      return
    }

    this.goTo(targetPos, bounds.center, { duration: this.frameDuration })
  }

  /**
   * Smoothly move the orbit camera to a saved view (position + target + optional FOV).
   */
  goTo(
    position: Vector3 | [number, number, number],
    target: Vector3 | [number, number, number],
    options?: { fov?: number; duration?: number },
  ): boolean {
    const toPos = Array.isArray(position)
      ? new Vector3(position[0], position[1], position[2])
      : position.clone()
    const toTarget = Array.isArray(target)
      ? new Vector3(target[0], target[1], target[2])
      : target.clone()

    const fov = options?.fov ?? this.camera.fov
    if (this.isHeadingTo(toPos, toTarget, fov) || (!this.framing && this.isAtView(toPos, toTarget, fov))) return false

    this.frameDuration = Math.max(0.15, options?.duration ?? 1)
    this.frameFrom.copy(this.camera.position)
    this.frameTo.copy(toPos)
    this.frameTargetFrom.copy(this.controls.target)
    // Saved views must not inherit the previous drag's remaining damping.
    const damping = this.controls.enableDamping
    this.controls.enableDamping = false
    this.controls.update()
    this.camera.position.copy(this.frameFrom)
    this.controls.target.copy(this.frameTargetFrom)
    this.controls.update()
    this.controls.enableDamping = damping
    this.frameTargetTo.copy(toTarget)
    this.frameFovFrom = this.camera.fov
    this.frameFovTo = options?.fov ?? this.camera.fov
    this.frameT = 0
    this.framing = true
    this.transitionsStarted++
    return true
  }

  isAtView(position: Vector3, target: Vector3, fov: number): boolean {
    return this.camera.position.distanceToSquared(position) < 1e-8 && this.controls.target.distanceToSquared(target) < 1e-8 && Math.abs(this.camera.fov - fov) < 1e-5
  }

  isHeadingTo(position: Vector3, target: Vector3, fov: number): boolean {
    return this.framing && this.frameTo.distanceToSquared(position) < 1e-8 && this.frameTargetTo.distanceToSquared(target) < 1e-8 && Math.abs(this.frameFovTo - fov) < 1e-5
  }

  cancelTransition(): void {
    this.framing = false
    this.frameT = 1
  }

  inspect() {
    return {position:this.camera.position.toArray(),target:this.controls.target.toArray(),fov:this.camera.fov,enabled:this.controls.enabled,animating:this.framing,transitionsStarted:this.transitionsStarted}
  }

  isAnimating(): boolean {
    return this.framing
  }

  update(dt: number): void {
    if (this.framing) {
      this.frameT = Math.min(1, this.frameT + dt / this.frameDuration)
      const t = easeInOutCubic(this.frameT)
      this.camera.position.lerpVectors(this.frameFrom, this.frameTo, t)
      this.controls.target.lerpVectors(this.frameTargetFrom, this.frameTargetTo, t)
      if (this.frameFovFrom !== this.frameFovTo) {
        this.camera.fov = this.frameFovFrom + (this.frameFovTo - this.frameFovFrom) * t
        this.camera.updateProjectionMatrix()
      }
      this.camera.lookAt(this.controls.target)
      if (this.frameT >= 1) {
        this.framing = false
        this.camera.fov = this.frameFovTo
        this.camera.updateProjectionMatrix()
        this.controls.update()
      }
      return
    }
    if (this.controls.enabled) this.controls.update()
  }

  dispose(): void {
    this.controls.dispose()
  }
}
