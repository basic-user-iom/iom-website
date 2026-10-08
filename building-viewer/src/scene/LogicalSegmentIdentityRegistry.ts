/**
 * Pure logical-to-physical identity and presentation state for a persistent,
 * segmented instancing catalog.
 *
 * The registry deliberately knows nothing about Three.js, meshes, or WebGL.
 * A physical handle is an adapter supplied by the eventual renderer. Stable
 * identity never includes an instancing batch or slot: both are mutable
 * placement details that may change whenever a batch is compacted.
 */

export type LogicalSegmentSourceId = string | number
export type LogicalSegmentPhysicalActivity = 'active' | 'culled'

declare const LOGICAL_KEY_BRAND: unique symbol
declare const SEGMENT_KEY_BRAND: unique symbol
declare const PHYSICAL_KEY_BRAND: unique symbol

export type LogicalSegmentLogicalKey = string & { readonly [LOGICAL_KEY_BRAND]: true }
export type LogicalSegmentKey = string & { readonly [SEGMENT_KEY_BRAND]: true }
export type LogicalSegmentPhysicalKey = string & { readonly [PHYSICAL_KEY_BRAND]: true }

export type LogicalSegmentIdentity = Readonly<{
  layerGeneration: number
  domainId: string
  sourceId: LogicalSegmentSourceId
}>

export type LogicalSegmentBounds = Readonly<{
  min: readonly [number, number, number]
  max: readonly [number, number, number]
}>

export type LogicalSegmentPlacement = Readonly<{
  batchId: string
  slot: number
}>

export type LogicalSegmentExpectedHandle = Readonly<{
  handleId: string
  activity?: LogicalSegmentPhysicalActivity
}>

export type LogicalSegmentCatalogSegment = Readonly<{
  segmentId: string
  bounds: LogicalSegmentBounds
  expectedHandles: readonly LogicalSegmentExpectedHandle[]
}>

export type LogicalSegmentCatalogSource = Readonly<{
  sourceId: LogicalSegmentSourceId
  segments: readonly LogicalSegmentCatalogSegment[]
}>

export type LogicalSegmentIdentityRegistryOptions = Readonly<{
  layerGeneration: number
  domainId: string
  sources: readonly LogicalSegmentCatalogSource[]
}>

export type LogicalSegmentMutationGuard = Readonly<{
  layerGeneration: number
  revision: number
}>

/**
 * Complete state pushed to one physical renderer adapter. The same adapter may
 * serve many registrations; physicalKey and placement identify the exact unit.
 */
export type LogicalSegmentHandleState = Readonly<{
  layerGeneration: number
  registryRevision: number
  logicalKey: LogicalSegmentLogicalKey
  segmentKey: LogicalSegmentKey
  physicalKey: LogicalSegmentPhysicalKey
  placement: LogicalSegmentPlacement
  activity: LogicalSegmentPhysicalActivity
  cohortComplete: boolean
  visible: boolean
  hidden: boolean
  isolationActive: boolean
  isolated: boolean
  selected: boolean
  highlighted: boolean
}>

/** A renderer-owned adapter. It may be implemented by a plain test object. */
export interface LogicalSegmentPhysicalHandle {
  applyLogicalSegmentState(state: LogicalSegmentHandleState): void
}

export type LogicalSegmentHandleDescriptor = Readonly<{
  physicalKey: LogicalSegmentPhysicalKey
  handle: LogicalSegmentPhysicalHandle
  placement: LogicalSegmentPlacement
}>

export type LogicalSegmentRegistrationTransaction = Readonly<{
  transactionId: number
  layerGeneration: number
  baseRevision: number
}>

/** Opaque unregister/remap capability returned only after a successful commit. */
export type LogicalSegmentHandleRegistration = Readonly<{
  registrationId: number
  physicalKey: LogicalSegmentPhysicalKey
}>

export type LogicalSegmentPlacementRemap = Readonly<{
  registration: LogicalSegmentHandleRegistration
  placement: LogicalSegmentPlacement
}>

export type LogicalSegmentActivityChange = Readonly<{
  physicalKey: LogicalSegmentPhysicalKey
  activity: LogicalSegmentPhysicalActivity
}>

export type LogicalSegmentPresentationReplacement = Readonly<{
  hiddenLogicalKeys: readonly LogicalSegmentLogicalKey[]
  selectedLogicalKeys: readonly LogicalSegmentLogicalKey[]
  highlightedLogicalKeys: readonly LogicalSegmentLogicalKey[]
  isolatedLogicalKeys: readonly LogicalSegmentLogicalKey[] | null
}>

/**
 * Complete atomic renderer-compaction publication. Every registered handle
 * receives exactly one placement, every expected physical unit receives
 * exactly one activity, and presentation is replaced in the same revision.
 * Splitting these three mutations would expose stale slots or partial rows.
 */
export type LogicalSegmentCompactedPhysicalPlan = Readonly<{
  placements: readonly LogicalSegmentPlacementRemap[]
  activities: readonly LogicalSegmentActivityChange[]
  presentation: LogicalSegmentPresentationReplacement
}>

export type LogicalSegmentCompactedPhysicalPlanResult = Readonly<{
  changed: boolean
  previousGuard: LogicalSegmentMutationGuard
  guard: LogicalSegmentMutationGuard
}>

export type LogicalSegmentPhysicalUnitState = Readonly<{
  logicalKey: LogicalSegmentLogicalKey
  segmentKey: LogicalSegmentKey
  physicalKey: LogicalSegmentPhysicalKey
  handleId: string
  activity: LogicalSegmentPhysicalActivity
  registered: boolean
  placement: LogicalSegmentPlacement | null
}>

export type LogicalSegmentRegistrySnapshot = Readonly<{
  layerGeneration: number
  domainId: string
  revision: number
  disposed: boolean
  logicalSources: number
  segments: number
  expectedPhysicalUnits: number
  activePhysicalUnits: number
  culledPhysicalUnits: number
  registeredHandles: number
  completeLogicalSources: number
  incompleteLogicalSources: number
  hiddenLogicalSources: number
  selectedLogicalSources: number
  highlightedLogicalSources: number
  isolationActive: boolean
}>

// Aggregate counts are useful diagnostics but are forgeable as plain objects.
// Transaction boundaries that require authoritative registry evidence can use
// these predicates; only this module can issue entries into the WeakSets.
const issuedLogicalSegmentRegistrySnapshots = new WeakMap<object, object>()
const issuedLogicalSegmentMutationGuards = new WeakMap<object, object>()

export function isIssuedLogicalSegmentRegistrySnapshot(
  value: unknown,
): value is LogicalSegmentRegistrySnapshot {
  return value !== null && typeof value === 'object' && issuedLogicalSegmentRegistrySnapshots.has(value)
}

export function isIssuedLogicalSegmentMutationGuard(
  value: unknown,
): value is LogicalSegmentMutationGuard {
  return value !== null && typeof value === 'object' && issuedLogicalSegmentMutationGuards.has(value)
}

export function areIssuedLogicalSegmentEvidenceFromSameRegistry(
  snapshot: unknown,
  guard: unknown,
): snapshot is LogicalSegmentRegistrySnapshot {
  if (!isIssuedLogicalSegmentRegistrySnapshot(snapshot) || !isIssuedLogicalSegmentMutationGuard(guard)) {
    return false
  }
  return issuedLogicalSegmentRegistrySnapshots.get(snapshot) === issuedLogicalSegmentMutationGuards.get(guard)
}

export class LogicalSegmentRegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LogicalSegmentRegistryError'
  }
}

export class StaleLogicalSegmentGenerationError extends LogicalSegmentRegistryError {
  constructor(expected: number, observed: number) {
    super(`Stale layer generation ${observed}; current generation is ${expected}`)
    this.name = 'StaleLogicalSegmentGenerationError'
  }
}

export class StaleLogicalSegmentRevisionError extends LogicalSegmentRegistryError {
  constructor(expected: number, observed: number) {
    super(`Stale registry revision ${observed}; current revision is ${expected}`)
    this.name = 'StaleLogicalSegmentRevisionError'
  }
}

export class IncompleteLogicalSegmentCohortError extends LogicalSegmentRegistryError {
  readonly logicalKeys: readonly LogicalSegmentLogicalKey[]

  constructor(logicalKeys: readonly LogicalSegmentLogicalKey[]) {
    super(`Logical cohort action refused; expected resident handles are missing for ${logicalKeys.join(', ')}`)
    this.name = 'IncompleteLogicalSegmentCohortError'
    this.logicalKeys = Object.freeze([...logicalKeys])
  }
}

export class PartialLogicalSegmentActivityError extends LogicalSegmentRegistryError {
  readonly segmentKeys: readonly LogicalSegmentKey[]

  constructor(segmentKeys: readonly LogicalSegmentKey[]) {
    super(`Segment activity must change as a complete handle cohort: ${segmentKeys.join(', ')}`)
    this.name = 'PartialLogicalSegmentActivityError'
    this.segmentKeys = Object.freeze([...segmentKeys])
  }
}

type MutablePhysicalUnit = {
  logicalKey: LogicalSegmentLogicalKey
  segmentKey: LogicalSegmentKey
  physicalKey: LogicalSegmentPhysicalKey
  handleId: string
  activity: LogicalSegmentPhysicalActivity
}

type LogicalRecord = {
  identity: LogicalSegmentIdentity
  logicalKey: LogicalSegmentLogicalKey
  segmentKeys: LogicalSegmentKey[]
  physicalKeys: LogicalSegmentPhysicalKey[]
  bounds: LogicalSegmentBounds
}

type SegmentRecord = {
  logicalKey: LogicalSegmentLogicalKey
  segmentKey: LogicalSegmentKey
  segmentId: string
  bounds: LogicalSegmentBounds
  physicalKeys: LogicalSegmentPhysicalKey[]
}

type HandleRecord = {
  unit: MutablePhysicalUnit
  handle: LogicalSegmentPhysicalHandle
  placement: LogicalSegmentPlacement
  registration: LogicalSegmentHandleRegistration
}

type StagedHandle = {
  unit: MutablePhysicalUnit
  handle: LogicalSegmentPhysicalHandle
  placement: LogicalSegmentPlacement
}

type TransactionState = {
  publicValue: LogicalSegmentRegistrationTransaction
  status: 'open' | 'committed' | 'rolled-back' | 'rejected'
  staged: Map<LogicalSegmentPhysicalKey, StagedHandle>
}

type RegistrationState = {
  record: HandleRecord
  active: boolean
}

type PresentationModel = {
  hidden: Set<LogicalSegmentLogicalKey>
  selected: Set<LogicalSegmentLogicalKey>
  highlighted: Set<LogicalSegmentLogicalKey>
  isolated: Set<LogicalSegmentLogicalKey> | null
}

type StateApplication = {
  record: HandleRecord
  next: LogicalSegmentHandleState
  previous: LogicalSegmentHandleState
}

const KEY_PREFIX = 'iom-logical-segment-v1'

function assertStableIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new LogicalSegmentRegistryError(`${label} must be a non-empty, trimmed string`)
  }
}

function assertGeneration(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new LogicalSegmentRegistryError('layerGeneration must be a non-negative safe integer')
  }
}

function assertSourceId(value: unknown): asserts value is LogicalSegmentSourceId {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new LogicalSegmentRegistryError('Numeric sourceId must be a non-negative safe integer')
    }
    return
  }
  assertStableIdentifier(value, 'String sourceId')
}

function encode(value: string): string {
  return encodeURIComponent(value)
}

function sourceIdPart(sourceId: LogicalSegmentSourceId): string {
  assertSourceId(sourceId)
  return typeof sourceId === 'number' ? `n:${sourceId}` : `s:${encode(sourceId)}`
}

/** Stable logical identity. It intentionally excludes segment, batch, and slot. */
export function createLogicalSegmentLogicalKey(
  identity: LogicalSegmentIdentity,
): LogicalSegmentLogicalKey {
  assertGeneration(identity.layerGeneration)
  assertStableIdentifier(identity.domainId, 'domainId')
  return `${KEY_PREFIX}/g:${identity.layerGeneration}/d:${encode(identity.domainId)}/source:${sourceIdPart(identity.sourceId)}` as LogicalSegmentLogicalKey
}

/** Stable physical segment identity. It intentionally excludes batch and slot. */
export function createLogicalSegmentKey(
  identity: LogicalSegmentIdentity,
  segmentId: string,
): LogicalSegmentKey {
  assertStableIdentifier(segmentId, 'segmentId')
  return `${createLogicalSegmentLogicalKey(identity)}/segment:${encode(segmentId)}` as LogicalSegmentKey
}

/** Stable expected-handle identity within one physical segment. */
export function createLogicalSegmentPhysicalKey(
  identity: LogicalSegmentIdentity,
  segmentId: string,
  handleId: string,
): LogicalSegmentPhysicalKey {
  assertStableIdentifier(handleId, 'handleId')
  return `${createLogicalSegmentKey(identity, segmentId)}/handle:${encode(handleId)}` as LogicalSegmentPhysicalKey
}

function cloneBounds(bounds: LogicalSegmentBounds): LogicalSegmentBounds {
  const values = [...bounds.min, ...bounds.max]
  if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) {
    throw new LogicalSegmentRegistryError('Bounds must contain six finite values')
  }
  if (
    bounds.min[0] > bounds.max[0] ||
    bounds.min[1] > bounds.max[1] ||
    bounds.min[2] > bounds.max[2]
  ) {
    throw new LogicalSegmentRegistryError('Bounds min must not exceed max')
  }
  return Object.freeze({
    min: Object.freeze([bounds.min[0], bounds.min[1], bounds.min[2]]) as readonly [number, number, number],
    max: Object.freeze([bounds.max[0], bounds.max[1], bounds.max[2]]) as readonly [number, number, number],
  })
}

function unionBounds(values: Iterable<LogicalSegmentBounds>): LogicalSegmentBounds | null {
  let found = false
  const min: [number, number, number] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const max: [number, number, number] = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  for (const bounds of values) {
    found = true
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], bounds.min[axis])
      max[axis] = Math.max(max[axis], bounds.max[axis])
    }
  }
  return found ? cloneBounds({ min, max }) : null
}

function clonePlacement(placement: LogicalSegmentPlacement): LogicalSegmentPlacement {
  assertStableIdentifier(placement.batchId, 'batchId')
  if (!Number.isSafeInteger(placement.slot) || placement.slot < 0) {
    throw new LogicalSegmentRegistryError('Placement slot must be a non-negative safe integer')
  }
  return Object.freeze({ batchId: placement.batchId, slot: placement.slot })
}

function placementKey(placement: LogicalSegmentPlacement): string {
  return `${encode(placement.batchId)}#${placement.slot}`
}

function samePlacement(left: LogicalSegmentPlacement, right: LogicalSegmentPlacement): boolean {
  return left.batchId === right.batchId && left.slot === right.slot
}

function sameSet<T>(left: Set<T>, right: Set<T>): boolean {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

function clonePresentation(model: PresentationModel): PresentationModel {
  return {
    hidden: new Set(model.hidden),
    selected: new Set(model.selected),
    highlighted: new Set(model.highlighted),
    isolated: model.isolated ? new Set(model.isolated) : null,
  }
}

/**
 * Registry for persistent exact geometry split into stable logical sources and
 * physical segments. A logical source is published only when every currently
 * active expected handle is registered. This fail-closed rule prevents a
 * hide/select/isolate operation from touching only part of a visible row.
 */
export class LogicalSegmentIdentityRegistry {
  readonly layerGeneration: number
  readonly domainId: string

  private readonly logicalRecords = new Map<LogicalSegmentLogicalKey, LogicalRecord>()
  private readonly segmentRecords = new Map<LogicalSegmentKey, SegmentRecord>()
  private readonly physicalUnits = new Map<LogicalSegmentPhysicalKey, MutablePhysicalUnit>()
  private readonly handles = new Map<LogicalSegmentPhysicalKey, HandleRecord>()
  private readonly placementOwners = new Map<string, LogicalSegmentPhysicalKey>()
  private readonly transactions = new WeakMap<object, TransactionState>()
  private readonly openTransactions = new Set<TransactionState>()
  private readonly registrations = new WeakMap<object, RegistrationState>()
  private presentation: PresentationModel = {
    hidden: new Set(),
    selected: new Set(),
    highlighted: new Set(),
    isolated: null,
  }
  private nextTransactionId = 1
  private nextRegistrationId = 1
  private currentRevision = 0
  private disposed = false

  constructor(options: LogicalSegmentIdentityRegistryOptions) {
    assertGeneration(options.layerGeneration)
    assertStableIdentifier(options.domainId, 'domainId')
    if (!Array.isArray(options.sources) || options.sources.length === 0) {
      throw new LogicalSegmentRegistryError('Catalog must contain at least one logical source')
    }
    this.layerGeneration = options.layerGeneration
    this.domainId = options.domainId

    for (const source of options.sources) {
      assertSourceId(source.sourceId)
      if (!Array.isArray(source.segments) || source.segments.length === 0) {
        throw new LogicalSegmentRegistryError(`Source ${String(source.sourceId)} has no segments`)
      }
      const identity: LogicalSegmentIdentity = Object.freeze({
        layerGeneration: this.layerGeneration,
        domainId: this.domainId,
        sourceId: source.sourceId,
      })
      const logicalKey = createLogicalSegmentLogicalKey(identity)
      if (this.logicalRecords.has(logicalKey)) {
        throw new LogicalSegmentRegistryError(`Duplicate logical source ${logicalKey}`)
      }

      const segmentKeys: LogicalSegmentKey[] = []
      const physicalKeys: LogicalSegmentPhysicalKey[] = []
      const sourceBounds: LogicalSegmentBounds[] = []
      for (const segment of source.segments) {
        assertStableIdentifier(segment.segmentId, 'segmentId')
        if (!Array.isArray(segment.expectedHandles) || segment.expectedHandles.length === 0) {
          throw new LogicalSegmentRegistryError(`${logicalKey}/${segment.segmentId} has no expected handles`)
        }
        const segmentKey = createLogicalSegmentKey(identity, segment.segmentId)
        if (this.segmentRecords.has(segmentKey)) {
          throw new LogicalSegmentRegistryError(`Duplicate segment ${segmentKey}`)
        }
        const bounds = cloneBounds(segment.bounds)
        const segmentPhysicalKeys: LogicalSegmentPhysicalKey[] = []
        let segmentActivity: LogicalSegmentPhysicalActivity | null = null
        for (const expected of segment.expectedHandles) {
          assertStableIdentifier(expected.handleId, 'handleId')
          const activity = expected.activity ?? 'active'
          if (activity !== 'active' && activity !== 'culled') {
            throw new LogicalSegmentRegistryError(`${segmentKey}/${expected.handleId} has invalid activity`)
          }
          if (segmentActivity !== null && activity !== segmentActivity) {
            throw new PartialLogicalSegmentActivityError([segmentKey])
          }
          segmentActivity = activity
          const physicalKey = createLogicalSegmentPhysicalKey(identity, segment.segmentId, expected.handleId)
          if (this.physicalUnits.has(physicalKey)) {
            throw new LogicalSegmentRegistryError(`Duplicate expected physical handle ${physicalKey}`)
          }
          this.physicalUnits.set(physicalKey, {
            logicalKey,
            segmentKey,
            physicalKey,
            handleId: expected.handleId,
            activity,
          })
          segmentPhysicalKeys.push(physicalKey)
          physicalKeys.push(physicalKey)
        }
        this.segmentRecords.set(segmentKey, {
          logicalKey,
          segmentKey,
          segmentId: segment.segmentId,
          bounds,
          physicalKeys: segmentPhysicalKeys,
        })
        segmentKeys.push(segmentKey)
        sourceBounds.push(bounds)
      }
      const bounds = unionBounds(sourceBounds)
      if (!bounds) throw new LogicalSegmentRegistryError(`${logicalKey} has no valid segment bounds`)
      this.logicalRecords.set(logicalKey, {
        identity,
        logicalKey,
        segmentKeys,
        physicalKeys,
        bounds,
      })
    }
  }

  get revision(): number {
    return this.currentRevision
  }

  getMutationGuard(): LogicalSegmentMutationGuard {
    const guard: LogicalSegmentMutationGuard = Object.freeze({
      layerGeneration: this.layerGeneration,
      revision: this.currentRevision,
    })
    issuedLogicalSegmentMutationGuards.set(guard, this)
    return guard
  }

  getPresentationSnapshot(): LogicalSegmentPresentationReplacement {
    this.assertUsable()
    return Object.freeze({
      hiddenLogicalKeys: Object.freeze([...this.presentation.hidden]),
      selectedLogicalKeys: Object.freeze([...this.presentation.selected]),
      highlightedLogicalKeys: Object.freeze([...this.presentation.highlighted]),
      isolatedLogicalKeys: this.presentation.isolated
        ? Object.freeze([...this.presentation.isolated])
        : null,
    })
  }

  logicalKeyFor(sourceId: LogicalSegmentSourceId): LogicalSegmentLogicalKey {
    const key = createLogicalSegmentLogicalKey({
      layerGeneration: this.layerGeneration,
      domainId: this.domainId,
      sourceId,
    })
    if (!this.logicalRecords.has(key)) throw new LogicalSegmentRegistryError(`Unknown logical source ${key}`)
    return key
  }

  segmentKeyFor(sourceId: LogicalSegmentSourceId, segmentId: string): LogicalSegmentKey {
    const key = createLogicalSegmentKey({
      layerGeneration: this.layerGeneration,
      domainId: this.domainId,
      sourceId,
    }, segmentId)
    if (!this.segmentRecords.has(key)) throw new LogicalSegmentRegistryError(`Unknown segment ${key}`)
    return key
  }

  physicalKeyFor(
    sourceId: LogicalSegmentSourceId,
    segmentId: string,
    handleId: string,
  ): LogicalSegmentPhysicalKey {
    const key = createLogicalSegmentPhysicalKey({
      layerGeneration: this.layerGeneration,
      domainId: this.domainId,
      sourceId,
    }, segmentId, handleId)
    if (!this.physicalUnits.has(key)) throw new LogicalSegmentRegistryError(`Unknown physical unit ${key}`)
    return key
  }

  getLogicalBounds(logicalKey: LogicalSegmentLogicalKey): LogicalSegmentBounds {
    const record = this.logicalRecords.get(logicalKey)
    if (!record) throw new LogicalSegmentRegistryError(`Unknown logical source ${logicalKey}`)
    return cloneBounds(record.bounds)
  }

  getSelectionBounds(
    logicalKeys: LogicalSegmentLogicalKey | Iterable<LogicalSegmentLogicalKey>,
  ): LogicalSegmentBounds | null {
    return this.getActiveVisibleBounds(logicalKeys)
  }

  /**
   * Bounds suitable for selection framing/highlight overlays right now.
   * Hidden, isolated-out, incomplete, and fully culled segments contribute no
   * volume. A segment contributes its authored bound once regardless of how
   * many material handles represent it.
   */
  getActiveVisibleBounds(
    logicalKeys: LogicalSegmentLogicalKey | Iterable<LogicalSegmentLogicalKey>,
  ): LogicalSegmentBounds | null {
    const keys = this.normalizeLogicalKeys(logicalKeys)
    const visibleSegmentBounds: LogicalSegmentBounds[] = []
    for (const logicalKey of keys) {
      if (!this.isLogicalComplete(logicalKey, this.handles)) continue
      if (this.presentation.hidden.has(logicalKey)) continue
      if (this.presentation.isolated && !this.presentation.isolated.has(logicalKey)) continue
      const logical = this.logicalRecords.get(logicalKey)!
      for (const segmentKey of logical.segmentKeys) {
        const segment = this.segmentRecords.get(segmentKey)!
        const hasActiveResidentHandle = segment.physicalKeys.some((physicalKey) =>
          this.physicalUnits.get(physicalKey)!.activity === 'active' && this.handles.has(physicalKey))
        if (hasActiveResidentHandle) visibleSegmentBounds.push(segment.bounds)
      }
    }
    return unionBounds(visibleSegmentBounds)
  }

  getPhysicalUnitState(physicalKey: LogicalSegmentPhysicalKey): LogicalSegmentPhysicalUnitState {
    const unit = this.physicalUnits.get(physicalKey)
    if (!unit) throw new LogicalSegmentRegistryError(`Unknown physical unit ${physicalKey}`)
    const handle = this.handles.get(physicalKey)
    return Object.freeze({
      logicalKey: unit.logicalKey,
      segmentKey: unit.segmentKey,
      physicalKey,
      handleId: unit.handleId,
      activity: unit.activity,
      registered: Boolean(handle),
      placement: handle ? clonePlacement(handle.placement) : null,
    })
  }

  getSnapshot(): LogicalSegmentRegistrySnapshot {
    let activePhysicalUnits = 0
    let completeLogicalSources = 0
    for (const unit of this.physicalUnits.values()) {
      if (unit.activity === 'active') activePhysicalUnits += 1
    }
    for (const key of this.logicalRecords.keys()) {
      if (this.isLogicalComplete(key, this.handles)) completeLogicalSources += 1
    }
    const snapshot: LogicalSegmentRegistrySnapshot = Object.freeze({
      layerGeneration: this.layerGeneration,
      domainId: this.domainId,
      revision: this.currentRevision,
      disposed: this.disposed,
      logicalSources: this.logicalRecords.size,
      segments: this.segmentRecords.size,
      expectedPhysicalUnits: this.physicalUnits.size,
      activePhysicalUnits,
      culledPhysicalUnits: this.physicalUnits.size - activePhysicalUnits,
      registeredHandles: this.handles.size,
      completeLogicalSources,
      incompleteLogicalSources: this.logicalRecords.size - completeLogicalSources,
      hiddenLogicalSources: this.presentation.hidden.size,
      selectedLogicalSources: this.presentation.selected.size,
      highlightedLogicalSources: this.presentation.highlighted.size,
      isolationActive: this.presentation.isolated !== null,
    })
    issuedLogicalSegmentRegistrySnapshots.set(snapshot, this)
    return snapshot
  }

  beginHandleRegistration(
    guard: LogicalSegmentMutationGuard = this.getMutationGuard(),
  ): LogicalSegmentRegistrationTransaction {
    this.assertUsable()
    this.assertGuard(guard)
    const publicValue = Object.freeze({
      transactionId: this.nextTransactionId,
      layerGeneration: this.layerGeneration,
      baseRevision: this.currentRevision,
    })
    this.nextTransactionId += 1
    const state: TransactionState = { publicValue, status: 'open', staged: new Map() }
    this.transactions.set(publicValue, state)
    this.openTransactions.add(state)
    return publicValue
  }

  stageHandle(
    transaction: LogicalSegmentRegistrationTransaction,
    descriptor: LogicalSegmentHandleDescriptor,
  ): void {
    this.assertUsable()
    const state = this.requireOpenTransaction(transaction)
    this.assertTransactionFresh(state)
    const unit = this.physicalUnits.get(descriptor.physicalKey)
    if (!unit) throw new LogicalSegmentRegistryError(`Unknown or stale physical key ${descriptor.physicalKey}`)
    if (!descriptor.handle || typeof descriptor.handle.applyLogicalSegmentState !== 'function') {
      throw new LogicalSegmentRegistryError('Physical handle must implement applyLogicalSegmentState')
    }
    if (this.handles.has(unit.physicalKey) || state.staged.has(unit.physicalKey)) {
      throw new LogicalSegmentRegistryError(`Physical handle ${unit.physicalKey} is already registered or staged`)
    }
    const placement = clonePlacement(descriptor.placement)
    const occupied = this.placementOwners.get(placementKey(placement))
    if (occupied) throw new LogicalSegmentRegistryError(`Placement is already occupied by ${occupied}`)
    for (const staged of state.staged.values()) {
      if (samePlacement(staged.placement, placement)) {
        throw new LogicalSegmentRegistryError(`Placement is already staged by ${staged.unit.physicalKey}`)
      }
    }
    state.staged.set(unit.physicalKey, { unit, handle: descriptor.handle, placement })
  }

  commitHandles(
    transaction: LogicalSegmentRegistrationTransaction,
  ): readonly LogicalSegmentHandleRegistration[] {
    this.assertUsable()
    const state = this.requireOpenTransaction(transaction)
    try {
      this.assertTransactionFresh(state)
    } catch (error) {
      state.status = 'rejected'
      state.staged.clear()
      this.openTransactions.delete(state)
      throw error
    }
    if (state.staged.size === 0) {
      state.status = 'committed'
      this.openTransactions.delete(state)
      return Object.freeze([])
    }

    const combined = new Map(this.handles)
    const stagedRecords: HandleRecord[] = []
    for (const staged of state.staged.values()) {
      if (combined.has(staged.unit.physicalKey)) {
        state.status = 'rejected'
        state.staged.clear()
        this.openTransactions.delete(state)
        throw new LogicalSegmentRegistryError(`Physical handle ${staged.unit.physicalKey} became occupied`)
      }
      const registration = Object.freeze({
        registrationId: this.nextRegistrationId,
        physicalKey: staged.unit.physicalKey,
      })
      this.nextRegistrationId += 1
      const record: HandleRecord = {
        unit: staged.unit,
        handle: staged.handle,
        placement: staged.placement,
        registration,
      }
      stagedRecords.push(record)
      combined.set(staged.unit.physicalKey, record)
    }

    const affected = new Set(stagedRecords.map((record) => record.unit.logicalKey))
    const nextRevision = this.currentRevision + 1
    const applications: StateApplication[] = []
    for (const logicalKey of affected) {
      for (const record of combined.values()) {
        if (record.unit.logicalKey !== logicalKey) continue
        const wasStaged = !this.handles.has(record.unit.physicalKey)
        applications.push({
          record,
          next: this.stateFor(record, combined, this.presentation, nextRevision),
          previous: wasStaged
            ? this.detachedState(record, this.currentRevision)
            : this.stateFor(record, this.handles, this.presentation, this.currentRevision),
        })
      }
    }
    this.applyAtomically(applications)

    for (const record of stagedRecords) {
      this.handles.set(record.unit.physicalKey, record)
      this.placementOwners.set(placementKey(record.placement), record.unit.physicalKey)
      this.registrations.set(record.registration, { record, active: true })
    }
    this.currentRevision = nextRevision
    state.status = 'committed'
    state.staged.clear()
    this.openTransactions.delete(state)
    return Object.freeze(stagedRecords.map((record) => record.registration))
  }

  rollbackHandles(transaction: LogicalSegmentRegistrationTransaction): boolean {
    const state = this.transactions.get(transaction)
    if (!state) throw new LogicalSegmentRegistryError('Registration transaction does not belong to this registry')
    if (state.status !== 'open') return false
    state.status = 'rolled-back'
    state.staged.clear()
    this.openTransactions.delete(state)
    return true
  }

  registerHandle(
    descriptor: LogicalSegmentHandleDescriptor,
    guard: LogicalSegmentMutationGuard = this.getMutationGuard(),
  ): LogicalSegmentHandleRegistration {
    const transaction = this.beginHandleRegistration(guard)
    try {
      this.stageHandle(transaction, descriptor)
      const registrations = this.commitHandles(transaction)
      return registrations[0]
    } catch (error) {
      this.rollbackHandles(transaction)
      throw error
    }
  }

  unregisterHandle(
    registration: LogicalSegmentHandleRegistration,
    guard: LogicalSegmentMutationGuard = this.getMutationGuard(),
  ): boolean {
    const registrationState = this.registrations.get(registration)
    if (!registrationState) {
      throw new LogicalSegmentRegistryError('Handle registration does not belong to this registry')
    }
    if (!registrationState.active) return false
    this.assertUsable()
    this.assertGuard(guard)

    const record = registrationState.record
    const combined = new Map(this.handles)
    combined.delete(record.unit.physicalKey)
    const nextRevision = this.currentRevision + 1
    const applications: StateApplication[] = []
    for (const current of this.handles.values()) {
      if (current.unit.logicalKey !== record.unit.logicalKey) continue
      applications.push({
        record: current,
        next: current === record
          ? this.detachedState(current, nextRevision)
          : this.stateFor(current, combined, this.presentation, nextRevision),
        previous: this.stateFor(current, this.handles, this.presentation, this.currentRevision),
      })
    }
    this.applyAtomically(applications)
    this.handles.delete(record.unit.physicalKey)
    this.placementOwners.delete(placementKey(record.placement))
    registrationState.active = false
    this.currentRevision = nextRevision
    return true
  }

  remapHandlePlacements(
    remaps: readonly LogicalSegmentPlacementRemap[],
    guard: LogicalSegmentMutationGuard = this.getMutationGuard(),
  ): number {
    this.assertUsable()
    this.assertGuard(guard)
    if (remaps.length === 0) return this.currentRevision

    const changes = new Map<LogicalSegmentPhysicalKey, { record: HandleRecord; placement: LogicalSegmentPlacement }>()
    for (const remap of remaps) {
      const registrationState = this.registrations.get(remap.registration)
      if (!registrationState || !registrationState.active) {
        throw new LogicalSegmentRegistryError('Cannot remap an unknown or inactive registration')
      }
      const record = registrationState.record
      if (changes.has(record.unit.physicalKey)) {
        throw new LogicalSegmentRegistryError(`Duplicate remap for ${record.unit.physicalKey}`)
      }
      changes.set(record.unit.physicalKey, { record, placement: clonePlacement(remap.placement) })
    }

    const occupied = new Map<string, LogicalSegmentPhysicalKey>()
    for (const record of this.handles.values()) {
      if (changes.has(record.unit.physicalKey)) continue
      occupied.set(placementKey(record.placement), record.unit.physicalKey)
    }
    for (const [physicalKey, change] of changes) {
      const key = placementKey(change.placement)
      const owner = occupied.get(key)
      if (owner) throw new LogicalSegmentRegistryError(`Remap placement is already occupied by ${owner}`)
      occupied.set(key, physicalKey)
    }

    const effectiveRecords = new Map(this.handles)
    for (const [physicalKey, change] of changes) {
      effectiveRecords.set(physicalKey, { ...change.record, placement: change.placement })
    }
    const nextRevision = this.currentRevision + 1
    const applications: StateApplication[] = []
    for (const [physicalKey, change] of changes) {
      if (samePlacement(change.record.placement, change.placement)) continue
      const effective = effectiveRecords.get(physicalKey)!
      applications.push({
        record: change.record,
        next: this.stateFor(effective, effectiveRecords, this.presentation, nextRevision),
        previous: this.stateFor(change.record, this.handles, this.presentation, this.currentRevision),
      })
    }
    if (applications.length === 0) return this.currentRevision
    this.applyAtomically(applications)

    for (const change of changes.values()) {
      if (samePlacement(change.record.placement, change.placement)) continue
      change.record.placement = change.placement
    }
    // Rebuild after all records move. Incremental delete/set is incorrect for
    // a valid atomic slot swap: deleting B's old slot after A moved into it
    // would otherwise erase A's new occupancy record.
    this.rebuildPlacementOwners()
    this.currentRevision = nextRevision
    return this.currentRevision
  }

  setPhysicalUnitActivities(
    changes: readonly LogicalSegmentActivityChange[],
    guard: LogicalSegmentMutationGuard = this.getMutationGuard(),
  ): number {
    this.assertUsable()
    this.assertGuard(guard)
    if (changes.length === 0) return this.currentRevision
    const overrides = new Map<LogicalSegmentPhysicalKey, LogicalSegmentPhysicalActivity>()
    const affected = new Set<LogicalSegmentLogicalKey>()
    const affectedSegments = new Set<LogicalSegmentKey>()
    for (const change of changes) {
      const unit = this.physicalUnits.get(change.physicalKey)
      if (!unit) throw new LogicalSegmentRegistryError(`Unknown or stale physical key ${change.physicalKey}`)
      if (change.activity !== 'active' && change.activity !== 'culled') {
        throw new LogicalSegmentRegistryError(`Invalid physical activity for ${change.physicalKey}`)
      }
      if (overrides.has(change.physicalKey)) {
        throw new LogicalSegmentRegistryError(`Duplicate activity change for ${change.physicalKey}`)
      }
      if (unit.activity !== change.activity) {
        overrides.set(change.physicalKey, change.activity)
        affected.add(unit.logicalKey)
        affectedSegments.add(unit.segmentKey)
      }
    }
    if (overrides.size === 0) return this.currentRevision

    const partialSegments: LogicalSegmentKey[] = []
    for (const segmentKey of affectedSegments) {
      const segment = this.segmentRecords.get(segmentKey)!
      const resultingActivities = new Set(segment.physicalKeys.map((physicalKey) =>
        overrides.get(physicalKey) ?? this.physicalUnits.get(physicalKey)!.activity))
      if (resultingActivities.size !== 1) partialSegments.push(segmentKey)
    }
    if (partialSegments.length) throw new PartialLogicalSegmentActivityError(partialSegments)

    const missingActivationLogicalKeys = new Set<LogicalSegmentLogicalKey>()
    for (const [physicalKey, activity] of overrides) {
      if (activity !== 'active' || this.handles.has(physicalKey)) continue
      missingActivationLogicalKeys.add(this.physicalUnits.get(physicalKey)!.logicalKey)
    }
    if (missingActivationLogicalKeys.size) {
      throw new IncompleteLogicalSegmentCohortError([...missingActivationLogicalKeys])
    }

    const nextRevision = this.currentRevision + 1
    const applications: StateApplication[] = []
    for (const record of this.handles.values()) {
      if (!affected.has(record.unit.logicalKey)) continue
      applications.push({
        record,
        next: this.stateFor(record, this.handles, this.presentation, nextRevision, overrides),
        previous: this.stateFor(record, this.handles, this.presentation, this.currentRevision),
      })
    }
    this.applyAtomically(applications)
    for (const [physicalKey, activity] of overrides) this.physicalUnits.get(physicalKey)!.activity = activity
    this.currentRevision = nextRevision
    return this.currentRevision
  }

  applyCompactedPhysicalPlan(
    plan: LogicalSegmentCompactedPhysicalPlan,
    guard: LogicalSegmentMutationGuard = this.getMutationGuard(),
  ): LogicalSegmentCompactedPhysicalPlanResult {
    this.assertUsable()
    this.assertGuard(guard)
    const previousGuard = this.getMutationGuard()
    if (!plan || !Array.isArray(plan.placements) || !Array.isArray(plan.activities) || !plan.presentation) {
      throw new LogicalSegmentRegistryError('A complete compacted physical plan is required')
    }

    const placements = new Map<LogicalSegmentPhysicalKey, {
      record: HandleRecord
      placement: LogicalSegmentPlacement
    }>()
    for (const remap of plan.placements) {
      const registrationState = this.registrations.get(remap.registration)
      if (!registrationState || !registrationState.active) {
        throw new LogicalSegmentRegistryError('Compacted plan contains an unknown or inactive registration')
      }
      const record = registrationState.record
      if (placements.has(record.unit.physicalKey)) {
        throw new LogicalSegmentRegistryError(`Compacted plan duplicates ${record.unit.physicalKey}`)
      }
      placements.set(record.unit.physicalKey, { record, placement: clonePlacement(remap.placement) })
    }
    if (placements.size !== this.handles.size) {
      throw new LogicalSegmentRegistryError(
        `Compacted plan placements must cover all ${this.handles.size} registered handles`,
      )
    }
    for (const physicalKey of this.handles.keys()) {
      if (!placements.has(physicalKey)) {
        throw new LogicalSegmentRegistryError(`Compacted plan omits registered handle ${physicalKey}`)
      }
    }
    const occupied = new Map<string, LogicalSegmentPhysicalKey>()
    for (const [physicalKey, entry] of placements) {
      const key = placementKey(entry.placement)
      const owner = occupied.get(key)
      if (owner) throw new LogicalSegmentRegistryError(`Compacted plan placement is already occupied by ${owner}`)
      occupied.set(key, physicalKey)
    }

    const activities = new Map<LogicalSegmentPhysicalKey, LogicalSegmentPhysicalActivity>()
    for (const change of plan.activities) {
      const unit = this.physicalUnits.get(change.physicalKey)
      if (!unit) throw new LogicalSegmentRegistryError(`Unknown or stale physical key ${change.physicalKey}`)
      if (change.activity !== 'active' && change.activity !== 'culled') {
        throw new LogicalSegmentRegistryError(`Invalid physical activity for ${change.physicalKey}`)
      }
      if (activities.has(change.physicalKey)) {
        throw new LogicalSegmentRegistryError(`Compacted plan duplicates activity for ${change.physicalKey}`)
      }
      activities.set(change.physicalKey, change.activity)
    }
    if (activities.size !== this.physicalUnits.size) {
      throw new LogicalSegmentRegistryError(
        `Compacted plan activities must cover all ${this.physicalUnits.size} expected physical units`,
      )
    }

    const partialSegments: LogicalSegmentKey[] = []
    for (const segment of this.segmentRecords.values()) {
      const resulting = new Set(segment.physicalKeys.map((physicalKey) => activities.get(physicalKey)!))
      if (resulting.size !== 1) partialSegments.push(segment.segmentKey)
    }
    if (partialSegments.length) throw new PartialLogicalSegmentActivityError(partialSegments)
    const missingActive = new Set<LogicalSegmentLogicalKey>()
    for (const [physicalKey, activity] of activities) {
      if (activity === 'active' && !this.handles.has(physicalKey)) {
        missingActive.add(this.physicalUnits.get(physicalKey)!.logicalKey)
      }
    }
    if (missingActive.size) throw new IncompleteLogicalSegmentCohortError([...missingActive])

    const nextPresentation: PresentationModel = {
      hidden: new Set(this.normalizeLogicalKeys(plan.presentation.hiddenLogicalKeys)),
      selected: new Set(this.normalizeLogicalKeys(plan.presentation.selectedLogicalKeys)),
      highlighted: new Set(this.normalizeLogicalKeys(plan.presentation.highlightedLogicalKeys)),
      isolated: plan.presentation.isolatedLogicalKeys === null
        ? null
        : new Set(this.normalizeLogicalKeys(plan.presentation.isolatedLogicalKeys)),
    }
    const presentationEqual =
      sameSet(this.presentation.hidden, nextPresentation.hidden) &&
      sameSet(this.presentation.selected, nextPresentation.selected) &&
      sameSet(this.presentation.highlighted, nextPresentation.highlighted) &&
      ((this.presentation.isolated === null && nextPresentation.isolated === null) ||
        (this.presentation.isolated !== null && nextPresentation.isolated !== null &&
          sameSet(this.presentation.isolated, nextPresentation.isolated)))
    const placementChanged = [...placements.values()].some(
      (entry) => !samePlacement(entry.record.placement, entry.placement),
    )
    const activityChanged = [...activities].some(
      ([physicalKey, activity]) => this.physicalUnits.get(physicalKey)!.activity !== activity,
    )
    if (!placementChanged && !activityChanged && presentationEqual) {
      return Object.freeze({ changed: false, previousGuard, guard: previousGuard })
    }

    const effectiveRecords = new Map<LogicalSegmentPhysicalKey, HandleRecord>()
    for (const [physicalKey, entry] of placements) {
      effectiveRecords.set(physicalKey, { ...entry.record, placement: entry.placement })
    }
    const nextRevision = this.currentRevision + 1
    const applications: StateApplication[] = []
    for (const [physicalKey, entry] of placements) {
      const effective = effectiveRecords.get(physicalKey)!
      applications.push({
        record: entry.record,
        next: this.stateFor(effective, effectiveRecords, nextPresentation, nextRevision, activities),
        previous: this.stateFor(entry.record, this.handles, this.presentation, this.currentRevision),
      })
    }
    this.applyAtomically(applications)

    for (const [physicalKey, entry] of placements) {
      entry.record.placement = entry.placement
      this.physicalUnits.get(physicalKey)!.activity = activities.get(physicalKey)!
    }
    this.presentation = nextPresentation
    this.rebuildPlacementOwners()
    this.currentRevision = nextRevision
    return Object.freeze({ changed: true, previousGuard, guard: this.getMutationGuard() })
  }

  select(
    logicalKeys: LogicalSegmentLogicalKey | Iterable<LogicalSegmentLogicalKey>,
    guard: LogicalSegmentMutationGuard = this.getMutationGuard(),
  ): LogicalSegmentBounds | null {
    const keys = this.normalizeLogicalKeys(logicalKeys)
    const next = clonePresentation(this.presentation)
    next.selected = new Set(keys)
    this.commitPresentation(next, guard)
    return this.getActiveVisibleBounds(keys)
  }

  clearSelection(guard: LogicalSegmentMutationGuard = this.getMutationGuard()): number {
    const next = clonePresentation(this.presentation)
    next.selected.clear()
    return this.commitPresentation(next, guard)
  }

  highlight(
    logicalKeys: LogicalSegmentLogicalKey | Iterable<LogicalSegmentLogicalKey>,
    guard: LogicalSegmentMutationGuard = this.getMutationGuard(),
  ): LogicalSegmentBounds | null {
    const keys = this.normalizeLogicalKeys(logicalKeys)
    const next = clonePresentation(this.presentation)
    next.highlighted = new Set(keys)
    this.commitPresentation(next, guard)
    return this.getActiveVisibleBounds(keys)
  }

  clearHighlight(guard: LogicalSegmentMutationGuard = this.getMutationGuard()): number {
    const next = clonePresentation(this.presentation)
    next.highlighted.clear()
    return this.commitPresentation(next, guard)
  }

  hide(
    logicalKeys: LogicalSegmentLogicalKey | Iterable<LogicalSegmentLogicalKey>,
    guard: LogicalSegmentMutationGuard = this.getMutationGuard(),
  ): number {
    const keys = this.normalizeLogicalKeys(logicalKeys)
    const next = clonePresentation(this.presentation)
    for (const key of keys) next.hidden.add(key)
    return this.commitPresentation(next, guard)
  }

  show(
    logicalKeys: LogicalSegmentLogicalKey | Iterable<LogicalSegmentLogicalKey>,
    guard: LogicalSegmentMutationGuard = this.getMutationGuard(),
  ): number {
    const keys = this.normalizeLogicalKeys(logicalKeys)
    const next = clonePresentation(this.presentation)
    for (const key of keys) next.hidden.delete(key)
    return this.commitPresentation(next, guard)
  }

  isolate(
    logicalKeys: LogicalSegmentLogicalKey | Iterable<LogicalSegmentLogicalKey>,
    guard: LogicalSegmentMutationGuard = this.getMutationGuard(),
  ): number {
    const keys = this.normalizeLogicalKeys(logicalKeys)
    const next = clonePresentation(this.presentation)
    next.isolated = new Set(keys)
    return this.commitPresentation(next, guard)
  }

  /** Restores visibility; selection and hover/highlight state remain intact. */
  restore(guard: LogicalSegmentMutationGuard = this.getMutationGuard()): number {
    const next = clonePresentation(this.presentation)
    next.hidden.clear()
    next.isolated = null
    return this.commitPresentation(next, guard)
  }

  dispose(): void {
    if (this.disposed) return
    const errors: unknown[] = []
    const nextRevision = this.currentRevision + 1
    for (const record of [...this.handles.values()].sort((left, right) =>
      left.unit.physicalKey.localeCompare(right.unit.physicalKey))) {
      try {
        record.handle.applyLogicalSegmentState(this.detachedState(record, nextRevision))
      } catch (error) {
        errors.push(error)
      }
      const registrationState = this.registrations.get(record.registration)
      if (registrationState) registrationState.active = false
    }
    for (const transaction of this.openTransactions) {
      transaction.status = 'rolled-back'
      transaction.staged.clear()
    }
    this.openTransactions.clear()
    this.handles.clear()
    this.placementOwners.clear()
    this.presentation.hidden.clear()
    this.presentation.selected.clear()
    this.presentation.highlighted.clear()
    this.presentation.isolated = null
    this.currentRevision = nextRevision
    this.disposed = true
    if (errors.length) throw new AggregateError(errors, 'One or more physical handles failed during registry disposal')
  }

  private assertUsable(): void {
    if (this.disposed) throw new LogicalSegmentRegistryError('Logical segment identity registry was disposed')
  }

  private assertGuard(guard: LogicalSegmentMutationGuard): void {
    if (guard.layerGeneration !== this.layerGeneration) {
      throw new StaleLogicalSegmentGenerationError(this.layerGeneration, guard.layerGeneration)
    }
    if (guard.revision !== this.currentRevision) {
      throw new StaleLogicalSegmentRevisionError(this.currentRevision, guard.revision)
    }
  }

  private requireOpenTransaction(
    transaction: LogicalSegmentRegistrationTransaction,
  ): TransactionState {
    const state = this.transactions.get(transaction)
    if (!state) throw new LogicalSegmentRegistryError('Registration transaction does not belong to this registry')
    if (state.status !== 'open') {
      throw new LogicalSegmentRegistryError(`Registration transaction is already ${state.status}`)
    }
    return state
  }

  private assertTransactionFresh(state: TransactionState): void {
    if (state.publicValue.layerGeneration !== this.layerGeneration) {
      throw new StaleLogicalSegmentGenerationError(this.layerGeneration, state.publicValue.layerGeneration)
    }
    if (state.publicValue.baseRevision !== this.currentRevision) {
      throw new StaleLogicalSegmentRevisionError(this.currentRevision, state.publicValue.baseRevision)
    }
  }

  private normalizeLogicalKeys(
    values: LogicalSegmentLogicalKey | Iterable<LogicalSegmentLogicalKey>,
  ): LogicalSegmentLogicalKey[] {
    const input = typeof values === 'string' ? [values] : [...values]
    const result: LogicalSegmentLogicalKey[] = []
    const seen = new Set<LogicalSegmentLogicalKey>()
    for (const key of input) {
      if (!this.logicalRecords.has(key)) throw new LogicalSegmentRegistryError(`Unknown or stale logical key ${key}`)
      if (!seen.has(key)) {
        seen.add(key)
        result.push(key)
      }
    }
    return result
  }

  private isLogicalComplete(
    logicalKey: LogicalSegmentLogicalKey,
    records: ReadonlyMap<LogicalSegmentPhysicalKey, HandleRecord>,
    activityOverrides?: ReadonlyMap<LogicalSegmentPhysicalKey, LogicalSegmentPhysicalActivity>,
  ): boolean {
    const logical = this.logicalRecords.get(logicalKey)
    if (!logical) return false
    for (const physicalKey of logical.physicalKeys) {
      const unit = this.physicalUnits.get(physicalKey)!
      const activity = activityOverrides?.get(physicalKey) ?? unit.activity
      if (activity === 'active' && !records.has(physicalKey)) return false
    }
    return true
  }

  private stateFor(
    record: HandleRecord,
    records: ReadonlyMap<LogicalSegmentPhysicalKey, HandleRecord>,
    presentation: PresentationModel,
    revision: number,
    activityOverrides?: ReadonlyMap<LogicalSegmentPhysicalKey, LogicalSegmentPhysicalActivity>,
  ): LogicalSegmentHandleState {
    const activity = activityOverrides?.get(record.unit.physicalKey) ?? record.unit.activity
    const cohortComplete = this.isLogicalComplete(record.unit.logicalKey, records, activityOverrides)
    const hidden = presentation.hidden.has(record.unit.logicalKey)
    const isolationActive = presentation.isolated !== null
    const isolated = presentation.isolated?.has(record.unit.logicalKey) ?? false
    const selected = presentation.selected.has(record.unit.logicalKey)
    const requestedHighlight = selected || presentation.highlighted.has(record.unit.logicalKey)
    const visible = activity === 'active' && cohortComplete && !hidden && (!isolationActive || isolated)
    return Object.freeze({
      layerGeneration: this.layerGeneration,
      registryRevision: revision,
      logicalKey: record.unit.logicalKey,
      segmentKey: record.unit.segmentKey,
      physicalKey: record.unit.physicalKey,
      placement: clonePlacement(record.placement),
      activity,
      cohortComplete,
      visible,
      hidden,
      isolationActive,
      isolated,
      selected,
      highlighted: visible && requestedHighlight,
    })
  }

  private detachedState(record: HandleRecord, revision: number): LogicalSegmentHandleState {
    return Object.freeze({
      layerGeneration: this.layerGeneration,
      registryRevision: revision,
      logicalKey: record.unit.logicalKey,
      segmentKey: record.unit.segmentKey,
      physicalKey: record.unit.physicalKey,
      placement: clonePlacement(record.placement),
      activity: 'culled',
      cohortComplete: false,
      visible: false,
      hidden: true,
      isolationActive: false,
      isolated: false,
      selected: false,
      highlighted: false,
    })
  }

  private applyAtomically(applications: readonly StateApplication[]): void {
    const ordered = [...applications].sort((left, right) =>
      left.record.unit.physicalKey.localeCompare(right.record.unit.physicalKey))
    const applied: StateApplication[] = []
    try {
      for (const application of ordered) {
        applied.push(application)
        // Include the current adapter in rollback even if it throws after a
        // partial write. Adapters are required to accept an authoritative full
        // state, so re-applying `previous` is the strongest fail-closed repair.
        application.record.handle.applyLogicalSegmentState(application.next)
      }
    } catch (error) {
      const rollbackErrors: unknown[] = []
      for (const application of applied.reverse()) {
        try {
          application.record.handle.applyLogicalSegmentState(application.previous)
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError)
        }
      }
      if (rollbackErrors.length) {
        throw new AggregateError([error, ...rollbackErrors], 'Logical segment state application and rollback failed')
      }
      throw error
    }
  }

  private rebuildPlacementOwners(): void {
    this.placementOwners.clear()
    for (const record of this.handles.values()) {
      const key = placementKey(record.placement)
      if (this.placementOwners.has(key)) {
        throw new LogicalSegmentRegistryError(`Internal placement collision at ${key}`)
      }
      this.placementOwners.set(key, record.unit.physicalKey)
    }
  }

  private commitPresentation(
    next: PresentationModel,
    guard: LogicalSegmentMutationGuard,
  ): number {
    this.assertUsable()
    this.assertGuard(guard)
    const isolationEqual =
      (this.presentation.isolated === null && next.isolated === null) ||
      (this.presentation.isolated !== null && next.isolated !== null &&
        sameSet(this.presentation.isolated, next.isolated))
    if (
      sameSet(this.presentation.hidden, next.hidden) &&
      sameSet(this.presentation.selected, next.selected) &&
      sameSet(this.presentation.highlighted, next.highlighted) &&
      isolationEqual
    ) {
      return this.currentRevision
    }

    const affected: LogicalSegmentLogicalKey[] = []
    for (const logicalKey of this.logicalRecords.keys()) {
      const currentFlags = this.presentationFlags(logicalKey, this.presentation)
      const nextFlags = this.presentationFlags(logicalKey, next)
      if (currentFlags !== nextFlags) affected.push(logicalKey)
    }
    const incomplete = affected.filter((key) => !this.isLogicalComplete(key, this.handles))
    if (incomplete.length) throw new IncompleteLogicalSegmentCohortError(incomplete)

    const nextRevision = this.currentRevision + 1
    const affectedSet = new Set(affected)
    const applications: StateApplication[] = []
    for (const record of this.handles.values()) {
      if (!affectedSet.has(record.unit.logicalKey)) continue
      applications.push({
        record,
        next: this.stateFor(record, this.handles, next, nextRevision),
        previous: this.stateFor(record, this.handles, this.presentation, this.currentRevision),
      })
    }
    this.applyAtomically(applications)
    this.presentation = next
    this.currentRevision = nextRevision
    return this.currentRevision
  }

  private presentationFlags(logicalKey: LogicalSegmentLogicalKey, model: PresentationModel): string {
    return [
      model.hidden.has(logicalKey) ? '1' : '0',
      model.selected.has(logicalKey) ? '1' : '0',
      model.highlighted.has(logicalKey) ? '1' : '0',
      model.isolated === null ? '-' : model.isolated.has(logicalKey) ? '1' : '0',
    ].join('')
  }
}
