import {
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Object3D,
  Vector3,
  type Scene,
} from 'three'
import type { VehicleRoute, VehicleRigManifest } from '../persistence/schema'
import { measureCarBounds } from '../assets/analyzeAsset'
import { createDefaultOvalRoute, speedKmhToMetresPerSecond } from './routeMath'
import { RouteCurve } from './routeCurve'
import {
  applyFrontSteer,
  applyWheelRoll,
  calibrateWheelBindings,
  describeBindings,
  headingOffsetForLengthAxis,
  resolveWheelBindings,
  worldForwardFromYaw,
  type WheelRuntimeBinding,
} from './wheelRoll'

const _forward = new Vector3()
const _delta = new Vector3()
const UP = new Vector3(0, 1, 0)

/** Distance over which steer eases toward its target — frame-rate independent. */
const STEER_SMOOTHING_METRES = 0.6
const DEFAULT_WHEELBASE_METRES = 3.1

type VehicleAlignment = {
  /** Added to route yaw so the vehicle's own forward axis matches the path tangent. */
  yawOffset: number
  /** Point on the vehicle that should ride the path, in placement-local space. */
  anchorLocal: Vector3
  /** Front-to-rear axle distance in world metres, for the steering geometry. */
  wheelbaseMetres: number
  source: 'wheel-rig' | 'bounds'
}

/**
 * Phase 4 MVP: closed demo route, vehicle placement follow, distance-linked tire roll.
 */
export class RouteSession {
  private scene: Scene | null = null
  private placement: Object3D | null = null
  private route: VehicleRoute | null = null
  private curve: RouteCurve | null = null
  private line: Line | null = null
  private bindings: WheelRuntimeBinding[] = []
  private enabled = false
  private wheelRollEnabled = true
  private distanceMetres = 0
  /** Monotonic travel used for tire roll — never wraps, so wheels don't snap each lap. */
  private rollDistanceMetres = 0
  private lastSampledDistance: number | null = null
  private tireRollRate = 1
  private lastSteer = 0
  private maxSteerRadians = (35 * Math.PI) / 180
  private alignment: VehicleAlignment | null = null
  private calibrationNote = ''

  bind(scene: Scene) {
    this.scene = scene
  }

  setVehicle(placement: Object3D | null, rig: VehicleRigManifest | null) {
    this.placement = placement
    this.bindings = placement && rig ? resolveWheelBindings(placement, rig) : []
    this.alignment = null
    this.calibrationNote = ''
  }

  getRoute() {
    return this.route
  }

  isEnabled() {
    return this.enabled
  }

  getLengthMetres() {
    return this.curve?.totalLength ?? 0
  }

  setWheelRollEnabled(on: boolean) {
    this.wheelRollEnabled = on
  }

  setTireRollRate(rate: number) {
    this.tireRollRate = Number.isFinite(rate) && rate > 0 ? rate : 1
  }

  setMaxSteerDegrees(degrees: number) {
    const clamped = Math.min(60, Math.max(0, degrees))
    this.maxSteerRadians = (clamped * Math.PI) / 180
  }

  getMaxSteerDegrees() {
    return (this.maxSteerRadians * 180) / Math.PI
  }

  getTireRollRate() {
    return this.tireRollRate
  }

  ensureDemoRoute(speedKmh = 18): VehicleRoute {
    const route = createDefaultOvalRoute(speedKmh)
    route.tireRollRate = this.tireRollRate
    this.setRoute(route)
    this.enabled = true
    return route
  }

  setRoute(route: VehicleRoute | null) {
    this.route = route
    this.curve = route && route.pointsMetres.length > 1 ? new RouteCurve(route) : null
    this.tireRollRate = route?.tireRollRate ?? this.tireRollRate
    if (route?.maxSteerDeg != null) this.setMaxSteerDegrees(route.maxSteerDeg)
    this.distanceMetres = 0
    this.rollDistanceMetres = 0
    this.lastSampledDistance = null
    this.lastSteer = 0
    this.rebuildLine()
    if (!route) this.enabled = false
  }

  clearRoute() {
    this.setRoute(null)
    this.enabled = false
    this.disposeLine()
  }

  setSpeedKmh(kmh: number) {
    if (!this.route) return
    this.route = { ...this.route, speedKmh: Math.max(1, kmh) }
  }

  /** Advance along route by wall-clock dt; returns sample or null. */
  update(dtSeconds: number) {
    if (!this.enabled || !this.route || !this.placement) return null
    const speed = speedKmhToMetresPerSecond(this.route.speedKmh)
    this.distanceMetres += speed * dtSeconds
    return this.applyAtDistance(this.distanceMetres)
  }

  seekDistance(distanceMetres: number) {
    this.distanceMetres = distanceMetres
    return this.applyAtDistance(distanceMetres)
  }

  private applyAtDistance(distanceMetres: number) {
    if (!this.curve || !this.placement) return null
    const sample = this.curve.sample(distanceMetres)

    const alignment = this.alignment ?? (this.alignment = this.measureAlignment(this.placement))
    const yaw = sample.yaw + alignment.yawOffset
    this.placement.rotation.set(0, yaw, 0)

    // The placement origin is not the vehicle's centre, so putting the origin on the path
    // leaves the body beside it. Offset by the rotated anchor instead.
    _delta.copy(alignment.anchorLocal).applyAxisAngle(UP, yaw)
    this.placement.position.set(
      sample.position[0] - _delta.x,
      sample.position[1],
      sample.position[2] - _delta.z,
    )
    this.placement.updateWorldMatrix(false, true)

    const travelled = this.accumulateRollDistance(sample.distanceAlong, sample.totalLength)
    this.updateSteer(distanceMetres, alignment.wheelbaseMetres, travelled)

    if (this.bindings.some((b) => b.rolling && !b.calibrated)) {
      calibrateWheelBindings(this.bindings, worldForwardFromYaw(sample.yaw, _forward))
      this.calibrationNote = describeBindings(this.bindings)
    }
    if (this.wheelRollEnabled) {
      applyWheelRoll(this.bindings, this.rollDistanceMetres * this.tireRollRate)
    }
    applyFrontSteer(this.bindings, this.lastSteer)

    return sample
  }

  /**
   * Ackermann-style steer straight off the geometry: tan(δ) = wheelbase × curvature.
   * Eased over distance rather than frames so it behaves the same at any frame rate.
   */
  private updateSteer(distanceMetres: number, wheelbaseMetres: number, travelledMetres: number) {
    if (!this.curve) return
    const curvature = this.curve.curvatureAt(distanceMetres)
    const target = Math.max(
      -this.maxSteerRadians,
      Math.min(this.maxSteerRadians, Math.atan(wheelbaseMetres * curvature)),
    )
    const step = Math.abs(travelledMetres)
    const alpha = step > 0 ? 1 - Math.exp(-step / STEER_SMOOTHING_METRES) : 1
    this.lastSteer += (target - this.lastSteer) * alpha
  }

  /**
   * The sampled distance wraps to 0 each lap; rolling on it would snap the tires once per
   * lap. Accumulate the shortest signed delta instead so roll stays continuous.
   */
  private accumulateRollDistance(wrapped: number, total: number): number {
    let delta = 0
    if (this.lastSampledDistance != null && total > 1e-6) {
      delta = wrapped - this.lastSampledDistance
      if (delta < -total / 2) delta += total
      else if (delta > total / 2) delta -= total
      this.rollDistanceMetres += delta
    }
    this.lastSampledDistance = wrapped
    return delta
  }

  getCalibrationNote() {
    return this.calibrationNote
  }

  /**
   * Work out which way the vehicle actually faces and which point should ride the path.
   *
   * The wheel rig is authoritative: forward is front-axle-midpoint minus rear-axle-centre,
   * and the wheelbase centre is the natural point to keep on the path. This asset sits ~27°
   * off +Z in its own scene, which a bounding-box guess cannot detect (a diagonal car just
   * produces a wider box). Falls back to box proportions when no rig is bound.
   */
  private measureAlignment(placement: Object3D): VehicleAlignment {
    const prev = placement.rotation.clone()
    placement.rotation.set(0, 0, 0)
    placement.updateWorldMatrix(true, true)

    const hub = (id: WheelRuntimeBinding['id']) => {
      const node = this.bindings.find((b) => b.id === id && b.rolling)?.rolling
      return node ? node.getWorldPosition(new Vector3()) : null
    }
    const fl = hub('FL')
    const fr = hub('FR')
    const rear = hub('RL') ?? hub('RR')

    let result: VehicleAlignment
    if (fl && fr && rear) {
      const frontMid = fl.clone().add(fr).multiplyScalar(0.5)
      const forward = frontMid.clone().sub(rear).setY(0)
      const wheelbase = forward.length()
      const yawOffset = forward.lengthSq() > 1e-8 ? -Math.atan2(forward.x, forward.z) : 0
      const anchor = frontMid.clone().add(rear).multiplyScalar(0.5)
      const anchorLocal = placement.worldToLocal(anchor)
      anchorLocal.y = 0
      result = {
        yawOffset,
        anchorLocal,
        wheelbaseMetres: wheelbase > 0.5 ? wheelbase : DEFAULT_WHEELBASE_METRES,
        source: 'wheel-rig',
      }
    } else {
      const box = measureCarBounds(placement)
      const anchorLocal = placement.worldToLocal(box.getCenter(new Vector3()))
      anchorLocal.y = 0
      const size = box.getSize(new Vector3())
      result = {
        yawOffset: headingOffsetForLengthAxis(size.x >= size.z ? 'x' : 'z'),
        anchorLocal,
        // Rough proxy: wheelbase is ~60% of overall length on most passenger cars.
        wheelbaseMetres: Math.max(size.x, size.z) * 0.6 || DEFAULT_WHEELBASE_METRES,
        source: 'bounds',
      }
    }

    placement.rotation.copy(prev)
    placement.updateWorldMatrix(true, true)
    return result
  }

  private rebuildLine() {
    this.disposeLine()
    if (!this.scene || !this.curve) return
    const pts = this.curve.guidePoints().map((p) => new Vector3(p.x, 0.02, p.z))
    if (pts.length < 2) return
    const geo = new BufferGeometry().setFromPoints(pts)
    const mat = new LineBasicMaterial({ color: 0xd2b48c })
    this.line = new Line(geo, mat)
    this.line.name = 'VehicleRouteGuide'
    this.scene.add(this.line)
  }

  private disposeLine() {
    if (!this.line) return
    this.line.parent?.remove(this.line)
    this.line.geometry.dispose()
    ;(this.line.material as LineBasicMaterial).dispose()
    this.line = null
  }

  getStatus() {
    const rolling = this.bindings.filter((b) => b.rolling)
    return {
      enabled: this.enabled,
      lengthMetres: this.getLengthMetres(),
      distanceMetres: this.distanceMetres,
      speedKmh: this.route?.speedKmh ?? 0,
      bindingCount: rolling.length,
      yawOffsetDeg: ((this.alignment?.yawOffset ?? 0) * 180) / Math.PI,
      alignmentSource: this.alignment?.source ?? 'pending',
      wheelbaseMetres: this.alignment?.wheelbaseMetres ?? 0,
      steerDeg: (this.lastSteer * 180) / Math.PI,
      maxSteerDeg: this.getMaxSteerDegrees(),
      tireRollRate: this.tireRollRate,
      effectiveRadiusMetres: rolling.length ? rolling[0].radiusMetres / this.tireRollRate : 0,
      calibration: this.calibrationNote,
    }
  }

  dispose() {
    this.clearRoute()
    this.placement = null
    this.bindings = []
    this.scene = null
  }
}
