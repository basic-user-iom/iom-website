import {
  clampHandDeg,
  DEFAULT_HAND_CALIBRATION,
  restoreHandDegSign,
  type HandCalibration,
} from './cetWatchHands'
import type { PbrMapUrls } from './pbrTextures'
import { HOTSPOTS, PRODUCT } from './productConfig'

export { DEFAULT_HAND_CALIBRATION }

type Vec3 = [number, number, number]

export const LOOK_STORAGE_KEY = 'iom-precision-object-look-v21'
const LOOK_STORAGE_PREV = 'iom-precision-object-look-v20'
const LOOK_STORAGE_LEGACY = [
  'iom-precision-object-look-v1',
  'iom-precision-object-look-v2',
  'iom-precision-object-look-v3',
  'iom-precision-object-look-v4',
  'iom-precision-object-look-v5',
  'iom-precision-object-look-v6',
  'iom-precision-object-look-v7',
  'iom-precision-object-look-v8',
  'iom-precision-object-look-v9',
  'iom-precision-object-look-v10',
  'iom-precision-object-look-v11',
  'iom-precision-object-look-v12',
  'iom-precision-object-look-v13',
  'iom-precision-object-look-v14',
  'iom-precision-object-look-v15',
  'iom-precision-object-look-v17',
  'iom-precision-object-look-v18',
  'iom-precision-object-look-v19',
  LOOK_STORAGE_PREV,
]

export type HandLook = HandCalibration

export type TextureSetId = 'none' | 'metal049a' | 'gold' | 'custom'

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
  /** Plate brightness scale. 1 = tint as-picked. Only used on `black`. */
  lightness?: number
  transmission?: number
  ior?: number
}

export const MATERIAL_LIGHTNESS_MIN = 0
export const MATERIAL_LIGHTNESS_MAX = 2
export const DEFAULT_MATERIAL_LIGHTNESS = 1

export function clampMaterialLightness(value: unknown, fallback = DEFAULT_MATERIAL_LIGHTNESS): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(MATERIAL_LIGHTNESS_MAX, Math.max(MATERIAL_LIGHTNESS_MIN, n))
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
  /** Assigned inspect camera. Opening the hotspot flies here when present. */
  camera?: CameraLook
  /** If true, auto-rotate starts when this hotspot is opened. Close always stops it. */
  autoRotate?: boolean
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

export type ModelLook = {
  position: Vec3
  rotation: Vec3
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
  dial: TextureTargetLook
  sun: { yaw: number; pitch: number }
  shadows: ShadowLook
  lights: AccentLightLook
  materials: MaterialLook[]
  hotspots: HotspotLook[]
  notes: string
  /** Startup / landing camera. Named chips use `views` instead. */
  camera?: CameraLook
  /** Camera for the second 100vh scroll screen (#viewer). Optional — falls back to initial. */
  scrollCamera?: CameraLook
  views?: NamedViews
  /** Watch wrapper pose (normalized modelRoot). Missing = baked GLB / normalize pose. */
  model?: ModelLook
  /** Analog 12 o'clock + per-hand offsets in degrees. Missing = current code defaults. */
  hands?: HandLook
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

/** First view: saved `camera`, else assigned Hero. Used on load and after Explore. */
export function resolveInitialCamera(look: Pick<SavedLook, 'camera' | 'views'>): CameraLook | undefined {
  return parseCameraLook(look.camera) ?? parseCameraLook(look.views?.hero)
}

/** Compact block to paste in chat so DEFAULT_LOOK.camera can be baked. */
export function formatInitialCameraJson(camera: CameraLook): string {
  return JSON.stringify(
    {
      'precision-object': 'initial-camera',
      bakeInto: 'DEFAULT_LOOK.camera',
      camera: roundCameraLook(camera),
    },
    null,
    2,
  )
}

/** Compact block to paste in chat so DEFAULT_LOOK.scrollCamera can be baked. */
export function formatScrollCameraJson(camera: CameraLook): string {
  return JSON.stringify(
    {
      'precision-object': 'scroll-down-camera',
      bakeInto: 'DEFAULT_LOOK.scrollCamera',
      camera: roundCameraLook(camera),
    },
    null,
    2,
  )
}

/** Compact block to paste in chat so a hotspot `camera` can be baked. */
export function formatHotspotCameraJson(id: string, camera: CameraLook): string {
  return JSON.stringify(
    {
      'precision-object': 'hotspot-camera',
      bakeInto: `DEFAULT_LOOK.hotspots[].camera (${id})`,
      hotspotId: id,
      camera: roundCameraLook(camera),
    },
    null,
    2,
  )
}

export function mergeHotspotLooks(base: HotspotLook[], parsed?: HotspotLook[]): HotspotLook[] {
  return base.map((item) => {
    const extra = parsed?.find((entry) => entry.id === item.id)
    if (!extra) return item
    return {
      ...item,
      ...extra,
      position: isVec3(extra.position) ? extra.position : item.position,
      camera: parseCameraLook(extra.camera) ?? item.camera,
      autoRotate: typeof extra.autoRotate === 'boolean' ? extra.autoRotate : item.autoRotate,
    }
  })
}

export function parseHandsLook(value: unknown): HandLook | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Partial<HandLook>
  const d = DEFAULT_HAND_CALIBRATION
  return {
    twelveXDeg: restoreHandDegSign(Number(raw.twelveXDeg), d.twelveXDeg),
    hourOffsetDeg: clampHandDeg(Number(raw.hourOffsetDeg), d.hourOffsetDeg),
    minuteOffsetDeg: clampHandDeg(Number(raw.minuteOffsetDeg), d.minuteOffsetDeg),
    secondOffsetDeg: clampHandDeg(Number(raw.secondOffsetDeg), d.secondOffsetDeg),
  }
}

export function roundHandsLook(hands: HandLook): HandLook {
  const r = (n: number) => Math.round(n * 100) / 100
  return {
    twelveXDeg: r(hands.twelveXDeg),
    hourOffsetDeg: r(hands.hourOffsetDeg),
    minuteOffsetDeg: r(hands.minuteOffsetDeg),
    secondOffsetDeg: r(hands.secondOffsetDeg),
  }
}

/** Compact block to paste in chat so DEFAULT_LOOK.hands can be baked. */
export function formatHandsCalibrationJson(hands: HandLook): string {
  return JSON.stringify(
    {
      'precision-object': 'hand-calibration',
      bakeInto: 'DEFAULT_LOOK.hands',
      hands: roundHandsLook(hands),
    },
    null,
    2,
  )
}

export function parseModelLook(value: unknown): ModelLook | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as { position?: unknown; rotation?: unknown }
  if (!isVec3(raw.position) || !isVec3(raw.rotation)) return undefined
  return {
    position: [raw.position[0], raw.position[1], raw.position[2]],
    rotation: [raw.rotation[0], raw.rotation[1], raw.rotation[2]],
  }
}

export function roundModelLook(model: ModelLook): ModelLook {
  const r = (n: number) => Math.round(n * 1000) / 1000
  return {
    position: [r(model.position[0]), r(model.position[1]), r(model.position[2])],
    rotation: [r(model.rotation[0]), r(model.rotation[1]), r(model.rotation[2])],
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
  { id: 'gold', label: 'Gold (Metal 048A)', urls: PRODUCT.goldPbrMaps },
  { id: 'custom', label: 'Custom maps' },
]

/** Stand keeps Metal049A OpenGL normals. Watch metal049a swaps in Metal060A (DX). */
export function textureSetUrls(setId: TextureSetId, target: 'stand' | 'watch' | 'dial'): PbrMapUrls | undefined {
  if (setId === 'gold') return PRODUCT.goldPbrMaps
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
  savedAt: '2026-08-20T00:14:51.281Z',
  stand: {
    enabled: true,
    setId: 'metal049a',
    customFiles: null,
    repeat: 2.25,
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
  dial: {
    enabled: true,
    setId: 'gold',
    customFiles: null,
    repeat: 1.05,
    normalScale: 0.85,
    displacementScale: 0,
    useAlbedo: true,
  },
  hdrId: 'evening027',
  sun: {
    yaw: 5.88,
    pitch: 0,
  },
  shadows: {
    enabled: true,
    contact: false,
    intensity: 0.92,
    softness: 0.56,
  },
  lights: {
    enabled: true,
    fill: 1.5,
    rim: 1.5,
    accent: {
      enabled: true,
      intensity: 1.8,
      yaw: 5.51,
      pitch: -0.52,
    },
  },
  materials: [
    { id: 'metal', label: 'Metal', metalness: 1, roughness: 0, envMapIntensity: 3, color: '#cdcdcd' },
    { id: 'metalDark', label: 'Dark metal', metalness: 1, roughness: 0.14, envMapIntensity: 3, color: '#c1a571' },
    { id: 'metalRough', label: 'Rough metal', metalness: 1, roughness: 0.15, envMapIntensity: 3, color: '#ffffff' },
    { id: 'dial', label: 'Dial', metalness: 1, roughness: 0.85, envMapIntensity: 3, color: '#c1a571' },
    { id: 'black', label: 'Black', metalness: 1, roughness: 0.15, envMapIntensity: 1.62, color: '#c1a571', lightness: 1 },
    { id: 'glass', label: 'Glass', metalness: 0, roughness: 0, envMapIntensity: 3, color: '#8f8f8f', transmission: 0.94, ior: 1 },
  ],
  hotspots: [
    {
      id: 'surface',
      position: [-0.501, 0.281, 0.734],
      camera: {
        position: [-0.463, 0.618, 1.546],
        target: [-0.068, 0.433, -0.019],
        fov: 30,
      },
    },
    {
      id: 'mechanical',
      position: [-0.824, -0.017, 0.57],
      camera: {
        position: [-0.49, 0.492, 1.393],
        target: [-0.068, 0.433, -0.019],
        fov: 30,
      },
    },
    {
      id: 'interface',
      position: [-0.894, -0.325, 0.381],
      camera: {
        position: [0.375, 0.852, 1.035],
        target: [-0.247, 0.517, 0.28],
        fov: 32,
      },
    },
    { id: 'geometry', position: [-0.009, -0.188, 0.927] },
  ],
  notes: 'Watch metal normal: Metal060A DirectX (normalScale.y flip). Dial: Metal048A gold PBR. Stand stays Metal049A.',
  camera: {
    position: [-0.49, 0.492, 1.393],
    target: [-0.068, 0.433, -0.019],
    fov: 30,
  },
  scrollCamera: {
    position: [-1.968, 0.594, 2.134],
    target: [0.208, 0.456, -0.2],
    fov: 30,
  },
  views: {
    front: {
      position: [-1.134, 0.619, 1.996],
      target: [0, 0.527, 0],
      fov: 32,
    },
    detail: {
      position: [-0.966, 0.598, 0.552],
      target: [0.226, 0.547, 0.094],
      fov: 30,
    },
    top: {
      position: [-3.651, 3.1, 1.385],
      target: [0.226, 0.547, 0.094],
      fov: 30,
    },
    hero: {
      position: [-1.867, 0.619, 2.231],
      target: [-0.028, 0.428, -0.373],
      fov: 30,
    },
  },
  hands: {
    twelveXDeg: 0,
    hourOffsetDeg: 0,
    minuteOffsetDeg: 0,
    secondOffsetDeg: 0,
  },
  model: {
    position: [-0.173, 0.493, 0.364],
    // 180° about the dial face-normal (hour-bone local X), Euler XYZ.
    // Not yaw (case back) and not a principal local-Z roll onto the floor.
    rotation: [0.078, -1.028, -3.097],
  },
}

function cloneLook(look: SavedLook): SavedLook {
  return JSON.parse(JSON.stringify(look)) as SavedLook
}

/** Keep a stored black plate; fill missing lightness from bake (default 1). */
export function mergeBlackLightness(materials: MaterialLook[], fallback = DEFAULT_MATERIAL_LIGHTNESS): MaterialLook[] {
  return materials.map((item) =>
    item.id === 'black' ? { ...item, lightness: clampMaterialLightness(item.lightness, fallback) } : item,
  )
}

export function defaultLook(): SavedLook {
  const look = cloneLook(DEFAULT_LOOK)
  look.hotspots = HOTSPOTS.map((h) => {
    const saved = look.hotspots.find((item) => item.id === h.id)
    return {
      id: h.id,
      position: (saved?.position ?? [...h.position]) as Vec3,
      cameraTarget: h.cameraTarget ? ([...h.cameraTarget] as Vec3) : undefined,
      camera: parseCameraLook(saved?.camera),
      autoRotate: saved?.autoRotate,
    }
  })
  look.camera = parseCameraLook(look.camera)
  look.scrollCamera = parseCameraLook(look.scrollCamera)
  look.views = parseNamedViews(look.views)
  look.model = parseModelLook(look.model)
  look.hands = parseHandsLook(look.hands) ?? { ...DEFAULT_HAND_CALIBRATION }
  look.materials = mergeBlackLightness(look.materials)
  return look
}

export function loadStoredLook(): SavedLook | null {
  try {
    const fromCurrent = Boolean(localStorage.getItem(LOOK_STORAGE_KEY))
    const raw = localStorage.getItem(LOOK_STORAGE_KEY) ?? localStorage.getItem(LOOK_STORAGE_PREV)
    for (const key of LOOK_STORAGE_LEGACY) localStorage.removeItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedLook
    if (parsed?.version !== 1) return null
    const base = defaultLook()
    const parsedHdr = (parsed as SavedLook).hdrId
    const merged: SavedLook = {
      ...base,
      ...parsed,
      stand: { ...base.stand, ...parsed.stand },
      watch: { ...base.watch, ...parsed.watch },
      dial: { ...base.dial, ...parsed.dial },
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
      camera: fromCurrent
        ? parseCameraLook((parsed as SavedLook).camera) ?? base.camera
        : base.camera,
      scrollCamera: fromCurrent
        ? parseCameraLook((parsed as SavedLook).scrollCamera) ?? base.scrollCamera
        : base.scrollCamera,
      views: mergeNamedViews(parseNamedViews(base.views), parseNamedViews((parsed as SavedLook).views)),
      model: fromCurrent
        ? parseModelLook((parsed as SavedLook).model) ?? parseModelLook(base.model)
        : parseModelLook(base.model),
      hotspots: mergeHotspotLooks(base.hotspots, (parsed as SavedLook).hotspots),
      hands: fromCurrent
        ? parseHandsLook((parsed as SavedLook).hands) ?? base.hands
        : base.hands,
    }
    merged.materials = mergeBlackLightness(
      merged.materials?.length ? merged.materials : base.materials,
      base.materials.find((item) => item.id === 'black')?.lightness ?? DEFAULT_MATERIAL_LIGHTNESS,
    )
    if (!localStorage.getItem(LOOK_STORAGE_KEY)) persistLook(merged)
    return merged
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
  dial?: Partial<PbrMapUrls>
} = {}

export function materialGroupId(matName: string): string | null {
  const n = matName.toLowerCase()
  return MATERIAL_GROUPS.find((g) => g.match(n))?.id ?? null
}
