export type Vec3 = [number, number, number]

export type LightingPresetId = 'studio' | 'detail'

/** Product default Light chip — Detail, not Studio. */
export const DEFAULT_LIGHTING_PRESET: LightingPresetId = 'detail'

export type CameraPresetId = 'hero' | 'front' | 'detail' | 'top'

export type CameraPreset = {
  id: CameraPresetId
  /** Direction from the look target toward the camera, in world space. */
  direction: Vec3
  /** Offset from the model center, as a fraction of the bounding-box size. */
  targetOffset: Vec3
  /** Distance as a multiple of the computed framing distance. */
  distanceMul: number
  fov: number
}

export type Hotspot = {
  id: string
  label: string
  title: string
  body: string
  /**
   * Offset from the model center, as a fraction of the bounding-box size
   * on each axis. `[0, 0, 0]` is the center; `[1, 0, 0]` is the +X face.
   */
  position: Vec3
  cameraTarget?: Vec3
  cameraPreset?: CameraPresetId
}

export type StoryItem = {
  id: string
  title: string
  body: string
  actionLabel: string
  cameraPreset: CameraPresetId
  hotspotId?: string
}

export type ScreenHotspot = {
  id: string
  x: number
  y: number
  visible: boolean
}

export type ModelCapabilities = {
  loaded: boolean
  hasMotion: boolean
  motionClipName: string | null
  hasExploded: boolean
  animations: string[]
  materials: string[]
  meshes: string[]
  size: Vec3
}

export type ViewerApi = {
  setAutoRotate: (value: boolean) => void
  /** Pause idle auto-rotate; resumes after duration if still wanted. Default 4s. */
  pauseAutoRotate: (durationMs?: number) => void
  setLighting: (preset: LightingPresetId) => void
  setMotion: (value: boolean) => void
  /** Calibration freeze: stop live ticking and zone-sweep without changing Motion. */
  setHandsFrozen: (value: boolean) => void
  /** IANA zone or `local`. Updates analog hands immediately. */
  setTimeZone: (timeZone: string) => void
  setPbr: (value: boolean) => void
  setLook: (look: import('./lookStudio').SavedLook) => void
  captureCamera: () => import('./lookStudio').CameraLook | null
  captureModel: () => import('./lookStudio').ModelLook | null
  setGizmoVisible: (value: boolean) => void
  setGizmoMode: (mode: 'translate' | 'rotate') => void
  setPlaceHotspots: (value: boolean) => void
  setPlaceHotspotId: (id: string | null) => void
  setExploded: (value: boolean) => void
  setHeroBias: (value: boolean) => void
  setActive: (value: boolean) => void
  /** Orbit, pan, zoom, inspect, and gizmos. Off until Explore the object. */
  setInteractionEnabled: (value: boolean) => void
  /** Ctrl+drag / Ctrl+WASD pan. Off for a presentation session; not stored in look JSON. */
  setCameraPan: (value: boolean) => void
  resetCamera: () => void
  goToInitialCamera: () => void
  goToScrollCamera: () => void
  restoreCameraForScroll: (inHero: boolean) => void
  goToPreset: (id: CameraPresetId) => void
  focusHotspot: (id: string) => void
  enterFullscreen: () => Promise<void>
  exitFullscreen: () => Promise<void>
}

export type LoadState =
  | { status: 'loading'; progress: number }
  | { status: 'ready' }
  | { status: 'error'; message: string }
