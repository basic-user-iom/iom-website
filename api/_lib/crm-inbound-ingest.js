/**
 * Shared CRM inbound email ingest (Proton keep-copy → webhook → crm_lead_messages).
 */

import {
  insertLeadMessage,
  normalizeMessageId,
} from './crm-lead-messages.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * @param {object} opts
 * @param {string} opts.supabaseUrl
 * @param {string} opts.serviceKey
 * @param {object} opts.message
 * @param {string} [opts.via]
 */
export async function ingestInboundEmail({
  supabaseUrl,
  serviceKey,
  message,
  via = 'crm-inbound-email',
}) {
  const from = extractEmail(message.from)
  const to =
    extractEmail(
      Array.isArray(message.to) ? message.to[0] : message.to,
    ) || 'contact@iobjectm.com'
  const subject = String(message.subject || '').trim().slice(0, 500)
  const textBody = String(
    message.text || message.body || message.body_text || '',
  ).trim()
  const htmlBody =
    message.html || message.body_html
      ? String(message.html || message.body_html)
      : null
  const messageId =
    normalizeMessageId(message.messageId || message.message_id) || null
  const inReplyTo =
    normalizeMessageId(message.inReplyTo || message.in_reply_to) || null
  const references = String(
    message.references || message.references_header || '',
  ).trim()
  const headers =
    message.headers &&
    typeof message.headers === 'object' &&
    !Array.isArray(message.headers)
      ? message.headers
      : {}
  const occurredAt = parseDate(message.date) || new Date().toISOString()

  if (!from || !EMAIL_RE.test(from)) {
    return { status: 400, body: { error: 'Invalid from address' } }
  }
  if (!textBody && !htmlBody) {
    return { status: 400, body: { error: 'Body text or html is required' } }
  }

  if (messageId) {
    const existing = await sbGet(
      supabaseUrl,
      serviceKey,
      `crm_lead_messages?message_id=eq.${encodeURIComponent(messageId)}&select=id,lead_id&limit=1`,
    )
    if (Array.isArray(existing) && existing[0]?.id) {
      return {
        status: 200,
        body: {
          ok: true,
          duplicate: true,
          id: existing[0].id,
          leadId: existing[0].lead_id,
        },
      }
    }
  }

  const explicitLead =
    String(
      message.leadId ||
        message.lead_id ||
        headers['X-IOM-CRM-Lead'] ||
        headers['x-iom-crm-lead'] ||
        '',
    )
      .trim()
      .slice(0, 64) || null

  let leadId = explicitLead && isUuid(explicitLead) ? explicitLead : null

  if (!leadId && (inReplyTo || references)) {
    leadId = await matchLeadByThread(
      supabaseUrl,
      serviceKey,
      inReplyTo,
      references,
    )
  }

  if (!leadId) {
    leadId = await matchLeadBySender(supabaseUrl, serviceKey, from)
  }

  if (!leadId) {
    return {
      status: 404,
      body: {
        error: 'No matching lead',
        detail:
          'Could not match by lead id, reply thread, or sender email',
        from,
      },
    }
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
        inboundVia: via,
      },
    },
  })

  await sbPatch(
    supabaseUrl,
    serviceKey,
    `crm_leads?id=eq.${encodeURIComponent(leadId)}`,
    { updated_at: new Date().toISOString() },
  )

  return {
    status: 200,
    body: {
      ok: true,
      id: row?.id || null,
      leadId,
      messageId,
    },
  }
}

export function extractEmail(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const m = raw.match(/<([^>]+)>/)
  const email = (m ? m[1] : raw).trim().toLowerCase()
  return EMAIL_RE.test(email) ? email : ''
}

export function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return ''
  const wanted = String(name).toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === wanted) {
      if (Array.isArray(v)) return String(v[0] || '')
      return String(v || '')
    }
  }
  return ''
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
