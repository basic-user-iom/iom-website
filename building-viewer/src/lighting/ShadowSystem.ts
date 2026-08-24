import {
  BasicShadowMap,
  DirectionalLight,
  PCFSoftShadowMap,
  Vector3,
  WebGLRenderer,
  type ShadowMapType,
} from 'three'
import type { QualityConfig } from '../performance/QualityManager'
import type { SceneBounds } from '../scene/SceneBounds'

const _lightDir = new Vector3()
const _focus = new Vector3()
const _lastFocus = new Vector3(Number.POSITIVE_INFINITY, 0, 0)

export type ShadowFitMode = 'fullScene' | 'localRegion'

/**
 * Architecture-focused static shadow system with a Quest-safe local region mode.
 *
 * Desktop: fit orthographic frustum to the whole building once, then cache.
 * Quest: keep a smaller player/camera-centered shadow region so 1024 maps stay sharp
 * and cheap; rebuild only when the focus moves past a threshold.
 */
export class ShadowSystem {
  private mapSize = 2048
  private fitMode: ShadowFitMode = 'fullScene'
  private localRadius = 28
  private moveThreshold = 8
  private bounds: SceneBounds | null = null
  private softShadows = true
  private enabled = true
  private preferredLocalForXr = false

  constructor(private readonly light: DirectionalLight) {
    this.light.castShadow = true
    this.light.shadow.autoUpdate = false
    this.light.shadow.needsUpdate = true
    this.light.shadow.bias = -0.0004
    this.light.shadow.normalBias = 0.04
    this.light.shadow.radius = 1
    this.light.shadow.mapSize.set(this.mapSize, this.mapSize)
  }

  configureRenderer(renderer: WebGLRenderer): void {
    renderer.shadowMap.enabled = this.enabled
    renderer.shadowMap.type = this.resolveShadowMapType()
  }

  applyQuality(config: QualityConfig, renderer?: WebGLRenderer): void {
    // Desktop always uses a static full-scene shadow map so shadows never crawl
    // when the character walks. Local-region is enabled separately for active XR.
    this.fitMode = 'fullScene'
    this.softShadows = config.softShadows
    this.localRadius = config.id === 'QUEST' ? 22 : 36
    this.moveThreshold = config.id === 'QUEST' ? 6 : 10
    this.enabled = config.shadowMapSize > 0
    this.light.castShadow = this.enabled
    this.preferredLocalForXr = config.localShadows === true

    if (this.enabled) {
      const nextSize = Math.max(512, config.shadowMapSize)
      const sizeChanged = nextSize !== this.mapSize
      this.mapSize = nextSize
      this.light.shadow.mapSize.set(this.mapSize, this.mapSize)
      if (sizeChanged && this.light.shadow.map) {
        this.light.shadow.map.dispose()
        this.light.shadow.map = null
      }
    }
    this.light.shadow.radius = this.softShadows ? 2 : 1

    if (renderer) {
      renderer.shadowMap.enabled = this.enabled
      renderer.shadowMap.type = this.resolveShadowMapType()
    }

    this.light.shadow.autoUpdate = false

    if (this.bounds) {
      _lastFocus.set(Number.POSITIVE_INFINITY, 0, 0)
      this.fitToBounds(this.bounds)
    } else {
      this.requestUpdate()
    }
  }

  /**
   * XR-only: switch to a player-centered shadow region. Desktop walk must stay on
   * fullScene so building shadows remain locked in world space.
   */
  setXrLocalRegion(enabled: boolean, focus?: Vector3): void {
    const next: ShadowFitMode = enabled && this.preferredLocalForXr ? 'localRegion' : 'fullScene'
    if (next === this.fitMode && !enabled) return
    this.fitMode = next
    this.light.shadow.autoUpdate = false
    if (this.bounds) {
      _lastFocus.set(Number.POSITIVE_INFINITY, 0, 0)
      this.fitToBounds(this.bounds, focus)
    }
  }

  fitToBounds(bounds: SceneBounds, focus?: Vector3): void {
    this.bounds = bounds
    if (!this.enabled) return

    if (this.fitMode === 'localRegion') {
      _focus.copy(focus ?? bounds.center)
      this.fitLocalRegion(_focus, bounds)
      return
    }

    this.fitFullScene(bounds)
  }

  /**
   * Call from the render loop (throttled by caller) while walking / in XR.
   * Rebuilds the Quest local shadow region only after meaningful movement.
   */
  updateFocus(focus: Vector3): boolean {
    if (!this.enabled || this.fitMode !== 'localRegion' || !this.bounds) return false
    if (_lastFocus.distanceToSquared(focus) < this.moveThreshold * this.moveThreshold) {
      return false
    }
    this.fitLocalRegion(focus, this.bounds)
    return true
  }

  private fitFullScene(bounds: SceneBounds): void {
    const cam = this.light.shadow.camera
    // Fit the ortho map to the ground footprint, not the bounding sphere
    // (sphere padding on a 500 m campus makes a 1024 map look like no shadows).
    const groundHalf = Math.max(bounds.size.x, bounds.size.z, 40) * 0.5
    const pad = groundHalf * 1.12
    const distance = this.light.position.distanceTo(this.light.target.position)
    const height = Math.max(bounds.size.y, 16)
    const along = groundHalf * 1.35 + height

    cam.left = -pad
    cam.right = pad
    cam.top = pad
    cam.bottom = -pad
    cam.near = Math.max(distance - along, 1)
    cam.far = distance + along
    cam.updateProjectionMatrix()

    this.light.shadow.bias = -0.00012
    this.light.shadow.normalBias = 0.022
    _lastFocus.copy(bounds.center)
    this.requestUpdate()
  }

  private fitLocalRegion(focus: Vector3, bounds: SceneBounds): void {
    const cam = this.light.shadow.camera
    const radius = Math.min(this.localRadius, Math.max(12, bounds.radius * 0.35))

    // Keep the light aimed at the local focus so the ortho frustum stays useful.
    this.light.target.position.copy(focus)
    this.light.target.updateMatrixWorld()

    _lightDir.subVectors(this.light.position, focus).normalize()
    // Preserve sun direction while recentering distance for the local volume.
    const sunDist = Math.max(radius * 2.4, 40)
    this.light.position.copy(focus).addScaledVector(_lightDir, sunDist)

    const distance = this.light.position.distanceTo(focus)
    cam.left = -radius
    cam.right = radius
    cam.top = radius
    cam.bottom = -radius
    cam.near = Math.max(distance - radius * 1.6, 0.5)
    cam.far = distance + radius * 1.6
    cam.updateProjectionMatrix()

    // Slightly stronger bias on Quest — low-res maps acne easily on plazas.
    this.light.shadow.bias = -0.00055
    this.light.shadow.normalBias = 0.055
    _lastFocus.copy(focus)
    this.requestUpdate()
  }

  requestUpdate(): void {
    if (!this.enabled) return
    this.light.shadow.autoUpdate = false
    this.light.shadow.needsUpdate = true
  }

  markCached(): void {
    this.light.shadow.autoUpdate = false
    this.light.shadow.needsUpdate = false
  }

  getMapSize(): number {
    return this.mapSize
  }

  getFitMode(): ShadowFitMode {
    return this.fitMode
  }

  isEnabled(): boolean {
    return this.enabled
  }

  private resolveShadowMapType(): ShadowMapType {
    if (!this.softShadows) return BasicShadowMap
    // Soft PCF is fine on desktop; keep hard PCF as a middle ground if needed later.
    return PCFSoftShadowMap
  }

  dispose(): void {
    this.light.shadow.map?.dispose()
  }
}
