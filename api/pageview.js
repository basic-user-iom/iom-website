/**
 * Privacy-friendly pageview ingest with Vercel edge geo headers.
 * Does not store raw IP — only country / city / approx lat-lon.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''

  if (!url || !key) {
    return res.status(500).json({ error: 'Analytics not configured' })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid body' })
  }

  const session_id = String(body.session_id || '').slice(0, 64)
  const path = String(body.path || '/').slice(0, 512)
  if (session_id.length < 8) {
    return res.status(400).json({ error: 'Invalid session' })
  }

  const headers = req.headers
  const country = String(headers['x-vercel-ip-country'] || '').slice(0, 8)
  const city = String(headers['x-vercel-ip-city'] || '')
    .slice(0, 128)
    .replace(/\+/g, ' ')
  const latitude = parseCoord(headers['x-vercel-ip-latitude'])
  const longitude = parseCoord(headers['x-vercel-ip-longitude'])

  const device = String(body.device_type || 'unknown')
  const device_type = ['desktop', 'mobile', 'tablet', 'unknown'].includes(device)
    ? device
    : 'unknown'

  const row = {
    session_id,
    path,
    referrer: String(body.referrer || '').slice(0, 512),
    utm_source: String(body.utm_source || '').slice(0, 128),
    utm_medium: String(body.utm_medium || '').slice(0, 128),
    utm_campaign: String(body.utm_campaign || '').slice(0, 128),
    device_type,
    viewport_w: toInt(body.viewport_w),
    viewport_h: toInt(body.viewport_h),
    country,
    city,
    latitude,
    longitude,
  }

  try {
    const response = await fetch(`${url}/rest/v1/site_analytics_events`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    })

    if (!response.ok) {
      const text = await response.text()
      console.warn('[pageview] supabase', response.status, text.slice(0, 200))
      // If geo columns missing, retry without them so tracking still works
      if (text.includes('country') || text.includes('latitude') || response.status === 400) {
        const { country: _c, city: _ci, latitude: _la, longitude: _lo, ...base } = row
        const retry = await fetch(`${url}/rest/v1/site_analytics_events`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(base),
        })
        if (retry.ok) return res.status(204).end()
      }
      return res.status(502).json({ error: 'Insert failed' })
    }

    return res.status(204).end()
  } catch (err) {
    console.warn('[pageview]', err)
    return res.status(502).json({ error: 'Insert failed' })
  }
}

function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function parseCoord(value) {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function toInt(value) {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? Math.round(n) : null
}
