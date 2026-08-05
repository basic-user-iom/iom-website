import {
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
} from 'three'
import type { RouteSession } from './routeSession'

const _ndc = new Vector2()
const _hit = new Vector3()
const GROUND = new Plane(new Vector3(0, 1, 0), 0)

/**
 * Drag route waypoints on the ground plane. While editing, left-drag on a marker
 * moves it; the session rebuilds the spline so the car and wheels stay on the path.
 */
export class RouteEditController {
  private session: RouteSession
  private camera: Camera
  private dom: HTMLElement
  private raycaster = new Raycaster()
  private dragging = -1
  private enabled = false
  private onChange: ((index: number) => void) | null = null
  private onCommit: ((index: number) => void) | null = null

  private onPointerDown = (e: PointerEvent) => this.handleDown(e)
  private onPointerMove = (e: PointerEvent) => this.handleMove(e)
  private onPointerUp = (e: PointerEvent) => this.handleUp(e)
  private onKeyDown = (e: KeyboardEvent) => this.handleKey(e)

  constructor(session: RouteSession, camera: Camera, dom: HTMLElement) {
    this.session = session
    this.camera = camera
    this.dom = dom
  }

  setOnChange(cb: ((index: number) => void) | null) {
    this.onChange = cb
  }

  setOnCommit(cb: ((index: number) => void) | null) {
    this.onCommit = cb
  }

  setEnabled(on: boolean) {
    if (this.enabled === on) return
    this.enabled = on
    this.dragging = -1
    this.session.setEditing(on)
    if (on) {
      this.dom.addEventListener('pointerdown', this.onPointerDown)
      window.addEventListener('pointermove', this.onPointerMove)
      window.addEventListener('pointerup', this.onPointerUp)
      window.addEventListener('keydown', this.onKeyDown)
      this.dom.style.cursor = 'crosshair'
    } else {
      this.dom.removeEventListener('pointerdown', this.onPointerDown)
      window.removeEventListener('pointermove', this.onPointerMove)
      window.removeEventListener('pointerup', this.onPointerUp)
      window.removeEventListener('keydown', this.onKeyDown)
      this.dom.style.cursor = ''
      this.session.setActiveMarker(-1)
    }
  }

  isEnabled() {
    return this.enabled
  }

  isDragging() {
    return this.dragging >= 0
  }

  dispose() {
    this.setEnabled(false)
  }

  private pointerToGround(e: PointerEvent): Vector3 | null {
    const rect = this.dom.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(_ndc, this.camera)
    const hit = this.raycaster.ray.intersectPlane(GROUND, _hit)
    return hit ? _hit.clone() : null
  }

  private pickWaypoint(e: PointerEvent): number {
    const ground = this.pointerToGround(e)
    if (!ground) return -1
    const pts = this.session.getWaypointPositions()
    let best = -1
    let bestDist = 1.1 // metres pick radius
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - ground.x, pts[i].z - ground.z)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    return best
  }

  private handleDown(e: PointerEvent) {
    if (!this.enabled || e.button !== 0) return
    const index = this.pickWaypoint(e)
    if (index < 0) {
      // Alt-click empty ground → insert a waypoint on the nearest segment.
      if (e.altKey) {
        const ground = this.pointerToGround(e)
        if (!ground) return
        e.preventDefault()
        e.stopPropagation()
        const route = this.session.addWaypointAt(ground.x, ground.z)
        if (route) {
          this.onChange?.(this.session.getStatus().waypointCount - 1)
          this.onCommit?.(this.session.getStatus().waypointCount - 1)
        }
      }
      return
    }
    e.preventDefault()
    e.stopPropagation()
    this.dragging = index
    this.session.setActiveMarker(index)
    this.dom.setPointerCapture?.(e.pointerId)
    this.dom.style.cursor = 'grabbing'
  }

  private handleMove(e: PointerEvent) {
    if (!this.enabled || this.dragging < 0) return
    const ground = this.pointerToGround(e)
    if (!ground) return
    e.preventDefault()
    this.session.setWaypoint(this.dragging, ground.x, ground.z)
    this.onChange?.(this.dragging)
  }

  private handleUp(e: PointerEvent) {
    if (this.dragging < 0) return
    const index = this.dragging
    try {
      this.dom.releasePointerCapture?.(e.pointerId)
    } catch {
      /* already released */
    }
    this.dragging = -1
    this.dom.style.cursor = this.enabled ? 'crosshair' : ''
    this.onCommit?.(index)
  }

  private handleKey(e: KeyboardEvent) {
    if (!this.enabled) return
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const route = this.session.removeWaypoint()
      if (route) {
        e.preventDefault()
        this.onChange?.(0)
        this.onCommit?.(0)
      }
    } else if (e.key === 'Insert' || (e.key === 'a' && (e.altKey || e.ctrlKey))) {
      const route = this.session.addWaypoint()
      if (route) {
        e.preventDefault()
        this.onChange?.(0)
        this.onCommit?.(0)
      }
    }
  }
}