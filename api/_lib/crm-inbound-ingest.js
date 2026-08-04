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
 * @param {string} [opts.svixId]
 * @param {string} [opts.resendEmailId]
 */
export async function ingestInboundEmail({
  supabaseUrl,
  serviceKey,
  message,
  via = 'crm-inbound-email',
  svixId = null,
  resendEmailId = null,
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
  const deliveryId = String(svixId || '').trim() || null
  const resendId = String(resendEmailId || '').trim() || null

  if (!from || !EMAIL_RE.test(from)) {
    return { status: 400, body: { error: 'Invalid from address' } }
  }
  if (!textBody && !htmlBody) {
    return { status: 400, body: { error: 'Body text or html is required' } }
  }

  if (deliveryId) {
    const bySvix = await findBySvixId(supabaseUrl, serviceKey, deliveryId)
    if (bySvix) {
      return {
        status: 200,
        body: {
          ok: true,
          duplicate: true,
          id: bySvix.id,
          leadId: bySvix.lead_id || null,
          unmatchedId: bySvix.unmatched_id || null,
          via: 'svix_id',
        },
      }
    }
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
  /** @type {string[]} */
  let candidateLeadIds = []

  if (!leadId && (inReplyTo || references)) {
    leadId = await matchLeadByThread(
      supabaseUrl,
      serviceKey,
      inReplyTo,
      references,
    )
  }

  if (!leadId) {
    const match = await matchLeadBySender(supabaseUrl, serviceKey, from)
    if (match.status === 'unique') {
      leadId = match.leadId
    } else if (match.status === 'ambiguous') {
      candidateLeadIds = match.leadIds
      const queued = await queueUnmatched(supabaseUrl, serviceKey, {
        from,
        to,
        subject,
        textBody,
        htmlBody,
        messageId,
        inReplyTo,
        references,
        occurredAt,
        failureCode: 'ambiguous_match',
        resendId,
        deliveryId,
        candidateLeadIds,
        headers,
        via,
      })
      console.info('[crm-inbound-ingest] ambiguous sender queued', {
        from,
        candidates: candidateLeadIds.length,
        unmatchedId: queued?.id || null,
        svixId: deliveryId,
      })
      return {
        status: 200,
        body: {
          ok: true,
          queued: true,
          code: 'ambiguous_match',
          unmatchedId: queued?.id || null,
          candidateLeadIds,
        },
      }
    }
  }

  if (!leadId) {
    const queued = await queueUnmatched(supabaseUrl, serviceKey, {
      from,
      to,
      subject,
      textBody,
      htmlBody,
      messageId,
      inReplyTo,
      references,
      occurredAt,
      failureCode: 'lead_not_found',
      resendId,
      deliveryId,
      candidateLeadIds: [],
      headers,
      via,
    })
    console.info('[crm-inbound-ingest] unmatched queued', {
      from,
      unmatchedId: queued?.id || null,
      svixId: deliveryId,
    })
    return {
      status: 200,
      body: {
        ok: true,
        queued: true,
        code: 'lead_not_found',
        unmatchedId: queued?.id || null,
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
        ...(deliveryId ? { svixId: deliveryId } : {}),
        ...(resendId ? { resendEmailId: resendId } : {}),
      },
    },
  })

  await sbPatch(
    supabaseUrl,
    serviceKey,
    `crm_leads?id=eq.${encodeURIComponent(leadId)}`,
    { updated_at: new Date().toISOString() },
  )

  await insertInboundActivity(supabaseUrl, serviceKey, {
    lead_id: leadId,
    subject: subject || '(no subject)',
    body: `Client reply received from ${from}${to ? ` → ${to}` : ''}.`,
    occurred_at: occurredAt,
  })

  console.info('[crm-inbound-ingest] matched', {
    leadId,
    messageId: row?.id || null,
    svixId: deliveryId,
  })

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

/**
 * @returns {Promise<
 *   | { status: 'unique', leadId: string }
 *   | { status: 'ambiguous', leadIds: string[] }
 *   | { status: 'none' }
 * >}
 */
async function matchLeadBySender(supabaseUrl, key, from) {
  const email = from.toLowerCase()
  try {
    const rows = await sbRpc(supabaseUrl, key, 'crm_find_leads_by_email', {
      p_email: email,
    })
    const ids = Array.isArray(rows)
      ? [
          ...new Set(
            rows
              .map((r) => (r && typeof r === 'object' ? r.id : r))
              .filter((id) => typeof id === 'string' && isUuid(id)),
          ),
        ]
      : []
    if (ids.length === 1) return { status: 'unique', leadId: ids[0] }
    if (ids.length > 1) return { status: 'ambiguous', leadIds: ids }
    return { status: 'none' }
  } catch (err) {
    // Migration not applied yet — fall back to primary email only.
    console.warn(
      '[crm-inbound-ingest] crm_find_leads_by_email unavailable, primary-only fallback',
      err instanceof Error ? err.message : err,
    )
    const byPrimary = await sbGet(
      supabaseUrl,
      key,
      `crm_leads?email=ilike.${encodeURIComponent(email)}&select=id&order=updated_at.desc&limit=2`,
    )
    if (!Array.isArray(byPrimary) || byPrimary.length === 0) {
      return { status: 'none' }
    }
    if (byPrimary.length > 1) {
      return {
        status: 'ambiguous',
        leadIds: byPrimary.map((r) => r.id).filter(Boolean),
      }
    }
    return { status: 'unique', leadId: byPrimary[0].id }
  }
}

async function findBySvixId(supabaseUrl, key, svixId) {
  const encoded = encodeURIComponent(svixId)
  try {
    const messages = await sbGet(
      supabaseUrl,
      key,
      `crm_lead_messages?raw_headers->>svixId=eq.${encoded}&select=id,lead_id&limit=1`,
    )
    if (Array.isArray(messages) && messages[0]?.id) {
      return { id: messages[0].id, lead_id: messages[0].lead_id }
    }
  } catch {
    /* column filter may fail on older schemas — ignore */
  }

  try {
    const unmatched = await sbGet(
      supabaseUrl,
      key,
      `crm_inbound_unmatched?svix_id=eq.${encoded}&select=id&limit=1`,
    )
    if (Array.isArray(unmatched) && unmatched[0]?.id) {
      return { id: unmatched[0].id, unmatched_id: unmatched[0].id }
    }
  } catch {
    /* table may not exist yet */
  }
  return null
}

async function queueUnmatched(supabaseUrl, key, opts) {
  const plain =
    opts.textBody ||
    String(opts.htmlBody || '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50_000)

  const payload = {
    from_email: opts.from,
    to_email: opts.to,
    subject: opts.subject || '(no subject)',
    body_text: plain,
    body_html: opts.htmlBody,
    message_id: opts.messageId,
    in_reply_to: opts.inReplyTo,
    references_header: opts.references || null,
    occurred_at: opts.occurredAt,
    failure_code: opts.failureCode,
    resend_email_id: opts.resendId,
    svix_id: opts.deliveryId,
    candidate_lead_ids: opts.candidateLeadIds || [],
    raw_headers: {
      ...opts.headers,
      inboundVia: opts.via,
      ...(opts.deliveryId ? { svixId: opts.deliveryId } : {}),
      ...(opts.resendId ? { resendEmailId: opts.resendId } : {}),
    },
  }

  try {
    const row = await sbPost(supabaseUrl, key, 'crm_inbound_unmatched', payload)
    return Array.isArray(row) ? row[0] : row
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Duplicate svix/message_id — treat as already queued.
    if (/duplicate|unique|23505/i.test(msg) && opts.deliveryId) {
      const existing = await sbGet(
        supabaseUrl,
        key,
        `crm_inbound_unmatched?svix_id=eq.${encodeURIComponent(opts.deliveryId)}&select=id&limit=1`,
      )
      if (Array.isArray(existing) && existing[0]) return existing[0]
    }
    console.error('[crm-inbound-ingest] queue unmatched failed', msg)
    // Still return 200 upstream — avoid endless Resend retries when table missing.
    return null
  }
}

async function insertInboundActivity(supabaseUrl, key, row) {
  try {
    await sbPost(supabaseUrl, key, 'crm_activities', {
      lead_id: row.lead_id,
      type: 'email',
      subject: String(row.subject || 'Client reply').slice(0, 200),
      body: String(row.body || '').slice(0, 2000),
      occurred_at: row.occurred_at,
      owner_id: null,
    })
  } catch (err) {
    console.error(
      '[crm-inbound-ingest] activity log failed',
      err instanceof Error ? err.message : err,
    )
  }
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

async function sbPost(supabaseUrl, key, table, body) {
  const res = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
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
    throw new Error(msg || `Supabase ${res.status}`)
  }
  return json
}

async function sbRpc(supabaseUrl, key, fn, args) {
  const res = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${fn}`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
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
    throw new Error(msg || `Supabase RPC ${res.status}`)
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
