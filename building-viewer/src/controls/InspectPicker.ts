import {
  Box3,
  BoxHelper,
  DoubleSide,
  FrontSide,
  InstancedMesh,
  Matrix4,
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
const _instanceMatrix = new Matrix4()
const _instanceWorldMatrix = new Matrix4()
const _zeroScale = new Vector3(0, 0, 0)

export type InspectSourceId = number | string

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
  /** Stable logical source identity authored alongside an instanced batch. */
  sourceId: InspectSourceId | null
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

function triangleCount(mesh: Mesh, instanceId: number | null): number {
  const geom = mesh.geometry
  if (!geom) return 0
  const index = geom.index
  const pos = geom.getAttribute('position')
  const tris = index ? index.count / 3 : pos ? pos.count / 3 : 0
  // A raycast instance represents one logical source object. Preserve the old
  // aggregate count only when no individual instance was selected.
  if (instanceId != null && (mesh as InstancedMesh).isInstancedMesh) return Math.round(tris)
  const instanced = (mesh as InstancedMesh).isInstancedMesh
    ? Math.max(1, (mesh as InstancedMesh).count)
    : 1
  return Math.round(tris * instanced)
}

function validSourceId(value: unknown): value is InspectSourceId {
  return (
    (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) ||
    (typeof value === 'string' && value.length > 0)
  )
}

function sourceIdsFor(mesh: Mesh): InspectSourceId[] | null {
  const instanced = mesh as InstancedMesh
  const raw = mesh.userData?.sourceIds
  if (!instanced.isInstancedMesh || !Array.isArray(raw) || raw.length !== instanced.count) return null
  return raw.every(validSourceId) ? (raw as InspectSourceId[]) : null
}

export function resolveInspectSourceId(
  mesh: Mesh,
  instanceId: number | null | undefined,
): InspectSourceId | null {
  if (!Number.isSafeInteger(instanceId) || instanceId == null || instanceId < 0) return null
  const ids = sourceIdsFor(mesh)
  return ids && instanceId < ids.length ? ids[instanceId]! : null
}

function instanceIdentityDomain(mesh: Mesh): string | null {
  const ids = sourceIdsFor(mesh)
  if (!ids) return null
  const u = mesh.userData ?? {}
  if (typeof u.instanceIdentityGroup === 'string' && u.instanceIdentityGroup.length > 0) {
    return `explicit:${u.instanceIdentityGroup}`
  }
  // The disabled repeat pilot predates instanceIdentityGroup, but already has
  // a strict parity/spatial partition contract. Requiring all of that metadata
  // avoids merging unrelated instanced families that happen to reuse IDs.
  if (u.prepartitionedRepeatBatch !== true) return null
  if (typeof u.animationOwner !== 'string' || typeof u.spatialPartition !== 'string') return null
  if (typeof u.instanceParity !== 'string') return null
  const variant = typeof u.repeatVariant === 'string' ? u.repeatVariant : ''
  return `repeat:${u.animationOwner}:${variant}:${u.instanceParity}:${u.spatialPartition}:${JSON.stringify(ids)}`
}

function uniqueInstanceIndex(mesh: Mesh, sourceId: InspectSourceId): number | null {
  const ids = sourceIdsFor(mesh)
  if (!ids) return null
  let found = -1
  for (let i = 0; i < ids.length; i += 1) {
    if (ids[i] !== sourceId) continue
    if (found !== -1) return null
    found = i
  }
  return found >= 0 ? found : null
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
  if ((mesh as InstancedMesh).isInstancedMesh && !u.proceduralInstanced) flags.push('imported-instanced')
  if (sourceIdsFor(mesh)) flags.push('source-ids')
  if (u.detailLodIgnore) flags.push('lod-ignore')
  if (u.shutter) flags.push('shutter')
  if (!mesh.visible) flags.push('hidden')
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (mats.some((m) => m && (m.transparent || (m.opacity ?? 1) < 0.98))) flags.push('transparent')
  if (mesh.castShadow) flags.push('castShadow')
  if (mesh.receiveShadow) flags.push('recvShadow')
  return flags
}

function pickInfo(
  hit: Intersection<Object3D>,
  instanceMatrixOverride?: Matrix4,
): InspectPickInfo | null {
  let obj: Object3D | null = hit.object
  while (obj && !(obj as Mesh).isMesh) obj = obj.parent
  if (!obj || !(obj as Mesh).isMesh) return null
  const mesh = obj as Mesh
  const instanceId = typeof hit.instanceId === 'number' ? hit.instanceId : null
  const instanced = mesh as InstancedMesh
  if (
    instanced.isInstancedMesh &&
    instanceId != null &&
    instanceId >= 0 &&
    instanceId < instanced.count
  ) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const localBounds = mesh.geometry.boundingBox
    if (localBounds) {
      mesh.updateWorldMatrix(true, false)
      if (instanceMatrixOverride) _instanceMatrix.copy(instanceMatrixOverride)
      else instanced.getMatrixAt(instanceId, _instanceMatrix)
      _instanceWorldMatrix.multiplyMatrices(mesh.matrixWorld, _instanceMatrix)
      _box.copy(localBounds).applyMatrix4(_instanceWorldMatrix)
    } else {
      _box.setFromObject(mesh)
    }
  } else {
    _box.setFromObject(mesh)
  }
  _box.getSize(_size)
  return {
    name: mesh.name || '(unnamed)',
    path: objectPath(mesh),
    layerId: layerIdFromObject(mesh),
    objectType: mesh.type,
    materialNames: materialNames(mesh),
    side: sideLabel(mesh),
    triangles: triangleCount(mesh, instanceId),
    sizeM: {
      x: Number(_size.x.toFixed(3)),
      y: Number(_size.y.toFixed(3)),
      z: Number(_size.z.toFixed(3)),
    },
    visible: mesh.visible,
    flags: collectFlags(mesh),
    instanceId,
    sourceId: resolveInspectSourceId(mesh, instanceId),
  }
}

/** Pure inspection helper used by focused runtime tests and diagnostic tools. */
export function inspectPickInfo(hit: Intersection<Object3D>): InspectPickInfo | null {
  return pickInfo(hit)
}

export function formatInspectCopy(info: InspectPickInfo): string {
  const mats = info.materialNames.join(', ') || '—'
  const flags = info.flags.join(', ') || '—'
  const inst = info.instanceId != null ? String(info.instanceId) : '—'
  const source = info.sourceId != null ? String(info.sourceId) : '—'
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
    `source: ${source}`,
    `flags: ${flags}`,
  ].join('\n')
}

/**
 * Orbit click-to-identify meshes. Drag still orbits; a short click raycasts.
 */
type HiddenMeshState = {
  visible: boolean
  hadInspectHidden: boolean
  inspectHidden: unknown
  hadInspectPrevVisible: boolean
  inspectPrevVisible: unknown
}

type InstanceSelection = {
  mesh: InstancedMesh
  instanceId: number
  sourceId: InspectSourceId
  domain: string
}

export class InspectPicker {
  private enabled = false
  private readonly raycaster = new Raycaster()
  private readonly helper: BoxHelper
  private selected: Mesh | null = null
  private selectedInstanceId: number | null = null
  private pointerDown: { x: number; y: number } | null = null
  private readonly hidden = new Map<Mesh, HiddenMeshState>()
  private readonly hiddenInstances = new Map<InstancedMesh, Map<number, Matrix4>>()

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
    const selection = this.getInstanceSelection()
    if (selection) {
      const cohort = this.findInstanceCohort(selection)
      if (cohort.size > 0) {
        for (const [member, instanceId] of cohort) this.collapseInstance(member, instanceId)
        this.refreshInstanceBounds(cohort.keys())
        this.helper.visible = false
        return this.emitSelected()
      }
    }
    this.hideMesh(mesh)
    this.helper.visible = false
    return this.emitSelected()
  }

  isolateSelected(): InspectPickInfo | null {
    const keep = this.selected
    if (!keep) return null
    const selection = this.getInstanceSelection()
    const cohort = selection ? this.findInstanceCohort(selection) : new Map<InstancedMesh, number>()
    const touchedInstances = new Set<InstancedMesh>()
    this.getRoot().traverse((obj) => {
      if (!(obj as Mesh).isMesh) return
      const mesh = obj as Mesh
      if (mesh.userData?.collisionOnly || mesh.userData?.cadOverlay) return
      const keepInstance = cohort.get(mesh as InstancedMesh)
      if (keepInstance != null) {
        const instanced = mesh as InstancedMesh
        for (let i = 0; i < instanced.count; i += 1) {
          if (i !== keepInstance) this.collapseInstance(instanced, i)
        }
        touchedInstances.add(instanced)
        return
      }
      if (mesh === keep) return
      this.hideMesh(mesh)
    })
    this.refreshInstanceBounds(touchedInstances)
    return this.emitSelected()
  }

  restoreHidden(): InspectPickInfo | null {
    for (const [mesh, matrices] of this.hiddenInstances) {
      for (const [instanceId, matrix] of matrices) {
        if (instanceId >= 0 && instanceId < mesh.count) mesh.setMatrixAt(instanceId, matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingBox()
      mesh.computeBoundingSphere()
    }
    this.hiddenInstances.clear()

    for (const [mesh, state] of this.hidden) {
      mesh.visible = state.visible
      if (state.hadInspectHidden) mesh.userData.inspectHidden = state.inspectHidden
      else delete mesh.userData.inspectHidden
      if (state.hadInspectPrevVisible) mesh.userData.inspectPrevVisible = state.inspectPrevVisible
      else delete mesh.userData.inspectPrevVisible
    }
    this.hidden.clear()
    return this.emitSelected()
  }

  clearHighlight(): void {
    this.helper.visible = false
    this.selected = null
    this.selectedInstanceId = null
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

  private hideMesh(mesh: Mesh): void {
    if (!this.hidden.has(mesh)) {
      this.hidden.set(mesh, {
        visible: mesh.visible,
        hadInspectHidden: Object.prototype.hasOwnProperty.call(mesh.userData, 'inspectHidden'),
        inspectHidden: mesh.userData.inspectHidden,
        hadInspectPrevVisible: Object.prototype.hasOwnProperty.call(mesh.userData, 'inspectPrevVisible'),
        inspectPrevVisible: mesh.userData.inspectPrevVisible,
      })
    }
    mesh.userData.inspectHidden = true
    mesh.visible = false
  }

  private getInstanceSelection(): InstanceSelection | null {
    const mesh = this.selected as InstancedMesh | null
    const instanceId = this.selectedInstanceId
    if (!mesh?.isInstancedMesh || instanceId == null) return null
    const sourceId = resolveInspectSourceId(mesh, instanceId)
    const domain = instanceIdentityDomain(mesh)
    if (sourceId == null || domain == null) return null
    if (uniqueInstanceIndex(mesh, sourceId) !== instanceId) return null
    return { mesh, instanceId, sourceId, domain }
  }

  /**
   * Resolve every material-slot batch that represents the same logical source
   * instance. Parent and identity-domain equality are both mandatory; source
   * IDs alone are intentionally insufficient because unrelated families may
   * independently number their instances from zero.
   */
  private findInstanceCohort(selection: InstanceSelection): Map<InstancedMesh, number> {
    const cohort = new Map<InstancedMesh, number>()
    this.getRoot().traverse((obj) => {
      const candidate = obj as InstancedMesh
      if (!candidate.isInstancedMesh || candidate.parent !== selection.mesh.parent) return
      if (instanceIdentityDomain(candidate) !== selection.domain) return
      const instanceId = uniqueInstanceIndex(candidate, selection.sourceId)
      if (instanceId != null) cohort.set(candidate, instanceId)
    })
    return cohort
  }

  private collapseInstance(mesh: InstancedMesh, instanceId: number): void {
    if (instanceId < 0 || instanceId >= mesh.count) return
    let matrices = this.hiddenInstances.get(mesh)
    if (!matrices) {
      matrices = new Map<number, Matrix4>()
      this.hiddenInstances.set(mesh, matrices)
    }
    if (matrices.has(instanceId)) return
    mesh.getMatrixAt(instanceId, _instanceMatrix)
    matrices.set(instanceId, _instanceMatrix.clone())
    // Preserve translation while collapsing all three basis vectors. This
    // hides one logical instance without changing instance ordering/sourceIds.
    _instanceMatrix.scale(_zeroScale)
    mesh.setMatrixAt(instanceId, _instanceMatrix)
    mesh.instanceMatrix.needsUpdate = true
  }

  private refreshInstanceBounds(meshes: Iterable<InstancedMesh>): void {
    for (const mesh of meshes) {
      mesh.computeBoundingBox()
      mesh.computeBoundingSphere()
    }
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
    if (this.selectedInstanceId != null) fakeHit.instanceId = this.selectedInstanceId
    const selectedInstance = this.selected as InstancedMesh
    const originalMatrix = selectedInstance.isInstancedMesh && this.selectedInstanceId != null
      ? this.hiddenInstances.get(selectedInstance)?.get(this.selectedInstanceId)
      : undefined
    const info = pickInfo(fakeHit, originalMatrix)
    if (
      info &&
      selectedInstance.isInstancedMesh &&
      this.selectedInstanceId != null &&
      this.hiddenInstances.get(selectedInstance)?.has(this.selectedInstanceId)
    ) {
      info.visible = false
      if (!info.flags.includes('hidden')) info.flags.push('hidden')
    }
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
    this.selectedInstanceId = typeof hit.instanceId === 'number' ? hit.instanceId : null
    this.helper.setFromObject(mesh)
    this.helper.visible = true
    const info = pickInfo(hit)
    this.onPick(info)
  }
}
