/**
 * Inbound email mirror for CRM (Proton keep-copy forward → webhook).
 * POST /api/crm-inbound-email
 *
 * Auth: Authorization: Bearer <CRM_INBOUND_EMAIL_SECRET>
 *    or header X-IOM-CRM-Inbound: <CRM_INBOUND_EMAIL_SECRET>
 *
 * Body (JSON):
 * {
 *   from, to, subject, text?, html?,
 *   messageId?, inReplyTo?, references?,
 *   date?, headers?: { "X-IOM-CRM-Lead"?: "...", ... },
 *   leadId?  // optional explicit override
 * }
 *
 * Matching order:
 * 1. Explicit leadId / X-IOM-CRM-Lead
 * 2. In-Reply-To / References → outbound message_id
 * 3. Sender email → crm_leads.email / emails jsonb
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS for unattended ingest).
 */

import {
  insertLeadMessage,
  normalizeMessageId,
} from './lib/crm-lead-messages.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-IOM-CRM-Inbound',
  )

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = (process.env.CRM_INBOUND_EMAIL_SECRET || '').trim()
  if (!secret) {
    return res.status(503).json({ error: 'Inbound email is not configured' })
  }

  const authHeader = String(req.headers.authorization || '')
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const headerSecret = String(req.headers['x-iom-crm-inbound'] || '').trim()
  if (bearer !== secret && headerSecret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY required for inbound email ingest',
    })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid body' })
  }

  const from = extractEmail(body.from)
  const to = extractEmail(body.to) || 'contact@iobjectm.com'
  const subject = String(body.subject || '').trim().slice(0, 500)
  const textBody = String(body.text || body.body || body.body_text || '').trim()
  const htmlBody = body.html || body.body_html ? String(body.html || body.body_html) : null
  const messageId = normalizeMessageId(body.messageId || body.message_id) || null
  const inReplyTo = normalizeMessageId(body.inReplyTo || body.in_reply_to) || null
  const references = String(body.references || body.references_header || '').trim()
  const headers =
    body.headers && typeof body.headers === 'object' && !Array.isArray(body.headers)
      ? body.headers
      : {}
  const occurredAt = parseDate(body.date) || new Date().toISOString()

  if (!from || !EMAIL_RE.test(from)) {
    return res.status(400).json({ error: 'Invalid from address' })
  }
  if (!textBody && !htmlBody) {
    return res.status(400).json({ error: 'Body text or html is required' })
  }

  try {
    if (messageId) {
      const existing = await sbGet(
        supabaseUrl,
        serviceKey,
        `crm_lead_messages?message_id=eq.${encodeURIComponent(messageId)}&select=id,lead_id&limit=1`,
      )
      if (Array.isArray(existing) && existing[0]?.id) {
        return res.status(200).json({
          ok: true,
          duplicate: true,
          id: existing[0].id,
          leadId: existing[0].lead_id,
        })
      }
    }

    const explicitLead =
      String(body.leadId || body.lead_id || headers['X-IOM-CRM-Lead'] || headers['x-iom-crm-lead'] || '')
        .trim()
        .slice(0, 64) || null

    let leadId = explicitLead && isUuid(explicitLead) ? explicitLead : null

    if (!leadId && (inReplyTo || references)) {
      leadId = await matchLeadByThread(supabaseUrl, serviceKey, inReplyTo, references)
    }

    if (!leadId) {
      leadId = await matchLeadBySender(supabaseUrl, serviceKey, from)
    }

    if (!leadId) {
      return res.status(404).json({
        error: 'No matching lead',
        detail: 'Could not match by lead id, reply thread, or sender email',
        from,
      })
    }

    const plain =
      textBody ||
      String(htmlBody || '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50_000)

    const row = await insertLeadMessage({
      supabaseUrl,
      key: serviceKey,
      row: {
        lead_id: leadId,
        direction: 'inbound',
        from_email: from,
        to_email: to,
        subject: subject || '(no subject)',
        body_text: plain,
        body_html: htmlBody,
        message_id: messageId,
        in_reply_to: inReplyTo,
        references_header: references || null,
        occurred_at: occurredAt,
        owner_id: null,
        raw_headers: {
          ...headers,
          inboundVia: 'crm-inbound-email',
        },
      },
    })

    await sbPatch(
      supabaseUrl,
      serviceKey,
      `crm_leads?id=eq.${encodeURIComponent(leadId)}`,
      { updated_at: new Date().toISOString() },
    )

    return res.status(200).json({
      ok: true,
      id: row?.id || null,
      leadId,
      messageId,
    })
  } catch (err) {
    console.error('[crm-inbound-email]', err instanceof Error ? err.message : err)
    return res.status(502).json({
      error: 'Failed to ingest inbound email',
      detail: err instanceof Error ? err.message.slice(0, 200) : 'Unknown error',
    })
  }
}

async function matchLeadByThread(supabaseUrl, key, inReplyTo, references) {
  const ids = []
  const seen = new Set()
  const push = (v) => {
    const n = normalizeMessageId(v)
    if (!n || seen.has(n)) return
    seen.add(n)
    ids.push(n)
  }
  push(inReplyTo)
  for (const token of String(references || '').split(/\s+/)) push(token)

  for (const mid of ids) {
    const rows = await sbGet(
      supabaseUrl,
      key,
      `crm_lead_messages?message_id=eq.${encodeURIComponent(mid)}&select=lead_id&limit=1`,
    )
    if (Array.isArray(rows) && rows[0]?.lead_id) return rows[0].lead_id
  }
  return null
}

async function matchLeadBySender(supabaseUrl, key, from) {
  const email = from.toLowerCase()
  const byPrimary = await sbGet(
    supabaseUrl,
    key,
    `crm_leads?email=ilike.${encodeURIComponent(email)}&select=id&order=updated_at.desc&limit=1`,
  )
  if (Array.isArray(byPrimary) && byPrimary[0]?.id) return byPrimary[0].id

  // Fallback: scan recent leads' emails jsonb (bounded)
  const recent = await sbGet(
    supabaseUrl,
    key,
    `crm_leads?select=id,email,emails&order=updated_at.desc&limit=500`,
  )
  if (!Array.isArray(recent)) return null
  for (const lead of recent) {
    if (String(lead.email || '').trim().toLowerCase() === email) return lead.id
    const extras = Array.isArray(lead.emails) ? lead.emails : []
    for (const row of extras) {
      if (String(row?.email || '').trim().toLowerCase() === email) return lead.id
    }
  }
  return null
}

async function sbGet(supabaseUrl, key, path) {
  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg = json?.message || text.slice(0, 240)
    throw new Error(msg || `Supabase ${res.status}`)
  }
  return json
}

async function sbPatch(supabaseUrl, key, path, body) {
  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text.slice(0, 240) || `Supabase ${res.status}`)
  }
}

function extractEmail(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const m = raw.match(/<([^>]+)>/)
  const email = (m ? m[1] : raw).trim().toLowerCase()
  return EMAIL_RE.test(email) ? email : ''
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
