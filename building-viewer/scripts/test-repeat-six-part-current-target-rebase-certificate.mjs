#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  createRepeatSixPartCurrentTargetRebaseCertificate,
  stableCertificateStringify,
} from './emit-repeat-six-part-current-target-rebase-certificate.mjs'
import { buildRepeatSixPartCurrentModelCompatibilityReport } from './audit-repeat-six-part-current-model-compatibility.mjs'
import {
  CURRENT_TARGET_REBASE_CERTIFICATE_PATH,
  CURRENT_TARGET_REBASE_MODEL_PATH,
  TRACKED_CURRENT_TARGET_REBASE_CERTIFICATE_PIN,
  validateRepeatSixPartCurrentTargetRebaseCertificate,
  validateRepeatSixPartCurrentTargetRebaseCertificateForTest,
} from './validate-repeat-six-part-current-target-rebase-certificate.mjs'

const VIEWER_ROOT = resolve(import.meta.dirname, '..')
const HUMAN_CERTIFICATE_PATH = resolve(
  import.meta.dirname,
  'fixtures/icm-anim-2025-ground-floor-repeat-logical-mapping-v1.json',
)
const HUMAN_CERTIFICATE_PIN = Object.freeze({
  bytes: 28_050,
  sha256: 'a802f11c3f9798168d8339c4c786036d36b7486c0c83a5fdad5931d5cff94b60',
})

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const pin = (bytes) => ({ bytes: bytes.length, sha256: sha256(bytes) })
const clone = (value) => structuredClone(value)

const [certificateBytes, humanCertificateBytes] = await Promise.all([
  readFile(CURRENT_TARGET_REBASE_CERTIFICATE_PATH),
  readFile(HUMAN_CERTIFICATE_PATH),
])
assert.deepEqual(pin(certificateBytes), TRACKED_CURRENT_TARGET_REBASE_CERTIFICATE_PIN)
assert.deepEqual(pin(humanCertificateBytes), HUMAN_CERTIFICATE_PIN)

const certificate = JSON.parse(certificateBytes.toString('utf8'))
const baseline = await validateRepeatSixPartCurrentTargetRebaseCertificate()
assert.equal(baseline.valid, true)
assert.equal(baseline.certificateStatus, 'machine-verified-current-target-development-evaluation-only')
assert.deepEqual(baseline.roots, ['scene/0/257', 'scene/0/258', 'scene/0/259', 'scene/0/260'])
assert.deepEqual(baseline.owner, {
  nodeName: 'Ground Floor._anim1',
  activeScenePath: 'scene/0/399',
  animationChannelCount: 1,
  allTargetedChannelsNoOpAtRest: true,
})
assert.deepEqual(baseline.authority, {
  humanCurrentTargetReapproval: false,
  developmentEvaluationAllowed: true,
  productionRuntimeIntegrationAllowed: false,
  activationAuthorized: false,
  activationCapability: null,
})

const report = await buildRepeatSixPartCurrentModelCompatibilityReport({
  modelPath: CURRENT_TARGET_REBASE_MODEL_PATH,
  modelRelativePath: '../public/models/icm-anim-2025/model-web.glb',
})
const regenerated = Buffer.from(stableCertificateStringify(
  createRepeatSixPartCurrentTargetRebaseCertificate(report),
))
assert.deepEqual(regenerated, certificateBytes, 'tracked machine certificate is not deterministically reproducible')

await assert.rejects(
  () => validateRepeatSixPartCurrentTargetRebaseCertificateForTest({
    certificateBytes: Buffer.concat([certificateBytes, Buffer.from(' ')]),
    expectedCertificatePin: TRACKED_CURRENT_TARGET_REBASE_CERTIFICATE_PIN,
  }),
  /byte pin changed/,
  'outer certificate byte pin',
)

let mutationCount = 0
async function rejectMutation(label, mutate, pattern) {
  const value = clone(certificate)
  mutate(value)
  const bytes = Buffer.from(stableCertificateStringify(value))
  await assert.rejects(
    () => validateRepeatSixPartCurrentTargetRebaseCertificateForTest({
      certificateBytes: bytes,
      expectedCertificatePin: pin(bytes),
    }),
    pattern,
    label,
  )
  mutationCount += 1
}

// All five authority fields are immutable. No mutation may create or imply an
// activation capability, and even a more restrictive change is not silently
// accepted because this is a byte-pinned evidence contract.
await rejectMutation('forged current-target human approval', (value) => {
  value.authority.humanCurrentTargetReapproval = true
}, /certificate\.authority\.humanCurrentTargetReapproval/)
await rejectMutation('development posture changed', (value) => {
  value.authority.developmentEvaluationAllowed = false
}, /certificate\.authority\.developmentEvaluationAllowed/)
await rejectMutation('production integration escalation', (value) => {
  value.authority.productionRuntimeIntegrationAllowed = true
}, /certificate\.authority\.productionRuntimeIntegrationAllowed/)
await rejectMutation('activation escalation', (value) => {
  value.authority.activationAuthorized = true
}, /certificate\.authority\.activationAuthorized/)
await rejectMutation('forged activation capability', (value) => {
  value.authority.activationCapability = { token: 'forged' }
}, /certificate\.authority\.activationCapability/)
await rejectMutation('missing authority field', (value) => {
  delete value.authority.activationAuthorized
}, /certificate\.authority: keys changed/)
await rejectMutation('unknown authority field', (value) => {
  value.authority.unexpected = false
}, /certificate\.authority: keys changed/)

await rejectMutation('unknown top-level key', (value) => {
  value.unexpected = true
}, /certificate: keys changed/)
await rejectMutation('schema mutation', (value) => {
  value.schema = 'IOM_REPEAT_SIX_PART_CURRENT_TARGET_REBASE_CERTIFICATE_V2'
}, /certificate\.schema/)
await rejectMutation('status mutation', (value) => {
  value.status = 'approved-authoritative-current-target'
}, /certificate\.status/)
await rejectMutation('platform mutation', (value) => {
  value.platform = 'quest'
}, /certificate\.platform/)

await rejectMutation('human certificate hash mutation', (value) => {
  value.baseAuthority.logicalMappingCertificate.sha256 = '0'.repeat(64)
}, /certificate\.baseAuthority\.logicalMappingCertificate\.sha256/)
await rejectMutation('historical scope mutation', (value) => {
  value.baseAuthority.scope = 'current-target-approved'
}, /certificate\.baseAuthority\.scope/)
await rejectMutation('approved target mutation', (value) => {
  value.baseAuthority.approvedTarget.productionModel.sha256 = '0'.repeat(64)
}, /certificate\.baseAuthority\.approvedTarget\.productionModel\.sha256/)

await rejectMutation('current model byte pin mutation', (value) => {
  value.currentTarget.productionModel.bytes += 1
}, /certificate\.currentTarget\.productionModel\.bytes/)
await rejectMutation('current model hash mutation', (value) => {
  value.currentTarget.productionModel.sha256 = '0'.repeat(64)
}, /certificate\.currentTarget\.productionModel\.sha256/)
await rejectMutation('active scene root count mutation', (value) => {
  value.currentTarget.activeSceneRootCount -= 1
}, /certificate\.currentTarget\.activeSceneRootCount/)
await rejectMutation('root order mutation', (value) => {
  ;[value.currentTarget.productionInstancingRoots[0], value.currentTarget.productionInstancingRoots[1]] =
    [value.currentTarget.productionInstancingRoots[1], value.currentTarget.productionInstancingRoots[0]]
}, /certificate\.currentTarget\.productionInstancingRoots\[0\]\.activeScenePath/)
await rejectMutation('root path mutation', (value) => {
  value.currentTarget.productionInstancingRoots[0].activeScenePath = 'scene/0/258'
}, /certificate\.currentTarget\.productionInstancingRoots\[0\]\.activeScenePath/)
await rejectMutation('root material mutation', (value) => {
  value.currentTarget.productionInstancingRoots[0].material.name = 'forged material'
}, /certificate\.currentTarget\.productionInstancingRoots\[0\]\.material\.name/)
await rejectMutation('root triangle mutation', (value) => {
  value.currentTarget.productionInstancingRoots[0].geometry.triangles -= 1
}, /certificate\.currentTarget\.productionInstancingRoots\[0\]\.geometry\.triangles/)
await rejectMutation('root geometry fingerprint mutation', (value) => {
  value.currentTarget.productionInstancingRoots[0].geometry.position.sha256 = '0'.repeat(64)
}, /certificate\.currentTarget\.productionInstancingRoots\[0\]\.geometry\.position\.sha256/)
await rejectMutation('root instance fingerprint mutation', (value) => {
  value.currentTarget.productionInstancingRoots[0].instanceAccessors.TRANSLATION.sha256 = '0'.repeat(64)
}, /certificate\.currentTarget\.productionInstancingRoots\[0\]\.instanceAccessors\.TRANSLATION\.sha256/)
await rejectMutation('unknown nested root key', (value) => {
  value.currentTarget.productionInstancingRoots[0].geometry.unexpected = true
}, /certificate\.currentTarget\.productionInstancingRoots\[0\]\.geometry: keys changed/)

await rejectMutation('owner path mutation', (value) => {
  value.currentTarget.intendedOwner.activeScenePath = 'scene/0/398'
}, /certificate\.currentTarget\.intendedOwner\.activeScenePath/)
await rejectMutation('owner channel count mutation', (value) => {
  value.currentTarget.intendedOwner.animationChannelCount = 0
}, /certificate\.currentTarget\.intendedOwner\.animationChannelCount/)
await rejectMutation('owner no-op claim mutation', (value) => {
  value.currentTarget.intendedOwner.allTargetedChannelsNoOpAtRest = false
}, /certificate\.currentTarget\.intendedOwner\.allTargetedChannelsNoOpAtRest/)
await rejectMutation('owner channel interpolation mutation', (value) => {
  value.currentTarget.intendedOwner.targetedAnimationChannels[0].interpolation = 'LINEAR'
}, /certificate\.currentTarget\.intendedOwner\.targetedAnimationChannels\[0\]\.interpolation/)
await rejectMutation('owner channel value mutation', (value) => {
  value.currentTarget.intendedOwner.targetedAnimationChannels[0].keyframes[0].value[0] = 1
}, /certificate\.currentTarget\.intendedOwner\.targetedAnimationChannels\[0\]\.keyframes\[0\]\.value\[0\]/)
await rejectMutation('owner channel fingerprint mutation', (value) => {
  value.currentTarget.intendedOwner.targetedAnimationChannels[0].output.sha256 = '0'.repeat(64)
}, /certificate\.currentTarget\.intendedOwner\.targetedAnimationChannels\[0\]\.output\.sha256/)

await rejectMutation('mapping row digest mutation', (value) => {
  value.compatibility.mapping.mappingRowsSha256 = '0'.repeat(64)
}, /certificate\.compatibility\.mapping\.mappingRowsSha256/)
await rejectMutation('mapping order claim mutation', (value) => {
  value.compatibility.mapping.orderCompatible = false
}, /certificate\.compatibility\.mapping\.orderCompatible/)
await rejectMutation('mapping parity mutation', (value) => {
  value.compatibility.mapping.parity.positive = 39
}, /certificate\.compatibility\.mapping\.parity\.positive/)
await rejectMutation('mapping policy relaxation', (value) => {
  value.compatibility.mapping.policy.maxMatchedDistanceMeters = 1
}, /certificate\.compatibility\.mapping\.policy\.maxMatchedDistanceMeters/)
await rejectMutation('mapping metric mutation', (value) => {
  value.compatibility.mapping.metrics.maxMatchedDistanceMeters = 0
}, /certificate\.compatibility\.mapping\.metrics\.maxMatchedDistanceMeters/)
await rejectMutation('stale pin set mutation', (value) => {
  value.compatibility.staleApprovedTargetPins.pop()
}, /certificate\.compatibility\.staleApprovedTargetPins: array length changed/)

console.log(`Repeat six-part current-target rebase certificate tests: PASS (${mutationCount} rejected mutations)`)
console.log(`  fixture: ${certificateBytes.length} bytes / ${sha256(certificateBytes)}`)
console.log(`  model: ${baseline.model.bytes} bytes / ${baseline.model.sha256}`)
console.log('  immutable human certificate unchanged and pinned')
console.log('  development evaluation only; production/runtime/activation remain forbidden')
