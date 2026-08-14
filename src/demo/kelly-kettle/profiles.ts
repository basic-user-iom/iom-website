import { Shape, Vector2 } from 'three'
import {
  BASE_H,
  BASE_R,
  BODY_R,
  CHIMNEY_BOT_R,
  CHIMNEY_TOP_R,
  KETTLE_H,
  SEAT_Y,
  WALL,
  WATER_TOP_Y,
} from './constants'

function v(x: number, y: number): Vector2 {
  return new Vector2(x, y)
}

/** Linear points only — do not spline or densify into a bottle. */
function line(points: Vector2[], extra = 0): Vector2[] {
  if (extra <= 0) return points.map((p) => p.clone())
  const out: Vector2[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    out.push(a.clone())
    for (let s = 1; s <= extra; s++) out.push(a.clone().lerp(b, s / (extra + 1)))
  }
  out.push(points[points.length - 1].clone())
  return out
}

export function offsetProfile(points: Vector2[], dist: number): Vector2[] {
  const n = points.length
  const out: Vector2[] = []
  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(n - 1, i + 1)]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    const nx = dy / len
    const ny = -dx / len
    const p = points[i]
    out.push(v(Math.max(0.004, p.x + nx * dist), p.y + ny * dist))
  }
  return out
}

function nr(height: number, radius: number): Vector2 {
  return v(radius * BODY_R, height * KETTLE_H)
}

/**
 * Tall tapered bucket: long nearly-straight wall, short conical shoulder, short neck.
 * Control points follow the supplied normalised table and are not rounded into a vase.
 */
export function kettleOuterProfile(): Vector2[] {
  return line(
    [
      v(BODY_R * 0.74, -0.01),
      v(BODY_R * 0.78, -0.003),
      nr(0.0, 0.96),
      nr(0.08, 1.0),
      nr(0.67, 0.91),
      nr(0.72, 0.89),
      nr(0.88, 0.4),
      nr(0.925, 0.38),
      nr(0.985, 0.38),
      nr(1.0, 0.41),
    ],
    1,
  )
}

/** Open inner shaft only — no horizontal caps. */
export function chimneyOuterProfile(): Vector2[] {
  return line(
    [
      v(CHIMNEY_BOT_R, -0.012),
      v(CHIMNEY_BOT_R - 0.001, 0.04),
      v(CHIMNEY_TOP_R + 0.0015, KETTLE_H * 0.7),
      v(CHIMNEY_TOP_R + 0.0008, KETTLE_H * 0.9),
    ],
    1,
  )
}

export function chimneyInnerProfile(): Vector2[] {
  const r = CHIMNEY_TOP_R - 0.0011
  return line([v(r, -0.014), v(r, KETTLE_H + 0.0004)], 2)
}

export function waterOuterProfile(): Vector2[] {
  return clipY(offsetProfile(kettleOuterProfile(), -WALL * 1.1), 0.01, WATER_TOP_Y)
}

export function waterInnerProfile(): Vector2[] {
  return clipY(offsetProfile(chimneyOuterProfile(), WALL * 0.35), 0.01, WATER_TOP_Y)
}

function clipY(points: Vector2[], minY: number, maxY: number): Vector2[] {
  const out: Vector2[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (b.y < minY || a.y > maxY) continue
    const a2 = a.y < minY ? v(sampleRadius([a, b], minY), minY) : a
    const b2 = b.y > maxY ? v(sampleRadius([a, b], maxY), maxY) : b
    if (!out.length) out.push(a2.clone())
    out.push(b2.clone())
  }
  return out.length ? out : points
}

/** Flat closed floor — do not wrap this up the wall or it will fill the air hole. */
export function fireBaseFloorProfile(): Vector2[] {
  const r = BASE_R * 0.38
  return line([v(0.001, 0.0012), v(r - 0.002, 0.0012), v(r, 0.003)], 0)
}

/**
 * Thin pressed can: ~63% lower cylinder, short transition, shallow flare, thin rolled rim.
 * Upper rim is ~17% wider than the lower cylinder.
 */
export function fireBaseWallProfile(): Vector2[] {
  const lower = BASE_R * 0.855
  return line(
    [
      v(lower, 0.0018),
      v(lower + 0.0004, 0.006),
      v(lower + 0.0006, BASE_H * 0.63),
      v(lower + 0.004, BASE_H * 0.72),
      v(BASE_R - 0.0015, BASE_H - 0.004),
      v(BASE_R, BASE_H - 0.0012),
      v(BASE_R - 0.0018, BASE_H),
    ],
    1,
  )
}

/** Thin rolled lip hugging the kettle. */
export function fireBaseSeatProfile(): Vector2[] {
  const kettleR = BODY_R * 0.96
  return line(
    [
      v(BASE_R - 0.0012, BASE_H - 0.0006),
      v(BASE_R - 0.0055, BASE_H + 0.0005),
      v(kettleR + 0.004, SEAT_Y + 0.0022),
      v(kettleR + 0.0014, SEAT_Y),
      v(kettleR - 0.0035, SEAT_Y - 0.0028),
      v(kettleR - 0.011, SEAT_Y - 0.007),
    ],
    1,
  )
}

export function clipProfileY(points: Vector2[], minY: number, maxY: number): Vector2[] {
  return clipY(points, minY, maxY)
}

export function wallSectionShape(outer: Vector2[], inner: Vector2[]): Shape {
  const shape = new Shape()
  shape.moveTo(outer[0].x, outer[0].y)
  for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x, outer[i].y)
  for (let i = inner.length - 1; i >= 0; i--) shape.lineTo(inner[i].x, inner[i].y)
  shape.closePath()
  return shape
}

export function sampleRadius(profile: Vector2[], y: number): number {
  if (y <= profile[0].y) return profile[0].x
  if (y >= profile[profile.length - 1].y) return profile[profile.length - 1].x
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i]
    const b = profile[i + 1]
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / Math.max(1e-6, b.y - a.y)
      return a.x + (b.x - a.x) * t
    }
  }
  return profile[profile.length - 1].x
}
