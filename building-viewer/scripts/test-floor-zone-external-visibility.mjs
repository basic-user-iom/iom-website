import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')

function makeResidency(floorBand) {
  return {
    floorBand,
    floorBandMin: floorBand,
    floorBandMax: floorBand,
    cell: [0, floorBand, 0],
    cellXMin: 0,
    cellXMax: 0,
    cellYMin: floorBand,
    cellYMax: floorBand,
    cellZMin: 0,
    cellZMax: 0,
    alwaysOn: false,
  }
}

function makeMesh(name, floorBand, externalVisibilityOwner = null) {
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshBasicMaterial({ color: 0xffffff })
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.userData.IOM_spatial = makeResidency(floorBand)
  if (externalVisibilityOwner) {
    mesh.userData.externallyManagedVisibility = externalVisibilityOwner
  }
  return { mesh, geometry, material }
}

const vite = await createServer({
  root: PROJECT_DIR,
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
})

const resources = []

try {
  const { FloorZoneController } = await vite.ssrLoadModule('/src/performance/FloorZoneController.ts')
  const root = new Group()
  const near = makeMesh('ordinary-near-mesh', 0)
  const zoned = makeMesh('ordinary-upper-floor-mesh', 5)
  const catalog = makeMesh('catalog-upper-floor-mesh', 5, 'repeat-six-part-catalog')
  resources.push(near.geometry, near.material, zoned.geometry, zoned.material, catalog.geometry, catalog.material)
  root.add(near.mesh, zoned.mesh, catalog.mesh)

  const controller = new FloorZoneController()
  controller.rebuild(root, 0, 100, 30, 0, 0)

  assert.deepEqual(controller.getStats(), {
    enabled: true,
    bands: 2,
    activeBand: null,
    activeCellX: null,
    activeCellZ: null,
    tracked: 2,
    hidden: 0,
    alwaysOn: 0,
  })
  assert.equal(catalog.mesh.userData.floorResidency, undefined)

  controller.update(0, 0, 0, 1_000)
  assert.equal(near.mesh.visible, true, 'near ordinary mesh should remain resident')
  assert.equal(zoned.mesh.visible, false, 'upper-floor ordinary mesh should still be zoned out')
  assert.equal(catalog.mesh.visible, true, 'floor zoning overwrote catalog-owned visibility')
  assert.equal(controller.getStats().hidden, 1)

  catalog.mesh.visible = false
  controller.update(18, 0, 0, 2_000)
  assert.equal(zoned.mesh.visible, true, 'ordinary mesh should return in its active floor band')
  assert.equal(catalog.mesh.visible, false, 'floor zoning revealed a catalog-hidden mesh')

  controller.setEnabled(false)
  assert.equal(zoned.mesh.visible, true, 'disabling zoning should reveal tracked ordinary meshes')
  assert.equal(catalog.mesh.visible, false, 'disabling zoning touched externally managed visibility')

  controller.rebuild(root, 0, 100, 30, 0, 0)
  assert.equal(controller.getStats().tracked, 2)
  assert.equal(catalog.mesh.visible, false, 'rebuild touched externally managed visibility')
  assert.equal(catalog.mesh.userData.floorResidency, undefined)

  controller.update(0, 0, 0, 3_000)
  assert.equal(zoned.mesh.visible, false)
  assert.equal(catalog.mesh.visible, false)
  controller.dispose()
  assert.equal(zoned.mesh.visible, true, 'dispose should restore tracked ordinary visibility')
  assert.equal(catalog.mesh.visible, false, 'dispose touched externally managed visibility')

  console.log('Floor-zone external visibility ownership regression: PASS')
  console.log(JSON.stringify({
    trackedOrdinaryMeshes: 2,
    excludedCatalogMeshes: 1,
    verified: [
      'externally-managed-catalog-excluded-from-index',
      'ordinary-floor-zoning-preserved',
      'catalog-visibility-not-overwritten-by-update-disable-rebuild-or-dispose',
    ],
  }, null, 2))
} finally {
  for (const resource of resources) resource.dispose()
  await vite.close()
}
