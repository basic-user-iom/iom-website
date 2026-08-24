import {
  BatchedMesh,
  BufferGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Vector3,
  type Object3D,
} from 'three'

const _a = new Vector3()
const _b = new Vector3()
const _c = new Vector3()
const _centroid = new Vector3()
const _size = new Vector3()
const _instanceMat = new Matrix4()
const _instancePos = new Vector3()
const _zeroScale = new Vector3(0, 0, 0)

export type Aabb3 = {
  min: [number, number, number]
  max: [number, number, number]
}

function inside(
  p: Vector3,
  xmin: number,
  ymin: number,
  zmin: number,
  xmax: number,
  ymax: number,
  zmax: number,
): boolean {
  return p.x >= xmin && p.x <= xmax && p.y >= ymin && p.y <= ymax && p.z >= zmin && p.z <= zmax
}

function hideMesh(mesh: Mesh): void {
  mesh.visible = false
  mesh.userData.inspectHidden = true
  mesh.userData.goldenPatchClipped = true
}

const FLOOR_NAME =
  /fb_|boden|flies|fliese|floor|pflaster|fuweg|fussweg|fußweg|strasse|straß|ground|rasen|estrich|parkett|teppich|asphalt|kopfstein|plaza|pavement|grund|terrasse|\bgrn\b|_00_grn|wegplatte|gehweg/i

const ROOF_NAME =
  /dach|roof|wellblech|grndach|grn[_-]?dach|attika|gesims|skylight|dachrand|blechdach|\bpilars?\b/i

function meshLabel(mesh: Mesh): string {
  return `${mesh.name || ''} ${mesh.parent?.name || ''}`
}

function isProtectedSlab(mesh: Mesh, size: Vector3, wbMinY: number, patchXz: number): boolean {
  const label = meshLabel(mesh)
  if (FLOOR_NAME.test(label) || ROOF_NAME.test(label)) return true
  if (size.y < 0.55) return true
  // Corrugated / panel roofs sit well above grade and are thin vs their footprint.
  if (wbMinY >= 6 && size.y < Math.max(size.x, size.z) * 0.45) return true
  // Combined campus meshes (Area_all, streets+walls) — clipping punches holes
  // far outside the golden bay.
  if (size.x * size.z > patchXz * 5 || size.x > 80 || size.z > 80) return true
  return false
}

/**
 * Remove campus CAD that occupies a golden-slice AABB.
 *
 * Small props (stairs, furniture, hardware) are hidden whole so leftover
 * triangles do not float. Large slabs are triangle-clipped. Instanced meshes
 * are never rewritten — that used to corrupt every copy across the campus.
 */
export function clipTrianglesInAabb(
  root: Object3D,
  aabb: Aabb3,
  margin = 0.35,
): { meshes: number; dropped: number } {
  const xmin = aabb.min[0] - margin
  const ymin = aabb.min[1] - margin
  const zmin = aabb.min[2] - margin
  const xmax = aabb.max[0] + margin
  const ymax = aabb.max[1] + margin
  const zmax = aabb.max[2] + margin
  const propMargin = 0.9
  const pxmin = aabb.min[0] - propMargin
  const pymin = aabb.min[1] - propMargin
  const pzmin = aabb.min[2] - propMargin
  const pxmax = aabb.max[0] + propMargin
  const pymax = aabb.max[1] + propMargin
  const pzmax = aabb.max[2] + propMargin

  const patchXz = Math.max(0.01, (xmax - xmin) * (zmax - zmin))

  let meshes = 0
  let dropped = 0
  root.updateWorldMatrix(true, true)
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    if (
      mesh.userData?.collisionOnly ||
      mesh.userData?.goldenPatchClipped ||
      mesh.userData?.proceduralInstanced ||
      mesh.userData?.proceduralBatched
    ) {
      return
    }
    if ((obj as BatchedMesh).isBatchedMesh) return

    if ((obj as InstancedMesh).isInstancedMesh) {
      const inst = obj as InstancedMesh
      const sy = Number(inst.userData?.partSize?.sy ?? 1)
      const label = meshLabel(inst)
      if (FLOOR_NAME.test(label) || ROOF_NAME.test(label) || sy < 0.55) return
      const n = hideInstancedInside(inst, pxmin, pymin, pzmin, pxmax, pymax, pzmax)
      if (n > 0) {
        meshes += 1
        dropped += n
      }
      return
    }

    const geom = mesh.geometry
    geom.computeBoundingBox()
    if (!geom.boundingBox) return
    const wb = geom.boundingBox.clone().applyMatrix4(mesh.matrixWorld)
    if (
      wb.max.x < pxmin ||
      wb.min.x > pxmax ||
      wb.max.y < pymin ||
      wb.min.y > pymax ||
      wb.max.z < pzmin ||
      wb.min.z > pzmax
    ) {
      return
    }

    wb.getSize(_size)
    if (isProtectedSlab(mesh, _size, wb.min.y, patchXz)) return
    const maxDim = Math.max(_size.x, _size.y, _size.z)
    const index = geom.getIndex()
    const pos = geom.getAttribute('position')
    const triCount = index ? index.count / 3 : pos ? pos.count / 3 : 0
    const isProp = maxDim < 10 && triCount < 12000 && !ROOF_NAME.test(meshLabel(mesh))

    if (isProp) {
      hideMesh(mesh)
      meshes += 1
      dropped += triCount
      return
    }

    const result = clipMesh(mesh, xmin, ymin, zmin, xmax, ymax, zmax)
    if (result.dropped <= 0) return
    mesh.userData.goldenPatchClipped = true
    meshes += 1
    dropped += result.dropped
    if (result.remaining === 0) hideMesh(mesh)
  })
  return { meshes, dropped }
}

function hideInstancedInside(
  mesh: InstancedMesh,
  xmin: number,
  ymin: number,
  zmin: number,
  xmax: number,
  ymax: number,
  zmax: number,
): number {
  mesh.updateWorldMatrix(true, false)
  let hidden = 0
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, _instanceMat)
    _instanceMat.premultiply(mesh.matrixWorld)
    _instancePos.setFromMatrixPosition(_instanceMat)
    if (!inside(_instancePos, xmin, ymin, zmin, xmax, ymax, zmax)) continue
    mesh.getMatrixAt(i, _instanceMat)
    _instanceMat.scale(_zeroScale)
    mesh.setMatrixAt(i, _instanceMat)
    hidden += 1
  }
  if (hidden > 0) {
    mesh.instanceMatrix.needsUpdate = true
    mesh.userData.goldenPatchClipped = true
  }
  return hidden
}

function clipMesh(
  mesh: Mesh,
  xmin: number,
  ymin: number,
  zmin: number,
  xmax: number,
  ymax: number,
  zmax: number,
): { dropped: number; remaining: number } {
  const geom = mesh.geometry
  const pos = geom.getAttribute('position')
  if (!pos) return { dropped: 0, remaining: -1 }
  const mw = mesh.matrixWorld
  const index = geom.getIndex()
  const triCount = index ? index.count / 3 : pos.count / 3
  const kept: number[] = []

  const triHitsPatch = (i0: number, i1: number, i2: number) => {
    _a.fromBufferAttribute(pos, i0).applyMatrix4(mw)
    _b.fromBufferAttribute(pos, i1).applyMatrix4(mw)
    _c.fromBufferAttribute(pos, i2).applyMatrix4(mw)
    // Centroid only: any-vertex delete wiped neighbouring hall faces on
    // large CAD triangles that merely touched the cloakroom box.
    _centroid.copy(_a).add(_b).add(_c).multiplyScalar(1 / 3)
    return inside(_centroid, xmin, ymin, zmin, xmax, ymax, zmax)
  }

  if (index) {
    const src = index.array
    for (let i = 0; i < src.length; i += 3) {
      const i0 = src[i]!
      const i1 = src[i + 1]!
      const i2 = src[i + 2]!
      if (triHitsPatch(i0, i1, i2)) continue
      kept.push(i0, i1, i2)
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      if (triHitsPatch(i, i + 1, i + 2)) continue
      kept.push(i, i + 1, i + 2)
    }
  }

  const remaining = kept.length / 3
  const dropped = triCount - remaining
  if (dropped <= 0) return { dropped: 0, remaining: triCount }
  if (remaining === 0) return { dropped, remaining: 0 }

  const next: BufferGeometry = geom.clone()
  next.setIndex(kept)
  next.computeBoundingBox()
  next.computeBoundingSphere()
  mesh.geometry = next
  return { dropped, remaining }
}
