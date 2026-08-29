import assert from 'node:assert/strict'
import { createServer } from 'vite'
import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

function openCornerGeometry() {
  // Two joined vertical wall sheets. Its AABB occupies all three axes, so the
  // former min-dimension heuristic incorrectly treated it as a closed volume.
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        0, 0, 0,
        0, 3, 0,
        0, 3, 4,
        0, 0, 4,
        4, 0, 0,
        4, 3, 0,
      ],
      3,
    ),
  )
  geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 5, 1, 0, 4, 5])
  geometry.computeVertexNormals()
  return geometry
}

function duplicateWindingGeometry() {
  // A closed tetrahedron with one duplicated same-winding face has no boundary
  // edge, but does have a confirmed CAD non-manifold/winding failure mode.
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([0, 0, 0, 0, 3, 0, 4, 0, 0, 0, 0, 4], 3),
  )
  geometry.setIndex([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3, 0, 2, 1])
  geometry.computeVertexNormals()
  return geometry
}

try {
  const [{ prepareArchitecturalMeshes }, { computeSceneBounds }, surfaceVisibility] =
    await Promise.all([
      vite.ssrLoadModule('/src/lighting/prepareArchitecturalMeshes.ts'),
      vite.ssrLoadModule('/src/scene/SceneBounds.ts'),
      vite.ssrLoadModule('/src/scene/surfaceVisibility.ts'),
    ])

  const closedGeometry = new BoxGeometry(4, 3, 4)
  const closedTopology = surfaceVisibility.inspectSurfaceTopology(closedGeometry)
  assert.equal(closedTopology.boundaryEdges, 0)
  assert.equal(closedTopology.windingConflictEdges, 0)
  assert.equal(surfaceVisibility.hasSurfaceVisibilityRisk(closedTopology), false)

  const cornerGeometry = openCornerGeometry()
  const cornerTopology = surfaceVisibility.inspectSurfaceTopology(cornerGeometry)
  assert.ok(cornerTopology.boundaryEdges > 0)
  assert.equal(surfaceVisibility.hasSurfaceVisibilityRisk(cornerTopology), true)

  // Shared source material must split per use: the open interior wall is
  // DoubleSide, while the watertight wall volume keeps back-face culling.
  const sharedWall = new MeshStandardMaterial({ name: 'm.wall.white', side: FrontSide })
  const closedWall = new Mesh(closedGeometry, sharedWall)
  closedWall.name = 'Closed wall volume'
  const openWall = new Mesh(cornerGeometry, sharedWall)
  openWall.name = 'BT3_innenwaende.004'
  openWall.position.x = 8
  const wallRoot = new Group()
  wallRoot.add(closedWall, openWall)
  prepareArchitecturalMeshes(wallRoot, computeSceneBounds(wallRoot), { freezeStatic: false })
  assert.equal(closedWall.material.side, FrontSide)
  assert.equal(openWall.material.side, DoubleSide)
  assert.notEqual(openWall.material, closedWall.material)
  assert.equal(openWall.userData.surfaceVisibilityRisk, true)
  assert.equal(openWall.userData.surfaceVisibilityReason, 'architectural-open-shell')

  // German plural/elided owner names and English plural material names occur
  // throughout the first-floor partitions. Topology still decides each use,
  // so a closed volume sharing the material keeps back-face culling.
  const sharedPluralWall = new MeshStandardMaterial({
    name: 'White Walls_Vray',
    side: FrontSide,
  })
  const closedPluralWall = new Mesh(new BoxGeometry(4, 3, 4), sharedPluralWall)
  closedPluralWall.name = 'Closed office volume'
  const cabinWall = new Mesh(openCornerGeometry(), sharedPluralWall)
  cabinWall.name = 'BT1_Kabinen_wnde52'
  cabinWall.position.x = 8
  const unnamedPluralWall = new Mesh(openCornerGeometry(), sharedPluralWall)
  unnamedPluralWall.position.x = 16
  const pluralRoot = new Group()
  pluralRoot.add(closedPluralWall, cabinWall, unnamedPluralWall)
  prepareArchitecturalMeshes(pluralRoot, computeSceneBounds(pluralRoot), {
    freezeStatic: false,
  })
  assert.equal(closedPluralWall.material.side, FrontSide)
  assert.equal(cabinWall.material.side, DoubleSide)
  assert.equal(unnamedPluralWall.material.side, DoubleSide)
  assert.notEqual(cabinWall.material, closedPluralWall.material)

  // S11/S12/S21/S22 partitions are boundary-free but contain confirmed
  // same-direction winding pairs. The audited ancestor must protect child
  // primitives after GLTFLoader assigns them generic mesh names.
  const partitionNode = new Group()
  partitionNode.name = 'S12_trennwand'
  const partitionPrimitive = new Mesh(
    duplicateWindingGeometry(),
    new MeshStandardMaterial({ name: 'wall_raster_wood_010', side: FrontSide }),
  )
  partitionPrimitive.name = 'mesh_199'
  partitionNode.add(partitionPrimitive)
  const partitionRoot = new Group()
  partitionRoot.add(partitionNode)
  prepareArchitecturalMeshes(partitionRoot, computeSceneBounds(partitionRoot), {
    freezeStatic: false,
  })
  assert.equal(partitionPrimitive.material.side, DoubleSide)
  assert.equal(
    partitionPrimitive.userData.surfaceVisibilityReason,
    'audited-mixed-winding-shell',
  )

  // gltfpack batching drops the Flugturm node name. Its isolated source
  // material remains a deterministic bridge to the audited open shell.
  const tower = new Mesh(openCornerGeometry(), new MeshStandardMaterial({
    name: 'mat_24 - Default_001',
    side: FrontSide,
  }))
  const towerRoot = new Group()
  towerRoot.add(tower)
  prepareArchitecturalMeshes(towerRoot, computeSceneBounds(towerRoot), { freezeStatic: false })
  assert.equal(tower.material.side, DoubleSide)
  assert.equal(tower.userData.surfaceVisibilityReason, 'audited-open-shell')

  // Exterior CAD also uses German building/hall owner names with generic
  // materials. Keep those open envelopes visible before optimization strips
  // the source node names (for example GebudeWest / NebenGebude23).
  const buildingShell = new Mesh(
    openCornerGeometry(),
    new MeshStandardMaterial({ name: 'Generic facade paint', side: FrontSide }),
  )
  buildingShell.name = 'GebudeWest'
  const buildingRoot = new Group()
  buildingRoot.add(buildingShell)
  prepareArchitecturalMeshes(buildingRoot, computeSceneBounds(buildingRoot), {
    freezeStatic: false,
  })
  assert.equal(buildingShell.material.side, DoubleSide)
  assert.equal(buildingShell.userData.surfaceVisibilityReason, 'architectural-open-shell')

  const mixedWinding = new Mesh(
    duplicateWindingGeometry(),
    new MeshStandardMaterial({ name: 'Generic interior paint', side: FrontSide }),
  )
  mixedWinding.name = 'Wand_40.005'
  const mixedWindingRoot = new Group()
  mixedWindingRoot.add(mixedWinding)
  prepareArchitecturalMeshes(
    mixedWindingRoot,
    computeSceneBounds(mixedWindingRoot),
    { freezeStatic: false },
  )
  assert.equal(mixedWinding.material.side, DoubleSide)
  assert.equal(mixedWinding.userData.surfaceVisibilityReason, 'audited-mixed-winding-shell')

  // Geometry alone is intentionally insufficient: arbitrary open props stay
  // culled unless they are thin or carry an architectural/safety semantic.
  const generic = new Mesh(
    openCornerGeometry(),
    new MeshStandardMaterial({ name: 'Generic opaque prop', side: FrontSide }),
  )
  const genericRoot = new Group()
  genericRoot.add(generic)
  prepareArchitecturalMeshes(genericRoot, computeSceneBounds(genericRoot), { freezeStatic: false })
  assert.equal(generic.material.side, FrontSide)
  assert.equal(generic.userData.surfaceVisibilityRisk, undefined)

  // The ICM elevated gangway has downward-wound top triangles in the source.
  // Its exact authored deck semantic must force two-sided rendering without
  // turning fuzzy `gitter` / grille matches into walk surfaces.
  const gangway = new Mesh(
    new BoxGeometry(4, 0.2, 2),
    new MeshStandardMaterial({
      name: 'vray Bruecke_Gitter_saal_14',
      side: FrontSide,
    }),
  )
  gangway.name = 'Gangway_Raster'
  const gangwayRoot = new Group()
  gangwayRoot.add(gangway)
  prepareArchitecturalMeshes(gangwayRoot, computeSceneBounds(gangwayRoot), {
    freezeStatic: false,
  })
  assert.equal(gangway.material.side, DoubleSide)
  assert.equal(gangway.userData.iomExplicitWalkable, true)

  const fuzzyGangway = new Mesh(
    new BoxGeometry(4, 0.2, 2),
    new MeshStandardMaterial({
      name: 'vray Bruecke_Gitter_saal_14_copy',
      side: FrontSide,
    }),
  )
  fuzzyGangway.name = 'Gangway_Raster'
  const fuzzyGangwayRoot = new Group()
  fuzzyGangwayRoot.add(fuzzyGangway)
  prepareArchitecturalMeshes(
    fuzzyGangwayRoot,
    computeSceneBounds(fuzzyGangwayRoot),
    { freezeStatic: false },
  )
  assert.equal(fuzzyGangway.material.side, FrontSide)
  assert.equal(fuzzyGangway.userData.iomExplicitWalkable, undefined)

  // Overlapping façade louvers retain their explicit single-sided exception.
  const shutter = new Mesh(
    openCornerGeometry(),
    new MeshStandardMaterial({ name: 'louver', side: DoubleSide }),
  )
  shutter.name = 'façade shutter'
  const shutterRoot = new Group()
  shutterRoot.add(shutter)
  prepareArchitecturalMeshes(shutterRoot, computeSceneBounds(shutterRoot), { freezeStatic: false })
  assert.equal(shutter.material.side, FrontSide)

  // Fire-safety slots are explicitly visibility-critical and may be small.
  const safetyMaterial = new MeshStandardMaterial({ name: 'Fire body', side: FrontSide })
  safetyMaterial.userData.iomMaterialRole = 'fire-safety-opaque'
  const safety = new Mesh(openCornerGeometry(), safetyMaterial)
  const safetyRoot = new Group()
  safetyRoot.add(safety)
  prepareArchitecturalMeshes(safetyRoot, computeSceneBounds(safetyRoot), { freezeStatic: false })
  assert.equal(safety.material.side, DoubleSide)
  assert.equal(safety.userData.surfaceVisibilityReason, 'visibility-critical')

  console.log('Surface visibility regression checks passed')
} finally {
  await vite.close()
}
