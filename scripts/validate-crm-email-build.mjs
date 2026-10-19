// Server build only. Never expose this module through an HTTP route or frontend import.
import { X509Certificate, createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { EMAIL_REVIEW_APPROVAL, EMAIL_PRODUCTION_RESOURCE, EMAIL_PRODUCTION_ISSUER } from '../api/_lib/crm-email-production.mjs'

const PROJECT = 'werfdsobddsijqckymip'
const OWNER = '1add2cb0-a00a-4f92-a20a-7d90cb23afdd'
const LEAD = '5e474e0e-2bbf-4233-97f8-9a71428e6aa8'
const INTENT = 'ae0811f0-869e-49ac-80cc-8516940559fa'
const HOST = 'aws-0-eu-west-3.pooler.supabase.com'
const CA_FINGERPRINT = '807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA'
const OFF_FLAGS = ['CRM_EMAIL_SEND_ENABLED', 'CRM_EMAIL_PRODUCTION_ENABLED',
  'CRM_EMAIL_OAUTH_ISSUER_ENABLED', 'CRM_EMAIL_LIVE_MCP_ENABLED',
  'CRM_EMAIL_DELIVERY_ENABLED', 'CRM_EMAIL_MCP_ENABLED']

export function buildValidationContext(env) {
  return env.VERCEL === '1' && env.VERCEL_ENV === 'production' && env.IOM_SKIP_BLOG_SYNC === 'true'
}

function requireTrue(value) { if (!value) throw new Error('validation_failed') }

export function databaseOptions(env, role) {
  const raw = env[role === 'iom_email_gateway' ? 'CRM_EMAIL_DATABASE_URL' : 'CRM_EMAIL_OAUTH_DATABASE_URL']
  const url = new URL(raw)
  requireTrue(['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname === HOST &&
    url.port === '5432' && url.pathname === '/postgres' && !url.search && !url.hash &&
    decodeURIComponent(url.username) === `${role}.${PROJECT}` && Boolean(url.password))
  return { connectionString: raw, ssl: { ca: env.CRM_EMAIL_DATABASE_CA, rejectUnauthorized: true },
    connectionTimeoutMillis: 5000, query_timeout: 5000, statement_timeout: 5000,
    application_name: 'iom-email-build-validation' }
}

function validateCa(env) {
  const cert = new X509Certificate(env.CRM_EMAIL_DATABASE_CA)
  requireTrue(cert.ca && cert.fingerprint256.replaceAll(':', '') === CA_FINGERPRINT &&
    Date.now() >= Date.parse(cert.validFrom) && Date.now() < Date.parse(cert.validTo))
}

export function validateSigningKey(raw) {
  const jwk = JSON.parse(raw)
  requireTrue(jwk.kty === 'EC' && jwk.crv === 'P-256' && jwk.d && jwk.x && jwk.y &&
    (!jwk.use || jwk.use === 'sig') && (!jwk.alg || jwk.alg === 'ES256'))
  const privateKey = createPrivateKey({ key: jwk, format: 'jwk' })
  const publicKey = createPublicKey({ key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, format: 'jwk' })
  const challenge = randomBytes(32)
  let signature
  try {
    signature = sign('sha256', challenge, { key: privateKey, dsaEncoding: 'ieee-p1363' })
    requireTrue(verify('sha256', challenge, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature))
  } finally { challenge.fill(0); signature?.fill(0) }
}

function safeFailure(error) {
  if (error?.code === '28P01' || error?.code === '28000') return 'DB_AUTH'
  if (error?.code === '42501') return 'DB_PERMISSION'
  if (['SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED',
    'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(error?.code)) return 'TLS'
  if (['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'].includes(error?.code)) return 'NETWORK'
  return 'CHECK'
}

async function validateDatabase(env, role, createClient, reviewOnly = false) {
  const client = await createClient(databaseOptions(env, role))
  client.on('error', () => {}) // Never log pg errors: they may contain credentials or SQL context.
  let timer
  try {
    await client.connect()
    requireTrue(client.connection?.stream?.encrypted === true && client.connection.stream.authorized === true)
    await client.query('BEGIN READ ONLY')
    await client.query("SET LOCAL statement_timeout = '5s'")
    await client.query("SET LOCAL lock_timeout = '5s'")
    await client.query("SELECT set_config('iom.email_owner', $1, true)", [OWNER])
    const identity = (await client.query("SELECT current_user AS role, current_setting('transaction_read_only') = 'on' AS read_only")).rows[0]
    requireTrue(identity?.role === role && identity.read_only === true)
    const binding = (await client.query(`SELECT EXISTS (
      SELECT 1 FROM crm_email_private.principals WHERE role_name = current_user AND owner_id = $1
    ) AS owner_matches, EXISTS (
      SELECT 1 FROM public.crm_staff_profiles WHERE id = $1 AND active
    ) AS staff_active`, [OWNER])).rows[0]
    requireTrue(binding?.owner_matches === true && binding.staff_active === true)
    if (role === 'iom_email_gateway') {
      const target = (await client.query(`SELECT EXISTS (
        SELECT 1 FROM crm_email_private.target_binding WHERE owner_id = $1 AND supabase_url = $2
      ) AS target_matches, EXISTS (
        SELECT 1 FROM crm_email_private.pilot WHERE owner_id = $1 AND lead_id = $3
        AND enabled = $9 AND recipient = $4 AND from_identity = $5 AND from_email = $6
        AND message_kind = $7 AND message_intent_id = $8
      ) AS pilot_matches`, [OWNER, `https://${PROJECT}.supabase.co`, LEAD,
        'mirjan.foto@gmail.com', 'projects', 'projects@iobjectm.com', 'followup', INTENT, reviewOnly])).rows[0]
      requireTrue(target?.target_matches === true && target.pilot_matches === true)
      if (reviewOnly) {
        const boundary = (await client.query(`SELECT NOT EXISTS (
          SELECT 1 FROM crm_email_private.grant_families WHERE owner_id=$1
          AND revoked_at IS NULL AND expires_at>statement_timestamp()
          AND scopes<>ARRAY['iom:crm:email:read']::text[]
        ) AS read_grants_only, NOT EXISTS (
          SELECT 1 FROM crm_email_private.jobs WHERE owner_id=$1 AND lead_id=$2
        ) AS no_pilot_jobs`, [OWNER, LEAD])).rows[0]
        requireTrue(boundary?.read_grants_only === true && boundary.no_pilot_jobs === true)
      }
    }
    await client.query('ROLLBACK')
  } finally {
    // Closing the connection rolls back even after a query failure; no COMMIT or write is used.
    try {
      await Promise.race([client.end(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('close_timeout')), 5000)
      })])
    } finally { clearTimeout(timer) }
  }
}

export async function runBuildValidation({ env, approvalPin, createClient, identities, emit = () => {} }) {
  const results = []
  const record = (check, status, detail) => {
    const row = { check, status, ...(detail ? { detail } : {}) }
    results.push(row); emit(row)
  }
  if (!buildValidationContext(env)) { record('CONTEXT', 'SKIP'); return { ok: true, skipped: true, results } }
  const check = async (name, task) => {
    try { await task(); record(name, 'PASS'); return true }
    catch (error) { record(name, 'FAIL', safeFailure(error)); return false }
  }
  const reviewOnly = approvalPin?.accessMode === 'review-only'
  const controls = await check(reviewOnly ? 'REVIEW_ONLY_CONTROLS' : 'CONTROLS_OFF', () => {
    if (reviewOnly) {
      requireTrue(Object.keys(approvalPin).length === Object.keys(EMAIL_REVIEW_APPROVAL).length &&
        Object.entries(EMAIL_REVIEW_APPROVAL).every(([key,value]) => approvalPin[key] === value))
      const enabled = ['CRM_EMAIL_PRODUCTION_ENABLED','CRM_EMAIL_OAUTH_ISSUER_ENABLED','CRM_EMAIL_LIVE_MCP_ENABLED']
      requireTrue(enabled.every(key=>env[key]==='true') && env.CRM_EMAIL_SEND_ENABLED==='false' &&
        OFF_FLAGS.filter(key=>!enabled.includes(key)).every(key=>!env[key]||env[key]==='false'))
      const bindings = {CRM_EMAIL_PROVIDER:'smtp',CRM_EMAIL_SUPABASE_URL:`https://${PROJECT}.supabase.co`,
        CRM_EMAIL_MCP_RESOURCE_URL:EMAIL_PRODUCTION_RESOURCE,CRM_EMAIL_OAUTH_ISSUER:EMAIL_PRODUCTION_ISSUER,
        CRM_EMAIL_OWNER_ID:EMAIL_REVIEW_APPROVAL.ownerId,CRM_EMAIL_OAUTH_CLIENT_ID:EMAIL_REVIEW_APPROVAL.clientId,
        CRM_EMAIL_OAUTH_REDIRECT_URI:EMAIL_REVIEW_APPROVAL.redirectUri,CRM_EMAIL_OAUTH_SUBJECT:EMAIL_REVIEW_APPROVAL.subject}
      requireTrue(Object.entries(bindings).every(([key,value])=>env[key]===value))
    } else requireTrue(approvalPin === null && OFF_FLAGS.every(name => !env[name] || env[name] === 'false'))
    const expected = `https://${PROJECT}.supabase.co`
    requireTrue(env.VITE_SUPABASE_URL === expected && (!env.SUPABASE_URL || env.SUPABASE_URL === expected))
  })
  if (!controls) return { ok: false, skipped: false, results }
  const ca = await check('PUBLIC_CA', () => validateCa(env))
  if (ca) {
    await check('GATEWAY_DB', () => validateDatabase(env, 'iom_email_gateway', createClient, reviewOnly))
    await check('OAUTH_DB', () => validateDatabase(env, 'iom_email_oauth', createClient, reviewOnly))
  }
  await check('SIGNING_JWK', () => validateSigningKey(env.CRM_EMAIL_OAUTH_SIGNING_JWK))
  await check('PROJECTS_SENDER', () => {
    const identity = identities().find(item => item.id === 'projects')
    requireTrue(identity?.configured === true && identity.email === 'projects@iobjectm.com' &&
      identity.fromHeader === 'IOM Projects <projects@iobjectm.com>')
  })
  return { ok: results.every(row => row.status === 'PASS'), skipped: false, results }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!buildValidationContext(process.env)) console.log('[crm-email-validation] CONTEXT SKIP')
    else {
      const [{ Client }, { EMAIL_PRODUCTION_APPROVAL }, { listProtonIdentities }] = await Promise.all([
        import('pg'), import('../api/_lib/crm-email-production.mjs'), import('../api/_lib/proton-identities.js'),
      ])
      const result = await runBuildValidation({ env: process.env, approvalPin: EMAIL_PRODUCTION_APPROVAL,
        createClient: options => new Client(options), identities: listProtonIdentities,
        emit: row => console.log(`[crm-email-validation] ${row.check} ${row.status}${row.detail ? ` ${row.detail}` : ''}`) })
      if (!result.ok) process.exitCode = 1
    }
  } catch { console.log('[crm-email-validation] BOOTSTRAP FAIL'); process.exitCode = 1 }
}
