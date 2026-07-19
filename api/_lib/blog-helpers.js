/**
 * Shared helpers for blog comment API routes.
 */

import { createHash, randomBytes } from 'node:crypto'
import { EMAIL_RE, resolveProtonIdentity } from './proton-identities.js'

export { EMAIL_RE }

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'discard.email',
  'maildrop.cc',
  'throwaway.email',
])

/** @type {Map<string, number[]>} */
const rateBuckets = new Map()

export function siteOrigin() {
  return (
    process.env.SITE_ORIGIN ||
    process.env.VITE_SITE_ORIGIN ||
    'https://iobjectm.com'
  ).replace(/\/+$/, '')
}

export function supabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return { url, key: serviceKey || anonKey, hasService: Boolean(serviceKey) }
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}

export function newVerifyToken() {
  return randomBytes(32).toString('hex')
}

export function isLightlyValidEmail(email) {
  return EMAIL_RE.test(String(email || '').trim())
}

export function isDisposableEmail(email) {
  const domain = String(email || '')
    .trim()
    .toLowerCase()
    .split('@')[1]
  return Boolean(domain && DISPOSABLE_DOMAINS.has(domain))
}

/**
 * Simple in-memory rate limit (per serverless instance).
 * @param {string} key
 * @param {number} max
 * @param {number} windowMs
 */
export function rateLimit(key, max = 8, windowMs = 60_000) {
  const now = Date.now()
  const prev = rateBuckets.get(key) || []
  const recent = prev.filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    rateBuckets.set(key, recent)
    return false
  }
  recent.push(now)
  rateBuckets.set(key, recent)
  return true
}

export function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return xf || String(req.headers['x-real-ip'] || '') || 'unknown'
}

export function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * @param {string} path e.g. "blog_posts?slug=eq.foo"
 */
export async function sb(path, { method = 'GET', body, key, url, prefer } = {}) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
  if (prefer) headers.Prefer = prefer
  else if (method === 'POST' || method === 'PATCH') headers.Prefer = 'return=representation'

  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

export function contactIdentity() {
  return resolveProtonIdentity('contact')
}
