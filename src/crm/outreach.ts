import type { Lead } from './types'

export function hasInitialEmailDraft(lead: Lead): boolean {
  return !!(lead.initial_email_subject?.trim() && lead.initial_email_body?.trim())
}

/** Draft exists but not marked sent — show reminder badge/banner. */
export function initialEmailPending(lead: Lead): boolean {
  return hasInitialEmailDraft(lead) && !lead.initial_email_sent_at
}

export type InitialEmailStatus = 'none' | 'pending' | 'drafted' | 'sent'

export function initialEmailStatus(lead: Lead): InitialEmailStatus {
  if (lead.initial_email_sent_at) return 'sent'
  if (lead.initial_email_drafted_at && hasInitialEmailDraft(lead)) return 'drafted'
  if (hasInitialEmailDraft(lead)) return 'pending'
  return 'none'
}

export function buildMailtoUrl(email: string, subject: string, body: string): string {
  const to = email.trim()
  if (!to) return ''
  const params = new URLSearchParams()
  if (subject.trim()) params.set('subject', subject.trim())
  if (body.trim()) params.set('body', body.trim())
  const qs = params.toString()
  return qs ? `mailto:${encodeURIComponent(to)}?${qs}` : `mailto:${encodeURIComponent(to)}`
}
