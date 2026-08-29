/**
 * Exact weighted-overlap analysis for axis-aligned streamed payload bounds.
 *
 * All resource weights are non-negative. Therefore a maximum overlap exists at
 * one of the closed interval event coordinates on each axis. Starts are added
 * before evaluation and ends are removed afterwards so touching closed bounds
 * are handled conservatively and deterministically.
 */

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function finiteTuple(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
}

function eventMap(items, axis, margin) {
  const events = new Map()
  const add = (coordinate, kind, item) => {
    let event = events.get(coordinate)
    if (!event) {
      event = { coordinate, starts: [], ends: [] }
      events.set(coordinate, event)
    }
    event[kind].push(item)
  }
  for (const item of items) {
    add(item.bounds.min[axis] - margin, 'starts', item)
    add(item.bounds.max[axis] + margin, 'ends', item)
  }
  return [...events.values()].sort((left, right) => left.coordinate - right.coordinate)
}

function orderedItems(values) {
  return [...values].sort((left, right) => left.id.localeCompare(right.id))
}

function emptyTotals(metricKeys) {
  return Object.fromEntries(metricKeys.map((key) => [key, 0]))
}

function totalsFor(items, metricKeys) {
  const totals = emptyTotals(metricKeys)
  for (const item of items) {
    for (const key of metricKeys) totals[key] += item.estimate[key]
  }
  return totals
}

function consider(active, focus, metricKeys, worstByMetric, stats) {
  stats.focusSetsExamined += 1
  if (active.size === 0) return
  const items = orderedItems(active)
  const totals = totalsFor(items, metricKeys)
  for (const key of metricKeys) {
    const previous = worstByMetric[key]
    if (!previous || totals[key] > previous.totals[key]) {
      worstByMetric[key] = {
        focus: [...focus],
        packageCount: items.length,
        packageIds: items.map((item) => item.id),
        totals: { ...totals },
      }
    }
  }
}

function scanZ(items, x, y, margin, metricKeys, worstByMetric, stats) {
  const active = new Set()
  for (const event of eventMap(items, 2, margin)) {
    for (const item of event.starts) active.add(item)
    consider(active, [x, y, event.coordinate], metricKeys, worstByMetric, stats)
    for (const item of event.ends) active.delete(item)
  }
}

function scanY(items, x, margin, metricKeys, worstByMetric, stats) {
  const active = new Set()
  for (const event of eventMap(items, 1, margin)) {
    for (const item of event.starts) active.add(item)
    scanZ(active, x, event.coordinate, margin, metricKeys, worstByMetric, stats)
    for (const item of event.ends) active.delete(item)
  }
}

function validateInputs(items, metricKeys, margin) {
  assert(Array.isArray(items) && items.length > 0, 'items must be a non-empty array')
  assert(Array.isArray(metricKeys) && metricKeys.length > 0, 'metricKeys must be a non-empty array')
  assert(new Set(metricKeys).size === metricKeys.length, 'metricKeys must be unique')
  assert(Number.isFinite(margin) && margin >= 0, 'margin must be finite and non-negative')
  const ids = new Set()
  for (const [index, item] of items.entries()) {
    assert(typeof item?.id === 'string' && item.id.length > 0, `items[${index}].id must be non-empty`)
    assert(!ids.has(item.id), `duplicate item id: ${item.id}`)
    ids.add(item.id)
    assert(finiteTuple(item?.bounds?.min) && finiteTuple(item?.bounds?.max), `${item.id}: invalid bounds`)
    assert(
      item.bounds.max.every((value, axis) => value >= item.bounds.min[axis]),
      `${item.id}: bounds max must be >= min`,
    )
    for (const key of metricKeys) {
      assert(
        Number.isFinite(item?.estimate?.[key]) && item.estimate[key] >= 0,
        `${item.id}: estimate.${key} must be finite and non-negative`,
      )
    }
  }
}

export function analyzeSpatialResidentWindow({ items, metricKeys, margin = 0 }) {
  validateInputs(items, metricKeys, margin)
  const ordered = orderedItems(items)
  const active = new Set()
  const worstByMetric = Object.fromEntries(metricKeys.map((key) => [key, null]))
  const stats = { xEvents: 0, focusSetsExamined: 0 }

  for (const event of eventMap(ordered, 0, margin)) {
    for (const item of event.starts) active.add(item)
    stats.xEvents += 1
    scanY(active, event.coordinate, margin, metricKeys, worstByMetric, stats)
    for (const item of event.ends) active.delete(item)
  }

  return {
    exact: true,
    closedBounds: true,
    margin,
    itemCount: ordered.length,
    metricKeys: [...metricKeys],
    worstByMetric,
    stats,
  }
}

function validateResourceInputs(items, metricKeys, margin) {
  assert(Array.isArray(items) && items.length > 0, 'items must be a non-empty array')
  assert(Array.isArray(metricKeys) && metricKeys.length > 0, 'metricKeys must be a non-empty array')
  assert(new Set(metricKeys).size === metricKeys.length, 'metricKeys must be unique')
  assert(Number.isFinite(margin) && margin >= 0, 'margin must be finite and non-negative')
  const itemIds = new Set()
  const resourceDefinitions = new Map()
  for (const [index, item] of items.entries()) {
    assert(typeof item?.id === 'string' && item.id.length > 0, `items[${index}].id must be non-empty`)
    assert(!itemIds.has(item.id), `duplicate item id: ${item.id}`)
    itemIds.add(item.id)
    assert(finiteTuple(item?.bounds?.min) && finiteTuple(item?.bounds?.max), `${item.id}: invalid bounds`)
    assert(item.bounds.max.every((value, axis) => value >= item.bounds.min[axis]),
      `${item.id}: bounds max must be >= min`)
    assert(Array.isArray(item.resources), `${item.id}: resources must be an array`)
    const localKeys = new Set()
    for (const [resourceIndex, resource] of item.resources.entries()) {
      assert(typeof resource?.key === 'string' && resource.key.length > 0,
        `${item.id}: resources[${resourceIndex}].key must be non-empty`)
      assert(!localKeys.has(resource.key), `${item.id}: duplicate resource key ${resource.key}`)
      localKeys.add(resource.key)
      const definition = {}
      for (const key of metricKeys) {
        assert(Number.isFinite(resource?.estimate?.[key]) && resource.estimate[key] >= 0,
          `${item.id}:${resource.key}: estimate.${key} must be finite and non-negative`)
        definition[key] = resource.estimate[key]
      }
      const previous = resourceDefinitions.get(resource.key)
      if (previous) {
        for (const key of metricKeys) assert(previous[key] === definition[key],
          `${resource.key}: conflicting estimate.${key} across items`)
      } else resourceDefinitions.set(resource.key, definition)
    }
  }
}

function resourceTotalsFor(items, metricKeys) {
  const resources = new Map()
  for (const item of items) for (const resource of item.resources) {
    if (!resources.has(resource.key)) resources.set(resource.key, resource)
  }
  const totals = emptyTotals(metricKeys)
  for (const resource of resources.values()) {
    for (const key of metricKeys) totals[key] += resource.estimate[key]
  }
  return { totals, resourceCount: resources.size }
}

function considerResources(active, focus, metricKeys, worstByMetric, stats) {
  stats.focusSetsExamined += 1
  if (active.size === 0) return
  const items = orderedItems(active)
  const { totals, resourceCount } = resourceTotalsFor(items, metricKeys)
  for (const key of metricKeys) {
    const previous = worstByMetric[key]
    if (!previous || totals[key] > previous.totals[key]) {
      worstByMetric[key] = {
        focus: [...focus],
        packageCount: items.length,
        packageIds: items.map((item) => item.id),
        resourceCount,
        totals: { ...totals },
      }
    }
  }
}

function scanZResources(items, x, y, margin, metricKeys, worstByMetric, stats) {
  const active = new Set()
  for (const event of eventMap(items, 2, margin)) {
    for (const item of event.starts) active.add(item)
    considerResources(active, [x, y, event.coordinate], metricKeys, worstByMetric, stats)
    for (const item of event.ends) active.delete(item)
  }
}

function scanYResources(items, x, margin, metricKeys, worstByMetric, stats) {
  const active = new Set()
  for (const event of eventMap(items, 1, margin)) {
    for (const item of event.starts) active.add(item)
    scanZResources(active, x, event.coordinate, margin, metricKeys, worstByMetric, stats)
    for (const item of event.ends) active.delete(item)
  }
}

/** Exact closed-AABB overlap analysis where identical resource keys are counted once. */
export function analyzeSpatialResidentResourceWindow({ items, metricKeys, margin = 0 }) {
  validateResourceInputs(items, metricKeys, margin)
  const ordered = orderedItems(items)
  const active = new Set()
  const worstByMetric = Object.fromEntries(metricKeys.map((key) => [key, null]))
  const stats = { xEvents: 0, focusSetsExamined: 0 }

  for (const event of eventMap(ordered, 0, margin)) {
    for (const item of event.starts) active.add(item)
    stats.xEvents += 1
    scanYResources(active, event.coordinate, margin, metricKeys, worstByMetric, stats)
    for (const item of event.ends) active.delete(item)
  }

  return {
    exact: true,
    closedBounds: true,
    uniqueResourceKeys: true,
    margin,
    itemCount: ordered.length,
    metricKeys: [...metricKeys],
    worstByMetric,
    stats,
  }
}

export function evaluateSpatialBudget(analysis, budgets) {
  const metrics = {}
  let passed = true
  for (const key of analysis.metricKeys) {
    const budget = budgets[key]
    assert(Number.isFinite(budget) && budget >= 0, `budget.${key} must be finite and non-negative`)
    const value = analysis.worstByMetric[key]?.totals?.[key] ?? 0
    const metricPassed = value <= budget
    passed &&= metricPassed
    metrics[key] = {
      value,
      budget,
      utilization: budget === 0 ? (value === 0 ? 0 : null) : value / budget,
      passed: metricPassed,
      focus: analysis.worstByMetric[key]?.focus ?? null,
      packageCount: analysis.worstByMetric[key]?.packageCount ?? 0,
      packageIds: analysis.worstByMetric[key]?.packageIds ?? [],
    }
  }
  return { passed, metrics }
}
