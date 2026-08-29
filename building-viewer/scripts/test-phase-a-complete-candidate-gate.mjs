import assert from 'node:assert/strict'

import { loadPhaseAInputs } from './audit-phase-a-complete-disabled-candidate.mjs'
import {
  buildCombinedPersistentRig,
  evaluatePhaseACompleteCandidate,
} from './lib/phase-a-complete-candidate-gate.mjs'
import { sha256, stringListSha256 } from './lib/whole-layer-ownership-contract.mjs'

const inputs = await loadPhaseAInputs()

function syntheticAuditedUnownedPayloadCandidate() {
  // Contract-only positive fixture. The real command never substitutes this;
  // it exists solely to prove that all gate branches can accept complete,
  // byte-pinned evidence after the independent payload auditor emits it.
  const fixtureBytes = inputs.ownerCandidates[0].payloadBytes[
    inputs.ownerCandidates[0].index.packages[0].variants.web.lod0.url
  ]
  const fixtureSha256 = sha256(fixtureBytes)
  const packages = inputs.unownedPlan.staticPackages.map((planned) => ({
    id: planned.id,
    enabled: false,
    owner: '__unowned__',
    variants: Object.fromEntries(['web', 'quest'].map((variant) => {
      const sourceUnitIds = [...planned.variants[variant].sourceUnitIds]
      const path = `./payloads/${variant}/${planned.id}.glb`
      return [variant, {
        packageId: planned.id,
        asset: { path, sha256: fixtureSha256, bytes: fixtureBytes.length },
        sourceUnitIds,
        sourceUnitIdsSha256: stringListSha256(sourceUnitIds),
      }]
    })),
  }))
  const variants = Object.fromEntries(['web', 'quest'].map((variant) => {
    const ids = packages.flatMap((pkg) => pkg.variants[variant].sourceUnitIds)
    return [variant, {
      byteGatePass: true,
      emitted: {
        packageCount: packages.length,
        sourceUnitCount: ids.length,
        sourceUnitIdsSha256: stringListSha256(ids),
      },
    }]
  }))
  const index = {
    schema: 'IOM_UNOWNED_STATIC_PAYLOAD_CANDIDATE',
    version: 1,
    enabled: false,
    activationApproved: false,
    activationStatus: 'disabled-test-fixture-exact-payloads',
    productionModified: false,
    productionRoutingChanged: false,
    completePlannedPackageSet: true,
    owner: '__unowned__',
    plan: {
      bytes: inputs.unownedPlanBytes.length,
      sha256: sha256(inputs.unownedPlanBytes),
      planDigestSha256: inputs.unownedPlan.planDigestSha256,
      wholeLayerCoverageDigestSha256: inputs.unownedPlan.wholeLayerCoverageDigestSha256,
    },
    packageCount: packages.length,
    packages,
    variants,
    indexDigestSha256: 'a'.repeat(64),
    reproducibilityDigestSha256: 'b'.repeat(64),
  }
  const indexBytes = Buffer.from(JSON.stringify(index))
  const audit = {
    schema: 'IOM_UNOWNED_STATIC_PAYLOAD_AUDIT',
    version: 1,
    status: 'PASS',
    enabled: false,
    activationApproved: false,
    productionModified: false,
    productionRoutingChanged: false,
    assertionCount: 1,
    failureCount: 0,
    failures: [],
    index: {
      bytes: indexBytes.length,
      sha256: sha256(indexBytes),
      indexDigestSha256: index.indexDigestSha256,
      reproducibilityDigestSha256: index.reproducibilityDigestSha256,
    },
    deterministicRebuild: { checked: true, pass: true },
    exactCoverage: Object.fromEntries(['web', 'quest'].map((variant) => {
      const ids = packages.flatMap((pkg) => pkg.variants[variant].sourceUnitIds)
      return [variant, {
        expectedAtomicUnits: 2_843,
        emittedAtomicUnits: 2_843,
        sourceUnitIdsSha256: stringListSha256(ids),
        omissionCount: 0,
        duplicateCount: 0,
      }]
    })),
    compositionConstraints: { structuralShellAdditiveCompositionAllowed: false },
    unresolvedReleaseGates: [],
  }
  const payloadBytes = {}
  for (const pkg of packages) for (const variant of ['web', 'quest']) {
    payloadBytes[pkg.variants[variant].asset.path] = fixtureBytes
  }
  return {
    index,
    indexBytes,
    audit,
    auditBytes: Buffer.from(JSON.stringify(audit)),
    payloadBytes,
    syntheticContractFixture: true,
  }
}

const current = evaluatePhaseACompleteCandidate(inputs)
if (!inputs.unownedPayloadCandidate) {
  assert.equal(current.review.integrationEvidenceComplete, false)
  assert.equal(current.review.coverage.web.missingCount, 2_843)
  assert.equal(current.review.coverage.quest.missingCount, 2_843)
  assert.match(current.review.errors.join('\n'), /unowned static payload index\/audit evidence is required/)
}

const completeInputs = {
  ...inputs,
  unownedPayloadCandidate: syntheticAuditedUnownedPayloadCandidate(),
}

const complete = evaluatePhaseACompleteCandidate(completeInputs)
assert.equal(complete.review.integrationEvidenceComplete, true, complete.review.errors.join('\n'))
assert.equal(complete.review.logicalOwnershipComplete, true)
assert.equal(complete.review.payloadCoverageComplete, true)
assert.equal(complete.review.combinedRigComplete, true)
assert.equal(complete.review.candidateRigPinsValid, true)
assert.equal(complete.review.releaseReady, false)
assert.equal(complete.review.activationApproved, false)
assert.equal(complete.review.runtimeManifestEmitted, false)
assert.equal(complete.review.productionModified, false)
assert.equal(complete.review.productionRoutingChanged, false)
assert.equal(complete.candidate.enabled, false)
assert.equal(complete.candidate.activationApproved, false)
assert.equal(complete.candidate.runtimeManifestEmitted, false)
assert.equal(complete.candidate.productionModified, false)
assert.equal(complete.candidate.productionRoutingChanged, false)
assert.equal(complete.candidate.combinedRig.url, 'combined-persistent-rig.glb')
assert.equal(complete.candidate.combinedRig.sha256, 'a83ef30123736c3122d1c22ce9620e464d8ba9917fc244973ee6df060ee22c89')
assert.equal(complete.candidate.combinedRig.bytes, 372_892)
assert.equal(complete.candidate.combinedRig.ownerNodeNames.length, 6)
assert.equal(complete.candidate.combinedRig.channelCount, 4)
assert.equal(complete.candidate.combinedRig.meshCount, 0)

for (const [variant, expected, fiveOwners] of [
  ['web', 6_415, 3_260],
  ['quest', 6_407, 3_252],
]) {
  const coverage = complete.review.coverage[variant]
  assert.equal(coverage.valid, true)
  assert.equal(coverage.expectedAtomicUnits, expected)
  assert.equal(coverage.physicallyClaimedUniqueAtomicUnits, expected)
  assert.equal(coverage.physicalClaimOccurrences, expected)
  assert.equal(coverage.missingCount, 0)
  assert.equal(coverage.duplicateCount, 0)
  assert.equal(coverage.unknownCount, 0)
  assert.equal(coverage.partitions.fiveOwnerPayloadAtomicUnits, fiveOwners)
  assert.equal(coverage.partitions.repeatPayloadAtomicUnits, 312)
  assert.equal(coverage.partitions.unownedStaticPayloadAtomicUnits, 2_843)
  assert.equal(coverage.physicalPayloads, 208)
  assert.ok(coverage.verifiedPayloadBytes > 0)
}

assert.equal(complete.review.structuralShell.accepted, true)
assert.equal(complete.review.structuralShell.activationApproved, false)
assert.equal(complete.review.structuralShell.noStaticPayloadOverlap, false)
assert.equal(complete.review.structuralShell.overlap.web.plannedDetailOverlapCount, 181)
assert.equal(complete.review.structuralShell.overlap.quest.plannedDetailOverlapCount, 180)
assert.ok(complete.review.activationBlockers.some((entry) => entry.code === 'UNOWNED_SHELL_DETAIL_OWNERSHIP_OVERLAP'))
assert.equal(complete.review.residentWindow.spatialPlanningGatePassed, true)
assert.equal(complete.review.residentWindow.releaseGatePassed, false)
assert.ok(complete.review.activationBlockers.some((entry) => entry.code === 'RESIDENT_WINDOW_AND_TRANSITION_PEAK_UNPROVEN'))

const missingUnowned = evaluatePhaseACompleteCandidate({ ...completeInputs, unownedPayloadCandidate: null })
assert.equal(missingUnowned.review.integrationEvidenceComplete, false)
assert.equal(missingUnowned.review.payloadCoverageComplete, false)
assert.match(missingUnowned.review.errors.join('\n'), /unowned static payload index\/audit evidence is required/)
assert.equal(missingUnowned.review.coverage.web.missingCount, 2_843)
assert.equal(missingUnowned.review.coverage.quest.missingCount, 2_843)

const staleOwnerCandidates = [...completeInputs.ownerCandidates]
const staleFirst = {
  ...staleOwnerCandidates[0],
  payloadBytes: { ...staleOwnerCandidates[0].payloadBytes },
}
const firstUrl = staleFirst.index.packages[0].variants.web.lod0.url
staleFirst.payloadBytes[firstUrl] = Buffer.from(staleFirst.payloadBytes[firstUrl])
staleFirst.payloadBytes[firstUrl][staleFirst.payloadBytes[firstUrl].length - 1] ^= 1
staleOwnerCandidates[0] = staleFirst
const stalePayload = evaluatePhaseACompleteCandidate({ ...completeInputs, ownerCandidates: staleOwnerCandidates })
assert.equal(stalePayload.review.integrationEvidenceComplete, false)
assert.equal(stalePayload.review.payloadCoverageComplete, false)
assert.match(stalePayload.review.errors.join('\n'), /SHA-256 pin is stale/)

const duplicateUnownedIndex = structuredClone(completeInputs.unownedPayloadCandidate.index)
const duplicateId = duplicateUnownedIndex.packages[0].variants.web.sourceUnitIds[0]
duplicateUnownedIndex.packages[1].variants.web.sourceUnitIds[0] = duplicateId
const duplicateUnowned = evaluatePhaseACompleteCandidate({
  ...completeInputs,
  unownedPayloadCandidate: {
    ...completeInputs.unownedPayloadCandidate,
    index: duplicateUnownedIndex,
  },
})
assert.equal(duplicateUnowned.review.integrationEvidenceComplete, false)
assert.equal(duplicateUnowned.review.coverage.web.missingCount, 1)
assert.equal(duplicateUnowned.review.coverage.web.duplicateCount, 1)
assert.match(duplicateUnowned.review.errors.join('\n'), /exact source-unit set differs|source-unit digest is stale/)

const missingMigration = evaluatePhaseACompleteCandidate({
  ...completeInputs,
  migration: null,
  migrationBytes: null,
})
assert.equal(missingMigration.review.integrationEvidenceComplete, false)
assert.equal(missingMigration.review.logicalOwnershipComplete, false)
assert.match(missingMigration.review.errors.join('\n'), /migration sidecar is required/)
assert.equal(missingMigration.review.coverage.web.missingCount, 290)
assert.equal(missingMigration.review.coverage.quest.missingCount, 290)

const enabledRepeat = structuredClone(completeInputs.repeatCandidate.manifest)
enabledRepeat.enabled = true
const unsafeRepeat = evaluatePhaseACompleteCandidate({
  ...completeInputs,
  repeatCandidate: { ...completeInputs.repeatCandidate, manifest: enabledRepeat },
})
assert.equal(unsafeRepeat.review.integrationEvidenceComplete, false)
assert.match(unsafeRepeat.review.errors.join('\n'), /repeat manifest is not fail-closed/)

const wrongRig = evaluatePhaseACompleteCandidate({
  ...completeInputs,
  commonRigBytes: completeInputs.groundRigBytes,
})
assert.equal(wrongRig.review.integrationEvidenceComplete, false)
assert.equal(wrongRig.review.combinedRigComplete, false)
assert.match(wrongRig.review.errors.join('\n'), /four-owner common rig unexpectedly contains Ground Floor|does not pin the supplied common rig/)

const firstRig = buildCombinedPersistentRig({
  commonRigBytes: completeInputs.commonRigBytes,
  groundRigBytes: completeInputs.groundRigBytes,
})
const secondRig = buildCombinedPersistentRig({
  commonRigBytes: completeInputs.commonRigBytes,
  groundRigBytes: completeInputs.groundRigBytes,
})
assert.equal(firstRig.valid, true)
assert.equal(secondRig.valid, true)
assert.deepEqual(firstRig.bytes, secondRig.bytes)

console.log('Phase A complete disabled candidate gate: PASS')
console.log('  Web: 6,415 / 6,415 exact payload-level atomic ownership; 208 verified LOD0 payloads')
console.log('  Quest: 6,407 / 6,407 exact payload-level atomic ownership; 208 verified LOD0 payloads')
console.log('  combined persistent rig: 6 anchors / 4 unchanged channels / no render objects')
console.log('  missing unowned evidence, stale bytes, duplicate ownership, missing migration, enabled input, and wrong rig: rejected')
console.log('  release remains blocked; no runtime manifest or production route emitted')
