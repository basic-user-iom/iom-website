/** Reproducibility and fail-closed mutation tests for partition plan v2. */
import assert from 'node:assert/strict'
import {
  buildUnownedStaticPlanV2,
  validateUnownedStaticPlanV2,
} from './build-unowned-static-partition-plan-v2.mjs'

const baseline = await buildUnownedStaticPlanV2()
const rebuilt = await buildUnownedStaticPlanV2()
assert.equal(rebuilt.plan.planDigestSha256, baseline.plan.planDigestSha256,
  'Identical pinned inputs did not reproduce the same v2 plan digest')
assert.equal(rebuilt.plan.staticPackagesDigestSha256, baseline.plan.staticPackagesDigestSha256,
  'Identical pinned inputs did not reproduce the same package digest')

const { plan, contract, context } = baseline
const valid = validateUnownedStaticPlanV2(plan, contract, context)
assert.equal(valid.valid, true, valid.errors.join('\n'))

function mutatedPlan() {
  return structuredClone(plan)
}

function expectBlocked(candidate, pattern, label) {
  const result = validateUnownedStaticPlanV2(candidate, contract, context)
  assert.equal(result.valid, false, `${label}: mutation unexpectedly passed`)
  assert.ok(result.errors.some((error) => pattern.test(error)),
    `${label}: expected ${pattern}, got ${result.errors.join(' | ')}`)
}

const shellDetailOverlap = mutatedPlan()
const shellId = shellDetailOverlap.shellCandidate.variants.web.sourceUnitIds[0]
shellDetailOverlap.staticPackages.find((pkg) => pkg.variants.web.sourceUnitIds.length > 0)
  .variants.web.sourceUnitIds.push(shellId)
expectBlocked(shellDetailOverlap, /shellDetail overlap detected/, 'shell/detail overlap')

const omitted = mutatedPlan()
omitted.staticPackages.find((pkg) => pkg.variants.quest.sourceUnitIds.length > 0)
  .variants.quest.sourceUnitIds.pop()
expectBlocked(omitted, /quest: detail omission detected/, 'detail omission')

const staleSidecar = mutatedPlan()
staleSidecar.evidencePins.ownershipRepartition.sha256 = '0'.repeat(64)
expectBlocked(staleSidecar, /ownership repartition sidecar pin is stale/, 'stale repartition sidecar pin')

const staleSource = mutatedPlan()
staleSource.variants.quest.source.sha256 = '0'.repeat(64)
expectBlocked(staleSource, /quest: source pin is stale/, 'stale source pin')

const staleOutput = mutatedPlan()
staleOutput.shellCandidate.variants.web.output.sha256 = '0'.repeat(64)
expectBlocked(staleOutput, /web shell output pin is stale/, 'stale shell output pin')

const nonWholePath = mutatedPlan()
nonWholePath.shellCandidate.variants.web.sourcePaths[0] += '/primitive/0'
expectBlocked(nonWholePath, /non-whole path/, 'non-whole shell path')

const enabled = mutatedPlan()
enabled.enabled = true
expectBlocked(enabled, /enabled must remain false/, 'accidental enable')

const ready = mutatedPlan()
ready.ready = true
expectBlocked(ready, /ready must remain false|rejected shell visual audit must fail closed/, 'accidental ready')

const approved = mutatedPlan()
approved.activationApproved = true
expectBlocked(approved, /activationApproved must remain false|rejected shell visual audit must fail closed/, 'accidental approval')

assert.equal(plan.schema, 'IOM_UNOWNED_STATIC_PARTITION_PLAN')
assert.equal(plan.version, 2)
assert.equal(plan.staticPackages.length, 117)
assert.equal(plan.shellCandidate.visualGate.passed, false)
assert.equal(plan.shellCandidate.visualGate.status, 'projection-insufficient-candidate-rejected-for-activation')
assert.equal(plan.shellCandidate.variants.web.sourcePathCount, 56)
assert.equal(plan.shellCandidate.variants.quest.sourcePathCount, 56)
assert.equal(plan.shellCandidate.variants.web.atomicUnitCount, 181)
assert.equal(plan.shellCandidate.variants.quest.atomicUnitCount, 180)
assert.equal(plan.detailComplement.variants.web.atomicUnitCount, 2662)
assert.equal(plan.detailComplement.variants.quest.atomicUnitCount, 2663)
for (const variant of ['web', 'quest']) {
  assert.equal(plan.repeatCandidate.variants[variant].summary.atomicUnitCount, 312)
  assert.equal(plan.fireHoseMigration.variants[variant].summary.atomicUnitCount, 60)
  assert.equal(plan.conservation.variants[variant].wholeUnownedAtomicUnits, 3215)
  assert.equal(plan.conservation.variants[variant].multiplicityOne, true)
  assert.equal(plan.conservation.variants[variant].omittedAtomicUnits, 0)
  assert.equal(plan.conservation.variants[variant].overlapAtomicUnits, 0)
}

console.log('Unowned/static partition plan v2 tests: PASS')
console.log('  deterministic rebuild: PASS')
console.log('  exact whole-path shell/detail conservation: PASS')
console.log('  shell/detail overlap: BLOCKED')
console.log('  detail omission: BLOCKED')
console.log('  stale repartition sidecar pin: BLOCKED')
console.log('  stale source pin: BLOCKED')
console.log('  stale shell output pin: BLOCKED')
console.log('  non-whole shell path: BLOCKED')
console.log('  accidental enable/ready/approval: BLOCKED')
