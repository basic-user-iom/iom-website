/**
 * Build a disabled package candidate whose embedded textures carry exact
 * image content-hash metadata consumed by SharedTextureResidencyRegistry.
 *
 * The GLB BIN chunks are preserved byte-for-byte. Only images[*].extras and
 * the JSON chunk/header are rewritten, so geometry, KTX2 payloads, animation,
 * and meshopt data cannot be silently recompressed by this step.
 *
 * Usage:
 *   node scripts/build-shared-texture-release-candidate.mjs [source-index] [output-directory]
 */
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const SOURCE_INDEX = resolve(
  process.argv[2] ?? join(VIEWER_ROOT, 'tmp', 'hlod-pilot-first-floor-coalesced', 'detail-package-index.json'),
)
const OUTPUT_DIR = resolve(
  process.argv[3] ?? join(VIEWER_ROOT, 'tmp', 'hlod-pilot-first-floor-shared-textures'),
)
const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942
const GLB_MAGIC = 0x46546c67
const SHA256 = /^[a-f0-9]{64}$/

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function inside(path, root) {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function parseGlb(bytes, label) {
  if (bytes.byteLength < 20) throw new Error(`${label}: truncated GLB`)
  if (bytes.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${label}: invalid GLB magic`)
  if (bytes.readUInt32LE(4) !== 2) throw new Error(`${label}: only GLB v2 is accepted`)
  if (bytes.readUInt32LE(8) !== bytes.byteLength) throw new Error(`${label}: declared GLB length mismatch`)
  const chunks = []
  let offset = 12
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) throw new Error(`${label}: truncated chunk header`)
    const length = bytes.readUInt32LE(offset)
    const type = bytes.readUInt32LE(offset + 4)
    const start = offset + 8
    const end = start + length
    if (length % 4 || end > bytes.byteLength) throw new Error(`${label}: invalid GLB chunk length`)
    chunks.push({ type, data: bytes.subarray(start, end) })
    offset = end
  }
  if (offset !== bytes.byteLength) throw new Error(`${label}: trailing GLB bytes`)
  const jsonChunks = chunks.filter((chunk) => chunk.type === JSON_CHUNK)
  const binChunks = chunks.filter((chunk) => chunk.type === BIN_CHUNK)
  if (jsonChunks.length !== 1 || chunks[0]?.type !== JSON_CHUNK) {
    throw new Error(`${label}: GLB must contain one leading JSON chunk`)
  }
  if (binChunks.length !== 1) throw new Error(`${label}: GLB must contain one BIN chunk`)
  const jsonText = new TextDecoder('utf-8', { fatal: true })
    .decode(jsonChunks[0].data)
    .replace(/[\u0000\u0020]+$/u, '')
  return { json: JSON.parse(jsonText), chunks, bin: binChunks[0].data }
}

function imageBytes(json, bin, image, label) {
  if (typeof image.uri === 'string') {
    throw new Error(`${label}: external/data image URIs are forbidden in the verified package candidate`)
  }
  const viewIndex = image.bufferView
  const view = json.bufferViews?.[viewIndex]
  if (!Number.isInteger(viewIndex) || !view || view.buffer !== 0) {
    throw new Error(`${label}: image does not reference GLB buffer 0`)
  }
  const start = view.byteOffset ?? 0
  const end = start + view.byteLength
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(view.byteLength) || start < 0 || end > bin.byteLength) {
    throw new Error(`${label}: image bufferView is outside the BIN chunk`)
  }
  return bin.subarray(start, end)
}

function serializeGlb(json, sourceChunks) {
  const rawJson = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonPadding = (4 - (rawJson.byteLength % 4)) % 4
  const jsonData = Buffer.alloc(rawJson.byteLength + jsonPadding, 0x20)
  rawJson.copy(jsonData)
  const chunks = sourceChunks.map((chunk) => chunk.type === JSON_CHUNK ? { type: JSON_CHUNK, data: jsonData } : chunk)
  const totalLength = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.byteLength, 0)
  const result = Buffer.allocUnsafe(totalLength)
  result.writeUInt32LE(GLB_MAGIC, 0)
  result.writeUInt32LE(2, 4)
  result.writeUInt32LE(totalLength, 8)
  let offset = 12
  for (const chunk of chunks) {
    result.writeUInt32LE(chunk.data.byteLength, offset)
    result.writeUInt32LE(chunk.type, offset + 4)
    chunk.data.copy(result, offset + 8)
    offset += 8 + chunk.data.byteLength
  }
  return result
}

function annotateGlb(sourceBytes, label) {
  const parsed = parseGlb(sourceBytes, label)
  const binHashBefore = sha256(parsed.bin)
  let annotatedImages = 0
  const uniqueImages = new Map()
  for (const [index, image] of (parsed.json.images ?? []).entries()) {
    const encoded = imageBytes(parsed.json, parsed.bin, image, `${label}:image[${index}]`)
    const metadata = {
      version: 1,
      contentSha256: sha256(encoded),
      encodedBytes: encoded.byteLength,
    }
    const existing = image.extras?.iomSharedTexture
    if (existing && JSON.stringify(existing) !== JSON.stringify(metadata)) {
      throw new Error(`${label}:image[${index}] has conflicting iomSharedTexture metadata`)
    }
    image.extras = { ...(image.extras ?? {}), iomSharedTexture: metadata }
    uniqueImages.set(metadata.contentSha256, metadata.encodedBytes)
    annotatedImages += 1
  }
  for (const [index, texture] of (parsed.json.textures ?? []).entries()) {
    const source = texture.extensions?.KHR_texture_basisu?.source ?? texture.source
    if (!Number.isInteger(source) || source < 0 || source >= (parsed.json.images?.length ?? 0)) {
      throw new Error(`${label}:texture[${index}] has no valid embedded image source`)
    }
  }
  const output = serializeGlb(parsed.json, parsed.chunks)
  const reparsed = parseGlb(output, `${label}:rewritten`)
  if (sha256(reparsed.bin) !== binHashBefore) throw new Error(`${label}: BIN chunk changed during annotation`)
  return {
    output,
    annotatedImages,
    textureDefinitions: parsed.json.textures?.length ?? 0,
    uniqueImages,
    binSha256: binHashBefore,
  }
}

async function writeAnnotatedRecord(sourceDir, outputDir, record, label) {
  if (!record?.url || typeof record.url !== 'string') throw new Error(`${label}: missing URL`)
  const sourcePath = resolve(sourceDir, record.url)
  const outputPath = resolve(outputDir, record.url)
  if (!inside(sourcePath, sourceDir) || !inside(outputPath, outputDir)) throw new Error(`${label}: URL escapes candidate root`)
  const sourceBytes = await readFile(sourcePath)
  if (!SHA256.test(record.sha256) || sha256(sourceBytes) !== record.sha256) {
    throw new Error(`${label}: source SHA-256 pin mismatch`)
  }
  const annotated = annotateGlb(sourceBytes, label)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, annotated.output)
  const outputSha256 = sha256(annotated.output)
  const next = structuredClone(record)
  next.sha256 = outputSha256
  if (next.metrics) {
    next.metrics.sha256 = outputSha256
    next.metrics.bytes = annotated.output.byteLength
  }
  return {
    record: next,
    evidence: {
      label,
      url: record.url,
      sourceSha256: record.sha256,
      candidateSha256: outputSha256,
      sourceBytes: sourceBytes.byteLength,
      candidateBytes: annotated.output.byteLength,
      annotatedImages: annotated.annotatedImages,
      textureDefinitions: annotated.textureDefinitions,
      imageContentSha256: [...annotated.uniqueImages.keys()].sort(),
      uniqueImages: annotated.uniqueImages.size,
      binSha256: annotated.binSha256,
    },
  }
}

async function verifyAuthoredMetadata(path, expectedImageCount) {
  const io = await createGltfIO()
  const document = await io.read(path)
  const textures = document.getRoot().listTextures()
  if (textures.length !== expectedImageCount) {
    throw new Error(`${path}: glTF reader saw ${textures.length} images, expected ${expectedImageCount}`)
  }
  for (const [index, texture] of textures.entries()) {
    const metadata = texture.getExtras()?.iomSharedTexture
    if (
      !metadata || metadata.version !== 1 || !SHA256.test(metadata.contentSha256) ||
      !Number.isSafeInteger(metadata.encodedBytes) || metadata.encodedBytes <= 0
    ) throw new Error(`${path}: image[${index}] lost shared-texture metadata`)
  }
}

if (!inside(SOURCE_INDEX, resolve(VIEWER_ROOT, 'tmp'))) throw new Error('Source pilot must be below building-viewer/tmp')
if (!inside(OUTPUT_DIR, resolve(VIEWER_ROOT, 'tmp'))) throw new Error('Output candidate must be below building-viewer/tmp')
const sourceDir = dirname(SOURCE_INDEX)
const source = JSON.parse(await readFile(SOURCE_INDEX, 'utf8'))
if (source.enabled !== false || source.contractTarget !== 3) {
  throw new Error('Shared-texture release candidate requires a disabled manifest-v3 pilot')
}

await mkdir(OUTPUT_DIR, { recursive: true })
const candidate = structuredClone(source)
candidate.artifactDirectory = relative(VIEWER_ROOT, OUTPUT_DIR).replaceAll('\\', '/')
candidate.status = 'disabled-shared-texture-gpu-pooling-candidate'
candidate.generatedAt = new Date().toISOString()
const evidence = []

for (const pkg of candidate.packages) {
  for (const variant of ['web', 'quest']) {
    for (const [level, record] of Object.entries(pkg.variants?.[variant] ?? {})) {
      if (!record?.url) continue
      const result = await writeAnnotatedRecord(sourceDir, OUTPUT_DIR, record, `${pkg.id}/${variant}/${level}`)
      pkg.variants[variant][level] = result.record
      evidence.push(result.evidence)
    }
    const dccRecord = pkg.dccSources?.[variant]
    if (dccRecord?.url) {
      const result = await writeAnnotatedRecord(sourceDir, OUTPUT_DIR, dccRecord, `${pkg.id}/${variant}/dcc-source`)
      pkg.dccSources[variant] = result.record
      evidence.push(result.evidence)
    }
  }
}

// Shell candidates keep the always-resident payload outside `packages` so it
// cannot overlap streamed detail ownership. Treat those variants as ordinary
// LOD0 payloads for texture annotation and integrity evidence, and copy them
// into the combined candidate root before any manifest can reference it.
const shellVariants = candidate.shellCompletion?.requiredAlwaysResidentShell?.variants
if (shellVariants) {
  for (const variant of ['web', 'quest']) {
    const record = shellVariants[variant]
    if (!record?.url) throw new Error(`first-floor-shell/${variant}: missing shell variant URL`)
    const result = await writeAnnotatedRecord(
      sourceDir,
      OUTPUT_DIR,
      record,
      `first-floor-shell/${variant}/lod0`,
    )
    shellVariants[variant] = result.record
    evidence.push(result.evidence)
  }
}

const rigSource = resolve(sourceDir, source.rig.url)
const rigOutput = resolve(OUTPUT_DIR, source.rig.url)
if (!inside(rigSource, sourceDir) || !inside(rigOutput, OUTPUT_DIR)) throw new Error('Rig URL escapes candidate root')
await mkdir(dirname(rigOutput), { recursive: true })
await copyFile(rigSource, rigOutput)
if (sha256(await readFile(rigOutput)) !== source.rig.sha256) throw new Error('Rig changed while copying candidate')

for (const variant of ['web', 'quest']) {
  candidate.aggregate[variant].bytes = candidate.packages.reduce(
    (sum, pkg) => sum + (pkg.variants?.[variant]?.lod0?.metrics?.bytes ?? 0),
    0,
  )
}
candidate.sharedTextureResidency = {
  version: 1,
  enabled: true,
  identity: 'exact-embedded-image-sha256',
  compatibility: 'runtime-texture-state-plus-content-hash',
  networkExternalization: false,
  payloadCount: evidence.filter((item) => item.label.endsWith('/lod0')).length,
  annotatedImageDefinitions: evidence
    .filter((item) => item.label.endsWith('/lod0'))
    .reduce((sum, item) => sum + item.annotatedImages, 0),
  textureDefinitions: evidence
    .filter((item) => item.label.endsWith('/lod0'))
    .reduce((sum, item) => sum + item.textureDefinitions, 0),
  proof: 'GLB BIN chunks are byte-identical; glTF-Transform independently reads every authored image extra used by GLTFLoader.',
}

const candidateIndexPath = join(OUTPUT_DIR, 'detail-package-index.json')
await writeFile(candidateIndexPath, `${JSON.stringify(candidate, null, 2)}\n`)
for (const item of evidence.filter((entry) => entry.label.endsWith('/lod0'))) {
  await verifyAuthoredMetadata(resolve(OUTPUT_DIR, item.url), item.annotatedImages)
}
const evidenceDocument = {
  schema: 'IOM_SHARED_TEXTURE_RELEASE_EVIDENCE',
  version: 1,
  enabled: false,
  productionReferenced: false,
  sourceIndex: relative(VIEWER_ROOT, SOURCE_INDEX).replaceAll('\\', '/'),
  candidateIndex: relative(VIEWER_ROOT, candidateIndexPath).replaceAll('\\', '/'),
  candidateIndexSha256: sha256(await readFile(candidateIndexPath)),
  ...candidate.sharedTextureResidency,
  payloads: evidence,
}
await writeFile(join(OUTPUT_DIR, 'shared-texture-release-evidence.json'), `${JSON.stringify(evidenceDocument, null, 2)}\n`)

console.log('Shared-texture release candidate: PASS')
console.log(`  ${relative(VIEWER_ROOT, candidateIndexPath)}`)
console.log(`  payloads=${candidate.sharedTextureResidency.payloadCount}`)
console.log(`  annotated image definitions=${candidate.sharedTextureResidency.annotatedImageDefinitions}`)
console.log(`  texture definitions=${candidate.sharedTextureResidency.textureDefinitions}`)
console.log('  productionReferenced=false; networkExternalization=false')
