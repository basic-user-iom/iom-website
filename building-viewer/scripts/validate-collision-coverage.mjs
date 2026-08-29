/**
 * Validate the dedicated collision route against the production visual GLB.
 *
 * This is deliberately stricter around stairs than the general floor check:
 * broad floor cells can look occupied even when a door, riser, or fixture is
 * the only collision in the cell. Stair validation therefore compares actual
 * walkable triangle surfaces at matching X/Z and elevation, and checks the
 * authored primary ICM stair owners independently of mesh/material batching.
 *
 * Usage:
 *   node scripts/validate-collision-coverage.mjs --id icm-anim-2025
 *   node scripts/validate-collision-coverage.mjs --id icm-ext
 *   node scripts/validate-collision-coverage.mjs --id icm-anim-2025 \
 *     --collision tmp/rebuild-probe/icm-anim-collision-stairs-v9.glb
 */
import { access, readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PropertyType } from '@gltf-transform/core'
import { createGltfIO } from './lib/gltf-io.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const MANIFEST_PATH = join(ROOT, 'public', 'models', 'manifest.json')
const PUBLIC = join(ROOT, 'public')

export const BAND = 3.6
export const CELL = 12
const SURFACE_GRID = 1
export const WALKABLE_UP = Math.cos((50 * Math.PI) / 180)
const STAIR_VERTICAL_TOLERANCE = 0.16
const MIN_STAIR_COVERAGE = 0.82
const MAX_MISSING_CELLS = 80

const WALK =
  /floor|stairs?|steps?|ground|slab|ramp|landing|tread|riser|plaza|terrain|walkway|path|pavement|sidewalk|kerb|curb|platform|lobby|foyer|corridor|hallway|mezzanine|galerie|gallery|storey|geschoss|etage|flur|diele|gang|treppe|stufen?|podest|boden|lauf_treppe|etagentreppe|tile|fliese|\.bt\d?|(?<![a-z])deck(?![a-z])/i
const STAIR =
  /stairs?|steps?|tread|riser|landing|ramp|treppe|stufe|stufen|podest|lauf_treppe|etagentreppe|laufband|rolltreppe|escalator/i

/** Owner semantics override a reused material such as `treppe_naturstein`. */
const REJECT_OWNER =
  /door|doors|tuer|tueren|tür|türen|handle|griff|fixture|furniture|moebel|möbel|mbel|wardrobe|hanger|chair|table|desk|sofa|cabinet|shelf|screen|monitor|light|licht|lamp|leuchte|lueftung|lüftung|lftung|luefter|lüfter|lfter|ventilation|sprinkler|sprenkler|ceiling|decke|soffit|wall|wand|wnde|waende|window|fenster|glass|glazing|scheib|sign|schild|logo|plant|foliage|curtain|decal|jalousie|railing|handrail|handlauf|gelaender|geländer|gelander|gitter|grille|trager|träger|trger|saeule|säule|fahrstuhl|elevator|unterbau|sockel|schraube|borsten|seil|sprecher|bruestung|brüstung|fassade/i
const REJECT_MATERIAL =
  /glass|window|glazing|fenster|scheib|sign|schild|light|lamp|furniture|chair|table|desk|sofa|plant|foliage|curtain|decal|logo|icon|screen|monitor|decke|ceiling|soffit|fixture|cabinet|shelf|handrail|handlauf|gelaender|geländer|gelander|gitter|grille|trager|träger|unterbau|sockel|schraube|borsten/i

export const REQUIRED_ANIMATED_STAIRS = [
  'Podest',
  'TR_Stufen001',
  'TR_Stufen008',
  'TR_Stufen010',
  'Boden_2_Tafeln_Foyer_Treppe',
  'Boden_2_Tafeln_Foyer_Treppe001',
  'TR_Stufen',
  'TR_Stufen_001',
  'TR_Stufen_002',
  'TR_Stufen_003',
  'TR_Stufen004',
  'TR_Stufen004_001',
  'TR_Stufen005',
]

function parseArgs(argv) {
  const args = { id: 'icm-anim-2025', collision: null }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--id') args.id = argv[++i]
    else if (argv[i] === '--collision') args.collision = argv[++i]
  }
  return args
}

function publicPath(url) {
  return join(PUBLIC, url.replace(/^\//, ''))
}

function resolveOverride(path) {
  if (!path) return null
  return isAbsolute(path) ? path : resolve(process.cwd(), path)
}

function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ]
}

function multiplyMatrices(a, b) {
  const out = new Array(16).fill(0)
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[row] * b[col * 4] +
        a[4 + row] * b[col * 4 + 1] +
        a[8 + row] * b[col * 4 + 2] +
        a[12 + row] * b[col * 4 + 3]
    }
  }
  return out
}

function composeMatrix(translation, rotation, scale) {
  const [x, y, z, w] = rotation
  const [sx, sy, sz] = scale
  const x2 = x + x
  const y2 = y + y
  const z2 = z + z
  const xx = x * x2
  const xy = x * y2
  const xz = x * z2
  const yy = y * y2
  const yz = y * z2
  const zz = z * z2
  const wx = w * x2
  const wy = w * y2
  const wz = w * z2
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    translation[0],
    translation[1],
    translation[2],
    1,
  ]
}

function accessorElement(accessor, index, fallback) {
  if (!accessor) return [...fallback]
  const out = new Array(fallback.length)
  accessor.getElement(index, out)
  return out
}

/** Expand EXT_mesh_gpu_instancing so validation matches GLTFLoader/runtime work. */
function nodeWorldMatrices(node) {
  const nodeWorld = node.getWorldMatrix()
  const instancing = node.getExtension('EXT_mesh_gpu_instancing')
  if (!instancing) return [nodeWorld]
  const translation = instancing.getAttribute?.('TRANSLATION')
  const rotation = instancing.getAttribute?.('ROTATION')
  const scale = instancing.getAttribute?.('SCALE')
  const count = translation?.getCount() || rotation?.getCount() || scale?.getCount() || 1
  const matrices = []
  for (let i = 0; i < count; i++) {
    const local = composeMatrix(
      accessorElement(translation, i, [0, 0, 0]),
      accessorElement(rotation, i, [0, 0, 0, 1]),
      accessorElement(scale, i, [1, 1, 1]),
    )
    matrices.push(multiplyMatrices(nodeWorld, local))
  }
  return matrices
}

function nodeParent(node) {
  return node.listParents().find((parent) => parent.propertyType === PropertyType.NODE) || null
}

function semanticOwnerPath(node) {
  const names = []
  let current = node
  while (current) {
    const name = current.getName()?.trim()
    if (name) names.push(name)
    current = nodeParent(current)
  }
  return names.reverse().join('/')
}

function semanticInfo(node, mesh, material) {
  const owner = semanticOwnerPath(node)
  const nodeName = node.getName()?.trim() || ''
  const meshName = mesh.getName()?.trim() || ''
  const materialName = material?.getName()?.trim() || ''
  const ownerText = `${owner} ${nodeName} ${meshName}`.trim()
  const allText = `${ownerText} ${materialName}`.trim()
  return { owner, nodeName, meshName, materialName, ownerText, allText }
}

function rejectedSemantic(info) {
  return REJECT_OWNER.test(info.ownerText) || REJECT_MATERIAL.test(info.materialName)
}

function primSize(prim) {
  const attr = prim.getAttribute('POSITION')
  if (!attr) return null
  const min = attr.getMin([])
  const max = attr.getMax([])
  if (!min?.length || !max?.length) return null
  return {
    dx: Math.abs(max[0] - min[0]),
    dy: Math.abs(max[1] - min[1]),
    dz: Math.abs(max[2] - min[2]),
  }
}

function keepPrim(info, prim) {
  if (rejectedSemantic(info)) return false
  if (WALK.test(info.allText)) return true
  const size = primSize(prim)
  if (!size) return false
  const footprint = Math.max(0, size.dx) * Math.max(0, size.dz)
  const thin = size.dy <= Math.max(size.dx, size.dz) * 0.08 + 0.5
  return thin && footprint >= 4
}

function triangleData(m, pos, i0, i1, i2) {
  const a = transformPoint(m, pos[i0 * 3], pos[i0 * 3 + 1], pos[i0 * 3 + 2])
  const b = transformPoint(m, pos[i1 * 3], pos[i1 * 3 + 1], pos[i1 * 3 + 2])
  const c = transformPoint(m, pos[i2 * 3], pos[i2 * 3 + 1], pos[i2 * 3 + 2])
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const uz = b[2] - a[2]
  const vx = c[0] - a[0]
  const vy = c[1] - a[1]
  const vz = c[2] - a[2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const length = Math.hypot(nx, ny, nz) || 1
  return {
    a,
    b,
    c,
    x: (a[0] + b[0] + c[0]) / 3,
    y: (a[1] + b[1] + c[1]) / 3,
    z: (a[2] + b[2] + c[2]) / 3,
    up: Math.abs(ny / length),
  }
}

function normalizedOwnerNames(node) {
  const names = []
  let current = node
  while (current) {
    const raw = current.getName()?.trim()
    if (raw) names.push(raw.replace(/^COLLIDER_/i, ''))
    current = nodeParent(current)
  }
  return names
}

export function collectGeometry(document, options) {
  const samples = []
  const stairSamples = []
  const surfaces = []
  const ownerStats = new Map()
  let instanceCount = 0

  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const matrices = nodeWorldMatrices(node)
    instanceCount += matrices.length

    for (const prim of mesh.listPrimitives()) {
      const info = semanticInfo(node, mesh, prim.getMaterial())
      if (!keepPrim(info, prim)) continue
      const posAttr = prim.getAttribute('POSITION')
      const pos = posAttr?.getArray()
      if (!pos) continue
      const indices = prim.getIndices()?.getArray()
      const triCount = indices ? indices.length / 3 : Math.floor(pos.length / 9)
      const named = WALK.test(info.allText)
      const stairSemantic = STAIR.test(info.allText) && !rejectedSemantic(info)
      const ownerLabel = info.owner || info.nodeName || info.meshName || info.materialName || '(unnamed)'
      const ownerNames = normalizedOwnerNames(node)
      let horizontalTriangles = 0
      let horizontalMinY = Infinity
      let horizontalMaxY = -Infinity

      for (const m of matrices) {
        for (let t = 0; t < triCount; t++) {
          const i0 = indices ? indices[t * 3] : t * 3
          const i1 = indices ? indices[t * 3 + 1] : t * 3 + 1
          const i2 = indices ? indices[t * 3 + 2] : t * 3 + 2
          const tri = triangleData(m, pos, i0, i1, i2)
          const horizontal = tri.up >= WALKABLE_UP
          if (!named && !horizontal) continue
          if (horizontal) {
            horizontalTriangles += 1
            horizontalMinY = Math.min(horizontalMinY, tri.y)
            horizontalMaxY = Math.max(horizontalMaxY, tri.y)
          }
          const sample = {
            x: tri.x,
            y: tri.y,
            z: tri.z,
            named,
            horizontal,
            owner: ownerLabel,
            material: info.materialName,
          }
          samples.push(sample)
          if (horizontal && options.collectSurfaces) surfaces.push(tri)
          if (horizontal && stairSemantic) stairSamples.push(sample)
        }
      }

      if (options.collectOwners && ownerNames.length) {
        for (const name of ownerNames) {
          let stat = ownerStats.get(name)
          if (!stat) {
            stat = {
              name,
              triangles: 0,
              horizontalTriangles: 0,
              minHorizontalY: null,
              maxHorizontalY: null,
            }
            ownerStats.set(name, stat)
          }
          stat.triangles += triCount * matrices.length
          if (stairSemantic) {
            stat.horizontalTriangles += horizontalTriangles
            if (Number.isFinite(horizontalMinY)) {
              stat.minHorizontalY = stat.minHorizontalY === null
                ? horizontalMinY
                : Math.min(stat.minHorizontalY, horizontalMinY)
              stat.maxHorizontalY = stat.maxHorizontalY === null
                ? horizontalMaxY
                : Math.max(stat.maxHorizontalY, horizontalMaxY)
            }
          }
        }
      }
    }
  }

  return { samples, stairSamples, surfaces, ownerStats, instanceCount }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const i = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)))
  return sorted[i]
}

function robustAxisRange(values, minimumPad) {
  if (!values.length) return [-Infinity, Infinity]
  const stride = Math.max(1, Math.floor(values.length / 200_000))
  const sorted = []
  for (let i = 0; i < values.length; i += stride) sorted.push(values[i])
  sorted.sort((a, b) => a - b)
  const fullMin = sorted[0]
  const fullMax = sorted[sorted.length - 1]
  const qMin = percentile(sorted, 0.005)
  const qMax = percentile(sorted, 0.995)
  const span = Math.max(0.001, qMax - qMin)
  const pad = Math.max(minimumPad, span * 0.2)
  const robustMin = qMin - pad
  const robustMax = qMax + pad
  if (fullMax - fullMin <= span * 2 + pad * 2) return [fullMin, fullMax]
  return [robustMin, robustMax]
}

export function robustEnvelope(samples) {
  const horizontal = samples.filter((sample) => sample.horizontal)
  const source = horizontal.length ? horizontal : samples
  return {
    x: robustAxisRange(source.map((sample) => sample.x), CELL * 2),
    y: robustAxisRange(source.map((sample) => sample.y), BAND * 2),
    z: robustAxisRange(source.map((sample) => sample.z), CELL * 2),
  }
}

export function inEnvelope(sample, envelope) {
  return (
    sample.x >= envelope.x[0] &&
    sample.x <= envelope.x[1] &&
    sample.y >= envelope.y[0] &&
    sample.y <= envelope.y[1] &&
    sample.z >= envelope.z[0] &&
    sample.z <= envelope.z[1]
  )
}

export function binKey(sample) {
  const band = Math.floor(sample.y / BAND)
  const cellX = Math.floor(sample.x / CELL)
  const cellZ = Math.floor(sample.z / CELL)
  return `${band}|${cellX}|${cellZ}`
}

function surfaceCell(x, z) {
  return `${Math.floor(x / SURFACE_GRID)}|${Math.floor(z / SURFACE_GRID)}`
}

function buildSurfaceIndex(triangles) {
  const grid = new Map()
  const large = []
  for (const tri of triangles) {
    const minX = Math.min(tri.a[0], tri.b[0], tri.c[0])
    const maxX = Math.max(tri.a[0], tri.b[0], tri.c[0])
    const minZ = Math.min(tri.a[2], tri.b[2], tri.c[2])
    const maxZ = Math.max(tri.a[2], tri.b[2], tri.c[2])
    const ix0 = Math.floor(minX / SURFACE_GRID)
    const ix1 = Math.floor(maxX / SURFACE_GRID)
    const iz0 = Math.floor(minZ / SURFACE_GRID)
    const iz1 = Math.floor(maxZ / SURFACE_GRID)
    const cells = (ix1 - ix0 + 1) * (iz1 - iz0 + 1)
    if (cells > 256) {
      large.push(tri)
      continue
    }
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const key = `${ix}|${iz}`
        const bucket = grid.get(key)
        if (bucket) bucket.push(tri)
        else grid.set(key, [tri])
      }
    }
  }
  return { grid, large }
}

function triangleYAtXZ(tri, x, z) {
  const [x1, y1, z1] = tri.a
  const [x2, y2, z2] = tri.b
  const [x3, y3, z3] = tri.c
  const denominator = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3)
  if (Math.abs(denominator) < 1e-9) return null
  const u = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / denominator
  const v = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / denominator
  const w = 1 - u - v
  if (u < -0.02 || v < -0.02 || w < -0.02) return null
  return u * y1 + v * y2 + w * y3
}

function stairCoverage(samples, index) {
  const byOwner = new Map()
  for (const sample of samples) {
    const candidates = [...(index.grid.get(surfaceCell(sample.x, sample.z)) || []), ...index.large]
    let matched = false
    for (const tri of candidates) {
      const y = triangleYAtXZ(tri, sample.x, sample.z)
      if (y != null && Math.abs(y - sample.y) <= STAIR_VERTICAL_TOLERANCE) {
        matched = true
        break
      }
    }
    const key = `${sample.owner} :: ${sample.material || '(no material)'}`
    const stat = byOwner.get(key) || { owner: key, samples: 0, matched: 0 }
    stat.samples += 1
    if (matched) stat.matched += 1
    byOwner.set(key, stat)
  }
  return [...byOwner.values()]
    .map((stat) => ({ ...stat, ratio: stat.samples ? stat.matched / stat.samples : 1 }))
    .sort((a, b) => a.ratio - b.ratio || b.samples - a.samples)
}

function primaryVisualStairSamples(modelId, samples) {
  if (modelId === 'icm-anim-2025') {
    return samples.filter((sample) =>
      /TR_Stufen004(?:_001)?|TR_Stufen005|(?:^|[/\s_.-])Podest(?:$|[/\s_.-])/i.test(
        `${sample.owner} ${sample.material}`,
      ),
    )
  }
  return samples
}

function requiredOwnerFailures(modelId, ownerStats) {
  if (modelId !== 'icm-anim-2025') return []
  const failures = []
  for (const required of REQUIRED_ANIMATED_STAIRS) {
    const stat = ownerStats.get(required)
    if (!stat) {
      failures.push(`${required}: semantic collision owner missing`)
      continue
    }
    if (stat.triangles < 4) failures.push(`${required}: only ${stat.triangles} triangle(s)`)
    if (stat.horizontalTriangles < 2) {
      failures.push(`${required}: no usable horizontal stair/landing support`)
    }
  }
  return failures
}

function formatRange(range) {
  return `${range[0].toFixed(1)}..${range[1].toFixed(1)}`
}

async function main() {
  const args = parseArgs(process.argv)
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
  const entry = manifest.models.find((model) => model.id === args.id)
  if (!entry) throw new Error(`Unknown model id: ${args.id}`)
  if (!entry.collision && !args.collision) throw new Error(`${args.id} has no collision route`)

  const web = publicPath(entry.web)
  const collisionOverride = resolveOverride(args.collision)
  const collisionPath = collisionOverride || publicPath(entry.collision)
  await access(web)
  await access(collisionPath)

  const io = await createGltfIO()
  console.log(`Visual: ${web}`)
  console.log(`Collision: ${collisionPath}${collisionOverride ? ' (override)' : ''}`)
  const visual = collectGeometry(await io.read(web), {
    collectSurfaces: false,
    collectOwners: false,
  })
  const collision = collectGeometry(await io.read(collisionPath), {
    collectSurfaces: true,
    collectOwners: true,
  })

  const envelope = robustEnvelope(visual.samples)
  const visualSamples = visual.samples.filter((sample) => inEnvelope(sample, envelope))
  const collisionSamples = collision.samples.filter((sample) => inEnvelope(sample, envelope))
  const excludedVisual = visual.samples.length - visualSamples.length
  const excludedCollision = collision.samples.length - collisionSamples.length
  console.log(
    `Robust envelope X ${formatRange(envelope.x)} · Y ${formatRange(envelope.y)} · Z ${formatRange(envelope.z)}`,
  )
  if (excludedVisual || excludedCollision) {
    console.log(
      `Ignored anomalous/outlier samples: visual=${excludedVisual.toLocaleString()} collision=${excludedCollision.toLocaleString()}`,
    )
  }

  const visualBins = new Map()
  const visualBinOwners = new Map()
  const collisionBins = new Map()
  for (const sample of visualSamples) {
    if (!sample.named || !sample.horizontal) continue
    const key = binKey(sample)
    visualBins.set(key, (visualBins.get(key) || 0) + 1)
    let owners = visualBinOwners.get(key)
    if (!owners) {
      owners = new Map()
      visualBinOwners.set(key, owners)
    }
    const owner = sample.owner || sample.material || '(unnamed)'
    owners.set(owner, (owners.get(owner) || 0) + 1)
  }
  for (const sample of collisionSamples) {
    if (!sample.horizontal) continue
    const key = binKey(sample)
    collisionBins.set(key, (collisionBins.get(key) || 0) + 1)
  }

  const missing = []
  for (const [key, count] of visualBins) {
    if (count < 40) continue
    const collisionCount = collisionBins.get(key) || 0
    if (collisionCount === 0) {
      const owners = [...(visualBinOwners.get(key) || new Map()).entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([owner, ownerCount]) => `${owner} (${ownerCount})`)
      missing.push({ key, visual: count, collision: collisionCount, owners })
    }
  }
  missing.sort((a, b) => b.visual - a.visual)

  console.log(
    `\nWalk samples  visual=${visualSamples.length.toLocaleString()}  collision=${collisionSamples.length.toLocaleString()}`,
  )
  console.log(`Sparse 12 m / 3.6 m cells with no horizontal collision: ${missing.length}`)
  for (const row of missing.slice(0, 20)) {
    console.log(
      `  ${row.key}  visual=${row.visual}  collision=${row.collision}` +
        (row.owners.length ? `  owners=${row.owners.join('; ')}` : ''),
    )
  }

  const primaryStairs = primaryVisualStairSamples(
    args.id,
    visual.stairSamples.filter((sample) => inEnvelope(sample, envelope)),
  )
  const surfaceIndex = buildSurfaceIndex(
    collision.surfaces.filter((surface) =>
      inEnvelope({ x: surface.x, y: surface.y, z: surface.z }, envelope),
    ),
  )
  const stairRows = stairCoverage(primaryStairs, surfaceIndex)
  console.log(
    `\nPrimary stair surface coverage (${STAIR_VERTICAL_TOLERANCE.toFixed(2)} m elevation tolerance):`,
  )
  if (!stairRows.length) console.log('  no semantic visual stair samples found')
  for (const row of stairRows) {
    console.log(
      `  ${(row.ratio * 100).toFixed(1).padStart(5)}%  ${String(row.matched).padStart(6)}/${String(row.samples).padEnd(6)}  ${row.owner}`,
    )
  }

  const failures = []
  const ownerFailures = requiredOwnerFailures(args.id, collision.ownerStats)
  failures.push(...ownerFailures)
  if (args.id === 'icm-anim-2025') {
    console.log(
      ownerFailures.length
        ? `Required animated stair owners: ${ownerFailures.length} validation failure(s)`
        : `Required animated stair owners: ${REQUIRED_ANIMATED_STAIRS.length}/${REQUIRED_ANIMATED_STAIRS.length} valid`,
    )
  }
  for (const row of stairRows) {
    if (row.samples >= 8 && row.ratio < MIN_STAIR_COVERAGE) {
      failures.push(
        `${row.owner}: ${(row.ratio * 100).toFixed(1)}% stair support; required ${(MIN_STAIR_COVERAGE * 100).toFixed(0)}%`,
      )
    }
  }
  if (primaryStairs.length === 0 && args.id === 'icm-ext') {
    failures.push('No semantic exterior stair samples were found in the visual route')
  }
  if (missing.length > MAX_MISSING_CELLS) {
    failures.push(`${missing.length} empty walk cells; limit is ${MAX_MISSING_CELLS}`)
  }

  if (failures.length) {
    console.error('\nCollision coverage FAILED:')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
  }
  console.log('\nCollision coverage OK')
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
