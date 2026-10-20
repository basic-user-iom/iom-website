import type { LeadMessage } from './types'
import { normalizeEmailReferences } from './emailReferences.mjs'

function singleMessageId(value: string | null): string | null {
  if (!value) return null
  try {
    // Array input validates one whole token; never extract IDs from text.
    return normalizeEmailReferences([value]) || null
  } catch {
    return null
  }
}

/** Recover only the old, repeatedly escaped JSON References representation. */
function recoverLegacyReferences(messages: LeadMessage[], parent: LeadMessage, raw: string): string | null {
  if (!parent.lead_id || /[\u0000-\u001f\u007f]/.test(raw)) return null
  let values: unknown
  try { values = JSON.parse(raw) } catch { return null }
  if (!Array.isArray(values) || !values.length) return null
  let damaged = false
  for (const value of values) {
    if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return null
    if (singleMessageId(value)) continue
    // Historical corruption consists of angle-wrapped escaped JSON fragments.
    // Arbitrary malformed headers and decoded header injection remain rejected.
    if (!value.startsWith('<') || !value.endsWith('>') || !value.includes('\\') ||
      !/["\[\]]/.test(value) || /[\s:]/.test(value)) return null
    damaged = true
  }
  if (!damaged) return null

  const byId = new Map<string, LeadMessage[]>()
  for (const message of messages) {
    if (message.lead_id !== parent.lead_id) continue
    const id = singleMessageId(message.message_id)
    if (id) byId.set(id.toLowerCase(), [...(byId.get(id.toLowerCase()) || []), message])
  }
  const chain: string[] = []
  const visited = new Set<string>()
  let current = parent
  while (chain.length < 2000) {
    const id = singleMessageId(current.message_id)
    if (!id || visited.has(id.toLowerCase()) || byId.get(id.toLowerCase())?.length !== 1) return null
    visited.add(id.toLowerCase())
    chain.push(id)
    if (!current.in_reply_to) break
    const previousId = singleMessageId(current.in_reply_to)
    if (!previousId) return null
    const matches = byId.get(previousId.toLowerCase())
    if (!matches) {
      // An absent older message ends the verified suffix. Never include its ID.
      // A known message belonging to another lead is not an acceptable boundary.
      if (messages.some(m => m.lead_id !== parent.lead_id &&
        singleMessageId(m.message_id)?.toLowerCase() === previousId.toLowerCase())) return null
      break
    }
    if (matches.length !== 1) return null
    current = matches[0]
  }
  if (chain.length < 2 || chain.length >= 2000) return null
  // All IDs come from actual same-lead rows linked by In-Reply-To, not raw.
  // The server independently verifies the exact parent against the target lead.
  return normalizeEmailReferences(chain.reverse())
}

/** Suggest a reply subject from the last message in the thread. */
export function suggestReplySubject(messages: LeadMessage[], fallback = ''): string {
  const last = [...messages].reverse()[0]
  const base = (last?.subject || fallback).trim()
  if (!base) return ''
  if (/^re\s*:/i.test(base)) return base
  return `Re: ${base}`
}

/** Threading headers for the next outbound reply. */
export function replyThreadingFromMessages(messages: LeadMessage[]): {
  inReplyTo: string | null
  references: string | null
} {
  const withId = [...messages]
    .reverse()
    .find((m) => m.message_id?.trim())
  if (!withId?.message_id) {
    return { inReplyTo: null, references: null }
  }
  const parent = withId.message_id.trim()
  let prior = withId.references_header || ''
  try {
    prior = normalizeEmailReferences(prior)
  } catch {
    // Keep unsafe or ambiguous input intact for the existing server rejection.
    prior = recoverLegacyReferences(messages, withId, prior) || prior
  }
  const refs = prior
    ? prior.split(/\s+/).some((id) => id.toLowerCase() === parent.toLowerCase())
      ? prior
      : `${prior} ${parent}`.trim()
    : parent
  return { inReplyTo: parent, references: refs }
}
