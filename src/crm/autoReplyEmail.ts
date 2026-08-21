/**
 * Heuristics for auto-acks / OOO / ticket receipts that should not count as
 * a real “client replied” for CRM filtering.
 *
 * Keep in sync with api/_lib/crm-auto-reply.js
 */

export function isAutoReplyEmail(opts: {
  from?: string | null
  subject?: string | null
  body?: string | null
}): boolean {
  const fromL = String(opts.from || '')
    .toLowerCase()
    .trim()
  const subjectL = String(opts.subject || '')
    .toLowerCase()
    .trim()
  const bodyL = String(opts.body || '')
    .toLowerCase()
    .slice(0, 800)

  if (!fromL && !subjectL && !bodyL) return false

  if (
    /^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|notifications)([+._-]|$)/i.test(
      fromL.split('@')[0] || '',
    ) ||
    /\+noreply@|\+canned\.response@|\+no[-_]?reply@/i.test(fromL) ||
    /@.*\.(zendesk|freshdesk|helpscout|intercom)\./i.test(fromL) ||
    /support@.*zendesk/i.test(fromL) ||
    /calendly\.com$/i.test(fromL.split('@')[1] || '') ||
    /notifications@calendly\.com/i.test(fromL)
  ) {
    return true
  }

  if (
    /\b(out of office|out-of-office|ooo\b|automatic reply|auto[- ]?reply|auto[- ]?response|automatic response|vacation|abwesend|afwezig|away from (my )?desk|on leave|on holiday|summer (holiday|closure)|ticket received|request received|we received your (message|request|email)|your request \(\d+\) has been|dein(e)? anfrage ist eingegangen|thank you for (your )?(email|application|contacting|getting in touch)|thanks for (reaching out|getting in touch|contacting)|we'll be back in touch|we will (aim to )?respond|we('ll| will) get back to you|confirmation that we have received|this is an automated|automated response|canned response)\b/i.test(
      subjectL,
    )
  ) {
    return true
  }

  if (
    /\b(please reply above this line|type your reply above this line|this is an automatic email|this is an automated response|your request \(\d+\) has been received|we have received your (email|message|request)|we('ll| will) (personally )?get back to you as soon as|our team will (review|respond|get back)|ticket[- ]?(id|nummer|number)\b)/i.test(
      bodyL,
    )
  ) {
    return true
  }

  return false
}

export function isAutoReplyLeadMessage(message: {
  from_email?: string | null
  subject?: string | null
  body_text?: string | null
}): boolean {
  return isAutoReplyEmail({
    from: message.from_email,
    subject: message.subject,
    body: message.body_text,
  })
}
