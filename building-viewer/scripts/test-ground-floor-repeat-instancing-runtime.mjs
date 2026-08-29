/**
 * Three.js + current ProceduralInstancing integration test for the disabled
 * Ground Floor repeat pilots. No renderer or browser is required.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Matrix4 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'meshoptimizer'
import { createServer } from 'vite'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const OUT = resolve(VIEWER_ROOT, 'tmp', 'repeat-instancing-ground-floor')
const OWNER = 'Ground Floor._anim1'

globalThis.self = globalThis

async function loadGlb(path) {
  const bytes = await readFile(path)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  return loader.parseAsync(buffer, '')
}

function hasAncestor(object, target) {
  let current = object
  while (current) {
    if (current === target) return true
    current = current.parent
  }
  return false
}

function instancedMeshes(root) {
  const meshes = []
  root.traverse((object) => {
    if (object.isInstancedMesh) meshes.push(object)
  })
  return meshes
}

function negativeLocalInstances(mesh) {
  const matrix = new Matrix4()
  let count = 0
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, matrix)
    if (matrix.determinant() < 0) count += 1
  }
  return count
}

function assertSpatialIdentity(meshes, variant, owner) {
  assert.equal(meshes.length, 52, `${variant}: expected 52 prepartitioned material draws`)
  assert.equal(meshes.reduce((sum, mesh) => sum + mesh.count, 0), 78 * 4)
  const idsBySlot = Array.from({ length: 4 }, () => [])
  for (const mesh of meshes) {
    assert.ok(hasAncestor(mesh, owner), `${variant}:${mesh.name} lost animation ownership`)
    assert.equal(mesh.userData.prepartitionedRepeatBatch, true)
    assert.equal(mesh.userData.repeatVariant, variant)
    assert.ok(Array.isArray(mesh.userData.sourceIds))
    assert.equal(mesh.userData.sourceIds.length, mesh.count)
    assert.equal(negativeLocalInstances(mesh), 0)
    assert.ok(mesh.userData.IOM_spatial)
    const expectedWorldSign = mesh.userData.instanceParity === 'mirrored' ? -1 : 1
    assert.equal(Math.sign(mesh.matrixWorld.determinant()), expectedWorldSign)
    const slot = mesh.userData.materialSlot
    assert.ok(Number.isInteger(slot) && slot >= 0 && slot < 4)
    idsBySlot[slot].push(...mesh.userData.sourceIds)
    assert.equal(mesh.geometry.getAttribute('_IOM_SOURCE_ID'), undefined)
  }
  for (let slot = 0; slot < 4; slot += 1) {
    assert.deepEqual(
      idsBySlot[slot].sort((a, b) => a - b),
      Array.from({ length: 78 }, (_, index) => index),
      `${variant}: source identity is not bijective in material slot ${slot}`,
    )
  }
}

const report = JSON.parse(await readFile(resolve(OUT, 'report.json'), 'utf8'))
const vite = await createServer({
  root: VIEWER_ROOT,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

try {
  const { splitImportedInstancedMeshesBySpatialCell } = await vite.ssrLoadModule('/src/scene/ProceduralInstancing.ts')
  for (const [variant, file] of [
    ['web', 'Mesh.13786-web-owner-local-parity-spatial-instanced.glb'],
    ['quest', 'Mesh.13786-quest-owner-local-parity-spatial-instanced.glb'],
  ]) {
    const gltf = await loadGlb(resolve(OUT, file))
    gltf.scene.updateMatrixWorld(true)
    const owner = gltf.scene.getObjectByProperty('userData.disabledPilotOwner', true)
      ?? (() => {
        let match = null
        gltf.scene.traverse((object) => {
          if (object.userData?.disabledPilotOwner) match = object
        })
        return match
      })()
    assert.ok(owner, `${variant}: persistent Ground Floor owner was not imported`)
    const before = instancedMeshes(gltf.scene)
    assertSpatialIdentity(before, variant, owner)
    const expectedTriangles = report.spatialPilots[variant].expandedTriangles
    const observedTriangles = before.reduce((sum, mesh) => {
      const index = mesh.geometry.getIndex()
      const position = mesh.geometry.getAttribute('position')
      return sum + Math.round((index ? index.count / 3 : position.count / 3) * mesh.count)
    }, 0)
    assert.equal(observedTriangles, expectedTriangles)

    const sceneMin = report.production[variant].sceneMinAtCombinedLoad
    const splitReport = splitImportedInstancedMeshesBySpatialCell(
      gltf.scene,
      {
        sceneMinX: sceneMin[0],
        sceneMinY: sceneMin[1],
        sceneMinZ: sceneMin[2],
        bandHeight: 3.6,
        cellSizeXz: 12,
        cellSizeY: 4,
        neighborCells: 1,
      },
      new Set([OWNER]),
    )
    assert.deepEqual(splitReport, {
      sourcesSplit: 0,
      groupsCreated: 0,
      negativeInstancesExtracted: 0,
    })
    gltf.scene.updateMatrixWorld(true)
    const after = instancedMeshes(gltf.scene)
    assertSpatialIdentity(after, variant, owner)
    assert.equal(after.length, report.spatialPilots[variant].expectedRuntimeDrawsAfterCurrentSpatialPass)
    console.log(`PASS ${variant}: 52 identity/parity/cell draws remain 52 after current runtime pass`)
  }

  // The eight-draw artifact remains useful as a draw/culling diagnostic, but
  // cannot carry stable custom IDs through Three's shared geometry or the
  // current spatial remap. Keep this failure explicit and deterministic.
  for (const [variant, file, expectedTriangles] of [
    ['web', 'Mesh.13786-owner-local-parity-instanced.glb', 4_778_982],
    ['quest', 'Mesh.13786-quest-owner-local-parity-instanced.glb', 1_711_398],
  ]) {
    const diagnostic = await loadGlb(resolve(OUT, file))
    diagnostic.scene.updateMatrixWorld(true)
    const diagnosticMeshes = instancedMeshes(diagnostic.scene)
    assert.equal(diagnosticMeshes.length, 8)
    assert.equal(diagnosticMeshes.reduce((sum, mesh) => sum + mesh.count, 0), 78 * 4)
    assert.ok(diagnosticMeshes.every((mesh) => negativeLocalInstances(mesh) === 0))
    assert.equal(
      diagnosticMeshes.reduce((sum, mesh) => {
        const index = mesh.geometry.getIndex()
        const position = mesh.geometry.getAttribute('position')
        return sum + Math.round((index ? index.count / 3 : position.count / 3) * mesh.count)
      }, 0),
      expectedTriangles,
    )
    assert.ok(
      diagnosticMeshes.some((mesh) => mesh.geometry.getAttribute('_IOM_SOURCE_ID')?.count !== mesh.count),
      `${variant}: expected shared-geometry custom-ID collision was not observed`,
    )
    const sceneMin = report.production[variant].sceneMinAtCombinedLoad
    const splitReport = splitImportedInstancedMeshesBySpatialCell(
      diagnostic.scene,
      {
        sceneMinX: sceneMin[0],
        sceneMinY: sceneMin[1],
        sceneMinZ: sceneMin[2],
        bandHeight: 3.6,
        cellSizeXz: 12,
        cellSizeY: 4,
        neighborCells: 1,
      },
      new Set([OWNER]),
    )
    assert.deepEqual(splitReport, {
      sourcesSplit: 8,
      groupsCreated: 52,
      negativeInstancesExtracted: 0,
    })
    console.log(`PASS ${variant} diagnostic: 8 parity-safe raw draws become 52 spatial draws; known custom-ID limitation remains gated`)
  }
} finally {
  await vite.close()
}
