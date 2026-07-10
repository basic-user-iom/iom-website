export type MusicPlayerVisualizerBands = {
  bass: number
  mids: number
  highs: number
  phase: number
}

/** Shared surface API for raymarch and WebGPU raging-sea visualizers. */
export interface MusicPlayerVisualizerLike {
  mount(container: HTMLElement): void | Promise<void>
  resize(width: number, height: number): void
  update(delta: number, time: number, isPlaying: boolean, analyser: AnalyserNode | null): void
  pause(): void
  resume(): void
  isPaused(): boolean
  setFullscreenMode(enabled: boolean): void
  setPointer(normalizedX: number, normalizedY: number): void
  resetPointer(): void
  setDeviceOrientation(beta: number | null, gamma: number | null): void
  clearDeviceOrientation(): void
  getBandLevels(): MusicPlayerVisualizerBands
  dispose(): void
}
