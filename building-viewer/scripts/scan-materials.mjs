/**
 * Analyze GLB materials for duplicates / merge candidates.
 * Does not modify the file.
 *
 * Usage:
 *   node building-viewer/scripts/scan-materials.mjs --input public/models/icm-ext/model-web.glb
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createGltfIO } from './lib/gltf-io.mjs'

function parseArgs(argv) {
  const args = { input: null, out: null, tolerance: 0.002 }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input') args.input = resolve(argv[++i])
    else if (a === '--out') args.out = resolve(argv[++i])
    else if (a === '--tolerance') args.tolerance = Number(argv[++i]) || 0.002
  }
  return args
}

function round(n, t = 0.002) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0
  return Math.round(n / t) * t
}

function texKey(tex) {
  if (!tex) return 'none'
  const img = tex.getImage?.()
  const uri = tex.getURI?.() || ''
  const name = tex.getName?.() || ''
  if (img?.byteLength) {
    const h = createHash('sha1').update(Buffer.from(img)).digest('hex').slice(0, 16)
    return `img:${h}:${img.byteLength}`
  }
  return `uri:${uri || name || 'unnamed'}`
}

function extTransmission(mat) {
  const ext = mat.getExtension?.('KHR_materials_transmission')
  if (!ext) return 0
  return typeof ext.getTransmissionFactor === 'function' ? ext.getTransmissionFactor() : 0
}

function extIor(mat) {
  const ext = mat.getExtension?.('KHR_materials_ior')
  if (!ext) return null
  return typeof ext.getIOR === 'function' ? ext.getIOR() : null
}

function materialSignature(mat, tolerance) {
  const base = mat.getBaseColorFactor?.() || [1, 1, 1, 1]
  const emissive = mat.getEmissiveFactor?.() || [0, 0, 0]
  return JSON.stringify({
    type: mat.getAlphaMode?.() || 'OPAQUE',
    double: mat.getDoubleSided?.() ? 1 : 0,
    base: base.map((v) => round(v, tolerance)),
    metal: round(mat.getMetallicFactor?.() ?? 0, tolerance),
    rough: round(mat.getRoughnessFactor?.() ?? 1, tolerance),
    emissive: emissive.map((v) => round(v, tolerance)),
    alpha: round(mat.getAlpha?.() ?? 1, tolerance),
    transmission: round(extTransmission(mat), tolerance),
    ior: extIor(mat) != null ? round(extIor(mat), tolerance) : null,
    baseTex: texKey(mat.getBaseColorTexture?.()),
    normalTex: texKey(mat.getNormalTexture?.()),
    mrTex: texKey(mat.getMetallicRoughnessTexture?.()),
    occTex: texKey(mat.getOcclusionTexture?.()),
    emissiveTex: texKey(mat.getEmissiveTexture?.()),
  })
}

function countPrimUses(document) {
  /** @type {Map<object, number>} */
  const uses = new Map()
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial()
      if (!mat) continue
      uses.set(mat, (uses.get(mat) || 0) + 1)
    }
  }
  return uses
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.input) {
    console.error('Required: --input <glb>')
    process.exit(1)
  }

  const bytes = (await readFile(args.input)).length
  const io = await createGltfIO()
  const document = await io.read(args.input)
  const materials = document.getRoot().listMaterials()
  const uses = countPrimUses(document)

  /** @type {Map<string, { sig: string, members: object[] }>} */
  const bySig = new Map()
  /** @type {Map<string, object[]>} */
  const byName = new Map()

  for (const mat of materials) {
    const sig = materialSignature(mat, args.tolerance)
    let group = bySig.get(sig)
    if (!group) {
      group = { sig, members: [] }
      bySig.set(sig, group)
    }
    group.members.push(mat)

    const name = (mat.getName() || '(unnamed)').trim()
    const list = byName.get(name) || []
    list.push(mat)
    byName.set(name, list)
  }

  const duplicateSigGroups = [...bySig.values()].filter((g) => g.members.length > 1)
  const duplicateNameGroups = [...byName.entries()].filter(([, list]) => list.length > 1)

  const mergeCandidates = duplicateSigGroups.map((g) => {
    const names = g.members.map((m) => m.getName() || '(unnamed)')
    const primCount = g.members.reduce((s, m) => s + (uses.get(m) || 0), 0)
    return {
      signature: g.sig,
      count: g.members.length,
      names: [...new Set(names)],
      primitiveUses: primCount,
      removable: g.members.length - 1,
    }
  })

  mergeCandidates.sort((a, b) => b.removable - a.removable)

  const textureCount = document.getRoot().listTextures().length
  const ktx2 = document
    .getRoot()
    .listTextures()
    .filter((t) => t.getMimeType?.() === 'image/ktx2').length

  const report = {
    input: args.input,
    fileMiB: Number((bytes / (1024 * 1024)).toFixed(2)),
    materials: materials.length,
    uniqueSignatures: bySig.size,
    duplicateSignatureGroups: duplicateSigGroups.length,
    mergeableMaterials: mergeCandidates.reduce((s, g) => s + g.removable, 0),
    duplicateNameGroups: duplicateNameGroups.length,
    textures: textureCount,
    ktx2Textures: ktx2,
    extensionsUsed: document
      .getRoot()
      .listExtensionsUsed()
      .map((e) => e.extensionName),
    topMergeCandidates: mergeCandidates.slice(0, 25),
    duplicateNames: duplicateNameGroups.slice(0, 15).map(([name, list]) => ({
      name,
      count: list.length,
      sameSignature: new Set(list.map((m) => materialSignature(m, args.tolerance))).size === 1,
    })),
  }

  console.log(`\n${args.input}`)
  console.log(`  file: ${report.fileMiB} MiB`)
  console.log(`  materials: ${report.materials} (${report.uniqueSignatures} unique signatures)`)
  console.log(
    `  merge candidates: ${report.mergeableMaterials} removable across ${report.duplicateSignatureGroups} groups`,
  )
  console.log(`  duplicate names: ${report.duplicateNameGroups} groups`)
  console.log(`  textures: ${report.textures}${ktx2 ? ` (${ktx2} KTX2)` : ''}`)

  if (mergeCandidates.length) {
    console.log('\n  Top merge groups:')
    for (const g of mergeCandidates.slice(0, 8)) {
      console.log(
        `    - ${g.count} mats (${g.removable} removable, ${g.primitiveUses} prims): ${g.names.slice(0, 4).join(', ')}${g.names.length > 4 ? '…' : ''}`,
      )
    }
  } else {
    console.log('\n  No duplicate signatures found at tolerance', args.tolerance)
  }

  if (args.out) {
    await writeFile(args.out, JSON.stringify(report, null, 2))
    console.log(`\nWrote ${args.out}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
