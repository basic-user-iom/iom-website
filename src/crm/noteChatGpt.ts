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

export function buildChatGptNotePrompt(seedHint = ''): string {
  const seed = seedHint.trim()
  const seedBlock = seed
    ? `\nTopic for this note: ${seed}\n`
    : '\n(I will describe what to research — artists to follow, market notes, lead list, etc. — in my next message.)\n'

  return `You are helping write a CRM research note for IOM (Interactive Object Media). Notes are used to track artists, companies, or opportunities to monitor — not necessarily to contact immediately.
${seedBlock}
Return ONLY a single JSON object (no markdown fences, no commentary):

{
  "title": "Short note title",
  "body": "Full note as plain text. Use ## Section heading for each person/company/topic, then URL on the next line, then research notes. Example:\\n\\nIntro paragraph…\\n\\n## Rafael Lozano-Hemmer\\nhttps://www.lozano-hemmer.com/\\nWatch exhibitions and gallery partners.\\n\\n## Daito Manabe\\nhttps://daito.ws/en/\\nRhizomatiks collaborations…",
  "sections": [
    {
      "heading": "Person or company name",
      "url": "https://…",
      "notes": "What to monitor: exhibitions, collaborators, galleries, opportunities"
    }
  ],
  "intro": "Optional opening paragraph if you prefer sections array instead of body"
}

Rules:
- Prefer a rich "body" string with ## headings — the CRM uses ## for a jump index in Preview
- If you use "sections", also set "intro" when needed; body can be omitted and will be built from intro + sections
- One name per section; URL on its own line right after ## heading
- Write practical monitoring notes — where they exhibit, who they work with, studios, future connection points
- Do not invent URLs; use real sites when known, otherwise omit url
- title is required`
}

export function parseChatGptNoteImport(raw: string): { title: string; body: string } {
  const parsed = extractJsonObject(raw)
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
}
