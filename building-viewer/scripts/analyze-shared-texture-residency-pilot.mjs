/**
 * Analyze content-hash-safe texture pooling for the disabled first-floor
 * package pilot. This writes sidecar evidence under tmp only; it never rewrites
 * a GLB or a production manifest.
 *
 * Usage:
 *   node scripts/analyze-shared-texture-residency-pilot.mjs
 *   node scripts/analyze-shared-texture-residency-pilot.mjs <detail-package-index.json>
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getTextureColorSpace, listTextureInfo, listTextureSlots } from '@gltf-transform/functions'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const DEFAULT_INDEX = resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-first-floor-coalesced', 'detail-package-index.json')
const INDEX_PATH = resolve(process.argv[2] ?? DEFAULT_INDEX)
const INDEX_DIR = dirname(INDEX_PATH)
const SHA256 = /^[a-f0-9]{64}$/

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]))
}

function signatureHash(value) {
  return sha256(Buffer.from(JSON.stringify(stableJson(value))))
}

function ktx2DecodedRgba8Bytes(image) {
  const identifier = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!image || image.byteLength < 48 || identifier.some((value, index) => image[index] !== value)) return null
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength)
  const width = view.getUint32(20, true)
  const height = Math.max(1, view.getUint32(24, true))
  const depth = Math.max(1, view.getUint32(28, true))
  const layers = Math.max(1, view.getUint32(32, true))
  const faces = Math.max(1, view.getUint32(36, true))
  const levels = Math.max(1, view.getUint32(40, true))
  let bytes = 0
  for (let level = 0; level < levels; level += 1) {
    bytes += Math.max(1, width >> level) * Math.max(1, height >> level) *
      Math.max(1, depth >> level) * layers * faces * 4
  }
  return { bytes, width, height, levels, method: 'ktx2-rgba8-upper-bound' }
}

function compatibilityFor(texture, info) {
  const transform = info.getExtension('KHR_texture_transform')
  const value = {
    texCoord: transform?.getTexCoord?.() ?? info.getTexCoord(),
    wrapS: info.getWrapS(),
    wrapT: info.getWrapT(),
    // glTF sampler defaults normalized to the values GLTFLoader installs.
    magFilter: info.getMagFilter() ?? 9729,
    minFilter: info.getMinFilter() ?? 9987,
    colorSpace: getTextureColorSpace(texture) ?? 'linear',
    offset: transform?.getOffset?.() ?? [0, 0],
    rotation: transform?.getRotation?.() ?? 0,
    scale: transform?.getScale?.() ?? [1, 1],
    flipY: false,
  }
  return { ...value, signatureSha256: signatureHash(value) }
}

function sum(records, key) {
  return records.reduce((total, record) => total + record[key], 0)
}

function pct(saved, baseline) {
  return baseline ? Number((saved / baseline * 100).toFixed(2)) : 0
}

function textureMetrics(selectedPayloads) {
  const copies = selectedPayloads.flatMap((payload) =>
    payload.textures.map((texture) => ({ ...texture, packageId: payload.packageId })))
  const content = new Map()
  const compatible = new Map()
  let compatibilityInstances = 0
  let decodedBaseline = 0
  for (const texture of copies) {
    if (!content.has(texture.contentSha256)) content.set(texture.contentSha256, texture)
    for (const signature of texture.compatibility) {
      compatibilityInstances += 1
      decodedBaseline += texture.decodedRgba8Bytes
      const key = `${texture.contentSha256}:${signature.signatureSha256}`
      if (!compatible.has(key)) compatible.set(key, texture)
    }
  }
  const decodedPooled = [...compatible.values()].reduce(
    (total, texture) => total + texture.decodedRgba8Bytes,
    0,
  )
  const embeddedBytes = sum(copies, 'encodedBytes')
  const uniqueContentBytes = [...content.values()].reduce((total, texture) => total + texture.encodedBytes, 0)
  return {
    payloads: selectedPayloads.length,
    packageIds: selectedPayloads.map((payload) => payload.packageId).sort(),
    textureObjects: copies.length,
    uniqueContentHashes: content.size,
    compatibilityInstances,
    uniqueCompatibleResidencies: compatible.size,
    embeddedBytes,
    uniqueContentBytes,
    duplicatedEmbeddedBytes: embeddedBytes - uniqueContentBytes,
    duplicatedEmbeddedPercent: pct(embeddedBytes - uniqueContentBytes, embeddedBytes),
    projectedDecodedRgba8BaselineBytes: decodedBaseline,
    projectedDecodedRgba8PooledBytes: decodedPooled,
    projectedDecodedRgba8SavingsBytes: decodedBaseline - decodedPooled,
    projectedDecodedRgba8SavingsPercent: pct(decodedBaseline - decodedPooled, decodedBaseline),
    networkDownloadSavingsBytes: 0,
  }
}

function axisMasks(packages, axis, margin) {
  const boundaries = [...new Set(packages.flatMap((pkg) => [
    pkg.bounds.min[axis] - margin,
    pkg.bounds.max[axis] + margin,
  ]))].sort((a, b) => a - b)
  const coordinates = [...boundaries]
  for (let index = 1; index < boundaries.length; index += 1) {
    coordinates.push((boundaries[index - 1] + boundaries[index]) / 2)
  }
  const masks = new Map()
  for (const coordinate of coordinates) {
    let mask = 0n
    packages.forEach((pkg, index) => {
      if (
        coordinate >= pkg.bounds.min[axis] - margin &&
        coordinate <= pkg.bounds.max[axis] + margin
      ) mask |= 1n << BigInt(index)
    })
    masks.set(mask.toString(), mask)
  }
  return [...masks.values()]
}

/** Exact active-set enumeration for axis-aligned owner-local package bounds. */
function activePackageMasks(packages, margin) {
  const xMasks = axisMasks(packages, 0, margin)
  const yMasks = axisMasks(packages, 1, margin)
  const zMasks = axisMasks(packages, 2, margin)
  const masks = new Map()
  for (const x of xMasks) {
    for (const y of yMasks) {
      const xy = x & y
      for (const z of zMasks) {
        const mask = xy & z
        masks.set(mask.toString(), mask)
      }
    }
  }
  return [...masks.values()]
}

const index = JSON.parse(await readFile(INDEX_PATH, 'utf8'))
if (index.enabled !== false || index.contractTarget !== 3) {
  throw new Error('Shared texture analysis is restricted to the disabled manifest-v3 package pilot')
}

const io = await createGltfIO()
const payloads = []
const annotationPlan = {
  schema: 'IOM_SHARED_TEXTURE_EXTRAS_ANNOTATION_PLAN',
  version: 1,
  enabled: false,
  sourceIndex: relative(VIEWER_ROOT, INDEX_PATH).replaceAll('\\', '/'),
  metadataContract: {
    property: 'images[*].extras.iomSharedTexture',
    value: { version: 1, contentSha256: '<sha256 of exact embedded image bytes>', encodedBytes: '<positive integer>' },
    warning: 'Applying this plan changes each GLB SHA-256 and byte count; regenerate pins and rerun full asset validation.',
  },
  payloads: [],
}

for (const variant of ['web', 'quest']) {
  for (const pkg of index.packages) {
    const payload = pkg.variants?.[variant]?.lod0
    if (!payload) continue
    if (!SHA256.test(payload.sha256)) throw new Error(`${pkg.id}:${variant} has no valid payload SHA-256`)
    const path = resolve(INDEX_DIR, payload.url)
    const file = await readFile(path)
    const fileHash = sha256(file)
    if (fileHash !== payload.sha256) throw new Error(`${pkg.id}:${variant} payload SHA-256 is stale`)
    const document = await io.read(path)
    const textureRecords = []
    const annotationTextures = []
    for (const [textureIndex, texture] of document.getRoot().listTextures().entries()) {
      const image = texture.getImage()
      if (!image) continue
      const contentSha256 = sha256(image)
      const decoded = ktx2DecodedRgba8Bytes(image) ?? {
        bytes: image.byteLength * 4,
        width: null,
        height: null,
        levels: null,
        method: 'encoded-bytes-times-four-estimate',
      }
      const infos = listTextureInfo(texture)
      const compatibility = [...new Map(
        (infos.length ? infos : [null]).map((info) => {
          const record = info
            ? compatibilityFor(texture, info)
            : { orphaned: true, signatureSha256: signatureHash({ orphaned: true }) }
          return [record.signatureSha256, record]
        }),
      ).values()].sort((a, b) => a.signatureSha256.localeCompare(b.signatureSha256))
      textureRecords.push({
        textureIndex,
        name: texture.getName(),
        mimeType: texture.getMimeType(),
        contentSha256,
        encodedBytes: image.byteLength,
        decodedRgba8Bytes: decoded.bytes,
        decodedMethod: decoded.method,
        width: decoded.width,
        height: decoded.height,
        levels: decoded.levels,
        slots: listTextureSlots(texture).sort(),
        compatibility,
      })
      annotationTextures.push({
        imageIndex: textureIndex,
        imageName: texture.getName(),
        extrasMerge: { iomSharedTexture: { version: 1, contentSha256, encodedBytes: image.byteLength } },
      })
    }
    payloads.push({
      packageId: pkg.id,
      residency: pkg.residency,
      bounds: pkg.selectionBounds[variant],
      variant,
      url: payload.url,
      payloadSha256: fileHash,
      payloadBytes: file.byteLength,
      textures: textureRecords,
    })
    annotationPlan.payloads.push({
      packageId: pkg.id,
      variant,
      url: payload.url,
      sourcePayloadSha256: fileHash,
      images: annotationTextures,
    })
  }
}

const variants = {}
for (const variant of ['web', 'quest']) {
  const variantPayloads = payloads.filter((payload) => payload.variant === variant)
  variants[variant] = textureMetrics(variantPayloads)
  if (variants[variant].embeddedBytes !== index.aggregate[variant].encodedTextureBytes) {
    throw new Error(
      `${variant} embedded texture total differs from the audited package index ` +
      `(${variants[variant].embeddedBytes} != ${index.aggregate[variant].encodedTextureBytes})`,
    )
  }
}

const persistentIds = new Set(index.packages
  .filter((pkg) => pkg.residency === 'persistent-lossless')
  .map((pkg) => pkg.id))
const envelopes = {}
for (const margin of [1.5, 12, 24]) {
  envelopes[String(margin)] = {}
  for (const variant of ['web', 'quest']) {
    const streamedPackages = index.packages
      .filter((pkg) => pkg.residency === 'streamed')
      .map((pkg) => ({ id: pkg.id, bounds: pkg.selectionBounds[variant] }))
    const masks = activePackageMasks(streamedPackages, margin)
    const byId = new Map(payloads
      .filter((payload) => payload.variant === variant)
      .map((payload) => [payload.packageId, payload]))
    let maxPayloads = null
    let maxDecoded = null
    for (const mask of masks) {
      const activeIds = new Set(persistentIds)
      streamedPackages.forEach((pkg, index) => {
        if ((mask & (1n << BigInt(index))) !== 0n) activeIds.add(pkg.id)
      })
      const metrics = textureMetrics([...activeIds].map((id) => byId.get(id)).filter(Boolean))
      if (
        !maxPayloads ||
        metrics.payloads > maxPayloads.payloads ||
        (metrics.payloads === maxPayloads.payloads &&
          metrics.projectedDecodedRgba8BaselineBytes > maxPayloads.projectedDecodedRgba8BaselineBytes)
      ) maxPayloads = metrics
      if (
        !maxDecoded ||
        metrics.projectedDecodedRgba8BaselineBytes > maxDecoded.projectedDecodedRgba8BaselineBytes
      ) maxDecoded = metrics
    }
    envelopes[String(margin)][variant] = {
      exactDistinctActiveSets: masks.length,
      maxPayloadCountCase: maxPayloads,
      maxDecodedResidencyCase: maxDecoded,
    }
  }
}

const analysis = {
  schema: 'IOM_SHARED_TEXTURE_RESIDENCY_ANALYSIS',
  version: 1,
  enabled: false,
  productionReferenced: false,
  sourceIndex: annotationPlan.sourceIndex,
  sourceIndexSha256: sha256(await readFile(INDEX_PATH)),
  scope: 'all first-floor coalesced LOD0 packages concurrently resident; upper-bound diagnostic',
  assumptions: [
    'Content identity is the SHA-256 of exact embedded image bytes from each verified GLB.',
    'Compatibility separates glTF sampler, UV set, KHR_texture_transform, flipY, and color-space state.',
    'Decoded KTX2 figures are RGBA8 mip-chain upper bounds; actual GPU block-compressed residency is device-dependent.',
    'Pooling changes runtime residency/disposal only. Self-contained package downloads remain byte-for-byte unchanged.',
  ],
  variants,
  ownerLocalEnvelopeCases: envelopes,
  payloads,
}

const analysisPath = join(INDEX_DIR, 'shared-texture-residency-analysis.json')
const annotationPath = join(INDEX_DIR, 'image-extras-annotation-plan.json')
const reportPath = join(INDEX_DIR, 'SHARED_TEXTURE_RESIDENCY_PILOT_REPORT.md')
await writeFile(analysisPath, `${JSON.stringify(analysis, null, 2)}\n`)
await writeFile(annotationPath, `${JSON.stringify(annotationPlan, null, 2)}\n`)
await writeFile(reportPath, `# Shared texture residency pilot\n\n` +
  `Status: **disabled and production-unreferenced**. No GLB or production manifest was modified.\n\n` +
  `| Variant | Payloads | Texture copies | Unique content | Compatible GPU copies before | After pooling | RGBA8 upper-bound saved | Embedded duplication | Network saved |\n` +
  `|---|---:|---:|---:|---:|---:|---:|---:|---:|\n` +
  ['web', 'quest'].map((variant) => {
    const row = variants[variant]
    return `| ${variant} | ${row.payloads} | ${row.textureObjects} | ${row.uniqueContentHashes} | ` +
      `${row.compatibilityInstances} | ${row.uniqueCompatibleResidencies} | ` +
      `${(row.projectedDecodedRgba8SavingsBytes / 1048576).toFixed(2)} MiB (${row.projectedDecodedRgba8SavingsPercent}%) | ` +
      `${(row.duplicatedEmbeddedBytes / 1048576).toFixed(2)} MiB (${row.duplicatedEmbeddedPercent}%) | 0 B |`
  }).join('\n') + `\n\n` +
  `## Owner-local streaming envelopes\n\n` +
  `These are exact distinct active sets for the current axis-aligned package bounds, including equality at threshold planes. The persistent critical package is always included.\n\n` +
  `| LOD0 margin | Variant | Max overlap | Payloads in worst decoded case | Baseline RGBA8 upper bound | Pooled | Saved |\n` +
  `|---:|---|---:|---:|---:|---:|---:|\n` +
  [1.5, 12, 24].flatMap((margin) => ['web', 'quest'].map((variant) => {
    const envelope = envelopes[String(margin)][variant]
    const row = envelope.maxDecodedResidencyCase
    return `| ${margin} m | ${variant} | ${envelope.maxPayloadCountCase.payloads} | ${row.payloads} | ` +
      `${(row.projectedDecodedRgba8BaselineBytes / 1048576).toFixed(2)} MiB | ` +
      `${(row.projectedDecodedRgba8PooledBytes / 1048576).toFixed(2)} MiB | ` +
      `${(row.projectedDecodedRgba8SavingsBytes / 1048576).toFixed(2)} MiB (${row.projectedDecodedRgba8SavingsPercent}%) |`
  })).join('\n') + `\n\n` +
  `The runtime registry can remove repeated GPU Texture objects while multiple packages are resident. It cannot remove bytes embedded in each independently downloadable GLB; external KTX2 files or package-local atlases remain the network/download optimization.\n\n` +
  `Before activation, apply the generated image-extras annotation plan during packaging, regenerate every changed payload SHA-256/byte pin, validate GLTFLoader propagation of image extras on Web and Quest KTX2 paths, and run real-device GPU-memory/transition QA.\n`)

console.log(`Shared texture analysis: PASS`)
console.log(`  ${relative(VIEWER_ROOT, analysisPath)}`)
for (const variant of ['web', 'quest']) {
  const row = variants[variant]
  console.log(
    `  ${variant}: ${(row.projectedDecodedRgba8SavingsBytes / 1048576).toFixed(2)} MiB RGBA8 upper-bound saved; ` +
    `${(row.duplicatedEmbeddedBytes / 1048576).toFixed(2)} MiB embedded duplication remains`,
  )
}
