export const IOM_SURFACE_TOPOLOGY_REPAIRED = 'iomSurfaceTopologyRepaired'
export const IOM_SURFACE_TOPOLOGY_REPAIR = 'iomSurfaceTopologyRepair'
export const IOM_SURFACE_TOPOLOGY_REPAIR_VERSION =
  'weld-seams-recalculate-normals-v1'

export function hasExactSurfaceRepairCertificate(extras) {
  return Boolean(
    extras?.[IOM_SURFACE_TOPOLOGY_REPAIRED] === true &&
      extras?.[IOM_SURFACE_TOPOLOGY_REPAIR] ===
        IOM_SURFACE_TOPOLOGY_REPAIR_VERSION,
  )
}

function hasAnySurfaceRepairCertificate(extras) {
  return Boolean(
    extras &&
      (Object.prototype.hasOwnProperty.call(
        extras,
        IOM_SURFACE_TOPOLOGY_REPAIRED,
      ) ||
        Object.prototype.hasOwnProperty.call(
          extras,
          IOM_SURFACE_TOPOLOGY_REPAIR,
        )),
  )
}

/**
 * Audit a whole glTF mesh after welding position-only seams across every
 * material primitive. Primitive-local audits falsely call a closed logical
 * mesh open wherever two materials meet.
 */
export function meshSurfaceTopology(mesh) {
  const primitives = mesh.listPrimitives()
  let vertices = 0
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  let unsupportedPrimitives = 0
  let malformedPrimitives = 0
  let looseEdges = 0
  let invalidPositionValues = 0

  for (const primitive of primitives) {
    const position = primitive.getAttribute('POSITION')
    if (!position || position.getElementSize() !== 3) {
      unsupportedPrimitives += 1
      continue
    }
    const mode = primitive.getMode()
    const elementCount = primitive.getIndices()?.getCount() ?? position.getCount()
    if (mode !== 4) {
      unsupportedPrimitives += 1
      if (mode === 1) looseEdges += Math.floor(elementCount / 2)
      else if (mode === 2) looseEdges += elementCount > 1 ? elementCount : 0
      else if (mode === 3) looseEdges += Math.max(0, elementCount - 1)
    } else if (elementCount % 3 !== 0) {
      malformedPrimitives += 1
    }
    const values = position.getArray()
    const count = position.getCount()
    vertices += count
    for (let vertex = 0; vertex < count; vertex += 1) {
      const offset = vertex * 3
      const x = values[offset]
      const y = values[offset + 1]
      const z = values[offset + 2]
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        invalidPositionValues += 1
        continue
      }
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      minZ = Math.min(minZ, z)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      maxZ = Math.max(maxZ, z)
    }
  }

  if (!Number.isFinite(minX) || vertices < 3) {
    return {
      vertices,
      weldedVertices: vertices,
      triangles: 0,
      edges: 0,
      boundaryEdges: 0,
      nonManifoldEdges: 0,
      windingConflictEdges: 0,
      looseEdges,
      looseVertices: vertices,
      degenerateTriangles: 0,
      invalidIndexReferences: 0,
      malformedPrimitives,
      invalidPositionValues,
      unsupportedPrimitives,
      clean: false,
    }
  }

  const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
  const tolerance = Math.max(1e-6, maxDim * 1e-6)
  const vertexByPosition = new Map()
  const weldedByPrimitive = new Map()
  let weldedVertices = 0

  for (const primitive of primitives) {
    const position = primitive.getAttribute('POSITION')
    if (!position) continue
    const values = position.getArray()
    const welded = new Uint32Array(position.getCount())
    for (let vertex = 0; vertex < position.getCount(); vertex += 1) {
      const offset = vertex * 3
      const key = `${Math.round(values[offset] / tolerance)},${Math.round(
        values[offset + 1] / tolerance,
      )},${Math.round(values[offset + 2] / tolerance)}`
      let canonical = vertexByPosition.get(key)
      if (canonical === undefined) {
        canonical = weldedVertices
        weldedVertices += 1
        vertexByPosition.set(key, canonical)
      }
      welded[vertex] = canonical
    }
    weldedByPrimitive.set(primitive, welded)
  }

  const edgeState = new Map()
  const referencedVertices = new Set()
  const addEdge = (from, to) => {
    if (from === to) return
    const low = Math.min(from, to)
    const high = Math.max(from, to)
    const key = `${low},${high}`
    const state = edgeState.get(key) || { count: 0, balance: 0 }
    state.count += 1
    state.balance += from === low ? 1 : -1
    edgeState.set(key, state)
  }

  let triangles = 0
  let degenerateTriangles = 0
  let invalidIndexReferences = 0
  for (const primitive of primitives) {
    if (primitive.getMode() !== 4) continue
    const position = primitive.getAttribute('POSITION')
    const welded = weldedByPrimitive.get(primitive)
    if (!position || !welded) continue
    const indices = primitive.getIndices()
    const indexArray = indices?.getArray()
    const indexCount = indices?.getCount() ?? position.getCount()
    for (let offset = 0; offset + 2 < indexCount; offset += 3) {
      const a = indexArray ? indexArray[offset] : offset
      const b = indexArray ? indexArray[offset + 1] : offset + 1
      const c = indexArray ? indexArray[offset + 2] : offset + 2
      if (
        !Number.isInteger(a) ||
        !Number.isInteger(b) ||
        !Number.isInteger(c) ||
        a < 0 ||
        b < 0 ||
        c < 0 ||
        a >= position.getCount() ||
        b >= position.getCount() ||
        c >= position.getCount()
      ) {
        invalidIndexReferences += 1
        continue
      }
      const wa = welded[a]
      const wb = welded[b]
      const wc = welded[c]
      if (wa === wb || wb === wc || wc === wa) {
        degenerateTriangles += 1
        continue
      }
      triangles += 1
      referencedVertices.add(wa)
      referencedVertices.add(wb)
      referencedVertices.add(wc)
      addEdge(wa, wb)
      addEdge(wb, wc)
      addEdge(wc, wa)
    }
  }

  let boundaryEdges = 0
  let nonManifoldEdges = 0
  let windingConflictEdges = 0
  for (const state of edgeState.values()) {
    if (state.count === 1) boundaryEdges += 1
    else if (state.count > 2) nonManifoldEdges += 1
    else if (Math.abs(state.balance) === 2) windingConflictEdges += 1
  }
  const looseVertices = Math.max(0, weldedVertices - referencedVertices.size)
  const clean = Boolean(
    triangles > 0 &&
      unsupportedPrimitives === 0 &&
      malformedPrimitives === 0 &&
      invalidPositionValues === 0 &&
      invalidIndexReferences === 0 &&
      degenerateTriangles === 0 &&
      boundaryEdges === 0 &&
      nonManifoldEdges === 0 &&
      windingConflictEdges === 0 &&
      looseEdges === 0 &&
      looseVertices === 0,
  )
  return {
    vertices,
    weldedVertices,
    triangles,
    edges: edgeState.size,
    boundaryEdges,
    nonManifoldEdges,
    windingConflictEdges,
    looseEdges,
    looseVertices,
    degenerateTriangles,
    invalidIndexReferences,
    malformedPrimitives,
    invalidPositionValues,
    unsupportedPrimitives,
    clean,
  }
}

function auditError(audit) {
  const details = audit.invalidClaims
    .map((claim) => `${claim.kind}:${claim.name || '(unnamed)'}`)
    .join(', ')
  return new Error(
    `Invalid IOM surface-repair certificate claim(s): ${details || 'unknown'}`,
  )
}

/**
 * A mesh is certified only when every node sharing it has the two exact
 * certificate values and the combined mesh topology is still closed,
 * manifold, and consistently wound.
 */
export function auditSurfaceRepairCertificates(
  document,
  {
    expectedCertificateCount = null,
    expectedCertificateOwnerNames = null,
    mirrorMeshCertificates = false,
  } = {},
) {
  const root = document.getRoot()
  const ownersByMesh = new Map()
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const owners = ownersByMesh.get(mesh) || []
    owners.push(node)
    ownersByMesh.set(mesh, owners)
  }

  const exactNodes = root
    .listNodes()
    .filter((node) => hasExactSurfaceRepairCertificate(node.getExtras()))
  const nonExactClaims = [
    ...root
      .listNodes()
      .filter(
        (node) =>
          hasAnySurfaceRepairCertificate(node.getExtras()) &&
          !hasExactSurfaceRepairCertificate(node.getExtras()),
      )
      .map((node) => ({ kind: 'node', name: node.getName() || '(unnamed)' })),
    ...root
      .listMeshes()
      .filter(
        (mesh) =>
          hasAnySurfaceRepairCertificate(mesh.getExtras()) &&
          !hasExactSurfaceRepairCertificate(mesh.getExtras()),
      )
      .map((mesh) => ({ kind: 'mesh', name: mesh.getName() || '(unnamed)' })),
  ]
  const invalidClaims = nonExactClaims.map((claim) => ({
    kind: `non-exact-${claim.kind}-certificate`,
    name: claim.name,
  }))
  const certifiedMeshes = new Set()
  const meshes = []
  const meshesToMirror = []

  for (const node of exactNodes) {
    if (!node.getMesh()) {
      invalidClaims.push({
        kind: 'certified-node-without-mesh',
        name: node.getName(),
      })
    }
  }

  for (const [mesh, owners] of ownersByMesh) {
    const exactOwners = owners.filter((node) =>
      hasExactSurfaceRepairCertificate(node.getExtras()),
    )
    const meshClaim = hasExactSurfaceRepairCertificate(mesh.getExtras())
    if (exactOwners.length === 0) {
      if (meshClaim) {
        invalidClaims.push({
          kind: 'certified-mesh-without-certified-owners',
          name: mesh.getName(),
        })
      }
      continue
    }
    if (exactOwners.length !== owners.length) {
      invalidClaims.push({
        kind: 'partially-certified-shared-mesh',
        name: mesh.getName(),
        owners: owners.map((node) => node.getName()),
      })
      continue
    }
    const topology = meshSurfaceTopology(mesh)
    if (!topology.clean) {
      invalidClaims.push({
        kind: 'certified-damaged-topology',
        name: mesh.getName(),
        topology,
      })
      continue
    }
    certifiedMeshes.add(mesh)
    meshes.push({
      name: mesh.getName() || '(unnamed)',
      owners: owners.map((node) => node.getName() || '(unnamed)').sort(),
      topology,
    })
    if (mirrorMeshCertificates && !meshClaim) meshesToMirror.push(mesh)
  }

  const ownerNames = exactNodes
    .map((node) => node.getName() || '(unnamed)')
    .sort()
  const audit = {
    certificateCount: exactNodes.length,
    certifiedMeshCount: certifiedMeshes.size,
    certifiedMeshes,
    ownerNames,
    meshes,
    nonExactClaims,
    invalidClaims,
    mirroredMeshCertificates: 0,
  }
  if (
    expectedCertificateCount != null &&
    audit.certificateCount !== expectedCertificateCount
  ) {
    invalidClaims.push({
      kind: 'certificate-count-mismatch',
      name: `${audit.certificateCount} != ${expectedCertificateCount}`,
    })
  }
  if (expectedCertificateOwnerNames != null) {
    const expected = [...expectedCertificateOwnerNames].sort()
    if (JSON.stringify(ownerNames) !== JSON.stringify(expected)) {
      invalidClaims.push({
        kind: 'certificate-owner-inventory-mismatch',
        name: `${JSON.stringify(ownerNames)} != ${JSON.stringify(expected)}`,
      })
    }
  }
  if (invalidClaims.length > 0) throw auditError(audit)
  for (const mesh of meshesToMirror) {
    mesh.setExtras({
      ...mesh.getExtras(),
      [IOM_SURFACE_TOPOLOGY_REPAIRED]: true,
      [IOM_SURFACE_TOPOLOGY_REPAIR]:
        IOM_SURFACE_TOPOLOGY_REPAIR_VERSION,
    })
  }
  audit.mirroredMeshCertificates = meshesToMirror.length
  return audit
}

export function surfaceRepairCertificateExpectation(audit) {
  return {
    expectedCertificateCount: audit.certificateCount,
    expectedCertificateOwnerNames: [...audit.ownerNames],
  }
}

export function surfaceRepairAuditSummary(audit) {
  return {
    certificateCount: audit.certificateCount,
    certifiedMeshCount: audit.certifiedMeshCount,
    ownerNames: audit.ownerNames,
    meshes: audit.meshes,
    nonExactClaims: audit.nonExactClaims,
    mirroredMeshCertificates: audit.mirroredMeshCertificates,
  }
}
