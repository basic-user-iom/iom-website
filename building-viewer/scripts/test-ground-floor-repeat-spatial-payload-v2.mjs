#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRepeatSpatialV2Index } from './build-ground-floor-repeat-spatial-payload-v2.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const OUT = resolve(VIEWER_ROOT, 'tmp', 'repeat-spatial-payload-v2')
const INDEX = resolve(OUT, 'index.json')

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const json = async (path) => JSON.parse(await readFile(path, 'utf8'))
const clone = (value) => structuredClone(value)

function expectInvalid(source, mutate, pattern, label) {
  const value = clone(source)
  mutate(value)
  const errors = validateRepeatSpatialV2Index(value)
  assert.ok(errors.length > 0, `${label}: unsafe mutation passed`)
  assert.match(errors.join('\n'), pattern, `${label}: wrong failure`)
}

const [index, audit, manifest, handoff] = await Promise.all([
  json(INDEX),
  json(resolve(OUT, 'physical-audit.json')),
  json(resolve(OUT, 'manifest-v3-fragment.disabled.json')),
  json(resolve(OUT, 'visual-qa-handoff.json')),
])

assert.deepEqual(validateRepeatSpatialV2Index(index), [])
assert.equal(index.ready, false)
assert.equal(index.activationApproved, false)
assert.equal(index.runtimeIntegrated, false)
assert.equal(index.productionManifestChanged, false)
assert.equal(index.productionRoutingChanged, false)
assert.equal(index.ownership.logicalInstances, 78)
assert.equal(index.ownership.materialSlots, 4)
assert.equal(index.ownership.primitiveInstances, 312)
assert.ok(index.packageCount > 0 && index.packageCount < 78)
assert.ok(index.maxLogicalInstancesPerPackage <= 2)
assert.equal(index.adaptivePlanning.initialPackageCount, 41)
assert.equal(index.adaptivePlanning.finalPackageCount, index.packageCount)
assert.equal(index.adaptivePlanning.splitCount, index.packageCount - index.adaptivePlanning.initialPackageCount)

assert.equal(audit.schema, 'IOM_GROUND_REPEAT_SPATIAL_PHYSICAL_AUDIT_V2')
assert.equal(audit.status, 'PASS')
assert.equal(audit.ready, false)
assert.equal(audit.activationApproved, false)
assert.deepEqual(audit.contractErrors, [])
assert.equal(audit.packageCount, index.packageCount)
assert.equal(audit.payloadCount, index.physicalTotals.payloadCount)
assert.equal(audit.reproducibilityDigestSha256, index.reproducibilityDigestSha256)
const indexBytes = await readFile(INDEX)
assert.equal(audit.index.path, 'index.json')
assert.equal(audit.index.bytes, indexBytes.length)
assert.equal(audit.index.sha256, sha256(indexBytes))
assert.equal(audit.index.reproducibilityDigestSha256, index.reproducibilityDigestSha256)

assert.equal(manifest.schema, 'IOM_GROUND_REPEAT_SPATIAL_MANIFEST_V3_FRAGMENT')
assert.equal(manifest.version, 2)
assert.equal(manifest.enabled, false)
assert.equal(manifest.ready, false)
assert.equal(manifest.runtimeIntegrated, false)
assert.equal(manifest.activationApproved, false)
assert.equal(manifest.packages.length, index.packageCount)
assert.equal(handoff.schema, 'IOM_GROUND_REPEAT_SPATIAL_VISUAL_QA_HANDOFF_V2')
assert.equal(handoff.productionActivationApproved, false)
assert.equal(handoff.pinnedApproval.sha256, index.visualApproval.sha256)
assert.deepEqual(handoff.views, ['front', 'back', 'left', 'right', 'top', 'bottom', 'grazing'])

const payloadFiles = []
const logicalIds = []
const totals = {
  web: { lod0: { triangles: 0, draws: 0, bytes: 0 }, hlod: { triangles: 0, draws: 0, bytes: 0 } },
  quest: { lod0: { triangles: 0, draws: 0, bytes: 0 } },
}
for (const pkg of index.packages) {
  logicalIds.push(...pkg.sourceIds)
  assert.equal(new Set(pkg.sourceIds).size, pkg.sourceIds.length)
  assert.equal(pkg.sourcePaths.length, pkg.sourceIds.length)
  assert.ok(pkg.sourceIds.length >= 1 && pkg.sourceIds.length <= 2)
  for (const variant of ['web', 'quest']) {
    const expectedLevels = variant === 'web' ? ['hlod', 'lod0'] : ['lod0']
    assert.deepEqual(Object.keys(pkg.variants[variant].levels).sort(), expectedLevels)
    const fragment = manifest.packages.find((entry) => entry.id === pkg.id)
    assert.ok(fragment)
    assert.equal(fragment.ownerId, index.owner.id)
    assert.deepEqual(fragment.sourcePaths[variant], pkg.sourcePaths)
    for (const [level, payload] of Object.entries(pkg.variants[variant].levels)) {
      const file = resolve(OUT, payload.asset.path)
      const bytes = await readFile(file)
      const fileStat = await stat(file)
      assert.equal(fileStat.size, payload.asset.bytes, `${pkg.id}:${variant}:${level} byte pin`)
      assert.equal(sha256(bytes), payload.asset.sha256, `${pkg.id}:${variant}:${level} hash pin`)
      assert.equal(payload.estimates.bytes, payload.asset.bytes)
      assert.equal(payload.estimates.draws, 4)
      assert.ok(payload.estimates.triangles <= index.policy.maxDetailTriangles)
      assert.equal(payload.estimates.encodedTextureBytes, 0)
      assert.equal(payload.estimates.gpuTextureBytes, 0)
      assert.equal(payload.audit.logicalInstances, pkg.sourceIds.length)
      assert.equal(payload.audit.primitiveInstances, pkg.sourceIds.length * 4)
      assert.equal(payload.audit.unsafeLocalMatrices, 0)
      assert.equal(payload.audit.textureMemory.textureCount, 0)
      assert.equal(payload.audit.materials.length, 4)
      assert.equal(payload.audit.attributes.length, 4)
      assert.ok(payload.audit.attributes.every((entry) => entry.contract.some((attribute) => attribute.semantic === 'POSITION')))
      assert.equal(fragment.variants[variant][level].sha256, payload.asset.sha256)
      assert.equal(fragment.variants[variant][level].estimates.triangles, payload.estimates.triangles)
      totals[variant][level].triangles += payload.estimates.triangles
      totals[variant][level].draws += payload.estimates.draws
      totals[variant][level].bytes += payload.asset.bytes
      payloadFiles.push(payload.asset.path)
    }
  }
}
logicalIds.sort((left, right) => left - right)
assert.deepEqual(logicalIds, Array.from({ length: 78 }, (_, index) => index))
assert.equal(new Set(payloadFiles).size, payloadFiles.length)
assert.equal(payloadFiles.length, index.packageCount * 3)
assert.equal(payloadFiles.length, index.physicalTotals.payloadCount)
assert.equal(payloadFiles.reduce((sum, path) => {
  for (const variant of ['web', 'quest']) for (const payload of Object.values(
    index.packages.find((pkg) => Object.values(pkg.variants[variant].levels).some((entry) => entry.asset.path === path))?.variants[variant].levels ?? {},
  )) if (payload.asset.path === path) return sum + payload.asset.bytes
  return sum
}, 0), index.physicalTotals.glbBytes)

assert.equal(totals.web.lod0.triangles, 4_778_982)
assert.equal(totals.web.hlod.triangles, 3_810_534)
assert.equal(totals.quest.lod0.triangles, 1_711_398)
assert.equal(totals.web.lod0.draws, index.packageCount * 4)
assert.equal(totals.web.hlod.draws, index.packageCount * 4)
assert.equal(totals.quest.lod0.draws, index.packageCount * 4)
assert.deepEqual(index.levelTotals.web.lod0, {
  payloadCount: index.packageCount,
  logicalInstances: 78,
  primitiveInstances: 312,
  sourceIdsSha256: index.ownership.sourceIdsSha256,
  triangles: 4_778_982,
  draws: index.packageCount * 4,
  glbBytes: totals.web.lod0.bytes,
  encodedTextureBytes: 0,
  gpuTextureBytes: 0,
})
assert.equal(index.levelTotals.web.hlod.logicalInstances, 78)
assert.equal(index.levelTotals.web.hlod.primitiveInstances, 312)
assert.equal(index.levelTotals.web.hlod.triangles, 3_810_534)
assert.equal(index.levelTotals.quest.lod0.logicalInstances, 78)
assert.equal(index.levelTotals.quest.lod0.primitiveInstances, 312)
assert.equal(index.levelTotals.quest.lod0.triangles, 1_711_398)
assert.deepEqual(audit.levelTotals, index.levelTotals)
assert.equal(index.baselineComposite.web.lod0.exact, true)
assert.equal(index.baselineComposite.web.hlod.exact, true)
assert.equal(index.baselineComposite.quest.lod0.exact, true)
assert.equal(index.baselineComposite.web.lod0.contentDigestSha256, index.baselineComposite.web.lod0.compositeDigestSha256)
assert.equal(index.baselineComposite.web.hlod.contentDigestSha256, index.baselineComposite.web.hlod.compositeDigestSha256)
assert.equal(index.baselineComposite.quest.lod0.contentDigestSha256, index.baselineComposite.quest.lod0.compositeDigestSha256)

for (const variant of ['web', 'quest']) {
  const windows = index.residentWindows[variant]
  assert.equal(windows.entry.passed, true)
  assert.equal(windows.exitUpperEnvelope.passed, true)
  assert.equal(windows.loadBeforeRetirePeak.passed, true)
  assert.ok(windows.entry.budget.triangles.value <= index.policy.hardBudgets.resident[variant].triangles)
  assert.ok(windows.exitUpperEnvelope.budget.triangles.value <= index.policy.hardBudgets.resident[variant].triangles)
  assert.ok(windows.loadBeforeRetirePeak.budget.triangles.value <= index.policy.hardBudgets.transitionPeak[variant].triangles)
}

const approvalBytes = await readFile(resolve(OUT, index.visualApproval.path))
assert.equal(approvalBytes.length, index.visualApproval.bytes)
assert.equal(sha256(approvalBytes), index.visualApproval.sha256)
assert.equal(index.visualApproval.approvedMidViews.length, 7)
assert.equal(index.gates.questMidExcludedNoSaving, true)
assert.ok(index.packages.every((pkg) => !pkg.variants.quest.levels.hlod))

expectInvalid(index, (value) => { value.enabled = true }, /candidate must remain disabled/, 'enable flag')
expectInvalid(index, (value) => { value.ready = true }, /candidate must remain disabled/, 'ready flag')
expectInvalid(index, (value) => { value.productionRoutingChanged = true }, /production mutation/, 'production routing')
expectInvalid(index, (value) => {
  value.packages.at(-1).sourceIds[0] = value.packages[0].sourceIds[0]
}, /logical source ownership/, 'duplicate source ownership')
expectInvalid(index, (value) => { delete value.packages[0].variants.quest.levels.lod0 }, /selectable level set/, 'missing Quest exact')
expectInvalid(index, (value) => {
  value.packages[0].variants.quest.levels.hlod = clone(value.packages[0].variants.web.levels.hlod)
}, /selectable level set|Quest HLOD/, 'Quest zero-saving HLOD')
expectInvalid(index, (value) => {
  value.packages[0].variants.web.levels.lod0.estimates.triangles = value.policy.maxDetailTriangles + 1
}, /detail triangle cap/, 'detail triangle cap')
expectInvalid(index, (value) => {
  value.packages[0].variants.web.levels.lod0.asset.sha256 = '0'
}, /bad hash/, 'payload hash')
expectInvalid(index, (value) => {
  value.packages[0].variants.web.levels.lod0.audit.unsafeLocalMatrices = 1
}, /unsafe local matrix/, 'negative determinant')
expectInvalid(index, (value) => {
  value.packages[0].variants.web.levels.lod0.audit.primitiveInstances += 1
}, /primitive-instance ownership/, 'primitive-instance ownership')
expectInvalid(index, (value) => { value.gates.spatialResidentAndPeakBudgets = false }, /spatial resident\/peak/, 'spatial gate')
expectInvalid(index, (value) => { value.residentWindows.web.exitUpperEnvelope.passed = false }, /web: exit budget/, 'exit budget')

console.log('Ground repeat spatial payload v2 tests: PASS')
console.log(`  ${index.packageCount} packages / ${payloadFiles.length} pinned GLBs / exact 78 x 4 ownership`)
console.log(`  Web exit ${index.residentWindows.web.exitUpperEnvelope.budget.triangles.value.toLocaleString()} / 2,000,000 triangles`)
console.log(`  Web peak ${index.residentWindows.web.loadBeforeRetirePeak.budget.triangles.value.toLocaleString()} / 2,500,000 triangles`)
console.log(`  Quest exit/peak ${index.residentWindows.quest.exitUpperEnvelope.budget.triangles.value.toLocaleString()} / 800,000 triangles`)
console.log('  ready=false; activationApproved=false; production unchanged')
