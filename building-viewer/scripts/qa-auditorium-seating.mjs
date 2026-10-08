/**
 * Browser QA for the auditorium seating family. Verifies that the four
 * material primitives of every logical row remain visibility-coherent across
 * orbit overview and animation phases.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5192/?qa=auditorium-seating'
const outDir = resolve(process.argv[3] || 'tmp/qa-auditorium-seating')
const expectedMaterials = [
  'vray Stuhl_Plastik',
  'vray Stuhl_Plakete',
  'vray Stuhl_Metall',
  'vray Stuhl_Bezug',
]
await mkdir(outDir, { recursive: true })

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

const waitForLayer = (id) => page.waitForFunction(
  (layerId) => {
    const viewer = window.__iomBuildingViewer
    const layer = viewer?.models?.getLayer?.(layerId)
    return Boolean(
      layer?.result?.root &&
      document.querySelector('.bv-loading')?.classList.contains('hidden'),
    )
  },
  id,
  { polling: 500, timeout: 420_000 },
)

const inspectSeating = () => page.evaluate(() => {
  const viewer = window.__iomBuildingViewer
  const root = viewer.models.getLayer('icm-anim-2025').result.root
  root.updateMatrixWorld(true)
  const materialPattern = /^vray Stuhl_(?:Plastik|Plakete|Metall|Bezug)$/i
  const objects = []
  const aggregateMin = [Infinity, Infinity, Infinity]
  const aggregateMax = [-Infinity, -Infinity, -Infinity]
  const effectiveVisible = (object) => {
    for (let current = object; current; current = current.parent) {
      if (!current.visible) return false
    }
    return true
  }
  const mergePoint = (point) => {
    for (let axis = 0; axis < 3; axis += 1) {
      aggregateMin[axis] = Math.min(aggregateMin[axis], point[axis])
      aggregateMax[axis] = Math.max(aggregateMax[axis], point[axis])
    }
  }

  root.traverse((object) => {
    if (!object.isMesh) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const material = materials.find((candidate) => candidate && materialPattern.test(candidate.name || ''))
    if (!material) return
    if (object.isInstancedMesh) object.computeBoundingBox()
    else if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
    const localBox = object.isInstancedMesh ? object.boundingBox : object.geometry.boundingBox
    const worldBox = localBox?.clone().applyMatrix4(object.matrixWorld)
    if (worldBox) {
      mergePoint(worldBox.min.toArray())
      mergePoint(worldBox.max.toArray())
    }
    const logicalCount = object.isInstancedMesh ? object.count : 1
    const visible = effectiveVisible(object)
    objects.push({
      name: object.name || '',
      material: material.name || '',
      kind: object.isInstancedMesh
        ? 'instanced'
        : object.userData?.importedNegativeInstance
          ? 'mirrored-standalone'
          : 'mesh',
      logicalCount,
      visible,
      visibleLogicalCount: visible ? logicalCount : 0,
      spatiallySplitImported: Boolean(object.userData?.spatiallySplitImported),
      importedNegativeInstance: Boolean(object.userData?.importedNegativeInstance),
      detailLodPacked: Boolean(object.userData?.detailLodPacked),
      floorResidency: object.userData?.floorResidency ?? null,
      worldMin: worldBox?.min.toArray() ?? null,
      worldMax: worldBox?.max.toArray() ?? null,
    })
  })

  const byKind = Object.fromEntries(
    [...new Set(objects.map((object) => object.kind))].map((kind) => {
      const matches = objects.filter((object) => object.kind === kind)
      return [kind, {
        objects: matches.length,
        logicalCount: matches.reduce((sum, object) => sum + object.logicalCount, 0),
        visibleLogicalCount: matches.reduce(
          (sum, object) => sum + object.visibleLogicalCount,
          0,
        ),
      }]
    }),
  )

  const byMaterial = Object.fromEntries(
    [...new Set(objects.map((object) => object.material))].sort().map((materialName) => {
      const matches = objects.filter((object) => object.material === materialName)
      return [materialName, {
        objects: matches.length,
        logicalCount: matches.reduce((sum, object) => sum + object.logicalCount, 0),
        visibleLogicalCount: matches.reduce(
          (sum, object) => sum + object.visibleLogicalCount,
          0,
        ),
      }]
    }),
  )

  return {
    animation: viewer.getAnimationState(),
    objects,
    byKind,
    byMaterial,
    totals: {
      objects: objects.length,
      logicalCount: objects.reduce((sum, object) => sum + object.logicalCount, 0),
      visibleLogicalCount: objects.reduce(
        (sum, object) => sum + object.visibleLogicalCount,
        0,
      ),
    },
    bounds: {
      min: aggregateMin,
      max: aggregateMax,
      center: aggregateMin.map((value, axis) => (value + aggregateMax[axis]) * 0.5),
    },
    detailLod: viewer.detailLod.getStats(),
    floorZones: viewer.floorZones.getStats(),
  }
})

const setCamera = (position, target, fov = 50) => page.evaluate(({ p, t, f }) => {
  const viewer = window.__iomBuildingViewer
  viewer.orbit.setEnabled(false)
  viewer.camera.position.set(...p)
  viewer.orbit.controls.target.set(...t)
  viewer.camera.fov = f
  viewer.camera.near = 0.05
  viewer.camera.far = 1200
  viewer.camera.updateProjectionMatrix()
  viewer.camera.lookAt(...t)
  viewer.orbit.controls.update()
}, { p: position, t: target, f: fov })

const capture = async (filename) => {
  await page.locator('#viewer-canvas').screenshot({ path: resolve(outDir, filename) })
}

let report
try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForFunction(() => Boolean(window.__iomBuildingViewer), null, { timeout: 30_000 })
  await waitForLayer('icm-ext')
  await page.evaluate(async () => {
    const viewer = window.__iomBuildingViewer
    await viewer.ensureLayer('icm-anim-2025', true)
    await viewer.ensureLayer('icm-ext', false)
    viewer.pauseAnimation()
    // Open the animated shell so the auditorium is directly visible in the
    // evidence captures. Logical visibility is still checked at every phase.
    viewer.seekAnimationNormalized(1)
  })
  await waitForLayer('icm-anim-2025')
  await page.addStyleTag({ content: '#viewer-ui { visibility: hidden !important; }' })

  const initial = await inspectSeating()
  const center = initial.bounds.center
  const overviewCamera = [center[0] + 58, center[1] + 52, center[2] + 64]
  await setCamera(overviewCamera, center, 48)
  await page.waitForTimeout(900)
  const overview = await inspectSeating()
  await capture('overview-runtime-policy.png')

  await page.evaluate(() => window.__iomBuildingViewer.detailLod.setEnabled(false))
  await page.waitForTimeout(500)
  const overviewAllRevealed = await inspectSeating()
  await capture('overview-all-revealed.png')

  await page.evaluate(() => {
    const viewer = window.__iomBuildingViewer
    viewer.detailLod.setEnabled(true)
    viewer.detailLod.setOverviewMassOnly(true)
  })
  await page.waitForTimeout(500)

  const phases = []
  for (const phase of [0, 0.5, 1]) {
    await page.evaluate((u) => window.__iomBuildingViewer.seekAnimationNormalized(u), phase)
    await page.waitForTimeout(250)
    phases.push({ phase, state: await inspectSeating() })
  }

  const failures = []
  const requireLogicalCount = (label, state, expected) => {
    if (state.totals.logicalCount !== expected) {
      failures.push(`${label}: expected ${expected} logical primitives, got ${state.totals.logicalCount}`)
    }
    if (state.totals.visibleLogicalCount !== expected) {
      failures.push(`${label}: expected ${expected} visible logical primitives, got ${state.totals.visibleLogicalCount}`)
    }
  }
  requireLogicalCount('overview', overview, 312)
  requireLogicalCount('overview-all-revealed', overviewAllRevealed, 312)
  for (const materialName of expectedMaterials) {
    const materialState = overview.byMaterial[materialName]
    if (!materialState) {
      failures.push(`overview: missing exact material ${materialName}`)
      continue
    }
    if (materialState.logicalCount !== 78 || materialState.visibleLogicalCount !== 78) {
      failures.push(
        `overview: ${materialName} expected 78/78 visible, got ` +
        `${materialState.visibleLogicalCount}/${materialState.logicalCount}`,
      )
    }
  }
  if (overview.byKind.instanced?.logicalCount !== 160 || overview.byKind.instanced?.visibleLogicalCount !== 160) {
    failures.push('overview: positive instanced cohort is not fully visible (expected 160/160)')
  }
  if (
    overview.byKind['mirrored-standalone']?.logicalCount !== 152 ||
    overview.byKind['mirrored-standalone']?.visibleLogicalCount !== 152
  ) {
    failures.push('overview: mirrored standalone cohort is not fully visible (expected 152/152)')
  }
  for (const { phase, state } of phases) requireLogicalCount(`animation phase ${phase}`, state, 312)
  failures.push(...pageErrors.map((error) => `page error: ${error}`))
  failures.push(...consoleErrors.map((error) => `console error: ${error}`))

  report = {
    ok: failures.length === 0,
    failures,
    initial,
    overview,
    overviewAllRevealed,
    phases,
    pageErrors,
    consoleErrors,
  }
} catch (error) {
  report = {
    ok: false,
    failure: error?.stack || String(error),
    pageErrors,
    consoleErrors,
  }
} finally {
  await browser.close()
}

await writeFile(resolve(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
const compact = report.failure
  ? report
  : {
      ok: report.ok,
      failures: report.failures,
      overview: {
        totals: report.overview.totals,
        byKind: report.overview.byKind,
        byMaterial: report.overview.byMaterial,
      },
      phases: report.phases.map(({ phase, state }) => ({
        phase,
        totals: state.totals,
      })),
      pageErrors: report.pageErrors,
      consoleErrors: report.consoleErrors,
    }
console.log(JSON.stringify(compact, null, 2))
if (!report.ok) process.exitCode = 1
