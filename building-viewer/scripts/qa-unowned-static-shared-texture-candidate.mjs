/**
 * Browser proof that two independently parsed unowned-static payloads reuse a
 * compatible annotated GPU Texture through SharedTextureResidencyRegistry.
 * The candidate remains disabled and production-unreferenced.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const VIEWER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = process.argv[2] || 'http://127.0.0.1:5192/'
const candidateDir = resolve(process.argv[3] ||
  resolve(VIEWER_ROOT, 'tmp', 'unowned-static-payload-candidate-proxy-v2'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const indexBytes = await readFile(resolve(candidateDir, 'payload-index.json'))
const auditBytes = await readFile(resolve(candidateDir, 'payload-audit.json'))
const index = JSON.parse(indexBytes)
const audit = JSON.parse(auditBytes)
assert.equal(index.schema, 'IOM_UNOWNED_STATIC_PAYLOAD_CANDIDATE')
assert.equal(index.enabled, false)
assert.equal(index.activationApproved, false)
assert.equal(index.productionRoutingChanged, false)
assert.equal(index.sharedTextureResidency?.runtimeRegistryRequired, 'SharedTextureResidencyRegistry')
assert.equal(audit.status, 'PASS')
assert.equal(audit.index.sha256, sha256(indexBytes))

const textured = index.packages.map((pkg) => ({
  packageId: pkg.id,
  entry: pkg.variants.web,
  keys: new Set(pkg.variants.web.textureMemory?.sharedTextureResidency?.resources
    ?.map((resource) => resource.keySha256) || []),
})).filter((pkg) => pkg.keys.size > 0)
let pair = null
for (let left = 0; left < textured.length && !pair; left += 1) {
  for (let right = left + 1; right < textured.length; right += 1) {
    const sharedKey = [...textured[left].keys].find((key) => textured[right].keys.has(key))
    if (sharedKey) pair = { left: textured[left], right: textured[right], sharedKey }
  }
}
assert.ok(pair, 'No two Web unowned-static payloads share a compatible texture resource')

function fileUrl(path) {
  return `/@fs/${path.replaceAll('\\', '/')}`
}

const selected = [pair.left, pair.right].map(({ packageId, entry }) => ({
  packageId,
  url: fileUrl(resolve(candidateDir, entry.asset.path)),
  sha256: entry.asset.sha256,
  bytes: entry.asset.bytes,
}))

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 960, height: 640 } })
page.setDefaultTimeout(180_000)
await page.addInitScript(() => sessionStorage.setItem('building-viewer-demo-unlocked', '1'))
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => Boolean(window.__iomBuildingViewer?.renderer), null, { timeout: 60_000 })

const result = await page.evaluate(async ({ payloads }) => {
  const [{ ModelLoader }, { SharedTextureResidencyRegistry }, { disposeObject3D }] = await Promise.all([
    import('/src/scene/ModelLoader.ts'),
    import('/src/scene/SharedTextureResidencyRegistry.ts'),
    import('/src/utils/disposeScene.ts'),
  ])
  const viewer = window.__iomBuildingViewer
  const loader = new ModelLoader(() => viewer.renderer)
  const registry = new SharedTextureResidencyRegistry()
  const roots = []
  const metadataCounts = []
  const acquisitions = []
  const inspect = (root) => {
    const textures = new Set()
    root.traverse((object) => {
      if (!object.isMesh || !object.material) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
      }
    })
    return {
      textureObjects: textures.size,
      annotated: [...textures].filter((texture) => texture.userData?.iomSharedTexture?.version === 1).length,
    }
  }
  try {
    for (const payload of payloads) {
      const loaded = await loader.loadUrlVerified(payload.url, {
        sha256: payload.sha256,
        bytes: payload.bytes,
      })
      roots.push(loaded.root)
      metadataCounts.push(inspect(loaded.root))
      acquisitions.push(registry.acquireRoot(loaded.root))
    }
    const whileResident = registry.getState()
    for (const root of roots) registry.releaseRoot(root)
    const afterRelease = registry.getState()
    return { metadataCounts, acquisitions, whileResident, afterRelease }
  } finally {
    for (const root of roots) registry.releaseRoot(root)
    for (const root of roots) disposeObject3D(root)
    registry.dispose()
    loader.dispose()
  }
}, { payloads: selected })

await browser.close()
for (const item of result.metadataCounts) {
  assert.ok(item.textureObjects > 0, 'Real unowned-static package exposed no textures')
  assert.equal(item.annotated, item.textureObjects,
    'GLTFLoader did not propagate verified metadata to every used texture')
}
assert.ok(result.acquisitions[1].sharedTextures > 0,
  'Second real unowned-static package reused no compatible GPU Texture')
assert.ok(result.whileResident.roots === 2 && result.whileResident.references >= 2)
assert.deepEqual(result.afterRelease, { entries: 0, roots: 0, references: 0, encodedBytes: 0 })

const report = {
  schema: 'IOM_UNOWNED_STATIC_SHARED_TEXTURE_BROWSER_QA',
  version: 1,
  passed: true,
  enabled: false,
  activationApproved: false,
  productionReferenced: false,
  candidateIndex: { bytes: indexBytes.length, sha256: sha256(indexBytes) },
  candidateAudit: { bytes: auditBytes.length, sha256: sha256(auditBytes) },
  selected,
  sharedCompatibilityResourceKeySha256: pair.sharedKey,
  result,
}
await mkdir(candidateDir, { recursive: true })
await writeFile(resolve(candidateDir, 'shared-texture-browser-qa.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log('Unowned-static shared-texture browser QA: PASS')
console.log(`  ${selected[0].packageId} + ${selected[1].packageId}`)
console.log(`  reused textures=${result.acquisitions[1].sharedTextures}`)
console.log(`  resident entries=${result.whileResident.entries}; after release=${result.afterRelease.entries}`)
