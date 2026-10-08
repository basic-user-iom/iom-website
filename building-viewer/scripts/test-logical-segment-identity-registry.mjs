import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const vite = await createServer({
  root: join(SCRIPT_DIR, '..'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

const SEGMENTS = Array.from({ length: 6 }, (_, index) => `segment-${index}`)

function catalog(sourceCount, handlesPerSegment, activityFor = () => 'active') {
  return Array.from({ length: sourceCount }, (_, sourceId) => ({
    sourceId,
    segments: SEGMENTS.map((segmentId, segmentIndex) => ({
      segmentId,
      bounds: {
        min: [sourceId * 10 + segmentIndex, segmentIndex, -segmentIndex],
        max: [sourceId * 10 + segmentIndex + 0.5, segmentIndex + 1, -segmentIndex + 0.25],
      },
      expectedHandles: Array.from({ length: handlesPerSegment }, (_, handleIndex) => ({
        handleId: `material-${handleIndex}`,
        activity: activityFor(sourceId, segmentIndex, handleIndex),
      })),
    })),
  }))
}

class FakeHandle {
  states = []
  failNext = false
  failuresRemaining = 0

  applyLogicalSegmentState(state) {
    this.states.push(structuredClone(state))
    if (this.failNext || this.failuresRemaining > 0) {
      this.failNext = false
      this.failuresRemaining = Math.max(0, this.failuresRemaining - 1)
      throw new Error('synthetic adapter failure')
    }
  }

  get current() {
    return this.states.at(-1)
  }
}

function everyPhysical(registry, sourceCount, handlesPerSegment) {
  const result = []
  for (let sourceId = 0; sourceId < sourceCount; sourceId += 1) {
    for (let segmentIndex = 0; segmentIndex < SEGMENTS.length; segmentIndex += 1) {
      for (let handleIndex = 0; handleIndex < handlesPerSegment; handleIndex += 1) {
        result.push({
          sourceId,
          segmentIndex,
          handleIndex,
          physicalKey: registry.physicalKeyFor(
            sourceId,
            SEGMENTS[segmentIndex],
            `material-${handleIndex}`,
          ),
          placement: {
            batchId: `segment-${segmentIndex}/material-${handleIndex}`,
            slot: sourceId,
          },
        })
      }
    }
  }
  return result
}

function stageItems(registry, transaction, items, handlesByKey) {
  for (const item of items) {
    const handle = new FakeHandle()
    handlesByKey.set(item.physicalKey, handle)
    registry.stageHandle(transaction, {
      physicalKey: item.physicalKey,
      handle,
      placement: item.placement,
    })
  }
}

function recordsByPhysical(registrations) {
  return new Map(registrations.map((registration) => [registration.physicalKey, registration]))
}

function rowHandles(registry, handlesByKey, sourceId, handlesPerSegment) {
  return everyPhysical(registry, sourceId + 1, handlesPerSegment)
    .filter((item) => item.sourceId === sourceId)
    .map((item) => handlesByKey.get(item.physicalKey))
    .filter(Boolean)
}

try {
  const {
    IncompleteLogicalSegmentCohortError,
    LogicalSegmentIdentityRegistry,
    PartialLogicalSegmentActivityError,
    StaleLogicalSegmentGenerationError,
    StaleLogicalSegmentRevisionError,
    createLogicalSegmentLogicalKey,
    createLogicalSegmentKey,
    createLogicalSegmentPhysicalKey,
  } = await vite.ssrLoadModule('/src/scene/LogicalSegmentIdentityRegistry.ts')

  assert.throws(
    () => new LogicalSegmentIdentityRegistry({
      layerGeneration: 1,
      domainId: 'invalid-material-activity',
      sources: catalog(1, 4, (_source, _segment, handle) => handle === 0 ? 'active' : 'culled'),
    }),
    PartialLogicalSegmentActivityError,
    'material handles in one segment may not carry independent activity',
  )

  // Full catalog shape: 78 logical rows x six exact geometry segments x four
  // material handles. Identity remains stable while presentation and placement
  // change, and selection bounds are the union of all six segment bounds.
  {
    const registry = new LogicalSegmentIdentityRegistry({
      layerGeneration: 7,
      domainId: 'ground-floor-repeat',
      sources: catalog(78, 4),
    })
    assert.deepEqual(registry.getSnapshot(), {
      layerGeneration: 7,
      domainId: 'ground-floor-repeat',
      revision: 0,
      disposed: false,
      logicalSources: 78,
      segments: 468,
      expectedPhysicalUnits: 1872,
      activePhysicalUnits: 1872,
      culledPhysicalUnits: 0,
      registeredHandles: 0,
      completeLogicalSources: 0,
      incompleteLogicalSources: 78,
      hiddenLogicalSources: 0,
      selectedLogicalSources: 0,
      highlightedLogicalSources: 0,
      isolationActive: false,
    })

    const identity = { layerGeneration: 7, domainId: 'ground-floor-repeat', sourceId: 0 }
    const logicalKey0 = registry.logicalKeyFor(0)
    const logicalKey77 = registry.logicalKeyFor(77)
    const segmentKey0 = registry.segmentKeyFor(0, SEGMENTS[0])
    const physicalKey0 = registry.physicalKeyFor(0, SEGMENTS[0], 'material-0')
    assert.equal(logicalKey0, createLogicalSegmentLogicalKey(identity))
    assert.equal(segmentKey0, createLogicalSegmentKey(identity, SEGMENTS[0]))
    assert.equal(physicalKey0, createLogicalSegmentPhysicalKey(identity, SEGMENTS[0], 'material-0'))
    assert.notEqual(
      createLogicalSegmentLogicalKey({ ...identity, sourceId: '0' }),
      logicalKey0,
      'numeric and string source IDs must never collide',
    )
    assert.notEqual(
      createLogicalSegmentLogicalKey({ ...identity, layerGeneration: 8 }),
      logicalKey0,
      'a new layer generation must receive a new logical identity',
    )

    const items = everyPhysical(registry, 78, 4)
    assert.equal(new Set(items.map((item) => item.physicalKey)).size, 1872)
    const handlesByKey = new Map()
    const transaction = registry.beginHandleRegistration()
    stageItems(registry, transaction, items, handlesByKey)
    const registrations = registry.commitHandles(transaction)
    const registrationByKey = recordsByPhysical(registrations)
    assert.equal(registrations.length, 1872)
    assert.equal(rowHandles(registry, handlesByKey, 0, 4).length, 24)
    assert.deepEqual(
      registry.getSnapshot(),
      {
        layerGeneration: 7,
        domainId: 'ground-floor-repeat',
        revision: 1,
        disposed: false,
        logicalSources: 78,
        segments: 468,
        expectedPhysicalUnits: 1872,
        activePhysicalUnits: 1872,
        culledPhysicalUnits: 0,
        registeredHandles: 1872,
        completeLogicalSources: 78,
        incompleteLogicalSources: 0,
        hiddenLogicalSources: 0,
        selectedLogicalSources: 0,
        highlightedLogicalSources: 0,
        isolationActive: false,
      },
    )
    assert.ok([...handlesByKey.values()].every((handle) =>
      handle.current.visible && handle.current.cohortComplete && handle.current.activity === 'active'))

    assert.deepEqual(registry.getLogicalBounds(logicalKey0), {
      min: [0, 0, -5],
      max: [5.5, 6, 0.25],
    })
    assert.deepEqual(registry.select(logicalKey0), {
      min: [0, 0, -5],
      max: [5.5, 6, 0.25],
    })
    assert.ok(rowHandles(registry, handlesByKey, 0, 4).every((handle) =>
      handle.current.selected && handle.current.highlighted))
    assert.deepEqual(registry.highlight([logicalKey0, logicalKey77]), {
      min: [0, 0, -5],
      max: [775.5, 6, 0.25],
    })

    registry.hide(logicalKey0)
    assert.ok(rowHandles(registry, handlesByKey, 0, 4).every((handle) =>
      handle.current.hidden && !handle.current.visible && !handle.current.highlighted))
    registry.isolate(logicalKey77)
    assert.ok(rowHandles(registry, handlesByKey, 1, 4).every((handle) =>
      handle.current.isolationActive && !handle.current.isolated && !handle.current.visible))
    assert.ok(rowHandles(registry, handlesByKey, 77, 4).every((handle) =>
      handle.current.isolationActive && handle.current.isolated && handle.current.visible))
    registry.restore()
    assert.ok(rowHandles(registry, handlesByKey, 0, 4).every((handle) =>
      !handle.current.hidden && !handle.current.isolationActive && handle.current.visible))
    registry.clearSelection()
    registry.clearHighlight()

    // A compaction may atomically swap occupied slots and change batch IDs.
    // Neither operation changes the logical, segment, or physical identity.
    const keyA = registry.physicalKeyFor(0, SEGMENTS[0], 'material-0')
    const keyB = registry.physicalKeyFor(1, SEGMENTS[0], 'material-0')
    const keyC = registry.physicalKeyFor(0, SEGMENTS[0], 'material-1')
    const staleGuard = registry.getMutationGuard()
    registry.remapHandlePlacements([
      { registration: registrationByKey.get(keyA), placement: { batchId: 'segment-0/material-0', slot: 1 } },
      { registration: registrationByKey.get(keyB), placement: { batchId: 'segment-0/material-0', slot: 0 } },
      { registration: registrationByKey.get(keyC), placement: { batchId: 'compacted/segment-0/material-1', slot: 0 } },
    ])
    assert.equal(registry.physicalKeyFor(0, SEGMENTS[0], 'material-0'), keyA)
    assert.deepEqual(registry.getPhysicalUnitState(keyA).placement, {
      batchId: 'segment-0/material-0', slot: 1,
    })
    assert.deepEqual(registry.getPhysicalUnitState(keyB).placement, {
      batchId: 'segment-0/material-0', slot: 0,
    })
    assert.deepEqual(registry.getPhysicalUnitState(keyC).placement, {
      batchId: 'compacted/segment-0/material-1', slot: 0,
    })
    // The occupancy index must survive an atomic A<->B slot swap. Free an
    // unrelated registration and prove that A's destination is still reserved.
    const keyD = registry.physicalKeyFor(0, SEGMENTS[0], 'material-2')
    const registrationD = registrationByKey.get(keyD)
    const placementD = registry.getPhysicalUnitState(keyD).placement
    registry.unregisterHandle(registrationD)
    assert.throws(() => registry.registerHandle({
      physicalKey: keyD,
      handle: new FakeHandle(),
      placement: { batchId: 'segment-0/material-0', slot: 1 },
    }), /already occupied/)
    const replacementD = new FakeHandle()
    registry.registerHandle({ physicalKey: keyD, handle: replacementD, placement: placementD })
    handlesByKey.set(keyD, replacementD)
    assert.throws(() => registry.hide(logicalKey0, staleGuard), StaleLogicalSegmentRevisionError)
    assert.throws(
      () => registry.hide(logicalKey0, { layerGeneration: 6, revision: registry.revision }),
      StaleLogicalSegmentGenerationError,
    )

    // Removing one active mapping suppresses every remaining mapping in that
    // logical row. No select/hide action is allowed to operate on the partial
    // cohort. Re-registration republishes the complete row.
    const oldRegistration = registrationByKey.get(keyA)
    assert.equal(registry.unregisterHandle(oldRegistration), true)
    assert.equal(registry.unregisterHandle(oldRegistration), false)
    assert.ok(rowHandles(registry, handlesByKey, 0, 4)
      .filter((handle) => handle !== handlesByKey.get(keyA))
      .every((handle) => !handle.current.visible && !handle.current.cohortComplete))
    const beforeRejectedAction = registry.getSnapshot()
    assert.throws(() => registry.hide(logicalKey0), IncompleteLogicalSegmentCohortError)
    assert.deepEqual(registry.getSnapshot(), beforeRejectedAction)

    const replacement = new FakeHandle()
    const replacementRegistration = registry.registerHandle({
      physicalKey: keyA,
      handle: replacement,
      placement: { batchId: 'segment-0/material-0', slot: 1 },
    })
    handlesByKey.set(keyA, replacement)
    assert.equal(replacement.current.cohortComplete, true)
    assert.equal(replacement.current.visible, true)
    assert.ok(rowHandles(registry, handlesByKey, 0, 4).every((handle) => handle.current.visible))

    registry.dispose()
    registry.dispose()
    assert.equal(registry.unregisterHandle(replacementRegistration), false)
    assert.equal(registry.getSnapshot().disposed, true)
    assert.equal(registry.getSnapshot().registeredHandles, 0)
    assert.ok([...handlesByKey.values()].every((handle) => handle.current.visible === false))
    assert.throws(() => registry.beginHandleRegistration(), /disposed/)
  }

  // Single-row 24-handle cohort with mixed active/culled units. Culled units
  // do not block completeness, remain non-rendering if resident, and inherit
  // current hide/isolate state when their handles arrive in the future.
  {
    const registry = new LogicalSegmentIdentityRegistry({
      layerGeneration: 3,
      domainId: 'mixed-row',
      sources: catalog(1, 4, (_source, segment) => segment === 5 ? 'culled' : 'active'),
    })
    const items = everyPhysical(registry, 1, 4)
    const activeItems = items.filter((item) => item.segmentIndex !== 5)
    const culledItems = items.filter((item) => item.segmentIndex === 5)
    const handlesByKey = new Map()
    const activeTx = registry.beginHandleRegistration()
    stageItems(registry, activeTx, activeItems, handlesByKey)
    const activeRegistrations = registry.commitHandles(activeTx)
    assert.equal(activeRegistrations.length, 20)
    assert.deepEqual(
      { active: registry.getSnapshot().activePhysicalUnits, culled: registry.getSnapshot().culledPhysicalUnits,
        complete: registry.getSnapshot().completeLogicalSources },
      { active: 20, culled: 4, complete: 1 },
    )
    assert.ok([...handlesByKey.values()].every((handle) => handle.current.visible))

    const logicalKey = registry.logicalKeyFor(0)
    const activeFiveSegmentBounds = {
      min: [0, 0, -4],
      max: [4.5, 5, 0.25],
    }
    assert.deepEqual(
      registry.getActiveVisibleBounds(logicalKey),
      activeFiveSegmentBounds,
      'a segment bound must contribute once when active, and not at all when fully culled',
    )
    assert.deepEqual(registry.select(logicalKey), activeFiveSegmentBounds)
    registry.hide(logicalKey)
    assert.equal(registry.getActiveVisibleBounds(logicalKey), null)
    assert.equal(registry.highlight(logicalKey), null, 'hidden selection/highlight framing must be empty')
    const culledTx = registry.beginHandleRegistration()
    stageItems(registry, culledTx, culledItems, handlesByKey)
    const culledRegistrations = registry.commitHandles(culledTx)
    assert.equal(culledRegistrations.length, 4)
    assert.ok(culledItems.every((item) => {
      const state = handlesByKey.get(item.physicalKey).current
      return state.activity === 'culled' && state.hidden && !state.visible
    }))
    registry.setPhysicalUnitActivities(culledItems.map((item) => ({
      physicalKey: item.physicalKey,
      activity: 'active',
    })))
    assert.ok([...handlesByKey.values()].every((handle) => handle.current.hidden && !handle.current.visible))
    registry.restore()
    assert.ok([...handlesByKey.values()].every((handle) => handle.current.visible))

    // Adapter failure rolls the physical presentation back and leaves the
    // logical revision/state untouched.
    const failingHandle = handlesByKey.get(items[12].physicalKey)
    failingHandle.failNext = true
    const beforeFailedHide = registry.getSnapshot()
    assert.throws(() => registry.hide(logicalKey), /synthetic adapter failure/)
    assert.deepEqual(registry.getSnapshot(), beforeFailedHide)
    assert.ok([...handlesByKey.values()].every((handle) => handle.current.visible))

    registry.hide(logicalKey)
    const removedItem = items[0]
    const removedSegmentItems = items.filter((item) => item.segmentIndex === removedItem.segmentIndex)
    const registrationByKey = recordsByPhysical([...activeRegistrations, ...culledRegistrations])
    const removedRegistration = registrationByKey.get(removedItem.physicalKey)
    registry.setPhysicalUnitActivities(removedSegmentItems.map((item) => ({
      physicalKey: item.physicalKey,
      activity: 'culled',
    })))
    registry.unregisterHandle(removedRegistration)
    registry.show(logicalKey)
    assert.equal(registry.getSnapshot().completeLogicalSources, 1)
    registry.hide(logicalKey)
    const beforeMissingActivation = registry.getSnapshot()
    assert.throws(
      () => registry.setPhysicalUnitActivities([{
        physicalKey: removedItem.physicalKey,
        activity: 'active',
      }]),
      PartialLogicalSegmentActivityError,
    )
    assert.deepEqual(
      registry.getSnapshot(),
      beforeMissingActivation,
      'single-material activity mutation must be atomic and must not advance revision',
    )
    assert.equal(registry.getPhysicalUnitState(removedItem.physicalKey).activity, 'culled')
    assert.throws(
      () => registry.setPhysicalUnitActivities(removedSegmentItems.map((item) => ({
        physicalKey: item.physicalKey,
        activity: 'active',
      }))),
      IncompleteLogicalSegmentCohortError,
    )
    assert.deepEqual(
      registry.getSnapshot(),
      beforeMissingActivation,
      'whole-segment activation with one missing handle must not advance revision',
    )

    const futureHandle = new FakeHandle()
    registry.registerHandle({
      physicalKey: removedItem.physicalKey,
      handle: futureHandle,
      placement: removedItem.placement,
    })
    handlesByKey.set(removedItem.physicalKey, futureHandle)
    assert.equal(futureHandle.current.cohortComplete, true)
    assert.equal(futureHandle.current.hidden, true)
    assert.equal(futureHandle.current.visible, false)
    assert.equal(futureHandle.current.activity, 'culled')
    registry.setPhysicalUnitActivities(removedSegmentItems.map((item) => ({
      physicalKey: item.physicalKey,
      activity: 'active',
    })))
    assert.equal(futureHandle.current.activity, 'active')
    assert.equal(futureHandle.current.hidden, true)
    assert.equal(futureHandle.current.visible, false)
    registry.restore()
    assert.ok([...handlesByKey.values()].every((handle) => handle.current.visible))
    registry.dispose()
  }

  // A compacted-list publication replaces every placement, every activity,
  // and presentation in one registry revision. Partial plans fail closed;
  // adapter failure rolls back; rollback failure is surfaced as AggregateError
  // while the registry's authoritative model and guard remain unchanged.
  {
    const registry = new LogicalSegmentIdentityRegistry({
      layerGeneration: 23,
      domainId: 'atomic-compacted-plan',
      sources: catalog(2, 4),
    })
    const items = everyPhysical(registry, 2, 4)
    const handlesByKey = new Map()
    const registrationTx = registry.beginHandleRegistration()
    stageItems(registry, registrationTx, items, handlesByKey)
    const registrations = registry.commitHandles(registrationTx)
    const registrationsByKey = recordsByPhysical(registrations)
    const logical0 = registry.logicalKeyFor(0)
    const logical1 = registry.logicalKeyFor(1)
    const beforePlanGuard = registry.getMutationGuard()

    const makePlan = ({ swapped, cullSource0LastSegment, presentation }) => ({
      placements: items.map((item) => ({
        registration: registrationsByKey.get(item.physicalKey),
        placement: {
          batchId: item.placement.batchId,
          slot: swapped ? 1 - item.sourceId : item.sourceId,
        },
      })),
      activities: items.map((item) => ({
        physicalKey: item.physicalKey,
        activity: cullSource0LastSegment && item.sourceId === 0 && item.segmentIndex === 5
          ? 'culled'
          : 'active',
      })),
      presentation,
    })
    const presentation = {
      hiddenLogicalKeys: [logical0],
      selectedLogicalKeys: [logical1],
      highlightedLogicalKeys: [logical1],
      isolatedLogicalKeys: null,
    }
    const compacted = makePlan({ swapped: true, cullSource0LastSegment: true, presentation })
    const committed = registry.applyCompactedPhysicalPlan(compacted, beforePlanGuard)
    assert.equal(committed.changed, true)
    assert.deepEqual(committed.previousGuard, beforePlanGuard)
    assert.deepEqual(committed.guard, { layerGeneration: 23, revision: beforePlanGuard.revision + 1 })
    assert.deepEqual(registry.getPresentationSnapshot(), presentation)
    assert.deepEqual(registry.getPhysicalUnitState(items[0].physicalKey).placement, {
      batchId: items[0].placement.batchId,
      slot: 1,
    })
    assert.ok(items
      .filter((item) => item.sourceId === 0 && item.segmentIndex === 5)
      .every((item) => registry.getPhysicalUnitState(item.physicalKey).activity === 'culled'))
    assert.ok(rowHandles(registry, handlesByKey, 0, 4).every((handle) => handle.current.hidden))
    assert.ok(rowHandles(registry, handlesByKey, 1, 4).every((handle) => handle.current.selected))

    const stateCountsBeforeNoop = new Map([...handlesByKey].map(([key, handle]) => [key, handle.states.length]))
    const noOp = registry.applyCompactedPhysicalPlan(compacted, committed.guard)
    assert.equal(noOp.changed, false)
    assert.deepEqual(noOp.guard, committed.guard)
    assert.ok([...handlesByKey].every(([key, handle]) => handle.states.length === stateCountsBeforeNoop.get(key)))
    assert.throws(
      () => registry.applyCompactedPhysicalPlan(compacted, beforePlanGuard),
      StaleLogicalSegmentRevisionError,
    )
    assert.throws(
      () => registry.applyCompactedPhysicalPlan({ ...compacted, placements: compacted.placements.slice(1) }),
      /must cover all 48 registered handles/,
    )

    const restorePlan = makePlan({
      swapped: false,
      cullSource0LastSegment: false,
      presentation: {
        hiddenLogicalKeys: [], selectedLogicalKeys: [], highlightedLogicalKeys: [], isolatedLogicalKeys: null,
      },
    })
    const beforeFailure = registry.getSnapshot()
    const beforeFailureGuard = registry.getMutationGuard()
    const failingHandle = handlesByKey.get(items[0].physicalKey)
    failingHandle.failNext = true
    assert.throws(() => registry.applyCompactedPhysicalPlan(restorePlan, beforeFailureGuard), /synthetic adapter failure/)
    assert.deepEqual(registry.getSnapshot(), beforeFailure)
    assert.deepEqual(registry.getMutationGuard(), beforeFailureGuard)
    assert.deepEqual(registry.getPhysicalUnitState(items[0].physicalKey).placement, {
      batchId: items[0].placement.batchId,
      slot: 1,
    })

    failingHandle.failuresRemaining = 2
    assert.throws(
      () => registry.applyCompactedPhysicalPlan(restorePlan, beforeFailureGuard),
      (error) => error instanceof AggregateError && /rollback failed/.test(error.message),
    )
    assert.deepEqual(registry.getSnapshot(), beforeFailure)
    assert.deepEqual(registry.getMutationGuard(), beforeFailureGuard)
    registry.dispose()
  }

  // Single-row 48-handle cohort (six segments x eight physical adapters): a
  // 24-handle half-commit remains fail-closed, explicit rollback publishes
  // nothing, and the second 24-handle commit publishes all 48 together.
  {
    const registry = new LogicalSegmentIdentityRegistry({
      layerGeneration: 11,
      domainId: 'double-buffered-row',
      sources: catalog(1, 8),
    })
    const items = everyPhysical(registry, 1, 8)
    const firstHalf = items.filter((item) => item.handleIndex < 4)
    const secondHalf = items.filter((item) => item.handleIndex >= 4)

    const rolledBackHandles = new Map()
    const rolledBack = registry.beginHandleRegistration()
    stageItems(registry, rolledBack, firstHalf, rolledBackHandles)
    assert.equal(registry.rollbackHandles(rolledBack), true)
    assert.equal(registry.rollbackHandles(rolledBack), false)
    assert.throws(() => registry.commitHandles(rolledBack), /already rolled-back/)
    assert.equal(registry.getSnapshot().registeredHandles, 0)
    assert.ok([...rolledBackHandles.values()].every((handle) => handle.states.length === 0))

    const handlesByKey = new Map()
    const firstTx = registry.beginHandleRegistration()
    stageItems(registry, firstTx, firstHalf, handlesByKey)
    registry.commitHandles(firstTx)
    assert.equal(registry.getSnapshot().registeredHandles, 24)
    assert.equal(registry.getSnapshot().completeLogicalSources, 0)
    assert.ok([...handlesByKey.values()].every((handle) =>
      !handle.current.visible && !handle.current.cohortComplete))
    const beforeRejectedHide = registry.getSnapshot()
    assert.throws(() => registry.hide(registry.logicalKeyFor(0)), IncompleteLogicalSegmentCohortError)
    assert.deepEqual(registry.getSnapshot(), beforeRejectedHide)

    const secondTx = registry.beginHandleRegistration()
    stageItems(registry, secondTx, secondHalf, handlesByKey)
    registry.commitHandles(secondTx)
    assert.equal(registry.getSnapshot().registeredHandles, 48)
    assert.equal(registry.getSnapshot().completeLogicalSources, 1)
    assert.ok([...handlesByKey.values()].every((handle) =>
      handle.current.visible && handle.current.cohortComplete))
    registry.dispose()
  }

  // Transactions carry both generation and revision. Any intervening catalog
  // mutation rejects the old transaction; its staged handle never registers.
  {
    const registry = new LogicalSegmentIdentityRegistry({
      layerGeneration: 19,
      domainId: 'stale-transaction-row',
      sources: catalog(1, 8),
    })
    const items = everyPhysical(registry, 1, 8)
    const transaction = registry.beginHandleRegistration()
    const stagedHandle = new FakeHandle()
    registry.stageHandle(transaction, {
      physicalKey: items[0].physicalKey,
      handle: stagedHandle,
      placement: items[0].placement,
    })
    registry.setPhysicalUnitActivities(items
      .filter((item) => item.segmentIndex === 5)
      .map((item) => ({
      physicalKey: item.physicalKey,
      activity: 'culled',
    })))
    assert.throws(() => registry.commitHandles(transaction), StaleLogicalSegmentRevisionError)
    assert.equal(registry.rollbackHandles(transaction), false)
    assert.equal(registry.getPhysicalUnitState(items[0].physicalKey).registered, false)
    assert.equal(stagedHandle.states.length, 0)
    assert.throws(
      () => registry.beginHandleRegistration({ layerGeneration: 18, revision: registry.revision }),
      StaleLogicalSegmentGenerationError,
    )
    registry.dispose()
  }

  console.log(
    'Logical segment identity registry: PASS (78x6 identity, 24/48 cohorts, bounds, visibility, culling, remap, transactions)',
  )
} finally {
  await vite.close()
}
