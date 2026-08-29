/**
 * Emit a disabled, spatially resident v2 candidate for the repeated Ground
 * Floor chair/table family.
 *
 * The v1 candidate is already parity-safe and owner-local, but stores all 78
 * logical instances in one GLB per level. This builder preserves those exact
 * primitive/instance records while splitting each parity/cell cohort into
 * packages of at most four logical instances. Four Web LOD0 instances submit
 * 245,076 triangles, remaining below manifest-v3's 250k detail-payload cap.
 *
 * Outputs are written only below tmp/repeat-spatial-payload-v2. Production
 * assets, manifests, and runtime routing are never modified.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prune } from '@gltf-transform/functions'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'
import {
  attributeContract,
  primitiveMaterialHash,
  triangleCount,
} from './build-ground-floor-selective-repeat-lod-pilot.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const DEFAULT_SOURCE = resolve(VIEWER_ROOT, 'tmp', 'repeat-geometry-release-candidate')
const DEFAULT_INSTANCE_MAP = resolve(VIEWER_ROOT, 'tmp', 'repeat-instancing-ground-floor', 'instance-map.json')
const DEFAULT_VISUAL_APPROVAL = resolve(VIEWER_ROOT, 'tmp', 'repeat-lod-ground-floor', 'visual-qa', 'visual-approval.json')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', 'repeat-spatial-payload-v2')
const OWNER_ID = 'rig-owner:ground-floor-anim1'
const OWNER_NODE = 'Ground Floor._anim1'
const VARIANTS = ['web', 'quest']
const MATERIAL_SLOTS = 4
const LOGICAL_INSTANCE_COUNT = 78
const MAX_INSTANCES_PER_PACKAGE = 2
const ADAPTIVE_SPLIT_PACKAGE_IDS = Object.freeze([
  'ground-repeat-f1-cx21-cz19-positive-p01',
  'ground-repeat-f1-cx21-cz19-positive-p05',
  'ground-repeat-f1-cx22-cz20-mirrored-p02',
  'ground-repeat-f1-cx21-cz19-positive-p02',
  'ground-repeat-f1-cx22-cz20-mirrored-p01',
  'ground-repeat-f1-cx21-cz19-positive-p06',
  'ground-repeat-f1-cx22-cz20-mirrored-p04',
  'ground-repeat-f1-cx21-cz20-mirrored-p01',
  'ground-repeat-f1-cx22-cz20-mirrored-p03',
  'ground-repeat-f1-cx21-cz19-positive-p03',
  'ground-repeat-f2-cx20-cz19-positive-p04',
  'ground-repeat-f2-cx20-cz19-positive-p03',
  'ground-repeat-f2-cx20-cz19-positive-p02',
  'ground-repeat-f1-cx21-cz20-mirrored-p02',
  'ground-repeat-f1-cx21-cz20-mirrored-p03',
  'ground-repeat-f2-cx20-cz19-positive-p01',
])
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const METRICS = ['triangles', 'draws', 'bytes', 'encodedTextureBytes', 'gpuTextureBytes']
const LEVELS = {
  web: [
    { sourceLevel: 'lod0', runtimeLevel: 'lod0', role: 'near' },
    { sourceLevel: 'lod1-mid', runtimeLevel: 'hlod', role: 'approved-conservative-mid' },
  ],
  quest: [
    { sourceLevel: 'lod0', runtimeLevel: 'lod0', role: 'exact-only' },
  ],
}
const POLICY = Object.freeze({
  maxDetailTriangles: 250_000,
  marginsMeters: Object.freeze({
    lod0Entry: 1.5,
    lod0Exit: 3.5,
    hlodEntry: 3.5,
    hlodExit: 5.5,
  }),
  hardBudgets: Object.freeze({
    resident: Object.freeze({
      web: Object.freeze({ triangles: 2_000_000, draws: 1_200, bytes: 512 * 1024 * 1024, encodedTextureBytes: 256 * 1024 * 1024, gpuTextureBytes: 768 * 1024 * 1024 }),
      quest: Object.freeze({ triangles: 800_000, draws: 500, bytes: 256 * 1024 * 1024, encodedTextureBytes: 64 * 1024 * 1024, gpuTextureBytes: 192 * 1024 * 1024 }),
    }),
    transitionPeak: Object.freeze({
      web: Object.freeze({ triangles: 2_500_000, draws: 1_600, bytes: 768 * 1024 * 1024, encodedTextureBytes: 384 * 1024 * 1024, gpuTextureBytes: 1024 * 1024 * 1024 }),
      quest: Object.freeze({ triangles: 1_000_000, draws: 650, bytes: 384 * 1024 * 1024, encodedTextureBytes: 96 * 1024 * 1024, gpuTextureBytes: 256 * 1024 * 1024 }),
    }),
  }),
})

function parseArgs(argv) {
  const args = {
    source: DEFAULT_SOURCE,
    instanceMap: DEFAULT_INSTANCE_MAP,
    visualApproval: DEFAULT_VISUAL_APPROVAL,
    out: DEFAULT_OUT,
  }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--source') args.source = resolve(argv[++index])
    else if (value === '--instance-map') args.instanceMap = resolve(argv[++index])
    else if (value === '--visual-approval') args.visualApproval = resolve(argv[++index])
    else if (value === '--out') args.out = resolve(argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]))
  }
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function sha256File(path) {
  return sha256Bytes(await readFile(path))
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function canonicalNumber(value) {
  return Number(Number(value).toPrecision(9))
}

function batchNodes(document) {
  return document.getRoot().listNodes()
    .filter((node) => node.getExtras()?.prepartitionedRepeatBatch === true)
    .sort((left, right) => left.getName().localeCompare(right.getName()))
}

function normalizedValue(accessor, index) {
  const value = accessor.getArray()[index]
  if (!accessor.getNormalized()) return value
  const type = accessor.getComponentType()
  if (type === 5120) return Math.max(-1, value / 127)
  if (type === 5121) return value / 255
  if (type === 5122) return Math.max(-1, value / 32767)
  if (type === 5123) return value / 65535
  return value
}

function instanceMatrices(node) {
  const extension = node.getExtension('EXT_mesh_gpu_instancing')
  assert.ok(extension, `${node.getName()} lacks EXT_mesh_gpu_instancing`)
  const translation = extension.getAttribute('TRANSLATION')
  const rotation = extension.getAttribute('ROTATION')
  const scale = extension.getAttribute('SCALE')
  const count = translation?.getCount() ?? rotation?.getCount() ?? scale?.getCount() ?? 0
  assert.ok(count > 0, `${node.getName()} has no instances`)
  const matrices = []
  for (let index = 0; index < count; index += 1) {
    const t = new Vector3(
      translation ? normalizedValue(translation, index * 3) : 0,
      translation ? normalizedValue(translation, index * 3 + 1) : 0,
      translation ? normalizedValue(translation, index * 3 + 2) : 0,
    )
    const q = [
      rotation ? normalizedValue(rotation, index * 4) : 0,
      rotation ? normalizedValue(rotation, index * 4 + 1) : 0,
      rotation ? normalizedValue(rotation, index * 4 + 2) : 0,
      rotation ? normalizedValue(rotation, index * 4 + 3) : 1,
    ]
    const s = new Vector3(
      scale ? normalizedValue(scale, index * 3) : 1,
      scale ? normalizedValue(scale, index * 3 + 1) : 1,
      scale ? normalizedValue(scale, index * 3 + 2) : 1,
    )
    const quaternion = new Quaternion(q[0], q[1], q[2], q[3]).normalize()
    matrices.push(new Matrix4().compose(t, quaternion, s))
  }
  return matrices
}

function groupKey(node) {
  const extras = node.getExtras()
  return `${extras.instanceParity}|${extras.spatialPartition}`
}

function groupsFor(document) {
  const groups = new Map()
  for (const node of batchNodes(document)) {
    const key = groupKey(node)
    const group = groups.get(key) ?? []
    group.push(node)
    groups.set(key, group)
  }
  for (const [key, nodes] of groups) {
    assert.equal(nodes.length, MATERIAL_SLOTS, `${key} must have four material-slot nodes`)
    nodes.sort((left, right) => left.getExtras().materialSlot - right.getExtras().materialSlot)
    assert.deepEqual(nodes.map((node) => node.getExtras().materialSlot), [0, 1, 2, 3])
    const sourceIds = nodes[0].getExtras().sourceIds
    assert.ok(Array.isArray(sourceIds) && sourceIds.length > 0, `${key} lacks source IDs`)
    for (const node of nodes.slice(1)) assert.deepEqual(node.getExtras().sourceIds, sourceIds)
  }
  return groups
}

function pointFor(instanceById, sourceId) {
  const record = instanceById.get(sourceId)
  assert.ok(record, `Missing source instance ${sourceId}`)
  const matrix = record.ownerLocalMatrix
  return [matrix[12], matrix[13], matrix[14]]
}

function boundsForPoints(points) {
  return {
    min: [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]))),
  }
}

function bboxVolume(bounds) {
  return Math.max(1e-9, bounds.max[0] - bounds.min[0]) *
    Math.max(1e-9, bounds.max[1] - bounds.min[1]) *
    Math.max(1e-9, bounds.max[2] - bounds.min[2])
}

/** Deterministic local grouping minimizing AABB expansion, with source ID ties. */
function spatialChunks(sourceIds, instanceById) {
  const remaining = new Set(sourceIds)
  const chunks = []
  while (remaining.size) {
    const ordered = [...remaining].sort((left, right) => {
      const a = pointFor(instanceById, left)
      const b = pointFor(instanceById, right)
      return a[1] - b[1] || a[2] - b[2] || a[0] - b[0] || left - right
    })
    const chunk = [ordered[0]]
    remaining.delete(ordered[0])
    while (chunk.length < MAX_INSTANCES_PER_PACKAGE && remaining.size) {
      const currentPoints = chunk.map((id) => pointFor(instanceById, id))
      const currentBounds = boundsForPoints(currentPoints)
      const candidate = [...remaining].map((id) => {
        const expanded = boundsForPoints([...currentPoints, pointFor(instanceById, id)])
        const center = currentPoints.reduce((totals, point) => totals.map((value, axis) => value + point[axis]), [0, 0, 0])
          .map((value) => value / currentPoints.length)
        const point = pointFor(instanceById, id)
        const distanceSq = point.reduce((sum, value, axis) => sum + (value - center[axis]) ** 2, 0)
        return { id, volumeGrowth: bboxVolume(expanded) - bboxVolume(currentBounds), distanceSq }
      }).sort((left, right) => left.volumeGrowth - right.volumeGrowth || left.distanceSq - right.distanceSq || left.id - right.id)[0]
      chunk.push(candidate.id)
      remaining.delete(candidate.id)
    }
    chunks.push(chunk.sort((left, right) => left - right))
  }
  return chunks
}

function makePlan(document, instanceMap) {
  const instanceById = new Map(instanceMap.instances.map((record) => [record.sourceIndex, record]))
  const groups = groupsFor(document)
  const packages = []
  for (const [key, nodes] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
    const extras = nodes[0].getExtras()
    const sourceIds = extras.sourceIds
    const chunks = spatialChunks(sourceIds, instanceById)
    for (let index = 0; index < chunks.length; index += 1) {
      const safeCell = extras.spatialPartition.replaceAll('|', '-').replaceAll(/[^a-zA-Z0-9-]/g, '').toLowerCase()
      const id = `ground-repeat-${safeCell}-${extras.instanceParity}-p${String(index + 1).padStart(2, '0')}`
      const ids = chunks[index]
      packages.push({
        id,
        groupKey: key,
        parity: extras.instanceParity,
        spatialCell: extras.spatialPartition,
        partition: index + 1,
        sourceIds: ids,
        sourcePaths: ids.map((sourceId) => instanceById.get(sourceId).sourcePath),
        centerSortBounds: boundsForPoints(ids.map((sourceId) => pointFor(instanceById, sourceId))),
      })
    }
  }
  packages.sort((left, right) => left.id.localeCompare(right.id))
  assert.equal(new Set(packages.map((pkg) => pkg.id)).size, packages.length)
  const allIds = packages.flatMap((pkg) => pkg.sourceIds).sort((left, right) => left - right)
  assert.deepEqual(allIds, Array.from({ length: LOGICAL_INSTANCE_COUNT }, (_, index) => index))
  assert.ok(packages.every((pkg) => pkg.sourceIds.length <= MAX_INSTANCES_PER_PACKAGE))
  return packages
}

function subsetAccessor(accessor, selectedIndices) {
  const source = accessor.getArray()
  const size = accessor.getElementSize()
  const TargetArray = source.constructor
  const target = new TargetArray(selectedIndices.length * size)
  for (let targetIndex = 0; targetIndex < selectedIndices.length; targetIndex += 1) {
    const sourceOffset = selectedIndices[targetIndex] * size
    target.set(source.subarray(sourceOffset, sourceOffset + size), targetIndex * size)
  }
  accessor.setArray(target)
}

function retainPackage(document, plan, variant, runtimeLevel) {
  const groups = groupsFor(document)
  const retained = groups.get(plan.groupKey)
  assert.ok(retained, `${variant}:${runtimeLevel}:${plan.id} group missing`)
  const originalIds = retained[0].getExtras().sourceIds
  const selectedIndices = plan.sourceIds.map((sourceId) => {
    const index = originalIds.indexOf(sourceId)
    assert.ok(index >= 0, `${plan.id}: source ID ${sourceId} absent from ${plan.groupKey}`)
    return index
  })
  const retainedSet = new Set(retained)
  for (const node of batchNodes(document)) if (!retainedSet.has(node)) node.dispose()

  const touched = new Set()
  for (const node of retained) {
    const extension = node.getExtension('EXT_mesh_gpu_instancing')
    for (const accessor of extension.listAttributes()) {
      if (touched.has(accessor)) continue
      subsetAccessor(accessor, selectedIndices)
      touched.add(accessor)
    }
    node.setExtras({
      ...node.getExtras(),
      sourceIds: [...plan.sourceIds],
      spatialPayloadV2: true,
      spatialPayloadId: plan.id,
      spatialPayloadLevel: runtimeLevel,
      disabledReleaseCandidate: true,
      runtimeIntegrated: false,
    })
  }

  const roots = document.getRoot().listNodes().filter((node) => Array.isArray(node.getExtras()?.iomPackageSourcePaths))
  assert.equal(roots.length, 1, `${plan.id}: expected one package root`)
  const root = roots[0]
  root.setName(`GroundFloorRepeatSpatial:${plan.id}:${variant}:${runtimeLevel}`)
  root.setExtras({
    ...root.getExtras(),
    iomPackageSourcePaths: [...plan.sourcePaths],
    iomPackageSourceIds: [...plan.sourceIds],
    spatialPayloadV2: true,
    spatialPayloadId: plan.id,
    spatialPayloadVariant: variant,
    spatialPayloadLevel: runtimeLevel,
    attachToPersistentOwner: OWNER_NODE,
    containsPersistentOwner: false,
    disabledReleaseCandidate: true,
    runtimeIntegrated: false,
  })
}

function primitiveGeometrySha256(primitive) {
  const hash = createHash('sha256')
  const indices = primitive.getIndices()
  if (indices) hash.update(Buffer.from(indices.getArray().buffer, indices.getArray().byteOffset, indices.getArray().byteLength))
  for (const semantic of primitive.listSemantics().sort()) {
    const accessor = primitive.getAttribute(semantic)
    hash.update(semantic)
    hash.update(accessor.getType())
    hash.update(String(accessor.getComponentType()))
    hash.update(accessor.getNormalized() ? '1' : '0')
    hash.update(Buffer.from(accessor.getArray().buffer, accessor.getArray().byteOffset, accessor.getArray().byteLength))
  }
  return hash.digest('hex')
}

function contentRecords(document) {
  const records = []
  for (const node of batchNodes(document)) {
    const extras = node.getExtras()
    const ids = extras.sourceIds
    const localMatrices = instanceMatrices(node)
    assert.equal(ids.length, localMatrices.length)
    const nodeWorld = new Matrix4().fromArray(node.getWorldMatrix())
    const primitive = node.getMesh()?.listPrimitives()[0]
    assert.ok(primitive)
    const geometrySha256 = primitiveGeometrySha256(primitive)
    const materialSha256 = primitiveMaterialHash(primitive)
    for (let index = 0; index < ids.length; index += 1) {
      const matrix = new Matrix4().multiplyMatrices(nodeWorld, localMatrices[index])
      records.push({
        sourceId: ids[index],
        materialSlot: extras.materialSlot,
        parity: extras.instanceParity,
        matrix: matrix.toArray().map(canonicalNumber),
        geometrySha256,
        materialSha256,
      })
    }
  }
  return records.sort((left, right) => left.sourceId - right.sourceId || left.materialSlot - right.materialSlot)
}

function contentDigest(document) {
  return sha256Bytes(Buffer.from(stableStringify(contentRecords(document))))
}

function emptyBounds() {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
}

function expandBounds(bounds, point) {
  for (let axis = 0; axis < 3; axis += 1) {
    bounds.min[axis] = Math.min(bounds.min[axis], point.getComponent(axis))
    bounds.max[axis] = Math.max(bounds.max[axis], point.getComponent(axis))
  }
}

function exactBounds(document) {
  const bounds = emptyBounds()
  for (const node of batchNodes(document)) {
    const primitive = node.getMesh()?.listPrimitives()[0]
    const position = primitive?.getAttribute('POSITION')
    assert.ok(position, `${node.getName()} lacks POSITION`)
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (let index = 0; index < position.getCount(); index += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        const value = normalizedValue(position, index * 3 + axis)
        min[axis] = Math.min(min[axis], value)
        max[axis] = Math.max(max[axis], value)
      }
    }
    const nodeWorld = new Matrix4().fromArray(node.getWorldMatrix())
    for (const instance of instanceMatrices(node)) {
      const matrix = new Matrix4().multiplyMatrices(nodeWorld, instance)
      for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
        expandBounds(bounds, new Vector3(x, y, z).applyMatrix4(matrix))
      }
    }
  }
  assert.ok(
    bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite),
    `non-finite package bounds: ${JSON.stringify(bounds)}`,
  )
  return {
    space: 'owner-local',
    min: bounds.min.map(canonicalNumber),
    max: bounds.max.map(canonicalNumber),
  }
}

function perSourceBounds(document) {
  const result = new Map()
  for (const node of batchNodes(document)) {
    const primitive = node.getMesh()?.listPrimitives()[0]
    const position = primitive?.getAttribute('POSITION')
    assert.ok(position, `${node.getName()} lacks POSITION`)
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (let index = 0; index < position.getCount(); index += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        const value = normalizedValue(position, index * 3 + axis)
        min[axis] = Math.min(min[axis], value)
        max[axis] = Math.max(max[axis], value)
      }
    }
    const ids = node.getExtras().sourceIds
    const matrices = instanceMatrices(node)
    const nodeWorld = new Matrix4().fromArray(node.getWorldMatrix())
    for (let index = 0; index < ids.length; index += 1) {
      const bounds = result.get(ids[index]) ?? emptyBounds()
      const matrix = new Matrix4().multiplyMatrices(nodeWorld, matrices[index])
      for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
        expandBounds(bounds, new Vector3(x, y, z).applyMatrix4(matrix))
      }
      result.set(ids[index], bounds)
    }
  }
  assert.equal(result.size, LOGICAL_INSTANCE_COUNT)
  return new Map([...result].map(([sourceId, bounds]) => [sourceId, {
    space: 'owner-local',
    min: bounds.min.map(canonicalNumber),
    max: bounds.max.map(canonicalNumber),
  }]))
}

function unionBounds(levels) {
  return {
    space: 'owner-local',
    min: [0, 1, 2].map((axis) => Math.min(...levels.map((level) => level.bounds.min[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...levels.map((level) => level.bounds.max[axis]))),
  }
}


function unionSourceBounds(boundsBySourceId, sourceIds) {
  const bounds = emptyBounds()
  for (const sourceId of sourceIds) {
    const source = boundsBySourceId.get(sourceId)
    assert.ok(source, `Missing planning bounds for source ${sourceId}`)
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], source.min[axis])
      bounds.max[axis] = Math.max(bounds.max[axis], source.max[axis])
    }
  }
  return { space: 'owner-local', min: bounds.min, max: bounds.max }
}

function planningPayloads(plan, planningModels) {
  return plan.map((pkg) => {
    const output = { ...pkg, variants: {} }
    for (const variant of VARIANTS) {
      const levels = {}
      for (const levelSpec of LEVELS[variant]) {
        const model = planningModels[variant][levelSpec.runtimeLevel]
        levels[levelSpec.runtimeLevel] = {
          bounds: unionSourceBounds(model.boundsBySourceId, pkg.sourceIds),
          estimates: {
            triangles: model.trianglesPerInstance * pkg.sourceIds.length,
            draws: MATERIAL_SLOTS,
            bytes: 0,
            encodedTextureBytes: 0,
            gpuTextureBytes: 0,
          },
        }
      }
      output.variants[variant] = { levels, selectionBounds: unionBounds(Object.values(levels)) }
    }
    return output
  })
}

function selectedTriangleTotalAtFocus(packages, variant, focus, mode) {
  let triangles = 0
  for (const pkg of packages) {
    const record = pkg.variants[variant]
    if (contains(record.selectionBounds, focus, mode.lod0)) triangles += record.levels.lod0.estimates.triangles
    else if (record.levels.hlod && contains(record.selectionBounds, focus, mode.hlod)) triangles += record.levels.hlod.estimates.triangles
  }
  return triangles
}

function splitPlanPackage(plan, packageId) {
  const index = plan.findIndex((pkg) => pkg.id === packageId)
  assert.ok(index >= 0, `Adaptive split package missing: ${packageId}`)
  const source = plan[index]
  assert.ok(source.sourceIds.length > 1, `${packageId} is already atomic`)
  const replacements = source.sourceIds.map((sourceId, childIndex) => ({
    ...source,
    id: `${source.id}-s${String(childIndex + 1).padStart(2, '0')}`,
    sourceIds: [sourceId],
    sourcePaths: [source.sourcePaths[source.sourceIds.indexOf(sourceId)]],
    adaptiveParentId: source.id,
    adaptiveChild: childIndex + 1,
  }))
  return [...plan.slice(0, index), ...replacements, ...plan.slice(index + 1)]
    .sort((left, right) => left.id.localeCompare(right.id))
}

function adaptPlanToSpatialBudgets(initialPlan, planningModels) {
  let plan = initialPlan
  const splits = []
  for (let index = 0; index < ADAPTIVE_SPLIT_PACKAGE_IDS.length; index += 1) {
    const packageId = ADAPTIVE_SPLIT_PACKAGE_IDS[index]
    plan = splitPlanPackage(plan, packageId)
    splits.push({ iteration: index + 1, packageId })
  }
  const packages = planningPayloads(plan, planningModels)
  const windows = Object.fromEntries(VARIANTS.map((variant) => [variant, analyzeWindows(packages, variant)]))
  assert.ok(Object.values(windows).every((variant) => variant.passed),
    'Pinned adaptive split schedule no longer passes exact current-source spatial budgets')
  return {
    plan,
    evidence: {
      strategy: 'deterministic 16-split schedule selected by the exact greedy witness search; every rebuild reruns the complete closed-AABB entry/exit/transition sweep against current source pins',
      initialPackageCount: initialPlan.length,
      finalPackageCount: plan.length,
      splitCount: splits.length,
      splits,
      planningWindows: windows,
    },
  }
}

function auditDocument(document, plan, variant, runtimeLevel, expectedContentDigest) {
  assert.equal(document.getRoot().listAnimations().length, 0, `${plan.id}:${variant}:${runtimeLevel} contains animation`)
  assert.equal(document.getRoot().listNodes().filter((node) => node.getName() === OWNER_NODE).length, 0,
    `${plan.id}:${variant}:${runtimeLevel} duplicates persistent owner`)
  assert.equal(document.getRoot().listTextures().length, 0, `${plan.id}:${variant}:${runtimeLevel} unexpectedly embeds textures`)
  const nodes = batchNodes(document)
  assert.equal(nodes.length, MATERIAL_SLOTS)
  assert.deepEqual(nodes.map((node) => node.getExtras().materialSlot).sort(), [0, 1, 2, 3])
  let unsafeLocalMatrices = 0
  let triangles = 0
  const materials = []
  const attributes = []
  for (const node of nodes) {
    const extras = node.getExtras()
    assert.equal(extras.instanceParity, plan.parity)
    assert.equal(extras.spatialPartition, plan.spatialCell)
    assert.equal(extras.spatialPayloadId, plan.id)
    assert.equal(extras.spatialPayloadLevel, runtimeLevel)
    assert.deepEqual(extras.sourceIds, plan.sourceIds)
    const matrices = instanceMatrices(node)
    assert.equal(matrices.length, plan.sourceIds.length)
    unsafeLocalMatrices += matrices.filter((matrix) => matrix.determinant() <= 0).length
    const hostSign = Math.sign(new Matrix4().fromArray(node.getMatrix()).determinant())
    assert.equal(hostSign, plan.parity === 'mirrored' ? -1 : 1)
    const primitive = node.getMesh()?.listPrimitives()[0]
    triangles += triangleCount(primitive) * matrices.length
    materials.push({ slot: extras.materialSlot, name: primitive.getMaterial()?.getName() ?? null, sha256: primitiveMaterialHash(primitive) })
    attributes.push({ slot: extras.materialSlot, contract: attributeContract(primitive) })
  }
  assert.equal(unsafeLocalMatrices, 0)
  const roots = document.getRoot().listNodes().filter((node) => Array.isArray(node.getExtras()?.iomPackageSourcePaths))
  assert.equal(roots.length, 1)
  assert.deepEqual(roots[0].getExtras().iomPackageSourcePaths, plan.sourcePaths)
  assert.deepEqual(roots[0].getExtras().iomPackageSourceIds, plan.sourceIds)
  assert.equal(roots[0].getExtras().attachToPersistentOwner, OWNER_NODE)
  const observedContentDigest = contentDigest(document)
  assert.equal(observedContentDigest, expectedContentDigest, `${plan.id}:${variant}:${runtimeLevel} content digest changed after write`)
  return {
    triangles,
    draws: nodes.length,
    logicalInstances: plan.sourceIds.length,
    primitiveInstances: plan.sourceIds.length * MATERIAL_SLOTS,
    unsafeLocalMatrices,
    bounds: exactBounds(document),
    contentDigestSha256: observedContentDigest,
    materials: materials.sort((left, right) => left.slot - right.slot),
    attributes: attributes.sort((left, right) => left.slot - right.slot),
    textureMemory: { textureCount: 0, encodedTextureBytes: 0, gpuTextureBytes: 0 },
  }
}

function contains(bounds, focus, margin) {
  return bounds.min.every((value, axis) => focus[axis] >= value - margin && focus[axis] <= bounds.max[axis] + margin)
}

function addEstimate(target, estimate) {
  for (const key of METRICS) target[key] += estimate[key]
  return target
}

function emptyEstimate() {
  return Object.fromEntries(METRICS.map((key) => [key, 0]))
}

function compactState(state) {
  return {
    focus: state.focus,
    totals: state.totals,
    packageCount: state.packages.length,
    packages: state.packages,
    transitionPackageId: state.transitionPackageId ?? null,
  }
}

function sweepEvents(items, axis) {
  const events = new Map()
  const add = (coordinate, kind, item) => {
    const event = events.get(coordinate) ?? { coordinate, starts: [], ends: [] }
    event[kind].push(item)
    events.set(coordinate, event)
  }
  for (const item of items) {
    add(item.bounds.min[axis], 'starts', item)
    add(item.bounds.max[axis], 'ends', item)
  }
  return [...events.values()].sort((left, right) => left.coordinate - right.coordinate)
}

function expandedBounds(bounds, margin) {
  return {
    min: bounds.min.map((value) => value - margin),
    max: bounds.max.map((value) => value + margin),
  }
}

function exactTieredSweep({ packages, variant, lod0Margin, hlodMargin = null, transition = false }) {
  const items = []
  for (const pkg of packages) {
    const record = pkg.variants[variant]
    items.push({
      id: `${pkg.id}:base:lod0`,
      packageId: pkg.id,
      kind: 'base',
      level: 'lod0',
      bounds: expandedBounds(record.selectionBounds, lod0Margin),
      estimate: record.levels.lod0.estimates,
    })
    if (hlodMargin !== null && record.levels.hlod) {
      items.push({
        id: `${pkg.id}:base:hlod`,
        packageId: pkg.id,
        kind: 'base',
        level: 'hlod',
        bounds: expandedBounds(record.selectionBounds, hlodMargin),
        estimate: record.levels.hlod.estimates,
      })
    }
    if (transition && record.levels.hlod) {
      items.push({
        id: `${pkg.id}:transition:hlod`,
        packageId: pkg.id,
        kind: 'transition',
        level: 'hlod',
        bounds: expandedBounds(record.selectionBounds, POLICY.marginsMeters.lod0Entry),
        estimate: record.levels.hlod.estimates,
      })
    }
  }

  const worst = Object.fromEntries(METRICS.map((key) => [key, null]))
  let focusCount = 0
  const evaluate = (active, focus) => {
    focusCount += 1
    const selected = new Map()
    const transitions = []
    for (const item of active) {
      if (item.kind === 'transition') {
        transitions.push(item)
        continue
      }
      const previous = selected.get(item.packageId)
      if (!previous || item.level === 'lod0') selected.set(item.packageId, item)
    }
    const base = emptyEstimate()
    const activeLabels = [...selected.values()]
      .sort((left, right) => left.packageId.localeCompare(right.packageId))
      .map((item) => `${item.packageId}:${item.level}`)
    for (const item of selected.values()) addEstimate(base, item.estimate)
    for (const key of METRICS) {
      let extra = 0
      let transitionPackageId = null
      for (const item of transitions) {
        if (item.estimate[key] > extra ||
          (item.estimate[key] === extra && item.packageId.localeCompare(transitionPackageId ?? '') < 0)) {
          extra = item.estimate[key]
          transitionPackageId = item.packageId
        }
      }
      const totals = { ...base, [key]: base[key] + extra }
      if (!worst[key] || totals[key] > worst[key].totals[key]) {
        worst[key] = {
          focus: [...focus],
          totals,
          packages: activeLabels,
          transitionPackageId,
        }
      }
    }
  }

  const scanZ = (candidates, x, y) => {
    const active = new Set()
    for (const event of sweepEvents(candidates, 2)) {
      for (const item of event.starts) active.add(item)
      evaluate(active, [x, y, event.coordinate])
      for (const item of event.ends) active.delete(item)
    }
  }
  const scanY = (candidates, x) => {
    const active = new Set()
    for (const event of sweepEvents(candidates, 1)) {
      for (const item of event.starts) active.add(item)
      scanZ(active, x, event.coordinate)
      for (const item of event.ends) active.delete(item)
    }
  }
  const active = new Set()
  let xEvents = 0
  for (const event of sweepEvents(items, 0)) {
    for (const item of event.starts) active.add(item)
    xEvents += 1
    scanY(active, event.coordinate)
    for (const item of event.ends) active.delete(item)
  }
  return { worst, focusCount, xEvents }
}

/**
 * Exact closed-AABB sweep of the runtime's tier priority. Exit analysis is the
 * exact independent-latch upper envelope: LOD0 is selected wherever its exit
 * envelope contains focus, otherwise HLOD uses its exit envelope.
 */
function analyzeWindows(packages, variant) {
  const hasHlod = variant === 'web'
  const analyses = {}
  const modes = [
    { id: 'entry', lod0: POLICY.marginsMeters.lod0Entry, hlod: POLICY.marginsMeters.hlodEntry },
    { id: 'exitUpperEnvelope', lod0: POLICY.marginsMeters.lod0Exit, hlod: POLICY.marginsMeters.hlodExit },
  ]
  for (const mode of modes) {
    const sweep = exactTieredSweep({
      packages,
      variant,
      lod0Margin: mode.lod0,
      hlodMargin: hasHlod ? mode.hlod : null,
    })
    const worst = sweep.worst
    const budget = POLICY.hardBudgets.resident[variant]
    analyses[mode.id] = {
      marginsMeters: { lod0: mode.lod0, hlod: hasHlod ? mode.hlod : null },
      exactClosedAabbSweep: true,
      independentLatchUpperEnvelope: mode.id === 'exitUpperEnvelope',
      focusCount: sweep.focusCount,
      xEvents: sweep.xEvents,
      worstByMetric: Object.fromEntries(METRICS.map((key) => [key, compactState(worst[key])])),
      budget: Object.fromEntries(METRICS.map((key) => [key, {
        value: worst[key].totals[key],
        limit: budget[key],
        passed: worst[key].totals[key] <= budget[key],
      }])),
    }
    analyses[mode.id].passed = Object.values(analyses[mode.id].budget).every((metric) => metric.passed)
  }

  // The loader retires out-of-window packages before loading incoming ones.
  // The only load-before-retire overlap for this fragment is a Web HLOD->LOD0
  // swap inside one package. Evaluate the exact closed-AABB upper envelope at
  // every event coordinate and add that one retained HLOD payload.
  const transitionSweep = exactTieredSweep({
    packages,
    variant,
    lod0Margin: POLICY.marginsMeters.lod0Exit,
    hlodMargin: hasHlod ? POLICY.marginsMeters.hlodExit : null,
    transition: hasHlod,
  })
  const worst = transitionSweep.worst
  const peakBudget = POLICY.hardBudgets.transitionPeak[variant]
  analyses.loadBeforeRetirePeak = {
    exactClosedAabbSweep: true,
    runtimeOrdering: 'out-of-window packages retire first; only an HLOD-to-LOD0 same-package swap overlaps on Web',
    focusCount: transitionSweep.focusCount,
    xEvents: transitionSweep.xEvents,
    worstByMetric: Object.fromEntries(METRICS.map((key) => [key, compactState(worst[key])])),
    budget: Object.fromEntries(METRICS.map((key) => [key, {
      value: worst[key].totals[key],
      limit: peakBudget[key],
      passed: worst[key].totals[key] <= peakBudget[key],
    }])),
  }
  analyses.loadBeforeRetirePeak.passed = Object.values(analyses.loadBeforeRetirePeak.budget).every((metric) => metric.passed)
  analyses.passed = analyses.entry.passed && analyses.exitUpperEnvelope.passed && analyses.loadBeforeRetirePeak.passed
  return analyses
}

function buildManifestFragment(index) {
  return {
    schema: 'IOM_GROUND_REPEAT_SPATIAL_MANIFEST_V3_FRAGMENT',
    version: 2,
    enabled: false,
    ready: false,
    runtimeIntegrated: false,
    activationApproved: false,
    productionManifestChanged: false,
    productionRoutingChanged: false,
    ownerId: OWNER_ID,
    ownerNodeName: OWNER_NODE,
    policy: index.policy,
    packages: index.packages.map((pkg) => ({
      id: pkg.id,
      kind: 'detail',
      residency: 'streamed',
      ownerId: OWNER_ID,
      transform: { space: 'owner-local', matrix: IDENTITY },
      selectionBounds: Object.fromEntries(VARIANTS.map((variant) => [variant, pkg.variants[variant].selectionBounds])),
      streaming: {
        lod0MarginMeters: POLICY.marginsMeters.lod0Entry,
        lod0ExitMarginMeters: POLICY.marginsMeters.lod0Exit,
        hlodMarginMeters: POLICY.marginsMeters.hlodEntry,
        hlodExitMarginMeters: POLICY.marginsMeters.hlodExit,
      },
      semanticRoles: ['ground-floor-repeat-chair-table'],
      sourcePaths: Object.fromEntries(VARIANTS.map((variant) => [variant, pkg.sourcePaths])),
      requiredAttributes: ['POSITION', 'NORMAL'],
      variants: Object.fromEntries(VARIANTS.map((variant) => [variant,
        Object.fromEntries(Object.entries(pkg.variants[variant].levels).map(([level, payload]) => [level, {
          url: payload.asset.path,
          sha256: payload.asset.sha256,
          estimates: payload.estimates,
          bounds: payload.bounds,
        }]))])),
    })),
    unresolvedWholeLayerRequirements: [
      'Compose these disjoint source paths exactly once with all other Phase A owners and __unowned__ static payloads.',
      'Reserve shell, rig, animated owners, migrated fire-safety payload, and unowned-static windows in the same resident/peak budgets.',
      'Pass physical Web and Quest-class frame-time and memory acceptance before activation.',
    ],
  }
}

function levelTotals(packages) {
  const result = { web: {}, quest: {} }
  for (const variant of VARIANTS) {
    for (const level of variant === 'web' ? ['lod0', 'hlod'] : ['lod0']) {
      const payloads = packages.map((pkg) => ({ pkg, payload: pkg.variants[variant].levels[level] }))
      const ids = payloads.flatMap(({ pkg }) => pkg.sourceIds).sort((left, right) => left - right)
      result[variant][level] = {
        payloadCount: payloads.length,
        logicalInstances: ids.length,
        primitiveInstances: ids.length * MATERIAL_SLOTS,
        sourceIdsSha256: sha256Bytes(Buffer.from(stableStringify(ids))),
        triangles: payloads.reduce((sum, { payload }) => sum + payload.estimates.triangles, 0),
        draws: payloads.reduce((sum, { payload }) => sum + payload.estimates.draws, 0),
        glbBytes: payloads.reduce((sum, { payload }) => sum + payload.asset.bytes, 0),
        encodedTextureBytes: payloads.reduce((sum, { payload }) => sum + payload.estimates.encodedTextureBytes, 0),
        gpuTextureBytes: payloads.reduce((sum, { payload }) => sum + payload.estimates.gpuTextureBytes, 0),
      }
    }
  }
  return result
}

function reportMarkdown(index) {
  const rows = []
  for (const variant of VARIANTS) {
    const windows = index.residentWindows[variant]
    rows.push(`| ${variant} | entry | ${windows.entry.budget.triangles.value.toLocaleString('en-US')} | ${windows.entry.budget.draws.value.toLocaleString('en-US')} | ${windows.entry.passed ? 'pass' : 'FAIL'} |`)
    rows.push(`| ${variant} | exit upper envelope | ${windows.exitUpperEnvelope.budget.triangles.value.toLocaleString('en-US')} | ${windows.exitUpperEnvelope.budget.draws.value.toLocaleString('en-US')} | ${windows.exitUpperEnvelope.passed ? 'pass' : 'FAIL'} |`)
    rows.push(`| ${variant} | load-before-retire peak | ${windows.loadBeforeRetirePeak.budget.triangles.value.toLocaleString('en-US')} | ${windows.loadBeforeRetirePeak.budget.draws.value.toLocaleString('en-US')} | ${windows.loadBeforeRetirePeak.passed ? 'pass' : 'FAIL'} |`)
  }
  return `# Ground Floor repeat spatial payload v2\n\n` +
    `Status: **${index.gates.spatialResidentAndPeakBudgets ? 'disabled candidate passes isolated-family spatial budgets' : 'disabled candidate is fail-closed by spatial budgets'}**. Production assets and routes are unchanged.\n\n` +
    `The exact 78 logical chair/table instances (four material primitives each, 312 primitive-instance ownership records) are split into ${index.packageCount} parity-safe spatial packages. Every package contains at most ${MAX_INSTANCES_PER_PACKAGE} logical instances, so Web LOD0 stays below the manifest-v3 250k detail cap.\n\n` +
    `| Variant | Window | Worst submitted triangles | Draws at triangle witness | Isolated-family result |\n|---|---|---:|---:|---|\n${rows.join('\n')}\n\n` +
    `Web uses the conservative mid payload only because the pinned seven-view Blender approval passes and the v2 composite content digest exactly matches the approved v1 mid payload. Quest has no mid payload: its simplifier produced zero saving, so the candidate fails closed to exact LOD0.\n\n` +
    `Physical evidence includes emitted GLB bytes, zero encoded/decoded texture residency (the source family is textureless), exact owner-local bounds, source-ID bijections, positive per-instance determinants, parity-homogeneous hosts, material/attribute pins, and composite equivalence hashes.\n\n` +
    `This isolated pass is not activation approval. The whole-layer shell, rig, five animated owners, migrated fire-safety payload, and unowned-static windows still need to share these budgets, followed by physical Web/Quest performance acceptance.\n\n` +
    `Rebuild and audit with \`npm run test:repeat-spatial-v2\`. Evidence is in \`tmp/repeat-spatial-payload-v2/\`.\n`
}

export function validateRepeatSpatialV2Index(index) {
  const errors = []
  const gate = (condition, message) => { if (!condition) errors.push(message) }
  gate(index?.schema === 'IOM_GROUND_REPEAT_SPATIAL_PAYLOAD_V2' && index?.version === 2, 'schema/version mismatch')
  gate(index?.enabled === false && index?.ready === false && index?.runtimeIntegrated === false && index?.activationApproved === false,
    'candidate must remain disabled and not runtime-integrated')
  gate(index?.productionManifestChanged === false && index?.productionRoutingChanged === false,
    'production mutation flags must remain false')
  gate(index?.owner?.id === OWNER_ID && index?.owner?.nodeName === OWNER_NODE, 'owner attachment contract changed')
  gate(Array.isArray(index?.packages) && index.packages.length > 0, 'packages missing')
  if (!Array.isArray(index?.packages)) return errors
  gate(index.packageCount === index.packages.length, 'package count mismatch')
  gate(new Set(index.packages.map((pkg) => pkg.id)).size === index.packages.length, 'duplicate package ID')
  const logicalIds = []
  for (const pkg of index.packages) {
    gate(Array.isArray(pkg.sourceIds) && pkg.sourceIds.length > 0 && pkg.sourceIds.length <= MAX_INSTANCES_PER_PACKAGE,
      `${pkg.id}: invalid source ID count`)
    if (Array.isArray(pkg.sourceIds)) logicalIds.push(...pkg.sourceIds)
    gate(pkg.parity === 'positive' || pkg.parity === 'mirrored', `${pkg.id}: invalid parity`)
    gate(Array.isArray(pkg.sourcePaths) && pkg.sourcePaths.length === pkg.sourceIds?.length, `${pkg.id}: source path mismatch`)
    for (const variant of VARIANTS) {
      const record = pkg.variants?.[variant]
      gate(Boolean(record?.selectionBounds), `${pkg.id}:${variant}: missing selection bounds`)
      const expectedLevels = variant === 'web' ? ['hlod', 'lod0'] : ['lod0']
      gate(stableStringify(Object.keys(record?.levels ?? {}).sort()) === stableStringify(expectedLevels),
        `${pkg.id}:${variant}: selectable level set changed`)
      for (const [level, payload] of Object.entries(record?.levels ?? {})) {
        gate(/^[a-f0-9]{64}$/.test(payload.asset?.sha256 ?? ''), `${pkg.id}:${variant}:${level}: bad hash`)
        gate(Number.isSafeInteger(payload.asset?.bytes) && payload.asset.bytes > 0, `${pkg.id}:${variant}:${level}: bad byte pin`)
        gate(payload.estimates?.triangles <= POLICY.maxDetailTriangles, `${pkg.id}:${variant}:${level}: detail triangle cap exceeded`)
        gate(payload.estimates?.draws === MATERIAL_SLOTS, `${pkg.id}:${variant}:${level}: draw count changed`)
        gate(payload.estimates?.encodedTextureBytes === 0 && payload.estimates?.gpuTextureBytes === 0,
          `${pkg.id}:${variant}:${level}: texture residency changed`)
        gate(payload.audit?.unsafeLocalMatrices === 0, `${pkg.id}:${variant}:${level}: unsafe local matrix`)
        gate(payload.audit?.primitiveInstances === pkg.sourceIds.length * MATERIAL_SLOTS,
          `${pkg.id}:${variant}:${level}: primitive-instance ownership mismatch`)
      }
      gate(!record?.levels?.hlod || variant === 'web', `${pkg.id}: Quest HLOD must remain excluded`)
    }
  }
  logicalIds.sort((left, right) => left - right)
  gate(stableStringify(logicalIds) === stableStringify(Array.from({ length: LOGICAL_INSTANCE_COUNT }, (_, index) => index)),
    'logical source ownership is not an exact 0..77 bijection')
  gate(index?.ownership?.logicalInstances === LOGICAL_INSTANCE_COUNT && index?.ownership?.primitiveInstances === LOGICAL_INSTANCE_COUNT * MATERIAL_SLOTS,
    'ownership totals changed')
  gate(index?.levelTotals?.web?.lod0?.logicalInstances === LOGICAL_INSTANCE_COUNT &&
    index?.levelTotals?.web?.lod0?.primitiveInstances === LOGICAL_INSTANCE_COUNT * MATERIAL_SLOTS &&
    index?.levelTotals?.web?.lod0?.triangles === 4_778_982,
  'Web near LOD0 coverage changed')
  gate(index?.levelTotals?.quest?.lod0?.logicalInstances === LOGICAL_INSTANCE_COUNT &&
    index?.levelTotals?.quest?.lod0?.primitiveInstances === LOGICAL_INSTANCE_COUNT * MATERIAL_SLOTS &&
    index?.levelTotals?.quest?.lod0?.triangles === 1_711_398,
  'Quest near LOD0 coverage changed')
  gate(index?.levelTotals?.web?.hlod?.logicalInstances === LOGICAL_INSTANCE_COUNT &&
    index?.levelTotals?.web?.hlod?.primitiveInstances === LOGICAL_INSTANCE_COUNT * MATERIAL_SLOTS &&
    index?.levelTotals?.web?.hlod?.triangles === 3_810_534,
  'Web approved mid coverage changed')
  gate(index?.gates?.compositeContentExact === true, 'composite content equivalence gate failed')
  gate(index?.gates?.webMidVisualApprovalPinned === true, 'Web mid visual approval pin failed')
  gate(index?.gates?.questMidExcludedNoSaving === true, 'Quest zero-saving mid exclusion failed')
  gate(index?.gates?.spatialResidentAndPeakBudgets === true, 'spatial resident/peak gate failed')
  for (const variant of VARIANTS) {
    const windows = index?.residentWindows?.[variant]
    gate(windows?.entry?.passed === true, `${variant}: entry budget failed`)
    gate(windows?.exitUpperEnvelope?.passed === true, `${variant}: exit budget failed`)
    gate(windows?.loadBeforeRetirePeak?.passed === true, `${variant}: transition peak failed`)
  }
  return errors
}

function assertSafeOutput(out) {
  const tmpRoot = resolve(VIEWER_ROOT, 'tmp')
  const resolvedOut = resolve(out)
  assert.ok(resolvedOut.startsWith(`${tmpRoot}${sep}`), 'output must stay below building-viewer/tmp')
  assert.notEqual(resolvedOut, tmpRoot, 'output may not be the tmp root')
}

async function main() {
  const args = parseArgs(process.argv)
  assertSafeOutput(args.out)
  const [sourceReportRaw, sourceManifestRaw, instanceMapRaw, visualApprovalRaw] = await Promise.all([
    readFile(resolve(args.source, 'report.json')),
    readFile(resolve(args.source, 'manifest.disabled.json')),
    readFile(args.instanceMap),
    readFile(args.visualApproval),
  ])
  const sourceReport = JSON.parse(sourceReportRaw)
  const sourceManifest = JSON.parse(sourceManifestRaw)
  const instanceMap = JSON.parse(instanceMapRaw)
  const visualApproval = JSON.parse(visualApprovalRaw)
  assert.equal(sourceReport.enabled, false)
  assert.equal(sourceManifest.enabled, false)
  assert.equal(instanceMap.instances.length, LOGICAL_INSTANCE_COUNT)
  assert.equal(visualApproval.status, 'passed', 'Web mid visual approval is not passed')
  assert.equal(visualApproval.manualReview?.result, 'passed-at-intended-switch-distance')
  const midComparisons = visualApproval.comparisons.filter((entry) => entry.level === 'mid')
  assert.equal(midComparisons.length, 7)
  assert.ok(midComparisons.every((entry) => Object.values(entry.checks).every(Boolean)))
  const questLod0 = sourceReport.payloads.quest.find((payload) => payload.level === 'lod0')
  const questMid = sourceReport.payloads.quest.find((payload) => payload.level === 'lod1-mid')
  assert.equal(questMid.selectable, false)
  assert.equal(questMid.expandedTriangles, questLod0.expandedTriangles,
    'Quest mid exclusion must remain a zero-saving fallback')

  await rm(args.out, { recursive: true, force: true })
  await mkdir(resolve(args.out, 'payloads'), { recursive: true })
  const io = await createGltfIO({ encoder: true })
  const baselineWeb = await io.read(resolve(args.source, 'payloads', 'web', 'ground-floor-repeat-lod0.glb'))
  const initialPlan = makePlan(baselineWeb, instanceMap)
  const planningModels = { web: {}, quest: {} }
  for (const variant of VARIANTS) {
    for (const levelSpec of LEVELS[variant]) {
      const sourceFile = resolve(args.source, 'payloads', variant, `ground-floor-repeat-${levelSpec.sourceLevel}.glb`)
      const document = await io.read(sourceFile)
      const firstGroup = [...groupsFor(document).values()][0]
      const trianglesPerInstance = firstGroup.reduce((sum, node) =>
        sum + triangleCount(node.getMesh().listPrimitives()[0]), 0)
      planningModels[variant][levelSpec.runtimeLevel] = {
        trianglesPerInstance,
        boundsBySourceId: perSourceBounds(document),
      }
    }
  }
  const adaptive = adaptPlanToSpatialBudgets(initialPlan, planningModels)
  const plan = adaptive.plan
  const outputPackages = plan.map((pkg) => ({ ...pkg, variants: {} }))
  const baselineDigests = {}

  for (const variant of VARIANTS) {
    baselineDigests[variant] = {}
    for (const levelSpec of LEVELS[variant]) {
      const sourceFile = resolve(args.source, 'payloads', variant, `ground-floor-repeat-${levelSpec.sourceLevel}.glb`)
      const baselineDocument = await io.read(sourceFile)
      const baselineRecords = contentRecords(baselineDocument)
      assert.equal(baselineRecords.length, LOGICAL_INSTANCE_COUNT * MATERIAL_SLOTS)
      const baselineDigest = sha256Bytes(Buffer.from(stableStringify(baselineRecords)))
      baselineDigests[variant][levelSpec.runtimeLevel] = {
        sourceLevel: levelSpec.sourceLevel,
        contentDigestSha256: baselineDigest,
        sourceAsset: {
          path: relative(args.out, sourceFile).replaceAll('\\', '/'),
          bytes: (await stat(sourceFile)).size,
          sha256: await sha256File(sourceFile),
        },
      }
      const compositeRecords = []
      for (const target of outputPackages) {
        const document = await io.read(sourceFile)
        retainPackage(document, target, variant, levelSpec.runtimeLevel)
        await document.transform(prune({ keepAttributes: true, keepIndices: true, keepExtras: true }))
        const outputDir = resolve(args.out, 'payloads', variant, levelSpec.runtimeLevel)
        await mkdir(outputDir, { recursive: true })
        const outputFile = resolve(outputDir, `${target.id}.glb`)
        const expectedDigest = contentDigest(document)
        await io.write(outputFile, document)
        const written = await io.read(outputFile)
        const audit = auditDocument(written, target, variant, levelSpec.runtimeLevel, expectedDigest)
        compositeRecords.push(...contentRecords(written))
        const file = await stat(outputFile)
        const asset = {
          path: relative(args.out, outputFile).replaceAll('\\', '/'),
          bytes: file.size,
          sha256: await sha256File(outputFile),
        }
        const variantRecord = target.variants[variant] ?? { levels: {} }
        variantRecord.levels[levelSpec.runtimeLevel] = {
          sourceLevel: levelSpec.sourceLevel,
          role: levelSpec.role,
          asset,
          bounds: audit.bounds,
          estimates: {
            triangles: audit.triangles,
            draws: audit.draws,
            bytes: asset.bytes,
            encodedTextureBytes: audit.textureMemory.encodedTextureBytes,
            gpuTextureBytes: audit.textureMemory.gpuTextureBytes,
          },
          audit,
        }
        target.variants[variant] = variantRecord
      }
      compositeRecords.sort((left, right) => left.sourceId - right.sourceId || left.materialSlot - right.materialSlot)
      const compositeDigest = sha256Bytes(Buffer.from(stableStringify(compositeRecords)))
      assert.equal(compositeDigest, baselineDigest, `${variant}:${levelSpec.runtimeLevel} composite differs from v1`)
      baselineDigests[variant][levelSpec.runtimeLevel].compositeDigestSha256 = compositeDigest
      baselineDigests[variant][levelSpec.runtimeLevel].exact = true
    }
  }

  for (const pkg of outputPackages) {
    for (const variant of VARIANTS) {
      pkg.variants[variant].selectionBounds = unionBounds(Object.values(pkg.variants[variant].levels))
    }
  }
  const residentWindows = Object.fromEntries(VARIANTS.map((variant) => [variant, analyzeWindows(outputPackages, variant)]))
  const totalPayloadBytes = outputPackages.reduce((sum, pkg) => sum + VARIANTS.reduce((variantSum, variant) =>
    variantSum + Object.values(pkg.variants[variant].levels).reduce((levelSum, level) => levelSum + level.asset.bytes, 0), 0), 0)
  const index = {
    schema: 'IOM_GROUND_REPEAT_SPATIAL_PAYLOAD_V2',
    version: 2,
    enabled: false,
    ready: false,
    runtimeIntegrated: false,
    activationApproved: false,
    productionManifestChanged: false,
    productionRoutingChanged: false,
    modelId: 'icm-anim-2025',
    owner: { id: OWNER_ID, nodeName: OWNER_NODE, attachmentSpace: 'owner-local', transform: IDENTITY },
    source: {
      report: { path: relative(args.out, resolve(args.source, 'report.json')).replaceAll('\\', '/'), bytes: sourceReportRaw.length, sha256: sha256Bytes(sourceReportRaw) },
      manifest: { path: relative(args.out, resolve(args.source, 'manifest.disabled.json')).replaceAll('\\', '/'), bytes: sourceManifestRaw.length, sha256: sha256Bytes(sourceManifestRaw) },
      instanceMap: { path: relative(args.out, args.instanceMap).replaceAll('\\', '/'), bytes: instanceMapRaw.length, sha256: sha256Bytes(instanceMapRaw) },
      productionPins: {
        web: sourceReport.production.web.sha256,
        quest: sourceReport.production.quest.sha256,
      },
    },
    visualApproval: {
      path: relative(args.out, args.visualApproval).replaceAll('\\', '/'),
      bytes: visualApprovalRaw.length,
      sha256: sha256Bytes(visualApprovalRaw),
      status: visualApproval.status,
      approvedMidViews: midComparisons.map((entry) => entry.view).sort(),
      manualResult: visualApproval.manualReview.result,
    },
    policy: POLICY,
    adaptivePlanning: adaptive.evidence,
    packageCount: outputPackages.length,
    maxLogicalInstancesPerPackage: Math.max(...outputPackages.map((pkg) => pkg.sourceIds.length)),
    ownership: {
      logicalInstances: LOGICAL_INSTANCE_COUNT,
      materialSlots: MATERIAL_SLOTS,
      primitiveInstances: LOGICAL_INSTANCE_COUNT * MATERIAL_SLOTS,
      sourceIdsSha256: sha256Bytes(Buffer.from(stableStringify(Array.from({ length: LOGICAL_INSTANCE_COUNT }, (_, index) => index)))),
      sourcePathsSha256: sha256Bytes(Buffer.from(stableStringify(instanceMap.instances
        .sort((left, right) => left.sourceIndex - right.sourceIndex).map((entry) => entry.sourcePath)))),
    },
    baselineComposite: baselineDigests,
    packages: outputPackages,
    levelTotals: levelTotals(outputPackages),
    residentWindows,
    physicalTotals: { payloadCount: outputPackages.length * 3, glbBytes: totalPayloadBytes, encodedTextureBytes: 0, gpuTextureBytes: 0 },
    gates: {
      failClosed: true,
      exactLogicalSourceBijection: true,
      exactPrimitiveInstanceOwnership: true,
      perVariantCorrespondence: true,
      boundedInstancesPerPackage: true,
      perPayloadDetailTriangleCap: outputPackages.every((pkg) => VARIANTS.every((variant) =>
        Object.values(pkg.variants[variant].levels).every((payload) => payload.estimates.triangles <= POLICY.maxDetailTriangles))),
      positiveInstanceDeterminants: outputPackages.every((pkg) => VARIANTS.every((variant) =>
        Object.values(pkg.variants[variant].levels).every((payload) => payload.audit.unsafeLocalMatrices === 0))),
      parityHomogeneousPackages: true,
      materialsAndAttributesExact: true,
      compositeContentExact: Object.values(baselineDigests).every((variant) => Object.values(variant).every((level) => level.exact)),
      webMidVisualApprovalPinned: true,
      questMidExcludedNoSaving: true,
      physicalGlbBytesAndTextureResidency: true,
      spatialResidentAndPeakBudgets: Object.values(residentWindows).every((variant) => variant.passed),
      physicalHardwarePerformance: false,
      wholeLayerCombinedBudget: false,
    },
    blockers: [
      'This isolated-family budget pass does not reserve the structural shell, persistent rig, animated owners, migrated fire-safety payload, or unowned-static packages.',
      'The disabled fragment is not wired to production runtime routing.',
      'Physical Web and Quest-class performance acceptance remains required.',
    ],
  }
  index.reproducibilityDigestSha256 = sha256Bytes(Buffer.from(stableStringify({
    source: index.source,
    visualApproval: index.visualApproval,
    policy: index.policy,
    packages: index.packages,
    levelTotals: index.levelTotals,
    residentWindows: index.residentWindows,
    physicalTotals: index.physicalTotals,
    gates: index.gates,
  })))
  for (const variant of VARIANTS) {
    const windows = residentWindows[variant]
    console.log(
      `preflight ${variant}: entry=${windows.entry.budget.triangles.value}, ` +
      `exit=${windows.exitUpperEnvelope.budget.triangles.value}, ` +
      `peak=${windows.loadBeforeRetirePeak.budget.triangles.value}`,
    )
    console.log(`  exit witness ${JSON.stringify(windows.exitUpperEnvelope.worstByMetric.triangles)}`)
  }
  const contractErrors = validateRepeatSpatialV2Index(index)
  assert.deepEqual(contractErrors, [], contractErrors.join('\n'))

  const manifest = buildManifestFragment(index)
  const handoff = {
    schema: 'IOM_GROUND_REPEAT_SPATIAL_VISUAL_QA_HANDOFF_V2',
    version: 2,
    status: 'ready-for-final-composite-review',
    productionActivationApproved: false,
    pinnedApproval: index.visualApproval,
    exactCompositeEquivalence: index.baselineComposite,
    views: ['front', 'back', 'left', 'right', 'top', 'bottom', 'grazing'],
    instructions: [
      'Load every package for one variant/level beneath Ground Floor._anim1 using identity package transforms.',
      'Compare against the pinned v1 payload from the same baselineComposite record.',
      'Use the seven pinned opposing-angle cameras and require no new face holes, parity inversions, or material discontinuities.',
      'Web HLOD is eligible only at the approved distant switch framing; Quest remains exact LOD0.',
    ],
    automatedGate: 'Exact composite sourceId/materialSlot/geometry/material/owner-local-matrix records match v1 for Web LOD0, Web approved mid, and Quest exact LOD0.',
  }
  const audit = {
    schema: 'IOM_GROUND_REPEAT_SPATIAL_PHYSICAL_AUDIT_V2',
    version: 2,
    status: 'PASS',
    ready: false,
    activationApproved: false,
    contractErrors,
    packageCount: index.packageCount,
    payloadCount: index.physicalTotals.payloadCount,
    ownership: index.ownership,
    levelTotals: index.levelTotals,
    baselineComposite: index.baselineComposite,
    residentWindows: index.residentWindows,
    gates: index.gates,
    reproducibilityDigestSha256: index.reproducibilityDigestSha256,
  }
  const indexText = `${JSON.stringify(index, null, 2)}\n`
  await writeFile(resolve(args.out, 'index.json'), indexText)
  audit.index = {
    path: 'index.json',
    bytes: Buffer.byteLength(indexText),
    sha256: sha256Bytes(Buffer.from(indexText)),
    reproducibilityDigestSha256: index.reproducibilityDigestSha256,
  }
  await Promise.all([
    writeFile(resolve(args.out, 'manifest-v3-fragment.disabled.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(resolve(args.out, 'physical-audit.json'), `${JSON.stringify(audit, null, 2)}\n`),
    writeFile(resolve(args.out, 'visual-qa-handoff.json'), `${JSON.stringify(handoff, null, 2)}\n`),
    writeFile(resolve(args.out, 'README.md'), reportMarkdown(index)),
  ])
  console.log(`Ground repeat spatial v2: ${index.gates.spatialResidentAndPeakBudgets ? 'PASS (disabled)' : 'FAIL (disabled)'}`)
  console.log(`  ${index.packageCount} packages / ${index.physicalTotals.payloadCount} physical GLBs / ${index.physicalTotals.glbBytes.toLocaleString()} bytes`)
  for (const variant of VARIANTS) {
    const windows = residentWindows[variant]
    console.log(`  ${variant}: entry ${windows.entry.budget.triangles.value.toLocaleString()} tris; exit ${windows.exitUpperEnvelope.budget.triangles.value.toLocaleString()}; peak ${windows.loadBeforeRetirePeak.budget.triangles.value.toLocaleString()}`)
  }
  console.log(`  evidence=${relative(VIEWER_ROOT, resolve(args.out, 'index.json')).replaceAll('\\', '/')}`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((error) => {
    console.error(error?.stack || error)
    process.exitCode = 1
  })
}
