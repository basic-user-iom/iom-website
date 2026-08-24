import {
  Box3,
  BoxHelper,
  DoubleSide,
  FrontSide,
  InstancedMesh,
  Mesh,
  Object3D,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
  type Intersection,
  type Material,
  type Scene,
} from 'three'

const _ndc = new Vector2()
const _size = new Vector3()
const _box = new Box3()

export type InspectPickInfo = {
  name: string
  path: string
  layerId: string
  objectType: string
  materialNames: string[]
  side: string
  triangles: number
  sizeM: { x: number; y: number; z: number }
  visible: boolean
  flags: string[]
  instanceId: number | null
}

function layerIdFromObject(obj: Object3D): string {
  let p: Object3D | null = obj
  while (p) {
    if (p.name.startsWith('Model:')) return p.name.slice(6)
    p = p.parent
  }
  return '?'
}

function objectPath(obj: Object3D): string {
  const parts: string[] = []
  let p: Object3D | null = obj
  while (p && p.parent) {
    parts.push(p.name || p.type)
    if (p.name.startsWith('Model:')) break
    p = p.parent
  }
  return parts.reverse().join(' / ')
}

function sideLabel(mesh: Mesh): string {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const names = [...new Set(mats.map((m) => {
    if (!m) return '?'
    if (m.side === DoubleSide) return 'DoubleSide'
    if (m.side === FrontSide) return 'FrontSide'
    return 'BackSide'
  }))]
  return names.join(', ')
}

function materialNames(mesh: Mesh): string[] {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return mats.map((m, i) => m?.name || `material[${i}]`)
}

function triangleCount(mesh: Mesh): number {
  const geom = mesh.geometry
  if (!geom) return 0
  const index = geom.index
  const pos = geom.getAttribute('position')
  const tris = index ? index.count / 3 : pos ? pos.count / 3 : 0
  const instanced = (mesh as InstancedMesh).isInstancedMesh
    ? Math.max(1, (mesh as InstancedMesh).count)
    : 1
  return Math.round(tris * instanced)
}

function collectFlags(mesh: Mesh): string[] {
  const flags: string[] = []
  const u = mesh.userData ?? {}
  if (u.architecturalGlass) flags.push('glass')
  if (u.waterSurface) flags.push('water')
  if (u.floorSurface) flags.push('floor/roof')
  if (u.cadOverlay) flags.push('cad')
  if (u.orbitDupKind) flags.push('orbit-dup')
  if (u.proceduralInstanced) flags.push('instanced')
  if (u.proceduralBatched) flags.push('batched')
  if (u.detailLodIgnore) flags.push('lod-ignore')
  if (u.shutter) flags.push('shutter')
  if (!mesh.visible) flags.push('hidden')
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (mats.some((m) => m && (m.transparent || (m.opacity ?? 1) < 0.98))) flags.push('transparent')
  if (mesh.castShadow) flags.push('castShadow')
  if (mesh.receiveShadow) flags.push('recvShadow')
  return flags
}

function pickInfo(hit: Intersection<Object3D>): InspectPickInfo | null {
  let obj: Object3D | null = hit.object
  while (obj && !(obj as Mesh).isMesh) obj = obj.parent
  if (!obj || !(obj as Mesh).isMesh) return null
  const mesh = obj as Mesh
  _box.setFromObject(mesh)
  _box.getSize(_size)
  const instanceId = typeof hit.instanceId === 'number' ? hit.instanceId : null
  return {
    name: mesh.name || '(unnamed)',
    path: objectPath(mesh),
    layerId: layerIdFromObject(mesh),
    objectType: mesh.type,
    materialNames: materialNames(mesh),
    side: sideLabel(mesh),
    triangles: triangleCount(mesh),
    sizeM: {
      x: Number(_size.x.toFixed(3)),
      y: Number(_size.y.toFixed(3)),
      z: Number(_size.z.toFixed(3)),
    },
    visible: mesh.visible,
    flags: collectFlags(mesh),
    instanceId,
  }
}

export function formatInspectCopy(info: InspectPickInfo): string {
  const mats = info.materialNames.join(', ') || '—'
  const flags = info.flags.join(', ') || '—'
  const inst = info.instanceId != null ? String(info.instanceId) : '—'
  return [
    'IOM_BV_INSPECT',
    `name: ${info.name}`,
    `path: ${info.path}`,
    `layer: ${info.layerId}`,
    `type: ${info.objectType}`,
    `materials: ${mats}`,
    `side: ${info.side}`,
    `triangles: ${info.triangles}`,
    `size_m: ${info.sizeM.x} × ${info.sizeM.y} × ${info.sizeM.z}`,
    `instance: ${inst}`,
    `flags: ${flags}`,
  ].join('\n')
}

/**
 * Orbit click-to-identify meshes. Drag still orbits; a short click raycasts.
 */
export class InspectPicker {
  private enabled = false
  private readonly raycaster = new Raycaster()
  private readonly helper: BoxHelper
  private selected: Mesh | null = null
  private pointerDown: { x: number; y: number } | null = null
  private readonly hidden = new Set<Mesh>()

  constructor(
    private readonly camera: Camera,
    private readonly dom: HTMLElement,
    private readonly scene: Scene,
    private readonly getRoot: () => Object3D,
    private readonly onPick: (info: InspectPickInfo | null) => void,
    private readonly isBlocked: () => boolean,
  ) {
    this.helper = new BoxHelper(new Object3D(), 0xd4a85a)
    this.helper.name = 'InspectHighlight'
    this.helper.visible = false
    this.helper.matrixAutoUpdate = true
    this.scene.add(this.helper)

    this.dom.addEventListener('pointerdown', this.onPointerDown)
    this.dom.addEventListener('pointerup', this.onPointerUp)
    this.dom.addEventListener('pointercancel', this.onPointerCancel)
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    this.dom.classList.toggle('bv-inspect-cursor', on)
    document.documentElement.classList.toggle('bv-inspecting', on)
    if (!on) {
      this.clearHighlight()
      this.onPick(null)
    }
  }

  getSelected(): Mesh | null {
    return this.selected
  }

  hideSelected(): InspectPickInfo | null {
    const mesh = this.selected
    if (!mesh || mesh.userData?.cadOverlay) return this.emitSelected()
    if (mesh.userData.inspectPrevVisible === undefined) {
      mesh.userData.inspectPrevVisible = mesh.visible
    }
    mesh.userData.inspectHidden = true
    mesh.visible = false
    this.hidden.add(mesh)
    this.clearHighlight()
    this.selected = mesh
    return this.emitSelected()
  }

  isolateSelected(): InspectPickInfo | null {
    const keep = this.selected
    if (!keep) return null
    this.getRoot().traverse((obj) => {
      if (!(obj as Mesh).isMesh) return
      const mesh = obj as Mesh
      if (mesh === keep) return
      if (mesh.userData?.collisionOnly || mesh.userData?.cadOverlay) return
      if (mesh.userData.inspectPrevVisible === undefined) {
        mesh.userData.inspectPrevVisible = mesh.visible
      }
      mesh.userData.inspectHidden = true
      mesh.visible = false
      this.hidden.add(mesh)
    })
    return this.emitSelected()
  }

  restoreHidden(): InspectPickInfo | null {
    for (const mesh of this.hidden) {
      const prev = mesh.userData.inspectPrevVisible
      mesh.visible = prev !== undefined ? Boolean(prev) : true
      mesh.userData.inspectHidden = false
      mesh.userData.inspectPrevVisible = undefined
    }
    this.hidden.clear()
    return this.emitSelected()
  }

  clearHighlight(): void {
    this.helper.visible = false
    this.selected = null
  }

  update(): void {
    if (this.helper.visible && this.selected) this.helper.update()
  }

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.onPointerDown)
    this.dom.removeEventListener('pointerup', this.onPointerUp)
    this.dom.removeEventListener('pointercancel', this.onPointerCancel)
    this.restoreHidden()
    this.scene.remove(this.helper)
    this.helper.geometry.dispose()
    const mat = this.helper.material as Material | Material[]
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
    else mat.dispose()
    this.dom.classList.remove('bv-inspect-cursor')
    document.documentElement.classList.remove('bv-inspecting')
  }

  private emitSelected(): InspectPickInfo | null {
    if (!this.selected) {
      this.onPick(null)
      return null
    }
    const fakeHit: Intersection<Object3D> = {
      object: this.selected,
      distance: 0,
      point: new Vector3(),
    } as Intersection<Object3D>
    const info = pickInfo(fakeHit)
    if (info) this.onPick(info)
    return info
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled || this.isBlocked() || e.button !== 0) return
    this.pointerDown = { x: e.clientX, y: e.clientY }
  }

  private readonly onPointerCancel = (): void => {
    this.pointerDown = null
  }

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.enabled || this.isBlocked() || e.button !== 0) {
      this.pointerDown = null
      return
    }
    const start = this.pointerDown
    this.pointerDown = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (dx * dx + dy * dy > 36) return
    this.pickAt(e.clientX, e.clientY)
  }

  private pickAt(clientX: number, clientY: number): void {
    const rect = this.dom.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(_ndc, this.camera)
    const hits = this.raycaster.intersectObject(this.getRoot(), true)
    const hit = hits.find((h) => {
      const mesh = h.object as Mesh
      if (!mesh.isMesh) return false
      if (mesh.userData?.collisionOnly) return false
      if (mesh.name === 'InspectHighlight') return false
      return mesh.visible
    })
    if (!hit) {
      this.clearHighlight()
      this.onPick(null)
      return
    }
    const mesh = hit.object as Mesh
    this.selected = mesh
    this.helper.setFromObject(mesh)
    this.helper.visible = true
    const info = pickInfo(hit)
    this.onPick(info)
  }
}
