/**
 * Browser regression for exterior/interior two-sided surfaces and determinant-
 * safe runtime packing. Requires the local viewer dev server (default :5192).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5192/?qa=surfaces'
const outDir = resolve(process.argv[3] || 'tmp/qa-surface-visibility')
await mkdir(outDir, { recursive: true })

// Names in the optimized GLBs lose punctuation (for example,
// BT3_innenwaende.004 becomes BT3_innenwaende004). The browser gate compares
// canonical names so it covers both the authored and post-gltfpack forms while
// staying exact enough to avoid matching unrelated walls or furniture.
const SURFACE_TARGETS = {
  'icm-ext': {
    auditedNodes: [],
    auditedMaterials: [
      { key: 'flugturm-default', names: ['mat_24 - Default'], required: true },
      { key: 'flugturm-default-001', names: ['mat_24 - Default_001'], required: true },
      { key: 'flugturm-default-002', names: ['mat_24 - Default_002'], required: true },
      { key: 'flugturm-default-003', names: ['mat_24 - Default_003'], required: true },
      { key: 'facade-shell', names: ['mat_fassade'], required: true },
      { key: 'material-30-facade', names: ['Material 30_002'], required: true },
      { key: 'sienna-facade', names: ['vray Paint - Sienna S_001'], required: true },
      { key: 'campus-open-roof', names: ['dach allu'], required: true },
    ],
  },
  'icm-anim-2025': {
    auditedNodes: [
      { key: 'bt3-front-wall', names: ['BT_3_front_wand_021.001'] },
      { key: 'facade-metal', names: ['Fassade_Metall.001'] },
      { key: 'wand-40-level-1', names: ['Wand_40.004'] },
      { key: 'facade-005', names: ['fassade.005'] },
      { key: 'west-tower', names: ['turm.001'] },
      { key: 'bt3-interior-walls-level-1', names: ['BT3_innenwaende.004'] },
      { key: 'bt1-cabin-elided-wall', names: ['BT1_Kabinen_wnde52'] },
      { key: 'bt2-plural-interior-wall', names: ['bt2_innenwaende001_K.002'] },
      { key: 'layer-plural-interior-wall', names: ['Layerinnenwaende088'] },
      { key: 'saal-plural-wall', names: ['saal1_waende.002'] },
      { key: 'load-bearing-compound-wall', names: ['obj_1_OG_s_13_tragwand_01'] },
      { key: 'first-floor-partition-s11', names: ['S11_trennwand'] },
      { key: 'first-floor-partition-s12', names: ['S12_trennwand'] },
      { key: 'foyer-door-aggregate-web-a', names: ['mesh_1153'], required: true },
      { key: 'foyer-door-aggregate-web-b', names: ['mesh_1154'], required: true },
      { key: 'west-connector-north', names: ['Verbindung West002.001'] },
      { key: 'west-connector-south', names: ['Verbindung West.001'] },
      { key: 'west-connector-north-end', names: ['Verbindung West002.002'] },
      { key: 'west-connector-south-end', names: ['Verbindung West.002'] },
      { key: 'foyer-exterior-roof', names: ['Foyer_Dach_aussen_1'], required: true },
      { key: 'foyer-exterior-roof-002', names: ['Foyer_Dach_aussen_002'], required: true },
      { key: 'ceiling-lights', names: ['Decken_Lampen'], required: true },
      {
        key: 'ground-floor-transition-ceiling',
        names: ['EG_decke_bergang_aussen'],
        required: true,
      },
      { key: 'stage-build-up-ceiling', names: ['Buhne_aufbau_decke'], required: true },
      {
        key: 'saal-ceiling-vent-panels',
        names: ['Saal_1_deckenpaneele_lftung001'],
        required: true,
      },
    ],
    auditedMaterials: [],
  },
}

const EXTERIOR_SURFACE_VIEWS = [
  {
    name: 'flugturm-low-east',
    position: [70, 16, -195.9],
    target: [29.25, 19, -195.9],
    fov: 44,
  },
  {
    name: 'flugturm-roof-oblique',
    position: [61, 63, -164],
    target: [29.25, 35, -195.9],
    fov: 46,
  },
  {
    name: 'ground-seeweg-grazing',
    position: [-120, 18, -150],
    target: [-102, 0.8, -91],
    fov: 52,
  },
  {
    name: 'c5-c6-floor-slab',
    position: [57, 100, 190],
    target: [57, -0.3, 107],
    fov: 50,
  },
  {
    name: 'campus-roof-above',
    position: [-52, 85, 34],
    target: [-52, 12, 34],
    fov: 54,
  },
  {
    name: 'campus-roof-below-oblique',
    position: [75, 4, 145],
    target: [-52, 12, 34],
    fov: 52,
  },
]

const INTERIOR_SURFACE_VIEWS = [
  {
    name: 'west-connector-above',
    position: [-164.3, 24, 13.24],
    target: [-164.3, 7.5, 13.24],
    fov: 48,
  },
  {
    name: 'west-connector-below',
    position: [-164.3, 4.3, 20.5],
    target: [-164.3, 6.4, 13.24],
    fov: 46,
  },
  {
    name: 'west-connector-east-end',
    position: [-153.5, 7.5, 13.24],
    target: [-170, 7.5, 13.24],
    fov: 54,
  },
  {
    name: 'west-connector-west-end',
    position: [-175.2, 7.5, 13.24],
    target: [-158.5, 7.5, 13.24],
    fov: 54,
  },
  {
    name: 'office-facade-block',
    position: [-85.57, 8.5, -42],
    target: [-85.57, 8.2, -68.44],
    fov: 50,
  },
  {
    name: 'bt3-interior-walls',
    position: [-19.91, 7.9, -88],
    target: [-19.91, 7.66, -99.01],
    fov: 46,
  },
  {
    name: 'wand-40',
    position: [24, 24, -61],
    target: [0.2, 7.66, -90.94],
    fov: 52,
  },
  {
    name: 'bt3-front-wall',
    position: [-31, 23, -21],
    target: [-61.52, 7.56, -54.58],
    fov: 52,
  },
  {
    name: 'facade-metal',
    position: [-125, 23, -34],
    target: [-85.57, 7.8, -68.44],
    fov: 52,
  },
  {
    name: 'west-tower-roof',
    position: [-3, 20, -14],
    target: [-14.88, 10.08, -27.86],
    fov: 46,
  },
]

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(420_000)
const pageErrors = []
const consoleErrors = []
page.on('pageerror', (error) => pageErrors.push(error.stack || error.message))
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) {
    consoleErrors.push(message.text())
  }
})
await page.addInitScript(() => sessionStorage.setItem('building-viewer-demo-unlocked', '1'))

const waitForLayer = (id) => page.waitForFunction(
  (layerId) => {
    const viewer = window.__iomBuildingViewer
    const layer = viewer?.models?.getLayer?.(layerId)
    return Boolean(layer?.result?.root && document.querySelector('.bv-loading')?.classList.contains('hidden'))
  },
  id,
  { polling: 500, timeout: 420_000 },
)

const inspectRuntime = (layerId) => page.evaluate(({ id, targetConfig }) => {
  const viewer = window.__iomBuildingViewer
  const layer = viewer.models.getLayer(id)
  const root = layer.result.root
  root.updateMatrixWorld(true)
  const materials = new Map()
  const auditedNodeObjects = []
  const auditedMaterialObjects = []
  let negativePackedTransforms = 0
  let negativeVisiblePackedTransforms = 0
  let inactiveNegativeBatchSlots = 0
  const negativePackedDetails = []
  const inactiveNegativeBatchDetails = []
  const batchInstanceEnumeration = {
    metadata: 0,
    internal: 0,
    contiguousFallback: 0,
    metadataMissingActiveIds: 0,
    metadataInactiveIds: 0,
  }
  let importedNegativeStandalone = 0
  let instancedMeshes = 0
  let batchedMeshes = 0
  const matrix = viewer.camera.matrix.clone()
  const canonicalName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const auditedNodes = (targetConfig.auditedNodes || []).map((target) => ({
    ...target,
    canonicalNames: target.names.map(canonicalName),
  }))
  const auditedMaterials = (targetConfig.auditedMaterials || []).map((target) => ({
    ...target,
    canonicalNames: target.names.map(canonicalName),
  }))

  root.traverse((object) => {
    if (object.userData?.importedNegativeInstance) importedNegativeStandalone += 1
    if (object.isInstancedMesh) {
      instancedMeshes += 1
      for (let index = 0; index < object.count; index += 1) {
        object.getMatrixAt(index, matrix)
        const determinant = matrix.determinant()
        if (determinant < -1e-8) {
          negativePackedTransforms += 1
          if (object.visible) negativeVisiblePackedTransforms += 1
          negativePackedDetails.push({
            kind: 'InstancedMesh',
            object: object.name || '',
            instanceId: index,
            determinant,
            objectWorldDeterminant: object.matrixWorld.determinant(),
            visible: object.visible,
            proceduralInstanced: Boolean(object.userData?.proceduralInstanced),
            spatiallySplitImported: Boolean(object.userData?.spatiallySplitImported),
          })
        }
      }
    } else if (object.isBatchedMesh) {
      batchedMeshes += 1
      const instanceInfo = Array.isArray(object._instanceInfo) ? object._instanceInfo : null
      const metadataIds = Array.isArray(object.userData?.batchInstances)
        ? object.userData.batchInstances
          .map((entry) => entry?.id)
          .filter((instanceId) => Number.isInteger(instanceId))
        : null
      let activeIds
      let enumeration
      if (metadataIds) {
        activeIds = [...new Set(metadataIds)]
        enumeration = 'metadata'
        batchInstanceEnumeration.metadata += 1
        if (instanceInfo) {
          const metadataSet = new Set(activeIds)
          batchInstanceEnumeration.metadataMissingActiveIds += instanceInfo.reduce(
            (count, info, instanceId) => count + (info?.active && !metadataSet.has(instanceId) ? 1 : 0),
            0,
          )
          batchInstanceEnumeration.metadataInactiveIds += activeIds.reduce(
            (count, instanceId) => count + (instanceInfo[instanceId]?.active === false ? 1 : 0),
            0,
          )
        }
      } else if (instanceInfo) {
        activeIds = instanceInfo.flatMap((info, instanceId) => info?.active ? [instanceId] : [])
        enumeration = 'internal'
        batchInstanceEnumeration.internal += 1
      } else {
        activeIds = Array.from({ length: object.instanceCount }, (_, instanceId) => instanceId)
        enumeration = 'contiguous-fallback'
        batchInstanceEnumeration.contiguousFallback += 1
      }

      for (const instanceId of activeIds) {
        if (instanceInfo?.[instanceId]?.active === false) continue
        object.getMatrixAt(instanceId, matrix)
        const determinant = matrix.determinant()
        if (determinant < -1e-8) {
          const visible = object.visible && (instanceInfo?.[instanceId]?.visible ?? true)
          negativePackedTransforms += 1
          if (visible) negativeVisiblePackedTransforms += 1
          negativePackedDetails.push({
            kind: 'BatchedMesh',
            object: object.name || '',
            instanceId,
            determinant,
            objectWorldDeterminant: object.matrixWorld.determinant(),
            visible,
            enumeration,
            proceduralBatched: Boolean(object.userData?.proceduralBatched),
          })
        }
      }

      // Deleted IDs can retain old matrix texture values. They do not enter
      // BatchedMesh's render list, so report them separately instead of
      // treating a sparse ID range as live geometry.
      if (instanceInfo && object._matricesTexture?.image?.data) {
        const data = object._matricesTexture.image.data
        for (let instanceId = 0; instanceId < instanceInfo.length; instanceId += 1) {
          if (instanceInfo[instanceId]?.active !== false) continue
          matrix.fromArray(data, instanceId * 16)
          const determinant = matrix.determinant()
          if (determinant < -1e-8) {
            inactiveNegativeBatchSlots += 1
            inactiveNegativeBatchDetails.push({
              object: object.name || '',
              instanceId,
              determinant,
            })
          }
        }
      }
    }
    if (!object.isMesh) return
    const objectPath = []
    for (let current = object; current && current !== root; current = current.parent) {
      if (current.name) objectPath.unshift(current.name)
    }
    const canonicalPath = objectPath.map(canonicalName)
    const matchingNodes = auditedNodes.filter((target) => (
      target.canonicalNames.some((name) => canonicalPath.includes(name))
    ))
    const hasExactRepairCertificate = (candidate) => Boolean(
      candidate?.userData?.iomSurfaceTopologyRepaired === true &&
        candidate?.userData?.iomSurfaceTopologyRepair ===
          'weld-seams-recalculate-normals-v1',
    )
    // Runtime independently re-audits every certificate before permitting
    // FrontSide. Exact mesh certificates do not need a persisted group audit;
    // direct-parent logical-mesh certificates do, and expose its result.
    const certifiedSurfaceRepair = Boolean(
      hasExactRepairCertificate(object) ||
        (hasExactRepairCertificate(object.parent) &&
          object.parent?.userData?.surfaceTopologyRepairAudit?.valid === true),
    )
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of objectMaterials) {
      if (!material) continue
      const reason = material.userData?.iomDoubleSidedReason || null
      const role = material.userData?.iomMaterialRole || null
      const key = `${material.uuid}`
      materials.set(key, {
        name: material.name || '',
        side: material.side,
        reason,
        role,
      })
      for (const target of matchingNodes) {
        auditedNodeObjects.push({
          target: target.key,
          object: object.name || '',
          path: objectPath.join('/'),
          material: material.name || '',
          side: material.side,
          reason,
          role,
          visibilityReason: object.userData?.surfaceVisibilityReason || null,
          certifiedSurfaceRepair,
        })
      }
      const canonicalMaterial = canonicalName(material.name)
      for (const target of auditedMaterials) {
        if (!target.canonicalNames.includes(canonicalMaterial)) continue
        auditedMaterialObjects.push({
          target: target.key,
          object: object.name || '',
          path: objectPath.join('/'),
          material: material.name || '',
          side: material.side,
          reason,
          role,
          visibilityReason: object.userData?.surfaceVisibilityReason || null,
        })
      }
    }
  })

  const materialList = [...materials.values()]
  const reasoned = materialList.filter((material) => material.reason)
  const roleMaterials = materialList.filter((material) => material.role)
  const exteriorFloorDebugCheckerMaterials = materialList.filter(
    (material) => material.name === 'Material 2097707472',
  )
  const auditedNodeChecks = auditedNodes.map((target) => {
    const matches = auditedNodeObjects.filter((entry) => entry.target === target.key)
    return {
      key: target.key,
      required: Boolean(target.required),
      runtimeNameRetained: matches.length > 0,
      matches: matches.length,
      frontSide: matches.filter(
        (entry) => entry.side !== 2 && !entry.certifiedSurfaceRepair,
      ),
      certifiedFrontSide: matches.filter(
        (entry) => entry.side !== 2 && entry.certifiedSurfaceRepair,
      ),
    }
  })
  const auditedMaterialChecks = auditedMaterials.map((target) => {
    const matches = auditedMaterialObjects.filter((entry) => entry.target === target.key)
    return {
      key: target.key,
      required: Boolean(target.required),
      matches: matches.length,
      frontSide: matches.filter((entry) => entry.side !== 2),
    }
  })
  return {
    layerId: id,
    surfaceAudit: root.userData.surfaceVisibilityAudit || null,
    materials: materialList.length,
    reasonedMaterials: reasoned.length,
    reasonedFrontSide: reasoned.filter((material) => material.side !== 2),
    roleMaterials: roleMaterials.length,
    roleFrontSide: roleMaterials.filter((material) => material.side !== 2),
    exteriorFloorDebugCheckerMaterials,
    auditedNodeChecks,
    auditedNodeObjects,
    auditedNodeFrontSide: auditedNodeObjects.filter(
      (target) => target.side !== 2 && !target.certifiedSurfaceRepair,
    ),
    auditedNodeCertifiedFrontSide: auditedNodeObjects.filter(
      (target) => target.side !== 2 && target.certifiedSurfaceRepair,
    ),
    auditedMaterialChecks,
    auditedMaterialObjects,
    auditedMaterialFrontSide: auditedMaterialObjects.filter((target) => target.side !== 2),
    negativePackedTransforms,
    negativeVisiblePackedTransforms,
    negativePackedDetails,
    inactiveNegativeBatchSlots,
    inactiveNegativeBatchDetails,
    batchInstanceEnumeration,
    importedNegativeStandalone,
    instancedMeshes,
    batchedMeshes,
    instancingReport: viewer.instancingReport || viewer.getStaticStats?.()?.instancing || null,
    render: {
      calls: viewer.renderer.info.render.calls,
      triangles: viewer.renderer.info.render.triangles,
      glError: viewer.renderer.getContext().getError(),
    },
  }
}, { id: layerId, targetConfig: SURFACE_TARGETS[layerId] || { auditedNodes: [], auditedMaterials: [] } })

const setCamera = (view) => page.evaluate(({ position: p, target: t, fov }) => {
  const viewer = window.__iomBuildingViewer
  viewer.orbit.setEnabled(false)
  viewer.camera.position.set(...p)
  viewer.orbit.controls.target.set(...t)
  viewer.camera.fov = fov
  viewer.camera.near = 0.05
  viewer.camera.far = 1200
  viewer.camera.updateProjectionMatrix()
  viewer.camera.lookAt(...t)
  viewer.orbit.controls.update()
  return {
    position: viewer.camera.position.toArray(),
    target: viewer.orbit.controls.target.toArray(),
    fov: viewer.camera.fov,
  }
}, view)

const captureViews = async (prefix, views) => {
  const captures = []
  for (const view of views) {
    const actualCamera = await setCamera(view)
    await page.waitForTimeout(600)
    const filename = `${prefix}-${view.name}.png`
    await page.locator('#viewer-canvas').screenshot({ path: resolve(outDir, filename) })
    captures.push({
      name: view.name,
      filename,
      requestedCamera: {
        position: view.position,
        target: view.target,
        fov: view.fov,
      },
      actualCamera,
    })
  }
  return captures
}

let report
try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForFunction(() => Boolean(window.__iomBuildingViewer), null, { timeout: 30_000 })
  // Keep the evidence images focused on geometry. Layer/camera state remains
  // recorded in report.json, so the HUD is redundant and otherwise obscures
  // the exact walls being inspected.
  await page.addStyleTag({ content: '#viewer-ui { visibility: hidden !important; }' })
  await waitForLayer('icm-ext')
  // Always install an explicit camera after a load/layer switch. Otherwise an
  // old orbit camera can make an "interior" screenshot an exterior overview.
  await setCamera(EXTERIOR_SURFACE_VIEWS[0])
  await page.waitForTimeout(1200)
  const exterior = await inspectRuntime('icm-ext')
  const exteriorCaptures = await captureViews('exterior', EXTERIOR_SURFACE_VIEWS)

  await page.evaluate(async () => {
    const viewer = window.__iomBuildingViewer
    await viewer.ensureLayer('icm-anim-2025', true)
    await viewer.ensureLayer('icm-ext', false)
  })
  await waitForLayer('icm-anim-2025')
  await page.waitForFunction(() => {
    const viewer = window.__iomBuildingViewer
    const interior = viewer.models.getLayer('icm-anim-2025')
    const exterior = viewer.models.getLayer('icm-ext')
    return interior?.result?.root?.visible === true && exterior?.result?.root?.visible === false
  }, null, { polling: 250, timeout: 30_000 })
  await setCamera(INTERIOR_SURFACE_VIEWS[0])
  await page.waitForTimeout(1600)
  const interior = await inspectRuntime('icm-anim-2025')
  const interiorCaptures = await captureViews('interior', INTERIOR_SURFACE_VIEWS)
  await page.evaluate(() => window.__iomBuildingViewer.playAnimation())
  await page.waitForTimeout(1200)
  const animation = await page.evaluate(() => window.__iomBuildingViewer.getAnimationState())

  const failures = []
  for (const state of [exterior, interior]) {
    if (state.reasonedFrontSide.length) failures.push(`${state.layerId}: authored two-sided material became FrontSide`)
    if (state.roleFrontSide.length) failures.push(`${state.layerId}: visibility-critical material became FrontSide`)
    if (state.auditedNodeFrontSide.length) failures.push(`${state.layerId}: exact audited node remained FrontSide`)
    if (state.auditedMaterialFrontSide.length) failures.push(`${state.layerId}: exact audited material remained FrontSide`)
    if (state.layerId === 'icm-ext' && state.exteriorFloorDebugCheckerMaterials.length) {
      failures.push(`${state.layerId}: C5/C6 floor debug checker material is still active`)
    }
    const missingRequiredMaterials = state.auditedMaterialChecks
      .filter((target) => target.required && target.matches === 0)
      .map((target) => target.key)
    const missingRequiredNodes = state.auditedNodeChecks
      .filter((target) => target.required && target.matches === 0)
      .map((target) => target.key)
    if (missingRequiredNodes.length) {
      failures.push(`${state.layerId}: required audited node(s) not found: ${missingRequiredNodes.join(', ')}`)
    }
    if (missingRequiredMaterials.length) {
      failures.push(`${state.layerId}: required audited material(s) not found: ${missingRequiredMaterials.join(', ')}`)
    }
    if (state.negativePackedTransforms) failures.push(`${state.layerId}: mirrored transform entered shared draw`)
    if (state.render.glError !== 0) failures.push(`${state.layerId}: WebGL error ${state.render.glError}`)
  }
  if (interior.reasonedMaterials < 40) failures.push('icm-anim-2025: too few authored surface roles survived')
  if (!animation?.available || animation.duration <= 0) {
    failures.push('icm-anim-2025: animation state missing')
  }
  if (pageErrors.length) failures.push(`${pageErrors.length} page error(s)`)
  if (consoleErrors.length) failures.push(`${consoleErrors.length} console error(s)`)

  report = {
    ok: failures.length === 0,
    failures,
    exterior,
    interior,
    captures: {
      exterior: exteriorCaptures,
      interior: interiorCaptures,
    },
    animation,
    pageErrors,
    consoleErrors,
  }
} catch (error) {
  await page.screenshot({ path: resolve(outDir, 'failure.png') }).catch(() => {})
  report = {
    ok: false,
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
