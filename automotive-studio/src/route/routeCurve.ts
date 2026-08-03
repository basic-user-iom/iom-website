import { CatmullRomCurve3, Vector3 } from 'three'
import type { VehicleRoute } from '../persistence/schema'
import type { RouteSample } from './routeMath'

const _point = new Vector3()
const _tangent = new Vector3()

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

  sample(distanceMetres: number): RouteSample {
    const total = this.length
    if (!Number.isFinite(total) || total < 1e-6) {
      return { position: [0, 0, 0], yaw: 0, distanceAlong: 0, totalLength: 0 }
    }

    let d = distanceMetres
    if (this.closed) d = ((d % total) + total) % total
    else d = Math.min(Math.max(0, d), total)

    const u = d / total
    this.curve.getPointAt(u, _point)
    this.curve.getTangentAt(u, _tangent)

    return {
      position: [_point.x, _point.y, _point.z],
      yaw: Math.atan2(_tangent.x, _tangent.z),
      distanceAlong: d,
      totalLength: total,
    }
  }

  /**
   * Signed curvature (1/m) at a distance, from a centred yaw difference.
   * Positive means the heading is turning the same way `rotation.y` increases.
   */
  curvatureAt(distanceMetres: number, halfSpanMetres = 0.4): number {
    const span = Math.max(0.05, halfSpanMetres)
    const behind = this.sample(distanceMetres - span).yaw
    const ahead = this.sample(distanceMetres + span).yaw
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
