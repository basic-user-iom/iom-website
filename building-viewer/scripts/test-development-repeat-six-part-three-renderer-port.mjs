import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  MeshBasicMaterial,
} from 'three'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')
const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
const MIRROR_X = Object.freeze([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])

function listKey(parity, segmentIndex, materialIndex) {
  return `${parity}:segment-${String(segmentIndex).padStart(2, '0')}:material-${String(materialIndex).padStart(2, '0')}`
}

function matrixFor(index) {
  const matrix = [...IDENTITY]
  matrix[12] = index * 0.25
  matrix[13] = index * 0.05
  matrix[14] = -index * 0.1
  return Object.freeze(matrix)
}

function makeTemplates() {
  const templates = []
  const resources = []
  for (let segmentIndex = 0; segmentIndex < 6; segmentIndex += 1) {
    for (let materialIndex = 0; materialIndex < 4; materialIndex += 1) {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute([
        0, 0, 0,
        1 + segmentIndex * 0.01, 0, 0,
        0, 1 + materialIndex * 0.01, 0,
      ], 3))
      geometry.setIndex([0, 1, 2])
      const material = new MeshBasicMaterial({ color: 0xffffff })
      templates.push({ segmentIndex, materialIndex, geometry, material })
      resources.push(geometry, material)
    }
  }
  return { templates, resources }
}

function makeDescriptors(port) {
  const descriptors = []
  const lists = []
  for (const parity of ['positive', 'mirrored']) {
    for (let segmentIndex = 0; segmentIndex < 6; segmentIndex += 1) {
      for (let materialIndex = 0; materialIndex < 4; materialIndex += 1) {
        const descriptor = {
          key: listKey(parity, segmentIndex, materialIndex),
          parity,
          segmentIndex,
          segmentId: `segment-${String(segmentIndex).padStart(2, '0')}`,
          materialIndex,
          capacity: parity === 'positive' ? 40 : 38,
          trianglesPerInstance: 10_000 + segmentIndex,
        }
        descriptors.push(descriptor)
        lists.push(port.createPersistentList(descriptor))
      }
    }
  }
  return { descriptors, lists }
}

function makeListState(descriptor, list, listIndex, active, matrixOverride = null) {
  const matrix = matrixOverride ?? matrixFor(listIndex)
  return Object.freeze({
    descriptor,
    persistentList: list,
    activeCount: active ? 1 : 0,
    visible: active,
    compactedMatrices: active ? Object.freeze([matrix]) : Object.freeze([]),
    activeSlotToUnit: active ? Object.freeze([{
      slot: 0,
      unitKey: `source-${listIndex}:segment-${descriptor.segmentIndex}`,
      unitIndex: listIndex,
      sourceIndex: listIndex,
      sourceId: `source-${listIndex}`,
      activity: 'active',
    }]) : Object.freeze([]),
    ownerLocalBounds: active ? Object.freeze({
      space: 'owner-local',
      min: Object.freeze([listIndex, 0, -1]),
      max: Object.freeze([listIndex + 2, 3, 1]),
    }) : null,
    renderLocalBounds: active ? Object.freeze({
      space: 'parity-host-local',
      min: Object.freeze([listIndex, 0, -1]),
      max: Object.freeze([listIndex + 2, 3, 1]),
    }) : null,
    instanceMatrixUpdateRequired: true,
    boundsRecomputeRequired: true,
  })
}

function publication({ descriptors, lists, base, revision, direction = 'publish', active = (index) => index % 5 === 0 }) {
  return Object.freeze({
    kind: 'development-repeat-six-part-persistent-exact-catalog',
    direction,
    operationId: revision,
    generation: 77_001,
    plannerBaseRevision: Math.max(revision - 1, 0),
    plannerRevision: revision,
    rendererBaseRevision: base,
    rendererRevision: revision,
    selectionInputUnits: 468,
    boundsRefreshPolicy: 'all-48-lists-every-publication',
    lists: Object.freeze(descriptors.map((descriptor, index) => makeListState(descriptor, lists[index], index, active(index)))),
  })
}

function replaceListState(value, index, patch) {
  const lists = [...value.lists]
  lists[index] = Object.freeze({ ...lists[index], ...patch })
  return Object.freeze({ ...value, lists: Object.freeze(lists) })
}

function capturePortState(port, descriptors) {
  return {
    revision: port.getRevision(),
    rootVisible: port.root.visible,
    lists: descriptors.map((descriptor) => {
      const mesh = port.getListMesh(descriptor.key)
      return {
        snapshot: port.getListSnapshot(descriptor.key),
        sourceIds: [...mesh.userData.sourceIds],
        matrixArray: Array.from(mesh.instanceMatrix.array),
        boundingBox: mesh.boundingBox ? {
          min: mesh.boundingBox.min.toArray(),
          max: mesh.boundingBox.max.toArray(),
        } : null,
        boundingSphere: mesh.boundingSphere ? {
          center: mesh.boundingSphere.center.toArray(),
          radius: mesh.boundingSphere.radius,
        } : null,
      }
    }),
  }
}

const vite = await createServer({
  root: PROJECT_DIR,
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
})

try {
  const module = await vite.ssrLoadModule('/src/scene/development/DevelopmentRepeatSixPartThreeRendererPort.ts')
  const {
    DevelopmentRepeatSixPartThreeRendererPort,
    DevelopmentRepeatSixPartThreeMonolithicFallbackVisibility,
  } = module
  const parent = new Group()
  const reference = new Group()
  parent.add(reference)
  const { templates, resources } = makeTemplates()
  const port = new DevelopmentRepeatSixPartThreeRendererPort({
    generation: 77_001,
    parent,
    parityHostMatrices: { positive: IDENTITY, mirrored: MIRROR_X },
    templates,
  })
  const { descriptors, lists } = makeDescriptors(port)

  assert.equal(parent.children.includes(port.root), true)
  assert.equal(port.root.children.length, 2)
  assert.equal(port.root.userData.developmentOnly, true)
  assert.equal(port.root.userData.productionOwnershipIntegrated, false)
  assert.deepEqual(port.parityRoots.positive.matrix.toArray(), IDENTITY)
  assert.deepEqual(port.parityRoots.mirrored.matrix.toArray(), MIRROR_X)
  assert.equal(lists.length, 48)
  assert.equal(new Set(lists).size, 48)
  assert.equal(new Set(lists.map((list) => list.mesh)).size, 48)
  assert.equal(port.parityRoots.positive.children.length, 24)
  assert.equal(port.parityRoots.mirrored.children.length, 24)
  const meshDisposeEvents = new Map(lists.map((list) => [list.key, 0]))
  for (const list of lists) {
    list.mesh.addEventListener('dispose', () => {
      meshDisposeEvents.set(list.key, (meshDisposeEvents.get(list.key) ?? 0) + 1)
    })
  }
  let sharedGeometryDisposeEvents = 0
  let sharedMaterialDisposeEvents = 0
  for (const template of templates) {
    template.geometry.addEventListener('dispose', () => { sharedGeometryDisposeEvents += 1 })
    template.material.addEventListener('dispose', () => { sharedMaterialDisposeEvents += 1 })
  }
  for (let index = 0; index < lists.length; index += 1) {
    const list = lists[index]
    const descriptor = descriptors[index]
    const template = templates.find((entry) =>
      entry.segmentIndex === descriptor.segmentIndex && entry.materialIndex === descriptor.materialIndex)
    assert.ok(template)
    assert.equal(list.key, descriptor.key)
    assert.equal(list.initialState, 'hidden-zero-count-bounds-cleared')
    assert.equal(list.mesh.geometry, template.geometry)
    assert.equal(list.mesh.material, template.material)
    assert.equal(list.mesh.instanceMatrix.usage, 35048)
    assert.equal(list.mesh.frustumCulled, true)
    assert.equal(list.mesh.matrixAutoUpdate, false)
    assert.equal(list.mesh.count, 0)
    assert.equal(list.mesh.visible, false)
    assert.equal(list.mesh.userData.developmentOnly, true)
    assert.equal(list.mesh.userData.repeatSixPartListKey, descriptor.key)
    assert.equal(list.mesh.userData.proceduralInstanced, true)
    assert.equal(list.mesh.userData.externallyManagedVisibility, 'repeat-six-part-catalog')
    assert.equal(list.mesh.userData.detailLodIgnore, true)
    assert.equal(list.mesh.userData.instanceIdentityGroup, `repeat-six-part:${descriptor.parity}`)
    assert.deepEqual(list.mesh.userData.sourceIds, [])
    assert.equal(Object.isFrozen(list.mesh.userData.sourceIds), true)
  }
  const descriptorSegmentId = descriptors[0].segmentId
  descriptors[0].segmentId = 'caller-mutated-segment'
  assert.equal(lists[0].descriptor.segmentId, descriptorSegmentId, 'persistent descriptor aliases caller memory')
  assert.equal(Object.isFrozen(lists[0].descriptor), true)
  descriptors[0].segmentId = descriptorSegmentId
  assert.throws(() => port.createPersistentList(descriptors[0]), /already exists/)
  assert.throws(() => port.createPersistentList({ ...descriptors[0], key: '49th-list' }), /cannot exceed 48 lists/)
  assert.throws(() => port.getListSnapshot('unknown-list'), /Unknown persistent list/)
  assert.throws(() => port.getListMesh('unknown-list'), /Unknown persistent list/)

  const first = publication({ descriptors, lists, base: 0, revision: 1 })
  const receipt = port.publishAtomicExactCatalog(first)
  assert.equal(receipt.rendererBaseRevision, 0)
  assert.equal(receipt.rendererRevision, 1)
  assert.equal(receipt.atomicMatrixSlotMapsPublished, true)
  assert.equal(receipt.boundsRefreshPolicyHonored, true)
  assert.deepEqual(receipt.publishedListKeys, descriptors.map((entry) => entry.key))
  assert.deepEqual(receipt.boundsRefreshedListKeys, descriptors.map((entry) => entry.key))
  assert.equal(port.getRevision(), 1)

  const callerOwnedMapping = first.lists[0].activeSlotToUnit[0]
  const publishedSourceId = port.getListSnapshot(descriptors[0].key).slotToUnit[0].sourceId
  callerOwnedMapping.sourceId = 'caller-mutated-source'
  const isolatedSnapshot = port.getListSnapshot(descriptors[0].key)
  assert.equal(isolatedSnapshot.slotToUnit[0].sourceId, publishedSourceId, 'published slot map aliases caller memory')
  assert.equal(Object.isFrozen(isolatedSnapshot.slotToUnit[0]), true)

  for (let index = 0; index < lists.length; index += 1) {
    const expectedActive = index % 5 === 0
    const snapshot = port.getListSnapshot(descriptors[index].key)
    assert.equal(snapshot.activeCount, expectedActive ? 1 : 0)
    assert.equal(snapshot.visible, expectedActive)
    assert.equal(snapshot.slotToUnit.length, expectedActive ? 1 : 0)
    assert.equal(snapshot.matrixAttributeVersion, 1, `list ${index} matrix attribute was not refreshed`)
    const mesh = port.getListMesh(descriptors[index].key)
    assert.deepEqual(mesh.userData.sourceIds, expectedActive ? [`source-${index}`] : [])
    assert.equal(Object.isFrozen(mesh.userData.sourceIds), true)
    if (expectedActive) {
      const matrix = new Matrix4()
      mesh.getMatrixAt(0, matrix)
      assert.deepEqual(matrix.toArray(), matrixFor(index))
      assert.equal(mesh.boundingBox?.isEmpty(), false)
      assert.ok((mesh.boundingSphere?.radius ?? 0) > 0)
    } else {
      assert.equal(mesh.boundingBox?.isEmpty(), true)
      assert.equal(mesh.boundingSphere?.radius, 0)
    }
  }

  // Exhaust the renderer boundary with failures at both catalog and late-list
  // staging. Every rejection must leave revisions, matrices, slot maps,
  // visibility and conservative bounds byte-for-byte unchanged.
  const validSecond = publication({ descriptors, lists, base: 1, revision: 2, active: () => true })
  const invalidCandidates = [
    ['kind', Object.freeze({ ...validSecond, kind: 'wrong-kind' }), /metadata is stale or invalid/],
    ['generation', Object.freeze({ ...validSecond, generation: 77_002 }), /metadata is stale or invalid/],
    ['selection count', Object.freeze({ ...validSecond, selectionInputUnits: 467 }), /metadata is stale or invalid/],
    ['bounds policy', Object.freeze({ ...validSecond, boundsRefreshPolicy: 'active-only' }), /metadata is stale or invalid/],
    ['stale base revision', Object.freeze({ ...validSecond, rendererBaseRevision: 0 }), /metadata is stale or invalid/],
    ['skipped revision', Object.freeze({ ...validSecond, rendererRevision: 3 }), /metadata is stale or invalid/],
    ['direction', Object.freeze({ ...validSecond, direction: 'replace' }), /metadata is stale or invalid/],
    ['47-list catalog', Object.freeze({ ...validSecond, lists: Object.freeze(validSecond.lists.slice(0, 47)) }), /replace all 48/],
    ['reordered list', Object.freeze({
      ...validSecond,
      lists: Object.freeze([...validSecond.lists.slice(0, 46), validSecond.lists[47], validSecond.lists[46]]),
    }), /Publication list 46/],
    ['foreign persistent list', replaceListState(validSecond, 47, { persistentList: lists[46] }), /Publication list 47/],
    ['descriptor drift', replaceListState(validSecond, 47, {
      descriptor: Object.freeze({ ...descriptors[47], trianglesPerInstance: descriptors[47].trianglesPerInstance + 1 }),
    }), /Publication list 47/],
    ['matrix refresh omitted', replaceListState(validSecond, 47, { instanceMatrixUpdateRequired: false }), /Invalid compacted state/],
    ['bounds refresh omitted', replaceListState(validSecond, 47, { boundsRecomputeRequired: false }), /Invalid compacted state/],
    ['fractional active count', replaceListState(validSecond, 47, { activeCount: 0.5 }), /Invalid compacted state/],
    ['over-capacity count', replaceListState(validSecond, 47, { activeCount: descriptors[47].capacity + 1 }), /Invalid compacted state/],
    ['matrix count mismatch', replaceListState(validSecond, 47, { compactedMatrices: Object.freeze([]) }), /Invalid compacted state/],
    ['slot count mismatch', replaceListState(validSecond, 47, { activeSlotToUnit: Object.freeze([]) }), /Invalid compacted state/],
    ['visibility mismatch', replaceListState(validSecond, 47, { visible: false }), /Invalid compacted state/],
    ['missing active owner bounds', replaceListState(validSecond, 47, { ownerLocalBounds: null }), /Invalid compacted state/],
    ['wrong owner bounds space', replaceListState(validSecond, 47, {
      ownerLocalBounds: Object.freeze({ ...validSecond.lists[47].ownerLocalBounds, space: 'parity-host-local' }),
    }), /wrong coordinate space/],
    ['wrong render bounds space', replaceListState(validSecond, 47, {
      renderLocalBounds: Object.freeze({ ...validSecond.lists[47].renderLocalBounds, space: 'owner-local' }),
    }), /wrong coordinate space/],
    ['inverted render bounds', replaceListState(validSecond, 47, {
      renderLocalBounds: Object.freeze({ space: 'parity-host-local', min: [2, 0, 0], max: [1, 1, 1] }),
    }), /not a finite closed AABB/],
    ['short matrix', replaceListState(validSecond, 47, { compactedMatrices: Object.freeze([[...matrixFor(47).slice(0, 15)]]) }), /finite 4x4/],
    ['non-finite matrix', replaceListState(validSecond, 47, {
      compactedMatrices: Object.freeze([[...matrixFor(47).slice(0, 15), Number.NaN]]),
    }), /finite 4x4/],
    ['wrong slot number', replaceListState(validSecond, 47, {
      activeSlotToUnit: Object.freeze([Object.freeze({ ...validSecond.lists[47].activeSlotToUnit[0], slot: 1 })]),
    }), /Invalid active slot map/],
    ['culled active slot', replaceListState(validSecond, 47, {
      activeSlotToUnit: Object.freeze([Object.freeze({ ...validSecond.lists[47].activeSlotToUnit[0], activity: 'culled' })]),
    }), /Invalid active slot map/],
    ['fractional unit index', replaceListState(validSecond, 47, {
      activeSlotToUnit: Object.freeze([Object.freeze({ ...validSecond.lists[47].activeSlotToUnit[0], unitIndex: 1.5 })]),
    }), /Invalid active slot map/],
    ['non-string source id', replaceListState(validSecond, 47, {
      activeSlotToUnit: Object.freeze([Object.freeze({ ...validSecond.lists[47].activeSlotToUnit[0], sourceId: 47 })]),
    }), /Invalid active slot map/],
  ]
  for (const [label, candidate, expectedError] of invalidCandidates) {
    const beforeInvalid = capturePortState(port, descriptors)
    assert.throws(() => port.publishAtomicExactCatalog(candidate), expectedError, label)
    assert.deepEqual(capturePortState(port, descriptors), beforeInvalid, `${label} mutated renderer state`)
  }

  // Rollback is another full 48-list atomic replacement and clears every
  // conservative bound instead of retaining stale active-list volumes.
  const rollback = publication({
    descriptors,
    lists,
    base: 1,
    revision: 2,
    direction: 'rollback',
    active: () => false,
  })
  const rollbackReceipt = port.rollbackAtomicExactCatalog({ publication: rollback, appliedReceipt: receipt })
  assert.equal(rollbackReceipt.direction, 'rollback')
  assert.equal(port.getRevision(), 2)
  for (const descriptor of descriptors) {
    const snapshot = port.getListSnapshot(descriptor.key)
    assert.equal(snapshot.activeCount, 0)
    assert.equal(snapshot.visible, false)
    assert.equal(snapshot.matrixAttributeVersion, 2)
    const mesh = port.getListMesh(descriptor.key)
    assert.deepEqual(mesh.userData.sourceIds, [])
    assert.equal(Object.isFrozen(mesh.userData.sourceIds), true)
    assert.equal(mesh.boundingBox?.isEmpty(), true)
    assert.deepEqual(Array.from(mesh.instanceMatrix.array), new Array(mesh.instanceMatrix.array.length).fill(0))
  }

  // Fault injection throws before mutation. Retrying the same revision after
  // the one-shot fault proves the publication itself remains valid.
  const third = publication({ descriptors, lists, base: 2, revision: 3, active: (index) => index === 7 })
  port.failNextPublication(new Error('direct-module fault'))
  assert.throws(() => port.publishAtomicExactCatalog(third), /direct-module fault/)
  assert.equal(port.getRevision(), 2)
  port.publishAtomicExactCatalog(third)
  assert.equal(port.getRevision(), 3)
  assert.equal(port.getListSnapshot(descriptors[7].key).activeCount, 1)
  assert.deepEqual(port.getListMesh(descriptors[7].key).userData.sourceIds, ['source-7'])

  let fallbackActivations = 0
  const fallback = new DevelopmentRepeatSixPartThreeMonolithicFallbackVisibility({
    exactCatalogRoot: port.root,
    localNonInstancedReferenceRoot: reference,
    onActivated: () => { fallbackActivations += 1 },
  })
  assert.equal(reference.visible, false)
  assert.equal(fallback.setLocalReferencePreview(true), true)
  assert.equal(reference.visible, true)
  assert.equal(port.root.visible, false)
  assert.equal(fallback.setLocalReferencePreview(false), true)
  assert.equal(reference.visible, false)
  assert.equal(port.root.visible, true)
  const reason = Object.freeze({
    code: 'RENDERER_PUBLICATION_FAILED',
    generation: 77_001,
    plannerRevision: 3,
    rendererRevision: 3,
    exactCatalogHidden: true,
  })
  let atomicFailStopBoundaryCalls = 0
  const releaseAtomicFailStopBoundary = port.bindAtomicFailStopBoundary(() => {
    atomicFailStopBoundaryCalls += 1
    assert.equal(port.root.visible, true, 'port hid the catalog before its atomic fail-stop boundary')
  })
  assert.throws(() => port.bindAtomicFailStopBoundary(() => undefined), /already bound/)
  port.hidePersistentExactCatalog(reason)
  assert.equal(atomicFailStopBoundaryCalls, 1)
  releaseAtomicFailStopBoundary()
  releaseAtomicFailStopBoundary()
  fallback.activateMonolithicFallback(reason)
  assert.equal(reference.visible, true)
  assert.equal(port.root.visible, false)
  assert.equal(fallback.isActivated(), true)
  assert.equal(fallback.getActivatedReason(), reason)
  assert.equal(fallbackActivations, 1)
  assert.equal(fallback.setLocalReferencePreview(false), false)
  assert.equal(port.setLocalPreviewVisible(true), false)

  const disposed = lists[47]
  const disposedMesh = disposed.mesh
  port.disposePersistentList(disposed)
  assert.equal(disposedMesh.parent, null)
  assert.equal(disposedMesh.count, 0)
  assert.equal(disposedMesh.visible, false)
  assert.deepEqual(Array.from(disposedMesh.instanceMatrix.array), new Array(disposedMesh.instanceMatrix.array.length).fill(0))
  assert.equal(disposedMesh.boundingBox?.isEmpty(), true)
  assert.equal(disposedMesh.boundingSphere?.radius, 0)
  assert.deepEqual(disposedMesh.userData.activeSlotToUnit, [])
  assert.deepEqual(disposedMesh.userData.sourceIds, [])
  assert.equal(Object.isFrozen(disposedMesh.userData.sourceIds), true)
  assert.equal(disposedMesh.userData.ownerLocalBounds, null)
  assert.equal(disposedMesh.userData.renderLocalBounds, null)
  assert.equal(meshDisposeEvents.get(disposed.key), 1)
  assert.equal(sharedGeometryDisposeEvents, 0)
  assert.equal(sharedMaterialDisposeEvents, 0)
  assert.throws(() => port.disposePersistentList(disposed), /Unknown persistent list/)
  for (const list of [...lists.slice(0, 47)].reverse()) port.disposePersistentList(list)
  assert.equal([...meshDisposeEvents.values()].every((count) => count === 1), true)
  assert.equal(sharedGeometryDisposeEvents, 0)
  assert.equal(sharedMaterialDisposeEvents, 0)
  assert.equal(parent.children.includes(port.root), false)
  assert.throws(() => port.createPersistentList(descriptors[0]), /port is disposed/)
  assert.throws(() => port.publishAtomicExactCatalog(third), /port is disposed/)
  for (const resource of resources) resource.dispose()

  console.log('Development repeat-six-part Three.js renderer port tests: PASS')
  console.log(JSON.stringify({
    persistentLists: 48,
    templates: 24,
    verified: [
      'parity-host-matrices',
      'synchronous-atomic-matrix-slot-map-publication',
      'all-48-conservative-bounds-refresh',
      '28-case-pre-apply-rejection-matrix',
      'rejection-state-immutability',
      'descriptor-and-slot-map-alias-isolation',
      'external-visibility-and-instance-identity-metadata',
      'published-and-cleared-source-id-metadata',
      'full-catalog-rollback',
      'inactive-matrix-buffer-zeroing',
      'one-shot-fault-before-mutation',
      'pre-hide-atomic-fail-stop-boundary',
      'irreversible-fail-stop-reference-visibility',
      'duplicate-capacity-unknown-handle-guards',
      'exactly-once-instanced-mesh-disposal-with-shared-template-retention',
      'terminal-resource-detachment-and-state-clearing',
    ],
  }, null, 2))
} finally {
  await vite.close()
}
