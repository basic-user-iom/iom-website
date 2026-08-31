import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { writeEphemerisArtifacts } from './artifact-io.mjs';
import { decodeEphemerisBinary, encodeEphemerisBinary, sha256Hex } from './binary-format.mjs';
import { fetchHorizonsCached } from './cache-fetch.mjs';
import { loadBodyCatalog, selectCatalogBodies } from './catalog.mjs';
import { mergeParsedChunks } from './chunk-merge.mjs';
import { formatCliHelp, parseEphemerisCli } from './cli.mjs';
import { parseHorizonsVectors } from './horizons-parser.mjs';
import { buildHorizonsRequestUrl, planHorizonsChunks } from './horizons-request.mjs';
import { createEphemerisManifest } from './metadata.mjs';
import { createValidationReport } from './validation.mjs';

export async function generateEphemeris(options) {
  const catalog = await loadBodyCatalog();
  const bodies = selectCatalogBodies(catalog, options.bodyIds);
  const datasets = [];

  for (const body of bodies) {
    const stepSeconds = options.stepSeconds ?? body.defaultStepSeconds;
    const ranges = planHorizonsChunks({
      startDate: options.startDate,
      endDate: options.endDate,
      stepSeconds,
    });
    const chunks = [];
    const responseHashes = [];
    const retrievalDates = [];
    for (const range of ranges) {
      const url = buildHorizonsRequestUrl({ body, catalog, ...range, stepSeconds });
      const response = await fetchHorizonsCached({
        url,
        cacheDir: options.cacheDir,
        offline: options.offline,
        refreshCache: options.refreshCache,
        retries: options.retries,
        backoffMs: options.backoffMs,
      });
      chunks.push(parseHorizonsVectors(response.text, { body, catalog, expectedStepSeconds: stepSeconds }));
      responseHashes.push(sha256Hex(response.text));
      retrievalDates.push(response.retrievedAtIso);
    }
    const dataset = mergeParsedChunks(chunks);
    dataset.sourceHash = sha256Hex(responseHashes.join('\n'));
    dataset.retrievedAtIso = retrievalDates.sort().at(-1);
    datasets.push(dataset);
  }

  const binary = encodeEphemerisBinary(datasets);
  const roundTrip = decodeEphemerisBinary(binary);
  const generatedAtIso = new Date().toISOString();
  const requestIdentity = JSON.stringify({
    start: options.startDate,
    end: options.endDate,
    step: options.stepSeconds,
    bodies: bodies.map((body) => body.id),
  });
  const datasetId = `jpl-horizons-${sha256Hex(requestIdentity).slice(0, 16)}`;
  const binaryFile = 'solar-system-ephemeris.v1.bin';
  const manifest = createEphemerisManifest({
    catalog,
    datasets,
    datasetId,
    binaryFile,
    binarySha256: sha256Hex(binary),
    generatedAtIso,
  });
  const references = options.referencesPath === null
    ? null
    : JSON.parse(await readFile(options.referencesPath, 'utf8'));
  const validationReport = createValidationReport(roundTrip.bodies, references);
  const paths = await writeEphemerisArtifacts({
    outputDir: options.outputDir,
    binary,
    manifest,
    validationReport,
  });
  return { datasets, binary, manifest, validationReport, paths };
}

async function main() {
  const options = parseEphemerisCli(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${formatCliHelp()}\n`);
    return;
  }
  const result = await generateEphemeris(options);
  process.stdout.write(
    `Generated ${result.datasets.length} bodies (${result.binary.byteLength} bytes).\n` +
      `Manifest: ${result.paths.manifestPath}\nValidation: ${result.paths.validationPath}\n`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
