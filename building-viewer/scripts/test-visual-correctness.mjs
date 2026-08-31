import assert from 'node:assert/strict'
import { createServer } from 'vite'
import {
  BoxGeometry,
  ClampToEdgeWrapping,
  Color,
  DoubleSide,
  FrontSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Texture,
  Vector3,
} from 'three'

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

try {
  const [
    { isOrbitDuplicateMesh },
    { prepareArchitecturalMeshes, applyMeshQuality },
    { computeSceneBounds },
    { applyProceduralInstancing },
    { dedupeSceneMaterials },
  ] =
    await Promise.all([
      vite.ssrLoadModule('/src/scene/orbitDuplicatePolicy.ts'),
      vite.ssrLoadModule('/src/lighting/prepareArchitecturalMeshes.ts'),
      vite.ssrLoadModule('/src/scene/SceneBounds.ts'),
      vite.ssrLoadModule('/src/scene/ProceduralInstancing.ts'),
      vite.ssrLoadModule('/src/scene/dedupeSceneMaterials.ts'),
    ])

  const makeMesh = (name, materialName = 'Material') => {
    const material = new MeshStandardMaterial({ name: materialName })
    const mesh = new Mesh(new BoxGeometry(10, 0.1, 10), material)
    mesh.name = name
    return mesh
  }

  // Material words and a large, low footprint are not proof of ownership.
  const connectorRoot = new Group()
  connectorRoot.name = 'Verbindung West002.001'
  const connector = makeMesh('mesh_704_1', 'm.Asphalt_grau')
  connectorRoot.add(connector)
  assert.equal(isOrbitDuplicateMesh(connector), false)
  const genericGround = makeMesh('Campus deck', 'm.Asphalt_grau')
  assert.equal(isOrbitDuplicateMesh(genericGround), false)
  const roofGrass = makeMesh('dach_foyer_inner_grass', 'Standardmaterial_003.002')
  assert.equal(isOrbitDuplicateMesh(roofGrass), false)

  // Only authored ownership or the narrow prepared shutter role may dedupe.
  const authoredDuplicate = makeMesh('Known exterior copy')
  authoredDuplicate.userData.orbitDuplicateOf = 'icm-ext'
  assert.equal(isOrbitDuplicateMesh(authoredDuplicate), true)
  const shutterDuplicate = makeMesh('Prepared shutter')
  shutterDuplicate.userData.orbitDuplicateRole = 'facade-shutter'
  assert.equal(isOrbitDuplicateMesh(shutterDuplicate), true)

  // Safety assemblies always win over even accidental duplicate metadata.
  const protectedCabinet = makeMesh('FireHoseHousing007', 'RedMain_001.001')
  protectedCabinet.userData.orbitDuplicateOf = 'icm-ext'
  assert.equal(isOrbitDuplicateMesh(protectedCabinet), false)

  // Fire-safety signs and their parent hierarchy must not be swept into a
  // generic CAD/floor-plan overlay hide.
  const overlayParent = new Group()
  overlayParent.name = 'FloorPlan annotations'
  const fireSign = makeMesh('Fire', 'mat_Fire')
  overlayParent.add(fireSign)
  const signRoot = new Group()
  signRoot.add(overlayParent)
  prepareArchitecturalMeshes(signRoot, computeSceneBounds(signRoot), { freezeStatic: false })
  assert.equal(overlayParent.visible, true)
  assert.equal(fireSign.visible, true)
  assert.equal(fireSign.userData.visibilityCritical, true)
  assert.equal(fireSign.userData.detailLodIgnore, true)

  // Physical ground texture scale: normalized fallback UVs must not stretch a
  // single cobble tile over a campus slab. Dense authored UVs stay untouched.
  const uvSpan = (geometry) => {
    const uv = geometry.getAttribute('uv')
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity
    for (let i = 0; i < uv.count; i += 1) {
      minU = Math.min(minU, uv.getX(i)); maxU = Math.max(maxU, uv.getX(i))
      minV = Math.min(minV, uv.getY(i)); maxV = Math.max(maxV, uv.getY(i))
    }
    return [maxU - minU, maxV - minV]
  }
  const multiplyUvs = (geometry, scaleU, scaleV) => {
    const uv = geometry.getAttribute('uv')
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, uv.getX(i) * scaleU, uv.getY(i) * scaleV)
    }
    uv.needsUpdate = true
  }
  const effectivePlaneMetersPerRepeat = (mesh, width, depth) => {
    const [spanU, spanV] = uvSpan(mesh.geometry)
    const map = mesh.material.map
    return Math.sqrt((width * depth) / (spanU * spanV * Math.abs(map.repeat.x * map.repeat.y)))
  }
  const horizontalPlane = (width, depth, material) => {
    const geometry = new PlaneGeometry(width, depth)
    geometry.rotateX(-Math.PI / 2)
    return new Mesh(geometry, material)
  }

  const cobbleTexture = new Texture()
  cobbleTexture.name = 'Aussen_Kopfsteinpflaster-Ringe-72dpi'
  const sharedCobble = new MeshStandardMaterial({
    name: 'mat_16 - Default_004',
    map: cobbleTexture,
  })
  const oversizedCobble = horizontalPlane(150, 75, sharedCobble)
  oversizedCobble.name = 'normalized fallback paving'
  const authoredCobble = horizontalPlane(30, 15, sharedCobble)
  authoredCobble.name = 'authored paving'
  authoredCobble.position.x = 200
  multiplyUvs(authoredCobble.geometry, 20, 10)
  const authoredGeometry = authoredCobble.geometry
  const pavingRoot = new Group()
  pavingRoot.add(oversizedCobble, authoredCobble)
  prepareArchitecturalMeshes(pavingRoot, computeSceneBounds(pavingRoot), { freezeStatic: false })
  assert.ok(Math.abs(effectivePlaneMetersPerRepeat(oversizedCobble, 150, 75) - 1.5) < 1e-4)
  assert.equal(oversizedCobble.userData.textureScaleCorrected, true)
  assert.equal(authoredCobble.geometry, authoredGeometry)
  assert.ok(Math.abs(effectivePlaneMetersPerRepeat(authoredCobble, 30, 15) - 1.5) < 1e-4)
  assert.deepEqual(cobbleTexture.repeat.toArray(), [1, 1])
  const correctedGeometry = oversizedCobble.geometry
  prepareArchitecturalMeshes(pavingRoot, computeSceneBounds(pavingRoot), { freezeStatic: false })
  assert.equal(oversizedCobble.geometry, correctedGeometry)

  // Green roofs can use unique aerial/baked atlases. Their "grass" label must
  // not opt them into metric ground tiling, which would repeat the entire roof
  // image as a miniature-building checkerboard.
  const roofAtlasTexture = new Texture()
  roofAtlasTexture.name = 'BT 7 Foyer dach gruen'
  const roofAtlas = horizontalPlane(
    54.91,
    132.1,
    new MeshStandardMaterial({ name: 'Standardmaterial_003.002', map: roofAtlasTexture }),
  )
  roofAtlas.name = 'dach_foyer_inner_grass'
  const roofAtlasGeometry = roofAtlas.geometry
  const roofRoot = new Group()
  roofRoot.add(roofAtlas)
  prepareArchitecturalMeshes(roofRoot, computeSceneBounds(roofRoot), { freezeStatic: false })
  assert.equal(roofAtlas.geometry, roofAtlasGeometry)
  assert.notEqual(roofAtlas.userData.textureScaleCorrected, true)
  assert.equal(roofAtlasTexture.wrapS, ClampToEdgeWrapping)
  assert.equal(roofAtlasTexture.wrapT, ClampToEdgeWrapping)

  // Large valid UV ranges above 512 were previously damaged by the fallback.
  const denseTexture = new Texture()
  denseTexture.name = 'Aussen_Kopfsteinpflaster-Ringe-72dpi'
  const densePaving = horizontalPlane(
    10,
    10,
    new MeshStandardMaterial({ name: 'Dense paving', map: denseTexture }),
  )
  multiplyUvs(densePaving.geometry, 1_000, 1_000)
  const denseGeometry = densePaving.geometry
  const denseRoot = new Group()
  denseRoot.add(densePaving)
  prepareArchitecturalMeshes(denseRoot, computeSceneBounds(denseRoot), { freezeStatic: false })
  assert.equal(densePaving.geometry, denseGeometry)
  assert.deepEqual(uvSpan(densePaving.geometry), [1_000, 1_000])

  // Existing KHR texture repeats are divided out of the generated metric UVs.
  const grassTexture = new Texture()
  grassTexture.name = 'Ground_Grass_001_COLOR'
  grassTexture.repeat.set(5, 5)
  const grassSurface = horizontalPlane(
    30,
    15,
    new MeshStandardMaterial({ name: 'GRUEN', map: grassTexture }),
  )
  const grassRoot = new Group()
  grassRoot.add(grassSurface)
  prepareArchitecturalMeshes(grassRoot, computeSceneBounds(grassRoot), { freezeStatic: false })
  assert.ok(Math.abs(effectivePlaneMetersPerRepeat(grassSurface, 30, 15) - 1.5) < 1e-4)

  // Adjacent BT2 wood-floor owners were exported with different UV scales,
  // rotations, and origins despite sharing one material. Reproject genuine
  // floor slabs in world XZ so both density and phase match across every seam.
  const woodTexture = new Texture()
  woodTexture.name = 'wood-flooring-008(3000px)_d'
  const invalidWoodNormal = new Texture()
  invalidWoodNormal.name = 'wood-flooring-008(3000px)_b'
  const woodRoughness = new Texture()
  woodRoughness.name = 'wood-flooring-008(3000px)_r'
  const sharedWoodFloor = new MeshStandardMaterial({
    name: 'Floor_Wood_Vray_001',
    map: woodTexture,
    normalMap: invalidWoodNormal,
    roughnessMap: woodRoughness,
    metalnessMap: woodRoughness,
  })
  sharedWoodFloor.bumpMap = invalidWoodNormal
  const bt2WoodFloor = horizontalPlane(13, 13, sharedWoodFloor)
  bt2WoodFloor.name = 'floor_bt2_1og'
  bt2WoodFloor.position.set(-6.5, 6, 0)
  multiplyUvs(bt2WoodFloor.geometry, 2, 4)
  bt2WoodFloor.geometry.computeTangents()
  const adjacentWoodFloor = horizontalPlane(13, 13, sharedWoodFloor)
  adjacentWoodFloor.name = 'obj_1_OG_Boden_002'
  adjacentWoodFloor.position.set(6.5, 6, 0)
  multiplyUvs(adjacentWoodFloor.geometry, 0.5, 0.5)
  adjacentWoodFloor.geometry.computeTangents()
  const excludedElectroWood = horizontalPlane(13, 13, sharedWoodFloor)
  excludedElectroWood.name = 'Electro_s14'
  excludedElectroWood.position.set(30, 6, 0)
  const excludedElectroGeometry = excludedElectroWood.geometry
  const excludedBaseboardWood = horizontalPlane(13, 13, sharedWoodFloor)
  excludedBaseboardWood.name = 'Tr_bodenleisten'
  excludedBaseboardWood.position.set(42, 6, 0)
  const excludedBaseboardGeometry = excludedBaseboardWood.geometry
  const generatedWoodFloor = horizontalPlane(19.59, 14.07, sharedWoodFloor)
  generatedWoodFloor.name = 'mesh_1026'
  generatedWoodFloor.position.set(62, 6, 0)
  multiplyUvs(generatedWoodFloor.geometry, 0.25, 0.75)
  generatedWoodFloor.geometry.computeTangents()
  const intermediateWoodFloor = horizontalPlane(45.6, 28, sharedWoodFloor)
  intermediateWoodFloor.name = 'fb_zwischengeschoss'
  intermediateWoodFloor.position.set(90, 6, 0)
  multiplyUvs(intermediateWoodFloor.geometry, 0.5, 2)
  intermediateWoodFloor.geometry.computeTangents()
  const mixedWoodAssembly = new Mesh(new BoxGeometry(10, 6.3, 10), sharedWoodFloor)
  mixedWoodAssembly.name = 'mesh_994'
  mixedWoodAssembly.position.set(130, 9.15, 0)
  const mixedWoodGeometry = mixedWoodAssembly.geometry
  const woodRoot = new Group()
  woodRoot.add(
    bt2WoodFloor,
    adjacentWoodFloor,
    excludedElectroWood,
    excludedBaseboardWood,
    generatedWoodFloor,
    intermediateWoodFloor,
    mixedWoodAssembly,
  )
  prepareArchitecturalMeshes(woodRoot, computeSceneBounds(woodRoot), { freezeStatic: false })
  const worldVertex = new Vector3()
  for (const [floor, width, depth] of [
    [bt2WoodFloor, 13, 13],
    [adjacentWoodFloor, 13, 13],
    [generatedWoodFloor, 19.59, 14.07],
    [intermediateWoodFloor, 45.6, 28],
  ]) {
    floor.updateWorldMatrix(true, false)
    const positions = floor.geometry.getAttribute('position')
    const uvs = floor.geometry.getAttribute('uv')
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      worldVertex.fromBufferAttribute(positions, vertex).applyMatrix4(floor.matrixWorld)
      assert.ok(Math.abs(uvs.getX(vertex) - worldVertex.x / 3.25) < 1e-5)
      assert.ok(Math.abs(uvs.getY(vertex) - worldVertex.z / 3.25) < 1e-5)
    }
    assert.equal(floor.geometry.getAttribute('tangent'), undefined)
    assert.equal(floor.geometry.userData.textureTileMeters, 3.25)
    assert.equal(floor.userData.textureScaleCorrected, true)
    assert.ok(Math.abs(effectivePlaneMetersPerRepeat(floor, width, depth) - 3.25) < 1e-4)
    assert.equal(floor.material.map, woodTexture)
    assert.equal(floor.material.normalMap, null)
    assert.equal(floor.material.bumpMap, null)
    assert.equal(floor.material.roughnessMap, woodRoughness)
    assert.equal(floor.material.metalnessMap, woodRoughness)
    assert.equal(floor.material.userData.iomInteriorWoodFloorNormalPrepared, true)
  }
  assert.equal(excludedElectroWood.geometry, excludedElectroGeometry)
  assert.equal(excludedElectroWood.material.normalMap, invalidWoodNormal)
  assert.notEqual(excludedElectroWood.material.userData.iomInteriorWoodFloorNormalPrepared, true)
  assert.equal(excludedBaseboardWood.geometry, excludedBaseboardGeometry)
  assert.equal(excludedBaseboardWood.material.normalMap, invalidWoodNormal)
  assert.notEqual(excludedBaseboardWood.material.userData.iomInteriorWoodFloorNormalPrepared, true)
  assert.equal(mixedWoodAssembly.geometry, mixedWoodGeometry)
  assert.equal(mixedWoodAssembly.material.normalMap, invalidWoodNormal)
  assert.notEqual(mixedWoodAssembly.material.userData.iomInteriorWoodFloorNormalPrepared, true)
  assert.equal(sharedWoodFloor.normalMap, invalidWoodNormal)

  // A shared Texture must retain the strongest anisotropy request regardless
  // of whether a non-floor owner is visited before or after the floor.
  for (const floorFirst of [true, false]) {
    const sharedQualityTexture = new Texture()
    const sharedQualityMaterial = new MeshStandardMaterial({ map: sharedQualityTexture })
    const qualityFloor = makeMesh('Quality floor')
    qualityFloor.material = sharedQualityMaterial
    qualityFloor.userData.floorSurface = true
    const qualityFixture = makeMesh('Quality fixture')
    qualityFixture.material = sharedQualityMaterial
    const qualityRoot = new Group()
    qualityRoot.add(...(floorFirst ? [qualityFloor, qualityFixture] : [qualityFixture, qualityFloor]))
    applyMeshQuality(qualityRoot, { id: 'DESKTOP_BALANCED', anisotropy: 2 })
    assert.equal(sharedQualityTexture.anisotropy, 8)
  }

  const waterTexture = new Texture()
  waterTexture.name = 'water'
  const waterSurface = horizontalPlane(
    200,
    100,
    new MeshPhysicalMaterial({ name: 'vray Water', map: waterTexture }),
  )
  const waterRoot = new Group()
  waterRoot.add(waterSurface)
  prepareArchitecturalMeshes(waterRoot, computeSceneBounds(waterRoot), { freezeStatic: false })
  assert.equal(waterSurface.material.map, null)
  assert.equal(waterTexture.name, 'water')

  // A grouped fire cabinet is one Mesh with opaque body/internal slots plus a
  // glass pane. Preparation must classify the slots independently.
  const cabinetGeometry = new BoxGeometry(1.4, 1.8, 0.35)
  const indexBefore = Array.from(cabinetGeometry.getIndex().array)
  const body = new MeshPhysicalMaterial({
    name: 'RedMain_001.001',
    opacity: 0.42,
    transparent: true,
    transmission: 0.7,
    side: FrontSide,
  })
  const pane = new MeshPhysicalMaterial({
    name: 'm.glass_white_standart',
    opacity: 0.446,
    transparent: true,
    transmission: 1,
    side: DoubleSide,
  })
  const cabinet = new Mesh(cabinetGeometry, [body, pane])
  cabinet.name = 'FireHoseHousing'
  cabinetGeometry.clearGroups()
  const indexCount = cabinetGeometry.getIndex().count
  const split = Math.floor(indexCount / 2 / 3) * 3
  cabinetGeometry.addGroup(0, split, 0)
  cabinetGeometry.addGroup(split, indexCount - split, 1)
  const root = new Group()
  root.add(cabinet)

  prepareArchitecturalMeshes(root, computeSceneBounds(root), { freezeStatic: false })

  const [preparedBody, preparedPane] = cabinet.material
  assert.equal(preparedBody.transparent, false)
  assert.equal(preparedBody.opacity, 1)
  assert.equal(preparedBody.depthWrite, true)
  assert.equal(preparedBody.transmission, 0)
  assert.equal(preparedPane.transparent, true)
  assert.equal(preparedPane.depthWrite, false)
  assert.ok(preparedPane.opacity <= 0.45)
  assert.equal(cabinet.userData.architecturalGlass, false)
  assert.equal(cabinet.userData.containsArchitecturalGlass, true)
  assert.equal(cabinet.userData.visibilityCritical, true)
  assert.equal(cabinet.userData.detailLodIgnore, true)
  assert.equal(cabinet.userData.floorZoneAlways, true)
  assert.deepEqual(Array.from(cabinetGeometry.getIndex().array), indexBefore)

  // GLTFLoader may represent each primitive as a child Mesh below the named
  // node. Ancestor semantics must protect that representation as well.
  const cabinetNode = new Group()
  cabinetNode.name = 'FireHoseHousing007'
  const nestedBody = makeMesh('mesh_8837_2', 'RedMain_001.001')
  nestedBody.userData.orbitDuplicateOf = 'icm-ext'
  const nestedPane = new Mesh(
    new BoxGeometry(1, 1, 0.02),
    new MeshPhysicalMaterial({
      name: 'm.glass_white_standart',
      transmission: 1,
      transparent: true,
    }),
  )
  nestedPane.name = 'mesh_8837_4'
  cabinetNode.add(nestedBody, nestedPane)
  const nestedRoot = new Group()
  nestedRoot.add(cabinetNode)
  prepareArchitecturalMeshes(nestedRoot, computeSceneBounds(nestedRoot), {
    freezeStatic: false,
  })
  assert.equal(isOrbitDuplicateMesh(nestedBody), false)
  assert.equal(nestedBody.userData.architecturalGlass, undefined)
  assert.equal(nestedBody.material.transparent, false)
  assert.equal(nestedPane.userData.architecturalGlass, true)
  assert.equal(nestedPane.material.transparent, true)

  // gltfpack may split/instance cabinet primitives and drop their node names.
  // Authored material roles must preserve the same opaque/glass and residency contract.
  const roleBody = new MeshPhysicalMaterial({
    name: 'IOM_FIRE_SAFETY_OPAQUE__RedMain_001.001',
    transmission: 0.8,
    transparent: true,
    opacity: 0.4,
  })
  roleBody.userData.iomMaterialRole = 'fire-safety-opaque'
  const roleMesh = new Mesh(new BoxGeometry(1, 1, 0.2), roleBody)
  roleMesh.name = ''
  roleMesh.userData.orbitDuplicateOf = 'icm-ext'
  const roleRoot = new Group()
  roleRoot.add(roleMesh)
  prepareArchitecturalMeshes(roleRoot, computeSceneBounds(roleRoot), { freezeStatic: false })
  assert.equal(isOrbitDuplicateMesh(roleMesh), false)
  assert.equal(roleMesh.material.transparent, false)
  assert.equal(roleMesh.material.opacity, 1)
  assert.equal(roleMesh.material.transmission, 0)
  assert.equal(roleMesh.userData.visibilityCritical, true)
  assert.equal(roleMesh.userData.detailLodIgnore, true)
  assert.equal(roleMesh.userData.floorZoneAlways, true)

  // Numerically-identical materials with different semantic roles must never
  // deduplicate; otherwise the fire-safety role spreads across the building.
  const roleDedupeRoot = new Group()
  const ordinaryGray = new MeshStandardMaterial({ name: 'Ordinary gray', color: 0x888888 })
  const fireGray = new MeshStandardMaterial({ name: 'IOM fire gray', color: 0x888888 })
  fireGray.userData.iomMaterialRole = 'fire-safety-opaque'
  const ordinaryGrayMesh = new Mesh(new BoxGeometry(1, 1, 1), ordinaryGray)
  const fireGrayMesh = new Mesh(new BoxGeometry(1, 1, 1), fireGray)
  roleDedupeRoot.add(ordinaryGrayMesh, fireGrayMesh)
  dedupeSceneMaterials(roleDedupeRoot)
  assert.notEqual(ordinaryGrayMesh.material, fireGrayMesh.material)
  assert.equal(fireGrayMesh.material.userData.iomMaterialRole, 'fire-safety-opaque')

  // Runtime packing must never mix authored exterior-owned and resident meshes.
  const repeatRoot = new Group()
  const repeatGeometry = new BoxGeometry(1, 1, 1)
  const repeatMaterial = new MeshStandardMaterial({ name: 'Repeat' })
  for (let i = 0; i < 6; i++) {
    const mesh = new Mesh(repeatGeometry, repeatMaterial)
    mesh.position.set(i * 2, 0, 0)
    if (i < 3) mesh.userData.orbitDuplicateOf = 'icm-ext'
    repeatRoot.add(mesh)
  }
  applyProceduralInstancing(repeatRoot, { minInstances: 3, minBatchSize: 99 })
  const repeatOutputs = repeatRoot.children.filter((child) => child.isInstancedMesh)
  assert.equal(repeatOutputs.length, 2)
  assert.equal(repeatOutputs.filter((mesh) => isOrbitDuplicateMesh(mesh)).length, 1)

  const batchRoot = new Group()
  const batchMaterial = new MeshStandardMaterial({ name: 'Batch' })
  for (let i = 0; i < 8; i++) {
    const mesh = new Mesh(new BoxGeometry(1 + i * 0.07, 1, 1), batchMaterial)
    mesh.position.set(i * 2, 0, 0)
    if (i < 4) mesh.userData.orbitDuplicateOf = 'icm-ext'
    batchRoot.add(mesh)
  }
  applyProceduralInstancing(batchRoot, { minInstances: 99, minBatchSize: 4 })
  const batchOutputs = batchRoot.children.filter((child) => child.isBatchedMesh)
  assert.equal(batchOutputs.length, 2)
  assert.equal(batchOutputs.filter((mesh) => isOrbitDuplicateMesh(mesh)).length, 1)

  const assertNoNegativePackedTransforms = (testRoot) => {
    const matrix = new Matrix4()
    testRoot.traverse((object) => {
      if (object.isInstancedMesh) {
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, matrix)
          assert.ok(matrix.determinant() >= 0, `${object.name} has mirrored instance ${i}`)
        }
      } else if (object.isBatchedMesh) {
        for (let i = 0; i < object.instanceCount; i++) {
          object.getMatrixAt(i, matrix)
          assert.ok(matrix.determinant() >= 0, `${object.name} has mirrored batch item ${i}`)
        }
      }
    })
  }

  // A shared draw cannot switch front-face winding for one mirrored item.
  // Preserve positive repeat packing and leave only the mirrored source Mesh
  // standalone, where Three.js performs its normal per-object correction.
  const mirroredRepeatRoot = new Group()
  const mirroredRepeatGeometry = new BoxGeometry(1, 1, 1)
  const mirroredRepeatMaterial = new MeshStandardMaterial({ name: 'Mirrored repeat' })
  let mirroredRepeatSource = null
  for (let i = 0; i < 5; i++) {
    const mesh = new Mesh(mirroredRepeatGeometry, mirroredRepeatMaterial)
    mesh.name = `repeat-${i}`
    mesh.position.set(i * 2, 0, 0)
    mesh.userData.floorZoneAlways = true
    if (i === 4) {
      mesh.scale.x = -1
      mirroredRepeatSource = mesh
    }
    mirroredRepeatRoot.add(mesh)
  }
  const mirroredRepeatReport = applyProceduralInstancing(mirroredRepeatRoot, {
    minInstances: 3,
    minBatchSize: 99,
  })
  const mirroredRepeatOutput = mirroredRepeatRoot.children.find(
    (child) => child.isInstancedMesh,
  )
  assert.ok(mirroredRepeatOutput)
  assert.equal(mirroredRepeatOutput.count, 4)
  assert.equal(mirroredRepeatOutput.userData.floorZoneAlways, true)
  assert.equal(mirroredRepeatSource.parent, mirroredRepeatRoot)
  assert.equal(mirroredRepeatReport.skippedNegativeTransforms, 1)
  assertNoNegativePackedTransforms(mirroredRepeatRoot)

  // Evaluate the determinant relative to the packed host, not in world space:
  // a mirrored ancestor is safe for the whole draw, while one mirrored child
  // below that ancestor still must remain standalone.
  const negativeParentRoot = new Group()
  const negativeParent = new Group()
  negativeParent.scale.x = -1
  negativeParentRoot.add(negativeParent)
  const negativeParentGeometry = new BoxGeometry(1, 1, 1)
  const negativeParentMaterial = new MeshStandardMaterial({ name: 'Negative parent' })
  let negativeRelativeChild = null
  for (let i = 0; i < 4; i++) {
    const mesh = new Mesh(negativeParentGeometry, negativeParentMaterial)
    mesh.position.set(i * 2, 0, 0)
    if (i === 3) {
      mesh.scale.x = -1
      negativeRelativeChild = mesh
    }
    negativeParent.add(mesh)
  }
  const negativeParentReport = applyProceduralInstancing(negativeParentRoot, {
    minInstances: 3,
    minBatchSize: 99,
  })
  const negativeParentOutput = negativeParent.children.find((child) => child.isInstancedMesh)
  assert.ok(negativeParentOutput)
  assert.equal(negativeParentOutput.count, 3)
  assert.equal(negativeRelativeChild.parent, negativeParent)
  assert.equal(negativeParentReport.skippedNegativeTransforms, 1)
  assertNoNegativePackedTransforms(negativeParentRoot)

  // Repeated geometry can originate below unrelated positive and mirrored
  // parents. Packing all of it under the first parent would turn the other
  // branch into negative per-instance matrices, even though every source mesh
  // has a positive local transform. Partition shared draws by host orientation.
  const mixedParentRepeatRoot = new Group()
  const positiveRepeatParent = new Group()
  const mirroredRepeatParent = new Group()
  mirroredRepeatParent.scale.x = -1
  mixedParentRepeatRoot.add(positiveRepeatParent, mirroredRepeatParent)
  const mixedRepeatGeometry = new BoxGeometry(1, 1, 1)
  const mixedRepeatMaterial = new MeshStandardMaterial({ name: 'Mixed-parent repeat' })
  for (const [branchIndex, branch] of [positiveRepeatParent, mirroredRepeatParent].entries()) {
    for (let i = 0; i < 3; i++) {
      const mesh = new Mesh(mixedRepeatGeometry, mixedRepeatMaterial)
      mesh.position.set(i * 2 + branchIndex * 10, 0, 0)
      branch.add(mesh)
    }
  }
  applyProceduralInstancing(mixedParentRepeatRoot, {
    minInstances: 3,
    minBatchSize: 99,
  })
  const mixedParentRepeatOutputs = []
  mixedParentRepeatRoot.traverse((object) => {
    if (object.isInstancedMesh) mixedParentRepeatOutputs.push(object)
  })
  assert.equal(mixedParentRepeatOutputs.length, 2)
  assert.equal(mixedParentRepeatOutputs.reduce((sum, mesh) => sum + mesh.count, 0), 6)
  assertNoNegativePackedTransforms(mixedParentRepeatRoot)

  // The same determinant rule applies to unique-geometry BatchedMesh packing.
  const mirroredBatchRoot = new Group()
  const mirroredBatchMaterial = new MeshStandardMaterial({ name: 'Mirrored batch' })
  let mirroredBatchSource = null
  for (let i = 0; i < 5; i++) {
    const mesh = new Mesh(new BoxGeometry(1 + i * 0.05, 1, 1), mirroredBatchMaterial)
    mesh.name = `batch-${i}`
    mesh.position.set(i * 2, 0, 0)
    if (i === 4) {
      mesh.scale.x = -1
      mirroredBatchSource = mesh
    }
    mirroredBatchRoot.add(mesh)
  }
  const mirroredBatchReport = applyProceduralInstancing(mirroredBatchRoot, {
    minInstances: 99,
    minBatchSize: 4,
  })
  const mirroredBatchOutput = mirroredBatchRoot.children.find((child) => child.isBatchedMesh)
  assert.ok(mirroredBatchOutput)
  assert.equal(mirroredBatchOutput.instanceCount, 4)
  assert.equal(mirroredBatchSource.parent, mirroredBatchRoot)
  assert.equal(mirroredBatchReport.skippedNegativeTransforms, 1)
  assertNoNegativePackedTransforms(mirroredBatchRoot)

  // The unique-geometry batching path needs the same partition when candidate
  // meshes come from source parents with opposite determinant signs.
  const mixedParentBatchRoot = new Group()
  const positiveBatchParent = new Group()
  const mirroredBatchParent = new Group()
  mirroredBatchParent.scale.x = -1
  mixedParentBatchRoot.add(positiveBatchParent, mirroredBatchParent)
  const mixedParentBatchMaterial = new MeshStandardMaterial({ name: 'Mixed-parent batch' })
  for (const [branchIndex, branch] of [positiveBatchParent, mirroredBatchParent].entries()) {
    for (let i = 0; i < 4; i++) {
      const mesh = new Mesh(
        new BoxGeometry(1 + i * 0.05 + branchIndex * 0.01, 1, 1),
        mixedParentBatchMaterial,
      )
      mesh.position.set(i * 2 + branchIndex * 10, 0, 0)
      branch.add(mesh)
    }
  }
  applyProceduralInstancing(mixedParentBatchRoot, {
    minInstances: 99,
    minBatchSize: 4,
  })
  const mixedParentBatchOutputs = []
  mixedParentBatchRoot.traverse((object) => {
    if (object.isBatchedMesh) mixedParentBatchOutputs.push(object)
  })
  assert.equal(mixedParentBatchOutputs.length, 2)
  assert.equal(
    mixedParentBatchOutputs.reduce((sum, mesh) => sum + mesh.instanceCount, 0),
    8,
  )
  assertNoNegativePackedTransforms(mixedParentBatchRoot)

  // Imported EXT_mesh_gpu_instancing groups must be partitioned by world-space
  // cell so Three can cull distant campus instances. Transforms, colors and
  // authored ownership remain lossless across the replacement groups.
  const importedRoot = new Group()
  const imported = new InstancedMesh(
    new BoxGeometry(1, 2, 1),
    new MeshStandardMaterial({ name: 'Imported' }),
    8,
  )
  imported.name = 'CampusLights'
  imported.position.set(5, 0, 7)
  imported.userData.orbitDuplicateOf = 'icm-ext'
  for (let i = 0; i < 8; i++) {
    imported.setMatrixAt(i, new Matrix4().makeTranslation(i * 20, 0, 0))
    imported.setColorAt(i, new Color().setRGB(i / 8, 0.5, 1 - i / 8))
  }
  imported.instanceMatrix.needsUpdate = true
  imported.instanceColor.needsUpdate = true
  importedRoot.add(imported)
  const importedReport = applyProceduralInstancing(importedRoot, {
    minInstances: 99,
    minBatchSize: 99,
    spatial: {
      sceneMinX: 0,
      sceneMinY: -1,
      sceneMinZ: 0,
      cellSizeXz: 12,
      cellSizeY: 4,
      bandHeight: 3.6,
      neighborCells: 1,
    },
  })
  const importedOutputs = importedRoot.children.filter((child) => child.isInstancedMesh)
  assert.equal(importedReport.importedInstancedMeshesSplit, 1)
  assert.ok(importedOutputs.length > 1)
  assert.equal(importedOutputs.reduce((sum, mesh) => sum + mesh.count, 0), 8)
  assert.ok(importedOutputs.every((mesh) => mesh.instanceColor))
  assert.ok(importedOutputs.every((mesh) => isOrbitDuplicateMesh(mesh)))
  assert.ok(importedOutputs.every((mesh) => mesh.userData.IOM_spatial))

  // EXT_mesh_gpu_instancing with mirrored per-instance matrices needs a
  // selective extraction. Positive items remain spatially instanced, while
  // mirrored items retain world transforms, colors, ownership and residency.
  const mirroredImportedRoot = new Group()
  const mirroredImportedMaterial = new MeshStandardMaterial({
    name: 'Mirrored imported',
    color: 0xffffff,
  })
  const mirroredImported = new InstancedMesh(
    new BoxGeometry(1, 2, 1),
    mirroredImportedMaterial,
    10,
  )
  mirroredImported.name = 'MirroredCampusLights'
  mirroredImported.position.set(5, 1, 7)
  mirroredImported.userData.orbitDuplicateOf = 'icm-ext'
  mirroredImported.userData.floorZoneAlways = true
  for (let i = 0; i < 10; i++) {
    const matrix = new Matrix4().makeScale(i >= 8 ? -1 : 1, 1, 1)
    matrix.setPosition(i * 20, i * 0.25, 0)
    mirroredImported.setMatrixAt(i, matrix)
    mirroredImported.setColorAt(i, new Color().setRGB((i + 1) / 12, 0.5, 1 - i / 12))
  }
  mirroredImported.instanceMatrix.needsUpdate = true
  mirroredImported.instanceColor.needsUpdate = true
  mirroredImportedRoot.add(mirroredImported)
  mirroredImportedRoot.updateMatrixWorld(true)
  const expectedMirroredWorld = new Map()
  for (const sourceIndex of [8, 9]) {
    const instance = new Matrix4()
    mirroredImported.getMatrixAt(sourceIndex, instance)
    expectedMirroredWorld.set(
      sourceIndex,
      new Matrix4().multiplyMatrices(mirroredImported.matrixWorld, instance),
    )
  }

  const mirroredImportedReport = applyProceduralInstancing(mirroredImportedRoot, {
    minInstances: 99,
    minBatchSize: 99,
    spatial: {
      sceneMinX: 0,
      sceneMinY: -1,
      sceneMinZ: 0,
      cellSizeXz: 12,
      cellSizeY: 4,
      bandHeight: 3.6,
      neighborCells: 1,
    },
  })
  const mirroredImportedOutputs = mirroredImportedRoot.children.filter(
    (child) => child.isInstancedMesh,
  )
  const extractedMirrored = mirroredImportedRoot.children.filter(
    (child) => child.userData.importedNegativeInstance,
  )
  assert.equal(mirroredImportedReport.importedInstancedMeshesSplit, 1)
  assert.equal(mirroredImportedReport.importedNegativeInstancesExtracted, 2)
  assert.equal(mirroredImportedOutputs.reduce((sum, mesh) => sum + mesh.count, 0), 8)
  assert.equal(extractedMirrored.length, 2)
  assert.ok(extractedMirrored.every((mesh) => !mesh.isInstancedMesh))
  assert.ok(extractedMirrored.every((mesh) => isOrbitDuplicateMesh(mesh)))
  assert.ok(extractedMirrored.every((mesh) => mesh.userData.floorZoneAlways))
  assert.ok(extractedMirrored.every((mesh) => mesh.userData.IOM_spatial))
  mirroredImportedRoot.updateMatrixWorld(true)
  for (const mesh of extractedMirrored) {
    const expected = expectedMirroredWorld.get(mesh.userData.importedSourceInstance)
    assert.ok(expected)
    assert.ok(
      mesh.matrixWorld.elements.every(
        (value, index) => Math.abs(value - expected.elements[index]) < 1e-10,
      ),
    )
    const expectedColor = mesh.userData.importedInstanceColor
    assert.ok(
      mesh.material.color
        .toArray()
        .every((value, index) => Math.abs(value - expectedColor[index]) < 1e-10),
    )
  }
  assertNoNegativePackedTransforms(mirroredImportedRoot)

  // Negative extraction is a correctness pass even when spatial partitioning
  // is disabled or the source group is too small to split into cells.
  const compactImportedRoot = new Group()
  const compactImported = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ name: 'Compact imported' }),
    3,
  )
  for (let i = 0; i < 3; i++) {
    const matrix = new Matrix4().makeScale(i === 2 ? -1 : 1, 1, 1)
    matrix.setPosition(i * 2, 0, 0)
    compactImported.setMatrixAt(i, matrix)
  }
  compactImported.instanceMatrix.needsUpdate = true
  compactImportedRoot.add(compactImported)
  const compactImportedReport = applyProceduralInstancing(compactImportedRoot, {
    minInstances: 99,
    minBatchSize: 99,
  })
  const compactImportedOutput = compactImportedRoot.children.find(
    (child) => child.isInstancedMesh,
  )
  assert.ok(compactImportedOutput)
  assert.equal(compactImportedOutput.count, 2)
  assert.equal(compactImportedOutput.userData.importedNegativeInstancesExtracted, 1)
  assert.equal(compactImportedReport.importedInstancedMeshesSplit, 0)
  assert.equal(compactImportedReport.importedNegativeInstancesExtracted, 1)
  assert.equal(
    compactImportedRoot.children.filter((child) => child.userData.importedNegativeInstance)
      .length,
    1,
  )
  assertNoNegativePackedTransforms(compactImportedRoot)

  // Same-material glass can use BatchedMesh because it sorts and culls each
  // packed object. It must retain the preparation flags and stay out of shadow
  // passes; those guarantees prevent the former black-pane artifact.
  const glassBatchRoot = new Group()
  const glassBatchMaterial = new MeshPhysicalMaterial({
    name: 'Curtain glass',
    transparent: true,
    opacity: 0.28,
    transmission: 0,
    depthWrite: false,
  })
  for (let i = 0; i < 6; i++) {
    const pane = new Mesh(new BoxGeometry(0.8 + i * 0.01, 2, 0.02), glassBatchMaterial)
    pane.position.set(i * 1.2, 1, 0)
    pane.castShadow = false
    pane.receiveShadow = false
    pane.userData.architecturalGlass = true
    pane.userData.detailLodIgnore = true
    pane.userData.floorZoneAlways = true
    glassBatchRoot.add(pane)
  }
  applyProceduralInstancing(glassBatchRoot, { minInstances: 99, minBatchSize: 4 })
  const glassBatch = glassBatchRoot.children.find((child) => child.isBatchedMesh)
  assert.ok(glassBatch)
  assert.equal(glassBatch.sortObjects, true)
  assert.equal(glassBatch.castShadow, false)
  assert.equal(glassBatch.receiveShadow, false)
  assert.equal(glassBatch.userData.architecturalGlass, true)
  assert.equal(glassBatch.userData.detailLodIgnore, true)
  assert.equal(glassBatch.userData.floorZoneAlways, true)

  // LOD-protected floor/ground geometry is still safe to pack losslessly.
  // Residency flags must survive so batching cannot reintroduce view holes.
  const floorBatchRoot = new Group()
  const floorBatchMaterial = new MeshStandardMaterial({ name: 'Plaza paving' })
  for (let i = 0; i < 6; i++) {
    const slab = new Mesh(new BoxGeometry(1 + i * 0.03, 0.04, 1), floorBatchMaterial)
    slab.position.set(i * 1.4, 0, 0)
    slab.userData.detailLodIgnore = true
    slab.userData.floorZoneAlways = true
    slab.userData.floorSurface = true
    floorBatchRoot.add(slab)
  }
  applyProceduralInstancing(floorBatchRoot, { minInstances: 99, minBatchSize: 4 })
  const floorBatch = floorBatchRoot.children.find((child) => child.isBatchedMesh)
  assert.ok(floorBatch)
  assert.equal(floorBatch.userData.detailLodIgnore, true)
  assert.equal(floorBatch.userData.floorZoneAlways, true)
  assert.equal(floorBatch.userData.floorSurface, true)

  // Audited open-shell sidedness is a rendering contract, not disposable
  // source-mesh metadata. It must survive BatchedMesh packing and a later
  // architectural refresh, when source names are no longer available.
  const visibilityBatchRoot = new Group()
  const visibilityBatchMaterial = new MeshStandardMaterial({
    name: 'Packed audited shell',
    side: DoubleSide,
  })
  for (let i = 0; i < 6; i++) {
    const shell = new Mesh(
      new BoxGeometry(1 + i * 0.03, 2 + i * 0.02, 0.2 + i * 0.01),
      visibilityBatchMaterial,
    )
    shell.position.set(i * 1.5, 1, 0)
    shell.userData.surfaceVisibilityRisk = true
    shell.userData.surfaceVisibilityReason = 'audited-open-shell'
    visibilityBatchRoot.add(shell)
  }
  applyProceduralInstancing(visibilityBatchRoot, { minInstances: 99, minBatchSize: 4 })
  const visibilityBatch = visibilityBatchRoot.children.find((child) => child.isBatchedMesh)
  assert.ok(visibilityBatch)
  assert.equal(visibilityBatch.userData.surfaceVisibilityRisk, true)
  assert.equal(visibilityBatch.userData.surfaceVisibilityReason, 'audited-open-shell')
  visibilityBatch.material.side = FrontSide
  prepareArchitecturalMeshes(
    visibilityBatchRoot,
    computeSceneBounds(visibilityBatchRoot),
    { freezeStatic: false },
  )
  assert.equal(visibilityBatch.material.side, DoubleSide)
  assert.equal(visibilityBatch.userData.surfaceVisibilityReason, 'audited-open-shell')

  console.log('Visual correctness regression checks passed')
} finally {
  await vite.close()
}
