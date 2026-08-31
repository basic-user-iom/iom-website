import { createHash } from 'node:crypto'

const REQUIRED_NUMERIC_FIELDS = Object.freeze([
  'MEAN_MOTION',
  'ECCENTRICITY',
  'INCLINATION',
  'RA_OF_ASC_NODE',
  'ARG_OF_PERICENTER',
  'MEAN_ANOMALY',
])

export function normalizeCelestrakRecord(record, category) {
  if (typeof record !== 'object' || record === null) throw new TypeError('OMM record must be an object.')
  const catalogId = String(record.NORAD_CAT_ID ?? '').trim()
  if (!/^\d+$/.test(catalogId)) throw new RangeError('OMM NORAD_CAT_ID must be an integer string.')
  const epoch = new Date(record.EPOCH)
  if (!Number.isFinite(epoch.getTime())) throw new RangeError(`OMM epoch is invalid for ${catalogId}.`)
  const output = {
    OBJECT_NAME: String(record.OBJECT_NAME ?? '').trim() || `Catalog ${catalogId}`,
    OBJECT_ID: String(record.OBJECT_ID ?? '').trim(),
    NORAD_CAT_ID: catalogId,
    EPOCH: epoch.toISOString(),
    EPHEMERIS_TYPE: Number(record.EPHEMERIS_TYPE ?? 0),
    CLASSIFICATION_TYPE: record.CLASSIFICATION_TYPE === 'C' ? 'C' : 'U',
    ELEMENT_SET_NO: finiteNumber(record.ELEMENT_SET_NO ?? 0, 'ELEMENT_SET_NO', catalogId),
    REV_AT_EPOCH: finiteNumber(record.REV_AT_EPOCH ?? 0, 'REV_AT_EPOCH', catalogId),
    BSTAR: finiteNumber(record.BSTAR ?? 0, 'BSTAR', catalogId),
    MEAN_MOTION_DOT: finiteNumber(record.MEAN_MOTION_DOT ?? 0, 'MEAN_MOTION_DOT', catalogId),
    MEAN_MOTION_DDOT: finiteNumber(record.MEAN_MOTION_DDOT ?? 0, 'MEAN_MOTION_DDOT', catalogId),
    category,
  }
  for (const field of REQUIRED_NUMERIC_FIELDS) output[field] = finiteNumber(record[field], field, catalogId)
  if (output.MEAN_MOTION <= 0 || output.ECCENTRICITY < 0 || output.ECCENTRICITY >= 1) {
    throw new RangeError(`OMM orbital elements are invalid for ${catalogId}.`)
  }
  return Object.freeze(output)
}

export function checksumRecords(records) {
  return createHash('sha256').update(JSON.stringify(records)).digest('hex')
}

export function createEarthSatelliteSnapshot({ records, retrievedAtUtc, fallback = false }) {
  if (!Array.isArray(records) || records.length === 0) throw new RangeError('Generated OMM snapshot cannot be empty.')
  const seen = new Set()
  for (const record of records) {
    if (seen.has(record.NORAD_CAT_ID)) throw new Error(`Duplicate NORAD catalog ID ${record.NORAD_CAT_ID}.`)
    seen.add(record.NORAD_CAT_ID)
  }
  return {
    schemaVersion: 1,
    catalogVersion: 'earth-satellites.omm.v1',
    retrievedAtUtc,
    sourceUrl: 'https://celestrak.org/NORAD/elements/gp.php',
    format: 'OMM-JSON',
    generatorVersion: 'earth-satellites-2.0.0',
    fallback,
    checksum: checksumRecords(records),
    records,
  }
}

function finiteNumber(value, field, catalogId) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) throw new RangeError(`OMM ${field} is invalid for ${catalogId}.`)
  return numeric
}
