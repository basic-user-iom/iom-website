/**
 * Byte-exact decoded-pixel comparison for the disabled Ground Floor repeat
 * instancing pilot. The Blender renderer writes one PNG for each label/view;
 * this audit intentionally permits no image delta because both inputs contain
 * the same Quest geometry, materials, and owner-local transforms.
 *
 * Usage:
 *   node scripts/compare-ground-floor-repeat-instancing-renders.mjs \
 *     --dir tmp/repeat-instancing-ground-floor/visual-qa-quest-exact
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

const VIEWS = ['front', 'back', 'left', 'right', 'top', 'bottom', 'grazing']
const DEFAULT_DIR = path.resolve(
  'tmp',
  'repeat-instancing-ground-floor',
  'visual-qa-quest-exact',
)

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

async function decodedRgba(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, info }
}

function compare(reference, candidate) {
  const { width, height, channels } = reference.info
  if (
    candidate.info.width !== width ||
    candidate.info.height !== height ||
    candidate.info.channels !== channels
  ) {
    throw new Error(
      `Decoded dimensions differ: ${width}x${height}x${channels} versus ` +
      `${candidate.info.width}x${candidate.info.height}x${candidate.info.channels}`,
    )
  }

  let absoluteError = 0
  let maximumChannelDelta = 0
  let changedChannels = 0
  for (let index = 0; index < reference.data.length; index += 1) {
    const delta = Math.abs(reference.data[index] - candidate.data[index])
    absoluteError += delta
    if (delta > maximumChannelDelta) maximumChannelDelta = delta
    if (delta !== 0) changedChannels += 1
  }
  return {
    width,
    height,
    channels,
    decodedChannels: reference.data.length,
    meanAbsoluteError: absoluteError / reference.data.length,
    maximumChannelDelta,
    changedChannels,
    exact: changedChannels === 0,
  }
}

async function main() {
  const directory = path.resolve(argumentValue('--dir', DEFAULT_DIR))
  const referenceLabel = argumentValue('--reference', 'diagnostic')
  const candidateLabel = argumentValue('--candidate', 'spatial')
  const renderReport = JSON.parse(
    await fs.readFile(path.join(directory, 'render-report.json'), 'utf8'),
  )
  if (renderReport.schema !== 'iom-repeat-lod-blender-visual-qa-v1') {
    throw new Error(`Unexpected render report schema: ${renderReport.schema}`)
  }

  const comparisons = []
  for (const view of VIEWS) {
    const referenceFile = path.join(directory, `${referenceLabel}-${view}.png`)
    const candidateFile = path.join(directory, `${candidateLabel}-${view}.png`)
    comparisons.push({
      view,
      reference: path.basename(referenceFile),
      candidate: path.basename(candidateFile),
      metrics: compare(
        await decodedRgba(referenceFile),
        await decodedRgba(candidateFile),
      ),
    })
  }

  const failures = comparisons
    .filter(({ metrics }) => !metrics.exact)
    .map(({ view, metrics }) =>
      `${view}: ${metrics.changedChannels} changed channels, max delta ${metrics.maximumChannelDelta}`,
    )
  const report = {
    schema: 'iom-ground-floor-repeat-instancing-render-parity-v1',
    status: failures.length ? 'failed' : 'passed',
    scope: 'Quest whole-family parity diagnostic versus Quest parity/cell spatial pilot; exact geometry/material/transform control.',
    renderer: renderReport.renderer,
    resolution: renderReport.resolution,
    referenceLabel,
    candidateLabel,
    views: VIEWS,
    exactDecodedPixelRequirement: true,
    comparisons,
    failures,
  }
  await fs.writeFile(
    path.join(directory, 'exact-comparison.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  )

  console.log(
    `Ground Floor repeat render parity: ${report.status.toUpperCase()} ` +
    `(${comparisons.length} views, ${failures.length} failures)`,
  )
  for (const { view, metrics } of comparisons) {
    console.log(
      `  ${view}: MAE ${metrics.meanAbsoluteError}; max ${metrics.maximumChannelDelta}; ` +
      `changed ${metrics.changedChannels}/${metrics.decodedChannels}`,
    )
  }
  if (failures.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
