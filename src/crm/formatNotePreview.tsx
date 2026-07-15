import type { ReactNode } from 'react'

function isUrl(line: string): boolean {
  return /^https?:\/\//i.test(line.trim())
}

/** Render plain-text research notes with name+URL pairs and auto-linked URLs. */
export function renderNoteBody(body: string): ReactNode[] {
  const lines = body.split('\n')
  const out: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      out.push(<br key={`br-${i}`} />)
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
      out.push(
        <p key={`p-${i}`} className="crm-note-paragraph">
          {line}
        </p>,
      )
    }
    i++
  }

  return out
}
