import type { LeadMessage } from './types'

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
  const prior = withId.references_header?.trim() || ''
  const refs = prior
    ? prior.includes(parent)
      ? prior
      : `${prior} ${parent}`.trim()
    : parent
  return { inReplyTo: parent, references: refs }
}
