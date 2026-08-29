/**
 * Heuristics for auto-acks / OOO / ticket receipts that should not count as
 * a real “client replied” for CRM filtering.
 *
 * Keep in sync with src/crm/autoReplyEmail.ts
 */

/**
 * @param {{ from?: string, subject?: string, body?: string, headers?: Record<string, unknown> }} opts
 */
export function isAutoReplyEmail({ from = '', subject = '', body = '', headers = {} }) {
  const fromL = String(from || '').toLowerCase().trim()
  const subjectL = String(subject || '').toLowerCase().trim()
  const bodyL = String(body || '').toLowerCase().slice(0, 800)
  const headerValue = (name) => {
    const entry = Object.entries(headers || {}).find(
      ([key]) => key.toLowerCase() === name.toLowerCase(),
    )
    const value = entry?.[1]
    return Array.isArray(value) ? value.join(' ').trim() : String(value ?? '').trim()
  }
  const autoSubmitted = headerValue('auto-submitted').toLowerCase()
  const autoReplyHeader = [headerValue('x-autoreply'), headerValue('x-autorespond')]
    .join(' ')
    .trim()

  // RFC 3834: "no" means a human-originated message; every other populated
  // Auto-Submitted value identifies an automatic response/generation.
  if ((autoSubmitted && autoSubmitted !== 'no') || autoReplyHeader) return true

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
    /\b(please reply above this line|type your reply above this line|this is an automatic email|this is an automated response|your request \(\d+\) has been received|we have received your (email|message|request)|we('ll| will) (personally )?get back to you as soon as|our team will (review|respond|get back)|away from (my )?(desk|office)|currently away|annual leave|out of the office|ticket[- ]?(id|nummer|number)\b)/i.test(
      bodyL,
    )
  ) {
    return true
  }

  return false
}
