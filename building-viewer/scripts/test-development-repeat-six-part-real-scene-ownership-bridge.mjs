import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
} from 'three'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')
const MODEL_ID = 'icm-anim-2025'
const MANIFEST = JSON.parse(readFileSync(
  join(PROJECT_DIR, 'tmp/repeat-six-part-cohort-v4/manifest-v4.disabled.json'),
  'utf8',
))
const ROOT_PINS = [
  { ordinal: 258, runtimeName: 'mesh_1127', material: 'vray Stuhl_Plastik', triangles: 24_213 },
  { ordinal: 259, runtimeName: 'mesh_1128', material: 'vray Stuhl_Plakete', triangles: 7_102 },
  { ordinal: 260, runtimeName: 'mesh_1129', material: 'vray Stuhl_Metall', triangles: 14_041 },
  { ordinal: 261, runtimeName: 'mesh_1130', material: 'vray Stuhl_Bezug', triangles: 15_913 },
]

function catalogTemplates() {
  const templates = []
  const resources = []
  for (let segmentIndex = 0; segmentIndex < 6; segmentIndex += 1) {
    for (let materialIndex = 0; materialIndex < 4; materialIndex += 1) {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
      ]), 3))
      geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 1))
      const material = new MeshBasicMaterial()
      templates.push({ segmentIndex, materialIndex, geometry, material })
      resources.push(geometry, material)
    }
  }
  return { templates, resources }
}

function geometryWithTriangles(triangles) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ]), 3))
  geometry.setIndex(new BufferAttribute(new Uint32Array(triangles * 3), 1))
  return geometry
}

function matrixForInstance(index) {
  const matrix = new Matrix4()
  if (index >= 40) matrix.makeScale(-1, 1, 1)
  matrix.setPosition(index * 1.75, (index % 6) * 0.25, -index * 0.4)
  return matrix
}

function pinnedMesh(pin) {
  const material = new MeshBasicMaterial()
  material.name = pin.material
  const mesh = new InstancedMesh(geometryWithTriangles(pin.triangles), material, 78)
  mesh.name = pin.runtimeName
  for (let index = 0; index < 78; index += 1) mesh.setMatrixAt(index, matrixForInstance(index))
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

function sceneFixture() {
  const modelRoot = new Group()
  modelRoot.name = `Model:${MODEL_ID}`
  modelRoot.userData.layerId = MODEL_ID
  const activeScene = new Group()
  activeScene.name = 'Scene'
  modelRoot.add(activeScene)
  for (let ordinal = 0; ordinal < 258; ordinal += 1) activeScene.add(new Group())
  const roots = ROOT_PINS.map(pinnedMesh)
  for (const root of roots) activeScene.add(root)
  const entry = { id: MODEL_ID, name: 'ICM 2025 Animated', web: '/model.glb' }
  const layer = {
    id: MODEL_ID,
    entry,
    root: modelRoot,
    result: {
      root: modelRoot,
      url: entry.web,
      transferredBytes: null,
      downloadMs: 0,
      parseMs: 0,
      fileSizeBytes: null,
      animations: [],
    },
    visible: true,
    streaming: false,
  }
  return { modelRoot, activeScene, roots, layer }
}

class FakeAtomicRenderer {
  created = []
  disposed = []
  catalog = null

  createPersistentList(descriptor) {
    const list = Object.freeze({
      key: descriptor.key,
      initialState: 'hidden-zero-count-bounds-cleared',
    })
    this.created.push(list)
    return list
  }

  publishAtomicExactCatalog(publication) {
    this.catalog = publication
    return this.receipt(publication)
  }

  rollbackAtomicExactCatalog(request) {
    this.catalog = request.publication
    return this.receipt(request.publication)
  }

  receipt(publication) {
    const keys = Object.freeze(publication.lists.map((entry) => entry.descriptor.key))
    return Object.freeze({
      kind: 'development-repeat-six-part-renderer-publication-receipt',
      direction: publication.direction,
      operationId: publication.operationId,
      generation: publication.generation,
      rendererBaseRevision: publication.rendererBaseRevision,
      rendererRevision: publication.rendererRevision,
      atomicMatrixSlotMapsPublished: true,
      boundsRefreshPolicyHonored: true,
      publishedListKeys: keys,
      boundsRefreshedListKeys: keys,
    })
  }

  hidePersistentExactCatalog() {
    this.catalog = null
  }

  disposePersistentList(list) {
    this.disposed.push(list)
  }
}

class FakeFallback {
  activateMonolithicFallback() {}
}

function focusPoint() {
  const bounds = MANIFEST.catalog.sources[0].bounds
  return bounds.min.map((value, axis) => (value + bounds.max[axis]) / 2)
}

const vite = await createServer({
  root: PROJECT_DIR,
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

try {
  const {
    DevelopmentRepeatSixPartPersistentCatalogRendererAdapter: Adapter,
  } = await vite.ssrLoadModule(
    '/src/scene/development/DevelopmentRepeatSixPartPersistentCatalogRendererAdapter.ts',
  )
  const {
    resolveDevelopmentRepeatSixPartProductionRoots: resolveRoots,
  } = await vite.ssrLoadModule(
    '/src/scene/development/DevelopmentRepeatSixPartProductionRootResolver.ts',
  )
  const {
    DevelopmentRepeatSixPartRealSceneOwnershipBridge: Bridge,
    DevelopmentRepeatSixPartRealSceneOwnershipBridgeError: BridgeError,
  } = await vite.ssrLoadModule(
    '/src/scene/development/DevelopmentRepeatSixPartRealSceneOwnershipBridge.ts',
  )
  const {
    DevelopmentRepeatSixPartThreeRendererPort: ThreeRendererPort,
  } = await vite.ssrLoadModule(
    '/src/scene/development/DevelopmentRepeatSixPartThreeRendererPort.ts',
  )

  let generationSequence = 83_000
  const ownedResources = []
  function createIssuedPort(generation, parent) {
    const fixture = catalogTemplates()
    ownedResources.push(...fixture.resources)
    return new ThreeRendererPort({
      generation,
      parent,
      parityHostMatrices: {
        positive: MANIFEST.parity.hosts.positive.matrix,
        mirrored: MANIFEST.parity.hosts.mirrored.matrix,
      },
      templates: fixture.templates,
    })
  }

  async function context() {
    const generation = generationSequence++
    const scene = sceneFixture()
    const resolution = resolveRoots(scene.layer)
    const catalogStage = new Group()
    catalogStage.name = 'detached-repeat-six-part-stage'
    catalogStage.visible = false
    const renderer = createIssuedPort(generation, catalogStage)
    const adapter = new Adapter({
      generation,
      domainId: `real-scene-bridge-test-${generation}`,
      manifest: MANIFEST,
      renderer,
      monolithicFallback: new FakeFallback(),
    })
    const update = await adapter.updateFocus({
      generation,
      focus: { space: 'owner-local', point: focusPoint() },
    })
    assert.equal(update.kind, 'committed', 'adapter fixture must be published before bridge construction')
    return {
      generation,
      scene,
      resolution,
      renderer,
      adapter,
      catalogStage,
      portRoot: renderer.root,
      rendererPort: renderer,
    }
  }

  function bridgeFor(value, resolution = value.resolution) {
    return new Bridge({
      generation: value.generation,
      resolution,
      adapter: value.adapter,
      rendererPort: value.rendererPort,
      catalogStage: value.catalogStage,
    })
  }

  function assertExactRootOrdinals(value) {
    for (let index = 0; index < value.scene.roots.length; index += 1) {
      const root = value.scene.roots[index]
      assert.equal(root.parent, value.scene.activeScene)
      assert.equal(value.scene.activeScene.children[ROOT_PINS[index].ordinal], root)
    }
  }

  // Success: seven immutable samples (prepared, five staged, committed), no
  // intermediate graph mutation, and pinned root ordinals never move.
  {
    const value = await context()
    const bridge = bridgeFor(value)
    const beforeChildren = [...value.scene.activeScene.children]
    const beforeGeometries = value.scene.roots.map((root) => root.geometry)
    const snapshot = bridge.commit()
    assert.equal(Object.isFrozen(snapshot), true)
    assert.equal(snapshot.state, 'committed-replacement-owner')
    assert.equal(snapshot.retainedRootAttachedCount, 4)
    assert.equal(snapshot.retainedRootRendererVisibleCount, 0)
    assert.equal(snapshot.retainedRootsAttachedAtExactOrdinals, true)
    assert.equal(snapshot.catalogStageMountedUnderActiveScene, true)
    assert.equal(snapshot.catalogVisible, true)
    assert.equal(snapshot.evidenceReceiptCount, 7)
    assert.equal(snapshot.currentPhysicalOwner, 'replacement-persistent-catalog')
    assert.equal(snapshot.ownershipEvidenceStatus, 'observer-receipt-current')
    assert.equal(snapshot.priorCommittedReceiptInvalidated, false)
    assert.equal(snapshot.emergencyFailCloseReason, null)
    assert.equal(snapshot.activationAuthorized, false)
    assert.equal(snapshot.activationCapability, null)
    assert.equal(snapshot.reverseHandoffContinuityClaimed, false)
    assertExactRootOrdinals(value)
    assert.deepEqual(value.scene.activeScene.children, beforeChildren)
    assert.deepEqual(value.scene.roots.map((root) => root.geometry), beforeGeometries)
    assert.equal(value.catalogStage.parent, value.scene.activeScene)
    assert.equal(value.catalogStage.visible, true)
    assert.equal(value.scene.roots.every((root) => root.visible === false), true)
    assert.equal(value.scene.roots.every((root) => root.userData.repeatSixPartSourceOwnership ===
      'retired-by-repeat-six-part-persistent-catalog'), true)
    assert.equal(value.scene.roots.every((root) => root.userData.proceduralInstanced === true), true)
    assert.equal(value.scene.roots.every((root) => root.userData.detailLodIgnore === true), true)
    assert.equal(value.scene.roots.every((root) =>
      root.userData.externallyManagedVisibility === 'repeat-six-part-catalog'), true)

    const evidence = bridge.getEvidence()
    assert.equal(Object.isFrozen(evidence), true)
    assert.equal(Object.isFrozen(evidence.receipts), true)
    assert.equal(evidence.activationAuthorized, false)
    assert.equal(evidence.currentReceipt, evidence.finalReceipt)
    assert.equal(evidence.currentPhysicalOwner, 'replacement-persistent-catalog')
    assert.equal(evidence.ownershipEvidenceStatus, 'observer-receipt-current')
    assert.equal(evidence.priorCommittedReceiptInvalidated, false)
    assert.equal(evidence.invalidatedCommittedEvidenceSequence, null)
    assert.deepEqual(evidence.receipts.map((receipt) => receipt.phase), [
      'prepared-original-owner',
      'forward-staged-original-owner',
      'forward-staged-original-owner',
      'forward-staged-original-owner',
      'forward-staged-original-owner',
      'ready-to-commit-original-owner',
      'committed-replacement-owner',
    ])
    assert.equal(evidence.receipts.every((receipt) => receipt.visibleOwnerCount === 1), true)

    // beforeunload entry restores synchronously before its disposal promise is awaited.
    const teardown = bridge.teardownForBeforeUnload()
    assertExactRootOrdinals(value)
    assert.equal(value.scene.roots.every((root) => root.visible), true)
    assert.equal(value.scene.roots.every((root) =>
      !Object.prototype.hasOwnProperty.call(root.userData, 'repeatSixPartSourceOwnership')), true)
    assert.equal(value.scene.roots.every((root) =>
      !Object.prototype.hasOwnProperty.call(root.userData, 'proceduralInstanced')), true)
    assert.equal(value.scene.roots.every((root) =>
      !Object.prototype.hasOwnProperty.call(root.userData, 'detailLodIgnore')), true)
    assert.equal(value.catalogStage.parent, null)
    assert.equal(value.catalogStage.visible, false)
    assert.equal(bridge.getSnapshot().state, 'torn-down-original-owner')
    assert.equal(bridge.getSnapshot().reverseHandoffContinuityClaimed, false)
    assert.equal(bridge.getSnapshot().currentPhysicalOwner, 'original-production-roots')
    assert.equal(bridge.getSnapshot().ownershipEvidenceStatus, 'invalidated-by-emergency-physical-fail-close')
    assert.equal(bridge.getSnapshot().priorCommittedReceiptInvalidated, true)
    const tornDownEvidence = bridge.getEvidence()
    assert.equal(tornDownEvidence.finalReceipt.phase, 'committed-replacement-owner')
    assert.equal(tornDownEvidence.currentReceipt, null)
    assert.equal(tornDownEvidence.priorCommittedReceiptInvalidated, true)
    assert.equal(tornDownEvidence.invalidatedCommittedEvidenceSequence, tornDownEvidence.finalReceipt.evidenceSequence)
    await teardown
    assert.equal(value.renderer.root.parent, null)
    assert.equal(value.renderer.root.children.every((child) => child.children.length === 0), true)
  }

  // The former false-positive fixture is now rejected before scene mutation:
  // authentic logical publication through FakeAtomicRenderer cannot certify an
  // unrelated Group as the physical exact catalog.
  {
    const generation = generationSequence++
    const scene = sceneFixture()
    const resolution = resolveRoots(scene.layer)
    const fakeRenderer = new FakeAtomicRenderer()
    const adapter = new Adapter({
      generation,
      domainId: `real-scene-bridge-fake-port-${generation}`,
      manifest: MANIFEST,
      renderer: fakeRenderer,
      monolithicFallback: new FakeFallback(),
    })
    const update = await adapter.updateFocus({
      generation,
      focus: { space: 'owner-local', point: focusPoint() },
    })
    assert.equal(update.kind, 'committed')
    const catalogStage = new Group()
    catalogStage.visible = false
    const unrelatedRoot = new Group()
    catalogStage.add(unrelatedRoot)
    const beforeChildren = [...scene.activeScene.children]
    assert.throws(
      () => new Bridge({
        generation,
        resolution,
        adapter,
        rendererPort: { root: unrelatedRoot },
        catalogStage,
      }),
      (error) => error instanceof BridgeError && error.code === 'INVALID_CONFIGURATION',
    )
    assert.deepEqual(scene.activeScene.children, beforeChildren)
    assert.equal(catalogStage.parent, null)
    assert.equal(scene.roots.every((root) => root.visible), true)
    assert.equal(scene.roots.every((root) => Object.keys(root.userData).length === 0), true)
    await adapter.dispose()
  }

  // Even two genuine objects are rejected when the adapter was constructed
  // with a different exact Three renderer port.
  {
    const value = await context()
    const otherStage = new Group()
    otherStage.visible = false
    const otherPort = createIssuedPort(value.generation, otherStage)
    const beforeChildren = [...value.scene.activeScene.children]
    assert.throws(
      () => new Bridge({
        generation: value.generation,
        resolution: value.resolution,
        adapter: value.adapter,
        rendererPort: otherPort,
        catalogStage: otherStage,
      }),
      (error) => error instanceof BridgeError && error.code === 'INVALID_CONFIGURATION',
    )
    assert.deepEqual(value.scene.activeScene.children, beforeChildren)
    assert.equal(otherStage.parent, null)
    assert.equal(value.scene.roots.every((root) => root.visible), true)
    assert.equal(value.scene.roots.every((root) => Object.keys(root.userData).length === 0), true)
    otherPort.root.removeFromParent()
    await value.adapter.dispose()
  }

  // Zero/partial original ownership and a mounted visible replacement are
  // rejected before a guard is issued, so no zero- or dual-owner sample exists.
  {
    const zero = await context()
    zero.scene.roots[0].visible = false
    assert.throws(
      () => bridgeFor(zero),
      (error) => error instanceof BridgeError && error.code === 'INVALID_PHYSICAL_OWNERSHIP',
    )
    zero.scene.roots[0].visible = true
    await zero.adapter.dispose()

    const dual = await context()
    dual.catalogStage.visible = true
    dual.scene.activeScene.add(dual.catalogStage)
    assert.throws(
      () => bridgeFor(dual),
      (error) => error instanceof BridgeError && error.code === 'INVALID_PHYSICAL_OWNERSHIP',
    )
    dual.catalogStage.removeFromParent()
    dual.catalogStage.visible = false
    await dual.adapter.dispose()
  }

  // Structural clones cannot cross the issuance boundary.
  {
    const value = await context()
    assert.throws(
      () => bridgeFor(value, { ...value.resolution }),
      (error) => error instanceof BridgeError && error.code === 'RESOLUTION_REJECTED',
    )
    await value.adapter.dispose()
  }

  // Resolution is revalidated after all logical staging but before any scene
  // mutation. Staleness drains the exact reverse transaction and leaves the
  // original physical owner untouched.
  {
    const value = await context()
    const bridge = bridgeFor(value)
    value.scene.roots[0].count = 77
    assert.throws(
      () => bridge.commit(),
      (error) => error instanceof BridgeError && error.code === 'RESOLUTION_REJECTED',
    )
    assertExactRootOrdinals(value)
    assert.equal(value.scene.roots.every((root) => root.visible), true)
    assert.equal(value.catalogStage.parent, null)
    assert.equal(value.catalogStage.visible, false)
    assert.equal(bridge.getSnapshot().state, 'failed-closed-original-owner')
    assert.equal(bridge.getSnapshot().handoff.state, 'idle')
    assert.equal(bridge.getEvidence().receipts.at(-1).phase, 'rolled-back-original-owner')
    value.scene.roots[0].count = 78
    await bridge.teardown()
  }

  // An exception in the middle of the synchronous physical switch restores
  // visibility, tags, catalog detachment, and exact parent ordinals without
  // disposing any original geometry.
  {
    const value = await context()
    const bridge = bridgeFor(value)
    const target = value.scene.roots[2]
    const originalDescriptor = Object.getOwnPropertyDescriptor(target, 'visible')
    let visible = true
    Object.defineProperty(target, 'visible', {
      configurable: true,
      enumerable: true,
      get: () => visible,
      set: (next) => {
        if (next === false) throw new Error('simulated physical visibility failure')
        visible = next
      },
    })
    const geometries = value.scene.roots.map((root) => root.geometry)
    assert.throws(
      () => bridge.commit(),
      (error) => error instanceof BridgeError && error.code === 'HANDOFF_FAILED',
    )
    assertExactRootOrdinals(value)
    assert.equal(value.scene.roots.every((root) => root.visible), true)
    assert.deepEqual(value.scene.roots.map((root) => root.geometry), geometries)
    assert.equal(value.catalogStage.parent, null)
    assert.equal(value.catalogStage.visible, false)
    assert.equal(value.scene.roots.every((root) =>
      !Object.prototype.hasOwnProperty.call(root.userData, 'repeatSixPartSourceOwnership')), true)
    assert.equal(bridge.getSnapshot().handoff.state, 'idle')
    Object.defineProperty(target, 'visible', originalDescriptor)
    await bridge.teardown()
  }

  // Emergency reverse ownership invalidates the historical committed receipt.
  // A hostile Three `removed` listener is cleanup-only because original-only
  // visibility is established before the stage is detached.
  {
    const value = await context()
    const bridge = bridgeFor(value)
    bridge.commit()
    const throwOnRemoved = () => { throw new Error('simulated removed-listener failure') }
    value.catalogStage.addEventListener('removed', throwOnRemoved)
    const restored = bridge.failClosedToOriginals('operator emergency fail-close')
    assert.equal(restored.state, 'failed-closed-original-owner')
    assert.equal(restored.currentPhysicalOwner, 'original-production-roots')
    assert.equal(restored.ownershipEvidenceStatus, 'invalidated-by-emergency-physical-fail-close')
    assert.equal(restored.priorCommittedReceiptInvalidated, true)
    assert.match(restored.lastFailure, /cleanup:/)
    assertExactRootOrdinals(value)
    assert.equal(value.scene.roots.every((root) => root.visible), true)
    assert.equal(value.catalogStage.visible, false)
    assert.equal(value.catalogStage.parent, null)
    const evidence = bridge.getEvidence()
    assert.equal(evidence.finalReceipt.phase, 'committed-replacement-owner')
    assert.equal(evidence.currentReceipt, null)
    assert.equal(evidence.currentPhysicalOwner, 'original-production-roots')
    assert.equal(evidence.priorCommittedReceiptInvalidated, true)
    value.catalogStage.removeEventListener('removed', throwOnRemoved)
    await bridge.teardown()
  }

  // If a committed reverse switch cannot make one exact root visible, the
  // bridge compensates synchronously to the still-valid replacement owner.
  // The committed observer receipt therefore remains current.
  {
    const value = await context()
    const bridge = bridgeFor(value)
    bridge.commit()
    const target = value.scene.roots[2]
    const originalDescriptor = Object.getOwnPropertyDescriptor(target, 'visible')
    let visible = false
    Object.defineProperty(target, 'visible', {
      configurable: true,
      enumerable: true,
      get: () => visible,
      set: (next) => {
        if (next === true) throw new Error('simulated original-restore visibility failure')
        visible = next
      },
    })
    assert.throws(
      () => bridge.failClosedToOriginals('must compensate'),
      (error) => error instanceof BridgeError && error.code === 'RESTORATION_FAILED',
    )
    const compensated = bridge.getSnapshot()
    assert.equal(compensated.state, 'committed-replacement-owner')
    assert.equal(compensated.currentPhysicalOwner, 'replacement-persistent-catalog')
    assert.equal(compensated.catalogVisible, true)
    assert.equal(compensated.retainedRootRendererVisibleCount, 0)
    assert.equal(compensated.ownershipEvidenceStatus, 'observer-receipt-current')
    assert.equal(compensated.priorCommittedReceiptInvalidated, false)
    assert.equal(bridge.getEvidence().currentReceipt.phase, 'committed-replacement-owner')
    Object.defineProperty(target, 'visible', originalDescriptor)
    await bridge.teardown()
  }

  // Strict root validation precedes every emergency visibility mutation. A
  // stale root cannot cause the valid replacement to be hidden.
  {
    const value = await context()
    const bridge = bridgeFor(value)
    bridge.commit()
    value.scene.roots[0].count = 77
    assert.throws(
      () => bridge.failClosedToOriginals('stale fallback must not mutate'),
      (error) => error instanceof BridgeError && error.code === 'RESTORATION_FAILED',
    )
    assert.equal(bridge.getSnapshot().state, 'committed-replacement-owner')
    assert.equal(bridge.getSnapshot().currentPhysicalOwner, 'replacement-persistent-catalog')
    assert.equal(value.scene.roots.every((root) => root.visible === false), true)
    assert.equal(value.catalogStage.visible, true)
    value.scene.roots[0].count = 78
    await bridge.teardown()
  }

  // A post-commit adapter fail-stop enters the bridge through the Three port's
  // one synchronous boundary. The port may hide its root only after all four
  // originals are visible, eliminating the former hide/await/fallback gap.
  {
    const value = await context()
    const bridge = bridgeFor(value)
    bridge.commit()
    const originalDescriptor = Object.getOwnPropertyDescriptor(value.renderer.root, 'visible')
    let visible = value.renderer.root.visible
    let catalogHideChecks = 0
    Object.defineProperty(value.renderer.root, 'visible', {
      configurable: true,
      enumerable: true,
      get: () => visible,
      set: (next) => {
        if (next === false) {
          catalogHideChecks += 1
          assert.equal(value.scene.roots.every((root) => root.visible), true)
        }
        visible = next
      },
    })
    value.renderer.failNextPublication(new Error('simulated post-commit publication failure'))
    await assert.rejects(
      value.adapter.updateFocus({
        generation: value.generation,
        focus: { space: 'owner-local', point: [1_000_000, 1_000_000, 1_000_000] },
      }),
      (error) => error?.code === 'RENDERER_PUBLICATION_FAILED',
    )
    assert.equal(catalogHideChecks, 1)
    assert.equal(value.adapter.getSnapshot().state, 'fail-stopped')
    assert.equal(bridge.getSnapshot().state, 'failed-closed-original-owner')
    assert.equal(bridge.getSnapshot().currentPhysicalOwner, 'original-production-roots')
    assert.equal(bridge.getSnapshot().priorCommittedReceiptInvalidated, true)
    assert.equal(bridge.getEvidence().currentReceipt, null)
    assert.equal(value.scene.roots.every((root) => root.visible), true)
    assert.equal(value.catalogStage.parent, null)
    Object.defineProperty(value.renderer.root, 'visible', originalDescriptor)
    await bridge.teardown()
  }

  console.log('Development repeat-six-part real-scene ownership bridge: PASS')
  console.log(JSON.stringify({
    stagedOperations: 5,
    successEvidenceReceipts: 7,
    retainedProductionRoots: 4,
    exactOrdinals: [258, 259, 260, 261],
    zeroDualSamplingPrevented: true,
    forgedAndStaleResolutionRejected: true,
    forgedAndMismatchedRendererBindingsRejected: true,
    synchronousFailureRestoration: true,
    transactionalEmergencyRestoration: true,
    replacementOnlyCompensation: true,
    removalListenerCannotCreateZeroOwner: true,
    postCommitFailStopAtomicBoundary: true,
    committedEvidenceInvalidation: true,
    beforeUnloadRestoration: true,
    activationAuthorized: false,
  }, null, 2))
  for (const resource of ownedResources) resource.dispose()
} finally {
  await vite.close()
}
