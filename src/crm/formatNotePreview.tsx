import type { ReactNode } from 'react'

export interface NoteSection {
  id: string
  title: string
  level: 2 | 3
}

export interface ParsedNoteSection {
  id: string
  title: string
  level: 2 | 3
  lines: string[]
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?"')\]}>])/gi

export function isUrl(line: string): boolean {
  return /^https?:\/\//i.test(line.trim())
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  )
}

function nextSectionId(title: string, slugCounts: Map<string, number>): string {
  let id = slugify(title)
  const n = (slugCounts.get(id) ?? 0) + 1
  slugCounts.set(id, n)
  if (n > 1) id = `${id}-${n}`
  return id
}

/** Headings from lines starting with ## or ### */
export function extractNoteSections(body: string): NoteSection[] {
  return parseNoteDocument(body).sections.map(({ id, title, level }) => ({
    id,
    title,
    level,
  }))
}

/** Split note body into intro text and ## / ### sections. */
export function parseNoteDocument(body: string): {
  introLines: string[]
  sections: ParsedNoteSection[]
} {
  const lines = body.split('\n')
  const introLines: string[] = []
  const sections: ParsedNoteSection[] = []
  const slugCounts = new Map<string, number>()
  let current: ParsedNoteSection | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    const headingMatch = trimmed.match(/^(#{2,3})\s+(.+)$/)
    if (headingMatch) {
      if (current) sections.push(current)
      const level = headingMatch[1].length as 2 | 3
      const title = headingMatch[2].trim()
      current = {
        id: nextSectionId(title, slugCounts),
        title,
        level,
        lines: [],
      }
      continue
    }
    if (current) current.lines.push(line)
    else introLines.push(line)
  }
  if (current) sections.push(current)

  return { introLines, sections }
}

function linkifyText(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = new RegExp(URL_RE.source, URL_RE.flags)
  let lastIndex = 0
  let match: RegExpExecArray | null
  let linkIndex = 0

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(text.slice(lastIndex, match.index))
    }
    const url = match[0]
    out.push(
      <a
        key={`${keyPrefix}-link-${linkIndex++}`}
        className="crm-note-inline-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {url}
      </a>,
    )
    lastIndex = match.index + url.length
  }

  if (lastIndex < text.length) out.push(text.slice(lastIndex))
  return out.length ? out : [text]
}

function renderParagraph(line: string, key: string): ReactNode {
  return (
    <p key={key} className="crm-note-paragraph">
      {linkifyText(line, key)}
    </p>
  )
}

/** Render a block of plain lines (intro or section body). */
export function renderNoteLines(lines: string[], keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      out.push(<br key={`${keyPrefix}-br-${i}`} />)
      i++
      continue
    }

    const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : ''
    if (!isUrl(trimmed) && nextTrimmed && isUrl(nextTrimmed)) {
      out.push(
        <div key={`${keyPrefix}-entry-${i}`} className="crm-note-entry">
          <a
            className="crm-note-entry-name"
            href={nextTrimmed}
            target="_blank"
            rel="noopener noreferrer"
          >
            {trimmed}
          </a>
          <a
            className="crm-note-entry-url"
            href={nextTrimmed}
            target="_blank"
            rel="noopener noreferrer"
          >
            {nextTrimmed}
          </a>
        </div>,
      )
      i += 2
      continue
    }

    if (isUrl(trimmed)) {
      out.push(
        <a
          key={`${keyPrefix}-url-${i}`}
          className="crm-note-entry-url crm-note-entry-url--solo"
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
        >
          {trimmed}
        </a>,
      )
    } else {
      out.push(renderParagraph(line, `${keyPrefix}-p-${i}`))
    }
    i++
  }

  return out
}

export function sectionSummaryUrl(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue
    if (isUrl(trimmed)) return trimmed
    const next = i + 1 < lines.length ? lines[i + 1].trim() : ''
    if (next && isUrl(next)) return next
    return null
  }
  return null
}

export function scrollToNoteSection(id: string) {
  const el = document.getElementById(`note-section-${id}`)
  if (!el) return
  if (el instanceof HTMLDetailsElement) el.open = true
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
