import { Vector3 } from 'three'
import type { SceneBounds } from '../scene/SceneBounds'

export type CameraView = {
  id: string
  name: string
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
  fov: number
  transitionSeconds: number
  /** Built-in framing — not user-deletable. */
  builtIn?: boolean
  thumbnailDataUrl?: string
}

/** Portable JSON for Export → hand off → ship as `/models/camera-views.json`. */
export type CameraViewsExport = {
  version: 1
  exportedAt: string
  note: string
  views: Array<{
    id: string
    name: string
    cameraPosition: [number, number, number]
    cameraTarget: [number, number, number]
    fov: number
    transitionSeconds: number
  }>
}

const STORAGE_KEY = 'iom-building-viewer:camera-views:v1'
export const CAMERA_VIEWS_DEFAULTS_URL = '/models/camera-views.json'

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeView(v: Partial<CameraView> & {
  cameraPosition?: unknown
  cameraTarget?: unknown
}, builtIn: boolean): CameraView | null {
  if (!Array.isArray(v.cameraPosition) || v.cameraPosition.length < 3) return null
  if (!Array.isArray(v.cameraTarget) || v.cameraTarget.length < 3) return null
  const pos = v.cameraPosition.map(Number) as [number, number, number]
  const target = v.cameraTarget.map(Number) as [number, number, number]
  if (pos.some((n) => !Number.isFinite(n)) || target.some((n) => !Number.isFinite(n))) return null
  const fov = Number(v.fov)
  const transition = Number(v.transitionSeconds)
  return {
    id: typeof v.id === 'string' && v.id ? v.id : uid(),
    name: typeof v.name === 'string' && v.name.trim() ? v.name.trim() : 'View',
    cameraPosition: pos,
    cameraTarget: target,
    fov: Number.isFinite(fov) && fov > 0 ? fov : 55,
    transitionSeconds: Number.isFinite(transition) && transition > 0 ? transition : 1,
    builtIn,
    thumbnailDataUrl: typeof v.thumbnailDataUrl === 'string' ? v.thumbnailDataUrl : undefined,
  }
}

function loadUserViews(): CameraView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { views?: unknown[] }
    if (!Array.isArray(parsed.views)) return []
    return parsed.views
      .map((v) => normalizeView(v as Partial<CameraView>, false))
      .filter((v): v is CameraView => v != null)
  } catch {
    return []
  }
}

function saveUserViews(views: CameraView[]): void {
  const user = views.filter((v) => !v.builtIn).map((v) => ({
    id: v.id,
    name: v.name,
    cameraPosition: v.cameraPosition,
    cameraTarget: v.cameraTarget,
    fov: v.fov,
    transitionSeconds: v.transitionSeconds,
    thumbnailDataUrl: v.thumbnailDataUrl,
  }))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, views: user }))
  } catch (err) {
    console.warn('[CameraViews] Failed to persist views', err)
  }
}

/** Default orbit framings derived from the loaded building bounds. */
export function buildDefaultCameraViews(bounds: SceneBounds, fov = 55): CameraView[] {
  const c = bounds.center
  const r = Math.max(bounds.radius, 1)
  const dist = r * 1.85
  const elev = Math.max(r * 0.35, 4)
  const target: [number, number, number] = [c.x, c.y + r * 0.05, c.z]

  const mk = (
    id: string,
    name: string,
    dir: [number, number, number],
    distance = dist,
    yExtra = 0,
  ): CameraView => {
    const d = new Vector3(...dir).normalize()
    const pos = c.clone().addScaledVector(d, distance)
    pos.y = c.y + elev + yExtra
    return {
      id: `builtin-${id}`,
      name,
      cameraPosition: [pos.x, pos.y, pos.z],
      cameraTarget: [...target],
      fov,
      transitionSeconds: 1,
      builtIn: true,
    }
  }

  return [
    mk('overview', 'Overview', [0.65, 0.42, 0.85]),
    mk('front', 'Front', [0, 0.25, 1], dist * 1.05),
    mk('side-l', 'Side L', [-1, 0.22, 0.15], dist * 1.05),
    mk('side-r', 'Side R', [1, 0.22, 0.15], dist * 1.05),
    mk('aerial', 'Aerial', [0.15, 1, 0.2], dist * 0.95, elev * 0.6),
  ]
}

/** Parse a shipped / exported camera-views JSON into built-in views. */
export function parseCameraViewsExport(data: unknown): CameraView[] {
  if (!data || typeof data !== 'object') return []
  const views = (data as { views?: unknown[] }).views
  if (!Array.isArray(views)) return []
  return views
    .map((v) => normalizeView(v as Partial<CameraView>, true))
    .filter((v): v is CameraView => v != null)
    .map((v) => ({ ...v, builtIn: true }))
}

export async function fetchShippedCameraViews(
  url = CAMERA_VIEWS_DEFAULTS_URL,
): Promise<CameraView[] | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) return null
    const data = await res.json()
    const views = parseCameraViewsExport(data)
    return views.length ? views : null
  } catch {
    return null
  }
}

export type CameraViewListItem = Pick<
  CameraView,
  'id' | 'name' | 'builtIn' | 'thumbnailDataUrl'
>

/**
 * Named camera bookmarks (automotive-studio “Shots / Views” equivalent).
 * Built-ins come from shipped JSON or scene bounds; user views persist in localStorage.
 */
export class CameraViewsManager {
  private builtIns: CameraView[] = []
  private userViews: CameraView[] = loadUserViews()
  private activeId: string | null = null
  private shippedDefaults = false

  setBuiltIns(views: CameraView[], opts?: { shipped?: boolean }): void {
    const prevThumbs = new Map(
      this.builtIns
        .filter((v) => v.thumbnailDataUrl)
        .map((v) => [v.id, v.thumbnailDataUrl!] as const),
    )
    this.builtIns = views.map((v) => ({
      ...v,
      builtIn: true,
      thumbnailDataUrl: v.thumbnailDataUrl ?? prevThumbs.get(v.id),
    }))
    this.shippedDefaults = opts?.shipped === true
  }

  hasShippedDefaults(): boolean {
    return this.shippedDefaults
  }

  list(): CameraView[] {
    return [...this.builtIns, ...this.userViews]
  }

  listForUi(): CameraViewListItem[] {
    return this.list().map((v) => ({
      id: v.id,
      name: v.name,
      builtIn: v.builtIn,
      thumbnailDataUrl: v.thumbnailDataUrl,
    }))
  }

  get(id: string): CameraView | undefined {
    return this.list().find((v) => v.id === id)
  }

  getActiveId(): string | null {
    return this.activeId
  }

  setActiveId(id: string | null): void {
    this.activeId = id
  }

  setThumbnail(id: string, thumbnailDataUrl: string): boolean {
    const builtIn = this.builtIns.find((v) => v.id === id)
    if (builtIn) {
      builtIn.thumbnailDataUrl = thumbnailDataUrl
      return true
    }
    const user = this.userViews.find((v) => v.id === id)
    if (user) {
      user.thumbnailDataUrl = thumbnailDataUrl
      saveUserViews(this.list())
      return true
    }
    return false
  }

  viewsMissingThumbnails(): CameraView[] {
    return this.list().filter((v) => !v.thumbnailDataUrl)
  }

  capture(input: {
    name?: string
    cameraPosition: [number, number, number]
    cameraTarget: [number, number, number]
    fov: number
    thumbnailDataUrl?: string
    transitionSeconds?: number
  }): CameraView {
    const shot: CameraView = {
      id: uid(),
      name: input.name?.trim() || `View ${this.userViews.length + 1}`,
      cameraPosition: input.cameraPosition,
      cameraTarget: input.cameraTarget,
      fov: input.fov,
      transitionSeconds: input.transitionSeconds ?? 1,
      builtIn: false,
      thumbnailDataUrl: input.thumbnailDataUrl,
    }
    this.userViews = [...this.userViews, shot]
    saveUserViews(this.list())
    this.activeId = shot.id
    return shot
  }

  rename(id: string, name: string): boolean {
    const v = this.userViews.find((x) => x.id === id)
    if (!v) return false
    v.name = name.trim() || v.name
    saveUserViews(this.list())
    return true
  }

  remove(id: string): boolean {
    const before = this.userViews.length
    this.userViews = this.userViews.filter((v) => v.id !== id)
    if (this.userViews.length === before) return false
    if (this.activeId === id) this.activeId = null
    saveUserViews(this.list())
    return true
  }

  /**
   * Build an export payload. Prefer user captures; if none, include current built-ins.
   * Thumbnails are omitted so the JSON stays small enough to paste/share.
   */
  toExport(opts?: { includeBuiltIns?: boolean; onlyUser?: boolean }): CameraViewsExport {
    const onlyUser = opts?.onlyUser !== false
    const includeBuiltIns = opts?.includeBuiltIns === true || this.userViews.length === 0
    const source = onlyUser && this.userViews.length > 0
      ? this.userViews
      : includeBuiltIns
        ? this.list()
        : this.userViews

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      note:
        'Drop this file at public/models/camera-views.json (or send to an agent) to use as default Views.',
      views: source.map((v) => ({
        id: v.builtIn ? v.id : `builtin-${slugify(v.name)}`,
        name: v.name,
        cameraPosition: v.cameraPosition,
        cameraTarget: v.cameraTarget,
        fov: v.fov,
        transitionSeconds: v.transitionSeconds,
      })),
    }
  }
}

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return s || uid().slice(0, 8)
}

export { easeInOutCubic }

export function downloadCameraViewsJson(data: CameraViewsExport, filename = 'building-viewer-camera-views.json'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}
