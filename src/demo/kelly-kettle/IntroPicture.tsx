type Props = {
  name:
    | 'kettle-hero'
    | 'kettle-fire-base'
    | 'kettle-handle'
    | 'kettle-whistle'
    | 'kettle-video-poster'
    | 'kettle-youtube-poster'
    | 'kettle-how-air'
    | 'kettle-how-fire'
    | 'kettle-how-heat'
    | 'kettle-how-water'
  alt: string
  width: number
  height: number
  sizes: string
  priority?: boolean
  className?: string
}

const VARIANTS: Record<Props['name'], number[]> = {
  'kettle-hero': [480, 700],
  'kettle-fire-base': [400, 640],
  'kettle-handle': [400, 640],
  'kettle-whistle': [400, 640],
  'kettle-video-poster': [480, 700],
  'kettle-youtube-poster': [640, 1280],
  'kettle-how-air': [480, 819],
  'kettle-how-fire': [480, 819],
  'kettle-how-heat': [480, 819],
  'kettle-how-water': [480, 819],
}

function srcSet(name: Props['name'], ext: 'avif' | 'webp') {
  const widths = VARIANTS[name]
  const max = Math.max(...widths)
  return widths
    .map((w) => {
      const file = w === max ? `/media/${name}.${ext}` : `/media/${name}-${w}.${ext}`
      return `${file} ${w}w`
    })
    .join(', ')
}

export function IntroPicture({ name, alt, width, height, sizes, priority = false, className }: Props) {
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(name, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(name, 'webp')} sizes={sizes} />
      <img
        className={className}
        src={`/media/${name}.webp`}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'low'}
      />
    </picture>
  )
}
