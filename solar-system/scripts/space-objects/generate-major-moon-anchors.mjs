import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import { fetchHorizonsCached } from '../ephemeris/cache-fetch.mjs'
import { parseHorizonsVectors } from '../ephemeris/horizons-parser.mjs'
import { buildHorizonsRequestUrl } from '../ephemeris/horizons-request.mjs'

const ROOT = resolve(import.meta.dirname, '../..')
const CACHE_DIR = resolve(ROOT, '.cache/space-objects/horizons-major-moons')
const OUTPUT_PATH = resolve(ROOT, 'src/data/generated/major-moon-anchors.horizons.v1.json')
const flags = new Set(process.argv.slice(2))
const STEP_DAYS = 32
const STEP_SECONDS = STEP_DAYS * 86_400

const PARENTS = Object.freeze({
  earth: parent('399', '500@399', ['Earth']),
  mars: parent('499', '500@499', ['Mars']),
  jupiter: parent('599', '500@599', ['Jupiter']),
  saturn: parent('699', '500@699', ['Saturn']),
  uranus: parent('799', '500@799', ['Uranus']),
  neptune: parent('899', '500@899', ['Neptune']),
})

const MOONS = Object.freeze([
  moon('moon', '301', 'earth', ['Moon']),
  moon('phobos', '401', 'mars', ['Phobos']), moon('deimos', '402', 'mars', ['Deimos']),
  moon('io', '501', 'jupiter', ['Io']), moon('europa', '502', 'jupiter', ['Europa']),
  moon('ganymede', '503', 'jupiter', ['Ganymede']), moon('callisto', '504', 'jupiter', ['Callisto']),
  moon('mimas', '601', 'saturn', ['Mimas']), moon('enceladus', '602', 'saturn', ['Enceladus']),
  moon('tethys', '603', 'saturn', ['Tethys']), moon('dione', '604', 'saturn', ['Dione']),
  moon('rhea', '605', 'saturn', ['Rhea']), moon('titan', '606', 'saturn', ['Titan']),
  moon('hyperion', '607', 'saturn', ['Hyperion']), moon('iapetus', '608', 'saturn', ['Iapetus']),
  moon('phoebe', '609', 'saturn', ['Phoebe']),
  moon('ariel', '701', 'uranus', ['Ariel']), moon('umbriel', '702', 'uranus', ['Umbriel']),
  moon('titania', '703', 'uranus', ['Titania']), moon('oberon', '704', 'uranus', ['Oberon']),
  moon('miranda', '705', 'uranus', ['Miranda']),
  moon('triton', '801', 'neptune', ['Triton']), moon('nereid', '802', 'neptune', ['Nereid']),
  moon('proteus', '808', 'neptune', ['Proteus']),
])

const generated = []
for (const definition of MOONS) {
  const parentDefinition = PARENTS[definition.parentId]
  const catalog = {
    centerCommand: parentDefinition.centerCommand,
    centerId: parentDefinition.id,
    centerExpectedNames: parentDefinition.expectedNames,
    timeScale: 'TDB',
    sourceUnits: 'KM-S',
    referencePlane: 'ECLIPTIC',
    referenceFrame: 'ICRF',
  }
  const body = {
    id: definition.id,
    targetId: definition.targetId,
    horizonsCommand: definition.targetId,
    expectedTargetNames: definition.expectedNames,
  }
  const url = buildHorizonsRequestUrl({ body, catalog, startDate: '1990-01-01', endDate: '2036-01-01', stepSeconds: STEP_SECONDS })
  process.stdout.write(`Horizons ${definition.id} around ${definition.parentId}... `)
  const response = await fetchHorizonsCached({
    url,
    cacheDir: CACHE_DIR,
    offline: flags.has('--offline'),
    refreshCache: flags.has('--refresh'),
  })
  const parsed = parseHorizonsVectors(response.text, { body, catalog, expectedStepSeconds: STEP_SECONDS })
  generated.push({
    id: definition.id,
    parentId: definition.parentId,
    horizonsTargetId: definition.targetId,
    horizonsCenterId: parentDefinition.id,
    targetName: parsed.targetName,
    startJdTdb: parsed.startJdTdb,
    endJdTdb: parsed.endJdTdb,
    stepSeconds: parsed.stepSeconds,
    sampleCount: parsed.sampleCount,
    valuesSi: Array.from(parsed.valuesSi, compactNumber),
    sourceSignature: parsed.sourceSignature,
  })
  process.stdout.write(`${parsed.sampleCount} anchors${response.cacheHit ? ' (cache)' : ''}\n`)
}

const checksum = createHash('sha256').update(JSON.stringify(generated)).digest('hex')
const artifact = {
  schemaVersion: 1,
  catalogVersion: 'major-moon-anchors.horizons.v1',
  retrievedAtUtc: new Date().toISOString(),
  generatorVersion: 'major-moon-anchors-1.0.0',
  sourceUrl: 'https://ssd.jpl.nasa.gov/api/horizons.api',
  sourceName: 'NASA/JPL Horizons planetary satellite ephemerides',
  referenceFrame: 'ICRF',
  referencePlane: 'ECLIPTIC',
  timeScale: 'TDB',
  units: 'm and m/s',
  propagation: 'nearest preceding Horizons state propagated by absolute-time two-body dynamics; never linear interpolation of fast moon positions',
  fallbackOutsideCoverage: 'catalog orbital approximation',
  anchorStepDays: STEP_DAYS,
  moonCount: generated.length,
  checksum,
  moons: generated,
}
await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(artifact)}\n`, 'utf8')
console.log(`Wrote ${OUTPUT_PATH}`)
console.log(`Checksum ${checksum}`)

function parent(id, centerCommand, expectedNames) { return Object.freeze({ id, centerCommand, expectedNames }) }
function moon(id, targetId, parentId, expectedNames) { return Object.freeze({ id, targetId, parentId, expectedNames }) }
function compactNumber(value) {
  if (!Number.isFinite(value)) throw new RangeError('Moon anchor contains a non-finite value.')
  return Number(value.toPrecision(15))
}
