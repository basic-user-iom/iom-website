import assert from 'node:assert/strict'
import { Document, NodeIO } from '@gltf-transform/core'

import { applyOfflineBatchTransforms } from './offline-batch-model.mjs'
import {
  assertDoubleSidedMaterialInventory,
  doubleSidedMaterialInventory,
} from './lib/optimizer-material-safety.mjs'
import {
  IOM_SURFACE_TOPOLOGY_REPAIRED,
  IOM_SURFACE_TOPOLOGY_REPAIR,
  IOM_SURFACE_TOPOLOGY_REPAIR_VERSION,
  auditSurfaceRepairCertificates,
  meshSurfaceTopology,
  surfaceRepairCertificateExpectation,
} from './lib/surface-repair-certificate.mjs'
import { normalizeCadMaterialSidedness } from './run-gltfpack.mjs'

const CERTIFICATE = Object.freeze({
  [IOM_SURFACE_TOPOLOGY_REPAIRED]: true,
  [IOM_SURFACE_TOPOLOGY_REPAIR]: IOM_SURFACE_TOPOLOGY_REPAIR_VERSION,
})
const TETRA_POSITIONS = new Float32Array([
  0, 0, 0,
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
])
const TETRA_FACES_A = new Uint16Array([0, 2, 1, 0, 1, 3])
const TETRA_FACES_B = new Uint16Array([0, 3, 2, 1, 2, 3])
const TETRA_FACES = new Uint16Array([
  ...TETRA_FACES_A,
  ...TETRA_FACES_B,
])
const TETRA_DUPLICATE_WINDING_FACES = new Uint16Array([
  ...TETRA_FACES,
  0, 2, 1,
])

function fixtureDocument() {
  const document = new Document()
  document.createBuffer('fixture-buffer')
  const scene = document.createScene('fixture-scene')
  document.getRoot().setDefaultScene(scene)
  return { document, scene }
}

function accessor(document, name, type, array) {
  return document
    .createAccessor(name)
    .setType(type)
    .setArray(array)
    .setBuffer(document.getRoot().listBuffers()[0])
}

function addPrimitive(
  document,
  mesh,
  { name, positions, indices, material, mode = 4 },
) {
  const primitive = document
    .createPrimitive()
    .setMode(mode)
    .setAttribute(
      'POSITION',
      accessor(document, `${name}-position`, 'VEC3', positions),
    )
    .setIndices(accessor(document, `${name}-indices`, 'SCALAR', indices))
    .setMaterial(material)
  mesh.addPrimitive(primitive)
  return primitive
}

function tetraMesh(document, name, materials) {
  const mesh = document.createMesh(name)
  if (materials.length === 1) {
    addPrimitive(document, mesh, {
      name,
      positions: TETRA_POSITIONS,
      indices: TETRA_FACES,
      material: materials[0],
    })
  } else {
    addPrimitive(document, mesh, {
      name: `${name}-a`,
      positions: TETRA_POSITIONS,
      indices: TETRA_FACES_A,
      material: materials[0],
    })
    addPrimitive(document, mesh, {
      name: `${name}-b`,
      positions: TETRA_POSITIONS,
      indices: TETRA_FACES_B,
      material: materials[1],
    })
  }
  return mesh
}

function certifiedNode(document, scene, name, mesh) {
  const node = document.createNode(name).setMesh(mesh).setExtras(CERTIFICATE)
  scene.addChild(node)
  return node
}

function assertCertificateError(document, pattern) {
  assert.throws(() => auditSurfaceRepairCertificates(document), pattern)
}

// No certificate remains a valid conservative input.
{
  const { document, scene } = fixtureDocument()
  const material = document.createMaterial('legacy-material')
  scene.addChild(document.createNode('legacy-owner').setMesh(
    tetraMesh(document, 'legacy-mesh', [material]),
  ))
  const audit = auditSurfaceRepairCertificates(document)
  assert.equal(audit.certificateCount, 0)
  assert.equal(audit.certifiedMeshCount, 0)
}

// Exact values are mandatory; a malformed mesh claim must not be silently
// overwritten when node certificates are mirrored for gltfpack.
for (const extras of [
  {
    [IOM_SURFACE_TOPOLOGY_REPAIRED]: true,
  },
  {
    [IOM_SURFACE_TOPOLOGY_REPAIRED]: true,
    [IOM_SURFACE_TOPOLOGY_REPAIR]: 'weld-seams-v0',
  },
  {
    [IOM_SURFACE_TOPOLOGY_REPAIRED]: 'true',
    [IOM_SURFACE_TOPOLOGY_REPAIR]: IOM_SURFACE_TOPOLOGY_REPAIR_VERSION,
  },
]) {
  const { document, scene } = fixtureDocument()
  const mesh = tetraMesh(document, 'malformed-certificate-mesh', [
    document.createMaterial('malformed-certificate-material'),
  ])
  const node = document.createNode('malformed-owner').setMesh(mesh).setExtras(extras)
  scene.addChild(node)
  assertCertificateError(document, /non-exact-node-certificate/)
}

{
  const { document, scene } = fixtureDocument()
  const mesh = tetraMesh(document, 'stale-mesh-claim', [
    document.createMaterial('stale-mesh-material'),
  ])
  certifiedNode(document, scene, 'exact-owner', mesh)
  mesh.setExtras({
    [IOM_SURFACE_TOPOLOGY_REPAIRED]: true,
    [IOM_SURFACE_TOPOLOGY_REPAIR]: 'stale-version',
  })
  assert.throws(
    () => auditSurfaceRepairCertificates(document, { mirrorMeshCertificates: true }),
    /non-exact-mesh-certificate/,
  )
  assert.equal(mesh.getExtras()[IOM_SURFACE_TOPOLOGY_REPAIR], 'stale-version')
}

// A shared mesh is trusted only when every owner carries the exact claim.
{
  const { document, scene } = fixtureDocument()
  const mesh = tetraMesh(document, 'shared-certified-mesh', [
    document.createMaterial('shared-certified-material'),
  ])
  certifiedNode(document, scene, 'owner-a', mesh)
  certifiedNode(document, scene, 'owner-b', mesh)
  const audit = auditSurfaceRepairCertificates(document)
  assert.equal(audit.certificateCount, 2)
  assert.equal(audit.certifiedMeshCount, 1)
}

{
  const { document, scene } = fixtureDocument()
  const mesh = tetraMesh(document, 'partially-certified-mesh', [
    document.createMaterial('partially-certified-material'),
  ])
  certifiedNode(document, scene, 'certified-owner', mesh)
  scene.addChild(document.createNode('uncertified-owner').setMesh(mesh))
  assertCertificateError(document, /partially-certified-shared-mesh/)
}

// Material primitives are individually open, while the complete logical mesh
// is closed. The optimizer audit must evaluate the latter.
{
  const { document, scene } = fixtureDocument()
  const mesh = tetraMesh(document, 'multi-material-closed-mesh', [
    document.createMaterial('material-a'),
    document.createMaterial('material-b'),
  ])
  certifiedNode(document, scene, 'multi-material-owner', mesh)
  assert.equal(mesh.listPrimitives().length, 2)
  const topology = meshSurfaceTopology(mesh)
  assert.equal(topology.clean, true)
  assert.equal(topology.boundaryEdges, 0)
  assert.equal(topology.windingConflictEdges, 0)
  assert.equal(auditSurfaceRepairCertificates(document).certifiedMeshCount, 1)
}

// Unsupported loose-line geometry and open triangle surfaces invalidate a
// claim even when a clean closed component is also present.
{
  const { document, scene } = fixtureDocument()
  const material = document.createMaterial('loose-edge-material')
  const mesh = tetraMesh(document, 'loose-edge-mesh', [material])
  addPrimitive(document, mesh, {
    name: 'loose-line',
    positions: new Float32Array([2, 0, 0, 3, 0, 0]),
    indices: new Uint16Array([0, 1]),
    material,
    mode: 1,
  })
  certifiedNode(document, scene, 'loose-edge-owner', mesh)
  const topology = meshSurfaceTopology(mesh)
  assert.equal(topology.looseEdges, 1)
  assert.equal(topology.clean, false)
  assertCertificateError(document, /certified-damaged-topology/)
}

// Equal counts are insufficient: optimizer passes must preserve the exact
// logical owner inventory.
{
  const { document, scene } = fixtureDocument()
  const mesh = tetraMesh(document, 'owner-inventory-mesh', [
    document.createMaterial('owner-inventory-material'),
  ])
  const owner = certifiedNode(document, scene, 'original-owner', mesh)
  const sourceAudit = auditSurfaceRepairCertificates(document)
  owner.setName('different-owner')
  assert.throws(
    () => auditSurfaceRepairCertificates(document, {
      ...surfaceRepairCertificateExpectation(sourceAudit),
    }),
    /certificate-owner-inventory-mismatch/,
  )
}

// A valid repaired mesh becomes single-sided, but explicit glass, foliage,
// authored sheets, and safety roles remain protected even when certified.
{
  const { document, scene } = fixtureDocument()
  const materials = {
    repaired: document.createMaterial('Repaired wall').setDoubleSided(true),
    glass: document.createMaterial('glass_panel').setDoubleSided(true),
    foliage: document.createMaterial('foliage leaves').setDoubleSided(true),
    sheet: document.createMaterial('Authored panel').setDoubleSided(true).setExtras({
      iomDoubleSidedReason: 'authored-thin-sheet',
    }),
    safety: document.createMaterial('Fire cabinet metal').setDoubleSided(true).setExtras({
      iomMaterialRole: 'fire-safety-opaque',
    }),
  }
  for (const [name, material] of Object.entries(materials)) {
    certifiedNode(
      document,
      scene,
      `${name}-owner`,
      tetraMesh(document, `${name}-mesh`, [material]),
    )
  }
  const audit = auditSurfaceRepairCertificates(document)
  normalizeCadMaterialSidedness(document, audit.certifiedMeshes)
  assert.equal(materials.repaired.getDoubleSided(), false)
  assert.equal(materials.glass.getDoubleSided(), true)
  assert.equal(materials.foliage.getDoubleSided(), true)
  assert.equal(materials.sheet.getDoubleSided(), true)
  assert.equal(materials.safety.getDoubleSided(), true)
  assert.equal(materials.glass.getExtras().iomDoubleSidedReason, 'explicit-glass')
  assert.equal(materials.foliage.getExtras().iomDoubleSidedReason, 'explicit-sheet')
  assert.equal(materials.sheet.getExtras().iomDoubleSidedReason, 'authored-thin-sheet')
  assert.equal(materials.safety.getExtras().iomDoubleSidedReason, 'visibility-critical')
}

// The auditorium railing owner is erased by optimization, so its exact
// retained material is the narrow bridge to the mixed-winding audit. A
// damaged use stays two-sided through a material split; a clean shared use and
// a near-match remain single-sided.
{
  const { document, scene } = fixtureDocument()
  const railing = document.createMaterial('metal_gelnder').setDoubleSided(true)
  const damagedMesh = document.createMesh('generated-railing-damaged')
  const damagedPrimitive = addPrimitive(document, damagedMesh, {
    name: 'generated-railing-damaged',
    positions: TETRA_POSITIONS,
    indices: TETRA_DUPLICATE_WINDING_FACES,
    material: railing,
  })
  scene.addChild(document.createNode('mesh_1121_3').setMesh(damagedMesh))

  const cleanMesh = tetraMesh(document, 'generated-railing-clean', [railing])
  const cleanPrimitive = cleanMesh.listPrimitives()[0]
  scene.addChild(document.createNode('mesh_1121_4').setMesh(cleanMesh))

  const nearMatch = document.createMaterial('metal_gelnder_copy').setDoubleSided(false)
  const nearMatchMesh = document.createMesh('generated-railing-near-match')
  const nearMatchPrimitive = addPrimitive(document, nearMatchMesh, {
    name: 'generated-railing-near-match',
    positions: TETRA_POSITIONS,
    indices: TETRA_DUPLICATE_WINDING_FACES,
    material: nearMatch,
  })
  scene.addChild(document.createNode('mesh_1121_5').setMesh(nearMatchMesh))

  const result = normalizeCadMaterialSidedness(document)
  const damagedMaterial = damagedPrimitive.getMaterial()
  const cleanMaterial = cleanPrimitive.getMaterial()
  assert.equal(damagedMaterial.getDoubleSided(), true)
  assert.equal(
    damagedMaterial.getExtras().iomDoubleSidedReason,
    'audited-mixed-winding-shell',
  )
  assert.equal(cleanMaterial.getDoubleSided(), false)
  assert.notEqual(damagedMaterial, cleanMaterial)
  assert.equal(nearMatchPrimitive.getMaterial().getDoubleSided(), false)
  assert.equal(result.splitMaterials, 1)
}

// The photographed auditorium fence is the exact RG_Gelaender owner. Its
// chrome and wood materials are shared by clean geometry elsewhere, so the
// optimizer must split both damaged owner uses without widening the policy to
// either material name globally.
{
  const { document, scene } = fixtureDocument()
  const chrome = document.createMaterial('m.metal_chrome').setDoubleSided(true)
  const wood = document.createMaterial('vray Gelaender_Holz').setDoubleSided(true)
  const railingMesh = document.createMesh('Mesh.1877')
  const railingChromePrimitive = addPrimitive(document, railingMesh, {
    name: 'rg-gelaender-chrome',
    positions: TETRA_POSITIONS,
    indices: TETRA_DUPLICATE_WINDING_FACES,
    material: chrome,
  })
  const railingWoodPrimitive = addPrimitive(document, railingMesh, {
    name: 'rg-gelaender-wood',
    positions: TETRA_POSITIONS,
    indices: TETRA_DUPLICATE_WINDING_FACES,
    material: wood,
  })
  scene.addChild(document.createNode('RG_Gelaender').setMesh(railingMesh))

  const cleanChromeMesh = tetraMesh(document, 'clean-shared-chrome', [chrome])
  const cleanChromePrimitive = cleanChromeMesh.listPrimitives()[0]
  scene.addChild(document.createNode('clean-chrome-owner').setMesh(cleanChromeMesh))
  const cleanWoodMesh = tetraMesh(document, 'clean-shared-wood', [wood])
  const cleanWoodPrimitive = cleanWoodMesh.listPrimitives()[0]
  scene.addChild(document.createNode('clean-wood-owner').setMesh(cleanWoodMesh))

  const result = normalizeCadMaterialSidedness(document)
  for (const primitive of [railingChromePrimitive, railingWoodPrimitive]) {
    assert.equal(primitive.getMaterial().getDoubleSided(), true)
    assert.equal(
      primitive.getMaterial().getExtras().iomDoubleSidedReason,
      'audited-mixed-winding-shell',
    )
  }
  assert.equal(cleanChromePrimitive.getMaterial().getDoubleSided(), false)
  assert.equal(cleanWoodPrimitive.getMaterial().getDoubleSided(), false)
  assert.notEqual(railingChromePrimitive.getMaterial(), cleanChromePrimitive.getMaterial())
  assert.notEqual(railingWoodPrimitive.getMaterial(), cleanWoodPrimitive.getMaterial())
  assert.equal(result.splitMaterials, 2)
}

// Exercise the actual offline transform function and a GLB memory round trip.
// This represents the batching stage between the two gltfpack passes without
// invoking either external optimizer or touching project model files.
{
  const { document, scene } = fixtureDocument()
  const repaired = document.createMaterial('Offline repaired wall').setDoubleSided(true)
  const glass = document.createMaterial('glass_offline_panel').setDoubleSided(true)
  const mesh = tetraMesh(document, 'offline-multi-material-mesh', [repaired, glass])
  certifiedNode(document, scene, 'offline-owner-a', mesh)
  certifiedNode(document, scene, 'offline-owner-b', mesh)
  const sourceAudit = auditSurfaceRepairCertificates(document, {
    mirrorMeshCertificates: true,
  })
  normalizeCadMaterialSidedness(document, sourceAudit.certifiedMeshes)
  const materialInventory = doubleSidedMaterialInventory(document)
  const options = {
    minInstances: 3,
    joinSceneRoot: true,
    flattenStatic: false,
    cellSize: 18,
    floorBand: 4,
    maxBatchTriangles: 200_000,
  }
  const transformed = await applyOfflineBatchTransforms(
    document,
    options,
    sourceAudit,
  )
  assert.deepEqual(
    transformed.afterSurfaceRepairAudit.ownerNames,
    sourceAudit.ownerNames,
  )
  assertDoubleSidedMaterialInventory(document, materialInventory, 'Synthetic batch')

  const io = new NodeIO()
  const bytes = await io.writeBinary(document)
  const written = await io.readBinary(bytes)
  const writtenAudit = auditSurfaceRepairCertificates(written, {
    ...surfaceRepairCertificateExpectation(sourceAudit),
  })
  assert.equal(writtenAudit.certifiedMeshCount, 1)
  assertDoubleSidedMaterialInventory(written, materialInventory, 'Synthetic GLB round trip')
}

console.log('Surface-repair optimizer integration tests passed.')
