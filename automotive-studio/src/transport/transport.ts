import {
  claimVehicleRoot,
  createDefaultOwnership,
  type OwnershipState,
} from './ownership'

export type TransportListener = (snapshot: TransportSnapshot) => void

export interface TransportSnapshot {
  playing: boolean
  timeSeconds: number
  durationSeconds: number
  speed: number
  loop: boolean
  ownership: OwnershipState
}

/**
 * Single authoritative time source for route, actions, shots, environment, hotspots.
 */
export class Transport {
  private playing = false
  private timeSeconds = 0
  private durationSeconds = 0
  private speed = 1
  private loop = false
  private autoAdvance = true
  private ownership = createDefaultOwnership()
  private listeners = new Set<TransportListener>()
  private lastNow: number | null = null
  private raf = 0

  getSnapshot(): TransportSnapshot {
    return {
      playing: this.playing,
      timeSeconds: this.timeSeconds,
      durationSeconds: this.durationSeconds,
      speed: this.speed,
      loop: this.loop,
      ownership: { ...this.ownership },
    }
  }

  subscribe(listener: TransportListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    const snap = this.getSnapshot()
    for (const listener of this.listeners) listener(snap)
  }

  setDuration(seconds: number) {
    this.durationSeconds = Math.max(0, seconds)
    if (this.timeSeconds > this.durationSeconds) this.timeSeconds = this.durationSeconds
    this.emit()
  }

  setLoop(loop: boolean) {
    this.loop = loop
    this.emit()
  }

  setSpeed(speed: number) {
    this.speed = Number.isFinite(speed) ? speed : 1
    this.emit()
  }

  /**
   * When false, `play()` still sets the playing flag for UI, but time does not advance
   * on its own — an external driver (route physics) pushes `seek` each frame.
   */
  setAutoAdvance(enabled: boolean) {
    this.autoAdvance = enabled
    this.lastNow = null
  }

  isAutoAdvance() {
    return this.autoAdvance
  }

  play() {
    if (this.playing) return
    this.playing = true
    this.lastNow = null
    this.tick()
    this.emit()
  }

  pause() {
    this.playing = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.lastNow = null
    this.emit()
  }

  stop() {
    this.pause()
    this.timeSeconds = 0
    this.emit()
  }

  seek(seconds: number) {
    const t = Math.max(0, seconds)
    this.timeSeconds =
      this.durationSeconds > 0 ? Math.min(t, this.durationSeconds) : t
    this.emit()
  }

  /** Pause transport when entering gizmo / route / hotspot edit. */
  beginEditSession() {
    this.pause()
    this.ownership = claimVehicleRoot(this.ownership, 'gizmo-edit').state
    this.emit()
  }

  endEditSession() {
    this.ownership = claimVehicleRoot(this.ownership, 'none').state
    this.emit()
  }

  setOwnership(patch: Partial<OwnershipState>) {
    this.ownership = { ...this.ownership, ...patch }
    this.emit()
  }

  private tick = () => {
    if (!this.playing) return
    const now = performance.now()
    if (this.autoAdvance && this.lastNow != null) {
      const dt = ((now - this.lastNow) / 1000) * this.speed
      let next = this.timeSeconds + dt
      if (this.durationSeconds > 0) {
        if (next >= this.durationSeconds) {
          if (this.loop) next = next % this.durationSeconds
          else {
            next = this.durationSeconds
            this.playing = false
          }
        }
      }
      this.timeSeconds = next
      this.emit()
    }
    this.lastNow = now
    if (this.playing) this.raf = requestAnimationFrame(this.tick)
  }

  dispose() {
    this.pause()
    this.listeners.clear()
  }
}
