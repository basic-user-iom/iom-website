import { useEffect } from 'react'

export type LightboxState = {
  title: string
  images: string[]
  index: number
}

type Props = {
  state: LightboxState
  onClose: () => void
  onIndex: (index: number) => void
}

export function Lightbox({ state, onClose, onIndex }: Props) {
  const { title, images, index } = state
  const total = images.length
  const src = images[index]

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex((index + 1) % total)
      if (e.key === 'ArrowLeft') onIndex((index - 1 + total) % total)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [index, total, onClose, onIndex])

  return (
    <div className="icm-lightbox" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="icm-lightbox__backdrop" aria-label="Close" onClick={onClose} />
      <div className="icm-lightbox__chrome">
        <div className="icm-lightbox__top">
          <div>
            <strong>{title}</strong>
            <span>
              {index + 1} / {total}
            </span>
          </div>
          <button type="button" className="icm-lightbox__close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="icm-lightbox__stage">
          {total > 1 ? (
            <button
              type="button"
              className="icm-lightbox__nav icm-lightbox__nav--prev"
              onClick={() => onIndex((index - 1 + total) % total)}
              aria-label="Previous"
            >
              ←
            </button>
          ) : null}
          <img src={src} alt="" className="icm-lightbox__img" />
          {total > 1 ? (
            <button
              type="button"
              className="icm-lightbox__nav icm-lightbox__nav--next"
              onClick={() => onIndex((index + 1) % total)}
              aria-label="Next"
            >
              →
            </button>
          ) : null}
        </div>
        {total > 1 ? (
          <div className="icm-lightbox__thumbs">
            {images.map((thumb, i) => (
              <button
                key={thumb + i}
                type="button"
                className={`icm-lightbox__thumb${i === index ? ' is-active' : ''}`}
                onClick={() => onIndex(i)}
              >
                <img src={thumb} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
