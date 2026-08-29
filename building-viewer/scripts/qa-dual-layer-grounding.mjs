import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5192/'
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 2048, height: 1024 } })
page.setDefaultTimeout(420_000)
await page.addInitScript(() => sessionStorage.setItem('building-viewer-demo-unlocked', '1'))
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.stack || error.message))

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => {
  const viewer = window.__iomBuildingViewer
  return Boolean(
    viewer?.models?.getLayer?.('icm-ext') &&
    viewer?.pegman?.world &&
    viewer?.collision?.resident?.some?.((chunk) => chunk.layerId === 'icm-ext'),
  )
})
console.log('  exterior layer ready')
await page.evaluate(async () => window.__iomBuildingViewer.ensureLayer('icm-anim-2025', true))
await page.waitForFunction(() => {
  const viewer = window.__iomBuildingViewer
  return Boolean(
    viewer?.models?.getLayer?.('icm-anim-2025') &&
    viewer?.pegman?.world &&
    viewer?.collision?.resident?.some?.((chunk) => chunk.layerId === 'icm-anim-2025'),
  )
})
console.log('  animated layer ready')

const bridge = await page.evaluate(() => {
  const viewer = window.__iomBuildingViewer
  const layer = viewer.models.getLayer('icm-anim-2025')
  const wanted = new Map([
    ['Floor', 'vray Bruecke_Gitter'],
    ['Floor001', 'vray Bruecke_Gitter'],
    ['Floor_Mitte', 'vray Bruecke_Gitter'],
    ['Gangway_Raster', 'vray Bruecke_Gitter_saal_14'],
  ])
  const meshes = []
  layer.root.traverse((object) => {
    if (!object.isMesh || !wanted.has(object.name)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const expected = wanted.get(object.name)
    if (!materials.some((material) => material?.name === expected)) return
    const position = object.geometry?.getAttribute?.('position')
    const index = object.geometry?.getIndex?.()
    meshes.push({
      name: object.name,
      triangles: index ? index.count / 3 : (position?.count ?? 0) / 3,
      sides: materials.map((material) => material?.side ?? null),
      explicitWalkable: object.userData?.iomExplicitWalkable === true,
    })
  })

  viewer.collision.setPlacementMode(true)
  viewer.collision.setQueryLayer('icm-anim-2025')
  const probe = viewer.controller.position.clone().set(-64, 14.2, 34)
  const support = viewer.collision.raycastBestGround(probe, 2, 0.65)
  const feet = viewer.controller.position.clone().set(-64, 13.116174271897167, 34)
  viewer.controller.setFeetPosition(feet)
  const idle = feet.clone().set(0, 0, 0)
  for (let i = 0; i < 120; i += 1) viewer.controller.update(1 / 60, idle, 0)
  const controller = {
    feet: viewer.controller.position.toArray(),
    onGround: viewer.controller.onGround,
  }
  viewer.collision.setQueryLayer(null)
  viewer.collision.setPlacementMode(false)
  return {
    layerTriangles: viewer.collision.layerTriangleCount('icm-anim-2025'),
    meshes,
    extProbeChunks: viewer.collision.resident
      .filter((chunk) =>
        chunk.layerId === 'icm-ext' &&
        chunk.box.min.x <= -71 && chunk.box.max.x >= -71 &&
        chunk.box.min.z <= -148 && chunk.box.max.z >= -148
      )
      .map((chunk) => ({
        name: chunk.sourceName,
        min: chunk.box.min.toArray(),
        max: chunk.box.max.toArray(),
        triangles: chunk.triangles,
      })),
    support: support
      ? { y: support.point.y, layerId: support.layerId, sourceName: support.sourceName }
      : null,
    controller,
  }
})

assert.ok(
  bridge.layerTriangles >= 121_140 && bridge.layerTriangles <= 150_000,
  `animated runtime collision must retain bridge/stair support within budget (${bridge.layerTriangles})`,
)
for (const [name, triangles] of [['Floor', 144], ['Floor001', 144], ['Floor_Mitte', 14]]) {
  const mesh = bridge.meshes.find((entry) => entry.name === name)
  assert.ok(mesh, `${name} bridge mesh must survive preparation`)
  assert.equal(mesh.triangles, triangles)
  assert.equal(mesh.explicitWalkable, true)
  assert.ok(mesh.sides.every((side) => side === 2), `${name} must render DoubleSide`)
}
const gangway = bridge.meshes.find((entry) => entry.name === 'Gangway_Raster')
assert.ok(gangway, 'Gangway_Raster must survive preparation')
assert.equal(gangway.triangles, 72)
assert.equal(gangway.explicitWalkable, true)
assert.ok(gangway.sides.every((side) => side === 2), 'Gangway_Raster must render DoubleSide')
assert.ok(bridge.support, 'bridge probe must find collision support')
assert.equal(bridge.support.layerId, 'icm-anim-2025')
assert.ok(Math.abs(bridge.support.y - 13.116174271897167) <= 0.03)
assert.equal(bridge.controller.onGround, true)
assert.ok(Math.abs(bridge.controller.feet[1] - 13.116174271897167) <= 0.03)
console.log(`  bridge grounded at Y=${bridge.controller.feet[1].toFixed(3)}`)
assert.ok(
  bridge.extProbeChunks.every((chunk) => chunk.max[1] < 5),
  `collapsed instanced collision returned at the former phantom probe: ${JSON.stringify(bridge.extProbeChunks)}`,
)

async function dropAt(cameraPosition, cameraTarget, clientX, clientY) {
  const placement = await page.evaluate(({ cameraPosition: position, cameraTarget: target, clientX: x, clientY: y }) => {
    const viewer = window.__iomBuildingViewer
    viewer.exitWalk()
    viewer.orbit.setEnabled(false)
    viewer.camera.position.set(...position)
    viewer.camera.lookAt(...target)
    viewer.camera.updateMatrixWorld(true)
    const pegman = viewer.pegman
    let dropResult = null
    const originalOnDrop = pegman.onDrop
    pegman.onDrop = (result) => {
      dropResult = {
        ok: result.ok,
        reason: result.reason ?? null,
        point: result.point?.toArray?.() ?? null,
        layerId: result.layerId ?? null,
      }
      originalOnDrop(result)
    }
    pegman.beginDrag(new PointerEvent('pointerdown', { clientX: 40, clientY: 980 }))
    pegman.handleMove(new PointerEvent('pointermove', { clientX: x, clientY: y }))
    const preview = {
      valid: pegman.valid,
      point: pegman.lastPoint?.toArray?.() ?? null,
    }
    const visibleSurface = pegman.raycastVisualSurface()
    const visibleValidation = visibleSurface ? pegman.validateSurface(visibleSurface) : null
    const visible = visibleSurface
      ? {
          point: visibleSurface.point.toArray(),
          normal: visibleSurface.normal.toArray(),
          layerId: visibleSurface.layerId ?? null,
          objectName: visibleSurface.objectName ?? null,
          materialName: visibleSurface.materialName ?? null,
          validation: visibleValidation
            ? {
                ok: visibleValidation.ok,
                reason: visibleValidation.reason ?? null,
                point: visibleValidation.point?.toArray?.() ?? null,
              }
            : null,
        }
      : null
    const startedAt = performance.now()
    pegman.handleUp(new PointerEvent('pointerup', { clientX: x, clientY: y }))
    pegman.onDrop = originalOnDrop
    return {
      preview,
      visible,
      dropResult,
      mode: viewer.mode,
      dropMs: performance.now() - startedAt,
    }
  }, { cameraPosition, cameraTarget, clientX, clientY })
  assert.equal(placement.preview.valid, true, 'fast collision preview must accept the selected surface')
  assert.equal(
    placement.dropResult?.ok,
    true,
    `authoritative visible drop failed: ${JSON.stringify(placement)}`,
  )
  assert.equal(placement.mode, 'walk', 'successful drop must enter Walk immediately')
  await page.waitForFunction(
    () => window.__iomBuildingViewer.controller.onGround === true,
    undefined,
    { timeout: 15_000 },
  )
  // Let the entry transition finish so we measure the actual idle pose rather
  // than a one-frame walk/idle blend.
  await page.waitForTimeout(500)
  const final = await page.evaluate(() => {
    const viewer = window.__iomBuildingViewer
    const feet = viewer.controller.position.clone()
    const support = viewer.collision.raycastBestGround(feet.clone().setY(feet.y + 0.5), 1.2, 0.45)
    const visualRoot = viewer.character.root
    visualRoot.updateMatrixWorld(true)

    let avatarMinY = Infinity
    visualRoot.traverse((object) => {
      if (!object.isSkinnedMesh || !object.geometry?.attributes?.position) return
      const vertex = feet.clone()
      const count = object.geometry.attributes.position.count
      for (let i = 0; i < count; i += 1) {
        object.getVertexPosition(i, vertex)
        object.localToWorld(vertex)
        avatarMinY = Math.min(avatarMinY, vertex.y)
      }
    })

    // Compare with the surface the user can actually see. Collision-only
    // agreement is insufficient: a stale/extracted collider may be elevated.
    viewer.pegman.raycaster.ray.origin.copy(feet).setY(feet.y + 5)
    viewer.pegman.raycaster.ray.direction.set(0, -1, 0)
    const rendered = viewer.pegman.raycastVisualSurface()
    return {
      feet: feet.toArray(),
      visualRoot: visualRoot.position.toArray(),
      avatarMinY,
      queryLayer: viewer.collision.getQueryLayer(),
      supportY: support?.point.y ?? null,
      supportLayer: support?.layerId ?? null,
      renderedY: rendered?.point.y ?? null,
      renderedLayer: rendered?.layerId ?? null,
      onGround: viewer.controller.onGround,
    }
  })
  return { ...placement, final }
}

const [extX, extY, extZ] = [-140, 0.0300140380859375, -200]
const exterior = await dropAt(
  [extX + 0.01, extY + 30, extZ + 5],
  [extX, extY, extZ],
  1024,
  512,
)
assert.equal(exterior.final.queryLayer, 'icm-ext', 'visible exterior paving must own walk collision')
assert.equal(exterior.final.supportLayer, 'icm-ext')
assert.equal(exterior.final.renderedLayer, 'icm-ext')
assert.ok(exterior.final.feet[1] < 1, 'exterior drop must not be promoted to the false Y=10 collider')
assert.ok(Math.abs(exterior.final.feet[1] - exterior.final.supportY) <= 0.05)
assert.ok(
  Math.abs(exterior.final.feet[1] - exterior.final.renderedY) <= 0.035,
  `exterior controller/rendered gap: feet=${exterior.final.feet[1]}, rendered=${exterior.final.renderedY}`,
)
assert.ok(
  Math.abs(exterior.final.avatarMinY - exterior.final.renderedY) <= 0.035,
  `exterior avatar/rendered gap: avatar=${exterior.final.avatarMinY}, rendered=${exterior.final.renderedY}`,
)
assert.deepEqual(exterior.final.visualRoot, exterior.final.feet)
assert.ok(exterior.dropMs < 2_000, `visible-surface correction was too slow (${exterior.dropMs.toFixed(1)} ms)`)

const interior = await dropAt(
  [-62.7180544535319, 9.599008655548096, -28.606885782877605],
  [-62.7180544535319, 6.099008655548095, -29.406885782877605],
  1024,
  512,
)
assert.equal(interior.final.queryLayer, 'icm-anim-2025', 'visible interior floor must own walk collision')
assert.equal(interior.final.supportLayer, 'icm-anim-2025')
assert.equal(interior.final.renderedLayer, 'icm-anim-2025')
assert.ok(Math.abs(interior.final.feet[1] - 6.099008655548095) <= 0.2)
assert.ok(Math.abs(interior.final.feet[1] - interior.final.supportY) <= 0.05)
assert.ok(
  Math.abs(interior.final.feet[1] - interior.final.renderedY) <= 0.035,
  `interior controller/rendered gap: feet=${interior.final.feet[1]}, rendered=${interior.final.renderedY}`,
)
assert.ok(
  Math.abs(interior.final.avatarMinY - interior.final.renderedY) <= 0.035,
  `interior avatar/rendered gap: avatar=${interior.final.avatarMinY}, rendered=${interior.final.renderedY}`,
)
assert.deepEqual(interior.final.visualRoot, interior.final.feet)
assert.ok(interior.dropMs < 2_000, `interior visible-surface correction was too slow (${interior.dropMs.toFixed(1)} ms)`)

assert.deepEqual(pageErrors, [], `browser page errors:\n${pageErrors.join('\n')}`)
await browser.close()

console.log('Dual-layer browser grounding: PASS')
console.log(`  exterior: ${exterior.final.queryLayer}, feet Y=${exterior.final.feet[1].toFixed(3)}, drop ${exterior.dropMs.toFixed(1)} ms`)
console.log(`  interior: ${interior.final.queryLayer}, feet Y=${interior.final.feet[1].toFixed(3)}, drop ${interior.dropMs.toFixed(1)} ms`)
