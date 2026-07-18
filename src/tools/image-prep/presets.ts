export type OutputFormat = 'image/jpeg' | 'image/webp' | 'image/png'

export type SizePresetId = 'thumb' | 'gallery' | 'hero' | 'large' | 'original' | 'custom'

export type SizePreset = {
  id: SizePresetId
  label: string
  /** Longest edge in px; null = keep original dimensions (still re-encode / strip EXIF) */
  maxEdge: number | null
  hint: string
}

export const SIZE_PRESETS: SizePreset[] = [
  {
    id: 'thumb',
    label: 'Thumb',
    maxEdge: 640,
    hint: 'Cards, CRM strips, small grids',
  },
  {
    id: 'gallery',
    label: 'Gallery',
    maxEdge: 1400,
    hint: 'Portfolio stills / lightbox (ICM default)',
  },
  {
    id: 'hero',
    label: 'Hero',
    maxEdge: 1920,
    hint: 'Full-bleed covers, motion posters',
  },
  {
    id: 'large',
    label: 'Large',
    maxEdge: 2560,
    hint: 'Retina heroes — keep under this for web',
  },
  {
    id: 'original',
    label: 'Original size',
    maxEdge: null,
    hint: 'No resize — strip EXIF and re-compress only',
  },
  {
    id: 'custom',
    label: 'Custom',
    maxEdge: 1600,
    hint: 'Set your own longest-edge limit',
  },
]

export const FORMAT_OPTIONS: { id: OutputFormat; label: string; ext: string }[] = [
  { id: 'image/jpeg', label: 'JPEG', ext: 'jpg' },
  { id: 'image/webp', label: 'WebP', ext: 'webp' },
  { id: 'image/png', label: 'PNG', ext: 'png' },
]

export function extensionForFormat(format: OutputFormat): string {
  return FORMAT_OPTIONS.find((f) => f.id === format)?.ext ?? 'jpg'
}
