/**
 * Audit GLB primitives for view-dependent surface loss.
 *
 * The ICM CAD sources contain legitimate open architectural shells. Those
 * surfaces need a two-sided material unless they are made watertight in the
 * source DCC. This audit welds position seams before counting boundary and
 * winding edges, so UV/normal splits do not masquerade as holes.
 *
 * Usage:
 *   node scripts/audit-surface-visibility.mjs --input ../public/models/icm-ext/model-web.glb
 *   node scripts/audit-surface-visibility.mjs --input <glb> --out <report.json>
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createGltfIO } from './lib/gltf-io.mjs'

const TRIANGLES = 4
const ARCHITECTURAL_NAME =
  /fassad|facade|wand|wall|innenwa|decke|ceiling|soffit|boden|floor|slab|dach|roof|attika|parapet|bruest|brüst|geländ|geland|railing|panel|cladding|verbindung|walkway|footbridge|connector|passage|treppe|stair|rampe|ramp|tuer|tür|door|fenster|window|glas|glass|flugturm|building|gebäude|gebaude|halle|foyer|fassade/i
const EXPECTED_TWO_SIDED_NAME =
  /leaf|leaves|foliage|grass|flower|blossom|stalk|fence|grille|fabric|cloth|curtain|decal|sign|flag|banner|plane|logo/i

function parseArgs(argv) {
  const args = { input: null, out: null, top: 40 }
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input') args.input = resolve(argv[++i])
    else if (arg === '--out') args.out = resolve(argv[++i])
    else if (arg === '--top') args.top = Math.max(1, Number(argv[++i]) || 40)
  }
  if (!args.input) throw new Error('Required: --input <glb>')
  return args
}

function transformPoint(matrix, x, y, z) {
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] || 1
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w,
  ]
}

function determinant3(matrix) {
  const a = matrix[0], b = matrix[4], c = matrix[8]
  const d = matrix[1], e = matrix[5], f = matrix[9]
  const g = matrix[2], h = matrix[6], i = matrix[10]
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
}

function round(value, digits = 4) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function primitiveTopology(primitive) {
  const position = primitive.getAttribute('POSITION')
  if (!position || primitive.getMode() !== TRIANGLES) return null
  const positions = position.getArray()
  const vertexCount = position.getCount()
  if (!positions || vertexCount < 3) return null

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[vertex * 3 + axis]
      if (value < min[axis]) min[axis] = value
      if (value > max[axis]) max[axis] = value
    }
  }
  const size = max.map((value, axis) => value - min[axis])
  const maxDim = Math.max(...size)
  // Quantized exports and large CAD coordinates need a scale-aware weld.
  const weldTolerance = Math.max(1e-6, maxDim * 1e-6)
  const weldedByPosition = new Map()
  const weldedVertex = new Uint32Array(vertexCount)
  let weldedVertices = 0
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const key = [
      Math.round(positions[vertex * 3] / weldTolerance),
      Math.round(positions[vertex * 3 + 1] / weldTolerance),
      Math.round(positions[vertex * 3 + 2] / weldTolerance),
    ].join(',')
    let canonical = weldedByPosition.get(key)
    if (canonical === undefined) {
      canonical = weldedVertices
      weldedVertices += 1
      weldedByPosition.set(key, canonical)
    }
    weldedVertex[vertex] = canonical
  }

  const indices = primitive.getIndices()
  const indexArray = indices?.getArray()
  const indexCount = indices?.getCount() ?? vertexCount
  const edgeCounts = new Map()
  const edgeDirections = new Map()
  let degenerateTriangles = 0
  let triangles = 0

  const addEdge = (fromVertex, toVertex) => {
    const from = weldedVertex[fromVertex]
    const to = weldedVertex[toVertex]
    if (from === to) return
    const low = Math.min(from, to)
    const high = Math.max(from, to)
    const key = low * weldedVertices + high
    edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1)
    edgeDirections.set(key, (edgeDirections.get(key) || 0) + (from === low ? 1 : -1))
  }

  for (let index = 0; index + 2 < indexCount; index += 3) {
    const a = indexArray ? indexArray[index] : index
    const b = indexArray ? indexArray[index + 1] : index + 1
    const c = indexArray ? indexArray[index + 2] : index + 2
    const wa = weldedVertex[a], wb = weldedVertex[b], wc = weldedVertex[c]
    if (wa === wb || wb === wc || wc === wa) {
      degenerateTriangles += 1
      continue
    }
    triangles += 1
    addEdge(a, b)
    addEdge(b, c)
    addEdge(c, a)
  }

  let boundaryEdges = 0
  let nonManifoldEdges = 0
  let windingConflictEdges = 0
  for (const [key, count] of edgeCounts) {
    if (count === 1) boundaryEdges += 1
    else if (count > 2) nonManifoldEdges += 1
    if (count === 2 && Math.abs(edgeDirections.get(key) || 0) === 2) {
      windingConflictEdges += 1
    }
  }

  const edges = edgeCounts.size
  return {
    vertices: vertexCount,
    weldedVertices,
    triangles,
    degenerateTriangles,
    edges,
    boundaryEdges,
    boundaryRatio: edges ? boundaryEdges / edges : 0,
    nonManifoldEdges,
    windingConflictEdges,
    localMin: min,
    localMax: max,
    localSize: size,
  }
}

function worldBox(topology, matrix) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let mask = 0; mask < 8; mask += 1) {
    const point = transformPoint(
      matrix,
      mask & 1 ? topology.localMax[0] : topology.localMin[0],
      mask & 2 ? topology.localMax[1] : topology.localMin[1],
      mask & 4 ? topology.localMax[2] : topology.localMin[2],
    )
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis])
      max[axis] = Math.max(max[axis], point[axis])
    }
  }
  return { min, max, size: max.map((value, axis) => value - min[axis]) }
}

function classifyRisk({ label, topology, box, doubleSided }) {
  if (doubleSided || topology.boundaryEdges === 0) return null
  const dimensions = [...box.size].sort((a, b) => b - a)
  const faceAreaProxy = dimensions[0] * dimensions[1]
  const minDim = dimensions[2]
  const maxDim = dimensions[0]
  const semantic = ARCHITECTURAL_NAME.test(label)
  const planar = minDim <= Math.max(0.08, maxDim * 0.006)
  const substantial = maxDim >= 1.5 && faceAreaProxy >= 1
  const materiallyOpen =
    topology.boundaryRatio >= 0.01 ||
    topology.boundaryEdges >= 24 ||
    (planar && topology.boundaryEdges >= 3)
  if (!materiallyOpen || (!semantic && !substantial)) return null
  if (topology.boundaryRatio >= 0.15 || (semantic && planar)) return 'high'
  return 'medium'
}

async function main() {
  const args = parseArgs(process.argv)
  const bytes = (await readFile(args.input)).byteLength
  const io = await createGltfIO()
  const document = await io.read(args.input)
  const root = document.getRoot()
  const topologyCache = new Map()
  const rows = []
  let primitiveInstances = 0
  let triangleInstances = 0
  let mirroredNodes = 0
  let openPrimitiveInstances = 0
  let openSingleSidedInstances = 0
  let expectedTwoSidedSingleInstances = 0

  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const matrix = node.getWorldMatrix()
    const mirrored = determinant3(matrix) < 0
    if (mirrored) mirroredNodes += 1
    for (const [slot, primitive] of mesh.listPrimitives().entries()) {
      primitiveInstances += 1
      let topology = topologyCache.get(primitive)
      if (topology === undefined) {
        topology = primitiveTopology(primitive)
        topologyCache.set(primitive, topology)
      }
      if (!topology) continue
      triangleInstances += topology.triangles
      const material = primitive.getMaterial()
      const doubleSided = Boolean(material?.getDoubleSided())
      const label = [node.getName(), mesh.getName(), material?.getName()].filter(Boolean).join(' | ')
      const box = worldBox(topology, matrix)
      if (topology.boundaryEdges > 0) openPrimitiveInstances += 1
      if (topology.boundaryEdges > 0 && !doubleSided) openSingleSidedInstances += 1
      if (!doubleSided && EXPECTED_TWO_SIDED_NAME.test(label)) expectedTwoSidedSingleInstances += 1
      const risk = classifyRisk({ label, topology, box, doubleSided })
      if (!risk && topology.windingConflictEdges === 0 && !mirrored) continue
      rows.push({
        risk: risk || (topology.windingConflictEdges > 0 || mirrored ? 'winding' : 'info'),
        node: node.getName() || '(unnamed)',
        mesh: mesh.getName() || '(unnamed)',
        primitive: slot,
        material: material?.getName() || '(default)',
        doubleSided,
        mirrored,
        triangles: topology.triangles,
        boundaryEdges: topology.boundaryEdges,
        boundaryRatio: round(topology.boundaryRatio, 5),
        nonManifoldEdges: topology.nonManifoldEdges,
        windingConflictEdges: topology.windingConflictEdges,
        worldMin: box.min.map((value) => round(value, 2)),
        worldMax: box.max.map((value) => round(value, 2)),
        worldSize: box.size.map((value) => round(value, 2)),
      })
    }
  }

  const riskOrder = { high: 3, medium: 2, winding: 1, info: 0 }
  rows.sort((a, b) =>
    (riskOrder[b.risk] - riskOrder[a.risk]) ||
    (b.boundaryRatio - a.boundaryRatio) ||
    (b.triangles - a.triangles),
  )
  const counts = rows.reduce((result, row) => {
    result[row.risk] = (result[row.risk] || 0) + 1
    return result
  }, {})
  const report = {
    schemaVersion: 1,
    input: args.input,
    bytes,
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    primitiveInstances,
    triangleInstances,
    mirroredNodes,
    openPrimitiveInstances,
    openSingleSidedInstances,
    expectedTwoSidedSingleInstances,
    risks: counts,
    candidates: rows,
  }

  console.log(`Surface visibility audit: ${args.input}`)
  console.log(`  ${primitiveInstances} primitive instances / ${triangleInstances.toLocaleString()} triangles`)
  console.log(`  ${openPrimitiveInstances} open; ${openSingleSidedInstances} open + single-sided`)
  console.log(`  risks: high ${counts.high || 0}, medium ${counts.medium || 0}, winding ${counts.winding || 0}`)
  console.log(`  mirrored mesh nodes: ${mirroredNodes}`)
  for (const row of rows.slice(0, args.top)) {
    console.log(
      `  [${row.risk}] ${row.node} :: ${row.material} ` +
        `(${row.triangles} tris, ${(row.boundaryRatio * 100).toFixed(1)}% boundary, ` +
        `${row.worldSize.join('×')} m)`,
    )
  }
  if (rows.length > args.top) console.log(`  … ${rows.length - args.top} more candidate(s)`)
  if (args.out) {
    await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`)
    console.log(`Wrote ${args.out}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
