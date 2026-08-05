/**
 * Phase C celestial helpers.
 * Run: npx tsx src/tests/phase-c-celestial.ts
 */
import assert from 'node:assert/strict'
import { DEFAULT_ANGULAR_DIAMETER_DEG, directionFromAzEl } from '../environment/celestialLayer'
import { createEmptyProject } from '../persistence/schema'

assert.equal(DEFAULT_ANGULAR_DIAMETER_DEG, 0.53)

const up = directionFromAzEl(0, 90)
assert.ok(Math.abs(up.y - 1) < 1e-6, 'elevation 90 → +Y')

const east = directionFromAzEl(90, 0)
assert.ok(Math.abs(east.x - 1) < 1e-6, 'azimuth 90 → +X')

const env = createEmptyProject().environment
assert.equal(typeof env.moonAzimuthDeg, 'number')
assert.equal(typeof env.sunAzimuthDeg, 'number')
assert.notEqual(env.moonAzimuthDeg, env.sunAzimuthDeg)
assert.equal(env.sunAngularDiameterDeg, 0.53)
assert.equal(env.moonAngularDiameterDeg, 0.53)

console.log('phase-c-celestial: ok')
