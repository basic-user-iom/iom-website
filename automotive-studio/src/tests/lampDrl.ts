/**
 * FrontLight must bind as DRL (thin strips used to be dropped as lowBeam letter-junk).
 * Run: npx tsx src/tests/lampDrl.ts
 */
import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { createDefaultVehicleLights } from '../persistence/schema'
import { lampGroupForNames, VehicleLightsController } from '../vehicle/vehicleLights'

assert.equal(lampGroupForNames('GeometryNode_1', 'Root', 'FrontLight'), 'drl')
assert.equal(lampGroupForNames('HeadLight_L', 'Root', 'Paint'), 'lowBeam')

const root = new Group()
const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
body.position.y = 0.7
root.add(body)

// Thin horizontal strip — letter-like aspect, must still bind as DRL.
const strip = new Mesh(
  new BoxGeometry(1.2, 0.04, 0.08),
  new MeshStandardMaterial({ name: 'FrontLight', color: 0x111111 }),
)
strip.name = 'GeometryNode_DRL'
strip.position.set(0, 0.7, 2.15)
root.add(strip)

const lights = new VehicleLightsController()
lights.bind(root)
const state = createDefaultVehicleLights()
state.beamProxies = []
lights.apply(state)

assert.ok(lights.getBoundCounts().drl >= 1, 'DRL bound from FrontLight strip')

lights.apply({
  ...state,
  groups: { ...state.groups, drl: true, lowBeam: false },
})
const mat = strip.material as MeshStandardMaterial
assert.ok(mat.emissive.getHex() !== 0, 'DRL turns on FrontLight emissive')
assert.ok(mat.emissiveIntensity > 2.5, 'DRL emissive is stronger')

lights.apply({
  ...state,
  groups: { ...state.groups, hazards: true, drl: true, lowBeam: false },
})
lights.update(0.02)
assert.equal(mat.emissive.getHex(), 0xffa020, 'hazards blink FrontLight amber')
assert.ok(mat.emissiveIntensity > 0.5, 'hazards FrontLight amber is lit on blink-on')

const drlBeams = lights.listBeamHandles().filter((h) => h.groupId === 'drl')
assert.ok(drlBeams.length >= 1, 'DRL has its own beam/gizmo seats')
assert.ok(
  drlBeams.every((h) => h.id.startsWith('auto-drl-') || h.groupId === 'drl'),
  'DRL seats are not lowBeam ids',
)
const lowIds = new Set(
  lights.listBeamHandles().filter((h) => h.groupId === 'lowBeam').map((h) => h.id),
)
assert.ok(
  drlBeams.every((h) => !lowIds.has(h.id)),
  'DRL gizmo handles are not shared with low beam',
)

console.log('lamp DRL: ok')
