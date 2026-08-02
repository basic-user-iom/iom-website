import { useEffect, useId, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useCrmI18n } from './i18n'

function isPlaceholderCaption(alt: string): boolean {
  const t = alt.trim().toLowerCase()
  return !t || t === 'caption' || t === 'opis' || t === 'image'
}

export function NoteImage({
  url,
  alt,
  inline = false,
}: {
  url: string
  alt: string
  inline?: boolean
}) {
  const { t } = useCrmI18n()
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const showCaption = !isPlaceholderCaption(alt)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openLightbox = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        className={`crm-note-image-trigger${inline ? ' is-inline' : ''}`}
        onClick={openLightbox}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') openLightbox(e)
        }}
        aria-label={
          showCaption
            ? t('notes.imageViewLargerNamed', { name: alt.trim() })
            : t('notes.imageViewLarger')
        }
        title={t('notes.imageViewLarger')}
      >
        <img
          className={`crm-note-image${inline ? ' crm-note-image--inline' : ''}`}
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
        />
        <span className="crm-note-image-expand" aria-hidden="true">
          ⤢
        </span>
      </button>
      {showCaption && !inline ? (
        <figcaption className="crm-note-figcaption">{alt}</figcaption>
      ) : null}
      {open
        ? createPortal(
            <div
              className="crm-note-lightbox"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
              }}
            >
              <div
                className="crm-note-lightbox-panel"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="crm-note-lightbox-bar">
                  <p id={titleId} className="crm-note-lightbox-title">
                    {showCaption ? alt.trim() : t('notes.imageViewLarger')}
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost crm-note-lightbox-close"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpen(false)
                    }}
                  >
                    {t('notes.imageClose')}
                  </button>
                </div>
                <img
                  className="crm-note-lightbox-img"
                  src={url}
                  alt={alt}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
