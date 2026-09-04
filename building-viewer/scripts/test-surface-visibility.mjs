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
  PlaneGeometry,
} from 'three'

// Keep the offline optimizer/certificate handoff on the routine viewer build
// path instead of relying on a manually invoked companion test.
await import('./test-surface-repair-optimizer-integration.mjs')

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

function tetraPrimitiveGeometry(indices) {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([0, 0, 0, 0, 3, 0, 4, 0, 0, 0, 0, 4], 3),
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function tetraWithLooseVertexGeometry() {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [0, 0, 0, 0, 3, 0, 4, 0, 0, 0, 0, 4, 7, 7, 7],
      3,
    ),
  )
  geometry.setIndex([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3])
  geometry.computeVertexNormals()
  return geometry
}

function tetraWithMalformedIndexCountGeometry() {
  const geometry = tetraPrimitiveGeometry([
    0, 2, 1,
    0, 1, 3,
    1, 2, 3,
    2, 0, 3,
    0,
  ])
  return geometry
}

function tetraWithDegenerateTriangleGeometry() {
  return tetraPrimitiveGeometry([
    0, 2, 1,
    0, 1, 3,
    1, 2, 3,
    2, 0, 3,
    0, 0, 0,
  ])
}

function tetraWithInvalidIndexGeometry() {
  return tetraPrimitiveGeometry([
    0, 2, 1,
    0, 1, 3,
    1, 2, 3,
    2, 0, 99,
  ])
}

const SURFACE_REPAIR_VERSION = 'weld-seams-recalculate-normals-v1'

function certifySurface(obj, flag = true, version = SURFACE_REPAIR_VERSION) {
  obj.userData.iomSurfaceTopologyRepaired = flag
  obj.userData.iomSurfaceTopologyRepair = version
}

try {
  const [
    { prepareArchitecturalMeshes },
    { computeSceneBounds },
    surfaceVisibility,
    { registerGltfLogicalMeshAssociations },
  ] =
    await Promise.all([
      vite.ssrLoadModule('/src/lighting/prepareArchitecturalMeshes.ts'),
      vite.ssrLoadModule('/src/scene/SceneBounds.ts'),
      vite.ssrLoadModule('/src/scene/surfaceVisibility.ts'),
      vite.ssrLoadModule('/src/scene/GltfLogicalMeshAssociationRegistry.ts'),
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

  // The current optimized auditorium GLBs contain two unnamed instanced door
  // aggregates, but Web and Quest assign different generated mesh ordinals.
  // The exact retained primitive material is stable; topology must still prove
  // the defect, and neither a clean use nor another damaged material is widened.
  const sharedFoyerDoorMaterial = new MeshStandardMaterial({
    name: 'wall_raster_wood_002',
    side: FrontSide,
  })
  const unnamedAuditoriumAggregate = new Mesh(
    duplicateWindingGeometry(),
    sharedFoyerDoorMaterial,
  )
  unnamedAuditoriumAggregate.name = 'mesh_1153'
  const profileShiftedAuditoriumAggregate = new Mesh(
    duplicateWindingGeometry(),
    sharedFoyerDoorMaterial,
  )
  profileShiftedAuditoriumAggregate.name = 'mesh_1155'
  profileShiftedAuditoriumAggregate.position.x = 8
  const cleanFoyerDoorUse = new Mesh(new BoxGeometry(4, 3, 4), sharedFoyerDoorMaterial)
  cleanFoyerDoorUse.name = 'mesh_1154'
  cleanFoyerDoorUse.position.x = 16
  const unrelatedGeneratedMesh = new Mesh(
    duplicateWindingGeometry(),
    new MeshStandardMaterial({ name: 'Generic wall raster', side: FrontSide }),
  )
  unrelatedGeneratedMesh.name = 'mesh_1156'
  unrelatedGeneratedMesh.position.x = 24
  const unnamedAuditoriumRoot = new Group()
  unnamedAuditoriumRoot.add(
    unnamedAuditoriumAggregate,
    profileShiftedAuditoriumAggregate,
    cleanFoyerDoorUse,
    unrelatedGeneratedMesh,
  )
  prepareArchitecturalMeshes(
    unnamedAuditoriumRoot,
    computeSceneBounds(unnamedAuditoriumRoot),
    { freezeStatic: false },
  )
  assert.equal(unnamedAuditoriumAggregate.material.side, DoubleSide)
  assert.equal(
    unnamedAuditoriumAggregate.userData.surfaceVisibilityReason,
    'audited-mixed-winding-shell',
  )
  assert.equal(profileShiftedAuditoriumAggregate.material.side, DoubleSide)
  assert.equal(
    profileShiftedAuditoriumAggregate.userData.surfaceVisibilityReason,
    'audited-mixed-winding-shell',
  )
  assert.equal(cleanFoyerDoorUse.material.side, FrontSide)
  assert.equal(unrelatedGeneratedMesh.material.side, FrontSide)
  assert.notEqual(unnamedAuditoriumAggregate.material, cleanFoyerDoorUse.material)

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

  // The exterior campus roof reported in production is a very large, almost
  // horizontal open shell. Its exact source material must reach the topology
  // audit even though the generic large-horizontal shortcut normally skips
  // that work. A closed roof volume sharing the material remains FrontSide.
  const sharedCampusRoof = new MeshStandardMaterial({ name: 'dach allu', side: FrontSide })
  const campusRoofGeometry = new PlaneGeometry(100, 80)
  campusRoofGeometry.rotateX(-Math.PI / 2)
  const campusRoof = new Mesh(campusRoofGeometry, sharedCampusRoof)
  campusRoof.name = 'Campus main roof shell'
  const closedCampusRoof = new Mesh(new BoxGeometry(8, 0.5, 8), sharedCampusRoof)
  closedCampusRoof.name = 'Closed roof curb'
  closedCampusRoof.position.x = 65
  const campusRoofRoot = new Group()
  campusRoofRoot.add(campusRoof, closedCampusRoof)
  prepareArchitecturalMeshes(campusRoofRoot, computeSceneBounds(campusRoofRoot), {
    freezeStatic: false,
  })
  assert.equal(campusRoof.material.side, DoubleSide)
  assert.equal(campusRoof.userData.surfaceVisibilityReason, 'audited-open-shell')
  assert.ok(campusRoof.userData.surfaceTopology.boundaryEdges > 0)
  assert.equal(closedCampusRoof.material.side, FrontSide)
  assert.notEqual(campusRoof.material, closedCampusRoof.material)

  // The auditorium aisle/tier batches lose their source node names during
  // optimization. Their exact retained materials are the narrow semantic
  // bridge to the topology audit; unrelated watertight uses stay FrontSide.
  for (const materialName of ['Floor_Wood_Vray_001', 'Treppen all.001', 'Rang_Dunkel']) {
    const sharedAuditoriumMaterial = new MeshStandardMaterial({
      name: materialName,
      side: FrontSide,
    })
    const openAuditoriumSurface = new Mesh(openCornerGeometry(), sharedAuditoriumMaterial)
    const closedAuditoriumVolume = new Mesh(
      new BoxGeometry(4, 3, 4),
      sharedAuditoriumMaterial,
    )
    closedAuditoriumVolume.position.x = 8
    const auditoriumRoot = new Group()
    auditoriumRoot.add(openAuditoriumSurface, closedAuditoriumVolume)
    prepareArchitecturalMeshes(auditoriumRoot, computeSceneBounds(auditoriumRoot), {
      freezeStatic: false,
    })
    assert.equal(openAuditoriumSurface.material.side, DoubleSide, materialName)
    assert.equal(
      openAuditoriumSurface.userData.surfaceVisibilityReason,
      'audited-open-shell',
      materialName,
    )
    assert.equal(closedAuditoriumVolume.material.side, FrontSide, materialName)
    assert.notEqual(openAuditoriumSurface.material, closedAuditoriumVolume.material)
  }

  // Exact rear-auditorium owners are known mixed-winding CAD assemblies.
  // Include a numbered leaf batch and the boundary-free wood-panel batch.
  for (const ownerName of [
    'tuer_hinten_02.001',
    'tuer_hinten_005',
    'Tueren_Holz.001',
    'tuer_1',
    'bt3_glas_tuer_geteilt',
    'bt3_glas_tuer_geteilt001.001',
    'Object010',
  ]) {
    const portalPrimitive = new Mesh(
      duplicateWindingGeometry(),
      new MeshStandardMaterial({
        name: ownerName.startsWith('bt3_glas_') ? 'm.metal.alum.r' : 'Generic portal finish',
        side: FrontSide,
      }),
    )
    portalPrimitive.name = 'mesh_617'
    const portalOwner = new Group()
    portalOwner.name = ownerName
    portalOwner.add(portalPrimitive)
    const portalRoot = new Group()
    portalRoot.add(portalOwner)
    prepareArchitecturalMeshes(portalRoot, computeSceneBounds(portalRoot), {
      freezeStatic: false,
    })
    assert.equal(portalPrimitive.material.side, DoubleSide, ownerName)
    assert.equal(
      portalPrimitive.userData.surfaceVisibilityReason,
      'audited-mixed-winding-shell',
      ownerName,
    )
  }

  // Several interior roof/ceiling owners are closed in AABB terms but contain
  // duplicated or inconsistent winding. Their audited hierarchy name must
  // retain both faces without applying the rule to every roof-like object.
  const auditedInteriorShellNames = [
    'Foyer_Dach_aussen_1',
    'Foyer_Dach_aussen_002',
    'Decken_Lampen',
    'EG_decke_bergang_aussen',
    'Buhne_aufbau_decke',
    'Saal_1_deckenpaneele_lftung001',
  ]
  for (const shellName of auditedInteriorShellNames) {
    const interiorShell = new Mesh(
      duplicateWindingGeometry(),
      new MeshStandardMaterial({ name: 'Generic audited shell', side: FrontSide }),
    )
    interiorShell.name = shellName
    const interiorShellRoot = new Group()
    interiorShellRoot.add(interiorShell)
    prepareArchitecturalMeshes(
      interiorShellRoot,
      computeSceneBounds(interiorShellRoot),
      { freezeStatic: false },
    )
    assert.equal(interiorShell.material.side, DoubleSide, shellName)
    assert.equal(
      interiorShell.userData.surfaceVisibilityReason,
      'audited-mixed-winding-shell',
      shellName,
    )
  }

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

  // Only the exact two-value certificate can exempt an audited repaired
  // owner, and runtime independently confirms that its geometry remains clean.
  const validRepaired = new Mesh(
    new BoxGeometry(4, 3, 4),
    new MeshStandardMaterial({ name: 'Repaired wall', side: DoubleSide }),
  )
  validRepaired.name = 'Wand_40.005'
  certifySurface(validRepaired)
  const validRepairedRoot = new Group()
  validRepairedRoot.add(validRepaired)
  prepareArchitecturalMeshes(
    validRepairedRoot,
    computeSceneBounds(validRepairedRoot),
    { freezeStatic: false },
  )
  assert.equal(validRepaired.material.side, FrontSide)

  // Certificate validation must not reuse the application-wide topology
  // cache. Mutating the same BufferGeometry instance after a clean pass must
  // revoke the exemption on the next preparation pass.
  validRepaired.geometry.setIndex([0, 1, 2, 0, 1, 2])
  prepareArchitecturalMeshes(
    validRepairedRoot,
    computeSceneBounds(validRepairedRoot),
    { freezeStatic: false },
  )
  assert.equal(validRepaired.material.side, DoubleSide)
  assert.equal(validRepaired.userData.surfaceTopologyRepairRejected, true)

  const thinValidRepaired = new Mesh(
    new BoxGeometry(4, 0.04, 4),
    new MeshStandardMaterial({ name: 'Thin repaired volume', side: DoubleSide }),
  )
  thinValidRepaired.name = 'Wand_40.005'
  certifySurface(thinValidRepaired)
  const thinValidRoot = new Group()
  thinValidRoot.add(thinValidRepaired)
  prepareArchitecturalMeshes(thinValidRoot, computeSceneBounds(thinValidRoot), {
    freezeStatic: false,
  })
  assert.equal(thinValidRepaired.material.side, FrontSide)

  const certificateVariants = [
    { label: 'missing', flag: undefined, version: undefined },
    { label: 'wrong-version', flag: true, version: 'weld-seams-v0' },
    { label: 'non-boolean', flag: 'true', version: SURFACE_REPAIR_VERSION },
    { label: 'flag-only', flag: true, version: undefined },
    { label: 'version-only', flag: undefined, version: SURFACE_REPAIR_VERSION },
  ]
  for (const variant of certificateVariants) {
    const candidate = new Mesh(
      new BoxGeometry(4, 3, 4),
      new MeshStandardMaterial({ name: `Certificate ${variant.label}`, side: FrontSide }),
    )
    candidate.name = 'Wand_40.005'
    if (variant.flag !== undefined)
      candidate.userData.iomSurfaceTopologyRepaired = variant.flag
    if (variant.version !== undefined)
      candidate.userData.iomSurfaceTopologyRepair = variant.version
    const candidateRoot = new Group()
    candidateRoot.add(candidate)
    prepareArchitecturalMeshes(candidateRoot, computeSceneBounds(candidateRoot), {
      freezeStatic: false,
    })
    assert.equal(candidate.material.side, DoubleSide, variant.label)
    assert.equal(candidate.userData.surfaceTopologyRepairRejected, true, variant.label)
  }

  const malformedGeneric = new Mesh(
    new BoxGeometry(4, 3, 4),
    new MeshStandardMaterial({ name: 'Malformed generic claim', side: FrontSide }),
  )
  malformedGeneric.userData.iomSurfaceTopologyRepaired = true
  const malformedGenericRoot = new Group()
  malformedGenericRoot.add(malformedGeneric)
  prepareArchitecturalMeshes(
    malformedGenericRoot,
    computeSceneBounds(malformedGenericRoot),
    { freezeStatic: false },
  )
  assert.equal(malformedGeneric.material.side, DoubleSide)
  assert.equal(
    malformedGeneric.userData.surfaceTopologyRepairRejectionReason,
    'malformed-certificate',
  )

  const forgedDamagedRepair = new Mesh(
    duplicateWindingGeometry(),
    new MeshStandardMaterial({ name: 'Forged repaired wall', side: FrontSide }),
  )
  forgedDamagedRepair.name = 'Wand_40.005'
  certifySurface(forgedDamagedRepair)
  const forgedDamagedRoot = new Group()
  forgedDamagedRoot.add(forgedDamagedRepair)
  prepareArchitecturalMeshes(
    forgedDamagedRoot,
    computeSceneBounds(forgedDamagedRoot),
    { freezeStatic: false },
  )
  assert.equal(forgedDamagedRepair.material.side, DoubleSide)
  assert.equal(
    forgedDamagedRepair.userData.surfaceVisibilityReason,
    'audited-mixed-winding-shell',
  )

  // Runtime revalidation must reject every topology class rejected by the
  // optimizer, even when the visible triangle shell itself looks closed.
  for (const [label, geometry] of [
    ['loose-vertex', tetraWithLooseVertexGeometry()],
    ['malformed-index-count', tetraWithMalformedIndexCountGeometry()],
    ['degenerate-triangle', tetraWithDegenerateTriangleGeometry()],
    ['invalid-index-reference', tetraWithInvalidIndexGeometry()],
  ]) {
    const candidate = new Mesh(
      geometry,
      new MeshStandardMaterial({ name: `Certified ${label}`, side: FrontSide }),
    )
    candidate.name = 'Wand_40.005'
    certifySurface(candidate)
    const root = new Group()
    root.add(candidate)
    prepareArchitecturalMeshes(root, computeSceneBounds(root), {
      freezeStatic: false,
    })
    assert.equal(candidate.material.side, DoubleSide, label)
    assert.equal(candidate.userData.surfaceTopologyRepairRejected, true, label)
    assert.equal(
      candidate.userData.surfaceTopologyRepairRejectionReason,
      'unbound-or-damaged-certificate',
      label,
    )
  }

  // The two Blender-rejected targets must remain uncertified and on the old
  // conservative path.
  for (const rejectedTargetName of [
    'BT3_innenwaende.002',
    'BT3_innenwaende.006',
  ]) {
    const rejectedTarget = new Mesh(
      new BoxGeometry(4, 3, 4),
      new MeshStandardMaterial({ name: 'Rejected wall', side: FrontSide }),
    )
    rejectedTarget.name = rejectedTargetName
    const rejectedRoot = new Group()
    rejectedRoot.add(rejectedTarget)
    prepareArchitecturalMeshes(rejectedRoot, computeSceneBounds(rejectedRoot), {
      freezeStatic: false,
    })
    assert.equal(
      rejectedTarget.userData.iomSurfaceTopologyRepaired,
      undefined,
      rejectedTargetName,
    )
    assert.equal(
      rejectedTarget.userData.iomSurfaceTopologyRepair,
      undefined,
      rejectedTargetName,
    )
    assert.equal(rejectedTarget.material.side, DoubleSide, rejectedTargetName)
  }

  // The water material shortcut must not override the certificate fail-closed
  // decision or share a FrontSide cache entry with ordinary water.
  const sharedWater = new MeshStandardMaterial({ name: 'water', side: FrontSide })
  const ordinaryWater = new Mesh(new BoxGeometry(4, 0.2, 4), sharedWater)
  ordinaryWater.name = 'Pool surface'
  const rejectedWater = new Mesh(new BoxGeometry(4, 3, 4), sharedWater)
  rejectedWater.name = 'BT3_innenwaende.002'
  rejectedWater.position.x = 8
  rejectedWater.userData.iomSurfaceTopologyRepaired = true
  const waterRoot = new Group()
  waterRoot.add(ordinaryWater, rejectedWater)
  prepareArchitecturalMeshes(waterRoot, computeSceneBounds(waterRoot), {
    freezeStatic: false,
  })
  assert.equal(ordinaryWater.material.side, FrontSide)
  assert.equal(rejectedWater.material.side, DoubleSide)
  assert.notEqual(ordinaryWater.material, rejectedWater.material)
  assert.equal(rejectedWater.userData.surfaceTopologyRepairRejected, true)
  assert.equal(
    rejectedWater.material.userData.iomDoubleSidedReason,
    'surface-topology-repair-fail-closed',
  )

  // A certificate on an arbitrary ancestor never exempts nested unrelated
  // geometry, even when the ancestor carries an audited source name.
  const certifiedParent = new Group()
  certifiedParent.name = 'Wand_40.005'
  certifySurface(certifiedParent)
  const unrelatedBranch = new Group()
  const unrelatedDescendant = new Mesh(
    duplicateWindingGeometry(),
    new MeshStandardMaterial({ name: 'Unrelated descendant', side: FrontSide }),
  )
  unrelatedBranch.add(unrelatedDescendant)
  certifiedParent.add(unrelatedBranch)
  const certifiedParentRoot = new Group()
  certifiedParentRoot.add(certifiedParent)
  prepareArchitecturalMeshes(
    certifiedParentRoot,
    computeSceneBounds(certifiedParentRoot),
    { freezeStatic: false },
  )
  assert.equal(unrelatedDescendant.material.side, DoubleSide)

  // An ordinary glTF hierarchy group is not a logical multi-primitive mesh.
  // Even unnamed direct Mesh children with a clean combined topology must not
  // inherit a parent-only certificate. Child-node parser associations are not
  // primitive-owner provenance either.
  const ordinaryCertifiedParent = new Group()
  ordinaryCertifiedParent.name = 'Wand_40.005'
  ordinaryCertifiedParent.userData.name = ordinaryCertifiedParent.name
  certifySurface(ordinaryCertifiedParent)
  const unrelatedGeometryA = new BoxGeometry(4, 3, 4)
  const unrelatedGeometryB = new BoxGeometry(4, 3, 4)
  unrelatedGeometryB.translate(8, 0, 0)
  const unrelatedDirectA = new Mesh(
    unrelatedGeometryA,
    new MeshStandardMaterial({ name: 'Unrelated child A', side: DoubleSide }),
  )
  const unrelatedDirectB = new Mesh(
    unrelatedGeometryB,
    new MeshStandardMaterial({ name: 'Unrelated child B', side: DoubleSide }),
  )
  for (const unrelatedDirect of [unrelatedDirectA, unrelatedDirectB]) {
    ordinaryCertifiedParent.add(unrelatedDirect)
  }
  const ordinaryCertifiedRoot = new Group()
  ordinaryCertifiedRoot.add(ordinaryCertifiedParent)
  assert.equal(
    registerGltfLogicalMeshAssociations({
      scene: ordinaryCertifiedRoot,
      scenes: [ordinaryCertifiedRoot],
      parser: {
        associations: new Map([
          [ordinaryCertifiedParent, { nodes: 4, meshes: 7 }],
          [unrelatedDirectA, { nodes: 5, meshes: 7, primitives: 0 }],
          [unrelatedDirectB, { nodes: 6, meshes: 7, primitives: 1 }],
        ]),
      },
    }),
    0,
  )
  prepareArchitecturalMeshes(
    ordinaryCertifiedRoot,
    computeSceneBounds(ordinaryCertifiedRoot),
    { freezeStatic: false },
  )
  assert.equal(unrelatedDirectA.material.side, DoubleSide)
  assert.equal(unrelatedDirectB.material.side, DoubleSide)
  assert.equal(
    unrelatedDirectA.userData.surfaceTopologyRepairRejectionReason,
    'unbound-or-damaged-certificate',
  )

  // Material primitives may each be open at their shared boundary. Their
  // strict glTF logical-mesh owner is eligible only when the combined topology
  // is closed and consistently wound.
  const multiMaterialOwner = new Group()
  multiMaterialOwner.name = 'S11_trennwand'
  multiMaterialOwner.userData.name = multiMaterialOwner.name
  certifySurface(multiMaterialOwner)
  const multiMaterialA = new Mesh(
    tetraPrimitiveGeometry([0, 2, 1, 0, 1, 3]),
    new MeshStandardMaterial({ name: 'Repaired material A', side: DoubleSide }),
  )
  const multiMaterialB = new Mesh(
    tetraPrimitiveGeometry([1, 2, 3, 2, 0, 3]),
    new MeshStandardMaterial({ name: 'Repaired material B', side: DoubleSide }),
  )
  multiMaterialOwner.add(multiMaterialA, multiMaterialB)
  const multiMaterialRoot = new Group()
  multiMaterialRoot.add(multiMaterialOwner)
  // These are the exact non-serializable associations GLTFLoader creates for
  // one node owning a two-primitive glTF mesh.
  assert.equal(
    registerGltfLogicalMeshAssociations({
      scene: multiMaterialRoot,
      scenes: [multiMaterialRoot],
      parser: {
        associations: new Map([
          [multiMaterialOwner, { nodes: 11, meshes: 19 }],
          [multiMaterialA, { meshes: 19, primitives: 0 }],
          [multiMaterialB, { meshes: 19, primitives: 1 }],
        ]),
      },
    }),
    1,
  )
  assert.equal(multiMaterialA.userData.iomSurfaceTopologyRepaired, undefined)
  assert.equal(multiMaterialB.userData.iomSurfaceTopologyRepair, undefined)
  prepareArchitecturalMeshes(
    multiMaterialRoot,
    computeSceneBounds(multiMaterialRoot),
    { freezeStatic: false },
  )
  assert.equal(
    multiMaterialA.material.side,
    FrontSide,
    JSON.stringify(multiMaterialOwner.userData.surfaceTopologyRepairAudit),
  )
  assert.equal(multiMaterialB.material.side, FrontSide)

  // A later preparation pass must re-audit the owner's current geometry. A
  // once-valid certificate cannot survive a topology mutation via stale cache.
  multiMaterialB.geometry = duplicateWindingGeometry()
  prepareArchitecturalMeshes(
    multiMaterialRoot,
    computeSceneBounds(multiMaterialRoot),
    { freezeStatic: false },
  )
  assert.equal(multiMaterialA.material.side, DoubleSide)
  assert.equal(multiMaterialB.material.side, DoubleSide)
  assert.equal(multiMaterialOwner.userData.surfaceTopologyRepairAudit.valid, false)

  const explicitSheetMaterial = new MeshStandardMaterial({
    name: 'Explicit repaired sheet',
    side: DoubleSide,
  })
  explicitSheetMaterial.userData.iomDoubleSidedReason = 'explicit-sheet'
  const explicitRepairedSheet = new Mesh(
    new BoxGeometry(4, 3, 4),
    explicitSheetMaterial,
  )
  explicitRepairedSheet.name = 'Wand_40.005'
  certifySurface(explicitRepairedSheet)
  const explicitSheetRoot = new Group()
  explicitSheetRoot.add(explicitRepairedSheet)
  prepareArchitecturalMeshes(
    explicitSheetRoot,
    computeSceneBounds(explicitSheetRoot),
    { freezeStatic: false },
  )
  assert.equal(explicitRepairedSheet.material.side, DoubleSide)

  const explicitGlassMaterial = new MeshStandardMaterial({
    name: 'architectural glass pane',
    side: FrontSide,
  })
  explicitGlassMaterial.userData.iomDoubleSidedReason = 'explicit-glass'
  const explicitRepairedGlass = new Mesh(
    new BoxGeometry(4, 3, 0.1),
    explicitGlassMaterial,
  )
  certifySurface(explicitRepairedGlass)
  const explicitGlassRoot = new Group()
  explicitGlassRoot.add(explicitRepairedGlass)
  prepareArchitecturalMeshes(
    explicitGlassRoot,
    computeSceneBounds(explicitGlassRoot),
    { freezeStatic: false },
  )
  assert.equal(explicitRepairedGlass.material.side, DoubleSide)
  assert.equal(explicitRepairedGlass.userData.architecturalGlass, true)

  // Legacy production meshes have neither certificate key. Their existing
  // topology-driven safety behavior remains unchanged.
  const legacyDamagedWall = new Mesh(
    openCornerGeometry(),
    new MeshStandardMaterial({ name: 'Legacy wall', side: FrontSide }),
  )
  legacyDamagedWall.name = 'Legacy_innenwaende'
  const legacyClosedWall = new Mesh(
    new BoxGeometry(4, 3, 4),
    new MeshStandardMaterial({ name: 'Legacy closed wall', side: FrontSide }),
  )
  legacyClosedWall.name = 'Legacy closed wall volume'
  legacyClosedWall.position.x = 8
  const legacyRoot = new Group()
  legacyRoot.add(legacyDamagedWall, legacyClosedWall)
  prepareArchitecturalMeshes(legacyRoot, computeSceneBounds(legacyRoot), {
    freezeStatic: false,
  })
  assert.equal(legacyDamagedWall.material.side, DoubleSide)
  assert.equal(legacyClosedWall.material.side, FrontSide)
  assert.equal(legacyDamagedWall.userData.iomSurfaceTopologyRepaired, undefined)
  assert.equal(legacyClosedWall.userData.iomSurfaceTopologyRepair, undefined)

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
