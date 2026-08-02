#!/usr/bin/env node
/**
 * Passive security smoke checks against production (no credentials).
 * Usage: node scripts/verify-security-smoke.mjs [origin]
 */
const origin = (process.argv[2] || 'https://iobjectm.com').replace(/\/+$/, '')

/** @type {{ name: string, ok: boolean, detail: string }[]} */
const results = []

function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function head(path) {
  const res = await fetch(`${origin}${path}`, { method: 'HEAD', redirect: 'manual' })
  return res
}

async function postJson(path, body, headers = {}) {
  return fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

async function main() {
  console.log(`\nSecurity smoke — ${origin}\n`)

  // Browser headers (SEC-007)
  const home = await head('/')
  const xfo = home.headers.get('x-frame-options') || ''
  const cto = home.headers.get('x-content-type-options') || ''
  const referrer = home.headers.get('referrer-policy') || ''
  const perms = home.headers.get('permissions-policy') || ''
  const csp =
    home.headers.get('content-security-policy') ||
    home.headers.get('content-security-policy-report-only') ||
    ''
  record('X-Content-Type-Options', cto.toLowerCase() === 'nosniff', cto || 'missing')
  record(
    'X-Frame-Options',
    /^(SAMEORIGIN|DENY)$/i.test(xfo),
    xfo || 'missing',
  )
  record('Referrer-Policy', Boolean(referrer), referrer || 'missing')
  record('Permissions-Policy', Boolean(perms), perms ? 'present' : 'missing')
  record(
    'CSP (enforce or report-only)',
    /frame-ancestors/i.test(csp),
    csp ? (home.headers.get('content-security-policy') ? 'enforced' : 'report-only') : 'missing',
  )

  const login = await head('/client-login')
  const cache = login.headers.get('cache-control') || ''
  record(
    '/client-login Cache-Control private/no-store',
    /no-store/i.test(cache) && /private/i.test(cache),
    cache || 'missing',
  )

  // Privileged APIs reject anonymous (SEC-004 / SEC-003)
  const email = await postJson('/api/crm-send-email', { to: 'x@example.com' })
  record(
    'crm-send-email rejects anonymous',
    email.status === 401 || email.status === 403,
    `HTTP ${email.status}`,
  )
  const emailBody = await email.json().catch(() => ({}))
  record(
    'crm-send-email returns stable error shape',
    typeof emailBody.error === 'string',
    emailBody.code ? `code=${emailBody.code}` : 'no code',
  )

  const artist = await postJson('/api/artist-globe-admin', { action: 'list_submissions' })
  record(
    'artist-globe-admin rejects anonymous',
    artist.status === 401 || artist.status === 403,
    `HTTP ${artist.status}`,
  )

  const sched = await fetch(`${origin}/api/crm-scheduled-send`, { method: 'GET' })
  record(
    'crm-scheduled-send rejects anonymous',
    sched.status === 401 || sched.status === 403 || sched.status === 503,
    `HTTP ${sched.status}`,
  )

  // Artist invites must not be anonymously listable (SEC-002)
  // Direct Rest without apikey often 401; with anon key listing invites should fail RLS.
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  if (supabaseUrl && anonKey) {
    const inv = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/artist_globe_invites?select=token&limit=1`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    )
    const invJson = await inv.json().catch(() => null)
    const empty =
      inv.status === 401 ||
      inv.status === 403 ||
      (Array.isArray(invJson) && invJson.length === 0) ||
      (invJson && invJson.code)
    record(
      'artist_globe_invites anon select denied/empty',
      empty,
      `HTTP ${inv.status}`,
    )
  } else {
    console.log(
      '~ artist_globe_invites anon select — skipped (set VITE_SUPABASE_URL + anon key)',
    )
  }

  const failed = results.filter((r) => !r.ok)
  console.log(
    `\n${results.length - failed.length}/${results.length} passed` +
      (failed.length ? `; ${failed.length} failed` : '') +
      '\n',
  )
  if (failed.length) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
