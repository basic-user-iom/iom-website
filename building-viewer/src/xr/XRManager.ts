import type { WebGLRenderer, PerspectiveCamera, Scene } from 'three'
import { Group as ThreeGroup, Vector3 } from 'three'

/**
 * WebXR player rig — locomotion moves the rig; headset owns the camera.
 */
export class XRPlayerRig {
  readonly root = new ThreeGroup()
  readonly cameraHolder = new ThreeGroup()
  private session: XRSession | null = null

  constructor() {
    this.root.name = 'XRPlayerRig'
    this.cameraHolder.name = 'XRCameraHolder'
    this.root.add(this.cameraHolder)
  }

  attachCamera(camera: PerspectiveCamera): void {
    this.cameraHolder.add(camera)
  }

  setFeetPosition(feet: Vector3, yaw = 0): void {
    this.root.position.copy(feet)
    this.root.rotation.y = yaw
  }

  translate(delta: Vector3): void {
    this.root.position.add(delta)
  }

  snapTurn(radians: number): void {
    this.root.rotation.y += radians
  }

  setSession(session: XRSession | null): void {
    this.session = session
  }

  getSession(): XRSession | null {
    return this.session
  }
}

export class XRManager {
  private supported: boolean | null = null
  private session: XRSession | null = null
  readonly rig = new XRPlayerRig()
  private onSessionEnd: (() => void) | null = null
  private cameraParent: Scene | ThreeGroup | null = null
  private scene: Scene | null = null
  private camera: PerspectiveCamera | null = null
  private controllersAdded = false

  constructor(private readonly renderer: WebGLRenderer) {}

  setSessionEndHandler(handler: (() => void) | null): void {
    this.onSessionEnd = handler
  }

  async checkSupport(): Promise<boolean> {
    if (this.supported != null) return this.supported
    const xr = navigator.xr
    if (!xr) {
      this.supported = false
      return false
    }
    try {
      this.supported = await xr.isSessionSupported('immersive-vr')
    } catch {
      this.supported = false
    }
    return this.supported
  }

  isSupported(): boolean {
    return Boolean(this.supported)
  }

  isActive(): boolean {
    return Boolean(this.session)
  }

  getFrameRate(): number | null {
    const rate = this.session?.frameRate
    return typeof rate === 'number' ? rate : null
  }

  getFoveation(): number | null {
    const v = this.renderer.xr.getFoveation?.()
    return typeof v === 'number' ? v : null
  }

  setFoveation(level: number | null): void {
    if (level == null) return
    try {
      this.renderer.xr.setFoveation(level)
    } catch {
      // Capability not supported on this headset/browser.
    }
  }

  setFramebufferScale(scale: number | null): void {
    if (scale == null) return
    try {
      this.renderer.xr.setFramebufferScaleFactor(scale)
    } catch {
      // Older Three / browser builds may omit the API.
    }
  }

  /**
   * Place the XR rig in the scene and re-parent the camera under the headset holder.
   * Call after a successful enterVR().
   */
  mountRig(scene: Scene, camera: PerspectiveCamera, feet: Vector3, yaw = 0): void {
    this.scene = scene
    this.camera = camera
    this.cameraParent = camera.parent as Scene | ThreeGroup | null
    if (!this.rig.root.parent) scene.add(this.rig.root)
    this.rig.setFeetPosition(feet, yaw)
    this.rig.attachCamera(camera)
    this.ensureControllers(scene)
  }

  /** Restore the camera to its pre-VR parent (usually the scene). */
  unmountRig(): void {
    if (this.camera) {
      const parent = this.cameraParent ?? this.scene
      if (parent) parent.attach(this.camera)
    }
    if (this.rig.root.parent) this.rig.root.parent.remove(this.rig.root)
    this.cameraParent = null
    this.camera = null
  }

  private ensureControllers(scene: Scene): void {
    if (this.controllersAdded) return
    this.controllersAdded = true
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i)
      controller.name = `XRController${i}`
      scene.add(controller)
      const grip = this.renderer.xr.getControllerGrip(i)
      grip.name = `XRControllerGrip${i}`
      scene.add(grip)
    }
  }

  /** Read combined thumbstick axes from both XR input sources. */
  readThumbsticks(): { lx: number; ly: number; rx: number; ry: number } {
    const out = { lx: 0, ly: 0, rx: 0, ry: 0 }
    const sources = this.session?.inputSources
    if (!sources) return out
    for (const source of sources) {
      const pad = source.gamepad
      if (!pad?.axes || pad.axes.length < 2) continue
      // Quest: axes often [touchpadX, touchpadY, thumbstickX, thumbstickY] or [thumbX, thumbY].
      const ax = pad.axes
      let x = 0
      let y = 0
      if (ax.length >= 4) {
        x = ax[2] ?? 0
        y = ax[3] ?? 0
      } else {
        x = ax[0] ?? 0
        y = ax[1] ?? 0
      }
      if (source.handedness === 'left') {
        out.lx = x
        out.ly = y
      } else if (source.handedness === 'right') {
        out.rx = x
        out.ry = y
      } else if (out.lx === 0 && out.ly === 0) {
        out.lx = x
        out.ly = y
      } else {
        out.rx = x
        out.ry = y
      }
    }
    return out
  }

  async enterVR(): Promise<boolean> {
    if (!(await this.checkSupport())) return false
    if (this.session) return true
    this.renderer.xr.enabled = true
    try {
      const session = await navigator.xr!.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
      })
      this.session = session
      this.rig.setSession(session)
      await this.renderer.xr.setSession(session)
      session.addEventListener('end', () => {
        this.session = null
        this.rig.setSession(null)
        this.unmountRig()
        this.onSessionEnd?.()
      })
      return true
    } catch (err) {
      console.warn('[XR] Failed to enter VR', err)
      return false
    }
  }

  async exitVR(): Promise<void> {
    await this.session?.end()
    this.session = null
  }

  dispose(): void {
    void this.exitVR()
  }
}

/** Quest locomotion helpers — shared collision world with desktop walk. */
export class XRLocomotion {
  private snapAngle = (30 * Math.PI) / 180
  private lastSnap = 0

  constructor(
    private readonly rig: XRPlayerRig,
    private readonly move: (forward: number, strafe: number, dt: number) => void,
  ) {}

  /** axes: [lx, ly, rx, ry] typically from gamepads */
  update(dt: number, axes: { lx: number; ly: number; rx: number; ry: number }): void {
    const dead = 0.15
    const fwd = Math.abs(axes.ly) > dead ? -axes.ly : 0
    const strafe = Math.abs(axes.lx) > dead ? axes.lx : 0
    this.move(fwd, strafe, dt)

    const now = performance.now()
    if (Math.abs(axes.rx) > 0.6 && now - this.lastSnap > 250) {
      this.rig.snapTurn(Math.sign(axes.rx) * -this.snapAngle)
      this.lastSnap = now
    }
  }
}
