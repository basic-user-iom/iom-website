/**
 * Soft tail stays on until brake fires (shared rear lenses + route running).
 * Run: npx tsx src/tests/lampTailUntilBrake.ts
 */
import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { createDefaultVehicleLights } from '../persistence/schema'
import { VehicleLightsController } from '../vehicle/vehicleLights'

const TAIL = 0xff3030
const BRAKE = 0xff1010

const root = new Group()
const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
body.name = 'Body'
body.position.y = 0.7
root.add(body)

const left = new Mesh(
  new BoxGeometry(0.15, 0.12, 0.08),
  new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
)
left.name = 'RedGlass_L'
left.position.set(-0.75, 0.75, -2.15)
root.add(left)

const right = new Mesh(
  new BoxGeometry(0.15, 0.12, 0.08),
  new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
)
right.name = 'RedGlass_R'
right.position.set(0.75, 0.75, -2.15)
root.add(right)

const lights = new VehicleLightsController()
lights.bind(root)
const state = createDefaultVehicleLights()
state.beamProxies = []
// Tail checkbox off — running signal alone must keep soft red.
lights.apply(state)

lights.setRouteSignals({ running: true, braking: false })
const leftMat = left.material as MeshStandardMaterial
assert.equal(leftMat.emissive.getHex(), TAIL, 'running → soft tail')
assert.ok(leftMat.emissiveIntensity > 0.02 && leftMat.emissiveIntensity < 1, 'soft intensity')

lights.setRouteSignals({ running: true, braking: true })
assert.equal(leftMat.emissive.getHex(), BRAKE, 'brake brightens')
assert.ok(leftMat.emissiveIntensity > 1, 'brake hotter than tail')

lights.setRouteSignals({ running: true, braking: false })
assert.equal(leftMat.emissive.getHex(), TAIL, 'release brake → soft tail again')

lights.setRouteSignals({ running: false, braking: false })
assert.ok(
  leftMat.emissive.getHex() !== TAIL && leftMat.emissive.getHex() !== BRAKE,
  'no running / no tail checkbox → not painted as lamp',
)

console.log('lampTailUntilBrake: ok')
