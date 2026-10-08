#!/usr/bin/env node

/**
 * Independent, offline semantic verifier for the dormant repeat-six-part v4
 * cohort. This module intentionally imports neither the source/cohort builders
 * nor the activation validator. It parses the raw GLB JSON/BIN chunks and the
 * compact cohort table directly; MeshoptDecoder is used only to expand the
 * production GLB's pinned EXT_meshopt_compression transport bytes.
 *
 * A passing result is evidence only. It is not wired to activation, runtime,
 * public assets, or production routing.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MeshoptDecoder } from 'meshoptimizer'

await MeshoptDecoder.ready

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const OUTPUT_ROOT = resolve(VIEWER_ROOT, 'tmp/repeat-six-part-cohort-v4')

export const REPEAT_SIX_PART_SEMANTIC_PATHS = Object.freeze({
  manifest: resolve(OUTPUT_ROOT, 'manifest-v4.disabled.json'),
  geometry: resolve(VIEWER_ROOT, 'tmp/repeat-six-part-exact-pilot/payloads/shared/exact-six-segment-geometry.glb'),
  cohortTable: resolve(VIEWER_ROOT, 'tmp/repeat-six-part-exact-pilot/payloads/web/exact-six-segment-cohort.bin'),
  ownership: resolve(VIEWER_ROOT, 'tmp/repeat-six-part-exact-pilot/payloads/web/exact-six-segment-ownership.json'),
  productionModel: resolve(VIEWER_ROOT, '../public/models/icm-anim-2025/model-web.glb'),
  directProductionGeometry: resolve(VIEWER_ROOT, 'tmp/repeat-six-part-exact-pilot/production-source/exact-six-segment-production-source.glb'),
  directProductionSourceMap: resolve(VIEWER_ROOT, 'tmp/repeat-six-part-exact-pilot/production-source/production-source-map.json'),
  directProductionPhysicalAudit: resolve(VIEWER_ROOT, 'tmp/repeat-six-part-exact-pilot/production-source/physical-audit.json'),
  attestation: resolve(OUTPUT_ROOT, 'semantic-attestation-v1.disabled.json'),
})

const EXPECTED = Object.freeze({
  manifestSchema: 'IOM_REPEAT_SIX_PART_EXACT_COHORT_MANIFEST_V4',
  ownershipSchema: 'IOM_REPEAT_SIX_PART_EXACT_COHORT_OWNERSHIP_V2',
  mode: 'persistent-single-resolution-active-culled-exact-catalog',
  modelId: 'icm-anim-2025',
  ownerNodeName: 'Ground Floor._anim1',
  sourceCount: 78,
  segmentCount: 6,
  unitCount: 468,
  materialCount: 4,
  primitiveCount: 24,
  rowTriangles: 61_269,
  tableMagic: 'IOM6PRT2',
  tableVersion: 2,
  tableHeaderBytes: 80,
  matrixStrideBytes: 128,
  boundsStrideBytes: 48,
  keyStrideBytes: 8,
  epsilon: 1e-8,
  productionModelBytes: 97_549_356,
  productionModelSha256: 'b96cf36f64a03d16047e3ff26aa93131481f636c184df80b5c7ea2032e4cb5e8',
  directGeometryBytes: 1_877_420,
  directGeometrySha256: '34fdf9c3ca0355b0f55dc531636cbde11705920042d3788c5ba2eb2086277417',
  sourceMapBytes: 48_997,
  sourceMapSha256: '4aca79b65fc0ac1fe05add9dba3254da2cb030a55bdcd6763bc63a78374092eb',
  sourceAuditBytes: 39_175,
  sourceAuditSha256: 'ad369724ebe56fb8647a8fd3d2538e13d2270ec081293ae0b841dfb5eb51cdd9',
  canonicalGeometrySha256: '4ace583e8d9bd044defffa65aa5e6b875b4923381ebb0eeca58ee5375306edee',
  sourceIdsSha256: 'd2883d11372b27f23ae8388db283195e13b979870cb5897e63a7971676a5189b',
  sourcePathsSha256: '72f559e1f08017caeb07b3c5577b0f2e3f2cf85a1886f781f9f5b863836d30bc',
  transformSetSha256: 'fe7adf799ecbfedbf84bcfcaa0557713728a36507573f846b52476891b66d36b',
  segmentGeometrySha256: Object.freeze([
    '55d1d534df847b56bbfea8f0c9905f8ad28e3997954c69354cf3cb40faeed2d4',
    '154bb6f80c279ca8672234f8908f5dad4e4e762ec6472abe47c5795369d3b4f7',
    '5ee0d98eaf1070bd77450516dc9570e6f41cb8a2b2ffad8ff522a285f9d93193',
    'cac480e6a64f0f373cfa0c6233965df23d0049e7457f059454dc2579128167e0',
    '23607a86d0efa9fdd2a379261c62fcf018694c1a7c98f0ab06e97102ca539fe1',
    '8cf6ba50e28ca1f1662f40792a64d08fe6b997b18f5d39b74fde0b7985d5e2fc',
  ]),
  materialNames: Object.freeze([
    'vray Stuhl_Plastik',
    'vray Stuhl_Plakete',
    'vray Stuhl_Metall',
    'vray Stuhl_Bezug',
  ]),
  materialSha256: Object.freeze([
    '5607a596ab75b3030ea09d71e46e759aca5480b7ea8e868028717240ea848f9f',
    '37c98819adf88dbe4ce397f72ce324e998e20d09e50a1c78d76085d833af0407',
    '65d4e7550a8d3ba74e3cff5fb816ae14ed7fb10ba115be61ef6e79e17ae8141c',
    'bad4c76d32293515c401430ebb2edda487470bfe52a13368c536017fd443b404',
  ]),
})

const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
const MIRROR_X = Object.freeze([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
const MANIFEST_POLICY = Object.freeze({
  owner: Object.freeze({ id: 'ground-floor-anim1', nodeName: EXPECTED.ownerNodeName }),
  capabilities: Object.freeze({
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
  }),
  selector: Object.freeze({
    boundsSpace: 'owner-local',
    boundsType: 'closed-aabb',
    distanceMetric: 'linf-point-to-closed-aabb',
    enterMarginMeters: 3.5,
    exitMarginMeters: 5.5,
    states: Object.freeze(['active', 'culled']),
    defaultState: 'culled',
  }),
  budgets: Object.freeze({
    repeatFamilyResidentTriangles: 1_500_000,
    repeatFamilyTransitionTriangles: 1_500_000,
    totalResidentTriangles: 2_000_000,
    totalTransitionTriangles: 2_000_000,
    allOtherOwnerReservationTriangles: 500_000,
    maxActiveDraws: 48,
    maxPersistentRendererTemplates: 48,
    maxRuntimePayloadRequests: 3,
    maxRuntimePayloadBytes: 3_000_000,
    maxManifestBytes: 1_048_576,
    maxColdContractRequests: 4,
    maxColdContractBytes: 4_048_576,
  }),
  gates: Object.freeze({
    exactGeometryPassed: true,
    identityAndParityPassed: true,
    physicalBoundsPassed: true,
    residentBudgetPassed: true,
    transitionBudgetPassed: false,
    runtimeIntegrationPassed: false,
    runtimeConcurrencyPassed: false,
    browserVisualWitnessPassed: false,
    measuredPerformancePassed: false,
    activationApproved: false,
  }),
})
const LOGICAL_MAPPING_CERTIFICATE = Object.freeze({
  schema: 'IOM_REPEAT_SIX_PART_LOGICAL_MAPPING_CERTIFICATE_V1',
  version: 1,
  relativePath: 'scripts/fixtures/icm-anim-2025-ground-floor-repeat-logical-mapping-v1.json',
  bytes: 28_050,
  sha256: 'a802f11c3f9798168d8339c4c786036d36b7486c0c83a5fdad5931d5cff94b60',
  status: 'approved-authoritative-logical-mapping',
  approval: Object.freeze({
    status: 'approved',
    requiredAuthority: 'human-dcc-source-path-to-production-row-semantic-review',
    approvedBy: 'project-owner',
    approvedAt: '2026-08-30T16:37:38Z',
    approvalReference: 'conversation:user-explicit-proceed-after-certificate-review',
  }),
  evidenceValidated: true,
  technicalMappingPassed: true,
  provenanceApproved: true,
  logicalOwnershipMappingPassed: true,
  activationBlocked: true,
  sourceCount: 78,
  productionTransformSetSha256: 'fe7adf799ecbfedbf84bcfcaa0557713728a36507573f846b52476891b66d36b',
  metrics: Object.freeze({
    maxMatchedDistanceMeters: 0.0028825632876861296,
    minRunnerUpMarginMeters: 0.9142217907076844,
    maxBestToRunnerUpRatio: 0.002992429035999764,
    minRunnerUpDistanceMeters: 0.9159603622112861,
    minReferenceSeparationMeters: 0.9174743971496261,
    minProductionSeparationMeters: 0.9163632902334641,
  }),
  hardPolicy: Object.freeze({
    matchingMethod: 'reciprocal-exhaustive-nearest-neighbor-owner-local-translation',
    maxMatchedDistanceMeters: 0.005,
    minRunnerUpMarginMeters: 0.5,
    maxBestToRunnerUpRatio: 0.01,
    requireBijection: true,
    requireReciprocalNearest: true,
    requireExpectedProductionInstanceIndex: true,
  }),
})
const COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 })
const COMPONENT_TYPES = Object.freeze({
  5120: { bytes: 1, read: (buffer, offset) => buffer.readInt8(offset) },
  5121: { bytes: 1, read: (buffer, offset) => buffer.readUInt8(offset) },
  5122: { bytes: 2, read: (buffer, offset) => buffer.readInt16LE(offset) },
  5123: { bytes: 2, read: (buffer, offset) => buffer.readUInt16LE(offset) },
  5125: { bytes: 4, read: (buffer, offset) => buffer.readUInt32LE(offset) },
  5126: { bytes: 4, read: (buffer, offset) => buffer.readFloatLE(offset) },
})

export class RepeatSixPartSemanticVerificationError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`)
    this.name = 'RepeatSixPartSemanticVerificationError'
    this.code = code
  }
}

function reject(code, message) {
  throw new RepeatSixPartSemanticVerificationError(code, message)
}

function requireCondition(condition, code, message) {
  if (!condition) reject(code, message)
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sha256Json = (value) => sha256(Buffer.from(JSON.stringify(value)))

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]))
  }
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}

const stableStringify = (value) => JSON.stringify(stableValue(value))
const stableSha256 = (value) => sha256(Buffer.from(stableStringify(value)))

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    reject('JSON_PARSE_FAILED', `${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function finiteTuple(value, count) {
  return Array.isArray(value) && value.length === count && value.every(Number.isFinite)
}

function tupleNear(left, right, epsilon = EXPECTED.epsilon) {
  return finiteTuple(left, right?.length ?? -1) && left.length === right.length &&
    left.every((value, index) => Math.abs(value - right[index]) <= epsilon)
}

function numericTupleExact(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((value, index) => value === right[index])
}

function matrixMaxDelta(left, right) {
  let result = 0
  for (let index = 0; index < 16; index += 1) result = Math.max(result, Math.abs(left[index] - right[index]))
  return result
}

function determinant3(matrix) {
  return matrix[0] * (matrix[5] * matrix[10] - matrix[9] * matrix[6]) -
    matrix[4] * (matrix[1] * matrix[10] - matrix[9] * matrix[2]) +
    matrix[8] * (matrix[1] * matrix[6] - matrix[5] * matrix[2])
}

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

function matrixFloat64LEHex(matrix) {
  const bytes = Buffer.alloc(128)
  matrix.forEach((value, index) => bytes.writeDoubleLE(value, index * 8))
  return bytes.toString('hex')
}

function nodeLocalMatrix(node) {
  if (Array.isArray(node.matrix)) {
    requireCondition(finiteTuple(node.matrix, 16), 'GLB_NODE_MATRIX_INVALID', 'node matrix must contain 16 finite values')
    return node.matrix
  }
  const translation = node.translation ?? [0, 0, 0]
  const rotation = node.rotation ?? [0, 0, 0, 1]
  const scale = node.scale ?? [1, 1, 1]
  requireCondition(finiteTuple(translation, 3) && finiteTuple(rotation, 4) && finiteTuple(scale, 3),
    'GLB_NODE_TRS_INVALID', 'node TRS must be finite')
  const [x, y, z, w] = rotation
  const [sx, sy, sz] = scale
  const x2 = x + x
  const y2 = y + y
  const z2 = z + z
  const xx = x * x2
  const xy = x * y2
  const xz = x * z2
  const yy = y * y2
  const yz = y * z2
  const zz = z * z2
  const wx = w * x2
  const wy = w * y2
  const wz = w * z2
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    translation[0], translation[1], translation[2], 1,
  ]
}

function normalizedAccessorValue(accessor, item, axis) {
  const value = accessor.value(item, axis)
  if (!accessor.normalized) return value
  if (accessor.componentType === 5120) return Math.max(-1, value / 127)
  if (accessor.componentType === 5121) return value / 255
  if (accessor.componentType === 5122) return Math.max(-1, value / 32767)
  if (accessor.componentType === 5123) return value / 65535
  return value
}

function composeTrs(translation, rotation, scale) {
  const [x, y, z, w] = rotation
  const [sx, sy, sz] = scale
  const x2 = x + x
  const y2 = y + y
  const z2 = z + z
  const xx = x * x2
  const xy = x * y2
  const xz = x * z2
  const yy = y * y2
  const yz = y * z2
  const zz = z * z2
  const wx = w * x2
  const wy = w * y2
  const wz = w * z2
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    translation[0], translation[1], translation[2], 1,
  ]
}

function parseGlb(bytes) {
  requireCondition(Buffer.isBuffer(bytes), 'GLB_INPUT_INVALID', 'geometry must be a Buffer')
  requireCondition(bytes.length >= 20, 'GLB_TRUNCATED', 'geometry is shorter than a GLB header and chunk header')
  requireCondition(bytes.readUInt32LE(0) === 0x46546c67, 'GLB_MAGIC_MISMATCH', 'expected glTF magic')
  requireCondition(bytes.readUInt32LE(4) === 2, 'GLB_VERSION_MISMATCH', 'expected GLB version 2')
  requireCondition(bytes.readUInt32LE(8) === bytes.length, 'GLB_LENGTH_MISMATCH', 'declared GLB length differs from physical bytes')

  const chunks = []
  let offset = 12
  while (offset < bytes.length) {
    requireCondition(offset + 8 <= bytes.length, 'GLB_CHUNK_HEADER_TRUNCATED', `chunk header at ${offset} escapes the file`)
    const byteLength = bytes.readUInt32LE(offset)
    const type = bytes.readUInt32LE(offset + 4)
    const start = offset + 8
    const end = start + byteLength
    requireCondition(end <= bytes.length, 'GLB_CHUNK_TRUNCATED', `chunk at ${offset} escapes the file`)
    chunks.push({ type, bytes: bytes.subarray(start, end), start, byteLength })
    offset = end
  }
  requireCondition(offset === bytes.length, 'GLB_CHUNK_ALIGNMENT_INVALID', 'chunks do not consume the declared file')
  requireCondition(chunks.length === 2, 'GLB_CHUNK_COUNT_INVALID', `expected JSON+BIN chunks, found ${chunks.length}`)
  requireCondition(chunks[0].type === 0x4e4f534a, 'GLB_JSON_CHUNK_MISSING', 'first chunk must be JSON')
  requireCondition(chunks[1].type === 0x004e4942, 'GLB_BIN_CHUNK_MISSING', 'second chunk must be BIN')
  let jsonText = chunks[0].bytes.toString('utf8').replace(/[\u0000 ]+$/u, '')
  let document
  try {
    document = JSON.parse(jsonText)
  } catch (error) {
    reject('GLB_JSON_PARSE_FAILED', error instanceof Error ? error.message : String(error))
  }
  requireCondition(document?.asset?.version === '2.0', 'GLB_ASSET_VERSION_INVALID', 'asset.version must equal 2.0')
  requireCondition(Array.isArray(document.buffers) && document.buffers.length >= 1,
    'GLB_BUFFER_COUNT_INVALID', 'GLB must declare at least one buffer')
  requireCondition(document.buffers[0].uri === undefined, 'GLB_EXTERNAL_BUFFER_FORBIDDEN', 'physical GLB buffer must not have a URI')
  requireCondition(Number.isSafeInteger(document.buffers[0].byteLength) && document.buffers[0].byteLength <= chunks[1].byteLength,
    'GLB_BUFFER_LENGTH_INVALID', 'declared buffer length escapes the BIN chunk')

  const accessorCache = new Map()
  const decodedViewCache = new Map()
  function storageForView(view, viewIndex, label) {
    if (decodedViewCache.has(viewIndex)) return decodedViewCache.get(viewIndex)
    let storage
    const compression = view.extensions?.EXT_meshopt_compression
    if (compression) {
      requireCondition(compression.buffer === 0 && Number.isSafeInteger(compression.byteOffset) &&
        Number.isSafeInteger(compression.byteLength) && Number.isSafeInteger(compression.byteStride) &&
        Number.isSafeInteger(compression.count) && compression.byteOffset >= 0 && compression.byteLength > 0 &&
        compression.byteStride > 0 && compression.count >= 0 && typeof compression.mode === 'string',
      'GLB_MESHOPT_CONTRACT_INVALID', `${label}: malformed EXT_meshopt_compression record`)
      const sourceEnd = compression.byteOffset + compression.byteLength
      const decodedByteLength = compression.count * compression.byteStride
      requireCondition(Number.isSafeInteger(sourceEnd) && sourceEnd <= document.buffers[0].byteLength,
        'GLB_MESHOPT_SOURCE_RANGE_INVALID', `${label}: compressed bytes escape buffer 0`)
      requireCondition(Number.isSafeInteger(decodedByteLength) && decodedByteLength === view.byteLength,
        'GLB_MESHOPT_DECODE_LENGTH_MISMATCH', `${label}: decoded byte-length formula differs from bufferView.byteLength`)
      const target = new Uint8Array(decodedByteLength)
      try {
        MeshoptDecoder.decodeGltfBuffer(
          target,
          compression.count,
          compression.byteStride,
          chunks[1].bytes.subarray(compression.byteOffset, sourceEnd),
          compression.mode,
          compression.filter,
        )
      } catch (error) {
        reject('GLB_MESHOPT_DECODE_FAILED', `${label}: ${error instanceof Error ? error.message : String(error)}`)
      }
      requireCondition(target.byteLength === view.byteLength, 'GLB_MESHOPT_DECODE_LENGTH_MISMATCH', `${label}: decoded view length changed`)
      storage = { buffer: Buffer.from(target.buffer, target.byteOffset, target.byteLength), baseOffset: 0, fileOffset: null }
    } else {
      requireCondition(view.buffer === 0, 'GLB_UNRESOLVED_LOGICAL_BUFFER', `${label}: logical buffer ${view.buffer} lacks meshopt transport`)
      storage = { buffer: chunks[1].bytes, baseOffset: view.byteOffset ?? 0, fileOffset: chunks[1].start + (view.byteOffset ?? 0) }
    }
    decodedViewCache.set(viewIndex, storage)
    return storage
  }

  function decodeAccessor(index, label) {
    if (accessorCache.has(index)) return accessorCache.get(index)
    const accessor = document.accessors?.[index]
    requireCondition(accessor && typeof accessor === 'object', 'GLB_ACCESSOR_MISSING', `${label}: accessor ${index} is absent`)
    requireCondition(accessor.sparse === undefined, 'GLB_SPARSE_ACCESSOR_UNSUPPORTED', `${label}: sparse accessors are not accepted`)
    requireCondition(Number.isSafeInteger(accessor.bufferView), 'GLB_ACCESSOR_BUFFER_VIEW_MISSING', `${label}: accessor must reference a bufferView`)
    const view = document.bufferViews?.[accessor.bufferView]
    requireCondition(view && Number.isSafeInteger(view.buffer), 'GLB_BUFFER_VIEW_INVALID', `${label}: invalid bufferView`)
    const component = COMPONENT_TYPES[accessor.componentType]
    const componentCount = COMPONENTS[accessor.type]
    requireCondition(component && componentCount, 'GLB_ACCESSOR_FORMAT_INVALID', `${label}: unsupported accessor format`)
    requireCondition(Number.isSafeInteger(accessor.count) && accessor.count >= 0, 'GLB_ACCESSOR_COUNT_INVALID', `${label}: invalid accessor count`)
    const elementBytes = component.bytes * componentCount
    const stride = view.byteStride ?? view.extensions?.EXT_meshopt_compression?.byteStride ?? elementBytes
    requireCondition(Number.isSafeInteger(stride) && stride >= elementBytes && stride % component.bytes === 0,
      'GLB_ACCESSOR_STRIDE_INVALID', `${label}: invalid accessor stride`)
    const viewOffset = view.byteOffset ?? 0
    const accessorOffset = accessor.byteOffset ?? 0
    const viewLength = view.byteLength
    requireCondition([viewOffset, accessorOffset, viewLength].every((value) => Number.isSafeInteger(value) && value >= 0),
      'GLB_ACCESSOR_OFFSET_INVALID', `${label}: invalid accessor/view offset`)
    const occupied = accessor.count === 0 ? accessorOffset : accessorOffset + (accessor.count - 1) * stride + elementBytes
    requireCondition(occupied <= viewLength, 'GLB_ACCESSOR_RANGE_INVALID', `${label}: accessor escapes its bufferView`)
    const storage = storageForView(view, accessor.bufferView, label)
    const absoluteStart = storage.baseOffset + accessorOffset
    requireCondition(absoluteStart + Math.max(0, occupied - accessorOffset) <= storage.buffer.length,
      'GLB_ACCESSOR_BIN_RANGE_INVALID', `${label}: accessor escapes its decoded bufferView storage`)

    const decoded = {
      index,
      type: accessor.type,
      componentType: accessor.componentType,
      normalized: accessor.normalized === true,
      count: accessor.count,
      componentCount,
      componentBytes: component.bytes,
      value(item, axis = 0) {
        requireCondition(item >= 0 && item < accessor.count && axis >= 0 && axis < componentCount,
          'GLB_ACCESSOR_READ_RANGE_INVALID', `${label}: decoded accessor read is out of range`)
        return component.read(storage.buffer, absoluteStart + item * stride + axis * component.bytes)
      },
      rawHex(item, axis = 0) {
        const start = absoluteStart + item * stride + axis * component.bytes
        return storage.buffer.subarray(start, start + component.bytes).toString('hex')
      },
      rawComponentOffset(item, axis = 0) {
        return storage.fileOffset === null ? null : storage.fileOffset + accessorOffset + item * stride + axis * component.bytes
      },
    }
    accessorCache.set(index, decoded)
    return decoded
  }

  return { document, binary: chunks[1].bytes, binaryFileOffset: chunks[1].start, decodeAccessor }
}

function emptyBounds() {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
}

function expandPoint(bounds, point) {
  for (let axis = 0; axis < 3; axis += 1) {
    bounds.min[axis] = Math.min(bounds.min[axis], point[axis])
    bounds.max[axis] = Math.max(bounds.max[axis], point[axis])
  }
}

function unionBounds(entries) {
  const output = emptyBounds()
  for (const bounds of entries) {
    expandPoint(output, bounds.min)
    expandPoint(output, bounds.max)
  }
  return output
}

function transformBounds(bounds, matrix) {
  const output = emptyBounds()
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        expandPoint(output, [
          matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
          matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
          matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
        ])
      }
    }
  }
  return output
}

function cornerSignature(position, normal, vertex) {
  let result = ''
  for (let axis = 0; axis < 3; axis += 1) result += position.rawHex(vertex, axis)
  for (let axis = 0; axis < 3; axis += 1) result += normal.rawHex(vertex, axis)
  return result
}

function triangleSignature(indices, position, normal, slot, triangle) {
  const corners = [0, 1, 2].map((offset) => cornerSignature(position, normal, indices.value(triangle * 3 + offset)))
  const rotations = [
    `${corners[0]}/${corners[1]}/${corners[2]}`,
    `${corners[1]}/${corners[2]}/${corners[0]}`,
    `${corners[2]}/${corners[0]}/${corners[1]}`,
  ].sort()
  return `${slot}:${rotations[0]}`
}

function textureName(document, textureInfo) {
  if (!textureInfo || !Number.isSafeInteger(textureInfo.index)) return null
  return document.textures?.[textureInfo.index]?.name || null
}

function decodedMaterialRecord(document, materialIndex) {
  const material = document.materials?.[materialIndex]
  requireCondition(material && typeof material === 'object', 'GLB_MATERIAL_MISSING', `material ${materialIndex} is absent`)
  const pbr = material.pbrMetallicRoughness ?? {}
  const specular = material.extensions?.KHR_materials_specular
  return {
    name: material.name ?? '',
    baseColorFactor: pbr.baseColorFactor ?? [1, 1, 1, 1],
    emissiveFactor: material.emissiveFactor ?? [0, 0, 0],
    metallicFactor: pbr.metallicFactor ?? 1,
    roughnessFactor: pbr.roughnessFactor ?? 1,
    alphaMode: material.alphaMode ?? 'OPAQUE',
    alphaCutoff: material.alphaCutoff ?? 0.5,
    doubleSided: material.doubleSided ?? false,
    extensions: Object.keys(material.extensions ?? {}).sort(),
    specular: specular ? {
      factor: specular.specularFactor ?? 1,
      colorFactor: specular.specularColorFactor ?? [1, 1, 1],
      texture: textureName(document, specular.specularTexture),
      colorTexture: textureName(document, specular.specularColorTexture),
    } : null,
    textures: {
      baseColor: textureName(document, pbr.baseColorTexture),
      metallicRoughness: textureName(document, pbr.metallicRoughnessTexture),
      normal: textureName(document, material.normalTexture),
      occlusion: textureName(document, material.occlusionTexture),
      emissive: textureName(document, material.emissiveTexture),
    },
  }
}

function activeSceneRootNode(glb, path) {
  const match = /^scene\/(\d+)\/(\d+)$/.exec(path)
  requireCondition(match, 'PRODUCTION_SOURCE_PATH_INVALID', `invalid active-scene path ${path}`)
  const sceneIndex = Number(match[1])
  const rootIndex = Number(match[2])
  const document = glb.document
  requireCondition(sceneIndex === (document.scene ?? 0), 'PRODUCTION_SOURCE_SCENE_MISMATCH', `${path} is not in the active scene`)
  const nodeIndex = document.scenes?.[sceneIndex]?.nodes?.[rootIndex]
  requireCondition(Number.isSafeInteger(nodeIndex), 'PRODUCTION_SOURCE_ROOT_MISSING', `${path} does not resolve to an active-scene root`)
  const node = document.nodes?.[nodeIndex]
  requireCondition(node, 'PRODUCTION_SOURCE_NODE_MISSING', `${path} references a missing node`)
  return { node, nodeIndex, sceneIndex, rootIndex }
}

function auditProductionSource(productionGlb, sourceMap, sourceAudit) {
  const expectedPaths = ['scene/0/258', 'scene/0/259', 'scene/0/260', 'scene/0/261']
  requireCondition(exactJson(sourceMap.productionInstancingNodes, expectedPaths),
    'SOURCE_MAP_INSTANCING_PATHS_MISMATCH', 'production instancing paths must remain the four pinned active-scene roots')
  const globalRecords = []
  const trianglesByMaterial = {}
  const materialRecords = []
  let canonicalMatrices = null
  for (const [slot, path] of expectedPaths.entries()) {
    const { node } = activeSceneRootNode(productionGlb, path)
    requireCondition(numericTupleExact(nodeLocalMatrix(node), IDENTITY), 'PRODUCTION_INSTANCING_HOST_NOT_IDENTITY', `${path} host is not identity`)
    const extension = node.extensions?.EXT_mesh_gpu_instancing
    const attributes = extension?.attributes
    requireCondition(attributes && exactJson(Object.keys(attributes), ['TRANSLATION', 'ROTATION', 'SCALE']),
      'PRODUCTION_INSTANCING_ATTRIBUTES_INVALID', `${path} must expose ordered TRANSLATION/ROTATION/SCALE attributes`)
    const translation = productionGlb.decodeAccessor(attributes.TRANSLATION, `${path}/TRANSLATION`)
    const rotation = productionGlb.decodeAccessor(attributes.ROTATION, `${path}/ROTATION`)
    const scale = productionGlb.decodeAccessor(attributes.SCALE, `${path}/SCALE`)
    requireCondition(translation.type === 'VEC3' && translation.componentType === 5126 && !translation.normalized,
      'PRODUCTION_TRANSLATION_STORAGE_MISMATCH', `${path}: TRANSLATION must be Float32 VEC3`)
    requireCondition(rotation.type === 'VEC4' && rotation.componentType === 5122 && rotation.normalized,
      'PRODUCTION_ROTATION_STORAGE_MISMATCH', `${path}: ROTATION must be normalized Int16 VEC4`)
    requireCondition(scale.type === 'VEC3' && scale.componentType === 5126 && !scale.normalized,
      'PRODUCTION_SCALE_STORAGE_MISMATCH', `${path}: SCALE must be Float32 VEC3`)
    requireCondition(translation.count === EXPECTED.sourceCount && rotation.count === EXPECTED.sourceCount && scale.count === EXPECTED.sourceCount,
      'PRODUCTION_INSTANCE_COUNT_MISMATCH', `${path}: expected 78 instances`)
    const slotMatrices = Array.from({ length: EXPECTED.sourceCount }, (_, index) => composeTrs(
      [0, 1, 2].map((axis) => normalizedAccessorValue(translation, index, axis)),
      [0, 1, 2, 3].map((axis) => normalizedAccessorValue(rotation, index, axis)),
      [0, 1, 2].map((axis) => normalizedAccessorValue(scale, index, axis)),
    ))
    if (canonicalMatrices === null) canonicalMatrices = slotMatrices
    else {
      for (let index = 0; index < EXPECTED.sourceCount; index += 1) {
        requireCondition(matrixFloat64LEHex(slotMatrices[index]) === matrixFloat64LEHex(canonicalMatrices[index]),
          'PRODUCTION_INSTANCE_BATCH_TRANSFORM_MISMATCH', `${path}: instance ${index} differs from slot 0`)
      }
    }

    const mesh = productionGlb.document.meshes?.[node.mesh]
    requireCondition(mesh?.primitives?.length === 1, 'PRODUCTION_PRIMITIVE_COUNT_MISMATCH', `${path} must contain one primitive`)
    const primitive = mesh.primitives[0]
    requireCondition((primitive.mode ?? 4) === 4 && Number.isSafeInteger(primitive.indices),
      'PRODUCTION_PRIMITIVE_TOPOLOGY_INVALID', `${path} must be indexed TRIANGLES`)
    requireCondition(exactJson(Object.keys(primitive.attributes ?? {}), ['POSITION', 'NORMAL']),
      'PRODUCTION_PRIMITIVE_ATTRIBUTES_INVALID', `${path} must contain ordered POSITION/NORMAL attributes`)
    const position = productionGlb.decodeAccessor(primitive.attributes.POSITION, `${path}/POSITION`)
    const normal = productionGlb.decodeAccessor(primitive.attributes.NORMAL, `${path}/NORMAL`)
    const indices = productionGlb.decodeAccessor(primitive.indices, `${path}/indices`)
    requireCondition(position.type === 'VEC3' && position.componentType === 5126 && !position.normalized,
      'PRODUCTION_POSITION_STORAGE_MISMATCH', `${path}: POSITION storage changed`)
    requireCondition(normal.type === 'VEC3' && normal.componentType === 5122 && normal.normalized,
      'PRODUCTION_NORMAL_STORAGE_MISMATCH', `${path}: NORMAL storage changed`)
    requireCondition(indices.type === 'SCALAR' && indices.componentType === 5123 && !indices.normalized && indices.count % 3 === 0,
      'PRODUCTION_INDEX_STORAGE_MISMATCH', `${path}: index storage changed`)
    const material = decodedMaterialRecord(productionGlb.document, primitive.material)
    materialRecords.push(material)
    requireCondition(material.name === sourceAudit.identification?.nodes?.[slot]?.material?.name,
      'PRODUCTION_MATERIAL_SLOT_MISMATCH', `${path}: material role changed`)
    const triangles = indices.count / 3
    trianglesByMaterial[material.name] = triangles
    for (let triangle = 0; triangle < triangles; triangle += 1) {
      globalRecords.push(triangleSignature(indices, position, normal, slot, triangle))
    }
  }
  globalRecords.sort()
  return {
    canonicalMatrices,
    geometry: {
      triangleCount: globalRecords.length,
      trianglesByMaterial,
      canonicalOrientedGeometrySha256: sha256(Buffer.from(globalRecords.join('\n'))),
    },
    materials: materialRecords.map((record) => ({ record, sha256: stableSha256(record) })),
  }
}

function auditGeometry(glb, ownership) {
  const { document, decodeAccessor } = glb
  const activeSceneIndex = document.scene ?? 0
  const activeScene = document.scenes?.[activeSceneIndex]
  requireCondition(activeScene && Array.isArray(activeScene.nodes), 'GLB_ACTIVE_SCENE_INVALID', 'active scene/root list is missing')
  const meshNodes = (document.nodes ?? []).map((node, index) => ({ node, index })).filter(({ node }) => Number.isSafeInteger(node.mesh))
  requireCondition(meshNodes.length === EXPECTED.segmentCount, 'GLB_SEGMENT_NODE_COUNT_MISMATCH', `expected 6 mesh nodes, found ${meshNodes.length}`)
  requireCondition(activeScene.nodes.length === EXPECTED.segmentCount &&
    activeScene.nodes.every((index) => meshNodes.some((entry) => entry.index === index)),
  'GLB_ACTIVE_SEGMENTS_MISMATCH', 'all and only six segment nodes must be active scene roots')
  requireCondition(Array.isArray(ownership.materialRoles) && ownership.materialRoles.length === EXPECTED.materialCount,
    'OWNERSHIP_MATERIAL_ROLES_INVALID', 'ownership must declare four ordered material roles')

  const records = []
  const segmentAudits = []
  const materialRecords = new Array(EXPECTED.materialCount)
  const trianglesByMaterial = Object.fromEntries(ownership.materialRoles.map((name) => [name, 0]))
  for (const { node } of meshNodes.sort((left, right) => left.node.extras?.segment - right.node.extras?.segment)) {
    const segmentId = node.extras?.segment
    requireCondition(Number.isInteger(segmentId) && segmentId >= 0 && segmentId < EXPECTED.segmentCount,
      'GLB_SEGMENT_ID_INVALID', `${node.name ?? '(unnamed)'} has invalid segment identity`)
    requireCondition(numericTupleExact(nodeLocalMatrix(node), IDENTITY), 'GLB_SEGMENT_HOST_NOT_IDENTITY', `segment ${segmentId} host is not identity`)
    const mesh = document.meshes?.[node.mesh]
    requireCondition(mesh && Array.isArray(mesh.primitives) && mesh.primitives.length === EXPECTED.materialCount,
      'GLB_SEGMENT_PRIMITIVE_COUNT_MISMATCH', `segment ${segmentId} must contain four primitives`)
    const segmentRecords = []
    const bounds = emptyBounds()
    const segmentMaterialCounts = {}
    let segmentTriangles = 0
    for (const [slot, primitive] of mesh.primitives.entries()) {
      requireCondition((primitive.mode ?? 4) === 4, 'GLB_PRIMITIVE_MODE_INVALID', `segment ${segmentId}/slot ${slot} is not TRIANGLES`)
      requireCondition(exactJson(Object.keys(primitive.attributes ?? {}).sort(), ['NORMAL', 'POSITION']),
        'GLB_PRIMITIVE_ATTRIBUTES_INVALID', `segment ${segmentId}/slot ${slot} must contain only POSITION and NORMAL`)
      requireCondition(Number.isSafeInteger(primitive.indices), 'GLB_INDEX_ACCESSOR_MISSING', `segment ${segmentId}/slot ${slot} is unindexed`)
      const position = decodeAccessor(primitive.attributes.POSITION, `segment ${segmentId}/slot ${slot}/POSITION`)
      const normal = decodeAccessor(primitive.attributes.NORMAL, `segment ${segmentId}/slot ${slot}/NORMAL`)
      const indices = decodeAccessor(primitive.indices, `segment ${segmentId}/slot ${slot}/indices`)
      requireCondition(position.type === 'VEC3' && position.componentType === 5126 && position.normalized === false,
        'GLB_POSITION_STORAGE_CONTRACT_MISMATCH', `segment ${segmentId}/slot ${slot}: POSITION must be non-normalized Float32 VEC3`)
      requireCondition(normal.type === 'VEC3' && normal.componentType === 5122 && normal.normalized === true,
        'GLB_NORMAL_STORAGE_CONTRACT_MISMATCH', `segment ${segmentId}/slot ${slot}: NORMAL must be normalized Int16 VEC3`)
      requireCondition(indices.type === 'SCALAR' && indices.componentType === 5123 && indices.normalized === false,
        'GLB_INDEX_STORAGE_CONTRACT_MISMATCH', `segment ${segmentId}/slot ${slot}: indices must be Uint16 SCALAR`)
      requireCondition(position.count === normal.count, 'GLB_VERTEX_COUNT_MISMATCH', `segment ${segmentId}/slot ${slot}: POSITION/NORMAL counts differ`)
      requireCondition(indices.count % 3 === 0, 'GLB_TRIANGLE_INDEX_COUNT_INVALID', `segment ${segmentId}/slot ${slot}: index count is not divisible by three`)
      const material = document.materials?.[primitive.material]?.name
      requireCondition(material === ownership.materialRoles[slot], 'GLB_MATERIAL_SLOT_MISMATCH',
        `segment ${segmentId}/slot ${slot}: expected ${ownership.materialRoles[slot]}, found ${material ?? '(missing)'}`)
      const materialRecord = decodedMaterialRecord(document, primitive.material)
      if (materialRecords[slot] === undefined) materialRecords[slot] = materialRecord
      else requireCondition(stableStringify(materialRecords[slot]) === stableStringify(materialRecord),
        'GLB_SEGMENT_MATERIAL_RECORD_MISMATCH', `segment ${segmentId}/slot ${slot}: material record differs across segments`)
      const triangleCount = indices.count / 3
      segmentTriangles += triangleCount
      segmentMaterialCounts[material] = triangleCount
      trianglesByMaterial[material] += triangleCount
      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const signature = triangleSignature(indices, position, normal, slot, triangle)
        records.push(signature)
        segmentRecords.push(signature)
        for (let corner = 0; corner < 3; corner += 1) {
          const vertex = indices.value(triangle * 3 + corner)
          requireCondition(vertex < position.count, 'GLB_INDEX_OUT_OF_RANGE', `segment ${segmentId}/slot ${slot}: index ${vertex} escapes POSITION`)
          const point = [position.value(vertex, 0), position.value(vertex, 1), position.value(vertex, 2)]
          requireCondition(point.every(Number.isFinite), 'GLB_POSITION_NON_FINITE', `segment ${segmentId}/slot ${slot}: non-finite POSITION`)
          expandPoint(bounds, point)
        }
      }
    }
    segmentRecords.sort()
    segmentAudits.push({
      segmentId,
      nodeName: node.name ?? null,
      stations: node.extras?.stations,
      triangles: segmentTriangles,
      trianglesByMaterial: segmentMaterialCounts,
      measuredReferencedAccessorBounds: bounds,
      canonicalOrientedGeometrySha256: sha256(Buffer.from(segmentRecords.join('\n'))),
    })
  }
  segmentAudits.sort((left, right) => left.segmentId - right.segmentId)
  requireCondition(exactJson(segmentAudits.map((segment) => segment.segmentId), [0, 1, 2, 3, 4, 5]),
    'GLB_SEGMENT_ORDER_INVALID', 'decoded segment IDs must be exactly 0..5')
  records.sort()
  return {
    triangleCount: records.length,
    materialSlots: ownership.materialRoles.length,
    primitiveCount: segmentAudits.length * ownership.materialRoles.length,
    trianglesByMaterial,
    materials: materialRecords.map((record) => ({ record, sha256: stableSha256(record) })),
    canonicalOrientedGeometrySha256: sha256(Buffer.from(records.join('\n'))),
    segments: segmentAudits,
    contract: 'material slot plus exact raw Float32 POSITION and normalized Int16 NORMAL storage bits plus oriented triangle winding; triangle order ignored',
  }
}

function decodeCohortTable(bytes) {
  requireCondition(Buffer.isBuffer(bytes), 'COHORT_BIN_INPUT_INVALID', 'cohort table must be a Buffer')
  requireCondition(bytes.length >= EXPECTED.tableHeaderBytes, 'COHORT_BIN_TRUNCATED', 'cohort table is shorter than its fixed header')
  requireCondition(bytes.subarray(0, 8).toString('ascii') === EXPECTED.tableMagic,
    'COHORT_BIN_MAGIC_MISMATCH', `expected ${EXPECTED.tableMagic}`)
  requireCondition(bytes.readUInt32LE(8) === EXPECTED.tableVersion, 'COHORT_BIN_VERSION_MISMATCH', 'expected table version 2')
  const sourceCount = bytes.readUInt32LE(12)
  const segmentCount = bytes.readUInt32LE(16)
  const unitCount = bytes.readUInt32LE(20)
  requireCondition(sourceCount === EXPECTED.sourceCount, 'COHORT_BIN_SOURCE_COUNT_MISMATCH', `expected 78, found ${sourceCount}`)
  requireCondition(segmentCount === EXPECTED.segmentCount, 'COHORT_BIN_SEGMENT_COUNT_MISMATCH', `expected 6, found ${segmentCount}`)
  requireCondition(unitCount === EXPECTED.unitCount, 'COHORT_BIN_UNIT_COUNT_MISMATCH', `expected 468, found ${unitCount}`)
  const canonicalOffset = bytes.readUInt32LE(24)
  const canonicalStride = bytes.readUInt32LE(28)
  const renderOffset = bytes.readUInt32LE(32)
  const renderStride = bytes.readUInt32LE(36)
  const boundsOffset = bytes.readUInt32LE(40)
  const boundsStride = bytes.readUInt32LE(44)
  const keysOffset = bytes.readUInt32LE(48)
  const keysStride = bytes.readUInt32LE(52)
  const totalBytes = bytes.readUInt32LE(56)
  requireCondition(bytes.readUInt32LE(60) === 0x01020304, 'COHORT_BIN_ENDIAN_MARKER_MISMATCH', 'little-endian marker changed')
  requireCondition(bytes.subarray(64, 80).every((value) => value === 0), 'COHORT_BIN_RESERVED_HEADER_NONZERO', 'reserved header bytes must remain zero')
  requireCondition(canonicalOffset === EXPECTED.tableHeaderBytes && canonicalStride === EXPECTED.matrixStrideBytes,
    'COHORT_BIN_CANONICAL_LAYOUT_MISMATCH', 'canonical matrix layout changed')
  requireCondition(renderOffset === canonicalOffset + sourceCount * canonicalStride && renderStride === EXPECTED.matrixStrideBytes,
    'COHORT_BIN_RENDER_LAYOUT_MISMATCH', 'render-local matrix layout changed')
  requireCondition(boundsOffset === renderOffset + sourceCount * renderStride && boundsStride === EXPECTED.boundsStrideBytes,
    'COHORT_BIN_BOUNDS_LAYOUT_MISMATCH', 'unit bounds layout changed')
  requireCondition(keysOffset === boundsOffset + unitCount * boundsStride && keysStride === EXPECTED.keyStrideBytes,
    'COHORT_BIN_KEYS_LAYOUT_MISMATCH', 'source/segment key layout changed')
  requireCondition(totalBytes === keysOffset + unitCount * keysStride && totalBytes === bytes.length,
    'COHORT_BIN_TOTAL_LENGTH_MISMATCH', 'table length formula or physical length changed')

  const readMatrix = (base) => Array.from({ length: 16 }, (_, index) => bytes.readDoubleLE(base + index * 8))
  const canonicalMatrices = Array.from({ length: sourceCount }, (_, index) => readMatrix(canonicalOffset + index * canonicalStride))
  const renderLocalMatrices = Array.from({ length: sourceCount }, (_, index) => readMatrix(renderOffset + index * renderStride))
  const bounds = Array.from({ length: unitCount }, (_, index) => {
    const base = boundsOffset + index * boundsStride
    const values = Array.from({ length: 6 }, (_, component) => bytes.readDoubleLE(base + component * 8))
    requireCondition(values.every(Number.isFinite), 'COHORT_BIN_NON_FINITE_BOUND', `unit ${index} contains a non-finite bound`)
    requireCondition(values.slice(3).every((value, axis) => value > values[axis]),
      'COHORT_BIN_INVALID_BOUND', `unit ${index} max must be greater than min`)
    return { min: values.slice(0, 3), max: values.slice(3) }
  })
  const keys = Array.from({ length: unitCount }, (_, index) => {
    const base = keysOffset + index * keysStride
    return { sourceIndex: bytes.readUInt32LE(base), segmentIndex: bytes.readUInt32LE(base + 4) }
  })
  keys.forEach((key, index) => {
    requireCondition(key.sourceIndex === Math.floor(index / segmentCount) && key.segmentIndex === index % segmentCount,
      'COHORT_BIN_KEY_ORDER_MISMATCH', `unit ${index} violates source-major/segment-major order`)
  })
  requireCondition(new Set(keys.map((key) => `${key.sourceIndex}:${key.segmentIndex}`)).size === unitCount,
    'COHORT_BIN_DUPLICATE_KEY', 'source/segment keys are not unique')
  requireCondition(canonicalMatrices.flat().every(Number.isFinite) && renderLocalMatrices.flat().every(Number.isFinite),
    'COHORT_BIN_NON_FINITE_MATRIX', 'matrix table contains non-finite values')
  return {
    layout: {
      magic: EXPECTED.tableMagic,
      version: EXPECTED.tableVersion,
      endianness: 'little',
      headerBytes: EXPECTED.tableHeaderBytes,
      sourceCount,
      segmentCount,
      unitCount,
      canonicalOffset,
      canonicalStride,
      renderOffset,
      renderStride,
      boundsOffset,
      boundsStride,
      keysOffset,
      keysStride,
      totalBytes,
    },
    canonicalMatrices,
    renderLocalMatrices,
    bounds,
    keys,
  }
}

function expandClosedBounds(bounds, margin) {
  return { min: bounds.min.map((value) => value - margin), max: bounds.max.map((value) => value + margin) }
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
    this.build(1, 0, size - 1)
  }

  build(node, left, right) {
    if (left === right) {
      this.arg[node] = left
      return
    }
    const middle = (left + right) >> 1
    this.build(node * 2, left, middle)
    this.build(node * 2 + 1, middle + 1, right)
    this.arg[node] = this.arg[node * 2]
  }

  apply(node, value) {
    this.max[node] += value
    this.lazy[node] += value
  }

  pull(node) {
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
      this.apply(node, value)
      return
    }
    const middle = (left + right) >> 1
    if (queryLeft <= middle) this.add(queryLeft, queryRight, value, node * 2, left, middle)
    if (queryRight > middle) this.add(queryLeft, queryRight, value, node * 2 + 1, middle + 1, right)
    this.pull(node)
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
    selectedSourceCount: new Set(selected.map((unit) => unit.sourceIndex)).size,
    activeParitySegmentGroups: groups.size,
    activeDraws: groups.size * materialDrawsPerGroup,
  }
}

/** Independently recompute the exact weighted overlap of closed AABBs. */
function maxWeightedClosedAabbOverlap(units, margin, materialDrawsPerGroup) {
  const boxes = units.map((unit) => ({ unit, bounds: expandClosedBounds(unit.bounds, margin), weight: unit.triangles }))
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
        best = { triangles: candidate.value, point: [xEvent.coordinate, yEvent.coordinate, zCoordinates[candidate.index]] }
      }
      for (const box of yEvent.ends) tree.add(zIndex.get(box.bounds.min[2]), zIndex.get(box.bounds.max[2]), -box.weight)
    }
    for (const box of xEvent.ends) activeX.delete(box)
  }
  const summary = summarizeClosedSelection(units, margin, best.point, materialDrawsPerGroup)
  requireCondition(summary.triangles === best.triangles, 'RESIDENT_SWEEP_INTERNAL_MISMATCH', 'computed witness does not recompose the weighted maximum')
  return { ...summary, witness: best.point }
}

/** Independently recompute the exact maximum active parity/segment groups. */
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
          best = { activeParitySegmentGroups, point: [xEvent.coordinate, yEvent.coordinate, zEvent.coordinate] }
          if (activeParitySegmentGroups === possibleGroupCount) {
            return { ...best, maxActiveDraws: activeParitySegmentGroups * materialDrawsPerGroup, possibleGroupCount }
          }
        }
        for (const box of zEvent.ends) activeZ.delete(box)
      }
      for (const box of yEvent.ends) activeY.delete(box)
    }
    for (const box of xEvent.ends) activeX.delete(box)
  }
  return { ...best, maxActiveDraws: best.activeParitySegmentGroups * materialDrawsPerGroup, possibleGroupCount }
}

export function computeIndependentRepeatSixPartManifestDigests(manifest) {
  const sources = Array.isArray(manifest?.catalog?.sources) ? manifest.catalog.sources : []
  const units = Array.isArray(manifest?.catalog?.units) ? manifest.catalog.units : []
  const segments = Array.isArray(manifest?.geometry?.segments) ? manifest.geometry.segments : []
  const payloads = ['geometry', 'cohortTable', 'ownership'].map((key) => {
    const payload = manifest?.payloads?.[key] ?? {}
    return { key, order: payload.order, role: payload.role, mediaType: payload.mediaType, url: payload.url, bytes: payload.bytes, sha256: payload.sha256 }
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

function requireAssetPin(bytes, pin, label) {
  requireCondition(pin && pin.bytes === bytes.length, 'ASSET_BYTE_PIN_MISMATCH', `${label}: declared ${pin?.bytes}, observed ${bytes.length}`)
  const observedSha256 = sha256(bytes)
  requireCondition(pin.sha256 === observedSha256, 'ASSET_SHA256_PIN_MISMATCH', `${label}: declared ${pin.sha256}, observed ${observedSha256}`)
  return { bytes: bytes.length, sha256: observedSha256 }
}

function requireHardPin(bytes, expectedBytes, expectedSha256, label) {
  requireCondition(bytes.length === expectedBytes, 'IMMUTABLE_BYTE_PIN_MISMATCH', `${label}: expected ${expectedBytes}, observed ${bytes.length}`)
  const observedSha256 = sha256(bytes)
  requireCondition(observedSha256 === expectedSha256, 'IMMUTABLE_SHA256_PIN_MISMATCH', `${label}: expected ${expectedSha256}, observed ${observedSha256}`)
  return { bytes: bytes.length, sha256: observedSha256 }
}

function auditProductionOwner(productionGlb, manifest, sourceMap, sourceAudit) {
  const document = productionGlb.document
  const matches = (document.nodes ?? []).map((node, index) => ({ node, index }))
    .filter(({ node }) => node.name === EXPECTED.ownerNodeName)
  requireCondition(matches.length === 1, 'PRODUCTION_OWNER_COUNT_MISMATCH', `expected one ${EXPECTED.ownerNodeName} node, found ${matches.length}`)
  const owner = matches[0]
  const sceneIndex = document.scene ?? 0
  const roots = document.scenes?.[sceneIndex]?.nodes ?? []
  const rootIndex = roots.indexOf(owner.index)
  requireCondition(rootIndex >= 0, 'PRODUCTION_OWNER_NOT_SCENE_ROOT', 'owner is not a root of the active scene')
  const activeScenePath = `scene/${sceneIndex}/${rootIndex}`
  requireCondition(activeScenePath === 'scene/0/400', 'PRODUCTION_OWNER_PATH_MISMATCH', `expected scene/0/400, found ${activeScenePath}`)
  const matrix = nodeLocalMatrix(owner.node)
  requireCondition(numericTupleExact(matrix, IDENTITY), 'PRODUCTION_OWNER_MATRIX_MISMATCH', 'owner rest matrix is not exactly identity')
  const animationChannels = (document.animations ?? []).flatMap((animation) => animation.channels ?? [])
    .filter((channel) => channel.target?.node === owner.index).length
  requireCondition(animationChannels === 0, 'PRODUCTION_OWNER_ANIMATED', `owner has ${animationChannels} animation channels`)
  requireCondition(manifest.owner?.nodeName === EXPECTED.ownerNodeName && manifest.sourcePins?.owner?.nodeName === EXPECTED.ownerNodeName,
    'MANIFEST_OWNER_NAME_MISMATCH', 'manifest owner name differs from decoded production owner')
  requireCondition(manifest.sourcePins.owner.activeScenePath === activeScenePath && manifest.sourcePins.owner.sceneRoot === true &&
    manifest.sourcePins.owner.identityRestMatrix === true && manifest.sourcePins.owner.animationChannels === animationChannels &&
    numericTupleExact(manifest.sourcePins.owner.matrix, matrix),
  'MANIFEST_OWNER_BASIS_MISMATCH', 'manifest owner basis differs from decoded production owner')
  requireCondition(sourceMap.owner?.nodeName === EXPECTED.ownerNodeName && sourceMap.owner?.descendantPath === 'Ground Floor.BT_3' &&
    sourceMap.owner?.attachmentSpace === 'owner-local' && numericTupleExact(sourceMap.productionNodeWorldMatrix, IDENTITY),
  'SOURCE_MAP_OWNER_BASIS_MISMATCH', 'source-map owner contract differs from decoded production owner')
  const audited = sourceAudit.identification?.intendedOwnerRestBasis
  requireCondition(audited?.nodeName === EXPECTED.ownerNodeName && audited?.activeScenePath === activeScenePath &&
    audited?.sceneRoot === true && audited?.identityRestMatrix === true && audited?.animationChannels === animationChannels,
  'SOURCE_AUDIT_OWNER_BASIS_MISMATCH', 'direct-production audit owner basis is stale')
  return { nodeIndex: owner.index, activeScenePath, identityRestMatrix: true, animationChannels }
}

function expectedBinaryTableMetadata(layout) {
  return {
    magic: EXPECTED.tableMagic,
    version: EXPECTED.tableVersion,
    endianness: 'little',
    numericContract: 'canonical matrices, parity-safe render-local matrices, and bounds are IEEE-754 Float64; keys are Uint32',
    headerBytes: EXPECTED.tableHeaderBytes,
    sourceCount: EXPECTED.sourceCount,
    segmentCount: EXPECTED.segmentCount,
    unitCount: EXPECTED.unitCount,
    canonicalMatrices: { offsetBytes: layout.canonicalOffset, strideBytes: layout.canonicalStride, count: EXPECTED.sourceCount, components: 16 },
    renderLocalMatrices: { offsetBytes: layout.renderOffset, strideBytes: layout.renderStride, count: EXPECTED.sourceCount, components: 16 },
    bounds: { offsetBytes: layout.boundsOffset, strideBytes: layout.boundsStride, count: EXPECTED.unitCount, order: ['minX', 'minY', 'minZ', 'maxX', 'maxY', 'maxZ'] },
    keys: { offsetBytes: layout.keysOffset, strideBytes: layout.keysStride, count: EXPECTED.unitCount, order: ['sourceId', 'segmentId'] },
    totalBytes: layout.totalBytes,
  }
}

function requireExactKeys(value, keys, code, label) {
  requireCondition(value !== null && typeof value === 'object' && !Array.isArray(value), code, `${label} must be an object`)
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  requireCondition(exactJson(actual, expected), code,
    `${label} keys differ; expected [${expected.join(', ')}], found [${actual.join(', ')}]`)
}

function requireStableEqual(actual, expected, code, label) {
  requireCondition(stableStringify(actual) === stableStringify(expected), code, `${label} differs from the exact dormant v4 contract`)
}

function validateStrictManifestContract(manifest) {
  requireExactKeys(manifest, [
    'schema', 'version', 'enabled', 'modelId', 'platform', 'units', 'mode', 'capabilities', 'owner', 'sourcePins',
    'payloads', 'geometry', 'parity', 'selector', 'catalog', 'digests', 'budgets', 'proof', 'gates',
  ], 'MANIFEST_TOP_LEVEL_KEYS_MISMATCH', 'manifest')

  requireExactKeys(manifest.owner, ['id', 'nodeName'], 'MANIFEST_OWNER_KEYS_MISMATCH', 'manifest.owner')
  requireStableEqual(manifest.owner, MANIFEST_POLICY.owner, 'MANIFEST_OWNER_CONTRACT_MISMATCH', 'manifest.owner')
  requireExactKeys(manifest.capabilities, Object.keys(MANIFEST_POLICY.capabilities),
    'MANIFEST_CAPABILITY_KEYS_MISMATCH', 'manifest.capabilities')
  requireStableEqual(manifest.capabilities, MANIFEST_POLICY.capabilities,
    'MANIFEST_CAPABILITY_CONTRACT_MISMATCH', 'manifest.capabilities')

  requireExactKeys(manifest.sourcePins, [
    'modelId', 'productionModel', 'directProductionGeometry', 'directProductionSourceMap', 'directProductionPhysicalAudit', 'owner',
  ], 'MANIFEST_SOURCE_PIN_KEYS_MISMATCH', 'manifest.sourcePins')
  requireCondition(manifest.sourcePins.modelId === EXPECTED.modelId, 'MANIFEST_SOURCE_MODEL_ID_MISMATCH', 'sourcePins.modelId changed')
  requireExactKeys(manifest.sourcePins.productionModel, ['relativePath', 'bytes', 'sha256'],
    'MANIFEST_PRODUCTION_PIN_KEYS_MISMATCH', 'manifest.sourcePins.productionModel')
  requireCondition(manifest.sourcePins.productionModel.relativePath === '../public/models/icm-anim-2025/model-web.glb',
    'MANIFEST_PRODUCTION_PIN_PATH_MISMATCH', 'production model relative path changed')
  for (const [key, expectedPath] of [
    ['directProductionGeometry', 'production-source/exact-six-segment-production-source.glb'],
    ['directProductionPhysicalAudit', 'production-source/physical-audit.json'],
  ]) {
    requireExactKeys(manifest.sourcePins[key], ['path', 'bytes', 'sha256'],
      'MANIFEST_DIRECT_PIN_KEYS_MISMATCH', `manifest.sourcePins.${key}`)
    requireCondition(manifest.sourcePins[key].path === expectedPath,
      'MANIFEST_DIRECT_PIN_PATH_MISMATCH', `manifest.sourcePins.${key}.path changed`)
  }
  requireExactKeys(manifest.sourcePins.directProductionSourceMap, ['path', 'bytes', 'sha256', 'transformSetSha256'],
    'MANIFEST_SOURCE_MAP_PIN_KEYS_MISMATCH', 'manifest.sourcePins.directProductionSourceMap')
  requireCondition(manifest.sourcePins.directProductionSourceMap.path === 'production-source/production-source-map.json',
    'MANIFEST_SOURCE_MAP_PIN_PATH_MISMATCH', 'direct-production source-map path changed')
  requireExactKeys(manifest.sourcePins.owner, [
    'nodeName', 'descendantPath', 'activeScenePath', 'attachmentSpace', 'sceneRoot', 'identityRestMatrix', 'animationChannels', 'matrix',
  ], 'MANIFEST_SOURCE_OWNER_KEYS_MISMATCH', 'manifest.sourcePins.owner')
  requireCondition(manifest.sourcePins.owner.nodeName === EXPECTED.ownerNodeName &&
    manifest.sourcePins.owner.descendantPath === 'Ground Floor.BT_3' &&
    manifest.sourcePins.owner.activeScenePath === 'scene/0/400' &&
    manifest.sourcePins.owner.attachmentSpace === 'owner-local' &&
    manifest.sourcePins.owner.sceneRoot === true && manifest.sourcePins.owner.identityRestMatrix === true &&
    manifest.sourcePins.owner.animationChannels === 0,
  'MANIFEST_SOURCE_OWNER_CONTRACT_MISMATCH', 'manifest source owner identity/basis changed')

  requireExactKeys(manifest.payloads, ['geometry', 'cohortTable', 'ownership'],
    'MANIFEST_PAYLOAD_KEYS_MISMATCH', 'manifest.payloads')
  const payloadContracts = {
    geometry: {
      order: 0,
      role: 'exact-six-segment-geometry',
      mediaType: 'model/gltf-binary',
      url: '/tmp/repeat-six-part-exact-pilot/payloads/shared/exact-six-segment-geometry.glb',
    },
    cohortTable: {
      order: 1,
      role: 'exact-six-segment-cohort-table',
      mediaType: 'application/octet-stream',
      url: '/tmp/repeat-six-part-exact-pilot/payloads/web/exact-six-segment-cohort.bin',
    },
    ownership: {
      order: 2,
      role: 'exact-six-segment-ownership',
      mediaType: 'application/json',
      url: '/tmp/repeat-six-part-exact-pilot/payloads/web/exact-six-segment-ownership.json',
    },
  }
  for (const [key, contract] of Object.entries(payloadContracts)) {
    const payload = manifest.payloads[key]
    requireExactKeys(payload, ['order', 'role', 'mediaType', 'url', 'bytes', 'sha256'],
      'MANIFEST_PAYLOAD_RECORD_KEYS_MISMATCH', `manifest.payloads.${key}`)
    for (const [field, expected] of Object.entries(contract)) {
      requireCondition(payload[field] === expected, 'MANIFEST_PAYLOAD_CONTRACT_MISMATCH',
        `manifest.payloads.${key}.${field} must equal ${expected}`)
    }
  }

  requireExactKeys(manifest.geometry, [
    'sourceRowTriangles', 'materialSlots', 'physicalPrimitiveCount', 'canonicalGeometryDigestSha256',
    'exactTriangleMaterialBijection', 'exactPositionBits', 'exactNormalBits', 'exactWinding', 'segments',
  ], 'MANIFEST_GEOMETRY_KEYS_MISMATCH', 'manifest.geometry')
  for (const key of ['exactTriangleMaterialBijection', 'exactPositionBits', 'exactNormalBits', 'exactWinding']) {
    requireCondition(manifest.geometry[key] === true, 'MANIFEST_GEOMETRY_FLAG_MISMATCH', `manifest.geometry.${key} must equal true`)
  }
  requireCondition(Array.isArray(manifest.geometry.segments) && manifest.geometry.segments.length === EXPECTED.segmentCount,
    'MANIFEST_SEGMENT_COUNT_MISMATCH', 'manifest geometry must contain six segments')
  manifest.geometry.segments.forEach((segment, index) => {
    requireExactKeys(segment, ['index', 'id', 'triangles', 'materialPrimitiveCount', 'bounds'],
      'MANIFEST_SEGMENT_KEYS_MISMATCH', `manifest.geometry.segments[${index}]`)
    requireExactKeys(segment.bounds, ['space', 'min', 'max'], 'MANIFEST_SEGMENT_BOUND_KEYS_MISMATCH',
      `manifest.geometry.segments[${index}].bounds`)
    requireCondition(segment.index === index && segment.id === `segment-${String(index).padStart(2, '0')}` &&
      segment.materialPrimitiveCount === EXPECTED.materialCount && segment.bounds.space === 'source-row-local',
    'MANIFEST_SEGMENT_IDENTITY_MISMATCH', `manifest segment ${index} identity/layout changed`)
  })

  requireExactKeys(manifest.parity, [
    'canonicalMatrixSpace', 'renderLocalMatrixSpace', 'composition', 'requirePositiveRenderLocalDeterminant', 'epsilon',
    'hosts', 'materialDrawsPerActiveGroup', 'possibleGroupCount', 'persistentRendererTemplates',
  ], 'MANIFEST_PARITY_KEYS_MISMATCH', 'manifest.parity')
  requireExactKeys(manifest.parity.hosts, ['positive', 'mirrored'], 'MANIFEST_PARITY_HOST_KEYS_MISMATCH', 'manifest.parity.hosts')
  for (const parity of ['positive', 'mirrored']) {
    requireExactKeys(manifest.parity.hosts[parity], ['space', 'matrix'], 'MANIFEST_PARITY_HOST_RECORD_KEYS_MISMATCH',
      `manifest.parity.hosts.${parity}`)
  }
  requireCondition(manifest.parity.canonicalMatrixSpace === 'owner-local' &&
    manifest.parity.renderLocalMatrixSpace === 'parity-host-local' && manifest.parity.composition === 'host-times-render-local' &&
    manifest.parity.requirePositiveRenderLocalDeterminant === true && manifest.parity.epsilon === EXPECTED.epsilon &&
    manifest.parity.hosts.positive.space === 'owner-local' && manifest.parity.hosts.mirrored.space === 'owner-local' &&
    manifest.parity.materialDrawsPerActiveGroup === EXPECTED.materialCount && manifest.parity.possibleGroupCount === 12 &&
    manifest.parity.persistentRendererTemplates === 48,
  'MANIFEST_PARITY_POLICY_MISMATCH', 'manifest parity spaces/composition/counts changed')

  requireExactKeys(manifest.selector, Object.keys(MANIFEST_POLICY.selector),
    'MANIFEST_SELECTOR_KEYS_MISMATCH', 'manifest.selector')
  requireStableEqual(manifest.selector, MANIFEST_POLICY.selector,
    'MANIFEST_SELECTOR_POLICY_MISMATCH', 'manifest.selector')

  requireExactKeys(manifest.catalog, ['order', 'defaultState', 'sources', 'units'],
    'MANIFEST_CATALOG_KEYS_MISMATCH', 'manifest.catalog')
  requireCondition(manifest.catalog.order === 'source-major-segment-major' && manifest.catalog.defaultState === 'culled',
    'MANIFEST_CATALOG_POLICY_MISMATCH', 'manifest catalog order/default state changed')
  requireCondition(Array.isArray(manifest.catalog.sources) && manifest.catalog.sources.length === EXPECTED.sourceCount &&
    Array.isArray(manifest.catalog.units) && manifest.catalog.units.length === EXPECTED.unitCount,
  'MANIFEST_CATALOG_COUNT_MISMATCH', 'manifest catalog source/unit counts changed')
  manifest.catalog.sources.forEach((source, index) => {
    requireExactKeys(source, ['index', 'id', 'path', 'parity', 'canonicalMatrix', 'renderLocalMatrix', 'bounds'],
      'MANIFEST_SOURCE_KEYS_MISMATCH', `manifest.catalog.sources[${index}]`)
    requireExactKeys(source.canonicalMatrix, ['space', 'matrix'], 'MANIFEST_SOURCE_MATRIX_KEYS_MISMATCH',
      `manifest.catalog.sources[${index}].canonicalMatrix`)
    requireExactKeys(source.renderLocalMatrix, ['space', 'matrix'], 'MANIFEST_SOURCE_MATRIX_KEYS_MISMATCH',
      `manifest.catalog.sources[${index}].renderLocalMatrix`)
    requireExactKeys(source.bounds, ['space', 'min', 'max'], 'MANIFEST_SOURCE_BOUND_KEYS_MISMATCH',
      `manifest.catalog.sources[${index}].bounds`)
    requireCondition(source.canonicalMatrix.space === 'owner-local' && source.renderLocalMatrix.space === 'parity-host-local' &&
      source.bounds.space === 'owner-local', 'MANIFEST_SOURCE_SPACE_MISMATCH', `manifest source ${index} spaces changed`)
  })
  manifest.catalog.units.forEach((unit, index) => {
    requireExactKeys(unit, ['index', 'id', 'sourceIndex', 'sourceId', 'segmentIndex', 'segmentId', 'bounds', 'triangles'],
      'MANIFEST_UNIT_KEYS_MISMATCH', `manifest.catalog.units[${index}]`)
    requireExactKeys(unit.bounds, ['space', 'min', 'max'], 'MANIFEST_UNIT_BOUND_KEYS_MISMATCH',
      `manifest.catalog.units[${index}].bounds`)
    requireCondition(unit.bounds.space === 'owner-local', 'MANIFEST_UNIT_SPACE_MISMATCH', `manifest unit ${index} bounds space changed`)
  })

  const digestKeys = [
    'sourcePinsSha256', 'sourceIdsSha256', 'sourcePathsSha256', 'canonicalMatricesSha256', 'renderLocalMatricesSha256',
    'sourceIdentitySha256', 'unitIdentitySha256', 'unitBoundsSha256', 'geometrySegmentsSha256', 'payloadPinsSha256',
  ]
  requireExactKeys(manifest.digests, digestKeys, 'MANIFEST_DIGEST_KEYS_MISMATCH', 'manifest.digests')
  requireExactKeys(manifest.budgets, Object.keys(MANIFEST_POLICY.budgets),
    'MANIFEST_BUDGET_KEYS_MISMATCH', 'manifest.budgets')
  requireStableEqual(manifest.budgets, MANIFEST_POLICY.budgets,
    'MANIFEST_BUDGET_POLICY_MISMATCH', 'manifest.budgets')

  requireExactKeys(manifest.proof, [
    'residentSweep', 'activeDrawSweep', 'transition', 'persistentRendererTemplates', 'payloadOnlyRequests', 'payloadOnlyBytes',
    'manifestRequests', 'manifestBytes', 'coldContractRequests', 'coldContractBytes',
  ], 'MANIFEST_PROOF_KEYS_MISMATCH', 'manifest.proof')
  requireExactKeys(manifest.proof.residentSweep, [
    'method', 'marginMeters', 'maxSelectedTriangles', 'totalWithReservationTriangles', 'selectedUnitCount', 'activeDraws', 'witness',
  ], 'MANIFEST_RESIDENT_PROOF_KEYS_MISMATCH', 'manifest.proof.residentSweep')
  requireExactKeys(manifest.proof.activeDrawSweep, ['method', 'maxActiveDraws', 'activeParitySegmentGroups', 'witness'],
    'MANIFEST_DRAW_PROOF_KEYS_MISMATCH', 'manifest.proof.activeDrawSweep')
  requireExactKeys(manifest.proof.transition, [
    'model', 'oneRowArithmeticRepeatTriangles', 'oneRowArithmeticTotalWithReservationTriangles',
    'unorderedDoubleBufferRepeatTriangles', 'unorderedDoubleBufferTotalWithReservationTriangles',
    'arbitraryConcurrentOverlapProven', 'runtimeOrderingEnforced',
  ], 'MANIFEST_TRANSITION_PROOF_KEYS_MISMATCH', 'manifest.proof.transition')
  requireCondition(manifest.proof.residentSweep.method === 'exact-closed-aabb-endpoint-sweep' &&
    manifest.proof.activeDrawSweep.method === 'exact-closed-aabb-endpoint-sweep' &&
    manifest.proof.transition.model === 'ordered-one-row-or-unordered-double-buffer' &&
    manifest.proof.transition.arbitraryConcurrentOverlapProven === false &&
    manifest.proof.transition.runtimeOrderingEnforced === false,
  'MANIFEST_PROOF_POLICY_MISMATCH', 'manifest proof method/model/concurrency flags changed')

  requireExactKeys(manifest.gates, Object.keys(MANIFEST_POLICY.gates), 'MANIFEST_GATE_KEYS_MISMATCH', 'manifest.gates')
  requireStableEqual(manifest.gates, MANIFEST_POLICY.gates, 'MANIFEST_GATE_POLICY_MISMATCH', 'manifest.gates')
}

function validateStrictOwnershipContract(ownership) {
  requireExactKeys(ownership, [
    'schema', 'version', 'status', 'platform', 'enabled', 'ready', 'runtimeIntegrated', 'activationApproved',
    'owner', 'ownerContract', 'productionInstancingNodes', 'mesh', 'geometrySpace', 'parityBatchContract',
    'binaryTable', 'sourceCount', 'segmentCount', 'unitCount', 'materialRoles', 'segments', 'instances', 'digests',
  ], 'OWNERSHIP_TOP_LEVEL_KEYS_MISMATCH', 'ownership')
  requireCondition(ownership.status === 'disabled-physical-pilot' && ownership.platform === 'web' &&
    ownership.mesh === 'production-repeat-six-part-shared-geometry' &&
    ownership.geometrySpace === 'production-instancing-local; payload geometry nodes are identity; exact production canonical owner-local row matrices and parity-safe render-local matrices are in cohort table',
  'OWNERSHIP_ROOT_CONTRACT_MISMATCH', 'ownership status/platform/mesh/geometry-space changed')
  requireExactKeys(ownership.ownerContract, ['nodeName', 'descendantPath', 'attachmentSpace'],
    'OWNERSHIP_OWNER_KEYS_MISMATCH', 'ownership.ownerContract')
  requireExactKeys(ownership.parityBatchContract, [
    'directCanonicalMatrixUseInInstancedMeshAllowed', 'reason', 'positive', 'mirrored',
    'renderLocalMatrixContract', 'persistentParitySegmentMaterialTemplates',
  ], 'OWNERSHIP_PARITY_KEYS_MISMATCH', 'ownership.parityBatchContract')
  requireExactKeys(ownership.parityBatchContract.positive, ['hostMatrix', 'hostDeterminant'],
    'OWNERSHIP_PARITY_HOST_KEYS_MISMATCH', 'ownership.parityBatchContract.positive')
  requireExactKeys(ownership.parityBatchContract.mirrored, ['hostMatrix', 'hostDeterminant'],
    'OWNERSHIP_PARITY_HOST_KEYS_MISMATCH', 'ownership.parityBatchContract.mirrored')
  requireCondition(ownership.parityBatchContract.directCanonicalMatrixUseInInstancedMeshAllowed === false &&
    ownership.parityBatchContract.reason === 'Three.js InstancedMesh does not support negatively scaled instance matrices' &&
    numericTupleExact(ownership.parityBatchContract.positive.hostMatrix, IDENTITY) &&
    ownership.parityBatchContract.positive.hostDeterminant === 1 &&
    numericTupleExact(ownership.parityBatchContract.mirrored.hostMatrix, MIRROR_X) &&
    ownership.parityBatchContract.mirrored.hostDeterminant === -1 &&
    ownership.parityBatchContract.renderLocalMatrixContract === 'renderLocal = inverse(host) * canonicalOwnerLocal; every render-local determinant is positive; host * renderLocal exactly recomposes canonicalOwnerLocal' &&
    ownership.parityBatchContract.persistentParitySegmentMaterialTemplates === 48,
  'OWNERSHIP_PARITY_CONTRACT_MISMATCH', 'ownership parity-batch contract contradicts the decoded factorization')
  requireCondition(Array.isArray(ownership.segments) && ownership.segments.length === EXPECTED.segmentCount &&
    Array.isArray(ownership.instances) && ownership.instances.length === EXPECTED.sourceCount,
  'OWNERSHIP_ARRAY_COUNT_MISMATCH', 'ownership segment/instance arrays changed length')
  ownership.segments.forEach((segment, index) => {
    requireExactKeys(segment, ['segmentId', 'stations', 'triangles', 'trianglesByMaterial', 'measuredReferencedAccessorBounds'],
      'OWNERSHIP_SEGMENT_KEYS_MISMATCH', `ownership.segments[${index}]`)
    requireExactKeys(segment.measuredReferencedAccessorBounds, ['min', 'max'], 'OWNERSHIP_SEGMENT_BOUND_KEYS_MISMATCH',
      `ownership.segments[${index}].measuredReferencedAccessorBounds`)
  })
  ownership.instances.forEach((instance, index) => {
    requireExactKeys(instance, [
      'sourceId', 'sourceName', 'sourcePath', 'productionInstanceIndex', 'parity', 'determinant', 'matrixTableIndex', 'elevationBand',
    ], 'OWNERSHIP_INSTANCE_KEYS_MISMATCH', `ownership.instances[${index}]`)
  })
  requireExactKeys(ownership.digests, [
    'sourceIdsSha256', 'sourcePathsSha256', 'transformSetSha256', 'rowIdentityDigestSha256',
    'segmentIdentityDigestSha256', 'measuredUnitBoundsSha256',
  ], 'OWNERSHIP_DIGEST_KEYS_MISMATCH', 'ownership.digests')
}

function elevationBand(matrix) {
  if (matrix[13] < 0.1) return 'low'
  if (matrix[13] < 4) return 'middle'
  return 'high'
}

function validateManifestBasics(manifest, ownership, sourceMap, sourceAudit) {
  validateStrictManifestContract(manifest)
  validateStrictOwnershipContract(ownership)
  requireCondition(manifest.schema === EXPECTED.manifestSchema && manifest.version === 4,
    'MANIFEST_SCHEMA_MISMATCH', 'expected exact cohort manifest-v4')
  requireCondition(manifest.enabled === false, 'MANIFEST_NOT_DORMANT', 'semantic evidence generation only accepts enabled=false')
  requireCondition(manifest.modelId === EXPECTED.modelId && manifest.mode === EXPECTED.mode && manifest.platform === 'web' && manifest.units === 'meters',
    'MANIFEST_IDENTITY_MISMATCH', 'manifest model/mode/platform/units changed')
  requireCondition(ownership.schema === EXPECTED.ownershipSchema && ownership.version === 2,
    'OWNERSHIP_SCHEMA_MISMATCH', 'expected exact cohort ownership-v2')
  requireCondition(ownership.enabled === false && ownership.ready === false && ownership.runtimeIntegrated === false && ownership.activationApproved === false,
    'OWNERSHIP_NOT_DORMANT', 'ownership evidence must remain disabled and runtime-disconnected')
  requireCondition(sourceMap.schema === 'IOM_REPEAT_SIX_PART_PRODUCTION_SOURCE_MAP' && sourceMap.disabled === true && sourceMap.runtimeIntegrated === false,
    'SOURCE_MAP_CONTRACT_MISMATCH', 'direct-production source map must remain disabled and runtime-disconnected')
  requireCondition(sourceAudit.schema === 'IOM_REPEAT_SIX_PART_PRODUCTION_SOURCE_PHYSICAL_AUDIT' && sourceAudit.status === 'PASS' &&
    sourceAudit.disabled === true && sourceAudit.runtimeIntegrated === false && sourceAudit.productionChanged === false,
  'SOURCE_AUDIT_CONTRACT_MISMATCH', 'direct-production source audit must remain passing, disabled, and non-production')
  requireStableEqual(sourceMap.logicalMappingCertificate, LOGICAL_MAPPING_CERTIFICATE,
    'LOGICAL_MAPPING_CERTIFICATE_MISMATCH', 'source-map logical mapping approval certificate')
  requireStableEqual(sourceAudit.logicalMappingCertificate, LOGICAL_MAPPING_CERTIFICATE,
    'LOGICAL_MAPPING_CERTIFICATE_MISMATCH', 'source-audit logical mapping approval certificate')
  requireCondition(manifest.gates?.runtimeIntegrationPassed === false && manifest.gates?.activationApproved === false,
    'MANIFEST_RUNTIME_GATE_CHANGED', 'dormant manifest must not claim runtime integration or activation approval')
}

const productionDecodeCache = new WeakMap()

function decodedProductionEvidence(productionModelBytes, sourceMap, sourceAudit) {
  let cached = productionDecodeCache.get(productionModelBytes)
  if (!cached) {
    const glb = parseGlb(productionModelBytes)
    cached = { glb, source: auditProductionSource(glb, sourceMap, sourceAudit) }
    productionDecodeCache.set(productionModelBytes, cached)
  }
  return cached
}

export function verifyRepeatSixPartCohortV4SemanticBuffers({
  manifestBytes,
  geometryBytes,
  cohortTableBytes,
  ownershipBytes,
  productionModelBytes,
  directProductionGeometryBytes,
  directProductionSourceMapBytes,
  directProductionPhysicalAuditBytes,
}) {
  for (const [name, bytes] of Object.entries({
    manifestBytes,
    geometryBytes,
    cohortTableBytes,
    ownershipBytes,
    productionModelBytes,
    directProductionGeometryBytes,
    directProductionSourceMapBytes,
    directProductionPhysicalAuditBytes,
  })) requireCondition(Buffer.isBuffer(bytes), 'INPUT_BUFFER_MISSING', `${name} must be supplied as one immutable Buffer`)

  const manifest = parseJson(manifestBytes, 'manifest-v4.disabled.json')
  const ownership = parseJson(ownershipBytes, 'exact-six-segment-ownership.json')
  const sourceMap = parseJson(directProductionSourceMapBytes, 'production-source-map.json')
  const sourceAudit = parseJson(directProductionPhysicalAuditBytes, 'direct-production physical-audit.json')
  validateManifestBasics(manifest, ownership, sourceMap, sourceAudit)

  const immutablePins = {
    productionModel: requireHardPin(productionModelBytes, EXPECTED.productionModelBytes, EXPECTED.productionModelSha256, 'production model'),
    directProductionGeometry: requireHardPin(directProductionGeometryBytes, EXPECTED.directGeometryBytes, EXPECTED.directGeometrySha256, 'direct-production geometry'),
    directProductionSourceMap: requireHardPin(directProductionSourceMapBytes, EXPECTED.sourceMapBytes, EXPECTED.sourceMapSha256, 'direct-production source map'),
    directProductionPhysicalAudit: requireHardPin(directProductionPhysicalAuditBytes, EXPECTED.sourceAuditBytes, EXPECTED.sourceAuditSha256, 'direct-production physical audit'),
  }
  requireCondition(geometryBytes.equals(directProductionGeometryBytes), 'GEOMETRY_NOT_BYTE_IDENTICAL_TO_DIRECT_SOURCE',
    'cohort geometry must be byte-identical to the immutable direct-production geometry')
  const payloadPins = {
    geometry: requireAssetPin(geometryBytes, manifest.payloads?.geometry, 'manifest geometry payload'),
    cohortTable: requireAssetPin(cohortTableBytes, manifest.payloads?.cohortTable, 'manifest cohort table payload'),
    ownership: requireAssetPin(ownershipBytes, manifest.payloads?.ownership, 'manifest ownership payload'),
  }
  requireCondition(payloadPins.geometry.bytes === EXPECTED.directGeometryBytes && payloadPins.geometry.sha256 === EXPECTED.directGeometrySha256,
    'GEOMETRY_PAYLOAD_IMMUTABLE_PIN_MISMATCH', 'geometry payload differs from the independent immutable pin')
  requireAssetPin(productionModelBytes, manifest.sourcePins?.productionModel, 'manifest production-model source pin')
  requireAssetPin(directProductionGeometryBytes, manifest.sourcePins?.directProductionGeometry, 'manifest direct-geometry source pin')
  requireAssetPin(directProductionSourceMapBytes, manifest.sourcePins?.directProductionSourceMap, 'manifest source-map source pin')
  requireAssetPin(directProductionPhysicalAuditBytes, manifest.sourcePins?.directProductionPhysicalAudit, 'manifest direct-audit source pin')
  requireCondition(sourceMap.sourceModel?.bytes === immutablePins.productionModel.bytes && sourceMap.sourceModel?.sha256 === immutablePins.productionModel.sha256 &&
    sourceAudit.sourceModel?.bytes === immutablePins.productionModel.bytes && sourceAudit.sourceModel?.sha256 === immutablePins.productionModel.sha256,
  'DIRECT_SOURCE_MODEL_PIN_MISMATCH', 'direct source evidence does not bind to the decoded production model')

  const productionEvidence = decodedProductionEvidence(productionModelBytes, sourceMap, sourceAudit)
  const productionGlb = productionEvidence.glb
  const geometryGlb = parseGlb(geometryBytes)
  const productionOwner = auditProductionOwner(productionGlb, manifest, sourceMap, sourceAudit)
  const production = productionEvidence.source
  const geometry = auditGeometry(geometryGlb, ownership)
  requireCondition(production.geometry.triangleCount === EXPECTED.rowTriangles && geometry.triangleCount === EXPECTED.rowTriangles,
    'GEOMETRY_TRIANGLE_COUNT_MISMATCH', 'production/shared geometry must each contain exactly 61,269 triangles')
  requireCondition(production.geometry.canonicalOrientedGeometrySha256 === EXPECTED.canonicalGeometrySha256 &&
    geometry.canonicalOrientedGeometrySha256 === EXPECTED.canonicalGeometrySha256,
  'GEOMETRY_DIGEST_MISMATCH', 'decoded oriented geometry/material-slot digest differs from the immutable production pin')
  requireCondition(exactJson(production.geometry.trianglesByMaterial, geometry.trianglesByMaterial),
    'GEOMETRY_MATERIAL_TRIANGLE_BIJECTION_MISMATCH', 'shared geometry material triangle counts differ from decoded production')
  requireCondition(geometry.primitiveCount === EXPECTED.primitiveCount && geometry.materialSlots === EXPECTED.materialCount,
    'GEOMETRY_PHYSICAL_LAYOUT_MISMATCH', 'shared geometry must contain six segments times four material primitives')
  for (let slot = 0; slot < EXPECTED.materialCount; slot += 1) {
    requireCondition(production.materials[slot].record.name === EXPECTED.materialNames[slot] &&
      production.materials[slot].sha256 === EXPECTED.materialSha256[slot],
    'PRODUCTION_MATERIAL_DIGEST_MISMATCH', `production material slot ${slot} differs from immutable semantic pin`)
    requireCondition(geometry.materials[slot].sha256 === EXPECTED.materialSha256[slot] &&
      stableStringify(geometry.materials[slot].record) === stableStringify(production.materials[slot].record),
    'GEOMETRY_MATERIAL_RECORD_MISMATCH', `shared material slot ${slot} differs from decoded production`)
    requireCondition(sourceAudit.identification?.nodes?.[slot]?.materialSha256 === EXPECTED.materialSha256[slot] &&
      stableStringify(sourceAudit.identification.nodes[slot].material) === stableStringify(production.materials[slot].record),
    'SOURCE_AUDIT_MATERIAL_RECORD_MISMATCH', `direct audit material slot ${slot} is stale`)
  }
  for (const [segmentId, segment] of geometry.segments.entries()) {
    requireCondition(segment.canonicalOrientedGeometrySha256 === EXPECTED.segmentGeometrySha256[segmentId],
      'SEGMENT_GEOMETRY_DIGEST_MISMATCH', `segment ${segmentId} oriented geometry assignment changed`)
    const audited = sourceAudit.geometry?.segmentDigests?.[segmentId]
    requireCondition(audited?.segment === segmentId && audited?.triangles === segment.triangles &&
      audited?.canonicalOrientedGeometrySha256 === segment.canonicalOrientedGeometrySha256 &&
      exactJson(audited?.trianglesByMaterial, segment.trianglesByMaterial),
    'SOURCE_AUDIT_SEGMENT_MISMATCH', `direct audit segment ${segmentId} is stale`)
  }

  const table = decodeCohortTable(cohortTableBytes)
  requireCondition(exactJson(ownership.binaryTable, expectedBinaryTableMetadata(table.layout)),
    'OWNERSHIP_BINARY_LAYOUT_MISMATCH', 'ownership binary-table metadata differs from decoded BIN')
  requireCondition(ownership.sourceCount === EXPECTED.sourceCount && ownership.segmentCount === EXPECTED.segmentCount &&
    ownership.unitCount === EXPECTED.unitCount && ownership.instances?.length === EXPECTED.sourceCount && ownership.segments?.length === EXPECTED.segmentCount,
  'OWNERSHIP_COUNT_MISMATCH', 'ownership counts differ from decoded table')
  requireCondition(exactJson(ownership.materialRoles, EXPECTED.materialNames),
    'OWNERSHIP_MATERIAL_ORDER_MISMATCH', 'ownership material roles differ from immutable slot order')
  requireCondition(ownership.owner === EXPECTED.ownerNodeName && exactJson(ownership.ownerContract, sourceMap.owner) &&
    exactJson(ownership.productionInstancingNodes, sourceMap.productionInstancingNodes),
  'OWNERSHIP_OWNER_CONTRACT_MISMATCH', 'ownership owner/source paths differ from the direct source map')

  for (let segmentId = 0; segmentId < EXPECTED.segmentCount; segmentId += 1) {
    const decoded = geometry.segments[segmentId]
    const declared = ownership.segments[segmentId]
    const manifestSegment = manifest.geometry?.segments?.[segmentId]
    requireCondition(declared?.segmentId === segmentId && exactJson(declared.stations, decoded.stations) &&
      declared.triangles === decoded.triangles && exactJson(declared.trianglesByMaterial, decoded.trianglesByMaterial) &&
      tupleNear(declared.measuredReferencedAccessorBounds?.min, decoded.measuredReferencedAccessorBounds.min, 0) &&
      tupleNear(declared.measuredReferencedAccessorBounds?.max, decoded.measuredReferencedAccessorBounds.max, 0),
    'OWNERSHIP_SEGMENT_SEMANTICS_MISMATCH', `ownership segment ${segmentId} differs from decoded GLB`)
    requireCondition(manifestSegment?.index === segmentId && manifestSegment?.id === `segment-${String(segmentId).padStart(2, '0')}` &&
      manifestSegment?.triangles === decoded.triangles && manifestSegment?.materialPrimitiveCount === EXPECTED.materialCount &&
      manifestSegment?.bounds?.space === 'source-row-local' &&
      tupleNear(manifestSegment.bounds.min, decoded.measuredReferencedAccessorBounds.min, 0) &&
      tupleNear(manifestSegment.bounds.max, decoded.measuredReferencedAccessorBounds.max, 0),
    'MANIFEST_SEGMENT_SEMANTICS_MISMATCH', `manifest segment ${segmentId} differs from decoded GLB`)
  }
  requireCondition(manifest.geometry?.sourceRowTriangles === geometry.triangleCount &&
    manifest.geometry?.materialSlots === EXPECTED.materialCount && manifest.geometry?.physicalPrimitiveCount === EXPECTED.primitiveCount &&
    manifest.geometry?.canonicalGeometryDigestSha256 === EXPECTED.canonicalGeometrySha256,
  'MANIFEST_GEOMETRY_SUMMARY_MISMATCH', 'manifest geometry summary differs from decoded GLB')

  requireCondition(sourceMap.instances?.length === EXPECTED.sourceCount, 'SOURCE_MAP_INSTANCE_COUNT_MISMATCH', 'source map must contain 78 instances')
  const sources = []
  let renderRecompositionMaxDelta = 0
  let minimumRenderDeterminant = Infinity
  let canonicalSignedZeroComponents = 0
  let renderSignedZeroComponents = 0
  for (let sourceIndex = 0; sourceIndex < EXPECTED.sourceCount; sourceIndex += 1) {
    const source = sourceMap.instances[sourceIndex]
    const owned = ownership.instances[sourceIndex]
    const manifestSource = manifest.catalog?.sources?.[sourceIndex]
    const canonical = table.canonicalMatrices[sourceIndex]
    const renderLocal = table.renderLocalMatrices[sourceIndex]
    const productionMatrix = production.canonicalMatrices[sourceIndex]
    const productionHex = matrixFloat64LEHex(productionMatrix)
    const canonicalHex = matrixFloat64LEHex(canonical)
    requireCondition(source?.sourceIndex === sourceIndex && source?.productionInstanceIndex === sourceIndex &&
      typeof source.sourceName === 'string' && typeof source.sourcePath === 'string' && /^[0-9a-f]{256}$/.test(source.ownerLocalMatrixFloat64LEHex),
    'SOURCE_MAP_INSTANCE_INVALID', `source-map instance ${sourceIndex} metadata is invalid`)
    requireCondition(source.ownerLocalMatrixFloat64LEHex === productionHex && canonicalHex === productionHex,
      'CANONICAL_MATRIX_BITS_MISMATCH', `source ${sourceIndex} canonical Float64 bytes differ across production/source-map/BIN`)
    const canonicalDeterminant = determinant3(canonical)
    const parity = canonicalDeterminant > 0 ? 'positive' : 'mirrored'
    requireCondition(Math.abs(canonicalDeterminant) > EXPECTED.epsilon && source.parity === parity && source.determinant === canonicalDeterminant,
      'CANONICAL_MATRIX_PARITY_MISMATCH', `source ${sourceIndex} determinant/parity differs from decoded production`)
    requireCondition(owned?.sourceId === sourceIndex && owned?.matrixTableIndex === sourceIndex &&
      owned?.sourceName === source.sourceName && owned?.sourcePath === source.sourcePath &&
      owned?.productionInstanceIndex === source.productionInstanceIndex && owned?.parity === parity &&
      owned?.determinant === canonicalDeterminant && owned?.elevationBand === elevationBand(canonical),
    'OWNERSHIP_INSTANCE_SEMANTICS_MISMATCH', `ownership instance ${sourceIndex} differs from source-map/BIN semantics`)
    const expectedRender = parity === 'positive'
      ? [...canonical]
      : canonical.map((value, index) => [0, 4, 8, 12].includes(index) ? -value : value)
    requireCondition(matrixFloat64LEHex(renderLocal) === matrixFloat64LEHex(expectedRender),
      'RENDER_LOCAL_MATRIX_BITS_MISMATCH', `source ${sourceIndex} render-local factorization changed`)
    const renderDeterminant = determinant3(renderLocal)
    requireCondition(renderDeterminant > EXPECTED.epsilon, 'RENDER_LOCAL_DETERMINANT_NOT_POSITIVE',
      `source ${sourceIndex} render-local determinant ${renderDeterminant} is unsafe for InstancedMesh`)
    minimumRenderDeterminant = Math.min(minimumRenderDeterminant, renderDeterminant)
    const host = parity === 'positive' ? IDENTITY : MIRROR_X
    const recomposed = multiplyMatrices(host, renderLocal)
    const delta = matrixMaxDelta(recomposed, canonical)
    renderRecompositionMaxDelta = Math.max(renderRecompositionMaxDelta, delta)
    requireCondition(delta <= EXPECTED.epsilon, 'PARITY_HOST_RECOMPOSITION_MISMATCH', `source ${sourceIndex} host*render-local differs by ${delta}`)
    requireCondition(manifestSource?.index === sourceIndex && manifestSource?.id === `source-${String(sourceIndex).padStart(2, '0')}` &&
      manifestSource?.path === source.sourcePath && manifestSource?.parity === parity &&
      manifestSource?.canonicalMatrix?.space === 'owner-local' && numericTupleExact(manifestSource.canonicalMatrix.matrix, canonical) &&
      manifestSource?.renderLocalMatrix?.space === 'parity-host-local' && numericTupleExact(manifestSource.renderLocalMatrix.matrix, renderLocal),
    'MANIFEST_SOURCE_SEMANTICS_MISMATCH', `manifest source ${sourceIndex} differs from source-map/BIN`)
    canonicalSignedZeroComponents += canonical.filter((value) => Object.is(value, -0)).length
    renderSignedZeroComponents += renderLocal.filter((value) => Object.is(value, -0)).length
    sources.push({ sourceIndex, source, owned, manifestSource, canonical, renderLocal, parity })
  }
  requireCondition(new Set(sources.map(({ source }) => source.sourcePath)).size === EXPECTED.sourceCount,
    'SOURCE_PATH_DUPLICATE', 'source paths must be globally unique')

  const sourceIdsSha256 = stableSha256(sources.map(({ source }) => source.sourceIndex))
  const sourcePathsSha256 = stableSha256(sources.map(({ source }) => source.sourcePath))
  const transformSetSha256 = stableSha256(sources.map(({ source, canonical }) => ({
    sourceIndex: source.sourceIndex,
    name: source.sourceName,
    matrixFloat64LEHex: matrixFloat64LEHex(canonical),
  })))
  requireCondition(sourceIdsSha256 === EXPECTED.sourceIdsSha256 && sourceMap.sourceIdsSha256 === sourceIdsSha256,
    'SOURCE_ID_DIGEST_MISMATCH', 'source ID order differs from immutable pin')
  requireCondition(sourcePathsSha256 === EXPECTED.sourcePathsSha256 && sourceMap.sourcePathsSha256 === sourcePathsSha256,
    'SOURCE_PATH_DIGEST_MISMATCH', 'source path order differs from immutable pin')
  requireCondition(transformSetSha256 === EXPECTED.transformSetSha256 && sourceMap.transformSetSha256 === transformSetSha256 &&
    sourceAudit.transforms?.transformSetSha256 === transformSetSha256 &&
    manifest.sourcePins?.directProductionSourceMap?.transformSetSha256 === transformSetSha256,
  'TRANSFORM_SET_DIGEST_MISMATCH', 'decoded production transform set differs from immutable/source evidence pins')

  const units = []
  for (let unitIndex = 0; unitIndex < EXPECTED.unitCount; unitIndex += 1) {
    const key = table.keys[unitIndex]
    const source = sources[key.sourceIndex]
    const segment = geometry.segments[key.segmentIndex]
    const bounds = table.bounds[unitIndex]
    const expectedBounds = transformBounds(segment.measuredReferencedAccessorBounds, source.canonical)
    requireCondition(tupleNear(bounds.min, expectedBounds.min) && tupleNear(bounds.max, expectedBounds.max),
      'COHORT_BIN_UNIT_BOUND_MISMATCH', `unit ${unitIndex} bound differs from decoded segment transformed by canonical matrix`)
    const manifestUnit = manifest.catalog?.units?.[unitIndex]
    const expectedSourceId = `source-${String(key.sourceIndex).padStart(2, '0')}`
    const expectedSegmentId = `segment-${String(key.segmentIndex).padStart(2, '0')}`
    const expectedUnitId = `${expectedSourceId}:${expectedSegmentId}`
    requireCondition(manifestUnit?.index === unitIndex && manifestUnit?.id === expectedUnitId &&
      manifestUnit?.sourceIndex === key.sourceIndex && manifestUnit?.sourceId === expectedSourceId &&
      manifestUnit?.segmentIndex === key.segmentIndex && manifestUnit?.segmentId === expectedSegmentId &&
      manifestUnit?.bounds?.space === 'owner-local' && numericTupleExact(manifestUnit.bounds.min, bounds.min) &&
      numericTupleExact(manifestUnit.bounds.max, bounds.max) && manifestUnit?.triangles === segment.triangles,
    'MANIFEST_UNIT_SEMANTICS_MISMATCH', `manifest unit ${unitIndex} differs from decoded BIN/GLB`)
    units.push({
      index: unitIndex,
      unitId: expectedUnitId,
      sourceIndex: key.sourceIndex,
      sourcePath: source.source.sourcePath,
      parity: source.parity,
      segmentIndex: key.segmentIndex,
      segmentId: key.segmentIndex,
      bounds,
      triangles: segment.triangles,
    })
  }
  for (let sourceIndex = 0; sourceIndex < EXPECTED.sourceCount; sourceIndex += 1) {
    const sourceBounds = unionBounds(units.slice(sourceIndex * EXPECTED.segmentCount, (sourceIndex + 1) * EXPECTED.segmentCount).map((unit) => unit.bounds))
    requireCondition(numericTupleExact(manifest.catalog.sources[sourceIndex].bounds?.min, sourceBounds.min) &&
      numericTupleExact(manifest.catalog.sources[sourceIndex].bounds?.max, sourceBounds.max) &&
      manifest.catalog.sources[sourceIndex].bounds?.space === 'owner-local',
    'MANIFEST_SOURCE_BOUND_MISMATCH', `manifest source ${sourceIndex} bound is not the union of its six units`)
  }

  const ownershipDigests = {
    sourceIdsSha256,
    sourcePathsSha256,
    transformSetSha256,
    rowIdentityDigestSha256: stableSha256(sources.map(({ source, owned, canonical }) => ({
      sourceId: owned.sourceId,
      sourcePath: owned.sourcePath,
      parity: owned.parity,
      matrixFloat64LEHex: matrixFloat64LEHex(canonical),
    }))),
    segmentIdentityDigestSha256: stableSha256(units.map((unit) => ({
      sourceId: unit.sourceIndex,
      sourcePath: unit.sourcePath,
      parity: unit.parity,
      segmentId: unit.segmentId,
      bounds: unit.bounds,
    }))),
    measuredUnitBoundsSha256: stableSha256(units.map((unit) => unit.bounds)),
  }
  requireCondition(exactJson(ownership.digests, ownershipDigests),
    'OWNERSHIP_DIGEST_MISMATCH', 'ownership digests are stale relative to decoded production/BIN semantics')

  requireCondition(manifest.catalog?.order === 'source-major-segment-major' && manifest.catalog?.defaultState === 'culled' &&
    manifest.catalog?.sources?.length === EXPECTED.sourceCount && manifest.catalog?.units?.length === EXPECTED.unitCount,
  'MANIFEST_CATALOG_LAYOUT_MISMATCH', 'manifest catalog order/count/default state changed')
  requireCondition(manifest.parity?.canonicalMatrixSpace === 'owner-local' && manifest.parity?.renderLocalMatrixSpace === 'parity-host-local' &&
    manifest.parity?.composition === 'host-times-render-local' && manifest.parity?.requirePositiveRenderLocalDeterminant === true &&
    numericTupleExact(manifest.parity?.hosts?.positive?.matrix, IDENTITY) && numericTupleExact(manifest.parity?.hosts?.mirrored?.matrix, MIRROR_X) &&
    manifest.parity?.materialDrawsPerActiveGroup === EXPECTED.materialCount && manifest.parity?.possibleGroupCount === 12 &&
    manifest.parity?.persistentRendererTemplates === 48,
  'MANIFEST_PARITY_CONTRACT_MISMATCH', 'manifest parity host/template contract changed')
  const manifestDigests = computeIndependentRepeatSixPartManifestDigests(manifest)
  requireCondition(exactJson(manifest.digests, manifestDigests), 'MANIFEST_DIGEST_MISMATCH', 'manifest canonical digests are stale')

  const margin = manifest.selector?.exitMarginMeters
  requireCondition(Number.isFinite(margin) && margin >= 0 && manifest.selector?.boundsSpace === 'owner-local' &&
    manifest.selector?.boundsType === 'closed-aabb' && manifest.selector?.distanceMetric === 'linf-point-to-closed-aabb',
  'MANIFEST_SELECTOR_CONTRACT_MISMATCH', 'manifest selector semantics changed')
  const resident = maxWeightedClosedAabbOverlap(units, margin, EXPECTED.materialCount)
  const activeDraw = maxActiveClosedAabbGroups(units, margin, EXPECTED.materialCount)
  const declaredResident = manifest.proof?.residentSweep
  const residentWitness = summarizeClosedSelection(units, margin, declaredResident?.witness, EXPECTED.materialCount)
  requireCondition(declaredResident?.method === 'exact-closed-aabb-endpoint-sweep' && declaredResident?.marginMeters === margin &&
    declaredResident?.maxSelectedTriangles === resident.triangles && declaredResident?.selectedUnitCount === resident.selectedUnitCount &&
    declaredResident?.activeDraws === resident.activeDraws && residentWitness.selectedUnitCount === resident.selectedUnitCount &&
    residentWitness.activeDraws === resident.activeDraws && residentWitness.triangles === resident.triangles &&
    numericTupleExact(declaredResident.witness, resident.witness),
  'MANIFEST_RESIDENT_METRIC_MISMATCH', 'declared resident maximum/witness differs from independently decoded catalog')
  const declaredDraw = manifest.proof?.activeDrawSweep
  const drawWitness = summarizeClosedSelection(units, margin, declaredDraw?.witness, EXPECTED.materialCount)
  requireCondition(declaredDraw?.method === 'exact-closed-aabb-endpoint-sweep' &&
    declaredDraw?.maxActiveDraws === activeDraw.maxActiveDraws &&
    declaredDraw?.activeParitySegmentGroups === activeDraw.activeParitySegmentGroups &&
    drawWitness.activeDraws === activeDraw.maxActiveDraws && numericTupleExact(declaredDraw.witness, activeDraw.point),
  'MANIFEST_DRAW_METRIC_MISMATCH', 'declared draw maximum/witness differs from independently decoded catalog')

  const payloadOnlyBytes = geometryBytes.length + cohortTableBytes.length + ownershipBytes.length
  requireCondition(manifest.proof?.payloadOnlyRequests === 3 && manifest.proof?.payloadOnlyBytes === payloadOnlyBytes &&
    manifest.proof?.manifestRequests === 1 && manifest.proof?.manifestBytes === manifestBytes.length &&
    manifest.proof?.coldContractRequests === 4 && manifest.proof?.coldContractBytes === payloadOnlyBytes + manifestBytes.length,
  'MANIFEST_BYTE_METRIC_MISMATCH', 'payload/manifest request or byte accounting is stale')
  requireCondition(manifest.proof.payloadOnlyRequests <= manifest.budgets.maxRuntimePayloadRequests &&
    manifest.proof.payloadOnlyBytes <= manifest.budgets.maxRuntimePayloadBytes &&
    manifest.proof.manifestBytes <= manifest.budgets.maxManifestBytes &&
    manifest.proof.coldContractRequests <= manifest.budgets.maxColdContractRequests &&
    manifest.proof.coldContractBytes <= manifest.budgets.maxColdContractBytes,
  'MANIFEST_PAYLOAD_BUDGET_MISMATCH', 'payload/manifest proof exceeds its exact dormant budget')
  requireCondition(manifest.proof?.persistentRendererTemplates === 48 &&
    manifest.budgets?.maxPersistentRendererTemplates === 48 && manifest.budgets?.maxActiveDraws === 48,
  'MANIFEST_RENDERER_METRIC_MISMATCH', 'renderer template/draw metrics changed')
  requireCondition(declaredResident.totalWithReservationTriangles === resident.triangles + manifest.budgets.allOtherOwnerReservationTriangles &&
    resident.triangles <= manifest.budgets.repeatFamilyResidentTriangles &&
    declaredResident.totalWithReservationTriangles <= manifest.budgets.totalResidentTriangles,
  'MANIFEST_RESIDENT_BUDGET_ARITHMETIC_MISMATCH', 'resident budget arithmetic is stale')
  const transition = manifest.proof?.transition
  requireCondition(transition?.oneRowArithmeticRepeatTriangles === resident.triangles + EXPECTED.rowTriangles &&
    transition?.oneRowArithmeticTotalWithReservationTriangles === resident.triangles + EXPECTED.rowTriangles + manifest.budgets.allOtherOwnerReservationTriangles &&
    transition?.unorderedDoubleBufferRepeatTriangles === resident.triangles * 2 &&
    transition?.unorderedDoubleBufferTotalWithReservationTriangles === resident.triangles * 2 + manifest.budgets.allOtherOwnerReservationTriangles &&
    transition?.arbitraryConcurrentOverlapProven === false && transition?.runtimeOrderingEnforced === false &&
    manifest.gates?.transitionBudgetPassed === false,
  'MANIFEST_TRANSITION_METRIC_MISMATCH', 'transition arithmetic/concurrency claims are stale')
  requireCondition(manifest.gates?.exactGeometryPassed === true && manifest.gates?.physicalBoundsPassed === true &&
    manifest.gates?.residentBudgetPassed === true && manifest.gates?.identityAndParityPassed === true &&
    manifest.gates?.runtimeConcurrencyPassed === false && manifest.gates?.browserVisualWitnessPassed === false &&
    manifest.gates?.measuredPerformancePassed === false,
  'MANIFEST_DORMANT_GATE_MISMATCH', 'dormant evidence gates changed or overclaim readiness')

  const inputs = {
    manifest: { path: 'tmp/repeat-six-part-cohort-v4/manifest-v4.disabled.json', bytes: manifestBytes.length, sha256: sha256(manifestBytes) },
    geometry: { path: 'tmp/repeat-six-part-exact-pilot/payloads/shared/exact-six-segment-geometry.glb', ...payloadPins.geometry },
    cohortTable: { path: 'tmp/repeat-six-part-exact-pilot/payloads/web/exact-six-segment-cohort.bin', ...payloadPins.cohortTable },
    ownership: { path: 'tmp/repeat-six-part-exact-pilot/payloads/web/exact-six-segment-ownership.json', ...payloadPins.ownership },
    productionModel: { path: '../public/models/icm-anim-2025/model-web.glb', ...immutablePins.productionModel },
    directProductionGeometry: { path: 'tmp/repeat-six-part-exact-pilot/production-source/exact-six-segment-production-source.glb', ...immutablePins.directProductionGeometry },
    directProductionSourceMap: { path: 'tmp/repeat-six-part-exact-pilot/production-source/production-source-map.json', ...immutablePins.directProductionSourceMap },
    directProductionPhysicalAudit: { path: 'tmp/repeat-six-part-exact-pilot/production-source/physical-audit.json', ...immutablePins.directProductionPhysicalAudit },
  }
  const canonicalMatrixBytes = Buffer.concat(table.canonicalMatrices.map((matrix) => Buffer.from(matrixFloat64LEHex(matrix), 'hex')))
  const renderMatrixBytes = Buffer.concat(table.renderLocalMatrices.map((matrix) => Buffer.from(matrixFloat64LEHex(matrix), 'hex')))
  const unitBoundsBytes = Buffer.alloc(EXPECTED.unitCount * EXPECTED.boundsStrideBytes)
  table.bounds.forEach((bounds, unitIndex) => [...bounds.min, ...bounds.max]
    .forEach((value, component) => unitBoundsBytes.writeDoubleLE(value, unitIndex * EXPECTED.boundsStrideBytes + component * 8)))
  const semanticBinding = {
    verifierSchema: 'IOM_REPEAT_SIX_PART_COHORT_V4_SEMANTIC_ATTESTATION',
    verifierVersion: 1,
    inputs: Object.fromEntries(Object.entries(inputs).map(([key, pin]) => [key, { bytes: pin.bytes, sha256: pin.sha256 }])),
    canonicalGeometrySha256: geometry.canonicalOrientedGeometrySha256,
    segmentGeometrySha256: geometry.segments.map((segment) => segment.canonicalOrientedGeometrySha256),
    transformSetSha256,
    canonicalMatrixTableSha256: sha256(canonicalMatrixBytes),
    renderLocalMatrixTableSha256: sha256(renderMatrixBytes),
    unitBoundsTableSha256: sha256(unitBoundsBytes),
    ownershipDigests,
    manifestDigests,
    manifestPolicyContractSha256: stableSha256(MANIFEST_POLICY),
  }
  return {
    schema: semanticBinding.verifierSchema,
    version: semanticBinding.verifierVersion,
    status: 'pass-dormant-semantic-evidence-only',
    enabled: false,
    runtimeIntegrated: false,
    productionRoutingChanged: false,
    activationValidatorIntegrated: false,
    activationAuthorityEstablished: false,
    inputs,
    productionOwner,
    geometry: {
      triangles: geometry.triangleCount,
      trianglesByMaterial: geometry.trianglesByMaterial,
      physicalPrimitiveCount: geometry.primitiveCount,
      canonicalOrientedGeometrySha256: geometry.canonicalOrientedGeometrySha256,
      segmentGeometry: geometry.segments.map((segment) => ({
        segmentId: segment.segmentId,
        triangles: segment.triangles,
        bounds: segment.measuredReferencedAccessorBounds,
        canonicalOrientedGeometrySha256: segment.canonicalOrientedGeometrySha256,
      })),
      materials: geometry.materials.map(({ record, sha256: digest }, slot) => ({ slot, name: record.name, sha256: digest })),
      contract: geometry.contract,
    },
    transforms: {
      sourceCount: EXPECTED.sourceCount,
      positiveCanonicalMatrices: sources.filter((source) => source.parity === 'positive').length,
      mirroredCanonicalMatrices: sources.filter((source) => source.parity === 'mirrored').length,
      canonicalSignedZeroComponents,
      renderSignedZeroComponents,
      transformSetSha256,
      canonicalMatrixTableSha256: semanticBinding.canonicalMatrixTableSha256,
      renderLocalMatrixTableSha256: semanticBinding.renderLocalMatrixTableSha256,
      minimumRenderLocalDeterminant: minimumRenderDeterminant,
      renderRecompositionMaxDelta,
      allRenderLocalDeterminantsPositive: true,
      allHostRecompositionsMatch: true,
    },
    catalog: {
      sources: EXPECTED.sourceCount,
      segments: EXPECTED.segmentCount,
      units: EXPECTED.unitCount,
      unitBoundsTableSha256: semanticBinding.unitBoundsTableSha256,
      residentSweep: resident,
      activeDrawSweep: activeDraw,
    },
    crossChecks: {
      immutableProductionPins: true,
      decodedProductionGeometry: true,
      decodedSharedGeometry: true,
      exactGlobalAndSegmentGeometry: true,
      exactMaterialRecords: true,
      exactCanonicalFloat64BitsIncludingSignedZero: true,
      exactParitySafeRenderMatrices: true,
      exactUnitKeysAndBounds: true,
      ownershipDigests: true,
      manifestCatalogPinsAndMetrics: true,
    },
    ownershipDigests,
    manifestDigests,
    manifestPolicyContractSha256: semanticBinding.manifestPolicyContractSha256,
    semanticBindingSha256: sha256Json(semanticBinding),
    limitations: {
      logicalIdentityRuntimeObserverPresent: false,
      transitionRuntimeOrderingProven: false,
      browserVisualWitnessPresent: false,
      measuredRuntimePerformancePresent: false,
      activationValidatorAcceptanceEvaluated: false,
      semanticEvidenceWiredIntoActivationReview: false,
      note: 'This deterministic offline attestation is deliberately not integrated with or evaluated by the activation validator.',
    },
  }
}

export async function writeRepeatSixPartCohortV4SemanticAttestation({
  paths = REPEAT_SIX_PART_SEMANTIC_PATHS,
} = {}) {
  const prerequisitePaths = [
    paths.manifest,
    paths.geometry,
    paths.cohortTable,
    paths.ownership,
    paths.productionModel,
    paths.directProductionGeometry,
    paths.directProductionSourceMap,
    paths.directProductionPhysicalAudit,
  ]
  let inputBuffers
  try {
    // Each prerequisite is read exactly once; the same immutable Buffer is
    // hashed and decoded to avoid a hash/re-read TOCTOU gap.
    inputBuffers = await Promise.all(prerequisitePaths.map((path) => readFile(path)))
  } catch (error) {
    reject('SEMANTIC_PREREQUISITE_MISSING',
      `ignored tmp evidence is absent or unreadable (${error?.path ?? 'unknown path'}); run npm run test:repeat-six-part-cohort-v4:physical first`)
  }
  const [
    manifestBytes,
    geometryBytes,
    cohortTableBytes,
    ownershipBytes,
    productionModelBytes,
    directProductionGeometryBytes,
    directProductionSourceMapBytes,
    directProductionPhysicalAuditBytes,
  ] = inputBuffers
  const attestation = verifyRepeatSixPartCohortV4SemanticBuffers({
    manifestBytes,
    geometryBytes,
    cohortTableBytes,
    ownershipBytes,
    productionModelBytes,
    directProductionGeometryBytes,
    directProductionSourceMapBytes,
    directProductionPhysicalAuditBytes,
  })
  const text = `${JSON.stringify(attestation, null, 2)}\n`
  await mkdir(dirname(paths.attestation), { recursive: true })
  await writeFile(paths.attestation, text)
  return {
    attestation,
    output: {
      path: relative(VIEWER_ROOT, paths.attestation).replaceAll('\\', '/'),
      bytes: Buffer.byteLength(text),
      sha256: sha256(Buffer.from(text)),
    },
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const result = await writeRepeatSixPartCohortV4SemanticAttestation()
    console.log('Repeat six-part cohort v4 independent semantic verification: PASS')
    console.log(`  ${result.output.path}`)
    console.log(`  ${result.attestation.geometry.triangles.toLocaleString('en-US')} triangles / ${result.attestation.catalog.sources} sources / ${result.attestation.catalog.units} units`)
    console.log(`  exact geometry: ${result.attestation.geometry.canonicalOrientedGeometrySha256}`)
    console.log(`  semantic binding: ${result.attestation.semanticBindingSha256}`)
    console.log('  dormant evidence only; activation/runtime/public/production unchanged')
  } catch (error) {
    console.error(`Repeat six-part cohort v4 independent semantic verification: FAIL\n  ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
