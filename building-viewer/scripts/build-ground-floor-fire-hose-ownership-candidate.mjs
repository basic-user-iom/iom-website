/**
 * Build disabled Web and Quest ownership-correction candidates for the six
 * fire-hose cabinet material batches detached by the production optimizer.
 *
 * This patches only the GLB JSON hierarchy. The compressed BIN chunk, meshes,
 * materials, textures, accessors, animations, and EXT_mesh_gpu_instancing data
 * remain byte-for-byte unchanged. Outputs are restricted to building-viewer/tmp.
 *
 * Usage:
 *   node scripts/build-ground-floor-fire-hose-ownership-candidate.mjs
 *   node scripts/build-ground-floor-fire-hose-ownership-candidate.mjs --out <tmp-dir>
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Matrix4, Quaternion, Vector3 } from 'three'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const WORKSPACE_ROOT = resolve(VIEWER_ROOT, '..')
const TMP_ROOT = resolve(VIEWER_ROOT, 'tmp')
const DEFAULT_OUT = resolve(TMP_ROOT, 'fire-hose-ownership-candidate')
const DEFAULT_SOURCES = Object.freeze({
  web: resolve(WORKSPACE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-web.glb'),
  quest: resolve(WORKSPACE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-quest.glb'),
})
const OUTPUT_NAMES = Object.freeze({
  web: 'model-web-fire-hose-owned.glb',
  quest: 'model-quest-fire-hose-owned.glb',
})
const OWNER_NAME = 'Ground Floor._anim1'
const ROLE_PREFIX = 'fire-safety-'
const EXPECTED_BATCHES = 6
const EXPECTED_INSTANCES_PER_BATCH = 10
const EXPECTED_MATERIALS = Object.freeze([
  'IOM_FIRE_SAFETY_GLASS__m.glass_white_standart',
  'IOM_FIRE_SAFETY_OPAQUE__RedMain_001.001',
  'IOM_FIRE_SAFETY_OPAQUE__m.metal_chrome',
  'IOM_FIRE_SAFETY_OPAQUE__m.metal_grey',
  'IOM_FIRE_SAFETY_OPAQUE__m.plastic.black.r',
  'IOM_FIRE_SAFETY_OPAQUE__m.plastic.white.r',
])
const JSON_CHUNK_TYPE = 0x4e4f534a
const GLB_MAGIC = 0x46546c67
const MATRIX_EPSILON = 1e-10

function compareText(a, b) {
  return a < b ? -1 : (a > b ? 1 : 0)
}

function parseArgs(argv) {
  const args = { ...DEFAULT_SOURCES, out: DEFAULT_OUT }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--web') args.web = resolve(argv[++index])
    else if (value === '--quest') args.quest = resolve(argv[++index])
    else if (value === '--out') args.out = resolve(argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stableValue(child)]),
    )
  }
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function parseGlb(bytes, label) {
  assert.ok(bytes.length >= 20, `${label}: truncated GLB`)
  assert.equal(bytes.readUInt32LE(0), GLB_MAGIC, `${label}: invalid GLB magic`)
  assert.equal(bytes.readUInt32LE(4), 2, `${label}: only GLB v2 is supported`)
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${label}: declared GLB length is stale`)
  const chunks = []
  let offset = 12
  while (offset < bytes.length) {
    assert.ok(offset + 8 <= bytes.length, `${label}: truncated chunk header`)
    const byteLength = bytes.readUInt32LE(offset)
    const type = bytes.readUInt32LE(offset + 4)
    const end = offset + 8 + byteLength
    assert.ok(end <= bytes.length, `${label}: truncated chunk payload`)
    chunks.push({ type, data: bytes.subarray(offset + 8, end) })
    offset = end
  }
  assert.equal(offset, bytes.length, `${label}: invalid chunk alignment`)
  const jsonChunks = chunks.filter((chunk) => chunk.type === JSON_CHUNK_TYPE)
  assert.equal(jsonChunks.length, 1, `${label}: expected exactly one JSON chunk`)
  const text = jsonChunks[0].data.toString('utf8').replace(/[\u0000\u0020]+$/u, '')
  return { json: JSON.parse(text), chunks }
}

function encodeGlb(json, sourceChunks) {
  const payload = Buffer.from(JSON.stringify(json), 'utf8')
  const padding = (4 - (payload.length % 4)) % 4
  const jsonData = Buffer.alloc(payload.length + padding, 0x20)
  payload.copy(jsonData)
  const chunks = sourceChunks.map((chunk) => (
    chunk.type === JSON_CHUNK_TYPE ? { type: chunk.type, data: jsonData } : chunk
  ))
  const totalLength = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0)
  const output = Buffer.allocUnsafe(totalLength)
  output.writeUInt32LE(GLB_MAGIC, 0)
  output.writeUInt32LE(2, 4)
  output.writeUInt32LE(totalLength, 8)
  let offset = 12
  for (const chunk of chunks) {
    output.writeUInt32LE(chunk.data.length, offset)
    output.writeUInt32LE(chunk.type, offset + 4)
    chunk.data.copy(output, offset + 8)
    offset += 8 + chunk.data.length
  }
  return output
}

function localMatrix(node) {
  if (node.matrix) {
    assert.equal(node.matrix.length, 16, 'Node matrix must contain 16 values')
    return new Matrix4().fromArray(node.matrix)
  }
  const translation = new Vector3().fromArray(node.translation || [0, 0, 0])
  const rotation = new Quaternion().fromArray(node.rotation || [0, 0, 0, 1]).normalize()
  const scale = new Vector3().fromArray(node.scale || [1, 1, 1])
  return new Matrix4().compose(translation, rotation, scale)
}

function parentMap(json) {
  const parents = new Map()
  for (let parent = 0; parent < (json.nodes || []).length; parent += 1) {
    for (const child of json.nodes[parent].children || []) {
      assert.ok(Number.isInteger(child) && json.nodes[child], `Node ${parent} has invalid child ${child}`)
      assert.equal(parents.has(child), false, `Node ${child} has multiple parents`)
      parents.set(child, parent)
    }
  }
  return parents
}

function worldMatrices(json, parents = parentMap(json)) {
  const cache = new Map()
  const active = new Set()
  const resolveWorld = (index) => {
    if (cache.has(index)) return cache.get(index)
    assert.equal(active.has(index), false, `Node hierarchy contains a cycle at ${index}`)
    active.add(index)
    const matrix = localMatrix(json.nodes[index])
    const parent = parents.get(index)
    const world = parent === undefined
      ? matrix
      : new Matrix4().multiplyMatrices(resolveWorld(parent), matrix)
    active.delete(index)
    cache.set(index, world)
    return world
  }
  for (let index = 0; index < (json.nodes || []).length; index += 1) resolveWorld(index)
  return cache
}

function matrixDelta(a, b) {
  let maximum = 0
  for (let index = 0; index < 16; index += 1) {
    maximum = Math.max(maximum, Math.abs(a.elements[index] - b.elements[index]))
  }
  return maximum
}

function cleanMatrixArray(matrix) {
  return matrix.toArray().map((value) => {
    if (Math.abs(value) < 1e-14) return 0
    if (Math.abs(value - 1) < 1e-14) return 1
    if (Math.abs(value + 1) < 1e-14) return -1
    return value
  })
}

function isDescendant(index, ancestor, parents) {
  let current = index
  while (parents.has(current)) {
    current = parents.get(current)
    if (current === ancestor) return true
  }
  return false
}

function materialRole(json, materialIndex) {
  const material = json.materials?.[materialIndex]
  const role = material?.extras?.iomMaterialRole
  return typeof role === 'string' && role.startsWith(ROLE_PREFIX) ? role : null
}

function instanceCount(json, node) {
  const attributes = node.extensions?.EXT_mesh_gpu_instancing?.attributes
  assert.ok(attributes && Object.keys(attributes).length > 0, 'Fire-hose batch is not EXT_mesh_gpu_instancing')
  const counts = Object.entries(attributes).map(([semantic, accessorIndex]) => {
    const accessor = json.accessors?.[accessorIndex]
    assert.ok(accessor, `Missing instancing accessor ${semantic}:${accessorIndex}`)
    return accessor.count
  })
  assert.ok(counts.every((count) => count === counts[0]), 'Instancing attribute counts differ')
  return counts[0]
}

function findOwnership(json, variant) {
  const owners = (json.nodes || [])
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.name === OWNER_NAME)
  assert.equal(owners.length, 1, `${variant}: expected one ${OWNER_NAME} node`)
  const ownerIndex = owners[0].index
  const parents = parentMap(json)
  const batches = []
  for (let nodeIndex = 0; nodeIndex < (json.nodes || []).length; nodeIndex += 1) {
    const node = json.nodes[nodeIndex]
    if (!Number.isInteger(node.mesh)) continue
    const mesh = json.meshes?.[node.mesh]
    assert.ok(mesh, `${variant}: node ${nodeIndex} references missing mesh`)
    const firePrimitives = mesh.primitives
      .map((primitive, primitiveIndex) => ({
        primitive,
        primitiveIndex,
        materialIndex: primitive.material,
        role: materialRole(json, primitive.material),
      }))
      .filter((entry) => entry.role)
    if (!firePrimitives.length) continue
    assert.equal(firePrimitives.length, mesh.primitives.length, `${variant}: mixed fire/non-fire batch ${nodeIndex}`)
    assert.equal(firePrimitives.length, 1, `${variant}: fire batch ${nodeIndex} must contain one primitive`)
    const entry = firePrimitives[0]
    batches.push({
      nodeIndex,
      node,
      meshIndex: node.mesh,
      materialIndex: entry.materialIndex,
      materialName: json.materials[entry.materialIndex].name || '',
      role: entry.role,
      instances: instanceCount(json, node),
      detached: !isDescendant(nodeIndex, ownerIndex, parents),
      parentIndex: parents.get(nodeIndex) ?? null,
    })
  }
  batches.sort((a, b) => compareText(a.materialName, b.materialName))
  assert.equal(batches.length, EXPECTED_BATCHES, `${variant}: expected ${EXPECTED_BATCHES} fire batches`)
  assert.deepEqual(batches.map((batch) => batch.materialName), [...EXPECTED_MATERIALS], `${variant}: fire material inventory changed`)
  assert.ok(batches.every((batch) => batch.instances === EXPECTED_INSTANCES_PER_BATCH), `${variant}: expected ten instances per fire batch`)
  return { ownerIndex, parents, batches }
}

function animationTargets(json) {
  return new Set((json.animations || []).flatMap((animation) => (
    (animation.channels || []).map((channel) => channel.target?.node).filter(Number.isInteger)
  )))
}

function lineage(index, parents) {
  const result = [index]
  let current = index
  while (parents.has(current)) {
    current = parents.get(current)
    result.push(current)
  }
  return result
}

function sceneContainsNode(json, scene, targetIndex) {
  const pending = [...(scene.nodes || [])]
  const visited = new Set()
  while (pending.length) {
    const index = pending.pop()
    if (index === targetIndex) return true
    if (visited.has(index)) continue
    visited.add(index)
    pending.push(...(json.nodes[index]?.children || []))
  }
  return false
}

function assertOnlyHierarchyChanged(source, candidate, ownerIndex, batchIndices) {
  const ignoredTopLevel = new Set(['nodes', 'scenes'])
  for (const key of new Set([...Object.keys(source), ...Object.keys(candidate)])) {
    if (ignoredTopLevel.has(key)) continue
    assert.deepEqual(candidate[key], source[key], `Unexpected top-level mutation: ${key}`)
  }
  assert.equal(candidate.nodes.length, source.nodes.length)
  for (let index = 0; index < source.nodes.length; index += 1) {
    const before = structuredClone(source.nodes[index])
    const after = structuredClone(candidate.nodes[index])
    if (index === ownerIndex) {
      delete before.children
      delete after.children
    }
    if (batchIndices.has(index)) {
      for (const key of ['matrix', 'translation', 'rotation', 'scale']) {
        delete before[key]
        delete after[key]
      }
    }
    assert.deepEqual(after, before, `Unexpected node mutation: ${index}`)
  }
  assert.equal(candidate.scenes?.length || 0, source.scenes?.length || 0)
  for (let index = 0; index < (source.scenes || []).length; index += 1) {
    const before = structuredClone(source.scenes[index])
    const after = structuredClone(candidate.scenes[index])
    delete before.nodes
    delete after.nodes
    assert.deepEqual(after, before, `Unexpected scene mutation: ${index}`)
  }
}

function triangleCount(json, batch) {
  const primitive = json.meshes[batch.meshIndex].primitives[0]
  const accessorIndex = Number.isInteger(primitive.indices)
    ? primitive.indices
    : primitive.attributes?.POSITION
  const count = json.accessors?.[accessorIndex]?.count || 0
  const mode = primitive.mode ?? 4
  const unique = mode === 4 ? Math.floor(count / 3) : (mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0)
  return { unique, expanded: unique * batch.instances }
}

function patchVariant(sourceBytes, variant) {
  const parsed = parseGlb(sourceBytes, variant)
  const source = parsed.json
  const candidate = structuredClone(source)
  const ownership = findOwnership(source, variant)
  assert.ok(ownership.batches.every((batch) => batch.detached), `${variant}: candidate is no longer needed; a fire batch is already owner-local`)
  assert.ok(ownership.batches.every((batch) => batch.parentIndex === null), `${variant}: expected detached batches to be root nodes`)
  const batchIndices = new Set(ownership.batches.map((batch) => batch.nodeIndex))
  const affectedScenes = (source.scenes || [])
    .map((scene, sceneIndex) => ({ scene, sceneIndex }))
    .filter(({ scene }) => [...batchIndices].some((nodeIndex) => sceneContainsNode(source, scene, nodeIndex)))
  assert.ok(affectedScenes.length > 0, `${variant}: detached batches are not reachable from a scene`)
  assert.ok(
    affectedScenes.every(({ scene }) => sceneContainsNode(source, scene, ownership.ownerIndex)),
    `${variant}: an affected scene does not contain the intended owner`,
  )
  const worldsBefore = worldMatrices(source, ownership.parents)
  const ownerWorldInverse = worldsBefore.get(ownership.ownerIndex).clone().invert()
  const targeted = animationTargets(source)
  const movingLineage = new Set([
    ...lineage(ownership.ownerIndex, ownership.parents),
    ...ownership.batches.flatMap((batch) => lineage(batch.nodeIndex, ownership.parents)),
  ])
  const relevantAnimationTargets = [...targeted].filter((index) => movingLineage.has(index))
  assert.deepEqual(relevantAnimationTargets, [], `${variant}: ownership lineage has animation channels and needs sampled DCC review`)

  for (const node of candidate.nodes) {
    if (node.children) node.children = node.children.filter((child) => !batchIndices.has(child))
  }
  for (const scene of candidate.scenes || []) {
    if (scene.nodes) scene.nodes = scene.nodes.filter((nodeIndex) => !batchIndices.has(nodeIndex))
  }
  const owner = candidate.nodes[ownership.ownerIndex]
  owner.children = [...(owner.children || []), ...[...batchIndices].sort((a, b) => a - b)]
  for (const batch of ownership.batches) {
    const node = candidate.nodes[batch.nodeIndex]
    const ownerLocal = new Matrix4().multiplyMatrices(ownerWorldInverse, worldsBefore.get(batch.nodeIndex))
    delete node.translation
    delete node.rotation
    delete node.scale
    node.matrix = cleanMatrixArray(ownerLocal)
  }

  assertOnlyHierarchyChanged(source, candidate, ownership.ownerIndex, batchIndices)
  const afterOwnership = findOwnership(candidate, variant)
  assert.ok(afterOwnership.batches.every((batch) => !batch.detached), `${variant}: reparenting failed`)
  const worldsAfter = worldMatrices(candidate, afterOwnership.parents)
  let maxWorldMatrixDelta = 0
  for (const batch of ownership.batches) {
    maxWorldMatrixDelta = Math.max(
      maxWorldMatrixDelta,
      matrixDelta(worldsBefore.get(batch.nodeIndex), worldsAfter.get(batch.nodeIndex)),
    )
  }
  assert.ok(maxWorldMatrixDelta <= MATRIX_EPSILON, `${variant}: world transform changed by ${maxWorldMatrixDelta}`)

  const outputBytes = encodeGlb(candidate, parsed.chunks)
  const sourceBinaryChunks = parsed.chunks
    .filter((chunk) => chunk.type !== JSON_CHUNK_TYPE)
    .map((chunk) => ({ type: chunk.type, bytes: chunk.data.length, sha256: sha256(chunk.data) }))
  const candidateParsed = parseGlb(outputBytes, `${variant} candidate`)
  const candidateBinaryChunks = candidateParsed.chunks
    .filter((chunk) => chunk.type !== JSON_CHUNK_TYPE)
    .map((chunk) => ({ type: chunk.type, bytes: chunk.data.length, sha256: sha256(chunk.data) }))
  assert.deepEqual(candidateBinaryChunks, sourceBinaryChunks, `${variant}: binary chunk changed`)

  const triangles = ownership.batches.map((batch) => triangleCount(source, batch))
  return {
    outputBytes,
    evidence: {
      source: { bytes: sourceBytes.length, sha256: sha256(sourceBytes) },
      candidate: { bytes: outputBytes.length, sha256: sha256(outputBytes) },
      owner: { name: OWNER_NAME, nodeIndex: ownership.ownerIndex },
      batchCount: ownership.batches.length,
      instancesPerBatch: [...new Set(ownership.batches.map((batch) => batch.instances))][0],
      logicalInstances: ownership.batches.reduce((sum, batch) => sum + batch.instances, 0),
      uniqueTriangles: triangles.reduce((sum, value) => sum + value.unique, 0),
      expandedTriangles: triangles.reduce((sum, value) => sum + value.expanded, 0),
      materials: ownership.batches.map((batch) => ({
        name: batch.materialName,
        role: batch.role,
        nodeIndex: batch.nodeIndex,
        meshIndex: batch.meshIndex,
        instances: batch.instances,
      })),
      maxWorldMatrixDelta,
      animationCount: source.animations?.length || 0,
      relevantAnimationTargets: relevantAnimationTargets.length,
      affectedScenes: affectedScenes.map(({ sceneIndex }) => sceneIndex),
      animationJsonSha256: sha256(Buffer.from(stableStringify(source.animations || []))),
      binaryChunks: sourceBinaryChunks,
      jsonOnlyHierarchyPatch: true,
    },
  }
}

function assertTmpOutput(outputDirectory) {
  const rel = relative(TMP_ROOT, outputDirectory)
  assert.ok(rel && !rel.startsWith('..') && !isAbsolute(rel), `Output must be below ${TMP_ROOT}`)
}

async function main() {
  const args = parseArgs(process.argv)
  assertTmpOutput(args.out)
  await mkdir(args.out, { recursive: true })
  const variants = {}
  for (const variant of ['web', 'quest']) {
    const sourcePath = args[variant]
    const sourceBytes = await readFile(sourcePath)
    const result = patchVariant(sourceBytes, variant)
    const outputPath = resolve(args.out, OUTPUT_NAMES[variant])
    await writeFile(outputPath, result.outputBytes)
    assert.equal(sha256(await readFile(sourcePath)), result.evidence.source.sha256, `${variant}: production source changed during build`)
    variants[variant] = {
      sourcePath,
      outputPath,
      ...result.evidence,
    }
  }
  assert.deepEqual(
    variants.web.materials.map(({ name, role, instances }) => ({ name, role, instances })),
    variants.quest.materials.map(({ name, role, instances }) => ({ name, role, instances })),
    'Web/Quest semantic fire-batch parity changed',
  )
  const report = {
    schema: 'iom-ground-floor-fire-hose-ownership-candidate-v1',
    enabled: false,
    runtimeIntegrated: false,
    productionAssetsModified: false,
    intendedOwner: OWNER_NAME,
    correction: 'Reparent six material-split EXT_mesh_gpu_instancing batches under the Ground Floor owner with ownerInverse * previousWorld local matrices.',
    invariants: {
      compressedBinaryChunksByteIdentical: true,
      materialsMeshesTexturesAccessorsAnimationsUnchanged: true,
      restWorldTransformsPreserved: true,
      currentAnimationLineageChannels: 0,
      webQuestSemanticParity: true,
    },
    variants,
  }
  const reportPath = resolve(args.out, 'candidate-report.json')
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`PASS disabled fire-hose ownership candidate: ${args.out}`)
  for (const variant of ['web', 'quest']) {
    const evidence = variants[variant]
    console.log(`  ${variant}: ${evidence.batchCount} batches / ${evidence.logicalInstances} instances / ${evidence.expandedTriangles.toLocaleString()} expanded triangles`)
    console.log(`    ${evidence.candidate.sha256}  ${OUTPUT_NAMES[variant]}`)
    console.log(`    binary unchanged; max world-matrix delta ${evidence.maxWorldMatrixDelta}`)
  }
  console.log('  enabled=false; runtimeIntegrated=false; production assets unchanged')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
