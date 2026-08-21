import assert from 'node:assert/strict'
import { BoxGeometry, Mesh, Object3D, Vector3 } from 'three'
import type { VehicleRigManifest, WheelBinding } from '../persistence/schema'
import { FreeDriveSession } from '../route/freeDriveSession'
import { worldForwardFromYaw } from '../route/wheelRoll'

const WHEEL_LOCAL: Record<WheelBinding['id'], [number, number, number]> = {
  FL: [-0.82, 0.36, 1.55],
  FR: [0.82, 0.36, 1.55],
  RL: [-0.82, 0.36, -1.55],
  RR: [0.82, 0.36, -1.55],
}
const ids = ['FL', 'FR', 'RL', 'RR'] as const

const rig: VehicleRigManifest = {
  assetFingerprint: 'steer-flip',
  primaryRoot: { name: 'M' },
  boundsExclusions: [],
  forwardAxis: '+z',
  upAxis: '+y',
  wheels: ids.map((id) => ({
    id,
    rollingNode: { name: `wheel_${id}` },
    steeringNode: id.startsWith('F') ? { name: `steer_${id}` } : undefined,
    radiusMetres: 0.36,
    axleAxis: 'x' as const,
    rollingDriver: 'route-distance' as const,
  })),
  semanticActions: [],
  preservedNodes: [],
}

function build(opts?: { reverseLamps?: boolean }) {
  const placement = new Object3D()
  placement.name = 'VehiclePlacement'
  const actionRoot = new Object3D()
  actionRoot.name = 'VehicleActionRoot'
  placement.add(actionRoot)
  const model = new Object3D()
  model.name = 'M'
  actionRoot.add(model)
  for (const id of ids) {
    const hub = new Object3D()
    hub.name = `wheel_${id}`
    hub.position.fromArray(WHEEL_LOCAL[id])
    if (id.startsWith('F')) {
      const steer = new Object3D()
      steer.name = `steer_${id}`
      steer.position.copy(hub.position)
      hub.position.set(0, 0, 0)
      hub.add(new Mesh(new BoxGeometry(0.25, 0.7, 0.7)))
      steer.add(hub)
      model.add(steer)
    } else {
      hub.add(new Mesh(new BoxGeometry(0.25, 0.7, 0.7)))
      model.add(hub)
    }
  }
  if (opts?.reverseLamps) {
    const h = new Mesh(new BoxGeometry(0.2, 0.15, 0.12))
    h.name = 'Headlight_L'
    h.position.set(0.5, 0.6, -2.2)
    model.add(h)
    const t = new Mesh(new BoxGeometry(0.2, 0.15, 0.12))
    t.name = 'TailLight_L'
    t.position.set(0.5, 0.6, 2.2)
    model.add(t)
  }
  placement.updateWorldMatrix(true, true)
  return { placement, actionRoot, model }
}

function tipAlongTravelRight(session: FreeDriveSession, placement: Object3D, steer: number) {
  session.setInput({ throttle: 1, steer: 0 })
  for (let i = 0; i < 25; i += 1) session.advance(1 / 60)
  session.setInput({ throttle: 0, steer: 0 })
  for (let i = 0; i < 40; i += 1) session.advance(1 / 60)

  const flSteer = placement.getObjectByName('steer_FL')!
  session.setInput({ throttle: 0, steer: 0 })
  for (let i = 0; i < 12; i += 1) session.advance(1 / 60)
  const rest = new Vector3(0, 0, 0.4).applyMatrix4(flSteer.matrixWorld)

  session.setInput({ throttle: 0, steer })
  for (let i = 0; i < 20; i += 1) session.advance(1 / 60)
  const tip = new Vector3(0, 0, 0.4).applyMatrix4(flSteer.matrixWorld).sub(rest)

  const travel = worldForwardFromYaw(session.getVisualHeadingYaw() ?? 0)
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), travel).normalize()
  return tip.dot(right)
}

function assertAD(label: string, session: FreeDriveSession, placement: Object3D) {
  const d = tipAlongTravelRight(session, placement, 1)
  const a = tipAlongTravelRight(session, placement, -1)
  assert.ok(d > 0.05, `${label}: D must yaw tires toward travel-right (got ${d.toFixed(4)})`)
  assert.ok(a < -0.05, `${label}: A must yaw tires toward travel-left (got ${a.toFixed(4)})`)
}

{
  const { placement, actionRoot, model } = build()
  const session = new FreeDriveSession()
  session.setVehicle(placement, rig, actionRoot, model)
  session.setMaxBodyRollDegrees(0)
  session.setEnabled(true)
  session.resetToOrigin()
  assertAD('normal', session, placement)
}

{
  const { placement, actionRoot, model } = build()
  const session = new FreeDriveSession()
  session.setVehicle(placement, rig, actionRoot, model)
  session.setMaxBodyRollDegrees(0)
  session.setEnabled(true)
  session.setHeadingFlip(true)
  session.resetToOrigin()
  assertAD('headingFlip', session, placement)
}

{
  const { placement, actionRoot, model } = build({ reverseLamps: true })
  const session = new FreeDriveSession()
  session.setVehicle(placement, rig, actionRoot, model)
  session.setMaxBodyRollDegrees(0)
  session.setEnabled(true)
  session.resetToOrigin()
  assertAD('reverseLamps', session, placement)
}

console.log('free-drive A/D wheel steer (travel-right) OK')
