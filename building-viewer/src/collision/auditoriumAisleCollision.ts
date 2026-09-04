import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  SkinnedMesh,
  Vector3,
  type Material,
  type Object3D,
} from 'three'

export type AuditoriumAislePoint = readonly [number, number, number]

export type AuditoriumAisleSpec = {
  readonly name: string
  readonly width: number
  readonly points: readonly AuditoriumAislePoint[]
}

export type AuditoriumAisleCollisionBuild = {
  root: Group
  exactSegments: number
  fallbackSegments: number
  treadTriangles: number
  guardTriangles: number
}

type ClipVertex = { x: number; y: number; z: number }
type SegmentFrame = {
  start: AuditoriumAislePoint
  end: AuditoriumAislePoint
  axisX: number
  axisZ: number
  sideX: number
  sideZ: number
  length: number
  halfWidth: number
}

const AUDITORIUM_TREAD_MATERIAL =
  /^(?:Floor_Wood_Vray(?:_\d+)?|Treppen all(?:\.\d+)?|Rang_Dunkel)$/i
const MIN_UP_DOT = 0.88
const HEIGHT_TOLERANCE = 0.48
const SEGMENT_END_PAD = 0.16
const GUARD_BELOW_ROUTE = 0.65
const GUARD_ABOVE_ROUTE = 1.75
const MIN_EXACT_TRIANGLES = 4

const _a = new Vector3()
const _b = new Vector3()
const _c = new Vector3()
const _ab = new Vector3()
const _ac = new Vector3()
const _normal = new Vector3()
const _meshBox = new Box3()
const _segmentBox = new Box3()

function materialAtTriangle(mesh: Mesh, triangleOffset: number): Material | null {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const groups = mesh.geometry.groups
  if (groups.length === 0) return materials[0] ?? null
  const elementOffset = triangleOffset * 3
  const group = groups.find(
    ({ start, count }) => elementOffset >= start && elementOffset < start + count,
  )
  return materials[group?.materialIndex ?? 0] ?? null
}

function segmentFrame(
  start: AuditoriumAislePoint,
  end: AuditoriumAislePoint,
  width: number,
): SegmentFrame | null {
  const dx = end[0] - start[0]
  const dz = end[2] - start[2]
  const length = Math.hypot(dx, dz)
  if (length < 1e-6) return null
  const axisX = dx / length
  const axisZ = dz / length
  return {
    start,
    end,
    axisX,
    axisZ,
    sideX: -axisZ,
    sideZ: axisX,
    length,
    halfWidth: Math.max(0.2, width * 0.5),
  }
}

function routeY(frame: SegmentFrame, x: number, z: number): number {
  const along = Math.max(
    0,
    Math.min(
      frame.length,
      (x - frame.start[0]) * frame.axisX + (z - frame.start[2]) * frame.axisZ,
    ),
  )
  return frame.start[1] + (frame.end[1] - frame.start[1]) * (along / frame.length)
}

function clipped(
  polygon: ClipVertex[],
  signedDistance: (vertex: ClipVertex) => number,
): ClipVertex[] {
  if (polygon.length === 0) return polygon
  const result: ClipVertex[] = []
  let previous = polygon[polygon.length - 1]!
  let previousDistance = signedDistance(previous)
  for (const current of polygon) {
    const currentDistance = signedDistance(current)
    const previousInside = previousDistance >= -1e-7
    const currentInside = currentDistance >= -1e-7
    if (previousInside !== currentInside) {
      const denominator = previousDistance - currentDistance
      const t = Math.abs(denominator) > 1e-10 ? previousDistance / denominator : 0
      result.push({
        x: previous.x + (current.x - previous.x) * t,
        y: previous.y + (current.y - previous.y) * t,
        z: previous.z + (current.z - previous.z) * t,
      })
    }
    if (currentInside) result.push(current)
    previous = current
    previousDistance = currentDistance
  }
  return result
}

function clipTriangleToSegment(
  triangle: readonly [ClipVertex, ClipVertex, ClipVertex],
  frame: SegmentFrame,
): ClipVertex[] {
  const along = (vertex: ClipVertex) =>
    (vertex.x - frame.start[0]) * frame.axisX +
    (vertex.z - frame.start[2]) * frame.axisZ
  const side = (vertex: ClipVertex) =>
    (vertex.x - frame.start[0]) * frame.sideX +
    (vertex.z - frame.start[2]) * frame.sideZ

  let polygon = [...triangle]
  polygon = clipped(polygon, (vertex) => along(vertex) + SEGMENT_END_PAD)
  polygon = clipped(polygon, (vertex) => frame.length + SEGMENT_END_PAD - along(vertex))
  polygon = clipped(polygon, (vertex) => side(vertex) + frame.halfWidth)
  polygon = clipped(polygon, (vertex) => frame.halfWidth - side(vertex))
  return polygon
}

function appendTriangle(
  vertices: number[],
  a: ClipVertex,
  b: ClipVertex,
  c: ClipVertex,
): void {
  const abX = b.x - a.x
  const abY = b.y - a.y
  const abZ = b.z - a.z
  const acX = c.x - a.x
  const acY = c.y - a.y
  const acZ = c.z - a.z
  const normalX = abY * acZ - abZ * acY
  const normalY = abZ * acX - abX * acZ
  const normalZ = abX * acY - abY * acX
  if (normalX * normalX + normalY * normalY + normalZ * normalZ < 1e-20) return
  if (normalY >= 0) {
    vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  } else {
    vertices.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z)
  }
}

function segmentBounds(frame: SegmentFrame): Box3 {
  const minY = Math.min(frame.start[1], frame.end[1]) - HEIGHT_TOLERANCE
  const maxY = Math.max(frame.start[1], frame.end[1]) + HEIGHT_TOLERANCE
  _segmentBox.makeEmpty()
  for (const along of [-SEGMENT_END_PAD, frame.length + SEGMENT_END_PAD]) {
    for (const side of [-frame.halfWidth, frame.halfWidth]) {
      const x = frame.start[0] + frame.axisX * along + frame.sideX * side
      const z = frame.start[2] + frame.axisZ * along + frame.sideZ * side
      _segmentBox.expandByPoint(_a.set(x, minY, z))
      _segmentBox.expandByPoint(_a.set(x, maxY, z))
    }
  }
  return _segmentBox
}

function collectExactTreads(root: Object3D, frame: SegmentFrame): number[] {
  const vertices: number[] = []
  const bounds = segmentBounds(frame).clone()
  root.updateMatrixWorld(true)
  root.traverse((object) => {
    if (!(object as Mesh).isMesh) return
    if ((object as SkinnedMesh).isSkinnedMesh || (object as InstancedMesh).isInstancedMesh) return
    if ((object as Mesh & { isBatchedMesh?: boolean }).isBatchedMesh) return
    const mesh = object as Mesh
    if (mesh.userData?.collisionOnly || mesh.userData?.cadOverlay) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (!materials.some((material) => AUDITORIUM_TREAD_MATERIAL.test(material?.name || ''))) return
    const position = mesh.geometry.getAttribute('position')
    if (!position) return
    _meshBox.setFromObject(mesh)
    if (!_meshBox.intersectsBox(bounds)) return

    const index = mesh.geometry.getIndex()
    const elementCount = index?.count ?? position.count
    for (let offset = 0; offset + 2 < elementCount; offset += 3) {
      const material = materialAtTriangle(mesh, offset / 3)
      if (!material || !AUDITORIUM_TREAD_MATERIAL.test(material.name || '')) continue
      const ia = index ? index.getX(offset) : offset
      const ib = index ? index.getX(offset + 1) : offset + 1
      const ic = index ? index.getX(offset + 2) : offset + 2
      _a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld)
      _b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld)
      _c.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld)
      _ab.subVectors(_b, _a)
      _ac.subVectors(_c, _a)
      _normal.crossVectors(_ab, _ac)
      const normalLength = _normal.length()
      if (normalLength < 1e-9 || Math.abs(_normal.y) / normalLength < MIN_UP_DOT) continue
      const polygon = clipTriangleToSegment(
        [
          { x: _a.x, y: _a.y, z: _a.z },
          { x: _b.x, y: _b.y, z: _b.z },
          { x: _c.x, y: _c.y, z: _c.z },
        ],
        frame,
      )
      if (polygon.length < 3) continue
      const clippedCenter = polygon.reduce(
        (sum, vertex) => {
          sum.x += vertex.x
          sum.y += vertex.y
          sum.z += vertex.z
          return sum
        },
        { x: 0, y: 0, z: 0 },
      )
      clippedCenter.x /= polygon.length
      clippedCenter.y /= polygon.length
      clippedCenter.z /= polygon.length
      if (
        Math.abs(
          clippedCenter.y - routeY(frame, clippedCenter.x, clippedCenter.z),
        ) > HEIGHT_TOLERANCE
      ) {
        continue
      }
      for (let triangle = 1; triangle + 1 < polygon.length; triangle += 1) {
        appendTriangle(vertices, polygon[0]!, polygon[triangle]!, polygon[triangle + 1]!)
      }
    }
  })
  return vertices
}

function fallbackTreads(frame: SegmentFrame): number[] {
  const vertices: number[] = []
  const rise = frame.end[1] - frame.start[1]
  const stepCount = Math.max(1, Math.ceil(Math.abs(rise) / 0.19))
  const overlap = Math.min(0.012, 0.04 / frame.length)
  for (let step = 0; step <= stepCount; step += 1) {
    const startT = Math.max(0, step / stepCount - overlap)
    const endT = Math.min(1 + 0.2 / frame.length, (step + 1) / stepCount + overlap)
    const y = frame.start[1] + rise * (step / stepCount) + 0.025
    const startX = frame.start[0] + frame.axisX * frame.length * startT
    const startZ = frame.start[2] + frame.axisZ * frame.length * startT
    const endX = frame.start[0] + frame.axisX * frame.length * endT
    const endZ = frame.start[2] + frame.axisZ * frame.length * endT
    appendTriangle(
      vertices,
      { x: startX + frame.sideX * frame.halfWidth, y, z: startZ + frame.sideZ * frame.halfWidth },
      { x: endX + frame.sideX * frame.halfWidth, y, z: endZ + frame.sideZ * frame.halfWidth },
      { x: endX - frame.sideX * frame.halfWidth, y, z: endZ - frame.sideZ * frame.halfWidth },
    )
    appendTriangle(
      vertices,
      { x: startX + frame.sideX * frame.halfWidth, y, z: startZ + frame.sideZ * frame.halfWidth },
      { x: endX - frame.sideX * frame.halfWidth, y, z: endZ - frame.sideZ * frame.halfWidth },
      { x: startX - frame.sideX * frame.halfWidth, y, z: startZ - frame.sideZ * frame.halfWidth },
    )
  }
  return vertices
}

function makeGeometry(vertices: number[]): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.computeBoundingBox()
  return geometry
}

function addGuard(
  root: Group,
  aisleName: string,
  segmentIndex: number,
  frame: SegmentFrame,
  sideSign: -1 | 1,
): number {
  const side = frame.halfWidth * sideSign
  const startX = frame.start[0] + frame.sideX * side
  const startZ = frame.start[2] + frame.sideZ * side
  const endX = frame.end[0] + frame.sideX * side
  const endZ = frame.end[2] + frame.sideZ * side
  const vertices: number[] = []
  appendTriangle(
    vertices,
    { x: startX, y: frame.start[1] - GUARD_BELOW_ROUTE, z: startZ },
    { x: endX, y: frame.end[1] - GUARD_BELOW_ROUTE, z: endZ },
    { x: endX, y: frame.end[1] + GUARD_ABOVE_ROUTE, z: endZ },
  )
  appendTriangle(
    vertices,
    { x: startX, y: frame.start[1] - GUARD_BELOW_ROUTE, z: startZ },
    { x: endX, y: frame.end[1] + GUARD_ABOVE_ROUTE, z: endZ },
    { x: startX, y: frame.start[1] + GUARD_ABOVE_ROUTE, z: startZ },
  )
  const guard = new Mesh(makeGeometry(vertices))
  guard.name = `COLLIDER_guard_${aisleName}_${segmentIndex}_${sideSign < 0 ? 'left' : 'right'}`
  root.add(guard)
  return vertices.length / 9
}

/**
 * Build exact, top-only auditorium aisle support from the rendered wood mesh.
 * Each source triangle is truly clipped to the narrow aisle rectangle, so the
 * building-wide floor aggregate cannot leak walk collision below seat rows.
 * Vertical side guards keep a slightly misaligned forward input from stepping
 * over the open/rail edge and falling onto a lower model layer.
 */
export function buildAuditoriumAisleCollision(
  sourceRoot: Object3D,
  aisles: readonly AuditoriumAisleSpec[],
): AuditoriumAisleCollisionBuild {
  const root = new Group()
  root.name = 'AuditoriumAisleCollision'
  let exactSegments = 0
  let fallbackSegments = 0
  let treadTriangles = 0
  let guardTriangles = 0

  for (const aisle of aisles) {
    for (let index = 0; index + 1 < aisle.points.length; index += 1) {
      const frame = segmentFrame(aisle.points[index]!, aisle.points[index + 1]!, aisle.width)
      if (!frame) continue
      let vertices = collectExactTreads(sourceRoot, frame)
      if (vertices.length / 9 >= MIN_EXACT_TRIANGLES) {
        exactSegments += 1
      } else {
        vertices = fallbackTreads(frame)
        fallbackSegments += 1
      }
      treadTriangles += vertices.length / 9
      const treads = new Mesh(makeGeometry(vertices))
      treads.name = `COLLIDER_walk_${aisle.name}_${index}`
      root.add(treads)
      guardTriangles += addGuard(root, aisle.name, index, frame, -1)
      guardTriangles += addGuard(root, aisle.name, index, frame, 1)
    }
  }
  root.updateMatrixWorld(true)
  return { root, exactSegments, fallbackSegments, treadTriangles, guardTriangles }
}
