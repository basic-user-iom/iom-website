import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { createGltfIO } from './gltf-io.mjs'

export const WHOLE_LAYER_OWNERSHIP_SCHEMA = 'IOM_WHOLE_LAYER_VISUAL_OWNERSHIP_CONTRACT'
export const WHOLE_LAYER_CLAIMS_SCHEMA = 'IOM_WHOLE_LAYER_VISUAL_OWNERSHIP_CLAIMS'
export const WHOLE_LAYER_OWNERSHIP_VERSION = 1
export const WHOLE_LAYER_MODEL_ID = 'icm-anim-2025'
export const WHOLE_LAYER_VARIANTS = Object.freeze(['web', 'quest'])
export const WHOLE_LAYER_OWNERS = Object.freeze([
  '1st Floor._anim1',
  '2st Floor._anim1',
  'Ceiling._anim1',
  'Mezzanine._anim1',
  'Ground Floor._anim1',
  '__unowned__',
])
export const WHOLE_LAYER_ANIMATED_TARGETS = Object.freeze([
  '1st Floor._anim1',
  '2st Floor._anim1',
  'Ceiling._anim1',
  'Mezzanine._anim1',
])

const SHA256 = /^[a-f0-9]{64}$/

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right))
}

export function stringListSha256(values) {
  return sha256(JSON.stringify(sorted(values)))
}

function assignmentSha256(values) {
  return sha256(JSON.stringify([...values]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(({ id, owner }) => [id, owner])))
}

function sourceNodeId(owner, ownerRelativePath) {
  return `owner/${encodeURIComponent(owner)}/node/${ownerRelativePath}`
}

function sourceUnitId(nodeId, primitiveIndex, instanceIndex) {
  return `${nodeId}/primitive/${primitiveIndex}/instance/${instanceIndex}`
}

function sourceInstanceId(nodeId, instanceIndex) {
  return `${nodeId}/instance/${instanceIndex}`
}

function nearestOwner(node, ownerNodes) {
  let current = node
  while (current) {
    const owner = ownerNodes.get(current)
    if (owner) return owner
    current = current.getParentNode()
  }
  return '__unowned__'
}

function relativePath(node, ancestor) {
  if (node === ancestor) return '@owner'
  const segments = []
  let current = node
  while (current && current !== ancestor) {
    const parent = current.getParentNode()
    if (!parent) throw new Error(`Node ${node.getName() || '(unnamed)'} is not below ${ancestor.getName()}`)
    const index = parent.listChildren().indexOf(current)
    if (index < 0) throw new Error('Broken node parent/child relationship')
    segments.push(String(index))
    current = parent
  }
  if (current !== ancestor) throw new Error(`Node ${node.getName() || '(unnamed)'} escaped its declared owner`)
  return segments.reverse().join('/')
}

function activeScenePaths(root) {
  const scenes = root.listScenes()
  const activeScene = root.getDefaultScene() ?? scenes[0]
  if (!activeScene) throw new Error('Source GLB has no scene')
  const sceneIndex = scenes.indexOf(activeScene)
  const paths = new Map()
  const visit = (node, path) => {
    if (paths.has(node)) throw new Error(`Active scene contains a multiply referenced node at ${path}`)
    paths.set(node, path)
    node.listChildren().forEach((child, index) => visit(child, `${path}/${index}`))
  }
  activeScene.listChildren().forEach((node, index) => visit(node, `scene/${sceneIndex}/${index}`))
  return { activeScene, sceneIndex, paths }
}

function instanceFacts(node) {
  const extension = node.getExtension('EXT_mesh_gpu_instancing')
  if (!extension) return { count: 1, sourceIds: null }
  const semantics = extension.listSemantics().slice().sort()
  if (!semantics.length) throw new Error(`Instanced node ${node.getName() || '(unnamed)'} has no attributes`)
  const counts = [...new Set(semantics.map((semantic) => extension.getAttribute(semantic)?.getCount()))]
  if (counts.length !== 1 || !Number.isSafeInteger(counts[0]) || counts[0] < 1) {
    throw new Error(`Instanced node ${node.getName() || '(unnamed)'} has inconsistent attribute counts`)
  }
  const rawSourceIds = node.getExtras()?.sourceIds
  const sourceIds = Array.isArray(rawSourceIds) && rawSourceIds.length === counts[0]
    ? rawSourceIds.map((value) => String(value))
    : null
  return { count: counts[0], sourceIds }
}

function primitiveElementCount(primitive) {
  return primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
}

function triangleCount(primitive) {
  const count = primitiveElementCount(primitive)
  switch (primitive.getMode()) {
    case 4: return Math.floor(count / 3)
    case 5:
    case 6: return Math.max(0, count - 2)
    default: return 0
  }
}

function animationInventory(root, nodeIds, nodeIndices) {
  const channels = []
  root.listAnimations().forEach((animation, animationIndex) => {
    animation.listChannels().forEach((channel, channelIndex) => {
      const target = channel.getTargetNode()
      channels.push({
        animationIndex,
        animationName: animation.getName() || `(animation-${animationIndex})`,
        channelIndex,
        targetNodeIndex: target ? nodeIndices.get(target) : null,
        targetNodeName: target?.getName() || null,
        targetNodeId: target ? nodeIds.get(target) ?? null : null,
        targetPath: channel.getTargetPath(),
      })
    })
  })
  channels.sort((left, right) =>
    left.animationIndex - right.animationIndex || left.channelIndex - right.channelIndex)
  const targetNames = sorted(new Set(channels.map((channel) => channel.targetNodeName).filter(Boolean)))
  return {
    clipCount: root.listAnimations().length,
    channelCount: channels.length,
    targetNames,
    targetsSha256: sha256(JSON.stringify(channels.map((channel) => [
      channel.animationIndex,
      channel.animationName,
      channel.channelIndex,
      channel.targetNodeName,
      channel.targetPath,
    ]))),
    channels,
  }
}

function ownerSummary(owner, nodes, instances, units) {
  const ownerNodes = nodes.filter((node) => node.owner === owner)
  const ownerInstances = instances.filter((instance) => instance.owner === owner)
  const ownerUnits = units.filter((unit) => unit.owner === owner)
  return {
    owner,
    animatedTarget: WHOLE_LAYER_ANIMATED_TARGETS.includes(owner),
    renderNodeCount: ownerNodes.length,
    primitiveCount: ownerNodes.reduce((sum, node) => sum + node.primitiveCount, 0),
    logicalInstanceCount: ownerInstances.length,
    renderUnitCount: ownerUnits.length,
    expandedTriangles: ownerUnits.reduce((sum, unit) => sum + unit.triangles, 0),
    rendererDraws: ownerNodes.reduce((sum, node) => sum + node.primitiveCount, 0),
    nodeIdsSha256: stringListSha256(ownerNodes.map((node) => node.id)),
    instanceIdsSha256: stringListSha256(ownerInstances.map((instance) => instance.id)),
    unitIdsSha256: stringListSha256(ownerUnits.map((unit) => unit.id)),
  }
}

function variantDigestPayload(variant) {
  return {
    source: variant.source,
    activeScene: variant.activeScene,
    animation: {
      clipCount: variant.animation.clipCount,
      channelCount: variant.animation.channelCount,
      targetNames: variant.animation.targetNames,
      targetsSha256: variant.animation.targetsSha256,
    },
    inventory: {
      renderNodeCount: variant.inventory.renderNodeCount,
      primitiveCount: variant.inventory.primitiveCount,
      logicalInstanceCount: variant.inventory.logicalInstanceCount,
      renderUnitCount: variant.inventory.renderUnitCount,
      nodeIdsSha256: variant.inventory.nodeIdsSha256,
      instanceIdsSha256: variant.inventory.instanceIdsSha256,
      unitIdsSha256: variant.inventory.unitIdsSha256,
      ownerAssignmentsSha256: variant.inventory.ownerAssignmentsSha256,
    },
    owners: variant.owners,
  }
}

function contractDigestPayload(contract) {
  return {
    schema: contract.schema,
    version: contract.version,
    modelId: contract.modelId,
    scope: contract.scope,
    owners: contract.owners,
    animatedOwnerTargets: contract.animatedOwnerTargets,
    variants: WHOLE_LAYER_VARIANTS.map((variantName) => [
      variantName,
      contract.variants[variantName].coverageDigestSha256,
    ]),
  }
}

export function refreshWholeLayerContractDigests(contract) {
  for (const variantName of WHOLE_LAYER_VARIANTS) {
    const variant = contract.variants[variantName]
    variant.inventory.nodeIdsSha256 = stringListSha256(variant.inventory.nodes.map((node) => node.id))
    variant.inventory.instanceIdsSha256 = stringListSha256(variant.inventory.instances.map((instance) => instance.id))
    variant.inventory.unitIdsSha256 = stringListSha256(variant.inventory.units.map((unit) => unit.id))
    variant.inventory.ownerAssignmentsSha256 = assignmentSha256(variant.inventory.nodes)
    variant.animation.targetsSha256 = sha256(JSON.stringify(variant.animation.channels.map((channel) => [
      channel.animationIndex,
      channel.animationName,
      channel.channelIndex,
      channel.targetNodeName,
      channel.targetPath,
    ])))
    variant.owners = WHOLE_LAYER_OWNERS.map((owner) =>
      ownerSummary(owner, variant.inventory.nodes, variant.inventory.instances, variant.inventory.units))
    variant.coverageDigestSha256 = sha256(JSON.stringify(variantDigestPayload(variant)))
  }
  contract.coverageDigestSha256 = sha256(JSON.stringify(contractDigestPayload(contract)))
  return contract
}

export async function inventoryWholeLayerVariant({ variant, filePath, url }) {
  const bytes = await readFile(filePath)
  const fileStats = await stat(filePath)
  const io = await createGltfIO()
  const document = await io.read(filePath)
  const root = document.getRoot()
  const allNodes = root.listNodes()
  const nodeIndices = new Map(allNodes.map((node, index) => [node, index]))
  const { activeScene, sceneIndex, paths: activePaths } = activeScenePaths(root)

  const ownerNodes = new Map()
  for (const owner of WHOLE_LAYER_OWNERS.filter((name) => name !== '__unowned__')) {
    const matches = allNodes.filter((node) => node.getName() === owner)
    if (matches.length !== 1) throw new Error(`${variant}: expected exactly one owner node named ${owner}, found ${matches.length}`)
    if (!activePaths.has(matches[0])) throw new Error(`${variant}: owner ${owner} is outside the active scene`)
    ownerNodes.set(matches[0], owner)
  }

  const unknownOwners = allNodes.filter((node) => /_anim1$/.test(node.getName() || '') && !ownerNodes.has(node))
  if (unknownOwners.length) {
    throw new Error(`${variant}: unexpected animation owners: ${unknownOwners.map((node) => node.getName()).join(', ')}`)
  }

  const nodes = []
  const instanceRecords = []
  const units = []
  const nodeIds = new Map()
  for (const node of allNodes) {
    if (!activePaths.has(node)) continue
    const mesh = node.getMesh()
    if (!mesh) continue
    const primitives = mesh.listPrimitives()
      .map((primitive, primitiveIndex) => ({ primitive, primitiveIndex }))
      .filter(({ primitive }) => (primitive.getAttribute('POSITION')?.getCount() ?? 0) > 0)
    if (!primitives.length) continue

    const owner = nearestOwner(node, ownerNodes)
    const ownerNode = owner === '__unowned__'
      ? null
      : [...ownerNodes].find(([, name]) => name === owner)?.[0]
    const ownerRelativePath = ownerNode ? relativePath(node, ownerNode) : activePaths.get(node)
    const id = sourceNodeId(owner, ownerRelativePath)
    const instances = instanceFacts(node)
    const nodeInstances = Array.from({ length: instances.count }, (_, instanceIndex) => ({
      id: sourceInstanceId(id, instanceIndex),
      nodeId: id,
      owner,
      instanceIndex,
      sourceId: instances.sourceIds?.[instanceIndex] ?? null,
    }))
    instanceRecords.push(...nodeInstances)
    const nodeUnits = []
    for (const { primitive, primitiveIndex } of primitives) {
      for (let instanceIndex = 0; instanceIndex < instances.count; instanceIndex += 1) {
        const unit = {
          id: sourceUnitId(id, primitiveIndex, instanceIndex),
          instanceId: sourceInstanceId(id, instanceIndex),
          nodeId: id,
          owner,
          primitiveIndex,
          instanceIndex,
          sourceId: instances.sourceIds?.[instanceIndex] ?? null,
          mode: primitive.getMode(),
          elements: primitiveElementCount(primitive),
          triangles: triangleCount(primitive),
        }
        units.push(unit)
        nodeUnits.push(unit)
      }
    }
    const record = {
      id,
      owner,
      ownerRelativePath,
      activeScenePath: activePaths.get(node),
      sourceNodeIndex: nodeIndices.get(node),
      nodeName: node.getName() || null,
      meshName: mesh.getName() || null,
      primitiveCount: primitives.length,
      primitiveIndices: primitives.map(({ primitiveIndex }) => primitiveIndex),
      instanceCount: instances.count,
      sourceIds: instances.sourceIds,
      instanceIdsSha256: stringListSha256(nodeInstances.map((instance) => instance.id)),
      renderUnitCount: nodeUnits.length,
      unitIdsSha256: stringListSha256(nodeUnits.map((unit) => unit.id)),
      expandedTriangles: nodeUnits.reduce((sum, unit) => sum + unit.triangles, 0),
    }
    nodes.push(record)
    nodeIds.set(node, id)
  }
  nodes.sort((left, right) => left.id.localeCompare(right.id))
  instanceRecords.sort((left, right) => left.id.localeCompare(right.id))
  units.sort((left, right) => left.id.localeCompare(right.id))

  const animation = animationInventory(root, nodeIds, nodeIndices)
  const variantContract = {
    variant,
    source: { url, bytes: fileStats.size, sha256: sha256(bytes) },
    activeScene: {
      index: sceneIndex,
      name: activeScene.getName() || null,
      reachableNodeCount: activePaths.size,
      orphanNodeCount: allNodes.length - activePaths.size,
    },
    animation,
    inventory: {
      atomicUnit: 'mesh-primitive-instance',
      identityPolicy: 'pinned-active-scene-owner-relative-hierarchy-v1',
      renderNodeCount: nodes.length,
      primitiveCount: nodes.reduce((sum, node) => sum + node.primitiveCount, 0),
      logicalInstanceCount: instanceRecords.length,
      renderUnitCount: units.length,
      expandedTriangles: units.reduce((sum, unit) => sum + unit.triangles, 0),
      rendererDraws: nodes.reduce((sum, node) => sum + node.primitiveCount, 0),
      nodeIdsSha256: '',
      instanceIdsSha256: '',
      unitIdsSha256: '',
      ownerAssignmentsSha256: '',
      nodes,
      instances: instanceRecords,
      units,
    },
    owners: [],
    coverageDigestSha256: '',
  }
  return variantContract
}

export async function buildWholeLayerOwnershipContract({ modelId, variants }) {
  const contract = {
    schema: WHOLE_LAYER_OWNERSHIP_SCHEMA,
    version: WHOLE_LAYER_OWNERSHIP_VERSION,
    modelId,
    enabled: false,
    scope: 'entire-rendered-layer',
    productionModified: false,
    activationRule: 'Every source primitive-instance in both variants must be claimed exactly once by its nearest animation owner or __unowned__.',
    owners: [...WHOLE_LAYER_OWNERS],
    animatedOwnerTargets: [...WHOLE_LAYER_ANIMATED_TARGETS],
    variants: {},
    coverageDigestSha256: '',
  }
  for (const variant of WHOLE_LAYER_VARIANTS) {
    if (!variants?.[variant]) throw new Error(`Missing ${variant} source configuration`)
    contract.variants[variant] = await inventoryWholeLayerVariant({ variant, ...variants[variant] })
  }
  return refreshWholeLayerContractDigests(contract)
}

function expectedUnitIdsForNode(node) {
  const ids = []
  for (const primitiveIndex of node.primitiveIndices) {
    for (let instanceIndex = 0; instanceIndex < node.instanceCount; instanceIndex += 1) {
      ids.push(sourceUnitId(node.id, primitiveIndex, instanceIndex))
    }
  }
  return ids.sort()
}

function expectedInstanceIdsForNode(node) {
  return Array.from({ length: node.instanceCount }, (_, instanceIndex) =>
    sourceInstanceId(node.id, instanceIndex)).sort()
}

export function validateWholeLayerOwnershipContract(contract) {
  const errors = []
  if (!contract || typeof contract !== 'object') return { valid: false, errors: ['contract must be an object'] }
  if (contract.schema !== WHOLE_LAYER_OWNERSHIP_SCHEMA) errors.push(`schema must equal ${WHOLE_LAYER_OWNERSHIP_SCHEMA}`)
  if (contract.version !== WHOLE_LAYER_OWNERSHIP_VERSION) errors.push(`version must equal ${WHOLE_LAYER_OWNERSHIP_VERSION}`)
  if (contract.modelId !== WHOLE_LAYER_MODEL_ID) errors.push(`modelId must equal ${WHOLE_LAYER_MODEL_ID}`)
  if (contract.enabled !== false) errors.push('contract.enabled must remain false; this evidence is not runtime routing')
  if (JSON.stringify(contract.owners) !== JSON.stringify(WHOLE_LAYER_OWNERS)) errors.push('contract owners differ from v1 owner partition')
  if (JSON.stringify(contract.animatedOwnerTargets) !== JSON.stringify(WHOLE_LAYER_ANIMATED_TARGETS)) {
    errors.push('contract animated owner targets differ from the v1 target list')
  }

  for (const variantName of WHOLE_LAYER_VARIANTS) {
    const variant = contract.variants?.[variantName]
    if (!variant) {
      errors.push(`${variantName}: missing variant contract`)
      continue
    }
    if (!Number.isSafeInteger(variant.source?.bytes) || variant.source.bytes < 1) errors.push(`${variantName}: invalid source byte count`)
    if (!SHA256.test(variant.source?.sha256 || '')) errors.push(`${variantName}: invalid source SHA-256`)
    const nodes = Array.isArray(variant.inventory?.nodes) ? variant.inventory.nodes : []
    const instances = Array.isArray(variant.inventory?.instances) ? variant.inventory.instances : []
    const units = Array.isArray(variant.inventory?.units) ? variant.inventory.units : []
    const nodeMap = new Map()
    for (const node of nodes) {
      if (nodeMap.has(node.id)) errors.push(`${variantName}: duplicate render node ${node.id}`)
      nodeMap.set(node.id, node)
      if (!WHOLE_LAYER_OWNERS.includes(node.owner)) errors.push(`${variantName}: unknown owner ${node.owner}`)
      if (node.id !== sourceNodeId(node.owner, node.ownerRelativePath)) errors.push(`${variantName}: node identity/owner mismatch ${node.id}`)
      const expectedIds = expectedUnitIdsForNode(node)
      const expectedInstances = expectedInstanceIdsForNode(node)
      if (node.primitiveCount !== node.primitiveIndices.length) errors.push(`${variantName}: stale primitive count for ${node.id}`)
      if (node.renderUnitCount !== expectedIds.length) errors.push(`${variantName}: stale unit count for ${node.id}`)
      if (node.unitIdsSha256 !== stringListSha256(expectedIds)) errors.push(`${variantName}: stale node unit digest for ${node.id}`)
      if (node.instanceIdsSha256 !== stringListSha256(expectedInstances)) errors.push(`${variantName}: stale node instance digest for ${node.id}`)
    }
    const instanceMap = new Map()
    for (const instance of instances) {
      if (instanceMap.has(instance.id)) errors.push(`${variantName}: duplicate logical instance ${instance.id}`)
      instanceMap.set(instance.id, instance)
      const node = nodeMap.get(instance.nodeId)
      if (!node) errors.push(`${variantName}: instance references unknown node ${instance.nodeId}`)
      else {
        if (instance.owner !== node.owner) errors.push(`${variantName}: instance owner differs from node owner ${instance.id}`)
        if (instance.instanceIndex < 0 || instance.instanceIndex >= node.instanceCount) errors.push(`${variantName}: instance ordinal is outside its node ${instance.id}`)
        if (instance.id !== sourceInstanceId(node.id, instance.instanceIndex)) errors.push(`${variantName}: stale logical instance identity ${instance.id}`)
      }
    }
    const unitMap = new Map()
    for (const unit of units) {
      if (unitMap.has(unit.id)) errors.push(`${variantName}: duplicate render unit ${unit.id}`)
      unitMap.set(unit.id, unit)
      const node = nodeMap.get(unit.nodeId)
      if (!node) errors.push(`${variantName}: unit references unknown node ${unit.nodeId}`)
      else {
        if (unit.owner !== node.owner) errors.push(`${variantName}: unit owner differs from node owner ${unit.id}`)
        if (!node.primitiveIndices.includes(unit.primitiveIndex) || unit.instanceIndex < 0 || unit.instanceIndex >= node.instanceCount) {
          errors.push(`${variantName}: unit ordinal is outside its node ${unit.id}`)
        }
        if (unit.id !== sourceUnitId(node.id, unit.primitiveIndex, unit.instanceIndex)) {
          errors.push(`${variantName}: stale render unit identity ${unit.id}`)
        }
        if (unit.instanceId !== sourceInstanceId(node.id, unit.instanceIndex) || !instanceMap.has(unit.instanceId)) {
          errors.push(`${variantName}: render unit has stale instance identity ${unit.id}`)
        }
      }
    }
    for (const node of nodes) {
      for (const id of expectedInstanceIdsForNode(node)) {
        if (!instanceMap.has(id)) errors.push(`${variantName}: missing logical instance ${id}`)
      }
      for (const id of expectedUnitIdsForNode(node)) {
        if (!unitMap.has(id)) errors.push(`${variantName}: missing render unit ${id}`)
      }
    }
    const expectedTargets = sorted(WHOLE_LAYER_ANIMATED_TARGETS)
    const channelTargets = sorted(new Set((variant.animation?.channels || [])
      .map((channel) => channel.targetNodeName).filter(Boolean)))
    if (JSON.stringify(variant.animation?.targetNames) !== JSON.stringify(channelTargets)) {
      errors.push(`${variantName}: animation target summary differs from channel targets`)
    }
    if (JSON.stringify(variant.animation?.targetNames) !== JSON.stringify(expectedTargets)) {
      errors.push(`${variantName}: animation target list changed`)
    }
    const expectedNodeDigest = stringListSha256(nodes.map((node) => node.id))
    const expectedInstanceDigest = stringListSha256(instances.map((instance) => instance.id))
    const expectedUnitDigest = stringListSha256(units.map((unit) => unit.id))
    const expectedAssignmentDigest = assignmentSha256(nodes)
    if (variant.inventory.nodeIdsSha256 !== expectedNodeDigest) errors.push(`${variantName}: stale node identity digest`)
    if (variant.inventory.instanceIdsSha256 !== expectedInstanceDigest) errors.push(`${variantName}: stale instance identity digest`)
    if (variant.inventory.unitIdsSha256 !== expectedUnitDigest) errors.push(`${variantName}: stale unit identity digest`)
    if (variant.inventory.ownerAssignmentsSha256 !== expectedAssignmentDigest) errors.push(`${variantName}: stale owner assignment digest`)
    if (variant.inventory.renderNodeCount !== nodes.length) errors.push(`${variantName}: stale render node count`)
    if (variant.inventory.logicalInstanceCount !== instances.length) errors.push(`${variantName}: stale logical instance count`)
    if (variant.inventory.renderUnitCount !== units.length) errors.push(`${variantName}: stale render unit count`)
    const primitiveCount = nodes.reduce((sum, node) => sum + node.primitiveCount, 0)
    const expandedTriangles = units.reduce((sum, unit) => sum + unit.triangles, 0)
    if (variant.inventory.primitiveCount !== primitiveCount) errors.push(`${variantName}: stale primitive count`)
    if (variant.inventory.rendererDraws !== primitiveCount) errors.push(`${variantName}: stale renderer draw count`)
    if (variant.inventory.expandedTriangles !== expandedTriangles) errors.push(`${variantName}: stale expanded triangle count`)
    const expectedOwners = WHOLE_LAYER_OWNERS.map((owner) => ownerSummary(owner, nodes, instances, units))
    if (JSON.stringify(variant.owners) !== JSON.stringify(expectedOwners)) errors.push(`${variantName}: stale owner summaries`)
    const targetDigest = sha256(JSON.stringify((variant.animation?.channels || []).map((channel) => [
      channel.animationIndex,
      channel.animationName,
      channel.channelIndex,
      channel.targetNodeName,
      channel.targetPath,
    ])))
    if (variant.animation?.targetsSha256 !== targetDigest) errors.push(`${variantName}: stale animation target digest`)
    const expectedCoverageDigest = sha256(JSON.stringify(variantDigestPayload(variant)))
    if (variant.coverageDigestSha256 !== expectedCoverageDigest) errors.push(`${variantName}: stale variant coverage digest`)
  }

  const webTargets = contract.variants?.web?.animation?.targetNames
  const questTargets = contract.variants?.quest?.animation?.targetNames
  if (JSON.stringify(webTargets) !== JSON.stringify(questTargets)) errors.push('Web/Quest animation target lists differ')
  const expectedContractDigest = contract.variants?.web && contract.variants?.quest
    ? sha256(JSON.stringify(contractDigestPayload(contract)))
    : null
  if (contract.coverageDigestSha256 !== expectedContractDigest) errors.push('stale whole-layer coverage digest')
  return { valid: errors.length === 0, errors }
}

export async function verifyWholeLayerOwnershipSources(contract, sourceFiles) {
  const errors = []
  for (const variant of WHOLE_LAYER_VARIANTS) {
    const path = sourceFiles?.[variant]
    if (!path) {
      errors.push(`${variant}: no source file supplied for verification`)
      continue
    }
    const bytes = await readFile(path)
    const size = (await stat(path)).size
    if (size !== contract.variants?.[variant]?.source?.bytes) errors.push(`${variant}: source byte count is stale`)
    if (sha256(bytes) !== contract.variants?.[variant]?.source?.sha256) errors.push(`${variant}: source hash is stale`)
  }
  if (errors.some((error) => error.includes('no source file'))) return { valid: false, errors }
  try {
    const observed = await buildWholeLayerOwnershipContract({
      modelId: WHOLE_LAYER_MODEL_ID,
      variants: Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variant) => [variant, {
        filePath: sourceFiles[variant],
        url: contract.variants?.[variant]?.source?.url,
      }])),
    })
    for (const variant of WHOLE_LAYER_VARIANTS) {
      if (observed.variants[variant].coverageDigestSha256 !== contract.variants?.[variant]?.coverageDigestSha256) {
        errors.push(`${variant}: enumerated ownership contract differs from the pinned source`)
      }
    }
    if (observed.coverageDigestSha256 !== contract.coverageDigestSha256) {
      errors.push('whole-layer ownership contract differs from the pinned sources')
    }
  } catch (error) {
    errors.push(`could not rebuild ownership inventory: ${error.message}`)
  }
  return { valid: errors.length === 0, errors }
}

export function createCompleteOwnerClaims(contract) {
  const claims = {
    schema: WHOLE_LAYER_CLAIMS_SCHEMA,
    version: WHOLE_LAYER_OWNERSHIP_VERSION,
    modelId: contract.modelId,
    coverageContractSha256: contract.coverageDigestSha256,
    variants: {},
  }
  for (const variantName of WHOLE_LAYER_VARIANTS) {
    const variant = contract.variants[variantName]
    claims.variants[variantName] = {
      sourceSha256: variant.source.sha256,
      animationTargetsSha256: variant.animation.targetsSha256,
      packages: WHOLE_LAYER_OWNERS.map((owner) => ({
        id: `reference-${variantName}-${owner.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
        owner,
        sourceNodeIds: variant.inventory.nodes.filter((node) => node.owner === owner).map((node) => node.id),
      })),
    }
  }
  return claims
}

export function validateWholeLayerPackageClaims(contract, claims) {
  const errors = []
  const variants = {}
  const contractResult = validateWholeLayerOwnershipContract(contract)
  if (!contractResult.valid) errors.push(...contractResult.errors.map((error) => `contract: ${error}`))
  if (claims?.schema !== WHOLE_LAYER_CLAIMS_SCHEMA) errors.push(`claims.schema must equal ${WHOLE_LAYER_CLAIMS_SCHEMA}`)
  if (claims?.version !== WHOLE_LAYER_OWNERSHIP_VERSION) errors.push(`claims.version must equal ${WHOLE_LAYER_OWNERSHIP_VERSION}`)
  if (claims?.modelId !== contract.modelId) errors.push('claims.modelId does not match contract')
  if (claims?.coverageContractSha256 !== contract.coverageDigestSha256) errors.push('claims coverage contract digest is stale')

  for (const variantName of WHOLE_LAYER_VARIANTS) {
    const source = contract.variants?.[variantName]
    const variantClaims = claims?.variants?.[variantName]
    const expectedUnits = new Map((source?.inventory?.units || []).map((unit) => [unit.id, unit]))
    const sourceNodes = new Map((source?.inventory?.nodes || []).map((node) => [node.id, node]))
    const occurrences = new Map()
    const variantErrors = []
    if (!variantClaims) variantErrors.push('variant claims are missing')
    if (variantClaims?.sourceSha256 !== source?.source?.sha256) variantErrors.push('source SHA-256 is stale')
    if (variantClaims?.animationTargetsSha256 !== source?.animation?.targetsSha256) {
      variantErrors.push('animation target digest is stale')
    }
    const packageIds = new Set()
    for (const [packageIndex, pkg] of (variantClaims?.packages || []).entries()) {
      const path = `packages[${packageIndex}]`
      if (!pkg?.id || packageIds.has(pkg.id)) variantErrors.push(`${path}: package id is missing or duplicated`)
      packageIds.add(pkg?.id)
      if (!WHOLE_LAYER_OWNERS.includes(pkg?.owner)) variantErrors.push(`${path}: unknown owner ${pkg?.owner}`)
      const hasNodes = Array.isArray(pkg?.sourceNodeIds)
      const hasUnits = Array.isArray(pkg?.sourceUnitIds)
      if (hasNodes === hasUnits) {
        variantErrors.push(`${path}: declare exactly one of sourceNodeIds or sourceUnitIds`)
        continue
      }
      const packageUnits = []
      if (hasNodes) {
        const localNodes = new Set()
        for (const nodeId of pkg.sourceNodeIds) {
          if (localNodes.has(nodeId)) variantErrors.push(`${path}: duplicates source node ${nodeId}`)
          localNodes.add(nodeId)
          const node = sourceNodes.get(nodeId)
          if (!node) variantErrors.push(`${path}: unknown source node ${nodeId}`)
          else {
            if (node.owner !== pkg.owner) variantErrors.push(`${path}: wrong owner for ${nodeId}; expected ${node.owner}`)
            packageUnits.push(...expectedUnitIdsForNode(node))
          }
        }
      } else {
        const localUnits = new Set()
        for (const unitId of pkg.sourceUnitIds) {
          if (localUnits.has(unitId)) variantErrors.push(`${path}: duplicates source unit ${unitId}`)
          localUnits.add(unitId)
          const unit = expectedUnits.get(unitId)
          if (!unit) variantErrors.push(`${path}: unknown source unit ${unitId}`)
          else if (unit.owner !== pkg.owner) variantErrors.push(`${path}: wrong owner for ${unitId}; expected ${unit.owner}`)
          packageUnits.push(unitId)
        }
      }
      for (const unitId of packageUnits) {
        const owners = occurrences.get(unitId) || []
        owners.push(pkg.id)
        occurrences.set(unitId, owners)
      }
    }
    const missing = [...expectedUnits.keys()].filter((id) => !occurrences.has(id)).sort()
    const duplicates = [...occurrences].filter(([, packages]) => packages.length !== 1)
      .map(([id, packages]) => ({ id, packages })).sort((left, right) => left.id.localeCompare(right.id))
    if (missing.length) variantErrors.push(`missing ${missing.length} render units`)
    if (duplicates.length) variantErrors.push(`duplicated ${duplicates.length} render units`)
    variants[variantName] = {
      valid: variantErrors.length === 0,
      expectedRenderUnits: expectedUnits.size,
      claimedUniqueRenderUnits: occurrences.size,
      missingCount: missing.length,
      duplicateCount: duplicates.length,
      missingSample: missing.slice(0, 20),
      duplicateSample: duplicates.slice(0, 20),
      errors: variantErrors,
    }
    errors.push(...variantErrors.map((error) => `${variantName}: ${error}`))
  }
  return { valid: errors.length === 0, errors, variants }
}

function nodeIdByOwnerPath(contractVariant, owner, path) {
  return contractVariant.inventory.nodes.find((node) =>
    node.owner === owner && node.ownerRelativePath === path)?.id ?? null
}

export function claimsFromOwnerLocalPilot(contract, index) {
  const owner = index?.owner?.nodeName
  const claims = {
    schema: WHOLE_LAYER_CLAIMS_SCHEMA,
    version: WHOLE_LAYER_OWNERSHIP_VERSION,
    modelId: contract.modelId,
    coverageContractSha256: contract.coverageDigestSha256,
    variants: {},
  }
  for (const variantName of WHOLE_LAYER_VARIANTS) {
    const variant = contract.variants[variantName]
    const packages = []
    for (const pkg of index?.packages || []) {
      const paths = pkg.sourcePaths?.[variantName] || []
      packages.push({
        id: pkg.id,
        owner,
        sourceNodeIds: paths.map((path) => nodeIdByOwnerPath(variant, owner, path) ?? `unresolved/${owner}/${path}`),
      })
    }
    const shell = index?.shellCompletion?.requiredAlwaysResidentShell ?? index?.alwaysResidentShell
    const shellPaths = shell?.sourcePaths?.[variantName] || []
    if (shellPaths.length) {
      packages.push({
        id: shell.id || 'always-resident-shell',
        owner,
        sourceNodeIds: shellPaths.map((path) => nodeIdByOwnerPath(variant, owner, path) ?? `unresolved/${owner}/${path}`),
      })
    }
    claims.variants[variantName] = {
      sourceSha256: variant.source.sha256,
      animationTargetsSha256: variant.animation.targetsSha256,
      packages,
    }
  }
  return claims
}
