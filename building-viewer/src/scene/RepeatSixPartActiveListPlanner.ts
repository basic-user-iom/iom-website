/**
 * Pure, dormant OFFLINE active-list planning kernel for the manifest-v4
 * six-part repeat-row catalog. It deliberately owns no Three.js objects and
 * performs no I/O. Raw/disabled manifests are accepted only by the explicitly
 * named offline kernel exported below.
 *
 * A successful focus update is a complete replacement plan for all 48
 * parity x segment x material InstancedMesh templates. The planner publishes
 * the replacement only after catalog, matrix, bounds, and budget checks pass.
 */

export type RepeatSixPartParity = 'positive' | 'mirrored'
export type RepeatSixPartActivity = 'active' | 'culled'

export type RepeatSixPartVec3 = readonly [number, number, number]
export type RepeatSixPartMatrix = readonly number[]

export type RepeatSixPartBounds = Readonly<{
  space: 'owner-local' | 'source-row-local' | 'parity-host-local'
  min: RepeatSixPartVec3
  max: RepeatSixPartVec3
}>

export type RepeatSixPartSegmentCatalogEntry = Readonly<{
  index: number
  id: string
  triangles: number
  materialPrimitiveCount: number
  bounds: RepeatSixPartBounds
}>

export type RepeatSixPartSourceCatalogEntry = Readonly<{
  index: number
  id: string
  path: string
  parity: RepeatSixPartParity
  canonicalMatrix: Readonly<{ space: 'owner-local'; matrix: RepeatSixPartMatrix }>
  renderLocalMatrix: Readonly<{ space: 'parity-host-local'; matrix: RepeatSixPartMatrix }>
  bounds: RepeatSixPartBounds
}>

export type RepeatSixPartUnitCatalogEntry = Readonly<{
  index: number
  id: string
  sourceIndex: number
  sourceId: string
  segmentIndex: number
  segmentId: string
  bounds: RepeatSixPartBounds
  triangles: number
}>

export type RepeatSixPartActiveListManifestInput = Readonly<{
  geometry: Readonly<{
    materialSlots: number
    segments: readonly RepeatSixPartSegmentCatalogEntry[]
  }>
  parity: Readonly<{
    epsilon: number
    hosts: Readonly<{
      positive: Readonly<{ space: 'owner-local'; matrix: RepeatSixPartMatrix }>
      mirrored: Readonly<{ space: 'owner-local'; matrix: RepeatSixPartMatrix }>
    }>
    materialDrawsPerActiveGroup: number
    possibleGroupCount: number
    persistentRendererTemplates: number
  }>
  selector: Readonly<{
    boundsSpace: 'owner-local'
    boundsType: 'closed-aabb'
    distanceMetric: 'linf-point-to-closed-aabb'
    enterMarginMeters: number
    exitMarginMeters: number
    states: readonly RepeatSixPartActivity[]
    defaultState: 'culled'
  }>
  catalog: Readonly<{
    order: 'source-major-segment-major'
    defaultState: 'culled'
    sources: readonly RepeatSixPartSourceCatalogEntry[]
    units: readonly RepeatSixPartUnitCatalogEntry[]
  }>
  budgets: Readonly<{
    repeatFamilyResidentTriangles: number
    repeatFamilyTransitionTriangles: number
    totalResidentTriangles: number
    totalTransitionTriangles: number
    allOtherOwnerReservationTriangles: number
    maxActiveDraws: number
    maxPersistentRendererTemplates: number
  }>
}>

export type RepeatSixPartOfflineActiveListKernelOptions = Readonly<{
  generation: number
  manifest: RepeatSixPartActiveListManifestInput
}>

export type RepeatSixPartRegistryMutationGuard = Readonly<{
  layerGeneration: number
  revision: number
}>

export type RepeatSixPartFocusUpdate = Readonly<{
  generation: number
  revision: number
  rendererRevision: number
  registryMutationGuard: RepeatSixPartRegistryMutationGuard
  focus: Readonly<{
    space: 'owner-local'
    point: RepeatSixPartVec3
  }>
}>

export type RepeatSixPartActiveListParticipant = 'renderer' | 'registry'

export type RepeatSixPartActiveListPreparationToken = Readonly<{
  kind: 'repeat-six-part-active-list-preparation'
  generation: number
  layerGeneration: number
  baseRevision: number
  revision: number
  sequence: number
  rendererBaseRevision: number
  registryBaseMutationGuard: RepeatSixPartRegistryMutationGuard
}>

export type RepeatSixPartSlotToUnit = Readonly<{
  slot: number
  unitKey: string
  unitIndex: number
  sourceIndex: number
  sourceId: string
  activity: RepeatSixPartActivity
}>

export type RepeatSixPartInstancedMeshList = Readonly<{
  key: string
  parity: RepeatSixPartParity
  segmentIndex: number
  segmentId: string
  materialIndex: number
  capacity: number
  activeCount: number
  present: boolean
  visible: boolean
  unitKeys: readonly string[]
  matrices: readonly RepeatSixPartMatrix[]
  slotToUnit: readonly RepeatSixPartSlotToUnit[]
  completeSlotPermutation: readonly RepeatSixPartSlotToUnit[]
  completeSlotMatrices: readonly RepeatSixPartMatrix[]
  ownerLocalBounds: RepeatSixPartBounds | null
  renderLocalBounds: RepeatSixPartBounds | null
  submittedDraws: 0 | 1
  instanceMatrixUpdateRequired: true
  boundsRecomputeRequired: true
}>

export type RepeatSixPartParitySegmentGroup = Readonly<{
  key: string
  parity: RepeatSixPartParity
  segmentIndex: number
  segmentId: string
  activeCount: number
  unitKeys: readonly string[]
  matrices: readonly RepeatSixPartMatrix[]
  slotToUnit: readonly RepeatSixPartSlotToUnit[]
  completeSlotPermutation: readonly RepeatSixPartSlotToUnit[]
  completeSlotMatrices: readonly RepeatSixPartMatrix[]
  ownerLocalBounds: RepeatSixPartBounds | null
  renderLocalBounds: RepeatSixPartBounds | null
  submittedTriangles: number
  submittedDraws: number
  materialLists: readonly RepeatSixPartInstancedMeshList[]
}>

export type RepeatSixPartUnitState = Readonly<{
  unitKey: string
  activity: RepeatSixPartActivity
}>

export type RepeatSixPartActiveListMetrics = Readonly<{
  activeUnits: number
  culledUnits: number
  activeParitySegmentGroups: number
  activeLists: number
  hiddenLists: number
  submittedTriangles: number
  submittedDraws: number
  allOwnerResidentTriangles: number
  previousSubmittedTriangles: number
  synchronousPublishPeakTriangles: number
  totalSynchronousPublishPeakTriangles: number
  initialSourceOwnershipRewrite: Readonly<{
    provenByThisKernel: false
    schedule: null
    note: 'offline-build-responsibility'
  }>
  repeatTriangleBudget: number
  totalTriangleBudget: number
  repeatTransitionTriangleBudget: number
  totalTransitionTriangleBudget: number
  drawBudget: number
}>

export type RepeatSixPartActiveListCommit = Readonly<{
  generation: number
  baseRevision: number
  revision: number
  focus: Readonly<{
    space: 'owner-local'
    point: RepeatSixPartVec3
  }>
  enterMarginMeters: number
  exitMarginMeters: number
  unitStates: readonly RepeatSixPartUnitState[]
  activeUnitKeys: readonly string[]
  activatedUnitKeys: readonly string[]
  retainedActiveUnitKeys: readonly string[]
  culledUnitKeys: readonly string[]
  groups: readonly RepeatSixPartParitySegmentGroup[]
  lists: readonly RepeatSixPartInstancedMeshList[]
  activeLists: readonly RepeatSixPartInstancedMeshList[]
  dirtyListKeys: readonly string[]
  metrics: RepeatSixPartActiveListMetrics
  atomicReplacement: true
  boundsRecomputeRequired: true
}>

// A structural look-alike is not proof that a commit was produced by the
// validated planner state machine. Keep issuance private to this module while
// exposing only a read-only predicate to downstream transaction boundaries.
const issuedRepeatSixPartActiveListCommits = new WeakSet<object>()

export function isIssuedRepeatSixPartActiveListCommit(
  value: unknown,
): value is RepeatSixPartActiveListCommit {
  return value !== null && typeof value === 'object' && issuedRepeatSixPartActiveListCommits.has(value)
}

export type RepeatSixPartActiveListPreparation = Readonly<{
  kind: 'prepared'
  token: RepeatSixPartActiveListPreparationToken
  replacement: RepeatSixPartActiveListCommit
  rollbackTarget: RepeatSixPartActiveListCommit
  requiredAcknowledgements: readonly RepeatSixPartActiveListParticipant[]
}>

export type RepeatSixPartActiveListNoop = Readonly<{
  kind: 'no-op'
  generation: number
  revision: number
  focus: RepeatSixPartFocusUpdate['focus']
  activeUnitKeys: readonly string[]
  dirtyListKeys: readonly []
}>

export type RepeatSixPartActiveListPlanResult =
  | RepeatSixPartActiveListPreparation
  | RepeatSixPartActiveListNoop

export type RepeatSixPartParticipantApplyReceipt = Readonly<{
  kind: 'repeat-six-part-participant-apply-receipt'
  token: RepeatSixPartActiveListPreparationToken
  participant: RepeatSixPartActiveListParticipant
  layerGeneration: number
  rendererBaseRevision: number
  rendererAppliedRevision: number
  registryBaseMutationGuard: RepeatSixPartRegistryMutationGuard
  registryAppliedMutationGuard: RepeatSixPartRegistryMutationGuard
}>

export type RepeatSixPartParticipantRollbackReceipt = Readonly<{
  kind: 'repeat-six-part-participant-rollback-receipt'
  token: RepeatSixPartActiveListPreparationToken
  participant: RepeatSixPartActiveListParticipant
  layerGeneration: number
  rendererRestoredRevision: number
  registryRestoredMutationGuard: RepeatSixPartRegistryMutationGuard
}>

export type RepeatSixPartActiveListAcknowledgement = Readonly<{
  token: RepeatSixPartActiveListPreparationToken
  participant: RepeatSixPartActiveListParticipant
  acknowledgedParticipants: readonly RepeatSixPartActiveListParticipant[]
  committed: boolean
  commit: RepeatSixPartActiveListCommit | null
}>

export type RepeatSixPartActiveListCancellation = Readonly<{
  token: RepeatSixPartActiveListPreparationToken
  phase: 'cancelled' | 'rolling-back'
  appliedParticipants: readonly RepeatSixPartActiveListParticipant[]
  rollbackPendingParticipants: readonly RepeatSixPartActiveListParticipant[]
  rollbackTarget: RepeatSixPartActiveListCommit
  replacement: RepeatSixPartActiveListCommit
}>

export type RepeatSixPartActiveListRollbackAcknowledgement = Readonly<{
  token: RepeatSixPartActiveListPreparationToken
  participant: RepeatSixPartActiveListParticipant
  rollbackPendingParticipants: readonly RepeatSixPartActiveListParticipant[]
  rollbackComplete: boolean
}>

export type RepeatSixPartActiveListSnapshot = Readonly<{
  generation: number
  revision: number
  activeUnitKeys: readonly string[]
  disposed: boolean
  transactionPhase: 'idle' | 'prepared' | 'rolling-back'
}>

export const REPEAT_SIX_PART_ACTIVE_LIST_COUNTS = Object.freeze({
  sources: 78,
  segments: 6,
  units: 468,
  materialSlots: 4,
  parities: 2,
  paritySegmentGroups: 12,
  instancedMeshLists: 48,
})

const PARITIES = Object.freeze<readonly RepeatSixPartParity[]>(['positive', 'mirrored'])
const MATRIX_COMPONENTS = 16
const BOUNDS_TOLERANCE = 1e-7

export class RepeatSixPartActiveListPlannerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RepeatSixPartActiveListPlannerError'
  }
}

export class RepeatSixPartActiveListCatalogError extends RepeatSixPartActiveListPlannerError {
  constructor(message: string) {
    super(message)
    this.name = 'RepeatSixPartActiveListCatalogError'
  }
}

export class StaleRepeatSixPartActiveListGenerationError extends RepeatSixPartActiveListPlannerError {
  constructor(expected: number, observed: number) {
    super(`Stale six-part planner generation ${observed}; current generation is ${expected}`)
    this.name = 'StaleRepeatSixPartActiveListGenerationError'
  }
}

export class StaleRepeatSixPartActiveListRevisionError extends RepeatSixPartActiveListPlannerError {
  constructor(expected: number, observed: number) {
    super(`Stale six-part planner revision ${observed}; current revision is ${expected}`)
    this.name = 'StaleRepeatSixPartActiveListRevisionError'
  }
}

export class RepeatSixPartActiveListBudgetError extends RepeatSixPartActiveListPlannerError {
  readonly submittedTriangles: number
  readonly submittedDraws: number
  readonly synchronousPublishPeakTriangles: number
  readonly totalSynchronousPublishPeakTriangles: number

  constructor(
    message: string,
    submittedTriangles: number,
    submittedDraws: number,
    synchronousPublishPeakTriangles: number,
    totalSynchronousPublishPeakTriangles: number,
  ) {
    super(message)
    this.name = 'RepeatSixPartActiveListBudgetError'
    this.submittedTriangles = submittedTriangles
    this.submittedDraws = submittedDraws
    this.synchronousPublishPeakTriangles = synchronousPublishPeakTriangles
    this.totalSynchronousPublishPeakTriangles = totalSynchronousPublishPeakTriangles
  }
}

export class RepeatSixPartActiveListTransactionError extends RepeatSixPartActiveListPlannerError {
  constructor(message: string) {
    super(message)
    this.name = 'RepeatSixPartActiveListTransactionError'
  }
}

export const REPEAT_SIX_PART_RUNTIME_ACTIVATION_BLOCKER =
  'AUTHORITATIVE_PHYSICAL_SEMANTIC_GATE_MISSING' as const

export class RepeatSixPartRuntimeActivationError extends RepeatSixPartActiveListPlannerError {
  readonly blocker = REPEAT_SIX_PART_RUNTIME_ACTIVATION_BLOCKER

  constructor() {
    super(
      'Runtime six-part activation is disabled: authoritative GLB/BIN/ownership semantic verification has not issued a capability',
    )
    this.name = 'RepeatSixPartRuntimeActivationError'
  }
}

declare const RUNTIME_ACTIVATION_CAPABILITY_BRAND: unique symbol
declare const ACTIVATED_RUNTIME_CONTRACT_BRAND: unique symbol

/**
 * Opaque proof capability required by every runtime-facing constructor. There
 * is intentionally no issuer in this module while the authoritative physical
 * semantic gate is missing. A type assertion or object clone cannot pass the
 * runtime WeakSet ownership check.
 */
export type RepeatSixPartRuntimeActivationCapability = Readonly<{
  readonly [RUNTIME_ACTIVATION_CAPABILITY_BRAND]: true
}>

export type RepeatSixPartActivatedRuntimeContract = Readonly<{
  readonly [ACTIVATED_RUNTIME_CONTRACT_BRAND]: true
}>

export type RepeatSixPartRuntimeActiveListControllerOptions = Readonly<{
  generation: number
  activatedContract: RepeatSixPartActivatedRuntimeContract
}>

export type RepeatSixPartRuntimeActiveListController = Readonly<{
  kind: 'repeat-six-part-runtime-active-list-controller'
}>

const ISSUED_RUNTIME_ACTIVATION_CAPABILITIES = new WeakSet<object>()

export function createRepeatSixPartRuntimeActiveListController(
  _options: RepeatSixPartRuntimeActiveListControllerOptions,
  capability: RepeatSixPartRuntimeActivationCapability,
): RepeatSixPartRuntimeActiveListController {
  if (
    capability === null ||
    typeof capability !== 'object' ||
    !ISSUED_RUNTIME_ACTIVATION_CAPABILITIES.has(capability)
  ) {
    throw new RepeatSixPartRuntimeActivationError()
  }
  // This branch is unreachable until a future authoritative verifier owns an
  // internal issuer and this factory is deliberately implemented.
  throw new RepeatSixPartRuntimeActivationError()
}

type InternalSegment = Readonly<{
  index: number
  id: string
  triangles: number
  bounds: RepeatSixPartBounds
}>

type InternalSource = Readonly<{
  index: number
  id: string
  parity: RepeatSixPartParity
  canonicalMatrix: RepeatSixPartMatrix
  renderLocalMatrix: RepeatSixPartMatrix
  bounds: RepeatSixPartBounds
}>

type InternalUnit = Readonly<{
  index: number
  id: string
  sourceIndex: number
  sourceId: string
  segmentIndex: number
  segmentId: string
  bounds: RepeatSixPartBounds
  renderLocalBounds: RepeatSixPartBounds
  triangles: number
}>

type InternalCatalog = Readonly<{
  segments: readonly InternalSegment[]
  sources: readonly InternalSource[]
  units: readonly InternalUnit[]
  groupUnits: ReadonlyMap<string, readonly InternalUnit[]>
  parityCapacity: Readonly<Record<RepeatSixPartParity, number>>
  enterMarginMeters: number
  exitMarginMeters: number
  budgets: RepeatSixPartActiveListManifestInput['budgets']
}>

type PendingPreparation = {
  phase: 'prepared' | 'rolling-back'
  token: RepeatSixPartActiveListPreparationToken
  replacement: RepeatSixPartActiveListCommit
  rollbackTarget: RepeatSixPartActiveListCommit
  nextActive: ReadonlySet<string>
  applyReceipts: Map<RepeatSixPartActiveListParticipant, RepeatSixPartParticipantApplyReceipt>
  rollbackReceipts: Map<RepeatSixPartActiveListParticipant, RepeatSixPartParticipantRollbackReceipt>
}

function catalogError(message: string): never {
  throw new RepeatSixPartActiveListCatalogError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finiteInteger(value: unknown, minimum: number, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    catalogError(`${path} must be a safe integer >= ${minimum}`)
  }
  return value as number
}

function finiteNumber(value: unknown, minimum: number, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    catalogError(`${path} must be finite and >= ${minimum}`)
  }
  return value
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) catalogError(`${path} must be a non-empty string`)
  return value as string
}

function freezeVec3(value: unknown, path: string): RepeatSixPartVec3 {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    catalogError(`${path} must contain exactly three finite numbers`)
  }
  return Object.freeze([value[0], value[1], value[2]]) as RepeatSixPartVec3
}

function freezeMatrix(value: unknown, path: string): RepeatSixPartMatrix {
  if (!Array.isArray(value) || value.length !== MATRIX_COMPONENTS || !value.every(Number.isFinite)) {
    catalogError(`${path} must contain exactly 16 finite numbers`)
  }
  return Object.freeze([...value])
}

function freezeBounds(
  value: unknown,
  expectedSpace: RepeatSixPartBounds['space'],
  path: string,
): RepeatSixPartBounds {
  if (!isRecord(value) || value.space !== expectedSpace) catalogError(`${path}.space must equal ${expectedSpace}`)
  const min = freezeVec3(value.min, `${path}.min`)
  const max = freezeVec3(value.max, `${path}.max`)
  for (let axis = 0; axis < 3; axis += 1) {
    if (max[axis] < min[axis]) catalogError(`${path}.max[${axis}] must be >= min[${axis}]`)
  }
  return Object.freeze({ space: expectedSpace, min, max })
}

function assertAffine(matrix: RepeatSixPartMatrix, epsilon: number, path: string): void {
  if (
    Math.abs(matrix[3]) > epsilon ||
    Math.abs(matrix[7]) > epsilon ||
    Math.abs(matrix[11]) > epsilon ||
    Math.abs(matrix[15] - 1) > epsilon
  ) {
    catalogError(`${path} must be a finite affine matrix`)
  }
}

function determinant3(matrix: RepeatSixPartMatrix): number {
  return (
    matrix[0] * (matrix[5] * matrix[10] - matrix[9] * matrix[6]) -
    matrix[4] * (matrix[1] * matrix[10] - matrix[9] * matrix[2]) +
    matrix[8] * (matrix[1] * matrix[6] - matrix[5] * matrix[2])
  )
}

function multiplyMatrices(left: RepeatSixPartMatrix, right: RepeatSixPartMatrix): RepeatSixPartMatrix {
  const output = new Array<number>(MATRIX_COMPONENTS).fill(0)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let inner = 0; inner < 4; inner += 1) {
        output[column * 4 + row] += left[inner * 4 + row] * right[column * 4 + inner]
      }
    }
  }
  return Object.freeze(output)
}

function near(left: number, right: number, tolerance: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right))
  return Math.abs(left - right) <= tolerance * scale
}

function matricesNear(left: RepeatSixPartMatrix, right: RepeatSixPartMatrix, tolerance: number): boolean {
  return left.every((value, index) => near(value, right[index], tolerance))
}

function boundsNear(left: RepeatSixPartBounds, right: RepeatSixPartBounds): boolean {
  return left.min.every((value, axis) => near(value, right.min[axis], BOUNDS_TOLERANCE)) &&
    left.max.every((value, axis) => near(value, right.max[axis], BOUNDS_TOLERANCE))
}

function transformBounds(
  bounds: RepeatSixPartBounds,
  matrix: RepeatSixPartMatrix,
  space: RepeatSixPartBounds['space'],
): RepeatSixPartBounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
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
  return Object.freeze({
    space,
    min: Object.freeze(min) as RepeatSixPartVec3,
    max: Object.freeze(max) as RepeatSixPartVec3,
  })
}

function unionBounds(
  bounds: readonly RepeatSixPartBounds[],
  space: RepeatSixPartBounds['space'],
): RepeatSixPartBounds | null {
  if (bounds.length === 0) return null
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const entry of bounds) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], entry.min[axis])
      max[axis] = Math.max(max[axis], entry.max[axis])
    }
  }
  return Object.freeze({
    space,
    min: Object.freeze(min) as RepeatSixPartVec3,
    max: Object.freeze(max) as RepeatSixPartVec3,
  })
}

function groupKey(parity: RepeatSixPartParity, segmentIndex: number): string {
  return `${parity}:segment-${String(segmentIndex).padStart(2, '0')}`
}

function listKey(parity: RepeatSixPartParity, segmentIndex: number, materialIndex: number): string {
  return `${groupKey(parity, segmentIndex)}:material-${String(materialIndex).padStart(2, '0')}`
}

function validateCatalog(options: RepeatSixPartOfflineActiveListKernelOptions): InternalCatalog {
  finiteInteger(options?.generation, 0, 'generation')
  const manifest = options?.manifest
  if (!isRecord(manifest)) catalogError('manifest must be an object')

  const geometry = manifest.geometry
  if (!isRecord(geometry)) catalogError('manifest.geometry must be an object')
  if (geometry.materialSlots !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.materialSlots) {
    catalogError('manifest.geometry.materialSlots must equal 4')
  }
  if (!Array.isArray(geometry.segments) || geometry.segments.length !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.segments) {
    catalogError('manifest.geometry.segments must contain exactly 6 segments')
  }

  const parity = manifest.parity
  if (!isRecord(parity)) catalogError('manifest.parity must be an object')
  const epsilon = finiteNumber(parity.epsilon, Number.MIN_VALUE, 'manifest.parity.epsilon')
  if (parity.materialDrawsPerActiveGroup !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.materialSlots) {
    catalogError('manifest.parity.materialDrawsPerActiveGroup must equal 4')
  }
  if (parity.possibleGroupCount !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.paritySegmentGroups) {
    catalogError('manifest.parity.possibleGroupCount must equal 12')
  }
  if (parity.persistentRendererTemplates !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.instancedMeshLists) {
    catalogError('manifest.parity.persistentRendererTemplates must equal 48')
  }
  if (!isRecord(parity.hosts)) catalogError('manifest.parity.hosts must be an object')
  const positiveHostRecord = parity.hosts.positive
  const mirroredHostRecord = parity.hosts.mirrored
  if (!isRecord(positiveHostRecord) || positiveHostRecord.space !== 'owner-local') {
    catalogError('manifest.parity.hosts.positive.space must equal owner-local')
  }
  if (!isRecord(mirroredHostRecord) || mirroredHostRecord.space !== 'owner-local') {
    catalogError('manifest.parity.hosts.mirrored.space must equal owner-local')
  }
  const hosts = {
    positive: freezeMatrix(positiveHostRecord.matrix, 'manifest.parity.hosts.positive.matrix'),
    mirrored: freezeMatrix(mirroredHostRecord.matrix, 'manifest.parity.hosts.mirrored.matrix'),
  }
  assertAffine(hosts.positive, epsilon, 'manifest.parity.hosts.positive.matrix')
  assertAffine(hosts.mirrored, epsilon, 'manifest.parity.hosts.mirrored.matrix')
  if (determinant3(hosts.positive) <= epsilon) catalogError('positive parity host must have a positive determinant')
  if (determinant3(hosts.mirrored) >= -epsilon) catalogError('mirrored parity host must have a negative determinant')

  const selector = manifest.selector
  if (!isRecord(selector)) catalogError('manifest.selector must be an object')
  if (selector.boundsSpace !== 'owner-local') catalogError('manifest.selector.boundsSpace must equal owner-local')
  if (selector.boundsType !== 'closed-aabb') catalogError('manifest.selector.boundsType must equal closed-aabb')
  if (selector.distanceMetric !== 'linf-point-to-closed-aabb') {
    catalogError('manifest.selector.distanceMetric must equal linf-point-to-closed-aabb')
  }
  if (selector.defaultState !== 'culled') catalogError('manifest.selector.defaultState must equal culled')
  if (!Array.isArray(selector.states) || selector.states.length !== 2 || selector.states[0] !== 'active' || selector.states[1] !== 'culled') {
    catalogError('manifest.selector.states must equal [active, culled]')
  }
  const enterMarginMeters = finiteNumber(selector.enterMarginMeters, 0, 'manifest.selector.enterMarginMeters')
  const exitMarginMeters = finiteNumber(selector.exitMarginMeters, 0, 'manifest.selector.exitMarginMeters')
  if (exitMarginMeters < enterMarginMeters) {
    catalogError('manifest.selector.exitMarginMeters must be >= enterMarginMeters')
  }

  const catalog = manifest.catalog
  if (!isRecord(catalog)) catalogError('manifest.catalog must be an object')
  if (catalog.order !== 'source-major-segment-major') catalogError('manifest.catalog.order must equal source-major-segment-major')
  if (catalog.defaultState !== 'culled') catalogError('manifest.catalog.defaultState must equal culled')
  if (!Array.isArray(catalog.sources) || catalog.sources.length !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.sources) {
    catalogError('manifest.catalog.sources must contain exactly 78 sources')
  }
  if (!Array.isArray(catalog.units) || catalog.units.length !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.units) {
    catalogError('manifest.catalog.units must contain exactly 468 units')
  }

  const segmentIds = new Set<string>()
  const segments: InternalSegment[] = geometry.segments.map((raw, index) => {
    if (!isRecord(raw)) catalogError(`manifest.geometry.segments[${index}] must be an object`)
    if (raw.index !== index) catalogError(`manifest.geometry.segments[${index}].index must equal ${index}`)
    const id = nonEmptyString(raw.id, `manifest.geometry.segments[${index}].id`)
    if (segmentIds.has(id)) catalogError(`duplicate segment id ${id}`)
    segmentIds.add(id)
    const triangles = finiteInteger(raw.triangles, 1, `manifest.geometry.segments[${index}].triangles`)
    if (raw.materialPrimitiveCount !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.materialSlots) {
      catalogError(`manifest.geometry.segments[${index}].materialPrimitiveCount must equal 4`)
    }
    const bounds = freezeBounds(raw.bounds, 'source-row-local', `manifest.geometry.segments[${index}].bounds`)
    return Object.freeze({ index, id, triangles, bounds })
  })

  const sourceIds = new Set<string>()
  const sourcePaths = new Set<string>()
  const sources: InternalSource[] = catalog.sources.map((raw, index) => {
    if (!isRecord(raw)) catalogError(`manifest.catalog.sources[${index}] must be an object`)
    if (raw.index !== index) catalogError(`manifest.catalog.sources[${index}].index must equal ${index}`)
    const id = nonEmptyString(raw.id, `manifest.catalog.sources[${index}].id`)
    const path = nonEmptyString(raw.path, `manifest.catalog.sources[${index}].path`)
    if (sourceIds.has(id)) catalogError(`duplicate source id ${id}`)
    if (sourcePaths.has(path)) catalogError(`duplicate source path ${path}`)
    sourceIds.add(id)
    sourcePaths.add(path)
    if (raw.parity !== 'positive' && raw.parity !== 'mirrored') {
      catalogError(`manifest.catalog.sources[${index}].parity must equal positive or mirrored`)
    }
    if (!isRecord(raw.canonicalMatrix) || raw.canonicalMatrix.space !== 'owner-local') {
      catalogError(`manifest.catalog.sources[${index}].canonicalMatrix.space must equal owner-local`)
    }
    if (!isRecord(raw.renderLocalMatrix) || raw.renderLocalMatrix.space !== 'parity-host-local') {
      catalogError(`manifest.catalog.sources[${index}].renderLocalMatrix.space must equal parity-host-local`)
    }
    const canonicalMatrix = freezeMatrix(raw.canonicalMatrix.matrix, `manifest.catalog.sources[${index}].canonicalMatrix.matrix`)
    const renderLocalMatrix = freezeMatrix(raw.renderLocalMatrix.matrix, `manifest.catalog.sources[${index}].renderLocalMatrix.matrix`)
    assertAffine(canonicalMatrix, epsilon, `manifest.catalog.sources[${index}].canonicalMatrix.matrix`)
    assertAffine(renderLocalMatrix, epsilon, `manifest.catalog.sources[${index}].renderLocalMatrix.matrix`)
    const renderDeterminant = determinant3(renderLocalMatrix)
    if (renderDeterminant <= epsilon) {
      catalogError(`manifest.catalog.sources[${index}].renderLocalMatrix.matrix must have a positive determinant`)
    }
    const canonicalDeterminant = determinant3(canonicalMatrix)
    if (raw.parity === 'positive' && canonicalDeterminant <= epsilon) {
      catalogError(`manifest.catalog.sources[${index}].canonicalMatrix.matrix must have positive parity`)
    }
    if (raw.parity === 'mirrored' && canonicalDeterminant >= -epsilon) {
      catalogError(`manifest.catalog.sources[${index}].canonicalMatrix.matrix must have mirrored parity`)
    }
    const recomposed = multiplyMatrices(hosts[raw.parity], renderLocalMatrix)
    if (!matricesNear(recomposed, canonicalMatrix, epsilon)) {
      catalogError(`manifest.catalog.sources[${index}] parity host and render-local matrix do not recompose canonicalMatrix`)
    }
    const bounds = freezeBounds(raw.bounds, 'owner-local', `manifest.catalog.sources[${index}].bounds`)
    return Object.freeze({ index, id, parity: raw.parity, canonicalMatrix, renderLocalMatrix, bounds })
  })

  const unitIds = new Set<string>()
  const tupleIds = new Set<string>()
  const units: InternalUnit[] = catalog.units.map((raw, index) => {
    if (!isRecord(raw)) catalogError(`manifest.catalog.units[${index}] must be an object`)
    const expectedSourceIndex = Math.floor(index / REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.segments)
    const expectedSegmentIndex = index % REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.segments
    if (raw.index !== index) catalogError(`manifest.catalog.units[${index}].index must equal ${index}`)
    if (raw.sourceIndex !== expectedSourceIndex) {
      catalogError(`manifest.catalog.units[${index}].sourceIndex must equal ${expectedSourceIndex}; units must be exhaustive source-major records`)
    }
    if (raw.segmentIndex !== expectedSegmentIndex) {
      catalogError(`manifest.catalog.units[${index}].segmentIndex must equal ${expectedSegmentIndex}; units must be exhaustive segment-major records`)
    }
    const source = sources[expectedSourceIndex]
    const segment = segments[expectedSegmentIndex]
    const id = nonEmptyString(raw.id, `manifest.catalog.units[${index}].id`)
    if (unitIds.has(id)) catalogError(`duplicate unit id ${id}`)
    unitIds.add(id)
    const tupleId = `${expectedSourceIndex}:${expectedSegmentIndex}`
    if (tupleIds.has(tupleId)) catalogError(`duplicate source/segment unit ${tupleId}`)
    tupleIds.add(tupleId)
    if (raw.sourceId !== source.id) catalogError(`manifest.catalog.units[${index}].sourceId does not match its source`)
    if (raw.segmentId !== segment.id) catalogError(`manifest.catalog.units[${index}].segmentId does not match its segment`)
    if (raw.triangles !== segment.triangles) catalogError(`manifest.catalog.units[${index}].triangles does not match exact segment triangles`)
    const bounds = freezeBounds(raw.bounds, 'owner-local', `manifest.catalog.units[${index}].bounds`)
    const exactCanonicalBounds = transformBounds(segment.bounds, source.canonicalMatrix, 'owner-local')
    if (!boundsNear(bounds, exactCanonicalBounds)) {
      catalogError(
        `manifest.catalog.units[${index}].bounds must be the exact per-unit canonical bound; broad source-union selection is forbidden`,
      )
    }
    const renderLocalBounds = transformBounds(segment.bounds, source.renderLocalMatrix, 'parity-host-local')
    return Object.freeze({
      index,
      id,
      sourceIndex: expectedSourceIndex,
      sourceId: source.id,
      segmentIndex: expectedSegmentIndex,
      segmentId: segment.id,
      bounds,
      renderLocalBounds,
      triangles: segment.triangles,
    })
  })
  if (tupleIds.size !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.units) {
    catalogError('manifest.catalog.units has duplicate or missing source/segment units')
  }

  for (const source of sources) {
    const first = source.index * REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.segments
    const exactUnion = unionBounds(units.slice(first, first + REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.segments).map((unit) => unit.bounds), 'owner-local')
    if (!exactUnion || !boundsNear(source.bounds, exactUnion)) {
      catalogError(`manifest.catalog.sources[${source.index}].bounds must equal the union of its six exact per-unit bounds`)
    }
  }

  const budgets = manifest.budgets
  if (!isRecord(budgets)) catalogError('manifest.budgets must be an object')
  finiteInteger(budgets.repeatFamilyResidentTriangles, 0, 'manifest.budgets.repeatFamilyResidentTriangles')
  finiteInteger(budgets.repeatFamilyTransitionTriangles, 0, 'manifest.budgets.repeatFamilyTransitionTriangles')
  finiteInteger(budgets.totalResidentTriangles, 0, 'manifest.budgets.totalResidentTriangles')
  finiteInteger(budgets.totalTransitionTriangles, 0, 'manifest.budgets.totalTransitionTriangles')
  finiteInteger(budgets.allOtherOwnerReservationTriangles, 0, 'manifest.budgets.allOtherOwnerReservationTriangles')
  finiteInteger(budgets.maxActiveDraws, 0, 'manifest.budgets.maxActiveDraws')
  if (budgets.repeatFamilyTransitionTriangles < budgets.repeatFamilyResidentTriangles) {
    catalogError('manifest.budgets.repeatFamilyTransitionTriangles must be >= repeatFamilyResidentTriangles')
  }
  if (budgets.totalResidentTriangles < budgets.repeatFamilyResidentTriangles + budgets.allOtherOwnerReservationTriangles) {
    catalogError('manifest.budgets.totalResidentTriangles must cover repeatFamilyResidentTriangles plus allOtherOwnerReservationTriangles')
  }
  if (budgets.totalTransitionTriangles < budgets.repeatFamilyTransitionTriangles + budgets.allOtherOwnerReservationTriangles) {
    catalogError('manifest.budgets.totalTransitionTriangles must cover repeatFamilyTransitionTriangles plus allOtherOwnerReservationTriangles')
  }
  if (budgets.maxActiveDraws > REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.instancedMeshLists) {
    catalogError('manifest.budgets.maxActiveDraws cannot exceed the 48 persistent renderer templates')
  }
  if (budgets.maxPersistentRendererTemplates !== REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.instancedMeshLists) {
    catalogError('manifest.budgets.maxPersistentRendererTemplates must equal 48')
  }

  const mutableGroups = new Map<string, InternalUnit[]>()
  for (const parityName of PARITIES) {
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
      mutableGroups.set(groupKey(parityName, segmentIndex), [])
    }
  }
  for (const unit of units) {
    mutableGroups.get(groupKey(sources[unit.sourceIndex].parity, unit.segmentIndex))!.push(unit)
  }
  const groupUnits = new Map<string, readonly InternalUnit[]>()
  for (const [key, entries] of mutableGroups) groupUnits.set(key, Object.freeze([...entries]))
  const parityCapacity = Object.freeze({
    positive: sources.filter((source) => source.parity === 'positive').length,
    mirrored: sources.filter((source) => source.parity === 'mirrored').length,
  })

  return Object.freeze({
    segments: Object.freeze(segments),
    sources: Object.freeze(sources),
    units: Object.freeze(units),
    groupUnits,
    parityCapacity,
    enterMarginMeters,
    exitMarginMeters,
    budgets: Object.freeze({ ...budgets }),
  })
}

function linfDistanceToClosedBounds(point: RepeatSixPartVec3, bounds: RepeatSixPartBounds): number {
  let distance = 0
  for (let axis = 0; axis < 3; axis += 1) {
    let axisDistance = 0
    if (point[axis] < bounds.min[axis]) axisDistance = bounds.min[axis] - point[axis]
    else if (point[axis] > bounds.max[axis]) axisDistance = point[axis] - bounds.max[axis]
    distance = Math.max(distance, axisDistance)
  }
  return distance
}

function freezeStringArray(values: Iterable<string>): readonly string[] {
  return Object.freeze([...values])
}

function freezeOwnerLocalFocus(value: unknown): RepeatSixPartFocusUpdate['focus'] {
  if (!isRecord(value) || value.space !== 'owner-local') {
    throw new RepeatSixPartActiveListPlannerError('focus.space must equal owner-local')
  }
  return Object.freeze({
    space: 'owner-local' as const,
    point: freezeVec3(value.point, 'focus.point'),
  })
}

function requestRevision(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RepeatSixPartActiveListTransactionError(`${path} must be a non-negative safe integer`)
  }
  return value as number
}

function freezeRegistryGuard(
  value: unknown,
  expectedLayerGeneration: number,
  path: string,
): RepeatSixPartRegistryMutationGuard {
  if (!isRecord(value)) throw new RepeatSixPartActiveListTransactionError(`${path} must be an object`)
  const layerGeneration = requestRevision(value.layerGeneration, `${path}.layerGeneration`)
  const revision = requestRevision(value.revision, `${path}.revision`)
  if (layerGeneration !== expectedLayerGeneration) {
    throw new StaleRepeatSixPartActiveListGenerationError(expectedLayerGeneration, layerGeneration)
  }
  return Object.freeze({ layerGeneration, revision })
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

const REQUIRED_ACKNOWLEDGEMENTS = Object.freeze<readonly RepeatSixPartActiveListParticipant[]>([
  'renderer',
  'registry',
])

/**
 * Offline-only selector/transaction kernel. It may inspect a disabled/raw v4
 * manifest for deterministic testing, but it is not a runtime controller.
 * Runtime code must use createRepeatSixPartRuntimeActiveListController(),
 * which remains hard-blocked by an unissued physical-semantic capability.
 */
export class RepeatSixPartOfflineActiveListKernel {
  readonly generation: number
  private readonly catalog: InternalCatalog
  private revision = 0
  private active = new Set<string>()
  private pending: PendingPreparation | null = null
  private preparationSequence = 0
  private committedPlan: RepeatSixPartActiveListCommit | null = null
  private expectedRendererRevision: number | null = null
  private expectedRegistryMutationGuard: RepeatSixPartRegistryMutationGuard | null = null
  private disposed = false

  constructor(options: RepeatSixPartOfflineActiveListKernelOptions) {
    this.catalog = validateCatalog(options)
    this.generation = options.generation
  }

  getSnapshot(): RepeatSixPartActiveListSnapshot {
    return Object.freeze({
      generation: this.generation,
      revision: this.revision,
      activeUnitKeys: freezeStringArray(this.catalog.units.filter((unit) => this.active.has(unit.id)).map((unit) => unit.id)),
      disposed: this.disposed,
      transactionPhase: this.pending?.phase ?? 'idle',
    })
  }

  prepareFocusUpdate(request: RepeatSixPartFocusUpdate): RepeatSixPartActiveListPlanResult {
    this.assertUsable()
    if (request?.generation !== this.generation) {
      throw new StaleRepeatSixPartActiveListGenerationError(this.generation, request?.generation)
    }
    if (request?.revision !== this.revision) {
      throw new StaleRepeatSixPartActiveListRevisionError(this.revision, request?.revision)
    }
    if (this.pending) {
      throw new RepeatSixPartActiveListTransactionError(
        `A six-part replacement is already pending at revision ${this.pending.replacement.revision}`,
      )
    }
    const focus = freezeOwnerLocalFocus(request?.focus)
    const rendererBaseRevision = requestRevision(request?.rendererRevision, 'rendererRevision')
    const registryBaseMutationGuard = freezeRegistryGuard(
      request?.registryMutationGuard,
      this.generation,
      'registryMutationGuard',
    )
    if (
      this.expectedRendererRevision !== null &&
      rendererBaseRevision !== this.expectedRendererRevision
    ) {
      throw new RepeatSixPartActiveListTransactionError(
        `Stale renderer revision ${rendererBaseRevision}; expected ${this.expectedRendererRevision}`,
      )
    }
    if (this.expectedRegistryMutationGuard) {
      this.assertSameRegistryGuard(
        registryBaseMutationGuard,
        this.expectedRegistryMutationGuard,
        'Selector registry mutation guard is stale',
      )
    }

    const nextActive = new Set<string>()
    for (const unit of this.catalog.units) {
      const wasActive = this.active.has(unit.id)
      const margin = wasActive ? this.catalog.exitMarginMeters : this.catalog.enterMarginMeters
      // This is exactly expandByScalar(margin).containsPoint(focus): a closed
      // L-infinity envelope, including diagonal corners of the expanded AABB.
      if (linfDistanceToClosedBounds(focus.point, unit.bounds) <= margin) nextActive.add(unit.id)
    }

    if (setsEqual(nextActive, this.active)) {
      this.expectedRendererRevision = rendererBaseRevision
      this.expectedRegistryMutationGuard = registryBaseMutationGuard
      return Object.freeze({
        kind: 'no-op' as const,
        generation: this.generation,
        revision: this.revision,
        focus,
        activeUnitKeys: freezeStringArray(
          this.catalog.units.filter((unit) => this.active.has(unit.id)).map((unit) => unit.id),
        ),
        dirtyListKeys: Object.freeze([]) as readonly [],
      })
    }

    const baseRevision = this.revision
    const replacement = this.buildCommit(focus, nextActive, baseRevision, baseRevision + 1)
    const rollbackTarget = this.committedPlan ?? this.buildCommit(focus, this.active, baseRevision, baseRevision, false)
    const token = Object.freeze({
      kind: 'repeat-six-part-active-list-preparation' as const,
      generation: this.generation,
      layerGeneration: this.generation,
      baseRevision,
      revision: replacement.revision,
      sequence: this.preparationSequence + 1,
      rendererBaseRevision,
      registryBaseMutationGuard,
    })
    this.preparationSequence = token.sequence
    this.expectedRendererRevision = rendererBaseRevision
    this.expectedRegistryMutationGuard = registryBaseMutationGuard
    this.pending = {
      phase: 'prepared',
      token,
      replacement,
      rollbackTarget,
      nextActive,
      applyReceipts: new Map<RepeatSixPartActiveListParticipant, RepeatSixPartParticipantApplyReceipt>(),
      rollbackReceipts: new Map<RepeatSixPartActiveListParticipant, RepeatSixPartParticipantRollbackReceipt>(),
    }
    return Object.freeze({
      kind: 'prepared' as const,
      token,
      replacement,
      rollbackTarget,
      requiredAcknowledgements: REQUIRED_ACKNOWLEDGEMENTS,
    })
  }

  acknowledgePreparedUpdate(
    receipt: RepeatSixPartParticipantApplyReceipt,
  ): RepeatSixPartActiveListAcknowledgement {
    this.assertUsable()
    const pending = this.requirePending(receipt?.token)
    if (pending.phase !== 'prepared') {
      throw new RepeatSixPartActiveListTransactionError('Cannot acknowledge apply while rollback is in progress')
    }
    const participant = this.validateApplyReceipt(pending, receipt)
    if (pending.applyReceipts.has(participant)) {
      throw new RepeatSixPartActiveListTransactionError(
        `${participant} already acknowledged six-part replacement revision ${pending.replacement.revision}`,
      )
    }
    pending.applyReceipts.set(participant, receipt)
    const acknowledgedParticipants = Object.freeze(
      REQUIRED_ACKNOWLEDGEMENTS.filter((entry) => pending.applyReceipts.has(entry)),
    )
    const committed = pending.applyReceipts.size === REQUIRED_ACKNOWLEDGEMENTS.length
    if (committed) {
      this.active = new Set(pending.nextActive)
      this.revision = pending.replacement.revision
      this.committedPlan = pending.replacement
      this.expectedRendererRevision = pending.token.rendererBaseRevision + 1
      this.expectedRegistryMutationGuard = Object.freeze({
        layerGeneration: pending.token.layerGeneration,
        revision: pending.token.registryBaseMutationGuard.revision + 1,
      })
      this.pending = null
    }
    return Object.freeze({
      token: pending.token,
      participant,
      acknowledgedParticipants,
      committed,
      commit: committed ? pending.replacement : null,
    })
  }

  cancelPreparedUpdate(token: RepeatSixPartActiveListPreparationToken): RepeatSixPartActiveListCancellation {
    this.assertUsable()
    const pending = this.requirePending(token)
    if (pending.phase === 'rolling-back') {
      throw new RepeatSixPartActiveListTransactionError('Six-part replacement is already rolling back')
    }
    const appliedParticipants = Object.freeze(
      REQUIRED_ACKNOWLEDGEMENTS.filter((entry) => pending.applyReceipts.has(entry)),
    )
    const phase = appliedParticipants.length === 0 ? 'cancelled' : 'rolling-back'
    if (phase === 'cancelled') this.pending = null
    else pending.phase = 'rolling-back'
    return Object.freeze({
      token: pending.token,
      phase,
      appliedParticipants,
      rollbackPendingParticipants: appliedParticipants,
      rollbackTarget: pending.rollbackTarget,
      replacement: pending.replacement,
    })
  }

  acknowledgePreparedUpdateRollback(
    receipt: RepeatSixPartParticipantRollbackReceipt,
  ): RepeatSixPartActiveListRollbackAcknowledgement {
    this.assertUsable()
    const pending = this.requirePending(receipt?.token)
    if (pending.phase !== 'rolling-back') {
      throw new RepeatSixPartActiveListTransactionError('No six-part rollback is in progress')
    }
    const participant = this.validateRollbackReceipt(pending, receipt)
    if (!pending.applyReceipts.has(participant)) {
      throw new RepeatSixPartActiveListTransactionError(`${participant} did not apply this replacement`)
    }
    if (pending.rollbackReceipts.has(participant)) {
      throw new RepeatSixPartActiveListTransactionError(`${participant} already acknowledged rollback`)
    }
    pending.rollbackReceipts.set(participant, receipt)
    const rollbackPendingParticipants = Object.freeze(REQUIRED_ACKNOWLEDGEMENTS.filter(
      (entry) => pending.applyReceipts.has(entry) && !pending.rollbackReceipts.has(entry),
    ))
    const rollbackComplete = rollbackPendingParticipants.length === 0
    if (rollbackComplete) {
      this.expectedRendererRevision = pending.token.rendererBaseRevision +
        (pending.applyReceipts.has('renderer') ? 2 : 0)
      this.expectedRegistryMutationGuard = Object.freeze({
        layerGeneration: pending.token.layerGeneration,
        revision: pending.token.registryBaseMutationGuard.revision +
          (pending.applyReceipts.has('registry') ? 2 : 0),
      })
      this.pending = null
    }
    return Object.freeze({
      token: pending.token,
      participant,
      rollbackPendingParticipants,
      rollbackComplete,
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.pending = null
    this.committedPlan = null
    this.active.clear()
    this.disposed = true
  }

  private requirePending(token: RepeatSixPartActiveListPreparationToken): PendingPreparation {
    if (!this.pending) {
      throw new RepeatSixPartActiveListTransactionError('No six-part replacement is pending')
    }
    if (token !== this.pending.token) {
      throw new RepeatSixPartActiveListTransactionError('Preparation token is stale or belongs to another planner')
    }
    if (token.generation !== this.generation) {
      throw new StaleRepeatSixPartActiveListGenerationError(this.generation, token.generation)
    }
    if (token.baseRevision !== this.revision || token.revision !== this.revision + 1) {
      throw new StaleRepeatSixPartActiveListRevisionError(this.revision, token.baseRevision)
    }
    return this.pending
  }

  private validateApplyReceipt(
    pending: PendingPreparation,
    receipt: RepeatSixPartParticipantApplyReceipt,
  ): RepeatSixPartActiveListParticipant {
    if (!isRecord(receipt) || receipt.kind !== 'repeat-six-part-participant-apply-receipt') {
      throw new RepeatSixPartActiveListTransactionError('A participant apply receipt is required')
    }
    const participant = receipt.participant
    if (participant !== 'renderer' && participant !== 'registry') {
      throw new RepeatSixPartActiveListTransactionError('participant must equal renderer or registry')
    }
    if (receipt.layerGeneration !== pending.token.layerGeneration) {
      throw new StaleRepeatSixPartActiveListGenerationError(pending.token.layerGeneration, receipt.layerGeneration)
    }
    if (receipt.rendererBaseRevision !== pending.token.rendererBaseRevision) {
      throw new RepeatSixPartActiveListTransactionError('Apply receipt renderer base revision is stale')
    }
    this.assertSameRegistryGuard(
      receipt.registryBaseMutationGuard,
      pending.token.registryBaseMutationGuard,
      'Apply receipt registry base guard is stale',
    )
    const expectedRendererApplied = participant === 'renderer'
      ? pending.token.rendererBaseRevision + 1
      : pending.token.rendererBaseRevision
    if (receipt.rendererAppliedRevision !== expectedRendererApplied) {
      throw new RepeatSixPartActiveListTransactionError('Apply receipt renderer revision is invalid')
    }
    const expectedRegistryApplied = participant === 'registry'
      ? pending.token.registryBaseMutationGuard.revision + 1
      : pending.token.registryBaseMutationGuard.revision
    this.assertSameRegistryGuard(
      receipt.registryAppliedMutationGuard,
      Object.freeze({ layerGeneration: pending.token.layerGeneration, revision: expectedRegistryApplied }),
      'Apply receipt registry mutation guard is invalid',
    )
    return participant
  }

  private validateRollbackReceipt(
    pending: PendingPreparation,
    receipt: RepeatSixPartParticipantRollbackReceipt,
  ): RepeatSixPartActiveListParticipant {
    if (!isRecord(receipt) || receipt.kind !== 'repeat-six-part-participant-rollback-receipt') {
      throw new RepeatSixPartActiveListTransactionError('A participant rollback receipt is required')
    }
    const participant = receipt.participant
    if (participant !== 'renderer' && participant !== 'registry') {
      throw new RepeatSixPartActiveListTransactionError('participant must equal renderer or registry')
    }
    if (receipt.layerGeneration !== pending.token.layerGeneration) {
      throw new StaleRepeatSixPartActiveListGenerationError(pending.token.layerGeneration, receipt.layerGeneration)
    }
    const expectedRendererRestored = participant === 'renderer'
      ? pending.token.rendererBaseRevision + 2
      : pending.token.rendererBaseRevision
    if (receipt.rendererRestoredRevision !== expectedRendererRestored) {
      throw new RepeatSixPartActiveListTransactionError('Rollback receipt renderer revision is invalid')
    }
    const expectedRegistryRestored = participant === 'registry'
      ? pending.token.registryBaseMutationGuard.revision + 2
      : pending.token.registryBaseMutationGuard.revision
    this.assertSameRegistryGuard(
      receipt.registryRestoredMutationGuard,
      Object.freeze({ layerGeneration: pending.token.layerGeneration, revision: expectedRegistryRestored }),
      'Rollback receipt registry mutation guard is invalid',
    )
    return participant
  }

  private assertSameRegistryGuard(
    observed: RepeatSixPartRegistryMutationGuard,
    expected: RepeatSixPartRegistryMutationGuard,
    message: string,
  ): void {
    if (
      !isRecord(observed) ||
      observed.layerGeneration !== expected.layerGeneration ||
      observed.revision !== expected.revision
    ) {
      throw new RepeatSixPartActiveListTransactionError(message)
    }
  }

  private assertUsable(): void {
    if (this.disposed) throw new RepeatSixPartActiveListTransactionError('Offline six-part kernel was disposed')
  }

  private buildCommit(
    focus: RepeatSixPartFocusUpdate['focus'],
    nextActive: ReadonlySet<string>,
    baseRevision: number,
    revision: number,
    enforceBudgets = true,
  ): RepeatSixPartActiveListCommit {
    const groups: RepeatSixPartParitySegmentGroup[] = []
    const lists: RepeatSixPartInstancedMeshList[] = []

    for (const parity of PARITIES) {
      for (const segment of this.catalog.segments) {
        const candidates = this.catalog.groupUnits.get(groupKey(parity, segment.index))!
        const selected = candidates.filter((unit) => nextActive.has(unit.id))
        const culled = candidates.filter((unit) => !nextActive.has(unit.id))
        const complete = [...selected, ...culled]
        const unitKeys = freezeStringArray(selected.map((unit) => unit.id))
        const matrices = Object.freeze(selected.map((unit) => this.catalog.sources[unit.sourceIndex].renderLocalMatrix))
        const slotToUnit = Object.freeze(selected.map((unit, slot) => Object.freeze({
          slot,
          unitKey: unit.id,
          unitIndex: unit.index,
          sourceIndex: unit.sourceIndex,
          sourceId: unit.sourceId,
          activity: 'active' as const,
        })))
        const completeSlotPermutation = Object.freeze(complete.map((unit, slot) => Object.freeze({
          slot,
          unitKey: unit.id,
          unitIndex: unit.index,
          sourceIndex: unit.sourceIndex,
          sourceId: unit.sourceId,
          activity: nextActive.has(unit.id) ? 'active' as const : 'culled' as const,
        })))
        const completeSlotMatrices = Object.freeze(complete.map(
          (unit) => this.catalog.sources[unit.sourceIndex].renderLocalMatrix,
        ))
        const ownerLocalBounds = unionBounds(selected.map((unit) => unit.bounds), 'owner-local')
        const renderLocalBounds = unionBounds(selected.map((unit) => unit.renderLocalBounds), 'parity-host-local')
        const activeCount = selected.length
        const present = activeCount > 0
        const materialLists = Object.freeze(Array.from(
          { length: REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.materialSlots },
          (_, materialIndex): RepeatSixPartInstancedMeshList => Object.freeze({
            key: listKey(parity, segment.index, materialIndex),
            parity,
            segmentIndex: segment.index,
            segmentId: segment.id,
            materialIndex,
            capacity: this.catalog.parityCapacity[parity],
            activeCount,
            present,
            visible: present,
            unitKeys,
            matrices,
            slotToUnit,
            completeSlotPermutation,
            completeSlotMatrices,
            ownerLocalBounds,
            renderLocalBounds,
            submittedDraws: present ? 1 : 0,
            instanceMatrixUpdateRequired: true,
            boundsRecomputeRequired: true,
          }),
        ))
        lists.push(...materialLists)
        groups.push(Object.freeze({
          key: groupKey(parity, segment.index),
          parity,
          segmentIndex: segment.index,
          segmentId: segment.id,
          activeCount,
          unitKeys,
          matrices,
          slotToUnit,
          completeSlotPermutation,
          completeSlotMatrices,
          ownerLocalBounds,
          renderLocalBounds,
          submittedTriangles: activeCount * segment.triangles,
          submittedDraws: present ? REPEAT_SIX_PART_ACTIVE_LIST_COUNTS.materialSlots : 0,
          materialLists,
        }))
      }
    }

    const submittedTriangles = groups.reduce((sum, group) => sum + group.submittedTriangles, 0)
    const submittedDraws = groups.reduce((sum, group) => sum + group.submittedDraws, 0)
    const allOwnerResidentTriangles = submittedTriangles + this.catalog.budgets.allOtherOwnerReservationTriangles
    const previousSubmittedTriangles = this.catalog.units.reduce(
      (sum, unit) => sum + (this.active.has(unit.id) ? unit.triangles : 0),
      0,
    )
    // Publishing a compacted persistent active list is synchronous: a frame
    // submits the old OR the new list, never an inferred one-row ownership
    // rewrite. Initial source-ownership conversion is an offline build concern
    // and is explicitly not proven by this kernel.
    const synchronousPublishPeakTriangles = Math.max(previousSubmittedTriangles, submittedTriangles)
    const totalSynchronousPublishPeakTriangles =
      synchronousPublishPeakTriangles + this.catalog.budgets.allOtherOwnerReservationTriangles
    if (enforceBudgets && submittedTriangles > this.catalog.budgets.repeatFamilyResidentTriangles) {
      throw new RepeatSixPartActiveListBudgetError(
        `Six-part active-list update exceeds repeat resident budget: ${submittedTriangles} > ${this.catalog.budgets.repeatFamilyResidentTriangles}`,
        submittedTriangles,
        submittedDraws,
        synchronousPublishPeakTriangles,
        totalSynchronousPublishPeakTriangles,
      )
    }
    if (enforceBudgets && allOwnerResidentTriangles > this.catalog.budgets.totalResidentTriangles) {
      throw new RepeatSixPartActiveListBudgetError(
        `Six-part active-list update exceeds total resident budget: ${allOwnerResidentTriangles} > ${this.catalog.budgets.totalResidentTriangles}`,
        submittedTriangles,
        submittedDraws,
        synchronousPublishPeakTriangles,
        totalSynchronousPublishPeakTriangles,
      )
    }
    if (enforceBudgets && synchronousPublishPeakTriangles > this.catalog.budgets.repeatFamilyTransitionTriangles) {
      throw new RepeatSixPartActiveListBudgetError(
        `Six-part active-list synchronous publish peak exceeds repeat transition budget: ${synchronousPublishPeakTriangles} > ${this.catalog.budgets.repeatFamilyTransitionTriangles}`,
        submittedTriangles,
        submittedDraws,
        synchronousPublishPeakTriangles,
        totalSynchronousPublishPeakTriangles,
      )
    }
    if (enforceBudgets && totalSynchronousPublishPeakTriangles > this.catalog.budgets.totalTransitionTriangles) {
      throw new RepeatSixPartActiveListBudgetError(
        `Six-part active-list synchronous publish peak exceeds total transition budget: ${totalSynchronousPublishPeakTriangles} > ${this.catalog.budgets.totalTransitionTriangles}`,
        submittedTriangles,
        submittedDraws,
        synchronousPublishPeakTriangles,
        totalSynchronousPublishPeakTriangles,
      )
    }
    if (enforceBudgets && submittedDraws > this.catalog.budgets.maxActiveDraws) {
      throw new RepeatSixPartActiveListBudgetError(
        `Six-part active-list update exceeds draw budget: ${submittedDraws} > ${this.catalog.budgets.maxActiveDraws}`,
        submittedTriangles,
        submittedDraws,
        synchronousPublishPeakTriangles,
        totalSynchronousPublishPeakTriangles,
      )
    }

    const unitStates = Object.freeze(this.catalog.units.map((unit): RepeatSixPartUnitState => Object.freeze({
      unitKey: unit.id,
      activity: nextActive.has(unit.id) ? 'active' : 'culled',
    })))
    const activeUnitKeys = freezeStringArray(this.catalog.units.filter((unit) => nextActive.has(unit.id)).map((unit) => unit.id))
    const activatedUnitKeys = freezeStringArray(this.catalog.units.filter((unit) => nextActive.has(unit.id) && !this.active.has(unit.id)).map((unit) => unit.id))
    const retainedActiveUnitKeys = freezeStringArray(this.catalog.units.filter((unit) => nextActive.has(unit.id) && this.active.has(unit.id)).map((unit) => unit.id))
    const culledUnitKeys = freezeStringArray(this.catalog.units.filter((unit) => !nextActive.has(unit.id) && this.active.has(unit.id)).map((unit) => unit.id))
    const frozenGroups = Object.freeze(groups)
    const frozenLists = Object.freeze(lists)
    const activeLists = Object.freeze(lists.filter((list) => list.present))
    const metrics: RepeatSixPartActiveListMetrics = Object.freeze({
      activeUnits: activeUnitKeys.length,
      culledUnits: this.catalog.units.length - activeUnitKeys.length,
      activeParitySegmentGroups: groups.filter((group) => group.activeCount > 0).length,
      activeLists: activeLists.length,
      hiddenLists: lists.length - activeLists.length,
      submittedTriangles,
      submittedDraws,
      allOwnerResidentTriangles,
      previousSubmittedTriangles,
      synchronousPublishPeakTriangles,
      totalSynchronousPublishPeakTriangles,
      initialSourceOwnershipRewrite: Object.freeze({
        provenByThisKernel: false as const,
        schedule: null,
        note: 'offline-build-responsibility' as const,
      }),
      repeatTriangleBudget: this.catalog.budgets.repeatFamilyResidentTriangles,
      totalTriangleBudget: this.catalog.budgets.totalResidentTriangles,
      repeatTransitionTriangleBudget: this.catalog.budgets.repeatFamilyTransitionTriangles,
      totalTransitionTriangleBudget: this.catalog.budgets.totalTransitionTriangles,
      drawBudget: this.catalog.budgets.maxActiveDraws,
    })

    const commit: RepeatSixPartActiveListCommit = Object.freeze({
      generation: this.generation,
      baseRevision,
      revision,
      focus,
      enterMarginMeters: this.catalog.enterMarginMeters,
      exitMarginMeters: this.catalog.exitMarginMeters,
      unitStates,
      activeUnitKeys,
      activatedUnitKeys,
      retainedActiveUnitKeys,
      culledUnitKeys,
      groups: frozenGroups,
      lists: frozenLists,
      activeLists,
      dirtyListKeys: freezeStringArray(lists.map((list) => list.key)),
      metrics,
      atomicReplacement: true,
      boundsRecomputeRequired: true,
    })
    issuedRepeatSixPartActiveListCommits.add(commit)
    return commit
  }
}
