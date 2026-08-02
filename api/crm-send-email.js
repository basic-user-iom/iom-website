/**
 * Authenticated CRM outreach send via Proton SMTP Submission.
 * POST /api/crm-send-email
 * Authorization: Bearer <supabase access token> (staff only)
 * Body: {
 *   to, subject, body, leadId?, fromIdentity?,
 *   inReplyTo?, references?, persistMessage? (default true when leadId)
 * }
 * fromIdentity: 'contact' | 'visual' | 'projects' (default contact)
 */

import nodemailer from 'nodemailer'
import {
  clientIp,
  publicError,
  rateLimit,
  requireStaffUser,
  setAllowedOriginCors,
  safeJson,
} from './_lib/blog-helpers.js'
import {
  buildReferencesHeader,
  insertLeadMessage,
  normalizeMessageId,
} from './_lib/crm-lead-messages.js'
import {
  renderOutreachEmailHtml,
  renderOutreachPlainText,
} from './_lib/outreach-email-html.js'
import {
  EMAIL_RE,
  resolveProtonIdentity,
} from './_lib/proton-identities.js'

export default async function handler(req, res) {
  setAllowedOriginCors(res, req.headers.origin, {
    allowAuth: true,
    methods: 'POST, OPTIONS',
  })

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json(publicError('Method not allowed', 'METHOD_NOT_ALLOWED'))
  }

  const host = process.env.PROTON_SMTP_HOST
  const port = Number(process.env.PROTON_SMTP_PORT || 587)
  if (!host) {
    return res.status(503).json(publicError('Email sending is not configured', 'EMAIL_UNAVAILABLE'))
  }

  const auth = await requireStaffUser(req)
  if (!auth.ok) {
    return res.status(auth.status).json(publicError(auth.error, auth.code))
  }
  const authUser = auth.user
  const token = auth.token

  if (
    !(await rateLimit(`crm-send-email:${authUser.id}:${clientIp(req)}`, 30, 60_000, {
      failClosed: true,
    }))
  ) {
    return res.status(429).json(publicError('Too many requests. Try again later.', 'RATE_LIMIT'))
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (!body || typeof body !== 'object') {
    return res.status(400).json(publicError('Invalid body', 'INVALID_BODY'))
  }

  const to = String(body.to || '')
    .trim()
    .toLowerCase()
  const subject = String(body.subject || '').trim()
  const textBody = String(body.body || '').trim()
  const leadId = body.leadId ? String(body.leadId).slice(0, 64) : null
  const fromIdentity = String(body.fromIdentity || 'contact').trim().toLowerCase()
  const inReplyToRaw = body.inReplyTo ? String(body.inReplyTo).trim() : ''
  const referencesRaw = body.references ? String(body.references).trim() : ''
  const persistMessage = body.persistMessage !== false

  if (!EMAIL_RE.test(to)) {
    return res.status(400).json(publicError('Invalid recipient email', 'INVALID_EMAIL'))
  }
  if (!subject) return res.status(400).json(publicError('Subject is required', 'SUBJECT_REQUIRED'))
  if (!textBody) return res.status(400).json(publicError('Body is required', 'BODY_REQUIRED'))
  if (subject.length > 300) {
    return res.status(400).json(publicError('Subject too long', 'SUBJECT_TOO_LONG'))
  }
  if (textBody.length > 50_000) {
    return res.status(400).json(publicError('Body too long', 'BODY_TOO_LONG'))
  }

  const identity = resolveProtonIdentity(fromIdentity)
  if (!identity) {
    return res
      .status(503)
      .json(publicError('Selected From address is not configured', 'IDENTITY_UNCONFIGURED'))
  }

  const html = renderOutreachEmailHtml({ subject, body: textBody })
  const text = renderOutreachPlainText(textBody)
  const inReplyTo = inReplyToRaw ? normalizeMessageId(inReplyToRaw) : ''
  const references = inReplyTo
    ? buildReferencesHeader(referencesRaw, inReplyTo)
    : referencesRaw

  try {
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
      mailHeaders['X-IOM-CRM-User'] = String(authUser.id).slice(0, 64)
      mailHeaders['X-IOM-CRM-From'] = identity.id
    }

    const info = await transporter.sendMail({
      from: identity.fromHeader,
      to,
      subject,
      text,
      html,
      inReplyTo: inReplyTo || undefined,
      references: references || undefined,
      headers: Object.keys(mailHeaders).length ? mailHeaders : undefined,
    })

    const messageId = info.messageId ? normalizeMessageId(info.messageId) : null
    let storedMessageId = null

    if (persistMessage && leadId && supabaseUrl && anonKey) {
      try {
        const stamp = new Date().toISOString()
        const row = await insertLeadMessage({
          supabaseUrl,
          key: anonKey,
          userToken: token,
          row: {
            lead_id: leadId,
            direction: 'outbound',
            from_email: identity.email,
            to_email: to,
            subject,
            body_text: textBody,
            body_html: html,
            message_id: messageId,
            in_reply_to: inReplyTo || null,
            references_header: references || null,
            occurred_at: stamp,
            owner_id: authUser.id,
            raw_headers: {
              fromIdentity: identity.id,
              smtpResponse: info.response || null,
            },
          },
        })
        storedMessageId = row?.id || null
      } catch (persistErr) {
        console.error(
          '[crm-send-email] persist message failed',
          persistErr instanceof Error ? persistErr.message : persistErr,
        )
      }
    }

    return res.status(200).json({
      ok: true,
      messageId,
      storedMessageId,
      from: identity.email,
      fromIdentity: identity.id,
      to,
      inReplyTo: inReplyTo || null,
      references: references || null,
    })
  } catch (err) {
    console.error('[crm-send-email]', err instanceof Error ? err.message : err)
    return res.status(502).json(publicError('Failed to send email', 'SEND_FAILED'))
  }
}
