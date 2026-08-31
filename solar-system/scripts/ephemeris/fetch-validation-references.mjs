import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { sha256Hex } from './binary-format.mjs';
import { fetchHorizonsCached } from './cache-fetch.mjs';
import { loadBodyCatalog, selectCatalogBodies } from './catalog.mjs';
import { parseHorizonsReferenceVectors } from './horizons-parser.mjs';
import { buildHorizonsTlistRequestUrl } from './horizons-request.mjs';

const FRACTIONS = Object.freeze([0.25, 0.5, 0.75]);

export async function fetchValidationReferences(options) {
  const catalog = await loadBodyCatalog();
  const manifest = JSON.parse(await readFile(options.manifestPath, 'utf8'));
  const manifestById = new Map(manifest.bodies.map((entry) => [entry.bodyId, entry]));
  const selected = selectCatalogBodies(catalog, options.bodyIds);
  const samples = [];
  const requests = [];
  const tolerancesByBody = {};

  for (const body of selected) {
    const manifestBody = manifestById.get(body.id);
    if (manifestBody === undefined) throw new Error(`Manifest does not contain ${body.id}.`);
    const provenance = manifestBody.provenance;
    const epochs = selectWithheldEpochs({
      bodyId: body.id,
      startJdTdb: provenance.startJd,
      endJdTdb: provenance.endJd,
      stepSeconds: provenance.sampleStepSeconds,
      intervalCount: options.intervalCount,
      seed: options.seed,
    });
    const url = buildHorizonsTlistRequestUrl({ body, catalog, jdTdb: epochs });
    const response = await fetchHorizonsCached({
      url,
      cacheDir: options.cacheDir,
      offline: options.offline,
      refreshCache: options.refreshCache,
      retries: options.retries,
      backoffMs: options.backoffMs,
    });
    const parsed = parseHorizonsReferenceVectors(response.text, {
      body,
      catalog,
      expectedJdTdb: epochs,
    });
    samples.push(...parsed.samples);
    tolerancesByBody[body.id] = {
      positionToleranceM: body.validationPositionToleranceM,
      velocityToleranceMps: body.validationVelocityToleranceMps,
    };
    requests.push({
      bodyId: body.id,
      targetId: body.targetId,
      targetSource: parsed.targetSource,
      sourceSignature: parsed.sourceSignature,
      sourceHash: sha256Hex(response.text),
      retrievedAtIso: response.retrievedAtIso,
      sampleCount: parsed.samples.length,
    });
  }

  const referenceSet = {
    schemaVersion: 1,
    independent: true,
    sourceName: 'NASA/JPL Horizons withheld TLIST reference samples',
    sourceMethod: 'Separate cached TLIST requests at deterministic quarter-step epochs; not generated samples.',
    generatedAtIso: new Date().toISOString(),
    datasetId: manifest.datasetId,
    seed: options.seed,
    samplingFractions: FRACTIONS,
    intervalsPerBody: options.intervalCount,
    tolerancesByBody,
    requests,
    samples,
  };
  await atomicWriteJson(options.outputPath, referenceSet);
  return referenceSet;
}

export function selectWithheldEpochs({
  bodyId,
  startJdTdb,
  endJdTdb,
  stepSeconds,
  intervalCount,
  seed,
}) {
  const totalIntervals = Math.round((endJdTdb - startJdTdb) * 86_400 / stepSeconds);
  if (totalIntervals < 1) throw new Error(`${bodyId} coverage has no interpolation intervals.`);
  const count = Math.min(intervalCount, totalIntervals);
  let state = hashSeed(`${seed}:${bodyId}`);
  const epochs = [];
  for (let stratum = 0; stratum < count; stratum += 1) {
    const first = Math.floor(stratum * totalIntervals / count);
    const exclusiveEnd = Math.floor((stratum + 1) * totalIntervals / count);
    const width = Math.max(1, exclusiveEnd - first);
    state = nextState(state);
    const intervalIndex = first + state % width;
    for (const fraction of FRACTIONS) {
      epochs.push(startJdTdb + (intervalIndex + fraction) * stepSeconds / 86_400);
    }
  }
  return epochs.sort((a, b) => a - b);
}

export function parseReferenceCli(argv, cwd = process.cwd()) {
  const options = {
    manifestPath: null,
    outputPath: resolve(cwd, 'src', 'data', 'generated', 'validation-references.json'),
    cacheDir: resolve(cwd, '.cache', 'horizons-validation'),
    bodyIds: [],
    offline: false,
    refreshCache: false,
    retries: 3,
    backoffMs: 500,
    intervalCount: 8,
    seed: 'iom-validation-v1',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--offline') options.offline = true;
    else if (token === '--refresh-cache') options.refreshCache = true;
    else if (token === '--manifest') options.manifestPath = resolve(cwd, valueAfter(argv, ++index, token));
    else if (token === '--output') options.outputPath = resolve(cwd, valueAfter(argv, ++index, token));
    else if (token === '--cache-dir') options.cacheDir = resolve(cwd, valueAfter(argv, ++index, token));
    else if (token === '--body') options.bodyIds.push(...valueAfter(argv, ++index, token).split(',').map((id) => id.trim().toLowerCase()).filter(Boolean));
    else if (token === '--intervals') options.intervalCount = positiveInteger(valueAfter(argv, ++index, token), token);
    else if (token === '--seed') options.seed = valueAfter(argv, ++index, token);
    else if (token === '--retries') options.retries = nonNegativeInteger(valueAfter(argv, ++index, token), token);
    else if (token === '--backoff-ms') options.backoffMs = nonNegativeInteger(valueAfter(argv, ++index, token), token);
    else throw new Error(`Unknown option: ${String(token)}`);
  }
  if (options.manifestPath === null) throw new Error('--manifest is required.');
  if (options.offline && options.refreshCache) throw new Error('--offline and --refresh-cache cannot be combined.');
  options.bodyIds = [...new Set(options.bodyIds)];
  return options;
}

async function atomicWriteJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

function hashSeed(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function nextState(state) {
  let next = state;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

function valueAfter(argv, index, option) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`${option} requires a value.`);
  return value;
}

function positiveInteger(value, option) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${option} must be a positive integer.`);
  return number;
}

function nonNegativeInteger(value, option) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${option} must be a non-negative integer.`);
  return number;
}

async function main() {
  const result = await fetchValidationReferences(parseReferenceCli(process.argv.slice(2)));
  process.stdout.write(`Wrote ${result.samples.length} withheld reference samples for ${result.requests.length} bodies.\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
