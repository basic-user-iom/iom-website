import type { BufferGeometry } from 'three'

export type SurfaceTopology = {
  vertices: number
  weldedVertices: number
  triangles: number
  localSize: [number, number, number]
  boundaryEdges: number
  nonManifoldEdges: number
  windingConflictEdges: number
  boundaryRatio: number
}

const topologyCache = new WeakMap<BufferGeometry, SurfaceTopology>()

/**
 * Inspect a rendered triangle geometry after welding position-only seams.
 *
 * CAD/glTF meshes commonly duplicate vertices at UV and hard-normal seams. An
 * index-only edge count therefore calls even a closed box "open". Position
 * welding makes this test conservative enough to distinguish a watertight
 * shell from a façade, wall, ceiling, sign, or other genuinely open surface.
 */
export function inspectSurfaceTopology(geometry: BufferGeometry): SurfaceTopology {
  const cached = topologyCache.get(geometry)
  if (cached) return cached

  const position = geometry.getAttribute('position')
  const vertexCount = position?.count ?? 0
  if (!position || vertexCount < 3) {
    const empty = {
      vertices: vertexCount,
      weldedVertices: vertexCount,
      triangles: 0,
      localSize: [0, 0, 0] as [number, number, number],
      boundaryEdges: 0,
      nonManifoldEdges: 0,
      windingConflictEdges: 0,
      boundaryRatio: 0,
    }
    topologyCache.set(geometry, empty)
    return empty
  }

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const x = position.getX(vertex)
    const y = position.getY(vertex)
    const z = position.getZ(vertex)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    maxZ = Math.max(maxZ, z)
  }

  const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
  const tolerance = Math.max(1e-6, maxDim * 1e-6)
  const vertexByPosition = new Map<string, number>()
  const weldedVertex = new Uint32Array(vertexCount)
  let weldedVertices = 0
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const key = `${Math.round(position.getX(vertex) / tolerance)},${Math.round(position.getY(vertex) / tolerance)},${Math.round(position.getZ(vertex) / tolerance)}`
    let canonical = vertexByPosition.get(key)
    if (canonical === undefined) {
      canonical = weldedVertices
      weldedVertices += 1
      vertexByPosition.set(key, canonical)
    }
    weldedVertex[vertex] = canonical
  }

  const index = geometry.getIndex()
  const indexCount = index?.count ?? vertexCount
  const triangleCount = Math.floor(indexCount / 3)
  // Edge state: ±1 boundary direction, ±2 same-direction pair, 3 opposing
  // pair, 4 non-manifold. This stores count + winding in one Map.
  const edgeState = new Map<number, number>()
  const addEdge = (fromVertex: number, toVertex: number): void => {
    const from = weldedVertex[fromVertex]!
    const to = weldedVertex[toVertex]!
    if (from === to) return
    const low = Math.min(from, to)
    const high = Math.max(from, to)
    const key = low * weldedVertices + high
    const direction = from === low ? 1 : -1
    const previous = edgeState.get(key)
    if (previous === undefined) edgeState.set(key, direction)
    else if (previous === 1) edgeState.set(key, direction === 1 ? 2 : 3)
    else if (previous === -1) edgeState.set(key, direction === -1 ? -2 : 3)
    else edgeState.set(key, 4)
  }

  let triangles = 0
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3
    const a = index ? index.getX(offset) : offset
    const b = index ? index.getX(offset + 1) : offset + 1
    const c = index ? index.getX(offset + 2) : offset + 2
    if (
      weldedVertex[a] === weldedVertex[b] ||
      weldedVertex[b] === weldedVertex[c] ||
      weldedVertex[c] === weldedVertex[a]
    ) {
      continue
    }
    triangles += 1
    addEdge(a, b)
    addEdge(b, c)
    addEdge(c, a)
  }

  let boundaryEdges = 0
  let nonManifoldEdges = 0
  let windingConflictEdges = 0
  for (const state of edgeState.values()) {
    if (state === 1 || state === -1) boundaryEdges += 1
    else if (state === 2 || state === -2) windingConflictEdges += 1
    else if (state === 4) nonManifoldEdges += 1
  }

  const result = {
    vertices: vertexCount,
    weldedVertices,
    triangles,
    localSize: [maxX - minX, maxY - minY, maxZ - minZ] as [number, number, number],
    boundaryEdges,
    nonManifoldEdges,
    windingConflictEdges,
    boundaryRatio: edgeState.size ? boundaryEdges / edgeState.size : 0,
  }
  topologyCache.set(geometry, result)
  return result
}

/**
 * Open boundaries and inconsistent/non-manifold joins can expose a back face
 * even when a combined CAD primitive has a thick, three-axis bounding box.
 */
export function hasSurfaceVisibilityRisk(topology: SurfaceTopology): boolean {
  if (topology.triangles <= 0 || topology.boundaryEdges <= 0) return false
  // A few cross-material or tessellation seams are not enough to disable
  // culling. Protect materially open shells and explicit tiny sheet geometry;
  // boundary-free winding/non-manifold defects remain an offline repair error.
  return (
    topology.triangles <= 2 ||
    topology.boundaryEdges >= 24 ||
    topology.boundaryRatio >= 0.02
  )
}
