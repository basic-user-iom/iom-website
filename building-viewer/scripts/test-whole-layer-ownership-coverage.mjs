import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildWholeLayerOwnershipContract,
  claimsFromOwnerLocalPilot,
  createCompleteOwnerClaims,
  refreshWholeLayerContractDigests,
  validateWholeLayerOwnershipContract,
  validateWholeLayerPackageClaims,
  verifyWholeLayerOwnershipSources,
} from './lib/whole-layer-ownership-contract.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const REPOSITORY_ROOT = resolve(VIEWER_ROOT, '..')
const MODEL_ROOT = resolve(REPOSITORY_ROOT, 'public', 'models', 'icm-anim-2025')
const FIRST_FLOOR_INDEX = resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-first-floor-shell-candidate', 'detail-package-index.json')
const SOURCE_FILES = {
  web: resolve(MODEL_ROOT, 'model-web.glb'),
  quest: resolve(MODEL_ROOT, 'model-quest.glb'),
}
const EXPECTED = {
  web: {
    bytes: 97_549_356,
    sha256: 'b96cf36f64a03d16047e3ff26aa93131481f636c184df80b5c7ea2032e4cb5e8',
    nodes: 2_460,
    instances: 5_122,
    units: 6_415,
    triangles: 13_585_615,
    draws: 3_753,
    firstFloorUnits: 1_087,
  },
  quest: {
    bytes: 52_092_404,
    sha256: '430987ed81842b5a6a3544c401707c82f2edfdc02d16111e70bf6e5245658083',
    nodes: 2_454,
    instances: 5_116,
    units: 6_407,
    triangles: 6_107_774,
    draws: 3_745,
    firstFloorUnits: 1_080,
  },
}

function clone(value) {
  return structuredClone(value)
}

function expectInvalid(result, pattern) {
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), pattern)
}

const contract = await buildWholeLayerOwnershipContract({
  modelId: 'icm-anim-2025',
  variants: {
    web: { filePath: SOURCE_FILES.web, url: '/models/icm-anim-2025/model-web.glb' },
    quest: { filePath: SOURCE_FILES.quest, url: '/models/icm-anim-2025/model-quest.glb' },
  },
})

const structural = validateWholeLayerOwnershipContract(contract)
assert.deepEqual(structural, { valid: true, errors: [] })
const sourceVerification = await verifyWholeLayerOwnershipSources(contract, SOURCE_FILES)
assert.deepEqual(sourceVerification, { valid: true, errors: [] })

for (const variantName of ['web', 'quest']) {
  const expected = EXPECTED[variantName]
  const variant = contract.variants[variantName]
  assert.equal(variant.source.bytes, expected.bytes)
  assert.equal(variant.source.sha256, expected.sha256)
  assert.equal(variant.inventory.renderNodeCount, expected.nodes)
  assert.equal(variant.inventory.logicalInstanceCount, expected.instances)
  assert.equal(variant.inventory.renderUnitCount, expected.units)
  assert.equal(variant.inventory.expandedTriangles, expected.triangles)
  assert.equal(variant.inventory.rendererDraws, expected.draws)
  assert.equal(new Set(variant.inventory.nodes.map((node) => node.id)).size, expected.nodes)
  assert.equal(new Set(variant.inventory.instances.map((instance) => instance.id)).size, expected.instances)
  assert.equal(new Set(variant.inventory.units.map((unit) => unit.id)).size, expected.units)
  assert.deepEqual(variant.animation.targetNames, [
    '1st Floor._anim1',
    '2st Floor._anim1',
    'Ceiling._anim1',
    'Mezzanine._anim1',
  ])
}

const complete = createCompleteOwnerClaims(contract)
const completeResult = validateWholeLayerPackageClaims(contract, complete)
assert.equal(completeResult.valid, true, completeResult.errors.join('\n'))

const omission = clone(complete)
const omittedNodeId = omission.variants.web.packages[0].sourceNodeIds.pop()
const omittedNode = contract.variants.web.inventory.nodes.find((node) => node.id === omittedNodeId)
const omissionResult = validateWholeLayerPackageClaims(contract, omission)
expectInvalid(omissionResult, /web: missing \d+ render units/)
assert.equal(omissionResult.variants.web.missingCount, omittedNode.renderUnitCount)

const duplication = clone(complete)
const duplicatedNodeId = duplication.variants.quest.packages[0].sourceNodeIds[0]
const duplicatedNode = contract.variants.quest.inventory.nodes.find((node) => node.id === duplicatedNodeId)
duplication.variants.quest.packages[0].sourceNodeIds.push(duplicatedNodeId)
const duplicationResult = validateWholeLayerPackageClaims(contract, duplication)
expectInvalid(duplicationResult, /quest: duplicated \d+ render units/)
assert.equal(duplicationResult.variants.quest.duplicateCount, duplicatedNode.renderUnitCount)

const wrongOwner = clone(complete)
wrongOwner.variants.web.packages[0].owner = 'Ground Floor._anim1'
const wrongOwnerResult = validateWholeLayerPackageClaims(contract, wrongOwner)
expectInvalid(wrongOwnerResult, /wrong owner/)

const staleClaims = clone(complete)
staleClaims.variants.quest.sourceSha256 = '0'.repeat(64)
const staleClaimsResult = validateWholeLayerPackageClaims(contract, staleClaims)
expectInvalid(staleClaimsResult, /source SHA-256 is stale/)

const staleContract = clone(contract)
staleContract.variants.web.source.sha256 = 'f'.repeat(64)
refreshWholeLayerContractDigests(staleContract)
assert.equal(validateWholeLayerOwnershipContract(staleContract).valid, true)
const staleSourceResult = await verifyWholeLayerOwnershipSources(staleContract, SOURCE_FILES)
expectInvalid(staleSourceResult, /web: source hash is stale/)

const forgedInventory = clone(contract)
const forgedVariant = forgedInventory.variants.web
const removedNode = forgedVariant.inventory.nodes.pop()
forgedVariant.inventory.instances = forgedVariant.inventory.instances.filter((instance) => instance.nodeId !== removedNode.id)
forgedVariant.inventory.units = forgedVariant.inventory.units.filter((unit) => unit.nodeId !== removedNode.id)
forgedVariant.inventory.renderNodeCount = forgedVariant.inventory.nodes.length
forgedVariant.inventory.logicalInstanceCount = forgedVariant.inventory.instances.length
forgedVariant.inventory.renderUnitCount = forgedVariant.inventory.units.length
forgedVariant.inventory.primitiveCount = forgedVariant.inventory.nodes.reduce((sum, node) => sum + node.primitiveCount, 0)
forgedVariant.inventory.rendererDraws = forgedVariant.inventory.primitiveCount
forgedVariant.inventory.expandedTriangles = forgedVariant.inventory.units.reduce((sum, unit) => sum + unit.triangles, 0)
refreshWholeLayerContractDigests(forgedInventory)
assert.equal(validateWholeLayerOwnershipContract(forgedInventory).valid, true)
const forgedInventoryResult = await verifyWholeLayerOwnershipSources(forgedInventory, SOURCE_FILES)
expectInvalid(forgedInventoryResult, /enumerated ownership contract differs from the pinned source/)

const changedAnimationTarget = clone(contract)
changedAnimationTarget.variants.web.animation.channels[0].targetNodeName = 'Unexpected Owner._anim1'
refreshWholeLayerContractDigests(changedAnimationTarget)
const changedAnimationResult = validateWholeLayerOwnershipContract(changedAnimationTarget)
expectInvalid(changedAnimationResult, /animation target summary differs from channel targets/)

const firstFloorIndex = JSON.parse(await readFile(FIRST_FLOOR_INDEX, 'utf8'))
const firstFloorClaims = claimsFromOwnerLocalPilot(contract, firstFloorIndex)
const firstFloorResult = validateWholeLayerPackageClaims(contract, firstFloorClaims)
expectInvalid(firstFloorResult, /missing/)
for (const variantName of ['web', 'quest']) {
  assert.equal(firstFloorResult.variants[variantName].duplicateCount, 0)
  assert.equal(firstFloorResult.variants[variantName].claimedUniqueRenderUnits, EXPECTED[variantName].firstFloorUnits)
  assert.equal(
    firstFloorResult.variants[variantName].missingCount,
    EXPECTED[variantName].units - EXPECTED[variantName].firstFloorUnits,
  )
}

console.log('Whole-layer ownership coverage gate: PASS')
console.log(`  contract: ${contract.coverageDigestSha256}`)
console.log('  positive: exact complete Web/Quest owner claims accepted')
console.log(`  omission: rejected (${omissionResult.variants.web.missingCount} Web units missing)`)
console.log(`  duplication: rejected (${duplicationResult.variants.quest.duplicateCount} Quest units duplicated)`)
console.log('  wrong owner: rejected')
console.log('  stale candidate/source: rejected')
console.log('  forged-but-internally-consistent inventory: rejected by source rebuild')
console.log('  changed animation target: rejected')
console.log(`  first-floor-only: rejected (${firstFloorResult.variants.web.missingCount} Web / ${firstFloorResult.variants.quest.missingCount} Quest units missing)`)
