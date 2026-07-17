/**
 * POST /api/blog-comment-submit
 * Public comment intake — stores pending_verify + sends magic-link email.
 * Body: { postId, parentId?, name, email, body, marketingOptIn?, botcheck? }
 */

import nodemailer from 'nodemailer'
import {
  clientIp,
  contactIdentity,
  hashToken,
  isDisposableEmail,
  isLightlyValidEmail,
  newVerifyToken,
  rateLimit,
  safeJson,
  sb,
  siteOrigin,
  supabaseConfig,
} from './lib/blog-helpers.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = clientIp(req)
  if (!rateLimit(`submit:${ip}`, 6, 60_000)) {
    return res.status(429).json({ error: 'Too many comments. Try again shortly.' })
  }

  const payload = typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid body' })
  }

  // Honeypot — bots fill hidden fields
  if (String(payload.botcheck || '').trim()) {
    return res.status(200).json({ ok: true })
  }

  const postId = String(payload.postId || '').trim()
  const parentId = payload.parentId ? String(payload.parentId).trim() : null
  const name = String(payload.name || '').trim().slice(0, 80)
  const email = String(payload.email || '').trim().toLowerCase().slice(0, 160)
  const body = String(payload.body || '').trim().slice(0, 4000)
  const marketingOptIn = Boolean(payload.marketingOptIn)

  if (!postId) return res.status(400).json({ error: 'Missing post' })
  if (!name) return res.status(400).json({ error: 'Name is required' })
  if (!isLightlyValidEmail(email)) return res.status(400).json({ error: 'Valid email is required' })
  if (isDisposableEmail(email)) {
    return res.status(400).json({ error: 'Please use a permanent email address' })
  }
  if (!body || body.length < 2) return res.status(400).json({ error: 'Comment is required' })
  if ((body.match(/https?:\/\//gi) || []).length > 2) {
    return res.status(400).json({ error: 'Too many links in comment' })
  }

  if (!rateLimit(`submit-email:${email}`, 3, 3_600_000)) {
    return res.status(429).json({ error: 'Too many comments from this email. Try later.' })
  }

  const { url, key, hasService } = supabaseConfig()
  if (!url || !key) {
    return res.status(503).json({ error: 'Comments are not configured' })
  }
  if (!hasService) {
    return res.status(503).json({
      error: 'Comment verification requires SUPABASE_SERVICE_ROLE_KEY',
    })
  }

  const host = process.env.PROTON_SMTP_HOST
  const port = Number(process.env.PROTON_SMTP_PORT || 587)
  const identity = contactIdentity()
  if (!host || !identity?.configured) {
    return res.status(503).json({ error: 'Email sending is not configured' })
  }

  try {
    const posts = await sb(
      `blog_posts?id=eq.${encodeURIComponent(postId)}&status=eq.published&select=id,slug,title`,
      { url, key },
    )
    const post = Array.isArray(posts) ? posts[0] : null
    if (!post) return res.status(404).json({ error: 'Post not found' })

    if (parentId) {
      const parents = await sb(
        `blog_comments?id=eq.${encodeURIComponent(parentId)}&post_id=eq.${encodeURIComponent(postId)}&status=eq.approved&select=id`,
        { url, key },
      )
      if (!Array.isArray(parents) || !parents[0]) {
        return res.status(400).json({ error: 'Parent comment not found' })
      }
    }

    const token = newVerifyToken()
    const tokenHash = hashToken(token)
    const expires = new Date(Date.now() + 48 * 3600_000).toISOString()

    const rows = await sb('blog_comments', {
      method: 'POST',
      url,
      key,
      body: {
        post_id: postId,
        parent_id: parentId,
        author_name: name,
        author_email: email,
        body,
        status: 'pending_verify',
        verify_token_hash: tokenHash,
        verify_expires_at: expires,
        marketing_opt_in: marketingOptIn,
      },
    })
    const comment = Array.isArray(rows) ? rows[0] : rows
    if (!comment?.id) throw new Error('Failed to store comment')

    const verifyUrl = `${siteOrigin()}/blog/verify?token=${encodeURIComponent(token)}`
    const subject = `Confirm your comment on “${String(post.title || 'IOM Blog').slice(0, 60)}”`
    const text = [
      `Hi ${name},`,
      '',
      'Thanks for commenting on the IOM blog. Confirm your email to submit your comment for review:',
      verifyUrl,
      '',
      'This link expires in 48 hours. If you did not leave a comment, you can ignore this email.',
      '',
      '— IOM',
    ].join('\n')

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      requireTLS: true,
      auth: { user: identity.user, pass: identity.pass },
    })

    await transporter.sendMail({
      from: identity.fromHeader,
      to: email,
      subject,
      text,
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>Thanks for commenting on the IOM blog. Confirm your email to submit your comment for review:</p>
<p><a href="${verifyUrl}">Confirm my email</a></p>
<p>This link expires in 48 hours. If you did not leave a comment, you can ignore this email.</p>
<p>— IOM</p>`,
    })

    return res.status(200).json({
      ok: true,
      message: 'Check your email to confirm your comment.',
      commentId: comment.id,
    })
  } catch (err) {
    console.error('[blog-comment-submit]', err instanceof Error ? err.message : err)
    return res.status(502).json({
      error: 'Could not submit comment',
      detail: err instanceof Error ? err.message.slice(0, 200) : 'Unknown error',
    })
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
