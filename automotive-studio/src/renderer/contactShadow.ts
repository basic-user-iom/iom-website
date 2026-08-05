import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'

/**
 * Soft radial contact blob under the vehicle — readable on dark floors where
 * directional shadow maps wash out. Follows XZ; not a real shadow map.
 */
export function createContactShadow(): {
  mesh: Mesh
  follow: (target: Object3D | null) => void
  setOpacity: (opacity: number) => void
  dispose: () => void
} {
  const size = 6.5
  const geo = new PlaneGeometry(size, size)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 120)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(0.35, 'rgba(0,0,0,0.28)')
  g.addColorStop(0.7, 'rgba(0,0,0,0.08)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)

  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace

  const mat = new MeshBasicMaterial({
    map,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  })
  const mesh = new Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.015
  mesh.name = 'ContactShadow'
  mesh.renderOrder = -1
  mesh.frustumCulled = false

  const _pos = new Vector3()
  const follow = (target: Object3D | null) => {
    if (!target) {
      mesh.visible = false
      return
    }
    mesh.visible = true
    target.getWorldPosition(_pos)
    mesh.position.x = _pos.x
    mesh.position.z = _pos.z
  }

  const setOpacity = (opacity: number) => {
    mat.opacity = Math.max(0, Math.min(1, opacity))
  }

  const dispose = () => {
    geo.dispose()
    mat.dispose()
    map.dispose()
  }

  return { mesh, follow, setOpacity, dispose }
}
