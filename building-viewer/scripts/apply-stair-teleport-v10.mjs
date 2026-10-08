import fs from 'node:fs';
const edit=(f,fn)=>fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')));
edit('src/controls/WalkMode.ts',s=>{
 s=s.replace('  private keys = new Set<string>()','  private keys = new Set<string>()\n  private readonly teleportHeldKeys = new Set<string>()');
 s=s.replace('      if (!this.enabled) return\n      // Native menus','      if (!this.enabled || this.teleportHeldKeys.has(e.code)) return\n      // Native menus');
 s=s.replace('    this.onKeyUp = (e) => this.keys.delete(e.code)',`    this.onKeyUp = (e) => {
      this.keys.delete(e.code)
      this.teleportHeldKeys.delete(e.code)
    }`);
 s=s.replace('    this.enabled = true\n    this.visual.setVisible(true)','    this.enabled = true\n    this.teleportHeldKeys.clear()\n    this.visual.setVisible(true)');
 s=s.replace('    this.enabled = false\n    this.keys.clear()','    this.enabled = false\n    this.keys.clear()\n    this.teleportHeldKeys.clear()');
 s=s.replace('  requestPointerLock(): void {',`  /** Move feet, pose and camera together; held movement keys must be released. */
  teleportTo(feet: Vector3, yaw: number): void {
    for (const key of this.keys) this.teleportHeldKeys.add(key)
    this.keys.clear()
    this.controller.setFeetPosition(feet, yaw)
    this.controller.pitch = -0.18
    this.controller.update(1 / 60, _wish.set(0, 0, 0), 0)
    this.presentation.reset(this.controller.position, yaw)
    this.cameraFocus.copy(this.controller.position)
    this.stairStepDepth = this.targetStepDepth = .28
    this.lastTreadProbe.set(Infinity, Infinity, Infinity)
    this.visual.resetForTeleport()
    this.update(0)
  }

  requestPointerLock(): void {`);
 return s;
});
edit('src/controls/CharacterVisual.ts',s=>s.replace('  resetFootIK(): void { this.footIK?.reset() }',`  resetFootIK(): void { this.footIK?.reset() }

  /** A teleport arrives standing still, with no residual stair pose or crossfade. */
  resetForTeleport(): void {
    this.footIK?.reset()
    this.mixer?.stopAllAction()
    const idle = this.actions.get('idle')
    idle?.reset().stopFading().setEffectiveWeight(1).setEffectiveTimeScale(1).play()
    this.current = idle ? 'idle' : null
    this.mixer?.update(0)
  }`));
edit('src/ViewerEngine.ts',s=>{
 s="import { StairTeleports } from './controls/StairTeleports'\n"+s;
 s=s.replace('  private walk: WalkMode','  readonly stairTeleports: StairTeleports\n  private walk: WalkMode');
 s=s.replace('    this.pegman = new PegmanPlacement(',`    this.stairTeleports = new StairTeleports(
      this.collision, this.controller, this.walk,
      id => Boolean(this.models.getLayer(id)?.visible),
    )
    this.scene.add(this.stairTeleports.root)
    this.pegman = new PegmanPlacement(`);
 s=s.replace("    this.perf.markSection('walk')","    this.stairTeleports.update(this.mode === 'walk' && !this.xr.isActive())\n    this.perf.markSection('walk')");
 s=s.replace('    this.walk.dispose()','    this.stairTeleports.dispose()\n    this.walk.dispose()');
 return s;
});
edit('src/main.ts',s=>s.replace('Blender v9.2 - floors and stairs','Blender v10 - stair teleport'));
