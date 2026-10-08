import fs from 'node:fs';function edit(f,fn){fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')))}function replace(s,a,b){if(!s.includes(a))throw Error(a);return s.replace(a,b)}
edit('src/controls/WalkMode.ts',s=>{s=replace(s,"import { WalkPresentation, stairWalkingSpeed } from './WalkPresentation'","import { WalkPresentation, stairWalkingSpeed } from './WalkPresentation'\nimport { measureTreadDepth } from './stairCadence'");s=replace(s,'  private followDistance = 4.2',`  private stairStepDepth = .28
  private targetStepDepth = .28
  private readonly lastTreadProbe = new Vector3(Infinity, Infinity, Infinity)
  private followDistance = 4.2`);s=replace(s,'    this.cameraFocus.copy(this.controller.position)',`    this.cameraFocus.copy(this.controller.position)
    this.stairStepDepth = this.targetStepDepth = .28
    this.lastTreadProbe.set(Infinity, Infinity, Infinity)`);s=replace(s,"    const firstPerson = this.cameraMode === 'firstPerson'",`    const stair = this.presentation.animation === 'stairsUp' || this.presentation.animation === 'stairsDown'
    if (stair && this.footGround && _wish.lengthSq() > 0) {
      if (this.controller.position.distanceToSquared(this.lastTreadProbe) > .09) {
        const depth = measureTreadDepth(this.controller.position, _wish, this.footGround)
        if (depth !== null) this.targetStepDepth = depth
        this.lastTreadProbe.copy(this.controller.position)
      }
    } else {
      this.targetStepDepth = .28
      this.lastTreadProbe.set(Infinity, Infinity, Infinity)
    }
    this.stairStepDepth += (this.targetStepDepth - this.stairStepDepth) * (1 - Math.exp(-6 * dt))
    const firstPerson = this.cameraMode === 'firstPerson'`);s=replace(s,'this.presentation.speed, this.presentation.playbackRate),','this.presentation.speed, this.presentation.playbackRate, this.stairStepDepth),');return s});
edit('src/controls/CharacterVisual.ts',s=>{s=replace(s,'measuredSpeed: number, fallback: number): number {','measuredSpeed: number, fallback: number, stepDepth = .28): number {');s=replace(s,`    const name = this.actions.get(state)?.getClip().name
    const reference = name === 'Stairs_Up' ? 0.35 : name === 'Stairs_Down' ? 0.4 : null`,`    const clip = this.actions.get(state)?.getClip()
    // One full clip is a left/right pair. Match that pair to two actual treads,
    // so wider stairs do not put the following foot on the same step.
    const reference = clip && (clip.name === 'Stairs_Up' || clip.name === 'Stairs_Down')
      ? 2 * stepDepth / clip.duration : null`);return s});
edit('scripts/walk-presentation-diagnostic.ts',s=>{
s=replace(s,"import { CharacterVisual } from '../src/controls/CharacterVisual'","import { CharacterVisual } from '../src/controls/CharacterVisual'\nimport { measureTreadDepth } from '../src/controls/stairCadence'");
s=replace(s,"authored.dispose()",`authored.syncFromController(new Vector3(), 0, 'walking', false, 1)
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
assert.equal(measureTreadDepth(new Vector3(), new Vector3(1, 0, 0), p => p.x > .4 ? .16 : 0), null, 'single curb is not a repeated stair')`);return s});
console.log('Cadence now follows measured tread depth');
