import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three'
import type { AnimationTransportState } from './types'

export type ModelAnimationBindOptions = {
  autoPlay?: boolean
  loop?: boolean
  label?: string
}

/**
 * Plays embedded building/model GLB animations with transport controls
 * (play / pause / stop / scrub to a time).
 */
export class ModelAnimationPlayer {
  private mixer: AnimationMixer | null = null
  private actions: AnimationAction[] = []
  private playing = false
  private duration = 0
  private label = 'Animation'
  private loop = false
  private readonly onFinished = (): void => {
    if (this.loop) return
    this.playing = false
    for (const action of this.actions) {
      action.paused = true
      action.time = this.duration
    }
  }

  bind(root: Object3D, clips: AnimationClip[], options: ModelAnimationBindOptions = {}): void {
    this.dispose()
    if (!clips.length) return

    this.loop = options.loop === true
    this.label = options.label || clips[0]?.name || 'Animation'
    this.duration = Math.max(...clips.map((c) => c.duration), 0)
    this.mixer = new AnimationMixer(root)
    this.mixer.addEventListener('finished', this.onFinished)
    this.actions = clips.map((clip) => {
      const action = this.mixer!.clipAction(clip)
      action.setLoop(this.loop ? LoopRepeat : LoopOnce, Infinity)
      action.clampWhenFinished = true
      action.enabled = true
      action.weight = 1
      return action
    })

    if (options.autoPlay === true) this.play()
    else {
      this.seek(0)
      this.pause()
    }
  }

  play(): void {
    if (!this.actions.length || !this.mixer) return
    // Restart when already at the end (stop-on-end UX).
    if (!this.loop && this.getTime() >= this.duration - 1e-3) {
      this.applyTime(0)
    }
    for (const action of this.actions) {
      action.enabled = true
      action.paused = false
      action.play()
    }
    this.playing = true
    // Evaluate current pose immediately (important after scrub).
    this.mixer.update(0)
  }

  pause(): void {
    for (const action of this.actions) action.paused = true
    this.playing = false
  }

  /** Stop and jump to t=0 (held). */
  stop(): void {
    this.playing = false
    this.applyTime(0)
    for (const action of this.actions) action.paused = true
  }

  /** Scrub to an absolute time in seconds (clamped). Works while paused or playing. */
  seek(timeSeconds: number): void {
    if (!this.mixer || !this.actions.length) return
    const t = Math.max(0, Math.min(this.duration, timeSeconds))
    this.applyTime(t)
    if (!this.playing) {
      for (const action of this.actions) action.paused = true
    }
  }

  /** Seek by normalized 0–1 progress. */
  seekNormalized(u: number): void {
    const x = Number.isFinite(u) ? Math.max(0, Math.min(1, u)) : 0
    this.seek(x * this.duration)
  }

  setLoop(loop: boolean): void {
    this.loop = loop
    for (const action of this.actions) {
      action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity)
      action.clampWhenFinished = true
    }
  }

  getTime(): number {
    if (!this.actions[0]) return 0
    // Prefer mixer clock when playing; action.time can wrap oddly across clips.
    if (this.mixer && this.playing) {
      return Math.min(this.duration, Math.max(0, this.actions[0].time))
    }
    return Math.min(this.duration, Math.max(0, this.actions[0].time))
  }

  getDuration(): number {
    return this.duration
  }

  isPlaying(): boolean {
    return this.playing
  }

  isAvailable(): boolean {
    return this.actions.length > 0
  }

  clipCount(): number {
    return this.actions.length
  }

  getState(): AnimationTransportState {
    return {
      available: this.isAvailable(),
      playing: this.playing,
      time: this.getTime(),
      duration: this.duration,
      label: this.label,
    }
  }

  update(dt: number): void {
    if (!this.mixer || !this.playing) return
    this.mixer.update(dt)

    if (!this.loop && this.duration > 0) {
      const t = this.actions[0]?.time ?? 0
      if (t >= this.duration - 1e-4) {
        this.playing = false
        for (const action of this.actions) {
          action.time = this.duration
          action.paused = true
        }
      }
    }
  }

  dispose(): void {
    if (this.mixer) {
      this.mixer.removeEventListener('finished', this.onFinished)
      this.mixer.stopAllAction()
      this.mixer = null
    }
    this.actions = []
    this.playing = false
    this.duration = 0
  }

  /**
   * Force every clip to an absolute time and evaluate the pose.
   * Avoid mixer.setTime() — it zeros actions then advances, which desyncs scrubbing.
   */
  private applyTime(t: number): void {
    if (!this.mixer) return
    for (const action of this.actions) {
      const clipDur = action.getClip().duration
      const localT = this.loop ? t % Math.max(clipDur, 1e-6) : Math.min(t, clipDur)
      action.enabled = true
      action.paused = false
      action.setEffectiveWeight(1)
      // reset() clears finished flag so LoopOnce clips accept mid-timeline seeks.
      action.reset()
      action.time = localT
      action.play()
    }
    this.mixer.update(0)
  }
}
