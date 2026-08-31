import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

import { createEarthSatelliteSnapshot, normalizeCelestrakRecord } from './catalog-tools.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const cacheDirectory = join(root, '.cache', 'space-objects', 'celestrak')
const outputPath = join(root, 'src', 'data', 'generated', 'earth-satellites.omm.v1.json')
const offline = process.argv.includes('--offline')
const refresh = process.argv.includes('--refresh')
const selections = Object.freeze([
  { catalogId: '25544', category: 'space-stations' },
  { catalogId: '20580', category: 'science' },
  { catalogId: '25994', category: 'weather' },
  { catalogId: '24876', category: 'navigation' },
  { catalogId: '44235', category: 'communications' },
])

const records = []
let newestRetrieval = ''
for (const selection of selections) {
  const result = await fetchRecord(selection.catalogId)
  const payload = JSON.parse(result.text)
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new Error(`CelesTrak ${selection.catalogId} returned ${Array.isArray(payload) ? payload.length : 'non-array'} records.`)
  }
  records.push(normalizeCelestrakRecord(payload[0], selection.category))
  if (result.retrievedAtUtc > newestRetrieval) newestRetrieval = result.retrievedAtUtc
}

const snapshot = createEarthSatelliteSnapshot({ records, retrievedAtUtc: newestRetrieval })
await mkdir(dirname(outputPath), { recursive: true })
const temporaryPath = `${outputPath}.${process.pid}.tmp`
await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
await rename(temporaryPath, outputPath)
console.log(JSON.stringify({ outputPath, objectCount: records.length, retrievedAtUtc: newestRetrieval, checksum: snapshot.checksum }, null, 2))

async function fetchRecord(catalogId) {
  const cachePath = join(cacheDirectory, `${catalogId}.json`)
  if (!refresh) {
    try {
      const text = await readFile(cachePath, 'utf8')
      return { text, retrievedAtUtc: (await stat(cachePath)).mtime.toISOString() }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  if (offline) throw new Error(`Offline cache miss for CelesTrak catalog ${catalogId}.`)
  const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${catalogId}&FORMAT=JSON`
  let lastError
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'iom-solar-system-data-generator/2.0' }, signal: AbortSignal.timeout(30_000) })
      const text = await response.text()
      if (!response.ok) throw new Error(`CelesTrak HTTP ${response.status}: ${text.slice(0, 160)}`)
      JSON.parse(text)
      await mkdir(cacheDirectory, { recursive: true })
      const temporaryPath = `${cachePath}.${process.pid}.tmp`
      await writeFile(temporaryPath, text, 'utf8')
      await rename(temporaryPath, cachePath)
      return { text, retrievedAtUtc: new Date().toISOString() }
    } catch (error) {
      lastError = error
      if (attempt < 3) await delay(750 * 2 ** attempt)
    }
  }
  throw new Error(`CelesTrak request failed for ${catalogId}: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}
