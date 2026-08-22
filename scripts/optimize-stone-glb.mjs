/**
 * Compress the Meshy stratified-stone GLB for the floating-stone hero.
 * Never overwrites the source — writes public/models/stone.glb.
 *
 *   node scripts/optimize-stone-glb.mjs
 */
import { mkdir, readFile, rename, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import {
  dedup,
  prune,
  quantize,
  simplify,
  textureCompress,
  weld,
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const INPUT =
  process.argv[2] ||
  'C:/Users/Mirjan/Downloads/Meshy_AI_Stratified_Stone_0818003703_texture.glb'
const OUT_DIR = join(root, 'public', 'models')
const OUT_FILE = 'stone.glb'

function countTriangles(document) {
  let triangles = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices()
      const position = prim.getAttribute('POSITION')
      if (indices) triangles += indices.getCount() / 3
      else if (position) triangles += position.getCount() / 3
    }
  }
  return Math.round(triangles)
}

async function main() {
  await MeshoptSimplifier.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const document = await io.read(INPUT)

  for (const material of document.getRoot().listMaterials()) {
    material.setDoubleSided(false)
    material.setMetallicFactor(0)
  }

  await document.transform(
    weld(),
    dedup(),
    prune(),
    simplify({
      simplifier: MeshoptSimplifier,
      ratio: 0.08,
      error: 0.002,
    }),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      quality: 82,
      resize: [2048, 2048],
      slots: /baseColor/,
    }),
    textureCompress({
      encoder: sharp,
      targetFormat: 'jpeg',
      quality: 88,
      resize: [2048, 2048],
      slots: /normal/,
    }),
    // JPEG for MR — flat-ish Meshy ORM webps have been written corrupt under EXT_texture_webp.
    textureCompress({
      encoder: sharp,
      targetFormat: 'jpeg',
      quality: 88,
      resize: [1024, 1024],
      slots: /metallicRoughness/,
    }),
    quantize({
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
    }),
    prune(),
  )

  await assertTexturesDecodable(document)

  await mkdir(OUT_DIR, { recursive: true })
  const outPath = join(OUT_DIR, OUT_FILE)
  const tmpPath = join(OUT_DIR, `${OUT_FILE}.tmp.glb`)
  await io.write(tmpPath, document)
  try {
    await unlink(outPath)
  } catch {
    /* first write */
  }
  await rename(tmpPath, outPath)

  const size = (await readFile(outPath)).length
  const miB = size / (1024 * 1024)
  console.log(
    `Wrote ${outPath}\n  ${countTriangles(document).toLocaleString()} tris · ${miB.toFixed(2)} MiB`,
  )
  if (miB > 20) {
    console.warn('Output is still large for a hero asset — consider a lower simplify ratio.')
  }
}

/** Fail the build if any embedded image cannot be decoded (catches corrupt WebP writes). */
async function assertTexturesDecodable(document) {
  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage()
    const mime = texture.getMimeType() || 'unknown'
    if (!image?.byteLength) {
      throw new Error(`Texture "${texture.getName() || mime}" has empty image data`)
    }
    try {
      await sharp(Buffer.from(image)).metadata()
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      throw new Error(`Texture "${texture.getName() || mime}" is not decodable (${mime}): ${why}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
