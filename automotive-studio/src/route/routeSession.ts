import {
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
  type Scene,
} from 'three'
import type { VehicleRoute, VehicleRigManifest } from '../persistence/schema'
import { measureCarBounds } from '../assets/analyzeAsset'
import {
  clampOvalScale,
  createDefaultOvalRoute,
  createDefaultOpenRoute,
  routeExtentMetres,
  speedKmhToMetresPerSecond,
} from './routeMath'
import { RouteCurve } from './routeCurve'
import {
  applyFrontSteer,
  applyWheelRoll,
  calibrateWheelBindings,
  describeBindings,
  headingOffsetForLengthAxis,
  measureAxleGeometry,
  resolveWheelBindings,
  worldForwardFromYaw,
  type WheelRuntimeBinding,
} from './wheelRoll'

const _forward = new Vector3()
const _delta = new Vector3()
const UP = new Vector3(0, 1, 0)

/** Distance over which steer eases toward its target — frame-rate independent. */
const STEER_SMOOTHING_METRES = 0.6
const BODY_ROLL_SMOOTHING_METRES = 0.9
const DEFAULT_WHEELBASE_METRES = 3.1
const DEFAULT_BODY_ROLL_DEG = 3.5
const DEFAULT_ACCEL_MPS2 = 2.2
const DEFAULT_BRAKE_MPS2 = 4.0
const DEFAULT_START_ACCEL_MPS2 = 2.2
const DEFAULT_END_STOP_MPS2 = 4.5
const MARKER_Y = 0.12
const BASE_FLOOR_METRES = 24
const MIN_OPEN_POINTS = 2
const MIN_CLOSED_POINTS = 3

export type RouteStressReport = {
  laps: number
  ok: boolean
  maxPositionErrorMetres: number
  maxYawErrorDeg: number
  rollErrorPct: number
  note: string
}

type VehicleAlignment = {
  /** Added to route yaw so the vehicle's own forward axis matches the path tangent. */
  yawOffset: number
  /** Point on the vehicle that should ride the path, in placement-local space. */
  anchorLocal: Vector3
  /** Front-to-rear axle distance in world metres, for the steering geometry. */
  wheelbaseMetres: number
  /** Half the front track — used to lift the body so rolled tires stay on the floor. */
  halfTrackMetres: number
  source: 'wheel-rig' | 'bounds'
}

/**
 * Phase 4: closed route, vehicle placement follow, distance-linked tire roll,
 * oval scale, and editable waypoints.
 */
export class RouteSession {
  private scene: Scene | null = null
  private placement: Object3D | null = null
  private actionRoot: Object3D | null = null
  private route: VehicleRoute | null = null
  private curve: RouteCurve | null = null
  private line: Line | null = null
  private markers = new Group()
  private markerMeshes: Mesh[] = []
  private markerGeo = new SphereGeometry(0.28, 16, 12)
  private markerMat = new MeshStandardMaterial({
    color: 0xc4a574,
    emissive: 0x3a2e1c,
    metalness: 0.2,
    roughness: 0.45,
  })
  private markerActiveMat = new MeshStandardMaterial({
    color: 0xe8c99a,
    emissive: 0x6a4e28,
    metalness: 0.25,
    roughness: 0.4,
  })
  private bindings: WheelRuntimeBinding[] = []
  private enabled = false
  private wheelRollEnabled = true
  private editing = false
  private distanceMetres = 0
  /** Monotonic travel used for tire roll — never wraps, so wheels don't snap each lap. */
  private rollDistanceMetres = 0
  private lastSampledDistance: number | null = null
  private tireRollRate = 1
  private lastSteer = 0
  private lastBodyRoll = 0
  private maxSteerRadians = (35 * Math.PI) / 180
  private maxBodyRollRadians = (DEFAULT_BODY_ROLL_DEG * Math.PI) / 180
  /** Signed speed along the path (m/s). Negative = reverse. */
  private velocityMps = 0
  private direction: 1 | -1 = 1
  private accelMps2 = DEFAULT_ACCEL_MPS2
  private brakeMps2 = DEFAULT_BRAKE_MPS2
  private startAccelMps2 = DEFAULT_START_ACCEL_MPS2
  private endStopMps2 = DEFAULT_END_STOP_MPS2
  private alignment: VehicleAlignment | null = null
  private calibrationNote = ''
  private activeMarkerIndex = -1
  private onFloorSize: ((metres: number) => void) | null = null
  private lastStress: RouteStressReport | null = null

  constructor() {
    this.markers.name = 'VehicleRouteWaypoints'
    this.markers.visible = false
  }

  bind(scene: Scene, onFloorSize?: (metres: number) => void) {
    this.scene = scene
    this.onFloorSize = onFloorSize ?? null
    if (!this.markers.parent) scene.add(this.markers)
  }

  setVehicle(placement: Object3D | null, rig: VehicleRigManifest | null, actionRoot?: Object3D | null, modelRoot?: Object3D | null) {
    this.resetBodyRoll()
    this.placement = placement
    this.actionRoot =
      actionRoot ??
      (placement?.getObjectByName('VehicleActionRoot') as Object3D | null) ??
      null
    const bindRoot =
      modelRoot ??
      (this.actionRoot?.children[0] as Object3D | undefined) ??
      placement
    this.bindings = bindRoot ? resolveWheelBindings(bindRoot, rig) : []
    this.alignment = null
    this.calibrationNote = this.bindings.some((b) => b.rolling || b.steering)
      ? describeBindings(this.bindings)
      : ''
  }

  getRoute() {
    return this.route
  }

  isEnabled() {
    return this.enabled
  }

  isEditing() {
    return this.editing
  }

  getLengthMetres() {
    return this.curve?.totalLength ?? 0
  }

  /**
   * World yaw of the vehicle nose (radians), not placement.local +Z.
   * Placement.rotation.y includes alignment.yawOffset; chase/orbit must use the nose.
   */
  getVisualHeadingYaw(): number | null {
    if (!this.placement) return null
    const yawOffset = this.alignment?.yawOffset ?? 0
    return this.placement.rotation.y - yawOffset
  }

  getExtentMetres() {
    return this.route ? routeExtentMetres(this.route) : 0
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

  setMaxBodyRollDegrees(degrees: number) {
    const clamped = Math.min(12, Math.max(0, degrees))
    this.maxBodyRollRadians = (clamped * Math.PI) / 180
    if (clamped <= 0) this.resetBodyRoll()
  }

  getMaxBodyRollDegrees() {
    return (this.maxBodyRollRadians * 180) / Math.PI
  }

  setAccelMps2(value: number) {
    this.accelMps2 = Math.min(12, Math.max(0.2, value))
    if (this.route) this.route.accelMps2 = this.accelMps2
  }

  setBrakeMps2(value: number) {
    this.brakeMps2 = Math.min(16, Math.max(0.4, value))
    if (this.route) this.route.brakeMps2 = this.brakeMps2
  }

  setStartAccelMps2(value: number) {
    this.startAccelMps2 = Math.min(12, Math.max(0.2, value))
    if (this.route) this.route.startAccelMps2 = this.startAccelMps2
  }

  setEndStopMps2(value: number) {
    this.endStopMps2 = Math.min(16, Math.max(0.4, value))
    if (this.route) this.route.endStopMps2 = this.endStopMps2
  }

  getStartAccelMps2() {
    return this.startAccelMps2
  }

  getEndStopMps2() {
    return this.endStopMps2
  }

  getAccelMps2() {
    return this.accelMps2
  }

  getBrakeMps2() {
    return this.brakeMps2
  }

  setDirection(dir: 1 | -1) {
    this.direction = dir < 0 ? -1 : 1
    if (this.route) this.route.direction = this.direction
  }

  getDirection() {
    return this.direction
  }

  toggleReverse() {
    this.setDirection(this.direction < 0 ? 1 : -1)
    return this.direction
  }

  getVelocityMps() {
    return this.velocityMps
  }

  getLastStressReport() {
    return this.lastStress
  }

  getTireRollRate() {
    return this.tireRollRate
  }

  getOvalScale() {
    return this.route?.ovalScale ?? 1
  }

  setEditing(on: boolean) {
    this.editing = on
    this.markers.visible = on && this.enabled
    if (!on) this.setActiveMarker(-1)
  }

  /** Hide/show the path guide line (waypoints stay gated by edit mode). */
  setGuideVisible(visible: boolean) {
    if (this.line) this.line.visible = visible
  }

  setActiveMarker(index: number) {
    this.activeMarkerIndex = index
    for (let i = 0; i < this.markerMeshes.length; i++) {
      this.markerMeshes[i].material = i === index ? this.markerActiveMat : this.markerMat
    }
  }

  /** World-space positions of control points (y ignored for picking). */
  getWaypointPositions(): Vector3[] {
    if (!this.route) return []
    return this.route.pointsMetres.map((p) => new Vector3(p[0], MARKER_Y, p[2]))
  }

  ensureDemoRoute(speedKmh = 18, scale = 1): VehicleRoute {
    const route = createDefaultOvalRoute(speedKmh, scale)
    route.tireRollRate = this.tireRollRate
    route.bodyRollDeg = this.getMaxBodyRollDegrees()
    route.accelMps2 = this.accelMps2
    route.brakeMps2 = this.brakeMps2
    route.startAccelMps2 = this.startAccelMps2
    route.endStopMps2 = this.endStopMps2
    route.direction = this.direction
    this.setRoute(route, { resetProgress: true })
    this.enabled = true
    return route
  }

  ensureOpenRoute(speedKmh = 18, scale = 1): VehicleRoute {
    const route = createDefaultOpenRoute(speedKmh, scale)
    route.tireRollRate = this.tireRollRate
    route.bodyRollDeg = this.getMaxBodyRollDegrees()
    route.accelMps2 = this.accelMps2
    route.brakeMps2 = this.brakeMps2
    route.startAccelMps2 = this.startAccelMps2
    route.endStopMps2 = this.endStopMps2
    route.direction = this.direction
    this.setRoute(route, { resetProgress: true })
    this.enabled = true
    return route
  }

  setClosed(closed: boolean): VehicleRoute | null {
    if (!this.route) return null
    const minPts = closed ? MIN_CLOSED_POINTS : MIN_OPEN_POINTS
    if (this.route.pointsMetres.length < minPts) return null
    const next: VehicleRoute = {
      ...this.route,
      closed,
      ovalScale: closed ? this.route.ovalScale : undefined,
      openScale: closed ? undefined : this.route.openScale,
    }
    this.setRoute(next, { resetProgress: false })
    this.enabled = true
    return next
  }

  isClosed() {
    return Boolean(this.route?.closed)
  }

  /**
   * Rebuild the demo oval at a new size, keeping lap progress so the car does not teleport.
   * Clears any hand-edited shape — this is intentionally a fresh oval.
   */
  setOvalScale(scale: number) {
    if (!this.route) return null
    this.pathScaleBaseline = null
    const s = clampOvalScale(scale)
    const next = createDefaultOvalRoute(this.route.speedKmh, s)
    next.id = this.route.id
    next.tireRollRate = this.route.tireRollRate ?? this.tireRollRate
    next.maxSteerDeg = this.route.maxSteerDeg
    next.chaseCamera = this.route.chaseCamera
    next.chaseOrbitYawDeg = this.route.chaseOrbitYawDeg
    next.chaseOrbitPitchDeg = this.route.chaseOrbitPitchDeg
    next.chaseDistance = this.route.chaseDistance
    next.chaseLookAhead = this.route.chaseLookAhead
    next.chaseLookSide = this.route.chaseLookSide
    next.startAccelMps2 = this.route.startAccelMps2 ?? this.startAccelMps2
    next.endStopMps2 = this.route.endStopMps2 ?? this.endStopMps2
    next.bodyRollDeg = this.getMaxBodyRollDegrees()
    this.setRoute(next, { resetProgress: false })
    this.enabled = true
    return next
  }

  /**
   * Rebuild the demo open path at a new size (keeps progress fraction).
   * Replaces any hand-edited open shape with a fresh open template.
   */
  setOpenScale(scale: number) {
    if (!this.route) return null
    this.pathScaleBaseline = null
    const s = clampOvalScale(scale)
    const next = createDefaultOpenRoute(this.route.speedKmh, s)
    next.id = this.route.id
    next.tireRollRate = this.route.tireRollRate ?? this.tireRollRate
    next.maxSteerDeg = this.route.maxSteerDeg
    next.chaseCamera = this.route.chaseCamera
    next.chaseOrbitYawDeg = this.route.chaseOrbitYawDeg
    next.chaseOrbitPitchDeg = this.route.chaseOrbitPitchDeg
    next.chaseDistance = this.route.chaseDistance
    next.chaseLookAhead = this.route.chaseLookAhead
    next.chaseLookSide = this.route.chaseLookSide
    next.startAccelMps2 = this.route.startAccelMps2 ?? this.startAccelMps2
    next.endStopMps2 = this.route.endStopMps2 ?? this.endStopMps2
    next.bodyRollDeg = this.getMaxBodyRollDegrees()
    next.accelMps2 = this.route.accelMps2 ?? this.accelMps2
    next.brakeMps2 = this.route.brakeMps2 ?? this.brakeMps2
    next.direction = this.route.direction ?? this.direction
    this.setRoute(next, { resetProgress: false })
    this.enabled = true
    return next
  }

  private pathScaleBaseline: {
    points: [number, number, number][]
    ovalScale?: number
  } | null = null

  /** Snapshot current points so a Scale-path drag can resize the whole shape live. */
  beginPathScale() {
    if (!this.route || this.route.pointsMetres.length < 2) return false
    this.pathScaleBaseline = {
      points: this.route.pointsMetres.map((p) => [p[0], p[1], p[2]] as [number, number, number]),
      ovalScale: this.route.ovalScale,
    }
    return true
  }

  /**
   * Uniformly scale the whole path about its centroid (XZ).
   * `factor` is relative to the snapshot from `beginPathScale` (1 = unchanged).
   */
  applyPathScale(factor: number) {
    if (!this.route) return null
    if (!this.pathScaleBaseline) this.beginPathScale()
    const base = this.pathScaleBaseline
    if (!base || base.points.length < 2) return null

    const f = Math.min(10, Math.max(0.35, factor))
    let cx = 0
    let cz = 0
    for (const p of base.points) {
      cx += p[0]
      cz += p[2]
    }
    cx /= base.points.length
    cz /= base.points.length

    const pointsMetres = base.points.map(
      (p) => [cx + (p[0] - cx) * f, p[1], cz + (p[2] - cz) * f] as [number, number, number],
    )

    const next: VehicleRoute = {
      ...this.route,
      pointsMetres,
      ovalScale:
        base.ovalScale != null ? clampOvalScale(base.ovalScale * f) : undefined,
    }
    this.setRoute(next, { resetProgress: false })
    this.enabled = true
    return next
  }

  endPathScale() {
    this.pathScaleBaseline = null
  }

  /** Move one control point; spline, guide, steer and roll all update from the new curve. */
  setWaypoint(index: number, x: number, z: number) {
    if (!this.route || index < 0 || index >= this.route.pointsMetres.length) return null
    this.pathScaleBaseline = null
    const points = this.route.pointsMetres.map((p) => [...p] as [number, number, number])
    points[index] = [x, 0, z]
    const next: VehicleRoute = {
      ...this.route,
      pointsMetres: points,
      // Hand edit — oval scale slider no longer describes the shape.
      ovalScale: undefined,
      openScale: undefined,
    }
    this.setRoute(next, { resetProgress: false })
    this.enabled = true
    this.setActiveMarker(index)
    return next
  }

  /**
   * Insert a waypoint after `afterIndex` (−1 = before first).
   * Midpoint of the following segment, or extension past the end for open paths.
   */
  addWaypoint(afterIndex = -1): VehicleRoute | null {
    if (!this.route) return null
    const pts = this.route.pointsMetres.map((p) => [...p] as [number, number, number])
    const n = pts.length
    let insertAt = afterIndex < 0 ? n : Math.min(n, afterIndex + 1)
    if (this.activeMarkerIndex >= 0 && afterIndex < 0) {
      insertAt = this.activeMarkerIndex + 1
    }
    const i0 = Math.max(0, insertAt - 1)
    const i1 = insertAt < n ? insertAt : this.route.closed ? 0 : n - 1
    let x: number
    let z: number
    if (insertAt < n || this.route.closed) {
      x = (pts[i0][0] + pts[i1][0]) * 0.5
      z = (pts[i0][2] + pts[i1][2]) * 0.5
    } else {
      // Extend past last point along the last segment.
      const prev = Math.max(0, n - 2)
      x = pts[n - 1][0] + (pts[n - 1][0] - pts[prev][0])
      z = pts[n - 1][2] + (pts[n - 1][2] - pts[prev][2])
    }
    pts.splice(insertAt, 0, [x, 0, z])
    const next: VehicleRoute = {
      ...this.route,
      pointsMetres: pts,
      ovalScale: undefined,
      openScale: undefined,
    }
    this.setRoute(next, { resetProgress: false })
    this.enabled = true
    this.setActiveMarker(insertAt)
    return next
  }

  /** Remove waypoint at index (or active marker). Keeps at least 2 open / 3 closed points. */
  removeWaypoint(index?: number): VehicleRoute | null {
    if (!this.route) return null
    const i = index ?? this.activeMarkerIndex
    if (i < 0 || i >= this.route.pointsMetres.length) return null
    const minPts = this.route.closed ? MIN_CLOSED_POINTS : MIN_OPEN_POINTS
    if (this.route.pointsMetres.length <= minPts) return null
    const pts = this.route.pointsMetres
      .map((p) => [...p] as [number, number, number])
      .filter((_, idx) => idx !== i)
    const next: VehicleRoute = {
      ...this.route,
      pointsMetres: pts,
      ovalScale: undefined,
      openScale: undefined,
    }
    this.setRoute(next, { resetProgress: false })
    this.enabled = true
    this.setActiveMarker(Math.min(i, pts.length - 1))
    return next
  }

  /** Add a point at a world XZ (used by Alt-click on empty ground). */
  addWaypointAt(x: number, z: number, afterIndex?: number): VehicleRoute | null {
    if (!this.route) return null
    const pts = this.route.pointsMetres.map((p) => [...p] as [number, number, number])
    let insertAt =
      afterIndex != null
        ? Math.min(pts.length, Math.max(0, afterIndex + 1))
        : this.activeMarkerIndex >= 0
          ? this.activeMarkerIndex + 1
          : pts.length
    // Snap insert to nearest segment if afterIndex omitted and click is near a span.
    if (afterIndex == null && this.activeMarkerIndex < 0) {
      insertAt = this.nearestInsertIndex(x, z)
    }
    pts.splice(insertAt, 0, [x, 0, z])
    const next: VehicleRoute = {
      ...this.route,
      pointsMetres: pts,
      ovalScale: undefined,
      openScale: undefined,
    }
    this.setRoute(next, { resetProgress: false })
    this.enabled = true
    this.setActiveMarker(insertAt)
    return next
  }

  private nearestInsertIndex(x: number, z: number): number {
    if (!this.route) return 0
    const pts = this.route.pointsMetres
    const n = pts.length
    let best = n
    let bestDist = Infinity
    const segs = this.route.closed ? n : n - 1
    for (let i = 0; i < segs; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % n]
      const dx = b[0] - a[0]
      const dz = b[2] - a[2]
      const lenSq = dx * dx + dz * dz || 1
      let t = ((x - a[0]) * dx + (z - a[2]) * dz) / lenSq
      t = Math.max(0, Math.min(1, t))
      const px = a[0] + dx * t
      const pz = a[2] + dz * t
      const d = Math.hypot(x - px, z - pz)
      if (d < bestDist) {
        bestDist = d
        best = i + 1
      }
    }
    return best
  }

  setRoute(route: VehicleRoute | null, opts: { resetProgress?: boolean } = {}) {
    const resetProgress = opts.resetProgress !== false
    const prevLen = this.curve?.totalLength ?? 0
    const prevDist = this.distanceMetres
    const frac =
      !resetProgress && prevLen > 1e-6
        ? (((prevDist % prevLen) + prevLen) % prevLen) / prevLen
        : 0

    this.route = route
    this.curve = route && route.pointsMetres.length > 1 ? new RouteCurve(route) : null
    this.tireRollRate = route?.tireRollRate ?? this.tireRollRate
    if (route?.maxSteerDeg != null) this.setMaxSteerDegrees(route.maxSteerDeg)
    if (route?.bodyRollDeg != null) this.setMaxBodyRollDegrees(route.bodyRollDeg)
    if (route?.accelMps2 != null) this.accelMps2 = route.accelMps2
    if (route?.brakeMps2 != null) this.brakeMps2 = route.brakeMps2
    if (route?.startAccelMps2 != null) this.startAccelMps2 = route.startAccelMps2
    if (route?.endStopMps2 != null) this.endStopMps2 = route.endStopMps2
    if (route?.direction === 1 || route?.direction === -1) this.direction = route.direction

    if (resetProgress || !route) {
      this.distanceMetres = 0
      this.rollDistanceMetres = 0
      this.lastSampledDistance = null
      this.lastSteer = 0
      this.velocityMps = 0
      this.resetBodyRoll()
    } else {
      const len = this.curve?.totalLength ?? 0
      this.distanceMetres = frac * len
      this.lastSampledDistance = len > 0 ? this.distanceMetres % len : null
    }

    this.rebuildLine()
    this.rebuildMarkers()
    this.syncFloorSize()
    if (!route) {
      this.enabled = false
      this.markers.visible = false
    } else {
      this.enabled = true
      this.markers.visible = this.editing
    }
  }

  clearRoute() {
    this.setRoute(null, { resetProgress: true })
    this.enabled = false
    this.editing = false
    this.resetBodyRoll()
    this.disposeLine()
    this.disposeMarkers(false)
    this.syncFloorSize()
  }

  setSpeedKmh(kmh: number) {
    if (!this.route) return
    this.route = { ...this.route, speedKmh: Math.max(1, kmh) }
  }

  /**
   * Integrate accel/brake toward cruise (signed by direction) and place the vehicle.
   * Open paths ease in from the start and brake to a stop at the end.
   */
  advance(dtSeconds: number) {
    if (!this.enabled || !this.route || !this.placement) return null
    const dt = Math.max(0, Math.min(0.05, dtSeconds))
    const len = this.getLengthMetres()
    const cruise = speedKmhToMetresPerSecond(this.route.speedKmh)
    const closed = Boolean(this.route.closed)

    let target = this.direction * cruise
    let rate = this.accelMps2

    if (!closed && len > 1e-3) {
      const v = this.velocityMps
      const goingForward = this.direction > 0
      const remaining = goingForward ? len - this.distanceMetres : this.distanceMetres
      const fromStart = goingForward ? this.distanceMetres : len - this.distanceMetres
      const endStop = this.endStopMps2
      const startAccel = this.startAccelMps2
      // Distance needed to stop from |v| at endStop rate.
      const stopDist = (v * v) / (2 * Math.max(0.4, endStop)) + 0.05
      if (remaining <= stopDist || remaining < 0.08) {
        target = 0
        rate = endStop
      } else if (Math.abs(v) < cruise * 0.98 && fromStart < cruise) {
        // Leaving the start — use dedicated start accel.
        rate = startAccel
      } else {
        const sameSign = v === 0 || Math.sign(v) === Math.sign(target)
        const speedingUp = sameSign && Math.abs(v) < Math.abs(target) - 1e-4
        rate = speedingUp ? this.accelMps2 : this.brakeMps2
      }
    } else {
      const sameSign =
        this.velocityMps === 0 || Math.sign(this.velocityMps) === Math.sign(target)
      const speedingUp = sameSign && Math.abs(this.velocityMps) < Math.abs(target) - 1e-4
      rate = speedingUp ? this.accelMps2 : this.brakeMps2
    }

    const step = rate * dt
    if (Math.abs(target - this.velocityMps) <= step) this.velocityMps = target
    else this.velocityMps += Math.sign(target - this.velocityMps) * step

    this.distanceMetres += this.velocityMps * dt

    if (!closed && len > 0) {
      if (this.distanceMetres >= len) {
        this.distanceMetres = len
        this.velocityMps = 0
      } else if (this.distanceMetres <= 0) {
        this.distanceMetres = 0
        this.velocityMps = 0
      }
    }

    return this.applyAtDistance(this.distanceMetres)
  }

  /** Advance along route by wall-clock dt; returns sample or null. @deprecated prefer advance */
  update(dtSeconds: number) {
    return this.advance(dtSeconds)
  }

  seekDistance(distanceMetres: number) {
    this.distanceMetres = distanceMetres
    // Scrubbing: kill residual speed so Play doesn't slingshot.
    this.velocityMps = 0
    return this.applyAtDistance(distanceMetres)
  }

  /**
   * Fast-forward several closed laps and measure seam drift vs the spline sample.
   * Restores pose afterward. Phase 4 exit: no progressive position/yaw/roll seam error.
   */
  runStressTest(laps = 5): RouteStressReport {
    const len = this.getLengthMetres()
    if (!this.curve || !this.placement || !this.route || len < 1) {
      const report: RouteStressReport = {
        laps,
        ok: false,
        maxPositionErrorMetres: 0,
        maxYawErrorDeg: 0,
        rollErrorPct: 0,
        note: 'No route to test',
      }
      this.lastStress = report
      return report
    }

    const saved = {
      distance: this.distanceMetres,
      roll: this.rollDistanceMetres,
      lastSampled: this.lastSampledDistance,
      velocity: this.velocityMps,
      steer: this.lastSteer,
      body: this.lastBodyRoll,
      direction: this.direction,
    }

    this.distanceMetres = 0
    this.rollDistanceMetres = 0
    this.lastSampledDistance = null
    this.velocityMps = 0
    this.lastSteer = 0
    this.resetBodyRoll()
    this.direction = 1

    const cruise = speedKmhToMetresPerSecond(this.route.speedKmh)
    // Instant cruise for a clean geometric check (accel would only delay reaching speed).
    this.velocityMps = cruise
    const dt = 1 / 60
    const targetTravel = laps * len
    let guard = 0
    const maxSteps = Math.ceil((targetTravel / Math.max(0.5, cruise)) / dt) + 120

    let maxPosErr = 0
    let maxYawErr = 0
    while (this.rollDistanceMetres < targetTravel && guard++ < maxSteps) {
      this.distanceMetres += this.velocityMps * dt
      this.applyAtDistance(this.distanceMetres)

      const sample = this.curve.sample(this.distanceMetres)
      const dx = this.placement.position.x - sample.position[0]
      const dz = this.placement.position.z - sample.position[2]
      // Anchor offset is intentional — compare yaw to path and lateral error of anchor via
      // re-deriving expected placement is heavy; check placement stays finite and yaw tracks.
      const expectedYaw = sample.yaw + (this.alignment?.yawOffset ?? 0)
      let dyaw = this.placement.rotation.y - expectedYaw
      while (dyaw > Math.PI) dyaw -= Math.PI * 2
      while (dyaw < -Math.PI) dyaw += Math.PI * 2
      maxYawErr = Math.max(maxYawErr, Math.abs(dyaw))
      // Lateral drift of the path-riding point: distance from sample to placement+anchor.
      if (this.alignment) {
        _delta.copy(this.alignment.anchorLocal).applyAxisAngle(UP, this.placement.rotation.y)
        const ax = this.placement.position.x + _delta.x
        const az = this.placement.position.z + _delta.z
        maxPosErr = Math.max(
          maxPosErr,
          Math.hypot(ax - sample.position[0], az - sample.position[2]),
        )
      } else {
        maxPosErr = Math.max(maxPosErr, Math.hypot(dx, dz))
      }

      if (
        !Number.isFinite(this.placement.position.x) ||
        !Number.isFinite(this.placement.rotation.y)
      ) {
        break
      }
    }

    const radius = this.bindings.find((b) => b.rolling)?.radiusMetres ?? 0.36
    const seam = Math.abs(Math.abs(this.rollDistanceMetres) - targetTravel)
    const rollErrorPct = targetTravel > 1e-3 ? (seam / targetTravel) * 100 : 0
    void radius

    const ok =
      maxPosErr < 0.05 &&
      (maxYawErr * 180) / Math.PI < 1 &&
      rollErrorPct < 1 &&
      Number.isFinite(maxPosErr) &&
      guard < maxSteps

    const report: RouteStressReport = {
      laps,
      ok,
      maxPositionErrorMetres: maxPosErr,
      maxYawErrorDeg: (maxYawErr * 180) / Math.PI,
      rollErrorPct,
      note: ok
        ? `Pass — ${laps} laps, pos≤${maxPosErr.toFixed(3)} m, yaw≤${((maxYawErr * 180) / Math.PI).toFixed(2)}°, roll seam ${rollErrorPct.toFixed(2)}%`
        : `Fail — pos ${maxPosErr.toFixed(3)} m, yaw ${((maxYawErr * 180) / Math.PI).toFixed(2)}°, roll seam ${rollErrorPct.toFixed(2)}%`,
    }
    this.lastStress = report

    this.distanceMetres = saved.distance
    this.rollDistanceMetres = saved.roll
    this.lastSampledDistance = saved.lastSampled
    this.velocityMps = saved.velocity
    this.lastSteer = saved.steer
    this.lastBodyRoll = saved.body
    this.direction = saved.direction
    if (this.actionRoot) this.actionRoot.rotation.z = this.lastBodyRoll
    this.applyAtDistance(this.distanceMetres)
    return report
  }

  private applyAtDistance(distanceMetres: number) {
    if (!this.curve || !this.placement) return null
    const sample = this.curve.sample(distanceMetres)

    const alignment = this.alignment ?? (this.alignment = this.measureAlignment(this.placement))
    const travelSign =
      Math.abs(this.velocityMps) > 0.05
        ? (Math.sign(this.velocityMps) as 1 | -1)
        : this.direction
    const yaw =
      sample.yaw + alignment.yawOffset + (travelSign < 0 ? Math.PI : 0)
    this.placement.rotation.set(0, yaw, 0)

    const travelled = this.accumulateRollDistance(sample.distanceAlong, sample.totalLength)
    this.updateSteer(distanceMetres, alignment.wheelbaseMetres, travelled, travelSign)
    this.updateBodyRoll(travelled)

    const lift =
      Math.abs(this.lastBodyRoll) > 1e-5
        ? Math.abs(Math.sin(this.lastBodyRoll)) * Math.max(0.55, alignment.halfTrackMetres)
        : 0

    _delta.copy(alignment.anchorLocal).applyAxisAngle(UP, yaw)
    this.placement.position.set(
      sample.position[0] - _delta.x,
      sample.position[1] + lift,
      sample.position[2] - _delta.z,
    )
    this.placement.updateWorldMatrix(false, true)

    if (this.bindings.some((b) => b.rolling && !b.calibrated)) {
      calibrateWheelBindings(this.bindings, worldForwardFromYaw(sample.yaw + (travelSign < 0 ? Math.PI : 0), _forward))
      this.calibrationNote = describeBindings(this.bindings)
    }
    if (this.wheelRollEnabled) {
      applyWheelRoll(this.bindings, this.rollDistanceMetres * this.tireRollRate)
    }
    applyFrontSteer(this.bindings, this.lastSteer)

    return sample
  }

  private updateSteer(
    distanceMetres: number,
    wheelbaseMetres: number,
    travelledMetres: number,
    travelSign: 1 | -1,
  ) {
    if (!this.curve) return
    const curvature = this.curve.curvatureAt(distanceMetres)
    const target = Math.max(
      -this.maxSteerRadians,
      Math.min(
        this.maxSteerRadians,
        travelSign * Math.atan(wheelbaseMetres * curvature),
      ),
    )
    const step = Math.abs(travelledMetres)
    const alpha = step > 0 ? 1 - Math.exp(-step / STEER_SMOOTHING_METRES) : 1
    this.lastSteer += (target - this.lastSteer) * alpha
  }

  /**
   * Soft-suspension lean: body rolls outward opposite the steer angle.
   * Applied on VehicleActionRoot so it does not fight placement yaw.
   */
  private updateBodyRoll(travelledMetres: number) {
    if (!this.actionRoot) return
    if (this.maxBodyRollRadians <= 1e-6) {
      this.resetBodyRoll()
      return
    }
    const steerNorm =
      this.maxSteerRadians > 1e-6 ? this.lastSteer / this.maxSteerRadians : 0
    const target = -steerNorm * this.maxBodyRollRadians
    const step = Math.abs(travelledMetres)
    const alpha = step > 0 ? 1 - Math.exp(-step / BODY_ROLL_SMOOTHING_METRES) : 1
    this.lastBodyRoll += (target - this.lastBodyRoll) * alpha
    this.actionRoot.rotation.z = this.lastBodyRoll
  }

  private resetBodyRoll() {
    this.lastBodyRoll = 0
    if (this.actionRoot) this.actionRoot.rotation.z = 0
  }

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

  private measureAlignment(placement: Object3D): VehicleAlignment {
    const prev = placement.rotation.clone()
    placement.rotation.set(0, 0, 0)
    placement.updateWorldMatrix(true, true)

    const axles = measureAxleGeometry(this.bindings)

    let result: VehicleAlignment
    if (axles) {
      const { forward } = axles
      const yawOffset = forward.lengthSq() > 1e-8 ? -Math.atan2(forward.x, forward.z) : 0
      const anchorLocal = placement.worldToLocal(axles.centre.clone())
      anchorLocal.y = 0
      result = {
        yawOffset,
        anchorLocal,
        wheelbaseMetres:
          axles.wheelbaseMetres > 0.5 ? axles.wheelbaseMetres : DEFAULT_WHEELBASE_METRES,
        halfTrackMetres: Math.max(0.55, axles.halfTrackMetres),
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
        wheelbaseMetres: Math.max(size.x, size.z) * 0.6 || DEFAULT_WHEELBASE_METRES,
        halfTrackMetres: Math.max(0.55, Math.min(size.x, size.z) * 0.45),
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

  private rebuildMarkers() {
    for (const m of this.markerMeshes) this.markers.remove(m)
    this.markerMeshes = []
    if (!this.route) return
    for (let i = 0; i < this.route.pointsMetres.length; i++) {
      const p = this.route.pointsMetres[i]
      const mesh = new Mesh(this.markerGeo, this.markerMat)
      mesh.position.set(p[0], MARKER_Y, p[2])
      mesh.userData.routeWaypointIndex = i
      mesh.name = `RouteWaypoint_${i}`
      this.markers.add(mesh)
      this.markerMeshes.push(mesh)
    }
    if (this.activeMarkerIndex >= this.markerMeshes.length) this.activeMarkerIndex = -1
    this.setActiveMarker(this.activeMarkerIndex)
  }

  private disposeMarkers(disposeShared = true) {
    for (const m of this.markerMeshes) this.markers.remove(m)
    this.markerMeshes = []
    if (disposeShared) {
      this.markerGeo.dispose()
      this.markerMat.dispose()
      this.markerActiveMat.dispose()
      this.markers.parent?.remove(this.markers)
    }
  }

  private syncFloorSize() {
    if (!this.onFloorSize) return
    if (!this.route) {
      this.onFloorSize(BASE_FLOOR_METRES)
      return
    }
    const extent = routeExtentMetres(this.route)
    // Margin so the path sits inside the pad with room for chase camera.
    const needed = Math.max(BASE_FLOOR_METRES, Math.ceil((extent * 2 + 8) / 2) * 2)
    this.onFloorSize(needed)
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
      bodyRollDeg: (this.lastBodyRoll * 180) / Math.PI,
      maxBodyRollDeg: this.getMaxBodyRollDegrees(),
      tireRollRate: this.tireRollRate,
      radiusMetres: rolling[0]?.radiusMetres ?? 0,
      effectiveRadiusMetres: rolling.length ? rolling[0].radiusMetres / this.tireRollRate : 0,
      ovalScale: this.route?.ovalScale ?? null,
      openScale: this.route?.openScale ?? null,
      waypointCount: this.route?.pointsMetres.length ?? 0,
      extentMetres: this.route ? routeExtentMetres(this.route) : 0,
      editing: this.editing,
      velocityKmh: this.velocityMps * 3.6,
      direction: this.direction,
      accelMps2: this.accelMps2,
      brakeMps2: this.brakeMps2,
      startAccelMps2: this.startAccelMps2,
      endStopMps2: this.endStopMps2,
      closed: this.route?.closed ?? true,
      stress: this.lastStress?.note ?? null,
      stressOk: this.lastStress?.ok ?? null,
      calibration: this.calibrationNote,
    }
  }

  dispose() {
    this.clearRoute()
    this.disposeMarkers(true)
    this.placement = null
    this.bindings = []
    this.scene = null
    this.onFloorSize = null
  }
}
