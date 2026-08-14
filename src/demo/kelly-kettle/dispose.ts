import {
  Line,
  LineSegments,
  Material,
  Mesh,
  Object3D,
  Points,
  Texture,
  type BufferGeometry,
} from 'three'

const TEXTURE_KEYS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'alphaMap',
  'bumpMap',
  'displacementMap',
  'envMap',
] as const

function disposeMaterial(material: Material) {
  for (const key of TEXTURE_KEYS) {
    const value = (material as Material & Record<string, unknown>)[key]
    if (value instanceof Texture) value.dispose()
  }
  material.dispose()
}

function disposeGeometry(geometry: BufferGeometry | undefined) {
  geometry?.dispose()
}

export function collectGeometriesAndMaterials(root: Object3D): {
  geos: Set<BufferGeometry>
  mats: Set<Material>
} {
  const geos = new Set<BufferGeometry>()
  const mats = new Set<Material>()
  root.traverse((obj) => {
    if (obj instanceof Mesh || obj instanceof Points || obj instanceof Line || obj instanceof LineSegments) {
      if (obj.geometry) geos.add(obj.geometry)
      const list = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of list) {
        if (mat) mats.add(mat)
      }
    }
  })
  return { geos, mats }
}

export function disposeTracked(geos: Iterable<BufferGeometry>, mats: Iterable<Material>) {
  for (const geo of geos) disposeGeometry(geo)
  for (const mat of mats) disposeMaterial(mat)
}

export function triangleCountOf(root: Object3D): number {
  let count = 0
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return
    const geo = obj.geometry
    if (!geo) return
    const index = geo.index
    if (index) count += index.count / 3
    else count += geo.getAttribute('position').count / 3
  })
  return Math.round(count)
}
