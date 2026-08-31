import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const path = resolve(import.meta.dirname, '../../src/data/generated/spacecraft-trajectories.horizons.v1.json')
const artifact = JSON.parse(await readFile(path, 'utf8'))

if (artifact.schemaVersion !== 1 || artifact.catalogVersion !== 'spacecraft-trajectories.horizons.v1') {
  throw new Error('Spacecraft trajectory artifact schema/version mismatch.')
}
if (artifact.fallback !== false) throw new Error('Release spacecraft trajectories may not be marked as fallback data.')
if (artifact.missionCount !== 14 || artifact.missions?.length !== 14) {
  throw new Error(`Expected 14 spacecraft trajectories, received ${artifact.missions?.length ?? 0}.`)
}
const ids = new Set()
for (const mission of artifact.missions) {
  if (ids.has(mission.id)) throw new Error(`Duplicate spacecraft trajectory ${mission.id}.`)
  ids.add(mission.id)
  if (!/^-[0-9]+$/.test(mission.horizonsTargetId)) throw new Error(`${mission.id} has an invalid Horizons target ID.`)
  if (!Number.isInteger(mission.sampleCount) || mission.sampleCount < 2) throw new Error(`${mission.id} has too few samples.`)
  if (mission.valuesSi.length !== mission.sampleCount * 6) throw new Error(`${mission.id} vector length is invalid.`)
  if (!(mission.startJdTdb < mission.endJdTdb) || !(mission.stepSeconds > 0)) throw new Error(`${mission.id} coverage is invalid.`)
  const expectedEnd = mission.startJdTdb + (mission.sampleCount - 1) * mission.stepSeconds / 86_400
  if (Math.abs(expectedEnd - mission.endJdTdb) * 86_400 > 0.02) throw new Error(`${mission.id} samples are not uniform.`)
  if (!mission.valuesSi.every(Number.isFinite)) throw new Error(`${mission.id} includes a non-finite state component.`)
}
const checksum = createHash('sha256').update(JSON.stringify(artifact.missions)).digest('hex')
if (checksum !== artifact.checksum) throw new Error('Spacecraft trajectory checksum mismatch.')
console.log(JSON.stringify({ missionCount: artifact.missionCount, checksum, fallback: artifact.fallback }, null, 2))
