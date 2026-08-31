import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public', 'assets', 'moons');
const RETRIEVED_AT_UTC = '2026-08-31T00:00:00.000Z';

const NASA_MODEL_ASSETS = Object.freeze([
  asset('io', 'Io', 'https://science.nasa.gov/resource/io-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/i/Io_1_3643.glb?emrc=6a95989fa0759'),
  asset('europa', 'Europa', 'https://science.nasa.gov/resource/europa-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/e/Europa_1_3138.glb?emrc=6a9598cf34e1a'),
  asset('ganymede', 'Ganymede', 'https://science.nasa.gov/resource/ganymede-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/g/Ganymede_1_5268.glb?emrc=6a9598d08ff37'),
  asset('callisto', 'Callisto', 'https://science.nasa.gov/resource/callisto-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/c/Callisto_1_4821.glb?emrc=6a9598d2147ca'),
  asset('mimas', 'Mimas', 'https://science.nasa.gov/resource/mimas-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/m/Mimas_1_1000.glb?emrc=6a9598d36d312'),
  asset('enceladus', 'Enceladus', 'https://science.nasa.gov/resource/enceladus-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/e/Enceladus_1_504.glb?emrc=6a9598d52a715'),
  asset('tethys', 'Tethys', 'https://science.nasa.gov/resource/tethys-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/t/Tethys_1_1077-1.glb?emrc=6a9598d693888'),
  asset('dione', 'Dione', 'https://science.nasa.gov/resource/dione-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/d/Dione_1_1123.glb?emrc=6a9598d7e7137'),
  asset('rhea', 'Rhea', 'https://science.nasa.gov/resource/rhea-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/r/Rhea_1_1529.glb?emrc=6a9598d9cc39e'),
  asset('titan', 'Titan', 'https://science.nasa.gov/resource/titan-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/t/Titan_1_5150.glb?emrc=6a9598db7190c'),
  asset('hyperion', 'Hyperion', 'https://science.nasa.gov/resource/hyperion-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/h/Hyperion_1_1000.glb?emrc=6a9598dd3647c'),
  asset('iapetus', 'Iapetus', 'https://science.nasa.gov/resource/iapetus-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/i/Iapetus_1_1471.glb?emrc=6a9598deb7dac'),
  asset('miranda', 'Miranda', 'https://science.nasa.gov/resource/miranda-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/m/Miranda_1_472.glb?emrc=6a9598e2009e1'),
  asset('ariel', 'Ariel', 'https://science.nasa.gov/resource/ariel-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/a/Ariel_1_1158.glb?emrc=6a9598e3d8793'),
  asset('umbriel', 'Umbriel', 'https://science.nasa.gov/resource/umbriel-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/u/Umbriel_1_1169.glb?emrc=6a9598e5d4a1c'),
  asset('titania', 'Titania', 'https://science.nasa.gov/resource/titania-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/t/Titania_1_1577.glb?emrc=6a9598e744f6c'),
  asset('oberon', 'Oberon', 'https://science.nasa.gov/resource/oberon-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/o/Oberon_1_1523.glb?emrc=6a9598e9236f5'),
  asset('triton', 'Triton', 'https://science.nasa.gov/resource/triton-3d-model/', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/t/Triton_1_2707.glb?emrc=6a9598eb02042'),
]);

const SUN_ASSET = Object.freeze({
  id: 'sun-sdo-hmi-intensity-2025-12-26-2k',
  name: 'Sun',
  sourcePage: 'https://sdo.gsfc.nasa.gov/data/',
  sourceAsset: 'https://sdo.gsfc.nasa.gov/assets/img/browse/2025/12/26/20251226_000000_2048_HMIIF.jpg',
  observationUtc: '2025-12-26T00:00:00.000Z',
});

await mkdir(OUTPUT_DIR, { recursive: true });

const generated = [];
const rejected = [];
for (const definition of NASA_MODEL_ASSETS) {
  process.stdout.write(`Fetching ${definition.name}... `);
  const response = await fetch(definition.sourceAsset);
  if (!response.ok) throw new Error(`${definition.name} download failed with HTTP ${response.status}.`);
  const glb = Buffer.from(await response.arrayBuffer());
  const image = extractBaseColorImage(glb);
  const metadata = await sharp(image.bytes).metadata();
  if (metadata.width === undefined || metadata.height === undefined) {
    throw new Error(`${definition.name} texture has no readable dimensions.`);
  }
  const ratio = metadata.width / metadata.height;
  if (Math.abs(ratio - 2) > 0.04) {
    rejected.push(Object.freeze({
      ...definition,
      reason: `Embedded texture is a mesh-specific ${metadata.width} x ${metadata.height} UV atlas, not an equirectangular globe map.`,
    }));
    process.stdout.write('skipped non-equirectangular atlas.\n');
    continue;
  }
  const fileName = `${definition.id}-nasa-vtad-2k.webp`;
  const outputPath = path.join(OUTPUT_DIR, fileName);
  await sharp(image.bytes)
    .resize(2048, 1024, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 88, effort: 6, smartSubsample: true })
    .toFile(outputPath);
  generated.push(await manifestRecord(definition, fileName, outputPath, image.name));
  process.stdout.write('done.\n');
}

process.stdout.write('Fetching dated SDO/HMI Sun observation... ');
const sunResponse = await fetch(SUN_ASSET.sourceAsset);
if (!sunResponse.ok) throw new Error(`Sun download failed with HTTP ${sunResponse.status}.`);
const sunSource = Buffer.from(await sunResponse.arrayBuffer());
const sunFileName = 'sun-hmi-intensity-2025-12-26-2k.webp';
const sunOutputPath = path.join(OUTPUT_DIR, sunFileName);
await sharp(sunSource)
  .resize(2048, 2048, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
  .webp({ quality: 90, effort: 6, smartSubsample: true })
  .toFile(sunOutputPath);
generated.push(await manifestRecord(SUN_ASSET, sunFileName, sunOutputPath, '20251226_000000_2048_HMIIF.jpg', {
  projection: 'observer-facing orthographic solar disk',
  observationUtc: SUN_ASSET.observationUtc,
  transforms: ['Download the fixed-date 2048 x 2048 SDO/HMI quick-look continuum disk.', 'Resize deterministically to 2048 x 2048 and encode as quality-90 WebP.', 'Runtime projects only the observed hemisphere and feathers uncovered longitudes into the procedural photosphere.'],
}));
process.stdout.write('done.\n');

const manifest = {
  schemaVersion: 1,
  generatedAtUtc: RETRIEVED_AT_UTC,
  generator: 'scripts/space-objects/generate-major-moon-textures.mjs',
  policy: 'NASA imagery is converted to compact WebP for the observatory. Moon maps are accepted only when the embedded base-color image is a 2:1 equirectangular globe map; mesh-specific UV atlases are rejected rather than misapplied to spheres.',
  credit: 'NASA Visualization Technology Applications and Development (VTAD); NASA/JPL-Caltech where identified by the source page; NASA/SDO/HMI for the dated solar observation. Attribution does not imply endorsement.',
  assets: generated,
  rejected,
  unresolvedMajorMoons: [
    'phobos',
    'deimos',
    'phoebe',
    'proteus',
    'nereid',
  ],
};
await writeFile(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Generated ${generated.length} compact assets; rejected ${rejected.length} incompatible model atlases.`);

function asset(id, name, sourcePage, sourceAsset) {
  return Object.freeze({ id, name, sourcePage, sourceAsset });
}

function extractBaseColorImage(glb) {
  if (glb.readUInt32LE(0) !== 0x46546c67 || glb.readUInt32LE(4) !== 2) {
    throw new Error('NASA model is not a GLB 2.0 file.');
  }
  let offset = 12;
  let json;
  let binary;
  while (offset < glb.length) {
    const length = glb.readUInt32LE(offset);
    const type = glb.readUInt32LE(offset + 4);
    const bytes = glb.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(bytes.toString('utf8').replace(/\0+$/u, '').trim());
    if (type === 0x004e4942) binary = bytes;
    offset += 8 + length;
  }
  if (json === undefined || binary === undefined) throw new Error('GLB is missing JSON or binary data.');
  const baseColorTextureIndex = json.materials?.find((material) => material.pbrMetallicRoughness?.baseColorTexture !== undefined)?.pbrMetallicRoughness?.baseColorTexture?.index;
  const imageIndex = baseColorTextureIndex === undefined ? 0 : json.textures?.[baseColorTextureIndex]?.source;
  const image = json.images?.[imageIndex ?? 0];
  const view = json.bufferViews?.[image?.bufferView];
  if (image === undefined || view === undefined) throw new Error('GLB does not contain an embedded base-color image.');
  const byteOffset = view.byteOffset ?? 0;
  return {
    name: image.name ?? 'embedded-base-color',
    bytes: binary.subarray(byteOffset, byteOffset + view.byteLength),
  };
}

async function manifestRecord(definition, fileName, outputPath, sourceImageName, extra = {}) {
  const bytes = await readFile(outputPath);
  const metadata = await sharp(bytes).metadata();
  return Object.freeze({
    id: definition.id,
    name: definition.name,
    file: fileName,
    width: metadata.width,
    height: metadata.height,
    byteLength: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sourcePage: definition.sourcePage,
    sourceAsset: definition.sourceAsset,
    sourceImageName,
    transforms: ['Extract embedded GLB base-color image.', 'Verify approximately 2:1 equirectangular aspect ratio.', 'Resize to 2048 x 1024 where applicable and encode as quality-88 WebP.'],
    ...extra,
  });
}
