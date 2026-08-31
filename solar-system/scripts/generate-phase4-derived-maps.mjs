import { createHash } from 'node:crypto'
import { readFile, mkdir, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const OUTPUT_WIDTH = 2048
const OUTPUT_HEIGHT = 1024
const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = resolve(process.argv[2] ?? join(projectDirectory, '.tmp-phase4-source'))
const outputDirectory = join(projectDirectory, 'public', 'assets', 'phase4')

await mkdir(outputDirectory, { recursive: true })

const mercurySource = join(sourceDirectory, 'mercury-dem.tif')
const moonSource = join(sourceDirectory, 'moon-ldem.tif')
const marsSource = join(sourceDirectory, 'mars-mola.img')
const earthSource = join(outputDirectory, 'earth-day.png')

const mercuryHeight = await readTiffHeight(mercurySource, true)
const moonHeight = await readTiffHeight(moonSource, false, 0.5)
const marsHeight = await readMarsMolaHeight(marsSource)

await writeRgbPng(
  'mercury-normal.png',
  createLatitudeAwareNormalMap(mercuryHeight, 2_439_400, 36),
)
await writeRgbPng(
  'moon-normal.png',
  createLatitudeAwareNormalMap(moonHeight, 1_737_400, 48),
)
await writeRgbPng(
  'mars-normal.png',
  createLatitudeAwareNormalMap(marsHeight, 3_396_190, 1.4),
)

const earth = await readEarthColor(earthSource)
const earthMaterialMaps = createEarthMaterialMaps(earth)
await writeRgbPng('earth-normal.png', earthMaterialMaps.normal)
await writeGrayPng('earth-ocean.png', earthMaterialMaps.ocean)
await writeGrayPng('earth-roughness.png', earthMaterialMaps.roughness)

const sourceFiles = [mercurySource, moonSource, marsSource, earthSource]
const outputFiles = [
  'mercury-normal.png',
  'moon-normal.png',
  'mars-normal.png',
  'earth-normal.png',
  'earth-ocean.png',
  'earth-roughness.png',
].map((name) => join(outputDirectory, name))

const report = {
  generator: 'generate-phase4-derived-maps.mjs',
  dimensions: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT },
  sourceDirectory,
  sources: await Promise.all(sourceFiles.map(describeFile)),
  outputs: await Promise.all(outputFiles.map(describeFile)),
  algorithms: {
    rockyNormals:
      'Central differences over quantitative elevation, longitude wrap, latitude-aware east-west metric, normalized tangent-space RGB; visual slope amplification is body-specific and recorded in source.',
    earthNormal:
      'Low-strength central differences over Blue Marble luminance, attenuated over the derived ocean mask because the source contains baked relief.',
    earthOcean:
      'Blue-dominance classification stored as a separate linear mask; project-authored heuristic, not coastline data.',
    earthRoughness:
      'Project-authored material parameter: low over derived oceans and higher over land with restrained luminance variation.',
    longitudeAlignment:
      'Mercury DEM and Mars MOLA 0..360 east-positive rasters are rolled 180 degrees to align with -180..180 runtime color maps.',
  },
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

async function readTiffHeight(path, rollHalfWidth, scale = 1) {
  const metadata = await sharp(path, { limitInputPixels: false }).metadata()
  if (metadata.width === undefined || metadata.height === undefined || metadata.channels !== 1) {
    throw new Error(`Expected a single-band quantitative TIFF: ${path}`)
  }
  const { data, info } = await sharp(path, { limitInputPixels: false })
    .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .raw({ depth: 'float' })
    .toBuffer({ resolveWithObject: true })
  if (info.width !== OUTPUT_WIDTH || info.height !== OUTPUT_HEIGHT || info.channels < 1) {
    throw new Error(`Unexpected resized TIFF shape for ${path}`)
  }
  const raw = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4)
  const height = new Float64Array(OUTPUT_WIDTH * OUTPUT_HEIGHT)
  for (let y = 0; y < OUTPUT_HEIGHT; y += 1) {
    for (let x = 0; x < OUTPUT_WIDTH; x += 1) {
      const sourceX = rollHalfWidth ? (x + OUTPUT_WIDTH / 2) % OUTPUT_WIDTH : x
      height[y * OUTPUT_WIDTH + x] =
        raw[(y * OUTPUT_WIDTH + sourceX) * info.channels] * scale
    }
  }
  return height
}

async function readMarsMolaHeight(path) {
  const sourceWidth = 5760
  const sourceHeight = 2880
  const data = await readFile(path)
  if (data.byteLength !== sourceWidth * sourceHeight * 2) {
    throw new Error(`MOLA MEGDR byte length is ${data.byteLength}; expected ${sourceWidth * sourceHeight * 2}.`)
  }
  const output = new Float64Array(OUTPUT_WIDTH * OUTPUT_HEIGHT)
  for (let y = 0; y < OUTPUT_HEIGHT; y += 1) {
    const sourceY = (y + 0.5) / OUTPUT_HEIGHT * sourceHeight - 0.5
    const y0 = clampInteger(Math.floor(sourceY), 0, sourceHeight - 1)
    const y1 = Math.min(y0 + 1, sourceHeight - 1)
    const yMix = sourceY - Math.floor(sourceY)
    for (let x = 0; x < OUTPUT_WIDTH; x += 1) {
      const unrolledX = (x + 0.5) / OUTPUT_WIDTH * sourceWidth - 0.5
      const rolledX = modulo(unrolledX + sourceWidth / 2, sourceWidth)
      const x0 = Math.floor(rolledX)
      const x1 = (x0 + 1) % sourceWidth
      const xMix = rolledX - x0
      const top = mix(readInt16Be(data, sourceWidth, x0, y0), readInt16Be(data, sourceWidth, x1, y0), xMix)
      const bottom = mix(readInt16Be(data, sourceWidth, x0, y1), readInt16Be(data, sourceWidth, x1, y1), xMix)
      output[y * OUTPUT_WIDTH + x] = mix(top, bottom, yMix)
    }
  }
  return output
}

async function readEarthColor(path) {
  const { data, info } = await sharp(path)
    .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.channels !== 3) throw new Error('Earth albedo must decode to RGB.')
  return data
}

function createLatitudeAwareNormalMap(height, radiusM, exaggeration) {
  const output = new Uint8Array(OUTPUT_WIDTH * OUTPUT_HEIGHT * 3)
  const latitudeStep = Math.PI / OUTPUT_HEIGHT
  const longitudeStep = Math.PI * 2 / OUTPUT_WIDTH
  for (let y = 0; y < OUTPUT_HEIGHT; y += 1) {
    const northY = Math.max(0, y - 1)
    const southY = Math.min(OUTPUT_HEIGHT - 1, y + 1)
    const latitude = Math.PI / 2 - (y + 0.5) * latitudeStep
    const eastWestStepM = Math.max(radiusM * longitudeStep * Math.abs(Math.cos(latitude)), radiusM * longitudeStep * 0.025)
    const northSouthStepM = radiusM * latitudeStep
    for (let x = 0; x < OUTPUT_WIDTH; x += 1) {
      const westX = modulo(x - 1, OUTPUT_WIDTH)
      const eastX = (x + 1) % OUTPUT_WIDTH
      const eastSlope =
        (height[y * OUTPUT_WIDTH + eastX] - height[y * OUTPUT_WIDTH + westX]) /
        (2 * eastWestStepM)
      const southSlope =
        (height[southY * OUTPUT_WIDTH + x] - height[northY * OUTPUT_WIDTH + x]) /
        (2 * northSouthStepM)
      writeNormal(output, y * OUTPUT_WIDTH + x, -eastSlope * exaggeration, southSlope * exaggeration, 1)
    }
  }
  return output
}

function createEarthMaterialMaps(color) {
  const count = OUTPUT_WIDTH * OUTPUT_HEIGHT
  const luminance = new Float32Array(count)
  const oceanFloat = new Float32Array(count)
  const ocean = new Uint8Array(count)
  const roughness = new Uint8Array(count)
  const normal = new Uint8Array(count * 3)

  for (let index = 0; index < count; index += 1) {
    const source = index * 3
    const red = color[source] / 255
    const green = color[source + 1] / 255
    const blue = color[source + 2] / 255
    luminance[index] = red * 0.299 + green * 0.587 + blue * 0.114
    const blueDominance = blue - Math.max(red, green) * 0.72
    const water = smoothstep(0.035, 0.19, blueDominance)
    oceanFloat[index] = water
    ocean[index] = Math.round(water * 255)
    const landRoughness = clamp(0.68 + (0.5 - luminance[index]) * 0.18, 0.55, 0.86)
    roughness[index] = Math.round(mix(landRoughness, 0.12, water) * 255)
  }

  for (let y = 0; y < OUTPUT_HEIGHT; y += 1) {
    const northY = Math.max(0, y - 1)
    const southY = Math.min(OUTPUT_HEIGHT - 1, y + 1)
    for (let x = 0; x < OUTPUT_WIDTH; x += 1) {
      const westX = modulo(x - 1, OUTPUT_WIDTH)
      const eastX = (x + 1) % OUTPUT_WIDTH
      const index = y * OUTPUT_WIDTH + x
      const eastGradient = luminance[y * OUTPUT_WIDTH + eastX] - luminance[y * OUTPUT_WIDTH + westX]
      const southGradient = luminance[southY * OUTPUT_WIDTH + x] - luminance[northY * OUTPUT_WIDTH + x]
      const landWeight = Math.pow(1 - oceanFloat[index], 2) * 1.7
      writeNormal(normal, index, -eastGradient * landWeight, southGradient * landWeight, 1)
    }
  }
  return { normal, ocean, roughness }
}

function writeNormal(output, pixelIndex, x, y, z) {
  const inverseLength = 1 / Math.hypot(x, y, z)
  const offset = pixelIndex * 3
  output[offset] = encodeNormalComponent(x * inverseLength)
  output[offset + 1] = encodeNormalComponent(y * inverseLength)
  output[offset + 2] = encodeNormalComponent(z * inverseLength)
}

function encodeNormalComponent(value) {
  return Math.round(clamp(value * 0.5 + 0.5, 0, 1) * 255)
}

async function writeRgbPng(name, data) {
  await sharp(data, { raw: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT, channels: 3 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(join(outputDirectory, name))
}

async function writeGrayPng(name, data) {
  await sharp(data, { raw: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT, channels: 1 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(join(outputDirectory, name))
}

async function describeFile(path) {
  const bytes = await readFile(path)
  const details = await stat(path)
  return {
    file: path,
    bytes: details.size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

function readInt16Be(data, width, x, y) {
  return data.readInt16BE((y * width + x) * 2)
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function mix(left, right, amount) {
  return left + (right - left) * amount
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

function clampInteger(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}
