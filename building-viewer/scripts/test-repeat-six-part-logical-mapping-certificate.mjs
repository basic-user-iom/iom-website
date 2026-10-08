import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  PINNED_PRODUCTION_MODEL_PATH,
  TRACKED_CERTIFICATE_PATH,
  TRACKED_CERTIFICATE_PIN,
  decodePinnedProductionLogicalMappingEvidence,
  validateLogicalMappingCertificateAgainstDecodedEvidenceForTest,
} from './validate-repeat-six-part-logical-mapping-certificate.mjs'

const certificateBytes = await readFile(TRACKED_CERTIFICATE_PATH)
const productionBytes = await readFile(PINNED_PRODUCTION_MODEL_PATH)
const physicalEvidence = await decodePinnedProductionLogicalMappingEvidence(productionBytes)

const result = validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(
  certificateBytes,
  physicalEvidence,
  TRACKED_CERTIFICATE_PIN,
)
assert.equal(result.evidenceValidated, true)
assert.equal(result.technicalMappingPassed, true)
assert.equal(result.provenanceApproved, true)
assert.equal(result.logicalOwnershipMappingPassed, true)
assert.equal(result.activationBlocked, true)
assert.equal(result.certificateStatus, 'approved-authoritative-logical-mapping')
assert.equal(result.approvalStatus, 'approved')
assert.deepEqual(result.approval, {
  status: 'approved',
  requiredAuthority: 'human-dcc-source-path-to-production-row-semantic-review',
  approvedBy: 'project-owner',
  approvedAt: '2026-08-30T16:37:38Z',
  approvalReference: 'conversation:user-explicit-proceed-after-certificate-review',
})
assert.equal(result.sourceCount, 78)
assert.equal(result.approvedMappingRows.length, 78)
assert.deepEqual(result.approvedMappingRows.map((row) => row.sourceId), Array.from({ length: 78 }, (_, index) => index))
assert.deepEqual(result.approvedMappingRows.map((row) => row.productionInstanceIndex), Array.from({ length: 78 }, (_, index) => index))
assert.equal(new Set(result.approvedMappingRows.map((row) => row.sourcePath)).size, 78)
assert.ok(result.metrics.maxMatchedDistanceMeters <= 0.005)
assert.ok(result.metrics.minRunnerUpMarginMeters >= 0.5)
assert.ok(result.metrics.maxBestToRunnerUpRatio <= 0.01)

const clone = (value) => structuredClone(value)
const parseFixture = () => JSON.parse(certificateBytes.toString('utf8'))
const bytesFor = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
const pinFor = (bytes) => ({
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
})

let mutationCount = 0
function rejectMutation(name, callback, pattern) {
  mutationCount += 1
  assert.throws(callback, pattern, `${name}: mutation unexpectedly passed`)
}

function rejectFixtureMutation(name, mutate, pattern) {
  const fixture = parseFixture()
  mutate(fixture)
  const bytes = bytesFor(fixture)
  rejectMutation(name, () => validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(
    bytes,
    physicalEvidence,
    pinFor(bytes),
  ), pattern)
}

function decodeMatrix(hex) {
  const bytes = Buffer.from(hex, 'hex')
  return Array.from({ length: 16 }, (_, index) => bytes.readDoubleLE(index * 8))
}

function encodeMatrix(matrix) {
  const bytes = Buffer.alloc(128)
  matrix.forEach((value, index) => bytes.writeDoubleLE(value, index * 8))
  return bytes.toString('hex')
}

function mutateMatrixInEverySlot(row, mutate) {
  const evidence = clone(physicalEvidence)
  for (const slot of evidence.slots) {
    const matrix = decodeMatrix(slot.matrixFloat64LEHex[row])
    mutate(matrix)
    slot.matrixFloat64LEHex[row] = encodeMatrix(matrix)
  }
  return evidence
}

// The tracked byte envelope is immutable, including otherwise-semantic-neutral
// whitespace. Semantic mutations below are deliberately re-pinned at the test
// seam so they exercise the independent strict contract rather than stopping at
// this first byte gate.
rejectMutation('certificate byte pin', () => validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(
  Buffer.concat([certificateBytes, Buffer.from(' ')]),
  physicalEvidence,
  TRACKED_CERTIFICATE_PIN,
), /byte pin changed/)

rejectFixtureMutation('unknown top-level key', (fixture) => { fixture.unexpected = true }, /certificate: keys changed/)
rejectFixtureMutation('approval cannot be downgraded', (fixture) => { fixture.approval.status = 'pending' }, /certificate\.approval/)
rejectFixtureMutation('approval authority is pinned', (fixture) => { fixture.approval.approvedBy = 'unverified-authority' }, /certificate\.approval/)
rejectFixtureMutation('approval reference is pinned', (fixture) => { fixture.approval.approvalReference = 'unverified-reference' }, /certificate\.approval/)
rejectFixtureMutation('policy cap cannot be relaxed', (fixture) => { fixture.policy.maxMatchedDistanceMeters = 1 }, /hard caps cannot be relaxed/)
rejectFixtureMutation('named source provenance pin', (fixture) => { fixture.provenance.namedSourceArtifact.sha256 = '0'.repeat(64) }, /certificate\.provenance/)
rejectFixtureMutation('production target pin', (fixture) => { fixture.target.productionModel.sha256 = '0'.repeat(64) }, /certificate\.target/)
rejectFixtureMutation('source path/order', (fixture) => { fixture.sources[0].sourcePath += '.mutated' }, /named provenance path changed/)
rejectFixtureMutation('expected production index/order', (fixture) => { fixture.sources[0].expectedProductionInstanceIndex = 1 }, /non-canonical row\/order/)
rejectFixtureMutation('unknown row key', (fixture) => { fixture.sources[0].extra = 1 }, /sources\[0\]: keys changed/)
rejectFixtureMutation('malformed translation bits', (fixture) => { fixture.sources[0].referenceOwnerLocalTranslationFloat64LEHex = '00' }, /malformed Float64LE translation hex/)
rejectFixtureMutation('non-finite translation', (fixture) => {
  const bytes = Buffer.from(fixture.sources[0].referenceOwnerLocalTranslationFloat64LEHex, 'hex')
  bytes.writeDoubleLE(Number.NaN, 0)
  fixture.sources[0].referenceOwnerLocalTranslationFloat64LEHex = bytes.toString('hex')
}, /non-finite translation component/)
rejectFixtureMutation('row record digest', (fixture) => { fixture.sources[0].parity = fixture.sources[0].parity === 'positive' ? 'mirrored' : 'positive' }, /rowRecordsSha256|derived count mismatch/)

const displaced = mutateMatrixInEverySlot(0, (matrix) => { matrix[12] += 0.02 })
rejectMutation('five millimeter distance cap', () => validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(
  certificateBytes, displaced, TRACKED_CERTIFICATE_PIN,
), /maximum matched distance/)

const swapped = clone(physicalEvidence)
for (const slot of swapped.slots) {
  ;[slot.matrixFloat64LEHex[0], slot.matrixFloat64LEHex[1]] = [slot.matrixFloat64LEHex[1], slot.matrixFloat64LEHex[0]]
}
rejectMutation('expected-index reciprocal mapping', () => validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(
  certificateBytes, swapped, TRACKED_CERTIFICATE_PIN,
), /expected production index mismatch/)

const duplicate = clone(physicalEvidence)
for (const slot of duplicate.slots) slot.matrixFloat64LEHex[1] = slot.matrixFloat64LEHex[0]
rejectMutation('reciprocal ambiguity/bijection', () => validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(
  certificateBytes, duplicate, TRACKED_CERTIFICATE_PIN,
), /ambiguous reference row|reciprocal nearest mismatch|not bijective/)

const flippedParity = mutateMatrixInEverySlot(0, (matrix) => {
  matrix[0] *= -1
  matrix[1] *= -1
  matrix[2] *= -1
})
rejectMutation('physical parity', () => validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(
  certificateBytes, flippedParity, TRACKED_CERTIFICATE_PIN,
), /parity mismatch/)

const wrongOwner = clone(physicalEvidence)
wrongOwner.owner.activeScenePath = 'scene/0/399'
rejectMutation('owner basis', () => validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(
  certificateBytes, wrongOwner, TRACKED_CERTIFICATE_PIN,
), /physical evidence\.owner/)

const wrongRoot = clone(physicalEvidence)
wrongRoot.rootPaths[0] = 'scene/0/257'
rejectMutation('production root path', () => validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(
  certificateBytes, wrongRoot, TRACKED_CERTIFICATE_PIN,
), /physical evidence\.rootPaths/)

const wrongAccessor = clone(physicalEvidence)
wrongAccessor.slots[0].accessors.TRANSLATION.sha256 = '0'.repeat(64)
rejectMutation('decoded accessor pin', () => validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(
  certificateBytes, wrongAccessor, TRACKED_CERTIFICATE_PIN,
), /slots\[0\]\.accessors/)

const divergentSlot = clone(physicalEvidence)
const divergentMatrix = decodeMatrix(divergentSlot.slots[1].matrixFloat64LEHex[0])
divergentMatrix[12] += 0.001
divergentSlot.slots[1].matrixFloat64LEHex[0] = encodeMatrix(divergentMatrix)
rejectMutation('four-slot TRS equality', () => validateLogicalMappingCertificateAgainstDecodedEvidenceForTest(
  certificateBytes, divergentSlot, TRACKED_CERTIFICATE_PIN,
), /transform rows differ/)

const originalLastByte = productionBytes.at(-1)
productionBytes[productionBytes.length - 1] ^= 1
await assert.rejects(
  decodePinnedProductionLogicalMappingEvidence(productionBytes),
  /SHA-256 pin changed/,
  'production GLB byte mutation unexpectedly passed',
)
productionBytes[productionBytes.length - 1] = originalLastByte
mutationCount += 1

process.stdout.write(`PASS repeat six-part logical mapping certificate (${mutationCount} rejected mutations; approved mapping remains activation-blocked)\n`)
