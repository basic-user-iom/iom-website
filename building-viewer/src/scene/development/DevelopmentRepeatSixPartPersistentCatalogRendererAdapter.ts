/**
 * DEVELOPMENT-ONLY foundation for the dormant repeat-six-part exact catalog.
 *
 * This module is intentionally outside every application/runtime export path.
 * It owns no Three.js or WebGL objects. A future renderer integration must
 * provide an atomic catalog port and must still satisfy the separate runtime
 * activation authority before importing this foundation into production.
 */

import {
  LogicalSegmentIdentityRegistry,
  type LogicalSegmentCompactedPhysicalPlan,
  type LogicalSegmentHandleRegistration,
  type LogicalSegmentHandleState,
  type LogicalSegmentPhysicalKey,
} from '../LogicalSegmentIdentityRegistry'
import {
  REPEAT_SIX_PART_ACTIVE_LIST_COUNTS,
  RepeatSixPartOfflineActiveListKernel,
  type RepeatSixPartActiveListCommit,
  type RepeatSixPartActiveListManifestInput,
  type RepeatSixPartActiveListPreparation,
  type RepeatSixPartBounds,
  type RepeatSixPartMatrix,
  type RepeatSixPartParity,
  type RepeatSixPartSlotToUnit,
  type RepeatSixPartVec3,
} from '../RepeatSixPartActiveListPlanner'
import type { RepeatSixPartSourceOwnershipEvidence } from '../RepeatSixPartSourceOwnershipHandoff'

const DEVELOPMENT_ADAPTER_KIND = 'development-repeat-six-part-persistent-exact-catalog' as const
const BOUNDS_REFRESH_POLICY = 'all-48-lists-every-publication' as const
const MATERIAL_HANDLE_PREFIX = 'material-'

type MaybePromise<T> = T | Promise<T>

export type DevelopmentRepeatSixPartPersistentListDescriptor = Readonly<{
  key: string
  parity: RepeatSixPartParity
  segmentIndex: number
  segmentId: string
  materialIndex: number
  capacity: number
  trianglesPerInstance: number
}>

/** Opaque persistent object owned by the injected renderer implementation. */
export interface DevelopmentRepeatSixPartPersistentRenderList {
  readonly key: string
  readonly initialState: 'hidden-zero-count-bounds-cleared'
}

export type DevelopmentRepeatSixPartAtomicListState = Readonly<{
  descriptor: DevelopmentRepeatSixPartPersistentListDescriptor
  persistentList: DevelopmentRepeatSixPartPersistentRenderList
  activeCount: number
  visible: boolean
  compactedMatrices: readonly RepeatSixPartMatrix[]
  activeSlotToUnit: readonly RepeatSixPartSlotToUnit[]
  ownerLocalBounds: RepeatSixPartBounds | null
  renderLocalBounds: RepeatSixPartBounds | null
  instanceMatrixUpdateRequired: true
  boundsRecomputeRequired: true
}>

export type DevelopmentRepeatSixPartAtomicCatalogPublication = Readonly<{
  kind: typeof DEVELOPMENT_ADAPTER_KIND
  direction: 'publish' | 'rollback'
  operationId: number
  generation: number
  plannerBaseRevision: number
  plannerRevision: number
  rendererBaseRevision: number
  rendererRevision: number
  selectionInputUnits: 468
  boundsRefreshPolicy: typeof BOUNDS_REFRESH_POLICY
  lists: readonly DevelopmentRepeatSixPartAtomicListState[]
}>

export type DevelopmentRepeatSixPartRendererPublicationReceipt = Readonly<{
  kind: 'development-repeat-six-part-renderer-publication-receipt'
  direction: 'publish' | 'rollback'
  operationId: number
  generation: number
  rendererBaseRevision: number
  rendererRevision: number
  atomicMatrixSlotMapsPublished: true
  boundsRefreshPolicyHonored: true
  publishedListKeys: readonly string[]
  boundsRefreshedListKeys: readonly string[]
}>

export type DevelopmentRepeatSixPartRendererRollbackRequest = Readonly<{
  publication: DevelopmentRepeatSixPartAtomicCatalogPublication
  appliedReceipt: DevelopmentRepeatSixPartRendererPublicationReceipt
}>

export type DevelopmentRepeatSixPartFailStopReason = Readonly<{
  code: DevelopmentRepeatSixPartPersistentCatalogAdapterErrorCode
  generation: number
  plannerRevision: number
  rendererRevision: number
  exactCatalogHidden: boolean
}>

/**
 * The port must make one publication visible as one catalog revision. Matrix
 * buffers and slot maps may not be exposed independently. Empty lists still
 * participate so stale bounds are conservatively cleared on all 48 lists.
 */
export interface DevelopmentRepeatSixPartPersistentCatalogRendererPort {
  createPersistentList(
    descriptor: DevelopmentRepeatSixPartPersistentListDescriptor,
  ): DevelopmentRepeatSixPartPersistentRenderList
  publishAtomicExactCatalog(
    publication: DevelopmentRepeatSixPartAtomicCatalogPublication,
  ): MaybePromise<DevelopmentRepeatSixPartRendererPublicationReceipt>
  rollbackAtomicExactCatalog(
    request: DevelopmentRepeatSixPartRendererRollbackRequest,
  ): MaybePromise<DevelopmentRepeatSixPartRendererPublicationReceipt>
  /**
   * Synchronous renderer-visible fail-stop boundary. Implementations may
   * atomically transfer physical ownership to their fallback before this
   * method returns; yielding here could expose a zero-owner frame.
   */
  hidePersistentExactCatalog(reason: DevelopmentRepeatSixPartFailStopReason): void
  disposePersistentList(list: DevelopmentRepeatSixPartPersistentRenderList): void
}

export interface DevelopmentRepeatSixPartMonolithicFallback {
  /** Invoked in the same JavaScript turn as the synchronous catalog hide. */
  activateMonolithicFallback(reason: DevelopmentRepeatSixPartFailStopReason): void
}

// Runtime structural typing is not an ownership proof. Keep the exact
// renderer object injected into every successfully constructed adapter in a
// module-private weak binding so a scene bridge can reject a valid adapter
// paired with a different (or merely look-alike) physical renderer.
const issuedAdapterRendererBindings = new WeakMap<
  object,
  DevelopmentRepeatSixPartPersistentCatalogRendererPort
>()

export type DevelopmentRepeatSixPartPersistentCatalogAdapterOptions = Readonly<{
  generation: number
  domainId: string
  manifest: RepeatSixPartActiveListManifestInput
  renderer: DevelopmentRepeatSixPartPersistentCatalogRendererPort
  monolithicFallback: DevelopmentRepeatSixPartMonolithicFallback
}>

export type DevelopmentRepeatSixPartFocusSelection = Readonly<{
  generation: number
  focus: Readonly<{
    space: 'owner-local'
    point: RepeatSixPartVec3
  }>
  signal?: AbortSignal
}>

export type DevelopmentRepeatSixPartAdapterState =
  | 'ready'
  | 'updating'
  | 'fail-stopped'
  | 'disposed'

export type DevelopmentRepeatSixPartExactCounters = Readonly<{
  persistentLists: 48
  selectionInputUnits: 468
  registeredPhysicalHandles: 1872
  activeUnits: number
  culledUnits: number
  activeLists: number
  hiddenLists: number
  submittedTriangles: number
  submittedDraws: number
  updateAttempts: number
  preparedUpdates: number
  committedUpdates: number
  noOpUpdates: number
  cancelledUpdates: number
  failedUpdates: number
  rendererPublicationAttempts: number
  verifiedAtomicPublications: number
  rendererRollbackAttempts: number
  verifiedAtomicRollbacks: number
  conservativeBoundsRefreshPasses: number
  conservativelyRefreshedLists: number
  failStopHideAttempts: number
  monolithicFallbackActivationAttempts: number
}>

export type DevelopmentRepeatSixPartPersistentCatalogAdapterSnapshot = Readonly<{
  kind: typeof DEVELOPMENT_ADAPTER_KIND
  developmentOnly: true
  state: DevelopmentRepeatSixPartAdapterState
  generation: number
  operationSequence: number
  plannerRevision: number
  rendererRevision: number
  registryRevision: number
  transactionPhase: 'idle' | 'prepared' | 'rolling-back'
  counters: DevelopmentRepeatSixPartExactCounters
}>

export type DevelopmentRepeatSixPartUpdateResult = Readonly<{
  kind: 'committed' | 'no-op' | 'cancelled'
  cancellationStage: 'before-prepare' | 'before-publish' | 'after-publish' | null
  snapshot: DevelopmentRepeatSixPartPersistentCatalogAdapterSnapshot
}>

export type DevelopmentRepeatSixPartPersistentCatalogAdapterErrorCode =
  | 'INVALID_CONFIGURATION'
  | 'STALE_GENERATION'
  | 'CONCURRENT_UPDATE'
  | 'DISPOSE_PENDING'
  | 'DISPOSED'
  | 'FAIL_STOPPED'
  | 'INVALID_SELECTION_PLAN'
  | 'RENDERER_PUBLICATION_FAILED'
  | 'INVALID_RENDERER_RECEIPT'
  | 'REGISTRY_PUBLICATION_FAILED'
  | 'RENDERER_ROLLBACK_FAILED'
  | 'HANDOFF_EVIDENCE_UNAVAILABLE'

export class DevelopmentRepeatSixPartPersistentCatalogAdapterError extends Error {
  readonly code: DevelopmentRepeatSixPartPersistentCatalogAdapterErrorCode
  readonly primaryCause: unknown
  readonly failStopCauses: readonly unknown[]

  constructor(
    code: DevelopmentRepeatSixPartPersistentCatalogAdapterErrorCode,
    message: string,
    primaryCause: unknown = null,
    failStopCauses: readonly unknown[] = [],
  ) {
    super(message)
    this.name = 'DevelopmentRepeatSixPartPersistentCatalogAdapterError'
    this.code = code
    this.primaryCause = primaryCause
    this.failStopCauses = Object.freeze([...failStopCauses])
  }
}

type MutableCounters = {
  activeUnits: number
  culledUnits: number
  activeLists: number
  hiddenLists: number
  submittedTriangles: number
  submittedDraws: number
  updateAttempts: number
  preparedUpdates: number
  committedUpdates: number
  noOpUpdates: number
  cancelledUpdates: number
  failedUpdates: number
  rendererPublicationAttempts: number
  verifiedAtomicPublications: number
  rendererRollbackAttempts: number
  verifiedAtomicRollbacks: number
  conservativeBoundsRefreshPasses: number
  conservativelyRefreshedLists: number
  failStopHideAttempts: number
  monolithicFallbackActivationAttempts: number
}

type ActiveOperation = {
  id: number
  cancelled: boolean
  done: Promise<void>
  resolveDone: () => void
}

type UnitExpectation = Readonly<{
  id: string
  index: number
  sourceId: string
  sourceIndex: number
  parity: RepeatSixPartParity
  segmentId: string
  segmentIndex: number
  triangles: number
  renderLocalMatrix: RepeatSixPartMatrix
}>

function materialHandleId(materialIndex: number): string {
  return `${MATERIAL_HANDLE_PREFIX}${String(materialIndex).padStart(2, '0')}`
}

function groupKey(parity: RepeatSixPartParity, segmentIndex: number): string {
  return `${parity}:segment-${String(segmentIndex).padStart(2, '0')}`
}

function listKey(parity: RepeatSixPartParity, segmentIndex: number, materialIndex: number): string {
  return `${groupKey(parity, segmentIndex)}:material-${String(materialIndex).padStart(2, '0')}`
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function matricesEqual(left: RepeatSixPartMatrix, right: RepeatSixPartMatrix): boolean {
  return left.length === 16 && right.length === 16 && left.every((value, index) => value === right[index])
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

function assertExactKeys(observed: readonly string[], expected: readonly string[], label: string): void {
  if (!arraysEqual(observed, expected) || new Set(observed).size !== expected.length) {
    throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
      'INVALID_RENDERER_RECEIPT',
      `${label} must contain the exact ordered 48-list catalog`,
    )
  }
}

function freezeDescriptor(
  value: DevelopmentRepeatSixPartPersistentListDescriptor,
): DevelopmentRepeatSixPartPersistentListDescriptor {
  return Object.freeze({ ...value })
}

function asAdapterError(
  code: DevelopmentRepeatSixPartPersistentCatalogAdapterErrorCode,
  message: string,
  cause: unknown,
): DevelopmentRepeatSixPartPersistentCatalogAdapterError {
  if (cause instanceof DevelopmentRepeatSixPartPersistentCatalogAdapterError && cause.code === code) return cause
  return new DevelopmentRepeatSixPartPersistentCatalogAdapterError(code, message, cause)
}

/**
 * Transactional development adapter. Construction allocates exactly 48 list
 * identities and registers all 1,872 material handles once. Updates compact
 * the planner's exhaustive 468-unit selection into those persistent lists.
 */
export class DevelopmentRepeatSixPartPersistentCatalogRendererAdapter {
  readonly generation: number

  private readonly planner: RepeatSixPartOfflineActiveListKernel
  private readonly registry: LogicalSegmentIdentityRegistry
  private readonly renderer: DevelopmentRepeatSixPartPersistentCatalogRendererPort
  private readonly monolithicFallback: DevelopmentRepeatSixPartMonolithicFallback
  private readonly descriptors: readonly DevelopmentRepeatSixPartPersistentListDescriptor[]
  private readonly descriptorByKey = new Map<string, DevelopmentRepeatSixPartPersistentListDescriptor>()
  private readonly persistentListByKey = new Map<string, DevelopmentRepeatSixPartPersistentRenderList>()
  private readonly expectedUnits: readonly UnitExpectation[]
  private readonly expectedUnitByKey = new Map<string, UnitExpectation>()
  private readonly registrations = new Map<LogicalSegmentPhysicalKey, LogicalSegmentHandleRegistration>()
  private readonly logicalHandleStates = new Map<LogicalSegmentPhysicalKey, LogicalSegmentHandleState>()
  private readonly counters: MutableCounters = {
    activeUnits: 0,
    culledUnits: REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.units,
    activeLists: 0,
    hiddenLists: REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.instancedMeshLists,
    submittedTriangles: 0,
    submittedDraws: 0,
    updateAttempts: 0,
    preparedUpdates: 0,
    committedUpdates: 0,
    noOpUpdates: 0,
    cancelledUpdates: 0,
    failedUpdates: 0,
    rendererPublicationAttempts: 0,
    verifiedAtomicPublications: 0,
    rendererRollbackAttempts: 0,
    verifiedAtomicRollbacks: 0,
    conservativeBoundsRefreshPasses: 0,
    conservativelyRefreshedLists: 0,
    failStopHideAttempts: 0,
    monolithicFallbackActivationAttempts: 0,
  }
  private adapterState: DevelopmentRepeatSixPartAdapterState = 'ready'
  private rendererRevision = 0
  private operationSequence = 0
  private activeOperation: ActiveOperation | null = null
  private disposePromise: Promise<void> | null = null
  private lastCommittedPlan: RepeatSixPartActiveListCommit | null = null

  constructor(options: DevelopmentRepeatSixPartPersistentCatalogAdapterOptions) {
    if (!options || !options.renderer || !options.monolithicFallback) {
      throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
        'INVALID_CONFIGURATION',
        'A renderer port and monolithic fallback are required',
      )
    }
    this.generation = options.generation
    this.renderer = options.renderer
    this.monolithicFallback = options.monolithicFallback
    this.planner = new RepeatSixPartOfflineActiveListKernel({
      generation: options.generation,
      manifest: options.manifest,
    })
    this.registry = new LogicalSegmentIdentityRegistry({
      layerGeneration: options.generation,
      domainId: options.domainId,
      sources: options.manifest.catalog.sources.map((source) => ({
        sourceId: source.id,
        segments: options.manifest.geometry.segments.map((segment, segmentIndex) => {
          const unit = options.manifest.catalog.units[
            source.index * REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.segments + segmentIndex
          ]
          return {
            segmentId: segment.id,
            bounds: { min: unit.bounds.min, max: unit.bounds.max },
            expectedHandles: Array.from(
              { length: REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.materialSlots },
              (_, materialIndex) => ({ handleId: materialHandleId(materialIndex), activity: 'culled' as const }),
            ),
          }
        }),
      })),
    })

    const parityCapacity = {
      positive: options.manifest.catalog.sources.filter((source) => source.parity === 'positive').length,
      mirrored: options.manifest.catalog.sources.filter((source) => source.parity === 'mirrored').length,
    }
    const descriptorValues: DevelopmentRepeatSixPartPersistentListDescriptor[] = []
    for (const parity of ['positive', 'mirrored'] as const) {
      for (const segment of options.manifest.geometry.segments) {
        for (let materialIndex = 0; materialIndex < REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.materialSlots; materialIndex += 1) {
          const descriptor = freezeDescriptor({
            key: listKey(parity, segment.index, materialIndex),
            parity,
            segmentIndex: segment.index,
            segmentId: segment.id,
            materialIndex,
            capacity: parityCapacity[parity],
            trianglesPerInstance: segment.triangles,
          })
          descriptorValues.push(descriptor)
          this.descriptorByKey.set(descriptor.key, descriptor)
        }
      }
    }
    if (descriptorValues.length !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.instancedMeshLists) {
      this.registry.dispose()
      this.planner.dispose()
      throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
        'INVALID_CONFIGURATION',
        'The exact catalog must contain 48 persistent list descriptors',
      )
    }
    this.descriptors = Object.freeze(descriptorValues)

    this.expectedUnits = Object.freeze(options.manifest.catalog.units.map((unit) => {
      const source = options.manifest.catalog.sources[unit.sourceIndex]
      const expectation = Object.freeze({
        id: unit.id,
        index: unit.index,
        sourceId: unit.sourceId,
        sourceIndex: unit.sourceIndex,
        parity: source.parity,
        segmentId: unit.segmentId,
        segmentIndex: unit.segmentIndex,
        triangles: unit.triangles,
        renderLocalMatrix: source.renderLocalMatrix.matrix,
      })
      this.expectedUnitByKey.set(unit.id, expectation)
      return expectation
    }))

    const created: DevelopmentRepeatSixPartPersistentRenderList[] = []
    try {
      const uniqueLists = new Set<object>()
      for (const descriptor of this.descriptors) {
        const list = this.renderer.createPersistentList(descriptor)
        const newlyOwned = Boolean(list && typeof list === 'object' && !uniqueLists.has(list))
        if (newlyOwned) {
          uniqueLists.add(list)
          created.push(list)
        }
        if (
          !list ||
          typeof list !== 'object' ||
          list.key !== descriptor.key ||
          list.initialState !== 'hidden-zero-count-bounds-cleared' ||
          !newlyOwned
        ) {
          throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
            'INVALID_CONFIGURATION',
            `Renderer returned an invalid or reused persistent list for ${descriptor.key}`,
          )
        }
        this.persistentListByKey.set(descriptor.key, list)
      }
      this.registerAllLogicalHandles(options.manifest)
    } catch (error) {
      for (const list of created.reverse()) {
        try {
          this.renderer.disposePersistentList(list)
        } catch {
          // Preserve the construction error; no catalog was ever published.
        }
      }
      this.registry.dispose()
      this.planner.dispose()
      throw asAdapterError('INVALID_CONFIGURATION', 'Persistent exact-catalog construction failed', error)
    }
    issuedAdapterRendererBindings.set(this, this.renderer)
  }

  getSnapshot(): DevelopmentRepeatSixPartPersistentCatalogAdapterSnapshot {
    const plannerSnapshot = this.planner.getSnapshot()
    return Object.freeze({
      kind: DEVELOPMENT_ADAPTER_KIND,
      developmentOnly: true as const,
      state: this.adapterState,
      generation: this.generation,
      operationSequence: this.operationSequence,
      plannerRevision: plannerSnapshot.revision,
      rendererRevision: this.rendererRevision,
      registryRevision: this.registry.revision,
      transactionPhase: plannerSnapshot.transactionPhase,
      counters: Object.freeze({
        persistentLists: REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.instancedMeshLists as 48,
        selectionInputUnits: REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.units as 468,
        registeredPhysicalHandles: this.registry.getSnapshot().registeredHandles as 1872,
        ...this.counters,
      }),
    })
  }

  getLogicalHandleState(
    sourceId: string,
    segmentId: string,
    materialIndex: number,
  ): LogicalSegmentHandleState {
    const physicalKey = this.registry.physicalKeyFor(sourceId, segmentId, materialHandleId(materialIndex))
    const state = this.logicalHandleStates.get(physicalKey)
    if (!state) {
      throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
        'INVALID_CONFIGURATION',
        `No logical handle state is registered for ${physicalKey}`,
      )
    }
    return state
  }

  /**
   * Expose the authentic planner/registry evidence needed by the separate
   * development-only source-ownership coordinator. The planner commit must not
   * be cloned here: its module-private issuance identity is part of the handoff
   * boundary. Every returned value is already immutable at its issuing source.
   */
  getSourceOwnershipHandoffEvidence(): RepeatSixPartSourceOwnershipEvidence {
    if (
      this.adapterState !== 'ready' ||
      this.activeOperation !== null ||
      this.disposePromise !== null ||
      this.lastCommittedPlan === null
    ) {
      throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
        'HANDOFF_EVIDENCE_UNAVAILABLE',
        'A completed, healthy exact-catalog publication is required before source ownership can be handed off',
      )
    }
    return Object.freeze({
      plannerCommit: this.lastCommittedPlan,
      registrySnapshot: this.registry.getSnapshot(),
      registryMutationGuard: this.registry.getMutationGuard(),
    })
  }

  cancelPendingUpdate(): boolean {
    if (!this.activeOperation) return false
    this.activeOperation.cancelled = true
    return true
  }

  async updateFocus(
    request: DevelopmentRepeatSixPartFocusSelection,
  ): Promise<DevelopmentRepeatSixPartUpdateResult> {
    this.assertCanUpdate(request?.generation)
    if (this.activeOperation) {
      throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
        'CONCURRENT_UPDATE',
        'Only one exact-catalog publication may be in flight',
      )
    }

    this.counters.updateAttempts += 1
    this.operationSequence += 1
    let resolveDone: () => void = () => undefined
    const done = new Promise<void>((resolve) => { resolveDone = resolve })
    const operation: ActiveOperation = {
      id: this.operationSequence,
      cancelled: false,
      done,
      resolveDone,
    }
    this.activeOperation = operation
    this.adapterState = 'updating'

    try {
      if (this.isCancelled(operation, request.signal)) {
        this.counters.cancelledUpdates += 1
        this.adapterState = 'ready'
        return this.updateResult('cancelled', 'before-prepare')
      }

      const planned = this.planner.prepareFocusUpdate({
        generation: request.generation,
        revision: this.planner.getSnapshot().revision,
        rendererRevision: this.rendererRevision,
        registryMutationGuard: this.registry.getMutationGuard(),
        focus: request.focus,
      })
      if (planned.kind === 'no-op') {
        this.counters.noOpUpdates += 1
        this.adapterState = 'ready'
        return this.updateResult('no-op', null)
      }
      this.counters.preparedUpdates += 1

      if (this.isCancelled(operation, request.signal)) {
        this.planner.cancelPreparedUpdate(planned.token)
        this.counters.cancelledUpdates += 1
        this.adapterState = 'ready'
        return this.updateResult('cancelled', 'before-publish')
      }

      let publication: DevelopmentRepeatSixPartAtomicCatalogPublication
      try {
        publication = this.buildPublication(operation.id, 'publish', planned.replacement)
      } catch (error) {
        this.planner.cancelPreparedUpdate(planned.token)
        throw await this.enterFailStop(
          'INVALID_SELECTION_PLAN',
          'The exhaustive 468-unit selection could not produce an exact 48-list publication',
          error,
        )
      }

      this.counters.rendererPublicationAttempts += 1
      let rawRendererReceipt: DevelopmentRepeatSixPartRendererPublicationReceipt
      try {
        rawRendererReceipt = await this.renderer.publishAtomicExactCatalog(publication)
      } catch (error) {
        this.planner.cancelPreparedUpdate(planned.token)
        throw await this.enterFailStop(
          'RENDERER_PUBLICATION_FAILED',
          'The renderer did not prove an atomic exact-catalog publication',
          error,
        )
      }
      let rendererReceipt: DevelopmentRepeatSixPartRendererPublicationReceipt | null = null
      let receiptValidated = false
      try {
        rendererReceipt = immutableSnapshot(rawRendererReceipt)
        this.assertRendererReceipt(rendererReceipt, publication)
        receiptValidated = true
        this.rendererRevision = rendererReceipt.rendererRevision
        this.counters.verifiedAtomicPublications += 1
        this.recordBoundsRefreshPass()
        const rendererAcknowledgement = this.planner.acknowledgePreparedUpdate(
          this.rendererApplyReceipt(planned, rendererReceipt),
        )
        if (rendererAcknowledgement.committed || rendererAcknowledgement.participant !== 'renderer') {
          throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
            'INVALID_RENDERER_RECEIPT',
            'Renderer acknowledgement advanced the planner before registry publication',
          )
        }
      } catch (error) {
        let containmentError: unknown = null
        try {
          const cancellation = this.planner.cancelPreparedUpdate(planned.token)
          if (receiptValidated && rendererReceipt) {
            if (cancellation.phase === 'rolling-back') {
              await this.rollbackRenderer(planned, publication, rendererReceipt, cancellation.rollbackTarget)
            } else {
              await this.rollbackRendererWithoutPlanner(
                publication,
                rendererReceipt,
                planned.rollbackTarget,
              )
            }
          }
        } catch (observedContainmentError) {
          containmentError = observedContainmentError
        }
        const primary = containmentError
          ? new AggregateError([error, containmentError], 'Renderer receipt acceptance and containment failed')
          : error
        throw await this.enterFailStop(
          containmentError ? 'RENDERER_ROLLBACK_FAILED' : 'INVALID_RENDERER_RECEIPT',
          'The renderer publication receipt did not prove matrices, slots, and all bounds atomically',
          primary,
        )
      }

      if (this.isCancelled(operation, request.signal)) {
        await this.cancelAfterRendererPublication(planned, publication, rendererReceipt)
        this.counters.cancelledUpdates += 1
        this.adapterState = 'ready'
        return this.updateResult('cancelled', 'after-publish')
      }

      let registryAppliedGuard: Readonly<{ layerGeneration: number; revision: number }> | null = null
      try {
        const registryResult = this.registry.applyCompactedPhysicalPlan(
          this.registryPlanForCommit(planned.replacement),
          planned.token.registryBaseMutationGuard,
        )
        if (
          !registryResult.changed ||
          registryResult.guard.layerGeneration !== this.generation ||
          registryResult.guard.revision !== planned.token.registryBaseMutationGuard.revision + 1
        ) {
          throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
            'REGISTRY_PUBLICATION_FAILED',
            'The registry did not advance exactly one atomic revision',
          )
        }
        registryAppliedGuard = registryResult.guard
        const acknowledgement = this.planner.acknowledgePreparedUpdate({
          kind: 'repeat-six-part-participant-apply-receipt',
          token: planned.token,
          participant: 'registry',
          layerGeneration: this.generation,
          rendererBaseRevision: planned.token.rendererBaseRevision,
          rendererAppliedRevision: planned.token.rendererBaseRevision,
          registryBaseMutationGuard: planned.token.registryBaseMutationGuard,
          registryAppliedMutationGuard: registryResult.guard,
        })
        if (!acknowledgement.committed || acknowledgement.commit !== planned.replacement) {
          throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
            'REGISTRY_PUBLICATION_FAILED',
            'Planner and registry did not commit the same exact-catalog replacement',
          )
        }
        this.lastCommittedPlan = acknowledgement.commit
      } catch (error) {
        const rollbackErrors: unknown[] = []
        let cancellation: ReturnType<RepeatSixPartOfflineActiveListKernel['cancelPreparedUpdate']> | null = null
        try {
          cancellation = this.planner.cancelPreparedUpdate(planned.token)
        } catch (observedRollbackError) {
          rollbackErrors.push(observedRollbackError)
        }
        if (registryAppliedGuard) {
          try {
            const restored = this.registry.applyCompactedPhysicalPlan(
              this.registryPlanForCommit(planned.rollbackTarget),
              registryAppliedGuard,
            )
            if (!restored.changed || restored.guard.revision !== registryAppliedGuard.revision + 1) {
              throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
                'REGISTRY_PUBLICATION_FAILED',
                'Registry rollback did not advance one compensating revision',
              )
            }
          } catch (observedRollbackError) {
            rollbackErrors.push(observedRollbackError)
          }
        }
        if (cancellation?.phase === 'rolling-back') {
          try {
            await this.rollbackRenderer(planned, publication, rendererReceipt, cancellation.rollbackTarget)
          } catch (observedRollbackError) {
            rollbackErrors.push(observedRollbackError)
          }
        }
        const primary = rollbackErrors.length
          ? new AggregateError([error, ...rollbackErrors], 'Registry apply and compensating rollback failed')
          : error
        throw await this.enterFailStop(
          rollbackErrors.length ? 'RENDERER_ROLLBACK_FAILED' : 'REGISTRY_PUBLICATION_FAILED',
          'Exact-catalog registry publication failed; the adapter is fail-stopped on the monolithic fallback',
          primary,
        )
      }

      this.commitCounters(planned.replacement)
      this.counters.committedUpdates += 1
      this.adapterState = 'ready'
      return this.updateResult('committed', null)
    } finally {
      if (this.activeOperation === operation) this.activeOperation = null
      if (this.adapterState === 'updating') this.adapterState = 'ready'
      operation.resolveDone()
    }
  }

  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise
    this.disposePromise = (async () => {
      const operation = this.activeOperation
      if (operation) {
        operation.cancelled = true
        await operation.done
      }
      if (this.adapterState === 'disposed') return
      const errors: unknown[] = []
      for (const descriptor of [...this.descriptors].reverse()) {
        const list = this.persistentListByKey.get(descriptor.key)
        if (!list) continue
        try {
          this.renderer.disposePersistentList(list)
        } catch (error) {
          errors.push(error)
        }
      }
      try {
        this.registry.dispose()
      } catch (error) {
        errors.push(error)
      }
      this.planner.dispose()
      this.persistentListByKey.clear()
      this.logicalHandleStates.clear()
      this.lastCommittedPlan = null
      this.adapterState = 'disposed'
      if (errors.length) throw new AggregateError(errors, 'Persistent exact-catalog disposal failed')
    })()
    return this.disposePromise
  }

  private assertCanUpdate(generation: number): void {
    if (generation !== this.generation) {
      throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
        'STALE_GENERATION',
        `Stale adapter generation ${generation}; current generation is ${this.generation}`,
      )
    }
    if (this.adapterState === 'disposed') {
      throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError('DISPOSED', 'Adapter was disposed')
    }
    if (this.disposePromise) {
      throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError('DISPOSE_PENDING', 'Adapter disposal is pending')
    }
    if (this.adapterState === 'fail-stopped') {
      throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
        'FAIL_STOPPED',
        'Adapter is fail-stopped; only the monolithic fallback may remain visible',
      )
    }
  }

  private isCancelled(operation: ActiveOperation, signal: AbortSignal | undefined): boolean {
    return operation.cancelled || signal?.aborted === true
  }

  private updateResult(
    kind: DevelopmentRepeatSixPartUpdateResult['kind'],
    cancellationStage: DevelopmentRepeatSixPartUpdateResult['cancellationStage'],
  ): DevelopmentRepeatSixPartUpdateResult {
    return Object.freeze({ kind, cancellationStage, snapshot: this.getSnapshot() })
  }

  private buildPublication(
    operationId: number,
    direction: DevelopmentRepeatSixPartAtomicCatalogPublication['direction'],
    commit: RepeatSixPartActiveListCommit,
  ): DevelopmentRepeatSixPartAtomicCatalogPublication {
    this.assertExactCommit(commit)
    const rendererBaseRevision = this.rendererRevision
    const lists = Object.freeze(commit.lists.map((source) => {
      const descriptor = this.descriptorByKey.get(source.key)!
      const persistentList = this.persistentListByKey.get(source.key)!
      return Object.freeze({
        descriptor,
        persistentList,
        activeCount: source.activeCount,
        visible: source.visible,
        compactedMatrices: source.matrices,
        activeSlotToUnit: source.slotToUnit,
        ownerLocalBounds: source.ownerLocalBounds,
        renderLocalBounds: source.renderLocalBounds,
        instanceMatrixUpdateRequired: true as const,
        boundsRecomputeRequired: true as const,
      })
    }))
    return Object.freeze({
      kind: DEVELOPMENT_ADAPTER_KIND,
      direction,
      operationId,
      generation: this.generation,
      plannerBaseRevision: commit.baseRevision,
      plannerRevision: commit.revision,
      rendererBaseRevision,
      rendererRevision: rendererBaseRevision + 1,
      selectionInputUnits: REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.units as 468,
      boundsRefreshPolicy: BOUNDS_REFRESH_POLICY,
      lists,
    })
  }

  private assertExactCommit(commit: RepeatSixPartActiveListCommit): void {
    const invalid = (message: string): never => {
      throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError('INVALID_SELECTION_PLAN', message)
    }
    if (commit.generation !== this.generation) invalid('Selection generation is stale')
    if (commit.unitStates.length !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.units) {
      invalid('Selection must contain exactly 468 unit states')
    }
    const activityByUnit = new Map<string, 'active' | 'culled'>()
    for (const state of commit.unitStates) {
      if (!this.expectedUnitByKey.has(state.unitKey) || activityByUnit.has(state.unitKey)) {
        invalid(`Selection contains an unknown or duplicate unit ${state.unitKey}`)
      }
      if (state.activity !== 'active' && state.activity !== 'culled') invalid(`Invalid activity for ${state.unitKey}`)
      activityByUnit.set(state.unitKey, state.activity)
    }
    for (const expected of this.expectedUnits) {
      if (!activityByUnit.has(expected.id)) invalid(`Selection omits ${expected.id}`)
    }

    const activeKeys = this.expectedUnits.filter((unit) => activityByUnit.get(unit.id) === 'active').map((unit) => unit.id)
    if (!arraysEqual(commit.activeUnitKeys, activeKeys)) invalid('activeUnitKeys does not match the exhaustive selection')
    if (commit.lists.length !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.instancedMeshLists) {
      invalid('Selection must contain exactly 48 persistent list replacements')
    }
    if (commit.groups.length !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.paritySegmentGroups) {
      invalid('Selection must contain exactly 12 parity/segment groups')
    }

    const seenLists = new Set<string>()
    for (let listIndex = 0; listIndex < this.descriptors.length; listIndex += 1) {
      const descriptor = this.descriptors[listIndex]
      const list = commit.lists[listIndex]
      if (!list || list.key !== descriptor.key || seenLists.has(list.key)) {
        invalid(`List ${listIndex} does not match persistent descriptor ${descriptor.key}`)
      }
      seenLists.add(list.key)
      if (
        list.parity !== descriptor.parity ||
        list.segmentIndex !== descriptor.segmentIndex ||
        list.segmentId !== descriptor.segmentId ||
        list.materialIndex !== descriptor.materialIndex ||
        list.capacity !== descriptor.capacity
      ) {
        invalid(`List metadata does not match ${descriptor.key}`)
      }
      if (!list.instanceMatrixUpdateRequired || !list.boundsRecomputeRequired) {
        invalid(`${descriptor.key} does not require a conservative matrix and bounds refresh`)
      }
      const candidates = this.expectedUnits.filter(
        (unit) => unit.parity === descriptor.parity && unit.segmentIndex === descriptor.segmentIndex,
      )
      const selected = candidates.filter((unit) => activityByUnit.get(unit.id) === 'active')
      const culled = candidates.filter((unit) => activityByUnit.get(unit.id) === 'culled')
      const complete = [...selected, ...culled]
      if (
        list.activeCount !== selected.length ||
        list.present !== (selected.length > 0) ||
        list.visible !== (selected.length > 0) ||
        list.unitKeys.length !== selected.length ||
        list.matrices.length !== selected.length ||
        list.slotToUnit.length !== selected.length ||
        list.completeSlotPermutation.length !== candidates.length ||
        list.completeSlotMatrices.length !== candidates.length
      ) {
        invalid(`Compacted counts are inconsistent for ${descriptor.key}`)
      }
      if (
        (selected.length === 0) !== (list.ownerLocalBounds === null) ||
        (selected.length === 0) !== (list.renderLocalBounds === null)
      ) {
        invalid(`Bounds presence is inconsistent for ${descriptor.key}`)
      }
      for (let slot = 0; slot < selected.length; slot += 1) {
        const expected = selected[slot]
        const entry = list.slotToUnit[slot]
        if (
          list.unitKeys[slot] !== expected.id ||
          entry.slot !== slot ||
          entry.unitKey !== expected.id ||
          entry.unitIndex !== expected.index ||
          entry.sourceIndex !== expected.sourceIndex ||
          entry.sourceId !== expected.sourceId ||
          entry.activity !== 'active' ||
          !matricesEqual(list.matrices[slot], expected.renderLocalMatrix)
        ) {
          invalid(`Active slot ${slot} is inconsistent for ${descriptor.key}`)
        }
      }
      for (let slot = 0; slot < complete.length; slot += 1) {
        const expected = complete[slot]
        const entry = list.completeSlotPermutation[slot]
        if (
          entry.slot !== slot ||
          entry.unitKey !== expected.id ||
          entry.unitIndex !== expected.index ||
          entry.sourceIndex !== expected.sourceIndex ||
          entry.sourceId !== expected.sourceId ||
          entry.activity !== activityByUnit.get(expected.id) ||
          !matricesEqual(list.completeSlotMatrices[slot], expected.renderLocalMatrix)
        ) {
          invalid(`Complete slot ${slot} is inconsistent for ${descriptor.key}`)
        }
      }
    }

    const submittedTriangles = this.expectedUnits.reduce(
      (sum, unit) => sum + (activityByUnit.get(unit.id) === 'active' ? unit.triangles : 0),
      0,
    )
    const activeGroups = new Set(this.expectedUnits
      .filter((unit) => activityByUnit.get(unit.id) === 'active')
      .map((unit) => groupKey(unit.parity, unit.segmentIndex))).size
    const submittedDraws = activeGroups * REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.materialSlots
    if (
      commit.metrics.activeUnits !== activeKeys.length ||
      commit.metrics.culledUnits !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.units - activeKeys.length ||
      commit.metrics.activeLists !== submittedDraws ||
      commit.metrics.hiddenLists !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.instancedMeshLists - submittedDraws ||
      commit.metrics.submittedTriangles !== submittedTriangles ||
      commit.metrics.submittedDraws !== submittedDraws
    ) {
      invalid('Selection metrics do not match the exact 468-unit catalog')
    }
  }

  private assertRendererReceipt(
    receipt: DevelopmentRepeatSixPartRendererPublicationReceipt,
    publication: DevelopmentRepeatSixPartAtomicCatalogPublication,
  ): void {
    if (
      !receipt ||
      receipt.kind !== 'development-repeat-six-part-renderer-publication-receipt' ||
      receipt.direction !== publication.direction ||
      receipt.operationId !== publication.operationId ||
      receipt.generation !== publication.generation ||
      receipt.rendererBaseRevision !== publication.rendererBaseRevision ||
      receipt.rendererRevision !== publication.rendererRevision ||
      receipt.atomicMatrixSlotMapsPublished !== true ||
      receipt.boundsRefreshPolicyHonored !== true
    ) {
      throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
        'INVALID_RENDERER_RECEIPT',
        'Renderer receipt metadata does not match the requested atomic publication',
      )
    }
    const keys = this.descriptors.map((descriptor) => descriptor.key)
    assertExactKeys(receipt.publishedListKeys, keys, 'publishedListKeys')
    assertExactKeys(receipt.boundsRefreshedListKeys, keys, 'boundsRefreshedListKeys')
  }

  private rendererApplyReceipt(
    preparation: RepeatSixPartActiveListPreparation,
    receipt: DevelopmentRepeatSixPartRendererPublicationReceipt,
  ) {
    return Object.freeze({
      kind: 'repeat-six-part-participant-apply-receipt' as const,
      token: preparation.token,
      participant: 'renderer' as const,
      layerGeneration: this.generation,
      rendererBaseRevision: preparation.token.rendererBaseRevision,
      rendererAppliedRevision: receipt.rendererRevision,
      registryBaseMutationGuard: preparation.token.registryBaseMutationGuard,
      registryAppliedMutationGuard: preparation.token.registryBaseMutationGuard,
    })
  }

  private registryPlanForCommit(commit: RepeatSixPartActiveListCommit): LogicalSegmentCompactedPhysicalPlan {
    const placements: LogicalSegmentCompactedPhysicalPlan['placements'][number][] = []
    const activities: LogicalSegmentCompactedPhysicalPlan['activities'][number][] = []
    for (const list of commit.lists) {
      const handleId = materialHandleId(list.materialIndex)
      for (const slot of list.completeSlotPermutation) {
        const physicalKey = this.registry.physicalKeyFor(slot.sourceId, list.segmentId, handleId)
        const registration = this.registrations.get(physicalKey)
        if (!registration) {
          throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
            'REGISTRY_PUBLICATION_FAILED',
            `Missing persistent registration for ${physicalKey}`,
          )
        }
        placements.push({ registration, placement: { batchId: list.key, slot: slot.slot } })
        activities.push({ physicalKey, activity: slot.activity })
      }
    }
    return Object.freeze({
      placements: Object.freeze(placements),
      activities: Object.freeze(activities),
      presentation: this.registry.getPresentationSnapshot(),
    })
  }

  private async cancelAfterRendererPublication(
    preparation: RepeatSixPartActiveListPreparation,
    publication: DevelopmentRepeatSixPartAtomicCatalogPublication,
    receipt: DevelopmentRepeatSixPartRendererPublicationReceipt,
  ): Promise<void> {
    const cancellation = this.planner.cancelPreparedUpdate(preparation.token)
    if (cancellation.phase !== 'rolling-back') {
      throw await this.enterFailStop(
        'RENDERER_ROLLBACK_FAILED',
        'Cancellation lost the renderer apply acknowledgement',
        cancellation,
      )
    }
    try {
      await this.rollbackRenderer(preparation, publication, receipt, cancellation.rollbackTarget)
    } catch (error) {
      throw await this.enterFailStop(
        'RENDERER_ROLLBACK_FAILED',
        'Cancelled exact-catalog publication could not be rolled back',
        error,
      )
    }
  }

  private async rollbackRenderer(
    preparation: RepeatSixPartActiveListPreparation,
    appliedPublication: DevelopmentRepeatSixPartAtomicCatalogPublication,
    appliedReceipt: DevelopmentRepeatSixPartRendererPublicationReceipt,
    rollbackTarget: RepeatSixPartActiveListCommit,
  ): Promise<void> {
    const rollbackPublication = this.buildPublication(appliedPublication.operationId, 'rollback', rollbackTarget)
    this.counters.rendererRollbackAttempts += 1
    const rawReceipt = await this.renderer.rollbackAtomicExactCatalog(Object.freeze({
      publication: rollbackPublication,
      appliedReceipt,
    }))
    const receipt = immutableSnapshot(rawReceipt)
    this.assertRendererReceipt(receipt, rollbackPublication)
    this.rendererRevision = receipt.rendererRevision
    this.counters.verifiedAtomicRollbacks += 1
    this.recordBoundsRefreshPass()
    this.planner.acknowledgePreparedUpdateRollback(Object.freeze({
      kind: 'repeat-six-part-participant-rollback-receipt' as const,
      token: preparation.token,
      participant: 'renderer' as const,
      layerGeneration: this.generation,
      rendererRestoredRevision: receipt.rendererRevision,
      registryRestoredMutationGuard: preparation.token.registryBaseMutationGuard,
    }))
  }

  private async rollbackRendererWithoutPlanner(
    appliedPublication: DevelopmentRepeatSixPartAtomicCatalogPublication,
    appliedReceipt: DevelopmentRepeatSixPartRendererPublicationReceipt,
    rollbackTarget: RepeatSixPartActiveListCommit,
  ): Promise<void> {
    const rollbackPublication = this.buildPublication(appliedPublication.operationId, 'rollback', rollbackTarget)
    this.counters.rendererRollbackAttempts += 1
    const rawReceipt = await this.renderer.rollbackAtomicExactCatalog(Object.freeze({
      publication: rollbackPublication,
      appliedReceipt,
    }))
    const receipt = immutableSnapshot(rawReceipt)
    this.assertRendererReceipt(receipt, rollbackPublication)
    this.rendererRevision = receipt.rendererRevision
    this.counters.verifiedAtomicRollbacks += 1
    this.recordBoundsRefreshPass()
  }

  private recordBoundsRefreshPass(): void {
    this.counters.conservativeBoundsRefreshPasses += 1
    this.counters.conservativelyRefreshedLists += REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.instancedMeshLists
  }

  private commitCounters(commit: RepeatSixPartActiveListCommit): void {
    this.counters.activeUnits = commit.metrics.activeUnits
    this.counters.culledUnits = commit.metrics.culledUnits
    this.counters.activeLists = commit.metrics.activeLists
    this.counters.hiddenLists = commit.metrics.hiddenLists
    this.counters.submittedTriangles = commit.metrics.submittedTriangles
    this.counters.submittedDraws = commit.metrics.submittedDraws
  }

  private async enterFailStop(
    code: DevelopmentRepeatSixPartPersistentCatalogAdapterErrorCode,
    message: string,
    primaryCause: unknown,
  ): Promise<DevelopmentRepeatSixPartPersistentCatalogAdapterError> {
    this.adapterState = 'fail-stopped'
    this.counters.failedUpdates += 1
    const failStopCauses: unknown[] = []
    const baseReason = {
      code,
      generation: this.generation,
      plannerRevision: this.planner.getSnapshot().revision,
      rendererRevision: this.rendererRevision,
    }
    this.counters.failStopHideAttempts += 1
    let hidden = false
    try {
      this.renderer.hidePersistentExactCatalog(Object.freeze({ ...baseReason, exactCatalogHidden: false }))
      hidden = true
    } catch (error) {
      failStopCauses.push(error)
    }
    if (hidden) {
      this.counters.monolithicFallbackActivationAttempts += 1
      try {
        this.monolithicFallback.activateMonolithicFallback(Object.freeze({
          ...baseReason,
          exactCatalogHidden: true,
        }))
      } catch (error) {
        failStopCauses.push(error)
      }
    }
    return new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
      code,
      message,
      primaryCause,
      failStopCauses,
    )
  }

  private registerAllLogicalHandles(manifest: RepeatSixPartActiveListManifestInput): void {
    const transaction = this.registry.beginHandleRegistration()
    const paritySlots = new Map<number, number>()
    const nextParitySlot: Record<RepeatSixPartParity, number> = { positive: 0, mirrored: 0 }
    for (const source of manifest.catalog.sources) {
      paritySlots.set(source.index, nextParitySlot[source.parity])
      nextParitySlot[source.parity] += 1
    }
    try {
      for (const source of manifest.catalog.sources) {
        const slot = paritySlots.get(source.index)!
        for (const segment of manifest.geometry.segments) {
          for (let materialIndex = 0; materialIndex < REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.materialSlots; materialIndex += 1) {
            const handleId = materialHandleId(materialIndex)
            const physicalKey = this.registry.physicalKeyFor(source.id, segment.id, handleId)
            this.registry.stageHandle(transaction, {
              physicalKey,
              handle: {
                applyLogicalSegmentState: (state) => {
                  this.logicalHandleStates.set(physicalKey, state)
                },
              },
              placement: {
                batchId: listKey(source.parity, segment.index, materialIndex),
                slot,
              },
            })
          }
        }
      }
      const registrations = this.registry.commitHandles(transaction)
      if (registrations.length !== 1872) {
        throw new DevelopmentRepeatSixPartPersistentCatalogAdapterError(
          'INVALID_CONFIGURATION',
          `Expected 1,872 persistent logical handles; received ${registrations.length}`,
        )
      }
      for (const registration of registrations) this.registrations.set(registration.physicalKey, registration)
    } catch (error) {
      this.registry.rollbackHandles(transaction)
      throw error
    }
  }
}

/**
 * Unforgeable identity check used by the development real-scene bridge.
 * Neither an adapter-shaped object nor a renderer-shaped object can satisfy
 * this unless this module completed construction with that exact pair.
 */
export function isIssuedDevelopmentRepeatSixPartAdapterRendererBinding(
  adapter: unknown,
  renderer: unknown,
): adapter is DevelopmentRepeatSixPartPersistentCatalogRendererAdapter {
  return Boolean(
    adapter &&
    typeof adapter === 'object' &&
    renderer &&
    typeof renderer === 'object' &&
    issuedAdapterRendererBindings.get(adapter as object) === renderer,
  )
}
