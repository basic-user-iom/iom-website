import { Box3, Object3D, Quaternion, Vector3 } from 'three'
import type { VehicleRigManifest, WheelBinding } from '../persistence/schema'
import { findNamedNode, sanitizeRuntimeNodeName } from '../vehicle/qualityVariants'

const AXIS: Record<'x' | 'y' | 'z', Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
}
const UP = new Vector3(0, 1, 0)
const AXIS_IDS = ['x', 'y', 'z'] as const
const CALIBRATION_EPSILON = 0.02

const _q = new Quaternion()
const _probeWorld = new Vector3()
const _probeLocal = new Vector3()
const _moved = new Vector3()
const _desired = new Vector3()
const _box = new Box3()
const _size = new Vector3()
const _centre = new Vector3()

export type WheelRuntimeBinding = {
  id: WheelBinding['id']
  rolling: Object3D | null
  steering: Object3D | null
  radiusMetres: number
  axleAxis: 'x' | 'y' | 'z'
  /** +1 or -1 so positive travel rolls the tire forward. */
  rollSign: number
  /** Local axis of the steering node that maps to world up. */
  steerAxis: 'x' | 'y' | 'z'
  steerSign: number
  calibrated: boolean
  steerCalibrated: boolean
  /** Bind / rest pose captured at resolve — roll and steer are applied additively. */
  rollingRest: Quaternion
  steeringRest: Quaternion
}

/**
 * Resolve manifesto wheel nodes against a live Three.js vehicle root.
 * Axle axis, direction and radius from the manifesto are treated as hints only;
 * `calibrateWheelBindings` measures the real values from the live scene graph.
 */
export function resolveWheelBindings(
  root: Object3D,
  rig: VehicleRigManifest | null,
): WheelRuntimeBinding[] {
  if (!rig) return []
  const seenRolling = new Set<Object3D>()
  const out: WheelRuntimeBinding[] = []

  for (const w of rig.wheels) {
    const rollingName = w.rollingNode?.name
    const steeringName = w.steeringNode?.name
    const rolling = rollingName ? findNamedNode(root, rollingName) : null
    const steering = steeringName ? findNamedNode(root, steeringName) : null
    const shared = Boolean(rolling && seenRolling.has(rolling))
    if (rolling && !shared) seenRolling.add(rolling)

    out.push({
      id: w.id,
      // Rear wheels share one pivot on the common axle line; only drive it once.
      rolling: shared ? null : rolling,
      steering,
      radiusMetres: w.radiusMetres && w.radiusMetres > 0.2 ? w.radiusMetres : 0.36,
      axleAxis: w.axleAxis === 'y' || w.axleAxis === 'z' ? w.axleAxis : 'x',
      rollSign: 1,
      steerAxis: 'y',
      steerSign: 1,
      calibrated: false,
      steerCalibrated: false,
      rollingRest: rolling ? rolling.quaternion.clone() : new Quaternion(),
      steeringRest: steering ? steering.quaternion.clone() : new Quaternion(),
    })
  }
  return out
}

/**
 * Nudge a node about each local axis in both directions and keep whichever moves `probeWorld`
 * furthest along `desired`. Robust to nested rotations, mirrored instances and odd scales,
 * which a quaternion-only derivation gets wrong.
 */
function findBestAxis(
  node: Object3D,
  rest: Quaternion,
  probeWorld: Vector3,
  desired: Vector3,
): { axis: 'x' | 'y' | 'z'; sign: number } {
  _probeLocal.copy(probeWorld)
  node.worldToLocal(_probeLocal)

  let bestScore = -Infinity
  let bestAxis: 'x' | 'y' | 'z' = 'y'
  let bestSign = 1

  for (const axis of AXIS_IDS) {
    for (const sign of [1, -1]) {
      _q.setFromAxisAngle(AXIS[axis], CALIBRATION_EPSILON * sign)
      node.quaternion.copy(rest).multiply(_q)
      node.updateWorldMatrix(false, true)
      _moved.copy(_probeLocal)
      node.localToWorld(_moved)
      const score = _moved.sub(probeWorld).dot(desired)
      if (score > bestScore) {
        bestScore = score
        bestAxis = axis
        bestSign = sign
      }
    }
  }

  node.quaternion.copy(rest)
  node.updateWorldMatrix(false, true)
  return { axis: bestAxis, sign: bestSign }
}

/**
 * Measure each pivot's true axle axis, roll direction and radius, plus the steering axis of
 * the front uprights, by watching where the tire actually moves.
 */
export function calibrateWheelBindings(
  bindings: WheelRuntimeBinding[],
  forwardWorld: Vector3,
): void {
  const forward = forwardWorld.clone().setY(0)
  if (forward.lengthSq() < 1e-8) return
  forward.normalize()

  for (const b of bindings) {
    if (!b.rolling || b.calibrated) continue
    const pivot = b.rolling

    pivot.quaternion.copy(b.rollingRest)
    pivot.updateWorldMatrix(true, true)

    _box.setFromObject(pivot)
    if (!_box.isEmpty()) {
      _box.getSize(_size)
      const radius = _size.y / 2
      if (radius > 0.08 && radius < 1.2) b.radiusMetres = radius
      _box.getCenter(_centre)
    } else {
      pivot.getWorldPosition(_centre)
    }

    // The top of the tire must travel forward when rolling forward.
    _probeWorld.set(_centre.x, _centre.y + b.radiusMetres, _centre.z)
    const roll = findBestAxis(pivot, b.rollingRest, _probeWorld, forward)
    b.axleAxis = roll.axis
    b.rollSign = roll.sign
    b.calibrated = true
  }

  for (const b of bindings) {
    if (b.steerCalibrated || !b.steering) continue
    if (b.id !== 'FL' && b.id !== 'FR') continue
    const steering = b.steering

    steering.quaternion.copy(b.steeringRest)
    steering.updateWorldMatrix(true, true)

    if (b.rolling) b.rolling.getWorldPosition(_centre)
    else steering.getWorldPosition(_centre)

    // Steering must yaw about world up: a point ahead of the hub swings sideways.
    const reach = Math.max(0.15, b.radiusMetres)
    _probeWorld.copy(_centre).addScaledVector(forward, reach)
    _desired.crossVectors(UP, forward).normalize()

    const steer = findBestAxis(steering, b.steeringRest, _probeWorld, _desired)
    b.steerAxis = steer.axis
    b.steerSign = steer.sign
    b.steerCalibrated = true
  }
}

/**
 * Apply distance-linked tire roll. `signedDistanceMetres` is world travel along the route.
 * Rotation is rest ⊗ axis-angle so the bind pose of the pivot's children stays intact.
 */
export function applyWheelRoll(
  bindings: WheelRuntimeBinding[],
  signedDistanceMetres: number,
) {
  for (const b of bindings) {
    if (!b.rolling) continue
    const radius = Math.max(0.05, b.radiusMetres)
    const angle = (b.rollSign * signedDistanceMetres) / radius
    _q.setFromAxisAngle(AXIS[b.axleAxis], angle)
    b.rolling.quaternion.copy(b.rollingRest).multiply(_q)
  }
}

/** Positive `steerRadians` turns the wheels the same way the vehicle's heading is turning. */
export function applyFrontSteer(bindings: WheelRuntimeBinding[], steerRadians: number) {
  for (const b of bindings) {
    if ((b.id !== 'FL' && b.id !== 'FR') || !b.steering) continue
    _q.setFromAxisAngle(AXIS[b.steerAxis], b.steerSign * steerRadians)
    b.steering.quaternion.copy(b.steeringRest).multiply(_q)
  }
}

export function resetWheelPose(bindings: WheelRuntimeBinding[]) {
  for (const b of bindings) {
    if (b.rolling) b.rolling.quaternion.copy(b.rollingRest)
    if (b.steering && (b.id === 'FL' || b.id === 'FR')) {
      b.steering.quaternion.copy(b.steeringRest)
    }
  }
}

/** Debug helper */
export function describeBindings(bindings: WheelRuntimeBinding[]): string {
  return bindings
    .map((b) => {
      const roll = b.rolling?.name ?? '—'
      const axle = b.rollSign < 0 ? `-${b.axleAxis}` : b.axleAxis
      const steer = b.steering
        ? `${b.steerSign < 0 ? '-' : ''}${b.steerAxis}`
        : '—'
      return `${b.id}: roll=${roll} axle=${axle} steer=${steer} r=${b.radiusMetres.toFixed(3)}m`
    })
    .join('; ')
}

export function worldForwardFromYaw(yaw: number, out = new Vector3()): Vector3 {
  return out.set(Math.sin(yaw), 0, Math.cos(yaw))
}

/**
 * Three.js: after `rotation.y = yaw`, local +Z faces (sin yaw, 0, cos yaw).
 * If the vehicle nose is local +X instead (common when forwardAxis was not remapped),
 * use yawOffset = -π/2 so the nose follows the route tangent.
 */
export function headingOffsetForLengthAxis(lengthAlongLocal: 'x' | 'z'): number {
  return lengthAlongLocal === 'x' ? -Math.PI / 2 : 0
}

export { sanitizeRuntimeNodeName }
