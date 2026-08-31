import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';

const input = process.argv[2];
const output = process.argv[3] ?? 'public/assets/phase5/jupiter-opal-2025.webp';

if (input === undefined || input.trim().length === 0) {
  throw new Error(
    'Usage: node scripts/generate-phase5-jupiter-map.mjs <official-opal-tiff> [output-webp]',
  );
}

const inputPath = resolve(input);
const outputPath = resolve(output);
const metadata = await sharp(inputPath).metadata();
if (metadata.width !== 3_600 || metadata.height !== 1_800) {
  throw new RangeError(
    `Expected the OPAL 3600 x 1800 global map, received ${metadata.width} x ${metadata.height}.`,
  );
}

await mkdir(dirname(outputPath), { recursive: true });
const result = await sharp(inputPath)
  .webp({
    lossless: true,
    effort: 6,
  })
  .toFile(outputPath);

if (result.width !== 3_600 || result.height !== 1_800 || result.format !== 'webp') {
  throw new Error('Generated Jupiter map failed its output contract.');
}

console.log(
  `Generated ${outputPath} (${result.width} x ${result.height}, ${result.size} bytes).`,
);
