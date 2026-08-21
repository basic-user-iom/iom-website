import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  Object3D,
} from 'three'

export type PlaybackMode = 'once' | 'repeat' | 'pingpong'

export type PlayRangeOpts = {
  /** Skip empty lead-in (seconds). */
  start?: number
  /** Stop / clamp here (seconds). Omit for full clip. */
  end?: number
}

export class AnimationController {
  private mixer: AnimationMixer | null = null
  private clips: AnimationClip[] = []
  private action: AnimationAction | null = null
  private root: Object3D | null = null
  private playing = false
  private speed = 1
  private mode: PlaybackMode = 'once'
  /** Forward play: stop when time reaches this. */
  private playEnd: number | null = null
  /** Reverse play: stop when time reaches this (door closed). */
  private playStartBound: number | null = null

  attach(root: Object3D, clips: AnimationClip[]) {
    this.dispose()
    this.root = root
    this.clips = clips.slice()
    this.mixer = new AnimationMixer(root)
  }

  listClips(): Array<{ name: string; duration: number; trackCount: number }> {
    return this.clips.map((c) => ({
      name: c.name || 'Animation',
      duration: c.duration,
      trackCount: c.tracks.length,
    }))
  }

  getClip(index: number): AnimationClip | null {
    return this.clips[index] ?? null
  }

  /**
   * @param direction +1 open/forward, -1 close/reverse from current or range end.
   * @param fromTime optional scrub point before playing (defaults to start or end by direction).
   */
  play(
    index = 0,
    mode: PlaybackMode = this.mode,
    range?: PlayRangeOpts,
    direction: 1 | -1 = 1,
    fromTime?: number,
  ) {
    if (!this.mixer || !this.clips[index]) return
    this.mode = mode
    this.action?.stop()
    const clip = this.clips[index]
    this.action = this.mixer.clipAction(clip)
    this.action.reset()
    this.action.setLoop(mode === 'once' ? LoopOnce : LoopRepeat, mode === 'once' ? 1 : Infinity)
    this.action.clampWhenFinished = mode === 'once'
    const duration = clip.duration
    const start = Math.max(0, Math.min(duration, range?.start ?? 0))
    const end =
      range?.end != null && Number.isFinite(range.end)
        ? Math.max(start, Math.min(duration, range.end))
        : duration

    if (direction < 0) {
      this.action.setEffectiveTimeScale(-Math.abs(this.speed))
      this.playStartBound = start
      this.playEnd = null
      const from =
        fromTime != null && Number.isFinite(fromTime)
          ? Math.max(start, Math.min(end, fromTime))
          : end
      this.action.play()
      this.action.time = from
    } else {
      this.action.setEffectiveTimeScale(Math.abs(this.speed))
      this.playStartBound = null
      this.playEnd = range?.end != null && Number.isFinite(range.end) ? end : null
      const from =
        fromTime != null && Number.isFinite(fromTime)
          ? Math.max(start, Math.min(end, fromTime))
          : start
      this.action.play()
      this.action.time = from
    }
    this.action.paused = false
    this.mixer.update(0)
    this.playing = true
  }

  pause() {
    if (!this.action) return
    this.action.paused = true
    this.playing = false
  }

  resume() {
    if (!this.action) return
    this.action.paused = false
    this.playing = true
  }

  stop() {
    this.action?.stop()
    this.playing = false
    this.playEnd = null
    this.playStartBound = null
    this.seek(0)
  }

  seek(timeSeconds: number) {
    if (!this.action) return
    this.action.time = Math.max(0, timeSeconds)
    this.action.paused = !this.playing
    this.mixer?.update(0)
  }

  setSpeed(speed: number) {
    this.speed = speed
    if (this.action) {
      const sign = this.action.getEffectiveTimeScale() < 0 ? -1 : 1
      this.action.setEffectiveTimeScale(sign * Math.abs(speed))
    }
  }

  getTime(): number {
    return this.action?.time ?? 0
  }

  getDuration(): number {
    return this.action?.getClip().duration ?? this.clips[0]?.duration ?? 0
  }

  getEffectiveTimeScale(): number {
    return this.action?.getEffectiveTimeScale() ?? this.speed
  }

  isPlaying(): boolean {
    return this.playing
  }

  update(deltaSeconds: number) {
    if (!this.mixer || !this.playing) return
    this.mixer.update(deltaSeconds)
    if (!this.action) return
    if (this.playEnd != null && this.action.getEffectiveTimeScale() >= 0) {
      if (this.action.time >= this.playEnd - 1e-4) {
        this.action.time = this.playEnd
        this.action.paused = true
        this.playing = false
        this.mixer.update(0)
      }
    }
    if (this.playStartBound != null && this.action.getEffectiveTimeScale() < 0) {
      if (this.action.time <= this.playStartBound + 1e-4) {
        this.action.time = this.playStartBound
        this.action.paused = true
        this.playing = false
        this.mixer.update(0)
      }
    }
  }

  restoreBindPose() {
    this.action?.stop()
    this.playing = false
    this.playEnd = null
    this.playStartBound = null
    if (!this.mixer || !this.clips.length) {
      this.root?.updateMatrixWorld(true)
      return
    }
    // Scrub every clip to t=0 while paused so door / wheel tracks leave the bind pose,
    // not a leftover end frame from a previous play.
    for (const clip of this.clips) {
      const action = this.mixer.clipAction(clip)
      action.reset()
      action.time = 0
      action.paused = true
      action.enabled = true
      action.play()
      this.mixer.update(0)
      action.stop()
    }
    this.action = null
    this.root?.updateMatrixWorld(true)
  }

  dispose() {
    this.action?.stop()
    this.mixer?.stopAllAction()
    this.mixer?.uncacheRoot(this.root as Object3D)
    this.mixer = null
    this.action = null
    this.clips = []
    this.root = null
    this.playing = false
    this.playEnd = null
    this.playStartBound = null
  }
}
