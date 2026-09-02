import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createFeltBackingGeometry } from './feltBackingGeometry.ts'

const SEGMENTS = 12
const HEIGHT_M = 2.8
const PANEL_HALF_THICKNESS_M = 0.0045
const FELT_THICKNESS_M = 0.002
const RENDER_GAP_M = 0.0001
const BODY_VERTICES_PER_SAMPLE = 8

function weldedVertexKey(position, index) {
  const quantum = 1e7
  return [
    Math.round(position.getX(index) * quantum),
    Math.round(position.getY(index) * quantum),
    Math.round(position.getZ(index) * quantum),
  ].join(',')
}

function assertClosedNonDegenerate(geometries, label) {
  const edgeIncidence = new Map()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()

  for (const geometry of geometries) {
    const position = geometry.getAttribute('position')
    const index = geometry.getIndex()
    assert.ok(index, `${label} geometry is indexed`)
    for (let offset = 0; offset < index.count; offset += 3) {
      const ai = index.getX(offset)
      const bi = index.getX(offset + 1)
      const ci = index.getX(offset + 2)
      a.fromBufferAttribute(position, ai)
      b.fromBufferAttribute(position, bi)
      c.fromBufferAttribute(position, ci)
      const doubledArea = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length()
      assert.ok(doubledArea > 1e-10, `${label} contains no collapsed triangle`)

      const triangle = [ai, bi, ci]
      for (let corner = 0; corner < 3; corner += 1) {
        const from = weldedVertexKey(position, triangle[corner])
        const to = weldedVertexKey(position, triangle[(corner + 1) % 3])
        const edge = from < to ? `${from}|${to}` : `${to}|${from}`
        edgeIncidence.set(edge, (edgeIncidence.get(edge) ?? 0) + 1)
      }
    }
  }

  for (const incidence of edgeIncidence.values()) {
    assert.equal(incidence, 2, `${label} has no open or non-manifold welded edge`)
  }
}

function assertFiniteUnitNormals(geometry, label) {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  for (const component of position.array) {
    assert.ok(Number.isFinite(component), `${label} positions are finite`)
  }
  for (const component of uv.array) {
    assert.ok(Number.isFinite(component), `${label} UVs are finite`)
  }
  for (let vertex = 0; vertex < normal.count; vertex += 1) {
    const length = Math.hypot(
      normal.getX(vertex),
      normal.getY(vertex),
      normal.getZ(vertex),
    )
    assert.ok(Math.abs(length - 1) < 1e-6, `${label} normals are unit length`)
  }
}

function makePath(shape) {
  const count = SEGMENTS + 1
  const x = new Float32Array(count)
  const z = new Float32Array(count)
  const rotationY = new Float32Array(count)
  for (let sample = 0; sample < count; sample += 1) {
    const u = sample / SEGMENTS
    x[sample] = -0.6 + 1.2 * u
    if (shape === 'flat') {
      z[sample] = 0
      rotationY[sample] = 0
    } else if (shape === 'c-reverse') {
      z[sample] = -0.18 * Math.sin(Math.PI * u)
      rotationY[sample] = 0.48 * Math.cos(Math.PI * u)
    } else {
      z[sample] = 0.12 * Math.sin(Math.PI * 2 * u)
      rotationY[sample] = -0.34 * Math.cos(Math.PI * 2 * u)
    }
  }
  return { x, z, rotationY }
}

const felt = createFeltBackingGeometry(SEGMENTS)
assert.equal(felt.segmentCount, SEGMENTS)
assert.equal(
  felt.body.getAttribute('position').count,
  (SEGMENTS + 1) * BODY_VERTICES_PER_SAMPLE,
)
assert.equal(felt.body.getIndex().count, SEGMENTS * 24)
assert.equal(felt.leftCap.getAttribute('position').count, 4)
assert.equal(felt.leftCap.getIndex().count, 6)
assert.equal(felt.rightCap.getAttribute('position').count, 4)
assert.equal(felt.rightCap.getIndex().count, 6)

const stableResources = {
  body: felt.body,
  bodyPosition: felt.body.getAttribute('position'),
  bodyNormal: felt.body.getAttribute('normal'),
  bodyIndex: felt.body.getIndex(),
  leftCap: felt.leftCap,
  rightCap: felt.rightCap,
}

for (const shape of ['flat', 's', 'c-reverse']) {
  const path = makePath(shape)
  felt.update(
    path.x,
    path.z,
    path.rotationY,
    HEIGHT_M,
    PANEL_HALF_THICKNESS_M,
    FELT_THICKNESS_M,
    RENDER_GAP_M,
  )

  assert.equal(felt.body, stableResources.body)
  assert.equal(felt.body.getAttribute('position'), stableResources.bodyPosition)
  assert.equal(felt.body.getAttribute('normal'), stableResources.bodyNormal)
  assert.equal(felt.body.getIndex(), stableResources.bodyIndex)
  assert.equal(felt.leftCap, stableResources.leftCap)
  assert.equal(felt.rightCap, stableResources.rightCap)

  const bodyPosition = felt.body.getAttribute('position')
  for (let sample = 0; sample <= SEGMENTS; sample += 1) {
    const base = sample * BODY_VERTICES_PER_SAMPLE
    const normalX = Math.sin(path.rotationY[sample])
    const normalZ = Math.cos(path.rotationY[sample])
    const frontDeltaX = bodyPosition.getX(base) - path.x[sample]
    const frontDeltaZ = bodyPosition.getZ(base) - path.z[sample]
    const rearDeltaX = bodyPosition.getX(base + 2) - bodyPosition.getX(base)
    const rearDeltaZ = bodyPosition.getZ(base + 2) - bodyPosition.getZ(base)
    const frontOffset = -(frontDeltaX * normalX + frontDeltaZ * normalZ)
    const feltDepth = -(rearDeltaX * normalX + rearDeltaZ * normalZ)
    assert.ok(
      Math.abs(frontOffset - (PANEL_HALF_THICKNESS_M + RENDER_GAP_M)) < 1e-6,
      `${shape} felt front stays immediately behind the panel rear`,
    )
    assert.ok(
      Math.abs(feltDepth - FELT_THICKNESS_M) < 1e-6,
      `${shape} felt has the representative 2 mm normal thickness`,
    )
  }

  assertClosedNonDegenerate(
    [felt.body, felt.leftCap, felt.rightCap],
    `${shape} felt volume`,
  )
  assertFiniteUnitNormals(felt.body, `${shape} felt body`)
  assertFiniteUnitNormals(felt.leftCap, `${shape} felt left cap`)
  assertFiniteUnitNormals(felt.rightCap, `${shape} felt right cap`)
}

const bodyPosition = felt.body.getAttribute('position')
let minimumY = Number.POSITIVE_INFINITY
let maximumY = Number.NEGATIVE_INFINITY
for (let vertex = 0; vertex < bodyPosition.count; vertex += 1) {
  minimumY = Math.min(minimumY, bodyPosition.getY(vertex))
  maximumY = Math.max(maximumY, bodyPosition.getY(vertex))
}
assert.equal(minimumY, 0)
assert.ok(Math.abs(maximumY - HEIGHT_M) < 1e-6)

felt.dispose()
console.log('LINAR closed wool-felt backing geometry checks passed.')
