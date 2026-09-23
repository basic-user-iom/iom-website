import { CatmullRomCurve3, Vector3 } from 'three'
import type { VehicleRoute } from '../persistence/schema'
import type { RouteSample } from './routeMath'

const _point = new Vector3()
const _tangent = new Vector3()
/** Reused sample — callers must read fields immediately (do not stash across sample/curvatureAt). */
const _samplePos: [number, number, number] = [0, 0, 0]
const _sample: RouteSample = {
  position: _samplePos,
  yaw: 0,
  distanceAlong: 0,
  totalLength: 0,
}

/**
 * Arc-length parameterized spline through the route points.
 *
 * Sampling the raw polyline gives a heading that is constant per segment and snaps at
 * every vertex, which reads as jerking through corners. Catmull-Rom keeps position and
 * tangent continuous, so yaw changes smoothly.
 */
export class RouteCurve {
  private curve: CatmullRomCurve3
  private length: number
  private closed: boolean

  constructor(route: VehicleRoute) {
    const points = route.pointsMetres.map((p) => new Vector3(p[0], p[1], p[2]))
    this.closed = route.closed && points.length > 2
    this.curve = new CatmullRomCurve3(points, this.closed, 'centripetal', 0.5)
    this.curve.arcLengthDivisions = Math.max(600, points.length * 40)
    this.length = this.curve.getLength()
  }

  get totalLength(): number {
    return this.length
  }

  private wrapDistance(distanceMetres: number): number {
    const total = this.length
    if (!Number.isFinite(total) || total < 1e-6) return 0
    if (this.closed) return ((distanceMetres % total) + total) % total
    return Math.min(Math.max(0, distanceMetres), total)
  }

  /** Yaw only — used by curvature so it never clobbers a live `sample()` result. */
  private yawAt(distanceMetres: number): number {
    const total = this.length
    if (!Number.isFinite(total) || total < 1e-6) return 0
    const d = this.wrapDistance(distanceMetres)
    this.curve.getTangentAt(d / total, _tangent)
    return Math.atan2(_tangent.x, _tangent.z)
  }

  sample(distanceMetres: number): RouteSample {
    const total = this.length
    if (!Number.isFinite(total) || total < 1e-6) {
      _samplePos[0] = 0
      _samplePos[1] = 0
      _samplePos[2] = 0
      _sample.yaw = 0
      _sample.distanceAlong = 0
      _sample.totalLength = 0
      return _sample
    }

    const d = this.wrapDistance(distanceMetres)
    const u = d / total
    this.curve.getPointAt(u, _point)
    this.curve.getTangentAt(u, _tangent)

    _samplePos[0] = _point.x
    _samplePos[1] = _point.y
    _samplePos[2] = _point.z
    _sample.yaw = Math.atan2(_tangent.x, _tangent.z)
    _sample.distanceAlong = d
    _sample.totalLength = total
    return _sample
  }

  /**
   * Signed curvature (1/m) at a distance, from a centred yaw difference.
   * Positive means the heading is turning the same way `rotation.y` increases.
   */
  curvatureAt(distanceMetres: number, halfSpanMetres = 0.4): number {
    const span = Math.max(0.05, halfSpanMetres)
    const behind = this.yawAt(distanceMetres - span)
    const ahead = this.yawAt(distanceMetres + span)
    let delta = ahead - behind
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    return delta / (2 * span)
  }

  /** Points for the viewport guide line, so the drawn path matches the driven path. */
  guidePoints(divisions = 240): Vector3[] {
    const pts = this.curve.getSpacedPoints(divisions)
    if (this.closed && pts.length) pts.push(pts[0].clone())
    return pts
  }
}
