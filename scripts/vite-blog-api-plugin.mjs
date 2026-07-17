/**
 * Vite plugin: serve /api/blog-comment-* locally during `npm run dev`
 * so comment verify flow can be tested without `vercel dev`.
 */
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(raw)
      }
    })
    req.on('error', reject)
  })
}

function makeRes(res) {
  let statusCode = 200
  const headers = {}
  return {
    statusCode,
    setHeader(k, v) {
      headers[k] = v
      res.setHeader(k, v)
    },
    getHeader(k) {
      return headers[k] || res.getHeader(k)
    },
    status(code) {
      statusCode = code
      this.statusCode = code
      return this
    },
    json(obj) {
      if (!res.headersSent) {
        res.statusCode = statusCode
        res.setHeader('Content-Type', 'application/json')
      }
      res.end(JSON.stringify(obj))
    },
    end(body) {
      if (!res.headersSent) res.statusCode = statusCode
      res.end(body)
    },
    writeHead(code, hdrs) {
      statusCode = code
      res.writeHead(code, hdrs)
    },
  }
}

async function loadHandler(root, name) {
  const file = join(root, 'api', `${name}.js`)
  const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`)
  return mod.default
}

/** @param {string} [root] project root (defaults to process.cwd()) */
export function blogApiDevPlugin(root = process.cwd()) {
  return {
    name: 'iom-blog-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        const path = url.split('?')[0]
        let handlerName = null
        if (path === '/api/blog-comment-submit') handlerName = 'blog-comment-submit'
        else if (path === '/api/blog-comment-verify') handlerName = 'blog-comment-verify'
        if (!handlerName) return next()

        try {
          const handler = await loadHandler(root, handlerName)
          const q = Object.fromEntries(new URL(url, 'http://localhost').searchParams)
          const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : {}
          const fakeReq = {
            method: req.method,
            headers: req.headers,
            query: q,
            body,
            url,
          }
          await handler(fakeReq, makeRes(res))
        } catch (err) {
          console.error('[blog-api-dev]', err)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'API error' }))
          }
        }
      })
    },
  }
}
