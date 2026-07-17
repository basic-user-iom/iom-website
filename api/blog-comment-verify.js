/**
 * GET|POST /api/blog-comment-verify?token=…
 * Confirms comment email, upserts blog_audience, sets moderation status.
 */

import {
  hashToken,
  rateLimit,
  clientIp,
  safeJson,
  sb,
  siteOrigin,
  supabaseConfig,
} from './lib/blog-helpers.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = clientIp(req)
  if (!rateLimit(`verify:${ip}`, 20, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  let token = ''
  if (req.method === 'GET') {
    const q = req.query || {}
    token = String(q.token || '').trim()
  } else {
    const payload = typeof req.body === 'string' ? safeJson(req.body) : req.body
    token = String(payload?.token || req.query?.token || '').trim()
  }

  if (!token || token.length < 32) {
    return res.status(400).json({ error: 'Invalid verification token' })
  }

  const { url, key, hasService } = supabaseConfig()
  if (!url || !key || !hasService) {
    return res.status(503).json({ error: 'Verification is not configured' })
  }

  const tokenHash = hashToken(token)
  const wantsRedirect = req.method === 'GET' && !String(req.headers.accept || '').includes('application/json')

  try {
    const rows = await sb(
      `blog_comments?verify_token_hash=eq.${encodeURIComponent(tokenHash)}&status=eq.pending_verify&select=*`,
      { url, key },
    )
    const comment = Array.isArray(rows) ? rows[0] : null
    if (!comment) {
      if (wantsRedirect) {
        res.writeHead(302, { Location: `${siteOrigin()}/blog/verify?error=invalid` })
        return res.end()
      }
      return res.status(404).json({ error: 'Invalid or already used link' })
    }

    if (comment.verify_expires_at && new Date(comment.verify_expires_at).getTime() < Date.now()) {
      await sb(`blog_comments?id=eq.${encodeURIComponent(comment.id)}`, {
        method: 'PATCH',
        url,
        key,
        body: { status: 'spam', verify_token_hash: null },
      })
      if (wantsRedirect) {
        res.writeHead(302, { Location: `${siteOrigin()}/blog/verify?error=expired` })
        return res.end()
      }
      return res.status(410).json({ error: 'Verification link expired' })
    }

    const email = String(comment.author_email || '').toLowerCase()
    const prior = await sb(
      `blog_comments?author_email=eq.${encodeURIComponent(email)}&status=eq.approved&select=id&limit=1`,
      { url, key },
    )
    const trusted = Array.isArray(prior) && prior.length > 0
    const nextStatus = trusted ? 'approved' : 'pending_moderation'
    const now = new Date().toISOString()

    await sb(`blog_comments?id=eq.${encodeURIComponent(comment.id)}`, {
      method: 'PATCH',
      url,
      key,
      body: {
        status: nextStatus,
        email_verified_at: now,
        verify_token_hash: null,
        verify_expires_at: null,
      },
    })

    // Upsert audience by email (fetch then insert/update — PostgREST upsert needs on_conflict)
    const existing = await sb(
      `blog_audience?email=ilike.${encodeURIComponent(email)}&select=*`,
      { url, key },
    )
    const row = Array.isArray(existing) ? existing[0] : null
    const marketing = Boolean(comment.marketing_opt_in) || Boolean(row?.marketing_opt_in)
    if (row) {
      await sb(`blog_audience?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        url,
        key,
        body: {
          name: comment.author_name || row.name,
          marketing_opt_in: marketing,
          verified_at: row.verified_at || now,
          last_comment_at: now,
        },
      })
    } else {
      await sb('blog_audience', {
        method: 'POST',
        url,
        key,
        body: {
          email,
          name: comment.author_name || '',
          source: 'comment',
          marketing_opt_in: Boolean(comment.marketing_opt_in),
          verified_at: now,
          last_comment_at: now,
          notes: '',
        },
      })
    }

    const posts = await sb(
      `blog_posts?id=eq.${encodeURIComponent(comment.post_id)}&select=slug`,
      { url, key },
    )
    const slug = Array.isArray(posts) && posts[0]?.slug ? posts[0].slug : ''
    const dest = slug
      ? `${siteOrigin()}/blog/verify?ok=1&slug=${encodeURIComponent(slug)}&status=${nextStatus}`
      : `${siteOrigin()}/blog/verify?ok=1&status=${nextStatus}`

    if (wantsRedirect) {
      res.writeHead(302, { Location: dest })
      return res.end()
    }

    return res.status(200).json({
      ok: true,
      status: nextStatus,
      slug,
      message:
        nextStatus === 'approved'
          ? 'Email confirmed — your comment is live.'
          : 'Email confirmed — your comment is awaiting moderation.',
    })
  } catch (err) {
    console.error('[blog-comment-verify]', err instanceof Error ? err.message : err)
    if (wantsRedirect) {
      res.writeHead(302, { Location: `${siteOrigin()}/blog/verify?error=server` })
      return res.end()
    }
    return res.status(502).json({
      error: 'Verification failed',
      detail: err instanceof Error ? err.message.slice(0, 200) : 'Unknown error',
    })
  }
}
