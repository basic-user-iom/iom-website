/**
 * Build raven LOD variants from the desktop GLTF.
 *
 * Outputs (all single-raven — second bird + props pruned):
 *   - common-ravens-mobile.glb : 512px textures, ~30k tris (ratio 0.75, from ~72k Full)
 *   - common-ravens-medium.glb : 1024px textures, ~28k tris (ratio 0.6)
 *   - common-ravens-coarse.glb : 512px textures, ~22k tris (ratio 0.35)
 *
 * Pipeline: weld → dedup → flatten (merge by material) → prune → meshopt simplify.
 * Feather cards merge before simplify so decimation can actually reduce triangle count.
 * Skinned meshes keep joints/weights — wing-flap animation should still play.
 *
 * Run: node scripts/build-mobile-raven.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { dedup, flatten, prune, simplify, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const input = join(root, 'public/assets/ravens/common-ravens.gltf')
const outDir = join(root, 'public/assets/ravens')

const VARIANTS = [
  { name: 'mobile', file: 'common-ravens-mobile.glb', resize: [512, 512], ratio: 0.75, error: 0.25 },
  { name: 'medium', file: 'common-ravens-medium.glb', resize: [1024, 1024], ratio: 0.6, error: 0.5 },
  { name: 'coarse', file: 'common-ravens-coarse.glb', resize: [512, 512], ratio: 0.35, error: 1 },
]

function shouldRemoveNode(name) {
  return name.includes('.001') || name === 'props_g'
}

/** Count render triangles (handles TRIANGLE_STRIP primitives correctly). */
function countTriangles(document) {
  let triangles = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mode = prim.getMode()
      const indices = prim.getIndices()
      const position = prim.getAttribute('POSITION')
      if (indices) {
        const n = indices.getCount()
        // glTF: 4 = TRIANGLES, 5 = TRIANGLE_STRIP
        triangles += mode === 5 ? Math.max(0, n - 2) : n / 3
      } else if (position) {
        triangles += position.getCount() / 3
      }
    }
  }
  return Math.round(triangles)
}

async function buildVariant(io, variant) {
  const document = await io.read(input)
  const rootNode = document.getRoot()

  for (const node of [...rootNode.listNodes()]) {
    if (shouldRemoveNode(node.getName())) node.dispose()
  }
  for (const mesh of [...rootNode.listMeshes()]) {
    if (shouldRemoveNode(mesh.getName())) mesh.dispose()
  }

  const transforms = [
    weld(),
    dedup(),
    flatten(),
    prune(),
    simplify({ simplifier: MeshoptSimplifier, ratio: variant.ratio, error: variant.error }),
  ]

  transforms.push(
    textureCompress({
      encoder: sharp,
      resize: variant.resize,
      targetFormat: 'png',
    }),
  )

  await document.transform(...transforms)

  const outPath = join(outDir, variant.file)
  await io.write(outPath, document)

  const size = (await readFile(outPath)).length
  const tris = countTriangles(document)
  console.log(
    `Wrote ${variant.file} — ${tris.toLocaleString()} tris · ${(size / 1024 / 1024).toFixed(2)} MB` +
      (variant.ratio < 1 ? ` (simplify ratio ${variant.ratio})` : ''),
  )
}

async function main() {
  await MeshoptSimplifier.ready
  const io = new NodeIO()
  for (const variant of VARIANTS) {
    await buildVariant(io, variant)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
