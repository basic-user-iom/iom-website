export type VoicePreset = 'natural' | 'deep' | 'high' | 'robot' | 'ai'

export type AppearanceMode = 'real' | 'filters' | 'avatar'

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
  /** Called each animation frame with the live composite canvas (for preview). */
  onFrame?: (canvas: HTMLCanvasElement) => void
}
