import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  flatten,
  getBounds,
  meshopt,
  prune,
  simplify,
  textureCompress,
  weld,
} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public', 'assets', 'space-objects', 'iss');
const DEFAULT_INPUT = path.resolve(PROJECT_ROOT, '..', '.tmp', 'nasa-iss-igoal-original.glb');
const OUTPUT_FILE = 'iss-nasa-jsc-igoal-web.glb';
const SOURCE_SHA256 = '3b03742fb55f2a495c4a72aaa2cb175aaeff5ee38f4f42b95f92083e30a464ef';
const SOURCE_PAGE = 'https://science.nasa.gov/3d-resources/international-space-station-iss-d-igoal/';
const SOURCE_ASSET = 'https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/international-space-station-%28iss%29-%28d%29-%28igoal%29/International%20Space%20Station%20%28ISS%29%20%28D%29%20%28IGOAL%29.glb';

const options = resolveArguments(process.argv.slice(2));
const inputPath = options.input;
const sourceBytes = await readFile(inputPath);
const sourceSha256 = sha256(sourceBytes);
if (sourceSha256 !== SOURCE_SHA256) {
  throw new Error(`NASA ISS source checksum mismatch: ${sourceSha256}.`);
}
const sourceMetrics = sourceGlbMetrics(sourceBytes);

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const decoder = await draco3d.createDecoderModule();
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': decoder,
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

const document = await io.read(options.decodedInput ?? inputPath);
const prepared = modelMetrics(document);

await document.transform(
  weld(),
  dedup(),
  flatten(),
  prune(),
  ...(options.decodedInput === null ? [simplify({
    simplifier: MeshoptSimplifier,
    ratio: 0.20,
    error: 0.004,
  })] : []),
  prune(),
  textureCompress({
    encoder: sharp,
    resize: [512, 512],
    targetFormat: 'webp',
    quality: 82,
  }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  prune(),
);

const after = modelMetrics(document);
await mkdir(OUTPUT_DIR, { recursive: true });
const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILE);
await io.write(outputPath, document);
const outputBytes = await readFile(outputPath);

const manifest = {
  schemaVersion: 1,
  assetId: 'iss-nasa-jsc-igoal-2026-web',
  name: 'International Space Station',
  file: OUTPUT_FILE,
  sourceOrganization: 'NASA/JSC/Integrated Graphics, Operations, and Analysis Laboratory',
  sourcePage: SOURCE_PAGE,
  sourceAsset: SOURCE_ASSET,
  sourcePublishedUtc: '2026-05-20T00:00:00.000Z',
  sourceByteLength: sourceBytes.length,
  sourceSha256,
  outputByteLength: outputBytes.length,
  outputSha256: sha256(outputBytes),
  sourceMetrics,
  preparedMetrics: prepared,
  outputMetrics: after,
  transforms: [
    'Decode the source KHR_draco_mesh_compression geometry without changing the station hierarchy or materials.',
    'Weld and deduplicate geometry, flatten the single source scene, and prune unused resources.',
    options.decodedInput === null
      ? 'Simplify to a 0.20 target triangle ratio with a 0.004 meshoptimizer error ceiling for the observatory close-up scale.'
      : 'Use the Blender-decoded 0.20-ratio source prepared by prepare-iss-source-blender.py; preserve that geometry through transport optimization.',
    'Resize embedded textures to a maximum 512 x 512 and encode quality-82 WebP.',
    'Quantize, reorder, and encode geometry with required EXT_meshopt_compression at the medium level.',
  ],
  runtime: {
    lazyLoaded: true,
    orientation: 'LVLH approximation from SGP4 position and velocity: source +X along-track, +Y radial/zenith, +Z cross-track.',
    physicalSpanMeters: 109,
    displayScale: 'Station geometry is proportionally accurate; selected-object size is exaggerated for inspection.',
    fallback: 'The existing compact satellite marker remains available if model loading or decoding fails.',
  },
  usage: {
    credit: 'NASA/JSC/IGOAL',
    guidelines: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    notice: 'NASA should be acknowledged as the source. Use is informational and does not imply NASA endorsement.',
  },
};

await writeFile(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, ...manifest }, null, 2));

function resolveArguments(argv) {
  const value = (name, fallback = null) => {
    const index = argv.indexOf(name);
    if (index === -1) return fallback;
    const item = argv[index + 1];
    if (item === undefined || item.startsWith('--')) throw new Error(`${name} requires a GLB path.`);
    return path.resolve(item);
  };
  return {
    input: value('--input', DEFAULT_INPUT),
    decodedInput: value('--decoded-input'),
  };
}

function modelMetrics(document) {
  const root = document.getRoot();
  let triangles = 0;
  let primitives = 0;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      primitives += 1;
      const indices = primitive.getIndices();
      const positions = primitive.getAttribute('POSITION');
      const count = indices?.getCount() ?? positions?.getCount() ?? 0;
      triangles += primitive.getMode() === 5 ? Math.max(0, count - 2) : Math.floor(count / 3);
    }
  }
  const scene = root.listScenes()[0];
  const bounds = scene === undefined ? null : getBounds(scene);
  return {
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
    primitives,
    triangles,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    boundsMeters: bounds === null ? null : {
      min: bounds.min.map(round),
      max: bounds.max.map(round),
      size: bounds.max.map((value, index) => round(value - bounds.min[index])),
    },
  };
}

function sourceGlbMetrics(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) {
    throw new Error('NASA ISS source is not a GLB 2.0 file.');
  }
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/u, '').trim());
  let triangles = 0;
  let primitives = 0;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      primitives += 1;
      const accessor = json.accessors?.[primitive.indices];
      if (primitive.mode === undefined || primitive.mode === 4) {
        triangles += Math.floor((accessor?.count ?? 0) / 3);
      }
    }
  }
  return {
    generator: json.asset?.generator ?? null,
    extensionsRequired: json.extensionsRequired ?? [],
    nodes: json.nodes?.length ?? 0,
    meshes: json.meshes?.length ?? 0,
    primitives,
    triangles,
    materials: json.materials?.length ?? 0,
    textures: json.textures?.length ?? 0,
  };
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
