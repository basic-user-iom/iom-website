/**
 * Deterministic development-only selector and renderer-rollback witness.
 *
 * This helper accepts only a genuinely issued adapter/Three-port pair. It
 * deliberately exposes no live renderer objects and grants no activation
 * authority.
 */

import type {
  RepeatSixPartActiveListManifestInput,
  RepeatSixPartBounds,
  RepeatSixPartParity,
  RepeatSixPartUnitCatalogEntry,
  RepeatSixPartVec3,
} from '../../RepeatSixPartActiveListPlanner'
import {
  isIssuedDevelopmentRepeatSixPartAdapterRendererBinding,
  type DevelopmentRepeatSixPartPersistentCatalogRendererAdapter,
  type DevelopmentRepeatSixPartUpdateResult,
} from '../DevelopmentRepeatSixPartPersistentCatalogRendererAdapter'
import {
  isIssuedDevelopmentRepeatSixPartThreeRendererPort,
  type DevelopmentRepeatSixPartThreeRendererPort,
} from '../DevelopmentRepeatSixPartThreeRendererPort'

const ENTER_MARGIN_METERS = 3.5
const EXIT_MARGIN_METERS = 5.5
const EPSILON_METERS = 0.000_001
const DEADBAND_OFFSET_METERS = 4.5
const RAPID_CHURN_CYCLES = 4
const MATERIAL_LISTS_PER_UNIT = 4

type TargetState = 'active' | 'culled'

export type DevelopmentRepeatSixPartBoundaryRollbackWitnessOptions = Readonly<{
  generation: number
  manifest: RepeatSixPartActiveListManifestInput
  adapter: DevelopmentRepeatSixPartPersistentCatalogRendererAdapter
  rendererPort: DevelopmentRepeatSixPartThreeRendererPort
}>

export type DevelopmentRepeatSixPartBoundaryStepEvidence = Readonly<{
  name: string
  requestedOffsetMeters: number
  point: RepeatSixPartVec3
  result: DevelopmentRepeatSixPartUpdateResult['kind']
  targetState: TargetState
  plannerRevision: number
  rendererRevision: number
  registryRevision: number
  verifiedMaterialHandles: 4
}>

export type DevelopmentRepeatSixPartBoundaryRollbackWitnessEvidence = Readonly<{
  kind: 'development-repeat-six-part-boundary-rollback-witness'
  developmentOnly: true
  generation: number
  selector: Readonly<{
    boundsType: 'closed-aabb'
    distanceMetric: 'linf-point-to-closed-aabb'
    enterMarginMeters: 3.5
    exitMarginMeters: 5.5
    epsilonMeters: 0.000001
  }>
  target: Readonly<{
    unitKey: string
    unitIndex: number
    sourceId: string
    sourceIndex: number
    segmentId: string
    segmentIndex: number
    parity: RepeatSixPartParity
    bounds: RepeatSixPartBounds
    verifiedMaterialHandles: 4
  }>
  boundarySteps: readonly DevelopmentRepeatSixPartBoundaryStepEvidence[]
  rapidSequentialChurn: Readonly<{
    cycles: 4
    updates: 16
    committed: 8
    noOp: 8
    finalTargetState: 'active'
  }>
  afterPublishCancellation: Readonly<{
    result: 'cancelled'
    cancellationStage: 'after-publish'
    transientPublicationObserved: true
    all48PhysicalListsRestored: true
    persistentMeshIdentitiesRetained: true
    plannerRevisionRestored: true
    registryRevisionRestored: true
    activeStateRestored: true
    verifiedMaterialHandles: 4
    rendererRevisionBefore: number
    transientRendererRevision: number
    rendererRevisionAfter: number
    rendererRevisionAdvance: 2
  }>
  finalRequestedFocus: Readonly<{
    point: RepeatSixPartVec3
    result: 'no-op'
    targetState: 'active'
    appliedAfterRollback: true
  }>
  activationAuthorized: false
  activationCapability: null
}>

type PhysicalListCapture = Readonly<{
  key: string
  mesh: ReturnType<DevelopmentRepeatSixPartThreeRendererPort['getListMesh']>
  content: Readonly<Record<string, unknown>>
}>

function fail(message: string): never {
  throw new Error(`Development repeat-six-part boundary witness: ${message}`)
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  return Object.freeze(value)
}

function vec3(values: readonly number[]): RepeatSixPartVec3 {
  return Object.freeze([values[0], values[1], values[2]]) as RepeatSixPartVec3
}

function cloneBounds(bounds: RepeatSixPartBounds | null): Readonly<Record<string, unknown>> | null {
  if (!bounds) return null
  return {
    space: bounds.space,
    min: [...bounds.min],
    max: [...bounds.max],
  }
}

function cloneBox(box: { min: { toArray(): number[] }; max: { toArray(): number[] } } | null): unknown {
  return box ? { min: box.min.toArray(), max: box.max.toArray() } : null
}

function cloneSphere(sphere: { center: { toArray(): number[] }; radius: number } | null): unknown {
  return sphere ? { center: sphere.center.toArray(), radius: sphere.radius } : null
}

function listKey(parity: RepeatSixPartParity, segmentIndex: number, materialIndex: number): string {
  return `${parity}:segment-${String(segmentIndex).padStart(2, '0')}:material-${String(materialIndex).padStart(2, '0')}`
}

function allListKeys(manifest: RepeatSixPartActiveListManifestInput): readonly string[] {
  const keys: string[] = []
  for (const parity of ['positive', 'mirrored'] as const) {
    for (const segment of manifest.geometry.segments) {
      for (let materialIndex = 0; materialIndex < MATERIAL_LISTS_PER_UNIT; materialIndex += 1) {
        keys.push(listKey(parity, segment.index, materialIndex))
      }
    }
  }
  if (keys.length !== 48) fail(`expected 48 persistent list keys, received ${keys.length}`)
  return Object.freeze(keys)
}

function capturePhysicalLists(
  port: DevelopmentRepeatSixPartThreeRendererPort,
  keys: readonly string[],
): readonly PhysicalListCapture[] {
  return Object.freeze(keys.map((key) => {
    const snapshot = port.getListSnapshot(key)
    const mesh = port.getListMesh(key)
    return Object.freeze({
      key,
      mesh,
      content: {
        activeCount: snapshot.activeCount,
        visible: snapshot.visible,
        slotToUnit: snapshot.slotToUnit.map((entry) => ({ ...entry })),
        ownerLocalBounds: cloneBounds(snapshot.ownerLocalBounds),
        renderLocalBounds: cloneBounds(snapshot.renderLocalBounds),
        matrixArray: Array.from(mesh.instanceMatrix.array),
        meshCount: mesh.count,
        meshVisible: mesh.visible,
        frustumCulled: mesh.frustumCulled,
        boundingBox: cloneBox(mesh.boundingBox),
        boundingSphere: cloneSphere(mesh.boundingSphere),
        userData: {
          activeSlotToUnit: Array.isArray(mesh.userData.activeSlotToUnit)
            ? mesh.userData.activeSlotToUnit.map((entry: Record<string, unknown>) => ({ ...entry }))
            : mesh.userData.activeSlotToUnit,
          sourceIds: Array.isArray(mesh.userData.sourceIds) ? [...mesh.userData.sourceIds] : mesh.userData.sourceIds,
          ownerLocalBounds: cloneBounds(mesh.userData.ownerLocalBounds as RepeatSixPartBounds | null),
          renderLocalBounds: cloneBounds(mesh.userData.renderLocalBounds as RepeatSixPartBounds | null),
        },
      },
    })
  }))
}

function assertPhysicalListsEqual(
  before: readonly PhysicalListCapture[],
  after: readonly PhysicalListCapture[],
): void {
  if (before.length !== 48 || after.length !== 48) fail('rollback comparison did not contain all 48 lists')
  for (let index = 0; index < before.length; index += 1) {
    const expected = before[index]
    const observed = after[index]
    if (expected.key !== observed.key || expected.mesh !== observed.mesh) {
      fail(`persistent list identity changed at list ${index}`)
    }
    if (JSON.stringify(expected.content) !== JSON.stringify(observed.content)) {
      fail(`physical content was not restored for ${expected.key}`)
    }
  }
}

function linfDistanceToClosedBounds(point: RepeatSixPartVec3, bounds: RepeatSixPartBounds): number {
  let distance = 0
  for (let axis = 0; axis < 3; axis += 1) {
    const axisDistance = point[axis] < bounds.min[axis]
      ? bounds.min[axis] - point[axis]
      : point[axis] > bounds.max[axis]
        ? point[axis] - bounds.max[axis]
        : 0
    distance = Math.max(distance, axisDistance)
  }
  return distance
}

function selectTarget(manifest: RepeatSixPartActiveListManifestInput): RepeatSixPartUnitCatalogEntry {
  if (manifest.catalog.units.length !== 468) fail('exact manifest must contain 468 logical units')
  let target = manifest.catalog.units[0]
  for (const unit of manifest.catalog.units) {
    if (unit.bounds.min[0] < target.bounds.min[0]) target = unit
  }
  const tied = manifest.catalog.units.filter((unit) => unit.bounds.min[0] === target.bounds.min[0])
  if (tied.length !== 1) fail('global minimum-X target must be unique')
  return target
}

function assertExactSelector(manifest: RepeatSixPartActiveListManifestInput): void {
  const selector = manifest.selector
  if (
    selector.boundsSpace !== 'owner-local' ||
    selector.boundsType !== 'closed-aabb' ||
    selector.distanceMetric !== 'linf-point-to-closed-aabb' ||
    selector.enterMarginMeters !== ENTER_MARGIN_METERS ||
    selector.exitMarginMeters !== EXIT_MARGIN_METERS ||
    selector.defaultState !== 'culled'
  ) fail('selector is not the exact closed-AABB 3.5 m entry / 5.5 m exit contract')
}

function targetPoints(target: RepeatSixPartUnitCatalogEntry): Readonly<Record<string, RepeatSixPartVec3>> {
  const y = (target.bounds.min[1] + target.bounds.max[1]) * 0.5
  const z = (target.bounds.min[2] + target.bounds.max[2]) * 0.5
  const atOffset = (offset: number): RepeatSixPartVec3 => vec3([target.bounds.min[0] - offset, y, z])
  const points = {
    entryOutside: atOffset(ENTER_MARGIN_METERS + EPSILON_METERS),
    entryExact: atOffset(ENTER_MARGIN_METERS),
    entryInside: atOffset(ENTER_MARGIN_METERS - EPSILON_METERS),
    deadband: atOffset(DEADBAND_OFFSET_METERS),
    exitExact: atOffset(EXIT_MARGIN_METERS),
    exitOutside: atOffset(EXIT_MARGIN_METERS + EPSILON_METERS),
  }
  if (linfDistanceToClosedBounds(points.entryExact, target.bounds) !== ENTER_MARGIN_METERS) {
    fail('entry boundary point is not exactly 3.5 m from the target closed AABB')
  }
  if (linfDistanceToClosedBounds(points.exitExact, target.bounds) !== EXIT_MARGIN_METERS) {
    fail('exit boundary point is not exactly 5.5 m from the target closed AABB')
  }
  if (linfDistanceToClosedBounds(points.entryOutside, target.bounds) <= ENTER_MARGIN_METERS) {
    fail('entry epsilon-outside point is not outside the 3.5 m envelope')
  }
  if (linfDistanceToClosedBounds(points.entryInside, target.bounds) >= ENTER_MARGIN_METERS) {
    fail('entry epsilon-inside point is not inside the 3.5 m envelope')
  }
  if (linfDistanceToClosedBounds(points.exitOutside, target.bounds) <= EXIT_MARGIN_METERS) {
    fail('exit epsilon-outside point is not outside the 5.5 m envelope')
  }
  return deepFreeze(points)
}

function captureTargetHandles(
  adapter: DevelopmentRepeatSixPartPersistentCatalogRendererAdapter,
  target: RepeatSixPartUnitCatalogEntry,
): readonly Readonly<Record<string, unknown>>[] {
  return Object.freeze(Array.from({ length: MATERIAL_LISTS_PER_UNIT }, (_, materialIndex) => {
    const state = adapter.getLogicalHandleState(target.sourceId, target.segmentId, materialIndex)
    return Object.freeze({
      materialIndex,
      layerGeneration: state.layerGeneration,
      registryRevision: state.registryRevision,
      logicalKey: state.logicalKey,
      segmentKey: state.segmentKey,
      physicalKey: state.physicalKey,
      placement: { ...state.placement },
      activity: state.activity,
      cohortComplete: state.cohortComplete,
      visible: state.visible,
      hidden: state.hidden,
      isolationActive: state.isolationActive,
      isolated: state.isolated,
      selected: state.selected,
      highlighted: state.highlighted,
    })
  }))
}

function assertTargetState(
  manifest: RepeatSixPartActiveListManifestInput,
  adapter: DevelopmentRepeatSixPartPersistentCatalogRendererAdapter,
  port: DevelopmentRepeatSixPartThreeRendererPort,
  target: RepeatSixPartUnitCatalogEntry,
  expected: TargetState,
): void {
  const active = expected === 'active'
  const snapshot = adapter.getSnapshot()
  if (snapshot.state !== 'ready' || snapshot.transactionPhase !== 'idle') fail('adapter did not return to ready/idle')
  if (snapshot.counters.activeUnits !== (active ? 1 : 0)) fail(`target ${expected} state has an unexpected active-unit count`)
  if (snapshot.counters.activeLists !== (active ? 4 : 0)) fail(`target ${expected} state has an unexpected active-list count`)
  const source = manifest.catalog.sources[target.sourceIndex]
  if (!source || source.id !== target.sourceId) fail('target source binding is invalid')
  for (let materialIndex = 0; materialIndex < MATERIAL_LISTS_PER_UNIT; materialIndex += 1) {
    const handle = adapter.getLogicalHandleState(target.sourceId, target.segmentId, materialIndex)
    if (
      handle.activity !== expected ||
      handle.visible !== active ||
      handle.hidden !== false ||
      handle.cohortComplete !== true
    ) fail(`logical target material ${materialIndex} did not become ${expected}`)
    const list = port.getListSnapshot(listKey(source.parity, target.segmentIndex, materialIndex))
    if (list.activeCount !== (active ? 1 : 0) || list.visible !== active) {
      fail(`physical target material ${materialIndex} did not become ${expected}`)
    }
    if (active && (
      list.slotToUnit.length !== 1 ||
      list.slotToUnit[0].slot !== 0 ||
      list.slotToUnit[0].unitKey !== target.id ||
      list.slotToUnit[0].sourceId !== target.sourceId
    )) fail(`active target material ${materialIndex} has an invalid compacted slot`)
    if (!active && list.slotToUnit.length !== 0) fail(`culled target material ${materialIndex} retained a slot`)
  }
}

async function applyExpected(
  options: DevelopmentRepeatSixPartBoundaryRollbackWitnessOptions,
  target: RepeatSixPartUnitCatalogEntry,
  name: string,
  requestedOffsetMeters: number,
  point: RepeatSixPartVec3,
  expectedResult: DevelopmentRepeatSixPartUpdateResult['kind'],
  expectedState: TargetState,
): Promise<DevelopmentRepeatSixPartBoundaryStepEvidence> {
  const result = await options.adapter.updateFocus({
    generation: options.generation,
    focus: { space: 'owner-local', point },
  })
  if (result.kind !== expectedResult || result.cancellationStage !== null) {
    fail(`${name} returned ${result.kind}/${result.cancellationStage}; expected ${expectedResult}`)
  }
  assertTargetState(options.manifest, options.adapter, options.rendererPort, target, expectedState)
  const snapshot = options.adapter.getSnapshot()
  return deepFreeze({
    name,
    requestedOffsetMeters,
    point,
    result: result.kind,
    targetState: expectedState,
    plannerRevision: snapshot.plannerRevision,
    rendererRevision: snapshot.rendererRevision,
    registryRevision: snapshot.registryRevision,
    verifiedMaterialHandles: 4 as const,
  })
}

export async function runDevelopmentRepeatSixPartBoundaryRollbackWitness(
  options: DevelopmentRepeatSixPartBoundaryRollbackWitnessOptions,
): Promise<DevelopmentRepeatSixPartBoundaryRollbackWitnessEvidence> {
  if (
    !options ||
    !isIssuedDevelopmentRepeatSixPartThreeRendererPort(options.rendererPort) ||
    !isIssuedDevelopmentRepeatSixPartAdapterRendererBinding(options.adapter, options.rendererPort)
  ) fail('an authentic issued adapter-to-Three-port pair is required')
  if (options.generation !== options.adapter.generation) fail('generation does not match the authentic adapter')
  assertExactSelector(options.manifest)
  const initial = options.adapter.getSnapshot()
  if (
    initial.state !== 'ready' ||
    initial.transactionPhase !== 'idle' ||
    initial.plannerRevision !== 0 ||
    initial.rendererRevision !== 0 ||
    initial.counters.activeUnits !== 0 ||
    initial.counters.committedUpdates !== 0
  ) fail('witness requires a fresh, ready, default-culled adapter')

  const target = selectTarget(options.manifest)
  const source = options.manifest.catalog.sources[target.sourceIndex]
  if (!source || source.id !== target.sourceId) fail('global minimum-X target has no exact source')
  const points = targetPoints(target)
  const independentlyEntering = options.manifest.catalog.units.filter(
    (unit) => linfDistanceToClosedBounds(points.entryExact, unit.bounds) <= ENTER_MARGIN_METERS,
  )
  if (independentlyEntering.length !== 1 || independentlyEntering[0].id !== target.id) {
    fail('the exact 3.5 m boundary target is not spatially isolated')
  }

  const boundarySteps: DevelopmentRepeatSixPartBoundaryStepEvidence[] = []
  boundarySteps.push(await applyExpected(options, target, 'entry-epsilon-outside-from-culled', ENTER_MARGIN_METERS + EPSILON_METERS, points.entryOutside, 'no-op', 'culled'))
  boundarySteps.push(await applyExpected(options, target, 'entry-exact-closed-boundary', ENTER_MARGIN_METERS, points.entryExact, 'committed', 'active'))
  boundarySteps.push(await applyExpected(options, target, 'entry-epsilon-inside-while-active', ENTER_MARGIN_METERS - EPSILON_METERS, points.entryInside, 'no-op', 'active'))
  boundarySteps.push(await applyExpected(options, target, 'deadband-outbound-retains-active', DEADBAND_OFFSET_METERS, points.deadband, 'no-op', 'active'))
  boundarySteps.push(await applyExpected(options, target, 'exit-exact-closed-boundary', EXIT_MARGIN_METERS, points.exitExact, 'no-op', 'active'))
  boundarySteps.push(await applyExpected(options, target, 'exit-epsilon-outside-culls', EXIT_MARGIN_METERS + EPSILON_METERS, points.exitOutside, 'committed', 'culled'))
  boundarySteps.push(await applyExpected(options, target, 'deadband-inbound-retains-culled', DEADBAND_OFFSET_METERS, points.deadband, 'no-op', 'culled'))
  boundarySteps.push(await applyExpected(options, target, 'entry-epsilon-outside-retains-culled', ENTER_MARGIN_METERS + EPSILON_METERS, points.entryOutside, 'no-op', 'culled'))
  boundarySteps.push(await applyExpected(options, target, 'entry-exact-reactivates', ENTER_MARGIN_METERS, points.entryExact, 'committed', 'active'))

  let rapidCommitted = 0
  let rapidNoOp = 0
  for (let cycle = 0; cycle < RAPID_CHURN_CYCLES; cycle += 1) {
    const steps = [
      await applyExpected(options, target, `rapid-${cycle}-deadband-active`, DEADBAND_OFFSET_METERS, points.deadband, 'no-op', 'active'),
      await applyExpected(options, target, `rapid-${cycle}-exit`, EXIT_MARGIN_METERS + EPSILON_METERS, points.exitOutside, 'committed', 'culled'),
      await applyExpected(options, target, `rapid-${cycle}-deadband-culled`, DEADBAND_OFFSET_METERS, points.deadband, 'no-op', 'culled'),
      await applyExpected(options, target, `rapid-${cycle}-entry`, ENTER_MARGIN_METERS, points.entryExact, 'committed', 'active'),
    ]
    rapidCommitted += steps.filter((step) => step.result === 'committed').length
    rapidNoOp += steps.filter((step) => step.result === 'no-op').length
  }
  if (rapidCommitted !== 8 || rapidNoOp !== 8) fail('rapid sequential churn did not produce the exact 8/8 commit/no-op history')

  const keys = allListKeys(options.manifest)
  const stableAdapter = options.adapter.getSnapshot()
  const stableHandles = captureTargetHandles(options.adapter, target)
  const stablePhysical = capturePhysicalLists(options.rendererPort, keys)
  const controller = new AbortController()
  const pending = options.adapter.updateFocus({
    generation: options.generation,
    focus: { space: 'owner-local', point: points.exitOutside },
    signal: controller.signal,
  })
  const transientRendererRevision = options.rendererPort.getRevision()
  if (transientRendererRevision !== stableAdapter.rendererRevision + 1) {
    fail('synchronous transient publication was not observed before abort')
  }
  const transientTargetList = options.rendererPort.getListSnapshot(
    listKey(source.parity, target.segmentIndex, 0),
  )
  if (transientTargetList.activeCount !== 0 || transientTargetList.visible !== false) {
    fail('transient after-publish state did not contain the requested cull')
  }
  controller.abort()
  const cancelled = await pending
  if (cancelled.kind !== 'cancelled' || cancelled.cancellationStage !== 'after-publish') {
    fail(`abort returned ${cancelled.kind}/${cancelled.cancellationStage}; expected cancelled/after-publish`)
  }

  const restoredAdapter = options.adapter.getSnapshot()
  const restoredPhysical = capturePhysicalLists(options.rendererPort, keys)
  const restoredHandles = captureTargetHandles(options.adapter, target)
  assertPhysicalListsEqual(stablePhysical, restoredPhysical)
  if (JSON.stringify(stableHandles) !== JSON.stringify(restoredHandles)) fail('four target logical handles were not restored')
  if (
    restoredAdapter.state !== 'ready' ||
    restoredAdapter.transactionPhase !== 'idle' ||
    restoredAdapter.plannerRevision !== stableAdapter.plannerRevision ||
    restoredAdapter.registryRevision !== stableAdapter.registryRevision ||
    restoredAdapter.rendererRevision !== stableAdapter.rendererRevision + 2 ||
    restoredAdapter.counters.activeUnits !== stableAdapter.counters.activeUnits ||
    restoredAdapter.counters.activeLists !== stableAdapter.counters.activeLists ||
    restoredAdapter.counters.submittedTriangles !== stableAdapter.counters.submittedTriangles ||
    restoredAdapter.counters.submittedDraws !== stableAdapter.counters.submittedDraws ||
    restoredAdapter.counters.rendererRollbackAttempts !== stableAdapter.counters.rendererRollbackAttempts + 1 ||
    restoredAdapter.counters.verifiedAtomicRollbacks !== stableAdapter.counters.verifiedAtomicRollbacks + 1
  ) fail('planner, registry, renderer revision, or active counters were not restored after abort')
  assertTargetState(options.manifest, options.adapter, options.rendererPort, target, 'active')

  const finalResult = await options.adapter.updateFocus({
    generation: options.generation,
    focus: { space: 'owner-local', point: points.entryExact },
  })
  if (finalResult.kind !== 'no-op' || finalResult.cancellationStage !== null) {
    fail('final requested focus was not restored as the active no-op state')
  }
  assertTargetState(options.manifest, options.adapter, options.rendererPort, target, 'active')

  return deepFreeze({
    kind: 'development-repeat-six-part-boundary-rollback-witness' as const,
    developmentOnly: true as const,
    generation: options.generation,
    selector: {
      boundsType: 'closed-aabb' as const,
      distanceMetric: 'linf-point-to-closed-aabb' as const,
      enterMarginMeters: 3.5 as const,
      exitMarginMeters: 5.5 as const,
      epsilonMeters: 0.000001 as const,
    },
    target: {
      unitKey: target.id,
      unitIndex: target.index,
      sourceId: target.sourceId,
      sourceIndex: target.sourceIndex,
      segmentId: target.segmentId,
      segmentIndex: target.segmentIndex,
      parity: source.parity,
      bounds: {
        space: target.bounds.space,
        min: vec3(target.bounds.min),
        max: vec3(target.bounds.max),
      },
      verifiedMaterialHandles: 4 as const,
    },
    boundarySteps: Object.freeze(boundarySteps),
    rapidSequentialChurn: {
      cycles: 4 as const,
      updates: 16 as const,
      committed: 8 as const,
      noOp: 8 as const,
      finalTargetState: 'active' as const,
    },
    afterPublishCancellation: {
      result: 'cancelled' as const,
      cancellationStage: 'after-publish' as const,
      transientPublicationObserved: true as const,
      all48PhysicalListsRestored: true as const,
      persistentMeshIdentitiesRetained: true as const,
      plannerRevisionRestored: true as const,
      registryRevisionRestored: true as const,
      activeStateRestored: true as const,
      verifiedMaterialHandles: 4 as const,
      rendererRevisionBefore: stableAdapter.rendererRevision,
      transientRendererRevision,
      rendererRevisionAfter: restoredAdapter.rendererRevision,
      rendererRevisionAdvance: 2 as const,
    },
    finalRequestedFocus: {
      point: points.entryExact,
      result: 'no-op' as const,
      targetState: 'active' as const,
      appliedAfterRollback: true as const,
    },
    activationAuthorized: false as const,
    activationCapability: null,
  })
}
