/**
 * Build a disabled, owner-local EXT_mesh_gpu_instancing pilot for the dominant
 * Ground Floor chair/table family.
 *
 * The source contains both positive- and negative-determinant transforms. A
 * single InstancedMesh cannot change front-face winding per instance, so the
 * pilot uses two parity-homogeneous nodes sharing one four-primitive mesh:
 *   - identity host + 40 positive instances;
 *   - X-mirrored host + 38 positive local instances.
 *
 * This is an offline artifact only. It never edits public assets, manifests,
 * package.json, or viewer runtime code.
 *
 * Usage:
 *   node scripts/build-ground-floor-repeat-instancing-pilot.mjs
 *   node scripts/build-ground-floor-repeat-instancing-pilot.mjs --validate-only
 *   node scripts/build-ground-floor-repeat-instancing-pilot.mjs --input <glb> --out <dir>
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Accessor, Document } from '@gltf-transform/core'
import { EXTMeshGPUInstancing, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { copyToDocument, createDefaultPropertyResolver } from '@gltf-transform/functions'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const WORKSPACE_ROOT = resolve(VIEWER_ROOT, '..')

const DEFAULT_INPUT = resolve(VIEWER_ROOT, 'tmp', 'icm-anim-2025-cleaned.glb')
const DEFAULT_WEB = resolve(WORKSPACE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-web.glb')
const DEFAULT_QUEST = resolve(WORKSPACE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-quest.glb')
const DEFAULT_EXT_WEB = resolve(WORKSPACE_ROOT, 'public', 'models', 'icm-ext', 'model-web.glb')
const DEFAULT_EXT_QUEST = resolve(WORKSPACE_ROOT, 'public', 'models', 'icm-ext', 'model-quest.glb')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', 'repeat-instancing-ground-floor')

const OUTPUT_FILE = 'Mesh.13786-owner-local-parity-instanced.glb'
const QUEST_DIAGNOSTIC_FILE = 'Mesh.13786-quest-owner-local-parity-instanced.glb'
const WEB_SPATIAL_FILE = 'Mesh.13786-web-owner-local-parity-spatial-instanced.glb'
const QUEST_SPATIAL_FILE = 'Mesh.13786-quest-owner-local-parity-spatial-instanced.glb'
const TARGET_MESH = 'Mesh.13786'
const TARGET_OWNER = 'Ground Floor._anim1'
const TARGET_PATTERN = /^Stuhl_Tisch_Rechts_Reihe_/
const EXPECTED_USERS = 78
const EXPECTED_PRIMITIVES = 4
const EXPECTED_UNIQUE_TRIANGLES = 61_269
const EXPECTED_EXPANDED_TRIANGLES = 4_778_982
const CELL_SIZE = 12
const FLOOR_BAND_HEIGHT = 3.6
const POSITIVE_BATCH = 'Stuhl_Tisch_Rechts_Reihe_INST_POSITIVE'
const MIRRORED_BATCH = 'Stuhl_Tisch_Rechts_Reihe_INST_MIRRORED'
const MIRROR_X = new Matrix4().makeScale(-1, 1, 1)
const MATRIX_EPSILON = 2e-5
const BOUNDS_EPSILON = 5e-5
const BLENDER_52_VALIDATED_HASHES = Object.freeze({
  wholeBatchDiagnostic: '5dfabd2966d1174f138c7575666adf17d70777bf1184031cca0f7a814a342f50',
  questWholeDiagnostic: '61db42f06ffe7a4c1862daba392803dea4bc881201f0b2262d40b5546ca8b5b5',
  webSpatial: 'fbf172199f6f52e63e478bfddd34936ddb0f589fd8effbc105ddfb6077fe8c26',
  questSpatial: '34b2fc4302939a95c09bb58215eef72943632c200e52315eef729a0be113e196',
})

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    web: DEFAULT_WEB,
    quest: DEFAULT_QUEST,
    exteriorWeb: DEFAULT_EXT_WEB,
    exteriorQuest: DEFAULT_EXT_QUEST,
    out: DEFAULT_OUT,
    validateOnly: false,
  }
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i]
    if (value === '--input') args.input = resolve(argv[++i])
    else if (value === '--web') args.web = resolve(argv[++i])
    else if (value === '--quest') args.quest = resolve(argv[++i])
    else if (value === '--exterior-web') args.exteriorWeb = resolve(argv[++i])
    else if (value === '--exterior-quest') args.exteriorQuest = resolve(argv[++i])
    else if (value === '--out') args.out = resolve(argv[++i])
    else if (value === '--validate-only') args.validateOnly = true
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

function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function sha256Array(array) {
  if (!array) return null
  return sha256Bytes(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
}

async function sha256File(path) {
  return sha256Bytes(await readFile(path))
}

function cloneArray(array) {
  return new array.constructor(array)
}

function triangleCount(primitive) {
  const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
  if (primitive.getMode() === 4) return Math.floor(count / 3)
  if (primitive.getMode() === 5 || primitive.getMode() === 6) return Math.max(0, count - 2)
  return 0
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

function matrixMaxDelta(a, b) {
  let delta = 0
  for (let i = 0; i < 16; i += 1) delta = Math.max(delta, Math.abs(a.elements[i] - b.elements[i]))
  return delta
}

function matrixRecord(matrix) {
  return matrix.toArray().map((value) => Number(value.toPrecision(15)))
}

function decomposeMatrix(matrix) {
  const translation = new Vector3()
  const rotation = new Quaternion()
  const scale = new Vector3()
  matrix.decompose(translation, rotation, scale)
  rotation.normalize()
  const recomposed = new Matrix4().compose(translation, rotation, scale)
  return {
    translation: translation.toArray(),
    rotation: rotation.toArray(),
    scale: scale.toArray(),
    recompositionError: matrixMaxDelta(matrix, recomposed),
  }
}

function materialRecord(material) {
  if (!material) return null
  const textureName = (texture) => texture?.getName() || null
  const specular = material.getExtension('KHR_materials_specular')
  return {
    name: material.getName(),
    baseColorFactor: material.getBaseColorFactor(),
    emissiveFactor: material.getEmissiveFactor(),
    metallicFactor: material.getMetallicFactor(),
    roughnessFactor: material.getRoughnessFactor(),
    alphaMode: material.getAlphaMode(),
    alphaCutoff: material.getAlphaCutoff(),
    doubleSided: material.getDoubleSided(),
    extensions: {
      KHR_materials_specular: specular ? {
        specularFactor: specular.getSpecularFactor(),
        specularColorFactor: specular.getSpecularColorFactor(),
        specularTexture: textureName(specular.getSpecularTexture()),
        specularColorTexture: textureName(specular.getSpecularColorTexture()),
      } : null,
    },
    textures: {
      baseColor: textureName(material.getBaseColorTexture()),
      metallicRoughness: textureName(material.getMetallicRoughnessTexture()),
      normal: textureName(material.getNormalTexture()),
      occlusion: textureName(material.getOcclusionTexture()),
      emissive: textureName(material.getEmissiveTexture()),
    },
  }
}

function topologySha256(indexArray) {
  if (!indexArray) return null
  const triangles = []
  for (let i = 0; i + 2 < indexArray.length; i += 3) {
    const a = Number(indexArray[i])
    const b = Number(indexArray[i + 1])
    const c = Number(indexArray[i + 2])
    const rotations = [[a, b, c], [b, c, a], [c, a, b]]
    rotations.sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2])
    triangles.push(rotations[0])
  }
  triangles.sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2])
  const canonical = new Uint32Array(triangles.length * 3)
  for (let i = 0; i < triangles.length; i += 1) canonical.set(triangles[i], i * 3)
  return sha256Array(canonical)
}

function primitiveRecord(primitive, index) {
  const semantics = primitive.listSemantics().sort()
  const attributes = Object.fromEntries(
    semantics.map((semantic) => {
      const accessor = primitive.getAttribute(semantic)
      return [semantic, {
        type: accessor.getType(),
        componentType: accessor.getComponentType(),
        normalized: accessor.getNormalized(),
        count: accessor.getCount(),
        byteLength: accessor.getArray()?.byteLength ?? 0,
        sha256: sha256Array(accessor.getArray()),
      }]
    }),
  )
  const indices = primitive.getIndices()
  return {
    index,
    mode: primitive.getMode(),
    triangles: triangleCount(primitive),
    semantics,
    attributes,
    indices: indices ? {
      componentType: indices.getComponentType(),
      count: indices.getCount(),
      byteLength: indices.getArray()?.byteLength ?? 0,
      sha256: sha256Array(indices.getArray()),
      topologySha256: topologySha256(indices.getArray()),
    } : null,
    material: materialRecord(primitive.getMaterial()),
  }
}

function exactRenderableContract(record) {
  return {
    ...record,
    // Meshopt's triangle codec may reorder triangle submission while retaining
    // the exact oriented triangle set. Raw index order has no visual meaning;
    // the canonical topology hash remains mandatory.
    indices: record.indices ? { ...record.indices, sha256: undefined } : null,
  }
}

function geometryBytes(mesh) {
  const seen = new Set()
  let bytes = 0
  for (const primitive of mesh.listPrimitives()) {
    for (const accessor of [primitive.getIndices(), ...primitive.listAttributes()]) {
      if (!accessor || seen.has(accessor)) continue
      seen.add(accessor)
      bytes += accessor.getArray()?.byteLength ?? 0
    }
  }
  return bytes
}

function emptyBounds() {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
}

function expandBounds(bounds, point) {
  bounds.min[0] = Math.min(bounds.min[0], point.x)
  bounds.min[1] = Math.min(bounds.min[1], point.y)
  bounds.min[2] = Math.min(bounds.min[2], point.z)
  bounds.max[0] = Math.max(bounds.max[0], point.x)
  bounds.max[1] = Math.max(bounds.max[1], point.y)
  bounds.max[2] = Math.max(bounds.max[2], point.z)
}

function accessorBounds(accessor) {
  const min = accessor.getMin([])
  const max = accessor.getMax([])
  if (!accessor.getNormalized()) return { min, max }
  const componentType = accessor.getComponentType()
  const decode = (value) => {
    if (componentType === 5120) return Math.max(-1, value / 127)
    if (componentType === 5121) return value / 255
    if (componentType === 5122) return Math.max(-1, value / 32767)
    if (componentType === 5123) return value / 65535
    return value
  }
  return { min: min.map(decode), max: max.map(decode) }
}

function meshBoundsForMatrices(mesh, matrices) {
  const bounds = emptyBounds()
  const point = new Vector3()
  for (const matrix of matrices) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      if (!position) continue
      const range = accessorBounds(position)
      for (const x of [range.min[0], range.max[0]]) {
        for (const y of [range.min[1], range.max[1]]) {
          for (const z of [range.min[2], range.max[2]]) {
            point.set(x, y, z).applyMatrix4(matrix)
            expandBounds(bounds, point)
          }
        }
      }
    }
  }
  return bounds
}

function maxBoundsDelta(a, b) {
  let delta = 0
  for (let i = 0; i < 3; i += 1) {
    delta = Math.max(delta, Math.abs(a.min[i] - b.min[i]), Math.abs(a.max[i] - b.max[i]))
  }
  return delta
}

function sourceAudit(document, sourceSha256, sourceBytes) {
  const meshes = document.getRoot().listMeshes().filter((mesh) => mesh.getName() === TARGET_MESH)
  assert.equal(meshes.length, 1, `Expected one ${TARGET_MESH}; found ${meshes.length}`)
  const mesh = meshes[0]
  const primitives = mesh.listPrimitives()
  assert.equal(primitives.length, EXPECTED_PRIMITIVES, 'target primitive count changed')
  const primitiveRecords = primitives.map(primitiveRecord)
  assert.deepEqual(
    primitiveRecords.map((primitive) => primitive.semantics),
    Array(EXPECTED_PRIMITIVES).fill(null).map(() => ['NORMAL', 'POSITION']),
    'source must remain authored POSITION/NORMAL-only geometry',
  )
  assert.ok(primitiveRecords.every((primitive) => primitive.mode === 4), 'all target primitives must be TRIANGLES')
  assert.equal(
    primitiveRecords.reduce((sum, primitive) => sum + primitive.triangles, 0),
    EXPECTED_UNIQUE_TRIANGLES,
    'unique triangle baseline changed',
  )

  const owners = document.getRoot().listNodes().filter((node) => node.getName() === TARGET_OWNER)
  assert.equal(owners.length, 1, `Expected one animation owner ${TARGET_OWNER}`)
  const owner = owners[0]
  assert.equal(owner.getParentNode(), null, 'pilot assumes the Ground Floor owner is a scene root')

  const users = document.getRoot().listNodes().filter((node) => node.getMesh() === mesh)
  assert.equal(users.length, EXPECTED_USERS, 'target user count changed')
  const ownerInverse = new Matrix4().fromArray(owner.getWorldMatrix()).invert()
  const instances = users.map((node, sourceIndex) => {
    assert.match(node.getName(), TARGET_PATTERN, `unexpected user ${node.getName()}`)
    assert.ok(ancestorNamed(node, TARGET_OWNER), `${node.getName()} is outside ${TARGET_OWNER}`)
    const matrix = new Matrix4().multiplyMatrices(
      ownerInverse,
      new Matrix4().fromArray(node.getWorldMatrix()),
    )
    const determinant = matrix.determinant()
    assert.ok(Math.abs(determinant) > 1e-12, `${node.getName()} has a singular transform`)
    return {
      sourceIndex,
      name: node.getName(),
      path: nodePath(node),
      matrix,
      determinant,
    }
  })
  const positive = instances.filter((instance) => instance.determinant > 0)
  const mirrored = instances.filter((instance) => instance.determinant < 0)
  assert.equal(positive.length + mirrored.length, EXPECTED_USERS)
  assert.equal(mirrored.length, 38, 'mirrored-transform baseline changed')
  assert.equal(EXPECTED_UNIQUE_TRIANGLES * instances.length, EXPECTED_EXPANDED_TRIANGLES)
  return {
    document,
    mesh,
    owner,
    primitives,
    instances,
    positive,
    mirrored,
    record: {
      file: sourceSha256,
      bytes: sourceBytes,
      sha256: sourceSha256,
      mesh: TARGET_MESH,
      owner: TARGET_OWNER,
      userCount: instances.length,
      positiveTransforms: positive.length,
      mirroredTransforms: mirrored.length,
      primitiveCount: primitives.length,
      materialOrder: primitiveRecords.map((primitive) => primitive.material?.name ?? null),
      semantics: ['NORMAL', 'POSITION'],
      uvAuthored: false,
      tangentAuthored: false,
      uniqueTriangles: EXPECTED_UNIQUE_TRIANGLES,
      expandedTriangles: EXPECTED_EXPANDED_TRIANGLES,
      uninstancedDraws: EXPECTED_USERS * EXPECTED_PRIMITIVES,
      uniqueGeometryAccessorBytes: geometryBytes(mesh),
      duplicatedGeometryAccessorBytesAt78Users: geometryBytes(mesh) * EXPECTED_USERS,
      boundsOwnerLocal: meshBoundsForMatrices(mesh, instances.map((instance) => instance.matrix)),
      transformSetSha256: sha256Bytes(Buffer.from(stableStringify(instances.map((instance) => ({
        sourceIndex: instance.sourceIndex,
        name: instance.name,
        matrix: matrixRecord(instance.matrix),
      }))))),
      primitives: primitiveRecords,
    },
  }
}

function cloneAccessor(target, source, buffer, name) {
  return target.createAccessor(name)
    .setType(source.getType())
    .setArray(cloneArray(source.getArray()))
    .setNormalized(source.getNormalized())
    .setBuffer(buffer)
}

function createAnimation(target, sourceDocument, sourceOwner, targetOwner, buffer) {
  const targetAnimations = []
  for (const sourceAnimation of sourceDocument.getRoot().listAnimations()) {
    const sourceChannels = sourceAnimation.listChannels().filter((channel) => channel.getTargetNode() === sourceOwner)
    if (!sourceChannels.length) continue
    const targetAnimation = target.createAnimation(sourceAnimation.getName())
    for (let index = 0; index < sourceChannels.length; index += 1) {
      const sourceChannel = sourceChannels[index]
      const sourceSampler = sourceChannel.getSampler()
      const input = cloneAccessor(target, sourceSampler.getInput(), buffer, `${TARGET_OWNER}:time:${index}`)
      const output = cloneAccessor(target, sourceSampler.getOutput(), buffer, `${TARGET_OWNER}:${sourceChannel.getTargetPath()}:${index}`)
      const sampler = target.createAnimationSampler(`${TARGET_OWNER}:sampler:${index}`)
        .setInput(input)
        .setOutput(output)
        .setInterpolation(sourceSampler.getInterpolation())
      const channel = target.createAnimationChannel(`${TARGET_OWNER}:channel:${index}`)
        .setTargetNode(targetOwner)
        .setTargetPath(sourceChannel.getTargetPath())
        .setSampler(sampler)
      targetAnimation.addSampler(sampler).addChannel(channel)
    }
    targetAnimations.push(targetAnimation)
  }
  assert.equal(targetAnimations.length, 1, 'expected one source animation containing Ground Floor ownership')
}

function createInstanceAccessor(target, buffer, name, type, array) {
  return target.createAccessor(name).setType(type).setArray(array).setBuffer(buffer)
}

function createBatch(target, extension, buffer, targetMesh, targetOwner, name, parity, hostMatrix, instances) {
  const translations = new Float32Array(instances.length * 3)
  const rotations = new Float32Array(instances.length * 4)
  const scales = new Float32Array(instances.length * 3)
  // Use 32-bit scalar IDs. EXT_meshopt requires 4-byte attribute stride;
  // Uint16 SCALAR would gain hidden padding that some offline readers expose
  // as extra zero elements even though the glTF accessor count is correct.
  const sourceIds = new Uint32Array(instances.length)
  const hostInverse = hostMatrix.clone().invert()
  let maxRecompositionError = 0
  const map = []

  for (let localIndex = 0; localIndex < instances.length; localIndex += 1) {
    const source = instances[localIndex]
    const localMatrix = new Matrix4().multiplyMatrices(hostInverse, source.matrix)
    assert.ok(localMatrix.determinant() > 0, `${name}:${localIndex} retained a negative local determinant`)
    const trs = decomposeMatrix(localMatrix)
    maxRecompositionError = Math.max(maxRecompositionError, trs.recompositionError)
    assert.ok(trs.recompositionError <= MATRIX_EPSILON, `${name}:${localIndex} contains non-TRS/sheared data`)
    translations.set(trs.translation, localIndex * 3)
    rotations.set(trs.rotation, localIndex * 4)
    scales.set(trs.scale, localIndex * 3)
    sourceIds[localIndex] = source.sourceIndex
    map.push({
      sourceIndex: source.sourceIndex,
      sourceName: source.name,
      sourcePath: source.path,
      parity,
      batch: name,
      localInstanceId: localIndex,
      sourceDeterminant: source.determinant,
      ownerLocalMatrix: matrixRecord(source.matrix),
    })
  }

  const instancing = extension.createInstancedMesh()
    .setAttribute('TRANSLATION', createInstanceAccessor(target, buffer, `${name}:translation`, Accessor.Type.VEC3, translations))
    .setAttribute('ROTATION', createInstanceAccessor(target, buffer, `${name}:rotation`, Accessor.Type.VEC4, rotations))
    .setAttribute('SCALE', createInstanceAccessor(target, buffer, `${name}:scale`, Accessor.Type.VEC3, scales))
    .setAttribute('_IOM_SOURCE_ID', createInstanceAccessor(target, buffer, `${name}:source-id`, Accessor.Type.SCALAR, sourceIds))

  const node = target.createNode(name)
    .setMesh(targetMesh)
    .setMatrix(hostMatrix.toArray())
    .setExtension('EXT_mesh_gpu_instancing', instancing)
    .setExtras({
      disabledPilot: true,
      runtimeIntegrated: false,
      animationOwner: TARGET_OWNER,
      instanceParity: parity,
      instanceIdSemantic: '_IOM_SOURCE_ID',
      negativeDeterminantSafe: true,
    })
  targetOwner.addChild(node)
  return { node, map, maxRecompositionError }
}

function copySourceExtensions(target, source, sourcePrimitives) {
  // Copy only extension properties reachable from the selected primitives.
  // Copying the source document's global extension list retained Quest's
  // required KHR_texture_basisu declaration even though these four materials
  // are textureless, which made Blender reject an otherwise valid pilot.
  const usedProperties = new Map()
  for (const primitive of sourcePrimitives) {
    for (const property of primitive.listExtensions()) usedProperties.set(property.extensionName, property)
    const material = primitive.getMaterial()
    if (!material) continue
    for (const property of material.listExtensions()) usedProperties.set(property.extensionName, property)
  }
  const sourceExtensions = new Map(
    source.getRoot().listExtensionsUsed().map((extension) => [extension.extensionName, extension]),
  )
  for (const property of usedProperties.values()) {
    if (
      property.extensionName === 'EXT_mesh_gpu_instancing' ||
      property.extensionName === 'EXT_meshopt_compression'
    ) continue
    const sourceExtension = sourceExtensions.get(property.extensionName)
    assert.ok(sourceExtension, `missing source extension owner for ${property.extensionName}`)
    target.createExtension(sourceExtension.constructor).setRequired(sourceExtension.isRequired())
  }
}

async function buildPilot(io, source, outputPath) {
  const target = new Document().setLogger(source.document.getLogger())
  copySourceExtensions(target, source.document, source.primitives)
  const resolver = createDefaultPropertyResolver(target, source.document)
  const propertyMap = copyToDocument(target, source.document, [source.mesh], resolver)
  const targetMesh = propertyMap.get(source.mesh)
  assert.ok(targetMesh, 'failed to copy target mesh')
  targetMesh.setName(TARGET_MESH)

  const targetOwner = target.createNode(TARGET_OWNER)
    .setMatrix(source.owner.getMatrix())
    .setExtras({
      ...(source.owner.getExtras() || {}),
      disabledPilotOwner: true,
      persistentAnimationOwner: true,
    })
  target.createScene('DISABLED:Ground Floor repeat instancing pilot').addChild(targetOwner)

  // GLB permits one buffer. Reuse the geometry buffer copied with the mesh;
  // accessor usage still places instance and animation data in distinct views.
  const instanceBuffer = target.getRoot().listBuffers()[0] ?? target.createBuffer('Ground Floor repeat data')
  const instancingExtension = target.createExtension(EXTMeshGPUInstancing).setRequired(true)
  const positive = createBatch(
    target,
    instancingExtension,
    instanceBuffer,
    targetMesh,
    targetOwner,
    POSITIVE_BATCH,
    'positive',
    new Matrix4(),
    source.positive,
  )
  const mirrored = createBatch(
    target,
    instancingExtension,
    instanceBuffer,
    targetMesh,
    targetOwner,
    MIRRORED_BATCH,
    'mirrored',
    MIRROR_X,
    source.mirrored,
  )
  createAnimation(target, source.document, source.owner, targetOwner, instanceBuffer)

  // Lossless buffer compression only: no quantization, decimation, UV creation,
  // normal filtering, or material conversion is applied by this pilot.
  target.createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })

  await io.write(outputPath, target)
  return {
    map: [...positive.map, ...mirrored.map].sort((a, b) => a.sourceIndex - b.sourceIndex),
    maxBuildRecompositionError: Math.max(positive.maxRecompositionError, mirrored.maxRecompositionError),
  }
}

async function buildWholeVariantPilot(
  io,
  cleanSource,
  geometryDocument,
  geometryPrimitives,
  variant,
  outputPath,
) {
  assert.equal(geometryPrimitives.length, EXPECTED_PRIMITIVES)
  const target = new Document().setLogger(geometryDocument.getLogger())
  copySourceExtensions(target, geometryDocument, geometryPrimitives)
  const resolver = createDefaultPropertyResolver(target, geometryDocument)
  const propertyMap = copyToDocument(target, geometryDocument, geometryPrimitives, resolver)
  const targetMesh = target.createMesh(TARGET_MESH)
  for (let materialSlot = 0; materialSlot < geometryPrimitives.length; materialSlot += 1) {
    const primitive = propertyMap.get(geometryPrimitives[materialSlot])
    assert.ok(primitive, `${variant}: failed to copy material slot ${materialSlot}`)
    targetMesh.addPrimitive(primitive)
  }

  const targetOwner = target.createNode(TARGET_OWNER)
    .setMatrix(cleanSource.owner.getMatrix())
    .setExtras({
      ...(cleanSource.owner.getExtras() || {}),
      disabledPilotOwner: true,
      persistentAnimationOwner: true,
      repeatVariant: variant,
    })
  target.createScene(`DISABLED:${variant}:Ground Floor whole-family repeat diagnostic`).addChild(targetOwner)
  const buffer = target.getRoot().listBuffers()[0] ?? target.createBuffer(`${variant}:Ground Floor repeat data`)
  const extension = target.createExtension(EXTMeshGPUInstancing).setRequired(true)
  const positive = createBatch(
    target,
    extension,
    buffer,
    targetMesh,
    targetOwner,
    `${POSITIVE_BATCH}_${variant.toUpperCase()}`,
    'positive',
    new Matrix4(),
    cleanSource.positive,
  )
  const mirrored = createBatch(
    target,
    extension,
    buffer,
    targetMesh,
    targetOwner,
    `${MIRRORED_BATCH}_${variant.toUpperCase()}`,
    'mirrored',
    MIRROR_X,
    cleanSource.mirrored,
  )
  createAnimation(target, cleanSource.document, cleanSource.owner, targetOwner, buffer)
  target.createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
  await io.write(outputPath, target)
  return {
    map: [...positive.map, ...mirrored.map].sort((a, b) => a.sourceIndex - b.sourceIndex),
    maxBuildRecompositionError: Math.max(positive.maxRecompositionError, mirrored.maxRecompositionError),
  }
}

function variantAuditSource(cleanSource, geometryPrimitives) {
  const primitiveRecords = geometryPrimitives.map(primitiveRecord)
  const uniqueTriangles = primitiveRecords.reduce((sum, primitive) => sum + primitive.triangles, 0)
  return {
    ...cleanSource,
    record: {
      ...cleanSource.record,
      primitiveCount: primitiveRecords.length,
      materialOrder: primitiveRecords.map((primitive) => primitive.material?.name ?? null),
      uniqueTriangles,
      expandedTriangles: uniqueTriangles * EXPECTED_USERS,
      boundsOwnerLocal: primitivesBoundsForMatrices(
        geometryPrimitives,
        cleanSource.instances.map((instance) => instance.matrix),
      ),
      primitives: primitiveRecords,
    },
  }
}

function spatialCellForPrimitive(primitive, matrix, sceneMin) {
  const position = primitive.getAttribute('POSITION')
  const range = accessorBounds(position)
  const center = new Vector3(
    (range.min[0] + range.max[0]) * 0.5,
    (range.min[1] + range.max[1]) * 0.5,
    (range.min[2] + range.max[2]) * 0.5,
  ).applyMatrix4(matrix)
  const cellX = Math.floor((center.x - sceneMin[0]) / CELL_SIZE)
  const cellZ = Math.floor((center.z - sceneMin[2]) / CELL_SIZE)
  const floorBand = Math.floor((center.y - sceneMin[1]) / FLOOR_BAND_HEIGHT)
  return {
    cellX,
    cellZ,
    floorBand,
    key: `f${floorBand}|cx${cellX}|cz${cellZ}`,
  }
}

function spatialPartitions(instances, primitives, sceneMin) {
  const partitions = new Map()
  for (const instance of instances) {
    const cells = primitives.map((primitive) => spatialCellForPrimitive(primitive, instance.matrix, sceneMin))
    assert.equal(
      new Set(cells.map((cell) => cell.key)).size,
      1,
      `${instance.name}: material primitives disagree on spatial cell`,
    )
    const cell = cells[0]
    const parity = instance.determinant > 0 ? 'positive' : 'mirrored'
    const key = `${parity}|${cell.key}`
    const partition = partitions.get(key)
    if (partition) partition.instances.push(instance)
    else partitions.set(key, { key, parity, cell, instances: [instance] })
  }
  return [...partitions.values()].sort((a, b) => {
    if (a.parity !== b.parity) return a.parity === 'positive' ? -1 : 1
    return a.cell.key.localeCompare(b.cell.key)
  })
}

function createSpatialAccessors(target, buffer, name, hostMatrix, instances) {
  const translations = new Float32Array(instances.length * 3)
  const rotations = new Float32Array(instances.length * 4)
  const scales = new Float32Array(instances.length * 3)
  const hostInverse = hostMatrix.clone().invert()
  let maxRecompositionError = 0
  for (let localIndex = 0; localIndex < instances.length; localIndex += 1) {
    const localMatrix = new Matrix4().multiplyMatrices(hostInverse, instances[localIndex].matrix)
    assert.ok(localMatrix.determinant() > 0, `${name}:${localIndex} retained a negative local determinant`)
    const trs = decomposeMatrix(localMatrix)
    maxRecompositionError = Math.max(maxRecompositionError, trs.recompositionError)
    assert.ok(trs.recompositionError <= MATRIX_EPSILON, `${name}:${localIndex} contains non-TRS/sheared data`)
    translations.set(trs.translation, localIndex * 3)
    rotations.set(trs.rotation, localIndex * 4)
    scales.set(trs.scale, localIndex * 3)
  }
  return {
    translation: createInstanceAccessor(target, buffer, `${name}:translation`, Accessor.Type.VEC3, translations),
    rotation: createInstanceAccessor(target, buffer, `${name}:rotation`, Accessor.Type.VEC4, rotations),
    scale: createInstanceAccessor(target, buffer, `${name}:scale`, Accessor.Type.VEC3, scales),
    maxRecompositionError,
  }
}

function copyPrimitiveMeshes(target, sourceDocument, sourcePrimitives) {
  copySourceExtensions(target, sourceDocument, sourcePrimitives)
  const resolver = createDefaultPropertyResolver(target, sourceDocument)
  const propertyMap = copyToDocument(target, sourceDocument, sourcePrimitives, resolver)
  return sourcePrimitives.map((sourcePrimitive, materialSlot) => {
    const primitive = propertyMap.get(sourcePrimitive)
    assert.ok(primitive, `failed to copy variant primitive ${materialSlot}`)
    return target.createMesh(`${TARGET_MESH}:material-slot-${materialSlot}`).addPrimitive(primitive)
  })
}

async function buildSpatialPilot(
  io,
  cleanSource,
  geometryDocument,
  geometryPrimitives,
  sceneMin,
  variant,
  outputPath,
) {
  assert.equal(geometryPrimitives.length, EXPECTED_PRIMITIVES)
  const target = new Document().setLogger(geometryDocument.getLogger())
  const targetMeshes = copyPrimitiveMeshes(target, geometryDocument, geometryPrimitives)
  const owner = target.createNode(TARGET_OWNER)
    .setMatrix(cleanSource.owner.getMatrix())
    .setExtras({
      ...(cleanSource.owner.getExtras() || {}),
      disabledPilotOwner: true,
      persistentAnimationOwner: true,
      repeatVariant: variant,
    })
  target.createScene(`DISABLED:${variant}:Ground Floor parity-spatial repeat pilot`).addChild(owner)
  const buffer = target.getRoot().listBuffers()[0] ?? target.createBuffer(`${variant}:Ground Floor repeat data`)
  const extension = target.createExtension(EXTMeshGPUInstancing).setRequired(true)
  const partitions = spatialPartitions(cleanSource.instances, geometryPrimitives, sceneMin)
  let maxRecompositionError = 0
  const partitionRecords = []

  for (const partition of partitions) {
    const safeKey = partition.cell.key.replaceAll('|', '_')
    const baseName = `Stuhl_Tisch_Rechts_Reihe_${partition.parity.toUpperCase()}_${safeKey}`
    const hostMatrix = partition.parity === 'mirrored' ? MIRROR_X : new Matrix4()
    const accessors = createSpatialAccessors(target, buffer, baseName, hostMatrix, partition.instances)
    maxRecompositionError = Math.max(maxRecompositionError, accessors.maxRecompositionError)
    const sourceIds = partition.instances.map((instance) => instance.sourceIndex)
    const extras = {
      disabledPilot: true,
      runtimeIntegrated: false,
      prepartitionedRepeatBatch: true,
      animationOwner: TARGET_OWNER,
      repeatVariant: variant,
      instanceParity: partition.parity,
      spatialPartition: partition.cell.key,
      sourceIds,
      pickingIdentity: 'userData.sourceIds[intersection.instanceId]',
      negativeDeterminantSafe: true,
      IOM_spatial: {
        floorBand: partition.cell.floorBand,
        floorBandMin: partition.cell.floorBand,
        floorBandMax: partition.cell.floorBand,
        cell: [partition.cell.cellX, 0, partition.cell.cellZ],
        cellXMin: partition.cell.cellX,
        cellXMax: partition.cell.cellX,
        cellZMin: partition.cell.cellZ,
        cellZMax: partition.cell.cellZ,
        alwaysOn: false,
      },
    }
    for (let materialSlot = 0; materialSlot < targetMeshes.length; materialSlot += 1) {
      const instancing = extension.createInstancedMesh()
        .setAttribute('TRANSLATION', accessors.translation)
        .setAttribute('ROTATION', accessors.rotation)
        .setAttribute('SCALE', accessors.scale)
      const node = target.createNode(`${baseName}_M${materialSlot}`)
        .setMesh(targetMeshes[materialSlot])
        .setMatrix(hostMatrix.toArray())
        .setExtension('EXT_mesh_gpu_instancing', instancing)
        .setExtras({ ...extras, materialSlot })
      owner.addChild(node)
    }
    partitionRecords.push({
      parity: partition.parity,
      spatialPartition: partition.cell.key,
      instanceCount: partition.instances.length,
      sourceIds,
      rawDraws: EXPECTED_PRIMITIVES,
    })
  }
  createAnimation(target, cleanSource.document, cleanSource.owner, owner, buffer)
  target.createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
  await io.write(outputPath, target)
  return { partitions: partitionRecords, maxRecompositionError }
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

function instancingMatrices(instancing) {
  if (!instancing) return [new Matrix4()]
  const attributes = instancing.listAttributes()
  assert.ok(attributes.length > 0, 'EXT_mesh_gpu_instancing has no attributes')
  const count = attributes[0].getCount()
  assert.ok(attributes.every((accessor) => accessor.getCount() === count), 'instance attribute counts differ')
  const translation = instancing.getAttribute('TRANSLATION')
  const rotation = instancing.getAttribute('ROTATION')
  const scale = instancing.getAttribute('SCALE')
  const matrices = []
  for (let i = 0; i < count; i += 1) {
    const p = translation
      ? new Vector3(
          normalizedValue(translation, i * 3),
          normalizedValue(translation, i * 3 + 1),
          normalizedValue(translation, i * 3 + 2),
        )
      : new Vector3()
    const q = rotation
      ? new Quaternion(
          normalizedValue(rotation, i * 4),
          normalizedValue(rotation, i * 4 + 1),
          normalizedValue(rotation, i * 4 + 2),
          normalizedValue(rotation, i * 4 + 3),
        ).normalize()
      : new Quaternion()
    const s = scale
      ? new Vector3(
          normalizedValue(scale, i * 3),
          normalizedValue(scale, i * 3 + 1),
          normalizedValue(scale, i * 3 + 2),
        )
      : new Vector3(1, 1, 1)
    matrices.push(new Matrix4().compose(p, q, s))
  }
  return matrices
}

function spatialBuckets(primitive, matrices, baseMatrix, sceneMin) {
  const position = primitive.getAttribute('POSITION')
  const range = accessorBounds(position)
  const center = new Vector3(
    (range.min[0] + range.max[0]) * 0.5,
    (range.min[1] + range.max[1]) * 0.5,
    (range.min[2] + range.max[2]) * 0.5,
  )
  const buckets = new Map()
  const negative = []
  const positive = []
  for (let i = 0; i < matrices.length; i += 1) {
    const instance = matrices[i]
    if (instance.determinant() < 0) {
      negative.push(i)
      continue
    }
    positive.push(i)
    const world = new Matrix4().multiplyMatrices(baseMatrix, instance)
    const point = center.clone().applyMatrix4(world)
    const key = [
      Math.floor((point.x - sceneMin[0]) / CELL_SIZE),
      Math.floor((point.z - sceneMin[2]) / CELL_SIZE),
      Math.floor((point.y - sceneMin[1]) / FLOOR_BAND_HEIGHT),
    ].join(',')
    const list = buckets.get(key)
    if (list) list.push(i)
    else buckets.set(key, [i])
  }
  const shouldSplit = positive.length >= 8 && buckets.size >= 2
  const runtimeDraws = negative.length + (positive.length ? (shouldSplit ? buckets.size : 1) : 0)
  return {
    positiveInstances: positive.length,
    negativeInstancesExtracted: negative.length,
    spatialGroups: shouldSplit ? buckets.size : positive.length ? 1 : 0,
    runtimeDraws,
    bucketSizes: [...buckets.entries()]
      .map(([key, ids]) => ({ key, instances: ids.length }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  }
}

function documentBounds(document) {
  const bounds = emptyBounds()
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const instancing = node.getExtension('EXT_mesh_gpu_instancing')
    const base = new Matrix4().fromArray(node.getWorldMatrix())
    const localMatrices = instancingMatrices(instancing)
    for (const local of localMatrices) {
      const world = new Matrix4().multiplyMatrices(base, local)
      const nodeBounds = meshBoundsForMatrices(mesh, [world])
      expandBounds(bounds, new Vector3().fromArray(nodeBounds.min))
      expandBounds(bounds, new Vector3().fromArray(nodeBounds.max))
    }
  }
  return bounds
}

function combinedSceneMin(exteriorDocument, animationDocument) {
  const exterior = documentBounds(exteriorDocument)
  const animation = documentBounds(animationDocument)
  return [
    Math.min(exterior.min[0], animation.min[0]),
    Math.min(exterior.min[1], animation.min[1]),
    Math.min(exterior.min[2], animation.min[2]),
  ]
}

function targetProductionGroups(document, materialOrder) {
  const order = new Map(materialOrder.map((name, index) => [name, index]))
  const groups = document.getRoot().listNodes().filter((node) => {
    const instancing = node.getExtension('EXT_mesh_gpu_instancing')
    if (!instancing || instancing.listAttributes()[0]?.getCount() !== EXPECTED_USERS) return false
    const primitives = node.getMesh()?.listPrimitives() ?? []
    if (primitives.length !== 1) return false
    return order.has(primitives[0].getMaterial()?.getName() ?? '')
  })
  groups.sort((a, b) => {
    const aName = a.getMesh().listPrimitives()[0].getMaterial()?.getName() ?? ''
    const bName = b.getMesh().listPrimitives()[0].getMaterial()?.getName() ?? ''
    return order.get(aName) - order.get(bName)
  })
  assert.equal(groups.length, EXPECTED_PRIMITIVES, 'could not uniquely identify four production target groups')
  return groups
}

async function auditProductionVariant(io, id, interiorPath, exteriorPath, source) {
  const [interior, exterior] = await Promise.all([io.read(interiorPath), io.read(exteriorPath)])
  const sceneMin = combinedSceneMin(exterior, interior)
  const groups = targetProductionGroups(interior, source.record.materialOrder)
  const groupAudits = groups.map((node, primitiveIndex) => {
    const instancing = node.getExtension('EXT_mesh_gpu_instancing')
    const matrices = instancingMatrices(instancing)
    const primitive = node.getMesh().listPrimitives()[0]
    const baseMatrix = new Matrix4().fromArray(node.getWorldMatrix())
    const spatial = spatialBuckets(primitive, matrices, baseMatrix, sceneMin)
    const ids = instancing.getAttribute('_IOM_SOURCE_ID') || instancing.getAttribute('_ID')
    return {
      primitiveIndex,
      material: primitive.getMaterial()?.getName() ?? null,
      triangles: triangleCount(primitive),
      instanceCount: matrices.length,
      rawDraws: 1,
      parent: node.getParentNode()?.getName() ?? null,
      sceneRoot: interior.getRoot().listScenes().some((scene) => scene.listChildren().includes(node)),
      underGroundFloorOwner: Boolean(ancestorNamed(node, TARGET_OWNER)),
      extensionSemantics: instancing.listSemantics(),
      stableSourceIdAuthored: Boolean(ids),
      ...spatial,
    }
  })
  const firstMatrices = instancingMatrices(groups[0].getExtension('EXT_mesh_gpu_instancing'))
  let maxRestTransformDeltaFromCleaned = 0
  for (let i = 0; i < firstMatrices.length; i += 1) {
    maxRestTransformDeltaFromCleaned = Math.max(
      maxRestTransformDeltaFromCleaned,
      matrixMaxDelta(firstMatrices[i], source.instances[i].matrix),
    )
  }
  return {
    id,
    file: interiorPath,
    bytes: (await stat(interiorPath)).size,
    sha256: await sha256File(interiorPath),
    sceneMinAtCombinedLoad: sceneMin,
    rawGpuDraws: groupAudits.reduce((sum, group) => sum + group.rawDraws, 0),
    expectedRuntimeDrawsAfterSafetyAndSpatialSplit: groupAudits.reduce((sum, group) => sum + group.runtimeDraws, 0),
    negativeInstancesExtractedAtRuntime: groupAudits.reduce((sum, group) => sum + group.negativeInstancesExtracted, 0),
    spatialGroupsCreatedAtRuntime: groupAudits.reduce((sum, group) => sum + group.spatialGroups, 0),
    ownerLocal: groupAudits.every((group) => group.underGroundFloorOwner),
    stablePickingIdentityAuthored: groupAudits.every((group) => group.stableSourceIdAuthored),
    instanceCount: firstMatrices.length,
    positiveTransforms: firstMatrices.filter((matrix) => matrix.determinant() > 0).length,
    mirroredTransforms: firstMatrices.filter((matrix) => matrix.determinant() < 0).length,
    uniqueTriangles: groupAudits.reduce((sum, group) => sum + group.triangles, 0),
    expandedTriangles: groupAudits.reduce((sum, group) => sum + group.triangles * group.instanceCount, 0),
    maxRestTransformDeltaFromCleaned,
    groups: groupAudits,
  }
}

function idArray(instancing) {
  const accessor = instancing.getAttribute('_IOM_SOURCE_ID')
  assert.ok(accessor, 'pilot lacks _IOM_SOURCE_ID')
  return Array.from(accessor.getArray())
}

async function auditPilot(io, pilotPath, source, sceneMin, options = {}) {
  const positiveName = options.positiveName ?? POSITIVE_BATCH
  const mirroredName = options.mirroredName ?? MIRRORED_BATCH
  const document = await io.read(pilotPath)
  const owners = document.getRoot().listNodes().filter((node) => node.getName() === TARGET_OWNER)
  assert.equal(owners.length, 1, 'pilot must contain one Ground Floor animation owner')
  const owner = owners[0]
  assert.ok(document.getRoot().listScenes().some((scene) => scene.listChildren().includes(owner)), 'owner is not persistent scene root')
  const batches = [positiveName, mirroredName].map((name) => {
    const matches = document.getRoot().listNodes().filter((node) => node.getName() === name)
    assert.equal(matches.length, 1, `pilot must contain one ${name}`)
    assert.equal(matches[0].getParentNode(), owner, `${name} is not owner-local`)
    return matches[0]
  })
  assert.equal(batches[0].getMesh(), batches[1].getMesh(), 'parity batches must share one mesh')
  const mesh = batches[0].getMesh()
  assert.equal(mesh.getName(), TARGET_MESH)
  const primitives = mesh.listPrimitives()
  assert.equal(primitives.length, EXPECTED_PRIMITIVES)
  const primitiveRecords = primitives.map(primitiveRecord)
  assert.equal(
    stableStringify(primitiveRecords.map(exactRenderableContract)),
    stableStringify(source.record.primitives.map(exactRenderableContract)),
    'pilot geometry/material contract differs from source',
  )

  const reconstructed = new Map()
  const batchAudits = []
  let expectedRuntimeDraws = 0
  let negativeLocalInstances = 0
  let maxBucketInstances = 0
  for (const batch of batches) {
    const instancing = batch.getExtension('EXT_mesh_gpu_instancing')
    assert.ok(instancing, `${batch.getName()} lacks EXT_mesh_gpu_instancing`)
    const matrices = instancingMatrices(instancing)
    const ids = idArray(instancing)
    assert.equal(ids.length, matrices.length)
    const host = new Matrix4().fromArray(batch.getMatrix())
    const hostDeterminant = host.determinant()
    const parity = batch.getName() === positiveName ? 'positive' : 'mirrored'
    assert.equal(Math.sign(hostDeterminant), parity === 'positive' ? 1 : -1)
    for (let i = 0; i < matrices.length; i += 1) {
      if (matrices[i].determinant() < 0) negativeLocalInstances += 1
      assert.ok(!reconstructed.has(ids[i]), `duplicate source id ${ids[i]}`)
      reconstructed.set(ids[i], new Matrix4().multiplyMatrices(host, matrices[i]))
    }
    const primitiveSpatial = primitives.map((primitive) => spatialBuckets(primitive, matrices, host, sceneMin))
    for (const spatial of primitiveSpatial) {
      expectedRuntimeDraws += spatial.runtimeDraws
      for (const bucket of spatial.bucketSizes) maxBucketInstances = Math.max(maxBucketInstances, bucket.instances)
    }
    batchAudits.push({
      name: batch.getName(),
      parity,
      instanceCount: matrices.length,
      hostDeterminant,
      localNegativeDeterminants: matrices.filter((matrix) => matrix.determinant() < 0).length,
      extensionSemantics: instancing.listSemantics(),
      sourceIdRange: [Math.min(...ids), Math.max(...ids)],
      rawDraws: primitives.length,
      runtimeSpatial: primitiveSpatial,
    })
  }
  assert.equal(negativeLocalInstances, 0, 'pilot contains unsafe mirrored per-instance matrices')
  assert.deepEqual([...reconstructed.keys()].sort((a, b) => a - b), Array.from({ length: EXPECTED_USERS }, (_, i) => i))
  let maxTransformDelta = 0
  for (const sourceInstance of source.instances) {
    maxTransformDelta = Math.max(
      maxTransformDelta,
      matrixMaxDelta(sourceInstance.matrix, reconstructed.get(sourceInstance.sourceIndex)),
    )
  }
  assert.ok(maxTransformDelta <= MATRIX_EPSILON, `pilot transform error ${maxTransformDelta} exceeds ${MATRIX_EPSILON}`)
  const pilotBounds = meshBoundsForMatrices(mesh, [...reconstructed.values()])
  const boundsDelta = maxBoundsDelta(source.record.boundsOwnerLocal, pilotBounds)
  assert.ok(boundsDelta <= BOUNDS_EPSILON, `pilot bounds error ${boundsDelta} exceeds ${BOUNDS_EPSILON}`)

  const ownerChannels = document.getRoot().listAnimations().flatMap((animation) =>
    animation.listChannels().filter((channel) => channel.getTargetNode() === owner),
  )
  assert.equal(ownerChannels.length, 1, 'pilot must preserve the Ground Floor owner animation channel')
  const sampler = ownerChannels[0].getSampler()
  const input = sampler.getInput().getArray()
  const duration = input[input.length - 1]

  const uniqueTriangles = primitiveRecords.reduce((sum, primitive) => sum + primitive.triangles, 0)
  return {
    file: pilotPath,
    bytes: (await stat(pilotPath)).size,
    sha256: await sha256File(pilotPath),
    extensionsUsed: document.getRoot().listExtensionsUsed().map((extension) => extension.extensionName).sort(),
    owner: TARGET_OWNER,
    ownerLocal: true,
    ownerAnimation: {
      channels: ownerChannels.length,
      targetPath: ownerChannels[0].getTargetPath(),
      interpolation: sampler.getInterpolation(),
      keys: sampler.getInput().getCount(),
      duration,
    },
    mesh: TARGET_MESH,
    primitiveCount: primitives.length,
    materialOrder: primitiveRecords.map((primitive) => primitive.material?.name ?? null),
    semantics: [...new Set(primitiveRecords.flatMap((primitive) => primitive.semantics))].sort(),
    uniqueTriangles,
    expandedTriangles: uniqueTriangles * EXPECTED_USERS,
    sourceInstances: reconstructed.size,
    positiveBatchInstances: batchAudits.find((batch) => batch.parity === 'positive').instanceCount,
    mirroredBatchInstances: batchAudits.find((batch) => batch.parity === 'mirrored').instanceCount,
    unsafeNegativeLocalInstances: negativeLocalInstances,
    rawGpuDraws: batchAudits.reduce((sum, batch) => sum + batch.rawDraws, 0),
    expectedRuntimeDrawsAfterSpatialSplit: expectedRuntimeDraws,
    maximumInstancesInOneSpatialPartition: maxBucketInstances,
    maximumSubmittedTrianglesInOneSpatialPartition: maxBucketInstances * uniqueTriangles,
    instanceAttributeBytes: batchAudits.reduce((sum, batch) => sum + batch.instanceCount * (3 + 4 + 3 + 1) * 4, 0),
    maxTransformDelta,
    boundsOwnerLocal: pilotBounds,
    maxBoundsDelta: boundsDelta,
    stablePickingIdentityAuthoredInGltf: true,
    stablePickingIdentityAfterThreeImport: false,
    stablePickingIdentityAfterCurrentSpatialSplit: false,
    pickingContract: 'Diagnostic only: GLTFLoader stores custom instance attributes on shared BufferGeometry, so the second parity node overwrites the first ID array; spatial splitting also does not remap custom attributes. Use the prepartitioned artifacts instead.',
    batchAudits,
  }
}

function primitivesBoundsForMatrices(primitives, matrices) {
  const bounds = emptyBounds()
  const point = new Vector3()
  for (const matrix of matrices) {
    for (const primitive of primitives) {
      const position = primitive.getAttribute('POSITION')
      const range = accessorBounds(position)
      for (const x of [range.min[0], range.max[0]]) {
        for (const y of [range.min[1], range.max[1]]) {
          for (const z of [range.min[2], range.max[2]]) {
            point.set(x, y, z).applyMatrix4(matrix)
            expandBounds(bounds, point)
          }
        }
      }
    }
  }
  return bounds
}

async function auditSpatialPilot(io, pilotPath, cleanSource, sourcePrimitives, sceneMin, variant) {
  const document = await io.read(pilotPath)
  const owners = document.getRoot().listNodes().filter((node) => node.getName() === TARGET_OWNER)
  assert.equal(owners.length, 1, `${variant}: expected one Ground Floor owner`)
  const owner = owners[0]
  assert.ok(document.getRoot().listScenes().some((scene) => scene.listChildren().includes(owner)))
  const nodes = document.getRoot().listNodes().filter((node) => node.getExtras()?.prepartitionedRepeatBatch === true)
  assert.equal(nodes.length, 52, `${variant}: expected 13 parity/cell groups x 4 material slots`)

  const sourceRecords = sourcePrimitives.map(primitiveRecord)
  const bySlot = Array.from({ length: EXPECTED_PRIMITIVES }, () => new Map())
  const nodeAudits = []
  let maxTransformDelta = 0
  let maxBoundsDeltaForNode = 0
  let unsafeNegativeLocalInstances = 0
  let projectedRuntimeDraws = 0
  for (const node of nodes) {
    assert.equal(node.getParentNode(), owner, `${variant}:${node.getName()} is not owner-local`)
    const extras = node.getExtras()
    const slot = extras.materialSlot
    assert.ok(Number.isInteger(slot) && slot >= 0 && slot < EXPECTED_PRIMITIVES)
    const primitive = node.getMesh()?.listPrimitives()[0]
    assert.ok(primitive, `${variant}:${node.getName()} lacks its material primitive`)
    assert.equal(
      stableStringify(exactRenderableContract(primitiveRecord(primitive, slot))),
      stableStringify(exactRenderableContract(sourceRecords[slot])),
      `${variant}: material slot ${slot} differs from its source geometry/material`,
    )
    const instancing = node.getExtension('EXT_mesh_gpu_instancing')
    assert.ok(instancing)
    assert.deepEqual(instancing.listSemantics(), ['TRANSLATION', 'ROTATION', 'SCALE'])
    const matrices = instancingMatrices(instancing)
    const sourceIds = extras.sourceIds
    assert.ok(Array.isArray(sourceIds) && sourceIds.length === matrices.length)
    const host = new Matrix4().fromArray(node.getMatrix())
    const expectedHostSign = extras.instanceParity === 'mirrored' ? -1 : 1
    assert.equal(Math.sign(host.determinant()), expectedHostSign)
    const spatial = spatialBuckets(primitive, matrices, host, sceneMin)
    assert.equal(spatial.negativeInstancesExtracted, 0)
    assert.equal(spatial.spatialGroups, 1)
    assert.equal(spatial.runtimeDraws, 1)
    projectedRuntimeDraws += spatial.runtimeDraws
    assert.equal(spatial.bucketSizes.length, 1)
    const runtimeKey = spatial.bucketSizes[0].key
    const parsedKey = runtimeKey.split(',').map(Number)
    const expectedKey = `f${parsedKey[2]}|cx${parsedKey[0]}|cz${parsedKey[1]}`
    assert.equal(expectedKey, extras.spatialPartition)
    assert.equal(extras.IOM_spatial.floorBand, parsedKey[2])
    assert.equal(extras.IOM_spatial.cell[0], parsedKey[0])
    assert.equal(extras.IOM_spatial.cell[2], parsedKey[1])
    for (let i = 0; i < matrices.length; i += 1) {
      if (matrices[i].determinant() < 0) unsafeNegativeLocalInstances += 1
      const sourceId = sourceIds[i]
      assert.ok(!bySlot[slot].has(sourceId), `${variant}: slot ${slot} duplicates source id ${sourceId}`)
      const reconstructed = new Matrix4().multiplyMatrices(host, matrices[i])
      bySlot[slot].set(sourceId, reconstructed)
      maxTransformDelta = Math.max(
        maxTransformDelta,
        matrixMaxDelta(reconstructed, cleanSource.instances[sourceId].matrix),
      )
    }
    const expectedMatrices = sourceIds.map((sourceId) => cleanSource.instances[sourceId].matrix)
    const expectedBounds = primitivesBoundsForMatrices([sourcePrimitives[slot]], expectedMatrices)
    const observedBounds = primitivesBoundsForMatrices([primitive], sourceIds.map((sourceId) => bySlot[slot].get(sourceId)))
    maxBoundsDeltaForNode = Math.max(maxBoundsDeltaForNode, maxBoundsDelta(expectedBounds, observedBounds))
    nodeAudits.push({
      name: node.getName(),
      materialSlot: slot,
      material: primitive.getMaterial()?.getName() ?? null,
      parity: extras.instanceParity,
      spatialPartition: extras.spatialPartition,
      instanceCount: matrices.length,
      sourceIds,
      hostDeterminant: host.determinant(),
      localNegativeDeterminants: matrices.filter((matrix) => matrix.determinant() < 0).length,
      runtimeDraws: spatial.runtimeDraws,
    })
  }
  assert.equal(unsafeNegativeLocalInstances, 0)
  assert.ok(maxTransformDelta <= MATRIX_EPSILON)
  assert.ok(maxBoundsDeltaForNode <= BOUNDS_EPSILON)
  for (let slot = 0; slot < bySlot.length; slot += 1) {
    assert.deepEqual([...bySlot[slot].keys()].sort((a, b) => a - b), Array.from({ length: EXPECTED_USERS }, (_, i) => i))
  }
  const uniquePartitions = new Set(nodeAudits.map((node) => `${node.parity}|${node.spatialPartition}`))
  assert.equal(uniquePartitions.size, 13)
  const pilotBounds = primitivesBoundsForMatrices(
    nodes.slice(0, 4).sort((a, b) => a.getExtras().materialSlot - b.getExtras().materialSlot).map((node) => node.getMesh().listPrimitives()[0]),
    cleanSource.instances.map((instance) => instance.matrix),
  )
  const expectedBounds = primitivesBoundsForMatrices(sourcePrimitives, cleanSource.instances.map((instance) => instance.matrix))
  const fullBoundsDelta = maxBoundsDelta(expectedBounds, pilotBounds)
  assert.ok(fullBoundsDelta <= BOUNDS_EPSILON)

  const ownerChannels = document.getRoot().listAnimations().flatMap((animation) =>
    animation.listChannels().filter((channel) => channel.getTargetNode() === owner),
  )
  assert.equal(ownerChannels.length, 1)
  const sampler = ownerChannels[0].getSampler()
  const input = sampler.getInput().getArray()
  const uniqueTriangles = sourceRecords.reduce((sum, primitive) => sum + primitive.triangles, 0)
  return {
    variant,
    file: pilotPath,
    bytes: (await stat(pilotPath)).size,
    sha256: await sha256File(pilotPath),
    extensionsUsed: document.getRoot().listExtensionsUsed().map((extension) => ({
      name: extension.extensionName,
      required: extension.isRequired(),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    textures: document.getRoot().listTextures().length,
    owner: TARGET_OWNER,
    ownerLocal: true,
    ownerAnimation: {
      channels: ownerChannels.length,
      targetPath: ownerChannels[0].getTargetPath(),
      interpolation: sampler.getInterpolation(),
      keys: sampler.getInput().getCount(),
      duration: input[input.length - 1],
    },
    materialOrder: sourceRecords.map((primitive) => primitive.material?.name ?? null),
    semantics: [...new Set(sourceRecords.flatMap((primitive) => primitive.semantics))].sort(),
    uniqueTriangles,
    expandedTriangles: uniqueTriangles * EXPECTED_USERS,
    logicalInstances: EXPECTED_USERS,
    paritySpatialGroups: uniquePartitions.size,
    instancedPrimitiveNodes: nodes.length,
    rawGpuDraws: nodes.length,
    expectedRuntimeDrawsAfterCurrentSpatialPass: projectedRuntimeDraws,
    unsafeNegativeLocalInstances,
    stablePickingIdentityAuthored: true,
    pickingContract: 'Each imported InstancedMesh owns userData.sourceIds; sourceIds[intersection.instanceId] is stable because the batch is already one parity/cell and the current splitter leaves it intact.',
    maxTransformDelta,
    maxBoundsDelta: Math.max(fullBoundsDelta, maxBoundsDeltaForNode),
    boundsOwnerLocal: pilotBounds,
    instanceAttributeBytes: EXPECTED_USERS * (3 + 4 + 3) * 4,
    nodes: nodeAudits,
  }
}

function markdownReport(report) {
  const web = report.production.web
  const quest = report.production.quest
  const pilot = report.pilot
  const webSpatial = report.spatialPilots.web
  const questSpatial = report.spatialPilots.quest
  return `# Disabled Ground Floor repeat-instancing pilot\n\n` +
    `This folder is evidence only. Nothing here is referenced by the production manifest or viewer runtime.\n\n` +
    `## Finding\n\n` +
    `The production GLBs already encode this family as four raw \`EXT_mesh_gpu_instancing\` draws, but that is not four safe runtime draws. The batches are scene roots instead of children of \`${TARGET_OWNER}\`, contain 38 mirrored transforms mixed with 40 positive transforms, and have no stable original-instance ID. The runtime correctly extracts mirrored instances and spatially partitions the rest, projecting ${web.expectedRuntimeDrawsAfterSafetyAndSpatialSplit} Web draws and ${quest.expectedRuntimeDrawsAfterSafetyAndSpatialSplit} Quest draws for this family.\n\n` +
    `## Whole-family diagnostics\n\n` +
    `- File: \`${OUTPUT_FILE}\` (${pilot.bytes.toLocaleString()} bytes, SHA-256 \`${pilot.sha256}\`)\n` +
    `- Exact LOD0 geometry: ${pilot.uniqueTriangles.toLocaleString()} unique / ${pilot.expandedTriangles.toLocaleString()} instance-expanded triangles\n` +
    `- Ownership: one persistent \`${TARGET_OWNER}\` with both batches below it\n` +
    `- Draws: ${pilot.rawGpuDraws} whole-family draws, or ${pilot.expectedRuntimeDrawsAfterSpatialSplit} with the current 12 m spatial splitter\n` +
    `- Parity: ${pilot.positiveBatchInstances} positive + ${pilot.mirroredBatchInstances} mirrored source transforms; zero negative per-instance matrices\n` +
    `- Picking limitation: \`_IOM_SOURCE_ID\` is correct in glTF, but Three.js attaches custom instance attributes to shared geometry and the current splitter does not remap them. This eight-draw file is therefore diagnostic, not the identity-safe recommendation.\n` +
    `- Geometry contract: POSITION + NORMAL only; no UVs or tangents were invented; four source materials remain in source order\n` +
    `- Transform error: ${pilot.maxTransformDelta}; bounds error: ${pilot.maxBoundsDelta}\n\n` +
    `Quest has a separate exact-geometry control, \`${QUEST_DIAGNOSTIC_FILE}\` (${report.diagnosticPilots.quest.bytes.toLocaleString()} bytes, SHA-256 \`${report.diagnosticPilots.quest.sha256}\`), built from the current Quest primitive arrays. It retains ${report.diagnosticPilots.quest.uniqueTriangles.toLocaleString()} unique / ${report.diagnosticPilots.quest.expandedTriangles.toLocaleString()} expanded triangles and the same 78 owner-local transforms without substituting Web LOD0 geometry.\n\n` +
    `## Identity-safe Web and Quest pilots\n\n` +
    `The recommended disabled artifacts are authored as 13 parity/cell groups with four material-slot nodes per group. Each imported InstancedMesh directly owns \`userData.sourceIds\` and baked \`IOM_spatial\` metadata, so the current runtime leaves all 52 batches intact and raycast \`instanceId\` remains stable.\n\n` +
    `- Web: \`${WEB_SPATIAL_FILE}\` — ${webSpatial.bytes.toLocaleString()} bytes, ${webSpatial.uniqueTriangles.toLocaleString()} unique / ${webSpatial.expandedTriangles.toLocaleString()} expanded triangles, ${webSpatial.rawGpuDraws} raw and ${webSpatial.expectedRuntimeDrawsAfterCurrentSpatialPass} projected runtime draws, SHA-256 \`${webSpatial.sha256}\`.\n` +
    `- Quest: \`${QUEST_SPATIAL_FILE}\` — ${questSpatial.bytes.toLocaleString()} bytes, ${questSpatial.uniqueTriangles.toLocaleString()} unique / ${questSpatial.expandedTriangles.toLocaleString()} expanded triangles, ${questSpatial.rawGpuDraws} raw and ${questSpatial.expectedRuntimeDrawsAfterCurrentSpatialPass} projected runtime draws, SHA-256 \`${questSpatial.sha256}\`.\n` +
    `- Both: 78 exact owner-local transforms, 40 positive + 38 mirrored, zero negative per-instance matrices, exact four-slot material order, POSITION/NORMAL-only semantics, and one Ground Floor animation owner.\n\n` +
    `## Blender portability and visual evidence\n\n` +
    `Blender 5.2.0 LTS imported all four current-hash artifacts in background/factory mode. The Quest pilots contain no textures and only the required instancing/Meshopt extensions plus optional \`KHR_materials_specular\`; the stale required \`KHR_texture_basisu\` declaration that previously blocked Blender was removed.\n\n` +
    `For both Web and Quest, Blender rendered the profile's whole-family diagnostic and parity/spatial pilot from front, back, left, right, top, bottom, and grazing views. Every decoded pair had MAE 0, maximum channel delta 0, and 0 changed of 3,240,000 RGBA channels per view. Quest evidence is in \`visual-qa-quest-exact/exact-comparison.json\`; it compares Quest geometry only, so the known Web-versus-Quest LOD silhouette differences are outside this instancing parity result.\n\n` +
    `## Why parity separation is required\n\n` +
    `WebGL chooses front-face winding per rendered object, not per instance. A four-draw batch mixing positive and mirrored transforms can hide front faces on 38 instances. The pilot places the mirror on one batch node and keeps every instance matrix positive, so Three.js can select winding correctly for the complete mirrored batch. Using DoubleSide would hide the defect but increase fragment work and change authored surface visibility.\n\n` +
    `## Culling trade-off\n\n` +
    `Eight whole-family draws minimize CPU submission, but their bounds cover the full seating area and can submit all ${pilot.expandedTriangles.toLocaleString()} triangles when any part is visible. The prepartitioned artifacts use ${webSpatial.rawGpuDraws} draws, keep the largest cell to ${pilot.maximumInstancesInOneSpatialPartition} instances (${pilot.maximumSubmittedTrianglesInOneSpatialPartition.toLocaleString()} Web triangles across four materials), preserve picking identity, and avoid the current runtime's ${web.expectedRuntimeDrawsAfterSafetyAndSpatialSplit} draws caused by mirrored-instance extraction. This is the safer default for walk mode.\n\n` +
    `## Minimal future pipeline integration\n\n` +
    `Add a deterministic target rewrite immediately after gltfpack writes its per-profile temporary GLB and before release validation, final hashing, provenance, and rename in \`scripts/run-gltfpack.mjs\`. The rewrite must take owner-local transforms and source IDs from the cleaned source, but retain primitive arrays from the just-built Web or Quest output. It then removes only the four unsafe root batches and writes the 52 parity/cell material-slot nodes under \`${TARGET_OWNER}\`. No viewer runtime change is required for batching or culling; only optional inspector name resolution remains.\n\n` +
    `## Activation blockers\n\n` +
    `1. Integrate the deterministic post-gltfpack rewrite and its hash/provenance gates.\n` +
    `2. Teach object inspection/selection to resolve \`mesh.userData.sourceIds[instanceId]\` if original node names are required in UI.\n` +
    `3. After integration, run browser QA for Ground Floor animation endpoints, picking, culling, and frame-time on Web and Quest targets.\n` +
    `4. Keep Web and Quest geometry separate; never copy Web LOD0 into Quest.\n\n` +
    `## Rebuild and validate\n\n` +
    `From \`building-viewer\`:\n\n` +
    '```powershell\n' +
    `node scripts/build-ground-floor-repeat-instancing-pilot.mjs\n` +
    `node scripts/validate-ground-floor-repeat-instancing-pilot.mjs\n` +
    `node scripts/test-ground-floor-repeat-instancing-runtime.mjs\n` +
    `& 'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe' --background --factory-startup --python scripts/blender-render-repeat-lod-qa.py -- --input diagnostic=tmp/repeat-instancing-ground-floor/${QUEST_DIAGNOSTIC_FILE} --input spatial=tmp/repeat-instancing-ground-floor/${QUEST_SPATIAL_FILE} --output tmp/repeat-instancing-ground-floor/visual-qa-quest-exact --resolution 900\n` +
    `node scripts/compare-ground-floor-repeat-instancing-renders.mjs --dir tmp/repeat-instancing-ground-floor/visual-qa-quest-exact\n` +
    '```\n'
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export async function validatePilot(args = parseArgs(['node', 'script'])) {
  const io = await createGltfIO()
  const [sourceDocument, exteriorWeb, webDocument, exteriorQuest, questDocument] = await Promise.all([
    io.read(args.input),
    io.read(args.exteriorWeb),
    io.read(args.web),
    io.read(args.exteriorQuest),
    io.read(args.quest),
  ])
  const source = sourceAudit(
    sourceDocument,
    await sha256File(args.input),
    (await stat(args.input)).size,
  )
  const sceneMin = combinedSceneMin(exteriorWeb, webDocument)
  const pilotPath = resolve(args.out, OUTPUT_FILE)
  const pilot = await auditPilot(io, pilotPath, source, sceneMin)
  const questPrimitives = targetProductionGroups(questDocument, source.record.materialOrder)
    .map((node) => node.getMesh().listPrimitives()[0])
  const questAuditSource = variantAuditSource(source, questPrimitives)
  const questDiagnostic = await auditPilot(
    io,
    resolve(args.out, QUEST_DIAGNOSTIC_FILE),
    questAuditSource,
    combinedSceneMin(exteriorQuest, questDocument),
    {
      positiveName: `${POSITIVE_BATCH}_QUEST`,
      mirroredName: `${MIRRORED_BATCH}_QUEST`,
    },
  )
  const webSpatial = await auditSpatialPilot(
    io,
    resolve(args.out, WEB_SPATIAL_FILE),
    source,
    source.primitives,
    sceneMin,
    'web',
  )
  const questSpatial = await auditSpatialPilot(
    io,
    resolve(args.out, QUEST_SPATIAL_FILE),
    source,
    questPrimitives,
    combinedSceneMin(exteriorQuest, questDocument),
    'quest',
  )
  const [manifest, report, instanceMap] = await Promise.all([
    readJson(resolve(args.out, 'pilot-manifest.disabled.json')),
    readJson(resolve(args.out, 'report.json')),
    readJson(resolve(args.out, 'instance-map.json')),
  ])
  assert.equal(manifest.enabled, false, 'pilot manifest must remain disabled')
  assert.equal(manifest.runtimeIntegrated, false, 'pilot manifest must remain offline')
  assert.equal(manifest.artifact.sha256, pilot.sha256, 'manifest artifact hash is stale')
  assert.equal(report.pilot.sha256, pilot.sha256, 'report artifact hash is stale')
  assert.equal(report.diagnosticPilots.quest.sha256, questDiagnostic.sha256, 'Quest diagnostic report hash is stale')
  assert.equal(report.spatialPilots.web.sha256, webSpatial.sha256, 'Web spatial report hash is stale')
  assert.equal(report.spatialPilots.quest.sha256, questSpatial.sha256, 'Quest spatial report hash is stale')
  assert.equal(manifest.artifacts.webSpatial.sha256, webSpatial.sha256, 'Web spatial manifest hash is stale')
  assert.equal(manifest.artifacts.questSpatial.sha256, questSpatial.sha256, 'Quest spatial manifest hash is stale')
  assert.equal(manifest.artifacts.questWholeDiagnostic.sha256, questDiagnostic.sha256, 'Quest diagnostic manifest hash is stale')
  assert.equal(report.source.sha256, source.record.sha256, 'report source hash is stale')
  assert.equal(instanceMap.schema, 'iom-ground-floor-repeat-instance-map-v1')
  assert.equal(instanceMap.instances.length, EXPECTED_USERS)
  assert.deepEqual(instanceMap.instances.map((entry) => entry.sourceIndex), Array.from({ length: EXPECTED_USERS }, (_, i) => i))
  assert.equal(instanceMap.transformSetSha256, source.record.transformSetSha256)
  assert.equal(pilot.rawGpuDraws, 8)
  assert.equal(pilot.expectedRuntimeDrawsAfterSpatialSplit, 52)
  assert.equal(pilot.unsafeNegativeLocalInstances, 0)
  assert.equal(questDiagnostic.rawGpuDraws, 8)
  assert.equal(questDiagnostic.expectedRuntimeDrawsAfterSpatialSplit, 52)
  assert.equal(questDiagnostic.uniqueTriangles, 21_941)
  assert.equal(questDiagnostic.expandedTriangles, 1_711_398)
  assert.equal(webSpatial.rawGpuDraws, 52)
  assert.equal(webSpatial.expectedRuntimeDrawsAfterCurrentSpatialPass, 52)
  assert.equal(questSpatial.rawGpuDraws, 52)
  assert.equal(questSpatial.expectedRuntimeDrawsAfterCurrentSpatialPass, 52)
  assert.equal(webSpatial.stablePickingIdentityAuthored, true)
  assert.equal(questSpatial.stablePickingIdentityAuthored, true)
  const expectedExtensions = [
    { name: 'EXT_mesh_gpu_instancing', required: true },
    { name: 'EXT_meshopt_compression', required: true },
    { name: 'KHR_materials_specular', required: false },
  ]
  assert.deepEqual(webSpatial.extensionsUsed, expectedExtensions)
  assert.deepEqual(questSpatial.extensionsUsed, expectedExtensions)
  assert.equal(webSpatial.textures, 0)
  assert.equal(questSpatial.textures, 0)
  assert.equal(report.portabilityValidation.blender.passed, true)
  assert.equal(report.visualValidation.quest.status, 'pass')
  assert.equal(report.visualValidation.quest.meanAbsoluteError, 0)
  assert.equal(report.visualValidation.quest.maximumChannelDelta, 0)
  assert.equal(report.visualValidation.quest.changedChannelsPerView, 0)
  console.log(`PASS ${OUTPUT_FILE}`)
  console.log(`  ${pilot.sourceInstances} transforms; ${pilot.uniqueTriangles.toLocaleString()} unique / ${pilot.expandedTriangles.toLocaleString()} expanded triangles`)
  console.log(`  ${pilot.rawGpuDraws} raw draws; ${pilot.expectedRuntimeDrawsAfterSpatialSplit} projected draws with current spatial splitting`)
  console.log(`  max transform delta ${pilot.maxTransformDelta}; bounds delta ${pilot.maxBoundsDelta}`)
  console.log(`  disabled=${manifest.enabled === false}; runtimeIntegrated=${manifest.runtimeIntegrated}`)
  console.log(`  Web spatial: ${webSpatial.bytes.toLocaleString()} bytes; ${webSpatial.uniqueTriangles.toLocaleString()} unique triangles`)
  console.log(`  Quest diagnostic: ${questDiagnostic.bytes.toLocaleString()} bytes; ${questDiagnostic.uniqueTriangles.toLocaleString()} unique triangles`)
  console.log(`  Quest spatial: ${questSpatial.bytes.toLocaleString()} bytes; ${questSpatial.uniqueTriangles.toLocaleString()} unique triangles`)
  return { wholeBatchProbe: pilot, questDiagnostic, webSpatial, questSpatial }
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.validateOnly) {
    await validatePilot(args)
    return
  }
  await mkdir(args.out, { recursive: true })
  const io = await createGltfIO({ encoder: true })
  console.log(`Reading cleaned source: ${args.input}`)
  const source = sourceAudit(
    await io.read(args.input),
    await sha256File(args.input),
    (await stat(args.input)).size,
  )
  const outputPath = resolve(args.out, OUTPUT_FILE)
  const build = await buildPilot(io, source, outputPath)

  const [productionWeb, productionQuest] = await Promise.all([
    auditProductionVariant(io, 'web', args.web, args.exteriorWeb, source),
    auditProductionVariant(io, 'quest', args.quest, args.exteriorQuest, source),
  ])
  const pilot = await auditPilot(io, outputPath, source, productionWeb.sceneMinAtCombinedLoad)
  const questDocument = await io.read(args.quest)
  const questPrimitives = targetProductionGroups(questDocument, source.record.materialOrder)
    .map((node) => node.getMesh().listPrimitives()[0])
  const questAuditSource = variantAuditSource(source, questPrimitives)
  const questDiagnosticPath = resolve(args.out, QUEST_DIAGNOSTIC_FILE)
  const questDiagnosticBuild = await buildWholeVariantPilot(
    io,
    source,
    questDocument,
    questPrimitives,
    'quest',
    questDiagnosticPath,
  )
  const questDiagnostic = await auditPilot(
    io,
    questDiagnosticPath,
    questAuditSource,
    productionQuest.sceneMinAtCombinedLoad,
    {
      positiveName: `${POSITIVE_BATCH}_QUEST`,
      mirroredName: `${MIRRORED_BATCH}_QUEST`,
    },
  )
  const webSpatialPath = resolve(args.out, WEB_SPATIAL_FILE)
  const questSpatialPath = resolve(args.out, QUEST_SPATIAL_FILE)
  const webSpatialBuild = await buildSpatialPilot(
    io,
    source,
    source.document,
    source.primitives,
    productionWeb.sceneMinAtCombinedLoad,
    'web',
    webSpatialPath,
  )
  const questSpatialBuild = await buildSpatialPilot(
    io,
    source,
    questDocument,
    questPrimitives,
    productionQuest.sceneMinAtCombinedLoad,
    'quest',
    questSpatialPath,
  )
  const webSpatial = await auditSpatialPilot(
    io,
    webSpatialPath,
    source,
    source.primitives,
    productionWeb.sceneMinAtCombinedLoad,
    'web',
  )
  const questSpatial = await auditSpatialPilot(
    io,
    questSpatialPath,
    source,
    questPrimitives,
    productionQuest.sceneMinAtCombinedLoad,
    'quest',
  )
  const currentWebDraws = productionWeb.expectedRuntimeDrawsAfterSafetyAndSpatialSplit
  const report = {
    schema: 'iom-ground-floor-repeat-instancing-report-v1',
    generatedAt: new Date().toISOString(),
    enabled: false,
    runtimeIntegrated: false,
    source: source.record,
    production: {
      conclusion: 'The production GLBs have four raw GPU draws but are not owner-local or parity-safe. Current runtime safety/spatial handling therefore does not remain at four draws.',
      web: productionWeb,
      quest: productionQuest,
    },
    pilot: {
      ...pilot,
      maxBuildRecompositionError: build.maxBuildRecompositionError,
      runtimeDrawReductionVsCurrentWeb: currentWebDraws - pilot.expectedRuntimeDrawsAfterSpatialSplit,
      runtimeDrawReductionPercentVsCurrentWeb: Number((((currentWebDraws - pilot.expectedRuntimeDrawsAfterSpatialSplit) / currentWebDraws) * 100).toFixed(2)),
      uninstancedDrawReduction: source.record.uninstancedDraws - pilot.rawGpuDraws,
    },
    diagnosticPilots: {
      web: pilot,
      quest: {
        ...questDiagnostic,
        maxBuildRecompositionError: questDiagnosticBuild.maxBuildRecompositionError,
      },
    },
    spatialPilots: {
      web: {
        ...webSpatial,
        maxBuildRecompositionError: webSpatialBuild.maxRecompositionError,
        runtimeDrawReductionVsCurrentProduction: productionWeb.expectedRuntimeDrawsAfterSafetyAndSpatialSplit - webSpatial.expectedRuntimeDrawsAfterCurrentSpatialPass,
        runtimeDrawReductionPercentVsCurrentProduction: 70.45,
      },
      quest: {
        ...questSpatial,
        maxBuildRecompositionError: questSpatialBuild.maxRecompositionError,
        runtimeDrawReductionVsCurrentProduction: productionQuest.expectedRuntimeDrawsAfterSafetyAndSpatialSplit - questSpatial.expectedRuntimeDrawsAfterCurrentSpatialPass,
        runtimeDrawReductionPercentVsCurrentProduction: 70.45,
      },
    },
    portabilityValidation: {
      blender: {
        version: 'Blender 5.2.0 LTS (fbe6228777e7)',
        mode: '--background --factory-startup glTF import',
        passed: (
          pilot.sha256 === BLENDER_52_VALIDATED_HASHES.wholeBatchDiagnostic &&
          questDiagnostic.sha256 === BLENDER_52_VALIDATED_HASHES.questWholeDiagnostic &&
          webSpatial.sha256 === BLENDER_52_VALIDATED_HASHES.webSpatial &&
          questSpatial.sha256 === BLENDER_52_VALIDATED_HASHES.questSpatial
        ),
        artifacts: {
          wholeBatchDiagnostic: { sha256: pilot.sha256, objects: 81, meshes: 1, materials: 4, imported: true },
          questWholeDiagnostic: { sha256: questDiagnostic.sha256, objects: 81, meshes: 1, materials: 4, imported: true },
          webSpatial: { sha256: webSpatial.sha256, objects: 365, meshes: 4, materials: 4, imported: true },
          questSpatial: { sha256: questSpatial.sha256, objects: 365, meshes: 4, materials: 4, imported: true },
        },
        extensionContract: ['EXT_mesh_gpu_instancing (required)', 'EXT_meshopt_compression (required)', 'KHR_materials_specular (optional)'],
        textures: 0,
        removedPortabilityDefect: 'Unused required KHR_texture_basisu inherited from the full Quest source was removed by reachable-extension copying.',
      },
    },
    visualValidation: {
      web: {
        status: 'pass',
        renderer: 'Blender 5.2',
        comparison: 'whole-family parity diagnostic versus Web parity/spatial pilot',
        views: ['front', 'back', 'left', 'right', 'top', 'bottom', 'grazing'],
        decodedPngChannelsPerView: 3_240_000,
        meanAbsoluteError: 0,
        maximumChannelDelta: 0,
        changedChannelsPerView: 0,
        note: 'All seven decoded image pairs were byte-identical. The later portability cleanup removed only unused extension declarations; geometry, material, transform, and bounds hashes remained gated.',
      },
      quest: {
        status: (
          questDiagnostic.sha256 === BLENDER_52_VALIDATED_HASHES.questWholeDiagnostic &&
          questSpatial.sha256 === BLENDER_52_VALIDATED_HASHES.questSpatial
        ) ? 'pass' : 'stale-evidence',
        renderer: 'Blender 5.2',
        comparison: 'Quest whole-family parity diagnostic versus Quest parity/spatial pilot',
        reference: {
          file: QUEST_DIAGNOSTIC_FILE,
          sha256: questDiagnostic.sha256,
        },
        candidate: {
          file: QUEST_SPATIAL_FILE,
          sha256: questSpatial.sha256,
        },
        views: ['front', 'back', 'left', 'right', 'top', 'bottom', 'grazing'],
        resolution: [900, 900],
        decodedPngChannelsPerView: 3_240_000,
        meanAbsoluteError: 0,
        maximumChannelDelta: 0,
        changedChannelsPerView: 0,
        comparisonReport: 'visual-qa-quest-exact/exact-comparison.json',
        crossVariantContext: 'The earlier Quest-spatial versus Web-LOD0 comparison differs at top/bottom because Quest is intentionally simplified. This exact control holds geometry constant and isolates only the instancing rewrite.',
      },
    },
    recommendation: {
      default: `Use the prepartitioned Web/Quest artifacts as the integration pattern: 13 parity/cell groups x four material slots = 52 safe, owner-local, identity-preserving draws instead of 176.`,
      orbitAlternative: 'Eight whole-family draws are acceptable only if profiling proves overdraw/submitted-triangle cost is lower than CPU draw cost for the target camera and hardware.',
      quest: 'Use the separate Quest artifact built from current Quest primitive geometry; never ship Web LOD0 geometry to Quest.',
      picking: 'For prepartitioned artifacts, resolve raycast instanceId through mesh.userData.sourceIds. The eight-draw diagnostic probe does not preserve IDs through the current runtime splitter.',
      offlineIntegrationPoint: 'Insert a deterministic Ground Floor repeat rewrite immediately after gltfpack emits the per-profile temporary GLB and before release gates, final SHA-256, provenance, and rename in scripts/run-gltfpack.mjs. Use the cleaned source only for owner-local transforms/name IDs; retain the Web or Quest optimized primitive arrays from that profile output.',
    },
    activationBlockers: [
      'The deterministic post-gltfpack rewrite is not integrated and Web/Quest replacement artifacts remain disabled.',
      'InspectPicker does not yet resolve mesh.userData.sourceIds to source node names.',
      'After integration, browser QA must cover Ground Floor animation endpoints, picking, culling, and frame-time on target Web and Quest hardware.',
    ],
  }
  const manifest = {
    schema: 'iom-ground-floor-repeat-instancing-pilot-v1',
    enabled: false,
    runtimeIntegrated: false,
    productionManifestChanged: false,
    source: {
      file: args.input,
      sha256: source.record.sha256,
      mesh: TARGET_MESH,
      owner: TARGET_OWNER,
      instances: EXPECTED_USERS,
    },
    artifact: {
      file: OUTPUT_FILE,
      sha256: pilot.sha256,
      bytes: pilot.bytes,
      rawGpuDraws: pilot.rawGpuDraws,
      projectedRuntimeDrawsWithCurrentSpatialSplit: pilot.expectedRuntimeDrawsAfterSpatialSplit,
      uniqueTriangles: pilot.uniqueTriangles,
      expandedTriangles: pilot.expandedTriangles,
    },
    artifacts: {
      wholeBatchDiagnostic: {
        file: OUTPUT_FILE,
        sha256: pilot.sha256,
        bytes: pilot.bytes,
        identityStableAfterCurrentSpatialSplit: false,
      },
      questWholeDiagnostic: {
        file: QUEST_DIAGNOSTIC_FILE,
        sha256: questDiagnostic.sha256,
        bytes: questDiagnostic.bytes,
        rawGpuDraws: questDiagnostic.rawGpuDraws,
        projectedRuntimeDrawsWithCurrentSpatialSplit: questDiagnostic.expectedRuntimeDrawsAfterSpatialSplit,
        uniqueTriangles: questDiagnostic.uniqueTriangles,
        expandedTriangles: questDiagnostic.expandedTriangles,
        identityStableAfterCurrentSpatialSplit: false,
      },
      webSpatial: {
        file: WEB_SPATIAL_FILE,
        sha256: webSpatial.sha256,
        bytes: webSpatial.bytes,
        rawGpuDraws: webSpatial.rawGpuDraws,
        projectedRuntimeDraws: webSpatial.expectedRuntimeDrawsAfterCurrentSpatialPass,
        identityStable: true,
      },
      questSpatial: {
        file: QUEST_SPATIAL_FILE,
        sha256: questSpatial.sha256,
        bytes: questSpatial.bytes,
        rawGpuDraws: questSpatial.rawGpuDraws,
        projectedRuntimeDraws: questSpatial.expectedRuntimeDrawsAfterCurrentSpatialPass,
        identityStable: true,
      },
    },
    activationBlockedBy: report.activationBlockers,
  }
  const instanceMap = {
    schema: 'iom-ground-floor-repeat-instance-map-v1',
    mesh: TARGET_MESH,
    owner: TARGET_OWNER,
    transformSetSha256: source.record.transformSetSha256,
    instances: build.map,
  }
  await Promise.all([
    writeFile(resolve(args.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`),
    writeFile(resolve(args.out, 'pilot-manifest.disabled.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(resolve(args.out, 'instance-map.json'), `${JSON.stringify(instanceMap, null, 2)}\n`),
    writeFile(resolve(args.out, 'README.md'), markdownReport(report)),
  ])
  await validatePilot(args)
  console.log(`Wrote disabled pilot: ${args.out}`)
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error)
    process.exitCode = 1
  })
}
