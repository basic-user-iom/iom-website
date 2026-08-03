import type { Vec3, VehicleRoute } from '../persistence/schema'

export type RouteSample = {
  position: Vec3
  /** Yaw radians, 0 = +Z, increases toward +X (right). */
  yaw: number
  distanceAlong: number
  totalLength: number
}

function dist(a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  return Math.hypot(dx, dy, dz)
}

export function routeLengthMetres(route: VehicleRoute): number {
  const pts = route.pointsMetres
  if (pts.length < 2) return 0
  let len = 0
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i])
  if (route.closed && pts.length > 2) len += dist(pts[pts.length - 1], pts[0])
  return len
}

/** Sample a point along the route by arc-length distance (metres). */
export function sampleRoute(route: VehicleRoute, distanceMetres: number): RouteSample {
  const pts = route.pointsMetres
  const total = routeLengthMetres(route)
  if (pts.length === 0) {
    return { position: [0, 0, 0], yaw: 0, distanceAlong: 0, totalLength: 0 }
  }
  if (pts.length === 1 || total < 1e-6) {
    return { position: [...pts[0]] as Vec3, yaw: 0, distanceAlong: 0, totalLength: total }
  }

  let d = distanceMetres
  if (route.closed) {
    d = ((d % total) + total) % total
  } else {
    d = Math.min(Math.max(0, d), total)
  }

  const segments: Array<{ a: Vec3; b: Vec3; len: number }> = []
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    segments.push({ a, b, len: dist(a, b) })
  }
  if (route.closed && pts.length > 2) {
    segments.push({ a: pts[pts.length - 1], b: pts[0], len: dist(pts[pts.length - 1], pts[0]) })
  }

  let remaining = d
  for (const seg of segments) {
    if (remaining <= seg.len || seg.len < 1e-9) {
      const t = seg.len < 1e-9 ? 0 : remaining / seg.len
      const position: Vec3 = [
        seg.a[0] + (seg.b[0] - seg.a[0]) * t,
        seg.a[1] + (seg.b[1] - seg.a[1]) * t,
        seg.a[2] + (seg.b[2] - seg.a[2]) * t,
      ]
      const yaw = Math.atan2(seg.b[0] - seg.a[0], seg.b[2] - seg.a[2])
      return { position, yaw, distanceAlong: d, totalLength: total }
    }
    remaining -= seg.len
  }

  const last = segments[segments.length - 1]
  const yaw = Math.atan2(last.b[0] - last.a[0], last.b[2] - last.a[2])
  return { position: [...last.b] as Vec3, yaw, distanceAlong: total, totalLength: total }
}

/**
 * Default closed oval for a ~5 m car on the 24×24 m studio floor.
 *
 * Radii are chosen so the tightest curvature (rz²/rx ≈ 5.9 m) matches the real turning circle
 * of a vehicle this size — a tighter oval would peg the front wheels at full lock all the way
 * round, which reads as understeer.
 */
export function createDefaultOvalRoute(speedKmh = 18): VehicleRoute {
  const rx = 9.5
  const rz = 7.5
  const pointsMetres: Vec3[] = []
  const steps = 24
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    pointsMetres.push([Math.sin(a) * rx, 0, Math.cos(a) * rz])
  }
  return {
    id: crypto.randomUUID(),
    closed: true,
    pointsMetres,
    speedKmh,
  }
}

export function speedKmhToMetresPerSecond(kmh: number): number {
  return (kmh * 1000) / 3600
}
