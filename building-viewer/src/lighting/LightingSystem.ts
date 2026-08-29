import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  Scene,
  WebGLRenderer,
  SRGBColorSpace,
  AgXToneMapping,
  ACESFilmicToneMapping,
  LinearToneMapping,
  type ToneMapping,
} from 'three'
import type { QualityConfig } from '../performance/QualityManager'
import type { SceneBounds } from '../scene/SceneBounds'
import { ShadowSystem } from './ShadowSystem'
import {
  DAYLIGHT_PRESETS,
  EnvironmentLibrary,
  applyBackgroundColor,
  resolveEffectiveDaylight,
  type DaylightPresetId,
} from './DaylightPresets'

export class LightingSystem {
  readonly sun: DirectionalLight
  private readonly hemi: HemisphereLight
  private readonly ambient: AmbientLight
  readonly shadows: ShadowSystem
  private readonly envLib = new EnvironmentLibrary()
  private renderer: WebGLRenderer | null = null
  private presetId: DaylightPresetId = 'daylight'
  private bounds: SceneBounds | null = null
  private qualityScale = 1
  private lastQuality: QualityConfig | null = null

  constructor(private readonly scene: Scene) {
    this.hemi = new HemisphereLight(0xc8d8ff, 0x3a3028, 0.45)
    this.ambient = new AmbientLight(0xffffff, 0.12)
    this.sun = new DirectionalLight(0xfff2dd, 2.4)
    this.sun.position.set(40, 60, 20)
    this.sun.castShadow = true
    this.scene.add(this.hemi, this.ambient, this.sun)
    this.shadows = new ShadowSystem(this.sun)
    this.scene.background = new Color(0x1a1c1f)
  }

  configureRenderer(renderer: WebGLRenderer): void {
    this.renderer = renderer
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = AgXToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.shadowMap.enabled = true
    this.shadows.configureRenderer(renderer)
    this.envLib.configure(renderer)
  }

  private resolveToneMapping(mode: QualityConfig['toneMapping']): ToneMapping {
    if (mode === 'linear') return LinearToneMapping
    if (mode === 'aces') return ACESFilmicToneMapping
    return AgXToneMapping
  }

  getPresetId(): DaylightPresetId {
    return this.presetId
  }

  async setPreset(id: DaylightPresetId): Promise<void> {
    this.presetId = id
    await this.applyPreset()
  }

  applyQuality(config: QualityConfig): void {
    this.lastQuality = config
    this.qualityScale = config.environmentIntensity
    if (this.renderer) {
      this.renderer.toneMapping = this.resolveToneMapping(config.toneMapping)
    }
    void this.applyPreset()
    this.shadows.applyQuality(config, this.renderer ?? undefined)
  }

  fitToBounds(bounds: SceneBounds, focus?: import('three').Vector3): void {
    this.bounds = bounds
    this.placeSun(bounds)
    this.shadows.fitToBounds(bounds, focus)
  }

  /** Quest local shadows — recenters the cached region when the player moves far enough. */
  updateShadowFocus(focus: import('three').Vector3): boolean {
    return this.shadows.updateFocus(focus)
  }

  /**
   * Enable player-centered shadows only while WebXR is active.
   * Desktop walk keeps a locked full-scene shadow map.
   */
  setXrShadowMode(enabled: boolean, focus?: import('three').Vector3): void {
    this.shadows.setXrLocalRegion(enabled, focus)
    if (this.bounds) {
      if (!enabled) this.placeSun(this.bounds)
      this.shadows.fitToBounds(this.bounds, focus)
    }
    this.requestShadowUpdate()
  }

  requestShadowUpdate(): void {
    this.shadows.requestUpdate()
  }

  private placeSun(bounds: SceneBounds): void {
    const preset = DAYLIGHT_PRESETS[this.presetId]
    const r = bounds.radius
    const c = bounds.center
    const [dx, dy, dz] = preset.sunDir
    const len = Math.hypot(dx, dy, dz) || 1
    this.sun.position.set(
      c.x + (dx / len) * r * 1.6,
      c.y + (dy / len) * r * 1.8,
      c.z + (dz / len) * r * 1.6,
    )
    this.sun.target.position.copy(c)
    this.sun.target.updateMatrixWorld()
    if (!this.sun.target.parent) this.scene.add(this.sun.target)
  }

  private async applyPreset(): Promise<void> {
    const preset = DAYLIGHT_PRESETS[this.presetId]
    const scale = this.qualityScale
    const cheapEnv = this.lastQuality?.cheapEnvironment === true
    const effective = resolveEffectiveDaylight(preset, scale)

    this.sun.color.setHex(preset.sunColor)
    this.sun.intensity = effective.sunIntensity
    this.hemi.color.setHex(preset.hemiSky)
    this.hemi.groundColor.setHex(preset.hemiGround)
    this.hemi.intensity = effective.hemisphereIntensity
    this.ambient.intensity = effective.ambientIntensity

    if (this.renderer) {
      this.renderer.toneMappingExposure = effective.exposure
    }

    this.scene.environmentIntensity = effective.environmentIntensity
    this.scene.backgroundBlurriness = effective.backgroundBlurriness
    this.scene.backgroundIntensity = effective.backgroundIntensity

    if (preset.useHdr && !cheapEnv) {
      const hdr = await this.envLib.loadHdr()
      if (hdr) {
        this.scene.environment = hdr
        this.scene.background = hdr
      } else {
        this.scene.environment = this.envLib.getRoomEnvironment()
        applyBackgroundColor(this.scene, preset.backgroundColor)
      }
    } else {
      this.scene.environment = this.envLib.getRoomEnvironment()
      applyBackgroundColor(this.scene, preset.backgroundColor)
    }

    if (this.bounds) {
      this.placeSun(this.bounds)
      this.shadows.fitToBounds(this.bounds)
    }
    this.requestShadowUpdate()
  }

  dispose(): void {
    this.envLib.dispose()
    this.shadows.dispose()
  }
}
