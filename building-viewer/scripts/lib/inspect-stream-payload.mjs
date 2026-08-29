/**
 * Offline GLB acceptance gate for manifest-v3 streamed render payloads.
 *
 * This module intentionally has no dependency on the browser loader. It reads
 * the bytes that would be released, derives geometry/material/texture facts
 * from the GLB, and returns deterministic diagnostics suitable for CI or DCC
 * handoff checks.
 */
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { listTextureInfoByMaterial } from '@gltf-transform/functions'
import sharp from 'sharp'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './gltf-io.mjs'

const TRIANGLE_MODES = new Set([4, 5, 6])
const KTX2_IDENTIFIER = Uint8Array.from([
  0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
])
const IMAGE_METADATA_CACHE = new Map()
const DEFAULT_BOUNDS_TOLERANCE = 1e-5

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stableValue(child)]),
    )
  }
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}

export function stablePayloadInspectionString(value) {
  return JSON.stringify(stableValue(value))
}

export function stablePayloadInspectionSha256(value) {
  return sha256Bytes(Buffer.from(stablePayloadInspectionString(value)))
}

function normalizedDisplayPath(path, baseDirectory) {
  const absolute = resolve(path)
  if (!baseDirectory) return absolute.split(sep).join('/')
  return relative(resolve(baseDirectory), absolute).split(sep).join('/')
}

function triangleCount(primitive) {
  const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
  if (primitive.getMode() === 4) return Math.floor(count / 3)
  if (primitive.getMode() === 5 || primitive.getMode() === 6) return Math.max(0, count - 2)
  return 0
}

function emptyBounds() {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
}

function expandBounds(bounds, x, y, z) {
  bounds.min[0] = Math.min(bounds.min[0], x)
  bounds.min[1] = Math.min(bounds.min[1], y)
  bounds.min[2] = Math.min(bounds.min[2], z)
  bounds.max[0] = Math.max(bounds.max[0], x)
  bounds.max[1] = Math.max(bounds.max[1], y)
  bounds.max[2] = Math.max(bounds.max[2], z)
}

function finalizeBounds(bounds) {
  if (!bounds.min.every(Number.isFinite) || !bounds.max.every(Number.isFinite)) return null
  return {
    min: bounds.min.map((value) => Object.is(value, -0) ? 0 : value),
    max: bounds.max.map((value) => Object.is(value, -0) ? 0 : value),
  }
}

function boundsEqual(a, b, tolerance = DEFAULT_BOUNDS_TOLERANCE) {
  return Boolean(a && b) && ['min', 'max'].every((edge) =>
    Array.isArray(a[edge]) && Array.isArray(b[edge]) && a[edge].length === 3 && b[edge].length === 3 &&
    a[edge].every((value, index) => Math.abs(value - b[edge][index]) <= tolerance),
  )
}

function boundsInside(inner, outer, tolerance = DEFAULT_BOUNDS_TOLERANCE) {
  return Boolean(inner && outer) && inner.min.every((value, index) => value >= outer.min[index] - tolerance) &&
    inner.max.every((value, index) => value <= outer.max[index] + tolerance)
}

function stableNodePath(node, nodeIndices) {
  const path = []
  let current = node
  while (current) {
    const index = nodeIndices.get(current)
    path.push(`${index ?? '?'}:${current.getName() || '(unnamed)'}`)
    current = current.getParentNode()
  }
  return path.reverse().join('/')
}

function isDescendantOf(node, owner) {
  let current = node
  while (current) {
    if (current === owner) return true
    current = current.getParentNode()
  }
  return false
}

function accessorLayout(semantic, accessor) {
  return {
    semantic,
    type: accessor.getType(),
    componentType: accessor.getComponentType(),
    normalized: accessor.getNormalized(),
    count: accessor.getCount(),
  }
}

const ACCESSOR_FINITE_CACHE = new WeakMap()
function accessorContainsOnlyFiniteValues(accessor) {
  if (ACCESSOR_FINITE_CACHE.has(accessor)) return ACCESSOR_FINITE_CACHE.get(accessor)
  const value = []
  let finite = accessor.getElementSize() >= 1 && accessor.getElementSize() <= 16
  for (let index = 0; finite && index < accessor.getCount(); index += 1) {
    accessor.getElement(index, value)
    finite = value.every(Number.isFinite)
  }
  ACCESSOR_FINITE_CACHE.set(accessor, finite)
  return finite
}

function readAccessorElement(accessor, index, defaults) {
  if (!accessor) return [...defaults]
  return accessor.getElement(index, [])
}

function instancingFacts(node, nodePath, errors) {
  const instancing = node.getExtension('EXT_mesh_gpu_instancing')
  if (!instancing) return { count: 1, matrices: [new Matrix4()], attributes: [] }

  const semantics = instancing.listSemantics().slice().sort()
  const attributes = semantics.map((semantic) => accessorLayout(semantic, instancing.getAttribute(semantic)))
  for (const semantic of semantics) {
    const accessor = instancing.getAttribute(semantic)
    if (!accessorContainsOnlyFiniteValues(accessor)) {
      errors.push({ code: 'non-finite-instancing-attribute', nodePath, semantic })
    }
  }
  const counts = [...new Set(attributes.map((attribute) => attribute.count))]
  if (!attributes.length) {
    errors.push({ code: 'invalid-instancing', nodePath, message: 'EXT_mesh_gpu_instancing has no attributes.' })
    return { count: 0, matrices: [], attributes }
  }
  if (counts.length !== 1 || counts[0] < 1) {
    errors.push({
      code: 'invalid-instancing',
      nodePath,
      message: 'EXT_mesh_gpu_instancing attributes must have one shared positive count.',
      counts,
    })
    return { count: 0, matrices: [], attributes }
  }

  const translation = instancing.getAttribute('TRANSLATION')
  const rotation = instancing.getAttribute('ROTATION')
  const scale = instancing.getAttribute('SCALE')
  const matrices = []
  const position = new Vector3()
  const quaternion = new Quaternion()
  const scaleVector = new Vector3()
  for (let index = 0; index < counts[0]; index += 1) {
    position.fromArray(readAccessorElement(translation, index, [0, 0, 0]))
    quaternion.fromArray(readAccessorElement(rotation, index, [0, 0, 0, 1]))
    scaleVector.fromArray(readAccessorElement(scale, index, [1, 1, 1]))
    matrices.push(new Matrix4().compose(position, quaternion, scaleVector))
  }
  return { count: counts[0], matrices, attributes }
}

function textureSlotsForMaterial(material) {
  if (!material) return []
  return listTextureInfoByMaterial(material).map((info, index) => {
    const transform = info.getExtension('KHR_texture_transform')
    const texCoord = transform?.getTexCoord?.() ?? info.getTexCoord()
    return {
      slot: info.getName() || `textureInfo${index}`,
      texCoord,
      requiredSemantic: Number.isInteger(texCoord) && texCoord >= 0 ? `TEXCOORD_${texCoord}` : null,
    }
  }).sort((a, b) => a.slot.localeCompare(b.slot) || (a.texCoord ?? -1) - (b.texCoord ?? -1))
}

function hasAuthoredTangentMetadata(...properties) {
  return properties.some((property) => {
    const extras = property?.getExtras?.()
    return extras?.iomRequireAuthoredTangent === true || extras?.iomRequireAuthoredTangents === true
  })
}

function tangentRequirementReasons({ policy, primitive, material, mesh, node, textureSlots, litPbr }) {
  const reasons = []
  if (hasAuthoredTangentMetadata(primitive, material, mesh, node)) reasons.push('metadata:iomRequireAuthoredTangents')
  if (policy === 'all-lit' && litPbr) reasons.push('policy:all-lit')
  if (policy === 'normal-mapped' && textureSlots.some((slot) => /normal/i.test(slot.slot))) {
    reasons.push('policy:normal-mapped')
  }
  return reasons
}

function collectSourceOwnership(node, nodePath, errors) {
  const extras = node.getExtras() || {}
  const occurrences = []
  if (Object.hasOwn(extras, 'iomPackageSourcePath')) {
    if (typeof extras.iomPackageSourcePath === 'string' && extras.iomPackageSourcePath.length) {
      occurrences.push({ path: extras.iomPackageSourcePath, nodePath, field: 'iomPackageSourcePath' })
    } else {
      errors.push({
        code: 'invalid-source-ownership',
        nodePath,
        field: 'iomPackageSourcePath',
        message: 'iomPackageSourcePath must be a non-empty string.',
      })
    }
  }
  if (Object.hasOwn(extras, 'iomPackageSourcePaths')) {
    if (!Array.isArray(extras.iomPackageSourcePaths)) {
      errors.push({
        code: 'invalid-source-ownership',
        nodePath,
        field: 'iomPackageSourcePaths',
        message: 'iomPackageSourcePaths must be an array of non-empty strings.',
      })
    } else {
      extras.iomPackageSourcePaths.forEach((path, index) => {
        if (typeof path === 'string' && path.length) {
          occurrences.push({ path, nodePath, field: `iomPackageSourcePaths[${index}]` })
        } else {
          errors.push({
            code: 'invalid-source-ownership',
            nodePath,
            field: `iomPackageSourcePaths[${index}]`,
            message: 'iomPackageSourcePaths entries must be non-empty strings.',
          })
        }
      })
    }
  }
  return occurrences
}

function ktx2Metadata(bytes) {
  if (bytes.byteLength < 48 || KTX2_IDENTIFIER.some((value, index) => bytes[index] !== value)) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const vkFormat = view.getUint32(12, true)
  const typeSize = Math.max(1, view.getUint32(16, true))
  const width = view.getUint32(20, true)
  const height = Math.max(1, view.getUint32(24, true))
  const depth = Math.max(1, view.getUint32(28, true))
  const layers = Math.max(1, view.getUint32(32, true))
  const faces = Math.max(1, view.getUint32(36, true))
  const mipLevels = Math.max(1, view.getUint32(40, true))
  const supercompressionScheme = view.getUint32(44, true)
  if (!width) return null
  return {
    format: 'ktx2',
    width,
    height,
    depth,
    layers,
    faces,
    mipLevels,
    vkFormat,
    typeSize,
    supercompressionScheme,
    // Basis/UASTC (vkFormat=0) commonly transcodes to a block format, but
    // RGBA8 is the portable decoded upper-bound. Preserve larger component
    // sizes for uncompressed 16/32-bit KTX payloads.
    conservativeBytesPerTexel: Math.max(4, typeSize * 4),
  }
}

function componentBytes(depth) {
  if (depth === 'ushort' || depth === 'short') return 2
  if (depth === 'uint' || depth === 'int' || depth === 'float') return 4
  if (depth === 'double' || depth === 'complex') return 8
  return 1
}

function texelCount(width, height, depth, layers, faces, mipLevels) {
  let total = 0
  for (let level = 0; level < mipLevels; level += 1) {
    total += Math.max(1, width >> level) * Math.max(1, height >> level) *
      Math.max(1, depth >> level) * layers * faces
  }
  return total
}

async function imageMetadata(bytes, mimeType, hash) {
  if (IMAGE_METADATA_CACHE.has(hash)) return IMAGE_METADATA_CACHE.get(hash)
  const promise = (async () => {
    const ktx2 = ktx2Metadata(bytes)
    if (ktx2) return ktx2
    const metadata = await sharp(bytes, { animated: true }).metadata()
    const width = metadata.width || 0
    const pages = Math.max(1, metadata.pages || 1)
    const pageHeight = metadata.pageHeight || metadata.height || 0
    const height = pageHeight
    if (!width || !height) throw new Error(`Could not derive dimensions for ${mimeType || metadata.format || 'image'}.`)
    const channels = Math.max(1, metadata.channels || 4)
    return {
      format: metadata.format || mimeType || 'unknown',
      width,
      height,
      depth: 1,
      layers: pages,
      faces: 1,
      mipLevels: 1,
      bitDepth: metadata.depth || null,
      channels,
      conservativeBytesPerTexel: Math.max(4, channels * componentBytes(metadata.depth)),
    }
  })()
  IMAGE_METADATA_CACHE.set(hash, promise)
  return promise
}

async function inspectTextures(document, errors) {
  const textures = []
  for (const [index, texture] of document.getRoot().listTextures().entries()) {
    const image = texture.getImage()
    const encodedBytes = image?.byteLength || 0
    const hash = image ? sha256Bytes(image) : null
    if (!image || !hash) {
      errors.push({ code: 'missing-texture-image', textureIndex: index, textureName: texture.getName() })
      textures.push({ index, name: texture.getName(), mimeType: texture.getMimeType(), encodedBytes, sha256: hash })
      continue
    }
    try {
      const metadata = await imageMetadata(image, texture.getMimeType(), hash)
      const fullMipLevels = Math.floor(Math.log2(Math.max(metadata.width, metadata.height, metadata.depth))) + 1
      const decodedTexels = texelCount(
        metadata.width,
        metadata.height,
        metadata.depth,
        metadata.layers,
        metadata.faces,
        metadata.mipLevels,
      )
      const conservativeGpuMipLevels = Math.max(metadata.mipLevels, fullMipLevels)
      const gpuTexels = texelCount(
        metadata.width,
        metadata.height,
        metadata.depth,
        metadata.layers,
        metadata.faces,
        conservativeGpuMipLevels,
      )
      textures.push({
        index,
        name: texture.getName(),
        mimeType: texture.getMimeType(),
        sha256: hash,
        encodedBytes,
        dimensions: {
          width: metadata.width,
          height: metadata.height,
          depth: metadata.depth,
          layers: metadata.layers,
          faces: metadata.faces,
        },
        authoredMipLevels: metadata.mipLevels,
        conservativeGpuMipLevels,
        conservativeBytesPerTexel: metadata.conservativeBytesPerTexel,
        decodedBytesFromAuthoredMips: decodedTexels * metadata.conservativeBytesPerTexel,
        conservativeGpuBytesWithFullMips: gpuTexels * metadata.conservativeBytesPerTexel,
        container: Object.fromEntries(
          ['format', 'vkFormat', 'typeSize', 'supercompressionScheme', 'bitDepth', 'channels']
            .filter((key) => metadata[key] !== undefined)
            .map((key) => [key, metadata[key]]),
        ),
      })
    } catch (error) {
      errors.push({
        code: 'unreadable-texture-dimensions',
        textureIndex: index,
        textureName: texture.getName(),
        message: error instanceof Error ? error.message : String(error),
      })
      textures.push({ index, name: texture.getName(), mimeType: texture.getMimeType(), sha256: hash, encodedBytes })
    }
  }

  const byHash = new Map()
  for (const texture of textures) {
    if (!texture.sha256) continue
    const record = byHash.get(texture.sha256) || { copies: 0, encodedBytes: texture.encodedBytes }
    record.copies += 1
    byHash.set(texture.sha256, record)
  }
  const duplicateContent = [...byHash.entries()]
    .filter(([, record]) => record.copies > 1)
    .map(([sha256, record]) => ({ sha256, copies: record.copies, encodedBytesPerCopy: record.encodedBytes }))
    .sort((a, b) => a.sha256.localeCompare(b.sha256))
  return {
    copies: textures,
    summary: {
      textureCount: textures.length,
      uniqueContentCount: byHash.size,
      encodedBytes: textures.reduce((sum, texture) => sum + texture.encodedBytes, 0),
      uniqueEncodedBytes: [...byHash.values()].reduce((sum, texture) => sum + texture.encodedBytes, 0),
      decodedBytesFromAuthoredMips: textures.reduce(
        (sum, texture) => sum + (texture.decodedBytesFromAuthoredMips || 0),
        0,
      ),
      conservativeGpuBytesWithFullMips: textures.reduce(
        (sum, texture) => sum + (texture.conservativeGpuBytesWithFullMips || 0),
        0,
      ),
      duplicateContent,
    },
  }
}

function addExpectedMetricError(errors, field, actual, expected) {
  if (expected === undefined || Object.is(actual, expected)) return
  errors.push({ code: 'expected-metric-mismatch', field, expected, actual })
}

function applyExpectations(result, expectations, errors) {
  if (!expectations) return
  addExpectedMetricError(errors, 'sha256', result.file.sha256, expectations.sha256)
  addExpectedMetricError(errors, 'bytes', result.file.bytes, expectations.bytes)
  addExpectedMetricError(errors, 'expandedTriangles', result.geometry.expandedTriangles, expectations.expandedTriangles)
  addExpectedMetricError(errors, 'primitiveDraws', result.geometry.primitiveDraws, expectations.primitiveDraws)
  addExpectedMetricError(errors, 'sourcePathCount', result.sourceOwnership.pathCount, expectations.sourcePathCount)
  addExpectedMetricError(
    errors,
    'sourcePathsSha256',
    result.sourceOwnership.sortedOccurrencesSha256,
    expectations.sourcePathsSha256,
  )
  addExpectedMetricError(errors, 'encodedTextureBytes', result.textures.summary.encodedBytes, expectations.encodedTextureBytes)
  addExpectedMetricError(
    errors,
    'gpuTextureBytes',
    result.textures.summary.conservativeGpuBytesWithFullMips,
    expectations.gpuTextureBytes,
  )
  if (expectations.bounds) {
    const tolerance = expectations.boundsTolerance ?? DEFAULT_BOUNDS_TOLERANCE
    const mode = expectations.boundsMode || 'equal'
    const matches = mode === 'contains'
      ? boundsInside(result.geometry.ownerLocalBounds, expectations.bounds, tolerance)
      : boundsEqual(result.geometry.ownerLocalBounds, expectations.bounds, tolerance)
    if (!matches) {
      errors.push({
        code: 'expected-bounds-mismatch',
        field: 'ownerLocalBounds',
        mode,
        tolerance,
        expected: expectations.bounds,
        actual: result.geometry.ownerLocalBounds,
      })
    }
  }
}

/**
 * Derives gate expectations from one manifest-v3 package record.
 *
 * The package-level requiredAttributes declaration is returned separately so
 * callers can pass it to inspectStreamPayload without reintroducing blanket UV
 * requirements: UVs are validated only for material slots that reference them.
 */
export function manifestV3PayloadInspectionOptions(packageRecord, variant, level = 'lod0') {
  const payload = packageRecord?.variants?.[variant]?.[level]
  if (!payload) throw new Error(`Missing ${variant}.${level} payload for ${packageRecord?.id || '(unnamed package)'}.`)
  const metrics = payload.metrics || payload.estimates || {}
  return {
    declaredRequiredAttributes: packageRecord.requiredAttributes || [],
    expectations: {
      sha256: payload.sha256 || metrics.sha256,
      bytes: metrics.bytes,
      expandedTriangles: metrics.triangles,
      primitiveDraws: metrics.draws,
      sourcePathCount: packageRecord.content?.[variant]?.sourcePathCount ?? metrics.sourcePathCount,
      sourcePathsSha256: packageRecord.content?.[variant]?.sourcePathsSha256 ?? metrics.sourcePathsSha256,
      encodedTextureBytes: metrics.encodedTextureBytes,
      gpuTextureBytes: metrics.gpuTextureBytes,
      bounds: payload.bounds ?? packageRecord.selectionBounds?.[variant],
      // Manifest-v3 payload bounds are exact; older pilot envelopes only contain.
      boundsMode: payload.bounds ? 'equal' : 'contains',
      // Match the browser's quantized GLB/accessor bound tolerance.
      boundsTolerance: payload.bounds ? 0.02 : DEFAULT_BOUNDS_TOLERANCE,
    },
  }
}

/**
 * Inspect one GLB render payload.
 *
 * Options:
 * - baseDirectory: makes the report path deterministic/portable.
 * - ownerNodeName: strips an included persistent-owner transform. When absent,
 *   payload scene coordinates are treated as owner-local by contract.
 * - authoredTangentPolicy: "none" (default), "normal-mapped", or "all-lit".
 * - declaredRequiredAttributes: manifest metadata. TANGENT opts into all-lit
 *   authored tangent enforcement; TEXCOORD_n remains usage-driven.
 * - expectations: optional immutable metrics/hash/bounds acceptance record.
 */
export async function inspectStreamPayload(filePath, options = {}) {
  const absolutePath = resolve(filePath)
  const bytes = await readFile(absolutePath)
  const fileStat = await stat(absolutePath)
  const io = options.io || await createGltfIO()
  const document = await io.readBinary(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  const root = document.getRoot()
  const nodes = root.listNodes()
  const nodeIndices = new Map(nodes.map((node, index) => [node, index]))
  const errors = []
  const warnings = []

  const ownerMatches = options.ownerNodeName
    ? nodes.filter((node) => node.getName() === options.ownerNodeName)
    : []
  if (options.ownerNodeName && ownerMatches.length !== 1) {
    errors.push({
      code: 'owner-node-cardinality',
      ownerNodeName: options.ownerNodeName,
      expected: 1,
      actual: ownerMatches.length,
    })
  }
  const owner = ownerMatches.length === 1 ? ownerMatches[0] : null
  const ownerInverse = new Matrix4()
  if (owner) {
    const ownerWorld = new Matrix4().fromArray(owner.getWorldMatrix())
    const determinant = ownerWorld.determinant()
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
      errors.push({
        code: 'non-invertible-owner-transform',
        ownerNodeName: options.ownerNodeName,
        determinant,
      })
    } else {
      ownerInverse.copy(ownerWorld).invert()
    }
  }

  const nonMeshRenderables = []
  const sourceOccurrences = []
  for (const node of nodes) {
    const nodePath = stableNodePath(node, nodeIndices)
    sourceOccurrences.push(...collectSourceOwnership(node, nodePath, errors))
    if (node.getCamera()) {
      nonMeshRenderables.push({ type: 'camera', nodePath, name: node.getCamera().getName() })
    }
    const light = node.getExtension('KHR_lights_punctual')
    if (light) nonMeshRenderables.push({ type: 'punctual-light', nodePath, name: light.getName() })
  }
  if (nonMeshRenderables.length && options.rejectNonMeshRenderables !== false) {
    errors.push({
      code: 'non-mesh-renderable',
      message: 'Stream render payloads may contain mesh renderables only.',
      renderables: nonMeshRenderables,
    })
  }

  const declaredRequiredAttributes = [...new Set(options.declaredRequiredAttributes || [])].sort()
  const authoredTangentPolicy = declaredRequiredAttributes.includes('TANGENT')
    ? 'all-lit'
    : (options.authoredTangentPolicy || 'none')
  if (!['none', 'normal-mapped', 'all-lit'].includes(authoredTangentPolicy)) {
    throw new Error('authoredTangentPolicy must be none, normal-mapped, or all-lit.')
  }

  const exactBounds = emptyBounds()
  const primitives = []
  let expandedTriangles = 0
  let uniqueTriangles = 0
  let primitiveDraws = 0
  let logicalPrimitiveInstances = 0
  let meshNodeCount = 0
  let logicalMeshInstances = 0
  let missingPositionCount = 0
  let missingLitNormalCount = 0
  let missingReferencedTexcoordCount = 0
  let missingAuthoredTangentCount = 0

  for (const node of nodes) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const nodePath = stableNodePath(node, nodeIndices)
    if (owner && options.requireOwnerContainment !== false && !isDescendantOf(node, owner)) {
      errors.push({ code: 'mesh-outside-owner', nodePath, ownerNodeName: options.ownerNodeName })
    }
    meshNodeCount += 1
    const instances = instancingFacts(node, nodePath, errors)
    logicalMeshInstances += instances.count
    const nodeOwnerLocal = new Matrix4().multiplyMatrices(
      ownerInverse,
      new Matrix4().fromArray(node.getWorldMatrix()),
    )

    for (const [primitiveIndex, primitive] of mesh.listPrimitives().entries()) {
      primitiveDraws += instances.count > 0 ? 1 : 0
      logicalPrimitiveInstances += instances.count
      const primitiveTriangles = triangleCount(primitive)
      uniqueTriangles += primitiveTriangles
      expandedTriangles += primitiveTriangles * instances.count
      const semantics = primitive.listSemantics().slice().sort()
      const attributes = semantics.map((semantic) => accessorLayout(semantic, primitive.getAttribute(semantic)))
      const position = primitive.getAttribute('POSITION')
      const material = primitive.getMaterial()
      const textureSlots = textureSlotsForMaterial(material)
      const isTrianglePrimitive = TRIANGLE_MODES.has(primitive.getMode())
      const unlit = Boolean(material?.getExtension('KHR_materials_unlit'))
      const litPbr = isTrianglePrimitive && !unlit
      const deformed = Boolean(node.getSkin()) || primitive.listTargets().length > 0
      const missingPosition = !position
      const missingLitNormal = litPbr && !primitive.getAttribute('NORMAL')
      const missingReferencedTexcoords = textureSlots
        .filter((slot) => !slot.requiredSemantic || !primitive.getAttribute(slot.requiredSemantic))
        .map((slot) => ({ slot: slot.slot, texCoord: slot.texCoord, semantic: slot.requiredSemantic }))
      const tangentReasons = tangentRequirementReasons({
        policy: authoredTangentPolicy,
        primitive,
        material,
        mesh,
        node,
        textureSlots,
        litPbr,
      })
      const missingAuthoredTangent = tangentReasons.length > 0 && !primitive.getAttribute('TANGENT')
      const missingDeclaredAttributes = declaredRequiredAttributes.filter((semantic) => !primitive.getAttribute(semantic))

      if (!isTrianglePrimitive) {
        errors.push({ code: 'non-triangle-primitive', nodePath, primitiveIndex, mode: primitive.getMode() })
      }
      for (const semantic of missingDeclaredAttributes) {
        errors.push({ code: 'missing-declared-attribute', nodePath, primitiveIndex, semantic })
      }
      for (const semantic of semantics) {
        const accessor = primitive.getAttribute(semantic)
        if (!accessorContainsOnlyFiniteValues(accessor)) {
          errors.push({ code: 'non-finite-attribute', nodePath, primitiveIndex, semantic })
        }
      }

      if (missingPosition) {
        missingPositionCount += 1
        errors.push({ code: 'missing-position', nodePath, primitiveIndex })
      }
      if (missingLitNormal) {
        missingLitNormalCount += 1
        errors.push({ code: 'missing-lit-normal', nodePath, primitiveIndex, material: material?.getName() || null })
      }
      if (missingReferencedTexcoords.length) {
        missingReferencedTexcoordCount += missingReferencedTexcoords.length
        errors.push({
          code: 'missing-referenced-texcoord',
          nodePath,
          primitiveIndex,
          material: material?.getName() || null,
          slots: missingReferencedTexcoords,
        })
      }
      if (missingAuthoredTangent) {
        missingAuthoredTangentCount += 1
        errors.push({
          code: 'missing-authored-tangent',
          nodePath,
          primitiveIndex,
          material: material?.getName() || null,
          reasons: tangentReasons,
        })
      }

      if (deformed) {
        errors.push({
          code: 'deformed-mesh-bounds-unsupported',
          nodePath,
          primitiveIndex,
          message: 'Exact static payload bounds cannot represent skin or morph-target deformation.',
        })
      }

      if (position) {
        const indices = primitive.getIndices()
        const referencedVertexIndices = []
        if (indices) {
          const uniqueIndices = new Set()
          const indexValue = []
          for (let indexIndex = 0; indexIndex < indices.getCount(); indexIndex += 1) {
            indices.getElement(indexIndex, indexValue)
            const vertexIndex = indexValue[0]
            if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= position.getCount()) {
              errors.push({
                code: 'invalid-position-index',
                nodePath,
                primitiveIndex,
                indexIndex,
                vertexIndex,
                positionCount: position.getCount(),
              })
            } else {
              uniqueIndices.add(vertexIndex)
            }
          }
          for (const vertexIndex of uniqueIndices) referencedVertexIndices.push(vertexIndex)
        } else {
          for (let vertexIndex = 0; vertexIndex < position.getCount(); vertexIndex += 1) {
            referencedVertexIndices.push(vertexIndex)
          }
        }
        const value = []
        for (const instanceMatrix of instances.matrices) {
          const matrix = new Matrix4().multiplyMatrices(nodeOwnerLocal, instanceMatrix)
          const elements = matrix.elements
          for (const vertexIndex of referencedVertexIndices) {
            position.getElement(vertexIndex, value)
            const x = value[0]
            const y = value[1]
            const z = value[2]
            const w = elements[3] * x + elements[7] * y + elements[11] * z + elements[15]
            const inverseW = w && w !== 1 ? 1 / w : 1
            expandBounds(
              exactBounds,
              (elements[0] * x + elements[4] * y + elements[8] * z + elements[12]) * inverseW,
              (elements[1] * x + elements[5] * y + elements[9] * z + elements[13]) * inverseW,
              (elements[2] * x + elements[6] * y + elements[10] * z + elements[14]) * inverseW,
            )
          }
        }
      }

      primitives.push({
        id: `${nodeIndices.get(node)}:${primitiveIndex}`,
        nodePath,
        nodeName: node.getName(),
        meshName: mesh.getName(),
        primitiveIndex,
        mode: primitive.getMode(),
        instanceCount: instances.count,
        triangles: primitiveTriangles,
        expandedTriangles: primitiveTriangles * instances.count,
        attributes,
        material: {
          name: material?.getName() || null,
          litPbr,
          unlit,
          textureSlots,
        },
        requirements: {
          position: true,
          litNormal: litPbr,
          referencedTexcoords: textureSlots.map((slot) => slot.requiredSemantic).filter(Boolean),
          authoredTangent: tangentReasons.length > 0,
          authoredTangentReasons: tangentReasons,
          staticBoundsOnly: !deformed,
        },
        missing: {
          position: missingPosition,
          litNormal: missingLitNormal,
          referencedTexcoords: missingReferencedTexcoords,
          authoredTangent: missingAuthoredTangent,
        },
      })
    }
  }

  if (!meshNodeCount) errors.push({ code: 'no-mesh-nodes', message: 'Payload contains no mesh nodes.' })

  const sortedPathValues = sourceOccurrences.map((occurrence) => occurrence.path).sort()
  const pathCounts = new Map()
  for (const path of sortedPathValues) pathCounts.set(path, (pathCounts.get(path) || 0) + 1)
  const duplicatePaths = [...pathCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([path, count]) => ({ path, count, duplicateOccurrences: count - 1 }))
  if (duplicatePaths.length) {
    errors.push({
      code: 'duplicate-source-ownership',
      message: 'Each source path must occur exactly once within a payload.',
      duplicatePaths,
    })
  }
  if (root.listAnimations().length && options.rejectAnimations !== false) {
    errors.push({
      code: 'embedded-animation',
      message: 'Stream render payloads must not contain animation clips; clips belong in the persistent rig.',
      count: root.listAnimations().length,
    })
  }
  const textures = await inspectTextures(document, errors)
  const ownerLocalBounds = finalizeBounds(exactBounds)
  if (meshNodeCount > 0 && !ownerLocalBounds) {
    errors.push({
      code: 'invalid-owner-local-bounds',
      message: 'Mesh payload did not produce finite owner-local bounds from referenced POSITION elements.',
    })
  }
  const result = {
    schema: 'IOM_STREAM_PAYLOAD_OFFLINE_INSPECTION',
    version: 1,
    file: {
      path: normalizedDisplayPath(absolutePath, options.baseDirectory),
      bytes: fileStat.size,
      sha256: sha256Bytes(bytes),
    },
    ownerLocalSpace: owner
      ? { method: 'inverse-included-owner-node', ownerNodeName: options.ownerNodeName }
      : { method: 'payload-scene-is-owner-local', ownerNodeName: null },
    geometry: {
      meshNodeCount,
      logicalMeshInstances,
      primitiveDraws,
      logicalPrimitiveInstances,
      uniqueTriangles,
      expandedTriangles,
      ownerLocalBounds,
      exactBoundsMethod: 'all-index-referenced-position-elements-times-node-owner-inverse-times-each-ext-instancing-trs',
      primitiveLayouts: primitives,
      missing: {
        positionPrimitives: missingPositionCount,
        litNormalPrimitives: missingLitNormalCount,
        referencedTexcoordSlots: missingReferencedTexcoordCount,
        authoredTangentPrimitives: missingAuthoredTangentCount,
      },
    },
    attributesContract: {
      declaredRequiredAttributes,
      rules: {
        position: 'required-on-every-mesh-primitive',
        normal: 'required-only-on-lit-triangle-PBR-primitives',
        texcoord: 'required-only-when-a-material-texture-slot-references-TEXCOORD_n',
        tangent: 'required-only-by-explicit-policy-or-iomRequireAuthoredTangents-metadata',
      },
      authoredTangentPolicy,
    },
    sourceOwnership: {
      fields: ['iomPackageSourcePath', 'iomPackageSourcePaths'],
      pathCount: sortedPathValues.length,
      uniquePathCount: pathCounts.size,
      duplicatePathCount: sortedPathValues.length - pathCounts.size,
      duplicatePaths,
      sortedOccurrencesSha256: sha256Bytes(Buffer.from(JSON.stringify(sortedPathValues))),
      occurrences: sourceOccurrences.sort((a, b) =>
        a.path.localeCompare(b.path) || a.nodePath.localeCompare(b.nodePath) || a.field.localeCompare(b.field),
      ),
    },
    textures,
    nonMeshRenderables: {
      supportedDetection: ['camera', 'KHR_lights_punctual'],
      count: nonMeshRenderables.length,
      items: nonMeshRenderables,
    },
    animations: { count: root.listAnimations().length },
    skins: { count: root.listSkins().length },
    extensionsUsed: root.listExtensionsUsed().map((extension) => extension.extensionName).sort(),
    errors,
    warnings,
    ok: false,
  }
  applyExpectations(result, options.expectations, errors)
  result.ok = errors.length === 0
  result.inspectionSha256 = stablePayloadInspectionSha256({ ...result, inspectionSha256: undefined })
  return result
}

export async function inspectManifestV3Payload(filePath, packageRecord, variant, level = 'lod0', options = {}) {
  return inspectStreamPayload(filePath, {
    ...manifestV3PayloadInspectionOptions(packageRecord, variant, level),
    ...options,
    expectations: {
      ...manifestV3PayloadInspectionOptions(packageRecord, variant, level).expectations,
      ...(options.expectations || {}),
    },
  })
}
