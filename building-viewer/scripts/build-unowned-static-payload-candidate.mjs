/**
 * Emit the planned __unowned__ static packages as disabled, self-contained
 * Web/Quest GLBs. The output is evidence under building-viewer/tmp only; this
 * script never edits public assets, manifests, routes, or runtime source.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document } from '@gltf-transform/core'
import { EXTMeshoptCompression } from '@gltf-transform/extensions'
import {
  copyToDocument,
  createDefaultPropertyResolver,
  getTextureColorSpace,
  listTextureInfo,
  prune,
  unpartition,
} from '@gltf-transform/functions'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const DEFAULT_PLAN = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v1', 'unowned-static-partition-plan-v1.json')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-payload-candidate-v1')
const VARIANTS = Object.freeze(['web', 'quest'])
const OWNER = '__unowned__'
const ID_PATTERN = /^owner\/__unowned__\/node\/scene\/0\/(\d+)\/primitive\/(\d+)\/instance\/(\d+)$/
const GEOMETRY_TRANSPORT_COMPRESSION = Object.freeze({
  extension: 'EXT_meshopt_compression',
  required: true,
  encoderMethod: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
  preQuantizationApplied: false,
  filterTransformApplied: false,
  reorderTransformApplied: false,
  simplificationApplied: false,
  decodedVertexAccessorByteIdentityAuditRequired: true,
  decodedOrientedTriangleMultisetIdentityAuditRequired: true,
  decodedIndexOrderPreservationRequired: false,
})
const SHARED_TEXTURE_RESIDENCY = Object.freeze({
  metadataVersion: 1,
  metadataProperty: 'images[*].extras.iomSharedTexture',
  identity: 'exact-embedded-image-sha256',
  compatibility: 'content-hash-plus-sampler-uv-transform-flipy-and-color-space',
  runtimeRegistryRequired: 'SharedTextureResidencyRegistry',
  networkExternalization: false,
})

export function parseArgs(argv) {
  const args = { planPath: DEFAULT_PLAN, out: DEFAULT_OUT, force: false, packageId: null, skipReview: false }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--plan') args.planPath = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--out') args.out = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--package') args.packageId = argv[++index]
    else if (value === '--force') args.force = true
    else if (value === '--skip-review') args.skipReview = true
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function fileRecord(path) {
  const bytes = await readFile(path)
  return { bytes: bytes.length, sha256: sha256(bytes) }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]))
  }
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), 'Non-finite number cannot be serialized')
    if (Object.is(value, -0)) return 0
    return Number(value.toPrecision(12))
  }
  return value
}

function stableSha256(value) {
  return sha256(JSON.stringify(stableValue(value)))
}

function planStableValue(value) {
  if (Array.isArray(value)) return value.map(planStableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, planStableValue(child)]))
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    if (Object.is(value, -0)) return 0
    return Number(value.toPrecision(9))
  }
  return value
}

function planStableSha256(value) {
  return sha256(JSON.stringify(planStableValue(value)))
}

function planDigestSha256(plan) {
  const value = structuredClone(plan)
  delete value.planDigestSha256
  return planStableSha256(value)
}

function stringListSha256(values) {
  return sha256(JSON.stringify([...values].sort()))
}

function semanticStaticMapping(plan) {
  const mapping = plan.version === 2
    ? plan.correspondence?.inheritedV1?.semanticStaticMapping
    : plan.correspondence?.semanticStaticMapping
  assert.ok(mapping && typeof mapping === 'object', `v${plan.version}: inherited semantic static mapping is missing`)
  assert.equal(typeof mapping.policy, 'string', `v${plan.version}: semantic mapping policy is missing`)
  assert.match(mapping.primitiveMappingsSha256 || '', /^[a-f0-9]{64}$/,
    `v${plan.version}: semantic primitive mapping digest is missing`)
  assert.equal(mapping.primitiveMappingsSha256, planStableSha256(mapping.primitiveMappings || []),
    `v${plan.version}: semantic primitive mapping digest is stale`)
  return mapping
}

function repeatUnitIds(plan, variant) {
  return (plan.repeatCandidate?.variants?.[variant]?.batches || []).flatMap((batch) => batch.sourceUnitIds || [])
}

function fireUnitIds(plan, variant) {
  return plan.fireHoseMigration?.variants?.[variant]?.sourceUnitIds || []
}

function shellUnitIds(plan, variant) {
  return plan.version === 2 ? plan.shellCandidate?.variants?.[variant]?.sourceUnitIds || [] : []
}

function nearLod0PlanPackages(plan) {
  return [
    ...(plan?.nearLod0Packages || []),
    ...(plan?.shellCandidate?.nearLod0Packages || []),
    ...(plan?.structuralProxy?.nearLod0Packages || []),
  ]
}

function physicalPlanPackages(plan) {
  return [...(plan?.staticPackages || []), ...nearLod0PlanPackages(plan)]
}

function maxBoundsPlanDelta(left, right) {
  if (!left || !right) return Infinity
  return Math.max(...left.min.map((value, axis) => Math.abs(value - right.min[axis])),
    ...left.max.map((value, axis) => Math.abs(value - right.max[axis])))
}

async function verifyPinnedFile(pin, label) {
  assert.ok(pin && typeof pin.path === 'string', `${label}: file pin is missing`)
  const path = resolve(VIEWER_ROOT, pin.path)
  const record = await fileRecord(path)
  assert.equal(record.bytes, pin.bytes, `${label}: pinned byte count is stale`)
  assert.equal(record.sha256, pin.sha256, `${label}: pinned SHA-256 is stale`)
  return { path, bytes: await readFile(path) }
}

export async function validatePartitionPlanInput(plan, { planPath = null } = {}) {
  assert.equal(plan?.schema, 'IOM_UNOWNED_STATIC_PARTITION_PLAN', 'Unsupported partition plan schema')
  assert.ok(plan?.version === 1 || plan?.version === 2,
    `Unsupported partition plan version: ${plan?.version}; expected 1 or 2`)
  assert.equal(plan.enabled, false, 'Partition plan must remain disabled')
  assert.equal(plan.productionModified, false, 'Partition plan productionModified must remain false')
  assert.equal(plan.productionRoutingChanged, false, 'Partition plan productionRoutingChanged must remain false')
  assert.equal(plan.owner, OWNER, 'Partition owner changed')
  assert.equal(plan.atomicOwnershipUnit, 'mesh-primitive-instance', 'Partition atomic ownership unit changed')
  assert.match(plan.wholeLayerCoverageDigestSha256 || '', /^[a-f0-9]{64}$/,
    'Whole-layer coverage digest is missing')
  assert.equal(plan.planDigestSha256, planDigestSha256(plan), 'Partition plan digest is stale')
  assert.ok(Array.isArray(plan.staticPackages) && plan.staticPackages.length > 0,
    'Partition plan contains no static packages')
  const physicalPackages = physicalPlanPackages(plan)
  assert.equal(new Set(physicalPackages.map((pkg) => pkg.id)).size, physicalPackages.length,
    'Partition plan contains duplicate physical package IDs')
  const mapping = semanticStaticMapping(plan)
  if (plan.version === 2) {
    assert.equal(plan.ready, false, 'Partition v2 ready must remain false')
    assert.equal(plan.activationApproved, false, 'Partition v2 activationApproved must remain false')
    assert.equal(plan.runtimeIntegrated, false, 'Partition v2 runtimeIntegrated must remain false')
    assert.equal(plan.staticPackagesDigestSha256, planStableSha256(plan.staticPackages),
      'Partition v2 static package digest is stale')
    const nearPackages = nearLod0PlanPackages(plan)
    if (nearPackages.length > 0) {
      assert.equal(plan.shellCandidate?.nearLod0PackagesDigestSha256, planStableSha256(nearPackages),
        'Partition v2 near-LOD0 package digest is stale')
      assert.equal(plan.materialFidelity?.materialFidelityReady, true,
        'Partition v2 material-fidelity plan is not ready')
      assert.equal(plan.materialFidelity?.nearLod0PackagePresent, true,
        'Partition v2 does not declare planned near-LOD0 packages')
      assert.equal(plan.materialFidelity?.explicitReplacementSemanticsValidated, true,
        'Partition v2 proxy/near replacement semantics are not validated')
    }
    assert.equal(plan.correspondence?.semanticRecordMultiplicityOne, true,
      'Partition v2 semantic records are not multiplicity one')
    assert.equal(
      plan.correspondence.shellRecordCount + plan.correspondence.detailRecordCount,
      plan.correspondence.partitionedRecordCount,
      'Partition v2 semantic record conservation is stale',
    )
    const pins = plan.evidencePins
    assert.ok(pins && typeof pins === 'object', 'Partition v2 evidence pins are missing')
    const requiredPins = [
      ['sourcePartitionPlan', 'source partition plan'],
      ['wholeLayerContract', 'whole-layer contract'],
      ['shellCandidateIndex', 'shell candidate index'],
      ['ownershipRepartition', 'ownership repartition'],
      ['ownershipAudit', 'ownership audit'],
      ['dependencyAudit', 'dependency audit'],
      ['projectionAudit', 'projection audit'],
      ['renderReport', 'render report'],
    ]
    const verified = {}
    for (const [key, label] of requiredPins) verified[key] = await verifyPinnedFile(pins[key], label)
    const inheritedPlan = JSON.parse(verified.sourcePartitionPlan.bytes)
    assert.equal(inheritedPlan.schema, plan.schema, 'Inherited partition schema changed')
    assert.equal(inheritedPlan.version, 1, 'Partition v2 must inherit correspondence from v1')
    assert.equal(pins.sourcePartitionPlan.planDigestSha256, inheritedPlan.planDigestSha256,
      'Inherited v1 partition digest pin is stale')
    assert.equal(planStableSha256(plan.correspondence.inheritedV1), planStableSha256(inheritedPlan.correspondence),
      'Partition v2 inherited correspondence differs from its pinned v1 plan')
    assert.equal(planStableSha256(mapping), planStableSha256(inheritedPlan.correspondence.semanticStaticMapping),
      'Partition v2 inherited semantic mapping differs from its pinned v1 plan')
    const wholeLayer = JSON.parse(verified.wholeLayerContract.bytes)
    assert.equal(pins.wholeLayerContract.coverageDigestSha256, wholeLayer.coverageDigestSha256,
      'Pinned whole-layer contract coverage digest is stale')
    assert.equal(plan.wholeLayerCoverageDigestSha256, wholeLayer.coverageDigestSha256,
      'Plan whole-layer coverage digest differs from pinned contract')
    for (const variant of VARIANTS) await verifyPinnedFile(
      plan.shellCandidate?.variants?.[variant]?.output,
      `${variant} structural shell output`,
    )
  }
  for (const variant of VARIANTS) {
    const units = plan.variants?.[variant]?.units
    assert.ok(Array.isArray(units) && units.length > 0, `${variant}: source unit inventory is missing`)
    const unitById = new Map(units.map((unit) => [unit.id, unit]))
    assert.equal(unitById.size, units.length, `${variant}: source unit inventory contains duplicates`)
    const detailIds = []
    for (const pkg of plan.staticPackages) {
      assert.equal(pkg.enabled, false, `${variant}:${pkg.id}: package must remain disabled`)
      assert.equal(pkg.owner, OWNER, `${variant}:${pkg.id}: package owner changed`)
      const metrics = pkg.variants?.[variant]
      assert.ok(metrics, `${variant}:${pkg.id}: package metrics are missing`)
      const ids = metrics.sourceUnitIds || []
      assert.equal(new Set(ids).size, ids.length, `${variant}:${pkg.id}: source units are duplicated`)
      const selected = ids.map((id) => {
        const unit = unitById.get(id)
        assert.ok(unit, `${variant}:${pkg.id}: unknown source unit ${id}`)
        return unit
      })
      assert.equal(metrics.atomicUnitCount, ids.length, `${variant}:${pkg.id}: atomic unit count is stale`)
      assert.equal(metrics.expandedTriangles, selected.reduce((sum, unit) => sum + unit.triangles, 0),
        `${variant}:${pkg.id}: triangle count is stale`)
      assert.equal(metrics.projectedDraws, new Set(selected.map((unit) =>
        `${unit.nodeId}/primitive/${unit.primitiveIndex}/${unit.transformParity}`)).size,
      `${variant}:${pkg.id}: projected draw count is stale`)
      const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
      for (const unit of selected) for (let axis = 0; axis < 3; axis += 1) {
        bounds.min[axis] = Math.min(bounds.min[axis], unit.bounds.min[axis])
        bounds.max[axis] = Math.max(bounds.max[axis], unit.bounds.max[axis])
      }
      assert.ok(maxBoundsPlanDelta(bounds, metrics.bounds) <= 2e-5, `${variant}:${pkg.id}: package bounds are stale`)
      detailIds.push(...ids)
    }
    assert.equal(new Set(detailIds).size, detailIds.length, `${variant}: detail ownership contains duplicates`)
    const nearPackages = nearLod0PlanPackages(plan)
    const nearIds = []
    for (const pkg of nearPackages) {
      assert.equal(pkg.enabled, false, `${variant}:${pkg.id}: near-LOD0 package must remain disabled`)
      assert.equal(pkg.owner, OWNER, `${variant}:${pkg.id}: near-LOD0 package owner changed`)
      assert.equal(pkg.nearLod0, true, `${variant}:${pkg.id}: near-LOD0 role marker is missing`)
      assert.equal(pkg.replacementSemantics?.mutuallyExclusiveAtSteadyState, true,
        `${variant}:${pkg.id}: proxy/near steady-state exclusivity is missing`)
      assert.equal(pkg.replacementSemantics?.additiveCompositionAllowed, false,
        `${variant}:${pkg.id}: additive structural composition must be forbidden`)
      assert.equal(pkg.replacementSemantics?.loadBeforeRetire, true,
        `${variant}:${pkg.id}: load-before-retire replacement is missing`)
      const metrics = pkg.variants?.[variant]
      assert.ok(metrics, `${variant}:${pkg.id}: near-LOD0 package metrics are missing`)
      const ids = metrics.sourceUnitIds || []
      assert.equal(new Set(ids).size, ids.length, `${variant}:${pkg.id}: near-LOD0 source units are duplicated`)
      const selected = ids.map((id) => {
        const unit = unitById.get(id)
        assert.ok(unit, `${variant}:${pkg.id}: unknown near-LOD0 source unit ${id}`)
        return unit
      })
      assert.equal(metrics.atomicUnitCount, ids.length, `${variant}:${pkg.id}: near-LOD0 atomic unit count is stale`)
      assert.equal(metrics.expandedTriangles, selected.reduce((sum, unit) => sum + unit.triangles, 0),
        `${variant}:${pkg.id}: near-LOD0 triangle count is stale`)
      assert.equal(metrics.projectedDraws, new Set(selected.map((unit) =>
        `${unit.nodeId}/primitive/${unit.primitiveIndex}/${unit.transformParity}`)).size,
      `${variant}:${pkg.id}: near-LOD0 projected draw count is stale`)
      const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
      for (const unit of selected) for (let axis = 0; axis < 3; axis += 1) {
        bounds.min[axis] = Math.min(bounds.min[axis], unit.bounds.min[axis])
        bounds.max[axis] = Math.max(bounds.max[axis], unit.bounds.max[axis])
      }
      assert.ok(maxBoundsPlanDelta(bounds, metrics.bounds) <= 2e-5,
        `${variant}:${pkg.id}: near-LOD0 package bounds are stale`)
      nearIds.push(...ids)
    }
    assert.equal(new Set(nearIds).size, nearIds.length, `${variant}: near-LOD0 ownership contains duplicates`)
    if (nearPackages.length > 0) {
      assert.deepEqual([...nearIds].sort(), [...shellUnitIds(plan, variant)].sort(),
        `${variant}: near-LOD0 packages do not exactly cover the structural proxy claim`)
    }
    const segments = {
      repeat: repeatUnitIds(plan, variant),
      fire: fireUnitIds(plan, variant),
      shell: shellUnitIds(plan, variant),
      detail: detailIds,
    }
    const union = Object.values(segments).flat()
    assert.equal(new Set(union).size, union.length, `${variant}: ownership segments overlap`)
    assert.deepEqual([...union].sort(), [...unitById.keys()].sort(), `${variant}: ownership conservation failed`)
    if (plan.version === 2) {
      const detail = plan.detailComplement?.variants?.[variant]
      assert.equal(detail?.atomicUnitCount, detailIds.length, `${variant}: v2 detail complement count is stale`)
      assert.equal(detail?.sourceUnitIdsSha256, stringListSha256(detailIds), `${variant}: v2 detail complement digest is stale`)
      assert.equal(detail?.requiredPayloadInputUnitIdsSha256, stringListSha256(detailIds),
        `${variant}: v2 required payload input digest is stale`)
      assert.equal(plan.projection?.[variant]?.detail?.packageCount, plan.staticPackages.length,
        `${variant}: v2 projection package count is stale`)
      assert.equal(plan.projection?.[variant]?.detail?.atomicUnitCount, detailIds.length,
        `${variant}: v2 projection detail unit count is stale`)
      const conservation = plan.conservation?.variants?.[variant]
      assert.equal(conservation?.detailAtomicUnits, detailIds.length, `${variant}: v2 conservation detail count is stale`)
      assert.equal(conservation?.unionAtomicUnits, union.length, `${variant}: v2 conservation union count is stale`)
      assert.equal(conservation?.omittedAtomicUnits, 0, `${variant}: v2 conservation reports omissions`)
      assert.equal(conservation?.overlapAtomicUnits, 0, `${variant}: v2 conservation reports overlap`)
      assert.equal(conservation?.multiplicityOne, true, `${variant}: v2 conservation is not multiplicity one`)
    }
  }
  return {
    schema: plan.schema,
    version: plan.version,
    packageCount: physicalPackages.length,
    detailPackageCount: plan.staticPackages.length,
    nearLod0PackageCount: nearLod0PlanPackages(plan).length,
    semanticMapping: mapping,
    planPath,
  }
}

function projectPath(path) {
  const value = relative(VIEWER_ROOT, path).replaceAll('\\', '/')
  return value.startsWith('.') ? value : `./${value}`
}

function assertTmpOutput(path) {
  const tmpRoot = resolve(VIEWER_ROOT, 'tmp')
  const value = relative(tmpRoot, path)
  assert.ok(value && !value.startsWith('..') && !value.includes(':') && !resolve(path).startsWith(`${tmpRoot}..`),
    `Output must be a named directory below ${tmpRoot}`)
}

function cloneExtras(extras) {
  return extras && typeof extras === 'object' ? structuredClone(extras) : {}
}

function createTargetExtensions(target, source) {
  const existing = new Map(target.getRoot().listExtensionsUsed().map((extension) => [extension.extensionName, extension]))
  for (const extension of source.getRoot().listExtensionsUsed()) {
    // The source decoder has already expanded EXT_meshopt_compression. Re-declaring
    // the extension would require a new encoding pass; emitting the exact decoded
    // accessor component values is intentionally lossless and independently audited.
    if (extension.extensionName === 'EXT_meshopt_compression') continue
    const next = existing.get(extension.extensionName) || target.createExtension(extension.constructor)
    existing.set(extension.extensionName, next)
    if (extension.isRequired()) next.setRequired(true)
  }
}

function enableLosslessGeometryTransportCompression(target) {
  assert.ok(!target.getRoot().listExtensionsUsed()
    .some((extension) => extension.extensionName === GEOMETRY_TRANSPORT_COMPRESSION.extension),
  'Target unexpectedly retained a source Meshopt extension before re-encoding')
  // EncoderMethod.QUANTIZE names the extension writer mode, but the writer does
  // not quantize accessor values itself. By deliberately omitting quantize(),
  // reorder(), and filter transforms, this pass only encodes the existing
  // vertex component bytes. Meshopt's TRIANGLES codec may rotate or reorder
  // index triples, so the payload auditor separately proves byte-identical
  // vertex accessors and an identical winding-preserving triangle multiset.
  target.createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
}

function normalizedAccessorValue(accessor, index) {
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

function instanceLocalMatrices(node) {
  const instancing = node.getExtension('EXT_mesh_gpu_instancing')
  if (!instancing) return [new Matrix4()]
  const attributes = instancing.listAttributes()
  assert.ok(attributes.length > 0, 'EXT_mesh_gpu_instancing has no attributes')
  const count = attributes[0].getCount()
  assert.ok(attributes.every((accessor) => accessor.getCount() === count), 'Instancing attribute counts differ')
  const translation = instancing.getAttribute('TRANSLATION')
  const rotation = instancing.getAttribute('ROTATION')
  const scale = instancing.getAttribute('SCALE')
  return Array.from({ length: count }, (_, index) => {
    const position = translation
      ? new Vector3(...Array.from({ length: 3 }, (__, axis) => normalizedAccessorValue(translation, index * 3 + axis)))
      : new Vector3()
    const quaternion = rotation
      ? new Quaternion(...Array.from({ length: 4 }, (__, axis) => normalizedAccessorValue(rotation, index * 4 + axis))).normalize()
      : new Quaternion()
    const scaleValue = scale
      ? new Vector3(...Array.from({ length: 3 }, (__, axis) => normalizedAccessorValue(scale, index * 3 + axis)))
      : new Vector3(1, 1, 1)
    return new Matrix4().compose(position, quaternion, scaleValue)
  })
}

function subsetAccessor(target, buffer, source, indices, suffix) {
  const sourceArray = source.getArray()
  assert.ok(sourceArray, `Instancing accessor ${source.getName()} has no array`)
  const elementSize = source.getElementSize()
  const OutputArray = sourceArray.constructor
  const output = new OutputArray(indices.length * elementSize)
  for (let targetIndex = 0; targetIndex < indices.length; targetIndex += 1) {
    const sourceIndex = indices[targetIndex]
    output.set(sourceArray.subarray(sourceIndex * elementSize, (sourceIndex + 1) * elementSize), targetIndex * elementSize)
  }
  return target.createAccessor(`${source.getName() || 'instance'}:${suffix}`)
    .setType(source.getType())
    .setArray(output)
    .setNormalized(source.getNormalized())
    .setExtras(cloneExtras(source.getExtras()))
    .setBuffer(buffer)
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
  return bytes
}

function sharedTextureCompatibility(texture, info) {
  if (!info) return { orphaned: true }
  const transform = info.getExtension('KHR_texture_transform')
  return stableValue({
    texCoord: transform?.getTexCoord?.() ?? info.getTexCoord(),
    wrapS: info.getWrapS(),
    wrapT: info.getWrapT(),
    magFilter: info.getMagFilter() ?? 9729,
    minFilter: info.getMinFilter() ?? 9987,
    colorSpace: getTextureColorSpace(texture) ?? 'linear',
    offset: transform?.getOffset?.() ?? [0, 0],
    rotation: transform?.getRotation?.() ?? 0,
    scale: transform?.getScale?.() ?? [1, 1],
    flipY: false,
  })
}

function annotateSharedTextureMetadata(document) {
  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage()
    assert.ok(image, `Texture ${texture.getName() || '<unnamed>'} has no embedded image bytes`)
    const metadata = { version: 1, contentSha256: sha256(image), encodedBytes: image.byteLength }
    const extras = cloneExtras(texture.getExtras())
    if (extras.iomSharedTexture !== undefined) {
      assert.deepEqual(extras.iomSharedTexture, metadata,
        `Texture ${texture.getName() || '<unnamed>'} has conflicting shared-texture metadata`)
    }
    texture.setExtras({ ...extras, iomSharedTexture: metadata })
  }
}

function textureMetrics(document) {
  const copies = document.getRoot().listTextures().map((texture) => {
    const image = texture.getImage()
    assert.ok(image, `Texture ${texture.getName() || '<unnamed>'} has no embedded image bytes`)
    const encodedBytes = image?.byteLength || 0
    const contentSha256 = sha256(image)
    const metadata = texture.getExtras()?.iomSharedTexture
    assert.deepEqual(metadata, { version: 1, contentSha256, encodedBytes },
      `Texture ${texture.getName() || '<unnamed>'} has stale shared-texture metadata`)
    const infos = listTextureInfo(texture)
    const compatibility = [...new Map((infos.length ? infos : [null]).map((info) => {
      const value = sharedTextureCompatibility(texture, info)
      const signatureSha256 = stableSha256(value)
      return [signatureSha256, { ...value, signatureSha256 }]
    })).values()].sort((left, right) => left.signatureSha256.localeCompare(right.signatureSha256))
    return {
      sha256: contentSha256,
      encodedBytes,
      conservativeDecodedRgba8Bytes: ktx2DecodedRgba8Bytes(image) ?? encodedBytes * 4,
      compatibility,
    }
  })
  const unique = new Map()
  for (const copy of copies) if (copy.sha256 && !unique.has(copy.sha256)) unique.set(copy.sha256, copy)
  const sharedResources = new Map()
  for (const copy of copies) for (const compatibility of copy.compatibility) {
    const identity = {
      contentSha256: copy.sha256,
      encodedBytes: copy.encodedBytes,
      conservativeDecodedRgba8Bytes: copy.conservativeDecodedRgba8Bytes,
      compatibility,
    }
    const keySha256 = stableSha256(identity)
    if (!sharedResources.has(keySha256)) sharedResources.set(keySha256, { keySha256, ...identity })
  }
  const resources = [...sharedResources.values()].sort((left, right) => left.keySha256.localeCompare(right.keySha256))
  return {
    textureCount: copies.length,
    uniqueImageCount: unique.size,
    embeddedEncodedImageBytes: copies.reduce((sum, copy) => sum + copy.encodedBytes, 0),
    conservativeDecodedImageBytesRgba8: copies.reduce((sum, copy) => sum + copy.conservativeDecodedRgba8Bytes, 0),
    uniqueEmbeddedEncodedImageBytes: [...unique.values()].reduce((sum, copy) => sum + copy.encodedBytes, 0),
    uniqueConservativeDecodedImageBytesRgba8: [...unique.values()].reduce((sum, copy) => sum + copy.conservativeDecodedRgba8Bytes, 0),
    imageContentSha256: stringListSha256(unique.keys()),
    sharedTextureResidency: {
      metadataVersion: 1,
      annotatedTextureCount: copies.length,
      annotationComplete: true,
      compatibilityInstanceCount: copies.reduce((sum, copy) => sum + copy.compatibility.length, 0),
      compatibleResourceCount: resources.length,
      compatibleResourcesDigestSha256: stableSha256(resources),
      resources,
    },
  }
}

function parseUnitId(id) {
  const match = ID_PATTERN.exec(id)
  assert.ok(match, `Unsupported source unit identity: ${id}`)
  return { sceneChildIndex: Number(match[1]), primitiveIndex: Number(match[2]), instanceIndex: Number(match[3]) }
}

function sourceMaps(plan, variant, document) {
  const rootNodes = document.getRoot().listNodes()
  const nodeById = new Map()
  for (const record of plan.variants[variant].nodes) {
    const node = rootNodes[record.sourceNodeIndex]
    assert.ok(node?.getMesh(), `${variant}:${record.id} does not resolve to a source mesh node`)
    nodeById.set(record.id, { record, node })
  }
  const unitById = new Map(plan.variants[variant].units.map((unit) => [unit.id, unit]))
  return { nodeById, unitById }
}

function selectedUnits(plan, packageRecord, variant, maps) {
  const expected = packageRecord.variants[variant]
  assert.ok(expected, `${variant}:${packageRecord.id} has no package metrics`)
  const output = expected.sourceUnitIds.map((id) => {
    const unit = maps.unitById.get(id)
    assert.ok(unit, `${variant}:${packageRecord.id} references unknown unit ${id}`)
    const parsed = parseUnitId(id)
    assert.equal(parsed.primitiveIndex, unit.primitiveIndex, `${variant}:${id} primitive index disagrees with identity`)
    assert.equal(parsed.instanceIndex, unit.instanceIndex, `${variant}:${id} instance index disagrees with identity`)
    assert.equal(`scene/0/${parsed.sceneChildIndex}`, maps.nodeById.get(unit.nodeId)?.record.ownerRelativePath,
      `${variant}:${id} active-scene path disagrees with identity`)
    return unit
  })
  assert.equal(new Set(output.map((unit) => unit.id)).size, output.length,
    `${variant}:${packageRecord.id} duplicates source units`)
  return output.sort((left, right) => left.id.localeCompare(right.id))
}

function groupUnits(units) {
  const groups = new Map()
  for (const unit of units) {
    const key = `${unit.nodeId}/primitive/${unit.primitiveIndex}/${unit.transformParity}`
    const list = groups.get(key) || []
    list.push(unit)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(([key, values]) => ({ key, units: values.sort((left, right) => left.instanceIndex - right.instanceIndex) }))
    .sort((left, right) => left.key.localeCompare(right.key))
}

function selectedSemanticDigest(groups, maps) {
  const primitiveDigestCache = new Map()
  const primitiveDigest = (primitive) => {
    if (primitiveDigestCache.has(primitive)) return primitiveDigestCache.get(primitive)
    const accessor = (value) => value ? {
      type: value.getType(),
      componentType: value.getComponentType(),
      normalized: value.getNormalized(),
      count: value.getCount(),
      sha256: sha256(Buffer.from(value.getArray().buffer, value.getArray().byteOffset, value.getArray().byteLength)),
    } : null
    const material = primitive.getMaterial()
    const textures = material ? [
      material.getBaseColorTexture(), material.getMetallicRoughnessTexture(), material.getNormalTexture(),
      material.getOcclusionTexture(), material.getEmissiveTexture(),
    ].filter(Boolean).map((texture) => ({
      name: texture.getName(), mimeType: texture.getMimeType(), imageSha256: sha256(texture.getImage()),
    })).sort((left, right) => left.imageSha256.localeCompare(right.imageSha256)) : []
    const value = stableSha256({
      mode: primitive.getMode(),
      indices: accessor(primitive.getIndices()),
      attributes: primitive.listSemantics().map((semantic) => [semantic, accessor(primitive.getAttribute(semantic))]),
      targets: primitive.listTargets().map((target) => target.listSemantics().map((semantic) => [semantic, accessor(target.getAttribute(semantic))])),
      material: material ? {
        name: material.getName(), alphaMode: material.getAlphaMode(), alphaCutoff: material.getAlphaCutoff(),
        doubleSided: material.getDoubleSided(), baseColorFactor: material.getBaseColorFactor(),
        metallicFactor: material.getMetallicFactor(), roughnessFactor: material.getRoughnessFactor(),
        emissiveFactor: material.getEmissiveFactor(), textures,
      } : null,
    })
    primitiveDigestCache.set(primitive, value)
    return value
  }
  return stableSha256(groups.flatMap((group) => group.units.map((unit) => {
    const node = maps.nodeById.get(unit.nodeId).node
    const local = instanceLocalMatrices(node)[unit.instanceIndex]
    const world = new Matrix4().fromArray(node.getWorldMatrix()).multiply(local).toArray()
    return {
      id: unit.id,
      primitiveSha256: primitiveDigest(node.getMesh().listPrimitives()[unit.primitiveIndex]),
      worldMatrix: stableValue(world),
      triangles: unit.triangles,
      bounds: unit.bounds,
      transformParity: unit.transformParity,
    }
  })))
}

async function writeSelectedPayload(io, source, maps, units, packageId, outPath, sceneName) {
  const groups = groupUnits(units)
  const target = new Document().setLogger(source.getLogger())
  createTargetExtensions(target, source)
  const scene = target.createScene(sceneName)
  const instanceBuffer = target.createBuffer('instance-attributes')
  const sourcePrimitives = [...new Set(groups.map((group) => {
    const unit = group.units[0]
    return maps.nodeById.get(unit.nodeId).node.getMesh().listPrimitives()[unit.primitiveIndex]
  }))]
  assert.ok(sourcePrimitives.every(Boolean), `${packageId}: unresolved source primitive`)
  const propertyMap = copyToDocument(target, source, sourcePrimitives, createDefaultPropertyResolver(target, source))
  const meshByPrimitive = new Map()
  for (const group of groups) {
    const first = group.units[0]
    const sourceNode = maps.nodeById.get(first.nodeId).node
    const sourceMesh = sourceNode.getMesh()
    const sourcePrimitive = sourceMesh.listPrimitives()[first.primitiveIndex]
    let targetMesh = meshByPrimitive.get(sourcePrimitive)
    if (!targetMesh) {
      targetMesh = target.createMesh(sourceMesh.getName())
        .setWeights(sourceMesh.getWeights())
        .setExtras(cloneExtras(sourceMesh.getExtras()))
        .addPrimitive(propertyMap.get(sourcePrimitive))
      meshByPrimitive.set(sourcePrimitive, targetMesh)
    }
    const indices = group.units.map((unit) => unit.instanceIndex)
    const targetNode = target.createNode(sourceNode.getName())
      .setMesh(targetMesh)
      .setMatrix(sourceNode.getWorldMatrix())
      .setWeights(sourceNode.getWeights())
      .setExtras({
        ...cloneExtras(sourceNode.getExtras()),
        iomPayloadPackageId: packageId,
        iomSourceNodeId: first.nodeId,
        iomSourcePath: first.sourcePath,
        iomPrimitiveIndex: first.primitiveIndex,
        iomTransformParity: first.transformParity,
        iomSourceInstanceIndices: indices,
        iomSourceUnitIds: group.units.map((unit) => unit.id),
        iomSourceUnitIdsSha256: stringListSha256(group.units.map((unit) => unit.id)),
      })
    const sourceInstancing = sourceNode.getExtension('EXT_mesh_gpu_instancing')
    if (sourceInstancing) {
      const extension = target.getRoot().listExtensionsUsed()
        .find((entry) => entry.extensionName === 'EXT_mesh_gpu_instancing')
      assert.ok(extension, `${packageId}: target has no EXT_mesh_gpu_instancing extension`)
      const targetInstancing = extension.createInstancedMesh()
      for (const semantic of sourceInstancing.listSemantics()) {
        targetInstancing.setAttribute(semantic,
          subsetAccessor(target, instanceBuffer, sourceInstancing.getAttribute(semantic), indices, `${group.key}:${semantic}`))
      }
      targetNode.setExtension('EXT_mesh_gpu_instancing', targetInstancing)
    } else {
      assert.deepEqual(indices, [0], `${packageId}:${first.nodeId} non-instanced node has invalid instance selection`)
    }
    scene.addChild(targetNode)
  }
  await target.transform(
    prune({ keepAttributes: true, keepIndices: true, keepExtras: true }),
    unpartition(),
  )
  assert.ok(target.getRoot().listBuffers().length <= 1,
    `${packageId}: GLB payload still has multiple binary buffers after consolidation`)
  annotateSharedTextureMetadata(target)
  const textures = textureMetrics(target)
  enableLosslessGeometryTransportCompression(target)
  await mkdir(dirname(outPath), { recursive: true })
  await io.write(outPath, target)
  return {
    groupCount: groups.length,
    sourceUnitCount: units.length,
    sourceUnitIdsSha256: stringListSha256(units.map((unit) => unit.id)),
    sourceSemanticDigestSha256: selectedSemanticDigest(groups, maps),
    textures,
  }
}

async function writeCompositeFromPayloads(io, payloadPaths, outPath, variant) {
  const target = new Document()
  const scene = target.createScene(`EmittedStaticComposite:${variant}`)
  for (const payloadPath of payloadPaths) {
    const source = await io.read(payloadPath)
    createTargetExtensions(target, source)
    const sourceScene = source.getRoot().listScenes()[0]
    assert.ok(sourceScene, `${payloadPath}: payload scene is missing`)
    const propertyMap = copyToDocument(
      target,
      source,
      sourceScene.listChildren(),
      createDefaultPropertyResolver(target, source),
    )
    for (const child of sourceScene.listChildren()) scene.addChild(propertyMap.get(child))
  }
  await target.transform(
    prune({ keepAttributes: true, keepIndices: true, keepExtras: true }),
    unpartition(),
  )
  assert.ok(target.getRoot().listBuffers().length <= 1,
    `${variant}: review composite still has multiple binary buffers after consolidation`)
  enableLosslessGeometryTransportCompression(target)
  await io.write(outPath, target)
}

function unionBounds(packages, variant) {
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  for (const pkg of packages) {
    const value = pkg.variants[variant].bounds
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], value.min[axis])
      bounds.max[axis] = Math.max(bounds.max[axis], value.max[axis])
    }
  }
  return stableValue(bounds)
}

function camerasForBounds(bounds) {
  const center = bounds.min.map((value, axis) => (value + bounds.max[axis]) * 0.5)
  const size = bounds.max.map((value, axis) => value - bounds.min[axis])
  const radius = Math.hypot(...size) * 0.7
  const directions = [
    ['north-oblique', [0.75, 0.55, 1]], ['south-oblique', [-0.75, 0.55, -1]],
    ['east-oblique', [1, 0.45, -0.4]], ['west-oblique', [-1, 0.45, 0.4]],
    ['north-low', [0, 0.18, 1]], ['south-low', [0, 0.18, -1]],
    ['top', [0.01, 1, 0.01]], ['underside-review', [0.15, -0.45, 1]],
  ]
  return directions.map(([id, direction]) => {
    const length = Math.hypot(...direction)
    return {
      id,
      position: stableValue(center.map((value, axis) => value + direction[axis] / length * radius)),
      target: stableValue(center),
      verticalFovDegrees: 50,
    }
  })
}

function aggregatePackageRecords(records, variant) {
  const entries = records.map((record) => record.variants[variant])
  return {
    packageCount: entries.length,
    sourceUnitCount: entries.reduce((sum, entry) => sum + entry.sourceUnitCount, 0),
    expandedTriangles: entries.reduce((sum, entry) => sum + entry.expandedTriangles, 0),
    payloadDraws: entries.reduce((sum, entry) => sum + entry.payloadDraws, 0),
    payloadBytes: entries.reduce((sum, entry) => sum + entry.asset.bytes, 0),
    largestPayloadBytes: Math.max(0, ...entries.map((entry) => entry.asset.bytes)),
    embeddedEncodedImageBytes: entries.reduce((sum, entry) => sum + entry.textureMemory.embeddedEncodedImageBytes, 0),
    conservativeDecodedImageBytesRgba8: entries.reduce((sum, entry) => sum + entry.textureMemory.conservativeDecodedImageBytesRgba8, 0),
    largestPayloadConservativeDecodedImageBytesRgba8: Math.max(0,
      ...entries.map((entry) => entry.textureMemory.conservativeDecodedImageBytesRgba8)),
    sourceUnitIdsSha256: stringListSha256(entries.flatMap((entry) => entry.sourceUnitIds)),
    payloadHashesSha256: stringListSha256(entries.map((entry) => `${entry.packageId}:${entry.asset.sha256}`)),
  }
}

export async function buildUnownedStaticPayloadCandidate({
  planPath = DEFAULT_PLAN,
  out = DEFAULT_OUT,
  force = false,
  packageId = null,
  skipReview = false,
} = {}) {
  assertTmpOutput(out)
  const planBytes = await readFile(planPath)
  const plan = JSON.parse(planBytes)
  const planContract = await validatePartitionPlanInput(plan, { planPath })
  const inheritedSemanticMapping = planContract.semanticMapping
  const plannedPackages = physicalPlanPackages(plan)
  const packages = packageId ? plannedPackages.filter((pkg) => pkg.id === packageId) : plannedPackages
  assert.ok(packages.length > 0, `No package matched ${packageId}`)
  if (!force) {
    try {
      await stat(out)
      throw new Error(`Output already exists: ${out}; use --force to replace this disabled tmp candidate`)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  await rm(out, { recursive: true, force: true })
  await mkdir(out, { recursive: true })
  const io = await createGltfIO({ encoder: true })
  const sources = {}
  const documents = {}
  const maps = {}
  for (const variant of VARIANTS) {
    const sourcePath = resolve(VIEWER_ROOT, plan.variants[variant].sourcePath)
    const record = await fileRecord(sourcePath)
    assert.equal(record.sha256, plan.variants[variant].source.sha256, `${variant}: source hash drifted from plan`)
    assert.equal(record.bytes, plan.variants[variant].source.bytes, `${variant}: source byte count drifted from plan`)
    sources[variant] = { path: sourcePath, ...record }
    documents[variant] = await io.read(sourcePath)
    maps[variant] = sourceMaps(plan, variant, documents[variant])
  }
  const packageRecords = []
  for (const pkg of packages) {
    const record = {
      id: pkg.id,
      enabled: false,
      owner: OWNER,
      role: pkg.role,
      cell: pkg.cell,
      materialAffinityGroups: pkg.materialAffinityGroups,
      variants: {},
    }
    for (const variant of VARIANTS) {
      const units = selectedUnits(plan, pkg, variant, maps[variant])
      const relativeAssetPath = `payloads/${variant}/${pkg.id}.glb`
      const assetPath = join(out, ...relativeAssetPath.split('/'))
      const written = await writeSelectedPayload(
        io, documents[variant], maps[variant], units, pkg.id, assetPath, `UnownedStatic:${variant}:${pkg.id}`,
      )
      const asset = await fileRecord(assetPath)
      const expected = pkg.variants[variant]
      record.variants[variant] = {
        packageId: pkg.id,
        asset: { path: `./${relativeAssetPath}`, ...asset },
        sourceUnitCount: units.length,
        sourceUnitIds: units.map((unit) => unit.id),
        sourceUnitIdsSha256: written.sourceUnitIdsSha256,
        sourceNodeIds: [...new Set(units.map((unit) => unit.nodeId))].sort(),
        sourceInstanceIds: [...new Set(units.map((unit) => unit.instanceId))].sort(),
        sourceSemanticDigestSha256: written.sourceSemanticDigestSha256,
        expandedTriangles: units.reduce((sum, unit) => sum + unit.triangles, 0),
        payloadDraws: written.groupCount,
        textureMemory: written.textures,
        bounds: expected.bounds,
        requiredEmittedGlbBytes: plan.planningBudgets[variant].requiredEmittedGlbBytes,
        byteGatePass: asset.bytes <= plan.planningBudgets[variant].requiredEmittedGlbBytes,
      }
    }
    packageRecords.push(record)
  }
  const complete = !packageId && packages.length === plannedPackages.length
  const review = {}
  if (complete && !skipReview) {
    for (const variant of VARIANTS) {
      const units = packages.flatMap((pkg) => selectedUnits(plan, pkg, variant, maps[variant]))
        .sort((left, right) => left.id.localeCompare(right.id))
      const sourceReferencePath = join(out, `source-static-reference-${variant}.glb`)
      const sourceReferenceWritten = await writeSelectedPayload(
        io, documents[variant], maps[variant], units, `source-static-reference-${variant}`,
        sourceReferencePath, `SourceStaticReference:${variant}`,
      )
      const compositePath = join(out, `emitted-static-composite-${variant}.glb`)
      const payloadPaths = packageRecords.map((record) => resolve(out, record.variants[variant].asset.path))
      await writeCompositeFromPayloads(io, payloadPaths, compositePath, variant)
      review[variant] = {
        bounds: unionBounds(packages, variant),
        sourceReference: { path: projectPath(sourceReferencePath), ...await fileRecord(sourceReferencePath) },
        emittedComposite: { path: projectPath(compositePath), ...await fileRecord(compositePath) },
        sourceUnitCount: units.length,
        sourceUnitIdsSha256: sourceReferenceWritten.sourceUnitIdsSha256,
        sourceSemanticDigestSha256: sourceReferenceWritten.sourceSemanticDigestSha256,
      }
    }
  }
  const variants = Object.fromEntries(VARIANTS.map((variant) => {
    const expectedUnitIds = packages.flatMap((pkg) => pkg.variants[variant].sourceUnitIds).sort()
    const aggregate = aggregatePackageRecords(packageRecords, variant)
    return [variant, {
      source: {
        path: projectPath(sources[variant].path),
        url: plan.variants[variant].source.url,
        bytes: sources[variant].bytes,
        sha256: sources[variant].sha256,
      },
      wholeLayerVariantCoverageDigestSha256: plan.variants[variant].wholeLayerVariantCoverageDigestSha256,
      expectedSourceUnitCount: expectedUnitIds.length,
      expectedSourceUnitIdsSha256: stringListSha256(expectedUnitIds),
      emitted: aggregate,
      byteGatePass: packageRecords.every((record) => record.variants[variant].byteGatePass),
      review: review[variant] || null,
    }]
  }))
  const correspondenceDigestSha256 = stableSha256(packageRecords.map((record) => ({
    id: record.id,
    web: record.variants.web.sourceUnitIdsSha256,
    quest: record.variants.quest.sourceUnitIdsSha256,
  })))
  const reproducibilityDigestSha256 = stableSha256({
    planDigestSha256: plan.planDigestSha256,
    sources: Object.fromEntries(VARIANTS.map((variant) => [variant, sources[variant].sha256])),
    packages: packageRecords.map((record) => ({
      id: record.id,
      web: { sha256: record.variants.web.asset.sha256, semantic: record.variants.web.sourceSemanticDigestSha256 },
      quest: { sha256: record.variants.quest.asset.sha256, semantic: record.variants.quest.sourceSemanticDigestSha256 },
    })),
    review: Object.fromEntries(VARIANTS.map((variant) => [variant, review[variant] ? {
      sourceReference: review[variant].sourceReference.sha256,
      emittedComposite: review[variant].emittedComposite.sha256,
    } : null])),
  })
  const index = {
    schema: 'IOM_UNOWNED_STATIC_PAYLOAD_CANDIDATE',
    version: 1,
    modelId: plan.modelId,
    enabled: false,
    activationApproved: false,
    activationStatus: complete
      ? 'disabled-exact-payloads-emitted-visual-runtime-and-hardware-gates-pending'
      : 'disabled-diagnostic-subset-only',
    productionModified: false,
    productionRoutingChanged: false,
    owner: OWNER,
    atomicOwnershipUnit: 'mesh-primitive-instance',
    completePlannedPackageSet: complete,
    plan: {
      path: projectPath(planPath),
      bytes: planBytes.length,
      sha256: sha256(planBytes),
      schema: plan.schema,
      version: plan.version,
      planDigestSha256: plan.planDigestSha256,
      wholeLayerCoverageDigestSha256: plan.wholeLayerCoverageDigestSha256,
      staticPackageCount: plan.staticPackages.length,
      staticPackagesDigestSha256: plan.staticPackagesDigestSha256 ?? planStableSha256(plan.staticPackages),
    physicalPackageCount: plannedPackages.length,
      nearLod0PackageCount: nearLod0PlanPackages(plan).length,
      nearLod0PackagesDigestSha256: plan.shellCandidate?.nearLod0PackagesDigestSha256 ??
        planStableSha256(nearLod0PlanPackages(plan)),
      semanticStaticMappingSha256: inheritedSemanticMapping.primitiveMappingsSha256,
      evidencePinsSha256: plan.version === 2 ? planStableSha256(plan.evidencePins) : null,
    },
    geometryTransportCompression: GEOMETRY_TRANSPORT_COMPRESSION,
    sharedTextureResidency: SHARED_TEXTURE_RESIDENCY,
    variants,
    packageCount: packageRecords.length,
    packages: packageRecords,
    webQuestCorrespondence: {
      packageCount: packageRecords.length,
      mappingPolicy: inheritedSemanticMapping.policy,
      primitiveMappingsSha256: inheritedSemanticMapping.primitiveMappingsSha256,
      packageUnitPairDigestSha256: correspondenceDigestSha256,
    },
    visualQa: {
      status: complete && !skipReview ? 'composite-handoff-generated-render-comparison-pending' : 'not-generated',
      activationApproved: false,
      handoff: complete && !skipReview ? './visual-qa-handoff.json' : null,
    },
    unresolvedReleaseGates: [
      'Run matched-camera source-reference versus emitted-composite visual parity for Web and Quest; approve front-face, transparency, and normals only from reviewed images.',
      'Define and independently audit the spatial resident window, neighbor overlap, request concurrency, eviction, and load-before-retire policy.',
      'Prove picking, hide/isolate, collision separation, and failure recovery with these payloads in the disabled runtime path.',
      'Profile frame time, memory, transfer, decode, and upload on physical desktop and Quest-class hardware.',
      'Keep production manifest and routes monolithic until every whole-layer release gate passes.',
    ],
    reproducibilityDigestSha256,
  }
  index.indexDigestSha256 = stableSha256({ ...index, indexDigestSha256: undefined })
  await writeFile(join(out, 'payload-index.json'), `${JSON.stringify(index, null, 2)}\n`)
  if (complete && !skipReview) {
    const bounds = unionBounds(packages, 'web')
    const handoff = {
      schema: 'IOM_UNOWNED_STATIC_VISUAL_QA_HANDOFF',
      version: 1,
      enabled: false,
      activationApproved: false,
      status: 'pending-matched-camera-render-and-human-review',
      index: { path: './payload-index.json', sha256: (await fileRecord(join(out, 'payload-index.json'))).sha256 },
      cameras: camerasForBounds(bounds),
      variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
        sourceReference: index.variants[variant].review.sourceReference,
        emittedComposite: index.variants[variant].review.emittedComposite,
      }])),
      automatedThresholds: {
        minimumSourceProjectionCoveragePercent: 99.9,
        minimumProjectionPrecisionPercent: 99.9,
        minimumIntersectionOverUnionPercent: 99.8,
        maximumSamePixelDepthDeltaMetres: 0.001,
      },
      requiredReview: [
        'Render both assets with identical camera, clipping, projection, visibility, material, light, and alpha settings.',
        'Compare silhouettes and depth before color so texture or lighting differences cannot conceal geometry omissions.',
        'Review exterior, interior, underside, mirrored transforms, thin wall faces, and transparent ordering.',
        'Record Web and Quest separately, then compare their aligned projections without assuming identical topology.',
      ],
    }
    await writeFile(join(out, 'visual-qa-handoff.json'), `${JSON.stringify(handoff, null, 2)}\n`)
  }
  return { index, out }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { index, out } = await buildUnownedStaticPayloadCandidate(args)
  console.log(`Disabled unowned static payload emission: ${index.completePlannedPackageSet ? 'COMPLETE' : 'DIAGNOSTIC SUBSET'}`)
  console.log(`  output: ${out}`)
  console.log(`  packages: ${index.packageCount}`)
  for (const variant of VARIANTS) {
    const summary = index.variants[variant].emitted
    console.log(`  ${variant}: ${summary.sourceUnitCount.toLocaleString()} units / ${summary.expandedTriangles.toLocaleString()} tris / ${summary.payloadDraws.toLocaleString()} draws / ${summary.payloadBytes.toLocaleString()} bytes`)
    console.log(`  ${variant} per-payload byte gate: ${index.variants[variant].byteGatePass ? 'PASS' : 'FAIL'}`)
  }
  console.log('  production routing changed: false')
  console.log('  activation approved: false')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
