import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { decodeEphemerisBinary, sha256Hex } from './binary-format.mjs';
import {
  calendarDateToJdTdb,
  formatSmallBodyVerifyHelp,
  parseSmallBodyVerifyCli,
} from './small-body-artifact-cli.mjs';
import {
  SMALL_BODY_BINARY_FILE,
  SMALL_BODY_MANIFEST_FILE,
  SMALL_BODY_ROUTING_FILE,
  SMALL_BODY_VALIDATION_FILE,
  createSmallBodyDatasetId,
  createSmallBodySeriesId,
  hashJson,
} from './small-body-artifacts.mjs';
import {
  assertRequestedRangeIsTrusted,
  loadSmallBodyGenerationInputs,
} from './generate-small-body-artifacts.mjs';
import {
  createHorizonsCometBody,
  planCometSamplingSegments,
} from './small-body-horizons.mjs';
import {
  SMALL_BODY_MAX_TLIST_EPOCHS_PER_REQUEST,
  SMALL_BODY_REFERENCE_FRACTIONS,
  SMALL_BODY_REFERENCE_SOURCE_METHOD,
  SMALL_BODY_REFERENCE_SOURCE_NAME,
  SMALL_BODY_VALIDATION_TOLERANCES,
  selectSmallBodyWithheldEpochs,
} from './small-body-validation-references.mjs';
import { createValidationReport } from './validation.mjs';

const SECONDS_PER_DAY = 86_400;
const TIME_TOLERANCE_SECONDS = 0.011;

/** Offline-only verification of the four committed small-body artifacts. */
export async function verifySmallBodyReleaseArtifacts(options) {
  const { cometCatalog, resolutionSet, horizonsCatalog } =
    await loadSmallBodyGenerationInputs(options);
  assertRequestedRangeIsTrusted(cometCatalog, options.startDate, options.endDate);
  const expectedStartJdTdb = calendarDateToJdTdb(options.startDate, '--start');
  const expectedEndJdTdb = calendarDateToJdTdb(options.endDate, '--end');
  const [manifest, routing, committedReport, binary] = await Promise.all([
    readJson(join(options.directory, SMALL_BODY_MANIFEST_FILE)),
    readJson(join(options.directory, SMALL_BODY_ROUTING_FILE)),
    readJson(join(options.directory, SMALL_BODY_VALIDATION_FILE)),
    readFile(join(options.directory, SMALL_BODY_BINARY_FILE)),
  ]);
  const binarySha256 = sha256Hex(binary);
  validateTopLevelContracts({
    manifest,
    routing,
    committedReport,
    binarySha256,
    cometCatalog,
    horizonsCatalog,
    expectedStartJdTdb,
    expectedEndJdTdb,
  });

  const datasets = decodeEphemerisBinary(binary).bodies;
  const datasetsById = uniqueIndex(datasets, 'bodyId', 'IOMEPH series');
  const manifestById = uniqueIndex(manifest.bodies, 'bodyId', 'manifest series');
  const resolutionById = new Map(
    resolutionSet.comets.map((resolution) => [resolution.id, resolution]),
  );
  const expectedPhysicalIds = [];
  let boundaryCount = 0;

  for (let bodyIndex = 0; bodyIndex < cometCatalog.comets.length; bodyIndex += 1) {
    const comet = cometCatalog.comets[bodyIndex];
    const routeBody = routing.bodies[bodyIndex];
    if (
      routeBody?.bodyId !== comet.id ||
      routeBody.displayName !== comet.displayName ||
      routeBody.targetId !== comet.jpl.spkId ||
      !Array.isArray(routeBody.segments)
    ) {
      throw new Error(`Routing body ${bodyIndex} does not match catalog comet ${comet.id}.`);
    }
    const expectedSegments = planCometSamplingSegments({
      comet,
      resolution: resolutionById.get(comet.id),
      startDate: options.startDate,
      endDate: options.endDate,
    });
    if (routeBody.segments.length !== expectedSegments.length) {
      throw new Error(`${comet.id} routing does not contain its planned segment count.`);
    }
    if (!routeBody.segments.some((segment) => segment.kind === 'baseline')) {
      throw new Error(`${comet.id} routing has no baseline coverage.`);
    }

    for (let segmentIndex = 0; segmentIndex < routeBody.segments.length; segmentIndex += 1) {
      const routeSegment = routeBody.segments[segmentIndex];
      const planned = expectedSegments[segmentIndex];
      const kind = planned.kind === 'coarse' ? 'baseline' : 'perihelion';
      const seriesBodyId = createSmallBodySeriesId(comet.id, segmentIndex, kind);
      expectedPhysicalIds.push(seriesBodyId);
      if (
        routeSegment.seriesBodyId !== seriesBodyId ||
        routeSegment.segmentIndex !== segmentIndex ||
        routeSegment.kind !== kind ||
        routeSegment.stepSeconds !== planned.stepSeconds ||
        !sameEpoch(routeSegment.startJdTdb, planned.startJdTdb) ||
        !sameEpoch(routeSegment.endJdTdb, planned.endJdTdb) ||
        JSON.stringify(routeSegment.periheliaJdTdb) !==
          JSON.stringify([...planned.periheliaJdTdb])
      ) {
        throw new Error(`${comet.id} segment ${segmentIndex} differs from its deterministic plan.`);
      }
      const dataset = datasetsById.get(seriesBodyId);
      const manifestBody = manifestById.get(seriesBodyId);
      validatePhysicalSeries({
        dataset,
        manifestBody,
        routeSegment,
        comet,
        horizonsCatalog,
        expectedSampleCount: planned.sampleCount,
      });
      if (segmentIndex > 0) {
        const previousRoute = routeBody.segments[segmentIndex - 1];
        const previousDataset = datasetsById.get(previousRoute.seriesBodyId);
        if (!sameEpoch(previousRoute.endJdTdb, routeSegment.startJdTdb)) {
          throw new Error(`${comet.id} has a gap or overlap at routing boundary ${segmentIndex}.`);
        }
        assertSharedBoundaryState(previousDataset, dataset, comet.id, segmentIndex);
        boundaryCount += 1;
      }
    }
    if (
      !sameEpoch(routeBody.segments[0].startJdTdb, expectedStartJdTdb) ||
      !sameEpoch(routeBody.segments.at(-1).endJdTdb, expectedEndJdTdb)
    ) {
      throw new Error(`${comet.id} does not cover the requested release interval.`);
    }
  }

  const decodedIds = datasets.map((dataset) => dataset.bodyId);
  const manifestIds = manifest.bodies.map((body) => body.bodyId);
  if (
    JSON.stringify(decodedIds) !== JSON.stringify(expectedPhysicalIds) ||
    JSON.stringify(manifestIds) !== JSON.stringify(expectedPhysicalIds)
  ) {
    throw new Error('Binary, manifest, and routing physical-series order do not match.');
  }
  const expectedDatasetId = createSmallBodyDatasetId({
    catalogVersion: cometCatalog.catalogVersion,
    coverage: { startJdTdb: expectedStartJdTdb, endJdTdb: expectedEndJdTdb },
    routingBodies: routing.bodies,
  });
  if (manifest.datasetId !== expectedDatasetId) {
    throw new Error('Small-body datasetId is stale or inconsistent with routing metadata.');
  }

  const referenceSet = committedReport.referenceSet;
  const referenceCount = validateReferencePolicy({
    referenceSet,
    routing,
    cometCatalog,
    resolutionById,
  });
  const recomputed = createValidationReport(
    datasets,
    referenceSet,
    new Date(committedReport.generatedAtIso),
  );
  if (
    !recomputed.passed ||
    committedReport.passed !== true ||
    committedReport.structuralPassed !== true ||
    committedReport.independentValidationPerformed !== true ||
    committedReport.independentSource !== referenceSet.sourceName ||
    committedReport.independentSource !== recomputed.independentSource ||
    committedReport.datasetId !== manifest.datasetId ||
    committedReport.binarySha256 !== binarySha256 ||
    committedReport.routingSha256 !== hashJson(routing) ||
    JSON.stringify(committedReport.datasetChecks) !== JSON.stringify(recomputed.datasetChecks) ||
    JSON.stringify(committedReport.referenceChecks) !== JSON.stringify(recomputed.referenceChecks) ||
    JSON.stringify(committedReport.warnings) !== JSON.stringify(recomputed.warnings)
  ) {
    throw new Error('Committed small-body validation report is stale or inconsistent.');
  }

  return {
    datasetId: manifest.datasetId,
    binarySha256,
    logicalBodyCount: routing.bodies.length,
    physicalSeriesCount: datasets.length,
    boundaryCount,
    referenceCheckCount: referenceCount,
  };
}

function validateTopLevelContracts({
  manifest,
  routing,
  committedReport,
  binarySha256,
  cometCatalog,
  horizonsCatalog,
  expectedStartJdTdb,
  expectedEndJdTdb,
}) {
  if (
    manifest?.schemaVersion !== 1 ||
    manifest.binaryFile !== SMALL_BODY_BINARY_FILE ||
    manifest.binarySha256 !== binarySha256 ||
    !Array.isArray(manifest.bodies) ||
    !Number.isFinite(Date.parse(manifest.generatedAtIso))
  ) {
    throw new Error('Small-body manifest header or binary SHA-256 is invalid.');
  }
  const format = manifest.format;
  if (
    format?.id !== 'IOMEPH' ||
    format.versionMajor !== 1 ||
    format.versionMinor !== 0 ||
    format.byteOrder !== 'little-endian' ||
    format.scalarType !== 'float64' ||
    JSON.stringify(format.componentOrder) !== JSON.stringify(['px', 'py', 'pz', 'vx', 'vy', 'vz']) ||
    JSON.stringify(format.units) !== JSON.stringify(['m', 'm', 'm', 'm/s', 'm/s', 'm/s'])
  ) {
    throw new Error('Small-body manifest does not declare the IOMEPH v1 SI contract.');
  }
  if (
    routing?.schemaVersion !== 1 ||
    routing.datasetId !== manifest.datasetId ||
    routing.catalogVersion !== cometCatalog.catalogVersion ||
    routing.binaryFile !== SMALL_BODY_BINARY_FILE ||
    routing.binarySha256 !== binarySha256 ||
    routing.coverage?.timeScale !== horizonsCatalog.timeScale ||
    !sameEpoch(routing.coverage?.startJdTdb, expectedStartJdTdb) ||
    !sameEpoch(routing.coverage?.endJdTdb, expectedEndJdTdb) ||
    routing.samplingStrategy?.type !== 'piecewise-uniform-segments' ||
    !Array.isArray(routing.bodies) ||
    routing.bodies.length !== cometCatalog.comets.length
  ) {
    throw new Error('Small-body routing header does not match the release contract.');
  }
  if (
    committedReport?.schemaVersion !== 1 ||
    committedReport.datasetId !== manifest.datasetId ||
    committedReport.binarySha256 !== binarySha256 ||
    committedReport.routingSha256 !== hashJson(routing)
  ) {
    throw new Error('Small-body validation header does not match the release artifacts.');
  }
}

function validatePhysicalSeries({
  dataset,
  manifestBody,
  routeSegment,
  comet,
  horizonsCatalog,
  expectedSampleCount,
}) {
  const calculatedEnd = dataset === undefined
    ? Number.NaN
    : dataset.startJdTdb +
      ((dataset.sampleCount - 1) * dataset.stepSeconds) / SECONDS_PER_DAY;
  if (
    dataset === undefined ||
    dataset.startJdTdb !== routeSegment.startJdTdb ||
    dataset.stepSeconds !== routeSegment.stepSeconds ||
    dataset.sampleCount !== expectedSampleCount ||
    !sameEpoch(calculatedEnd, routeSegment.endJdTdb)
  ) {
    throw new Error(`IOMEPH series ${routeSegment.seriesBodyId} does not match routing metadata.`);
  }
  const provenance = manifestBody?.provenance;
  if (
    manifestBody?.bodyId !== routeSegment.seriesBodyId ||
    !manifestBody.displayName?.startsWith(comet.displayName) ||
    provenance?.provider !== 'JPL_HORIZONS' ||
    provenance.sourceName !== 'NASA/JPL Horizons vector ephemeris' ||
    provenance.targetId !== comet.jpl.spkId ||
    provenance.centerId !== horizonsCatalog.centerId ||
    provenance.referenceFrame !== horizonsCatalog.referenceFrame ||
    provenance.referencePlane !== horizonsCatalog.referencePlane ||
    provenance.timeScale !== 'TDB' ||
    provenance.units !== 'm and m/s' ||
    provenance.startJd !== routeSegment.startJdTdb ||
    !sameEpoch(provenance.endJd, routeSegment.endJdTdb) ||
    provenance.sampleStepSeconds !== routeSegment.stepSeconds ||
    !Number.isFinite(Date.parse(provenance.retrievedAtIso)) ||
    typeof provenance.generatorVersion !== 'string' ||
    !provenance.generatorVersion.includes('iom-small-body-ephemeris-generator/') ||
    !provenance.generatorVersion.includes('iom-small-body-artifact-packager/') ||
    !/^[a-f\d]{64}$/.test(provenance.sourceHash ?? '') ||
    !provenance.notes?.some((note) => note.includes(horizonsCatalog.centerCommand)) ||
    !provenance.notes?.some((note) => note.includes(comet.id))
  ) {
    throw new Error(`Manifest provenance for ${routeSegment.seriesBodyId} is incomplete or stale.`);
  }
}

function validateReferencePolicy({
  referenceSet,
  routing,
  cometCatalog,
  resolutionById,
}) {
  if (
    referenceSet?.schemaVersion !== 1 ||
    referenceSet.independent !== true ||
    referenceSet.datasetId !== routing.datasetId ||
    referenceSet.sourceName !== SMALL_BODY_REFERENCE_SOURCE_NAME ||
    referenceSet.sourceMethod !== SMALL_BODY_REFERENCE_SOURCE_METHOD ||
    !Number.isFinite(Date.parse(referenceSet.generatedAtIso)) ||
    typeof referenceSet.seed !== 'string' ||
    referenceSet.seed.length === 0 ||
    !Number.isInteger(referenceSet.intervalsPerSegment) ||
    referenceSet.intervalsPerSegment <= 0 ||
    JSON.stringify(referenceSet.samplingFractions) !==
      JSON.stringify(SMALL_BODY_REFERENCE_FRACTIONS) ||
    JSON.stringify(referenceSet.tolerancesBySegmentKind) !==
      JSON.stringify(SMALL_BODY_VALIDATION_TOLERANCES) ||
    !Array.isArray(referenceSet.requests) ||
    !Array.isArray(referenceSet.samples)
  ) {
    throw new Error('Small-body independent reference policy is invalid.');
  }
  const expectedDescriptors = [];
  for (let index = 0; index < cometCatalog.comets.length; index += 1) {
    const comet = cometCatalog.comets[index];
    const routeBody = routing.bodies[index];
    const descriptors = selectSmallBodyWithheldEpochs({
      routeBody,
      intervalsPerSegment: referenceSet.intervalsPerSegment,
      seed: referenceSet.seed,
    });
    expectedDescriptors.push(...descriptors);
    const request = referenceSet.requests[index];
    const body = createHorizonsCometBody(comet, resolutionById.get(comet.id));
    if (
      request?.bodyId !== comet.id ||
      request.targetId !== comet.jpl.spkId ||
      request.horizonsCommand !== body.horizonsCommand ||
      request.targetSource !== `JPL#${comet.jpl.orbitId}` ||
      request.sourceSignature?.source !== 'NASA/JPL Horizons API' ||
      !['1.2', '1.3'].includes(request.sourceSignature?.version) ||
      !/^[a-f\d]{64}$/.test(request.sourceHash ?? '') ||
      !Number.isFinite(Date.parse(request.retrievedAtIso)) ||
      request.sampleCount !== descriptors.length
    ) {
      throw new Error(`${comet.id} withheld TLIST request provenance is invalid.`);
    }
    validateReferenceRequestChunking(request, descriptors, comet.id);
  }
  if (
    referenceSet.requests.length !== cometCatalog.comets.length ||
    referenceSet.samples.length !== expectedDescriptors.length
  ) {
    throw new Error('Small-body reference set does not contain the deterministic check count.');
  }
  for (let index = 0; index < expectedDescriptors.length; index += 1) {
    const expected = expectedDescriptors[index];
    const actual = referenceSet.samples[index];
    const tolerance = SMALL_BODY_VALIDATION_TOLERANCES[expected.kind];
    if (
      actual?.bodyId !== expected.seriesBodyId ||
      actual.logicalBodyId !== expected.bodyId ||
      actual.segmentKind !== expected.kind ||
      !sameEpoch(actual.jdTdb, expected.jdTdb) ||
      actual.positionToleranceM !== tolerance.positionToleranceM ||
      actual.velocityToleranceMps !== tolerance.velocityToleranceMps
    ) {
      throw new Error(`Small-body reference sample ${index} violates the routing policy.`);
    }
  }
  return expectedDescriptors.length;
}

function validateReferenceRequestChunking(request, descriptors, cometId) {
  const expectedEpochs = descriptors.map((descriptor) => descriptor.jdTdb);
  const expectedChunkCount = Math.ceil(
    expectedEpochs.length / SMALL_BODY_MAX_TLIST_EPOCHS_PER_REQUEST,
  );
  if (
    !Number.isInteger(request.chunkCount) ||
    request.chunkCount !== expectedChunkCount
  ) {
    throw new Error(
      `${cometId} withheld TLIST chunkCount does not match its deterministic epochs.`,
    );
  }

  if (request.epochs !== undefined) {
    assertReferenceEpochs(request.epochs, expectedEpochs, `${cometId} request epochs`);
  }
  if (request.chunks !== undefined) {
    if (
      !Array.isArray(request.chunks) ||
      request.chunks.length !== request.chunkCount
    ) {
      throw new Error(`${cometId} withheld TLIST chunks do not match chunkCount.`);
    }
    const flattenedEpochs = [];
    for (let index = 0; index < request.chunks.length; index += 1) {
      const chunk = request.chunks[index];
      const epochs = Array.isArray(chunk) ? chunk : chunk?.epochs;
      if (
        !Array.isArray(epochs) ||
        epochs.length === 0 ||
        epochs.length > SMALL_BODY_MAX_TLIST_EPOCHS_PER_REQUEST ||
        (chunk?.sampleCount !== undefined && chunk.sampleCount !== epochs.length)
      ) {
        throw new Error(`${cometId} withheld TLIST chunk ${index} is invalid.`);
      }
      flattenedEpochs.push(...epochs);
    }
    assertReferenceEpochs(
      flattenedEpochs,
      expectedEpochs,
      `${cometId} chunk epochs`,
    );
  }
}

function assertReferenceEpochs(actual, expected, label) {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    throw new Error(`${label} do not match the deterministic reference epochs.`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (!sameEpoch(actual[index], expected[index])) {
      throw new Error(`${label} differ at index ${index}.`);
    }
  }
}

function assertSharedBoundaryState(previous, current, bodyId, segmentIndex) {
  if (previous === undefined || current === undefined) {
    throw new Error(`${bodyId} boundary ${segmentIndex} references a missing series.`);
  }
  const previousOffset = (previous.sampleCount - 1) * 6;
  for (let component = 0; component < 6; component += 1) {
    const left = previous.valuesSi[previousOffset + component];
    const right = current.valuesSi[component];
    const tolerance = Math.max(1e-6, Math.abs(left) * 1e-13);
    if (Math.abs(left - right) > tolerance) {
      throw new Error(`${bodyId} boundary ${segmentIndex} state component ${component} differs.`);
    }
  }
}

function uniqueIndex(values, key, label) {
  if (!Array.isArray(values)) throw new Error(`${label} collection is missing.`);
  const result = new Map();
  for (const value of values) {
    const id = value?.[key];
    if (typeof id !== 'string' || result.has(id)) {
      throw new Error(`${label} contains an invalid or duplicate identifier.`);
    }
    result.set(id, value);
  }
  return result;
}

function sameEpoch(left, right) {
  return Number.isFinite(left) &&
    Number.isFinite(right) &&
    Math.abs(left - right) * SECONDS_PER_DAY <= TIME_TOLERANCE_SECONDS;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  const options = parseSmallBodyVerifyCli(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${formatSmallBodyVerifyHelp()}\n`);
    return;
  }
  const result = await verifySmallBodyReleaseArtifacts(options);
  process.stdout.write(
    `Verified ${result.logicalBodyCount} logical comets, ` +
      `${result.physicalSeriesCount} physical series, ${result.boundaryCount} shared boundaries, ` +
      `and ${result.referenceCheckCount} independent checks for ${result.datasetId}.\n`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
