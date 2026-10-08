/**
 * Offline-only contract for a dormant exact repeat-row cohort.
 *
 * Version 4 is intentionally not an animation-package manifest v3 extension:
 * it describes one persistent, single-resolution geometry catalog whose exact
 * source/segment instances are either active or culled. There are no LOD/HLOD
 * payload swaps. The production runtime does not understand this schema.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPEAT_SIX_PART_COHORT_SCHEMA_V4 = 'IOM_REPEAT_SIX_PART_EXACT_COHORT_MANIFEST_V4'
export const REPEAT_SIX_PART_COHORT_VERSION = 4
export const REPEAT_SIX_PART_COHORT_MODE = 'persistent-single-resolution-active-culled-exact-catalog'
export const REPEAT_SIX_PART_COHORT_TARGET_MODEL_ID = 'icm-anim-2025'
export const REPEAT_SIX_PART_COHORT_OWNER_ID = 'ground-floor-anim1'
export const REPEAT_SIX_PART_COHORT_OWNER_NODE = 'Ground Floor._anim1'

const DIRECT_PRODUCTION_SOURCE_PATHS = Object.freeze({
  productionModel: '../public/models/icm-anim-2025/model-web.glb',
  directProductionGeometry: 'production-source/exact-six-segment-production-source.glb',
  directProductionSourceMap: 'production-source/production-source-map.json',
  directProductionPhysicalAudit: 'production-source/physical-audit.json',
})
const PRODUCTION_MODEL_PIN = Object.freeze({
  bytes: 97_549_356,
  sha256: 'b96cf36f64a03d16047e3ff26aa93131481f636c184df80b5c7ea2032e4cb5e8',
})
const DIRECT_PRODUCTION_OWNER_BASIS = Object.freeze({
  nodeName: REPEAT_SIX_PART_COHORT_OWNER_NODE,
  descendantPath: 'Ground Floor.BT_3',
  activeScenePath: 'scene/0/400',
  attachmentSpace: 'owner-local',
  sceneRoot: true,
  identityRestMatrix: true,
  animationChannels: 0,
})

export const REPEAT_SIX_PART_COHORT_COUNTS = Object.freeze({
  logicalSources: 78,
  exactSegments: 6,
  selectionUnits: 468,
  materialSlots: 4,
  parityHosts: 2,
  paritySegmentGroups: 12,
  physicalGeometryPrimitives: 24,
  persistentRendererTemplates: 48,
  runtimePayloads: 3,
  manifestRequests: 1,
  coldContractRequests: 4,
})

export const REPEAT_SIX_PART_COHORT_HARD_LIMITS = Object.freeze({
  repeatFamilyResidentTriangles: 1_500_000,
  repeatFamilyTransitionTriangles: 1_500_000,
  totalResidentTriangles: 2_000_000,
  totalTransitionTriangles: 2_000_000,
  allOtherOwnerReservationTriangles: 500_000,
  maxActiveDraws: 48,
  maxPersistentRendererTemplates: 48,
  maxRuntimePayloadRequests: 3,
  maxRuntimePayloadBytes: 16 * 1024 * 1024,
  maxManifestBytes: 1024 * 1024,
  maxColdContractRequests: 4,
  maxColdContractBytes: 17 * 1024 * 1024,
})

const SHA256 = /^[a-f0-9]{64}$/
const EPSILON = 1e-8
const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
const MIRROR_X = Object.freeze([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
const CAPABILITIES = Object.freeze({
  persistentCatalog: true,
  singleResolution: true,
  activeCulledStates: true,
  exactGeometry: true,
  parityHostFactorization: true,
  ownerLocalSelectionBounds: true,
  stableLogicalIdentity: true,
  compactInstancing: true,
  hlodSwaps: false,
  quest: false,
})
const PAYLOAD_SPECS = Object.freeze({
  geometry: Object.freeze({ role: 'exact-six-segment-geometry', mediaType: 'model/gltf-binary', extension: '.glb', order: 0 }),
  cohortTable: Object.freeze({ role: 'exact-six-segment-cohort-table', mediaType: 'application/octet-stream', extension: '.bin', order: 1 }),
  ownership: Object.freeze({ role: 'exact-six-segment-ownership', mediaType: 'application/json', extension: '.json', order: 2 }),
})
const DIGEST_KEYS = Object.freeze([
  'sourcePinsSha256',
  'sourceIdsSha256',
  'sourcePathsSha256',
  'canonicalMatricesSha256',
  'renderLocalMatricesSha256',
  'sourceIdentitySha256',
  'unitIdentitySha256',
  'unitBoundsSha256',
  'geometrySegmentsSha256',
  'payloadPinsSha256',
])
const GATE_KEYS = Object.freeze([
  'exactGeometryPassed',
  'identityAndParityPassed',
  'physicalBoundsPassed',
  'residentBudgetPassed',
  'transitionBudgetPassed',
  'runtimeIntegrationPassed',
  'runtimeConcurrencyPassed',
  'browserVisualWitnessPassed',
  'measuredPerformancePassed',
  'activationApproved',
])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function positiveSafeInteger(value, allowZero = false) {
  return Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1)
}

function finiteTuple(value, length) {
  return Array.isArray(value) && value.length === length && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex')
}

function strictKeys(value, keys, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path}: must be an object`)
    return false
  }
  const allowed = new Set(keys)
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path}.${key}: unknown key`)
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) errors.push(`${path}.${key}: required key is missing`)
  }
  return true
}

function exactString(value, expected, path, errors) {
  if (value !== expected) errors.push(`${path}: must equal ${expected}`)
}

function exactBoolean(value, expected, path, errors) {
  if (value !== expected) errors.push(`${path}: must equal ${expected}`)
}

function validateSha256(value, path, errors) {
  if (typeof value !== 'string' || !SHA256.test(value)) errors.push(`${path}: must be a lowercase 64-character SHA-256 value`)
}

function validateMatrixObject(value, space, path, errors) {
  if (!strictKeys(value, ['space', 'matrix'], path, errors)) return null
  exactString(value.space, space, `${path}.space`, errors)
  if (!finiteTuple(value.matrix, 16)) {
    errors.push(`${path}.matrix: must contain 16 finite column-major numbers`)
    return null
  }
  const matrix = value.matrix
  if (Math.abs(matrix[3]) > EPSILON || Math.abs(matrix[7]) > EPSILON || Math.abs(matrix[11]) > EPSILON || Math.abs(matrix[15] - 1) > EPSILON) {
    errors.push(`${path}.matrix: must be affine`)
  }
  if (Math.abs(determinant3(matrix)) <= EPSILON) errors.push(`${path}.matrix: must be invertible`)
  return matrix
}

function validateBounds(value, space, path, errors) {
  if (!strictKeys(value, ['space', 'min', 'max'], path, errors)) return null
  exactString(value.space, space, `${path}.space`, errors)
  if (!finiteTuple(value.min, 3) || !finiteTuple(value.max, 3)) {
    errors.push(`${path}: min/max must each contain three finite numbers`)
    return null
  }
  for (let axis = 0; axis < 3; axis += 1) {
    if (value.max[axis] <= value.min[axis]) errors.push(`${path}: max[${axis}] must be greater than min[${axis}]`)
  }
  return value
}

function determinant3(matrix) {
  return matrix[0] * (matrix[5] * matrix[10] - matrix[9] * matrix[6]) -
    matrix[4] * (matrix[1] * matrix[10] - matrix[9] * matrix[2]) +
    matrix[8] * (matrix[1] * matrix[6] - matrix[5] * matrix[2])
}

function multiplyMatrices(a, b) {
  const out = new Array(16).fill(0)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let inner = 0; inner < 4; inner += 1) out[column * 4 + row] += a[inner * 4 + row] * b[column * 4 + inner]
    }
  }
  return out
}

function tupleNear(a, b, epsilon = EPSILON) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) <= epsilon)
}

function transformBounds(bounds, matrix) {
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
  return { min, max }
}

function unionBounds(bounds) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const bound of bounds) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], bound.min[axis])
      max[axis] = Math.max(max[axis], bound.max[axis])
    }
  }
  return { min, max }
}

function expandClosedBounds(bounds, margin) {
  return {
    min: bounds.min.map((value) => value - margin),
    max: bounds.max.map((value) => value + margin),
  }
}

function containsClosedPoint(bounds, point) {
  return point.every((value, axis) => value >= bounds.min[axis] && value <= bounds.max[axis])
}

function addEndpointEvent(events, coordinate, kind, item) {
  let event = events.get(coordinate)
  if (!event) {
    event = { coordinate, starts: [], ends: [] }
    events.set(coordinate, event)
  }
  event[kind].push(item)
}

class RangeAddMaxTree {
  constructor(size) {
    this.size = size
    this.max = new Float64Array(size * 4 + 8)
    this.lazy = new Float64Array(size * 4 + 8)
    this.arg = new Int32Array(size * 4 + 8)
    this.#build(1, 0, size - 1)
  }

  #build(node, left, right) {
    if (left === right) {
      this.arg[node] = left
      return
    }
    const middle = (left + right) >> 1
    this.#build(node * 2, left, middle)
    this.#build(node * 2 + 1, middle + 1, right)
    this.arg[node] = this.arg[node * 2]
  }

  #apply(node, value) {
    this.max[node] += value
    this.lazy[node] += value
  }

  #pull(node) {
    const left = node * 2
    const right = left + 1
    if (this.max[left] >= this.max[right]) {
      this.max[node] = this.max[left]
      this.arg[node] = this.arg[left]
    } else {
      this.max[node] = this.max[right]
      this.arg[node] = this.arg[right]
    }
  }

  add(queryLeft, queryRight, value, node = 1, left = 0, right = this.size - 1) {
    if (queryLeft <= left && right <= queryRight) {
      this.#apply(node, value)
      return
    }
    const middle = (left + right) >> 1
    if (queryLeft <= middle) this.add(queryLeft, queryRight, value, node * 2, left, middle)
    if (queryRight > middle) this.add(queryLeft, queryRight, value, node * 2 + 1, middle + 1, right)
    this.#pull(node)
    this.max[node] += this.lazy[node]
  }

  best() {
    return { value: this.max[1], index: this.arg[1] }
  }
}

function summarizeClosedSelection(units, margin, point, materialDrawsPerGroup) {
  const selected = units.filter((unit) => containsClosedPoint(expandClosedBounds(unit.bounds, margin), point))
  const groups = new Set(selected.map((unit) => `${unit.parity}|${unit.segmentIndex}`))
  return {
    triangles: selected.reduce((sum, unit) => sum + unit.triangles, 0),
    selectedUnitCount: selected.length,
    activeParitySegmentGroups: groups.size,
    activeDraws: groups.size * materialDrawsPerGroup,
  }
}

/** Exact weighted overlap for closed AABBs under an L-infinity margin. */
function maxWeightedClosedAabbOverlap(units, margin, materialDrawsPerGroup) {
  const boxes = units.map((unit) => ({
    unit,
    bounds: expandClosedBounds(unit.bounds, margin),
    weight: unit.triangles,
  }))
  const zCoordinates = [...new Set(boxes.flatMap((box) => [box.bounds.min[2], box.bounds.max[2]]))].sort((a, b) => a - b)
  const zIndex = new Map(zCoordinates.map((value, index) => [value, index]))
  const xEvents = new Map()
  for (const box of boxes) {
    addEndpointEvent(xEvents, box.bounds.min[0], 'starts', box)
    addEndpointEvent(xEvents, box.bounds.max[0], 'ends', box)
  }

  const activeX = new Set()
  let best = { triangles: -Infinity, point: null }
  for (const xEvent of [...xEvents.values()].sort((left, right) => left.coordinate - right.coordinate)) {
    for (const box of xEvent.starts) activeX.add(box)
    const yEvents = new Map()
    for (const box of activeX) {
      addEndpointEvent(yEvents, box.bounds.min[1], 'starts', box)
      addEndpointEvent(yEvents, box.bounds.max[1], 'ends', box)
    }
    const tree = new RangeAddMaxTree(zCoordinates.length)
    for (const yEvent of [...yEvents.values()].sort((left, right) => left.coordinate - right.coordinate)) {
      for (const box of yEvent.starts) tree.add(zIndex.get(box.bounds.min[2]), zIndex.get(box.bounds.max[2]), box.weight)
      const candidate = tree.best()
      if (candidate.value > best.triangles) {
        best = {
          triangles: candidate.value,
          point: [xEvent.coordinate, yEvent.coordinate, zCoordinates[candidate.index]],
        }
      }
      for (const box of yEvent.ends) tree.add(zIndex.get(box.bounds.min[2]), zIndex.get(box.bounds.max[2]), -box.weight)
    }
    for (const box of xEvent.ends) activeX.delete(box)
  }

  const summary = summarizeClosedSelection(units, margin, best.point, materialDrawsPerGroup)
  if (summary.triangles !== best.triangles) throw new Error('internal closed-AABB resident sweep witness mismatch')
  return { ...summary, witness: best.point }
}

/** Exact maximum number of simultaneously active parity/segment groups. */
function maxActiveClosedAabbGroups(units, margin, materialDrawsPerGroup) {
  const boxes = units.map((unit) => ({
    unit,
    bounds: expandClosedBounds(unit.bounds, margin),
    group: `${unit.parity}|${unit.segmentIndex}`,
  }))
  const possibleGroupCount = new Set(boxes.map((box) => box.group)).size
  const xEvents = new Map()
  for (const box of boxes) {
    addEndpointEvent(xEvents, box.bounds.min[0], 'starts', box)
    addEndpointEvent(xEvents, box.bounds.max[0], 'ends', box)
  }

  const activeX = new Set()
  let best = { activeParitySegmentGroups: -1, point: null }
  for (const xEvent of [...xEvents.values()].sort((left, right) => left.coordinate - right.coordinate)) {
    for (const box of xEvent.starts) activeX.add(box)
    const yEvents = new Map()
    for (const box of activeX) {
      addEndpointEvent(yEvents, box.bounds.min[1], 'starts', box)
      addEndpointEvent(yEvents, box.bounds.max[1], 'ends', box)
    }
    const activeY = new Set()
    for (const yEvent of [...yEvents.values()].sort((left, right) => left.coordinate - right.coordinate)) {
      for (const box of yEvent.starts) activeY.add(box)
      const zEvents = new Map()
      for (const box of activeY) {
        addEndpointEvent(zEvents, box.bounds.min[2], 'starts', box)
        addEndpointEvent(zEvents, box.bounds.max[2], 'ends', box)
      }
      const activeZ = new Set()
      for (const zEvent of [...zEvents.values()].sort((left, right) => left.coordinate - right.coordinate)) {
        for (const box of zEvent.starts) activeZ.add(box)
        const activeParitySegmentGroups = new Set([...activeZ].map((box) => box.group)).size
        if (activeParitySegmentGroups > best.activeParitySegmentGroups) {
          best = {
            activeParitySegmentGroups,
            point: [xEvent.coordinate, yEvent.coordinate, zEvent.coordinate],
          }
          if (activeParitySegmentGroups === possibleGroupCount) {
            return {
              ...best,
              maxActiveDraws: activeParitySegmentGroups * materialDrawsPerGroup,
              possibleGroupCount,
            }
          }
        }
        for (const box of zEvent.ends) activeZ.delete(box)
      }
      for (const box of yEvent.ends) activeY.delete(box)
    }
    for (const box of xEvent.ends) activeX.delete(box)
  }

  return {
    ...best,
    maxActiveDraws: best.activeParitySegmentGroups * materialDrawsPerGroup,
    possibleGroupCount,
  }
}

function observedPayload(options, url) {
  if (options.observedPayloads instanceof Map) return options.observedPayloads.get(url)
  if (isRecord(options.observedPayloads)) return options.observedPayloads[url]
  return undefined
}

function inspectPhysicalPins(manifest, options, errors, requirePhysicalPins) {
  let verified = true
  for (const key of Object.keys(PAYLOAD_SPECS)) {
    const payload = manifest?.payloads?.[key]
    if (!isRecord(payload) || !isString(payload.url)) {
      verified = false
      continue
    }
    const observed = observedPayload(options, payload.url)
    if (!isRecord(observed)) {
      verified = false
      if (requirePhysicalPins) errors.push(`payloads.${key}: physical bytes/hash were not observed`)
      continue
    }
    if (observed.bytes !== payload.bytes) {
      verified = false
      errors.push(`payloads.${key}.bytes: physical byte count is ${observed.bytes}, not ${payload.bytes}`)
    }
    if (typeof observed.sha256 !== 'string' || observed.sha256.toLowerCase() !== payload.sha256) {
      verified = false
      errors.push(`payloads.${key}.sha256: physical SHA-256 does not match the pin`)
    }
  }
  return verified
}

function inspectPhysicalManifestBytes(manifest, options, errors, requirePhysicalObservation) {
  const observed = options.observedManifest
  if (!isRecord(observed) || !positiveSafeInteger(observed.bytes)) {
    if (requirePhysicalObservation) errors.push('proof.manifestBytes: physical manifest bytes were not observed')
    return false
  }
  if (observed.bytes !== manifest?.proof?.manifestBytes) {
    errors.push(`proof.manifestBytes: physical manifest byte count is ${observed.bytes}, not ${manifest?.proof?.manifestBytes}`)
    return false
  }
  return true
}

function inspectAuthoritativeManifestIntegrityPin(options, errors) {
  const authoritative = options.authoritativeManifestPin
  if (!isRecord(authoritative)) {
    errors.push('external authoritative manifest bytes/SHA-256 pin was not provided')
    return false
  }
  if (!positiveSafeInteger(authoritative.bytes) || typeof authoritative.sha256 !== 'string' || !SHA256.test(authoritative.sha256)) {
    errors.push('external authoritative manifest pin must contain positive bytes and a lowercase SHA-256')
    return false
  }
  const observed = options.observedManifest
  if (!isRecord(observed) || !positiveSafeInteger(observed.bytes) || typeof observed.sha256 !== 'string' || !SHA256.test(observed.sha256.toLowerCase())) {
    errors.push('physical manifest bytes/SHA-256 were not observed independently')
    return false
  }
  if (observed.bytes !== authoritative.bytes) {
    errors.push(`physical manifest byte count ${observed.bytes} does not equal the external pin ${authoritative.bytes}`)
    return false
  }
  if (observed.sha256.toLowerCase() !== authoritative.sha256) {
    errors.push('physical manifest SHA-256 does not equal the external authoritative pin')
    return false
  }
  return true
}

function inspectRuntimeSourceOwnerPins(manifest, options, errors) {
  const observed = options.observedRuntimeSourcePins
  if (!isRecord(observed)) {
    errors.push('authoritative runtime source/owner pins were not observed')
    return false
  }
  const expected = manifest?.sourcePins
  const comparisons = [
    ['modelId', observed.modelId, expected?.modelId],
    ['productionModel.relativePath', observed.productionModel?.relativePath, expected?.productionModel?.relativePath],
    ['productionModel.bytes', observed.productionModel?.bytes, expected?.productionModel?.bytes],
    ['productionModel.sha256', observed.productionModel?.sha256, expected?.productionModel?.sha256],
    ['directProductionGeometry.path', observed.directProductionGeometry?.path, expected?.directProductionGeometry?.path],
    ['directProductionGeometry.bytes', observed.directProductionGeometry?.bytes, expected?.directProductionGeometry?.bytes],
    ['directProductionGeometry.sha256', observed.directProductionGeometry?.sha256, expected?.directProductionGeometry?.sha256],
    ['directProductionSourceMap.path', observed.directProductionSourceMap?.path, expected?.directProductionSourceMap?.path],
    ['directProductionSourceMap.bytes', observed.directProductionSourceMap?.bytes, expected?.directProductionSourceMap?.bytes],
    ['directProductionSourceMap.sha256', observed.directProductionSourceMap?.sha256, expected?.directProductionSourceMap?.sha256],
    ['directProductionSourceMap.transformSetSha256', observed.directProductionSourceMap?.transformSetSha256, expected?.directProductionSourceMap?.transformSetSha256],
    ['directProductionPhysicalAudit.path', observed.directProductionPhysicalAudit?.path, expected?.directProductionPhysicalAudit?.path],
    ['directProductionPhysicalAudit.bytes', observed.directProductionPhysicalAudit?.bytes, expected?.directProductionPhysicalAudit?.bytes],
    ['directProductionPhysicalAudit.sha256', observed.directProductionPhysicalAudit?.sha256, expected?.directProductionPhysicalAudit?.sha256],
    ['owner.nodeName', observed.owner?.nodeName, expected?.owner?.nodeName],
    ['owner.descendantPath', observed.owner?.descendantPath, expected?.owner?.descendantPath],
    ['owner.activeScenePath', observed.owner?.activeScenePath, expected?.owner?.activeScenePath],
    ['owner.attachmentSpace', observed.owner?.attachmentSpace, expected?.owner?.attachmentSpace],
    ['owner.sceneRoot', observed.owner?.sceneRoot, expected?.owner?.sceneRoot],
    ['owner.identityRestMatrix', observed.owner?.identityRestMatrix, expected?.owner?.identityRestMatrix],
    ['owner.animationChannels', observed.owner?.animationChannels, expected?.owner?.animationChannels],
  ]
  let verified = true
  for (const [path, actual, pinned] of comparisons) {
    if (actual !== pinned) {
      errors.push(`${path}: runtime value does not equal the immutable source pin`)
      verified = false
    }
  }
  if (!finiteTuple(observed.owner?.matrix, 16) || !finiteTuple(expected?.owner?.matrix, 16) || !tupleNear(observed.owner.matrix, expected.owner.matrix, 0)) {
    errors.push('owner.matrix: runtime value does not exactly equal the immutable owner transform pin')
    verified = false
  }
  return verified
}

/** Compute every digest whose canonical byte order is part of the v4 contract. */
export function computeRepeatSixPartCohortDigests(manifest) {
  const sources = Array.isArray(manifest?.catalog?.sources) ? manifest.catalog.sources : []
  const units = Array.isArray(manifest?.catalog?.units) ? manifest.catalog.units : []
  const segments = Array.isArray(manifest?.geometry?.segments) ? manifest.geometry.segments : []
  const payloads = Object.keys(PAYLOAD_SPECS).map((key) => {
    const payload = manifest?.payloads?.[key] ?? {}
    return {
      key,
      order: payload.order,
      role: payload.role,
      mediaType: payload.mediaType,
      url: payload.url,
      bytes: payload.bytes,
      sha256: payload.sha256,
    }
  })
  return {
    sourcePinsSha256: sha256Json(manifest?.sourcePins ?? null),
    sourceIdsSha256: sha256Json(sources.map((source) => source.id)),
    sourcePathsSha256: sha256Json(sources.map((source) => source.path)),
    canonicalMatricesSha256: sha256Json(sources.map((source) => source.canonicalMatrix?.matrix)),
    renderLocalMatricesSha256: sha256Json(sources.map((source) => source.renderLocalMatrix?.matrix)),
    sourceIdentitySha256: sha256Json(sources.map((source) => ({ index: source.index, id: source.id, path: source.path, parity: source.parity }))),
    unitIdentitySha256: sha256Json(units.map((unit) => ({ index: unit.index, id: unit.id, sourceIndex: unit.sourceIndex, sourceId: unit.sourceId, segmentIndex: unit.segmentIndex, segmentId: unit.segmentId }))),
    unitBoundsSha256: sha256Json(units.map((unit) => ({ id: unit.id, min: unit.bounds?.min, max: unit.bounds?.max }))),
    geometrySegmentsSha256: sha256Json(segments.map((segment) => ({ index: segment.index, id: segment.id, triangles: segment.triangles, materialPrimitiveCount: segment.materialPrimitiveCount, min: segment.bounds?.min, max: segment.bounds?.max }))),
    payloadPinsSha256: sha256Json(payloads),
  }
}

/**
 * Strict structural/offline validation. Missing physical observations are not
 * an error unless requirePhysicalPins is requested; the result summary still
 * exposes that the physical pin gate is unproven.
 */
export function validateRepeatSixPartCohortManifestV4(manifest, options = {}) {
  const errors = []
  const topKeys = ['schema', 'version', 'enabled', 'modelId', 'platform', 'units', 'mode', 'capabilities', 'owner', 'sourcePins', 'payloads', 'geometry', 'parity', 'selector', 'catalog', 'digests', 'budgets', 'proof', 'gates']
  if (!strictKeys(manifest, topKeys, 'manifest', errors)) {
    return {
      valid: false,
      structuralValid: false,
      physicalPayloadPinsVerified: false,
      physicalManifestBytesVerified: false,
      authoritativePhysicalSemanticsVerified: false,
      errors,
      summary: emptySummary(),
    }
  }

  exactString(manifest.schema, REPEAT_SIX_PART_COHORT_SCHEMA_V4, 'schema', errors)
  if (manifest.version !== REPEAT_SIX_PART_COHORT_VERSION) errors.push('version: must equal 4')
  if (typeof manifest.enabled !== 'boolean') errors.push('enabled: must be boolean')
  exactString(manifest.modelId, REPEAT_SIX_PART_COHORT_TARGET_MODEL_ID, 'modelId', errors)
  exactString(manifest.platform, 'web', 'platform', errors)
  exactString(manifest.units, 'meters', 'units', errors)
  exactString(manifest.mode, REPEAT_SIX_PART_COHORT_MODE, 'mode', errors)

  if (strictKeys(manifest.capabilities, Object.keys(CAPABILITIES), 'capabilities', errors)) {
    for (const [key, expected] of Object.entries(CAPABILITIES)) exactBoolean(manifest.capabilities[key], expected, `capabilities.${key}`, errors)
  }

  if (strictKeys(manifest.owner, ['id', 'nodeName'], 'owner', errors)) {
    exactString(manifest.owner.id, REPEAT_SIX_PART_COHORT_OWNER_ID, 'owner.id', errors)
    exactString(manifest.owner.nodeName, REPEAT_SIX_PART_COHORT_OWNER_NODE, 'owner.nodeName', errors)
  }

  const sourcePinKeys = ['modelId', 'productionModel', 'directProductionGeometry', 'directProductionSourceMap', 'directProductionPhysicalAudit', 'owner']
  if (strictKeys(manifest.sourcePins, sourcePinKeys, 'sourcePins', errors)) {
    if (manifest.sourcePins.modelId !== manifest.modelId) errors.push('sourcePins.modelId: must equal the manifest modelId')
    if (strictKeys(manifest.sourcePins.productionModel, ['relativePath', 'bytes', 'sha256'], 'sourcePins.productionModel', errors)) {
      exactString(manifest.sourcePins.productionModel.relativePath, DIRECT_PRODUCTION_SOURCE_PATHS.productionModel, 'sourcePins.productionModel.relativePath', errors)
      if (manifest.sourcePins.productionModel.bytes !== PRODUCTION_MODEL_PIN.bytes) errors.push(`sourcePins.productionModel.bytes: must equal pinned production bytes ${PRODUCTION_MODEL_PIN.bytes}`)
      exactString(manifest.sourcePins.productionModel.sha256, PRODUCTION_MODEL_PIN.sha256, 'sourcePins.productionModel.sha256', errors)
    }
    for (const key of ['directProductionGeometry', 'directProductionPhysicalAudit']) {
      const path = `sourcePins.${key}`
      if (strictKeys(manifest.sourcePins[key], ['path', 'bytes', 'sha256'], path, errors)) {
        exactString(manifest.sourcePins[key].path, DIRECT_PRODUCTION_SOURCE_PATHS[key], `${path}.path`, errors)
        if (!positiveSafeInteger(manifest.sourcePins[key].bytes)) errors.push(`${path}.bytes: must be a positive safe integer`)
        validateSha256(manifest.sourcePins[key].sha256, `${path}.sha256`, errors)
      }
    }
    if (strictKeys(manifest.sourcePins.directProductionSourceMap, ['path', 'bytes', 'sha256', 'transformSetSha256'], 'sourcePins.directProductionSourceMap', errors)) {
      exactString(manifest.sourcePins.directProductionSourceMap.path, DIRECT_PRODUCTION_SOURCE_PATHS.directProductionSourceMap, 'sourcePins.directProductionSourceMap.path', errors)
      if (!positiveSafeInteger(manifest.sourcePins.directProductionSourceMap.bytes)) errors.push('sourcePins.directProductionSourceMap.bytes: must be a positive safe integer')
      validateSha256(manifest.sourcePins.directProductionSourceMap.sha256, 'sourcePins.directProductionSourceMap.sha256', errors)
      validateSha256(manifest.sourcePins.directProductionSourceMap.transformSetSha256, 'sourcePins.directProductionSourceMap.transformSetSha256', errors)
    }
    const ownerKeys = ['nodeName', 'descendantPath', 'activeScenePath', 'attachmentSpace', 'sceneRoot', 'identityRestMatrix', 'animationChannels', 'matrix']
    if (strictKeys(manifest.sourcePins.owner, ownerKeys, 'sourcePins.owner', errors)) {
      if (manifest.sourcePins.owner.nodeName !== manifest.owner?.nodeName) errors.push('sourcePins.owner.nodeName: must equal owner.nodeName')
      for (const key of ['nodeName', 'descendantPath', 'activeScenePath', 'attachmentSpace']) {
        exactString(manifest.sourcePins.owner[key], DIRECT_PRODUCTION_OWNER_BASIS[key], `sourcePins.owner.${key}`, errors)
      }
      exactBoolean(manifest.sourcePins.owner.sceneRoot, DIRECT_PRODUCTION_OWNER_BASIS.sceneRoot, 'sourcePins.owner.sceneRoot', errors)
      exactBoolean(manifest.sourcePins.owner.identityRestMatrix, DIRECT_PRODUCTION_OWNER_BASIS.identityRestMatrix, 'sourcePins.owner.identityRestMatrix', errors)
      if (manifest.sourcePins.owner.animationChannels !== DIRECT_PRODUCTION_OWNER_BASIS.animationChannels) errors.push('sourcePins.owner.animationChannels: must equal 0')
      exactString(manifest.sourcePins.owner.attachmentSpace, 'owner-local', 'sourcePins.owner.attachmentSpace', errors)
      validateMatrixObject({ space: 'owner-local', matrix: manifest.sourcePins.owner.matrix }, 'owner-local', 'sourcePins.owner', errors)
      if (finiteTuple(manifest.sourcePins.owner.matrix, 16) && !tupleNear(manifest.sourcePins.owner.matrix, IDENTITY, 0)) errors.push('sourcePins.owner.matrix: must exactly equal the identity owner basis')
    }
  }

  let payloadBytes = 0
  if (strictKeys(manifest.payloads, Object.keys(PAYLOAD_SPECS), 'payloads', errors)) {
    const urls = new Set()
    for (const [key, spec] of Object.entries(PAYLOAD_SPECS)) {
      const payload = manifest.payloads[key]
      const path = `payloads.${key}`
      if (!strictKeys(payload, ['order', 'role', 'mediaType', 'url', 'bytes', 'sha256'], path, errors)) continue
      if (payload.order !== spec.order) errors.push(`${path}.order: must equal ${spec.order}`)
      exactString(payload.role, spec.role, `${path}.role`, errors)
      exactString(payload.mediaType, spec.mediaType, `${path}.mediaType`, errors)
      if (!isString(payload.url) || !payload.url.toLowerCase().endsWith(spec.extension)) errors.push(`${path}.url: must be a non-empty ${spec.extension} path`)
      else if (urls.has(payload.url)) errors.push(`${path}.url: duplicates another runtime payload`)
      else urls.add(payload.url)
      if (!positiveSafeInteger(payload.bytes)) errors.push(`${path}.bytes: must be a positive safe integer`)
      else payloadBytes += payload.bytes
      validateSha256(payload.sha256, `${path}.sha256`, errors)
    }
  }
  if (isRecord(manifest.sourcePins?.directProductionGeometry) && isRecord(manifest.payloads?.geometry)) {
    if (manifest.sourcePins.directProductionGeometry.bytes !== manifest.payloads.geometry.bytes) errors.push('payloads.geometry.bytes: must equal the direct-production geometry source pin')
    if (manifest.sourcePins.directProductionGeometry.sha256 !== manifest.payloads.geometry.sha256) errors.push('payloads.geometry.sha256: must equal the direct-production geometry source pin')
  }

  const segments = Array.isArray(manifest.geometry?.segments) ? manifest.geometry.segments : []
  const geometryKeys = ['sourceRowTriangles', 'materialSlots', 'physicalPrimitiveCount', 'canonicalGeometryDigestSha256', 'exactTriangleMaterialBijection', 'exactPositionBits', 'exactNormalBits', 'exactWinding', 'segments']
  if (strictKeys(manifest.geometry, geometryKeys, 'geometry', errors)) {
    if (manifest.geometry.sourceRowTriangles !== 61_269) errors.push('geometry.sourceRowTriangles: must equal the pinned exact row count 61269')
    if (manifest.geometry.materialSlots !== REPEAT_SIX_PART_COHORT_COUNTS.materialSlots) errors.push('geometry.materialSlots: must equal 4')
    if (manifest.geometry.physicalPrimitiveCount !== REPEAT_SIX_PART_COHORT_COUNTS.physicalGeometryPrimitives) errors.push('geometry.physicalPrimitiveCount: must equal 24')
    validateSha256(manifest.geometry.canonicalGeometryDigestSha256, 'geometry.canonicalGeometryDigestSha256', errors)
    for (const key of ['exactTriangleMaterialBijection', 'exactPositionBits', 'exactNormalBits', 'exactWinding']) exactBoolean(manifest.geometry[key], true, `geometry.${key}`, errors)
    if (segments.length !== REPEAT_SIX_PART_COHORT_COUNTS.exactSegments) errors.push('geometry.segments: must contain exactly 6 exact segments')
  }
  let segmentTriangleTotal = 0
  let segmentPrimitiveTotal = 0
  const segmentIds = new Set()
  segments.forEach((segment, index) => {
    const path = `geometry.segments[${index}]`
    if (!strictKeys(segment, ['index', 'id', 'triangles', 'materialPrimitiveCount', 'bounds'], path, errors)) return
    if (segment.index !== index) errors.push(`${path}.index: must equal its stable array index ${index}`)
    const expectedId = `segment-${String(index).padStart(2, '0')}`
    exactString(segment.id, expectedId, `${path}.id`, errors)
    if (segmentIds.has(segment.id)) errors.push(`${path}.id: must be unique`)
    segmentIds.add(segment.id)
    if (!positiveSafeInteger(segment.triangles)) errors.push(`${path}.triangles: must be a positive safe integer`)
    else segmentTriangleTotal += segment.triangles
    if (segment.materialPrimitiveCount !== REPEAT_SIX_PART_COHORT_COUNTS.materialSlots) errors.push(`${path}.materialPrimitiveCount: must equal 4`)
    if (positiveSafeInteger(segment.materialPrimitiveCount)) segmentPrimitiveTotal += segment.materialPrimitiveCount
    validateBounds(segment.bounds, 'source-row-local', `${path}.bounds`, errors)
  })
  if (segments.length === REPEAT_SIX_PART_COHORT_COUNTS.exactSegments && segmentTriangleTotal !== manifest.geometry?.sourceRowTriangles) {
    errors.push(`geometry.segments: triangle sum ${segmentTriangleTotal} must equal geometry.sourceRowTriangles`)
  }
  if (segments.length === REPEAT_SIX_PART_COHORT_COUNTS.exactSegments && segmentPrimitiveTotal !== manifest.geometry?.physicalPrimitiveCount) {
    errors.push(`geometry.physicalPrimitiveCount: must equal the ${segmentPrimitiveTotal} declared segment material primitives`)
  }

  let parityHosts = null
  const parityKeys = ['canonicalMatrixSpace', 'renderLocalMatrixSpace', 'composition', 'requirePositiveRenderLocalDeterminant', 'epsilon', 'hosts', 'materialDrawsPerActiveGroup', 'possibleGroupCount', 'persistentRendererTemplates']
  if (strictKeys(manifest.parity, parityKeys, 'parity', errors)) {
    exactString(manifest.parity.canonicalMatrixSpace, 'owner-local', 'parity.canonicalMatrixSpace', errors)
    exactString(manifest.parity.renderLocalMatrixSpace, 'parity-host-local', 'parity.renderLocalMatrixSpace', errors)
    exactString(manifest.parity.composition, 'host-times-render-local', 'parity.composition', errors)
    exactBoolean(manifest.parity.requirePositiveRenderLocalDeterminant, true, 'parity.requirePositiveRenderLocalDeterminant', errors)
    if (manifest.parity.epsilon !== EPSILON) errors.push(`parity.epsilon: must equal ${EPSILON}`)
    if (manifest.parity.materialDrawsPerActiveGroup !== REPEAT_SIX_PART_COHORT_COUNTS.materialSlots) errors.push('parity.materialDrawsPerActiveGroup: must equal 4')
    if (manifest.parity.possibleGroupCount !== REPEAT_SIX_PART_COHORT_COUNTS.paritySegmentGroups) errors.push('parity.possibleGroupCount: must equal 12')
    if (manifest.parity.persistentRendererTemplates !== REPEAT_SIX_PART_COHORT_COUNTS.persistentRendererTemplates) errors.push('parity.persistentRendererTemplates: must equal 48')
    if (manifest.parity.possibleGroupCount !== REPEAT_SIX_PART_COHORT_COUNTS.parityHosts * segments.length) errors.push('parity.possibleGroupCount: must equal parity hosts times exact segments')
    if (manifest.parity.persistentRendererTemplates !== manifest.parity.possibleGroupCount * manifest.parity.materialDrawsPerActiveGroup) errors.push('parity.persistentRendererTemplates: must equal possible groups times material draws')
    if (strictKeys(manifest.parity.hosts, ['positive', 'mirrored'], 'parity.hosts', errors)) {
      const positive = validateMatrixObject(manifest.parity.hosts.positive, 'owner-local', 'parity.hosts.positive', errors)
      const mirrored = validateMatrixObject(manifest.parity.hosts.mirrored, 'owner-local', 'parity.hosts.mirrored', errors)
      if (positive && !tupleNear(positive, IDENTITY)) errors.push('parity.hosts.positive.matrix: must be the identity host')
      if (mirrored && !tupleNear(mirrored, MIRROR_X)) errors.push('parity.hosts.mirrored.matrix: must be the fixed X-reflection host')
      if (positive && mirrored) parityHosts = { positive, mirrored }
    }
  }

  const selectorKeys = ['boundsSpace', 'boundsType', 'distanceMetric', 'enterMarginMeters', 'exitMarginMeters', 'states', 'defaultState']
  if (strictKeys(manifest.selector, selectorKeys, 'selector', errors)) {
    exactString(manifest.selector.boundsSpace, 'owner-local', 'selector.boundsSpace', errors)
    exactString(manifest.selector.boundsType, 'closed-aabb', 'selector.boundsType', errors)
    exactString(manifest.selector.distanceMetric, 'linf-point-to-closed-aabb', 'selector.distanceMetric', errors)
    if (typeof manifest.selector.enterMarginMeters !== 'number' || !Number.isFinite(manifest.selector.enterMarginMeters) || manifest.selector.enterMarginMeters < 0) errors.push('selector.enterMarginMeters: must be finite and >= 0')
    if (typeof manifest.selector.exitMarginMeters !== 'number' || !Number.isFinite(manifest.selector.exitMarginMeters) || manifest.selector.exitMarginMeters < manifest.selector.enterMarginMeters) errors.push('selector.exitMarginMeters: must be finite and >= enterMarginMeters')
    if (!Array.isArray(manifest.selector.states) || manifest.selector.states.length !== 2 || manifest.selector.states[0] !== 'active' || manifest.selector.states[1] !== 'culled') errors.push('selector.states: must equal ["active", "culled"] in that order')
    exactString(manifest.selector.defaultState, 'culled', 'selector.defaultState', errors)
  }

  const sources = Array.isArray(manifest.catalog?.sources) ? manifest.catalog.sources : []
  const units = Array.isArray(manifest.catalog?.units) ? manifest.catalog.units : []
  if (strictKeys(manifest.catalog, ['order', 'defaultState', 'sources', 'units'], 'catalog', errors)) {
    exactString(manifest.catalog.order, 'source-major-segment-major', 'catalog.order', errors)
    exactString(manifest.catalog.defaultState, 'culled', 'catalog.defaultState', errors)
    if (sources.length !== REPEAT_SIX_PART_COHORT_COUNTS.logicalSources) errors.push('catalog.sources: must contain exactly 78 logical sources')
    if (units.length !== REPEAT_SIX_PART_COHORT_COUNTS.selectionUnits) errors.push('catalog.units: must contain exactly 468 selection units')
  }

  const sourceIds = new Set()
  const sourcePaths = new Set()
  const validSources = new Map()
  sources.forEach((source, index) => {
    const path = `catalog.sources[${index}]`
    if (!strictKeys(source, ['index', 'id', 'path', 'parity', 'canonicalMatrix', 'renderLocalMatrix', 'bounds'], path, errors)) return
    if (source.index !== index) errors.push(`${path}.index: must equal its stable array index ${index}`)
    const expectedId = `source-${String(index).padStart(2, '0')}`
    exactString(source.id, expectedId, `${path}.id`, errors)
    if (sourceIds.has(source.id)) errors.push(`${path}.id: must be unique`)
    sourceIds.add(source.id)
    if (!isString(source.path)) errors.push(`${path}.path: must be a non-empty string`)
    else if (sourcePaths.has(source.path)) errors.push(`${path}.path: must be globally unique`)
    else sourcePaths.add(source.path)
    if (source.parity !== 'positive' && source.parity !== 'mirrored') errors.push(`${path}.parity: must equal positive or mirrored`)
    const canonical = validateMatrixObject(source.canonicalMatrix, 'owner-local', `${path}.canonicalMatrix`, errors)
    const renderLocal = validateMatrixObject(source.renderLocalMatrix, 'parity-host-local', `${path}.renderLocalMatrix`, errors)
    const bounds = validateBounds(source.bounds, 'owner-local', `${path}.bounds`, errors)
    if (renderLocal && determinant3(renderLocal) <= EPSILON) errors.push(`${path}.renderLocalMatrix.matrix: determinant must be positive`)
    if (canonical && (source.parity === 'positive' || source.parity === 'mirrored')) {
      const determinant = determinant3(canonical)
      if (source.parity === 'positive' && determinant <= EPSILON) errors.push(`${path}.canonicalMatrix.matrix: positive parity requires a positive determinant`)
      if (source.parity === 'mirrored' && determinant >= -EPSILON) errors.push(`${path}.canonicalMatrix.matrix: mirrored parity requires a negative determinant`)
    }
    if (canonical && renderLocal && parityHosts && (source.parity === 'positive' || source.parity === 'mirrored')) {
      const recomposed = multiplyMatrices(parityHosts[source.parity], renderLocal)
      if (!tupleNear(recomposed, canonical)) errors.push(`${path}: parity host times render-local matrix must exactly recompose canonicalMatrix`)
    }
    if (canonical && bounds) validSources.set(index, { source, canonical, bounds })
  })

  const unitIds = new Set()
  const unitsBySource = new Map()
  const sweepUnits = []
  units.forEach((unit, index) => {
    const path = `catalog.units[${index}]`
    if (!strictKeys(unit, ['index', 'id', 'sourceIndex', 'sourceId', 'segmentIndex', 'segmentId', 'bounds', 'triangles'], path, errors)) return
    if (unit.index !== index) errors.push(`${path}.index: must equal its stable array index ${index}`)
    const expectedSourceIndex = Math.floor(index / REPEAT_SIX_PART_COHORT_COUNTS.exactSegments)
    const expectedSegmentIndex = index % REPEAT_SIX_PART_COHORT_COUNTS.exactSegments
    if (unit.sourceIndex !== expectedSourceIndex) errors.push(`${path}.sourceIndex: violates source-major/segment-major order`)
    if (unit.segmentIndex !== expectedSegmentIndex) errors.push(`${path}.segmentIndex: violates source-major/segment-major order`)
    const source = sources[expectedSourceIndex]
    const segment = segments[expectedSegmentIndex]
    const expectedId = `source-${String(expectedSourceIndex).padStart(2, '0')}:segment-${String(expectedSegmentIndex).padStart(2, '0')}`
    exactString(unit.id, expectedId, `${path}.id`, errors)
    if (unitIds.has(unit.id)) errors.push(`${path}.id: must be unique`)
    unitIds.add(unit.id)
    if (source && unit.sourceId !== source.id) errors.push(`${path}.sourceId: must match the ordered logical source`)
    if (segment && unit.segmentId !== segment.id) errors.push(`${path}.segmentId: must match the ordered exact segment`)
    const bounds = validateBounds(unit.bounds, 'owner-local', `${path}.bounds`, errors)
    if (segment && unit.triangles !== segment.triangles) errors.push(`${path}.triangles: must equal the exact segment triangle count`)
    if (bounds && segment?.bounds && validSources.has(expectedSourceIndex)) {
      const expectedBounds = transformBounds(segment.bounds, validSources.get(expectedSourceIndex).canonical)
      if (!tupleNear(bounds.min, expectedBounds.min) || !tupleNear(bounds.max, expectedBounds.max)) {
        errors.push(`${path}.bounds: must equal the exact segment bounds transformed by canonicalMatrix`)
      }
    }
    if (!unitsBySource.has(expectedSourceIndex)) unitsBySource.set(expectedSourceIndex, [])
    if (bounds) unitsBySource.get(expectedSourceIndex).push(bounds)
    const sweepBoundsValid = finiteTuple(unit.bounds?.min, 3) && finiteTuple(unit.bounds?.max, 3) &&
      unit.bounds.max.every((value, axis) => value > unit.bounds.min[axis])
    if (sweepBoundsValid && positiveSafeInteger(unit.triangles) && (source?.parity === 'positive' || source?.parity === 'mirrored')) {
      sweepUnits.push({
        index,
        bounds: unit.bounds,
        triangles: unit.triangles,
        parity: source.parity,
        segmentIndex: unit.segmentIndex,
      })
    }
  })

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const source = validSources.get(sourceIndex)
    const childBounds = unitsBySource.get(sourceIndex) ?? []
    if (source && childBounds.length === REPEAT_SIX_PART_COHORT_COUNTS.exactSegments) {
      const union = unionBounds(childBounds)
      if (!tupleNear(source.bounds.min, union.min) || !tupleNear(source.bounds.max, union.max)) errors.push(`catalog.sources[${sourceIndex}].bounds: must equal the union of its six exact unit bounds`)
    }
  }

  if (strictKeys(manifest.digests, DIGEST_KEYS, 'digests', errors)) {
    const computed = computeRepeatSixPartCohortDigests(manifest)
    for (const key of DIGEST_KEYS) {
      validateSha256(manifest.digests[key], `digests.${key}`, errors)
      if (SHA256.test(manifest.digests[key]) && manifest.digests[key] !== computed[key]) errors.push(`digests.${key}: stale; expected ${computed[key]}`)
    }
  }

  const budgetKeys = ['repeatFamilyResidentTriangles', 'repeatFamilyTransitionTriangles', 'totalResidentTriangles', 'totalTransitionTriangles', 'allOtherOwnerReservationTriangles', 'maxActiveDraws', 'maxPersistentRendererTemplates', 'maxRuntimePayloadRequests', 'maxRuntimePayloadBytes', 'maxManifestBytes', 'maxColdContractRequests', 'maxColdContractBytes']
  if (strictKeys(manifest.budgets, budgetKeys, 'budgets', errors)) {
    for (const key of budgetKeys) if (!positiveSafeInteger(manifest.budgets[key], false)) errors.push(`budgets.${key}: must be a positive safe integer`)
    for (const key of budgetKeys) {
      const hard = REPEAT_SIX_PART_COHORT_HARD_LIMITS[key]
      if (positiveSafeInteger(manifest.budgets[key]) && manifest.budgets[key] > hard) errors.push(`budgets.${key}: exceeds hard limit ${hard}`)
    }
    if (manifest.budgets.repeatFamilyResidentTriangles + manifest.budgets.allOtherOwnerReservationTriangles > manifest.budgets.totalResidentTriangles) errors.push('budgets.totalResidentTriangles: must cover repeat resident plus all-other-owner reservation')
    if (manifest.budgets.repeatFamilyTransitionTriangles + manifest.budgets.allOtherOwnerReservationTriangles > manifest.budgets.totalTransitionTriangles) errors.push('budgets.totalTransitionTriangles: must cover repeat transition plus all-other-owner reservation')
  }

  let recomputedSpatialProof = null
  const canRecomputeSpatialProof = sweepUnits.length === REPEAT_SIX_PART_COHORT_COUNTS.selectionUnits &&
    typeof manifest.selector?.exitMarginMeters === 'number' && Number.isFinite(manifest.selector.exitMarginMeters) && manifest.selector.exitMarginMeters >= 0 &&
    positiveSafeInteger(manifest.parity?.materialDrawsPerActiveGroup)
  if (canRecomputeSpatialProof) {
    const margin = manifest.selector.exitMarginMeters
    const materialDrawsPerGroup = manifest.parity.materialDrawsPerActiveGroup
    recomputedSpatialProof = {
      resident: maxWeightedClosedAabbOverlap(sweepUnits, margin, materialDrawsPerGroup),
      activeDraw: maxActiveClosedAabbGroups(sweepUnits, margin, materialDrawsPerGroup),
    }
    if (recomputedSpatialProof.activeDraw.possibleGroupCount !== manifest.parity?.possibleGroupCount) {
      errors.push(`parity.possibleGroupCount: catalog exposes ${recomputedSpatialProof.activeDraw.possibleGroupCount} parity/segment groups`)
    }
  }

  const proofKeys = ['residentSweep', 'activeDrawSweep', 'transition', 'persistentRendererTemplates', 'payloadOnlyRequests', 'payloadOnlyBytes', 'manifestRequests', 'manifestBytes', 'coldContractRequests', 'coldContractBytes']
  if (strictKeys(manifest.proof, proofKeys, 'proof', errors)) {
    const resident = manifest.proof.residentSweep
    if (strictKeys(resident, ['method', 'marginMeters', 'maxSelectedTriangles', 'totalWithReservationTriangles', 'selectedUnitCount', 'activeDraws', 'witness'], 'proof.residentSweep', errors)) {
      exactString(resident.method, 'exact-closed-aabb-endpoint-sweep', 'proof.residentSweep.method', errors)
      if (resident.marginMeters !== manifest.selector?.exitMarginMeters) errors.push('proof.residentSweep.marginMeters: must equal selector.exitMarginMeters')
      for (const key of ['maxSelectedTriangles', 'totalWithReservationTriangles', 'selectedUnitCount', 'activeDraws']) if (!positiveSafeInteger(resident[key])) errors.push(`proof.residentSweep.${key}: must be a positive safe integer`)
      if (!finiteTuple(resident.witness, 3)) errors.push('proof.residentSweep.witness: must contain three finite owner-local coordinates')
      if (resident.maxSelectedTriangles + manifest.budgets?.allOtherOwnerReservationTriangles !== resident.totalWithReservationTriangles) errors.push('proof.residentSweep.totalWithReservationTriangles: arithmetic does not include the declared reservation')
      if (resident.maxSelectedTriangles > manifest.budgets?.repeatFamilyResidentTriangles) errors.push('proof.residentSweep.maxSelectedTriangles: exceeds repeat resident budget')
      if (resident.totalWithReservationTriangles > manifest.budgets?.totalResidentTriangles) errors.push('proof.residentSweep.totalWithReservationTriangles: exceeds total resident budget')
      if (resident.selectedUnitCount > units.length) errors.push('proof.residentSweep.selectedUnitCount: exceeds catalog unit count')
      if (resident.activeDraws > manifest.budgets?.maxActiveDraws) errors.push('proof.residentSweep.activeDraws: exceeds draw budget')
      if (recomputedSpatialProof) {
        if (resident.maxSelectedTriangles !== recomputedSpatialProof.resident.triangles) errors.push(`proof.residentSweep.maxSelectedTriangles: declared ${resident.maxSelectedTriangles} does not equal recomputed exact maximum ${recomputedSpatialProof.resident.triangles}`)
        const witness = finiteTuple(resident.witness, 3)
          ? summarizeClosedSelection(sweepUnits, resident.marginMeters, resident.witness, manifest.parity.materialDrawsPerActiveGroup)
          : null
        if (witness && witness.triangles !== resident.maxSelectedTriangles) errors.push(`proof.residentSweep.witness: selects ${witness.triangles} triangles, not declared maximum ${resident.maxSelectedTriangles}`)
        if (witness && witness.selectedUnitCount !== resident.selectedUnitCount) errors.push(`proof.residentSweep.selectedUnitCount: witness selects ${witness.selectedUnitCount} units, not ${resident.selectedUnitCount}`)
        if (witness && witness.activeDraws !== resident.activeDraws) errors.push(`proof.residentSweep.activeDraws: witness activates ${witness.activeDraws} parity/material draws, not ${resident.activeDraws}`)
      }
    }
    const draws = manifest.proof.activeDrawSweep
    if (strictKeys(draws, ['method', 'maxActiveDraws', 'activeParitySegmentGroups', 'witness'], 'proof.activeDrawSweep', errors)) {
      exactString(draws.method, 'exact-closed-aabb-endpoint-sweep', 'proof.activeDrawSweep.method', errors)
      if (!positiveSafeInteger(draws.maxActiveDraws)) errors.push('proof.activeDrawSweep.maxActiveDraws: must be a positive safe integer')
      if (draws.maxActiveDraws > manifest.budgets?.maxActiveDraws) errors.push('proof.activeDrawSweep.maxActiveDraws: exceeds draw budget')
      if (draws.maxActiveDraws !== draws.activeParitySegmentGroups * manifest.parity?.materialDrawsPerActiveGroup) errors.push('proof.activeDrawSweep.maxActiveDraws: must equal active groups times material draws')
      if (!finiteTuple(draws.witness, 3)) errors.push('proof.activeDrawSweep.witness: must contain three finite owner-local coordinates')
      if (recomputedSpatialProof) {
        if (draws.activeParitySegmentGroups !== recomputedSpatialProof.activeDraw.activeParitySegmentGroups) errors.push(`proof.activeDrawSweep.activeParitySegmentGroups: declared ${draws.activeParitySegmentGroups} does not equal recomputed exact maximum ${recomputedSpatialProof.activeDraw.activeParitySegmentGroups}`)
        if (draws.maxActiveDraws !== recomputedSpatialProof.activeDraw.maxActiveDraws) errors.push(`proof.activeDrawSweep.maxActiveDraws: declared ${draws.maxActiveDraws} does not equal recomputed exact maximum ${recomputedSpatialProof.activeDraw.maxActiveDraws}`)
        const witness = finiteTuple(draws.witness, 3)
          ? summarizeClosedSelection(sweepUnits, manifest.selector.exitMarginMeters, draws.witness, manifest.parity.materialDrawsPerActiveGroup)
          : null
        if (witness && witness.activeParitySegmentGroups !== draws.activeParitySegmentGroups) errors.push(`proof.activeDrawSweep.witness: activates ${witness.activeParitySegmentGroups} parity/segment groups, not ${draws.activeParitySegmentGroups}`)
        if (witness && witness.activeDraws !== draws.maxActiveDraws) errors.push(`proof.activeDrawSweep.witness: activates ${witness.activeDraws} draws, not ${draws.maxActiveDraws}`)
      }
    }
    const transition = manifest.proof.transition
    if (strictKeys(transition, [
      'model',
      'oneRowArithmeticRepeatTriangles',
      'oneRowArithmeticTotalWithReservationTriangles',
      'unorderedDoubleBufferRepeatTriangles',
      'unorderedDoubleBufferTotalWithReservationTriangles',
      'arbitraryConcurrentOverlapProven',
      'runtimeOrderingEnforced',
    ], 'proof.transition', errors)) {
      exactString(transition.model, 'ordered-one-row-or-unordered-double-buffer', 'proof.transition.model', errors)
      for (const key of [
        'oneRowArithmeticRepeatTriangles',
        'oneRowArithmeticTotalWithReservationTriangles',
        'unorderedDoubleBufferRepeatTriangles',
        'unorderedDoubleBufferTotalWithReservationTriangles',
      ]) {
        if (!positiveSafeInteger(transition[key])) errors.push(`proof.transition.${key}: must be a positive safe integer`)
      }
      if (typeof transition.arbitraryConcurrentOverlapProven !== 'boolean') errors.push('proof.transition.arbitraryConcurrentOverlapProven: must be boolean')
      if (typeof transition.runtimeOrderingEnforced !== 'boolean') errors.push('proof.transition.runtimeOrderingEnforced: must be boolean')
      if (transition.oneRowArithmeticRepeatTriangles + manifest.budgets?.allOtherOwnerReservationTriangles !== transition.oneRowArithmeticTotalWithReservationTriangles) errors.push('proof.transition.oneRowArithmeticTotalWithReservationTriangles: arithmetic does not include the declared reservation')
      if (transition.unorderedDoubleBufferRepeatTriangles + manifest.budgets?.allOtherOwnerReservationTriangles !== transition.unorderedDoubleBufferTotalWithReservationTriangles) errors.push('proof.transition.unorderedDoubleBufferTotalWithReservationTriangles: arithmetic does not include the declared reservation')
      if (recomputedSpatialProof) {
        if (transition.oneRowArithmeticRepeatTriangles !== recomputedSpatialProof.resident.triangles + segmentTriangleTotal) errors.push('proof.transition.oneRowArithmeticRepeatTriangles: must equal the exact resident maximum plus one source row')
        if (transition.unorderedDoubleBufferRepeatTriangles !== recomputedSpatialProof.resident.triangles * 2) errors.push('proof.transition.unorderedDoubleBufferRepeatTriangles: must equal twice the exact resident maximum')
      }
    }
    if (manifest.proof.persistentRendererTemplates !== manifest.parity?.persistentRendererTemplates) errors.push('proof.persistentRendererTemplates: must match parity template count')
    if (manifest.proof.persistentRendererTemplates > manifest.budgets?.maxPersistentRendererTemplates) errors.push('proof.persistentRendererTemplates: exceeds template budget')
    if (manifest.proof.payloadOnlyRequests !== REPEAT_SIX_PART_COHORT_COUNTS.runtimePayloads) errors.push('proof.payloadOnlyRequests: must equal the three pinned payloads')
    if (manifest.proof.payloadOnlyRequests > manifest.budgets?.maxRuntimePayloadRequests) errors.push('proof.payloadOnlyRequests: exceeds payload request budget')
    if (manifest.proof.payloadOnlyBytes !== payloadBytes) errors.push('proof.payloadOnlyBytes: must equal the sum of the three payload pins')
    if (manifest.proof.payloadOnlyBytes > manifest.budgets?.maxRuntimePayloadBytes) errors.push('proof.payloadOnlyBytes: exceeds payload byte budget')
    if (manifest.proof.manifestRequests !== REPEAT_SIX_PART_COHORT_COUNTS.manifestRequests) errors.push('proof.manifestRequests: must equal one manifest discovery request')
    if (!positiveSafeInteger(manifest.proof.manifestBytes)) errors.push('proof.manifestBytes: must be a positive safe integer')
    if (manifest.proof.manifestBytes > manifest.budgets?.maxManifestBytes) errors.push('proof.manifestBytes: exceeds manifest byte budget')
    if (manifest.proof.coldContractRequests !== manifest.proof.payloadOnlyRequests + manifest.proof.manifestRequests) errors.push('proof.coldContractRequests: must equal manifest plus payload-only requests')
    if (manifest.proof.coldContractRequests !== REPEAT_SIX_PART_COHORT_COUNTS.coldContractRequests) errors.push('proof.coldContractRequests: must equal four cold contract requests')
    if (manifest.proof.coldContractRequests > manifest.budgets?.maxColdContractRequests) errors.push('proof.coldContractRequests: exceeds cold contract request budget')
    if (manifest.proof.coldContractBytes !== manifest.proof.payloadOnlyBytes + manifest.proof.manifestBytes) errors.push('proof.coldContractBytes: must equal manifest plus payload-only bytes')
    if (manifest.proof.coldContractBytes > manifest.budgets?.maxColdContractBytes) errors.push('proof.coldContractBytes: exceeds cold contract byte budget')
  }

  if (strictKeys(manifest.gates, GATE_KEYS, 'gates', errors)) {
    for (const key of GATE_KEYS) if (typeof manifest.gates[key] !== 'boolean') errors.push(`gates.${key}: must be boolean`)
    const transition = manifest.proof?.transition
    if (isRecord(transition) && typeof manifest.gates.transitionBudgetPassed === 'boolean') {
      const oneRowWithinBudget =
        transition.oneRowArithmeticRepeatTriangles <= manifest.budgets?.repeatFamilyTransitionTriangles &&
        transition.oneRowArithmeticTotalWithReservationTriangles <= manifest.budgets?.totalTransitionTriangles
      const unorderedDoubleBufferWithinBudget =
        transition.unorderedDoubleBufferRepeatTriangles <= manifest.budgets?.repeatFamilyTransitionTriangles &&
        transition.unorderedDoubleBufferTotalWithReservationTriangles <= manifest.budgets?.totalTransitionTriangles
      const expectedTransitionGate = transition.runtimeOrderingEnforced === true
        ? oneRowWithinBudget
        : transition.arbitraryConcurrentOverlapProven === true && unorderedDoubleBufferWithinBudget
      if (manifest.gates.transitionBudgetPassed !== expectedTransitionGate) {
        errors.push(`gates.transitionBudgetPassed: must equal ${expectedTransitionGate} for the declared transition evidence and budgets`)
      }
    }
    if (manifest.gates.activationApproved === true) {
      for (const prerequisite of GATE_KEYS.filter((key) => key !== 'activationApproved')) {
        if (manifest.gates[prerequisite] !== true) errors.push(`gates.activationApproved: requires gates.${prerequisite}`)
      }
      if (manifest.enabled !== true) errors.push('gates.activationApproved: requires enabled=true')
    }
  }

  const structuralValid = errors.length === 0
  const physicalPinErrors = []
  const physicalPayloadPinsVerified = inspectPhysicalPins(manifest, options, physicalPinErrors, options.requirePhysicalPins === true)
  const physicalManifestBytesVerified = inspectPhysicalManifestBytes(manifest, options, physicalPinErrors, options.requirePhysicalPins === true)
  errors.push(...physicalPinErrors)

  return {
    valid: errors.length === 0,
    structuralValid,
    physicalPayloadPinsVerified,
    physicalManifestBytesVerified,
    authoritativePhysicalSemanticsVerified: false,
    errors,
    summary: {
      logicalSourceCount: sources.length,
      exactSegmentCount: segments.length,
      selectionUnitCount: units.length,
      sourceRowTriangles: segmentTriangleTotal,
      runtimePayloadCount: Object.keys(PAYLOAD_SPECS).length,
      runtimePayloadBytes: payloadBytes,
      maxResidentTriangles: manifest.proof?.residentSweep?.maxSelectedTriangles ?? 0,
      maxActiveDraws: manifest.proof?.activeDrawSweep?.maxActiveDraws ?? 0,
      spatialProofRecomputed: recomputedSpatialProof !== null,
      physicalPayloadPinsVerified,
      physicalManifestBytesVerified,
      payloadOnlyRequests: manifest.proof?.payloadOnlyRequests ?? 0,
      payloadOnlyBytes: manifest.proof?.payloadOnlyBytes ?? payloadBytes,
      manifestRequests: manifest.proof?.manifestRequests ?? 0,
      manifestBytes: manifest.proof?.manifestBytes ?? 0,
      coldContractRequests: manifest.proof?.coldContractRequests ?? 0,
      coldContractBytes: manifest.proof?.coldContractBytes ?? 0,
      authoritativePhysicalSemanticsVerified: false,
      activationAuthorityEstablished: false,
      dormant: manifest.enabled === false,
    },
  }
}

function emptySummary() {
  return {
    logicalSourceCount: 0,
    exactSegmentCount: 0,
    selectionUnitCount: 0,
    sourceRowTriangles: 0,
    runtimePayloadCount: 0,
    runtimePayloadBytes: 0,
    maxResidentTriangles: 0,
    maxActiveDraws: 0,
    spatialProofRecomputed: false,
    physicalPayloadPinsVerified: false,
    physicalManifestBytesVerified: false,
    payloadOnlyRequests: 0,
    payloadOnlyBytes: 0,
    manifestRequests: 0,
    manifestBytes: 0,
    coldContractRequests: 0,
    coldContractBytes: 0,
    authoritativePhysicalSemanticsVerified: false,
    activationAuthorityEstablished: false,
    dormant: true,
  }
}

/** Separate, fail-closed activation review. Structural validity is not approval. */
export function reviewRepeatSixPartCohortManifestV4Activation(manifest, options = {}) {
  const validation = validateRepeatSixPartCohortManifestV4(manifest, options)
  const blockers = []
  if (!validation.valid) blockers.push(...validation.errors.map((message) => ({ code: 'CONTRACT_INVALID', message })))
  if (manifest?.enabled !== true) blockers.push({ code: 'MANIFEST_DISABLED', message: 'enabled must explicitly equal true' })

  const physicalErrors = []
  const physicalPayloadPinsVerified = inspectPhysicalPins(manifest, options, physicalErrors, true)
  for (const message of physicalErrors) blockers.push({ code: 'PHYSICAL_PAYLOAD_PIN_UNVERIFIED', message })
  const physicalManifestErrors = []
  const physicalManifestBytesVerified = inspectPhysicalManifestBytes(manifest, options, physicalManifestErrors, true)
  for (const message of physicalManifestErrors) blockers.push({ code: 'PHYSICAL_MANIFEST_BYTES_UNVERIFIED', message })

  const authoritativeManifestErrors = []
  const authoritativeManifestIntegrityVerified = inspectAuthoritativeManifestIntegrityPin(options, authoritativeManifestErrors)
  const authoritativeManifestCode = isRecord(options.authoritativeManifestPin)
    ? 'AUTHORITATIVE_MANIFEST_INTEGRITY_PIN_MISMATCH'
    : 'AUTHORITATIVE_MANIFEST_INTEGRITY_PIN_MISSING'
  for (const message of authoritativeManifestErrors) blockers.push({ code: authoritativeManifestCode, message })

  const runtimeSourceOwnerErrors = []
  const runtimeSourceOwnerPinsVerified = inspectRuntimeSourceOwnerPins(manifest, options, runtimeSourceOwnerErrors)
  const runtimePinCode = isRecord(options.observedRuntimeSourcePins)
    ? 'RUNTIME_SOURCE_OWNER_PIN_MISMATCH'
    : 'AUTHORITATIVE_RUNTIME_SOURCE_OWNER_EQUALITY_MISSING'
  for (const message of runtimeSourceOwnerErrors) blockers.push({ code: runtimePinCode, message })

  // Byte counts and hashes are necessary physical pins, but cannot establish
  // that GLB primitives, BIN matrices/bounds, and ownership JSON independently
  // decode to the semantics claimed by this manifest. No activation bypass is
  // accepted until a separate authoritative decoder proves that relationship.
  blockers.push({
    code: 'AUTHORITATIVE_PHYSICAL_SEMANTIC_GATE_MISSING',
    message: 'independent decoded GLB/BIN/ownership semantic verification is not implemented',
  })

  for (const key of GATE_KEYS.filter((entry) => entry !== 'activationApproved')) {
    if (manifest?.gates?.[key] !== true) blockers.push({ code: `GATE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`, message: `gates.${key} must equal true` })
  }
  if (manifest?.gates?.activationApproved !== true) blockers.push({ code: 'ACTIVATION_NOT_APPROVED', message: 'gates.activationApproved must equal true' })
  if (manifest?.proof?.transition?.arbitraryConcurrentOverlapProven !== true && manifest?.proof?.transition?.runtimeOrderingEnforced !== true) {
    blockers.push({ code: 'TRANSITION_CONCURRENCY_UNPROVEN', message: 'prove arbitrary overlap or enforce the declared transactional ordering' })
  }

  return {
    structuralContractValid: validation.structuralValid,
    contractValid: validation.valid,
    activationEligible: false,
    physicalPayloadPinsVerified,
    physicalManifestBytesVerified,
    authoritativeManifestIntegrityVerified,
    runtimeSourceOwnerPinsVerified,
    authoritativePhysicalSemanticsVerified: false,
    activationAuthorityEstablished: false,
    blockers,
    summary: validation.summary,
  }
}

export class RepeatSixPartCohortManifestV4Error extends Error {
  constructor(errors) {
    super(`Repeat six-part cohort manifest v4 failed:\n${errors.map((error) => `- ${error}`).join('\n')}`)
    this.name = 'RepeatSixPartCohortManifestV4Error'
    this.errors = errors
  }
}

export function assertRepeatSixPartCohortManifestV4(manifest, options = {}) {
  const result = validateRepeatSixPartCohortManifestV4(manifest, options)
  if (!result.valid) throw new RepeatSixPartCohortManifestV4Error(result.errors)
  return result.summary
}

async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

export function localCohortAssetPath(url, manifestPath, assetRoot) {
  if (!isString(url) || /^[a-z]+:\/\//i.test(url) || url.startsWith('__')) throw new Error(`cannot verify non-local payload URL: ${url}`)
  let base
  let assetPath
  if (url.startsWith('/')) {
    if (!assetRoot) throw new Error(`--asset-root is required to verify absolute payload URL: ${url}`)
    base = resolve(assetRoot)
    assetPath = resolve(base, url.replace(/^[/\\]+/, ''))
  } else {
    base = resolve(dirname(manifestPath))
    assetPath = resolve(base, url)
  }
  const descendant = relative(base, assetPath)
  if (descendant === '..' || descendant.startsWith(`..\\`) || descendant.startsWith('../') || isAbsolute(descendant)) throw new Error(`payload URL escapes its verification root: ${url}`)
  return assetPath
}

export async function validateRepeatSixPartCohortManifestV4File(manifestPath, { assetRoot, contractOnly = false, activationGate = false } = {}) {
  const resolvedManifest = resolve(manifestPath)
  const manifestFileBytes = await readFile(resolvedManifest)
  const manifest = JSON.parse(manifestFileBytes.toString('utf8'))
  let observedPayloads
  if (!contractOnly) {
    observedPayloads = {}
    for (const key of Object.keys(PAYLOAD_SPECS)) {
      const payload = manifest?.payloads?.[key]
      if (!isString(payload?.url)) continue
      const path = localCohortAssetPath(payload.url, resolvedManifest, assetRoot)
      observedPayloads[payload.url] = { bytes: (await stat(path)).size, sha256: await sha256File(path) }
    }
  }
  const options = {
    observedPayloads,
    observedManifest: { bytes: manifestFileBytes.length, sha256: sha256Bytes(manifestFileBytes) },
    requirePhysicalPins: !contractOnly,
  }
  return activationGate
    ? reviewRepeatSixPartCohortManifestV4Activation(manifest, options)
    : validateRepeatSixPartCohortManifestV4(manifest, options)
}

function parseCliArgs(argv) {
  let manifestPath = null
  let assetRoot = null
  let contractOnly = false
  let activationGate = false
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--asset-root') {
      assetRoot = argv[++index]
      if (!assetRoot) throw new Error('--asset-root requires a path')
    } else if (value === '--contract-only') contractOnly = true
    else if (value === '--activation-gate') activationGate = true
    else if (!manifestPath) manifestPath = value
    else throw new Error(`unknown argument: ${value}`)
  }
  if (!manifestPath) throw new Error('usage: validate-repeat-six-part-cohort-manifest-v4.mjs <manifest.json> [--asset-root <path>] [--contract-only] [--activation-gate]')
  return { manifestPath, assetRoot, contractOnly, activationGate }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  try {
    const args = parseCliArgs(process.argv)
    const result = await validateRepeatSixPartCohortManifestV4File(args.manifestPath, args)
    const passed = args.activationGate ? result.activationEligible : result.valid
    if (!passed) {
      const messages = args.activationGate ? result.blockers.map((entry) => `${entry.code}: ${entry.message}`) : result.errors
      console.error(messages.map((message) => `ERROR ${message}`).join('\n'))
      process.exitCode = 1
    } else {
      console.log(
        `Repeat six-part cohort manifest v4 ${args.activationGate ? 'activation-eligible' : 'valid'}: ` +
        `${result.summary.logicalSourceCount} sources, ${result.summary.selectionUnitCount} units, ` +
        `${result.summary.runtimePayloadBytes.toLocaleString('en-US')} payload bytes`,
      )
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
