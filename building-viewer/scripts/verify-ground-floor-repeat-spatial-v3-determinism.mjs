#!/usr/bin/env node

/** Rebuild the disabled v3 planning audit twice and require byte identity. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const TMP_ROOT = resolve(VIEWER_ROOT, 'tmp')
const OUTPUT = resolve(TMP_ROOT, 'repeat-spatial-payload-v3')
const LEFT = resolve(TMP_ROOT, 'repeat-spatial-payload-v3-determinism-a')
const RIGHT = resolve(TMP_ROOT, 'repeat-spatial-payload-v3-determinism-b')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function assertSafe(path) {
  const value = resolve(path)
  assert.ok(value.startsWith(`${TMP_ROOT}${sep}`) && value !== TMP_ROOT)
}

async function run(out) {
  await new Promise((accept, reject) => {
    const child = spawn(process.execPath, [resolve(SCRIPT_DIR, 'audit-ground-floor-repeat-spatial-payload-v3.mjs'), '--out', out], {
      cwd: VIEWER_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? accept() : reject(new Error(`v3 audit exited ${code}\n${stdout}\n${stderr}`)))
  })
}

async function main() {
  for (const path of [OUTPUT, LEFT, RIGHT]) assertSafe(path)
  await Promise.all([rm(LEFT, { recursive: true, force: true }), rm(RIGHT, { recursive: true, force: true })])
  await Promise.all([run(LEFT), run(RIGHT)])
  const [leftIndex, rightIndex, leftAudit, rightAudit, leftReadme, rightReadme] = await Promise.all([
    readFile(resolve(LEFT, 'index.json')), readFile(resolve(RIGHT, 'index.json')),
    readFile(resolve(LEFT, 'physical-audit.json')), readFile(resolve(RIGHT, 'physical-audit.json')),
    readFile(resolve(LEFT, 'README.md')), readFile(resolve(RIGHT, 'README.md')),
  ])
  assert.deepEqual(leftIndex, rightIndex, 'v3 index is not byte-deterministic')
  assert.deepEqual(leftAudit, rightAudit, 'v3 physical audit is not byte-deterministic')
  assert.deepEqual(leftReadme, rightReadme, 'v3 README is not byte-deterministic')
  const parsed = JSON.parse(leftIndex)
  const proof = {
    schema: 'IOM_GROUND_REPEAT_SPATIAL_DETERMINISM_PROOF_V3',
    version: 3,
    status: 'PASS',
    ready: false,
    activationApproved: false,
    productionChanged: false,
    rebuildCount: 2,
    index: { bytes: leftIndex.length, sha256: sha256(leftIndex), reproducibilityDigestSha256: parsed.reproducibilityDigestSha256 },
    physicalAudit: { bytes: leftAudit.length, sha256: sha256(leftAudit) },
    readme: { bytes: leftReadme.length, sha256: sha256(leftReadme) },
  }
  await mkdir(OUTPUT, { recursive: true })
  await writeFile(resolve(OUTPUT, 'deterministic-rebuild-proof.json'), `${JSON.stringify(proof, null, 2)}\n`)
  await Promise.all([rm(LEFT, { recursive: true, force: true }), rm(RIGHT, { recursive: true, force: true })])
  console.log('Ground repeat spatial v3 determinism: PASS (two byte-identical rebuilds)')
  console.log(`  index ${proof.index.bytes} bytes / ${proof.index.sha256}`)
}

main().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
})
