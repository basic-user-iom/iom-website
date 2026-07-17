/**
 * Resend Receiving → CRM inbound mirror.
 * POST /api/crm-resend-inbound
 *
 * Resend webhook event `email.received` (metadata only).
 * Fetches full body via Received Emails API, then ingests into crm_lead_messages.
 *
 * Env:
 *   RESEND_API_KEY
 *   RESEND_WEBHOOK_SECRET  (whsec_… from Resend webhook — Svix signature)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VITE_SUPABASE_URL / SUPABASE_URL
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  extractEmail,
  headerValue,
  ingestInboundEmail,
} from './lib/crm-inbound-ingest.js'

/** Keep raw body for Svix signature verification. */
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, svix-id, svix-timestamp, svix-signature',
  )

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const resendKey = (process.env.RESEND_API_KEY || '').trim()
  const webhookSecret = (process.env.RESEND_WEBHOOK_SECRET || '').trim()
  if (!resendKey) {
    return res.status(503).json({ error: 'RESEND_API_KEY is not configured' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY required for inbound email ingest',
    })
  }

  let rawBody = ''
  try {
    rawBody = await readRawBody(req)
  } catch {
    return res.status(400).json({ error: 'Could not read body' })
  }

  if (webhookSecret) {
    const ok = verifySvixSignature({
      payload: rawBody,
      secret: webhookSecret,
      id: String(req.headers['svix-id'] || ''),
      timestamp: String(req.headers['svix-timestamp'] || ''),
      signature: String(req.headers['svix-signature'] || ''),
    })
    if (!ok) {
      return res.status(401).json({ error: 'Invalid webhook signature' })
    }
  }

  const event = safeJson(rawBody)
  if (!event || typeof event !== 'object') {
    return res.status(400).json({ error: 'Invalid body' })
  }

  if (event.type && event.type !== 'email.received') {
    return res.status(200).json({ ok: true, ignored: event.type })
  }

  const emailId = event.data?.email_id || event.data?.id
  if (!emailId) {
    return res.status(400).json({ error: 'Missing email_id' })
  }

  try {
    const received = await fetchReceivedEmail(resendKey, emailId)
    const headers = normalizeHeaders(received.headers)
    const from =
      extractEmail(received.from) || extractEmail(event.data?.from)
    const to =
      extractEmail(received.to?.[0] || received.to) ||
      extractEmail(event.data?.to?.[0] || event.data?.to) ||
      extractEmail(event.data?.received_for?.[0]) ||
      'contact@iobjectm.com'

    const result = await ingestInboundEmail({
      supabaseUrl,
      serviceKey,
      via: 'resend',
      message: {
        from,
        to,
        subject: received.subject || event.data?.subject || '',
        text: received.text || '',
        html: received.html || null,
        messageId: received.message_id || event.data?.message_id,
        inReplyTo: headerValue(headers, 'In-Reply-To'),
        references: headerValue(headers, 'References'),
        date: received.created_at || event.data?.created_at || event.created_at,
        headers,
      },
    })

    return res.status(result.status).json(result.body)
  } catch (err) {
    console.error('[crm-resend-inbound]', err instanceof Error ? err.message : err)
    return res.status(502).json({
      error: 'Failed to process Resend inbound email',
      detail: err instanceof Error ? err.message.slice(0, 200) : 'Unknown error',
    })
  }
}

async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  if (req.body && typeof req.body === 'object') {
    // Fallback if platform already parsed JSON (signature may fail).
    return JSON.stringify(req.body)
  }
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function fetchReceivedEmail(apiKey, emailId) {
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    },
  )
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg = json?.message || text.slice(0, 240)
    throw new Error(msg || `Resend ${res.status}`)
  }
  return json?.data && typeof json.data === 'object' ? json.data : json
}

function normalizeHeaders(headers) {
  if (!headers) return {}
  if (Array.isArray(headers)) {
    const out = {}
    for (const row of headers) {
      if (!row) continue
      if (typeof row === 'object' && row.name) {
        out[row.name] = row.value
      }
    }
    return out
  }
  if (typeof headers === 'object') return headers
  return {}
}

/**
 * Svix-compatible verification used by Resend webhooks.
 * @see https://docs.svix.com/receiving/verifying-payloads/how
 */
function verifySvixSignature({ payload, secret, id, timestamp, signature }) {
  if (!id || !timestamp || !signature) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false

  let keyBytes
  try {
    const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret
    keyBytes = Buffer.from(raw, 'base64')
  } catch {
    return false
  }

  const signedContent = `${id}.${timestamp}.${payload}`
  const expected = createHmac('sha256', keyBytes)
    .update(signedContent)
    .digest('base64')

  const candidates = String(signature)
    .split(' ')
    .map((part) => {
      const [, sig] = part.split(',')
      return sig || part
    })
    .filter(Boolean)

  const expectedBuf = Buffer.from(expected)
  for (const cand of candidates) {
    try {
      const candBuf = Buffer.from(cand)
      if (
        candBuf.length === expectedBuf.length &&
        timingSafeEqual(candBuf, expectedBuf)
      ) {
        return true
      }
    } catch {
      /* ignore bad candidate */
    }
  }
  return false
}

function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
