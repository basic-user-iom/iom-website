/**
 * Dump world-space AABBs for mesh nodes (debug crop targeting).
 * Usage: node building-viewer/scripts/dump-model-bounds.mjs --input public/models/icm-ext/model-web.glb
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { resolve } from 'node:path'

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
  const step = Math.max(1, Math.floor(pos.getCount() / 800))
  for (let i = 0; i < pos.getCount(); i += step) {
    const w = xform(matrix, [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]])
    for (let k = 0; k < 3; k++) {
      if (w[k] < min[k]) min[k] = w[k]
      if (w[k] > max[k]) max[k] = w[k]
    }
  }
  return { min, max }
}

const argv = process.argv.slice(2)
const inputIdx = argv.indexOf('--input')
const filterIdx = argv.indexOf('--filter')
const input = resolve(inputIdx >= 0 ? argv[inputIdx + 1] : 'public/models/icm-ext/model-web.glb')
const filter = filterIdx >= 0 ? new RegExp(argv[filterIdx + 1], 'i') : /fassade|grndach|decke|foyer|raster|innen|dach/i

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(input)
const sceneMin = [Infinity, Infinity, Infinity]
const sceneMax = [-Infinity, -Infinity, -Infinity]
const rows = []

for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  const matrix = worldMat(node)
  let box = null
  for (const prim of mesh.listPrimitives()) {
    const b = primitiveWorldBox(prim, matrix)
    if (!b) continue
    if (!box) box = { min: [...b.min], max: [...b.max] }
    else {
      for (let k = 0; k < 3; k++) {
        box.min[k] = Math.min(box.min[k], b.min[k])
        box.max[k] = Math.max(box.max[k], b.max[k])
      }
    }
  }
  if (!box) continue
  for (let k = 0; k < 3; k++) {
    sceneMin[k] = Math.min(sceneMin[k], box.min[k])
    sceneMax[k] = Math.max(sceneMax[k], box.max[k])
  }
  const name = node.getName() || mesh.getName() || ''
  if (!filter.test(name)) continue
  const size = [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]]
  rows.push({
    name,
    min: box.min.map((n) => Math.round(n * 10) / 10),
    max: box.max.map((n) => Math.round(n * 10) / 10),
    size: size.map((n) => Math.round(n * 10) / 10),
  })
}

rows.sort((a, b) => a.size[0] * a.size[2] - b.size[0] * b.size[2])
console.log(JSON.stringify({
  input,
  scene: {
    min: sceneMin.map((n) => Math.round(n * 10) / 10),
    max: sceneMax.map((n) => Math.round(n * 10) / 10),
  },
  matches: rows.slice(-40),
}, null, 2))
