import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeWholeLayerOwnershipPlan } from './lib/whole-layer-plan-composer.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const FOUR_CANDIDATES = [
  'hlod-pilot-first-floor-shell-candidate',
  'hlod-pilot-second-floor-shell-candidate',
  'hlod-pilot-mezzanine-shell-candidate',
  'hlod-pilot-ceiling-shell-candidate',
]

async function jsonFile(path) {
  const bytes = await readFile(path)
  return { bytes, value: JSON.parse(bytes.toString('utf8')) }
}

async function candidate(directory) {
  const root = resolve(VIEWER_ROOT, 'tmp', directory)
  const index = await jsonFile(resolve(root, 'detail-package-index.json'))
  const audit = await jsonFile(resolve(root, 'shell-package-audit.json'))
  return {
    indexPath: `${directory}/detail-package-index.json`,
    indexBytes: index.bytes,
    index: index.value,
    auditPath: `${directory}/shell-package-audit.json`,
    auditBytes: audit.bytes,
    audit: audit.value,
  }
}

const contractFile = await jsonFile(resolve(VIEWER_ROOT, 'tmp', 'whole-layer-ownership-v1', 'whole-layer-ownership-contract-v1.json'))
const migrationFile = await jsonFile(resolve(VIEWER_ROOT, 'tmp', 'fire-hose-ownership-candidate', 'source-ownership-migration-v1.json'))
const unownedFile = await jsonFile(resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v1', 'unowned-static-partition-plan-v1.json'))
const ownerCandidates = []
for (const directory of FOUR_CANDIDATES) ownerCandidates.push(await candidate(directory))
const groundCandidate = await candidate('hlod-pilot-ground-floor-shell-candidate')

function compose(overrides = {}) {
  return composeWholeLayerOwnershipPlan({
    contract: contractFile.value,
    contractBytes: contractFile.bytes,
    ownerCandidates,
    groundCandidate,
    migration: migrationFile.value,
    migrationBytes: migrationFile.bytes,
    unownedPlan: unownedFile.value,
    unownedPlanBytes: unownedFile.bytes,
    ...overrides,
  })
}

const complete = compose()
assert.equal(complete.review.ownershipPlanComplete, true, complete.review.errors.join('\n'))
assert.equal(complete.review.releaseReady, false)
assert.equal(complete.review.payloadCoverageComplete, false)
assert.equal(complete.review.runtimeManifestEmitted, false)
assert.equal(complete.plan.runtimeManifestEmitted, false)
assert.equal(complete.review.contractUnchanged, true)
assert.equal(complete.review.baseWrongOwnerGate.rejected, true)
assert.equal(complete.review.migration.valid, true)
assert.equal(complete.review.correctedGroundCandidate.accepted, true)
assert.equal(complete.review.unownedPlan.valid, true)
for (const [variantName, expected] of [['web', 6_415], ['quest', 6_407]]) {
  const coverage = complete.review.coverage[variantName]
  assert.equal(coverage.valid, true)
  assert.equal(coverage.expectedAtomicUnits, expected)
  assert.equal(coverage.claimedUniqueAtomicUnits, expected)
  assert.equal(coverage.claimOccurrences, expected)
  assert.equal(coverage.missingCount, 0)
  assert.equal(coverage.duplicateCount, 0)
  assert.equal(coverage.unauthorizedLogicalMoveCount, 0)
  assert.equal(coverage.originalPartitions.originalGround, 230)
  assert.equal(coverage.originalPartitions.unownedRepeat, 312)
  assert.equal(coverage.originalPartitions.migratedFire, 60)
  assert.equal(coverage.originalPartitions.remainingUnownedStatic, 2_843)
  assert.equal(coverage.logicalOwners['Ground Floor._anim1'], 290)
  assert.equal(coverage.logicalOwners.__unowned__, 3_155)
  assert.equal(coverage.migratedFire.authorizedBySidecar, 60)
  assert.equal(coverage.migratedFire.claimedByGround, 60)
  assert.equal(coverage.migratedFire.claimedByUnowned, 0)
  assert.equal(coverage.migratedFire.repeatOrStaticOverlap, 0)
  assert.equal(coverage.unownedPlan.repeatAtomicUnits, 312)
  assert.equal(coverage.unownedPlan.remainingStaticAtomicUnits, 2_843)
}

const missingMigration = compose({ migration: null, migrationBytes: null })
assert.equal(missingMigration.review.ownershipPlanComplete, false)
assert.equal(missingMigration.review.migration.valid, false)
assert.match(missingMigration.review.errors.join('\n'), /migration sidecar is required/)
assert.equal(missingMigration.review.coverage.web.missingCount, 290)
assert.equal(missingMigration.review.coverage.quest.missingCount, 290)

const staleMigration = compose({ migrationBytes: Buffer.concat([migrationFile.bytes, Buffer.from('\n')]) })
assert.equal(staleMigration.review.ownershipPlanComplete, false)
assert.equal(staleMigration.review.migration.valid, false)
assert.match(staleMigration.review.errors.join('\n'), /migration sidecar bytes are missing or stale/)
assert.equal(staleMigration.review.coverage.web.missingCount, 290)
assert.equal(staleMigration.review.coverage.quest.missingCount, 290)

const overlappingUnowned = structuredClone(unownedFile.value)
const fireId = overlappingUnowned.fireHoseMigration.variants.web.sourceUnitIds[0]
overlappingUnowned.staticPackages[0].variants.web.sourceUnitIds.push(fireId)
const fireOverlap = compose({ unownedPlan: overlappingUnowned })
assert.equal(fireOverlap.review.ownershipPlanComplete, false)
assert.equal(fireOverlap.review.unownedPlan.valid, false)
assert.match(fireOverlap.review.errors.join('\n'), /fire\/static overlap detected/)
assert.equal(fireOverlap.review.coverage.web.duplicateCount, 1)
assert.equal(fireOverlap.review.coverage.web.migratedFire.claimedByUnowned, 1)
assert.equal(fireOverlap.review.coverage.web.migratedFire.repeatOrStaticOverlap, 1)

console.log('Whole-layer logical ownership plan composer: PASS')
console.log('  Web: 6,415 / 6,415 exact multiplicity-one source coverage')
console.log('  Quest: 6,407 / 6,407 exact multiplicity-one source coverage')
console.log('  logical Ground: 230 original + 60 sidecar-authorized fire = 290')
console.log('  logical unowned: 312 repeat + 2,843 static = 3,155; migrated fire excluded')
console.log('  unchanged base wrong-owner gate still rejects direct fire-to-Ground claims')
console.log('  missing migration, stale migration, and fire/static overlap: rejected')
console.log('  ownership plan complete; payload/release readiness remains blocked')
