import assert from 'node:assert/strict'
import test from 'node:test'

import { createEarthSatelliteSnapshot, normalizeCelestrakRecord } from '../catalog-tools.mjs'

const fixture = {
  OBJECT_NAME: 'TEST', OBJECT_ID: '2026-001A', NORAD_CAT_ID: 123456,
  EPOCH: '2026-08-31T00:00:00Z', MEAN_MOTION: 15, ECCENTRICITY: 0.001,
  INCLINATION: 51, RA_OF_ASC_NODE: 10, ARG_OF_PERICENTER: 20, MEAN_ANOMALY: 30,
  BSTAR: 0, MEAN_MOTION_DOT: 0, MEAN_MOTION_DDOT: 0,
}

test('normalizes six-digit catalog IDs and OMM epochs', () => {
  const record = normalizeCelestrakRecord(fixture, 'science')
  assert.equal(record.NORAD_CAT_ID, '123456')
  assert.equal(record.EPOCH, '2026-08-31T00:00:00.000Z')
})

test('creates a deterministic checksummed snapshot', () => {
  const record = normalizeCelestrakRecord(fixture, 'science')
  const left = createEarthSatelliteSnapshot({ records: [record], retrievedAtUtc: '2026-08-31T00:00:00.000Z' })
  const right = createEarthSatelliteSnapshot({ records: [record], retrievedAtUtc: '2026-08-31T00:00:00.000Z' })
  assert.equal(left.checksum, right.checksum)
  assert.equal(left.records.length, 1)
})
