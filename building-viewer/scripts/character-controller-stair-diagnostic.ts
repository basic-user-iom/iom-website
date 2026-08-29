import assert from 'node:assert/strict'
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type Object3D,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CharacterController } from '../src/collision/CharacterController'
import { CollisionWorld } from '../src/collision/CollisionWorld'
import { buildCollisionChunks } from '../src/collision/buildCollisionChunks'
import type {
  CapsuleQueryResult,
  CollisionHit,
  ICollisionWorld,
} from '../src/collision/types'

const DT = 1 / 60
const UP = new Vector3(0, 1, 0)

function addBox(
  root: Group,
  material: MeshBasicMaterial,
  name: string,
  minX: number,
  maxX: number,
  baseY: number,
  topY: number,
  zWidth = 1.4,
): void {
  const mesh = new Mesh(
    new BoxGeometry(maxX - minX, topY - baseY, zWidth),
    material,
  )
  mesh.name = name
  mesh.position.set((minX + maxX) * 0.5, (baseY + topY) * 0.5, 0)
  root.add(mesh)
}

function disposeFixture(root: Object3D, material: MeshBasicMaterial): void {
  root.traverse((object) => {
    if ((object as Mesh).isMesh) (object as Mesh).geometry.dispose()
  })
  material.dispose()
}

async function createStairWorld(direction: 1 | -1): Promise<{
  world: CollisionWorld
  root: Group
  material: MeshBasicMaterial
}> {
  const root = new Group()
  const material = new MeshBasicMaterial()
  const baseY = -0.3
  const stepDepth = 0.3
  const stepRise = 0.18
  const stepCount = 10

  if (direction > 0) {
    addBox(root, material, 'COLLIDER_floor', -4, 0, baseY, 0, 4)
    for (let i = 0; i < stepCount; i++) {
      addBox(
        root,
        material,
        `COLLIDER_stair_step_${i}`,
        i * stepDepth,
        (i + 1) * stepDepth,
        baseY,
        (i + 1) * stepRise,
      )
    }
    addBox(root, material, 'COLLIDER_landing', stepCount * stepDepth, 7, baseY, stepCount * stepRise, 4)
  } else {
    addBox(root, material, 'COLLIDER_floor', 0, 4, baseY, 0, 4)
    for (let i = 0; i < stepCount; i++) {
      addBox(
        root,
        material,
        `COLLIDER_stair_step_${i}`,
        -(i + 1) * stepDepth,
        -i * stepDepth,
        baseY,
        (i + 1) * stepRise,
      )
    }
    addBox(root, material, 'COLLIDER_landing', -7, -stepCount * stepDepth, baseY, stepCount * stepRise, 4)
  }

  root.updateMatrixWorld(true)
  const built = buildCollisionChunks(root, {
    layerId: 'stair-fixture',
    verbose: false,
    ignoreVisibility: true,
    walkSurfacesOnly: true,
  })
  const world = new CollisionWorld()
  world.setLayerChunks('stair-fixture', built.chunks, built.report)
  await world.rebuildFromLayers(['stair-fixture'], new Vector3())
  return { world, root, material }
}

async function testAuthoredStairTraversal(direction: 1 | -1): Promise<void> {
  const { world, root, material } = await createStairWorld(direction)
  try {
    const controller = new CharacterController({ walkSpeed: 1.6 })
    controller.setWorld(world)
    controller.setFeetPosition(new Vector3(-direction * 0.45, 0, 0))
    for (let i = 0; i < 4; i++) controller.update(DT, new Vector3(), 0)
    assert.equal(controller.onGround, true, `${direction}: player should settle on the floor`)

    let sawAscentIntent = false
    for (let i = 0; i < 360; i++) {
      controller.update(DT, new Vector3(direction, 0, 0), 1.6)
      sawAscentIntent ||= controller.stairsIntent > 0
      if (direction * controller.position.x > 3.35) break
    }
    for (let i = 0; i < 4; i++) controller.update(DT, new Vector3(), 0)
    assert.ok(direction * controller.position.x > 3.2, `${direction}: player did not reach landing`)
    assert.ok(Math.abs(controller.position.y - 1.8) < 0.07, `${direction}: wrong landing height ${controller.position.y}`)
    assert.equal(controller.onGround, true, `${direction}: player should remain grounded on landing`)
    assert.equal(sawAscentIntent, true, `${direction}: ascent intent was never reported`)

    let sawDescentIntent = false
    for (let i = 0; i < 420; i++) {
      controller.update(DT, new Vector3(-direction, 0, 0), 1.6)
      sawDescentIntent ||= controller.stairsIntent < 0
      if (direction * controller.position.x < -0.35) break
    }
    for (let i = 0; i < 4; i++) controller.update(DT, new Vector3(), 0)
    assert.ok(direction * controller.position.x < -0.25, `${direction}: player did not return to lower floor`)
    assert.ok(Math.abs(controller.position.y) < 0.07, `${direction}: wrong lower-floor height ${controller.position.y}`)
    assert.equal(controller.onGround, true, `${direction}: player should remain grounded after descent`)
    assert.equal(sawDescentIntent, true, `${direction}: descent intent was never reported`)
  } finally {
    world.dispose()
    disposeFixture(root, material)
  }
}

async function testCrossLayerStairHandoff(): Promise<void> {
  const exteriorRoot = new Group()
  const stairRoot = new Group()
  const exteriorMaterial = new MeshBasicMaterial()
  const stairMaterial = new MeshBasicMaterial()
  const baseY = -0.3
  const stepDepth = 0.3
  const stepRise = 0.18
  const stepCount = 10

  addBox(exteriorRoot, exteriorMaterial, 'COLLIDER_exterior_floor', -4, 0, baseY, 0, 4)
  for (let i = 0; i < stepCount; i++) {
    addBox(
      stairRoot,
      stairMaterial,
      `COLLIDER_cross_layer_stair_${i}`,
      i * stepDepth,
      (i + 1) * stepDepth,
      baseY,
      (i + 1) * stepRise,
    )
  }
  addBox(
    stairRoot,
    stairMaterial,
    'COLLIDER_cross_layer_landing',
    stepCount * stepDepth,
    7,
    baseY,
    stepCount * stepRise,
    4,
  )
  exteriorRoot.updateMatrixWorld(true)
  stairRoot.updateMatrixWorld(true)
  const exterior = buildCollisionChunks(exteriorRoot, {
    layerId: 'exterior-layer',
    verbose: false,
    ignoreVisibility: true,
    walkSurfacesOnly: true,
  })
  const interior = buildCollisionChunks(stairRoot, {
    layerId: 'interior-layer',
    verbose: false,
    ignoreVisibility: true,
    walkSurfacesOnly: true,
  })
  const world = new CollisionWorld()
  world.setLayerChunks('exterior-layer', exterior.chunks, exterior.report)
  world.setLayerChunks('interior-layer', interior.chunks, interior.report)
  await world.rebuildFromLayers(['exterior-layer', 'interior-layer'], new Vector3())

  try {
    world.setQueryLayer('exterior-layer')
    const controller = new CharacterController({ walkSpeed: 1.6 })
    controller.setWorld(world)
    controller.setFeetPosition(new Vector3(-0.45, 0, 0))
    for (let i = 0; i < 4; i++) controller.update(DT, new Vector3(), 0)

    for (let i = 0; i < 360; i++) {
      controller.update(DT, new Vector3(1, 0, 0), 1.6)
      if (controller.position.x > 3.35) break
    }
    assert.ok(controller.position.x > 3.2, 'cross-layer ascent did not reach the landing')
    assert.ok(Math.abs(controller.position.y - 1.8) < 0.07)
    assert.equal(
      world.getQueryLayer(),
      'interior-layer',
      'reachable stair contact must transfer collision ownership',
    )

    for (let i = 0; i < 420; i++) {
      controller.update(DT, new Vector3(-1, 0, 0), 1.6)
      if (controller.position.x < -0.3) break
    }
    for (let i = 0; i < 4; i++) controller.update(DT, new Vector3(), 0)
    assert.ok(controller.position.x < -0.25, 'cross-layer descent did not return to exterior')
    assert.ok(Math.abs(controller.position.y) < 0.07)
    assert.equal(
      world.getQueryLayer(),
      'exterior-layer',
      'ordinary support fallback must transfer back after leaving the stair',
    )
  } finally {
    world.dispose()
    disposeFixture(exteriorRoot, exteriorMaterial)
    disposeFixture(stairRoot, stairMaterial)
  }
}

/** Minimal solid-volume backend used to verify reversal/sideways rejection. */
class VolumeFallbackWorld implements ICollisionWorld {
  async rebuild(): Promise<{ ms: number; triangles: number }> {
    return { ms: 0, triangles: 1 }
  }

  raycast(): CollisionHit | null {
    return null
  }

  raycastBestGround(origin: Vector3, maxDistance = 0): CollisionHit | null {
    // Match each controller probe to its current feet height. The long probe is
    // hasDescendingTread(), the medium probe is snapToGround(), and the short
    // probe is step detection.
    const offset = maxDistance > 1.14 ? 0.08 : maxDistance > 1 ? 0.47 : 0.54
    const point = new Vector3(origin.x, origin.y - offset, origin.z)
    return { point, normal: UP.clone(), distance: offset }
  }

  stairWellAt(): { minY: number; maxY: number } {
    return { minY: 0, maxY: 3 }
  }

  capsuleIntersect(): CapsuleQueryResult {
    return { depth: 0.08, normal: new Vector3(-1, 0, 0), stairZone: true }
  }

  dispose(): void {}
}

/** Stair contact exists only at entry; the climb lock must bridge the hollow run. */
class SparseVolumeWorld implements ICollisionWorld {
  private contacts = 0

  async rebuild(): Promise<{ ms: number; triangles: number }> {
    return { ms: 0, triangles: 1 }
  }

  raycast(): CollisionHit | null {
    return null
  }

  raycastBestGround(origin: Vector3): CollisionHit {
    return {
      point: new Vector3(origin.x, 0, origin.z),
      normal: UP.clone(),
      distance: origin.y,
    }
  }

  stairWellAt(): { minY: number; maxY: number } {
    return { minY: 0, maxY: 3 }
  }

  capsuleIntersect(): CapsuleQueryResult | null {
    if (this.contacts++ > 0) return null
    return {
      depth: 0.08,
      normal: new Vector3(-1, 0, 0),
      stairZone: true,
      layerId: 'sparse-stair',
    }
  }

  dispose(): void {}
}

/**
 * Models the ambiguous geometry at the top of a solid CAD stair flight.
 *
 * The long downhill probe can see the next lower tread, but the shorter
 * step-up probe also sees a thin upper lip 4 cm above the feet. A reversed
 * controller must classify the move as descent before trying step-up;
 * otherwise it repeatedly climbs the lip and never returns downstairs.
 */
class ReverseStepTrapWorld extends VolumeFallbackWorld {
  raycastBestGround(origin: Vector3, maxDistance = 0): CollisionHit {
    const probeOffset = maxDistance > 1.14 ? 0.08 : maxDistance > 1 ? 0.47 : 0.54
    let y = origin.y - probeOffset
    if (origin.x < -0.05) {
      // A fixed upper lip overlaps the first downhill step probe while the
      // true next tread is 18 cm lower and continues beyond that lip.
      y = maxDistance <= 1 && origin.x > -0.3 ? 1.1 : 0.88
    }
    return {
      point: new Vector3(origin.x, y, origin.z),
      normal: UP.clone(),
      distance: origin.y - y,
    }
  }

  capsuleIntersect(start?: Vector3): CapsuleQueryResult | null {
    return start && start.x < -0.3 ? null : super.capsuleIntersect()
  }
}

function climbOnce(controller: CharacterController): number {
  controller.setFeetPosition(new Vector3(0, 1, 0))
  controller.onGround = true
  controller.update(DT, new Vector3(1, 0, 0), 1)
  assert.ok(
    controller.position.y > 1.04,
    `blocked stair contact should start volume ascent (Y=${controller.position.y})`,
  )
  return controller.position.y
}

function testVolumeFallbackDirectionGuard(): void {
  const controller = new CharacterController()
  controller.setWorld(new VolumeFallbackWorld())

  const afterAscent = climbOnce(controller)
  controller.update(DT, new Vector3(-1, 0, 0), 1)
  assert.ok(
    controller.position.y < afterAscent + 0.01,
    `reversing direction incorrectly continued volume ascent (${afterAscent} -> ${controller.position.y})`,
  )

  const afterSecondAscent = climbOnce(controller)
  controller.update(DT, new Vector3(0, 0, 1), 1)
  assert.ok(
    controller.position.y < afterSecondAscent + 0.01,
    `sideways motion incorrectly continued volume ascent (${afterSecondAscent} -> ${controller.position.y})`,
  )
}

function testVolumeFallbackContinuesAcrossHollowRun(): void {
  const controller = new CharacterController()
  controller.setWorld(new SparseVolumeWorld())
  controller.setFeetPosition(new Vector3(0, 0, 0))
  controller.onGround = true
  for (let i = 0; i < 8; i++) {
    controller.update(DT, new Vector3(1, 0, 0), 1)
  }
  assert.ok(
    controller.position.y > 0.3,
    `latched stair-volume ascent stopped over a hollow run (${controller.position.y})`,
  )
  assert.equal(controller.onGround, true)
}

function testVolumeFallbackReversePrefersDescentOverStepUp(): void {
  const controller = new CharacterController()
  controller.setWorld(new ReverseStepTrapWorld())
  const ascentY = climbOnce(controller)
  let maximumReverseY = ascentY

  for (let i = 0; i < 36; i++) {
    controller.update(DT, new Vector3(-1, 0, 0), 1)
    maximumReverseY = Math.max(maximumReverseY, controller.position.y)
  }

  assert.ok(
    maximumReverseY <= ascentY + 0.015,
    `downhill reversal re-entered step/volume ascent (${ascentY} -> ${maximumReverseY})`,
  )
  assert.ok(
    controller.position.y < ascentY - 0.15,
    `downhill reversal never reached the lower tread (${ascentY} -> ${controller.position.y})`,
  )
  assert.equal(controller.onGround, true)
}

class GroundOffsetWorld implements ICollisionWorld {
  constructor(private readonly offsetAboveFeet: number) {}

  async rebuild(): Promise<{ ms: number; triangles: number }> {
    return { ms: 0, triangles: 1 }
  }

  raycast(): CollisionHit | null {
    return null
  }

  raycastBestGround(origin: Vector3): CollisionHit {
    // snapToGround casts from feet + stepHeight + 0.05 (= 0.47 m).
    const y = origin.y - 0.47 + this.offsetAboveFeet
    return {
      point: new Vector3(origin.x, y, origin.z),
      normal: UP.clone(),
      distance: origin.y - y,
    }
  }

  capsuleIntersect(): CapsuleQueryResult | null {
    return null
  }

  dispose(): void {}
}

function testGroundAboveFeetIsNotGrounding(): void {
  const overhead = new CharacterController()
  overhead.setWorld(new GroundOffsetWorld(0.3))
  overhead.setFeetPosition(new Vector3(0, 0, 0))
  overhead.update(DT, new Vector3(), 0)
  assert.equal(overhead.onGround, false, 'a collider 0.30 m above the feet is not ground')
  assert.ok(overhead.position.y < 0, 'gravity must continue below an overhead collider')

  const closeSupport = new CharacterController()
  closeSupport.setWorld(new GroundOffsetWorld(0.03))
  closeSupport.setFeetPosition(new Vector3(0, 0, 0))
  closeSupport.update(DT, new Vector3(), 0)
  assert.equal(closeSupport.onGround, true, 'a support within 3 cm remains ground')
  assert.ok(closeSupport.position.y > 0.015 && closeSupport.position.y < 0.04)
}

async function testBestGroundLooksPastSteepHit(): Promise<void> {
  const root = new Group()
  const material = new MeshBasicMaterial()
  const floorGeometry = new BoxGeometry(4, 0.1, 4)
  floorGeometry.translate(0, -0.05, 0)
  const steepGeometry = new BoxGeometry(4, 0.05, 4)
  steepGeometry.rotateZ((75 * Math.PI) / 180)
  steepGeometry.translate(0, 1, 0)
  const merged = mergeGeometries([floorGeometry, steepGeometry], false)
  floorGeometry.dispose()
  steepGeometry.dispose()
  assert.ok(merged, 'failed to create merged ground-probe fixture')
  const fixture = new Mesh(merged, material)
  fixture.name = 'COLLIDER_stair_ground_probe'
  root.add(fixture)
  root.updateMatrixWorld(true)

  const built = buildCollisionChunks(root, {
    layerId: 'ground-probe-fixture',
    verbose: false,
    ignoreVisibility: true,
    walkSurfacesOnly: true,
  })
  const world = new CollisionWorld()
  world.setLayerChunks('ground-probe-fixture', built.chunks, built.report)
  await world.rebuildFromLayers(['ground-probe-fixture'], new Vector3())
  try {
    const hit = world.raycastBestGround(new Vector3(0, 3, 0), 5, 0.65)
    assert.ok(hit, 'ground probe should look past the nearest steep face')
    assert.ok(Math.abs(hit.point.y) < 0.06, `ground probe chose wrong surface at Y=${hit.point.y}`)
  } finally {
    world.dispose()
    disposeFixture(root, material)
  }
}

await testAuthoredStairTraversal(1)
await testAuthoredStairTraversal(-1)
await testCrossLayerStairHandoff()
testVolumeFallbackDirectionGuard()
testVolumeFallbackContinuesAcrossHollowRun()
testVolumeFallbackReversePrefersDescentOverStepUp()
testGroundAboveFeetIsNotGrounding()
await testBestGroundLooksPastSteepHit()

console.info('Character stair diagnostic passed: stairs, direction guard, overhead-ground rejection, multi-hit probe')
