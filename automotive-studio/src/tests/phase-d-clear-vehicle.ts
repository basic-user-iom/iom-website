/**
 * Clear-vehicle command coverage.
 * Run: npx tsx src/tests/phase-d-clear-vehicle.ts
 */
import assert from 'node:assert/strict'
import { ProjectStore, clearVehicleProject, patchVehicleLights, setActiveVehicle, setRoute } from '../persistence/projectStore'
import { createDefaultOvalRoute } from '../route/routeMath'
import { createDefaultVehicleLights } from '../persistence/schema'

const store = new ProjectStore()
store.dispatch(
  setActiveVehicle({
    assetId: 'veh-1',
    name: 'car.glb',
    lengthMetres: 4,
    widthMetres: 2,
    heightMetres: 1.4,
    grounded: true,
    forwardAxis: '+z',
    upAxis: '+y',
    targetLengthMetres: 4,
    uniformScale: 1,
    groundOffsetMetres: 0,
    flip180: false,
    polishMode: 'auto',
    materialOverrides: [
      {
        id: 'Body#0',
        node: { name: 'Body' },
        materialSlot: 0,
        scope: 'shared-material',
        props: { color: '#112233' },
      },
    ],
    analysis: null,
    rig: null,
  }, {
    id: 'veh-1',
    role: 'vehicle-high',
    filename: 'car.glb',
    blobKey: 'veh-1',
  }),
)
store.dispatch(patchVehicleLights({ groups: { drl: true, lowBeam: true }, bloomEnabled: true }))
store.dispatch(setRoute(createDefaultOvalRoute(20, 1)))

const before = store.getSnapshot().project
assert.ok(before.vehicle)
assert.ok(before.assets.some((a) => a.role === 'vehicle-high'))
assert.equal(before.vehicleLights.groups.drl, true)
assert.ok(before.route)

store.dispatch(clearVehicleProject())
const after = store.getSnapshot().project
assert.equal(after.vehicle, null)
assert.equal(after.activeVehicleId, null)
assert.ok(!after.assets.some((a) => a.role.startsWith('vehicle-')))
assert.deepEqual(after.vehicleLights.groups, createDefaultVehicleLights().groups)
assert.deepEqual(after.vehicleLights.targets, {})
assert.equal(after.route, null)
assert.deepEqual(after.hotspots, [])

store.undo()
const restored = store.getSnapshot().project
assert.equal(restored.vehicle?.assetId, 'veh-1')
assert.equal(restored.vehicleLights.groups.drl, true)
assert.ok(restored.route)

console.log('phase-d-clear-vehicle: ok')
