import assert from 'node:assert/strict'

import { parsePhaseAArgs } from './audit-phase-a-complete-disabled-candidate.mjs'
import { validateStructuralMaterialFidelity } from './lib/phase-a-complete-candidate-gate.mjs'

const baseline = parsePhaseAArgs([])
assert.equal(baseline.finalMode, false)

assert.throws(() => parsePhaseAArgs([
  '--structural-candidate',
  'tmp/structural/candidate-index.json',
]), /requires all explicit inputs/)

const finalArguments = [
  '--structural-candidate', 'tmp/structural/candidate-index.json',
  '--structural-repartition', 'tmp/structural/ownership-repartition-v2.json',
  '--structural-projection-audit', 'tmp/structural/visual-qa/projection-audit.json',
  '--shell-aware-plan', 'tmp/plan/unowned-static-partition-plan-v2.json',
  '--static-payload-index', 'tmp/static/payload-index.json',
  '--static-payload-audit', 'tmp/static/payload-audit.json',
  '--physical-resident-window', 'tmp/resident/unowned-static-resident-window-plan-v2.json',
  '--repeat-spatial-index', 'tmp/repeat/index.json',
  '--repeat-spatial-audit', 'tmp/repeat/physical-audit.json',
  '--out', 'tmp/phase-a-complete-disabled-candidate-v2',
]
const final = parsePhaseAArgs(finalArguments)
assert.equal(final.finalMode, true)
assert.match(final.structuralRepartition, /ownership-repartition-v2\.json$/)
assert.throws(() => parsePhaseAArgs(['--out', '../outside-viewer']), /must stay below/)
assert.throws(() => parsePhaseAArgs(['--unknown', 'tmp/value.json']), /Unknown argument/)

const contract = {
  variants: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
    inventory: {
      nodes: [{ id: `${variant}-node`, owner: '__unowned__', ownerRelativePath: 'scene/0/7' }],
      units: [
        { id: `${variant}-unit-0`, nodeId: `${variant}-node`, owner: '__unowned__' },
        { id: `${variant}-unit-1`, nodeId: `${variant}-node`, owner: '__unowned__' },
      ],
    },
  }])),
}
const structuralShellReview = {
  raw: {
    candidate: {
      safety: {
        materialFidelity: {
          materialFidelityReady: false,
          proxyTextureCount: 0,
          proxyImageCount: 0,
          nearLod0Required: true,
          nearLod0PackagePresent: false,
          releaseBlocked: true,
        },
      },
    },
    repartition: {
      compositionGuard: {
        materialFidelity: {
          materialFidelityReady: false,
          nearLod0Required: true,
          nearLod0PackagePresent: false,
          explicitReplacementSemanticsValidated: false,
        },
      },
    },
  },
  variants: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
    sourcePaths: ['scene/0/7'],
    sourceUnitIds: [`${variant}-unit-0`, `${variant}-unit-1`],
  }])),
}
const shellAwarePlan = {
  materialFidelity: {
    materialFidelityReady: true,
    nearLod0Required: true,
    nearLod0PackagePresent: true,
    explicitReplacementSemanticsValidated: true,
  },
}

const missingNear = validateStructuralMaterialFidelity({
  contract,
  structuralShellReview,
  shellAwarePlan,
  nearLod0Claims: { web: [], quest: [] },
})
assert.equal(missingNear.valid, false)
assert.match(missingNear.errors.join('\n'), /texture-free structural proxy is the sole near owner/)
assert.equal(missingNear.variants.web.missingWholePathCount, 1)
assert.equal(missingNear.variants.quest.missingWholePathCount, 1)

const completeNear = validateStructuralMaterialFidelity({
  contract,
  structuralShellReview,
  shellAwarePlan,
  nearLod0Claims: Object.fromEntries(['web', 'quest'].map((variant) => [variant, [{
    id: `${variant}-near-lod0`,
    sourceUnitIds: [`${variant}-unit-0`, `${variant}-unit-1`],
  }]])),
})
assert.equal(completeNear.valid, true, completeNear.errors.join('\n'))
assert.equal(completeNear.explicitReplacementSemanticsValidated, true)

console.log('Phase A final input/material-fidelity contract: PASS')
console.log('  partial/unknown/out-of-root CLI inputs: rejected')
console.log('  texture-free proxy without exact near-LOD0 whole-path coverage: rejected')
console.log('  exact near-LOD0 coverage with explicit replacement semantics: accepted as evidence')
