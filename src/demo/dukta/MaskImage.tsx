import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './hooks'

type Props = {
  src: string
  webp?: string
  alt: string
  width?: number
  height?: number
  className?: string
  reveal?: 'incision' | 'crop' | 'none'
  sizes?: string
  eager?: boolean
}

export function MaskImage({
  src,
  webp,
  alt,
  width,
  height,
  className,
  reveal = 'incision',
  sizes,
  eager,
}: Props) {
  const ref = useRef<HTMLElement>(null)
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState(reduced || reveal === 'none')

  useEffect(() => {
    if (shown || !ref.current) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [shown])

  const image = (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  )

  return (
    <figure
      ref={ref}
      className={`dk-media dk-media--${reveal}${shown ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
    >
      {webp ? (
        <picture>
          <source srcSet={webp} type="image/webp" />
          {image}
        </picture>
      ) : (
        image
      )}
    </figure>
  )
}
