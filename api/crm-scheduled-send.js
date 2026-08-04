/**
 * Process due scheduled initial outreach sends.
 * Vercel cron + staff ping from CRM UI (+ optional free external ~5 min cron).
 *
 * GET|POST /api/crm-scheduled-send
 * GET|POST /api/crm-scheduled-send?health=1  → config booleans only
 * Auth (either):
 *   - Bearer <CRON_SECRET|CRM_CRON_SECRET>  (or x-cron-secret) — either value accepted
 *   - Bearer <Supabase staff access token>  (signed-in @iobjectm.com / CRM_STAFF_EMAILS)
 *
 * Env: CRON_SECRET / CRM_CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY,
 *      VITE_SUPABASE_URL / SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *      Proton SMTP vars. Optional: CRM_STAFF_EMAILS.
 */

import {
  clientIp,
  publicError,
  rateLimit,
  requireStaffUser,
  setAllowedOriginCors,
} from './_lib/blog-helpers.js'
import { processDueScheduledSends } from './_lib/crm-process-scheduled-sends.js'
import { listProtonIdentities } from './_lib/proton-identities.js'

let warnedCronSecretMismatch = false

export default async function handler(req, res) {
  setAllowedOriginCors(res, req.headers.origin, {
    allowAuth: true,
    methods: 'GET, POST, OPTIONS',
    allowHeaders: 'Content-Type, Authorization, x-cron-secret',
  })

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json(publicError('Method not allowed', 'METHOD_NOT_ALLOWED'))
  }

  const auth = await authorizeRequest(req)
  if (!auth.ok) {
    return res.status(auth.status).json(publicError(auth.error, auth.code))
  }

  if (auth.mode === 'staff') {
    if (
      !(await rateLimit(`crm-scheduled-send:${auth.userId}:${clientIp(req)}`, 20, 60_000, {
        failClosed: true,
      }))
    ) {
      return res.status(429).json(publicError('Too many requests. Try again later.', 'RATE_LIMIT'))
    }
  }

  const healthOnly =
    String(req.query?.health || '') === '1' ||
    String(req.query?.health || '').toLowerCase() === 'true'

  if (healthOnly) {
    return res.status(200).json({
      ok: true,
      health: buildSchedulerHealth(),
      trigger: auth.mode,
    })
  }

  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).replace(/\/$/, '')
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!supabaseUrl || !serviceKey) {
    return res
      .status(503)
      .json(publicError('Scheduled send is not configured', 'SCHEDULE_UNAVAILABLE'))
  }

  try {
    const result = await processDueScheduledSends({ supabaseUrl, serviceKey })
    return res.status(200).json({
      ...result,
      health: buildSchedulerHealth(),
      trigger: auth.mode,
    })
  } catch (err) {
    console.error('[crm-scheduled-send] process failed', err)
    return res.status(502).json(publicError('Failed to process scheduled sends', 'SCHEDULE_FAILED'))
  }
}

function buildSchedulerHealth() {
  const identities = listProtonIdentities()
  const byId = Object.fromEntries(identities.map((i) => [i.id, i.configured]))
  const crm = (process.env.CRM_CRON_SECRET || '').trim()
  const cron = (process.env.CRON_SECRET || '').trim()
  return {
    hasCronSecret: Boolean(crm || cron),
    hasServiceRole: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
    ),
    hasSupabaseUrl: Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
    hasContactSmtp: Boolean(byId.contact),
    hasVisualSmtp: Boolean(byId.visual),
    hasProjectsSmtp: Boolean(byId.projects),
  }
}

/**
 * Accept either CRM_CRON_SECRET or CRON_SECRET (Vercel Cron uses CRON_SECRET).
 * Prefer matching either so a mismatched pair does not lock out the daily cron.
 */
function resolveCronSecrets() {
  const crm = (process.env.CRM_CRON_SECRET || '').trim()
  const cron = (process.env.CRON_SECRET || '').trim()
  if (crm && cron && crm !== cron && !warnedCronSecretMismatch) {
    warnedCronSecretMismatch = true
    console.warn(
      '[crm-scheduled-send] CRM_CRON_SECRET and CRON_SECRET both set but differ — accepting either; set them equal or keep only one',
    )
  }
  const secrets = []
  if (crm) secrets.push(crm)
  if (cron && cron !== crm) secrets.push(cron)
  return secrets
}

async function authorizeRequest(req) {
  const authHeader = String(req.headers.authorization || '')
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const headerSecret = String(req.headers['x-cron-secret'] || '').trim()
  const provided = bearer || headerSecret
  const cronSecrets = resolveCronSecrets()

  if (provided && cronSecrets.some((s) => s === provided)) {
    return { ok: true, mode: 'cron' }
  }

  // Staff ping: JWT + staff email + MFA (do not expose cron secret).
  if (bearer && !cronSecrets.includes(bearer)) {
    const staff = await requireStaffUser(req)
    if (staff.ok) {
      return { ok: true, mode: 'staff', userId: staff.user.id }
    }
    return {
      ok: false,
      status: staff.status,
      error: staff.error,
      code: staff.code,
    }
  }

  if (!cronSecrets.length) {
    return {
      ok: false,
      status: 503,
      error: 'Scheduled send is not configured',
      code: 'CRON_UNAVAILABLE',
    }
  }
  return { ok: false, status: 401, error: 'Unauthorized', code: 'UNAUTHORIZED' }
}
