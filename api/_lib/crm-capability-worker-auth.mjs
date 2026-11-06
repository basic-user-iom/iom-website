import { createHash, timingSafeEqual } from 'node:crypto'

export const CAPABILITY_WORKER_PATH = '/api/crm-capability-batch-tick'

export function validateCapabilityWorkerTransport(transport = 'pg-net') {
  if (!['pg-net', 'vercel-cron'].includes(transport)) {
    throw Object.assign(Error('capability_worker_transport_invalid'), { code: 'capability_worker_transport_invalid' })
  }
  return transport
}

// A GET tick carries no command, identity, query or payload. Check both parsed
// bodies and an unparsed stream; do not trust Content-Length alone.
export async function capabilityWorkerGetHasNoBody(req) {
  if (req.headers?.['transfer-encoding'] !== undefined) return false
  const length = req.headers?.['content-length']
  if (length !== undefined && String(length) !== '0') return false
  const body = req.body
  if (body !== undefined && body !== null && body !== '' && !(Buffer.isBuffer(body) && body.length === 0)) return false
  if (typeof req[Symbol.asyncIterator] === 'function') {
    for await (const part of req) if (Buffer.byteLength(part) !== 0) return false
  }
  return true
}

// Expected digest is injected by the server only after approved configuration.
// This module never generates credentials, reads env or logs a request/header.
export function createCapabilityWorkerAuth({ expectedSha256, transport = 'pg-net' } = {}) {
  validateCapabilityWorkerTransport(transport)
  if (typeof expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw Object.assign(Error('capability_worker_not_configured'), { code: 'capability_worker_not_configured' })
  }
  const expected = Buffer.from(expectedSha256, 'hex')
  const principal = Object.freeze({ kind: 'capability-worker', audience: CAPABILITY_WORKER_PATH })
  return Object.freeze({
    async verify(req) {
      if (req?.method !== (transport === 'vercel-cron' ? 'GET' : 'POST') ||
          req.url !== CAPABILITY_WORKER_PATH || req.headers?.origin !== undefined) return null
      if (transport === 'vercel-cron' && !await capabilityWorkerGetHasNoBody(req)) return null
      const header = req.headers?.authorization
      if (typeof header !== 'string' || !/^Bearer [A-Za-z0-9._~-]{32,512}$/.test(header)) return null
      const actual = createHash('sha256').update(header.slice(7)).digest()
      return timingSafeEqual(actual, expected) ? principal : null
    },
    authorize: candidate => candidate === principal,
  })
}
