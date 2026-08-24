import type { ModelManifestEntry } from './types'

/** Standalone golden-slice preview — no campus graft / AABB clip. */
export type GoldenPreviewMode = 'ext' | 'int' | 'both'

const GOLDEN_IDS: Record<GoldenPreviewMode, string[]> = {
  ext: ['icm-golden-ext'],
  int: ['icm-golden-int'],
  both: ['icm-golden-ext', 'icm-golden-int'],
}

export type GoldenCamera = {
  position: [number, number, number]
  target: [number, number, number]
  fov?: number
}

export const GOLDEN_CAMERAS: Record<'ext' | 'int', GoldenCamera> = {
  ext: {
    position: [8, 16, 158],
    target: [-21.5, 5, 108],
    fov: 55,
  },
  int: {
    position: [-60.5, 1.7, -49.8],
    target: [-60.5, 1.3, -58.8],
    fov: 55,
  },
}

function readParam(...keys: string[]): string | null {
  const params = new URLSearchParams(location.search)
  for (const key of keys) {
    const v = params.get(key)
    if (v) return v
  }
  return null
}

/** `?golden=ext|int|both` or legacy `?show=golden-ext` etc. */
export function parseGoldenPreviewMode(): GoldenPreviewMode | null {
  const raw = readParam('golden', 'show')
  if (!raw) return null
  if (raw === 'golden' || raw === 'both') return 'both'
  if (raw === 'ext' || raw === 'golden-ext' || raw === 'icm-golden-ext') return 'ext'
  if (raw === 'int' || raw === 'golden-int' || raw === 'icm-golden-int') return 'int'
  return null
}

/** Optional overlay without clip: `?overlay=icm-golden-ext` with normal campus load. */
export function parseGoldenOverlayId(): string | null {
  const raw = readParam('overlay')
  if (raw === 'icm-golden-ext' || raw === 'icm-golden-int') return raw
  return null
}

export function goldenPreviewEntries(
  mode: GoldenPreviewMode,
  models: ModelManifestEntry[],
): ModelManifestEntry[] {
  return GOLDEN_IDS[mode]
    .map((id) => models.find((m) => m.id === id))
    .filter((m): m is ModelManifestEntry => Boolean(m))
}

export function cameraForGoldenPreview(mode: GoldenPreviewMode): GoldenCamera {
  if (mode === 'int') return GOLDEN_CAMERAS.int
  return GOLDEN_CAMERAS.ext
}
