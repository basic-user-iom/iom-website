import fs from 'node:fs';
function edit(file,fn){const source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');const next=fn(source);if(next===source)throw Error('No edit: '+file);fs.writeFileSync(file,next)}
function replace(s,a,b){if(!s.includes(a))throw Error('Missing: '+a);return s.replace(a,b)}
edit('src/controls/WalkMode.ts',s=>{
s=replace(s,'  private followDistance = 4.2','  private readonly cameraFocus = new Vector3()\n  private followDistance = 4.2');
s=replace(s,'    this.presentation.reset(this.controller.position, this.controller.yaw)','    this.presentation.reset(this.controller.position, this.controller.yaw)\n    this.cameraFocus.copy(this.controller.position)');
s=replace(s,'    if (!this.enabled) return\n\n    const running','    if (!this.enabled) return\n    if (isUiControl(document.activeElement)) this.keys.clear()\n\n    const running');
s=replace(s,'      visualFeetY: this.presentation.cameraFeetY,','      visualFeetY: this.presentation.bodyFeetY,');
s=replace(s,'    if (firstPerson) {\n      const eye',`    // Use one smoothed anchor for the boom and its target. Mixing a lagged
    // camera with the fixed-step physics target changes pitch on every frame.
    const anchorBlend = 1 - Math.exp(-12 * dt)
    this.cameraFocus.x += (this.controller.position.x - this.cameraFocus.x) * anchorBlend
    this.cameraFocus.z += (this.controller.position.z - this.cameraFocus.z) * anchorBlend
    this.cameraFocus.y = this.presentation.cameraFeetY
    if (firstPerson) {
      const eye`);
s=replace(s,'      this.camera.position.copy(eye)','      eye.x = this.cameraFocus.x\n      eye.z = this.cameraFocus.z\n      this.camera.position.copy(eye)');
s=replace(s,'this.controller.position.x + Math.sin(yaw)','this.cameraFocus.x + Math.sin(yaw)');
s=replace(s,'this.controller.position.z + Math.cos(yaw)','this.cameraFocus.z + Math.cos(yaw)');
s=replace(s,'      this.camera.position.lerp(_desired, 1 - Math.exp(-10 * dt))','      this.camera.position.copy(_desired)');
s=replace(s,'        this.controller.position.x,\n        this.presentation.cameraFeetY + this.lookAtHeight,\n        this.controller.position.z,','        this.cameraFocus.x,\n        this.presentation.cameraFeetY + this.lookAtHeight,\n        this.cameraFocus.z,');return s;
});
edit('src/controls/WalkPresentation.ts',s=>{
s=replace(s,'  cameraFeetY = 0','  cameraFeetY = 0\n  bodyFeetY = 0\n  private cameraHeightVelocity = 0');
s=replace(s,'    this.cameraFeetY = feet.y','    this.cameraFeetY = feet.y\n    this.bodyFeetY = feet.y\n    this.cameraHeightVelocity = 0');
s=replace(s,`    if (jumping) {
      this.cameraFeetY = feet.y
    } else {
      this.cameraFeetY += (feet.y - this.cameraFeetY) * (1 - Math.exp(-16 * dt))
      this.cameraFeetY = Math.max(feet.y - 0.3, Math.min(feet.y + 0.3, this.cameraFeetY))
    }`, `    if (jumping) {
      this.cameraFeetY = this.bodyFeetY = feet.y
      this.cameraHeightVelocity = 0
    } else {
      // Feet need a short response for contact; the view needs a smooth velocity
      // across a riser. Keeping separate values avoids pulling shoes under steps.
      this.bodyFeetY += (feet.y - this.bodyFeetY) * (1 - Math.exp(-16 * dt))
      this.bodyFeetY = Math.max(feet.y - 0.3, Math.min(feet.y + 0.3, this.bodyFeetY))
      const omega = 10
      const error = this.cameraFeetY - feet.y
      const decay = Math.exp(-omega * dt)
      const impulse = (this.cameraHeightVelocity + omega * error) * dt
      this.cameraFeetY = feet.y + (error + impulse) * decay
      this.cameraHeightVelocity = (this.cameraHeightVelocity - omega * impulse) * decay
    }`);
s=replace(s,'> 0.34) this.heightHistory.shift()', '> 0.65) this.heightHistory.shift()');
s=replace(s,'distance > 0.001 && Math.abs(dy) > 0.012','distance > 0.001 && (measuredDirection !== 0 || Math.abs(dy) > 0.012)');
s=replace(s,'Math.max(0.22, Math.min(1.05, 0.34 / Math.max(0.35, this.speed)))','Math.max(0.3, Math.min(1.1, 0.4 / Math.max(0.35, this.speed)))');return s;
});
edit('src/controls/CharacterVisual.ts',s=>replace(s,'      next.reset().fadeIn(0.2).play()',`      const locomotion = (value: CharacterAnimState | null) =>
        value === 'walking' || value === 'running' || value === 'stairsUp' || value === 'stairsDown'
      const phase = prev && locomotion(this.current) && locomotion(state)
        ? (prev.time / prev.getClip().duration) % 1 : 0
      next.reset().fadeIn(0.2).play()
      next.time = phase * next.getClip().duration`));
edit('src/main.ts',s=>{s=replace(s,"[['0.35', 'Slow (stairs)'], ['3.2', 'Normal']]","[['1.6', 'Normal'], ['0.35', 'Slow (stairs)']]");s=replace(s,'engine.controller.params.walkSpeed = 0.35','engine.controller.params.walkSpeed = 1.6');return s});
console.log('Applied camera, gait and control fixes');
