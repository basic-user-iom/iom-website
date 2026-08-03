/**
 * Node-runnable Phase 1 schema / migrate / empty-project roundtrip.
 * Run: npm run test:schema (from automotive-studio/)
 */
import assert from 'node:assert/strict'
import {
  AUTOMOTIVE_SCHEMA_VERSION,
  createEmptyProject,
} from '../persistence/schema'
import { migrateProject } from '../persistence/migrations'
import { ProjectStore, renameProject, setEnvironmentPreset } from '../persistence/projectStore'

const empty = createEmptyProject('Roundtrip')
assert.equal(empty.schemaVersion, AUTOMOTIVE_SCHEMA_VERSION)
assert.equal(empty.presentation.accessPolicy, 'local-only')
assert.equal(empty.environment.presetId, 'studio')
assert.equal(empty.vehicle, null)

const migrated = migrateProject(empty)
assert.equal(migrated.id, empty.id)
assert.equal(migrated.name, 'Roundtrip')

const store = new ProjectStore(empty)
store.dispatch(renameProject('Demo Car'))
store.dispatch(setEnvironmentPreset('night'))
assert.equal(store.getSnapshot().project.name, 'Demo Car')
assert.equal(store.getSnapshot().project.environment.presetId, 'night')
assert.equal(store.getSnapshot().dirty, true)
assert.equal(store.getSnapshot().canUndo, true)

store.undo()
assert.equal(store.getSnapshot().project.environment.presetId, 'studio')
store.redo()
assert.equal(store.getSnapshot().project.environment.presetId, 'night')

const exported = store.exportProjectJson()
store.loadProject(exported)
assert.equal(store.getSnapshot().dirty, false)
assert.equal(store.getSnapshot().project.name, 'Demo Car')

console.log('schema.roundtrip: ok')
