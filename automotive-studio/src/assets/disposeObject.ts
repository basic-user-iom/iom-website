import {
  AnimationClip,
  BufferGeometry,
  Material,
  Mesh,
  Object3D,
  Texture,
  type Object3DEventMap,
} from 'three'

export function disposeObject3D(root: Object3D, options?: { removeFromParent?: boolean }) {
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (mesh.isMesh) {
      disposeGeometry(mesh.geometry)
      if (Array.isArray(mesh.material)) {
        for (const mat of mesh.material) disposeMaterial(mat)
      } else if (mesh.material) {
        disposeMaterial(mesh.material)
      }
    }
  })
  if (options?.removeFromParent !== false) root.removeFromParent()
}

function disposeGeometry(geometry?: BufferGeometry) {
  geometry?.dispose()
}

function disposeMaterial(material: Material) {
  const mat = material as Material & Record<string, unknown>
  for (const key of Object.keys(mat)) {
    const value = mat[key]
    if (value && typeof value === 'object' && (value as Texture).isTexture) {
      ;(value as Texture).dispose()
    }
  }
  material.dispose()
}

export function revokeObjectUrl(url: string | null | undefined) {
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
}

export type LoadedGltf = {
  scene: Object3D<Object3DEventMap>
  animations: AnimationClip[]
  parser?: { json?: unknown }
}
