import type { LeadMessage } from './types'
import { normalizeEmailReferences } from './emailReferences.mjs'

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
  let prior = withId.references_header?.trim() || ''
  try {
    prior = normalizeEmailReferences(prior)
  } catch {
    // Keep invalid input intact for the existing server rejection. Never
    // silently drop a malformed chain or turn it into an unthreaded message.
  }
  const refs = prior
    ? prior.split(/\s+/).some((id) => id.toLowerCase() === parent.toLowerCase())
      ? prior
      : `${prior} ${parent}`.trim()
    : parent
  return { inReplyTo: parent, references: refs }
}
