/**
 * Write spatial-meta.json from an existing GLB (no re-optimize).
 *
 * Usage:
 *   node building-viewer/scripts/bake-spatial-meta.mjs --input public/models/icm-ext/model-web.glb
 *   node building-viewer/scripts/bake-spatial-meta.mjs --input public/models/icm-ext/model-web.glb --out public/models/icm-ext/spatial-meta.json
 */
import { access, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

function parseArgs(argv) {
  const args = { input: null, out: null, bandHeight: 3.6 }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input') args.input = resolve(argv[++i])
    else if (a === '--out') args.out = resolve(argv[++i])
    else if (a === '--band-height') args.bandHeight = Number(argv[++i])
  }
  return args
}

function computeSpatialMeta(document, bandHeight) {
  const root = document.getRoot()
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const arr = pos.getArray()
      for (let i = 0; i + 2 < arr.length; i += 3) {
        const x = arr[i]
        const y = arr[i + 1]
        const z = arr[i + 2]
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (z < minZ) minZ = z
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
        if (z > maxZ) maxZ = z
      }
    }
  }

  if (!Number.isFinite(minX)) {
    minX = minY = minZ = 0
    maxX = maxY = maxZ = 1
  }

  return {
    version: 1,
    sceneMin: [minX, minY, minZ],
    sceneMax: [maxX, maxY, maxZ],
    bandHeight,
    cellSize: [12, 4, 12],
  }
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.input) {
    console.error('Required: --input <model.glb> [--out spatial-meta.json]')
    process.exit(1)
  }
  await access(args.input)
  const outPath = args.out || join(dirname(args.input), 'spatial-meta.json')

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.read(args.input)
  const meta = computeSpatialMeta(doc, args.bandHeight)
  await writeFile(outPath, JSON.stringify(meta, null, 2))
  console.log(`Wrote ${outPath}`)
  console.log(
    `  bounds Y ${meta.sceneMin[1].toFixed(2)} … ${meta.sceneMax[1].toFixed(2)} · band ${meta.bandHeight}m`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
