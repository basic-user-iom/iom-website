/**
 * Process due scheduled initial outreach sends.
 * Vercel cron + manual trigger.
 *
 * GET|POST /api/crm-scheduled-send
 * Authorization: Bearer <CRM_CRON_SECRET>
 *   or header x-cron-secret: <CRM_CRON_SECRET>
 *
 * Env: CRM_CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL / SUPABASE_URL,
 *      Proton SMTP vars (same as crm-send-email).
 */

import {
  notifyScheduledSendFailure,
  sendCrmOutreachEmail,
} from './_lib/crm-send-outreach.js'

const MAX_ATTEMPTS = 5
const MAX_PER_RUN = 15

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Prefer CRM_CRON_SECRET; Vercel also injects Authorization when CRON_SECRET is set.
  const cronSecret = (
    process.env.CRM_CRON_SECRET ||
    process.env.CRON_SECRET ||
    ''
  ).trim()
  if (!cronSecret) {
    return res.status(503).json({
      error: 'CRM_CRON_SECRET (or CRON_SECRET) is not configured',
    })
  }

  const authHeader = String(req.headers.authorization || '')
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const headerSecret = String(req.headers['x-cron-secret'] || '').trim()
  const provided = bearer || headerSecret
  if (!provided || provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).replace(/\/$/, '')
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY and Supabase URL required',
    })
  }

  const nowIso = new Date().toISOString()
  let rows = []
  try {
    // Fetch armed schedules; filter due in JS (jsonb timestamp compare is awkward in REST).
    const url =
      `${supabaseUrl}/rest/v1/crm_leads` +
      `?select=id,company_name,contact_name,email,status,owner_id,owner_email,` +
      `initial_email_subject,initial_email_body,initial_email_drafted_at,initial_email_sent_at,` +
      `contact_priority,scheduled_send` +
      `&scheduled_send=not.is.null` +
      `&initial_email_sent_at=is.null` +
      `&limit=80`
    const listRes = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    })
    const text = await listRes.text()
    const json = text ? JSON.parse(text) : []
    if (!listRes.ok) {
      throw new Error(json?.message || text.slice(0, 240) || `Supabase ${listRes.status}`)
    }
    rows = Array.isArray(json) ? json : []
  } catch (err) {
    console.error('[crm-scheduled-send] list failed', err)
    return res.status(502).json({
      error: 'Failed to load scheduled leads',
      detail: err instanceof Error ? err.message.slice(0, 200) : 'Unknown',
    })
  }

  const due = rows
    .map((row) => ({ row, schedule: normalizeSchedule(row.scheduled_send) }))
    .filter(({ schedule, row }) => {
      if (!schedule) return false
      if (row.initial_email_sent_at) return false
      if (schedule.attempts >= MAX_ATTEMPTS) return false
      return new Date(schedule.at).getTime() <= Date.now()
    })
    .slice(0, MAX_PER_RUN)

  const results = []
  for (const { row, schedule } of due) {
    const subject = String(row.initial_email_subject || '').trim()
    const body = String(row.initial_email_body || '').trim()
    const to = schedule.to || String(row.email || '').trim().toLowerCase()
    const company = row.company_name || row.contact_name || row.id

    if (!subject || !body || !to) {
      const error = 'Missing subject, body, or recipient for scheduled send'
      await patchLeadSchedule(supabaseUrl, serviceKey, row, {
        ...schedule,
        error,
        attempts: schedule.attempts + 1,
      })
      await safeNotify({
        toStaff: row.owner_email,
        company,
        leadId: row.id,
        error,
        clientTo: to,
      })
      results.push({ id: row.id, ok: false, error })
      continue
    }

    try {
      const sendResult = await sendCrmOutreachEmail({
        to,
        subject,
        body,
        leadId: row.id,
        fromIdentity: schedule.from || 'contact',
        supabaseUrl,
        serviceKey,
        ownerId: row.owner_id || null,
        persistMessage: true,
      })

      const stamp = nowIso
      await patchLead(supabaseUrl, serviceKey, row.id, {
        initial_email_sent_at: stamp,
        initial_email_drafted_at: row.initial_email_drafted_at || stamp,
        contact_priority: false,
        scheduled_send: null,
        status: row.status === 'new' ? 'contacted' : row.status,
        updated_at: stamp,
      })

      await insertActivity(supabaseUrl, serviceKey, {
        lead_id: row.id,
        type: 'email',
        subject: subject.slice(0, 200) || 'Initial outreach email sent',
        body: `Scheduled outreach sent automatically via CRM to ${to} from ${sendResult.from}.`,
        occurred_at: stamp,
        owner_id: row.owner_id || null,
      })

      results.push({ id: row.id, ok: true, to, messageId: sendResult.messageId })
    } catch (err) {
      const error = err instanceof Error ? err.message.slice(0, 400) : 'Send failed'
      const attempts = schedule.attempts + 1
      const nextSchedule = {
        ...schedule,
        error,
        attempts,
      }
      // After max attempts, keep error but leave schedule so UI shows failure;
      // cron skips further tries via attempts check.
      await patchLeadSchedule(supabaseUrl, serviceKey, row, nextSchedule)
      await safeNotify({
        toStaff: row.owner_email,
        company,
        leadId: row.id,
        error:
          attempts >= MAX_ATTEMPTS
            ? `${error} (gave up after ${MAX_ATTEMPTS} attempts — send manually)`
            : error,
        clientTo: to,
      })
      results.push({ id: row.id, ok: false, error, attempts })
    }
  }

  return res.status(200).json({
    ok: true,
    checked: rows.length,
    due: due.length,
    processed: results.length,
    results,
    at: nowIso,
  })
}

function normalizeSchedule(raw) {
  if (!raw || typeof raw !== 'object') return null
  const at = typeof raw.at === 'string' ? raw.at.trim() : ''
  const to = typeof raw.to === 'string' ? raw.to.trim().toLowerCase() : ''
  if (!at || !to) return null
  const when = new Date(at)
  if (Number.isNaN(when.getTime())) return null
  const from =
    raw.from === 'visual' || raw.from === 'projects' || raw.from === 'contact'
      ? raw.from
      : 'contact'
  const attempts =
    typeof raw.attempts === 'number' && Number.isFinite(raw.attempts)
      ? Math.max(0, Math.floor(raw.attempts))
      : 0
  return {
    at: when.toISOString(),
    to,
    from,
    error: typeof raw.error === 'string' ? raw.error : '',
    attempts,
  }
}

async function patchLead(supabaseUrl, serviceKey, id, patch) {
  const res = await fetch(`${supabaseUrl}/rest/v1/crm_leads?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text.slice(0, 240) || `Patch failed ${res.status}`)
  }
}

async function patchLeadSchedule(supabaseUrl, serviceKey, row, schedule) {
  await patchLead(supabaseUrl, serviceKey, row.id, {
    scheduled_send: schedule,
    updated_at: new Date().toISOString(),
  })
}

async function insertActivity(supabaseUrl, serviceKey, row) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/crm_activities`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    })
  } catch (err) {
    console.error('[crm-scheduled-send] activity log failed', err)
  }
}

async function safeNotify(opts) {
  try {
    await notifyScheduledSendFailure(opts)
  } catch (err) {
    console.error('[crm-scheduled-send] notify failed', err)
  }
}
