/**
 * Paired browser evidence for the default daylight calibration.
 *
 * Each layer is loaded and settled once. The script then toggles only the
 * exact legacy/current daylight values around an identical locked camera,
 * avoiding camera-fit, LOD, and payload timing differences between runs.
 * SwiftShader is deterministic regression evidence, not target-hardware or
 * target-display acceptance evidence.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import sharp from 'sharp'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5192/?qa=lighting'
const outDir = resolve(process.argv[3] || 'tmp/qa-lighting-calibration-paired')
await mkdir(outDir, { recursive: true })

const VIEWS = [
  {
    name: 'exterior-roof-oblique',
    layerId: 'icm-ext',
    position: [61, 63, -164],
    target: [29.25, 35, -195.9],
    fov: 46,
  },
  {
    name: 'interior-office-facade',
    layerId: 'icm-anim-2025',
    position: [-85.57, 8.5, -42],
    target: [-85.57, 8.2, -68.44],
    fov: 50,
  },
]

// Exact values applied by the previous daylight preset under Balanced (0.7).
// Direction, colors, HDR, background and tone mapping did not change.
const LEGACY_BALANCED_DAYLIGHT = Object.freeze({
  exposure: 1.35,
  sunIntensity: 4.55,
  hemisphereIntensity: 0.385,
  ambientIntensity: 0.056,
  environmentIntensity: 0.7,
})

const percentile = (sorted, ratio) => sorted[
  Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))
]

async function imageStatistics(path) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const luminance = new Uint8Array(info.width * info.height)
  let sum = 0
  let clippedRgb = 0
  let nearWhite = 0
  let nearBlack = 0
  for (let pixel = 0, offset = 0; offset < data.length; pixel += 1, offset += info.channels) {
    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]
    const y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
    luminance[pixel] = y
    sum += y
    if (r >= 254 || g >= 254 || b >= 254) clippedRgb += 1
    if (y >= 242) nearWhite += 1
    if (y <= 8) nearBlack += 1
  }
  luminance.sort()
  const pixels = luminance.length
  const p05 = percentile(luminance, 0.05) / 255
  const p50 = percentile(luminance, 0.5) / 255
  const p95 = percentile(luminance, 0.95) / 255
  const p99 = percentile(luminance, 0.99) / 255
  return {
    width: info.width,
    height: info.height,
    meanSrgbLuminance: sum / pixels / 255,
    p05SrgbLuminance: p05,
    p50SrgbLuminance: p50,
    p95SrgbLuminance: p95,
    p99SrgbLuminance: p99,
    p05ToP95Contrast: p95 - p05,
    nearWhitePercent: nearWhite / pixels * 100,
    clippedRgbPercent: clippedRgb / pixels * 100,
    nearBlackPercent: nearBlack / pixels * 100,
  }
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(420_000)
await page.addInitScript(() => sessionStorage.setItem('building-viewer-demo-unlocked', '1'))

const pageErrors = []
const consoleErrors = []
page.on('pageerror', (error) => pageErrors.push(error.stack || error.message))
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) {
    consoleErrors.push(message.text())
  }
})

const waitForLayer = (id) => page.waitForFunction((layerId) => {
  const viewer = window.__iomBuildingViewer
  const layer = viewer?.models?.getLayer?.(layerId)
  return Boolean(
    layer?.result?.root?.visible === true &&
    document.querySelector('.bv-loading')?.classList.contains('hidden'),
  )
}, id, { polling: 500, timeout: 420_000 })

const setAndReadCamera = (view) => page.evaluate(({ position, target, fov }) => {
  const viewer = window.__iomBuildingViewer
  viewer.orbit.setEnabled(false)
  viewer.camera.position.set(...position)
  viewer.orbit.controls.target.set(...target)
  viewer.camera.fov = fov
  viewer.camera.near = 0.05
  viewer.camera.far = 1200
  viewer.camera.updateProjectionMatrix()
  viewer.camera.lookAt(...target)
  viewer.orbit.controls.update()
  viewer.camera.updateMatrixWorld(true)
  return {
    position: viewer.camera.position.toArray(),
    target: viewer.orbit.controls.target.toArray(),
    fov: viewer.camera.fov,
  }
}, view)

const applyLegacyDaylight = () => page.evaluate((legacy) => {
  const viewer = window.__iomBuildingViewer
  viewer.renderer.toneMappingExposure = legacy.exposure
  viewer.lighting.sun.intensity = legacy.sunIntensity
  viewer.lighting.hemi.intensity = legacy.hemisphereIntensity
  viewer.lighting.ambient.intensity = legacy.ambientIntensity
  viewer.scene.environmentIntensity = legacy.environmentIntensity
  viewer.lighting.requestShadowUpdate()
  viewer.shadowFramesLeft = 2
}, LEGACY_BALANCED_DAYLIGHT)

const applyCalibratedDaylight = () => page.evaluate(async () => {
  const viewer = window.__iomBuildingViewer
  await viewer.setDaylightPreset('daylight')
})

const inspectRuntime = () => page.evaluate(() => {
  const viewer = window.__iomBuildingViewer
  return {
    preset: viewer.getDaylightPreset(),
    quality: viewer.quality.getProfile().id,
    exposure: viewer.renderer.toneMappingExposure,
    toneMapping: viewer.renderer.toneMapping,
    sunIntensity: viewer.lighting.sun.intensity,
    hemisphereIntensity: viewer.lighting.hemi.intensity,
    ambientIntensity: viewer.lighting.ambient.intensity,
    environmentIntensity: viewer.scene.environmentIntensity,
    cheapEnvironment: viewer.quality.getProfile().cheapEnvironment,
    renderCalls: viewer.renderer.info.render.calls,
    triangles: viewer.renderer.info.render.triangles,
    glError: viewer.renderer.getContext().getError(),
  }
})

const capture = async (view, variant) => {
  if (variant === 'before') await applyLegacyDaylight()
  else await applyCalibratedDaylight()
  // Reapply immediately before capture so no late camera-fit callback can
  // contaminate either member of the pair.
  await setAndReadCamera(view)
  await page.waitForTimeout(750)
  const actualCamera = await setAndReadCamera(view)
  await page.waitForTimeout(100)
  const filename = `${variant}-${view.name}.png`
  const screenshotPath = resolve(outDir, filename)
  await page.locator('#viewer-canvas').screenshot({ path: screenshotPath })
  return {
    filename,
    actualCamera: await setAndReadCamera(view),
    runtime: await inspectRuntime(),
    image: await imageStatistics(screenshotPath),
  }
}

const delta = (after, before) => Number((after - before).toFixed(9))

let report
try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForFunction(() => Boolean(window.__iomBuildingViewer), null, { timeout: 30_000 })
  await page.addStyleTag({ content: '#viewer-ui { visibility: hidden !important; }' })
  const profile = await page.evaluate(async () => {
    const viewer = window.__iomBuildingViewer
    await viewer.setQuality('DESKTOP_BALANCED')
    await viewer.setDaylightPreset('daylight')
    return viewer.quality.getProfile().id
  })

  const pairs = []
  for (const view of VIEWS) {
    if (view.layerId === 'icm-anim-2025') {
      await page.evaluate(async () => {
        const viewer = window.__iomBuildingViewer
        await viewer.ensureLayer('icm-anim-2025', true)
        await viewer.ensureLayer('icm-ext', false)
      })
    }
    await waitForLayer(view.layerId)
    // Let layer visibility, detail LOD and camera framing finish before locking
    // the paired evidence state.
    await page.waitForTimeout(3_000)
    await setAndReadCamera(view)
    await page.waitForTimeout(1_000)
    const before = await capture(view, 'before')
    const after = await capture(view, 'after')
    pairs.push({
      name: view.name,
      layerId: view.layerId,
      requestedCamera: { position: view.position, target: view.target, fov: view.fov },
      before,
      after,
      delta: {
        meanSrgbLuminance: delta(after.image.meanSrgbLuminance, before.image.meanSrgbLuminance),
        p95SrgbLuminance: delta(after.image.p95SrgbLuminance, before.image.p95SrgbLuminance),
        p05ToP95Contrast: delta(after.image.p05ToP95Contrast, before.image.p05ToP95Contrast),
        nearWhitePercent: delta(after.image.nearWhitePercent, before.image.nearWhitePercent),
        clippedRgbPercent: delta(after.image.clippedRgbPercent, before.image.clippedRgbPercent),
      },
    })
  }

  const failures = []
  if (profile !== 'DESKTOP_BALANCED') failures.push(`Unexpected profile: ${profile}`)
  if (pageErrors.length) failures.push(`${pageErrors.length} page error(s)`)
  if (consoleErrors.length) failures.push(`${consoleErrors.length} console error(s)`)
  for (const pair of pairs) {
    if (JSON.stringify(pair.before.actualCamera) !== JSON.stringify(pair.after.actualCamera)) {
      failures.push(`${pair.name}: camera changed across pair`)
    }
    if (pair.before.runtime.renderCalls !== pair.after.runtime.renderCalls) {
      failures.push(`${pair.name}: render calls changed across pair`)
    }
    if (pair.before.runtime.triangles !== pair.after.runtime.triangles) {
      failures.push(`${pair.name}: triangle count changed across pair`)
    }
    if (pair.before.runtime.glError !== 0 || pair.after.runtime.glError !== 0) {
      failures.push(`${pair.name}: WebGL error`)
    }
    if (pair.delta.meanSrgbLuminance > -0.05) {
      failures.push(`${pair.name}: washed-out mean luminance did not materially decrease`)
    }
    if (pair.after.image.meanSrgbLuminance < 0.35) {
      failures.push(`${pair.name}: calibrated image became too dark`)
    }
    if (pair.delta.p95SrgbLuminance > -0.03) {
      failures.push(`${pair.name}: highlight shoulder did not materially decrease`)
    }
    if (pair.after.image.clippedRgbPercent > pair.before.image.clippedRgbPercent + 0.001) {
      failures.push(`${pair.name}: RGB clipping increased`)
    }
    if (pair.after.image.nearBlackPercent > 0.5) {
      failures.push(`${pair.name}: crushed-black area exceeds 0.5%`)
    }
  }

  report = {
    schema: 'IOM_LIGHTING_CALIBRATION_QA',
    version: 2,
    ok: failures.length === 0,
    acceptanceEvidence: false,
    limitation: 'Headless Chromium SwiftShader is repeatable regression evidence, not target-display or target-hardware acceptance.',
    comparison: 'Exact legacy Balanced daylight values vs current Balanced daylight; same browser, loaded layer, camera, HDR and tone mapper.',
    baseUrl,
    profile,
    legacyBalancedDaylight: LEGACY_BALANCED_DAYLIGHT,
    pairs,
    failures,
    pageErrors,
    consoleErrors,
  }
} catch (error) {
  report = {
    schema: 'IOM_LIGHTING_CALIBRATION_QA',
    version: 2,
    ok: false,
    baseUrl,
    pairs: [],
    failures: [error?.stack || String(error)],
    pageErrors,
    consoleErrors,
  }
} finally {
  await browser.close()
}

await writeFile(resolve(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
