/**
 * Emit and physically audit a dormant manifest-v4 from the ignored exact
 * six-part pilot. This does not copy payloads or touch runtime/public routing.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  REPEAT_SIX_PART_COHORT_MODE,
  REPEAT_SIX_PART_COHORT_SCHEMA_V4,
  computeRepeatSixPartCohortDigests,
  reviewRepeatSixPartCohortManifestV4Activation,
  validateRepeatSixPartCohortManifestV4,
} from './validate-repeat-six-part-cohort-manifest-v4.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const PILOT_ROOT = resolve(VIEWER_ROOT, 'tmp/repeat-six-part-exact-pilot')
const OUTPUT_ROOT = resolve(VIEWER_ROOT, 'tmp/repeat-six-part-cohort-v4')
const PATHS = Object.freeze({
  productionWebModel: resolve(VIEWER_ROOT, '../public/models/icm-anim-2025/model-web.glb'),
  directProductionGeometry: resolve(PILOT_ROOT, 'production-source/exact-six-segment-production-source.glb'),
  directProductionSourceMap: resolve(PILOT_ROOT, 'production-source/production-source-map.json'),
  directProductionPhysicalAudit: resolve(PILOT_ROOT, 'production-source/physical-audit.json'),
  index: resolve(PILOT_ROOT, 'candidate-index.json'),
  cohortPhysicalAudit: resolve(PILOT_ROOT, 'physical-audit.json'),
  geometry: resolve(PILOT_ROOT, 'payloads/shared/exact-six-segment-geometry.glb'),
  cohortTable: resolve(PILOT_ROOT, 'payloads/web/exact-six-segment-cohort.bin'),
  ownership: resolve(PILOT_ROOT, 'payloads/web/exact-six-segment-ownership.json'),
  manifest: resolve(OUTPUT_ROOT, 'manifest-v4.disabled.json'),
  audit: resolve(OUTPUT_ROOT, 'physical-audit-v4.json'),
})

const EXPECTED = Object.freeze({
  magic: 'IOM6PRT2',
  tableVersion: 2,
  headerBytes: 80,
  sourceCount: 78,
  segmentCount: 6,
  unitCount: 468,
  matrixStrideBytes: 128,
  boundsStrideBytes: 48,
  keyStrideBytes: 8,
  ownerNodeName: 'Ground Floor._anim1',
})

const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function json(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function glbJson(bytes, label) {
  assert.ok(bytes.length >= 20, `${label} is shorter than a GLB header and JSON chunk`)
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${label} magic mismatch`)
  assert.equal(bytes.readUInt32LE(4), 2, `${label} must be GLB version 2`)
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${label} declared length mismatch`)
  const jsonLength = bytes.readUInt32LE(12)
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, `${label} first chunk must be JSON`)
  assert.ok(20 + jsonLength <= bytes.length, `${label} JSON chunk escapes the file`)
  return json(bytes.subarray(20, 20 + jsonLength), `${label} JSON chunk`)
}

function nodeLocalMatrix(node) {
  if (Array.isArray(node.matrix)) {
    assert.equal(node.matrix.length, 16, 'owner node matrix must contain 16 components')
    assert.ok(node.matrix.every(Number.isFinite), 'owner node matrix must be finite')
    return node.matrix
  }
  const translation = node.translation ?? [0, 0, 0]
  const rotation = node.rotation ?? [0, 0, 0, 1]
  const scale = node.scale ?? [1, 1, 1]
  assert.equal(translation.length, 3, 'owner translation must contain 3 components')
  assert.equal(rotation.length, 4, 'owner rotation must contain 4 components')
  assert.equal(scale.length, 3, 'owner scale must contain 3 components')
  assert.ok([...translation, ...rotation, ...scale].every(Number.isFinite), 'owner TRS must be finite')
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

async function requireInputs() {
  const missing = []
  for (const [key, path] of Object.entries(PATHS)) {
    if (key === 'manifest' || key === 'audit') continue
    try {
      await access(path)
    } catch {
      missing.push(relative(VIEWER_ROOT, path).replaceAll('\\', '/'))
    }
  }
  if (missing.length) {
    throw new Error(
      'Exact six-part physical pilot is absent or incomplete. Build/restore it before emitting manifest-v4. Missing:\n' +
      missing.map((path) => `  - ${path}`).join('\n'),
    )
  }
}

function assetRecord(url, bytes) {
  return { url, bytes: bytes.length, sha256: sha256(bytes) }
}

function assertPinned(actual, declared, path) {
  assert.equal(declared?.bytes, actual.bytes, `${path}.bytes is stale`)
  assert.equal(declared?.sha256, actual.sha256, `${path}.sha256 is stale`)
}

function decodeTable(bytes) {
  assert.ok(bytes.length >= EXPECTED.headerBytes, 'cohort BIN is shorter than its fixed header')
  assert.equal(bytes.subarray(0, 8).toString('ascii'), EXPECTED.magic, 'cohort BIN magic mismatch')
  assert.equal(bytes.readUInt32LE(8), EXPECTED.tableVersion, 'cohort BIN version mismatch')
  assert.equal(bytes.readUInt32LE(12), EXPECTED.sourceCount, 'cohort BIN source count mismatch')
  assert.equal(bytes.readUInt32LE(16), EXPECTED.segmentCount, 'cohort BIN segment count mismatch')
  assert.equal(bytes.readUInt32LE(20), EXPECTED.unitCount, 'cohort BIN unit count mismatch')
  const canonicalOffset = bytes.readUInt32LE(24)
  const canonicalStride = bytes.readUInt32LE(28)
  const renderOffset = bytes.readUInt32LE(32)
  const renderStride = bytes.readUInt32LE(36)
  const boundsOffset = bytes.readUInt32LE(40)
  const boundsStride = bytes.readUInt32LE(44)
  const keysOffset = bytes.readUInt32LE(48)
  const keysStride = bytes.readUInt32LE(52)
  const totalBytes = bytes.readUInt32LE(56)
  assert.equal(bytes.readUInt32LE(60), 0x01020304, 'cohort BIN endian marker mismatch')
  assert.equal(canonicalOffset, EXPECTED.headerBytes, 'cohort BIN canonical matrix offset mismatch')
  assert.equal(canonicalStride, EXPECTED.matrixStrideBytes, 'cohort BIN canonical matrix stride mismatch')
  assert.equal(renderOffset, canonicalOffset + EXPECTED.sourceCount * canonicalStride, 'cohort BIN render matrix offset mismatch')
  assert.equal(renderStride, EXPECTED.matrixStrideBytes, 'cohort BIN render matrix stride mismatch')
  assert.equal(boundsOffset, renderOffset + EXPECTED.sourceCount * renderStride, 'cohort BIN bounds offset mismatch')
  assert.equal(boundsStride, EXPECTED.boundsStrideBytes, 'cohort BIN bounds stride mismatch')
  assert.equal(keysOffset, boundsOffset + EXPECTED.unitCount * boundsStride, 'cohort BIN key offset mismatch')
  assert.equal(keysStride, EXPECTED.keyStrideBytes, 'cohort BIN key stride mismatch')
  assert.equal(totalBytes, keysOffset + EXPECTED.unitCount * keysStride, 'cohort BIN total length formula mismatch')
  assert.equal(totalBytes, bytes.length, 'cohort BIN declared length mismatch')

  const readMatrix = (base) => Array.from({ length: 16 }, (_, component) => bytes.readDoubleLE(base + component * 8))
  const canonicalMatrices = Array.from({ length: EXPECTED.sourceCount }, (_, index) => readMatrix(canonicalOffset + index * canonicalStride))
  const renderLocalMatrices = Array.from({ length: EXPECTED.sourceCount }, (_, index) => readMatrix(renderOffset + index * renderStride))
  const bounds = Array.from({ length: EXPECTED.unitCount }, (_, index) => {
    const base = boundsOffset + index * boundsStride
    return {
      space: 'owner-local',
      min: [0, 1, 2].map((axis) => bytes.readDoubleLE(base + axis * 8)),
      max: [0, 1, 2].map((axis) => bytes.readDoubleLE(base + (axis + 3) * 8)),
    }
  })
  const keys = Array.from({ length: EXPECTED.unitCount }, (_, index) => {
    const base = keysOffset + index * keysStride
    return { sourceIndex: bytes.readUInt32LE(base), segmentIndex: bytes.readUInt32LE(base + 4) }
  })
  keys.forEach((key, index) => {
    assert.equal(key.sourceIndex, Math.floor(index / EXPECTED.segmentCount), `cohort BIN key ${index} violates source-major order`)
    assert.equal(key.segmentIndex, index % EXPECTED.segmentCount, `cohort BIN key ${index} violates segment-major order`)
  })
  assert.equal(new Set(keys.map((key) => `${key.sourceIndex}:${key.segmentIndex}`)).size, EXPECTED.unitCount, 'cohort BIN has duplicate source/segment keys')
  return { canonicalMatrices, renderLocalMatrices, bounds, keys }
}

function unionBounds(bounds) {
  return {
    space: 'owner-local',
    min: [0, 1, 2].map((axis) => Math.min(...bounds.map((entry) => entry.min[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...bounds.map((entry) => entry.max[axis]))),
  }
}

function virtualUrl(path) {
  const pathFromViewer = relative(VIEWER_ROOT, path).replaceAll('\\', '/')
  assert.ok(!pathFromViewer.startsWith('../'), `payload escapes viewer root: ${path}`)
  return `/${pathFromViewer}`
}

await requireInputs()
const [
  productionWebModelBytes,
  directProductionGeometryBytes,
  directProductionSourceMapBytes,
  directProductionPhysicalAuditBytes,
  indexBytes,
  cohortAuditBytes,
  geometryBytes,
  cohortBytes,
  ownershipBytes,
] = await Promise.all([
  readFile(PATHS.productionWebModel),
  readFile(PATHS.directProductionGeometry),
  readFile(PATHS.directProductionSourceMap),
  readFile(PATHS.directProductionPhysicalAudit),
  readFile(PATHS.index),
  readFile(PATHS.cohortPhysicalAudit),
  readFile(PATHS.geometry),
  readFile(PATHS.cohortTable),
  readFile(PATHS.ownership),
])
const index = json(indexBytes, 'candidate-index.json')
const pilotAudit = json(cohortAuditBytes, 'physical-audit.json')
const ownership = json(ownershipBytes, 'exact-six-segment-ownership.json')
const directProductionSourceMap = json(directProductionSourceMapBytes, 'production-source-map.json')
const directProductionPhysicalAudit = json(directProductionPhysicalAuditBytes, 'direct-production physical-audit.json')
const productionWebModel = glbJson(productionWebModelBytes, 'production model-web.glb')

assert.equal(index.schema, 'IOM_REPEAT_SIX_PART_EXACT_COHORT_CANDIDATE_V2', 'unexpected physical pilot index schema')
assert.equal(index.enabled, false, 'physical pilot must remain disabled')
assert.equal(index.runtimeIntegrated, false, 'physical pilot must not claim runtime integration')
assert.equal(index.activationApproved, false, 'physical pilot must not claim activation approval')
assert.equal(index.productionRoutingChanged, false, 'physical pilot must not change production routing')
assert.equal(pilotAudit.status, 'pass-disabled-not-activation-approval', 'physical pilot audit did not pass its disabled gate')
assert.equal(ownership.schema, 'IOM_REPEAT_SIX_PART_EXACT_COHORT_OWNERSHIP_V2', 'unexpected ownership schema')
assert.equal(ownership.enabled, false, 'ownership payload must remain disabled')
assert.equal(directProductionSourceMap.schema, 'IOM_REPEAT_SIX_PART_PRODUCTION_SOURCE_MAP', 'unexpected direct-production source-map schema')
assert.equal(directProductionSourceMap.disabled, true, 'direct-production source map must remain disabled')
assert.equal(directProductionSourceMap.runtimeIntegrated, false, 'direct-production source map must not claim runtime integration')
assert.equal(directProductionSourceMap.instances?.length, EXPECTED.sourceCount, 'direct-production source-map count mismatch')
assert.equal(directProductionPhysicalAudit.schema, 'IOM_REPEAT_SIX_PART_PRODUCTION_SOURCE_PHYSICAL_AUDIT', 'unexpected direct-production physical audit schema')
assert.equal(directProductionPhysicalAudit.status, 'PASS', 'direct-production physical source audit did not pass')
assert.equal(directProductionPhysicalAudit.disabled, true, 'direct-production physical source must remain disabled')
assert.equal(directProductionPhysicalAudit.runtimeIntegrated, false, 'direct-production physical source must not claim runtime integration')
assert.deepEqual(pilotAudit.inputs, index.sourcePins, 'cohort audit and index direct-production source pins differ')

const physicalProductionPins = {
  productionModel: { relativePath: index.sourcePins.productionModel.relativePath, bytes: productionWebModelBytes.length, sha256: sha256(productionWebModelBytes) },
  directProductionGeometry: { path: index.sourcePins.directProductionGeometry.path, bytes: directProductionGeometryBytes.length, sha256: sha256(directProductionGeometryBytes) },
  directProductionSourceMap: { path: index.sourcePins.directProductionSourceMap.path, bytes: directProductionSourceMapBytes.length, sha256: sha256(directProductionSourceMapBytes) },
  directProductionPhysicalAudit: { path: index.sourcePins.directProductionPhysicalAudit.path, bytes: directProductionPhysicalAuditBytes.length, sha256: sha256(directProductionPhysicalAuditBytes) },
}
for (const key of Object.keys(physicalProductionPins)) {
  assertPinned(physicalProductionPins[key], index.sourcePins[key], `candidate-index.sourcePins.${key}`)
}
assert.equal(directProductionSourceMap.transformSetSha256, index.ownership.transformSetSha256, 'direct-production source-map transform-set pin mismatch')
assert.equal(ownership.digests.transformSetSha256, index.ownership.transformSetSha256, 'cohort ownership transform-set pin mismatch')
assert.equal(directProductionSourceMap.sourceModel.bytes, physicalProductionPins.productionModel.bytes, 'direct-production source-map model byte pin mismatch')
assert.equal(directProductionSourceMap.sourceModel.sha256, physicalProductionPins.productionModel.sha256, 'direct-production source-map model hash pin mismatch')
assert.equal(directProductionPhysicalAudit.sourceModel.bytes, physicalProductionPins.productionModel.bytes, 'direct-production audit production-model byte pin mismatch')
assert.equal(directProductionPhysicalAudit.transforms.transformSetSha256, index.ownership.transformSetSha256, 'direct-production audit transform-set pin mismatch')
assert.equal(directProductionPhysicalAudit.sourceModel.sha256, physicalProductionPins.productionModel.sha256, 'direct-production audit production-model pin mismatch')
assert.equal(directProductionPhysicalAudit.geometry.written.sha256, index.exactness.canonicalGeometryMaterialDigestSha256, 'direct-production geometry digest mismatch')
assert.equal(directProductionPhysicalAudit.outputs.geometry.sha256, physicalProductionPins.directProductionGeometry.sha256, 'direct-production audit geometry byte pin mismatch')
assert.deepEqual(directProductionSourceMap.logicalMappingCertificate, directProductionPhysicalAudit.logicalMappingCertificate,
  'direct-production logical mapping certificate differs between source map and physical audit')
assert.deepEqual(directProductionSourceMap.logicalMappingCertificate, pilotAudit.transformsAndIdentity.logicalMappingCertificate,
  'cohort audit did not carry the approved direct-production logical mapping certificate')
assert.deepEqual(directProductionSourceMap.logicalMappingCertificate, index.ownership.logicalMappingCertificate,
  'candidate index did not carry the approved direct-production logical mapping certificate')
assert.equal(directProductionSourceMap.logicalMappingCertificate.evidenceValidated, true, 'logical mapping evidence is not validated')
assert.equal(directProductionSourceMap.logicalMappingCertificate.technicalMappingPassed, true, 'logical mapping technical proof did not pass')
assert.equal(directProductionSourceMap.logicalMappingCertificate.provenanceApproved, true, 'logical mapping lacks project-owner approval')
assert.equal(directProductionSourceMap.logicalMappingCertificate.logicalOwnershipMappingPassed, true, 'logical ownership mapping did not pass')
assert.equal(directProductionSourceMap.logicalMappingCertificate.activationBlocked, true, 'logical mapping approval must remain activation-blocked')
assert.equal(pilotAudit.transformsAndIdentity.logicalOwnershipMappingPassed, true, 'cohort audit logical ownership gate did not pass')
assert.equal(index.gates.logicalOwnershipMappingPassed, true, 'candidate logical ownership gate did not pass')
assert.equal(index.gates.physicalTransformsAndParityPassed, true, 'candidate physical transform/parity gate did not pass')
assert.equal(
  index.gates.identityAndParityPassed,
  index.gates.logicalOwnershipMappingPassed && index.gates.physicalTransformsAndParityPassed,
  'candidate identity/parity gate must equal logical ownership AND physical transform/parity evidence',
)

const ownerNodes = (productionWebModel.nodes ?? []).filter((node) => node?.name === EXPECTED.ownerNodeName)
assert.equal(ownerNodes.length, 1, `production model must contain exactly one ${EXPECTED.ownerNodeName} owner node`)
const ownerMatrix = nodeLocalMatrix(ownerNodes[0])
const ownerNodeIndex = (productionWebModel.nodes ?? []).indexOf(ownerNodes[0])
const activeSceneIndex = productionWebModel.scene ?? 0
const activeSceneRoots = productionWebModel.scenes?.[activeSceneIndex]?.nodes ?? []
const ownerSceneRootIndex = activeSceneRoots.indexOf(ownerNodeIndex)
assert.ok(ownerSceneRootIndex >= 0, 'production Ground Floor owner is not a root of the active scene')
const ownerActiveScenePath = `scene/${activeSceneIndex}/${ownerSceneRootIndex}`
const ownerAnimationChannels = (productionWebModel.animations ?? []).flatMap((animation) => animation.channels ?? [])
  .filter((channel) => channel.target?.node === ownerNodeIndex).length
assert.deepEqual(ownerMatrix, IDENTITY, 'production Ground Floor owner local matrix is no longer identity')
assert.equal(ownerAnimationChannels, 0, 'production Ground Floor owner unexpectedly became animated')
assert.equal(directProductionSourceMap.owner.nodeName, EXPECTED.ownerNodeName, 'direct-production source-map owner mismatch')
assert.equal(directProductionSourceMap.owner.attachmentSpace, 'owner-local', 'direct-production attachment space mismatch')
assert.deepEqual(directProductionSourceMap.productionNodeWorldMatrix, IDENTITY, 'direct-production instancing host basis is no longer identity')
assert.equal(directProductionPhysicalAudit.identification.intendedOwnerRestBasis.nodeName, EXPECTED.ownerNodeName, 'direct-production audited owner mismatch')
assert.equal(directProductionPhysicalAudit.identification.intendedOwnerRestBasis.activeScenePath, ownerActiveScenePath, 'direct-production owner active-scene path mismatch')
assert.equal(directProductionPhysicalAudit.identification.intendedOwnerRestBasis.sceneRoot, true, 'direct-production owner must remain a scene root')
assert.equal(directProductionPhysicalAudit.identification.intendedOwnerRestBasis.identityRestMatrix, true, 'direct-production owner basis must remain identity')
assert.equal(directProductionPhysicalAudit.identification.intendedOwnerRestBasis.animationChannels, ownerAnimationChannels, 'direct-production owner animation-channel count mismatch')

const sourcePins = {
  modelId: 'icm-anim-2025',
  productionModel: physicalProductionPins.productionModel,
  directProductionGeometry: physicalProductionPins.directProductionGeometry,
  directProductionSourceMap: {
    ...physicalProductionPins.directProductionSourceMap,
    transformSetSha256: directProductionSourceMap.transformSetSha256,
  },
  directProductionPhysicalAudit: physicalProductionPins.directProductionPhysicalAudit,
  owner: {
    nodeName: EXPECTED.ownerNodeName,
    descendantPath: directProductionSourceMap.owner.descendantPath,
    activeScenePath: ownerActiveScenePath,
    attachmentSpace: directProductionSourceMap.owner.attachmentSpace,
    sceneRoot: true,
    identityRestMatrix: true,
    animationChannels: ownerAnimationChannels,
    matrix: ownerMatrix,
  },
}

const physical = {
  geometry: assetRecord(virtualUrl(PATHS.geometry), geometryBytes),
  cohortTable: assetRecord(virtualUrl(PATHS.cohortTable), cohortBytes),
  ownership: assetRecord(virtualUrl(PATHS.ownership), ownershipBytes),
}
assertPinned(physical.geometry, index.payloads.geometry, 'candidate-index.payloads.geometry')
assertPinned(physical.cohortTable, index.payloads.cohortTable, 'candidate-index.payloads.cohortTable')
assertPinned(physical.ownership, index.payloads.ownership, 'candidate-index.payloads.ownership')
assert.equal(physical.geometry.bytes, physicalProductionPins.directProductionGeometry.bytes, 'runtime geometry and direct-production geometry byte counts differ')
assert.equal(physical.geometry.sha256, physicalProductionPins.directProductionGeometry.sha256, 'runtime geometry is not the exact direct-production geometry')

const table = decodeTable(cohortBytes)
assert.equal(ownership.instances.length, EXPECTED.sourceCount, 'ownership source count mismatch')
assert.equal(ownership.segments.length, EXPECTED.segmentCount, 'ownership segment count mismatch')

const segments = ownership.segments.map((segment, segmentIndex) => {
  assert.equal(segment.segmentId, segmentIndex, `ownership segment ${segmentIndex} is out of order`)
  return {
    index: segmentIndex,
    id: `segment-${String(segmentIndex).padStart(2, '0')}`,
    triangles: segment.triangles,
    materialPrimitiveCount: ownership.materialRoles.length,
    bounds: {
      space: 'source-row-local',
      min: segment.measuredReferencedAccessorBounds.min,
      max: segment.measuredReferencedAccessorBounds.max,
    },
  }
})

const units = table.keys.map((key, indexInCatalog) => ({
  index: indexInCatalog,
  id: `source-${String(key.sourceIndex).padStart(2, '0')}:segment-${String(key.segmentIndex).padStart(2, '0')}`,
  sourceIndex: key.sourceIndex,
  sourceId: `source-${String(key.sourceIndex).padStart(2, '0')}`,
  segmentIndex: key.segmentIndex,
  segmentId: `segment-${String(key.segmentIndex).padStart(2, '0')}`,
  bounds: table.bounds[indexInCatalog],
  triangles: segments[key.segmentIndex].triangles,
}))

const sources = ownership.instances.map((instance, sourceIndex) => {
  assert.equal(instance.sourceId, sourceIndex, `ownership instance ${sourceIndex} sourceId mismatch`)
  assert.equal(instance.matrixTableIndex, sourceIndex, `ownership instance ${sourceIndex} matrix table index mismatch`)
  const sourceUnits = units.slice(sourceIndex * EXPECTED.segmentCount, (sourceIndex + 1) * EXPECTED.segmentCount)
  return {
    index: sourceIndex,
    id: `source-${String(sourceIndex).padStart(2, '0')}`,
    path: instance.sourcePath,
    parity: instance.parity,
    canonicalMatrix: { space: 'owner-local', matrix: table.canonicalMatrices[sourceIndex] },
    renderLocalMatrix: { space: 'parity-host-local', matrix: table.renderLocalMatrices[sourceIndex] },
    bounds: unionBounds(sourceUnits.map((unit) => unit.bounds)),
  }
})

const manifest = {
  schema: REPEAT_SIX_PART_COHORT_SCHEMA_V4,
  version: 4,
  enabled: false,
  modelId: 'icm-anim-2025',
  platform: 'web',
  units: 'meters',
  mode: REPEAT_SIX_PART_COHORT_MODE,
  capabilities: {
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
  },
  owner: { id: 'ground-floor-anim1', nodeName: index.owner },
  sourcePins,
  payloads: {
    geometry: { order: 0, role: 'exact-six-segment-geometry', mediaType: 'model/gltf-binary', ...physical.geometry },
    cohortTable: { order: 1, role: 'exact-six-segment-cohort-table', mediaType: 'application/octet-stream', ...physical.cohortTable },
    ownership: { order: 2, role: 'exact-six-segment-ownership', mediaType: 'application/json', ...physical.ownership },
  },
  geometry: {
    sourceRowTriangles: pilotAudit.exactGeometry.output.triangles,
    materialSlots: ownership.materialRoles.length,
    physicalPrimitiveCount: index.metrics.physicalGeometryPrimitives,
    canonicalGeometryDigestSha256: pilotAudit.exactGeometry.output.sha256,
    exactTriangleMaterialBijection: pilotAudit.exactGeometry.triangleBijection,
    exactPositionBits: pilotAudit.exactGeometry.positionFloat32BitsPreserved,
    exactNormalBits: pilotAudit.exactGeometry.normalInt16StorageBitsAndNormalizationPreserved,
    exactWinding: pilotAudit.exactGeometry.windingPreserved,
    segments,
  },
  parity: {
    canonicalMatrixSpace: 'owner-local',
    renderLocalMatrixSpace: 'parity-host-local',
    composition: 'host-times-render-local',
    requirePositiveRenderLocalDeterminant: true,
    epsilon: 1e-8,
    hosts: {
      positive: { space: 'owner-local', matrix: ownership.parityBatchContract.positive.hostMatrix },
      mirrored: { space: 'owner-local', matrix: ownership.parityBatchContract.mirrored.hostMatrix },
    },
    materialDrawsPerActiveGroup: ownership.materialRoles.length,
    possibleGroupCount: index.sweeps.activeDrawPeak.possibleGroups,
    persistentRendererTemplates: index.metrics.persistentParitySafeRendererTemplates,
  },
  selector: {
    boundsSpace: 'owner-local',
    boundsType: 'closed-aabb',
    // Matches Box3.expandByScalar(margin).containsPoint and the exact
    // closed-AABB endpoint sweep used by the physical residency proof.
    distanceMetric: 'linf-point-to-closed-aabb',
    enterMarginMeters: index.policy.innerEnvelopeMeters,
    exitMarginMeters: index.policy.exactSelectionMarginMeters,
    states: ['active', 'culled'],
    defaultState: 'culled',
  },
  catalog: { order: 'source-major-segment-major', defaultState: 'culled', sources, units },
  digests: {},
  budgets: {
    repeatFamilyResidentTriangles: index.policy.repeatFamilyResidentLimit,
    repeatFamilyTransitionTriangles: index.policy.repeatFamilyTransitionLimit,
    totalResidentTriangles: index.policy.totalResidentLimit,
    totalTransitionTriangles: index.policy.totalTransitionLimit,
    allOtherOwnerReservationTriangles: index.policy.allOtherOwnerReservation,
    maxActiveDraws: 48,
    maxPersistentRendererTemplates: 48,
    maxRuntimePayloadRequests: 3,
    maxRuntimePayloadBytes: 3_000_000,
    maxManifestBytes: 1_048_576,
    maxColdContractRequests: 4,
    maxColdContractBytes: 4_048_576,
  },
  proof: {
    residentSweep: {
      method: 'exact-closed-aabb-endpoint-sweep',
      marginMeters: index.sweeps.outer.marginMeters,
      maxSelectedTriangles: index.sweeps.outer.triangles,
      totalWithReservationTriangles: index.sweeps.allOwnerReservedResidentTriangles,
      selectedUnitCount: index.sweeps.outer.selectedUnits,
      activeDraws: index.sweeps.outer.projectedParitySafeInstancedDraws,
      witness: index.sweeps.outer.witness,
    },
    activeDrawSweep: {
      method: 'exact-closed-aabb-endpoint-sweep',
      maxActiveDraws: index.sweeps.activeDrawPeak.draws,
      activeParitySegmentGroups: index.sweeps.activeDrawPeak.activeGroups,
      witness: index.sweeps.activeDrawPeak.point,
    },
    transition: {
      model: 'ordered-one-row-or-unordered-double-buffer',
      oneRowArithmeticRepeatTriangles: index.sweeps.transitions.arithmeticScenarios.oneWholeRowOverlapRepeatTriangles,
      oneRowArithmeticTotalWithReservationTriangles: index.sweeps.transitions.arithmeticScenarios.oneWholeRowOverlapAllOwnerReservedTriangles,
      unorderedDoubleBufferRepeatTriangles: index.sweeps.transitions.unorderedDoubleBufferUpperBoundRepeatTriangles,
      unorderedDoubleBufferTotalWithReservationTriangles: index.sweeps.transitions.unorderedDoubleBufferUpperBoundAllOwnerReservedTriangles,
      arbitraryConcurrentOverlapProven: index.sweeps.transitions.arbitraryConcurrentOverlapProven,
      runtimeOrderingEnforced: index.sweeps.transitions.runtimeOrderingEnforced,
    },
    persistentRendererTemplates: index.metrics.persistentParitySafeRendererTemplates,
    payloadOnlyRequests: index.metrics.runtimePayloadRequests,
    payloadOnlyBytes: Object.values(physical).reduce((sum, asset) => sum + asset.bytes, 0),
    manifestRequests: 1,
    manifestBytes: 1,
    coldContractRequests: index.metrics.runtimePayloadRequests + 1,
    coldContractBytes: Object.values(physical).reduce((sum, asset) => sum + asset.bytes, 0) + 1,
  },
  gates: {
    exactGeometryPassed: index.gates.exactGeometryPassed,
    identityAndParityPassed: index.gates.identityAndParityPassed,
    physicalBoundsPassed: index.gates.physicalBoundsPassed,
    residentBudgetPassed: index.gates.repeatResidentBudgetPassed && index.gates.reservedAllOwnerResidentBudgetPassed,
    transitionBudgetPassed: index.gates.transitionBudgetPassed,
    runtimeIntegrationPassed: false,
    runtimeConcurrencyPassed: false,
    browserVisualWitnessPassed: false,
    measuredPerformancePassed: false,
    activationApproved: false,
  },
}
manifest.digests = computeRepeatSixPartCohortDigests(manifest)

let manifestText = ''
for (let iteration = 0; iteration < 16; iteration += 1) {
  manifestText = `${JSON.stringify(manifest, null, 2)}\n`
  const bytes = Buffer.byteLength(manifestText)
  const coldBytes = manifest.proof.payloadOnlyBytes + bytes
  if (manifest.proof.manifestBytes === bytes && manifest.proof.coldContractBytes === coldBytes) break
  manifest.proof.manifestBytes = bytes
  manifest.proof.coldContractBytes = coldBytes
}
manifestText = `${JSON.stringify(manifest, null, 2)}\n`
assert.equal(Buffer.byteLength(manifestText), manifest.proof.manifestBytes, 'manifest byte pin did not converge')
assert.equal(
  manifest.proof.coldContractBytes,
  manifest.proof.payloadOnlyBytes + manifest.proof.manifestBytes,
  'cold contract byte accounting did not converge',
)

const observedPayloads = Object.fromEntries(Object.values(physical).map((asset) => [asset.url, { bytes: asset.bytes, sha256: asset.sha256 }]))
const observedManifest = { bytes: manifest.proof.manifestBytes, sha256: sha256(Buffer.from(manifestText)) }
const validation = validateRepeatSixPartCohortManifestV4(manifest, {
  observedPayloads,
  observedManifest,
  requirePhysicalPins: true,
})
if (!validation.valid) throw new Error(`Emitted physical manifest-v4 failed:\n${validation.errors.map((error) => `  - ${error}`).join('\n')}`)
const activation = reviewRepeatSixPartCohortManifestV4Activation(manifest, {
  observedPayloads,
  observedManifest,
})
assert.equal(activation.contractValid, true)
assert.equal(activation.physicalPayloadPinsVerified, true)
assert.equal(activation.physicalManifestBytesVerified, true)
assert.equal(activation.authoritativeManifestIntegrityVerified, false)
assert.equal(activation.runtimeSourceOwnerPinsVerified, false)
assert.equal(activation.authoritativePhysicalSemanticsVerified, false)
assert.equal(activation.activationEligible, false, 'disabled emitted manifest must remain activation-ineligible')
assert.ok(activation.blockers.some((entry) => entry.code === 'MANIFEST_DISABLED'))
assert.ok(activation.blockers.some((entry) => entry.code === 'AUTHORITATIVE_MANIFEST_INTEGRITY_PIN_MISSING'))
assert.ok(activation.blockers.some((entry) => entry.code === 'AUTHORITATIVE_RUNTIME_SOURCE_OWNER_EQUALITY_MISSING'))
assert.ok(activation.blockers.some((entry) => entry.code === 'AUTHORITATIVE_PHYSICAL_SEMANTIC_GATE_MISSING'))
assert.ok(activation.blockers.some((entry) => entry.code === 'TRANSITION_CONCURRENCY_UNPROVEN'))

await mkdir(OUTPUT_ROOT, { recursive: true })
await writeFile(PATHS.manifest, manifestText)
const manifestPin = { path: relative(VIEWER_ROOT, PATHS.manifest).replaceAll('\\', '/'), bytes: Buffer.byteLength(manifestText), sha256: sha256(Buffer.from(manifestText)) }
const emittedAudit = {
  schema: 'IOM_REPEAT_SIX_PART_COHORT_MANIFEST_V4_PHYSICAL_AUDIT',
  version: 1,
  status: 'pass-disabled-activation-ineligible',
  manifest: manifestPin,
  sourcePilot: {
    index: { path: relative(VIEWER_ROOT, PATHS.index).replaceAll('\\', '/'), bytes: indexBytes.length, sha256: sha256(indexBytes) },
    physicalAudit: { path: relative(VIEWER_ROOT, PATHS.cohortPhysicalAudit).replaceAll('\\', '/'), bytes: cohortAuditBytes.length, sha256: sha256(cohortAuditBytes) },
    directProductionSources: physicalProductionPins,
  },
  directProductionSourcePinsPhysicallyVerified: true,
  exactOwnerBasisPhysicallyVerified: true,
  physicalPayloadPinsVerified: true,
  physicalManifestBytesVerified: true,
  authoritativeManifestIntegrityVerified: false,
  runtimeSourceOwnerPinsVerified: false,
  runtimeObserverIntegrated: false,
  authoritativePhysicalSemanticsVerified: false,
  validation: { valid: validation.valid, summary: validation.summary },
  activation: {
    eligible: activation.activationEligible,
    blockers: activation.blockers,
  },
  runtimeIntegrated: false,
  productionRoutingChanged: false,
}
await writeFile(PATHS.audit, `${JSON.stringify(emittedAudit, null, 2)}\n`)

console.log('Repeat six-part cohort manifest-v4 physical emission: PASS')
console.log(`  ${relative(VIEWER_ROOT, PATHS.manifest).replaceAll('\\', '/')}`)
console.log(`  ${validation.summary.logicalSourceCount} sources / ${validation.summary.exactSegmentCount} segments / ${validation.summary.selectionUnitCount} units`)
console.log(`  3 payloads physically pinned: ${validation.summary.runtimePayloadBytes.toLocaleString('en-US')} bytes`)
console.log(`  manifest + payload cold contract: ${validation.summary.coldContractRequests} requests / ${validation.summary.coldContractBytes.toLocaleString('en-US')} bytes`)
console.log('  exact catalog L-infinity resident/draw maxima and declared witnesses recomputed: PASS')
console.log('  production model / direct geometry / source map / physical audit / exact owner basis physically observed: PASS')
console.log('  independent runtime source/owner equality observer: MISSING (hard-blocked)')
console.log('  externally authoritative manifest bytes/SHA-256 activation pin: MISSING (hard-blocked)')
console.log('  authoritative decoded GLB/BIN/ownership semantic activation gate: MISSING (hard-blocked)')
console.log('  enabled=false; activationEligible=false; runtime/public/production unchanged')
