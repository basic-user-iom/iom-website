import assert from 'node:assert/strict'
import { BoxGeometry, BufferAttribute, BufferGeometry, Vector2 } from 'three'
import {
  analyzeStairSupport,
  inferStairAscent,
  inferStairAscentFromTreads,
  makeStairProxyGeometry,
} from '../src/collision/stairGeometry'

function point(
  direction: Vector2,
  side: Vector2,
  run: number,
  across: number,
  y: number,
): [number, number, number] {
  return [
    direction.x * run + side.x * across,
    y,
    direction.y * run + side.y * across,
  ]
}

function pushTriangle(
  values: number[],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
): void {
  values.push(...a, ...b, ...c)
}

/** A solid CAD-like flight with side/riser faces but no walkable top faces. */
function makeUnsupportedFlight(direction: Vector2): BufferGeometry {
  const axis = direction.clone().normalize()
  const side = new Vector2(-axis.y, axis.x)
  const values: number[] = []
  const sections = 10
  const runLength = 4.5
  const halfWidth = 0.48
  const baseY = -0.25

  for (let i = 0; i < sections - 1; i++) {
    const run0 = (i / (sections - 1)) * runLength
    const run1 = ((i + 1) / (sections - 1)) * runLength
    const top0 = (i / (sections - 1)) * 2.1
    const top1 = ((i + 1) / (sections - 1)) * 2.1
    for (const across of [-halfWidth, halfWidth]) {
      const low0 = point(axis, side, run0, across, baseY)
      const low1 = point(axis, side, run1, across, baseY)
      const high0 = point(axis, side, run0, across, top0)
      const high1 = point(axis, side, run1, across, top1)
      pushTriangle(values, low0, high0, high1)
      pushTriangle(values, low0, high1, low1)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(values), 3))
  return geometry
}

function makeAuthoredRamp(direction: Vector2): BufferGeometry {
  const axis = direction.clone().normalize()
  const side = new Vector2(-axis.y, axis.x)
  const a = point(axis, side, 0, -0.5, 0)
  const b = point(axis, side, 0, 0.5, 0)
  const c = point(axis, side, 4, 0.5, 1.8)
  const d = point(axis, side, 4, -0.5, 1.8)
  const values: number[] = []
  pushTriangle(values, a, b, c)
  pushTriangle(values, a, c, d)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(values), 3))
  return geometry
}

function makeSparseTreads(direction: Vector2): BufferGeometry {
  const axis = direction.clone().normalize()
  const side = new Vector2(-axis.y, axis.x)
  const values: number[] = []
  const width = 1.2
  for (let i = 0; i < 9; i += 1) {
    const run0 = i * 0.32
    const run1 = run0 + 0.045
    const y = i * 0.18
    const a = point(axis, side, run0, -width * 0.5, y)
    const b = point(axis, side, run0, width * 0.5, y)
    const c = point(axis, side, run1, width * 0.5, y)
    const d = point(axis, side, run1, -width * 0.5, y)
    pushTriangle(values, a, b, c)
    pushTriangle(values, a, c, d)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(values), 3))
  return geometry
}

const directions = [
  ['+X', new Vector2(1, 0)],
  ['-X', new Vector2(-1, 0)],
  ['+Z', new Vector2(0, 1)],
  ['-Z', new Vector2(0, -1)],
] as const

for (const [label, expected] of directions) {
  const authored = makeUnsupportedFlight(expected)
  const support = analyzeStairSupport(authored)
  assert.equal(support.usable, false, `${label}: unsupported fixture must need fallback`)

  const inferred = inferStairAscent(authored)
  assert.ok(inferred, `${label}: ascent should be inferred`)
  assert.ok(inferred.axis.dot(expected) > 0.98, `${label}: ascent sign/axis is reversed`)
  assert.ok(inferred.confidence > 0.45, `${label}: confidence unexpectedly weak`)

  const proxy = makeStairProxyGeometry(inferred)
  assert.ok(proxy, `${label}: proxy should be generated`)
  const proxySupport = analyzeStairSupport(proxy)
  assert.equal(proxySupport.usable, true, `${label}: proxy must expose distributed tread support`)
  proxy.dispose()
  authored.dispose()

  const sparse = makeSparseTreads(expected)
  const sparseSupport = analyzeStairSupport(sparse)
  assert.equal(
    sparseSupport.usable,
    false,
    `${label}: capsule-narrow authored treads must receive a safer proxy`,
  )
  assert.ok(
    sparseSupport.medianTreadDepth != null && sparseSupport.medianTreadDepth < 0.1,
    `${label}: shallow tread depth was not measured`,
  )
  const treadInferred = inferStairAscentFromTreads(sparse)
  assert.ok(treadInferred, `${label}: sparse tread direction should be inferred`)
  assert.ok(treadInferred.axis.dot(expected) > 0.98, `${label}: sparse tread ascent is reversed`)
  const sparseProxy = makeStairProxyGeometry(treadInferred)
  assert.ok(sparseProxy, `${label}: shallow treads should receive a capsule-compatible proxy`)
  const sparseProxySupport = analyzeStairSupport(sparseProxy)
  assert.equal(sparseProxySupport.usable, true, `${label}: shallow-tread proxy must be walkable`)
  assert.ok(
    sparseProxySupport.medianTreadDepth != null && sparseProxySupport.medianTreadDepth >= 0.279,
    `${label}: proxy treads remain too shallow (${sparseProxySupport.medianTreadDepth})`,
  )
  sparseProxy.dispose()
  sparse.dispose()
}

const ramp = makeAuthoredRamp(new Vector2(-1, 0))
assert.equal(analyzeStairSupport(ramp).usable, true, 'authored ramp should be preserved')
ramp.dispose()

const ambiguous = new BoxGeometry(4, 2, 1)
assert.equal(inferStairAscent(ambiguous), null, 'symmetric box must not receive a guessed ascent')
assert.equal(
  inferStairAscentFromTreads(ambiguous),
  null,
  'single-level box must not receive a tread-derived ascent',
)
ambiguous.dispose()

console.info('Stair geometry diagnostic passed: +X, -X, +Z, -Z, authored support, ambiguity guard')
