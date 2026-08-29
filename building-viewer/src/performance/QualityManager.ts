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
  /** Runtime fallback used when context MSAA cannot be changed after boot. */
  runtimeAntialias: boolean
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
    runtimeAntialias: true,
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
    runtimeAntialias: true,
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
    runtimeAntialias: false,
    logarithmicDepth: false,
    toneMapping: 'aces',
    minInstances: 2,
    minBatchSize: 6,
  },
}

/** Read a fixed profile without changing the manager's current preference. */
export function getQualityProfile(
  id: Exclude<QualityProfileId, 'AUTO'>,
): Readonly<QualityConfig> {
  return Object.freeze({ ...PROFILES[id] })
}

export const QUALITY_BUTTONS: { id: QualityProfileId; label: string }[] = [
  { id: 'AUTO', label: 'Auto' },
  { id: 'DESKTOP_HIGH', label: 'High' },
  { id: 'DESKTOP_BALANCED', label: 'Balanced' },
  { id: 'QUEST', label: 'Performance' },
]

export type QualityPerformanceSample = {
  fps: number
  rafP95Ms?: number
  cpuP95Ms?: number
  gpuP95Ms?: number | null
  nowMs?: number
  xrActive?: boolean
  xrFrameRate?: number | null
}

/**
 * AUTO is intentionally conservative. A quality switch can rebuild shadows,
 * resize buffers and, at the Performance boundary, replace every loaded GLB.
 * Decisions therefore use sustained p95 pressure rather than a noisy FPS
 * sample. A session that falls back to the Quest asset stays on that variant
 * until the user explicitly chooses another profile.
 */
const AUTO_WARMUP_MS = 8_000
const AUTO_DOWN_COOLDOWN_MS = 15_000
const AUTO_UP_COOLDOWN_MS = 45_000
const AUTO_STEP_DOWN_SAMPLES = 8
const AUTO_VARIANT_DOWN_SAMPLES = 24
const AUTO_STEP_UP_SAMPLES = 80

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
  private autoStartedAt: number | null = null
  private lastAutoChangeAt = Number.NEGATIVE_INFINITY
  private pressureSamples = 0
  private severePressureSamples = 0
  private healthySamples = 0
  private autoQuestLocked = false

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
    const enteringAuto = id === 'AUTO' && this.preferred !== 'AUTO'
    this.preferred = id
    if (enteringAuto) this.resetAutoState()
    if (id !== 'AUTO') this.resetAutoState()
    this.resolved = this.resolve()
    return this.resolved
  }

  /** Compatibility path for callers that do not yet expose percentile data. */
  noteFps(fps: number): QualityConfig {
    return this.notePerformance({ fps })
  }

  notePerformance(sample: QualityPerformanceSample): QualityConfig {
    const fps = sample.fps
    if (!Number.isFinite(fps) || fps <= 0) return this.resolved
    this.fpsEma = this.fpsEma * 0.85 + fps * 0.15
    if (this.preferred !== 'AUTO') return this.resolved

    const now = sample.nowMs ?? (typeof performance !== 'undefined' ? performance.now() : Date.now())
    if (this.autoStartedAt == null) {
      this.autoStartedAt = now
      return this.resolved
    }
    if (now - this.autoStartedAt < AUTO_WARMUP_MS) return this.resolved

    const targetFps = sample.xrActive ? Math.max(60, sample.xrFrameRate ?? 72) : 60
    const budgetMs = 1000 / targetFps
    const rafP95 = finitePositive(sample.rafP95Ms)
    const cpuP95 = finitePositive(sample.cpuP95Ms)
    const gpuP95 = finitePositive(sample.gpuP95Ms)
    const underPressure =
      this.fpsEma < targetFps * 0.78 ||
      (rafP95 != null && rafP95 > budgetMs * 1.45) ||
      (cpuP95 != null && cpuP95 > budgetMs * 1.25) ||
      (gpuP95 != null && gpuP95 > budgetMs * 1.25)
    const severePressure =
      this.fpsEma < targetFps * 0.58 ||
      (rafP95 != null && rafP95 > budgetMs * 2.1) ||
      (cpuP95 != null && cpuP95 > budgetMs * 1.85) ||
      (gpuP95 != null && gpuP95 > budgetMs * 1.85)
    const healthy =
      this.fpsEma > targetFps * 0.96 &&
      (rafP95 == null || rafP95 < budgetMs * 1.08) &&
      (cpuP95 == null || cpuP95 < budgetMs * 0.82) &&
      (gpuP95 == null || gpuP95 < budgetMs * 0.82)

    this.pressureSamples = underPressure ? this.pressureSamples + 1 : 0
    this.severePressureSamples = severePressure ? this.severePressureSamples + 1 : 0
    this.healthySamples = healthy ? this.healthySamples + 1 : 0

    const sinceChange = now - this.lastAutoChangeAt
    if (this.resolved.id === 'DESKTOP_HIGH') {
      if (
        this.pressureSamples >= AUTO_STEP_DOWN_SAMPLES &&
        sinceChange >= AUTO_DOWN_COOLDOWN_MS
      ) {
        this.commitAutoProfile(PROFILES.DESKTOP_BALANCED, now)
      }
      return this.resolved
    }

    if (this.resolved.id === 'DESKTOP_BALANCED') {
      if (
        this.severePressureSamples >= AUTO_VARIANT_DOWN_SAMPLES &&
        sinceChange >= AUTO_DOWN_COOLDOWN_MS
      ) {
        this.autoQuestLocked = true
        this.commitAutoProfile(PROFILES.QUEST, now)
        return this.resolved
      }
      if (
        this.healthySamples >= AUTO_STEP_UP_SAMPLES &&
        sinceChange >= AUTO_UP_COOLDOWN_MS &&
        this.hardwareCeiling() === 'DESKTOP_HIGH'
      ) {
        this.commitAutoProfile(PROFILES.DESKTOP_HIGH, now)
      }
      return this.resolved
    }

    // Never automatically cross back from the Quest GLB to the Web GLB. That
    // avoids a reload loop where the lighter asset raises FPS just enough to
    // trigger an expensive upgrade. Manual profile choices still work.
    if (this.resolved.id === 'QUEST' && !this.autoQuestLocked) {
      this.autoQuestLocked = true
    }
    return this.resolved
  }

  detectXrLikely(): boolean {
    if (typeof navigator === 'undefined') return false
    return Boolean(navigator.xr)
  }

  private resolve(): QualityConfig {
    if (this.preferred !== 'AUTO') return PROFILES[this.preferred]

    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      return PROFILES.DESKTOP_BALANCED
    }
    const xr = this.detectXrLikely()
    const cores = navigator.hardwareConcurrency || 4
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4

    if (xr && /OculusBrowser|Quest/i.test(navigator.userAgent)) return PROFILES.QUEST
    if (this.fpsEma < 35 || cores <= 4 || mem <= 4) return PROFILES.QUEST
    if (this.fpsEma < 48 || cores <= 6 || mem <= 6) return PROFILES.DESKTOP_BALANCED
    if (this.hardwareCeiling() === 'DESKTOP_HIGH' && this.fpsEma > 55) {
      return PROFILES.DESKTOP_HIGH
    }
    return PROFILES.DESKTOP_BALANCED
  }

  private hardwareCeiling(): 'DESKTOP_HIGH' | 'DESKTOP_BALANCED' | 'QUEST' {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      return 'DESKTOP_BALANCED'
    }
    if (/OculusBrowser|Quest/i.test(navigator.userAgent)) return 'QUEST'
    const cores = navigator.hardwareConcurrency || 4
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
    if (cores <= 4 || mem <= 4) return 'QUEST'
    if (cores >= 8 && mem >= 8 && (window.devicePixelRatio || 1) >= 1.5) {
      return 'DESKTOP_HIGH'
    }
    return 'DESKTOP_BALANCED'
  }

  private commitAutoProfile(profile: QualityConfig, now: number): void {
    this.resolved = profile
    this.lastAutoChangeAt = now
    this.pressureSamples = 0
    this.severePressureSamples = 0
    this.healthySamples = 0
  }

  private resetAutoState(): void {
    this.autoStartedAt = null
    this.lastAutoChangeAt = Number.NEGATIVE_INFINITY
    this.pressureSamples = 0
    this.severePressureSamples = 0
    this.healthySamples = 0
    this.autoQuestLocked = false
  }
}

function finitePositive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}
