import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  extractNoteSections,
  parseNoteDocument,
  renderNoteLines,
  scrollToNoteSection,
  sectionSummaryUrl,
} from './formatNotePreview'
import { useCrmI18n } from './i18n'

interface NoteTableOfContentsProps {
  body: string
  previewRef: RefObject<HTMLElement | null>
}

export function NoteTableOfContents({ body, previewRef }: NoteTableOfContentsProps) {
  const { t } = useCrmI18n()
  const sections = useMemo(() => extractNoteSections(body), [body])
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null)

  useEffect(() => {
    setActiveId(sections[0]?.id ?? null)
  }, [sections])

  useEffect(() => {
    if (sections.length === 0 || !previewRef.current) return

    const root = previewRef.current
    const headings = sections
      .map((s) => document.getElementById(`note-section-${s.id}`))
      .filter((el): el is HTMLElement => !!el)

    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id.replace('note-section-', ''))
        }
      },
      { root, rootMargin: '-10% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] },
    )

    for (const el of headings) observer.observe(el)
    return () => observer.disconnect()
  }, [sections, previewRef, body])

  if (sections.length < 2) return null

  return (
    <nav className="crm-notes-toc" aria-label={t('notes.tocAria')}>
      <p className="crm-notes-toc-label">{t('notes.tocLabel')}</p>
      <ul className="crm-notes-toc-list">
        {sections.map((section) => (
          <li
            key={section.id}
            className={`crm-notes-toc-item${section.level === 3 ? ' is-sub' : ''}`}
          >
            <button
              type="button"
              className={`crm-notes-toc-link${activeId === section.id ? ' is-active' : ''}`}
              onClick={() => scrollToNoteSection(section.id)}
            >
              {section.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function NotePreviewBody({ body }: { body: string }) {
  const { t } = useCrmI18n()
  const { introLines, sections } = useMemo(() => parseNoteDocument(body), [body])
  const intro = renderNoteLines(introLines, 'intro')

  return (
    <>
      {intro.length > 0 && <div className="crm-note-intro">{intro}</div>}
      {sections.map((section) => {
        const url = sectionSummaryUrl(section.lines)
        return (
          <details
            key={section.id}
            id={`note-section-${section.id}`}
            className={`crm-note-section${section.level === 3 ? ' crm-note-section--sub' : ''}`}
          >
            <summary className="crm-note-section-summary">
              <span className="crm-note-section-title">{section.title}</span>
              {url ? (
                <a
                  className="crm-note-section-url"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                </a>
              ) : null}
              <span className="crm-note-section-chevron" aria-hidden="true">
                ▾
              </span>
            </summary>
            <div className="crm-note-section-body">
              {renderNoteLines(section.lines, section.id)}
            </div>
          </details>
        )
      })}
      {sections.length === 0 && intro.length === 0 && (
        <p className="crm-muted">{t('notes.noBody')}</p>
      )}
    </>
  )
}

interface NotePreviewProps {
  body: string
}

export function NotePreview({ body }: NotePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const sections = useMemo(() => extractNoteSections(body), [body])

  return (
    <div
      className={`crm-notes-preview-wrap${sections.length >= 2 ? ' has-toc' : ''}`}
    >
      <div ref={previewRef} className="crm-notes-preview">
        <NotePreviewBody body={body} />
      </div>
      <NoteTableOfContents body={body} previewRef={previewRef} />
    </div>
  )
}
