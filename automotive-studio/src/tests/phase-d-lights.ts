/**
 * Phase D vehicle lights.
 * Run: npx tsx src/tests/phase-d-lights.ts
 */
import assert from 'node:assert/strict'
import { migrateProject } from '../persistence/migrations'
import {
  AUTOMOTIVE_SCHEMA_VERSION,
  createDefaultVehicleLights,
  createEmptyProject,
} from '../persistence/schema'
import { ProjectStore, patchVehicleLights } from '../persistence/projectStore'
import { proposeNightRunning, vehicleLightGroupLabel } from '../vehicle/vehicleLights'

assert.equal(AUTOMOTIVE_SCHEMA_VERSION, 5)
assert.equal(vehicleLightGroupLabel('lowBeam'), 'Low beam')

const empty = createEmptyProject()
assert.equal(empty.vehicleLights.groups.drl, false)
assert.equal(empty.vehicleLights.proxiesEnabled, true)
assert.equal(empty.vehicleLights.bloomEnabled, false)
assert.deepEqual(empty.vehicleLights.targets, {})

const v2 = {
  ...createEmptyProject('From v2'),
  schemaVersion: 2 as const,
  vehicleLights: undefined,
} as unknown
const migrated = migrateProject(v2)
assert.equal(migrated.schemaVersion, 5)
assert.deepEqual(migrated.vehicleLights.groups, createDefaultVehicleLights().groups)

const proposed = proposeNightRunning(createDefaultVehicleLights(), true)
assert.equal(proposed.groups.drl, true)
assert.equal(proposed.groups.tail, true)

const alreadyOn = proposeNightRunning(
  { ...createDefaultVehicleLights(), groups: { ...createDefaultVehicleLights().groups, lowBeam: true } },
  true,
)
assert.equal(alreadyOn.groups.drl, false, 'does not overwrite when any lamp already on')

const store = new ProjectStore()
store.dispatch(patchVehicleLights({ groups: { brake: true, hazards: true } }))
assert.equal(store.getSnapshot().project.vehicleLights.groups.brake, true)
assert.equal(store.getSnapshot().project.vehicleLights.groups.hazards, true)
store.undo()
assert.equal(store.getSnapshot().project.vehicleLights.groups.brake, false)

console.log('phase-d-lights: ok')
