/**
 * Crop a world-space AABB out of a production GLB for the golden-slice bake.
 * Does not modify the source file.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune } from '@gltf-transform/functions'

const SLICES = {
  'golden-ext': {
    input: resolve('public/models/icm-ext/model-web.glb'),
    // Fassade + Grndach_001 cluster (green-roof bay on the north elevation).
    min: [-35, -1.0, 84],
    max: [-8, 12, 132],
  },
  'golden-int': {
    input: resolve('public/models/icm-anim-2025/model-web.glb'),
    // Actual Foyer_Decke_garderobe bay — the previous box ate the hall,
    // elevator, and stairs.
    min: [-65.55, -0.05, -60.75],
    max: [-55.55, 3.35, -49.35],
  },
}

function parseBox(raw) {
  return raw.split(',').map((n) => Number(n.trim()))
}

function worldMat(node) {
  return node.getWorldMatrix()
}

function xform(m, p) {
  const x = p[0]
  const y = p[1]
  const z = p[2]
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ]
}

function primitiveWorldBox(prim, matrix) {
  const pos = prim.getAttribute('POSITION')
  if (!pos) return null
  const arr = pos.getArray()
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const step = Math.max(1, Math.floor(pos.getCount() / 2500))
  for (let i = 0; i < pos.getCount(); i += step) {
    const w = xform(matrix, [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]])
    for (let k = 0; k < 3; k++) {
      if (w[k] < min[k]) min[k] = w[k]
      if (w[k] > max[k]) max[k] = w[k]
    }
  }
  return { min, max }
}

function overlaps(a, bmin, bmax) {
  return (
    a.min[0] <= bmax[0] &&
    a.max[0] >= bmin[0] &&
    a.min[1] <= bmax[1] &&
    a.max[1] >= bmin[1] &&
    a.min[2] <= bmax[2] &&
    a.max[2] >= bmin[2]
  )
}

function overlapFootprint(box, cropMin, cropMax) {
  const x = Math.max(0, Math.min(box.max[0], cropMax[0]) - Math.max(box.min[0], cropMin[0]))
  const z = Math.max(0, Math.min(box.max[2], cropMax[2]) - Math.max(box.min[2], cropMin[2]))
  return x * z
}

function shouldKeep(box, cropMin, cropMax) {
  if (!overlaps(box, cropMin, cropMax)) return false
  const cropFoot = Math.max(1e-6, (cropMax[0] - cropMin[0]) * (cropMax[2] - cropMin[2]))
  const meshFoot = Math.max(1e-6, (box.max[0] - box.min[0]) * (box.max[2] - box.min[2]))
  const overlap = overlapFootprint(box, cropMin, cropMax)
  const cx = (box.min[0] + box.max[0]) * 0.5
  const cy = (box.min[1] + box.max[1]) * 0.5
  const cz = (box.min[2] + box.max[2]) * 0.5
  const centerInside =
    cx >= cropMin[0] &&
    cx <= cropMax[0] &&
    cy >= cropMin[1] &&
    cy <= cropMax[1] &&
    cz >= cropMin[2] &&
    cz <= cropMax[2]
  if (centerInside) return true
  if (meshFoot > cropFoot * 2.5 && overlap < meshFoot * 0.2) return false
  return true
}

function parseArgs(argv) {
  const out = { slice: '', input: '', output: '', min: null, max: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--slice') out.slice = next
    if (a === '--input') out.input = next
    if (a === '--output') out.output = next
    if (a === '--min') out.min = parseBox(next)
    if (a === '--max') out.max = parseBox(next)
  }
  const preset = SLICES[out.slice]
  if (!preset && (!out.input || !out.min || !out.max || !out.output)) {
    throw new Error('Usage: --slice golden-ext|golden-int  OR  --input --output --min x,y,z --max x,y,z')
  }
  return {
    input: resolve(out.input || preset.input),
    output: resolve(out.output),
    min: out.min || preset.min,
    max: out.max || preset.max,
    slice: out.slice || 'custom',
  }
}

const args = parseArgs(process.argv.slice(2))
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(args.input)
const keep = new Set()

for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  const matrix = worldMat(node)
  let hit = false
  for (const prim of mesh.listPrimitives()) {
    const box = primitiveWorldBox(prim, matrix)
    if (box && shouldKeep(box, args.min, args.max)) {
      hit = true
      break
    }
  }
  if (!hit) continue
  let cur = node
  while (cur) {
    keep.add(cur)
    cur = cur.getParentNode()
  }
}

let dropped = 0
for (const node of [...doc.getRoot().listNodes()]) {
  if (keep.has(node)) continue
  node.detach()
  dropped += 1
}

await doc.transform(prune())

const keptMeshes = doc.getRoot().listNodes().filter((n) => n.getMesh()).length
let tris = 0
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices()
    tris += idx ? idx.getCount() / 3 : 0
  }
}

await mkdir(dirname(args.output), { recursive: true })
await io.write(args.output, doc)
const report = {
  slice: args.slice,
  input: args.input,
  output: args.output,
  box: { min: args.min, max: args.max },
  keptMeshNodes: keptMeshes,
  droppedNodes: dropped,
  triangles: Math.round(tris),
}
await writeFile(args.output.replace(/\.glb$/i, '.extract.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
