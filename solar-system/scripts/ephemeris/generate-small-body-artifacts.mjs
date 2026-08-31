import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { loadBodyCatalog } from './catalog.mjs';
import {
  calendarDateToJdTdb,
  formatSmallBodyArtifactHelp,
  parseSmallBodyArtifactCli,
} from './small-body-artifact-cli.mjs';
import {
  createSmallBodyArtifactPackage,
  createSmallBodyValidationArtifact,
  writeSmallBodyArtifacts,
} from './small-body-artifacts.mjs';
import { loadCometCatalog } from './small-body-catalog.mjs';
import { generateSegmentedCometEphemeris } from './small-body-ephemeris-generator.mjs';
import { fetchSmallBodyValidationReferences } from './small-body-validation-references.mjs';

export async function generateSmallBodyArtifacts(options, dependencies = {}) {
  const { cometCatalog, resolutionSet, horizonsCatalog } =
    await loadSmallBodyGenerationInputs(options);
  assertRequestedRangeIsTrusted(cometCatalog, options.startDate, options.endDate);
  const resolutionsById = new Map(
    resolutionSet.comets.map((resolution) => [resolution.id, resolution]),
  );
  const generatedComets = [];

  // Official service traffic stays sequential and cacheable by design.
  for (const comet of cometCatalog.comets) {
    generatedComets.push(await generateSegmentedCometEphemeris({
      comet,
      resolution: resolutionsById.get(comet.id),
      catalog: horizonsCatalog,
      startDate: options.startDate,
      endDate: options.endDate,
      cacheDir: options.cacheDir,
      offline: options.offline,
      refreshCache: options.refreshCache,
      retries: options.retries,
      backoffMs: options.backoffMs,
      ...(dependencies.fetchImpl === undefined ? {} : { fetchImpl: dependencies.fetchImpl }),
      ...(dependencies.sleep === undefined ? {} : { sleep: dependencies.sleep }),
      ...(options.maxRows === undefined ? {} : { maxRows: options.maxRows }),
    }));
  }

  const generatedAtIso = (dependencies.now?.() ?? new Date()).toISOString();
  const artifactPackage = createSmallBodyArtifactPackage({
    generatedComets,
    cometCatalog,
    horizonsCatalog,
    generatedAtIso,
  });
  const referenceSet = await fetchSmallBodyValidationReferences({
    cometCatalog,
    resolutions: resolutionSet.comets,
    horizonsCatalog,
    routing: artifactPackage.routing,
    datasetId: artifactPackage.datasetId,
    cacheDir: options.cacheDir,
    offline: options.offline,
    refreshCache: options.refreshCache,
    retries: options.retries,
    backoffMs: options.backoffMs,
    intervalsPerSegment: options.validationIntervals,
    seed: options.validationSeed,
    ...(dependencies.fetchImpl === undefined ? {} : { fetchImpl: dependencies.fetchImpl }),
    ...(dependencies.sleep === undefined ? {} : { sleep: dependencies.sleep }),
  });
  const validationReport = createSmallBodyValidationArtifact({
    artifactPackage,
    referenceSet,
    generatedAtIso: (dependencies.now?.() ?? new Date()).toISOString(),
  });
  if (!validationReport.passed) {
    const failed = validationReport.referenceChecks.filter((check) => !check.passed).length;
    throw new Error(
      `Small-body ephemeris validation failed (${failed} independent check(s) failed); artifacts were not written.`,
    );
  }
  const paths = await writeSmallBodyArtifacts({
    outputDir: options.outputDir,
    artifactPackage,
    validationReport,
  });
  return {
    generatedComets,
    artifactPackage,
    referenceSet,
    validationReport,
    paths,
  };
}

export async function loadSmallBodyGenerationInputs(options) {
  const [cometCatalog, resolutionSet, horizonsCatalog] = await Promise.all([
    loadCometCatalog(pathToFileURL(options.catalogPath)),
    readJson(options.resolutionsPath),
    loadBodyCatalog(pathToFileURL(options.horizonsCatalogPath)),
  ]);
  validateSmallBodyResolutionSet(resolutionSet, cometCatalog);
  return { cometCatalog, resolutionSet, horizonsCatalog };
}

export function validateSmallBodyResolutionSet(resolutionSet, cometCatalog) {
  if (
    resolutionSet?.schemaVersion !== 1 ||
    resolutionSet.catalogVersion !== cometCatalog.catalogVersion ||
    !Array.isArray(resolutionSet.comets) ||
    resolutionSet.comets.length !== cometCatalog.comets.length
  ) {
    throw new Error('Generated SBDB resolution set does not match the five-comet catalog.');
  }
  const resolutionsById = new Map();
  for (const resolution of resolutionSet.comets) {
    if (resolutionsById.has(resolution?.id)) {
      throw new Error(`Duplicate SBDB resolution for ${String(resolution?.id)}.`);
    }
    resolutionsById.set(resolution?.id, resolution);
  }
  for (const comet of cometCatalog.comets) {
    const resolution = resolutionsById.get(comet.id);
    if (
      resolution?.identity?.spkid !== comet.jpl.spkId ||
      resolution?.orbit?.orbit_id !== comet.jpl.orbitId ||
      Number(resolution?.orbit?.epoch) !== comet.jpl.epochJdTdb ||
      !Number.isFinite(resolution?.samplingSeed?.perihelionJdTdb) ||
      !Array.isArray(resolution?.alternateOrbits)
    ) {
      throw new Error(`${comet.id} SBDB resolution does not match its pinned catalog solution.`);
    }
    const periodDays = resolution.samplingSeed.periodDays;
    if (periodDays !== null && (!Number.isFinite(periodDays) || periodDays <= 0)) {
      throw new Error(`${comet.id} SBDB sampling period is invalid.`);
    }
  }
  return resolutionSet;
}

export function assertRequestedRangeIsTrusted(cometCatalog, startDate, endDate) {
  const startJdTdb = calendarDateToJdTdb(startDate, '--start');
  const endJdTdb = calendarDateToJdTdb(endDate, '--end');
  for (const comet of cometCatalog.comets) {
    if (
      startJdTdb < comet.trustedInterval.startJdTdb ||
      endJdTdb > comet.trustedInterval.endJdTdb
    ) {
      throw new Error(
        `${comet.id} requested range is outside its catalog trusted interval; ` +
          'update the authored contract before expanding release coverage.',
      );
    }
  }
  return { startJdTdb, endJdTdb };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  const options = parseSmallBodyArtifactCli(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${formatSmallBodyArtifactHelp()}\n`);
    return;
  }
  const result = await generateSmallBodyArtifacts(options);
  process.stdout.write(
    `Generated ${result.generatedComets.length} logical comets as ` +
      `${result.artifactPackage.datasets.length} segmented IOMEPH series.\n` +
      `Independent checks: ${result.validationReport.referenceChecks.length}.\n` +
      `Binary: ${result.paths.binaryPath}\n` +
      `Manifest: ${result.paths.manifestPath}\n` +
      `Routing: ${result.paths.routingPath}\n` +
      `Validation: ${result.paths.validationPath}\n`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
