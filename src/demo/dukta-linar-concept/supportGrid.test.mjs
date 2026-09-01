import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createLinarSupportGrid } from './supportGrid.ts'

function childByName(group, name) {
  const child = group.getObjectByName(name)
  assert.ok(child, `expected ${name}`)
  return child
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

const flatStats = support.update({
  application: 'wall',
  panelCount: 2,
  bounds: flatBounds,
})
assert.deepEqual(flatStats, {
  verticalBattens: 7,
  horizontalBattens: 8,
  totalInstances: 15,
  visible: true,
})
const vertical = childByName(support.group, 'LinarSupportVerticalBattens')
const flatHorizontal = childByName(
  support.group,
  'LinarSupportHorizontalBattens',
)
const curvedProfiles = childByName(
  support.group,
  'LinarSupportContinuousCurvedProfileRibs',
)
assert.equal(flatHorizontal.count, 8)
assert.equal(curvedProfiles.count, 0)

const sharedBoxGeometry = vertical.geometry
const sharedMaterial = vertical.material
const sharedProfileGeometry = curvedProfiles.geometry
const curvedBounds = {
  ...flatBounds,
  supportPathXZ: [
    { x: -1.2, z: 0, rotY: -0.45, distanceM: 0 },
    { x: -0.6, z: 0.22, rotY: -0.2, distanceM: 0.64 },
    { x: 0, z: 0.3, rotY: 0, distanceM: 1.25 },
    { x: 0.6, z: 0.22, rotY: 0.2, distanceM: 1.86 },
    { x: 1.2, z: 0, rotY: 0.45, distanceM: 2.5 },
  ],
  seamPathDistancesM: [1.25],
}
const curvedStats = support.update({
  application: 'ceiling',
  panelCount: 2,
  bounds: curvedBounds,
})
assert.equal(curvedStats.visible, true)
assert.equal(curvedStats.horizontalBattens, 8)
assert.equal(flatHorizontal.count, 0)
assert.equal(curvedProfiles.count, 8)
assert.equal(vertical.geometry, sharedBoxGeometry)
assert.equal(vertical.material, sharedMaterial)
assert.equal(curvedProfiles.geometry, sharedProfileGeometry)
assert.equal(
  curvedProfiles.geometry.drawRange.count,
  (curvedBounds.supportPathXZ.length - 1) * 24,
)
const profilePosition = curvedProfiles.geometry.getAttribute('position')
for (const component of profilePosition.array.slice(
  0,
  curvedBounds.supportPathXZ.length * 4 * 3,
)) {
  assert.ok(Number.isFinite(component), 'curved profile buffer contains no NaN/Infinity')
}
for (let index = 0; index < curvedBounds.supportPathXZ.length; index += 1) {
  const frontBottom = index * 4
  const backBottom = frontBottom + 2
  assert.ok(Number.isFinite(profilePosition.getX(frontBottom)))
  assert.ok(Number.isFinite(profilePosition.getZ(frontBottom)))
  assert.ok(Number.isFinite(profilePosition.getX(backBottom)))
  assert.ok(Number.isFinite(profilePosition.getZ(backBottom)))
  assert.ok(
    Math.abs(profilePosition.getZ(backBottom) - 0.001) < 1e-7,
    'curved profile rear edge stays on one receiver plane',
  )
  assert.ok(
    profilePosition.getZ(frontBottom) > profilePosition.getZ(backBottom),
    'curved profile has positive depth from receiver to panel contour',
  )
}

// The seam is one mandatory path-distance anchor, not two panel-local edge
// battens. With the 400 mm reference spacing this 2.5 m path needs eight
// longitudinal members in total, including both installation edges.
assert.equal(curvedStats.verticalBattens, 9)
assert.equal(curvedStats.totalInstances, 17)

const matrix = new THREE.Matrix4()
const scale = new THREE.Vector3()
vertical.getMatrixAt(4, matrix)
matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale)
assert.ok(Math.abs(scale.y - 2.8) < 1e-6, 'curved connecting member spans height')

const hiddenStats = support.update({
  application: 'freestanding',
  panelCount: 2,
  bounds: curvedBounds,
})
assert.equal(hiddenStats.visible, false)
assert.equal(support.group.visible, false)
assert.equal(vertical.count, 0)
assert.equal(curvedProfiles.count, 0)

support.dispose()
console.log('LINAR continuous flat/curved support checks passed.')
