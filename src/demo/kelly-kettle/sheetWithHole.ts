import { BufferAttribute, BufferGeometry, Vector2 } from 'three'
import { WALL } from './constants'
import { sampleRadius } from './profiles'

/**
 * Lower-wall band containing exactly one circular cutout.
 * Hole-boundary vertices lie on the circle in unrolled (s, y) space.
 * A thin inner ribbon forms the sheet-metal cut edge.
 */
export function sheetWithCircularHole(
  profile: Vector2[],
  segsT: number,
  holeY: number,
  holeR: number,
  holePhi: number,
  yMin: number,
  yMax: number,
): BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const cols = Math.max(64, segsT)
  const rows = 20
  const y0 = Math.max(yMin, holeY - holeR)
  const y1 = Math.min(yMax, holeY + holeR)

  const push = (r: number, theta: number, y: number) => {
    const x = r * Math.sin(theta)
    const z = r * Math.cos(theta)
    const i = positions.length / 3
    positions.push(x, y, z)
    uvs.push(theta / (Math.PI * 2), (y - yMin) / Math.max(1e-6, yMax - yMin))
    return i
  }

  const outer: number[][] = []
  const inner: number[][] = []
  const nArc = cols + 1

  for (let iy = 0; iy <= rows; iy++) {
    const y = y0 + ((y1 - y0) * iy) / rows
    const r = sampleRadius(profile, y)
    const dy = Math.max(-holeR * 0.995, Math.min(holeR * 0.995, y - holeY))
    const ht = Math.sqrt(Math.max(1e-8, holeR * holeR - dy * dy)) / Math.max(r, 0.001)
    const t0 = holePhi + ht
    const t1 = holePhi + Math.PI * 2 - ht
    outer[iy] = []
    inner[iy] = []
    for (let it = 0; it < nArc; it++) {
      const theta = t0 + ((t1 - t0) * it) / (nArc - 1)
      outer[iy][it] = push(r, theta, y)
      inner[iy][it] = push(Math.max(0.004, r - WALL), theta, y)
    }
  }

  const quad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d)
  }

  for (let iy = 0; iy < rows; iy++) {
    for (let it = 0; it < nArc - 1; it++) {
      quad(outer[iy][it], outer[iy][it + 1], outer[iy + 1][it + 1], outer[iy + 1][it])
    }
    quad(outer[iy][0], inner[iy][0], inner[iy + 1][0], outer[iy + 1][0])
    const last = nArc - 1
    quad(inner[iy][last], outer[iy][last], outer[iy + 1][last], inner[iy + 1][last])
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}
