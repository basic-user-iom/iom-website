import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';

const SOURCE_WIDTH = 2_793;
const SOURCE_HEIGHT = 1_156;
const CROP = Object.freeze({ left: 1_450, top: 80, width: 1_343, height: 1_050 });
const EXTEND = Object.freeze({ right: 257, bottom: 80, extendWith: 'copy' });
const DETAIL_WIDTH = 1_600;
const DETAIL_HEIGHT = 1_130;
const HIGH_PASS_SIGMA = 16;
const DENOISE_SIGMA = 0.55;
const RESIDUAL_GAIN = 1.65;

const input = process.argv[2];
const output = process.argv[3] ?? 'public/assets/phase5/jupiter-grs-junocam-detail.webp';

if (input === undefined || input.trim().length === 0) {
  throw new Error(
    'Usage: node scripts/generate-phase5-jupiter-grs-detail.mjs <official-pia23606-tiff> [output-webp]',
  );
}

const inputPath = resolve(input);
const outputPath = resolve(output);
const metadata = await sharp(inputPath).metadata();
if (metadata.width !== SOURCE_WIDTH || metadata.height !== SOURCE_HEIGHT) {
  throw new RangeError(
    `Expected NASA PIA23606 at ${SOURCE_WIDTH} x ${SOURCE_HEIGHT}, received ` +
      `${metadata.width} x ${metadata.height}.`,
  );
}

const prepareCrop = () => sharp(inputPath)
  .extract(CROP)
  .extend(EXTEND)
  .greyscale();

const [fine, lowPass] = await Promise.all([
  prepareCrop().blur(DENOISE_SIGMA).raw().toBuffer({ resolveWithObject: true }),
  prepareCrop().blur(HIGH_PASS_SIGMA).raw().toBuffer({ resolveWithObject: true }),
]);

for (const layer of [fine, lowPass]) {
  if (
    layer.info.width !== DETAIL_WIDTH ||
    layer.info.height !== DETAIL_HEIGHT ||
    layer.info.channels !== 1
  ) {
    throw new Error('Prepared Great Red Spot detail layer failed its grayscale crop contract.');
  }
}

const encodedResidual = Buffer.allocUnsafe(DETAIL_WIDTH * DETAIL_HEIGHT);
let minimum = 255;
let maximum = 0;
let sum = 0;
for (let index = 0; index < encodedResidual.length; index += 1) {
  const residual = fine.data[index] - lowPass.data[index];
  const encoded = Math.max(0, Math.min(255, Math.round(128 + residual * RESIDUAL_GAIN)));
  encodedResidual[index] = encoded;
  minimum = Math.min(minimum, encoded);
  maximum = Math.max(maximum, encoded);
  sum += encoded;
}

await mkdir(dirname(outputPath), { recursive: true });
const result = await sharp(encodedResidual, {
  raw: {
    width: DETAIL_WIDTH,
    height: DETAIL_HEIGHT,
    channels: 1,
  },
})
  .webp({
    lossless: true,
    effort: 6,
  })
  .toFile(outputPath);

if (
  result.width !== DETAIL_WIDTH ||
  result.height !== DETAIL_HEIGHT ||
  result.format !== 'webp'
) {
  throw new Error('Generated Great Red Spot detail map failed its output contract.');
}

console.log(
  `Generated ${outputPath} (${result.width} x ${result.height}, ${result.size} bytes; ` +
    `encoded residual ${minimum}..${maximum}, mean ${(sum / encodedResidual.length).toFixed(2)}).`,
);
