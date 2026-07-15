import type { ReactNode } from 'react'

export interface NoteSection {
  id: string
  title: string
  level: 2 | 3
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

/** Headings from lines starting with ## or ### */
export function extractNoteSections(body: string): NoteSection[] {
  const sections: NoteSection[] = []
  const used = new Map<string, number>()

  for (const line of body.split('\n')) {
    const match = line.match(/^(#{2,3})\s+(.+)$/)
    if (!match) continue
    const level = match[1].length as 2 | 3
    const title = match[2].trim()
    let id = slugify(title)
    const n = (used.get(id) ?? 0) + 1
    used.set(id, n)
    if (n > 1) id = `${id}-${n}`
    sections.push({ id, title, level })
  }

  return sections
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

/** Render plain-text research notes with sections, name+URL pairs, and auto-linked URLs. */
export function renderNoteBody(body: string): ReactNode[] {
  const lines = body.split('\n')
  const out: ReactNode[] = []
  const slugCounts = new Map<string, number>()
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      out.push(<br key={`br-${i}`} />)
      i++
      continue
    }

    const headingMatch = trimmed.match(/^(#{2,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length as 2 | 3
      const title = headingMatch[2].trim()
      let id = slugify(title)
      const n = (slugCounts.get(id) ?? 0) + 1
      slugCounts.set(id, n)
      if (n > 1) id = `${id}-${n}`

      const Tag = level === 2 ? 'h2' : 'h3'
      out.push(
        <Tag
          key={`h-${i}`}
          id={`note-section-${id}`}
          className={`crm-note-section-heading crm-note-section-heading--h${level}`}
        >
          {title}
        </Tag>,
      )
      i++
      continue
    }

    const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : ''
    if (!isUrl(trimmed) && nextTrimmed && isUrl(nextTrimmed)) {
      out.push(
        <div key={`entry-${i}`} className="crm-note-entry">
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
          key={`url-${i}`}
          className="crm-note-entry-url crm-note-entry-url--solo"
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
        >
          {trimmed}
        </a>,
      )
    } else {
      out.push(renderParagraph(line, `p-${i}`))
    }
    i++
  }

  return out
}

export function scrollToNoteSection(id: string) {
  const el = document.getElementById(`note-section-${id}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
