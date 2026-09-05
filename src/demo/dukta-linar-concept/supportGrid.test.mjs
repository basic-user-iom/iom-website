import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  createLinarSupportGrid,
  SUPPORT_GRID_CAVITY_INFILL_OBJECT_NAME,
  SUPPORT_GRID_CAVITY_INFILL_VISUAL,
  SUPPORT_GRID_REFERENCE,
  SUPPORT_GRID_RENDER_GAP_M,
} from './supportGrid.ts'

const EPSILON = 1e-6
const PANEL_REAR_OFFSET_M = 0.0045
const SUPPORT_DEPTH_M = SUPPORT_GRID_REFERENCE.battenDepthMm / 1000
const PANEL_FACING_OFFSET_M = PANEL_REAR_OFFSET_M + SUPPORT_GRID_RENDER_GAP_M

function childByName(group, name) {
  const child = group.getObjectByName(name)
  assert.ok(child, `expected ${name}`)
  return child
}

function approximate(actual, expected, label, tolerance = EPSILON) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`,
  )
}

function instanceTransform(mesh, index) {
  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  mesh.getMatrixAt(index, matrix)
  matrix.decompose(position, quaternion, scale)
  return { matrix, position, quaternion, scale }
}

function instanceMatrixValues(mesh) {
  const matrix = new THREE.Matrix4()
  const values = []
  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getMatrixAt(index, matrix)
    values.push(...matrix.elements)
  }
  return values
}

function pointAtDistance(path, distanceM) {
  const distance = THREE.MathUtils.clamp(distanceM, 0, path.at(-1).distanceM)
  let low = 0
  while (low + 1 < path.length && path[low + 1].distanceM < distance) low += 1
  const start = path[low]
  const end = path[Math.min(low + 1, path.length - 1)]
  const interval = Math.max(1e-9, end.distanceM - start.distanceM)
  const amount = THREE.MathUtils.clamp((distance - start.distanceM) / interval, 0, 1)
  const rotationDelta =
    THREE.MathUtils.euclideanModulo(end.rotY - start.rotY + Math.PI, Math.PI * 2) -
    Math.PI
  return {
    x: THREE.MathUtils.lerp(start.x, end.x, amount),
    z: THREE.MathUtils.lerp(start.z, end.z, amount),
    rotY: start.rotY + rotationDelta * amount,
  }
}

function assertCurvedOuterRailTransforms(mesh, bounds, label) {
  const path = bounds.supportPathXZ
  const maximumDistance = path.at(-1).distanceM
  const terminalSpan = Math.min(0.04, maximumDistance * 0.5)
  const pairs = [
    [pointAtDistance(path, 0), pointAtDistance(path, terminalSpan)],
    [
      pointAtDistance(path, maximumDistance - terminalSpan),
      pointAtDistance(path, maximumDistance),
    ],
  ]
  for (let index = 0; index < pairs.length; index += 1) {
    const [start, end] = pairs[index]
    const frontStart = {
      x: start.x - Math.sin(start.rotY) * PANEL_FACING_OFFSET_M,
      z: start.z - Math.cos(start.rotY) * PANEL_FACING_OFFSET_M,
    }
    const frontEnd = {
      x: end.x - Math.sin(end.rotY) * PANEL_FACING_OFFSET_M,
      z: end.z - Math.cos(end.rotY) * PANEL_FACING_OFFSET_M,
    }
    const chordX = frontEnd.x - frontStart.x
    const chordZ = frontEnd.z - frontStart.z
    const chordLength = Math.hypot(chordX, chordZ)
    const rotationY = Math.atan2(-chordZ, chordX)
    const tangentX = Math.cos(rotationY)
    const tangentZ = -Math.sin(rotationY)
    const normalX = Math.sin(rotationY)
    const normalZ = Math.cos(rotationY)
    const frontMidpointX = (frontStart.x + frontEnd.x) * 0.5
    const frontMidpointZ = (frontStart.z + frontEnd.z) * 0.5
    const rail = instanceTransform(mesh, index)
    approximate(rail.scale.x, chordLength, `${label} rail ${index + 1} width`)
    assert.ok(
      rail.scale.x <= 0.060001,
      `${label} rail stays within its normal-offset terminal interval`,
    )
    approximate(
      rail.scale.y,
      bounds.heightM - 0.08,
      `${label} rail ${index + 1} fits between profile ribs`,
    )
    approximate(rail.scale.z, SUPPORT_DEPTH_M, `${label} rail ${index + 1} depth`)
    approximate(
      rail.position.x,
      frontMidpointX - normalX * SUPPORT_DEPTH_M * 0.5,
      `${label} rail ${index + 1} centre X`,
    )
    approximate(
      rail.position.z,
      frontMidpointZ - normalZ * SUPPORT_DEPTH_M * 0.5,
      `${label} rail ${index + 1} centre Z`,
    )
    const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(rail.quaternion)
    const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(rail.quaternion)
    approximate(localX.x, tangentX, `${label} rail ${index + 1} tangent X`)
    approximate(localX.z, tangentZ, `${label} rail ${index + 1} tangent Z`)
    approximate(localZ.x, normalX, `${label} rail ${index + 1} normal X`)
    approximate(localZ.z, normalZ, `${label} rail ${index + 1} normal Z`)
  }
}

function assertClosedGeometry(geometry, label) {
  const position = geometry.getAttribute('position')
  const index = geometry.index
  assert.ok(index)
  const keyForVertex = (vertex) =>
    [position.getX(vertex), position.getY(vertex), position.getZ(vertex)]
      .map((component) => Math.round(component * 1e6))
      .join(',')
  const edges = new Map()
  for (let offset = 0; offset < geometry.drawRange.count; offset += 3) {
    const vertices = [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)]
    for (let edge = 0; edge < 3; edge += 1) {
      const pair = [
        keyForVertex(vertices[edge]),
        keyForVertex(vertices[(edge + 1) % 3]),
      ].sort()
      const key = pair.join('|')
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
  }
  for (const [edge, count] of edges) {
    assert.equal(count, 2, `${label} shell edge ${edge} is shared twice`)
  }
}

function activeInstanceCount(...meshes) {
  return meshes.reduce((total, mesh) => total + mesh.count, 0)
}

function assertFiniteActiveGeometry(geometry, label) {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const index = geometry.index
  assert.ok(position, `${label} has positions`)
  assert.ok(normal, `${label} has normals`)
  assert.ok(index, `${label} has indices`)
  for (let offset = 0; offset < geometry.drawRange.count; offset += 1) {
    const vertex = index.getX(offset)
    for (const component of [
      position.getX(vertex),
      position.getY(vertex),
      position.getZ(vertex),
      normal.getX(vertex),
      normal.getY(vertex),
      normal.getZ(vertex),
    ]) {
      assert.ok(Number.isFinite(component), `${label} contains no NaN/Infinity`)
    }
  }
}

function assertActiveIndicesInRange(geometry, label) {
  const position = geometry.getAttribute('position')
  const index = geometry.index
  assert.ok(position, `${label} has positions`)
  assert.ok(index, `${label} has indices`)
  assert.ok(
    geometry.drawRange.count <= index.count,
    `${label} draw range fits its index buffer`,
  )
  for (let offset = 0; offset < geometry.drawRange.count; offset += 1) {
    const vertex = index.getX(offset)
    assert.ok(Number.isInteger(vertex), `${label} index ${offset} is finite`)
    assert.ok(
      vertex >= 0 && vertex < position.count,
      `${label} index ${offset} references an allocated vertex`,
    )
  }
}

function assertNonDegenerateActiveTriangles(geometry, label) {
  const position = geometry.getAttribute('position')
  const index = geometry.index
  assert.ok(index)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  for (let offset = 0; offset < geometry.drawRange.count; offset += 3) {
    a.fromBufferAttribute(position, index.getX(offset))
    b.fromBufferAttribute(position, index.getX(offset + 1))
    c.fromBufferAttribute(position, index.getX(offset + 2))
    const doubledArea = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length()
    assert.ok(doubledArea > 1e-10, `${label} triangle ${offset / 3} is valid`)
  }
}

function assertGeometryContainsXZ(geometry, expectedX, expectedZ, label) {
  const position = geometry.getAttribute('position')
  let found = false
  for (let index = 0; index < position.count; index += 1) {
    if (
      Math.abs(position.getX(index) - expectedX) <= 1e-5 &&
      Math.abs(position.getZ(index) - expectedZ) <= 1e-5
    ) {
      found = true
      break
    }
  }
  assert.ok(found, `${label}: expected (${expectedX}, ${expectedZ})`)
}

function assertProfileFollowsRearPath(geometry, bounds, label) {
  const panelFacingOffset =
    (bounds.rearSurfaceOffsetM ?? 0) + SUPPORT_GRID_RENDER_GAP_M
  for (const [index, point] of bounds.supportPathXZ.entries()) {
    const normalX = Math.sin(point.rotY)
    const normalZ = Math.cos(point.rotY)
    const frontX = point.x - normalX * panelFacingOffset
    const frontZ = point.z - normalZ * panelFacingOffset
    assertGeometryContainsXZ(
      geometry,
      frontX,
      frontZ,
      `${label} front sample ${index}`,
    )
    assertGeometryContainsXZ(
      geometry,
      frontX - normalX * SUPPORT_DEPTH_M,
      frontZ - normalZ * SUPPORT_DEPTH_M,
      `${label} back sample ${index}`,
    )
  }
}

function assertOuterFrameState({
  outerFrame,
  outerVerticalRails,
  outerFlatProfileRibs,
  outerCurvedProfileRibs,
  curved,
}) {
  assert.equal(outerFrame.visible, true)
  assert.equal(outerVerticalRails.count, 2)
  assert.equal(outerFlatProfileRibs.count, curved ? 0 : 2)
  assert.equal(outerCurvedProfileRibs.count, curved ? 2 : 0)
  assert.equal(
    outerVerticalRails.count +
      outerFlatProfileRibs.count +
      outerCurvedProfileRibs.count,
    4,
    'the installation has exactly four outer frame members',
  )
}

const support = createLinarSupportGrid()
const flatBounds = {
  minX: -1.2,
  maxX: 1.2,
  heightM: 2.8,
  rearSurfaceOffsetM: PANEL_REAR_OFFSET_M,
  seamXM: [0],
  supportPathXZ: [
    { x: -1.2, z: 0, rotY: 0, distanceM: 0 },
    { x: 1.2, z: 0, rotY: 0, distanceM: 2.4 },
  ],
  seamPathDistancesM: [1.2],
}

const vertical = childByName(support.group, 'LinarSupportVerticalBattens')
const flatHorizontal = childByName(
  support.group,
  'LinarSupportHorizontalBattens',
)
const curvedProfiles = childByName(
  support.group,
  'LinarSupportContinuousCurvedProfileRibs',
)
const cavityInfill = childByName(
  support.group,
  SUPPORT_GRID_CAVITY_INFILL_OBJECT_NAME,
)
const outerFrame = childByName(
  support.group,
  'LinarSupportOuterPerimeterFrames',
)
const outerVerticalRails = childByName(
  outerFrame,
  'LinarSupportOuterVerticalRails',
)
assert.equal(
  outerFrame.getObjectByName('LinarSupportOuterEndCaps'),
  undefined,
  'the outer frame contains no cavity-filling end-cap sheets',
)
const outerFlatProfileRibs = childByName(
  outerFrame,
  'LinarSupportOuterFlatProfileRibs',
)
const outerCurvedProfileRibs = childByName(
  outerFrame,
  'LinarSupportOuterCurvedProfileRibs',
)

const sharedBoxGeometry = vertical.geometry
const sharedMaterial = vertical.material
const sharedProfileGeometry = curvedProfiles.geometry
const sharedCavityGeometry = cavityInfill.geometry
assert.equal(flatHorizontal.geometry, sharedBoxGeometry)
assert.equal(outerVerticalRails.geometry, sharedBoxGeometry)
assert.equal(outerFlatProfileRibs.geometry, sharedBoxGeometry)
assert.equal(outerCurvedProfileRibs.geometry, sharedProfileGeometry)
assert.equal(flatHorizontal.material, sharedMaterial)
assert.equal(curvedProfiles.material, sharedMaterial)
assert.equal(outerVerticalRails.material, sharedMaterial)
assert.equal(outerFlatProfileRibs.material, sharedMaterial)
assert.equal(outerCurvedProfileRibs.material, sharedMaterial)
assert.notEqual(cavityInfill.material, sharedMaterial)
assert.notEqual(sharedCavityGeometry, sharedBoxGeometry)
assert.notEqual(sharedCavityGeometry, sharedProfileGeometry)

const flatStats = support.update({
  application: 'wall',
  panelCount: 2,
  bounds: flatBounds,
})
assert.deepEqual(flatStats, {
  verticalBattens: 5,
  horizontalBattens: 6,
  outerFrameMembers: 4,
  totalInstances: 15,
  visible: true,
})
assert.equal(vertical.count, 5)
assert.equal(flatHorizontal.count, 6)
assert.equal(curvedProfiles.count, 0)
for (let index = 0; index < vertical.count; index += 1) {
  const member = instanceTransform(vertical, index)
  approximate(member.scale.y, 2.72, `flat longitudinal member ${index + 1} height`)
  approximate(member.position.y, 1.4, `flat longitudinal member ${index + 1} centre Y`)
}
assertOuterFrameState({
  outerFrame,
  outerVerticalRails,
  outerFlatProfileRibs,
  outerCurvedProfileRibs,
  curved: false,
})

const flatLeftRail = instanceTransform(outerVerticalRails, 0)
const flatRightRail = instanceTransform(outerVerticalRails, 1)
for (const [index, rail] of [flatLeftRail, flatRightRail].entries()) {
  approximate(rail.scale.x, 0.04, `flat outer rail ${index + 1} width`)
  approximate(rail.scale.y, 2.72, `flat outer rail ${index + 1} height`)
  approximate(rail.scale.z, SUPPORT_DEPTH_M, `flat outer rail ${index + 1} depth`)
  approximate(rail.position.y, 1.4, `flat outer rail ${index + 1} centre Y`)
  approximate(
    rail.position.z,
    -PANEL_FACING_OFFSET_M - SUPPORT_DEPTH_M * 0.5,
    `flat outer rail ${index + 1} centre Z`,
  )
}
approximate(flatLeftRail.position.x, -1.18, 'left rail is inset within boundary')
approximate(flatRightRail.position.x, 1.18, 'right rail is inset within boundary')

for (let index = 0; index < 2; index += 1) {
  const rib = instanceTransform(outerFlatProfileRibs, index)
  approximate(rib.scale.x, 2.4, `flat outer rib ${index + 1} width`)
  approximate(rib.scale.y, 0.04, `flat outer rib ${index + 1} thickness`)
  approximate(rib.scale.z, SUPPORT_DEPTH_M, `flat outer rib ${index + 1} depth`)
  approximate(
    rib.position.z,
    -PANEL_FACING_OFFSET_M - SUPPORT_DEPTH_M * 0.5,
    `flat outer rib ${index + 1} centre Z`,
  )
  approximate(rib.position.y, index === 0 ? 0.02 : 2.78, `flat outer rib ${index + 1} Y`)
}

// Camera-fit padding is not a physical construction endpoint. A flat support
// must keep using the same centreline path that the curved branch consumes.
support.update({
  application: 'wall',
  panelCount: 2,
  bounds: { ...flatBounds, minX: -1.25, maxX: 1.25 },
})
approximate(
  instanceTransform(outerVerticalRails, 0).position.x,
  -1.18,
  'padded flat bounds do not move the left rail',
)
approximate(
  instanceTransform(outerVerticalRails, 1).position.x,
  1.18,
  'padded flat bounds do not move the right rail',
)
approximate(
  instanceTransform(outerFlatProfileRibs, 0).scale.x,
  2.4,
  'padded flat bounds do not widen the profile ribs',
)

const curvedBounds = {
  ...flatBounds,
  supportPathXZ: [
    { x: -1.2, z: 0.16, rotY: -0.45, distanceM: 0 },
    { x: -0.6, z: 0.02, rotY: -0.2, distanceM: 0.64 },
    { x: 0, z: 0.31, rotY: 0, distanceM: 1.25 },
    { x: 0.6, z: 0.08, rotY: 0.2, distanceM: 1.86 },
    { x: 1.2, z: 0.24, rotY: 0.45, distanceM: 2.5 },
  ],
  seamPathDistancesM: [1.25],
}

// The runtime contributes 57 samples for one panel and 56 additional samples
// for every tangent-connected repeat. Exercise the full 1-4 module range: the
// closed rib uses both a front and reverse outline, so its active draw range
// must never outgrow the preallocated buffers.
function sampledInstallationBounds(panelCount) {
  const sampleCount = 1 + 56 * panelCount
  const points = []
  const seamPathDistancesM = []
  let distanceM = 0
  let previous = null
  for (let index = 0; index < sampleCount; index += 1) {
    const amount = index / (sampleCount - 1)
    const x = THREE.MathUtils.lerp(-0.6 * panelCount, 0.6 * panelCount, amount)
    const z = 0.12 * Math.cos(Math.PI * amount)
    const dzdx =
      (-0.12 * Math.PI * Math.sin(Math.PI * amount)) / (1.2 * panelCount)
    const rotY = Math.atan2(-dzdx, 1)
    if (previous) distanceM += Math.hypot(x - previous.x, z - previous.z)
    points.push({ x, z, rotY, distanceM })
    previous = { x, z }
    if (index > 0 && index < sampleCount - 1 && index % 56 === 0) {
      seamPathDistancesM.push(distanceM)
    }
  }
  return {
    ...flatBounds,
    minX: -0.6 * panelCount,
    maxX: 0.6 * panelCount,
    supportPathXZ: points,
    seamPathDistancesM,
  }
}

for (const panelCount of [1, 2, 3, 4]) {
  const sampledBounds = sampledInstallationBounds(panelCount)
  for (const application of ['wall', 'ceiling']) {
    support.update({ application, panelCount, bounds: sampledBounds })
    const label = `${application}, ${panelCount}-module curved profile`
    assertActiveIndicesInRange(sharedProfileGeometry, label)
    assertFiniteActiveGeometry(sharedProfileGeometry, label)
  }
}

const curvedCases = [
  {
    application: 'wall',
    panelCount: 1,
    seams: [],
    internalVerticals: 6,
    totalInstances: 16,
  },
  {
    application: 'ceiling',
    panelCount: 2,
    seams: [1.25],
    internalVerticals: 7,
    totalInstances: 17,
  },
  {
    application: 'wall',
    panelCount: 4,
    seams: [0.625, 1.25, 1.875],
    internalVerticals: 7,
    totalInstances: 17,
  },
]

let canonicalOuterRailMatrices
let canonicalOuterRibMatrices
for (const curvedCase of curvedCases) {
  const stats = support.update({
    application: curvedCase.application,
    panelCount: curvedCase.panelCount,
    bounds: {
      ...curvedBounds,
      seamPathDistancesM: curvedCase.seams,
    },
  })
  assert.deepEqual(stats, {
    verticalBattens: curvedCase.internalVerticals,
    horizontalBattens: 6,
    outerFrameMembers: 4,
    totalInstances: curvedCase.totalInstances,
    visible: true,
  })
  assert.equal(vertical.count, curvedCase.internalVerticals)
  assert.equal(flatHorizontal.count, 0)
  assert.equal(curvedProfiles.count, 6)
  for (let index = 0; index < vertical.count; index += 1) {
    const member = instanceTransform(vertical, index)
    approximate(
      member.scale.y,
      2.72,
      `curved longitudinal member ${index + 1} fits between profile ribs`,
    )
  }
  assertOuterFrameState({
    outerFrame,
    outerVerticalRails,
    outerFlatProfileRibs,
    outerCurvedProfileRibs,
    curved: true,
  })
  assert.equal(vertical.geometry, sharedBoxGeometry)
  assert.equal(curvedProfiles.geometry, sharedProfileGeometry)
  assert.equal(outerCurvedProfileRibs.geometry, sharedProfileGeometry)
  assert.equal(
    activeInstanceCount(
      vertical,
      flatHorizontal,
      curvedProfiles,
      outerVerticalRails,
      outerFlatProfileRibs,
      outerCurvedProfileRibs,
    ),
    stats.totalInstances,
    'reported total matches all active support instances',
  )
  assertProfileFollowsRearPath(
    sharedProfileGeometry,
    curvedBounds,
    `${curvedCase.application} curve`,
  )
  const railMatrices = instanceMatrixValues(outerVerticalRails)
  const ribMatrices = instanceMatrixValues(outerCurvedProfileRibs)
  if (canonicalOuterRailMatrices) {
    assert.deepEqual(
      railMatrices,
      canonicalOuterRailMatrices,
      'module seams cannot move or duplicate outer vertical rails',
    )
    assert.deepEqual(
      ribMatrices,
      canonicalOuterRibMatrices,
      'module seams cannot move or duplicate outer profile ribs',
    )
  } else {
    canonicalOuterRailMatrices = railMatrices
    canonicalOuterRibMatrices = ribMatrices
  }
}

assert.ok(
  sharedProfileGeometry.drawRange.count > 0 &&
    sharedProfileGeometry.drawRange.count % 3 === 0,
  'curved ribs contain a triangulated closed shell',
)
assertFiniteActiveGeometry(sharedProfileGeometry, 'ordinary curved profile')
assertNonDegenerateActiveTriangles(sharedProfileGeometry, 'ordinary curved profile')
assertClosedGeometry(sharedProfileGeometry, 'ordinary curved profile')
assertCurvedOuterRailTransforms(outerVerticalRails, curvedBounds, 'curved')

for (let index = 0; index < 2; index += 1) {
  const rail = instanceTransform(outerVerticalRails, index)
  assert.ok(rail.scale.x <= 0.060001, `curved outer rail ${index + 1} width`)
  approximate(rail.scale.y, 2.72, `curved outer rail ${index + 1} height`)
  approximate(rail.scale.z, SUPPORT_DEPTH_M, `curved outer rail ${index + 1} depth`)
  assert.ok(Number.isFinite(rail.position.x))
  assert.ok(Number.isFinite(rail.position.z))
}
for (let index = 0; index < 2; index += 1) {
  const rib = instanceTransform(outerCurvedProfileRibs, index)
  approximate(rib.scale.x, 1, `curved outer rib ${index + 1} X scale`)
  approximate(rib.scale.y, 0.04, `curved outer rib ${index + 1} thickness`)
  approximate(rib.scale.z, 1, `curved outer rib ${index + 1} Z scale`)
  approximate(rib.position.y, index === 0 ? 0.02 : 2.78, `curved outer rib ${index + 1} Y`)
}

// Reversing a C bend must only mirror/reposition the fixed-section edge rails;
// it may never turn them into cavity-filling wall-to-panel infill wings.
const forwardC = {
  ...curvedBounds,
  supportPathXZ: curvedBounds.supportPathXZ.map((point) => ({
    ...point,
    z: -point.z,
    rotY: -point.rotY,
  })),
}
support.update({ application: 'wall', panelCount: 2, bounds: forwardC })
assertProfileFollowsRearPath(sharedProfileGeometry, forwardC, 'mirrored C')
assertCurvedOuterRailTransforms(outerVerticalRails, forwardC, 'mirrored C')
assertOuterFrameState({
  outerFrame,
  outerVerticalRails,
  outerFlatProfileRibs,
  outerCurvedProfileRibs,
  curved: true,
})

const sCurveBounds = {
  ...flatBounds,
  supportPathXZ: [
    { x: -1.2, z: 0, rotY: -0.32, distanceM: 0 },
    { x: -0.6, z: 0.25, rotY: 0.32, distanceM: 0.65 },
    { x: 0, z: 0, rotY: -0.32, distanceM: 1.3 },
    { x: 0.6, z: -0.25, rotY: 0.32, distanceM: 1.95 },
    { x: 1.2, z: 0, rotY: -0.32, distanceM: 2.6 },
  ],
  seamPathDistancesM: [0.65, 1.3, 1.95],
}
support.update({ application: 'ceiling', panelCount: 4, bounds: sCurveBounds })
assertProfileFollowsRearPath(sharedProfileGeometry, sCurveBounds, 'S curve')
assertOuterFrameState({
  outerFrame,
  outerVerticalRails,
  outerFlatProfileRibs,
  outerCurvedProfileRibs,
  curved: true,
})
assertCurvedOuterRailTransforms(outerVerticalRails, sCurveBounds, 'S curve')
assertFiniteActiveGeometry(sharedProfileGeometry, 'S profile')
assertNonDegenerateActiveTriangles(sharedProfileGeometry, 'S profile')
assertClosedGeometry(sharedProfileGeometry, 'S profile')

const mirroredSCurveBounds = {
  ...sCurveBounds,
  supportPathXZ: sCurveBounds.supportPathXZ.map((point) => ({
    ...point,
    z: -point.z,
    rotY: -point.rotY,
  })),
}
support.update({
  application: 'wall',
  panelCount: 4,
  bounds: mirroredSCurveBounds,
})
assertProfileFollowsRearPath(
  sharedProfileGeometry,
  mirroredSCurveBounds,
  'mirrored S curve',
)
assertCurvedOuterRailTransforms(
  outerVerticalRails,
  mirroredSCurveBounds,
  'mirrored S curve',
)
assertFiniteActiveGeometry(sharedProfileGeometry, 'mirrored S profile')
assertNonDegenerateActiveTriangles(sharedProfileGeometry, 'mirrored S profile')
assertClosedGeometry(sharedProfileGeometry, 'mirrored S profile')

// A physical-reference 180 mm hairpin must remain an open rib-and-rail frame.
// In particular, its endpoint members may not scale with the receiver cavity
// depth and the solid transverse rib must stay watertight at vertical tangents.
const hairpinRadiusM = 0.18
const hairpinSteps = 56
const hairpinPath = Array.from({ length: hairpinSteps + 1 }, (_, index) => {
  const angle = -Math.PI * 0.5 + Math.PI * (index / hairpinSteps)
  const tangentX = -Math.sin(angle)
  const tangentZ = Math.cos(angle)
  return {
    x: hairpinRadiusM * Math.cos(angle),
    z: hairpinRadiusM * Math.sin(angle),
    rotY: Math.atan2(-tangentZ, tangentX),
    distanceM: hairpinRadiusM * Math.PI * (index / hairpinSteps),
  }
})
const hairpinBounds = {
  minX: 0,
  maxX: hairpinRadiusM,
  heightM: 2.8,
  rearSurfaceOffsetM: PANEL_REAR_OFFSET_M,
  seamXM: [],
  supportPathXZ: hairpinPath,
  seamPathDistancesM: [],
}
support.update({ application: 'wall', panelCount: 1, bounds: hairpinBounds })
assertProfileFollowsRearPath(sharedProfileGeometry, hairpinBounds, '180 mm hairpin')
assertCurvedOuterRailTransforms(outerVerticalRails, hairpinBounds, '180 mm hairpin')
assertFiniteActiveGeometry(sharedProfileGeometry, '180 mm hairpin profile')
assertNonDegenerateActiveTriangles(sharedProfileGeometry, '180 mm hairpin profile')
assertClosedGeometry(sharedProfileGeometry, '180 mm hairpin profile')
sharedProfileGeometry.computeBoundingBox()
assert.ok(sharedProfileGeometry.boundingBox)
assert.ok(
  sharedProfileGeometry.boundingBox.min.x >= -SUPPORT_DEPTH_M - PANEL_FACING_OFFSET_M - 0.000001 &&
    sharedProfileGeometry.boundingBox.max.x <=
      hairpinRadiusM + SUPPORT_DEPTH_M + PANEL_FACING_OFFSET_M + 0.000001,
  'hairpin profile remains a compact curve-following rib in X',
)
assert.ok(
  sharedProfileGeometry.boundingBox.max.z -
      sharedProfileGeometry.boundingBox.min.z <=
    (hairpinRadiusM + SUPPORT_DEPTH_M + PANEL_FACING_OFFSET_M) * 2 + 0.000001,
  'hairpin profile never expands to a receiver-depth sheet',
)
for (let index = 0; index < outerVerticalRails.count; index += 1) {
  const rail = instanceTransform(outerVerticalRails, index)
  assert.ok(
    rail.scale.x <= 0.060001,
    'hairpin rail remains within its normal-offset terminal interval',
  )
  approximate(rail.scale.y, 2.72, 'hairpin rail fits between outer profile ribs')
  approximate(rail.scale.z, SUPPORT_DEPTH_M, 'hairpin rail keeps fixed support depth')
}

// The production 180 mm preview contains straight tails joined by a
// semicircle. Its X progression remains monotone, so it specifically guards
// against the former logic that expanded this common C shape to the complete
// receiver plane and produced a cabinet-like top/bottom sheet.
const previewWidthM = 1.2
const previewArcLengthM = Math.PI * hairpinRadiusM
const previewFlatLengthM = (previewWidthM - previewArcLengthM) * 0.5
const previewSteps = 96
const tightCPath = []
let tightCDistanceM = 0
let tightCPrevious = null
for (let index = 0; index <= previewSteps; index += 1) {
  const pathPositionM = previewWidthM * (index / previewSteps)
  let x
  let z
  let theta
  if (pathPositionM <= previewFlatLengthM) {
    const distanceFromArcM = previewFlatLengthM - pathPositionM
    x = -hairpinRadiusM
    z = hairpinRadiusM + distanceFromArcM
    theta = -Math.PI * 0.5
  } else if (pathPositionM >= previewFlatLengthM + previewArcLengthM) {
    const distanceFromArcM = pathPositionM - previewFlatLengthM - previewArcLengthM
    x = hairpinRadiusM
    z = hairpinRadiusM + distanceFromArcM
    theta = Math.PI * 0.5
  } else {
    theta = -Math.PI * 0.5 + (pathPositionM - previewFlatLengthM) / hairpinRadiusM
    x = hairpinRadiusM * Math.sin(theta)
    z = hairpinRadiusM * (1 - Math.cos(theta))
  }
  if (tightCPrevious) {
    tightCDistanceM += Math.hypot(x - tightCPrevious.x, z - tightCPrevious.z)
  }
  tightCPath.push({ x, z, rotY: -theta, distanceM: tightCDistanceM })
  tightCPrevious = { x, z }
}
const tightCBounds = {
  minX: -hairpinRadiusM,
  maxX: hairpinRadiusM,
  heightM: 2.8,
  rearSurfaceOffsetM: PANEL_REAR_OFFSET_M,
  seamXM: [],
  supportPathXZ: tightCPath,
  seamPathDistancesM: [],
}
support.update({ application: 'wall', panelCount: 1, bounds: tightCBounds })
assertProfileFollowsRearPath(sharedProfileGeometry, tightCBounds, '180 mm preview C')
assertFiniteActiveGeometry(sharedProfileGeometry, '180 mm preview C profile')
assertNonDegenerateActiveTriangles(sharedProfileGeometry, '180 mm preview C profile')
assertClosedGeometry(sharedProfileGeometry, '180 mm preview C profile')
for (const point of tightCPath.filter((_, index) => index % 16 === 0)) {
  const frontX = point.x - Math.sin(point.rotY) * PANEL_FACING_OFFSET_M
  const frontZ = point.z - Math.cos(point.rotY) * PANEL_FACING_OFFSET_M
  assertGeometryContainsXZ(
    sharedProfileGeometry,
    frontX,
    frontZ,
    'preview C contains its panel-side profile edge',
  )
  assertGeometryContainsXZ(
    sharedProfileGeometry,
    frontX - Math.sin(point.rotY) * SUPPORT_DEPTH_M,
    frontZ - Math.cos(point.rotY) * SUPPORT_DEPTH_M,
    'preview C contains its compact reverse profile edge',
  )
}
for (let index = 0; index < outerVerticalRails.count; index += 1) {
  const rail = instanceTransform(outerVerticalRails, index)
  approximate(rail.scale.y, 2.72, 'preview C rail terminates between profile ribs')
}

// The visibility API remains independent from construction generation. The
// mounted wool study no longer calls this with false; its internal timber must
// remain visible around the cavity infill.
support.setInternalMembersVisible(false)
assert.equal(vertical.visible, false)
assert.equal(flatHorizontal.visible, false)
assert.equal(curvedProfiles.visible, false)
for (const hiddenCase of [
  { application: 'wall', panelCount: 1, bounds: flatBounds, curved: false },
  { application: 'ceiling', panelCount: 4, bounds: curvedBounds, curved: true },
]) {
  support.update(hiddenCase)
  assert.equal(vertical.visible, false)
  assert.equal(flatHorizontal.visible, false)
  assert.equal(curvedProfiles.visible, false)
  assertOuterFrameState({
    outerFrame,
    outerVerticalRails,
    outerFlatProfileRibs,
    outerCurvedProfileRibs,
    curved: hiddenCase.curved,
  })
}

support.setInternalMembersVisible(true)
assert.equal(vertical.visible, true)
assert.equal(flatHorizontal.visible, true)
assert.equal(curvedProfiles.visible, true)
assert.equal(outerFrame.visible, true)

// Mounted wool is split into the open bays of the timber lattice, never one
// opaque sheet in front of it. Each pathwise bay is now one stitched, closed
// sweep and the completed path geometry is instanced only over the horizontal
// cavity rows. This prevents the diagonal rear-face cuts produced by the old
// chain of independently rotated chord boxes.
support.setCavityInfill(true, '#982a32')
const infillCases = [
  { application: 'wall', panelCount: 2, bounds: flatBounds, curved: false },
  { application: 'ceiling', panelCount: 4, bounds: sCurveBounds, curved: true },
]
const expectedInfillDepthM =
  SUPPORT_DEPTH_M -
  SUPPORT_GRID_CAVITY_INFILL_VISUAL.frontRecessMm / 1000 -
  SUPPORT_GRID_CAVITY_INFILL_VISUAL.rearRevealMm / 1000
for (const infillCase of infillCases) {
  support.update(infillCase)
  assert.equal(support.group.visible, true)
  assert.equal(vertical.visible, true)
  assert.equal(flatHorizontal.visible, true)
  assert.equal(curvedProfiles.visible, true)
  assert.equal(cavityInfill.visible, true)
  assert.equal(cavityInfill.count, 7, 'mounted wool creates one instance per cavity row')
  assert.equal(cavityInfill.geometry, sharedCavityGeometry)
  assert.equal(cavityInfill.material.color.getHexString(), '982a32')
  assert.ok(
    sharedCavityGeometry.drawRange.count > 0 &&
      sharedCavityGeometry.drawRange.count % 3 === 0,
    'mounted wool contains triangulated swept cavity volumes',
  )
  assertActiveIndicesInRange(sharedCavityGeometry, 'mounted wool')
  assertFiniteActiveGeometry(sharedCavityGeometry, 'mounted wool')
  assertNonDegenerateActiveTriangles(sharedCavityGeometry, 'mounted wool')
  assertClosedGeometry(sharedCavityGeometry, 'mounted wool')
  for (let index = 0; index < cavityInfill.count; index += 1) {
    const row = instanceTransform(cavityInfill, index)
    approximate(row.scale.x, 1, 'cavity row keeps baked path width')
    approximate(row.scale.z, 1, 'cavity row keeps baked visual depth')
    assert.ok(row.scale.y > 0, 'cavity row has a positive bay height')
    for (const value of [
      ...row.position.toArray(),
      ...row.quaternion.toArray(),
      ...row.scale.toArray(),
    ]) {
      assert.ok(Number.isFinite(value), 'cavity transform is finite')
    }
  }
  if (!infillCase.curved) {
    sharedCavityGeometry.computeBoundingBox()
    assert.ok(sharedCavityGeometry.boundingBox)
    approximate(
      sharedCavityGeometry.boundingBox.max.z -
        sharedCavityGeometry.boundingBox.min.z,
      expectedInfillDepthM,
      'flat cavity sweep keeps the recessed visual depth',
    )
  }
  assertOuterFrameState({
    outerFrame,
    outerVerticalRails,
    outerFlatProfileRibs,
    outerCurvedProfileRibs,
    curved: infillCase.curved,
  })
}

// The production sampler contributes up to 225 path points for four modules.
// Exercise both mounted orientations over the complete repetition range so a
// future topology change cannot silently overflow or return to per-chord boxes.
for (const panelCount of [1, 2, 3, 4]) {
  const sampledBounds = sampledInstallationBounds(panelCount)
  for (const application of ['wall', 'ceiling']) {
    support.update({ application, panelCount, bounds: sampledBounds })
    const label = `${application}, ${panelCount}-module swept wool`
    assert.equal(cavityInfill.count, 7, `${label} keeps one instance per row`)
    assertActiveIndicesInRange(sharedCavityGeometry, label)
    assertFiniteActiveGeometry(sharedCavityGeometry, label)
    assertNonDegenerateActiveTriangles(sharedCavityGeometry, label)
    assertClosedGeometry(sharedCavityGeometry, label)
  }
}

for (const [label, application, bounds] of [
  ['180 mm hairpin wool', 'wall', hairpinBounds],
  ['180 mm preview C wool', 'ceiling', tightCBounds],
  ['S-curve wool', 'wall', sCurveBounds],
]) {
  support.update({ application, panelCount: 1, bounds })
  assert.equal(cavityInfill.count, 7, `${label} keeps one instance per row`)
  assertActiveIndicesInRange(sharedCavityGeometry, label)
  assertFiniteActiveGeometry(sharedCavityGeometry, label)
  assertNonDegenerateActiveTriangles(sharedCavityGeometry, label)
  assertClosedGeometry(sharedCavityGeometry, label)
}

support.setCavityInfill(false, '#dedbd1')
support.update({ application: 'wall', panelCount: 2, bounds: flatBounds })
assert.equal(cavityInfill.visible, false)
assert.equal(cavityInfill.count, 0)
assert.equal(sharedCavityGeometry.drawRange.count, 0)

const hiddenStats = support.update({
  application: 'freestanding',
  panelCount: 2,
  bounds: curvedBounds,
})
assert.deepEqual(hiddenStats, {
  verticalBattens: 0,
  horizontalBattens: 0,
  outerFrameMembers: 0,
  totalInstances: 0,
  visible: false,
})
assert.equal(support.group.visible, false)
assert.equal(outerFrame.visible, false)
assert.equal(outerVerticalRails.count, 0)
assert.equal(outerFlatProfileRibs.count, 0)
assert.equal(outerCurvedProfileRibs.count, 0)

const remounted = support.update({
  application: 'ceiling',
  panelCount: 2,
  bounds: flatBounds,
})
assert.deepEqual(remounted, flatStats)
assert.equal(support.group.visible, true)
assertOuterFrameState({
  outerFrame,
  outerVerticalRails,
  outerFlatProfileRibs,
  outerCurvedProfileRibs,
  curved: false,
})

// Reusing the dynamic profile buffer after a longer path must produce exactly
// the same active normals as a fresh grid built directly from the short path.
const shortCurvedBounds = {
  ...flatBounds,
  supportPathXZ: [
    { x: -1.2, z: 0.06, rotY: -0.35, distanceM: 0 },
    { x: 0, z: 0.32, rotY: 0, distanceM: 1.25 },
    { x: 1.2, z: 0.08, rotY: 0.35, distanceM: 2.5 },
  ],
  seamPathDistancesM: [1.25],
}
support.update({ application: 'wall', panelCount: 2, bounds: curvedBounds })
support.update({ application: 'wall', panelCount: 2, bounds: shortCurvedBounds })

const activePositionAttribute = sharedProfileGeometry.getAttribute('position')
const beforeSubMillimetreUpdate = Array.from(
  activePositionAttribute.array.slice(0, shortCurvedBounds.supportPathXZ.length * 3),
)
const subMillimetreMovedBounds = {
  ...shortCurvedBounds,
  supportPathXZ: shortCurvedBounds.supportPathXZ.map((point, index) =>
    index === 1 ? { ...point, z: point.z + 0.001 } : point,
  ),
}
support.update({
  application: 'wall',
  panelCount: 2,
  bounds: subMillimetreMovedBounds,
})
const afterSubMillimetreUpdate = Array.from(
  activePositionAttribute.array.slice(0, shortCurvedBounds.supportPathXZ.length * 3),
)
assert.notDeepEqual(
  afterSubMillimetreUpdate,
  beforeSubMillimetreUpdate,
  'a 1 mm animated path change updates the support instead of freezing in cache',
)

const thickBackedBounds = {
  ...shortCurvedBounds,
  rearSurfaceOffsetM: 0.0097,
}
support.update({ application: 'wall', panelCount: 2, bounds: thickBackedBounds })
assertProfileFollowsRearPath(
  sharedProfileGeometry,
  thickBackedBounds,
  'thick backed panel',
)

support.update({ application: 'wall', panelCount: 2, bounds: shortCurvedBounds })
const reusedNormals = Array.from(
  sharedProfileGeometry.getAttribute('normal').array,
)
for (
  let offset = 0;
  offset < sharedProfileGeometry.drawRange.count;
  offset += 1
) {
  assert.ok(
    sharedProfileGeometry.index.getX(offset) <
      sharedProfileGeometry.getAttribute('position').count,
    'active short-path indices cannot reference stale long-path vertices',
  )
}

const freshSupport = createLinarSupportGrid()
freshSupport.update({
  application: 'wall',
  panelCount: 2,
  bounds: shortCurvedBounds,
})
const freshProfileGeometry = childByName(
  freshSupport.group,
  'LinarSupportContinuousCurvedProfileRibs',
).geometry
const freshNormals = Array.from(
  freshProfileGeometry.getAttribute('normal').array,
)
assert.deepEqual(
  reusedNormals,
  freshNormals,
  'long-to-short profile reuse cannot contaminate active normals',
)
freshSupport.dispose()

let boxDisposeCount = 0
let profileDisposeCount = 0
let cavityDisposeCount = 0
let materialDisposeCount = 0
sharedBoxGeometry.addEventListener('dispose', () => {
  boxDisposeCount += 1
})
sharedProfileGeometry.addEventListener('dispose', () => {
  profileDisposeCount += 1
})
sharedCavityGeometry.addEventListener('dispose', () => {
  cavityDisposeCount += 1
})
sharedMaterial.addEventListener('dispose', () => {
  materialDisposeCount += 1
})
support.dispose()
support.dispose()
assert.equal(boxDisposeCount, 1, 'shared box geometry is disposed once')
assert.equal(profileDisposeCount, 1, 'shared profile geometry is disposed once')
assert.equal(cavityDisposeCount, 1, 'shared cavity geometry is disposed once')
assert.equal(materialDisposeCount, 1, 'shared support material is disposed once')

console.log('LINAR open perimeter-frame support checks passed.')
