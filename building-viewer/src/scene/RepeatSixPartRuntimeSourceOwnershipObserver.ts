/**
 * Read-only runtime ownership witness for the exact repeat-six-part handoff.
 *
 * This class cannot hide, publish, retire, restore, or activate scene objects.
 * A future development adapter may submit observations after executing handoff
 * commands; this module only validates and records immutable evidence. The
 * accepted state space always has exactly one observer-visible owner:
 *
 *   - all four pinned production roots, collectively, or
 *   - the one persistent replacement catalog.
 */

import {
  areIssuedRepeatSixPartSourceOwnershipEvidenceFromSameCoordinator,
  isIssuedRepeatSixPartSourceOwnershipHandoffToken,
  REPEAT_SIX_PART_HANDOFF_COUNTS,
  REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS,
  REPEAT_SIX_PART_REPLACEMENT_OWNER_ID,
  type RepeatSixPartProductionInstancingRootId,
  type RepeatSixPartSourceOwnershipHandoffSnapshot,
  type RepeatSixPartSourceOwnershipHandoffToken,
  type RepeatSixPartSourceOwnershipVisibility,
} from './RepeatSixPartSourceOwnershipHandoff'

export type RepeatSixPartRuntimeOriginalRootLifecycle =
  | 'active-original'
  | 'retirement-staged'
  | 'retired-after-atomic-commit'

export type RepeatSixPartRuntimeReplacementLifecycle =
  | 'unpublished'
  | 'publication-staged'
  | 'committed-visible-owner'

export type RepeatSixPartRuntimeOriginalRootObservation = Readonly<{
  rootId: RepeatSixPartProductionInstancingRootId
  resolvedNodeCount: 1
  lifecycle: RepeatSixPartRuntimeOriginalRootLifecycle
  rendererVisible: boolean
}>

export type RepeatSixPartRuntimeReplacementObservation = Readonly<{
  ownerId: typeof REPEAT_SIX_PART_REPLACEMENT_OWNER_ID
  persistentListCount: 48
  physicalUnitCapacity: 1_872
  lifecycle: RepeatSixPartRuntimeReplacementLifecycle
  rendererVisible: boolean
}>

export type RepeatSixPartRuntimeOwnershipObservationGuard = Readonly<{
  kind: 'repeat-six-part-runtime-ownership-observation-guard'
  generation: number
  ownershipBaseRevision: number
  plannerRevision: number
  registryRevision: number
  transactionSequence: number
  activationCapability: null
}>

export type RepeatSixPartRuntimeOwnershipObservation = Readonly<{
  kind: 'repeat-six-part-runtime-ownership-observation'
  guard: RepeatSixPartRuntimeOwnershipObservationGuard
  sampleSequence: number
  handoffSnapshot: RepeatSixPartSourceOwnershipHandoffSnapshot
  originalRoots: readonly RepeatSixPartRuntimeOriginalRootObservation[]
  replacement: RepeatSixPartRuntimeReplacementObservation
}>

export type RepeatSixPartRuntimeOwnershipObservedPhase =
  | 'prepared-original-owner'
  | 'forward-staged-original-owner'
  | 'ready-to-commit-original-owner'
  | 'rollback-original-owner'
  | 'rolled-back-original-owner'
  | 'committed-replacement-owner'
  | 'fail-stopped-original-owner'
  | 'disposed-original-owner'

export type RepeatSixPartRuntimeOwnershipEvidenceReceipt = Readonly<{
  kind: 'repeat-six-part-runtime-ownership-evidence-receipt'
  evidenceSequence: number
  sampleSequence: number
  generation: number
  ownershipRevision: number
  transactionSequence: number
  phase: RepeatSixPartRuntimeOwnershipObservedPhase
  visibleOwnerCount: 1
  visibleOwnership: RepeatSixPartSourceOwnershipVisibility
  originalRoots: readonly RepeatSixPartRuntimeOriginalRootObservation[]
  replacement: RepeatSixPartRuntimeReplacementObservation
  handoffObserverReceiptCount: number
  immutableEvidence: true
  activationAuthorized: false
  activationCapability: null
}>

export type RepeatSixPartRuntimeOwnershipObserverSnapshot = Readonly<{
  generation: number
  ownershipRevision: number
  status:
    | 'idle-original-owner'
    | 'observing-transaction'
    | 'committed-replacement-owner'
    | 'disposed'
  visibleOwnership: RepeatSixPartSourceOwnershipVisibility
  activeTransactionSequence: number | null
  lastTransactionSequence: number
  lastSampleSequence: number
  evidenceReceiptCount: number
  disposed: boolean
  activationCapable: false
  activationCapability: null
}>

export type RepeatSixPartRuntimeOwnershipObserverErrorCode =
  | 'INVALID_CONTRACT'
  | 'INVALID_OWNERSHIP'
  | 'INVALID_TRANSITION'
  | 'UNASSURED_VISIBILITY'
  | 'STALE_GENERATION'
  | 'STALE_REVISION'
  | 'STALE_SAMPLE'
  | 'GUARD_STATE'
  | 'DISPOSED'

export class RepeatSixPartRuntimeOwnershipObserverError extends Error {
  readonly code: RepeatSixPartRuntimeOwnershipObserverErrorCode

  constructor(code: RepeatSixPartRuntimeOwnershipObserverErrorCode, message: string) {
    super(message)
    this.name = 'RepeatSixPartRuntimeOwnershipObserverError'
    this.code = code
  }
}

type ObserverProgress = Readonly<{
  handoffState: RepeatSixPartSourceOwnershipHandoffSnapshot['state']
  stagedOperationCount: number
  nextRollbackSequence: number | null
  handoffObserverReceiptCount: number
}>

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

const issuedGuards = new WeakSet<object>()
const guardOwners = new WeakMap<object, RepeatSixPartRuntimeSourceOwnershipObserver>()
const guardHandoffTokens = new WeakMap<object, RepeatSixPartSourceOwnershipHandoffToken>()

function fail(code: RepeatSixPartRuntimeOwnershipObserverErrorCode, message: string): never {
  throw new RepeatSixPartRuntimeOwnershipObserverError(code, message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function safeInteger(value: unknown, label: string, minimum = 0): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    fail('INVALID_CONTRACT', `${label} must be a safe integer >= ${minimum}`)
  }
}

function immutableSnapshot<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value
  const existing = seen.get(value)
  if (existing !== undefined) return existing as T
  if (Array.isArray(value)) {
    const copy: unknown[] = []
    seen.set(value, copy)
    for (const item of value) copy.push(immutableSnapshot(item, seen))
    return Object.freeze(copy) as T
  }
  const copy: Record<string, unknown> = {}
  seen.set(value, copy)
  for (const key of Object.keys(value)) {
    copy[key] = immutableSnapshot((value as Record<string, unknown>)[key], seen)
  }
  return Object.freeze(copy) as T
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index])
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

function assertExactVisibility(
  value: unknown,
  expected: RepeatSixPartSourceOwnershipVisibility,
  label: string,
): void {
  if (!isRecord(value) || !Array.isArray(value.originalProductionRootIds)) {
    fail('INVALID_CONTRACT', `${label} must be a complete ownership visibility object`)
  }
  if (
    value.mode !== expected.mode ||
    !arraysEqual(value.originalProductionRootIds, expected.originalProductionRootIds) ||
    value.replacementOwnerId !== expected.replacementOwnerId ||
    value.dualOwnershipVisible !== false
  ) {
    fail('INVALID_OWNERSHIP', `${label} does not prove one exact visible owner`)
  }
}

function assertExactSnapshotShape(snapshot: RepeatSixPartSourceOwnershipHandoffSnapshot): void {
  if (!isRecord(snapshot)) fail('INVALID_CONTRACT', 'handoffSnapshot must be an object')
  safeInteger(snapshot.generation, 'handoffSnapshot.generation')
  safeInteger(snapshot.ownershipRevision, 'handoffSnapshot.ownershipRevision')
  safeInteger(snapshot.stagedOperationCount, 'handoffSnapshot.stagedOperationCount')
  safeInteger(snapshot.observerReceiptCount, 'handoffSnapshot.observerReceiptCount')
  if (snapshot.stagedOperationCount > 5) {
    fail('INVALID_CONTRACT', 'handoffSnapshot.stagedOperationCount exceeds the five staged commands')
  }
  if (snapshot.pendingTransactionSequence !== null) {
    safeInteger(snapshot.pendingTransactionSequence, 'handoffSnapshot.pendingTransactionSequence', 1)
  }
  if (snapshot.nextForwardOperationSequence !== null) {
    safeInteger(snapshot.nextForwardOperationSequence, 'handoffSnapshot.nextForwardOperationSequence')
    if (snapshot.nextForwardOperationSequence > 5) {
      fail('INVALID_CONTRACT', 'handoffSnapshot.nextForwardOperationSequence exceeds five')
    }
  }
  if (snapshot.nextRollbackSequence !== null) {
    safeInteger(snapshot.nextRollbackSequence, 'handoffSnapshot.nextRollbackSequence')
  }
  if (
    typeof snapshot.visibilityAssured !== 'boolean' ||
    typeof snapshot.disposed !== 'boolean' ||
    typeof snapshot.failStopped !== 'boolean' ||
    (snapshot.terminalReason !== null && typeof snapshot.terminalReason !== 'string')
  ) {
    fail('INVALID_CONTRACT', 'handoffSnapshot terminal and visibility fields are malformed')
  }
}

function assertGuardToken(token: RepeatSixPartSourceOwnershipHandoffToken): void {
  if (!isRecord(token) || token.kind !== 'repeat-six-part-source-ownership-handoff-token') {
    fail('INVALID_CONTRACT', 'A source-ownership handoff token is required')
  }
  safeInteger(token.generation, 'token.generation')
  safeInteger(token.ownershipBaseRevision, 'token.ownershipBaseRevision')
  safeInteger(token.plannerRevision, 'token.plannerRevision', 1)
  safeInteger(token.registryRevision, 'token.registryRevision', 1)
  safeInteger(token.transactionSequence, 'token.transactionSequence', 1)
}

function expectedLifecycle(
  snapshot: RepeatSixPartSourceOwnershipHandoffSnapshot,
  rootOrdinal: number,
): RepeatSixPartRuntimeOriginalRootLifecycle {
  if (snapshot.state === 'committed') return 'retired-after-atomic-commit'
  if (snapshot.state === 'staging-forward' || snapshot.state === 'ready-to-commit') {
    const stagedRetirementCount = Math.max(0, snapshot.stagedOperationCount - 1)
    return rootOrdinal < stagedRetirementCount ? 'retirement-staged' : 'active-original'
  }
  if (snapshot.state === 'rolling-back') {
    const stagedRetirementCount = Math.max(0, snapshot.stagedOperationCount - 1)
    const restoredCount = Math.min(snapshot.nextRollbackSequence ?? 0, stagedRetirementCount)
    const remainingRetirementCount = stagedRetirementCount - restoredCount
    return rootOrdinal < remainingRetirementCount ? 'retirement-staged' : 'active-original'
  }
  return 'active-original'
}

function expectedReplacementLifecycle(
  snapshot: RepeatSixPartSourceOwnershipHandoffSnapshot,
): RepeatSixPartRuntimeReplacementLifecycle {
  if (snapshot.state === 'committed') return 'committed-visible-owner'
  if (
    snapshot.state === 'staging-forward' ||
    snapshot.state === 'ready-to-commit' ||
    snapshot.state === 'rolling-back'
  ) {
    return 'publication-staged'
  }
  return 'unpublished'
}

function observedPhase(
  snapshot: RepeatSixPartSourceOwnershipHandoffSnapshot,
): RepeatSixPartRuntimeOwnershipObservedPhase {
  switch (snapshot.state) {
    case 'prepared': return 'prepared-original-owner'
    case 'staging-forward': return 'forward-staged-original-owner'
    case 'ready-to-commit': return 'ready-to-commit-original-owner'
    case 'rolling-back': return 'rollback-original-owner'
    case 'idle': return 'rolled-back-original-owner'
    case 'committed': return 'committed-replacement-owner'
    case 'fail-stopped': return 'fail-stopped-original-owner'
    case 'disposed': return 'disposed-original-owner'
  }
}

function assertSnapshotStateContract(
  snapshot: RepeatSixPartSourceOwnershipHandoffSnapshot,
  guard: RepeatSixPartRuntimeOwnershipObservationGuard,
): void {
  if (snapshot.generation !== guard.generation) {
    fail('STALE_GENERATION', `Observed generation ${snapshot.generation} does not match guard ${guard.generation}`)
  }
  const committed = snapshot.state === 'committed'
  const expectedRevision = guard.ownershipBaseRevision + (committed ? 1 : 0)
  if (snapshot.ownershipRevision !== expectedRevision) {
    fail('STALE_REVISION', `Observed ownership revision ${snapshot.ownershipRevision}; expected ${expectedRevision}`)
  }
  if (!snapshot.visibilityAssured) {
    fail('UNASSURED_VISIBILITY', 'Handoff visibility is not assured; runtime ownership evidence cannot be accepted')
  }

  const pending = snapshot.state === 'prepared' ||
    snapshot.state === 'staging-forward' ||
    snapshot.state === 'ready-to-commit' ||
    snapshot.state === 'rolling-back'
  if (pending && snapshot.pendingTransactionSequence !== guard.transactionSequence) {
    fail('INVALID_TRANSITION', 'Pending handoff transaction does not match the observation guard')
  }
  if (!pending && snapshot.pendingTransactionSequence !== null) {
    fail('INVALID_CONTRACT', 'Terminal handoff snapshot cannot retain a pending transaction')
  }

  switch (snapshot.state) {
    case 'prepared':
      if (snapshot.stagedOperationCount !== 0 || snapshot.nextForwardOperationSequence !== 0 || snapshot.nextRollbackSequence !== null) {
        fail('INVALID_TRANSITION', 'Prepared snapshot must precede operation zero with no staged work')
      }
      break
    case 'staging-forward':
      if (
        snapshot.stagedOperationCount < 1 || snapshot.stagedOperationCount > 4 ||
        snapshot.nextForwardOperationSequence !== snapshot.stagedOperationCount ||
        snapshot.nextRollbackSequence !== null
      ) {
        fail('INVALID_TRANSITION', 'Forward staging snapshot has inconsistent command progress')
      }
      break
    case 'ready-to-commit':
      if (snapshot.stagedOperationCount !== 5 || snapshot.nextForwardOperationSequence !== 5 || snapshot.nextRollbackSequence !== null) {
        fail('INVALID_TRANSITION', 'Ready-to-commit snapshot must prove all five staged operations')
      }
      break
    case 'rolling-back': {
      if (snapshot.stagedOperationCount < 1 || snapshot.nextForwardOperationSequence !== null) {
        fail('INVALID_TRANSITION', 'Rollback snapshot must retain staged work and have no forward command')
      }
      const rollbackSequence = snapshot.nextRollbackSequence
      if (rollbackSequence === null || rollbackSequence >= snapshot.stagedOperationCount) {
        fail('INVALID_TRANSITION', 'Rollback sequence is outside the exact reverse command range')
      }
      break
    }
    case 'idle':
    case 'fail-stopped':
    case 'disposed':
      if (
        snapshot.stagedOperationCount !== 0 ||
        snapshot.nextForwardOperationSequence !== null ||
        snapshot.nextRollbackSequence !== null ||
        snapshot.ownershipRevision !== guard.ownershipBaseRevision
      ) {
        fail('INVALID_TRANSITION', `${snapshot.state} original-owner snapshot retains transaction work`)
      }
      break
    case 'committed':
      if (
        snapshot.stagedOperationCount !== 0 ||
        snapshot.nextForwardOperationSequence !== null ||
        snapshot.nextRollbackSequence !== null
      ) {
        fail('INVALID_TRANSITION', 'Committed snapshot retains transaction work')
      }
      break
  }
}

function validatePhysicalEvidence(
  roots: readonly RepeatSixPartRuntimeOriginalRootObservation[],
  replacement: RepeatSixPartRuntimeReplacementObservation,
  snapshot: RepeatSixPartSourceOwnershipHandoffSnapshot,
): RepeatSixPartSourceOwnershipVisibility {
  if (!Array.isArray(roots) || roots.length !== REPEAT_SIX_PART_HANDOFF_COUNTS.originalProductionRoots) {
    fail('INVALID_CONTRACT', 'Exactly four original production-root observations are required')
  }
  const seen = new Set<string>()
  for (let index = 0; index < REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS.length; index += 1) {
    const root = roots[index]
    const expectedId = REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS[index]
    if (!isRecord(root)) {
      fail('INVALID_CONTRACT', `Original root observation ${index} must be an object`)
    }
    const rootId = root.rootId
    if (typeof rootId !== 'string' || rootId !== expectedId || seen.has(rootId)) {
      fail('INVALID_CONTRACT', `Original root observation ${index} must be the unique pinned root ${expectedId}`)
    }
    seen.add(rootId)
    if (root.resolvedNodeCount !== 1) {
      fail('INVALID_OWNERSHIP', `Production root ${expectedId} must resolve exactly once`)
    }
    if (root.lifecycle !== expectedLifecycle(snapshot, index)) {
      fail('INVALID_TRANSITION', `Production root ${expectedId} lifecycle disagrees with handoff progress`)
    }
    if (typeof root.rendererVisible !== 'boolean') {
      fail('INVALID_CONTRACT', `Production root ${expectedId} rendererVisible must be boolean`)
    }
  }
  if (
    !isRecord(replacement) ||
    replacement.ownerId !== REPEAT_SIX_PART_REPLACEMENT_OWNER_ID ||
    replacement.persistentListCount !== REPEAT_SIX_PART_HANDOFF_COUNTS.persistentLists ||
    replacement.physicalUnitCapacity !== REPEAT_SIX_PART_HANDOFF_COUNTS.physicalUnits ||
    replacement.lifecycle !== expectedReplacementLifecycle(snapshot) ||
    typeof replacement.rendererVisible !== 'boolean'
  ) {
    fail('INVALID_CONTRACT', 'Replacement observation does not identify the exact persistent 48-list catalog')
  }

  const visibleRootCount = roots.filter((root) => root.rendererVisible).length
  if (replacement.rendererVisible && visibleRootCount > 0) {
    fail('INVALID_OWNERSHIP', 'Dual ownership detected: replacement and production roots are renderer-visible')
  }
  if (!replacement.rendererVisible && visibleRootCount === 0) {
    fail('INVALID_OWNERSHIP', 'Zero ownership detected: neither replacement nor production roots are renderer-visible')
  }
  if (visibleRootCount !== 0 && visibleRootCount !== roots.length) {
    fail('INVALID_OWNERSHIP', `Partial original ownership detected: ${visibleRootCount} of four roots are visible`)
  }

  const visibility = replacement.rendererVisible ? REPLACEMENT_VISIBILITY : ORIGINAL_VISIBILITY
  for (const root of roots) {
    const expectedVisible = visibility.mode === 'original-production-roots'
    if (root.rendererVisible !== expectedVisible) {
      fail('INVALID_OWNERSHIP', `Production root ${root.rootId} visibility is not atomic`)
    }
  }
  if (snapshot.state === 'committed') {
    if (visibility.mode !== 'replacement-persistent-catalog') {
      fail('INVALID_OWNERSHIP', 'Committed handoff must expose replacement-only ownership')
    }
  } else if (visibility.mode !== 'original-production-roots') {
    fail('INVALID_OWNERSHIP', `${snapshot.state} handoff must expose original-only ownership`)
  }
  assertExactVisibility(snapshot.visibleOwnership, visibility, 'handoffSnapshot.visibleOwnership')
  return visibility
}

export function isIssuedRepeatSixPartRuntimeOwnershipObservationGuard(
  value: unknown,
): value is RepeatSixPartRuntimeOwnershipObservationGuard {
  return isRecord(value) && issuedGuards.has(value)
}

/**
 * Pure observer. Its public surface contains no callback or scene-object
 * reference and it never returns an activation capability.
 */
export class RepeatSixPartRuntimeSourceOwnershipObserver {
  readonly generation: number

  private ownershipRevision: number
  private status: RepeatSixPartRuntimeOwnershipObserverSnapshot['status'] = 'idle-original-owner'
  private visibleOwnership = ORIGINAL_VISIBILITY
  private activeGuard: RepeatSixPartRuntimeOwnershipObservationGuard | null = null
  private lastTransactionSequence = 0
  private lastSampleSequence = 0
  private evidenceSequence = 0
  private previousProgress: ObserverProgress | null = null
  private readonly receipts: RepeatSixPartRuntimeOwnershipEvidenceReceipt[] = []
  private disposed = false

  constructor(generation: number, ownershipRevision = 0) {
    safeInteger(generation, 'generation')
    safeInteger(ownershipRevision, 'ownershipRevision')
    this.generation = generation
    this.ownershipRevision = ownershipRevision
  }

  issueGuard(
    tokenValue: RepeatSixPartSourceOwnershipHandoffToken,
  ): RepeatSixPartRuntimeOwnershipObservationGuard {
    this.assertNotDisposed()
    if (this.status === 'committed-replacement-owner') {
      fail('GUARD_STATE', 'Replacement ownership is already committed')
    }
    if (this.activeGuard !== null) {
      fail('GUARD_STATE', 'An ownership observation transaction is already active')
    }
    if (!isIssuedRepeatSixPartSourceOwnershipHandoffToken(tokenValue)) {
      fail('INVALID_CONTRACT', 'Observation requires an authentic coordinator-issued handoff token')
    }
    // Coordinator-issued tokens are frozen. Snapshotting the values avoids
    // retaining caller aliases while the authentic identity stays private.
    const token = immutableSnapshot(tokenValue)
    assertGuardToken(token)
    if (token.generation !== this.generation) {
      fail('STALE_GENERATION', `Token generation ${token.generation} does not match observer ${this.generation}`)
    }
    if (token.ownershipBaseRevision !== this.ownershipRevision) {
      fail('STALE_REVISION', `Token revision ${token.ownershipBaseRevision} does not match observer ${this.ownershipRevision}`)
    }
    if (token.transactionSequence <= this.lastTransactionSequence) {
      fail('GUARD_STATE', 'Handoff transaction sequence is stale or already observed')
    }
    const guard = Object.freeze({
      kind: 'repeat-six-part-runtime-ownership-observation-guard' as const,
      generation: token.generation,
      ownershipBaseRevision: token.ownershipBaseRevision,
      plannerRevision: token.plannerRevision,
      registryRevision: token.registryRevision,
      transactionSequence: token.transactionSequence,
      activationCapability: null,
    })
    issuedGuards.add(guard)
    guardOwners.set(guard, this)
    guardHandoffTokens.set(guard, tokenValue)
    this.activeGuard = guard
    this.status = 'observing-transaction'
    this.lastTransactionSequence = guard.transactionSequence
    this.lastSampleSequence = 0
    this.previousProgress = null
    return guard
  }

  observe(
    observationValue: RepeatSixPartRuntimeOwnershipObservation,
  ): RepeatSixPartRuntimeOwnershipEvidenceReceipt {
    this.assertNotDisposed()
    if (!isRecord(observationValue)) fail('INVALID_CONTRACT', 'Runtime ownership observation is required')
    const guard = observationValue.guard
    if (
      !isIssuedRepeatSixPartRuntimeOwnershipObservationGuard(guard) ||
      guardOwners.get(guard) !== this ||
      guard !== this.activeGuard
    ) {
      fail('GUARD_STATE', 'Observation guard is forged, stale, or belongs to another observer')
    }
    const handoffToken = guardHandoffTokens.get(guard)
    const handoffSnapshotValue = observationValue.handoffSnapshot
    if (
      handoffToken === undefined ||
      !areIssuedRepeatSixPartSourceOwnershipEvidenceFromSameCoordinator(
        handoffToken,
        handoffSnapshotValue,
      )
    ) {
      fail('INVALID_CONTRACT', 'Handoff snapshot is forged or was issued by a different coordinator')
    }
    // Capture every caller-owned field once before validation. Accepted
    // receipts never retain aliases to mutable adapter evidence.
    const observation = immutableSnapshot({
      kind: observationValue.kind,
      guard,
      sampleSequence: observationValue.sampleSequence,
      handoffSnapshot: handoffSnapshotValue,
      originalRoots: observationValue.originalRoots,
      replacement: observationValue.replacement,
    })
    if (observation.kind !== 'repeat-six-part-runtime-ownership-observation') {
      fail('INVALID_CONTRACT', 'Runtime ownership observation kind is invalid')
    }
    safeInteger(observation.sampleSequence, 'sampleSequence', 1)
    if (observation.sampleSequence !== this.lastSampleSequence + 1) {
      fail('STALE_SAMPLE', `Expected sample ${this.lastSampleSequence + 1}; observed ${observation.sampleSequence}`)
    }

    const snapshot = observation.handoffSnapshot
    assertExactSnapshotShape(snapshot)
    assertSnapshotStateContract(snapshot, guard)
    this.assertTransition(snapshot)
    const visibility = validatePhysicalEvidence(
      observation.originalRoots,
      observation.replacement,
      snapshot,
    )

    this.lastSampleSequence = observation.sampleSequence
    this.evidenceSequence += 1
    this.visibleOwnership = visibility
    const phase = observedPhase(snapshot)
    const receipt = Object.freeze({
      kind: 'repeat-six-part-runtime-ownership-evidence-receipt' as const,
      evidenceSequence: this.evidenceSequence,
      sampleSequence: observation.sampleSequence,
      generation: this.generation,
      ownershipRevision: snapshot.ownershipRevision,
      transactionSequence: guard.transactionSequence,
      phase,
      visibleOwnerCount: 1 as const,
      visibleOwnership: cloneVisibility(visibility),
      originalRoots: immutableSnapshot(observation.originalRoots),
      replacement: immutableSnapshot(observation.replacement),
      handoffObserverReceiptCount: snapshot.observerReceiptCount,
      immutableEvidence: true as const,
      activationAuthorized: false as const,
      activationCapability: null,
    })
    this.receipts.push(receipt)
    this.previousProgress = Object.freeze({
      handoffState: snapshot.state,
      stagedOperationCount: snapshot.stagedOperationCount,
      nextRollbackSequence: snapshot.nextRollbackSequence,
      handoffObserverReceiptCount: snapshot.observerReceiptCount,
    })

    if (snapshot.state === 'committed') {
      this.ownershipRevision = snapshot.ownershipRevision
      this.status = 'committed-replacement-owner'
      this.activeGuard = null
    } else if (
      snapshot.state === 'idle' ||
      snapshot.state === 'fail-stopped' ||
      snapshot.state === 'disposed'
    ) {
      this.status = snapshot.state === 'disposed' ? 'disposed' : 'idle-original-owner'
      this.activeGuard = null
      if (snapshot.state === 'disposed') this.disposed = true
    }
    return receipt
  }

  getEvidence(afterEvidenceSequence = 0): readonly RepeatSixPartRuntimeOwnershipEvidenceReceipt[] {
    safeInteger(afterEvidenceSequence, 'afterEvidenceSequence')
    return Object.freeze(
      this.receipts.filter((receipt) => receipt.evidenceSequence > afterEvidenceSequence),
    )
  }

  getSnapshot(): RepeatSixPartRuntimeOwnershipObserverSnapshot {
    return Object.freeze({
      generation: this.generation,
      ownershipRevision: this.ownershipRevision,
      status: this.status,
      visibleOwnership: cloneVisibility(this.visibleOwnership),
      activeTransactionSequence: this.activeGuard?.transactionSequence ?? null,
      lastTransactionSequence: this.lastTransactionSequence,
      lastSampleSequence: this.lastSampleSequence,
      evidenceReceiptCount: this.receipts.length,
      disposed: this.disposed,
      activationCapable: false as const,
      activationCapability: null,
    })
  }

  dispose(): void {
    if (this.activeGuard !== null) {
      fail('GUARD_STATE', 'Observer cannot be disposed while a transaction is unresolved')
    }
    this.disposed = true
    this.status = 'disposed'
  }

  private assertTransition(snapshot: RepeatSixPartSourceOwnershipHandoffSnapshot): void {
    const previous = this.previousProgress
    if (previous === null) {
      if (snapshot.state !== 'prepared') {
        fail('INVALID_TRANSITION', 'The first guarded observation must be the prepared original-owner state')
      }
      return
    }
    if (snapshot.observerReceiptCount <= previous.handoffObserverReceiptCount) {
      fail('INVALID_TRANSITION', 'Handoff observer receipt cursor must advance for every runtime sample')
    }

    switch (previous.handoffState) {
      case 'prepared':
        if (!['prepared', 'staging-forward', 'rolling-back', 'idle', 'fail-stopped', 'disposed'].includes(snapshot.state)) {
          fail('INVALID_TRANSITION', `Prepared state cannot transition to ${snapshot.state}`)
        }
        break
      case 'staging-forward':
        if (!['staging-forward', 'ready-to-commit', 'rolling-back'].includes(snapshot.state)) {
          fail('INVALID_TRANSITION', `Forward staging cannot transition to ${snapshot.state}`)
        }
        break
      case 'ready-to-commit':
        if (!['ready-to-commit', 'rolling-back', 'committed'].includes(snapshot.state)) {
          fail('INVALID_TRANSITION', `Ready-to-commit cannot transition to ${snapshot.state}`)
        }
        break
      case 'rolling-back':
        if (!['rolling-back', 'idle', 'fail-stopped', 'disposed'].includes(snapshot.state)) {
          fail('INVALID_TRANSITION', `Rollback cannot transition to ${snapshot.state}`)
        }
        break
      case 'idle':
      case 'committed':
      case 'fail-stopped':
      case 'disposed':
        fail('INVALID_TRANSITION', `Terminal ${previous.handoffState} state cannot accept another sample`)
    }

    const forwardState = snapshot.state === 'staging-forward' || snapshot.state === 'ready-to-commit'
    const previousForwardState = previous.handoffState === 'prepared' ||
      previous.handoffState === 'staging-forward' || previous.handoffState === 'ready-to-commit'
    if (forwardState && previousForwardState) {
      if (
        snapshot.stagedOperationCount < previous.stagedOperationCount ||
        snapshot.stagedOperationCount > previous.stagedOperationCount + 1
      ) {
        fail('INVALID_TRANSITION', 'Forward staged-operation progress must be monotonic and observed one command at a time')
      }
    }

    if (snapshot.state === 'rolling-back') {
      if (previous.handoffState !== 'rolling-back') {
        if (snapshot.nextRollbackSequence !== 0 || snapshot.stagedOperationCount !== previous.stagedOperationCount) {
          fail('INVALID_TRANSITION', 'Rollback must begin at sequence zero for the observed staged command count')
        }
      } else {
        const priorSequence = previous.nextRollbackSequence
        if (
          priorSequence === null ||
          snapshot.stagedOperationCount !== previous.stagedOperationCount ||
          snapshot.nextRollbackSequence === null ||
          snapshot.nextRollbackSequence < priorSequence ||
          snapshot.nextRollbackSequence > priorSequence + 1
        ) {
          fail('INVALID_TRANSITION', 'Rollback progress must be monotonic and observed one command at a time')
        }
      }
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) fail('DISPOSED', 'Runtime source-ownership observer is disposed')
  }
}
