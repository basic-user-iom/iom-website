import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { createHash, createHmac } from 'node:crypto'

export const digest = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest('hex')
const hmac = (key, value) => createHmac('sha256', key).update(value).digest()

export async function createAssetsClient() {
  const env = parseEnv(await readFile(new URL('../.env.r2-assets.local', import.meta.url), 'utf8'))
  const account = env.WEBSITE_R2_ACCOUNT_ID?.trim()
  const access = env.WEBSITE_R2_ACCESS_KEY_ID?.trim()
  const secret = env.WEBSITE_R2_SECRET_ACCESS_KEY?.trim()
  const bucket = env.WEBSITE_R2_BUCKET?.trim()
  if (!/^[a-f0-9]{32}$/i.test(account || '') || !/^[a-f0-9]{32}$/i.test(access || '') ||
      !/^[a-f0-9]{64}$/i.test(secret || '') || bucket !== 'iom-website-assets') {
    throw new Error('Website R2 configuration missing or invalid')
  }
  const hostname = `${account}.r2.cloudflarestorage.com`
  return {
    bucket,
    async request(method, key, { body, headers = {} } = {}) {
      // Fixed bucket, content-addressed keys, no delete, no overwrite or bucket configuration operations.
      if (!['HEAD', 'GET', 'PUT'].includes(method)) throw new Error('Unsupported assets operation')
      if (!/^iom-website\/v1\/[a-f0-9]{64}\/[A-Za-z0-9._-]+$/.test(key)) throw new Error('Unexpected asset key')
      if (method === 'PUT' && (!Buffer.isBuffer(body) || digest(body) !== key.split('/')[2])) {
        throw new Error('Upload bytes do not match the immutable object key')
      }
      const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
      const day = date.slice(0, 8)
      const scope = `${day}/auto/s3/aws4_request`
      const payload = digest(body || '')
      const path = `/${bucket}/${key}`
      const signed = {
        'accept-encoding': 'identity', ...headers, host: hostname,
        'x-amz-date': date, 'x-amz-content-sha256': payload,
        ...(method === 'PUT' ? { 'if-none-match': '*' } : {}),
      }
      const names = Object.keys(signed).sort()
      if (names.some(name => name !== name.toLowerCase())) throw new Error('Headers must be lowercase')
      const canonical = [method, path, '',
        names.map(name => `${name}:${String(signed[name]).trim()}\n`).join(''), names.join(';'), payload].join('\n')
      const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), 'auto'), 's3'), 'aws4_request')
      const signature = createHmac('sha256', signingKey)
        .update(['AWS4-HMAC-SHA256', date, scope, digest(canonical)].join('\n')).digest('hex')
      // Retrying PUT is safe: content-addressed bytes and If-None-Match forbid overwrites.
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const response = await fetch(`https://${hostname}${path}`, {
            method, body, redirect: 'error', signal: AbortSignal.timeout(60_000),
            headers: { ...signed,
              authorization: `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` },
          })
          if (attempt < 3 && (response.status === 429 || response.status >= 500)) {
            await response.body?.cancel()
          } else return response
        } catch {
          if (attempt === 3) throw new Error('Website R2 network request failed; credentials and raw errors are not logged')
        }
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
      }
    },
  }
}
