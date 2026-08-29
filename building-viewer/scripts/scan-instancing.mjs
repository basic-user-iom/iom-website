/**
 * Build-time scan: find repeating structural primitives in a GLB and report
 * instancing / join opportunities. Does not modify the file.
 *
 * Usage:
 *   node building-viewer/scripts/scan-instancing.mjs --input public/models/icm-ext/model-web.glb
 *   node building-viewer/scripts/scan-instancing.mjs --input … --out report.json
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createGltfIO } from './lib/gltf-io.mjs'

function parseArgs(argv) {
  const args = { input: null, out: null, min: 3 }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input') args.input = resolve(argv[++i])
    else if (a === '--out') args.out = resolve(argv[++i])
    else if (a === '--min') args.min = Number(argv[++i]) || 3
  }
  return args
}

function accessorFingerprint(accessor) {
  if (!accessor) return 'none'
  const arr = accessor.getArray()
  if (!arr) return `${accessor.getCount()}:empty`
  const n = arr.length
  const step = Math.max(1, Math.floor(n / 32))
  const h = createHash('sha1')
  h.update(String(n))
  for (let i = 0; i < n; i += step) h.update(String(arr[i]))
  if (n > 0) {
    h.update(String(arr[0]))
    h.update(String(arr[n - 1]))
  }
  return h.digest('hex').slice(0, 12)
}

function primitiveKey(prim) {
  const pos = prim.getAttribute('POSITION')
  const idx = prim.getIndices()
  const mat = prim.getMaterial()
  return [
    `pos:${accessorFingerprint(pos)}`,
    `idx:${accessorFingerprint(idx)}`,
    `mat:${mat?.getName() || mat?.getURI?.() || 'default'}`,
    `mode:${prim.getMode()}`,
  ].join('|')
}

function countTris(prim) {
  const idx = prim.getIndices()
  const pos = prim.getAttribute('POSITION')
  if (idx) return Math.floor(idx.getCount() / 3)
  if (pos) return Math.floor(pos.getCount() / 3)
  return 0
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.input) {
    console.error('Required: --input <glb>')
    process.exit(1)
  }

  const io = await createGltfIO()
  const document = await io.read(args.input)
  const root = document.getRoot()

  /** @type {Map<string, { count: number, tris: number, meshNames: Set<string> }>} */
  const groups = new Map()
  let primitives = 0
  let meshes = 0

  for (const mesh of root.listMeshes()) {
    meshes += 1
    for (const prim of mesh.listPrimitives()) {
      primitives += 1
      const key = primitiveKey(prim)
      const tris = countTris(prim)
      const g = groups.get(key)
      if (g) {
        g.count += 1
        g.tris += tris
        g.meshNames.add(mesh.getName() || '(unnamed)')
      } else {
        groups.set(key, {
          count: 1,
          tris,
          meshNames: new Set([mesh.getName() || '(unnamed)']),
        })
      }
    }
  }

  const repeats = [...groups.entries()]
    .map(([key, g]) => ({
      key,
      count: g.count,
      trisEach: Math.round(g.tris / g.count),
      trisTotal: g.tris,
      names: [...g.meshNames].slice(0, 5),
    }))
    .filter((g) => g.count >= args.min)
    .sort((a, b) => b.count - a.count)

  const instanceableMeshes = repeats.reduce((s, g) => s + g.count, 0)
  const drawCallsSaved = repeats.reduce((s, g) => s + (g.count - 1), 0)

  const report = {
    input: args.input,
    meshes,
    primitives,
    uniquePrimitiveSignatures: groups.size,
    minInstances: args.min,
    repeatGroups: repeats.length,
    instanceablePrimitives: instanceableMeshes,
    estimatedDrawCallsSavedIfInstanced: drawCallsSaved,
    topGroups: repeats.slice(0, 25),
    recommendation:
      drawCallsSaved > 100
        ? 'High repeat rate — runtime InstancedMesh + build-time EXT_mesh_gpu_instancing will help.'
        : drawCallsSaved > 0
          ? 'Some repeats found — runtime instancing helps modestly; unique CAD parts need BatchedMesh / material join.'
          : 'Almost no repeating primitives — prefer mesh join by material or BatchedMesh, not InstancedMesh.',
    createdAt: new Date().toISOString(),
  }

  const summary = [
    `Scan: ${args.input}`,
    `Meshes: ${meshes} · Primitives: ${primitives} · Unique signatures: ${groups.size}`,
    `Repeat groups (≥${args.min}): ${repeats.length}`,
    `Instanceable primitives: ${instanceableMeshes}`,
    `Est. draw calls saved if instanced: ${drawCallsSaved}`,
    report.recommendation,
    '',
    'Top groups:',
    ...repeats.slice(0, 12).map(
      (g) => `  ×${g.count} · ${g.trisEach} tris · ${g.names.join(', ')}`,
    ),
  ].join('\n')

  console.log(summary)

  if (args.out) {
    await writeFile(args.out, JSON.stringify(report, null, 2))
    console.log(`\nWrote ${args.out}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

