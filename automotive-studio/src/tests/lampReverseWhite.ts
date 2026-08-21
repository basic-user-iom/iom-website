/**
 * Reverse paints shared rear brake/tail pods white (no dedicated reverse lenses).
 * Run: npx tsx src/tests/lampReverseWhite.ts
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

lights.setRouteSignals({ reverse: true, braking: false })
const leftMat = left.material as MeshStandardMaterial
const rightMat = right.material as MeshStandardMaterial
assert.equal(isLit(leftMat), true, 'reverse lights left rear pod')
assert.equal(isLit(rightMat), true, 'reverse lights right rear pod')
assert.ok(
  leftMat.emissive.getHex() === 0xf0f4ff || leftMat.emissive.r > 0.8,
  'reverse rear color is white-ish',
)
assert.ok(leftMat.emissive.getHex() !== 0xff1010, 'reverse is not brake red')

lights.setRouteSignals({ reverse: false, braking: true })
assert.equal(leftMat.emissive.getHex(), 0xff1010, 'brake returns to red')

console.log('lamp reverse white: ok')
