import fs from 'node:fs';const edit=(f,fn)=>fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')));
edit('src/controls/WalkMode.ts',s=>{
 s=s.replace('const _desired = new Vector3()','const _desired = new Vector3()\nconst _cameraBoom = new Vector3()');
 s=s.replace('  private followDistance = 4.2','  private cameraBoomLength = Infinity\n  private followDistance = 4.2');
 s=s.replace('    private readonly footGround?: FootGroundQuery,','    private readonly footGround?: FootGroundQuery,\n    private readonly cameraObstruction?: (origin: Vector3, desired: Vector3) => number | null,');
 s=s.replaceAll('    this.cameraFocus.copy(this.controller.position)','    this.cameraFocus.copy(this.controller.position)\n    this.cameraBoomLength = Infinity');
 s=s.replace('      this.camera.position.copy(_desired)\n      _camTarget.set(','      _camTarget.set(');
 s=s.replace('      this.camera.lookAt(_camTarget)',`      if (this.cameraObstruction) {
        const length = _cameraBoom.copy(_desired).sub(_camTarget).length()
        const hit = this.cameraObstruction(_camTarget, _desired)
        const allowed = hit === null ? length : Math.max(.12, hit - .18)
        // Pull in immediately at a wall; release smoothly after clearing it.
        if (!Number.isFinite(this.cameraBoomLength)) this.cameraBoomLength = allowed
        this.cameraBoomLength = Math.min(allowed,
          this.cameraBoomLength + (length - this.cameraBoomLength) * (1 - Math.exp(-10 * dt)))
        _desired.copy(_camTarget).addScaledVector(_cameraBoom, this.cameraBoomLength / length)
      }
      this.camera.position.copy(_desired)
      this.camera.lookAt(_camTarget)`);
 return s;
});
edit('src/ViewerEngine.ts',s=>{
 s="import { CameraObstructionProbe } from './controls/CameraObstructionProbe'\n"+s;
 s=s.replace('    this.walk = new WalkMode(','    const cameraObstruction = new CameraObstructionProbe(this.models.root)\n    this.walk = new WalkMode(');
 s=s.replace('?.point.y ?? null,\n    )','?.point.y ?? null,\n      (origin, desired) => cameraObstruction.distance(origin, desired),\n    )');
 s=s.replace("    if (this.mode !== 'walk') return\n    this.walk.deactivate()", "    if (this.mode !== 'walk') return\n    this.stairTeleports.update(false)\n    this.walk.deactivate()");
 s=s.replace('    this.walk.activate(true)','    this.stairTeleports.update(false)\n    this.walk.activate(true)');
 return s;
});
