import type { PbrMapUrls } from './pbrTextures'
import { HOTSPOTS, PRODUCT } from './productConfig'

type Vec3 = [number, number, number]

export const LOOK_STORAGE_KEY = 'iom-precision-object-look-v6'
const LOOK_STORAGE_LEGACY = [
  'iom-precision-object-look-v1',
  'iom-precision-object-look-v2',
  'iom-precision-object-look-v3',
  'iom-precision-object-look-v4',
  'iom-precision-object-look-v5',
]

export type TextureSetId = 'none' | 'metal049a' | 'custom'

export type TextureTargetLook = {
  enabled: boolean
  setId: TextureSetId
  customFiles: {
    color?: string
    roughness?: string
    metalness?: string
    normal?: string
    displacement?: string
  } | null
  repeat: number
  normalScale: number
  displacementScale: number
  useAlbedo: boolean
}

export type MaterialLook = {
  id: string
  label: string
  metalness: number
  roughness: number
  envMapIntensity: number
  color: string
  transmission?: number
  ior?: number
}

export type ShadowLook = {
  enabled: boolean
  contact: boolean
  intensity: number
  softness: number
}

export type AimableLightLook = {
  enabled: boolean
  intensity: number
  yaw: number
  pitch: number
}

export type AccentLightLook = {
  enabled: boolean
  fill: number
  rim: number
  accent: AimableLightLook
}

export type HotspotLook = {
  id: string
  position: Vec3
  cameraTarget?: Vec3
}

export type HdrId = 'evening022' | 'evening005' | 'day035' | 'evening027'

export const HDR_OPTIONS: { id: HdrId; label: string; url: string }[] = [
  {
    id: 'evening022',
    label: '1 · Evening 022 4K',
    url: '/env/EveningSkyHDRI022B_4K_HDR.exr',
  },
  {
    id: 'evening005',
    label: '2 · Evening 005 4K',
    url: '/env/EveningSkyHDRI005B_4K_HDR.exr',
  },
  {
    id: 'day035',
    label: '3 · Day 035 4K',
    url: '/env/DaySkyHDRI035A_4K_HDR.exr',
  },
  {
    id: 'evening027',
    label: '4 · Evening 027 2K',
    url: '/env/EveningSkyHDRI027B_2K_HDR.exr',
  },
]

export const DEFAULT_HDR_ID: HdrId = 'evening027'
export const FALLBACK_HDR_ID: HdrId = 'evening022'

/** Elevation only — wide enough to tilt the sun, too narrow to stand the sky on its side. */
export const SUN_PITCH_LIMIT = 0.35
/** Accent light elevation — enough to rake the crown or dip into the bracelet. */
export const ACCENT_PITCH_LIMIT = 0.85

export function clampSunPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) return 0
  return Math.min(SUN_PITCH_LIMIT, Math.max(-SUN_PITCH_LIMIT, pitch))
}

export function clampAccentPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) return 0
  return Math.min(ACCENT_PITCH_LIMIT, Math.max(-ACCENT_PITCH_LIMIT, pitch))
}

export function isHdrId(value: unknown): value is HdrId {
  return HDR_OPTIONS.some((option) => option.id === value)
}

export function hdrUrlFor(id: HdrId): string {
  return HDR_OPTIONS.find((option) => option.id === id)?.url ?? HDR_OPTIONS[0].url
}

export type CameraLook = {
  position: Vec3
  target: Vec3
  fov: number
}

/** Toolbar View chips. Reset restores Hero, or Front if Hero was never assigned. */
export type NamedViewId = 'hero' | 'front' | 'detail' | 'top'

export type NamedViews = Partial<Record<NamedViewId, CameraLook>>

export const NAMED_VIEW_IDS: NamedViewId[] = ['front', 'detail', 'top', 'hero']

export const NAMED_VIEW_LABELS: Record<NamedViewId, string> = {
  front: 'Front',
  detail: 'Detail',
  top: 'Top',
  hero: 'Hero',
}

export type SavedLook = {
  version: 1
  savedAt: string
  hdrId: HdrId
  stand: TextureTargetLook
  watch: TextureTargetLook
  sun: { yaw: number; pitch: number }
  shadows: ShadowLook
  lights: AccentLightLook
  materials: MaterialLook[]
  hotspots: HotspotLook[]
  notes: string
  /** Startup / landing camera. Named chips use `views` instead. */
  camera?: CameraLook
  views?: NamedViews
}

function isVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  )
}

export function parseCameraLook(value: unknown): CameraLook | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as { position?: unknown; target?: unknown; fov?: unknown }
  if (!isVec3(raw.position) || !isVec3(raw.target)) return undefined
  const fov = Number(raw.fov)
  if (!Number.isFinite(fov) || fov < 8 || fov > 90) return undefined
  return {
    position: [raw.position[0], raw.position[1], raw.position[2]],
    target: [raw.target[0], raw.target[1], raw.target[2]],
    fov,
  }
}

export function roundCameraLook(camera: CameraLook): CameraLook {
  const r = (n: number) => Math.round(n * 1000) / 1000
  return {
    position: [r(camera.position[0]), r(camera.position[1]), r(camera.position[2])],
    target: [r(camera.target[0]), r(camera.target[1]), r(camera.target[2])],
    fov: r(camera.fov),
  }
}

export function parseNamedViews(value: unknown): NamedViews | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const views: NamedViews = {}
  let any = false
  for (const id of NAMED_VIEW_IDS) {
    const cam = parseCameraLook(raw[id])
    if (!cam) continue
    views[id] = cam
    any = true
  }
  return any ? views : undefined
}

export function mergeNamedViews(...sources: Array<NamedViews | undefined>): NamedViews | undefined {
  const merged: NamedViews = {}
  for (const src of sources) {
    if (!src) continue
    for (const id of NAMED_VIEW_IDS) {
      const cam = src[id]
      if (cam) merged[id] = cam
    }
  }
  return Object.keys(merged).length ? merged : undefined
}

export const TEXTURE_SETS: { id: TextureSetId; label: string; urls?: PbrMapUrls }[] = [
  { id: 'none', label: 'None' },
  { id: 'metal049a', label: 'Metal 049A', urls: PRODUCT.pbrMaps },
  { id: 'custom', label: 'Custom maps' },
]

/** Stand keeps Metal049A OpenGL normals. Watch metal049a swaps in Metal060A (DX). */
export function textureSetUrls(setId: TextureSetId, target: 'stand' | 'watch'): PbrMapUrls | undefined {
  if (setId !== 'metal049a') return undefined
  return target === 'watch' ? PRODUCT.watchPbrMaps : PRODUCT.pbrMaps
}

export const MATERIAL_GROUPS: {
  id: string
  label: string
  glass?: boolean
  match: (matName: string) => boolean
}[] = [
  { id: 'metal', label: 'Metal', match: (n) => n === 'metal' || n === 'metal_not' },
  { id: 'metalDark', label: 'Dark metal', match: (n) => n.includes('metal_dark') || n.includes('metaldark') },
  { id: 'metalRough', label: 'Rough metal', match: (n) => n.includes('rough') },
  { id: 'dial', label: 'Dial', match: (n) => n.includes('white') },
  { id: 'black', label: 'Black', match: (n) => n.includes('black') && !n.includes('metal') },
  { id: 'glass', label: 'Glass', glass: true, match: (n) => n.includes('glass') },
]

/** Canonical startup look — Look studio hydrates from this unless the user Saves after this bake. */
export const DEFAULT_LOOK: SavedLook = {
  version: 1,
  savedAt: '2026-08-18T22:58:29.310Z',
  stand: {
    enabled: true,
    setId: 'metal049a',
    customFiles: null,
    repeat: 2.15,
    normalScale: 1.05,
    displacementScale: 0.02,
    useAlbedo: true,
  },
  watch: {
    enabled: true,
    setId: 'metal049a',
    customFiles: null,
    repeat: 3.4,
    normalScale: 2,
    displacementScale: 0,
    useAlbedo: true,
  },
  hdrId: 'evening027',
  sun: {
    yaw: 3.97,
    pitch: 0,
  },
  shadows: {
    enabled: true,
    contact: false,
    intensity: 0.94,
    softness: 0.54,
  },
  lights: {
    enabled: true,
    fill: 1.5,
    rim: 0,
    accent: {
      enabled: true,
      intensity: 1.8,
      yaw: 2.19,
      pitch: 0.06,
    },
  },
  materials: [
    { id: 'metal', label: 'Metal', metalness: 1, roughness: 0, envMapIntensity: 3, color: '#cdcdcd' },
    { id: 'metalDark', label: 'Dark metal', metalness: 0.79, roughness: 0.19, envMapIntensity: 3, color: '#717171' },
    { id: 'metalRough', label: 'Rough metal', metalness: 1, roughness: 0.33, envMapIntensity: 3, color: '#ffffff' },
    { id: 'dial', label: 'Dial', metalness: 0.08, roughness: 0.25, envMapIntensity: 2.6, color: '#e7e7e7' },
    { id: 'black', label: 'Black', metalness: 0.3, roughness: 0.0023765903573227947, envMapIntensity: 1.54, color: '#000000' },
    { id: 'glass', label: 'Glass', metalness: 0, roughness: 0, envMapIntensity: 3, color: '#8f8f8f', transmission: 0.94, ior: 1 },
  ],
  hotspots: [
    { id: 'surface', position: [-0.742, 0.445, 0.501] },
    { id: 'mechanical', position: [-0.414, -0.02, 0.763] },
    { id: 'interface', position: [-0.894, -0.325, 0.381] },
    { id: 'geometry', position: [-0.009, -0.188, 0.927] },
  ],
  notes: 'Watch metal normal: Metal060A DirectX (normalScale.y flip). Stand stays Metal049A.',
}

function cloneLook(look: SavedLook): SavedLook {
  return JSON.parse(JSON.stringify(look)) as SavedLook
}

export function defaultLook(): SavedLook {
  const look = cloneLook(DEFAULT_LOOK)
  look.hotspots = HOTSPOTS.map((h) => {
    const saved = look.hotspots.find((item) => item.id === h.id)
    return {
      id: h.id,
      position: (saved?.position ?? [...h.position]) as Vec3,
      cameraTarget: h.cameraTarget ? ([...h.cameraTarget] as Vec3) : undefined,
    }
  })
  return look
}

export function loadStoredLook(): SavedLook | null {
  try {
    for (const key of LOOK_STORAGE_LEGACY) localStorage.removeItem(key)
    const raw = localStorage.getItem(LOOK_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedLook
    if (parsed?.version !== 1) return null
    const base = defaultLook()
    const parsedHdr = (parsed as SavedLook).hdrId
    return {
      ...base,
      ...parsed,
      stand: { ...base.stand, ...parsed.stand },
      watch: { ...base.watch, ...parsed.watch },
      sun: {
        yaw: parsed.sun?.yaw ?? base.sun.yaw,
        pitch: clampSunPitch(parsed.sun?.pitch ?? base.sun.pitch),
      },
      shadows: { ...base.shadows, ...parsed.shadows },
      lights: {
        ...base.lights,
        ...parsed.lights,
        accent: {
          ...base.lights.accent,
          ...parsed.lights?.accent,
          pitch: clampAccentPitch(parsed.lights?.accent?.pitch ?? base.lights.accent.pitch),
        },
      },
      hdrId: isHdrId(parsedHdr) ? parsedHdr : base.hdrId,
      camera: parseCameraLook((parsed as SavedLook).camera) ?? base.camera,
      views: mergeNamedViews(parseNamedViews(base.views), parseNamedViews((parsed as SavedLook).views)),
    }
  } catch {
    return null
  }
}

export function persistLook(look: SavedLook): void {
  const next = { ...look, savedAt: new Date().toISOString() }
  localStorage.setItem(LOOK_STORAGE_KEY, JSON.stringify(next))
}

export function formatLookJson(look: SavedLook): string {
  const next = { ...look, savedAt: look.savedAt || new Date().toISOString() }
  return JSON.stringify(next, null, 2)
}

export function classifyTextureFiles(files: File[]): {
  urls: Partial<PbrMapUrls>
  names: NonNullable<TextureTargetLook['customFiles']>
} {
  const urls: Partial<PbrMapUrls> = {}
  const names: NonNullable<TextureTargetLook['customFiles']> = {}
  const take = (key: keyof PbrMapUrls, file: File) => {
    if (urls[key]) return
    urls[key] = URL.createObjectURL(file)
    names[key] = file.name
  }
  for (const file of files) {
    const n = file.name.toLowerCase()
    if (/normal.?dx|norm.?dx/.test(n)) continue
    if (/normal|nor|nrm/.test(n)) take('normal', file)
    else if (/rough/.test(n)) take('roughness', file)
    else if (/metal/.test(n)) take('metalness', file)
    else if (/disp|height/.test(n)) take('displacement', file)
    else if (/color|albedo|diff|base.?col/.test(n)) take('color', file)
  }
  return { urls, names }
}

export const customMapCache: {
  stand?: Partial<PbrMapUrls>
  watch?: Partial<PbrMapUrls>
} = {}

export function materialGroupId(matName: string): string | null {
  const n = matName.toLowerCase()
  return MATERIAL_GROUPS.find((g) => g.match(n))?.id ?? null
}
