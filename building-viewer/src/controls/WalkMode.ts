import { PerspectiveCamera, Vector3 } from 'three'
import { CharacterController } from '../collision/CharacterController'
import type { CharacterVisual } from './CharacterVisual'
import type { FootGroundQuery } from './CharacterFootIK'
import { WalkPresentation, stairWalkingSpeed } from './WalkPresentation'
import { measureTreadDepth } from './stairCadence'

const _wish = new Vector3()
const _forward = new Vector3()
const _right = new Vector3()
const _camTarget = new Vector3()
const _desired = new Vector3()
const _cameraBoom = new Vector3()
const _previousFeet = new Vector3()

function isUiControl(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(
    'input, select, textarea, button, a, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="slider"]',
  ))
}

export type WalkCameraMode = 'thirdPerson' | 'firstPerson'

/**
 * Desktop walkthrough: WASD + pointer lock + Shift run.
 * Default third-person follow so the dropped Street View person stays visible.
 */
export class WalkMode {
  enabled = false
  private teleportTransition = false
  cameraMode: WalkCameraMode = 'thirdPerson'
  private keys = new Set<string>()
  private readonly teleportHeldKeys = new Set<string>()
  private readonly presentation = new WalkPresentation()
  private readonly onBlur = () => {
    this.keys.clear()
    this.teleportHeldKeys.clear()
  }
  private readonly onFocusIn = (event: FocusEvent) => {
    if (isUiControl(event.target)) this.onBlur()
  }
  private pointerLocked = false
  private readonly onKeyDown: (e: KeyboardEvent) => void
  private readonly onKeyUp: (e: KeyboardEvent) => void
  private readonly onMouseMove: (e: MouseEvent) => void
  private readonly onPointerLockChange: () => void
  private readonly onCanvasClick: () => void
  private readonly cameraFocus = new Vector3()
  private stairStepDepth = .28
  private targetStepDepth = .28
  private readonly lastTreadProbe = new Vector3(Infinity, Infinity, Infinity)
  private cameraBoomLength = Infinity
  private followDistance = 4.2
  private followHeight = 1.85
  private lookAtHeight = 1.25

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly dom: HTMLElement,
    private readonly controller: CharacterController,
    private readonly visual: CharacterVisual,
    private readonly onLockChange?: (locked: boolean) => void,
    private readonly footGround?: FootGroundQuery,
    private readonly cameraObstruction?: (origin: Vector3, desired: Vector3) => number | null,
  ) {
    this.onKeyDown = (e) => {
      if (!this.enabled || this.teleportHeldKeys.has(e.code)) return
      if (this.teleportTransition) {
        if (e.code === 'Escape') this.exitPointerLock()
        else this.teleportHeldKeys.add(e.code)
        return
      }
      // Native menus can consume keyup; never latch their navigation keys as walking.
      if (isUiControl(e.target) || isUiControl(document.activeElement)) {
        this.keys.clear()
        return
      }
      this.keys.add(e.code)
      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) this.controller.requestJump()
      }
      if (e.code === 'Escape') this.exitPointerLock()
      if (e.code === 'KeyV') {
        this.cameraMode = this.cameraMode === 'thirdPerson' ? 'firstPerson' : 'thirdPerson'
      }
    }
    this.onKeyUp = (e) => {
      this.keys.delete(e.code)
      this.teleportHeldKeys.delete(e.code)
    }
    this.onMouseMove = (e) => {
      if (!this.enabled || !this.pointerLocked || this.teleportTransition) return
      this.controller.lookDelta(e.movementX, e.movementY)
    }
    this.onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.dom
      if (!this.pointerLocked) this.keys.clear()
      this.onLockChange?.(this.pointerLocked)
    }
    this.onCanvasClick = () => {
      if (document.activeElement instanceof HTMLElement && isUiControl(document.activeElement)) {
        document.activeElement.blur()
      }
      if (this.enabled && !this.pointerLocked) this.requestPointerLock()
    }
  }

  activate(requestLock = true): void {
    this.enabled = true
    this.teleportHeldKeys.clear()
    this.visual.setVisible(true)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    document.addEventListener('focusin', this.onFocusIn)
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    this.dom.addEventListener('click', this.onCanvasClick)
    // Sync look to current camera so drop doesn't snap wildly.
    this.snapLookFromCamera()
    this.presentation.reset(this.controller.position, this.controller.yaw)
    this.cameraFocus.copy(this.controller.position)
    this.cameraBoomLength = Infinity
    this.stairStepDepth = this.targetStepDepth = .28
    this.lastTreadProbe.set(Infinity, Infinity, Infinity)
    this.visual.resetFootIK()
    if (requestLock) {
      // Request on this call stack so a pegman pointerup gesture is preserved.
      // setTimeout(0) breaks user-activation and browsers deny the lock.
      this.requestPointerLock()
    }
  }

  deactivate(): void {
    this.enabled = false
    this.teleportTransition = false
    this.keys.clear()
    this.teleportHeldKeys.clear()
    this.exitPointerLock()
    this.visual.setVisible(false)
    this.visual.resetFootIK()
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    document.removeEventListener('focusin', this.onFocusIn)
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    this.dom.removeEventListener('click', this.onCanvasClick)
  }

  setTeleportTransition(active: boolean): void {
    this.teleportTransition = active
    if (!active) return
    for (const key of this.keys) this.teleportHeldKeys.add(key)
    this.keys.clear()
    this.controller.velocity.set(0, 0, 0)
    this.visual.resetForTeleport()
  }

  /** Move feet, pose and camera together; held movement keys must be released. */
  teleportTo(feet: Vector3, yaw: number): void {
    for (const key of this.keys) this.teleportHeldKeys.add(key)
    this.keys.clear()
    this.controller.setFeetPosition(feet, yaw)
    this.controller.pitch = -0.18
    this.controller.update(1 / 60, _wish.set(0, 0, 0), 0)
    this.presentation.reset(this.controller.position, yaw)
    this.cameraFocus.copy(this.controller.position)
    this.cameraBoomLength = Infinity
    this.stairStepDepth = this.targetStepDepth = .28
    this.lastTreadProbe.set(Infinity, Infinity, Infinity)
    this.visual.resetForTeleport()
    const transitioning = this.teleportTransition
    this.teleportTransition = false
    this.update(0)
    this.teleportTransition = transitioning
  }

  requestPointerLock(): void {
    if (document.pointerLockElement === this.dom) return
    const result = this.dom.requestPointerLock?.() as Promise<void> | undefined
    // If the gesture is gone, the promise rejects — keep "click view to look"
    // honest and do not claim look is active.
    if (result && typeof result.then === 'function') {
      void result.catch(() => {
        this.pointerLocked = false
        this.onLockChange?.(false)
      })
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock?.()
  }

  isPointerLocked(): boolean {
    return this.pointerLocked
  }

  private snapLookFromCamera(): void {
    // Keep character facing roughly toward previous orbit view direction.
    const dx = this.camera.position.x - this.controller.position.x
    const dz = this.camera.position.z - this.controller.position.z
    if (dx * dx + dz * dz > 0.01) {
      this.controller.yaw = Math.atan2(dx, dz)
    }
    this.controller.pitch = -0.18
  }

  update(dt: number): void {
    if (!this.enabled || this.teleportTransition) return
    if (isUiControl(document.activeElement)) this.keys.clear()

    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    const requestedSpeed = running ? this.controller.params.runSpeed : this.controller.params.walkSpeed
    const speed = stairWalkingSpeed(requestedSpeed, this.presentation.animation)

    const forward =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0)
    const strafe =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0)

    _forward.set(-Math.sin(this.controller.yaw), 0, -Math.cos(this.controller.yaw))
    _right.set(Math.cos(this.controller.yaw), 0, -Math.sin(this.controller.yaw))
    _wish.set(0, 0, 0)
    _wish.addScaledVector(_forward, forward)
    _wish.addScaledVector(_right, strafe)
    if (_wish.lengthSq() > 1e-6) _wish.normalize()

    _previousFeet.copy(this.controller.position)
    this.controller.update(dt, _wish, _wish.lengthSq() > 0 ? speed : 0)
    this.presentation.update(
      dt, _previousFeet, this.controller.position, this.controller.onGround,
      this.controller.velocity.y, this.controller.stairsIntent, _wish.lengthSq() > 0, running,
    )
    const stair = this.presentation.animation === 'stairsUp' || this.presentation.animation === 'stairsDown'
    if (stair && this.footGround && _wish.lengthSq() > 0) {
      if (this.controller.position.distanceToSquared(this.lastTreadProbe) > .09) {
        const depth = measureTreadDepth(this.controller.position, _wish, this.footGround)
        if (depth !== null) this.targetStepDepth = depth
        this.lastTreadProbe.copy(this.controller.position)
      }
    } else {
      this.targetStepDepth = .28
      this.lastTreadProbe.set(Infinity, Infinity, Infinity)
    }
    this.stairStepDepth += (this.targetStepDepth - this.stairStepDepth) * (1 - Math.exp(-6 * dt))
    const firstPerson = this.cameraMode === 'firstPerson'
    this.visual.syncFromController(
      this.controller.position, this.presentation.facingYaw,
      this.presentation.animation, firstPerson, this.visual.locomotionRate(this.presentation.animation, this.presentation.speed, this.presentation.playbackRate, this.stairStepDepth),
    )
    this.visual.update(dt, this.footGround ? {
      grounded: this.controller.onGround,
      // Capsule depenetration can briefly exceed the selected walking pace.
      // It must not switch visual contact off in the middle of a slow descent.
      speed: Math.min(speed, this.presentation.speed),
      visualFeetY: this.presentation.bodyFeetY,
      ground: this.footGround,
    } : undefined)

    // Use one smoothed anchor for the boom and its target. Mixing a lagged
    // camera with the fixed-step physics target changes pitch on every frame.
    const anchorBlend = 1 - Math.exp(-12 * dt)
    this.cameraFocus.x += (this.controller.position.x - this.cameraFocus.x) * anchorBlend
    this.cameraFocus.z += (this.controller.position.z - this.cameraFocus.z) * anchorBlend
    this.cameraFocus.y = this.presentation.cameraFeetY
    if (firstPerson) {
      const eye = this.controller.getEyePosition()
      eye.y = this.presentation.cameraFeetY + this.controller.params.eyeHeight
      eye.x = this.cameraFocus.x
      eye.z = this.cameraFocus.z
      this.camera.position.copy(eye)
      this.camera.rotation.set(this.controller.pitch, this.controller.yaw, 0, 'YXZ')
    } else {
      // Third-person boom — Street View drop stays readable.
      const yaw = this.controller.yaw
      const pitch = Math.min(0.55, Math.max(-0.35, this.controller.pitch))
      const dist = this.followDistance
      _desired.set(
        this.cameraFocus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        this.presentation.cameraFeetY + this.followHeight + Math.sin(-pitch) * dist * 0.35,
        this.cameraFocus.z + Math.cos(yaw) * Math.cos(pitch) * dist,
      )
      _camTarget.set(
        this.cameraFocus.x,
        this.presentation.cameraFeetY + this.lookAtHeight,
        this.cameraFocus.z,
      )
      if (this.cameraObstruction) {
        const length = _cameraBoom.copy(_desired).sub(_camTarget).length()
        const hit = this.cameraObstruction(_camTarget, _desired)
        const allowed = hit === null ? length : Math.max(.12, hit - .18)
        // Pull in immediately at a wall; release smoothly after clearing it.
        if (!Number.isFinite(this.cameraBoomLength)) this.cameraBoomLength = allowed
        this.cameraBoomLength = Math.min(allowed,
          this.cameraBoomLength + (length - this.cameraBoomLength) * (1 - Math.exp(-10 * dt)))
        _desired.copy(_camTarget).addScaledVector(_cameraBoom, this.cameraBoomLength / length)
      }
      this.camera.position.copy(_desired)
      this.camera.lookAt(_camTarget)
    }
  }

  dispose(): void {
    this.deactivate()
  }
}
