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

const BARE_URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?"')\]}>])/gi
const MD_IMG_SRC = String.raw`(https?:\/\/[^)\s]+|\/[^)\s]+|data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)`
const MD_IMAGE_RE = new RegExp(String.raw`!\[([^\]]*)\]\(${MD_IMG_SRC}\)`, 'g')
const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g

export function isUrl(line: string): boolean {
  return /^https?:\/\//i.test(line.trim())
}

function isSafeUrl(url: string): boolean {
  return /^(https?:\/\/|\/|data:image\/)/i.test(url)
}

/** Standalone image URL (file ext or common ChatGPT / CDN hosts). */
export function isImageUrl(url: string): boolean {
  const u = url.trim()
  if (!/^https?:\/\//i.test(u)) return false
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(u)) return true
  if (
    /(?:files\.oaiusercontent\.com|oaidalleapiprodscus|chatgpt\.com\/.*\.(?:png|jpe?g|webp|gif))/i.test(
      u,
    )
  ) {
    return true
  }
  return false
}

function isTableRow(line: string): boolean {
  const t = line.trim()
  if (!t.startsWith('|')) return false
  return t.indexOf('|', 1) !== -1
}

function isTableSeparator(line: string): boolean {
  const t = line.trim()
  // | --- | :---: | ---: |
  return /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(t)
}

function parseTableCells(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  return t.split('|').map((c) => c.trim())
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

/** Split note body into intro text and ## / ### sections (or name+URL blocks). */
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

  if (sections.length > 0) {
    return { introLines, sections }
  }

  return parseNameUrlSections(introLines, slugCounts)
}

/** Legacy format: Name on one line, URL on the next → collapsible sections. */
function parseNameUrlSections(
  lines: string[],
  slugCounts: Map<string, number>,
): { introLines: string[]; sections: ParsedNoteSection[] } {
  const introLines: string[] = []
  const sections: ParsedNoteSection[] = []
  let current: ParsedNoteSection | null = null
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trim()
    const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : ''

    if (!trimmed) {
      if (current) current.lines.push(lines[i])
      else introLines.push(lines[i])
      i++
      continue
    }

    if (!isUrl(trimmed) && nextTrimmed && isUrl(nextTrimmed)) {
      if (current) sections.push(current)
      current = {
        id: nextSectionId(trimmed, slugCounts),
        title: trimmed,
        level: 2,
        lines: [lines[i + 1]],
      }
      i += 2
      continue
    }

    if (current) current.lines.push(lines[i])
    else introLines.push(lines[i])
    i++
  }
  if (current) sections.push(current)

  return { introLines, sections }
}

function ExternalLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <a
      className={className ?? 'crm-note-inline-link'}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}

/** Inline markdown: images, [label](url), bare URLs, **bold**, *italic*, `code`. */
export function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  type Token =
    | { kind: 'text'; value: string }
    | { kind: 'image'; alt: string; url: string }
    | { kind: 'link'; label: string; url: string }
    | { kind: 'url'; url: string }

  const tokens: Token[] = []
  const hits: Array<{ start: number; end: number; token: Token }> = []

  const imageRe = new RegExp(MD_IMAGE_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = imageRe.exec(text)) !== null) {
    if (!isSafeUrl(m[2])) continue
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      token: { kind: 'image', alt: m[1], url: m[2] },
    })
  }

  const linkRe = new RegExp(MD_LINK_RE.source, 'g')
  while ((m = linkRe.exec(text)) !== null) {
    if (!isSafeUrl(m[2])) continue
    // Skip if this [ overlaps an image ![
    const overlaps = hits.some((h) => m!.index >= h.start && m!.index < h.end)
    if (overlaps) continue
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      token: { kind: 'link', label: m[1], url: m[2] },
    })
  }

  const urlRe = new RegExp(BARE_URL_RE.source, BARE_URL_RE.flags)
  while ((m = urlRe.exec(text)) !== null) {
    const overlaps = hits.some((h) => m!.index >= h.start && m!.index < h.end)
    if (overlaps) continue
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      token: { kind: 'url', url: m[0] },
    })
  }

  hits.sort((a, b) => a.start - b.start)

  let cursor = 0
  for (const hit of hits) {
    if (hit.start < cursor) continue
    if (hit.start > cursor) {
      tokens.push({ kind: 'text', value: text.slice(cursor, hit.start) })
    }
    tokens.push(hit.token)
    cursor = hit.end
  }
  if (cursor < text.length) tokens.push({ kind: 'text', value: text.slice(cursor) })
  if (tokens.length === 0) tokens.push({ kind: 'text', value: text })

  const out: ReactNode[] = []
  let ti = 0
  for (const tok of tokens) {
    const key = `${keyPrefix}-t${ti++}`
    if (tok.kind === 'image') {
      out.push(
        <img
          key={key}
          className="crm-note-image crm-note-image--inline"
          src={tok.url}
          alt={tok.alt || ''}
          loading="lazy"
          decoding="async"
        />,
      )
      continue
    }
    if (tok.kind === 'link') {
      out.push(
        <ExternalLink key={key} href={tok.url}>
          {tok.label}
        </ExternalLink>,
      )
      continue
    }
    if (tok.kind === 'url') {
      if (isImageUrl(tok.url)) {
        out.push(
          <img
            key={key}
            className="crm-note-image crm-note-image--inline"
            src={tok.url}
            alt=""
            loading="lazy"
            decoding="async"
          />,
        )
      } else {
        out.push(
          <ExternalLink key={key} href={tok.url}>
            {tok.url}
          </ExternalLink>,
        )
      }
      continue
    }

    // Bold / italic / code on plain text segments
    const parts = tok.value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean)
    parts.forEach((part, pi) => {
      const pk = `${key}-${pi}`
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        out.push(<strong key={pk}>{part.slice(2, -2)}</strong>)
      } else if (/^\*[^*]+\*$/.test(part)) {
        out.push(<em key={pk}>{part.slice(1, -1)}</em>)
      } else if (/^`[^`]+`$/.test(part)) {
        out.push(<code key={pk}>{part.slice(1, -1)}</code>)
      } else {
        out.push(part)
      }
    })
  }

  return out.length ? out : [text]
}

function renderParagraph(line: string, key: string): ReactNode {
  return (
    <p key={key} className="crm-note-paragraph">
      {renderInlineMarkdown(line, key)}
    </p>
  )
}

function renderTable(rows: string[], keyPrefix: string): ReactNode {
  const parsed = rows
    .filter((r) => !isTableSeparator(r))
    .map(parseTableCells)
  if (parsed.length === 0) return null

  const header = parsed[0]
  const body = parsed.slice(1)

  return (
    <div key={keyPrefix} className="crm-note-table-wrap">
      <table className="crm-note-table">
        <thead>
          <tr>
            {header.map((cell, ci) => (
              <th key={`${keyPrefix}-h-${ci}`}>
                {renderInlineMarkdown(cell, `${keyPrefix}-h-${ci}`)}
              </th>
            ))}
          </tr>
        </thead>
        {body.length > 0 && (
          <tbody>
            {body.map((row, ri) => (
              <tr key={`${keyPrefix}-r-${ri}`}>
                {row.map((cell, ci) => (
                  <td key={`${keyPrefix}-r-${ri}-c-${ci}`}>
                    {renderInlineMarkdown(cell, `${keyPrefix}-r-${ri}-c-${ci}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  )
}

function renderImageBlock(url: string, alt: string, key: string): ReactNode {
  return (
    <figure key={key} className="crm-note-figure">
      <img
        className="crm-note-image"
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
      {alt ? <figcaption className="crm-note-figcaption">{alt}</figcaption> : null}
    </figure>
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

    // Markdown table
    if (isTableRow(trimmed)) {
      const tableRows: string[] = []
      const start = i
      while (i < lines.length && isTableRow(lines[i].trim())) {
        tableRows.push(lines[i])
        i++
      }
      const table = renderTable(tableRows, `${keyPrefix}-table-${start}`)
      if (table) out.push(table)
      continue
    }

    // Bullet list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      const start = i
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i++
      }
      out.push(
        <ul key={`${keyPrefix}-ul-${start}`} className="crm-note-list">
          {items.map((item, ii) => (
            <li key={`${keyPrefix}-li-${start}-${ii}`}>
              {renderInlineMarkdown(item, `${keyPrefix}-li-${start}-${ii}`)}
            </li>
          ))}
        </ul>,
      )
      continue
    }

    // Standalone markdown image
    const imgMatch = trimmed.match(
      new RegExp(String.raw`^!\[([^\]]*)\]\(${MD_IMG_SRC}\)$`),
    )
    if (imgMatch && isSafeUrl(imgMatch[2])) {
      out.push(renderImageBlock(imgMatch[2], imgMatch[1], `${keyPrefix}-img-${i}`))
      i++
      continue
    }

    // Bare image URL on its own line (ChatGPT paste)
    if (isUrl(trimmed) && isImageUrl(trimmed)) {
      out.push(renderImageBlock(trimmed, '', `${keyPrefix}-imgurl-${i}`))
      i++
      continue
    }

    const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : ''
    if (!isUrl(trimmed) && nextTrimmed && isUrl(nextTrimmed) && !isImageUrl(nextTrimmed)) {
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
    if (isUrl(trimmed) && !isImageUrl(trimmed)) return trimmed
    const mdLink = trimmed.match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/)
    if (mdLink) return mdLink[2]
    const next = i + 1 < lines.length ? lines[i + 1].trim() : ''
    if (next && isUrl(next) && !isImageUrl(next)) return next
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

/** Leading single-# markdown heading used as the note document title. */
export function splitRichNoteTitle(body: string): { title: string; body: string } {
  const lines = body.replace(/^\uFEFF/, '').split('\n')
  let i = 0
  while (i < lines.length && !lines[i].trim()) i++
  if (i >= lines.length) return { title: '', body: body.replace(/^\uFEFF/, '') }
  const match = lines[i].trim().match(/^#\s+(.+)$/)
  if (!match || lines[i].trim().startsWith('##')) {
    return { title: '', body: body.replace(/^\uFEFF/, '') }
  }
  const rest = lines.slice(i + 1)
  if (rest[0] !== undefined && !rest[0].trim()) rest.shift()
  return { title: match[1].trim(), body: rest.join('\n') }
}

export function joinRichNoteTitle(title: string, body: string): string {
  const t = title.trim()
  const b = body.replace(/^\n+/, '')
  if (!t) return b
  return b ? `# ${t}\n\n${b}` : `# ${t}\n`
}

function isBlockImageLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  const imgMatch = trimmed.match(
    new RegExp(String.raw`^!\[([^\]]*)\]\(${MD_IMG_SRC}\)$`),
  )
  if (imgMatch && isSafeUrl(imgMatch[2])) return true
  return isUrl(trimmed) && isImageUrl(trimmed)
}

/** Pull the first standalone image to the top (ChatGPT-style hero). */
export function extractFirstBlockImage(body: string): {
  imageLine: string | null
  bodyWithout: string
} {
  const lines = body.split('\n')
  const idx = lines.findIndex(isBlockImageLine)
  if (idx < 0) return { imageLine: null, bodyWithout: body }
  const imageLine = lines[idx]
  const next = lines.filter((_, i) => i !== idx)
  // Collapse accidental triple blanks left by removal
  const cleaned: string[] = []
  for (const line of next) {
    if (!line.trim() && cleaned.length > 0 && !cleaned[cleaned.length - 1].trim()) {
      continue
    }
    cleaned.push(line)
  }
  return { imageLine, bodyWithout: cleaned.join('\n').replace(/^\n+|\n+$/g, '') }
}
