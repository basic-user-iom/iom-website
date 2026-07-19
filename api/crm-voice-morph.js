/**
 * POST /api/crm-voice-morph
 * Proxies audio to ElevenLabs Speech-to-Speech. Requires ELEVENLABS_API_KEY.
 * Body JSON: { audioBase64, voiceId?, mimeType? }
 * OPTIONS returns x-voice-morph-available: 1|0
 */

import { createHash } from 'node:crypto'
import { clientIp, rateLimit, safeJson } from './lib/blog-helpers.js'

function hasKey() {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim())
}

function cors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Expose-Headers', 'x-voice-morph-available')
  res.setHeader('x-voice-morph-available', hasKey() ? '1' : '0')
}

export default async function handler(req, res) {
  cors(res, req.headers.origin)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!hasKey()) {
    return res.status(503).json({
      error: 'AI voice morph is not configured. Set ELEVENLABS_API_KEY on the server.',
    })
  }

  const ip = clientIp(req)
  if (!rateLimit(`voice-morph:${ip}`, 8, 60_000)) {
    return res.status(429).json({ error: 'Too many voice morph requests' })
  }

  try {
    const payload = typeof req.body === 'string' ? safeJson(req.body) : req.body
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid body' })
    }

    const voiceId =
      String(payload.voiceId || '').trim() ||
      process.env.ELEVENLABS_VOICE_ID?.trim() ||
      '21m00Tcm4TlvDq8ikWAM'
    const mimeType = String(payload.mimeType || 'audio/webm')
    const b64 = String(payload.audioBase64 || '')
    if (!b64) return res.status(400).json({ error: 'Missing audio' })

    let audioBuf
    try {
      audioBuf = Buffer.from(b64, 'base64')
    } catch {
      return res.status(400).json({ error: 'Invalid audio encoding' })
    }

    if (audioBuf.length < 100) {
      return res.status(400).json({ error: 'Missing audio' })
    }
    if (audioBuf.length > 25 * 1024 * 1024) {
      return res.status(413).json({ error: 'Audio too large (max 25MB)' })
    }

    const form = new FormData()
    form.append(
      'audio',
      new Blob([audioBuf], { type: mimeType }),
      'input.webm',
    )
    form.append('model_id', 'eleven_multilingual_sts_v2')

    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/speech-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY.trim(),
          Accept: 'audio/mpeg',
        },
        body: form,
      },
    )

    if (!elRes.ok) {
      const text = await elRes.text().catch(() => '')
      console.error('[crm-voice-morph]', elRes.status, text.slice(0, 400))
      return res.status(502).json({
        error: 'ElevenLabs speech-to-speech failed',
        detail: text.slice(0, 200),
      })
    }

    const out = Buffer.from(await elRes.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Disposition', 'attachment; filename="morphed.mp3"')
    res.setHeader(
      'x-voice-hash',
      createHash('sha256').update(out).digest('hex').slice(0, 12),
    )
    return res.status(200).send(out)
  } catch (err) {
    console.error('[crm-voice-morph]', err)
    return res.status(500).json({ error: 'Voice morph failed' })
  }
}
