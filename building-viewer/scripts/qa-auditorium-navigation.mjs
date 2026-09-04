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
    const animatedLayerId = 'icm-anim-2025'
    world.setQueryLayer('icm-anim-2025')
    // Exercise the same regional activation path used during normal walking.
    world.setPlacementMode(false)
    controller.debugSteps = false

    const layerSources = world.layerChunks.get('icm-anim-2025') || []
    const sourceNames = layerSources.flatMap((source) => source.sourceNames || [])
    const sourceMap = new Map(layerSources.map((source) => [source.name, source.sourceNames || []]))
    const animatedRoot = viewer.models.getLayer(animatedLayerId)?.root || null
    // gltfpack-generated mesh ordinals change whenever preceding geometry is
    // split or reordered. Select the authored floor family instead so the
    // rendered-height regression remains bound to the auditorium geometry.
    const auditoriumSurfaces = []
    animatedRoot?.traverse((object) => {
      if (!object.isMesh) return
      const materials = (Array.isArray(object.material)
        ? object.material
        : [object.material]
      ).filter(Boolean)
      if (
        materials.length > 0 &&
        materials.every((material) => material.name === 'Floor_Wood_Vray_001')
      ) {
        auditoriumSurfaces.push(object)
      }
    })
    const visualRaycaster = viewer.pegman.raycaster

    const renderedAuditoriumY = (x, z) => {
      if (!auditoriumSurfaces.length || !visualRaycaster) return null
      const origin = controller.position.clone().set(x, 7, z)
      visualRaycaster.ray.origin.copy(origin)
      visualRaycaster.ray.direction.set(0, -1, 0)
      visualRaycaster.near = 0
      visualRaycaster.far = 8
      const hit = visualRaycaster
        .intersectObjects(auditoriumSurfaces, false)
        .find((entry) => entry.face && Math.abs(entry.face.normal.y) >= 0.4)
      return hit?.point.y ?? null
    }

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

    const makeAisleAEdgeRoute = (driftDegrees) => {
      const centerline = inputRoutes.aisleA
      const first = centerline[0]
      const second = centerline[1]
      const dx = second[0] - first[0]
      const dz = second[2] - first[2]
      const length = Math.hypot(dx, dz)
      const forwardX = dx / length
      const forwardZ = dz / length
      // Signed right offset. -0.75 is the exact chair-side edge that exposed
      // the guide/CAD disagreement at the first auditorium tread.
      const rightX = forwardZ
      const rightZ = -forwardX
      const baseOffset = -0.75
      const driftSlope = Math.tan((driftDegrees * Math.PI) / 180)
      let travelled = 0
      const edge = centerline.map((point, index) => {
        if (index > 0) {
          const previous = centerline[index - 1]
          travelled += Math.hypot(point[0] - previous[0], point[2] - previous[2])
        }
        // Exercise a real +/-4 degree steering drift without eventually
        // leaving the 2.2 m aisle. After three metres the path runs parallel
        // to the edge at the accumulated lateral displacement.
        const offset = baseOffset + driftSlope * Math.min(travelled, 3)
        return [
          point[0] + rightX * offset,
          point[1],
          point[2] + rightZ * offset,
        ]
      })
      const approachDistance = 1.6
      const approach = [
        edge[0][0] - forwardX * approachDistance,
        0,
        edge[0][2] - forwardZ * approachDistance,
      ]
      return [approach, ...edge]
    }

    const runContinuousApproach = (name, points) => {
      world.setQueryLayer(animatedLayerId)
      world.setPlacementMode(false)
      const start = points[0]
      const startProbe = controller.position.clone().set(start[0], start[1] + 0.55, start[2])
      world.setFocus(startProbe)
      const support = world.raycastBestGround(startProbe, 1.4, controller.params.maxSlope)
      if (!support) {
        return {
          name,
          startSupport: null,
          legs: [],
          speed: controller.params.walkSpeed,
        }
      }

      const startSupport = {
        point: [start[0], support.point.y, start[2]],
        layerId: support.layerId || null,
        sourceName: support.sourceName || null,
        sourceNames: sourceMap.get(support.sourceName) || [],
      }
      controller.setFeetPosition(
        controller.position.clone().set(start[0], support.point.y, start[2]),
      )
      const idle = controller.position.clone().set(0, 0, 0)
      for (let frame = 0; frame < 30; frame += 1) {
        world.setFocus(controller.position)
        controller.update(1 / 60, idle, 0)
      }

      const initialGrounded = controller.onGround
      const initialQueryLayer = world.getQueryLayer()
      const legs = []
      const wrongQueryLayerSamples = []
      const foreignSupportSamples = []
      const missingSupportSamples = []
      const belowSupportSamples = []
      const belowRenderedSamples = []
      let airborneRun = 0
      let maxAirborneFrames = 0
      let unsupportedRun = 0
      let maxUnsupportedFrames = 0
      let minSupportGap = Infinity
      let maxSupportGap = -Infinity
      let minRenderedGap = Infinity
      let renderedSamples = 0

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
          controller.update(1 / 60, direction, controller.params.walkSpeed)

          const moved = Math.hypot(
            controller.position.x - before.x,
            controller.position.z - before.z,
          )
          maxFrameMove = Math.max(maxFrameMove, moved)
          if (moved < 1e-4) stallFrames += 1
          else stallFrames = 0
          maxStallFrames = Math.max(maxStallFrames, stallFrames)

          const queryLayer = world.getQueryLayer()
          if (queryLayer !== animatedLayerId && wrongQueryLayerSamples.length < 12) {
            wrongQueryLayerSamples.push({
              pointIndex,
              frame: frames,
              queryLayer,
              feet: controller.position.toArray(),
            })
          }

          if (controller.onGround) airborneRun = 0
          else airborneRun += 1
          maxAirborneFrames = Math.max(maxAirborneFrames, airborneRun)

          const supportOrigin = controller.position.clone()
          supportOrigin.y += controller.params.stepHeight + 0.2
          const frameSupport = world.raycastBestGround(
            supportOrigin,
            controller.params.stepHeight + controller.params.groundSnapDistance + 0.45,
            controller.params.maxSlope,
          )
          if (!frameSupport) {
            unsupportedRun += 1
            if (missingSupportSamples.length < 12) {
              missingSupportSamples.push({
                pointIndex,
                frame: frames,
                feet: controller.position.toArray(),
              })
            }
          } else {
            const supportY = frameSupport.point.y
            const supportGap = controller.position.y - supportY
            minSupportGap = Math.min(minSupportGap, supportGap)
            maxSupportGap = Math.max(maxSupportGap, supportGap)
            const supported = supportGap >= -0.05 &&
              supportGap <= controller.params.groundSnapDistance + 0.08
            unsupportedRun = supported ? 0 : unsupportedRun + 1
            if (!supported && belowSupportSamples.length < 12) {
              belowSupportSamples.push({
                pointIndex,
                frame: frames,
                feet: controller.position.toArray(),
                supportY,
                supportGap,
                layerId: frameSupport.layerId || null,
                sourceName: frameSupport.sourceName || null,
              })
            }
            if (
              frameSupport.layerId &&
              frameSupport.layerId !== animatedLayerId &&
              foreignSupportSamples.length < 12
            ) {
              foreignSupportSamples.push({
                pointIndex,
                frame: frames,
                feet: controller.position.toArray(),
                layerId: frameSupport.layerId,
                sourceName: frameSupport.sourceName || null,
              })
            }
          }
          maxUnsupportedFrames = Math.max(maxUnsupportedFrames, unsupportedRun)

          const renderedY = renderedAuditoriumY(controller.position.x, controller.position.z)
          if (renderedY != null) {
            const renderedGap = controller.position.y - renderedY
            renderedSamples += 1
            minRenderedGap = Math.min(minRenderedGap, renderedGap)
            if (renderedGap < -0.04 && belowRenderedSamples.length < 12) {
              belowRenderedSamples.push({
                pointIndex,
                frame: frames,
                feet: controller.position.toArray(),
                renderedY,
                renderedGap,
              })
            }
          }
        }

        const distance = Math.hypot(
          controller.position.x - target[0],
          controller.position.z - target[2],
        )
        const travelledDistance = Math.hypot(
          controller.position.x - legStart.x,
          controller.position.z - legStart.z,
        )
        const reached = distance <= 0.2
        legs.push({
          target,
          frames,
          plannedDistance,
          effectiveSpeed: frames > 0 ? travelledDistance / (frames / 60) : 0,
          maxFrameMove,
          maxStallFrames,
          reached,
          distance,
          feet: controller.position.toArray(),
          onGround: controller.onGround,
          queryLayer: world.getQueryLayer(),
        })
        // Avoid multiplying a genuine first-leg regression into six more
        // 900-frame timeouts; the collected continuous evidence is sufficient.
        if (!reached) break
      }

      return {
        name,
        speed: controller.params.walkSpeed,
        startSupport,
        initialGrounded,
        initialQueryLayer,
        legs,
        maxAirborneFrames,
        maxUnsupportedFrames,
        minSupportGap: Number.isFinite(minSupportGap) ? minSupportGap : null,
        maxSupportGap: Number.isFinite(maxSupportGap) ? maxSupportGap : null,
        minRenderedGap: Number.isFinite(minRenderedGap) ? minRenderedGap : null,
        renderedSamples,
        wrongQueryLayerSamples,
        foreignSupportSamples,
        missingSupportSamples,
        belowSupportSamples,
        belowRenderedSamples,
      }
    }

    const sampleExactEdgeSurface = () => {
      const x = -23.063447202660996
      const z = -62.12037328733253
      world.setQueryLayer(animatedLayerId)
      world.setPlacementMode(false)
      const origin = controller.position.clone().set(x, 7, z)
      world.setFocus(origin)
      const collision = world.raycastBestGround(origin, 8, controller.params.maxSlope)
      const renderedY = renderedAuditoriumY(x, z)
      return {
        x,
        z,
        expectedRenderedY: 0.36083984375,
        renderedY,
        collisionY: collision?.point.y ?? null,
        collisionLayerId: collision?.layerId || null,
        collisionSourceName: collision?.sourceName || null,
        collisionSourceNames: sourceMap.get(collision?.sourceName) || [],
        delta: collision && renderedY != null ? collision.point.y - renderedY : null,
      }
    }

    const results = []
    results.push(run('chair-side', inputRoutes.chairSide))
    for (const [name, points] of Object.entries(inputRoutes).filter(([name]) => name !== 'chairSide')) {
      results.push(run(`${name}-up`, points))
      results.push(run(`${name}-down`, [...points].reverse()))
    }
    // The reported failure occurs at the phase-0 auditorium entrance. Legacy
    // route QA above intentionally remains at phase 1 for comparison.
    viewer.seekAnimationNormalized(0)
    animatedRoot?.updateMatrixWorld(true)
    const exactEdgeSurface = sampleExactEdgeSurface()
    const sinkRegression = [0, -4, 4].map((driftDegrees) =>
      runContinuousApproach(
        `aisleA-edge-minus075-drift-${driftDegrees >= 0 ? 'plus' : 'minus'}${Math.abs(driftDegrees)}`,
        makeAisleAEdgeRoute(driftDegrees),
      ),
    )
    return {
      results,
      exactEdgeSurface,
      sinkRegression,
      sourceNames,
      auditoriumSurfaceCandidates: auditoriumSurfaces.map((surface) => ({
        name: surface.name || '',
        materials: (Array.isArray(surface.material)
          ? surface.material
          : [surface.material]
        ).filter(Boolean).map((material) => material.name || ''),
      })),
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

  assert.ok(report.exactEdgeSurface, 'missing exact auditorium edge surface sample')
  assert.ok(
    report.auditoriumSurfaceCandidates.length > 0,
    'no Floor_Wood_Vray_001 rendered surface candidates were found',
  )
  assert.ok(
    report.exactEdgeSurface.renderedY != null,
    'exact auditorium edge sample did not hit the rendered wood floor',
  )
  assert.ok(
    Math.abs(
      report.exactEdgeSurface.renderedY - report.exactEdgeSurface.expectedRenderedY,
    ) <= 0.01,
    `exact auditorium edge rendered Y changed: ${report.exactEdgeSurface.renderedY}`,
  )
  assert.ok(
    report.exactEdgeSurface.collisionY != null,
    'exact auditorium edge sample has no collision support',
  )
  assert.equal(
    report.exactEdgeSurface.collisionLayerId,
    'icm-anim-2025',
    `exact auditorium edge support came from ${report.exactEdgeSurface.collisionLayerId}`,
  )
  assert.ok(
    Math.abs(report.exactEdgeSurface.delta) <= 0.04,
    `exact auditorium edge collision/render gap is ${report.exactEdgeSurface.delta?.toFixed(3)} m`,
  )

  assert.equal(report.sinkRegression.length, 3, 'missing auditorium edge-drift regressions')
  for (const route of report.sinkRegression) {
    assert.ok(route.startSupport, `${route.name}: lower approach has no collision support`)
    assert.equal(
      route.startSupport.layerId,
      'icm-anim-2025',
      `${route.name}: lower approach belongs to ${route.startSupport.layerId}`,
    )
    assert.equal(route.initialGrounded, true, `${route.name}: lower approach did not settle grounded`)
    assert.equal(
      route.initialQueryLayer,
      'icm-anim-2025',
      `${route.name}: initial query layer changed to ${route.initialQueryLayer}`,
    )
    assert.equal(route.legs.length, 7, `${route.name}: continuous route stopped before the upper aisle`)
    for (const [index, leg] of route.legs.entries()) {
      assert.equal(
        leg.reached,
        true,
        `${route.name} leg ${index + 1} stalled at ${JSON.stringify(leg.feet)}`,
      )
      assert.ok(
        leg.maxStallFrames < 45,
        `${route.name} leg ${index + 1} stalled for ${leg.maxStallFrames} frames`,
      )
      assert.ok(
        leg.maxFrameMove <= 0.2,
        `${route.name} leg ${index + 1} jumped ${leg.maxFrameMove.toFixed(3)} m in one frame`,
      )
    }
    assert.deepEqual(
      route.wrongQueryLayerSamples,
      [],
      `${route.name}: query layer left icm-anim-2025`,
    )
    assert.deepEqual(
      route.foreignSupportSamples,
      [],
      `${route.name}: a foreign layer supplied auditorium support`,
    )
    assert.ok(
      route.maxAirborneFrames <= 3,
      `${route.name}: remained airborne for ${route.maxAirborneFrames} frames`,
    )
    assert.ok(
      route.maxUnsupportedFrames <= 2,
      `${route.name}: lacked continuous support for ${route.maxUnsupportedFrames} frames`,
    )
    assert.ok(
      route.minSupportGap != null && route.minSupportGap >= -0.05,
      `${route.name}: feet fell ${Math.abs(route.minSupportGap ?? 0).toFixed(3)} m below collision support`,
    )
    assert.ok(
      route.minRenderedGap != null && route.minRenderedGap >= -0.04,
      `${route.name}: feet fell ${Math.abs(route.minRenderedGap ?? 0).toFixed(3)} m below the rendered wood floor`,
    )
    assert.ok(route.renderedSamples > 0, `${route.name}: no rendered stair samples were collected`)
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
  exactEdgeSurface: report.exactEdgeSurface,
  sinkRegression: report.sinkRegression?.map((route) => ({
    name: route.name,
    speed: route.speed,
    legs: route.legs.length,
    maxAirborneFrames: route.maxAirborneFrames,
    maxUnsupportedFrames: route.maxUnsupportedFrames,
    minSupportGap: route.minSupportGap,
    minRenderedGap: route.minRenderedGap,
    wrongQueryLayerSamples: route.wrongQueryLayerSamples,
    finalFeet: route.legs.at(-1)?.feet ?? null,
  })) ?? [],
  pageErrors: report.pageErrors,
  failure: report.failure,
}, null, 2))
