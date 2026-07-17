/**
 * Inbound email mirror for CRM (generic JSON webhook).
 * POST /api/crm-inbound-email
 *
 * Auth: Authorization: Bearer <CRM_INBOUND_EMAIL_SECRET>
 *    or header X-IOM-CRM-Inbound: <CRM_INBOUND_EMAIL_SECRET>
 *
 * Prefer /api/crm-resend-inbound when using Resend Receiving.
 */

import { ingestInboundEmail } from './lib/crm-inbound-ingest.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-IOM-CRM-Inbound',
  )

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = (process.env.CRM_INBOUND_EMAIL_SECRET || '').trim()
  if (!secret) {
    return res.status(503).json({ error: 'Inbound email is not configured' })
  }

  const authHeader = String(req.headers.authorization || '')
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const headerSecret = String(req.headers['x-iom-crm-inbound'] || '').trim()
  if (bearer !== secret && headerSecret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY required for inbound email ingest',
    })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid body' })
  }

  try {
    const result = await ingestInboundEmail({
      supabaseUrl,
      serviceKey,
      message: body,
      via: 'crm-inbound-email',
    })
    return res.status(result.status).json(result.body)
  } catch (err) {
    console.error('[crm-inbound-email]', err instanceof Error ? err.message : err)
    return res.status(502).json({
      error: 'Failed to ingest inbound email',
      detail: err instanceof Error ? err.message.slice(0, 200) : 'Unknown error',
    })
  }
}

function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
