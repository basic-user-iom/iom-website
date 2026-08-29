/** Browser proof that GLTFLoader propagates image extras and that two real
 * manifest-v3 package GLBs reuse a compatible GPU Texture object. */
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const VIEWER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = process.argv[2] || 'http://127.0.0.1:5192/'
const candidateDir = resolve(process.argv[3] || resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-first-floor-shared-textures'))
const sourceAnalysisPath = resolve(
  process.argv[4] || resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-first-floor-coalesced', 'shared-texture-residency-analysis.json'),
)

const candidate = JSON.parse(await readFile(resolve(candidateDir, 'detail-package-index.json'), 'utf8'))
const evidence = JSON.parse(await readFile(resolve(candidateDir, 'shared-texture-release-evidence.json'), 'utf8'))
const analysis = JSON.parse(await readFile(sourceAnalysisPath, 'utf8'))
assert.equal(candidate.enabled, false)
assert.equal(evidence.productionReferenced, false)

const webPayloads = analysis.payloads.filter((payload) => payload.variant === 'web')
let pair = null
for (let left = 0; left < webPayloads.length && !pair; left += 1) {
  const leftKeys = new Set(webPayloads[left].textures.flatMap((texture) =>
    texture.compatibility.map((item) => `${texture.contentSha256}:${item.signatureSha256}`)))
  for (let right = left + 1; right < webPayloads.length; right += 1) {
    const sharedKey = webPayloads[right].textures.flatMap((texture) =>
      texture.compatibility.map((item) => `${texture.contentSha256}:${item.signatureSha256}`))
      .find((key) => leftKeys.has(key))
    if (sharedKey) pair = { left: webPayloads[left], right: webPayloads[right], sharedKey }
  }
}
assert.ok(pair, 'No two Web payloads share a compatible texture signature')

function candidatePayload(packageId) {
  const pkg = candidate.packages.find((item) => item.id === packageId)
  assert.ok(pkg, `Missing candidate package ${packageId}`)
  return pkg.variants.web.lod0
}

function fileUrl(path) {
  return `/@fs/${path.replaceAll('\\', '/')}`
}

const selected = [pair.left, pair.right].map((item) => {
  const payload = candidatePayload(item.packageId)
  return {
    packageId: item.packageId,
    url: fileUrl(resolve(candidateDir, payload.url)),
    sha256: payload.sha256,
    bytes: payload.metrics.bytes,
  }
})

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
      const loaded = await loader.loadUrlVerified(
        payload.url,
        { sha256: payload.sha256, bytes: payload.bytes },
      )
      roots.push(loaded.root)
      metadataCounts.push(inspect(loaded.root))
      acquisitions.push(registry.acquireRoot(loaded.root))
    }
    return { metadataCounts, acquisitions, registry: registry.getState() }
  } finally {
    for (const root of roots) registry.releaseRoot(root)
    for (const root of roots) disposeObject3D(root)
    registry.dispose()
    loader.dispose()
  }
}, { payloads: selected })

await browser.close()
for (const item of result.metadataCounts) {
  assert.ok(item.textureObjects > 0, 'Real package exposed no textures')
  assert.equal(item.annotated, item.textureObjects, 'GLTFLoader did not propagate image extras to every used texture')
}
assert.ok(result.acquisitions[1].sharedTextures > 0, 'Second real package reused no compatible GPU Texture')
assert.ok(result.registry.roots === 2 && result.registry.references >= 2)

const report = {
  schema: 'IOM_SHARED_TEXTURE_BROWSER_QA',
  version: 1,
  passed: true,
  productionReferenced: false,
  selected,
  sharedCompatibilityKey: pair.sharedKey,
  result,
}
await mkdir(candidateDir, { recursive: true })
await writeFile(resolve(candidateDir, 'shared-texture-browser-qa.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log('Shared-texture browser QA: PASS')
console.log(`  ${selected[0].packageId} + ${selected[1].packageId}`)
console.log(`  reused textures=${result.acquisitions[1].sharedTextures}`)
console.log(`  registry entries=${result.registry.entries}; references=${result.registry.references}`)
