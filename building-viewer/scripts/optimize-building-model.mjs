/**
 * Building-viewer GLB optimizer (WEB / QUEST profiles).
 * Shares the same glTF Transform + meshoptimizer + sharp stack as
 * automotive-studio/scripts/optimize-model.mjs — does not overwrite sources.
 *
 * Textures: role-aware resize → KTX2/Basis (ETC1S color, UASTC data) with mipmaps.
 *
 * Usage:
 *   node building-viewer/scripts/optimize-building-model.mjs \
 *     --input <src.glb> --out <dir> --name model [--variant web|quest|all] [--no-ktx2]
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, access, rename, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PropertyType } from '@gltf-transform/core'
import { KHRTextureBasisu } from '@gltf-transform/extensions'
import {
  dedup,
  prune,
  quantize,
  resample,
  simplify,
  weld,
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { createGltfIO } from './lib/gltf-io.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KTX2_ENCODER_VERSION = '0.6.0'
let encodeToKTX2Cached = null

async function loadKtx2Encoder() {
  if (encodeToKTX2Cached) return encodeToKTX2Cached
  try {
    const module = await import('ktx2-encoder')
    if (typeof module.encodeToKTX2 !== 'function') {
      throw new Error('package does not export encodeToKTX2')
    }
    encodeToKTX2Cached = module.encodeToKTX2
    return encodeToKTX2Cached
  } catch (error) {
    throw new Error(
      `KTX2 encoding requires the pinned ktx2-encoder ${KTX2_ENCODER_VERSION}. ` +
        'Run `npm --prefix building-viewer ci`, or use --no-ktx2 for a raster-only diagnostic build. ' +
        `Cause: ${error instanceof Error ? error.message : error}`,
    )
  }
}

/**
 * Drop triangles with repeated indices or exact zero geometric area (post-simplify/quantize).
 * Returns { removed, kept }.
 * @param {import('@gltf-transform/core').Document} document
 */
function removeDegenerateTriangles(document) {
  const root = document.getRoot()
  let removed = 0
  let kept = 0

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const indices = prim.getIndices()
      if (!indices) continue

      const src = indices.getArray()
      if (!src || src.length < 3) continue

      const out = []
      const ax = [0, 0, 0]
      const bx = [0, 0, 0]
      const cx = [0, 0, 0]

      for (let i = 0; i + 2 < src.length; i += 3) {
        const ia = src[i]
        const ib = src[i + 1]
        const ic = src[i + 2]
        if (ia === ib || ib === ic || ia === ic) {
          removed += 1
          continue
        }
        pos.getElement(ia, ax)
        pos.getElement(ib, bx)
        pos.getElement(ic, cx)
        const abx = bx[0] - ax[0]
        const aby = bx[1] - ax[1]
        const abz = bx[2] - ax[2]
        const acx = cx[0] - ax[0]
        const acy = cx[1] - ax[1]
        const acz = cx[2] - ax[2]
        const nx = aby * acz - abz * acy
        const ny = abz * acx - abx * acz
        const nz = abx * acy - aby * acx
        // Exact zero cross-product length² (float equality after quantize/weld).
        if (nx * nx + ny * ny + nz * nz === 0) {
          removed += 1
          continue
        }
        out.push(ia, ib, ic)
        kept += 1
      }

      if (out.length === src.length) continue

      if (out.length === 0) {
        mesh.removePrimitive(prim)
        prim.dispose()
        continue
      }

      const Ctor = src.constructor
      const next = new Ctor(out)
      indices.setArray(next)
    }
  }

  return { removed, kept }
}

/** Scene bounds sidecar for runtime spatial residency (Phase A/C). */
function computeSpatialMeta(document) {
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
    bandHeight: 3.6,
    cellSize: [12, 4, 12],
  }
}

/** @type {Record<string, { file: string, resize: [number, number], format: string, quality: number, simplifyRatio: number|null, simplifyError: number, resampleTolerance: number, quantize: boolean, ktx2Etc1sQuality: number, ktx2UastcLevel: number }>} */
const VARIANTS = {
  web: {
    file: 'model-web.glb',
    resize: [2048, 2048],
    // Intermediate JPEG only when --no-ktx2; KTX2 path keeps PNG until Basis encode.
    format: 'jpeg',
    quality: 85,
    simplifyRatio: null,
    simplifyError: 0,
    resampleTolerance: 0.0001,
    quantize: false,
    ktx2Etc1sQuality: 220,
    ktx2UastcLevel: 2,
  },
  quest: {
    file: 'model-quest.glb',
    resize: [1024, 1024],
    format: 'jpeg',
    quality: 78,
    simplifyRatio: 0.55,
    simplifyError: 0.025,
    resampleTolerance: 0.001,
    quantize: true,
    ktx2Etc1sQuality: 180,
    ktx2UastcLevel: 1,
  },
}

const KTX2_MAGIC = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]

function parseArgs(argv) {
  const args = {
    input: null,
    out: null,
    name: 'model',
    variant: 'all',
    simplifyQuest: true,
    ktx2: true,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input') args.input = resolve(argv[++i])
    else if (a === '--out') args.out = resolve(argv[++i])
    else if (a === '--name') args.name = argv[++i]
    else if (a === '--variant') args.variant = argv[++i]
    else if (a === '--no-simplify') args.simplifyQuest = false
    else if (a === '--no-ktx2') args.ktx2 = false
    else if (a === '--ktx2') args.ktx2 = true
  }
  return args
}

function isKtx2Bytes(bytes) {
  if (!bytes || bytes.byteLength < KTX2_MAGIC.length) return false
  for (let i = 0; i < KTX2_MAGIC.length; i++) {
    if (bytes[i] !== KTX2_MAGIC[i]) return false
  }
  return true
}

async function sha256File(path) {
  const buf = await readFile(path)
  return createHash('sha256').update(buf).digest('hex')
}

function countTriangles(document) {
  let triangles = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mode = prim.getMode()
      const indices = prim.getIndices()
      const position = prim.getAttribute('POSITION')
      if (indices) {
        const n = indices.getCount()
        triangles += mode === 5 ? Math.max(0, n - 2) : n / 3
      } else if (position) {
        triangles += position.getCount() / 3
      }
    }
  }
  return Math.round(triangles)
}

function expandedWorkload(document) {
  let expandedTriangles = 0
  let primitiveDraws = 0
  let meshNodes = 0
  let logicalInstances = 0
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const instancing = node.getExtension('EXT_mesh_gpu_instancing')
    let instanceCount = 1
    if (instancing) {
      for (const semantic of ['TRANSLATION', 'ROTATION', 'SCALE', '_ID']) {
        const accessor = instancing.getAttribute?.(semantic)
        if (accessor) {
          instanceCount = accessor.getCount()
          break
        }
      }
    }
    meshNodes += 1
    logicalInstances += instanceCount
    for (const primitive of mesh.listPrimitives()) {
      primitiveDraws += 1
      const count =
        primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
      const mode = primitive.getMode()
      if (mode === 4) expandedTriangles += Math.floor(count / 3) * instanceCount
      else if (mode === 5 || mode === 6) {
        expandedTriangles += Math.max(0, count - 2) * instanceCount
      }
    }
  }
  return { expandedTriangles, primitiveDraws, meshNodes, logicalInstances }
}

function countTextures(document) {
  return document.getRoot().listTextures().length
}

function estimateTextureBytes(document) {
  let bytes = 0
  for (const texture of document.getRoot().listTextures()) {
    bytes += texture.getImage()?.byteLength || 0
  }
  return bytes
}

async function validateTextureImages(document) {
  let ok = 0
  let bad = 0
  let ktx2 = 0
  const total = document.getRoot().listTextures().length
  for (const texture of document.getRoot().listTextures()) {
    const bytes = texture.getImage()
    if (!bytes || bytes.byteLength === 0) {
      bad += 1
      continue
    }
    const mime = texture.getMimeType?.() || ''
    if (mime === 'image/ktx2' || isKtx2Bytes(bytes)) {
      ok += 1
      ktx2 += 1
      continue
    }
    try {
      await sharp(Buffer.from(bytes)).metadata()
      ok += 1
    } catch {
      bad += 1
    }
  }
  return { ok, bad, total, ktx2 }
}

const GLASS_MAT_NAME =
  /glass|window|glazing|fenster|scheib|verglas|curtain\s*wall|curtainwall|vitrine|storefront/i

const DATA_TEX_NAME =
  /normal|nrm|orm|occlusion|ao_|_ao|rough|metal|opacity|alpha|mask|specular|height|bump/i

function roundMat(n, t = 0.002) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0
  return Math.round(n / t) * t
}

function texSigKey(tex) {
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

function materialSignature(mat, tolerance = 0.002) {
  const base = mat.getBaseColorFactor?.() || [1, 1, 1, 1]
  const emissive = mat.getEmissiveFactor?.() || [0, 0, 0]
  return JSON.stringify({
    type: mat.getAlphaMode?.() || 'OPAQUE',
    double: mat.getDoubleSided?.() ? 1 : 0,
    base: base.map((v) => roundMat(v, tolerance)),
    metal: roundMat(mat.getMetallicFactor?.() ?? 0, tolerance),
    rough: roundMat(mat.getRoughnessFactor?.() ?? 1, tolerance),
    emissive: emissive.map((v) => roundMat(v, tolerance)),
    alpha: roundMat(mat.getAlpha?.() ?? 1, tolerance),
    transmission: roundMat(extTransmission(mat), tolerance),
    ior: extIor(mat) != null ? roundMat(extIor(mat), tolerance) : null,
    baseTex: texSigKey(mat.getBaseColorTexture?.()),
    normalTex: texSigKey(mat.getNormalTexture?.()),
    mrTex: texSigKey(mat.getMetallicRoughnessTexture?.()),
    occTex: texSigKey(mat.getOcclusionTexture?.()),
    emissiveTex: texSigKey(mat.getEmissiveTexture?.()),
  })
}

/** Merge materials with identical visual signatures (names ignored). */
function mergeMaterialsBySignature(document, tolerance = 0.002) {
  const root = document.getRoot()
  const materials = root.listMaterials()
  /** @type {Map<string, object[]>} */
  const groups = new Map()
  for (const mat of materials) {
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

function countMaterials(document) {
  return document.getRoot().listMaterials().length
}

/**
 * Map each texture to material roles (baseColor, normal, metallicRoughness, …).
 * Usage — not image metadata — decides whether JPEG is safe.
 */
function collectTextureRoles(document) {
  /** @type {Map<object, Set<string>>} */
  const roles = new Map()

  const add = (tex, role) => {
    if (!tex) return
    let set = roles.get(tex)
    if (!set) {
      set = new Set()
      roles.set(tex, set)
    }
    set.add(role)
  }

  for (const mat of document.getRoot().listMaterials()) {
    const matName = mat.getName() || ''
    const alphaMode = mat.getAlphaMode?.() || 'OPAQUE'
    const alpha = typeof mat.getAlpha === 'function' ? mat.getAlpha() : 1
    const transmissionExt = mat.getExtension?.('KHR_materials_transmission')
    const transmission =
      typeof transmissionExt?.getTransmissionFactor === 'function'
        ? transmissionExt.getTransmissionFactor()
        : 0
    const isGlass =
      GLASS_MAT_NAME.test(matName) ||
      alphaMode === 'BLEND' ||
      alphaMode === 'MASK' ||
      alpha < 0.98 ||
      transmission > 0.02

    const base = mat.getBaseColorTexture()
    const normal = mat.getNormalTexture()
    const mr = mat.getMetallicRoughnessTexture()
    const occ = mat.getOcclusionTexture()
    const emissive = mat.getEmissiveTexture()

    if (alphaMode === 'BLEND' || alphaMode === 'MASK' || isGlass) {
      add(base, 'baseColorAlpha')
    } else {
      add(base, 'baseColor')
    }
    add(normal, 'normal')
    add(mr, 'metallicRoughness')
    add(occ, 'occlusion')
    add(emissive, 'emissive')

    if (isGlass) {
      add(base, 'glass')
      add(normal, 'glass')
      add(mr, 'glass')
      add(occ, 'glass')
      add(emissive, 'glass')
    }
  }

  // Name heuristics for textures not wired through standard slots (or misnamed).
  for (const texture of document.getRoot().listTextures()) {
    const name = `${texture.getName() || ''} ${texture.getURI?.() || ''}`
    if (DATA_TEX_NAME.test(name)) {
      add(texture, 'namedData')
    }
  }

  return roles
}

/** True when JPEG would destroy alpha or non-color data. */
function mustUseLosslessOrPng(roleSet) {
  if (!roleSet || roleSet.size === 0) return false
  for (const r of roleSet) {
    if (
      r === 'normal' ||
      r === 'metallicRoughness' ||
      r === 'occlusion' ||
      r === 'baseColorAlpha' ||
      r === 'glass' ||
      r === 'namedData'
    ) {
      return true
    }
  }
  return false
}

/**
 * Texture-role-aware resize.
 * When prepareForKtx2: always emit PNG (lossless intermediate for Basis).
 * Otherwise: PNG for opacity/mask/normal/ORM/glass; JPEG only for opaque baseColor.
 */
async function compressTexturesWithSharp(document, { resize, format, quality, prepareForKtx2 }) {
  const [maxW, maxH] = resize
  const roles = collectTextureRoles(document)
  let converted = 0
  let skipped = 0
  let pngForced = 0
  let jpegOk = 0

  for (const texture of document.getRoot().listTextures()) {
    const bytes = texture.getImage()
    if (!bytes?.byteLength) {
      skipped += 1
      continue
    }
    if (isKtx2Bytes(bytes) || texture.getMimeType?.() === 'image/ktx2') {
      skipped += 1
      continue
    }
    try {
      const meta = await sharp(Buffer.from(bytes)).metadata()
      const roleSet = roles.get(texture) || new Set()
      const hasAlphaMeta = Boolean(meta.hasAlpha)
      const protectData = mustUseLosslessOrPng(roleSet) || hasAlphaMeta

      const targetFormat = prepareForKtx2 || protectData ? 'png' : format
      if (targetFormat === 'png' && format !== 'png') pngForced += 1
      else if (targetFormat === 'jpeg' || targetFormat === 'webp') jpegOk += 1

      let pipeline = sharp(Buffer.from(bytes)).rotate()
      if ((meta.width ?? 0) > maxW || (meta.height ?? 0) > maxH) {
        pipeline = pipeline.resize({
          width: maxW,
          height: maxH,
          fit: 'inside',
          withoutEnlargement: true,
          kernel: protectData ? sharp.kernel.lanczos3 : sharp.kernel.mitchell,
        })
      }

      let out
      if (targetFormat === 'png') {
        out = await pipeline.png({ compressionLevel: prepareForKtx2 ? 4 : 8 }).toBuffer()
        texture.setMimeType('image/png')
      } else if (targetFormat === 'webp') {
        out = await pipeline.webp({ quality, alphaQuality: protectData ? 100 : quality }).toBuffer()
        texture.setMimeType('image/webp')
      } else {
        out = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer()
        texture.setMimeType('image/jpeg')
      }
      texture.setImage(out)
      converted += 1
    } catch (err) {
      skipped += 1
      console.warn(`  texture skip (${texture.getName() || 'unnamed'}): ${err.message}`)
    }
  }
  console.log(
    `  textures: resized ${converted}, skipped ${skipped}, png ${pngForced}, color-lossy ${jpegOk}${prepareForKtx2 ? ' (KTX2 prep)' : ''}`,
  )
}

function prefersUastc(roleSet) {
  if (!roleSet || roleSet.size === 0) return true
  for (const r of roleSet) {
    if (
      r === 'normal' ||
      r === 'metallicRoughness' ||
      r === 'occlusion' ||
      r === 'baseColorAlpha' ||
      r === 'glass' ||
      r === 'namedData'
    ) {
      return true
    }
  }
  return false
}

function isNormalRole(roleSet) {
  return roleSet?.has('normal') || roleSet?.has('namedData')
}

async function decodeRgbaMultipleOf4(buffer) {
  const input = Buffer.from(buffer)
  const meta = await sharp(input).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  const nw = Math.max(4, Math.floor(w / 4) * 4)
  const nh = Math.max(4, Math.floor(h / 4) * 4)
  let pipeline = sharp(input).rotate().ensureAlpha()
  if (nw !== w || nh !== h) {
    pipeline = pipeline.resize(nw, nh, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
  }
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })
  return {
    width: info.width,
    height: info.height,
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  }
}

/**
 * Encode textures to KTX2 / Basis Universal.
 * ETC1S for opaque color; UASTC for normals, ORM, alpha, glass.
 */
async function encodeTexturesToKtx2(document, { etc1sQuality, uastcLevel }) {
  const encodeToKTX2 = await loadKtx2Encoder()
  const roles = collectTextureRoles(document)
  let etc1s = 0
  let uastc = 0
  let skipped = 0
  let failed = 0

  document.createExtension(KHRTextureBasisu).setRequired(true)

  const imageDecoder = async (buf) => decodeRgbaMultipleOf4(buf)
  const textures = document.getRoot().listTextures()
  const total = textures.length

  for (let i = 0; i < textures.length; i++) {
    const texture = textures[i]
    const bytes = texture.getImage()
    if (!bytes?.byteLength) {
      skipped += 1
      continue
    }
    if (isKtx2Bytes(bytes) || texture.getMimeType?.() === 'image/ktx2') {
      skipped += 1
      continue
    }

    const roleSet = roles.get(texture) || new Set()
    const useUastc = prefersUastc(roleSet)
    const isNormal = isNormalRole(roleSet)
    const isColor =
      roleSet.has('baseColor') || roleSet.has('emissive') || roleSet.has('baseColorAlpha')

    const label = texture.getName() || `tex-${i}`
    process.stdout.write(`  ktx2 [${i + 1}/${total}] ${label} (${useUastc ? 'UASTC' : 'ETC1S'})… `)

    try {
      const encoded = await encodeToKTX2(new Uint8Array(bytes), {
        isKTX2File: true,
        generateMipmap: true,
        isUASTC: useUastc,
        isYFlip: false,
        isNormalMap: isNormal && !roleSet.has('metallicRoughness'),
        isPerceptual: isColor && !isNormal,
        isSetKTX2SRGBTransferFunc: isColor && !isNormal,
        qualityLevel: useUastc ? undefined : etc1sQuality,
        compressionLevel: useUastc ? undefined : 2,
        uastcLDRQualityLevel: useUastc ? uastcLevel : undefined,
        needSupercompression: useUastc,
        enableRDO: false,
        imageDecoder,
      })
      texture.setImage(encoded)
      texture.setMimeType('image/ktx2')
      if (useUastc) uastc += 1
      else etc1s += 1
      console.log(`${(encoded.byteLength / 1024).toFixed(0)} KiB`)
    } catch (err) {
      failed += 1
      console.log(`FAIL ${err.message}`)
      console.warn(`  keeping raster for ${label}`)
    }
  }

  console.log(
    `  ktx2 done: ETC1S ${etc1s}, UASTC ${uastc}, skipped ${skipped}, failed ${failed}`,
  )
  return { etc1s, uastc, skipped, failed }
}

async function buildVariant(io, sourcePath, sourceHash, outDir, key, variant, opts) {
  console.log(`\n→ Building ${key}${opts.ktx2 ? ' (KTX2)' : ''}…`)
  const document = await io.read(sourcePath)

  const keepLightmapUvs = document
    .getRoot()
    .listMeshes()
    .some((mesh) => mesh.listPrimitives().some((prim) => Boolean(prim.getAttribute('TEXCOORD_1'))))

  const transforms = [
    weld(),
    dedup(),
    prune({ keepAttributes: keepLightmapUvs }),
    resample({ tolerance: variant.resampleTolerance }),
  ]

  if (variant.simplifyRatio != null) {
    await MeshoptSimplifier.ready
    transforms.push(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: variant.simplifyRatio,
        error: variant.simplifyError,
      }),
    )
  }

  transforms.push(prune({ keepAttributes: keepLightmapUvs }))
  await document.transform(...transforms)

  // Explicit sharp path — avoids glTF Transform textureCompress buffer-view corruption
  // observed on this architectural asset set.
  await compressTexturesWithSharp(document, {
    resize: variant.resize,
    format: variant.format,
    quality: variant.quality,
    prepareForKtx2: opts.ktx2,
  })

  let ktx2Stats = null
  if (opts.ktx2) {
    ktx2Stats = await encodeTexturesToKtx2(document, {
      etc1sQuality: variant.ktx2Etc1sQuality,
      uastcLevel: variant.ktx2UastcLevel,
    })
    if (ktx2Stats.failed > 0) {
      throw new Error(
        `KTX2 encoding failed for ${ktx2Stats.failed} texture(s); refusing a mixed raster/KTX2 release.`,
      )
    }
  }

  if (variant.quantize) {
    await document.transform(
      quantize({
        quantizePosition: 14,
        quantizeNormal: 10,
        quantizeTexcoord: 12,
      }),
    )
  }

  // Post-simplify / post-quantize: remeld equal verts then drop zero-area tris.
  await document.transform(weld(), prune({ keepAttributes: keepLightmapUvs }))
  const degenerates = removeDegenerateTriangles(document)
  await document.transform(prune({ keepAttributes: keepLightmapUvs }))
  if (degenerates.removed > 0) {
    console.log(
      `  removed ${degenerates.removed} degenerate tris (kept ${degenerates.kept})`,
    )
  } else {
    console.log('  degenerate cleanup: 0 removed')
  }

  const matsBeforeMerge = countMaterials(document)
  const mergedMats = mergeMaterialsBySignature(document)
  if (mergedMats > 0) {
    // Material-only dedup — never dedup meshes here; shared materials would
    // collapse separate node instances and delete animated/static duplicates.
    await document.transform(
      dedup({ propertyTypes: [PropertyType.MATERIAL, PropertyType.TEXTURE] }),
      prune({ keepAttributes: keepLightmapUvs }),
    )
  }
  const matsAfterMerge = countMaterials(document)
  if (mergedMats > 0) {
    console.log(
      `  materials: merged ${mergedMats} duplicates (${matsBeforeMerge} → ${matsAfterMerge})`,
    )
  }

  const outPath = join(outDir, variant.file)
  const tmpPath = join(outDir, `${variant.file}.tmp.glb`)
  await io.write(tmpPath, document)

  const verifyIo = await createGltfIO()
  const written = await verifyIo.read(tmpPath)
  const textureCheck = await validateTextureImages(written)
  if (textureCheck.bad > 0 && textureCheck.ok === 0) {
    throw new Error(
      `Texture validation failed for ${variant.file}: ${textureCheck.bad}/${textureCheck.total} undecodable.`,
    )
  }
  if (textureCheck.bad > 0) {
    console.warn(
      `  WARN: ${textureCheck.bad}/${textureCheck.total} textures not decodable (kept anyway).`,
    )
  } else {
    console.log(
      `  textures OK (${textureCheck.ok}/${textureCheck.total}${textureCheck.ktx2 ? `, ${textureCheck.ktx2} KTX2` : ''})`,
    )
  }

  // Acceptance: KTX2 path should produce KHR_texture_basisu in the written GLB.
  if (opts.ktx2 && textureCheck.ktx2 === 0 && textureCheck.total > 0) {
    throw new Error('KTX2 requested but no image/ktx2 textures were found after write.')
  }
  const usedExtensions = written
    .getRoot()
    .listExtensionsUsed()
    .map((ext) => ext.extensionName)
  const hasBasisu = usedExtensions.includes('KHR_texture_basisu')
  if (opts.ktx2 && textureCheck.ktx2 > 0 && !hasBasisu) {
    throw new Error('KTX2 images are present but KHR_texture_basisu is missing from extensionsUsed.')
  } else if (hasBasisu) {
    console.log('  extension: KHR_texture_basisu')
  }

  try {
    await unlink(outPath)
  } catch {
    // first write
  }
  await rename(tmpPath, outPath)

  const spatialMeta = computeSpatialMeta(document)
  const spatialPath = join(outDir, 'spatial-meta.json')
  await writeFile(spatialPath, JSON.stringify(spatialMeta, null, 2))
  console.log(`  spatial-meta.json · band ${spatialMeta.bandHeight}m · cell ${spatialMeta.cellSize.join('×')}`)

  const size = (await readFile(outPath)).length
  const tris = countTriangles(document)
  const workload = expandedWorkload(document)
  const textures = countTextures(document)
  const textureBytes = estimateTextureBytes(document)
  const outHash = await sha256File(outPath)

  const report = {
    variant: key,
    tool: {
      script: 'building-viewer/scripts/optimize-building-model.mjs',
      basedOn: 'automotive-studio/scripts/optimize-model.mjs',
      gltfTransform: '4.4.2',
      meshoptimizer: '1.2.0 (MeshoptSimplifier)',
      sharp: '0.35.3',
      ktx2: opts.ktx2,
      ktx2Encoder: opts.ktx2 ? `ktx2-encoder ${KTX2_ENCODER_VERSION} (Basis Universal WASM)` : null,
      note: opts.ktx2
        ? 'KTX2/Basis: ETC1S for opaque color, UASTC+mips for normals/ORM/alpha/glass.'
        : 'Texture-role-aware: PNG for alpha/normal/ORM/glass; JPEG only for opaque baseColor.',
    },
    source: { path: sourcePath, sha256: sourceHash },
    output: {
      path: outPath,
      sha256: outHash,
      bytes: size,
      miB: Number((size / (1024 * 1024)).toFixed(2)),
      triangles: tris,
      storedTriangles: tris,
      expandedTriangles: workload.expandedTriangles,
      primitiveDraws: workload.primitiveDraws,
      meshNodes: workload.meshNodes,
      textures,
      textureEmbeddedBytes: textureBytes,
      textureEmbeddedMiB: Number((textureBytes / (1024 * 1024)).toFixed(2)),
      ktx2Textures: textureCheck.ktx2,
      extensionsUsed: usedExtensions,
    },
    ktx2Stats,
    settings: { ...variant, ktx2: opts.ktx2 },
    createdAt: new Date().toISOString(),
  }

  await writeFile(join(outDir, `report-${key}.json`), JSON.stringify(report, null, 2))
  console.log(
    `  wrote ${variant.file} — ${tris.toLocaleString()} tris · ${report.output.miB} MiB · ${textures} textures` +
      (textureCheck.ktx2 ? ` · ${textureCheck.ktx2} KTX2` : ''),
  )
  return report
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.input || !args.out) {
    console.error('Required: --input <glb> --out <dir>')
    process.exit(1)
  }
  try {
    await access(args.input)
  } catch {
    console.error(`Source GLB not found: ${args.input}`)
    process.exit(1)
  }

  const keys = args.variant === 'all' ? Object.keys(VARIANTS) : [args.variant]
  for (const key of keys) {
    if (!VARIANTS[key]) {
      console.error(`Unknown variant: ${key}`)
      process.exit(1)
    }
  }
  if (args.ktx2) await loadKtx2Encoder()

  await mkdir(args.out, { recursive: true })
  const sourceHash = await sha256File(args.input)
  const sourceBytes = (await readFile(args.input)).length
  const sourceIo = await createGltfIO()
  const sourceDoc = await sourceIo.read(args.input)
  const sourceReport = {
    path: args.input,
    sha256: sourceHash,
    bytes: sourceBytes,
    miB: Number((sourceBytes / (1024 * 1024)).toFixed(2)),
    triangles: countTriangles(sourceDoc),
    storedTriangles: countTriangles(sourceDoc),
    ...expandedWorkload(sourceDoc),
    textures: countTextures(sourceDoc),
    textureEmbeddedMiB: Number((estimateTextureBytes(sourceDoc) / (1024 * 1024)).toFixed(2)),
  }

  console.log(`Source: ${args.input}`)
  console.log(
    `  ${sourceReport.miB} MiB · ${sourceReport.triangles.toLocaleString()} tris · ${sourceReport.textures} textures`,
  )
  console.log(`  KTX2: ${args.ktx2 ? 'on (ETC1S color / UASTC data + mipmaps)' : 'off'}`)
  console.log('NOTE: source file is never overwritten.')

  await MeshoptSimplifier.ready
  const io = await createGltfIO({ encoder: true })

  const variants = { ...VARIANTS }
  if (!args.simplifyQuest) {
    variants.quest = { ...variants.quest, simplifyRatio: null, simplifyError: 0 }
  }

  const reports = []
  for (const key of keys) {
    reports.push(
      await buildVariant(io, args.input, sourceHash, args.out, key, variants[key], {
        ktx2: args.ktx2,
      }),
    )
  }

  const comparison = {
    original: sourceReport,
    variants: Object.fromEntries(reports.map((r) => [r.variant, r.output])),
  }

  await writeFile(join(args.out, 'optimize-summary.json'), JSON.stringify({
    name: args.name,
    source: sourceReport,
    variants: reports,
    comparison,
    createdAt: new Date().toISOString(),
  }, null, 2))

  // Human-readable comparison
  const lines = [
    'ORIGINAL',
    `File:       ${sourceReport.miB} MB`,
    `Triangles:  ${sourceReport.triangles.toLocaleString()}`,
    `Textures:   ${sourceReport.textures}`,
    `Texture est: ${sourceReport.textureEmbeddedMiB} MB`,
  ]
  for (const r of reports) {
    lines.push('')
    lines.push(r.variant.toUpperCase())
    lines.push(`File:       ${r.output.miB} MB`)
    lines.push(`Triangles:  ${r.output.triangles.toLocaleString()}`)
    lines.push(`Textures:   ${r.output.textures}`)
    lines.push(`Texture est: ${r.output.textureEmbeddedMiB} MB`)
  }
  await writeFile(join(args.out, 'optimize-report.txt'), lines.join('\n') + '\n')
  console.log('\n' + lines.join('\n'))

  // Instancing opportunity scan (read-only) on the WEB output when present.
  try {
    const webOut = reports.find((r) => r.variant === 'web')
    if (webOut?.output?.path) {
      const { spawnSync } = await import('node:child_process')
      const scanScript = resolve(__dirname, 'scan-instancing.mjs')
      const scanOut = join(args.out, 'instancing-scan.json')
      console.log('\nScanning for repeating primitives…')
      const scanResult = spawnSync(process.execPath, [scanScript, '--input', webOut.output.path, '--out', scanOut], {
        stdio: 'inherit',
      })
      if (scanResult.status !== 0) {
        throw new Error(`Instancing scan failed with exit code ${scanResult.status ?? 'unknown'}`)
      }
    }
  } catch (err) {
    console.warn('Instancing scan skipped:', err)
  }

  console.log('\nDone. Reports in', args.out)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
