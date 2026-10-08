import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'
import { buildAuthoritativeEvidence } from './test-repeat-six-part-source-ownership-handoff.mjs'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = path.resolve(SCRIPT_DIR, '..')
const GENERATION = 41_000

function originalVisibility(rootIds) {
  return {
    mode: 'original-production-roots',
    originalProductionRootIds: [...rootIds],
    replacementOwnerId: null,
    dualOwnershipVisible: false,
  }
}

function replacementVisibility(replacementOwnerId) {
  return {
    mode: 'replacement-persistent-catalog',
    originalProductionRootIds: [],
    replacementOwnerId,
    dualOwnershipVisible: false,
  }
}

function expectedRetirementCount(snapshot) {
  if (!['staging-forward', 'ready-to-commit', 'rolling-back'].includes(snapshot.state)) return 0
  const staged = Math.max(0, snapshot.stagedOperationCount - 1)
  if (snapshot.state !== 'rolling-back') return staged
  return staged - Math.min(snapshot.nextRollbackSequence, staged)
}

function physicalEvidence(rootIds, replacementOwnerId, snapshot) {
  const committed = snapshot.state === 'committed'
  const staged = ['staging-forward', 'ready-to-commit', 'rolling-back'].includes(snapshot.state)
  const retirementCount = expectedRetirementCount(snapshot)
  return {
    roots: rootIds.map((rootId, index) => ({
      rootId,
      resolvedNodeCount: 1,
      lifecycle: committed
        ? 'retired-after-atomic-commit'
        : index < retirementCount
          ? 'retirement-staged'
          : 'active-original',
      rendererVisible: !committed,
    })),
    replacement: {
      ownerId: replacementOwnerId,
      persistentListCount: 48,
      physicalUnitCapacity: 1_872,
      lifecycle: committed
        ? 'committed-visible-owner'
        : staged
          ? 'publication-staged'
          : 'unpublished',
      rendererVisible: committed,
    },
  }
}

function observation(guard, rootIds, replacementOwnerId, sampleSequence, snapshot, physical) {
  const evidence = physical ?? physicalEvidence(rootIds, replacementOwnerId, snapshot)
  return {
    kind: 'repeat-six-part-runtime-ownership-observation',
    guard,
    sampleSequence,
    handoffSnapshot: snapshot,
    originalRoots: evidence.roots,
    replacement: evidence.replacement,
  }
}

function handoffRequest(evidence) {
  return { generation: GENERATION, ownershipRevision: 0, evidence }
}

function stagedReceipt(preparation, command) {
  return {
    kind: 'repeat-six-part-staged-operation-receipt',
    token: preparation.token,
    command,
    generation: preparation.token.generation,
    ownershipBaseRevision: preparation.token.ownershipBaseRevision,
    outcome: 'staged-not-observer-visible',
  }
}

function rollbackReceipt(preparation, command) {
  return {
    kind: 'repeat-six-part-rollback-operation-receipt',
    token: preparation.token,
    command,
    generation: preparation.token.generation,
    ownershipBaseRevision: preparation.token.ownershipBaseRevision,
    outcome: 'rolled-back-staged-operation',
  }
}

function atomicCommitReceipt(preparation, command, rootIds, replacementOwnerId) {
  return {
    kind: 'repeat-six-part-atomic-ownership-commit-receipt',
    token: preparation.token,
    command,
    generation: preparation.token.generation,
    ownershipBaseRevision: preparation.token.ownershipBaseRevision,
    committedAtomically: true,
    operationOrder: [
      `publish:${replacementOwnerId}`,
      ...rootIds.map((rootId) => `retire:${rootId}`),
      'commit:atomic-ownership-replacement',
    ],
    retiredOriginalRootIds: [...rootIds],
    observerVisibleBefore: originalVisibility(rootIds),
    observerVisibleAfter: replacementVisibility(replacementOwnerId),
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
  const observerModule = await vite.ssrLoadModule('/src/scene/RepeatSixPartRuntimeSourceOwnershipObserver.ts')
  const { RepeatSixPartOfflineActiveListKernel } = plannerModule
  const { LogicalSegmentIdentityRegistry } = registryModule
  const {
    REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS: ROOT_IDS,
    REPEAT_SIX_PART_REPLACEMENT_OWNER_ID: REPLACEMENT_OWNER_ID,
    RepeatSixPartSourceOwnershipHandoffCoordinator,
    areIssuedRepeatSixPartSourceOwnershipEvidenceFromSameCoordinator,
    isIssuedRepeatSixPartSourceOwnershipHandoffSnapshot,
    isIssuedRepeatSixPartSourceOwnershipHandoffToken,
  } = handoffModule
  const {
    RepeatSixPartRuntimeSourceOwnershipObserver,
    RepeatSixPartRuntimeOwnershipObserverError,
    isIssuedRepeatSixPartRuntimeOwnershipObservationGuard,
  } = observerModule

  const built = buildAuthoritativeEvidence(
    RepeatSixPartOfflineActiveListKernel,
    LogicalSegmentIdentityRegistry,
  )
  const { evidence } = built
  const prepare = () => {
    const coordinator = new RepeatSixPartSourceOwnershipHandoffCoordinator(GENERATION)
    const preparation = coordinator.prepare(handoffRequest(evidence))
    return { coordinator, preparation }
  }
  const stageNext = (coordinator, preparation) => {
    const command = coordinator.getNextForwardCommand(preparation.token)
    assert.notEqual(command.kind, 'commit-atomic-ownership-replacement')
    coordinator.acknowledgeStagedOperation(stagedReceipt(preparation, command))
    return coordinator.getSnapshot()
  }

  assert.deepEqual(ROOT_IDS, ['scene/0/258', 'scene/0/259', 'scene/0/260', 'scene/0/261'])

  // Exact forward path, including authentic token/snapshot provenance.
  {
    const { coordinator, preparation } = prepare()
    const observer = new RepeatSixPartRuntimeSourceOwnershipObserver(GENERATION)
    const guard = observer.issueGuard(preparation.token)
    assert.equal(isIssuedRepeatSixPartSourceOwnershipHandoffToken(preparation.token), true)
    assert.equal(isIssuedRepeatSixPartRuntimeOwnershipObservationGuard(guard), true)
    assert.equal(guard.activationCapability, null)

    let sampleSequence = 1
    let snapshot = coordinator.getSnapshot()
    assert.equal(isIssuedRepeatSixPartSourceOwnershipHandoffSnapshot(snapshot), true)
    assert.equal(
      areIssuedRepeatSixPartSourceOwnershipEvidenceFromSameCoordinator(preparation.token, snapshot),
      true,
    )
    const accepted = [observer.observe(observation(
      guard, ROOT_IDS, REPLACEMENT_OWNER_ID, sampleSequence, snapshot,
    ))]
    for (let stagedCount = 1; stagedCount <= 5; stagedCount += 1) {
      snapshot = stageNext(coordinator, preparation)
      sampleSequence += 1
      const receipt = observer.observe(observation(
        guard, ROOT_IDS, REPLACEMENT_OWNER_ID, sampleSequence, snapshot,
      ))
      accepted.push(receipt)
      assert.equal(receipt.visibleOwnership.mode, 'original-production-roots')
      assert.ok(receipt.originalRoots.every((root) => root.rendererVisible))
      assert.equal(receipt.replacement.rendererVisible, false)
    }
    const commitCommand = coordinator.getNextForwardCommand(preparation.token)
    coordinator.commit(atomicCommitReceipt(preparation, commitCommand, ROOT_IDS, REPLACEMENT_OWNER_ID))
    snapshot = coordinator.getSnapshot()
    sampleSequence += 1
    const committed = observer.observe(observation(
      guard, ROOT_IDS, REPLACEMENT_OWNER_ID, sampleSequence, snapshot,
    ))
    accepted.push(committed)
    assert.equal(committed.phase, 'committed-replacement-owner')
    assert.equal(committed.visibleOwnerCount, 1)
    assert.equal(committed.visibleOwnership.mode, 'replacement-persistent-catalog')
    assert.ok(committed.originalRoots.every((root) => !root.rendererVisible))
    assert.equal(committed.replacement.rendererVisible, true)
    assert.equal(committed.activationAuthorized, false)
    assert.equal(committed.activationCapability, null)
    assertDeepFrozen(committed)
    assert.deepEqual(observer.getSnapshot(), {
      generation: GENERATION,
      ownershipRevision: 1,
      status: 'committed-replacement-owner',
      visibleOwnership: replacementVisibility(REPLACEMENT_OWNER_ID),
      activeTransactionSequence: null,
      lastTransactionSequence: 1,
      lastSampleSequence: 7,
      evidenceReceiptCount: 7,
      disposed: false,
      activationCapable: false,
      activationCapability: null,
    })
    assert.deepEqual(observer.getEvidence(5).map((entry) => entry.evidenceSequence), [6, 7])
    assert.equal(accepted.filter((entry) => entry.visibleOwnerCount !== 1).length, 0)
  }

  // Full reverse rollback: restore 261..258, then unpublish replacement.
  {
    const { coordinator, preparation } = prepare()
    const observer = new RepeatSixPartRuntimeSourceOwnershipObserver(GENERATION)
    const guard = observer.issueGuard(preparation.token)
    let sampleSequence = 1
    observer.observe(observation(
      guard, ROOT_IDS, REPLACEMENT_OWNER_ID, sampleSequence, coordinator.getSnapshot(),
    ))
    for (let stagedCount = 1; stagedCount <= 5; stagedCount += 1) {
      const snapshot = stageNext(coordinator, preparation)
      sampleSequence += 1
      observer.observe(observation(
        guard, ROOT_IDS, REPLACEMENT_OWNER_ID, sampleSequence, snapshot,
      ))
    }
    let rollback = coordinator.cancel(preparation.token, 'Observer rollback test')
    let snapshot = coordinator.getSnapshot()
    sampleSequence += 1
    observer.observe(observation(
      guard, ROOT_IDS, REPLACEMENT_OWNER_ID, sampleSequence, snapshot,
    ))
    while (rollback.rollbackPending) {
      rollback = coordinator.acknowledgeRollbackOperation(
        rollbackReceipt(preparation, rollback.nextCommand),
      )
      snapshot = coordinator.getSnapshot()
      sampleSequence += 1
      const receipt = observer.observe(observation(
        guard, ROOT_IDS, REPLACEMENT_OWNER_ID, sampleSequence, snapshot,
      ))
      assert.equal(receipt.visibleOwnership.mode, 'original-production-roots')
      assert.ok(receipt.originalRoots.every((root) => root.rendererVisible))
      assert.equal(receipt.replacement.rendererVisible, false)
    }
    assert.equal(snapshot.state, 'idle')
    assert.equal(observer.getSnapshot().status, 'idle-original-owner')
    assert.equal(observer.getSnapshot().ownershipRevision, 0)

    const retryPreparation = coordinator.prepare(handoffRequest(evidence))
    const retryGuard = observer.issueGuard(retryPreparation.token)
    assert.equal(retryGuard.transactionSequence, 2)
    observer.observe(observation(
      retryGuard, ROOT_IDS, REPLACEMENT_OWNER_ID, 1, coordinator.getSnapshot(),
    ))
    coordinator.cancel(retryPreparation.token, 'Immediate retry cancellation')
    observer.observe(observation(
      retryGuard, ROOT_IDS, REPLACEMENT_OWNER_ID, 2, coordinator.getSnapshot(),
    ))
    observer.dispose()
    assert.equal(observer.getSnapshot().disposed, true)
  }

  // Caller mutation cannot rewrite accepted evidence.
  {
    const { coordinator, preparation } = prepare()
    const observer = new RepeatSixPartRuntimeSourceOwnershipObserver(GENERATION)
    const guard = observer.issueGuard(preparation.token)
    const snapshot = coordinator.getSnapshot()
    const value = observation(guard, ROOT_IDS, REPLACEMENT_OWNER_ID, 1, snapshot)
    const receipt = observer.observe(value)
    value.originalRoots[0].rendererVisible = false
    value.originalRoots.reverse()
    assert.equal(receipt.originalRoots[0].rootId, ROOT_IDS[0])
    assert.equal(receipt.originalRoots[0].rendererVisible, true)
    assertDeepFrozen(receipt)
  }

  // Structural token/snapshot clones and mixed-coordinator evidence are not
  // authoritative, even when all scalar values match.
  {
    const first = prepare()
    const second = prepare()
    const observer = new RepeatSixPartRuntimeSourceOwnershipObserver(GENERATION)
    assertErrorCode(
      () => observer.issueGuard(structuredClone(first.preparation.token)),
      RepeatSixPartRuntimeOwnershipObserverError,
      'INVALID_CONTRACT',
    )
    const guard = observer.issueGuard(first.preparation.token)
    assertErrorCode(
      () => observer.observe(observation(
        guard,
        ROOT_IDS,
        REPLACEMENT_OWNER_ID,
        1,
        structuredClone(first.coordinator.getSnapshot()),
      )),
      RepeatSixPartRuntimeOwnershipObserverError,
      'INVALID_CONTRACT',
    )
    assertErrorCode(
      () => observer.observe(observation(
        guard,
        ROOT_IDS,
        REPLACEMENT_OWNER_ID,
        1,
        second.coordinator.getSnapshot(),
      )),
      RepeatSixPartRuntimeOwnershipObserverError,
      'INVALID_CONTRACT',
    )
    assert.equal(observer.getSnapshot().evidenceReceiptCount, 0)
  }

  // Authentic tokens are still rejected by stale observer generation/revision
  // guards, and a structural observation guard clone is never accepted.
  {
    const { coordinator, preparation } = prepare()
    assertErrorCode(
      () => new RepeatSixPartRuntimeSourceOwnershipObserver(GENERATION - 1).issueGuard(preparation.token),
      RepeatSixPartRuntimeOwnershipObserverError,
      'STALE_GENERATION',
    )
    assertErrorCode(
      () => new RepeatSixPartRuntimeSourceOwnershipObserver(GENERATION, 1).issueGuard(preparation.token),
      RepeatSixPartRuntimeOwnershipObserverError,
      'STALE_REVISION',
    )
    const observer = new RepeatSixPartRuntimeSourceOwnershipObserver(GENERATION)
    const guard = observer.issueGuard(preparation.token)
    assertErrorCode(
      () => observer.observe(observation(
        { ...guard }, ROOT_IDS, REPLACEMENT_OWNER_ID, 1, coordinator.getSnapshot(),
      )),
      RepeatSixPartRuntimeOwnershipObserverError,
      'GUARD_STATE',
    )
    assertErrorCode(
      () => observer.observe(observation(
        guard, ROOT_IDS, REPLACEMENT_OWNER_ID, 2, coordinator.getSnapshot(),
      )),
      RepeatSixPartRuntimeOwnershipObserverError,
      'STALE_SAMPLE',
    )
  }

  // Zero, dual, partial, duplicate, missing and lifecycle-inconsistent owner
  // samples fail against an otherwise authentic prepared snapshot.
  {
    const invalidCases = [
      ['INVALID_OWNERSHIP', (value) => {
        for (const root of value.originalRoots) root.rendererVisible = false
      }],
      ['INVALID_OWNERSHIP', (value) => { value.replacement.rendererVisible = true }],
      ['INVALID_OWNERSHIP', (value) => { value.originalRoots[0].rendererVisible = false }],
      ['INVALID_CONTRACT', (value) => { value.originalRoots[1].rootId = ROOT_IDS[0] }],
      ['INVALID_CONTRACT', (value) => { value.originalRoots.pop() }],
      ['INVALID_OWNERSHIP', (value) => { value.originalRoots[0].resolvedNodeCount = 2 }],
      ['INVALID_TRANSITION', (value) => { value.originalRoots[0].lifecycle = 'retirement-staged' }],
      ['INVALID_CONTRACT', (value) => { value.replacement.persistentListCount = 47 }],
    ]
    for (const [code, mutate] of invalidCases) {
      const { coordinator, preparation } = prepare()
      const observer = new RepeatSixPartRuntimeSourceOwnershipObserver(GENERATION)
      const guard = observer.issueGuard(preparation.token)
      const value = observation(
        guard, ROOT_IDS, REPLACEMENT_OWNER_ID, 1, coordinator.getSnapshot(),
      )
      mutate(value)
      assertErrorCode(
        () => observer.observe(value),
        RepeatSixPartRuntimeOwnershipObserverError,
        code,
      )
      assert.equal(observer.getSnapshot().evidenceReceiptCount, 0)
    }
  }

  // Omitting an intermediate forward or rollback witness is rejected even
  // though the later handoff snapshot itself is authentic.
  {
    const { coordinator, preparation } = prepare()
    const observer = new RepeatSixPartRuntimeSourceOwnershipObserver(GENERATION)
    const guard = observer.issueGuard(preparation.token)
    observer.observe(observation(
      guard, ROOT_IDS, REPLACEMENT_OWNER_ID, 1, coordinator.getSnapshot(),
    ))
    stageNext(coordinator, preparation)
    const skippedSnapshot = stageNext(coordinator, preparation)
    assertErrorCode(
      () => observer.observe(observation(
        guard, ROOT_IDS, REPLACEMENT_OWNER_ID, 2, skippedSnapshot,
      )),
      RepeatSixPartRuntimeOwnershipObserverError,
      'INVALID_TRANSITION',
    )
  }

  {
    const { coordinator, preparation } = prepare()
    const observer = new RepeatSixPartRuntimeSourceOwnershipObserver(GENERATION)
    const guard = observer.issueGuard(preparation.token)
    let sequence = 1
    observer.observe(observation(
      guard, ROOT_IDS, REPLACEMENT_OWNER_ID, sequence, coordinator.getSnapshot(),
    ))
    for (let count = 1; count <= 3; count += 1) {
      sequence += 1
      observer.observe(observation(
        guard, ROOT_IDS, REPLACEMENT_OWNER_ID, sequence, stageNext(coordinator, preparation),
      ))
    }
    let rollback = coordinator.cancel(preparation.token, 'Rollback cursor test')
    sequence += 1
    observer.observe(observation(
      guard, ROOT_IDS, REPLACEMENT_OWNER_ID, sequence, coordinator.getSnapshot(),
    ))
    rollback = coordinator.acknowledgeRollbackOperation(
      rollbackReceipt(preparation, rollback.nextCommand),
    )
    rollback = coordinator.acknowledgeRollbackOperation(
      rollbackReceipt(preparation, rollback.nextCommand),
    )
    assert.equal(rollback.rollbackPending, true)
    assertErrorCode(
      () => observer.observe(observation(
        guard, ROOT_IDS, REPLACEMENT_OWNER_ID, sequence + 1, coordinator.getSnapshot(),
      )),
      RepeatSixPartRuntimeOwnershipObserverError,
      'INVALID_TRANSITION',
    )
  }

  built.registry.dispose()
  built.planner.dispose()

  console.log('Repeat six-part runtime source-ownership observer tests: PASS')
  console.log('  exact production roots observed: scene/0/258..261')
  console.log('  authentic prepared/staged/retired/commit/rollback lifecycle: PASS')
  console.log('  zero-owner, dual-owner, and partial-owner accepted states: 0')
  console.log('  forged token/snapshot/guard and mixed-coordinator accepted states: 0')
  console.log('  immutable evidence and activation-incapable contract: PASS')
} finally {
  await vite.close()
}
