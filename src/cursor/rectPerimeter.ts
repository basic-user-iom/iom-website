/** Point on a rectangle outline; t is 0..1 starting at top-left, clockwise. */
export function pointOnRectPerimeter(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  t: number,
): { x: number; y: number } {
  const w = Math.max(8, halfW * 2)
  const h = Math.max(8, halfH * 2)
  const perim = 2 * (w + h)
  let d = (((t % 1) + 1) % 1) * perim
  if (d <= w) return { x: cx - halfW + d, y: cy - halfH }
  d -= w
  if (d <= h) return { x: cx + halfW, y: cy - halfH + d }
  d -= h
  if (d <= w) return { x: cx + halfW - d, y: cy + halfH }
  d -= w
  return { x: cx - halfW, y: cy + halfH - d }
}

/** Nearest perimeter progress (0..1) for a point near a rectangle outline. */
export function rectPerimeterT(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  x: number,
  y: number,
): number {
  const left = cx - halfW
  const right = cx + halfW
  const top = cy - halfH
  const bottom = cy + halfH
  const w = Math.max(8, right - left)
  const h = Math.max(8, bottom - top)
  const perim = 2 * (w + h)

  const dl = Math.abs(x - left)
  const dr = Math.abs(x - right)
  const dt = Math.abs(y - top)
  const db = Math.abs(y - bottom)
  const m = Math.min(dl, dr, dt, db)

  let qx: number
  let qy: number
  if (m === dt) {
    qx = Math.min(right, Math.max(left, x))
    qy = top
  } else if (m === dr) {
    qx = right
    qy = Math.min(bottom, Math.max(top, y))
  } else if (m === db) {
    qx = Math.min(right, Math.max(left, x))
    qy = bottom
  } else {
    qx = left
    qy = Math.min(bottom, Math.max(top, y))
  }

  let dist: number
  if (Math.abs(qy - top) <= 0.5) dist = qx - left
  else if (Math.abs(qx - right) <= 0.5) dist = w + (qy - top)
  else if (Math.abs(qy - bottom) <= 0.5) dist = w + h + (right - qx)
  else dist = w + h + w + (bottom - qy)

  return ((dist / perim) % 1 + 1) % 1
}
