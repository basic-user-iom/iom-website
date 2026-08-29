/**
 * Build or verify the exact production-to-preprocessed Ground Floor ownership
 * migration used by the disabled owner-local package candidate.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { access, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const SITE_ROOT = resolve(VIEWER_ROOT, '..')
const EVIDENCE_ROOT = resolve(VIEWER_ROOT, 'tmp', 'fire-hose-ownership-candidate')
const OWNER_NAME = 'Ground Floor._anim1'
const ROLE_PREFIX = 'fire-safety-'
const OUTPUT = resolve(EVIDENCE_ROOT, 'source-ownership-migration-v1.json')
const REPORT = resolve(EVIDENCE_ROOT, 'candidate-report.json')
const WHOLE_LAYER_CONTRACT = resolve(VIEWER_ROOT, 'tmp', 'whole-layer-ownership-v1', 'whole-layer-ownership-contract-v1.json')
const INPUTS = {
  web: {
    production: resolve(SITE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-web.glb'),
    corrected: resolve(EVIDENCE_ROOT, 'model-web-fire-hose-owned.glb'),
  },
  quest: {
    production: resolve(SITE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-quest.glb'),
    corrected: resolve(EVIDENCE_ROOT, 'model-quest-fire-hose-owned.glb'),
  },
}
const EXPECTED_HASHES = {
  web: {
    production: 'b96cf36f64a03d16047e3ff26aa93131481f636c184df80b5c7ea2032e4cb5e8',
    corrected: '6ece94b5c59e91764ee0f7a274a6f6f9f84bb611a145f283310fca66e379e1a7',
  },
  quest: {
    production: '430987ed81842b5a6a3544c401707c82f2edfdc02d16111e70bf6e5245658083',
    corrected: '46b353bd73dd64aba31d546e33cc5c3dab159e950b9e450ba120fec9ff3e9867',
  },
}
const GLB_MAGIC = 0x46546c67
const JSON_CHUNK = 0x4e4f534a
const EPSILON = 2e-5
const EXPECTED_SCOPE = Object.freeze({
  productionGroundOwnedMeshNodes: 143,
  productionGroundOwnedAtomicUnits: 230,
  migratedDetachedFireMeshNodes: 6,
  migratedDetachedFireAtomicUnits: 60,
  correctedGroundOwnedMeshNodes: 149,
  correctedGroundOwnedAtomicUnits: 290,
})

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function parseArgs(argv) {
  const write = argv.includes('--write')
  const check = argv.includes('--check') || !write
  const unknown = argv.slice(2).filter((value) => !['--write', '--check'].includes(value))
  if (unknown.length) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`)
  return { write, check }
}

function parseGlb(bytes, label) {
  assert.equal(bytes.readUInt32LE(0), GLB_MAGIC, `${label}: invalid GLB magic`)
  assert.equal(bytes.readUInt32LE(4), 2, `${label}: invalid GLB version`)
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${label}: stale GLB length`)
  let offset = 12
  let json = null
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset)
    const type = bytes.readUInt32LE(offset + 4)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    assert.equal(data.length, length, `${label}: truncated GLB chunk`)
    if (type === JSON_CHUNK) {
      assert.equal(json, null, `${label}: duplicate JSON chunk`)
      json = JSON.parse(data.toString('utf8').replace(/[\u0000\u0020]+$/u, ''))
    }
    offset += 8 + length
  }
  assert.equal(offset, bytes.length, `${label}: malformed chunk table`)
  assert.ok(json, `${label}: missing JSON chunk`)
  return json
}

function localMatrix(node) {
  if (node.matrix) return new Matrix4().fromArray(node.matrix)
  return new Matrix4().compose(
    new Vector3().fromArray(node.translation || [0, 0, 0]),
    new Quaternion().fromArray(node.rotation || [0, 0, 0, 1]).normalize(),
    new Vector3().fromArray(node.scale || [1, 1, 1]),
  )
}

function parentMap(json) {
  const parents = new Map()
  for (let parent = 0; parent < json.nodes.length; parent += 1) {
    for (const child of json.nodes[parent].children || []) {
      assert.equal(parents.has(child), false, `Node ${child} has multiple parents`)
      parents.set(child, parent)
    }
  }
  return parents
}

function worldMatrices(json, parents) {
  const cache = new Map()
  const resolveWorld = (index) => {
    if (cache.has(index)) return cache.get(index)
    const local = localMatrix(json.nodes[index])
    const parent = parents.get(index)
    const world = parent == null ? local : new Matrix4().multiplyMatrices(resolveWorld(parent), local)
    cache.set(index, world)
    return world
  }
  for (let index = 0; index < json.nodes.length; index += 1) resolveWorld(index)
  return cache
}

function findOwnerIndex(json, label) {
  const matches = json.nodes.map((node, index) => ({ node, index })).filter(({ node }) => node.name === OWNER_NAME)
  assert.equal(matches.length, 1, `${label}: expected one ${OWNER_NAME}`)
  return matches[0].index
}

function ownerPathMap(json, ownerIndex) {
  const result = new Map()
  const visit = (index, path) => {
    result.set(index, path)
    ;(json.nodes[index].children || []).forEach((child, ordinal) => visit(child, `${path}/${ordinal}`))
  }
  ;(json.nodes[ownerIndex].children || []).forEach((child, ordinal) => visit(child, String(ordinal)))
  return result
}

function activeScenePathMap(json, label) {
  const sceneIndex = Number.isInteger(json.scene) ? json.scene : 0
  const scene = json.scenes?.[sceneIndex]
  assert.ok(scene, `${label}: active scene is missing`)
  const result = new Map()
  const visit = (index, path) => {
    assert.equal(result.has(index), false, `${label}: multiply referenced active-scene node ${index}`)
    result.set(index, path)
    ;(json.nodes[index].children || []).forEach((child, ordinal) => visit(child, `${path}/${ordinal}`))
  }
  ;(scene.nodes || []).forEach((index, ordinal) => visit(index, `scene/${sceneIndex}/${ordinal}`))
  return result
}

function fullIndexPath(index, parents) {
  const result = [index]
  let current = index
  while (parents.has(current)) {
    current = parents.get(current)
    result.push(current)
  }
  return result.reverse().join('/')
}

function materialRoles(json, node) {
  if (!Number.isInteger(node.mesh)) return []
  return [...new Set((json.meshes[node.mesh]?.primitives || []).map((primitive) =>
    json.materials?.[primitive.material]?.extras?.iomMaterialRole,
  ).filter((role) => typeof role === 'string'))].sort()
}

function nodeRecord(json, index, ownerPaths, activeScenePaths, parents) {
  const node = json.nodes[index]
  const mesh = json.meshes[node.mesh]
  return {
    nodeIndex: index,
    meshIndex: node.mesh,
    nodeName: node.name || '',
    meshName: mesh?.name || '',
    ownerPath: ownerPaths.get(index) ?? null,
    activeScenePath: activeScenePaths.get(index) ?? null,
    hierarchyIndexPath: fullIndexPath(index, parents),
    materialIndices: [...new Set((mesh?.primitives || []).map((primitive) => primitive.material).filter(Number.isInteger))].sort((a, b) => a - b),
    materialRoles: materialRoles(json, node),
    instanced: Boolean(node.extensions?.EXT_mesh_gpu_instancing),
  }
}

function renderPrimitives(json, node) {
  if (!Number.isInteger(node.mesh)) return []
  return (json.meshes[node.mesh]?.primitives || [])
    .map((primitive, primitiveIndex) => ({ primitive, primitiveIndex }))
    .filter(({ primitive }) => {
      const positionAccessor = primitive.attributes?.POSITION
      return Number.isInteger(positionAccessor) && (json.accessors?.[positionAccessor]?.count || 0) > 0
    })
}

function rawInstanceCount(json, node, label) {
  const attributes = node.extensions?.EXT_mesh_gpu_instancing?.attributes
  if (!attributes) return 1
  const accessorIndices = Object.values(attributes).filter(Number.isInteger)
  assert.ok(accessorIndices.length > 0, `${label}: instancing extension has no attributes`)
  const counts = [...new Set(accessorIndices.map((index) => json.accessors?.[index]?.count))]
  assert.equal(counts.length, 1, `${label}: instancing attribute counts differ`)
  assert.ok(Number.isSafeInteger(counts[0]) && counts[0] > 0, `${label}: invalid instance count`)
  return counts[0]
}

function sourceNodeId(owner, path) {
  return `owner/${encodeURIComponent(owner)}/node/${path}`
}

function sourceUnitId(nodeId, primitiveIndex, instanceIndex) {
  return `${nodeId}/primitive/${primitiveIndex}/instance/${instanceIndex}`
}

function sortedListSha256(values) {
  return sha256(Buffer.from(JSON.stringify([...values].sort((left, right) => left.localeCompare(right)))))
}

function matrixDelta(left, right) {
  let maximum = 0
  for (let index = 0; index < 16; index += 1) maximum = Math.max(maximum, Math.abs(left.elements[index] - right.elements[index]))
  return maximum
}

function normalizedAccessorValue(accessor, index) {
  const value = accessor.getArray()[index]
  if (!accessor.getNormalized()) return value
  const componentType = accessor.getComponentType()
  if (componentType === 5120) return Math.max(-1, value / 127)
  if (componentType === 5121) return value / 255
  if (componentType === 5122) return Math.max(-1, value / 32767)
  if (componentType === 5123) return value / 65535
  return value
}

function instanceLocalMatrices(node) {
  const instancing = node.getExtension('EXT_mesh_gpu_instancing')
  assert.ok(instancing, 'Expected instanced fire-safety node')
  const attributes = instancing.listAttributes()
  assert.ok(attributes.length > 0, 'Instancing extension has no attributes')
  const count = attributes[0].getCount()
  assert.ok(attributes.every((accessor) => accessor.getCount() === count), 'Instancing attribute counts differ')
  const translation = instancing.getAttribute('TRANSLATION')
  const rotation = instancing.getAttribute('ROTATION')
  const scale = instancing.getAttribute('SCALE')
  return Array.from({ length: count }, (_, index) => new Matrix4().compose(
    translation ? new Vector3(
      normalizedAccessorValue(translation, index * 3),
      normalizedAccessorValue(translation, index * 3 + 1),
      normalizedAccessorValue(translation, index * 3 + 2),
    ) : new Vector3(),
    rotation ? new Quaternion(
      normalizedAccessorValue(rotation, index * 4),
      normalizedAccessorValue(rotation, index * 4 + 1),
      normalizedAccessorValue(rotation, index * 4 + 2),
      normalizedAccessorValue(rotation, index * 4 + 3),
    ).normalize() : new Quaternion(),
    scale ? new Vector3(
      normalizedAccessorValue(scale, index * 3),
      normalizedAccessorValue(scale, index * 3 + 1),
      normalizedAccessorValue(scale, index * 3 + 2),
    ) : new Vector3(1, 1, 1),
  ))
}

function decodedFireBatches(document, expectedOwned) {
  const owner = document.getRoot().listNodes().filter((node) => node.getName() === OWNER_NAME)
  assert.equal(owner.length, 1)
  const isOwned = (node) => {
    let current = node
    while (current) {
      if (current === owner[0]) return true
      current = current.getParentNode()
    }
    return false
  }
  const records = []
  for (const node of document.getRoot().listNodes()) {
    const primitive = node.getMesh()?.listPrimitives().find((entry) => {
      const role = entry.getMaterial()?.getExtras()?.iomMaterialRole
      return typeof role === 'string' && role.startsWith(ROLE_PREFIX)
    })
    if (!primitive) continue
    assert.equal(isOwned(node), expectedOwned, 'Decoded fire ownership is wrong')
    const material = primitive.getMaterial()
    const key = `${material.getExtras().iomMaterialRole}|${material.getName()}`
    const nodeWorld = new Matrix4().fromArray(node.getWorldMatrix())
    records.push({
      key,
      nodeWorld,
      instanceWorlds: instanceLocalMatrices(node).map((local) => new Matrix4().multiplyMatrices(nodeWorld, local)),
    })
  }
  records.sort((a, b) => a.key.localeCompare(b.key))
  assert.equal(records.length, 6, 'Expected six decoded fire-safety batches')
  return records
}

async function variantEvidence(io, variant, reportVariant, wholeLayerVariant) {
  const [productionBytes, correctedBytes] = await Promise.all([
    readFile(INPUTS[variant].production),
    readFile(INPUTS[variant].corrected),
  ])
  const productionSha256 = sha256(productionBytes)
  const correctedSha256 = sha256(correctedBytes)
  assert.equal(productionSha256, EXPECTED_HASHES[variant].production, `${variant}: production source pin changed`)
  assert.equal(correctedSha256, EXPECTED_HASHES[variant].corrected, `${variant}: corrected source pin changed`)
  assert.equal(productionSha256, reportVariant.source.sha256, `${variant}: candidate report production pin changed`)
  assert.equal(correctedSha256, reportVariant.candidate.sha256, `${variant}: candidate report corrected pin changed`)

  const production = parseGlb(productionBytes, `${variant} production`)
  const corrected = parseGlb(correctedBytes, `${variant} corrected`)
  assert.equal(production.nodes.length, corrected.nodes.length, `${variant}: node count changed`)
  const productionParents = parentMap(production)
  const correctedParents = parentMap(corrected)
  const productionActiveScenePaths = activeScenePathMap(production, `${variant} production`)
  const correctedActiveScenePaths = activeScenePathMap(corrected, `${variant} corrected`)
  const productionOwnerIndex = findOwnerIndex(production, `${variant} production`)
  const correctedOwnerIndex = findOwnerIndex(corrected, `${variant} corrected`)
  assert.equal(correctedOwnerIndex, productionOwnerIndex, `${variant}: owner node index changed`)
  const productionOwnerPaths = ownerPathMap(production, productionOwnerIndex)
  const correctedOwnerPaths = ownerPathMap(corrected, correctedOwnerIndex)
  const productionOwned = [...productionOwnerPaths.keys()]
    .filter((index) => renderPrimitives(production, production.nodes[index]).length > 0)
    .sort((a, b) => a - b)
  const detachedFire = production.nodes.map((node, index) => ({ node, index })).filter(({ node, index }) =>
    renderPrimitives(production, node).length > 0 &&
    !productionOwnerPaths.has(index) &&
    materialRoles(production, node).some((role) => role.startsWith(ROLE_PREFIX)),
  ).map(({ index }) => index).sort((a, b) => a - b)
  assert.equal(detachedFire.length, EXPECTED_SCOPE.migratedDetachedFireMeshNodes, `${variant}: expected six detached fire-safety mesh nodes`)
  assert.ok(detachedFire.every((index) => correctedOwnerPaths.has(index)), `${variant}: corrected fire batch is not owner-local`)
  const correctedOwned = [...correctedOwnerPaths.keys()]
    .filter((index) => renderPrimitives(corrected, corrected.nodes[index]).length > 0)
    .sort((a, b) => a - b)
  const expectedCorrected = [...new Set([...productionOwned, ...detachedFire])].sort((a, b) => a - b)
  assert.deepEqual(correctedOwned, expectedCorrected, `${variant}: corrected owner mesh-node inventory is not exact`)

  assert.equal(wholeLayerVariant?.source?.sha256, productionSha256, `${variant}: whole-layer contract source pin changed`)
  assert.equal(wholeLayerVariant?.inventory?.atomicUnit, 'mesh-primitive-instance', `${variant}: whole-layer atomic contract changed`)
  assert.equal(
    wholeLayerVariant?.inventory?.identityPolicy,
    'pinned-active-scene-owner-relative-hierarchy-v1',
    `${variant}: whole-layer identity policy changed`,
  )
  const wholeNodesBySourceIndex = new Map((wholeLayerVariant?.inventory?.nodes || []).map((entry) => [entry.sourceNodeIndex, entry]))
  const wholeUnitsById = new Map((wholeLayerVariant?.inventory?.units || []).map((entry) => [entry.id, entry]))
  const wholeGroundUnits = (wholeLayerVariant?.inventory?.units || []).filter((entry) => entry.owner === OWNER_NAME)
  assert.equal(wholeGroundUnits.length, EXPECTED_SCOPE.productionGroundOwnedAtomicUnits, `${variant}: whole-layer Ground Floor atomic inventory changed`)

  const productionWorlds = worldMatrices(production, productionParents)
  const correctedWorlds = worldMatrices(corrected, correctedParents)
  const [decodedProduction, decodedCorrected] = await Promise.all([
    io.read(INPUTS[variant].production),
    io.read(INPUTS[variant].corrected),
  ])
  const beforeBatches = decodedFireBatches(decodedProduction, false)
  const afterBatches = decodedFireBatches(decodedCorrected, true)
  assert.deepEqual(afterBatches.map((entry) => entry.key), beforeBatches.map((entry) => entry.key))
  let maxFireInstanceWorldMatrixDelta = 0
  const fireInstanceEvidence = beforeBatches.map((before, batchIndex) => {
    const after = afterBatches[batchIndex]
    assert.equal(after.instanceWorlds.length, before.instanceWorlds.length)
    const instanceWorldMatrixDeltas = []
    for (let instance = 0; instance < before.instanceWorlds.length; instance += 1) {
      instanceWorldMatrixDeltas.push(matrixDelta(before.instanceWorlds[instance], after.instanceWorlds[instance]))
    }
    const maximum = Math.max(...instanceWorldMatrixDeltas)
    maxFireInstanceWorldMatrixDelta = Math.max(maxFireInstanceWorldMatrixDelta, maximum)
    return {
      key: before.key,
      instances: before.instanceWorlds.length,
      maxInstanceWorldMatrixDelta: maximum,
      instanceWorldMatrixDeltas,
    }
  })
  assert.ok(maxFireInstanceWorldMatrixDelta <= EPSILON, `${variant}: fire instance world drift ${maxFireInstanceWorldMatrixDelta}`)
  assert.equal(reportVariant.maxWorldMatrixDelta, 0, `${variant}: candidate report world delta is not zero`)

  const fireEvidenceByKey = new Map(fireInstanceEvidence.map((entry) => [entry.key, entry]))
  let maxNodeWorldMatrixDelta = 0
  let maxAtomicWorldMatrixDelta = 0
  const nodeMappings = []
  const atomicMappings = []
  const correctedInventoryIds = []
  for (const nodeIndex of expectedCorrected) {
    const migrated = detachedFire.includes(nodeIndex)
    const before = nodeRecord(production, nodeIndex, productionOwnerPaths, productionActiveScenePaths, productionParents)
    const after = nodeRecord(corrected, nodeIndex, correctedOwnerPaths, correctedActiveScenePaths, correctedParents)
    assert.equal(after.meshIndex, before.meshIndex, `${variant}: node ${nodeIndex} mesh changed`)
    assert.deepEqual(after.materialIndices, before.materialIndices, `${variant}: node ${nodeIndex} materials changed`)
    const beforePrimitives = renderPrimitives(production, production.nodes[nodeIndex])
    const afterPrimitives = renderPrimitives(corrected, corrected.nodes[nodeIndex])
    assert.deepEqual(
      afterPrimitives.map((entry) => entry.primitiveIndex),
      beforePrimitives.map((entry) => entry.primitiveIndex),
      `${variant}: node ${nodeIndex} primitive inventory changed`,
    )
    const beforeInstances = rawInstanceCount(production, production.nodes[nodeIndex], `${variant} production node ${nodeIndex}`)
    const afterInstances = rawInstanceCount(corrected, corrected.nodes[nodeIndex], `${variant} corrected node ${nodeIndex}`)
    assert.equal(afterInstances, beforeInstances, `${variant}: node ${nodeIndex} instance count changed`)
    const productionOwnership = migrated ? '__unowned__' : OWNER_NAME
    const productionOwnerPath = migrated ? before.activeScenePath : before.ownerPath
    assert.ok(productionOwnerPath, `${variant}: node ${nodeIndex} lacks a production identity path`)
    assert.ok(after.ownerPath, `${variant}: node ${nodeIndex} lacks a corrected owner path`)
    const computedProductionNodeId = sourceNodeId(productionOwnership, productionOwnerPath)
    const correctedNodeId = sourceNodeId(OWNER_NAME, after.ownerPath)
    const wholeNode = wholeNodesBySourceIndex.get(nodeIndex)
    assert.ok(wholeNode, `${variant}: node ${nodeIndex} is absent from the whole-layer contract`)
    assert.equal(wholeNode.id, computedProductionNodeId, `${variant}: node ${nodeIndex} production identity differs from whole-layer contract`)
    assert.equal(wholeNode.owner, productionOwnership, `${variant}: node ${nodeIndex} production owner differs from whole-layer contract`)
    assert.equal(wholeNode.primitiveCount, beforePrimitives.length, `${variant}: node ${nodeIndex} primitive count differs from whole-layer contract`)
    assert.equal(wholeNode.instanceCount, beforeInstances, `${variant}: node ${nodeIndex} instance count differs from whole-layer contract`)
    const worldDelta = matrixDelta(productionWorlds.get(nodeIndex), correctedWorlds.get(nodeIndex))
    maxNodeWorldMatrixDelta = Math.max(maxNodeWorldMatrixDelta, worldDelta)
    const migration = migrated ? 'reparented-fire-safety-batch' : 'unchanged-ground-owner-unit'
    nodeMappings.push({
      nodeMappingId: `${variant}:source-node:${nodeIndex}`,
      sourceNodeIndex: nodeIndex,
      meshIndex: before.meshIndex,
      nodeName: before.nodeName,
      meshName: before.meshName,
      materialIndices: before.materialIndices,
      materialRoles: before.materialRoles,
      primitiveCount: beforePrimitives.length,
      instanceCount: beforeInstances,
      instanced: before.instanced,
      productionNodeId: wholeNode.id,
      productionOwnership,
      productionOwnerPath,
      productionActiveScenePath: before.activeScenePath,
      productionHierarchyIndexPath: before.hierarchyIndexPath,
      correctedNodeId,
      correctedOwnership: OWNER_NAME,
      correctedOwnerPath: after.ownerPath,
      correctedActiveScenePath: after.activeScenePath,
      correctedHierarchyIndexPath: after.hierarchyIndexPath,
      migration,
      worldMatrixDelta: worldDelta,
    })

    let fireEvidence = null
    if (migrated) {
      assert.equal(beforePrimitives.length, 1, `${variant}: fire node ${nodeIndex} must contain one render primitive`)
      const primitive = beforePrimitives[0].primitive
      const material = production.materials?.[primitive.material]
      const key = `${material?.extras?.iomMaterialRole}|${material?.name || ''}`
      fireEvidence = fireEvidenceByKey.get(key)
      assert.ok(fireEvidence, `${variant}: fire node ${nodeIndex} lacks decoded instance evidence`)
      assert.equal(fireEvidence.instances, beforeInstances, `${variant}: fire node ${nodeIndex} decoded instance count changed`)
    } else {
      assert.equal(beforeInstances, 1, `${variant}: existing Ground Floor node ${nodeIndex} unexpectedly became instanced`)
    }

    for (const { primitive, primitiveIndex } of beforePrimitives) {
      const correctedPrimitive = afterPrimitives.find((entry) => entry.primitiveIndex === primitiveIndex)?.primitive
      assert.ok(correctedPrimitive, `${variant}: corrected primitive ${nodeIndex}/${primitiveIndex} is missing`)
      assert.equal(correctedPrimitive.material, primitive.material, `${variant}: primitive ${nodeIndex}/${primitiveIndex} material changed`)
      for (let instanceIndex = 0; instanceIndex < beforeInstances; instanceIndex += 1) {
        const productionAtomicId = sourceUnitId(wholeNode.id, primitiveIndex, instanceIndex)
        const correctedAtomicId = sourceUnitId(correctedNodeId, primitiveIndex, instanceIndex)
        const wholeUnit = wholeUnitsById.get(productionAtomicId)
        assert.ok(wholeUnit, `${variant}: production atomic id is absent from the whole-layer contract: ${productionAtomicId}`)
        const atomicWorldDelta = migrated ? fireEvidence.instanceWorldMatrixDeltas[instanceIndex] : worldDelta
        maxAtomicWorldMatrixDelta = Math.max(maxAtomicWorldMatrixDelta, atomicWorldDelta)
        atomicMappings.push({
          atomicId: productionAtomicId,
          productionAtomicId,
          correctedAtomicId,
          productionNodeId: wholeNode.id,
          correctedNodeId,
          sourceNodeIndex: nodeIndex,
          meshIndex: before.meshIndex,
          primitiveIndex,
          instanceIndex,
          sourceId: wholeUnit.sourceId,
          mode: wholeUnit.mode,
          elements: wholeUnit.elements,
          triangles: wholeUnit.triangles,
          materialIndex: primitive.material ?? null,
          materialRole: production.materials?.[primitive.material]?.extras?.iomMaterialRole ?? null,
          productionOwnership,
          productionOwnerPath,
          correctedOwnership: OWNER_NAME,
          correctedOwnerPath: after.ownerPath,
          migration,
          instanceWorldMatrixDelta: atomicWorldDelta,
        })
        correctedInventoryIds.push(correctedAtomicId)
      }
    }
  }
  assert.ok(maxNodeWorldMatrixDelta <= EPSILON, `${variant}: node world drift ${maxNodeWorldMatrixDelta}`)
  assert.ok(maxAtomicWorldMatrixDelta <= EPSILON, `${variant}: atomic world drift ${maxAtomicWorldMatrixDelta}`)

  const productionGroundAtomicIds = atomicMappings
    .filter((entry) => entry.migration === 'unchanged-ground-owner-unit')
    .map((entry) => entry.productionAtomicId)
  const migratedFireAtomicIds = atomicMappings
    .filter((entry) => entry.migration === 'reparented-fire-safety-batch')
    .map((entry) => entry.productionAtomicId)
  assert.equal(productionOwned.length, EXPECTED_SCOPE.productionGroundOwnedMeshNodes, `${variant}: production Ground Floor mesh-node count changed`)
  assert.equal(correctedOwned.length, EXPECTED_SCOPE.correctedGroundOwnedMeshNodes, `${variant}: corrected Ground Floor mesh-node count changed`)
  assert.equal(productionGroundAtomicIds.length, EXPECTED_SCOPE.productionGroundOwnedAtomicUnits, `${variant}: production Ground Floor atomic count changed`)
  assert.equal(migratedFireAtomicIds.length, EXPECTED_SCOPE.migratedDetachedFireAtomicUnits, `${variant}: migrated fire atomic count changed`)
  assert.equal(atomicMappings.length, EXPECTED_SCOPE.correctedGroundOwnedAtomicUnits, `${variant}: corrected Ground Floor atomic count changed`)
  assert.deepEqual(
    [...productionGroundAtomicIds].sort(),
    wholeGroundUnits.map((entry) => entry.id).sort(),
    `${variant}: Ground Floor production atomic IDs differ from whole-layer contract`,
  )
  const correctedMappedIds = atomicMappings.map((entry) => entry.correctedAtomicId)
  const missingCorrectedAtomicUnits = correctedInventoryIds.filter((id) => !correctedMappedIds.includes(id)).length
  const extraCorrectedAtomicUnits = correctedMappedIds.filter((id) => !correctedInventoryIds.includes(id)).length

  return {
    production: { path: INPUTS[variant].production, bytes: productionBytes.length, sha256: productionSha256 },
    correctedPackagingInput: { path: INPUTS[variant].corrected, bytes: correctedBytes.length, sha256: correctedSha256 },
    owner: { name: OWNER_NAME, productionNodeIndex: productionOwnerIndex, correctedNodeIndex: correctedOwnerIndex },
    scope: {
      ...EXPECTED_SCOPE,
      nodeMappingCount: nodeMappings.length,
      atomicMappingCount: atomicMappings.length,
    },
    conservation: {
      duplicateProductionNodeIds: nodeMappings.length - new Set(nodeMappings.map((entry) => entry.productionNodeId)).size,
      duplicateCorrectedNodeIds: nodeMappings.length - new Set(nodeMappings.map((entry) => entry.correctedNodeId)).size,
      duplicateAtomicIds: atomicMappings.length - new Set(atomicMappings.map((entry) => entry.productionAtomicId)).size,
      duplicateCorrectedAtomicIds: atomicMappings.length - new Set(atomicMappings.map((entry) => entry.correctedAtomicId)).size,
      missingCorrectedAtomicUnits,
      extraCorrectedAtomicUnits,
    },
    transformEvidence: {
      tolerance: EPSILON,
      maxNodeWorldMatrixDelta,
      maxFireInstanceWorldMatrixDelta,
      maxAtomicWorldMatrixDelta,
      reportMaxWorldMatrixDelta: reportVariant.maxWorldMatrixDelta,
      fireInstanceEvidence,
    },
    wholeLayerCompatibility: {
      atomicUnit: wholeLayerVariant.inventory.atomicUnit,
      identityPolicy: wholeLayerVariant.inventory.identityPolicy,
      productionGroundOwnerUnitIdsSha256: sortedListSha256(productionGroundAtomicIds),
      productionMigratedFireUnitIdsSha256: sortedListSha256(migratedFireAtomicIds),
      productionMappedUnitIdsSha256: sortedListSha256(atomicMappings.map((entry) => entry.productionAtomicId)),
      correctedMappedUnitIdsSha256: sortedListSha256(atomicMappings.map((entry) => entry.correctedAtomicId)),
    },
    nodeMappingsSha256: sha256(Buffer.from(JSON.stringify(nodeMappings))),
    nodeMappings,
    atomicMappingsSha256: sha256(Buffer.from(JSON.stringify(atomicMappings))),
    atomicMappings,
  }
}

async function buildEvidence() {
  const [reportBytes, wholeLayerBytes] = await Promise.all([readFile(REPORT), readFile(WHOLE_LAYER_CONTRACT)])
  const report = JSON.parse(reportBytes)
  const wholeLayer = JSON.parse(wholeLayerBytes)
  assert.equal(report.schema, 'iom-ground-floor-fire-hose-ownership-candidate-v1')
  assert.equal(report.enabled, false)
  assert.equal(report.productionAssetsModified, false)
  assert.equal(report.intendedOwner, OWNER_NAME)
  assert.equal(wholeLayer.schema, 'IOM_WHOLE_LAYER_VISUAL_OWNERSHIP_CONTRACT')
  assert.equal(wholeLayer.version, 1)
  assert.equal(wholeLayer.enabled, false)
  assert.equal(wholeLayer.productionModified, false)
  const io = await createGltfIO()
  const variants = {}
  for (const variant of ['web', 'quest']) {
    variants[variant] = await variantEvidence(io, variant, report.variants[variant], wholeLayer.variants[variant])
  }
  return {
    schema: 'IOM_GROUND_FLOOR_SOURCE_OWNERSHIP_MIGRATION',
    version: 2,
    enabled: false,
    productionModified: false,
    owner: OWNER_NAME,
    atomicUnit: 'mesh-primitive-instance',
    identityPolicy: 'pinned-active-scene-owner-relative-hierarchy-v1',
    scopeDefinition: 'Every production mesh-primitive-instance already below Ground Floor._anim1 plus all 60 primitive-instance units from the six independently proven detached fire-safety mesh batches; unrelated owners and unowned units are excluded.',
    preprocessing: {
      report: { path: REPORT, bytes: reportBytes.length, sha256: sha256(reportBytes), schema: report.schema },
      wholeLayerContract: {
        path: WHOLE_LAYER_CONTRACT,
        bytes: wholeLayerBytes.length,
        sha256: sha256(wholeLayerBytes),
        schema: wholeLayer.schema,
        version: wholeLayer.version,
        readOnlyCompatibilityPin: true,
      },
      correction: report.correction,
      invariants: report.invariants,
    },
    variants,
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const evidence = await buildEvidence()
  const text = `${JSON.stringify(evidence, null, 2)}\n`
  if (args.write) await writeFile(OUTPUT, text)
  if (args.check) {
    await access(OUTPUT)
    assert.equal(await readFile(OUTPUT, 'utf8'), text, 'Ground Floor ownership migration sidecar is missing, stale, or tampered')
  }
  console.log(`PASS Ground Floor ownership migration ${args.write ? 'generated' : 'verified'}: ${OUTPUT}`)
  for (const variant of ['web', 'quest']) {
    const entry = evidence.variants[variant]
    console.log(`  ${variant}: ${entry.scope.nodeMappingCount} node mappings / ${entry.scope.atomicMappingCount} primitive-instance mappings`)
    console.log(`    migrated fire: ${entry.scope.migratedDetachedFireMeshNodes} mesh batches / ${entry.scope.migratedDetachedFireAtomicUnits} primitive-instances`)
    console.log(`    node delta ${entry.transformEvidence.maxNodeWorldMatrixDelta}; atomic delta ${entry.transformEvidence.maxAtomicWorldMatrixDelta}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
