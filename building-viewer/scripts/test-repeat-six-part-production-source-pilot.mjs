#!/usr/bin/env node

/**
 * Clean-checkout determinism and local migration-evidence gate for the
 * disabled direct-production exact six-part source pilot.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Matrix4, Quaternion, Vector3 } from 'three'
import {
  assertRepeatSixPartAccessorStorageContract,
  buildRepeatSixPartProductionSourcePilot,
} from './build-repeat-six-part-production-source-pilot.mjs'
import { createGltfIO } from './lib/gltf-io.mjs'

const VIEWER_ROOT = resolve(import.meta.dirname, '..')
const ROOT = resolve(VIEWER_ROOT, 'tmp/repeat-six-part-production-source-determinism')
const OUTPUT_FILES = [
  'exact-six-segment-production-source.glb',
  'production-source-map.json',
  'physical-audit.json',
  'REPORT.md',
]

async function bytes(path) {
  return readFile(path)
}

function decodedNormalizedInt16(value) {
  return Math.max(-1, value / 32767)
}

function matrixFloat64LEHex(values) {
  const bytes = Buffer.alloc(16 * 8)
  values.forEach((value, index) => bytes.writeDoubleLE(value, index * 8))
  return bytes.toString('hex')
}

function expectedLoaderMatrices(instancing, { renormalizeQuaternion }) {
  const translation = instancing.getAttribute('TRANSLATION').getArray()
  const rotation = instancing.getAttribute('ROTATION').getArray()
  const scale = instancing.getAttribute('SCALE').getArray()
  const matrices = []
  for (let index = 0; index < 78; index += 1) {
    const quaternion = new Quaternion(
      decodedNormalizedInt16(rotation[index * 4]),
      decodedNormalizedInt16(rotation[index * 4 + 1]),
      decodedNormalizedInt16(rotation[index * 4 + 2]),
      decodedNormalizedInt16(rotation[index * 4 + 3]),
    )
    if (renormalizeQuaternion) quaternion.normalize()
    matrices.push(new Matrix4().compose(
      new Vector3(translation[index * 3], translation[index * 3 + 1], translation[index * 3 + 2]),
      quaternion,
      new Vector3(scale[index * 3], scale[index * 3 + 1], scale[index * 3 + 2]),
    ).toArray())
  }
  return matrices
}

async function expectAccessorMutationRejected(io, geometryPath, label, mutate) {
  const document = await io.read(geometryPath)
  const primitive = document.getRoot().listNodes().find((node) => node.getMesh()).getMesh().listPrimitives()[0]
  mutate(primitive)
  assert.throws(
    () => assertRepeatSixPartAccessorStorageContract(primitive, label),
    { name: 'AssertionError' },
    `${label}: invalid accessor storage was accepted`,
  )
}

async function main() {
  // Both runs consume only the tracked production GLB and approved tracked
  // mapping certificate. The ignored historical source map is deliberately
  // not read by this clean-checkout gate.
  const roots = [resolve(ROOT, 'clean-a'), resolve(ROOT, 'clean-b')]
  const left = await buildRepeatSixPartProductionSourcePilot({ outputRoot: roots[0], verifyCurrentMapping: false })
  const right = await buildRepeatSixPartProductionSourcePilot({ outputRoot: roots[1], verifyCurrentMapping: false })
  assert.equal(left.currentMappingReference, null)
  assert.equal(right.currentMappingReference, null)
  assert.equal(left.logicalMapping.logicalOwnershipMappingPassed, true)
  assert.equal(left.logicalMapping.activationBlocked, true)
  assert.deepEqual(left.hashes, right.hashes, 'direct-production artifact hashes changed between clean builds')

  for (const file of OUTPUT_FILES) {
    assert.deepEqual(await bytes(resolve(roots[0], file)), await bytes(resolve(roots[1], file)), `${file}: clean builds are not byte-identical`)
  }

  const audit = JSON.parse(await readFile(resolve(roots[0], 'physical-audit.json'), 'utf8'))
  assert.equal(audit.status, 'PASS')
  assert.equal(audit.disabled, true)
  assert.equal(audit.runtimeIntegrated, false)
  assert.equal(audit.productionChanged, false)
  assert.equal(audit.sourceModel.sha256, 'b96cf36f64a03d16047e3ff26aa93131481f636c184df80b5c7ea2032e4cb5e8')
  assert.equal(audit.identification.physicalCandidateCount, 4)
  assert.equal(audit.identification.intendedOwnerRestBasis.identityRestMatrix, true)
  assert.equal(audit.identification.intendedOwnerRestBasis.animationChannels, 0)
  assert.equal(audit.historicalLogicalOrderContract.status, 'APPROVED_TRACKED_CERTIFICATE_REVERIFIED_BY_CLEAN_BUILD')
  assert.equal(audit.logicalMappingCertificate.provenanceApproved, true)
  assert.equal(audit.logicalMappingCertificate.logicalOwnershipMappingPassed, true)
  assert.equal(audit.logicalMappingCertificate.activationBlocked, true)
  assert.equal(audit.transforms.sourceCount, 78)
  assert.equal(audit.transforms.positive, 40)
  assert.equal(audit.transforms.mirrored, 38)
  assert.equal(audit.transforms.materialBatchOrderIdentical, true)
  assert.equal(audit.transforms.hostTimesLocalMaximumDelta, 0)
  assert.deepEqual(audit.transforms.instanceTrsDecodeContract, {
    normalizedIntegerComponentsDecoded: true,
    rotationQuaternionRenormalized: false,
    runtimeReference: 'pinned Three.js GLTFLoader EXT_mesh_gpu_instancing composition',
    authoritativeMatrixEncoding: '16 IEEE-754 Float64 components encoded little-endian as ownerLocalMatrixFloat64LEHex',
    jsonNumericMatrixAuthoritative: false,
  })
  assert.equal(audit.transforms.signedZeroBitsPreserved, true)
  assert.equal(audit.geometry.source.sha256, '4ace583e8d9bd044defffa65aa5e6b875b4923381ebb0eeca58ee5375306edee')
  assert.deepEqual(audit.geometry.written, audit.geometry.source)
  assert.equal(audit.geometry.exactTriangleBijection, true)
  assert.equal(audit.geometry.strictAccessorMetadataPreserved, true)
  assert.equal(audit.geometry.exactPerSegmentAssignmentPreserved, true)
  assert.deepEqual(audit.geometry.segmentDigests.map((segment) => segment.canonicalOrientedGeometrySha256), [
    '55d1d534df847b56bbfea8f0c9905f8ad28e3997954c69354cf3cb40faeed2d4',
    '154bb6f80c279ca8672234f8908f5dad4e4e762ec6472abe47c5795369d3b4f7',
    '5ee0d98eaf1070bd77450516dc9570e6f41cb8a2b2ffad8ff522a285f9d93193',
    'cac480e6a64f0f373cfa0c6233965df23d0049e7457f059454dc2579128167e0',
    '23607a86d0efa9fdd2a379261c62fcf018694c1a7c98f0ab06e97102ca539fe1',
    '8cf6ba50e28ca1f1662f40792a64d08fe6b997b18f5d39b74fde0b7985d5e2fc',
  ])
  assert.equal(audit.geometry.positionBitsPreserved, true)
  assert.equal(audit.geometry.normalStorageBitsAndNormalizationPreserved, true)
  assert.equal(audit.geometry.orientedWindingPreserved, true)
  assert.deepEqual(audit.excludedDependencies, [
    'tmp/icm-anim-2025-cleaned.glb',
    'tmp/repeat-lod-ground-floor/Mesh.13786-near-source.glb',
  ])

  const sourceMap = JSON.parse(await readFile(resolve(roots[0], 'production-source-map.json'), 'utf8'))
  assert.equal(sourceMap.disabled, true)
  assert.equal(sourceMap.runtimeIntegrated, false)
  assert.deepEqual(sourceMap.logicalMappingCertificate, audit.logicalMappingCertificate)
  assert.equal(sourceMap.instances.length, 78)
  assert.deepEqual(sourceMap.instances.map((instance) => instance.sourceIndex), Array.from({ length: 78 }, (_, index) => index))
  assert.equal(sourceMap.instances[0].sourceName, 'Stuhl_Tisch_Rechts_Reihe_134')
  assert.equal(sourceMap.instances[34].sourceName, 'Stuhl_Tisch_Rechts_Reihe_168')
  assert.equal(sourceMap.instances[35].sourceName, 'Stuhl_Tisch_Rechts_Reihe_171')
  assert.equal(sourceMap.instances[37].sourceName, 'Stuhl_Tisch_Rechts_Reihe_172.001')
  assert.equal(sourceMap.instances[77].sourceName, 'Stuhl_Tisch_Rechts_Reihe_211.001')
  assert.equal(sourceMap.transformSetSha256, 'fe7adf799ecbfedbf84bcfcaa0557713728a36507573f846b52476891b66d36b')

  const io = await createGltfIO()
  const production = await io.read(resolve(VIEWER_ROOT, '../public/models/icm-anim-2025/model-web.glb'))
  const productionNode = production.getRoot().getDefaultScene().listChildren()[258]
  const instancing = productionNode.getExtension('EXT_mesh_gpu_instancing')
  assert.ok(instancing, 'pinned production repeat node lost EXT_mesh_gpu_instancing')
  const loaderMatrices = expectedLoaderMatrices(instancing, { renormalizeQuaternion: false })
  const renormalizedMatrices = expectedLoaderMatrices(instancing, { renormalizeQuaternion: true })
  const loaderMatrixHex = loaderMatrices.map(matrixFloat64LEHex)
  assert.deepEqual(sourceMap.instances.map((instance) => instance.ownerLocalMatrixFloat64LEHex), loaderMatrixHex,
    'source map no longer preserves every raw Three.js loader-composed Float64 bit')
  assert.notDeepEqual(loaderMatrixHex, renormalizedMatrices.map(matrixFloat64LEHex),
    'raw-quaternion regression fixture no longer distinguishes loader composition from renormalization')
  const roundedMatrices = loaderMatrices.map((matrix) => matrix.map((value) => Number(value.toPrecision(15))))
  const roundedMismatchCount = loaderMatrices.reduce((sum, matrix, matrixIndex) =>
    sum + matrix.filter((value, component) => !Object.is(value, roundedMatrices[matrixIndex][component])).length, 0)
  assert.equal(roundedMismatchCount, 525, 'raw-double fixture no longer detects 15-digit rounding and signed-zero loss')
  assert.notDeepEqual(loaderMatrixHex, roundedMatrices.map(matrixFloat64LEHex),
    '15-digit-rounded matrices were incorrectly accepted as raw loader matrices')

  const geometryPath = resolve(roots[0], 'exact-six-segment-production-source.glb')
  await expectAccessorMutationRejected(io, geometryPath, 'position-normalized-mutation', (primitive) => {
    primitive.getAttribute('POSITION').setNormalized(true)
  })
  await expectAccessorMutationRejected(io, geometryPath, 'position-component-mutation', (primitive) => {
    primitive.getAttribute('POSITION').setArray(Int16Array.from(primitive.getAttribute('POSITION').getArray()))
  })
  await expectAccessorMutationRejected(io, geometryPath, 'normal-normalized-mutation', (primitive) => {
    primitive.getAttribute('NORMAL').setNormalized(false)
  })
  await expectAccessorMutationRejected(io, geometryPath, 'normal-component-mutation', (primitive) => {
    primitive.getAttribute('NORMAL').setArray(Float32Array.from(primitive.getAttribute('NORMAL').getArray()))
  })
  await expectAccessorMutationRejected(io, geometryPath, 'index-normalized-mutation', (primitive) => {
    primitive.getIndices().setNormalized(true)
  })
  await expectAccessorMutationRejected(io, geometryPath, 'index-component-mutation', (primitive) => {
    primitive.getIndices().setArray(Uint32Array.from(primitive.getIndices().getArray()))
  })

  const report = await readFile(resolve(roots[0], 'REPORT.md'), 'utf8')
  assert.match(report, /PASS, disabled and not runtime-integrated/)
  assert.match(report, /no longer requires the ignored 347 MB cleaned GLB or the ignored near-source GLB/)
  assert.match(report, /project-owner-approved mapping certificate/)
  assert.match(report, /runtime and activation remain blocked/)
  assert.ok(!report.includes(VIEWER_ROOT), 'report leaked a checkout-specific path')

  console.log(JSON.stringify({
    status: 'PASS',
    cleanBuildsCompared: 2,
    trackedProductionAndApprovalInputsOnly: true,
    ignoredSourceDependencies: 0,
    optionalHistoricalMapVerification: 'separate --verify-current-mapping gate',
    outputs: {
      geometry: audit.outputs.geometry,
      sourceMap: audit.outputs.sourceMap,
      auditSha256: left.hashes.audit,
      reportSha256: left.hashes.report,
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
})
