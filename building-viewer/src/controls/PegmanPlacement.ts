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
  type PerspectiveCamera,
  type Object3D,
} from 'three'
import type { ICollisionWorld } from '../collision/types'
import { isValidSpawnPoint, type CharacterController } from '../collision/CharacterController'
import type { CharacterParams } from '../collision/types'

const _ndc = new Vector2()
const _hitPoint = new Vector3()
const _hitNormal = new Vector3()

export type PegmanDropResult = {
  ok: boolean
  reason?: string
  point?: Vector3
  yaw?: number
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
      ) ?? this.raycastVisualFallback()
    if (!hit) {
      this.setValidity(false, 'No surface under cursor')
      this.preview.visible = false
      return
    }

    _hitPoint.copy(hit.point)
    _hitNormal.copy(hit.normal)
    // Face normals can point away from the camera on double-sided decks.
    if (_hitNormal.dot(this.raycaster.ray.direction) > 0) _hitNormal.negate()

    // Prefer the topmost walkable slab under the cursor (dual-layer floors).
    if (this.world.raycastBestGround) {
      const probeY = _hitPoint.y + 1.6
      const best = this.world.raycastBestGround(
        new Vector3(_hitPoint.x, probeY, _hitPoint.z),
        3.2,
        0.45,
      )
      if (best && best.point.y >= _hitPoint.y - 0.02) {
        _hitPoint.copy(best.point)
        _hitNormal.copy(best.normal)
      }
    }

    const validation = isValidSpawnPoint(this.world, _hitPoint, _hitNormal, this.params)
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

  /** When dedicated collision misses plaza tiles, pick horizontal visual meshes. */
  private raycastVisualFallback(): { point: Vector3; normal: Vector3; distance: number } | null {
    if (!this.modelRoot) return null
    const hits = this.raycaster.intersectObject(this.modelRoot, true)
    for (const hit of hits) {
      const mesh = hit.object as Mesh
      if (!mesh?.isMesh) continue
      if (mesh.userData?.collisionOnly) continue
      if (mesh.userData?.architecturalGlass) continue
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (mats.some((m) => m && (m.transparent || m.opacity < 0.95))) continue
      const n = hit.face?.normal
        ? hit.face.normal.clone().transformDirection(mesh.matrixWorld).normalize()
        : new Vector3(0, 1, 0)
      if (n.dot(this.raycaster.ray.direction) > 0) n.negate()
      // Prefer walkable-ish surfaces (not steep walls).
      if (n.y < 0.45) continue
      return { point: hit.point.clone(), normal: n, distance: hit.distance }
    }
    return null
  }

  private handleUp(_e: PointerEvent): void {
    if (!this.dragging) return
    this.dragging = false
    this.onDragState?.(false)
    document.body.classList.remove('bv-pegman-dragging')
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)

    const result: PegmanDropResult =
      this.valid && this.lastPoint
        ? { ok: true, point: this.lastPoint.clone(), yaw: this.lastYaw }
        : { ok: false, reason: this.statusEl?.textContent || 'Invalid placement' }

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
