/**
 * Privacy-friendly analytics ingest with Vercel geo + bot detection.
 * No raw IP stored.
 */

const BOT_RE =
  /bot|crawl|spider|slurp|scrapy|curl|wget|python-requests|httpclient|headless|phantom|selenium|puppeteer|lighthouse|pagespeed|facebookexternalhit|preview|discordbot|twitterbot|linkedinbot|embedly|quora|whatsapp|telegram|bingpreview|yandex|baiduspider|duckduckbot|applebot|semrush|ahrefs|mj12bot|dotbot|petalbot|gptbot|claudebot|bytespider|ccbot|ia_archiver/i

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

  if (!url || !key) return res.status(500).json({ error: 'Analytics not configured' })

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid body' })

  const session_id = String(body.session_id || '').slice(0, 64)
  const path = String(body.path || '/').slice(0, 512)
  if (session_id.length < 8) return res.status(400).json({ error: 'Invalid session' })

  const headers = req.headers
  const ua = String(headers['user-agent'] || '').slice(0, 512)
  const is_bot = BOT_RE.test(ua)

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

  const eventType = ['pageview', 'engage', 'click'].includes(body.event_type)
    ? body.event_type
    : 'pageview'

  const row = {
    session_id,
    path,
    referrer: String(body.referrer || '').slice(0, 512),
    utm_source: String(body.utm_source || '').slice(0, 128),
    utm_medium: String(body.utm_medium || '').slice(0, 128),
    utm_campaign: String(body.utm_campaign || '').slice(0, 128),
    utm_term: String(body.utm_term || '').slice(0, 256),
    search_keyword: String(body.search_keyword || '').slice(0, 256),
    device_type,
    viewport_w: toInt(body.viewport_w),
    viewport_h: toInt(body.viewport_h),
    country,
    city,
    latitude,
    longitude,
    event_type: eventType,
    is_bot,
    duration_ms: toInt(body.duration_ms),
    link_url: String(body.link_url || '').slice(0, 1024),
    link_label: String(body.link_label || '').slice(0, 256),
  }

  try {
    let response = await insert(url, key, row)
    if (!response.ok) {
      const text = await response.text()
      console.warn('[pageview]', response.status, text.slice(0, 240))
      // Graceful degrade if engagement columns not migrated yet
      const base = {
        session_id: row.session_id,
        path: row.path,
        referrer: row.referrer,
        utm_source: row.utm_source,
        utm_medium: row.utm_medium,
        utm_campaign: row.utm_campaign,
        device_type: row.device_type,
        viewport_w: row.viewport_w,
        viewport_h: row.viewport_h,
        country: row.country,
        city: row.city,
        latitude: row.latitude,
        longitude: row.longitude,
      }
      response = await insert(url, key, base)
      if (!response.ok) {
        const retryText = await response.text()
        // geo missing too
        const minimal = {
          session_id: row.session_id,
          path: row.path,
          referrer: row.referrer,
          utm_source: row.utm_source,
          utm_medium: row.utm_medium,
          utm_campaign: row.utm_campaign,
          device_type: row.device_type,
          viewport_w: row.viewport_w,
          viewport_h: row.viewport_h,
        }
        response = await insert(url, key, minimal)
        if (!response.ok) {
          console.warn('[pageview] minimal failed', retryText.slice(0, 200))
          return res.status(502).json({ error: 'Insert failed' })
        }
      }
    }
    return res.status(204).end()
  } catch (err) {
    console.warn('[pageview]', err)
    return res.status(502).json({ error: 'Insert failed' })
  }
}

async function insert(url, key, row) {
  return fetch(`${url}/rest/v1/site_analytics_events`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  })
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
