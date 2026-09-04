import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5192/?qa=auditorium-navigation'
const outDir = resolve(process.argv[3] || 'tmp/qa-auditorium-navigation')
const routes = {
  aisleA: [
    [-22.654, 0.507, -61.492],
    [-24.468, 0.979, -60.31],
    [-28.712, 2.275, -57.546],
    [-34.39, 3.81, -53.848],
    [-37.742, 4.534, -51.664],
    [-41.09, 5.309, -49.484],
    [-42.766, 5.8, -48.388],
  ],
  aisleB: [
    [-36.634, 0.507, -85.228],
    [-38.544, 0.979, -84.214],
    [-43.012, 2.275, -81.842],
    [-49, 3.81, -78.662],
    [-52.528, 4.534, -76.786],
    [-56.06, 5.309, -74.91],
    [-58.709, 5.8, -73.503],
  ],
  chairSide: [
    [-48.1, 3.494, -80.16],
    [-49.79, 3.807, -79.26],
    [-50.8, 3.967, -78.74],
  ],
}

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
page.setDefaultTimeout(420_000)
await page.addInitScript(() => sessionStorage.setItem('building-viewer-demo-unlocked', '1'))
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.stack || error.message))

let report
try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(window.__iomBuildingViewer?.models?.getLayer?.('icm-ext')))
  await page.evaluate(async () => {
    const viewer = window.__iomBuildingViewer
    await viewer.ensureLayer('icm-anim-2025', true)
    await viewer.ensureLayer('icm-ext', false)
    viewer.pauseAnimation()
    viewer.seekAnimationNormalized(1)
  })
  await page.waitForFunction(() =>
    window.__iomBuildingViewer?.collision?.resident?.some?.(
      (chunk) => chunk.layerId === 'icm-anim-2025',
    ),
  )

  report = await page.evaluate((inputRoutes) => {
    const viewer = window.__iomBuildingViewer
    const world = viewer.collision
    const controller = viewer.controller
    world.setQueryLayer('icm-anim-2025')
    // Exercise the same regional activation path used during normal walking.
    world.setPlacementMode(false)
    controller.debugSteps = false

    const layerSources = world.layerChunks.get('icm-anim-2025') || []
    const sourceNames = layerSources.flatMap((source) => source.sourceNames || [])
    const sourceMap = new Map(layerSources.map((source) => [source.name, source.sourceNames || []]))

    const run = (name, points) => {
      const start = points[0]
      const startProbe = controller.position.clone().set(start[0], start[1] + 0.45, start[2])
      world.setFocus(startProbe)
      const support = world.raycastBestGround(startProbe, 1.2, controller.params.maxSlope)
      if (!support) return { name, startSupport: null, legs: [] }
      // Collision queries reuse scratch vectors, so snapshot the initial hit
      // before subsequent controller updates mutate it.
      const supportY = support.point.y
      const supportSourceName = support.sourceName || null
      const supportSourceNames = sourceMap.get(support.sourceName) || []

      controller.setFeetPosition(
        controller.position.clone().set(start[0], supportY, start[2]),
      )
      world.setFocus(controller.position)
      const idle = controller.position.clone().set(0, 0, 0)
      for (let frame = 0; frame < 30; frame += 1) {
        world.setFocus(controller.position)
        controller.update(1 / 60, idle, 0)
      }

      const legs = []
      for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
        const target = points[pointIndex]
        const legStart = controller.position.clone()
        const plannedDistance = Math.hypot(target[0] - legStart.x, target[2] - legStart.z)
        let stallFrames = 0
        let maxStallFrames = 0
        let maxFrameMove = 0
        let frames = 0
        for (; frames < 900; frames += 1) {
          const before = controller.position.clone()
          const direction = before.clone().set(target[0] - before.x, 0, target[2] - before.z)
          const distance = Math.hypot(direction.x, direction.z)
          if (distance <= 0.18) break
          direction.normalize()
          world.setFocus(controller.position)
          controller.update(1 / 60, direction, 1.6)
          const moved = Math.hypot(
            controller.position.x - before.x,
            controller.position.z - before.z,
          )
          maxFrameMove = Math.max(maxFrameMove, moved)
          if (moved < 1e-4) stallFrames += 1
          else stallFrames = 0
          maxStallFrames = Math.max(maxStallFrames, stallFrames)
        }

        const distance = Math.hypot(
          controller.position.x - target[0],
          controller.position.z - target[2],
        )
        const capsule = controller.getCapsule()
        const hit = world.capsuleIntersect(capsule.start, capsule.end, capsule.radius)
        const travelled = Math.hypot(
          controller.position.x - legStart.x,
          controller.position.z - legStart.z,
        )
        legs.push({
          target,
          frames,
          plannedDistance,
          effectiveSpeed: frames > 0 ? travelled / (frames / 60) : 0,
          maxFrameMove,
          reached: distance <= 0.2,
          distance,
          heightError: Math.abs(controller.position.y - target[1]),
          maxStallFrames,
          feet: controller.position.toArray(),
          onGround: controller.onGround,
          contact: hit ? {
            sourceName: hit.sourceName || null,
            sourceNames: sourceMap.get(hit.sourceName) || [],
            stairZone: Boolean(hit.stairZone),
          } : null,
        })
      }
      return {
        name,
        startSupport: {
          point: [start[0], supportY, start[2]],
          sourceName: supportSourceName,
          sourceNames: supportSourceNames,
        },
        legs,
      }
    }

    const results = []
    results.push(run('chair-side', inputRoutes.chairSide))
    for (const [name, points] of Object.entries(inputRoutes).filter(([name]) => name !== 'chairSide')) {
      results.push(run(`${name}-up`, points))
      results.push(run(`${name}-down`, [...points].reverse()))
    }
    return {
      results,
      sourceNames,
      aisleSupplementNames: sourceNames.filter((name) =>
        /^COLLIDER_walk_auditorium_aisle_[ab]_\d+$/i.test(name),
      ),
    }
  }, routes)

  const forbiddenSource =
    /COLLIDER_(?:Mesh_1874(?:_\d+)?|BT3_innenwaende(?:_\d+)?|TU_(?:Links|Rechts)_Hinten|Kabine_S_D_Sprinkler(?:_?\d+)?)|Schild_Saal/i
  const leaked = report.sourceNames.filter((name) => forbiddenSource.test(name))
  assert.deepEqual(leaked, [], `false auditorium walk colliders remain: ${leaked.join(', ')}`)
  assert.equal(
    new Set(report.aisleSupplementNames).size,
    12,
    'expected six narrow navigation segments for each auditorium aisle',
  )

  for (const route of report.results) {
    assert.ok(route.startSupport, `${route.name}: no collision support at route start`)
    assert.ok(route.legs.length > 0, `${route.name}: route produced no movement legs`)
    for (const [index, leg] of route.legs.entries()) {
      assert.equal(
        leg.reached,
        true,
        `${route.name} leg ${index + 1} stalled at ${JSON.stringify(leg.feet)}; contact=${JSON.stringify(leg.contact)}`,
      )
      assert.ok(
        leg.maxStallFrames < 45,
        `${route.name} leg ${index + 1} stalled for ${leg.maxStallFrames} frames`,
      )
      assert.ok(
        leg.effectiveSpeed <= 2.2,
        `${route.name} leg ${index + 1} accelerated to ${leg.effectiveSpeed.toFixed(2)} m/s`,
      )
      assert.ok(
        leg.maxFrameMove <= 0.2,
        `${route.name} leg ${index + 1} jumped ${leg.maxFrameMove.toFixed(3)} m in one frame`,
      )
      assert.equal(leg.onGround, true, `${route.name} leg ${index + 1} ended ungrounded`)
      assert.ok(
        leg.heightError <= 0.4,
        `${route.name} leg ${index + 1} height error ${leg.heightError.toFixed(3)} m`,
      )
    }
    const final = route.legs.at(-1)
    assert.ok(final.heightError <= 0.15, `${route.name}: final height missed by ${final.heightError.toFixed(3)} m`)
  }
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('\n')}`)
  report.ok = true
} catch (error) {
  report = {
    ...(report || {}),
    ok: false,
    failure: error?.stack || String(error),
    pageErrors,
  }
  process.exitCode = 1
} finally {
  await browser.close()
}

await writeFile(resolve(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  ok: report.ok,
  aisleSupplementCount: report.aisleSupplementNames?.length ?? 0,
  routes: report.results?.map((route) => ({
    name: route.name,
    legs: route.legs.length,
    maxStallFrames: Math.max(0, ...route.legs.map((leg) => leg.maxStallFrames)),
    maxEffectiveSpeed: Math.max(0, ...route.legs.map((leg) => leg.effectiveSpeed)),
    maxFrameMove: Math.max(0, ...route.legs.map((leg) => leg.maxFrameMove)),
    finalFeet: route.legs.at(-1)?.feet ?? null,
  })) ?? [],
  pageErrors: report.pageErrors,
  failure: report.failure,
}, null, 2))
