import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  DoubleSide,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  type Object3D,
} from 'three'
import type { Hotspot, HotspotAnchor, SemanticNodeRef } from '../persistence/schema'
import {
  DEFAULT_MARKER_LABEL_OFFSET,
  DEFAULT_MARKER_LABEL_SCALE,
} from './hotspotContent'
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

type MarkerParts = {
  root: Group
  core: Mesh
  ring: Mesh
  halo: Mesh
  pick: Mesh
  label: Mesh | null
}

/** Base title-plate size in world metres at scale 1 (plane is unit, then scaled). */
const LABEL_BASE_W = 0.42
const LABEL_BASE_H = 0.112

/**
 * Marker meshes are authored in world metres. Attach parents (door nodes on cm-unit
 * Sketchfab cars) often have world scale ≪ 1, so we counter-scale the marker root.
 * Older builds used ~0.78 m cores without compensation → viewport-sized spheres online.
 */
const WORLD_CORE_R = 0.09
const WORLD_RING_INNER = 0.12
const WORLD_RING_OUTER = 0.2
const WORLD_HALO_R = 0.3
const WORLD_PICK_R = 0.38
/** Prior uncompensated core radius — used to shrink legacy title-plate offsets. */
const LEGACY_CORE_R = 0.78

/**
 * Interactive hotspot markers: pulsing ring + gem core + optional label
 * (surface-aligned plate — not a camera billboard).
 */
export class HotspotSession {
  private scene: Scene | null = null
  private placement: Object3D | null = null
  private modelRoot: Object3D | null = null
  private camera: PerspectiveCamera | null = null
  private canvas: HTMLCanvasElement | null = null
  private hotspots: Hotspot[] = []
  private markers: MarkerParts[] = []
  private coreGeo = new SphereGeometry(WORLD_CORE_R, 22, 18)
  private ringGeo = new RingGeometry(WORLD_RING_INNER, WORLD_RING_OUTER, 48)
  private haloGeo = new CircleGeometry(WORLD_HALO_R, 36)
  private pickGeo = new SphereGeometry(WORLD_PICK_R, 12, 10)
  private labelGeo = new PlaneGeometry(1, 1)
  private readonly _zAxis = new Vector3(0, 0, 1)
  private readonly _qAlign = new Quaternion()
  private readonly _qManual = new Quaternion()
  private readonly _euler = new Euler(0, 0, 0, 'YXZ')
  private coreMat = new MeshStandardMaterial({
    color: 0xffe8c8,
    emissive: new Color(0xd4a574),
    emissiveIntensity: 1.35,
    roughness: 0.25,
    metalness: 0.35,
  })
  private coreSelectedMat = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: new Color(0xf0d0a0),
    emissiveIntensity: 2.1,
    roughness: 0.18,
    metalness: 0.4,
  })
  private ringMat = new MeshBasicMaterial({
    color: 0xe8c49a,
    transparent: true,
    opacity: 0.75,
    side: DoubleSide,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  private ringSelectedMat = new MeshBasicMaterial({
    color: 0xfff0d8,
    transparent: true,
    opacity: 0.95,
    side: DoubleSide,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  private haloMat = new MeshBasicMaterial({
    color: 0xd2b48c,
    transparent: true,
    opacity: 0.22,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  private pickMat = new MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
  })
  private raycaster = new Raycaster()
  private pointer = new Vector2()
  private selectedId: string | null = null
  private onSelect: ((hotspot: Hotspot | null) => void) | null = null
  private pickMeshMode = false
  private onPickMesh: ((result: HotspotPickResult) => void) | null = null
  private pulsePhase = 0
  private readonly _local = new Vector3()
  private readonly _world = new Vector3()
  private readonly _normal = new Vector3()
  private readonly _up = new Vector3()
  private readonly _right = new Vector3()
  private readonly _forward = new Vector3()
  private readonly _basis = new Matrix4()
  private readonly _invMat = new Matrix4()
  private labelTextures = new Map<string, CanvasTexture>()

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
      const selected = marker.root.userData.hotspotId === id
      marker.core.material = selected ? this.coreSelectedMat : this.coreMat
      marker.ring.material = selected ? this.ringSelectedMat : this.ringMat
      const metre = typeof marker.root.userData.metreScale === 'number'
        ? marker.root.userData.metreScale
        : 1
      marker.root.scale.setScalar(selected ? metre * 1.2 : metre)
    }
    const hotspot = id ? this.hotspots.find((item) => item.id === id) ?? null : null
    this.onSelect?.(hotspot)
  }

  getSelectedId() {
    return this.selectedId
  }

  /** Soft pulse only — orientation stays locked to the door surface. */
  update() {
    this.pulsePhase += 0.045
    const pulse = 0.55 + 0.35 * Math.sin(this.pulsePhase)
    const ringScale = 1 + 0.12 * Math.sin(this.pulsePhase * 1.15)
    for (const marker of this.markers) {
      const selected = marker.root.userData.hotspotId === this.selectedId
      const ringMat = marker.ring.material as MeshBasicMaterial
      const haloMat = marker.halo.material as MeshBasicMaterial
      ringMat.opacity = selected ? 0.9 + 0.08 * Math.sin(this.pulsePhase) : 0.45 + 0.3 * pulse
      haloMat.opacity = selected ? 0.32 : 0.12 + 0.14 * pulse
      marker.ring.scale.setScalar(ringScale)
      marker.halo.scale.setScalar(0.95 + 0.1 * pulse)
    }
  }

  dispose() {
    this.setPickMeshMode(false)
    this.unbindCanvas()
    this.clearMarkers()
    this.coreGeo.dispose()
    this.ringGeo.dispose()
    this.haloGeo.dispose()
    this.pickGeo.dispose()
    this.labelGeo.dispose()
    this.coreMat.dispose()
    this.coreSelectedMat.dispose()
    this.ringMat.dispose()
    this.ringSelectedMat.dispose()
    this.haloMat.dispose()
    this.pickMat.dispose()
    for (const tex of this.labelTextures.values()) tex.dispose()
    this.labelTextures.clear()
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
      const selected = hotspot.id === this.selectedId
      const root = new Group()
      root.name = `Hotspot_${hotspot.id}`
      root.userData.hotspotId = hotspot.id
      root.renderOrder = 2

      const core = new Mesh(this.coreGeo, selected ? this.coreSelectedMat : this.coreMat)
      core.renderOrder = 3
      const ring = new Mesh(
        this.ringGeo,
        (selected ? this.ringSelectedMat : this.ringMat).clone(),
      )
      ring.renderOrder = 2
      const halo = new Mesh(this.haloGeo, this.haloMat.clone())
      halo.renderOrder = 1
      const pick = new Mesh(this.pickGeo, this.pickMat)
      pick.userData.hotspotId = hotspot.id

      root.add(halo, ring, core, pick)

      const labelText = (hotspot.markerLabel || hotspot.name || '').trim()
      let label: Mesh | null = null
      if (labelText && labelText.toLowerCase() !== 'hotspot') {
        label = this.makeLabelPlane(labelText)
        const layout = sanitizeMarkerLabelLayout(
          hotspot.markerLabelScale,
          hotspot.markerLabelOffset,
        )
        label.position.set(layout.offset[0], layout.offset[1], layout.offset[2])
        label.scale.set(LABEL_BASE_W * layout.scale, LABEL_BASE_H * layout.scale, 1)
        root.add(label)
      }

      const node = searchRoot ? resolveSemanticNode(searchRoot, hotspot.anchor.node) : null
      if (node) {
        const pos = hotspot.anchor.localPosition ?? [0, 0.15, 0]
        const normal = hotspot.anchor.localNormal ?? [0, 0, 1]
        this._local.set(pos[0], pos[1], pos[2])
        this._normal.set(normal[0], normal[1], normal[2])
        if (this._normal.lengthSq() < 1e-10) this._normal.set(0, 0, 1)
        else this._normal.normalize()
        // Barely clear the paint — rings lie in the surface plane.
        // Ignore legacy huge offsets from the oversized camera-billboard markers.
        const rawLift = hotspot.anchor.offset
        // Slightly clear curved panels so rings don't depth-clip into paint.
        const lift = rawLift > 0 && rawLift <= 0.35 ? rawLift : 0.02
        this._local.addScaledVector(this._normal, lift)
        root.position.copy(this._local)
        this.applySurfaceOrientation(root, this._normal, hotspot.markerRotationDeg, node)
        node.add(root)
        const metre = metreScaleForParent(node)
        root.userData.metreScale = metre
        root.scale.setScalar(selected ? metre * 1.2 : metre)
        root.userData.attachedNode = node.name
      } else {
        const fallback =
          hotspot.anchor.fallbackVehicleCoordinate ?? hotspot.anchor.localPosition ?? [0, 1.2, 0]
        root.position.set(fallback[0], fallback[1] + (hotspot.anchor.offset || 0), fallback[2])
        const parent = this.placement ?? this.scene
        this.applySurfaceOrientation(root, new Vector3(0, 0, 1), hotspot.markerRotationDeg, parent)
        parent.add(root)
        const metre = metreScaleForParent(parent)
        root.userData.metreScale = metre
        root.scale.setScalar(selected ? metre * 1.2 : metre)
        root.userData.attachedNode = '(fallback)'
      }
      this.markers.push({ root, core, ring, halo, pick, label })
    }
  }

  /**
   * Ring/Plane face +Z. Build a full orthonormal frame so marker +Y is "up the door"
   * (world +Y projected into the surface plane). Bare setFromUnitVectors left roll
   * unconstrained, which skewed the title plate offset along root +Y.
   */
  private applySurfaceOrientation(
    root: Group,
    normal: Vector3,
    rotationDeg?: readonly [number, number, number] | null,
    attachParent?: Object3D | null,
  ) {
    this._forward.copy(normal)
    if (this._forward.lengthSq() < 1e-10) this._forward.copy(this._zAxis)
    else this._forward.normalize()

    // World +Y expressed in the same space as `normal` (attach-node local).
    this._up.set(0, 1, 0)
    if (attachParent) {
      attachParent.updateWorldMatrix(true, false)
      this._invMat.copy(attachParent.matrixWorld).invert()
      this._up.transformDirection(this._invMat)
      if (this._up.lengthSq() < 1e-10) this._up.set(0, 1, 0)
      else this._up.normalize()
    }

    this._right.crossVectors(this._up, this._forward)
    if (this._right.lengthSq() < 1e-8) {
      // Normal ≈ world up — pick a stable horizontal reference.
      this._up.set(0, 0, 1)
      if (attachParent) {
        this._up.transformDirection(this._invMat)
        if (this._up.lengthSq() < 1e-10) this._up.set(1, 0, 0)
        else this._up.normalize()
      }
      this._right.crossVectors(this._up, this._forward)
    }
    this._right.normalize()
    this._up.crossVectors(this._forward, this._right).normalize()
    this._basis.makeBasis(this._right, this._up, this._forward)
    this._qAlign.setFromRotationMatrix(this._basis)

    const rx = ((rotationDeg?.[0] ?? 0) * Math.PI) / 180
    const ry = ((rotationDeg?.[1] ?? 0) * Math.PI) / 180
    const rz = ((rotationDeg?.[2] ?? 0) * Math.PI) / 180
    this._euler.set(rx, ry, rz, 'YXZ')
    this._qManual.setFromEuler(this._euler)
    root.quaternion.copy(this._qAlign).multiply(this._qManual)
  }

  private makeLabelPlane(text: string): Mesh {
    let tex = this.labelTextures.get(text)
    if (!tex) {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 128
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, 512, 128)
      ctx.fillStyle = 'rgba(12, 14, 18, 0.78)'
      roundRect(ctx, 16, 24, 480, 80, 18)
      ctx.fill()
      ctx.font = '600 36px "Segoe UI", system-ui, sans-serif'
      ctx.fillStyle = '#f3e6d4'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const clipped = text.length > 28 ? `${text.slice(0, 27)}…` : text
      ctx.fillText(clipped, 256, 64)
      tex = new CanvasTexture(canvas)
      this.labelTextures.set(text, tex)
    }
    const mat = new MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
    const mesh = new Mesh(this.labelGeo, mat)
    mesh.renderOrder = 4
    return mesh
  }

  private clearMarkers() {
    for (const marker of this.markers) {
      marker.root.parent?.remove(marker.root)
      ;(marker.ring.material as MeshBasicMaterial).dispose()
      ;(marker.halo.material as MeshBasicMaterial).dispose()
      if (marker.label) {
        const mat = marker.label.material as MeshBasicMaterial
        mat.dispose()
      }
    }
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
        if (obj.userData.hotspotId || findHotspotId(obj)) return false
        if (!(obj as Mesh).isMesh) return false
        return true
      })
      if (!hit) return
      const node = preferAttachNode(hit.object, this.modelRoot ?? this.placement)
      const root = this.modelRoot ?? this.placement
      const local = { ...defaultLocalAnchorOnNode(node) }
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
    const roots = this.markers.map((m) => m.root)
    const hit = this.raycaster.intersectObjects(roots, true)[0]
    if (!hit) return
    const id = findHotspotId(hit.object)
    if (id) this.select(id)
  }

  private unbindCanvas() {
    this.canvas?.removeEventListener('click', this.handleClick)
    this.canvas = null
  }
}

function findHotspotId(obj: Object3D): string | null {
  let cur: Object3D | null = obj
  while (cur) {
    if (typeof cur.userData.hotspotId === 'string') return cur.userData.hotspotId
    cur = cur.parent
  }
  return null
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function findModelRoot(placement: Object3D | null): Object3D | null {
  if (!placement) return null
  const action = placement.getObjectByName('VehicleActionRoot')
  if (!action) return placement
  return action.children[0] ?? action
}

/** Average world-scale of a parent so marker local units ≈ metres. */
function metreScaleForParent(parent: Object3D): number {
  parent.updateWorldMatrix(true, false)
  const e = parent.matrixWorld.elements
  const sx = Math.hypot(e[0], e[1], e[2])
  const sy = Math.hypot(e[4], e[5], e[6])
  const sz = Math.hypot(e[8], e[9], e[10])
  const parentScale = (sx + sy + sz) / 3
  if (!Number.isFinite(parentScale) || parentScale < 1e-8) return 1
  return 1 / parentScale
}

/**
 * Shrink legacy title-plate layout authored next to the old 0.78 m uncompensated cores.
 */
function sanitizeMarkerLabelLayout(
  scale: number | null | undefined,
  offset: readonly [number, number, number] | null | undefined,
): { scale: number; offset: [number, number, number] } {
  let nextScale = scale ?? DEFAULT_MARKER_LABEL_SCALE
  let nextOffset: [number, number, number] = offset
    ? [offset[0], offset[1], offset[2]]
    : [...DEFAULT_MARKER_LABEL_OFFSET]
  const maxAbs = Math.max(
    Math.abs(nextOffset[0]),
    Math.abs(nextOffset[1]),
    Math.abs(nextOffset[2]),
  )
  if (maxAbs > 1.0) {
    const shrink = WORLD_CORE_R / LEGACY_CORE_R
    nextOffset = [nextOffset[0] * shrink, nextOffset[1] * shrink, nextOffset[2] * shrink]
    if (nextScale > 1.25) nextScale = Math.min(nextScale * shrink * 4, 1.25)
  }
  nextScale = Math.max(0.35, Math.min(2, nextScale))
  return { scale: nextScale, offset: nextOffset }
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
