/**
 * Cloudflare R2 (S3-compatible) helpers — SigV4 presigned URLs.
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 */

import { createHash, createHmac } from 'node:crypto'

const REGION = 'auto'
const SERVICE = 's3'

/** Soft cap for one recording upload (R2 free is 10 GB total, not per-file). */
export const R2_MAX_UPLOAD_BYTES = 512 * 1024 * 1024

/**
 * @returns {{
 *   accountId: string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   bucket: string,
 *   host: string,
 * } | null}
 */
export function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket =
    process.env.R2_BUCKET?.trim() || 'crm-screen-recordings'
  if (!accountId || !accessKeyId || !secretAccessKey) return null
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    host: `${accountId}.r2.cloudflarestorage.com`,
  }
}

export function isR2Configured() {
  return Boolean(r2Config())
}

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

function hmac(key, data) {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

function signingKey(secret, dateStamp) {
  const kDate = hmac(`AWS4${secret}`, dateStamp)
  const kRegion = hmac(kDate, REGION)
  const kService = hmac(kRegion, SERVICE)
  return hmac(kService, 'aws4_request')
}

function encodeKey(key) {
  return String(key)
    .replace(/^\/+/, '')
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

/**
 * @param {{
 *   method: string,
 *   key: string,
 *   contentType?: string,
 *   expiresIn?: number,
 * }} opts
 */
export function createR2PresignedUrl(opts) {
  const cfg = r2Config()
  if (!cfg) throw new Error('R2 is not configured')

  const method = String(opts.method || 'GET').toUpperCase()
  const key = String(opts.key || '').replace(/^\/+/, '')
  if (!key) throw new Error('Missing object key')

  const expiresIn = Math.min(
    Math.max(Number(opts.expiresIn) || 7200, 60),
    60 * 60 * 24 * 7,
  )
  const contentType =
    method === 'PUT' && opts.contentType
      ? String(opts.contentType).split(';')[0].trim()
      : ''

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const credential = `${cfg.accessKeyId}/${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const signedHeaders = contentType ? 'content-type;host' : 'host'
  const canonicalUri = `/${cfg.bucket}/${encodeKey(key)}`

  /** @type {Map<string, string>} */
  const query = new Map([
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', credential],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresIn)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ])

  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
    )
    .join('&')

  const canonicalHeaders = contentType
    ? `content-type:${contentType}\nhost:${cfg.host}\n`
    : `host:${cfg.host}\n`

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${REGION}/${SERVICE}/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const signature = createHmac('sha256', signingKey(cfg.secretAccessKey, dateStamp))
    .update(stringToSign, 'utf8')
    .digest('hex')

  return `https://${cfg.host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

/** @param {string} key */
export async function r2ObjectExists(key) {
  const url = createR2PresignedUrl({ method: 'HEAD', key, expiresIn: 60 })
  const res = await fetch(url, { method: 'HEAD' })
  return res.ok
}

/** @param {string} key */
export async function r2DeleteObject(key) {
  const url = createR2PresignedUrl({ method: 'DELETE', key, expiresIn: 60 })
  const res = await fetch(url, { method: 'DELETE' })
  if (res.ok || res.status === 404) return
  const text = await res.text().catch(() => '')
  throw new Error(text.slice(0, 180) || `R2 delete failed (${res.status})`)
}
