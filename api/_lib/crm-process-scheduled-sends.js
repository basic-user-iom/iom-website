/**
 * Process due scheduled initial outreach sends (one lead at a time).
 * Failures on one lead never abort the rest of the batch.
 */

import {
  notifyScheduledSendFailure,
  sendCrmOutreachEmail,
} from './crm-send-outreach.js'

const MAX_ATTEMPTS = 5
const MAX_PER_RUN = 25
/** Skip leads another worker claimed within this window. */
const LOCK_STALE_MS = 2 * 60 * 1000

/**
 * @param {{ supabaseUrl: string, serviceKey: string }} opts
 */
export async function processDueScheduledSends(opts) {
  const { supabaseUrl, serviceKey } = opts
  const nowIso = new Date().toISOString()
  const now = Date.now()

  const url =
    `${supabaseUrl}/rest/v1/crm_leads` +
    `?select=id,company_name,contact_name,email,status,owner_id,owner_email,` +
    `initial_email_subject,initial_email_body,initial_email_drafted_at,initial_email_sent_at,` +
    `contact_priority,scheduled_send` +
    `&scheduled_send=not.is.null` +
    `&initial_email_sent_at=is.null` +
    `&limit=100`

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
  const rows = Array.isArray(json) ? json : []

  const due = rows
    .map((row) => ({ row, schedule: normalizeSchedule(row.scheduled_send) }))
    .filter(({ schedule, row }) => {
      if (!schedule) return false
      if (row.initial_email_sent_at) return false
      if (schedule.attempts >= MAX_ATTEMPTS) return false
      if (new Date(schedule.at).getTime() > now) return false
      if (schedule.lock) {
        const lockAt = new Date(schedule.lock).getTime()
        if (Number.isFinite(lockAt) && now - lockAt < LOCK_STALE_MS) return false
      }
      return true
    })
    .slice(0, MAX_PER_RUN)

  const results = []
  for (const { row, schedule } of due) {
    // Isolate each lead — never break the loop on one failure.
    try {
      const claimed = await claimLead(supabaseUrl, serviceKey, row, schedule)
      if (!claimed) {
        results.push({ id: row.id, ok: false, skipped: true, reason: 'claimed_by_other' })
        continue
      }

      const subject = String(row.initial_email_subject || '').trim()
      const body = String(row.initial_email_body || '').trim()
      const to = schedule.to || String(row.email || '').trim().toLowerCase()
      const company = row.company_name || row.contact_name || row.id

      if (!subject || !body || !to) {
        const error = 'Missing subject, body, or recipient for scheduled send'
        await patchLeadSchedule(supabaseUrl, serviceKey, row.id, {
          at: schedule.at,
          to: schedule.to,
          from: schedule.from,
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
        await patchLeadSchedule(supabaseUrl, serviceKey, row.id, {
          at: schedule.at,
          to: schedule.to,
          from: schedule.from,
          error,
          attempts,
        })
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
    } catch (err) {
      console.error('[crm-process-scheduled-sends] lead failed', row.id, err)
      results.push({
        id: row.id,
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 200) : 'Lead processing failed',
      })
    }
  }

  const sent = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok && !r.skipped).length

  return {
    ok: true,
    checked: rows.length,
    due: due.length,
    processed: results.length,
    sent,
    failed,
    results,
    at: nowIso,
  }
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
  const lock = typeof raw.lock === 'string' ? raw.lock.trim() : ''
  return {
    at: when.toISOString(),
    to,
    from,
    error: typeof raw.error === 'string' ? raw.error : '',
    attempts,
    lock,
  }
}

/**
 * Claim one lead for this worker so concurrent pings do not double-send.
 * Other due leads are unaffected.
 */
async function claimLead(supabaseUrl, serviceKey, row, schedule) {
  const lock = new Date().toISOString()
  const stale = new Date(Date.now() - LOCK_STALE_MS).toISOString()
  const next = {
    at: schedule.at,
    to: schedule.to,
    from: schedule.from,
    error: schedule.error || '',
    attempts: schedule.attempts,
    lock,
  }
  const atEnc = encodeURIComponent(schedule.at)
  // Only claim if unlocked or lock is stale — concurrent workers skip this lead,
  // but keep processing every other due lead in their batch.
  const res = await fetch(
    `${supabaseUrl}/rest/v1/crm_leads` +
      `?id=eq.${encodeURIComponent(row.id)}` +
      `&initial_email_sent_at=is.null` +
      `&scheduled_send->>at=eq.${atEnc}` +
      `&or=(scheduled_send->>lock.is.null,scheduled_send->>lock.lt.${encodeURIComponent(stale)})`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        scheduled_send: next,
        updated_at: lock,
      }),
    },
  )
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text.slice(0, 240) || `Claim failed ${res.status}`)
  }
  const rows = text ? JSON.parse(text) : []
  return Array.isArray(rows) && rows.length > 0
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

async function patchLeadSchedule(supabaseUrl, serviceKey, id, schedule) {
  await patchLead(supabaseUrl, serviceKey, id, {
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
    console.error('[crm-process-scheduled-sends] activity log failed', err)
  }
}

async function safeNotify(opts) {
  try {
    await notifyScheduledSendFailure(opts)
  } catch (err) {
    console.error('[crm-process-scheduled-sends] notify failed', err)
  }
}
