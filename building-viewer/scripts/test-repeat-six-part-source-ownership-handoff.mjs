import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const MIRROR_X = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const SEGMENT_TRIANGLES = [10_537, 10_558, 10_596, 10_535, 10_353, 8_690]
const GENERATION = 41_000

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

function translatedIdentity(x, y = 0, z = 0) {
  const matrix = [...IDENTITY]
  matrix[12] = x
  matrix[13] = y
  matrix[14] = z
  return matrix
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

function unionBounds(bounds) {
  return {
    space: 'owner-local',
    min: [0, 1, 2].map((axis) => Math.min(...bounds.map((entry) => entry.min[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...bounds.map((entry) => entry.max[axis]))),
  }
}

function makePlannerFixture() {
  const segments = SEGMENT_TRIANGLES.map((triangles, index) => ({
    index,
    id: `segment-${String(index).padStart(2, '0')}`,
    triangles,
    materialPrimitiveCount: 4,
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
    const translation = sourceIndex === 0 ? 0 : sourceIndex === 1 ? 6 : sourceIndex * 200
    const renderLocalMatrix = translatedIdentity(translation)
    const canonicalMatrix = multiplyMatrices(parity === 'positive' ? IDENTITY : MIRROR_X, renderLocalMatrix)
    const sourceUnits = segments.map((segment, segmentIndex) => {
      const unit = {
        index: sourceIndex * 6 + segmentIndex,
        id: `source-${String(sourceIndex).padStart(2, '0')}:segment-${String(segmentIndex).padStart(2, '0')}`,
        sourceIndex,
        sourceId: `source-${String(sourceIndex).padStart(2, '0')}`,
        segmentIndex,
        segmentId: segment.id,
        bounds: transformBounds(segment.bounds, canonicalMatrix),
        triangles: segment.triangles,
      }
      units.push(unit)
      return unit
    })
    sources.push({
      index: sourceIndex,
      id: `source-${String(sourceIndex).padStart(2, '0')}`,
      path: `Ground Floor._anim1/Ground Floor.BT_3/source-${String(sourceIndex).padStart(2, '0')}`,
      parity,
      canonicalMatrix: { space: 'owner-local', matrix: canonicalMatrix },
      renderLocalMatrix: { space: 'parity-host-local', matrix: renderLocalMatrix },
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
      repeatFamilyResidentTriangles: 1_500_000,
      repeatFamilyTransitionTriangles: 1_500_000,
      totalResidentTriangles: 2_000_000,
      totalTransitionTriangles: 2_000_000,
      allOtherOwnerReservationTriangles: 500_000,
      maxActiveDraws: 48,
      maxPersistentRendererTemplates: 48,
    },
  }
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
  const adapter = { applyLogicalSegmentState() {} }
  for (const source of fixture.catalog.sources) {
    const paritySlot = source.parity === 'positive' ? source.index : source.index - 40
    for (const segment of fixture.geometry.segments) {
      for (let materialIndex = 0; materialIndex < 4; materialIndex += 1) {
        const materialId = `material-${String(materialIndex).padStart(2, '0')}`
        const physicalKey = registry.physicalKeyFor(source.id, segment.id, materialId)
        registry.stageHandle(transaction, {
          physicalKey,
          handle: adapter,
          placement: {
            batchId: `${source.parity}:${segment.id}:${materialId}`,
            slot: paritySlot,
          },
        })
      }
    }
  }
  const registrations = registry.commitHandles(transaction)
  return new Map(registrations.map((registration) => [registration.physicalKey, registration]))
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

function plannerApplyReceipt(preparation, participant) {
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

export function buildAuthoritativeEvidence(OfflineKernel, LogicalSegmentIdentityRegistry) {
  const fixture = makePlannerFixture()
  const registry = new LogicalSegmentIdentityRegistry({
    layerGeneration: GENERATION,
    domainId: 'repeat-six-part-source-ownership-handoff-test',
    sources: makeRegistryCatalog(fixture),
  })
  const registrations = registerPersistentHandles(registry, fixture)
  const planner = new OfflineKernel({ generation: GENERATION, manifest: fixture })
  const preparation = planner.prepareFocusUpdate({
    generation: GENERATION,
    revision: 0,
    rendererRevision: 0,
    registryMutationGuard: registry.getMutationGuard(),
    focus: { space: 'owner-local', point: [-3.5, 0.5, 0.5] },
  })
  assert.equal(preparation.kind, 'prepared')
  const registryResult = registry.applyCompactedPhysicalPlan(
    registryPlanForCommit(registry, registrations, preparation.replacement),
    preparation.token.registryBaseMutationGuard,
  )
  assert.equal(registryResult.changed, true)
  assert.equal(
    planner.acknowledgePreparedUpdate(plannerApplyReceipt(preparation, 'registry')).committed,
    false,
  )
  const acknowledgement = planner.acknowledgePreparedUpdate(plannerApplyReceipt(preparation, 'renderer'))
  assert.equal(acknowledgement.committed, true)
  assert.strictEqual(acknowledgement.commit, preparation.replacement)
  const evidence = Object.freeze({
    plannerCommit: acknowledgement.commit,
    registrySnapshot: registry.getSnapshot(),
    registryMutationGuard: registry.getMutationGuard(),
  })
  assert.equal(evidence.registrySnapshot.registeredHandles, 1_872)
  assert.equal(evidence.registrySnapshot.activePhysicalUnits, 4)
  return { evidence, registry, planner }
}

function request(evidence, generation = GENERATION, ownershipRevision = 0) {
  return { generation, ownershipRevision, evidence }
}

function stageReceipt(preparation, command, overrides = {}) {
  return {
    kind: 'repeat-six-part-staged-operation-receipt',
    token: preparation.token,
    command,
    generation: preparation.token.generation,
    ownershipBaseRevision: preparation.token.ownershipBaseRevision,
    outcome: 'staged-not-observer-visible',
    ...overrides,
  }
}

function rollbackReceipt(preparation, command, overrides = {}) {
  return {
    kind: 'repeat-six-part-rollback-operation-receipt',
    token: preparation.token,
    command,
    generation: preparation.token.generation,
    ownershipBaseRevision: preparation.token.ownershipBaseRevision,
    outcome: 'rolled-back-staged-operation',
    ...overrides,
  }
}

function stageForward(coordinator, preparation, count = 5) {
  const acknowledged = []
  let command = preparation.nextCommand
  for (let index = 0; index < count; index += 1) {
    assert.notEqual(command.kind, 'commit-atomic-ownership-replacement')
    const progress = coordinator.acknowledgeStagedOperation(stageReceipt(preparation, command))
    acknowledged.push(command)
    command = progress.nextCommand
    const snapshot = coordinator.getSnapshot()
    assert.equal(snapshot.visibleOwnership.mode, 'original-production-roots')
    assert.deepEqual(snapshot.visibleOwnership.originalProductionRootIds, [
      'scene/0/258', 'scene/0/259', 'scene/0/260', 'scene/0/261',
    ])
    assert.equal(snapshot.visibleOwnership.replacementOwnerId, null)
    assert.equal(snapshot.visibleOwnership.dualOwnershipVisible, false)
    assert.equal(snapshot.visibilityAssured, true)
  }
  return { command, acknowledged }
}

function commitReceipt(preparation, command, operationOrder, overrides = {}) {
  return {
    kind: 'repeat-six-part-atomic-ownership-commit-receipt',
    token: preparation.token,
    command,
    generation: preparation.token.generation,
    ownershipBaseRevision: preparation.token.ownershipBaseRevision,
    committedAtomically: true,
    operationOrder,
    retiredOriginalRootIds: [...command.expectedRetiredRootIds],
    observerVisibleBefore: structuredClone(command.expectedVisibleBefore),
    observerVisibleAfter: structuredClone(command.expectedVisibleAfter),
    ...overrides,
  }
}

function assertErrorCode(callback, ErrorClass, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof ErrorClass)
    assert.equal(error.code, code)
    return true
  })
}

function assertDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  assert.equal(Object.isFrozen(value), true)
  for (const entry of Object.values(value)) assertDeepFrozen(entry, seen)
}

const vite = await createServer({
  root: PROJECT_DIR,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

try {
  const plannerModule = await vite.ssrLoadModule('/src/scene/RepeatSixPartActiveListPlanner.ts')
  const registryModule = await vite.ssrLoadModule('/src/scene/LogicalSegmentIdentityRegistry.ts')
  const handoffModule = await vite.ssrLoadModule('/src/scene/RepeatSixPartSourceOwnershipHandoff.ts')
  const {
    RepeatSixPartOfflineActiveListKernel,
  } = plannerModule
  const {
    LogicalSegmentIdentityRegistry,
  } = registryModule
  const {
    REPEAT_SIX_PART_HANDOFF_COUNTS,
    REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS,
    REPEAT_SIX_PART_REPLACEMENT_OWNER_ID,
    areIssuedRepeatSixPartSourceOwnershipEvidenceFromSameCoordinator,
    isIssuedRepeatSixPartSourceOwnershipHandoffSnapshot,
    isIssuedRepeatSixPartSourceOwnershipHandoffToken,
    RepeatSixPartSourceOwnershipHandoffCoordinator,
    RepeatSixPartSourceOwnershipHandoffError,
    StaleRepeatSixPartSourceOwnershipGenerationError,
    StaleRepeatSixPartSourceOwnershipRevisionError,
  } = handoffModule

  assert.deepEqual(REPEAT_SIX_PART_HANDOFF_COUNTS, {
    logicalSources: 78,
    segments: 468,
    plannerUnits: 468,
    materials: 4,
    physicalUnits: 1_872,
    persistentLists: 48,
    originalProductionRoots: 4,
  })
  assert.deepEqual(REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS, [
    'scene/0/258', 'scene/0/259', 'scene/0/260', 'scene/0/261',
  ])
  assert.equal(Object.isFrozen(REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS), true)
  assert.equal(REPEAT_SIX_PART_REPLACEMENT_OWNER_ID, 'ground-floor-anim1/repeat-six-part-persistent-catalog-v4')

  const built = buildAuthoritativeEvidence(
    RepeatSixPartOfflineActiveListKernel,
    LogicalSegmentIdentityRegistry,
  )
  const { evidence } = built

  // The handoff boundary consumes a real committed planner replacement and a
  // complete registry snapshot. Incomplete, mismatched, or stale evidence is
  // rejected before the first renderer command can be issued.
  {
    const coordinator = new RepeatSixPartSourceOwnershipHandoffCoordinator(GENERATION)
    assertErrorCode(
      () => coordinator.prepare(request({
        ...evidence,
        registrySnapshot: { ...evidence.registrySnapshot, registeredHandles: 1_871 },
      })),
      RepeatSixPartSourceOwnershipHandoffError,
      'INVALID_CONTRACT',
    )
    assertErrorCode(
      () => coordinator.prepare(request({
        ...evidence,
        registrySnapshot: { ...evidence.registrySnapshot, activePhysicalUnits: 8, culledPhysicalUnits: 1_864 },
      })),
      RepeatSixPartSourceOwnershipHandoffError,
      'INVALID_CONTRACT',
    )
    assertErrorCode(
      () => coordinator.prepare(request({
        ...evidence,
        plannerCommit: { ...evidence.plannerCommit, lists: evidence.plannerCommit.lists.slice(0, 47) },
      })),
      RepeatSixPartSourceOwnershipHandoffError,
      'INVALID_CONTRACT',
    )
    // Even a byte-for-byte structural clone is not an authoritative planner
    // issuance and may not cross the ownership boundary.
    assertErrorCode(
      () => coordinator.prepare(request({
        ...evidence,
        plannerCommit: structuredClone(evidence.plannerCommit),
      })),
      RepeatSixPartSourceOwnershipHandoffError,
      'INVALID_CONTRACT',
    )
    const foreign = buildAuthoritativeEvidence(
      RepeatSixPartOfflineActiveListKernel,
      LogicalSegmentIdentityRegistry,
    )
    assert.equal(foreign.evidence.registryMutationGuard.revision, evidence.registryMutationGuard.revision)
    // Individually genuine evidence with matching values is still rejected if
    // the snapshot and guard were issued by different registry instances.
    assertErrorCode(
      () => coordinator.prepare(request({
        plannerCommit: evidence.plannerCommit,
        registrySnapshot: evidence.registrySnapshot,
        registryMutationGuard: foreign.evidence.registryMutationGuard,
      })),
      RepeatSixPartSourceOwnershipHandoffError,
      'INVALID_CONTRACT',
    )
    foreign.registry.dispose()
    foreign.planner.dispose()
    assertErrorCode(
      () => coordinator.prepare(request(evidence, GENERATION - 1)),
      StaleRepeatSixPartSourceOwnershipGenerationError,
      'STALE_GENERATION',
    )
    assertErrorCode(
      () => coordinator.prepare(request(evidence, GENERATION, 1)),
      StaleRepeatSixPartSourceOwnershipRevisionError,
      'STALE_REVISION',
    )
    assert.equal(coordinator.getSnapshot().observerReceiptCount, 0)
  }

  // Happy path: publish is staged first, then each exact production root is
  // retired once and in pinned order. Every pre-commit observer receipt still
  // shows original-only ownership. The sole visible mutation is the atomic
  // replacement-only commit.
  {
    const coordinator = new RepeatSixPartSourceOwnershipHandoffCoordinator(GENERATION)
    assert.deepEqual(coordinator.getSnapshot().visibleOwnership, {
      mode: 'original-production-roots',
      originalProductionRootIds: ['scene/0/258', 'scene/0/259', 'scene/0/260', 'scene/0/261'],
      replacementOwnerId: null,
      dualOwnershipVisible: false,
    })
    const preparation = coordinator.prepare(request(evidence))
    const preparedSnapshot = coordinator.getSnapshot()
    assert.equal(isIssuedRepeatSixPartSourceOwnershipHandoffToken(preparation.token), true)
    assert.equal(isIssuedRepeatSixPartSourceOwnershipHandoffSnapshot(preparedSnapshot), true)
    assert.equal(
      areIssuedRepeatSixPartSourceOwnershipEvidenceFromSameCoordinator(
        preparation.token,
        preparedSnapshot,
      ),
      true,
    )
    assert.equal(isIssuedRepeatSixPartSourceOwnershipHandoffToken({ ...preparation.token }), false)
    assert.equal(isIssuedRepeatSixPartSourceOwnershipHandoffSnapshot(structuredClone(preparedSnapshot)), false)
    assert.equal(preparation.nextCommand.kind, 'publish-replacement')
    assert.equal(preparation.nextCommand.operationSequence, 0)
    assert.notStrictEqual(preparation.nextCommand.plannerCommit, evidence.plannerCommit)
    assert.deepEqual(preparation.nextCommand.plannerCommit, evidence.plannerCommit)
    assertDeepFrozen(preparation.nextCommand.plannerCommit)
    assertDeepFrozen(preparation.nextCommand.registryMutationGuard)
    assert.equal(Object.isFrozen(preparation), true)
    assert.equal(Object.isFrozen(preparation.token), true)

    assertErrorCode(
      () => coordinator.commit({ token: preparation.token }),
      RepeatSixPartSourceOwnershipHandoffError,
      'TRANSACTION_STATE',
    )
    const forgedLaterCommand = {
      ...preparation.nextCommand,
      kind: 'retire-original-production-root',
      rootId: 'scene/0/258',
      rootOrdinal: 0,
      operationSequence: 1,
    }
    assertErrorCode(
      () => coordinator.acknowledgeStagedOperation(stageReceipt(preparation, forgedLaterCommand)),
      RepeatSixPartSourceOwnershipHandoffError,
      'INVALID_CONTRACT',
    )

    const { command: atomicCommand, acknowledged } = stageForward(coordinator, preparation)
    assert.equal(atomicCommand.kind, 'commit-atomic-ownership-replacement')
    assert.deepEqual(acknowledged.map((command) => command.kind), [
      'publish-replacement',
      'retire-original-production-root',
      'retire-original-production-root',
      'retire-original-production-root',
      'retire-original-production-root',
    ])
    assert.deepEqual(acknowledged.slice(1).map((command) => command.rootId), [
      'scene/0/258', 'scene/0/259', 'scene/0/260', 'scene/0/261',
    ])
    assert.equal(new Set(acknowledged.slice(1).map((command) => command.rootId)).size, 4)
    const operationOrder = [
      `publish:${REPEAT_SIX_PART_REPLACEMENT_OWNER_ID}`,
      'retire:scene/0/258',
      'retire:scene/0/259',
      'retire:scene/0/260',
      'retire:scene/0/261',
      'commit:atomic-ownership-replacement',
    ]

    const dualOwnership = structuredClone(atomicCommand.expectedVisibleAfter)
    dualOwnership.originalProductionRootIds = ['scene/0/258']
    assertErrorCode(
      () => coordinator.commit(commitReceipt(preparation, atomicCommand, operationOrder, {
        observerVisibleAfter: dualOwnership,
      })),
      RepeatSixPartSourceOwnershipHandoffError,
      'INVALID_CONTRACT',
    )
    assert.equal(coordinator.getSnapshot().state, 'ready-to-commit')
    assert.equal(coordinator.getSnapshot().visibleOwnership.mode, 'original-production-roots')

    assertErrorCode(
      () => coordinator.commit(commitReceipt(preparation, atomicCommand, operationOrder.slice().reverse())),
      RepeatSixPartSourceOwnershipHandoffError,
      'INVALID_CONTRACT',
    )
    const result = coordinator.commit(commitReceipt(preparation, atomicCommand, operationOrder))
    assert.equal(result.ownershipRevision, 1)
    assert.deepEqual(result.retiredOriginalRootIds, [
      'scene/0/258', 'scene/0/259', 'scene/0/260', 'scene/0/261',
    ])
    assert.deepEqual(result.visibleOwnership, {
      mode: 'replacement-persistent-catalog',
      originalProductionRootIds: [],
      replacementOwnerId: REPEAT_SIX_PART_REPLACEMENT_OWNER_ID,
      dualOwnershipVisible: false,
    })
    assert.equal(result.observerReceipt.event, 'committed')
    assert.equal(result.observerReceipt.visibilityAssured, true)
    assert.equal(Object.isFrozen(result.observerReceipt), true)
    assert.equal(Object.isFrozen(result.observerReceipt.visibleOwnership), true)
    assert.equal(Object.isFrozen(result.observerReceipt.visibleOwnership.originalProductionRootIds), true)

    const observerReceipts = coordinator.getObserverReceipts()
    assert.equal(observerReceipts.length, 7)
    assert.deepEqual(observerReceipts.map((receipt) => receipt.observerSequence), [1, 2, 3, 4, 5, 6, 7])
    assert.ok(observerReceipts.slice(0, -1).every((receipt) =>
      receipt.visibleOwnership.mode === 'original-production-roots' &&
      receipt.visibleOwnership.replacementOwnerId === null &&
      receipt.visibleOwnership.originalProductionRootIds.length === 4 &&
      receipt.visibleOwnership.dualOwnershipVisible === false))
    assert.deepEqual(coordinator.getObserverReceipts(5).map((receipt) => receipt.observerSequence), [6, 7])
    assert.equal(coordinator.getSnapshot().state, 'committed')
    assert.equal(coordinator.getSnapshot().ownershipRevision, 1)

    assertErrorCode(
      () => coordinator.prepare(request(evidence, GENERATION, 1)),
      RepeatSixPartSourceOwnershipHandoffError,
      'TRANSACTION_STATE',
    )
    assertErrorCode(
      () => coordinator.commit(commitReceipt(preparation, atomicCommand, operationOrder)),
      StaleRepeatSixPartSourceOwnershipRevisionError,
      'STALE_REVISION',
    )

    const disposal = coordinator.dispose()
    assert.deepEqual(disposal, { kind: 'disposed', disposed: true, rollback: null })
    assert.equal(coordinator.getSnapshot().state, 'disposed')
    assert.equal(coordinator.getSnapshot().visibleOwnership.mode, 'replacement-persistent-catalog')
  }

  // Cancelling a fully staged handoff requires exact reverse compensation:
  // restore roots 261..258, then unpublish the replacement. Visibility remains
  // original-only throughout and a clean retry is allowed at revision zero.
  {
    const coordinator = new RepeatSixPartSourceOwnershipHandoffCoordinator(GENERATION)
    const preparation = coordinator.prepare(request(evidence))
    stageForward(coordinator, preparation)
    let rollback = coordinator.cancel(preparation.token, 'Test cancellation after full staging')
    assert.equal(rollback.rollbackPending, true)
    assert.equal(rollback.terminalAfterRollback, 'idle')
    const rollbackKinds = []
    const rollbackRoots = []
    const firstExpected = rollback.nextCommand
    const forged = { ...firstExpected, rollbackSequence: 99 }
    assertErrorCode(
      () => coordinator.acknowledgeRollbackOperation(rollbackReceipt(preparation, forged)),
      RepeatSixPartSourceOwnershipHandoffError,
      'INVALID_CONTRACT',
    )
    assert.strictEqual(
      coordinator.cancel(preparation.token, 'Ignored duplicate cancel').nextCommand,
      firstExpected,
    )
    while (rollback.rollbackPending) {
      const command = rollback.nextCommand
      rollbackKinds.push(command.kind)
      if (command.kind === 'restore-original-production-root') rollbackRoots.push(command.rootId)
      rollback = coordinator.acknowledgeRollbackOperation(rollbackReceipt(preparation, command))
      assert.equal(coordinator.getSnapshot().visibleOwnership.mode, 'original-production-roots')
      assert.equal(coordinator.getSnapshot().visibleOwnership.dualOwnershipVisible, false)
    }
    assert.deepEqual(rollbackKinds, [
      'restore-original-production-root',
      'restore-original-production-root',
      'restore-original-production-root',
      'restore-original-production-root',
      'unpublish-replacement',
    ])
    assert.deepEqual(rollbackRoots, ['scene/0/261', 'scene/0/260', 'scene/0/259', 'scene/0/258'])
    assert.equal(coordinator.getSnapshot().state, 'idle')
    assert.equal(coordinator.getSnapshot().ownershipRevision, 0)
    assert.equal(coordinator.getSnapshot().stagedOperationCount, 0)

    const retry = coordinator.prepare(request(evidence))
    assert.equal(retry.token.transactionSequence, 2)
    const cancelled = coordinator.cancel(retry.token, 'Cancel before any adapter work')
    assert.equal(cancelled.rollbackPending, false)
    assert.equal(cancelled.nextCommand, null)
    assert.equal(coordinator.getSnapshot().state, 'idle')
    assert.equal(coordinator.getObserverReceipts().at(-1).event, 'cancelled')
  }

  // Tokens are generation-, revision-, coordinator-, and transaction-bound.
  // Stale asynchronous work cannot advance or cancel a newer transaction.
  {
    const coordinator = new RepeatSixPartSourceOwnershipHandoffCoordinator(GENERATION)
    const preparation = coordinator.prepare(request(evidence))
    const staleGenerationToken = Object.freeze({ ...preparation.token, generation: GENERATION - 1 })
    assertErrorCode(
      () => coordinator.getNextForwardCommand(staleGenerationToken),
      StaleRepeatSixPartSourceOwnershipGenerationError,
      'STALE_GENERATION',
    )
    const other = new RepeatSixPartSourceOwnershipHandoffCoordinator(GENERATION)
    const otherPreparation = other.prepare(request(evidence))
    assertErrorCode(
      () => coordinator.getNextForwardCommand(otherPreparation.token),
      RepeatSixPartSourceOwnershipHandoffError,
      'TRANSACTION_STATE',
    )
    other.cancel(otherPreparation.token, 'Clean up foreign coordinator')
    coordinator.cancel(preparation.token, 'Clean up stale-token test')
  }

  // Disposal never abandons staged adapter work. It first demands the same
  // exact reverse rollback and becomes terminal only after every receipt.
  {
    const coordinator = new RepeatSixPartSourceOwnershipHandoffCoordinator(GENERATION)
    const preparation = coordinator.prepare(request(evidence))
    stageForward(coordinator, preparation, 2)
    const disposal = coordinator.dispose()
    assert.equal(disposal.kind, 'dispose-pending-rollback')
    assert.equal(disposal.disposed, false)
    let rollback = disposal.rollback
    assert.equal(rollback.terminalAfterRollback, 'disposed')
    assert.equal(coordinator.getSnapshot().disposed, false)
    while (rollback.rollbackPending) {
      rollback = coordinator.acknowledgeRollbackOperation(
        rollbackReceipt(preparation, rollback.nextCommand),
      )
    }
    assert.equal(coordinator.getSnapshot().state, 'disposed')
    assert.equal(coordinator.getSnapshot().disposed, true)
    assert.equal(coordinator.getSnapshot().visibleOwnership.mode, 'original-production-roots')
    assert.deepEqual(coordinator.dispose(), { kind: 'disposed', disposed: true, rollback: null })
    assertErrorCode(
      () => coordinator.prepare(request(evidence)),
      RepeatSixPartSourceOwnershipHandoffError,
      'DISPOSED',
    )

    const immediate = new RepeatSixPartSourceOwnershipHandoffCoordinator(GENERATION)
    const immediatePreparation = immediate.prepare(request(evidence))
    assert.equal(immediate.dispose().kind, 'disposed')
    assert.equal(immediate.getSnapshot().state, 'disposed')
    assertErrorCode(
      () => immediate.getNextForwardCommand(immediatePreparation.token),
      RepeatSixPartSourceOwnershipHandoffError,
      'DISPOSED',
    )
  }

  // A declared forward failure compensates staged work and then latches a
  // fail-stop. A rollback failure is stronger: visibility assurance is
  // withheld and no further operation is accepted.
  {
    const coordinator = new RepeatSixPartSourceOwnershipHandoffCoordinator(GENERATION)
    const preparation = coordinator.prepare(request(evidence))
    stageForward(coordinator, preparation, 2)
    let rollback = coordinator.failPreparedHandoff(preparation.token, 'Renderer publication failed')
    assert.equal(rollback.terminalAfterRollback, 'fail-stopped')
    while (rollback.rollbackPending) {
      rollback = coordinator.acknowledgeRollbackOperation(
        rollbackReceipt(preparation, rollback.nextCommand),
      )
    }
    assert.equal(coordinator.getSnapshot().state, 'fail-stopped')
    assert.equal(coordinator.getSnapshot().failStopped, true)
    assert.equal(coordinator.getSnapshot().visibilityAssured, true)
    assert.equal(coordinator.getSnapshot().visibleOwnership.mode, 'original-production-roots')
    assertErrorCode(
      () => coordinator.prepare(request(evidence)),
      RepeatSixPartSourceOwnershipHandoffError,
      'FAIL_STOPPED',
    )
    assert.equal(coordinator.getObserverReceipts().at(-1).event, 'fail-stopped')
  }

  {
    const coordinator = new RepeatSixPartSourceOwnershipHandoffCoordinator(GENERATION)
    const preparation = coordinator.prepare(request(evidence))
    stageForward(coordinator, preparation)
    const rollback = coordinator.cancel(preparation.token, 'Begin rollback-failure test')
    const failureReceipt = coordinator.reportRollbackFailure(
      preparation.token,
      rollback.nextCommand,
      'Adapter could not restore production root scene/0/261',
    )
    assert.equal(failureReceipt.event, 'rollback-failed')
    assert.equal(failureReceipt.visibilityAssured, false)
    assert.equal(coordinator.getSnapshot().state, 'fail-stopped')
    assert.equal(coordinator.getSnapshot().visibilityAssured, false)
    assert.equal(coordinator.getSnapshot().terminalReason, 'Adapter could not restore production root scene/0/261')
    assertErrorCode(
      () => coordinator.acknowledgeRollbackOperation(
        rollbackReceipt(preparation, rollback.nextCommand),
      ),
      RepeatSixPartSourceOwnershipHandoffError,
      'FAIL_STOPPED',
    )
  }

  built.registry.dispose()
  built.planner.dispose()

  console.log('Repeat six-part source-ownership handoff tests: PASS')
  console.log('  authoritative planner/registry evidence: PASS')
  console.log('  ordered stage replacement -> retire roots 258..261 -> atomic commit: PASS')
  console.log('  observer-visible dual ownership at commit: 0 states')
  console.log('  exact original roots retired: 4')
  console.log('  reverse rollback, cancellation, disposal, stale guards, fail-stop: PASS')
  console.log('  immutable observer receipts and cursor replay: PASS')
} finally {
  await vite.close()
}
