import {
  Color,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  type Object3D,
} from 'three'
import type { Hotspot, HotspotAnchor, SemanticNodeRef } from '../persistence/schema'
import {
  defaultLocalAnchorOnNode,
  listAttachCandidates,
  objectPathFromRoot,
  refFromObject,
  resolveSemanticNode,
} from './resolveAnchor'

export type HotspotPickResult = {
  node: Object3D
  ref: SemanticNodeRef
  localPosition: HotspotAnchor['localPosition']
  localNormal: HotspotAnchor['localNormal']
  fallbackVehicleCoordinate: HotspotAnchor['fallbackVehicleCoordinate']
}

export class HotspotSession {
  private scene: Scene | null = null
  private placement: Object3D | null = null
  private modelRoot: Object3D | null = null
  private camera: PerspectiveCamera | null = null
  private canvas: HTMLCanvasElement | null = null
  private hotspots: Hotspot[] = []
  private markers: Mesh[] = []
  private geometry = new SphereGeometry(0.11, 16, 12)
  private material = new MeshStandardMaterial({
    color: 0xd2b48c,
    emissive: new Color(0x5c4226),
    emissiveIntensity: 0.8,
    roughness: 0.3,
  })
  private selectedMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: new Color(0xd2b48c),
    emissiveIntensity: 1.2,
    roughness: 0.2,
  })
  private raycaster = new Raycaster()
  private pointer = new Vector2()
  private selectedId: string | null = null
  private onSelect: ((hotspot: Hotspot | null) => void) | null = null
  private pickMeshMode = false
  private onPickMesh: ((result: HotspotPickResult) => void) | null = null
  private readonly _local = new Vector3()
  private readonly _world = new Vector3()
  private readonly _normal = new Vector3()

  bind(
    scene: Scene,
    placement: Object3D | null,
    camera: PerspectiveCamera,
    canvas: HTMLCanvasElement,
  ) {
    this.unbindCanvas()
    this.scene = scene
    this.placement = placement
    this.modelRoot = findModelRoot(placement)
    this.camera = camera
    this.canvas = canvas
    canvas.addEventListener('click', this.handleClick)
    this.rebuildMarkers()
  }

  setVehiclePlacement(placement: Object3D | null) {
    this.placement = placement
    this.modelRoot = findModelRoot(placement)
    this.rebuildMarkers()
  }

  setOnSelect(callback: ((hotspot: Hotspot | null) => void) | null) {
    this.onSelect = callback
  }

  setOnPickMesh(callback: ((result: HotspotPickResult) => void) | null) {
    this.onPickMesh = callback
  }

  setPickMeshMode(enabled: boolean) {
    this.pickMeshMode = enabled
    if (this.canvas) {
      this.canvas.style.cursor = enabled ? 'crosshair' : ''
    }
  }

  isPickMeshMode() {
    return this.pickMeshMode
  }

  listDoorCandidates() {
    const root = this.modelRoot ?? this.placement
    if (!root) return []
    return listAttachCandidates(root).map((c) => ({
      name: c.label,
      path: objectPathFromRoot(root, c.node),
      score: c.score,
    }))
  }

  syncFromProject(hotspots: Hotspot[]) {
    this.hotspots = structuredClone(hotspots)
    if (this.selectedId && !this.hotspots.some((item) => item.id === this.selectedId)) {
      this.selectedId = null
    }
    this.rebuildMarkers()
  }

  select(id: string | null) {
    this.selectedId = id
    for (const marker of this.markers) {
      marker.material = marker.userData.hotspotId === id ? this.selectedMaterial : this.material
    }
    const hotspot = id ? this.hotspots.find((item) => item.id === id) ?? null : null
    this.onSelect?.(hotspot)
  }

  getSelectedId() {
    return this.selectedId
  }

  /** Keep markers parented; matrices follow door/mesh animation automatically. */
  update() {
    // no-op — parenting handles motion; kept for call-site symmetry with route/vehicle
  }

  dispose() {
    this.setPickMeshMode(false)
    this.unbindCanvas()
    this.clearMarkers()
    this.geometry.dispose()
    this.material.dispose()
    this.selectedMaterial.dispose()
    this.scene = null
    this.placement = null
    this.modelRoot = null
    this.camera = null
    this.onSelect = null
    this.onPickMesh = null
  }

  private rebuildMarkers() {
    this.clearMarkers()
    if (!this.scene) return
    const searchRoot = this.modelRoot ?? this.placement

    for (const hotspot of this.hotspots) {
      const marker = new Mesh(
        this.geometry,
        hotspot.id === this.selectedId ? this.selectedMaterial : this.material,
      )
      marker.name = `Hotspot_${hotspot.id}`
      marker.userData.hotspotId = hotspot.id
      marker.renderOrder = 10

      const node = searchRoot ? resolveSemanticNode(searchRoot, hotspot.anchor.node) : null
      if (node) {
        const pos = hotspot.anchor.localPosition ?? [0, 0.15, 0]
        const normal = hotspot.anchor.localNormal ?? [0, 1, 0]
        this._local.set(pos[0], pos[1], pos[2])
        this._normal.set(normal[0], normal[1], normal[2]).normalize()
        this._local.addScaledVector(this._normal, hotspot.anchor.offset || 0)
        marker.position.copy(this._local)
        node.add(marker)
        marker.userData.attachedNode = node.name
      } else {
        const fallback =
          hotspot.anchor.fallbackVehicleCoordinate ?? hotspot.anchor.localPosition ?? [0, 1.2, 0]
        marker.position.set(fallback[0], fallback[1] + (hotspot.anchor.offset || 0), fallback[2])
        const parent = this.placement ?? this.scene
        parent.add(marker)
        marker.userData.attachedNode = '(fallback)'
      }
      this.markers.push(marker)
    }
  }

  private clearMarkers() {
    for (const marker of this.markers) marker.parent?.remove(marker)
    this.markers = []
  }

  private readonly handleClick = (event: MouseEvent) => {
    if (!this.camera || !this.canvas) return
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)

    if (this.pickMeshMode && this.placement) {
      const hit = this.raycaster.intersectObject(this.placement, true).find((h) => {
        const obj = h.object
        if (obj.userData.hotspotId) return false
        if (!(obj as Mesh).isMesh) return false
        return true
      })
      if (!hit) return
      const node = preferAttachNode(hit.object, this.modelRoot ?? this.placement)
      const root = this.modelRoot ?? this.placement
      const local = { ...defaultLocalAnchorOnNode(node) }
      // Prefer the actual ray hit in node-local space when available.
      if (hit.face) {
        node.updateWorldMatrix(true, true)
        node.worldToLocal(this._local.copy(hit.point))
        local.localPosition = [this._local.x, this._local.y, this._local.z]
        this._normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize()
        const worldOut = hit.point.clone().add(this._normal)
        const localHit = this._local.clone()
        node.worldToLocal(this._world.copy(worldOut))
        this._world.sub(localHit)
        if (this._world.lengthSq() > 1e-8) {
          this._world.normalize()
          local.localNormal = [this._world.x, this._world.y, this._world.z]
        }
      }
      // Vehicle-space fallback if the named node disappears later.
      this.placement.updateWorldMatrix(true, true)
      node.getWorldPosition(this._world)
      this.placement.worldToLocal(this._local.copy(this._world))
      const result: HotspotPickResult = {
        node,
        ref: refFromObject(root, node),
        localPosition: local.localPosition,
        localNormal: local.localNormal,
        fallbackVehicleCoordinate: [this._local.x, this._local.y + 0.2, this._local.z],
      }
      this.setPickMeshMode(false)
      this.onPickMesh?.(result)
      return
    }

    if (!this.markers.length) return
    const hit = this.raycaster.intersectObjects(this.markers, false)[0]
    if (hit) this.select(String(hit.object.userData.hotspotId))
  }

  private unbindCanvas() {
    this.canvas?.removeEventListener('click', this.handleClick)
    this.canvas = null
  }
}

function findModelRoot(placement: Object3D | null): Object3D | null {
  if (!placement) return null
  const action = placement.getObjectByName('VehicleActionRoot')
  if (!action) return placement
  return action.children[0] ?? action
}

/**
 * Prefer a named parent group (door hinge / panel) over a nameless mesh leaf.
 */
function preferAttachNode(hit: Object3D, root: Object3D): Object3D {
  let best = hit
  let cur: Object3D | null = hit
  while (cur && cur !== root) {
    if (cur.name && scoreName(cur.name) > scoreName(best.name)) best = cur
    cur = cur.parent
  }
  // If nothing scored, climb one level when the leaf is unnamed.
  if (!best.name && hit.parent && hit.parent !== root) return hit.parent
  return best
}

function scoreName(name: string): number {
  if (!name) return 0
  const n = name.toLowerCase()
  if (/door|porte|tuer|tür/.test(n)) return 100
  if (/hood|bonnet|trunk|boot|hatch|tailgate/.test(n)) return 90
  if (/mirror|bumper|grille|glass|window|wheel/.test(n)) return 60
  return name.length > 2 ? 10 : 0
}
