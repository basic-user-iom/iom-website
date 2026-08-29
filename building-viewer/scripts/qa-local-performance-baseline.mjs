/**
 * Repeatable local browser timing diagnostic for the complete production
 * monoliths. Headless SwiftShader numbers are regression evidence only, not a
 * substitute for desktop/mobile/Quest hardware acceptance.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5192/'
const outDir = resolve(process.argv[3] || 'tmp/local-performance-baseline')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.setDefaultTimeout(420_000)
await page.addInitScript(() => sessionStorage.setItem('building-viewer-demo-unlocked', '1'))
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.stack || error.message))

const waitForLayer = (id) => page.waitForFunction((layerId) => {
  const viewer = window.__iomBuildingViewer
  const layer = viewer?.models?.getLayer?.(layerId)
  return Boolean(layer?.result?.root && document.querySelector('.bv-loading')?.classList.contains('hidden'))
}, id, { polling: 500, timeout: 420_000 })

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
await page.waitForFunction(() => Boolean(window.__iomBuildingViewer), null, { timeout: 30_000 })
await page.evaluate(() => {
  const viewer = window.__iomBuildingViewer
  viewer.__qaLiveStats = []
  const original = viewer.events.onLiveStats
  viewer.events.onLiveStats = (sample) => {
    viewer.__qaLiveStats.push({ ...sample, capturedAt: performance.now() })
    if (viewer.__qaLiveStats.length > 240) viewer.__qaLiveStats.shift()
    original?.(sample)
  }
})

async function setCamera(position, target, fov) {
  await page.evaluate(({ p, t, f }) => {
    const viewer = window.__iomBuildingViewer
    viewer.orbit.setEnabled(false)
    viewer.camera.position.set(...p)
    viewer.orbit.controls.target.set(...t)
    viewer.camera.fov = f
    viewer.camera.updateProjectionMatrix()
    viewer.camera.lookAt(...t)
    viewer.orbit.controls.update()
    viewer.__qaLiveStats.length = 0
  }, { p: position, t: target, f: fov })
}

async function sampleCase(id, camera, durationMs = 8_000) {
  await waitForLayer(id)
  await setCamera(camera.position, camera.target, camera.fov)
  await page.waitForTimeout(durationMs)
  return page.evaluate((layerId) => {
    const viewer = window.__iomBuildingViewer
    const samples = viewer.__qaLiveStats.slice(-24)
    const info = viewer.renderer.info
    const gl = viewer.renderer.getContext()
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unavailable'
    const values = (key) => samples.map((sample) => sample[key]).filter((value) => Number.isFinite(value))
    const median = (items) => {
      if (!items.length) return null
      const sorted = [...items].sort((a, b) => a - b)
      const middle = Math.floor(sorted.length / 2)
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
    }
    const last = samples.at(-1) ?? null
    return {
      layerId,
      sampleCount: samples.length,
      medianFps: median(values('avgFps')),
      medianRafP95Ms: median(values('rafP95Ms')),
      medianCpuP95Ms: median(values('cpuP95Ms')),
      medianGpuP95Ms: median(values('gpuP95Ms')),
      last,
      render: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        width: viewer.renderer.domElement.width,
        height: viewer.renderer.domElement.height,
        pixelRatio: viewer.renderer.getPixelRatio(),
      },
      browserRenderer: renderer,
      quality: viewer.quality.getProfile().id,
    }
  }, id)
}

const exterior = await sampleCase('icm-ext', {
  position: [-120, 18, -150], target: [-102, 0.8, -91], fov: 52,
})
await page.evaluate(async () => {
  const viewer = window.__iomBuildingViewer
  await viewer.ensureLayer('icm-anim-2025', true)
  await viewer.ensureLayer('icm-ext', false)
  viewer.playAnimation()
})
const animated = await sampleCase('icm-anim-2025', {
  position: [-31, 23, -21], target: [-61.52, 7.56, -54.58], fov: 52,
}, 10_000)

const report = {
  schema: 'IOM_LOCAL_PERFORMANCE_BASELINE',
  version: 1,
  passed: pageErrors.length === 0,
  acceptanceEvidence: false,
  limitation: 'Headless Chromium with SwiftShader is a repeatable regression diagnostic, not target-hardware FPS evidence.',
  baseUrl,
  viewport: { width: 1280, height: 720 },
  exterior,
  animated,
  pageErrors,
}
await writeFile(resolve(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
await browser.close()
if (pageErrors.length) throw new Error(`Local performance QA had ${pageErrors.length} page error(s)`)
console.log('Local performance baseline: PASS (diagnostic only)')
console.log(`  exterior: ${exterior.medianFps?.toFixed(1) ?? '?'} FPS, ${exterior.render.calls} calls, ${exterior.render.triangles.toLocaleString()} tris`)
console.log(`  animated: ${animated.medianFps?.toFixed(1) ?? '?'} FPS, ${animated.render.calls} calls, ${animated.render.triangles.toLocaleString()} tris`)
console.log(`  renderer: ${animated.browserRenderer}`)
