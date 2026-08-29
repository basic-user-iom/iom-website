#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const OUT = resolve(VIEWER_ROOT, 'tmp', 'repeat-spatial-payload-v2')
const INDEX = resolve(OUT, 'index.json')
const BUILDER = resolve(SCRIPT_DIR, 'build-ground-floor-repeat-spatial-payload-v2.mjs')

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const json = async (path) => JSON.parse(await readFile(path, 'utf8'))

function payloadPins(index) {
  return index.packages.flatMap((pkg) => ['web', 'quest'].flatMap((variant) =>
    Object.entries(pkg.variants[variant].levels).map(([level, payload]) => ({
      packageId: pkg.id,
      variant,
      level,
      path: payload.asset.path,
      bytes: payload.asset.bytes,
      sha256: payload.asset.sha256,
      contentDigestSha256: payload.audit.contentDigestSha256,
    })))).sort((left, right) =>
    left.packageId.localeCompare(right.packageId) ||
    left.variant.localeCompare(right.variant) ||
    left.level.localeCompare(right.level))
}

function structuralRecord(index) {
  return {
    source: index.source,
    visualApproval: index.visualApproval,
    policy: index.policy,
    adaptivePlanning: index.adaptivePlanning,
    ownership: index.ownership,
    levelTotals: index.levelTotals,
    packageIdsAndSources: index.packages.map((pkg) => ({
      id: pkg.id,
      parity: pkg.parity,
      spatialCell: pkg.spatialCell,
      sourceIds: pkg.sourceIds,
      sourcePaths: pkg.sourcePaths,
    })),
    residentWindows: index.residentWindows,
    physicalTotals: index.physicalTotals,
    baselineComposite: index.baselineComposite,
    payloadPins: payloadPins(index),
  }
}

const before = await json(INDEX)
assert.equal(before.schema, 'IOM_GROUND_REPEAT_SPATIAL_PAYLOAD_V2')
const beforeRecord = structuralRecord(before)
const beforeSha256 = sha256(JSON.stringify(beforeRecord))

await new Promise((accept, reject) => {
  const child = spawn(process.execPath, [BUILDER], {
    cwd: VIEWER_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.on('error', reject)
  child.on('exit', (code) => {
    if (code === 0) accept()
    else reject(new Error(`repeat spatial v2 rebuild exited ${code}\n${stdout.slice(-4000)}\n${stderr.slice(-4000)}`))
  })
})

const after = await json(INDEX)
const afterRecord = structuralRecord(after)
const afterSha256 = sha256(JSON.stringify(afterRecord))
assert.deepEqual(afterRecord, beforeRecord, 'physical rebuild changed structural evidence or payload pins')
assert.equal(after.reproducibilityDigestSha256, before.reproducibilityDigestSha256)
assert.equal(afterSha256, beforeSha256)

const proof = {
  schema: 'IOM_GROUND_REPEAT_SPATIAL_DETERMINISTIC_REBUILD_PROOF_V2',
  version: 2,
  status: 'PASS',
  ready: false,
  activationApproved: false,
  productionChanged: false,
  comparedPhysicalPayloads: payloadPins(after).length,
  first: {
    reproducibilityDigestSha256: before.reproducibilityDigestSha256,
    structuralAndPayloadPinsSha256: beforeSha256,
  },
  second: {
    reproducibilityDigestSha256: after.reproducibilityDigestSha256,
    structuralAndPayloadPinsSha256: afterSha256,
  },
  exactMatch: true,
}
await writeFile(resolve(OUT, 'deterministic-rebuild-proof.json'), `${JSON.stringify(proof, null, 2)}\n`)
console.log(`Ground repeat spatial v2 deterministic rebuild: PASS (${proof.comparedPhysicalPayloads} GLBs)`)
console.log(`  digest=${after.reproducibilityDigestSha256}`)
