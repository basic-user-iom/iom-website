import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { matchesDeployScope } from './deploy-scope.mjs'
import { scanReleaseFile, credentialPath, safeRelative } from './deploy-secret-scan.mjs'
import { validateManifest, sha256, PUBLIC_ORIGIN } from './r2-release-manifest.mjs'

export const REUSE_FILE = '.iom-r2-reuse.json'
const MAX_FILE = 128 * 1024 * 1024
const POLICY_FILES = ['deploy-secret-scan.mjs', 'deploy-secret-containers.mjs',
  'deploy-reviewed-public-data.mjs', 'deploy-reviewed-public-data.json',
  'deploy-reviewed-protocol-data.mjs', 'deploy-reviewed-protocol-data.json',
  'incremental-r2-release.mjs', 'r2-release-manifest.mjs']
const git = (root, args, input) => execFileSync('git', args, {
  cwd: root, input, maxBuffer: 256 * 1024 * 1024, windowsHide: true,
})
export function scanPolicy(root) {
  return sha256(Buffer.concat(POLICY_FILES.map(name => readFileSync(join(root, 'scripts', name)))))
}
export function commitFiles(root, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw Error('Invalid snapshot commit')
  const result = new Map()
  for (const line of git(root, ['ls-tree', '-r', '-l', commit]).toString().trim().split('\n')) {
    const [meta, path] = line.split('\t'), [mode, type, oid, size] = meta.trim().split(/\s+/)
    if (!safeRelative(path)) throw Error('Unsafe committed path')
    result.set(path, { path, mode, type, oid, bytes: Number(size) })
  }
  return result
}
export function snapshotFiles(root, base, overlays) {
  const files = commitFiles(root, base)
  for (const [scope, commit] of Object.entries(overlays)) {
    for (const path of files.keys()) if (matchesDeployScope(path, scope)) files.delete(path)
    for (const [path, file] of commitFiles(root, commit)) if (matchesDeployScope(path, scope)) files.set(path, file)
  }
  return files
}
export function assertPublicEntry(entry) {
  if (!safeRelative(`public${entry.path}`) || credentialPath(`public${entry.path}`) ||
      entry.access === 'private' || entry.access === 'protected' || entry.bytes > MAX_FILE) {
    throw Error('Media reuse refused: private, unsafe or oversized entry')
  }
}
export function matchingBytes(entry, source) {
  if (source.length === entry.bytes && sha256(source) === entry.sha256) return source
  // checkout-index applies core.autocrlf to text. Accept only the exact deployed bytes.
  if (/\.(svg|gltf|obj|mtl|json|js)$/i.test(entry.path)) {
    const text = source.toString('utf8')
    if (Buffer.from(text).equals(source)) {
      const converted = Buffer.from(text.replace(/\r?\n/g, '\r\n'))
      if (converted.length === entry.bytes && sha256(converted) === entry.sha256) return converted
    }
  }
  return null
}
export function assessReuse(entry, sourceIdentity, readSource, policyId, knownValues = []) {
  assertPublicEntry(entry)
  if (!/^(git:[a-f0-9]{40}|gzip:[a-f0-9]{64})$/.test(sourceIdentity)) throw Error('Invalid source identity')
  // Receipts come ONLY from the authenticated, pinned production source manifest.
  // Supplied known values force a fresh scan; no secret-derived digest is persisted.
  if (knownValues.length === 0 && entry.reuse?.sourceIdentity === sourceIdentity && entry.reuse?.policyId === policyId) {
    return { ...entry, access: 'public', delivery: entry.delivery ?? 'legacy' }
  }
  const bytes = matchingBytes(entry, readSource())
  if (!bytes) return null
  const report = scanReleaseFile(`public${entry.path}`, bytes, knownValues)
  if (!report.complete || report.rules.length || report.errors.length) throw Error('Reusable media failed the current secret scan')
  return { ...entry, access: 'public', delivery: entry.delivery ?? 'legacy', reuse: { sourceIdentity, policyId } }
}
export function readProductionManifest(root, deployment, api) {
  if (deployment.readyState !== 'READY' || deployment.target !== 'production' ||
      deployment.projectId !== 'prj_fWUOXHiMmeE6RXfqgAAKJCi97nrv') throw Error('Unexpected production deployment')
  const tree = api(`/v6/deployments/${deployment.id}/files`)
  const file = tree.find(f => f.name === 'src')?.children?.find(f => f.name === '.iom-r2-release.json')
  if (!file || !/^[a-f0-9]{40}$/.test(file.uid)) throw Error('Pinned production media manifest missing')
  const raw = Buffer.from(api(`/v8/deployments/${deployment.id}/files/${file.uid}`).data, 'base64')
  if (createHash('sha1').update(raw).digest('hex') !== file.uid) throw Error('Production manifest integrity mismatch')
  return validateManifest(JSON.parse(raw))
}
export function createReusePlan({ root, deploymentId, manifest, files, previousFiles, knownValues = [] }) {
  validateManifest(manifest)
  const policyId = scanPolicy(root), reused = [], omitted = new Set(), sourceIds = new Set()
  const sameInputs = prefixes => {
    const select = map => [...map].filter(([path]) => prefixes.some(p => path === p || path.startsWith(p)))
      .map(([path, f]) => [path, f.oid, f.mode]).sort(([a], [b]) => a.localeCompare(b))
    return JSON.stringify(select(files)) === JSON.stringify(select(previousFiles))
  }
  const unchangedRavens = sameInputs(['ravens/', 'scripts/sync-raven-assets.mjs', 'scripts/build-mobile-raven.mjs', 'package-lock.json'])
  let freshBytes = 0, freshFiles = 0
  const started = Date.now()
  const readBlob = file => {
    if (!file || file.type !== 'blob' || !['100644', '100755'].includes(file.mode) || file.bytes > MAX_FILE) throw Error('Invalid committed media source')
    return git(root, ['cat-file', 'blob', file.oid])
  }
  let runtime = null
  const runtimeIndex = files.get('building-viewer/assets/runtime-pack/index.json')
  if (runtimeIndex) runtime = JSON.parse(readBlob(runtimeIndex).toString().replace(/^\uFEFF/, ''))
  const privateRoots = [...files.values()].filter(f => /^public\/demos\/[^/]+\/media-manifest\.json$/.test(f.path))
    .filter(f => JSON.parse(readBlob(f)).visibility === 'private').map(f => '/' + f.path.slice(7, -'media-manifest.json'.length))
  let scanned = 0
  for (const entry of manifest.files) {
    if (privateRoots.some(prefix => entry.path.startsWith(prefix))) throw Error('Previously public media cannot become private through this workflow; explicit access migration required')
    if (!unchangedRavens && /\/assets\/ravens?\b/.test(entry.path)) continue
    const source = files.get(`public${entry.path}`)
    let identity, readSource, packedPath
    if (source && ['100644', '100755'].includes(source.mode)) {
      identity = `git:${source.oid}`; readSource = () => readBlob(source)
    } else {
      const recipe = runtime?.version === 1 && runtime.assets?.find(a => a.target === `public${entry.path}`)
      if (!recipe) continue
      if (!/^public\/models\/[a-z0-9-]+\/[a-z0-9.-]+\.glb$/.test(recipe.target) || basename(recipe.packed) !== recipe.packed ||
          recipe.bytes !== entry.bytes || recipe.sha256 !== entry.sha256 || !/^[a-f0-9]{64}$/.test(recipe.packedSha256)) throw Error('Runtime media recipe mismatch')
      packedPath = `building-viewer/assets/runtime-pack/${recipe.packed}`
      const packed = files.get(packedPath)
      if (!packed) throw Error('Packed runtime media missing from committed snapshot')
      identity = `gzip:${sha256(`${runtimeIndex.oid}:${packed.oid}:${recipe.sha256}`)}`
      readSource = () => {
        const bytes = readBlob(packed)
        if (sha256(bytes) !== recipe.packedSha256) throw Error('Packed runtime media integrity mismatch')
        return gunzipSync(bytes, { maxOutputLength: recipe.bytes })
      }
    }
    if (entry.delivery === 'canonical') {
      const approvalPath = 'public' + entry.path.split('/').slice(0, 3).join('/') + '/media-manifest.json'
      const approval = files.get(approvalPath)
      if (!approval) throw Error('Canonical media is missing its committed public approval')
      const doc = JSON.parse(readBlob(approval))
      if (doc.visibility !== 'public' || !doc.files.some(f => f.path === entry.path && f.sha256 === entry.sha256 && f.bytes === entry.bytes)) continue
    }
    const boundedRead = () => {
      freshBytes += entry.bytes; freshFiles++
      if (freshBytes > 1_200_000_000 || freshFiles > 15000 || Date.now() - started > 120000) throw Error('Fresh media scan budget exceeded')
      return readSource()
    }
    const result = assessReuse(entry, identity, boundedRead, policyId, knownValues)
    if (!result) continue
    reused.push(result); omitted.add(`public${entry.path}`)
    if (source) sourceIds.add(source.oid)
    if (packedPath) omitted.add(packedPath)
    if (++scanned % 100 === 0) console.log(`Reuse plan: verified ${scanned}/${manifest.files.length} media paths`)
  }
  // These are source-only copies of exactly the verified public blobs, not build inputs.
  for (const [path, file] of files) if (/^(automotive-studio|solar-system|stradivari-cable|stradivari-amantes-s3|lobo-mobo-study)\/public\//.test(path) && sourceIds.has(file.oid)) omitted.add(path)
  const runtimeComplete = !!runtime?.assets?.length && runtime.assets.every(a => omitted.has(a.target))
  const ravenPaths = manifest.files.filter(f => /\/assets\/ravens?\b/.test(f.path))
  const skipRavens = unchangedRavens && ravenPaths.length > 0 && ravenPaths.every(f => omitted.has(`public${f.path}`))
  return { version: 1, origin: PUBLIC_ORIGIN, sourceDeployment: deploymentId, policyId,
    files: reused, omitted: [...omitted].sort(), runtimeComplete, skipRavens,
    legacyPaths: manifest.files.filter(f => (f.delivery ?? 'legacy') === 'legacy').map(f => f.path),
    reusedBytes: reused.reduce((s, f) => s + f.bytes, 0) }
}
export function readReusePlan(stage, expectedIdentity) {
  const raw = readFileSync(join(stage, REUSE_FILE))
  if (!/^[a-f0-9]{64}$/.test(expectedIdentity || '') || sha256(raw) !== expectedIdentity) throw Error('Media reuse plan changed')
  const plan = JSON.parse(raw)
  if (plan.files.length) validateManifest(plan)
  else if (plan.version !== 1 || plan.origin !== PUBLIC_ORIGIN) throw Error('Invalid empty reuse plan')
  if (!/^dpl_[A-Za-z0-9]+$/.test(plan.sourceDeployment) || !/^[a-f0-9]{64}$/.test(plan.policyId)) throw Error('Invalid media reuse provenance')
  for (const entry of plan.files) {
    assertPublicEntry(entry)
    if (!entry.reuse || entry.reuse.policyId !== plan.policyId || !/^(git:[a-f0-9]{40}|gzip:[a-f0-9]{64})$/.test(entry.reuse.sourceIdentity)) throw Error('Missing media scan receipt')
  }
  return plan
}
export function prepareStagedReuse(stage, plan) {
  const raw = Buffer.from(JSON.stringify(plan, null, 2) + '\n')
  writeFileSync(join(stage, REUSE_FILE), raw)
  const pkgPath = join(stage, 'package.json'), pkg = JSON.parse(readFileSync(pkgPath))
  if (plan.skipRavens) pkg.scripts['build:ravens'] = 'node -e "console.log(\'Using verified immutable raven assets\')"'
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  // Local deployment/test tooling is never shipped to clients or remote builders.
  const ignore = join(stage, '.vercelignore')
  const lines = ['/.iom-r2-reuse.json', '/scripts/test-*.mjs', '/scripts/test-*.cjs',
    '/scripts/deploy-secret-*.mjs', '/scripts/deploy-reviewed-*', '/scripts/incremental-r2-release.mjs',
    '/scripts/create-demo-media-manifest.mjs', '/scripts/deploy-production.mjs']
  writeFileSync(ignore, readFileSync(ignore, 'utf8') + '\n# Local release tooling\n' + lines.join('\n') + '\n')
  return sha256(raw)
}

export function validateCanonicalReferences(root, manifest, canonicalUrl) {
  const known = new Set(manifest.files.map(canonicalUrl))
  const visit = directory => {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, item.name)
      if (item.isSymbolicLink()) throw Error('Symlink in reference validation')
      if (item.isDirectory()) visit(path)
      else if (/\.(html|css|js|json|gltf)$/.test(item.name)) {
        const text = readFileSync(path, 'utf8')
        for (const match of text.matchAll(/\/_assets\/[a-f0-9]{64}\/[A-Za-z0-9._-]+/g)) {
          if (!known.has(match[0])) throw Error('Unresolved immutable media reference')
        }
      }
    }
  }
  if (existsSync(root)) visit(root)
}

export function assertRemoteMedia(entry, response) {
  if (response.status !== 200 || Number(response.headers.get('content-length')) !== entry.bytes || response.headers.get('x-amz-meta-sha256') !== entry.sha256) throw Error('Remote media missing or metadata differs')
}
export function assertRemoteRange(entry, response, bytes) {
  const end = Math.min(1023, entry.bytes - 1)
  if (response.status !== 206 || response.headers.get('content-range') !== 'bytes 0-' + end + '/' + entry.bytes || response.headers.get('access-control-allow-origin') !== '*' || sha256(bytes) !== entry.rangeSha256) throw Error('Remote media range, CORS or content differs')
}
