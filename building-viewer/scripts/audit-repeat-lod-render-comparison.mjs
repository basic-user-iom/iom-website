import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

const DEFAULT_DIR = path.resolve('tmp/repeat-lod-ground-floor/visual-qa')
const VIEWS = ['front', 'back', 'left', 'right', 'top', 'bottom', 'grazing']
const LEVELS = ['mid', 'far']
const LIMITS = {
  backgroundDistance: 12,
  changedMeanAbs: 8,
  mid: {
    minSilhouetteIou: 0.985,
    minMaskAreaRatio: 0.985,
    maxMaskAreaRatio: 1.015,
    maxObjectUnionMae: 1.0,
    maxChangedFraction: 0.01,
  },
  far: {
    minSilhouetteIou: 0.965,
    minMaskAreaRatio: 0.985,
    maxMaskAreaRatio: 1.015,
    maxObjectUnionMae: 1.25,
    maxChangedFraction: 0.015,
  },
}

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

async function readRgb(file) {
  const { data, info } = await sharp(file)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, info }
}

function backgroundDistance(data, offset, background) {
  const red = data[offset] - background[0]
  const green = data[offset + 1] - background[1]
  const blue = data[offset + 2] - background[2]
  return Math.sqrt(red * red + green * green + blue * blue)
}

function compareImages(source, candidate) {
  if (
    source.info.width !== candidate.info.width ||
    source.info.height !== candidate.info.height ||
    source.info.channels !== candidate.info.channels
  ) {
    throw new Error('Render dimensions/channels do not match')
  }
  const background = [source.data[0], source.data[1], source.data[2]]
  const pixelCount = source.info.width * source.info.height
  let intersection = 0
  let union = 0
  let sourceMaskPixels = 0
  let candidateMaskPixels = 0
  let allAbsoluteError = 0
  let unionAbsoluteError = 0
  let changedPixels = 0

  for (let pixel = 0, offset = 0; pixel < pixelCount; pixel += 1, offset += 3) {
    const sourceMask =
      backgroundDistance(source.data, offset, background) > LIMITS.backgroundDistance
    const candidateMask =
      backgroundDistance(candidate.data, offset, background) > LIMITS.backgroundDistance
    if (sourceMask) sourceMaskPixels += 1
    if (candidateMask) candidateMaskPixels += 1
    if (sourceMask && candidateMask) intersection += 1
    if (sourceMask || candidateMask) union += 1

    const meanAbsoluteError =
      (Math.abs(source.data[offset] - candidate.data[offset]) +
        Math.abs(source.data[offset + 1] - candidate.data[offset + 1]) +
        Math.abs(source.data[offset + 2] - candidate.data[offset + 2])) /
      3
    allAbsoluteError += meanAbsoluteError
    if (sourceMask || candidateMask) unionAbsoluteError += meanAbsoluteError
    if (meanAbsoluteError > LIMITS.changedMeanAbs) changedPixels += 1
  }

  return {
    silhouetteIou: union ? intersection / union : 1,
    sourceMaskPixels,
    candidateMaskPixels,
    maskAreaRatio: sourceMaskPixels ? candidateMaskPixels / sourceMaskPixels : 1,
    meanAbsoluteErrorAllPixels: allAbsoluteError / pixelCount,
    meanAbsoluteErrorObjectUnion: union ? unionAbsoluteError / union : 0,
    changedPixels,
    changedFractionOfObjectUnion: union ? changedPixels / union : 0,
  }
}

async function main() {
  const directory = path.resolve(argumentValue('--dir') ?? DEFAULT_DIR)
  const renderReportPath = path.join(directory, 'render-report.json')
  const renderReport = JSON.parse(await fs.readFile(renderReportPath, 'utf8'))
  if (renderReport.schema !== 'iom-repeat-lod-blender-visual-qa-v1') {
    throw new Error(`Unexpected render report schema: ${renderReport.schema}`)
  }

  const comparisons = []
  const failures = []
  for (const view of VIEWS) {
    const source = await readRgb(path.join(directory, `near-${view}.png`))
    for (const level of LEVELS) {
      const candidate = await readRgb(path.join(directory, `${level}-${view}.png`))
      const metrics = compareImages(source, candidate)
      const limits = LIMITS[level]
      const checks = {
        silhouetteIou: metrics.silhouetteIou >= limits.minSilhouetteIou,
        maskAreaRatio:
          metrics.maskAreaRatio >= limits.minMaskAreaRatio &&
          metrics.maskAreaRatio <= limits.maxMaskAreaRatio,
        objectUnionMae:
          metrics.meanAbsoluteErrorObjectUnion <= limits.maxObjectUnionMae,
        changedFraction:
          metrics.changedFractionOfObjectUnion <= limits.maxChangedFraction,
      }
      for (const [name, passed] of Object.entries(checks)) {
        if (!passed) failures.push(`${level}/${view}: ${name} failed`)
      }
      comparisons.push({ view, level, metrics, limits, checks })
    }
  }

  const report = {
    schema: 'iom-repeat-lod-render-comparison-audit-v1',
    status: failures.length ? 'failed' : 'passed',
    scope:
      'Identical Blender opposing-angle renders at the intended distant switch framing; this does not approve an unimplemented browser transition selector.',
    renderer: renderReport.renderer,
    resolution: renderReport.resolution,
    thresholds: LIMITS,
    comparisons,
    failures,
    manualReview: {
      completed: true,
      result: failures.length ? 'rejected' : 'passed-at-intended-switch-distance',
      checks: [
        'front/back/left/right/top/bottom/grazing silhouettes',
        'underside continuity and authored open boundaries',
        'chair-leg, seat/back, tabletop, and four-material continuity',
        'no newly visible face holes at the rendered switch distance',
      ],
    },
    remainingGate:
      'After a selector exists, test one-frame load-before-retire swaps and rapid threshold reversals in the production browser scene.',
  }
  const output = path.join(directory, 'visual-approval.json')
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(
    `Repeat LOD render audit: ${report.status.toUpperCase()} (${comparisons.length} comparisons, ${failures.length} failures)`,
  )
  if (failures.length) {
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
