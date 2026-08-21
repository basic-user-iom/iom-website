import {
  Camera,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  SpotLight,
  Vector3,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import type { VehicleLightsController } from './vehicleLights'

export type BeamGizmoMode = 'position' | 'aim' | 'rotate'

const _worldPos = new Vector3()
const _worldTarget = new Vector3()
const _dir = new Vector3()
const _delta = new Vector3()
const _prevLocal = new Vector3()

/**
 * Drag beam SpotLights (or their aim targets) with TransformControls.
 *
 * SpotLight cones follow `target`, not the light quaternion:
 * - Move light → translate aim by the same delta so the pool follows
 * - Rotate → turn an orientation proxy, then rewrite aim along its forward
 */
export class BeamProxyEditor {
  private controls: TransformControls | null = null
  private helper: ReturnType<TransformControls['getHelper']> | null = null
  private scene: Scene | null = null
  private orbit: OrbitControls | null = null
  private lights: VehicleLightsController | null = null
  private enabled = false
  private mode: BeamGizmoMode = 'position'
  private selectedId: string | null = null
  private onCommit: (() => void) | null = null
  private onCameraLock: ((locked: boolean) => void) | null = null
  private orbitWasEnabled = false
  private dragging = false
  private aimDistance = 4
  /** Local light position before the latest objectChange (move-with-aim). */
  private lastLightLocal = new Vector3()
  /**
   * Rotate attaches here instead of the SpotLight — Three’s light matrix is driven by
   * position/target, so rotating the SpotLight itself is a no-op for the cone.
   */
  private orientProxy: Object3D | null = null

  attach(opts: {
    camera: PerspectiveCamera | OrthographicCamera | Camera
    domElement: HTMLElement
    scene: Scene
    orbit: OrbitControls
    lights: VehicleLightsController
    onCommit: () => void
    onCameraLock?: (locked: boolean) => void
  }) {
    this.dispose()
    this.scene = opts.scene
    this.orbit = opts.orbit
    this.lights = opts.lights
    this.onCommit = opts.onCommit
    this.onCameraLock = opts.onCameraLock ?? null
    const tc = new TransformControls(opts.camera, opts.domElement)
    tc.setMode('translate')
    tc.setSpace('world')
    tc.setSize(0.85)
    tc.addEventListener('dragging-changed', (event) => {
      const isDragging = Boolean((event as { value?: boolean }).value)
      if (isDragging) this.onDragStart()
      this.setDragging(isDragging)
      if (!isDragging) this.commit()
    })
    tc.addEventListener('objectChange', () => {
      this.onObjectChange()
    })
    this.controls = tc
    this.helper = tc.getHelper()
    opts.scene.add(this.helper)

    this.orientProxy = new Object3D()
    this.orientProxy.name = 'iom-beam-orient-proxy'
    opts.scene.add(this.orientProxy)
  }

  private onDragStart() {
    const light = this.selectedLight()
    if (!light) return
    if (this.mode === 'position') {
      this.lastLightLocal.copy(light.position)
    } else if (this.mode === 'rotate') {
      this.aimDistance = worldAimDistance(light)
      this.syncOrientProxyFromLight(light)
    }
  }

  private onObjectChange() {
    const light = this.selectedLight()
    if (!light) return
    if (this.mode === 'position') {
      // Keep aim offset locked in parent space so the ground pool tracks the bulb.
      _delta.copy(light.position).sub(this.lastLightLocal)
      light.target.position.add(_delta)
      this.lastLightLocal.copy(light.position)
      light.target.updateMatrixWorld(true)
    } else if (this.mode === 'rotate' && this.orientProxy) {
      syncAimFromProxy(light, this.orientProxy, this.aimDistance)
    }
  }

  private selectedLight(): SpotLight | null {
    if (!this.selectedId || !this.lights) return null
    return this.lights.getBeamLight(this.selectedId)
  }

  private setDragging(isDragging: boolean) {
    if (this.dragging === isDragging) return
    this.dragging = isDragging
    if (this.orbit) {
      if (isDragging) {
        this.orbitWasEnabled = this.orbit.enabled
        this.orbit.enabled = false
      } else {
        this.orbit.enabled = this.orbitWasEnabled
      }
    }
    this.onCameraLock?.(isDragging)
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (!on) {
      this.setDragging(false)
      this.detachObject()
    } else {
      this.refreshAttachment()
    }
  }

  isEnabled() {
    return this.enabled
  }

  isDragging() {
    return this.dragging
  }

  setMode(mode: BeamGizmoMode) {
    this.mode = mode
    this.refreshAttachment()
  }

  getMode() {
    return this.mode
  }

  select(id: string | null) {
    this.selectedId = id
    this.refreshAttachment()
  }

  getSelectedId() {
    return this.selectedId
  }

  /** Re-bind after lights rebuild (proxy SpotLights are new objects). */
  refreshAttachment() {
    if (this.dragging) return
    if (!this.enabled || !this.controls || !this.lights || !this.selectedId) {
      this.detachObject()
      return
    }
    const light = this.lights.getBeamLight(this.selectedId)
    if (!light) {
      this.detachObject()
      return
    }
    light.updateWorldMatrix(true, true)
    light.target.updateWorldMatrix(true, true)

    if (this.mode === 'aim') {
      this.controls.setMode('translate')
      this.controls.setSpace('local')
      this.controls.attach(light.target)
    } else if (this.mode === 'rotate') {
      this.aimDistance = worldAimDistance(light)
      this.syncOrientProxyFromLight(light)
      this.controls.setMode('rotate')
      this.controls.setSpace('local')
      if (this.orientProxy) this.controls.attach(this.orientProxy)
    } else {
      this.lastLightLocal.copy(light.position)
      this.controls.setMode('translate')
      // World space: local SpotLight axes follow the aim target and make the
      // gizmo look "stuck" / skewed relative to the car while free-driving.
      this.controls.setSpace('world')
      this.controls.attach(light)
    }
    if (this.helper) {
      this.helper.visible = true
      this.helper.updateMatrixWorld(true)
    }
  }

  private syncOrientProxyFromLight(light: SpotLight) {
    if (!this.orientProxy) return
    light.getWorldPosition(_worldPos)
    light.target.getWorldPosition(_worldTarget)
    this.orientProxy.position.copy(_worldPos)
    this.orientProxy.lookAt(_worldTarget)
    this.orientProxy.updateMatrixWorld(true)
  }

  private detachObject() {
    this.controls?.detach()
    if (this.helper) this.helper.visible = false
  }

  private commit() {
    if (!this.lights || !this.onCommit) return
    if (this.mode === 'rotate') {
      const light = this.selectedLight()
      if (light && this.orientProxy) {
        syncAimFromProxy(light, this.orientProxy, this.aimDistance)
      }
    }
    // Host merges live transforms into the store list (keeps duplicates).
    this.onCommit()
  }

  dispose() {
    this.setDragging(false)
    if (this.controls && this.scene && this.helper) {
      this.controls.detach()
      this.scene.remove(this.helper)
      this.controls.dispose()
    }
    if (this.orientProxy && this.scene) {
      this.scene.remove(this.orientProxy)
    }
    this.controls = null
    this.helper = null
    this.orientProxy = null
    this.scene = null
    this.orbit = null
    this.lights = null
    this.onCommit = null
    this.onCameraLock = null
    this.enabled = false
    this.selectedId = null
  }
}

function worldAimDistance(light: SpotLight): number {
  light.getWorldPosition(_worldPos)
  light.target.getWorldPosition(_worldTarget)
  return Math.max(0.35, _worldPos.distanceTo(_worldTarget))
}

function syncAimFromProxy(light: SpotLight, proxy: Object3D, distance: number) {
  const dist = Math.max(0.35, distance)
  proxy.getWorldPosition(_worldPos)
  proxy.getWorldDirection(_dir)
  _worldTarget.copy(_worldPos).addScaledVector(_dir, dist)
  // Keep the bulb under the gizmo if the proxy was translated somehow.
  if (light.parent) {
    _prevLocal.copy(_worldPos)
    light.parent.worldToLocal(_prevLocal)
    light.position.copy(_prevLocal)
  }
  if (light.target.parent) {
    light.target.parent.worldToLocal(_worldTarget)
    light.target.position.copy(_worldTarget)
  } else {
    light.target.position.copy(_worldTarget)
  }
  light.updateMatrixWorld(true)
  light.target.updateMatrixWorld(true)
}
