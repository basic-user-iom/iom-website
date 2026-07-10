import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const baseDir = join(__dirname, '../public/demos/ssr-denoise')
const remoteBase = 'https://iomwebsite.vercel.app/demos/ssr-denoise/'

function hashBuffer(data) {
  return createHash('sha256').update(data).digest('hex').slice(0, 16)
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            data: Buffer.concat(chunks),
          })
        })
      })
      .on('error', reject)
  })
}

function listFiles(dir, prefix = '') {
  const files = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      files.push(...listFiles(path, `${prefix}${name}/`))
    } else {
      files.push(`${prefix}${name}`)
    }
  }
  return files
}

for (const file of listFiles(baseDir)) {
  const localData = readFileSync(join(baseDir, file))
  const local = { size: localData.length, hash: hashBuffer(localData) }
  const remote = await fetchUrl(`${remoteBase}${file}`)
  const remoteHash = hashBuffer(remote.data)
  const same = local.hash === remoteHash ? 'SAME' : 'DIFF'
  console.log(
    `${same}\t${file}\tlocal=${local.size}/${local.hash}\tremote=${remote.data.length}/${remoteHash}\tstatus=${remote.status}`,
  )
}
