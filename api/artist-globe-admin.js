/**
 * Artist Globe admin API — approve / reject / list.
 * Auth: Authorization Bearer <Supabase staff JWT>
 * Staff = CRM_STAFF_EMAILS allowlist, or *@iobjectm.com when unset.
 * Uses service role when available.
 */

import {
  clientIp,
  publicError,
  rateLimit,
  requireStaffUser,
  setAllowedOriginCors,
  safeJson,
  supabaseConfig,
} from './_lib/blog-helpers.js'

function slugify(name) {
  return (
    String(name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'artist'
  )
}

function token() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sb(path, { method = 'GET', body, key, url } = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
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

export default async function handler(req, res) {
  setAllowedOriginCors(res, req.headers.origin, {
    allowAuth: true,
    methods: 'POST, OPTIONS',
  })

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json(publicError('Method not allowed', 'METHOD_NOT_ALLOWED'))
  }

  const auth = await requireStaffUser(req)
  if (!auth.ok) {
    return res.status(auth.status).json(publicError(auth.error, auth.code))
  }

  if (
    !(await rateLimit(`artist-admin:${auth.user.id}:${clientIp(req)}`, 60, 60_000, {
      failClosed: true,
    }))
  ) {
    return res.status(429).json(publicError('Too many requests. Try again later.', 'RATE_LIMIT'))
  }

  const { url, key, hasService } = supabaseConfig()
  if (!url || !key) {
    return res.status(503).json(publicError('Admin API is unavailable', 'ADMIN_UNAVAILABLE'))
  }
  if (!hasService) {
    return res
      .status(503)
      .json(publicError('Admin API is unavailable', 'ADMIN_SERVICE_MISSING'))
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (!body || typeof body !== 'object') {
    return res.status(400).json(publicError('Invalid body', 'INVALID_BODY'))
  }

  const action = String(body.action || '')

  try {
    if (action === 'list_submissions') {
      const rows = await sb(
        'artist_globe_submissions?select=*&order=created_at.desc',
        { url, key },
      )
      return res.status(200).json({ submissions: rows || [] })
    }

    if (action === 'list_artists') {
      const rows = await sb('artist_globe_artists?select=*&order=created_at.desc', {
        url,
        key,
      })
      return res.status(200).json({ artists: rows || [] })
    }

    if (action === 'reject') {
      const submissionId = String(body.submissionId || '')
      const reason = String(body.reason || '').slice(0, 500)
      if (!submissionId) {
        return res.status(400).json(publicError('submissionId required', 'SUBMISSION_REQUIRED'))
      }
      await sb(`artist_globe_submissions?id=eq.${encodeURIComponent(submissionId)}`, {
        method: 'PATCH',
        url,
        key,
        body: { status: 'rejected', reject_reason: reason },
      })
      return res.status(200).json({ ok: true })
    }

    if (action === 'toggle_status') {
      const artistId = String(body.artistId || '')
      if (!artistId) {
        return res.status(400).json(publicError('artistId required', 'ARTIST_REQUIRED'))
      }
      const rows = await sb(
        `artist_globe_artists?id=eq.${encodeURIComponent(artistId)}&select=*`,
        { url, key },
      )
      const artist = Array.isArray(rows) ? rows[0] : null
      if (!artist) return res.status(404).json(publicError('Artist not found', 'NOT_FOUND'))
      const next = artist.status === 'live' ? 'hidden' : 'live'
      await sb(`artist_globe_artists?id=eq.${encodeURIComponent(artistId)}`, {
        method: 'PATCH',
        url,
        key,
        body: { status: next, updated_at: new Date().toISOString() },
      })
      return res.status(200).json({ ok: true, status: next })
    }

    if (action === 'approve') {
      const submissionId = String(body.submissionId || '')
      if (!submissionId) {
        return res.status(400).json(publicError('submissionId required', 'SUBMISSION_REQUIRED'))
      }

      const rows = await sb(
        `artist_globe_submissions?id=eq.${encodeURIComponent(submissionId)}&select=*`,
        { url, key },
      )
      const sub = Array.isArray(rows) ? rows[0] : null
      if (!sub) return res.status(404).json(publicError('Submission not found', 'NOT_FOUND'))
      if (sub.status !== 'pending') {
        return res.status(400).json(publicError('Submission already handled', 'ALREADY_HANDLED'))
      }

      let slug = slugify(sub.display_name)
      let n = 2
      for (;;) {
        const existing = await sb(
          `artist_globe_artists?slug=eq.${encodeURIComponent(slug)}&select=id`,
          { url, key },
        )
        if (!existing || existing.length === 0) break
        slug = `${slugify(sub.display_name)}-${n++}`
      }

      const artistRows = await sb('artist_globe_artists', {
        method: 'POST',
        url,
        key,
        body: {
          slug,
          display_name: sub.display_name,
          email: sub.email,
          category: sub.category,
          tags: sub.tags || [],
          bio: sub.bio || '',
          links: sub.links || {},
          city: sub.city || '',
          country: sub.country || '',
          lat: sub.lat,
          lon: sub.lon,
          timezone: sub.timezone || 'UTC',
          avatar_url: sub.avatar_url || '',
          portfolio: [],
          status: 'live',
        },
      })
      const artist = Array.isArray(artistRows) ? artistRows[0] : artistRows
      if (!artist?.id) throw new Error('Failed to create artist')

      const inviteToken = token()
      const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      await sb('artist_globe_invites', {
        method: 'POST',
        url,
        key,
        body: {
          token: inviteToken,
          artist_id: artist.id,
          submission_id: sub.id,
          email: sub.email,
          expires_at: expires,
        },
      })

      await sb(`artist_globe_submissions?id=eq.${encodeURIComponent(submissionId)}`, {
        method: 'PATCH',
        url,
        key,
        body: { status: 'approved' },
      })

      const origin =
        String(req.headers.origin || '') ||
        process.env.ARTIST_GLOBE_PUBLIC_ORIGIN ||
        'https://iobjectm.com'
      const inviteUrl = `${origin.replace(/\/$/, '')}/artist-globe/invite/${inviteToken}`
      return res.status(200).json({ ok: true, inviteUrl, inviteToken })
    }

    return res.status(400).json(publicError('Unknown action', 'UNKNOWN_ACTION'))
  } catch (err) {
    console.error('[artist-globe-admin]', err instanceof Error ? err.message : err)
    return res.status(500).json(publicError('Admin action failed', 'ADMIN_FAILED'))
  }
}
