import {
  Color,
  EquirectangularReflectionMapping,
  PMREMGenerator,
  Scene,
  WebGLRenderer,
  type Texture,
} from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

export type DaylightPresetId = 'daylight' | 'overcast' | 'goldenHour' | 'studio'

export type DaylightPreset = {
  id: DaylightPresetId
  label: string
  /** Relative sun direction (normalized later against scene center). */
  sunDir: [number, number, number]
  sunIntensity: number
  sunColor: number
  hemiSky: number
  hemiGround: number
  hemiIntensity: number
  ambientIntensity: number
  exposure: number
  /** Use outdoor HDRI when available; otherwise procedural room. */
  useHdr: boolean
  backgroundColor: number
  environmentIntensity: number
  backgroundBlurriness: number
  backgroundIntensity: number
}

export type EffectiveDaylightSettings = {
  sunIntensity: number
  hemisphereIntensity: number
  ambientIntensity: number
  exposure: number
  environmentIntensity: number
  backgroundBlurriness: number
  backgroundIntensity: number
}

export const DAYLIGHT_PRESETS: Record<DaylightPresetId, DaylightPreset> = {
  daylight: {
    id: 'daylight',
    label: 'Daylight',
    // Calibrated for AgX with the quarry HDR. The HDR already supplies broad
    // indirect light, so hemisphere/ambient are intentionally only a subtle
    // fallback fill instead of a second full-strength sky contribution.
    sunDir: [0.55, 0.85, 0.5],
    sunIntensity: 4.2,
    sunColor: 0xfff4e0,
    hemiSky: 0x9ec8ff,
    hemiGround: 0x6a5a48,
    hemiIntensity: 0.28,
    ambientIntensity: 0.02,
    exposure: 0.95,
    useHdr: true,
    backgroundColor: 0x87a0b8,
    environmentIntensity: 0.72,
    backgroundBlurriness: 0.02,
    backgroundIntensity: 1.0,
  },
  overcast: {
    id: 'overcast',
    label: 'Overcast',
    sunDir: [0.2, 1, 0.15],
    sunIntensity: 1.4,
    sunColor: 0xe8eef5,
    hemiSky: 0xb8c4d0,
    hemiGround: 0x5a5a58,
    hemiIntensity: 0.9,
    ambientIntensity: 0.22,
    exposure: 1.15,
    useHdr: true,
    backgroundColor: 0x8a9299,
    environmentIntensity: 0.75,
    backgroundBlurriness: 0.35,
    backgroundIntensity: 0.85,
  },
  goldenHour: {
    id: 'goldenHour',
    label: 'Golden Hour',
    sunDir: [0.95, 0.28, 0.35],
    sunIntensity: 5.2,
    sunColor: 0xffb068,
    hemiSky: 0xffc8a0,
    hemiGround: 0x4a3020,
    hemiIntensity: 0.4,
    ambientIntensity: 0.1,
    exposure: 1.25,
    useHdr: true,
    backgroundColor: 0xc48a5a,
    environmentIntensity: 0.85,
    backgroundBlurriness: 0.08,
    backgroundIntensity: 0.95,
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    sunDir: [0.65, 0.75, 0.4],
    sunIntensity: 2.4,
    sunColor: 0xfff2dd,
    hemiSky: 0xc8d8ff,
    hemiGround: 0x3a3028,
    hemiIntensity: 0.45,
    ambientIntensity: 0.12,
    exposure: 1.0,
    useHdr: false,
    backgroundColor: 0x1a1c1f,
    environmentIntensity: 0.85,
    backgroundBlurriness: 0,
    backgroundIntensity: 1,
  },
}

/**
 * Resolve the exact values applied by LightingSystem for a quality profile.
 * Keeping this arithmetic pure makes preset/profile interactions testable
 * without constructing a WebGL renderer.
 */
export function resolveEffectiveDaylight(
  preset: DaylightPreset,
  qualityEnvironmentScale: number,
): EffectiveDaylightSettings {
  const scale = Number.isFinite(qualityEnvironmentScale)
    ? Math.max(0, qualityEnvironmentScale)
    : 1
  return {
    // Keep a readable key light on low-end profiles while all fill and image-
    // based lighting scale down normally. This has no additional GPU cost.
    sunIntensity: preset.sunIntensity * Math.max(0.65, scale),
    hemisphereIntensity: preset.hemiIntensity * scale,
    ambientIntensity: preset.ambientIntensity * scale,
    exposure: preset.exposure,
    environmentIntensity: preset.environmentIntensity * scale,
    backgroundBlurriness: preset.backgroundBlurriness,
    backgroundIntensity: preset.backgroundIntensity,
  }
}

const DEFAULT_HDR_URL = '/demos/ssr-denoise/textures/quarry_01_1k.hdr'

/**
 * Loads and caches outdoor HDR (same quarry map used by the SSR denoise demo).
 */
export class EnvironmentLibrary {
  private hdr: Texture | null = null
  private roomEnv: Texture | null = null
  private pmrem: PMREMGenerator | null = null
  private loading: Promise<Texture | null> | null = null

  configure(renderer: WebGLRenderer): void {
    if (!this.pmrem) this.pmrem = new PMREMGenerator(renderer)
  }

  getRoomEnvironment(): Texture {
    if (!this.roomEnv && this.pmrem) {
      const room = new RoomEnvironment()
      this.roomEnv = this.pmrem.fromScene(room, 0.04).texture
      room.dispose?.()
    }
    return this.roomEnv!
  }

  async loadHdr(url = DEFAULT_HDR_URL): Promise<Texture | null> {
    if (this.hdr) return this.hdr
    if (this.loading) return this.loading
    this.loading = (async () => {
      try {
        const loader = new HDRLoader()
        const tex = await loader.loadAsync(url)
        tex.mapping = EquirectangularReflectionMapping
        if (this.pmrem) {
          this.hdr = this.pmrem.fromEquirectangular(tex).texture
          tex.dispose()
        } else {
          this.hdr = tex
        }
        return this.hdr
      } catch (err) {
        console.warn('[Lighting] HDR load failed, falling back to studio env', err)
        return null
      } finally {
        this.loading = null
      }
    })()
    return this.loading
  }

  dispose(): void {
    this.hdr?.dispose()
    this.roomEnv?.dispose()
    this.pmrem?.dispose()
    this.hdr = null
    this.roomEnv = null
    this.pmrem = null
  }
}

export function applyBackgroundColor(scene: Scene, hex: number): void {
  if (scene.background instanceof Color) scene.background.setHex(hex)
  else scene.background = new Color(hex)
}
