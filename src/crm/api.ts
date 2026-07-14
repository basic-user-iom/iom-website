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
  CrmUser,
  Lead,
  LeadEmail,
  LeadFilters,
  LeadInput,
  LeadLink,
  LeadSort,
  LeadStatus,
  StaffProfile,
} from './types'
import { ownerDisplayName } from './types'
import { normalizeValueEmoji } from './valueEmoji'

const LEADS_KEY = 'iom-crm-leads'
const ACTIVITIES_KEY = 'iom-crm-activities'
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
  if (filters.status !== 'all' && lead.status !== filters.status) return false
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
    lead.owner_email,
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
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
    atlas_eval: normalizeAtlasEval(row.atlas_eval ?? EMPTY_ATLAS_EVAL),
    client_timezone: row.client_timezone ?? '',
    client_city: row.client_city ?? '',
    client_country: row.client_country ?? '',
    client_lat: row.client_lat ?? null,
    client_lon: row.client_lon ?? null,
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

export async function signIn(email: string, password: string): Promise<void> {
  if (isCrmDemoMode()) return

  const trimmed = email.trim()
  if (!trimmed || !password) throw new Error('Email and password are required.')

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    })
    if (error) throw new Error(error.message)
    await healOversizedAuthAvatar().catch(() => {})
    return
  }

  const expected =
    import.meta.env.VITE_CRM_LOCAL_PASSWORD?.trim() || 'iom-local'
  if (password !== expected) {
    throw new Error(
      'Invalid local password. Set VITE_CRM_LOCAL_PASSWORD or use the default from .env.example.',
    )
  }
  const existing = readLocal<LocalSession | null>(LOCAL_SESSION_KEY, null)
  writeLocal(LOCAL_SESSION_KEY, {
    id: existing?.id ?? 'local-user',
    email: trimmed,
    avatar_url: existing?.email === trimmed ? (existing.avatar_url ?? null) : null,
  })
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
export async function probeOwnerAttributionSchema(): Promise<OwnerAttributionSchema> {
  if (!useLiveCrmBackend()) {
    return { ownerSnapshotColumns: true, staffProfiles: true }
  }
  const supabase = getSupabase()!
  const [leadsProbe, staffProbe] = await Promise.all([
    supabase.from('crm_leads').select('owner_email').limit(1),
    supabase.from('crm_staff_profiles').select('id').limit(1),
  ])
  return {
    ownerSnapshotColumns: !(
      leadsProbe.error && isMissingOwnerSnapshotColumn(leadsProbe.error.message)
    ),
    staffProfiles: !(
      staffProbe.error && isMissingStaffProfilesTable(staffProbe.error.message)
    ),
  }
}

/** Cached probe: null = unknown, true = columns exist, false = migration needed. */
let clientLocaleColumnsPresent: boolean | null = null
/** Cached probe for crm_leads.links jsonb column. */
let linksColumnPresent: boolean | null = null
/** Cached probe for crm_leads.value_emoji text column. */
let valueEmojiColumnPresent: boolean | null = null
/** Cached probe for crm_leads.emails jsonb column. */
let emailsColumnPresent: boolean | null = null
/** Cached probe for crm_leads.atlas_eval jsonb column. */
let atlasEvalColumnPresent: boolean | null = null

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

/** True when a prior probe/update learned emails column is absent. */
export function emailsSchemaKnownMissing(): boolean {
  return emailsColumnPresent === false
}

/** True when a prior probe/update learned atlas_eval column is absent. */
export function atlasEvalSchemaKnownMissing(): boolean {
  return atlasEvalColumnPresent === false
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
  const { error } = await supabase.from('crm_staff_profiles').upsert(
    {
      id: user.id,
      email: user.email,
      display_name,
      avatar_url: safeAvatar,
      updated_at: nowIso(),
    },
    { onConflict: 'id' },
  )
  if (error && isMissingStaffProfilesTable(error.message)) return
  if (error) {
    console.warn('Could not upsert staff profile:', error.message)
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
  atlasEval?: boolean
  clientLocale?: boolean
}): string {
  const links = opts?.links ?? linksColumnPresent !== false
  const emails = opts?.emails ?? emailsColumnPresent !== false
  const valueEmoji = opts?.valueEmoji ?? valueEmojiColumnPresent !== false
  const atlasEval = opts?.atlasEval ?? atlasEvalColumnPresent !== false
  const clientLocale = opts?.clientLocale ?? clientLocaleColumnsPresent !== false
  const cols = [
    'id',
    'company_name',
    'website',
    ...(links ? (['links'] as const) : []),
    'contact_name',
    'email',
    ...(emails ? (['emails'] as const) : []),
    'phone',
    'offer',
    'notes',
    'temperature',
    'status',
    'next_follow_up',
    'estimated_value',
    ...(valueEmoji ? (['value_emoji'] as const) : []),
    ...(atlasEval ? (['atlas_eval'] as const) : []),
    ...(clientLocale
      ? ([
          'client_timezone',
          'client_city',
          'client_country',
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

function currentLeadSelect(): string {
  return buildLeadSelect()
}

function stripOptionalLeadFields<T extends Record<string, unknown>>(body: T): T {
  let next: Record<string, unknown> = { ...body }
  if (linksColumnPresent === false) next = stripLinksField(next)
  if (emailsColumnPresent === false) next = stripEmailsField(next)
  if (valueEmojiColumnPresent === false) next = stripValueEmojiField(next)
  if (atlasEvalColumnPresent === false) next = stripAtlasEvalField(next)
  if (clientLocaleColumnsPresent === false) next = stripClientLocaleFields(next)
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
  if (atlasEvalColumnPresent === false) {
    result = mergeAtlasEval(result, source)
  }
  return result
}

export async function listLeads(filters: LeadFilters): Promise<Lead[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    // Shared team CRM: no owner_id filter — every authenticated user sees all leads.
    // Prefer explicit columns; fall back if optional migrations are pending.
    let data: unknown = null
    let error: { message: string } | null = null
    for (let attempt = 0; attempt < 8; attempt++) {
      let query = supabase
        .from('crm_leads')
        .select(currentLeadSelect())
        .order('updated_at', { ascending: false })
      if (filters.status !== 'all') query = query.eq('status', filters.status)
      if (filters.temperature !== 'all') query = query.eq('temperature', filters.temperature)
      const result = await query
      data = result.data
      error = result.error
      if (!error) {
        if (linksColumnPresent !== false) markLinksColumnPresent()
        if (emailsColumnPresent !== false) markEmailsColumnPresent()
        if (valueEmojiColumnPresent !== false) markValueEmojiColumnPresent()
        if (atlasEvalColumnPresent !== false) markAtlasEvalColumnPresent()
        if (clientLocaleColumnsPresent !== false) markClientLocaleColumnsPresent()
        break
      }
      if (markOptionalColumnMissing(error.message)) continue
      if (isMissingOwnerSnapshotColumn(error.message)) {
        const fallback = await supabase
          .from('crm_leads')
          .select('*')
          .order('updated_at', { ascending: false })
        data = fallback.data
        error = fallback.error
        break
      }
      break
    }
    if (error) throw new Error(error.message)
    const leads = ((data ?? []) as unknown as Lead[]).map(normalizeLead)
    return sortLeads(
      leads.filter((l) =>
        matchesFilters(l, { ...filters, status: 'all', temperature: 'all' }),
      ),
      filters.sort,
    )
  }

  const leads = readLocal<Lead[]>(LEADS_KEY, []).map(normalizeLead)
  return sortLeads(leads.filter((l) => matchesFilters(l, filters)), filters.sort)
}

export async function getLead(id: string): Promise<Lead | null> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase.from('crm_leads').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return data ? normalizeLead(data as Lead) : null
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
    if (atlasEvalColumnPresent !== false) markAtlasEvalColumnPresent()
    if (clientLocaleColumnsPresent !== false) markClientLocaleColumnsPresent()
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
    if (atlasEvalColumnPresent !== false) markAtlasEvalColumnPresent()
    if (clientLocaleColumnsPresent !== false) markClientLocaleColumnsPresent()
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
