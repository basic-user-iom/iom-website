import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';

const input = process.argv[2];
const output = process.argv[3] ?? 'public/assets/phase5/saturn-opal-2025.webp';

if (input === undefined || input.trim().length === 0) {
  throw new Error(
    'Usage: node scripts/generate-phase5-saturn-map.mjs <official-opal-tiff> [output-webp]',
  );
}

const SOURCE_WIDTH = 1_800;
const SOURCE_HEIGHT = 900;
const COVERAGE_START_LUMA = 24;
const COVERAGE_FULL_LUMA = 72;
const OUTLIER_LIMIT = 18;

const inputPath = resolve(input);
const outputPath = resolve(output);
const source = sharp(inputPath, { limitInputPixels: false }).removeAlpha();
const metadata = await source.metadata();
if (metadata.width !== SOURCE_WIDTH || metadata.height !== SOURCE_HEIGHT) {
  throw new RangeError(
    `Expected the OPAL 1800 x 900 Saturn global map, received ` +
      `${metadata.width} x ${metadata.height}.`,
  );
}

const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
if (info.channels !== 3) {
  throw new RangeError(`Expected three OPAL color channels, received ${info.channels}.`);
}

const rowMedians = Array.from({ length: SOURCE_HEIGHT }, (_, y) => {
  const channels = [[], [], []];
  for (let x = 0; x < SOURCE_WIDTH; x += 1) {
    const offset = (y * SOURCE_WIDTH + x) * 3;
    const luminance = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
    if (luminance < COVERAGE_FULL_LUMA) continue;
    channels[0].push(data[offset]);
    channels[1].push(data[offset + 1]);
    channels[2].push(data[offset + 2]);
  }
  if (channels[0].length < SOURCE_WIDTH / 2) return null;
  return channels.map(median);
});

const outputPixels = Buffer.alloc(SOURCE_WIDTH * SOURCE_HEIGHT * 4);
let coveredPixelCount = 0;
let suppressedOutlierCount = 0;
for (let y = 0; y < SOURCE_HEIGHT; y += 1) {
  const rowMedian = rowMedians[y];
  for (let x = 0; x < SOURCE_WIDTH; x += 1) {
    const sourceOffset = (y * SOURCE_WIDTH + x) * 3;
    const outputOffset = (y * SOURCE_WIDTH + x) * 4;
    const luminance = (
      data[sourceOffset] + data[sourceOffset + 1] + data[sourceOffset + 2]
    ) / 3;
    const coverage = rowMedian === null
      ? 0
      : smoothstep(COVERAGE_START_LUMA, COVERAGE_FULL_LUMA, luminance);

    for (let channel = 0; channel < 3; channel += 1) {
      const sourceValue = data[sourceOffset + channel];
      const medianValue = rowMedian?.[channel] ?? sourceValue;
      const cleanedValue = clamp(
        sourceValue,
        medianValue - OUTLIER_LIMIT,
        medianValue + OUTLIER_LIMIT,
      );
      if (cleanedValue !== sourceValue && coverage > 0) suppressedOutlierCount += 1;
      outputPixels[outputOffset + channel] = cleanedValue;
    }
    outputPixels[outputOffset + 3] = Math.round(coverage * 255);
    if (coverage > 0) coveredPixelCount += 1;
  }
}

await mkdir(dirname(outputPath), { recursive: true });
const result = await sharp(outputPixels, {
  raw: {
    width: SOURCE_WIDTH,
    height: SOURCE_HEIGHT,
    channels: 4,
  },
})
  .webp({ lossless: true, effort: 6 })
  .toFile(outputPath);

if (
  result.width !== SOURCE_WIDTH ||
  result.height !== SOURCE_HEIGHT ||
  result.channels !== 4 ||
  result.format !== 'webp'
) {
  throw new Error('Generated Saturn map failed its output contract.');
}

console.log(JSON.stringify({
  output: outputPath,
  width: result.width,
  height: result.height,
  byteLength: result.size,
  coveredPixelCount,
  suppressedOutlierChannelCount: suppressedOutlierCount,
}, null, 2));

function median(values) {
  values.sort((left, right) => left - right);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? Math.round((values[middle - 1] + values[middle]) / 2)
    : values[middle];
}

function smoothstep(edge0, edge1, value) {
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
