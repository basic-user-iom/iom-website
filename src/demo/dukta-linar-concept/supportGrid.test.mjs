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

function geometryPositionValues(mesh) {
  const position = mesh.geometry.getAttribute('position')
  return Array.from(position.array.slice(0, mesh.geometry.drawRange.count * 3))
}

function assertEndCapBounds(mesh, expected, label) {
  const geometry = mesh.geometry
  assert.equal(geometry.drawRange.count, 36, `${label} has twelve closed triangles`)
  assertFiniteActiveGeometry(geometry, label)
  assertNonDegenerateActiveTriangles(geometry, label)
  assertClosedOutwardGeometry(geometry, label)
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  assert.ok(bounds)
  approximate(bounds.min.x, expected.minX, `${label} minimum X`)
  approximate(bounds.max.x, expected.maxX, `${label} maximum X`)
  approximate(bounds.min.y, expected.minY, `${label} minimum Y`)
  approximate(bounds.max.y, expected.maxY, `${label} maximum Y`)
  approximate(bounds.min.z, expected.minZ, `${label} minimum Z`)
  approximate(bounds.max.z, expected.maxZ, `${label} maximum Z`)
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
  for (let offset = 0; offset < geometry.drawRange.count; offset += 1) {
    const vertex = index ? index.getX(offset) : offset
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
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  for (let offset = 0; offset < geometry.drawRange.count; offset += 3) {
    a.fromBufferAttribute(position, index ? index.getX(offset) : offset)
    b.fromBufferAttribute(position, index ? index.getX(offset + 1) : offset + 1)
    c.fromBufferAttribute(position, index ? index.getX(offset + 2) : offset + 2)
    const doubledArea = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length()
    assert.ok(doubledArea > 1e-10, `${label} triangle ${offset / 3} is valid`)
  }
}

function assertClosedOutwardGeometry(geometry, label) {
  const position = geometry.getAttribute('position')
  const index = geometry.index
  const coordinateKey = (vector) =>
    [vector.x, vector.y, vector.z]
      .map((component) => Math.round(component * 1e6))
      .join(',')
  const uniqueCoordinates = new Map()
  for (let offset = 0; offset < geometry.drawRange.count; offset += 1) {
    const vertex = index ? index.getX(offset) : offset
    const point = new THREE.Vector3().fromBufferAttribute(position, vertex)
    uniqueCoordinates.set(coordinateKey(point), point)
  }
  const centre = [...uniqueCoordinates.values()].reduce(
    (result, point) => result.add(point),
    new THREE.Vector3(),
  ).multiplyScalar(1 / uniqueCoordinates.size)
  const edges = new Map()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let offset = 0; offset < geometry.drawRange.count; offset += 3) {
    a.fromBufferAttribute(position, index ? index.getX(offset) : offset)
    b.fromBufferAttribute(position, index ? index.getX(offset + 1) : offset + 1)
    c.fromBufferAttribute(position, index ? index.getX(offset + 2) : offset + 2)
    const points = [a.clone(), b.clone(), c.clone()]
    for (let edge = 0; edge < 3; edge += 1) {
      const keys = [
        coordinateKey(points[edge]),
        coordinateKey(points[(edge + 1) % 3]),
      ].sort()
      const key = keys.join('|')
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
    const normal = b.clone().sub(a).cross(c.clone().sub(a))
    const faceCentre = a.clone().add(b).add(c).multiplyScalar(1 / 3)
    assert.ok(
      normal.dot(faceCentre.sub(centre)) > 1e-10,
      `${label} triangle ${offset / 3} faces outward`,
    )
  }
  for (const [edge, count] of edges) {
    assert.equal(count, 2, `${label} shell edge ${edge} is shared exactly twice`)
  }
}

function assertOuterFrameState({
  outerFrame,
  outerEndCaps,
  outerFlatProfileRibs,
  outerCurvedProfileRibs,
  curved,
}) {
  assert.equal(outerFrame.visible, true)
  assert.equal(outerEndCaps.visible, true)
  assert.equal(outerEndCaps.children.length, 2)
  for (const endCap of outerEndCaps.children) {
    assert.equal(endCap.geometry.drawRange.count, 36)
  }
  assert.equal(outerFlatProfileRibs.count, curved ? 0 : 2)
  assert.equal(outerCurvedProfileRibs.count, curved ? 2 : 0)
  assert.equal(
    outerEndCaps.children.length +
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
const outerEndCaps = childByName(
  outerFrame,
  'LinarSupportOuterEndCaps',
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
assert.equal(outerFlatProfileRibs.geometry, sharedBoxGeometry)
assert.equal(outerCurvedProfileRibs.geometry, sharedProfileGeometry)
assert.equal(flatHorizontal.material, sharedMaterial)
assert.equal(curvedProfiles.material, sharedMaterial)
for (const endCap of outerEndCaps.children) {
  assert.equal(endCap.material, sharedMaterial)
  assert.notEqual(endCap.geometry, sharedBoxGeometry)
  assert.notEqual(endCap.geometry, sharedProfileGeometry)
}
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
  outerEndCaps,
  outerFlatProfileRibs,
  outerCurvedProfileRibs,
  curved: false,
})

assertEndCapBounds(
  outerEndCaps.children[0],
  { minX: -1.2, maxX: -1.16, minY: 0, maxY: 2.8, minZ: 0.001, maxZ: 0.045 },
  'flat start end cap',
)
assertEndCapBounds(
  outerEndCaps.children[1],
  { minX: 1.16, maxX: 1.2, minY: 0, maxY: 2.8, minZ: 0.001, maxZ: 0.045 },
  'flat finish end cap',
)

for (let index = 0; index < 2; index += 1) {
  const rib = instanceTransform(outerFlatProfileRibs, index)
  approximate(rib.scale.x, 2.4, `flat outer rib ${index + 1} width`)
  approximate(rib.scale.y, 0.04, `flat outer rib ${index + 1} thickness`)
  approximate(rib.scale.z, 0.044, `flat outer rib ${index + 1} depth`)
  approximate(rib.position.z, 0.023, `flat outer rib ${index + 1} Z`)
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

let canonicalOuterEndCapPositions
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
    outerEndCaps,
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
      outerFlatProfileRibs,
      outerCurvedProfileRibs,
    ) + outerEndCaps.children.length,
    stats.totalInstances,
    'reported total matches all active support instances',
  )
  const endCapPositions = outerEndCaps.children.map(geometryPositionValues)
  const ribMatrices = instanceMatrixValues(outerCurvedProfileRibs)
  if (canonicalOuterEndCapPositions) {
    assert.deepEqual(
      endCapPositions,
      canonicalOuterEndCapPositions,
      'module seams cannot move or duplicate outer end caps',
    )
    assert.deepEqual(
      ribMatrices,
      canonicalOuterRibMatrices,
      'module seams cannot move or duplicate outer profile ribs',
    )
  } else {
    canonicalOuterEndCapPositions = endCapPositions
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
assertEndCapBounds(
  outerEndCaps.children[0],
  {
    minX: -1.2,
    maxX: -1.16,
    minY: 0,
    maxY: 2.8,
    minZ: 0.001,
    maxZ: 0.185,
  },
  'curved start end cap',
)
assertEndCapBounds(
  outerEndCaps.children[1],
  {
    minX: 1.16,
    maxX: 1.2,
    minY: 0,
    maxY: 2.8,
    minZ: 0.001,
    maxZ: 0.265,
  },
  'curved finish end cap',
)
for (let index = 0; index < 2; index += 1) {
  const rib = instanceTransform(outerCurvedProfileRibs, index)
  approximate(rib.scale.x, 1, `curved outer rib ${index + 1} X scale`)
  approximate(rib.scale.y, 0.04, `curved outer rib ${index + 1} thickness`)
  approximate(rib.scale.z, 1, `curved outer rib ${index + 1} Z scale`)
  approximate(rib.position.y, index === 0 ? 0 : 2.8, `curved outer rib ${index + 1} Y`)
}

// Reversing a C bend updates the two local terminal cells only; it may never
// turn them into tangent-extrapolated full-installation wings.
const forwardC = {
  ...curvedBounds,
  supportPathXZ: curvedBounds.supportPathXZ.map((point) => ({
    ...point,
    z: -point.z,
    rotY: -point.rotY,
  })),
}
support.update({ application: 'wall', panelCount: 2, bounds: forwardC })
assertOuterFrameState({
  outerFrame,
  outerEndCaps,
  outerFlatProfileRibs,
  outerCurvedProfileRibs,
  curved: true,
})
assertEndCapBounds(
  outerEndCaps.children[0],
  {
    minX: -1.2,
    maxX: -1.16,
    minY: 0,
    maxY: 2.8,
    minZ: 0.001,
    maxZ: 0.20375,
  },
  'mirrored C start end cap',
)
assertEndCapBounds(
  outerEndCaps.children[1],
  {
    minX: 1.16,
    maxX: 1.2,
    minY: 0,
    maxY: 2.8,
    minZ: 0.001,
    maxZ: 0.125,
  },
  'mirrored C finish end cap',
)

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
  outerEndCaps,
  outerFlatProfileRibs,
  outerCurvedProfileRibs,
  curved: true,
})
for (const [index, endCap] of outerEndCaps.children.entries()) {
  assertFiniteActiveGeometry(endCap.geometry, `S curve end cap ${index + 1}`)
  assertNonDegenerateActiveTriangles(endCap.geometry, `S curve end cap ${index + 1}`)
  assertClosedOutwardGeometry(endCap.geometry, `S curve end cap ${index + 1}`)
}
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
for (const [index, endCap] of outerEndCaps.children.entries()) {
  assertFiniteActiveGeometry(endCap.geometry, `mirrored S end cap ${index + 1}`)
  assertNonDegenerateActiveTriangles(endCap.geometry, `mirrored S end cap ${index + 1}`)
  assertClosedOutwardGeometry(endCap.geometry, `mirrored S end cap ${index + 1}`)
}

// A 90-degree endpoint tangent must still produce a closed solid. Keeping the
// receiver edge on a global 40 mm inset prevents a zero-width folded sheet.
const verticalTangentBounds = {
  ...flatBounds,
  supportPathXZ: [
    { x: -1.2, z: 0, rotY: Math.PI * 0.5, distanceM: 0 },
    { x: -1.2, z: 0.08, rotY: Math.PI * 0.5, distanceM: 0.08 },
    { x: 0, z: 0.24, rotY: 0, distanceM: 1.3 },
    { x: 1.2, z: 0.08, rotY: -Math.PI * 0.5, distanceM: 2.52 },
    { x: 1.2, z: 0, rotY: -Math.PI * 0.5, distanceM: 2.6 },
  ],
  seamPathDistancesM: [1.3],
}
support.update({
  application: 'wall',
  panelCount: 2,
  bounds: verticalTangentBounds,
})
assertEndCapBounds(
  outerEndCaps.children[0],
  {
    minX: -1.2,
    maxX: -1.16,
    minY: 0,
    maxY: 2.8,
    minZ: 0.001,
    maxZ: 0.085,
  },
  'vertical-tangent start end cap',
)
assertEndCapBounds(
  outerEndCaps.children[1],
  {
    minX: 1.16,
    maxX: 1.2,
    minY: 0,
    maxY: 2.8,
    minZ: 0.001,
    maxZ: 0.085,
  },
  'vertical-tangent finish end cap',
)

// Folded S paths can initially travel outside the global endpoint-to-endpoint
// direction. The caps must follow that local terminal cell instead of twisting
// back toward the opposite end of the complete installation.
const foldedTerminalBounds = {
  ...flatBounds,
  supportPathXZ: [
    { x: -1.2, z: 0.1, rotY: -0.46, distanceM: 0 },
    { x: -1.28, z: 0.12, rotY: -0.46, distanceM: 0.08 },
    { x: 0, z: 0, rotY: 0, distanceM: 1.3 },
    { x: 1.28, z: 0.12, rotY: 0.46, distanceM: 2.52 },
    { x: 1.2, z: 0.1, rotY: 0.46, distanceM: 2.6 },
  ],
  seamPathDistancesM: [1.3],
}
support.update({
  application: 'ceiling',
  panelCount: 2,
  bounds: foldedTerminalBounds,
})
assertEndCapBounds(
  outerEndCaps.children[0],
  {
    minX: -1.24,
    maxX: -1.2,
    minY: 0,
    maxY: 2.8,
    minZ: 0.001,
    maxZ: 0.155,
  },
  'folded-terminal start end cap',
)
assertEndCapBounds(
  outerEndCaps.children[1],
  {
    minX: 1.2,
    maxX: 1.24,
    minY: 0,
    maxY: 2.8,
    minZ: 0.001,
    maxZ: 0.155,
  },
  'folded-terminal finish end cap',
)

// Opaque felt hides only interior members. The two solid end caps and the two
// outer ribs stay present for flat, C/S and repeated Wall/Ceiling installations.
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
    outerEndCaps,
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
assert.equal(outerEndCaps.visible, false)
for (const endCap of outerEndCaps.children) {
  assert.equal(endCap.geometry.drawRange.count, 0)
}
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
  outerEndCaps,
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
const endCapDisposeCounts = outerEndCaps.children.map(() => 0)
sharedBoxGeometry.addEventListener('dispose', () => {
  boxDisposeCount += 1
})
sharedProfileGeometry.addEventListener('dispose', () => {
  profileDisposeCount += 1
})
sharedMaterial.addEventListener('dispose', () => {
  materialDisposeCount += 1
})
for (const [index, endCap] of outerEndCaps.children.entries()) {
  endCap.geometry.addEventListener('dispose', () => {
    endCapDisposeCounts[index] += 1
  })
}
support.dispose()
support.dispose()
assert.equal(boxDisposeCount, 1, 'shared box geometry is disposed once')
assert.equal(profileDisposeCount, 1, 'shared profile geometry is disposed once')
assert.deepEqual(endCapDisposeCounts, [1, 1], 'outer end-cap geometries dispose once')
assert.equal(materialDisposeCount, 1, 'shared support material is disposed once')

console.log('LINAR solid-end perimeter-frame support checks passed.')
