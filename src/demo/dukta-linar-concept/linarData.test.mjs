import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: ['src/demo/dukta-linar-concept/linarData.ts'],
  absWorkingDir: process.cwd(),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  write: false,
})
const source = bundle.outputFiles[0].text
const data = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

const base = {
  material: 'plywood',
  veneer: 'none',
  mdfVariant: 'natural',
  mdfColour: 'grey',
  fleeceColour: 'black',
  feltColour: 'raw-white',
  thicknessMm: 9,
  incisionLengthMm: 70,
  cutWidthMm: 4,
  slatWidthMm: 4,
  incisedTwelfths: 12,
  pattern: 'regular',
  application: 'freestanding',
  backing: 'none',
  backlightMode: 'off',
  backlightIntensity: 60,
  panelCount: 1,
  bendDirection: 'flat',
  bendRadiusMm: null,
  secondaryBend: null,
}

assert.equal(data.LINAR_CONFIGURATION_RECORDS.length, 13)
assert.equal(data.LINAR_CONFIGURATION_RECORDS.filter(({ boldFrame }) => boldFrame).length, 4)
assert.equal(
  data.LINAR_CONFIGURATION_RECORDS.filter(
    ({ productionClassification }) => productionClassification === 'possible',
  ).length,
  9,
)
assert.ok(
  data.LINAR_CONFIGURATION_RECORDS.every(
    ({ physicalEvidence }) => physicalEvidence === 'physical-sample',
  ),
)

const standard = data.resolveLinarTech(base)
assert.equal(standard.status, 'Standard')
assert.equal(standard.productionClassification, 'standard')
assert.equal(standard.physicalEvidence, 'physical-sample')
assert.equal(standard.feasibility, 'allowed')
assert.equal(standard.referenceMinimumRadiusMm, 50)

const possible = data.resolveLinarTech({
  ...base,
  cutWidthMm: 3,
  slatWidthMm: 3,
  incisionLengthMm: 72,
})
assert.equal(possible.status, 'Possible')
assert.equal(possible.productionClassification, 'possible')
assert.equal(possible.physicalEvidence, 'physical-sample')
assert.equal(possible.feasibility, 'allowed')
assert.equal(possible.referenceMinimumRadiusMm, 30)
assert.equal(possible.physicalSampleBridgeLengthMm, 62)
assert.equal(possible.bridgeUsesSampleOverride, false)

const unlisted = data.resolveLinarTech({ ...base, incisionLengthMm: 71 })
assert.equal(unlisted.status, 'Not tested')
assert.equal(unlisted.productionClassification, 'not-tested')
assert.equal(unlisted.physicalEvidence, 'unknown')
assert.equal(unlisted.feasibility, 'unknown')
assert.equal(unlisted.referenceMinimumRadiusMm, null)
assert.equal(unlisted.physicalSampleBridgeLengthMm, null)

const blocked = data.resolveLinarTech({
  ...base,
  material: 'mdf',
  thicknessMm: 4,
  cutWidthMm: 8,
  slatWidthMm: 2,
})
assert.equal(blocked.status, 'Not recommended')
assert.equal(blocked.feasibility, 'blocked')
assert.equal(blocked.isConfigurationValid, false)
assert.equal(blocked.referenceMinimumRadiusMm, null)

const naturalMdf = data.resolveLinarTech({
  ...base,
  material: 'mdf',
  thicknessMm: 10,
  incisionLengthMm: 66,
})
assert.equal(naturalMdf.status, 'Standard')
assert.equal(naturalMdf.physicalEvidence, 'physical-sample')
assert.equal(naturalMdf.referenceMinimumRadiusMm, 70)

const valchromat = data.resolveLinarTech({
  ...base,
  material: 'mdf',
  mdfVariant: 'valchromat',
  thicknessMm: 10,
  incisionLengthMm: 66,
})
assert.equal(valchromat.status, 'Not tested')
assert.equal(valchromat.productionClassification, 'not-tested')
assert.equal(valchromat.physicalEvidence, 'unknown')
assert.equal(valchromat.feasibility, 'unknown')
assert.equal(valchromat.referenceMinimumRadiusMm, null)
assert.equal(valchromat.bridgeUsesSampleOverride, false)

console.log('LINAR classification/evidence/feasibility checks passed.')
