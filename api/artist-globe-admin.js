/**
 * Artist Globe admin API — approve / reject / list.
 * Auth: header X-Artist-Globe-Admin must match ARTIST_GLOBE_ADMIN_PASSWORD
 * (or VITE_ARTIST_GLOBE_ADMIN_PASSWORD). Uses service role when available.
 */

function adminPassword() {
  return (
    process.env.ARTIST_GLOBE_ADMIN_PASSWORD ||
    process.env.VITE_ARTIST_GLOBE_ADMIN_PASSWORD ||
    'iom-globe-admin'
  )
}

function supabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return { url, key: serviceKey || anonKey, hasService: Boolean(serviceKey) }
}

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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Artist-Globe-Admin')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const provided = String(req.headers['x-artist-globe-admin'] || '')
  if (!provided || provided !== adminPassword()) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { url, key, hasService } = supabaseConfig()
  if (!url || !key) {
    return res.status(503).json({
      error: 'Supabase not configured — use local demo store in the browser.',
    })
  }
  if (!hasService) {
    return res.status(503).json({
      error:
        'SUPABASE_SERVICE_ROLE_KEY required for admin actions. Browser falls back to local store.',
    })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid body' })

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
      if (!submissionId) return res.status(400).json({ error: 'submissionId required' })
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
      if (!artistId) return res.status(400).json({ error: 'artistId required' })
      const rows = await sb(
        `artist_globe_artists?id=eq.${encodeURIComponent(artistId)}&select=*`,
        { url, key },
      )
      const artist = Array.isArray(rows) ? rows[0] : null
      if (!artist) return res.status(404).json({ error: 'Artist not found' })
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
      if (!submissionId) return res.status(400).json({ error: 'submissionId required' })

      const rows = await sb(
        `artist_globe_submissions?id=eq.${encodeURIComponent(submissionId)}&select=*`,
        { url, key },
      )
      const sub = Array.isArray(rows) ? rows[0] : null
      if (!sub) return res.status(404).json({ error: 'Submission not found' })
      if (sub.status !== 'pending') {
        return res.status(400).json({ error: 'Submission already handled' })
      }

      let slug = slugify(sub.display_name)
      let n = 2
      // ensure unique slug
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

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('[artist-globe-admin]', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' })
  }
}

function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
