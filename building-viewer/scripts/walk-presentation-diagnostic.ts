import assert from 'node:assert/strict'
import { AnimationClip, Group, NumberKeyframeTrack, Vector3 } from 'three'
import { WalkPresentation } from '../src/controls/WalkPresentation'
import { CharacterVisual } from '../src/controls/CharacterVisual'
import { measureTreadDepth } from '../src/controls/stairCadence'

for (const fps of [30, 60, 120]) {
  const p = new WalkPresentation(), feet = new Vector3(), before = new Vector3()
  p.reset(feet, 0)
  let maxCameraStep = 0, oldCamera = 0
  for (let frame = 0; frame < fps * 2; frame++) {
    before.copy(feet)
    // 60 Hz simulation rendered at both lower and higher rates.
    if (fps !== 120 || frame % 2 === 0) feet.z -= 1.6 / Math.min(fps, 60)
    if (frame > 0 && frame % Math.round(fps * 0.2) === 0) feet.y += 0.18
    p.update(1 / fps, before, feet, true, 0, 0, true, false)
    maxCameraStep = Math.max(maxCameraStep, Math.abs(p.cameraFeetY - oldCamera))
    oldCamera = p.cameraFeetY
  }
  assert.equal(p.animation, 'stairsUp', `${fps} Hz: gait must survive the interval between treads`)
  assert.ok(p.speed > 1.35 && p.speed < 1.85, `${fps} Hz: measured speed ${p.speed}`)
  assert.ok(maxCameraStep < 0.13, `${fps} Hz: camera still snaps by a full riser`)
  assert.ok(feet.y - p.cameraFeetY >= 0 && feet.y - p.cameraFeetY <= 0.3)
  for (let i = 0; i < fps; i++) p.update(1 / fps, feet, feet, true, 0, 0, true, false)
  assert.equal(p.animation, 'idle', 'held movement into a wall must not run the walk cycle')
  before.copy(feet); feet.x += 0.05
  p.update(1 / fps, before, feet, false, 6, 0, true, false)
  assert.equal(p.animation, 'jumping')
  assert.equal(p.cameraFeetY, feet.y, 'jump height must not be smoothed as a stair')
  p.reset(new Vector3(0, 10, 0), Math.PI)
  assert.equal(p.cameraFeetY, 10, 'placement must reset stale camera height')
}

const visual = new CharacterVisual()
const clip = (name: string) => new AnimationClip(name, 1, [new NumberKeyframeTrack('.position[y]', [0, 1], [0, 0])])
const internal = visual as unknown as { loader: { loadAsync: () => Promise<unknown> }; actions: Map<string, import('three').AnimationAction> }
internal.loader.loadAsync = async () => ({ scene: new Group(), animations: [clip('idle'), clip('walk'), clip('run')] })
await visual.load('fixture')
visual.syncFromController(new Vector3(), 0, 'walking', false, 1.2)
visual.update(0.3)
const walking = internal.actions.get('walking')!
const phase = walking.time
visual.syncFromController(new Vector3(), 0, 'stairsUp', false, 0.8)
assert.equal(walking.time, phase, 'stair hint must not restart the shared gait')
assert.equal(walking.getEffectiveTimeScale(), 0.8)
assert.equal(internal.actions.get('jumping'), internal.actions.get('idle'), 'missing jump must not walk in the air')
visual.dispose()

const authored = new CharacterVisual()
const authoredInternal = authored as unknown as typeof internal
authoredInternal.loader.loadAsync = async () => ({scene: new Group(), animations: [clip('Idle'), clip('Walk'), clip('Stairs_Up'), clip('Stairs_Down'), clip('Jump')]})
await authored.load('fixture')
assert.notEqual(authoredInternal.actions.get('stairsUp'), authoredInternal.actions.get('walking'))
assert.notEqual(authoredInternal.actions.get('stairsDown'), authoredInternal.actions.get('stairsUp'))
assert.equal(authoredInternal.actions.get('jumping')!.clampWhenFinished, true)
authored.syncFromController(new Vector3(), 0, 'walking', false, 1)
authored.update(.37)
const oldPhase = authoredInternal.actions.get('walking')!.time
authored.syncFromController(new Vector3(), 0, 'stairsUp', false, 1)
assert.ok(Math.abs(authoredInternal.actions.get('stairsUp')!.time - oldPhase) < 1e-9, 'preserve gait phase when entering stairs')
authored.dispose()
for (const depth of [.2, .28, .36, .44, .5]) for (const sign of [-1, 1]) {
  const result = measureTreadDepth(new Vector3(), new Vector3(1, 0, 0), p => sign * Math.floor((p.x + .035) / depth) * .16)
  assert.ok(result !== null && Math.abs(result - depth) <= .04 + 1e-9, 'measure actual tread spacing: ' + depth)
}
assert.equal(measureTreadDepth(new Vector3(), new Vector3(1, 0, 0), p => p.x * .5), null, 'continuous ramps have no tread cadence')
assert.equal(measureTreadDepth(new Vector3(), new Vector3(1, 0, 0), p => p.x > .4 ? .16 : 0), null, 'single curb is not a repeated stair')
console.log('Walk presentation: PASS (30/60/120 Hz, stair smoothing, blocked gait, clip phase, authored stair clips)')
