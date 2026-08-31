/**
 * Generate or verify the SHA-bound collision activation evidence used by the
 * dormant manifest-v3 streaming route.
 *
 * The broad-coverage grid is derived from the production Web visual model.
 * Probe hits, named-stair support, bounds, chunks, and triangles are measured
 * from the exact post-build collision geometry used by the browser.
 *
 * Usage:
 *   node scripts/generate-collision-activation-evidence.mjs --id icm-anim-2025 --inspect
 *   node scripts/generate-collision-activation-evidence.mjs --id icm-anim-2025 --visual tmp/candidate.glb
 *   node scripts/generate-collision-activation-evidence.mjs --id icm-anim-2025 --write
 *   node scripts/generate-collision-activation-evidence.mjs --id icm-anim-2025
 */
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

import { createGltfIO } from './lib/gltf-io.mjs'
import {
  disposeLoadedRoot,
  inspectPinnedFile,
  loadCollisionGlbRoot,
} from './lib/collision-activation-assets.mjs'
import {
  BAND,
  REQUIRED_ANIMATED_STAIRS,
  WALKABLE_UP,
  binKey,
  collectGeometry,
  inEnvelope,
  robustEnvelope,
} from './validate-collision-coverage.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')
const REPOSITORY_DIR = join(PROJECT_DIR, '..')
const PUBLIC_DIR = join(REPOSITORY_DIR, 'public')
const MANIFEST_PATH = join(PUBLIC_DIR, 'models', 'manifest.json')
const MIN_VISUAL_SAMPLES_PER_CELL = 40
const NUMBER_EPSILON = 1e-8
const UUID_SUFFIX = /_([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i
const STAIR_NAME = /stair|step|tread|riser|landing|treppe|stufe|stufen|podest/i

function parseArgs(argv) {
  const args = {
    id: 'icm-anim-2025',
    spec: null,
    coverage: null,
    contract: null,
    visual: null,
    inspect: false,
    write: false,
  }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--id') args.id = argv[++index]
    else if (value === '--spec') args.spec = resolve(argv[++index])
    else if (value === '--coverage') args.coverage = resolve(argv[++index])
    else if (value === '--contract') args.contract = resolve(argv[++index])
    else if (value === '--visual') args.visual = resolve(argv[++index])
    else if (value === '--inspect') args.inspect = true
    else if (value === '--write') args.write = true
    else throw new Error(`Unknown argument: ${value}`)
  }
  const modelDir = join(PUBLIC_DIR, 'models', args.id)
  args.spec ??= join(SCRIPT_DIR, 'fixtures', `${args.id}-collision-probes-v1.json`)
  args.coverage ??= join(modelDir, 'collision-coverage-v1.json')
  args.contract ??= join(modelDir, 'collision-activation-v1.json')
  return args
}

function publicPath(url) {
  return join(PUBLIC_DIR, url.replace(/^\//, ''))
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function triangleAt(geometry, triangleIndex, chunkName) {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const ia = index ? index.getX(triangleIndex * 3) : triangleIndex * 3
  const ib = index ? index.getX(triangleIndex * 3 + 1) : triangleIndex * 3 + 1
  const ic = index ? index.getX(triangleIndex * 3 + 2) : triangleIndex * 3 + 2
  const a = [position.getX(ia), position.getY(ia), position.getZ(ia)]
  const b = [position.getX(ib), position.getY(ib), position.getZ(ib)]
  const c = [position.getX(ic), position.getY(ic), position.getZ(ic)]
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const uz = b[2] - a[2]
  const vx = c[0] - a[0]
  const vy = c[1] - a[1]
  const vz = c[2] - a[2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const length = Math.hypot(nx, ny, nz)
  return {
    a,
    b,
    c,
    x: (a[0] + b[0] + c[0]) / 3,
    y: (a[1] + b[1] + c[1]) / 3,
    z: (a[2] + b[2] + c[2]) / 3,
    upDot: length > NUMBER_EPSILON ? Math.abs(ny / length) : 0,
    chunkName,
  }
}

function collectRuntimeSurfaces(chunks) {
  const triangles = []
  for (const chunk of chunks) {
    const position = chunk.geometry.getAttribute('position')
    const index = chunk.geometry.getIndex()
    const count = index ? index.count / 3 : position.count / 3
    for (let triangle = 0; triangle < count; triangle += 1) {
      triangles.push(triangleAt(chunk.geometry, triangle, chunk.name))
    }
  }
  return triangles
}

function yAtXZ(triangle, x, z) {
  const [x1, y1, z1] = triangle.a
  const [x2, y2, z2] = triangle.b
  const [x3, y3, z3] = triangle.c
  const denominator = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3)
  if (Math.abs(denominator) < NUMBER_EPSILON) return null
  const u = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / denominator
  const v = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / denominator
  const w = 1 - u - v
  if (u < -1e-6 || v < -1e-6 || w < -1e-6) return null
  return u * y1 + v * y2 + w * y3
}

function measureProbe(probe, horizontalSurfaces) {
  const [x, originY, z] = probe.point
  let best = null
  for (const triangle of horizontalSurfaces) {
    const y = yAtXZ(triangle, x, z)
    if (y === null || y > originY + 1e-5) continue
    if (!best || y > best.y) best = { triangle, y }
  }
  if (!best) {
    return {
      id: probe.id,
      kind: probe.kind,
      point: probe.point,
      supported: false,
      hitPoint: null,
      upDot: null,
      verticalErrorMeters: null,
    }
  }
  return {
    id: probe.id,
    kind: probe.kind,
    point: probe.point,
    supported: true,
    hitPoint: [x, best.y, z],
    upDot: best.triangle.upDot,
    verticalErrorMeters: Math.abs(originY - best.y),
  }
}

function collisionOwner(chunkName) {
  const colliderIndex = chunkName.lastIndexOf('COLLIDER_')
  if (colliderIndex < 0) return chunkName
  const raw = chunkName.slice(colliderIndex + 'COLLIDER_'.length)
  return raw.replace(UUID_SUFFIX, '')
}

function runtimeNamedStairStats(ids, chunks, surfaces) {
  const chunksByOwner = new Map()
  for (const chunk of chunks) {
    const owner = collisionOwner(chunk.name)
    const list = chunksByOwner.get(owner)
    if (list) list.push(chunk)
    else chunksByOwner.set(owner, [chunk])
  }
  const surfacesByOwner = new Map()
  for (const surface of surfaces) {
    const owner = collisionOwner(surface.chunkName)
    const list = surfacesByOwner.get(owner)
    if (list) list.push(surface)
    else surfacesByOwner.set(owner, [surface])
  }

  return ids.map((id) => {
    const ownerChunks = chunksByOwner.get(id) ?? []
    const ownerSurfaces = surfacesByOwner.get(id) ?? []
    const horizontal = ownerSurfaces.filter((surface) => surface.upDot >= WALKABLE_UP)
    const totalTriangles = ownerChunks.reduce((sum, chunk) => sum + chunk.triangles, 0)
    return {
      id,
      present: ownerChunks.length > 0,
      horizontalTriangles: horizontal.length,
      supportCoverageRatio: totalTriangles > 0 ? horizontal.length / totalTriangles : 0,
      minY: horizontal.length ? Math.min(...horizontal.map((surface) => surface.y)) : null,
      maxY: horizontal.length ? Math.max(...horizontal.map((surface) => surface.y)) : null,
    }
  })
}

function authoredNamedStairStats(ids, ownerStats) {
  return ids.map((id) => {
    const stat = ownerStats.get(id)
    return {
      id,
      present: Boolean(stat),
      horizontalTriangles: stat?.horizontalTriangles ?? 0,
      supportCoverageRatio: stat?.triangles ? stat.horizontalTriangles / stat.triangles : 0,
      minY: stat?.minHorizontalY ?? null,
      maxY: stat?.maxHorizontalY ?? null,
    }
  })
}

function authoredProbeSuggestions(ids, samples) {
  return ids.map((id) => {
    const matching = samples
      .filter((sample) => sample.horizontal && sample.owner.split('/').some((part) => part.replace(/^COLLIDER_/i, '') === id))
      .sort((a, b) => a.y - b.y)
    const selected = matching.length
      ? [matching[0], matching[Math.floor(matching.length / 2)], matching.at(-1)]
      : []
    return {
      id,
      suggestedProbePoints: selected.map((sample) => [sample.x, sample.y + 0.1, sample.z]),
    }
  })
}

function broadCoverage(visualSamples, runtimeSurfaces) {
  const envelope = robustEnvelope(visualSamples)
  const requiredCounts = new Map()
  for (const sample of visualSamples) {
    if (!sample.named || !sample.horizontal || !inEnvelope(sample, envelope)) continue
    const key = binKey(sample)
    requiredCounts.set(key, (requiredCounts.get(key) ?? 0) + 1)
  }
  const requiredKeys = [...requiredCounts.entries()]
    .filter(([, count]) => count >= MIN_VISUAL_SAMPLES_PER_CELL)
    .map(([key]) => key)
    .sort()
  const collisionKeys = new Set()
  for (const surface of runtimeSurfaces) {
    if (surface.upDot < WALKABLE_UP || !inEnvelope(surface, envelope)) continue
    collisionKeys.add(binKey(surface))
  }

  const bands = new Map()
  let coveredCells = 0
  for (const key of requiredKeys) {
    const bandIndex = Number(key.split('|')[0])
    const covered = collisionKeys.has(key)
    if (covered) coveredCells += 1
    const band = bands.get(bandIndex) ?? { requiredCells: 0, coveredCells: 0 }
    band.requiredCells += 1
    if (covered) band.coveredCells += 1
    bands.set(bandIndex, band)
  }
  const requiredCells = requiredKeys.length
  return {
    requiredCells,
    coveredCells,
    missingCells: requiredCells - coveredCells,
    ratio: requiredCells > 0 ? coveredCells / requiredCells : 0,
    elevationBands: [...bands.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bandIndex, counts]) => ({
        id: `band-${bandIndex}`,
        minY: bandIndex * BAND,
        maxY: (bandIndex + 1) * BAND,
        ...counts,
      })),
  }
}

function inspectRows(chunks, surfaces) {
  const owners = [...new Set(chunks.map((chunk) => collisionOwner(chunk.name)))]
    .filter((name) => STAIR_NAME.test(name))
    .sort()
  return runtimeNamedStairStats(owners, chunks, surfaces).map((row) => {
    const horizontal = surfaces
      .filter((surface) => collisionOwner(surface.chunkName) === row.id && surface.upDot >= WALKABLE_UP)
      .sort((a, b) => a.y - b.y)
    const selected = horizontal.length
      ? [horizontal[0], horizontal[Math.floor(horizontal.length / 2)], horizontal.at(-1)]
      : []
    return {
      ...row,
      suggestedProbePoints: selected.map((surface) => [surface.x, surface.y + 0.1, surface.z]),
    }
  })
}

function validateSpec(spec, modelId) {
  if (!spec || spec.version !== 1 || spec.modelId !== modelId) {
    throw new Error(`Probe specification must be version 1 for ${modelId}`)
  }
  if (!Array.isArray(spec.probes) || spec.probes.length < 2) {
    throw new Error('Probe specification must contain at least two authored probes')
  }
  if (!Array.isArray(spec.namedStairs) || spec.namedStairs.length < 1) {
    throw new Error('Probe specification must name the measured stairs')
  }
  if (!spec.requirements || !Array.isArray(spec.requirements.requiredStairs)) {
    throw new Error('Probe specification must contain activation requirements')
  }
}

async function compareOrWrite(path, content, write) {
  if (write) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content)
    return 'written'
  }
  let current
  try {
    current = await readFile(path, 'utf8')
  } catch {
    throw new Error(`Generated evidence is missing: ${path} (run with --write)`)
  }
  if (current !== content) {
    throw new Error(`Generated evidence is stale: ${path} (run with --write and review the pin change)`)
  }
  return 'verified'
}

async function main() {
  const args = parseArgs(process.argv)
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
  const entry = manifest.models.find((candidate) => candidate.id === args.id)
  if (!entry?.collision || !entry.web) throw new Error(`${args.id} requires Web visual and collision routes`)
  const collisionPath = publicPath(entry.collision)
  const visualPath = args.visual ?? publicPath(entry.web)
  await Promise.all([access(collisionPath), access(visualPath)])

  const collisionFile = await inspectPinnedFile(collisionPath)
  const vite = await createServer({
    root: PROJECT_DIR,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  })
  let root = null
  let collision = null
  try {
    const [activationModule, dedicatedModule] = await Promise.all([
      vite.ssrLoadModule('/src/collision/collisionActivationContract.ts'),
      vite.ssrLoadModule('/src/collision/dedicatedCollisionValidation.ts'),
    ])
    root = await loadCollisionGlbRoot(collisionPath)
    const validation = dedicatedModule.validateDedicatedCollisionRoot(root, args.id, false)
    if (!validation.valid || !validation.collision) {
      throw new Error(`Runtime collision validation failed: ${validation.reason}`)
    }
    collision = validation.collision
    const runtimeSurfaces = collectRuntimeSurfaces(collision.chunks)

    if (args.inspect) {
      const io = await createGltfIO()
      const authored = collectGeometry(await io.read(collisionPath), {
        collectSurfaces: false,
        collectOwners: true,
      })
      console.log(JSON.stringify({
        collision: { ...collisionFile, runtime: collision.runtimeMetrics },
        authoredAnimatedStairs: authoredNamedStairStats(
          REQUIRED_ANIMATED_STAIRS,
          authored.ownerStats,
        ),
        authoredProbeSuggestions: authoredProbeSuggestions(
          REQUIRED_ANIMATED_STAIRS,
          authored.stairSamples,
        ),
        stairCandidates: inspectRows(collision.chunks, runtimeSurfaces),
      }, null, 2))
      return
    }

    const spec = JSON.parse(await readFile(args.spec, 'utf8'))
    validateSpec(spec, args.id)
    const io = await createGltfIO()
    const [visualDocument, collisionDocument] = await Promise.all([
      io.read(visualPath),
      io.read(collisionPath),
    ])
    const visual = collectGeometry(visualDocument, {
      collectSurfaces: false,
      collectOwners: false,
    })
    const authoredCollision = collectGeometry(collisionDocument, {
      collectSurfaces: false,
      collectOwners: true,
    })
    const horizontalSurfaces = runtimeSurfaces.filter((surface) => surface.upDot >= WALKABLE_UP)
    const probes = spec.probes.map((probe) => measureProbe(probe, horizontalSurfaces))
    const spawn = probes.find((probe) => probe.id === spec.requirements.spawnProbeId)
    if (!spawn) throw new Error(`Spawn probe is missing: ${spec.requirements.spawnProbeId}`)
    const coverage = {
      version: 1,
      modelId: args.id,
      collision: {
        sha256: collisionFile.sha256,
        bytes: collisionFile.bytes,
        runtime: collision.runtimeMetrics,
      },
      spawnSupport: spawn,
      broadHorizontalCoverage: broadCoverage(visual.samples, runtimeSurfaces),
      probes,
      namedStairs: authoredNamedStairStats(spec.namedStairs, authoredCollision.ownerStats),
    }
    const coverageText = stableJson(coverage)
    const coverageBytes = Buffer.from(coverageText, 'utf8')
    const coveragePin = { sha256: sha256(coverageBytes), bytes: coverageBytes.byteLength }
    const contract = {
      version: 1,
      modelId: args.id,
      collision: {
        url: entry.collision,
        sha256: collisionFile.sha256,
        bytes: collisionFile.bytes,
        runtime: collision.runtimeMetrics,
      },
      coverageReport: {
        url: `/models/${args.id}/collision-coverage-v1.json`,
        ...coveragePin,
      },
      requirements: {
        spawnProbeId: spec.requirements.spawnProbeId,
        minHorizontalCoverageRatio: spec.requirements.minHorizontalCoverageRatio,
        minHorizontalCoveredCells: spec.requirements.minHorizontalCoveredCells,
        minElevationBands: spec.requirements.minElevationBands,
        minElevationSeparationMeters: spec.requirements.minElevationSeparationMeters,
        requiredProbes: spec.probes.map((probe) => ({
          id: probe.id,
          minUpDot: probe.minUpDot,
          maxVerticalErrorMeters: probe.maxVerticalErrorMeters,
        })),
        requiredStairs: spec.requirements.requiredStairs,
      },
    }
    const evidence = {
      collisionSha256: collisionFile.sha256,
      collisionBytes: collisionFile.bytes,
      coverageReportSha256: coveragePin.sha256,
      coverageReportBytes: coveragePin.bytes,
      runtime: collision.runtimeMetrics,
    }
    const result = activationModule.validateCollisionActivationEvidence(contract, coverage, evidence)
    if (!result.valid) {
      throw new Error(`Generated activation evidence is invalid:\n${result.errors.map((error) => `  - ${error}`).join('\n')}`)
    }
    const contractText = stableJson(contract)
    const [coverageStatus, contractStatus] = await Promise.all([
      compareOrWrite(args.coverage, coverageText, args.write),
      compareOrWrite(args.contract, contractText, args.write),
    ])
    console.log(
      `Collision evidence ${coverageStatus}/${contractStatus}: ${coverage.broadHorizontalCoverage.coveredCells}/` +
      `${coverage.broadHorizontalCoverage.requiredCells} cells, ${probes.length} probes, ` +
      `${result.summary.validatedStairs}/${contract.requirements.requiredStairs.length} required stairs`,
    )
    console.log(`Coverage pin: ${coveragePin.sha256} / ${coveragePin.bytes} bytes`)
    console.log(`Contract pin: ${sha256(Buffer.from(contractText, 'utf8'))} / ${Buffer.byteLength(contractText)} bytes`)
  } finally {
    if (collision) dedicatedDispose(collision.chunks)
    if (root) disposeLoadedRoot(root)
    await vite.close()
  }
}

function dedicatedDispose(chunks) {
  for (const chunk of chunks) chunk.geometry.dispose()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
