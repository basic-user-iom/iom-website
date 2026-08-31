import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import { fetchHorizonsCached } from '../ephemeris/cache-fetch.mjs'
import { parseHorizonsVectors } from '../ephemeris/horizons-parser.mjs'
import { buildHorizonsRequestUrl } from '../ephemeris/horizons-request.mjs'

const ROOT = resolve(import.meta.dirname, '../..')
const CACHE_DIR = resolve(ROOT, '.cache/space-objects/horizons-spacecraft')
const OUTPUT_PATH = resolve(ROOT, 'src/data/generated/spacecraft-trajectories.horizons.v1.json')
const flags = new Set(process.argv.slice(2))

const CATALOG = Object.freeze({
  centerCommand: '500@10',
  centerId: '10',
  timeScale: 'TDB',
  sourceUnits: 'KM-S',
  referencePlane: 'ECLIPTIC',
  referenceFrame: 'ICRF',
})

// Sampling is deliberately denser for solar/planetary orbiters than for
// outbound cruise missions. Cubic Hermite interpolation uses the returned
// velocity at every knot and avoids the polygonal paths created by linearly
// connecting a few authored positions.
const MISSIONS = Object.freeze([
  mission('voyager-1', '-31', ['Voyager 1 (spacecraft)', 'Voyager 1'], '1977-09-06', '2031-01-01', 30),
  mission('voyager-2', '-32', ['Voyager 2 (spacecraft)', 'Voyager 2'], '1977-08-21', '2031-01-01', 30),
  mission('new-horizons', '-98', ['New Horizons (spacecraft)', 'New Horizons'], '2006-01-20', '2031-01-01', 14),
  mission('parker-solar-probe', '-96', ['Parker Solar Probe (spacecraft)', 'Parker Solar Probe'], '2018-08-13', '2029-12-31', 2),
  mission('solar-orbiter', '-144', ['Solar Orbiter (spacecraft)', 'Solar Orbiter'], '2020-02-11', '2029-12-31', 4),
  mission('juno', '-61', ['Juno (spacecraft)', 'Juno'], '2011-08-06', '2025-09-01', 2),
  mission('lucy', '-49', ['Lucy (spacecraft)', 'Lucy'], '2021-10-17', '2029-12-31', 7),
  mission('psyche', '-255', ['Psyche (spacecraft)', 'Psyche'], '2023-10-14', '2029-02-10', 4),
  mission('europa-clipper', '-159', ['Europa Clipper (spacecraft)', 'Europa Clipper'], '2024-10-15', '2029-12-31', 4),
  mission('juice', '-28', ['JUICE (spacecraft)', 'JUICE'], '2023-04-15', '2029-12-31', 4),
  mission('bepicolombo', '-121', ['BepiColombo (spacecraft)', 'BepiColombo'], '2018-10-21', '2027-04-10', 4),
  mission('osiris-apex', '-64', ['OSIRIS-REx (spacecraft)', 'OSIRIS-REx'], '2016-09-09', '2029-12-31', 4),
  mission('jwst', '-170', ['James Webb Space Telescope (spacecraft)', 'James Webb Space Telescope', 'JWST'], '2021-12-26', '2029-12-31', 2),
  mission('cassini', '-82', ['Cassini (spacecraft)', 'Cassini'], '1997-10-16', '2017-09-15', 2),
])

const generated = []
for (const definition of MISSIONS) {
  const stepSeconds = definition.stepDays * 86_400
  const body = {
    id: definition.id,
    targetId: definition.targetId,
    horizonsCommand: definition.targetId,
    expectedTargetNames: definition.expectedTargetNames,
  }
  const url = buildHorizonsRequestUrl({
    body,
    catalog: CATALOG,
    startDate: definition.startDate,
    endDate: definition.endDate,
    stepSeconds,
  })
  process.stdout.write(`Horizons ${definition.id} (${definition.targetId})... `)
  const response = await fetchHorizonsCached({
    url,
    cacheDir: CACHE_DIR,
    offline: flags.has('--offline'),
    refreshCache: flags.has('--refresh'),
  })
  const parsed = parseHorizonsVectors(response.text, {
    body,
    catalog: CATALOG,
    expectedStepSeconds: stepSeconds,
  })
  const valuesSi = Array.from(parsed.valuesSi, compactNumber)
  generated.push({
    id: definition.id,
    horizonsTargetId: definition.targetId,
    targetName: parsed.targetName,
    startJdTdb: parsed.startJdTdb,
    endJdTdb: parsed.endJdTdb,
    stepSeconds: parsed.stepSeconds,
    sampleCount: parsed.sampleCount,
    valuesSi,
    sourceSignature: parsed.sourceSignature,
  })
  process.stdout.write(`${parsed.sampleCount} vectors${response.cacheHit ? ' (cache)' : ''}\n`)
}

const checksum = createHash('sha256').update(JSON.stringify(generated)).digest('hex')
const artifact = {
  schemaVersion: 1,
  catalogVersion: 'spacecraft-trajectories.horizons.v1',
  retrievedAtUtc: new Date().toISOString(),
  generatorVersion: 'spacecraft-trajectories-2.0.0',
  sourceUrl: 'https://ssd.jpl.nasa.gov/api/horizons.api',
  sourceName: 'NASA/JPL Horizons vector ephemeris',
  center: '500@10',
  referenceFrame: 'ICRF',
  referencePlane: 'ECLIPTIC',
  timeScale: 'TDB',
  units: 'm and m/s',
  interpolation: 'piecewise cubic Hermite from Horizons position and velocity knots',
  fallback: false,
  missionCount: generated.length,
  checksum,
  missions: generated,
}
await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(artifact)}\n`, 'utf8')
console.log(`Wrote ${OUTPUT_PATH}`)
console.log(`Checksum ${checksum}`)

function mission(id, targetId, expectedTargetNames, startDate, endDate, stepDays) {
  return Object.freeze({ id, targetId, expectedTargetNames: Object.freeze(expectedTargetNames), startDate, endDate, stepDays })
}

function compactNumber(value) {
  if (!Number.isFinite(value)) throw new RangeError('Horizons trajectory contains a non-finite value.')
  return Number(value.toPrecision(15))
}
