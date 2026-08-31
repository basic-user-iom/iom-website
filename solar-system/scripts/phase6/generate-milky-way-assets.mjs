import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

import { DataUtils } from 'three'
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'
import sharp from 'sharp'

import {
  DEFAULT_CACHE_DIRECTORY,
  DEFAULT_OUTPUT_DIRECTORY,
  MILKY_WAY_DISPLAY_TRANSFORM,
  MILKY_WAY_OUTPUTS,
  MILKY_WAY_SOURCE,
} from './phase6-config.mjs'
import {
  describeFile,
  fetchToCache,
  isDirectRun,
  parseGeneratorArguments,
  replaceFile,
} from './phase6-io.mjs'

const expectedExrMagic = Buffer.from([0x76, 0x2f, 0x31, 0x01])
const PINNED_THREE_EXR_LOADER_VERSION = '0.181.2'
let halfFloatLookup

export async function generateMilkyWayAssets(options) {
  const cached = await fetchToCache({
    url: MILKY_WAY_SOURCE.download,
    cachePath: join(options.cacheDirectory, MILKY_WAY_SOURCE.cacheFileName),
    offline: options.offline,
    refresh: options.refresh,
  })
  const sourceBytes = await readFile(cached.path)
  if (!sourceBytes.subarray(0, expectedExrMagic.length).equals(expectedExrMagic)) {
    throw new Error(`NASA SVS source does not start with the OpenEXR magic bytes: ${cached.path}`)
  }

  const sourceArrayBuffer =
    sourceBytes.byteOffset === 0 && sourceBytes.byteLength === sourceBytes.buffer.byteLength
      ? sourceBytes.buffer
      : sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength)
  const decoded = new EXRLoader().parse(sourceArrayBuffer)
  if (decoded.width !== MILKY_WAY_SOURCE.width || decoded.height !== MILKY_WAY_SOURCE.height) {
    throw new Error(
      `NASA SVS OpenEXR decoded as ${decoded.width} x ${decoded.height}; expected ` +
        `${MILKY_WAY_SOURCE.width} x ${MILKY_WAY_SOURCE.height}.`,
    )
  }
  const pixelCount = decoded.width * decoded.height
  const channels = decoded.data.length / pixelCount
  if (channels !== 4 || !Number.isInteger(channels)) {
    throw new Error(`NASA SVS OpenEXR decoded with ${channels} channels; expected RGBA output.`)
  }
  if (!(decoded.data instanceof Uint16Array) && !(decoded.data instanceof Float32Array)) {
    throw new Error(`Unexpected EXR sample array type: ${decoded.data.constructor?.name}`)
  }

  await mkdir(options.outputDirectory, { recursive: true })
  const statistics = createLinearStatistics()
  const eightK = MILKY_WAY_OUTPUTS.find((output) => output.width === decoded.width)
  if (eightK === undefined) throw new Error('Phase 6 configuration is missing its 8K Milky Way output.')
  {
    const rgb8k = toneMapFullResolution(
      decoded.data,
      decoded.width,
      decoded.height,
      channels,
      statistics,
    )
    await writeWebp(join(options.outputDirectory, eightK.fileName), rgb8k, eightK.width, eightK.height)
  }

  const fourK = MILKY_WAY_OUTPUTS.find((output) => output.width === decoded.width / 2)
  if (fourK === undefined) throw new Error('Phase 6 configuration is missing its 4K Milky Way output.')
  const rgb4k = toneMapLinearTwoByTwo(decoded.data, decoded.width, decoded.height, channels)
  await writeWebp(join(options.outputDirectory, fourK.fileName), rgb4k, fourK.width, fourK.height)

  const assets = []
  for (const output of MILKY_WAY_OUTPUTS) {
    const file = await describeFile(join(options.outputDirectory, output.fileName))
    assets.push({
      asset_id: `milky-way-2020-${output.width === 4096 ? '4k' : '8k'}-webp`,
      local_file: output.fileName,
      source_id: MILKY_WAY_SOURCE.id,
      media_type: 'image/webp',
      byte_length: file.byte_length,
      checksum: file.checksum,
      dimensions: { width: output.width, height: output.height },
      color_space: {
        source: 'Linear RGB half-float OpenEXR as supplied by NASA SVS',
        encoded: '8-bit sRGB WebP without alpha',
        runtime: 'sRGB texture decode; display intensity remains renderer-authored',
      },
      projection: createProjectionContract(),
      tier_transform:
        output.width === MILKY_WAY_SOURCE.width
          ? 'No spatial resampling; each source RGB texel receives the fixed display transform.'
          : MILKY_WAY_DISPLAY_TRANSFORM.downsample,
    })
  }

  return {
    source: {
      source_id: MILKY_WAY_SOURCE.id,
      organization: MILKY_WAY_SOURCE.organization,
      title: MILKY_WAY_SOURCE.title,
      record: MILKY_WAY_SOURCE.record,
      machine_record: MILKY_WAY_SOURCE.machineRecord,
      exact_download: MILKY_WAY_SOURCE.download,
      retrieved_at: cached.retrieved_at,
      final_url: cached.final_url,
      response_headers: cached.response_headers,
      media_type: MILKY_WAY_SOURCE.mediaType,
      byte_length: cached.byte_length,
      checksum: cached.checksum,
      dimensions: { width: MILKY_WAY_SOURCE.width, height: MILKY_WAY_SOURCE.height },
      data_semantics:
        'Plate carrée celestial background in ICRF/J2000 equatorial coordinates. This milkyway_2020 layer intentionally omits the separate bright Hipparcos/Tycho stars.',
      credit: MILKY_WAY_SOURCE.credit,
    },
    assets,
    transforms: [
      'Decode the official 8192 x 4096 linear half-float OpenEXR with Three.js EXRLoader.',
      `Clamp negative/non-finite input, apply exposure ${MILKY_WAY_DISPLAY_TRANSFORM.exposure}, the fixed ${MILKY_WAY_DISPLAY_TRANSFORM.toneMap}, and the ${MILKY_WAY_DISPLAY_TRANSFORM.transfer}.`,
      MILKY_WAY_DISPLAY_TRANSFORM.downsample,
      `Encode both tiers as 8-bit sRGB WebP with quality ${MILKY_WAY_DISPLAY_TRANSFORM.encoder.quality}, effort ${MILKY_WAY_DISPLAY_TRANSFORM.encoder.effort}, and smart subsampling enabled.`,
      'Discard the alpha component synthesized by Three.js EXRLoader when it expands the source B/G/R channels to RGBA. The source OpenEXR has no alpha channel. No crop, reprojection, rotation, seam shift, denoising, recoloring, or painted content is applied.',
    ],
    generator_versions: {
      three_exr_loader: PINNED_THREE_EXR_LOADER_VERSION,
      sharp: sharp.versions.sharp,
      libvips: sharp.versions.vips,
    },
    linear_source_statistics: finalizeLinearStatistics(statistics),
  }
}

function toneMapFullResolution(data, width, height, channels, statistics) {
  const output = new Uint8Array(width * height * 3)
  const lookup = data instanceof Uint16Array ? getHalfFloatLookup() : undefined
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const source = pixel * channels
    const destination = pixel * 3
    for (let channel = 0; channel < 3; channel += 1) {
      const linear = readLinear(data, source + channel, lookup)
      recordLinearSample(statistics, channel, linear)
      output[destination + channel] = displayByte(linear)
    }
  }
  return output
}

function toneMapLinearTwoByTwo(data, sourceWidth, sourceHeight, channels) {
  if (sourceWidth % 2 !== 0 || sourceHeight % 2 !== 0) {
    throw new Error('The 4K area-average transform requires even source dimensions.')
  }
  const width = sourceWidth / 2
  const height = sourceHeight / 2
  const output = new Uint8Array(width * height * 3)
  const lookup = data instanceof Uint16Array ? getHalfFloatLookup() : undefined

  for (let y = 0; y < height; y += 1) {
    const sourceY = y * 2
    for (let x = 0; x < width; x += 1) {
      const sourceX = x * 2
      const topLeft = (sourceY * sourceWidth + sourceX) * channels
      const topRight = topLeft + channels
      const bottomLeft = topLeft + sourceWidth * channels
      const bottomRight = bottomLeft + channels
      const destination = (y * width + x) * 3
      for (let channel = 0; channel < 3; channel += 1) {
        const average =
          (sanitizeLinear(readLinear(data, topLeft + channel, lookup)) +
            sanitizeLinear(readLinear(data, topRight + channel, lookup)) +
            sanitizeLinear(readLinear(data, bottomLeft + channel, lookup)) +
            sanitizeLinear(readLinear(data, bottomRight + channel, lookup))) /
          4
        output[destination + channel] = displayByte(average)
      }
    }
  }
  return output
}

async function writeWebp(path, rgb, width, height) {
  const temporaryPath = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp.webp`
  try {
    const input = Buffer.from(rgb.buffer, rgb.byteOffset, rgb.byteLength)
    await sharp(input, {
      raw: { width, height, channels: 3 },
      limitInputPixels: false,
    })
      .webp(MILKY_WAY_DISPLAY_TRANSFORM.encoder)
      .toFile(temporaryPath)
    await replaceFile(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

function displayByte(linearSample) {
  const linear = sanitizeLinear(linearSample) * MILKY_WAY_DISPLAY_TRANSFORM.exposure
  const numerator = linear * (2.51 * linear + 0.03)
  const denominator = linear * (2.43 * linear + 0.59) + 0.14
  const mapped = clamp01(denominator === 0 ? 0 : numerator / denominator)
  const srgb = mapped <= 0.0031308 ? mapped * 12.92 : 1.055 * mapped ** (1 / 2.4) - 0.055
  return Math.round(clamp01(srgb) * 255)
}

function sanitizeLinear(value) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function readLinear(data, index, lookup) {
  return lookup === undefined ? data[index] : lookup[data[index]]
}

function getHalfFloatLookup() {
  if (halfFloatLookup !== undefined) return halfFloatLookup
  halfFloatLookup = new Float32Array(65_536)
  for (let value = 0; value < halfFloatLookup.length; value += 1) {
    halfFloatLookup[value] = DataUtils.fromHalfFloat(value)
  }
  return halfFloatLookup
}

function createProjectionContract() {
  return {
    type: 'plate carrée / equirectangular celestial map',
    reference_frame: 'ICRF equatorial coordinates at J2000.0',
    horizontal: 'Right ascension spans 24h; RA increases from right to left; RA 0h is at horizontal center.',
    vertical: 'Declination +90 degrees is the top edge and -90 degrees is the bottom edge.',
    wrap: 'Horizontal seam wraps at RA 12h opposite the centered RA 0h meridian.',
  }
}

function createLinearStatistics() {
  return {
    minimum: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    maximum: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    negative: 0,
    nonfinite: 0,
    samples: 0,
  }
}

function recordLinearSample(statistics, channel, value) {
  statistics.samples += 1
  if (!Number.isFinite(value)) {
    statistics.nonfinite += 1
    return
  }
  if (value < 0) statistics.negative += 1
  statistics.minimum[channel] = Math.min(statistics.minimum[channel], value)
  statistics.maximum[channel] = Math.max(statistics.maximum[channel], value)
}

function finalizeLinearStatistics(statistics) {
  return {
    sampled_rgb_values: statistics.samples,
    minimum_rgb: statistics.minimum,
    maximum_rgb: statistics.maximum,
    negative_values_clamped: statistics.negative,
    nonfinite_values_clamped: statistics.nonfinite,
  }
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

if (isDirectRun(import.meta.url)) {
  const options = parseGeneratorArguments(process.argv.slice(2), {
    cacheDirectory: DEFAULT_CACHE_DIRECTORY,
    outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
  })
  if (options.help) {
    process.stdout.write(
      'Usage: node --max-old-space-size=2048 generate-milky-way-assets.mjs [--offline | --refresh] [--cache-dir PATH] [--output-dir PATH] [--catalog-dir PATH]\n',
    )
  } else {
    const result = await generateMilkyWayAssets(options)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  }
}
