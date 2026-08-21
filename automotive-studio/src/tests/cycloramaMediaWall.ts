/**
 * Cyclorama media wall stage defaults + migration.
 * Run: npx tsx src/tests/cycloramaMediaWall.ts
 */
import assert from 'node:assert/strict'
import { migrateProject } from '../persistence/migrations'
import {
  AUTOMOTIVE_SCHEMA_VERSION,
  createEmptyProject,
} from '../persistence/schema'
import { collectReferencedAssetIds } from '../persistence/assetGc'

assert.equal(AUTOMOTIVE_SCHEMA_VERSION, 7)

const empty = createEmptyProject('Media wall')
assert.equal(empty.stage.cycloramaVolumeGlow, false)
assert.equal(empty.stage.cycloramaVolumeIntensity, 1)
assert.equal(empty.stage.cycloramaInteractive, true)
assert.equal(empty.stage.cycloramaVideoAssetId, null)
assert.equal(empty.stage.cycloramaVideoMuted, true)
assert.equal(empty.stage.cycloramaVideoLoop, true)
assert.equal(empty.stage.cycloramaVideoFit, 'cover')

const withVideo = createEmptyProject('With video')
withVideo.stage.cycloramaVideoAssetId = 'vid-1'
assert.ok(collectReferencedAssetIds(withVideo).has('vid-1'))

const legacy = {
  ...createEmptyProject('Legacy v6'),
  schemaVersion: 6 as const,
} as unknown

const migrated = migrateProject(legacy)
assert.equal(migrated.schemaVersion, 7)
assert.equal(migrated.stage.cycloramaVolumeGlow, false)
assert.equal(migrated.stage.cycloramaVideoAssetId, null)
assert.equal(migrated.stage.cycloramaVideoFit, 'cover')

console.log('cycloramaMediaWall: ok')
