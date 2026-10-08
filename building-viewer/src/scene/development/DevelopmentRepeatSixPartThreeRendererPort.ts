/**
 * Concrete Three.js renderer port for the dormant repeat-six-part development
 * catalog. This module is intentionally not imported by the viewer runtime or
 * by any production entry point.
 */

import {
  Box3,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Material,
  Sphere,
  Vector3,
} from 'three'
import type {
  DevelopmentRepeatSixPartAtomicCatalogPublication,
  DevelopmentRepeatSixPartAtomicListState,
  DevelopmentRepeatSixPartFailStopReason,
  DevelopmentRepeatSixPartMonolithicFallback,
  DevelopmentRepeatSixPartPersistentCatalogRendererPort,
  DevelopmentRepeatSixPartPersistentListDescriptor,
  DevelopmentRepeatSixPartPersistentRenderList,
  DevelopmentRepeatSixPartRendererPublicationReceipt,
  DevelopmentRepeatSixPartRendererRollbackRequest,
} from './DevelopmentRepeatSixPartPersistentCatalogRendererAdapter'
import type {
  RepeatSixPartBounds,
  RepeatSixPartMatrix,
  RepeatSixPartParity,
  RepeatSixPartSlotToUnit,
} from '../RepeatSixPartActiveListPlanner'

const EXPECTED_LISTS = 48
const MATRIX_ELEMENTS = 16
const PUBLICATION_KIND = 'development-repeat-six-part-persistent-exact-catalog'
const BOUNDS_POLICY = 'all-48-lists-every-publication'

// A WeakSet brand prevents scene integration from treating an arbitrary
// object with a `root` field as the physical exact-catalog renderer.
const issuedDevelopmentThreeRendererPorts = new WeakSet<object>()

export type DevelopmentRepeatSixPartThreeGeometryTemplate = Readonly<{
  segmentIndex: number
  materialIndex: number
  geometry: BufferGeometry
  material: Material
}>

export type DevelopmentRepeatSixPartThreeRendererPortOptions = Readonly<{
  generation: number
  parent: Group
  parityHostMatrices: Readonly<Record<RepeatSixPartParity, RepeatSixPartMatrix>>
  templates: readonly DevelopmentRepeatSixPartThreeGeometryTemplate[]
  rootName?: string
}>

export type DevelopmentRepeatSixPartThreeAtomicFailStopBoundary = (
  reason: DevelopmentRepeatSixPartFailStopReason,
) => void

export type DevelopmentRepeatSixPartThreeListSnapshot = Readonly<{
  key: string
  activeCount: number
  visible: boolean
  slotToUnit: readonly RepeatSixPartSlotToUnit[]
  ownerLocalBounds: RepeatSixPartBounds | null
  renderLocalBounds: RepeatSixPartBounds | null
  matrixAttributeVersion: number
}>

type StagedListState = Readonly<{
  list: DevelopmentRepeatSixPartThreePersistentList
  activeCount: number
  visible: boolean
  matrices: Float32Array
  slotToUnit: readonly RepeatSixPartSlotToUnit[]
  ownerLocalBounds: RepeatSixPartBounds | null
  renderLocalBounds: RepeatSixPartBounds | null
  boundingBox: Box3
  boundingSphere: Sphere
}>

function templateKey(segmentIndex: number, materialIndex: number): string {
  return `${segmentIndex}:${materialIndex}`
}

function assertFiniteMatrix(matrix: RepeatSixPartMatrix, label: string): void {
  if (matrix.length !== MATRIX_ELEMENTS || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error(`${label} must be a finite 4x4 column-major matrix`)
  }
}

function cloneBounds(bounds: RepeatSixPartBounds | null): RepeatSixPartBounds | null {
  if (!bounds) return null
  return Object.freeze({
    space: bounds.space,
    min: Object.freeze([...bounds.min]) as unknown as RepeatSixPartBounds['min'],
    max: Object.freeze([...bounds.max]) as unknown as RepeatSixPartBounds['max'],
  })
}

function assertBounds(bounds: RepeatSixPartBounds | null, expectedSpace: RepeatSixPartBounds['space'], label: string): void {
  if (!bounds) return
  if (bounds.space !== expectedSpace) throw new Error(`${label} has the wrong coordinate space`)
  for (let axis = 0; axis < 3; axis += 1) {
    const min = bounds.min[axis]
    const max = bounds.max[axis]
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw new Error(`${label} is not a finite closed AABB`)
    }
  }
}

function threeBounds(bounds: RepeatSixPartBounds | null): Readonly<{ box: Box3; sphere: Sphere }> {
  if (!bounds) {
    return Object.freeze({
      box: new Box3().makeEmpty(),
      sphere: new Sphere(new Vector3(), 0),
    })
  }
  const box = new Box3(
    new Vector3(bounds.min[0], bounds.min[1], bounds.min[2]),
    new Vector3(bounds.max[0], bounds.max[1], bounds.max[2]),
  )
  return Object.freeze({ box, sphere: box.getBoundingSphere(new Sphere()) })
}

function sameDescriptor(
  observed: DevelopmentRepeatSixPartPersistentListDescriptor,
  expected: DevelopmentRepeatSixPartPersistentListDescriptor,
): boolean {
  return observed.key === expected.key &&
    observed.parity === expected.parity &&
    observed.segmentIndex === expected.segmentIndex &&
    observed.segmentId === expected.segmentId &&
    observed.materialIndex === expected.materialIndex &&
    observed.capacity === expected.capacity &&
    observed.trianglesPerInstance === expected.trianglesPerInstance
}

export class DevelopmentRepeatSixPartThreePersistentList
implements DevelopmentRepeatSixPartPersistentRenderList {
  readonly key: string
  readonly initialState = 'hidden-zero-count-bounds-cleared' as const
  readonly mesh: InstancedMesh
  readonly descriptor: DevelopmentRepeatSixPartPersistentListDescriptor

  slotToUnit: readonly RepeatSixPartSlotToUnit[] = Object.freeze([])
  ownerLocalBounds: RepeatSixPartBounds | null = null
  renderLocalBounds: RepeatSixPartBounds | null = null

  constructor(
    descriptor: DevelopmentRepeatSixPartPersistentListDescriptor,
    template: DevelopmentRepeatSixPartThreeGeometryTemplate,
  ) {
    this.descriptor = Object.freeze({ ...descriptor })
    this.key = this.descriptor.key
    this.mesh = new InstancedMesh(template.geometry, template.material, descriptor.capacity)
    this.mesh.name = `dev-exact:${descriptor.key}`
    this.mesh.count = 0
    this.mesh.visible = false
    this.mesh.frustumCulled = true
    this.mesh.matrixAutoUpdate = false
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.boundingBox = new Box3().makeEmpty()
    this.mesh.boundingSphere = new Sphere(new Vector3(), 0)
    this.mesh.userData.developmentOnly = true
    // The exact-catalog adapter is the sole visibility/culling owner. Existing
    // scene packing, floor zoning, and detail LOD must never repartition or
    // independently toggle these persistent identities.
    this.mesh.userData.proceduralInstanced = true
    this.mesh.userData.externallyManagedVisibility = 'repeat-six-part-catalog'
    this.mesh.userData.detailLodIgnore = true
    this.mesh.userData.repeatSixPartListKey = descriptor.key
    this.mesh.userData.instanceIdentityGroup = `repeat-six-part:${descriptor.parity}`
    this.mesh.userData.sourceIds = Object.freeze([])
    this.mesh.userData.activeSlotToUnit = this.slotToUnit
  }

  snapshot(): DevelopmentRepeatSixPartThreeListSnapshot {
    return Object.freeze({
      key: this.key,
      activeCount: this.mesh.count,
      visible: this.mesh.visible,
      slotToUnit: this.slotToUnit,
      ownerLocalBounds: this.ownerLocalBounds,
      renderLocalBounds: this.renderLocalBounds,
      matrixAttributeVersion: this.mesh.instanceMatrix.version,
    })
  }
}

/**
 * Owns exactly 48 persistent InstancedMesh objects. A publication is first
 * fully validated and staged, then all matrix buffers, slot maps, counts,
 * visibility and conservative bounds are replaced synchronously before a
 * receipt is returned. No requestAnimationFrame can observe a partial state.
 */
export class DevelopmentRepeatSixPartThreeRendererPort
implements DevelopmentRepeatSixPartPersistentCatalogRendererPort {
  readonly root = new Group()
  readonly parityRoots: Readonly<Record<RepeatSixPartParity, Group>>

  private readonly generation: number
  private readonly parent: Group
  private readonly templates = new Map<string, DevelopmentRepeatSixPartThreeGeometryTemplate>()
  private readonly listsByKey = new Map<string, DevelopmentRepeatSixPartThreePersistentList>()
  private readonly orderedLists: DevelopmentRepeatSixPartThreePersistentList[] = []
  private rendererRevision = 0
  private failStopReason: DevelopmentRepeatSixPartFailStopReason | null = null
  private atomicFailStopBoundary: DevelopmentRepeatSixPartThreeAtomicFailStopBoundary | null = null
  private failNextPublicationCause: unknown = null
  private disposed = false

  constructor(options: DevelopmentRepeatSixPartThreeRendererPortOptions) {
    this.generation = options.generation
    this.parent = options.parent
    this.root.name = options.rootName ?? 'DEV ONLY — repeat six-part persistent catalog'
    this.root.userData.developmentOnly = true
    this.root.userData.productionOwnershipIntegrated = false

    const positive = new Group()
    const mirrored = new Group()
    positive.name = 'dev-exact:positive-parity-host'
    mirrored.name = 'dev-exact:mirrored-parity-host'
    this.parityRoots = Object.freeze({ positive, mirrored })
    for (const parity of ['positive', 'mirrored'] as const) {
      const matrix = options.parityHostMatrices[parity]
      assertFiniteMatrix(matrix, `${parity} parity host`)
      const root = this.parityRoots[parity]
      root.matrixAutoUpdate = false
      root.matrix.fromArray(matrix)
      root.matrixWorldNeedsUpdate = true
      root.userData.repeatSixPartParity = parity
      this.root.add(root)
    }

    for (const template of options.templates) {
      if (
        !Number.isInteger(template.segmentIndex) || template.segmentIndex < 0 || template.segmentIndex >= 6 ||
        !Number.isInteger(template.materialIndex) || template.materialIndex < 0 || template.materialIndex >= 4 ||
        !template.geometry || !template.material
      ) {
        throw new Error('Three.js templates must be the exact 6 x 4 segment/material catalog')
      }
      const key = templateKey(template.segmentIndex, template.materialIndex)
      if (this.templates.has(key)) throw new Error(`Duplicate Three.js geometry template ${key}`)
      this.templates.set(key, template)
    }
    if (this.templates.size !== 24) throw new Error(`Expected 24 Three.js templates; received ${this.templates.size}`)
    this.parent.add(this.root)
    issuedDevelopmentThreeRendererPorts.add(this)
  }

  createPersistentList(
    descriptor: DevelopmentRepeatSixPartPersistentListDescriptor,
  ): DevelopmentRepeatSixPartThreePersistentList {
    if (this.disposed) throw new Error('The Three.js exact catalog port is disposed')
    if (this.listsByKey.has(descriptor.key)) throw new Error(`Persistent list ${descriptor.key} already exists`)
    if (this.orderedLists.length >= EXPECTED_LISTS) throw new Error('The exact catalog cannot exceed 48 lists')
    const template = this.templates.get(templateKey(descriptor.segmentIndex, descriptor.materialIndex))
    if (!template) throw new Error(`Missing geometry template for ${descriptor.key}`)
    const list = new DevelopmentRepeatSixPartThreePersistentList(descriptor, template)
    this.listsByKey.set(descriptor.key, list)
    this.orderedLists.push(list)
    this.parityRoots[descriptor.parity].add(list.mesh)
    return list
  }

  publishAtomicExactCatalog(
    publication: DevelopmentRepeatSixPartAtomicCatalogPublication,
  ): DevelopmentRepeatSixPartRendererPublicationReceipt {
    if (this.failNextPublicationCause !== null) {
      const cause = this.failNextPublicationCause
      this.failNextPublicationCause = null
      throw cause
    }
    return this.applyAtomicPublication(publication)
  }

  rollbackAtomicExactCatalog(
    request: DevelopmentRepeatSixPartRendererRollbackRequest,
  ): DevelopmentRepeatSixPartRendererPublicationReceipt {
    if (
      request.appliedReceipt.generation !== this.generation ||
      request.appliedReceipt.rendererRevision !== request.publication.rendererBaseRevision
    ) {
      throw new Error('Rollback does not follow the applied renderer revision')
    }
    return this.applyAtomicPublication(request.publication)
  }

  /**
   * Bind the one synchronous physical fallback boundary owned by the genuine
   * real-scene bridge. The port invokes it before hiding its render root, so a
   * failed restoration leaves the still-visible replacement untouched.
   */
  bindAtomicFailStopBoundary(
    boundary: DevelopmentRepeatSixPartThreeAtomicFailStopBoundary,
  ): () => void {
    if (this.disposed) throw new Error('The Three.js exact catalog port is disposed')
    if (this.failStopReason) throw new Error('The Three.js exact catalog is already fail-stopped')
    if (typeof boundary !== 'function') throw new Error('An atomic fail-stop boundary is required')
    if (this.atomicFailStopBoundary) throw new Error('An atomic fail-stop boundary is already bound')
    this.atomicFailStopBoundary = boundary
    let active = true
    return () => {
      if (!active) return
      active = false
      if (this.atomicFailStopBoundary === boundary) this.atomicFailStopBoundary = null
    }
  }

  hidePersistentExactCatalog(reason: DevelopmentRepeatSixPartFailStopReason): void {
    if (this.disposed) throw new Error('The Three.js exact catalog port is disposed')
    // This callback is deliberately invoked before the local visibility bit is
    // cleared. It contains no await and either establishes original-only
    // ownership or throws after compensating to replacement-only ownership.
    this.atomicFailStopBoundary?.(reason)
    this.failStopReason = reason
    this.root.visible = false
  }

  disposePersistentList(value: DevelopmentRepeatSixPartPersistentRenderList): void {
    const list = this.listsByKey.get(value.key)
    if (!list || list !== value) throw new Error(`Unknown persistent list ${value.key}`)
    list.mesh.removeFromParent()
    const target = list.mesh.instanceMatrix.array as Float32Array
    target.fill(0)
    list.mesh.instanceMatrix.needsUpdate = true
    list.mesh.count = 0
    list.mesh.visible = false
    list.mesh.boundingBox = new Box3().makeEmpty()
    list.mesh.boundingSphere = new Sphere(new Vector3(), 0)
    list.slotToUnit = Object.freeze([])
    list.ownerLocalBounds = null
    list.renderLocalBounds = null
    list.mesh.userData.activeSlotToUnit = list.slotToUnit
    list.mesh.userData.sourceIds = Object.freeze([])
    list.mesh.userData.ownerLocalBounds = null
    list.mesh.userData.renderLocalBounds = null
    // Releases InstancedMesh-owned GPU-side resources (for example morph
    // textures) without disposing the shared template geometry or material.
    list.mesh.dispose()
    this.listsByKey.delete(list.key)
    const orderedIndex = this.orderedLists.indexOf(list)
    if (orderedIndex >= 0) this.orderedLists.splice(orderedIndex, 1)
    if (this.listsByKey.size === 0) {
      this.disposed = true
      this.atomicFailStopBoundary = null
      this.root.removeFromParent()
    }
  }

  /** Development harness fault injection; never used by the normal viewer. */
  failNextPublication(cause: unknown = new Error('Development-only simulated renderer publication failure')): void {
    this.failNextPublicationCause = cause
  }

  /** A fail-stopped catalog cannot be made visible again without rebuilding it. */
  setLocalPreviewVisible(visible: boolean): boolean {
    if (visible && this.failStopReason) return false
    this.root.visible = visible
    return true
  }

  getListSnapshot(key: string): DevelopmentRepeatSixPartThreeListSnapshot {
    const list = this.listsByKey.get(key)
    if (!list) throw new Error(`Unknown persistent list ${key}`)
    return list.snapshot()
  }

  getListMesh(key: string): InstancedMesh {
    const list = this.listsByKey.get(key)
    if (!list) throw new Error(`Unknown persistent list ${key}`)
    return list.mesh
  }

  getRevision(): number {
    return this.rendererRevision
  }

  private applyAtomicPublication(
    publication: DevelopmentRepeatSixPartAtomicCatalogPublication,
  ): DevelopmentRepeatSixPartRendererPublicationReceipt {
    if (this.disposed) throw new Error('The Three.js exact catalog port is disposed')
    const staged = this.stagePublication(publication)

    // The entire mutation is synchronous and contains no user callbacks or
    // awaits. Rendering therefore sees the old or the new catalog revision.
    for (const state of staged) {
      const attribute = state.list.mesh.instanceMatrix
      const target = attribute.array as Float32Array
      target.fill(0)
      target.set(state.matrices)
      attribute.needsUpdate = true
      state.list.mesh.count = state.activeCount
      state.list.mesh.visible = state.visible
      state.list.mesh.boundingBox = state.boundingBox
      state.list.mesh.boundingSphere = state.boundingSphere
      state.list.slotToUnit = state.slotToUnit
      state.list.ownerLocalBounds = state.ownerLocalBounds
      state.list.renderLocalBounds = state.renderLocalBounds
      state.list.mesh.userData.activeSlotToUnit = state.slotToUnit
      state.list.mesh.userData.sourceIds = Object.freeze(state.slotToUnit.map((entry) => entry.sourceId))
      state.list.mesh.userData.ownerLocalBounds = state.ownerLocalBounds
      state.list.mesh.userData.renderLocalBounds = state.renderLocalBounds
    }
    this.rendererRevision = publication.rendererRevision

    const keys = Object.freeze(staged.map((state) => state.list.key))
    return Object.freeze({
      kind: 'development-repeat-six-part-renderer-publication-receipt' as const,
      direction: publication.direction,
      operationId: publication.operationId,
      generation: publication.generation,
      rendererBaseRevision: publication.rendererBaseRevision,
      rendererRevision: publication.rendererRevision,
      atomicMatrixSlotMapsPublished: true as const,
      boundsRefreshPolicyHonored: true as const,
      publishedListKeys: keys,
      boundsRefreshedListKeys: keys,
    })
  }

  private stagePublication(
    publication: DevelopmentRepeatSixPartAtomicCatalogPublication,
  ): readonly StagedListState[] {
    if (
      publication.kind !== PUBLICATION_KIND ||
      publication.generation !== this.generation ||
      publication.selectionInputUnits !== 468 ||
      publication.boundsRefreshPolicy !== BOUNDS_POLICY ||
      publication.rendererBaseRevision !== this.rendererRevision ||
      publication.rendererRevision !== this.rendererRevision + 1 ||
      (publication.direction !== 'publish' && publication.direction !== 'rollback')
    ) {
      throw new Error('Renderer publication metadata is stale or invalid')
    }
    if (this.failStopReason) throw new Error('The Three.js exact catalog is fail-stopped')
    if (this.orderedLists.length !== EXPECTED_LISTS || publication.lists.length !== EXPECTED_LISTS) {
      throw new Error('A Three.js catalog publication must replace all 48 persistent lists')
    }

    const seen = new Set<string>()
    const staged: StagedListState[] = []
    for (let index = 0; index < EXPECTED_LISTS; index += 1) {
      const state = publication.lists[index]
      const expected = this.orderedLists[index]
      if (
        !state || state.persistentList !== expected || state.descriptor.key !== expected.key ||
        !sameDescriptor(state.descriptor, expected.descriptor) || seen.has(expected.key)
      ) {
        throw new Error(`Publication list ${index} does not match the persistent Three.js catalog`)
      }
      seen.add(expected.key)
      staged.push(this.stageList(state, expected))
    }
    return Object.freeze(staged)
  }

  private stageList(
    state: DevelopmentRepeatSixPartAtomicListState,
    list: DevelopmentRepeatSixPartThreePersistentList,
  ): StagedListState {
    const { descriptor } = list
    if (
      state.instanceMatrixUpdateRequired !== true || state.boundsRecomputeRequired !== true ||
      !Number.isInteger(state.activeCount) || state.activeCount < 0 || state.activeCount > descriptor.capacity ||
      state.compactedMatrices.length !== state.activeCount ||
      state.activeSlotToUnit.length !== state.activeCount ||
      state.visible !== (state.activeCount > 0) ||
      (state.activeCount === 0) !== (state.ownerLocalBounds === null) ||
      (state.activeCount === 0) !== (state.renderLocalBounds === null)
    ) {
      throw new Error(`Invalid compacted state for ${descriptor.key}`)
    }
    assertBounds(state.ownerLocalBounds, 'owner-local', `${descriptor.key} owner bounds`)
    assertBounds(state.renderLocalBounds, 'parity-host-local', `${descriptor.key} render bounds`)

    const matrices = new Float32Array(state.activeCount * MATRIX_ELEMENTS)
    const slotToUnit: RepeatSixPartSlotToUnit[] = []
    for (let slot = 0; slot < state.activeCount; slot += 1) {
      const matrix = state.compactedMatrices[slot]
      const mapping = state.activeSlotToUnit[slot]
      assertFiniteMatrix(matrix, `${descriptor.key} slot ${slot}`)
      if (
        mapping.slot !== slot || mapping.activity !== 'active' ||
        !Number.isInteger(mapping.unitIndex) || !Number.isInteger(mapping.sourceIndex) ||
        typeof mapping.unitKey !== 'string' || typeof mapping.sourceId !== 'string'
      ) {
        throw new Error(`Invalid active slot map for ${descriptor.key} slot ${slot}`)
      }
      matrices.set(matrix, slot * MATRIX_ELEMENTS)
      slotToUnit.push(Object.freeze({ ...mapping }))
    }

    const clonedRenderBounds = cloneBounds(state.renderLocalBounds)
    const conservative = threeBounds(clonedRenderBounds)
    return Object.freeze({
      list,
      activeCount: state.activeCount,
      visible: state.visible,
      matrices,
      slotToUnit: Object.freeze(slotToUnit),
      ownerLocalBounds: cloneBounds(state.ownerLocalBounds),
      renderLocalBounds: clonedRenderBounds,
      boundingBox: conservative.box,
      boundingSphere: conservative.sphere,
    })
  }
}

/** True only for a renderer port successfully constructed by this module. */
export function isIssuedDevelopmentRepeatSixPartThreeRendererPort(
  value: unknown,
): value is DevelopmentRepeatSixPartThreeRendererPort {
  return Boolean(
    value &&
    typeof value === 'object' &&
    issuedDevelopmentThreeRendererPorts.has(value as object),
  )
}

export type DevelopmentRepeatSixPartThreeFallbackVisibilityOptions = Readonly<{
  exactCatalogRoot: Group
  localNonInstancedReferenceRoot: Group
  onActivated?: (reason: DevelopmentRepeatSixPartFailStopReason) => void
}>

/**
 * Visibility handoff used after a real adapter fail-stop. The reference tree
 * is a local, non-instanced visual baseline only; this class deliberately
 * makes no production ownership or activation claim.
 */
export class DevelopmentRepeatSixPartThreeMonolithicFallbackVisibility
implements DevelopmentRepeatSixPartMonolithicFallback {
  private readonly exactCatalogRoot: Group
  private readonly referenceRoot: Group
  private readonly onActivated: ((reason: DevelopmentRepeatSixPartFailStopReason) => void) | undefined
  private activatedReason: DevelopmentRepeatSixPartFailStopReason | null = null

  constructor(options: DevelopmentRepeatSixPartThreeFallbackVisibilityOptions) {
    this.exactCatalogRoot = options.exactCatalogRoot
    this.referenceRoot = options.localNonInstancedReferenceRoot
    this.onActivated = options.onActivated
    this.referenceRoot.visible = false
    this.referenceRoot.userData.developmentOnly = true
    this.referenceRoot.userData.visualReferenceOnly = true
    this.referenceRoot.userData.productionOwnershipIntegrated = false
  }

  activateMonolithicFallback(reason: DevelopmentRepeatSixPartFailStopReason): void {
    this.activatedReason = reason
    this.exactCatalogRoot.visible = false
    this.referenceRoot.visible = true
    this.onActivated?.(reason)
  }

  setLocalReferencePreview(visible: boolean): boolean {
    if (this.activatedReason && !visible) return false
    this.exactCatalogRoot.visible = !visible
    this.referenceRoot.visible = visible
    return true
  }

  isActivated(): boolean {
    return this.activatedReason !== null
  }

  getActivatedReason(): DevelopmentRepeatSixPartFailStopReason | null {
    return this.activatedReason
  }
}
