import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { decodeEphemerisBinary, sha256Hex } from './binary-format.mjs';
import { createValidationReport } from './validation.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const generatedDirectory = join(scriptDirectory, '..', '..', 'src', 'data', 'generated');
const requiredBodyIds = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
];
const expectedTargetIds = {
  sun: '10',
  mercury: '199',
  venus: '299',
  earth: '399',
  moon: '301',
  mars: '499',
  jupiter: '599',
  saturn: '699',
  uranus: '799',
  neptune: '899',
};
const expectedStartJdTdb = 2_451_544.5;
const expectedEndJdTdb = 2_488_069.5;

export async function verifyReleaseArtifacts(directory = generatedDirectory) {
  const manifest = await readJson(join(directory, 'solar-system-ephemeris.manifest.json'));
  const references = await readJson(join(directory, 'validation-references.json'));
  const committedReport = await readJson(
    join(directory, 'solar-system-ephemeris.validation.json'),
  );
  const binary = await readFile(join(directory, manifest.binaryFile));
  const binarySha256 = sha256Hex(binary);
  if (binarySha256 !== manifest.binarySha256) {
    throw new Error('Release ephemeris binary SHA-256 does not match its manifest.');
  }
  if (references.datasetId !== manifest.datasetId || references.independent !== true) {
    throw new Error('Release reference set is not an independent match for the dataset.');
  }
  const manifestBodyIds = manifest.bodies?.map((body) => body.bodyId);
  if (JSON.stringify(manifestBodyIds) !== JSON.stringify(requiredBodyIds)) {
    throw new Error('Release manifest does not contain the required ordered body catalog.');
  }

  const datasets = decodeEphemerisBinary(binary).bodies;
  const binaryByBody = new Map(datasets.map((body) => [body.bodyId, body]));
  for (const manifestBody of manifest.bodies) {
    const bodyId = manifestBody.bodyId;
    const provenance = manifestBody.provenance;
    const binaryBody = binaryByBody.get(bodyId);
    const expectedStepSeconds = bodyId === 'moon' ? 21_600 : 86_400;
    const expectedSampleCount =
      Math.round(
        ((expectedEndJdTdb - expectedStartJdTdb) * 86_400) / expectedStepSeconds,
      ) + 1;
    const binaryEndJdTdb =
      binaryBody === undefined
        ? Number.NaN
        : binaryBody.startJdTdb +
          ((binaryBody.sampleCount - 1) * binaryBody.stepSeconds) / 86_400;
    if (
      binaryBody === undefined ||
      binaryBody.startJdTdb !== expectedStartJdTdb ||
      binaryEndJdTdb !== expectedEndJdTdb ||
      binaryBody.stepSeconds !== expectedStepSeconds ||
      binaryBody.sampleCount !== expectedSampleCount ||
      provenance.provider !== 'JPL_HORIZONS' ||
      provenance.targetId !== expectedTargetIds[bodyId] ||
      provenance.centerId !== '10' ||
      provenance.referenceFrame !== 'ICRF' ||
      provenance.referencePlane !== 'ECLIPTIC' ||
      provenance.timeScale !== 'TDB' ||
      provenance.units !== 'm and m/s' ||
      provenance.startJd !== expectedStartJdTdb ||
      provenance.endJd !== expectedEndJdTdb ||
      provenance.sampleStepSeconds !== expectedStepSeconds ||
      !provenance.notes?.some((note) => note.includes('500@10'))
    ) {
      throw new Error(`Release body "${bodyId}" does not match the Phase 2 data contract.`);
    }
  }
  if (
    references.samples.length !== 240 ||
    references.intervalsPerBody !== 8 ||
    JSON.stringify(references.samplingFractions) !== JSON.stringify([0.25, 0.5, 0.75])
  ) {
    throw new Error('Release reference set does not match the versioned 24-check/body policy.');
  }
  for (const bodyId of requiredBodyIds) {
    if (references.samples.filter((sample) => sample.bodyId === bodyId).length !== 24) {
      throw new Error(`Release reference set does not contain 24 checks for "${bodyId}".`);
    }
  }
  const recomputed = createValidationReport(
    datasets,
    references,
    new Date(committedReport.generatedAtIso),
  );
  if (!recomputed.passed || recomputed.referenceChecks.length !== references.samples.length) {
    throw new Error('Release ephemeris does not pass independent interpolation validation.');
  }
  if (
    committedReport.passed !== true ||
    committedReport.structuralPassed !== true ||
    committedReport.independentValidationPerformed !== true ||
    committedReport.datasetId !== manifest.datasetId ||
    committedReport.binarySha256 !== binarySha256 ||
    JSON.stringify(committedReport.datasetChecks) !== JSON.stringify(recomputed.datasetChecks) ||
    JSON.stringify(committedReport.referenceChecks) !== JSON.stringify(recomputed.referenceChecks)
  ) {
    throw new Error('Committed validation report is stale or inconsistent with release artifacts.');
  }
  return {
    datasetId: manifest.datasetId,
    binarySha256,
    bodyCount: datasets.length,
    referenceCheckCount: recomputed.referenceChecks.length,
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyReleaseArtifacts()
    .then((result) => {
      process.stdout.write(
        `Verified ${result.bodyCount} bodies and ${result.referenceCheckCount} independent checks ` +
          `for ${result.datasetId}.\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 1;
    });
}
