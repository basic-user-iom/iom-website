/**
 * Apply signature-based material merge to an existing GLB (in-place optional).
 * Usage:
 *   node building-viewer/scripts/merge-materials-glb.mjs --input public/models/icm-ext/model-web.glb
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune } from '@gltf-transform/functions'

function parseArgs(argv) {
  const args = { input: null, out: null, tolerance: 0.002, prune: true }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input') args.input = resolve(argv[++i])
    else if (a === '--out') args.out = resolve(argv[++i])
    else if (a === '--tolerance') args.tolerance = Number(argv[++i]) || 0.002
    else if (a === '--no-prune') args.prune = false
  }
  return args
}

function roundMat(n, t = 0.002) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0
  return Math.round(n / t) * t
}

function texSigKey(tex) {
  if (!tex) return 'none'
  const img = tex.getImage?.()
  if (img?.byteLength) {
    const h = createHash('sha1').update(Buffer.from(img)).digest('hex').slice(0, 16)
    return `img:${h}:${img.byteLength}`
  }
  return `uri:${tex.getURI?.() || tex.getName?.() || 'unnamed'}`
}

function materialSignature(mat, tolerance) {
  const base = mat.getBaseColorFactor?.() || [1, 1, 1, 1]
  const emissive = mat.getEmissiveFactor?.() || [0, 0, 0]
  const ext = mat.getExtension?.('KHR_materials_transmission')
  const transmission =
    typeof ext?.getTransmissionFactor === 'function' ? ext.getTransmissionFactor() : 0
  return JSON.stringify({
    type: mat.getAlphaMode?.() || 'OPAQUE',
    double: mat.getDoubleSided?.() ? 1 : 0,
    base: base.map((v) => roundMat(v, tolerance)),
    metal: roundMat(mat.getMetallicFactor?.() ?? 0, tolerance),
    rough: roundMat(mat.getRoughnessFactor?.() ?? 1, tolerance),
    emissive: emissive.map((v) => roundMat(v, tolerance)),
    alpha: roundMat(mat.getAlpha?.() ?? 1, tolerance),
    transmission: roundMat(transmission, tolerance),
    baseTex: texSigKey(mat.getBaseColorTexture?.()),
    normalTex: texSigKey(mat.getNormalTexture?.()),
    mrTex: texSigKey(mat.getMetallicRoughnessTexture?.()),
    occTex: texSigKey(mat.getOcclusionTexture?.()),
    emissiveTex: texSigKey(mat.getEmissiveTexture?.()),
  })
}

function mergeMaterialsBySignature(document, tolerance) {
  const root = document.getRoot()
  const groups = new Map()
  for (const mat of root.listMaterials()) {
    const sig = materialSignature(mat, tolerance)
    const list = groups.get(sig) || []
    list.push(mat)
    groups.set(sig, list)
  }
  let merged = 0
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const canonical = list[0]
    for (let i = 1; i < list.length; i++) {
      const dup = list[i]
      dup.listParents().forEach((property) => {
        if (property !== root) property.swap(dup, canonical)
      })
      dup.dispose()
      merged += 1
    }
  }
  return merged
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.input) {
    console.error('Required: --input <glb>')
    process.exit(1)
  }
  const beforeBytes = (await readFile(args.input)).length
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const document = await io.read(args.input)
  const before = document.getRoot().listMaterials().length
  const merged = mergeMaterialsBySignature(document, args.tolerance)
  if (args.prune) await document.transform(dedup(), prune())
  const after = document.getRoot().listMaterials().length
  let tris = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices()
      const pos = prim.getAttribute('POSITION')
      if (idx) tris += Math.floor(idx.getCount() / 3)
      else if (pos) tris += Math.floor(pos.getCount() / 3)
    }
  }
  const out = args.out || args.input.replace(/\.glb$/i, '.merged.glb')
  await io.write(out, document)
  const afterBytes = (await readFile(out)).length
  console.log(`${args.input}`)
  console.log(`  materials: ${before} → ${after} (merged ${merged})`)
  console.log(`  tris after merge: ${tris.toLocaleString()}`)
  console.log(`  file: ${(beforeBytes / 1024 / 1024).toFixed(2)} → ${(afterBytes / 1024 / 1024).toFixed(2)} MiB`)
  console.log(`  wrote ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
