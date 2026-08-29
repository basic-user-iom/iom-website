/**
 * Build a disabled selective-LOD pilot for the dominant repeated Ground Floor
 * furniture mesh. This is an offline evidence tool only: it never edits public
 * assets, manifests, or viewer runtime code.
 *
 * Target contract:
 *   mesh: Mesh.13786
 *   users: Stuhl_Tisch_Rechts_Reihe_* under Ground Floor._anim1
 *   source triangles: 61,269 unique / 4,778,982 expanded across 78 users
 *
 * Usage:
 *   node scripts/build-ground-floor-selective-repeat-lod-pilot.mjs
 *   node scripts/build-ground-floor-selective-repeat-lod-pilot.mjs --self-test
 *   node scripts/build-ground-floor-selective-repeat-lod-pilot.mjs --input <file.glb> --out <dir>
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document } from '@gltf-transform/core'
import {
  compactPrimitive,
  copyToDocument,
  createDefaultPropertyResolver,
  prune,
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const DEFAULT_INPUT = resolve(VIEWER_ROOT, 'tmp', 'icm-anim-2025-cleaned.glb')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', 'repeat-lod-ground-floor')

const TARGET_MESH = 'Mesh.13786'
const TARGET_OWNER = 'Ground Floor._anim1'
const TARGET_NODE_PATTERN = /^Stuhl_Tisch_Rechts_Reihe_/
const EXPECTED_USERS = 78
const EXPECTED_UNIQUE_TRIANGLES = 61_269
const EXPECTED_EXPANDED_TRIANGLES = 4_778_982
const EXPECTED_PRIMITIVES = 4
const REQUIRED_BASE_SEMANTICS = ['POSITION', 'NORMAL']

// The source remains LOD0. Mid and far are deliberately conservative. The
// aggressive probe is evidence only and is never recommended for selection.
const CANDIDATE_SPECS = Object.freeze([
  Object.freeze({
    id: 'near-source',
    role: 'near',
    ratio: 1,
    error: 0,
    file: 'Mesh.13786-near-source.glb',
    selectableAfterVisualApproval: true,
  }),
  Object.freeze({
    id: 'mid-conservative',
    role: 'mid',
    ratio: 0.72,
    error: 0.00075,
    file: 'Mesh.13786-mid-conservative.glb',
    selectableAfterVisualApproval: true,
  }),
  Object.freeze({
    id: 'far-conservative',
    role: 'far',
    ratio: 0.48,
    error: 0.0025,
    file: 'Mesh.13786-far-conservative.glb',
    selectableAfterVisualApproval: true,
  }),
  Object.freeze({
    id: 'aggressive-probe',
    role: 'diagnostic-only',
    ratio: 0.24,
    error: 0.0075,
    file: 'Mesh.13786-aggressive-probe.glb',
    selectableAfterVisualApproval: false,
  }),
])

const TEXTURE_SLOTS = Object.freeze([
  ['baseColor', 'getBaseColorTexture', 'getBaseColorTextureInfo'],
  ['metallicRoughness', 'getMetallicRoughnessTexture', 'getMetallicRoughnessTextureInfo'],
  ['normal', 'getNormalTexture', 'getNormalTextureInfo'],
  ['occlusion', 'getOcclusionTexture', 'getOcclusionTextureInfo'],
  ['emissive', 'getEmissiveTexture', 'getEmissiveTextureInfo'],
])

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    out: DEFAULT_OUT,
    selfTest: false,
  }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--input') args.input = resolve(argv[++index])
    else if (value === '--out') args.out = resolve(argv[++index])
    else if (value === '--self-test') args.selfTest = true
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

export function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function sha256Record(value) {
  return sha256Bytes(Buffer.from(stableStringify(value)))
}

async function sha256File(path) {
  return sha256Bytes(await readFile(path))
}

function cloneExtras(extras) {
  return extras && typeof extras === 'object' ? structuredClone(extras) : {}
}

function triangleCount(primitive) {
  const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
  const mode = primitive.getMode()
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

function toUint32(array) {
  return array instanceof Uint32Array ? new Uint32Array(array) : Uint32Array.from(array)
}

function normalizedComponent(value, componentType) {
  if (componentType === 5120) return Math.max(-1, value / 127)
  if (componentType === 5121) return value / 255
  if (componentType === 5122) return Math.max(-1, value / 32767)
  if (componentType === 5123) return value / 65535
  return value
}

function accessorAsFloat32(accessor) {
  const source = accessor.getArray()
  if (!source) throw new Error(`Accessor ${accessor.getName() || '(unnamed)'} has no array`)
  if (source instanceof Float32Array && !accessor.getNormalized()) return source
  const output = new Float32Array(source.length)
  const normalized = accessor.getNormalized()
  const componentType = accessor.getComponentType()
  for (let index = 0; index < source.length; index += 1) {
    output[index] = normalized ? normalizedComponent(source[index], componentType) : source[index]
  }
  return output
}

function attributeWeight(semantic, componentIndex) {
  if (semantic.startsWith('NORMAL')) return 1
  if (semantic.startsWith('TANGENT')) return componentIndex === 3 ? 0.25 : 1
  if (semantic.startsWith('TEXCOORD')) return 0.5
  if (semantic.startsWith('COLOR')) return 0.5
  return 0.25
}

function weightedAttributes(primitive) {
  const semantics = primitive.listSemantics().filter((semantic) => {
    return /^(NORMAL|TANGENT|TEXCOORD|COLOR)_?\d*$/.test(semantic)
  })
  if (!semantics.length) return null
  const positionCount = primitive.getAttribute('POSITION').getCount()
  const accessors = semantics.map((semantic) => primitive.getAttribute(semantic))
  if (accessors.some((accessor) => accessor.getCount() !== positionCount)) {
    throw new Error('Weighted attribute count does not match POSITION count')
  }
  const stride = accessors.reduce((sum, accessor) => sum + accessor.getElementSize(), 0)
  const output = new Float32Array(positionCount * stride)
  const weights = []
  const arrays = accessors.map(accessorAsFloat32)
  for (let accessorIndex = 0; accessorIndex < accessors.length; accessorIndex += 1) {
    const size = accessors[accessorIndex].getElementSize()
    for (let component = 0; component < size; component += 1) {
      weights.push(attributeWeight(semantics[accessorIndex], component))
    }
  }
  for (let vertex = 0; vertex < positionCount; vertex += 1) {
    let offset = vertex * stride
    for (let accessorIndex = 0; accessorIndex < accessors.length; accessorIndex += 1) {
      const size = accessors[accessorIndex].getElementSize()
      const array = arrays[accessorIndex]
      for (let component = 0; component < size; component += 1) {
        output[offset++] = array[vertex * size + component]
      }
    }
  }
  return { array: output, stride, weights, semantics }
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function triangleAreaSquared(positions, a, b, c) {
  const ax = positions[a * 3]
  const ay = positions[a * 3 + 1]
  const az = positions[a * 3 + 2]
  const abx = positions[b * 3] - ax
  const aby = positions[b * 3 + 1] - ay
  const abz = positions[b * 3 + 2] - az
  const acx = positions[c * 3] - ax
  const acy = positions[c * 3 + 1] - ay
  const acz = positions[c * 3 + 2] - az
  const cx = aby * acz - abz * acy
  const cy = abz * acx - abx * acz
  const cz = abx * acy - aby * acx
  return (cx * cx + cy * cy + cz * cz) * 0.25
}

class UnionFind {
  constructor(size) {
    this.parent = Uint32Array.from({ length: size }, (_, index) => index)
    this.rank = new Uint8Array(size)
  }

  find(value) {
    let root = value
    while (this.parent[root] !== root) root = this.parent[root]
    while (this.parent[value] !== value) {
      const next = this.parent[value]
      this.parent[value] = root
      value = next
    }
    return root
  }

  union(a, b) {
    let rootA = this.find(a)
    let rootB = this.find(b)
    if (rootA === rootB) return
    if (this.rank[rootA] < this.rank[rootB]) [rootA, rootB] = [rootB, rootA]
    this.parent[rootB] = rootA
    if (this.rank[rootA] === this.rank[rootB]) this.rank[rootA] += 1
  }
}

export function topologyStats(indicesInput, positionsInput) {
  const indices = toUint32(indicesInput)
  const positions = positionsInput instanceof Float32Array
    ? positionsInput
    : Float32Array.from(positionsInput)
  const vertexCount = Math.floor(positions.length / 3)
  const union = new UnionFind(vertexCount)
  const referenced = new Set()
  const edges = new Map()
  let degenerateTriangles = 0
  let zeroAreaTriangles = 0

  for (let index = 0; index + 2 < indices.length; index += 3) {
    const a = indices[index]
    const b = indices[index + 1]
    const c = indices[index + 2]
    if (a >= vertexCount || b >= vertexCount || c >= vertexCount) {
      throw new Error(`Index out of range in topology audit: ${Math.max(a, b, c)} >= ${vertexCount}`)
    }
    referenced.add(a)
    referenced.add(b)
    referenced.add(c)
    union.union(a, b)
    union.union(b, c)
    if (a === b || b === c || c === a) degenerateTriangles += 1
    if (triangleAreaSquared(positions, a, b, c) <= 1e-20) zeroAreaTriangles += 1
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = edgeKey(u, v)
      edges.set(key, (edges.get(key) || 0) + 1)
    }
  }

  const boundaryEdges = []
  let nonManifoldEdges = 0
  for (const [key, count] of edges.entries()) {
    if (count === 1) boundaryEdges.push(key)
    else if (count > 2) nonManifoldEdges += 1
  }
  boundaryEdges.sort()
  const componentRoots = new Set([...referenced].map((vertex) => union.find(vertex)))
  return {
    triangles: Math.floor(indices.length / 3),
    referencedVertices: referenced.size,
    uniqueEdges: edges.size,
    connectedComponents: componentRoots.size,
    eulerCharacteristic: referenced.size - edges.size + Math.floor(indices.length / 3),
    boundaryEdges: boundaryEdges.length,
    boundaryHash: sha256Record(boundaryEdges),
    nonManifoldEdges,
    degenerateTriangles,
    zeroAreaTriangles,
  }
}

function explicitBoundaryLocks(indicesInput, vertexCount) {
  const indices = toUint32(indicesInput)
  const edges = new Map()
  for (let index = 0; index + 2 < indices.length; index += 3) {
    const a = indices[index]
    const b = indices[index + 1]
    const c = indices[index + 2]
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = edgeKey(u, v)
      const entry = edges.get(key) || { count: 0, u, v }
      entry.count += 1
      edges.set(key, entry)
    }
  }
  const locks = new Uint8Array(vertexCount)
  for (const edge of edges.values()) {
    if (edge.count !== 1) continue
    locks[edge.u] = 1
    locks[edge.v] = 1
  }
  let count = 0
  for (const lock of locks) count += lock
  return { locks, count }
}

function vertexTuple(primitive, vertex) {
  return primitive.listSemantics().sort().map((semantic) => {
    const accessor = primitive.getAttribute(semantic)
    const array = accessor.getArray()
    const size = accessor.getElementSize()
    return {
      semantic,
      componentType: accessor.getComponentType(),
      normalized: accessor.getNormalized(),
      type: accessor.getType(),
      value: Array.from(array.slice(vertex * size, vertex * size + size)),
    }
  })
}

function vertexTupleHash(primitive, vertex) {
  return sha256Record(vertexTuple(primitive, vertex))
}

function boundaryGeometrySignature(primitive) {
  const indexArray = primitive.getIndices()?.getArray()
  if (!indexArray) throw new Error('Target primitive must remain indexed')
  const edges = new Map()
  for (let index = 0; index + 2 < indexArray.length; index += 3) {
    const a = indexArray[index]
    const b = indexArray[index + 1]
    const c = indexArray[index + 2]
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = edgeKey(u, v)
      const entry = edges.get(key) || { count: 0, u, v }
      entry.count += 1
      edges.set(key, entry)
    }
  }
  const boundary = [...edges.values()]
    .filter((entry) => entry.count === 1)
    .map((entry) => [vertexTupleHash(primitive, entry.u), vertexTupleHash(primitive, entry.v)].sort().join(':'))
    .sort()
  return { count: boundary.length, hash: sha256Record(boundary) }
}

function attributeContract(primitive) {
  return primitive.listSemantics().sort().map((semantic) => {
    const accessor = primitive.getAttribute(semantic)
    return {
      semantic,
      type: accessor.getType(),
      componentType: accessor.getComponentType(),
      normalized: accessor.getNormalized(),
    }
  })
}

function extensionNames(property) {
  return property.listExtensions().map((extension) => extension.extensionName).sort()
}

function textureRecord(texture, info) {
  if (!texture) return null
  const image = texture.getImage()
  return {
    name: texture.getName(),
    mimeType: texture.getMimeType(),
    uri: texture.getURI(),
    extras: cloneExtras(texture.getExtras()),
    imageBytes: image?.byteLength || 0,
    imageSha256: image ? sha256Bytes(image) : null,
    texCoord: info?.getTexCoord() ?? 0,
    magFilter: info?.getMagFilter() ?? null,
    minFilter: info?.getMinFilter() ?? null,
    wrapS: info?.getWrapS() ?? null,
    wrapT: info?.getWrapT() ?? null,
    extensions: info ? extensionNames(info) : [],
  }
}

function materialRecord(material) {
  if (!material) return null
  const textures = Object.fromEntries(TEXTURE_SLOTS.map(([slot, textureGetter, infoGetter]) => {
    return [slot, textureRecord(material[textureGetter](), material[infoGetter]())]
  }))
  return {
    name: material.getName(),
    extras: cloneExtras(material.getExtras()),
    extensions: extensionNames(material),
    doubleSided: material.getDoubleSided(),
    alphaMode: material.getAlphaMode(),
    alphaCutoff: material.getAlphaCutoff(),
    baseColorFactor: material.getBaseColorFactor(),
    emissiveFactor: material.getEmissiveFactor(),
    normalScale: material.getNormalScale(),
    occlusionStrength: material.getOcclusionStrength(),
    roughnessFactor: material.getRoughnessFactor(),
    metallicFactor: material.getMetallicFactor(),
    textures,
  }
}

function primitiveMaterialHash(primitive) {
  return sha256Record(materialRecord(primitive.getMaterial()))
}

function nodePath(node) {
  const names = []
  let current = node
  while (current) {
    names.push(current.getName() || '(unnamed)')
    current = current.getParentNode()
  }
  return names.reverse().join('/')
}

function ancestorNamed(node, name) {
  let current = node
  while (current) {
    if (current.getName() === name) return current
    current = current.getParentNode()
  }
  return null
}

function nodeWorldScaleRange(nodes) {
  const values = []
  for (const node of nodes) {
    const matrix = node.getWorldMatrix()
    values.push(
      Math.hypot(matrix[0], matrix[1], matrix[2]),
      Math.hypot(matrix[4], matrix[5], matrix[6]),
      Math.hypot(matrix[8], matrix[9], matrix[10]),
    )
  }
  return { min: Math.min(...values), max: Math.max(...values) }
}

function findUniqueMesh(document) {
  const matches = document.getRoot().listMeshes().filter((mesh) => mesh.getName() === TARGET_MESH)
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one mesh named ${TARGET_MESH}; found ${matches.length}`)
  }
  return matches[0]
}

function sourceAudit(document, inputSha256, inputBytes) {
  const mesh = findUniqueMesh(document)
  const primitives = mesh.listPrimitives()
  assert.equal(primitives.length, EXPECTED_PRIMITIVES, 'target primitive count changed')
  const users = document.getRoot().listNodes().filter((node) => node.getMesh() === mesh)
  assert.equal(users.length, EXPECTED_USERS, 'target shared-mesh user count changed')
  for (const node of users) {
    assert.match(node.getName(), TARGET_NODE_PATTERN, `unexpected user of ${TARGET_MESH}`)
    assert.ok(ancestorNamed(node, TARGET_OWNER), `${node.getName()} is outside ${TARGET_OWNER}`)
  }

  const primitiveRecords = primitives.map((primitive, index) => {
    assert.equal(primitive.getMode(), 4, `primitive ${index} is not TRIANGLES`)
    const semantics = primitive.listSemantics().sort()
    for (const semantic of REQUIRED_BASE_SEMANTICS) {
      assert.ok(semantics.includes(semantic), `primitive ${index} lacks ${semantic}`)
    }
    const indices = primitive.getIndices()?.getArray()
    assert.ok(indices, `primitive ${index} is not indexed`)
    const positions = accessorAsFloat32(primitive.getAttribute('POSITION'))
    return {
      index,
      triangles: triangleCount(primitive),
      vertices: primitive.getAttribute('POSITION').getCount(),
      semantics,
      attributeContract: attributeContract(primitive),
      material: materialRecord(primitive.getMaterial()),
      materialHash: primitiveMaterialHash(primitive),
      topology: topologyStats(indices, positions),
      boundaryGeometry: boundaryGeometrySignature(primitive),
    }
  })
  const uniqueTriangles = primitiveRecords.reduce((sum, primitive) => sum + primitive.triangles, 0)
  assert.equal(uniqueTriangles, EXPECTED_UNIQUE_TRIANGLES, 'target unique triangle baseline changed')
  assert.equal(uniqueTriangles * users.length, EXPECTED_EXPANDED_TRIANGLES, 'expanded triangle baseline changed')

  const semanticSet = [...new Set(primitiveRecords.flatMap((primitive) => primitive.semantics))].sort()
  const worldScale = nodeWorldScaleRange(users)
  return {
    inputSha256,
    mesh,
    users,
    primitives,
    record: {
      inputSha256,
      inputBytes,
      mesh: TARGET_MESH,
      owner: TARGET_OWNER,
      primitiveCount: primitives.length,
      materialCount: new Set(primitives.map((primitive) => primitive.getMaterial())).size,
      uniqueTriangles,
      userCount: users.length,
      expandedTriangles: uniqueTriangles * users.length,
      expandedDraws: primitives.length * users.length,
      worldScale,
      semantics: semanticSet,
      uvAuthored: semanticSet.some((semantic) => semantic.startsWith('TEXCOORD_')),
      tangentAuthored: semanticSet.includes('TANGENT'),
      users: users.map((node) => ({
        name: node.getName(),
        path: nodePath(node),
        matrix: node.getMatrix(),
        extras: cloneExtras(node.getExtras()),
      })),
      primitives: primitiveRecords,
    },
  }
}

function simplificationPlan(source, spec) {
  return source.primitives.map((primitive, index) => {
    const position = accessorAsFloat32(primitive.getAttribute('POSITION'))
    const sourceIndices = toUint32(primitive.getIndices().getArray())
    const sourceTopology = topologyStats(sourceIndices, position)
    let outputIndices = sourceIndices
    let actualError = 0
    let approximateAbsoluteErrorSourceUnits = 0
    let weightedSemantics = []
    const safetyAudit = {
      boundaryVerticesLocked: 0,
      candidateAccepted: spec.ratio === 1,
      fallbackToExactSource: false,
    }
    if (spec.ratio < 1) {
      const attributes = weightedAttributes(primitive)
      weightedSemantics = attributes?.semantics || []
      const boundaryLocks = explicitBoundaryLocks(sourceIndices, primitive.getAttribute('POSITION').getCount())
      safetyAudit.boundaryVerticesLocked = boundaryLocks.count
      const targetIndexCount = Math.max(3, Math.floor((sourceIndices.length * spec.ratio) / 3) * 3)
      let proposedIndices
      let proposedError
      if (attributes) {
        ;[proposedIndices, proposedError] = MeshoptSimplifier.simplifyWithAttributes(
          sourceIndices,
          position,
          3,
          attributes.array,
          attributes.stride,
          attributes.weights,
          boundaryLocks.locks,
          targetIndexCount,
          spec.error,
          ['LockBorder'],
        )
      } else {
        ;[proposedIndices, proposedError] = MeshoptSimplifier.simplifyWithAttributes(
          sourceIndices,
          position,
          3,
          new Float32Array(0),
          0,
          [],
          boundaryLocks.locks,
          targetIndexCount,
          spec.error,
          ['LockBorder'],
        )
      }
      const proposedTopology = topologyStats(proposedIndices, position)
      const proposedSafe =
        sourceTopology.boundaryHash === proposedTopology.boundaryHash &&
        sourceTopology.boundaryEdges === proposedTopology.boundaryEdges &&
        sourceTopology.connectedComponents === proposedTopology.connectedComponents &&
        proposedTopology.nonManifoldEdges <= sourceTopology.nonManifoldEdges &&
        proposedTopology.eulerCharacteristic === sourceTopology.eulerCharacteristic &&
        proposedTopology.degenerateTriangles === 0 &&
        proposedTopology.zeroAreaTriangles === 0
      if (proposedSafe) {
        outputIndices = proposedIndices
        actualError = proposedError
        approximateAbsoluteErrorSourceUnits = proposedError * MeshoptSimplifier.getScale(position, 3)
        safetyAudit.candidateAccepted = true
      } else {
        safetyAudit.fallbackToExactSource = true
      }
    }
    const outputTopology = topologyStats(outputIndices, position)
    const topologyPreserved =
      sourceTopology.boundaryHash === outputTopology.boundaryHash &&
      sourceTopology.boundaryEdges === outputTopology.boundaryEdges &&
      sourceTopology.connectedComponents === outputTopology.connectedComponents &&
      outputTopology.nonManifoldEdges <= sourceTopology.nonManifoldEdges &&
      outputTopology.eulerCharacteristic === sourceTopology.eulerCharacteristic &&
      outputTopology.degenerateTriangles === 0 &&
      outputTopology.zeroAreaTriangles === 0
    const scale = MeshoptSimplifier.getScale(position, 3)
    return {
      index,
      indices: outputIndices,
      sourceTriangles: sourceTopology.triangles,
      outputTriangles: outputTopology.triangles,
      actualRatio: outputTopology.triangles / sourceTopology.triangles,
      configuredRatio: spec.ratio,
      configuredError: spec.error,
      actualError,
      scale,
      approximateAbsoluteErrorSourceUnits,
      weightedSemantics,
      safetyAudit,
      sourceTopology,
      outputTopology,
      topologyPreserved,
    }
  })
}

function createTargetExtensions(target, source) {
  for (const extension of source.getRoot().listExtensionsUsed()) {
    const copy = target.createExtension(extension.constructor)
    if (extension.isRequired()) copy.setRequired(true)
  }
}

async function writeCandidate(io, sourceDocument, source, spec, primitivePlans, outputPath) {
  const target = new Document().setLogger(sourceDocument.getLogger())
  createTargetExtensions(target, sourceDocument)
  const resolver = createDefaultPropertyResolver(target, sourceDocument)
  const propertyMap = copyToDocument(target, sourceDocument, [source.users[0]], resolver)
  const targetNode = propertyMap.get(source.users[0])
  const targetMesh = propertyMap.get(source.mesh)
  if (!targetNode || !targetMesh) throw new Error(`${spec.id}: failed to copy target node/mesh`)
  const scene = target.createScene(`DISABLED:${spec.id}`)
  scene.addChild(targetNode)
  const targetPrimitives = targetMesh.listPrimitives()
  assert.equal(targetPrimitives.length, primitivePlans.length)
  for (let index = 0; index < targetPrimitives.length; index += 1) {
    targetPrimitives[index].getIndices().setArray(new Uint32Array(primitivePlans[index].indices))
    compactPrimitive(targetPrimitives[index])
  }
  await target.transform(prune({ keepAttributes: true, keepIndices: true, keepExtras: true }))
  await io.write(outputPath, target)
}

function accessorByteCount(mesh) {
  const seen = new Set()
  let bytes = 0
  for (const primitive of mesh.listPrimitives()) {
    const accessors = [primitive.getIndices(), ...primitive.listAttributes(), ...primitive.listTargets().flatMap((target) => target.listAttributes())]
    for (const accessor of accessors) {
      if (!accessor || seen.has(accessor)) continue
      seen.add(accessor)
      bytes += accessor.getArray()?.byteLength || 0
    }
  }
  return bytes
}

function candidateAttributeAudit(sourcePrimitive, candidatePrimitive) {
  const sourceContract = attributeContract(sourcePrimitive)
  const candidateContract = attributeContract(candidatePrimitive)
  const sourceTuples = new Set()
  const sourceCount = sourcePrimitive.getAttribute('POSITION').getCount()
  for (let vertex = 0; vertex < sourceCount; vertex += 1) {
    sourceTuples.add(vertexTupleHash(sourcePrimitive, vertex))
  }
  let foreignTuples = 0
  const candidateCount = candidatePrimitive.getAttribute('POSITION').getCount()
  for (let vertex = 0; vertex < candidateCount; vertex += 1) {
    if (!sourceTuples.has(vertexTupleHash(candidatePrimitive, vertex))) foreignTuples += 1
  }
  return {
    sourceContract,
    candidateContract,
    contractPreserved: stableStringify(sourceContract) === stableStringify(candidateContract),
    candidateVertices: candidateCount,
    foreignVertexAttributeTuples: foreignTuples,
    retainedTuplesExact: foreignTuples === 0,
  }
}

async function auditCandidate(io, path, source, spec, primitivePlans) {
  const document = await io.read(path)
  const mesh = findUniqueMesh(document)
  const primitives = mesh.listPrimitives()
  assert.equal(primitives.length, EXPECTED_PRIMITIVES, `${spec.id}: primitive count changed`)
  const primitiveAudits = primitives.map((primitive, index) => {
    const sourcePrimitive = source.primitives[index]
    const indexArray = primitive.getIndices()?.getArray()
    const position = accessorAsFloat32(primitive.getAttribute('POSITION'))
    const topology = topologyStats(indexArray, position)
    const boundaryGeometry = boundaryGeometrySignature(primitive)
    const attributeAudit = candidateAttributeAudit(sourcePrimitive, primitive)
    const materialHash = primitiveMaterialHash(primitive)
    return {
      index,
      triangles: triangleCount(primitive),
      vertices: primitive.getAttribute('POSITION').getCount(),
      semantics: primitive.listSemantics().sort(),
      attributeAudit,
      material: materialRecord(primitive.getMaterial()),
      materialHash,
      materialPreserved: materialHash === source.record.primitives[index].materialHash,
      topology,
      boundaryGeometry,
      boundaryGeometryPreserved:
        boundaryGeometry.hash === source.record.primitives[index].boundaryGeometry.hash &&
        boundaryGeometry.count === source.record.primitives[index].boundaryGeometry.count,
      plannedTriangleCountPreserved: triangleCount(primitive) === primitivePlans[index].outputTriangles,
    }
  })
  const file = await stat(path)
  const triangles = primitiveAudits.reduce((sum, primitive) => sum + primitive.triangles, 0)
  const automationPassed = primitiveAudits.every((primitive, index) => {
    return primitive.materialPreserved &&
      primitive.attributeAudit.contractPreserved &&
      primitive.attributeAudit.retainedTuplesExact &&
      primitive.boundaryGeometryPreserved &&
      primitive.plannedTriangleCountPreserved &&
      primitive.topology.degenerateTriangles === 0 &&
      primitive.topology.zeroAreaTriangles === 0 &&
      primitivePlans[index].topologyPreserved
  })
  return {
    id: spec.id,
    role: spec.role,
    file: spec.file,
    sha256: await sha256File(path),
    bytes: file.size,
    geometryAccessorBytes: accessorByteCount(mesh),
    configuredRatio: spec.ratio,
    configuredError: spec.error,
    triangles,
    actualRatio: triangles / source.record.uniqueTriangles,
    expandedTrianglesAt78Users: triangles * source.record.userCount,
    expandedTrianglesSaved: source.record.expandedTriangles - triangles * source.record.userCount,
    expandedDrawsAt78Users: primitives.length * source.record.userCount,
    maxActualError: Math.max(...primitivePlans.map((primitive) => primitive.actualError)),
    maxApproximateAbsoluteErrorSourceUnits: Math.max(...primitivePlans.map((primitive) => primitive.approximateAbsoluteErrorSourceUnits)),
    maxApproximateWorldError: Math.max(...primitivePlans.map((primitive) => primitive.approximateAbsoluteErrorSourceUnits)) * source.record.worldScale.max,
    primitivePlans: primitivePlans.map(({ indices: _indices, ...record }) => record),
    primitives: primitiveAudits,
    materialOrder: primitives.map((primitive) => primitive.getMaterial()?.getName() || null),
    semantics: [...new Set(primitives.flatMap((primitive) => primitive.listSemantics()))].sort(),
    uvAbsencePreserved: !primitives.some((primitive) => primitive.listSemantics().some((semantic) => semantic.startsWith('TEXCOORD_'))),
    tangentAbsencePreserved: !primitives.some((primitive) => primitive.listSemantics().includes('TANGENT')),
    automationPassed,
    selectableAfterVisualApproval: spec.selectableAfterVisualApproval,
  }
}

function disabledManifest(source, candidates) {
  const byRole = Object.fromEntries(candidates.filter((candidate) => candidate.role !== 'diagnostic-only').map((candidate) => [candidate.role, candidate]))
  return {
    schema: 'iom-selective-repeat-lod-pilot-v1',
    enabled: false,
    runtimeIntegrated: false,
    blocker: 'Opposing-angle browser/DCC visual approval has not been run; automatic topology and semantic checks cannot prove silhouette and shading quality.',
    source: {
      url: null,
      sha256: source.record.inputSha256,
      mesh: TARGET_MESH,
      owner: TARGET_OWNER,
      userCount: source.record.userCount,
      uniqueTriangles: source.record.uniqueTriangles,
      expandedTriangles: source.record.expandedTriangles,
    },
    selectionRecommendation: {
      near: { file: byRole.near.file, sha256: byRole.near.sha256, projectedHeightPx: '>= 180' },
      mid: { file: byRole.mid.file, sha256: byRole.mid.sha256, projectedHeightPx: '80..179' },
      far: { file: byRole.far.file, sha256: byRole.far.sha256, projectedHeightPx: '24..79' },
      below24Px: 'Prefer cluster impostor/HLOD or cull only after a separate visual pilot.',
      hysteresis: 'Use at least 15% screen-space hysteresis after runtime integration.',
    },
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      role: candidate.role,
      file: candidate.file,
      sha256: candidate.sha256,
      bytes: candidate.bytes,
      triangles: candidate.triangles,
      actualRatio: candidate.actualRatio,
      maxActualError: candidate.maxActualError,
      maxApproximateWorldError: candidate.maxApproximateWorldError,
      automationPassed: candidate.automationPassed,
      selectableAfterVisualApproval: candidate.selectableAfterVisualApproval,
    })),
  }
}

function markdownReport(report) {
  const rows = report.candidates.map((candidate) => {
    const ratio = `${(candidate.actualRatio * 100).toFixed(1)}%`
    const saved = candidate.expandedTrianglesSaved.toLocaleString('en-US')
    return `| ${candidate.role} | ${candidate.file} | ${candidate.triangles.toLocaleString('en-US')} | ${ratio} | ${candidate.maxActualError.toFixed(7)} | ${(candidate.maxApproximateWorldError * 1000).toFixed(1)} mm | ${candidate.bytes.toLocaleString('en-US')} | ${saved} | ${candidate.automationPassed ? 'pass' : 'FAIL'} |`
  }).join('\n')
  return `# Ground Floor selective repeat-LOD pilot\n\n` +
    `Status: **disabled; asset automation passed, visual approval required**.\n\n` +
    `This pilot targets the one shared \`${TARGET_MESH}\` used by ${report.source.userCount} ` +
    `\`Stuhl_Tisch_Rechts_Reihe_*\` nodes under \`${TARGET_OWNER}\`. It does not change runtime or production assets.\n\n` +
    `## Source facts\n\n` +
    `- ${report.source.uniqueTriangles.toLocaleString('en-US')} unique triangles; ${report.source.expandedTriangles.toLocaleString('en-US')} submitted triangles across ${report.source.userCount} copies.\n` +
    `- Four ordered material primitives, currently ${report.source.expandedDraws} expanded draws. LOD alone does not reduce those draws.\n` +
    `- Authored vertex semantics are \`${report.source.semantics.join(', ')}\`. There are no UV or tangent streams in the source; every candidate preserves that exact absence.\n` +
    `- Meshoptimizer uses attribute-aware simplification for normals, \`LockBorder\`, and explicit locks on every authored boundary vertex. Candidate vertices retain exact source attribute tuples.\n\n` +
    `## Measured candidates\n\n` +
    `| Role | File | Unique tris | Actual ratio | Meshopt error | Approx. world error* | GLB bytes | Expanded tris saved | Audit |\n` +
    `| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n${rows}\n\n` +
    `\* World-error estimates apply the largest authored node scale (${report.source.worldScale.max.toFixed(9)}) and assume the viewer's world unit is one metre; visual screenshots remain authoritative.\n\n` +
    `The aggressive probe is measurement evidence only. It is not part of the proposed selector.\n\n` +
    `## Provisional selector (still disabled)\n\n` +
    `- Near: exact source mesh at projected object height >=180 px.\n` +
    `- Mid: conservative 0.72 target at 80-179 px.\n` +
    `- Far: conservative 0.48 target at 24-79 px.\n` +
    `- Add at least 15% screen-space hysteresis. Below 24 px, test a cluster HLOD/impostor separately.\n\n` +
    `## What the automated audit proves\n\n` +
    `- The source identity, 78-user Ground Floor ownership, four primitive order, and triangle baseline match exactly.\n` +
    `- Material records/hashes, semantic contracts, and retained POSITION/NORMAL tuples survive round-trip writing.\n` +
    `- Every primitive keeps its exact authored boundary-edge signature and connected-component count; no new degenerate, zero-area, or non-manifold regression is accepted. This is the no-new-topology-hole gate.\n` +
    `- Actual triangle ratios, meshoptimizer-reported errors, expanded savings, SHA-256 values, accessor bytes, and GLB bytes are measured from the written files.\n\n` +
    `## Required visual approval before enablement\n\n` +
    `1. Compare source/mid/far from front, rear, both sides, above, below, and grazing angles with flat lighting plus the production environment.\n` +
    `2. Include close shots of chair legs, seat/back silhouettes, tabletop edges, and all four material boundaries.\n` +
    `3. Capture at the proposed 180 px and 80 px switch thresholds; require no holes/popping and no missing connected silhouette larger than 2 px at the switch.\n` +
    `4. Validate normal shading with a moving hard light. The source has no tangents/UVs, so texture/tangent regression is not applicable to this mesh, but normal discontinuities remain visually sensitive.\n` +
    `5. Only after approval, integrate a selector and stress rapid threshold reversals. Keep the old representation until the replacement has rendered one frame.\n\n` +
    `## Separate next optimization\n\n` +
    `The 78 nodes already share geometry, but still submit four primitives each (${report.source.expandedDraws} draws). A later, independent \`EXT_mesh_gpu_instancing\` pilot could reduce this family toward four draws if node transforms/materials and picking semantics permit it. That is outside this artifact and must not be conflated with visual LOD approval.\n`
}

export function runSelfTests() {
  assert.equal(stableStringify({ b: 2, a: 1 }), '{"a":1,"b":2}')
  const positions = new Float32Array([
    0, 0, 0,
    1, 0, 0,
    1, 1, 0,
    0, 1, 0,
    3, 0, 0,
    4, 0, 0,
    3, 1, 0,
  ])
  const square = topologyStats(new Uint16Array([0, 1, 2, 0, 2, 3]), positions)
  assert.equal(square.triangles, 2)
  assert.equal(square.connectedComponents, 1)
  assert.equal(square.boundaryEdges, 4)
  assert.equal(square.eulerCharacteristic, 1)
  assert.equal(square.nonManifoldEdges, 0)
  assert.equal(square.zeroAreaTriangles, 0)
  const squareLocks = explicitBoundaryLocks(new Uint16Array([0, 1, 2, 0, 2, 3]), 4)
  assert.equal(squareLocks.count, 4)
  assert.deepEqual(Array.from(squareLocks.locks), [1, 1, 1, 1])
  const disconnected = topologyStats(new Uint16Array([0, 1, 2, 4, 5, 6]), positions)
  assert.equal(disconnected.connectedComponents, 2)
  assert.equal(disconnected.boundaryEdges, 6)
  const holeRegression = topologyStats(new Uint16Array([0, 1, 2]), positions)
  assert.notEqual(square.boundaryHash, holeRegression.boundaryHash)
  const degenerate = topologyStats(new Uint16Array([0, 0, 1]), positions)
  assert.equal(degenerate.degenerateTriangles, 1)
  assert.equal(degenerate.zeroAreaTriangles, 1)
  assert.deepEqual(CANDIDATE_SPECS.map((candidate) => candidate.role), ['near', 'mid', 'far', 'diagnostic-only'])
  assert.ok(CANDIDATE_SPECS.every((candidate) => candidate.ratio > 0 && candidate.ratio <= 1))
  return true
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.selfTest) {
    runSelfTests()
    console.log('Ground Floor selective repeat-LOD self-tests passed.')
    return
  }

  await mkdir(args.out, { recursive: true })
  await MeshoptSimplifier.ready
  const io = await createGltfIO({ encoder: true })
  console.log(`Reading source: ${args.input}`)
  const inputSha256 = await sha256File(args.input)
  const inputBytes = (await stat(args.input)).size
  const sourceDocument = await io.read(args.input)
  const source = sourceAudit(sourceDocument, inputSha256, inputBytes)
  console.log(`Target verified: ${source.record.uniqueTriangles.toLocaleString('en-US')} tris x ${source.record.userCount} users`)

  const candidates = []
  for (const spec of CANDIDATE_SPECS) {
    const primitivePlans = simplificationPlan(source, spec)
    const outputPath = resolve(args.out, spec.file)
    await writeCandidate(io, sourceDocument, source, spec, primitivePlans, outputPath)
    const audit = await auditCandidate(io, outputPath, source, spec, primitivePlans)
    candidates.push(audit)
    console.log(
      `${spec.id}: ${audit.triangles.toLocaleString('en-US')} tris ` +
      `(${(audit.actualRatio * 100).toFixed(1)}%), error ${audit.maxActualError.toFixed(7)}, ` +
      `${audit.bytes.toLocaleString('en-US')} bytes, audit=${audit.automationPassed ? 'pass' : 'FAIL'}`,
    )
  }

  const failed = candidates.filter((candidate) => !candidate.automationPassed)
  const report = {
    schema: 'iom-selective-repeat-lod-audit-v1',
    status: failed.length ? 'failed' : 'disabled-pending-visual-approval',
    enabled: false,
    runtimeIntegrated: false,
    browserQaRun: false,
    source: source.record,
    candidates,
    gates: {
      sourceIdentity: true,
      exactOwnership: true,
      materialPreservation: candidates.every((candidate) => candidate.primitives.every((primitive) => primitive.materialPreserved)),
      attributeSemanticPreservation: candidates.every((candidate) => candidate.primitives.every((primitive) => primitive.attributeAudit.contractPreserved)),
      exactRetainedAttributeTuples: candidates.every((candidate) => candidate.primitives.every((primitive) => primitive.attributeAudit.retainedTuplesExact)),
      noNewTopologyHoles: candidates.every((candidate) => candidate.primitivePlans.every((primitive) => primitive.topologyPreserved)),
      roundTripBoundaryPreservation: candidates.every((candidate) => candidate.primitives.every((primitive) => primitive.boundaryGeometryPreserved)),
      writtenCandidateAudits: failed.length === 0,
      visualSafety: false,
    },
    blocker: 'Visual safety cannot be established automatically. Browser/DCC opposing-angle and transition approval is required before runtime integration.',
    recommendation: {
      near: 'near-source',
      mid: 'mid-conservative',
      far: 'far-conservative',
      rejectFromSelector: ['aggressive-probe'],
      thresholdsAreProvisional: true,
      note: 'LOD reduces submitted triangles but leaves 312 expanded primitive draws; evaluate GPU instancing as a separate later pilot.',
    },
  }
  const manifest = disabledManifest(source, candidates)
  await writeFile(resolve(args.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(resolve(args.out, 'pilot-manifest.disabled.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(resolve(args.out, 'README.md'), markdownReport(report))

  if (failed.length) {
    throw new Error(`Candidate automation failed: ${failed.map((candidate) => candidate.id).join(', ')}`)
  }
  console.log(`Report: ${resolve(args.out, 'report.json')}`)
  console.log('Pilot remains disabled pending visual approval; no runtime or production files were changed.')
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((error) => {
    console.error(error?.stack || error)
    process.exitCode = 1
  })
}

// Reused by the combined, disabled repeat-geometry release candidate. Keeping
// the simplifier and its topology audit in one implementation prevents the
// Web/Quest release evidence from drifting away from this focused pilot.
export {
  accessorAsFloat32,
  attributeContract,
  boundaryGeometrySignature,
  candidateAttributeAudit,
  primitiveMaterialHash,
  simplificationPlan,
  triangleCount,
}
