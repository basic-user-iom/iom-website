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
  totalInstances: number
  visible: boolean
}

export type LinarSupportGrid = {
  group: THREE.Group
  update: (next: SupportGridUpdate) => SupportGridStats
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

  // Each path segment exposes front, rear, upper and lower faces. End caps are
  // omitted because the installation edges are normally hidden by the panel;
  // avoiding cap-specific topology keeps one reusable geometry for 1-4 panels.
  const indices: number[] = []
  for (let index = 0; index < MAX_SUPPORT_PATH_POINTS - 1; index += 1) {
    const a = index * 4
    const b = (index + 1) * 4
    indices.push(
      a,
      b,
      b + 1,
      a,
      b + 1,
      a + 1,
      a + 2,
      a + 3,
      b + 3,
      a + 2,
      b + 3,
      b + 2,
      a,
      a + 2,
      b + 2,
      a,
      b + 2,
      b,
      a + 1,
      b + 1,
      b + 3,
      a + 1,
      b + 3,
      a + 3,
    )
  }
  geometry.setIndex(indices)
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
  geometry.setDrawRange(0, (points.length - 1) * 24)
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

  const transform = new THREE.Object3D()
  let lastUpdateKey = ''
  let stats = emptyStats()
  let disposed = false

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
      stats = emptyStats()
      return stats
    }

    const horizontalPositions = supportPositions(0, heightM)
    const maximumPathDistance = supportPath[supportPath.length - 1]?.distanceM ?? 0
    const verticalPositions = curved
      ? supportPositions(0, maximumPathDistance, seamPathDistancesM)
      : supportPositions(minX, maxX, seamXM)
    if (
      verticalPositions.length > MAX_INSTANCES_PER_AXIS ||
      horizontalPositions.length > MAX_INSTANCES_PER_AXIS
    ) {
      throw new Error('LINAR support-grid instance capacity exceeded')
    }

    verticalBattens.count = verticalPositions.length
    const pathMinZ = curved
      ? supportPath.reduce((minimum, point) => Math.min(minimum, point.z), Infinity)
      : 0
    for (let index = 0; index < verticalPositions.length; index += 1) {
      if (curved) {
        const point = pointAtPathDistance(supportPath, verticalPositions[index])
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
          verticalPositions[index],
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

    if (curved) {
      horizontalBattens.count = 0
      updateCurvedProfileGeometry(curvedProfileGeometry, supportPath)
      curvedProfileBattens.count = horizontalPositions.length
      for (let index = 0; index < horizontalPositions.length; index += 1) {
        transform.position.set(0, horizontalPositions[index], 0)
        transform.rotation.set(0, 0, 0)
        transform.scale.set(1, BATTEN_WIDTH_M, 1)
        transform.updateMatrix()
        curvedProfileBattens.setMatrixAt(index, transform.matrix)
      }
      curvedProfileBattens.instanceMatrix.needsUpdate = true
    } else {
      curvedProfileBattens.count = 0
      const centreX = (minX + maxX) * 0.5
      const widthM = Math.max(BATTEN_WIDTH_M, Math.abs(maxX - minX))
      // Horizontal members form the rear layer of the simple lattice. A 2 mm
      // setback prevents coincident front faces at every crossing.
      const horizontalCentreZ = BATTEN_DEPTH_M * 0.5 - 0.002
      horizontalBattens.count = horizontalPositions.length
      for (let index = 0; index < horizontalPositions.length; index += 1) {
        transform.position.set(centreX, horizontalPositions[index], horizontalCentreZ)
        transform.rotation.set(0, 0, 0)
        transform.scale.set(widthM, BATTEN_WIDTH_M, BATTEN_DEPTH_M)
        transform.updateMatrix()
        horizontalBattens.setMatrixAt(index, transform.matrix)
      }
      horizontalBattens.instanceMatrix.needsUpdate = true
    }

    group.visible = true
    stats = {
      verticalBattens: verticalPositions.length,
      horizontalBattens: horizontalPositions.length,
      totalInstances: verticalPositions.length + horizontalPositions.length,
      visible: true,
    }
    return stats
  }

  return {
    group,
    update,
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
