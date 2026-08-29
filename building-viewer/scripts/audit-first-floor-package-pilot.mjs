/**
 * Independently audit the disabled first-floor owner-local package pilot.
 *
 * The default pass validates all source, rig, DCC-source, and lossless LOD0
 * payloads. The two-variant always-resident shell remains an explicit blocker;
 * per-detail HLOD is optional under the current manifest-v3 runtime contract.
 * Pass --require-shell only after visually approved DCC outputs have been added.
 */
import { createHash } from 'node:crypto'
import { access, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listTextureInfoByMaterial } from '@gltf-transform/functions'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const PACKAGE_PROFILES = {
  'first-floor': {
    slug: 'first-floor',
    ownerName: '1st Floor._anim1',
    ownerId: 'rig-owner:first-floor-anim1',
    criticalNames: ['Fire', 'Verbindung West002.001', 'Verbindung West.002'],
    criticalRequiredRoles: ['building-connection', 'fire-safety'],
  },
  'second-floor': {
    slug: 'second-floor',
    ownerName: '2st Floor._anim1',
    ownerId: 'rig-owner:second-floor-anim1',
    criticalNames: [],
  },
  mezzanine: {
    slug: 'mezzanine',
    ownerName: 'Mezzanine._anim1',
    ownerId: 'rig-owner:mezzanine-anim1',
    criticalNames: [],
  },
  ceiling: {
    slug: 'ceiling',
    ownerName: 'Ceiling._anim1',
    ownerId: 'rig-owner:ceiling-anim1',
    criticalNames: [],
  },
  'ground-floor': {
    slug: 'ground-floor',
    ownerName: 'Ground Floor._anim1',
    ownerId: 'rig-owner:ground-floor-anim1',
    criticalNames: [],
    criticalMaterialRolePrefix: 'fire-safety-',
    criticalRequiredRoles: ['fire-safety'],
    staticOwner: true,
    expectedInputs: {
      production: {
        web: 'b96cf36f64a03d16047e3ff26aa93131481f636c184df80b5c7ea2032e4cb5e8',
        quest: '430987ed81842b5a6a3544c401707c82f2edfdc02d16111e70bf6e5245658083',
      },
      corrected: {
        web: '6ece94b5c59e91764ee0f7a274a6f6f9f84bb611a145f283310fca66e379e1a7',
        quest: '46b353bd73dd64aba31d546e33cc5c3dab159e950b9e450ba120fec9ff3e9867',
      },
      fireExpandedTriangles: { web: 68_640, quest: 31_740 },
      scope: {
        productionGroundOwnedMeshNodes: 143,
        productionGroundOwnedAtomicUnits: 230,
        migratedDetachedFireMeshNodes: 6,
        migratedDetachedFireAtomicUnits: 60,
        correctedGroundOwnedMeshNodes: 149,
        correctedGroundOwnedAtomicUnits: 290,
        nodeMappingCount: 149,
        atomicMappingCount: 290,
      },
    },
  },
}

function requestedProfile(argv) {
  const index = argv.indexOf('--profile')
  const id = index >= 0 ? argv[index + 1] : 'first-floor'
  const profile = PACKAGE_PROFILES[id]
  if (!profile) throw new Error(`--profile must be one of: ${Object.keys(PACKAGE_PROFILES).join(', ')}`)
  return profile
}

const PROFILE = requestedProfile(process.argv)
const DEFAULT_INDEX = resolve(VIEWER_ROOT, 'tmp', `hlod-pilot-${PROFILE.slug}`, 'detail-package-index.json')
const OWNER_NAME = PROFILE.ownerName
const OWNER_ID = PROFILE.ownerId
const CRITICAL_NAMES = PROFILE.criticalNames
const CRITICAL_REQUIRED_ROLES = PROFILE.criticalRequiredRoles || []
const HAS_CRITICAL_PACKAGE = CRITICAL_NAMES.length > 0 || Boolean(PROFILE.criticalMaterialRolePrefix)
const CRITICAL_PACKAGE_ID = `${PROFILE.slug}-critical`
const SHELL_ID = `${PROFILE.slug}-shell`
const REQUIRED_ATTRIBUTES = ['POSITION', 'NORMAL']
const SHELL_SEMANTIC_ROLES = ['architectural-shell', 'interior', 'stair', 'structural-envelope']
const TOLERANCE = 1e-5

function parseArgs(argv) {
  const args = { index: DEFAULT_INDEX, requireShell: false, indexExplicit: false }
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--require-shell' || argv[i] === '--require-hlod') args.requireShell = true
    else if (argv[i] === '--profile') i += 1
    else if (!argv[i].startsWith('--') && !args.indexExplicit) {
      args.index = resolve(argv[i])
      args.indexExplicit = true
    }
    else throw new Error(`Unknown argument: ${argv[i]}`)
  }
  return args
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function sha256File(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stringListSha256(values) {
  return createHash('sha256').update(JSON.stringify([...values].sort())).digest('hex')
}

function localeStringListSha256(values) {
  return createHash('sha256')
    .update(JSON.stringify([...values].sort((left, right) => left.localeCompare(right))))
    .digest('hex')
}

function cloneExtras(extras) {
  return extras && typeof extras === 'object' ? structuredClone(extras) : {}
}

function countStrings(values) {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]),
  )
}

function triangleCount(primitive) {
  const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
  const mode = primitive.getMode()
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

function instanceCount(node) {
  const instancing = node.getExtension('EXT_mesh_gpu_instancing')
  if (!instancing) return 1
  for (const semantic of ['TRANSLATION', 'ROTATION', 'SCALE', '_ID']) {
    const accessor = instancing.getAttribute?.(semantic)
    if (accessor) return accessor.getCount()
  }
  return 1
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
  if (!instancing) return [new Matrix4()]
  const attributes = instancing.listAttributes()
  if (!attributes.length) throw new Error('EXT_mesh_gpu_instancing has no attributes')
  const count = attributes[0].getCount()
  if (!attributes.every((accessor) => accessor.getCount() === count)) {
    throw new Error('EXT_mesh_gpu_instancing attribute counts differ')
  }
  const translation = instancing.getAttribute('TRANSLATION')
  const rotation = instancing.getAttribute('ROTATION')
  const scale = instancing.getAttribute('SCALE')
  return Array.from({ length: count }, (_, index) => {
    const position = translation
      ? new Vector3(
          normalizedAccessorValue(translation, index * 3),
          normalizedAccessorValue(translation, index * 3 + 1),
          normalizedAccessorValue(translation, index * 3 + 2),
        )
      : new Vector3()
    const quaternion = rotation
      ? new Quaternion(
          normalizedAccessorValue(rotation, index * 4),
          normalizedAccessorValue(rotation, index * 4 + 1),
          normalizedAccessorValue(rotation, index * 4 + 2),
          normalizedAccessorValue(rotation, index * 4 + 3),
        ).normalize()
      : new Quaternion()
    const size = scale
      ? new Vector3(
          normalizedAccessorValue(scale, index * 3),
          normalizedAccessorValue(scale, index * 3 + 1),
          normalizedAccessorValue(scale, index * 3 + 2),
        )
      : new Vector3(1, 1, 1)
    return new Matrix4().compose(position, quaternion, size)
  })
}

function transformedInstanceMatrices(node, baseMatrix) {
  return instanceLocalMatrices(node).map((local) => new Matrix4().multiplyMatrices(baseMatrix, local))
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

function mergeBounds(target, source) {
  expandBounds(target, ...source.min)
  expandBounds(target, ...source.max)
  return target
}

const _point = new Vector3()

function expandAccessorBounds(bounds, accessor, matrix) {
  const min = accessor.getMin([])
  const max = accessor.getMax([])
  if (!min?.length || !max?.length) return
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        _point.set(x, y, z).applyMatrix4(matrix)
        expandBounds(bounds, _point.x, _point.y, _point.z)
      }
    }
  }
}

function expandReferencedPrimitiveBounds(bounds, primitive, matrix) {
  const position = primitive.getAttribute('POSITION')
  if (!position) return
  const referenced = new Set()
  const indices = primitive.getIndices()
  const element = []
  if (indices) {
    for (let index = 0; index < indices.getCount(); index += 1) {
      indices.getElement(index, element)
      const vertexIndex = element[0]
      if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= position.getCount()) {
        throw new Error(`Primitive index ${vertexIndex} is outside POSITION[${position.getCount()}]`)
      }
      referenced.add(vertexIndex)
    }
  } else {
    for (let index = 0; index < position.getCount(); index += 1) referenced.add(index)
  }
  const value = []
  for (const vertexIndex of referenced) {
    position.getElement(vertexIndex, value)
    if (!value.slice(0, 3).every(Number.isFinite)) throw new Error('Primitive POSITION contains non-finite values')
    _point.fromArray(value).applyMatrix4(matrix)
    expandBounds(bounds, _point.x, _point.y, _point.z)
  }
}

function boundsEqual(a, b, tolerance = TOLERANCE) {
  return ['min', 'max'].every((edge) =>
    a?.[edge]?.length === 3 && b?.[edge]?.length === 3 &&
    a[edge].every((value, index) => Math.abs(value - b[edge][index]) <= tolerance),
  )
}

function boundsInside(inner, outer, tolerance = TOLERANCE) {
  return inner.min.every((value, index) => value >= outer.min[index] - tolerance) &&
    inner.max.every((value, index) => value <= outer.max[index] + tolerance)
}

function textureCoordinatesForMaterial(material) {
  return listTextureInfoByMaterial(material).map((info) =>
    info.getExtension('KHR_texture_transform')?.getTexCoord?.() ?? info.getTexCoord(),
  )
}

function textureBinding(texture, info) {
  if (!texture) return null
  const transform = info?.getExtension?.('KHR_texture_transform')
  const image = texture.getImage()
  return {
    name: texture.getName(),
    mimeType: texture.getMimeType(),
    imageSha256: image ? createHash('sha256').update(image).digest('hex') : null,
    texCoord: transform?.getTexCoord?.() ?? info?.getTexCoord?.() ?? 0,
    offset: transform?.getOffset?.() ?? null,
    rotation: transform?.getRotation?.() ?? null,
    scale: transform?.getScale?.() ?? null,
  }
}

function materialPbrSignature(material) {
  const transmission = material.getExtension('KHR_materials_transmission')
  const specular = material.getExtension('KHR_materials_specular')
  const ior = material.getExtension('KHR_materials_ior')
  const emissiveStrength = material.getExtension('KHR_materials_emissive_strength')
  return {
    name: material.getName(),
    baseColorFactor: material.getBaseColorFactor(),
    metallicFactor: material.getMetallicFactor(),
    roughnessFactor: material.getRoughnessFactor(),
    emissiveFactor: material.getEmissiveFactor(),
    alphaMode: material.getAlphaMode(),
    alphaCutoff: material.getAlphaCutoff(),
    doubleSided: material.getDoubleSided(),
    extras: cloneExtras(material.getExtras()),
    baseColorTexture: textureBinding(material.getBaseColorTexture(), material.getBaseColorTextureInfo()),
    metallicRoughnessTexture: textureBinding(
      material.getMetallicRoughnessTexture(),
      material.getMetallicRoughnessTextureInfo(),
    ),
    normalTexture: {
      ...textureBinding(material.getNormalTexture(), material.getNormalTextureInfo()),
      scale: material.getNormalTextureInfo()?.getScale?.() ?? 1,
    },
    occlusionTexture: {
      ...textureBinding(material.getOcclusionTexture(), material.getOcclusionTextureInfo()),
      strength: material.getOcclusionTextureInfo()?.getStrength?.() ?? 1,
    },
    emissiveTexture: textureBinding(material.getEmissiveTexture(), material.getEmissiveTextureInfo()),
    extensions: {
      transmission: transmission ? {
        factor: transmission.getTransmissionFactor(),
        texture: textureBinding(transmission.getTransmissionTexture(), transmission.getTransmissionTextureInfo()),
      } : null,
      specular: specular ? {
        factor: specular.getSpecularFactor(),
        colorFactor: specular.getSpecularColorFactor(),
        texture: textureBinding(specular.getSpecularTexture(), specular.getSpecularTextureInfo()),
        colorTexture: textureBinding(specular.getSpecularColorTexture(), specular.getSpecularColorTextureInfo()),
      } : null,
      ior: ior ? ior.getIOR() : null,
      emissiveStrength: emissiveStrength ? emissiveStrength.getEmissiveStrength() : null,
      unlit: Boolean(material.getExtension('KHR_materials_unlit')),
    },
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
  let decodedRgba8Bytes = 0
  for (let level = 0; level < levels; level += 1) {
    decodedRgba8Bytes += Math.max(1, width >> level) * Math.max(1, height >> level) *
      Math.max(1, depth >> level) * layers * faces * 4
  }
  return { width, height, depth, layers, faces, levels, decodedRgba8Bytes }
}

function textureCopies(document) {
  return document.getRoot().listTextures().map((texture) => {
    const image = texture.getImage()
    const ktx2 = ktx2DecodedRgba8Bytes(image)
    return {
      sha256: image ? createHash('sha256').update(image).digest('hex') : null,
      name: texture.getName(),
      mimeType: texture.getMimeType(),
      embeddedBytes: image?.byteLength || 0,
      width: ktx2?.width ?? null,
      height: ktx2?.height ?? null,
      levels: ktx2?.levels ?? null,
      decodedRgba8Bytes: ktx2?.decodedRgba8Bytes ?? null,
    }
  })
}

function documentBounds(document) {
  const bounds = emptyBounds()
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const matrices = transformedInstanceMatrices(node, new Matrix4().fromArray(node.getWorldMatrix()))
    for (const primitive of mesh.listPrimitives()) {
      for (const matrix of matrices) expandReferencedPrimitiveBounds(bounds, primitive, matrix)
    }
  }
  return bounds
}

async function payloadMetrics(io, path) {
  const document = await io.read(path)
  let triangles = 0
  let draws = 0
  let meshNodes = 0
  let logicalInstances = 0
  let missingPosition = 0
  let missingNormal = 0
  let missingReferencedTexcoord = 0
  const attributes = new Set()
  const sourcePaths = []
  const nodeNames = []
  for (const node of document.getRoot().listNodes()) {
    nodeNames.push(node.getName())
    const mesh = node.getMesh()
    if (!mesh) continue
    if (typeof node.getExtras()?.iomPackageSourcePath === 'string') sourcePaths.push(node.getExtras().iomPackageSourcePath)
    const instances = instanceCount(node)
    meshNodes += 1
    logicalInstances += instances
    for (const primitive of mesh.listPrimitives()) {
      draws += 1
      triangles += triangleCount(primitive) * instances
      for (const semantic of primitive.listSemantics()) attributes.add(semantic)
      if (!primitive.getAttribute('POSITION')) missingPosition += 1
      if (!primitive.getAttribute('NORMAL')) missingNormal += 1
      const material = primitive.getMaterial()
      if (material) {
        for (const texCoord of textureCoordinatesForMaterial(material)) {
          if (Number.isInteger(texCoord) && !primitive.getAttribute(`TEXCOORD_${texCoord}`)) {
            missingReferencedTexcoord += 1
          }
        }
      }
    }
  }
  const materials = document.getRoot().listMaterials()
  const textures = document.getRoot().listTextures()
  const roleValues = materials.map((material) => material.getExtras()?.iomMaterialRole).filter(Boolean)
  const reasonValues = materials.map((material) => material.getExtras()?.iomDoubleSidedReason).filter(Boolean)
  const alphaModes = materials.map((material) => material.getAlphaMode())
  const pbrSignatures = materials.map(materialPbrSignature).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const copies = textureCopies(document)
  const file = await stat(path)
  const metrics = {
    sha256: await sha256File(path),
    triangles,
    draws,
    bytes: file.size,
    encodedTextureBytes: copies.reduce((sum, copy) => sum + copy.embeddedBytes, 0),
    gpuTextureBytes: copies.reduce(
      (sum, copy) => sum + (copy.decodedRgba8Bytes ?? copy.embeddedBytes * 4),
      0,
    ),
    meshNodes,
    logicalInstances,
    materialCount: materials.length,
    textureCount: textures.length,
    ktx2Textures: textures.filter((texture) => texture.getMimeType() === 'image/ktx2').length,
    doubleSidedMaterials: materials.filter((material) => material.getDoubleSided()).length,
    materialRoles: [...new Set(roleValues)].sort(),
    materialRoleCounts: countStrings(roleValues),
    doubleSidedReasons: [...new Set(reasonValues)].sort(),
    doubleSidedReasonCounts: countStrings(reasonValues),
    alphaModeCounts: countStrings(alphaModes),
    pbrMaterialSha256: createHash('sha256').update(JSON.stringify(pbrSignatures)).digest('hex'),
    criticalNodes: nodeNames.filter((name) => CRITICAL_NAMES.includes(name)).sort(),
    attributes: [...attributes].sort(),
    missingPosition,
    missingNormal,
    missingReferencedTexcoord,
    bounds: documentBounds(document),
    extensionsUsed: document.getRoot().listExtensionsUsed().map((extension) => extension.extensionName).sort(),
    sourcePathCount: sourcePaths.length,
    sourcePathsSha256: stringListSha256(sourcePaths),
    duplicateSourcePaths: sourcePaths.length - new Set(sourcePaths).size,
  }
  return {
    document,
    metrics,
    textureCopies: copies,
    sourcePaths: sourcePaths.sort(),
    nodeNames,
    animationCount: document.getRoot().listAnimations().length,
  }
}

function exactWorstTextureBytesUnderTriangleBudget(packages, triangleBudget) {
  const values = new Float64Array(triangleBudget + 1)
  for (const pkg of packages) {
    const cost = Math.max(0, pkg.triangles)
    if (cost > triangleBudget) continue
    for (let remaining = triangleBudget; remaining >= cost; remaining -= 1) {
      values[remaining] = Math.max(values[remaining], values[remaining - cost] + pkg.decodedRgba8Bytes)
    }
  }
  return values[triangleBudget]
}

function textureDuplicationSummary(copies, packageTextureCosts, triangleBudget, sourceFileBytes, sourceCopies) {
  const byHash = new Map()
  for (const copy of copies) {
    if (!copy.sha256) continue
    const record = byHash.get(copy.sha256) || {
      sha256: copy.sha256,
      names: new Set(),
      mimeType: copy.mimeType,
      embeddedBytesPerCopy: copy.embeddedBytes,
      decodedRgba8BytesPerCopy: copy.decodedRgba8Bytes,
      width: copy.width,
      height: copy.height,
      levels: copy.levels,
      copies: 0,
    }
    record.copies += 1
    if (copy.name) record.names.add(copy.name)
    byHash.set(copy.sha256, record)
  }
  const unique = [...byHash.values()].map((record) => ({ ...record, names: [...record.names].sort() }))
    .sort((a, b) => b.copies - a.copies || b.embeddedBytesPerCopy - a.embeddedBytesPerCopy)
  const embeddedBytes = copies.reduce((sum, copy) => sum + copy.embeddedBytes, 0)
  const uniqueEmbeddedBytes = unique.reduce((sum, copy) => sum + copy.embeddedBytesPerCopy, 0)
  const decodedRgba8Bytes = copies.reduce((sum, copy) => sum + (copy.decodedRgba8Bytes || 0), 0)
  const uniqueDecodedRgba8Bytes = unique.reduce((sum, copy) => sum + (copy.decodedRgba8BytesPerCopy || 0), 0)
  const sourceByHash = new Map(sourceCopies.filter((copy) => copy.sha256).map((copy) => [copy.sha256, copy]))
  const runtimeHashesAbsentFromSource = unique.filter((copy) => !sourceByHash.has(copy.sha256)).map((copy) => copy.sha256)
  return {
    embeddedCopies: copies.length,
    uniqueContentHashes: unique.length,
    duplicationFactor: unique.length ? copies.length / unique.length : 0,
    embeddedTextureBytes: embeddedBytes,
    uniqueTextureBytes: uniqueEmbeddedBytes,
    duplicatedTextureBytes: embeddedBytes - uniqueEmbeddedBytes,
    decodedRgba8BytesAllPackages: decodedRgba8Bytes,
    uniqueDecodedRgba8Bytes,
    worstSinglePackageDecodedRgba8Bytes: Math.max(0, ...packageTextureCosts.map((pkg) => pkg.decodedRgba8Bytes)),
    worstDetailResidentDecodedRgba8BytesUnderTriangleBudget: exactWorstTextureBytesUnderTriangleBudget(
      packageTextureCosts,
      triangleBudget,
    ),
    sourceFileBytes,
    runtimeHashesAbsentFromSource,
    content: unique,
  }
}

function findUniqueNode(document, name) {
  const matches = document.getRoot().listNodes().filter((node) => node.getName() === name)
  if (matches.length !== 1) throw new Error(`Expected one node named ${name}, found ${matches.length}`)
  return matches[0]
}

function descendants(root) {
  const result = []
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    result.push(node)
    stack.push(...node.listChildren())
  }
  return result
}

function isDescendantOf(node, ancestor) {
  let current = node
  while (current) {
    if (current === ancestor) return true
    current = current.getParentNode()
  }
  return false
}

function pathMap(owner) {
  const paths = new Map()
  const visit = (node, path) => {
    paths.set(node, path)
    node.listChildren().forEach((child, index) => visit(child, `${path}/${index}`))
  }
  owner.listChildren().forEach((child, index) => visit(child, String(index)))
  return paths
}

function sourceOwnerMetrics(document) {
  const owner = findUniqueNode(document, OWNER_NAME)
  const ownerInverse = new Matrix4().fromArray(owner.getWorldMatrix()).invert()
  const paths = pathMap(owner)
  const bounds = emptyBounds()
  let triangles = 0
  let draws = 0
  let meshNodes = 0
  const sourcePaths = []
  for (const node of descendants(owner)) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const path = paths.get(node)
    if (typeof path !== 'string') throw new Error(`Mesh node escaped ${OWNER_NAME}`)
    sourcePaths.push(path)
    meshNodes += 1
    const instances = instanceCount(node)
    const matrices = transformedInstanceMatrices(
      node,
      new Matrix4().multiplyMatrices(ownerInverse, new Matrix4().fromArray(node.getWorldMatrix())),
    )
    for (const primitive of mesh.listPrimitives()) {
      triangles += triangleCount(primitive) * instances
      draws += 1
      const position = primitive.getAttribute('POSITION')
      if (position) for (const matrix of matrices) expandAccessorBounds(bounds, position, matrix)
    }
  }
  return { owner, triangles, draws, meshNodes, bounds, sourcePaths: sourcePaths.sort() }
}

function sourceSubsetMetrics(document, requestedPaths) {
  const owner = findUniqueNode(document, OWNER_NAME)
  const ownerInverse = new Matrix4().fromArray(owner.getWorldMatrix()).invert()
  const paths = pathMap(owner)
  const requested = new Set(requestedPaths)
  const observedPaths = []
  const materials = new Set()
  const bounds = emptyBounds()
  const attributes = new Set()
  const criticalNodes = new Set()
  let triangles = 0
  let draws = 0
  let missingPosition = 0
  let missingNormal = 0
  let missingReferencedTexcoord = 0
  let transmissiveMaterials = 0
  for (const node of descendants(owner)) {
    const path = paths.get(node)
    if (!requested.has(path)) continue
    const mesh = node.getMesh()
    if (!mesh) continue
    observedPaths.push(path)
    let current = node
    while (current && current !== owner) {
      if (CRITICAL_NAMES.includes(current.getName())) criticalNodes.add(current.getName())
      current = current.getParentNode()
    }
    const matrices = transformedInstanceMatrices(
      node,
      new Matrix4().multiplyMatrices(ownerInverse, new Matrix4().fromArray(node.getWorldMatrix())),
    )
    for (const primitive of mesh.listPrimitives()) {
      triangles += triangleCount(primitive) * instanceCount(node)
      draws += 1
      for (const semantic of primitive.listSemantics()) attributes.add(semantic)
      if (!primitive.getAttribute('POSITION')) missingPosition += 1
      if (!primitive.getAttribute('NORMAL')) missingNormal += 1
      for (const matrix of matrices) expandReferencedPrimitiveBounds(bounds, primitive, matrix)
      const material = primitive.getMaterial()
      if (!material) continue
      materials.add(material)
      if ((material.getExtension('KHR_materials_transmission')?.getTransmissionFactor?.() || 0) > 1e-6) {
        transmissiveMaterials += 1
      }
      for (const texCoord of textureCoordinatesForMaterial(material)) {
        if (Number.isInteger(texCoord) && !primitive.getAttribute(`TEXCOORD_${texCoord}`)) {
          missingReferencedTexcoord += 1
        }
      }
    }
  }
  const materialList = [...materials]
  const pbrSignatures = materialList.map(materialPbrSignature)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return {
    sourcePaths: observedPaths.sort(),
    triangles,
    draws,
    bounds,
    attributes: [...attributes].sort(),
    missingPosition,
    missingNormal,
    missingReferencedTexcoord,
    alphaModeCounts: countStrings(materialList.map((material) => material.getAlphaMode())),
    transmissiveMaterials,
    pbrMaterialSha256: createHash('sha256').update(JSON.stringify(pbrSignatures)).digest('hex'),
    criticalNodes: [...criticalNodes].sort(),
  }
}

function detachedSemanticOverlaySummary(document, owner) {
  const bounds = emptyBounds()
  const roles = []
  const materials = []
  let triangles = 0
  let draws = 0
  let logicalInstances = 0
  const nodes = document.getRoot().listNodes().filter((node) =>
    node.getMesh() && !isDescendantOf(node, owner) &&
    node.getMesh().listPrimitives().some((primitive) => primitive.getMaterial()?.getExtras()?.iomMaterialRole),
  )
  for (const node of nodes) {
    logicalInstances += instanceCount(node)
    const matrix = new Matrix4().fromArray(node.getWorldMatrix())
    for (const primitive of node.getMesh().listPrimitives()) {
      const material = primitive.getMaterial()
      const role = material?.getExtras()?.iomMaterialRole
      if (role) roles.push(role)
      if (material?.getName()) materials.push(material.getName())
      triangles += triangleCount(primitive) * instanceCount(node)
      draws += instanceCount(node)
      const position = primitive.getAttribute('POSITION')
      if (position) expandAccessorBounds(bounds, position, matrix)
    }
  }
  return {
    nodeCount: nodes.length,
    triangles,
    draws,
    logicalInstances,
    materialRoleCounts: countStrings(roles),
    materials: [...new Set(materials)].sort(),
    bounds: nodes.length ? bounds : { min: [null, null, null], max: [null, null, null] },
    ownerAssignment: 'unresolved-global-root-batches',
  }
}

function fireHoseReleaseEvidence(document) {
  const owner = findUniqueNode(document, 'Ground Floor._anim1')
  const allBatches = document.getRoot().listNodes().filter((node) =>
    node.getMesh()?.listPrimitives().some(
      (primitive) => primitive.getMaterial()?.getExtras()?.iomMaterialRole,
    ),
  )
  const detachedBatches = allBatches.filter((node) => !isDescendantOf(node, owner))
  const ownedBatches = allBatches.filter((node) => isDescendantOf(node, owner))
  const translationAccessor = allBatches[0]?.getExtension('EXT_mesh_gpu_instancing')?.getAttribute?.('TRANSLATION')
  const array = translationAccessor?.getArray()
  const batchTranslations = array
    ? Array.from({ length: translationAccessor.getCount() }, (_, index) => Array.from(array.slice(index * 3, index * 3 + 3)))
    : []
  return {
    rootBatchCount: detachedBatches.length,
    ownedBatchCount: ownedBatches.length,
    instancesPerBatch: translationAccessor?.getCount() || 0,
    identifyingMaterials: allBatches.map((node) => node.getMesh().listPrimitives()[0].getMaterial()?.getName()).sort(),
    groundFloorOwnerAnimatedInCurrentClip: document.getRoot().listAnimations().some((animation) =>
      animation.listChannels().some((channel) => channel.getTargetNode() === owner),
    ),
    groundFloorOwnerRestMatrix: owner.getMatrix(),
    batchTranslations,
  }
}

function cleanedFireHoseEvidence(document) {
  const nodes = document.getRoot().listNodes().filter((node) => /^FireHoseHousing(?:00[1-9])?$/.test(node.getName() || ''))
  const ownerNames = [...new Set(nodes.map((node) => {
    let current = node
    while (current && !/_anim1$/.test(current.getName() || '')) current = current.getParentNode()
    return current?.getName() || '(unresolved)'
  }))].sort()
  return {
    nodes: nodes.map((node) => node.getName()).sort(),
    ownerNames,
    meshes: [...new Set(nodes.map((node) => node.getMesh()?.getName()).filter(Boolean))].sort(),
    materials: [...new Set(nodes.flatMap((node) =>
      node.getMesh()?.listPrimitives().map((primitive) => primitive.getMaterial()?.getName()).filter(Boolean) || [],
    ))].sort(),
    translations: nodes.map((node) => node.getWorldTranslation()),
  }
}

function maxNearestTranslationError(sourceTranslations, batchTranslations) {
  const remaining = new Set(batchTranslations.map((_, index) => index))
  let maximum = 0
  for (const source of sourceTranslations) {
    let bestIndex = -1
    let bestDistance = Infinity
    for (const index of remaining) {
      const target = batchTranslations[index]
      const distance = Math.hypot(source[0] - target[0], source[1] - target[1], source[2] - target[2])
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    }
    if (bestIndex >= 0) remaining.delete(bestIndex)
    maximum = Math.max(maximum, bestDistance)
  }
  return maximum
}

function animationDurationSeconds(document) {
  let duration = 0
  for (const animation of document.getRoot().listAnimations()) {
    for (const sampler of animation.listSamplers()) {
      const input = sampler.getInput()?.getArray()
      if (input?.length) duration = Math.max(duration, input[input.length - 1])
    }
  }
  return duration
}

function sampleAnimationSampler(sampler, targetPath, time) {
  const input = sampler.getInput()?.getArray()
  const outputAccessor = sampler.getOutput()
  const output = outputAccessor?.getArray()
  const size = outputAccessor?.getElementSize() || 0
  if (!input?.length || !output || !size) throw new Error(`Incomplete animation sampler for ${targetPath}`)
  const interpolation = sampler.getInterpolation() || 'LINEAR'
  if (interpolation === 'CUBICSPLINE') throw new Error('CUBICSPLINE pilot sampling is unsupported')
  let right = input.findIndex((value) => value >= time)
  if (right < 0) right = input.length - 1
  let left = Math.max(0, right - 1)
  if (input[right] === time || right === 0) left = right
  const alpha = left === right || interpolation === 'STEP'
    ? 0
    : (time - input[left]) / Math.max(Number.EPSILON, input[right] - input[left])
  const a = Array.from(output.slice(left * size, left * size + size))
  if (!alpha) return a
  const b = Array.from(output.slice(right * size, right * size + size))
  if (targetPath === 'rotation') return new Quaternion().fromArray(a).slerp(new Quaternion().fromArray(b), alpha).toArray()
  return a.map((value, index) => value + (b[index] - value) * alpha)
}

function animationEvidence(document) {
  const duration = animationDurationSeconds(document)
  const animations = document.getRoot().listAnimations()
  const owner = findUniqueNode(document, OWNER_NAME)
  const times = [0, duration * 0.5, duration]
  const ownerTransforms = []
  for (const animation of animations) {
    const channels = animation.listChannels().filter((channel) => channel.getTargetNode() === owner)
    if (!channels.length && !PROFILE.staticOwner) continue
    const samples = times.map((timeSeconds) => {
      const translation = Array.from(owner.getTranslation())
      const rotation = Array.from(owner.getRotation())
      const scale = Array.from(owner.getScale())
      for (const channel of channels) {
        const value = sampleAnimationSampler(channel.getSampler(), channel.getTargetPath(), timeSeconds)
        if (channel.getTargetPath() === 'translation') translation.splice(0, translation.length, ...value)
        else if (channel.getTargetPath() === 'rotation') rotation.splice(0, rotation.length, ...value)
        else if (channel.getTargetPath() === 'scale') scale.splice(0, scale.length, ...value)
      }
      return {
        timeSeconds,
        translation,
        rotation,
        scale,
        matrix: new Matrix4().compose(
          new Vector3().fromArray(translation),
          new Quaternion().fromArray(rotation),
          new Vector3().fromArray(scale),
        ).toArray(),
      }
    })
    ownerTransforms.push({ animation: animation.getName() || '(unnamed)', ownerChannelCount: channels.length, samples })
  }
  const ownerChannelCount = animations.reduce(
    (sum, animation) => sum + animation.listChannels().filter((channel) => channel.getTargetNode() === owner).length,
    0,
  )
  return {
    animationDurationSeconds: duration,
    clipCount: animations.length,
    channelCount: animations.reduce((sum, animation) => sum + animation.listChannels().length, 0),
    ownerAnimated: ownerChannelCount > 0,
    ownerChannelCount,
    ownerTransforms,
    ownerTransformSamplesSha256: createHash('sha256').update(JSON.stringify(ownerTransforms)).digest('hex'),
  }
}

function exactJsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function insideDirectory(path, root) {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function resolvePackageUrl(indexDir, url) {
  if (typeof url !== 'string' || !url || /^[a-z]+:/i.test(url) || isAbsolute(url)) return null
  const path = resolve(indexDir, url)
  return insideDirectory(path, indexDir) ? path : null
}

function resolveSourceUrl(indexDir, url) {
  if (typeof url !== 'string' || !url || /^[a-z]+:/i.test(url)) return null
  const path = resolve(indexDir, url)
  return insideDirectory(path, resolve(VIEWER_ROOT, '..')) ? path : null
}

async function main() {
  const args = parseArgs(process.argv)
  const indexPath = resolve(args.index)
  const indexDir = dirname(indexPath)
  if (!insideDirectory(indexPath, resolve(VIEWER_ROOT, 'tmp'))) {
    throw new Error(`Pilot index must be below ${resolve(VIEWER_ROOT, 'tmp')}`)
  }
  const index = JSON.parse(await readFile(indexPath, 'utf8'))
  const failures = []
  const blockers = []
  const notes = []
  let assertions = 0
  const gate = (condition, message) => {
    assertions += 1
    if (!condition) failures.push(message)
  }

  gate(index.schema === 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_PILOT', 'Unexpected pilot schema')
  gate(index.enabled === false, 'Pilot must remain disabled')
  gate(index.contractTarget === 3, 'Pilot must target manifest contract v3')
  gate(index.owner?.nodeName === OWNER_NAME && index.owner?.persistent === true, 'Persistent owner contract is invalid')
  gate(index.owner?.id === OWNER_ID, 'Persistent owner id is invalid for the selected profile')
  if (index.packageProfile) {
    gate(index.packageProfile.id === PROFILE.slug, 'Package profile id does not match --profile')
    gate(index.packageProfile.ownerName === OWNER_NAME, 'Package profile owner name is invalid')
    gate(index.packageProfile.ownerId === OWNER_ID, 'Package profile owner id is invalid')
    gate(exactJsonEqual(index.packageProfile.criticalNames, CRITICAL_NAMES), 'Package profile critical names changed')
    gate(
      (index.packageProfile.criticalMaterialRolePrefix || null) === (PROFILE.criticalMaterialRolePrefix || null),
      'Package profile critical material-role selection changed',
    )
    gate(exactJsonEqual(index.packageProfile.criticalRequiredRoles || [], CRITICAL_REQUIRED_ROLES), 'Package profile critical roles changed')
    gate(Boolean(index.packageProfile.staticOwner) === Boolean(PROFILE.staticOwner), 'Package profile static-owner contract changed')
    gate(index.packageProfile.shellId === SHELL_ID, 'Package profile shell id is invalid')
  }
  gate(Array.isArray(index.packages) && index.packages.length > 0, 'Pilot has no detail packages')
  gate(index.packages.every((pkg) => pkg.kind === 'detail'), 'Non-detail record exists in pilot detail package list')
  gate(new Set(index.packages.map((pkg) => pkg.id)).size === index.packages.length, 'Package IDs are not unique')
  const criticalRecords = index.packages.filter((pkg) => pkg.id === CRITICAL_PACKAGE_ID)
  const expectedCriticalRecords = HAS_CRITICAL_PACKAGE ? 1 : 0
  gate(
    criticalRecords.length === expectedCriticalRecords,
    `Pilot must contain ${expectedCriticalRecords} profile critical detail package(s)`,
  )
  for (const pkg of index.packages) {
    const critical = pkg.id === CRITICAL_PACKAGE_ID
    gate(
      pkg.residency === (critical ? 'persistent-lossless' : 'streamed'),
      `${pkg.id}: residency does not match shell/unloaded-detail contract`,
    )
    if (critical) {
      gate(pkg.streaming == null, `${pkg.id}: persistent critical LOD0 must not be distance streamed`)
      gate(pkg.farBehavior == null, `${pkg.id}: critical LOD0 must never be omitted`)
    } else {
      gate(pkg.farBehavior === 'intentional-nonstructural-omission', `${pkg.id}: ordinary detail has unsafe far behavior`)
      gate(
        Number.isFinite(pkg.streaming?.lod0MarginMeters) && pkg.streaming.lod0MarginMeters > 0,
        `${pkg.id}: streamed detail lacks a positive LOD0 margin`,
      )
    }
    gate(pkg.hlodHandoff == null, `${pkg.id}: per-detail HLOD must not be required by the pilot`)
    for (const variant of ['web', 'quest']) {
      gate(pkg.variants?.[variant]?.hlod == null, `${pkg.id}/${variant}: detail unexpectedly embeds an HLOD`)
    }
  }
  gate(index.optionalRegionalHlod?.required === false, 'Regional HLOD must remain optional')
  gate(
    index.optionalRegionalHlod?.contractKind === 'regional-hlod' && index.optionalRegionalHlod?.activationSupported === false,
    'Optional regional-HLOD contract metadata is invalid',
  )

  let preprocessingSummary = null
  let preprocessingMigration = null
  if (PROFILE.expectedInputs) {
    const preprocessing = index.source?.preprocessing
    gate(preprocessing?.kind === 'json-only-fire-hose-owner-migration', 'Ground Floor preprocessing kind is invalid')
    const reportPath = resolveSourceUrl(indexDir, preprocessing?.report?.url)
    const migrationPath = resolveSourceUrl(indexDir, preprocessing?.ownershipMigration?.url)
    const wholeLayerPath = resolveSourceUrl(indexDir, preprocessing?.wholeLayerContract?.url)
    gate(Boolean(reportPath) && await exists(reportPath), 'Ground Floor preprocessing report is missing')
    gate(Boolean(migrationPath) && await exists(migrationPath), 'Ground Floor ownership migration sidecar is missing')
    gate(Boolean(wholeLayerPath) && await exists(wholeLayerPath), 'Pinned whole-layer compatibility contract is missing')
    if (
      reportPath && migrationPath && wholeLayerPath &&
      await exists(reportPath) && await exists(migrationPath) && await exists(wholeLayerPath)
    ) {
      const [reportBytes, migrationBytes, wholeLayerBytes] = await Promise.all([
        readFile(reportPath),
        readFile(migrationPath),
        readFile(wholeLayerPath),
      ])
      const report = JSON.parse(reportBytes)
      const migration = JSON.parse(migrationBytes)
      const wholeLayer = JSON.parse(wholeLayerBytes)
      preprocessingMigration = migration
      gate(sha256Buffer(reportBytes) === preprocessing.report.sha256, 'Ground Floor preprocessing report SHA-256 mismatch')
      gate(reportBytes.length === preprocessing.report.bytes, 'Ground Floor preprocessing report byte size mismatch')
      gate(sha256Buffer(migrationBytes) === preprocessing.ownershipMigration.sha256, 'Ground Floor ownership migration SHA-256 mismatch')
      gate(migrationBytes.length === preprocessing.ownershipMigration.bytes, 'Ground Floor ownership migration byte size mismatch')
      gate(sha256Buffer(wholeLayerBytes) === preprocessing.wholeLayerContract.sha256, 'Whole-layer compatibility contract SHA-256 mismatch')
      gate(wholeLayerBytes.length === preprocessing.wholeLayerContract.bytes, 'Whole-layer compatibility contract byte size mismatch')
      gate(preprocessing.wholeLayerContract.readOnlyCompatibilityPin === true, 'Whole-layer compatibility contract is not declared read-only')
      gate(report.schema === 'iom-ground-floor-fire-hose-ownership-candidate-v1', 'Ground Floor preprocessing report schema changed')
      gate(report.enabled === false && report.productionAssetsModified === false, 'Ground Floor preprocessing report is not fail-closed')
      gate(migration.schema === 'IOM_GROUND_FLOOR_SOURCE_OWNERSHIP_MIGRATION', 'Ground Floor migration schema changed')
      gate(migration.version === 2, 'Ground Floor migration schema version changed')
      gate(migration.enabled === false && migration.productionModified === false, 'Ground Floor migration is not fail-closed')
      gate(migration.owner === OWNER_NAME, 'Ground Floor migration owner changed')
      gate(migration.atomicUnit === 'mesh-primitive-instance', 'Ground Floor migration atomic-unit definition changed')
      gate(
        migration.identityPolicy === 'pinned-active-scene-owner-relative-hierarchy-v1',
        'Ground Floor migration identity policy changed',
      )
      gate(migration.preprocessing?.report?.sha256 === preprocessing.report.sha256, 'Migration does not pin the preprocessing report')
      gate(
        migration.preprocessing?.wholeLayerContract?.sha256 === preprocessing.wholeLayerContract.sha256,
        'Migration does not pin the whole-layer compatibility contract',
      )
      gate(migration.preprocessing?.wholeLayerContract?.readOnlyCompatibilityPin === true, 'Migration whole-layer pin is not read-only')
      gate(wholeLayer.schema === 'IOM_WHOLE_LAYER_VISUAL_OWNERSHIP_CONTRACT', 'Pinned whole-layer contract schema changed')
      gate(wholeLayer.version === 1 && wholeLayer.enabled === false, 'Pinned whole-layer contract state changed')
      const variants = {}
      for (const variant of ['web', 'quest']) {
        const expected = PROFILE.expectedInputs
        const declared = preprocessing.variants?.[variant]
        const actual = migration.variants?.[variant]
        const productionPath = resolveSourceUrl(indexDir, declared?.production?.url)
        gate(Boolean(productionPath) && await exists(productionPath), `${variant}: production baseline pin is missing`)
        if (productionPath && await exists(productionPath)) {
          gate(await sha256File(productionPath) === expected.production[variant], `${variant}: production baseline hash changed`)
        }
        gate(declared?.production?.sha256 === expected.production[variant], `${variant}: declared production baseline hash changed`)
        gate(declared?.correctedPackagingInput?.sha256 === expected.corrected[variant], `${variant}: corrected input hash changed`)
        gate(actual?.production?.sha256 === expected.production[variant], `${variant}: migration production pin changed`)
        gate(actual?.correctedPackagingInput?.sha256 === expected.corrected[variant], `${variant}: migration corrected pin changed`)
        gate(exactJsonEqual(declared?.scope, actual?.scope), `${variant}: migration scope summary changed`)
        gate(exactJsonEqual(actual?.scope, expected.scope), `${variant}: exact node/atomic migration scope changed`)
        gate(exactJsonEqual(declared?.conservation, actual?.conservation), `${variant}: migration conservation summary changed`)
        gate(exactJsonEqual(declared?.transformEvidence, actual?.transformEvidence), `${variant}: migration transform evidence changed`)
        gate(exactJsonEqual(declared?.wholeLayerCompatibility, actual?.wholeLayerCompatibility), `${variant}: whole-layer compatibility summary changed`)
        gate(declared?.nodeMappingsSha256 === actual?.nodeMappingsSha256, `${variant}: node mapping digest changed`)
        gate(declared?.atomicMappingsSha256 === actual?.atomicMappingsSha256, `${variant}: migration mapping digest changed`)
        const nodeMappings = Array.isArray(actual?.nodeMappings) ? actual.nodeMappings : []
        const mappings = Array.isArray(actual?.atomicMappings) ? actual.atomicMappings : []
        gate(actual?.scope?.nodeMappingCount === nodeMappings.length, `${variant}: node mapping count is stale`)
        gate(actual?.scope?.atomicMappingCount === mappings.length, `${variant}: atomic mapping count is stale`)
        gate(nodeMappings.length === 149, `${variant}: Ground Floor corrected node coverage is not 149`)
        gate(mappings.length === 290, `${variant}: Ground Floor corrected primitive-instance coverage is not 290`)
        gate(new Set(nodeMappings.map((entry) => entry.nodeMappingId)).size === nodeMappings.length, `${variant}: duplicate node mapping id`)
        gate(new Set(nodeMappings.map((entry) => entry.productionNodeId)).size === nodeMappings.length, `${variant}: duplicate production node id`)
        gate(new Set(nodeMappings.map((entry) => entry.correctedNodeId)).size === nodeMappings.length, `${variant}: duplicate corrected node id`)
        gate(new Set(mappings.map((entry) => entry.productionAtomicId)).size === mappings.length, `${variant}: duplicate production atomic id`)
        gate(new Set(mappings.map((entry) => entry.correctedAtomicId)).size === mappings.length, `${variant}: duplicate corrected atomic id`)
        gate(mappings.every((entry) => entry.atomicId === entry.productionAtomicId), `${variant}: atomic id is not the pinned production identity`)
        gate(nodeMappings.every((entry) => entry.correctedOwnership === OWNER_NAME), `${variant}: node mapping escapes Ground Floor owner`)
        gate(mappings.every((entry) => entry.correctedOwnership === OWNER_NAME), `${variant}: atomic mapping escapes Ground Floor owner`)
        gate(
          nodeMappings.filter((entry) => entry.migration === 'reparented-fire-safety-batch').length === 6,
          `${variant}: fire-safety node migration count changed`,
        )
        gate(
          mappings.filter((entry) => entry.migration === 'reparented-fire-safety-batch').length === 60,
          `${variant}: fire-safety primitive-instance migration count changed`,
        )
        gate(
          mappings.every((entry) => entry.productionAtomicId ===
            `${entry.productionNodeId}/primitive/${entry.primitiveIndex}/instance/${entry.instanceIndex}`),
          `${variant}: production atomic identity format changed`,
        )
        gate(
          mappings.every((entry) => entry.correctedAtomicId ===
            `${entry.correctedNodeId}/primitive/${entry.primitiveIndex}/instance/${entry.instanceIndex}`),
          `${variant}: corrected atomic identity format changed`,
        )
        const atomicCountsByNode = new Map()
        for (const entry of mappings) {
          atomicCountsByNode.set(entry.productionNodeId, (atomicCountsByNode.get(entry.productionNodeId) || 0) + 1)
        }
        gate(
          nodeMappings.every((entry) => atomicCountsByNode.get(entry.productionNodeId) === entry.primitiveCount * entry.instanceCount),
          `${variant}: node-to-primitive-instance expansion is incomplete`,
        )
        const wholeVariant = wholeLayer.variants?.[variant]
        gate(wholeVariant?.source?.sha256 === expected.production[variant], `${variant}: whole-layer source pin changed`)
        gate(wholeVariant?.inventory?.atomicUnit === 'mesh-primitive-instance', `${variant}: whole-layer atomic unit changed`)
        gate(
          wholeVariant?.inventory?.identityPolicy === 'pinned-active-scene-owner-relative-hierarchy-v1',
          `${variant}: whole-layer identity policy changed`,
        )
        const wholeUnitsById = new Map((wholeVariant?.inventory?.units || []).map((entry) => [entry.id, entry]))
        gate(
          mappings.every((entry) => {
            const unit = wholeUnitsById.get(entry.productionAtomicId)
            return unit && unit.owner === entry.productionOwnership && unit.primitiveIndex === entry.primitiveIndex && unit.instanceIndex === entry.instanceIndex
          }),
          `${variant}: migration contains an atomic unit outside the pinned whole-layer contract`,
        )
        const unchangedIds = mappings
          .filter((entry) => entry.migration === 'unchanged-ground-owner-unit')
          .map((entry) => entry.productionAtomicId)
        const fireIds = mappings
          .filter((entry) => entry.migration === 'reparented-fire-safety-batch')
          .map((entry) => entry.productionAtomicId)
        const wholeGroundIds = (wholeVariant?.inventory?.units || [])
          .filter((entry) => entry.owner === OWNER_NAME)
          .map((entry) => entry.id)
        gate(exactJsonEqual([...unchangedIds].sort(), [...wholeGroundIds].sort()), `${variant}: existing Ground Floor atomic coverage differs from whole-layer contract`)
        gate(
          fireIds.every((id) => wholeUnitsById.get(id)?.owner === '__unowned__'),
          `${variant}: production fire units are not the six detached unowned batches`,
        )
        gate(
          actual?.wholeLayerCompatibility?.productionGroundOwnerUnitIdsSha256 === localeStringListSha256(unchangedIds),
          `${variant}: Ground Floor whole-layer unit digest mismatch`,
        )
        gate(
          actual?.wholeLayerCompatibility?.productionMigratedFireUnitIdsSha256 === localeStringListSha256(fireIds),
          `${variant}: migrated fire whole-layer unit digest mismatch`,
        )
        gate(
          actual?.wholeLayerCompatibility?.productionMappedUnitIdsSha256 === localeStringListSha256(mappings.map((entry) => entry.productionAtomicId)),
          `${variant}: mapped production unit digest mismatch`,
        )
        gate(
          actual?.wholeLayerCompatibility?.correctedMappedUnitIdsSha256 === localeStringListSha256(mappings.map((entry) => entry.correctedAtomicId)),
          `${variant}: mapped corrected unit digest mismatch`,
        )
        gate(actual?.conservation?.duplicateProductionNodeIds === 0, `${variant}: duplicate production node mapping exists`)
        gate(actual?.conservation?.duplicateCorrectedNodeIds === 0, `${variant}: duplicate corrected node mapping exists`)
        gate(actual?.conservation?.duplicateAtomicIds === 0, `${variant}: duplicate production atomic mapping exists`)
        gate(actual?.conservation?.duplicateCorrectedAtomicIds === 0, `${variant}: duplicate corrected atomic mapping exists`)
        gate(actual?.conservation?.missingCorrectedAtomicUnits === 0, `${variant}: corrected atomic units are missing`)
        gate(actual?.conservation?.extraCorrectedAtomicUnits === 0, `${variant}: extra corrected atomic units exist`)
        gate(sha256Buffer(Buffer.from(JSON.stringify(nodeMappings))) === actual.nodeMappingsSha256, `${variant}: node mapping digest mismatch`)
        gate(sha256Buffer(Buffer.from(JSON.stringify(mappings))) === actual.atomicMappingsSha256, `${variant}: atomic mapping digest mismatch`)
        gate(actual?.transformEvidence?.maxNodeWorldMatrixDelta === 0, `${variant}: node world transform drift exists`)
        gate(actual?.transformEvidence?.maxFireInstanceWorldMatrixDelta === 0, `${variant}: instance world transform drift exists`)
        gate(actual?.transformEvidence?.maxAtomicWorldMatrixDelta === 0, `${variant}: atomic world transform drift exists`)
        gate(mappings.every((entry) => entry.instanceWorldMatrixDelta === 0), `${variant}: per-atomic transform drift exists`)
        const reportVariant = report.variants?.[variant]
        gate(reportVariant?.batchCount === 6, `${variant}: preprocessing report fire batch count changed`)
        gate(reportVariant?.logicalInstances === 60, `${variant}: preprocessing report fire instance count changed`)
        gate(reportVariant?.expandedTriangles === expected.fireExpandedTriangles[variant], `${variant}: preprocessing report fire triangle count changed`)
        gate(
          exactJsonEqual(declared?.fireHosePayload, {
            meshNodes: 6,
            logicalInstances: 60,
            uniqueTriangles: reportVariant?.uniqueTriangles,
            expandedTriangles: expected.fireExpandedTriangles[variant],
          }),
          `${variant}: declared fire-hose payload summary changed`,
        )
        variants[variant] = {
          nodeMappingCount: nodeMappings.length,
          atomicMappingCount: mappings.length,
          migratedFireMeshNodes: actual.scope.migratedDetachedFireMeshNodes,
          migratedFireAtomicUnits: actual.scope.migratedDetachedFireAtomicUnits,
          nodeMappingsSha256: actual.nodeMappingsSha256,
          atomicMappingsSha256: actual.atomicMappingsSha256,
          maxNodeWorldMatrixDelta: actual.transformEvidence.maxNodeWorldMatrixDelta,
          maxAtomicWorldMatrixDelta: actual.transformEvidence.maxAtomicWorldMatrixDelta,
        }
      }
      preprocessingSummary = {
        reportSha256: preprocessing.report.sha256,
        migrationSha256: preprocessing.ownershipMigration.sha256,
        wholeLayerContractSha256: preprocessing.wholeLayerContract.sha256,
        variants,
      }
    }
  }

  const io = await createGltfIO({ encoder: true })
  const sourceResults = {}
  for (const variant of ['web', 'quest']) {
    const record = index.source?.[variant]
    const path = resolveSourceUrl(indexDir, record?.url)
    gate(Boolean(path) && await exists(path), `${variant}: release source path is invalid or missing`)
    if (!path || !(await exists(path))) continue
    gate(await sha256File(path) === record.sha256, `${variant}: release source SHA-256 mismatch`)
    if (PROFILE.expectedInputs) {
      gate(record.sha256 === PROFILE.expectedInputs.corrected[variant], `${variant}: audit source is not the pinned corrected packaging input`)
    }
    const document = await io.read(path)
    const owner = sourceOwnerMetrics(document)
    const animation = animationEvidence(document)
    const detachedOverlays = detachedSemanticOverlaySummary(document, owner.owner)
    gate(owner.triangles === record.owner?.triangles, `${variant}: source owner triangle metric mismatch`)
    gate(owner.draws === record.owner?.draws, `${variant}: source owner draw metric mismatch`)
    gate(owner.meshNodes === record.owner?.meshNodes, `${variant}: source owner mesh-node metric mismatch`)
    gate(boundsEqual(owner.bounds, record.owner?.bounds), `${variant}: source owner bounds mismatch`)
    gate(
      Math.abs(animation.animationDurationSeconds - index.source.animationDurationSeconds) <= 1e-6,
      `${variant}: animation duration does not match declared source duration`,
    )
    gate(
      animation.ownerTransformSamplesSha256 === record.animation?.ownerTransformSamplesSha256,
      `${variant}: source t=0/mid/end owner transform hash mismatch`,
    )
    if (record.animation && Object.hasOwn(record.animation, 'ownerAnimated')) {
      gate(animation.ownerAnimated === record.animation.ownerAnimated, `${variant}: source owner animated/static flag mismatch`)
      gate(animation.ownerChannelCount === record.animation.ownerChannelCount, `${variant}: source owner channel count mismatch`)
    }
    if (PROFILE.staticOwner) {
      gate(animation.ownerAnimated === false && animation.ownerChannelCount === 0, `${variant}: static owner unexpectedly has animation channels`)
    }
    const recordedOverlays = index.source?.detachedSemanticOverlays?.[variant]
    gate(
      exactJsonEqual(
        { ...detachedOverlays, bounds: undefined },
        { ...recordedOverlays, bounds: undefined },
      ) && boundsEqual(detachedOverlays.bounds, recordedOverlays?.bounds),
      `${variant}: detached semantic-overlay inventory mismatch`,
    )
    const sourceFile = await stat(path)
    sourceResults[variant] = {
      document,
      owner,
      animation,
      fileBytes: sourceFile.size,
      textureCopies: textureCopies(document),
      detachedOverlays,
      fireHoseRelease: fireHoseReleaseEvidence(document),
    }
  }
  if (sourceResults.web && sourceResults.quest) {
    gate(
      Math.abs(sourceResults.web.animation.animationDurationSeconds - sourceResults.quest.animation.animationDurationSeconds) <= 1e-6,
      'Web and Quest animation durations differ',
    )
    gate(
      sourceResults.web.animation.ownerTransformSamplesSha256 === sourceResults.quest.animation.ownerTransformSamplesSha256,
      `Web and Quest ${PROFILE.slug} transforms differ at t=0/mid/end`,
    )
  }

  const cleanedPath = resolveSourceUrl(indexDir, index.source?.cleaned?.url)
  gate(Boolean(cleanedPath) && await exists(cleanedPath), 'Cleaned provenance source is invalid or missing')
  if (cleanedPath && await exists(cleanedPath)) {
    gate(await sha256File(cleanedPath) === index.source.cleaned.sha256, 'Cleaned provenance source SHA-256 mismatch')
    const cleanedDocument = await io.read(cleanedPath)
    const cleanedFireHose = cleanedFireHoseEvidence(cleanedDocument)
    const provenance = index.source.detachedSemanticOverlays?.provenance
    gate(cleanedFireHose.nodes.length === 10, `Cleaned source has ${cleanedFireHose.nodes.length} FireHoseHousing nodes, expected 10`)
    gate(exactJsonEqual(cleanedFireHose.nodes, provenance?.cleanedSourceNodes), 'Fire-hose cleaned node inventory mismatch')
    gate(exactJsonEqual(cleanedFireHose.ownerNames, provenance?.cleanedSourceOwnerNames), 'Fire-hose source owner mismatch')
    gate(exactJsonEqual(cleanedFireHose.meshes, provenance?.cleanedSharedMeshes), 'Fire-hose shared mesh provenance mismatch')
    gate(exactJsonEqual(cleanedFireHose.materials, provenance?.cleanedMaterialSlots), 'Fire-hose material-slot provenance mismatch')
    gate(exactJsonEqual(cleanedFireHose.ownerNames, ['Ground Floor._anim1']), 'Fire-hose sources are not exclusively Ground Floor owned')
    for (const variant of ['web', 'quest']) {
      const release = sourceResults[variant]?.fireHoseRelease
      const recorded = provenance?.variantEvidence?.[variant]
      if (!release) continue
      const actual = {
        rootBatchCount: release.rootBatchCount,
        ...(Object.hasOwn(recorded || {}, 'ownedBatchCount') ? { ownedBatchCount: release.ownedBatchCount } : {}),
        instancesPerBatch: release.instancesPerBatch,
        identifyingMaterials: release.identifyingMaterials,
        maxTranslationErrorMeters: maxNearestTranslationError(cleanedFireHose.translations, release.batchTranslations),
        groundFloorOwnerAnimatedInCurrentClip: release.groundFloorOwnerAnimatedInCurrentClip,
        groundFloorOwnerRestMatrix: release.groundFloorOwnerRestMatrix,
      }
      gate(exactJsonEqual(actual, recorded), `${variant}: fire-hose root-batch ownership evidence mismatch`)
      if (PROFILE.slug === 'ground-floor') {
        gate(actual.rootBatchCount === 0 && actual.ownedBatchCount === 6, `${variant}: corrected fire-hose ownership is incomplete`)
      }
      gate(actual.groundFloorOwnerAnimatedInCurrentClip === false, `${variant}: Ground Floor unexpectedly animated in current clip`)
      gate(
        exactJsonEqual(actual.groundFloorOwnerRestMatrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
        `${variant}: Ground Floor rest transform is not identity`,
      )
    }
  }

  const rigPath = resolvePackageUrl(indexDir, index.rig?.url)
  gate(Boolean(rigPath) && await exists(rigPath), 'Rig path is invalid or missing')
  let rigSummary = null
  if (rigPath && await exists(rigPath)) {
    const rigFile = await stat(rigPath)
    gate(await sha256File(rigPath) === index.rig.sha256, 'Rig SHA-256 mismatch')
    gate(rigFile.size === index.rig.bytes, 'Rig byte size mismatch')
    const rigDocument = await io.read(rigPath)
    const rigAnimation = animationEvidence(rigDocument)
    gate(rigDocument.getRoot().listMeshes().length === 0, 'Rig unexpectedly contains render meshes')
    gate(rigDocument.getRoot().listTextures().length === 0, 'Rig unexpectedly contains textures')
    gate(
      Math.abs(rigAnimation.animationDurationSeconds - index.rig.animationDurationSeconds) <= 1e-6,
      'Rig animation duration differs from declaration',
    )
    gate(rigAnimation.ownerTransformSamplesSha256 === index.rig.ownerTransformSamplesSha256, 'Rig transform sample hash mismatch')
    if (Object.hasOwn(index.rig, 'ownerAnimated')) {
      gate(rigAnimation.ownerAnimated === index.rig.ownerAnimated, 'Rig owner animated/static flag mismatch')
      gate(rigAnimation.ownerChannelCount === index.rig.ownerChannelCount, 'Rig owner channel count mismatch')
    }
    gate(index.rig.transformSampleMatch === true, 'Rig transform verification flag is not true')
    if (sourceResults.web) {
      gate(
        rigAnimation.ownerTransformSamplesSha256 === sourceResults.web.animation.ownerTransformSamplesSha256,
        `Rig ${PROFILE.slug} transforms differ from exact Web source at t=0/mid/end`,
      )
      gate(
        rigAnimation.clipCount === sourceResults.web.animation.clipCount &&
        rigAnimation.channelCount === sourceResults.web.animation.channelCount,
        'Rig clip/channel count differs from exact Web source',
      )
    }
    rigSummary = {
      sha256: index.rig.sha256,
      bytes: rigFile.size,
      animationDurationSeconds: rigAnimation.animationDurationSeconds,
      clipCount: rigAnimation.clipCount,
      channelCount: rigAnimation.channelCount,
      ownerTransformSamplesSha256: rigAnimation.ownerTransformSamplesSha256,
    }
  }

  const metricKeys = [
    'sha256', 'triangles', 'draws', 'bytes', 'encodedTextureBytes', 'gpuTextureBytes', 'meshNodes', 'logicalInstances',
    'materialCount', 'textureCount', 'ktx2Textures', 'doubleSidedMaterials', 'materialRoles',
    'materialRoleCounts', 'doubleSidedReasons', 'doubleSidedReasonCounts', 'alphaModeCounts',
    'pbrMaterialSha256', 'criticalNodes', 'attributes', 'missingPosition', 'missingNormal',
    'missingReferencedTexcoord', 'extensionsUsed', 'sourcePathCount', 'sourcePathsSha256',
    'duplicateSourcePaths',
  ]
  const coverage = { web: [], quest: [] }
  const aggregate = {
    web: { triangles: 0, draws: 0, bytes: 0, encodedTextureBytes: 0, gpuTextureBytes: 0 },
    quest: { triangles: 0, draws: 0, bytes: 0, encodedTextureBytes: 0, gpuTextureBytes: 0 },
  }
  const criticalCounts = {
    web: Object.fromEntries(CRITICAL_NAMES.map((name) => [name, 0])),
    quest: Object.fromEntries(CRITICAL_NAMES.map((name) => [name, 0])),
  }
  const runtimeTextureCopies = { web: [], quest: [] }
  const packageTextureCosts = { web: [], quest: [] }
  const payloadReport = []

  const auditPayload = async (pkg, variant, stage, record) => {
    const path = resolvePackageUrl(indexDir, record?.url)
    gate(Boolean(path) && await exists(path), `${pkg.id}/${variant}/${stage}: invalid or missing payload`)
    if (!path || !(await exists(path))) return null
    const actual = await payloadMetrics(io, path)
    gate(actual.metrics.sha256 === record.sha256, `${pkg.id}/${variant}/${stage}: SHA-256 mismatch`)
    for (const key of metricKeys) {
      gate(exactJsonEqual(actual.metrics[key], record.metrics?.[key]), `${pkg.id}/${variant}/${stage}: ${key} metric mismatch`)
    }
    gate(boundsEqual(actual.metrics.bounds, record.metrics?.bounds), `${pkg.id}/${variant}/${stage}: bounds metric mismatch`)
    if (stage === 'lod0') {
      gate(boundsEqual(actual.metrics.bounds, record.bounds), `${pkg.id}/${variant}/${stage}: exact payload bounds mismatch`)
    }
    gate(actual.metrics.missingPosition === 0, `${pkg.id}/${variant}/${stage}: primitive lacks POSITION`)
    gate(actual.metrics.missingNormal === 0, `${pkg.id}/${variant}/${stage}: primitive lacks NORMAL`)
    gate(actual.metrics.missingReferencedTexcoord === 0, `${pkg.id}/${variant}/${stage}: material references absent UV set`)
    gate(actual.metrics.duplicateSourcePaths === 0, `${pkg.id}/${variant}/${stage}: duplicate source ownership paths`)
    gate(!actual.nodeNames.includes(OWNER_NAME), `${pkg.id}/${variant}/${stage}: persistent owner was duplicated into payload`)
    gate(actual.animationCount === 0, `${pkg.id}/${variant}/${stage}: detail payload unexpectedly contains animation`)
    if (actual.metrics.textureCount > 0) {
      gate(actual.metrics.ktx2Textures === actual.metrics.textureCount, `${pkg.id}/${variant}/${stage}: non-KTX2 texture exists`)
      gate(actual.metrics.extensionsUsed.includes('KHR_texture_basisu'), `${pkg.id}/${variant}/${stage}: KTX2 extension missing`)
    }
    if (stage === 'dcc-source') {
      gate(
        actual.metrics.sourcePathCount === pkg.content?.[variant]?.sourcePathCount &&
        actual.metrics.sourcePathsSha256 === pkg.content?.[variant]?.sourcePathsSha256 &&
        pkg.content?.[variant]?.ownershipStage === 'dcc-source',
        `${pkg.id}/${variant}: DCC-source content ownership digest mismatch`,
      )
      coverage[variant].push(...actual.sourcePaths)
    }
    if (stage === 'lod0') {
      gate(actual.metrics.triangles <= index.budgets.maxDetailTriangles, `${pkg.id}/${variant}: triangle budget exceeded`)
      gate(actual.metrics.draws <= index.budgets.maxDetailDraws, `${pkg.id}/${variant}: draw budget exceeded`)
      gate(actual.metrics.extensionsUsed.includes('EXT_meshopt_compression'), `${pkg.id}/${variant}: meshopt compression missing`)
      for (const name of actual.metrics.criticalNodes) criticalCounts[variant][name] += 1
      runtimeTextureCopies[variant].push(...actual.textureCopies.map((copy) => ({ ...copy, packageId: pkg.id })))
      packageTextureCosts[variant].push({
        packageId: pkg.id,
        triangles: actual.metrics.triangles,
        decodedRgba8Bytes: actual.textureCopies.reduce(
          (sum, copy) => sum + (copy.decodedRgba8Bytes || 0),
          0,
        ),
      })
      aggregate[variant].triangles += actual.metrics.triangles
      aggregate[variant].draws += actual.metrics.draws
      aggregate[variant].bytes += actual.metrics.bytes
      aggregate[variant].encodedTextureBytes += actual.metrics.encodedTextureBytes
      aggregate[variant].gpuTextureBytes += actual.metrics.gpuTextureBytes
    }
    payloadReport.push({
      packageId: pkg.id,
      variant,
      stage,
      url: record.url,
      sha256: actual.metrics.sha256,
      triangles: actual.metrics.triangles,
      draws: actual.metrics.draws,
      bytes: actual.metrics.bytes,
      encodedTextureBytes: actual.metrics.encodedTextureBytes,
      gpuTextureBytes: actual.metrics.gpuTextureBytes,
      sourcePathCount: actual.metrics.sourcePathCount,
      pbrMaterialSha256: actual.metrics.pbrMaterialSha256,
    })
    return actual
  }

  for (const pkg of index.packages) {
    gate(pkg.ownerId === index.owner.id, `${pkg.id}: ownerId mismatch`)
    gate(pkg.transform?.space === 'owner-local', `${pkg.id}: transform is not owner-local`)
    gate(exactJsonEqual(pkg.requiredAttributes, REQUIRED_ATTRIBUTES), `${pkg.id}: required-attribute declaration changed`)
    for (const variant of ['web', 'quest']) {
      gate(Array.isArray(pkg.sourcePaths?.[variant]) && pkg.sourcePaths[variant].length > 0, `${pkg.id}/${variant}: sourcePaths are missing`)
    }
    const actualByVariant = {}
    for (const variant of ['web', 'quest']) {
      const raw = await auditPayload(pkg, variant, 'dcc-source', pkg.dccSources?.[variant])
      const lod0 = await auditPayload(pkg, variant, 'lod0', pkg.variants?.[variant]?.lod0)
      actualByVariant[variant] = lod0
      if (raw && lod0) {
        gate(raw.metrics.triangles === lod0.metrics.triangles, `${pkg.id}/${variant}: raw-to-LOD0 triangles changed`)
        gate(raw.metrics.pbrMaterialSha256 === lod0.metrics.pbrMaterialSha256, `${pkg.id}/${variant}: raw-to-LOD0 PBR changed`)
        gate(exactJsonEqual(raw.metrics.materialRoleCounts, lod0.metrics.materialRoleCounts), `${pkg.id}/${variant}: semantic material roles changed`)
        gate(exactJsonEqual(raw.metrics.doubleSidedReasonCounts, lod0.metrics.doubleSidedReasonCounts), `${pkg.id}/${variant}: surface-sidedness reasons changed`)
      }
    }
    if (actualByVariant.web && actualByVariant.quest) {
      for (const variant of ['web', 'quest']) {
        gate(
          boundsInside(actualByVariant[variant].metrics.bounds, pkg.selectionBounds?.[variant]),
          `${pkg.id}/${variant}: payload bounds escape owner-local selection bounds`,
        )
      }
    }
    if (pkg.id === CRITICAL_PACKAGE_ID) {
      for (const variant of ['web', 'quest']) {
        const actual = actualByVariant[variant]
        if (!actual) continue
        for (const role of CRITICAL_REQUIRED_ROLES) {
          gate(pkg.semanticRoles.includes(role), `${variant}: critical package omits required ${role} semantic role`)
        }
        if (PROFILE.slug === 'ground-floor') {
          const migratedNodePaths = (preprocessingMigration?.variants?.[variant]?.nodeMappings || [])
            .filter((entry) => entry.migration === 'reparented-fire-safety-batch')
            .map((entry) => entry.correctedOwnerPath)
            .sort()
          gate(actual.metrics.meshNodes === 6, `${variant}: critical fire-hose package does not contain six mesh batches`)
          gate(actual.metrics.logicalInstances === 60, `${variant}: critical fire-hose package does not retain 60 logical instances`)
          gate(actual.metrics.draws === 6, `${variant}: critical fire-hose package renderer draw count changed`)
          gate(
            actual.metrics.triangles === PROFILE.expectedInputs.fireExpandedTriangles[variant],
            `${variant}: critical fire-hose package expanded triangle count changed`,
          )
          gate(actual.metrics.sourcePathCount === 6, `${variant}: critical fire-hose package source-path count changed`)
          gate(
            exactJsonEqual([...actual.sourcePaths].sort(), migratedNodePaths),
            `${variant}: critical fire-hose package does not exactly own the six migrated source nodes`,
          )
          gate(
            actual.metrics.materialRoles.length > 0 &&
              actual.metrics.materialRoles.every((role) => role.startsWith(PROFILE.criticalMaterialRolePrefix)),
            `${variant}: critical package contains a non-fire-safety material role`,
          )
          gate(
            actual.metrics.extensionsUsed.includes('EXT_mesh_gpu_instancing'),
            `${variant}: critical package lost EXT_mesh_gpu_instancing`,
          )
        }
      }
    }
  }

  for (const variant of ['web', 'quest']) {
    gate(exactJsonEqual(aggregate[variant], index.aggregate?.[variant]), `${variant}: detail aggregate metric mismatch`)
    if (!sourceResults[variant]) continue
    const actualPaths = [...coverage[variant]].sort()
    gate(actualPaths.length === new Set(actualPaths).size, `${variant}: source mesh path appears in more than one package`)
    for (const name of CRITICAL_NAMES) {
      gate(criticalCounts[variant][name] === 1, `${variant}: critical node ${name} occurs ${criticalCounts[variant][name]} times`)
    }
  }
  for (const variant of ['web', 'quest']) {
    const declaredDetailPaths = index.packages.flatMap((pkg) => pkg.sourcePaths?.[variant] || []).sort()
    gate(index.detailOwnership?.[variant]?.mode === 'disjoint-additive', `${variant}: detail ownership mode is not disjoint-additive`)
    gate(index.detailOwnership?.[variant]?.pathCount === declaredDetailPaths.length, `${variant}: detail ownership path count changed`)
    gate(index.detailOwnership?.[variant]?.pathsSha256 === stringListSha256(declaredDetailPaths), `${variant}: detail ownership digest changed`)
  }

  const missingShell = []
  const actualShellTriangles = { web: 0, quest: 0 }
  const shellCoverage = { web: [], quest: [] }
  const shellPayloads = {}
  const shellContract = index.shellCompletion?.requiredAlwaysResidentShell
  const shellCandidateBuilt = index.shellCompletion?.candidateBuilt === true
  gate(shellContract?.kind === 'always-resident-shell', 'Required shell kind is invalid')
  gate(shellContract?.residency === 'persistent-lossless', 'Required shell residency is invalid')
  gate(shellContract?.ownerId === index.owner.id, 'Required shell owner is invalid')
  if (shellCandidateBuilt) {
    gate(exactJsonEqual(shellContract?.semanticRoles, SHELL_SEMANTIC_ROLES), 'Shell semantic roles changed')
  }
  gate(
    shellContract?.requiresDetailOwnershipRepartition === !shellCandidateBuilt,
    'Shell ownership-repartition status is inconsistent with candidate completion',
  )
  gate(
    shellCandidateBuilt
      ? index.shellCompletion?.ownershipRepartitioned === true
      : index.shellCompletion?.ownershipRepartitioned !== true,
    'Shell ownership completion flag is inconsistent',
  )
  gate(exactJsonEqual(shellContract?.requiredAttributes, REQUIRED_ATTRIBUTES), 'Required shell attributes changed')
  gate(Object.keys(shellContract?.outputs || {}).sort().join(',') === 'quest,web', 'Shell must declare Web and Quest outputs')
  for (const [variant, url] of Object.entries(shellContract?.outputs || {})) {
    const path = resolvePackageUrl(indexDir, url)
    if (!path || !(await exists(path))) {
      missingShell.push(variant)
      continue
    }
    const actual = await payloadMetrics(io, path)
    shellPayloads[variant] = actual
    actualShellTriangles[variant] += actual.metrics.triangles
    gate(
      actual.metrics.triangles <= shellContract.maxTriangles,
      `${variant}: always-resident shell triangle budget exceeded`,
    )
    gate(actual.metrics.missingPosition === 0 && actual.metrics.missingNormal === 0, `${variant}: shell lacks POSITION/NORMAL`)
    gate(actual.metrics.missingReferencedTexcoord === 0, `${variant}: shell material references absent UVs`)
    gate(Object.keys(actual.metrics.alphaModeCounts).every((mode) => mode === 'OPAQUE'), `${variant}: shell contains non-opaque materials`)
    gate(actual.animationCount === 0, `${variant}: shell unexpectedly contains animation`)
    gate(!actual.nodeNames.includes(OWNER_NAME), `${variant}: shell duplicates the persistent animation owner`)
    gate(actual.metrics.criticalNodes.length === 0, `${variant}: shell duplicates Fire or connector critical nodes`)
    for (const role of CRITICAL_REQUIRED_ROLES) {
      gate(
        !actual.metrics.materialRoles.some((materialRole) => materialRole === role || materialRole.startsWith(`${role}-`)),
        `${variant}: shell duplicates persistent ${role} content`,
      )
    }
    if (shellCandidateBuilt) {
      const declared = shellContract.variants?.[variant]
      const declaredPaths = shellContract.sourcePaths?.[variant] || []
      const declaredContent = shellContract.content?.[variant]
      gate(declared?.url === url, `${variant}: shell output URL differs from its variant record`)
      gate(actual.metrics.sha256 === declared?.sha256, `${variant}: shell SHA-256 mismatch`)
      for (const key of metricKeys) {
        gate(exactJsonEqual(actual.metrics[key], declared?.metrics?.[key]), `${variant}: shell ${key} metric mismatch`)
      }
      gate(boundsEqual(actual.metrics.bounds, declared?.metrics?.bounds), `${variant}: shell bounds metric mismatch`)
      gate(boundsEqual(actual.metrics.bounds, declared?.bounds), `${variant}: shell exact payload bounds mismatch`)
      gate(boundsEqual(actual.metrics.bounds, shellContract.selectionBounds?.[variant]), `${variant}: shell selection bounds mismatch`)
      gate(exactJsonEqual(actual.sourcePaths, [...declaredPaths].sort()), `${variant}: shell path list differs from contract`)
      gate(declaredContent?.ownershipStage === 'lossless-source-subset', `${variant}: shell ownership stage is invalid`)
      gate(declaredContent?.sourcePathCount === actual.metrics.sourcePathCount, `${variant}: shell ownership path count mismatch`)
      gate(declaredContent?.sourcePathsSha256 === actual.metrics.sourcePathsSha256, `${variant}: shell ownership digest mismatch`)
      const sourceSubset = sourceSubsetMetrics(sourceResults[variant].document, declaredPaths)
      gate(exactJsonEqual(sourceSubset.sourcePaths, actual.sourcePaths), `${variant}: shell paths do not resolve exactly in source`)
      gate(sourceSubset.triangles === actual.metrics.triangles, `${variant}: shell source triangles changed`)
      gate(sourceSubset.draws === actual.metrics.draws, `${variant}: shell source draws changed`)
      gate(boundsEqual(sourceSubset.bounds, actual.metrics.bounds), `${variant}: shell source bounds changed`)
      gate(sourceSubset.pbrMaterialSha256 === actual.metrics.pbrMaterialSha256, `${variant}: shell source PBR/sidedness changed`)
      gate(sourceSubset.missingPosition === 0 && sourceSubset.missingNormal === 0, `${variant}: selected source lacks POSITION/NORMAL`)
      gate(sourceSubset.missingReferencedTexcoord === 0, `${variant}: selected source material references absent UVs`)
      gate(Object.keys(sourceSubset.alphaModeCounts).every((mode) => mode === 'OPAQUE'), `${variant}: selected source is not opaque`)
      gate(sourceSubset.transmissiveMaterials === 0, `${variant}: selected source contains transmissive materials`)
      gate(sourceSubset.criticalNodes.length === 0, `${variant}: selected source overlaps Fire/connectors`)
      shellCoverage[variant].push(...actual.sourcePaths)
    }
  }
  for (const variant of ['web', 'quest']) {
    if (!sourceResults[variant]) continue
    const expectedPaths = sourceResults[variant].owner.sourcePaths
    const detailPaths = [...coverage[variant]].sort()
    const shellPaths = [...shellCoverage[variant]].sort()
    const completePaths = [...detailPaths, ...shellPaths].sort()
    gate(shellPaths.length === new Set(shellPaths).size, `${variant}: shell source path is duplicated`)
    gate(shellPaths.every((path) => !new Set(detailPaths).has(path)), `${variant}: shell and detail ownership overlap`)
    gate(exactJsonEqual(completePaths, expectedPaths), `${variant}: shell plus detail ownership does not exactly cover ${PROFILE.slug} source meshes`)
    gate(
      aggregate[variant].triangles + actualShellTriangles[variant] === sourceResults[variant].owner.triangles,
      `${variant}: shell plus detail expanded triangles are not conserved`,
    )
    if (shellCandidateBuilt) {
      const completeOwnership = index.completeOwnership?.[variant]
      gate(completeOwnership?.mode === 'disjoint-additive', `${variant}: complete ownership mode is invalid`)
      gate(completeOwnership?.pathCount === completePaths.length, `${variant}: complete ownership path count mismatch`)
      gate(completeOwnership?.pathsSha256 === stringListSha256(completePaths), `${variant}: complete ownership digest mismatch`)
      gate(
        exactJsonEqual(completeOwnership?.components, [SHELL_ID, 'detail-packages']),
        `${variant}: complete ownership components changed`,
      )
    }
  }
  for (const variant of ['web', 'quest']) {
    const criticalTriangles = index.packages.find((pkg) => pkg.id === CRITICAL_PACKAGE_ID)
      ?.variants?.[variant]?.lod0?.metrics?.triangles || 0
    const target = {
      criticalTriangles,
      withMaxShellTriangles: criticalTriangles + index.budgets.maxAlwaysResidentShellTriangles,
    }
    gate(
      exactJsonEqual(index.shellCompletion?.persistentTriangleTargets?.[variant], target),
      `${variant}: shell plus persistent-critical target is stale`,
    )
    gate(target.withMaxShellTriangles <= index.budgets.maxResidentTriangles[variant], `${variant}: shell cap plus critical LOD0 exceeds resident budget`)
    if (!missingShell.includes(variant)) {
      gate(
        actualShellTriangles[variant] + criticalTriangles <= index.budgets.maxResidentTriangles[variant],
        `${variant}: actual shell plus persistent critical LOD0 exceeds resident budget`,
      )
    }
  }
  if (missingShell.length) {
    blockers.push(
      `${missingShell.length} always-resident shell variant(s) still require visually approved DCC authoring. ` +
      'Per-detail HLOD is optional and is not an activation requirement.',
    )
  } else if (shellCandidateBuilt) {
    blockers.push(
      'The lossless opaque shell candidate and disjoint ownership pass machine audit, but multi-angle browser/DCC visual approval is still required before activation.',
    )
  }
  if (Object.values(sourceResults).some((source) => source.detachedOverlays.nodeCount > 0)) {
    blockers.push(
      'Six detached instanced fire-hose material batches belong to Ground Floor._anim1; reparent them while preserving world transforms before Ground Floor streaming. Current clip placement is not proven visually wrong because Ground Floor is static and identity.',
    )
  }
  if (args.requireShell) {
    gate(missingShell.length === 0, `Missing required shells: ${missingShell.join(', ')}`)
  } else if (shellCandidateBuilt) {
    notes.push('The generated shell candidate was audited even without --require-shell; pass --require-shell in release review to make its presence an explicit gate.')
  } else {
    notes.push('Shell absence is expected for this disabled detail-package stage; use --require-shell after DCC authoring. Regional HLOD remains optional.')
  }

  const textureDuplication = {}
  for (const variant of ['web', 'quest']) {
    const source = sourceResults[variant]
    if (!source) continue
    const summary = textureDuplicationSummary(
      runtimeTextureCopies[variant],
      packageTextureCosts[variant],
      index.budgets.maxResidentTriangles[variant],
      source.fileBytes,
      source.textureCopies,
    )
    summary.runtimePackageBytes = aggregate[variant].bytes
    summary.runtimePackageToSourceFileRatio = source.fileBytes ? aggregate[variant].bytes / source.fileBytes : null
    textureDuplication[variant] = summary
    gate(summary.runtimeHashesAbsentFromSource.length === 0, `${variant}: package texture content is absent from source GLB`)
    if (
      summary.duplicatedTextureBytes > Math.max(8 * 1024 * 1024, summary.uniqueTextureBytes * 0.25) ||
      summary.runtimePackageToSourceFileRatio > 1.25
    ) {
      blockers.push(
        `${variant}: self-contained GLBs duplicate ${summary.duplicatedTextureBytes.toLocaleString()} embedded texture bytes ` +
        `(${summary.embeddedCopies} copies / ${summary.uniqueContentHashes} unique hashes); shared external textures or ` +
        'package-local atlases are required before activation.',
      )
    }
  }

  const report = {
    schema: 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_AUDIT',
    version: 1,
    generatedAt: new Date().toISOString(),
    index: relative(indexDir, indexPath).replaceAll('\\', '/'),
    requireShell: args.requireShell,
    detailPayloadStatus: failures.length ? 'failed' : 'passed',
    activationStatus: failures.length || blockers.length ? 'blocked' : 'ready-for-visual-review',
    assertions,
    failures,
    blockers,
    notes,
    owner: OWNER_NAME,
    packageCount: index.packages.length,
    payloadCount: payloadReport.length + Object.keys(shellPayloads).length + (rigSummary ? 1 : 0),
    payloadSetSha256: createHash('sha256').update([
      ...payloadReport.map((payload) => `${payload.url}:${payload.sha256}`),
      ...Object.entries(shellPayloads).map(([variant, payload]) =>
        `${shellContract.outputs[variant]}:${payload.metrics.sha256}`,
      ),
      ...(rigSummary ? [`${index.rig.url}:${rigSummary.sha256}`] : []),
    ].sort().join('\n')).digest('hex'),
    sourceAnimationDurationSeconds: index.source.animationDurationSeconds,
    rig: rigSummary,
    preprocessing: preprocessingSummary,
    aggregate,
    sourceCoverage: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
      expectedMeshPaths: sourceResults[variant]?.owner.sourcePaths.length || 0,
      detailMeshPaths: coverage[variant].length,
      shellMeshPaths: shellCoverage[variant].length,
      completeMeshPaths: coverage[variant].length + shellCoverage[variant].length,
      detailPathsSha256: stringListSha256(coverage[variant]),
      shellPathsSha256: stringListSha256(shellCoverage[variant]),
      completePathsSha256: stringListSha256([...coverage[variant], ...shellCoverage[variant]]),
    }])),
    criticalNodeCounts: criticalCounts,
    textureDuplication,
    missingShellVariants: missingShell,
    shell: Object.fromEntries(Object.entries(shellPayloads).map(([variant, payload]) => [variant, {
      url: shellContract.outputs[variant],
      sha256: payload.metrics.sha256,
      triangles: payload.metrics.triangles,
      draws: payload.metrics.draws,
      bytes: payload.metrics.bytes,
      sourcePathCount: payload.metrics.sourcePathCount,
      bounds: payload.metrics.bounds,
    }])),
    optionalRegionalHlod: {
      required: false,
      status: index.optionalRegionalHlod?.status || 'not-authored-not-blocking',
    },
    payloads: payloadReport,
    visualApprovalRequired: true,
  }
  const reportPath = resolve(indexDir, args.requireShell ? 'shell-package-audit.json' : 'detail-package-audit.json')
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  console.log(`Audit report: ${reportPath}`)
  console.log(`Detail payload status: ${report.detailPayloadStatus} (${assertions} assertions)`)
  console.log(`Activation status: ${report.activationStatus}`)
  console.log(`Packages: ${report.packageCount}; audited payloads: ${report.payloadCount}`)
  console.log(`Web: ${aggregate.web.triangles.toLocaleString()} tris, ${aggregate.web.bytes.toLocaleString()} bytes`)
  console.log(`Quest: ${aggregate.quest.triangles.toLocaleString()} tris, ${aggregate.quest.bytes.toLocaleString()} bytes`)
  if (blockers.length) console.log(`Blocker: ${blockers.join(' ')}`)
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL: ${failure}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
