/**
 * Public share unlock for CRM screen recordings.
 * GET  ?slug=  → metadata (title, has_password, …)
 * POST { slug, password? } → { title, playbackUrl, mimeType }
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY to mint signed Storage URLs after unlock RPC.
 */

import {
  clientIp,
  rateLimit,
  safeJson,
  sb,
  supabaseConfig,
} from './lib/blog-helpers.js'

const BUCKET = 'crm-screen-recordings'
const SIGNED_SECONDS = 60 * 60 * 2

function cors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

async function createSignedUrl(url, key, path) {
  const res = await fetch(
    `${url.replace(/\/$/, '')}/storage/v1/object/sign/${BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: SIGNED_SECONDS }),
    },
  )
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.signedURL) {
    throw new Error(json?.message || 'Could not create signed URL')
  }
  const signed = String(json.signedURL)
  if (signed.startsWith('http')) return signed
  return `${url.replace(/\/$/, '')}/storage/v1${signed.startsWith('/') ? '' : '/'}${signed}`
}

export default async function handler(req, res) {
  cors(res, req.headers.origin)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const { url, key, hasService } = supabaseConfig()
  if (!url || !key) {
    return res.status(503).json({ error: 'Storage is not configured' })
  }

  const ip = clientIp(req)

  if (req.method === 'GET') {
    if (!rateLimit(`rec-meta:${ip}`, 60, 60_000)) {
      return res.status(429).json({ error: 'Too many requests' })
    }
    const slug = String(req.query?.slug || '').trim()
    if (!slug) return res.status(400).json({ error: 'Missing slug' })

    try {
      const rows = await sb(
        `rpc/crm_recording_share_meta`,
        {
          method: 'POST',
          body: { p_slug: slug },
          url,
          key,
        },
      )
      const row = Array.isArray(rows) ? rows[0] : null
      if (!row) return res.status(404).json({ error: 'Recording not found' })
      return res.status(200).json({
        id: row.id,
        title: row.title,
        mimeType: row.mime_type,
        durationMs: row.duration_ms,
        hasPassword: Boolean(row.has_password),
        createdAt: row.created_at,
      })
    } catch (err) {
      console.error('[crm-recording-share GET]', err)
      return res.status(500).json({ error: 'Lookup failed' })
    }
  }

  if (req.method === 'POST') {
    if (!rateLimit(`rec-unlock:${ip}`, 20, 60_000)) {
      return res.status(429).json({ error: 'Too many unlock attempts' })
    }
    if (!hasService) {
      return res.status(503).json({
        error: 'Share unlock requires SUPABASE_SERVICE_ROLE_KEY',
      })
    }

    const payload = typeof req.body === 'string' ? safeJson(req.body) : req.body
    const slug = String(payload?.slug || '').trim()
    const password = String(payload?.password || '')
    if (!slug) return res.status(400).json({ error: 'Missing slug' })

    try {
      const rows = await sb(`rpc/crm_recording_unlock`, {
        method: 'POST',
        body: { p_slug: slug, p_password: password },
        url,
        key,
      })
      const row = Array.isArray(rows) ? rows[0] : null
      if (!row) {
        return res.status(401).json({ error: 'Wrong password or not found' })
      }

      const playbackUrl = await createSignedUrl(url, key, row.storage_path)
      return res.status(200).json({
        id: row.id,
        title: row.title,
        mimeType: row.mime_type,
        durationMs: row.duration_ms,
        playbackUrl,
      })
    } catch (err) {
      console.error('[crm-recording-share POST]', err)
      return res.status(500).json({ error: 'Unlock failed' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
