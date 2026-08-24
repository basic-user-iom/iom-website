import type { Material, Object3D, Texture } from 'three'
import { Mesh, SkinnedMesh } from 'three'

function disposeMaterial(material: Material): void {
  const m = material as Material & Record<string, unknown>
  for (const key of Object.keys(m)) {
    const value = m[key]
    if (value && typeof value === 'object' && 'isTexture' in (value as object)) {
      ;(value as Texture).dispose()
    }
  }
  material.dispose()
}

export function disposeObject3D(root: Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof Mesh || obj instanceof SkinnedMesh) {
      obj.geometry?.dispose()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach(disposeMaterial)
      else if (mat) disposeMaterial(mat)
    }
  })
  root.clear()
}
