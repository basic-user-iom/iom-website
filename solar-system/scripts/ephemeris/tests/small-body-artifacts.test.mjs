import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { sha256Hex } from '../binary-format.mjs';
import { loadBodyCatalog } from '../catalog.mjs';
import { buildHorizonsTlistRequestUrl } from '../horizons-request.mjs';
import {
  DEFAULT_SMALL_BODY_END_DATE,
  DEFAULT_SMALL_BODY_START_DATE,
  parseSmallBodyArtifactCli,
  parseSmallBodyVerifyCli,
} from '../small-body-artifact-cli.mjs';
import {
  SMALL_BODY_BINARY_FILE,
  SMALL_BODY_MANIFEST_FILE,
  SMALL_BODY_ROUTING_FILE,
  SMALL_BODY_VALIDATION_FILE,
  createSmallBodyArtifactPackage,
  createSmallBodySeriesId,
  createSmallBodyValidationArtifact,
  writeSmallBodyArtifacts,
} from '../small-body-artifacts.mjs';
import { loadCometCatalog } from '../small-body-catalog.mjs';
import {
  createHorizonsCometBody,
  planCometSamplingSegments,
} from '../small-body-horizons.mjs';
import {
  SMALL_BODY_MAX_TLIST_EPOCHS_PER_REQUEST,
  SMALL_BODY_REFERENCE_FRACTIONS,
  SMALL_BODY_REFERENCE_SOURCE_METHOD,
  SMALL_BODY_REFERENCE_SOURCE_NAME,
  SMALL_BODY_VALIDATION_TOLERANCES,
  selectSmallBodyWithheldEpochs,
} from '../small-body-validation-references.mjs';
import { interpolateHermite } from '../validation.mjs';
import { verifySmallBodyReleaseArtifacts } from '../verify-small-body-release.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const APP_DIRECTORY = join(SCRIPT_DIRECTORY, '..', '..', '..');
const CATALOG_PATH = join(APP_DIRECTORY, 'src', 'data', 'catalogs', 'comets.json');
const RESOLUTIONS_PATH = join(APP_DIRECTORY, 'src', 'data', 'generated', 'comets.sbdb.json');
const HORIZONS_CATALOG_PATH = join(
  APP_DIRECTORY,
  'src',
  'data',
  'catalogs',
  'horizons-bodies.json',
);
const FIXED_ISO = '2026-08-29T12:00:00.000Z';
const START_DATE = '2019-01-01';
const END_DATE = '2021-01-01';

test('small-body artifact CLIs default to the century release and reject mixed cache modes', () => {
  const generate = parseSmallBodyArtifactCli([], 'C:/fixture/solar-system');
  assert.equal(generate.startDate, DEFAULT_SMALL_BODY_START_DATE);
  assert.equal(generate.endDate, DEFAULT_SMALL_BODY_END_DATE);
  assert.match(generate.outputDir.replaceAll('\\', '/'), /solar-system\/src\/data\/generated$/);
  assert.equal(generate.validationIntervals, 1);
  const verify = parseSmallBodyVerifyCli([], 'C:/fixture/solar-system');
  assert.match(verify.directory.replaceAll('\\', '/'), /solar-system\/src\/data\/generated$/);
  assert.throws(
    () => parseSmallBodyArtifactCli(['--offline', '--refresh-cache']),
    /cannot be used together/,
  );
});

test('TLIST validation uses the pinned small-body Horizons command', () => {
  const body = {
    id: '1p-halley',
    targetId: '1000036',
    horizonsCommand: '90000030;',
  };
  const catalog = {
    centerCommand: '500@10',
    timeScale: 'TDB',
    sourceUnits: 'KM-S',
    referencePlane: 'ECLIPTIC',
    referenceFrame: 'ICRF',
  };
  const url = buildHorizonsTlistRequestUrl({ body, catalog, jdTdb: [2_451_544.75] });
  assert.equal(url.searchParams.get('COMMAND'), "'90000030;'");
});

test('segmented package writes four artifacts and passes the offline release verifier', async () => {
  const fixture = await createArtifactFixture();
  const directory = await mkdtemp(join(tmpdir(), 'iom-small-body-artifacts-'));
  try {
    const paths = await writeSmallBodyArtifacts({
      outputDir: directory,
      artifactPackage: fixture.artifactPackage,
      validationReport: fixture.validationReport,
    });
    assert.deepEqual(
      Object.values(paths).map((path) => path.slice(directory.length + 1)),
      [
        SMALL_BODY_BINARY_FILE,
        SMALL_BODY_MANIFEST_FILE,
        SMALL_BODY_ROUTING_FILE,
        SMALL_BODY_VALIDATION_FILE,
      ],
    );
    const result = await verifySmallBodyReleaseArtifacts(verifyOptions(directory));
    assert.equal(result.logicalBodyCount, 5);
    assert.equal(result.physicalSeriesCount, fixture.artifactPackage.datasets.length);
    assert.ok(result.physicalSeriesCount > result.logicalBodyCount);
    assert.equal(result.referenceCheckCount, fixture.referenceSet.samples.length);
    assert.ok(result.boundaryCount > 0);

    const originalValidationText = await readFile(paths.validationPath, 'utf8');
    const validation = JSON.parse(originalValidationText);
    validation.referenceSet.sourceMethod = 'Unpinned validation method';
    await writeFile(paths.validationPath, `${JSON.stringify(validation, null, 2)}\n`, 'utf8');
    await assert.rejects(
      verifySmallBodyReleaseArtifacts(verifyOptions(directory)),
      /independent reference policy/i,
    );

    await writeFile(paths.validationPath, originalValidationText, 'utf8');
    const wrongChunks = JSON.parse(originalValidationText);
    wrongChunks.referenceSet.requests[0].chunkCount += 1;
    await writeFile(paths.validationPath, `${JSON.stringify(wrongChunks, null, 2)}\n`, 'utf8');
    await assert.rejects(
      verifySmallBodyReleaseArtifacts(verifyOptions(directory)),
      /chunkCount/i,
    );

    await writeFile(paths.validationPath, originalValidationText, 'utf8');
    const wrongSource = JSON.parse(originalValidationText);
    wrongSource.independentSource = 'Unrelated validation source';
    await writeFile(paths.validationPath, `${JSON.stringify(wrongSource, null, 2)}\n`, 'utf8');
    await assert.rejects(
      verifySmallBodyReleaseArtifacts(verifyOptions(directory)),
      /stale or inconsistent/i,
    );

    await writeFile(paths.validationPath, originalValidationText, 'utf8');
    const storedChunks = JSON.parse(originalValidationText);
    const firstRequest = storedChunks.referenceSet.requests[0];
    const firstEpochs = storedChunks.referenceSet.samples
      .filter((sample) => sample.logicalBodyId === firstRequest.bodyId)
      .map((sample) => sample.jdTdb);
    firstRequest.epochs = firstEpochs;
    firstRequest.chunks = [[...firstEpochs]];
    await writeFile(paths.validationPath, `${JSON.stringify(storedChunks, null, 2)}\n`, 'utf8');
    await verifySmallBodyReleaseArtifacts(verifyOptions(directory));
    firstRequest.chunks[0][0] += 0.25;
    await writeFile(paths.validationPath, `${JSON.stringify(storedChunks, null, 2)}\n`, 'utf8');
    await assert.rejects(
      verifySmallBodyReleaseArtifacts(verifyOptions(directory)),
      /chunk epochs/i,
    );

    await writeFile(paths.validationPath, originalValidationText, 'utf8');

    const routing = JSON.parse(await readFile(paths.routingPath, 'utf8'));
    routing.bodies[0].segments[0].stepSeconds = 123;
    await writeFile(paths.routingPath, `${JSON.stringify(routing, null, 2)}\n`, 'utf8');
    await assert.rejects(
      verifySmallBodyReleaseArtifacts(verifyOptions(directory)),
      /validation header|routing/i,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('physical series IDs and withheld epochs are deterministic and segment-routed', async () => {
  assert.equal(
    createSmallBodySeriesId('67p-churyumov-gerasimenko', 12, 'perihelion'),
    '67p-churyumov-gerasimenko--perihelion-0012',
  );
  assert.throws(
    () => createSmallBodySeriesId('67p', -1, 'baseline'),
    /segmentIndex/,
  );
  const fixture = await createArtifactFixture();
  const routeBody = fixture.artifactPackage.routing.bodies.find(
    (body) => body.segments.length > 1,
  );
  assert.ok(routeBody);
  const first = selectSmallBodyWithheldEpochs({
    routeBody,
    intervalsPerSegment: 1,
    seed: 'fixture-seed',
  });
  assert.deepEqual(
    first,
    selectSmallBodyWithheldEpochs({
      routeBody,
      intervalsPerSegment: 1,
      seed: 'fixture-seed',
    }),
  );
  assert.equal(first.length, routeBody.segments.length * 3);
  assert.equal(new Set(first.map((entry) => entry.seriesBodyId)).size, routeBody.segments.length);
});

async function createArtifactFixture() {
  const [cometCatalog, horizonsCatalog, resolutionSet] = await Promise.all([
    loadCometCatalog(),
    loadBodyCatalog(),
    readJson(RESOLUTIONS_PATH),
  ]);
  const resolutionById = new Map(
    resolutionSet.comets.map((resolution) => [resolution.id, resolution]),
  );
  const generatedComets = cometCatalog.comets.map((comet, cometIndex) =>
    createSyntheticGeneratedComet({
      comet,
      cometIndex,
      resolution: resolutionById.get(comet.id),
      horizonsCatalog,
    }));
  const artifactPackage = createSmallBodyArtifactPackage({
    generatedComets,
    cometCatalog,
    horizonsCatalog,
    generatedAtIso: FIXED_ISO,
  });
  const referenceSet = createSyntheticReferenceSet({
    artifactPackage,
    cometCatalog,
    resolutionById,
  });
  const validationReport = createSmallBodyValidationArtifact({
    artifactPackage,
    referenceSet,
    generatedAtIso: FIXED_ISO,
  });
  assert.equal(validationReport.passed, true);
  return { artifactPackage, referenceSet, validationReport };
}

function createSyntheticGeneratedComet({
  comet,
  cometIndex,
  resolution,
  horizonsCatalog,
}) {
  const body = createHorizonsCometBody(comet, resolution);
  const plans = planCometSamplingSegments({
    comet,
    resolution,
    startDate: START_DATE,
    endDate: END_DATE,
  });
  const rangeStartJd = plans[0].startJdTdb;
  const velocity = [11 + cometIndex, -3 - cometIndex * 0.25, 1.5 + cometIndex * 0.1];
  const base = [
    1.2e11 + cometIndex * 1e9,
    -2.4e10 + cometIndex * 2e8,
    3.1e9 - cometIndex * 3e7,
  ];
  const segments = plans.map((plan, segmentIndex) => {
    const sampleJdTdb = new Float64Array(plan.sampleCount);
    const valuesSi = new Float64Array(plan.sampleCount * 6);
    for (let sampleIndex = 0; sampleIndex < plan.sampleCount; sampleIndex += 1) {
      const jdTdb = sampleIndex === plan.sampleCount - 1
        ? plan.endJdTdb
        : plan.startJdTdb +
          (sampleIndex * plan.stepSeconds) / 86_400;
      const elapsedSeconds = (jdTdb - rangeStartJd) * 86_400;
      sampleJdTdb[sampleIndex] = jdTdb;
      for (let axis = 0; axis < 3; axis += 1) {
        valuesSi[sampleIndex * 6 + axis] = base[axis] + velocity[axis] * elapsedSeconds;
        valuesSi[sampleIndex * 6 + axis + 3] = velocity[axis];
      }
    }
    return {
      bodyId: comet.id,
      targetId: comet.jpl.spkId,
      targetName: comet.jpl.expectedFullNames[0],
      targetSource: `JPL#${comet.jpl.orbitId}`,
      centerId: horizonsCatalog.centerId,
      centerName: 'Sun',
      startJdTdb: plan.startJdTdb,
      endJdTdb: plan.endJdTdb,
      stepSeconds: plan.stepSeconds,
      sampleCount: plan.sampleCount,
      sampleJdTdb,
      valuesSi,
      sourceSignature: { source: 'NASA/JPL Horizons API', version: '1.2' },
      sourceSolutions: [`JPL#${comet.jpl.orbitId}`],
      kind: plan.kind,
      segmentIndex,
      periheliaJdTdb: [...plan.periheliaJdTdb],
      sourceHash: sha256Hex(`${comet.id}:${segmentIndex}:fixture`),
      retrievedAtIso: FIXED_ISO,
    };
  });
  return {
    schemaVersion: 1,
    generatorVersion: 'fixture',
    bodyId: comet.id,
    targetId: comet.jpl.spkId,
    horizonsCommand: body.horizonsCommand,
    centerId: horizonsCatalog.centerId,
    centerCommand: horizonsCatalog.centerCommand,
    referenceFrame: horizonsCatalog.referenceFrame,
    referencePlane: horizonsCatalog.referencePlane,
    timeScale: horizonsCatalog.timeScale,
    sourceUnits: horizonsCatalog.sourceUnits,
    runtimeUnits: ['m', 'm', 'm', 'm/s', 'm/s', 'm/s'],
    cadence: 'piecewise-uniform-segments',
    segments,
  };
}

function createSyntheticReferenceSet({
  artifactPackage,
  cometCatalog,
  resolutionById,
}) {
  const datasetsById = new Map(
    artifactPackage.decodedDatasets.map((dataset) => [dataset.bodyId, dataset]),
  );
  const samples = [];
  const requests = [];
  const seed = 'iom-small-body-validation-v1';
  for (let index = 0; index < cometCatalog.comets.length; index += 1) {
    const comet = cometCatalog.comets[index];
    const routeBody = artifactPackage.routing.bodies[index];
    const descriptors = selectSmallBodyWithheldEpochs({
      routeBody,
      intervalsPerSegment: 1,
      seed,
    });
    for (const descriptor of descriptors) {
      const state = interpolateHermite(
        datasetsById.get(descriptor.seriesBodyId),
        descriptor.jdTdb,
      );
      const tolerance = SMALL_BODY_VALIDATION_TOLERANCES[descriptor.kind];
      samples.push({
        bodyId: descriptor.seriesBodyId,
        logicalBodyId: comet.id,
        segmentKind: descriptor.kind,
        jdTdb: descriptor.jdTdb,
        positionM: state.positionM,
        velocityMps: state.velocityMps,
        positionToleranceM: tolerance.positionToleranceM,
        velocityToleranceMps: tolerance.velocityToleranceMps,
      });
    }
    const body = createHorizonsCometBody(comet, resolutionById.get(comet.id));
    requests.push({
      bodyId: comet.id,
      targetId: comet.jpl.spkId,
      horizonsCommand: body.horizonsCommand,
      targetSource: `JPL#${comet.jpl.orbitId}`,
      sourceSignature: { source: 'NASA/JPL Horizons API', version: '1.2' },
      sourceHash: sha256Hex(`${comet.id}:reference-fixture`),
      retrievedAtIso: FIXED_ISO,
      chunkCount: Math.ceil(
        descriptors.length / SMALL_BODY_MAX_TLIST_EPOCHS_PER_REQUEST,
      ),
      sampleCount: descriptors.length,
    });
  }
  return {
    schemaVersion: 1,
    independent: true,
    sourceName: SMALL_BODY_REFERENCE_SOURCE_NAME,
    sourceMethod: SMALL_BODY_REFERENCE_SOURCE_METHOD,
    generatedAtIso: FIXED_ISO,
    datasetId: artifactPackage.datasetId,
    seed,
    samplingFractions: SMALL_BODY_REFERENCE_FRACTIONS,
    intervalsPerSegment: 1,
    tolerancesBySegmentKind: SMALL_BODY_VALIDATION_TOLERANCES,
    requests,
    samples,
  };
}

function verifyOptions(directory) {
  return {
    directory,
    catalogPath: CATALOG_PATH,
    resolutionsPath: RESOLUTIONS_PATH,
    horizonsCatalogPath: HORIZONS_CATALOG_PATH,
    startDate: START_DATE,
    endDate: END_DATE,
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
