import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { StairTeleportGate, stairPortals } from '../src/controls/stairTeleportRoutes'

const portals = stairPortals([{ id: 'flight', label: 'Test flight', layerId: 'building', bottom: [0, 0, 0], top: [0, 6, -12] }])
const gate = new StairTeleportGate()
const outside = new Vector3(0, 0, 1.2)
gate.blockAt(outside, portals)
assert.equal(gate.update(new Vector3(0, 3, 0), true, portals), null, 'Passing on another floor must not trigger')
assert.equal(gate.update(new Vector3(0, 0, .3), false, portals), null, 'Airborne character must land first')
assert.equal(gate.update(new Vector3(0, 0, .3), true, portals)?.id, 'flight:up')
const top = portals[0]!.destination.clone()
gate.blockAt(top, portals)
for (let i = 0; i < 600; i++) assert.equal(gate.update(top, true, portals), null, 'No timed return while standing on arrival circle')
assert.equal(gate.update(top.clone().add(new Vector3(0, 0, .7)), true, portals), null)
assert.equal(gate.update(top, true, portals), null, 'Small edge jitter must not rearm the circle')
gate.update(top.clone().add(new Vector3(0, 0, 1)), true, portals)
assert.equal(gate.update(top, true, portals)?.id, 'flight:down', 'Leaving and re-entering enables the return trip')
assert.equal(gate.update(top, true, portals), null, 'A rejected landing should not retry every frame')
gate.blockAt(portals[0]!.point, portals)
assert.equal(gate.update(portals[0]!.point, true, portals), null, 'Dropping on a circle is not an entry')
gate.update(outside, true, portals)
assert.equal(gate.update(portals[0]!.point, true, []), null, 'Unavailable/hidden route must not trigger')
console.info('Stair teleport gate: both directions, grounding, floor separation, arrival latch, hysteresis, hidden route PASS')
