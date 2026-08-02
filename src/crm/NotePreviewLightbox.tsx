import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { useCrmI18n } from './i18n'
import { NoteRichBody } from './NotePreview'
import { splitRichNoteTitle } from './formatNotePreview'

export function NotePreviewLightbox({
  open,
  nodeTitle,
  body,
  onClose,
  onEdit,
}: {
  open: boolean
  nodeTitle: string
  body: string
  onClose: () => void
  onEdit?: () => void
}) {
  const { t } = useCrmI18n()
  const titleId = useId()
  const { title: docTitle } = splitRichNoteTitle(body)
  const heading = docTitle || nodeTitle || t('ideas.richPreview')

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="crm-note-lightbox crm-note-doc-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        className="crm-note-lightbox-panel crm-note-doc-lightbox-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="crm-note-lightbox-bar">
          <p id={titleId} className="crm-note-lightbox-title">
            {heading}
          </p>
          <div className="crm-note-doc-lightbox-actions">
            {onEdit ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
              >
                {t('ideas.richEdit')}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost crm-note-lightbox-close"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
            >
              {t('notes.imageClose')}
            </button>
          </div>
        </div>
        <div className="crm-note-doc-lightbox-body">
          <NoteRichBody body={body} emptyLabel={t('ideas.richPreviewEmpty')} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
