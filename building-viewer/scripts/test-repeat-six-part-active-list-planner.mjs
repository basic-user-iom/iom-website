import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const MIRROR_X = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const SEGMENT_TRIANGLES = [10_537, 10_558, 10_596, 10_535, 10_353, 8_690]
const externalRevisions = new WeakMap()

function multiplyMatrices(left, right) {
  const output = new Array(16).fill(0)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let inner = 0; inner < 4; inner += 1) {
        output[column * 4 + row] += left[inner * 4 + row] * right[column * 4 + inner]
      }
    }
  }
  return output
}

function determinant3(matrix) {
  return (
    matrix[0] * (matrix[5] * matrix[10] - matrix[9] * matrix[6]) -
    matrix[4] * (matrix[1] * matrix[10] - matrix[9] * matrix[2]) +
    matrix[8] * (matrix[1] * matrix[6] - matrix[5] * matrix[2])
  )
}

function transformBounds(bounds, matrix, space = 'owner-local') {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const point = [
          matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
          matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
          matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
        ]
        for (let axis = 0; axis < 3; axis += 1) {
          min[axis] = Math.min(min[axis], point[axis])
          max[axis] = Math.max(max[axis], point[axis])
        }
      }
    }
  }
  return { space, min, max }
}

function unionBounds(bounds, space = 'owner-local') {
  return {
    space,
    min: [0, 1, 2].map((axis) => Math.min(...bounds.map((entry) => entry.min[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...bounds.map((entry) => entry.max[axis]))),
  }
}

function translatedIdentity(x, y = 0, z = 0) {
  const matrix = [...IDENTITY]
  matrix[12] = x
  matrix[13] = y
  matrix[14] = z
  return matrix
}

function sourceTranslation(sourceIndex) {
  if (sourceIndex === 0) return 0
  if (sourceIndex === 1) return 6
  return sourceIndex * 200
}

function makeFixture({
  repeatBudget = 1_500_000,
  repeatTransitionBudget = 1_500_000,
  totalBudget = 2_000_000,
  totalTransitionBudget = 2_000_000,
  drawBudget = 48,
} = {}) {
  const segments = SEGMENT_TRIANGLES.map((triangles, index) => ({
    index,
    id: `segment-${String(index).padStart(2, '0')}`,
    triangles,
    materialPrimitiveCount: 4,
    // Twenty-metre gaps make it possible to prove the planner does not use a
    // broad full-row union bound in place of one unit's canonical bound.
    bounds: {
      space: 'source-row-local',
      min: [index * 20, 0, 0],
      max: [index * 20 + 1, 1, 1],
    },
  }))
  const sources = []
  const units = []
  for (let sourceIndex = 0; sourceIndex < 78; sourceIndex += 1) {
    const parity = sourceIndex < 40 ? 'positive' : 'mirrored'
    const renderLocal = translatedIdentity(sourceTranslation(sourceIndex))
    const host = parity === 'positive' ? IDENTITY : MIRROR_X
    const canonical = multiplyMatrices(host, renderLocal)
    const sourceUnits = segments.map((segment, segmentIndex) => {
      const index = sourceIndex * 6 + segmentIndex
      const unit = {
        index,
        id: `source-${String(sourceIndex).padStart(2, '0')}:segment-${String(segmentIndex).padStart(2, '0')}`,
        sourceIndex,
        sourceId: `source-${String(sourceIndex).padStart(2, '0')}`,
        segmentIndex,
        segmentId: segment.id,
        bounds: transformBounds(segment.bounds, canonical),
        triangles: segment.triangles,
      }
      units.push(unit)
      return unit
    })
    sources.push({
      index: sourceIndex,
      id: `source-${String(sourceIndex).padStart(2, '0')}`,
      path: `Ground Floor._anim1/Mesh.13786/source-${String(sourceIndex).padStart(2, '0')}`,
      parity,
      canonicalMatrix: { space: 'owner-local', matrix: canonical },
      renderLocalMatrix: { space: 'parity-host-local', matrix: renderLocal },
      bounds: unionBounds(sourceUnits.map((unit) => unit.bounds)),
    })
  }
  return {
    geometry: { materialSlots: 4, segments },
    parity: {
      epsilon: 1e-8,
      hosts: {
        positive: { space: 'owner-local', matrix: [...IDENTITY] },
        mirrored: { space: 'owner-local', matrix: [...MIRROR_X] },
      },
      materialDrawsPerActiveGroup: 4,
      possibleGroupCount: 12,
      persistentRendererTemplates: 48,
    },
    selector: {
      boundsSpace: 'owner-local',
      boundsType: 'closed-aabb',
      distanceMetric: 'linf-point-to-closed-aabb',
      enterMarginMeters: 3.5,
      exitMarginMeters: 5.5,
      states: ['active', 'culled'],
      defaultState: 'culled',
    },
    catalog: {
      order: 'source-major-segment-major',
      defaultState: 'culled',
      sources,
      units,
    },
    budgets: {
      repeatFamilyResidentTriangles: repeatBudget,
      repeatFamilyTransitionTriangles: repeatTransitionBudget,
      totalResidentTriangles: totalBudget,
      totalTransitionTriangles: totalTransitionBudget,
      allOtherOwnerReservationTriangles: 500_000,
      maxActiveDraws: drawBudget,
      maxPersistentRendererTemplates: 48,
    },
  }
}

function externalState(planner) {
  let state = externalRevisions.get(planner)
  if (!state) {
    state = { rendererRevision: 0, registryRevision: 0 }
    externalRevisions.set(planner, state)
  }
  return state
}

function prepare(planner, point, generation = planner.getSnapshot().generation, revision = planner.getSnapshot().revision) {
  const external = externalState(planner)
  return planner.prepareFocusUpdate({
    generation,
    revision,
    rendererRevision: external.rendererRevision,
    registryMutationGuard: { layerGeneration: generation, revision: external.registryRevision },
    focus: { space: 'owner-local', point },
  })
}

function applyReceipt(preparation, participant) {
  const { token } = preparation
  return {
    kind: 'repeat-six-part-participant-apply-receipt',
    token,
    participant,
    layerGeneration: token.layerGeneration,
    rendererBaseRevision: token.rendererBaseRevision,
    rendererAppliedRevision: token.rendererBaseRevision + (participant === 'renderer' ? 1 : 0),
    registryBaseMutationGuard: token.registryBaseMutationGuard,
    registryAppliedMutationGuard: {
      layerGeneration: token.layerGeneration,
      revision: token.registryBaseMutationGuard.revision + (participant === 'registry' ? 1 : 0),
    },
  }
}

function acknowledgeApply(planner, preparation, participant) {
  const result = planner.acknowledgePreparedUpdate(applyReceipt(preparation, participant))
  const external = externalState(planner)
  if (participant === 'renderer') external.rendererRevision += 1
  else external.registryRevision += 1
  return result
}

function rollbackReceipt(preparation, participant) {
  const { token } = preparation
  return {
    kind: 'repeat-six-part-participant-rollback-receipt',
    token,
    participant,
    layerGeneration: token.layerGeneration,
    rendererRestoredRevision: token.rendererBaseRevision + (participant === 'renderer' ? 2 : 0),
    registryRestoredMutationGuard: {
      layerGeneration: token.layerGeneration,
      revision: token.registryBaseMutationGuard.revision + (participant === 'registry' ? 2 : 0),
    },
  }
}

function acknowledgeRollback(planner, preparation, participant) {
  const result = planner.acknowledgePreparedUpdateRollback(rollbackReceipt(preparation, participant))
  const external = externalState(planner)
  if (participant === 'renderer') external.rendererRevision += 1
  else external.registryRevision += 1
  return result
}

function update(planner, point, generation = planner.getSnapshot().generation, revision = planner.getSnapshot().revision) {
  const preparation = prepare(planner, point, generation, revision)
  assert.equal(preparation.kind, 'prepared')
  const renderer = acknowledgeApply(planner, preparation, 'renderer')
  assert.equal(renderer.committed, false)
  const registry = acknowledgeApply(planner, preparation, 'registry')
  assert.equal(registry.committed, true)
  assert.strictEqual(registry.commit, preparation.replacement)
  return registry.commit
}

function makeRegistryCatalog(fixture) {
  return fixture.catalog.sources.map((source) => ({
    sourceId: source.id,
    segments: fixture.geometry.segments.map((segment, segmentIndex) => {
      const unit = fixture.catalog.units[source.index * 6 + segmentIndex]
      return {
        segmentId: segment.id,
        bounds: { min: unit.bounds.min, max: unit.bounds.max },
        expectedHandles: Array.from({ length: 4 }, (_, materialIndex) => ({
          handleId: `material-${String(materialIndex).padStart(2, '0')}`,
          activity: 'culled',
        })),
      }
    }),
  }))
}

function registerPersistentHandles(registry, fixture) {
  const transaction = registry.beginHandleRegistration()
  const handles = new Map()
  for (const source of fixture.catalog.sources) {
    const paritySlot = source.parity === 'positive' ? source.index : source.index - 40
    for (const segment of fixture.geometry.segments) {
      for (let materialIndex = 0; materialIndex < 4; materialIndex += 1) {
        const materialId = `material-${String(materialIndex).padStart(2, '0')}`
        const physicalKey = registry.physicalKeyFor(source.id, segment.id, materialId)
        const handle = {
          states: [],
          applyLogicalSegmentState(state) { this.states.push(structuredClone(state)) },
        }
        handles.set(physicalKey, handle)
        registry.stageHandle(transaction, {
          physicalKey,
          handle,
          placement: {
            batchId: `${source.parity}:${segment.id}:${materialId}`,
            slot: paritySlot,
          },
        })
      }
    }
  }
  const registrations = registry.commitHandles(transaction)
  return {
    handles,
    registrations: new Map(registrations.map((registration) => [registration.physicalKey, registration])),
  }
}

function registryPlanForCommit(registry, registrations, commit) {
  const placements = []
  const activities = []
  for (const list of commit.lists) {
    const materialId = `material-${String(list.materialIndex).padStart(2, '0')}`
    for (const entry of list.completeSlotPermutation) {
      const physicalKey = registry.physicalKeyFor(entry.sourceId, list.segmentId, materialId)
      placements.push({
        registration: registrations.get(physicalKey),
        placement: { batchId: list.key, slot: entry.slot },
      })
      activities.push({ physicalKey, activity: entry.activity })
    }
  }
  return {
    placements,
    activities,
    presentation: registry.getPresentationSnapshot(),
  }
}

const vite = await createServer({
  root: PROJECT_DIR,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

try {
  const plannerModule = await vite.ssrLoadModule('/src/scene/RepeatSixPartActiveListPlanner.ts')
  const {
    REPEAT_SIX_PART_ACTIVE_LIST_COUNTS,
    RepeatSixPartActiveListBudgetError,
    RepeatSixPartActiveListCatalogError,
    RepeatSixPartOfflineActiveListKernel,
    RepeatSixPartRuntimeActivationError,
    createRepeatSixPartRuntimeActiveListController,
    RepeatSixPartActiveListTransactionError,
    StaleRepeatSixPartActiveListGenerationError,
    StaleRepeatSixPartActiveListRevisionError,
  } = plannerModule
  const { LogicalSegmentIdentityRegistry } = await vite.ssrLoadModule(
    '/src/scene/LogicalSegmentIdentityRegistry.ts',
  )

  const OfflineKernel = RepeatSixPartOfflineActiveListKernel

  assert.deepEqual(REPEAT_SIX_PART_ACTIVE_LIST_COUNTS, {
    sources: 78,
    segments: 6,
    units: 468,
    materialSlots: 4,
    parities: 2,
    paritySegmentGroups: 12,
    instancedMeshLists: 48,
  })

  assert.equal(
    Object.prototype.hasOwnProperty.call(plannerModule, 'RepeatSixPartActiveListPlanner'),
    false,
    'raw manifest construction must be exposed only through the explicitly offline kernel',
  )
  assert.ok(!Object.keys(plannerModule).some((key) => /issue.*activation.*capability/i.test(key)))
  assert.throws(
    () => createRepeatSixPartRuntimeActiveListController(
      { generation: 7, activatedContract: Object.freeze({}) },
      Object.freeze({}),
    ),
    (error) => error instanceof RepeatSixPartRuntimeActivationError &&
      error.blocker === 'AUTHORITATIVE_PHYSICAL_SEMANTIC_GATE_MISSING',
    'a forged runtime capability must fail the runtime ownership check',
  )

  // Exact synthetic manifest-v4 shape and a closed entry boundary. Only the
  // first unit enters; a zero-count template stays absent/hidden and costs no
  // draw. The replacement contains all 48 stable templates atomically.
  {
    const planner = new OfflineKernel({ generation: 7, manifest: makeFixture() })
    const commit = update(planner, [-3.5, 0.5, 0.5])
    assert.equal(commit.generation, 7)
    assert.equal(commit.baseRevision, 0)
    assert.equal(commit.revision, 1)
    assert.equal(commit.atomicReplacement, true)
    assert.equal(commit.boundsRecomputeRequired, true)
    assert.deepEqual(commit.focus, { space: 'owner-local', point: [-3.5, 0.5, 0.5] })
    assert.equal(commit.groups.length, 12)
    assert.equal(commit.lists.length, 48)
    assert.equal(commit.activeLists.length, 4)
    assert.equal(commit.metrics.activeUnits, 1)
    assert.equal(commit.metrics.culledUnits, 467)
    assert.equal(commit.metrics.submittedTriangles, SEGMENT_TRIANGLES[0])
    assert.equal(commit.metrics.submittedDraws, 4)
    assert.equal(commit.metrics.allOwnerResidentTriangles, 500_000 + SEGMENT_TRIANGLES[0])
    assert.equal(commit.metrics.previousSubmittedTriangles, 0)
    assert.equal(commit.metrics.synchronousPublishPeakTriangles, SEGMENT_TRIANGLES[0])
    assert.equal(commit.metrics.totalSynchronousPublishPeakTriangles, 500_000 + SEGMENT_TRIANGLES[0])
    assert.deepEqual(commit.metrics.initialSourceOwnershipRewrite, {
      provenByThisKernel: false,
      schedule: null,
      note: 'offline-build-responsibility',
    })
    assert.equal(commit.metrics.repeatTransitionTriangleBudget, 1_500_000)
    assert.equal(commit.metrics.totalTransitionTriangleBudget, 2_000_000)
    assert.deepEqual(commit.activeUnitKeys, ['source-00:segment-00'])
    assert.deepEqual(commit.activatedUnitKeys, ['source-00:segment-00'])
    assert.deepEqual(commit.retainedActiveUnitKeys, [])
    assert.deepEqual(commit.culledUnitKeys, [])
    assert.ok(commit.lists.every((list) => list.boundsRecomputeRequired === true))
    assert.ok(commit.lists.every((list) => list.instanceMatrixUpdateRequired === true))

    const activeGroup = commit.groups.find((group) => group.key === 'positive:segment-00')
    assert.ok(activeGroup)
    assert.equal(activeGroup.activeCount, 1)
    assert.equal(activeGroup.materialLists.length, 4)
    assert.equal(activeGroup.submittedTriangles, SEGMENT_TRIANGLES[0])
    assert.equal(activeGroup.submittedDraws, 4)
    assert.deepEqual(activeGroup.ownerLocalBounds, {
      space: 'owner-local', min: [0, 0, 0], max: [1, 1, 1],
    })
    assert.deepEqual(activeGroup.renderLocalBounds, {
      space: 'parity-host-local', min: [0, 0, 0], max: [1, 1, 1],
    })
    for (const materialList of activeGroup.materialLists) {
      assert.equal(materialList.present, true)
      assert.equal(materialList.visible, true)
      assert.equal(materialList.activeCount, 1)
      assert.equal(materialList.submittedDraws, 1)
      assert.strictEqual(materialList.unitKeys, activeGroup.unitKeys)
      assert.strictEqual(materialList.matrices, activeGroup.matrices)
      assert.strictEqual(materialList.slotToUnit, activeGroup.slotToUnit)
      assert.deepEqual(materialList.slotToUnit, [{
        slot: 0,
        unitKey: 'source-00:segment-00',
        unitIndex: 0,
        sourceIndex: 0,
        sourceId: 'source-00',
        activity: 'active',
      }])
      assert.strictEqual(materialList.completeSlotPermutation, activeGroup.completeSlotPermutation)
      assert.strictEqual(materialList.completeSlotMatrices, activeGroup.completeSlotMatrices)
      assert.equal(materialList.completeSlotPermutation.length, 40)
      assert.equal(materialList.completeSlotMatrices.length, 40)
      assert.equal(materialList.completeSlotPermutation[0].activity, 'active')
      assert.ok(materialList.completeSlotPermutation.slice(1).every((entry) => entry.activity === 'culled'))
    }
    const emptyList = commit.lists.find((list) => list.key === 'mirrored:segment-05:material-03')
    assert.ok(emptyList)
    assert.equal(emptyList.present, false)
    assert.equal(emptyList.visible, false)
    assert.equal(emptyList.activeCount, 0)
    assert.equal(emptyList.submittedDraws, 0)
    assert.equal(emptyList.ownerLocalBounds, null)
    assert.equal(emptyList.renderLocalBounds, null)
    assert.deepEqual(emptyList.unitKeys, [])
    assert.equal(emptyList.completeSlotPermutation.length, 38)
    assert.ok(emptyList.completeSlotPermutation.every((entry) => entry.activity === 'culled'))
    assert.ok(!commit.activeLists.includes(emptyList))

    assert.ok(Object.isFrozen(commit))
    assert.ok(Object.isFrozen(commit.lists))
    assert.ok(Object.isFrozen(commit.lists[0]))
    assert.ok(Object.isFrozen(commit.lists[0].matrices))
    assert.throws(() => { commit.lists[0].visible = false }, TypeError)
  }

  // The physical proof expands each AABB by a scalar. Its diagonal corner is
  // therefore included by L-infinity distance even though Euclidean distance
  // would be sqrt(3.5^2 + 3.5^2) and would incorrectly reject this unit.
  {
    const planner = new OfflineKernel({ generation: 7_001, manifest: makeFixture() })
    const diagonalCorner = update(planner, [-3.5, -3.5, 0.5])
    assert.deepEqual(diagonalCorner.activeUnitKeys, ['source-00:segment-00'])
    assert.equal(diagonalCorner.metrics.submittedTriangles, SEGMENT_TRIANGLES[0])
    assert.ok(Math.hypot(3.5, 3.5) > diagonalCorner.enterMarginMeters)
  }

  // Entry/exit hysteresis uses closed AABBs. The active unit survives exactly
  // on the 5.5 m outer boundary, then culls immediately beyond it.
  {
    const planner = new OfflineKernel({ generation: 8, manifest: makeFixture() })
    const entry = update(planner, [-3.5, 0.5, 0.5])
    assert.deepEqual(entry.activeUnitKeys, ['source-00:segment-00'])
    const outerClosed = prepare(planner, [-5.5, 0.5, 0.5])
    assert.equal(outerClosed.kind, 'no-op')
    assert.equal(outerClosed.revision, 1)
    assert.deepEqual(outerClosed.activeUnitKeys, ['source-00:segment-00'])
    assert.deepEqual(outerClosed.dirtyListKeys, [])
    assert.equal(planner.getSnapshot().revision, 1)
    const beyondOuter = update(planner, [-5.500_001, 0.5, 0.5])
    assert.deepEqual(beyondOuter.activeUnitKeys, [])
    assert.deepEqual(beyondOuter.culledUnitKeys, ['source-00:segment-00'])
    assert.equal(beyondOuter.metrics.submittedTriangles, 0)
    assert.equal(beyondOuter.metrics.submittedDraws, 0)
  }

  // A focus may be inside a source's broad six-segment union while remaining
  // outside all six per-unit entry envelopes. It must select nothing.
  {
    const fixture = makeFixture()
    const source = fixture.catalog.sources[2]
    const focus = [410, 0.5, 0.5]
    assert.ok(focus[0] >= source.bounds.min[0] && focus[0] <= source.bounds.max[0])
    const planner = new OfflineKernel({ generation: 9, manifest: fixture })
    const noOp = prepare(planner, focus)
    assert.equal(noOp.kind, 'no-op')
    assert.equal(noOp.revision, 0)
    assert.deepEqual(noOp.activeUnitKeys, [])
    assert.deepEqual(noOp.dirtyListKeys, [])
  }

  // Compaction is deterministic source-major ordering. When source 00 leaves,
  // source 01 moves from slot 1 to slot 0 in one complete replacement; the
  // four material lists share the new mapping and matrix arrays.
  {
    const planner = new OfflineKernel({ generation: 10, manifest: makeFixture() })
    const twoRows = update(planner, [3.5, 0.5, 0.5])
    const before = twoRows.groups.find((group) => group.key === 'positive:segment-00')
    assert.ok(before)
    assert.deepEqual(before.unitKeys, ['source-00:segment-00', 'source-01:segment-00'])
    assert.deepEqual(before.slotToUnit.map((entry) => [entry.slot, entry.sourceId]), [[0, 'source-00'], [1, 'source-01']])
    assert.equal(twoRows.metrics.submittedTriangles, SEGMENT_TRIANGLES[0] * 2)
    assert.equal(twoRows.metrics.submittedDraws, 4)

    const compacted = update(planner, [7, 0.5, 0.5])
    const after = compacted.groups.find((group) => group.key === 'positive:segment-00')
    assert.ok(after)
    assert.deepEqual(after.unitKeys, ['source-01:segment-00'])
    assert.deepEqual(after.slotToUnit.map((entry) => [entry.slot, entry.sourceId]), [[0, 'source-01']])
    assert.deepEqual(compacted.culledUnitKeys, ['source-00:segment-00'])
    assert.deepEqual(compacted.retainedActiveUnitKeys, ['source-01:segment-00'])
    for (const materialList of after.materialLists) {
      assert.strictEqual(materialList.unitKeys, after.unitKeys)
      assert.strictEqual(materialList.matrices, after.matrices)
      assert.strictEqual(materialList.slotToUnit, after.slotToUnit)
    }
  }

  // Mirrored canonical placement is factored through the fixed negative host;
  // every matrix submitted to the mirrored InstancedMesh remains positive.
  {
    const fixture = makeFixture()
    const planner = new OfflineKernel({ generation: 11, manifest: fixture })
    const commit = update(planner, [-8_000.5, 0.5, 0.5])
    assert.deepEqual(commit.activeUnitKeys, ['source-40:segment-00'])
    const group = commit.groups.find((entry) => entry.key === 'mirrored:segment-00')
    assert.ok(group)
    assert.equal(group.activeCount, 1)
    assert.ok(determinant3(group.matrices[0]) > 0)
    assert.equal(group.matrices[0][12], 8_000)
    assert.deepEqual(group.ownerLocalBounds, {
      space: 'owner-local', min: [-8_001, 0, 0], max: [-8_000, 1, 1],
    })
    assert.deepEqual(group.renderLocalBounds, {
      space: 'parity-host-local', min: [8_000, 0, 0], max: [8_001, 1, 1],
    })
    assert.ok(group.materialLists.every((list) => list.matrices.every((matrix) => determinant3(matrix) > 0)))
  }

  // Preparing is not a commit. A partial apply enters a rolling-back state;
  // the prior complete 48-list permutation remains the rollback target and a
  // new prepare is blocked until every applied participant proves rollback.
  {
    const planner = new OfflineKernel({ generation: 11_500, manifest: makeFixture() })
    const initial = planner.getSnapshot()
    const preparation = prepare(planner, [-3.5, 0.5, 0.5])
    assert.equal(preparation.kind, 'prepared')
    assert.deepEqual(preparation.requiredAcknowledgements, ['renderer', 'registry'])
    assert.equal(preparation.token.baseRevision, 0)
    assert.equal(preparation.token.revision, 1)
    assert.equal(preparation.rollbackTarget.lists.length, 48)
    assert.ok(preparation.rollbackTarget.lists.every((list) => list.completeSlotPermutation.length === list.capacity))
    assert.deepEqual(planner.getSnapshot(), { ...initial, transactionPhase: 'prepared' })
    assert.throws(
      () => planner.acknowledgePreparedUpdateRollback(rollbackReceipt(preparation, 'renderer')),
      /No six-part rollback is in progress/,
      'rollback receipts are invalid before cancellation enters rolling-back state',
    )
    assert.throws(
      () => prepare(planner, [3.5, 0.5, 0.5]),
      RepeatSixPartActiveListTransactionError,
      'a second preparation must not replace an in-flight transaction',
    )

    const foreignPlanner = new OfflineKernel({ generation: 11_500, manifest: makeFixture() })
    const foreign = prepare(foreignPlanner, [-3.5, 0.5, 0.5])
    assert.throws(
      () => planner.acknowledgePreparedUpdate(applyReceipt(foreign, 'renderer')),
      /stale or belongs to another planner/,
    )
    assert.equal(foreignPlanner.cancelPreparedUpdate(foreign.token).phase, 'cancelled')

    const renderer = acknowledgeApply(planner, preparation, 'renderer')
    assert.equal(renderer.committed, false)
    assert.equal(renderer.commit, null)
    assert.deepEqual(planner.getSnapshot(), { ...initial, transactionPhase: 'prepared' })
    assert.throws(
      () => planner.acknowledgePreparedUpdate(applyReceipt(preparation, 'renderer')),
      /already acknowledged/,
    )
    const cancellation = planner.cancelPreparedUpdate(preparation.token)
    assert.equal(cancellation.phase, 'rolling-back')
    assert.deepEqual(cancellation.appliedParticipants, ['renderer'])
    assert.deepEqual(cancellation.rollbackPendingParticipants, ['renderer'])
    assert.strictEqual(cancellation.replacement, preparation.replacement)
    assert.strictEqual(cancellation.rollbackTarget, preparation.rollbackTarget)
    assert.deepEqual(planner.getSnapshot(), { ...initial, transactionPhase: 'rolling-back' })
    assert.throws(
      () => prepare(planner, [3.5, 0.5, 0.5]),
      /already pending/,
    )
    const badRollback = rollbackReceipt(preparation, 'renderer')
    badRollback.rendererRestoredRevision += 1
    assert.throws(
      () => planner.acknowledgePreparedUpdateRollback(badRollback),
      /renderer revision is invalid/,
      'a rollback failure/invalid receipt must retain the rolling-back state',
    )
    assert.equal(planner.getSnapshot().transactionPhase, 'rolling-back')
    const rolledBack = acknowledgeRollback(planner, preparation, 'renderer')
    assert.equal(rolledBack.rollbackComplete, true)
    assert.deepEqual(rolledBack.rollbackPendingParticipants, [])
    assert.deepEqual(planner.getSnapshot(), initial)

    const retry = prepare(planner, [-3.5, 0.5, 0.5])
    assert.equal(retry.token.sequence, preparation.token.sequence + 1)
    const copiedTokenReceipt = applyReceipt(retry, 'registry')
    copiedTokenReceipt.token = structuredClone(retry.token)
    assert.throws(
      () => planner.acknowledgePreparedUpdate(copiedTokenReceipt),
      /stale or belongs to another planner/,
      'a structurally copied token must not pass the ownership guard',
    )
    const staleGuardReceipt = applyReceipt(retry, 'registry')
    staleGuardReceipt.registryBaseMutationGuard = {
      ...staleGuardReceipt.registryBaseMutationGuard,
      revision: staleGuardReceipt.registryBaseMutationGuard.revision + 1,
    }
    assert.throws(
      () => planner.acknowledgePreparedUpdate(staleGuardReceipt),
      /registry base guard is stale/,
    )
    assert.equal(planner.getSnapshot().transactionPhase, 'prepared')
    const registry = acknowledgeApply(planner, retry, 'registry')
    assert.equal(registry.committed, false)
    assert.equal(planner.getSnapshot().revision, 0)
    const committed = acknowledgeApply(planner, retry, 'renderer')
    assert.equal(committed.committed, true)
    assert.strictEqual(committed.commit, retry.replacement)
    assert.deepEqual(planner.getSnapshot(), {
      generation: 11_500,
      revision: 1,
      activeUnitKeys: ['source-00:segment-00'],
      disposed: false,
      transactionPhase: 'idle',
    })
    assert.throws(
      () => planner.cancelPreparedUpdate(retry.token),
      /No six-part replacement is pending/,
    )
  }

  // Disposing invalidates every outstanding token/receipt and prevents any
  // subsequent selector or transaction operation.
  {
    const planner = new OfflineKernel({ generation: 11_600, manifest: makeFixture() })
    const preparation = prepare(planner, [-3.5, 0.5, 0.5])
    planner.dispose()
    assert.deepEqual(planner.getSnapshot(), {
      generation: 11_600,
      revision: 0,
      activeUnitKeys: [],
      disposed: true,
      transactionPhase: 'idle',
    })
    assert.throws(() => planner.acknowledgePreparedUpdate(applyReceipt(preparation, 'renderer')), /disposed/)
    assert.throws(() => planner.cancelPreparedUpdate(preparation.token), /disposed/)
    assert.throws(() => prepare(planner, [-3.5, 0.5, 0.5]), /disposed/)
  }

  // Real registry integration: the planner's 48 complete active+culled slot
  // permutations produce one complete atomic registry plan. A registry-first
  // partial apply can then roll back to the retained prior permutation before
  // the offline kernel allows another selector transaction.
  {
    const generation = 11_750
    const fixture = makeFixture()
    const registry = new LogicalSegmentIdentityRegistry({
      layerGeneration: generation,
      domainId: 'repeat-six-part-integration',
      sources: makeRegistryCatalog(fixture),
    })
    const { registrations } = registerPersistentHandles(registry, fixture)
    const planner = new OfflineKernel({ generation, manifest: fixture })
    externalRevisions.set(planner, {
      rendererRevision: 0,
      registryRevision: registry.revision,
    })

    const first = prepare(planner, [-3.5, 0.5, 0.5])
    assert.equal(first.kind, 'prepared')
    const firstRegistry = registry.applyCompactedPhysicalPlan(
      registryPlanForCommit(registry, registrations, first.replacement),
      first.token.registryBaseMutationGuard,
    )
    assert.deepEqual(firstRegistry.guard, {
      layerGeneration: generation,
      revision: first.token.registryBaseMutationGuard.revision + 1,
    })
    const firstRegistryReceipt = acknowledgeApply(planner, first, 'registry')
    assert.equal(firstRegistryReceipt.committed, false)
    const firstRendererReceipt = acknowledgeApply(planner, first, 'renderer')
    assert.equal(firstRendererReceipt.committed, true)
    assert.equal(registry.getSnapshot().activePhysicalUnits, 4)
    const firstPhysical = registry.physicalKeyFor('source-00', 'segment-00', 'material-00')
    assert.equal(registry.getPhysicalUnitState(firstPhysical).activity, 'active')
    assert.deepEqual(registry.getPhysicalUnitState(firstPhysical).placement, {
      batchId: 'positive:segment-00:material-00', slot: 0,
    })

    const second = prepare(planner, [7, 0.5, 0.5])
    const secondRegistry = registry.applyCompactedPhysicalPlan(
      registryPlanForCommit(registry, registrations, second.replacement),
      second.token.registryBaseMutationGuard,
    )
    assert.equal(secondRegistry.guard.revision, second.token.registryBaseMutationGuard.revision + 1)
    acknowledgeApply(planner, second, 'registry')
    const rollback = planner.cancelPreparedUpdate(second.token)
    assert.equal(rollback.phase, 'rolling-back')
    assert.deepEqual(rollback.appliedParticipants, ['registry'])
    assert.throws(() => prepare(planner, [0, 0, 0]), /already pending/)

    const restoredRegistry = registry.applyCompactedPhysicalPlan(
      registryPlanForCommit(registry, registrations, rollback.rollbackTarget),
      secondRegistry.guard,
    )
    assert.equal(restoredRegistry.guard.revision, second.token.registryBaseMutationGuard.revision + 2)
    const rollbackAcknowledgement = acknowledgeRollback(planner, second, 'registry')
    assert.equal(rollbackAcknowledgement.rollbackComplete, true)
    assert.equal(planner.getSnapshot().revision, 1)
    assert.deepEqual(planner.getSnapshot().activeUnitKeys, ['source-00:segment-00'])
    assert.equal(registry.getPhysicalUnitState(firstPhysical).activity, 'active')
    assert.equal(registry.getSnapshot().activePhysicalUnits, 4)
    registry.dispose()
    planner.dispose()
  }

  // Guards reject stale asynchronous selector work without advancing the
  // committed revision or changing hysteresis state.
  {
    const planner = new OfflineKernel({ generation: 12, manifest: makeFixture() })
    assert.throws(
      () => prepare(planner, [0, 0, 0], 11, 0),
      StaleRepeatSixPartActiveListGenerationError,
    )
    const first = update(planner, [-3.5, 0.5, 0.5])
    assert.equal(first.revision, 1)
    assert.throws(
      () => prepare(planner, [0, 0, 0], 12, 0),
      StaleRepeatSixPartActiveListRevisionError,
    )
    assert.equal(planner.getSnapshot().revision, 1)
    assert.deepEqual(planner.getSnapshot().activeUnitKeys, ['source-00:segment-00'])
    assert.throws(
      () => planner.prepareFocusUpdate({
        generation: 12,
        revision: 1,
        rendererRevision: 0,
        registryMutationGuard: { layerGeneration: 12, revision: 1 },
        focus: { space: 'owner-local', point: [7, 0.5, 0.5] },
      }),
      /Stale renderer revision/,
    )
    assert.throws(
      () => planner.prepareFocusUpdate({
        generation: 12,
        revision: 1,
        rendererRevision: 1,
        registryMutationGuard: { layerGeneration: 12, revision: 0 },
        focus: { space: 'owner-local', point: [7, 0.5, 0.5] },
      }),
      /registry mutation guard is stale/,
    )
    assert.throws(
      () => planner.prepareFocusUpdate({
        generation: 12,
        revision: 1,
        rendererRevision: 1,
        registryMutationGuard: { layerGeneration: 12, revision: 1 },
        focus: { space: 'world', point: [0, 0, 0] },
      }),
      /focus.space must equal owner-local/,
    )
  }

  // A budget failure is also atomic: the successful one-unit state remains
  // current when a two-unit focus would exceed the exact triangle cap.
  {
    const planner = new OfflineKernel({
      generation: 13,
      manifest: makeFixture({ repeatBudget: 15_000, totalBudget: 515_000 }),
    })
    update(planner, [-3.5, 0.5, 0.5])
    assert.throws(
      () => update(planner, [3.5, 0.5, 0.5]),
      (error) => {
        assert.ok(error instanceof RepeatSixPartActiveListBudgetError)
        assert.equal(error.submittedTriangles, SEGMENT_TRIANGLES[0] * 2)
        assert.equal(error.submittedDraws, 4)
        return true
      },
    )
    assert.deepEqual(planner.getSnapshot(), {
      generation: 13,
      revision: 1,
      activeUnitKeys: ['source-00:segment-00'],
      disposed: false,
      transactionPhase: 'idle',
    })

    const drawLimited = new OfflineKernel({
      generation: 14,
      manifest: makeFixture({ drawBudget: 0 }),
    })
    assert.throws(
      () => update(drawLimited, [-3.5, 0.5, 0.5]),
      /exceeds draw budget: 4 > 0/,
    )
    assert.deepEqual(drawLimited.getSnapshot(), {
      generation: 14,
      revision: 0,
      activeUnitKeys: [],
      disposed: false,
      transactionPhase: 'idle',
    })
  }

  // Active-list publication accounts only the old OR new synchronous frame.
  // It explicitly does not claim to prove the initial source-ownership
  // rewrite, which remains an offline-build responsibility.
  {
    const planner = new OfflineKernel({
      generation: 15,
      manifest: makeFixture({
        repeatBudget: 60_000,
        repeatTransitionBudget: 70_000,
        totalBudget: 560_000,
        totalTransitionBudget: 570_000,
      }),
    })
    const publish = prepare(planner, [-3.5, 0.5, 0.5])
    assert.equal(publish.replacement.metrics.synchronousPublishPeakTriangles, SEGMENT_TRIANGLES[0])
    assert.equal(
      publish.replacement.metrics.totalSynchronousPublishPeakTriangles,
      500_000 + SEGMENT_TRIANGLES[0],
    )
    assert.equal(publish.replacement.metrics.initialSourceOwnershipRewrite.provenByThisKernel, false)
    assert.equal(publish.replacement.metrics.initialSourceOwnershipRewrite.schedule, null)
    planner.cancelPreparedUpdate(publish.token)

    const cullPlanner = new OfflineKernel({ generation: 16, manifest: makeFixture() })
    update(cullPlanner, [-3.5, 0.5, 0.5])
    const cull = prepare(cullPlanner, [-100, 0.5, 0.5])
    assert.equal(cull.replacement.metrics.submittedTriangles, 0)
    assert.equal(cull.replacement.metrics.previousSubmittedTriangles, SEGMENT_TRIANGLES[0])
    assert.equal(cull.replacement.metrics.synchronousPublishPeakTriangles, SEGMENT_TRIANGLES[0])
    assert.equal(cull.replacement.metrics.totalSynchronousPublishPeakTriangles, 500_000 + SEGMENT_TRIANGLES[0])
    cullPlanner.cancelPreparedUpdate(cull.token)

    const invalidTotalTransition = makeFixture()
    invalidTotalTransition.budgets.totalTransitionTriangles = 1_999_999
    assert.throws(
      () => new OfflineKernel({ generation: 17, manifest: invalidTotalTransition }),
      /totalTransitionTriangles must cover/,
    )
  }

  // Catalog rejection is fail-closed: no missing/duplicate tuple, broad
  // source-union stand-in, non-finite matrix, or negative render-local matrix
  // can reach active-list planning.
  {
    const missing = makeFixture()
    missing.catalog.units.pop()
    assert.throws(
      () => new OfflineKernel({ generation: 20, manifest: missing }),
      RepeatSixPartActiveListCatalogError,
    )

    const duplicate = makeFixture()
    duplicate.catalog.units.at(-1).id = duplicate.catalog.units[0].id
    assert.throws(
      () => new OfflineKernel({ generation: 20, manifest: duplicate }),
      /duplicate unit id/,
    )

    const broad = makeFixture()
    broad.catalog.units[0].bounds = structuredClone(broad.catalog.sources[0].bounds)
    assert.throws(
      () => new OfflineKernel({ generation: 20, manifest: broad }),
      /broad source-union selection is forbidden/,
    )

    const nonFinite = makeFixture()
    nonFinite.catalog.sources[0].renderLocalMatrix.matrix[4] = Number.NaN
    assert.throws(
      () => new OfflineKernel({ generation: 20, manifest: nonFinite }),
      /16 finite numbers/,
    )

    const negativeLocal = makeFixture()
    negativeLocal.catalog.sources[0].renderLocalMatrix.matrix[0] = -1
    assert.throws(
      () => new OfflineKernel({ generation: 20, manifest: negativeLocal }),
      /positive determinant/,
    )
  }

  // Equivalent planners and focus histories emit byte-for-byte-equivalent
  // serializable commits, including compaction order and revision metadata.
  {
    const left = new OfflineKernel({ generation: 30, manifest: makeFixture() })
    const right = new OfflineKernel({ generation: 30, manifest: makeFixture() })
    const leftFirst = update(left, [3.5, 0.5, 0.5])
    const rightFirst = update(right, [3.5, 0.5, 0.5])
    assert.deepEqual(leftFirst, rightFirst)
    const leftSecond = update(left, [7, 0.5, 0.5])
    const rightSecond = update(right, [7, 0.5, 0.5])
    assert.deepEqual(leftSecond, rightSecond)
    assert.equal(JSON.stringify(leftSecond), JSON.stringify(rightSecond))
  }

  console.log(
    'Repeat six-part offline kernel: PASS (runtime gate, 78x6 catalog, complete 48-list permutations, receipt commit/rollback, registry integration)',
  )
} finally {
  await vite.close()
}
