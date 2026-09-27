import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { finalizeBuild } from './finalize-r2-build.mjs'
import { MANIFEST_FILE, PUBLIC_ORIGIN, objectKey, releaseConfig, routeSource, sha256, validateManifest } from './r2-release-manifest.mjs'
function fixture() {
  const prefix = resolve(tmpdir(), 'iom-r2-release-test-')
  const root = mkdtempSync(prefix)
  mkdirSync(join(root, 'public')); mkdirSync(join(root, 'dist'))
  const files = ['/one.png', '/two.pdf'].map(path => {
    const content = Buffer.from(`test media ${path}`), hash = sha256(content)
    writeFileSync(join(root, 'public', path.slice(1)), content)
    writeFileSync(join(root, 'dist', path.slice(1)), content)
    return { path, sha256: hash, bytes: content.length, key: objectKey(path, hash) }
  })
  const manifest = { version: 1, origin: PUBLIC_ORIGIN, files }
  writeFileSync(join(root, MANIFEST_FILE), JSON.stringify(manifest))
  return { root, manifest, cleanup() {
    assert.ok(resolve(root).startsWith(prefix))
    rmSync(root, { recursive: true, force: true })
  } }
}
test('a late build mismatch prevents removal of every asset', () => {
  const f = fixture()
  try {
    writeFileSync(join(f.root, 'dist/two.pdf'), 'unexpected build bytes')
    assert.throws(() => finalizeBuild(f.root), /Build changed an R2 asset/)
    assert.ok(existsSync(join(f.root, 'dist/one.png')))
    assert.equal(readFileSync(join(f.root, 'public/two.pdf'), 'utf8'), 'test media /two.pdf')
  } finally { f.cleanup() }
})
test('verified build copies are removed while original public files remain', () => {
  const f = fixture()
  try {
    assert.equal(finalizeBuild(f.root).removedBuildCopies, 2)
    assert.equal(existsSync(join(f.root, 'dist/one.png')), false)
    assert.ok(existsSync(join(f.root, 'public/one.png')))
  } finally { f.cleanup() }
})
test('invalid paths, foreign destinations and route overflow fail closed', () => {
  const f = fixture()
  try {
    assert.throws(() => validateManifest({ ...f.manifest, origin: 'https://other.example' }), /Invalid/)
    for (const path of ['/../outside.png', '//outside.png', '/nested/../../outside.png', '/%2e%2e/outside.png']) {
      assert.throws(() => validateManifest({ ...f.manifest, files: [{ ...f.manifest.files[0], path }] }))
    }
    assert.throws(() => releaseConfig({ redirects: Array(2048).fill({}) }, f.manifest), /limit/)
    const config = releaseConfig({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }, f.manifest)
    assert.equal(config.rewrites[0].source, '/one.png')
    assert.match(config.rewrites[0].destination, /\/iom-website\/v1\/[a-f0-9]{64}\/one.png$/)
    assert.equal(config.headers[0].headers.find(h => h.key === 'Cache-Control').value, 'public, max-age=0, must-revalidate')
  } finally { f.cleanup() }
})

// Migration must not widen a release into unrelated application work.
const { matchesDeployScope } = await import('./deploy-scope.mjs')
assert.equal(matchesDeployScope('config/website-r2.json', 'media-assets'), true)
assert.equal(matchesDeployScope('scripts/prepare-r2-release.mjs', 'media-assets'), true)
assert.equal(matchesDeployScope('src/data/projects.ts', 'media-assets'), false)
assert.equal(matchesDeployScope('public/demos/dukta/index.html', 'media-assets'), false)

// Request paths are percent encoded by the edge router (not decoded filesystem names).
assert.equal(routeSource("/panoramas/The Black Witness.jpeg"), "/panoramas/The%20Black%20Witness.jpeg")
