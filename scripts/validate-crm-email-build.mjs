// Server build only. Never expose this module through an HTTP route or frontend import.
import { X509Certificate, createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto'
import {readFileSync} from 'node:fs'
import { pathToFileURL } from 'node:url'
import { EMAIL_REVIEW_APPROVAL, EMAIL_SINGLE_SEND_APPROVAL, EMAIL_REGULAR_APPROVAL, EMAIL_PRODUCTION_RESOURCE, EMAIL_PRODUCTION_ISSUER } from '../api/_lib/crm-email-production.mjs'
import { emailDigest } from '../api/_lib/crm-email-workflow.mjs'
import { STAFF_PAIR_ACCOUNTS } from '../api/_lib/crm-email-staff-pair.mjs'
import { emailReleasePhase } from './crm-email-release-phase.mjs'

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

export async function withReadOnlyClient({env,role,createClient,run,budgetMs=60_000,closeMs=5_000}) {
  const client = await createClient(databaseOptions(env, role))
  client.on('error', () => {}) // Never log pg errors: they may contain credentials or SQL context.
  let timer, closeTimer, rollbackTimer, stopped=false, connected=false, rolledBack=false
  const query=client.query.bind(client)
  const bounded={query:(...args)=>{
    requireTrue(!stopped)
    return query(...args)
  }}
  try {
    await Promise.race([(async()=>{
      await client.connect();connected=true
      requireTrue(!stopped && client.connection?.stream?.encrypted === true && client.connection.stream.authorized === true)
      await bounded.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      await bounded.query("SET LOCAL statement_timeout = '5s'")
      await bounded.query("SET LOCAL lock_timeout = '5s'")
      const identity=(await bounded.query("SELECT current_user AS role, session_user AS session_role, current_setting('transaction_read_only') = 'on' AS read_only, current_setting('transaction_isolation') AS isolation")).rows[0]
      requireTrue(identity?.role===role && identity.session_role===role &&
        identity.read_only===true && identity.isolation==='repeatable read')
      await run(bounded)
      await bounded.query('ROLLBACK');rolledBack=true
    })(),new Promise((_,reject)=>{timer=setTimeout(()=>{stopped=true;reject(new Error('database_timeout'))},budgetMs)})])
  } finally {
    stopped=true;clearTimeout(timer)
    try {
      if(connected && !rolledBack)await Promise.race([query('ROLLBACK'),new Promise((_,reject)=>{
        rollbackTimer=setTimeout(()=>reject(new Error('rollback_timeout')),closeMs)
      })])
    } finally {
      clearTimeout(rollbackTimer)
      try {await Promise.race([client.end(),new Promise((_,reject)=>{
        closeTimer=setTimeout(()=>reject(new Error('close_timeout')),closeMs)
      })])}finally{clearTimeout(closeTimer)}
    }
  }
}

async function validateDatabase(env, role, createClient, reviewOnly = false, singleSend = false, regular = false) {
  await withReadOnlyClient({env,role,createClient,run:async client=>{
    await client.query("SELECT set_config('iom.email_owner', $1, true)", [OWNER])
    const binding = (await client.query(`SELECT EXISTS (
      SELECT 1 FROM crm_email_private.principals WHERE role_name = current_user AND owner_id = $1
    ) AS owner_matches, EXISTS (
      SELECT 1 FROM public.crm_staff_profiles WHERE id = $1 AND active
    ) AS staff_active`, [OWNER])).rows[0]
    requireTrue(binding?.owner_matches === true && binding.staff_active === true)
    if (regular) {
      const access = (await client.query(`SELECT EXISTS (
        SELECT 1 FROM crm_email_private.regular_access WHERE owner_id=$1 AND revision=$2
        AND from_identity='projects' AND from_email='projects@iobjectm.com'
        AND from_header='IOM Projects <projects@iobjectm.com>' AND enabled
      ) AS regular_matches, NOT EXISTS (
        SELECT 1 FROM crm_email_private.grant_families WHERE owner_id=$1
        AND revoked_at IS NULL AND expires_at>statement_timestamp() AND access_revision=$2
        AND (NOT scopes <@ ARRAY['iom:crm:email:read','iom:crm:email:send','iom:crm:email:schedule','iom:crm:email:cancel']::text[]
          OR NOT scopes @> ARRAY['iom:crm:email:read']::text[]
          OR expires_at>statement_timestamp()+interval '336 hours')
      ) AS regular_grants_safe`, [OWNER, EMAIL_REGULAR_APPROVAL.accessRevision])).rows[0]
      requireTrue(access?.regular_matches===true && access.regular_grants_safe===true)
      if(role==='iom_email_gateway') {
        const target=(await client.query(`SELECT EXISTS (SELECT 1 FROM crm_email_private.target_binding
          WHERE owner_id=$1 AND supabase_url=$2) AS regular_target_matches,
          EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='crm_email_private' AND indexname='email_exact_content_one_attempt') AS content_guard_present,
          EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='crm_email_private.jobs'::regclass
            AND tgname='email_regular_review_boundary' AND tgenabled='O') AS review_guard_present`,[OWNER,`https://${PROJECT}.supabase.co`])).rows[0]
        requireTrue(target?.regular_target_matches===true && target.content_guard_present===true && target.review_guard_present===true)
        if(env.CRM_EMAIL_STAFF_REVIEW_ENABLED==='true') {
          await validateStaffPairAccess(client,emailReleasePhase(env.CRM_EMAIL_RELEASE_PHASE))
        }
      }
    } else if (role === 'iom_email_gateway') {
      const target = (await client.query(`SELECT EXISTS (
        SELECT 1 FROM crm_email_private.target_binding WHERE owner_id = $1 AND supabase_url = $2
      ) AS target_matches, EXISTS (
        SELECT 1 FROM crm_email_private.pilot WHERE owner_id = $1 AND lead_id = $3
        AND enabled = $9 AND recipient = $4 AND from_identity = $5 AND from_email = $6
        AND message_kind = $7 AND message_intent_id = $8
      ) AS pilot_matches`, [OWNER, `https://${PROJECT}.supabase.co`, LEAD,
        'mirjan.foto@gmail.com', 'projects', 'projects@iobjectm.com', 'followup', INTENT, reviewOnly || singleSend])).rows[0]
      requireTrue(target?.target_matches === true && target.pilot_matches === true)
      if (reviewOnly || singleSend) {
        const boundary = (await client.query(`SELECT NOT EXISTS (
          SELECT 1 FROM crm_email_private.grant_families WHERE owner_id=$1
          AND revoked_at IS NULL AND expires_at>statement_timestamp()
          AND (NOT scopes <@ $3::text[] OR NOT scopes @> ARRAY['iom:crm:email:read']::text[])
        ) AS read_grants_only, NOT EXISTS (
          SELECT 1 FROM crm_email_private.jobs WHERE owner_id=$1 AND lead_id=$2
        ) AS no_pilot_jobs`, [OWNER, LEAD, singleSend ? ['iom:crm:email:read','iom:crm:email:send'] : ['iom:crm:email:read']])).rows[0]
        requireTrue(boundary?.read_grants_only === true && boundary.no_pilot_jobs === true)
        if(singleSend) {
          const intent=(await client.query('SELECT snapshot FROM crm_email_private.message_intents WHERE owner_id=$1 AND id=$2',[OWNER,INTENT])).rows[0]
          requireTrue(intent && emailDigest({snapshot:intent.snapshot,schedule:null})===EMAIL_SINGLE_SEND_APPROVAL.reviewDigest)
        }
      }
    }
  }})
}

// Caller must use the gateway role in a READ ONLY transaction. PREPARED proves
// absence of new authority; ACTIVE proves all twelve effective combinations.
// Neither phase accepts a mixed/partially revoked state or skips a check.
export async function validateStaffPairAccess(client,phase='ACTIVE') {
  emailReleasePhase(phase)
  const active=phase==='ACTIVE',uuid=/^[a-f0-9-]{36}$/i
  const security=(await client.query(`SELECT
    current_user='iom_email_gateway' AND current_setting('transaction_read_only')='on' AS read_only_gateway,
    (SELECT count(*)=2 FROM pg_class WHERE oid IN ('crm_email_private.staff_access'::regclass,
      'crm_email_private.staff_lead_access'::regclass) AND relrowsecurity AND relforcerowsecurity) AS pair_rls,
    (SELECT count(*)=2 FROM pg_indexes WHERE schemaname='crm_email_private'
      AND indexname IN ('email_exact_content_one_attempt','email_pair_content_one_attempt')) AS pair_indexes,
    (SELECT count(*)=3 FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O'
      AND (tgrelid,tgname) IN (('public.crm_leads'::regclass,'staff_pair_lead_receipt_write'),
        ('crm_email_private.staff_access'::regclass,'staff_sender_epoch'),
        ('crm_email_private.staff_lead_access'::regclass,'staff_lead_epoch'))) AS pair_triggers,
    (SELECT count(*)=6 FROM pg_proc WHERE pronamespace='crm_email_private'::regnamespace AND NOT prosecdef
      AND proname IN ('staff_pair_context','staff_pair_scope','staff_pair_lead_allowed',
        'staff_pair_receipt_lead','guard_staff_pair_lead_write','rotate_staff_pair_epoch')) AS pair_functions,
    NOT has_table_privilege(current_user,'crm_email_private.staff_access','INSERT,UPDATE,DELETE,TRUNCATE')
      AND NOT has_table_privilege(current_user,'crm_email_private.staff_lead_access','INSERT,UPDATE,DELETE,TRUNCATE') AS no_self_grant`)).rows[0]
  requireTrue(security && ['read_only_gateway','pair_rls','pair_indexes','pair_triggers','pair_functions','no_self_grant'].every(k=>security[k]===true))
  for(const actor of STAFF_PAIR_ACCOUNTS){
    await client.query("SELECT set_config('iom.email_owner',$1,true),set_config('iom.email_staff_pair','v1',true),set_config('iom.email_staff_sender','',true)",[actor])
    const staff=(await client.query(`SELECT from_identity,revision,from_email,from_header,enabled,
      expires_at='infinity'::timestamptz AS permanent,epoch::text
      FROM crm_email_private.staff_access WHERE owner_id=$1 ORDER BY from_identity`,[actor])).rows
    requireTrue(staff.length===3 && ['contact','projects','visual'].every((sender,i)=>{
      const s=staff[i],expectedEnabled=active || (actor===OWNER && sender!=='contact')
      return s.from_identity===sender && s.revision===`staff-${sender}-v1` &&
        s.from_email===`${sender}@iobjectm.com` &&
        s.from_header===(sender==='contact'?'IOM <contact@iobjectm.com>':`IOM ${sender==='projects'?'Projects':'Visual'} <${sender}@iobjectm.com>`) &&
        s.enabled===expectedEnabled && s.permanent===true && uuid.test(s.epoch||'')
    }))
    const grants=(await client.query(`SELECT lead_owner_id,enabled,expires_at='infinity'::timestamptz AS permanent,
      revision::text FROM crm_email_private.staff_lead_access WHERE actor_id=$1 ORDER BY lead_owner_id`,[actor])).rows
    requireTrue(grants.length===2 && [...STAFF_PAIR_ACCOUNTS].sort().every((id,i)=>
      grants[i].lead_owner_id===id && grants[i].enabled===active && grants[i].permanent===true && uuid.test(grants[i].revision||'')))
    const profiles=(await client.query('SELECT id,active FROM public.crm_staff_profiles WHERE id=ANY($1::uuid[]) ORDER BY id',[STAFF_PAIR_ACCOUNTS])).rows
    requireTrue(profiles.length===2 && profiles.every(p=>STAFF_PAIR_ACCOUNTS.includes(p.id)&&p.active===true))
    for(const sender of ['contact','projects','visual']){
      await client.query("SELECT set_config('iom.email_staff_sender',$1,true)",[sender])
      const scope=(await client.query(`SELECT crm_email_private.staff_pair_scope($1::uuid) IS NOT NULL AS projects_scope,
        crm_email_private.staff_pair_scope($2::uuid) IS NOT NULL AS visual_scope`,STAFF_PAIR_ACCOUNTS)).rows[0]
      requireTrue(scope?.projects_scope===active && scope.visual_scope===active)
    }
  }
  await client.query("SELECT set_config('iom.email_owner',$1,true),set_config('iom.email_staff_pair','',true),set_config('iom.email_staff_sender','',true)",[OWNER])
}

// SMTP connection/authentication check only: never MAIL FROM, RCPT TO, DATA, or sendMail.
export async function verifyContactSmtp({env,identity,createTransport}) {
  requireTrue(identity?.configured===true && identity.email==='contact@iobjectm.com' &&
    identity.fromHeader==='IOM <contact@iobjectm.com>' && !!identity.user && !!identity.pass)
  const port=Number(env.PROTON_SMTP_PORT||587)
  requireTrue(!!env.PROTON_SMTP_HOST && [465,587].includes(port))
  const transport=createTransport({host:env.PROTON_SMTP_HOST,port,secure:port===465,requireTLS:true,
    tls:{rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:30000,
    auth:{user:identity.user,pass:identity.pass}})
  try {requireTrue(typeof transport.close==='function' && await transport.verify()===true)}
  finally {if(typeof transport.close==='function')await transport.close()}
}

export async function runBuildValidation({ env, approvalPin, createClient, identities, verifyContactTransport, emit = () => {} }) {
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
  const singleSend = approvalPin?.accessMode === 'single-send'
  const regular = approvalPin?.accessMode === 'regular-projects'
  if(env.CRM_EMAIL_RELEASE_PHASE==='PREPARED' && (!regular || env.CRM_EMAIL_STAFF_REVIEW_ENABLED!=='true')){
    record('STAFF_ACCESS_PHASE','FAIL','PREPARED_REQUIRES_REVIEWED_STAFF')
    return {ok:false,skipped:false,results}
  }
  if(regular && env.CRM_EMAIL_STAFF_REVIEW_ENABLED==='true') {
    const phase=await check('STAFF_ACCESS_PHASE',()=>emailReleasePhase(env.CRM_EMAIL_RELEASE_PHASE))
    if(!phase)return {ok:false,skipped:false,results}
    record('STAFF_EXPECTED_STATE','PASS',emailReleasePhase(env.CRM_EMAIL_RELEASE_PHASE))
  }
  const expectedPin = regular ? EMAIL_REGULAR_APPROVAL : singleSend ? EMAIL_SINGLE_SEND_APPROVAL : EMAIL_REVIEW_APPROVAL
  const controls = await check(regular ? 'REGULAR_PROJECTS_CONTROLS' : singleSend ? 'SINGLE_SEND_CONTROLS' : reviewOnly ? 'REVIEW_ONLY_CONTROLS' : 'CONTROLS_OFF', () => {
    if (reviewOnly || singleSend || regular) {
      requireTrue(Object.keys(approvalPin).length === Object.keys(expectedPin).length &&
        Object.entries(expectedPin).every(([key,value]) => approvalPin[key] === value))
      if(singleSend) requireTrue(Date.now()<Date.parse(expectedPin.sendExpiresAt))
      if(regular)requireTrue(['true','false'].includes(env.CRM_EMAIL_SEND_ENABLED))
      const sendOn = singleSend || (regular && env.CRM_EMAIL_SEND_ENABLED==='true')
      const enabled = [...(sendOn?['CRM_EMAIL_SEND_ENABLED']:[]),'CRM_EMAIL_PRODUCTION_ENABLED','CRM_EMAIL_OAUTH_ISSUER_ENABLED','CRM_EMAIL_LIVE_MCP_ENABLED']
      requireTrue(enabled.every(key=>env[key]==='true') && env.CRM_EMAIL_SEND_ENABLED===(sendOn?'true':'false') &&
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
    await check('GATEWAY_DB', () => validateDatabase(env, 'iom_email_gateway', createClient, reviewOnly, singleSend, regular))
    await check('OAUTH_DB', () => validateDatabase(env, 'iom_email_oauth', createClient, reviewOnly, singleSend, regular))
  }
  await check('SIGNING_JWK', () => validateSigningKey(env.CRM_EMAIL_OAUTH_SIGNING_JWK))
  await check('PROJECTS_SENDER', () => {
    const identity = identities().find(item => item.id === 'projects')
    requireTrue(identity?.configured === true && identity.email === 'projects@iobjectm.com' &&
      identity.fromHeader === 'IOM Projects <projects@iobjectm.com>')
  })
  if(regular && env.CRM_EMAIL_STAFF_REVIEW_ENABLED==='true') {
    const contact=await check('CONTACT_SENDER', () => {
      const identity=identities().find(item=>item.id==='contact')
      requireTrue(identity?.configured===true && identity.email==='contact@iobjectm.com' &&
        identity.fromHeader==='IOM <contact@iobjectm.com>')
    })
    if(contact)await check('CONTACT_TRANSPORT',async()=>{
      requireTrue(typeof verifyContactTransport==='function')
      await verifyContactTransport(identities().find(item=>item.id==='contact'))
    })
    await check('VISUAL_SENDER', () => {
      const identity = identities().find(item => item.id === 'visual')
      requireTrue(identity?.configured === true && identity.email === 'visual@iobjectm.com' &&
        identity.fromHeader === 'IOM Visual <visual@iobjectm.com>')
    })
  }
  return { ok: results.every(row => row.status === 'PASS'), skipped: false, results }
}

export function releaseProof(env,result,verifier,now=Date.now()) {
  requireTrue(result.ok===true && result.skipped===false &&
    result.results.every(r=>r.status==='PASS') &&
    result.results.some(r=>r.check==='GATEWAY_DB') && result.results.some(r=>r.check==='CONTACT_TRANSPORT'))
  requireTrue(/^[0-9a-f-]{36}$/.test(env.CRM_EMAIL_RELEASE_RUN||'') &&
    ['A','B','C'].includes(env.CRM_EMAIL_RELEASE_BUILD) &&
    env.VERCEL_PROJECT_ID==='prj_fWUOXHiMmeE6RXfqgAAKJCi97nrv' &&
    /^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL||'') && /^[0-9a-f]{64}$/.test(verifier))
  const phase=emailReleasePhase(env.CRM_EMAIL_RELEASE_PHASE)
  requireTrue(phase===(env.CRM_EMAIL_RELEASE_BUILD==='C'?'ACTIVE':'PREPARED'))
  return {run:env.CRM_EMAIL_RELEASE_RUN,build:env.CRM_EMAIL_RELEASE_BUILD,phase,
    verifier,url:env.VERCEL_URL,project:env.VERCEL_PROJECT_ID,at:now,
    effective:true,ok:true,gateway:'iom_email_gateway',session:'iom_email_gateway',combinations:12,
    checks:result.results.map(r=>r.check)}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!buildValidationContext(process.env)) console.log('[crm-email-validation] CONTEXT SKIP')
    else {
      const [{ Client }, { EMAIL_PRODUCTION_APPROVAL }, { listProtonIdentities }, {default:nodemailer}] = await Promise.all([
        import('pg'), import('../api/_lib/crm-email-production.mjs'), import('../api/_lib/proton-identities.js'),import('nodemailer'),
      ])
      const result = await runBuildValidation({ env: process.env, approvalPin: EMAIL_PRODUCTION_APPROVAL,
        createClient: options => new Client(options), identities: listProtonIdentities,
        verifyContactTransport:identity=>verifyContactSmtp({env:process.env,identity,createTransport:options=>nodemailer.createTransport(options)}),
        emit: row => console.log(`[crm-email-validation] ${row.check} ${row.status}${row.detail ? ` ${row.detail}` : ''}`) })
      if (!result.ok) process.exitCode = 1
      else if(process.env.CRM_EMAIL_RELEASE_RUN) console.log('[crm-email-proof] '+JSON.stringify(
        releaseProof(process.env,result,createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'))))
    }
  } catch { console.log('[crm-email-validation] BOOTSTRAP FAIL'); process.exitCode = 1 }
}
