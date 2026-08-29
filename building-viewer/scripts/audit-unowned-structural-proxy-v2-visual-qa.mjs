/** Audit the exact finalized structural-proxy v2 GLBs in seven projections. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const OUT = resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-unowned-structural-proxy-v2')
const QA_ROOT = resolve(OUT, 'visual-qa')
const PATHS = Object.freeze({
  candidate: resolve(OUT, 'candidate-index.json'),
  ownership: resolve(OUT, 'ownership-audit-v2.json'),
  repartition: resolve(OUT, 'ownership-repartition-v2.json'),
  dependency: resolve(OUT, 'dependency-audit-v2.json'),
  topology: resolve(OUT, 'topology-audit-v2.json'),
  render: resolve(QA_ROOT, 'render-report.json'),
  output: resolve(QA_ROOT, 'projection-audit.json'),
})
const VIEWS = Object.freeze(['front', 'back', 'left', 'right', 'top', 'bottom', 'grazing'])
const VARIANTS = Object.freeze(['web', 'quest'])
const FOREGROUND_LUMA = 60
const STRONG_THRESHOLDS = Object.freeze({
  minimumSourceCoverage: 0.80,
  meanSourceCoverage: 0.88,
  minimumCandidatePrecision: 0.98,
  minimumTopSourceCoverage: 0.92,
  minimumBottomSourceCoverage: 0.85,
  minimumWebQuestShellIoU: 0.95,
})

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function relativePath(path) {
  return relative(VIEWER_ROOT, path).replaceAll('\\', '/')
}

async function fileEvidence(path) {
  const [bytes, info] = await Promise.all([readFile(path), stat(path)])
  return { path: relativePath(path), bytes: info.size, sha256: sha256(bytes) }
}

async function imageMask(path) {
  const input = await readFile(path)
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const mask = new Uint8Array(info.width * info.height)
  let pixels = 0
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * info.channels
    const luma = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722
    if (luma <= FOREGROUND_LUMA) continue
    mask[index] = 1
    pixels += 1
  }
  return { mask, pixels, width: info.width, height: info.height, sha256: sha256(input) }
}

function compareMasks(reference, candidate) {
  assert.equal(reference.width, candidate.width, 'Projection widths differ')
  assert.equal(reference.height, candidate.height, 'Projection heights differ')
  let intersection = 0
  let union = 0
  for (let index = 0; index < reference.mask.length; index += 1) {
    if (reference.mask[index] && candidate.mask[index]) intersection += 1
    if (reference.mask[index] || candidate.mask[index]) union += 1
  }
  return {
    referencePixels: reference.pixels,
    candidatePixels: candidate.pixels,
    intersectionPixels: intersection,
    referenceOnlyPixels: reference.pixels - intersection,
    candidateOnlyPixels: candidate.pixels - intersection,
    referenceCoverage: reference.pixels ? intersection / reference.pixels : 0,
    candidatePrecision: candidate.pixels ? intersection / candidate.pixels : 0,
    intersectionOverUnion: union ? intersection / union : 0,
  }
}

const [candidate, ownership, repartition, dependency, topology, renderReport] = await Promise.all([
  readFile(PATHS.candidate, 'utf8').then(JSON.parse),
  readFile(PATHS.ownership, 'utf8').then(JSON.parse),
  readFile(PATHS.repartition, 'utf8').then(JSON.parse),
  readFile(PATHS.dependency, 'utf8').then(JSON.parse),
  readFile(PATHS.topology, 'utf8').then(JSON.parse),
  readFile(PATHS.render, 'utf8').then(JSON.parse),
])
assert.equal(candidate.schema, 'IOM_UNOWNED_STRUCTURAL_PROXY_CANDIDATE')
assert.equal(candidate.version, 2)
for (const key of ['enabled', 'ready', 'activationApproved', 'runtimeIntegrated', 'productionModified', 'productionRoutingChanged']) {
  assert.equal(candidate[key], false, `Candidate ${key} must remain false`)
}
assert.equal(ownership.schema, 'IOM_UNOWNED_STRUCTURAL_PROXY_OWNERSHIP_AUDIT')
assert.equal(ownership.passed, true)
assert.deepEqual(ownership.errors, [])
assert.equal(repartition.schema, 'IOM_UNOWNED_STRUCTURAL_PROXY_REPARTITION')
assert.equal(repartition.compositionGuard.materialFidelity.materialFidelityReady, false)
assert.equal(repartition.compositionGuard.materialFidelity.nearLod0Required, true)
assert.equal(repartition.compositionGuard.materialFidelity.nearLod0PackagePresent, false)
assert.equal(repartition.compositionGuard.materialFidelity.explicitReplacementSemanticsValidated, false)
assert.equal(dependency.schema, 'IOM_UNOWNED_STRUCTURAL_PROXY_DEPENDENCY_AUDIT')
assert.equal(topology.schema, 'IOM_UNOWNED_STRUCTURAL_PROXY_TOPOLOGY_AUDIT')
assert.equal(renderReport.schema, 'iom-repeat-lod-blender-visual-qa-v1')
assert.equal(renderReport.resolution, 960)
assert.equal(renderReport.status, 'renders-generated-manual-approval-required')

const finalProxyGlbs = Object.fromEntries(await Promise.all(VARIANTS.map(async (variant) => {
  const evidence = await fileEvidence(resolve(VIEWER_ROOT, candidate.variants[variant].asset.path))
  assert.equal(evidence.bytes, candidate.variants[variant].asset.bytes, `${variant}: final GLB bytes changed`)
  assert.equal(evidence.sha256, candidate.variants[variant].asset.sha256, `${variant}: final GLB SHA changed`)
  return [variant, evidence]
})))
const expectedInputs = [
  ['web-source', candidate.variants.web.visualQaInputs.sourceStatic],
  ['web-shell', candidate.variants.web.visualQaInputs.proxy],
  ['quest-source', candidate.variants.quest.visualQaInputs.sourceStatic],
  ['quest-shell', candidate.variants.quest.visualQaInputs.proxy],
]
assert.equal(renderReport.candidates?.length, expectedInputs.length)
for (let index = 0; index < expectedInputs.length; index += 1) {
  const [label, expected] = expectedInputs[index]
  const actual = renderReport.candidates[index]
  assert.equal(actual.label, label, `Render input ${index} label changed`)
  assert.equal(actual.inputBytes, expected.bytes, `${label}: stale render byte count`)
  assert.equal(actual.inputSha256, expected.sha256, `${label}: stale render SHA`)
  for (const view of VIEWS) assert.equal(actual.renders?.[view], `${label}-${view}.png`, `${label}:${view} render missing`)
}

const sourceVsShell = { web: {}, quest: {} }
const shellVariantParity = {}
for (const variant of VARIANTS) {
  for (const view of VIEWS) {
    const [source, shell] = await Promise.all([
      imageMask(resolve(QA_ROOT, `${variant}-source-${view}.png`)),
      imageMask(resolve(QA_ROOT, `${variant}-shell-${view}.png`)),
    ])
    assert.ok(source.pixels > 0 && shell.pixels > 0, `${variant}:${view} foreground mask is empty`)
    sourceVsShell[variant][view] = {
      source: { file: `${variant}-source-${view}.png`, sha256: source.sha256 },
      shell: { file: `${variant}-shell-${view}.png`, sha256: shell.sha256 },
      ...compareMasks(source, shell),
    }
  }
}
for (const view of VIEWS) {
  const [web, quest] = await Promise.all([
    imageMask(resolve(QA_ROOT, `web-shell-${view}.png`)),
    imageMask(resolve(QA_ROOT, `quest-shell-${view}.png`)),
  ])
  shellVariantParity[view] = compareMasks(web, quest)
}

const sourceComparisons = Object.values(sourceVsShell).flatMap((variant) => Object.values(variant))
const parityComparisons = Object.values(shellVariantParity)
const summary = {
  minimumSourceCoverage: Math.min(...sourceComparisons.map((entry) => entry.referenceCoverage)),
  meanSourceCoverage: sourceComparisons.reduce((sum, entry) => sum + entry.referenceCoverage, 0) / sourceComparisons.length,
  minimumCandidatePrecision: Math.min(...sourceComparisons.map((entry) => entry.candidatePrecision)),
  minimumTopSourceCoverage: Math.min(...VARIANTS.map((variant) => sourceVsShell[variant].top.referenceCoverage)),
  minimumBottomSourceCoverage: Math.min(...VARIANTS.map((variant) => sourceVsShell[variant].bottom.referenceCoverage)),
  minimumWebQuestShellIoU: Math.min(...parityComparisons.map((entry) => entry.intersectionOverUnion)),
  meanWebQuestShellIoU: parityComparisons.reduce((sum, entry) => sum + entry.intersectionOverUnion, 0) / parityComparisons.length,
}
const thresholdResults = Object.fromEntries(Object.entries(STRONG_THRESHOLDS).map(([key, minimum]) => [key, {
  actual: summary[key], minimum, passed: summary[key] >= minimum,
}]))
const strongCoverage = Object.values(thresholdResults).every((entry) => entry.passed)
const holeRiskViews = VARIANTS.flatMap((variant) => VIEWS.map((view) => ({
  variant,
  view,
  referenceOnlyFraction: 1 - sourceVsShell[variant][view].referenceCoverage,
}))).filter((entry) => entry.referenceOnlyFraction > 0.10)
const materialFidelityReady = candidate.safety.materialFidelity.materialFidelityReady

const evidencePins = {
  candidateIndex: await fileEvidence(PATHS.candidate),
  ownershipAudit: await fileEvidence(PATHS.ownership),
  ownershipRepartition: await fileEvidence(PATHS.repartition),
  dependencyAudit: await fileEvidence(PATHS.dependency),
  topologyAudit: await fileEvidence(PATHS.topology),
  finalProxyGlbs,
  blenderRenderReport: await fileEvidence(PATHS.render),
}
assert.equal(evidencePins.ownershipRepartition.sha256, candidate.evidencePins.ownershipRepartition.sha256)
assert.equal(evidencePins.dependencyAudit.sha256, candidate.evidencePins.dependencyAudit.sha256)
assert.equal(evidencePins.topologyAudit.sha256, candidate.evidencePins.topologyAudit.sha256)

const report = {
  schema: 'IOM_UNOWNED_STRUCTURAL_PROXY_PROJECTION_AUDIT',
  version: 2,
  generatedAt: new Date().toISOString(),
  profile: { slug: 'unowned-structural-proxy-v2', owner: '__unowned__' },
  renderer: renderReport.renderer,
  resolution: renderReport.resolution,
  views: VIEWS,
  foregroundLumaThreshold: FOREGROUND_LUMA,
  enabled: false,
  evidencePins,
  exactOwnershipSafety: ownership.assertions,
  sourceVsShell,
  shellVariantParity,
  strongCoverageThresholds: STRONG_THRESHOLDS,
  thresholdResults,
  summary,
  holeRiskViews,
  strongCoverage,
  materialFidelityReady,
  releaseReady: false,
  status: strongCoverage
    ? 'machine-projection-strong-release-blocked-by-material-near-lod0-and-manual-gates'
    : 'projection-insufficient-candidate-rejected-for-activation',
  ready: false,
  activationApproved: false,
  limitation: 'Projection cannot prove manifold closure or intentional detail classification; source-owner opposing-angle review remains mandatory. Texture-free proxy output also cannot replace source PBR materials at close range.',
}
await writeFile(PATHS.output, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  output: relativePath(PATHS.output),
  finalProxyGlbs,
  blenderRenderReport: evidencePins.blenderRenderReport,
  summary,
  strongCoverage,
  materialFidelityReady,
  status: report.status,
  holeRiskViews: holeRiskViews.length,
}, null, 2))
