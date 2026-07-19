/**
 * CRM recorder APIs (single function to stay under Hobby plan limit).
 *
 * GET  ?action=voices          → ElevenLabs voice list
 * OPTIONS/POST ?action=morph   → ElevenLabs speech-to-speech
 * GET/POST ?action=share       → recording share meta / unlock
 */

import { createHash } from 'node:crypto'
import {
  clientIp,
  rateLimit,
  safeJson,
  sb,
  supabaseConfig,
} from './_lib/blog-helpers.js'

const BUCKET = 'crm-screen-recordings'
const SIGNED_SECONDS = 60 * 60 * 2

function hasElevenKey() {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim())
}

function cors(res, origin, methods = 'GET, POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Expose-Headers', 'x-voice-morph-available')
  res.setHeader('x-voice-morph-available', hasElevenKey() ? '1' : '0')
}

function actionOf(req) {
  const q = req.query?.action
  if (q) return String(q).trim().toLowerCase()
  const url = String(req.url || '')
  if (url.includes('voice-list')) return 'voices'
  if (url.includes('voice-morph')) return 'morph'
  if (url.includes('recording-share')) return 'share'
  return ''
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

async function handleVoices(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!hasElevenKey()) {
    return res.status(503).json({
      error: 'AI voices not configured. Set ELEVENLABS_API_KEY on the server.',
      voices: [],
    })
  }
  const ip = clientIp(req)
  if (!rateLimit(`voice-list:${ip}`, 30, 60_000)) {
    return res.status(429).json({ error: 'Too many requests', voices: [] })
  }

  const elRes = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY.trim(),
      Accept: 'application/json',
    },
  })
  if (!elRes.ok) {
    const text = await elRes.text().catch(() => '')
    console.error('[crm-recorder voices]', elRes.status, text.slice(0, 300))
    return res.status(502).json({ error: 'Could not load ElevenLabs voices', voices: [] })
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

  return res.status(200).json({ voices, defaultVoiceId })
}

async function handleMorph(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!hasElevenKey()) {
    return res.status(503).json({
      error: 'AI voice morph is not configured. Set ELEVENLABS_API_KEY on the server.',
    })
  }

  const ip = clientIp(req)
  if (!rateLimit(`voice-morph:${ip}`, 8, 60_000)) {
    return res.status(429).json({ error: 'Too many voice morph requests' })
  }

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
  if (audioBuf.length < 100) return res.status(400).json({ error: 'Missing audio' })
  if (audioBuf.length > 25 * 1024 * 1024) {
    return res.status(413).json({ error: 'Audio too large (max 25MB)' })
  }

  const form = new FormData()
  const ext = mimeType.includes('mp4')
    ? 'm4a'
    : mimeType.includes('mpeg') || mimeType.includes('mp3')
      ? 'mp3'
      : mimeType.includes('wav')
        ? 'wav'
        : 'webm'
  form.append(
    'audio',
    new Blob([audioBuf], { type: mimeType }),
    `input.${ext}`,
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
    console.error('[crm-recorder morph]', elRes.status, text.slice(0, 400))
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
}

async function handleShare(req, res) {
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

    const rows = await sb(`rpc/crm_recording_share_meta`, {
      method: 'POST',
      body: { p_slug: slug },
      url,
      key,
    })
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
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default async function handler(req, res) {
  const action = actionOf(req)
  cors(res, req.headers.origin)

  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    if (action === 'voices') return await handleVoices(req, res)
    if (action === 'morph') return await handleMorph(req, res)
    if (action === 'share') return await handleShare(req, res)
    return res.status(400).json({
      error: 'Missing action. Use ?action=voices|morph|share',
    })
  } catch (err) {
    console.error('[crm-recorder]', action, err)
    return res.status(500).json({ error: 'Recorder API failed' })
  }
}
