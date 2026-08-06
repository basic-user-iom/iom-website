/**
 * POST /api/project-costs-inquiry
 * Public inquiry from /project-costs — emails projects@iobjectm.com via Proton SMTP.
 * Body: { kind: 'consultation' | 'estimate', name, email, message, botcheck? }
 */

import nodemailer from 'nodemailer'
import {
  clientIp,
  isDisposableEmail,
  isLightlyValidEmail,
  rateLimit,
  safeJson,
  setAllowedOriginCors,
} from './_lib/blog-helpers.js'
import { resolveProtonIdentity } from './_lib/proton-identities.js'

const TO_EMAIL = 'projects@iobjectm.com'
const KINDS = new Set(['consultation', 'estimate'])

export default async function handler(req, res) {
  setAllowedOriginCors(res, req.headers.origin, {
    methods: 'POST, OPTIONS',
  })

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = clientIp(req)
  if (!(await rateLimit(`pc-inquiry:${ip}`, 5, 60_000))) {
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const payload = typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid body' })
  }

  // Honeypot — bots fill hidden fields; pretend success
  if (String(payload.botcheck || '').trim()) {
    return res.status(200).json({ ok: true })
  }

  const kind = String(payload.kind || '').trim().toLowerCase()
  const name = String(payload.name || '').trim().slice(0, 80)
  const email = String(payload.email || '').trim().toLowerCase().slice(0, 160)
  const message = String(payload.message || '').trim().slice(0, 4000)

  if (!KINDS.has(kind)) {
    return res.status(400).json({ error: 'Invalid inquiry type' })
  }
  if (!name) return res.status(400).json({ error: 'Name is required' })
  if (!isLightlyValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email is required' })
  }
  if (isDisposableEmail(email)) {
    return res.status(400).json({ error: 'Please use a permanent email address' })
  }
  if (!message || message.length < 8) {
    return res.status(400).json({ error: 'Please include a short project description' })
  }
  if ((message.match(/https?:\/\//gi) || []).length > 3) {
    return res.status(400).json({ error: 'Too many links in the message' })
  }

  if (!(await rateLimit(`pc-inquiry-email:${email}`, 3, 3_600_000))) {
    return res.status(429).json({ error: 'Too many inquiries from this email. Try later.' })
  }

  const host = process.env.PROTON_SMTP_HOST
  const port = Number(process.env.PROTON_SMTP_PORT || 587)
  const identity = resolveProtonIdentity('projects')
  if (!host || !identity?.configured) {
    return res.status(503).json({
      error: 'Inquiry email is not configured. Please email projects@iobjectm.com directly.',
    })
  }

  const subject =
    kind === 'consultation'
      ? 'Free 30-minute project consultation'
      : 'Project estimate request'

  const text = [
    `Kind: ${kind}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `Source: /project-costs`,
    '',
    message,
  ].join('\n')

  const html = `
    <p><strong>Kind:</strong> ${escapeHtml(kind)}</p>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
    <p><strong>Source:</strong> /project-costs</p>
    <hr />
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: identity.user, pass: identity.pass },
    })

    await transporter.sendMail({
      from: identity.fromHeader,
      to: TO_EMAIL,
      replyTo: `${name} <${email}>`,
      subject: `[IOM] ${subject}`,
      text,
      html,
    })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[project-costs-inquiry]', err instanceof Error ? err.message : err)
    return res.status(502).json({
      error: 'Could not send the message. Please email projects@iobjectm.com directly.',
    })
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
