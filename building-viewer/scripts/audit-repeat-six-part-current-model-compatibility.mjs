#!/usr/bin/env node

/**
 * Disabled, read-only compatibility audit for the repeat six-part candidate.
 *
 * The audit reads the current production Web GLB and the tracked logical
 * mapping certificate. It deliberately discovers the four instancing roots
 * from material, geometry, and accessor fingerprints rather than trusting the
 * certificate's now-stale active-scene ordinals. The only write is the
 * deterministic report beneath tmp/; this script cannot enable integration.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'

const HERE = resolve(import.meta.dirname)
const PROJECT_ROOT = resolve(HERE, '..')
const MODEL_PATH = resolve(PROJECT_ROOT, '../public/models/icm-anim-2025/model-web.glb')
const CERTIFICATE_PATH = resolve(HERE, 'fixtures/icm-anim-2025-ground-floor-repeat-logical-mapping-v1.json')
const REPORT_PATH = resolve(PROJECT_ROOT, 'tmp/repeat-six-part-current-model-compatibility/report.json')

const RELATIVE_MODEL_PATH = '../public/models/icm-anim-2025/model-web.glb'
const RELATIVE_CERTIFICATE_PATH = 'scripts/fixtures/icm-anim-2025-ground-floor-repeat-logical-mapping-v1.json'
const RELATIVE_REPORT_PATH = 'tmp/repeat-six-part-current-model-compatibility/report.json'
const SCHEMA = 'IOM_REPEAT_SIX_PART_CURRENT_MODEL_COMPATIBILITY_AUDIT_V1'
const CERTIFICATE_SCHEMA = 'IOM_REPEAT_SIX_PART_LOGICAL_MAPPING_CERTIFICATE_V1'
const INSTANCE_COUNT = 78
const OWNER_NAME = 'Ground Floor._anim1'
const EPSILON = 1e-12
const VALUE_EPSILON = 1e-7
const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
const TRACKED_CERTIFICATE_PIN = Object.freeze({
  bytes: 28_050,
  sha256: 'a802f11c3f9798168d8339c4c786036d36b7486c0c83a5fdad5931d5cff94b60',
})

// These are physical fingerprints, not scene paths. They identify the exact
// four material partitions even when unrelated scene-root ordinals move.
const ROOT_SIGNATURES = Object.freeze([
  Object.freeze({
    slot: 0,
    material: 'vray Stuhl_Plastik',
    triangles: 24_213,
    position: Object.freeze({ type: 'VEC3', count: 20_497, componentType: 5126, normalized: false, sha256: '7483938489d8e65fc7d42c1663219c315c0114b9f59372c538927f2a76322abe' }),
    normal: Object.freeze({ type: 'VEC3', count: 20_497, componentType: 5122, normalized: true, sha256: '2d3ca7d5a589c822c3083eeb67fe3cdcdc958822984dfb00eb863439a3123de4' }),
    indices: Object.freeze({ type: 'SCALAR', count: 72_639, componentType: 5123, normalized: false, sha256: '99e7fb827476375a9f566e765848bcb6e3ad92b3abfd3884f8e97dc36504e21f' }),
  }),
  Object.freeze({
    slot: 1,
    material: 'vray Stuhl_Plakete',
    triangles: 7_102,
    position: Object.freeze({ type: 'VEC3', count: 7_707, componentType: 5126, normalized: false, sha256: 'af04e842fd7b2873ee53d116f8d08ccec4b86d10f3096c744a59303a7fdeb9cf' }),
    normal: Object.freeze({ type: 'VEC3', count: 7_707, componentType: 5122, normalized: true, sha256: 'f5006f41dcc700fa0820386be03af3de8c3bfe40e371f57620176b396ac37709' }),
    indices: Object.freeze({ type: 'SCALAR', count: 21_306, componentType: 5123, normalized: false, sha256: '7fd18880c12c1031cb9dfb1a417c887e6e519199fcebd4f9a536a308545c36ed' }),
  }),
  Object.freeze({
    slot: 2,
    material: 'vray Stuhl_Metall',
    triangles: 14_041,
    position: Object.freeze({ type: 'VEC3', count: 15_361, componentType: 5126, normalized: false, sha256: 'b149490c1e754b99e769fb0da7944371f4a136ca42ad2fc4d9bc01fed3661cb3' }),
    normal: Object.freeze({ type: 'VEC3', count: 15_361, componentType: 5122, normalized: true, sha256: 'df83db38249c30ceb38493bf1a028dfa64acd5dbf4dfd5a929001550eb4289de' }),
    indices: Object.freeze({ type: 'SCALAR', count: 42_123, componentType: 5123, normalized: false, sha256: 'd70950f34732e4c37906dec273cf7a06e6b3ecf8aca52cdaeb785e426f8b23bd' }),
  }),
  Object.freeze({
    slot: 3,
    material: 'vray Stuhl_Bezug',
    triangles: 15_913,
    position: Object.freeze({ type: 'VEC3', count: 13_055, componentType: 5126, normalized: false, sha256: 'a850c9ac4bc8bc43f1167588ceb9507824ba8eb57fee404601572ed60c0a32d4' }),
    normal: Object.freeze({ type: 'VEC3', count: 13_055, componentType: 5122, normalized: true, sha256: 'abb4b4e9b6acb14300981458b4d324720ea72333ceba8a788383b0e5674acfe9' }),
    indices: Object.freeze({ type: 'SCALAR', count: 47_739, componentType: 5123, normalized: false, sha256: 'c89597153d29cfc8ff57ee42b5f5c3122cb1ad37cc86db2ed63adebddd0fa557' }),
  }),
])

const INSTANCE_SIGNATURES = Object.freeze({
  TRANSLATION: Object.freeze({ type: 'VEC3', componentType: 5126, normalized: false, count: INSTANCE_COUNT, sha256: '34987d98ceec9c58feba736616334ab8eae0573ab4e5ebcda298632a36a06638' }),
  ROTATION: Object.freeze({ type: 'VEC4', componentType: 5122, normalized: true, count: INSTANCE_COUNT, sha256: '8763e4b72ce6409aff834aae8ff491078daeb22b48ad8162b03506a42c9b0286' }),
  SCALE: Object.freeze({ type: 'VEC3', componentType: 5126, normalized: false, count: INSTANCE_COUNT, sha256: 'd1db5799e962e30af5f9e9c0d8f39649e5c1fe96b1d5bbb3cfd9f9b6801a12a5' }),
})

const HARD_MAPPING_POLICY = Object.freeze({
  matchingMethod: 'reciprocal-exhaustive-nearest-neighbor-owner-local-translation',
  maxMatchedDistanceMeters: 0.005,
  minRunnerUpMarginMeters: 0.5,
  maxBestToRunnerUpRatio: 0.01,
  requireBijection: true,
  requireReciprocalNearest: true,
  requireExpectedProductionInstanceIndex: true,
})

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
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sha256Stable = (value) => sha256(Buffer.from(stableStringify(value)))

function typedArraySha256(array) {
  return sha256(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
}

function accessorRecord(accessor, { includeBounds = true } = {}) {
  assert.ok(accessor?.getArray(), 'accessor has no decoded array')
  const record = {
    type: accessor.getType(),
    componentType: accessor.getComponentType(),
    normalized: accessor.getNormalized(),
    count: accessor.getCount(),
    byteLength: accessor.getArray().byteLength,
    sha256: typedArraySha256(accessor.getArray()),
  }
  if (includeBounds) {
    record.min = accessor.getMin([])
    record.max = accessor.getMax([])
  }
  return record
}

function signatureRecord(accessor) {
  const record = accessorRecord(accessor, { includeBounds: false })
  return {
    type: record.type,
    componentType: record.componentType,
    normalized: record.normalized,
    count: record.count,
    sha256: record.sha256,
  }
}

function sameSignature(accessor, expected) {
  if (!accessor?.getArray()) return false
  return stableStringify(signatureRecord(accessor)) === stableStringify(expected)
}

function isIdentity(matrix) {
  return matrix.length === IDENTITY.length && matrix.every((value, index) => value === IDENTITY[index])
}

function activeScenePaths(root) {
  const scenes = root.listScenes()
  const activeScene = root.getDefaultScene() ?? scenes[0]
  assert.ok(activeScene, 'current model has no active scene')
  const activeSceneIndex = scenes.indexOf(activeScene)
  assert.ok(activeSceneIndex >= 0, 'current default scene is outside the document root')
  const paths = new Map()
  const visit = (node, path) => {
    assert.ok(!paths.has(node), `active scene references a node more than once (${path})`)
    paths.set(node, path)
    node.listChildren().forEach((child, index) => visit(child, `${path}/${index}`))
  }
  activeScene.listChildren().forEach((node, index) => visit(node, `scene/${activeSceneIndex}/${index}`))
  return { activeScene, activeSceneIndex, paths }
}

function normalizedValue(accessor, index) {
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

function instanceMatrices(instancing) {
  assert.deepEqual(instancing.listSemantics(), ['TRANSLATION', 'ROTATION', 'SCALE'], 'instance TRS semantic order changed')
  const translation = instancing.getAttribute('TRANSLATION')
  const rotation = instancing.getAttribute('ROTATION')
  const scale = instancing.getAttribute('SCALE')
  assert.equal(translation.getCount(), INSTANCE_COUNT, 'instance translation count changed')
  assert.equal(rotation.getCount(), INSTANCE_COUNT, 'instance rotation count changed')
  assert.equal(scale.getCount(), INSTANCE_COUNT, 'instance scale count changed')
  const matrices = []
  for (let index = 0; index < INSTANCE_COUNT; index += 1) {
    const position = new Vector3(...Array.from({ length: 3 }, (_, component) => normalizedValue(translation, index * 3 + component)))
    // This intentionally mirrors Three.js GLTFLoader: decoded normalized
    // integer quaternion components are composed without renormalization.
    const quaternion = new Quaternion(...Array.from({ length: 4 }, (_, component) => normalizedValue(rotation, index * 4 + component)))
    const dimensions = new Vector3(...Array.from({ length: 3 }, (_, component) => normalizedValue(scale, index * 3 + component)))
    matrices.push(new Matrix4().compose(position, quaternion, dimensions).toArray())
  }
  return matrices
}

function matrixFloat64LEHex(matrix) {
  assert.equal(matrix.length, 16, 'matrix must have 16 components')
  const bytes = Buffer.alloc(128)
  matrix.forEach((value, index) => {
    assert.ok(Number.isFinite(value), `matrix component ${index} is not finite`)
    bytes.writeDoubleLE(value, index * 8)
  })
  return bytes.toString('hex')
}

function translationFromFloat64LEHex(hex, label) {
  assert.match(hex, /^[a-f0-9]{48}$/, `${label}: must contain three Float64LE values`)
  const bytes = Buffer.from(hex, 'hex')
  const result = [bytes.readDoubleLE(0), bytes.readDoubleLE(8), bytes.readDoubleLE(16)]
  result.forEach((value, index) => assert.ok(Number.isFinite(value), `${label}[${index}]: must be finite`))
  return result
}

function distance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

function ranked(values) {
  return values.map((value, index) => ({ index, distance: value }))
    .sort((left, right) => left.distance - right.distance || left.index - right.index)
}

function minimumSeparation(points) {
  let minimum = Number.POSITIVE_INFINITY
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      minimum = Math.min(minimum, distance(points[left], points[right]))
    }
  }
  return minimum
}

function validateCertificate(bytes) {
  assert.equal(bytes.length, TRACKED_CERTIFICATE_PIN.bytes, 'tracked logical mapping certificate byte pin changed')
  assert.equal(sha256(bytes), TRACKED_CERTIFICATE_PIN.sha256, 'tracked logical mapping certificate SHA-256 pin changed')
  let certificate
  try {
    certificate = JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    assert.fail(`logical mapping certificate is not valid JSON (${error.message})`)
  }
  assert.equal(certificate?.schema, CERTIFICATE_SCHEMA, 'logical mapping certificate schema changed')
  assert.equal(certificate?.version, 1, 'logical mapping certificate version changed')
  assert.equal(certificate?.status, 'approved-authoritative-logical-mapping', 'logical mapping certificate is not approved-authoritative-logical-mapping')
  assert.equal(certificate?.scope?.sourceCount, INSTANCE_COUNT, 'certificate source count changed')
  assert.equal(certificate?.scope?.ownerNodeName, OWNER_NAME, 'certificate owner changed')
  assert.equal(certificate?.scope?.coordinateSpace, 'owner-local', 'certificate coordinate space changed')
  assert.equal(certificate?.approval?.status, 'approved', 'certificate approval is absent')
  assert.deepEqual(certificate?.policy, HARD_MAPPING_POLICY, 'certificate hard mapping policy changed')
  assert.ok(Array.isArray(certificate.sources), 'certificate sources are missing')
  assert.equal(certificate.sources.length, INSTANCE_COUNT, 'certificate source rows changed')

  const sourceIds = []
  const sourcePaths = []
  const productionIndices = []
  const referenceTranslations = []
  for (let index = 0; index < certificate.sources.length; index += 1) {
    const row = certificate.sources[index]
    assert.equal(row.sourceId, index, `certificate source ${index}: sourceId/order changed`)
    assert.equal(typeof row.sourcePath, 'string', `certificate source ${index}: sourcePath is missing`)
    assert.ok(row.sourcePath.startsWith(`${OWNER_NAME}/${certificate.scope.descendantPath}/`), `certificate source ${index}: sourcePath is outside the intended owner/descendant`)
    assert.ok(Number.isInteger(row.expectedProductionInstanceIndex), `certificate source ${index}: production index must be an integer`)
    assert.ok(row.expectedProductionInstanceIndex >= 0 && row.expectedProductionInstanceIndex < INSTANCE_COUNT, `certificate source ${index}: production index is out of range`)
    assert.ok(row.parity === 'positive' || row.parity === 'mirrored', `certificate source ${index}: parity is invalid`)
    sourceIds.push(row.sourceId)
    sourcePaths.push(row.sourcePath)
    productionIndices.push(row.expectedProductionInstanceIndex)
    referenceTranslations.push(translationFromFloat64LEHex(row.referenceOwnerLocalTranslationFloat64LEHex, `certificate source ${index} translation`))
  }
  assert.equal(new Set(sourceIds).size, INSTANCE_COUNT, 'certificate contains duplicate source IDs')
  assert.equal(new Set(sourcePaths).size, INSTANCE_COUNT, 'certificate contains duplicate source paths')
  assert.equal(new Set(productionIndices).size, INSTANCE_COUNT, 'certificate production indices are not bijective')
  assert.equal(sha256Stable(sourceIds), certificate.catalog.sourceIdsSha256, 'certificate source ID digest is malformed')
  assert.equal(sha256Stable(sourcePaths), certificate.catalog.sourcePathsSha256, 'certificate source path digest is malformed')
  assert.equal(sha256Stable(productionIndices), certificate.catalog.expectedProductionInstanceIndicesSha256, 'certificate production-index digest is malformed')
  assert.equal(sha256(Buffer.concat(certificate.sources.map((row) => Buffer.from(row.referenceOwnerLocalTranslationFloat64LEHex, 'hex')))), certificate.catalog.referenceTranslationsSha256, 'certificate reference-translation digest is malformed')
  assert.equal(sha256Stable(certificate.sources), certificate.catalog.rowRecordsSha256, 'certificate row digest is malformed')
  assert.equal(certificate.sources.filter((row) => row.parity === 'positive').length, certificate.catalog.positive, 'certificate positive parity count is malformed')
  assert.equal(certificate.sources.filter((row) => row.parity === 'mirrored').length, certificate.catalog.mirrored, 'certificate mirrored parity count is malformed')
  assert.equal(certificate.catalog.sourceCount, INSTANCE_COUNT, 'certificate catalog source count changed')
  assert.ok(certificate.target?.productionModel, 'certificate production-model pin is missing')
  assert.ok(Array.isArray(certificate.target?.productionInstancingRootPaths), 'certificate root path pins are missing')
  assert.equal(certificate.target.productionInstancingRootPaths.length, ROOT_SIGNATURES.length, 'certificate root path pin count changed')
  assert.equal(certificate.target?.intendedOwner?.nodeName, OWNER_NAME, 'certificate intended owner pin changed')
  return { certificate, referenceTranslations }
}

function primitiveMatchesSignature(primitive, signature) {
  const indices = primitive?.getIndices()
  return primitive?.getMode() === 4 &&
    indices?.getCount() === signature.triangles * 3 &&
    primitive.getMaterial()?.getName() === signature.material &&
    stableStringify(primitive.listSemantics()) === stableStringify(['POSITION', 'NORMAL']) &&
    sameSignature(primitive.getAttribute('POSITION'), signature.position) &&
    sameSignature(primitive.getAttribute('NORMAL'), signature.normal) &&
    sameSignature(indices, signature.indices)
}

function instancingMatchesSignature(instancing) {
  if (!instancing || stableStringify(instancing.listSemantics()) !== stableStringify(['TRANSLATION', 'ROTATION', 'SCALE'])) return false
  return Object.entries(INSTANCE_SIGNATURES).every(([semantic, signature]) => sameSignature(instancing.getAttribute(semantic), signature))
}

function animationChannelsTargeting(root, node) {
  const result = []
  root.listAnimations().forEach((animation, animationIndex) => {
    const samplers = animation.listSamplers()
    animation.listChannels().forEach((channel, channelIndex) => {
      if (channel.getTargetNode() !== node) return
      const sampler = channel.getSampler()
      const input = sampler?.getInput()
      const output = sampler?.getOutput()
      assert.ok(sampler && input?.getArray() && output?.getArray(), `owner animation ${animationIndex}/${channelIndex}: sampler accessors are incomplete`)
      const targetPath = channel.getTargetPath()
      const interpolation = sampler.getInterpolation()
      const elementSize = output.getElementSize()
      const times = Array.from(input.getArray(), Number)
      const flatOutput = Array.from(output.getArray(), Number)
      const cubic = interpolation === 'CUBICSPLINE'
      const expectedOutputElements = input.getCount() * (cubic ? 3 : 1)
      assert.equal(output.getCount(), expectedOutputElements, `owner animation ${animationIndex}/${channelIndex}: output count is incompatible with interpolation`)
      const keyframes = []
      for (let key = 0; key < input.getCount(); key += 1) {
        if (cubic) {
          const offset = key * elementSize * 3
          keyframes.push({
            time: times[key],
            inTangent: flatOutput.slice(offset, offset + elementSize),
            value: flatOutput.slice(offset + elementSize, offset + elementSize * 2),
            outTangent: flatOutput.slice(offset + elementSize * 2, offset + elementSize * 3),
          })
        } else {
          keyframes.push({ time: times[key], value: flatOutput.slice(key * elementSize, (key + 1) * elementSize) })
        }
      }
      const values = keyframes.map((keyframe) => keyframe.value)
      const firstValue = values[0] ?? []
      const constant = values.every((value) => value.length === firstValue.length && value.every((component, index) => Math.abs(component - firstValue[index]) <= VALUE_EPSILON))
      const restValue = targetPath === 'translation' ? node.getTranslation()
        : targetPath === 'rotation' ? node.getRotation()
          : targetPath === 'scale' ? node.getScale()
            : null
      const equalsRestTransform = restValue !== null && values.every((value) =>
        value.length === restValue.length && value.every((component, index) => Math.abs(component - restValue[index]) <= VALUE_EPSILON))
      const cubicTangentsZero = !cubic || keyframes.every((keyframe) =>
        [...keyframe.inTangent, ...keyframe.outTangent].every((component) => Math.abs(component) <= VALUE_EPSILON))
      result.push({
        animationIndex,
        animationName: animation.getName(),
        channelIndex,
        samplerIndex: samplers.indexOf(sampler),
        targetPath,
        interpolation,
        input: accessorRecord(input),
        output: accessorRecord(output),
        keyframes,
        analysis: {
          constant,
          equalsRestTransform,
          cubicTangentsZero,
          noOpAtRest: constant && equalsRestTransform && cubicTangentsZero,
        },
      })
    })
  })
  return result
}

function discoverPhysicalRoots(document, paths) {
  const root = document.getRoot()
  const activeNodes = [...paths.keys()]
  const discovered = ROOT_SIGNATURES.map((signature) => {
    const matches = activeNodes.filter((node) => {
      const primitives = node.getMesh()?.listPrimitives() ?? []
      return primitives.length === 1 &&
        primitiveMatchesSignature(primitives[0], signature) &&
        instancingMatchesSignature(node.getExtension('EXT_mesh_gpu_instancing'))
    })
    assert.equal(matches.length, 1, `physical signature for ${signature.material} matched ${matches.length} active-scene nodes`)
    return { signature, node: matches[0] }
  })
  assert.equal(new Set(discovered.map(({ node }) => node)).size, ROOT_SIGNATURES.length, 'physical signatures did not resolve four distinct roots')

  const records = discovered.map(({ signature, node }) => {
    const primitive = node.getMesh().listPrimitives()[0]
    const instancing = node.getExtension('EXT_mesh_gpu_instancing')
    const targetedChannels = animationChannelsTargeting(root, node)
    assert.equal(targetedChannels.length, 0, `${signature.material}: repeat root unexpectedly became animated`)
    assert.equal(node.getParentNode(), null, `${signature.material}: repeat root is no longer a scene root`)
    assert.ok(isIdentity(node.getMatrix()), `${signature.material}: repeat root local rest matrix is not identity`)
    assert.ok(isIdentity(node.getWorldMatrix()), `${signature.material}: repeat root world rest matrix is not identity`)
    return {
      slot: signature.slot,
      material: signature.material,
      activeScenePath: paths.get(node),
      nodeName: node.getName(),
      sceneRoot: node.getParentNode() === null,
      localRestMatrix: node.getMatrix(),
      worldRestMatrix: node.getWorldMatrix(),
      animationChannelCount: targetedChannels.length,
      geometry: {
        triangles: signature.triangles,
        semantics: primitive.listSemantics(),
        position: accessorRecord(primitive.getAttribute('POSITION')),
        normal: accessorRecord(primitive.getAttribute('NORMAL')),
        indices: accessorRecord(primitive.getIndices()),
      },
      materialRecord: {
        name: primitive.getMaterial().getName(),
        baseColorFactor: primitive.getMaterial().getBaseColorFactor(),
        emissiveFactor: primitive.getMaterial().getEmissiveFactor(),
        metallicFactor: primitive.getMaterial().getMetallicFactor(),
        roughnessFactor: primitive.getMaterial().getRoughnessFactor(),
        alphaMode: primitive.getMaterial().getAlphaMode(),
        doubleSided: primitive.getMaterial().getDoubleSided(),
      },
      instanceAccessors: Object.fromEntries(instancing.listSemantics().map((semantic) => [semantic, accessorRecord(instancing.getAttribute(semantic))])),
      matrices: instanceMatrices(instancing),
    }
  })
  return records
}

function verifyLogicalCompatibility(certificate, referenceTranslations, matrices) {
  const production = matrices.map((matrix) => matrix.slice(12, 15))
  const distances = production.map((point) => referenceTranslations.map((reference) => distance(point, reference)))
  const fromProduction = distances.map(ranked)
  const fromReference = referenceTranslations.map((_, referenceIndex) => ranked(production.map((__, productionIndex) => distances[productionIndex][referenceIndex])))
  const mappings = []
  const mappedReferences = new Set()
  let maxMatchedDistanceMeters = 0
  let minRunnerUpMarginMeters = Number.POSITIVE_INFINITY
  let maxBestToRunnerUpRatio = 0
  let minRunnerUpDistanceMeters = Number.POSITIVE_INFINITY
  for (let productionIndex = 0; productionIndex < INSTANCE_COUNT; productionIndex += 1) {
    const nearest = fromProduction[productionIndex]
    assert.ok(nearest[1].distance - nearest[0].distance > EPSILON, `logical mapping is ambiguous for production row ${productionIndex}`)
    const sourceIndex = nearest[0].index
    const reverse = fromReference[sourceIndex]
    assert.equal(reverse[0].index, productionIndex, `logical mapping is not reciprocal for production row ${productionIndex}`)
    assert.ok(reverse[1].distance - reverse[0].distance > EPSILON, `logical mapping is ambiguous for certificate source ${sourceIndex}`)
    const source = certificate.sources[sourceIndex]
    assert.equal(source.expectedProductionInstanceIndex, productionIndex, `logical transform order changed for certificate source ${sourceIndex}`)
    const determinant = new Matrix4().fromArray(matrices[productionIndex]).determinant()
    const parity = determinant > 0 ? 'positive' : 'mirrored'
    assert.equal(source.parity, parity, `logical parity changed for certificate source ${sourceIndex}`)
    mappedReferences.add(sourceIndex)
    const runnerUpDistance = Math.min(nearest[1].distance, reverse[1].distance)
    const runnerUpMargin = Math.min(nearest[1].distance - nearest[0].distance, reverse[1].distance - reverse[0].distance)
    const bestToRunnerUpRatio = Math.max(nearest[0].distance / nearest[1].distance, reverse[0].distance / reverse[1].distance)
    maxMatchedDistanceMeters = Math.max(maxMatchedDistanceMeters, nearest[0].distance)
    minRunnerUpMarginMeters = Math.min(minRunnerUpMarginMeters, runnerUpMargin)
    maxBestToRunnerUpRatio = Math.max(maxBestToRunnerUpRatio, bestToRunnerUpRatio)
    minRunnerUpDistanceMeters = Math.min(minRunnerUpDistanceMeters, runnerUpDistance)
    mappings.push({
      productionInstanceIndex: productionIndex,
      sourceId: source.sourceId,
      sourcePath: source.sourcePath,
      expectedProductionInstanceIndex: source.expectedProductionInstanceIndex,
      matchedDistanceMeters: nearest[0].distance,
      runnerUpDistanceMeters: nearest[1].distance,
      parity,
      determinant,
      matrixSha256: sha256(Buffer.from(matrixFloat64LEHex(matrices[productionIndex]), 'hex')),
    })
  }
  assert.equal(mappedReferences.size, INSTANCE_COUNT, 'logical mapping is not bijective')
  assert.ok(maxMatchedDistanceMeters <= HARD_MAPPING_POLICY.maxMatchedDistanceMeters, `logical mapping maximum distance ${maxMatchedDistanceMeters} exceeds policy`)
  assert.ok(minRunnerUpMarginMeters >= HARD_MAPPING_POLICY.minRunnerUpMarginMeters, `logical mapping minimum runner-up margin ${minRunnerUpMarginMeters} is below policy`)
  assert.ok(maxBestToRunnerUpRatio <= HARD_MAPPING_POLICY.maxBestToRunnerUpRatio, `logical mapping best/runner-up ratio ${maxBestToRunnerUpRatio} exceeds policy`)

  const productionTransformSetSha256 = sha256Stable(certificate.sources.map((source, sourceIndex) => ({
    sourceIndex,
    name: source.sourcePath.split('/').at(-1),
    matrixFloat64LEHex: matrixFloat64LEHex(matrices[source.expectedProductionInstanceIndex]),
  })))
  return {
    orderCompatible: true,
    parityCompatible: true,
    reciprocalNearestCompatible: true,
    bijective: true,
    productionTransformSetSha256,
    parity: {
      positive: mappings.filter((row) => row.parity === 'positive').length,
      mirrored: mappings.filter((row) => row.parity === 'mirrored').length,
    },
    metrics: {
      maxMatchedDistanceMeters,
      minRunnerUpMarginMeters,
      maxBestToRunnerUpRatio,
      minRunnerUpDistanceMeters,
      minReferenceSeparationMeters: minimumSeparation(referenceTranslations),
      minProductionSeparationMeters: minimumSeparation(production),
    },
    policy: HARD_MAPPING_POLICY,
    mappings,
  }
}

function comparePins(certificate, currentModel, roots, owner, logical) {
  const stale = []
  const target = certificate.target
  const currentRootPaths = roots.map((root) => root.activeScenePath)
  const currentInstanceAccessors = Object.fromEntries(Object.entries(roots[0].instanceAccessors).map(([semantic, record]) => [semantic, {
    type: record.type,
    componentType: record.componentType,
    normalized: record.normalized,
    count: record.count,
    sha256: record.sha256,
  }]))
  const comparisons = {
    productionModel: {
      pinned: target.productionModel,
      current: currentModel,
      matches: target.productionModel.bytes === currentModel.bytes && target.productionModel.sha256 === currentModel.sha256,
    },
    productionInstancingRootPaths: {
      pinned: target.productionInstancingRootPaths,
      current: currentRootPaths,
      matches: stableStringify(target.productionInstancingRootPaths) === stableStringify(currentRootPaths),
    },
    intendedOwner: {
      pinned: target.intendedOwner,
      current: {
        nodeName: owner.nodeName,
        activeScenePath: owner.activeScenePath,
        sceneRoot: owner.sceneRoot,
        identityRestMatrix: owner.identityRestMatrix,
        animationChannels: owner.animationChannelCount,
      },
    },
    instanceAccessors: {
      pinned: target.instanceAccessors,
      current: currentInstanceAccessors,
      matches: stableStringify(target.instanceAccessors) === stableStringify(currentInstanceAccessors),
    },
    productionTransformSetSha256: {
      pinned: target.productionTransformSetSha256,
      current: logical.productionTransformSetSha256,
      matches: target.productionTransformSetSha256 === logical.productionTransformSetSha256,
    },
  }
  comparisons.intendedOwner.matches = stableStringify(comparisons.intendedOwner.pinned) === stableStringify(comparisons.intendedOwner.current)
  for (const [pin, comparison] of Object.entries(comparisons)) {
    if (!comparison.matches) stale.push(pin)
  }
  return { comparisons, stalePins: stale, rebaseRequired: stale.length > 0 }
}

async function buildReport() {
  const [modelBytes, certificateBytes] = await Promise.all([readFile(MODEL_PATH), readFile(CERTIFICATE_PATH)])
  const currentModel = { relativePath: RELATIVE_MODEL_PATH, bytes: modelBytes.length, sha256: sha256(modelBytes) }
  const certificateInput = { relativePath: RELATIVE_CERTIFICATE_PATH, bytes: certificateBytes.length, sha256: sha256(certificateBytes) }
  const { certificate, referenceTranslations } = validateCertificate(certificateBytes)
  const io = await createGltfIO()
  const document = await io.readBinary(modelBytes)
  const root = document.getRoot()
  const { activeSceneIndex, paths } = activeScenePaths(root)
  const physicalRoots = discoverPhysicalRoots(document, paths)

  const firstMatrixHex = physicalRoots[0].matrices.map(matrixFloat64LEHex)
  for (const record of physicalRoots.slice(1)) {
    assert.deepEqual(record.matrices.map(matrixFloat64LEHex), firstMatrixHex, `${record.material}: transform row/order differs from the other physical roots`)
  }
  const roots = physicalRoots.map(({ matrices: _matrices, ...record }) => record)
  const logical = verifyLogicalCompatibility(certificate, referenceTranslations, physicalRoots[0].matrices)

  const ownerMatches = root.listNodes().filter((node) => node.getName() === OWNER_NAME)
  assert.equal(ownerMatches.length, 1, `current model contains ${ownerMatches.length} nodes named ${OWNER_NAME}`)
  const ownerNode = ownerMatches[0]
  const ownerPath = paths.get(ownerNode)
  assert.ok(ownerPath, `${OWNER_NAME} is outside the active scene`)
  const ownerChannels = animationChannelsTargeting(root, ownerNode)
  const ownerTranslationChannels = ownerChannels.filter((channel) => channel.targetPath === 'translation')
  assert.ok(ownerChannels.every((channel) => channel.analysis.noOpAtRest), `${OWNER_NAME} has a non-no-op animation channel`)
  const owner = {
    uniqueNamedNodeCount: ownerMatches.length,
    nodeName: ownerNode.getName(),
    activeScenePath: ownerPath,
    sceneRoot: ownerNode.getParentNode() === null,
    localRestMatrix: ownerNode.getMatrix(),
    worldRestMatrix: ownerNode.getWorldMatrix(),
    identityRestMatrix: isIdentity(ownerNode.getMatrix()),
    identityWorldRestMatrix: isIdentity(ownerNode.getWorldMatrix()),
    translationRestValue: ownerNode.getTranslation(),
    rotationRestValue: ownerNode.getRotation(),
    scaleRestValue: ownerNode.getScale(),
    animationChannelCount: ownerChannels.length,
    allTargetedChannelsNoOpAtRest: ownerChannels.every((channel) => channel.analysis.noOpAtRest),
    translationTrackAssessment: {
      count: ownerTranslationChannels.length,
      addedRelativeToPinnedCertificate: ownerTranslationChannels.length > 0 && certificate.target.intendedOwner.animationChannels === 0,
      allConstant: ownerTranslationChannels.length > 0 && ownerTranslationChannels.every((channel) => channel.analysis.constant),
      allEqualRestTransform: ownerTranslationChannels.length > 0 && ownerTranslationChannels.every((channel) => channel.analysis.equalsRestTransform),
      allNoOpAtRest: ownerTranslationChannels.length > 0 && ownerTranslationChannels.every((channel) => channel.analysis.noOpAtRest),
    },
    targetedAnimationChannels: ownerChannels,
  }
  assert.equal(owner.sceneRoot, true, `${OWNER_NAME} is no longer a scene root`)
  assert.equal(owner.identityRestMatrix, true, `${OWNER_NAME} local rest matrix is not identity`)
  assert.equal(owner.identityWorldRestMatrix, true, `${OWNER_NAME} world rest matrix is not identity`)

  const pinComparison = comparePins(certificate, currentModel, roots, owner, logical)
  const physicalCompatibilityProven = true
  const logicalCompatibilityProven = true
  return {
    schema: SCHEMA,
    mode: 'disabled-read-only-audit',
    status: pinComparison.rebaseRequired ? 'pass-physical-logical-compatible-rebase-required' : 'pass-physical-logical-compatible',
    physicalCompatibilityProven,
    logicalCompatibilityProven,
    integrationAllowed: false,
    rebaseRequired: pinComparison.rebaseRequired,
    decision: pinComparison.rebaseRequired
      ? 'The current model remains physically and logically compatible, but tracked production paths/model/owner pins are stale. Refresh and explicitly reapprove those pins before any integration work.'
      : 'Compatibility evidence passes, but this disabled audit has no integration or activation authority.',
    inputs: {
      currentModel,
      trackedLogicalMappingCertificate: {
        ...certificateInput,
        schema: certificate.schema,
        status: certificate.status,
        approval: certificate.approval,
      },
    },
    activeSceneIndex,
    discovery: {
      method: 'active-scene exhaustive match by exact material name, triangle count, primitive semantics, decoded POSITION/NORMAL/index fingerprints, and exact 78-row EXT_mesh_gpu_instancing accessor fingerprints; scene ordinals are not inputs',
      expectedRootCount: ROOT_SIGNATURES.length,
      discoveredRootCount: roots.length,
      transformCompositionOrder: 'root world-rest matrix * EXT_mesh_gpu_instancing(TRS)',
      rootWorldTransformsIdentity: roots.every((entry) => isIdentity(entry.worldRestMatrix)),
      rootTransformRowsIdenticalAndOrdered: true,
      roots,
    },
    owner,
    logicalMapping: logical,
    stalePinComparison: pinComparison,
    safeguards: {
      sourceAssetsModified: false,
      runtimeImportedOrEnabled: false,
      publicRouteChanged: false,
      integrationAllowed: false,
      activationAuthorityEstablished: false,
      reportRelativePath: RELATIVE_REPORT_PATH,
    },
  }
}

async function writeReport(report) {
  await mkdir(dirname(REPORT_PATH), { recursive: true })
  await writeFile(REPORT_PATH, `${JSON.stringify(stableValue(report), null, 2)}\n`)
}

async function main() {
  try {
    const report = await buildReport()
    await writeReport(report)
    console.log(`Repeat six-part current-model compatibility audit: PASS (${report.rebaseRequired ? 'rebase required' : 'pins current'})`)
    console.log(`Physical compatibility: ${report.physicalCompatibilityProven ? 'proven' : 'not proven'}`)
    console.log(`Logical compatibility: ${report.logicalCompatibilityProven ? 'proven' : 'not proven'}`)
    console.log('Integration allowed: false')
    console.log(`Report: ${RELATIVE_REPORT_PATH}`)
  } catch (error) {
    const failure = {
      schema: SCHEMA,
      mode: 'disabled-read-only-audit',
      status: 'fail-compatibility-not-proven',
      physicalCompatibilityProven: false,
      logicalCompatibilityProven: false,
      integrationAllowed: false,
      rebaseRequired: null,
      error: error instanceof Error ? error.message : String(error),
      safeguards: {
        sourceAssetsModified: false,
        runtimeImportedOrEnabled: false,
        publicRouteChanged: false,
        integrationAllowed: false,
        activationAuthorityEstablished: false,
        reportRelativePath: RELATIVE_REPORT_PATH,
      },
    }
    try {
      await writeReport(failure)
    } catch (writeError) {
      console.error(`Could not write failure report: ${writeError instanceof Error ? writeError.message : String(writeError)}`)
    }
    console.error(`Repeat six-part current-model compatibility audit: FAIL (${failure.error})`)
    process.exitCode = 1
  }
}

await main()
