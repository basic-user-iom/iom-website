/**
 * Build an exact, disabled ownership/partition plan for the __unowned__ part of
 * icm-anim-2025. This is planning evidence only: no GLBs, manifests, routes, or
 * production assets are changed.
 *
 * The plan uses the whole-layer mesh-primitive-instance identity contract. It
 * separates the existing 4 x 78 chair/table repeat candidate from every other
 * unowned unit, then bins the remainder by world-space cell and material
 * affinity while enforcing Web and Quest planning budgets.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ExtensionProperty, Texture } from '@gltf-transform/core'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'
import {
  buildWholeLayerOwnershipContract,
  stringListSha256,
  validateWholeLayerOwnershipContract,
  verifyWholeLayerOwnershipSources,
} from './lib/whole-layer-ownership-contract.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const SITE_ROOT = resolve(VIEWER_ROOT, '..')
const MODEL_ROOT = resolve(SITE_ROOT, 'public', 'models', 'icm-anim-2025')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v1')
const DEFAULT_REPEAT_ROOT = resolve(VIEWER_ROOT, 'tmp', 'repeat-geometry-release-candidate')
const DEFAULT_FIRE_SIDECAR = resolve(VIEWER_ROOT, 'tmp', 'fire-hose-ownership-candidate', 'source-ownership-migration-v1.json')
const OWNER = '__unowned__'
const VARIANTS = Object.freeze(['web', 'quest'])
const SHA256 = /^[a-f0-9]{64}$/
const GRID = Object.freeze({ cellSizeXz: 24, elevationBand: 4, origin: [0, 0, 0] })
const BUDGETS = Object.freeze({
  web: Object.freeze({
    maxExpandedTriangles: 300_000,
    maxProjectedDraws: 64,
    maxAtomicUnits: 192,
    maxDecodedDependencyBytes: 32 * 1024 * 1024,
    requiredEmittedGlbBytes: 12 * 1024 * 1024,
  }),
  quest: Object.freeze({
    maxExpandedTriangles: 140_000,
    maxProjectedDraws: 64,
    maxAtomicUnits: 192,
    maxDecodedDependencyBytes: 16 * 1024 * 1024,
    requiredEmittedGlbBytes: 8 * 1024 * 1024,
  }),
})

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, repeatRoot: DEFAULT_REPEAT_ROOT, fireSidecar: DEFAULT_FIRE_SIDECAR }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--out') args.out = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--repeat-root') args.repeatRoot = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--fire-sidecar') args.fireSidecar = resolve(VIEWER_ROOT, argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function sha256File(path) {
  return sha256(await readFile(path))
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]))
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    if (Object.is(value, -0)) return 0
    return Number(value.toPrecision(9))
  }
  return value
}

function stableSha256(value) {
  return sha256(JSON.stringify(stableValue(value)))
}

function projectPath(path) {
  const value = relative(VIEWER_ROOT, path).replaceAll('\\', '/')
  return value.startsWith('.') ? value : `./${value}`
}

function emptyBounds() {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
}

function expandBounds(target, source) {
  for (let axis = 0; axis < 3; axis += 1) {
    target.min[axis] = Math.min(target.min[axis], source.min[axis])
    target.max[axis] = Math.max(target.max[axis], source.max[axis])
  }
  return target
}

function finiteBounds(bounds) {
  return bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite)
}

function canonicalBounds(bounds) {
  assert.ok(finiteBounds(bounds), 'Bounds are not finite')
  return stableValue(bounds)
}

function boundsCenter(bounds) {
  return bounds.min.map((value, axis) => (value + bounds.max[axis]) * 0.5)
}

function boundsContain(container, child, tolerance = 1e-5) {
  return [0, 1, 2].every((axis) =>
    container.min[axis] <= child.min[axis] + tolerance &&
    container.max[axis] >= child.max[axis] - tolerance)
}

function normalizedComponent(accessor, index) {
  const value = accessor.getArray()[index]
  if (!accessor.getNormalized()) return value
  switch (accessor.getComponentType()) {
    case 5120: return Math.max(-1, value / 127)
    case 5121: return value / 255
    case 5122: return Math.max(-1, value / 32767)
    case 5123: return value / 65535
    default: return value
  }
}

function instanceMatrices(node) {
  const extension = node.getExtension('EXT_mesh_gpu_instancing')
  if (!extension) return [new Matrix4()]
  const translation = extension.getAttribute('TRANSLATION')
  const rotation = extension.getAttribute('ROTATION')
  const scale = extension.getAttribute('SCALE')
  const count = translation?.getCount() ?? rotation?.getCount() ?? scale?.getCount() ?? 0
  assert.ok(Number.isSafeInteger(count) && count > 0, 'Instanced node has no valid instance count')
  const output = []
  for (let index = 0; index < count; index += 1) {
    const position = new Vector3(
      translation ? normalizedComponent(translation, index * 3) : 0,
      translation ? normalizedComponent(translation, index * 3 + 1) : 0,
      translation ? normalizedComponent(translation, index * 3 + 2) : 0,
    )
    const quaternion = new Quaternion(
      rotation ? normalizedComponent(rotation, index * 4) : 0,
      rotation ? normalizedComponent(rotation, index * 4 + 1) : 0,
      rotation ? normalizedComponent(rotation, index * 4 + 2) : 0,
      rotation ? normalizedComponent(rotation, index * 4 + 3) : 1,
    ).normalize()
    const size = new Vector3(
      scale ? normalizedComponent(scale, index * 3) : 1,
      scale ? normalizedComponent(scale, index * 3 + 1) : 1,
      scale ? normalizedComponent(scale, index * 3 + 2) : 1,
    )
    output.push(new Matrix4().compose(position, quaternion, size))
  }
  return output
}

function conservativePrimitiveBounds(primitive, matrix) {
  const accessor = primitive.getAttribute('POSITION')
  assert.ok(accessor, 'Primitive has no POSITION accessor')
  const min = accessor.getMin([])
  const max = accessor.getMax([])
  assert.ok(min?.length === 3 && max?.length === 3, 'POSITION accessor has no 3D bounds')
  const bounds = emptyBounds()
  const point = new Vector3()
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        point.set(x, y, z).applyMatrix4(matrix)
        for (let axis = 0; axis < 3; axis += 1) {
          bounds.min[axis] = Math.min(bounds.min[axis], point.getComponent(axis))
          bounds.max[axis] = Math.max(bounds.max[axis], point.getComponent(axis))
        }
      }
    }
  }
  return canonicalBounds(bounds)
}

function texturesForMaterial(material) {
  if (!material) return []
  const graph = material.getGraph()
  const textures = new Set()
  const visited = new Set()
  const visit = (property) => {
    if (visited.has(property)) return
    visited.add(property)
    for (const edge of graph.listChildEdges(property)) {
      const child = edge.getChild()
      if (child instanceof Texture) textures.add(child)
      else if (child instanceof ExtensionProperty) visit(child)
    }
  }
  visit(material)
  return [...textures]
}

function materialFacts(material, materialIndex, textureCache) {
  if (!material) {
    return {
      index: null,
      name: '(default)',
      affinityKey: 'default-material',
      signatureSha256: stableSha256({ default: true }),
      textures: [],
    }
  }
  const textures = texturesForMaterial(material).map((texture) => {
    const image = texture.getImage()
    if (!image) return null
    const digest = sha256(image)
    if (!textureCache.has(digest)) textureCache.set(digest, { sha256: digest, embeddedBytes: image.byteLength })
    return textureCache.get(digest)
  }).filter(Boolean).sort((left, right) => left.sha256.localeCompare(right.sha256))
  const signature = {
    name: material.getName() || '',
    alphaMode: material.getAlphaMode(),
    alphaCutoff: material.getAlphaCutoff(),
    doubleSided: material.getDoubleSided(),
    baseColorFactor: material.getBaseColorFactor(),
    metallicFactor: material.getMetallicFactor(),
    roughnessFactor: material.getRoughnessFactor(),
    emissiveFactor: material.getEmissiveFactor(),
    textureSha256: textures.map((texture) => texture.sha256),
  }
  return {
    index: materialIndex,
    name: material.getName() || `(material-${materialIndex})`,
    affinityKey: `${(material.getName() || 'unnamed').toLowerCase()}|${textures.map((texture) => texture.sha256).join(',')}`,
    signatureSha256: stableSha256(signature),
    textures,
  }
}

function primitiveGeometryBytes(primitive) {
  const accessors = [
    primitive.getIndices(),
    ...primitive.listAttributes(),
    ...primitive.listTargets().flatMap((target) => target.listAttributes()),
  ].filter(Boolean)
  return accessors.reduce((sum, accessor) => sum + (accessor.getArray()?.byteLength ?? 0), 0)
}

function cellForCenter(center) {
  return {
    floorBand: Math.floor((center[1] - GRID.origin[1]) / GRID.elevationBand),
    x: Math.floor((center[0] - GRID.origin[0]) / GRID.cellSizeXz),
    z: Math.floor((center[2] - GRID.origin[2]) / GRID.cellSizeXz),
  }
}

function cellKey(cell) {
  return `${cell.floorBand}|${cell.x}|${cell.z}`
}

function cellIdPart(value) {
  return value < 0 ? `m${Math.abs(value)}` : String(value)
}

function compareCells(left, right) {
  const a = left.split('|').map(Number)
  const b = right.split('|').map(Number)
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

function summarizeVariantUnits(units) {
  const nodeIds = [...new Set(units.map((unit) => unit.nodeId))].sort()
  const instanceIds = [...new Set(units.map((unit) => unit.instanceId))].sort()
  const unitIds = units.map((unit) => unit.id).sort()
  const bounds = emptyBounds()
  for (const unit of units) expandBounds(bounds, unit.bounds)
  return {
    renderNodeCount: nodeIds.length,
    logicalInstanceCount: instanceIds.length,
    atomicUnitCount: unitIds.length,
    expandedTriangles: units.reduce((sum, unit) => sum + unit.triangles, 0),
    sourceRendererDraws: new Set(units.map((unit) => `${unit.nodeId}/primitive/${unit.primitiveIndex}`)).size,
    nodeIdsSha256: stringListSha256(nodeIds),
    instanceIdsSha256: stringListSha256(instanceIds),
    unitIdsSha256: stringListSha256(unitIds),
    bounds: units.length ? canonicalBounds(bounds) : null,
  }
}

async function analyzeVariant(variant, contractVariant, sourcePath) {
  const document = await (await createGltfIO()).read(sourcePath)
  const root = document.getRoot()
  const nodes = root.listNodes()
  const materials = root.listMaterials()
  const materialIndices = new Map(materials.map((material, index) => [material, index]))
  const textureCache = new Map()
  const sourceNodes = contractVariant.inventory.nodes.filter((node) => node.owner === OWNER)
  const sourceUnits = contractVariant.inventory.units.filter((unit) => unit.owner === OWNER)
  const unitsByNode = new Map()
  for (const unit of sourceUnits) {
    const list = unitsByNode.get(unit.nodeId) || []
    list.push(unit)
    unitsByNode.set(unit.nodeId, list)
  }
  const analyzedUnits = []
  const analyzedNodes = []
  for (const record of sourceNodes) {
    const node = nodes[record.sourceNodeIndex]
    assert.ok(node?.getMesh(), `${variant}:${record.id} does not resolve to its pinned render node`)
    const primitives = node.getMesh().listPrimitives()
    const matrices = instanceMatrices(node)
    assert.equal(matrices.length, record.instanceCount, `${variant}:${record.id} instance count drifted`)
    const nodeWorld = new Matrix4().fromArray(node.getWorldMatrix())
    const nodeBounds = emptyBounds()
    const nodeUnits = (unitsByNode.get(record.id) || []).sort((left, right) => left.id.localeCompare(right.id))
    for (const source of nodeUnits) {
      const primitive = primitives[source.primitiveIndex]
      assert.ok(primitive, `${variant}:${source.id} primitive does not exist`)
      const matrix = nodeWorld.clone().multiply(matrices[source.instanceIndex])
      const bounds = conservativePrimitiveBounds(primitive, matrix)
      expandBounds(nodeBounds, bounds)
      const material = primitive.getMaterial()
      const materialRecord = materialFacts(material, materialIndices.get(material) ?? null, textureCache)
      const center = stableValue(boundsCenter(bounds))
      const cell = cellForCenter(center)
      analyzedUnits.push({
        ...source,
        sourcePath: record.ownerRelativePath,
        authoredSourceId: source.sourceId,
        stableSourceId: source.id,
        bounds,
        center,
        cell,
        material: materialRecord,
        geometryDependencyKey: `${record.id}/primitive/${source.primitiveIndex}`,
        decodedGeometryBytes: primitiveGeometryBytes(primitive),
        transformParity: matrix.determinant() < 0 ? 'mirrored' : 'positive',
      })
    }
    analyzedNodes.push({
      ...record,
      bounds: canonicalBounds(nodeBounds),
      stableSourceIds: nodeUnits.map((unit) => unit.id),
    })
  }
  analyzedUnits.sort((left, right) => left.id.localeCompare(right.id))
  analyzedNodes.sort((left, right) => left.id.localeCompare(right.id))
  const instances = contractVariant.inventory.instances.filter((instance) => instance.owner === OWNER)
    .map((instance) => ({ ...instance, stableSourceId: instance.id }))
    .sort((left, right) => left.id.localeCompare(right.id))
  return {
    variant,
    source: contractVariant.source,
    sourcePath: projectPath(sourcePath),
    nodes: analyzedNodes,
    instances,
    units: analyzedUnits,
    inventory: summarizeVariantUnits(analyzedUnits),
    textureDependencies: [...textureCache.values()].sort((left, right) => left.sha256.localeCompare(right.sha256)),
  }
}

function identifyRepeatUnits(analyses, repeatReport, repeatManifest) {
  assert.equal(repeatReport.enabled, false, 'Repeat candidate must remain disabled')
  assert.equal(repeatManifest.enabled, false, 'Repeat manifest must remain disabled')
  assert.equal(repeatManifest.runtimeIntegrated, false, 'Repeat candidate must not be runtime integrated')
  assert.equal(repeatManifest.sourcePaths.length, 78, 'Repeat candidate source path count changed')
  const variants = {}
  let canonicalNodeIds = null
  for (const variant of VARIANTS) {
    const analysis = analyses[variant]
    const report = repeatReport.production?.[variant]
    assert.equal(report?.sha256, analysis.source.sha256, `${variant}: repeat evidence source hash is stale`)
    const candidates = analysis.nodes.filter((node) => node.instanceCount === 78 && node.primitiveCount === 1)
    assert.equal(candidates.length, 4, `${variant}: expected exactly four unowned 78-instance material batches`)
    const expectedByMaterial = new Map(report.groups.map((group) => [group.material, group]))
    const selected = []
    for (const node of candidates) {
      const units = analysis.units.filter((unit) => unit.nodeId === node.id)
      const materials = [...new Set(units.map((unit) => unit.material.name))]
      assert.equal(materials.length, 1, `${variant}:${node.id} repeat batch has multiple materials`)
      const expected = expectedByMaterial.get(materials[0])
      assert.ok(expected, `${variant}:${node.id} material is absent from repeat evidence`)
      assert.equal(units.length, 78, `${variant}:${node.id} repeat unit count changed`)
      assert.ok(units.every((unit) => unit.triangles === expected.triangles), `${variant}:${node.id} triangle count changed`)
      selected.push({
        sourceNodeId: node.id,
        sourcePath: node.ownerRelativePath,
        material: materials[0],
        logicalInstanceCount: 78,
        atomicUnitCount: 78,
        uniqueTriangles: expected.triangles,
        expandedTriangles: expected.triangles * 78,
        bounds: node.bounds,
        sourceInstanceIds: units.map((unit) => unit.instanceId).sort(),
        sourceUnitIds: units.map((unit) => unit.id).sort(),
      })
    }
    selected.sort((left, right) => left.sourceNodeId.localeCompare(right.sourceNodeId))
    const nodeIds = selected.map((entry) => entry.sourceNodeId)
    if (canonicalNodeIds) assert.deepEqual(nodeIds, canonicalNodeIds, 'Web/Quest repeat node identities differ')
    canonicalNodeIds = nodeIds
    variants[variant] = {
      batches: selected,
      summary: summarizeVariantUnits(analysis.units.filter((unit) => nodeIds.includes(unit.nodeId))),
    }
  }
  return {
    sourceOwner: OWNER,
    runtimeAttachmentTarget: repeatManifest.ownerNodeName,
    attachmentDoesNotChangeSourceOwnership: true,
    candidateObjectSourcePaths: [...repeatManifest.sourcePaths].sort(),
    candidateObjectSourcePathsSha256: stringListSha256(repeatManifest.sourcePaths),
    sourceNodeIds: canonicalNodeIds,
    variants,
  }
}

function explicitMigratedSourceUnitIds(variantSidecar, variant) {
  const direct = [
    variantSidecar?.scope?.migratedDetachedFireSourceUnitIds,
    variantSidecar?.scope?.migratedSourceUnitIds,
    variantSidecar?.migratedDetachedFireSourceUnitIds,
    variantSidecar?.migratedSourceUnitIds,
  ].find(Array.isArray)
  if (direct) return direct.map(String)
  const migrated = (variantSidecar?.atomicMappings || [])
    .filter((mapping) => mapping.migration === 'reparented-fire-safety-batch')
  return migrated.flatMap((mapping) => {
    const list = mapping.sourceUnitIds ?? mapping.productionSourceUnitIds ?? mapping.wholeLayerSourceUnitIds
    if (Array.isArray(list)) return list.map(String)
    for (const key of ['sourceUnitId', 'productionSourceUnitId', 'wholeLayerSourceUnitId', 'atomicId']) {
      const value = mapping[key]
      if (typeof value === 'string' && value.startsWith('owner/__unowned__/node/')) return [value]
    }
    return []
  })
}

async function consumeFireMigration(analyses, sidecarPath) {
  const bytes = await readFile(sidecarPath)
  const sidecar = JSON.parse(bytes)
  assert.equal(sidecar.schema, 'IOM_GROUND_FLOOR_SOURCE_OWNERSHIP_MIGRATION', 'Fire migration schema changed')
  assert.equal(sidecar.version, 2, 'Fire migration must use the primitive-instance v2 contract')
  assert.equal(sidecar.enabled, false, 'Fire migration must remain disabled')
  assert.equal(sidecar.productionModified, false, 'Fire migration must not modify production')
  assert.equal(sidecar.owner, 'Ground Floor._anim1', 'Fire migration destination owner changed')
  assert.equal(sidecar.preprocessing?.report?.sha256,
    await sha256File(sidecar.preprocessing.report.path), 'Fire migration preprocessing report hash is stale')
  const variants = {}
  let canonicalIds = null
  for (const variant of VARIANTS) {
    const entry = sidecar.variants?.[variant]
    assert.ok(entry, `${variant}: fire migration entry is missing`)
    assert.equal(entry.production?.sha256, analyses[variant].source.sha256, `${variant}: fire migration production hash is stale`)
    assert.equal(entry.scope?.migratedDetachedFireAtomicUnits, 60, `${variant}: fire migration must declare 60 atomic units`)
    assert.equal(entry.scope?.migratedDetachedFireMeshNodes, 6, `${variant}: fire migration must preserve six source mesh batches`)
    assert.equal(entry.scope?.productionGroundOwnedAtomicUnits, 230, `${variant}: Ground Floor baseline atomic count changed`)
    assert.equal(entry.scope?.correctedGroundOwnedAtomicUnits, 290, `${variant}: corrected Ground Floor atomic count changed`)
    assert.equal(entry.scope?.atomicMappingCount, 290, `${variant}: complete Ground Floor mapping count changed`)
    assert.equal(entry.wholeLayerCompatibility?.atomicUnit, 'mesh-primitive-instance', `${variant}: incompatible fire atomic unit`)
    assert.equal(entry.wholeLayerCompatibility?.identityPolicy,
      'pinned-active-scene-owner-relative-hierarchy-v1', `${variant}: incompatible fire identity policy`)
    assert.equal(entry.transformEvidence?.maxNodeWorldMatrixDelta, 0, `${variant}: fire node transform drift is not zero`)
    assert.equal(entry.transformEvidence?.maxFireInstanceWorldMatrixDelta, 0, `${variant}: fire instance transform drift is not zero`)
    assert.equal(entry.atomicMappingsSha256, sha256(Buffer.from(JSON.stringify(entry.atomicMappings))), `${variant}: fire atomic mapping digest is stale`)
    const correctedBytes = await readFile(entry.correctedPackagingInput.path)
    assert.equal(entry.correctedPackagingInput.bytes, correctedBytes.length, `${variant}: corrected packaging input bytes are stale`)
    assert.equal(entry.correctedPackagingInput.sha256, sha256(correctedBytes), `${variant}: corrected packaging input hash is stale`)
    const sourceUnitIds = explicitMigratedSourceUnitIds(entry, variant).sort()
    assert.equal(sourceUnitIds.length, 60,
      `${variant}: fire migration must enumerate 60 explicit primitive-instance sourceUnitIds; node/batch counts are rejected`)
    assert.equal(new Set(sourceUnitIds).size, 60, `${variant}: fire migration sourceUnitIds are duplicated`)
    assert.equal(entry.wholeLayerCompatibility?.productionMigratedFireUnitIdsSha256,
      stringListSha256(sourceUnitIds), `${variant}: fire whole-layer source-unit digest is stale`)
    const unitMap = new Map(analyses[variant].units.map((unit) => [unit.id, unit]))
    const migratedMappings = entry.atomicMappings.filter((mapping) =>
      mapping.migration === 'reparented-fire-safety-batch')
    assert.equal(migratedMappings.length, 60, `${variant}: expected 60 explicit migrated mapping records`)
    const mappingById = new Map(migratedMappings.map((mapping) =>
      [mapping.productionAtomicId ?? mapping.atomicId, mapping]))
    const units = sourceUnitIds.map((id) => {
      const unit = unitMap.get(id)
      assert.ok(unit, `${variant}: fire migration references an unknown/unowned source unit ${id}`)
      const mapping = mappingById.get(id)
      assert.ok(mapping, `${variant}: fire source unit lacks an explicit migration mapping ${id}`)
      assert.equal(mapping.productionOwnership, OWNER, `${variant}: fire production owner changed for ${id}`)
      assert.equal(mapping.correctedOwnership, 'Ground Floor._anim1', `${variant}: fire destination owner changed for ${id}`)
      assert.equal(mapping.productionNodeId, unit.nodeId, `${variant}: fire source node identity changed for ${id}`)
      assert.equal(mapping.primitiveIndex, unit.primitiveIndex, `${variant}: fire primitive identity changed for ${id}`)
      assert.equal(mapping.instanceIndex, unit.instanceIndex, `${variant}: fire instance identity changed for ${id}`)
      assert.equal(mapping.triangles, unit.triangles, `${variant}: fire triangle evidence changed for ${id}`)
      assert.equal(mapping.instanceWorldMatrixDelta, 0, `${variant}: fire instance transform drift is not zero for ${id}`)
      return unit
    })
    const sourceNodeIds = [...new Set(units.map((unit) => unit.nodeId))].sort()
    assert.equal(sourceNodeIds.length, 6, `${variant}: 60 fire units must resolve to six explicit source nodes`)
    assert.ok(units.every((unit) => unit.material.name !== '(default)'), `${variant}: fire migration contains an unresolved default material`)
    if (canonicalIds) assert.deepEqual(sourceUnitIds, canonicalIds, 'Web/Quest fire migration whole-layer unit identities differ')
    canonicalIds = sourceUnitIds
    variants[variant] = {
      sourceUnitIds,
      sourceUnitIdsSha256: stringListSha256(sourceUnitIds),
      sourceNodeIds,
      sourcePaths: [...new Set(units.map((unit) => unit.sourcePath))].sort(),
      summary: summarizeVariantUnits(units),
      correctedPackagingInput: entry.correctedPackagingInput,
      atomicMappingsSha256: entry.atomicMappingsSha256,
      declaredMigratedAtomicUnits: entry.scope?.migratedDetachedFireAtomicUnits,
      wholeLayerCompatibility: entry.wholeLayerCompatibility,
    }
  }
  return {
    contract: { schema: sidecar.schema, version: sidecar.version },
    enabled: false,
    sourceOwner: OWNER,
    destinationOwner: sidecar.owner,
    migrationDoesNotPermitDoubleClaim: true,
    evidence: {
      path: projectPath(sidecarPath),
      bytes: bytes.length,
      sha256: sha256(bytes),
      preprocessingReport: sidecar.preprocessing?.report ?? null,
    },
    sourceUnitIds: canonicalIds,
    variants,
  }
}

function correspondence(analyses) {
  const ids = (variant, kind) => new Set(analyses[variant][kind].map((entry) => entry.id))
  const compare = (kind) => {
    const web = ids('web', kind)
    const quest = ids('quest', kind)
    const common = [...web].filter((id) => quest.has(id)).sort()
    const webOnly = [...web].filter((id) => !quest.has(id)).sort()
    const questOnly = [...quest].filter((id) => !web.has(id)).sort()
    return {
      commonCount: common.length,
      webOnlyCount: webOnly.length,
      questOnlyCount: questOnly.length,
      commonIdsSha256: stringListSha256(common),
      webOnly,
      questOnly,
    }
  }
  const unitMap = Object.fromEntries(VARIANTS.map((variant) => [variant,
    new Map(analyses[variant].units.map((unit) => [unit.id, unit]))]))
  const commonUnits = [...unitMap.web.keys()].filter((id) => unitMap.quest.has(id))
  let maxCenterDelta = 0
  const spatialCellMismatches = []
  for (const id of commonUnits) {
    const web = unitMap.web.get(id)
    const quest = unitMap.quest.get(id)
    const delta = Math.hypot(...web.center.map((value, axis) => value - quest.center[axis]))
    maxCenterDelta = Math.max(maxCenterDelta, delta)
    if (cellKey(web.cell) !== cellKey(quest.cell)) spatialCellMismatches.push(id)
  }
  return {
    identityPolicy: 'pinned-active-scene-owner-relative-hierarchy-v1',
    nodes: compare('nodes'),
    logicalInstances: compare('instances'),
    atomicUnits: compare('units'),
    maximumCommonUnitCenterDelta: stableValue(maxCenterDelta),
    spatialCellMismatchCount: spatialCellMismatches.length,
    spatialCellMismatchSample: spatialCellMismatches.slice(0, 20),
  }
}

function materialLabel(unit) {
  return (unit.material.name || '(default)').normalize('NFKC').trim().toLowerCase()
}

function boundsSize(bounds) {
  return bounds.max.map((value, axis) => Math.max(0, value - bounds.min[axis]))
}

function primitivePairCost(web, quest) {
  const centerDelta = Math.hypot(...web.center.map((value, axis) => value - quest.center[axis]))
  const webSize = boundsSize(web.bounds)
  const questSize = boundsSize(quest.bounds)
  const sizeDelta = Math.hypot(...webSize.map((value, axis) => value - questSize[axis]))
  const triangleRatio = Math.abs(Math.log((web.triangles + 1) / (quest.triangles + 1)))
  return centerDelta + sizeDelta * 0.1 + triangleRatio
}

function greedyPrimitivePairs(webUnits, questUnits) {
  const pairs = []
  const webAvailable = new Map(webUnits.map((unit) => [unit.primitiveIndex, unit]))
  const questAvailable = new Map(questUnits.map((unit) => [unit.primitiveIndex, unit]))
  const matchPass = (sameMaterialOnly) => {
    const candidates = []
    for (const web of webAvailable.values()) {
      for (const quest of questAvailable.values()) {
        const materialEqual = materialLabel(web) === materialLabel(quest)
        if (sameMaterialOnly !== materialEqual) continue
        candidates.push({ web, quest, cost: primitivePairCost(web, quest) })
      }
    }
    candidates.sort((left, right) => left.cost - right.cost ||
      left.web.primitiveIndex - right.web.primitiveIndex ||
      left.quest.primitiveIndex - right.quest.primitiveIndex)
    for (const candidate of candidates) {
      if (!webAvailable.has(candidate.web.primitiveIndex) || !questAvailable.has(candidate.quest.primitiveIndex)) continue
      pairs.push(candidate)
      webAvailable.delete(candidate.web.primitiveIndex)
      questAvailable.delete(candidate.quest.primitiveIndex)
    }
  }
  matchPass(true)
  matchPass(false)
  return {
    pairs,
    webOnly: [...webAvailable.values()].sort((left, right) => left.primitiveIndex - right.primitiveIndex),
    questOnly: [...questAvailable.values()].sort((left, right) => left.primitiveIndex - right.primitiveIndex),
  }
}

export function semanticStaticRecords(analyses, repeat, fireMigration) {
  const repeatNodeIds = new Set(repeat.sourceNodeIds)
  const fireIds = Object.fromEntries(VARIANTS.map((variant) => [variant,
    new Set(fireMigration.variants[variant].sourceUnitIds)]))
  const unitsByVariantNode = {}
  for (const variant of VARIANTS) {
    unitsByVariantNode[variant] = new Map()
    for (const unit of analyses[variant].units.filter((entry) =>
      !repeatNodeIds.has(entry.nodeId) && !fireIds[variant].has(entry.id))) {
      const list = unitsByVariantNode[variant].get(unit.nodeId) || []
      list.push(unit)
      unitsByVariantNode[variant].set(unit.nodeId, list)
    }
  }
  const nodeIds = [...new Set([...unitsByVariantNode.web.keys(), ...unitsByVariantNode.quest.keys()])].sort()
  const records = []
  const primitiveMappings = []
  let sameIdentityMatches = 0
  let remappedPrimitiveMatches = 0
  let materialMismatchMatches = 0
  let maximumPairedCenterDelta = 0
  let canonicalCellMismatchCount = 0
  for (const nodeId of nodeIds) {
    const webUnits = unitsByVariantNode.web.get(nodeId) || []
    const questUnits = unitsByVariantNode.quest.get(nodeId) || []
    const webByInstance = new Map()
    const questByInstance = new Map()
    for (const unit of webUnits) {
      const list = webByInstance.get(unit.instanceIndex) || []
      list.push(unit)
      webByInstance.set(unit.instanceIndex, list)
    }
    for (const unit of questUnits) {
      const list = questByInstance.get(unit.instanceIndex) || []
      list.push(unit)
      questByInstance.set(unit.instanceIndex, list)
    }
    const instanceIndices = [...new Set([...webByInstance.keys(), ...questByInstance.keys()])].sort((a, b) => a - b)
    assert.ok(instanceIndices.length > 0, `${nodeId}: correspondence node has no instances`)
    const template = greedyPrimitivePairs(webByInstance.get(instanceIndices[0]) || [], questByInstance.get(instanceIndices[0]) || [])
    primitiveMappings.push({
      sourceNodeId: nodeId,
      pairs: template.pairs.map(({ web, quest }) => ({
        webPrimitiveIndex: web.primitiveIndex,
        questPrimitiveIndex: quest.primitiveIndex,
        materialMatch: materialLabel(web) === materialLabel(quest),
      })),
      webOnlyPrimitiveIndices: template.webOnly.map((unit) => unit.primitiveIndex),
      questOnlyPrimitiveIndices: template.questOnly.map((unit) => unit.primitiveIndex),
    })
    for (const instanceIndex of instanceIndices) {
      const webMap = new Map((webByInstance.get(instanceIndex) || []).map((unit) => [unit.primitiveIndex, unit]))
      const questMap = new Map((questByInstance.get(instanceIndex) || []).map((unit) => [unit.primitiveIndex, unit]))
      for (const pair of template.pairs) {
        const web = webMap.get(pair.web.primitiveIndex)
        const quest = questMap.get(pair.quest.primitiveIndex)
        assert.ok(web && quest, `${nodeId}: primitive mapping is not stable at instance ${instanceIndex}`)
        const semanticMaterialMatch = materialLabel(web) === materialLabel(quest)
        const center = stableValue(web.center.map((value, axis) => (value + quest.center[axis]) * 0.5))
        const canonicalCell = cellForCenter(center)
        const delta = Math.hypot(...web.center.map((value, axis) => value - quest.center[axis]))
        maximumPairedCenterDelta = Math.max(maximumPairedCenterDelta, delta)
        if (cellKey(web.cell) !== cellKey(quest.cell)) canonicalCellMismatchCount += 1
        if (web.id === quest.id) sameIdentityMatches += 1
        else remappedPrimitiveMatches += 1
        if (!semanticMaterialMatch) materialMismatchMatches += 1
        records.push({
          id: `pair:${stableSha256([web.id, quest.id]).slice(0, 24)}`,
          correspondence: web.id === quest.id ? 'same-identity-pair' : 'semantic-remap-pair',
          cell: canonicalCell,
          cellKey: cellKey(canonicalCell),
          materialAffinityKey: stableSha256({ web: web.material.affinityKey, quest: quest.material.affinityKey }),
          variants: { web, quest },
        })
      }
      for (const templateUnit of template.webOnly) {
        const web = webMap.get(templateUnit.primitiveIndex)
        assert.ok(web, `${nodeId}: Web-only primitive is absent at instance ${instanceIndex}`)
        records.push({
          id: `web-only:${stableSha256(web.id).slice(0, 24)}`,
          correspondence: 'web-only',
          cell: web.cell,
          cellKey: cellKey(web.cell),
          materialAffinityKey: stableSha256({ web: web.material.affinityKey, quest: null }),
          variants: { web, quest: null },
        })
      }
      for (const templateUnit of template.questOnly) {
        const quest = questMap.get(templateUnit.primitiveIndex)
        assert.ok(quest, `${nodeId}: Quest-only primitive is absent at instance ${instanceIndex}`)
        records.push({
          id: `quest-only:${stableSha256(quest.id).slice(0, 24)}`,
          correspondence: 'quest-only',
          cell: quest.cell,
          cellKey: cellKey(quest.cell),
          materialAffinityKey: stableSha256({ web: null, quest: quest.material.affinityKey }),
          variants: { web: null, quest },
        })
      }
    }
  }
  records.sort((left, right) => left.id.localeCompare(right.id))
  const mappingsDigest = stableSha256(primitiveMappings)
  return {
    records,
    evidence: {
      policy: 'node-instance + material-name + nearest-world-bounds-v1',
      sameIdentityMatches,
      remappedPrimitiveMatches,
      materialMismatchMatches,
      webOnlyRecords: records.filter((record) => record.correspondence === 'web-only').map((record) => record.variants.web.id),
      questOnlyRecords: records.filter((record) => record.correspondence === 'quest-only').map((record) => record.variants.quest.id),
      maximumPairedCenterDelta: stableValue(maximumPairedCenterDelta),
      pairedSpatialCellMismatchCount: canonicalCellMismatchCount,
      primitiveMappingsSha256: mappingsDigest,
      primitiveMappings,
    },
  }
}

function packageMetrics(records, variant) {
  const units = records.map((record) => record.variants[variant]).filter(Boolean)
  const geometry = new Map()
  const textures = new Map()
  const materials = new Set()
  for (const unit of units) {
    geometry.set(unit.geometryDependencyKey, unit.decodedGeometryBytes)
    for (const texture of unit.material.textures) textures.set(texture.sha256, texture.embeddedBytes)
    materials.add(unit.material.signatureSha256)
  }
  const bounds = emptyBounds()
  for (const unit of units) expandBounds(bounds, unit.bounds)
  const projectedDrawKeys = [...new Set(units.map((unit) =>
    `${unit.nodeId}/primitive/${unit.primitiveIndex}/${unit.transformParity}`))].sort()
  const decodedGeometryBytes = [...geometry.values()].reduce((sum, value) => sum + value, 0)
  const embeddedTextureBytes = [...textures.values()].reduce((sum, value) => sum + value, 0)
  const estimatedOverheadBytes = 128 * 1024 + projectedDrawKeys.length * 2048 + materials.size * 4096
  return {
    atomicUnitCount: units.length,
    logicalInstanceCount: new Set(units.map((unit) => unit.instanceId)).size,
    renderNodeCount: new Set(units.map((unit) => unit.nodeId)).size,
    expandedTriangles: units.reduce((sum, unit) => sum + unit.triangles, 0),
    projectedDraws: projectedDrawKeys.length,
    decodedGeometryBytes,
    embeddedTextureBytes,
    estimatedOverheadBytes,
    decodedDependencyBytes: decodedGeometryBytes + embeddedTextureBytes + estimatedOverheadBytes,
    materialCount: materials.size,
    textureCount: textures.size,
    materialSignaturesSha256: stringListSha256(materials),
    textureSha256: stringListSha256(textures.keys()),
    sourceNodeIds: [...new Set(units.map((unit) => unit.nodeId))].sort(),
    sourceInstanceIds: [...new Set(units.map((unit) => unit.instanceId))].sort(),
    sourceUnitIds: units.map((unit) => unit.id).sort(),
    sourcePaths: [...new Set(units.map((unit) => unit.sourcePath))].sort(),
    authoredSourceIdCount: units.filter((unit) => unit.authoredSourceId !== null).length,
    bounds: units.length ? canonicalBounds(bounds) : null,
  }
}

function withinBudgets(metrics, budget) {
  return metrics.expandedTriangles <= budget.maxExpandedTriangles &&
    metrics.projectedDraws <= budget.maxProjectedDraws &&
    metrics.atomicUnitCount <= budget.maxAtomicUnits &&
    metrics.decodedDependencyBytes <= budget.maxDecodedDependencyBytes
}

function packageFits(records) {
  return VARIANTS.every((variant) => withinBudgets(packageMetrics(records, variant), BUDGETS[variant]))
}

export function buildPackages(records) {
  const groups = new Map()
  for (const record of records) {
    const list = groups.get(record.cellKey) || []
    list.push(record)
    groups.set(record.cellKey, list)
  }
  const packages = []
  for (const key of [...groups.keys()].sort(compareCells)) {
    const cellRecords = groups.get(key).sort((left, right) => {
      const leftTriangles = Math.max(...VARIANTS.map((variant) => left.variants[variant]?.triangles ?? 0))
      const rightTriangles = Math.max(...VARIANTS.map((variant) => right.variants[variant]?.triangles ?? 0))
      return rightTriangles - leftTriangles || left.materialAffinityKey.localeCompare(right.materialAffinityKey) || left.id.localeCompare(right.id)
    })
    const bins = []
    for (const record of cellRecords) {
      assert.ok(packageFits([record]), `Atomic unit ${record.id} exceeds a planning budget and requires a finer source contract`)
      const candidates = bins.map((bin, index) => {
        if (!packageFits([...bin.records, record])) return null
        const affinity = bin.materials.has(record.materialAffinityKey) ? 1 : 0
        const web = packageMetrics(bin.records, 'web')
        const quest = packageMetrics(bin.records, 'quest')
        return { bin, index, affinity, load: web.expandedTriangles / BUDGETS.web.maxExpandedTriangles + quest.expandedTriangles / BUDGETS.quest.maxExpandedTriangles }
      }).filter(Boolean).sort((left, right) =>
        right.affinity - left.affinity || left.load - right.load || left.index - right.index)
      let target = candidates[0]?.bin
      if (!target) {
        target = { records: [], materials: new Set() }
        bins.push(target)
      }
      target.records.push(record)
      target.materials.add(record.materialAffinityKey)
    }
    const [floorBand, x, z] = key.split('|').map(Number)
    bins.forEach((bin, index) => {
      const id = `unowned-f${cellIdPart(floorBand)}-cx${cellIdPart(x)}-cz${cellIdPart(z)}-p${index + 1}`
      packages.push({
        id,
        enabled: false,
        owner: OWNER,
        role: 'static-spatial-material-aware-detail',
        cell: { floorBand, x, z },
        materialAffinityGroups: [...bin.materials].sort(),
        variants: Object.fromEntries(VARIANTS.map((variant) => [variant, packageMetrics(bin.records, variant)])),
      })
    })
  }
  return packages
}

function sourceSets(contract, variant) {
  const inventory = contract.variants[variant].inventory
  return {
    nodes: inventory.nodes.filter((entry) => entry.owner === OWNER).map((entry) => entry.id).sort(),
    instances: inventory.instances.filter((entry) => entry.owner === OWNER).map((entry) => entry.id).sort(),
    units: inventory.units.filter((entry) => entry.owner === OWNER).map((entry) => entry.id).sort(),
  }
}

function occurrenceMap(values) {
  const output = new Map()
  for (const value of values) output.set(value, (output.get(value) || 0) + 1)
  return output
}

export function validateUnownedStaticPlan(plan, contract) {
  const errors = []
  if (plan?.schema !== 'IOM_UNOWNED_STATIC_PARTITION_PLAN') errors.push('schema mismatch')
  if (plan?.version !== 1) errors.push('version mismatch')
  if (plan?.enabled !== false) errors.push('enabled must remain false')
  if (plan?.productionModified !== false || plan?.productionRoutingChanged !== false) errors.push('production flags must remain false')
  if (plan?.owner !== OWNER) errors.push(`owner must remain ${OWNER}`)
  if (plan?.wholeLayerCoverageDigestSha256 !== contract?.coverageDigestSha256) errors.push('whole-layer coverage digest is stale')
  if (plan?.repeatCandidate?.sourceOwner !== OWNER) errors.push('repeat source owner must remain __unowned__')
  if (plan?.fireHoseMigration?.sourceOwner !== OWNER || plan?.fireHoseMigration?.destinationOwner !== 'Ground Floor._anim1') {
    errors.push('fire migration ownership endpoints changed')
  }
  if (plan?.fireHoseMigration?.contract?.schema !== 'IOM_GROUND_FLOOR_SOURCE_OWNERSHIP_MIGRATION' ||
    plan?.fireHoseMigration?.contract?.version !== 2) errors.push('fire migration contract pin is not v2')
  if (!SHA256.test(plan?.fireHoseMigration?.evidence?.sha256 || '')) errors.push('fire migration evidence hash is invalid')
  const packageIds = new Set()
  for (const pkg of plan?.staticPackages || []) {
    if (!pkg.id || packageIds.has(pkg.id)) errors.push(`duplicate or missing package id ${pkg.id}`)
    packageIds.add(pkg.id)
    if (pkg.enabled !== false || pkg.owner !== OWNER) errors.push(`${pkg.id}: package must be disabled and owned by __unowned__`)
  }
  for (const variant of VARIANTS) {
    const expected = sourceSets(contract, variant)
    const planVariant = plan?.variants?.[variant]
    if (planVariant?.source?.sha256 !== contract.variants[variant].source.sha256) errors.push(`${variant}: source hash is stale`)
    if (planVariant?.source?.bytes !== contract.variants[variant].source.bytes) errors.push(`${variant}: source byte count is stale`)
    const inventory = planVariant?.inventory
    if (inventory?.renderNodeCount !== 398) errors.push(`${variant}: expected 398 unowned render nodes`)
    if (inventory?.logicalInstanceCount !== 3060) errors.push(`${variant}: expected 3,060 unowned logical instances`)
    if (inventory?.atomicUnitCount !== 3215) errors.push(`${variant}: expected 3,215 unowned atomic units`)
    if (inventory?.nodeIdsSha256 !== stringListSha256(expected.nodes)) errors.push(`${variant}: unowned node identity digest is stale`)
    if (inventory?.instanceIdsSha256 !== stringListSha256(expected.instances)) errors.push(`${variant}: unowned instance identity digest is stale`)
    if (inventory?.unitIdsSha256 !== stringListSha256(expected.units)) errors.push(`${variant}: unowned unit identity digest is stale`)

    const repeatIds = (plan?.repeatCandidate?.variants?.[variant]?.batches || []).flatMap((batch) => batch.sourceUnitIds)
    const fireIds = plan?.fireHoseMigration?.variants?.[variant]?.sourceUnitIds || []
    const staticIds = (plan?.staticPackages || []).flatMap((pkg) => pkg.variants?.[variant]?.sourceUnitIds || [])
    const repeatOccurrences = occurrenceMap(repeatIds)
    const fireOccurrences = occurrenceMap(fireIds)
    const staticOccurrences = occurrenceMap(staticIds)
    const repeatSet = new Set(repeatIds)
    const fireSet = new Set(fireIds)
    const union = [...repeatIds, ...fireIds, ...staticIds]
    const unionOccurrences = occurrenceMap(union)
    const missing = expected.units.filter((id) => !unionOccurrences.has(id))
    const duplicate = [...unionOccurrences].filter(([, count]) => count !== 1)
    const repeatStaticOverlap = staticIds.filter((id) => repeatSet.has(id))
    const fireStaticOverlap = staticIds.filter((id) => fireSet.has(id))
    const repeatFireOverlap = fireIds.filter((id) => repeatSet.has(id))
    if (repeatIds.length !== 312 || repeatOccurrences.size !== 312) errors.push(`${variant}: repeat segment must own exactly 312 unique units`)
    if (fireIds.length !== 60 || fireOccurrences.size !== 60) errors.push(`${variant}: fire migration must own exactly 60 unique units`)
    if (plan?.fireHoseMigration?.variants?.[variant]?.sourceUnitIdsSha256 !== stringListSha256(fireIds)) {
      errors.push(`${variant}: fire migration unit digest is stale`)
    }
    if (plan?.fireHoseMigration?.variants?.[variant]?.summary?.unitIdsSha256 !== stringListSha256(fireIds)) {
      errors.push(`${variant}: fire migration summary digest is stale`)
    }
    if (staticIds.length !== 2843 || staticOccurrences.size !== 2843) errors.push(`${variant}: static packages must own exactly 2,843 unique units`)
    if (missing.length) errors.push(`${variant}: omission detected (${missing.length} units)`)
    if (duplicate.length) errors.push(`${variant}: duplication detected (${duplicate.length} units)`)
    if (repeatStaticOverlap.length) errors.push(`${variant}: repeat/static overlap detected (${repeatStaticOverlap.length} units)`)
    if (fireStaticOverlap.length) errors.push(`${variant}: fire/static overlap detected (${fireStaticOverlap.length} units)`)
    if (repeatFireOverlap.length) errors.push(`${variant}: repeat/fire overlap detected (${repeatFireOverlap.length} units)`)
    for (const pkg of plan?.staticPackages || []) {
      const metrics = pkg.variants?.[variant]
      if (!metrics) {
        errors.push(`${variant}:${pkg.id}: metrics are missing`)
        continue
      }
      if (!withinBudgets(metrics, BUDGETS[variant])) errors.push(`${variant}:${pkg.id}: planning budget exceeded`)
      const packageUnits = (planVariant?.units || []).filter((unit) => metrics.sourceUnitIds.includes(unit.id))
      if (packageUnits.length !== metrics.sourceUnitIds.length) errors.push(`${variant}:${pkg.id}: unknown source unit identity`)
      if (metrics.bounds && packageUnits.some((unit) => !boundsContain(metrics.bounds, unit.bounds))) {
        errors.push(`${variant}:${pkg.id}: package bounds do not contain a source unit`)
      }
    }
  }
  const webFire = plan?.fireHoseMigration?.variants?.web?.sourceUnitIds || []
  const questFire = plan?.fireHoseMigration?.variants?.quest?.sourceUnitIds || []
  if (JSON.stringify(webFire) !== JSON.stringify(questFire)) errors.push('Web/Quest fire migration source identities differ')
  return { valid: errors.length === 0, errors }
}

function projection(packages, repeat, fireMigration, analyses) {
  const output = {}
  for (const variant of VARIANTS) {
    const staticTriangles = packages.reduce((sum, pkg) => sum + pkg.variants[variant].expandedTriangles, 0)
    const staticDraws = packages.reduce((sum, pkg) => sum + pkg.variants[variant].projectedDraws, 0)
    const repeatSummary = repeat.variants[variant].summary
    const fireSummary = fireMigration.variants[variant].summary
    const repeatCandidateDraws = variant === 'web' ? 52 : 52
    const repeatMidTriangles = variant === 'web' ? 3_810_534 : null
    output[variant] = {
      sourceUnowned: {
        expandedTriangles: analyses[variant].inventory.expandedTriangles,
        rendererDraws: analyses[variant].inventory.sourceRendererDraws,
      },
      repeatLod0: {
        expandedTriangles: repeatSummary.expandedTriangles,
        sourceDraws: repeatSummary.sourceRendererDraws,
        candidateProjectedDraws: repeatCandidateDraws,
      },
      fireMigration: {
        expandedTriangles: fireSummary.expandedTriangles,
        sourceDraws: fireSummary.sourceRendererDraws,
        destinationOwner: fireMigration.destinationOwner,
      },
      remainingStaticLod0: {
        expandedTriangles: staticTriangles,
        sourceDraws: new Set(packages.flatMap((pkg) => pkg.variants[variant].sourceUnitIds.map((id) => id.replace(/\/instance\/\d+$/, '')))).size,
        plannedPayloadDraws: staticDraws,
      },
      conservativeAllLoadedUnownedAfterMigration: {
        expandedTriangles: staticTriangles + repeatSummary.expandedTriangles,
        projectedDraws: staticDraws + repeatCandidateDraws,
      },
      conservativeAllLoadedWithRepeatMid: repeatMidTriangles === null ? null : {
        expandedTriangles: staticTriangles + repeatMidTriangles,
        projectedDraws: staticDraws + repeatCandidateDraws,
      },
      actualStreamResidentWindow: null,
      actualStreamResidentReason: 'A package selection radius/concurrency policy and emitted payloads do not exist yet; the values above are conservative all-loaded totals.',
      farField: null,
      farFieldReason: 'No unowned structural shell/HLOD has been authored or visually approved.',
    }
  }
  return output
}

export async function buildUnownedStaticPlan({
  repeatRoot = DEFAULT_REPEAT_ROOT,
  fireSidecar = DEFAULT_FIRE_SIDECAR,
} = {}) {
  const sources = Object.fromEntries(VARIANTS.map((variant) => [variant,
    resolve(MODEL_ROOT, `model-${variant}.glb`)]))
  const contract = await buildWholeLayerOwnershipContract({
    modelId: 'icm-anim-2025',
    variants: {
      web: { filePath: sources.web, url: '/models/icm-anim-2025/model-web.glb' },
      quest: { filePath: sources.quest, url: '/models/icm-anim-2025/model-quest.glb' },
    },
  })
  const contractValidation = validateWholeLayerOwnershipContract(contract)
  const sourceValidation = await verifyWholeLayerOwnershipSources(contract, sources)
  assert.ok(contractValidation.valid, contractValidation.errors.join('\n'))
  assert.ok(sourceValidation.valid, sourceValidation.errors.join('\n'))

  const repeatReportPath = resolve(repeatRoot, 'report.json')
  const repeatManifestPath = resolve(repeatRoot, 'manifest.disabled.json')
  const repeatReport = JSON.parse(await readFile(repeatReportPath, 'utf8'))
  const repeatManifest = JSON.parse(await readFile(repeatManifestPath, 'utf8'))
  const analyses = {}
  for (const variant of VARIANTS) analyses[variant] = await analyzeVariant(variant, contract.variants[variant], sources[variant])
  const repeat = identifyRepeatUnits(analyses, repeatReport, repeatManifest)
  repeat.evidence = {
    report: { path: projectPath(repeatReportPath), sha256: await sha256File(repeatReportPath) },
    disabledManifest: { path: projectPath(repeatManifestPath), sha256: await sha256File(repeatManifestPath) },
    status: repeatReport.status,
    enabled: false,
    runtimeIntegrated: false,
  }
  repeat.candidateObjectSourcePathContract = {
    count: 78,
    note: 'These human-readable object paths are the candidate identity domain. The whole-layer gate separately owns 312 GLB primitive-instances (four material batches x 78).',
  }

  const fireMigration = await consumeFireMigration(analyses, fireSidecar)
  const staticCorrespondence = semanticStaticRecords(analyses, repeat, fireMigration)
  const packages = buildPackages(staticCorrespondence.records)
  const plan = {
    schema: 'IOM_UNOWNED_STATIC_PARTITION_PLAN',
    version: 1,
    modelId: 'icm-anim-2025',
    enabled: false,
    activationStatus: 'disabled-plan-only-not-production-safe',
    productionModified: false,
    productionRoutingChanged: false,
    owner: OWNER,
    atomicOwnershipUnit: 'mesh-primitive-instance',
    wholeLayerCoverageDigestSha256: contract.coverageDigestSha256,
    grid: GRID,
    planningBudgets: BUDGETS,
    emittedPayloadByteGateStatus: 'unresolved-until-glbs-are-built',
    correspondence: {
      ...correspondence(analyses),
      semanticStaticMapping: staticCorrespondence.evidence,
    },
    repeatCandidate: repeat,
    fireHoseMigration: fireMigration,
    variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
      source: contract.variants[variant].source,
      sourcePath: analyses[variant].sourcePath,
      wholeLayerVariantCoverageDigestSha256: contract.variants[variant].coverageDigestSha256,
      inventory: analyses[variant].inventory,
      nodes: analyses[variant].nodes,
      instances: analyses[variant].instances,
      units: analyses[variant].units,
    }])),
    staticPackages: packages,
    projection: projection(packages, repeat, fireMigration, analyses),
    unresolvedReleaseGates: [
      'Emit self-contained Web and Quest GLBs and prove each actual byte count is within requiredEmittedGlbBytes; decoded dependency estimates are not an emitted-size substitute.',
      'Author and visually approve an opaque, disjoint unowned structural shell/HLOD before any far-field substitution. No far-field triangle or draw claim is made by this plan.',
      'Prove exact same-camera source/package image parity, normals/front-face visibility, transparent ordering, picking, hide/isolate, and load-before-retire transitions.',
      'Resolve the repeat candidate attachment semantics: Ground Floor._anim1 may be its transform host, but its four production source nodes remain claimed exactly once by __unowned__ in the whole-layer ownership contract.',
      'Compose the pinned 60-unit fire-hose migration into the Ground Floor package claims while removing those exact units from __unowned__; attachment and ownership are separate contracts.',
      'Define and validate the runtime resident window, request concurrency, and eviction policy. The current resident projection is deliberately the conservative all-packages-loaded upper bound.',
      'Profile frame time, memory, culling, and LOD transitions on physical Web and Quest-class hardware before activation.',
    ],
  }
  plan.planDigestSha256 = stableSha256({ ...plan, planDigestSha256: undefined })
  return { plan, contract }
}

function reportMarkdown(plan, validation) {
  const rows = VARIANTS.map((variant) => {
    const inventory = plan.variants[variant].inventory
    const repeat = plan.repeatCandidate.variants[variant].summary
    const fire = plan.fireHoseMigration.variants[variant].summary
    const projection = plan.projection[variant]
    return `| ${variant} | ${inventory.renderNodeCount.toLocaleString()} | ${inventory.logicalInstanceCount.toLocaleString()} | ${inventory.atomicUnitCount.toLocaleString()} | ${inventory.expandedTriangles.toLocaleString()} | ${repeat.expandedTriangles.toLocaleString()} | ${fire.expandedTriangles.toLocaleString()} | ${projection.remainingStaticLod0.expandedTriangles.toLocaleString()} | ${projection.conservativeAllLoadedUnownedAfterMigration.projectedDraws.toLocaleString()} |`
  }).join('\n')
  return `# Disabled unowned/static partition plan v1\n\n` +
    `Status: **disabled; exact ownership plan only; not production-safe**. Production assets, manifests, routes, and runtime were not changed.\n\n` +
    `Validation: **${validation.valid ? 'PASS' : 'FAIL'}**. Whole-layer contract: \`${plan.wholeLayerCoverageDigestSha256}\`. Plan: \`${plan.planDigestSha256}\`.\n\n` +
    `The \`${OWNER}\` partition contains exactly 398 render nodes, 3,060 logical GLB instances, and 3,215 mesh-primitive-instance units in both variants. Four scene-root material batches (\`scene/0/258\` through \`scene/0/261\`) contain 78 instances each. They are reserved exclusively for the existing disabled chair/table repeat candidate: 312 whole-layer units, representing 78 logical furniture objects across four materials. A separately pinned Ground Floor migration owns exactly 60 fire-hose primitive-instances. The remaining 2,843 units are assigned exactly once to ${plan.staticPackages.length} deterministic spatial/material-aware package plans.\n\n` +
    `Invariant: **3,215 = 312 repeat + 60 fire migration + 2,843 remaining static**, with multiplicity one and zero cross-segment overlap.\n\n` +
    `| Variant | Unowned nodes | Logical instances | Atomic units | Source triangles | Repeat LOD0 triangles | Migrated fire triangles | Remaining static triangles | Conservative all-loaded draws |\n` +
    `|---|---:|---:|---:|---:|---:|---:|---:|---:|\n${rows}\n\n` +
    `Web/Quest correspondence is exact for ${plan.correspondence.nodes.commonCount} node identities and ${plan.correspondence.logicalInstances.commonCount.toLocaleString()} logical instance identities. ${plan.correspondence.atomicUnits.commonCount.toLocaleString()} atomic IDs are common; ${plan.correspondence.atomicUnits.webOnlyCount} Web-only and ${plan.correspondence.atomicUnits.questOnlyCount} Quest-only primitive identity are recorded explicitly rather than guessed away.\n\n` +
    `The optimized GLBs reorder ${plan.correspondence.semanticStaticMapping.remappedPrimitiveMatches} remaining-static primitive pairs. The plan records those explicit semantic remaps using node/instance identity, exact material name, and nearest world bounds; material mismatches: ${plan.correspondence.semanticStaticMapping.materialMismatchMatches}. It does not assume that equal primitive ordinals always mean equal content.\n\n` +
    `Each package is constrained per variant by expanded triangles, projected parity-safe draw groups, atomic-unit count, and a conservative decoded dependency estimate. The draw total above is the deliberately conservative all-packages-loaded upper bound; an actual resident-window value requires a proven streaming policy. Actual emitted GLB byte gates also remain unresolved because this artifact emits no payloads.\n\n` +
    `## Required next work\n\n` +
    plan.unresolvedReleaseGates.map((item) => `- ${item}`).join('\n') + '\n'
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { plan, contract } = await buildUnownedStaticPlan({
    repeatRoot: args.repeatRoot,
    fireSidecar: args.fireSidecar,
  })
  const validation = validateUnownedStaticPlan(plan, contract)
  assert.ok(validation.valid, validation.errors.join('\n'))
  await mkdir(args.out, { recursive: true })
  await writeFile(join(args.out, 'unowned-static-partition-plan-v1.json'), `${JSON.stringify(plan, null, 2)}\n`)
  await writeFile(join(args.out, 'whole-layer-contract-pin.json'), `${JSON.stringify({
    schema: contract.schema,
    version: contract.version,
    modelId: contract.modelId,
    enabled: false,
    coverageDigestSha256: contract.coverageDigestSha256,
    variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
      source: contract.variants[variant].source,
      coverageDigestSha256: contract.variants[variant].coverageDigestSha256,
    }])),
  }, null, 2)}\n`)
  await writeFile(join(args.out, 'validation.json'), `${JSON.stringify(validation, null, 2)}\n`)
  await writeFile(join(args.out, 'REPORT.md'), reportMarkdown(plan, validation))
  console.log('Unowned/static partition plan: PASS')
  console.log(`  output: ${args.out}`)
  console.log(`  packages: ${plan.staticPackages.length}`)
  for (const variant of VARIANTS) {
    const projection = plan.projection[variant]
    console.log(`  ${variant}: ${projection.sourceUnowned.expandedTriangles.toLocaleString()} source tris -> ${projection.conservativeAllLoadedUnownedAfterMigration.expandedTriangles.toLocaleString()} unowned-after-migration tris / ${projection.conservativeAllLoadedUnownedAfterMigration.projectedDraws.toLocaleString()} conservative all-loaded draws`)
  }
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) await main()
