/**
 * Dormant, renderer-independent ownership handoff for the exact six-part
 * repeat catalog.
 *
 * The forward transaction deliberately stages work in one fixed order:
 *
 *   1. publish the prepared persistent replacement (not observer-visible),
 *   2. retire exactly the four pinned production instancing roots (staged),
 *   3. atomically expose replacement-only ownership.
 *
 * Until step 3 is acknowledged by an atomic renderer adapter, observers see
 * the original four roots only. There is no public state representing both
 * ownership paths. This module performs no I/O and owns no Three.js objects;
 * it is an isolated contract for a future development adapter.
 */

import {
  isIssuedRepeatSixPartActiveListCommit,
  type RepeatSixPartActiveListCommit,
} from './RepeatSixPartActiveListPlanner'
import {
  areIssuedLogicalSegmentEvidenceFromSameRegistry,
  isIssuedLogicalSegmentMutationGuard,
  isIssuedLogicalSegmentRegistrySnapshot,
  type LogicalSegmentMutationGuard,
  type LogicalSegmentRegistrySnapshot,
} from './LogicalSegmentIdentityRegistry'
const PINNED_PRODUCTION_ROOT_IDS = [
  'scene/0/258',
  'scene/0/259',
  'scene/0/260',
  'scene/0/261',
] as const

export const REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS = Object.freeze(
  [...PINNED_PRODUCTION_ROOT_IDS],
) as readonly [
  'scene/0/258',
  'scene/0/259',
  'scene/0/260',
  'scene/0/261',
]

export const REPEAT_SIX_PART_REPLACEMENT_OWNER_ID =
  'ground-floor-anim1/repeat-six-part-persistent-catalog-v4' as const

export const REPEAT_SIX_PART_HANDOFF_COUNTS = Object.freeze({
  logicalSources: 78,
  segments: 468,
  plannerUnits: 468,
  materials: 4,
  physicalUnits: 1_872,
  persistentLists: 48,
  originalProductionRoots: 4,
})

export type RepeatSixPartProductionInstancingRootId =
  typeof REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS[number]

export type RepeatSixPartSourceOwnershipVisibility = Readonly<{
  mode: 'original-production-roots' | 'replacement-persistent-catalog'
  originalProductionRootIds: readonly RepeatSixPartProductionInstancingRootId[]
  replacementOwnerId: typeof REPEAT_SIX_PART_REPLACEMENT_OWNER_ID | null
  dualOwnershipVisible: false
}>

export type RepeatSixPartSourceOwnershipEvidence = Readonly<{
  plannerCommit: RepeatSixPartActiveListCommit
  registrySnapshot: LogicalSegmentRegistrySnapshot
  registryMutationGuard: LogicalSegmentMutationGuard
}>

export type RepeatSixPartSourceOwnershipHandoffRequest = Readonly<{
  generation: number
  ownershipRevision: number
  evidence: RepeatSixPartSourceOwnershipEvidence
}>

export type RepeatSixPartSourceOwnershipHandoffToken = Readonly<{
  kind: 'repeat-six-part-source-ownership-handoff-token'
  generation: number
  ownershipBaseRevision: number
  plannerRevision: number
  registryRevision: number
  transactionSequence: number
}>

type ForwardCommandBase = Readonly<{
  token: RepeatSixPartSourceOwnershipHandoffToken
  generation: number
  ownershipBaseRevision: number
  operationSequence: number
  observerVisibility: 'staged-not-observer-visible'
}>

export type RepeatSixPartPublishReplacementCommand = ForwardCommandBase & Readonly<{
  kind: 'publish-replacement'
  replacementOwnerId: typeof REPEAT_SIX_PART_REPLACEMENT_OWNER_ID
  plannerCommit: RepeatSixPartActiveListCommit
  registryMutationGuard: LogicalSegmentMutationGuard
}>

export type RepeatSixPartRetireOriginalRootCommand = ForwardCommandBase & Readonly<{
  kind: 'retire-original-production-root'
  rootId: RepeatSixPartProductionInstancingRootId
  rootOrdinal: 0 | 1 | 2 | 3
}>

export type RepeatSixPartAtomicOwnershipCommitCommand = ForwardCommandBase & Readonly<{
  kind: 'commit-atomic-ownership-replacement'
  expectedRetiredRootIds: readonly RepeatSixPartProductionInstancingRootId[]
  expectedVisibleBefore: RepeatSixPartSourceOwnershipVisibility
  expectedVisibleAfter: RepeatSixPartSourceOwnershipVisibility
}>

export type RepeatSixPartSourceOwnershipForwardCommand =
  | RepeatSixPartPublishReplacementCommand
  | RepeatSixPartRetireOriginalRootCommand
  | RepeatSixPartAtomicOwnershipCommitCommand

export type RepeatSixPartStagedOperationReceipt = Readonly<{
  kind: 'repeat-six-part-staged-operation-receipt'
  token: RepeatSixPartSourceOwnershipHandoffToken
  command: RepeatSixPartPublishReplacementCommand | RepeatSixPartRetireOriginalRootCommand
  generation: number
  ownershipBaseRevision: number
  outcome: 'staged-not-observer-visible'
}>

export type RepeatSixPartAtomicOwnershipCommitReceipt = Readonly<{
  kind: 'repeat-six-part-atomic-ownership-commit-receipt'
  token: RepeatSixPartSourceOwnershipHandoffToken
  command: RepeatSixPartAtomicOwnershipCommitCommand
  generation: number
  ownershipBaseRevision: number
  committedAtomically: true
  operationOrder: readonly string[]
  retiredOriginalRootIds: readonly RepeatSixPartProductionInstancingRootId[]
  observerVisibleBefore: RepeatSixPartSourceOwnershipVisibility
  observerVisibleAfter: RepeatSixPartSourceOwnershipVisibility
}>

type RollbackCommandBase = Readonly<{
  token: RepeatSixPartSourceOwnershipHandoffToken
  generation: number
  ownershipBaseRevision: number
  rollbackSequence: number
  observerVisibility: 'staged-not-observer-visible'
}>

export type RepeatSixPartRestoreOriginalRootCommand = RollbackCommandBase & Readonly<{
  kind: 'restore-original-production-root'
  rootId: RepeatSixPartProductionInstancingRootId
  rootOrdinal: 0 | 1 | 2 | 3
}>

export type RepeatSixPartUnpublishReplacementCommand = RollbackCommandBase & Readonly<{
  kind: 'unpublish-replacement'
  replacementOwnerId: typeof REPEAT_SIX_PART_REPLACEMENT_OWNER_ID
}>

export type RepeatSixPartSourceOwnershipRollbackCommand =
  | RepeatSixPartRestoreOriginalRootCommand
  | RepeatSixPartUnpublishReplacementCommand

export type RepeatSixPartRollbackOperationReceipt = Readonly<{
  kind: 'repeat-six-part-rollback-operation-receipt'
  token: RepeatSixPartSourceOwnershipHandoffToken
  command: RepeatSixPartSourceOwnershipRollbackCommand
  generation: number
  ownershipBaseRevision: number
  outcome: 'rolled-back-staged-operation'
}>

export type RepeatSixPartSourceOwnershipObserverEvent =
  | 'prepared'
  | 'staged-operation-acknowledged'
  | 'rollback-started'
  | 'rollback-operation-acknowledged'
  | 'cancelled'
  | 'rolled-back'
  | 'committed'
  | 'dispose-requested'
  | 'disposed'
  | 'fail-stop-requested'
  | 'fail-stopped'
  | 'rollback-failed'

export type RepeatSixPartSourceOwnershipObserverReceipt = Readonly<{
  kind: 'repeat-six-part-source-ownership-observer-receipt'
  observerSequence: number
  event: RepeatSixPartSourceOwnershipObserverEvent
  generation: number
  ownershipRevision: number
  transactionSequence: number | null
  transactionPhase:
    | 'idle'
    | 'prepared'
    | 'staging-forward'
    | 'ready-to-commit'
    | 'rolling-back'
    | 'committed'
    | 'fail-stopped'
    | 'disposed'
  visibleOwnership: RepeatSixPartSourceOwnershipVisibility
  visibilityAssured: boolean
  stagedOperationCount: number
  detail: string
}>

export type RepeatSixPartSourceOwnershipHandoffSnapshot = Readonly<{
  generation: number
  ownershipRevision: number
  state:
    | 'idle'
    | 'prepared'
    | 'staging-forward'
    | 'ready-to-commit'
    | 'rolling-back'
    | 'committed'
    | 'fail-stopped'
    | 'disposed'
  visibleOwnership: RepeatSixPartSourceOwnershipVisibility
  visibilityAssured: boolean
  pendingTransactionSequence: number | null
  nextForwardOperationSequence: number | null
  nextRollbackSequence: number | null
  stagedOperationCount: number
  disposed: boolean
  failStopped: boolean
  terminalReason: string | null
  observerReceiptCount: number
}>

// Authenticity is intentionally identity-based and module-private. Structural
// clones may be useful for logging, but they are not authoritative inputs at a
// runtime ownership boundary.
const issuedHandoffTokenOwners = new WeakMap<object, object>()
const issuedHandoffSnapshotOwners = new WeakMap<object, object>()

export function isIssuedRepeatSixPartSourceOwnershipHandoffToken(
  value: unknown,
): value is RepeatSixPartSourceOwnershipHandoffToken {
  return isRecord(value) && issuedHandoffTokenOwners.has(value)
}

export function isIssuedRepeatSixPartSourceOwnershipHandoffSnapshot(
  value: unknown,
): value is RepeatSixPartSourceOwnershipHandoffSnapshot {
  return isRecord(value) && issuedHandoffSnapshotOwners.has(value)
}

export function areIssuedRepeatSixPartSourceOwnershipEvidenceFromSameCoordinator(
  token: unknown,
  snapshot: unknown,
): token is RepeatSixPartSourceOwnershipHandoffToken {
  if (
    !isRecord(token) ||
    !isRecord(snapshot) ||
    !issuedHandoffTokenOwners.has(token) ||
    !issuedHandoffSnapshotOwners.has(snapshot)
  ) return false
  return issuedHandoffTokenOwners.get(token) === issuedHandoffSnapshotOwners.get(snapshot)
}

export type RepeatSixPartSourceOwnershipPreparation = Readonly<{
  kind: 'prepared-source-ownership-handoff'
  token: RepeatSixPartSourceOwnershipHandoffToken
  nextCommand: RepeatSixPartPublishReplacementCommand
  forwardOperationCount: 6
  originalProductionRootIds: readonly RepeatSixPartProductionInstancingRootId[]
}>

export type RepeatSixPartSourceOwnershipForwardProgress = Readonly<{
  kind: 'source-ownership-forward-progress'
  token: RepeatSixPartSourceOwnershipHandoffToken
  acknowledgedCommand: RepeatSixPartPublishReplacementCommand | RepeatSixPartRetireOriginalRootCommand
  nextCommand: RepeatSixPartSourceOwnershipForwardCommand
  stagedOperationCount: number
}>

export type RepeatSixPartSourceOwnershipRollbackProgress = Readonly<{
  kind: 'source-ownership-rollback-progress'
  token: RepeatSixPartSourceOwnershipHandoffToken
  reason: string
  nextCommand: RepeatSixPartSourceOwnershipRollbackCommand | null
  rollbackPending: boolean
  terminalAfterRollback: 'idle' | 'disposed' | 'fail-stopped'
}>

export type RepeatSixPartSourceOwnershipCommitResult = Readonly<{
  kind: 'committed-source-ownership-handoff'
  token: RepeatSixPartSourceOwnershipHandoffToken
  ownershipRevision: number
  retiredOriginalRootIds: readonly RepeatSixPartProductionInstancingRootId[]
  visibleOwnership: RepeatSixPartSourceOwnershipVisibility
  observerReceipt: RepeatSixPartSourceOwnershipObserverReceipt
}>

export type RepeatSixPartSourceOwnershipDisposalResult = Readonly<{
  kind: 'disposed' | 'dispose-pending-rollback'
  disposed: boolean
  rollback: RepeatSixPartSourceOwnershipRollbackProgress | null
}>

export type RepeatSixPartSourceOwnershipHandoffErrorCode =
  | 'INVALID_CONTRACT'
  | 'STALE_GENERATION'
  | 'STALE_REVISION'
  | 'TRANSACTION_STATE'
  | 'FAIL_STOPPED'
  | 'DISPOSED'

export class RepeatSixPartSourceOwnershipHandoffError extends Error {
  readonly code: RepeatSixPartSourceOwnershipHandoffErrorCode

  constructor(code: RepeatSixPartSourceOwnershipHandoffErrorCode, message: string) {
    super(message)
    this.name = 'RepeatSixPartSourceOwnershipHandoffError'
    this.code = code
  }
}

export class StaleRepeatSixPartSourceOwnershipGenerationError
  extends RepeatSixPartSourceOwnershipHandoffError {
  constructor(expected: number, observed: number) {
    super('STALE_GENERATION', `Stale source-ownership generation ${observed}; current generation is ${expected}`)
    this.name = 'StaleRepeatSixPartSourceOwnershipGenerationError'
  }
}

export class StaleRepeatSixPartSourceOwnershipRevisionError
  extends RepeatSixPartSourceOwnershipHandoffError {
  constructor(expected: number, observed: number) {
    super('STALE_REVISION', `Stale source-ownership revision ${observed}; current revision is ${expected}`)
    this.name = 'StaleRepeatSixPartSourceOwnershipRevisionError'
  }
}

type TerminalAfterRollback = 'idle' | 'disposed' | 'fail-stopped'

type PendingHandoff = {
  token: RepeatSixPartSourceOwnershipHandoffToken
  evidence: RepeatSixPartSourceOwnershipEvidence
  forwardCommands: readonly RepeatSixPartSourceOwnershipForwardCommand[]
  forwardIndex: number
  stagedCommands: Array<RepeatSixPartPublishReplacementCommand | RepeatSixPartRetireOriginalRootCommand>
  rollbackCommands: readonly RepeatSixPartSourceOwnershipRollbackCommand[]
  rollbackIndex: number
  terminalAfterRollback: TerminalAfterRollback
  terminalReason: string
  phase: 'forward' | 'rolling-back'
}

const ORIGINAL_VISIBILITY: RepeatSixPartSourceOwnershipVisibility = Object.freeze({
  mode: 'original-production-roots' as const,
  originalProductionRootIds: REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS,
  replacementOwnerId: null,
  dualOwnershipVisible: false as const,
})

const REPLACEMENT_VISIBILITY: RepeatSixPartSourceOwnershipVisibility = Object.freeze({
  mode: 'replacement-persistent-catalog' as const,
  originalProductionRootIds: Object.freeze([]) as readonly RepeatSixPartProductionInstancingRootId[],
  replacementOwnerId: REPEAT_SIX_PART_REPLACEMENT_OWNER_ID,
  dualOwnershipVisible: false as const,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function immutableSnapshot<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value
  const existing = seen.get(value)
  if (existing) return existing as T
  if (Array.isArray(value)) {
    const copy: unknown[] = []
    seen.set(value, copy)
    for (const entry of value) copy.push(immutableSnapshot(entry, seen))
    return Object.freeze(copy) as T
  }
  const copy: Record<string, unknown> = {}
  seen.set(value, copy)
  for (const key of Object.keys(value)) copy[key] = immutableSnapshot((value as Record<string, unknown>)[key], seen)
  return Object.freeze(copy) as T
}

function exactValueEqual(left: unknown, right: unknown): boolean {
  if (typeof left === 'number' && typeof right === 'number') return Object.is(left, right)
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((entry, index) => exactValueEqual(entry, right[index]))
  }
  if (!isRecord(left) || !isRecord(right)) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return arraysEqual(leftKeys, rightKeys) && leftKeys.every((key) => exactValueEqual(left[key], right[key]))
}

function assertSafeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      `${label} must be a non-negative safe integer`,
    )
  }
}

function assertTrimmedString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      `${label} must be a non-empty, trimmed string`,
    )
  }
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function cloneVisibility(
  value: RepeatSixPartSourceOwnershipVisibility,
): RepeatSixPartSourceOwnershipVisibility {
  return Object.freeze({
    mode: value.mode,
    originalProductionRootIds: Object.freeze([...value.originalProductionRootIds]),
    replacementOwnerId: value.replacementOwnerId,
    dualOwnershipVisible: false as const,
  })
}

function assertVisibility(
  value: unknown,
  expected: RepeatSixPartSourceOwnershipVisibility,
  label: string,
): void {
  if (!isRecord(value)) {
    throw new RepeatSixPartSourceOwnershipHandoffError('INVALID_CONTRACT', `${label} must be an object`)
  }
  const roots = value.originalProductionRootIds
  if (
    value.mode !== expected.mode ||
    !Array.isArray(roots) ||
    !arraysEqual(roots, expected.originalProductionRootIds) ||
    value.replacementOwnerId !== expected.replacementOwnerId ||
    value.dualOwnershipVisible !== false
  ) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      `${label} does not prove exclusive observer-visible ownership`,
    )
  }
}

function assertRegistryEvidence(
  snapshot: LogicalSegmentRegistrySnapshot,
  guard: LogicalSegmentMutationGuard,
  generation: number,
  activePlannerUnits: number,
): void {
  if (
    !isIssuedLogicalSegmentRegistrySnapshot(snapshot) ||
    !isIssuedLogicalSegmentMutationGuard(guard) ||
    !areIssuedLogicalSegmentEvidenceFromSameRegistry(snapshot, guard)
  ) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      'Registry snapshot and mutation guard must be authentic values issued by the same registry instance',
    )
  }
  if (snapshot.layerGeneration !== generation || guard.layerGeneration !== generation) {
    const observed = snapshot.layerGeneration !== generation
      ? snapshot.layerGeneration
      : guard.layerGeneration
    throw new StaleRepeatSixPartSourceOwnershipGenerationError(generation, observed)
  }
  if (snapshot.revision !== guard.revision) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      'Registry snapshot revision must equal the supplied registry mutation guard',
    )
  }
  const expected = REPEAT_SIX_PART_HANDOFF_COUNTS
  if (
    snapshot.disposed ||
    snapshot.logicalSources !== expected.logicalSources ||
    snapshot.segments !== expected.segments ||
    snapshot.expectedPhysicalUnits !== expected.physicalUnits ||
    snapshot.registeredHandles !== expected.physicalUnits ||
    snapshot.completeLogicalSources !== expected.logicalSources ||
    snapshot.incompleteLogicalSources !== 0 ||
    snapshot.activePhysicalUnits !== activePlannerUnits * expected.materials ||
    snapshot.culledPhysicalUnits !== (expected.plannerUnits - activePlannerUnits) * expected.materials
  ) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      'Registry evidence is not a complete 78 x 6 x 4 persistent catalog matching planner activity',
    )
  }
}

function assertPlannerEvidence(commit: RepeatSixPartActiveListCommit, generation: number): number {
  if (!isIssuedRepeatSixPartActiveListCommit(commit)) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      'Planner commit must be an authentic value issued by the active-list planner',
    )
  }
  if (commit.generation !== generation) {
    throw new StaleRepeatSixPartSourceOwnershipGenerationError(generation, commit.generation)
  }
  assertSafeInteger(commit.baseRevision, 'plannerCommit.baseRevision')
  assertSafeInteger(commit.revision, 'plannerCommit.revision')
  if (commit.revision !== commit.baseRevision + 1) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      'Planner commit must advance exactly one revision',
    )
  }
  if (commit.atomicReplacement !== true || commit.boundsRecomputeRequired !== true) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      'Planner evidence must be an atomic, bounds-recomputed replacement',
    )
  }
  if (!Array.isArray(commit.unitStates) || commit.unitStates.length !== REPEAT_SIX_PART_HANDOFF_COUNTS.plannerUnits) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      `Planner commit must contain exactly ${REPEAT_SIX_PART_HANDOFF_COUNTS.plannerUnits} unit states`,
    )
  }
  const unitKeys = new Set<string>()
  const activityByUnit = new Map<string, 'active' | 'culled'>()
  let activeUnits = 0
  for (const unit of commit.unitStates) {
    if (!isRecord(unit)) {
      throw new RepeatSixPartSourceOwnershipHandoffError('INVALID_CONTRACT', 'Planner unit state must be an object')
    }
    assertTrimmedString(unit.unitKey, 'plannerCommit.unitStates[].unitKey')
    if (unitKeys.has(unit.unitKey)) {
      throw new RepeatSixPartSourceOwnershipHandoffError('INVALID_CONTRACT', `Duplicate planner unit ${unit.unitKey}`)
    }
    unitKeys.add(unit.unitKey)
    if (unit.activity !== 'active' && unit.activity !== 'culled') {
      throw new RepeatSixPartSourceOwnershipHandoffError('INVALID_CONTRACT', `Invalid activity for ${unit.unitKey}`)
    }
    activityByUnit.set(unit.unitKey, unit.activity)
    if (unit.activity === 'active') activeUnits += 1
  }
  const expectedActiveUnitKeys = commit.unitStates
    .filter((unit) => unit.activity === 'active')
    .map((unit) => unit.unitKey)
  if (!Array.isArray(commit.activeUnitKeys) || !arraysEqual(commit.activeUnitKeys, expectedActiveUnitKeys)) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      'Planner activeUnitKeys must exactly match the exhaustive ordered unit-state selection',
    )
  }
  if (!Array.isArray(commit.lists) || commit.lists.length !== REPEAT_SIX_PART_HANDOFF_COUNTS.persistentLists) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      `Planner commit must contain exactly ${REPEAT_SIX_PART_HANDOFF_COUNTS.persistentLists} persistent lists`,
    )
  }
  const expectedListKeys: string[] = []
  for (const parity of ['positive', 'mirrored'] as const) {
    for (let segmentIndex = 0; segmentIndex < 6; segmentIndex += 1) {
      for (let materialIndex = 0; materialIndex < 4; materialIndex += 1) {
        expectedListKeys.push(
          `${parity}:segment-${String(segmentIndex).padStart(2, '0')}:material-${String(materialIndex).padStart(2, '0')}`,
        )
      }
    }
  }
  const observedListKeys = new Set<string>()
  const coveredUnitKeys = new Set<string>()
  const sourceIdentity = new Map<number, { sourceId: string; parity: 'positive' | 'mirrored'; matrix: unknown }>()
  const segmentIds = new Map<number, string>()
  for (let listIndex = 0; listIndex < commit.lists.length; listIndex += 1) {
    const list = commit.lists[listIndex]
    assertTrimmedString(list.key, 'plannerCommit.lists[].key')
    const semanticKey = `${String(list.parity)}:segment-${String(list.segmentIndex).padStart(2, '0')}:material-${String(list.materialIndex).padStart(2, '0')}`
    if (list.key !== expectedListKeys[listIndex] || list.key !== semanticKey || observedListKeys.has(list.key)) {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'INVALID_CONTRACT',
        `Planner list catalog is out of order, aliased, or semantically mismatched at ${semanticKey}`,
      )
    }
    observedListKeys.add(list.key)
    assertTrimmedString(list.segmentId, `${list.key}.segmentId`)
    const knownSegmentId = segmentIds.get(list.segmentIndex)
    if (knownSegmentId !== undefined && knownSegmentId !== list.segmentId) {
      throw new RepeatSixPartSourceOwnershipHandoffError('INVALID_CONTRACT', `Segment identity changed in ${list.key}`)
    }
    segmentIds.set(list.segmentIndex, list.segmentId)
    const expectedCapacity = list.parity === 'positive' ? 40 : 38
    if (
      list.capacity !== expectedCapacity ||
      !Number.isSafeInteger(list.activeCount) ||
      list.activeCount < 0 ||
      list.activeCount > expectedCapacity ||
      list.present !== (list.activeCount > 0) ||
      list.visible !== list.present ||
      list.submittedDraws !== (list.present ? 1 : 0) ||
      !Array.isArray(list.unitKeys) ||
      list.unitKeys.length !== list.activeCount ||
      !Array.isArray(list.matrices) ||
      list.matrices.length !== list.activeCount ||
      !Array.isArray(list.slotToUnit) ||
      list.slotToUnit.length !== list.activeCount ||
      !Array.isArray(list.completeSlotPermutation) ||
      list.completeSlotPermutation.length !== expectedCapacity ||
      !Array.isArray(list.completeSlotMatrices) ||
      list.completeSlotMatrices.length !== expectedCapacity ||
      list.instanceMatrixUpdateRequired !== true ||
      list.boundsRecomputeRequired !== true
    ) {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'INVALID_CONTRACT',
        `Planner list ${list.key} does not contain its complete persistent permutation`,
      )
    }
    if ((list.activeCount === 0) !== (list.ownerLocalBounds === null) ||
        (list.activeCount === 0) !== (list.renderLocalBounds === null)) {
      throw new RepeatSixPartSourceOwnershipHandoffError('INVALID_CONTRACT', `Planner list ${list.key} has stale bounds`)
    }

    const observedSources = new Set<number>()
    for (let slot = 0; slot < list.completeSlotPermutation.length; slot += 1) {
      const entry = list.completeSlotPermutation[slot]
      const matrix = list.completeSlotMatrices[slot]
      if (
        entry.slot !== slot ||
        !Number.isSafeInteger(entry.sourceIndex) ||
        entry.sourceIndex < 0 ||
        entry.sourceIndex >= REPEAT_SIX_PART_HANDOFF_COUNTS.logicalSources ||
        entry.unitIndex !== entry.sourceIndex * 6 + list.segmentIndex ||
        observedSources.has(entry.sourceIndex) ||
        !unitKeys.has(entry.unitKey) ||
        activityByUnit.get(entry.unitKey) !== entry.activity ||
        entry.activity !== (slot < list.activeCount ? 'active' : 'culled') ||
        !Array.isArray(matrix) ||
        matrix.length !== 16 ||
        !matrix.every(Number.isFinite)
      ) {
        throw new RepeatSixPartSourceOwnershipHandoffError(
          'INVALID_CONTRACT',
          `Planner list ${list.key} has an invalid complete slot at ${slot}`,
        )
      }
      assertTrimmedString(entry.unitKey, `${list.key}.completeSlotPermutation[${slot}].unitKey`)
      assertTrimmedString(entry.sourceId, `${list.key}.completeSlotPermutation[${slot}].sourceId`)
      observedSources.add(entry.sourceIndex)

      if (list.materialIndex === 0) {
        if (coveredUnitKeys.has(entry.unitKey)) {
          throw new RepeatSixPartSourceOwnershipHandoffError('INVALID_CONTRACT', `Planner unit ${entry.unitKey} is duplicated`)
        }
        coveredUnitKeys.add(entry.unitKey)
        const knownSource = sourceIdentity.get(entry.sourceIndex)
        if (knownSource) {
          if (knownSource.sourceId !== entry.sourceId || knownSource.parity !== list.parity ||
              !exactValueEqual(knownSource.matrix, matrix)) {
            throw new RepeatSixPartSourceOwnershipHandoffError(
              'INVALID_CONTRACT',
              `Source ${entry.sourceIndex} changes identity, parity, or matrix across segments`,
            )
          }
        } else {
          sourceIdentity.set(entry.sourceIndex, { sourceId: entry.sourceId, parity: list.parity, matrix })
        }
      }

      if (slot < list.activeCount) {
        const activeEntry = list.slotToUnit[slot]
        if (
          list.unitKeys[slot] !== entry.unitKey ||
          !exactValueEqual(activeEntry, entry) ||
          !exactValueEqual(list.matrices[slot], matrix)
        ) {
          throw new RepeatSixPartSourceOwnershipHandoffError(
            'INVALID_CONTRACT',
            `Planner list ${list.key} active slot ${slot} does not match its complete permutation`,
          )
        }
      }
    }

    const groupStart = listIndex - list.materialIndex
    const groupReference = commit.lists[groupStart]
    if (list.materialIndex > 0 && (
      list.parity !== groupReference.parity ||
      list.segmentIndex !== groupReference.segmentIndex ||
      list.segmentId !== groupReference.segmentId ||
      list.activeCount !== groupReference.activeCount ||
      list.unitKeys !== groupReference.unitKeys ||
      list.matrices !== groupReference.matrices ||
      list.slotToUnit !== groupReference.slotToUnit ||
      list.completeSlotPermutation !== groupReference.completeSlotPermutation ||
      list.completeSlotMatrices !== groupReference.completeSlotMatrices ||
      list.ownerLocalBounds !== groupReference.ownerLocalBounds ||
      list.renderLocalBounds !== groupReference.renderLocalBounds
    )) {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'INVALID_CONTRACT',
        `Material list ${list.key} is not the same atomic parity/segment selection`,
      )
    }
  }
  if (
    coveredUnitKeys.size !== REPEAT_SIX_PART_HANDOFF_COUNTS.plannerUnits ||
    [...unitKeys].some((unitKey) => !coveredUnitKeys.has(unitKey)) ||
    sourceIdentity.size !== REPEAT_SIX_PART_HANDOFF_COUNTS.logicalSources
  ) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      'Complete permutations must cover every one of the 468 units and 78 source identities exactly once per segment',
    )
  }
  if (commit.groups.length !== 12) {
    throw new RepeatSixPartSourceOwnershipHandoffError('INVALID_CONTRACT', 'Planner commit must contain 12 exact parity/segment groups')
  }
  let submittedTriangles = 0
  let submittedDraws = 0
  for (let groupIndex = 0; groupIndex < commit.groups.length; groupIndex += 1) {
    const group = commit.groups[groupIndex]
    const parity = groupIndex < 6 ? 'positive' : 'mirrored'
    const segmentIndex = groupIndex % 6
    const expectedGroupKey = `${parity}:segment-${String(segmentIndex).padStart(2, '0')}`
    const reference = commit.lists[groupIndex * 4]
    const materialLists = commit.lists.slice(groupIndex * 4, groupIndex * 4 + 4)
    if (
      group.key !== expectedGroupKey ||
      group.parity !== parity ||
      group.segmentIndex !== segmentIndex ||
      group.segmentId !== reference.segmentId ||
      group.activeCount !== reference.activeCount ||
      group.unitKeys !== reference.unitKeys ||
      group.matrices !== reference.matrices ||
      group.slotToUnit !== reference.slotToUnit ||
      group.completeSlotPermutation !== reference.completeSlotPermutation ||
      group.completeSlotMatrices !== reference.completeSlotMatrices ||
      group.ownerLocalBounds !== reference.ownerLocalBounds ||
      group.renderLocalBounds !== reference.renderLocalBounds ||
      group.materialLists.length !== 4 ||
      !group.materialLists.every((list, index) => list === materialLists[index]) ||
      !Number.isSafeInteger(group.submittedTriangles) ||
      group.submittedTriangles < 0 ||
      (group.activeCount === 0 ? group.submittedTriangles !== 0 : group.submittedTriangles % group.activeCount !== 0) ||
      group.submittedDraws !== (group.activeCount > 0 ? 4 : 0)
    ) {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'INVALID_CONTRACT',
        `Planner group ${expectedGroupKey} is not the exact four-material catalog view`,
      )
    }
    submittedTriangles += group.submittedTriangles
    submittedDraws += group.submittedDraws
  }
  const expectedActiveLists = commit.lists.filter((list) => list.present)
  if (
    !Array.isArray(commit.activeLists) ||
    !arraysEqual(commit.activeLists, expectedActiveLists) ||
    !Array.isArray(commit.dirtyListKeys) ||
    !arraysEqual(commit.dirtyListKeys, expectedListKeys)
  ) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      'Active and dirty list projections must preserve the exact 48-list catalog identities',
    )
  }
  if (
    observedListKeys.size !== expectedListKeys.length ||
    !isRecord(commit.metrics) ||
    commit.metrics.activeUnits !== activeUnits ||
    commit.metrics.culledUnits !== REPEAT_SIX_PART_HANDOFF_COUNTS.plannerUnits - activeUnits ||
    commit.metrics.activeParitySegmentGroups !== commit.groups.filter((group) => group.activeCount > 0).length ||
    commit.metrics.activeLists !== expectedActiveLists.length ||
    commit.metrics.hiddenLists !== expectedListKeys.length - expectedActiveLists.length ||
    commit.metrics.submittedTriangles !== submittedTriangles ||
    commit.metrics.submittedDraws !== submittedDraws ||
    !isRecord(commit.metrics.initialSourceOwnershipRewrite) ||
    commit.metrics.initialSourceOwnershipRewrite.provenByThisKernel !== false ||
    commit.metrics.initialSourceOwnershipRewrite.schedule !== null ||
    commit.metrics.initialSourceOwnershipRewrite.note !== 'offline-build-responsibility'
  ) {
    throw new RepeatSixPartSourceOwnershipHandoffError(
      'INVALID_CONTRACT',
      'Planner metrics or source-ownership boundary do not match the complete catalog',
    )
  }
  return activeUnits
}

function operationAuditEntry(command: RepeatSixPartSourceOwnershipForwardCommand): string {
  if (command.kind === 'publish-replacement') return `publish:${command.replacementOwnerId}`
  if (command.kind === 'retire-original-production-root') return `retire:${command.rootId}`
  return 'commit:atomic-ownership-replacement'
}

function assertReason(value: unknown): asserts value is string {
  assertTrimmedString(value, 'reason')
}

/**
 * Single-use-on-success state machine. A cancelled transaction may be retried
 * at the same ownership revision; a successful commit is terminal because the
 * original production roots no longer own the repeated family.
 */
export class RepeatSixPartSourceOwnershipHandoffCoordinator {
  readonly generation: number

  private ownershipRevision = 0
  private transactionSequence = 0
  private observerSequence = 0
  private visibleOwnership = ORIGINAL_VISIBILITY
  private pending: PendingHandoff | null = null
  private readonly observerReceipts: RepeatSixPartSourceOwnershipObserverReceipt[] = []
  private committed = false
  private disposed = false
  private failStopped = false
  private visibilityAssured = true
  private terminalReason: string | null = null

  constructor(generation: number) {
    assertSafeInteger(generation, 'generation')
    this.generation = generation
  }

  prepare(
    request: RepeatSixPartSourceOwnershipHandoffRequest,
  ): RepeatSixPartSourceOwnershipPreparation {
    this.assertUsableForNewTransaction()
    if (this.pending) {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'TRANSACTION_STATE',
        'A source-ownership handoff is already pending',
      )
    }
    if (request?.generation !== this.generation) {
      throw new StaleRepeatSixPartSourceOwnershipGenerationError(this.generation, request?.generation)
    }
    if (request?.ownershipRevision !== this.ownershipRevision) {
      throw new StaleRepeatSixPartSourceOwnershipRevisionError(
        this.ownershipRevision,
        request?.ownershipRevision,
      )
    }
    if (!isRecord(request.evidence)) {
      throw new RepeatSixPartSourceOwnershipHandoffError('INVALID_CONTRACT', 'Handoff evidence is required')
    }
    const activePlannerUnits = assertPlannerEvidence(request.evidence.plannerCommit, this.generation)
    assertRegistryEvidence(
      request.evidence.registrySnapshot,
      request.evidence.registryMutationGuard,
      this.generation,
      activePlannerUnits,
    )
    // Never retain caller-owned aliases, even though authentic planner and
    // registry evidence is already frozen at issuance.
    const evidence = immutableSnapshot(request.evidence)

    this.transactionSequence += 1
    const token = Object.freeze({
      kind: 'repeat-six-part-source-ownership-handoff-token' as const,
      generation: this.generation,
      ownershipBaseRevision: this.ownershipRevision,
      plannerRevision: evidence.plannerCommit.revision,
      registryRevision: evidence.registryMutationGuard.revision,
      transactionSequence: this.transactionSequence,
    })
    issuedHandoffTokenOwners.set(token, this)
    const commandBase = {
      token,
      generation: this.generation,
      ownershipBaseRevision: this.ownershipRevision,
      observerVisibility: 'staged-not-observer-visible' as const,
    }
    const publishCommand: RepeatSixPartPublishReplacementCommand = Object.freeze({
      ...commandBase,
      kind: 'publish-replacement' as const,
      operationSequence: 0,
      replacementOwnerId: REPEAT_SIX_PART_REPLACEMENT_OWNER_ID,
      plannerCommit: evidence.plannerCommit,
      registryMutationGuard: evidence.registryMutationGuard,
    })
    const rootCommands = REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS.map(
      (rootId, rootOrdinal): RepeatSixPartRetireOriginalRootCommand => Object.freeze({
        ...commandBase,
        kind: 'retire-original-production-root' as const,
        operationSequence: rootOrdinal + 1,
        rootId,
        rootOrdinal: rootOrdinal as 0 | 1 | 2 | 3,
      }),
    )
    const commitCommand: RepeatSixPartAtomicOwnershipCommitCommand = Object.freeze({
      ...commandBase,
      kind: 'commit-atomic-ownership-replacement' as const,
      operationSequence: 5,
      expectedRetiredRootIds: REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS,
      expectedVisibleBefore: ORIGINAL_VISIBILITY,
      expectedVisibleAfter: REPLACEMENT_VISIBILITY,
    })
    const forwardCommands = Object.freeze([
      publishCommand,
      ...rootCommands,
      commitCommand,
    ])
    this.pending = {
      token,
      evidence,
      forwardCommands,
      forwardIndex: 0,
      stagedCommands: [],
      rollbackCommands: Object.freeze([]),
      rollbackIndex: 0,
      terminalAfterRollback: 'idle',
      terminalReason: '',
      phase: 'forward',
    }
    this.appendObserver('prepared', token.transactionSequence, 'Validated replacement and registry evidence')
    return Object.freeze({
      kind: 'prepared-source-ownership-handoff' as const,
      token,
      nextCommand: publishCommand,
      forwardOperationCount: 6 as const,
      originalProductionRootIds: REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS,
    })
  }

  getNextForwardCommand(
    token: RepeatSixPartSourceOwnershipHandoffToken,
  ): RepeatSixPartSourceOwnershipForwardCommand {
    this.assertOperational()
    const pending = this.requirePending(token)
    if (pending.phase !== 'forward') {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'TRANSACTION_STATE',
        'Forward ownership work is unavailable while rollback is in progress',
      )
    }
    return pending.forwardCommands[pending.forwardIndex]
  }

  acknowledgeStagedOperation(
    receipt: RepeatSixPartStagedOperationReceipt,
  ): RepeatSixPartSourceOwnershipForwardProgress {
    this.assertOperational()
    const pending = this.requirePending(receipt?.token)
    if (pending.phase !== 'forward') {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'TRANSACTION_STATE',
        'Cannot acknowledge a forward operation while rollback is in progress',
      )
    }
    const expected = pending.forwardCommands[pending.forwardIndex]
    if (expected.kind === 'commit-atomic-ownership-replacement') {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'TRANSACTION_STATE',
        'The next command requires an atomic commit receipt',
      )
    }
    if (
      !isRecord(receipt) ||
      receipt.kind !== 'repeat-six-part-staged-operation-receipt' ||
      receipt.command !== expected ||
      receipt.generation !== this.generation ||
      receipt.ownershipBaseRevision !== this.ownershipRevision ||
      receipt.outcome !== 'staged-not-observer-visible'
    ) {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'INVALID_CONTRACT',
        `Invalid or out-of-order staged-operation receipt for operation ${expected.operationSequence}`,
      )
    }
    pending.stagedCommands.push(expected)
    pending.forwardIndex += 1
    const nextCommand = pending.forwardCommands[pending.forwardIndex]
    this.appendObserver(
      'staged-operation-acknowledged',
      pending.token.transactionSequence,
      `Staged ${operationAuditEntry(expected)}`,
    )
    return Object.freeze({
      kind: 'source-ownership-forward-progress' as const,
      token: pending.token,
      acknowledgedCommand: expected,
      nextCommand,
      stagedOperationCount: pending.stagedCommands.length,
    })
  }

  commit(
    receipt: RepeatSixPartAtomicOwnershipCommitReceipt,
  ): RepeatSixPartSourceOwnershipCommitResult {
    this.assertOperational()
    const pending = this.requirePending(receipt?.token)
    if (pending.phase !== 'forward') {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'TRANSACTION_STATE',
        'Cannot commit source ownership while rollback is in progress',
      )
    }
    const expected = pending.forwardCommands[pending.forwardIndex]
    if (expected.kind !== 'commit-atomic-ownership-replacement') {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'TRANSACTION_STATE',
        `Atomic commit is blocked until operation ${expected.operationSequence} is acknowledged`,
      )
    }
    const expectedOrder = pending.forwardCommands.map(operationAuditEntry)
    if (
      !isRecord(receipt) ||
      receipt.kind !== 'repeat-six-part-atomic-ownership-commit-receipt' ||
      receipt.command !== expected ||
      receipt.generation !== this.generation ||
      receipt.ownershipBaseRevision !== this.ownershipRevision ||
      receipt.committedAtomically !== true ||
      !Array.isArray(receipt.operationOrder) ||
      !arraysEqual(receipt.operationOrder, expectedOrder) ||
      !Array.isArray(receipt.retiredOriginalRootIds) ||
      !arraysEqual(receipt.retiredOriginalRootIds, REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS)
    ) {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'INVALID_CONTRACT',
        'Atomic commit receipt does not prove the exact ordered ownership replacement',
      )
    }
    assertVisibility(receipt.observerVisibleBefore, ORIGINAL_VISIBILITY, 'observerVisibleBefore')
    assertVisibility(receipt.observerVisibleAfter, REPLACEMENT_VISIBILITY, 'observerVisibleAfter')

    // This is the sole observer-visible ownership mutation. Staged operations
    // never mutate visibleOwnership, so no intermediate dual-owner snapshot
    // exists in this coordinator.
    this.visibleOwnership = REPLACEMENT_VISIBILITY
    this.ownershipRevision += 1
    this.committed = true
    this.pending = null
    const observerReceipt = this.appendObserver(
      'committed',
      pending.token.transactionSequence,
      'Replacement-only ownership committed atomically after four exact root retirements',
    )
    return Object.freeze({
      kind: 'committed-source-ownership-handoff' as const,
      token: pending.token,
      ownershipRevision: this.ownershipRevision,
      retiredOriginalRootIds: REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS,
      visibleOwnership: cloneVisibility(this.visibleOwnership),
      observerReceipt,
    })
  }

  cancel(
    token: RepeatSixPartSourceOwnershipHandoffToken,
    reason: string,
  ): RepeatSixPartSourceOwnershipRollbackProgress {
    this.assertOperational()
    assertReason(reason)
    const pending = this.requirePending(token)
    if (pending.phase === 'rolling-back') return this.rollbackProgress(pending)
    return this.beginRollback(pending, 'idle', reason, 'cancelled')
  }

  failPreparedHandoff(
    token: RepeatSixPartSourceOwnershipHandoffToken,
    reason: string,
  ): RepeatSixPartSourceOwnershipRollbackProgress {
    this.assertOperational()
    assertReason(reason)
    const pending = this.requirePending(token)
    if (pending.phase === 'rolling-back') {
      pending.terminalAfterRollback = 'fail-stopped'
      pending.terminalReason = reason
      this.appendObserver('fail-stop-requested', token.transactionSequence, reason)
      return this.rollbackProgress(pending)
    }
    return this.beginRollback(pending, 'fail-stopped', reason, 'fail-stop-requested')
  }

  acknowledgeRollbackOperation(
    receipt: RepeatSixPartRollbackOperationReceipt,
  ): RepeatSixPartSourceOwnershipRollbackProgress {
    this.assertOperational()
    const pending = this.requirePending(receipt?.token)
    if (pending.phase !== 'rolling-back') {
      throw new RepeatSixPartSourceOwnershipHandoffError('TRANSACTION_STATE', 'No rollback is in progress')
    }
    const expected = pending.rollbackCommands[pending.rollbackIndex]
    if (
      !isRecord(receipt) ||
      receipt.kind !== 'repeat-six-part-rollback-operation-receipt' ||
      receipt.command !== expected ||
      receipt.generation !== this.generation ||
      receipt.ownershipBaseRevision !== this.ownershipRevision ||
      receipt.outcome !== 'rolled-back-staged-operation'
    ) {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'INVALID_CONTRACT',
        `Invalid or out-of-order rollback receipt for rollback operation ${expected.rollbackSequence}`,
      )
    }
    pending.rollbackIndex += 1
    this.appendObserver(
      'rollback-operation-acknowledged',
      pending.token.transactionSequence,
      `Rolled back ${expected.kind}`,
    )
    if (pending.rollbackIndex < pending.rollbackCommands.length) return this.rollbackProgress(pending)

    const terminal = pending.terminalAfterRollback
    const reason = pending.terminalReason
    const transactionSequence = pending.token.transactionSequence
    this.pending = null
    if (terminal === 'disposed') {
      this.disposed = true
      this.terminalReason = reason
      this.appendObserver('disposed', transactionSequence, reason)
    } else if (terminal === 'fail-stopped') {
      this.failStopped = true
      this.terminalReason = reason
      this.appendObserver('fail-stopped', transactionSequence, reason)
    } else {
      this.appendObserver('rolled-back', transactionSequence, reason)
    }
    return Object.freeze({
      kind: 'source-ownership-rollback-progress' as const,
      token: pending.token,
      reason,
      nextCommand: null,
      rollbackPending: false,
      terminalAfterRollback: terminal,
    })
  }

  reportRollbackFailure(
    token: RepeatSixPartSourceOwnershipHandoffToken,
    command: RepeatSixPartSourceOwnershipRollbackCommand,
    reason: string,
  ): RepeatSixPartSourceOwnershipObserverReceipt {
    this.assertOperational()
    assertReason(reason)
    const pending = this.requirePending(token)
    if (pending.phase !== 'rolling-back') {
      throw new RepeatSixPartSourceOwnershipHandoffError('TRANSACTION_STATE', 'No rollback is in progress')
    }
    const expected = pending.rollbackCommands[pending.rollbackIndex]
    if (command !== expected) {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'INVALID_CONTRACT',
        'Rollback failure must identify the exact pending rollback command',
      )
    }
    const transactionSequence = pending.token.transactionSequence
    this.pending = null
    this.failStopped = true
    this.visibilityAssured = false
    this.terminalReason = reason
    return this.appendObserver('rollback-failed', transactionSequence, reason)
  }

  dispose(): RepeatSixPartSourceOwnershipDisposalResult {
    if (this.disposed) {
      return Object.freeze({ kind: 'disposed' as const, disposed: true, rollback: null })
    }
    if (this.pending) {
      const pending = this.pending
      if (pending.phase === 'rolling-back') {
        if (pending.terminalAfterRollback !== 'fail-stopped') {
          pending.terminalAfterRollback = 'disposed'
          pending.terminalReason = 'Coordinator disposed while rollback was pending'
        }
        this.appendObserver(
          'dispose-requested',
          pending.token.transactionSequence,
          'Coordinator disposal is waiting for rollback',
        )
        return Object.freeze({
          kind: 'dispose-pending-rollback' as const,
          disposed: false,
          rollback: this.rollbackProgress(pending),
        })
      }
      const rollback = this.beginRollback(
        pending,
        'disposed',
        'Coordinator disposed while a handoff was pending',
        'dispose-requested',
      )
      if (!rollback.rollbackPending) {
        return Object.freeze({ kind: 'disposed' as const, disposed: true, rollback: null })
      }
      return Object.freeze({
        kind: 'dispose-pending-rollback' as const,
        disposed: false,
        rollback,
      })
    }
    this.disposed = true
    this.terminalReason = 'Coordinator disposed'
    this.appendObserver('disposed', null, this.terminalReason)
    return Object.freeze({ kind: 'disposed' as const, disposed: true, rollback: null })
  }

  getSnapshot(): RepeatSixPartSourceOwnershipHandoffSnapshot {
    const pending = this.pending
    let state: RepeatSixPartSourceOwnershipHandoffSnapshot['state']
    if (this.disposed) state = 'disposed'
    else if (this.failStopped) state = 'fail-stopped'
    else if (pending?.phase === 'rolling-back') state = 'rolling-back'
    else if (pending) {
      const next = pending.forwardCommands[pending.forwardIndex]
      if (next.kind === 'publish-replacement') state = 'prepared'
      else if (next.kind === 'commit-atomic-ownership-replacement') state = 'ready-to-commit'
      else state = 'staging-forward'
    } else if (this.committed) state = 'committed'
    else state = 'idle'
    const snapshot = Object.freeze({
      generation: this.generation,
      ownershipRevision: this.ownershipRevision,
      state,
      visibleOwnership: cloneVisibility(this.visibleOwnership),
      visibilityAssured: this.visibilityAssured,
      pendingTransactionSequence: pending?.token.transactionSequence ?? null,
      nextForwardOperationSequence: pending?.phase === 'forward'
        ? pending.forwardCommands[pending.forwardIndex].operationSequence
        : null,
      nextRollbackSequence: pending?.phase === 'rolling-back'
        ? pending.rollbackCommands[pending.rollbackIndex].rollbackSequence
        : null,
      stagedOperationCount: pending?.stagedCommands.length ?? 0,
      disposed: this.disposed,
      failStopped: this.failStopped,
      terminalReason: this.terminalReason,
      observerReceiptCount: this.observerReceipts.length,
    })
    issuedHandoffSnapshotOwners.set(snapshot, this)
    return snapshot
  }

  getObserverReceipts(afterObserverSequence = 0): readonly RepeatSixPartSourceOwnershipObserverReceipt[] {
    assertSafeInteger(afterObserverSequence, 'afterObserverSequence')
    return Object.freeze(
      this.observerReceipts.filter((receipt) => receipt.observerSequence > afterObserverSequence),
    )
  }

  private beginRollback(
    pending: PendingHandoff,
    terminalAfterRollback: TerminalAfterRollback,
    reason: string,
    event: 'cancelled' | 'dispose-requested' | 'fail-stop-requested',
  ): RepeatSixPartSourceOwnershipRollbackProgress {
    const commands: RepeatSixPartSourceOwnershipRollbackCommand[] = []
    for (const staged of [...pending.stagedCommands].reverse()) {
      const common = {
        token: pending.token,
        generation: this.generation,
        ownershipBaseRevision: this.ownershipRevision,
        rollbackSequence: commands.length,
        observerVisibility: 'staged-not-observer-visible' as const,
      }
      if (staged.kind === 'retire-original-production-root') {
        commands.push(Object.freeze({
          ...common,
          kind: 'restore-original-production-root' as const,
          rootId: staged.rootId,
          rootOrdinal: staged.rootOrdinal,
        }))
      } else {
        commands.push(Object.freeze({
          ...common,
          kind: 'unpublish-replacement' as const,
          replacementOwnerId: REPEAT_SIX_PART_REPLACEMENT_OWNER_ID,
        }))
      }
    }
    pending.rollbackCommands = Object.freeze(commands)
    pending.rollbackIndex = 0
    pending.terminalAfterRollback = terminalAfterRollback
    pending.terminalReason = reason
    if (commands.length === 0) {
      const transactionSequence = pending.token.transactionSequence
      this.pending = null
      if (terminalAfterRollback === 'disposed') {
        this.disposed = true
        this.terminalReason = reason
        this.appendObserver('disposed', transactionSequence, reason)
      } else if (terminalAfterRollback === 'fail-stopped') {
        this.failStopped = true
        this.terminalReason = reason
        this.appendObserver('fail-stopped', transactionSequence, reason)
      } else {
        this.appendObserver('cancelled', transactionSequence, reason)
      }
      return Object.freeze({
        kind: 'source-ownership-rollback-progress' as const,
        token: pending.token,
        reason,
        nextCommand: null,
        rollbackPending: false,
        terminalAfterRollback,
      })
    }
    pending.phase = 'rolling-back'
    this.appendObserver(event, pending.token.transactionSequence, reason)
    this.appendObserver('rollback-started', pending.token.transactionSequence, reason)
    return this.rollbackProgress(pending)
  }

  private rollbackProgress(pending: PendingHandoff): RepeatSixPartSourceOwnershipRollbackProgress {
    return Object.freeze({
      kind: 'source-ownership-rollback-progress' as const,
      token: pending.token,
      reason: pending.terminalReason,
      nextCommand: pending.rollbackCommands[pending.rollbackIndex] ?? null,
      rollbackPending: pending.rollbackIndex < pending.rollbackCommands.length,
      terminalAfterRollback: pending.terminalAfterRollback,
    })
  }

  private requirePending(token: RepeatSixPartSourceOwnershipHandoffToken): PendingHandoff {
    if (token?.generation !== this.generation) {
      throw new StaleRepeatSixPartSourceOwnershipGenerationError(this.generation, token?.generation)
    }
    if (token?.ownershipBaseRevision !== this.ownershipRevision) {
      throw new StaleRepeatSixPartSourceOwnershipRevisionError(
        this.ownershipRevision,
        token?.ownershipBaseRevision,
      )
    }
    if (!this.pending) {
      throw new RepeatSixPartSourceOwnershipHandoffError('TRANSACTION_STATE', 'No handoff is pending')
    }
    if (token !== this.pending.token) {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'TRANSACTION_STATE',
        'Handoff token is stale, forged, or belongs to another coordinator',
      )
    }
    return this.pending
  }

  private assertOperational(): void {
    if (this.disposed) {
      throw new RepeatSixPartSourceOwnershipHandoffError('DISPOSED', 'Source-ownership coordinator was disposed')
    }
    if (this.failStopped) {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'FAIL_STOPPED',
        `Source-ownership coordinator is fail-stopped: ${this.terminalReason ?? 'unknown failure'}`,
      )
    }
  }

  private assertUsableForNewTransaction(): void {
    this.assertOperational()
    if (this.committed) {
      throw new RepeatSixPartSourceOwnershipHandoffError(
        'TRANSACTION_STATE',
        'Source ownership has already been committed to the persistent replacement',
      )
    }
  }

  private appendObserver(
    event: RepeatSixPartSourceOwnershipObserverEvent,
    transactionSequence: number | null,
    detail: string,
  ): RepeatSixPartSourceOwnershipObserverReceipt {
    this.observerSequence += 1
    const snapshot = this.getSnapshotForObserver()
    const receipt = Object.freeze({
      kind: 'repeat-six-part-source-ownership-observer-receipt' as const,
      observerSequence: this.observerSequence,
      event,
      generation: this.generation,
      ownershipRevision: this.ownershipRevision,
      transactionSequence,
      transactionPhase: snapshot.state,
      visibleOwnership: cloneVisibility(this.visibleOwnership),
      visibilityAssured: this.visibilityAssured,
      stagedOperationCount: this.pending?.stagedCommands.length ?? 0,
      detail,
    })
    this.observerReceipts.push(receipt)
    return receipt
  }

  private getSnapshotForObserver(): Pick<RepeatSixPartSourceOwnershipHandoffSnapshot, 'state'> {
    if (this.disposed) return { state: 'disposed' }
    if (this.failStopped) return { state: 'fail-stopped' }
    if (this.pending?.phase === 'rolling-back') return { state: 'rolling-back' }
    if (this.pending) {
      const next = this.pending.forwardCommands[this.pending.forwardIndex]
      if (next.kind === 'publish-replacement') return { state: 'prepared' }
      if (next.kind === 'commit-atomic-ownership-replacement') return { state: 'ready-to-commit' }
      return { state: 'staging-forward' }
    }
    if (this.committed) return { state: 'committed' }
    return { state: 'idle' }
  }
}
