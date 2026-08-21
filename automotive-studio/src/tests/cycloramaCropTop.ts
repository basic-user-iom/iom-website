/**
 * Cyclorama crop-top + contain letterbox framing.
 * Run: npx tsx src/tests/cycloramaCropTop.ts
 */
import assert from 'node:assert/strict'
import { ClampToEdgeWrapping, Vector2, VideoTexture } from 'three'
import {
  applyCycloramaVideoFit,
  computeCycloramaVideoRect,
} from '../stage/cycloramaVideo'
import { createEmptyProject } from '../persistence/schema'

const empty = createEmptyProject('Crop')
assert.equal(empty.stage.cycloramaCropTop, 0)

const texture = {
  wrapS: ClampToEdgeWrapping,
  wrapT: ClampToEdgeWrapping,
  center: new Vector2(0.5, 0.5),
  rotation: 0,
  repeat: new Vector2(1, 1),
  offset: new Vector2(0, 0),
  needsUpdate: false,
} as unknown as VideoTexture

applyCycloramaVideoFit(texture, 'cover', 2, 16 / 9, 0)
const fullRy = texture.repeat.y
const fullOy = texture.offset.y

applyCycloramaVideoFit(texture, 'cover', 2, 16 / 9, 0.4)
assert.ok(texture.repeat.y < fullRy + 1e-6, 'crop reduces V repeat')
assert.ok(texture.repeat.y > 0.1, 'still shows a band')
assert.ok(Number.isFinite(texture.offset.y))

// Wide video on a narrower wall → contain letterboxes top/bottom (full U, partial V).
{
  const wall = 1.5
  const video = 16 / 9
  const rect = computeCycloramaVideoRect('contain', wall, video, 0)
  assert.equal(rect.repeatX, 1, 'wide contain uses full wall width')
  assert.ok(rect.repeatY < 1, 'wide contain letterboxes vertically')
  assert.ok(Math.abs(rect.offsetY - (1 - rect.repeatY) / 2) < 1e-6)
  assert.ok(rect.repeatX * rect.repeatY < 1, 'video occupies less than full wall')
}

// Tall/narrow video on a wide wall → contain pillarboxes sides (partial U, full V).
{
  const wall = 2.5
  const video = 9 / 16
  const rect = computeCycloramaVideoRect('contain', wall, video, 0)
  assert.equal(rect.repeatY, 1, 'tall contain uses full wall height')
  assert.ok(rect.repeatX < 1, 'tall contain pillarboxes horizontally')
  assert.ok(Math.abs(rect.offsetX - (1 - rect.repeatX) / 2) < 1e-6)
}

// Contain must show the full frame (repeat area ≤ 1), unlike cover which may crop.
{
  const wall = 1.2
  const video = 2.4
  const cover = computeCycloramaVideoRect('cover', wall, video, 0)
  const contain = computeCycloramaVideoRect('contain', wall, video, 0)
  assert.ok(cover.repeatX < 1, 'cover crops horizontal for ultra-wide')
  assert.equal(contain.repeatX, 1, 'contain keeps full width of video mapped into wall')
  assert.ok(contain.repeatY < cover.repeatY || contain.repeatY < 1)
}

console.log('cycloramaCropTop: ok', {
  full: { ry: fullRy, oy: fullOy },
  cropped: { ry: texture.repeat.y, oy: texture.offset.y },
})
