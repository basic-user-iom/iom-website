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
  private entering: Promise<boolean> | null = null
  private readonly sessionEndRequests = new WeakMap<XRSession, Promise<void>>()
  private disposed = false

  constructor(private readonly renderer: WebGLRenderer) {}

  setSessionEndHandler(handler: (() => void) | null): void {
    if (this.disposed) return
    this.onSessionEnd = handler
  }

  async checkSupport(): Promise<boolean> {
    if (this.disposed) return false
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
    if (this.disposed) return false
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

  /**
   * Start requestSession before the first await. WebXR requires transient user
   * activation, which is lost if a click handler waits for isSessionSupported,
   * model loading, or any other asynchronous preparation first.
   */
  enterVR(framebufferScale: number | null = null): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false)
    if (this.entering) return this.entering
    if (this.session) return Promise.resolve(true)
    const attempt = this.requestSessionFromActivation(framebufferScale)
    const tracked = attempt.finally(() => {
      if (this.entering === tracked) this.entering = null
    })
    this.entering = tracked
    return tracked
  }

  private async requestSessionFromActivation(
    framebufferScale: number | null,
  ): Promise<boolean> {
    const xr = navigator.xr
    if (!xr || this.supported === false || this.disposed) return false
    this.renderer.xr.enabled = true
    let session: XRSession | null = null
    try {
      // Keep requestSession before the first await so transient user activation
      // survives. The framebuffer scale must then be fixed before Three installs
      // the session and marks WebXR as presenting.
      const sessionRequest = xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
      })
      this.setFramebufferScale(framebufferScale)
      session = await sessionRequest
      if (this.disposed) {
        await this.endSessionSafely(session)
        return false
      }
      this.session = session
      this.rig.setSession(session)
      session.addEventListener('end', () => {
        if (this.session === session) {
          this.session = null
          this.rig.setSession(null)
          this.unmountRig()
          this.onSessionEnd?.()
        }
      }, { once: true })
      await this.renderer.xr.setSession(session)
      if (this.disposed || this.session !== session) {
        if (this.session === session) {
          this.session = null
          this.rig.setSession(null)
        }
        await this.endSessionSafely(session)
        return false
      }
      this.supported = true
      return true
    } catch (err) {
      if (session) {
        await this.endSessionSafely(session)
      }
      if (this.session === session) {
        this.session = null
        this.rig.setSession(null)
      }
      if (!this.disposed) console.warn('[XR] Failed to enter VR', err)
      return false
    }
  }

  private async endSessionSafely(session: XRSession): Promise<void> {
    const existing = this.sessionEndRequests.get(session)
    if (existing) return existing
    const request = (async () => {
      try {
        await session.end()
      } catch {
        // The browser may already have ended a partially initialized session.
      }
    })()
    this.sessionEndRequests.set(session, request)
    return request
  }

  async exitVR(): Promise<void> {
    const session = this.session
    if (!session) return
    await this.endSessionSafely(session)
    // Browsers normally dispatch `end` before the promise resolves. Keep a
    // fallback for partial/mock implementations that do not dispatch it.
    if (this.session === session) {
      this.session = null
      this.rig.setSession(null)
      this.unmountRig()
      this.onSessionEnd?.()
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.onSessionEnd = null
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
