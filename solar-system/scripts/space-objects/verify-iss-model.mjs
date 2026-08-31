import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = path.resolve(SCRIPT_DIR, '..', '..', 'public', 'assets', 'space-objects', 'iss');
const manifest = JSON.parse(await readFile(path.join(ASSET_DIR, 'manifest.json'), 'utf8'));

if (
  manifest.schemaVersion !== 1 ||
  manifest.assetId !== 'iss-nasa-jsc-igoal-2026-web' ||
  manifest.sourceOrganization !== 'NASA/JSC/Integrated Graphics, Operations, and Analysis Laboratory' ||
  !String(manifest.sourcePage).startsWith('https://science.nasa.gov/')
) {
  throw new Error('ISS model manifest provenance is invalid.');
}

const bytes = await readFile(path.join(ASSET_DIR, manifest.file));
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== manifest.outputSha256 || bytes.length !== manifest.outputByteLength) {
  throw new Error('ISS model checksum or byte length does not match the manifest.');
}
if (bytes.length > 25 * 1024 * 1024) {
  throw new Error(`ISS web model exceeds the 25 MB release budget (${bytes.length} bytes).`);
}
if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) {
  throw new Error('ISS model is not a GLB 2.0 file.');
}

const jsonLength = bytes.readUInt32LE(12);
const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/u, '').trim());
if (!json.extensionsRequired?.includes('EXT_meshopt_compression')) {
  throw new Error('ISS model is missing required EXT_meshopt_compression.');
}
if (json.extensionsRequired?.includes('KHR_draco_mesh_compression')) {
  throw new Error('ISS web model unexpectedly retains Draco compression.');
}
if (!(manifest.outputMetrics?.triangles > 100_000) || !(manifest.outputMetrics?.materials >= 40)) {
  throw new Error('ISS web model fidelity metrics are below the release floor.');
}

console.log(JSON.stringify({
  assetId: manifest.assetId,
  byteLength: bytes.length,
  sha256: hash,
  triangles: manifest.outputMetrics.triangles,
  materials: manifest.outputMetrics.materials,
  source: manifest.sourceOrganization,
}, null, 2));
