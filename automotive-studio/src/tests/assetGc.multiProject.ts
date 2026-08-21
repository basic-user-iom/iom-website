/**
 * Multi-project asset GC — saving one project must not delete another's blobs.
 * Run: npx tsx src/tests/assetGc.multiProject.ts
 */
import assert from 'node:assert/strict'
import {
  collectReferencedAssetIds,
  orphanBlobIds,
  unionReferencedAssetIds,
} from '../persistence/assetGc'
import { createEmptyProject } from '../persistence/schema'

const projectA = createEmptyProject('Project A')
projectA.id = 'proj-a'
projectA.assets.push(
  { id: 'a-only', role: 'vehicle-mobile', filename: 'a.glb', blobKey: 'a-only' },
  { id: 'shared', role: 'image', filename: 'shared.png', blobKey: 'shared' },
)
projectA.activeVehicleId = 'a-only'
projectA.stage.floor.maps.mapAssetId = 'shared'

const projectB = createEmptyProject('Project B')
projectB.id = 'proj-b'
projectB.assets.push(
  { id: 'b-only', role: 'vehicle-high', filename: 'b.glb', blobKey: 'b-only' },
  { id: 'shared', role: 'image', filename: 'shared.png', blobKey: 'shared' },
)
projectB.activeVehicleId = 'b-only'
projectB.hotspots.push({
  id: 'h1',
  name: 'Clip',
  markerLabel: '1',
  anchor: {
    assetFingerprint: '',
    node: {},
    localPosition: [0, 1, 0],
    localNormal: [0, 1, 0],
    offset: 0.05,
  },
  blocks: [{ type: 'video', assetId: 'b-video' }],
  actions: [],
  exploreVisible: true,
  closeBehavior: 'keep-state',
})

const refsA = collectReferencedAssetIds(projectA)
assert.ok(refsA.has('a-only'))
assert.ok(refsA.has('shared'))
assert.equal(refsA.has('b-only'), false)
assert.equal(refsA.has('b-video'), false)

const refsB = collectReferencedAssetIds(projectB)
assert.ok(refsB.has('b-only'))
assert.ok(refsB.has('b-video'))
assert.ok(refsB.has('shared'))

// Bug the review caught: purging with only A's refs would delete B's blobs.
const allBlobs = ['a-only', 'b-only', 'shared', 'b-video', 'orphan-old']
const wrongOrphans = orphanBlobIds(allBlobs, refsA)
assert.ok(wrongOrphans.includes('b-only'), 'single-project GC would wrongly delete B')
assert.ok(wrongOrphans.includes('b-video'), 'single-project GC would wrongly delete B video')

const union = unionReferencedAssetIds([projectA, projectB])
assert.ok(union.has('a-only'))
assert.ok(union.has('b-only'))
assert.ok(union.has('shared'))
assert.ok(union.has('b-video'))

const safeOrphans = orphanBlobIds(allBlobs, union)
assert.deepEqual(safeOrphans, ['orphan-old'])

// Saving A while B exists: active A + saved B must preserve everything B needs.
const whileSavingA = unionReferencedAssetIds([projectA, projectB])
assert.deepEqual(orphanBlobIds(allBlobs, whileSavingA), ['orphan-old'])

console.log('assetGc.multiProject: ok')
