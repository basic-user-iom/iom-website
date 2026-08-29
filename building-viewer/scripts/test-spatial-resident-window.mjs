import assert from 'node:assert/strict'

import {
  analyzeSpatialResidentResourceWindow,
  analyzeSpatialResidentWindow,
  evaluateSpatialBudget,
} from './lib/spatial-resident-window.mjs'

const box = (id, min, max, triangles, draws) => ({
  id,
  bounds: { min, max },
  estimate: { triangles, draws },
})

const touching = analyzeSpatialResidentWindow({
  items: [
    box('left', [0, 0, 0], [1, 1, 1], 10, 1),
    box('right', [1, 0, 0], [2, 1, 1], 20, 2),
    box('far', [10, 0, 0], [11, 1, 1], 100, 1),
  ],
  metricKeys: ['triangles', 'draws'],
})

assert.equal(touching.exact, true)
assert.deepEqual(touching.worstByMetric.triangles.packageIds, ['far'])
assert.equal(touching.worstByMetric.triangles.totals.triangles, 100)
assert.deepEqual(touching.worstByMetric.draws.packageIds, ['left', 'right'])
assert.equal(touching.worstByMetric.draws.totals.draws, 3)
assert.deepEqual(touching.worstByMetric.draws.focus, [1, 0, 0])

const expanded = analyzeSpatialResidentWindow({
  items: [
    box('a', [0, 0, 0], [1, 1, 1], 10, 2),
    box('b', [3, 0, 0], [4, 1, 1], 15, 3),
  ],
  metricKeys: ['triangles', 'draws'],
  margin: 1,
})
assert.deepEqual(expanded.worstByMetric.triangles.packageIds, ['a', 'b'])
assert.deepEqual(expanded.worstByMetric.triangles.focus, [2, -1, -1])
assert.equal(expanded.worstByMetric.triangles.totals.triangles, 25)

const pooled = analyzeSpatialResidentResourceWindow({
  items: [
    {
      id: 'left', bounds: { min: [0, 0, 0], max: [1, 1, 1] }, resources: [
        { key: 'shared', estimate: { bytes: 10, gpu: 100 } },
        { key: 'left-only', estimate: { bytes: 20, gpu: 200 } },
      ],
    },
    {
      id: 'right', bounds: { min: [1, 0, 0], max: [2, 1, 1] }, resources: [
        { key: 'shared', estimate: { bytes: 10, gpu: 100 } },
        { key: 'right-only', estimate: { bytes: 30, gpu: 300 } },
      ],
    },
  ],
  metricKeys: ['bytes', 'gpu'],
})
assert.equal(pooled.uniqueResourceKeys, true)
assert.equal(pooled.worstByMetric.bytes.totals.bytes, 60)
assert.equal(pooled.worstByMetric.gpu.totals.gpu, 600)
assert.equal(pooled.worstByMetric.gpu.resourceCount, 3)
assert.deepEqual(pooled.worstByMetric.gpu.packageIds, ['left', 'right'])

assert.throws(() => analyzeSpatialResidentResourceWindow({
  items: [
    { id: 'a', bounds: { min: [0, 0, 0], max: [1, 1, 1] }, resources: [
      { key: 'conflict', estimate: { bytes: 1 } },
    ] },
    { id: 'b', bounds: { min: [0, 0, 0], max: [1, 1, 1] }, resources: [
      { key: 'conflict', estimate: { bytes: 2 } },
    ] },
  ],
  metricKeys: ['bytes'],
}), /conflicting estimate\.bytes/)

const budget = evaluateSpatialBudget(expanded, { triangles: 25, draws: 4 })
assert.equal(budget.passed, false)
assert.equal(budget.metrics.triangles.passed, true)
assert.equal(budget.metrics.draws.passed, false)
assert.equal(budget.metrics.draws.value, 5)

assert.throws(
  () => analyzeSpatialResidentWindow({
    items: [box('bad', [1, 0, 0], [0, 1, 1], 1, 1)],
    metricKeys: ['triangles'],
  }),
  /bounds max must be >= min/,
)

// Compare the sweep against an exhaustive endpoint oracle on deterministic
// small fixtures. Closed interval maxima must include touching boundaries.
let seed = 0x1a2b3c4d
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 0x1_0000_0000
}
for (let fixture = 0; fixture < 20; fixture += 1) {
  const items = Array.from({ length: 6 }, (_, index) => {
    const min = Array.from({ length: 3 }, () => Math.floor(random() * 5))
    const size = Array.from({ length: 3 }, () => Math.floor(random() * 3))
    return box(
      `random-${index}`,
      min,
      min.map((value, axis) => value + size[axis]),
      1 + Math.floor(random() * 20),
      1 + Math.floor(random() * 4),
    )
  })
  const margin = fixture % 2 === 0 ? 0 : 0.5
  const exact = analyzeSpatialResidentWindow({ items, metricKeys: ['triangles', 'draws'], margin })
  const coordinates = [0, 1, 2].map((axis) => [...new Set(items.flatMap((item) => [
    item.bounds.min[axis] - margin,
    item.bounds.max[axis] + margin,
  ]))])
  const oracle = { triangles: 0, draws: 0 }
  for (const x of coordinates[0]) {
    for (const y of coordinates[1]) {
      for (const z of coordinates[2]) {
        const active = items.filter((item) => [x, y, z].every((coordinate, axis) =>
          coordinate >= item.bounds.min[axis] - margin && coordinate <= item.bounds.max[axis] + margin))
        oracle.triangles = Math.max(oracle.triangles, active.reduce((sum, item) => sum + item.estimate.triangles, 0))
        oracle.draws = Math.max(oracle.draws, active.reduce((sum, item) => sum + item.estimate.draws, 0))
      }
    }
  }
  assert.equal(exact.worstByMetric.triangles.totals.triangles, oracle.triangles)
  assert.equal(exact.worstByMetric.draws.totals.draws, oracle.draws)
}

console.log('Spatial resident-window tests passed.')
