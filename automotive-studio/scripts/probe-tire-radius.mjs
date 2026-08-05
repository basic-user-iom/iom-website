/**
 * Compare AABB y/2 vs hub-radial tire radius (gltf-transform, dequantized positions).
 *   node automotive-studio/scripts/probe-tire-radius.mjs [glb]
 */
import { resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'

const glb = resolve(
  process.argv[2] ||
    'F:/FREE_Lixiang_L9_2024_(White_Interior)/optimized/lixiang-presentation-high-rigged.glb',
)
const TARGET_LENGTH = 5.1
const EXCLUDE = /(discord|logo|credit|promo|watermark)|^text[._\-\d]/i
const NEVER = new Set(['Sketchfab_model', 'root', 'GLTF_SceneRootNode'])
const AXIS = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const document = await io.read(glb)
const root = document.getRoot()

function localMatrix(node) {
  return new Matrix4().compose(
    new Vector3(...node.getTranslation()),
    new Quaternion(...node.getRotation()),
    new Vector3(...node.getScale()),
  )
}

function buildWorldMatrices() {
  const map = new Map()
  const walk = (n, parent) => {
    const world = new Matrix4().multiplyMatrices(parent, localMatrix(n))
    map.set(n, world)
    for (const c of n.listChildren()) walk(c, world)
  }
  for (const scene of root.listScenes()) {
    for (const child of scene.listChildren()) walk(child, new Matrix4())
  }
  return map
}

function expandMesh(node, world, box) {
  const mesh = node.getMesh()
  if (!mesh) return
  const v = new Vector3()
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos) continue
    const min = pos.getMinNormalized([])
    const max = pos.getMaxNormalized([])
    for (const x of [min[0], max[0]]) {
      for (const y of [min[1], max[1]]) {
        for (const z of [min[2], max[2]]) {
          v.set(x, y, z).applyMatrix4(world)
          box.expandByPoint(v)
        }
      }
    }
  }
}

function measureCarBounds(worlds) {
  const box = new Box3()
  const walk = (node) => {
    const name = node.getName() || ''
    if (!NEVER.has(name) && EXCLUDE.test(name)) return
    expandMesh(node, worlds.get(node), box)
    for (const c of node.listChildren()) walk(c)
  }
  for (const scene of root.listScenes()) {
    for (const child of scene.listChildren()) walk(child)
  }
  return box
}

function findNode(name) {
  return root.listNodes().find((n) => n.getName() === name) || null
}

function subtreeAABBMetres(pivot, worlds, unitsToMetres) {
  const box = new Box3()
  const walk = (node) => {
    expandMesh(node, worlds.get(node), box)
    for (const c of node.listChildren()) walk(c)
  }
  walk(pivot)
  if (box.isEmpty()) return null
  return box.getSize(new Vector3()).multiplyScalar(unitsToMetres)
}

function subtreeRadialMetres(pivot, worlds, axle, unitsToMetres) {
  const inv = worlds.get(pivot).clone().invert()
  const v = new Vector3()
  const el = []
  let maxR = 0
  const walk = (node) => {
    const mesh = node.getMesh()
    if (mesh) {
      const toPivot = inv.clone().multiply(worlds.get(node))
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')
        if (!pos) continue
        // Prefer true vertices; fall back to accessor AABB corners.
        const count = pos.getCount()
        const step = count > 12_000 ? 4 : 1
        const normalized = pos.getNormalized()
        const min = normalized ? pos.getMinNormalized([]) : null
        const max = normalized ? pos.getMaxNormalized([]) : null
        if (normalized && min && max) {
          // Dequantize via element: getElement returns raw; use corner method for speed when normalized.
          for (const x of [min[0], max[0]]) {
            for (const y of [min[1], max[1]]) {
              for (const z of [min[2], max[2]]) {
                v.set(x, y, z).applyMatrix4(toPivot)
                const along = v.dot(axle)
                const rSq = v.lengthSq() - along * along
                if (rSq > maxR * maxR) maxR = Math.sqrt(Math.max(0, rSq))
              }
            }
          }
        } else {
          for (let i = 0; i < count; i += step) {
            pos.getElement(i, el)
            v.fromArray(el).applyMatrix4(toPivot)
            const along = v.dot(axle)
            const rSq = v.lengthSq() - along * along
            if (rSq > maxR * maxR) maxR = Math.sqrt(Math.max(0, rSq))
          }
        }
      }
    }
    for (const c of node.listChildren()) walk(c)
  }
  walk(pivot)
  return maxR * unitsToMetres
}

const worlds = buildWorldMatrices()
const car = measureCarBounds(worlds)
const carSize = car.getSize(new Vector3())
const lengthUnits = Math.max(carSize.x, carSize.z)
const unitsToMetres = TARGET_LENGTH / lengthUnits

console.log(`file ${glb}`)
console.log(
  `pruned vehicle AABB ${carSize.x.toFixed(1)} × ${carSize.y.toFixed(1)} × ${carSize.z.toFixed(1)} → scale ${unitsToMetres.toFixed(5)} (${TARGET_LENGTH} m)`,
)

for (const name of ['FL_RollingPivot', 'FR_RollingPivot', 'Rear_RollingPivot']) {
  const pivot = findNode(name)
  if (!pivot) {
    console.log(`${name}: missing`)
    continue
  }
  const size = subtreeAABBMetres(pivot, worlds, unitsToMetres)
  if (!size) {
    console.log(`${name}: empty`)
    continue
  }
  const radials = Object.fromEntries(
    Object.entries(AXIS).map(([k, ax]) => [k, subtreeRadialMetres(pivot, worlds, ax, unitsToMetres)]),
  )
  // Thin axis of a single wheel ≈ axle; for rear (two wheels) the axle is still the thin-ish vertical? 
  // Report y/2 (old bug) vs max radial among axes vs radial on thinnest AABB axis.
  const dims = [
    ['x', size.x],
    ['y', size.y],
    ['z', size.z],
  ].sort((a, b) => a[1] - b[1])
  const thin = dims[0][0]
  console.log(
    `${name}:\n` +
      `  AABB ${size.x.toFixed(3)}×${size.y.toFixed(3)}×${size.z.toFixed(3)} m\n` +
      `  old y/2           = ${(size.y / 2).toFixed(3)} m\n` +
      `  radial on thin(${thin}) = ${radials[thin].toFixed(3)} m\n` +
      `  radial x/y/z      = ${radials.x.toFixed(3)} / ${radials.y.toFixed(3)} / ${radials.z.toFixed(3)} m`,
  )
}
