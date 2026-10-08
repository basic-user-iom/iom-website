#!/usr/bin/env node

/**
 * Build a disabled exact six-part row source directly from the pinned
 * production Web GLB. This is an offline proof/pilot only: it never edits a
 * public model, viewer runtime, manifest, or enabled route.
 *
 * The production optimizer split the source row into four unnamed,
 * material-specific EXT_mesh_gpu_instancing roots. This builder identifies
 * those roots by hard physical signatures, proves that their 78 TRS rows are
 * byte-identical and in the previously established logical source order, and
 * partitions the decoded production triangles into six contiguous three-seat
 * segments without changing position/normal bits, material assignment, or
 * oriented triangle winding.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document } from '@gltf-transform/core'
import { copyToDocument, createDefaultPropertyResolver } from '@gltf-transform/functions'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'
import {
  LOGICAL_MAPPING_SCHEMA,
  LOGICAL_MAPPING_VERSION,
  TRACKED_CERTIFICATE_PIN,
  validateTrackedLogicalMappingCertificate,
} from './validate-repeat-six-part-logical-mapping-certificate.mjs'

const SCRIPT_ROOT = resolve(import.meta.dirname)
const VIEWER_ROOT = resolve(SCRIPT_ROOT, '..')
const DEFAULT_PRODUCTION_MODEL = resolve(VIEWER_ROOT, '../public/models/icm-anim-2025/model-web.glb')
const DEFAULT_OUTPUT_ROOT = resolve(VIEWER_ROOT, 'tmp/repeat-six-part-production-source')
const CURRENT_MAPPING_REFERENCE = resolve(VIEWER_ROOT, 'tmp/repeat-instancing-ground-floor/instance-map.json')
const CANONICAL_OUTPUT_ROOT = 'tmp/repeat-six-part-production-source'

const OUTPUT_NAMES = Object.freeze({
  geometry: 'exact-six-segment-production-source.glb',
  sourceMap: 'production-source-map.json',
  audit: 'physical-audit.json',
  report: 'REPORT.md',
})

const MODEL_PIN = Object.freeze({
  relativePath: '../public/models/icm-anim-2025/model-web.glb',
  bytes: 97_549_356,
  sha256: 'b96cf36f64a03d16047e3ff26aa93131481f636c184df80b5c7ea2032e4cb5e8',
})

const EXPECTED = Object.freeze({
  sourceCount: 78,
  segmentCount: 6,
  stationsPerSegment: 3,
  triangles: 61_269,
  expandedTriangles: 4_778_982,
  positiveTransforms: 40,
  mirroredTransforms: 38,
  sourceIdsSha256: 'd2883d11372b27f23ae8388db283195e13b979870cb5897e63a7971676a5189b',
  sourcePathsSha256: '72f559e1f08017caeb07b3c5577b0f2e3f2cf85a1886f781f9f5b863836d30bc',
  segmentGeometrySha256: Object.freeze([
    '55d1d534df847b56bbfea8f0c9905f8ad28e3997954c69354cf3cb40faeed2d4',
    '154bb6f80c279ca8672234f8908f5dad4e4e762ec6472abe47c5795369d3b4f7',
    '5ee0d98eaf1070bd77450516dc9570e6f41cb8a2b2ffad8ff522a285f9d93193',
    'cac480e6a64f0f373cfa0c6233965df23d0049e7457f059454dc2579128167e0',
    '23607a86d0efa9fdd2a379261c62fcf018694c1a7c98f0ab06e97102ca539fe1',
    '8cf6ba50e28ca1f1662f40792a64d08fe6b997b18f5d39b74fde0b7985d5e2fc',
  ]),
})

const MATERIAL_SLOTS = Object.freeze([
  Object.freeze({
    slot: 0,
    activeScenePath: 'scene/0/258',
    material: 'vray Stuhl_Plastik',
    triangles: 24_213,
    position: Object.freeze({
      count: 20_497,
      componentType: 5126,
      normalized: false,
      sha256: '7483938489d8e65fc7d42c1663219c315c0114b9f59372c538927f2a76322abe',
    }),
    normal: Object.freeze({
      count: 20_497,
      componentType: 5122,
      normalized: true,
      sha256: '2d3ca7d5a589c822c3083eeb67fe3cdcdc958822984dfb00eb863439a3123de4',
    }),
    indices: Object.freeze({
      count: 72_639,
      componentType: 5123,
      sha256: '99e7fb827476375a9f566e765848bcb6e3ad92b3abfd3884f8e97dc36504e21f',
    }),
  }),
  Object.freeze({
    slot: 1,
    activeScenePath: 'scene/0/259',
    material: 'vray Stuhl_Plakete',
    triangles: 7_102,
    position: Object.freeze({
      count: 7_707,
      componentType: 5126,
      normalized: false,
      sha256: 'af04e842fd7b2873ee53d116f8d08ccec4b86d10f3096c744a59303a7fdeb9cf',
    }),
    normal: Object.freeze({
      count: 7_707,
      componentType: 5122,
      normalized: true,
      sha256: 'f5006f41dcc700fa0820386be03af3de8c3bfe40e371f57620176b396ac37709',
    }),
    indices: Object.freeze({
      count: 21_306,
      componentType: 5123,
      sha256: '7fd18880c12c1031cb9dfb1a417c887e6e519199fcebd4f9a536a308545c36ed',
    }),
  }),
  Object.freeze({
    slot: 2,
    activeScenePath: 'scene/0/260',
    material: 'vray Stuhl_Metall',
    triangles: 14_041,
    position: Object.freeze({
      count: 15_361,
      componentType: 5126,
      normalized: false,
      sha256: 'b149490c1e754b99e769fb0da7944371f4a136ca42ad2fc4d9bc01fed3661cb3',
    }),
    normal: Object.freeze({
      count: 15_361,
      componentType: 5122,
      normalized: true,
      sha256: 'df83db38249c30ceb38493bf1a028dfa64acd5dbf4dfd5a929001550eb4289de',
    }),
    indices: Object.freeze({
      count: 42_123,
      componentType: 5123,
      sha256: 'd70950f34732e4c37906dec273cf7a06e6b3ecf8aca52cdaeb785e426f8b23bd',
    }),
  }),
  Object.freeze({
    slot: 3,
    activeScenePath: 'scene/0/261',
    material: 'vray Stuhl_Bezug',
    triangles: 15_913,
    position: Object.freeze({
      count: 13_055,
      componentType: 5126,
      normalized: false,
      sha256: 'a850c9ac4bc8bc43f1167588ceb9507824ba8eb57fee404601572ed60c0a32d4',
    }),
    normal: Object.freeze({
      count: 13_055,
      componentType: 5122,
      normalized: true,
      sha256: 'abb4b4e9b6acb14300981458b4d324720ea72333ceba8a788383b0e5674acfe9',
    }),
    indices: Object.freeze({
      count: 47_739,
      componentType: 5123,
      sha256: 'c89597153d29cfc8ff57ee42b5f5c3122cb1ad37cc86db2ed63adebddd0fa557',
    }),
  }),
])

const INSTANCE_ATTRIBUTE_PINS = Object.freeze({
  TRANSLATION: Object.freeze({
    type: 'VEC3',
    componentType: 5126,
    normalized: false,
    count: 78,
    sha256: '34987d98ceec9c58feba736616334ab8eae0573ab4e5ebcda298632a36a06638',
  }),
  ROTATION: Object.freeze({
    type: 'VEC4',
    componentType: 5122,
    normalized: true,
    count: 78,
    sha256: '8763e4b72ce6409aff834aae8ff491078daeb22b48ad8162b03506a42c9b0286',
  }),
  SCALE: Object.freeze({
    type: 'VEC3',
    componentType: 5126,
    normalized: false,
    count: 78,
    sha256: 'd1db5799e962e30af5f9e9c0d8f39649e5c1fe96b1d5bbb3cfd9f9b6801a12a5',
  }),
})

const CURRENT_MAPPING_PROOF = Object.freeze({
  referencePath: 'tmp/repeat-instancing-ground-floor/instance-map.json',
  referenceBytes: 57_332,
  referenceSha256: 'f5101fff6e773e5dffca2b07e88f6869106cf6ebc225df250c27146bd2f4116d',
  matchingMethod: 'identity-order plus exhaustive nearest-neighbor over owner-local translation rows',
  identityOrderMatches: 78,
  nearestNeighborMismatches: 0,
  maximumPairedTranslationDelta: 0.0028825632876861296,
  minimumNearestNeighborMargin: 0.9142217907076844,
  maximumMatrixComponentDelta: 0.0019454956054696382,
})

const DERIVED_PINS = Object.freeze({
  productionGeometryDigest: '4ace583e8d9bd044defffa65aa5e6b875b4923381ebb0eeca58ee5375306edee',
  productionTransformSetSha256: 'fe7adf799ecbfedbf84bcfcaa0557713728a36507573f846b52476891b66d36b',
  materialSha256: Object.freeze([
    '5607a596ab75b3030ea09d71e46e759aca5480b7ea8e868028717240ea848f9f',
    '37c98819adf88dbe4ce397f72ce324e998e20d09e50a1c78d76085d833af0407',
    '65d4e7550a8d3ba74e3cff5fb816ae14ed7fb10ba115be61ef6e79e17ae8141c',
    'bad4c76d32293515c401430ebb2edda487470bfe52a13368c536017fd443b404',
  ]),
  segments: Object.freeze([
    Object.freeze([4_103, 1_326, 2_431, 2_677]),
    Object.freeze([4_147, 1_297, 2_420, 2_694]),
    Object.freeze([4_154, 1_312, 2_445, 2_685]),
    Object.freeze([4_141, 1_292, 2_410, 2_692]),
    Object.freeze([4_044, 1_249, 2_366, 2_694]),
    Object.freeze([3_624, 626, 1_969, 2_471]),
  ]),
  geometryOutput: Object.freeze({
    bytes: 1_877_420,
    sha256: '34fdf9c3ca0355b0f55dc531636cbde11705920042d3788c5ba2eb2086277417',
  }),
  sourceMapOutput: Object.freeze({
    bytes: 48_997,
    sha256: '4aca79b65fc0ac1fe05add9dba3254da2cb030a55bdcd6763bc63a78374092eb',
  }),
})

// Centers were measured from the original authored row in Blender Z-up.
// Production decoded geometry is glTF Y-up, so (x,y,z) -> (x,z,-y).
const STATION_CENTERS_BLENDER = Object.freeze([
  [46.57499313354492, -970.9609985351562, 63.43870162963867],
  [40.260108947753906, -910.45703125, 63.43870162963867],
  [34.36452102661133, -849.8910522460938, 63.43870162963867],
  [28.91179084777832, -789.295166015625, 63.43870162963867],
  [23.867855072021484, -728.6815795898438, 63.43870162963867],
  [19.22564125061035, -668.04931640625, 63.43870162963867],
  [14.97977352142334, -607.3727416992188, 63.43870162963867],
  [11.151128768920898, -546.66748046875, 63.43870162963867],
  [7.719564437866211, -485.9390869140625, 63.43870162963867],
  [4.689475059509277, -425.1929931640625, 63.43870162963867],
  [2.0424294471740723, -364.38580322265625, 63.43870162963867],
  [-0.2016758918762207, -303.5622863769531, 63.43870162963867],
  [-2.011711597442627, -242.76055908203125, 63.43870162963867],
  [-3.4460277557373047, -181.96212768554688, 63.43870162963867],
  [-4.439805030822754, -121.14503479003906, 63.43870162963867],
  [-5.029785633087158, -60.314151763916016, 63.43870162963867],
  [-5.215847015380859, 0.5138339996337891, 63.43870162963867],
  [-5.401749610900879, 61.07570266723633, 63.43870162963867],
])
const STATION_CENTERS_GLTF = STATION_CENTERS_BLENDER.map(([x, y, z]) => [x, z, -y])
const IDENTITY_MATRIX = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])

function sourceNames() {
  const names = []
  for (let value = 134; value <= 168; value += 1) names.push(`Stuhl_Tisch_Rechts_Reihe_${value}`)
  names.push('Stuhl_Tisch_Rechts_Reihe_171')
  names.push('Stuhl_Tisch_Rechts_Reihe_172')
  names.push('Stuhl_Tisch_Rechts_Reihe_172.001')
  for (let value = 173; value <= 211; value += 1) names.push(`Stuhl_Tisch_Rechts_Reihe_${value}`)
  names.push('Stuhl_Tisch_Rechts_Reihe_211.001')
  assert.equal(names.length, EXPECTED.sourceCount)
  return names
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

const stableStringify = (value) => JSON.stringify(stableValue(value))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function typedArraySha256(array) {
  return sha256(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
}

function accessorRecord(accessor) {
  assert.ok(accessor?.getArray(), 'accessor has no decoded array')
  return {
    type: accessor.getType(),
    componentType: accessor.getComponentType(),
    normalized: accessor.getNormalized(),
    count: accessor.getCount(),
    byteLength: accessor.getArray().byteLength,
    sha256: typedArraySha256(accessor.getArray()),
    min: accessor.getMin([]),
    max: accessor.getMax([]),
  }
}

function assertPinnedAccessor(actual, expected, label) {
  for (const key of ['count', 'componentType', 'normalized', 'sha256']) {
    if (Object.hasOwn(expected, key)) assert.equal(actual[key], expected[key], `${label}: ${key} pin changed`)
  }
  if (expected.type) assert.equal(actual.type, expected.type, `${label}: type pin changed`)
}

function materialRecord(material) {
  assert.ok(material, 'primitive has no material')
  const specular = material.getExtension('KHR_materials_specular')
  const textureName = (texture) => texture?.getName() || null
  return {
    name: material.getName(),
    baseColorFactor: material.getBaseColorFactor(),
    emissiveFactor: material.getEmissiveFactor(),
    metallicFactor: material.getMetallicFactor(),
    roughnessFactor: material.getRoughnessFactor(),
    alphaMode: material.getAlphaMode(),
    alphaCutoff: material.getAlphaCutoff(),
    doubleSided: material.getDoubleSided(),
    extensions: material.listExtensions().map((extension) => extension.extensionName).sort(),
    specular: specular ? {
      factor: specular.getSpecularFactor(),
      colorFactor: specular.getSpecularColorFactor(),
      texture: textureName(specular.getSpecularTexture()),
      colorTexture: textureName(specular.getSpecularColorTexture()),
    } : null,
    textures: {
      baseColor: textureName(material.getBaseColorTexture()),
      metallicRoughness: textureName(material.getMetallicRoughnessTexture()),
      normal: textureName(material.getNormalTexture()),
      occlusion: textureName(material.getOcclusionTexture()),
      emissive: textureName(material.getEmissiveTexture()),
    },
  }
}

function activeScenePaths(root) {
  const scenes = root.listScenes()
  const active = root.getDefaultScene() ?? scenes[0]
  assert.ok(active, 'production GLB has no active scene')
  const sceneIndex = scenes.indexOf(active)
  assert.equal(sceneIndex, 0, 'active production scene index changed')
  const paths = new Map()
  const visit = (node, path) => {
    assert.ok(!paths.has(node), `active scene references a node twice at ${path}`)
    paths.set(node, path)
    node.listChildren().forEach((child, index) => visit(child, `${path}/${index}`))
  }
  active.listChildren().forEach((node, index) => visit(node, `scene/${sceneIndex}/${index}`))
  return paths
}

function triangleCount(primitive) {
  assert.equal(primitive.getMode(), 4, 'repeat primitive is not TRIANGLES')
  const indices = primitive.getIndices()
  assert.ok(indices, 'repeat primitive is unindexed')
  assert.equal(indices.getCount() % 3, 0, 'repeat index count is not divisible by three')
  return indices.getCount() / 3
}

export function assertRepeatSixPartAccessorStorageContract(primitive, label = 'repeat primitive') {
  const position = primitive.getAttribute('POSITION')
  const normal = primitive.getAttribute('NORMAL')
  const indices = primitive.getIndices()
  assert.ok(position, `${label}: POSITION accessor missing`)
  assert.ok(normal, `${label}: NORMAL accessor missing`)
  assert.ok(indices, `${label}: index accessor missing`)
  assert.equal(position.getType(), 'VEC3', `${label}: POSITION type changed`)
  assert.equal(position.getComponentType(), 5126, `${label}: POSITION is no longer Float32`)
  assert.equal(position.getNormalized(), false, `${label}: POSITION unexpectedly normalized`)
  assert.equal(normal.getType(), 'VEC3', `${label}: NORMAL type changed`)
  assert.equal(normal.getComponentType(), 5122, `${label}: NORMAL is no longer Int16`)
  assert.equal(normal.getNormalized(), true, `${label}: NORMAL lost normalized storage contract`)
  assert.equal(indices.getType(), 'SCALAR', `${label}: index type changed`)
  assert.equal(indices.getComponentType(), 5123, `${label}: indices are no longer Uint16`)
  assert.equal(indices.getNormalized(), false, `${label}: indices unexpectedly normalized`)
}

function isIdentity(matrix) {
  return matrix.length === IDENTITY_MATRIX.length && matrix.every((value, index) => value === IDENTITY_MATRIX[index])
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

function instanceMatrices(instancing) {
  assert.deepEqual(instancing.listSemantics(), ['TRANSLATION', 'ROTATION', 'SCALE'])
  const translation = instancing.getAttribute('TRANSLATION')
  const rotation = instancing.getAttribute('ROTATION')
  const scale = instancing.getAttribute('SCALE')
  const count = translation.getCount()
  assert.equal(rotation.getCount(), count)
  assert.equal(scale.getCount(), count)
  const matrices = []
  for (let index = 0; index < count; index += 1) {
    const position = new Vector3(
      normalizedValue(translation, index * 3),
      normalizedValue(translation, index * 3 + 1),
      normalizedValue(translation, index * 3 + 2),
    )
    // Match the pinned Three.js GLTFLoader EXT_mesh_gpu_instancing path:
    // normalized integer components are decoded, then composed directly.
    // GLTFLoader does not renormalize the decoded quaternion here.
    const quaternion = new Quaternion(
      normalizedValue(rotation, index * 4),
      normalizedValue(rotation, index * 4 + 1),
      normalizedValue(rotation, index * 4 + 2),
      normalizedValue(rotation, index * 4 + 3),
    )
    const dimensions = new Vector3(
      normalizedValue(scale, index * 3),
      normalizedValue(scale, index * 3 + 1),
      normalizedValue(scale, index * 3 + 2),
    )
    matrices.push(new Matrix4().compose(position, quaternion, dimensions))
  }
  return matrices
}

function matrixMaxDelta(left, right) {
  let maximum = 0
  for (let index = 0; index < 16; index += 1) maximum = Math.max(maximum, Math.abs(left[index] - right[index]))
  return maximum
}

function matrixFloat64LEHex(values) {
  assert.equal(values.length, 16, 'matrix must contain 16 components')
  const bytes = Buffer.alloc(16 * 8)
  values.forEach((value, index) => {
    assert.ok(Number.isFinite(value), `matrix component ${index} is not finite`)
    bytes.writeDoubleLE(value, index * 8)
  })
  return bytes.toString('hex')
}

function bytesForElement(array, index) {
  return Buffer.from(array.buffer, array.byteOffset + index * array.BYTES_PER_ELEMENT, array.BYTES_PER_ELEMENT).toString('hex')
}

function cornerSignature(primitive, vertex) {
  const position = primitive.getAttribute('POSITION').getArray()
  const normal = primitive.getAttribute('NORMAL').getArray()
  const values = []
  for (let component = 0; component < 3; component += 1) values.push(bytesForElement(position, vertex * 3 + component))
  for (let component = 0; component < 3; component += 1) values.push(bytesForElement(normal, vertex * 3 + component))
  return values.join('')
}

function triangleSignature(primitive, slot, triangle) {
  const indices = primitive.getIndices().getArray()
  const corners = [0, 1, 2].map((offset) => cornerSignature(primitive, indices[triangle * 3 + offset]))
  const rotations = [
    `${corners[0]}/${corners[1]}/${corners[2]}`,
    `${corners[1]}/${corners[2]}/${corners[0]}`,
    `${corners[2]}/${corners[0]}/${corners[1]}`,
  ].sort()
  // Cyclic rotation is canonicalized, but reversal is deliberately not. A
  // winding change therefore changes this digest.
  return `${slot}:${rotations[0]}`
}

function geometryDigest(primitivesBySlot) {
  const records = []
  const trianglesByMaterial = {}
  for (const [slot, primitives] of primitivesBySlot.entries()) {
    const material = MATERIAL_SLOTS[slot].material
    let slotTriangles = 0
    for (const [primitiveIndex, primitive] of primitives.entries()) {
      assert.equal(primitive.getMaterial()?.getName(), material)
      assert.deepEqual(primitive.listSemantics(), ['POSITION', 'NORMAL'])
      assertRepeatSixPartAccessorStorageContract(primitive, `slot ${slot}/primitive ${primitiveIndex}`)
      const count = triangleCount(primitive)
      slotTriangles += count
      for (let triangle = 0; triangle < count; triangle += 1) {
        records.push(triangleSignature(primitive, slot, triangle))
      }
    }
    trianglesByMaterial[material] = slotTriangles
  }
  records.sort()
  return {
    triangles: records.length,
    trianglesByMaterial,
    sha256: sha256(Buffer.from(records.join('\n'))),
    accessorStorageContract: {
      position: { type: 'VEC3', componentType: 5126, normalized: false },
      normal: { type: 'VEC3', componentType: 5122, normalized: true },
      indices: { type: 'SCALAR', componentType: 5123, normalized: false },
    },
    contract: 'strict POSITION/NORMAL/index accessor metadata plus material slot, exact raw POSITION/NORMAL element bits, and oriented triangle winding; triangle order ignored',
  }
}

function nearestStation(z) {
  let station = 0
  let distance = Number.POSITIVE_INFINITY
  for (let index = 0; index < STATION_CENTERS_GLTF.length; index += 1) {
    const candidate = Math.abs(z - STATION_CENTERS_GLTF[index][2])
    if (candidate < distance) {
      station = index
      distance = candidate
    }
  }
  return station
}

function classifyTriangles(primitives) {
  const segmentIndices = Array.from({ length: EXPECTED.segmentCount }, () =>
    Array.from({ length: MATERIAL_SLOTS.length }, () => []))
  const stationTriangles = Array.from({ length: STATION_CENTERS_GLTF.length }, () => Array(MATERIAL_SLOTS.length).fill(0))
  for (let slot = 0; slot < primitives.length; slot += 1) {
    const primitive = primitives[slot]
    const positions = primitive.getAttribute('POSITION').getArray()
    const indices = primitive.getIndices().getArray()
    for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
      const vertices = [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]]
      const centroidZ = vertices.reduce((sum, vertex) => sum + positions[vertex * 3 + 2], 0) / 3
      const station = nearestStation(centroidZ)
      const segment = Math.floor(station / EXPECTED.stationsPerSegment)
      segmentIndices[segment][slot].push(...vertices)
      stationTriangles[station][slot] += 1
    }
  }
  return { segmentIndices, stationTriangles }
}

function primitiveReferencedBounds(primitive) {
  const positions = primitive.getAttribute('POSITION').getArray()
  const indices = primitive.getIndices().getArray()
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const vertex of indices) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[vertex * 3 + axis]
      min[axis] = Math.min(min[axis], value)
      max[axis] = Math.max(max[axis], value)
    }
  }
  return { min, max }
}

function unionBounds(boundsList) {
  const result = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  for (const bounds of boundsList) {
    for (let axis = 0; axis < 3; axis += 1) {
      result.min[axis] = Math.min(result.min[axis], bounds.min[axis])
      result.max[axis] = Math.max(result.max[axis], bounds.max[axis])
    }
  }
  return result
}

function targetProductionNodes(document) {
  const root = document.getRoot()
  const paths = activeScenePaths(root)
  const expectedTriangleSet = new Set(MATERIAL_SLOTS.map((entry) => entry.triangles))
  const physicalCandidates = root.listNodes().filter((node) => {
    const instancing = node.getExtension('EXT_mesh_gpu_instancing')
    const primitives = node.getMesh()?.listPrimitives() ?? []
    return instancing?.listAttributes()[0]?.getCount() === EXPECTED.sourceCount &&
      primitives.length === 1 && expectedTriangleSet.has(triangleCount(primitives[0]))
  })
  assert.equal(physicalCandidates.length, MATERIAL_SLOTS.length, 'production repeat physical candidate count changed')

  const byPath = new Map(physicalCandidates.map((node) => [paths.get(node), node]))
  return MATERIAL_SLOTS.map((pin) => {
    const node = byPath.get(pin.activeScenePath)
    assert.ok(node, `missing production repeat node ${pin.activeScenePath}`)
    assert.equal(node.getName(), '', `${pin.activeScenePath}: production node unexpectedly gained a name`)
    assert.equal(node.getParentNode(), null, `${pin.activeScenePath}: production node is no longer a scene root`)
    assert.ok(isIdentity(node.getMatrix()), `${pin.activeScenePath}: local host matrix changed`)
    assert.ok(isIdentity(node.getWorldMatrix()), `${pin.activeScenePath}: world host matrix changed`)
    const animationChannels = root.listAnimations().flatMap((animation) =>
      animation.listChannels().filter((channel) => channel.getTargetNode() === node))
    assert.equal(animationChannels.length, 0, `${pin.activeScenePath}: production repeat root unexpectedly became animated`)
    const primitive = node.getMesh().listPrimitives()[0]
    assert.equal(primitive.getMaterial()?.getName(), pin.material, `${pin.activeScenePath}: material changed`)
    assert.equal(triangleCount(primitive), pin.triangles, `${pin.activeScenePath}: triangle count changed`)
    assert.deepEqual(primitive.listSemantics(), ['POSITION', 'NORMAL'], `${pin.activeScenePath}: semantics changed`)
    assertPinnedAccessor(accessorRecord(primitive.getAttribute('POSITION')), pin.position, `${pin.activeScenePath}:POSITION`)
    assertPinnedAccessor(accessorRecord(primitive.getAttribute('NORMAL')), pin.normal, `${pin.activeScenePath}:NORMAL`)
    assertPinnedAccessor(accessorRecord(primitive.getIndices()), pin.indices, `${pin.activeScenePath}:indices`)

    const instancing = node.getExtension('EXT_mesh_gpu_instancing')
    assert.ok(instancing, `${pin.activeScenePath}: EXT_mesh_gpu_instancing missing`)
    assert.deepEqual(instancing.listSemantics(), ['TRANSLATION', 'ROTATION', 'SCALE'])
    for (const semantic of instancing.listSemantics()) {
      assertPinnedAccessor(accessorRecord(instancing.getAttribute(semantic)), INSTANCE_ATTRIBUTE_PINS[semantic], `${pin.activeScenePath}:${semantic}`)
    }
    return node
  })
}

async function verifyCurrentMappingReference(productionMatrices) {
  const bytes = await readFile(CURRENT_MAPPING_REFERENCE)
  assert.equal(bytes.length, CURRENT_MAPPING_PROOF.referenceBytes, 'current mapping reference byte pin changed')
  assert.equal(sha256(bytes), CURRENT_MAPPING_PROOF.referenceSha256, 'current mapping reference SHA-256 changed')
  const reference = JSON.parse(bytes)
  const names = sourceNames()
  const paths = names.map((name) => `Ground Floor._anim1/Ground Floor.BT_3/${name}`)
  const rows = [...reference.instances].sort((left, right) => left.sourceIndex - right.sourceIndex)
  assert.deepEqual(rows.map((row) => row.sourceIndex), Array.from({ length: EXPECTED.sourceCount }, (_, index) => index))
  assert.deepEqual(rows.map((row) => row.sourceName), names)
  assert.deepEqual(rows.map((row) => row.sourcePath), paths)

  let maximumPairedTranslationDelta = 0
  let minimumNearestNeighborMargin = Number.POSITIVE_INFINITY
  let maximumMatrixComponentDelta = 0
  let nearestNeighborMismatches = 0
  const nearestIndices = []
  for (let sourceIndex = 0; sourceIndex < productionMatrices.length; sourceIndex += 1) {
    const production = productionMatrices[sourceIndex].toArray()
    const distances = rows.map((row, candidateIndex) => {
      const clean = row.ownerLocalMatrix
      return {
        candidateIndex,
        distance: Math.hypot(production[12] - clean[12], production[13] - clean[13], production[14] - clean[14]),
      }
    }).sort((left, right) => left.distance - right.distance || left.candidateIndex - right.candidateIndex)
    nearestIndices.push(distances[0].candidateIndex)
    if (distances[0].candidateIndex !== sourceIndex) nearestNeighborMismatches += 1
    maximumPairedTranslationDelta = Math.max(maximumPairedTranslationDelta, distances.find((entry) => entry.candidateIndex === sourceIndex).distance)
    minimumNearestNeighborMargin = Math.min(minimumNearestNeighborMargin, distances[1].distance - distances[0].distance)
    maximumMatrixComponentDelta = Math.max(maximumMatrixComponentDelta, matrixMaxDelta(production, rows[sourceIndex].ownerLocalMatrix))
  }
  assert.equal(nearestNeighborMismatches, 0, 'production TRS order no longer matches the historical logical source order')
  assert.deepEqual(nearestIndices, Array.from({ length: EXPECTED.sourceCount }, (_, index) => index), 'nearest-neighbor mapping is not an identity-order bijection')
  assert.equal(new Set(nearestIndices).size, EXPECTED.sourceCount, 'nearest-neighbor mapping is not bijective')
  const result = { maximumPairedTranslationDelta, minimumNearestNeighborMargin, maximumMatrixComponentDelta, nearestNeighborMismatches }
  assert.deepEqual(result, {
    maximumPairedTranslationDelta: CURRENT_MAPPING_PROOF.maximumPairedTranslationDelta,
    minimumNearestNeighborMargin: CURRENT_MAPPING_PROOF.minimumNearestNeighborMargin,
    maximumMatrixComponentDelta: CURRENT_MAPPING_PROOF.maximumMatrixComponentDelta,
    nearestNeighborMismatches: CURRENT_MAPPING_PROOF.nearestNeighborMismatches,
  }, 'historical logical-order verification metrics changed')
  return result
}

function sourceInstances(matrices, approvedMappingRows) {
  assert.equal(approvedMappingRows.length, EXPECTED.sourceCount, 'approved logical mapping row count changed')
  assert.deepEqual(approvedMappingRows.map((row) => row.sourceId), matrices.map((_, sourceIndex) => sourceIndex), 'approved logical source ID/order changed')
  assert.deepEqual(approvedMappingRows.map((row) => row.productionInstanceIndex), matrices.map((_, sourceIndex) => sourceIndex), 'approved production instance order changed')
  assert.equal(sha256(Buffer.from(stableStringify(approvedMappingRows.map((row) => row.sourceId)))), EXPECTED.sourceIdsSha256)
  assert.equal(sha256(Buffer.from(stableStringify(approvedMappingRows.map((row) => row.sourcePath)))), EXPECTED.sourcePathsSha256)
  return approvedMappingRows.map((row) => {
    const sourceIndex = row.sourceId
    const matrix = matrices[row.productionInstanceIndex]
    const ownerLocalMatrix = matrix.toArray()
    const parity = matrix.determinant() > 0 ? 'positive' : 'mirrored'
    assert.equal(row.parity, parity, `approved logical mapping parity changed for source ${sourceIndex}`)
    return {
      sourceIndex,
      productionInstanceIndex: row.productionInstanceIndex,
      sourceName: row.sourcePath.split('/').at(-1),
      sourcePath: row.sourcePath,
      parity,
      determinant: matrix.determinant(),
      ownerLocalMatrixFloat64LEHex: matrixFloat64LEHex(ownerLocalMatrix),
    }
  })
}

async function buildGeometry(sourceDocument, sourceNodes, outputPath) {
  const target = new Document().setLogger(sourceDocument.getLogger())
  const sourceMeshes = sourceNodes.map((node) => node.getMesh())
  const sourceExtensionOwners = new Map(sourceDocument.getRoot().listExtensionsUsed()
    .map((extension) => [extension.extensionName, extension]))
  const requiredExtensionNames = new Set()
  for (const mesh of sourceMeshes) {
    for (const primitive of mesh.listPrimitives()) {
      for (const extension of primitive.listExtensions()) requiredExtensionNames.add(extension.extensionName)
      for (const extension of primitive.getMaterial()?.listExtensions() ?? []) requiredExtensionNames.add(extension.extensionName)
    }
  }
  for (const extensionName of [...requiredExtensionNames].sort()) {
    const sourceExtension = sourceExtensionOwners.get(extensionName)
    assert.ok(sourceExtension, `source extension owner missing for ${extensionName}`)
    target.createExtension(sourceExtension.constructor).setRequired(sourceExtension.isRequired())
  }
  const resolver = createDefaultPropertyResolver(target, sourceDocument)
  const propertyMap = copyToDocument(target, sourceDocument, sourceMeshes, resolver)
  const copiedMeshes = sourceMeshes.map((mesh) => propertyMap.get(mesh))
  assert.ok(copiedMeshes.every(Boolean), 'failed to copy production repeat meshes')
  const copiedPrimitives = copiedMeshes.map((mesh) => mesh.listPrimitives()[0])
  const { segmentIndices, stationTriangles } = classifyTriangles(copiedPrimitives)
  const buffer = target.getRoot().listBuffers()[0] ?? target.createBuffer('production exact six-part source')
  const scene = target.createScene('DISABLED: exact six-part production source')
  const segments = []

  for (let segment = 0; segment < EXPECTED.segmentCount; segment += 1) {
    const mesh = target.createMesh(`IOM production exact segment ${segment}`)
    const primitiveRecords = []
    for (let slot = 0; slot < MATERIAL_SLOTS.length; slot += 1) {
      const sourcePrimitive = copiedPrimitives[slot]
      const values = segmentIndices[segment][slot]
      assert.ok(values.length > 0, `segment ${segment}/material ${slot} is empty`)
      assert.ok(Math.max(...values) <= 65_535, `segment ${segment}/material ${slot} exceeds Uint16 source index range`)
      const indices = target.createAccessor(`production-segment-${segment}-material-${slot}-indices`)
        .setType('SCALAR')
        .setArray(Uint16Array.from(values))
        .setBuffer(buffer)
      const primitive = target.createPrimitive()
        .setMode(4)
        .setIndices(indices)
        .setMaterial(sourcePrimitive.getMaterial())
      for (const semantic of sourcePrimitive.listSemantics()) {
        primitive.setAttribute(semantic, sourcePrimitive.getAttribute(semantic))
      }
      mesh.addPrimitive(primitive)
      primitiveRecords.push(primitive)
    }
    const node = target.createNode(`segment-${String(segment).padStart(2, '0')}-seats-${String(segment * 3).padStart(2, '0')}-${String(segment * 3 + 2).padStart(2, '0')}`)
      .setMesh(mesh)
      .setExtras({
        disabledPilot: true,
        runtimeIntegrated: false,
        exactProductionPartition: true,
        segment,
        stations: [segment * 3, segment * 3 + 1, segment * 3 + 2],
        geometrySpace: 'production-instancing-local',
      })
    scene.addChild(node)
    const trianglesByMaterial = Object.fromEntries(primitiveRecords.map((primitive, slot) => [MATERIAL_SLOTS[slot].material, triangleCount(primitive)]))
    segments.push({
      segment,
      stations: node.getExtras().stations,
      triangles: Object.values(trianglesByMaterial).reduce((sum, value) => sum + value, 0),
      trianglesByMaterial,
      localBounds: unionBounds(primitiveRecords.map(primitiveReferencedBounds)),
    })
  }

  // The copied meshes are scaffolding only. Segment primitives retain the
  // copied immutable accessors/materials before these unused meshes are freed.
  for (const mesh of copiedMeshes) mesh.dispose()
  await (await createGltfIO({ encoder: true })).write(outputPath, target)
  return { stationTriangles, segments }
}

function sourcePrimitiveAudit(sourceNodes) {
  return sourceNodes.map((node, slot) => {
    const primitive = node.getMesh().listPrimitives()[0]
    const instancing = node.getExtension('EXT_mesh_gpu_instancing')
    return {
      slot,
      activeScenePath: MATERIAL_SLOTS[slot].activeScenePath,
      nodeName: node.getName(),
      nodeMatrix: node.getMatrix(),
      material: materialRecord(primitive.getMaterial()),
      materialSha256: sha256(Buffer.from(stableStringify(materialRecord(primitive.getMaterial())))),
      triangles: triangleCount(primitive),
      semantics: primitive.listSemantics(),
      position: accessorRecord(primitive.getAttribute('POSITION')),
      normal: accessorRecord(primitive.getAttribute('NORMAL')),
      indices: accessorRecord(primitive.getIndices()),
      instancing: Object.fromEntries(instancing.listSemantics().map((semantic) => [semantic, accessorRecord(instancing.getAttribute(semantic))])),
    }
  })
}

function outputPrimitivesBySlot(document) {
  const result = Array.from({ length: MATERIAL_SLOTS.length }, () => [])
  const nodes = document.getRoot().listNodes().filter((node) => node.getMesh())
  assert.equal(nodes.length, EXPECTED.segmentCount, 'written exact source segment-node count changed')
  for (const node of nodes) {
    assert.ok(isIdentity(node.getMatrix()), `${node.getName()}: segment transform is not identity`)
    assert.equal(node.getMesh().listPrimitives().length, MATERIAL_SLOTS.length)
    node.getMesh().listPrimitives().forEach((primitive, slot) => result[slot].push(primitive))
  }
  return result
}

function outputSegmentGeometryAudit(document) {
  const nodes = document.getRoot().listNodes()
    .filter((node) => node.getMesh())
    .sort((left, right) => left.getExtras().segment - right.getExtras().segment)
  assert.equal(nodes.length, EXPECTED.segmentCount, 'written exact source segment-node count changed')
  return nodes.map((node, segment) => {
    assert.equal(node.getExtras().segment, segment, `written segment ${segment} identity changed`)
    const digest = geometryDigest(node.getMesh().listPrimitives().map((primitive) => [primitive]))
    return {
      segment,
      triangles: digest.triangles,
      trianglesByMaterial: digest.trianglesByMaterial,
      canonicalOrientedGeometrySha256: digest.sha256,
      contract: 'segment identity plus strict accessor metadata, material slot, raw POSITION/NORMAL bits, and oriented winding',
    }
  })
}

function outputMaterialAudit(primitivesBySlot) {
  return primitivesBySlot.map((primitives, slot) => {
    const records = primitives.map((primitive) => materialRecord(primitive.getMaterial()))
    assert.ok(records.every((record) => stableStringify(record) === stableStringify(records[0])), `output slot ${slot}: material drift between segments`)
    return records[0]
  })
}

function reportMarkdown(audit) {
  const segmentRows = audit.segmentation.segments.map((segment) =>
    `| ${segment.segment} | ${segment.stations.join(', ')} | ${segment.triangles.toLocaleString('en-US')} | ${MATERIAL_SLOTS.map((slot) => segment.trianglesByMaterial[slot.material].toLocaleString('en-US')).join(' / ')} |`).join('\n')
  return `# Direct-production exact six-part source pilot\n\n` +
    `Status: **PASS, disabled and not runtime-integrated**. Production/public assets were not modified.\n\n` +
    `The exact six-part row source was rebuilt directly from the pinned production Web GLB (${audit.sourceModel.bytes.toLocaleString('en-US')} bytes, SHA-256 \`${audit.sourceModel.sha256}\`). It no longer requires the ignored 347 MB cleaned GLB or the ignored near-source GLB.\n\n` +
    `## Physical source proof\n\n` +
    `The only four active-scene nodes matching the full signature are \`${MATERIAL_SLOTS.map((slot) => slot.activeScenePath).join('`, `')}\`. They are unnamed identity roots with one primitive and 78 identical \`EXT_mesh_gpu_instancing\` TRS rows. Their material triangle counts are ${MATERIAL_SLOTS.map((slot) => `\`${slot.material}\`: ${slot.triangles.toLocaleString('en-US')}`).join(', ')}.\n\n` +
    `The four raw TRS attribute hashes and the composed transform digest agree. The authoritative production rows contain ${audit.transforms.positive} positive and ${audit.transforms.mirrored} mirrored transforms. Every composed matrix is stored as 16 little-endian IEEE-754 Float64 components encoded in hexadecimal, preserving all loader-produced bits including signed zero. Fixed logical source IDs 0..77 are read from the pinned, project-owner-approved mapping certificate in the order \`Stuhl_Tisch_Rechts_Reihe_134..168, 171, 172, 172.001, 173..211, 211.001\` under \`Ground Floor._anim1/Ground Floor.BT_3\`. The clean build independently decodes the production GLB and revalidates the certificate's reciprocal mapping, parity, distance, separation, and immutable pins. This approval establishes logical ownership only; runtime and activation remain blocked.\n\n` +
    `## Exact recomposition\n\n` +
    `The production-decoded source and written six-segment GLB both contain ${audit.geometry.source.triangles.toLocaleString('en-US')} triangles and share canonical oriented geometry/material SHA-256 \`${audit.geometry.source.sha256}\`. The digest includes material slot, raw decoded POSITION bits, raw decoded normalized-NORMAL storage bits, and oriented triangle winding. Six separately pinned per-segment oriented digests prevent triangle reassignment between selection segments. Triangle submission order within a segment is intentionally ignored.\n\n` +
    `| Segment | Stations | Triangles | Plastik / Plakete / Metall / Bezug |\n` +
    `|---:|---|---:|---|\n${segmentRows}\n\n` +
    `## Outputs\n\n` +
    `- Geometry: \`${CANONICAL_OUTPUT_ROOT}/${OUTPUT_NAMES.geometry}\` (${audit.outputs.geometry.bytes.toLocaleString('en-US')} bytes, SHA-256 \`${audit.outputs.geometry.sha256}\`)\n` +
    `- Production-authoritative physical transforms with pinned historical logical labels: \`${CANONICAL_OUTPUT_ROOT}/${OUTPUT_NAMES.sourceMap}\` (${audit.outputs.sourceMap.bytes.toLocaleString('en-US')} bytes, SHA-256 \`${audit.outputs.sourceMap.sha256}\`)\n` +
    `- Runtime/manifest activation: **false**\n` +
    `- Deployment/public model changes: **none**\n`
}

export async function buildRepeatSixPartProductionSourcePilot({
  productionModel = DEFAULT_PRODUCTION_MODEL,
  outputRoot = DEFAULT_OUTPUT_ROOT,
  verifyCurrentMapping = false,
} = {}) {
  const resolvedModel = resolve(productionModel)
  const resolvedOutputRoot = resolve(outputRoot)
  await mkdir(resolvedOutputRoot, { recursive: true })
  const outputPaths = Object.fromEntries(Object.entries(OUTPUT_NAMES).map(([key, name]) => [key, resolve(resolvedOutputRoot, name)]))

  const logicalMapping = await validateTrackedLogicalMappingCertificate()
  assert.equal(logicalMapping.evidenceValidated, true, 'logical mapping certificate evidence did not validate')
  assert.equal(logicalMapping.technicalMappingPassed, true, 'logical mapping certificate technical mapping failed')
  assert.equal(logicalMapping.provenanceApproved, true, 'logical mapping certificate lacks project-owner provenance approval')
  assert.equal(logicalMapping.logicalOwnershipMappingPassed, true, 'logical ownership mapping remains unapproved')
  assert.equal(logicalMapping.activationBlocked, true, 'logical mapping approval must not imply activation approval')
  const logicalMappingCertificate = {
    schema: LOGICAL_MAPPING_SCHEMA,
    version: LOGICAL_MAPPING_VERSION,
    relativePath: 'scripts/fixtures/icm-anim-2025-ground-floor-repeat-logical-mapping-v1.json',
    ...TRACKED_CERTIFICATE_PIN,
    status: logicalMapping.certificateStatus,
    approval: logicalMapping.approval,
    evidenceValidated: logicalMapping.evidenceValidated,
    technicalMappingPassed: logicalMapping.technicalMappingPassed,
    provenanceApproved: logicalMapping.provenanceApproved,
    logicalOwnershipMappingPassed: logicalMapping.logicalOwnershipMappingPassed,
    activationBlocked: logicalMapping.activationBlocked,
    sourceCount: logicalMapping.sourceCount,
    productionTransformSetSha256: logicalMapping.productionTransformSetSha256,
    metrics: logicalMapping.metrics,
    hardPolicy: logicalMapping.hardPolicy,
  }

  const modelBytes = await readFile(resolvedModel)
  assert.equal(modelBytes.length, MODEL_PIN.bytes, 'production Web GLB byte pin changed')
  assert.equal(sha256(modelBytes), MODEL_PIN.sha256, 'production Web GLB SHA-256 pin changed')
  const io = await createGltfIO()
  const sourceDocument = await io.read(resolvedModel)
  const sourceNodes = targetProductionNodes(sourceDocument)
  const groundOwners = sourceDocument.getRoot().listNodes().filter((node) => node.getName() === 'Ground Floor._anim1')
  assert.equal(groundOwners.length, 1, 'production Ground Floor owner count changed')
  const groundOwner = groundOwners[0]
  assert.equal(groundOwner.getParentNode(), null, 'production Ground Floor owner is no longer a scene root')
  assert.ok(isIdentity(groundOwner.getMatrix()), 'production Ground Floor owner rest matrix changed')
  assert.ok(isIdentity(groundOwner.getWorldMatrix()), 'production Ground Floor owner world-rest matrix changed')
  const groundOwnerAnimationChannels = sourceDocument.getRoot().listAnimations().flatMap((animation) =>
    animation.listChannels().filter((channel) => channel.getTargetNode() === groundOwner))
  assert.equal(groundOwnerAnimationChannels.length, 0, 'production Ground Floor owner unexpectedly became animated')
  const groundOwnerPath = activeScenePaths(sourceDocument.getRoot()).get(groundOwner)
  assert.ok(groundOwnerPath, 'production Ground Floor owner is outside the active scene')
  const sourcePrimitives = sourceNodes.map((node) => node.getMesh().listPrimitives()[0])
  const sourceAudit = sourcePrimitiveAudit(sourceNodes)
  assert.deepEqual(sourceAudit.map((entry) => entry.materialSha256), DERIVED_PINS.materialSha256,
    'production material physical signatures changed')
  const sourceGeometry = geometryDigest(sourcePrimitives.map((primitive) => [primitive]))
  assert.equal(sourceGeometry.triangles, EXPECTED.triangles)
  assert.equal(sourceGeometry.sha256, DERIVED_PINS.productionGeometryDigest, 'production geometry digest changed')
  assert.deepEqual(sourceGeometry.trianglesByMaterial, Object.fromEntries(MATERIAL_SLOTS.map((slot) => [slot.material, slot.triangles])))

  const matricesBySlot = sourceNodes.map((node) => instanceMatrices(node.getExtension('EXT_mesh_gpu_instancing')))
  for (let slot = 1; slot < matricesBySlot.length; slot += 1) {
    assert.deepEqual(
      matricesBySlot[slot].map((matrix) => matrixFloat64LEHex(matrix.toArray())),
      matricesBySlot[0].map((matrix) => matrixFloat64LEHex(matrix.toArray())),
      `production material slot ${slot} transform order differs`,
    )
  }
  const matrices = matricesBySlot[0]
  const productionHost = new Matrix4().fromArray(sourceNodes[0].getWorldMatrix())
  const hostTimesLocalMaximumDelta = Math.max(...matrices.map((matrix) => matrixMaxDelta(
    new Matrix4().multiplyMatrices(productionHost, matrix).toArray(),
    matrix.toArray(),
  )))
  assert.equal(hostTimesLocalMaximumDelta, 0, 'identity production host changed composed instance transforms')
  const instances = sourceInstances(matrices, logicalMapping.approvedMappingRows)
  assert.equal(instances.filter((instance) => instance.parity === 'positive').length, EXPECTED.positiveTransforms)
  assert.equal(instances.filter((instance) => instance.parity === 'mirrored').length, EXPECTED.mirroredTransforms)
  const transformSetSha256 = sha256(Buffer.from(stableStringify(instances.map((instance) => ({
    sourceIndex: instance.sourceIndex,
    name: instance.sourceName,
    matrixFloat64LEHex: instance.ownerLocalMatrixFloat64LEHex,
  })))))
  assert.equal(transformSetSha256, DERIVED_PINS.productionTransformSetSha256, 'production transform set/order digest changed')

  let verifiedReference = null
  if (verifyCurrentMapping) {
    verifiedReference = await verifyCurrentMappingReference(matrices)
    const localEvidence = {
      schema: 'IOM_REPEAT_SIX_PART_CURRENT_MAPPING_LOCAL_VERIFICATION',
      version: 1,
      status: 'PASS',
      sourceModel: MODEL_PIN,
      reference: {
        path: CURRENT_MAPPING_PROOF.referencePath,
        bytes: CURRENT_MAPPING_PROOF.referenceBytes,
        sha256: CURRENT_MAPPING_PROOF.referenceSha256,
      },
      fixedLogicalOrder: 'source IDs 0..77 in the pinned source-name/path order',
      productionTransformsAuthoritative: true,
      ...verifiedReference,
    }
    await writeFile(resolve(resolvedOutputRoot, 'current-mapping-verification.local.json'), `${JSON.stringify(localEvidence, null, 2)}\n`)
  }

  const built = await buildGeometry(sourceDocument, sourceNodes, outputPaths.geometry)
  const geometryBytes = await readFile(outputPaths.geometry)
  const writtenDocument = await io.read(outputPaths.geometry)
  const writtenBySlot = outputPrimitivesBySlot(writtenDocument)
  const writtenGeometry = geometryDigest(writtenBySlot)
  const writtenSegmentGeometry = outputSegmentGeometryAudit(writtenDocument)
  assert.deepEqual(
    writtenSegmentGeometry.map((segment) => segment.canonicalOrientedGeometrySha256),
    EXPECTED.segmentGeometrySha256,
    'production triangle-to-segment oriented digest changed',
  )
  assert.deepEqual(writtenGeometry, sourceGeometry, 'six-part output is not an exact oriented production recomposition')
  const sourceMaterials = sourcePrimitives.map((primitive) => materialRecord(primitive.getMaterial()))
  assert.deepEqual(outputMaterialAudit(writtenBySlot), sourceMaterials, 'written production materials changed')
  assert.equal(built.segments.reduce((sum, segment) => sum + segment.triangles, 0), EXPECTED.triangles)
  assert.deepEqual(
    built.segments.map((segment) => MATERIAL_SLOTS.map((slot) => segment.trianglesByMaterial[slot.material])),
    DERIVED_PINS.segments,
    'production triangle-to-segment partition changed',
  )
  assert.deepEqual(
    writtenSegmentGeometry.map((segment) => segment.triangles),
    built.segments.map((segment) => segment.triangles),
    'written per-segment triangle totals changed',
  )
  built.segments = built.segments.map((segment, index) => ({
    ...segment,
    canonicalOrientedGeometrySha256: writtenSegmentGeometry[index].canonicalOrientedGeometrySha256,
  }))

  const sourceMap = {
    schema: 'IOM_REPEAT_SIX_PART_PRODUCTION_SOURCE_MAP',
    version: 1,
    disabled: true,
    runtimeIntegrated: false,
    sourceModel: MODEL_PIN,
    owner: { nodeName: 'Ground Floor._anim1', descendantPath: 'Ground Floor.BT_3', attachmentSpace: 'owner-local' },
    productionInstancingNodes: MATERIAL_SLOTS.map((slot) => slot.activeScenePath),
    transformCompositionOrder: 'productionNodeWorldMatrix * EXT_mesh_gpu_instancing(TRS)',
    instanceTrsDecodeContract: {
      normalizedIntegerComponentsDecoded: true,
      rotationQuaternionRenormalized: false,
      runtimeReference: 'pinned Three.js GLTFLoader EXT_mesh_gpu_instancing composition',
      authoritativeMatrixEncoding: '16 IEEE-754 Float64 components encoded little-endian as ownerLocalMatrixFloat64LEHex',
      jsonNumericMatrixAuthoritative: false,
    },
    productionNodeWorldMatrix: IDENTITY_MATRIX,
    logicalMappingCertificate,
    transformSetSha256,
    sourceIdsSha256: EXPECTED.sourceIdsSha256,
    sourcePathsSha256: EXPECTED.sourcePathsSha256,
    instances,
  }
  const sourceMapText = `${JSON.stringify(sourceMap, null, 2)}\n`
  await writeFile(outputPaths.sourceMap, sourceMapText)
  const sourceMapBytes = Buffer.from(sourceMapText)
  assert.equal(sourceMapBytes.length, DERIVED_PINS.sourceMapOutput.bytes, 'production source-map byte pin changed')
  assert.equal(sha256(sourceMapBytes), DERIVED_PINS.sourceMapOutput.sha256, 'production source-map SHA-256 pin changed')
  assert.equal(geometryBytes.length, DERIVED_PINS.geometryOutput.bytes, 'exact production geometry output byte pin changed')
  assert.equal(sha256(geometryBytes), DERIVED_PINS.geometryOutput.sha256, 'exact production geometry output SHA-256 pin changed')

  const physicalAudit = {
    schema: 'IOM_REPEAT_SIX_PART_PRODUCTION_SOURCE_PHYSICAL_AUDIT',
    version: 1,
    status: 'PASS',
    disabled: true,
    runtimeIntegrated: false,
    productionChanged: false,
    sourceModel: MODEL_PIN,
    identification: {
      method: 'active scene path plus model pin, identity root, material, triangle count, decoded accessor signature, and identical 78-row TRS signature',
      physicalCandidateCount: sourceNodes.length,
      intendedOwnerRestBasis: {
        nodeName: groundOwner.getName(),
        activeScenePath: groundOwnerPath,
        sceneRoot: true,
        identityRestMatrix: true,
        animationChannels: groundOwnerAnimationChannels.length,
      },
      nodes: sourceAudit,
    },
    historicalLogicalOrderContract: {
      status: 'APPROVED_TRACKED_CERTIFICATE_REVERIFIED_BY_CLEAN_BUILD',
      reference: {
        path: CURRENT_MAPPING_PROOF.referencePath,
        bytes: CURRENT_MAPPING_PROOF.referenceBytes,
        sha256: CURRENT_MAPPING_PROOF.referenceSha256,
      },
      sourceIdsSha256: EXPECTED.sourceIdsSha256,
      sourcePathsSha256: EXPECTED.sourcePathsSha256,
      optionalVerificationCommand: 'node scripts/build-repeat-six-part-production-source-pilot.mjs --verify-current-mapping',
      localEvidencePathWhenRequested: `${CANONICAL_OUTPUT_ROOT}/current-mapping-verification.local.json`,
    },
    logicalMappingCertificate,
    transforms: {
      authoritativeSource: 'pinned production EXT_mesh_gpu_instancing decoded TRS using loader-equivalent raw quaternion composition',
      instanceTrsDecodeContract: sourceMap.instanceTrsDecodeContract,
      signedZeroBitsPreserved: true,
      sourceCount: instances.length,
      positive: instances.filter((instance) => instance.parity === 'positive').length,
      mirrored: instances.filter((instance) => instance.parity === 'mirrored').length,
      materialBatchCount: matricesBySlot.length,
      materialBatchOrderIdentical: true,
      compositionOrder: sourceMap.transformCompositionOrder,
      identityHostMakesComposedAndLocalMatricesEqual: true,
      hostTimesLocalMaximumDelta,
      transformSetSha256,
    },
    geometry: {
      source: sourceGeometry,
      written: writtenGeometry,
      exactTriangleBijection: true,
      materialAssignmentsPreserved: true,
      strictAccessorMetadataPreserved: true,
      exactPerSegmentAssignmentPreserved: true,
      segmentDigests: writtenSegmentGeometry,
      positionBitsPreserved: true,
      normalStorageBitsAndNormalizationPreserved: true,
      orientedWindingPreserved: true,
    },
    segmentation: {
      method: 'nearest pinned authored station by decoded triangle centroid Z; six contiguous groups of three stations',
      stationCentersBlenderLocal: STATION_CENTERS_BLENDER,
      stationCentersGltfLocal: STATION_CENTERS_GLTF,
      stationTrianglesByMaterial: built.stationTriangles.map((counts, station) => ({
        station,
        counts: Object.fromEntries(MATERIAL_SLOTS.map((slot, index) => [slot.material, counts[index]])),
      })),
      segments: built.segments,
    },
    excludedDependencies: [
      'tmp/icm-anim-2025-cleaned.glb',
      'tmp/repeat-lod-ground-floor/Mesh.13786-near-source.glb',
    ],
    outputs: {
      geometry: { path: `${CANONICAL_OUTPUT_ROOT}/${OUTPUT_NAMES.geometry}`, bytes: geometryBytes.length, sha256: sha256(geometryBytes) },
      sourceMap: { path: `${CANONICAL_OUTPUT_ROOT}/${OUTPUT_NAMES.sourceMap}`, bytes: sourceMapBytes.length, sha256: sha256(sourceMapBytes) },
    },
  }
  const auditText = `${JSON.stringify(physicalAudit, null, 2)}\n`
  assert.ok(!auditText.includes(resolvedModel) && !auditText.includes(resolvedOutputRoot), 'audit leaked a checkout-specific absolute path')
  await writeFile(outputPaths.audit, auditText)
  const markdown = reportMarkdown(physicalAudit)
  await writeFile(outputPaths.report, markdown)

  if (verifyCurrentMapping) {
    console.log(JSON.stringify({ currentMappingReference: 'PASS', ...verifiedReference }, null, 2))
  }
  console.log(JSON.stringify({
    status: 'PASS',
    sourceModel: MODEL_PIN,
    geometry: physicalAudit.outputs.geometry,
    sourceMap: physicalAudit.outputs.sourceMap,
    geometryDigest: sourceGeometry.sha256,
    transformSetSha256,
    segments: built.segments.map(({ segment, stations, triangles, trianglesByMaterial }) => ({ segment, stations, triangles, trianglesByMaterial })),
    disabled: true,
    productionChanged: false,
  }, null, 2))
  return {
    audit: physicalAudit,
    logicalMapping: logicalMappingCertificate,
    currentMappingReference: verifiedReference,
    paths: outputPaths,
    hashes: {
      geometry: physicalAudit.outputs.geometry.sha256,
      sourceMap: physicalAudit.outputs.sourceMap.sha256,
      audit: sha256(Buffer.from(auditText)),
      report: sha256(Buffer.from(markdown)),
    },
  }
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) {
  buildRepeatSixPartProductionSourcePilot({ verifyCurrentMapping: process.argv.includes('--verify-current-mapping') }).catch((error) => {
    console.error(error?.stack || error)
    process.exitCode = 1
  })
}
