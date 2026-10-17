import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { importJWK, jwtVerify, SignJWT } from 'jose'
export class EmailOAuthError extends Error { constructor(code,status=400){super(code);this.code=code;this.status=status} }
import {EMAIL_SCOPES} from './crm-email-runtime.mjs'
import {assertProductionTarget,EMAIL_PRODUCTION_APPROVAL,EMAIL_PRODUCTION_RESOURCE,EMAIL_PRODUCTION_ISSUER,EMAIL_PRODUCTION_ORIGIN,EMAIL_PRODUCTION_REF} from './crm-email-production.mjs'
import {createProductionOAuthStore,acquireEmailOAuthConnection} from './crm-email-oauth-store.mjs'
const EMAIL_SCOPE_LIST=Object.values(EMAIL_SCOPES)

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const ACCESS_SECONDS = 300
const CODE_SECONDS = 60
const REFRESH_SECONDS = 14 * 24 * 60 * 60
const CONSENT_SECONDS = 5 * 60

const httpsUrl = value => {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) throw Error()
  return url
}
const digest = value => createHash('sha256').update(value).digest('hex')
const secret = () => randomBytes(32).toString('base64url')
const same = (left, right) => {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
const scopesOf = value => {
  const scopes = [...new Set(String(value ?? '').split(' ').filter(Boolean))]
  if (!scopes.length || !scopes.includes('iom:crm:email:read') || scopes.some(scope => !EMAIL_SCOPE_LIST.includes(scope))) {
    throw new EmailOAuthError('invalid_scope', 400)
  }
  return scopes.join(' ')
}
const pkce = (verifier, challenge) => {
  if (typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128 || !/^[A-Za-z0-9._~-]+$/.test(verifier)) return false
  return same(createHash('sha256').update(verifier).digest('base64url'), challenge)
}

export function issuerConfig(env = process.env,pin=EMAIL_PRODUCTION_APPROVAL) {
  try {
    const approved=assertProductionTarget(env,pin)
    if (env.CRM_EMAIL_OAUTH_ISSUER_ENABLED !== 'true') throw Error()
    const resource = httpsUrl(env.CRM_EMAIL_MCP_RESOURCE_URL)
    const issuer = httpsUrl(env.CRM_EMAIL_OAUTH_ISSUER)
    httpsUrl(env.CRM_EMAIL_OAUTH_REDIRECT_URI)
    if (resource.pathname !== '/api/crm-email-live-mcp') throw Error()
    if (issuer.hostname.endsWith('.supabase.co') || /\/auth\/v1\/?$/.test(issuer.pathname)) throw Error()
    if (String(env.CRM_EMAIL_OAUTH_REDIRECT_URI).includes('*')) throw Error()
    const clientId = env.CRM_EMAIL_OAUTH_CLIENT_ID
    const subject = env.CRM_EMAIL_OAUTH_SUBJECT
    const ownerId = env.CRM_EMAIL_OWNER_ID
    if(resource.href!==EMAIL_PRODUCTION_RESOURCE || issuer.href!==EMAIL_PRODUCTION_ISSUER ||
      clientId!==approved.clientId || ownerId!==approved.ownerId || subject!==approved.subject ||
      env.CRM_EMAIL_OAUTH_REDIRECT_URI!==approved.redirectUri)throw Error()
    if (!UUID.test(ownerId ?? '') || !subject || !clientId || subject.length > 250 || clientId.length > 250) throw Error()
    const signing = typeof env.CRM_EMAIL_OAUTH_SIGNING_JWK === 'string'
      ? JSON.parse(env.CRM_EMAIL_OAUTH_SIGNING_JWK) : env.CRM_EMAIL_OAUTH_SIGNING_JWK
    if (!signing || signing.kty !== 'EC' || signing.crv !== 'P-256' || !signing.d || !signing.x || !signing.y) throw Error()
    return Object.freeze({
      issuer: env.CRM_EMAIL_OAUTH_ISSUER,
      resource: resource.href,
      redirectUri: env.CRM_EMAIL_OAUTH_REDIRECT_URI,
      clientId, subject, ownerId, staffEmail:approved.staffEmail, signingJwk: signing, kid: 'iom-email-oauth-1',
    })
  } catch (error) {
    if (error instanceof EmailOAuthError) throw error
    throw new EmailOAuthError('oauth_issuer_disabled', 503)
  }
}

function assertStaff(config, staff) {
  if (!staff || staff.active === false || staff.aal !== 'aal2' || staff.id !== config.ownerId ||
      String(staff.email || '').toLowerCase() !== config.staffEmail) {
    throw new EmailOAuthError('consent_denied', 403)
  }
}

function publicJwk(config) {
  const {kty,crv,x,y}=config.signingJwk
  return {kty,crv,x,y,kid:config.kid,alg:'ES256',use:'sig'}
}

export function discoveryDocument(config) {
  const origin = new URL(config.issuer).origin
  const document = {
    issuer: config.issuer,
    authorization_endpoint: `${origin}/api/crm-email-oauth?action=authorize`,
    token_endpoint: `${origin}/api/crm-email-oauth?action=token`,
    revocation_endpoint: `${origin}/api/crm-email-oauth?action=revoke`,
    jwks_uri: `${origin}/api/crm-email-oauth?action=keys`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: [...EMAIL_SCOPE_LIST],
    token_endpoint_auth_methods_supported: ['none'],
    authorization_response_iss_parameter_supported: true,
  }
  try {
    if (new URL(config.clientId).protocol === 'https:') document.client_id_metadata_document_supported = true
  } catch { /* A predefined opaque client does not advertise CIMD or dynamic registration. */ }
  return document
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

export async function assertRegisteredClient(config, fetchMetadata = globalThis.fetch) {
  let clientUrl
  try { clientUrl = new URL(config.clientId) }
  catch { return }
  if (clientUrl.protocol !== 'https:' || clientUrl.username || clientUrl.password || clientUrl.search || clientUrl.hash) {
    throw new EmailOAuthError('invalid_client', 400)
  }
  let response
  try {
    response = await fetchMetadata(clientUrl.href, {
      method: 'GET', redirect: 'manual', headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
  } catch { throw new EmailOAuthError('invalid_client', 400) }
  if (!response || response.status !== 200) throw new EmailOAuthError('invalid_client', 400)
  const text = typeof response.text === 'function' ? await response.text() : ''
  if (text.length > 65536) throw new EmailOAuthError('invalid_client', 400)
  let document
  try { document = JSON.parse(text) }
  catch { throw new EmailOAuthError('invalid_client', 400) }
  const redirects = Array.isArray(document.redirect_uris) ? document.redirect_uris : []
  const methods = Array.isArray(document.token_endpoint_auth_methods_supported) ? document.token_endpoint_auth_methods_supported : []
  if (document.client_id !== config.clientId || !redirects.includes(config.redirectUri) || !methods.includes('none')) {
    throw new EmailOAuthError('invalid_client', 400)
  }
}

function assertAuthorizeRequest(config, input) {
  if (input?.client_id !== config.clientId) throw new EmailOAuthError('invalid_client', 400)
  if (input?.redirect_uri !== config.redirectUri || input?.resource !== config.resource) throw new EmailOAuthError('invalid_request', 400)
  if (input?.response_type !== 'code' || input?.code_challenge_method !== 'S256' || !input?.state) throw new EmailOAuthError('invalid_request', 400)
  if (typeof input.code_challenge !== 'string' || input.code_challenge.length < 43 || input.code_challenge.length > 128) {
    throw new EmailOAuthError('invalid_request', 400)
  }
  return scopesOf(input.scope)
}

function consentPage(config, query, authRef = '') {
  if (!/^[a-z0-9]{20}$/.test(authRef)) authRef = ''
  const next = `/api/crm-email-oauth?action=authorize&${new URLSearchParams({
    response_type: 'code', client_id: config.clientId, redirect_uri: config.redirectUri,
    resource: config.resource, scope: String(query.scope), state: String(query.state),
    code_challenge: String(query.code_challenge), code_challenge_method: 'S256',
  }).toString()}`
  const login = `/client-login?next=${encodeURIComponent(next)}`
  const scopes = String(query.scope).split(' ').filter(Boolean).map(scope => `<li>${escapeHtml(scope)}</li>`).join('')
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>IOM CRM email consent</title><body><main id="consent" data-issuer="${escapeHtml(config.issuer)}" data-redirect="${escapeHtml(config.redirectUri)}" data-resource="${escapeHtml(config.resource)}" data-client="${escapeHtml(config.clientId)}" data-state="${escapeHtml(query.state)}" data-scope="${escapeHtml(query.scope)}" data-challenge="${escapeHtml(query.code_challenge)}" data-login="${escapeHtml(login)}" data-auth-ref="${escapeHtml(authRef)}"><h1>Connect ChatGPT to IOM CRM email</h1><p>This connection can review, send, schedule and cancel email for the approved pilot contact. Each email needs an explicit review and confirmation.</p><ul>${scopes}</ul><p id="status">Checking the existing CRM sign-in.</p><p><a id="login" href="${escapeHtml(login)}">Sign in at the CRM</a></p><button id="allow" type="button" hidden>Allow</button><button id="deny" type="button">Deny</button></main><script>
const root=document.getElementById('consent'),status=document.getElementById('status'),login=document.getElementById('login'),allow=document.getElementById('allow')
function readSession(){const ref=root.dataset.authRef;if(!/^[a-z0-9]{20}$/.test(ref||''))return null;try{const parsed=JSON.parse(localStorage.getItem('sb-'+ref+'-auth-token')||'');const token=parsed&&(parsed.access_token||(parsed.currentSession&&parsed.currentSession.access_token));if(!token||token.split('.').length!==3)return null;const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.iss!=='https://'+ref+'.supabase.co/auth/v1')return null;return{token,aal:payload.aal}}catch(e){return null}}
function deny(){const url=new URL(root.dataset.redirect);url.searchParams.set('error','access_denied');url.searchParams.set('state',root.dataset.state);url.searchParams.set('iss',root.dataset.issuer);location.assign(url.toString())}
document.getElementById('deny').addEventListener('click',deny)
const session=readSession()
if(!session||session.aal!=='aal2'){status.textContent='Sign in with the approved CRM staff account and finish the authenticator prompt, then return here.'}
else{login.hidden=true;allow.hidden=false;status.textContent='Signed in. Allow only the ChatGPT connection you just started.';allow.addEventListener('click',async()=>{allow.disabled=true;const headers={'content-type':'application/json',authorization:'Bearer '+session.token};const body={response_type:'code',client_id:root.dataset.client,redirect_uri:root.dataset.redirect,resource:root.dataset.resource,scope:root.dataset.scope,state:root.dataset.state,code_challenge:root.dataset.challenge,code_challenge_method:'S256'};const started=await fetch(location.pathname+'?action=authorize',{method:'POST',headers,body:JSON.stringify(body)});const startedBody=await started.json();if(!started.ok){deny();return}const approved=await fetch(location.pathname+'?action=authorize',{method:'POST',headers,body:JSON.stringify({consent_token:startedBody.consent_token,request_id:startedBody.request_id})});const approvedBody=await approved.json();if(!approved.ok||!approvedBody.redirect){deny();return}location.assign(approvedBody.redirect)})}
</script></body></html>`
}

function rowFrom(record) {
  if (!record) return null
  if (record.familyId || record.requestId || record.codeChallenge) return record
  return {
    familyId: record.family_id, clientId: record.client_id, redirectUri: record.redirect_uri,
    resource: record.resource, scope: record.scope, codeChallenge: record.code_challenge,
    ownerId: record.owner_id, state: record.state, requestId: record.request_id,
  }
}

export async function createIssuer(config, store, options = {}) {
  const now = options.now ?? (() => Date.now())
  const fetchMetadata = options.fetchMetadata ?? globalThis.fetch
  const privateKey = await importJWK(config.signingJwk, 'ES256')
  const published = publicJwk(config)
  const publicKey = await importJWK({ kty: published.kty, crv: published.crv, x: published.x, y: published.y }, 'ES256')
  const at = seconds => new Date(now() + seconds * 1000).toISOString()
  async function accessToken(row) {
    const iat = Math.floor(now() / 1000)
    return new SignJWT({
      client_id: config.clientId, scope: row.scope, iom_crm_access: 'email_workflow',
      role: 'iom_email_oauth', grant_family: row.familyId, owner_id:config.ownerId,
    }).setProtectedHeader({ alg: 'ES256', kid: config.kid, typ: 'JWT' })
      .setIssuer(config.issuer).setSubject(config.subject).setAudience(config.resource)
      .setIssuedAt(iat).setExpirationTime(iat + ACCESS_SECONDS).sign(privateKey)
  }
  async function stored(work) {
    try { return await work() }
    catch (error) {
      if (error instanceof EmailOAuthError) throw error
      throw new EmailOAuthError('grant_store_unavailable', 503)
    }
  }
  return {
    discovery: () => discoveryDocument(config),
    jwks: () => ({ keys: [publicJwk(config)] }),
    async begin(input, staff) {
      assertStaff(config, staff)
      if(!await store.staffActive())throw new EmailOAuthError('consent_denied',403)
      await assertRegisteredClient(config, fetchMetadata)
      const scope = assertAuthorizeRequest(config, input)
      const consent = secret()
      const requestId = secret()
      await stored(() => store.saveRequest({
        digest: digest(consent), requestId, clientId: config.clientId, redirectUri: config.redirectUri,
        resource: config.resource, scope, state: String(input.state), codeChallenge: input.code_challenge,
        ownerId: config.ownerId, expiresAt: at(CONSENT_SECONDS),
      }))
      return { request_id: requestId, consent_token: consent }
    },
    async approve(input, staff) {
      assertStaff(config, staff)
      if(!await store.staffActive())throw new EmailOAuthError('consent_denied',403)
      if (typeof input?.consent_token !== 'string' || typeof input?.request_id !== 'string') throw new EmailOAuthError('invalid_request', 400)
      const pending = rowFrom(await stored(() => store.consumeRequest(digest(input.consent_token), input.request_id)))
      if (!pending || pending.redirectUri !== config.redirectUri || pending.ownerId!==config.ownerId) throw new EmailOAuthError('invalid_grant', 400)
      const code = secret()
      const familyId = randomUUID()
      await stored(() => store.saveCode({
        digest: digest(code), familyId, clientId: config.clientId, redirectUri: config.redirectUri,
        resource: config.resource, scope: pending.scope, codeChallenge: pending.codeChallenge,
        ownerId: config.ownerId, expiresAt: at(CODE_SECONDS),
      }))
      const redirect = new URL(config.redirectUri)
      redirect.searchParams.set('code', code)
      redirect.searchParams.set('state', pending.state)
      redirect.searchParams.set('iss', config.issuer)
      return { redirect: redirect.toString(), family_id: familyId }
    },
    async token(input) {
      if(!await store.staffActive())throw new EmailOAuthError('invalid_grant',400)
      if(input?.scope!==undefined)throw new EmailOAuthError('invalid_scope',400)
      if (input?.client_id !== config.clientId || input?.resource !== config.resource) throw new EmailOAuthError('invalid_client', 400)
      if (input.grant_type === 'authorization_code') return exchangeCode(input)
      if (input.grant_type === 'refresh_token') return exchangeRefresh(input)
      throw new EmailOAuthError('invalid_grant', 400)
    },
    async revoke(input) {
      const token = input?.token
      if (typeof token !== 'string' || !token || token.length > 4000) return { ok: true }
      await stored(() => store.revokePresented(digest(token)))
      const familyId = await presentedFamily(token)
      if (familyId) await stored(() => store.revokeFamily(familyId))
      return { ok: true }
    },
  }

  async function presentedFamily(token) {
    if (typeof token !== 'string' || token.split('.').length !== 3) return null
    try {
      const { payload } = await jwtVerify(token, publicKey, {
        issuer: config.issuer, audience: config.resource, subject: config.subject, algorithms: ['ES256'],
      })
      return typeof payload.grant_family === 'string' ? payload.grant_family : null
    } catch { return null }
  }
  function challengeFor(verifier) {
    if (!pkce(verifier, createHash('sha256').update(String(verifier ?? '')).digest('base64url'))) return 'invalid-challenge'
    return createHash('sha256').update(verifier).digest('base64url')
  }
  async function exchangeCode(input) {
    if (input.redirect_uri !== config.redirectUri || typeof input.code !== 'string') throw new EmailOAuthError('invalid_grant', 400)
    const refresh = secret()
    const row = rowFrom(await stored(() => store.exchangeCode({
      codeDigest: digest(input.code), challenge: challengeFor(input.code_verifier),
      refreshDigest: digest(refresh), refreshExpires: at(REFRESH_SECONDS),
    })))
    if (!row || row.redirectUri !== config.redirectUri) throw new EmailOAuthError('invalid_grant', 400)
    return tokenResponse(row, refresh)
  }
  async function exchangeRefresh(input) {
    if (typeof input.refresh_token !== 'string') throw new EmailOAuthError('invalid_grant', 400)
    const refresh = secret()
    const row = rowFrom(await stored(() => store.rotateRefresh({
      oldDigest: digest(input.refresh_token), refreshDigest: digest(refresh), refreshExpires: at(REFRESH_SECONDS),
    })))
    if (!row) throw new EmailOAuthError('invalid_grant', 400)
    return tokenResponse(row, refresh)
  }
  async function tokenResponse(row, refresh) {
    if(row.ownerId!==config.ownerId || row.clientId!==config.clientId || row.resource!==config.resource || !await store.grantActive(row.familyId))throw new EmailOAuthError('invalid_grant',400)
    return {
      access_token: await accessToken(row), token_type: 'Bearer', expires_in: ACCESS_SECONDS,
      scope: row.scope, refresh_token: refresh,
    }
  }
}


export function oauthContentType(req) {
  const raw = req?.headers?.['content-type'] ?? req?.headers?.['Content-Type'] ?? ''
  return String(Array.isArray(raw) ? raw[0] : raw).split(';')[0].trim().toLowerCase()
}

function formFields(text) {
  const body = {}
  for (const [key, value] of new URLSearchParams(text)) {
    if (!Object.hasOwn(body, key)) body[key] = value
  }
  return body
}

export async function readOauthBody(req) {
  const chunks = []
  let size=0
  if (req && typeof req[Symbol.asyncIterator] === 'function') {
    for await (const chunk of req) {const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=b.length;if(size>16384)throw new EmailOAuthError('invalid_request',400);chunks.push(b)}
  }
  let text = Buffer.concat(chunks).toString('utf8')
  if (!text && typeof req?.body === 'string') text = req.body
  if (text.length > 16384) throw new EmailOAuthError('invalid_request', 400)
  const type = oauthContentType(req)
  if (type === 'application/x-www-form-urlencoded') return { body: formFields(text), type }
  if (!text && req?.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    if(Array.isArray(req.body)||JSON.stringify(req.body).length>16384)throw new EmailOAuthError('invalid_request',400)
    return { body: req.body, type: type || 'application/json' }
  }
  if (type === 'application/json' || type === '') {
    try { return { body: JSON.parse(text || '{}'), type: type || 'application/json' } }
    catch { throw new EmailOAuthError('invalid_request', 400) }
  }
  throw new EmailOAuthError('invalid_request', 400)
}

export function createEmailIssuerHttp({configure=issuerConfig,storeFactory=config=>createProductionOAuthStore(acquireEmailOAuthConnection,config.ownerId),
  staffAuth=async req=>(await import('./blog-helpers.js')).requireStaffUser(req),fetchMetadata=globalThis.fetch}={}) {
return async function emailIssuerHttp(req,res) {
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer')
  res.setHeader('X-Content-Type-Options','nosniff')
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
  try {
    const config=configure()
    const url=new URL(req.url||'/',EMAIL_PRODUCTION_ORIGIN)
    // Adapters may preserve the original URL or put rewrite parameters in req.query.
    const discoveryActions={
      '/.well-known/oauth-authorization-server/crm-email-identity':'metadata',
      '/.well-known/oauth-protected-resource/api/crm-email-live-mcp':'resource',
    }
    if(req.query?.action!==undefined && typeof req.query.action!=='string')throw new EmailOAuthError('invalid_request',400)
    const action=discoveryActions[url.pathname]||url.searchParams.get('action')||req.query?.action||'metadata'
    if(['metadata','keys','resource'].includes(action)) {
      if(req.method!=='GET')throw new EmailOAuthError('method_not_allowed',405)
      return res.status(200).json(action==='metadata'?discoveryDocument(config):action==='keys'?{keys:[publicJwk(config)]}:{
        resource:config.resource,authorization_servers:[config.issuer],scopes_supported:EMAIL_SCOPE_LIST,bearer_methods_supported:['header']})
    }
    if(!['authorize','token','revoke'].includes(action))throw new EmailOAuthError('invalid_request',400)
    const store=storeFactory(config)
    if(!await store.rateLimit())throw new EmailOAuthError('rate_limited',429)
    if(action==='authorize' && req.method==='GET') {
      const query=Object.fromEntries(url.searchParams)
      await assertRegisteredClient(config,fetchMetadata);assertAuthorizeRequest(config,query)
      res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('X-Robots-Tag','noindex')
      return res.status(200).send(consentPage(config,query,EMAIL_PRODUCTION_REF))
    }
    if(req.method!=='POST')throw new EmailOAuthError('method_not_allowed',405)
    if(action==='authorize' && req.headers?.origin!==EMAIL_PRODUCTION_ORIGIN)throw new EmailOAuthError('consent_denied',403)
    const {body}=await readOauthBody(req)
    const issuer=await createIssuer(config,store,{fetchMetadata})
    if(action==='token')return res.status(200).json(await issuer.token(body))
    if(action==='revoke')return res.status(200).json(await issuer.revoke(body))
    const auth=await staffAuth(req)
    if(!auth.ok || auth.aal!=='aal2')throw new EmailOAuthError('consent_denied',403)
    const staff={id:auth.user.id,email:auth.user.email,aal:auth.aal,active:true}
    return res.status(200).json(body?.consent_token?await issuer.approve(body,staff):await issuer.begin(body,staff))
  } catch(error) {
    if(!res.headersSent)return res.status(error instanceof EmailOAuthError?error.status:503).json({ok:false,error:error instanceof EmailOAuthError?error.code:'email_oauth_unavailable'})
  }
}


}
export const emailIssuerHttp=createEmailIssuerHttp()
