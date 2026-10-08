import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')
const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
const MIRROR_X = Object.freeze([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
const SEGMENT_TRIANGLES = Object.freeze([10_537, 10_558, 10_596, 10_535, 10_353, 8_690])

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

function makeFixture() {
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
    const renderLocal = translatedIdentity(sourceTranslation(sourceIndex))
    const canonical = multiplyMatrices(parity === 'positive' ? IDENTITY : MIRROR_X, renderLocal)
    const sourceUnits = segments.map((segment, segmentIndex) => {
      const unit = {
        index: sourceIndex * 6 + segmentIndex,
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
    catalog: { order: 'source-major-segment-major', defaultState: 'culled', sources, units },
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

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

class FakeAtomicRenderer {
  created = []
  disposed = []
  publications = []
  rollbacks = []
  hidden = []
  catalog = null
  publicationHook = null
  rollbackHook = null
  throwPublication = null
  throwRollback = null
  throwHide = null
  omitBoundsReceipt = false
  reuseList = false
  invalidInitialState = false

  createPersistentList(descriptor) {
    if (this.reuseList && this.created.length) return this.created[0]
    const list = Object.freeze({
      key: descriptor.key,
      ordinal: this.created.length,
      initialState: this.invalidInitialState ? 'unknown-visible-state' : 'hidden-zero-count-bounds-cleared',
    })
    this.created.push(list)
    return list
  }

  async publishAtomicExactCatalog(publication) {
    this.publications.push(publication)
    if (this.publicationHook) await this.publicationHook(publication)
    if (this.throwPublication) throw this.throwPublication
    // One pointer replacement models the required all-list visibility boundary.
    this.catalog = publication
    return this.receipt(publication)
  }

  async rollbackAtomicExactCatalog(request) {
    this.rollbacks.push(request)
    if (this.rollbackHook) await this.rollbackHook(request)
    if (this.throwRollback) throw this.throwRollback
    this.catalog = request.publication
    return this.receipt(request.publication)
  }

  receipt(publication) {
    const keys = publication.lists.map((entry) => entry.descriptor.key)
    return Object.freeze({
      kind: 'development-repeat-six-part-renderer-publication-receipt',
      direction: publication.direction,
      operationId: publication.operationId,
      generation: publication.generation,
      rendererBaseRevision: publication.rendererBaseRevision,
      rendererRevision: publication.rendererRevision,
      atomicMatrixSlotMapsPublished: true,
      boundsRefreshPolicyHonored: true,
      publishedListKeys: Object.freeze([...keys]),
      boundsRefreshedListKeys: Object.freeze(this.omitBoundsReceipt ? keys.slice(0, -1) : [...keys]),
    })
  }

  hidePersistentExactCatalog(reason) {
    this.hidden.push(reason)
    if (this.throwHide) throw this.throwHide
    this.catalog = null
  }

  disposePersistentList(list) {
    this.disposed.push(list)
  }
}

class FakeFallback {
  activations = []
  activateMonolithicFallback(reason) {
    this.activations.push(reason)
  }
}

function makeAdapter(Adapter, generation = 31_000, renderer = new FakeAtomicRenderer(), fallback = new FakeFallback()) {
  const adapter = new Adapter({
    generation,
    domainId: `development-test-${generation}`,
    manifest: makeFixture(),
    renderer,
    monolithicFallback: fallback,
  })
  return { adapter, renderer, fallback }
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error?.name, 'DevelopmentRepeatSixPartPersistentCatalogAdapterError')
    assert.equal(error?.code, code)
    return true
  })
}

const vite = await createServer({
  root: PROJECT_DIR,
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
    RepeatSixPartSourceOwnershipHandoffCoordinator,
  } = await vite.ssrLoadModule('/src/scene/RepeatSixPartSourceOwnershipHandoff.ts')

  // Exact construction and two real compactions. All 48 renderer identities
  // persist, while all 468 selector units and 1,872 material handles remain
  // exhaustively represented in every complete slot permutation.
  {
    const { adapter, renderer, fallback } = makeAdapter(Adapter)
    const initial = adapter.getSnapshot()
    assert.equal(initial.kind, 'development-repeat-six-part-persistent-exact-catalog')
    assert.equal(initial.developmentOnly, true)
    assert.equal(initial.state, 'ready')
    assert.equal(initial.plannerRevision, 0)
    assert.equal(initial.rendererRevision, 0)
    assert.equal(initial.registryRevision, 1)
    assert.equal(initial.counters.persistentLists, 48)
    assert.equal(initial.counters.selectionInputUnits, 468)
    assert.equal(initial.counters.registeredPhysicalHandles, 1_872)
    assert.equal(initial.counters.activeUnits, 0)
    assert.equal(initial.counters.hiddenLists, 48)
    assert.equal(renderer.created.length, 48)
    assert.equal(new Set(renderer.created).size, 48)
    assert.equal(renderer.created.every((list) => list.initialState === 'hidden-zero-count-bounds-cleared'), true)
    assert.deepEqual(renderer.created.slice(0, 4).map((list) => list.key), [
      'positive:segment-00:material-00',
      'positive:segment-00:material-01',
      'positive:segment-00:material-02',
      'positive:segment-00:material-03',
    ])
    assert.equal(adapter.getLogicalHandleState('source-00', 'segment-00', 0).activity, 'culled')
    assert.deepEqual(adapter.getLogicalHandleState('source-00', 'segment-00', 0).placement, {
      batchId: 'positive:segment-00:material-00', slot: 0,
    })
    assert.throws(
      () => adapter.getSourceOwnershipHandoffEvidence(),
      (error) => error?.code === 'HANDOFF_EVIDENCE_UNAVAILABLE',
    )

    const first = await adapter.updateFocus({
      generation: 31_000,
      focus: { space: 'owner-local', point: [-3.5, 0.5, 0.5] },
    })
    assert.equal(first.kind, 'committed')
    assert.equal(first.snapshot.state, 'ready')
    assert.equal(renderer.publications.length, 1)
    const firstPublication = renderer.publications[0]
    assert.equal(Object.isFrozen(firstPublication), true)
    assert.equal(firstPublication.selectionInputUnits, 468)
    assert.equal(firstPublication.boundsRefreshPolicy, 'all-48-lists-every-publication')
    assert.equal(firstPublication.lists.length, 48)
    assert.equal(firstPublication.lists.every((entry) => entry.boundsRecomputeRequired), true)
    assert.equal(firstPublication.lists.every((entry) => entry.instanceMatrixUpdateRequired), true)
    assert.equal(firstPublication.lists.reduce((sum, entry) => sum + entry.descriptor.capacity, 0), 1_872)
    assert.equal(firstPublication.lists.reduce((sum, entry) => sum + entry.activeCount, 0), 4)
    assert.equal(new Set(firstPublication.lists.map((entry) => entry.persistentList)).size, 48)
    const firstList = firstPublication.lists[0]
    assert.equal(firstList.activeCount, 1)
    assert.equal(firstList.visible, true)
    assert.equal(firstList.compactedMatrices.length, 1)
    assert.deepEqual(firstList.activeSlotToUnit.map((entry) => [entry.slot, entry.unitKey]), [
      [0, 'source-00:segment-00'],
    ])
    assert.equal(firstPublication.lists[4].activeCount, 0)
    assert.equal(firstPublication.lists[4].visible, false)
    assert.equal(firstPublication.lists[4].ownerLocalBounds, null)
    assert.equal(firstPublication.lists[4].renderLocalBounds, null)
    assert.equal(adapter.getLogicalHandleState('source-00', 'segment-00', 0).activity, 'active')
    const firstHandoffEvidence = adapter.getSourceOwnershipHandoffEvidence()
    assert.equal(Object.isFrozen(firstHandoffEvidence), true)
    assert.equal(firstHandoffEvidence.plannerCommit.revision, 1)
    assert.equal(firstHandoffEvidence.registrySnapshot.revision, 2)
    assert.equal(firstHandoffEvidence.registryMutationGuard.revision, 2)
    const handoff = new RepeatSixPartSourceOwnershipHandoffCoordinator(31_000)
    const preparedHandoff = handoff.prepare({
      generation: 31_000,
      ownershipRevision: 0,
      evidence: firstHandoffEvidence,
    })
    assert.equal(preparedHandoff.nextCommand.kind, 'publish-replacement')

    const stableLists = firstPublication.lists.map((entry) => entry.persistentList)
    const second = await adapter.updateFocus({
      generation: 31_000,
      focus: { space: 'owner-local', point: [7, 0.5, 0.5] },
    })
    assert.equal(second.kind, 'committed')
    const secondPublication = renderer.publications[1]
    assert.deepEqual(secondPublication.lists.map((entry) => entry.persistentList), stableLists)
    assert.deepEqual(secondPublication.lists[0].activeSlotToUnit.map((entry) => entry.unitKey), [
      'source-01:segment-00',
    ])
    assert.equal(adapter.getLogicalHandleState('source-00', 'segment-00', 0).activity, 'culled')
    assert.deepEqual(adapter.getLogicalHandleState('source-00', 'segment-00', 0).placement, {
      batchId: 'positive:segment-00:material-00', slot: 1,
    })
    assert.equal(adapter.getLogicalHandleState('source-01', 'segment-00', 0).activity, 'active')
    assert.deepEqual(adapter.getLogicalHandleState('source-01', 'segment-00', 0).placement, {
      batchId: 'positive:segment-00:material-00', slot: 0,
    })
    const secondHandoffEvidence = adapter.getSourceOwnershipHandoffEvidence()
    assert.equal(secondHandoffEvidence.plannerCommit.revision, 2)
    assert.notStrictEqual(secondHandoffEvidence.plannerCommit, firstHandoffEvidence.plannerCommit)
    assert.equal(secondHandoffEvidence.registrySnapshot.revision, 3)
    assert.equal(secondHandoffEvidence.registryMutationGuard.revision, 3)

    const noOp = await adapter.updateFocus({
      generation: 31_000,
      focus: { space: 'owner-local', point: [7, 0.5, 0.5] },
    })
    assert.equal(noOp.kind, 'no-op')
    assert.equal(renderer.publications.length, 2)
    const counters = adapter.getSnapshot().counters
    assert.deepEqual({
      activeUnits: counters.activeUnits,
      culledUnits: counters.culledUnits,
      activeLists: counters.activeLists,
      hiddenLists: counters.hiddenLists,
      submittedTriangles: counters.submittedTriangles,
      submittedDraws: counters.submittedDraws,
      updateAttempts: counters.updateAttempts,
      preparedUpdates: counters.preparedUpdates,
      committedUpdates: counters.committedUpdates,
      noOpUpdates: counters.noOpUpdates,
      verifiedAtomicPublications: counters.verifiedAtomicPublications,
      conservativeBoundsRefreshPasses: counters.conservativeBoundsRefreshPasses,
      conservativelyRefreshedLists: counters.conservativelyRefreshedLists,
    }, {
      activeUnits: 1,
      culledUnits: 467,
      activeLists: 4,
      hiddenLists: 44,
      submittedTriangles: SEGMENT_TRIANGLES[0],
      submittedDraws: 4,
      updateAttempts: 3,
      preparedUpdates: 2,
      committedUpdates: 2,
      noOpUpdates: 1,
      verifiedAtomicPublications: 2,
      conservativeBoundsRefreshPasses: 2,
      conservativelyRefreshedLists: 96,
    })
    assert.equal(adapter.getSnapshot().plannerRevision, 2)
    assert.equal(adapter.getSnapshot().rendererRevision, 2)
    assert.equal(adapter.getSnapshot().registryRevision, 3)
    assert.equal(fallback.activations.length, 0)
    await adapter.dispose()
    assert.equal(adapter.getSnapshot().state, 'disposed')
    assert.equal(renderer.disposed.length, 48)
    assert.equal(new Set(renderer.disposed).size, 48)
    assert.throws(
      () => adapter.getSourceOwnershipHandoffEvidence(),
      (error) => error?.code === 'HANDOFF_EVIDENCE_UNAVAILABLE',
    )
    await expectCode(adapter.updateFocus({
      generation: 31_000,
      focus: { space: 'owner-local', point: [0, 0, 0] },
    }), 'DISPOSED')
  }

  // Abort before planner preparation is side-effect free.
  {
    const { adapter, renderer } = makeAdapter(Adapter, 31_100)
    const controller = new AbortController()
    controller.abort()
    const result = await adapter.updateFocus({
      generation: 31_100,
      signal: controller.signal,
      focus: { space: 'owner-local', point: [-3.5, 0.5, 0.5] },
    })
    assert.equal(result.kind, 'cancelled')
    assert.equal(result.cancellationStage, 'before-prepare')
    assert.equal(result.snapshot.plannerRevision, 0)
    assert.equal(renderer.publications.length, 0)
    assert.equal(adapter.getSnapshot().counters.cancelledUpdates, 1)
    await adapter.dispose()
  }

  // Cancellation after the atomic renderer publication restores all 48 old
  // lists, advances the external renderer revision twice, and remains usable.
  {
    const renderer = new FakeAtomicRenderer()
    const { adapter, fallback } = makeAdapter(Adapter, 31_200, renderer)
    const initialNoOp = await adapter.updateFocus({
      generation: 31_200,
      focus: { space: 'owner-local', point: [-10_000, -10_000, -10_000] },
    })
    assert.equal(initialNoOp.kind, 'no-op')
    renderer.publicationHook = () => { adapter.cancelPendingUpdate() }
    const cancelled = await adapter.updateFocus({
      generation: 31_200,
      focus: { space: 'owner-local', point: [-3.5, 0.5, 0.5] },
    })
    assert.equal(cancelled.kind, 'cancelled')
    assert.equal(cancelled.cancellationStage, 'after-publish')
    assert.equal(renderer.publications.length, 1)
    assert.equal(renderer.rollbacks.length, 1)
    assert.equal(renderer.rollbacks[0].publication.direction, 'rollback')
    assert.equal(renderer.publications[0].operationId, 2)
    assert.equal(renderer.rollbacks[0].publication.operationId, 2)
    assert.equal(renderer.rollbacks[0].publication.lists.every((entry) => entry.activeCount === 0), true)
    assert.equal(cancelled.snapshot.plannerRevision, 0)
    assert.equal(cancelled.snapshot.rendererRevision, 2)
    assert.equal(cancelled.snapshot.registryRevision, 1)
    assert.equal(cancelled.snapshot.counters.verifiedAtomicPublications, 1)
    assert.equal(cancelled.snapshot.counters.verifiedAtomicRollbacks, 1)
    assert.equal(cancelled.snapshot.counters.conservativelyRefreshedLists, 96)
    assert.equal(fallback.activations.length, 0)

    renderer.publicationHook = null
    const retry = await adapter.updateFocus({
      generation: 31_200,
      focus: { space: 'owner-local', point: [-3.5, 0.5, 0.5] },
    })
    assert.equal(retry.kind, 'committed')
    assert.equal(retry.snapshot.rendererRevision, 3)
    assert.equal(retry.snapshot.plannerRevision, 1)
    await adapter.dispose()
  }

  // A deferred renderer proves concurrent work is rejected, explicit cancel
  // is observed at the next boundary, and disposal waits for that rollback.
  {
    const renderer = new FakeAtomicRenderer()
    const started = deferred()
    const release = deferred()
    renderer.publicationHook = async () => {
      started.resolve()
      await release.promise
    }
    const { adapter } = makeAdapter(Adapter, 31_300, renderer)
    const update = adapter.updateFocus({
      generation: 31_300,
      focus: { space: 'owner-local', point: [-3.5, 0.5, 0.5] },
    })
    await started.promise
    assert.equal(adapter.getSnapshot().state, 'updating')
    await expectCode(adapter.updateFocus({
      generation: 31_300,
      focus: { space: 'owner-local', point: [7, 0.5, 0.5] },
    }), 'CONCURRENT_UPDATE')
    const disposal = adapter.dispose()
    release.resolve()
    const result = await update
    assert.equal(result.kind, 'cancelled')
    await disposal
    assert.equal(adapter.getSnapshot().state, 'disposed')
    assert.equal(renderer.rollbacks.length, 1)
    assert.equal(renderer.disposed.length, 48)
  }

  // Stale generation is rejected before an operation/counter or renderer
  // mutation can begin.
  {
    const { adapter, renderer } = makeAdapter(Adapter, 31_400)
    await expectCode(adapter.updateFocus({
      generation: 31_399,
      focus: { space: 'owner-local', point: [0, 0, 0] },
    }), 'STALE_GENERATION')
    assert.equal(adapter.getSnapshot().counters.updateAttempts, 0)
    assert.equal(renderer.publications.length, 0)
    await adapter.dispose()
  }

  // Missing even one of the 48 conservative bounds acknowledgements makes
  // the renderer state unknowable: hide exact lists, activate monolithic,
  // and permanently reject further updates.
  {
    const renderer = new FakeAtomicRenderer()
    renderer.omitBoundsReceipt = true
    const fallback = new FakeFallback()
    const { adapter } = makeAdapter(Adapter, 31_500, renderer, fallback)
    await expectCode(adapter.updateFocus({
      generation: 31_500,
      focus: { space: 'owner-local', point: [-3.5, 0.5, 0.5] },
    }), 'INVALID_RENDERER_RECEIPT')
    const snapshot = adapter.getSnapshot()
    assert.equal(snapshot.state, 'fail-stopped')
    assert.equal(snapshot.plannerRevision, 0)
    assert.equal(snapshot.counters.failedUpdates, 1)
    assert.equal(snapshot.counters.verifiedAtomicPublications, 0)
    assert.equal(snapshot.counters.failStopHideAttempts, 1)
    assert.equal(snapshot.counters.monolithicFallbackActivationAttempts, 1)
    assert.equal(renderer.hidden.length, 1)
    assert.equal(fallback.activations.length, 1)
    assert.equal(fallback.activations[0].exactCatalogHidden, true)
    await expectCode(adapter.updateFocus({
      generation: 31_500,
      focus: { space: 'owner-local', point: [7, 0.5, 0.5] },
    }), 'FAIL_STOPPED')
    await adapter.dispose()
  }

  // A renderer throw before a receipt follows the same fail-stop path.
  {
    const renderer = new FakeAtomicRenderer()
    renderer.throwPublication = new Error('simulated publish failure')
    const fallback = new FakeFallback()
    const { adapter } = makeAdapter(Adapter, 31_600, renderer, fallback)
    await expectCode(adapter.updateFocus({
      generation: 31_600,
      focus: { space: 'owner-local', point: [-3.5, 0.5, 0.5] },
    }), 'RENDERER_PUBLICATION_FAILED')
    assert.equal(adapter.getSnapshot().state, 'fail-stopped')
    assert.equal(renderer.hidden.length, 1)
    assert.equal(fallback.activations.length, 1)
    await adapter.dispose()
  }

  // If a requested cancellation cannot restore the previous catalog, the
  // adapter refuses to continue and transfers visibility to monolithic.
  {
    const renderer = new FakeAtomicRenderer()
    renderer.throwRollback = new Error('simulated rollback failure')
    const fallback = new FakeFallback()
    const { adapter } = makeAdapter(Adapter, 31_700, renderer, fallback)
    renderer.publicationHook = () => { adapter.cancelPendingUpdate() }
    await expectCode(adapter.updateFocus({
      generation: 31_700,
      focus: { space: 'owner-local', point: [-3.5, 0.5, 0.5] },
    }), 'RENDERER_ROLLBACK_FAILED')
    const snapshot = adapter.getSnapshot()
    assert.equal(snapshot.state, 'fail-stopped')
    assert.equal(snapshot.counters.rendererRollbackAttempts, 1)
    assert.equal(snapshot.counters.verifiedAtomicRollbacks, 0)
    assert.equal(renderer.hidden.length, 1)
    assert.equal(fallback.activations.length, 1)
    await adapter.dispose()
  }

  // A hostile receipt getter is read exactly once into an immutable snapshot;
  // later transaction steps cannot observe a different renderer revision.
  {
    const renderer = new FakeAtomicRenderer()
    const stableReceipt = renderer.receipt.bind(renderer)
    let rendererRevisionReads = 0
    renderer.receipt = (publication) => {
      const stable = stableReceipt(publication)
      return new Proxy(stable, {
        get(target, property, receiver) {
          if (property === 'rendererRevision') {
            rendererRevisionReads += 1
            return rendererRevisionReads === 1 ? target.rendererRevision : target.rendererRevision + 1_000
          }
          return Reflect.get(target, property, receiver)
        },
      })
    }
    const { adapter } = makeAdapter(Adapter, 31_750, renderer)
    const result = await adapter.updateFocus({
      generation: 31_750,
      focus: { space: 'owner-local', point: [-3.5, 0.5, 0.5] },
    })
    assert.equal(result.kind, 'committed')
    assert.equal(result.snapshot.rendererRevision, 1)
    assert.equal(rendererRevisionReads, 1)
    await adapter.dispose()
  }

  // If the exact catalog cannot be hidden, monolithic fallback activation is
  // withheld so the adapter can never create dual visible ownership.
  {
    const renderer = new FakeAtomicRenderer()
    renderer.omitBoundsReceipt = true
    renderer.throwHide = new Error('simulated exact-catalog hide failure')
    const fallback = new FakeFallback()
    const { adapter } = makeAdapter(Adapter, 31_760, renderer, fallback)
    await expectCode(adapter.updateFocus({
      generation: 31_760,
      focus: { space: 'owner-local', point: [-3.5, 0.5, 0.5] },
    }), 'INVALID_RENDERER_RECEIPT')
    const snapshot = adapter.getSnapshot()
    assert.equal(snapshot.state, 'fail-stopped')
    assert.equal(snapshot.counters.failStopHideAttempts, 1)
    assert.equal(snapshot.counters.monolithicFallbackActivationAttempts, 0)
    assert.notEqual(renderer.catalog, null)
    assert.equal(fallback.activations.length, 0)
    await adapter.dispose()
  }

  // Readiness requires every persistent identity to attest the all-hidden,
  // zero-count, bounds-cleared initialization contract.
  {
    const renderer = new FakeAtomicRenderer()
    renderer.invalidInitialState = true
    assert.throws(
      () => makeAdapter(Adapter, 31_770, renderer),
      (error) => error?.code === 'INVALID_CONFIGURATION',
    )
    assert.equal(renderer.created.length, 1)
    assert.equal(renderer.disposed.length, 1)
  }

  // Construction never accepts aliased list identities; partial allocations
  // are reclaimed and no publication is attempted.
  {
    const renderer = new FakeAtomicRenderer()
    renderer.reuseList = true
    const fallback = new FakeFallback()
    assert.throws(
      () => makeAdapter(Adapter, 31_800, renderer, fallback),
      (error) => error?.code === 'INVALID_CONFIGURATION',
    )
    assert.equal(renderer.publications.length, 0)
    assert.equal(renderer.disposed.length, 1)
    assert.equal(fallback.activations.length, 0)
  }

  console.log('Development repeat-six-part persistent catalog renderer adapter tests: PASS')
  console.log(JSON.stringify({
    persistentLists: 48,
    selectionInputUnits: 468,
    physicalHandles: 1872,
    tested: [
      'persistent-list-identity',
      'atomic-matrix-slot-compaction',
      'all-list-conservative-bounds-refresh',
      'exact-counters',
      'logical-registry-remap',
      'authentic-source-ownership-handoff-evidence',
      'no-op',
      'generation-guard',
      'concurrent-update-rejection',
      'pre-publish-cancellation',
      'post-publish-rollback',
      'rollback-recovery',
      'dispose-during-update',
      'invalid-receipt-fail-stop',
      'publish-failure-fallback',
      'rollback-failure-fallback',
      'single-read-immutable-receipt-snapshot',
      'hide-failure-withholds-monolithic-fallback',
      'initial-hidden-zero-count-bounds-cleared-contract',
      'aliased-list-construction-rejection',
    ],
  }, null, 2))
} finally {
  await vite.close()
}
