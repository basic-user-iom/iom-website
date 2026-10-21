/**
 * Contact-form hydration.
 * A slim catalog row omits edit fields. Missing keys are not loaded
 * values: they must not become '' and must not be saved. Null from a full
 * row is a loaded empty value. An open draft is kept when a later load arrives.
 */

import type { LeadInput } from './types'

export type DetailLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

const TEXT_KEYS = ['offer', 'notes'] as const
type TextKey = (typeof TEXT_KEYS)[number]

// Exhaustive against LeadInput: adding a payload field requires updating the gate.
const EDIT_FIELDS: Record<keyof LeadInput, true> = {
  company_name: true, website: true, links: true, contact_name: true,
  contact_role: true, email: true, emails: true, phone: true, offer: true,
  company_focus: true, notes: true, initial_email_subject: true,
  initial_email_body: true, initial_email_drafted_at: true, initial_email_sent_at: true,
  temperature: true, status: true, next_follow_up: true, contact_priority: true,
  scheduled_send: true, estimated_value: true, value_emoji: true, tags: true,
  last_client_reply_at: true, atlas_eval: true, client_timezone: true,
  client_city: true, client_country: true, client_address: true,
  client_lat: true, client_lon: true,
}
export const LEAD_EDIT_FIELDS = Object.keys(EDIT_FIELDS) as (keyof LeadInput)[]

export function loadedLeadText(
  record: object | null | undefined,
  key: TextKey,
): string | undefined {
  if (!record || typeof record !== 'object') return undefined
  if (!Object.prototype.hasOwnProperty.call(record, key)) return undefined
  const value = (record as Record<string, unknown>)[key]
  if (typeof value === 'string') return value
  // SQL NULL on a full row is loaded and empty. A JS undefined value is not.
  if (value === null) return ''
  return undefined
}

/** Shape gate only. API-normalized defaults are not proof that a value was fetched. */
export function isFullLeadRecord(lead: object | null | undefined): boolean {
  return Boolean(lead) && LEAD_EDIT_FIELDS.every((key) =>
    Object.prototype.hasOwnProperty.call(lead, key) &&
    (lead as Record<string, unknown>)[key] !== undefined,
  ) && loadedLeadText(lead, 'offer') !== undefined && loadedLeadText(lead, 'notes') !== undefined
}

export function canStartLeadEdit(lead: object | null | undefined): boolean {
  return isFullLeadRecord(lead)
}

/** Snapshot a complete lead for the editor. Incomplete records do not open. */
export function beginLeadEdit<T extends object>(lead: T | null | undefined): T | null {
  if (!lead || !canStartLeadEdit(lead)) return null
  const offer = loadedLeadText(lead, 'offer')
  const notes = loadedLeadText(lead, 'notes')
  if (offer === undefined || notes === undefined) return null
  return { ...lead, offer, notes }
}

/**
 * Keep previously loaded fields when a later row omitted them.
 * For offer/notes, a present null becomes ''. Missing/undefined stays untouched.
 */
export function mergeFullLead<T extends object>(previous: T, incoming: object): T {
  const prev = previous as Record<string, unknown>
  const next: Record<string, unknown> = { ...prev, ...(incoming as Record<string, unknown>) }
  for (const key of LEAD_EDIT_FIELDS) {
    if (!TEXT_KEYS.includes(key as TextKey)) {
      if ((incoming as Record<string, unknown>)[key] === undefined) {
        if (Object.prototype.hasOwnProperty.call(prev, key)) next[key] = prev[key]
        else delete next[key]
      }
      continue
    }
    const loaded = loadedLeadText(incoming, key as TextKey)
    if (loaded === undefined) {
      if (Object.prototype.hasOwnProperty.call(prev, key)) next[key] = prev[key]
      else delete next[key]
    } else {
      next[key] = loaded
    }
  }
  return next as T
}

export function resolvedLeadText(
  value: unknown,
  mode: 'create' | 'edit',
): { ok: true; value: string } | { ok: false; reason: 'incomplete' } {
  if (typeof value === 'string') return { ok: true, value: value.trim() }
  if (mode === 'create' && value == null) return { ok: true, value: '' }
  return { ok: false, reason: 'incomplete' }
}

export function leadTextReady(offer: unknown, notes: unknown, mode: 'create' | 'edit'): boolean {
  return resolvedLeadText(offer, mode).ok && resolvedLeadText(notes, mode).ok
}

export function buildLeadSubmit<T extends { offer?: unknown; notes?: unknown }>(
  form: T,
  mode: 'create' | 'edit',
): { ok: true; value: T & { offer: string; notes: string } } | { ok: false; reason: 'incomplete' } {
  if (mode === 'edit' && !isFullLeadRecord(form)) return { ok: false, reason: 'incomplete' }
  const offer = resolvedLeadText(form.offer, mode)
  const notes = resolvedLeadText(form.notes, mode)
  if (!offer.ok || !notes.ok) return { ok: false, reason: 'incomplete' }
  return { ok: true, value: { ...form, offer: offer.value, notes: notes.value } }
}

/** Only user changes may reach UPDATE, never untouched defaults from a partial read. */
export function buildLeadUpdate(
  baseline: object,
  draft: object,
  prepared: LeadInput,
): Partial<LeadInput> {
  if (!isFullLeadRecord(baseline) || !isFullLeadRecord(draft)) {
    throw new Error('incomplete_lead_update')
  }
  const base = baseline as Record<string, unknown>
  const current = draft as Record<string, unknown>
  const changed = new Set(LEAD_EDIT_FIELDS.filter((key) =>
    JSON.stringify(base[key]) !== JSON.stringify(current[key]),
  ))
  // Geocoding and draft-ready timestamps are derived only from edited source fields.
  if (['client_city', 'client_country', 'client_timezone', 'client_lat', 'client_lon']
    .some((key) => changed.has(key as keyof LeadInput))) {
    for (const key of ['client_timezone', 'client_lat', 'client_lon'] as const) {
      if (base[key] !== prepared[key]) changed.add(key)
    }
  }
  if ((changed.has('initial_email_subject') || changed.has('initial_email_body')) &&
    base.initial_email_drafted_at !== prepared.initial_email_drafted_at) {
    changed.add('initial_email_drafted_at')
  }
  return Object.fromEntries([...changed].map((key) => [key, prepared[key]]))
}

export function planDetailFetch(args: {
  lead: object | null | undefined
  status: DetailLoadStatus | undefined
  token: number
  /** Start again after an error, or replace an in-flight request. */
  restart?: boolean
  /** Fetch even when the row is already complete (refresh while editing). */
  refresh?: boolean
}): { start: boolean; status: DetailLoadStatus; token: number } {
  const restart = args.restart === true
  const refresh = args.refresh === true
  if (isFullLeadRecord(args.lead) && !refresh) {
    return { start: false, status: 'ready', token: args.token }
  }
  if (!restart && !refresh && (args.status === 'loading' || args.status === 'error')) {
    return { start: false, status: args.status, token: args.token }
  }
  return { start: true, status: 'loading', token: args.token + 1 }
}

export interface DetailFetchResult {
  ok: boolean
  lead?: object | null
}

/**
 * Apply one detail response. Stale, cancelled, and mismatched ids are ignored.
 * A failure or a payload that still lacks edit fields is an error, never ready,
 * and does not fill those fields with ''.
 * An existing draft is returned unchanged.
 */
export function applyDetailFetchResult(args: {
  requestId: string
  selectedId: string | null
  token: number
  activeToken: number
  cancelled: boolean
  current: object | null
  result: DetailFetchResult
  draft: object | null
  draftDirty: boolean
}): {
  ignored: boolean
  status: DetailLoadStatus
  lead: object | null
  draft: object | null
} {
  // A clean open form is also left alone: a later payload must not replace it.
  const keepDraft = args.draft != null || args.draftDirty ? args.draft : null
  if (
    args.cancelled ||
    args.requestId !== args.selectedId ||
    args.token !== args.activeToken
  ) {
    return { ignored: true, status: 'idle', lead: args.current, draft: keepDraft }
  }

  const incoming = args.result.ok ? (args.result.lead ?? null) : null
  const incomingId =
    incoming && typeof incoming === 'object' && 'id' in incoming
      ? String((incoming as { id?: unknown }).id ?? '')
      : ''
  const sameLead = Boolean(incoming) && incomingId === args.requestId
  if (!incoming || !sameLead || !isFullLeadRecord(incoming)) {
    if (args.current && isFullLeadRecord(args.current)) {
      return { ignored: false, status: 'ready', lead: args.current, draft: keepDraft }
    }
    return { ignored: false, status: 'error', lead: args.current, draft: keepDraft }
  }

  const merged = args.current ? mergeFullLead(args.current, incoming) : incoming
  return { ignored: false, status: 'ready', lead: merged, draft: keepDraft }
}
