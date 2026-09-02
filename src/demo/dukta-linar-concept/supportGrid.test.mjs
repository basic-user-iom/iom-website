import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createLinarSupportGrid } from './supportGrid.ts'

const EPSILON = 1e-6

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

function assertCurvedOuterRailTransforms(mesh, bounds, label) {
  const path = bounds.supportPathXZ
  const pathMinimumZ = Math.min(...path.map((point) => point.z))
  const endpoints = [path[0], path.at(-1)]
  for (let index = 0; index < endpoints.length; index += 1) {
    const point = endpoints[index]
    const inwardDirection = index === 0 ? 1 : -1
    const tangentX = Math.cos(point.rotY)
    const tangentZ = -Math.sin(point.rotY)
    const normalX = Math.sin(point.rotY)
    const normalZ = Math.cos(point.rotY)
    const frontZ = point.z - pathMinimumZ + 0.045
    const rail = instanceTransform(mesh, index)
    approximate(rail.scale.x, 0.04, `${label} rail ${index + 1} width`)
    approximate(rail.scale.y, 2.84, `${label} rail ${index + 1} height`)
    approximate(rail.scale.z, 0.045, `${label} rail ${index + 1} depth`)
    approximate(
      rail.position.x,
      point.x + tangentX * inwardDirection * 0.02 - normalX * 0.0225,
      `${label} rail ${index + 1} centre X`,
    )
    approximate(
      rail.position.z,
      frontZ + tangentZ * inwardDirection * 0.02 - normalZ * 0.0225,
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
const outerFrame = childByName(
  support.group,
  'LinarSupportOuterPerimeterFrames',
)
const outerVerticalRails = childByName(
  outerFrame,
  'LinarSupportOuterVerticalRails',
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
assert.equal(flatHorizontal.geometry, sharedBoxGeometry)
assert.equal(outerVerticalRails.geometry, sharedBoxGeometry)
assert.equal(outerFlatProfileRibs.geometry, sharedBoxGeometry)
assert.equal(outerCurvedProfileRibs.geometry, sharedProfileGeometry)
assert.equal(flatHorizontal.material, sharedMaterial)
assert.equal(curvedProfiles.material, sharedMaterial)
assert.equal(outerVerticalRails.material, sharedMaterial)
assert.equal(outerFlatProfileRibs.material, sharedMaterial)
assert.equal(outerCurvedProfileRibs.material, sharedMaterial)

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
  approximate(rail.scale.y, 2.84, `flat outer rail ${index + 1} height`)
  approximate(rail.scale.z, 0.045, `flat outer rail ${index + 1} depth`)
  approximate(rail.position.y, 1.4, `flat outer rail ${index + 1} centre Y`)
  approximate(rail.position.z, 0.0225, `flat outer rail ${index + 1} centre Z`)
}
approximate(flatLeftRail.position.x, -1.18, 'left rail is inset within boundary')
approximate(flatRightRail.position.x, 1.18, 'right rail is inset within boundary')

for (let index = 0; index < 2; index += 1) {
  const rib = instanceTransform(outerFlatProfileRibs, index)
  approximate(rib.scale.x, 2.4, `flat outer rib ${index + 1} width`)
  approximate(rib.scale.y, 0.04, `flat outer rib ${index + 1} thickness`)
  approximate(rib.scale.z, 0.045, `flat outer rib ${index + 1} depth`)
  approximate(rib.position.y, index === 0 ? 0 : 2.8, `flat outer rib ${index + 1} Y`)
}

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

assert.equal(
  sharedProfileGeometry.drawRange.count,
  (curvedBounds.supportPathXZ.length - 1) * 24 + 12,
  'curved ribs contain four side surfaces plus two closed end faces',
)
assertFiniteActiveGeometry(sharedProfileGeometry, 'ordinary curved profile')
assertNonDegenerateActiveTriangles(sharedProfileGeometry, 'ordinary curved profile')
assertCurvedOuterRailTransforms(outerVerticalRails, curvedBounds, 'curved')

for (let index = 0; index < 2; index += 1) {
  const rail = instanceTransform(outerVerticalRails, index)
  approximate(rail.scale.x, 0.04, `curved outer rail ${index + 1} width`)
  approximate(rail.scale.y, 2.84, `curved outer rail ${index + 1} height`)
  approximate(rail.scale.z, 0.045, `curved outer rail ${index + 1} depth`)
  assert.ok(Number.isFinite(rail.position.x))
  assert.ok(Number.isFinite(rail.position.z))
}
for (let index = 0; index < 2; index += 1) {
  const rib = instanceTransform(outerCurvedProfileRibs, index)
  approximate(rib.scale.x, 1, `curved outer rib ${index + 1} X scale`)
  approximate(rib.scale.y, 0.04, `curved outer rib ${index + 1} thickness`)
  approximate(rib.scale.z, 1, `curved outer rib ${index + 1} Z scale`)
  approximate(rib.position.y, index === 0 ? 0 : 2.8, `curved outer rib ${index + 1} Y`)
}

// Reversing a C bend must only mirror/reposition the fixed-section edge rails;
// it may never turn them into full-height wall-to-panel infill wings.
const forwardC = {
  ...curvedBounds,
  supportPathXZ: curvedBounds.supportPathXZ.map((point) => ({
    ...point,
    z: -point.z,
    rotY: -point.rotY,
  })),
}
support.update({ application: 'wall', panelCount: 2, bounds: forwardC })
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
assertOuterFrameState({
  outerFrame,
  outerVerticalRails,
  outerFlatProfileRibs,
  outerCurvedProfileRibs,
  curved: true,
})
assertCurvedOuterRailTransforms(outerVerticalRails, sCurveBounds, 'S curve')
const sProfilePosition = sharedProfileGeometry.getAttribute('position')
const sMinimumZ = Math.min(...sCurveBounds.supportPathXZ.map((point) => point.z))
for (let index = 0; index < sCurveBounds.supportPathXZ.length; index += 1) {
  const point = sCurveBounds.supportPathXZ[index]
  const vertex = index * 4
  approximate(sProfilePosition.getX(vertex), point.x, `S front ${index} X`)
  approximate(
    sProfilePosition.getZ(vertex),
    point.z - sMinimumZ + 0.045,
    `S front ${index} Z`,
  )
  approximate(sProfilePosition.getX(vertex + 2), point.x, `S rear ${index} X`)
  approximate(sProfilePosition.getZ(vertex + 2), 0.001, `S rear ${index} Z`)
}
assertFiniteActiveGeometry(sharedProfileGeometry, 'S profile')
assertNonDegenerateActiveTriangles(sharedProfileGeometry, 'S profile')

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
assertCurvedOuterRailTransforms(
  outerVerticalRails,
  mirroredSCurveBounds,
  'mirrored S curve',
)

// Opaque felt hides only interior members. The open four-sided perimeter stays
// present for flat, C/S and repeated Wall/Ceiling installations.
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
const shortPointCount = shortCurvedBounds.supportPathXZ.length
const activeProfileVertexComponents = shortPointCount * 4 * 3
const reusedNormals = Array.from(
  sharedProfileGeometry
    .getAttribute('normal')
    .array.slice(0, activeProfileVertexComponents),
)
assert.equal(
  sharedProfileGeometry.drawRange.count,
  (shortPointCount - 1) * 24 + 12,
)
for (
  let offset = 0;
  offset < sharedProfileGeometry.drawRange.count;
  offset += 1
) {
  assert.ok(
    sharedProfileGeometry.index.getX(offset) < shortPointCount * 4,
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
  freshProfileGeometry
    .getAttribute('normal')
    .array.slice(0, activeProfileVertexComponents),
)
assert.deepEqual(
  reusedNormals,
  freshNormals,
  'long-to-short profile reuse cannot contaminate active normals',
)
freshSupport.dispose()

let boxDisposeCount = 0
let profileDisposeCount = 0
let materialDisposeCount = 0
sharedBoxGeometry.addEventListener('dispose', () => {
  boxDisposeCount += 1
})
sharedProfileGeometry.addEventListener('dispose', () => {
  profileDisposeCount += 1
})
sharedMaterial.addEventListener('dispose', () => {
  materialDisposeCount += 1
})
support.dispose()
support.dispose()
assert.equal(boxDisposeCount, 1, 'shared box geometry is disposed once')
assert.equal(profileDisposeCount, 1, 'shared profile geometry is disposed once')
assert.equal(materialDisposeCount, 1, 'shared support material is disposed once')

console.log('LINAR open perimeter-frame support checks passed.')
