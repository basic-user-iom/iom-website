import { getSupabase, useLiveCrmBackend } from './supabaseClient'
import { isCrmDemoMode, DEMO_USER } from './demoMode'
import {
  DEMO_PARTNER_STAFF,
  DEMO_STAFF,
  demoRead,
  demoWrite,
} from './demoStore'
import {
  EMPTY_ATLAS_EVAL,
  normalizeAtlasEval,
  type AtlasEval,
} from './atlasEval'
import type {
  Activity,
  ActivityInput,
  ActivityUpdate,
  CrmUser,
  InboundUnmatched,
  Lead,
  LeadEmail,
  LeadFilters,
  LeadInput,
  LeadLink,
  LeadMessage,
  LeadMessageCreate,
  LeadSort,
  LeadStatus,
  StaffProfile,
} from './types'
import { ownerDisplayName } from './types'
import {
  normalizeScheduledSend,
  scheduledSendDue,
  type ScheduledSend,
} from './scheduledSend'
import { normalizeLeadTags, hasNeedsReview, withoutNeedsReview } from './leadTags'
import { isAutoReplyLeadMessage } from './autoReplyEmail'
import { normalizeValueEmoji } from './valueEmoji'
import { OUTREACH_FROM_IDENTITIES } from './outreachFromIdentities'
import { renderOutreachEmailHtml } from './outreachEmailHtml'

const LEADS_KEY = 'iom-crm-leads'
const ACTIVITIES_KEY = 'iom-crm-activities'
const MESSAGES_KEY = 'iom-crm-lead-messages'
const LOCAL_SESSION_KEY = 'iom-crm-local-session'
/** Staff profile photos (not lead/contact photos) */
const AVATAR_BUCKET = 'crm-user-avatars'
/** Max size after crop/compress (upload). */
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
/** Max size for the source image before crop (user pick). */
const MAX_SOURCE_PHOTO_BYTES = 12 * 1024 * 1024
/**
 * Auth JWTs embed user_metadata. A data-URL avatar of ~37KB made the access
 * token ~50KB; Chromium then got opaque HTTP 400 on every PostgREST call and
 * the CRM showed 0 leads. Never put large data URLs in Auth metadata.
 */
const MAX_JWT_SAFE_AVATAR_CHARS = 2_500

type LocalSession = { id: string; email: string; avatar_url?: string | null }

function uid(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

function readLocal<T>(key: string, fallback: T): T {
  if (isCrmDemoMode()) return demoRead(key, fallback)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** PostgREST default max-rows is 1000 — page list + bulk export so counts stay complete. */
const REST_PAGE_SIZE = 1000

async function fetchAllPaged<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const to = from + REST_PAGE_SIZE - 1
    const { data, error } = await fetchPage(from, to)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < REST_PAGE_SIZE) break
    from += REST_PAGE_SIZE
  }
  return out
}

function writeLocal<T>(key: string, value: T): void {
  if (isCrmDemoMode()) {
    demoWrite(key, value)
    return
  }
  localStorage.setItem(key, JSON.stringify(value))
}

const STATUS_SORT_ORDER: LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]

function matchesFilters(lead: Lead, filters: LeadFilters): boolean {
  if (filters.status === 'client_replied') {
    if (!lead.last_client_reply_at) return false
  } else if (filters.status === 'not_contacted') {
    if (lead.initial_email_sent_at) return false
  } else if (filters.status === 'needs_review') {
    if (!hasNeedsReview(lead.tags)) return false
  } else if (filters.status !== 'all' && lead.status !== filters.status) {
    return false
  }
  if (filters.temperature !== 'all' && lead.temperature !== filters.temperature) {
    return false
  }
  if (filters.owner !== 'all') {
    if (filters.owner === 'none') {
      if (lead.owner_id || lead.owner_email) return false
    } else {
      const key = lead.owner_id || lead.owner_email || ''
      if (key !== filters.owner) return false
    }
  }
  if (filters.tag !== 'all') {
    const want = filters.tag.trim().toLowerCase()
    if (!normalizeLeadTags(lead.tags).includes(want)) return false
  }
  const q = filters.search.trim().toLowerCase()
  if (!q) return true
  const hay = [
    lead.company_name,
    lead.contact_name,
    lead.email,
    ...(lead.emails ?? []).flatMap((e) => [e.label, e.email]),
    lead.phone,
    lead.website,
    ...(lead.links ?? []).flatMap((l) => [l.label, l.url]),
    lead.offer,
    ...(lead.tags ?? []),
    lead.owner_email,
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

/** Apply search / stage / owner / tag filters in memory (no extra Supabase download). */
export function applyLeadFilters(leads: Lead[], filters: LeadFilters): Lead[] {
  const specialStatus =
    filters.status === 'not_contacted' ||
    filters.status === 'client_replied' ||
    filters.status === 'needs_review'
      ? filters.status
      : filters.status
  const effectiveSort: LeadSort =
    filters.status === 'client_replied' ? 'last_reply' : filters.sort
  return sortLeads(
    leads.filter((l) =>
      matchesFilters(l, {
        ...filters,
        status: specialStatus,
      }),
    ),
    effectiveSort,
  )
}

function sortLeads(leads: Lead[], sort: LeadSort = 'updated'): Lead[] {
  const copy = [...leads]
  if (sort === 'owner') {
    copy.sort((a, b) => {
      const an = ownerDisplayName(a.owner_email, '\uffff')
      const bn = ownerDisplayName(b.owner_email, '\uffff')
      const byName = an.localeCompare(bn, undefined, { sensitivity: 'base' })
      if (byName !== 0) return byName
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    return copy
  }
  if (sort === 'status') {
    copy.sort((a, b) => {
      const ai = STATUS_SORT_ORDER.indexOf(a.status)
      const bi = STATUS_SORT_ORDER.indexOf(b.status)
      if (ai !== bi) return ai - bi
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    return copy
  }
  if (sort === 'last_reply') {
    copy.sort((a, b) => {
      const at = a.last_client_reply_at
        ? new Date(a.last_client_reply_at).getTime()
        : 0
      const bt = b.last_client_reply_at
        ? new Date(b.last_client_reply_at).getTime()
        : 0
      if (bt !== at) return bt - at
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    return copy
  }
  copy.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
  return copy
}

function ownerSnapshotFromUser(user: CrmUser | null): {
  owner_id: string | null
  owner_email: string | null
  owner_avatar_url: string | null
} {
  return {
    owner_id: user?.id ?? null,
    owner_email: user?.email ?? null,
    owner_avatar_url: user?.avatar_url ?? null,
  }
}

function isMissingOwnerSnapshotColumn(message: string): boolean {
  const m = message.toLowerCase()
  // Require the specific column name so unrelated "column does not exist"
  // errors do not keep the shared-"Added by" banner stuck after migration.
  const mentionsOwnerCol =
    m.includes('owner_email') || m.includes('owner_avatar_url')
  return (
    mentionsOwnerCol &&
    (m.includes('does not exist') ||
      m.includes('could not find') ||
      m.includes('schema cache'))
  )
}

function isMissingClientLocaleColumn(message: string): boolean {
  const m = message.toLowerCase()
  const mentions =
    m.includes('client_timezone') ||
    m.includes('client_city') ||
    m.includes('client_country') ||
    m.includes('client_lat') ||
    m.includes('client_lon')
  return (
    mentions &&
    (m.includes('does not exist') ||
      m.includes('could not find') ||
      m.includes('schema cache'))
  )
}

function isMissingLinksColumn(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('links') &&
    (m.includes('does not exist') ||
      m.includes('could not find') ||
      m.includes('schema cache'))
  )
}

function isMissingValueEmojiColumn(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('value_emoji') &&
    (m.includes('does not exist') ||
      m.includes('could not find') ||
      m.includes('schema cache'))
  )
}

function isMissingTagsColumn(message: string): boolean {
  const m = message.toLowerCase()
  return (
    (m.includes('tags') || m.includes('last_client_reply_at')) &&
    (m.includes('does not exist') ||
      m.includes('could not find') ||
      m.includes('schema cache'))
  )
}

function isMissingContactPriorityColumn(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('contact_priority') &&
    (m.includes('does not exist') ||
      m.includes('could not find') ||
      m.includes('schema cache'))
  )
}

function isMissingScheduledSendColumn(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('scheduled_send') &&
    (m.includes('does not exist') ||
      m.includes('could not find') ||
      m.includes('schema cache'))
  )
}

function isMissingEmailsColumn(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('emails') &&
    (m.includes('does not exist') ||
      m.includes('could not find') ||
      m.includes('schema cache'))
  )
}

function isMissingAtlasEvalColumn(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('atlas_eval') &&
    (m.includes('does not exist') ||
      m.includes('could not find') ||
      m.includes('schema cache'))
  )
}

function isMissingOutreachColumn(message: string): boolean {
  const m = message.toLowerCase()
  const mentions =
    m.includes('initial_email_subject') ||
    m.includes('initial_email_body') ||
    m.includes('initial_email_drafted_at') ||
    m.includes('initial_email_sent_at') ||
    m.includes('contact_role') ||
    m.includes('company_focus') ||
    m.includes('client_address')
  return (
    mentions &&
    (m.includes('does not exist') ||
      m.includes('could not find') ||
      m.includes('schema cache'))
  )
}

const OUTREACH_KEYS = [
  'contact_role',
  'company_focus',
  'client_address',
  'initial_email_subject',
  'initial_email_body',
  'initial_email_drafted_at',
  'initial_email_sent_at',
] as const

type OutreachFields = Pick<
  Lead,
  | 'contact_role'
  | 'company_focus'
  | 'client_address'
  | 'initial_email_subject'
  | 'initial_email_body'
  | 'initial_email_drafted_at'
  | 'initial_email_sent_at'
>

function stripOutreachFields<T extends Record<string, unknown>>(input: T): T {
  const next = { ...input }
  for (const key of OUTREACH_KEYS) {
    delete next[key]
  }
  return next
}

function pickOutreachFields(
  source: Partial<OutreachFields> | null | undefined,
): OutreachFields {
  return {
    contact_role: source?.contact_role ?? '',
    company_focus: source?.company_focus ?? '',
    client_address: source?.client_address ?? '',
    initial_email_subject: source?.initial_email_subject ?? '',
    initial_email_body: source?.initial_email_body ?? '',
    initial_email_drafted_at: source?.initial_email_drafted_at ?? null,
    initial_email_sent_at: source?.initial_email_sent_at ?? null,
  }
}

function mergeOutreachFields(
  row: Lead,
  source: Partial<OutreachFields> | null | undefined,
): Lead {
  if (!source) return normalizeLead(row)
  const hasAny = OUTREACH_KEYS.some((key) => {
    const v = source[key]
    if (v == null) return false
    if (typeof v === 'string') return v.trim() !== ''
    return true
  })
  if (!hasAny) return normalizeLead(row)
  return normalizeLead({ ...row, ...pickOutreachFields(source) })
}

const CLIENT_LOCALE_KEYS = [
  'client_timezone',
  'client_city',
  'client_country',
  'client_lat',
  'client_lon',
] as const

type ClientLocaleFields = Pick<
  Lead,
  'client_timezone' | 'client_city' | 'client_country' | 'client_lat' | 'client_lon'
>

function stripClientLocaleFields<T extends Record<string, unknown>>(input: T): T {
  const next = { ...input }
  for (const key of CLIENT_LOCALE_KEYS) {
    delete next[key]
  }
  return next
}

function stripLinksField<T extends Record<string, unknown>>(input: T): T {
  const next = { ...input }
  delete next.links
  return next
}

function stripValueEmojiField<T extends Record<string, unknown>>(input: T): T {
  const next = { ...input }
  delete next.value_emoji
  return next
}

function stripTagsFields<T extends Record<string, unknown>>(input: T): T {
  const next = { ...input }
  delete next.tags
  delete next.last_client_reply_at
  return next
}

function stripContactPriorityField<T extends Record<string, unknown>>(input: T): T {
  const next = { ...input }
  delete next.contact_priority
  return next
}

function stripScheduledSendField<T extends Record<string, unknown>>(input: T): T {
  const next = { ...input }
  delete next.scheduled_send
  return next
}

function stripEmailsField<T extends Record<string, unknown>>(input: T): T {
  const next = { ...input }
  delete next.emails
  return next
}

function stripAtlasEvalField<T extends Record<string, unknown>>(input: T): T {
  const next = { ...input }
  delete next.atlas_eval
  return next
}

function pickClientLocale(
  source: Partial<ClientLocaleFields> | null | undefined,
): ClientLocaleFields {
  return {
    client_timezone: source?.client_timezone ?? '',
    client_city: source?.client_city ?? '',
    client_country: source?.client_country ?? '',
    client_lat: source?.client_lat ?? null,
    client_lon: source?.client_lon ?? null,
  }
}

/** Keep form values when DB omitted client_* (missing columns / narrow SELECT). */
function mergeClientLocale(
  row: Lead,
  source: Partial<ClientLocaleFields> | null | undefined,
): Lead {
  if (!source) return normalizeLead(row)
  const hasAny =
    (source.client_timezone != null && String(source.client_timezone).trim() !== '') ||
    (source.client_city != null && String(source.client_city).trim() !== '') ||
    (source.client_country != null && String(source.client_country).trim() !== '') ||
    source.client_lat != null ||
    source.client_lon != null
  if (!hasAny) return normalizeLead(row)
  return normalizeLead({ ...row, ...pickClientLocale(source) })
}

/** Normalize / lightly sanitize named links from DB or form input. */
export function normalizeLeadLinks(raw: unknown): LeadLink[] {
  if (!Array.isArray(raw)) return []
  const out: LeadLink[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const label = String((item as { label?: unknown }).label ?? '').trim()
    const url = String((item as { url?: unknown }).url ?? '').trim()
    if (!url) continue
    out.push({
      label: label || url,
      url,
    })
  }
  return out
}

/** Normalize labeled department emails from DB or form input. */
export function normalizeLeadEmails(raw: unknown): LeadEmail[] {
  if (!Array.isArray(raw)) return []
  const out: LeadEmail[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const label = String((item as { label?: unknown }).label ?? '').trim()
    const email = String((item as { email?: unknown }).email ?? '').trim()
    if (!email) continue
    out.push({
      label: label || email,
      email,
    })
  }
  return out
}

/** Light email shape check (not full RFC). */
export function isLightlyValidEmail(email: string): boolean {
  const trimmed = email.trim()
  if (!trimmed || trimmed.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

/** True when a URL string is lightly valid (http/https after optional scheme add). */
export function isLightlyValidUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withScheme)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function hrefForLeadUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function mergeLeadLinks(
  row: Lead,
  source: { links?: LeadLink[] | unknown } | null | undefined,
): Lead {
  if (!source || source.links == null) return normalizeLead(row)
  const links = normalizeLeadLinks(source.links)
  if (links.length === 0 && normalizeLeadLinks(row.links).length === 0) {
    return normalizeLead(row)
  }
  return normalizeLead({ ...row, links })
}

function mergeValueEmoji(
  row: Lead,
  source: { value_emoji?: string | null } | null | undefined,
): Lead {
  if (!source || source.value_emoji == null) return normalizeLead(row)
  const emoji = normalizeValueEmoji(source.value_emoji)
  if (!emoji && !normalizeValueEmoji(row.value_emoji)) return normalizeLead(row)
  return normalizeLead({ ...row, value_emoji: emoji })
}

function mergeLeadTags(
  row: Lead,
  source:
    | { tags?: string[] | null; last_client_reply_at?: string | null }
    | null
    | undefined,
): Lead {
  if (!source) return normalizeLead(row)
  const tags =
    source.tags != null ? normalizeLeadTags(source.tags) : normalizeLeadTags(row.tags)
  const last =
    source.last_client_reply_at !== undefined
      ? source.last_client_reply_at
      : row.last_client_reply_at ?? null
  if (
    tags.length === 0 &&
    normalizeLeadTags(row.tags).length === 0 &&
    !last &&
    !row.last_client_reply_at
  ) {
    return normalizeLead(row)
  }
  return normalizeLead({ ...row, tags, last_client_reply_at: last })
}

function mergeContactPriority(
  row: Lead,
  source: { contact_priority?: boolean | null } | null | undefined,
): Lead {
  if (!source || source.contact_priority == null) return normalizeLead(row)
  return normalizeLead({ ...row, contact_priority: !!source.contact_priority })
}

function mergeScheduledSend(
  row: Lead,
  source: { scheduled_send?: ScheduledSend | null | unknown } | null | undefined,
): Lead {
  if (!source || source.scheduled_send === undefined) return normalizeLead(row)
  return normalizeLead({
    ...row,
    scheduled_send: normalizeScheduledSend(source.scheduled_send),
  })
}

function mergeLeadEmails(
  row: Lead,
  source: { emails?: LeadEmail[] | unknown } | null | undefined,
): Lead {
  if (!source || source.emails == null) return normalizeLead(row)
  const emails = normalizeLeadEmails(source.emails)
  if (emails.length === 0 && normalizeLeadEmails(row.emails).length === 0) {
    return normalizeLead(row)
  }
  return normalizeLead({ ...row, emails })
}

function mergeAtlasEval(
  row: Lead,
  source: { atlas_eval?: AtlasEval | unknown } | null | undefined,
): Lead {
  if (!source || source.atlas_eval == null) return normalizeLead(row)
  const atlas_eval = normalizeAtlasEval(source.atlas_eval)
  const prev = normalizeAtlasEval(row.atlas_eval)
  const incomingEmpty = Object.values(atlas_eval).every((v) => v === 0)
  const prevEmpty = Object.values(prev).every((v) => v === 0)
  if (incomingEmpty && prevEmpty) return normalizeLead(row)
  if (incomingEmpty && !prevEmpty) return normalizeLead(row)
  return normalizeLead({ ...row, atlas_eval })
}

function normalizeLead(row: Lead): Lead {
  return {
    ...row,
    links: normalizeLeadLinks(row.links),
    emails: normalizeLeadEmails(row.emails),
    value_emoji: normalizeValueEmoji(row.value_emoji),
    tags: normalizeLeadTags(row.tags),
    last_client_reply_at: row.last_client_reply_at ?? null,
    atlas_eval: normalizeAtlasEval(row.atlas_eval ?? EMPTY_ATLAS_EVAL),
    client_timezone: row.client_timezone ?? '',
    client_city: row.client_city ?? '',
    client_country: row.client_country ?? '',
    client_address: row.client_address ?? '',
    client_lat: row.client_lat ?? null,
    client_lon: row.client_lon ?? null,
    contact_role: row.contact_role ?? '',
    company_focus: row.company_focus ?? '',
    initial_email_subject: row.initial_email_subject ?? '',
    initial_email_body: row.initial_email_body ?? '',
    initial_email_drafted_at: row.initial_email_drafted_at ?? null,
    initial_email_sent_at: row.initial_email_sent_at ?? null,
    contact_priority: !!row.contact_priority,
    scheduled_send: normalizeScheduledSend(row.scheduled_send),
    owner_email: row.owner_email ?? null,
    owner_avatar_url: row.owner_avatar_url ?? null,
  }
}

function extFromMime(type: string): string {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'jpg'
}

function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx < 0) return null
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0] ?? '')
}

function avatarFromMetadata(meta: Record<string, unknown> | undefined): string | null {
  const raw = meta?.avatar_url
  if (typeof raw !== 'string' || !raw.trim()) return null
  const url = raw.trim()
  // Oversized data URLs bloat the Auth JWT and break every PostgREST call.
  if (url.startsWith('data:') && url.length > MAX_JWT_SAFE_AVATAR_CHARS) return null
  return url
}

function isJwtUnsafeAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return url.startsWith('data:') && url.length > MAX_JWT_SAFE_AVATAR_CHARS
}

/**
 * If Auth metadata holds a huge data-URL photo, clear it and refresh the
 * session so PostgREST requests stop failing with HTTP 400.
 */
async function healOversizedAuthAvatar(): Promise<void> {
  if (!useLiveCrmBackend()) return
  const supabase = getSupabase()!
  const { data } = await supabase.auth.getSession()
  const meta = data.session?.user?.user_metadata as
    | Record<string, unknown>
    | undefined
  const raw = typeof meta?.avatar_url === 'string' ? meta.avatar_url : null
  if (!isJwtUnsafeAvatarUrl(raw)) return

  const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } })
  if (error) {
    console.warn('Could not clear oversized profile photo from Auth:', error.message)
    return
  }
  await supabase.auth.refreshSession()
}

function toCrmUser(id: string, email: string, avatar_url: string | null): CrmUser {
  return { id, email, avatar_url }
}

function displayNameFromEmail(email: string): string {
  return ownerDisplayName(email, email)
}

function isMissingStaffProfilesTable(message: string): boolean {
  const m = message.toLowerCase()
  if (!m.includes('crm_staff_profiles')) return false
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('pgrst205') ||
    m.includes('42p01')
  )
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read image.'))
    }
    reader.onerror = () => reject(new Error('Could not read image.'))
    reader.readAsDataURL(file)
  })
}

function assertImageFile(file: File): void {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_PHOTO_BYTES) throw new Error('Image must be under 2 MB.')
}

/* ── Auth ─────────────────────────────────────────────── */

export async function getCurrentUser(): Promise<CrmUser | null> {
  if (isCrmDemoMode()) {
    return toCrmUser(DEMO_USER.id, DEMO_USER.email, DEMO_USER.avatar_url)
  }
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    await healOversizedAuthAvatar().catch(() => {})
    const { data } = await supabase.auth.getUser()
    if (!data.user?.email) return null
    return toCrmUser(
      data.user.id,
      data.user.email,
      avatarFromMetadata(data.user.user_metadata as Record<string, unknown>),
    )
  }
  const session = readLocal<LocalSession | null>(LOCAL_SESSION_KEY, null)
  if (!session?.email) return null
  return toCrmUser(session.id, session.email, session.avatar_url ?? null)
}

export function onAuthChange(cb: (user: CrmUser | null) => void): () => void {
  if (isCrmDemoMode()) {
    cb(toCrmUser(DEMO_USER.id, DEMO_USER.email, DEMO_USER.avatar_url))
    return () => {}
  }
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      cb(
        u?.email
          ? toCrmUser(
              u.id,
              u.email,
              avatarFromMetadata(u.user_metadata as Record<string, unknown>),
            )
          : null,
      )
    })
    return () => data.subscription.unsubscribe()
  }
  return () => {}
}

export async function signIn(
  email: string,
  password: string,
): Promise<import('./crmMfa').SignInResult> {
  if (isCrmDemoMode()) return { kind: 'complete' }

  const trimmed = email.trim()
  if (!trimmed || !password) throw new Error('Email and password are required.')

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    })
    if (error) {
      // Uniform public error — avoid provider account-enumeration messages.
      console.warn('[crm] sign-in failed:', error.message)
      throw new Error('INVALID_LOGIN')
    }
    await healOversizedAuthAvatar().catch(() => {})
    const { getPostLoginMfaState } = await import('./crmMfa')
    return getPostLoginMfaState()
  }

  // Production must not fall back to a browser-local password.
  if (import.meta.env.PROD) {
    throw new Error('LOGIN_UNAVAILABLE')
  }

  const expected = import.meta.env.VITE_CRM_LOCAL_PASSWORD?.trim()
  if (!expected || password !== expected) {
    throw new Error('INVALID_LOGIN')
  }
  const existing = readLocal<LocalSession | null>(LOCAL_SESSION_KEY, null)
  writeLocal(LOCAL_SESSION_KEY, {
    id: existing?.id ?? 'local-user',
    email: trimmed,
    avatar_url: existing?.email === trimmed ? (existing.avatar_url ?? null) : null,
  })
  return { kind: 'complete' }
}

export async function signOut(): Promise<void> {
  if (isCrmDemoMode()) {
    // Demo stays open; navigation back to the site is handled in the UI.
    return
  }
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    await supabase.auth.signOut()
    return
  }
  localStorage.removeItem(LOCAL_SESSION_KEY)
}

export function storageMode(): 'supabase' | 'local' | 'demo' {
  if (isCrmDemoMode()) return 'demo'
  return useLiveCrmBackend() ? 'supabase' : 'local'
}

/* ── Staff profile photo ──────────────────────────────── */

/** True when Storage has no `crm-user-avatars` bucket (or equivalent). */
function isAvatarBucketMissing(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('bucket not found') ||
    m.includes('bucket does not exist') ||
    (m.includes('not found') && m.includes('bucket'))
  )
}

/**
 * Data-URL fallback was retired: embedding photos in Auth metadata inflates
 * the access token and browsers then get HTTP 400 on all CRM API calls.
 */
function avatarStorageRequiredError(): Error {
  return new Error(
    'Profile photo storage is not set up yet. In Supabase → SQL Editor, paste and run the avatar bucket SQL (create public bucket crm-user-avatars + policies), then try again. Do not paste the file path — paste the SQL contents.',
  )
}

/** Upload / replace the logged-in user's profile photo. */
export async function uploadUserAvatar(file: File): Promise<string> {
  assertImageFile(file)

  if (!useLiveCrmBackend()) {
    const session = readLocal<LocalSession | null>(LOCAL_SESSION_KEY, null)
    if (!session) throw new Error('Not signed in.')
    const avatar_url = await fileToDataUrl(file)
    writeLocal(LOCAL_SESSION_KEY, { ...session, avatar_url })
    await syncOwnLeadOwnerAvatar(avatar_url)
    await upsertOwnStaffProfile({ avatar_url })
    return avatar_url
  }

  const supabase = getSupabase()!
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in.')

  const path = `${user.id}/avatar.${extFromMime(file.type)}`
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type })

  let avatar_url: string
  if (uploadError) {
    if (isAvatarBucketMissing(uploadError.message)) {
      throw avatarStorageRequiredError()
    }
    throw new Error(uploadError.message)
  }

  {
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
    avatar_url = `${data.publicUrl}?t=${Date.now()}`

    const { error: metaError } = await supabase.auth.updateUser({
      data: { avatar_url },
    })
    if (metaError) throw new Error(metaError.message)
  }

  await syncOwnLeadOwnerAvatar(avatar_url)
  await upsertOwnStaffProfile({ avatar_url })
  return avatar_url
}

/** Remove the logged-in user's profile photo. */
export async function removeUserAvatar(): Promise<void> {
  if (!useLiveCrmBackend()) {
    const session = readLocal<LocalSession | null>(LOCAL_SESSION_KEY, null)
    if (!session) throw new Error('Not signed in.')
    writeLocal(LOCAL_SESSION_KEY, { ...session, avatar_url: null })
    await syncOwnLeadOwnerAvatar(null)
    await upsertOwnStaffProfile({ avatar_url: null })
    return
  }

  const supabase = getSupabase()!
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in.')

  const previous = user.avatar_url
  const { error: metaError } = await supabase.auth.updateUser({
    data: { avatar_url: null },
  })
  if (metaError) throw new Error(metaError.message)

  if (previous && !previous.startsWith('data:')) {
    const path = storagePathFromPublicUrl(previous, AVATAR_BUCKET)
    if (path) {
      await supabase.storage.from(AVATAR_BUCKET).remove([path])
    } else {
      // Fallback fixed path used by uploadUserAvatar
      await supabase.storage.from(AVATAR_BUCKET).remove([
        `${user.id}/avatar.jpg`,
        `${user.id}/avatar.png`,
        `${user.id}/avatar.webp`,
        `${user.id}/avatar.gif`,
      ])
    }
  }

  await syncOwnLeadOwnerAvatar(null)
  await upsertOwnStaffProfile({ avatar_url: null })
}

/**
 * Nice-to-have: when a staff member updates their profile photo,
 * refresh the denormalized snapshot on leads they created.
 */
export async function syncOwnLeadOwnerAvatar(avatar_url: string | null): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  // Never write data-URL blobs onto lead rows (or into Auth via backfill).
  const safeAvatar = isJwtUnsafeAvatarUrl(avatar_url) ? null : avatar_url

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase
      .from('crm_leads')
      .update({
        owner_avatar_url: safeAvatar,
        owner_email: user.email,
      })
      .eq('owner_id', user.id)
    if (error && isMissingOwnerSnapshotColumn(error.message)) return
    if (error) {
      // Non-fatal — list still works with stale snapshots / live fallback
      console.warn('Could not refresh lead owner photos:', error.message)
    }
    return
  }

  const leads = readLocal<Lead[]>(LEADS_KEY, [])
  let changed = false
  const next = leads.map((lead) => {
    if (lead.owner_id !== user.id) return lead
    changed = true
    return {
      ...lead,
      owner_email: user.email,
      owner_avatar_url: safeAvatar,
    }
  })
  if (changed) writeLocal(LEADS_KEY, next)
}

export function validateAvatarFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Please choose an image file.'
  if (file.size > MAX_SOURCE_PHOTO_BYTES) return 'Image must be under 12 MB.'
  return null
}

/* ── Leads ────────────────────────────────────────────── */

/**
 * Drop browser-local demo leads when online Supabase is configured so a
 * previous local-only "I added this" cannot look like shared attribution.
 */
function clearMisleadingLocalAttributionCache(): void {
  if (!useLiveCrmBackend()) return
  try {
    localStorage.removeItem(LEADS_KEY)
    localStorage.removeItem(ACTIVITIES_KEY)
  } catch {
    /* ignore quota / private mode */
  }
}

/** Whether live DB has owner snapshot columns + staff directory (shared attribution). */
export type OwnerAttributionSchema = {
  ownerSnapshotColumns: boolean
  staffProfiles: boolean
}

/**
 * Probe whether `owner_email` / `crm_staff_profiles` exist.
 * Without them, only the lead owner sees their name (isSelf UI fallback).
 */
let ownerAttributionSchema: OwnerAttributionSchema | null = null

export async function probeOwnerAttributionSchema(): Promise<OwnerAttributionSchema> {
  if (!useLiveCrmBackend()) {
    return { ownerSnapshotColumns: true, staffProfiles: true }
  }
  if (ownerAttributionSchema) return ownerAttributionSchema
  const supabase = getSupabase()!
  const [leadsProbe, staffProbe] = await Promise.all([
    supabase.from('crm_leads').select('owner_email').limit(1),
    supabase.from('crm_staff_profiles').select('id').limit(1),
  ])
  const ownerSnapshotColumns = !(
    leadsProbe.error && isMissingOwnerSnapshotColumn(leadsProbe.error.message)
  )
  const staffProfiles = !(
    staffProbe.error && isMissingStaffProfilesTable(staffProbe.error.message)
  )
  const result = { ownerSnapshotColumns, staffProfiles }
  const leadsSettled =
    !leadsProbe.error || isMissingOwnerSnapshotColumn(leadsProbe.error.message)
  const staffSettled =
    !staffProbe.error || isMissingStaffProfilesTable(staffProbe.error.message)
  if (leadsSettled && staffSettled) ownerAttributionSchema = result
  return result
}

/** Cached probe: null = unknown, true = columns exist, false = migration needed. */
let clientLocaleColumnsPresent: boolean | null = null
/** Cached probe for crm_leads.links jsonb column. */
let linksColumnPresent: boolean | null = null
/** Cached probe for crm_leads.value_emoji text column. */
let valueEmojiColumnPresent: boolean | null = null
/** Cached probe for crm_leads.tags / last_client_reply_at columns. */
let tagsColumnsPresent: boolean | null = null
/** Cached probe for crm_leads.contact_priority boolean column. */
let contactPriorityColumnPresent: boolean | null = null
/** Cached probe for crm_leads.scheduled_send jsonb column. */
let scheduledSendColumnPresent: boolean | null = null
/** Cached probe for crm_leads.emails jsonb column. */
let emailsColumnPresent: boolean | null = null
/** Cached probe for crm_leads.atlas_eval jsonb column. */
let atlasEvalColumnPresent: boolean | null = null
/** Cached probe for outreach / initial email columns on crm_leads. */
let outreachColumnsPresent: boolean | null = null

function markClientLocaleColumnsMissing(): void {
  clientLocaleColumnsPresent = false
}

function markClientLocaleColumnsPresent(): void {
  clientLocaleColumnsPresent = true
}

function markLinksColumnMissing(): void {
  linksColumnPresent = false
}

function markLinksColumnPresent(): void {
  linksColumnPresent = true
}

function markValueEmojiColumnMissing(): void {
  valueEmojiColumnPresent = false
}

function markValueEmojiColumnPresent(): void {
  valueEmojiColumnPresent = true
}

function markTagsColumnsMissing(): void {
  tagsColumnsPresent = false
}

function markTagsColumnsPresent(): void {
  tagsColumnsPresent = true
}

function markContactPriorityColumnMissing(): void {
  contactPriorityColumnPresent = false
}

function markContactPriorityColumnPresent(): void {
  contactPriorityColumnPresent = true
}

function markScheduledSendColumnMissing(): void {
  scheduledSendColumnPresent = false
}

function markScheduledSendColumnPresent(): void {
  scheduledSendColumnPresent = true
}

function markEmailsColumnMissing(): void {
  emailsColumnPresent = false
}

function markEmailsColumnPresent(): void {
  emailsColumnPresent = true
}

function markAtlasEvalColumnMissing(): void {
  atlasEvalColumnPresent = false
}

function markAtlasEvalColumnPresent(): void {
  atlasEvalColumnPresent = true
}

function markOutreachColumnsMissing(): void {
  outreachColumnsPresent = false
}

function markOutreachColumnsPresent(): void {
  outreachColumnsPresent = true
}

/** True when a prior probe/update learned client_* columns are absent. */
export function clientLocaleSchemaKnownMissing(): boolean {
  return clientLocaleColumnsPresent === false
}

/** True when a prior probe/update learned links column is absent. */
export function linksSchemaKnownMissing(): boolean {
  return linksColumnPresent === false
}

/** True when a prior probe/update learned value_emoji column is absent. */
export function valueEmojiSchemaKnownMissing(): boolean {
  return valueEmojiColumnPresent === false
}

/** True when a prior probe/update learned tags / last_client_reply_at are absent. */
export function tagsSchemaKnownMissing(): boolean {
  return tagsColumnsPresent === false
}

/** True when a prior probe/update learned contact_priority column is absent. */
export function contactPrioritySchemaKnownMissing(): boolean {
  return contactPriorityColumnPresent === false
}

/** True when a prior probe/update learned scheduled_send column is absent. */
export function scheduledSendSchemaKnownMissing(): boolean {
  return scheduledSendColumnPresent === false
}

/** True when a prior probe/update learned emails column is absent. */
export function emailsSchemaKnownMissing(): boolean {
  return emailsColumnPresent === false
}

/** True when a prior probe/update learned atlas_eval column is absent. */
export function atlasEvalSchemaKnownMissing(): boolean {
  return atlasEvalColumnPresent === false
}

/** True when outreach / initial email columns are absent. */
export function outreachSchemaKnownMissing(): boolean {
  return outreachColumnsPresent === false
}

/**
 * When list rows omit client_* (missing columns), keep optimistic values
 * already in memory so the weather panel does not flash empty after refresh.
 */
export function preserveClientLocaleFields(
  incoming: Lead[],
  previous: Lead[],
): Lead[] {
  if (incoming.length === 0 || previous.length === 0) return incoming
  const prevById = new Map(previous.map((l) => [l.id, l]))
  return incoming.map((row) => {
    const hasIncoming =
      !!row.client_timezone?.trim() ||
      !!row.client_city?.trim() ||
      !!row.client_country?.trim() ||
      row.client_lat != null ||
      row.client_lon != null
    if (hasIncoming) return row
    const prev = prevById.get(row.id)
    if (!prev) return row
    return mergeClientLocale(row, prev)
  })
}

/**
 * When list rows omit links (missing column), keep optimistic values in memory.
 */
export function preserveLeadLinksFields(
  incoming: Lead[],
  previous: Lead[],
): Lead[] {
  if (incoming.length === 0 || previous.length === 0) return incoming
  const prevById = new Map(previous.map((l) => [l.id, l]))
  return incoming.map((row) => {
    if (normalizeLeadLinks(row.links).length > 0) return row
    const prev = prevById.get(row.id)
    if (!prev || normalizeLeadLinks(prev.links).length === 0) return row
    return mergeLeadLinks(row, prev)
  })
}

/**
 * When list rows omit value_emoji (missing column), keep optimistic values.
 */
export function preserveValueEmojiFields(
  incoming: Lead[],
  previous: Lead[],
): Lead[] {
  if (incoming.length === 0 || previous.length === 0) return incoming
  const prevById = new Map(previous.map((l) => [l.id, l]))
  return incoming.map((row) => {
    if (normalizeValueEmoji(row.value_emoji)) return row
    const prev = prevById.get(row.id)
    if (!prev || !normalizeValueEmoji(prev.value_emoji)) return row
    return mergeValueEmoji(row, prev)
  })
}

/**
 * When list rows omit contact_priority (missing column), keep optimistic values.
 */
export function preserveContactPriorityFields(
  incoming: Lead[],
  previous: Lead[],
): Lead[] {
  if (incoming.length === 0 || previous.length === 0) return incoming
  const prevById = new Map(previous.map((l) => [l.id, l]))
  return incoming.map((row) => {
    if (row.contact_priority) return row
    const prev = prevById.get(row.id)
    if (!prev?.contact_priority) return row
    return mergeContactPriority(row, prev)
  })
}

/**
 * When list rows omit scheduled_send (missing column), keep optimistic values.
 */
export function preserveScheduledSendFields(
  incoming: Lead[],
  previous: Lead[],
): Lead[] {
  if (incoming.length === 0 || previous.length === 0) return incoming
  const prevById = new Map(previous.map((l) => [l.id, l]))
  return incoming.map((row) => {
    if (normalizeScheduledSend(row.scheduled_send)) return row
    const prev = prevById.get(row.id)
    if (!prev || !normalizeScheduledSend(prev.scheduled_send)) return row
    return mergeScheduledSend(row, prev)
  })
}

/**
 * When list rows omit emails (missing column), keep optimistic values in memory.
 */
export function preserveLeadEmailsFields(
  incoming: Lead[],
  previous: Lead[],
): Lead[] {
  if (incoming.length === 0 || previous.length === 0) return incoming
  const prevById = new Map(previous.map((l) => [l.id, l]))
  return incoming.map((row) => {
    if (normalizeLeadEmails(row.emails).length > 0) return row
    const prev = prevById.get(row.id)
    if (!prev || normalizeLeadEmails(prev.emails).length === 0) return row
    return mergeLeadEmails(row, prev)
  })
}

/**
 * When list rows omit atlas_eval (missing column), keep optimistic values.
 */
export function preserveAtlasEvalFields(
  incoming: Lead[],
  previous: Lead[],
): Lead[] {
  if (incoming.length === 0 || previous.length === 0) return incoming
  const prevById = new Map(previous.map((l) => [l.id, l]))
  return incoming.map((row) => {
    const incomingEval = normalizeAtlasEval(row.atlas_eval)
    const incomingHas = Object.values(incomingEval).some((v) => v > 0)
    if (incomingHas) return row
    const prev = prevById.get(row.id)
    if (!prev) return row
    const prevEval = normalizeAtlasEval(prev.atlas_eval)
    if (!Object.values(prevEval).some((v) => v > 0)) return row
    return mergeAtlasEval(row, prev)
  })
}

/** When list rows omit outreach fields (missing columns), keep optimistic values. */
export function preserveOutreachFields(incoming: Lead[], previous: Lead[]): Lead[] {
  if (incoming.length === 0 || previous.length === 0) return incoming
  const prevById = new Map(previous.map((l) => [l.id, l]))
  return incoming.map((row) => {
    const prev = prevById.get(row.id)
    if (!prev) return row
    // List queries omit initial_email_body; keep a hydrated draft in memory.
    const withBody =
      !row.initial_email_body?.trim() && prev.initial_email_body?.trim()
        ? { ...row, initial_email_body: prev.initial_email_body }
        : row
    const hasIncoming =
      !!withBody.initial_email_subject?.trim() ||
      !!withBody.initial_email_body?.trim() ||
      !!withBody.contact_role?.trim() ||
      !!withBody.company_focus?.trim()
    if (hasIncoming) return withBody
    return mergeOutreachFields(withBody, prev)
  })
}

/**
 * Probe whether client timezone / location columns exist on `crm_leads`.
 * Returns true when columns are present (or local mode).
 */
export async function probeClientLocaleSchema(): Promise<boolean> {
  if (!useLiveCrmBackend()) {
    markClientLocaleColumnsPresent()
    return true
  }
  if (clientLocaleColumnsPresent != null) return clientLocaleColumnsPresent

  const supabase = getSupabase()!
  const { error } = await supabase
    .from('crm_leads')
    .select('client_timezone, client_city, client_country, client_lat, client_lon')
    .limit(1)

  if (error && isMissingClientLocaleColumn(error.message)) {
    markClientLocaleColumnsMissing()
    return false
  }
  if (error) {
    console.warn('Could not probe client locale columns:', error.message)
    return true
  }
  markClientLocaleColumnsPresent()
  return true
}

/**
 * Probe whether `links` jsonb exists on `crm_leads`.
 * Returns true when column is present (or local mode).
 */
export async function probeLinksSchema(): Promise<boolean> {
  if (!useLiveCrmBackend()) {
    markLinksColumnPresent()
    return true
  }
  if (linksColumnPresent != null) return linksColumnPresent

  const supabase = getSupabase()!
  const { error } = await supabase.from('crm_leads').select('links').limit(1)

  if (error && isMissingLinksColumn(error.message)) {
    markLinksColumnMissing()
    return false
  }
  if (error) {
    console.warn('Could not probe links column:', error.message)
    return true
  }
  markLinksColumnPresent()
  return true
}

/**
 * Probe whether `value_emoji` exists on `crm_leads`.
 * Returns true when column is present (or local mode).
 */
export async function probeValueEmojiSchema(): Promise<boolean> {
  if (!useLiveCrmBackend()) {
    markValueEmojiColumnPresent()
    return true
  }
  if (valueEmojiColumnPresent != null) return valueEmojiColumnPresent

  const supabase = getSupabase()!
  const { error } = await supabase.from('crm_leads').select('value_emoji').limit(1)

  if (error && isMissingValueEmojiColumn(error.message)) {
    markValueEmojiColumnMissing()
    return false
  }
  if (error) {
    console.warn('Could not probe value_emoji column:', error.message)
    return true
  }
  markValueEmojiColumnPresent()
  return true
}

/**
 * Probe whether `contact_priority` exists on `crm_leads`.
 * Returns true when column is present (or local mode).
 */
export async function probeContactPrioritySchema(): Promise<boolean> {
  if (!useLiveCrmBackend()) {
    markContactPriorityColumnPresent()
    return true
  }
  if (contactPriorityColumnPresent != null) return contactPriorityColumnPresent

  const supabase = getSupabase()!
  const { error } = await supabase.from('crm_leads').select('contact_priority').limit(1)

  if (error && isMissingContactPriorityColumn(error.message)) {
    markContactPriorityColumnMissing()
    return false
  }
  if (error) {
    console.warn('Could not probe contact_priority column:', error.message)
    return true
  }
  markContactPriorityColumnPresent()
  return true
}

/**
 * Probe whether `scheduled_send` jsonb exists on `crm_leads`.
 * Returns true when column is present (or local mode).
 */
export async function probeScheduledSendSchema(): Promise<boolean> {
  if (!useLiveCrmBackend()) {
    markScheduledSendColumnPresent()
    return true
  }
  if (scheduledSendColumnPresent != null) return scheduledSendColumnPresent

  const supabase = getSupabase()!
  const { error } = await supabase.from('crm_leads').select('scheduled_send').limit(1)

  if (error && isMissingScheduledSendColumn(error.message)) {
    markScheduledSendColumnMissing()
    return false
  }
  if (error) {
    console.warn('Could not probe scheduled_send column:', error.message)
    return true
  }
  markScheduledSendColumnPresent()
  return true
}

/**
 * Probe whether `emails` jsonb exists on `crm_leads`.
 * Returns true when column is present (or local mode).
 */
export async function probeEmailsSchema(): Promise<boolean> {
  if (!useLiveCrmBackend()) {
    markEmailsColumnPresent()
    return true
  }
  if (emailsColumnPresent != null) return emailsColumnPresent

  const supabase = getSupabase()!
  const { error } = await supabase.from('crm_leads').select('emails').limit(1)

  if (error && isMissingEmailsColumn(error.message)) {
    markEmailsColumnMissing()
    return false
  }
  if (error) {
    console.warn('Could not probe emails column:', error.message)
    return true
  }
  markEmailsColumnPresent()
  return true
}

/**
 * Probe whether `atlas_eval` jsonb exists on `crm_leads`.
 * Returns true when column is present (or local mode).
 */
export async function probeAtlasEvalSchema(): Promise<boolean> {
  if (!useLiveCrmBackend()) {
    markAtlasEvalColumnPresent()
    return true
  }
  if (atlasEvalColumnPresent != null) return atlasEvalColumnPresent

  const supabase = getSupabase()!
  const { error } = await supabase.from('crm_leads').select('atlas_eval').limit(1)

  if (error && isMissingAtlasEvalColumn(error.message)) {
    markAtlasEvalColumnMissing()
    return false
  }
  if (error) {
    console.warn('Could not probe atlas_eval column:', error.message)
    return true
  }
  markAtlasEvalColumnPresent()
  return true
}

/**
 * Probe whether initial outreach / extended lead columns exist on `crm_leads`.
 */
export async function probeOutreachSchema(): Promise<boolean> {
  if (!useLiveCrmBackend()) {
    markOutreachColumnsPresent()
    return true
  }
  if (outreachColumnsPresent != null) return outreachColumnsPresent

  const supabase = getSupabase()!
  const { error } = await supabase
    .from('crm_leads')
    .select('initial_email_subject, contact_role')
    .limit(1)

  if (error && isMissingOutreachColumn(error.message)) {
    markOutreachColumnsMissing()
    return false
  }
  if (error) {
    console.warn('Could not probe outreach columns:', error.message)
    return true
  }
  markOutreachColumnsPresent()
  return true
}

/**
 * Backfill owner_email / owner_avatar_url on the current user's leads
 * (older rows that only have owner_id). Safe to call on each sign-in.
 */
export async function backfillOwnLeadOwnerSnapshot(): Promise<void> {
  clearMisleadingLocalAttributionCache()
  await healOversizedAuthAvatar().catch(() => {})
  const user = await getCurrentUser()
  if (!user) return
  await upsertOwnStaffProfile()
  await syncOwnLeadOwnerAvatar(user.avatar_url)
  await persistOwnIncompleteLeadSnapshots()
}

/**
 * When the signed-in user is already owner_id but owner_email is empty
 * (schema fallback / pre-migration), write the snapshot so teammates see them.
 */
export async function persistOwnIncompleteLeadSnapshots(): Promise<number> {
  const user = await getCurrentUser()
  if (!user || !useLiveCrmBackend()) return 0
  const supabase = getSupabase()!
  const snapshot = ownerSnapshotFromUser(user)

  // Prefer filtering in PostgREST; if owner_email column is missing, bail quietly.
  const { data, error } = await supabase
    .from('crm_leads')
    .select('id, owner_id, owner_email')
    .eq('owner_id', user.id)

  if (error) {
    if (isMissingOwnerSnapshotColumn(error.message)) return 0
    console.warn('Could not list own leads for snapshot heal:', error.message)
    return 0
  }

  const incomplete = (data ?? []).filter(
    (row) => !String((row as Lead).owner_email ?? '').trim(),
  )
  if (incomplete.length === 0) return 0

  const { error: updateError } = await supabase
    .from('crm_leads')
    .update({
      owner_email: snapshot.owner_email,
      owner_avatar_url: snapshot.owner_avatar_url,
    })
    .eq('owner_id', user.id)
    .or('owner_email.is.null,owner_email.eq.')

  if (updateError) {
    if (isMissingOwnerSnapshotColumn(updateError.message)) return 0
    // Some PostgREST versions dislike empty-string or.; fall back per-id.
    let healed = 0
    for (const row of incomplete) {
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id) continue
      const { error: oneErr } = await supabase
        .from('crm_leads')
        .update({
          owner_email: snapshot.owner_email,
          owner_avatar_url: snapshot.owner_avatar_url,
        })
        .eq('id', id)
        .eq('owner_id', user.id)
      if (!oneErr) healed += 1
      else if (isMissingOwnerSnapshotColumn(oneErr.message)) return healed
    }
    return healed
  }
  return incomplete.length
}

/**
 * Publish the signed-in user's email / display name / avatar into the shared
 * staff directory so teammates can resolve "Added by" for each other's leads.
 */
export async function upsertOwnStaffProfile(patch?: {
  avatar_url?: string | null
  display_name?: string | null
}): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const display_name =
    patch?.display_name?.trim() || displayNameFromEmail(user.email)
  const avatar_url =
    patch && 'avatar_url' in patch ? (patch.avatar_url ?? null) : user.avatar_url
  const safeAvatar = isJwtUnsafeAvatarUrl(avatar_url) ? null : avatar_url

  if (!useLiveCrmBackend()) return

  const supabase = getSupabase()!
  // Update only — inserts are service-role/SQL (no self-enroll into staff).
  const { data: existing, error: lookupError } = await supabase
    .from('crm_staff_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (lookupError && isMissingStaffProfilesTable(lookupError.message)) return
  if (lookupError) {
    console.warn('Could not load staff profile:', lookupError.message)
    return
  }
  if (!existing) {
    console.warn(
      'Staff profile missing for this account — add the user in Supabase crm_staff_profiles.',
    )
    return
  }

  const { error } = await supabase
    .from('crm_staff_profiles')
    .update({
      email: user.email,
      display_name,
      avatar_url: safeAvatar,
      updated_at: nowIso(),
    })
    .eq('id', user.id)
  if (error && isMissingStaffProfilesTable(error.message)) return
  if (error) {
    console.warn('Could not update staff profile:', error.message)
  }
}

/** Load shared staff directory (id → profile). Empty map if table missing. */
export async function listStaffProfiles(): Promise<Map<string, StaffProfile>> {
  const map = new Map<string, StaffProfile>()
  if (!useLiveCrmBackend()) {
    if (isCrmDemoMode()) {
      map.set(DEMO_STAFF.id, DEMO_STAFF)
      map.set(DEMO_PARTNER_STAFF.id, DEMO_PARTNER_STAFF)
      return map
    }
    const user = await getCurrentUser()
    if (user) {
      map.set(user.id, {
        id: user.id,
        email: user.email,
        display_name: displayNameFromEmail(user.email),
        avatar_url: user.avatar_url,
      })
    }
    return map
  }

  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from('crm_staff_profiles')
    .select('id, email, display_name, avatar_url')
  if (error) {
    if (!isMissingStaffProfilesTable(error.message)) {
      console.warn('Could not load staff profiles:', error.message)
    }
    return map
  }
  for (const row of data ?? []) {
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    map.set(id, {
      id,
      email: typeof row.email === 'string' ? row.email : '',
      display_name:
        typeof row.display_name === 'string' && row.display_name.trim()
          ? row.display_name
          : null,
      avatar_url:
        typeof row.avatar_url === 'string' && row.avatar_url.trim()
          ? row.avatar_url
          : null,
    })
  }
  return map
}

/**
 * Assign the current user as the person who added this lead.
 * Allowed when owner_id is null, or when owner_id is already this user but
 * owner_email is empty (complete own snapshot). Never steals another user's
 * owner_id.
 */
export async function claimLeadOwner(leadId: string): Promise<Lead> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in.')
  const existing = await getLead(leadId)
  if (!existing) throw new Error('Lead not found.')
  if (existing.owner_id && existing.owner_id !== user.id) {
    throw new Error('Lead already has an owner.')
  }
  if (existing.owner_id === user.id && existing.owner_email?.trim()) {
    throw new Error('Lead already has an owner.')
  }
  const snapshot = ownerSnapshotFromUser(user)
  await upsertOwnStaffProfile()

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const withSnapshot = {
      owner_id: snapshot.owner_id,
      owner_email: snapshot.owner_email,
      owner_avatar_url: snapshot.owner_avatar_url,
    }
    let query = supabase.from('crm_leads').update(withSnapshot).eq('id', leadId)
    if (!existing.owner_id) {
      query = query.is('owner_id', null)
    } else {
      // Complete own incomplete snapshot only.
      query = query.eq('owner_id', user.id)
    }
    const { data, error } = await query.select('*').maybeSingle()

    if (error && isMissingOwnerSnapshotColumn(error.message)) {
      let fallbackQuery = supabase
        .from('crm_leads')
        .update({ owner_id: snapshot.owner_id })
        .eq('id', leadId)
      if (!existing.owner_id) fallbackQuery = fallbackQuery.is('owner_id', null)
      else fallbackQuery = fallbackQuery.eq('owner_id', user.id)
      const { data: fallback, error: fallbackError } = await fallbackQuery
        .select('*')
        .maybeSingle()
      if (fallbackError) throw new Error(fallbackError.message)
      if (!fallback) throw new Error('Lead not found or already has an owner.')
      return normalizeLead(fallback as Lead)
    }
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Lead not found or already has an owner.')
    return normalizeLead(data as Lead)
  }

  const leads = readLocal<Lead[]>(LEADS_KEY, [])
  const idx = leads.findIndex((l) => l.id === leadId)
  if (idx < 0) throw new Error('Lead not found.')
  if (leads[idx].owner_id && leads[idx].owner_id !== user.id) {
    throw new Error('Lead already has an owner.')
  }
  if (leads[idx].owner_id === user.id && leads[idx].owner_email?.trim()) {
    throw new Error('Lead already has an owner.')
  }
  const updated: Lead = {
    ...leads[idx],
    ...snapshot,
    updated_at: nowIso(),
  }
  leads[idx] = updated
  writeLocal(LEADS_KEY, leads)
  return normalizeLead(updated)
}

/** Build explicit PostgREST select from known-present optional columns. */
function buildLeadSelect(opts?: {
  links?: boolean
  emails?: boolean
  valueEmoji?: boolean
  tags?: boolean
  contactPriority?: boolean
  scheduledSend?: boolean
  atlasEval?: boolean
  clientLocale?: boolean
  outreach?: boolean
  /** Full draft body — omit on catalog lists to keep egress tiny. */
  outreachBody?: boolean
}): string {
  const links = opts?.links ?? linksColumnPresent !== false
  const emails = opts?.emails ?? emailsColumnPresent !== false
  const valueEmoji = opts?.valueEmoji ?? valueEmojiColumnPresent !== false
  const tags = opts?.tags ?? tagsColumnsPresent !== false
  const contactPriority = opts?.contactPriority ?? contactPriorityColumnPresent !== false
  const scheduledSend = opts?.scheduledSend ?? scheduledSendColumnPresent !== false
  const atlasEval = opts?.atlasEval ?? atlasEvalColumnPresent !== false
  const clientLocale = opts?.clientLocale ?? clientLocaleColumnsPresent !== false
  const outreach = opts?.outreach ?? outreachColumnsPresent !== false
  const outreachBody = opts?.outreachBody !== false
  const cols = [
    'id',
    'company_name',
    'website',
    ...(links ? (['links'] as const) : []),
    'contact_name',
    ...(outreach ? (['contact_role'] as const) : []),
    'email',
    ...(emails ? (['emails'] as const) : []),
    'phone',
    'offer',
    ...(outreach ? (['company_focus'] as const) : []),
    'notes',
    ...(outreach
      ? ([
          'initial_email_subject',
          ...(outreachBody ? (['initial_email_body'] as const) : []),
          'initial_email_drafted_at',
          'initial_email_sent_at',
        ] as const)
      : []),
    'temperature',
    'status',
    'next_follow_up',
    ...(contactPriority ? (['contact_priority'] as const) : []),
    ...(scheduledSend ? (['scheduled_send'] as const) : []),
    'estimated_value',
    ...(valueEmoji ? (['value_emoji'] as const) : []),
    ...(tags ? (['tags', 'last_client_reply_at'] as const) : []),
    ...(atlasEval ? (['atlas_eval'] as const) : []),
    ...(clientLocale
      ? ([
          'client_timezone',
          'client_city',
          'client_country',
          ...(outreach ? (['client_address'] as const) : []),
          'client_lat',
          'client_lon',
        ] as const)
      : []),
    'owner_id',
    'owner_email',
    'owner_avatar_url',
    'created_at',
    'updated_at',
  ]
  return cols.join(', ')
}

function currentLeadSelect(opts?: { outreachBody?: boolean }): string {
  return buildLeadSelect(opts)
}

function stripOptionalLeadFields<T extends Record<string, unknown>>(body: T): T {
  let next: Record<string, unknown> = { ...body }
  if (linksColumnPresent === false) next = stripLinksField(next)
  if (emailsColumnPresent === false) next = stripEmailsField(next)
  if (valueEmojiColumnPresent === false) next = stripValueEmojiField(next)
  if (tagsColumnsPresent === false) next = stripTagsFields(next)
  if (contactPriorityColumnPresent === false) next = stripContactPriorityField(next)
  if (scheduledSendColumnPresent === false) next = stripScheduledSendField(next)
  if (atlasEvalColumnPresent === false) next = stripAtlasEvalField(next)
  if (clientLocaleColumnsPresent === false) next = stripClientLocaleFields(next)
  if (outreachColumnsPresent === false) next = stripOutreachFields(next)
  return next as T
}

function markOptionalColumnMissing(message: string): boolean {
  if (isMissingLinksColumn(message)) {
    markLinksColumnMissing()
    console.warn(
      'crm_leads links column missing — run crm_lead_links_migration.sql',
      message,
    )
    return true
  }
  if (isMissingEmailsColumn(message)) {
    markEmailsColumnMissing()
    console.warn(
      'crm_leads emails column missing — run crm_lead_emails_migration.sql',
      message,
    )
    return true
  }
  if (isMissingValueEmojiColumn(message)) {
    markValueEmojiColumnMissing()
    console.warn(
      'crm_leads value_emoji column missing — run crm_lead_value_emoji_migration.sql',
      message,
    )
    return true
  }
  if (isMissingTagsColumn(message)) {
    markTagsColumnsMissing()
    console.warn(
      'crm_leads tags / last_client_reply_at missing — run crm_lead_tags_migration.sql',
      message,
    )
    return true
  }
  if (isMissingContactPriorityColumn(message)) {
    markContactPriorityColumnMissing()
    console.warn(
      'crm_leads contact_priority column missing — run crm_lead_contact_priority_migration.sql',
      message,
    )
    return true
  }
  if (isMissingScheduledSendColumn(message)) {
    markScheduledSendColumnMissing()
    console.warn(
      'crm_leads scheduled_send column missing — run crm_lead_scheduled_send_migration.sql',
      message,
    )
    return true
  }
  if (isMissingAtlasEvalColumn(message)) {
    markAtlasEvalColumnMissing()
    console.warn(
      'crm_leads atlas_eval column missing — run crm_lead_atlas_eval_migration.sql',
      message,
    )
    return true
  }
  if (isMissingClientLocaleColumn(message)) {
    markClientLocaleColumnsMissing()
    console.warn(
      'crm_leads client locale columns missing — run crm_lead_client_locale_migration.sql',
      message,
    )
    return true
  }
  if (isMissingOutreachColumn(message)) {
    markOutreachColumnsMissing()
    console.warn(
      'crm_leads outreach columns missing — run crm import migration or add initial_email_* columns',
      message,
    )
    return true
  }
  return false
}

function mergeStrippedOptionalFields(
  row: Lead,
  source: Partial<LeadInput> | LeadInput | null | undefined,
): Lead {
  if (!source) return normalizeLead(row)
  let result = normalizeLead(row)
  if (clientLocaleColumnsPresent === false) {
    result = mergeClientLocale(result, source)
  }
  if (linksColumnPresent === false) {
    result = mergeLeadLinks(result, source)
  }
  if (emailsColumnPresent === false) {
    result = mergeLeadEmails(result, source)
  }
  if (valueEmojiColumnPresent === false) {
    result = mergeValueEmoji(result, source)
  }
  if (tagsColumnsPresent === false) {
    result = mergeLeadTags(result, source)
  }
  if (contactPriorityColumnPresent === false) {
    result = mergeContactPriority(result, source)
  }
  if (scheduledSendColumnPresent === false) {
    result = mergeScheduledSend(result, source)
  }
  if (atlasEvalColumnPresent === false) {
    result = mergeAtlasEval(result, source)
  }
  if (outreachColumnsPresent === false) {
    result = mergeOutreachFields(result, source)
  }
  return result
}

export async function listLeads(filters: LeadFilters): Promise<Lead[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    // Shared team CRM: no owner_id filter — every authenticated user sees all leads.
    // Prefer explicit columns; fall back if optional migrations are pending.
    // PostgREST caps a single response at 1000 rows — page until exhausted.
    const applyListFilters = <Q extends { eq: (column: string, value: string) => Q }>(
      query: Q,
    ): Q => {
      let next = query
      if (
        filters.status !== 'all' &&
        filters.status !== 'not_contacted' &&
        filters.status !== 'client_replied' &&
        filters.status !== 'needs_review'
      ) {
        next = next.eq('status', filters.status)
      }
      if (filters.temperature !== 'all') {
        next = next.eq('temperature', filters.temperature)
      }
      return next
    }

    let data: Record<string, unknown>[] = []
    let error: { message: string } | null = null
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        data = await fetchAllPaged<Record<string, unknown>>(async (from, to) => {
          const result = await applyListFilters(
            supabase
              .from('crm_leads')
              .select(currentLeadSelect({ outreachBody: false }))
              .order('updated_at', { ascending: false })
              .order('id', { ascending: true }),
          ).range(from, to)
          return {
            data: (result.data ?? null) as Record<string, unknown>[] | null,
            error: result.error,
          }
        })
        error = null
        if (linksColumnPresent !== false) markLinksColumnPresent()
        if (emailsColumnPresent !== false) markEmailsColumnPresent()
        if (valueEmojiColumnPresent !== false) markValueEmojiColumnPresent()
        if (tagsColumnsPresent !== false) markTagsColumnsPresent()
        if (contactPriorityColumnPresent !== false) markContactPriorityColumnPresent()
        if (scheduledSendColumnPresent !== false) markScheduledSendColumnPresent()
        if (atlasEvalColumnPresent !== false) markAtlasEvalColumnPresent()
        if (clientLocaleColumnsPresent !== false) markClientLocaleColumnsPresent()
        if (outreachColumnsPresent !== false) markOutreachColumnsPresent()
        break
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err ?? '')
        if (markOptionalColumnMissing(message)) continue
        if (isMissingOwnerSnapshotColumn(message)) {
          try {
            data = await fetchAllPaged<Record<string, unknown>>(async (from, to) => {
              const result = await applyListFilters(
                supabase
                  .from('crm_leads')
                  .select('*')
                  .order('updated_at', { ascending: false })
                  .order('id', { ascending: true }),
              ).range(from, to)
              return {
                data: (result.data ?? null) as Record<string, unknown>[] | null,
                error: result.error,
              }
            })
            error = null
          } catch (fallbackErr) {
            error = {
              message:
                fallbackErr instanceof Error
                  ? fallbackErr.message
                  : String(fallbackErr ?? ''),
            }
          }
          break
        }
        error = { message }
        break
      }
    }
    if (error) throw new Error(error.message)
    const leads = data.map((row) => normalizeLead(row as unknown as Lead))
    const specialStatus =
      filters.status === 'not_contacted' ||
      filters.status === 'client_replied' ||
      filters.status === 'needs_review'
        ? filters.status
        : 'all'
    const effectiveSort: LeadSort =
      filters.status === 'client_replied' ? 'last_reply' : filters.sort
    return sortLeads(
      leads.filter((l) =>
        matchesFilters(l, {
          ...filters,
          status: specialStatus,
          temperature: 'all',
        }),
      ),
      effectiveSort,
    )
  }

  processDueScheduledSendsLocal()
  const leads = readLocal<Lead[]>(LEADS_KEY, []).map(normalizeLead)
  const effectiveSortLocal: LeadSort =
    filters.status === 'client_replied' ? 'last_reply' : filters.sort
  return sortLeads(leads.filter((l) => matchesFilters(l, filters)), effectiveSortLocal)
}

/**
 * Demo / local: when a schedule is due, simulate the cron send (no SMTP).
 */
function processDueScheduledSendsLocal(): void {
  const leads = readLocal<Lead[]>(LEADS_KEY, [])
  let changed = false
  const stamp = nowIso()
  const next = leads.map((raw) => {
    const lead = normalizeLead(raw)
    const schedule = normalizeScheduledSend(lead.scheduled_send)
    if (!schedule) return raw
    const isReply = schedule.kind === 'reply'
    if (!isReply && lead.initial_email_sent_at) return raw
    if (schedule.attempts >= 5) return raw
    if (!scheduledSendDue(schedule)) return raw
    const subject = isReply
      ? (schedule.subject || '').trim()
      : lead.initial_email_subject.trim()
    const body = isReply ? (schedule.body || '').trim() : lead.initial_email_body.trim()
    if (!subject || !body || !schedule.to) {
      changed = true
      return {
        ...lead,
        scheduled_send: {
          ...schedule,
          error: 'Missing subject, body, or recipient for scheduled send',
          attempts: schedule.attempts + 1,
        },
        updated_at: stamp,
      }
    }
    changed = true
    const fromEmail =
      OUTREACH_FROM_IDENTITIES.find((i) => i.id === schedule.from)?.email ??
      'contact@iobjectm.com'
    const activities = readLocal<Activity[]>(ACTIVITIES_KEY, [])
    writeLocal(ACTIVITIES_KEY, [
      ...activities,
      {
        id: uid(),
        lead_id: lead.id,
        type: 'email' as const,
        subject: subject.slice(0, 200) || (isReply ? 'Scheduled reply sent' : 'Initial outreach email sent'),
        body: isReply
          ? `Scheduled reply sent (demo) to ${schedule.to}.`
          : `Scheduled outreach sent (demo) to ${schedule.to}.`,
        occurred_at: stamp,
        created_at: stamp,
        owner_id: lead.owner_id,
      },
    ])
    const messages = readLocal<LeadMessage[]>(MESSAGES_KEY, [])
    writeLocal(MESSAGES_KEY, [
      ...messages,
      {
        id: uid(),
        lead_id: lead.id,
        direction: 'outbound' as const,
        from_email: fromEmail,
        to_email: schedule.to,
        subject,
        body_text: body,
        body_html: renderOutreachEmailHtml({ subject, body }),
        message_id: `<demo-scheduled-${uid()}@iom-showcase.example>`,
        in_reply_to: isReply ? schedule.inReplyTo || null : null,
        references_header: isReply ? schedule.references || null : null,
        occurred_at: stamp,
        created_at: stamp,
        owner_id: lead.owner_id,
        raw_headers: { scheduled: true, kind: isReply ? 'reply' : 'initial' },
      },
    ])
    return {
      ...lead,
      initial_email_sent_at: lead.initial_email_sent_at || stamp,
      initial_email_drafted_at: lead.initial_email_drafted_at || stamp,
      contact_priority: isReply && lead.initial_email_sent_at ? lead.contact_priority : false,
      scheduled_send: null,
      status: lead.status === 'new' ? 'contacted' : lead.status,
      tags: withoutNeedsReview(lead.tags),
      updated_at: stamp,
    }
  })
  if (changed) writeLocal(LEADS_KEY, next)
}

export async function getLead(id: string): Promise<Lead | null> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_leads')
      .select(currentLeadSelect({ outreachBody: true }))
      .eq('id', id)
      .maybeSingle()
    if (error) {
      const fallback = await supabase.from('crm_leads').select('*').eq('id', id).maybeSingle()
      if (fallback.error) throw new Error(error.message)
      return fallback.data ? normalizeLead(fallback.data as unknown as Lead) : null
    }
    return data ? normalizeLead(data as unknown as Lead) : null
  }
  const found = readLocal<Lead[]>(LEADS_KEY, []).find((l) => l.id === id)
  return found ? normalizeLead(found) : null
}

export async function createLead(input: LeadInput): Promise<Lead> {
  const user = await getCurrentUser()
  const stamp = nowIso()
  const snapshot = ownerSnapshotFromUser(user)
  await upsertOwnStaffProfile().catch(() => {})
  const normalizedInput: LeadInput = {
    ...input,
    links: normalizeLeadLinks(input.links),
    emails: normalizeLeadEmails(input.emails),
    value_emoji: normalizeValueEmoji(input.value_emoji),
    tags: normalizeLeadTags(input.tags),
    last_client_reply_at: input.last_client_reply_at ?? null,
    contact_priority: !!input.contact_priority,
    scheduled_send: normalizeScheduledSend(input.scheduled_send),
    atlas_eval: normalizeAtlasEval(input.atlas_eval),
  }

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    let withSnapshot = stripOptionalLeadFields({
      ...normalizedInput,
      ...snapshot,
    } as Record<string, unknown>)
    let data: unknown = null
    let error: { message: string } | null = null

    for (let attempt = 0; attempt < 8; attempt++) {
      withSnapshot = stripOptionalLeadFields(withSnapshot)
      const result = await supabase
        .from('crm_leads')
        .insert(withSnapshot)
        .select(currentLeadSelect())
        .single()
      data = result.data
      error = result.error
      if (!error) break
      if (markOptionalColumnMissing(error.message)) continue
      if (isMissingOwnerSnapshotColumn(error.message)) {
        console.warn(
          'crm_leads owner_email/owner_avatar_url missing — run crm_owner_snapshot_migration.sql',
          error.message,
        )
        let insertBody = stripOptionalLeadFields({
          ...normalizedInput,
          owner_id: snapshot.owner_id,
        } as Record<string, unknown>)
        for (let ownerAttempt = 0; ownerAttempt < 6; ownerAttempt++) {
          insertBody = stripOptionalLeadFields(insertBody)
          const fallback = await supabase
            .from('crm_leads')
            .insert(insertBody)
            .select('*')
            .single()
          if (!fallback.error) {
            const created = mergeStrippedOptionalFields(
              fallback.data as Lead,
              normalizedInput,
            )
            const { data: healed } = await supabase
              .from('crm_leads')
              .update({
                owner_email: snapshot.owner_email,
                owner_avatar_url: snapshot.owner_avatar_url,
              })
              .eq('id', created.id)
              .select(currentLeadSelect())
              .maybeSingle()
            if (!healed) return created
            return mergeStrippedOptionalFields(
              healed as unknown as Lead,
              normalizedInput,
            )
          }
          if (markOptionalColumnMissing(fallback.error.message)) continue
          throw new Error(fallback.error.message)
        }
        throw new Error(error.message)
      }
      break
    }
    if (error) throw new Error(error.message)
    if (linksColumnPresent !== false) markLinksColumnPresent()
    if (emailsColumnPresent !== false) markEmailsColumnPresent()
    if (valueEmojiColumnPresent !== false) markValueEmojiColumnPresent()
    if (tagsColumnsPresent !== false) markTagsColumnsPresent()
    if (contactPriorityColumnPresent !== false) markContactPriorityColumnPresent()
    if (scheduledSendColumnPresent !== false) markScheduledSendColumnPresent()
    if (atlasEvalColumnPresent !== false) markAtlasEvalColumnPresent()
    if (clientLocaleColumnsPresent !== false) markClientLocaleColumnsPresent()
    if (outreachColumnsPresent !== false) markOutreachColumnsPresent()
    return mergeStrippedOptionalFields(data as unknown as Lead, normalizedInput)
  }

  const lead: Lead = {
    ...normalizedInput,
    id: uid(),
    ...snapshot,
    created_at: stamp,
    updated_at: stamp,
  }
  const leads = readLocal<Lead[]>(LEADS_KEY, [])
  writeLocal(LEADS_KEY, [lead, ...leads])
  return normalizeLead(lead)
}

export async function updateLead(id: string, input: Partial<LeadInput>): Promise<Lead> {
  const patch: Partial<LeadInput> = { ...input }
  if (input.links !== undefined) {
    patch.links = normalizeLeadLinks(input.links)
  }
  if (input.emails !== undefined) {
    patch.emails = normalizeLeadEmails(input.emails)
  }
  if (input.value_emoji !== undefined) {
    patch.value_emoji = normalizeValueEmoji(input.value_emoji)
  }
  if (input.tags !== undefined) {
    patch.tags = normalizeLeadTags(input.tags)
  }
  if (input.last_client_reply_at !== undefined) {
    patch.last_client_reply_at = input.last_client_reply_at
  }
  if (input.contact_priority !== undefined) {
    patch.contact_priority = !!input.contact_priority
  }
  if (input.scheduled_send !== undefined) {
    patch.scheduled_send = normalizeScheduledSend(input.scheduled_send)
  }
  if (input.atlas_eval !== undefined) {
    patch.atlas_eval = normalizeAtlasEval(input.atlas_eval)
  }

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    let body = stripOptionalLeadFields({ ...patch } as Record<string, unknown>)
    let data: unknown = null
    let error: { message: string } | null = null

    for (let attempt = 0; attempt < 8; attempt++) {
      body = stripOptionalLeadFields(body)
      const result = await supabase
        .from('crm_leads')
        .update(body)
        .eq('id', id)
        .select(currentLeadSelect())
        .single()
      data = result.data
      error = result.error
      if (!error) break
      if (markOptionalColumnMissing(error.message)) continue
      break
    }
    if (error) throw new Error(error.message)
    if (linksColumnPresent !== false) markLinksColumnPresent()
    if (emailsColumnPresent !== false) markEmailsColumnPresent()
    if (valueEmojiColumnPresent !== false) markValueEmojiColumnPresent()
    if (tagsColumnsPresent !== false) markTagsColumnsPresent()
    if (contactPriorityColumnPresent !== false) markContactPriorityColumnPresent()
    if (scheduledSendColumnPresent !== false) markScheduledSendColumnPresent()
    if (atlasEvalColumnPresent !== false) markAtlasEvalColumnPresent()
    if (clientLocaleColumnsPresent !== false) markClientLocaleColumnsPresent()
    if (outreachColumnsPresent !== false) markOutreachColumnsPresent()
    return mergeStrippedOptionalFields(data as unknown as Lead, patch)
  }

  const leads = readLocal<Lead[]>(LEADS_KEY, [])
  const idx = leads.findIndex((l) => l.id === id)
  if (idx < 0) throw new Error('Lead not found.')
  const updated: Lead = {
    ...leads[idx],
    ...patch,
    updated_at: nowIso(),
  }
  leads[idx] = updated
  writeLocal(LEADS_KEY, leads)
  return normalizeLead(updated)
}

export async function deleteLead(id: string): Promise<void> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.from('crm_leads').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return
  }

  writeLocal(
    LEADS_KEY,
    readLocal<Lead[]>(LEADS_KEY, []).filter((l) => l.id !== id),
  )
  writeLocal(
    ACTIVITIES_KEY,
    readLocal<Activity[]>(ACTIVITIES_KEY, []).filter((a) => a.lead_id !== id),
  )
  writeLocal(
    MESSAGES_KEY,
    readLocal<LeadMessage[]>(MESSAGES_KEY, []).filter((m) => m.lead_id !== id),
  )
}

/* ── Lead email messages (conversation mirror) ────────── */

function normalizeLeadMessage(row: Record<string, unknown>): LeadMessage {
  const raw = row.raw_headers
  return {
    id: String(row.id ?? ''),
    lead_id: String(row.lead_id ?? ''),
    direction: row.direction === 'inbound' ? 'inbound' : 'outbound',
    from_email: String(row.from_email ?? ''),
    to_email: String(row.to_email ?? ''),
    subject: String(row.subject ?? ''),
    body_text: String(row.body_text ?? ''),
    body_html:
      row.body_html == null || row.body_html === ''
        ? null
        : String(row.body_html),
    message_id:
      row.message_id == null || row.message_id === ''
        ? null
        : String(row.message_id),
    in_reply_to:
      row.in_reply_to == null || row.in_reply_to === ''
        ? null
        : String(row.in_reply_to),
    references_header:
      row.references_header == null || row.references_header === ''
        ? null
        : String(row.references_header),
    occurred_at: String(row.occurred_at ?? nowIso()),
    created_at: String(row.created_at ?? nowIso()),
    owner_id: row.owner_id == null ? null : String(row.owner_id),
    raw_headers:
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {},
  }
}

export function isLeadMessagesSchemaMissing(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err ?? '')
  return (
    m.includes('crm_lead_messages') ||
    m.includes('schema cache') ||
    (m.includes('relation') && m.includes('does not exist'))
  )
}

/** Thread rows without body_html — HTML is rebuilt from text for preview. */
const LEAD_MESSAGE_LIST_SELECT =
  'id, lead_id, direction, from_email, to_email, subject, body_text, message_id, in_reply_to, references_header, occurred_at, created_at, owner_id, raw_headers'

export async function listLeadMessageHeads(
  leadId: string,
): Promise<{ id: string; occurred_at: string }[]> {
  if (!useLiveCrmBackend()) {
    return readLocal<LeadMessage[]>(MESSAGES_KEY, [])
      .filter((m) => m.lead_id === leadId)
      .map((m) => ({ id: m.id, occurred_at: m.occurred_at }))
  }
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from('crm_lead_messages')
    .select('id, occurred_at')
    .eq('lead_id', leadId)
    .order('occurred_at', { ascending: true })
    .limit(2000)
  if (error) {
    if (isLeadMessagesSchemaMissing(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    occurred_at: String((row as { occurred_at: string }).occurred_at ?? ''),
  }))
}

export async function listLeadMessages(leadId: string): Promise<LeadMessage[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_lead_messages')
      .select(LEAD_MESSAGE_LIST_SELECT)
      .eq('lead_id', leadId)
      .order('occurred_at', { ascending: true })
    if (error) {
      if (isLeadMessagesSchemaMissing(error)) return []
      throw new Error(error.message)
    }
    return (data ?? []).map((row) =>
      normalizeLeadMessage(row as Record<string, unknown>),
    )
  }

  return readLocal<LeadMessage[]>(MESSAGES_KEY, [])
    .filter((m) => m.lead_id === leadId)
    .sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    )
}

/** All conversation rows (paginated). Used by bulk lead export. */
export async function listAllLeadMessages(): Promise<LeadMessage[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    try {
      const rows = await fetchAllPaged<Record<string, unknown>>(async (from, to) => {
        const { data, error } = await supabase
          .from('crm_lead_messages')
          .select(LEAD_MESSAGE_LIST_SELECT)
          .order('occurred_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
        return { data: (data ?? null) as Record<string, unknown>[] | null, error }
      })
      return rows.map(normalizeLeadMessage)
    } catch (err) {
      if (isLeadMessagesSchemaMissing(err)) return []
      throw err
    }
  }

  return readLocal<LeadMessage[]>(MESSAGES_KEY, []).sort(
    (a, b) =>
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  )
}

export async function createLeadMessage(
  input: LeadMessageCreate,
): Promise<LeadMessage> {
  const user = await getCurrentUser()
  const stamp = nowIso()
  const payload = {
    lead_id: input.lead_id,
    direction: input.direction,
    from_email: input.from_email.trim().toLowerCase(),
    to_email: input.to_email.trim().toLowerCase(),
    subject: input.subject.trim(),
    body_text: input.body_text,
    body_html: input.body_html ?? null,
    message_id: input.message_id?.trim() || null,
    in_reply_to: input.in_reply_to?.trim() || null,
    references_header: input.references_header?.trim() || null,
    occurred_at: input.occurred_at || stamp,
    raw_headers: input.raw_headers ?? {},
    owner_id: user?.id ?? null,
  }

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_lead_messages')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    await supabase
      .from('crm_leads')
      .update({
        updated_at: stamp,
        ...(input.direction === 'inbound' &&
        !isAutoReplyLeadMessage({
          from_email: payload.from_email,
          subject: payload.subject,
          body_text: payload.body_text,
        })
          ? { last_client_reply_at: payload.occurred_at }
          : {}),
      })
      .eq('id', input.lead_id)
    return normalizeLeadMessage(data as Record<string, unknown>)
  }

  const message: LeadMessage = {
    ...payload,
    id: uid(),
    created_at: stamp,
    owner_id: user?.id ?? null,
    raw_headers: payload.raw_headers,
  }
  const messages = readLocal<LeadMessage[]>(MESSAGES_KEY, [])
  writeLocal(MESSAGES_KEY, [...messages, message])

  const leads = readLocal<Lead[]>(LEADS_KEY, [])
  const idx = leads.findIndex((l) => l.id === input.lead_id)
  if (idx >= 0) {
    const prev = leads[idx]!
    const countAsReply =
      input.direction === 'inbound' &&
      !isAutoReplyLeadMessage({
        from_email: payload.from_email,
        subject: payload.subject,
        body_text: payload.body_text,
      })
    leads[idx] = {
      ...prev,
      updated_at: stamp,
      ...(countAsReply ? { last_client_reply_at: payload.occurred_at } : {}),
    }
    writeLocal(LEADS_KEY, leads)
  }
  return message
}

/** Latest real (non–auto-reply) inbound message timestamp, or null if none. */
export function latestInboundOccurredAt(
  messages: LeadMessage[],
): string | null {
  let latest: string | null = null
  let latestMs = -1
  for (const m of messages) {
    if (m.direction !== 'inbound') continue
    if (isAutoReplyLeadMessage(m)) continue
    const ms = new Date(m.occurred_at).getTime()
    if (!Number.isFinite(ms) || ms <= latestMs) continue
    latestMs = ms
    latest = m.occurred_at
  }
  return latest
}

/**
 * Keep last_client_reply_at aligned with real (non–auto-reply) inbound mail.
 * Clears the stamp when the thread only has ticket/OOO/canned inbound.
 */
export async function syncLeadClientReplyAt(
  lead: Lead,
  messages?: LeadMessage[],
): Promise<Lead | null> {
  if (tagsSchemaKnownMissing()) return null
  const rows = messages ?? (await listLeadMessages(lead.id))
  const latest = latestInboundOccurredAt(rows)
  const current = lead.last_client_reply_at ?? null
  const same =
    (current == null && latest == null) ||
    (current != null &&
      latest != null &&
      new Date(current).getTime() === new Date(latest).getTime())
  if (same) return null
  try {
    return await updateLead(lead.id, { last_client_reply_at: latest })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (isMissingTagsColumn(msg)) return null
    throw err
  }
}

/**
 * Repair last_client_reply_at from the thread, ignoring ticket receipts / OOO /
 * job canned replies so “Client replied” stays meaningful.
 */
export async function backfillMissingClientReplyAts(
  leads: Lead[],
): Promise<Lead[]> {
  if (tagsSchemaKnownMissing() || leads.length === 0) return []

  const latestByLead = new Map<string, string | null>()
  for (const l of leads) latestByLead.set(l.id, null)

  type Row = {
    lead_id: string
    occurred_at: string
    from_email: string
    subject: string
    body_text: string
  }

  const consider = (row: Row) => {
    if (
      isAutoReplyLeadMessage({
        from_email: row.from_email,
        subject: row.subject,
        body_text: row.body_text,
      })
    ) {
      return
    }
    const prev = latestByLead.get(row.lead_id)
    if (
      !prev ||
      new Date(row.occurred_at).getTime() > new Date(prev).getTime()
    ) {
      latestByLead.set(row.lead_id, row.occurred_at)
    }
  }

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const ids = leads.map((l) => l.id)
    const chunkSize = 60
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const { data, error } = await supabase
        .from('crm_lead_messages')
        .select('lead_id, occurred_at, from_email, subject')
        .eq('direction', 'inbound')
        .in('lead_id', chunk)
      if (error) {
        if (isLeadMessagesSchemaMissing(error)) return []
        throw new Error(error.message)
      }
      for (const raw of data ?? []) {
        const row = raw as Record<string, unknown>
        consider({
          lead_id: String(row.lead_id ?? ''),
          occurred_at: String(row.occurred_at ?? ''),
          from_email: String(row.from_email ?? ''),
          subject: String(row.subject ?? ''),
          body_text: '',
        })
      }
    }
  } else {
    const all = readLocal<LeadMessage[]>(MESSAGES_KEY, [])
    const idSet = new Set(leads.map((l) => l.id))
    for (const m of all) {
      if (m.direction !== 'inbound' || !idSet.has(m.lead_id)) continue
      consider({
        lead_id: m.lead_id,
        occurred_at: m.occurred_at,
        from_email: m.from_email,
        subject: m.subject,
        body_text: m.body_text,
      })
    }
  }

  const healed: Lead[] = []
  for (const lead of leads) {
    const next = latestByLead.get(lead.id) ?? null
    const cur = lead.last_client_reply_at ?? null
    const same =
      (cur == null && next == null) ||
      (cur != null &&
        next != null &&
        new Date(cur).getTime() === new Date(next).getTime())
    if (same) continue
    try {
      healed.push(await updateLead(lead.id, { last_client_reply_at: next }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (isMissingTagsColumn(msg)) break
      console.warn('[crm] reconcile last_client_reply_at failed', lead.id, err)
    }
  }
  return healed
}

/* ── Unmatched inbound queue ──────────────────────────── */

function normalizeInboundUnmatched(row: Record<string, unknown>): InboundUnmatched {
  const raw = row.raw_headers
  const candidates = Array.isArray(row.candidate_lead_ids)
    ? row.candidate_lead_ids.map((id) => String(id)).filter(Boolean)
    : []
  return {
    id: String(row.id ?? ''),
    from_email: String(row.from_email ?? ''),
    to_email: String(row.to_email ?? ''),
    subject: String(row.subject ?? ''),
    body_text: String(row.body_text ?? ''),
    body_html:
      row.body_html == null || row.body_html === ''
        ? null
        : String(row.body_html),
    message_id:
      row.message_id == null || row.message_id === ''
        ? null
        : String(row.message_id),
    in_reply_to:
      row.in_reply_to == null || row.in_reply_to === ''
        ? null
        : String(row.in_reply_to),
    references_header:
      row.references_header == null || row.references_header === ''
        ? null
        : String(row.references_header),
    occurred_at: String(row.occurred_at ?? nowIso()),
    failure_code: String(row.failure_code ?? 'lead_not_found'),
    resend_email_id:
      row.resend_email_id == null || row.resend_email_id === ''
        ? null
        : String(row.resend_email_id),
    svix_id:
      row.svix_id == null || row.svix_id === '' ? null : String(row.svix_id),
    candidate_lead_ids: candidates,
    raw_headers:
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {},
    created_at: String(row.created_at ?? nowIso()),
    resolved_at:
      row.resolved_at == null || row.resolved_at === ''
        ? null
        : String(row.resolved_at),
    resolved_lead_id:
      row.resolved_lead_id == null || row.resolved_lead_id === ''
        ? null
        : String(row.resolved_lead_id),
  }
}

export function isInboundUnmatchedSchemaMissing(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err ?? '')
  return (
    m.includes('crm_inbound_unmatched') ||
    m.includes('schema cache') ||
    (m.includes('relation') && m.includes('does not exist'))
  )
}

export async function listInboundUnmatched(limit = 50): Promise<InboundUnmatched[]> {
  if (!useLiveCrmBackend()) return []
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from('crm_inbound_unmatched')
    .select(
      'id, from_email, to_email, subject, body_text, message_id, in_reply_to, references_header, occurred_at, created_at, failure_code, candidate_lead_ids, raw_headers, resolved_at, resolved_lead_id',
    )
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)))
  if (error) {
    if (isInboundUnmatchedSchemaMissing(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) =>
    normalizeInboundUnmatched(row as Record<string, unknown>),
  )
}

/** Attach an unmatched inbound message to a lead and mark the queue row resolved. */
export async function attachInboundUnmatched(
  unmatchedId: string,
  leadId: string,
): Promise<{ message: LeadMessage }> {
  if (!useLiveCrmBackend()) {
    throw new Error('Live CRM backend is required to attach unmatched mail.')
  }
  const supabase = getSupabase()!
  const { data: row, error: loadErr } = await supabase
    .from('crm_inbound_unmatched')
    .select('*')
    .eq('id', unmatchedId)
    .is('resolved_at', null)
    .maybeSingle()
  if (loadErr) throw new Error(loadErr.message)
  if (!row) throw new Error('Unmatched message not found or already resolved.')

  const item = normalizeInboundUnmatched(row as Record<string, unknown>)
  const message = await createLeadMessage({
    lead_id: leadId,
    direction: 'inbound',
    from_email: item.from_email,
    to_email: item.to_email,
    subject: item.subject,
    body_text: item.body_text,
    body_html: item.body_html,
    message_id: item.message_id,
    in_reply_to: item.in_reply_to,
    references_header: item.references_header,
    occurred_at: item.occurred_at,
    raw_headers: {
      ...item.raw_headers,
      attachedFromUnmatched: unmatchedId,
    },
  })

  await createActivity({
    lead_id: leadId,
    type: 'email',
    subject: item.subject.slice(0, 200) || 'Client reply',
    body: `Client reply attached from unmatched queue (${item.from_email}).`,
    occurred_at: item.occurred_at,
  })

  const stamp = nowIso()
  const { error: resolveErr } = await supabase
    .from('crm_inbound_unmatched')
    .update({
      resolved_at: stamp,
      resolved_lead_id: leadId,
    })
    .eq('id', unmatchedId)
  if (resolveErr) throw new Error(resolveErr.message)

  return { message }
}

export async function dismissInboundUnmatched(unmatchedId: string): Promise<void> {
  if (!useLiveCrmBackend()) return
  const supabase = getSupabase()!
  const { error } = await supabase
    .from('crm_inbound_unmatched')
    .update({ resolved_at: nowIso() })
    .eq('id', unmatchedId)
    .is('resolved_at', null)
  if (error) throw new Error(error.message)
}

/* ── Activities ───────────────────────────────────────── */

export async function listActivities(leadId: string): Promise<Activity[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('occurred_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as Activity[]
  }

  return readLocal<Activity[]>(ACTIVITIES_KEY, [])
    .filter((a) => a.lead_id === leadId)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
}

/** All activity rows (paginated). Used by bulk lead export. */
export async function listAllActivities(): Promise<Activity[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    return fetchAllPaged<Activity>(async (from, to) => {
      const { data, error } = await supabase
        .from('crm_activities')
        .select('*')
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to)
      return { data: (data ?? null) as Activity[] | null, error }
    })
  }

  return readLocal<Activity[]>(ACTIVITIES_KEY, []).sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  )
}

export async function createActivity(input: ActivityInput): Promise<Activity> {
  const user = await getCurrentUser()
  const stamp = nowIso()

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_activities')
      .insert({
        ...input,
        owner_id: user?.id ?? null,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    await supabase
      .from('crm_leads')
      .update({ updated_at: stamp })
      .eq('id', input.lead_id)
    return data as Activity
  }

  const activity: Activity = {
    ...input,
    id: uid(),
    owner_id: user?.id ?? null,
    created_at: stamp,
  }
  const activities = readLocal<Activity[]>(ACTIVITIES_KEY, [])
  writeLocal(ACTIVITIES_KEY, [activity, ...activities])

  const leads = readLocal<Lead[]>(LEADS_KEY, [])
  const idx = leads.findIndex((l) => l.id === input.lead_id)
  if (idx >= 0) {
    leads[idx] = { ...leads[idx], updated_at: stamp }
    writeLocal(LEADS_KEY, leads)
  }
  return activity
}

export async function deleteActivity(id: string): Promise<void> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.from('crm_activities').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return
  }
  writeLocal(
    ACTIVITIES_KEY,
    readLocal<Activity[]>(ACTIVITIES_KEY, []).filter((a) => a.id !== id),
  )
}

export async function updateActivity(id: string, patch: ActivityUpdate): Promise<Activity> {
  const body = {
    type: patch.type,
    subject: patch.subject.trim(),
    body: patch.body.trim(),
    occurred_at: patch.occurred_at,
  }

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('crm_activities')
      .update(body)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    const activity = data as Activity
    await supabase
      .from('crm_leads')
      .update({ updated_at: nowIso() })
      .eq('id', activity.lead_id)
    return activity
  }

  const activities = readLocal<Activity[]>(ACTIVITIES_KEY, [])
  const idx = activities.findIndex((a) => a.id === id)
  if (idx < 0) throw new Error('Activity not found.')
  const updated: Activity = { ...activities[idx], ...body }
  activities[idx] = updated
  writeLocal(ACTIVITIES_KEY, activities)

  const leads = readLocal<Lead[]>(LEADS_KEY, [])
  const leadIdx = leads.findIndex((l) => l.id === updated.lead_id)
  if (leadIdx >= 0) {
    leads[leadIdx] = { ...leads[leadIdx], updated_at: nowIso() }
    writeLocal(LEADS_KEY, leads)
  }
  return updated
}
