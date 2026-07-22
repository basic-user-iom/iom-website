/**
 * Shared Proton SMTP send for CRM outreach (interactive + cron).
 */

import nodemailer from 'nodemailer'
import {
  insertLeadMessage,
  normalizeMessageId,
} from './crm-lead-messages.js'
import {
  renderOutreachEmailHtml,
  renderOutreachPlainText,
} from './outreach-email-html.js'
import { EMAIL_RE, resolveProtonIdentity } from './proton-identities.js'

/**
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.body
 * @param {string | null} [opts.leadId]
 * @param {string} [opts.fromIdentity]
 * @param {string} [opts.supabaseUrl]
 * @param {string} [opts.serviceKey]  service role for persist (cron)
 * @param {string} [opts.anonKey]
 * @param {string} [opts.userToken]  user JWT for persist (interactive)
 * @param {string | null} [opts.ownerId]
 * @param {boolean} [opts.persistMessage]
 */
export async function sendCrmOutreachEmail(opts) {
  const host = process.env.PROTON_SMTP_HOST
  const port = Number(process.env.PROTON_SMTP_PORT || 587)
  if (!host) throw new Error('Email sending is not configured')

  const to = String(opts.to || '')
    .trim()
    .toLowerCase()
  const subject = String(opts.subject || '').trim()
  const textBody = String(opts.body || '').trim()
  const leadId = opts.leadId ? String(opts.leadId).slice(0, 64) : null
  const fromIdentity = String(opts.fromIdentity || 'contact').trim().toLowerCase()
  const persistMessage = opts.persistMessage !== false

  if (!EMAIL_RE.test(to)) throw new Error('Invalid recipient email')
  if (!subject) throw new Error('Subject is required')
  if (!textBody) throw new Error('Body is required')
  if (subject.length > 300) throw new Error('Subject too long')
  if (textBody.length > 50_000) throw new Error('Body too long')

  const identity = resolveProtonIdentity(fromIdentity)
  if (!identity?.configured) {
    throw new Error('Selected From address is not configured')
  }

  const html = renderOutreachEmailHtml({ subject, body: textBody })
  const text = renderOutreachPlainText(textBody)

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    requireTLS: true,
    auth: { user: identity.user, pass: identity.pass },
  })

  const mailHeaders = {}
  if (leadId) {
    mailHeaders['X-IOM-CRM-Lead'] = leadId
    if (opts.ownerId) mailHeaders['X-IOM-CRM-User'] = String(opts.ownerId).slice(0, 64)
    mailHeaders['X-IOM-CRM-From'] = identity.id
    mailHeaders['X-IOM-CRM-Mode'] = opts.userToken ? 'interactive' : 'scheduled'
  }

  const info = await transporter.sendMail({
    from: identity.fromHeader,
    to,
    subject,
    text,
    html,
    headers: Object.keys(mailHeaders).length ? mailHeaders : undefined,
  })

  const messageId = info.messageId ? normalizeMessageId(info.messageId) : null
  let storedMessageId = null

  if (persistMessage && leadId && opts.supabaseUrl) {
    const key = opts.serviceKey || opts.anonKey
    if (key) {
      try {
        const stamp = new Date().toISOString()
        const row = await insertLeadMessage({
          supabaseUrl: opts.supabaseUrl,
          key,
          userToken: opts.userToken || undefined,
          row: {
            lead_id: leadId,
            direction: 'outbound',
            from_email: identity.email,
            to_email: to,
            subject,
            body_text: textBody,
            body_html: html,
            message_id: messageId,
            in_reply_to: null,
            references_header: null,
            occurred_at: stamp,
            owner_id: opts.ownerId || null,
            raw_headers: {
              fromIdentity: identity.id,
              smtpResponse: info.response || null,
              scheduled: !opts.userToken,
            },
          },
        })
        storedMessageId = row?.id || null
      } catch (persistErr) {
        console.error(
          '[crm-send-outreach] persist failed',
          persistErr instanceof Error ? persistErr.message : persistErr,
        )
      }
    }
  }

  return {
    ok: true,
    messageId,
    storedMessageId,
    from: identity.email,
    fromIdentity: identity.id,
    to,
  }
}

/**
 * Notify staff that a scheduled send failed.
 * @param {object} opts
 * @param {string} opts.toStaff
 * @param {string} opts.company
 * @param {string} opts.leadId
 * @param {string} opts.error
 * @param {string} [opts.clientTo]
 */
export async function notifyScheduledSendFailure(opts) {
  const toStaff = String(opts.toStaff || '')
    .trim()
    .toLowerCase()
  if (!EMAIL_RE.test(toStaff)) return { ok: false, skipped: true }

  const identity = resolveProtonIdentity('contact')
  if (!identity?.configured) return { ok: false, skipped: true }

  const host = process.env.PROTON_SMTP_HOST
  const port = Number(process.env.PROTON_SMTP_PORT || 587)
  if (!host) return { ok: false, skipped: true }

  const company = String(opts.company || 'Lead').slice(0, 120)
  const detail = String(opts.error || 'Unknown error').slice(0, 500)
  const clientTo = String(opts.clientTo || '').slice(0, 120)
  const subject = `CRM scheduled send failed — ${company}`
  const text = [
    `Scheduled outreach failed for ${company}.`,
    opts.leadId ? `Lead id: ${opts.leadId}` : null,
    clientTo ? `Intended recipient: ${clientTo}` : null,
    '',
    `Error: ${detail}`,
    '',
    'Open the lead in CRM, fix the draft/recipient, and schedule again or send manually.',
    'https://iobjectm.com/client-login',
  ]
    .filter(Boolean)
    .join('\n')

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    requireTLS: true,
    auth: { user: identity.user, pass: identity.pass },
  })

  await transporter.sendMail({
    from: identity.fromHeader,
    to: toStaff,
    subject,
    text,
  })
  return { ok: true }
}
