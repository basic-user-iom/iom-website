#!/usr/bin/env node

/** Independent read-only boundary test for the disabled spatial-v3 index. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRepeatSpatialV3Index } from './audit-ground-floor-repeat-spatial-payload-v3.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const DEFAULT_INDEX = resolve(VIEWER_ROOT, 'tmp/repeat-spatial-payload-v3/index.json')
const DEFAULT_AUDIT = resolve(VIEWER_ROOT, 'tmp/repeat-spatial-payload-v3/physical-audit.json')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function parseArgs(argv) {
  const args = { index: DEFAULT_INDEX, audit: DEFAULT_AUDIT }
  for (let cursor = 2; cursor < argv.length; cursor += 1) {
    if (argv[cursor] === '--index') args.index = resolve(argv[++cursor])
    else if (argv[cursor] === '--audit') args.audit = resolve(argv[++cursor])
    else throw new Error(`Unknown argument: ${argv[cursor]}`)
  }
  return args
}

async function verifyPin(indexDir, record, label) {
  const bytes = await readFile(resolve(indexDir, record.path))
  assert.equal(bytes.length, record.bytes, `${label}: byte pin changed`)
  assert.equal(sha256(bytes), record.sha256, `${label}: SHA-256 changed`)
}

async function main() {
  const args = parseArgs(process.argv)
  const [indexBytes, auditBytes] = await Promise.all([readFile(args.index), readFile(args.audit)])
  const index = JSON.parse(indexBytes)
  const audit = JSON.parse(auditBytes)
  assert.deepEqual(validateRepeatSpatialV3Index(index), [])
  assert.equal(audit.schema, 'IOM_GROUND_REPEAT_SPATIAL_PHYSICAL_AUDIT_V3')
  assert.equal(audit.version, 3)
  assert.equal(audit.ready, false)
  assert.equal(audit.activationApproved, false)
  assert.equal(audit.index.bytes, indexBytes.length)
  assert.equal(audit.index.sha256, sha256(indexBytes))
  const indexDir = dirname(args.index)
  await Promise.all([
    verifyPin(indexDir, index.sourceV2, 'source v2 index'),
    verifyPin(indexDir, index.proxy.asset, 'proxy asset'),
    verifyPin(indexDir, index.proxy.report, 'proxy report'),
  ])
  if (index.visual.present) await verifyPin(indexDir, index.visual, 'visual audit')
  assert.equal(index.sourceV2.bytes, 1_055_119)
  assert.equal(index.sourceV2.sha256, '9ba4f70c94816eaef7d869d546bd868e09e841c5e649eb2fd117d46cd990e003')
  assert.equal(index.visual.diagnosticOnly, true)
  assert.equal(index.visual.exactSelectorWitnessRendered, false)
  assert.equal(index.sweeps.web.loadBeforeRetirePeak.maxConcurrentSamePackageSwaps, 1)
  assert.equal(index.sweeps.web.loadBeforeRetirePeak.runtimeConcurrencyEnforcementVerified, false)
  assert.equal(index.gates.composedVisualQa, false)
  assert.equal(index.gates.exactSelectorWitnessVisualQa, false)
  assert.equal(index.gates.physicalV3PackageAssembly, false)
  assert.equal(index.gates.exactEmittedBoundsResweep, false)
  assert.equal(index.gates.mixedSceneBrowserQa, false)
  assert.equal(index.gates.focusChurnQa, false)
  assert.equal(index.gates.activationApproved, false)
  console.log('Ground repeat spatial v3 boundary test: PASS (disabled planning candidate)')
  console.log(`  proxy=${index.proxy.triangles}; exit=${index.sweeps.web.exitUpperEnvelope.worst.triangles}; negative=${index.negativeMutation.exitTriangles}`)
}

main().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
})
