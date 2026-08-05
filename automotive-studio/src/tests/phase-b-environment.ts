/**
 * Phase B environment helpers.
 * Run: npx tsx src/tests/phase-b-environment.ts
 */
import assert from 'node:assert/strict'
import { iblFamilyForPreset } from '../renderer/createIbl'
import { resolveVisualPreset, stagePolicyForPreset } from '../environment/applyEnvironment'
import { createEmptyProject } from '../persistence/schema'

assert.equal(iblFamilyForPreset('studio'), 'studio')
assert.equal(iblFamilyForPreset('day'), 'day')
assert.equal(iblFamilyForPreset('custom'), 'studio')

const env = createEmptyProject().environment
env.presetId = 'custom'
env.basePresetId = 'golden-hour'
env.sunElevationDeg = 2
assert.equal(resolveVisualPreset(env), 'golden-hour', 'custom keeps basePresetId')

assert.equal(stagePolicyForPreset('studio').cycloramaVisible, true)
assert.equal(stagePolicyForPreset('day').cycloramaVisible, false)
assert.equal(stagePolicyForPreset('night').cycloramaVisible, false)

console.log('phase-b-environment: ok')
