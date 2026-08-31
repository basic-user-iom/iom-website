import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeEphemerisBinary, encodeEphemerisBinary } from '../binary-format.mjs';
import { mergeParsedChunks } from '../chunk-merge.mjs';
import { parseEphemerisCli, parseStepSeconds } from '../cli.mjs';
import { parseHorizonsVectors } from '../horizons-parser.mjs';
import { selectWithheldEpochs } from '../fetch-validation-references.mjs';
import {
  buildHorizonsRequestUrl,
  buildHorizonsTlistRequestUrl,
  formatHorizonsStep,
  planHorizonsChunks,
} from '../horizons-request.mjs';
import { createValidationReport, interpolateHermite } from '../validation.mjs';

const catalog = {
  centerId: '10',
  centerCommand: '500@10',
  referenceFrame: 'ICRF',
  referencePlane: 'ECLIPTIC',
  timeScale: 'TDB',
  sourceUnits: 'KM-S',
};
const earth = {
  id: 'earth',
  targetId: '399',
  expectedTargetNames: ['Earth'],
  defaultStepSeconds: 86_400,
};

test('CLI parses bodies, offline mode, and exact unit steps', () => {
  assert.equal(parseStepSeconds('6h'), 21_600);
  assert.equal(parseStepSeconds('1 d'), 86_400);
  const options = parseEphemerisCli(
    ['--start', '2025-01-01', '--end', '2025-01-03', '--body', 'earth,moon', '--offline'],
    '/workspace',
  );
  assert.deepEqual(options.bodyIds, ['earth', 'moon']);
  assert.equal(options.offline, true);
  assert.throws(() => parseEphemerisCli(['--offline', '--refresh-cache']), /cannot be used together/);
});

test('request builder emits the declared Horizons vector contract', () => {
  const url = buildHorizonsRequestUrl({
    body: earth,
    catalog,
    startDate: '2025-01-01',
    endDate: '2025-01-02',
    stepSeconds: 86_400,
  });
  assert.equal(url.origin, 'https://ssd.jpl.nasa.gov');
  assert.equal(url.searchParams.get('COMMAND'), "'399'");
  assert.equal(url.searchParams.get('CENTER'), "'500@10'");
  assert.equal(url.searchParams.get('REF_PLANE'), "'ECLIPTIC'");
  assert.equal(url.searchParams.get('REF_SYSTEM'), "'ICRF'");
  assert.equal(url.searchParams.get('OUT_UNITS'), "'KM-S'");
  assert.equal(url.searchParams.get('VEC_CORR'), "'NONE'");
  assert.equal(url.searchParams.get('STEP_SIZE'), "'1 d'");
  assert.equal(formatHorizonsStep(21_600), '6 h');
});

test('chunk planner stays within row cap and overlaps boundaries', () => {
  const chunks = planHorizonsChunks({
    startDate: '2000-01-01',
    endDate: '2000-01-11',
    stepSeconds: 86_400,
    maxRows: 4,
  });
  assert.deepEqual(chunks, [
    { startDate: '2000-01-01 00:00:00', endDate: '2000-01-04 00:00:00' },
    { startDate: '2000-01-04 00:00:00', endDate: '2000-01-07 00:00:00' },
    { startDate: '2000-01-07 00:00:00', endDate: '2000-01-10 00:00:00' },
    { startDate: '2000-01-10 00:00:00', endDate: '2000-01-11 00:00:00' },
  ]);
});

test('withheld epochs are deterministic, stratified, and quarter-step only', () => {
  const input = {
    bodyId: 'earth',
    startJdTdb: 2_451_544,
    endJdTdb: 2_451_554,
    stepSeconds: 86_400,
    intervalCount: 3,
    seed: 'fixture',
  };
  const first = selectWithheldEpochs(input);
  assert.deepEqual(first, selectWithheldEpochs(input));
  assert.equal(first.length, 9);
  for (const jd of first) {
    const phase = (jd - input.startJdTdb) % 1;
    assert.ok([0.25, 0.5, 0.75].some((expected) => Math.abs(phase - expected) < 1e-10));
  }
  const url = buildHorizonsTlistRequestUrl({ body: earth, catalog, jdTdb: first });
  assert.equal(url.searchParams.get('TLIST_TYPE'), "'JD'");
  assert.match(url.searchParams.get('TLIST'), /^'\d+\.\d{12}','\d+\.\d{12}'/);
  assert.equal(url.searchParams.has('STEP_SIZE'), false);
});

test('strict parser validates identity/markers and converts KM-S to SI once', () => {
  const parsed = parseHorizonsVectors(horizonsFixture(), {
    body: earth,
    catalog,
    expectedStepSeconds: 86_400,
  });
  assert.equal(parsed.sampleCount, 2);
  assert.equal(parsed.valuesSi[0], 1_000);
  assert.equal(parsed.valuesSi[3], 4_000);
  assert.equal(parsed.valuesSi[6], 7_000);
  assert.equal(parsed.targetSource, 'DE441');
  assert.throws(
    () => parseHorizonsVectors(horizonsFixture().replace('Earth (399)', 'Mars (499)'), {
      body: earth,
      catalog,
      expectedStepSeconds: 86_400,
    }),
    /target mismatch/,
  );
  assert.throws(
    () => parseHorizonsVectors(horizonsFixture().replace('$$EOE', '$$SOE'), {
      body: earth,
      catalog,
      expectedStepSeconds: 86_400,
    }),
    /marker pair/,
  );
  assert.throws(
    () => parseHorizonsVectors(horizonsFixture().replace('JDTDB', 'JDUT'), {
      body: earth,
      catalog,
      expectedStepSeconds: 86_400,
    }),
    /TDB epochs and JDTDB/,
  );
  assert.throws(
    () => parseHorizonsVectors(horizonsFixture().replace('Output format   : 2', 'Output format   : 1'), {
      body: earth,
      catalog,
      expectedStepSeconds: 86_400,
    }),
    /vector table 2/,
  );
});

test('chunk merge removes only verified overlap', () => {
  const first = makeDataset('earth', 2_451_544, [1, 2]);
  const second = makeDataset('earth', 2_451_545, [2, 3]);
  const merged = mergeParsedChunks([first, second]);
  assert.equal(merged.sampleCount, 3);
  assert.deepEqual([...merged.sampleJdTdb], [2_451_544, 2_451_545, 2_451_546]);
  assert.equal(merged.valuesSi[12], 3);
  const bad = makeDataset('earth', 2_451_545, [20, 3]);
  assert.throws(() => mergeParsedChunks([first, bad]), /boundary state differs/);
});

test('binary round trips variable body rates through the v1 contract', () => {
  const earthDataset = makeDataset('earth', 2_451_544, [1, 2]);
  const moonDataset = makeDataset('moon', 2_451_544, [10, 11], 21_600);
  const encoded = encodeEphemerisBinary([earthDataset, moonDataset]);
  assert.equal(encoded.subarray(0, 8).toString('latin1'), 'IOMEPH\0\0');
  const decoded = decodeEphemerisBinary(encoded);
  assert.equal(decoded.bodies[0].stepSeconds, 86_400);
  assert.equal(decoded.bodies[1].stepSeconds, 21_600);
  assert.deepEqual([...decoded.bodies[1].valuesSi], [...moonDataset.valuesSi]);
});

test('Hermite validation supports explicit per-body budgets', () => {
  const dataset = makeLinearDataset();
  const midpoint = interpolateHermite(dataset, dataset.startJdTdb + 0.5);
  assert.deepEqual(midpoint.positionM, [43_200, 0, 0]);
  assert.deepEqual(midpoint.velocityMps, [1, 0, 0]);
  const report = createValidationReport([dataset], {
    independent: true,
    sourceName: 'Independent fixture',
    tolerancesByBody: { earth: { positionToleranceM: 0, velocityToleranceMps: 0 } },
    samples: [{
      bodyId: 'earth',
      jdTdb: dataset.startJdTdb + 0.5,
      positionM: [43_200, 0, 0],
      velocityMps: [1, 0, 0],
    }],
  }, new Date('2025-01-01T00:00:00Z'));
  assert.equal(report.passed, true);
  assert.equal(report.independentValidationPerformed, true);
});

test('structural checks alone never claim an authoritative validation pass', () => {
  const dataset = makeLinearDataset();
  const report = createValidationReport([dataset], null, new Date('2026-08-28T00:00:00Z'));

  assert.equal(report.structuralPassed, true);
  assert.equal(report.independentValidationPerformed, false);
  assert.equal(report.passed, false);
});

function horizonsFixture() {
  return JSON.stringify({
    signature: { source: 'NASA/JPL Horizons API', version: '1.2' },
    result: [
      'Target body name: Earth (399) {source: DE441}',
      'Center body name: Sun (10) {source: DE441}',
      'Center-site name: BODY CENTER',
      'Start time      : A.D. 2000-Jan-01 00:00:00.0000 TDB',
      'Stop  time      : A.D. 2000-Jan-02 00:00:00.0000 TDB',
      'Output units    : KM-S',
      'Output type     : GEOMETRIC cartesian states',
      'Output format   : 2 (position and velocity)',
      'Reference frame : Ecliptic of J2000.0',
      'JDTDB, Calendar Date (TDB), X, Y, Z, VX, VY, VZ,',
      '$$SOE',
      '2451544.000000000, A.D. 2000-Jan-01 12:00:00.0000, 1,2,3,4,5,6,',
      '2451545.000000000, A.D. 2000-Jan-02 12:00:00.0000, 7,8,9,10,11,12,',
      '$$EOE',
    ].join('\n'),
  });
}

function makeDataset(bodyId, startJdTdb, xValues, stepSeconds = 86_400) {
  const valuesSi = new Float64Array(xValues.length * 6);
  xValues.forEach((x, index) => {
    valuesSi[index * 6] = x;
  });
  return {
    bodyId,
    targetId: bodyId === 'moon' ? '301' : '399',
    centerId: '10',
    targetSource: 'DE441',
    startJdTdb,
    endJdTdb: startJdTdb + (xValues.length - 1) * stepSeconds / 86_400,
    stepSeconds,
    sampleCount: xValues.length,
    sampleJdTdb: Float64Array.from(
      xValues.map((_, index) => startJdTdb + index * stepSeconds / 86_400),
    ),
    valuesSi,
  };
}

function makeLinearDataset() {
  const dataset = makeDataset('earth', 2_451_544, [0, 86_400]);
  dataset.valuesSi[3] = 1;
  dataset.valuesSi[9] = 1;
  return dataset;
}
