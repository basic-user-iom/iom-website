import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import {
  decodeEphemerisBinary,
  encodeEphemerisBinary,
  sha256Hex,
} from './binary-format.mjs';
import {
  SMALL_BODY_EPHEMERIS_GENERATOR_VERSION,
  assertSegmentBoundaryContinuity,
} from './small-body-ephemeris-generator.mjs';
import { validateCometCatalog } from './small-body-catalog.mjs';
import { createValidationReport } from './validation.mjs';

const SECONDS_PER_DAY = 86_400;
const COVERAGE_TOLERANCE_SECONDS = 0.011;

export const SMALL_BODY_BINARY_FILE = 'small-body-ephemeris.v1.bin';
export const SMALL_BODY_MANIFEST_FILE = 'small-body-ephemeris.manifest.json';
export const SMALL_BODY_ROUTING_FILE = 'small-body-segments.json';
export const SMALL_BODY_VALIDATION_FILE = 'small-body-ephemeris.validation.json';
export const SMALL_BODY_ARTIFACT_GENERATOR_VERSION =
  'iom-small-body-artifact-packager/1.0.0';

const IOMEPH_FORMAT = Object.freeze({
  id: 'IOMEPH',
  versionMajor: 1,
  versionMinor: 0,
  byteOrder: 'little-endian',
  scalarType: 'float64',
  componentOrder: Object.freeze(['px', 'py', 'pz', 'vx', 'vy', 'vz']),
  units: Object.freeze(['m', 'm', 'm', 'm/s', 'm/s', 'm/s']),
});

/**
 * Converts logical, piecewise comet results into one physical IOMEPH v1
 * series per cadence segment. The routing sidecar joins those series back to
 * the five logical comet IDs at runtime.
 */
export function createSmallBodyArtifactPackage({
  generatedComets,
  cometCatalog,
  horizonsCatalog,
  generatedAtIso = new Date().toISOString(),
}) {
  validateCometCatalog(cometCatalog);
  validateHorizonsCatalog(horizonsCatalog);
  requireIsoDate(generatedAtIso, 'artifact generatedAtIso');
  const generatedById = indexGeneratedComets(generatedComets, cometCatalog);
  const datasets = [];
  const manifestBodies = [];
  const routingBodies = [];
  const physicalSeriesIds = new Set();

  for (const comet of cometCatalog.comets) {
    const generated = generatedById.get(comet.id);
    validateGeneratedComet(generated, comet, horizonsCatalog);
    assertSegmentBoundaryContinuity(generated.segments);
    const routeSegments = [];

    for (let index = 0; index < generated.segments.length; index += 1) {
      const segment = generated.segments[index];
      if (segment.segmentIndex !== index) {
        throw new Error(`${comet.id} segment ${index} has a non-canonical segmentIndex.`);
      }
      const kind = toRuntimeSegmentKind(segment.kind);
      const expectedStep = kind === 'baseline'
        ? comet.sampling.coarseStepSeconds
        : comet.sampling.denseStepSeconds;
      if (segment.stepSeconds !== expectedStep) {
        throw new Error(`${comet.id} segment ${index} does not use its catalog ${kind} cadence.`);
      }
      const seriesBodyId = createSmallBodySeriesId(comet.id, index, kind);
      if (physicalSeriesIds.has(seriesBodyId)) {
        throw new Error(`Duplicate physical small-body series id: ${seriesBodyId}`);
      }
      physicalSeriesIds.add(seriesBodyId);
      const normalized = normalizeSegmentDataset(segment, seriesBodyId, comet.id);
      datasets.push(normalized);
      routeSegments.push({
        seriesBodyId,
        startJdTdb: normalized.startJdTdb,
        endJdTdb: normalized.endJdTdb,
        stepSeconds: normalized.stepSeconds,
        kind,
        segmentIndex: index,
        periheliaJdTdb: [...(segment.periheliaJdTdb ?? [])],
      });
      manifestBodies.push(createManifestBody({
        comet,
        generated,
        segment,
        dataset: normalized,
        kind,
        horizonsCatalog,
      }));
    }

    assertRouteContinuity(comet.id, routeSegments);
    routingBodies.push({
      bodyId: comet.id,
      displayName: comet.displayName,
      targetId: comet.jpl.spkId,
      segments: routeSegments,
    });
  }

  const coverage = commonLogicalCoverage(routingBodies);
  const datasetId = createSmallBodyDatasetId({
    catalogVersion: cometCatalog.catalogVersion,
    coverage,
    routingBodies,
  });
  const binary = encodeEphemerisBinary(datasets);
  const binarySha256 = sha256Hex(binary);
  const manifest = {
    schemaVersion: 1,
    datasetId,
    binaryFile: SMALL_BODY_BINARY_FILE,
    binarySha256,
    format: IOMEPH_FORMAT,
    generatedAtIso,
    bodies: manifestBodies,
  };
  const routing = {
    schemaVersion: 1,
    datasetId,
    catalogVersion: cometCatalog.catalogVersion,
    binaryFile: SMALL_BODY_BINARY_FILE,
    binarySha256,
    generatedAtIso,
    coverage: {
      ...coverage,
      timeScale: horizonsCatalog.timeScale,
    },
    samplingStrategy: {
      type: 'piecewise-uniform-segments',
      boundaryPolicy: 'adjacent segments share one exact state sample',
      selectionPolicy: 'finest cadence wins at a shared boundary',
      physicalSeriesIdPolicy: '<logical-body-id>--<kind>-<zero-padded-segment-index>',
    },
    bodies: routingBodies,
  };
  const routingSha256 = hashJson(routing);
  const decoded = decodeEphemerisBinary(binary);
  assertRoundTripMatches(datasets, decoded.bodies);

  return {
    datasetId,
    datasets,
    binary,
    binarySha256,
    manifest,
    routing,
    routingSha256,
    decodedDatasets: decoded.bodies,
  };
}

export function createSmallBodyValidationArtifact({
  artifactPackage,
  referenceSet,
  generatedAtIso = new Date().toISOString(),
}) {
  if (referenceSet?.datasetId !== artifactPackage.datasetId) {
    throw new Error('Small-body reference set datasetId does not match the artifact package.');
  }
  if (referenceSet.independent !== true) {
    throw new Error('Small-body validation references must be explicitly independent.');
  }
  const report = createValidationReport(
    artifactPackage.decodedDatasets,
    referenceSet,
    new Date(generatedAtIso),
  );
  return {
    ...report,
    datasetId: artifactPackage.datasetId,
    binarySha256: artifactPackage.binarySha256,
    routingSha256: artifactPackage.routingSha256,
    referenceSet,
  };
}

export async function writeSmallBodyArtifacts({
  outputDir,
  artifactPackage,
  validationReport,
}) {
  if (validationReport?.datasetId !== artifactPackage.datasetId) {
    throw new Error('Small-body validation report does not belong to the artifact package.');
  }
  await mkdir(outputDir, { recursive: true });
  const paths = {
    binaryPath: join(outputDir, SMALL_BODY_BINARY_FILE),
    manifestPath: join(outputDir, SMALL_BODY_MANIFEST_FILE),
    routingPath: join(outputDir, SMALL_BODY_ROUTING_FILE),
    validationPath: join(outputDir, SMALL_BODY_VALIDATION_FILE),
  };
  await atomicWrite(paths.binaryPath, artifactPackage.binary);
  await atomicWrite(paths.manifestPath, jsonFile(artifactPackage.manifest));
  await atomicWrite(paths.routingPath, jsonFile(artifactPackage.routing));
  await atomicWrite(paths.validationPath, jsonFile(validationReport));
  return paths;
}

export function createSmallBodySeriesId(bodyId, segmentIndex, kind) {
  if (typeof bodyId !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(bodyId)) {
    throw new Error(`Invalid logical small-body id: ${String(bodyId)}`);
  }
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex > 9_999) {
    throw new Error('Small-body segmentIndex must be an integer from 0 through 9999.');
  }
  if (kind !== 'baseline' && kind !== 'perihelion') {
    throw new Error(`Invalid small-body segment kind: ${String(kind)}`);
  }
  return `${bodyId}--${kind}-${String(segmentIndex).padStart(4, '0')}`;
}

export function hashJson(value) {
  return sha256Hex(JSON.stringify(value));
}

export function createSmallBodyDatasetId({ catalogVersion, coverage, routingBodies }) {
  const identity = {
    catalogVersion,
    startJdTdb: coverage.startJdTdb,
    endJdTdb: coverage.endJdTdb,
    bodies: routingBodies.map((body) => ({
      bodyId: body.bodyId,
      targetId: body.targetId,
      segments: body.segments.map((segment) => ({
        seriesBodyId: segment.seriesBodyId,
        startJdTdb: segment.startJdTdb,
        endJdTdb: segment.endJdTdb,
        stepSeconds: segment.stepSeconds,
        kind: segment.kind,
      })),
    })),
  };
  return `jpl-horizons-small-bodies-${hashJson(identity).slice(0, 16)}`;
}

function createManifestBody({
  comet,
  generated,
  segment,
  dataset,
  kind,
  horizonsCatalog,
}) {
  const sourceSolutions = Array.isArray(segment.sourceSolutions)
    ? segment.sourceSolutions.join(', ')
    : 'not declared';
  const signature = segment.sourceSignature;
  return {
    bodyId: dataset.bodyId,
    displayName: `${comet.displayName} (${kind} segment ${segment.segmentIndex + 1})`,
    provenance: {
      provider: 'JPL_HORIZONS',
      sourceName: 'NASA/JPL Horizons vector ephemeris',
      targetId: comet.jpl.spkId,
      centerId: horizonsCatalog.centerId,
      referenceFrame: horizonsCatalog.referenceFrame,
      referencePlane: horizonsCatalog.referencePlane,
      timeScale: horizonsCatalog.timeScale,
      units: 'm and m/s',
      startJd: dataset.startJdTdb,
      endJd: dataset.endJdTdb,
      sampleStepSeconds: dataset.stepSeconds,
      retrievedAtIso: segment.retrievedAtIso,
      generatorVersion: `${SMALL_BODY_EPHEMERIS_GENERATOR_VERSION}; ${SMALL_BODY_ARTIFACT_GENERATOR_VERSION}`,
      sourceHash: segment.sourceHash,
      notes: [
        `Logical comet id ${comet.id}; physical series ${dataset.bodyId}.`,
        `Horizons command ${generated.horizonsCommand}; catalog SPK id ${comet.jpl.spkId}.`,
        `Piecewise cadence ${kind}; runtime routing is stored in ${SMALL_BODY_ROUTING_FILE}.`,
        `Source response units ${horizonsCatalog.sourceUnits}; converted to SI exactly once during parsing.`,
        `Geometric states relative to Horizons center ${horizonsCatalog.centerCommand}; no aberration correction.`,
        `Horizons response signature ${String(signature?.source)} ${String(signature?.version)}.`,
        `Horizons source solution(s): ${sourceSolutions}.`,
      ],
    },
  };
}

function normalizeSegmentDataset(segment, seriesBodyId, logicalBodyId) {
  if (!Number.isFinite(segment.startJdTdb)) {
    throw new Error(`${logicalBodyId} segment start JD is not finite.`);
  }
  if (!Number.isInteger(segment.sampleCount) || segment.sampleCount < 2) {
    throw new Error(`${logicalBodyId} segment must contain at least two samples.`);
  }
  if (!Number.isInteger(segment.stepSeconds) || segment.stepSeconds <= 0) {
    throw new Error(`${logicalBodyId} segment cadence is invalid.`);
  }
  if (!(segment.sampleJdTdb instanceof Float64Array) ||
      segment.sampleJdTdb.length !== segment.sampleCount) {
    throw new Error(`${logicalBodyId} segment sample epochs are incomplete.`);
  }
  if (!(segment.valuesSi instanceof Float64Array) ||
      segment.valuesSi.length !== segment.sampleCount * 6) {
    throw new Error(`${logicalBodyId} segment state vectors are incomplete.`);
  }
  const calculatedEndJdTdb = segment.startJdTdb +
    ((segment.sampleCount - 1) * segment.stepSeconds) / SECONDS_PER_DAY;
  assertSameEpoch(
    segment.sampleJdTdb[0],
    segment.startJdTdb,
    `${logicalBodyId} segment first sample`,
  );
  assertSameEpoch(
    segment.sampleJdTdb[segment.sampleCount - 1],
    calculatedEndJdTdb,
    `${logicalBodyId} segment last sample`,
  );
  if (segment.endJdTdb !== undefined) {
    assertSameEpoch(
      segment.endJdTdb,
      calculatedEndJdTdb,
      `${logicalBodyId} segment declared end`,
    );
  }
  for (let index = 1; index < segment.sampleCount; index += 1) {
    const deltaSeconds =
      (segment.sampleJdTdb[index] - segment.sampleJdTdb[index - 1]) * SECONDS_PER_DAY;
    if (Math.abs(deltaSeconds - segment.stepSeconds) > COVERAGE_TOLERANCE_SECONDS) {
      throw new Error(`${logicalBodyId} segment sample ${index} is off its uniform cadence.`);
    }
  }
  return {
    bodyId: seriesBodyId,
    startJdTdb: segment.startJdTdb,
    endJdTdb: calculatedEndJdTdb,
    stepSeconds: segment.stepSeconds,
    sampleCount: segment.sampleCount,
    valuesSi: segment.valuesSi,
  };
}

function validateGeneratedComet(generated, comet, horizonsCatalog) {
  if (generated === undefined || generated.bodyId !== comet.id) {
    throw new Error(`Generated ephemeris is missing logical comet ${comet.id}.`);
  }
  const expected = {
    targetId: comet.jpl.spkId,
    centerId: horizonsCatalog.centerId,
    centerCommand: horizonsCatalog.centerCommand,
    referenceFrame: horizonsCatalog.referenceFrame,
    referencePlane: horizonsCatalog.referencePlane,
    timeScale: horizonsCatalog.timeScale,
    sourceUnits: horizonsCatalog.sourceUnits,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (generated[key] !== value) {
      throw new Error(`${comet.id} generated ${key} does not match the catalog contract.`);
    }
  }
  if (!Array.isArray(generated.segments) || generated.segments.length === 0) {
    throw new Error(`${comet.id} generated ephemeris has no segments.`);
  }
  for (const segment of generated.segments) {
    if (
      segment.bodyId !== comet.id ||
      segment.targetId !== comet.jpl.spkId ||
      segment.centerId !== horizonsCatalog.centerId ||
      segment.targetSource !== `JPL#${comet.jpl.orbitId}`
    ) {
      throw new Error(`${comet.id} segment identity/provenance does not match its pinned JPL solution.`);
    }
    if (!/^[a-f\d]{64}$/.test(segment.sourceHash ?? '')) {
      throw new Error(`${comet.id} segment sourceHash is missing or invalid.`);
    }
    requireIsoDate(segment.retrievedAtIso, `${comet.id} segment retrieval time`);
    if (
      segment.sourceSignature?.source !== 'NASA/JPL Horizons API' ||
      !['1.2', '1.3'].includes(segment.sourceSignature?.version)
    ) {
      throw new Error(`${comet.id} segment has an unsupported Horizons signature.`);
    }
  }
}

function indexGeneratedComets(generatedComets, cometCatalog) {
  if (!Array.isArray(generatedComets) || generatedComets.length !== cometCatalog.comets.length) {
    throw new Error('Small-body artifact packaging requires all five generated comets.');
  }
  const byId = new Map();
  for (const generated of generatedComets) {
    if (byId.has(generated?.bodyId)) {
      throw new Error(`Duplicate generated logical comet: ${String(generated?.bodyId)}`);
    }
    byId.set(generated?.bodyId, generated);
  }
  for (const comet of cometCatalog.comets) {
    if (!byId.has(comet.id)) throw new Error(`Generated ephemeris is missing ${comet.id}.`);
  }
  return byId;
}

function validateHorizonsCatalog(catalog) {
  for (const key of [
    'centerId',
    'centerCommand',
    'referenceFrame',
    'referencePlane',
    'timeScale',
    'sourceUnits',
  ]) {
    if (typeof catalog?.[key] !== 'string' || catalog[key].trim() === '') {
      throw new Error(`Horizons catalog is missing ${key}.`);
    }
  }
  if (catalog.timeScale !== 'TDB') {
    throw new Error('Small-body ephemeris artifacts require the TDB time scale.');
  }
}

function toRuntimeSegmentKind(kind) {
  if (kind === 'coarse') return 'baseline';
  if (kind === 'perihelion-dense') return 'perihelion';
  throw new Error(`Unsupported generated comet segment kind: ${String(kind)}`);
}

function commonLogicalCoverage(routingBodies) {
  const first = routingBodies[0];
  if (first === undefined) throw new Error('Small-body routing requires at least one body.');
  const startJdTdb = first.segments[0].startJdTdb;
  const endJdTdb = first.segments.at(-1).endJdTdb;
  for (const body of routingBodies) {
    assertSameEpoch(body.segments[0].startJdTdb, startJdTdb, `${body.bodyId} coverage start`);
    assertSameEpoch(body.segments.at(-1).endJdTdb, endJdTdb, `${body.bodyId} coverage end`);
  }
  return { startJdTdb, endJdTdb };
}

function assertRouteContinuity(bodyId, segments) {
  if (segments.length === 0 || !segments.some((segment) => segment.kind === 'baseline')) {
    throw new Error(`${bodyId} routing requires at least one baseline segment.`);
  }
  for (let index = 1; index < segments.length; index += 1) {
    assertSameEpoch(
      segments[index - 1].endJdTdb,
      segments[index].startJdTdb,
      `${bodyId} routing boundary ${index}`,
    );
  }
}

function assertRoundTripMatches(expected, actual) {
  if (actual.length !== expected.length) throw new Error('IOMEPH round trip changed the series count.');
  for (let index = 0; index < expected.length; index += 1) {
    const left = expected[index];
    const right = actual[index];
    if (
      left.bodyId !== right.bodyId ||
      left.startJdTdb !== right.startJdTdb ||
      left.stepSeconds !== right.stepSeconds ||
      left.sampleCount !== right.sampleCount ||
      left.valuesSi.length !== right.valuesSi.length
    ) {
      throw new Error(`IOMEPH round trip changed series ${left.bodyId}.`);
    }
    for (let valueIndex = 0; valueIndex < left.valuesSi.length; valueIndex += 1) {
      if (left.valuesSi[valueIndex] !== right.valuesSi[valueIndex]) {
        throw new Error(`IOMEPH round trip changed ${left.bodyId} value ${valueIndex}.`);
      }
    }
  }
}

function assertSameEpoch(actual, expected, label) {
  const differenceSeconds = Math.abs(actual - expected) * SECONDS_PER_DAY;
  if (!Number.isFinite(differenceSeconds) || differenceSeconds > COVERAGE_TOLERANCE_SECONDS) {
    throw new Error(`${label} differs by ${differenceSeconds}s.`);
  }
}

function requireIsoDate(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an ISO date-time.`);
  }
}

function jsonFile(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function atomicWrite(path, value) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, value);
  await rename(temporaryPath, path);
}
