import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import process from 'node:process';

export async function writeEphemerisArtifacts({ outputDir, binary, manifest, validationReport }) {
  await mkdir(outputDir, { recursive: true });
  const binaryPath = join(outputDir, manifest.binaryFile);
  const manifestPath = join(outputDir, 'solar-system-ephemeris.manifest.json');
  const validationPath = join(outputDir, 'solar-system-ephemeris.validation.json');
  await atomicWrite(binaryPath, binary);
  await atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await atomicWrite(validationPath, `${JSON.stringify(validationReport, null, 2)}\n`);
  return { binaryPath, manifestPath, validationPath };
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function atomicWrite(path, value) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, value);
  await rename(temporaryPath, path);
}

export const portableFileName = (path) => basename(path);
