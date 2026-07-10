import { createServer } from 'node:http'
import { readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../public')
const port = Number(process.env.PORT || 4176)

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.glb': 'model/gltf-binary',
  '.hdr': 'application/octet-stream',
}

createServer((req, res) => {
  let pathname = decodeURIComponent(req.url.split('?')[0])
  if (pathname.endsWith('/')) pathname += 'index.html'
  const path = join(root, pathname.replace(/^\//, ''))
  try {
    const data = readFileSync(path)
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
}).listen(port, () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`)
})
