/**
 * Development-only physical ownership bridge for the exact repeat-six-part
 * catalog. The bridge is deliberately synchronous at the renderer-visible
 * boundary: staging never touches the scene, while commit changes the scene
 * from four visible pinned roots to one visible catalog without yielding.
 */

import type { Object3D } from 'three'

import {
  REPEAT_SIX_PART_HANDOFF_COUNTS,
  REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS,
  REPEAT_SIX_PART_REPLACEMENT_OWNER_ID,
  RepeatSixPartSourceOwnershipHandoffCoordinator,
  type RepeatSixPartAtomicOwnershipCommitCommand,
  type RepeatSixPartAtomicOwnershipCommitReceipt,
  type RepeatSixPartProductionInstancingRootId,
  type RepeatSixPartSourceOwnershipForwardCommand,
  type RepeatSixPartSourceOwnershipHandoffSnapshot,
  type RepeatSixPartSourceOwnershipHandoffToken,
  type RepeatSixPartSourceOwnershipRollbackProgress,
} from '../RepeatSixPartSourceOwnershipHandoff'
import {
  RepeatSixPartRuntimeSourceOwnershipObserver,
  type RepeatSixPartRuntimeOriginalRootLifecycle,
  type RepeatSixPartRuntimeOwnershipEvidenceReceipt,
  type RepeatSixPartRuntimeOwnershipObservationGuard,
  type RepeatSixPartRuntimeOwnershipObserverSnapshot,
  type RepeatSixPartRuntimeReplacementLifecycle,
} from '../RepeatSixPartRuntimeSourceOwnershipObserver'
import {
  isIssuedDevelopmentRepeatSixPartAdapterRendererBinding,
  type DevelopmentRepeatSixPartPersistentCatalogRendererAdapter,
} from './DevelopmentRepeatSixPartPersistentCatalogRendererAdapter'
import {
  getIssuedDevelopmentRepeatSixPartProductionRootLiveBinding,
  isIssuedDevelopmentRepeatSixPartProductionRootResolution,
  type DevelopmentRepeatSixPartProductionRootLiveBinding,
  type DevelopmentRepeatSixPartProductionRootResolution,
} from './DevelopmentRepeatSixPartProductionRootResolver'
import {
  isIssuedDevelopmentRepeatSixPartThreeRendererPort,
  type DevelopmentRepeatSixPartThreeRendererPort,
} from './DevelopmentRepeatSixPartThreeRendererPort'

const SOURCE_OWNERSHIP_TAG = 'repeatSixPartSourceOwnership'
const EXTERNAL_VISIBILITY_TAG = 'externallyManagedVisibility'
const CATALOG_OWNER_TAG = 'repeatSixPartReplacementOwnerId'

type BridgeState =
  | 'ready-original-owner'
  | 'committing'
  | 'committed-replacement-owner'
  | 'failed-closed-original-owner'
  | 'torn-down-original-owner'

type BridgePhysicalOwner =
  | 'original-production-roots'
  | 'replacement-persistent-catalog'
  | 'invalid-zero-partial-or-dual'

type BridgeOwnershipEvidenceStatus =
  | 'unavailable'
  | 'observer-receipt-current'
  | 'invalidated-by-emergency-physical-fail-close'

type SavedUserDataValue = Readonly<{
  key: string
  existed: boolean
  value: unknown
}>

type RetainedRoot = Readonly<{
  rootId: RepeatSixPartProductionInstancingRootId
  ordinal: 258 | 259 | 260 | 261
  object: Object3D
  originalVisible: boolean
  savedUserData: readonly SavedUserDataValue[]
}>

export type DevelopmentRepeatSixPartRealSceneOwnershipBridgeOptions = Readonly<{
  generation: number
  resolution: DevelopmentRepeatSixPartProductionRootResolution
  adapter: DevelopmentRepeatSixPartPersistentCatalogRendererAdapter
  rendererPort: DevelopmentRepeatSixPartThreeRendererPort
  /** Optional detached gate used by the real-scene harness. */
  catalogStage?: Object3D
}>

export type DevelopmentRepeatSixPartRealSceneOwnershipBridgeSnapshot = Readonly<{
  kind: 'development-repeat-six-part-real-scene-ownership-bridge-snapshot'
  developmentOnly: true
  generation: number
  state: BridgeState
  sourceRootIds: readonly RepeatSixPartProductionInstancingRootId[]
  retainedRootOrdinals: readonly [258, 259, 260, 261]
  retainedRootsAttachedAtExactOrdinals: boolean
  retainedRootAttachedCount: number
  retainedRootRendererVisibleCount: number
  retainedRootVisibility: readonly boolean[]
  catalogStageMountedUnderActiveScene: boolean
  catalogMountedUnderActiveScene: boolean
  catalogVisible: boolean
  handoff: RepeatSixPartSourceOwnershipHandoffSnapshot
  observer: RepeatSixPartRuntimeOwnershipObserverSnapshot
  evidenceReceiptCount: number
  currentPhysicalOwner: BridgePhysicalOwner
  ownershipEvidenceStatus: BridgeOwnershipEvidenceStatus
  priorCommittedReceiptInvalidated: boolean
  emergencyFailCloseReason: string | null
  lastFailure: string | null
  reverseHandoffContinuityClaimed: false
  activationAuthorized: false
  activationCapability: null
}>

export type DevelopmentRepeatSixPartRealSceneOwnershipBridgeEvidence = Readonly<{
  kind: 'development-repeat-six-part-real-scene-ownership-bridge-evidence'
  generation: number
  state: BridgeState
  receipts: readonly RepeatSixPartRuntimeOwnershipEvidenceReceipt[]
  /** Historical final observer receipt; retained for audit only. */
  finalReceipt: RepeatSixPartRuntimeOwnershipEvidenceReceipt | null
  /** Null once an emergency physical reverse switch invalidates finalReceipt. */
  currentReceipt: RepeatSixPartRuntimeOwnershipEvidenceReceipt | null
  currentPhysicalOwner: BridgePhysicalOwner
  ownershipEvidenceStatus: BridgeOwnershipEvidenceStatus
  priorCommittedReceiptInvalidated: boolean
  invalidatedCommittedEvidenceSequence: number | null
  emergencyFailCloseReason: string | null
  activationAuthorized: false
  activationCapability: null
}>

export type DevelopmentRepeatSixPartRealSceneOwnershipBridgeErrorCode =
  | 'INVALID_CONFIGURATION'
  | 'INVALID_STATE'
  | 'INVALID_PHYSICAL_OWNERSHIP'
  | 'RESOLUTION_REJECTED'
  | 'HANDOFF_FAILED'
  | 'RESTORATION_FAILED'
  | 'DISPOSED'

export class DevelopmentRepeatSixPartRealSceneOwnershipBridgeError extends Error {
  readonly code: DevelopmentRepeatSixPartRealSceneOwnershipBridgeErrorCode
  readonly cause: unknown

  constructor(
    code: DevelopmentRepeatSixPartRealSceneOwnershipBridgeErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message)
    this.name = 'DevelopmentRepeatSixPartRealSceneOwnershipBridgeError'
    this.code = code
    this.cause = cause
  }
}

function fail(
  code: DevelopmentRepeatSixPartRealSceneOwnershipBridgeErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new DevelopmentRepeatSixPartRealSceneOwnershipBridgeError(code, message, cause)
}

function assertSafeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail('INVALID_CONFIGURATION', `${label} must be a non-negative safe integer`)
  }
}

function savedUserData(object: Object3D, keys: readonly string[]): readonly SavedUserDataValue[] {
  return Object.freeze(keys.map((key) => Object.freeze({
    key,
    existed: Object.prototype.hasOwnProperty.call(object.userData, key),
    value: object.userData[key],
  })))
}

function restoreUserData(object: Object3D, saved: readonly SavedUserDataValue[]): void {
  for (const entry of saved) {
    if (entry.existed) object.userData[entry.key] = entry.value
    else delete object.userData[entry.key]
  }
}

function isRendererVisible(object: Object3D, activeScene: Object3D): boolean {
  let cursor: Object3D | null = object
  let reachedActiveScene = false
  while (cursor) {
    if (!cursor.visible) return false
    if (cursor === activeScene) reachedActiveScene = true
    cursor = cursor.parent
  }
  return reachedActiveScene
}

function isDescendantOf(object: Object3D, ancestor: Object3D): boolean {
  let cursor: Object3D | null = object
  while (cursor) {
    if (cursor === ancestor) return true
    cursor = cursor.parent
  }
  return false
}

function isVisibleBehindHiddenGate(object: Object3D, gate: Object3D): boolean {
  let cursor: Object3D | null = object
  while (cursor && cursor !== gate) {
    if (!cursor.visible) return false
    cursor = cursor.parent
  }
  return cursor === gate
}

function originalLifecycle(
  snapshot: RepeatSixPartSourceOwnershipHandoffSnapshot,
  rootOrdinal: number,
): RepeatSixPartRuntimeOriginalRootLifecycle {
  if (snapshot.state === 'committed') return 'retired-after-atomic-commit'
  if (snapshot.state === 'staging-forward' || snapshot.state === 'ready-to-commit') {
    return rootOrdinal < Math.max(0, snapshot.stagedOperationCount - 1)
      ? 'retirement-staged'
      : 'active-original'
  }
  if (snapshot.state === 'rolling-back') {
    const stagedRetirementCount = Math.max(0, snapshot.stagedOperationCount - 1)
    const restoredCount = Math.min(snapshot.nextRollbackSequence ?? 0, stagedRetirementCount)
    return rootOrdinal < stagedRetirementCount - restoredCount
      ? 'retirement-staged'
      : 'active-original'
  }
  return 'active-original'
}

function replacementLifecycle(
  snapshot: RepeatSixPartSourceOwnershipHandoffSnapshot,
): RepeatSixPartRuntimeReplacementLifecycle {
  if (snapshot.state === 'committed') return 'committed-visible-owner'
  if (
    snapshot.state === 'staging-forward' ||
    snapshot.state === 'ready-to-commit' ||
    snapshot.state === 'rolling-back'
  ) return 'publication-staged'
  return 'unpublished'
}

function auditOperation(command: RepeatSixPartSourceOwnershipForwardCommand): string {
  if (command.kind === 'publish-replacement') return `publish:${command.replacementOwnerId}`
  if (command.kind === 'retire-original-production-root') return `retire:${command.rootId}`
  return 'commit:atomic-ownership-replacement'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

/**
 * The class intentionally exposes no live roots, handoff token, scene
 * callback, or activation capability in its evidence objects.
 */
export class DevelopmentRepeatSixPartRealSceneOwnershipBridge {
  readonly generation: number

  private readonly resolution: DevelopmentRepeatSixPartProductionRootResolution
  private readonly adapter: DevelopmentRepeatSixPartPersistentCatalogRendererAdapter
  private readonly rendererPort: DevelopmentRepeatSixPartThreeRendererPort
  private readonly catalogStage: Object3D
  private readonly binding: DevelopmentRepeatSixPartProductionRootLiveBinding
  private readonly retainedRoots: readonly RetainedRoot[]
  private readonly catalogOriginalVisible: boolean
  private readonly catalogSavedUserData: readonly SavedUserDataValue[]
  private readonly coordinator: RepeatSixPartSourceOwnershipHandoffCoordinator
  private readonly observer: RepeatSixPartRuntimeSourceOwnershipObserver
  private state: BridgeState = 'ready-original-owner'
  private guard: RepeatSixPartRuntimeOwnershipObservationGuard | null = null
  private token: RepeatSixPartSourceOwnershipHandoffToken | null = null
  private sampleSequence = 0
  private lastFailure: string | null = null
  private emergencyFailCloseReason: string | null = null
  private invalidatedCommittedEvidenceSequence: number | null = null
  private restorationCleanupFailure: string | null = null
  private releaseRendererFailStopBoundary: (() => void) | null = null
  private teardownPromise: Promise<void> | null = null

  constructor(options: DevelopmentRepeatSixPartRealSceneOwnershipBridgeOptions) {
    if (!options || !options.adapter || !options.rendererPort) {
      fail('INVALID_CONFIGURATION', 'An authentic resolution, published adapter, and Three renderer port are required')
    }
    assertSafeInteger(options.generation, 'generation')
    this.generation = options.generation
    this.resolution = options.resolution
    this.adapter = options.adapter
    this.rendererPort = options.rendererPort
    this.catalogStage = options.catalogStage ?? this.rendererPort.root
    if (this.adapter.generation !== this.generation) {
      fail('INVALID_CONFIGURATION', 'Adapter generation does not match the ownership bridge')
    }
    // Reject before resolver access, userData changes, or scene mounting. The
    // logical publication evidence and physical visible replacement must come
    // from the same genuine Three renderer port; structural look-alikes and
    // valid adapters paired with another port are not ownership evidence.
    if (
      !isIssuedDevelopmentRepeatSixPartThreeRendererPort(this.rendererPort) ||
      !isIssuedDevelopmentRepeatSixPartAdapterRendererBinding(this.adapter, this.rendererPort)
    ) {
      fail(
        'INVALID_CONFIGURATION',
        'Adapter and physical replacement must be the same issued Three renderer-port pair',
      )
    }
    if (!isIssuedDevelopmentRepeatSixPartProductionRootResolution(this.resolution)) {
      fail('RESOLUTION_REJECTED', 'Production-root resolution is forged or was not issued by the strict resolver')
    }
    try {
      this.binding = getIssuedDevelopmentRepeatSixPartProductionRootLiveBinding(this.resolution)
    } catch (error) {
      fail('RESOLUTION_REJECTED', 'Production-root resolution is stale or invalid', error)
    }
    if (this.binding.roots.length !== REPEAT_SIX_PART_HANDOFF_COUNTS.originalProductionRoots) {
      fail('INVALID_CONFIGURATION', 'Strict resolver binding does not contain the exact four roots')
    }
    this.retainedRoots = Object.freeze(this.binding.roots.map((object, index) => {
      const metadata = this.resolution.metadata.roots[index]
      if (!metadata || metadata.rootId !== REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS[index]) {
        fail('INVALID_CONFIGURATION', `Resolver metadata root ${index} is not the pinned production root`)
      }
      return Object.freeze({
        rootId: metadata.rootId,
        ordinal: metadata.ordinal,
        object,
        originalVisible: object.visible,
        savedUserData: savedUserData(object, [
          SOURCE_OWNERSHIP_TAG,
          EXTERNAL_VISIBILITY_TAG,
          'proceduralInstanced',
          'detailLodIgnore',
        ]),
      })
    }))
    if (this.catalogStage !== this.rendererPort.root) {
      let cursor: Object3D | null = this.rendererPort.root
      let contained = false
      while (cursor) {
        if (cursor === this.catalogStage) contained = true
        cursor = cursor.parent
      }
      if (!contained) {
        fail('INVALID_CONFIGURATION', 'Detached catalogStage must contain the Three renderer port root')
      }
    }
    if (!isVisibleBehindHiddenGate(this.rendererPort.root, this.catalogStage)) {
      fail(
        'INVALID_PHYSICAL_OWNERSHIP',
        'Issued Three renderer root must be locally visible behind the hidden catalog gate',
      )
    }
    this.catalogOriginalVisible = this.catalogStage.visible
    this.catalogSavedUserData = savedUserData(
      this.catalogStage,
      ['productionOwnershipIntegrated', CATALOG_OWNER_TAG],
    )
    this.coordinator = new RepeatSixPartSourceOwnershipHandoffCoordinator(this.generation)
    this.observer = new RepeatSixPartRuntimeSourceOwnershipObserver(this.generation)
    this.assertDetachedConstructionOwnership()
    // The already-published replacement is intentionally not scene-owned yet.
    // Calling this also proves that adapter publication evidence is available.
    this.adapter.getSourceOwnershipHandoffEvidence()
    // Mounting the hidden gate happens before the transaction. The strict
    // resolver permits appended non-pinned children, so the final revalidation
    // remains authoritative while the atomic switch itself has no add/remove
    // event dispatch.
    this.binding.activeScene.add(this.catalogStage)
    for (const entry of this.retainedRoots) {
      entry.object.userData[SOURCE_OWNERSHIP_TAG] = 'active-original-before-repeat-six-part-handoff'
      entry.object.userData[EXTERNAL_VISIBILITY_TAG] = 'repeat-six-part-catalog'
      entry.object.userData.proceduralInstanced = true
      entry.object.userData.detailLodIgnore = true
    }
    this.assertStagedOriginalOwnership()
    this.releaseRendererFailStopBoundary = this.rendererPort.bindAtomicFailStopBoundary((reason) => {
      this.failClosedToOriginals(`Adapter fail-stop: ${reason.code}`)
    })
  }

  /** Complete the exact five staged operations and one atomic scene commit. */
  commit(): DevelopmentRepeatSixPartRealSceneOwnershipBridgeSnapshot {
    if (this.state === 'torn-down-original-owner') fail('DISPOSED', 'Ownership bridge was torn down')
    if (this.state !== 'ready-original-owner') {
      fail('INVALID_STATE', `Ownership bridge cannot commit from ${this.state}`)
    }
    this.state = 'committing'
    let physicalCommitStarted = false
    try {
      this.assertStagedOriginalOwnership()
      const prepared = this.coordinator.prepare({
        generation: this.generation,
        ownershipRevision: 0,
        evidence: this.adapter.getSourceOwnershipHandoffEvidence(),
      })
      this.token = prepared.token
      this.guard = this.observer.issueGuard(prepared.token)
      this.observeCurrent()

      const stagedAudit: string[] = []
      for (let operationSequence = 0; operationSequence < 5; operationSequence += 1) {
        const command = this.coordinator.getNextForwardCommand(prepared.token)
        if (command.kind === 'commit-atomic-ownership-replacement') {
          fail('HANDOFF_FAILED', `Atomic commit command appeared before staged operation ${operationSequence}`)
        }
        if (command.operationSequence !== operationSequence) {
          fail('HANDOFF_FAILED', `Unexpected staged operation sequence ${command.operationSequence}`)
        }
        stagedAudit.push(auditOperation(command))
        this.coordinator.acknowledgeStagedOperation(Object.freeze({
          kind: 'repeat-six-part-staged-operation-receipt' as const,
          token: prepared.token,
          command,
          generation: this.generation,
          ownershipBaseRevision: prepared.token.ownershipBaseRevision,
          outcome: 'staged-not-observer-visible' as const,
        }))
        // Staging is logical only: all roots are still visible and the
        // replacement remains mounted but hidden for every observation.
        this.assertStagedOriginalOwnership()
        this.observeCurrent()
      }

      const commitCommand = this.coordinator.getNextForwardCommand(prepared.token)
      if (commitCommand.kind !== 'commit-atomic-ownership-replacement') {
        fail('HANDOFF_FAILED', 'Five staged operations did not produce the exact atomic commit command')
      }
      const currentBinding = this.revalidateImmediatelyBeforeCommit()
      this.assertSameBinding(currentBinding)
      physicalCommitStarted = true
      this.applyPhysicalCommit(currentBinding)
      const receipt = this.atomicCommitReceipt(prepared.token, commitCommand, stagedAudit)
      this.coordinator.commit(receipt)
      this.observeCurrent()
      this.state = 'committed-replacement-owner'
      return this.getSnapshot()
    } catch (error) {
      const restorationErrors: unknown[] = []
      if (physicalCommitStarted) {
        try {
          this.restoreOriginalPhysicalOwnership(true)
        } catch (restoreError) {
          restorationErrors.push(restoreError)
        }
      } else if (this.catalogStage.parent !== null) {
        try { this.cleanupStagedOriginalOwnership() } catch (restoreError) { restorationErrors.push(restoreError) }
      }
      try { this.drainLogicalRollback(errorMessage(error)) } catch (rollbackError) { restorationErrors.push(rollbackError) }
      this.state = 'failed-closed-original-owner'
      this.lastFailure = errorMessage(error)
      if (restorationErrors.length > 0) {
        throw new DevelopmentRepeatSixPartRealSceneOwnershipBridgeError(
          'RESTORATION_FAILED',
          'Ownership handoff failed and exact original-owner restoration could not be fully proven',
          new AggregateError([error, ...restorationErrors]),
        )
      }
      if (error instanceof DevelopmentRepeatSixPartRealSceneOwnershipBridgeError) throw error
      throw new DevelopmentRepeatSixPartRealSceneOwnershipBridgeError(
        'HANDOFF_FAILED',
        'Atomic real-scene ownership handoff failed; original ownership was restored',
        error,
      )
    }
  }

  getSnapshot(): DevelopmentRepeatSixPartRealSceneOwnershipBridgeSnapshot {
    const exactOrdinals = this.retainedRoots.every(({ object, ordinal }) =>
      object.parent === this.binding.activeScene && this.binding.activeScene.children[ordinal] === object)
    const attachedCount = this.retainedRoots.filter(({ object }) => object.parent === this.binding.activeScene).length
    const visibleCount = this.retainedRoots.filter(({ object }) =>
      isRendererVisible(object, this.binding.activeScene)).length
    return Object.freeze({
      kind: 'development-repeat-six-part-real-scene-ownership-bridge-snapshot' as const,
      developmentOnly: true as const,
      generation: this.generation,
      state: this.state,
      sourceRootIds: REPEAT_SIX_PART_PRODUCTION_INSTANCING_ROOT_IDS,
      retainedRootOrdinals: Object.freeze([258, 259, 260, 261]) as readonly [258, 259, 260, 261],
      retainedRootsAttachedAtExactOrdinals: exactOrdinals,
      retainedRootAttachedCount: attachedCount,
      retainedRootRendererVisibleCount: visibleCount,
      retainedRootVisibility: Object.freeze(this.retainedRoots.map(({ object }) => object.visible)),
      catalogStageMountedUnderActiveScene: this.catalogStage.parent === this.binding.activeScene,
      catalogMountedUnderActiveScene: isDescendantOf(this.rendererPort.root, this.binding.activeScene),
      catalogVisible: isRendererVisible(this.rendererPort.root, this.binding.activeScene),
      handoff: this.coordinator.getSnapshot(),
      observer: this.observer.getSnapshot(),
      evidenceReceiptCount: this.observer.getEvidence().length,
      currentPhysicalOwner: this.currentPhysicalOwner(),
      ownershipEvidenceStatus: this.currentOwnershipEvidenceStatus(),
      priorCommittedReceiptInvalidated: this.invalidatedCommittedEvidenceSequence !== null,
      emergencyFailCloseReason: this.emergencyFailCloseReason,
      lastFailure: this.lastFailure,
      reverseHandoffContinuityClaimed: false as const,
      activationAuthorized: false as const,
      activationCapability: null,
    })
  }

  getEvidence(): DevelopmentRepeatSixPartRealSceneOwnershipBridgeEvidence {
    const receipts = this.observer.getEvidence()
    const finalReceipt = receipts[receipts.length - 1] ?? null
    return Object.freeze({
      kind: 'development-repeat-six-part-real-scene-ownership-bridge-evidence' as const,
      generation: this.generation,
      state: this.state,
      receipts,
      finalReceipt,
      currentReceipt: this.emergencyFailCloseReason === null ? finalReceipt : null,
      currentPhysicalOwner: this.currentPhysicalOwner(),
      ownershipEvidenceStatus: this.currentOwnershipEvidenceStatus(),
      priorCommittedReceiptInvalidated: this.invalidatedCommittedEvidenceSequence !== null,
      invalidatedCommittedEvidenceSequence: this.invalidatedCommittedEvidenceSequence,
      emergencyFailCloseReason: this.emergencyFailCloseReason,
      activationAuthorized: false as const,
      activationCapability: null,
    })
  }

  /**
   * Emergency physical fail-close. It deliberately makes no reverse logical
   * handoff claim; the forward coordinator remains terminal after a commit.
   */
  failClosedToOriginals(reason: string): DevelopmentRepeatSixPartRealSceneOwnershipBridgeSnapshot {
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      fail('INVALID_CONFIGURATION', 'A non-empty fail-close reason is required')
    }
    const normalizedReason = reason.trim()
    if (
      (this.state === 'failed-closed-original-owner' || this.state === 'torn-down-original-owner') &&
      this.currentPhysicalOwner() === 'original-production-roots'
    ) return this.getSnapshot()
    const priorState = this.state
    try {
      this.restoreOriginalPhysicalOwnership(priorState === 'committed-replacement-owner')
      this.markEmergencyPhysicalFailClose(normalizedReason)
      this.state = 'failed-closed-original-owner'
      this.lastFailure = this.restorationCleanupFailure
        ? `${normalizedReason}; cleanup: ${this.restorationCleanupFailure}`
        : normalizedReason
      return this.getSnapshot()
    } catch (error) {
      const owner = this.currentPhysicalOwner()
      this.state = priorState === 'committed-replacement-owner' && owner === 'replacement-persistent-catalog'
        ? 'committed-replacement-owner'
        : 'failed-closed-original-owner'
      this.lastFailure = errorMessage(error)
      throw new DevelopmentRepeatSixPartRealSceneOwnershipBridgeError(
        'RESTORATION_FAILED',
        'Emergency fail-close could not restore exact original ownership',
        error,
      )
    }
  }

  /**
   * Synchronously restores renderer ownership before the first await, then
   * disposes the catalog adapter. Safe to invoke as `void` from beforeunload.
   * This is an emergency reverse physical switch, not a reverse handoff claim.
   */
  teardownForBeforeUnload(): Promise<void> {
    return this.teardown()
  }

  teardown(): Promise<void> {
    if (this.teardownPromise) return this.teardownPromise
    const priorState = this.state
    try {
      this.restoreOriginalPhysicalOwnership(priorState === 'committed-replacement-owner')
      this.markEmergencyPhysicalFailClose('Ownership bridge teardown restored original production roots')
      this.state = 'torn-down-original-owner'
    } catch (error) {
      const owner = this.currentPhysicalOwner()
      this.state = priorState === 'committed-replacement-owner' && owner === 'replacement-persistent-catalog'
        ? 'committed-replacement-owner'
        : 'failed-closed-original-owner'
      this.lastFailure = errorMessage(error)
      return Promise.reject(new DevelopmentRepeatSixPartRealSceneOwnershipBridgeError(
        'RESTORATION_FAILED',
        'Before-unload teardown could not restore exact original ownership',
        error,
      ))
    }
    this.teardownPromise = this.adapter.dispose().finally(() => {
      this.releaseRendererFailStopBoundary?.()
      this.releaseRendererFailStopBoundary = null
    })
    return this.teardownPromise
  }

  private observeCurrent(): RepeatSixPartRuntimeOwnershipEvidenceReceipt {
    if (!this.guard) fail('HANDOFF_FAILED', 'Runtime observation guard is unavailable')
    const handoffSnapshot = this.coordinator.getSnapshot()
    const sampleSequence = this.sampleSequence + 1
    const receipt = this.observer.observe(Object.freeze({
      kind: 'repeat-six-part-runtime-ownership-observation' as const,
      guard: this.guard,
      sampleSequence,
      handoffSnapshot,
      originalRoots: Object.freeze(this.retainedRoots.map((entry, index) => Object.freeze({
        rootId: entry.rootId,
        resolvedNodeCount: 1 as const,
        lifecycle: originalLifecycle(handoffSnapshot, index),
        rendererVisible: isRendererVisible(entry.object, this.binding.activeScene),
      }))),
      replacement: Object.freeze({
        ownerId: REPEAT_SIX_PART_REPLACEMENT_OWNER_ID,
        persistentListCount: REPEAT_SIX_PART_HANDOFF_COUNTS.persistentLists as 48,
        physicalUnitCapacity: REPEAT_SIX_PART_HANDOFF_COUNTS.physicalUnits as 1_872,
        lifecycle: replacementLifecycle(handoffSnapshot),
        rendererVisible: isRendererVisible(this.rendererPort.root, this.binding.activeScene),
      }),
    }))
    this.sampleSequence = sampleSequence
    return receipt
  }

  private assertDetachedConstructionOwnership(): void {
    if (this.catalogStage.parent !== null || this.catalogStage.visible !== false) {
      fail(
        'INVALID_PHYSICAL_OWNERSHIP',
        'Replacement catalog stage must enter the bridge detached and hidden',
      )
    }
    this.assertExactVisibleOriginalRoots()
  }

  private assertStagedOriginalOwnership(): void {
    if (
      this.catalogStage.parent !== this.binding.activeScene ||
      this.catalogStage.visible !== false ||
      !isVisibleBehindHiddenGate(this.rendererPort.root, this.catalogStage)
    ) {
      fail(
        'INVALID_PHYSICAL_OWNERSHIP',
        'Replacement catalog stage must remain mounted under the active scene and hidden through staging',
      )
    }
    this.assertExactVisibleOriginalRoots()
  }

  private assertExactVisibleOriginalRoots(): void {
    for (const entry of this.retainedRoots) {
      if (
        entry.object.parent !== this.binding.activeScene ||
        this.binding.activeScene.children[entry.ordinal] !== entry.object ||
        !isRendererVisible(entry.object, this.binding.activeScene)
      ) {
        fail(
          'INVALID_PHYSICAL_OWNERSHIP',
          `${entry.rootId} is not the visible original owner at exact ordinal ${entry.ordinal}`,
        )
      }
    }
  }

  private revalidateImmediatelyBeforeCommit(): DevelopmentRepeatSixPartProductionRootLiveBinding {
    try {
      return getIssuedDevelopmentRepeatSixPartProductionRootLiveBinding(this.resolution)
    } catch (error) {
      fail('RESOLUTION_REJECTED', 'Production-root resolution became stale before atomic commit', error)
    }
  }

  private assertSameBinding(binding: DevelopmentRepeatSixPartProductionRootLiveBinding): void {
    if (
      binding.activeScene !== this.binding.activeScene ||
      binding.roots.some((root, index) => root !== this.retainedRoots[index]?.object)
    ) {
      fail('RESOLUTION_REJECTED', 'Strict resolver returned different live production roots before commit')
    }
    this.assertStagedOriginalOwnership()
  }

  /** No await, promise, timer, requestAnimationFrame, or user callback. */
  private applyPhysicalCommit(binding: DevelopmentRepeatSixPartProductionRootLiveBinding): void {
    const catalog = this.catalogStage
    catalog.visible = false
    if (catalog.parent !== binding.activeScene) {
      fail('INVALID_PHYSICAL_OWNERSHIP', 'Hidden catalog stage left the active scene before atomic commit')
    }
    catalog.userData.productionOwnershipIntegrated = true
    catalog.userData[CATALOG_OWNER_TAG] = REPEAT_SIX_PART_REPLACEMENT_OWNER_ID
    for (const entry of this.retainedRoots) {
      entry.object.userData[SOURCE_OWNERSHIP_TAG] = 'retired-by-repeat-six-part-persistent-catalog'
      entry.object.userData[EXTERNAL_VISIBILITY_TAG] = 'repeat-six-part-catalog'
      entry.object.userData.proceduralInstanced = true
      entry.object.userData.detailLodIgnore = true
      entry.object.visible = false
    }
    catalog.visible = true
  }

  private atomicCommitReceipt(
    token: RepeatSixPartSourceOwnershipHandoffToken,
    command: RepeatSixPartAtomicOwnershipCommitCommand,
    stagedAudit: readonly string[],
  ): RepeatSixPartAtomicOwnershipCommitReceipt {
    return Object.freeze({
      kind: 'repeat-six-part-atomic-ownership-commit-receipt' as const,
      token,
      command,
      generation: this.generation,
      ownershipBaseRevision: token.ownershipBaseRevision,
      committedAtomically: true as const,
      operationOrder: Object.freeze([...stagedAudit, auditOperation(command)]),
      retiredOriginalRootIds: command.expectedRetiredRootIds,
      observerVisibleBefore: command.expectedVisibleBefore,
      observerVisibleAfter: command.expectedVisibleAfter,
    })
  }

  private currentPhysicalOwner(): BridgePhysicalOwner {
    const visibleRoots = this.retainedRoots.filter((entry) =>
      isRendererVisible(entry.object, this.binding.activeScene)).length
    const replacementVisible = isRendererVisible(this.rendererPort.root, this.binding.activeScene)
    if (visibleRoots === this.retainedRoots.length && !replacementVisible) {
      return 'original-production-roots'
    }
    if (visibleRoots === 0 && replacementVisible) return 'replacement-persistent-catalog'
    return 'invalid-zero-partial-or-dual'
  }

  private currentOwnershipEvidenceStatus(): BridgeOwnershipEvidenceStatus {
    if (this.emergencyFailCloseReason !== null) {
      return 'invalidated-by-emergency-physical-fail-close'
    }
    return this.observer.getEvidence().length > 0 ? 'observer-receipt-current' : 'unavailable'
  }

  private markEmergencyPhysicalFailClose(reason: string): void {
    const receipts = this.observer.getEvidence()
    const finalReceipt = receipts[receipts.length - 1] ?? null
    if (this.emergencyFailCloseReason === null) this.emergencyFailCloseReason = reason
    this.invalidatedCommittedEvidenceSequence = finalReceipt?.phase === 'committed-replacement-owner'
      ? finalReceipt.evidenceSequence
      : null
  }

  private prevalidateExactOriginalRootsForRestoration(): void {
    let current: DevelopmentRepeatSixPartProductionRootLiveBinding
    try {
      current = getIssuedDevelopmentRepeatSixPartProductionRootLiveBinding(this.resolution)
    } catch (error) {
      fail('RESTORATION_FAILED', 'Exact production roots became stale before restoration', error)
    }
    if (
      current.activeScene !== this.binding.activeScene ||
      current.roots.some((root, index) => root !== this.retainedRoots[index]?.object)
    ) {
      fail('RESTORATION_FAILED', 'Exact production-root binding changed before restoration')
    }
    for (const entry of this.retainedRoots) {
      if (
        entry.object.parent !== this.binding.activeScene ||
        this.binding.activeScene.children[entry.ordinal] !== entry.object
      ) {
        fail('RESTORATION_FAILED', `${entry.rootId} no longer occupies exact ordinal ${entry.ordinal}`)
      }
    }
  }

  private applyCommittedRootMetadata(): void {
    this.catalogStage.userData.productionOwnershipIntegrated = true
    this.catalogStage.userData[CATALOG_OWNER_TAG] = REPEAT_SIX_PART_REPLACEMENT_OWNER_ID
    for (const entry of this.retainedRoots) {
      entry.object.userData[SOURCE_OWNERSHIP_TAG] = 'retired-by-repeat-six-part-persistent-catalog'
      entry.object.userData[EXTERNAL_VISIBILITY_TAG] = 'repeat-six-part-catalog'
      entry.object.userData.proceduralInstanced = true
      entry.object.userData.detailLodIgnore = true
    }
  }

  /** No ownership switch is required when forward staging fails. */
  private cleanupStagedOriginalOwnership(): void {
    this.assertExactVisibleOriginalRoots()
    this.catalogStage.visible = false
    for (const entry of this.retainedRoots) restoreUserData(entry.object, entry.savedUserData)
    restoreUserData(this.catalogStage, this.catalogSavedUserData)
    try {
      if (this.catalogStage.parent) this.catalogStage.removeFromParent()
    } catch (error) {
      this.restorationCleanupFailure = errorMessage(error)
    }
    if (this.currentPhysicalOwner() !== 'original-production-roots') {
      fail('RESTORATION_FAILED', 'Staged-catalog cleanup disturbed original-only ownership')
    }
  }

  /** Restore the last known-good replacement if original restoration throws. */
  private compensateToReplacementPhysicalOwnership(): void {
    const catalog = this.catalogStage
    if (catalog.parent !== this.binding.activeScene) {
      catalog.visible = false
      this.binding.activeScene.add(catalog)
    }
    this.applyCommittedRootMetadata()
    // Make the replacement available before retiring any partially restored
    // roots. The whole compensation is synchronous and cannot yield a frame.
    catalog.visible = true
    for (const entry of this.retainedRoots) entry.object.visible = false
    if (this.currentPhysicalOwner() !== 'replacement-persistent-catalog') {
      fail('RESTORATION_FAILED', 'Replacement-only compensation could not be proven')
    }
  }

  /**
   * Physical restoration is synchronous and never disposes production data.
   * All four live roots are revalidated before the first visibility mutation.
   * A committed-owner failure compensates back to replacement-only; cleanup
   * errors after original-only ownership is established cannot undo it.
   */
  private restoreOriginalPhysicalOwnership(compensateReplacementOnFailure = false): void {
    this.restorationCleanupFailure = null
    this.prevalidateExactOriginalRootsForRestoration()
    const catalog = this.catalogStage
    try {
      // Keep the known-good replacement visible until every exact original is
      // restored, then close its hidden gate in the same JavaScript turn.
      for (const entry of this.retainedRoots) entry.object.visible = entry.originalVisible
      catalog.visible = false
      if (this.currentPhysicalOwner() !== 'original-production-roots') {
        fail('RESTORATION_FAILED', 'Restored roots do not prove original-only renderer ownership')
      }
    } catch (error) {
      if (!compensateReplacementOnFailure) throw error
      try {
        this.compensateToReplacementPhysicalOwnership()
      } catch (compensationError) {
        throw new DevelopmentRepeatSixPartRealSceneOwnershipBridgeError(
          'RESTORATION_FAILED',
          'Original restoration and replacement-only compensation both failed',
          new AggregateError([error, compensationError]),
        )
      }
      throw new DevelopmentRepeatSixPartRealSceneOwnershipBridgeError(
        'RESTORATION_FAILED',
        'Original restoration failed; replacement-only ownership was restored',
        error,
      )
    }

    const cleanupErrors: unknown[] = []
    for (const entry of this.retainedRoots) {
      try { restoreUserData(entry.object, entry.savedUserData) } catch (error) { cleanupErrors.push(error) }
    }
    try { restoreUserData(catalog, this.catalogSavedUserData) } catch (error) { cleanupErrors.push(error) }
    try { catalog.visible = this.catalogOriginalVisible } catch (error) { cleanupErrors.push(error) }
    try {
      if (catalog.parent) catalog.removeFromParent()
    } catch (error) {
      // Three removes the child before dispatching `removed`; a hostile event
      // listener may throw, but original-only visibility is already final.
      cleanupErrors.push(error)
    }
    if (this.currentPhysicalOwner() !== 'original-production-roots') {
      fail('RESTORATION_FAILED', 'Post-restoration cleanup disturbed original-only ownership')
    }
    if (cleanupErrors.length > 0) {
      this.restorationCleanupFailure = errorMessage(
        new AggregateError(cleanupErrors, 'Original-owner cleanup completed with non-ownership errors'),
      )
    }
  }

  private drainLogicalRollback(reason: string): void {
    if (!this.token || !this.guard) return
    const snapshot = this.coordinator.getSnapshot()
    if (snapshot.state === 'committed' || snapshot.state === 'disposed' || snapshot.state === 'fail-stopped' || snapshot.state === 'idle') {
      return
    }
    let progress: RepeatSixPartSourceOwnershipRollbackProgress = this.coordinator.cancel(this.token, reason)
    this.observeCurrent()
    while (progress.rollbackPending) {
      const command = progress.nextCommand
      if (!command) fail('HANDOFF_FAILED', 'Rollback reported pending work without a command')
      progress = this.coordinator.acknowledgeRollbackOperation(Object.freeze({
        kind: 'repeat-six-part-rollback-operation-receipt' as const,
        token: this.token,
        command,
        generation: this.generation,
        ownershipBaseRevision: this.token.ownershipBaseRevision,
        outcome: 'rolled-back-staged-operation' as const,
      }))
      this.observeCurrent()
    }
  }
}
