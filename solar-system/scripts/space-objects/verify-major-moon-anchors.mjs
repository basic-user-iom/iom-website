import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const path = resolve(import.meta.dirname, '../../src/data/generated/major-moon-anchors.horizons.v1.json')
const artifact = JSON.parse(await readFile(path, 'utf8'))
if (artifact.schemaVersion !== 1 || artifact.catalogVersion !== 'major-moon-anchors.horizons.v1') throw new Error('Major-moon artifact schema mismatch.')
if (artifact.moonCount !== 24 || artifact.moons?.length !== 24) throw new Error('Major-moon artifact must contain 24 bodies.')
const ids = new Set()
for (const moon of artifact.moons) {
  if (ids.has(moon.id)) throw new Error(`Duplicate major moon ${moon.id}.`)
  ids.add(moon.id)
  if (moon.sampleCount < 2 || moon.valuesSi.length !== moon.sampleCount * 6) throw new Error(`${moon.id} anchor dimensions are invalid.`)
  if (!moon.valuesSi.every(Number.isFinite)) throw new Error(`${moon.id} contains non-finite values.`)
  const expectedEnd = moon.startJdTdb + (moon.sampleCount - 1) * moon.stepSeconds / 86_400
  if (Math.abs(expectedEnd - moon.endJdTdb) * 86_400 > 0.02) throw new Error(`${moon.id} anchors are not uniform.`)
}
const checksum = createHash('sha256').update(JSON.stringify(artifact.moons)).digest('hex')
if (checksum !== artifact.checksum) throw new Error('Major-moon anchor checksum mismatch.')
console.log(JSON.stringify({ moonCount: artifact.moonCount, anchorStepDays: artifact.anchorStepDays, checksum }, null, 2))
