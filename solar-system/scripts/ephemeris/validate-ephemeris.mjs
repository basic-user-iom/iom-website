import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { decodeEphemerisBinary, sha256Hex } from './binary-format.mjs';
import { createValidationReport } from './validation.mjs';

export async function validateEphemerisFiles({ binaryPath, manifestPath, referencesPath, reportPath }) {
  const binary = await readFile(binaryPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const references = JSON.parse(await readFile(referencesPath, 'utf8'));
  const binarySha256 = sha256Hex(binary);
  if (binarySha256 !== manifest.binarySha256) {
    throw new Error('Binary SHA-256 does not match the manifest.');
  }
  if (references.datasetId !== manifest.datasetId) {
    throw new Error('Reference set datasetId does not match the manifest.');
  }
  const datasets = decodeEphemerisBinary(binary).bodies;
  const report = {
    ...createValidationReport(datasets, references),
    datasetId: manifest.datasetId,
    binarySha256,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

function parseArgs(argv, cwd = process.cwd()) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!['--binary', '--manifest', '--references', '--report'].includes(option) || value === undefined) {
      throw new Error('Usage: validate-ephemeris.mjs --binary FILE --manifest FILE --references FILE --report FILE');
    }
    values.set(option, resolve(cwd, value));
  }
  for (const option of ['--binary', '--manifest', '--references', '--report']) {
    if (!values.has(option)) throw new Error(`Missing required ${option}.`);
  }
  return {
    binaryPath: values.get('--binary'),
    manifestPath: values.get('--manifest'),
    referencesPath: values.get('--references'),
    reportPath: values.get('--report'),
  };
}

async function main() {
  const report = await validateEphemerisFiles(parseArgs(process.argv.slice(2)));
  process.stdout.write(`Independent validation ${report.passed ? 'passed' : 'failed'}: ${report.referenceChecks.length} checks.\n`);
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
