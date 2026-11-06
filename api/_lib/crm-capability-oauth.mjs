import { jwtVerify } from 'jose'

// New capability mode is opt-in. No environment, credentials, network key lookup,
// route registration or live owner is selected by this module.
export const CAPABILITY_OAUTH_SCOPES = Object.freeze(['iom:crm:read', 'iom:crm:import', 'iom:crm:contacts:approve',
  'iom:crm:email:read', 'iom:crm:email:send', 'iom:crm:email:batch:confirm', 'iom:crm:email:batch:cancel'])
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const origin = 'https://iobjectm.com'
const fail = code => { throw Object.assign(new Error(code), { code, status: 503 }) }
export const capabilityRevision = sender => ['projects', 'visual'].includes(sender) ? `capability-${sender}-v1` : null

export function validCapabilityScopes(scopes) {
  if (!Array.isArray(scopes) || !scopes.length || new Set(scopes).size !== scopes.length || scopes.some(s => !CAPABILITY_OAUTH_SCOPES.includes(s))) return false
  if (scopes.some(s => ['iom:crm:import', 'iom:crm:contacts:approve'].includes(s)) && !scopes.includes('iom:crm:read')) return false
  if (scopes.some(s => ['iom:crm:email:send', 'iom:crm:email:batch:cancel', 'iom:crm:email:batch:confirm'].includes(s)) && !scopes.includes('iom:crm:email:read')) return false
  return !scopes.includes('iom:crm:email:batch:confirm') || scopes.includes('iom:crm:email:send')
}

export function validateCapabilityOAuthPin(pin, fromIdentity) {
  const revision = capabilityRevision(fromIdentity)
  if (!revision || !pin || pin.fromIdentity !== fromIdentity || pin.accessRevision !== revision || !uuid.test(pin.ownerId || '') ||
      pin.clientId !== 'https://chatgpt.com/oauth/client.json' || pin.redirectUri !== 'https://chatgpt.com/connector_platform_oauth_redirect' ||
      typeof pin.staffEmail !== 'string' || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(pin.staffEmail) ||
      pin.subject !== `iom-crm-capability:${fromIdentity}:${pin.ownerId}` || !validCapabilityScopes(pin.scopes) ||
      !Number.isFinite(Date.parse(pin.grantExpiresAt)) || Date.parse(pin.grantExpiresAt) <= Date.now()) fail('oauth_issuer_disabled')
  return pin
}

export function createCapabilityOAuthConfig({ enabled = () => false, pins = {}, fromIdentity, signingJwk } = {}) {
  if (typeof enabled !== 'function' || enabled() !== true) fail('oauth_issuer_disabled')
  const pin = validateCapabilityOAuthPin(pins[fromIdentity],fromIdentity), revision = capabilityRevision(fromIdentity)
  if(signingJwk?.kty !== 'EC' || signingJwk.crv !== 'P-256' || !signingJwk.d || !signingJwk.x || !signingJwk.y)fail('oauth_issuer_disabled')
  return Object.freeze({ capabilityMode: true, fromIdentity, accessRevision: revision, ownerId: pin.ownerId,
    issuer: `${origin}/crm-capability-identity/${fromIdentity}`, issuerEndpoint: `${origin}/api/crm-capability-oauth-${fromIdentity}`,
    resource: `${origin}/api/crm-capability-mcp`, clientId: pin.clientId, redirectUri: pin.redirectUri,
    subject: pin.subject, staffEmail: pin.staffEmail.toLowerCase(), scopes: Object.freeze([...pin.scopes]),
    grantExpiresAt: pin.grantExpiresAt, signingJwk, kid: `iom-capability-${fromIdentity}-1` })
}

export function assertCapabilityOAuthConfig(config) {
  const s = config?.fromIdentity
  if (config?.capabilityMode !== true || !capabilityRevision(s) || config.accessRevision !== capabilityRevision(s) || !uuid.test(config.ownerId || '') ||
      config.issuer !== `${origin}/crm-capability-identity/${s}` || config.issuerEndpoint !== `${origin}/api/crm-capability-oauth-${s}` ||
      config.resource !== `${origin}/api/crm-capability-mcp` || config.subject !== `iom-crm-capability:${s}:${config.ownerId}` ||
      config.clientId !== 'https://chatgpt.com/oauth/client.json' || config.redirectUri !== 'https://chatgpt.com/connector_platform_oauth_redirect' ||
      !validCapabilityScopes(config.scopes) || !Number.isFinite(Date.parse(config.grantExpiresAt))) fail('oauth_issuer_disabled')
  return config
}

export function createCapabilityVerifier(config, keys, { grantActive } = {}) {
  assertCapabilityOAuthConfig(config)
  if (!keys || typeof grantActive !== 'function') fail('capability_verifier_not_configured')
  return async token => {
    try {
      const { payload: p } = await jwtVerify(token, keys, { issuer: config.issuer, audience: config.resource, subject: config.subject,
        algorithms: ['ES256'], requiredClaims: ['sub','iss','aud','exp','iat','client_id','scope','iom_crm_access','grant_family','owner_id','from_identity','email_access_revision'],
        maxTokenAge: '10m', clockTolerance: 5 })
      const scopes = typeof p.scope === 'string' ? p.scope.split(' ').filter(Boolean) : []
      if (p.aud !== config.resource || p.client_id !== config.clientId || p.iom_crm_access !== 'crm_capabilities' || p.role !== 'iom_email_oauth' ||
          p.owner_id !== config.ownerId || p.from_identity !== config.fromIdentity || p.email_access_revision !== config.accessRevision ||
          !uuid.test(p.grant_family || '') || p.exp - p.iat > 300 || p.exp <= p.iat || !validCapabilityScopes(scopes) ||
          scopes.some(s => !config.scopes.includes(s)) || Date.parse(config.grantExpiresAt) <= Date.now()) throw Error()
      const actor = { kind: 'oauth', ownerId: config.ownerId, fromIdentity: config.fromIdentity, accessRevision: config.accessRevision, grantFamily: p.grant_family, scopes }
      if (await grantActive(actor) !== true) throw Error()
      return actor
    } catch { fail('invalid_capability_access') }
  }
}
