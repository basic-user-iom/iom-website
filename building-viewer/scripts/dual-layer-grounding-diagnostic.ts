import assert from 'node:assert/strict'
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from 'three'
import { CollisionWorld } from '../src/collision/CollisionWorld'
import {
  buildCollisionChunks,
  type CollisionChunkSource,
} from '../src/collision/buildCollisionChunks'
import { buildAuditoriumAisleCollision } from '../src/collision/auditoriumAisleCollision'
import {
  finalizeVisiblePegmanDrop,
  validateVisiblePlacementSurface,
} from '../src/controls/PegmanPlacement'
import { DEFAULT_CHARACTER_PARAMS } from '../src/collision/types'
import {
  applyIcmDedicatedCollisionFacePolicy,
  ICM_ANIMATED_STAIR_LANDING_SUPPLEMENTS,
  isIcmAnimatedWalkCollisionSupplement,
  isIcmBridgeCollisionSupplement,
} from '../src/scene/assetSemantics'

function floorChunk(name: string, y: number, size = 12, stairZone = false): CollisionChunkSource {
  const geometry = new PlaneGeometry(size, size)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, y, 0)
  geometry.computeBoundingBox()
  const box = geometry.boundingBox?.clone()
  if (!box) throw new Error(`Synthetic floor ${name} has no bounds`)
  return {
    geometry,
    box,
    triangles: 2,
    name,
    stairZone,
  }
}

function mirroredFloorPrismChunk(
  name: string,
  sourceNames: string[],
): CollisionChunkSource {
  const min = new Vector3(-25.3938, -0.300041, -92.4871)
  const max = new Vector3(-8.4663, 0.000017, -69.0419)
  const size = max.clone().sub(min)
  const center = min.clone().add(max).multiplyScalar(0.5)
  const geometry = new BoxGeometry(size.x, size.y, size.z)
  geometry.applyMatrix4(new Matrix4().makeScale(-1, 1, 1))
  geometry.translate(center.x, center.y, center.z)
  geometry.computeBoundingBox()
  const box = geometry.boundingBox?.clone()
  if (!box) throw new Error(`Synthetic mirrored floor ${name} has no bounds`)
  return {
    geometry,
    box,
    triangles: 12,
    name,
    sourceNames,
  }
}

const down = new Vector3(0, -1, 0)
const origin = new Vector3(0, 2, 0)
const world = new CollisionWorld()
world.setLayerChunks('icm-ext', [floorChunk('exterior-paving', 0)])
world.setLayerChunks('icm-anim-2025', [floorChunk('overlapping-animated-platform', 0.9)])
await world.rebuildFromLayers(['icm-ext', 'icm-anim-2025'])

const merged = world.raycastBestGround(origin, 4, 0.7)
assert.ok(merged, 'merged diagnostic should see a ground surface')
assert.ok(Math.abs(merged.point.y - 0.9) < 1e-5, 'fixture must reproduce highest-layer promotion')
assert.equal(merged.layerId, 'icm-anim-2025')

world.setQueryLayer('icm-ext')
const exteriorGround = world.raycastBestGround(origin, 4, 0.7)
assert.ok(exteriorGround, 'selected exterior layer should provide paving support')
assert.ok(Math.abs(exteriorGround.point.y) < 1e-5, 'exterior placement must stay on rendered paving')
assert.equal(exteriorGround.layerId, 'icm-ext')
assert.equal(exteriorGround.sourceName, 'exterior-paving')

const exteriorRay = world.raycast(origin, down, 4)
assert.ok(exteriorRay)
assert.equal(exteriorRay.layerId, 'icm-ext')
assert.ok(Math.abs(exteriorRay.point.y) < 1e-5)

// Layer insertion/rebuild order must not change the selected walk surface.
await world.rebuildFromLayers(['icm-anim-2025', 'icm-ext'])
const reversed = world.raycastBestGround(origin, 4, 0.7)
assert.ok(reversed)
assert.equal(reversed.layerId, 'icm-ext')
assert.ok(Math.abs(reversed.point.y) < 1e-5)

// A legitimate tread remains queryable when its owning layer is selected.
world.setLayerChunks('stair-layer', [floorChunk('stair-tread', 0.18, 2, true)])
await world.rebuildFromLayers(['icm-ext', 'icm-anim-2025', 'stair-layer'])
world.setQueryLayer('icm-ext')
const reachableForeignTread = world.raycastBestGround(new Vector3(0, 0.5, 0), 0.5, 0.7)
assert.ok(reachableForeignTread)
assert.equal(
  reachableForeignTread.layerId,
  'stair-layer',
  'a reachable stair may cross the placement-layer boundary',
)
world.setQueryLayer('stair-layer')
const tread = world.raycastBestGround(new Vector3(0, 0.5, 0), 0.5, 0.7)
assert.ok(tread)
assert.equal(tread.layerId, 'stair-layer')
assert.ok(Math.abs(tread.point.y - 0.18) < 1e-5)

world.clearLayer('stair-layer')
assert.equal(world.getQueryLayer(), null, 'removing the selected layer must release its query filter')
world.dispose()

// A circulation bridge must be queryable from another selected layer without
// pretending to be a solid stair volume. The distinction prevents an aisle's
// broad AABB from activating CharacterController's stair-volume climb latch.
const layerBridgeWorld = new CollisionWorld()
const baseSupport = floorChunk('base-layer-support', 0)
const foreignLayerBridge = floorChunk('auditorium-layer-bridge', 0.18, 2)
foreignLayerBridge.layerBridge = true
layerBridgeWorld.setLayerChunks('base-layer', [baseSupport])
layerBridgeWorld.setLayerChunks('bridge-layer', [foreignLayerBridge])
await layerBridgeWorld.rebuildFromLayers(['base-layer', 'bridge-layer'], new Vector3())
layerBridgeWorld.setQueryLayer('base-layer')

const bridgeGround = layerBridgeWorld.raycastBestGround(
  new Vector3(0, 0.5, 0),
  0.5,
  0.7,
)
assert.ok(bridgeGround, 'cross-layer bridge should be available to ground queries')
assert.equal(bridgeGround.layerId, 'bridge-layer')
assert.equal(bridgeGround.sourceName, 'auditorium-layer-bridge')
assert.equal(bridgeGround.layerBridge, true)
assert.equal(bridgeGround.stairZone, false)
assert.equal(
  layerBridgeWorld.stairWellAt(0, 0.18, 0),
  null,
  'layerBridge must not create a stair well / volume-climb latch',
)

const bridgeRay = layerBridgeWorld.raycast(new Vector3(0, 0.5, 0), down, 0.5)
assert.ok(bridgeRay, 'cross-layer bridge should be available to ordinary ray queries')
assert.equal(bridgeRay.layerId, 'bridge-layer')
assert.equal(bridgeRay.layerBridge, true)
assert.equal(bridgeRay.stairZone, false)

const bridgeContact = layerBridgeWorld.capsuleIntersect(
  new Vector3(0, 0.2, 0),
  new Vector3(0, 1.4, 0),
  0.05,
)
assert.ok(bridgeContact, 'cross-layer bridge should be available to capsule queries')
assert.equal(bridgeContact.layerId, 'bridge-layer')
assert.equal(bridgeContact.layerBridge, true)
assert.equal(bridgeContact.stairZone, false)
assert.equal(
  layerBridgeWorld.getQueryLayer(),
  'base-layer',
  'read-only bridge queries must not mutate layer ownership',
)
layerBridgeWorld.dispose()

// The stage-side BD_Absenkung slab is mirrored in the dedicated collision GLB.
// FrontSide sees its lower face at -0.30 m; the exact, sole-source policy must
// preserve its authored DoubleSide intent without widening to fuzzy names,
// mixed chunks, other layers, or unrelated auditorium collision.
const unprotectedMirroredChunk = mirroredFloorPrismChunk(
  'unprotected-stage-floor',
  ['COLLIDER_BD_Absenkung'],
)
const unprotectedMirroredWorld = new CollisionWorld()
unprotectedMirroredWorld.setLayerChunks('icm-anim-2025', [unprotectedMirroredChunk])
await unprotectedMirroredWorld.rebuildFromLayers(['icm-anim-2025'])
const stageFloorOrigin = new Vector3(-16.93005, 1, -80.7645)
const unprotectedMirroredGround = unprotectedMirroredWorld.raycastBestGround(
  stageFloorOrigin,
  2,
  0.7,
)
assert.ok(unprotectedMirroredGround)
assert.ok(
  Math.abs(unprotectedMirroredGround.point.y + 0.300041) < 1e-5,
  'fixture must reproduce the 30 cm reverse-wound stage-floor sink',
)
unprotectedMirroredWorld.dispose()

const protectedMirroredChunk = mirroredFloorPrismChunk(
  'protected-stage-floor',
  ['COLLIDER_BD_Absenkung'],
)
assert.equal(
  applyIcmDedicatedCollisionFacePolicy('icm-anim-2025', [protectedMirroredChunk]),
  1,
)
assert.equal(protectedMirroredChunk.doubleSided, true)
const protectedMirroredWorld = new CollisionWorld()
protectedMirroredWorld.setLayerChunks('icm-anim-2025', [protectedMirroredChunk])
await protectedMirroredWorld.rebuildFromLayers(['icm-anim-2025'])
const protectedMirroredGround = protectedMirroredWorld.raycastBestGround(
  stageFloorOrigin,
  2,
  0.7,
)
assert.ok(protectedMirroredGround)
assert.ok(
  Math.abs(protectedMirroredGround.point.y - 0.000017) < 1e-5,
  'audited DoubleSide policy must restore the mirrored stage-floor top',
)
protectedMirroredWorld.dispose()

for (const [layerId, sourceNames] of [
  ['icm-anim-2025', ['COLLIDER_BD_Absenkung_extra']],
  ['icm-anim-2025', ['COLLIDER_BD_Absenkung', 'COLLIDER_other_floor']],
  ['icm-ext', ['COLLIDER_BD_Absenkung']],
] as const) {
  const control = mirroredFloorPrismChunk('stage-floor-control', [...sourceNames])
  assert.equal(applyIcmDedicatedCollisionFacePolicy(layerId, [control]), 0)
  assert.notEqual(control.doubleSided, true)
  control.geometry.dispose()
}

const changedTriangleCount = mirroredFloorPrismChunk(
  'stage-floor-changed-triangles',
  ['COLLIDER_BD_Absenkung'],
)
changedTriangleCount.triangles = 10
assert.equal(
  applyIcmDedicatedCollisionFacePolicy('icm-anim-2025', [changedTriangleCount]),
  0,
)
changedTriangleCount.geometry.dispose()

const changedBounds = mirroredFloorPrismChunk(
  'stage-floor-changed-bounds',
  ['COLLIDER_BD_Absenkung'],
)
changedBounds.box.min.x -= 0.01
assert.equal(
  applyIcmDedicatedCollisionFacePolicy('icm-anim-2025', [changedBounds]),
  0,
)
changedBounds.geometry.dispose()

const duplicateStageFloors = [
  mirroredFloorPrismChunk('stage-floor-duplicate-a', ['COLLIDER_BD_Absenkung']),
  mirroredFloorPrismChunk('stage-floor-duplicate-b', ['COLLIDER_BD_Absenkung']),
]
assert.equal(
  applyIcmDedicatedCollisionFacePolicy('icm-anim-2025', duplicateStageFloors),
  0,
)
assert.ok(duplicateStageFloors.every((chunk) => chunk.doubleSided !== true))
duplicateStageFloors.forEach((chunk) => chunk.geometry.dispose())

// Auditorium support is extracted from the rendered floor but must be clipped
// to the aisle itself; the real source mesh also spans the seating platforms.
const aisleSource = new Group()
const aisleMaterial = new MeshBasicMaterial({ name: 'Floor_Wood_Vray_001' })
const broadWoodFloor = new Mesh(new PlaneGeometry(20, 20), aisleMaterial)
broadWoodFloor.geometry.rotateX(-Math.PI / 2)
aisleSource.add(broadWoodFloor)
aisleSource.updateMatrixWorld(true)
const aisleBuilt = buildAuditoriumAisleCollision(aisleSource, [
  {
    name: 'auditorium_aisle_test',
    width: 2,
    points: [
      [0, 0, 0],
      [8, 0, 0],
    ],
  },
])
assert.equal(aisleBuilt.exactSegments, 1)
assert.equal(aisleBuilt.fallbackSegments, 0)
assert.ok(aisleBuilt.treadTriangles >= 4)
assert.equal(aisleBuilt.guardTriangles, 4)
const clippedTread = aisleBuilt.root.getObjectByName(
  'COLLIDER_walk_auditorium_aisle_test_0',
) as Mesh
assert.ok(clippedTread)
const clippedPositions = clippedTread.geometry.getAttribute('position')
for (let index = 0; index < clippedPositions.count; index += 1) {
  const x = clippedPositions.getX(index)
  const y = clippedPositions.getY(index)
  const z = clippedPositions.getZ(index)
  assert.ok(x >= -0.16001 && x <= 8.16001, `aisle tread leaked along route: x=${x}`)
  assert.ok(Math.abs(y) < 1e-6, `aisle tread changed rendered height: y=${y}`)
  assert.ok(Math.abs(z) <= 1.00001, `aisle tread leaked into seating: z=${z}`)
}
aisleBuilt.root.traverse((object) => {
  if ((object as Mesh).isMesh) (object as Mesh).geometry.dispose()
})
broadWoodFloor.geometry.dispose()
aisleMaterial.dispose()

function bridgeFixtureMesh(
  name: string,
  materialName: string,
  triangles: number,
  x: number,
): Mesh {
  assert.equal(triangles % 2, 0)
  const material = new MeshBasicMaterial({ name: materialName })
  const geometry = new PlaneGeometry(1, 1, triangles / 2, 1)
  geometry.rotateX(-Math.PI / 2)
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.position.x = x
  return mesh
}

// Exact bridge semantics: include only the three missing decks (302 tris),
// never the already-authored 72-triangle Gangway collider or fuzzy matches.
const bridgeRoot = new Group()
const bridgeMeshes = [
  bridgeFixtureMesh('Floor', 'vray Bruecke_Gitter', 144, 0),
  bridgeFixtureMesh('Floor001', 'vray Bruecke_Gitter', 144, 2),
  bridgeFixtureMesh('Floor_Mitte', 'vray Bruecke_Gitter', 14, 4),
  bridgeFixtureMesh('Gangway_Raster', 'vray Bruecke_Gitter_saal_14', 72, 6),
  bridgeFixtureMesh('BridgeRail', 'vray Bruecke_Gitter', 12, 8),
  bridgeFixtureMesh('Floor', 'vray Bruecke_Gitter_saal_14', 12, 10),
]
bridgeMeshes[1]!.scale.x = -1 // mirrored authored Floor001 must remain eligible
bridgeRoot.add(...bridgeMeshes)
bridgeRoot.updateMatrixWorld(true)
const bridgeBuilt = buildCollisionChunks(bridgeRoot, {
  layerId: 'icm-anim-2025',
  verbose: false,
  ignoreVisibility: true,
  walkSurfacesOnly: true,
  includeMesh: isIcmBridgeCollisionSupplement,
  isExplicitWalkable: isIcmBridgeCollisionSupplement,
  doubleSided: true,
})
assert.equal(bridgeBuilt.report.triangles, 302)
assert.deepEqual(
  bridgeBuilt.report.selected
    .map(({ name, material, triangles }) => [name, material, triangles])
    .sort(),
  [
    ['Floor', 'vray Bruecke_Gitter', 144],
    ['Floor001', 'vray Bruecke_Gitter', 144],
    ['Floor_Mitte', 'vray Bruecke_Gitter', 14],
  ].sort(),
)
assert.ok(bridgeBuilt.chunks.every((chunk) => chunk.doubleSided))

for (const chunk of bridgeBuilt.chunks) chunk.geometry.dispose()
for (const mesh of bridgeMeshes) {
  mesh.geometry.dispose()
  ;(mesh.material as MeshBasicMaterial).dispose()
}

// Known animated circulation omissions are restored narrowly; nearby railings
// must not become walk collision just because they live below a stair owner.
const secondFloorOwner = new Group()
secondFloorOwner.name = 'Decke_2OG_A'
const missingSecondFloor = new Mesh(
  new PlaneGeometry(2, 2),
  new MeshBasicMaterial({ name: 'Floor_Wood_Vray_001' }),
)
missingSecondFloor.name = 'mesh_493'
secondFloorOwner.add(missingSecondFloor)
assert.equal(
  isIcmAnimatedWalkCollisionSupplement(missingSecondFloor),
  false,
  'the broad 2OG floor must not cover the stairwell',
)
assert.equal(ICM_ANIMATED_STAIR_LANDING_SUPPLEMENTS.length, 2)

const outsideStairOwner = new Group()
outsideStairOwner.name = 'treppen_aussen'
const missingOutsideTread = new Mesh(
  new BoxGeometry(1, 0.2, 0.3),
  new MeshBasicMaterial({ name: 'Naturstein' }),
)
missingOutsideTread.name = 'Stufen'
outsideStairOwner.add(missingOutsideTread)
assert.equal(isIcmAnimatedWalkCollisionSupplement(missingOutsideTread), true)
const outsideHandrail = new Mesh(
  new BoxGeometry(1, 0.05, 0.05),
  new MeshBasicMaterial({ name: 'Handlauf Metall' }),
)
outsideHandrail.name = 'Rail'
outsideStairOwner.add(outsideHandrail)
assert.equal(isIcmAnimatedWalkCollisionSupplement(outsideHandrail), false)

missingSecondFloor.geometry.dispose()
;(missingSecondFloor.material as MeshBasicMaterial).dispose()
missingOutsideTread.geometry.dispose()
;(missingOutsideTread.material as MeshBasicMaterial).dispose()
outsideHandrail.geometry.dispose()
;(outsideHandrail.material as MeshBasicMaterial).dispose()

// EXT_mesh_gpu_instancing carries transforms outside mesh.matrixWorld. It must
// never be flattened as a plain Mesh around the origin (the old Y=10 phantom).
const instancedRoot = new Group()
const instancedGeometry = new BoxGeometry(300, 10, 300)
const instancedMaterial = new MeshBasicMaterial({ name: 'vray Stucco - White R_001.002' })
const instancedPhantom = new InstancedMesh(instancedGeometry, instancedMaterial, 1)
instancedPhantom.name = 'COLLIDER_node'
instancedPhantom.setMatrixAt(0, new Matrix4().makeTranslation(-220, 15, 20))
instancedPhantom.instanceMatrix.needsUpdate = true
instancedRoot.add(instancedPhantom)
const instancedBuilt = buildCollisionChunks(instancedRoot, {
  layerId: 'icm-ext:instanced-phantom',
  verbose: false,
  ignoreVisibility: true,
  walkSurfacesOnly: true,
})
assert.equal(instancedBuilt.chunks.length, 0)
assert.ok(
  instancedBuilt.report.skipped.some(
    ({ reason }) => reason === 'instanced collision requires flattened proxy',
  ),
)
instancedGeometry.dispose()
instancedMaterial.dispose()

// Final placement requires a rendered surface with nearby same-layer support.
const placementWorld = new CollisionWorld()
placementWorld.setLayerChunks('visible-layer', [floorChunk('visible-support', 0)])
await placementWorld.rebuildFromLayers(['visible-layer'])
const matchingSupport = validateVisiblePlacementSurface(
  placementWorld,
  {
    point: new Vector3(0, 0.05, 0),
    normal: new Vector3(0, 1, 0),
    distance: 1,
    layerId: 'visible-layer',
    objectName: 'Floor',
  },
  DEFAULT_CHARACTER_PARAMS,
)
assert.equal(matchingSupport.ok, true)
assert.ok(matchingSupport.point)
assert.ok(Math.abs(matchingSupport.point.y) < 1e-5)

const heightMismatch = validateVisiblePlacementSurface(
  placementWorld,
  {
    point: new Vector3(0, 0.25, 0),
    normal: new Vector3(0, 1, 0),
    distance: 1,
    layerId: 'visible-layer',
    objectName: 'Floor',
  },
  DEFAULT_CHARACTER_PARAMS,
)
assert.equal(heightMismatch.ok, false)
const collisionOnlyDrop = finalizeVisiblePegmanDrop(null)
assert.equal(collisionOnlyDrop.ok, false)
assert.equal(collisionOnlyDrop.point, undefined)
assert.equal(placementWorld.getQueryLayer(), null)
placementWorld.dispose()

console.log('Dual-layer walk grounding: PASS (layer ownership, bridge supplement, visible support gate)')
