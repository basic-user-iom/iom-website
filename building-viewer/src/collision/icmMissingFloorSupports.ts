import { BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, Object3D, Vector3 } from 'three'
import type { CollisionChunkSource } from './buildCollisionChunks'

// The floor audit found missing surfaces and gaps in these authored owners.
// Retain their actual triangles; the central voids in the four U-stairs stay open.
const MISSING_FLOORS = /^(?:treppe_bt1_[1256]|treppe_bt1_5001|Boden_treppen|treppe_zg|BU_Treppe_(?:Links|Rechts|Show_time)|saal13_boden|Gangway_Raster|RG_Teil_0[12]|RG_Seiten|Decke_2OG_A|TR_Stufen(?:010|_00[123])?)$/
function floorOwner(mesh: Mesh, root: Object3D): string | null {
  let owner: Object3D | null = mesh
  while (owner && owner !== root) {
    if (MISSING_FLOORS.test(owner.name)) return owner.name
    owner = owner.parent
  }
  return null
}
function eligibleMaterial(owner: string, name: string): boolean {
  // The exterior auditorium landing is authored metal plate, omitted by the generic material filter.
  if (owner === 'TR_Stufen010') return /^(?:m\.metal_grey|treppen_aussen|LampShade)$/.test(name)
  if (/^TR_Stufen/.test(owner)) return name === 'Floor_Wood_Vray_001' || name === 'm.metal.dark-grey.r'
  if (owner === 'RG_Seiten' || owner === 'Decke_2OG_A') return name === 'Floor_Wood_Vray_001'
  if (/^RG_Teil/.test(owner)) return name === 'Floor_Wood_Vray_001'
  if (owner === 'BU_Treppe_Show_time') return name === 'buehne' || name === 'mat_23 - Default'
  if (/^BU_Treppe_(Links|Rechts)$/.test(owner)) return /^vray Buehene Stufen/.test(name)
  return true
}
type Face = { a: Vector3; b: Vector3; c: Vector3; y: number }
function heightAt(face: Face, x: number, z: number): number | null {
  const { a, b, c } = face
  const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z)
  if (Math.abs(d) < 1e-12) return null
  const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d
  const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d
  if (u < -1e-7 || v < -1e-7 || u + v > 1.0000001) return null
  return u * a.y + v * b.y + (1 - u - v) * c.y
}
export function buildIcmMissingFloorSupports(root: Object3D): CollisionChunkSource[] {
  return buildExactFloorSupports(root, false)
}
// The exterior paving audit found a 5 cm offset under cobbles and an omitted
// raised paving patch. Copy their authored top faces without shifting the model.
export function buildIcmExteriorPavingSupports(root: Object3D): CollisionChunkSource[] {
  return buildExactFloorSupports(root, true)
}
const PAVING_MATERIALS = new Set(['kopfstein_strasse', 'mnschner_001'])
function buildExactFloorSupports(root: Object3D, exterior: boolean): CollisionChunkSource[] {
  const chunks: CollisionChunkSource[] = []
  root.updateMatrixWorld(true)
  root.traverse(object => {
    const mesh = object as Mesh & { isInstancedMesh?: boolean; count?: number; getMatrixAt?: (i: number, m: Matrix4) => void }
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const owner = exterior
      ? materials.some(m => PAVING_MATERIALS.has(m.name) && !m.transparent) ? mesh.name : null
      : floorOwner(mesh, root)
    if (!owner) return
    const eligible = (name: string) => exterior ? PAVING_MATERIALS.has(name) : eligibleMaterial(owner, name)
    if (owner === 'Decke_2OG_A' && materials.every(m => eligibleMaterial(owner, m.name))) {
      mesh.userData.iomExplicitWalkable = true
    }
    const geometry = mesh.geometry, position = geometry.getAttribute('position'), index = geometry.index
    if (!position) return
    const faces: Face[] = [], matrix = new Matrix4(), instance = new Matrix4()
    for (let n = 0; n < (mesh.isInstancedMesh ? mesh.count! : 1); n++) {
      matrix.copy(mesh.matrixWorld)
      if (mesh.isInstancedMesh) { mesh.getMatrixAt!(n, instance); matrix.multiply(instance) }
      for (let i = 0; i < (index?.count ?? position.count); i += 3) {
        const materialIndex = geometry.groups.find(group => i >= group.start && i < group.start + group.count)?.materialIndex ?? 0
        if (!eligible(materials[materialIndex]?.name ?? '')) continue
        const points = [0, 1, 2].map(k => new Vector3().fromBufferAttribute(position, index ? index.getX(i + k) : i + k).applyMatrix4(matrix))
        const [a, b, c] = points as [Vector3, Vector3, Vector3]
        const normal = b.clone().sub(a).cross(c.clone().sub(a))
        if (normal.lengthSq() < 1e-12 || Math.abs(normal.normalize().y) < 0.995) continue
        // Mirroring may reverse the winding without changing the tread.
        faces.push(normal.y > 0 ? { a, b, c, y: (a.y + b.y + c.y) / 3 } : { a, b: c, c: b, y: (a.y + b.y + c.y) / 3 })
      }
    }
    const levels = new Map<number, number[]>()
    for (const face of faces) {
      const centre = face.a.clone().add(face.b).add(face.c).multiplyScalar(1 / 3)
      // Omit the underside of each thin slab/tread, not the tread above it.
      if (faces.some(other => {
        const y = heightAt(other, centre.x, centre.z)
        return y !== null && y > centre.y + 0.015 && y < centre.y + 0.36
      })) continue
      const key = Math.round(face.y * 100)
      const vertices = levels.get(key) ?? []
      vertices.push(...face.a.toArray(), ...face.b.toArray(), ...face.c.toArray())
      levels.set(key, vertices)
    }
    for (const [level, vertices] of levels) {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
      geometry.computeBoundingBox()
      chunks.push({ geometry, box: geometry.boundingBox!.clone(), triangles: vertices.length / 9,
        name: `${exterior ? 'exact-paving' : 'exact-floor'}:${owner}:${mesh.name}:${level}`, sourceNames: [owner], layerBridge: true,
        // A tread is a surface, not an AABB stair volume.
        stairZone: false, doubleSided: false })
    }
  })
  return chunks
}
