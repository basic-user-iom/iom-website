/**
 * Shared helpers for blog comment API routes.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { EMAIL_RE, resolveProtonIdentity } from './proton-identities.js'

export { EMAIL_RE }

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'discard.email',
  'maildrop.cc',
  'throwaway.email',
])

/** @type {Map<string, number[]>} */
const rateBuckets = new Map()

export function siteOrigin() {
  return (
    process.env.SITE_ORIGIN ||
    process.env.VITE_SITE_ORIGIN ||
    'https://iobjectm.com'
  ).replace(/\/+$/, '')
}

/** Browser origins allowed to call authenticated CRM APIs (morph, email, …). */
export function isAllowedWebOrigin(origin) {
  const o = String(origin || '').trim()
  if (!o) return false
  const site = siteOrigin()
  if (o === site) return true
  if (o === 'https://www.iobjectm.com') return true
  if (o === 'https://iobjectm.com') return true
  if (/^https:\/\/[a-z0-9-]+(?:-[a-z0-9]+)*\.vercel\.app$/i.test(o)) return true
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o)) return true
  return false
}

/**
 * Reflect only allowlisted origins. Never bare `*` for credentialed CRM calls.
 * @param {import('http').ServerResponse} res
 * @param {string | undefined} origin
 * @param {{ allowAuth?: boolean, methods?: string, allowHeaders?: string }} [opts]
 */
export function setAllowedOriginCors(res, origin, opts = {}) {
  const allowed = isAllowedWebOrigin(origin)
  const acao = allowed ? String(origin) : siteOrigin()
  res.setHeader('Access-Control-Allow-Origin', acao)
  res.setHeader('Vary', 'Origin')
  res.setHeader(
    'Access-Control-Allow-Methods',
    opts.methods || 'GET, POST, OPTIONS',
  )
  res.setHeader(
    'Access-Control-Allow-Headers',
    opts.allowHeaders ||
      (opts.allowAuth ? 'Content-Type, Authorization' : 'Content-Type'),
  )
}

/** Optional comma-separated staff mailbox allowlist (server env). */
export function parseStaffEmailAllowlist() {
  return String(process.env.CRM_STAFF_EMAILS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Interim staff gate until tenant-aware roles exist.
 * Prefer CRM_STAFF_EMAILS; otherwise only @iobjectm.com addresses.
 */
export function isStaffEmail(email) {
  const e = String(email || '')
    .trim()
    .toLowerCase()
  if (!e || !e.includes('@')) return false
  const list = parseStaffEmailAllowlist()
  if (list.length > 0) return list.includes(e)
  return e.endsWith('@iobjectm.com')
}

/**
 * Read Supabase access-token AAL claim (`aal1` / `aal2`) after token verification.
 * @param {string} token
 * @returns {'aal1' | 'aal2' | null}
 */
export function readAccessTokenAal(token) {
  try {
    const part = String(token || '').split('.')[1]
    if (!part) return null
    const json = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
    if (json?.aal === 'aal2') return 'aal2'
    if (json?.aal === 'aal1') return 'aal1'
    return null
  } catch {
    return null
  }
}

/**
 * Verify Supabase access token from Authorization: Bearer …
 * @returns {Promise<{ ok: true, user: { id: string, email?: string }, token: string, aal: 'aal1' | 'aal2' | null } | { ok: false, status: number, error: string, code?: string }>}
 */
export async function requireSupabaseUser(req) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 503, error: 'Auth is not configured', code: 'AUTH_UNAVAILABLE' }
  }
  const authHeader = String(req.headers.authorization || '')
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : ''
  if (!token) {
    return { ok: false, status: 401, error: 'Missing authorization', code: 'AUTH_MISSING' }
  }
  const userRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  })
  if (!userRes.ok) {
    return { ok: false, status: 401, error: 'Invalid or expired session', code: 'AUTH_INVALID' }
  }
  const authUser = await userRes.json().catch(() => null)
  if (!authUser?.id) {
    return { ok: false, status: 401, error: 'Invalid session', code: 'AUTH_INVALID' }
  }
  return {
    ok: true,
    user: { id: String(authUser.id), email: authUser.email || undefined },
    token,
    aal: readAccessTokenAal(token),
  }
}

/**
 * Require a verified Supabase user who is treated as CRM staff.
 * Defaults to MFA (aal2) for privileged staff actions. Pass `{ requireMfa: false }`
 * only for bootstrap flows (e.g. MFA reset / enroll).
 * @param {import('http').IncomingMessage} req
 * @param {{ requireMfa?: boolean }} [opts]
 * @returns {Promise<{ ok: true, user: { id: string, email?: string }, token: string, aal: 'aal1' | 'aal2' | null } | { ok: false, status: number, error: string, code?: string }>}
 */
export async function requireStaffUser(req, opts = {}) {
  const requireMfa = opts.requireMfa !== false
  const auth = await requireSupabaseUser(req)
  if (!auth.ok) return auth
  if (!isStaffEmail(auth.user.email)) {
    return { ok: false, status: 403, error: 'Staff access required', code: 'STAFF_REQUIRED' }
  }
  if (requireMfa && auth.aal !== 'aal2') {
    return {
      ok: false,
      status: 403,
      error: 'Two-factor authentication required',
      code: 'MFA_REQUIRED',
    }
  }
  return auth
}

export function supabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return { url, key: serviceKey || anonKey, hasService: Boolean(serviceKey) }
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}

/** Stable public error payload (SEC-012). Log details server-side only. */
export function publicError(fallback = 'Request failed', code) {
  const body = { error: fallback }
  if (code) body.code = code
  return body
}

/** Secret for short-lived recording media grants (never put passwords in URLs). */
function mediaGrantSecret() {
  const dedicated = String(process.env.CRM_MEDIA_GRANT_SECRET || '').trim()
  if (dedicated) return dedicated
  const fallback = (
    process.env.CRM_CRON_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim()
  if (fallback && !mediaGrantSecret._warned) {
    mediaGrantSecret._warned = true
    console.warn(
      '[media-grant] CRM_MEDIA_GRANT_SECRET unset; using fallback secret. Set a dedicated value in Vercel.',
    )
  }
  return fallback
}

/**
 * Mint an opaque playback grant for a share slug (HMAC, no server store).
 * @param {string} slug
 * @param {number} [ttlSec]
 */
export function mintMediaGrant(slug, ttlSec = 60 * 60 * 2) {
  const secret = mediaGrantSecret()
  if (!secret) throw new Error('Media grant secret is not configured')
  const exp = Math.floor(Date.now() / 1000) + ttlSec
  const payload = Buffer.from(
    JSON.stringify({ s: String(slug), e: exp }),
    'utf8',
  ).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/**
 * Verify a media grant for the expected slug.
 * @param {string} token
 * @param {string} slug
 */
export function verifyMediaGrant(token, slug) {
  const secret = mediaGrantSecret()
  if (!secret || !token || !slug) return false
  const parts = String(token).split('.')
  if (parts.length !== 2) return false
  const [payload, sig] = parts
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  } catch {
    return false
  }
  let data
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return false
  }
  if (data?.s !== slug) return false
  if (typeof data.e !== 'number' || data.e < Math.floor(Date.now() / 1000)) {
    return false
  }
  return true
}

export function newVerifyToken() {
  return randomBytes(32).toString('hex')
}

export function isLightlyValidEmail(email) {
  return EMAIL_RE.test(String(email || '').trim())
}

export function isDisposableEmail(email) {
  const domain = String(email || '')
    .trim()
    .toLowerCase()
    .split('@')[1]
  return Boolean(domain && DISPOSABLE_DOMAINS.has(domain))
}

/**
 * In-memory fallback (per serverless instance).
 * @param {string} key
 * @param {number} max
 * @param {number} windowMs
 */
function rateLimitMemory(key, max = 8, windowMs = 60_000) {
  const now = Date.now()
  const prev = rateBuckets.get(key) || []
  const recent = prev.filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    rateBuckets.set(key, recent)
    return false
  }
  recent.push(now)
  rateBuckets.set(key, recent)
  return true
}

/**
 * Durable rate limit via Supabase when service role is available;
 * falls back to in-memory otherwise.
 * Pass `{ failClosed: true }` on privileged CRM actions so a missing
 * durable limiter rejects instead of degrading to per-instance memory.
 * @param {string} key
 * @param {number} max
 * @param {number} windowMs
 * @param {{ failClosed?: boolean }} [opts]
 * @returns {Promise<boolean>} true if allowed
 */
export async function rateLimit(key, max = 8, windowMs = 60_000, opts = {}) {
  const { url, key: sbKey, hasService } = supabaseConfig()
  const failClosed = Boolean(opts.failClosed)

  if (hasService && url) {
    try {
      const allowed = await sb('rpc/api_rate_limit_take', {
        method: 'POST',
        url,
        key: sbKey,
        body: {
          p_key: String(key).slice(0, 200),
          p_max: max,
          p_window_ms: windowMs,
        },
      })
      if (typeof allowed === 'boolean') return allowed
      if (failClosed) {
        console.error('[rateLimit] durable RPC returned non-boolean; rejecting')
        return false
      }
    } catch (err) {
      if (failClosed) {
        console.error(
          '[rateLimit] durable unavailable; rejecting',
          err instanceof Error ? err.message : err,
        )
        return false
      }
      console.warn(
        '[rateLimit] durable unavailable; using memory',
        err instanceof Error ? err.message : err,
      )
    }
  } else if (failClosed) {
    console.error('[rateLimit] no service role; failClosed reject')
    return false
  }
  return rateLimitMemory(key, max, windowMs)
}

export function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return xf || String(req.headers['x-real-ip'] || '') || 'unknown'
}

export function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * @param {string} path e.g. "blog_posts?slug=eq.foo"
 */
export async function sb(path, { method = 'GET', body, key, url, prefer } = {}) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
  if (prefer) headers.Prefer = prefer
  else if (method === 'POST' || method === 'PATCH') headers.Prefer = 'return=representation'

  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const msg = json?.message || json?.error_description || text.slice(0, 240)
    throw new Error(msg || `Supabase ${res.status}`)
  }
  return json
}

export function contactIdentity() {
  return resolveProtonIdentity('contact')
}
