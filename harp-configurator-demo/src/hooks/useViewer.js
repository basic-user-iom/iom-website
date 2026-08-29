import { create } from 'zustand'

const CAMERA_STORAGE_KEY = 'harp-configurator-camera-overrides-v2'

function readStoredCameras() {
  try {
    const raw = localStorage.getItem(CAMERA_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export const useViewer = create((set, get) => ({
  ready: false,
  progress: 0,
  loadError: null,
  introDone: false,
  view: 'hero',
  hotspot: null,
  reducedMotion: false,
  analysis: null,
  rig: null,
  cameraEdit: false,
  cameraOverrides: readStoredCameras(),
  setProgress: (progress) => set({ progress }),
  setReady: (ready) => set({ ready }),
  setLoadError: (loadError) => set({ loadError, ready: false }),
  setIntroDone: (introDone) => set({ introDone }),
  requestView: (view) => set({ view, hotspot: null }),
  openHotspot: (hotspot) => set({ hotspot, view: 'hotspot' }),
  closeHotspot: () => set({ hotspot: null, view: 'hero' }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setAnalysis: (analysis, rig) => set({ analysis, rig, ready: true }),
  setCameraEdit: (cameraEdit) => set({ cameraEdit }),
  setCameraOverride: (view, pose) => {
    const cameraOverrides = { ...get().cameraOverrides, [view]: pose }
    try {
      localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(cameraOverrides))
    } catch {
      /* ignore quota */
    }
    set({ cameraOverrides })
  },
  clearCameraOverride: (view) => {
    const cameraOverrides = { ...get().cameraOverrides }
    delete cameraOverrides[view]
    try {
      localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(cameraOverrides))
    } catch {
      /* ignore quota */
    }
    set({ cameraOverrides })
  },
  clearAllCameraOverrides: () => {
    try {
      localStorage.removeItem(CAMERA_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    set({ cameraOverrides: {} })
  },
}))
