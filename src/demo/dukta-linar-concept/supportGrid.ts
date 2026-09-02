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
  getStats: () => SupportGridStats
  dispose: () => void
}

const BATTEN_WIDTH_M = SUPPORT_GRID_REFERENCE.battenWidthMm / 1000
const BATTEN_DEPTH_M = SUPPORT_GRID_REFERENCE.battenDepthMm / 1000
const MAXIMUM_SPACING_M = SUPPORT_GRID_REFERENCE.maximumSpacingMm / 1000
const BOUNDS_KEY_QUANTUM_M = 0.005
const ANCHOR_DEDUPLICATION_M = BATTEN_WIDTH_M * 1.1
const SPACING_ROUNDING_TOLERANCE_M = 1e-9
const MAX_INSTANCES_PER_AXIS = 64
const MAX_SUPPORT_PATH_POINTS = 257
const CURVED_PATH_DEPTH_THRESHOLD_M = 0.003
const CURVED_PATH_TURN_THRESHOLD_RAD = THREE.MathUtils.degToRad(0.75)
const PATH_ROTATION_KEY_QUANTUM_RAD = THREE.MathUtils.degToRad(0.5)
const CURVED_PROFILE_RECEIVER_CLEARANCE_M = 0.001
const OUTER_FRAME_MEMBER_COUNT = 4
const OUTER_END_CAP_TRIANGLE_COUNT = 12
const CURVED_PROFILE_INDICES_PER_SEGMENT = 24
const CURVED_PROFILE_END_CAP_INDEX_COUNT = 12
const CURVED_PROFILE_SEGMENT_INDEX_PATTERN = Object.freeze([
  0, 4, 5, 0, 5, 1,
  2, 3, 7, 2, 7, 6,
  0, 2, 6, 0, 6, 4,
  1, 5, 7, 1, 7, 3,
])

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

function createCurvedProfileGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.name = 'LinarSupportCurvedProfileSharedGeometry'
  const positions = new Float32Array(MAX_SUPPORT_PATH_POINTS * 4 * 3)
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  // The active index range is rewritten when the path changes so both end
  // faces can remain closed with a variable number of sampled segments.
  geometry.setIndex(
    new THREE.BufferAttribute(
      new Uint16Array(
        (MAX_SUPPORT_PATH_POINTS - 1) * CURVED_PROFILE_INDICES_PER_SEGMENT +
          CURVED_PROFILE_END_CAP_INDEX_COUNT,
      ),
      1,
    ),
  )
  geometry.setDrawRange(0, 0)
  return geometry
}

function updateCurvedProfileGeometry(
  geometry: THREE.BufferGeometry,
  points: readonly SupportPathPoint[],
): number {
  if (points.length < 2) {
    geometry.setDrawRange(0, 0)
    return 0
  }
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const geometryIndex = geometry.index
  if (!geometryIndex) return 0
  const pathMinZ = points.reduce((minimum, point) => Math.min(minimum, point.z), Infinity)
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    // The photograph shows shaped profile ribs fixed to one receiver plane:
    // their room-facing contour follows the complete applied installation,
    // while the rear edge stays flat against the host. This avoids a constant-
    // depth ribbon floating away from the wall/ceiling at every curve valley.
    const frontX = point.x
    const frontZ = point.z - pathMinZ + BATTEN_DEPTH_M
    const backX = frontX
    const backZ = CURVED_PROFILE_RECEIVER_CLEARANCE_M
    const vertex = index * 4
    position.setXYZ(vertex, frontX, -0.5, frontZ)
    position.setXYZ(vertex + 1, frontX, 0.5, frontZ)
    position.setXYZ(vertex + 2, backX, -0.5, backZ)
    position.setXYZ(vertex + 3, backX, 0.5, backZ)
  }
  position.needsUpdate = true
  let outputIndex = 0
  for (let segment = 0; segment < points.length - 1; segment += 1) {
    const vertexOffset = segment * 4
    for (const relativeIndex of CURVED_PROFILE_SEGMENT_INDEX_PATTERN) {
      geometryIndex.setX(outputIndex, vertexOffset + relativeIndex)
      outputIndex += 1
    }
  }
  // Start cap faces outward along the negative path direction.
  for (const value of [0, 1, 3, 0, 3, 2]) {
    geometryIndex.setX(outputIndex, value)
    outputIndex += 1
  }
  // End cap faces outward along the positive path direction.
  const endVertex = (points.length - 1) * 4
  for (const value of [0, 2, 3, 0, 3, 1]) {
    geometryIndex.setX(outputIndex, endVertex + value)
    outputIndex += 1
  }
  const activeIndexCount = outputIndex
  // BufferGeometry.computeVertexNormals() visits the complete index buffer,
  // not only drawRange. Clear the inactive tail so a long-to-short path update
  // cannot leak stale triangles into the new endpoint normals.
  while (outputIndex < geometryIndex.count) {
    geometryIndex.setX(outputIndex, 0)
    outputIndex += 1
  }
  geometryIndex.needsUpdate = true
  geometry.setDrawRange(0, activeIndexCount)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return points.length
}

type EndCapOutlinePoint = {
  x: number
  z: number
}

function createOuterEndCapGeometry(name: string): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.name = name
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array(OUTER_END_CAP_TRIANGLE_COUNT * 3 * 3),
      3,
    ),
  )
  geometry.setDrawRange(0, 0)
  return geometry
}

function clearOuterEndCapGeometry(geometry: THREE.BufferGeometry): void {
  geometry.setDrawRange(0, 0)
  geometry.boundingBox = null
  geometry.boundingSphere = null
}

/**
 * Close one global installation end with a watertight, full-height solid.
 * The four-point outline covers only one 40 mm path cell between the shaped
 * room-facing contour and the flat receiver plane. The complete support
 * interior remains an open rib-and-batten structure.
 */
function updateOuterEndCapGeometry(
  geometry: THREE.BufferGeometry,
  outlinePoints: readonly EndCapOutlinePoint[],
  minimumY: number,
  maximumY: number,
): void {
  if (outlinePoints.length !== 4 || maximumY - minimumY < 0.001) {
    clearOuterEndCapGeometry(geometry)
    return
  }

  let outline = outlinePoints.map((point) => ({ ...point }))
  const signedArea = outline.reduce((area, point, index) => {
    const next = outline[(index + 1) % outline.length]
    return area + point.x * next.z - next.x * point.z
  }, 0)
  // Clockwise in X/Z gives the top face a +Y normal.
  if (signedArea > 0) outline = outline.reverse()

  const triangleArea = (
    first: EndCapOutlinePoint,
    second: EndCapOutlinePoint,
    third: EndCapOutlinePoint,
  ) => Math.abs(
    (second.x - first.x) * (third.z - first.z) -
      (second.z - first.z) * (third.x - first.x),
  )
  const diagonalZeroTwoScore = Math.min(
    triangleArea(outline[0], outline[1], outline[2]),
    triangleArea(outline[0], outline[2], outline[3]),
  )
  const diagonalOneThreeScore = Math.min(
    triangleArea(outline[0], outline[1], outline[3]),
    triangleArea(outline[1], outline[2], outline[3]),
  )
  const topTriangles = diagonalZeroTwoScore >= diagonalOneThreeScore
    ? [[0, 1, 2], [0, 2, 3]]
    : [[0, 1, 3], [1, 2, 3]]

  const positions = geometry.getAttribute('position') as THREE.BufferAttribute
  let outputVertex = 0
  const writeTriangle = (
    first: EndCapOutlinePoint,
    firstY: number,
    second: EndCapOutlinePoint,
    secondY: number,
    third: EndCapOutlinePoint,
    thirdY: number,
  ) => {
    positions.setXYZ(outputVertex, first.x, firstY, first.z)
    positions.setXYZ(outputVertex + 1, second.x, secondY, second.z)
    positions.setXYZ(outputVertex + 2, third.x, thirdY, third.z)
    outputVertex += 3
  }

  // Top and bottom caps.
  for (const [first, second, third] of topTriangles) {
    writeTriangle(
      outline[first],
      maximumY,
      outline[second],
      maximumY,
      outline[third],
      maximumY,
    )
    writeTriangle(
      outline[first],
      minimumY,
      outline[third],
      minimumY,
      outline[second],
      minimumY,
    )
  }

  // Four closed side walls. The clockwise outline keeps each normal facing
  // away from the solid, including the surface visible from inside the cavity.
  for (let index = 0; index < outline.length; index += 1) {
    const next = (index + 1) % outline.length
    writeTriangle(
      outline[index],
      minimumY,
      outline[next],
      minimumY,
      outline[next],
      maximumY,
    )
    writeTriangle(
      outline[index],
      minimumY,
      outline[next],
      maximumY,
      outline[index],
      maximumY,
    )
  }

  positions.needsUpdate = true
  geometry.setDrawRange(0, outputVertex)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
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

  // Keep the real perimeter independent from the interior lattice. Opaque
  // wool felt can therefore hide internal supports while retaining a readable
  // four-member outer frame: two solid global end caps and two transverse
  // profile ribs. Each cap occupies only its terminal 40 mm path cell; the
  // support cavity remains open everywhere else.
  const outerFrame = new THREE.Group()
  outerFrame.name = 'LinarSupportOuterPerimeterFrames'
  outerFrame.visible = false

  const outerEndCaps = new THREE.Group()
  outerEndCaps.name = 'LinarSupportOuterEndCaps'
  outerEndCaps.visible = false
  const outerEndCapGeometries = [
    createOuterEndCapGeometry('LinarSupportOuterStartEndCapGeometry'),
    createOuterEndCapGeometry('LinarSupportOuterFinishEndCapGeometry'),
  ]
  outerEndCapGeometries.forEach((endCapGeometry, index) => {
    const mesh = new THREE.Mesh(endCapGeometry, material)
    mesh.name = index === 0
      ? 'LinarSupportOuterStartEndCap'
      : 'LinarSupportOuterFinishEndCap'
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    outerEndCaps.add(mesh)
  })
  outerFrame.add(outerEndCaps)

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
  let disposed = false

  const setInternalMembersVisible = (visible: boolean) => {
    if (disposed) return
    internalMembersVisible = visible
    verticalBattens.visible = internalMembersVisible
    horizontalBattens.visible = internalMembersVisible
    curvedProfileBattens.visible = internalMembersVisible
  }

  const update = ({ application, panelCount, bounds }: SupportGridUpdate) => {
    if (disposed) return stats
    const mounted = application === 'wall' || application === 'ceiling'
    const minX = finite(bounds.minX, -0.6)
    const maxX = finite(bounds.maxX, 0.6)
    const heightM = Math.max(0.04, finite(bounds.heightM, 2.8))
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
          .join(',')}:${curved ? pathKey(supportPath) : 'planar'}:${seamPathDistancesM
          .map(quantizedKey)
          .join(',')}`
      : 'freestanding'

    if (nextKey === lastUpdateKey) return stats
    lastUpdateKey = nextKey

    if (!mounted) {
      group.visible = false
      verticalBattens.count = 0
      horizontalBattens.count = 0
      curvedProfileBattens.count = 0
      outerEndCaps.visible = false
      for (const endCapGeometry of outerEndCapGeometries) {
        clearOuterEndCapGeometry(endCapGeometry)
      }
      outerFlatProfileRibs.count = 0
      outerCurvedProfileRibs.count = 0
      outerFrame.visible = false
      stats = emptyStats()
      return stats
    }

    const horizontalPositions = supportPositions(0, heightM)
    const maximumPathDistance = supportPath[supportPath.length - 1]?.distanceM ?? 0
    const verticalPositions = curved
      ? supportPositions(0, maximumPathDistance, seamPathDistancesM)
      : supportPositions(minX, maxX, seamXM)
    const internalVerticalPositions = verticalPositions.slice(1, -1)
    const internalHorizontalPositions = horizontalPositions.slice(1, -1)
    if (
      verticalPositions.length > MAX_INSTANCES_PER_AXIS ||
      horizontalPositions.length > MAX_INSTANCES_PER_AXIS
    ) {
      throw new Error('LINAR support-grid instance capacity exceeded')
    }

    verticalBattens.count = internalVerticalPositions.length
    const pathMinZ = curved
      ? supportPath.reduce((minimum, point) => Math.min(minimum, point.z), Infinity)
      : 0
    for (let index = 0; index < internalVerticalPositions.length; index += 1) {
      if (curved) {
        const point = pointAtPathDistance(
          supportPath,
          internalVerticalPositions[index],
        )
        const normalX = Math.sin(point.rotY)
        const normalZ = Math.cos(point.rotY)
        const frontZ = point.z - pathMinZ + BATTEN_DEPTH_M
        transform.position.set(
          point.x - normalX * BATTEN_DEPTH_M * 0.5,
          heightM * 0.5,
          frontZ - normalZ * BATTEN_DEPTH_M * 0.5,
        )
        transform.rotation.set(0, point.rotY, 0)
      } else {
        transform.position.set(
          internalVerticalPositions[index],
          heightM * 0.5,
          BATTEN_DEPTH_M * 0.5,
        )
        transform.rotation.set(0, 0, 0)
      }
      transform.scale.set(BATTEN_WIDTH_M, heightM, BATTEN_DEPTH_M)
      transform.updateMatrix()
      verticalBattens.setMatrixAt(index, transform.matrix)
    }
    verticalBattens.instanceMatrix.needsUpdate = true

    // Close only the two global installation ends. Sampling one 40 mm cell
    // inward produces a real solid terminal plate without the oversized
    // tangent-extrapolated wings used by the earlier approximation.
    const minimumEndCapY = 0
    const maximumEndCapY = heightM
    if (curved) {
      const endCapPathSpanM = Math.min(
        BATTEN_WIDTH_M,
        maximumPathDistance * 0.5,
      )
      const endpointDistances = [0, maximumPathDistance]
      const innerDistances = [
        endCapPathSpanM,
        maximumPathDistance - endCapPathSpanM,
      ]
      for (let index = 0; index < outerEndCapGeometries.length; index += 1) {
        const endpoint = pointAtPathDistance(supportPath, endpointDistances[index])
        const innerPoint = pointAtPathDistance(supportPath, innerDistances[index])
        const oppositeEndpoint = supportPath[index === 0 ? supportPath.length - 1 : 0]
        const fallbackDirection = index === 0 ? 1 : -1
        const inwardXDirection =
          Math.sign(innerPoint.x - endpoint.x) ||
          Math.sign(oppositeEndpoint.x - endpoint.x) ||
          fallbackDirection
        const innerReceiverX = endpoint.x + inwardXDirection * endCapPathSpanM
        updateOuterEndCapGeometry(
          outerEndCapGeometries[index],
          [
            {
              x: endpoint.x,
              z: endpoint.z - pathMinZ + BATTEN_DEPTH_M,
            },
            {
              x: innerPoint.x,
              z: innerPoint.z - pathMinZ + BATTEN_DEPTH_M,
            },
            { x: innerReceiverX, z: CURVED_PROFILE_RECEIVER_CLEARANCE_M },
            { x: endpoint.x, z: CURVED_PROFILE_RECEIVER_CLEARANCE_M },
          ],
          minimumEndCapY,
          maximumEndCapY,
        )
      }
    } else {
      const installationWidthM = Math.max(0.001, Math.abs(maxX - minX))
      const endCapWidthM = Math.min(BATTEN_WIDTH_M, installationWidthM * 0.5)
      const outlines: readonly EndCapOutlinePoint[][] = [
        [
          { x: minX, z: BATTEN_DEPTH_M },
          { x: minX + endCapWidthM, z: BATTEN_DEPTH_M },
          { x: minX + endCapWidthM, z: CURVED_PROFILE_RECEIVER_CLEARANCE_M },
          { x: minX, z: CURVED_PROFILE_RECEIVER_CLEARANCE_M },
        ],
        [
          { x: maxX, z: BATTEN_DEPTH_M },
          { x: maxX - endCapWidthM, z: BATTEN_DEPTH_M },
          { x: maxX - endCapWidthM, z: CURVED_PROFILE_RECEIVER_CLEARANCE_M },
          { x: maxX, z: CURVED_PROFILE_RECEIVER_CLEARANCE_M },
        ],
      ]
      for (let index = 0; index < outerEndCapGeometries.length; index += 1) {
        updateOuterEndCapGeometry(
          outerEndCapGeometries[index],
          outlines[index],
          minimumEndCapY,
          maximumEndCapY,
        )
      }
    }
    outerEndCaps.visible = true

    if (curved) {
      horizontalBattens.count = 0
      outerFlatProfileRibs.count = 0
      updateCurvedProfileGeometry(curvedProfileGeometry, supportPath)
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
        transform.position.set(0, index === 0 ? 0 : heightM, 0)
        transform.rotation.set(0, 0, 0)
        transform.scale.set(1, BATTEN_WIDTH_M, 1)
        transform.updateMatrix()
        outerCurvedProfileRibs.setMatrixAt(index, transform.matrix)
      }
      outerCurvedProfileRibs.instanceMatrix.needsUpdate = true
    } else {
      curvedProfileBattens.count = 0
      outerCurvedProfileRibs.count = 0
      const centreX = (minX + maxX) * 0.5
      const widthM = Math.max(BATTEN_WIDTH_M, Math.abs(maxX - minX))
      // Horizontal members form the rear layer of the simple lattice. A 2 mm
      // setback prevents coincident front faces at every crossing.
      const horizontalCentreZ = BATTEN_DEPTH_M * 0.5 - 0.002
      // Unlike the recessed interior battens, the two perimeter ribs meet the
      // terminal caps exactly so the outer frame reads as one closed shell.
      const outerProfileDepthM =
        BATTEN_DEPTH_M - CURVED_PROFILE_RECEIVER_CLEARANCE_M
      const outerProfileCentreZ =
        CURVED_PROFILE_RECEIVER_CLEARANCE_M + outerProfileDepthM * 0.5
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
          index === 0 ? 0 : heightM,
          outerProfileCentreZ,
        )
        transform.rotation.set(0, 0, 0)
        transform.scale.set(widthM, BATTEN_WIDTH_M, outerProfileDepthM)
        transform.updateMatrix()
        outerFlatProfileRibs.setMatrixAt(index, transform.matrix)
      }
      outerFlatProfileRibs.instanceMatrix.needsUpdate = true
    }

    outerFrame.visible = true
    group.visible = true
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
    getStats: () => stats,
    dispose: () => {
      if (disposed) return
      disposed = true
      group.clear()
      geometry.dispose()
      curvedProfileGeometry.dispose()
      for (const endCapGeometry of outerEndCapGeometries) {
        endCapGeometry.dispose()
      }
      material.dispose()
      stats = emptyStats()
      lastUpdateKey = ''
    },
  }
}
