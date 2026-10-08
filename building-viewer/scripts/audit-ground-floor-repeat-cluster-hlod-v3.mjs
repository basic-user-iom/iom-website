#!/usr/bin/env node

/**
 * Fail-closed seven-view audit for the disabled Web repeat cluster-HLOD v3.
 * A failed comparison is valid negative evidence and does not activate or
 * delete the candidate. Use --require-pass when a CI job needs a red exit.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

const DEFAULT_DIR = path.resolve('tmp/repeat-cluster-hlod-v3/visual-qa')
const DEFAULT_DCC_REPORT = path.resolve('tmp/repeat-cluster-hlod-v3/dcc/blender-report.json')
const DEFAULT_COMPOSITION_REPORT = path.resolve('tmp/repeat-cluster-hlod-v3/visual-input/composition-report.json')
const VIEWS = ['front', 'back', 'left', 'right', 'top', 'bottom', 'grazing']
const LIMITS = Object.freeze({
  backgroundDistance: 12,
  changedMeanAbs: 8,
  minSilhouetteIou: 0.965,
  minMaskAreaRatio: 0.985,
  maxMaskAreaRatio: 1.015,
  maxObjectUnionMae: 1.25,
  maxChangedFraction: 0.015,
})

function parseArgs(argv) {
  const args = { directory: DEFAULT_DIR, dccReport: DEFAULT_DCC_REPORT, compositionReport: DEFAULT_COMPOSITION_REPORT, requirePass: false }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--dir') args.directory = path.resolve(argv[++index])
    else if (value === '--dcc-report') args.dccReport = path.resolve(argv[++index])
    else if (value === '--composition-report') args.compositionReport = path.resolve(argv[++index])
    else if (value === '--require-pass') args.requirePass = true
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

async function readRgb(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, info }
}

function backgroundDistance(data, offset, background) {
  const red = data[offset] - background[0]
  const green = data[offset + 1] - background[1]
  const blue = data[offset + 2] - background[2]
  return Math.sqrt(red * red + green * green + blue * blue)
}

function compareImages(source, candidate) {
  assert.equal(source.info.width, candidate.info.width, 'render widths differ')
  assert.equal(source.info.height, candidate.info.height, 'render heights differ')
  assert.equal(source.info.channels, candidate.info.channels, 'render channels differ')
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
    const sourceMask = backgroundDistance(source.data, offset, background) > LIMITS.backgroundDistance
    const candidateMask = backgroundDistance(candidate.data, offset, background) > LIMITS.backgroundDistance
    if (sourceMask) sourceMaskPixels += 1
    if (candidateMask) candidateMaskPixels += 1
    if (sourceMask && candidateMask) intersection += 1
    if (sourceMask || candidateMask) union += 1
    const error = (
      Math.abs(source.data[offset] - candidate.data[offset]) +
      Math.abs(source.data[offset + 1] - candidate.data[offset + 1]) +
      Math.abs(source.data[offset + 2] - candidate.data[offset + 2])
    ) / 3
    allAbsoluteError += error
    if (sourceMask || candidateMask) unionAbsoluteError += error
    if (error > LIMITS.changedMeanAbs) changedPixels += 1
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

function checksFor(metrics) {
  return {
    silhouetteIou: metrics.silhouetteIou >= LIMITS.minSilhouetteIou,
    maskAreaRatio: metrics.maskAreaRatio >= LIMITS.minMaskAreaRatio &&
      metrics.maskAreaRatio <= LIMITS.maxMaskAreaRatio,
    objectUnionMae: metrics.meanAbsoluteErrorObjectUnion <= LIMITS.maxObjectUnionMae,
    changedFraction: metrics.changedFractionOfObjectUnion <= LIMITS.maxChangedFraction,
  }
}

export async function auditClusterHlodVisuals({ directory, dccReport, compositionReport }) {
  const renderPath = path.join(directory, 'render-report.json')
  const [renderBytes, dccBytes, compositionBytes] = await Promise.all([
    fs.readFile(renderPath), fs.readFile(dccReport), fs.readFile(compositionReport),
  ])
  const render = JSON.parse(renderBytes)
  const dcc = JSON.parse(dccBytes)
  const composition = JSON.parse(compositionBytes)
  assert.equal(render.schema, 'iom-repeat-lod-blender-visual-qa-v1')
  assert.equal(dcc.schema, 'IOM_BLENDER_GROUND_REPEAT_CLUSTER_HLOD_V3')
  assert.equal(dcc.ready, false)
  assert.equal(dcc.activationApproved, false)
  assert.equal(composition.schema, 'IOM_GROUND_REPEAT_CLUSTER_HLOD_COMPOSITION_V3')
  assert.equal(composition.proxy.sha256, dcc.output.sha256, 'composition proxy differs from DCC output')
  assert.equal(composition.proxy.bytes, dcc.output.bytes, 'composition proxy byte pin differs from DCC output')
  assert.equal(composition.baselinePinVerified, true, 'composition baseline pin was not verified')
  assert.equal(composition.logicalInstances, 78, 'composition logical-instance count changed')
  assert.equal(composition.primitiveInstances, 312, 'composition primitive-instance count changed')
  assert.equal(composition.ownership?.sourceIdBijectionPassed, true, 'composition source-ID bijection failed')
  assert.deepEqual(composition.ownership?.parities, ['mirrored', 'positive'], 'composition parity coverage changed')
  assert.equal(composition.baselineOwnershipAndTransformsPreserved, true,
    'composition changed baseline ownership or transforms')
  const near = render.candidates.find((entry) => entry.label === 'near')
  const far = render.candidates.find((entry) => entry.label === 'far')
  assert.ok(near && far, 'render report must contain near and far candidates')
  assert.equal(near.inputSha256, composition.baseline.sha256, 'rendered baseline differs from composition baseline')
  assert.equal(near.inputBytes, composition.baseline.bytes, 'rendered baseline byte pin differs from composition baseline')
  assert.equal(far.inputSha256, composition.output.sha256, 'rendered candidate differs from composed output')
  assert.equal(far.inputBytes, composition.output.bytes, 'rendered candidate byte pin differs from composed output')

  const comparisons = []
  const failures = []
  for (const view of VIEWS) {
    const source = await readRgb(path.join(directory, `near-${view}.png`))
    const candidate = await readRgb(path.join(directory, `far-${view}.png`))
    const metrics = compareImages(source, candidate)
    const checks = checksFor(metrics)
    for (const [name, passed] of Object.entries(checks)) {
      if (!passed) failures.push(`${view}: ${name} failed`)
    }
    comparisons.push({ view, metrics, limits: LIMITS, checks })
  }
  const automatedPassed = failures.length === 0
  const report = {
    schema: 'IOM_GROUND_REPEAT_CLUSTER_HLOD_VISUAL_AUDIT_V3',
    version: 3,
    status: automatedPassed ? 'automated-pass-manual-review-required' : 'blocked-fail-closed',
    enabled: false,
    ready: false,
    runtimeIntegrated: false,
    activationApproved: false,
    renderer: render.renderer,
    resolution: render.resolution,
    cameraContract: 'auto-framed 78-instance aggregate diagnostic; not an exact selector-witness or switch-distance approval',
    activationUse: 'diagnostic-only',
    exactSelectorWitnessRendered: false,
    thresholds: LIMITS,
    dccReport: { path: path.relative(directory, dccReport).replaceAll('\\', '/'), bytes: dccBytes.length, sha256: sha256(dccBytes) },
    compositionReport: { path: path.relative(directory, compositionReport).replaceAll('\\', '/'), bytes: compositionBytes.length, sha256: sha256(compositionBytes) },
    renderReport: { path: 'render-report.json', bytes: renderBytes.length, sha256: sha256(renderBytes) },
    automatedPassed,
    comparisons,
    failures,
    manualReview: {
      completed: false,
      result: 'pending',
      requiredChecks: [
        'auditor diagnostic: aggregate chair-row silhouette and gaps',
        'front/back/left/right/top/bottom/grazing views',
        'four material roles, underside continuity, normals, and transition popping',
        'separate required release gate: mixed LOD0/HLOD views at exact selector witnesses and switch distances',
      ],
    },
    productionChanged: false,
  }
  const output = path.join(directory, 'visual-approval.json')
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  return report
}

const args = parseArgs(process.argv)
auditClusterHlodVisuals(args).then((report) => {
  console.log(`Ground repeat cluster-HLOD v3 visual audit: ${report.status.toUpperCase()}`)
  console.log(`  ${report.comparisons.length} views / ${report.failures.length} automated failures / manual=pending`)
  if (args.requirePass && !report.automatedPassed) process.exitCode = 1
}).catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
})
