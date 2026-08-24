import { PerspectiveCamera, Vector3 } from 'three'
import { CharacterController } from '../collision/CharacterController'
import type { CharacterVisual } from './CharacterVisual'
import type { CharacterAnimState } from './CharacterVisual'

const _wish = new Vector3()
const _forward = new Vector3()
const _right = new Vector3()
const _camTarget = new Vector3()
const _desired = new Vector3()

export type WalkCameraMode = 'thirdPerson' | 'firstPerson'

/**
 * Desktop walkthrough: WASD + pointer lock + Shift run.
 * Default third-person follow so the dropped Street View person stays visible.
 */
export class WalkMode {
  enabled = false
  cameraMode: WalkCameraMode = 'thirdPerson'
  private keys = new Set<string>()
  private pointerLocked = false
  private readonly onKeyDown: (e: KeyboardEvent) => void
  private readonly onKeyUp: (e: KeyboardEvent) => void
  private readonly onMouseMove: (e: MouseEvent) => void
  private readonly onPointerLockChange: () => void
  private readonly onCanvasClick: () => void
  private followDistance = 4.2
  private followHeight = 1.85
  private lookAtHeight = 1.25

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly dom: HTMLElement,
    private readonly controller: CharacterController,
    private readonly visual: CharacterVisual,
    private readonly onLockChange?: (locked: boolean) => void,
  ) {
    this.onKeyDown = (e) => {
      if (!this.enabled) return
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
    this.onKeyUp = (e) => this.keys.delete(e.code)
    this.onMouseMove = (e) => {
      if (!this.enabled || !this.pointerLocked) return
      this.controller.lookDelta(e.movementX, e.movementY)
    }
    this.onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.dom
      this.onLockChange?.(this.pointerLocked)
    }
    this.onCanvasClick = () => {
      if (this.enabled && !this.pointerLocked) this.requestPointerLock()
    }
  }

  activate(requestLock = true): void {
    this.enabled = true
    this.visual.setVisible(true)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    this.dom.addEventListener('click', this.onCanvasClick)
    // Sync look to current camera so drop doesn't snap wildly.
    this.snapLookFromCamera()
    if (requestLock) {
      // Defer one frame so the drop pointerup gesture reliably requests lock.
      window.setTimeout(() => this.requestPointerLock(), 0)
    }
  }

  deactivate(): void {
    this.enabled = false
    this.keys.clear()
    this.exitPointerLock()
    this.visual.setVisible(false)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    this.dom.removeEventListener('click', this.onCanvasClick)
  }

  requestPointerLock(): void {
    if (document.pointerLockElement === this.dom) return
    void this.dom.requestPointerLock?.()
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
    if (!this.enabled) return

    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    const speed = running ? this.controller.params.runSpeed : this.controller.params.walkSpeed

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

    this.controller.update(dt, _wish, _wish.lengthSq() > 0 ? speed : 0)

    let anim: CharacterAnimState = 'idle'
    if (!this.controller.onGround || this.controller.velocity.y > 0.4) {
      anim = 'jumping'
    } else if (_wish.lengthSq() > 0) {
      if (this.controller.stairsIntent > 0) anim = 'stairsUp'
      else if (this.controller.stairsIntent < 0) anim = 'stairsDown'
      else anim = running ? 'running' : 'walking'
    }

    const firstPerson = this.cameraMode === 'firstPerson'
    this.visual.syncFromController(this.controller.position, this.controller.yaw, anim, firstPerson)
    this.visual.update(dt)

    if (firstPerson) {
      const eye = this.controller.getEyePosition()
      this.camera.position.copy(eye)
      this.camera.rotation.set(this.controller.pitch, this.controller.yaw, 0, 'YXZ')
    } else {
      // Third-person boom — Street View drop stays readable.
      const yaw = this.controller.yaw
      const pitch = Math.min(0.55, Math.max(-0.35, this.controller.pitch))
      const dist = this.followDistance
      _desired.set(
        this.controller.position.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        this.controller.position.y + this.followHeight + Math.sin(-pitch) * dist * 0.35,
        this.controller.position.z + Math.cos(yaw) * Math.cos(pitch) * dist,
      )
      this.camera.position.lerp(_desired, 1 - Math.exp(-10 * dt))
      _camTarget.set(
        this.controller.position.x,
        this.controller.position.y + this.lookAtHeight,
        this.controller.position.z,
      )
      this.camera.lookAt(_camTarget)
    }
  }

  dispose(): void {
    this.deactivate()
  }
}
