import * as THREE from 'three'
import type { LinarApplication } from './types'

/**
 * Visual reference from dukta_Application_EN.pdf. These values describe the
 * simplified presentation grid only; they are not project-certified mounting
 * dimensions and are intentionally not exposed as configurator controls.
 */
export const SUPPORT_GRID_REFERENCE = Object.freeze({
  battenWidthMm: 40,
  battenDepthMm: 45,
  maximumSpacingMm: 400,
  authority: 'application-manual-reference' as const,
})

/**
 * Render-only separation between the finished rear surface/backing and its
 * support. This prevents coincident faces without claiming a construction
 * tolerance or changing the referenced 45 mm batten depth.
 */
export const SUPPORT_GRID_RENDER_GAP_M = 0.0005

/**
 * Visual-only cavity infill used for the mounted wool study. The application
 * sheet identifies thick sound-insulating wool between the timber members but
 * does not provide an installed thickness. Keep a small reveal at both faces
 * of the referenced 45 mm battens so the construction remains legible and do
 * not expose this derived render depth as validated product data.
 */
export const SUPPORT_GRID_CAVITY_INFILL_VISUAL = Object.freeze({
  frontRecessMm: 2,
  rearRevealMm: 3,
  memberClearanceMm: 2,
  authority: 'application-diagram-visual-study' as const,
})

export const SUPPORT_GRID_CAVITY_INFILL_OBJECT_NAME = 'LinarSupportCavityInfill'

export type SupportPathPoint = {
  x: number
  z: number
  rotY: number
  distanceM: number
}

export type SupportGridBounds = {
  minX: number
  maxX: number
  heightM: number
  /** Furthest rendered surface behind the panel centreline. */
  rearSurfaceOffsetM?: number
  seamXM?: readonly number[]
  supportPathXZ?: readonly SupportPathPoint[]
  seamPathDistancesM?: readonly number[]
}

export type SupportGridUpdate = {
  application: LinarApplication
  panelCount: number
  bounds: SupportGridBounds
}

export type SupportGridStats = {
  verticalBattens: number
  horizontalBattens: number
  outerFrameMembers: number
  totalInstances: number
  visible: boolean
}

export type LinarSupportGrid = {
  group: THREE.Group
  update: (next: SupportGridUpdate) => SupportGridStats
  setInternalMembersVisible: (visible: boolean) => void
  setCavityInfill: (visible: boolean, colour: THREE.ColorRepresentation) => void
  getStats: () => SupportGridStats
  dispose: () => void
}

const BATTEN_WIDTH_M = SUPPORT_GRID_REFERENCE.battenWidthMm / 1000
const BATTEN_DEPTH_M = SUPPORT_GRID_REFERENCE.battenDepthMm / 1000
const MAXIMUM_SPACING_M = SUPPORT_GRID_REFERENCE.maximumSpacingMm / 1000
// A 5 mm / 0.5 degree cache quantum made the support remain still and then
// jump while the panel animated. Sub-millimetre keys retain the allocation
// cache without allowing a visible panel/support desynchronisation.
const BOUNDS_KEY_QUANTUM_M = 0.00025
const ANCHOR_DEDUPLICATION_M = BATTEN_WIDTH_M * 1.1
const SPACING_ROUNDING_TOLERANCE_M = 1e-9
const MAX_INSTANCES_PER_AXIS = 64
const MAX_SUPPORT_PATH_POINTS = 257
const CURVED_PATH_DEPTH_THRESHOLD_M = 0.003
const CURVED_PATH_TURN_THRESHOLD_RAD = THREE.MathUtils.degToRad(0.75)
const PATH_ROTATION_KEY_QUANTUM_RAD = THREE.MathUtils.degToRad(0.05)
const OUTER_FRAME_MEMBER_COUNT = 4
// The closed curved rib outline contains the complete panel-facing path and
// the complete reverse path. Capacity therefore has to cover two vertices per
// support-path sample. The previous one-path allocation overflowed from three
// repeated modules onward (four modules wrote 5,388 active indices into a
// 3,096-index buffer), which appeared as missing sections in the outer frame.
const MAX_CURVED_PROFILE_OUTLINE_POINTS = MAX_SUPPORT_PATH_POINTS * 2
const MAX_CURVED_PROFILE_VERTEX_COUNT = MAX_CURVED_PROFILE_OUTLINE_POINTS * 6
const MAX_CURVED_PROFILE_INDEX_COUNT = MAX_CURVED_PROFILE_OUTLINE_POINTS * 12 - 12
// One cavity-row geometry contains every pathwise wool bay as an independent,
// watertight swept volume. The path samples can be repeated at both ends of
// every bay because timber clearances usually fall between source samples.
const MAX_CAVITY_PATH_CELLS = MAX_INSTANCES_PER_AXIS - 1
const MAX_CAVITY_PATH_SAMPLES =
  MAX_SUPPORT_PATH_POINTS + MAX_CAVITY_PATH_CELLS * 2
const MAX_CAVITY_OUTLINE_POINTS = MAX_CAVITY_PATH_SAMPLES * 2
const MAX_CAVITY_VERTEX_COUNT = MAX_CAVITY_OUTLINE_POINTS * 6
const MAX_CAVITY_INDEX_COUNT =
  MAX_CAVITY_OUTLINE_POINTS * 12 - MAX_CAVITY_PATH_CELLS * 12
const PROFILE_POINT_EPSILON_SQ = 1e-12
const PATH_DISTANCE_EPSILON_M = 1e-9

type SupportAnchor = {
  positionM: number
  priority: number
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function quantizedKey(value: number): number {
  return Math.round(value / BOUNDS_KEY_QUANTUM_M)
}

function quantizedRotationKey(value: number): number {
  return Math.round(value / PATH_ROTATION_KEY_QUANTUM_RAD)
}

function pathKey(points: readonly SupportPathPoint[]): string {
  if (points.length < 2) return 'planar'
  let hash = 2166136261
  for (const point of points) {
    const values = [
      quantizedKey(point.x),
      quantizedKey(point.z),
      quantizedRotationKey(point.rotY),
      quantizedKey(point.distanceM),
    ]
    for (const value of values) {
      hash ^= value
      hash = Math.imul(hash, 16777619)
    }
  }
  return `${points.length}:${hash >>> 0}`
}

/**
 * Keep module seams as mandatory support positions, merge any seam/edge pair
 * that would physically overlap, then subdivide every remaining interval so
 * the reference maximum spacing is never exceeded.
 */
function supportPositions(
  minimumM: number,
  maximumM: number,
  mandatoryPositionsM: readonly number[] = [],
): number[] {
  const minimum = Math.min(minimumM, maximumM)
  const maximum = Math.max(minimumM, maximumM)
  if (maximum - minimum < 0.001) return [(minimum + maximum) * 0.5]

  const anchors: SupportAnchor[] = [
    { positionM: minimum, priority: 1 },
    { positionM: maximum, priority: 1 },
  ]
  for (const value of mandatoryPositionsM) {
    if (!Number.isFinite(value) || value <= minimum || value >= maximum) continue
    anchors.push({ positionM: value, priority: 2 })
  }
  anchors.sort((a, b) => a.positionM - b.positionM)

  const deduplicated: SupportAnchor[] = []
  for (const anchor of anchors) {
    const previous = deduplicated[deduplicated.length - 1]
    if (!previous || anchor.positionM - previous.positionM > ANCHOR_DEDUPLICATION_M) {
      deduplicated.push(anchor)
      continue
    }
    // A module seam is more useful than a nearby generic edge/spacing point.
    // Equal-priority anchors merge at their midpoint to avoid a visible bias.
    if (anchor.priority > previous.priority) {
      deduplicated[deduplicated.length - 1] = anchor
    } else if (anchor.priority === previous.priority) {
      previous.positionM = (previous.positionM + anchor.positionM) * 0.5
    }
  }

  const positions: number[] = [deduplicated[0].positionM]
  for (let index = 1; index < deduplicated.length; index += 1) {
    const start = deduplicated[index - 1].positionM
    const end = deduplicated[index].positionM
    // Avoid an extra batten when a nominal 400 mm interval lands a few ULPs
    // above the limit after repeated-module transforms.
    const divisions = Math.max(
      1,
      Math.ceil(
        (end - start - SPACING_ROUNDING_TOLERANCE_M) / MAXIMUM_SPACING_M,
      ),
    )
    for (let division = 1; division <= divisions; division += 1) {
      positions.push(THREE.MathUtils.lerp(start, end, division / divisions))
    }
  }
  return positions
}

function emptyStats(): SupportGridStats {
  return {
    verticalBattens: 0,
    horizontalBattens: 0,
    outerFrameMembers: 0,
    totalInstances: 0,
    visible: false,
  }
}

function validSupportPath(
  points: readonly SupportPathPoint[] | undefined,
): SupportPathPoint[] {
  if (!points || points.length < 2) return []
  const valid = points.filter(
    (point) =>
      Number.isFinite(point.x) &&
      Number.isFinite(point.z) &&
      Number.isFinite(point.rotY) &&
      Number.isFinite(point.distanceM),
  )
  if (valid.length < 2) return []
  return valid.slice(0, MAX_SUPPORT_PATH_POINTS)
}

function pathIsCurved(points: readonly SupportPathPoint[]): boolean {
  if (points.length < 2) return false
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY
  let maximumTurn = 0
  const firstRotation = points[0].rotY
  for (const point of points) {
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
    const turn = Math.abs(
      THREE.MathUtils.euclideanModulo(point.rotY - firstRotation + Math.PI, Math.PI * 2) -
        Math.PI,
    )
    maximumTurn = Math.max(maximumTurn, turn)
  }
  return (
    maxZ - minZ > CURVED_PATH_DEPTH_THRESHOLD_M ||
    maximumTurn > CURVED_PATH_TURN_THRESHOLD_RAD
  )
}

function shortestAngleLerp(from: number, to: number, amount: number): number {
  const delta =
    THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI
  return from + delta * amount
}

function pointAtPathDistance(
  points: readonly SupportPathPoint[],
  distanceM: number,
): SupportPathPoint {
  const maximumDistance = points[points.length - 1].distanceM
  const distance = THREE.MathUtils.clamp(distanceM, 0, maximumDistance)
  let high = points.length - 1
  let low = 0
  while (low + 1 < high) {
    const middle = (low + high) >> 1
    if (points[middle].distanceM <= distance) low = middle
    else high = middle
  }
  const start = points[low]
  const end = points[Math.min(low + 1, points.length - 1)]
  const interval = Math.max(1e-9, end.distanceM - start.distanceM)
  const amount = THREE.MathUtils.clamp((distance - start.distanceM) / interval, 0, 1)
  return {
    x: THREE.MathUtils.lerp(start.x, end.x, amount),
    z: THREE.MathUtils.lerp(start.z, end.z, amount),
    rotY: shortestAngleLerp(start.rotY, end.rotY, amount),
    distanceM: distance,
  }
}

function rearOffsetPoint(
  point: Pick<SupportPathPoint, 'x' | 'z' | 'rotY'>,
  offsetM: number,
): ProfileOutlinePoint {
  return {
    x: point.x - Math.sin(point.rotY) * offsetM,
    z: point.z - Math.cos(point.rotY) * offsetM,
  }
}

function createCurvedProfileGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.name = 'LinarSupportCurvedProfileSharedGeometry'
  const positions = new Float32Array(MAX_CURVED_PROFILE_VERTEX_COUNT * 3)
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(
    new THREE.BufferAttribute(
      new Uint16Array(MAX_CURVED_PROFILE_INDEX_COUNT),
      1,
    ),
  )
  geometry.setDrawRange(0, 0)
  return geometry
}

function createCavityInfillGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.name = 'LinarSupportCavityInfillSweptGeometry'
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(MAX_CAVITY_VERTEX_COUNT * 3), 3),
  )
  geometry.setIndex(
    new THREE.BufferAttribute(new Uint16Array(MAX_CAVITY_INDEX_COUNT), 1),
  )
  geometry.setDrawRange(0, 0)
  return geometry
}

type ProfileOutlinePoint = {
  x: number
  z: number
}

function updateCurvedProfileGeometry(
  geometry: THREE.BufferGeometry,
  points: readonly SupportPathPoint[],
  rearSurfaceOffsetM: number,
): number {
  if (points.length < 2) {
    geometry.setDrawRange(0, 0)
    return 0
  }
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const geometryIndex = geometry.index
  if (!geometryIndex) return 0
  // Build one simple cross-section rather than projecting every path segment
  // independently to the receiver plane. The old strip construction became
  // degenerate when a tight C/U bend had adjacent samples with the same X and
  // could expose missing faces or overlapping wedges in Top shape view.
  const outline: ProfileOutlinePoint[] = []
  const appendDistinct = (next: ProfileOutlinePoint) => {
    const previous = outline[outline.length - 1]
    if (
      previous &&
      (next.x - previous.x) ** 2 + (next.z - previous.z) ** 2 <=
        PROFILE_POINT_EPSILON_SQ
    ) {
      return
    }
    outline.push(next)
  }
  const panelFacingOffsetM = rearSurfaceOffsetM + SUPPORT_GRID_RENDER_GAP_M
  const hostFacingOffsetM = panelFacingOffsetM + BATTEN_DEPTH_M
  const frontOutline = points.map((point) =>
    rearOffsetPoint(point, panelFacingOffsetM),
  )
  for (const point of frontOutline) {
    appendDistinct(point)
  }

  // A profile rib is one compact solid member following the panel curve. It
  // must never be expanded into a filled sheet between the complete curve and
  // the receiver plane: at a tight C/U bend that construction looks like a
  // cabinet side rather than the repeated profile ribs in the client sample.
  // Offset the reverse edge by the reference batten depth along each sampled
  // local normal. The vertical rails use the same section, so all four outer
  // members meet as one restrained perimeter frame.
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index]
    appendDistinct(rearOffsetPoint(point, hostFacingOffsetM))
  }
  if (
    outline.length > 1 &&
    (outline[0].x - outline[outline.length - 1].x) ** 2 +
      (outline[0].z - outline[outline.length - 1].z) ** 2 <=
      PROFILE_POINT_EPSILON_SQ
  ) {
    outline.pop()
  }

  if (outline.length < 3) {
    geometry.setDrawRange(0, 0)
    return 0
  }

  const signedArea = outline.reduce((area, point, index) => {
    const next = outline[(index + 1) % outline.length]
    return area + point.x * next.z - next.x * point.z
  }, 0)
  if (signedArea < 0) outline.reverse()

  const topOffset = 0
  const bottomOffset = outline.length
  const sideOffset = outline.length * 2
  for (let index = 0; index < outline.length; index += 1) {
    const point = outline[index]
    const next = outline[(index + 1) % outline.length]
    position.setXYZ(topOffset + index, point.x, 0.5, point.z)
    position.setXYZ(bottomOffset + index, point.x, -0.5, point.z)
    const sideVertex = sideOffset + index * 4
    position.setXYZ(sideVertex, point.x, -0.5, point.z)
    position.setXYZ(sideVertex + 1, point.x, 0.5, point.z)
    position.setXYZ(sideVertex + 2, next.x, 0.5, next.z)
    position.setXYZ(sideVertex + 3, next.x, -0.5, next.z)
  }

  const faceTriangles = THREE.ShapeUtils.triangulateShape(
    outline.map((point) => new THREE.Vector2(point.x, point.z)),
    [],
  )
  let outputIndex = 0
  const writeTriangle = (a: number, b: number, c: number) => {
    geometryIndex.setX(outputIndex, a)
    geometryIndex.setX(outputIndex + 1, b)
    geometryIndex.setX(outputIndex + 2, c)
    outputIndex += 3
  }
  for (const [a, b, c] of faceTriangles) {
    const first = outline[a]
    const second = outline[b]
    const third = outline[c]
    const triangleArea =
      (second.x - first.x) * (third.z - first.z) -
      (second.z - first.z) * (third.x - first.x)
    if (Math.abs(triangleArea) <= PROFILE_POINT_EPSILON_SQ) continue
    // In X/Z coordinates, clockwise winding faces +Y.
    if (triangleArea < 0) {
      writeTriangle(topOffset + a, topOffset + b, topOffset + c)
      writeTriangle(bottomOffset + a, bottomOffset + c, bottomOffset + b)
    } else {
      writeTriangle(topOffset + a, topOffset + c, topOffset + b)
      writeTriangle(bottomOffset + a, bottomOffset + b, bottomOffset + c)
    }
  }
  for (let index = 0; index < outline.length; index += 1) {
    const sideVertex = sideOffset + index * 4
    writeTriangle(sideVertex, sideVertex + 1, sideVertex + 2)
    writeTriangle(sideVertex, sideVertex + 2, sideVertex + 3)
  }
  const activeIndexCount = outputIndex
  const activeVertexCount = sideOffset + outline.length * 4
  // BufferGeometry bounds inspect the whole fixed-capacity attribute rather
  // than drawRange. Collapse unused vertices onto a real active point so zero-
  // initialised capacity cannot enlarge or shift the support bounds.
  for (let vertex = activeVertexCount; vertex < position.count; vertex += 1) {
    position.setXYZ(vertex, outline[0].x, 0.5, outline[0].z)
  }
  while (outputIndex < geometryIndex.count) {
    geometryIndex.setX(outputIndex, 0)
    outputIndex += 1
  }
  position.needsUpdate = true
  geometryIndex.needsUpdate = true
  geometry.setDrawRange(0, activeIndexCount)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return points.length
}

/**
 * Return the exact path portion inside one timber bay. The interpolated bay
 * endpoints preserve the specified member clearance, while all original path
 * samples inside the interval keep tight C and S bends visually smooth.
 */
function pathIntervalPoints(
  points: readonly SupportPathPoint[],
  startDistanceM: number,
  endDistanceM: number,
): SupportPathPoint[] {
  const sampled = [pointAtPathDistance(points, startDistanceM)]
  for (const point of points) {
    if (
      point.distanceM > startDistanceM + PATH_DISTANCE_EPSILON_M &&
      point.distanceM < endDistanceM - PATH_DISTANCE_EPSILON_M
    ) {
      sampled.push(point)
    }
  }
  sampled.push(pointAtPathDistance(points, endDistanceM))
  return sampled
}

/**
 * Build every pathwise wool bay as one closed swept solid. Earlier revisions
 * approximated the same volume with independent 22 mm boxes. Their front
 * chord endpoints nearly met, but their differently rotated rear faces opened
 * into millimetre-scale diagonal cuts on tight bends. A single outline per bay
 * shares every internal curve sample and creates end caps only where the wool
 * actually meets a longitudinal timber member.
 */
function updateCavityInfillGeometry(
  geometry: THREE.BufferGeometry,
  points: readonly SupportPathPoint[],
  pathSupportPositionsM: readonly number[],
  panelFacingOffsetM: number,
  frontRecessM: number,
  infillDepthM: number,
  memberClearanceM: number,
): number {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const geometryIndex = geometry.index
  if (!geometryIndex || points.length < 2 || pathSupportPositionsM.length < 2) {
    geometry.setDrawRange(0, 0)
    return 0
  }

  let vertexCursor = 0
  let indexCursor = 0
  let cellCount = 0
  let firstActivePoint: ProfileOutlinePoint | null = null
  const frontOffsetM = panelFacingOffsetM + frontRecessM
  const rearOffsetM = frontOffsetM + infillDepthM

  const writeTriangle = (a: number, b: number, c: number) => {
    if (indexCursor + 3 > geometryIndex.count) {
      throw new Error('LINAR support cavity-infill index capacity exceeded')
    }
    geometryIndex.setX(indexCursor, a)
    geometryIndex.setX(indexCursor + 1, b)
    geometryIndex.setX(indexCursor + 2, c)
    indexCursor += 3
  }

  for (let pathIndex = 1; pathIndex < pathSupportPositionsM.length; pathIndex += 1) {
    const cavityStartDistanceM =
      pathSupportPositionsM[pathIndex - 1] +
      BATTEN_WIDTH_M * 0.5 +
      memberClearanceM
    const cavityEndDistanceM =
      pathSupportPositionsM[pathIndex] -
      BATTEN_WIDTH_M * 0.5 -
      memberClearanceM
    if (cavityEndDistanceM - cavityStartDistanceM <= 0.001) continue

    const interval = pathIntervalPoints(
      points,
      cavityStartDistanceM,
      cavityEndDistanceM,
    )
    const outline: ProfileOutlinePoint[] = []
    const appendDistinct = (next: ProfileOutlinePoint) => {
      const previous = outline[outline.length - 1]
      if (
        previous &&
        (next.x - previous.x) ** 2 + (next.z - previous.z) ** 2 <=
          PROFILE_POINT_EPSILON_SQ
      ) {
        return
      }
      outline.push(next)
    }
    for (const point of interval) {
      appendDistinct(rearOffsetPoint(point, frontOffsetM))
    }
    for (let index = interval.length - 1; index >= 0; index -= 1) {
      appendDistinct(rearOffsetPoint(interval[index], rearOffsetM))
    }
    if (
      outline.length > 1 &&
      (outline[0].x - outline[outline.length - 1].x) ** 2 +
        (outline[0].z - outline[outline.length - 1].z) ** 2 <=
        PROFILE_POINT_EPSILON_SQ
    ) {
      outline.pop()
    }
    if (outline.length < 4) continue

    const signedArea = outline.reduce((area, point, index) => {
      const next = outline[(index + 1) % outline.length]
      return area + point.x * next.z - next.x * point.z
    }, 0)
    if (signedArea < 0) outline.reverse()

    const requiredVertices = outline.length * 6
    if (vertexCursor + requiredVertices > position.count) {
      throw new Error('LINAR support cavity-infill vertex capacity exceeded')
    }
    if (!firstActivePoint) firstActivePoint = outline[0]

    const topOffset = vertexCursor
    const bottomOffset = topOffset + outline.length
    const sideOffset = bottomOffset + outline.length
    for (let index = 0; index < outline.length; index += 1) {
      const point = outline[index]
      const next = outline[(index + 1) % outline.length]
      position.setXYZ(topOffset + index, point.x, 0.5, point.z)
      position.setXYZ(bottomOffset + index, point.x, -0.5, point.z)
      const sideVertex = sideOffset + index * 4
      position.setXYZ(sideVertex, point.x, -0.5, point.z)
      position.setXYZ(sideVertex + 1, point.x, 0.5, point.z)
      position.setXYZ(sideVertex + 2, next.x, 0.5, next.z)
      position.setXYZ(sideVertex + 3, next.x, -0.5, next.z)
    }

    const faceTriangles = THREE.ShapeUtils.triangulateShape(
      outline.map((point) => new THREE.Vector2(point.x, point.z)),
      [],
    )
    for (const [a, b, c] of faceTriangles) {
      const first = outline[a]
      const second = outline[b]
      const third = outline[c]
      const triangleArea =
        (second.x - first.x) * (third.z - first.z) -
        (second.z - first.z) * (third.x - first.x)
      if (Math.abs(triangleArea) <= PROFILE_POINT_EPSILON_SQ) continue
      if (triangleArea < 0) {
        writeTriangle(topOffset + a, topOffset + b, topOffset + c)
        writeTriangle(bottomOffset + a, bottomOffset + c, bottomOffset + b)
      } else {
        writeTriangle(topOffset + a, topOffset + c, topOffset + b)
        writeTriangle(bottomOffset + a, bottomOffset + b, bottomOffset + c)
      }
    }
    for (let index = 0; index < outline.length; index += 1) {
      const sideVertex = sideOffset + index * 4
      writeTriangle(sideVertex, sideVertex + 1, sideVertex + 2)
      writeTriangle(sideVertex, sideVertex + 2, sideVertex + 3)
    }
    vertexCursor += requiredVertices
    cellCount += 1
  }

  if (!firstActivePoint || cellCount === 0) {
    geometry.setDrawRange(0, 0)
    return 0
  }
  const activeIndexCount = indexCursor
  for (let vertex = vertexCursor; vertex < position.count; vertex += 1) {
    position.setXYZ(vertex, firstActivePoint.x, 0.5, firstActivePoint.z)
  }
  while (indexCursor < geometryIndex.count) {
    geometryIndex.setX(indexCursor, 0)
    indexCursor += 1
  }
  position.needsUpdate = true
  geometryIndex.needsUpdate = true
  geometry.setDrawRange(0, activeIndexCount)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return cellCount
}

/**
 * One coherent rear support lattice shared by the complete repeated
 * installation. Flat panels retain a conventional planar grid. A bent or
 * compound installation uses continuous profile ribs following its complete
 * tangent-connected path, plus longitudinal battens positioned by distance
 * along that path. Module seams are mandatory anchors but never restart the
 * structure. Meshes, geometry and material are allocated once; state changes
 * update only instance matrices and the shared curved-profile vertex buffer.
 */
export function createLinarSupportGrid(): LinarSupportGrid {
  const group = new THREE.Group()
  group.name = 'LinarSupportGrid'
  group.visible = false

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  geometry.name = 'LinarSupportBattenSharedGeometry'
  const material = new THREE.MeshStandardMaterial({
    name: 'LinarSupportBattenSharedMaterial',
    color: 0x5b4c3c,
    roughness: 0.92,
    metalness: 0,
  })

  const verticalBattens = new THREE.InstancedMesh(
    geometry,
    material,
    MAX_INSTANCES_PER_AXIS,
  )
  verticalBattens.name = 'LinarSupportVerticalBattens'
  verticalBattens.count = 0
  verticalBattens.castShadow = true
  verticalBattens.receiveShadow = true
  verticalBattens.frustumCulled = false
  group.add(verticalBattens)

  const horizontalBattens = new THREE.InstancedMesh(
    geometry,
    material,
    MAX_INSTANCES_PER_AXIS,
  )
  horizontalBattens.name = 'LinarSupportHorizontalBattens'
  horizontalBattens.count = 0
  horizontalBattens.castShadow = true
  horizontalBattens.receiveShadow = true
  horizontalBattens.frustumCulled = false
  group.add(horizontalBattens)

  const curvedProfileGeometry = createCurvedProfileGeometry()
  const curvedProfileBattens = new THREE.InstancedMesh(
    curvedProfileGeometry,
    material,
    MAX_INSTANCES_PER_AXIS,
  )
  curvedProfileBattens.name = 'LinarSupportContinuousCurvedProfileRibs'
  curvedProfileBattens.count = 0
  curvedProfileBattens.castShadow = true
  curvedProfileBattens.receiveShadow = true
  curvedProfileBattens.frustumCulled = false
  group.add(curvedProfileBattens)

  const cavityInfillMaterial = new THREE.MeshStandardMaterial({
    name: 'LinarSupportCavityInfillMaterial',
    color: 0xdedbd1,
    roughness: 1,
    metalness: 0,
  })
  const cavityInfillGeometry = createCavityInfillGeometry()
  const cavityInfill = new THREE.InstancedMesh(
    cavityInfillGeometry,
    cavityInfillMaterial,
    MAX_INSTANCES_PER_AXIS,
  )
  cavityInfill.name = SUPPORT_GRID_CAVITY_INFILL_OBJECT_NAME
  cavityInfill.count = 0
  cavityInfill.castShadow = true
  cavityInfill.receiveShadow = true
  cavityInfill.frustumCulled = false
  cavityInfill.visible = false
  group.add(cavityInfill)

  // Keep the real perimeter independent from the interior lattice. The four
  // outer members and the internal construction stay individually inspectable
  // when the optional cavity infill is present; no member becomes a solid
  // wall-to-panel wing.
  const outerFrame = new THREE.Group()
  outerFrame.name = 'LinarSupportOuterPerimeterFrames'
  outerFrame.visible = false

  const outerVerticalRails = new THREE.InstancedMesh(
    geometry,
    material,
    2,
  )
  outerVerticalRails.name = 'LinarSupportOuterVerticalRails'
  outerVerticalRails.count = 0
  outerVerticalRails.castShadow = true
  outerVerticalRails.receiveShadow = true
  outerVerticalRails.frustumCulled = false
  outerFrame.add(outerVerticalRails)

  const outerFlatProfileRibs = new THREE.InstancedMesh(
    geometry,
    material,
    2,
  )
  outerFlatProfileRibs.name = 'LinarSupportOuterFlatProfileRibs'
  outerFlatProfileRibs.count = 0
  outerFlatProfileRibs.castShadow = true
  outerFlatProfileRibs.receiveShadow = true
  outerFlatProfileRibs.frustumCulled = false
  outerFrame.add(outerFlatProfileRibs)

  const outerCurvedProfileRibs = new THREE.InstancedMesh(
    curvedProfileGeometry,
    material,
    2,
  )
  outerCurvedProfileRibs.name = 'LinarSupportOuterCurvedProfileRibs'
  outerCurvedProfileRibs.count = 0
  outerCurvedProfileRibs.castShadow = true
  outerCurvedProfileRibs.receiveShadow = true
  outerCurvedProfileRibs.frustumCulled = false
  outerFrame.add(outerCurvedProfileRibs)
  group.add(outerFrame)

  const transform = new THREE.Object3D()
  let lastUpdateKey = ''
  let stats = emptyStats()
  let internalMembersVisible = true
  let cavityInfillEnabled = false
  let disposed = false

  const setInternalMembersVisible = (visible: boolean) => {
    if (disposed) return
    internalMembersVisible = visible
    verticalBattens.visible = internalMembersVisible
    horizontalBattens.visible = internalMembersVisible
    curvedProfileBattens.visible = internalMembersVisible
  }

  const setCavityInfill = (
    visible: boolean,
    colour: THREE.ColorRepresentation,
  ) => {
    if (disposed) return
    if (cavityInfillEnabled !== visible) {
      cavityInfillEnabled = visible
      lastUpdateKey = ''
    }
    cavityInfillMaterial.color.set(colour)
    cavityInfillMaterial.needsUpdate = true
    cavityInfill.visible = cavityInfillEnabled && group.visible
  }

  const update = ({ application, panelCount, bounds }: SupportGridUpdate) => {
    if (disposed) return stats
    const mounted = application === 'wall' || application === 'ceiling'
    const minX = finite(bounds.minX, -0.6)
    const maxX = finite(bounds.maxX, 0.6)
    const heightM = Math.max(0.04, finite(bounds.heightM, 2.8))
    const rearSurfaceOffsetM = Math.max(
      0,
      finite(bounds.rearSurfaceOffsetM ?? 0, 0),
    )
    const seamXM = (bounds.seamXM ?? []).filter(Number.isFinite)
    const supportPath = validSupportPath(bounds.supportPathXZ)
    const seamPathDistancesM = (bounds.seamPathDistancesM ?? []).filter(
      Number.isFinite,
    )
    const curved = mounted && pathIsCurved(supportPath)
    const nextKey = mounted
      ? `${application}:${Math.max(1, Math.round(panelCount))}:${quantizedKey(
          minX,
        )}:${quantizedKey(maxX)}:${quantizedKey(heightM)}:${seamXM
          .map(quantizedKey)
          .join(',')}:${quantizedKey(rearSurfaceOffsetM)}:${
          curved ? pathKey(supportPath) : 'planar'
        }:${seamPathDistancesM
          .map(quantizedKey)
          .join(',')}:${cavityInfillEnabled ? 1 : 0}`
      : 'freestanding'

    if (nextKey === lastUpdateKey) return stats
    lastUpdateKey = nextKey

    if (!mounted) {
      group.visible = false
      verticalBattens.count = 0
      horizontalBattens.count = 0
      curvedProfileBattens.count = 0
      cavityInfill.count = 0
      cavityInfillGeometry.setDrawRange(0, 0)
      cavityInfill.visible = false
      outerVerticalRails.count = 0
      outerFlatProfileRibs.count = 0
      outerCurvedProfileRibs.count = 0
      outerFrame.visible = false
      stats = emptyStats()
      return stats
    }

    const horizontalPositions = supportPositions(0, heightM)
    const maximumPathDistance = supportPath[supportPath.length - 1]?.distanceM ?? 0
    // Flat and curved states use the same physical centreline endpoints. The
    // panel AABB is deliberately padded for rendering/camera fit and must not
    // become the construction width when the curve happens to be planar.
    const planarMinX = supportPath.length
      ? Math.min(...supportPath.map((point) => point.x))
      : minX
    const planarMaxX = supportPath.length
      ? Math.max(...supportPath.map((point) => point.x))
      : maxX
    const verticalPositions = curved
      ? supportPositions(0, maximumPathDistance, seamPathDistancesM)
      : supportPositions(planarMinX, planarMaxX, seamXM)
    const internalVerticalPositions = verticalPositions.slice(1, -1)
    const internalHorizontalPositions = horizontalPositions.slice(1, -1)
    // Longitudinal members butt into the two 40 mm profile ribs instead of
    // passing through them. Besides matching a fabricated open frame, this
    // prevents their end faces from appearing as wedges outside the smooth
    // profile in Top shape inspection.
    const longitudinalMemberHeightM = Math.max(
      0.001,
      heightM - BATTEN_WIDTH_M * 2,
    )
    if (
      verticalPositions.length > MAX_INSTANCES_PER_AXIS ||
      horizontalPositions.length > MAX_INSTANCES_PER_AXIS
    ) {
      throw new Error('LINAR support-grid instance capacity exceeded')
    }

    verticalBattens.count = internalVerticalPositions.length
    const panelFacingOffsetM = rearSurfaceOffsetM + SUPPORT_GRID_RENDER_GAP_M
    for (let index = 0; index < internalVerticalPositions.length; index += 1) {
      if (curved) {
        const point = pointAtPathDistance(
          supportPath,
          internalVerticalPositions[index],
        )
        const normalX = Math.sin(point.rotY)
        const normalZ = Math.cos(point.rotY)
        transform.position.set(
          point.x - normalX * (panelFacingOffsetM + BATTEN_DEPTH_M * 0.5),
          heightM * 0.5,
          point.z - normalZ * (panelFacingOffsetM + BATTEN_DEPTH_M * 0.5),
        )
        transform.rotation.set(0, point.rotY, 0)
      } else {
        transform.position.set(
          internalVerticalPositions[index],
          heightM * 0.5,
          -panelFacingOffsetM - BATTEN_DEPTH_M * 0.5,
        )
        transform.rotation.set(0, 0, 0)
      }
      transform.scale.set(
        BATTEN_WIDTH_M,
        longitudinalMemberHeightM,
        BATTEN_DEPTH_M,
      )
      transform.updateMatrix()
      verticalBattens.setMatrixAt(index, transform.matrix)
    }
    verticalBattens.instanceMatrix.needsUpdate = true

    cavityInfill.count = 0
    cavityInfillGeometry.setDrawRange(0, 0)
    cavityInfill.visible = false
    if (cavityInfillEnabled && supportPath.length >= 2 && maximumPathDistance > 0) {
      const pathSupportPositions = supportPositions(
        0,
        maximumPathDistance,
        seamPathDistancesM,
      )
      const memberClearanceM =
        SUPPORT_GRID_CAVITY_INFILL_VISUAL.memberClearanceMm / 1000
      const frontRecessM = SUPPORT_GRID_CAVITY_INFILL_VISUAL.frontRecessMm / 1000
      const rearRevealM = SUPPORT_GRID_CAVITY_INFILL_VISUAL.rearRevealMm / 1000
      const infillDepthM = Math.max(
        0.001,
        BATTEN_DEPTH_M - frontRecessM - rearRevealM,
      )
      const pathCellCount = updateCavityInfillGeometry(
        cavityInfillGeometry,
        supportPath,
        pathSupportPositions,
        panelFacingOffsetM,
        frontRecessM,
        infillDepthM,
        memberClearanceM,
      )
      let rowIndex = 0

      for (let yIndex = 1; yIndex < horizontalPositions.length; yIndex += 1) {
        const yStart =
          horizontalPositions[yIndex - 1] + BATTEN_WIDTH_M * 0.5 + memberClearanceM
        const yEnd =
          horizontalPositions[yIndex] - BATTEN_WIDTH_M * 0.5 - memberClearanceM
        const infillHeightM = yEnd - yStart
        if (infillHeightM <= 0.001) continue
        if (rowIndex >= MAX_INSTANCES_PER_AXIS) {
          throw new Error('LINAR support cavity-infill row capacity exceeded')
        }
        transform.position.set(0, (yStart + yEnd) * 0.5, 0)
        transform.rotation.set(0, 0, 0)
        transform.scale.set(1, infillHeightM, 1)
        transform.updateMatrix()
        cavityInfill.setMatrixAt(rowIndex, transform.matrix)
        rowIndex += 1
      }
      cavityInfill.count = pathCellCount > 0 ? rowIndex : 0
      cavityInfill.instanceMatrix.needsUpdate = true
      cavityInfill.visible = cavityInfill.count > 0
    }

    // The two global endpoint members are narrow closed rails, not cavity-
    // filling side sheets. Sample each real terminal 40 mm path cell so a
    // near-vertical or folded endpoint cannot create a tangent wedge.
    outerVerticalRails.count = 2
    const outerRailHeightM = longitudinalMemberHeightM
    const outerRailDepthM = BATTEN_DEPTH_M
    if (curved) {
      const terminalSpanM = Math.min(BATTEN_WIDTH_M, maximumPathDistance * 0.5)
      const terminalPairs = [
        [
          pointAtPathDistance(supportPath, 0),
          pointAtPathDistance(supportPath, terminalSpanM),
        ],
        [
          pointAtPathDistance(supportPath, maximumPathDistance - terminalSpanM),
          pointAtPathDistance(supportPath, maximumPathDistance),
        ],
      ] as const
      for (let index = 0; index < terminalPairs.length; index += 1) {
        const [start, end] = terminalPairs[index]
        const frontStart = rearOffsetPoint(start, panelFacingOffsetM)
        const frontEnd = rearOffsetPoint(end, panelFacingOffsetM)
        const chordX = frontEnd.x - frontStart.x
        const chordZ = frontEnd.z - frontStart.z
        const chordLengthM = Math.max(0.001, Math.hypot(chordX, chordZ))
        const rotationY = Math.atan2(-chordZ, chordX)
        const normalX = Math.sin(rotationY)
        const normalZ = Math.cos(rotationY)
        const frontMidpointX = (frontStart.x + frontEnd.x) * 0.5
        const frontMidpointZ = (frontStart.z + frontEnd.z) * 0.5
        transform.position.set(
          frontMidpointX - normalX * outerRailDepthM * 0.5,
          heightM * 0.5,
          frontMidpointZ - normalZ * outerRailDepthM * 0.5,
        )
        transform.rotation.set(0, rotationY, 0)
        transform.scale.set(
          chordLengthM,
          outerRailHeightM,
          outerRailDepthM,
        )
        transform.updateMatrix()
        outerVerticalRails.setMatrixAt(index, transform.matrix)
      }
    } else {
      const installationWidthM = Math.max(
        0.001,
        Math.abs(planarMaxX - planarMinX),
      )
      const outerRailWidthM = Math.min(BATTEN_WIDTH_M, installationWidthM * 0.5)
      const outerRailPositions = [
        planarMinX + outerRailWidthM * 0.5,
        planarMaxX - outerRailWidthM * 0.5,
      ]
      for (let index = 0; index < outerRailPositions.length; index += 1) {
        transform.position.set(
          outerRailPositions[index],
          heightM * 0.5,
          -panelFacingOffsetM - outerRailDepthM * 0.5,
        )
        transform.rotation.set(0, 0, 0)
        transform.scale.set(
          outerRailWidthM,
          outerRailHeightM,
          outerRailDepthM,
        )
        transform.updateMatrix()
        outerVerticalRails.setMatrixAt(index, transform.matrix)
      }
    }
    outerVerticalRails.instanceMatrix.needsUpdate = true

    if (curved) {
      horizontalBattens.count = 0
      outerFlatProfileRibs.count = 0
      updateCurvedProfileGeometry(
        curvedProfileGeometry,
        supportPath,
        rearSurfaceOffsetM,
      )
      curvedProfileBattens.count = internalHorizontalPositions.length
      for (let index = 0; index < internalHorizontalPositions.length; index += 1) {
        transform.position.set(0, internalHorizontalPositions[index], 0)
        transform.rotation.set(0, 0, 0)
        transform.scale.set(1, BATTEN_WIDTH_M, 1)
        transform.updateMatrix()
        curvedProfileBattens.setMatrixAt(index, transform.matrix)
      }
      curvedProfileBattens.instanceMatrix.needsUpdate = true
      outerCurvedProfileRibs.count = 2
      for (let index = 0; index < 2; index += 1) {
        transform.position.set(
          0,
          index === 0 ? BATTEN_WIDTH_M * 0.5 : heightM - BATTEN_WIDTH_M * 0.5,
          0,
        )
        transform.rotation.set(0, 0, 0)
        transform.scale.set(1, BATTEN_WIDTH_M, 1)
        transform.updateMatrix()
        outerCurvedProfileRibs.setMatrixAt(index, transform.matrix)
      }
      outerCurvedProfileRibs.instanceMatrix.needsUpdate = true
    } else {
      curvedProfileBattens.count = 0
      outerCurvedProfileRibs.count = 0
      const centreX = (planarMinX + planarMaxX) * 0.5
      const widthM = Math.max(
        BATTEN_WIDTH_M,
        Math.abs(planarMaxX - planarMinX),
      )
      const horizontalCentreZ = -panelFacingOffsetM - BATTEN_DEPTH_M * 0.5
      horizontalBattens.count = internalHorizontalPositions.length
      for (let index = 0; index < internalHorizontalPositions.length; index += 1) {
        transform.position.set(
          centreX,
          internalHorizontalPositions[index],
          horizontalCentreZ,
        )
        transform.rotation.set(0, 0, 0)
        transform.scale.set(widthM, BATTEN_WIDTH_M, BATTEN_DEPTH_M)
        transform.updateMatrix()
        horizontalBattens.setMatrixAt(index, transform.matrix)
      }
      horizontalBattens.instanceMatrix.needsUpdate = true
      outerFlatProfileRibs.count = 2
      for (let index = 0; index < 2; index += 1) {
        transform.position.set(
          centreX,
          index === 0 ? BATTEN_WIDTH_M * 0.5 : heightM - BATTEN_WIDTH_M * 0.5,
          horizontalCentreZ,
        )
        transform.rotation.set(0, 0, 0)
        transform.scale.set(widthM, BATTEN_WIDTH_M, BATTEN_DEPTH_M)
        transform.updateMatrix()
        outerFlatProfileRibs.setMatrixAt(index, transform.matrix)
      }
      outerFlatProfileRibs.instanceMatrix.needsUpdate = true
    }

    outerFrame.visible = true
    group.visible = true
    cavityInfill.visible = cavityInfillEnabled && cavityInfill.count > 0
    stats = {
      verticalBattens: internalVerticalPositions.length,
      horizontalBattens: internalHorizontalPositions.length,
      outerFrameMembers: OUTER_FRAME_MEMBER_COUNT,
      totalInstances:
        internalVerticalPositions.length +
        internalHorizontalPositions.length +
        OUTER_FRAME_MEMBER_COUNT,
      visible: true,
    }
    return stats
  }

  return {
    group,
    update,
    setInternalMembersVisible,
    setCavityInfill,
    getStats: () => stats,
    dispose: () => {
      if (disposed) return
      disposed = true
      group.clear()
      geometry.dispose()
      curvedProfileGeometry.dispose()
      cavityInfillGeometry.dispose()
      material.dispose()
      cavityInfillMaterial.dispose()
      stats = emptyStats()
      lastUpdateKey = ''
    },
  }
}
