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
const MAX_CURVED_PROFILE_OUTLINE_POINTS = MAX_SUPPORT_PATH_POINTS + 2
const MAX_CURVED_PROFILE_VERTEX_COUNT = MAX_CURVED_PROFILE_OUTLINE_POINTS * 6
const MAX_CURVED_PROFILE_INDEX_COUNT = MAX_CURVED_PROFILE_OUTLINE_POINTS * 12 - 12
const PROFILE_POINT_EPSILON_SQ = 1e-12

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

type ProfileOutlinePoint = {
  x: number
  z: number
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
  const frontOutline = points.map((point) => ({
      x: point.x,
      z: point.z - pathMinZ + BATTEN_DEPTH_M,
  }))
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
  const profileDepthM =
    BATTEN_DEPTH_M - CURVED_PROFILE_RECEIVER_CLEARANCE_M
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index]
    const front = frontOutline[index]
    appendDistinct({
      x: front.x - Math.sin(point.rotY) * profileDepthM,
      z: front.z - Math.cos(point.rotY) * profileDepthM,
    })
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
  // four-member outer frame: two longitudinal edge rails and two transverse
  // profile ribs. No member fills the wall-to-panel cavity as a solid wing.
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
      outerVerticalRails.count = 0
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
      transform.scale.set(
        BATTEN_WIDTH_M,
        longitudinalMemberHeightM,
        BATTEN_DEPTH_M,
      )
      transform.updateMatrix()
      verticalBattens.setMatrixAt(index, transform.matrix)
    }
    verticalBattens.instanceMatrix.needsUpdate = true

    // The two global endpoint members are narrow closed rails, not cavity-
    // filling side sheets. Sample each real terminal 40 mm path cell so a
    // near-vertical or folded endpoint cannot create a tangent wedge.
    outerVerticalRails.count = 2
    const outerRailHeightM = longitudinalMemberHeightM
    const outerRailDepthM =
      BATTEN_DEPTH_M - CURVED_PROFILE_RECEIVER_CLEARANCE_M
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
        const chordX = end.x - start.x
        const chordZ = end.z - start.z
        const chordLengthM = Math.max(0.001, Math.hypot(chordX, chordZ))
        const rotationY = Math.atan2(-chordZ, chordX)
        const normalX = Math.sin(rotationY)
        const normalZ = Math.cos(rotationY)
        const frontMidpointX = (start.x + end.x) * 0.5
        const frontMidpointZ =
          (start.z + end.z) * 0.5 - pathMinZ + BATTEN_DEPTH_M
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
      const installationWidthM = Math.max(0.001, Math.abs(maxX - minX))
      const outerRailWidthM = Math.min(BATTEN_WIDTH_M, installationWidthM * 0.5)
      const outerRailPositions = [
        minX + outerRailWidthM * 0.5,
        maxX - outerRailWidthM * 0.5,
      ]
      for (let index = 0; index < outerRailPositions.length; index += 1) {
        transform.position.set(
          outerRailPositions[index],
          heightM * 0.5,
          CURVED_PROFILE_RECEIVER_CLEARANCE_M + outerRailDepthM * 0.5,
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
      const centreX = (minX + maxX) * 0.5
      const widthM = Math.max(BATTEN_WIDTH_M, Math.abs(maxX - minX))
      // Horizontal members form the rear layer of the simple lattice. A 2 mm
      // setback prevents coincident front faces at every crossing.
      const horizontalCentreZ = BATTEN_DEPTH_M * 0.5 - 0.002
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
      material.dispose()
      stats = emptyStats()
      lastUpdateKey = ''
    },
  }
}
