/**
 * Phase C — split a building GLB into spatial cell chunks + cell-manifest.json.
 *
 * Each triangle is owned by exactly one cell (centroid → floor band + XZ cell).
 * Whole meshes are NOT copied into every overlapping cell.
 *
 * Do not enable this bake for models whose animation parents whole floors
 * (icm-anim-2025): flatten+partition bakes world positions and breaks clips.
 *
 * Usage:
 *   node building-viewer/scripts/bake-cell-manifest.mjs --input public/models/icm-anim-2025/model-web.glb
 *   node building-viewer/scripts/bake-cell-manifest.mjs --input public/models/icm-anim-2025/model-quest.glb --variant quest
 */
import { mkdir, access, writeFile, stat, rm } from 'node:fs/promises'
import { dirname, join, resolve, basename } from 'node:path'
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, flatten, prune, weld } from '@gltf-transform/functions'

const DEFAULT_BAND = 3.6
const DEFAULT_CELL_XZ = 12
const MAX_ALWAYS_ON_TRIS = 150_000
const MAX_CELL_TRIS = 250_000
const MIN_CELL_TRIS = 80
/** Soft tolerance: owned output tris vs source (boundary remaps can differ slightly). */
const OWNERSHIP_TOLERANCE = 0.02

function parseArgs(argv) {
  const args = {
    input: null,
    outDir: null,
    bandHeight: DEFAULT_BAND,
    cellXz: DEFAULT_CELL_XZ,
    variant: 'web',
    clean: true,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input') args.input = resolve(argv[++i])
    else if (a === '--out-dir') args.outDir = resolve(argv[++i])
    else if (a === '--band-height') args.bandHeight = Number(argv[++i])
    else if (a === '--cell-xz') args.cellXz = Number(argv[++i])
    else if (a === '--variant') args.variant = String(argv[++i])
    else if (a === '--no-clean') args.clean = false
  }
  return args
}

function cellCoord(value, origin, size) {
  return Math.floor((value - origin) / size)
}

function cellId(band, cx, cz) {
  return `f${band}_cx${cx}_cz${cz}`
}

function parseCellKey(key) {
  if (key === 'shell') return { floorBand: 0, cell: [0, 0, 0] }
  const m = /^f(-?\d+)_cx(-?\d+)_cz(-?\d+)$/.exec(key)
  if (!m) return { floorBand: 0, cell: [0, 0, 0] }
  return { floorBand: Number(m[1]), cell: [Number(m[2]), 0, Number(m[3])] }
}

function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ]
}

function countDocTris(document) {
  let n = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices()
      if (idx) n += idx.getCount() / 3
      else {
        const pos = prim.getAttribute('POSITION')
        if (pos) n += pos.getCount() / 3
      }
    }
  }
  return Math.round(n)
}

/**
 * Partition every triangle by world-space centroid into a single owner cell.
 * Returns Map<cellKey, { tris, boundsMin, boundsMax, pieces[] }>
 * where pieces are { meshName, material, positions: Float32Array (9*tris), } non-indexed.
 */
function partitionTriangles(document, sceneMin, bandHeight, cellXz) {
  const root = document.getRoot()
  const cells = new Map()

  const ensure = (key) => {
    let e = cells.get(key)
    if (!e) {
      e = {
        tris: 0,
        boundsMin: [Infinity, Infinity, Infinity],
        boundsMax: [-Infinity, -Infinity, -Infinity],
        pieces: [],
      }
      cells.set(key, e)
    }
    return e
  }

  const expand = (e, x, y, z) => {
    if (x < e.boundsMin[0]) e.boundsMin[0] = x
    if (y < e.boundsMin[1]) e.boundsMin[1] = y
    if (z < e.boundsMin[2]) e.boundsMin[2] = z
    if (x > e.boundsMax[0]) e.boundsMax[0] = x
    if (y > e.boundsMax[1]) e.boundsMax[1] = y
    if (z > e.boundsMax[2]) e.boundsMax[2] = z
  }

  let sourceTris = 0

  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const m = node.getWorldMatrix()
    const meshName = mesh.getName() || node.getName() || 'mesh'

    for (const prim of mesh.listPrimitives()) {
      const posAttr = prim.getAttribute('POSITION')
      if (!posAttr) continue
      const pos = posAttr.getArray()
      if (!pos) continue
      const mat = prim.getMaterial()
      const matName = mat?.getName() || ''
      const color = mat?.getBaseColorFactor?.() || [0.75, 0.75, 0.75, 1]

      const indices = prim.getIndices()?.getArray()
      const triCount = indices ? indices.length / 3 : Math.floor(pos.length / 9)
      sourceTris += triCount

      /** @type {Map<string, number[]>} */
      const buckets = new Map()

      for (let t = 0; t < triCount; t++) {
        let i0
        let i1
        let i2
        if (indices) {
          i0 = indices[t * 3]
          i1 = indices[t * 3 + 1]
          i2 = indices[t * 3 + 2]
        } else {
          i0 = t * 3
          i1 = t * 3 + 1
          i2 = t * 3 + 2
        }
        const ax = pos[i0 * 3]
        const ay = pos[i0 * 3 + 1]
        const az = pos[i0 * 3 + 2]
        const bx = pos[i1 * 3]
        const by = pos[i1 * 3 + 1]
        const bz = pos[i1 * 3 + 2]
        const cx = pos[i2 * 3]
        const cy = pos[i2 * 3 + 1]
        const cz = pos[i2 * 3 + 2]

        const [wax, way, waz] = transformPoint(m, ax, ay, az)
        const [wbx, wby, wbz] = transformPoint(m, bx, by, bz)
        const [wcx, wcy, wcz] = transformPoint(m, cx, cy, cz)

        const mx = (wax + wbx + wcx) / 3
        const my = (way + wby + wcy) / 3
        const mz = (waz + wbz + wcz) / 3
        const band = cellCoord(my, sceneMin[1], bandHeight)
        const cxn = cellCoord(mx, sceneMin[0], cellXz)
        const czn = cellCoord(mz, sceneMin[2], cellXz)
        const key = cellId(band, cxn, czn)

        let list = buckets.get(key)
        if (!list) {
          list = []
          buckets.set(key, list)
        }
        list.push(wax, way, waz, wbx, wby, wbz, wcx, wcy, wcz)
      }

      for (const [key, flat] of buckets) {
        const e = ensure(key)
        const tris = flat.length / 9
        e.tris += tris
        for (let i = 0; i < flat.length; i += 3) {
          expand(e, flat[i], flat[i + 1], flat[i + 2])
        }
        e.pieces.push({
          meshName,
          matName,
          color,
          positions: new Float32Array(flat),
        })
      }
    }
  }

  return { cells, sourceTris: Math.round(sourceTris) }
}

function computeSceneBounds(document) {
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  const root = document.getRoot()

  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const m = node.getWorldMatrix()
    for (const prim of mesh.listPrimitives()) {
      const posAttr = prim.getAttribute('POSITION')
      if (!posAttr) continue
      const localMin = posAttr.getMin([])
      const localMax = posAttr.getMax([])
      if (!localMin?.length || !localMax?.length) continue
      const corners = [
        [localMin[0], localMin[1], localMin[2]],
        [localMax[0], localMin[1], localMin[2]],
        [localMin[0], localMax[1], localMin[2]],
        [localMax[0], localMax[1], localMin[2]],
        [localMin[0], localMin[1], localMax[2]],
        [localMax[0], localMin[1], localMax[2]],
        [localMin[0], localMax[1], localMax[2]],
        [localMax[0], localMax[1], localMax[2]],
      ]
      for (const [x, y, z] of corners) {
        const [wx, wy, wz] = transformPoint(m, x, y, z)
        if (wx < minX) minX = wx
        if (wy < minY) minY = wy
        if (wz < minZ) minZ = wz
        if (wx > maxX) maxX = wx
        if (wy > maxY) maxY = wy
        if (wz > maxZ) maxZ = wz
      }
    }
  }
  if (!Number.isFinite(minX)) {
    return { sceneMin: [0, 0, 0], sceneMax: [1, 1, 1] }
  }
  return { sceneMin: [minX, minY, minZ], sceneMax: [maxX, maxY, maxZ] }
}

function buildCellDocument(pieces, spatialExtras) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene('CellScene')
  const rootNode = doc.createNode('CellRoot')
  scene.addChild(rootNode)

  /** @type {Map<string, import('@gltf-transform/core').Material>} */
  const mats = new Map()

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]
    const matKey = `${piece.matName}|${piece.color.join(',')}`
    let material = mats.get(matKey)
    if (!material) {
      material = doc
        .createMaterial(piece.matName || 'cell-mat')
        .setBaseColorFactor(piece.color)
        .setMetallicFactor(0)
        .setRoughnessFactor(1)
      mats.set(matKey, material)
    }

    const posAcc = doc
      .createAccessor('POSITION')
      .setType('VEC3')
      .setArray(piece.positions)
      .setBuffer(buffer)

    const prim = doc.createPrimitive().setAttribute('POSITION', posAcc).setMaterial(material)
    const mesh = doc.createMesh(`${piece.meshName}_${i}`).addPrimitive(prim)
    if (spatialExtras) {
      mesh.setExtras({ IOM_spatial: spatialExtras })
    }
    const node = doc.createNode(mesh.getName()).setMesh(mesh)
    rootNode.addChild(node)
  }

  return doc
}

async function writeCellGlb(io, pieces, outPath, spatialExtras) {
  const doc = buildCellDocument(pieces, spatialExtras)
  await doc.transform(weld(), dedup(), prune())
  const tris = countDocTris(doc)
  if (tris < 1) return 0
  await io.write(outPath, doc)
  return tris
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.input) {
    console.error(
      'Required: --input <model.glb> [--out-dir <dir>] [--variant web|quest]',
    )
    process.exit(1)
  }
  await access(args.input)
  const outDir = args.outDir || dirname(args.input)
  const cellsDir = join(outDir, args.variant === 'quest' ? 'cells-quest' : 'cells')
  if (args.clean) {
    await rm(cellsDir, { recursive: true, force: true })
  }
  await mkdir(cellsDir, { recursive: true })

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const document = await io.read(args.input)
  await document.transform(flatten())

  const { sceneMin, sceneMax } = computeSceneBounds(document)
  const { cells, sourceTris } = partitionTriangles(
    document,
    sceneMin,
    args.bandHeight,
    args.cellXz,
  )

  let ownedTris = 0
  for (const e of cells.values()) ownedTris += e.tris

  const drift = Math.abs(ownedTris - sourceTris) / Math.max(sourceTris, 1)
  console.log(
    `Source tris ${sourceTris.toLocaleString()} · owned ${Math.round(ownedTris).toLocaleString()} · drift ${(drift * 100).toFixed(2)}% · cells ${cells.size}`,
  )
  if (drift > OWNERSHIP_TOLERANCE) {
    throw new Error(
      `Triangle ownership drift ${(drift * 100).toFixed(2)}% exceeds ${(OWNERSHIP_TOLERANCE * 100).toFixed(0)}% tolerance`,
    )
  }

  const modelId = basename(outDir)
  const manifestCells = []
  let alwaysOnTris = 0
  let totalBytes = 0
  let writtenTris = 0

  const sorted = [...cells.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  for (const [key, data] of sorted) {
    if (data.tris < MIN_CELL_TRIS) continue
    if (data.tris > MAX_CELL_TRIS) {
      console.warn(
        `  WARN ${key}: ${Math.round(data.tris).toLocaleString()} tris > cell budget ${MAX_CELL_TRIS.toLocaleString()} (kept)`,
      )
    }

    const parsed = parseCellKey(key)
    const spatial = {
      floorBand: parsed.floorBand,
      floorBandMin: parsed.floorBand,
      floorBandMax: parsed.floorBand,
      cell: parsed.cell,
      cellXMin: parsed.cell[0],
      cellXMax: parsed.cell[0],
      cellZMin: parsed.cell[2],
      cellZMax: parsed.cell[2],
      alwaysOn: false,
    }

    const fileName = `${key}.glb`
    const outPath = join(cellsDir, fileName)
    const tris = await writeCellGlb(io, data.pieces, outPath, spatial)
    if (tris < 1) continue
    const fileStat = await stat(outPath)
    totalBytes += fileStat.size
    writtenTris += tris

    manifestCells.push({
      id: key,
      floorBand: parsed.floorBand,
      cell: parsed.cell,
      boundsMin: data.boundsMin,
      boundsMax: data.boundsMax,
      url: `${basename(cellsDir)}/${fileName}`,
      triangles: tris,
      bytes: fileStat.size,
      alwaysOn: false,
    })
    console.log(
      `  ${fileName} · ${tris.toLocaleString()} tris · ${(fileStat.size / 1024).toFixed(0)} KiB`,
    )
  }

  // No oversized shell: triangle ownership removes the need for a duplicated shell.
  // Optional tiny always-on set can be added later as a true low-detail proxy.
  if (alwaysOnTris > MAX_ALWAYS_ON_TRIS) {
    throw new Error(
      `Always-on tris ${alwaysOnTris} exceed budget ${MAX_ALWAYS_ON_TRIS}`,
    )
  }

  const outOwnedDrift =
    Math.abs(writtenTris - sourceTris) / Math.max(sourceTris, 1)
  if (outOwnedDrift > OWNERSHIP_TOLERANCE + 0.05) {
    console.warn(
      `WARN written tris ${writtenTris.toLocaleString()} vs source ${sourceTris.toLocaleString()} (small cells dropped under ${MIN_CELL_TRIS})`,
    )
  }

  const manifestName =
    args.variant === 'quest' ? 'cell-manifest-quest.json' : 'cell-manifest.json'
  const manifest = {
    version: 2,
    modelId,
    variant: args.variant,
    source: basename(args.input),
    sceneMin,
    sceneMax,
    bandHeight: args.bandHeight,
    cellSize: [args.cellXz, 4, args.cellXz],
    neighborCells: 2,
    unloadNeighborCells: 3,
    budgets: {
      maxAlwaysOnTris: MAX_ALWAYS_ON_TRIS,
      maxCellTris: MAX_CELL_TRIS,
      ownershipTolerance: OWNERSHIP_TOLERANCE,
    },
    stats: {
      sourceTriangles: sourceTris,
      ownedTriangles: Math.round(ownedTris),
      writtenTriangles: writtenTris,
      alwaysOnTriangles: alwaysOnTris,
      cellCount: manifestCells.length,
      totalBytes,
    },
    cells: manifestCells,
  }

  const manifestPath = join(outDir, manifestName)
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`Wrote ${manifestPath} (${manifestCells.length} cells)`)
  console.log(
    `Total ${(totalBytes / (1024 * 1024)).toFixed(1)} MiB · written ${writtenTris.toLocaleString()} tris`,
  )
  console.log(
    `Manifest field (keep OFF until validated): "cellManifest": "/models/${modelId}/${manifestName}"`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
