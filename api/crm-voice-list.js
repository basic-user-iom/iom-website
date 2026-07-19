/**
 * GET /api/crm-voice-list
 * Returns ElevenLabs voices for the CRM recorder dropdown.
 * Requires ELEVENLABS_API_KEY. Optional default: ELEVENLABS_VOICE_ID.
 */

import { clientIp, rateLimit } from './lib/blog-helpers.js'

function hasKey() {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim())
}

function cors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Expose-Headers', 'x-voice-morph-available')
  res.setHeader('x-voice-morph-available', hasKey() ? '1' : '0')
}

export default async function handler(req, res) {
  cors(res, req.headers.origin)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (!hasKey()) {
    return res.status(503).json({
      error: 'AI voices not configured. Set ELEVENLABS_API_KEY on the server.',
      voices: [],
    })
  }

  const ip = clientIp(req)
  if (!rateLimit(`voice-list:${ip}`, 30, 60_000)) {
    return res.status(429).json({ error: 'Too many requests', voices: [] })
  }

  try {
    const elRes = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY.trim(),
        Accept: 'application/json',
      },
    })

    if (!elRes.ok) {
      const text = await elRes.text().catch(() => '')
      console.error('[crm-voice-list]', elRes.status, text.slice(0, 300))
      return res.status(502).json({
        error: 'Could not load ElevenLabs voices',
        voices: [],
      })
    }

    const data = await elRes.json()
    const raw = Array.isArray(data?.voices) ? data.voices : []
    const voices = raw
      .map((v) => ({
        id: String(v.voice_id || ''),
        name: String(v.name || 'Voice'),
        category: v.category ? String(v.category) : null,
        description: v.description ? String(v.description).slice(0, 160) : null,
        previewUrl: v.preview_url ? String(v.preview_url) : null,
      }))
      .filter((v) => v.id)
      .sort((a, b) => a.name.localeCompare(b.name))

    const defaultVoiceId =
      process.env.ELEVENLABS_VOICE_ID?.trim() || voices[0]?.id || null

    return res.status(200).json({
      voices,
      defaultVoiceId,
    })
  } catch (err) {
    console.error('[crm-voice-list]', err)
    return res.status(500).json({ error: 'Voice list failed', voices: [] })
  }
}
