#!/usr/bin/env node

/** Fail-closed mutation suite for the independent dormant semantic verifier. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  REPEAT_SIX_PART_SEMANTIC_PATHS,
  RepeatSixPartSemanticVerificationError,
  computeIndependentRepeatSixPartManifestDigests,
  verifyRepeatSixPartCohortV4SemanticBuffers,
  writeRepeatSixPartCohortV4SemanticAttestation,
} from './verify-repeat-six-part-cohort-v4-semantics.mjs'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

const [
  manifestBytes,
  geometryBytes,
  cohortTableBytes,
  ownershipBytes,
  productionModelBytes,
  directProductionGeometryBytes,
  directProductionSourceMapBytes,
  directProductionPhysicalAuditBytes,
] = await Promise.all([
  readFile(REPEAT_SIX_PART_SEMANTIC_PATHS.manifest),
  readFile(REPEAT_SIX_PART_SEMANTIC_PATHS.geometry),
  readFile(REPEAT_SIX_PART_SEMANTIC_PATHS.cohortTable),
  readFile(REPEAT_SIX_PART_SEMANTIC_PATHS.ownership),
  readFile(REPEAT_SIX_PART_SEMANTIC_PATHS.productionModel),
  readFile(REPEAT_SIX_PART_SEMANTIC_PATHS.directProductionGeometry),
  readFile(REPEAT_SIX_PART_SEMANTIC_PATHS.directProductionSourceMap),
  readFile(REPEAT_SIX_PART_SEMANTIC_PATHS.directProductionPhysicalAudit),
])

const baseline = {
  manifestBytes,
  geometryBytes,
  cohortTableBytes,
  ownershipBytes,
  productionModelBytes,
  directProductionGeometryBytes,
  directProductionSourceMapBytes,
  directProductionPhysicalAuditBytes,
}

function parseManifest(bytes = manifestBytes) {
  return JSON.parse(bytes.toString('utf8'))
}

function refreshPayloadPin(manifest, key, bytes) {
  manifest.payloads[key].bytes = bytes.length
  manifest.payloads[key].sha256 = sha256(bytes)
  manifest.proof.payloadOnlyBytes = ['geometry', 'cohortTable', 'ownership']
    .reduce((sum, payloadKey) => sum + manifest.payloads[payloadKey].bytes, 0)
}

function encodeManifest(manifest, { refreshDigests = true } = {}) {
  if (refreshDigests) manifest.digests = computeIndependentRepeatSixPartManifestDigests(manifest)
  let text = ''
  for (let iteration = 0; iteration < 16; iteration += 1) {
    text = `${JSON.stringify(manifest, null, 2)}\n`
    const bytes = Buffer.byteLength(text)
    const cold = manifest.proof.payloadOnlyBytes + bytes
    if (manifest.proof.manifestBytes === bytes && manifest.proof.coldContractBytes === cold) break
    manifest.proof.manifestBytes = bytes
    manifest.proof.coldContractBytes = cold
  }
  text = `${JSON.stringify(manifest, null, 2)}\n`
  assert.equal(Buffer.byteLength(text), manifest.proof.manifestBytes, 'mutation manifest byte accounting did not converge')
  return Buffer.from(text)
}

function firstPositionComponentFileOffset(glbBytes) {
  const jsonLength = glbBytes.readUInt32LE(12)
  const document = JSON.parse(glbBytes.subarray(20, 20 + jsonLength).toString('utf8'))
  const nodeIndex = document.scenes[document.scene ?? 0].nodes[0]
  const primitive = document.meshes[document.nodes[nodeIndex].mesh].primitives[0]
  const accessor = document.accessors[primitive.attributes.POSITION]
  const view = document.bufferViews[accessor.bufferView]
  const binaryChunkHeader = 20 + jsonLength
  const binaryStart = binaryChunkHeader + 8
  return binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
}

const controls = []
function expectReject(label, mutation, expectedCode) {
  let rejected = false
  let observedCode = null
  try {
    verifyRepeatSixPartCohortV4SemanticBuffers({ ...baseline, ...mutation() })
  } catch (error) {
    rejected = true
    assert.ok(error instanceof RepeatSixPartSemanticVerificationError,
      `${label}: verifier must reject with its typed semantic-verification error`)
    observedCode = error?.code ?? null
    assert.equal(observedCode, expectedCode, `${label}: unexpected rejection code`)
  }
  assert.equal(rejected, true, `${label}: coordinated mutation was accepted`)
  controls.push({ label, rejected: true, code: observedCode })
}

async function expectAsyncReject(label, operation, expectedCode) {
  let rejected = false
  try {
    await operation()
  } catch (error) {
    rejected = true
    assert.ok(error instanceof RepeatSixPartSemanticVerificationError,
      `${label}: verifier must reject with its typed semantic-verification error`)
    assert.equal(error.code, expectedCode, `${label}: unexpected rejection code`)
  }
  assert.equal(rejected, true, `${label}: missing prerequisite was accepted`)
  controls.push({ label, rejected: true, code: expectedCode })
}

const attestation = verifyRepeatSixPartCohortV4SemanticBuffers(baseline)
assert.equal(attestation.status, 'pass-dormant-semantic-evidence-only')
assert.equal(attestation.activationAuthorityEstablished, false)

expectReject('glb-position-float-bit', () => {
  const geometry = Buffer.from(geometryBytes)
  const offset = firstPositionComponentFileOffset(geometry)
  geometry.writeFloatLE(geometry.readFloatLE(offset) + 0.125, offset)
  const manifest = parseManifest()
  refreshPayloadPin(manifest, 'geometry', geometry)
  return { geometryBytes: geometry, manifestBytes: encodeManifest(manifest) }
}, 'GEOMETRY_NOT_BYTE_IDENTICAL_TO_DIRECT_SOURCE')

expectReject('bin-canonical-signed-zero-bit', () => {
  const table = Buffer.from(cohortTableBytes)
  let offset = -1
  for (let cursor = 80; cursor < 80 + 78 * 128; cursor += 8) {
    if (Object.is(table.readDoubleLE(cursor), -0)) {
      offset = cursor
      break
    }
  }
  assert.ok(offset >= 0, 'baseline canonical table has no signed-zero test target')
  table.writeDoubleLE(0, offset)
  const manifest = parseManifest()
  refreshPayloadPin(manifest, 'cohortTable', table)
  return { cohortTableBytes: table, manifestBytes: encodeManifest(manifest) }
}, 'CANONICAL_MATRIX_BITS_MISMATCH')

expectReject('bin-render-local-factor', () => {
  const table = Buffer.from(cohortTableBytes)
  const renderOffset = table.readUInt32LE(32)
  table.writeDoubleLE(table.readDoubleLE(renderOffset) + 0.000125, renderOffset)
  const manifest = parseManifest()
  refreshPayloadPin(manifest, 'cohortTable', table)
  return { cohortTableBytes: table, manifestBytes: encodeManifest(manifest) }
}, 'RENDER_LOCAL_MATRIX_BITS_MISMATCH')

expectReject('bin-unit-bound', () => {
  const table = Buffer.from(cohortTableBytes)
  const boundsOffset = table.readUInt32LE(40)
  table.writeDoubleLE(table.readDoubleLE(boundsOffset) + 0.25, boundsOffset)
  const manifest = parseManifest()
  refreshPayloadPin(manifest, 'cohortTable', table)
  return { cohortTableBytes: table, manifestBytes: encodeManifest(manifest) }
}, 'COHORT_BIN_UNIT_BOUND_MISMATCH')

expectReject('bin-source-segment-key', () => {
  const table = Buffer.from(cohortTableBytes)
  const keysOffset = table.readUInt32LE(48)
  table.writeUInt32LE(1, keysOffset + 4)
  const manifest = parseManifest()
  refreshPayloadPin(manifest, 'cohortTable', table)
  return { cohortTableBytes: table, manifestBytes: encodeManifest(manifest) }
}, 'COHORT_BIN_KEY_ORDER_MISMATCH')

expectReject('ownership-source-path', () => {
  const ownership = JSON.parse(ownershipBytes.toString('utf8'))
  ownership.instances[0].sourcePath += '/tampered'
  const bytes = Buffer.from(`${JSON.stringify(ownership, null, 2)}\n`)
  const manifest = parseManifest()
  refreshPayloadPin(manifest, 'ownership', bytes)
  return { ownershipBytes: bytes, manifestBytes: encodeManifest(manifest) }
}, 'OWNERSHIP_INSTANCE_SEMANTICS_MISMATCH')

expectReject('ownership-parity', () => {
  const ownership = JSON.parse(ownershipBytes.toString('utf8'))
  ownership.instances[0].parity = 'mirrored'
  const bytes = Buffer.from(`${JSON.stringify(ownership, null, 2)}\n`)
  const manifest = parseManifest()
  refreshPayloadPin(manifest, 'ownership', bytes)
  return { ownershipBytes: bytes, manifestBytes: encodeManifest(manifest) }
}, 'OWNERSHIP_INSTANCE_SEMANTICS_MISMATCH')

expectReject('ownership-parity-batch-policy', () => {
  const ownership = JSON.parse(ownershipBytes.toString('utf8'))
  ownership.parityBatchContract.directCanonicalMatrixUseInInstancedMeshAllowed = true
  const bytes = Buffer.from(`${JSON.stringify(ownership, null, 2)}\n`)
  const manifest = parseManifest()
  refreshPayloadPin(manifest, 'ownership', bytes)
  return { ownershipBytes: bytes, manifestBytes: encodeManifest(manifest) }
}, 'OWNERSHIP_PARITY_CONTRACT_MISMATCH')

expectReject('logical-mapping-approval-certificate', () => {
  const sourceMap = JSON.parse(directProductionSourceMapBytes.toString('utf8'))
  sourceMap.logicalMappingCertificate.approval.status = 'pending'
  return { directProductionSourceMapBytes: Buffer.from(`${JSON.stringify(sourceMap, null, 2)}\n`) }
}, 'LOGICAL_MAPPING_CERTIFICATE_MISMATCH')

expectReject('manifest-unit-bound-with-refreshed-digests', () => {
  const manifest = parseManifest()
  manifest.catalog.units[0].bounds.min[0] += 0.25
  return { manifestBytes: encodeManifest(manifest) }
}, 'MANIFEST_UNIT_SEMANTICS_MISMATCH')

expectReject('manifest-resident-metric', () => {
  const manifest = parseManifest()
  manifest.proof.residentSweep.maxSelectedTriangles += 1
  return { manifestBytes: encodeManifest(manifest) }
}, 'MANIFEST_RESIDENT_METRIC_MISMATCH')

expectReject('manifest-stale-digest', () => {
  const manifest = parseManifest()
  manifest.digests.unitBoundsSha256 = '0'.repeat(64)
  return { manifestBytes: encodeManifest(manifest, { refreshDigests: false }) }
}, 'MANIFEST_DIGEST_MISMATCH')

expectReject('manifest-payload-pin', () => {
  const manifest = parseManifest()
  manifest.payloads.cohortTable.sha256 = '0'.repeat(64)
  return { manifestBytes: encodeManifest(manifest) }
}, 'ASSET_SHA256_PIN_MISMATCH')

expectReject('manifest-coordinated-policy-bypass', () => {
  const manifest = parseManifest()
  manifest.owner.id = 'tampered-owner'
  manifest.capabilities.quest = true
  manifest.capabilities.hlodSwaps = true
  manifest.capabilities.stableLogicalIdentity = false
  manifest.selector.enterMarginMeters = -999
  manifest.selector.states = ['bogus']
  manifest.selector.defaultState = 'active'
  manifest.budgets.repeatFamilyResidentTriangles = 9_999_999_999
  manifest.budgets.totalResidentTriangles = 9_999_999_999
  manifest.budgets.maxRuntimePayloadBytes = 1
  return { manifestBytes: encodeManifest(manifest) }
}, 'MANIFEST_OWNER_CONTRACT_MISMATCH')

expectReject('manifest-owner-policy', () => {
  const manifest = parseManifest()
  manifest.owner.id = 'tampered-owner'
  return { manifestBytes: encodeManifest(manifest) }
}, 'MANIFEST_OWNER_CONTRACT_MISMATCH')

expectReject('manifest-capability-policy', () => {
  const manifest = parseManifest()
  manifest.capabilities.quest = true
  return { manifestBytes: encodeManifest(manifest) }
}, 'MANIFEST_CAPABILITY_CONTRACT_MISMATCH')

expectReject('manifest-selector-policy', () => {
  const manifest = parseManifest()
  manifest.selector.enterMarginMeters = -999
  return { manifestBytes: encodeManifest(manifest) }
}, 'MANIFEST_SELECTOR_POLICY_MISMATCH')

expectReject('manifest-budget-policy', () => {
  const manifest = parseManifest()
  manifest.budgets.maxRuntimePayloadBytes = 1
  return { manifestBytes: encodeManifest(manifest) }
}, 'MANIFEST_BUDGET_POLICY_MISMATCH')

expectReject('manifest-payload-descriptor', () => {
  const manifest = parseManifest()
  manifest.payloads.geometry.url = '/tampered/geometry.glb'
  return { manifestBytes: encodeManifest(manifest) }
}, 'MANIFEST_PAYLOAD_CONTRACT_MISMATCH')

expectReject('manifest-transition-proof-policy', () => {
  const manifest = parseManifest()
  manifest.proof.transition.model = 'unbounded-overlap'
  return { manifestBytes: encodeManifest(manifest) }
}, 'MANIFEST_PROOF_POLICY_MISMATCH')

expectReject('manifest-unknown-top-level-key', () => {
  const manifest = parseManifest()
  manifest.semanticOverride = true
  return { manifestBytes: encodeManifest(manifest) }
}, 'MANIFEST_TOP_LEVEL_KEYS_MISMATCH')

expectReject('production-model-hard-pin', () => {
  const production = Buffer.from(productionModelBytes)
  production[production.length - 1] ^= 0x01
  return { productionModelBytes: production }
}, 'IMMUTABLE_SHA256_PIN_MISMATCH')

await expectAsyncReject('ignored-tmp-prerequisite-missing', () => {
  const missing = `${REPEAT_SIX_PART_SEMANTIC_PATHS.manifest}.intentionally-missing`
  return writeRepeatSixPartCohortV4SemanticAttestation({
    paths: {
      manifest: missing,
      geometry: missing,
      cohortTable: missing,
      ownership: missing,
      productionModel: missing,
      directProductionGeometry: missing,
      directProductionSourceMap: missing,
      directProductionPhysicalAudit: missing,
      attestation: missing,
    },
  })
}, 'SEMANTIC_PREREQUISITE_MISSING')

console.log('Repeat six-part cohort v4 semantic mutation suite: PASS')
console.log(`  valid baseline semantic binding: ${attestation.semanticBindingSha256}`)
console.log(`  ${controls.length} coordinated mutations rejected`)
for (const control of controls) console.log(`  ${control.label}: ${control.code}`)
console.log('  verifier remains dormant and is not integrated with the activation validator')
