import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const directory = new URL('../../public/assets/space-objects/voyager/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('source.json', directory), 'utf8'));
const bytes = await readFile(new URL('voyager-nasa-web.glb', directory));
assert.equal(manifest.assetId, 'voyager-nasa-carbajal-2025-web');
assert.equal(manifest.sourcePage, 'https://science.nasa.gov/3d-resources/voyager-probe-b/');
assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.outputSha256, 'Voyager checksum');
assert(bytes.length < 2_500_000, 'Voyager download budget');
assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB signature');
assert.equal(bytes.readUInt32LE(4), 2, 'GLB version');
assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB total length');
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8').trim());
assert(json.extensionsRequired.includes('EXT_meshopt_compression'), 'Shared browser decoder');
assert(!json.extensionsRequired.includes('KHR_draco_mesh_compression'), 'No Draco dependency');
assert.equal(json.meshes.length, 4, 'All authored model pieces');
const triangles = json.meshes.flatMap(mesh => mesh.primitives).reduce((sum, primitive) => {
  assert.equal(primitive.mode ?? 4, 4, 'Triangle primitive');
  return sum + json.accessors[primitive.indices].count / 3;
}, 0);
assert.equal(triangles, 20390, 'Full source geometry');
assert.equal(triangles, manifest.geometryTriangles);
assert.equal(json.images.length, 4, 'Embedded source textures and fallbacks');
for (const image of json.images) assert(Number.isInteger(image.bufferView) && !image.uri, 'Texture is embedded');
for (const buffer of json.buffers) assert(!buffer.uri, 'No remote buffer dependency');
console.log(JSON.stringify({ assetId: manifest.assetId, bytes: bytes.length, triangles, textures: json.images.length }));
