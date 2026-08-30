import { BufferAttribute } from 'three'

export const HARP_PART = Object.freeze({
  wood: 0,
  metal: 1,
  string: 2,
  legacyCrest: 3,
})

function makeDisjointSet(count) {
  const parent = new Uint32Array(count)
  const rank = new Uint8Array(count)
  for (let i = 0; i < count; i++) parent[i] = i

  const find = (value) => {
    let root = value
    while (parent[root] !== root) root = parent[root]
    while (parent[value] !== value) {
      const next = parent[value]
      parent[value] = root
      value = next
    }
    return root
  }

  const union = (a, b) => {
    a = find(a)
    b = find(b)
    if (a === b) return
    if (rank[a] < rank[b]) [a, b] = [b, a]
    parent[b] = a
    if (rank[a] === rank[b]) rank[a]++
  }

  return { find, union }
}

/**
 * Bake a stable material class onto each disconnected physical part.
 *
 * The source model has one mesh and one texture atlas, but its wooden frame,
 * strings, tuning pins and mechanisms are separate geometry islands. Using
 * those islands avoids guessing the material from atlas colour, which breaks
 * as soon as the wood texture is replaced.
 */
export function assignHarpPartAttribute(geometry) {
  const existing = geometry.getAttribute('harpPart')
  if (existing && geometry.userData.harpPartComponents) {
    return geometry.userData.harpPartSummary ?? null
  }
  if (existing) geometry.deleteAttribute('harpPart')

  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  if (!position || !index) return null

  const vertexCount = position.count
  const { find, union } = makeDisjointSet(vertexCount)

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i)
    union(a, index.getX(i + 1))
    union(a, index.getX(i + 2))
  }

  const globalMin = [Infinity, Infinity, Infinity]
  const globalMax = [-Infinity, -Infinity, -Infinity]
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    for (let axis = 0; axis < 3; axis++) {
      const value = position.array[vertex * position.itemSize + axis]
      globalMin[axis] = Math.min(globalMin[axis], value)
      globalMax[axis] = Math.max(globalMax[axis], value)
    }
  }

  const overallSize = globalMax.map((value, axis) => value - globalMin[axis])
  const overallScale = Math.max(...overallSize)
  const weldScale = 1 / Math.max(overallScale * 1e-5, 1e-8)
  const coincident = new Map()

  // Unity duplicates vertices at UV and normal seams. Welding coincident
  // positions reconnects the faces of each physical component.
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const offset = vertex * position.itemSize
    const key = `${Math.round(position.array[offset] * weldScale)},${Math.round(
      position.array[offset + 1] * weldScale,
    )},${Math.round(position.array[offset + 2] * weldScale)}`
    const match = coincident.get(key)
    if (match == null) coincident.set(key, vertex)
    else union(vertex, match)
  }

  const components = new Map()
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const root = find(vertex)
    let component = components.get(root)
    if (!component) {
      component = {
        vertices: [],
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
      }
      components.set(root, component)
    }
    component.vertices.push(vertex)
    for (let axis = 0; axis < 3; axis++) {
      const value = position.array[vertex * position.itemSize + axis]
      component.min[axis] = Math.min(component.min[axis], value)
      component.max[axis] = Math.max(component.max[axis], value)
    }
  }

  const overallVolume = overallSize[0] * overallSize[1] * overallSize[2]
  const partValues = new Float32Array(vertexCount)
  const crestCandidates = [...components.values()].filter((component) => {
    const size = component.max.map((value, axis) => value - component.min[axis])
    const centerY = ((component.min[1] + component.max[1]) * 0.5 - globalMin[1]) / overallSize[1]
    const centerZ = ((component.min[2] + component.max[2]) * 0.5 - globalMin[2]) / overallSize[2]
    return (
      component.vertices.length >= 500 &&
      component.vertices.length <= 650 &&
      size[0] / overallScale > 0.0038 &&
      size[0] / overallScale < 0.0043 &&
      size[1] / overallScale > 0.046 &&
      size[1] / overallScale < 0.049 &&
      size[2] / overallScale > 0.034 &&
      size[2] / overallScale < 0.037 &&
      centerY > 0.8 &&
      centerY < 0.83 &&
      centerZ > 0.05 &&
      centerZ < 0.08
    )
  })
  const crestPairTolerance = overallScale * 0.0015
  const hasCongruentCrestPair =
    crestCandidates.length === 2 &&
    [1, 2].every(
      (axis) =>
        Math.abs(crestCandidates[0].min[axis] - crestCandidates[1].min[axis]) <
          crestPairTolerance &&
        Math.abs(crestCandidates[0].max[axis] - crestCandidates[1].max[axis]) <
          crestPairTolerance,
    )
  const legacyCrestComponents = new Set(hasCongruentCrestPair ? crestCandidates : [])
  const summary = {
    wood: 0,
    metal: 0,
    string: 0,
    legacyCrest: 0,
    components: components.size,
  }
  const componentRecords = []

  for (const component of components.values()) {
    const size = component.max.map((value, axis) => value - component.min[axis])
    const volume = size[0] * size[1] * size[2]
    const longest = Math.max(...size)
    const thinnest = Math.min(...size)

    const legacyCrest = legacyCrestComponents.has(component)
    let part = legacyCrest ? HARP_PART.legacyCrest : HARP_PART.metal
    if (!legacyCrest && volume > overallVolume * 0.01) {
      part = HARP_PART.wood
    } else if (
      !legacyCrest &&
      longest > overallScale * 0.06 &&
      thinnest < overallScale * 0.015
    ) {
      part = HARP_PART.string
    }

    const label =
      part === HARP_PART.wood
        ? 'wood'
        : part === HARP_PART.string
          ? 'string'
          : part === HARP_PART.legacyCrest
            ? 'legacyCrest'
            : 'metal'
    summary[label]++
    for (const vertex of component.vertices) partValues[vertex] = part
    componentRecords.push({
      part,
      vertices: component.vertices,
      min: component.min,
      max: component.max,
    })
  }

  geometry.setAttribute('harpPart', new BufferAttribute(partValues, 1))
  geometry.userData.harpPartSummary = summary
  geometry.userData.harpPartComponents = componentRecords
  return summary
}
