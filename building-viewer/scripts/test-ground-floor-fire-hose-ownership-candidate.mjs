/**
 * Independent validation for the disabled fire-hose ownership candidates.
 *
 * The builder edits GLB JSON directly; this test loads source and candidate
 * files through glTF-Transform/Meshopt and validates the decoded scene instead.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const WORKSPACE_ROOT = resolve(VIEWER_ROOT, '..')
const CANDIDATE_ROOT = resolve(VIEWER_ROOT, 'tmp', 'fire-hose-ownership-candidate')
const OWNER_NAME = 'Ground Floor._anim1'
const ROLE_PREFIX = 'fire-safety-'
const EXPECTED_BATCHES = 6
const EXPECTED_INSTANCES = 10
const EXPECTED_EXPANDED_TRIANGLES = Object.freeze({ web: 68_640, quest: 31_740 })
const JSON_CHUNK_TYPE = 0x4e4f534a
const MATRIX_EPSILON = 2e-5
const SOURCES = Object.freeze({
  web: resolve(WORKSPACE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-web.glb'),
  quest: resolve(WORKSPACE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-quest.glb'),
})
const CANDIDATES = Object.freeze({
  web: resolve(CANDIDATE_ROOT, 'model-web-fire-hose-owned.glb'),
  quest: resolve(CANDIDATE_ROOT, 'model-quest-fire-hose-owned.glb'),
})

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function parseRawGlb(bytes, label) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${label}: invalid GLB magic`)
  assert.equal(bytes.readUInt32LE(4), 2, `${label}: invalid GLB version`)
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${label}: invalid GLB length`)
  const chunks = []
  let offset = 12
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset)
    const type = bytes.readUInt32LE(offset + 4)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    assert.equal(data.length, length, `${label}: truncated GLB chunk`)
    chunks.push({ type, data })
    offset += 8 + length
  }
  assert.equal(offset, bytes.length, `${label}: malformed chunk table`)
  const jsonChunks = chunks.filter((chunk) => chunk.type === JSON_CHUNK_TYPE)
  assert.equal(jsonChunks.length, 1, `${label}: expected one JSON chunk`)
  const text = jsonChunks[0].data.toString('utf8').replace(/[\u0000\u0020]+$/u, '')
  return {
    json: JSON.parse(text),
    binaryChunks: chunks
      .filter((chunk) => chunk.type !== JSON_CHUNK_TYPE)
      .map((chunk) => ({ type: chunk.type, bytes: chunk.data.length, sha256: sha256(chunk.data) })),
  }
}

function rawHierarchyInvariant(source, candidate, evidence, variant) {
  assert.deepEqual(candidate.binaryChunks, source.binaryChunks, `${variant}: compressed binary chunks changed`)
  const batchIndices = new Set(evidence.materials.map((entry) => entry.nodeIndex))
  const ownerIndex = evidence.owner.nodeIndex
  for (const key of new Set([...Object.keys(source.json), ...Object.keys(candidate.json)])) {
    if (key === 'nodes' || key === 'scenes') continue
    assert.deepEqual(candidate.json[key], source.json[key], `${variant}: ${key} changed`)
  }
  assert.equal(candidate.json.nodes.length, source.json.nodes.length, `${variant}: node count changed`)
  for (let index = 0; index < source.json.nodes.length; index += 1) {
    const before = structuredClone(source.json.nodes[index])
    const after = structuredClone(candidate.json.nodes[index])
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
    assert.deepEqual(after, before, `${variant}: unexpected node ${index} mutation`)
  }
  const expectedOwnerChildren = [
    ...(source.json.nodes[ownerIndex].children || []),
    ...[...batchIndices].sort((a, b) => a - b),
  ]
  assert.deepEqual(candidate.json.nodes[ownerIndex].children, expectedOwnerChildren, `${variant}: owner child list is wrong`)
  for (let sceneIndex = 0; sceneIndex < (source.json.scenes || []).length; sceneIndex += 1) {
    const before = structuredClone(source.json.scenes[sceneIndex])
    const after = structuredClone(candidate.json.scenes[sceneIndex])
    const expectedRoots = (before.nodes || []).filter((index) => !batchIndices.has(index))
    delete before.nodes
    delete after.nodes
    assert.deepEqual(after, before, `${variant}: scene metadata changed`)
    assert.deepEqual(candidate.json.scenes[sceneIndex].nodes || [], expectedRoots, `${variant}: scene roots changed beyond detached batches`)
  }
}

function matrixRecord(matrix) {
  return matrix.toArray().map((value) => Number(value.toPrecision(15)))
}

function matrixDelta(a, b) {
  let maximum = 0
  for (let index = 0; index < 16; index += 1) {
    maximum = Math.max(maximum, Math.abs(a.elements[index] - b.elements[index]))
  }
  return maximum
}

function typedArrayHash(accessor) {
  const array = accessor?.getArray()
  if (!array) return null
  return sha256(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
}

function accessorRecord(accessor) {
  if (!accessor) return null
  return {
    type: accessor.getType(),
    componentType: accessor.getComponentType(),
    normalized: accessor.getNormalized(),
    count: accessor.getCount(),
    arraySha256: typedArrayHash(accessor),
  }
}

function normalizedValue(accessor, index) {
  const value = accessor.getArray()[index]
  if (!accessor.getNormalized()) return value
  const componentType = accessor.getComponentType()
  if (componentType === 5120) return Math.max(-1, value / 127)
  if (componentType === 5121) return value / 255
  if (componentType === 5122) return Math.max(-1, value / 32767)
  if (componentType === 5123) return value / 65535
  return value
}

function instanceLocalMatrices(instancing) {
  assert.ok(instancing, 'Missing EXT_mesh_gpu_instancing extension')
  const attributes = instancing.listAttributes()
  assert.ok(attributes.length > 0, 'EXT_mesh_gpu_instancing has no attributes')
  const count = attributes[0].getCount()
  assert.ok(attributes.every((accessor) => accessor.getCount() === count), 'Instance attribute counts differ')
  const translation = instancing.getAttribute('TRANSLATION')
  const rotation = instancing.getAttribute('ROTATION')
  const scale = instancing.getAttribute('SCALE')
  const matrices = []
  for (let index = 0; index < count; index += 1) {
    const position = translation
      ? new Vector3(
          normalizedValue(translation, index * 3),
          normalizedValue(translation, index * 3 + 1),
          normalizedValue(translation, index * 3 + 2),
        )
      : new Vector3()
    const quaternion = rotation
      ? new Quaternion(
          normalizedValue(rotation, index * 4),
          normalizedValue(rotation, index * 4 + 1),
          normalizedValue(rotation, index * 4 + 2),
          normalizedValue(rotation, index * 4 + 3),
        ).normalize()
      : new Quaternion()
    const size = scale
      ? new Vector3(
          normalizedValue(scale, index * 3),
          normalizedValue(scale, index * 3 + 1),
          normalizedValue(scale, index * 3 + 2),
        )
      : new Vector3(1, 1, 1)
    matrices.push(new Matrix4().compose(position, quaternion, size))
  }
  return matrices
}

function triangleCount(primitive) {
  const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
  const mode = primitive.getMode()
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

function isDescendantOf(node, owner) {
  let current = node.getParentNode()
  while (current) {
    if (current === owner) return true
    current = current.getParentNode()
  }
  return false
}

function nodePath(node) {
  const parts = []
  let current = node
  while (current) {
    parts.push(current.getName() || '(unnamed)')
    current = current.getParentNode()
  }
  return parts.reverse().join('/')
}

function lineage(node) {
  const result = new Set()
  let current = node
  while (current) {
    result.add(current)
    current = current.getParentNode()
  }
  return result
}

function primitiveRecord(primitive) {
  return {
    mode: primitive.getMode(),
    triangles: triangleCount(primitive),
    indices: accessorRecord(primitive.getIndices()),
    attributes: primitive.listSemantics().sort().map((semantic) => ({
      semantic,
      accessor: accessorRecord(primitive.getAttribute(semantic)),
    })),
  }
}

async function decodedAudit(io, path, expectedOwned, variant, label) {
  const document = await io.read(path)
  const root = document.getRoot()
  const owners = root.listNodes().filter((node) => node.getName() === OWNER_NAME)
  assert.equal(owners.length, 1, `${label}: expected one ${OWNER_NAME}`)
  const owner = owners[0]
  const batches = []
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const primitives = mesh.listPrimitives().filter((primitive) => {
      const role = primitive.getMaterial()?.getExtras()?.iomMaterialRole
      return typeof role === 'string' && role.startsWith(ROLE_PREFIX)
    })
    if (!primitives.length) continue
    assert.equal(primitives.length, mesh.listPrimitives().length, `${label}: mixed fire/non-fire mesh`)
    assert.equal(primitives.length, 1, `${label}: fire batch must have one primitive`)
    const primitive = primitives[0]
    const material = primitive.getMaterial()
    const role = material.getExtras().iomMaterialRole
    const key = `${role}|${material.getName()}`
    const instancing = node.getExtension('EXT_mesh_gpu_instancing')
    const locals = instanceLocalMatrices(instancing)
    assert.equal(locals.length, EXPECTED_INSTANCES, `${label}: ${key} instance count changed`)
    const nodeWorld = new Matrix4().fromArray(node.getWorldMatrix())
    const worlds = locals.map((local) => new Matrix4().multiplyMatrices(nodeWorld, local))
    batches.push({
      key,
      role,
      materialName: material.getName(),
      nodeName: node.getName(),
      meshName: mesh.getName(),
      path: nodePath(node),
      underOwner: isDescendantOf(node, owner),
      nodeWorld: matrixRecord(nodeWorld),
      instanceWorlds: worlds.map(matrixRecord),
      instancing: instancing.listSemantics().sort().map((semantic) => ({
        semantic,
        accessor: accessorRecord(instancing.getAttribute(semantic)),
      })),
      primitive: primitiveRecord(primitive),
      expandedTriangles: triangleCount(primitive) * locals.length,
      node,
    })
  }
  batches.sort((a, b) => a.key.localeCompare(b.key))
  assert.equal(batches.length, EXPECTED_BATCHES, `${label}: fire batch count changed`)
  assert.ok(batches.every((batch) => batch.underOwner === expectedOwned), `${label}: ownership state is wrong`)
  const movingNodes = lineage(owner)
  for (const batch of batches) for (const node of lineage(batch.node)) movingNodes.add(node)
  const relevantChannels = root.listAnimations().flatMap((animation) => animation.listChannels())
    .filter((channel) => movingNodes.has(channel.getTargetNode()))
  assert.equal(relevantChannels.length, 0, `${label}: ownership lineage has animation channels`)
  const result = {
    variant,
    animationCount: root.listAnimations().length,
    relevantAnimationChannels: relevantChannels.length,
    ownerRestMatrix: matrixRecord(new Matrix4().fromArray(owner.getWorldMatrix())),
    batches: batches.map(({ node: _node, ...batch }) => batch),
    expandedTriangles: batches.reduce((sum, batch) => sum + batch.expandedTriangles, 0),
  }
  assert.equal(result.expandedTriangles, EXPECTED_EXPANDED_TRIANGLES[variant], `${label}: expanded triangle baseline changed`)
  return result
}

function compareSourceCandidate(source, candidate, variant) {
  assert.equal(candidate.animationCount, source.animationCount, `${variant}: animation count changed`)
  assert.equal(candidate.relevantAnimationChannels, 0, `${variant}: candidate animation lineage is unsafe`)
  assert.deepEqual(candidate.batches.map((batch) => batch.key), source.batches.map((batch) => batch.key))
  let maxNodeWorldDelta = 0
  let maxInstanceWorldDelta = 0
  for (let batchIndex = 0; batchIndex < source.batches.length; batchIndex += 1) {
    const before = source.batches[batchIndex]
    const after = candidate.batches[batchIndex]
    assert.equal(before.key, after.key)
    assert.equal(before.nodeName, after.nodeName)
    assert.equal(before.meshName, after.meshName)
    assert.deepEqual(after.instancing, before.instancing, `${variant}: ${before.key} instancing payload changed`)
    assert.deepEqual(after.primitive, before.primitive, `${variant}: ${before.key} geometry changed`)
    maxNodeWorldDelta = Math.max(
      maxNodeWorldDelta,
      matrixDelta(new Matrix4().fromArray(before.nodeWorld), new Matrix4().fromArray(after.nodeWorld)),
    )
    assert.equal(after.instanceWorlds.length, before.instanceWorlds.length)
    for (let index = 0; index < before.instanceWorlds.length; index += 1) {
      maxInstanceWorldDelta = Math.max(
        maxInstanceWorldDelta,
        matrixDelta(
          new Matrix4().fromArray(before.instanceWorlds[index]),
          new Matrix4().fromArray(after.instanceWorlds[index]),
        ),
      )
    }
  }
  assert.ok(maxNodeWorldDelta <= MATRIX_EPSILON, `${variant}: node world delta ${maxNodeWorldDelta}`)
  assert.ok(maxInstanceWorldDelta <= MATRIX_EPSILON, `${variant}: instance world delta ${maxInstanceWorldDelta}`)
  return { maxNodeWorldDelta, maxInstanceWorldDelta }
}

function compareVariantParity(web, quest) {
  assert.deepEqual(web.batches.map((batch) => batch.key), quest.batches.map((batch) => batch.key), 'Web/Quest semantic batch parity failed')
  let maxInstanceWorldDelta = 0
  for (let batchIndex = 0; batchIndex < web.batches.length; batchIndex += 1) {
    const webBatch = web.batches[batchIndex]
    const questBatch = quest.batches[batchIndex]
    assert.equal(webBatch.instanceWorlds.length, questBatch.instanceWorlds.length)
    assert.deepEqual(
      webBatch.instancing.map((entry) => [entry.semantic, entry.accessor.type, entry.accessor.count]),
      questBatch.instancing.map((entry) => [entry.semantic, entry.accessor.type, entry.accessor.count]),
      `${webBatch.key}: Web/Quest instancing layouts differ`,
    )
    for (let index = 0; index < webBatch.instanceWorlds.length; index += 1) {
      maxInstanceWorldDelta = Math.max(
        maxInstanceWorldDelta,
        matrixDelta(
          new Matrix4().fromArray(webBatch.instanceWorlds[index]),
          new Matrix4().fromArray(questBatch.instanceWorlds[index]),
        ),
      )
    }
  }
  assert.ok(maxInstanceWorldDelta <= MATRIX_EPSILON, `Web/Quest fire-instance transform delta ${maxInstanceWorldDelta}`)
  return { maxInstanceWorldDelta }
}

async function main() {
  const reportPath = resolve(CANDIDATE_ROOT, 'candidate-report.json')
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  assert.equal(report.schema, 'iom-ground-floor-fire-hose-ownership-candidate-v1')
  assert.equal(report.enabled, false)
  assert.equal(report.runtimeIntegrated, false)
  assert.equal(report.productionAssetsModified, false)
  assert.equal(report.intendedOwner, OWNER_NAME)
  const io = await createGltfIO()
  const decodedCandidates = {}
  const results = {}
  for (const variant of ['web', 'quest']) {
    const [sourceBytes, candidateBytes] = await Promise.all([
      readFile(SOURCES[variant]),
      readFile(CANDIDATES[variant]),
    ])
    const evidence = report.variants[variant]
    assert.equal(sha256(sourceBytes), evidence.source.sha256, `${variant}: production hash differs from report`)
    assert.equal(sha256(candidateBytes), evidence.candidate.sha256, `${variant}: candidate hash differs from report`)
    const rawSource = parseRawGlb(sourceBytes, `${variant} source`)
    const rawCandidate = parseRawGlb(candidateBytes, `${variant} candidate`)
    rawHierarchyInvariant(rawSource, rawCandidate, evidence, variant)
    const source = await decodedAudit(io, SOURCES[variant], false, variant, `${variant} source`)
    const candidate = await decodedAudit(io, CANDIDATES[variant], true, variant, `${variant} candidate`)
    results[variant] = compareSourceCandidate(source, candidate, variant)
    decodedCandidates[variant] = candidate
  }
  const parity = compareVariantParity(decodedCandidates.web, decodedCandidates.quest)
  console.log('PASS independent fire-hose ownership candidate validation')
  for (const variant of ['web', 'quest']) {
    console.log(`  ${variant}: 6 batches / 60 instances / ${decodedCandidates[variant].expandedTriangles.toLocaleString()} expanded triangles`)
    console.log(`    node delta ${results[variant].maxNodeWorldDelta}; instance delta ${results[variant].maxInstanceWorldDelta}`)
    console.log('    compressed BIN, materials, meshes, textures, accessors, and animations unchanged')
  }
  console.log(`  Web/Quest instance transform parity delta ${parity.maxInstanceWorldDelta}`)
  console.log('  disabled=true; no routing or production-manifest integration')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
