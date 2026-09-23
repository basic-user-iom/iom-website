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
 * Kept compact so bright ice pads don't show a second disconnected dark disc.
 */
export function createContactShadow(): {
  mesh: Mesh
  follow: (target: Object3D | null) => void
  setOpacity: (opacity: number) => void
  dispose: () => void
} {
  const size = 4.2
  const geo = new PlaneGeometry(size, size)
  // 128 is plenty for a soft radial falloff; 256 was mostly free bandwidth.
  const TEX = 128
  const canvas = document.createElement('canvas')
  canvas.width = TEX
  canvas.height = TEX
  const ctx = canvas.getContext('2d')!
  const mid = TEX * 0.5
  const g = ctx.createRadialGradient(mid, mid, 3, mid, mid, mid * 0.92)
  g.addColorStop(0, 'rgba(0,0,0,0.42)')
  g.addColorStop(0.4, 'rgba(0,0,0,0.18)')
  g.addColorStop(0.75, 'rgba(0,0,0,0.05)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, TEX, TEX)

  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace

  const mat = new MeshBasicMaterial({
    map,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
  const mesh = new Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.012
  mesh.name = 'ContactShadow'
  mesh.renderOrder = -1
  mesh.frustumCulled = false

  const _pos = new Vector3()
  let followFrame = 0
  // Contact blob barely moves visually — skip most world-position reads.
  const FOLLOW_EVERY = 2
  const MOVE_EPS_SQ = 0.0004 // ~2 cm
  let lastX = Number.NaN
  let lastZ = Number.NaN

  const follow = (target: Object3D | null) => {
    if (!target) {
      mesh.visible = false
      lastX = Number.NaN
      lastZ = Number.NaN
      return
    }
    mesh.visible = true
    followFrame++
    if (followFrame % FOLLOW_EVERY !== 0 && Number.isFinite(lastX)) return
    target.getWorldPosition(_pos)
    const dx = _pos.x - lastX
    const dz = _pos.z - lastZ
    if (Number.isFinite(lastX) && dx * dx + dz * dz < MOVE_EPS_SQ) return
    lastX = _pos.x
    lastZ = _pos.z
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
