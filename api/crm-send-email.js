/**
 * Authenticated CRM outreach send via Proton SMTP Submission.
 * POST /api/crm-send-email
 * Authorization: Bearer <supabase access token>
 * Body: { to, subject, body, leadId? }
 */

import nodemailer from 'nodemailer'
import {
  renderOutreachEmailHtml,
  renderOutreachPlainText,
} from './lib/outreach-email-html.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const host = process.env.PROTON_SMTP_HOST
  const port = Number(process.env.PROTON_SMTP_PORT || 587)
  const user = process.env.PROTON_SMTP_USER
  const pass = process.env.PROTON_SMTP_PASS
  const from = process.env.PROTON_SMTP_FROM || user

  if (!host || !user || !pass) {
    return res.status(503).json({ error: 'Email sending is not configured' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  if (!supabaseUrl || !anonKey) {
    return res.status(503).json({ error: 'Auth is not configured' })
  }

  const authHeader = String(req.headers.authorization || '')
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return res.status(401).json({ error: 'Missing authorization' })

  const userRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  })
  if (!userRes.ok) {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }
  const authUser = await userRes.json()
  if (!authUser?.id) return res.status(401).json({ error: 'Invalid session' })

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid body' })
  }

  const to = String(body.to || '')
    .trim()
    .toLowerCase()
  const subject = String(body.subject || '').trim()
  const textBody = String(body.body || '').trim()
  const leadId = body.leadId ? String(body.leadId).slice(0, 64) : null

  if (!EMAIL_RE.test(to)) return res.status(400).json({ error: 'Invalid recipient email' })
  if (!subject) return res.status(400).json({ error: 'Subject is required' })
  if (!textBody) return res.status(400).json({ error: 'Body is required' })
  if (subject.length > 300) return res.status(400).json({ error: 'Subject too long' })
  if (textBody.length > 50_000) return res.status(400).json({ error: 'Body too long' })

  const html = renderOutreachEmailHtml({ subject, body: textBody })
  const text = renderOutreachPlainText(textBody)

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      requireTLS: true,
      auth: { user, pass },
    })

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
      headers: leadId
        ? {
            'X-IOM-CRM-Lead': leadId,
            'X-IOM-CRM-User': String(authUser.id).slice(0, 64),
          }
        : undefined,
    })

    return res.status(200).json({
      ok: true,
      messageId: info.messageId || null,
      from: user,
      to,
    })
  } catch (err) {
    console.error('[crm-send-email]', err instanceof Error ? err.message : err)
    return res.status(502).json({
      error: 'Failed to send email',
      detail: err instanceof Error ? err.message.slice(0, 200) : 'Unknown error',
    })
  }
}

function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
