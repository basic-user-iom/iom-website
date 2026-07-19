export type VoicePreset = 'natural' | 'deep' | 'high' | 'robot' | 'ai'

export type AppearanceMode = 'real' | 'filters' | 'avatar' | 'static'

export type SaveDestination = 'local' | 'online'

export type RecorderStatus =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'uploading'

export interface LocalRecording {
  id: string
  title: string
  blob: Blob
  mimeType: string
  durationMs: number
  createdAt: string
  objectUrl: string
}

export interface CaptureOptions {
  mic: boolean
  camera: boolean
  voice: VoicePreset
  appearance: AppearanceMode
  /** Data URL or https URL for Appearance → Static image PiP. */
  staticAvatarUrl?: string | null
  /** Browser DSP noise suppression on the mic track (default true). */
  noiseSuppression?: boolean
  /** Called each animation frame with the live composite canvas (for preview). */
  onFrame?: (canvas: HTMLCanvasElement) => void
  /** Live blur boxes (normalized). Read each frame so UI can update mid-recording. */
  getBlurRegions?: () => import('./blurRegions').BlurRegion[]
  getBlurStrength?: () => import('./blurRegions').BlurStrength
  /** Fired when the user stops screen share from the browser chrome. */
  onDisplayEnded?: () => void
}
