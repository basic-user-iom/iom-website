#!/usr/bin/env node

/** Build the isolated, disabled Web row-HLOD asset and its seven-view evidence. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', 'repeat-cluster-hlod-v3')
const DEFAULT_INPUT = resolve(VIEWER_ROOT, 'tmp', 'repeat-lod-ground-floor', 'Mesh.13786-near-source.glb')
const DEFAULT_BASELINE = resolve(VIEWER_ROOT, 'tmp', 'repeat-geometry-release-candidate', 'payloads', 'web', 'ground-floor-repeat-lod0.glb')
const DEFAULT_BLENDER = 'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe'
const EXPECTED_SOURCE_BYTES = 1_744_016
const EXPECTED_SOURCE_SHA256 = '5e825834692b57e85dc09f7cb48d956815c3c6a7cee1ab8c35e9c3b92a345efe'

function parseArgs(argv) {
  const args = {
    out: DEFAULT_OUT,
    input: DEFAULT_INPUT,
    baseline: DEFAULT_BASELINE,
    blender: process.env.IOM_BLENDER || DEFAULT_BLENDER,
    ratio: 0.03,
    maxTriangles: 2_000,
    resolution: 960,
  }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--out') args.out = resolve(argv[++index])
    else if (value === '--input') args.input = resolve(argv[++index])
    else if (value === '--baseline') args.baseline = resolve(argv[++index])
    else if (value === '--blender') args.blender = resolve(argv[++index])
    else if (value === '--ratio') args.ratio = Number(argv[++index])
    else if (value === '--max-triangles') args.maxTriangles = Number(argv[++index])
    else if (value === '--resolution') args.resolution = Number(argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableValue(child)]))
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}

const stableStringify = (value) => JSON.stringify(stableValue(value))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sha256File = async (path) => sha256(await readFile(path))

function assertSafeOut(out) {
  const root = resolve(VIEWER_ROOT, 'tmp')
  const value = resolve(out)
  assert.ok(value.startsWith(`${root}${sep}`), 'output must stay below building-viewer/tmp')
  assert.notEqual(value, root)
}

async function run(command, argv, label) {
  await new Promise((accept, reject) => {
    const child = spawn(command, argv, { cwd: VIEWER_ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) accept()
      else reject(new Error(`${label} exited ${code}\n${stdout.slice(-6000)}\n${stderr.slice(-6000)}`))
    })
  })
}

export function validateClusterHlodCandidate(index) {
  const errors = []
  const gate = (condition, message) => { if (!condition) errors.push(message) }
  gate(index?.schema === 'IOM_GROUND_REPEAT_CLUSTER_HLOD_CANDIDATE_V3' && index?.version === 3, 'schema/version mismatch')
  gate(index?.enabled === false && index?.ready === false && index?.runtimeIntegrated === false && index?.activationApproved === false,
    'candidate must remain disabled')
  gate(index?.productionManifestChanged === false && index?.productionRoutingChanged === false, 'production mutation flags changed')
  gate(index?.scope?.variant === 'web' && index?.scope?.questChanged === false, 'scope must remain Web-only')
  gate(index?.source?.triangles === 61_269, 'source triangle pin changed')
  gate(index?.source?.bytes === EXPECTED_SOURCE_BYTES && index?.source?.sha256 === EXPECTED_SOURCE_SHA256,
    'source byte/SHA-256 pin changed')
  gate(Number.isSafeInteger(index?.output?.triangles) && index.output.triangles > 0 && index.output.triangles <= index.output.maxTriangles,
    'output triangle ceiling failed')
  gate(index?.output?.materialNames?.length === 4 && index.output.trianglesByMaterial.every((value) => value > 0),
    'four material roles were not retained')
  gate(/^[a-f0-9]{64}$/.test(index?.output?.asset?.sha256 ?? '') && index?.output?.asset?.bytes > 0, 'output asset pin invalid')
  gate(index?.gates?.manualArchitecturalApproval === false,
    'generated candidate must not imply manual architectural approval')
  gate(index?.visual?.manualReviewCompleted === false && index?.visual?.manualReviewResult === 'pending',
    'manual visual gate must remain pending in generated evidence')
  gate(index?.visual?.diagnosticOnly === true && index?.visual?.exactSelectorWitnessRendered === false,
    'aggregate visual evidence must remain diagnostic-only')
  gate(index?.gates?.geometryBudgetPassed === true, 'geometry budget gate failed')
  gate(index?.gates?.sourcePinned === true, 'source pin gate failed')
  gate(index?.gates?.productionUnchanged === true && index?.gates?.questUnchanged === true, 'production/Quest safety gate failed')
  gate(index?.gates?.activationApproved === false, 'activation must remain blocked')
  return errors
}

function markdown(index) {
  return `# Ground Floor repeat cluster-HLOD v3 candidate\n\n` +
    `Status: **${index.status}**. The candidate is Web-only, disabled, and not runtime-integrated.\n\n` +
    `The DCC pass reduces the shared row from ${index.source.triangles.toLocaleString('en-US')} to ` +
    `${index.output.triangles.toLocaleString('en-US')} triangles. It retains the four authored material roles and ` +
    `is intended only for the far Web tier. Web LOD0, every Quest payload, v2 evidence, and production routing are unchanged.\n\n` +
    `Seven-view automated result: **${index.visual.automatedPassed ? 'pass' : 'blocked'}** ` +
    `(${index.visual.failureCount} failures). Manual architectural approval remains pending even after an automated pass.\n\n` +
    `This artifact is an input to the separate spatial v3 builder. It is not an activation artifact.\n`
}

async function main() {
  const args = parseArgs(process.argv)
  assertSafeOut(args.out)
  assert.ok(Number.isFinite(args.ratio) && args.ratio > 0 && args.ratio < 1)
  assert.ok(Number.isSafeInteger(args.maxTriangles) && args.maxTriangles > 0)
  assert.ok(Number.isSafeInteger(args.resolution) && args.resolution >= 360)
  await stat(args.blender)
  await stat(args.input)
  await stat(args.baseline)
  await rm(args.out, { recursive: true, force: true })
  const dccDir = resolve(args.out, 'dcc')
  const visualDir = resolve(args.out, 'visual-qa')
  await mkdir(dccDir, { recursive: true })
  const output = resolve(dccDir, 'web-row-cluster-hlod-v3.glb')
  const dccReport = resolve(dccDir, 'blender-report.json')
  const composed = resolve(args.out, 'visual-input', 'web-full-repeat-cluster-hlod-v3.glb')
  const compositionReport = resolve(args.out, 'visual-input', 'composition-report.json')
  await run(args.blender, [
    '--background',
    '--python', resolve(SCRIPT_DIR, 'blender-build-ground-floor-repeat-cluster-hlod-v3.py'),
    '--', '--input', args.input, '--output', output, '--report', dccReport,
    '--ratio', String(args.ratio), '--max-triangles', String(args.maxTriangles),
  ], 'cluster-HLOD DCC build')
  await run(process.execPath, [
    resolve(SCRIPT_DIR, 'compose-ground-floor-repeat-cluster-hlod-v3.mjs'),
    '--baseline', args.baseline, '--proxy', output, '--output', composed, '--report', compositionReport,
  ], 'cluster-HLOD exact 78-instance visual composition')
  await run(args.blender, [
    '--background',
    '--python', resolve(SCRIPT_DIR, 'blender-render-repeat-lod-qa.py'),
    '--', '--input', `near=${args.baseline}`, '--input', `mid=${composed}`, '--input', `far=${composed}`,
    '--output', visualDir, '--resolution', String(args.resolution),
  ], 'cluster-HLOD seven-view render')
  await run(process.execPath, [
    resolve(SCRIPT_DIR, 'audit-ground-floor-repeat-cluster-hlod-v3.mjs'),
    '--dir', visualDir, '--dcc-report', dccReport, '--composition-report', compositionReport,
  ], 'cluster-HLOD visual audit')

  const [inputBytes, dccBytes, visualBytes] = await Promise.all([
    readFile(args.input), readFile(dccReport), readFile(resolve(visualDir, 'visual-approval.json')),
  ])
  const dcc = JSON.parse(dccBytes)
  const visual = JSON.parse(visualBytes)
  assert.equal(inputBytes.length, EXPECTED_SOURCE_BYTES, 'source byte pin changed')
  assert.equal(sha256(inputBytes), EXPECTED_SOURCE_SHA256, 'source SHA-256 pin changed')
  assert.equal(dcc.input.bytes, EXPECTED_SOURCE_BYTES, 'DCC source byte pin changed')
  assert.equal(dcc.input.sha256, EXPECTED_SOURCE_SHA256, 'DCC source SHA-256 pin changed')
  const index = {
    schema: 'IOM_GROUND_REPEAT_CLUSTER_HLOD_CANDIDATE_V3',
    version: 3,
    status: visual.automatedPassed ? 'geometry-budget-pass-manual-visual-review-required' : 'geometry-budget-pass-visual-blocked',
    enabled: false,
    ready: false,
    runtimeIntegrated: false,
    activationApproved: false,
    productionManifestChanged: false,
    productionRoutingChanged: false,
    scope: { modelId: 'icm-anim-2025', owner: 'Ground Floor._anim1', variant: 'web', questChanged: false },
    source: {
      path: relative(args.out, args.input).replaceAll('\\', '/'),
      bytes: inputBytes.length,
      sha256: sha256(inputBytes),
      mesh: 'Mesh.13786',
      logicalInstances: 78,
      materialSlots: 4,
      triangles: 61_269,
    },
    output: {
      asset: { path: relative(args.out, output).replaceAll('\\', '/'), bytes: dcc.output.bytes, sha256: dcc.output.sha256 },
      report: { path: relative(args.out, dccReport).replaceAll('\\', '/'), bytes: dccBytes.length, sha256: sha256(dccBytes) },
      ratio: dcc.ratio,
      maxTriangles: dcc.maxTriangles,
      triangles: dcc.trianglesAfter,
      trianglesByMaterial: dcc.trianglesByMaterialAfter,
      materialNames: dcc.materialNames,
      bounds: dcc.boundsAfter,
      containsAnimations: dcc.containsAnimations,
      containsCameras: dcc.containsCameras,
      containsLights: dcc.containsLights,
    },
    visual: {
      path: relative(args.out, resolve(visualDir, 'visual-approval.json')).replaceAll('\\', '/'),
      bytes: visualBytes.length,
      sha256: sha256(visualBytes),
      automatedPassed: visual.automatedPassed,
      diagnosticOnly: visual.activationUse === 'diagnostic-only',
      exactSelectorWitnessRendered: visual.exactSelectorWitnessRendered === true,
      failureCount: visual.failures.length,
      manualReviewCompleted: visual.manualReview.completed,
      manualReviewResult: visual.manualReview.result,
    },
    gates: {
      failClosed: true,
      sourcePinned: dcc.input.sha256 === sha256(inputBytes) && dcc.input.bytes === inputBytes.length,
      geometryBudgetPassed: dcc.trianglesAfter <= dcc.maxTriangles,
      fourMaterialRolesRetained: dcc.trianglesByMaterialAfter.length === 4 && dcc.trianglesByMaterialAfter.every((value) => value > 0),
      sevenViewAutomatedPassed: visual.automatedPassed,
      exactSelectorWitnessVisualPassed: false,
      manualArchitecturalApproval: false,
      productionUnchanged: true,
      questUnchanged: true,
      activationApproved: false,
    },
  }
  index.reproducibilityDigestSha256 = sha256(Buffer.from(stableStringify({
    source: index.source,
    output: index.output,
    visual: index.visual,
      gates: index.gates,
  })))
  const errors = validateClusterHlodCandidate(index)
  assert.deepEqual(errors, [], errors.join('\n'))
  await Promise.all([
    writeFile(resolve(args.out, 'candidate-index.json'), `${JSON.stringify(index, null, 2)}\n`),
    writeFile(resolve(args.out, 'README.md'), markdown(index)),
  ])
  console.log(`Ground repeat cluster-HLOD v3: ${index.status.toUpperCase()}`)
  console.log(`  ${index.source.triangles.toLocaleString()} -> ${index.output.triangles.toLocaleString()} triangles`)
  console.log(`  seven-view failures=${index.visual.failureCount}; manual=pending; production unchanged`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
})
