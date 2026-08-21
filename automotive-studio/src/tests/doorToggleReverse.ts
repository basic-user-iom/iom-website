/**
 * Door toggle: second call plays the clip in reverse (close).
 * Run: npx tsx src/tests/doorToggleReverse.ts
 */
import assert from 'node:assert/strict'
import { AnimationClip, NumberKeyframeTrack, Object3D } from 'three'
import { AnimationController } from '../animation/animationController'
import { SemanticActions } from '../animation/semanticActions'
import type { VehicleRigManifest } from '../persistence/schema'

const root = new Object3D()
const track = new NumberKeyframeTrack('.position[x]', [0, 1, 2], [0, 1, 0])
const clip = new AnimationClip('DoorOpen', 2, [track])
const controller = new AnimationController()
controller.attach(root, [clip])

const rig = {
  assetFingerprint: 'test',
  semanticActions: [
    {
      id: 'door_fl',
      label: 'Door FL',
      sourceClipId: '0',
      mode: 'toggle' as const,
    },
  ],
} as VehicleRigManifest

const semantic = new SemanticActions(controller, [clip], rig)

assert.equal(semantic.toggleAction('door_fl'), true)
assert.equal(semantic.isOpen('door_fl'), true)
assert.ok(controller.getEffectiveTimeScale() > 0, 'first click plays forward')
assert.equal(controller.getTime(), 0)

// Scrub to end of open.
controller.seek(2)
controller.pause()

assert.equal(semantic.toggleAction('door_fl'), true)
assert.equal(semantic.isOpen('door_fl'), false)
assert.ok(controller.getEffectiveTimeScale() < 0, 'second click plays reverse')
assert.ok(controller.getTime() >= 1.9, 'reverse starts near open end')

// Advance reverse until closed.
for (let i = 0; i < 40; i++) controller.update(0.1)
assert.ok(controller.getTime() <= 0.05, `should settle near closed, got ${controller.getTime()}`)
assert.equal(controller.isPlaying(), false)

console.log('door toggle reverse: ok')
