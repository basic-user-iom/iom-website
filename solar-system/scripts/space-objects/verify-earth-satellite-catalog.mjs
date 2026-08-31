import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { json2satrec, propagate } from 'satellite.js'

import { checksumRecords, normalizeCelestrakRecord } from './catalog-tools.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const path = join(root, 'src', 'data', 'generated', 'earth-satellites.omm.v1.json')
const snapshot = JSON.parse(await readFile(path, 'utf8'))
if (snapshot.schemaVersion !== 1 || snapshot.format !== 'OMM-JSON') throw new Error('Unsupported Earth-satellite snapshot schema.')
if (!Array.isArray(snapshot.records) || snapshot.records.length === 0) throw new Error('Earth-satellite snapshot is empty.')
if (snapshot.checksum !== 'pending' && snapshot.checksum !== checksumRecords(snapshot.records)) throw new Error('Earth-satellite snapshot checksum mismatch.')
const ids = new Set()
for (const source of snapshot.records) {
  const record = normalizeCelestrakRecord(source, source.category)
  if (ids.has(record.NORAD_CAT_ID)) throw new Error(`Duplicate catalog ID ${record.NORAD_CAT_ID}.`)
  ids.add(record.NORAD_CAT_ID)
  const state = propagate(json2satrec(record), new Date(record.EPOCH))
  if (state === null || !Object.values(state.position).every(Number.isFinite) || !Object.values(state.velocity).every(Number.isFinite)) {
    throw new Error(`SGP4 validation failed for ${record.NORAD_CAT_ID}.`)
  }
}
console.log(JSON.stringify({ path, objectCount: snapshot.records.length, fallback: Boolean(snapshot.fallback), checksum: snapshot.checksum }, null, 2))
