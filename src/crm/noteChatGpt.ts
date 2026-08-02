function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('empty')

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1))
    }
    throw new Error('invalid_json')
  }
}

function asString(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function formatSections(
  intro: string,
  sections: Array<{ heading: string; url: string; notes: string }>,
): string {
  const parts: string[] = []
  if (intro.trim()) parts.push(intro.trim(), '')
  for (const s of sections) {
    if (s.heading.trim()) parts.push(`## ${s.heading.trim()}`)
    if (s.url.trim()) parts.push(s.url.trim())
    if (s.notes.trim()) parts.push(s.notes.trim())
    parts.push('')
  }
  return parts.join('\n').trim()
}

function looksLikeMarkdownNote(raw: string): boolean {
  const t = raw.trim()
  if (t.length < 8) return false
  if (/^#{1,3}\s+\S/m.test(t)) return true
  if (/^\|.+\|/m.test(t)) return true
  if (/!\[[^\]]*\]\([^)]+\)/.test(t)) return true
  if (/\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(t)) return true
  if (/^https?:\/\//m.test(t)) return true
  return t.includes('\n') && t.length > 40
}

function titleFromMarkdown(body: string): string {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    const h = line.match(/^#{1,3}\s+(.+)$/)
    if (h) return h[1].trim().slice(0, 120)
    if (!line.startsWith('|') && !/^!\[/.test(line) && !/^https?:\/\//i.test(line)) {
      return line.replace(/\*\*([^*]+)\*\*/g, '$1').slice(0, 120)
    }
  }
  return 'Imported note'
}

export function buildChatGptNotePrompt(seedHint = ''): string {
  const seed = seedHint.trim()
  const seedBlock = seed
    ? `\nTopic for this note: ${seed}\n`
    : '\n(I will describe what to research — artists to follow, asset lists, market notes, lead list, etc. — in my next message.)\n'

  return `You are helping write a CRM research note for IOM (Interactive Object Media). Notes are used to track artists, companies, 3D assets, or opportunities to monitor.
${seedBlock}
You may return EITHER:

A) A single JSON object (no markdown fences, no commentary):

{
  "title": "Short note title",
  "body": "Full note as markdown. Supported in CRM Preview:\\n- ## / ### section headings (jump index)\\n- Markdown tables (| col | col |)\\n- Links: [label](https://…)\\n- Images: ![caption](https://…)  (ChatGPT image URLs work)\\n- Bullet lists (- item)\\n- Bare https:// URLs\\n\\nExample table row:\\n| [Asset — Sketchfab](https://sketchfab.com/…) | Purpose | Analysis notes |"
}

B) Or plain markdown only (title will be inferred from the first heading/paragraph). Prefer including images as ![alt](url) and asset lists as markdown tables with [name](url) links.

Rules:
- Prefer a rich "body" with ## headings, tables, and real links — Preview renders them natively
- Do not invent URLs; use real sites when known
- For images from ChatGPT, keep the ![…](https://…) markdown so Preview shows them
- title is required when using JSON`
}

export function parseChatGptNoteImport(raw: string): { title: string; body: string } {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('empty')

  try {
    const parsed = extractJsonObject(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid_shape')
    }
    const src = parsed as Record<string, unknown>

    const title = asString(src.title)
    if (!title) throw new Error('missing_title')

    let body = asString(src.body)
    if (!body && Array.isArray(src.sections)) {
      const sections = src.sections
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const row = item as Record<string, unknown>
          return {
            heading: asString(row.heading),
            url: asString(row.url),
            notes: asString(row.notes),
          }
        })
        .filter((s) => s.heading || s.url || s.notes)
      body = formatSections(asString(src.intro), sections)
    }

    if (!body.trim()) throw new Error('missing_body')
    return { title, body: body.trim() }
  } catch (err) {
    if (err instanceof Error && (err.message === 'empty' || err.message === 'missing_title')) {
      throw err
    }
    // Plain markdown paste from ChatGPT (tables, images, links)
    if (looksLikeMarkdownNote(trimmed)) {
      const body = trimmed
        .replace(/^```(?:markdown|md)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      return { title: titleFromMarkdown(body), body }
    }
    if (err instanceof Error && err.message === 'missing_body') throw err
    throw new Error('invalid_json')
  }
}
