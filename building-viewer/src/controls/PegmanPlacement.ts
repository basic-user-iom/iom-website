import {
  Group,
  Mesh,
  MeshBasicMaterial,
  CircleGeometry,
  CapsuleGeometry,
  SphereGeometry,
  Raycaster,
  Vector2,
  Vector3,
  type Material,
  type PerspectiveCamera,
  type Object3D,
} from 'three'
import type { ICollisionWorld } from '../collision/types'
import { isValidSpawnPoint, type CharacterController } from '../collision/CharacterController'
import type { CharacterParams, CollisionHit, SpawnValidationResult } from '../collision/types'
import {
  isExplicitWalkableSurface,
  isForbiddenWalkSurface,
  objectPathLabel,
} from '../scene/assetSemantics'

const _ndc = new Vector2()
const _hitPoint = new Vector3()
const _hitNormal = new Vector3()
const _supportOrigin = new Vector3()
const _down = new Vector3(0, -1, 0)

const VISIBLE_SUPPORT_TOLERANCE = 0.12
const STAIR_SUPPORT_TOLERANCE = 0.16

export type PegmanDropResult = {
  ok: boolean
  reason?: string
  point?: Vector3
  yaw?: number
  /** Visible model layer that owns the selected walking surface. */
  layerId?: string
}

export function finalizeVisiblePegmanDrop(
  visibleResult: PegmanDropResult | null,
): PegmanDropResult {
  return visibleResult ?? {
    ok: false,
    reason: 'No eligible rendered walk surface under cursor',
  }
}

export type PlacementSurface = CollisionHit & {
  objectName?: string
  materialName?: string
  explicitWalkable?: boolean
  stairSurface?: boolean
}

function faceMaterial(mesh: Mesh, materialIndex = 0): Material | null {
  if (Array.isArray(mesh.material)) {
    return mesh.material[materialIndex] ?? mesh.material[0] ?? null
  }
  return mesh.material ?? null
}

function isStairSurface(mesh: Mesh, material: Material): boolean {
  return /stair|step|tread|riser|landing|treppe|stufe|stufen|podest|ramp/i.test(
    `${objectPathLabel(mesh)} ${material.name || ''}`,
  )
}

/**
 * Authoritative placement gate: the rendered surface and same-layer collision
 * support must agree vertically. This prevents invisible collision volumes
 * from becoming spawn platforms while preserving authored stair tolerances.
 */
export function validateVisiblePlacementSurface(
  world: ICollisionWorld,
  surface: PlacementSurface,
  params: CharacterParams,
): SpawnValidationResult {
  const previousLayer = world.getQueryLayer?.() ?? null
  if (surface.layerId) world.setQueryLayer?.(surface.layerId)
  try {
    const tolerance = surface.stairSurface
      ? STAIR_SUPPORT_TOLERANCE
      : VISIBLE_SUPPORT_TOLERANCE
    _supportOrigin.set(
      surface.point.x,
      surface.point.y + tolerance + 0.04,
      surface.point.z,
    )
    const support =
      world.raycastBestGround?.(
        _supportOrigin,
        tolerance * 2 + 0.08,
        params.maxSlope,
      ) ??
      world.raycast(_supportOrigin, _down, tolerance * 2 + 0.08)
    if (!support) {
      return { ok: false, reason: 'Rendered surface has no matching walk support' }
    }
    if (
      surface.layerId &&
      support.layerId &&
      surface.layerId !== support.layerId
    ) {
      return { ok: false, reason: 'Walk support belongs to another model layer' }
    }
    const heightError = Math.abs(support.point.y - surface.point.y)
    if (heightError > tolerance) {
      return {
        ok: false,
        reason: `Rendered/collision height mismatch (${heightError.toFixed(2)} m)`,
      }
    }
    const supportNormal = support.normal.clone()
    if (supportNormal.y < 0) supportNormal.negate()
    return isValidSpawnPoint(
      world,
      support.point.clone(),
      supportNormal,
      params,
      surface.objectName,
    )
  } finally {
    world.setQueryLayer?.(previousLayer)
  }
}

/**
 * Google Street View–style drag person onto the model to enter Walk mode.
 */
export class PegmanPlacement {
  readonly preview = new Group()
  private marker: Mesh
  private ghost: Group
  private dragging = false
  private valid = false
  private lastPoint: Vector3 | null = null
  private lastYaw = 0
  private readonly raycaster = new Raycaster()
  private world: ICollisionWorld | null = null
  private modelRoot: Object3D | null = null
  private params: CharacterParams
  private statusEl: HTMLElement | null = null

  private readonly onPointerMove: (e: PointerEvent) => void
  private readonly onPointerUp: (e: PointerEvent) => void

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly dom: HTMLElement,
    private readonly getParams: () => CharacterParams,
    private readonly onDrop: (result: PegmanDropResult) => void,
    private readonly onDragState?: (dragging: boolean) => void,
  ) {
    this.params = getParams()
    this.preview.name = 'PegmanPreview'
    this.preview.visible = false
    this.preview.renderOrder = 10

    const markerMat = new MeshBasicMaterial({
      color: 0x3dcc7a,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      depthTest: false,
    })
    this.marker = new Mesh(new CircleGeometry(0.45, 48), markerMat)
    this.marker.rotation.x = -Math.PI / 2
    this.marker.position.y = 0.03

    // Simple person silhouette (head + body) — ICM magenta
    this.ghost = new Group()
    const ghostMat = new MeshBasicMaterial({
      color: 0xa54597,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      depthTest: false,
    })
    const body = new Mesh(new CapsuleGeometry(0.18, 0.85, 4, 10), ghostMat)
    body.position.y = 0.95
    const head = new Mesh(new SphereGeometry(0.16, 16, 12), ghostMat.clone())
    head.position.y = 1.62
    this.ghost.add(body, head)

    this.preview.add(this.marker, this.ghost)

    this.onPointerMove = (e) => this.handleMove(e)
    this.onPointerUp = (e) => this.handleUp(e)
  }

  setStatusElement(el: HTMLElement | null): void {
    this.statusEl = el
  }

  setWorld(world: ICollisionWorld | null, modelRoot: Object3D | null): void {
    this.world = world
    this.modelRoot = modelRoot
  }

  /** Call from UI when pegman drag starts (pointerdown on icon). */
  beginDrag(e: PointerEvent): void {
    e.preventDefault()
    this.dragging = true
    this.preview.visible = true
    this.params = this.getParams()
    this.onDragState?.(true)
    document.body.classList.add('bv-pegman-dragging')
    window.addEventListener('pointermove', this.onPointerMove, { passive: false })
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    this.setStatus('Drop on a walkable surface')
    this.handleMove(e)
  }

  private handleMove(e: PointerEvent): void {
    if (!this.dragging) return
    e.preventDefault()

    if (!this.world || !this.modelRoot) {
      this.setValidity(false, 'Collision not ready')
      return
    }

    const rect = this.dom.getBoundingClientRect()
    _ndc.x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    _ndc.y = -((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    this.raycaster.setFromCamera(_ndc, this.camera)

    const hit =
      this.world.raycast(
        this.raycaster.ray.origin,
        this.raycaster.ray.direction,
        2000,
      ) ?? this.raycastVisualSurface()
    if (!hit) {
      this.setValidity(false, 'No surface under cursor')
      this.preview.visible = false
      return
    }

    _hitPoint.copy(hit.point)
    _hitNormal.copy(hit.normal)
    // Face normals can point away from the camera on double-sided decks.
    if (_hitNormal.dot(this.raycaster.ray.direction) > 0) _hitNormal.negate()

    // Validate against the hit's own layer. A globally merged capsule query can
    // otherwise let an overlapping interior/platform collider reject exterior paving.
    const validation = this.validateSurface({
      ...hit,
      point: _hitPoint,
      normal: _hitNormal,
    })
    this.lastPoint = validation.point ?? hit.point.clone()
    this.lastYaw = Math.atan2(
      this.camera.position.x - _hitPoint.x,
      this.camera.position.z - _hitPoint.z,
    )
    this.setValidity(validation.ok, validation.reason ?? (validation.ok ? 'Valid placement' : 'Invalid'))
    this.preview.position.copy(this.lastPoint)
    this.preview.visible = true
    this.ghost.rotation.y = this.lastYaw + Math.PI
  }

  /**
   * Pick the surface that is actually rendered and preserve its model-layer owner.
   * This runs as a fallback during drag and once on pointer-up for authoritative
   * placement; the latter prevents invisible overlapping collision from winning.
   */
  private raycastVisualSurface(): PlacementSurface | null {
    if (!this.modelRoot) return null
    let best: PlacementSurface | null = null
    const layerRoots = this.modelRoot.children.length ? this.modelRoot.children : [this.modelRoot]
    for (const layerRoot of layerRoots) {
      if (!layerRoot.visible) continue
      const layerId =
        typeof layerRoot.userData?.layerId === 'string'
          ? layerRoot.userData.layerId
          : layerRoot.name.startsWith('Model:')
            ? layerRoot.name.slice('Model:'.length)
            : undefined
      const hits = this.raycaster.intersectObject(layerRoot, true)
      for (const hit of hits) {
        if (best && hit.distance >= best.distance) break
        const mesh = hit.object as Mesh
        if (!mesh?.isMesh || !this.isVisibleWithinLayer(mesh, layerRoot)) continue
        if (mesh.userData?.collisionOnly) continue
        // A mixed-material object must be judged by the intersected slot only;
        // rejecting every slot hid valid floors attached to a glass assembly.
        const material = faceMaterial(mesh, hit.face?.materialIndex ?? 0)
        if (!material?.visible) continue
        const explicitWalkable = isExplicitWalkableSurface(mesh, material)
        if (mesh.userData?.architecturalGlass && !explicitWalkable) continue
        if (
          !explicitWalkable &&
          (material.transparent || material.opacity < 0.95)
        ) continue
        if (!explicitWalkable && isForbiddenWalkSurface(mesh, material)) continue
        const n = hit.face?.normal
          ? hit.face.normal.clone().transformDirection(mesh.matrixWorld).normalize()
          : new Vector3(0, 1, 0)
        if (n.dot(this.raycaster.ray.direction) > 0) n.negate()
        // Prefer walkable-ish surfaces (not steep walls).
        if (n.y < this.params.maxSlope) continue
        best = {
          point: hit.point.clone(),
          normal: n,
          distance: hit.distance,
          layerId,
          objectName: mesh.name,
          materialName: material.name,
          explicitWalkable,
          stairSurface: isStairSurface(mesh, material),
        }
        break
      }
    }
    return best
  }

  private isVisibleWithinLayer(object: Object3D, layerRoot: Object3D): boolean {
    let current: Object3D | null = object
    while (current) {
      if (!current.visible) return false
      if (current === layerRoot) return true
      current = current.parent
    }
    return false
  }

  private validateSurface(surface: PlacementSurface): SpawnValidationResult {
    if (!this.world) return { ok: false, reason: 'Collision not ready' }
    return validateVisiblePlacementSurface(this.world, surface, this.params)
  }

  private resolveVisibleDrop(): PegmanDropResult | null {
    if (!this.world || !this.modelRoot) return null
    const surface = this.raycastVisualSurface()
    if (!surface) return null
    const validation = this.validateSurface(surface)
    if (!validation.ok || !validation.point) {
      return { ok: false, reason: validation.reason ?? 'Invalid visible surface' }
    }
    const yaw = Math.atan2(
      this.camera.position.x - validation.point.x,
      this.camera.position.z - validation.point.z,
    )
    return {
      ok: true,
      point: validation.point.clone(),
      yaw,
      layerId: surface.layerId,
    }
  }

  private handleUp(_e: PointerEvent): void {
    if (!this.dragging) return

    // Collision is intentionally the fast drag preview. On release, anchor to
    // the rendered surface and retain its layer for the whole walk session.
    const visibleResult = this.resolveVisibleDrop()
    const result = finalizeVisiblePegmanDrop(visibleResult)

    this.dragging = false
    this.onDragState?.(false)
    document.body.classList.remove('bv-pegman-dragging')
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)

    this.preview.visible = false
    this.setStatus('')
    this.onDrop(result)
  }

  private setValidity(ok: boolean, reason?: string): void {
    this.valid = ok
    const color = ok ? 0x3dcc7a : 0xe05555
    ;(this.marker.material as MeshBasicMaterial).color.setHex(color)
    this.ghost.traverse((o) => {
      if ((o as Mesh).isMesh) {
        ;((o as Mesh).material as MeshBasicMaterial).color.setHex(ok ? 0xc8a45a : 0xe05555)
      }
    })
    this.setStatus(reason ?? '')
  }

  private setStatus(text: string): void {
    if (!this.statusEl) return
    this.statusEl.textContent = text
    this.statusEl.classList.toggle('show', Boolean(text))
    this.statusEl.classList.toggle('is-ok', this.valid)
    this.statusEl.classList.toggle('is-bad', !this.valid && Boolean(text))
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    document.body.classList.remove('bv-pegman-dragging')
    this.marker.geometry.dispose()
    ;(this.marker.material as MeshBasicMaterial).dispose()
    this.ghost.traverse((o) => {
      if ((o as Mesh).isMesh) {
        ;(o as Mesh).geometry.dispose()
        ;((o as Mesh).material as MeshBasicMaterial).dispose()
      }
    })
  }
}

export function placeCharacterFromPegman(
  controller: CharacterController,
  result: PegmanDropResult,
): boolean {
  if (!result.ok || !result.point) return false
  controller.setFeetPosition(result.point, result.yaw ?? 0)
  return true
}
