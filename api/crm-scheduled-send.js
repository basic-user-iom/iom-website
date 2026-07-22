/**
 * Process due scheduled initial outreach sends.
 * Vercel cron + staff ping from CRM UI.
 *
 * GET|POST /api/crm-scheduled-send
 * Auth (either):
 *   - Bearer <CRM_CRON_SECRET|CRON_SECRET>  (or x-cron-secret)
 *   - Bearer <Supabase user access token>   (signed-in CRM staff)
 *
 * Env: CRM_CRON_SECRET / CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY,
 *      VITE_SUPABASE_URL / SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *      Proton SMTP vars.
 */

import { processDueScheduledSends } from './_lib/crm-process-scheduled-sends.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-cron-secret',
  )

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await authorizeRequest(req)
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error })
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

  try {
    const result = await processDueScheduledSends({ supabaseUrl, serviceKey })
    return res.status(200).json({
      ...result,
      trigger: auth.mode,
    })
  } catch (err) {
    console.error('[crm-scheduled-send] process failed', err)
    return res.status(502).json({
      error: 'Failed to process scheduled sends',
      detail: err instanceof Error ? err.message.slice(0, 200) : 'Unknown',
    })
  }
}

async function authorizeRequest(req) {
  const authHeader = String(req.headers.authorization || '')
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const headerSecret = String(req.headers['x-cron-secret'] || '').trim()

  const cronSecret = (
    process.env.CRM_CRON_SECRET ||
    process.env.CRON_SECRET ||
    ''
  ).trim()

  if (cronSecret) {
    const provided = bearer || headerSecret
    if (provided && provided === cronSecret) {
      return { ok: true, mode: 'cron' }
    }
  }

  // Staff ping: validate Supabase JWT (do not expose cron secret to the browser).
  if (bearer && bearer !== cronSecret) {
    const supabaseUrl = (
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ''
    ).replace(/\/$/, '')
    const anonKey =
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
    if (!supabaseUrl || !anonKey) {
      return { ok: false, status: 503, error: 'Auth is not configured' }
    }
    try {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${bearer}`,
          apikey: anonKey,
        },
      })
      if (userRes.ok) {
        const user = await userRes.json()
        if (user?.id) return { ok: true, mode: 'staff', userId: user.id }
      }
    } catch (err) {
      console.error('[crm-scheduled-send] user auth failed', err)
    }
  }

  if (!cronSecret) {
    return {
      ok: false,
      status: 503,
      error: 'CRM_CRON_SECRET (or CRON_SECRET) is not configured',
    }
  }
  return { ok: false, status: 401, error: 'Unauthorized' }
}
