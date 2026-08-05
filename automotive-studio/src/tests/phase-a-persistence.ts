/**
 * Phase A persistence helpers — no IndexedDB required.
 * Run: npx tsx src/tests/phase-a-persistence.ts
 */
import assert from 'node:assert/strict'
import { collectReferencedAssetIds } from '../persistence/assetGc'
import { createEmptyProject } from '../persistence/schema'
import { resolveBootProjectId } from '../persistence/projectSession'

const project = createEmptyProject('Test')
project.assets.push({
  id: 'asset-a',
  role: 'vehicle-mobile',
  filename: 'car.glb',
  blobKey: 'asset-a',
})
project.activeVehicleId = 'asset-a'

const refs = collectReferencedAssetIds(project)
assert.ok(refs.has('asset-a'), 'vehicle asset must be referenced')

project.stage.floor.maps.mapAssetId = 'tex-floor'
assert.ok(collectReferencedAssetIds(project).has('tex-floor'))

project.hotspots.push({
  id: 'h1',
  name: 'Door',
  markerLabel: '1',
  anchor: {
    assetFingerprint: '',
    node: {},
    localPosition: [0, 1, 0],
    localNormal: [0, 1, 0],
    offset: 0.05,
  },
  blocks: [{ type: 'video', assetId: 'vid-1' }],
  actions: [],
  exploreVisible: true,
  closeBehavior: 'keep-state',
})
assert.ok(collectReferencedAssetIds(project).has('vid-1'))

assert.equal(
  resolveBootProjectId({
    queryProjectId: 'p2',
    lastProjectId: 'p1',
    summaries: [
      { id: 'p1', updatedAt: 10 },
      { id: 'p2', updatedAt: 5 },
    ],
  }),
  'p2',
  'query id wins',
)

assert.equal(
  resolveBootProjectId({
    queryProjectId: null,
    lastProjectId: 'p1',
    summaries: [
      { id: 'p1', updatedAt: 10 },
      { id: 'p2', updatedAt: 50 },
    ],
  }),
  'p1',
  'last-opened beats recency when present',
)

assert.equal(
  resolveBootProjectId({
    queryProjectId: null,
    lastProjectId: 'missing',
    summaries: [
      { id: 'p1', updatedAt: 10 },
      { id: 'p2', updatedAt: 50 },
    ],
  }),
  'p2',
  'most recent when last-opened missing',
)

console.log('phase-a-persistence: ok')
