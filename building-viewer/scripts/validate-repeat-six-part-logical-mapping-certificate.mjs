/**
 * Offline evidence validator for the approved Ground Floor repeat logical map.
 *
 * The authoritative entry point reads exactly two inputs: the tracked mapping
 * certificate and the pinned production GLB. Historical ignored artifacts are
 * provenance attestations only and are deliberately never opened here.
 *
 * MeshoptDecoder is used only to decompress EXT_meshopt_compression buffer
 * views. Accessor decoding, normalized integer conversion, Matrix4.compose
 * parity, reciprocal matching, and every policy decision are implemented here.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MeshoptDecoder } from 'meshoptimizer'

export const LOGICAL_MAPPING_SCHEMA = 'IOM_REPEAT_SIX_PART_LOGICAL_MAPPING_CERTIFICATE_V1'
export const LOGICAL_MAPPING_VERSION = 1

const HERE = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(HERE, '..')
export const TRACKED_CERTIFICATE_PATH = resolve(HERE, 'fixtures/icm-anim-2025-ground-floor-repeat-logical-mapping-v1.json')
export const PINNED_PRODUCTION_MODEL_PATH = resolve(PROJECT_ROOT, '../public/models/icm-anim-2025/model-web.glb')

export const TRACKED_CERTIFICATE_PIN = Object.freeze({
  bytes: 28_050,
  sha256: 'a802f11c3f9798168d8339c4c786036d36b7486c0c83a5fdad5931d5cff94b60',
})
export const PINNED_PRODUCTION_MODEL = Object.freeze({
  relativePath: '../public/models/icm-anim-2025/model-web.glb',
  bytes: 97_549_356,
  sha256: 'b96cf36f64a03d16047e3ff26aa93131481f636c184df80b5c7ea2032e4cb5e8',
})

const COUNT = 78
const ROOT_PATHS = Object.freeze(['scene/0/258', 'scene/0/259', 'scene/0/260', 'scene/0/261'])
const OWNER = Object.freeze({
  nodeName: 'Ground Floor._anim1',
  activeScenePath: 'scene/0/400',
  sceneRoot: true,
  identityRestMatrix: true,
  animationChannels: 0,
})
const ACCESSOR_PINS = Object.freeze({
  TRANSLATION: Object.freeze({
    type: 'VEC3', componentType: 5126, normalized: false, count: COUNT,
    sha256: '34987d98ceec9c58feba736616334ab8eae0573ab4e5ebcda298632a36a06638',
  }),
  ROTATION: Object.freeze({
    type: 'VEC4', componentType: 5122, normalized: true, count: COUNT,
    sha256: '8763e4b72ce6409aff834aae8ff491078daeb22b48ad8162b03506a42c9b0286',
  }),
  SCALE: Object.freeze({
    type: 'VEC3', componentType: 5126, normalized: false, count: COUNT,
    sha256: 'd1db5799e962e30af5f9e9c0d8f39649e5c1fe96b1d5bbb3cfd9f9b6801a12a5',
  }),
})
const PRODUCTION_TRANSFORM_SHA256 = 'fe7adf799ecbfedbf84bcfcaa0557713728a36507573f846b52476891b66d36b'
const SOURCE_IDS_SHA256 = 'd2883d11372b27f23ae8388db283195e13b979870cb5897e63a7971676a5189b'
const SOURCE_PATHS_SHA256 = '72f559e1f08017caeb07b3c5577b0f2e3f2cf85a1886f781f9f5b863836d30bc'
const REFERENCE_TRANSLATIONS_SHA256 = 'ff2a1c361af5eefdf2cae44f5c79cf3e3bd040ffae8ad638b05116d81fc6ce21'
const ROW_RECORDS_SHA256 = 'c626e042854bbbad6987b4d1a73c9615f14751a8b46097c5e09c8b8b1d1170e9'
const HARD_POLICY = Object.freeze({
  matchingMethod: 'reciprocal-exhaustive-nearest-neighbor-owner-local-translation',
  maxMatchedDistanceMeters: 0.005,
  minRunnerUpMarginMeters: 0.5,
  maxBestToRunnerUpRatio: 0.01,
  requireBijection: true,
  requireReciprocalNearest: true,
  requireExpectedProductionInstanceIndex: true,
})
const EXPECTED_SCOPE = Object.freeze({
  modelId: 'icm-anim-2025',
  meshName: 'Mesh.13786',
  ownerNodeName: 'Ground Floor._anim1',
  descendantPath: 'Ground Floor.BT_3',
  coordinateSpace: 'owner-local',
  units: 'meters',
  sourceCount: COUNT,
})
const EXPECTED_PROVENANCE = Object.freeze({
  evidenceKind: 'named-authored-source-extraction-snapshot',
  namedSourceArtifact: {
    relativePath: 'tmp/icm-anim-2025-cleaned.glb', bytes: 347_323_552,
    sha256: 'd0e25ee93e609439242c553da99318d0f33f739c3a0fecf85c5e7bd01a8950ff',
    availability: 'local-ignored-provenance-only',
  },
  extractor: {
    relativePath: 'scripts/build-ground-floor-repeat-instancing-pilot.mjs', bytes: 83_592,
    sha256: '6b6dd0f6c0069bb6d3907d61e2f37915ff44db1fd7ae05cc325e43d0f5e81ad6',
    mappingSchema: 'iom-ground-floor-repeat-instance-map-v1',
    method: 'named Mesh.13786 users below Ground Floor._anim1 converted to owner-local matrices',
  },
  historicalMigrationMap: {
    relativePath: 'tmp/repeat-instancing-ground-floor/instance-map.json', bytes: 57_332,
    sha256: 'f5101fff6e773e5dffca2b07e88f6869106cf6ebc225df250c27146bd2f4116d',
    availability: 'local-ignored-provenance-only',
  },
  localVerificationEvidence: {
    relativePath: 'tmp/repeat-six-part-production-source/current-mapping-verification.local.json', bytes: 823,
    sha256: '0cda312c771e56d4765a90f8911052fd2dde7eb44a546e1f6a27e7b734963182',
    availability: 'local-ignored-provenance-only',
  },
  authoredTransformSetSha256: '1555aa7164199d55e1fbbda6ffff82187a22c497006cdbe4a322e770011746e8',
  cleanBuildDependencyStatement: 'Only this tracked certificate and the pinned production GLB are validator inputs; historical artifacts are provenance attestations and are not read.',
})
const EXPECTED_APPROVAL = Object.freeze({
  status: 'approved',
  requiredAuthority: 'human-dcc-source-path-to-production-row-semantic-review',
  approvedBy: 'project-owner',
  approvedAt: '2026-08-30T16:37:38Z',
  approvalReference: 'conversation:user-explicit-proceed-after-certificate-review',
})
const EXPECTED_TARGET = Object.freeze({
  productionModel: PINNED_PRODUCTION_MODEL,
  activeSceneIndex: 0,
  productionInstancingRootPaths: ROOT_PATHS,
  intendedOwner: OWNER,
  instanceAccessors: ACCESSOR_PINS,
  productionTransformSetSha256: PRODUCTION_TRANSFORM_SHA256,
})
const EXPECTED_CATALOG = Object.freeze({
  sourceCount: COUNT,
  sourceIdsSha256: SOURCE_IDS_SHA256,
  sourcePathsSha256: SOURCE_PATHS_SHA256,
  referenceTranslationsSha256: REFERENCE_TRANSLATIONS_SHA256,
  expectedProductionInstanceIndicesSha256: SOURCE_IDS_SHA256,
  rowRecordsSha256: ROW_RECORDS_SHA256,
  positive: 40,
  mirrored: 38,
})
const TOP_LEVEL_KEYS = Object.freeze(['schema', 'version', 'status', 'scope', 'provenance', 'approval', 'target', 'policy', 'catalog', 'sources'])
const SOURCE_KEYS = Object.freeze(['sourceId', 'sourcePath', 'expectedProductionInstanceIndex', 'referenceOwnerLocalTranslationFloat64LEHex', 'parity'])
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const TRANSLATION_HEX_PATTERN = /^[a-f0-9]{48}$/
const MATRIX_HEX_PATTERN = /^[a-f0-9]{256}$/
const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
const TIE_EPSILON = 1e-12

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

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

function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function sha256Stable(value) {
  return sha256(Buffer.from(stableStringify(value)))
}

function assertRecord(value, label) {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), `${label}: must be an object`)
}

function assertStrictKeys(value, expected, label) {
  assertRecord(value, label)
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label}: keys changed`)
}

function assertExact(value, expected, label) {
  assert.deepEqual(value, expected, `${label}: pinned contract changed`)
}

function assertPin(bytes, pin, label) {
  assert.ok(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array, `${label}: bytes are required`)
  assert.equal(bytes.byteLength, pin.bytes, `${label}: byte pin changed`)
  assert.match(pin.sha256, SHA256_PATTERN, `${label}: invalid expected SHA-256 pin`)
  assert.equal(sha256(bytes), pin.sha256, `${label}: SHA-256 pin changed`)
}

function sourceNames() {
  const names = []
  for (let value = 134; value <= 168; value += 1) names.push(`Stuhl_Tisch_Rechts_Reihe_${value}`)
  names.push('Stuhl_Tisch_Rechts_Reihe_171')
  names.push('Stuhl_Tisch_Rechts_Reihe_172')
  names.push('Stuhl_Tisch_Rechts_Reihe_172.001')
  for (let value = 173; value <= 211; value += 1) names.push(`Stuhl_Tisch_Rechts_Reihe_${value}`)
  names.push('Stuhl_Tisch_Rechts_Reihe_211.001')
  assert.equal(names.length, COUNT)
  return names
}

function matrixFloat64LEHex(values) {
  assert.equal(values.length, 16, 'matrix: expected 16 components')
  const bytes = Buffer.alloc(16 * 8)
  values.forEach((value, index) => {
    assert.ok(Number.isFinite(value), `matrix[${index}]: non-finite component`)
    bytes.writeDoubleLE(value, index * 8)
  })
  return bytes.toString('hex')
}

function matrixFromFloat64LEHex(hex, label) {
  assert.match(hex, MATRIX_HEX_PATTERN, `${label}: malformed Float64LE matrix hex`)
  const bytes = Buffer.from(hex, 'hex')
  return Array.from({ length: 16 }, (_, index) => {
    const value = bytes.readDoubleLE(index * 8)
    assert.ok(Number.isFinite(value), `${label}[${index}]: non-finite matrix component`)
    return value
  })
}

function translationFromFloat64LEHex(hex, label) {
  assert.match(hex, TRANSLATION_HEX_PATTERN, `${label}: malformed Float64LE translation hex`)
  const bytes = Buffer.from(hex, 'hex')
  return Array.from({ length: 3 }, (_, index) => {
    const value = bytes.readDoubleLE(index * 8)
    assert.ok(Number.isFinite(value), `${label}[${index}]: non-finite translation component`)
    return value
  })
}

function determinant3(matrix) {
  return matrix[0] * (matrix[5] * matrix[10] - matrix[9] * matrix[6])
    - matrix[4] * (matrix[1] * matrix[10] - matrix[9] * matrix[2])
    + matrix[8] * (matrix[1] * matrix[6] - matrix[5] * matrix[2])
}

// Exact column-major algebra used by THREE.Matrix4.compose. The input
// quaternion is intentionally not normalized: GLTFLoader does not renormalize
// normalized-integer quaternion accessors before composing instance matrices.
function composeThreeLoaderEquivalent(translation, quaternion, scale) {
  const [x, y, z, w] = quaternion
  const [sx, sy, sz] = scale
  const x2 = x + x; const y2 = y + y; const z2 = z + z
  const xx = x * x2; const xy = x * y2; const xz = x * z2
  const yy = y * y2; const yz = y * z2; const zz = z * z2
  const wx = w * x2; const wy = w * y2; const wz = w * z2
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    translation[0], translation[1], translation[2], 1,
  ]
}

function nodeLocalMatrix(node) {
  if (node.matrix !== undefined) {
    assert.ok(Array.isArray(node.matrix) && node.matrix.length === 16 && node.matrix.every(Number.isFinite), 'node.matrix: invalid')
    return node.matrix
  }
  const translation = node.translation ?? [0, 0, 0]
  const rotation = node.rotation ?? [0, 0, 0, 1]
  const scale = node.scale ?? [1, 1, 1]
  assert.ok(Array.isArray(translation) && translation.length === 3 && translation.every(Number.isFinite), 'node.translation: invalid')
  assert.ok(Array.isArray(rotation) && rotation.length === 4 && rotation.every(Number.isFinite), 'node.rotation: invalid')
  assert.ok(Array.isArray(scale) && scale.length === 3 && scale.every(Number.isFinite), 'node.scale: invalid')
  return composeThreeLoaderEquivalent(translation, rotation, scale)
}

function assertIdentity(matrix, label) {
  assert.deepEqual(matrix, IDENTITY, `${label}: identity rest matrix changed`)
}

function parseGlb(bytes) {
  assert.ok(bytes.byteLength >= 20, 'production GLB: truncated header')
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  assert.equal(data.getUint32(0, true), 0x46546c67, 'production GLB: bad magic')
  assert.equal(data.getUint32(4, true), 2, 'production GLB: expected version 2')
  assert.equal(data.getUint32(8, true), bytes.byteLength, 'production GLB: declared length mismatch')
  let offset = 12
  let json = null
  let bin = null
  while (offset < bytes.byteLength) {
    assert.ok(offset + 8 <= bytes.byteLength, 'production GLB: truncated chunk header')
    const length = data.getUint32(offset, true)
    const type = data.getUint32(offset + 4, true)
    const start = offset + 8
    const end = start + length
    assert.ok(end <= bytes.byteLength, 'production GLB: truncated chunk')
    if (type === 0x4e4f534a) {
      assert.equal(json, null, 'production GLB: duplicate JSON chunk')
      json = JSON.parse(Buffer.from(bytes.buffer, bytes.byteOffset + start, length).toString('utf8').replace(/[\u0000 ]+$/u, ''))
    } else if (type === 0x004e4942) {
      assert.equal(bin, null, 'production GLB: duplicate BIN chunk')
      bin = new Uint8Array(bytes.buffer, bytes.byteOffset + start, length)
    } else {
      assert.fail(`production GLB: unsupported chunk type ${type}`)
    }
    offset = end
  }
  assert.equal(offset, bytes.byteLength, 'production GLB: trailing bytes')
  assertRecord(json, 'production GLB JSON')
  assert.ok(bin, 'production GLB: BIN chunk missing')
  return { json, bin }
}

function componentCount(type) {
  const counts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }
  assert.ok(Object.hasOwn(counts, type), `accessor: unsupported type ${type}`)
  return counts[type]
}

function componentBytes(componentType) {
  const widths = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
  assert.ok(Object.hasOwn(widths, componentType), `accessor: unsupported componentType ${componentType}`)
  return widths[componentType]
}

function normalizedComponent(view, offset, componentType, normalized) {
  let value
  if (componentType === 5122) value = view.getInt16(offset, true)
  else if (componentType === 5126) value = view.getFloat32(offset, true)
  else assert.fail(`accessor: componentType ${componentType} is outside the pinned TRS contract`)
  if (!normalized) return value
  if (componentType === 5122) return Math.max(value / 32767, -1)
  assert.fail(`accessor: normalized componentType ${componentType} is unsupported`)
}

async function decodeAccessor(json, bin, accessorIndex, decodedViews) {
  const accessor = json.accessors?.[accessorIndex]
  assertRecord(accessor, `accessor ${accessorIndex}`)
  assert.equal(accessor.sparse, undefined, `accessor ${accessorIndex}: sparse accessors are forbidden`)
  const viewIndex = accessor.bufferView
  assert.ok(Number.isSafeInteger(viewIndex), `accessor ${accessorIndex}: bufferView missing`)
  const bufferView = json.bufferViews?.[viewIndex]
  assertRecord(bufferView, `bufferView ${viewIndex}`)
  const extension = bufferView.extensions?.EXT_meshopt_compression
  assertRecord(extension, `bufferView ${viewIndex}.EXT_meshopt_compression`)
  assert.equal(extension.buffer, 0, `bufferView ${viewIndex}: meshopt source must be GLB buffer 0`)
  assert.ok(Number.isSafeInteger(extension.byteOffset) && extension.byteOffset >= 0, `bufferView ${viewIndex}: invalid meshopt byteOffset`)
  assert.ok(Number.isSafeInteger(extension.byteLength) && extension.byteLength > 0, `bufferView ${viewIndex}: invalid meshopt byteLength`)
  assert.ok(Number.isSafeInteger(extension.byteStride) && extension.byteStride > 0, `bufferView ${viewIndex}: invalid meshopt byteStride`)
  assert.ok(Number.isSafeInteger(extension.count) && extension.count > 0, `bufferView ${viewIndex}: invalid meshopt count`)
  assert.ok(extension.byteOffset + extension.byteLength <= bin.byteLength, `bufferView ${viewIndex}: meshopt source range exceeds BIN`)
  let decoded = decodedViews.get(viewIndex)
  if (!decoded) {
    await MeshoptDecoder.ready
    const encoded = bin.subarray(extension.byteOffset, extension.byteOffset + extension.byteLength)
    decoded = new Uint8Array(extension.count * extension.byteStride)
    MeshoptDecoder.decodeGltfBuffer(decoded, extension.count, extension.byteStride, encoded, extension.mode, extension.filter)
    decodedViews.set(viewIndex, decoded)
  }
  const count = accessor.count
  const components = componentCount(accessor.type)
  const width = componentBytes(accessor.componentType)
  const elementBytes = components * width
  const stride = bufferView.byteStride ?? extension.byteStride
  const start = accessor.byteOffset ?? 0
  assert.ok(Number.isSafeInteger(count) && count > 0, `accessor ${accessorIndex}: invalid count`)
  assert.ok(Number.isSafeInteger(start) && start >= 0, `accessor ${accessorIndex}: invalid byteOffset`)
  assert.ok(Number.isSafeInteger(stride) && stride >= elementBytes, `accessor ${accessorIndex}: invalid byteStride`)
  assert.ok(start + (count - 1) * stride + elementBytes <= decoded.byteLength, `accessor ${accessorIndex}: decoded range exceeds bufferView`)
  const raw = Buffer.alloc(count * elementBytes)
  const values = Array.from({ length: count }, () => Array(components))
  const decodedView = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength)
  for (let row = 0; row < count; row += 1) {
    const rowOffset = start + row * stride
    raw.set(decoded.subarray(rowOffset, rowOffset + elementBytes), row * elementBytes)
    for (let component = 0; component < components; component += 1) {
      const value = normalizedComponent(decodedView, rowOffset + component * width, accessor.componentType, accessor.normalized === true)
      assert.ok(Number.isFinite(value), `accessor ${accessorIndex}[${row}][${component}]: non-finite value`)
      values[row][component] = value
    }
  }
  return {
    record: {
      type: accessor.type,
      componentType: accessor.componentType,
      normalized: accessor.normalized === true,
      count,
      sha256: sha256(raw),
    },
    values,
  }
}

function countAnimationChannels(json, nodeIndex) {
  return (json.animations ?? []).reduce((count, animation) => count + (animation.channels ?? [])
    .filter((channel) => channel?.target?.node === nodeIndex).length, 0)
}

function parentCounts(json) {
  const counts = Array(json.nodes.length).fill(0)
  for (const node of json.nodes) {
    for (const child of node.children ?? []) {
      assert.ok(Number.isSafeInteger(child) && child >= 0 && child < counts.length, 'production GLB: invalid child index')
      counts[child] += 1
    }
  }
  return counts
}

/** Raw physical decoder. It always enforces the immutable production byte pin. */
export async function decodePinnedProductionLogicalMappingEvidence(modelBytes) {
  const bytes = Buffer.isBuffer(modelBytes) ? modelBytes : Buffer.from(modelBytes)
  assertPin(bytes, PINNED_PRODUCTION_MODEL, 'production model')
  const { json, bin } = parseGlb(bytes)
  assert.equal(json.asset?.version, '2.0', 'production GLB: asset version changed')
  assert.equal(json.scene, 0, 'production GLB: active scene changed')
  assert.ok(Array.isArray(json.scenes) && json.scenes.length > 0, 'production GLB: scenes missing')
  assert.ok(Array.isArray(json.nodes), 'production GLB: nodes missing')
  assert.ok(Array.isArray(json.accessors), 'production GLB: accessors missing')
  assert.ok(Array.isArray(json.bufferViews), 'production GLB: bufferViews missing')
  assert.ok(Array.isArray(json.buffers) && json.buffers[0]?.byteLength <= bin.byteLength, 'production GLB: buffer 0/BIN mismatch')
  const roots = json.scenes[0]?.nodes
  assert.ok(Array.isArray(roots), 'production GLB: active scene roots missing')
  const parents = parentCounts(json)
  const decodedViews = new Map()
  const slots = []
  for (const rootPath of ROOT_PATHS) {
    const position = Number(rootPath.split('/').at(-1))
    const nodeIndex = roots[position]
    assert.ok(Number.isSafeInteger(nodeIndex), `${rootPath}: scene root missing`)
    const node = json.nodes[nodeIndex]
    assertRecord(node, `${rootPath}: node`)
    assert.equal(parents[nodeIndex], 0, `${rootPath}: node is not a scene root`)
    assertIdentity(nodeLocalMatrix(node), rootPath)
    assert.equal(countAnimationChannels(json, nodeIndex), 0, `${rootPath}: instancing root unexpectedly animated`)
    const attributes = node.extensions?.EXT_mesh_gpu_instancing?.attributes
    assertStrictKeys(attributes, ['TRANSLATION', 'ROTATION', 'SCALE'], `${rootPath}.EXT_mesh_gpu_instancing.attributes`)
    const decoded = {}
    const accessors = {}
    for (const semantic of ['TRANSLATION', 'ROTATION', 'SCALE']) {
      decoded[semantic] = await decodeAccessor(json, bin, attributes[semantic], decodedViews)
      accessors[semantic] = decoded[semantic].record
      assertExact(accessors[semantic], ACCESSOR_PINS[semantic], `${rootPath}:${semantic}`)
    }
    const matrices = Array.from({ length: COUNT }, (_, index) => composeThreeLoaderEquivalent(
      decoded.TRANSLATION.values[index],
      decoded.ROTATION.values[index],
      decoded.SCALE.values[index],
    ))
    slots.push({
      rootPath,
      accessors,
      matrixFloat64LEHex: matrices.map(matrixFloat64LEHex),
    })
  }
  for (let slot = 1; slot < slots.length; slot += 1) {
    assert.deepEqual(slots[slot].matrixFloat64LEHex, slots[0].matrixFloat64LEHex, `${slots[slot].rootPath}: TRS row order differs from first slot`)
  }
  const ownerPosition = Number(OWNER.activeScenePath.split('/').at(-1))
  const ownerIndex = roots[ownerPosition]
  assert.ok(Number.isSafeInteger(ownerIndex), `${OWNER.activeScenePath}: owner root missing`)
  const ownerNode = json.nodes[ownerIndex]
  assert.equal(ownerNode?.name, OWNER.nodeName, `${OWNER.activeScenePath}: owner name changed`)
  assert.equal(json.nodes.filter((node) => node?.name === OWNER.nodeName).length, 1, 'production GLB: intended owner name is not unique')
  assert.equal(parents[ownerIndex], 0, `${OWNER.activeScenePath}: intended owner is not a scene root`)
  assertIdentity(nodeLocalMatrix(ownerNode), OWNER.activeScenePath)
  const ownerEvidence = {
    nodeName: ownerNode.name,
    activeScenePath: OWNER.activeScenePath,
    sceneRoot: parents[ownerIndex] === 0,
    identityRestMatrix: true,
    animationChannels: countAnimationChannels(json, ownerIndex),
  }
  assertExact(ownerEvidence, OWNER, 'production owner evidence')
  return {
    model: { ...PINNED_PRODUCTION_MODEL },
    activeSceneIndex: json.scene,
    rootPaths: [...ROOT_PATHS],
    owner: ownerEvidence,
    slots,
  }
}

function parseAndValidateCertificate(certificateBytes, expectedPin) {
  const bytes = Buffer.isBuffer(certificateBytes) ? certificateBytes : Buffer.from(certificateBytes)
  assertPin(bytes, expectedPin, 'logical mapping certificate')
  let certificate
  try {
    certificate = JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    assert.fail(`logical mapping certificate: invalid JSON (${error.message})`)
  }
  assertStrictKeys(certificate, TOP_LEVEL_KEYS, 'certificate')
  assert.equal(certificate.schema, LOGICAL_MAPPING_SCHEMA, 'certificate.schema changed')
  assert.equal(certificate.version, LOGICAL_MAPPING_VERSION, 'certificate.version changed')
  assert.equal(certificate.status, 'approved-authoritative-logical-mapping', 'certificate.status must remain approved-authoritative-logical-mapping')
  assertExact(certificate.scope, EXPECTED_SCOPE, 'certificate.scope')
  assertExact(certificate.provenance, EXPECTED_PROVENANCE, 'certificate.provenance')
  assertExact(certificate.approval, EXPECTED_APPROVAL, 'certificate.approval')
  assertExact(certificate.target, EXPECTED_TARGET, 'certificate.target')
  assertExact(certificate.policy, HARD_POLICY, 'certificate.policy (hard caps cannot be relaxed)')
  assertExact(certificate.catalog, EXPECTED_CATALOG, 'certificate.catalog')
  assert.ok(Array.isArray(certificate.sources), 'certificate.sources: must be an array')
  assert.equal(certificate.sources.length, COUNT, 'certificate.sources: count changed')
  const names = sourceNames()
  const expectedPaths = names.map((name) => `Ground Floor._anim1/Ground Floor.BT_3/${name}`)
  const translations = []
  for (let index = 0; index < COUNT; index += 1) {
    const row = certificate.sources[index]
    assertStrictKeys(row, SOURCE_KEYS, `certificate.sources[${index}]`)
    assert.equal(row.sourceId, index, `certificate.sources[${index}].sourceId: non-canonical ID/order`)
    assert.equal(row.sourcePath, expectedPaths[index], `certificate.sources[${index}].sourcePath: named provenance path changed`)
    assert.equal(row.expectedProductionInstanceIndex, index, `certificate.sources[${index}].expectedProductionInstanceIndex: non-canonical row/order`)
    assert.ok(row.parity === 'positive' || row.parity === 'mirrored', `certificate.sources[${index}].parity: invalid`)
    translations.push(translationFromFloat64LEHex(row.referenceOwnerLocalTranslationFloat64LEHex, `certificate.sources[${index}].referenceOwnerLocalTranslationFloat64LEHex`))
  }
  assert.equal(new Set(certificate.sources.map((row) => row.sourceId)).size, COUNT, 'certificate.sources: duplicate sourceId')
  assert.equal(new Set(certificate.sources.map((row) => row.sourcePath)).size, COUNT, 'certificate.sources: duplicate sourcePath')
  assert.equal(new Set(certificate.sources.map((row) => row.expectedProductionInstanceIndex)).size, COUNT, 'certificate.sources: duplicate production index')
  assert.equal(sha256Stable(certificate.sources.map((row) => row.sourceId)), certificate.catalog.sourceIdsSha256, 'certificate.catalog.sourceIdsSha256: derived digest mismatch')
  assert.equal(sha256Stable(certificate.sources.map((row) => row.sourcePath)), certificate.catalog.sourcePathsSha256, 'certificate.catalog.sourcePathsSha256: derived digest mismatch')
  assert.equal(sha256Stable(certificate.sources.map((row) => row.expectedProductionInstanceIndex)), certificate.catalog.expectedProductionInstanceIndicesSha256, 'certificate.catalog.expectedProductionInstanceIndicesSha256: derived digest mismatch')
  assert.equal(sha256(Buffer.concat(certificate.sources.map((row) => Buffer.from(row.referenceOwnerLocalTranslationFloat64LEHex, 'hex')))), certificate.catalog.referenceTranslationsSha256, 'certificate.catalog.referenceTranslationsSha256: derived digest mismatch')
  assert.equal(sha256Stable(certificate.sources), certificate.catalog.rowRecordsSha256, 'certificate.catalog.rowRecordsSha256: derived digest mismatch')
  assert.equal(certificate.sources.filter((row) => row.parity === 'positive').length, certificate.catalog.positive, 'certificate.catalog.positive: derived count mismatch')
  assert.equal(certificate.sources.filter((row) => row.parity === 'mirrored').length, certificate.catalog.mirrored, 'certificate.catalog.mirrored: derived count mismatch')
  return { certificate, translations }
}

function validatePhysicalEvidence(evidence) {
  assertStrictKeys(evidence, ['model', 'activeSceneIndex', 'rootPaths', 'owner', 'slots'], 'physical evidence')
  assertExact(evidence.model, PINNED_PRODUCTION_MODEL, 'physical evidence.model')
  assert.equal(evidence.activeSceneIndex, 0, 'physical evidence.activeSceneIndex changed')
  assertExact(evidence.rootPaths, ROOT_PATHS, 'physical evidence.rootPaths')
  assertExact(evidence.owner, OWNER, 'physical evidence.owner')
  assert.ok(Array.isArray(evidence.slots) && evidence.slots.length === ROOT_PATHS.length, 'physical evidence.slots: count changed')
  for (let slot = 0; slot < evidence.slots.length; slot += 1) {
    const value = evidence.slots[slot]
    assertStrictKeys(value, ['rootPath', 'accessors', 'matrixFloat64LEHex'], `physical evidence.slots[${slot}]`)
    assert.equal(value.rootPath, ROOT_PATHS[slot], `physical evidence.slots[${slot}].rootPath changed`)
    assertExact(value.accessors, ACCESSOR_PINS, `physical evidence.slots[${slot}].accessors`)
    assert.ok(Array.isArray(value.matrixFloat64LEHex) && value.matrixFloat64LEHex.length === COUNT, `physical evidence.slots[${slot}].matrixFloat64LEHex: count changed`)
    value.matrixFloat64LEHex.forEach((hex, index) => matrixFromFloat64LEHex(hex, `physical evidence.slots[${slot}].matrixFloat64LEHex[${index}]`))
    if (slot > 0) assert.deepEqual(value.matrixFloat64LEHex, evidence.slots[0].matrixFloat64LEHex, `physical evidence.slots[${slot}]: transform rows differ`)
  }
  return evidence.slots[0].matrixFloat64LEHex.map((hex, index) => matrixFromFloat64LEHex(hex, `physical evidence matrix ${index}`))
}

function distance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

function ranked(values) {
  return values.map((value, index) => ({ index, distance: value }))
    .sort((left, right) => left.distance - right.distance || left.index - right.index)
}

function nearestSeparation(points) {
  let minimum = Number.POSITIVE_INFINITY
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) minimum = Math.min(minimum, distance(points[left], points[right]))
  }
  return minimum
}

/**
 * Test seam for semantic mutations after physical bytes have been decoded.
 * Production callers must use validateTrackedLogicalMappingCertificate(),
 * whose certificate and model pins cannot be overridden.
 */
export function validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(certificateBytes, physicalEvidence, expectedCertificatePin) {
  const { certificate, translations: references } = parseAndValidateCertificate(certificateBytes, expectedCertificatePin)
  const matrices = validatePhysicalEvidence(physicalEvidence)
  const production = matrices.map((matrix) => [matrix[12], matrix[13], matrix[14]])
  const distances = production.map((point) => references.map((reference) => distance(point, reference)))
  const fromProduction = distances.map(ranked)
  const fromReference = references.map((_, referenceIndex) => ranked(production.map((__, productionIndex) => distances[productionIndex][referenceIndex])))
  const mappedReferences = new Set()
  let maxMatchedDistanceMeters = 0
  let minRunnerUpMarginMeters = Number.POSITIVE_INFINITY
  let maxBestToRunnerUpRatio = 0
  let minRunnerUpDistanceMeters = Number.POSITIVE_INFINITY
  for (let productionIndex = 0; productionIndex < COUNT; productionIndex += 1) {
    const nearest = fromProduction[productionIndex]
    assert.ok(nearest[1].distance - nearest[0].distance > TIE_EPSILON, `mapping: ambiguous production row ${productionIndex}`)
    const referenceIndex = nearest[0].index
    assert.equal(fromReference[referenceIndex][0].index, productionIndex, `mapping: reciprocal nearest mismatch for production row ${productionIndex}`)
    assert.ok(fromReference[referenceIndex][1].distance - fromReference[referenceIndex][0].distance > TIE_EPSILON, `mapping: ambiguous reference row ${referenceIndex}`)
    assert.equal(certificate.sources[referenceIndex].expectedProductionInstanceIndex, productionIndex, `mapping: expected production index mismatch for source ${referenceIndex}`)
    const physicalParity = determinant3(matrices[productionIndex]) > 0 ? 'positive' : 'mirrored'
    assert.equal(certificate.sources[referenceIndex].parity, physicalParity, `mapping: parity mismatch for source ${referenceIndex}`)
    mappedReferences.add(referenceIndex)
    maxMatchedDistanceMeters = Math.max(maxMatchedDistanceMeters, nearest[0].distance)
    minRunnerUpMarginMeters = Math.min(
      minRunnerUpMarginMeters,
      nearest[1].distance - nearest[0].distance,
      fromReference[referenceIndex][1].distance - fromReference[referenceIndex][0].distance,
    )
    minRunnerUpDistanceMeters = Math.min(minRunnerUpDistanceMeters, nearest[1].distance, fromReference[referenceIndex][1].distance)
    maxBestToRunnerUpRatio = Math.max(
      maxBestToRunnerUpRatio,
      nearest[0].distance / nearest[1].distance,
      fromReference[referenceIndex][0].distance / fromReference[referenceIndex][1].distance,
    )
  }
  assert.equal(mappedReferences.size, COUNT, 'mapping: nearest-neighbor relation is not bijective')
  assert.ok(maxMatchedDistanceMeters <= HARD_POLICY.maxMatchedDistanceMeters, `mapping: maximum matched distance ${maxMatchedDistanceMeters} exceeds ${HARD_POLICY.maxMatchedDistanceMeters} m`)
  assert.ok(minRunnerUpMarginMeters >= HARD_POLICY.minRunnerUpMarginMeters, `mapping: minimum runner-up margin ${minRunnerUpMarginMeters} is below ${HARD_POLICY.minRunnerUpMarginMeters} m`)
  assert.ok(maxBestToRunnerUpRatio <= HARD_POLICY.maxBestToRunnerUpRatio, `mapping: maximum best/runner-up ratio ${maxBestToRunnerUpRatio} exceeds ${HARD_POLICY.maxBestToRunnerUpRatio}`)
  const productionTransformSetSha256 = sha256Stable(certificate.sources.map((row, sourceIndex) => ({
    sourceIndex,
    name: row.sourcePath.split('/').at(-1),
    matrixFloat64LEHex: matrixFloat64LEHex(matrices[row.expectedProductionInstanceIndex]),
  })))
  assert.equal(productionTransformSetSha256, PRODUCTION_TRANSFORM_SHA256, 'mapping: production transform set/order digest changed')
  return {
    schema: 'IOM_REPEAT_SIX_PART_LOGICAL_MAPPING_VALIDATION_RESULT_V1',
    evidenceValidated: true,
    technicalMappingPassed: true,
    provenanceApproved: true,
    logicalOwnershipMappingPassed: true,
    activationBlocked: true,
    certificateStatus: certificate.status,
    approvalStatus: certificate.approval.status,
    approval: { ...certificate.approval },
    reason: 'The project owner explicitly approved the pinned source-path-to-production-row certificate; runtime, transition, browser, performance, and activation gates remain outside this approval.',
    approvedMappingRows: certificate.sources.map((row) => ({
      sourceId: row.sourceId,
      sourcePath: row.sourcePath,
      productionInstanceIndex: row.expectedProductionInstanceIndex,
      parity: row.parity,
    })),
    sourceCount: COUNT,
    productionRootCount: ROOT_PATHS.length,
    productionTransformSetSha256,
    metrics: {
      maxMatchedDistanceMeters,
      minRunnerUpMarginMeters,
      maxBestToRunnerUpRatio,
      minRunnerUpDistanceMeters,
      minReferenceSeparationMeters: nearestSeparation(references),
      minProductionSeparationMeters: nearestSeparation(production),
    },
    hardPolicy: { ...HARD_POLICY },
    inputs: {
      certificate: { ...expectedCertificatePin },
      productionModel: { ...PINNED_PRODUCTION_MODEL },
    },
  }
}

/** Authoritative two-input validator. */
export async function validateTrackedLogicalMappingCertificate() {
  const [certificateBytes, modelBytes] = await Promise.all([
    readFile(TRACKED_CERTIFICATE_PATH),
    readFile(PINNED_PRODUCTION_MODEL_PATH),
  ])
  const physicalEvidence = await decodePinnedProductionLogicalMappingEvidence(modelBytes)
  return validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(
    certificateBytes,
    physicalEvidence,
    TRACKED_CERTIFICATE_PIN,
  )
}

async function main() {
  const result = await validateTrackedLogicalMappingCertificate()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(`FAIL: ${error.stack ?? error.message}`)
    process.exitCode = 1
  })
}
