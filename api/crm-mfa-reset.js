/**
 * Staff self-service: clear own TOTP factors so a new QR can be enrolled.
 * Auth: Bearer staff JWT at aal2 only (password-only aal1 must not delete factors).
 * Uses service role admin MFA delete — only for the authenticated user.
 */

import {
  publicError,
  rateLimit,
  requireStaffUser,
  setAllowedOriginCors,
  supabaseConfig,
} from './_lib/blog-helpers.js'

/**
 * @param {string} url
 * @param {string} serviceKey
 * @param {string} userId
 */
async function listFactors(url, serviceKey, userId) {
  const res = await fetch(
    `${url.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(userId)}/factors`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
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
    const msg = json?.msg || json?.message || text.slice(0, 200)
    throw new Error(msg || `List factors failed (${res.status})`)
  }
  // GoTrue may return { factors: [...] } or a bare array.
  if (Array.isArray(json)) return json
  if (Array.isArray(json?.factors)) return json.factors
  return []
}

/**
 * @param {string} url
 * @param {string} serviceKey
 * @param {string} userId
 * @param {string} factorId
 */
async function deleteFactor(url, serviceKey, userId, factorId) {
  const res = await fetch(
    `${url.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(userId)}/factors/${encodeURIComponent(factorId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    },
  )
  if (res.ok || res.status === 404) return
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  const msg = json?.msg || json?.message || text.slice(0, 200)
  throw new Error(msg || `Delete factor failed (${res.status})`)
}

export default async function handler(req, res) {
  setAllowedOriginCors(res, req.headers.origin, {
    allowAuth: true,
    methods: 'POST, OPTIONS',
  })

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json(publicError('Method not allowed'))
  }

  // Routine factor replacement requires a recent aal2 session (SEC-R3).
  const auth = await requireStaffUser(req)
  if (!auth.ok) {
    return res.status(auth.status).json(publicError(auth.error, auth.code))
  }

  if (
    !(await rateLimit(`crm-mfa-reset:${auth.user.id}`, 5, 15 * 60_000, {
      failClosed: true,
    }))
  ) {
    return res.status(429).json(publicError('Too many requests. Try again later.', 'RATE_LIMIT'))
  }

  const { url, key, hasService } = supabaseConfig()
  if (!url || !hasService || !key) {
    return res
      .status(503)
      .json(publicError('MFA reset is unavailable (service role missing).'))
  }

  try {
    const factors = await listFactors(url, key, auth.user.id)
    const totp = factors.filter(
      (f) =>
        f &&
        (f.factor_type === 'totp' || f.factorType === 'totp' || !f.factor_type),
    )
    for (const factor of totp) {
      const id = factor.id || factor.factor_id
      if (!id) continue
      await deleteFactor(url, key, auth.user.id, String(id))
    }
    return res.status(200).json({ ok: true, removed: totp.length })
  } catch (err) {
    console.warn('[crm-mfa-reset]', err instanceof Error ? err.message : err)
    return res.status(500).json(publicError('Could not reset authenticator.'))
  }
}
