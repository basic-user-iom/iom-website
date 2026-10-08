import fs from'node:fs';
let f='src/controls/stairTeleportRoutes.ts',s=fs.readFileSync(f,'utf8');s=s.replace('  radius?: number\n}',`  radius?: number
  bottomRadius?: number
  topRadius?: number
  bottomLayerId?: string
  topLayerId?: string
  /** Facing toward the stair from each landing; arrival faces back into that landing. */
  bottomYaw?: number
  topYaw?: number
  sourceObjects?: readonly string[]
}`);s=s.replace('  up: boolean\n}', '  up: boolean\n  layerId: string\n  destinationLayerId: string\n  destinationRadius: number\n}');s=s.replace('    return [\n      { id:',`    const bottomRadius = route.bottomRadius ?? route.radius ?? TELEPORT_RADIUS
    const topRadius = route.topRadius ?? route.radius ?? TELEPORT_RADIUS
    const bottomYaw = route.bottomYaw ?? yaw
    const topYaw = route.topYaw ?? yaw + Math.PI
    return [
      { id:`);s=s.replace('arrivalYaw: yaw, approachYaw: yaw, radius: route.radius ?? TELEPORT_RADIUS, up: true','arrivalYaw: topYaw + Math.PI, approachYaw: bottomYaw, radius: bottomRadius, up: true, layerId: route.bottomLayerId ?? route.layerId, destinationLayerId: route.topLayerId ?? route.layerId, destinationRadius: topRadius');s=s.replace('arrivalYaw: yaw + Math.PI, approachYaw: yaw + Math.PI, radius: route.radius ?? TELEPORT_RADIUS, up: false','arrivalYaw: bottomYaw + Math.PI, approachYaw: topYaw, radius: topRadius, up: false, layerId: route.topLayerId ?? route.layerId, destinationLayerId: route.bottomLayerId ?? route.layerId, destinationRadius: bottomRadius');fs.writeFileSync(f,s);
f='src/controls/StairTeleports.ts';s=fs.readFileSync(f,'utf8');s=s.replace('  RingGeometry, SRGBColorSpace, Vector3,','  RingGeometry, SRGBColorSpace, Vector3, type Object3D,');s="import { TeleportEffect } from './TeleportEffect'\n"+s;s=s.replace('  private wasWalking = false','  private wasWalking = false\n  private availability = \'\'\n  readonly effect: TeleportEffect');s=s.replace('    private readonly layerVisible: (id: string) => boolean,','    private readonly layerVisible: (id: string) => boolean,\n    character: Object3D, host: HTMLElement,');s=s.replace("    this.root.name = 'StairTeleportMarkers'","    this.effect = new TeleportEffect(character, host)\n    this.root.add(this.effect.root)\n    this.root.name = 'StairTeleportMarkers'");s=s.replace('portal.point, portal.route.layerId, portal.radius','portal.point, portal.layerId, portal.radius');s=s.replace('portal.destination, portal.route.layerId, portal.radius','portal.destination, portal.destinationLayerId, portal.destinationRadius');s=s.replace('  update(walking: boolean): void {','  update(walking: boolean, dt = 1 / 60): void {');s=s.replace('    if (!walking) { this.wasWalking = false; return }\n    if (!this.wasWalking) {',`    if (!walking) {
      this.wasWalking = false
      this.effect.cancel()
      this.walk.setTeleportTransition(false)
      return
    }
    const availability = this.world.getRevision() + ':' + [...new Set(this.portals.flatMap(p => [p.layerId, p.destinationLayerId]))].map(id => id + '=' + this.layerVisible(id)).join(',')
    if (!this.wasWalking || availability !== this.availability) {
      this.effect.cancel()
      this.walk.setTeleportTransition(false)
      this.availability = availability`);s=s.replace('const available = this.readyPortals.filter(p => this.layerVisible(p.route.layerId))','const available = this.readyPortals.filter(p => this.layerVisible(p.layerId) && this.layerVisible(p.destinationLayerId))');s=s.replace('    const entered = this.gate.update(',`    if (this.effect.active) {
      this.effect.update(dt)
      if (!this.effect.active) this.walk.setTeleportTransition(false)
      return
    }
    const entered = this.gate.update(`);
const start=s.indexOf('    const previousLayer = this.world.getQueryLayer()',s.indexOf('    if (!entered) return'));const end=s.indexOf('\n  dispose(): void',start);
s=s.slice(0,start)+`    this.walk.setTeleportTransition(true)
    this.effect.begin(() => {
      const previousLayer = this.world.getQueryLayer()
      this.world.setQueryLayer(null)
      const destination = this.resolveLanding(entered.destination, entered.destinationLayerId, entered.destinationRadius)
      if (!destination || !this.layerVisible(entered.layerId)) {
        this.world.setQueryLayer(previousLayer)
        this.world.setFocus(this.controller.position)
        return false
      }
      this.world.setQueryLayer(entered.destinationLayerId)
      this.world.setFocus(destination)
      this.walk.teleportTo(destination, entered.arrivalYaw)
      this.gate.blockAt(this.controller.position, available)
      return true
    })
  }
`+s.slice(end);s=s.replace('  dispose(): void {\n    this.root.removeFromParent()', '  dispose(): void {\n    this.effect.dispose()\n    this.walk.setTeleportTransition(false)\n    this.root.removeFromParent()');fs.writeFileSync(f,s);
f='src/ViewerEngine.ts';s=fs.readFileSync(f,'utf8').replace('id => Boolean(this.models.getLayer(id)?.visible),','id => Boolean(this.models.getLayer(id)?.visible),\n      this.character.root, this.renderer.domElement.parentElement!,').replace("this.stairTeleports.update(this.mode === 'walk' && !this.xr.isActive())","this.stairTeleports.update(this.mode === 'walk' && !this.xr.isActive(), dt)");fs.writeFileSync(f,s);
f='src/collision/CollisionWorld.ts';s=fs.readFileSync(f,'utf8').replace('  getQueryLayer(): string | null {','  private revision = 0\n  getRevision(): number { return this.revision }\n\n  getQueryLayer(): string | null {').replace('    this.resident = nextResident','    this.revision++\n    this.resident = nextResident').replace('  clearAllLayers(): void {','  clearAllLayers(): void {\n    this.revision++');fs.writeFileSync(f,s);
f='src/main.ts';s=fs.readFileSync(f,'utf8').replace('Blender v10 - stair teleport','Blender v11 - stair teleports');fs.writeFileSync(f,s);
