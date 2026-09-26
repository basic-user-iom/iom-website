import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import draco from 'draco3dgltf';
import { MeshoptEncoder } from 'meshoptimizer';

const sourceUrl = 'https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/voyager-probe-%28b%29/Voyager%20Probe%20%28B%29.glb';
const directory = new URL('../../public/assets/space-objects/voyager/', import.meta.url);
const response = await fetch(sourceUrl);
if (!response.ok) throw new Error('NASA Voyager download failed: ' + response.status);
const source = new Uint8Array(await response.arrayBuffer());
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco.createDecoderModule(),
  'meshopt.encoder': MeshoptEncoder,
});
await MeshoptEncoder.ready;
const doc = await io.readBinary(source);
for (const extension of doc.getRoot().listExtensionsUsed()) {
  if (extension.extensionName === 'KHR_draco_mesh_compression') extension.dispose();
}
// Use the existing browser decoder; retain textures and all original triangles.
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const output = await io.writeBinary(doc);
await mkdir(directory, { recursive: true });
await writeFile(new URL('voyager-nasa-web.glb', directory), output);
await writeFile(new URL('source.json', directory), JSON.stringify({
  assetId: 'voyager-nasa-carbajal-2025-web',
  sourcePage: 'https://science.nasa.gov/3d-resources/voyager-probe-b/',
  sourceUrl,
  credit: 'NASA / Michael D. Carbajal',
  sourcePublishedUtc: '2025-04-18',
  retrievedAtUtc: new Date().toISOString(),
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  outputSha256: createHash('sha256').update(output).digest('hex'),
  processing: 'Draco decoded, then meshopt-quantized/compressed. Authored materials, embedded textures, all triangles and meter units retained. Shared design for Voyager 1 and 2.',
  geometryTriangles: 20390,
  usage: 'NASA 3D Resources are free and without copyright; no NASA endorsement implied.',
  usageRef: 'https://github.com/nasa/NASA-3D-Resources',
  attitude: 'Illustrative Earth-pointing attitude; not SPICE attitude telemetry.',
}, null, 2) + '\n');
console.log({ directory: fileURLToPath(directory), sourceBytes: source.length, outputBytes: output.length });
