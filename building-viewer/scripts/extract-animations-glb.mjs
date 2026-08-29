/**
 * Extract animation rig + clips only (no render meshes) for streaming layers.
 *
 * Usage:
 *   node building-viewer/scripts/extract-animations-glb.mjs --input public/models/icm-anim-2025/model-web.glb
 */
import { access, writeFile, stat } from 'node:fs/promises'
import { dirname, join, resolve, basename } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { cloneDocument, prune } from '@gltf-transform/functions'

function parseArgs(argv) {
  const args = { input: null, out: null }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input') args.input = resolve(argv[++i])
    else if (a === '--out') args.out = resolve(argv[++i])
  }
  return args
}

function collectAnimTargetNodes(root) {
  const keep = new Set()
  for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode()
      if (!node) continue
      let n = node
      while (n) {
        keep.add(n)
        n = n.getParentNode()
      }
    }
  }
  return keep
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.input) {
    console.error('Required: --input <model.glb>')
    process.exit(1)
  }
  await access(args.input)
  const outPath = args.out || join(dirname(args.input), 'animations.glb')

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const source = await io.read(args.input)
  const doc = cloneDocument(source)
  const root = doc.getRoot()
  const keepNodes = collectAnimTargetNodes(root)

  for (const node of [...root.listNodes()]) {
    if (!keepNodes.has(node)) node.dispose()
  }
  for (const mesh of [...root.listMeshes()]) {
    for (const prim of [...mesh.listPrimitives()]) {
      mesh.removePrimitive(prim)
      prim.dispose()
    }
    mesh.dispose()
  }
  for (const tex of [...root.listTextures()]) tex.dispose()
  await doc.transform(prune())

  await io.write(outPath, doc)
  const size = (await stat(outPath)).size
  const anims = root.listAnimations().length
  console.log(`Wrote ${outPath} (${(size / 1024).toFixed(1)} KiB) · ${anims} clip(s)`)
  console.log(
    `Manifest field: "animation": "/models/${basename(dirname(outPath))}/animations.glb"`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
