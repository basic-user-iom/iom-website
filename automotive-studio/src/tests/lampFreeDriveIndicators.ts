/**
 * Free-drive steer engages route indicator L/R (same blink as Lights panel).
 * Run: npx tsx src/tests/lampFreeDriveIndicators.ts
 */
import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { createDefaultVehicleLights } from '../persistence/schema'
import { VehicleLightsController } from '../vehicle/vehicleLights'

function isLit(mat: MeshStandardMaterial): boolean {
  return mat.emissive.getHex() !== 0 && mat.emissiveIntensity > 0.15
}

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
lights.apply(state)

lights.setRouteSignals({ indicatorLeft: true, indicatorRight: false })
lights.update(0.05)
assert.equal(isLit(left.material as MeshStandardMaterial), true, 'steer left lights Ind L')
assert.equal(isLit(right.material as MeshStandardMaterial), false, 'steer left leaves Ind R off')

lights.setRouteSignals({ indicatorLeft: false, indicatorRight: true })
lights.update(0.05)
assert.equal(isLit(left.material as MeshStandardMaterial), false, 'steer right leaves Ind L off')
assert.equal(isLit(right.material as MeshStandardMaterial), true, 'steer right lights Ind R')

lights.setRouteSignals({ indicatorLeft: false, indicatorRight: false })
lights.update(0.05)
assert.equal(isLit(left.material as MeshStandardMaterial), false, 'no steer clears Ind L')
assert.equal(isLit(right.material as MeshStandardMaterial), false, 'no steer clears Ind R')

console.log('lamp free-drive indicators: ok')
