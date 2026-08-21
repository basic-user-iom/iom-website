/**
 * Hotspot door clip start/end helpers + AnimationController range play.
 * Run: npx tsx src/tests/hotspotClipRange.ts
 */
import assert from 'node:assert/strict'
import { AnimationClip, NumberKeyframeTrack, Object3D } from 'three'
import { AnimationController } from '../animation/animationController'
import { withHotspotDoorAction, hotspotDoorPlayRange } from '../hotspots/hotspotContent'
import type { Hotspot } from '../persistence/schema'

function makeHotspot(): Hotspot {
  return {
    id: 'h1',
    name: 'Door',
    markerLabel: 'Door',
    anchor: {
      assetFingerprint: 'x',
      node: { name: 'Door', path: 'Door' },
      localPosition: [0, 0, 0],
      localNormal: [0, 1, 0],
      offset: 0.05,
    },
    blocks: [{ type: 'title', text: 'Door' }],
    actions: [],
    exploreVisible: true,
    closeBehavior: 'keep-state',
  }
}

const hotspot = withHotspotDoorAction(makeHotspot(), 'clip:0', {
  mode: 'toggle',
  startSeconds: 1.25,
  endSeconds: 3.5,
})
const range = hotspotDoorPlayRange(hotspot)
assert.equal(range.startSeconds, 1.25)
assert.equal(range.endSeconds, 3.5)

const clearedStart = withHotspotDoorAction(hotspot, 'clip:0', {
  startSeconds: null,
  endSeconds: 3.5,
})
assert.equal(hotspotDoorPlayRange(clearedStart).startSeconds, undefined)
assert.equal(hotspotDoorPlayRange(clearedStart).endSeconds, 3.5)

const root = new Object3D()
const times = [0, 2, 4]
const values = [0, 1, 0]
const clip = new AnimationClip('door', 4, [
  new NumberKeyframeTrack('.position[x]', times, values),
])
const anim = new AnimationController()
anim.attach(root, [clip])
anim.play(0, 'once', { start: 1.25, end: 2.0 })
assert.ok(Math.abs(anim.getTime() - 1.25) < 0.02, 'starts at range start')
anim.update(1.0)
assert.ok(anim.getTime() >= 1.9 || !anim.isPlaying(), 'approaches / hits end')
anim.update(0.5)
assert.equal(anim.isPlaying(), false, 'stops at end')
assert.ok(Math.abs(anim.getTime() - 2.0) < 0.05, 'clamped at end')

console.log('hotspotClipRange: ok')
