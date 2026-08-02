/**
 * Process due scheduled initial outreach sends.
 * Vercel cron + staff ping from CRM UI.
 *
 * GET|POST /api/crm-scheduled-send
 * Auth (either):
 *   - Bearer <CRM_CRON_SECRET|CRON_SECRET>  (or x-cron-secret)
 *   - Bearer <Supabase staff access token>  (signed-in @iobjectm.com / CRM_STAFF_EMAILS)
 *
 * Env: CRM_CRON_SECRET / CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY,
 *      VITE_SUPABASE_URL / SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *      Proton SMTP vars. Optional: CRM_STAFF_EMAILS.
 */

import { requireStaffUser, setAllowedOriginCors } from './_lib/blog-helpers.js'
import { processDueScheduledSends } from './_lib/crm-process-scheduled-sends.js'

export default async function handler(req, res) {
  setAllowedOriginCors(res, req.headers.origin, {
    allowAuth: true,
    methods: 'GET, POST, OPTIONS',
    allowHeaders: 'Content-Type, Authorization, x-cron-secret',
  })

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

  // Staff ping: validate Supabase JWT + staff email (do not expose cron secret).
  if (bearer && bearer !== cronSecret) {
    const staff = await requireStaffUser(req)
    if (staff.ok) {
      return { ok: true, mode: 'staff', userId: staff.user.id }
    }
    return { ok: false, status: staff.status, error: staff.error }
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
