import { normalizeLeadEmails, normalizeLeadLinks } from './api'
import { EMPTY_ATLAS_EVAL, normalizeAtlasEval } from './atlasEval'
import { EMPTY_LEAD_INPUT } from './constants'
import { leadTagsPromptGuide, normalizeLeadTags, suggestLeadTags } from './leadTags'
import type { LeadEmail, LeadInput, LeadLink, LeadStatus, LeadTemperature } from './types'
import { normalizeValueEmoji } from './valueEmoji'

const LEAD_TEMPERATURES = new Set<LeadTemperature>(['hot', 'warm', 'cold'])
const LEAD_STATUSES = new Set<LeadStatus>([
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
])

/** JSON field guide — matches LeadForm / LeadInput. */
export const CHATGPT_LEAD_JSON_KEYS = [
  'company_name',
  'website',
  'contact_name',
  'contact_role',
  'email',
  'emails',
  'phone',
  'links',
  'company_focus',
  'offer',
  'initial_email_subject',
  'initial_email_body',
  'notes',
  'tags',
  'temperature',
  'status',
  'next_follow_up',
  'estimated_value',
  'value_emoji',
  'client_city',
  'client_country',
  'client_timezone',
  'client_address',
  'atlas_eval',
] as const

export function buildChatGptLeadPrompt(seedHint = ''): string {
  const seed = seedHint.trim()
  const seedBlock = seed
    ? `\nResearch this lead: ${seed}\n`
    : '\n(I will tell you the company name, website, or person to research in my next message.)\n'

  return `You are helping fill a CRM lead record for IOM (Interactive Object Media) — an agency offering interactive 360° tours, 3D experiences, web presentations, and creative digital production.

${seedBlock}
Return ONLY a single JSON object (no markdown fences, no commentary) with these keys. Use empty string "" or null when unknown. Arrays can be [].

{
  "company_name": "Company / account name",
  "website": "https://…",
  "contact_name": "Primary contact full name",
  "contact_role": "Job title, e.g. Creative Director",
  "email": "Primary contact email",
  "emails": [{ "label": "Sales", "email": "sales@company.com" }],
  "phone": "+…",
  "links": [{ "label": "Portfolio", "url": "https://…" }],
  "company_focus": "What the company does — 2–4 sentences for outreach context",
  "offer": "What IOM could realistically offer this lead — 1–3 sentences",
  "initial_email_subject": "Subject line for first outreach email",
  "initial_email_body": "Full first outreach email (greeting, pitch, sign-off)",
  "notes": "Internal research notes, sources, red flags, talking points",
  "tags": ["museum", "immersive", "usa"],
  "temperature": "hot | warm | cold",
  "status": "new",
  "next_follow_up": "YYYY-MM-DD or null",
  "estimated_value": 0,
  "value_emoji": "",
  "client_city": "City",
  "client_country": "Country",
  "client_timezone": "IANA timezone e.g. Europe/Belgrade",
  "client_address": "",
  "atlas_eval": {
    "can_hire_us": 0,
    "thinks_like_us": 0,
    "commercial_potential": 0,
    "creative_compatibility": 0,
    "technical_compatibility": 0,
    "relationship_potential": 0,
    "strategic_value": 0
  }
}

Rules:
- temperature: hot = strong fit / active opportunity; warm = promising; cold = long shot or research only
- status: almost always "new" for a fresh lead
- atlas_eval scores: integers 0 (unset) or 1–5 stars per field (include can_hire_us and thinks_like_us)
- value_emoji: "" or one of ❤️ 🎁 🤝 ⭐ (optional)
- estimated_value: EUR number or null; use null with ❤️ or 🎁 for pro-bono / gift
- ${leadTagsPromptGuide()}
- Write initial_email_body ready to send — professional, concise, specific to their work
- Include real URLs and emails only if you find them; do not invent contact details
- Do NOT invent NDA status, passwords, or internal CRM workflow fields — NDA is handled later on the lead card after the lead is saved
- Return the FULL object with company_name and/or contact_name — never atlas_eval scores alone`
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('empty')

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed

  const tryParse = (text: string): unknown => {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  const direct = tryParse(candidate)
  if (direct !== null) return direct

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const sliced = tryParse(candidate.slice(start, end + 1))
    if (sliced !== null) return sliced
  }

  throw new Error('invalid_json')
}

function asString(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function parseLinks(raw: unknown): LeadLink[] {
  if (!Array.isArray(raw)) return []
  return normalizeLeadLinks(
    raw
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const row = item as Record<string, unknown>
        return {
          label: asString(row.label),
          url: asString(row.url),
        }
      }),
  )
}

function parseEmails(raw: unknown): LeadEmail[] {
  if (!Array.isArray(raw)) return []
  return normalizeLeadEmails(
    raw
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const row = item as Record<string, unknown>
        return {
          label: asString(row.label),
          email: asString(row.email),
        }
      }),
  )
}

function parseTemperature(raw: unknown): LeadTemperature {
  const v = asString(raw).toLowerCase()
  if (LEAD_TEMPERATURES.has(v as LeadTemperature)) return v as LeadTemperature
  return EMPTY_LEAD_INPUT.temperature
}

function parseStatus(raw: unknown): LeadStatus {
  const v = asString(raw).toLowerCase()
  if (LEAD_STATUSES.has(v as LeadStatus)) return v as LeadStatus
  return EMPTY_LEAD_INPUT.status
}

function parseFollowUp(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  const s = asString(raw)
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  try {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return null
  }
}

function parseEstimatedValue(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

export function parseChatGptLeadImport(raw: string): Partial<LeadInput> {
  const parsed = extractJsonObject(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid_shape')
  }
  const src = parsed as Record<string, unknown>

  const company = asString(src.company_name)
  const contact = asString(src.contact_name)
  if (!company && !contact) {
    throw new Error('missing_identity')
  }

  const imported: Partial<LeadInput> = {
    company_name: company,
    website: asString(src.website),
    contact_name: contact,
    contact_role: asString(src.contact_role),
    email: asString(src.email),
    emails: parseEmails(src.emails),
    phone: asString(src.phone),
    links: parseLinks(src.links),
    company_focus: asString(src.company_focus),
    offer: asString(src.offer),
    initial_email_subject: asString(src.initial_email_subject),
    initial_email_body: asString(src.initial_email_body),
    notes: asString(src.notes),
    tags: (() => {
      const parsed = normalizeLeadTags(src.tags)
      if (parsed.length > 0) return parsed
      return suggestLeadTags({
        company_name: company,
        company_focus: asString(src.company_focus),
        offer: asString(src.offer),
        notes: asString(src.notes),
        client_city: asString(src.client_city),
        client_country: asString(src.client_country),
      })
    })(),
    temperature: parseTemperature(src.temperature),
    status: parseStatus(src.status),
    next_follow_up: parseFollowUp(src.next_follow_up),
    estimated_value: parseEstimatedValue(src.estimated_value),
    value_emoji: normalizeValueEmoji(src.value_emoji),
    client_city: asString(src.client_city),
    client_country: asString(src.client_country),
    client_timezone: asString(src.client_timezone),
    client_address: asString(src.client_address),
    atlas_eval: normalizeAtlasEval(src.atlas_eval ?? EMPTY_ATLAS_EVAL),
  }

  const hasDraft =
    imported.initial_email_subject?.trim() && imported.initial_email_body?.trim()
  if (hasDraft) {
    imported.initial_email_drafted_at = new Date().toISOString()
  }

  return imported
}

export function mergeLeadImport(base: LeadInput, imported: Partial<LeadInput>): LeadInput {
  return {
    ...base,
    ...imported,
    links: imported.links && imported.links.length > 0 ? imported.links : base.links,
    emails: imported.emails && imported.emails.length > 0 ? imported.emails : base.emails,
    tags: imported.tags && imported.tags.length > 0 ? imported.tags : base.tags,
    atlas_eval: imported.atlas_eval ?? base.atlas_eval,
    initial_email_drafted_at:
      imported.initial_email_drafted_at ?? base.initial_email_drafted_at,
    initial_email_sent_at: base.initial_email_sent_at,
    last_client_reply_at: base.last_client_reply_at,
    client_lat: base.client_lat,
    client_lon: base.client_lon,
  }
}
