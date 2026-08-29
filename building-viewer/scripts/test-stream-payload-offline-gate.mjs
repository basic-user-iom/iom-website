/**
 * Deterministic acceptance test for the standalone stream-payload inspector.
 *
 * Real inputs:
 * - every Web + Quest LOD0 payload in the disabled coalesced first-floor pilot;
 * - the Web Mesh.13786 parity/spatial instancing artifact, which is intentionally
 *   textureless and has POSITION + NORMAL without any TEXCOORD attribute.
 *
 * Generated negative fixtures and the report are written under tmp only.
 */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document } from '@gltf-transform/core'
import { KHRLightsPunctual, KHRMaterialsUnlit } from '@gltf-transform/extensions'
import { createGltfIO } from './lib/gltf-io.mjs'
import {
  inspectManifestV3Payload,
  inspectStreamPayload,
  stablePayloadInspectionSha256,
  stablePayloadInspectionString,
} from './lib/inspect-stream-payload.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const PILOT_ROOT = resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-first-floor-coalesced')
const PILOT_INDEX = resolve(PILOT_ROOT, 'detail-package-index.json')
const REPEAT_ROOT = resolve(VIEWER_ROOT, 'tmp', 'repeat-instancing-ground-floor')
const REPEAT_PAYLOAD = resolve(REPEAT_ROOT, 'Mesh.13786-web-owner-local-parity-spatial-instanced.glb')
const OUTPUT_ROOT = resolve(VIEWER_ROOT, 'tmp', 'stream-payload-offline-gate')
const FIXTURE_ROOT = resolve(OUTPUT_ROOT, 'fixtures')
const REPORT_PATH = resolve(OUTPUT_ROOT, 'report.json')

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

function fixtureGeometry(document, { normal = true, texcoord0 = false, position = true } = {}) {
  const buffer = document.getRoot().listBuffers()[0] || document.createBuffer('fixture-buffer')
  const primitive = document.createPrimitive().setMode(4)
  if (position) {
    primitive.setAttribute(
      'POSITION',
      document.createAccessor('fixture-position')
        .setType('VEC3')
        .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
        .setBuffer(buffer),
    )
  }
  if (normal) {
    primitive.setAttribute(
      'NORMAL',
      document.createAccessor('fixture-normal')
        .setType('VEC3')
        .setArray(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]))
        .setBuffer(buffer),
    )
  }
  if (texcoord0) {
    primitive.setAttribute(
      'TEXCOORD_0',
      document.createAccessor('fixture-uv0')
        .setType('VEC2')
        .setArray(new Float32Array([0, 0, 1, 0, 0, 1]))
        .setBuffer(buffer),
    )
  }
  return primitive
}

async function writeSyntheticFixtures(io) {
  await mkdir(FIXTURE_ROOT, { recursive: true })

  const unlitDocument = new Document()
  const unlitMaterial = unlitDocument.createMaterial('fixture-unlit')
  const unlit = unlitDocument.createExtension(KHRMaterialsUnlit).createUnlit()
  unlitMaterial.setExtension('KHR_materials_unlit', unlit)
  const unlitPrimitive = fixtureGeometry(unlitDocument, { normal: false }).setMaterial(unlitMaterial)
  const unlitNode = unlitDocument.createNode('unlit-position-only')
    .setMesh(unlitDocument.createMesh('unlit-mesh').addPrimitive(unlitPrimitive))
  unlitDocument.createScene('fixture-scene').addChild(unlitNode)
  const unlitPath = resolve(FIXTURE_ROOT, 'unlit-position-only.glb')
  await io.write(unlitPath, unlitDocument)

  const invalidDocument = new Document()
  const invalidMaterial = invalidDocument.createMaterial('fixture-lit-textured')
  const fixtureTexture = invalidDocument.createTexture('fixture-base-color')
    .setImage(ONE_PIXEL_PNG)
    .setMimeType('image/png')
  invalidMaterial.setBaseColorTexture(fixtureTexture)
  invalidMaterial.getBaseColorTextureInfo().setTexCoord(1)
  const invalidPrimitive = fixtureGeometry(invalidDocument, { normal: false, texcoord0: true })
    .setMaterial(invalidMaterial)
    .setExtras({ iomRequireAuthoredTangents: true })
  const invalidNode = invalidDocument.createNode('invalid-lit-primitive')
    .setMesh(invalidDocument.createMesh('invalid-mesh').addPrimitive(invalidPrimitive))
    .setExtras({ iomPackageSourcePath: 'duplicate/path', iomPackageSourcePaths: ['duplicate/path', 'unique/path'] })
  const noPositionPrimitive = fixtureGeometry(invalidDocument, { position: false, normal: true })
    .setMaterial(invalidDocument.createMaterial('missing-position-material'))
  const noPositionNode = invalidDocument.createNode('missing-position')
    .setMesh(invalidDocument.createMesh('missing-position-mesh').addPrimitive(noPositionPrimitive))
  const cameraNode = invalidDocument.createNode('forbidden-camera')
    .setCamera(invalidDocument.createCamera('fixture-camera'))
  const lights = invalidDocument.createExtension(KHRLightsPunctual)
  const lightNode = invalidDocument.createNode('forbidden-light')
    .setExtension('KHR_lights_punctual', lights.createLight('fixture-light').setType('point'))
  invalidDocument.createScene('fixture-scene')
    .addChild(invalidNode)
    .addChild(noPositionNode)
    .addChild(cameraNode)
    .addChild(lightNode)
  const invalidPath = resolve(FIXTURE_ROOT, 'known-invalid.glb')
  await io.write(invalidPath, invalidDocument)

  return { unlitPath, invalidPath }
}

function compactPayloadRecord(packageRecord, variant, inspection) {
  return {
    packageId: packageRecord.id,
    variant,
    path: inspection.file.path,
    sha256: inspection.file.sha256,
    bytes: inspection.file.bytes,
    expandedTriangles: inspection.geometry.expandedTriangles,
    primitiveDraws: inspection.geometry.primitiveDraws,
    ownerLocalBounds: inspection.geometry.ownerLocalBounds,
    primitiveLayoutCount: inspection.geometry.primitiveLayouts.length,
    sourcePathCount: inspection.sourceOwnership.pathCount,
    sourcePathsSha256: inspection.sourceOwnership.sortedOccurrencesSha256,
    duplicateSourcePathCount: inspection.sourceOwnership.duplicatePathCount,
    textureCount: inspection.textures.summary.textureCount,
    encodedTextureBytes: inspection.textures.summary.encodedBytes,
    decodedBytesFromAuthoredMips: inspection.textures.summary.decodedBytesFromAuthoredMips,
    conservativeGpuBytesWithFullMips: inspection.textures.summary.conservativeGpuBytesWithFullMips,
    inspectionSha256: inspection.inspectionSha256,
  }
}

await mkdir(OUTPUT_ROOT, { recursive: true })
const io = await createGltfIO({ encoder: true })
const index = JSON.parse(await readFile(PILOT_INDEX, 'utf8'))
const payloadRecords = []
const aggregate = {
  web: {
    payloads: 0,
    expandedTriangles: 0,
    primitiveDraws: 0,
    bytes: 0,
    encodedTextureBytes: 0,
    decodedBytesFromAuthoredMips: 0,
    conservativeGpuBytesWithFullMips: 0,
  },
  quest: {
    payloads: 0,
    expandedTriangles: 0,
    primitiveDraws: 0,
    bytes: 0,
    encodedTextureBytes: 0,
    decodedBytesFromAuthoredMips: 0,
    conservativeGpuBytesWithFullMips: 0,
  },
}

for (const packageRecord of index.packages) {
  for (const variant of ['web', 'quest']) {
    const relativePayloadPath = packageRecord.variants?.[variant]?.lod0?.url
    assert.ok(relativePayloadPath, `${packageRecord.id}:${variant} has no LOD0 URL`)
    const inspection = await inspectManifestV3Payload(
      resolve(PILOT_ROOT, relativePayloadPath),
      packageRecord,
      variant,
      'lod0',
      { io, baseDirectory: VIEWER_ROOT },
    )
    assert.equal(
      inspection.ok,
      true,
      `${packageRecord.id}:${variant} failed offline gate:\n${JSON.stringify(inspection.errors, null, 2)}`,
    )
    assert.deepEqual(inspection.geometry.missing, {
      positionPrimitives: 0,
      litNormalPrimitives: 0,
      referencedTexcoordSlots: 0,
      authoredTangentPrimitives: 0,
    })
    assert.equal(inspection.nonMeshRenderables.count, 0)
    assert.ok(inspection.geometry.primitiveLayouts.length > 0)
    for (const texture of inspection.textures.copies) {
      assert.ok(texture.dimensions.width > 0 && texture.dimensions.height > 0)
      assert.ok(texture.authoredMipLevels > 0)
      assert.ok(texture.conservativeGpuMipLevels >= texture.authoredMipLevels)
      assert.ok(texture.conservativeGpuBytesWithFullMips >= texture.decodedBytesFromAuthoredMips)
    }

    const record = compactPayloadRecord(packageRecord, variant, inspection)
    payloadRecords.push(record)
    const totals = aggregate[variant]
    totals.payloads += 1
    totals.expandedTriangles += record.expandedTriangles
    totals.primitiveDraws += record.primitiveDraws
    totals.bytes += record.bytes
    totals.encodedTextureBytes += record.encodedTextureBytes
    totals.decodedBytesFromAuthoredMips += record.decodedBytesFromAuthoredMips
    totals.conservativeGpuBytesWithFullMips += record.conservativeGpuBytesWithFullMips
  }
}

for (const variant of ['web', 'quest']) {
  assert.equal(aggregate[variant].payloads, index.packages.length)
  assert.equal(aggregate[variant].expandedTriangles, index.aggregate[variant].triangles)
  assert.equal(aggregate[variant].primitiveDraws, index.aggregate[variant].draws)
  assert.equal(aggregate[variant].bytes, index.aggregate[variant].bytes)
  assert.equal(aggregate[variant].encodedTextureBytes, index.aggregate[variant].encodedTextureBytes)
  assert.equal(aggregate[variant].conservativeGpuBytesWithFullMips, index.aggregate[variant].gpuTextureBytes)
}
assert.equal(aggregate.web.decodedBytesFromAuthoredMips, 1_315_357_040)
assert.equal(aggregate.web.conservativeGpuBytesWithFullMips, 1_315_357_040)
assert.equal(aggregate.quest.decodedBytesFromAuthoredMips, 522_699_668)
assert.equal(aggregate.quest.conservativeGpuBytesWithFullMips, 522_699_668)

const repeatInspection = await inspectStreamPayload(REPEAT_PAYLOAD, {
  io,
  baseDirectory: VIEWER_ROOT,
  ownerNodeName: 'Ground Floor._anim1',
  // This parity artifact intentionally retains its source clip and is not an
  // activation-ready manifest-v3 payload.
  rejectAnimations: false,
  declaredRequiredAttributes: ['POSITION', 'NORMAL'],
  expectations: {
    sha256: 'fbf172199f6f52e63e478bfddd34936ddb0f589fd8effbc105ddfb6077fe8c26',
    bytes: 1_571_576,
    expandedTriangles: 4_778_982,
    primitiveDraws: 52,
    encodedTextureBytes: 0,
  },
})
assert.equal(repeatInspection.ok, true, JSON.stringify(repeatInspection.errors, null, 2))
assert.equal(repeatInspection.textures.summary.textureCount, 0)
assert.equal(repeatInspection.geometry.primitiveLayouts.length, 52)
assert.equal(repeatInspection.geometry.missing.referencedTexcoordSlots, 0)
assert.ok(repeatInspection.geometry.primitiveLayouts.every((primitive) =>
  primitive.attributes.map((attribute) => attribute.semantic).join(',') === 'NORMAL,POSITION' &&
  primitive.material.textureSlots.length === 0,
))

// Repeat one real inspection to prove byte-for-byte deterministic output.
const repeatInspectionAgain = await inspectStreamPayload(REPEAT_PAYLOAD, {
  io,
  baseDirectory: VIEWER_ROOT,
  ownerNodeName: 'Ground Floor._anim1',
  rejectAnimations: false,
  declaredRequiredAttributes: ['POSITION', 'NORMAL'],
  expectations: {
    sha256: 'fbf172199f6f52e63e478bfddd34936ddb0f589fd8effbc105ddfb6077fe8c26',
    bytes: 1_571_576,
    expandedTriangles: 4_778_982,
    primitiveDraws: 52,
    encodedTextureBytes: 0,
  },
})
assert.equal(stablePayloadInspectionString(repeatInspectionAgain), stablePayloadInspectionString(repeatInspection))

const fixtures = await writeSyntheticFixtures(io)
const unlitInspection = await inspectStreamPayload(fixtures.unlitPath, { io, baseDirectory: VIEWER_ROOT })
assert.equal(unlitInspection.ok, true, JSON.stringify(unlitInspection.errors, null, 2))
assert.equal(unlitInspection.geometry.missing.litNormalPrimitives, 0)
assert.equal(unlitInspection.geometry.primitiveLayouts[0].material.unlit, true)
assert.equal(unlitInspection.geometry.primitiveLayouts[0].requirements.litNormal, false)

const invalidInspection = await inspectStreamPayload(fixtures.invalidPath, { io, baseDirectory: VIEWER_ROOT })
assert.equal(invalidInspection.ok, false)
const invalidCodes = invalidInspection.errors.map((error) => error.code)
for (const code of [
  'missing-position',
  'missing-lit-normal',
  'missing-referenced-texcoord',
  'missing-authored-tangent',
  'non-mesh-renderable',
]) {
  assert.ok(invalidCodes.includes(code), `Synthetic negative fixture did not produce ${code}`)
}
assert.equal(invalidInspection.nonMeshRenderables.count, 2)
assert.deepEqual(invalidInspection.nonMeshRenderables.items.map((item) => item.type).sort(), ['camera', 'punctual-light'])
assert.equal(invalidInspection.sourceOwnership.pathCount, 3)
assert.equal(invalidInspection.sourceOwnership.uniquePathCount, 2)
assert.equal(invalidInspection.sourceOwnership.duplicatePathCount, 1)
assert.deepEqual(invalidInspection.sourceOwnership.duplicatePaths, [
  { path: 'duplicate/path', count: 2, duplicateOccurrences: 1 },
])
assert.equal(invalidInspection.textures.summary.textureCount, 1)
assert.deepEqual(invalidInspection.textures.copies[0].dimensions, {
  width: 1,
  height: 1,
  depth: 1,
  layers: 1,
  faces: 1,
})
assert.equal(invalidInspection.textures.copies[0].encodedBytes, 68)
assert.equal(invalidInspection.textures.copies[0].decodedBytesFromAuthoredMips, 4)
assert.equal(invalidInspection.textures.copies[0].conservativeGpuBytesWithFullMips, 4)

payloadRecords.sort((a, b) => a.variant.localeCompare(b.variant) || a.packageId.localeCompare(b.packageId))
const reportCore = {
  schema: 'IOM_STREAM_PAYLOAD_OFFLINE_GATE_TEST',
  version: 1,
  inputs: {
    coalescedIndex: 'tmp/hlod-pilot-first-floor-coalesced/detail-package-index.json',
    coalescedPlanSha256: index.packaging.planSha256,
    packageCount: index.packages.length,
    payloadCount: payloadRecords.length,
    texturelessRepeatPayload: repeatInspection.file.path,
  },
  result: 'pass',
  aggregate,
  payloads: payloadRecords,
  texturelessRepeat: {
    sha256: repeatInspection.file.sha256,
    bytes: repeatInspection.file.bytes,
    expandedTriangles: repeatInspection.geometry.expandedTriangles,
    primitiveDraws: repeatInspection.geometry.primitiveDraws,
    ownerLocalBounds: repeatInspection.geometry.ownerLocalBounds,
    primitiveLayoutCount: repeatInspection.geometry.primitiveLayouts.length,
    attributeLayouts: [...new Set(repeatInspection.geometry.primitiveLayouts.map((primitive) =>
      primitive.attributes.map((attribute) => attribute.semantic).join(','),
    ))].sort(),
    textureCount: repeatInspection.textures.summary.textureCount,
    referencedTexcoordRequirements: repeatInspection.geometry.missing.referencedTexcoordSlots,
    deterministicInspectionSha256: repeatInspection.inspectionSha256,
  },
  syntheticCoverage: {
    unlitPositionOnlyAccepted: unlitInspection.ok,
    rejectedCodes: [...new Set(invalidCodes)].sort(),
    nonMeshRenderableTypes: invalidInspection.nonMeshRenderables.items.map((item) => item.type).sort(),
    sourceOwnership: invalidInspection.sourceOwnership,
    onePixelTexture: invalidInspection.textures.copies[0],
  },
}
const report = {
  ...reportCore,
  deterministicReportSha256: stablePayloadInspectionSha256(reportCore),
}
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
const reportRoundTrip = JSON.parse(await readFile(REPORT_PATH, 'utf8'))
assert.equal(reportRoundTrip.deterministicReportSha256, stablePayloadInspectionSha256(reportCore))

console.log(`PASS offline payload gate: ${payloadRecords.length} real coalesced payloads + UV-free Mesh.13786`)
console.log(`PASS Web: ${aggregate.web.expandedTriangles.toLocaleString()} tris, ${aggregate.web.primitiveDraws.toLocaleString()} draws, ${aggregate.web.encodedTextureBytes.toLocaleString()} encoded texture bytes`)
console.log(`PASS Quest: ${aggregate.quest.expandedTriangles.toLocaleString()} tris, ${aggregate.quest.primitiveDraws.toLocaleString()} draws, ${aggregate.quest.encodedTextureBytes.toLocaleString()} encoded texture bytes`)
console.log(`PASS deterministic report ${report.deterministicReportSha256}`)
console.log(`Report: ${REPORT_PATH}`)
