#!/usr/bin/env node
// Called for an isolated, already built release. Credentials stay in the working checkout.
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { setDefaultResultOrder } from 'node:dns'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAssetsClient } from './r2-assets-client.mjs'
import { MANIFEST_FILE, PUBLIC_ORIGIN, inside, mediaType, objectKey, readAsset, releaseConfig, sha256, sourcePath, validateManifest } from './r2-release-manifest.mjs'
import { finalizeBuild } from './finalize-r2-build.mjs'

setDefaultResultOrder('ipv4first')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const stageArg = args.indexOf('--stage')
const verifyOnly = args.includes('--verify-only')
const PROJECT = 'prj_fWUOXHiMmeE6RXfqgAAKJCi97nrv'

async function publicRequest(key, method, headers = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(`${PUBLIC_ORIGIN}/${key}`, {
        method, headers: { 'accept-encoding': 'identity', origin: 'https://iobjectm.com', ...headers },
        redirect: 'error', signal: AbortSignal.timeout(60000),
      })
      if (attempt < 3 && (response.status === 429 || response.status >= 500)) await response.body?.cancel()
      else return response
    } catch { if (attempt === 3) throw new Error('Public R2 endpoint is unavailable; release has not been pruned') }
    await new Promise(done => setTimeout(done, 500 * (attempt + 1)))
  }
}

async function prepare() {
  if (stageArg < 0 || !args[stageArg + 1]) throw new Error('--stage is required')
  const stage = realpathSync(resolve(args[stageArg + 1]))
  if (stage === realpathSync(root) || !basename(stage).startsWith('iom-website-deploy-') || existsSync(join(stage, '.git'))) throw new Error('R2 preparation requires an isolated deployment snapshot')
  if (JSON.parse(readFileSync(join(stage, '.vercel/project.json'), 'utf8')).projectId !== PROJECT) throw new Error('Wrong Vercel project')
  const setting = JSON.parse(readFileSync(join(stage, 'config/website-r2.json'), 'utf8'))
  if (setting.version !== 1 || !setting.enabled || setting.origin !== PUBLIC_ORIGIN || setting.bucket !== 'iom-website-assets') throw new Error('Unexpected R2 configuration')
  if (existsSync(join(stage, MANIFEST_FILE))) throw new Error('Snapshot has already been prepared')
  const publicDir = realpathSync(join(stage, 'public'))
  if (!existsSync(join(stage, 'dist/index.html'))) throw new Error('Build the isolated snapshot first')
  const config = JSON.parse(readFileSync(join(stage, 'vercel.json'), 'utf8'))
  const pkg = JSON.parse(readFileSync(join(stage, 'package.json'), 'utf8'))
  if (config.buildCommand !== 'npm run build' || !pkg.scripts['build:ravens']) throw new Error('Build pipeline changed; review R2 preparation')
  const npx = join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js')
  const dryOutput = execFileSync(process.execPath, [npx, '--no-install', 'vercel', 'deploy', '--dry', '--format=json', '--cwd', stage], {
    cwd: stage, encoding: 'utf8', maxBuffer: 64000000, windowsHide: true,
  })
  const upload = JSON.parse(dryOutput.slice(dryOutput.indexOf('{')))
  if (!Array.isArray(upload.files) || !upload.files.length) throw new Error('Cannot enumerate release files')
  const included = new Set(upload.files.map(file => file.path.replaceAll('\\', '/')))
  const files = []
  function walk(directory, prefix = '') {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = `${prefix}/${item.name}`, disk = sourcePath(publicDir, path)
      if (item.isSymbolicLink()) throw new Error('Symlink in public assets; review before publication')
      if (item.isDirectory()) walk(disk, path)
      else if (item.isFile() && mediaType(path) && included.has(`public${path}`)) {
        const bytes = readAsset(publicDir, path)
        if (!bytes.length) continue
        const hash = sha256(bytes)
        files.push({ path, bytes: bytes.length, sha256: hash, key: objectKey(path, hash),
          contentType: mediaType(path), rangeSha256: sha256(bytes.subarray(0, Math.min(1024, bytes.length))) })
      }
    }
  }
  walk(publicDir)
  files.sort((a, b) => a.path.localeCompare(b.path))
  const manifest = validateManifest({ version: 1, origin: PUBLIC_ORIGIN, files })
  const finalConfig = releaseConfig(config, manifest)
  // Check output copies before uploading or changing anything in the stage.
  for (const entry of files) {
    const bytes = readAsset(join(stage, 'dist'), entry.path)
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) throw new Error(`Public/build asset mismatch: ${entry.path}`)
  }
  const client = await createAssetsClient()
  const objects = [...new Map(files.map(entry => [entry.key, entry])).values()]
  let cursor = 0, verified = 0, uploaded = 0, failure
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (!failure && cursor < objects.length) {
      const entry = objects[cursor++]
      try {
        let head = await client.request('HEAD', entry.key)
        let created = false
        if (head.status === 404) {
          if (verifyOnly) throw new Error(`R2 copy missing in verification-only mode: ${entry.path}`)
          const body = readAsset(publicDir, entry.path)
          if (sha256(body) !== entry.sha256) throw new Error('Release source changed during upload')
          const response = await client.request('PUT', entry.key, { body, headers: {
            'content-type': entry.contentType, 'cache-control': 'public, max-age=31536000, immutable',
            'content-md5': createHash('md5').update(body).digest('base64'), 'x-amz-meta-sha256': entry.sha256,
          } })
          await response.body?.cancel()
          if (!response.ok && response.status !== 412) throw new Error(`R2 upload failed: ${entry.path}`)
          created = response.ok; if (created) uploaded++
          head = await client.request('HEAD', entry.key)
        }
        if (head.status !== 200 || Number(head.headers.get('content-length')) !== entry.bytes || head.headers.get('x-amz-meta-sha256') !== entry.sha256) throw new Error(`R2 metadata differs: ${entry.path}`)
        entry.contentType = head.headers.get('content-type')
        const end = Math.min(1023, entry.bytes - 1)
        const range = await publicRequest(entry.key, 'GET', { range: `bytes=0-${end}` })
        if (range.status !== 206 || range.headers.get('content-range') !== `bytes 0-${end}/${entry.bytes}` || range.headers.get('access-control-allow-origin') !== '*') {
          await range.body?.cancel(); throw new Error(`Public R2 range/CORS check failed: ${entry.path}`)
        }
        if (sha256(Buffer.from(await range.arrayBuffer())) !== entry.rangeSha256) throw new Error(`Public R2 bytes differ: ${entry.path}`)
        if (created) {
          const response = await publicRequest(entry.key, 'GET')
          if (response.status !== 200) { await response.body?.cancel(); throw new Error(`New R2 object is unavailable: ${entry.path}`) }
          const hash = createHash('sha256'); let length = 0
          for await (const bytes of response.body) { length += bytes.length; hash.update(bytes) }
          if (length !== entry.bytes || hash.digest('hex') !== entry.sha256) throw new Error(`New R2 object content differs: ${entry.path}`)
        }
        verified++
        if (verified % 50 === 0) console.log(`R2: verified ${verified}/${objects.length} objects`)
      } catch (error) { failure ||= error }
    }
  }))
  if (failure) throw failure
  // All remote objects are readable. Recheck every source before making the package smaller.
  for (const entry of files) if (sha256(readAsset(publicDir, entry.path)) !== entry.sha256) throw new Error('Release source changed after verification')
  writeFileSync(join(stage, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n')
  // Ravens were built and verified above. Their exact generated files now come from R2.
  pkg.scripts['build:ravens'] = 'node scripts/finalize-r2-build.mjs --check-manifest'
  writeFileSync(join(stage, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
  writeFileSync(join(stage, 'vercel.json'), JSON.stringify(finalConfig, null, 2) + '\n')
  for (const entry of files) {
    const file = sourcePath(publicDir, entry.path)
    inside(stage, realpathSync(file))
    if (!lstatSync(file).isFile()) throw new Error('Asset source changed before pruning')
    unlinkSync(file)
  }
  const finalized = finalizeBuild(stage)
  const summary = { status: 'r2-release-prepared', verifyOnly, paths: files.length, objects: objects.length, uploaded,
    removedSourceBytes: files.reduce((n, e) => n + e.bytes, 0), ...finalized }
  console.log(JSON.stringify(summary))
}

prepare().catch(error => { console.error(error.message); process.exitCode = 1 })
