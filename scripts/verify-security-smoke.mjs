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
  return fetch(`${origin}${path}`, { method: 'HEAD', redirect: 'manual' })
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
  const cspEnforce = home.headers.get('content-security-policy') || ''
  const cspReport =
    home.headers.get('content-security-policy-report-only') || ''
  const csp = cspEnforce || cspReport
  record(
    'X-Content-Type-Options',
    cto.toLowerCase() === 'nosniff',
    cto || 'missing',
  )
  record(
    'X-Frame-Options',
    /^(SAMEORIGIN|DENY)$/i.test(xfo),
    xfo || 'missing',
  )
  record('Referrer-Policy', Boolean(referrer), referrer || 'missing')
  record('Permissions-Policy', Boolean(perms), perms ? 'present' : 'missing')
  record(
    'CSP present with frame-ancestors',
    /frame-ancestors/i.test(csp),
    cspEnforce ? 'enforced' : cspReport ? 'report-only' : 'missing',
  )
  record(
    'CSP enforced (not report-only only)',
    Boolean(cspEnforce) && /frame-ancestors/i.test(cspEnforce),
    cspEnforce ? 'enforced' : 'still report-only',
  )
  record(
    'CSP allows jsDelivr demos',
    /cdn\.jsdelivr\.net/i.test(csp),
    /cdn\.jsdelivr\.net/i.test(csp) ? 'script-src ok' : 'missing jsdelivr',
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
    typeof emailBody.error === 'string' && typeof emailBody.code === 'string',
    emailBody.code ? `code=${emailBody.code}` : 'no code',
  )

  // CORS must not reflect arbitrary origins (SEC-010)
  const corsProbe = await fetch(`${origin}/api/crm-send-email`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'POST',
    },
  })
  const acao = corsProbe.headers.get('access-control-allow-origin') || ''
  record(
    'crm-send-email CORS does not reflect evil origin',
    acao !== 'https://evil.example' && acao !== '*',
    acao || 'no ACAO',
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

  const mfaReset = await postJson('/api/crm-mfa-reset', {})
  record(
    'crm-mfa-reset rejects anonymous',
    mfaReset.status === 401 || mfaReset.status === 403,
    `HTTP ${mfaReset.status}`,
  )

  const recorder = await postJson('/api/crm-recorder?action=r2-upload', {
    path: 'x/y',
  })
  record(
    'crm-recorder r2-upload rejects anonymous',
    recorder.status === 401 || recorder.status === 403,
    `HTTP ${recorder.status}`,
  )
  const recorderBody = await recorder.json().catch(() => ({}))
  record(
    'crm-recorder returns stable error shape',
    typeof recorderBody.error === 'string',
    recorderBody.code ? `code=${recorderBody.code}` : 'no code',
  )

  const mediaPwd = await fetch(
    `${origin}/api/crm-recorder?action=media&slug=smoke-test&password=nope`,
    { redirect: 'manual' },
  )
  const mediaBody = await mediaPwd.json().catch(() => ({}))
  record(
    'crm-recorder rejects ?password= on media',
    mediaPwd.status === 400 && mediaBody.code === 'password_query_removed',
    `HTTP ${mediaPwd.status}${mediaBody.code ? ` code=${mediaBody.code}` : ''}`,
  )

  // Artist invites must not be anonymously listable (SEC-002)
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

    const tenancy = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/crm_client_accounts?select=id&limit=1`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    )
    const tenancyJson = await tenancy.json().catch(() => null)
    const tenancyLocked =
      tenancy.status === 401 ||
      tenancy.status === 403 ||
      tenancy.status === 404 ||
      (Array.isArray(tenancyJson) && tenancyJson.length === 0) ||
      (tenancyJson && tenancyJson.code)
    record(
      'crm_client_accounts anon select denied/empty/missing',
      tenancyLocked,
      `HTTP ${tenancy.status}`,
    )
  } else {
    console.log(
      '~ supabase Rest checks — skipped (set VITE_SUPABASE_URL + anon key)',
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
