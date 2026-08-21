/**
 * Free-drive motion sanity: the car must travel where its nose points (no crabbing),
 * and the car-following ground plane must stay world-locked so motion reads correctly.
 * Run: npm run test:freedrive (from automotive-studio/)
 */
import assert from 'node:assert/strict'
import { BoxGeometry, Mesh, Object3D, PlaneGeometry, Vector2, Vector3 } from 'three'
import type { VehicleRigManifest, WheelBinding } from '../persistence/schema'
import { FreeDriveSession } from '../route/freeDriveSession'
import { infiniteFloorTextureOffset } from '../renderer/infiniteFloorUv'

const WHEEL_LOCAL: Record<WheelBinding['id'], [number, number, number]> = {
  FL: [-0.82, 0.36, 1.55],
  FR: [0.82, 0.36, 1.55],
  RL: [-0.82, 0.36, -1.55],
  RR: [0.82, 0.36, -1.55],
}
const WHEEL_IDS = ['FL', 'FR', 'RL', 'RR'] as const

const rig: VehicleRigManifest = {
  assetFingerprint: 'freedrive-test',
  primaryRoot: { name: 'TestModel' },
  boundsExclusions: [],
  forwardAxis: '+z',
  upAxis: '+y',
  wheels: WHEEL_IDS.map((id) => ({
    id,
    rollingNode: { name: `wheel_${id}` },
    radiusMetres: 0.36,
    axleAxis: 'x' as const,
    rollingDriver: 'route-distance' as const,
  })),
  semanticActions: [],
  preservedNodes: [],
}

/** Synthetic rigged car; `modelYaw` fakes a model authored with a different forward axis. */
function buildCar(modelYaw: number, opts?: { reverseBodyLamps?: boolean }) {
  const placement = new Object3D()
  placement.name = 'VehiclePlacement'
  const actionRoot = new Object3D()
  actionRoot.name = 'VehicleActionRoot'
  placement.add(actionRoot)
  const model = new Object3D()
  model.name = 'TestModel'
  model.rotation.y = modelYaw
  actionRoot.add(model)
  for (const id of WHEEL_IDS) {
    const hub = new Object3D()
    hub.name = `wheel_${id}`
    hub.position.fromArray(WHEEL_LOCAL[id])
    model.add(hub)
  }
  if (opts?.reverseBodyLamps) {
    // Headlamps on the axle *rear* — simulates flip180 / manifesto disagreeing with the mesh.
    // Use a pod-like box (not a paper-thin plane) so letter-mesh filters don't skip them.
    const head = new Mesh(new BoxGeometry(0.2, 0.15, 0.12))
    head.name = 'Headlight_L'
    head.position.set(0.5, 0.6, -2.2)
    model.add(head)
    const tail = new Mesh(new BoxGeometry(0.2, 0.15, 0.12))
    tail.name = 'TailLight_L'
    tail.position.set(0.5, 0.6, 2.2)
    model.add(tail)
  }
  placement.updateWorldMatrix(true, true)
  return { placement, actionRoot, model }
}

/** World direction the nose points, measured from the wheel hubs (front mid − rear mid). */
function noseDirection(placement: Object3D): Vector3 {
  placement.updateWorldMatrix(true, true)
  const hub = (id: WheelBinding['id']) => {
    const node = placement.getObjectByName(`wheel_${id}`)
    assert.ok(node, `missing wheel_${id}`)
    return node.getWorldPosition(new Vector3())
  }
  const front = hub('FL').add(hub('FR')).multiplyScalar(0.5)
  const rear = hub('RL').add(hub('RR')).multiplyScalar(0.5)
  return front.sub(rear).setY(0).normalize()
}

function drive(modelYaw: number, steer: number, seconds: number) {
  const { placement, actionRoot, model } = buildCar(modelYaw)
  const session = new FreeDriveSession()
  session.setVehicle(placement, rig, actionRoot, model)
  session.setMaxBodyRollDegrees(0)
  session.setEnabled(true)
  session.resetToOrigin()
  session.setInput({ throttle: 1, steer })

  const dt = 1 / 60
  const samples: { nose: Vector3; step: Vector3 }[] = []
  let previous = placement.position.clone()
  for (let i = 0; i < Math.round(seconds / dt); i += 1) {
    session.advance(dt)
    const step = placement.position.clone().sub(previous)
    previous = placement.position.clone()
    if (step.length() > 1e-4) samples.push({ nose: noseDirection(placement), step: step.setY(0).normalize() })
  }
  assert.ok(samples.length > 30, 'car did not move')
  return { placement, samples }
}

// 1. Straight-line drive: travel direction must equal the nose direction, whatever
//    forward axis the source model was authored with.
for (const modelYaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
  const { samples } = drive(modelYaw, 0, 2)
  for (const { nose, step } of samples) {
    const dot = nose.dot(step)
    assert.ok(
      dot > 0.9995,
      `straight drive crabs at modelYaw=${modelYaw.toFixed(3)}: nose·travel=${dot.toFixed(4)}`,
    )
  }
}

// 2. Turning: still no crabbing, and D (+1) must curve the car to its own right
//    (cross(previous nose, next nose).y is the signed yaw change — positive = right
//    when the car faces +Z under worldForwardFromYaw).
for (const modelYaw of [0, Math.PI / 2]) {
  for (const [steer, label, sign] of [[1, 'D', 1], [-1, 'A', -1]] as const) {
    const { samples } = drive(modelYaw, steer, 1.5)
    for (const { nose, step } of samples) {
      const dot = nose.dot(step)
      assert.ok(dot > 0.999, `turning crabs at modelYaw=${modelYaw.toFixed(3)}: nose·travel=${dot.toFixed(4)}`)
    }
    let turned = 0
    for (let i = 1; i < samples.length; i += 1) {
      const yawStep = samples[i - 1].nose.clone().cross(samples[i].nose).y
      assert.ok(
        yawStep * sign >= -1e-9,
        `${label} turned the wrong way at modelYaw=${modelYaw.toFixed(3)}: yawStep=${yawStep.toFixed(5)}`,
      )
      turned += Math.abs(yawStep)
    }
    assert.ok(turned > 0.5, `${label} barely turned the car (${turned.toFixed(3)})`)
  }
}

// 3. Turn symmetry: A mirrors D across the start heading.
{
  const right = drive(0, 1, 1.5).placement.position.clone()
  const left = drive(0, -1, 1.5).placement.position.clone()
  assert.ok(Math.abs(right.z - left.z) < 1e-6, 'A/D should mirror along travel axis')
  assert.ok(Math.abs(right.x + left.x) < 1e-6, 'A/D should mirror across the start heading')
  assert.ok(Math.abs(right.x) > 0.5, 'steering produced no lateral travel')
}

// 4. Headlamps opposite the axle FL→nose (common flip180 / manifesto mismatch):
//    W must still drive toward the visual front, not the rig "forward".
{
  const { placement, actionRoot, model } = buildCar(0, { reverseBodyLamps: true })
  const session = new FreeDriveSession()
  session.setVehicle(placement, rig, actionRoot, model)
  session.setMaxBodyRollDegrees(0)
  session.setEnabled(true)
  session.resetToOrigin()
  session.setInput({ throttle: 1, steer: 0 })
  for (let i = 0; i < 90; i += 1) session.advance(1 / 60)
  const step = placement.position.clone().setY(0)
  // Headlights authored at z=-2.2 → visual front is -Z.
  assert.ok(step.length() > 1, 'car did not move')
  assert.ok(
    step.z < -0.5,
    `W should drive toward headlamps (−Z), got z=${step.z.toFixed(3)}`,
  )
}

// 5. Infinite floor: the texture must map a fixed world point to the same texel no
//    matter where the plane has followed the car to.
{
  const size = 400
  const repeat = 57
  const plane = new Mesh(new PlaneGeometry(size, size, 1, 1))
  plane.rotation.x = -Math.PI / 2

  // Confirm the assumed PlaneGeometry UV layout instead of trusting it.
  const pos = plane.geometry.getAttribute('position')
  const uvAttr = plane.geometry.getAttribute('uv')
  for (let i = 0; i < pos.count; i += 1) {
    assert.ok(Math.abs(uvAttr.getX(i) - (pos.getX(i) / size + 0.5)) < 1e-6, 'unexpected u layout')
    assert.ok(Math.abs(uvAttr.getY(i) - (pos.getY(i) / size + 0.5)) < 1e-6, 'unexpected v layout')
  }

  const texelAt = (floorX: number, floorZ: number, world: Vector3) => {
    plane.position.set(floorX, 0, floorZ)
    plane.updateWorldMatrix(true, true)
    const local = plane.worldToLocal(world.clone())
    const offset = infiniteFloorTextureOffset(floorX, floorZ, repeat, size, new Vector2())
    return new Vector2(
      (local.x / size + 0.5) * repeat + offset.x,
      (local.y / size + 0.5) * repeat + offset.y,
    )
  }

  for (const probe of [new Vector3(0, 0, 0), new Vector3(3.5, 0, -8.25), new Vector3(-12, 0, 41)]) {
    const parked = texelAt(0, 0, probe)
    for (const [floorX, floorZ] of [[0, 30], [30, 0], [-18.5, 47.25]]) {
      const followed = texelAt(floorX, floorZ, probe)
      assert.ok(
        Math.abs(parked.x - followed.x) < 1e-6 && Math.abs(parked.y - followed.y) < 1e-6,
        `ground texture slides when the plane follows to (${floorX}, ${floorZ}): ` +
          `${parked.x.toFixed(4)},${parked.y.toFixed(4)} vs ${followed.x.toFixed(4)},${followed.y.toFixed(4)}`,
      )
    }
  }
}

console.log('free-drive heading + infinite floor lock OK')
