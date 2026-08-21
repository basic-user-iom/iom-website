/**
 * Report which lamp groups the runtime heuristics bind on a GLB, where each lamp sits,
 * and which lamp-looking materials stay unbound. Uses the same classifier as the app.
 *   npm run probe:lamps -- [glb]
 */
import { resolve } from 'node:path'
import { NodeIO, type Node } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { VEHICLE_LIGHT_GROUP_IDS } from '../src/persistence/schema'
import { lampGroupForNames } from '../src/vehicle/vehicleLights'

const glb = resolve(
  process.argv[2] || 'F:/iom_website/automotive-studio/_dev/lixiang-mobile-rigged.glb',
)
const LAMPISH = /light|lamp|drl|beam|tail|brake|signal|blink|indicat|head|rear|glass|lens|led/i

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(glb)
const root = doc.getRoot()

const parentOf = new Map<Node, Node>()
for (const node of root.listNodes()) {
  for (const child of node.listChildren()) parentOf.set(child, node)
}

const localMatrix = (n: Node) =>
  new Matrix4().compose(
    new Vector3(...n.getTranslation()),
    new Quaternion(...n.getRotation()),
    new Vector3(...n.getScale()),
  )
const worldOf = new Map<Node, Matrix4>()
const walkWorld = (n: Node, parent: Matrix4) => {
  const world = new Matrix4().multiplyMatrices(parent, localMatrix(n))
  worldOf.set(n, world)
  for (const c of n.listChildren()) walkWorld(c, world)
}
for (const scene of root.listScenes()) {
  for (const n of scene.listChildren()) walkWorld(n, new Matrix4())
}

/** Approximate world centre of a node's mesh from its POSITION accessor bounds. */
function worldCentre(node: Node): Vector3 | null {
  const mesh = node.getMesh()
  const world = worldOf.get(node)
  if (!mesh || !world) return null
  const lo = new Vector3(Infinity, Infinity, Infinity)
  const hi = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos) continue
    lo.min(new Vector3(...(pos.getMin([]) as number[])))
    hi.max(new Vector3(...(pos.getMax([]) as number[])))
  }
  if (!Number.isFinite(lo.x)) return null
  return lo.add(hi).multiplyScalar(0.5).applyMatrix4(world)
}

const counts = Object.fromEntries(VEHICLE_LIGHT_GROUP_IDS.map((id) => [id, 0])) as Record<
  string,
  number
>
const bound: string[] = []
const misses: string[] = []

for (const node of root.listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  const meshName = node.getName() || ''
  const parentName = parentOf.get(node)?.getName() || ''
  const centre = worldCentre(node)
  const where = centre
    ? `x ${centre.x.toFixed(2)} y ${centre.y.toFixed(2)} z ${centre.z.toFixed(2)}`
    : 'no bounds'

  for (const prim of mesh.listPrimitives()) {
    const matName = prim.getMaterial()?.getName() || ''
    const group = lampGroupForNames(meshName, parentName, matName)
    if (group) {
      counts[group] += 1
      bound.push(`${group.padEnd(9)} ← ${(matName || '(unnamed)').padEnd(14)} ${where}`)
    } else if (LAMPISH.test(`${meshName} ${parentName} ${matName}`)) {
      misses.push(`${(matName || '(none)').padEnd(14)} on ${meshName.padEnd(18)} ${where}`)
    }
  }
}

console.log(`\nModel: ${glb}\n`)
console.log('Bind counts (per material, before shared-material dedup):')
for (const id of VEHICLE_LIGHT_GROUP_IDS) console.log(`  ${id.padEnd(15)} ${counts[id]}`)

console.log(`\nMatches (${bound.length}):`)
for (const b of bound) console.log(`  ${b}`)

console.log(`\nLamp-looking meshes still unbound (${misses.length}):`)
for (const m of misses.slice(0, 40)) console.log(`  ${m}`)
if (misses.length > 40) console.log(`  … and ${misses.length - 40} more`)
