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

const baseConfig = {
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

// This is the complete populated LINAR physical-sample chart. Keep it
// independent of the production data array so accidental additions, omissions,
// reclassifications or value changes fail loudly.
const expectedSamples = [
  ['plywood', 4, 2, 2, 42, 15, 20, 36, 'Possible'],
  ['plywood', 6, 2, 2, 68, 20, 42, 34, 'Possible'],
  ['mdf', 4, 2, 2, 73, 20, 32, 35, 'Possible'],
  ['mdf', 6, 2, 2, 45, 30, 32, 30, 'Possible'],
  ['plywood', 6, 3, 3, 89, 20, 45, 32, 'Possible'],
  ['plywood', 9, 3, 3, 72, 30, 62, 28, 'Possible'],
  ['plywood', 10, 3, 3, 67, 40, 67, 25, 'Possible'],
  ['plywood', 9, 4, 4, 70, 50, 63, 27, 'Standard'],
  ['plywood', 12, 4, 4, 70, 60, 63, 27, 'Possible'],
  ['mdf', 8, 4, 4, 73, 60, 62, 29, 'Standard'],
  ['mdf', 10, 4, 4, 66, 70, 66, 25, 'Standard'],
  ['three-layer-spruce', 13, 4, 4, 70, 90, 65, 26, 'Standard'],
  ['mdf', 8, 5, 5, 60, 110, 55, 26, 'Possible'],
].map(
  ([
    material,
    thicknessMm,
    cutWidthMm,
    slatWidthMm,
    incisionLengthMm,
    minimumRadiusMm,
    measuredBridgeLengthMm,
    approximateOpenAreaPercent,
    status,
  ]) => ({
    material,
    thicknessMm,
    cutWidthMm,
    slatWidthMm,
    incisionLengthMm,
    minimumRadiusMm,
    measuredBridgeLengthMm,
    approximateOpenAreaPercent,
    status,
  }),
)

function sampleKey(sample) {
  return [
    sample.material,
    sample.thicknessMm,
    `${sample.cutWidthMm}/${sample.slatWidthMm}`,
    sample.incisionLengthMm,
  ].join('|')
}

function configFor(sample, overrides = {}) {
  return {
    ...baseConfig,
    material: sample.material,
    thicknessMm: sample.thicknessMm,
    cutWidthMm: sample.cutWidthMm,
    slatWidthMm: sample.slatWidthMm,
    incisionLengthMm: sample.incisionLengthMm,
    ...overrides,
  }
}

function approx(actual, expected, tolerance = 1e-6, label = 'value') {
  assert.equal(typeof actual, 'number', `${label} must be numeric`)
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`,
  )
}

const records = data.LINAR_CONFIGURATION_RECORDS
assert.equal(records.length, 13, 'active LINAR physical-sample row count')
assert.equal(
  records.filter(({ productionClassification }) => productionClassification === 'standard')
    .length,
  4,
  'Standard row count',
)
assert.equal(
  records.filter(({ productionClassification }) => productionClassification === 'possible')
    .length,
  9,
  'Possible physical-sample row count',
)
assert.equal(
  records.filter(
    ({ thicknessMm, notes = '', visualPosition = '' }) =>
      thicknessMm === 42 || /janus/i.test(`${notes} ${visualPosition}`),
  ).length,
  0,
  'JANUS must not be present in the active LINAR dataset',
)
assert.ok(
  records.every(({ physicalEvidence }) => physicalEvidence === 'physical-sample'),
  'all 13 populated chart rows are physical samples',
)
assert.ok(
  records.every(({ source, openAreaBasis }) =>
    source === 'latest-physical-samples-chart' && openAreaBasis === 'incised-area'),
  'chart source and open-area denominator must be explicit',
)

assert.deepEqual(
  [...records].map(sampleKey).sort(),
  expectedSamples.map(sampleKey).sort(),
  'active physical-sample identities',
)

const reportRows = []
for (const expected of expectedSamples) {
  const key = sampleKey(expected)
  const record = records.find((candidate) => sampleKey(candidate) === key)
  assert.ok(record, `${key} record`)
  assert.equal(record.minimumRadiusMm, expected.minimumRadiusMm, `${key} measured radius`)
  assert.equal(record.bridgeLengthMm, expected.measuredBridgeLengthMm, `${key} measured bridge`)
  assert.equal(
    record.approximateOpenAreaPercent,
    expected.approximateOpenAreaPercent,
    `${key} approximate chart open area`,
  )
  assert.equal(record.productionStandard, expected.status === 'Standard', `${key} Standard flag`)
  assert.equal(record.boldFrame, expected.status === 'Standard', `${key} bold-frame flag`)

  const config = configFor(expected)
  const exact = data.findExactSample(config)
  assert.ok(exact, `${key} exact sample lookup`)
  assert.equal(sampleKey(exact), key, `${key} exact sample identity`)

  const tech = data.resolveLinarTech(config)
  assert.equal(tech.status, expected.status, `${key} resolved status`)
  assert.equal(
    tech.productionClassification,
    expected.status === 'Standard' ? 'standard' : 'possible',
    `${key} resolved production classification`,
  )
  assert.equal(tech.physicalEvidence, 'physical-sample', `${key} physical evidence`)
  assert.equal(tech.feasibility, 'allowed', `${key} feasibility`)
  assert.equal(tech.referenceMinimumRadiusMm, expected.minimumRadiusMm, `${key} resolved radius`)
  assert.equal(
    tech.physicalSampleBridgeLengthMm,
    expected.measuredBridgeLengthMm,
    `${key} separately retained measured bridge`,
  )
  assert.equal(
    tech.referenceOpenAreaPercent,
    expected.approximateOpenAreaPercent,
    `${key} separately retained approximate chart open area`,
  )

  const cadBridge = tech.cadGeometry.bridgeSpanMm
  const generatedBridge = tech.previewBridgeLengthMm
  approx(tech.displayedBridgeLengthMm, generatedBridge, 1e-9, `${key} displayed/render bridge`)
  approx(generatedBridge, cadBridge, 1e-9, `${key} generated bridge must remain CAD-derived`)
  assert.equal(tech.bridgeUsesSampleOverride, false, `${key} no measured bridge geometry override`)

  const expectedCadOpen =
    (expected.cutWidthMm / (expected.cutWidthMm + expected.slatWidthMm)) *
    (expected.incisionLengthMm / (expected.incisionLengthMm + cadBridge)) *
    100
  approx(
    tech.geometricIncisedOpenAreaPercent,
    expectedCadOpen,
    1e-9,
    `${key} generated CAD open area`,
  )

  reportRows.push({
    sample: key,
    class: expected.status,
    chartOpen: expected.approximateOpenAreaPercent,
    generatedOpen: tech.geometricIncisedOpenAreaPercent,
    openDelta: tech.geometricIncisedOpenAreaPercent - expected.approximateOpenAreaPercent,
    measuredBridge: expected.measuredBridgeLengthMm,
    cadBridge,
    generatedBridge,
    measuredCadDelta: expected.measuredBridgeLengthMm - cadBridge,
    generatedCadDelta: generatedBridge - cadBridge,
  })
}

// Plywood 12 / 4/4 / 70 is a measured physical sample, but it is explicitly
// not one of the four production Standards.
const plywoodTwelve = data.resolveLinarTech(
  configFor(expectedSamples.find(({ material, thicknessMm, cutWidthMm }) =>
    material === 'plywood' && thicknessMm === 12 && cutWidthMm === 4,
  )),
)
assert.equal(plywoodTwelve.status, 'Possible')
assert.equal(plywoodTwelve.physicalEvidence, 'physical-sample')

// Numeric lookup is tolerant of harmless floating-point transport noise, but
// incision length remains part of the exact five-field manufacturing match.
const standardPlywood = expectedSamples.find(
  ({ material, thicknessMm, cutWidthMm }) =>
    material === 'plywood' && thicknessMm === 9 && cutWidthMm === 4,
)
const matchTolerance = data.LINAR_SAMPLE_MATCH_TOLERANCE_MM
assert.ok(matchTolerance.thickness > 0, 'thickness tolerance must be positive')
assert.ok(matchTolerance.width > 0, 'width tolerance must be positive')
assert.ok(matchTolerance.length > 0, 'length tolerance must be positive')
const withinTolerance = configFor(standardPlywood, {
  thicknessMm: standardPlywood.thicknessMm + matchTolerance.thickness * 0.5,
  cutWidthMm: standardPlywood.cutWidthMm - matchTolerance.width * 0.5,
  slatWidthMm: standardPlywood.slatWidthMm + matchTolerance.width * 0.5,
  incisionLengthMm: standardPlywood.incisionLengthMm - matchTolerance.length * 0.5,
})
assert.ok(data.findExactSample(withinTolerance), 'values inside exported tolerance should match')
assert.equal(data.resolveLinarTech(withinTolerance).status, 'Standard')

const incisionNearMiss = configFor(standardPlywood, {
  incisionLengthMm: standardPlywood.incisionLengthMm + matchTolerance.length * 2,
})
assert.equal(data.findExactSample(incisionNearMiss), null, 'incision outside exported tolerance')
const nearMissTech = data.resolveLinarTech(incisionNearMiss)
assert.equal(nearMissTech.status, 'Not tested')
assert.equal(nearMissTech.sourceRecord, null)
assert.equal(nearMissTech.referenceMinimumRadiusMm, null)
assert.ok(nearMissTech.physicalSampleBridgeLengthMm == null)
assert.equal(nearMissTech.referenceOpenAreaPercent, null)

const widthNearMiss = configFor(standardPlywood, {
  cutWidthMm: standardPlywood.cutWidthMm + matchTolerance.width * 2,
})
assert.equal(data.findExactSample(widthNearMiss), null, 'cut width outside exported tolerance')

const blankChartCombination = data.resolveLinarTech(
  configFor(standardPlywood, {
    cutWidthMm: 6,
    slatWidthMm: 6,
    incisionLengthMm: 70,
  }),
)
assert.equal(blankChartCombination.status, 'Not tested')
assert.equal(blankChartCombination.sourceRecord, null)
assert.equal(blankChartCombination.referenceMinimumRadiusMm, null)
assert.ok(blankChartCombination.physicalSampleBridgeLengthMm == null)
assert.equal(blankChartCombination.referenceOpenAreaPercent, null)
assert.notEqual(
  blankChartCombination.referenceMinimumRadiusMm,
  data.CONSERVATIVE_RADIUS_NOTE_MM,
  '120 mm general reference must never become a tested minimum',
)

const valchromatNearStandard = data.resolveLinarTech(
  configFor(
    expectedSamples.find(
      ({ material, thicknessMm, cutWidthMm }) =>
        material === 'mdf' && thicknessMm === 10 && cutWidthMm === 4,
    ),
    { mdfVariant: 'valchromat' },
  ),
)
assert.equal(valchromatNearStandard.status, 'Not tested')
assert.equal(valchromatNearStandard.physicalEvidence, 'unknown')
assert.ok(valchromatNearStandard.physicalSampleBridgeLengthMm == null)

// The confirmed MDF 4 mm / 8/2 block is a broad feasibility rule. It applies
// regardless of incision length and does not manufacture physical evidence.
for (const incisionLengthMm of [40, 73, 399.5]) {
  const blocked = data.resolveLinarTech({
    ...baseConfig,
    material: 'mdf',
    thicknessMm: 4,
    cutWidthMm: 8,
    slatWidthMm: 2,
    incisionLengthMm,
  })
  assert.equal(blocked.status, 'Not recommended', `blocked at ${incisionLengthMm} mm`)
  assert.equal(blocked.feasibility, 'blocked', `blocked feasibility at ${incisionLengthMm} mm`)
  assert.equal(blocked.isConfigurationValid, false, `invalid at ${incisionLengthMm} mm`)
  assert.equal(blocked.referenceMinimumRadiusMm, null)
  assert.ok(blocked.physicalSampleBridgeLengthMm == null)
}

const signed = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(3)}`
const report = [
  '',
  'LINAR physical-sample cross-check (mm; open area in percentage points)',
  '| Sample | Class | Chart open | Generated CAD open | Delta | Measured bridge | CAD bridge | Generated bridge | Measured-CAD | Generated-CAD |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...reportRows.map(
    (row) =>
      `| ${row.sample} | ${row.class} | ${row.chartOpen.toFixed(3)} | ${row.generatedOpen.toFixed(3)} | ${signed(row.openDelta)} | ${row.measuredBridge.toFixed(3)} | ${row.cadBridge.toFixed(3)} | ${row.generatedBridge.toFixed(3)} | ${signed(row.measuredCadDelta)} | ${signed(row.generatedCadDelta)} |`,
  ),
  '',
  'The chart and measured-bridge columns are physical-sample references. The generated columns describe current CAD-derived rendering geometry; a delta is disclosed, never silently reconciled.',
]

console.log(report.join('\n'))
console.log('LINAR final 13-sample classification, matching and discrepancy checks passed.')
