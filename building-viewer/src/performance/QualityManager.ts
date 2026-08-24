export type QualityProfileId = 'AUTO' | 'DESKTOP_HIGH' | 'DESKTOP_BALANCED' | 'QUEST'

export type QualityConfig = {
  id: Exclude<QualityProfileId, 'AUTO'>
  label: string
  pixelRatioMax: number
  shadowMapSize: number
  anisotropy: number
  environmentIntensity: number
  characterBlobShadow: boolean
  dynamicActorShadows: boolean
  postProcessing: boolean
  modelVariant: 'web' | 'quest'
  xrFoveation: number | null
  /** WebXR framebuffer scale (1 = native; <1 reduces GPU fill). */
  xrFramebufferScale: number | null
  softShadows: boolean
  localShadows: boolean
  cheapEnvironment: boolean
  /** Context creation preference — applied at renderer bootstrap. */
  antialias: boolean
  /** Prefer false when near/far are bounds-tight (cheaper depth). */
  logarithmicDepth: boolean
  /** AgX looks best; ACES/Linear are cheaper on Quest. */
  toneMapping: 'agx' | 'aces' | 'linear'
  /** Instancing / batch thresholds (lower = pack more on Performance). */
  minInstances: number
  minBatchSize: number
}

const PROFILES: Record<Exclude<QualityProfileId, 'AUTO'>, QualityConfig> = {
  DESKTOP_HIGH: {
    id: 'DESKTOP_HIGH',
    label: 'High',
    // 1.5 keeps sharpness on retina without the MSAA×DPR blowup of 1.75–2.
    pixelRatioMax: 1.5,
    shadowMapSize: 2048,
    anisotropy: 4,
    environmentIntensity: 0.85,
    characterBlobShadow: true,
    dynamicActorShadows: false,
    postProcessing: false,
    modelVariant: 'web',
    xrFoveation: null,
    xrFramebufferScale: null,
    softShadows: true,
    localShadows: false,
    cheapEnvironment: false,
    antialias: true,
    logarithmicDepth: false,
    toneMapping: 'agx',
    minInstances: 3,
    minBatchSize: 12,
  },
  DESKTOP_BALANCED: {
    id: 'DESKTOP_BALANCED',
    label: 'Balanced',
    pixelRatioMax: 1.25,
    shadowMapSize: 1024,
    anisotropy: 2,
    environmentIntensity: 0.7,
    characterBlobShadow: true,
    dynamicActorShadows: false,
    postProcessing: false,
    modelVariant: 'web',
    xrFoveation: null,
    xrFramebufferScale: null,
    softShadows: true,
    localShadows: false,
    cheapEnvironment: false,
    antialias: false,
    logarithmicDepth: false,
    toneMapping: 'agx',
    minInstances: 3,
    minBatchSize: 10,
  },
  QUEST: {
    id: 'QUEST',
    label: 'Performance',
    pixelRatioMax: 1,
    shadowMapSize: 512,
    anisotropy: 1,
    environmentIntensity: 0.55,
    characterBlobShadow: false,
    dynamicActorShadows: false,
    postProcessing: false,
    modelVariant: 'quest',
    // Medium foveation — max (1) softens architectural edges/text too aggressively.
    xrFoveation: 0.5,
    // Slight under-scale buys fill-rate headroom on Quest 3 at 72 Hz.
    xrFramebufferScale: 0.9,
    softShadows: false,
    localShadows: true,
    cheapEnvironment: true,
    antialias: false,
    logarithmicDepth: false,
    toneMapping: 'aces',
    minInstances: 2,
    minBatchSize: 6,
  },
}

export const QUALITY_BUTTONS: { id: QualityProfileId; label: string }[] = [
  { id: 'AUTO', label: 'Auto' },
  { id: 'DESKTOP_HIGH', label: 'High' },
  { id: 'DESKTOP_BALANCED', label: 'Balanced' },
  { id: 'QUEST', label: 'Performance' },
]

/** Heuristic used before the first frame / for WebGL context flags. */
export function detectBootQualityProfile(): Exclude<QualityProfileId, 'AUTO'> {
  if (typeof navigator === 'undefined') return 'DESKTOP_BALANCED'
  if (/OculusBrowser|Quest/i.test(navigator.userAgent)) return 'QUEST'
  const cores = navigator.hardwareConcurrency || 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  if (cores <= 4 || mem <= 4) return 'QUEST'
  if (cores <= 6 || mem <= 6) return 'DESKTOP_BALANCED'
  return 'DESKTOP_BALANCED'
}

export class QualityManager {
  private preferred: QualityProfileId = 'DESKTOP_BALANCED'
  private resolved: QualityConfig = PROFILES.DESKTOP_BALANCED
  private fpsEma = 60

  constructor(bootPreferred?: QualityProfileId) {
    if (bootPreferred) {
      this.preferred = bootPreferred
      this.resolved = this.resolve()
    }
  }

  getProfile(): QualityConfig {
    return this.resolved
  }

  getPreferred(): QualityProfileId {
    return this.preferred
  }

  setPreferred(id: QualityProfileId): QualityConfig {
    this.preferred = id
    this.resolved = this.resolve()
    return this.resolved
  }

  noteFps(fps: number): QualityConfig {
    if (!Number.isFinite(fps) || fps <= 0) return this.resolved
    this.fpsEma = this.fpsEma * 0.85 + fps * 0.15
    if (this.preferred === 'AUTO') {
      const next = this.resolve()
      if (next.id !== this.resolved.id) this.resolved = next
    }
    return this.resolved
  }

  detectXrLikely(): boolean {
    if (typeof navigator === 'undefined') return false
    return Boolean(navigator.xr)
  }

  private resolve(): QualityConfig {
    if (this.preferred !== 'AUTO') return PROFILES[this.preferred]

    const xr = this.detectXrLikely()
    const cores = navigator.hardwareConcurrency || 4
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    if (xr && /OculusBrowser|Quest/i.test(navigator.userAgent)) return PROFILES.QUEST
    if (this.fpsEma < 35 || cores <= 4 || mem <= 4) return PROFILES.QUEST
    if (this.fpsEma < 48 || cores <= 6 || mem <= 6) return PROFILES.DESKTOP_BALANCED
    if (dpr >= 2 && cores >= 8 && mem >= 8 && this.fpsEma > 55) return PROFILES.DESKTOP_HIGH
    return PROFILES.DESKTOP_BALANCED
  }
}
