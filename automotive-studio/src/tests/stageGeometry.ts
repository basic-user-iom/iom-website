/**
 * Stage floor tessellation for displacement maps.
 * Run: npx tsx src/tests/stageGeometry.ts
 */
import assert from 'node:assert/strict'
import { CircleGeometry } from 'three'
import {
  createTessellatedCircleGeometry,
  stageSurfaceNeedsDisplacement,
} from '../stage/stageGeometry'
import { createDefaultStageSurface } from '../persistence/schema'

const fan = new CircleGeometry(14, 96)
const tess = createTessellatedCircleGeometry(14, 96, 48)
assert.ok(
  (tess.attributes.position?.count ?? 0) > (fan.attributes.position?.count ?? 0) * 10,
  'tessellated disk must have far more verts than a centre fan',
)
assert.equal(tess.attributes.uv?.itemSize, 2)
fan.dispose()
tess.dispose()

const bare = createDefaultStageSurface('#111', 0.2, 0.5)
assert.equal(stageSurfaceNeedsDisplacement(bare), false)
bare.maps.displacementMapAssetId = 'disp-1'
bare.displacementScale = 0.05
assert.equal(stageSurfaceNeedsDisplacement(bare), true)
bare.displacementScale = 0
assert.equal(stageSurfaceNeedsDisplacement(bare), false)

console.log('stageGeometry: ok')
