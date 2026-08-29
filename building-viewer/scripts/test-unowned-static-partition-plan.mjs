/** Negative and reproducibility checks for the disabled unowned/static plan. */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import {
  buildUnownedStaticPlan,
  validateUnownedStaticPlan,
} from './build-unowned-static-partition-plan.mjs'

const repeatRoot = resolve(process.argv[2] || 'tmp/repeat-geometry-release-candidate')
const { plan, contract } = await buildUnownedStaticPlan({ repeatRoot })
const reproducibility = await buildUnownedStaticPlan({ repeatRoot })
assert.equal(reproducibility.plan.planDigestSha256, plan.planDigestSha256,
  'Identical pinned inputs did not reproduce the same plan digest')

const valid = validateUnownedStaticPlan(plan, contract)
assert.equal(valid.valid, true, valid.errors.join('\n'))

function mutatedPlan() {
  return structuredClone(plan)
}

function expectBlocked(candidate, pattern, label) {
  const result = validateUnownedStaticPlan(candidate, contract)
  assert.equal(result.valid, false, `${label}: mutation unexpectedly passed`)
  assert.ok(result.errors.some((error) => pattern.test(error)),
    `${label}: expected ${pattern}, got ${result.errors.join(' | ')}`)
}

const omitted = mutatedPlan()
const omissionPackage = omitted.staticPackages.find((pkg) => pkg.variants.web.sourceUnitIds.length > 0)
omissionPackage.variants.web.sourceUnitIds.pop()
expectBlocked(omitted, /omission detected|2,903 unique units/, 'omission')

const duplicated = mutatedPlan()
const duplicateSource = duplicated.staticPackages.find((pkg) => pkg.variants.web.sourceUnitIds.length > 0)
const duplicateTarget = duplicated.staticPackages.find((pkg) => pkg !== duplicateSource)
duplicateTarget.variants.web.sourceUnitIds.push(duplicateSource.variants.web.sourceUnitIds[0])
expectBlocked(duplicated, /duplication detected/, 'duplication')

const repeatOverlap = mutatedPlan()
const repeatId = repeatOverlap.repeatCandidate.variants.web.batches[0].sourceUnitIds[0]
repeatOverlap.staticPackages[0].variants.web.sourceUnitIds.push(repeatId)
expectBlocked(repeatOverlap, /repeat\/static overlap detected/, 'repeat overlap')

const fireOverlap = mutatedPlan()
const fireId = fireOverlap.fireHoseMigration.variants.web.sourceUnitIds[0]
fireOverlap.staticPackages[0].variants.web.sourceUnitIds.push(fireId)
expectBlocked(fireOverlap, /fire\/static overlap detected/, 'fire overlap')

const repeatFireOverlap = mutatedPlan()
repeatFireOverlap.fireHoseMigration.variants.web.sourceUnitIds[0] =
  repeatFireOverlap.repeatCandidate.variants.web.batches[0].sourceUnitIds[0]
expectBlocked(repeatFireOverlap, /repeat\/fire overlap detected/, 'repeat/fire overlap')

const enabled = mutatedPlan()
enabled.enabled = true
expectBlocked(enabled, /enabled must remain false/, 'enabled flag')

const staleSource = mutatedPlan()
staleSource.variants.quest.source.sha256 = '0'.repeat(64)
expectBlocked(staleSource, /quest: source hash is stale/, 'source hash')

const staleBounds = mutatedPlan()
const bounded = staleBounds.staticPackages.find((pkg) => pkg.variants.web.bounds)
bounded.variants.web.bounds.min[0] = bounded.variants.web.bounds.max[0] + 1
expectBlocked(staleBounds, /package bounds do not contain/, 'bounds')

assert.match(plan.planDigestSha256, /^[a-f0-9]{64}$/)
assert.equal(plan.repeatCandidate.sourceNodeIds.length, 4)
assert.deepEqual(plan.repeatCandidate.sourceNodeIds, [
  'owner/__unowned__/node/scene/0/258',
  'owner/__unowned__/node/scene/0/259',
  'owner/__unowned__/node/scene/0/260',
  'owner/__unowned__/node/scene/0/261',
])
for (const variant of ['web', 'quest']) {
  assert.equal(plan.variants[variant].inventory.renderNodeCount, 398)
  assert.equal(plan.variants[variant].inventory.logicalInstanceCount, 3060)
  assert.equal(plan.variants[variant].inventory.atomicUnitCount, 3215)
  assert.equal(plan.repeatCandidate.variants[variant].summary.atomicUnitCount, 312)
  assert.equal(plan.fireHoseMigration.variants[variant].summary.atomicUnitCount, 60)
  const staticCount = plan.staticPackages.reduce((sum, pkg) => sum + pkg.variants[variant].atomicUnitCount, 0)
  assert.equal(staticCount, 2843)
}

console.log('Unowned/static partition negative tests: PASS')
console.log('  baseline exact coverage: PASS')
console.log('  deterministic rebuild digest: PASS')
console.log('  omission: BLOCKED')
console.log('  duplication: BLOCKED')
console.log('  repeat/static overlap: BLOCKED')
console.log('  fire/static overlap: BLOCKED')
console.log('  repeat/fire overlap: BLOCKED')
console.log('  enabled flag: BLOCKED')
console.log('  stale source hash: BLOCKED')
console.log('  invalid bounds: BLOCKED')
