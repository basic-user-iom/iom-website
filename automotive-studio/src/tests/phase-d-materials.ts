/**
 * Phase D material override helpers.
 * Run: npx tsx src/tests/phase-d-materials.ts
 */
import assert from 'node:assert/strict'
import { migrateProject } from '../persistence/migrations'
import { createEmptyProject, AUTOMOTIVE_SCHEMA_VERSION } from '../persistence/schema'
import { materialOverrideKey } from '../vehicle/applyMaterialOverrides'
import { ProjectStore, upsertMaterialOverride, setVehiclePolishMode } from '../persistence/projectStore'

assert.equal(AUTOMOTIVE_SCHEMA_VERSION, 5)

const v1 = {
  ...createEmptyProject('Legacy'),
  schemaVersion: 1 as const,
  vehicle: {
    assetId: 'a1',
    name: 'car.glb',
    lengthMetres: 4,
    widthMetres: 2,
    heightMetres: 1.5,
    grounded: true,
    forwardAxis: '+z',
    upAxis: '+y',
    targetLengthMetres: 4,
    uniformScale: 1,
    groundOffsetMetres: 0,
    flip180: false,
    analysis: null,
    rig: null,
  },
} as unknown

const migrated = migrateProject(v1)
assert.equal(migrated.schemaVersion, 5)
assert.equal(migrated.vehicle?.polishMode, 'auto')
assert.deepEqual(migrated.vehicle?.materialOverrides, [])
assert.ok(migrated.vehicleLights)
assert.equal(migrated.vehicleLights.bloomEnabled, false)
assert.equal(migrated.freeDrive.enabled, false)

assert.equal(materialOverrideKey('Body/Paint', 0), 'Body/Paint#0')

const store = new ProjectStore(migrated)
store.dispatch(
  upsertMaterialOverride({
    id: 'Body#0',
    node: { name: 'Body', path: 'Body' },
    materialSlot: 0,
    scope: 'shared-material',
    props: { color: '#ff0000', metalness: 0.2, roughness: 0.3 },
  }),
)
assert.equal(store.getSnapshot().project.vehicle?.materialOverrides.length, 1)
assert.equal(store.getSnapshot().project.vehicle?.materialOverrides[0].props.color, '#ff0000')

store.dispatch(setVehiclePolishMode('off'))
assert.equal(store.getSnapshot().project.vehicle?.polishMode, 'off')

store.undo()
assert.equal(store.getSnapshot().project.vehicle?.polishMode, 'auto')
store.undo()
assert.equal(store.getSnapshot().project.vehicle?.materialOverrides.length, 0)

console.log('phase-d-materials: ok')
