/**
 * Independent, fail-closed audit for the disabled __unowned__ static payload
 * candidate. Every emitted primitive-instance is reconstructed from the pinned
 * production source rather than trusted from emitter metadata.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { getTextureColorSpace, listTextureInfo } from '@gltf-transform/functions'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const DEFAULT_INDEX = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-payload-candidate-v1', 'payload-index.json')
const VARIANTS = Object.freeze(['web', 'quest'])
const SHA256 = /^[a-f0-9]{64}$/
const IOM_NODE_EXTRAS = new Set([
  'iomPayloadPackageId', 'iomSourceNodeId', 'iomSourcePath', 'iomPrimitiveIndex',
  'iomTransformParity', 'iomSourceInstanceIndices', 'iomSourceUnitIds', 'iomSourceUnitIdsSha256',
])

function parseArgs(argv) {
  const args = { index: DEFAULT_INDEX, out: null, compareIndex: null, allowSubset: false }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--index') args.index = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--out') args.out = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--compare-index') args.compareIndex = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--allow-subset') args.allowSubset = true
    else throw new Error(`Unknown argument: ${value}`)
  }
  if (!args.out) args.out = resolve(dirname(args.index), 'payload-audit.json')
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
    if (!Number.isFinite(value)) return null
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

function semanticStaticMapping(plan) {
  if (plan?.version === 1) return plan.correspondence?.semanticStaticMapping ?? null
  if (plan?.version === 2) return plan.correspondence?.inheritedV1?.semanticStaticMapping ?? null
  return null
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

async function auditPinnedFile(pin, label, gate) {
  gate(Boolean(pin && typeof pin.path === 'string'), `${label}: file pin is missing`)
  if (!pin || typeof pin.path !== 'string') return null
  try {
    const path = resolveProjectPath(pin.path)
    const bytes = await readFile(path)
    gate(pin.bytes === bytes.length, `${label}: pinned byte count is stale`)
    gate(pin.sha256 === sha256(bytes), `${label}: pinned SHA-256 is stale`)
    return { path, bytes }
  } catch (error) {
    gate(false, `${label}: pinned file cannot be read: ${error.message}`)
    return null
  }
}

function stringListSha256(values) {
  return sha256(JSON.stringify([...values].sort()))
}

function exactJsonEqual(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
}

function resolveProjectPath(value, base = VIEWER_ROOT) {
  assert.equal(typeof value, 'string', 'Artifact path is missing')
  return resolve(base, value)
}

function cloneWithoutIomExtras(extras) {
  if (!extras || typeof extras !== 'object') return {}
  return Object.fromEntries(Object.entries(extras).filter(([key]) => !IOM_NODE_EXTRAS.has(key)))
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
    const scale = instancing.getAttribute('SCALE')
    const size = scale
      ? new Vector3(...Array.from({ length: 3 }, (__, axis) => normalizedAccessorValue(scale, index * 3 + axis)))
      : new Vector3(1, 1, 1)
    return new Matrix4().compose(position, quaternion, size)
  })
}

function maxMatrixDelta(left, right) {
  return Math.max(...left.map((value, index) => Math.abs(value - right[index])))
}

function rawAccessorBytes(accessor) {
  const array = accessor.getArray()
  assert.ok(array, 'Accessor has no array')
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength)
}

function accessorSignature(accessor) {
  if (!accessor) return null
  return stableValue({
    type: accessor.getType(),
    componentType: accessor.getComponentType(),
    normalized: accessor.getNormalized(),
    count: accessor.getCount(),
    min: accessor.getMin([]),
    max: accessor.getMax([]),
    extras: accessor.getExtras(),
    arraySha256: sha256(rawAccessorBytes(accessor)),
  })
}

function compareTriples(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

function orientedTriangleMultisetSha256(accessor) {
  const array = accessor.getArray()
  assert.ok(array, 'Triangle index accessor has no array')
  assert.equal(array.length % 3, 0, 'Triangle index accessor is not divisible into triples')
  const triangles = []
  for (let index = 0; index < array.length; index += 3) {
    const triangle = [array[index], array[index + 1], array[index + 2]]
    const rotations = [
      triangle,
      [triangle[1], triangle[2], triangle[0]],
      [triangle[2], triangle[0], triangle[1]],
    ]
    rotations.sort(compareTriples)
    triangles.push(rotations[0])
  }
  triangles.sort(compareTriples)
  return sha256(JSON.stringify(triangles))
}

function indexAccessorSignature(primitive) {
  const accessor = primitive.getIndices()
  const signature = accessorSignature(accessor)
  if (!accessor || primitive.getMode() !== 4) return signature
  const { arraySha256: _transportOrderSha256, ...topologySignature } = signature
  return {
    ...topologySignature,
    indexOrderPolicy: 'winding-preserving-oriented-triangle-multiset',
    orientedTriangleMultisetSha256: orientedTriangleMultisetSha256(accessor),
  }
}

function textureBinding(texture, info, extra = {}) {
  if (!texture) return null
  const image = texture.getImage()
  const transform = info?.getExtension?.('KHR_texture_transform')
  return stableValue({
    name: texture.getName(),
    mimeType: texture.getMimeType(),
    imageSha256: image ? sha256(image) : null,
    textureExtras: Object.fromEntries(Object.entries(texture.getExtras() || {})
      .filter(([key]) => key !== 'iomSharedTexture')),
    texCoord: transform?.getTexCoord?.() ?? info?.getTexCoord?.() ?? 0,
    magFilter: info?.getMagFilter?.() ?? null,
    minFilter: info?.getMinFilter?.() ?? null,
    wrapS: info?.getWrapS?.() ?? 10497,
    wrapT: info?.getWrapT?.() ?? 10497,
    transform: transform ? {
      offset: transform.getOffset(),
      rotation: transform.getRotation(),
      scale: transform.getScale(),
      texCoord: transform.getTexCoord(),
      extras: transform.getExtras(),
    } : null,
    ...extra,
  })
}

function materialSignature(material) {
  if (!material) return null
  const specular = material.getExtension('KHR_materials_specular')
  const transmission = material.getExtension('KHR_materials_transmission')
  const ior = material.getExtension('KHR_materials_ior')
  const emissiveStrength = material.getExtension('KHR_materials_emissive_strength')
  return stableValue({
    name: material.getName(),
    extras: material.getExtras(),
    baseColorFactor: material.getBaseColorFactor(),
    metallicFactor: material.getMetallicFactor(),
    roughnessFactor: material.getRoughnessFactor(),
    emissiveFactor: material.getEmissiveFactor(),
    alphaMode: material.getAlphaMode(),
    alphaCutoff: material.getAlphaCutoff(),
    doubleSided: material.getDoubleSided(),
    baseColorTexture: textureBinding(material.getBaseColorTexture(), material.getBaseColorTextureInfo()),
    metallicRoughnessTexture: textureBinding(material.getMetallicRoughnessTexture(), material.getMetallicRoughnessTextureInfo()),
    normalTexture: textureBinding(material.getNormalTexture(), material.getNormalTextureInfo(), {
      normalScale: material.getNormalTextureInfo()?.getScale?.() ?? 1,
    }),
    occlusionTexture: textureBinding(material.getOcclusionTexture(), material.getOcclusionTextureInfo(), {
      occlusionStrength: material.getOcclusionTextureInfo()?.getStrength?.() ?? 1,
    }),
    emissiveTexture: textureBinding(material.getEmissiveTexture(), material.getEmissiveTextureInfo()),
    extensions: {
      specular: specular ? {
        factor: specular.getSpecularFactor(), colorFactor: specular.getSpecularColorFactor(), extras: specular.getExtras(),
        texture: textureBinding(specular.getSpecularTexture(), specular.getSpecularTextureInfo()),
        colorTexture: textureBinding(specular.getSpecularColorTexture(), specular.getSpecularColorTextureInfo()),
      } : null,
      transmission: transmission ? {
        factor: transmission.getTransmissionFactor(), extras: transmission.getExtras(),
        texture: textureBinding(transmission.getTransmissionTexture(), transmission.getTransmissionTextureInfo()),
      } : null,
      ior: ior ? { ior: ior.getIOR(), extras: ior.getExtras() } : null,
      emissiveStrength: emissiveStrength ? {
        strength: emissiveStrength.getEmissiveStrength(), extras: emissiveStrength.getExtras(),
      } : null,
    },
  })
}

function primitiveSignature(primitive) {
  return stableValue({
    name: primitive.getName(),
    extras: primitive.getExtras(),
    mode: primitive.getMode(),
    extensionNames: primitive.listExtensions().map((extension) => extension.extensionName).sort(),
    indices: indexAccessorSignature(primitive),
    attributes: primitive.listSemantics().sort().map((semantic) => [semantic, accessorSignature(primitive.getAttribute(semantic))]),
    targets: primitive.listTargets().map((target) => ({
      name: target.getName(), extras: target.getExtras(),
      attributes: target.listSemantics().sort().map((semantic) => [semantic, accessorSignature(target.getAttribute(semantic))]),
    })),
    material: materialSignature(primitive.getMaterial()),
  })
}

function triangleCount(primitive) {
  const elements = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
  switch (primitive.getMode()) {
    case 4: return Math.floor(elements / 3)
    case 5:
    case 6: return Math.max(0, elements - 2)
    default: return 0
  }
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

function conservativePrimitiveBounds(primitive, matrix) {
  const position = primitive.getAttribute('POSITION')
  assert.ok(position, 'Primitive has no POSITION')
  const min = position.getMin([])
  const max = position.getMax([])
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  const point = new Vector3()
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    point.set(x, y, z).applyMatrix4(matrix)
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], point.getComponent(axis))
      bounds.max[axis] = Math.max(bounds.max[axis], point.getComponent(axis))
    }
  }
  return bounds
}

function expandBounds(target, source) {
  for (let axis = 0; axis < 3; axis += 1) {
    target.min[axis] = Math.min(target.min[axis], source.min[axis])
    target.max[axis] = Math.max(target.max[axis], source.max[axis])
  }
}

function maxBoundsDelta(left, right) {
  if (!left || !right) return Infinity
  return Math.max(...left.min.map((value, axis) => Math.abs(value - right.min[axis])),
    ...left.max.map((value, axis) => Math.abs(value - right.max[axis])))
}

function sourceMaps(plan, variant, document) {
  const nodes = document.getRoot().listNodes()
  const nodeById = new Map()
  for (const record of plan.variants[variant].nodes) {
    const node = nodes[record.sourceNodeIndex]
    assert.ok(node?.getMesh(), `${variant}:${record.id} does not resolve to a source render node`)
    nodeById.set(record.id, { record, node })
  }
  return {
    nodeById,
    unitById: new Map(plan.variants[variant].units.map((unit) => [unit.id, unit])),
  }
}

function expectedGroups(units, packageForUnit, sourceReference = false) {
  const groups = new Map()
  for (const unit of units) {
    const packagePart = sourceReference ? 'source-reference' : packageForUnit.get(unit.id)
    const key = `${packagePart}|${unit.nodeId}|${unit.primitiveIndex}|${unit.transformParity}`
    const list = groups.get(key) || []
    list.push(unit)
    groups.set(key, list)
  }
  for (const list of groups.values()) list.sort((left, right) => left.instanceIndex - right.instanceIndex)
  return groups
}

async function inspectPayload({
  io, path, record, expectedUnits, maps, packageForUnit, transportCompression,
  sourceReference = false, gate,
}) {
  const actualFile = await fileRecord(path)
  gate(actualFile.bytes === record.bytes, `${path}: byte count differs from index`)
  gate(actualFile.sha256 === record.sha256, `${path}: SHA-256 differs from index`)
  const document = await io.read(path)
  const root = document.getRoot()
  gate(root.listScenes().length === 1, `${path}: expected exactly one scene`)
  gate(root.listAnimations().length === 0, `${path}: static payload unexpectedly contains animations`)
  gate(root.listSkins().length === 0, `${path}: static payload unexpectedly contains skins`)
  const meshopt = root.listExtensionsUsed()
    .find((extension) => extension.extensionName === 'EXT_meshopt_compression')
  gate(Boolean(meshopt), `${path}: required lossless Meshopt transport encoding is missing`)
  gate(meshopt?.isRequired() === transportCompression.required,
    `${path}: Meshopt required/optional status differs from the candidate contract`)
  const groups = expectedGroups(expectedUnits, packageForUnit, sourceReference)
  const seenGroups = new Set()
  const seenUnits = []
  const emittedBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  let expandedTriangles = 0
  let maxNodeWorldMatrixDelta = 0
  let maxInstanceWorldMatrixDelta = 0
  let semanticComparisons = 0
  const meshNodes = root.listNodes().filter((node) => node.getMesh())
  gate(meshNodes.length === groups.size, `${path}: ${meshNodes.length} draw groups != expected ${groups.size}`)
  gate(root.listNodes().every((node) => node.getMesh()), `${path}: payload contains unexpected hierarchy/helper nodes`)
  for (const targetNode of meshNodes) {
    const extras = targetNode.getExtras() || {}
    const unitIds = Array.isArray(extras.iomSourceUnitIds) ? extras.iomSourceUnitIds.map(String) : []
    const sourceNodeId = extras.iomSourceNodeId
    const primitiveIndex = extras.iomPrimitiveIndex
    const parity = extras.iomTransformParity
    const packagePart = sourceReference ? 'source-reference' : extras.iomPayloadPackageId
    const key = `${packagePart}|${sourceNodeId}|${primitiveIndex}|${parity}`
    const expectedGroup = groups.get(key)
    gate(Boolean(expectedGroup), `${path}: undeclared draw group ${key}`)
    if (!expectedGroup) continue
    gate(!seenGroups.has(key), `${path}: duplicate draw group ${key}`)
    seenGroups.add(key)
    const expectedIds = expectedGroup.map((unit) => unit.id)
    gate(exactJsonEqual(unitIds, expectedIds), `${path}:${key}: source unit ordering/identity changed`)
    gate(extras.iomSourceUnitIdsSha256 === stringListSha256(expectedIds), `${path}:${key}: source unit digest is stale`)
    const expectedIndices = expectedGroup.map((unit) => unit.instanceIndex)
    gate(exactJsonEqual(extras.iomSourceInstanceIndices, expectedIndices), `${path}:${key}: instance selection changed`)
    const sourceEntry = maps.nodeById.get(sourceNodeId)
    gate(Boolean(sourceEntry), `${path}:${key}: source node identity is unknown`)
    if (!sourceEntry) continue
    const sourceNode = sourceEntry.node
    gate(targetNode.getName() === sourceNode.getName(), `${path}:${key}: node name changed`)
    gate(exactJsonEqual(cloneWithoutIomExtras(extras), sourceNode.getExtras()), `${path}:${key}: source node extras changed`)
    gate(exactJsonEqual(targetNode.getWeights(), sourceNode.getWeights()), `${path}:${key}: node morph weights changed`)
    gate(extras.iomSourcePath === expectedGroup[0].sourcePath, `${path}:${key}: source path changed`)
    gate(targetNode.getParentNode() === null, `${path}:${key}: flattened world-space node has a parent`)
    const nodeDelta = maxMatrixDelta(targetNode.getWorldMatrix(), sourceNode.getWorldMatrix())
    maxNodeWorldMatrixDelta = Math.max(maxNodeWorldMatrixDelta, nodeDelta)
    gate(nodeDelta <= 1e-9, `${path}:${key}: source node world transform drift ${nodeDelta}`)
    const targetMesh = targetNode.getMesh()
    const sourceMesh = sourceNode.getMesh()
    gate(targetMesh.listPrimitives().length === 1, `${path}:${key}: target mesh must contain exactly one primitive`)
    gate(targetMesh.getName() === sourceMesh.getName(), `${path}:${key}: mesh name changed`)
    gate(exactJsonEqual(targetMesh.getExtras(), sourceMesh.getExtras()), `${path}:${key}: mesh extras changed`)
    gate(exactJsonEqual(targetMesh.getWeights(), sourceMesh.getWeights()), `${path}:${key}: mesh morph weights changed`)
    const targetPrimitive = targetMesh.listPrimitives()[0]
    const sourcePrimitive = sourceMesh.listPrimitives()[primitiveIndex]
    gate(Boolean(sourcePrimitive), `${path}:${key}: source primitive is missing`)
    if (!sourcePrimitive) continue
    const sourceSignature = primitiveSignature(sourcePrimitive)
    const targetSignature = primitiveSignature(targetPrimitive)
    semanticComparisons += 1
    gate(exactJsonEqual(targetSignature, sourceSignature), `${path}:${key}: attributes/material/texture semantics changed`)
    const sourceInstancing = sourceNode.getExtension('EXT_mesh_gpu_instancing')
    const targetInstancing = targetNode.getExtension('EXT_mesh_gpu_instancing')
    if (sourceInstancing) {
      gate(Boolean(targetInstancing), `${path}:${key}: EXT_mesh_gpu_instancing was lost`)
      if (targetInstancing) {
        const sourceSemantics = sourceInstancing.listSemantics().sort()
        const targetSemantics = targetInstancing.listSemantics().sort()
        gate(exactJsonEqual(targetSemantics, sourceSemantics), `${path}:${key}: instance attribute semantics changed`)
        for (const semantic of sourceSemantics) {
          const sourceAccessor = sourceInstancing.getAttribute(semantic)
          const targetAccessor = targetInstancing.getAttribute(semantic)
          gate(Boolean(targetAccessor), `${path}:${key}: missing instance attribute ${semantic}`)
          if (!targetAccessor) continue
          gate(targetAccessor.getType() === sourceAccessor.getType(), `${path}:${key}:${semantic}: accessor type changed`)
          gate(targetAccessor.getComponentType() === sourceAccessor.getComponentType(), `${path}:${key}:${semantic}: component type changed`)
          gate(targetAccessor.getNormalized() === sourceAccessor.getNormalized(), `${path}:${key}:${semantic}: normalized flag changed`)
          gate(exactJsonEqual(targetAccessor.getExtras(), sourceAccessor.getExtras()), `${path}:${key}:${semantic}: extras changed`)
          const elementSize = sourceAccessor.getElementSize()
          const sourceArray = sourceAccessor.getArray()
          const ExpectedArray = sourceArray.constructor
          const expectedArray = new ExpectedArray(expectedIndices.length * elementSize)
          expectedIndices.forEach((sourceIndex, targetIndex) => expectedArray.set(
            sourceArray.subarray(sourceIndex * elementSize, (sourceIndex + 1) * elementSize),
            targetIndex * elementSize,
          ))
          gate(Buffer.compare(rawAccessorBytes(targetAccessor), Buffer.from(expectedArray.buffer)) === 0,
            `${path}:${key}:${semantic}: selected instance values changed`)
        }
      }
    } else {
      gate(!targetInstancing, `${path}:${key}: non-instanced source gained instancing`)
      gate(exactJsonEqual(expectedIndices, [0]), `${path}:${key}: non-instanced source has invalid instance index`)
    }
    const sourceLocals = instanceLocalMatrices(sourceNode)
    const targetLocals = instanceLocalMatrices(targetNode)
    gate(targetLocals.length === expectedIndices.length, `${path}:${key}: emitted logical instance count changed`)
    for (let index = 0; index < Math.min(targetLocals.length, expectedIndices.length); index += 1) {
      const sourceWorld = new Matrix4().fromArray(sourceNode.getWorldMatrix()).multiply(sourceLocals[expectedIndices[index]])
      const targetWorld = new Matrix4().fromArray(targetNode.getWorldMatrix()).multiply(targetLocals[index])
      const delta = maxMatrixDelta(sourceWorld.toArray(), targetWorld.toArray())
      maxInstanceWorldMatrixDelta = Math.max(maxInstanceWorldMatrixDelta, delta)
      gate(delta <= 1e-8, `${path}:${key}: instance world transform drift ${delta}`)
      const bounds = conservativePrimitiveBounds(targetPrimitive, targetWorld)
      expandBounds(emittedBounds, bounds)
      expandedTriangles += triangleCount(targetPrimitive)
    }
    seenUnits.push(...unitIds)
  }
  const expectedIds = expectedUnits.map((unit) => unit.id).sort()
  const actualIds = [...seenUnits].sort()
  gate(actualIds.length === new Set(actualIds).size, `${path}: duplicate emitted source unit identity`)
  gate(exactJsonEqual(actualIds, expectedIds), `${path}: omission or unexpected source unit identity`)
  gate(seenGroups.size === groups.size, `${path}: missing expected draw group`)
  return {
    bytes: actualFile.bytes,
    sha256: actualFile.sha256,
    sourceUnitCount: actualIds.length,
    sourceUnitIdsSha256: stringListSha256(actualIds),
    payloadDraws: meshNodes.length,
    expandedTriangles,
    bounds: stableValue(emittedBounds),
    maxNodeWorldMatrixDelta,
    maxInstanceWorldMatrixDelta,
    semanticComparisons,
    textureMemory: textureMetrics(document),
  }
}

function reportMarkdown(audit) {
  const rows = VARIANTS.map((variant) => {
    const summary = audit.variants[variant]
    return `| ${variant} | ${summary.packageCount} | ${summary.sourceUnitCount.toLocaleString()} | ${summary.expandedTriangles.toLocaleString()} | ${summary.payloadDraws.toLocaleString()} | ${summary.payloadBytes.toLocaleString()} | ${summary.largestPayloadBytes.toLocaleString()} | ${summary.byteGatePass ? 'PASS' : 'FAIL'} |`
  }).join('\n')
  return `# Disabled unowned static payload candidate v1\n\n` +
    `Integrity audit: **${audit.status}** (${audit.assertionCount.toLocaleString()} assertions, ${audit.failures.length} failures). ` +
    `Activation remains **not approved** and production routing is unchanged.\n\n` +
    `| Variant | Packages | Atomic units | Expanded triangles | Payload draws | Payload bytes | Largest payload | Byte gate |\n` +
    `|---|---:|---:|---:|---:|---:|---:|---|\n${rows}\n\n` +
    `Every package was independently reopened and compared to the pinned production GLB at mesh-primitive-instance granularity. The audit checks source/file hashes, byte-identical vertex accessor arrays and component types, winding-preserving oriented triangle topology, material factors and extensions, texture image bytes and sampler/UV-transform semantics, selected instancing attributes, world transforms, bounds, triangles, draws, and global multiplicity-one coverage.\n\n` +
    `The source-reference and emitted-composite review GLBs are also structurally audited. Their matched-camera raster comparison remains pending, so this evidence does not authorize runtime activation.\n\n` +
    (audit.plan.version === 1
      ? `This v1 payload candidate owns the complete remaining-static detail domain without structural-shell subtraction. Any shell selecting part of that domain is mutually exclusive until a conserved v2 plan moves its exact units out of detail ownership.\n\n`
      : `This v2 payload candidate owns only the exact detail complement declared after structural-shell subtraction. It may be composed only with the shell pinned by the same plan; a different or additive shell is forbidden.\n\n`) +
    `## Remaining release gates\n\n` + audit.unresolvedReleaseGates.map((item) => `- ${item}`).join('\n') + '\n'
}

export async function auditUnownedStaticPayloadCandidate({
  indexPath = DEFAULT_INDEX,
  outPath = resolve(dirname(DEFAULT_INDEX), 'payload-audit.json'),
  compareIndexPath = null,
  allowSubset = false,
} = {}) {
  let assertionCount = 0
  const failures = []
  const gate = (condition, message) => {
    assertionCount += 1
    if (!condition) failures.push(message)
    return condition
  }
  const indexBytes = await readFile(indexPath)
  const index = JSON.parse(indexBytes)
  gate(index.schema === 'IOM_UNOWNED_STATIC_PAYLOAD_CANDIDATE', 'Candidate schema changed')
  gate(index.version === 1, 'Candidate version changed')
  gate(index.enabled === false, 'Candidate enabled flag must remain false')
  gate(index.activationApproved === false, 'Candidate activationApproved must remain false')
  gate(index.productionModified === false, 'Candidate must not modify production')
  gate(index.productionRoutingChanged === false, 'Candidate must not change production routing')
  gate(index.owner === '__unowned__', 'Candidate owner changed')
  gate(index.atomicOwnershipUnit === 'mesh-primitive-instance', 'Atomic ownership unit changed')
  const transportCompression = index.geometryTransportCompression
  gate(transportCompression?.extension === 'EXT_meshopt_compression',
    'Geometry transport compression extension changed or is missing')
  gate(transportCompression?.required === true, 'Meshopt transport encoding must remain required')
  gate(transportCompression?.encoderMethod === 'quantize', 'Meshopt encoder method changed')
  gate(transportCompression?.preQuantizationApplied === false,
    'Lossless transport contract forbids pre-quantization')
  gate(transportCompression?.filterTransformApplied === false,
    'Lossless transport contract forbids filter transforms')
  gate(transportCompression?.reorderTransformApplied === false,
    'Lossless transport contract forbids reorder transforms')
  gate(transportCompression?.simplificationApplied === false,
    'Lossless transport contract forbids simplification')
  gate(transportCompression?.decodedVertexAccessorByteIdentityAuditRequired === true,
    'Decoded vertex-accessor byte identity audit must remain required')
  gate(transportCompression?.decodedOrientedTriangleMultisetIdentityAuditRequired === true,
    'Decoded oriented-triangle identity audit must remain required')
  gate(transportCompression?.decodedIndexOrderPreservationRequired === false,
    'Meshopt transport must not claim raw triangle-list order preservation')
  const sharedTextureResidency = index.sharedTextureResidency
  gate(sharedTextureResidency?.metadataVersion === 1, 'Shared-texture metadata version changed or is missing')
  gate(sharedTextureResidency?.metadataProperty === 'images[*].extras.iomSharedTexture',
    'Shared-texture metadata property changed')
  gate(sharedTextureResidency?.identity === 'exact-embedded-image-sha256',
    'Shared-texture content identity changed')
  gate(sharedTextureResidency?.compatibility ===
    'content-hash-plus-sampler-uv-transform-flipy-and-color-space',
  'Shared-texture compatibility contract changed')
  gate(sharedTextureResidency?.runtimeRegistryRequired === 'SharedTextureResidencyRegistry',
    'Shared-texture runtime registry requirement changed')
  gate(sharedTextureResidency?.networkExternalization === false,
    'Candidate must not claim network texture externalization')
  gate(SHA256.test(index.indexDigestSha256 || ''), 'Candidate index digest is missing')
  gate(index.indexDigestSha256 === stableSha256({ ...index, indexDigestSha256: undefined }), 'Candidate index digest is stale')
  gate(allowSubset || index.completePlannedPackageSet === true, 'Candidate is not the complete planned package set')
  const planPath = resolveProjectPath(index.plan?.path)
  const planBytes = await readFile(planPath)
  const plan = JSON.parse(planBytes)
  gate(index.plan.bytes === planBytes.length, 'Pinned plan byte count is stale')
  gate(index.plan.sha256 === sha256(planBytes), 'Pinned plan SHA-256 is stale')
  gate(plan.schema === 'IOM_UNOWNED_STATIC_PARTITION_PLAN', 'Unsupported partition plan schema')
  gate(plan.version === 1 || plan.version === 2,
    `Unsupported partition plan version: ${plan.version}; expected 1 or 2`)
  gate(plan.enabled === false, 'Partition plan must remain disabled')
  gate(plan.productionModified === false, 'Partition plan productionModified must remain false')
  gate(plan.productionRoutingChanged === false, 'Partition plan productionRoutingChanged must remain false')
  gate(plan.owner === '__unowned__', 'Partition plan owner changed')
  gate(plan.atomicOwnershipUnit === 'mesh-primitive-instance', 'Partition plan atomic ownership unit changed')
  gate(plan.planDigestSha256 === planDigestSha256(plan), 'Partition plan digest is stale')
  gate(index.plan.schema === plan.schema, 'Index partition schema pin changed')
  gate(index.plan.version === plan.version, 'Index partition version pin changed')
  gate(index.plan.planDigestSha256 === plan.planDigestSha256, 'Plan digest changed')
  gate(index.plan.wholeLayerCoverageDigestSha256 === plan.wholeLayerCoverageDigestSha256, 'Whole-layer coverage digest changed')
  const inheritedSemanticMapping = semanticStaticMapping(plan)
  gate(Boolean(inheritedSemanticMapping), 'Inherited semantic static mapping is missing')
  gate(inheritedSemanticMapping?.primitiveMappingsSha256 ===
    planStableSha256(inheritedSemanticMapping?.primitiveMappings || []),
  'Inherited semantic primitive mapping digest is stale')
  gate(index.plan.semanticStaticMappingSha256 === inheritedSemanticMapping?.primitiveMappingsSha256,
    'Web/Quest semantic mapping digest changed')
  gate(Array.isArray(plan.staticPackages) && plan.staticPackages.length > 0, 'Partition plan has no static packages')
  const physicalPackages = physicalPlanPackages(plan)
  gate(index.plan.staticPackageCount === plan.staticPackages.length, 'Pinned static package count is stale')
  gate(index.plan.staticPackagesDigestSha256 === (plan.staticPackagesDigestSha256 ?? planStableSha256(plan.staticPackages)),
    'Pinned static package digest is stale')
  if (plan.version === 2) {
    gate(plan.ready === false, 'Partition v2 ready must remain false')
    gate(plan.activationApproved === false, 'Partition v2 activationApproved must remain false')
    gate(plan.runtimeIntegrated === false, 'Partition v2 runtimeIntegrated must remain false')
    gate(plan.staticPackagesDigestSha256 === planStableSha256(plan.staticPackages),
      'Partition v2 static package digest is stale')
    if (nearLod0PlanPackages(plan).length > 0) {
      gate(plan.shellCandidate?.nearLod0PackagesDigestSha256 === planStableSha256(nearLod0PlanPackages(plan)),
        'Partition v2 near-LOD0 package digest is stale')
      gate(plan.materialFidelity?.materialFidelityReady === true,
        'Partition v2 material-fidelity plan is not ready')
      gate(plan.materialFidelity?.nearLod0PackagePresent === true,
        'Partition v2 near-LOD0 package declaration is missing')
      gate(plan.materialFidelity?.explicitReplacementSemanticsValidated === true,
        'Partition v2 proxy/near replacement semantics are not validated')
    }
    gate(plan.correspondence?.semanticRecordMultiplicityOne === true,
      'Partition v2 semantic records are not multiplicity one')
    gate(plan.correspondence?.shellRecordCount + plan.correspondence?.detailRecordCount ===
      plan.correspondence?.partitionedRecordCount,
    'Partition v2 semantic record conservation is stale')
    gate(index.plan.evidencePinsSha256 === planStableSha256(plan.evidencePins), 'Partition v2 evidence-pin digest changed')
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
    for (const [key, label] of requiredPins) verified[key] = await auditPinnedFile(plan.evidencePins?.[key], label, gate)
    if (verified.sourcePartitionPlan) {
      const inheritedPlan = JSON.parse(verified.sourcePartitionPlan.bytes)
      gate(inheritedPlan.schema === plan.schema && inheritedPlan.version === 1,
        'Partition v2 source partition pin is not v1')
      gate(plan.evidencePins.sourcePartitionPlan.planDigestSha256 === inheritedPlan.planDigestSha256,
        'Inherited v1 partition digest pin is stale')
      gate(planStableSha256(plan.correspondence.inheritedV1) === planStableSha256(inheritedPlan.correspondence),
        'Partition v2 inherited correspondence differs from pinned v1')
      gate(planStableSha256(inheritedSemanticMapping) ===
        planStableSha256(inheritedPlan.correspondence.semanticStaticMapping),
      'Partition v2 inherited semantic mapping differs from pinned v1')
    }
    if (verified.wholeLayerContract) {
      const wholeLayer = JSON.parse(verified.wholeLayerContract.bytes)
      gate(plan.evidencePins.wholeLayerContract.coverageDigestSha256 === wholeLayer.coverageDigestSha256,
        'Pinned whole-layer contract coverage digest is stale')
      gate(plan.wholeLayerCoverageDigestSha256 === wholeLayer.coverageDigestSha256,
        'Plan whole-layer coverage digest differs from pinned contract')
    }
    for (const variant of VARIANTS) await auditPinnedFile(
      plan.shellCandidate?.variants?.[variant]?.output,
      `${variant} structural shell output`,
      gate,
    )
  } else {
    gate(index.plan.evidencePinsSha256 === null, 'Partition v1 must not declare v2 evidence-pin digest')
  }
  gate(index.plan.physicalPackageCount === undefined || index.plan.physicalPackageCount === physicalPackages.length,
    'Pinned physical package count is stale')
  gate(index.plan.nearLod0PackageCount === undefined ||
    index.plan.nearLod0PackageCount === nearLod0PlanPackages(plan).length,
  'Pinned near-LOD0 package count is stale')
  if (plan.version === 2 && nearLod0PlanPackages(plan).length > 0) {
    gate(index.plan.nearLod0PackagesDigestSha256 ===
      (plan.shellCandidate?.nearLod0PackagesDigestSha256 ?? planStableSha256(nearLod0PlanPackages(plan))),
    'Pinned near-LOD0 package digest is stale')
  }
  gate(allowSubset || index.packageCount === physicalPackages.length,
    `Candidate must contain all ${physicalPackages.length} planned physical package records`)
  gate(index.packageCount === index.packages.length, 'Candidate package count is stale')
  gate(new Set(index.packages.map((pkg) => pkg.id)).size === index.packages.length, 'Candidate package IDs are duplicated')
  const expectedPackages = allowSubset
    ? physicalPackages.filter((pkg) => index.packages.some((entry) => entry.id === pkg.id))
    : physicalPackages
  gate(exactJsonEqual(index.packages.map((pkg) => pkg.id).sort(), expectedPackages.map((pkg) => pkg.id).sort()),
    'Candidate package IDs differ from the pinned plan')
  for (const variant of VARIANTS) {
    const inventoryUnits = plan.variants?.[variant]?.units || []
    const unitById = new Map(inventoryUnits.map((unit) => [unit.id, unit]))
    gate(inventoryUnits.length > 0, `${variant}: partition source-unit inventory is missing`)
    gate(unitById.size === inventoryUnits.length, `${variant}: partition source-unit inventory contains duplicates`)
    const detailIds = []
    for (const pkg of plan.staticPackages) {
      gate(pkg.enabled === false, `${variant}:${pkg.id}: planned package must remain disabled`)
      gate(pkg.owner === '__unowned__', `${variant}:${pkg.id}: planned package owner changed`)
      const metrics = pkg.variants?.[variant]
      gate(Boolean(metrics), `${variant}:${pkg.id}: planned metrics are missing`)
      if (!metrics) continue
      const ids = metrics.sourceUnitIds || []
      gate(new Set(ids).size === ids.length, `${variant}:${pkg.id}: planned source units are duplicated`)
      const selected = ids.map((id) => unitById.get(id)).filter(Boolean)
      gate(selected.length === ids.length, `${variant}:${pkg.id}: planned source unit is unknown`)
      gate(metrics.atomicUnitCount === ids.length, `${variant}:${pkg.id}: planned atomic count is stale`)
      gate(metrics.expandedTriangles === selected.reduce((sum, unit) => sum + unit.triangles, 0),
        `${variant}:${pkg.id}: planned triangle count is stale`)
      gate(metrics.projectedDraws === new Set(selected.map((unit) =>
        `${unit.nodeId}/primitive/${unit.primitiveIndex}/${unit.transformParity}`)).size,
      `${variant}:${pkg.id}: planned draw count is stale`)
      detailIds.push(...ids)
    }
    gate(new Set(detailIds).size === detailIds.length, `${variant}: planned detail ownership contains duplicates`)
    const nearPackages = nearLod0PlanPackages(plan)
    const nearIds = []
    for (const pkg of nearPackages) {
      gate(pkg.enabled === false, `${variant}:${pkg.id}: planned near-LOD0 package must remain disabled`)
      gate(pkg.owner === '__unowned__', `${variant}:${pkg.id}: planned near-LOD0 owner changed`)
      gate(pkg.nearLod0 === true, `${variant}:${pkg.id}: planned near-LOD0 marker is missing`)
      gate(pkg.materialFidelity?.preservesSourceGeometry === true,
        `${variant}:${pkg.id}: planned near-LOD0 source geometry preservation is missing`)
      gate(pkg.materialFidelity?.preservesSourcePbrMaterials === true,
        `${variant}:${pkg.id}: planned near-LOD0 PBR preservation is missing`)
      gate(pkg.replacementSemantics?.mutuallyExclusiveAtSteadyState === true,
        `${variant}:${pkg.id}: planned proxy/near exclusivity is missing`)
      gate(pkg.replacementSemantics?.additiveCompositionAllowed === false,
        `${variant}:${pkg.id}: planned additive structural composition is unsafe`)
      gate(pkg.replacementSemantics?.loadBeforeRetire === true,
        `${variant}:${pkg.id}: planned load-before-retire replacement is missing`)
      const metrics = pkg.variants?.[variant]
      gate(Boolean(metrics), `${variant}:${pkg.id}: planned near-LOD0 metrics are missing`)
      if (!metrics) continue
      const ids = metrics.sourceUnitIds || []
      gate(new Set(ids).size === ids.length, `${variant}:${pkg.id}: planned near-LOD0 units are duplicated`)
      const selected = ids.map((id) => unitById.get(id)).filter(Boolean)
      gate(selected.length === ids.length, `${variant}:${pkg.id}: planned near-LOD0 unit is unknown`)
      gate(metrics.atomicUnitCount === ids.length, `${variant}:${pkg.id}: planned near-LOD0 atomic count is stale`)
      gate(metrics.expandedTriangles === selected.reduce((sum, unit) => sum + unit.triangles, 0),
        `${variant}:${pkg.id}: planned near-LOD0 triangle count is stale`)
      gate(metrics.projectedDraws === new Set(selected.map((unit) =>
        `${unit.nodeId}/primitive/${unit.primitiveIndex}/${unit.transformParity}`)).size,
      `${variant}:${pkg.id}: planned near-LOD0 draw count is stale`)
      nearIds.push(...ids)
    }
    gate(new Set(nearIds).size === nearIds.length, `${variant}: planned near-LOD0 ownership contains duplicates`)
    if (nearPackages.length > 0) {
      gate(exactJsonEqual([...nearIds].sort(), [...shellUnitIds(plan, variant)].sort()),
        `${variant}: planned near-LOD0 packages do not exactly cover the structural proxy claim`)
    }
    const union = [
      ...repeatUnitIds(plan, variant),
      ...fireUnitIds(plan, variant),
      ...shellUnitIds(plan, variant),
      ...detailIds,
    ]
    gate(new Set(union).size === union.length, `${variant}: partition ownership segments overlap`)
    gate(exactJsonEqual([...union].sort(), [...unitById.keys()].sort()), `${variant}: partition ownership conservation failed`)
    if (plan.version === 2) {
      const detail = plan.detailComplement?.variants?.[variant]
      gate(detail?.atomicUnitCount === detailIds.length, `${variant}: v2 detail complement count is stale`)
      gate(detail?.sourceUnitIdsSha256 === stringListSha256(detailIds), `${variant}: v2 detail complement digest is stale`)
      gate(detail?.requiredPayloadInputUnitIdsSha256 === stringListSha256(detailIds),
        `${variant}: v2 payload-input digest is stale`)
      gate(plan.projection?.[variant]?.detail?.packageCount === plan.staticPackages.length,
        `${variant}: v2 projection package count is stale`)
      gate(plan.projection?.[variant]?.detail?.atomicUnitCount === detailIds.length,
        `${variant}: v2 projection detail count is stale`)
      gate(plan.conservation?.variants?.[variant]?.detailAtomicUnits === detailIds.length,
        `${variant}: v2 conservation detail count is stale`)
      gate(plan.conservation?.variants?.[variant]?.unionAtomicUnits === union.length,
        `${variant}: v2 conservation union count is stale`)
      gate(plan.conservation?.variants?.[variant]?.omittedAtomicUnits === 0,
        `${variant}: v2 conservation reports omissions`)
      gate(plan.conservation?.variants?.[variant]?.overlapAtomicUnits === 0,
        `${variant}: v2 conservation reports overlap`)
      gate(plan.conservation?.variants?.[variant]?.multiplicityOne === true,
        `${variant}: v2 conservation is not multiplicity one`)
    }
  }
  const io = await createGltfIO()
  const sourceDocuments = {}
  const maps = {}
  for (const variant of VARIANTS) {
    const sourcePath = resolveProjectPath(index.variants[variant].source.path)
    const sourceFile = await fileRecord(sourcePath)
    gate(sourceFile.bytes === index.variants[variant].source.bytes, `${variant}: source byte count is stale`)
    gate(sourceFile.sha256 === index.variants[variant].source.sha256, `${variant}: source SHA-256 is stale`)
    gate(sourceFile.sha256 === plan.variants[variant].source.sha256, `${variant}: source differs from partition plan`)
    gate(index.variants[variant].wholeLayerVariantCoverageDigestSha256 === plan.variants[variant].wholeLayerVariantCoverageDigestSha256,
      `${variant}: whole-layer variant coverage digest changed`)
    sourceDocuments[variant] = await io.read(sourcePath)
    maps[variant] = sourceMaps(plan, variant, sourceDocuments[variant])
  }
  const packageForUnit = Object.fromEntries(VARIANTS.map((variant) => [variant, new Map()]))
  for (const pkg of expectedPackages) for (const variant of VARIANTS) {
    for (const id of pkg.variants[variant].sourceUnitIds) {
      gate(!packageForUnit[variant].has(id), `${variant}:${id} is planned by more than one package`)
      packageForUnit[variant].set(id, pkg.id)
    }
  }
  const summaries = Object.fromEntries(VARIANTS.map((variant) => [variant, {
    packageCount: 0, sourceUnitCount: 0, expandedTriangles: 0, payloadDraws: 0,
    payloadBytes: 0, largestPayloadBytes: 0, byteGatePass: true,
    embeddedEncodedImageBytes: 0, conservativeDecodedImageBytesRgba8: 0,
    largestPayloadConservativeDecodedImageBytesRgba8: 0,
    maxNodeWorldMatrixDelta: 0, maxInstanceWorldMatrixDelta: 0, semanticComparisons: 0,
  }]))
  const allActualIds = Object.fromEntries(VARIANTS.map((variant) => [variant, []]))
  const nearPackageIds = new Set(nearLod0PlanPackages(plan).map((pkg) => pkg.id))
  for (const packageIndex of index.packages) {
    const packagePlan = expectedPackages.find((pkg) => pkg.id === packageIndex.id)
    gate(Boolean(packagePlan), `${packageIndex.id}: package is absent from pinned plan`)
    if (!packagePlan) continue
    gate(packageIndex.enabled === false, `${packageIndex.id}: package enabled flag must remain false`)
    for (const variant of VARIANTS) {
      const expectedIds = packagePlan.variants[variant].sourceUnitIds
      const expectedUnits = expectedIds.map((id) => maps[variant].unitById.get(id)).filter(Boolean)
      gate(expectedUnits.length === expectedIds.length, `${variant}:${packageIndex.id}: plan contains unknown source units`)
      const entry = packageIndex.variants[variant]
      gate(entry.packageId === packageIndex.id, `${variant}:${packageIndex.id}: nested package ID changed`)
      gate(entry.sourceUnitCount === expectedIds.length, `${variant}:${packageIndex.id}: source unit count changed`)
      gate(exactJsonEqual(entry.sourceUnitIds, expectedIds), `${variant}:${packageIndex.id}: source unit IDs changed`)
      gate(entry.sourceUnitIdsSha256 === stringListSha256(expectedIds), `${variant}:${packageIndex.id}: source unit digest changed`)
      gate(entry.expandedTriangles === packagePlan.variants[variant].expandedTriangles,
        `${variant}:${packageIndex.id}: declared triangle count changed`)
      gate(entry.payloadDraws === packagePlan.variants[variant].projectedDraws,
        `${variant}:${packageIndex.id}: declared draw count changed`)
      gate(maxBoundsDelta(entry.bounds, packagePlan.variants[variant].bounds) <= 1e-8,
        `${variant}:${packageIndex.id}: declared bounds changed`)
      const assetPath = resolveProjectPath(entry.asset.path, dirname(indexPath))
      let actual
      try {
        actual = await inspectPayload({
          io, path: assetPath, record: entry.asset, expectedUnits, maps: maps[variant],
          packageForUnit: packageForUnit[variant], transportCompression, gate,
        })
      } catch (error) {
        gate(false, `${variant}:${packageIndex.id}: payload inspection failed: ${error.message}`)
        continue
      }
      gate(actual.sourceUnitCount === entry.sourceUnitCount, `${variant}:${packageIndex.id}: emitted unit count differs from index`)
      gate(actual.sourceUnitIdsSha256 === entry.sourceUnitIdsSha256, `${variant}:${packageIndex.id}: emitted unit digest differs from index`)
      gate(actual.expandedTriangles === entry.expandedTriangles, `${variant}:${packageIndex.id}: emitted triangles differ from index`)
      gate(actual.payloadDraws === entry.payloadDraws, `${variant}:${packageIndex.id}: emitted draws differ from index`)
      gate(exactJsonEqual(actual.textureMemory, entry.textureMemory),
        `${variant}:${packageIndex.id}: actual texture memory/image digest metrics differ from index`)
      gate(maxBoundsDelta(actual.bounds, entry.bounds) <= 2e-5, `${variant}:${packageIndex.id}: emitted bounds drifted`)
      gate(entry.requiredEmittedGlbBytes === plan.planningBudgets[variant].requiredEmittedGlbBytes,
        `${variant}:${packageIndex.id}: byte gate changed`)
      gate(entry.byteGatePass === (actual.bytes <= entry.requiredEmittedGlbBytes),
        `${variant}:${packageIndex.id}: byte gate result is stale`)
      gate(actual.bytes <= entry.requiredEmittedGlbBytes,
        `${variant}:${packageIndex.id}: ${actual.bytes} bytes exceeds ${entry.requiredEmittedGlbBytes}`)
      const summary = summaries[variant]
      summary.packageCount += 1
      summary.sourceUnitCount += actual.sourceUnitCount
      summary.expandedTriangles += actual.expandedTriangles
      summary.payloadDraws += actual.payloadDraws
      summary.payloadBytes += actual.bytes
      summary.largestPayloadBytes = Math.max(summary.largestPayloadBytes, actual.bytes)
      summary.embeddedEncodedImageBytes += actual.textureMemory.embeddedEncodedImageBytes
      summary.conservativeDecodedImageBytesRgba8 += actual.textureMemory.conservativeDecodedImageBytesRgba8
      summary.largestPayloadConservativeDecodedImageBytesRgba8 = Math.max(
        summary.largestPayloadConservativeDecodedImageBytesRgba8,
        actual.textureMemory.conservativeDecodedImageBytesRgba8,
      )
      summary.byteGatePass &&= actual.bytes <= entry.requiredEmittedGlbBytes
      summary.maxNodeWorldMatrixDelta = Math.max(summary.maxNodeWorldMatrixDelta, actual.maxNodeWorldMatrixDelta)
      summary.maxInstanceWorldMatrixDelta = Math.max(summary.maxInstanceWorldMatrixDelta, actual.maxInstanceWorldMatrixDelta)
      summary.semanticComparisons += actual.semanticComparisons
      allActualIds[variant].push(...entry.sourceUnitIds)
    }
  }
  for (const variant of VARIANTS) {
    const summary = summaries[variant]
    const actualIds = allActualIds[variant].sort()
    const expectedIds = expectedPackages.flatMap((pkg) => pkg.variants[variant].sourceUnitIds).sort()
    const repeat = new Set(repeatUnitIds(plan, variant))
    const fire = new Set(fireUnitIds(plan, variant))
    const shell = new Set(shellUnitIds(plan, variant))
    const nearActualIds = index.packages
      .filter((pkg) => nearPackageIds.has(pkg.id))
      .flatMap((pkg) => pkg.variants?.[variant]?.sourceUnitIds || []).sort()
    const expectedNearIds = expectedPackages
      .filter((pkg) => nearPackageIds.has(pkg.id))
      .flatMap((pkg) => pkg.variants?.[variant]?.sourceUnitIds || []).sort()
    const detailActualIds = index.packages
      .filter((pkg) => !nearPackageIds.has(pkg.id))
      .flatMap((pkg) => pkg.variants?.[variant]?.sourceUnitIds || []).sort()
    gate(actualIds.length === new Set(actualIds).size, `${variant}: global payload ownership contains duplicates`)
    gate(exactJsonEqual(actualIds, expectedIds), `${variant}: global payload ownership has omission or unexpected unit`)
    gate(!actualIds.some((id) => repeat.has(id)), `${variant}: static payload overlaps repeat ownership`)
    gate(!actualIds.some((id) => fire.has(id)), `${variant}: static payload overlaps fire migration ownership`)
    gate(!detailActualIds.some((id) => shell.has(id)),
      `${variant}: detail payload overlaps structural proxy ownership`)
    if (nearPackageIds.size > 0) {
      gate(exactJsonEqual(nearActualIds, expectedNearIds),
        `${variant}: material-preserving near-LOD0 payloads differ from the selected plan set`)
      if (!allowSubset) gate(exactJsonEqual(nearActualIds, [...shell].sort()),
        `${variant}: complete material-preserving near-LOD0 payloads do not exactly cover the structural proxy claim`)
    } else {
      gate(nearActualIds.length === 0, `${variant}: legacy plan unexpectedly emitted near-LOD0 payloads`)
    }
    if (!allowSubset) gate(actualIds.length === expectedIds.length,
      `${variant}: complete candidate must emit exactly ${expectedIds.length.toLocaleString()} planned physical units`)
    gate(index.variants[variant].expectedSourceUnitCount === expectedIds.length, `${variant}: expected unit count is stale`)
    gate(index.variants[variant].expectedSourceUnitIdsSha256 === stringListSha256(expectedIds), `${variant}: expected unit digest is stale`)
    gate(index.variants[variant].emitted.packageCount === summary.packageCount, `${variant}: aggregate package count is stale`)
    gate(index.variants[variant].emitted.sourceUnitCount === summary.sourceUnitCount, `${variant}: aggregate unit count is stale`)
    gate(index.variants[variant].emitted.expandedTriangles === summary.expandedTriangles, `${variant}: aggregate triangles are stale`)
    gate(index.variants[variant].emitted.payloadDraws === summary.payloadDraws, `${variant}: aggregate draws are stale`)
    gate(index.variants[variant].emitted.payloadBytes === summary.payloadBytes, `${variant}: aggregate payload bytes are stale`)
    gate(index.variants[variant].emitted.largestPayloadBytes === summary.largestPayloadBytes, `${variant}: largest payload bytes are stale`)
    gate(index.variants[variant].emitted.embeddedEncodedImageBytes === summary.embeddedEncodedImageBytes,
      `${variant}: aggregate embedded encoded image bytes are stale`)
    gate(index.variants[variant].emitted.conservativeDecodedImageBytesRgba8 === summary.conservativeDecodedImageBytesRgba8,
      `${variant}: aggregate conservative decoded image bytes are stale`)
    gate(index.variants[variant].emitted.largestPayloadConservativeDecodedImageBytesRgba8 ===
      summary.largestPayloadConservativeDecodedImageBytesRgba8,
    `${variant}: largest-payload conservative decoded image bytes are stale`)
    gate(index.variants[variant].emitted.sourceUnitIdsSha256 === stringListSha256(actualIds), `${variant}: aggregate unit digest is stale`)
    gate(index.variants[variant].byteGatePass === summary.byteGatePass, `${variant}: aggregate byte gate is stale`)
    if (!allowSubset) {
      const expectedProjection = plan.version === 2
        ? {
            triangles: physicalPackages.reduce((sum, pkg) => sum + pkg.variants[variant].expandedTriangles, 0),
            draws: physicalPackages.reduce((sum, pkg) => sum + pkg.variants[variant].projectedDraws, 0),
          }
        : {
            triangles: plan.projection?.[variant]?.remainingStaticLod0?.expandedTriangles,
            draws: plan.projection?.[variant]?.remainingStaticLod0?.plannedPayloadDraws,
          }
      gate(summary.expandedTriangles === expectedProjection.triangles,
        `${variant}: static payload triangle conservation failed`)
      gate(summary.payloadDraws === expectedProjection.draws,
        `${variant}: static payload draw conservation failed`)
    }
    const review = index.variants[variant].review
    if (!allowSubset) {
      gate(Boolean(review), `${variant}: composite visual-QA handoff assets are missing`)
      if (review) {
        const expectedUnits = expectedIds.map((id) => maps[variant].unitById.get(id))
        const sourceReference = await inspectPayload({
          io,
          path: resolveProjectPath(review.sourceReference.path),
          record: review.sourceReference,
          expectedUnits,
          maps: maps[variant],
          packageForUnit: packageForUnit[variant],
          transportCompression,
          sourceReference: true,
          gate,
        })
        const emittedComposite = await inspectPayload({
          io,
          path: resolveProjectPath(review.emittedComposite.path),
          record: review.emittedComposite,
          expectedUnits,
          maps: maps[variant],
          packageForUnit: packageForUnit[variant],
          transportCompression,
          sourceReference: false,
          gate,
        })
        gate(sourceReference.sourceUnitIdsSha256 === stringListSha256(expectedIds), `${variant}: source reference coverage changed`)
        gate(emittedComposite.sourceUnitIdsSha256 === stringListSha256(expectedIds), `${variant}: emitted composite coverage changed`)
        gate(sourceReference.expandedTriangles === emittedComposite.expandedTriangles, `${variant}: review triangle parity failed`)
        gate(maxBoundsDelta(sourceReference.bounds, emittedComposite.bounds) <= 2e-5, `${variant}: review bounds parity failed`)
      }
    }
  }
  const correspondenceDigest = stableSha256(index.packages.map((record) => ({
    id: record.id,
    web: record.variants.web.sourceUnitIdsSha256,
    quest: record.variants.quest.sourceUnitIdsSha256,
  })))
  gate(index.webQuestCorrespondence.mappingPolicy === inheritedSemanticMapping?.policy,
    'Web/Quest correspondence policy changed')
  gate(index.webQuestCorrespondence.primitiveMappingsSha256 === inheritedSemanticMapping?.primitiveMappingsSha256,
    'Web/Quest primitive mapping digest changed')
  gate(index.webQuestCorrespondence.packageUnitPairDigestSha256 === correspondenceDigest,
    'Web/Quest package correspondence digest is stale')
  let deterministicRebuild = { checked: false, pass: false, compareIndex: null, compareIndexSha256: null }
  if (compareIndexPath) {
    const compareBytes = await readFile(compareIndexPath)
    const compare = JSON.parse(compareBytes)
    deterministicRebuild = {
      checked: true,
      pass: compare.reproducibilityDigestSha256 === index.reproducibilityDigestSha256,
      compareIndex: relative(VIEWER_ROOT, compareIndexPath).replaceAll('\\', '/'),
      compareIndexSha256: sha256(compareBytes),
      expectedReproducibilityDigestSha256: index.reproducibilityDigestSha256,
      actualReproducibilityDigestSha256: compare.reproducibilityDigestSha256,
    }
    gate(deterministicRebuild.pass, 'Deterministic rebuild payload/review digest differs')
  }
  const audit = {
    schema: 'IOM_UNOWNED_STATIC_PAYLOAD_AUDIT',
    version: 1,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    enabled: false,
    activationApproved: false,
    productionModified: false,
    productionRoutingChanged: false,
    index: {
      path: relative(VIEWER_ROOT, indexPath).replaceAll('\\', '/'),
      bytes: indexBytes.length,
      sha256: sha256(indexBytes),
      indexDigestSha256: index.indexDigestSha256,
      reproducibilityDigestSha256: index.reproducibilityDigestSha256,
    },
    plan: index.plan,
    assertionCount,
    failureCount: failures.length,
    failures,
    deterministicRebuild,
    variants: summaries,
    exactCoverage: Object.fromEntries(VARIANTS.map((variant) => [variant, {
      expectedAtomicUnits: allowSubset
        ? allActualIds[variant].length
        : physicalPackages.reduce((sum, pkg) => sum + pkg.variants[variant].sourceUnitIds.length, 0),
      emittedAtomicUnits: allActualIds[variant].length,
      sourceUnitIdsSha256: stringListSha256(allActualIds[variant]),
      omissionCount: failures.filter((failure) => failure.startsWith(`${variant}: global payload ownership has omission`)).length,
      duplicateCount: failures.filter((failure) => failure.startsWith(`${variant}: global payload ownership contains duplicates`)).length,
    }])),
    visualQa: {
      handoffGenerated: index.visualQa.status === 'composite-handoff-generated-render-comparison-pending',
      structuralCompositeAuditPass: failures.length === 0,
      matchedCameraRasterComparisonComplete: false,
      humanReviewComplete: false,
      activationApproved: false,
    },
    compositionConstraints: {
      currentPlanOwnsAllRemainingStaticUnits: plan.version === 1,
      structuralShellSubtractedByPlan: plan.version === 2,
      structuralShellAdditiveCompositionAllowed: false,
      requiredSafeTransition: plan.version === 1
        ? 'Move exact visually-approved shell sourceUnitIds out of a revised partition plan, re-prove conservation and multiplicity one, then re-emit this candidate with --plan.'
        : 'Compose only the exact shell pinned by this v2 plan; a different or additive shell is forbidden.',
    },
    unresolvedReleaseGates: index.unresolvedReleaseGates,
  }
  audit.auditDigestSha256 = stableSha256({ ...audit, auditDigestSha256: undefined })
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(audit, null, 2)}\n`)
  await writeFile(resolve(dirname(outPath), 'REPORT.md'), reportMarkdown(audit))
  return audit
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const audit = await auditUnownedStaticPayloadCandidate({
    indexPath: args.index,
    outPath: args.out,
    compareIndexPath: args.compareIndex,
    allowSubset: args.allowSubset,
  })
  console.log(`Disabled unowned static payload audit: ${audit.status}`)
  console.log(`  assertions: ${audit.assertionCount.toLocaleString()}`)
  console.log(`  failures: ${audit.failureCount}`)
  for (const variant of VARIANTS) {
    const summary = audit.variants[variant]
    console.log(`  ${variant}: ${summary.packageCount} packages / ${summary.sourceUnitCount.toLocaleString()} units / ${summary.expandedTriangles.toLocaleString()} tris / ${summary.payloadBytes.toLocaleString()} bytes`)
  }
  console.log(`  deterministic rebuild: ${audit.deterministicRebuild.checked ? (audit.deterministicRebuild.pass ? 'PASS' : 'FAIL') : 'NOT CHECKED'}`)
  console.log('  activation approved: false')
  if (audit.failures.length) {
    for (const failure of audit.failures.slice(0, 20)) console.error(`  - ${failure}`)
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
