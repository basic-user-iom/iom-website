export type DeviceProfile = {
  isMobile: boolean
  isLowPower: boolean
  /** Desktop with modest CPU/RAM — fewer ravens, lower cloud res. */
  isMidTier: boolean
  prefersReducedMotion: boolean
  maxPixelRatio: number
  cloudRaySteps: number
  /** Internal cloud FBO scale (0.5 = half-res raymarch, upscaled). */
  cloudRenderScale: number
  /** Target render FPS (30 on mobile saves ~50% GPU). */
  targetFps: number
  ravenCount: 0 | 1 | 2 | 3
  useEmbedStaticFallback: boolean
  /** Skip secondary map() in cloud shader (saves ~1 raymarch eval per step). */
  cloudSimpleLighting: boolean
  /** Music visualizer internal render scale (lower = fewer raymarch pixels). */
  visualizerMaxPixelRatio: number
  visualizerMaxRaySteps: number
  /** 0 skips bloom post entirely on the weakest tier. */
  visualizerBloomPasses: number
  visualizerTargetFps: number
  /** When false, skip idle GPU drift unless audio is playing. */
  visualizerIdleWhenVisible: boolean
}

let cachedProfile: DeviceProfile | null = null

export function getDeviceProfile(): DeviceProfile {
  if (cachedProfile) return cachedProfile

  const narrow = window.matchMedia('(max-width: 768px)').matches
  const touch =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  const isMobile = narrow || (touch && window.innerWidth <= 900)

  const cores = navigator.hardwareConcurrency ?? 8
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const isLowPower = isMobile || cores <= 4 || memory <= 4
  const isMidTier = !isMobile && !isLowPower && (cores <= 6 || memory <= 6)

  cachedProfile = {
    isMobile,
    isLowPower,
    isMidTier,
    prefersReducedMotion,
    maxPixelRatio: isLowPower ? 1 : Math.min(window.devicePixelRatio, 1.5),
  cloudRaySteps: isLowPower ? 20 : isMidTier ? 32 : 36,
  cloudRenderScale: isLowPower ? 0.5 : isMidTier ? 0.7 : 0.85,
    targetFps: isLowPower ? 30 : isMidTier ? 45 : 60,
    ravenCount: prefersReducedMotion ? 0 : isMobile ? 1 : isMidTier ? 2 : 3,
    useEmbedStaticFallback: isMobile,
    cloudSimpleLighting: isLowPower || isMidTier,
    visualizerMaxPixelRatio: isMobile ? 1 : isLowPower ? 1 : Math.min(window.devicePixelRatio, 1.75),
    visualizerMaxRaySteps: isMobile ? 36 : isLowPower ? 48 : isMidTier ? 64 : 80,
    visualizerBloomPasses: isMobile ? 0 : isLowPower ? 1 : 2,
    visualizerTargetFps: isMobile ? 24 : isLowPower ? 30 : 60,
    visualizerIdleWhenVisible: true,
  }

  return cachedProfile
}
