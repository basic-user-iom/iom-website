import { BufferGeometry, Float32BufferAttribute, PlaneGeometry } from 'three'
import type { StageSurface } from '../persistence/schema'

/** True when a height map will actually displace vertices. */
export function stageSurfaceNeedsDisplacement(surface: StageSurface): boolean {
  return Boolean(surface.maps?.displacementMapAssetId) && (surface.displacementScale ?? 0) > 0.001
}

/**
 * Circular pad with concentric rings + planar UVs.
 *
 * `CircleGeometry` is only a centre fan (no interior rings), so displacement maps
 * have almost nothing to move and height looks “broken”. This disk keeps the same
 * planar UV convention (`u/v = 0.5 + xy/(2r)`) so albedo/normal packs stay aligned.
 */
export function createTessellatedCircleGeometry(
  radius: number,
  radialSegments = 96,
  ringCount = 48,
): BufferGeometry {
  const r = Math.max(0.05, radius)
  const radials = Math.max(12, Math.floor(radialSegments))
  const rings = Math.max(4, Math.floor(ringCount))

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  positions.push(0, 0, 0)
  normals.push(0, 0, 1)
  uvs.push(0.5, 0.5)

  for (let ring = 1; ring <= rings; ring++) {
    const rr = (ring / rings) * r
    for (let i = 0; i < radials; i++) {
      const theta = (i / radials) * Math.PI * 2
      const x = Math.cos(theta) * rr
      const y = Math.sin(theta) * rr
      positions.push(x, y, 0)
      normals.push(0, 0, 1)
      uvs.push(x / (2 * r) + 0.5, y / (2 * r) + 0.5)
    }
  }

  for (let i = 0; i < radials; i++) {
    const a = 1 + i
    const b = 1 + ((i + 1) % radials)
    indices.push(0, a, b)
  }
  for (let ring = 1; ring < rings; ring++) {
    const ringStart = 1 + (ring - 1) * radials
    const nextStart = 1 + ring * radials
    for (let i = 0; i < radials; i++) {
      const i2 = (i + 1) % radials
      const a = ringStart + i
      const b = ringStart + i2
      const c = nextStart + i2
      const d = nextStart + i
      indices.push(a, d, b, b, d, c)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  return geo
}

/** Infinite-drive plane — dense grid only when height displacement is active. */
export function createInfiniteFloorGeometry(size: number, displace: boolean): PlaneGeometry {
  const segs = displace ? 128 : 1
  return new PlaneGeometry(size, size, segs, segs)
}
