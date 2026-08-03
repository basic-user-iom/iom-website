/**
 * Debug: list scene parts with bounds so watermark / prop planes can be told apart
 * from the vehicle body.
 *
 *   node automotive-studio/scripts/inspect-scene-parts.mjs [glb]
 */
import { resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'

const DEFAULT = resolve(
  'F:/FREE_Lixiang_L9_2024_(White_Interior)/optimized/lixiang-presentation-high-rigged.glb',
)

const EXCLUDE_NAME_RE = /(discord|logo|sketchfab|credit|promo|watermark)/i
/** Candidate replacement: also drops the floor promo text that inflates vehicle length. */
const EXCLUDE_STRICT_RE = /(discord|logo|sketchfab|credit|promo|watermark)|^text[._\-\d]/i

function localMatrix(node) {
  return new Matrix4().compose(
    new Vector3().fromArray(node.getTranslation()),
    new Quaternion().fromArray(node.getRotation()),
    new Vector3().fromArray(node.getScale()),
  )
}

function subtreeBounds(node, parentMatrix = new Matrix4()) {
  const box = new Box3()
  const walk = (n, parent) => {
    const world = new Matrix4().multiplyMatrices(parent, localMatrix(n))
    const mesh = n.getMesh()
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')
        if (!pos) continue
        const min = new Vector3().fromArray(pos.getMinNormalized([]))
        const max = new Vector3().fromArray(pos.getMaxNormalized([]))
        box.union(new Box3(min, max).applyMatrix4(world))
      }
    }
    for (const c of n.listChildren()) walk(c, world)
  }
  walk(node, parentMatrix)
  return box.isEmpty() ? null : box
}

const fmt = (v) => `[${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)}]`

async function main() {
  const file = process.argv[2] ? resolve(process.argv[2]) : DEFAULT
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.read(file)
  const root = doc.getRoot()
  console.log(`file: ${file}\n`)

  // Sketchfab wraps everything in Sketchfab_model / root / GLTF_SceneRootNode; the real
  // parts are that node's children.
  const wrappers = new Set(['Sketchfab_model', 'root', 'GLTF_SceneRootNode', 'RootNode'])
  let partsParent = null
  let partsMatrix = new Matrix4()
  const findParts = (n, parent) => {
    const world = new Matrix4().multiplyMatrices(parent, localMatrix(n))
    if (wrappers.has(n.getName() || '')) {
      partsParent = n
      partsMatrix = world
      for (const c of n.listChildren()) findParts(c, world)
    }
  }
  for (const scene of root.listScenes()) {
    for (const child of scene.listChildren()) findParts(child, new Matrix4())
  }
  if (!partsParent) throw new Error('Could not locate scene root wrapper')

  const rows = partsParent.listChildren().map((n) => {
    const b = subtreeBounds(n, partsMatrix)
    return {
      name: n.getName() || '(unnamed)',
      size: b ? b.getSize(new Vector3()) : new Vector3(),
      centre: b ? b.getCenter(new Vector3()) : new Vector3(),
      box: b,
      excluded: EXCLUDE_NAME_RE.test(n.getName() || ''),
      excludedStrict: EXCLUDE_STRICT_RE.test(n.getName() || ''),
    }
  })

  rows.sort((a, b) => Math.max(b.size.x, b.size.z) - Math.max(a.size.x, a.size.z))

  console.log(`parts under ${partsParent.getName()} (${rows.length}), largest footprint first:`)
  for (const r of rows) {
    console.log(
      `  ${fmt(r.size)} centre ${fmt(r.centre)}  ${r.name}${r.excluded ? '  ← name matches exclusion regex' : ''}`,
    )
  }

  const union = (filter) => {
    const box = new Box3()
    for (const r of rows) {
      if (!r.box || !filter(r)) continue
      box.union(r.box)
    }
    return box.isEmpty() ? null : box
  }

  console.log('\nBounds comparison (target length 5.1 m along Z, tire diameter 20.7 units):')
  for (const [label, box] of [
    ['everything', union(() => true)],
    ['current exclusion regex', union((r) => !r.excluded)],
    ['strict regex (also drops promo Text)', union((r) => !r.excludedStrict)],
  ]) {
    if (!box) continue
    const size = box.getSize(new Vector3())
    const scale = 5.1 / size.z
    console.log(
      `  ${label}\n    size ${fmt(size)} centre ${fmt(box.getCenter(new Vector3()))}` +
        `\n    → scale ${scale.toFixed(5)} · tire radius ${((20.7 / 2) * scale).toFixed(3)} m`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
