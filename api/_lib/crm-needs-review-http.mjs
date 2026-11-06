import { CAPABILITY_WORKER_PATH, capabilityWorkerGetHasNoBody } from './crm-capability-worker-auth.mjs'

export const CAPABILITY_ORIGIN = 'https://iobjectm.com'
export const CAPABILITY_MCP_PATH = '/api/crm-capability-mcp'
export const CAPABILITY_RESOURCE = CAPABILITY_ORIGIN + CAPABILITY_MCP_PATH
export const CAPABILITY_OAUTH_PATHS = Object.freeze({
  projects: '/api/crm-capability-oauth-projects', visual: '/api/crm-capability-oauth-visual',
})
export const CAPABILITY_DISCOVERY_PATHS = Object.freeze(Object.fromEntries(['projects', 'visual'].map(sender =>
  [sender, `/.well-known/oauth-authorization-server/crm-capability-identity/${sender}`])))
const MAX_BODY = 1_000_000
const error = code => Object.assign(Error(code), { code })
function reply(res, status, code) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  return res.end(JSON.stringify({ ok: false, error: code }))
}
function headers(res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
}
async function bodyObject(req, max = MAX_BODY) {
  const length = req.headers?.['content-length']
  if (length !== undefined && (!/^\d+$/.test(String(length)) || Number(length) > max)) throw error('payload_too_large')
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type'] || '')) throw error('json_required')
  let body = req.body
  if (body === undefined) {
    const parts = []; let length = 0
    for await (const part of req) {
      const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part)
      length += bytes.length
      if (length > max) throw error('payload_too_large')
      parts.push(bytes)
    }
    body = Buffer.concat(parts)
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8')
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > max) throw error('payload_too_large')
    try { body = JSON.parse(body) } catch { throw error('invalid_json') }
  }
  if (!body || Array.isArray(body) || typeof body !== 'object') throw error('invalid_request')
  if (Buffer.byteLength(JSON.stringify(body)) > max) throw error('payload_too_large')
  return body
}
const inputStatus = code => ({ payload_too_large: 413, json_required: 415, invalid_json: 400, invalid_request: 400 })[code]

// SDK imports are lazy: disabled routes load neither SDK nor host dependencies.
async function serveMcp({ req, res, body, actor, runtime, enabled }) {
  const [{ Server }, { StreamableHTTPServerTransport }, { ListToolsRequestSchema, CallToolRequestSchema }] = await Promise.all([
    import('@modelcontextprotocol/sdk/server/index.js'), import('@modelcontextprotocol/sdk/server/streamableHttp.js'),
    import('@modelcontextprotocol/sdk/types.js'),
  ])
  const server = new Server({ name: 'iom-crm-capabilities', version: '1.0.0' }, { capabilities: { tools: {} } })
  const failure = code => ({ isError: true, content: [{ type: 'text', text: code }] })
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: enabled() ? await runtime.tools.listTools() : [] }))
  server.setRequestHandler(CallToolRequestSchema, async request => {
    if (!enabled()) return failure('crm_capabilities_disabled')
    if (actor.fromIdentity !== 'projects') return failure('capability_access_denied')
    return runtime.tools.execute(actor, request.params.name, request.params.arguments)
  })
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  const close = async () => { await transport.close(); await server.close() }
  res.once('close', () => { void close().catch(() => {}) })
  try { await server.connect(transport); await transport.handleRequest(req, res, body) }
  catch (error) { await close().catch(() => {}); throw error }
}

// Host.get() is called only after the explicit installation gate and cheap input
// checks. These routes never select owners, database targets or issuers from input.
export function createCapabilityHttpHandlers({ host, serve = serveMcp } = {}) {
  const enabled = () => host?.enabled?.() === true
  const unavailable = res => reply(res, 503, 'crm_capabilities_disabled')
  const mcp = async (req, res) => {
    headers(res)
    if (!enabled()) return unavailable(res)
    const raw = typeof req.url === 'string' ? req.url : ''
    if (req.method === 'GET' && raw === CAPABILITY_MCP_PATH + '?action=resource') {
      try { return res.status(200).json((await host.get()).resourceMetadata) }
      catch { return reply(res, 503, 'crm_capability_unavailable') }
    }
    if (raw !== CAPABILITY_MCP_PATH) return reply(res, 404, 'not_found')
    if (req.method !== 'POST') return reply(res, 405, 'method_not_allowed')
    if (req.headers?.origin !== undefined) return reply(res, 403, 'server_access_only')
    const auth = req.headers?.authorization
    if (typeof auth !== 'string' || !/^Bearer [A-Za-z0-9._~-]{1,16384}$/.test(auth)) {
      res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${CAPABILITY_RESOURCE}?action=resource"`)
      return reply(res, 401, 'invalid_capability_access')
    }
    try {
      const body = await bodyObject(req)
      const runtime = await host.get()
      let actor
      try { actor = await runtime.verifyAccessToken(auth.slice(7)) }
      catch { return reply(res, 401, 'invalid_capability_access') }
      if (!actor || actor.kind !== 'oauth' || !['projects', 'visual'].includes(actor.fromIdentity)) return reply(res, 401, 'invalid_capability_access')
      if (typeof runtime.rateLimit !== 'function' || await runtime.rateLimit(actor) !== true) return reply(res, 429, 'rate_limited')
      return await serve({ req, res, body, actor, runtime, enabled })
    } catch (failure) {
      if (!res.headersSent) return reply(res, inputStatus(failure.code) || 503, inputStatus(failure.code) ? failure.code : 'crm_capability_unavailable')
    }
  }
  const oauth = fromIdentity => async (req, res) => {
    headers(res)
    if (!enabled()) return unavailable(res)
    const pathname = typeof req.url === 'string' ? req.url.split('?')[0] : ''
    const discovery = pathname === CAPABILITY_DISCOVERY_PATHS[fromIdentity]
    if (pathname !== CAPABILITY_OAUTH_PATHS[fromIdentity] && !discovery) return reply(res, 404, 'not_found')
    if (discovery && (req.method !== 'GET' || req.url !== pathname)) return reply(res, 400, 'invalid_request')
    try {
      const handler = (await host.get()).oauthHandlers?.[fromIdentity]
      if (typeof handler !== 'function') return reply(res, 503, 'crm_capability_unavailable')
      if (!discovery) return await handler(req, res)
      // Discovery cannot be redirected to token/revoke by rewrite/query fields.
      const metadataRequest = Object.create(req)
      metadataRequest.url = CAPABILITY_OAUTH_PATHS[fromIdentity] + '?action=metadata'
      metadataRequest.query = { action: 'metadata' }
      return await handler(metadataRequest, res)
    } catch { if (!res.headersSent) return reply(res, 503, 'crm_capability_unavailable') }
  }
  const worker = async (req, res) => {
    headers(res)
    if (!enabled()) return unavailable(res)
    const transport = host.workerTransport ?? 'pg-net'
    if (!['pg-net', 'vercel-cron'].includes(transport)) return reply(res, 503, 'batch_dispatch_unavailable')
    if (req.url !== CAPABILITY_WORKER_PATH) return reply(res, 404, 'not_found')
    if (req.method !== (transport === 'vercel-cron' ? 'GET' : 'POST')) return reply(res, 405, 'method_not_allowed')
    if (req.headers?.origin !== undefined) return reply(res, 403, 'server_access_only')
    try {
      if (transport === 'vercel-cron') {
        if (!await capabilityWorkerGetHasNoBody(req)) return reply(res, 400, 'empty_trigger_body_required')
        // Vercel authentication and the worker-only pause precede host assembly,
        // OAuth/importer setup, database access and SMTP dependencies.
        if (typeof host.verifyWorkerRequest !== 'function') return reply(res, 503, 'batch_dispatch_unavailable')
        if (!await host.verifyWorkerRequest(req)) return reply(res, 401, 'worker_unauthorized')
        if (host.workerEnabled?.() !== true) return res.status(200).json({ ok: true, status: 'paused', reason: 'worker_paused' })
        if (host.workerScheduleAllowed?.('claim') !== true) return res.status(200).json({ ok: true, status: 'paused', reason: 'outside_worker_schedule' })
      } else {
        const body = await bodyObject(req, 32)
        if (Object.keys(body).length) return reply(res, 400, 'empty_trigger_body_required')
        req.body = body
      }
      const runtime = await host.get()
      if (typeof runtime.trigger !== 'function') return reply(res, 503, 'batch_dispatch_unavailable')
      // The composition's verifier checks the exact credential and returns a
      // non-forgeable in-process principal; no user IDs are accepted here.
      return await runtime.trigger(req, res)
    } catch (failure) {
      if (!res.headersSent) return reply(res, inputStatus(failure.code) || 503, inputStatus(failure.code) ? failure.code : 'batch_dispatch_unavailable')
    }
  }
  return Object.freeze({ mcp, projects: oauth('projects'), visual: oauth('visual'), worker })
}

// One physical function, exact original URL boundaries like the legacy router.
// Neither forwarded headers nor query/body fields select an identity or handler.
export function createCapabilityHttpRouter({ handlers } = {}) {
  return async (req, res) => {
    const path = typeof req.url === 'string' ? req.url.split('?')[0] : ''
    if (path === CAPABILITY_MCP_PATH) return handlers.mcp(req, res)
    if (path === CAPABILITY_WORKER_PATH) return handlers.worker(req, res)
    for (const sender of ['projects']) {
      if (path === CAPABILITY_OAUTH_PATHS[sender] || path === CAPABILITY_DISCOVERY_PATHS[sender]) return handlers[sender](req, res)
    }
    headers(res); return reply(res, 404, 'not_found')
  }
}
