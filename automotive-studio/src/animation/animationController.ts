import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  Object3D,
} from 'three'

export type PlaybackMode = 'once' | 'repeat' | 'pingpong'

export class AnimationController {
  private mixer: AnimationMixer | null = null
  private clips: AnimationClip[] = []
  private action: AnimationAction | null = null
  private root: Object3D | null = null
  private playing = false
  private speed = 1
  private mode: PlaybackMode = 'once'

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

  play(index = 0, mode: PlaybackMode = this.mode) {
    if (!this.mixer || !this.clips[index]) return
    this.mode = mode
    this.action?.stop()
    this.action = this.mixer.clipAction(this.clips[index])
    this.action.reset()
    this.action.setEffectiveTimeScale(this.speed)
    this.action.setLoop(mode === 'once' ? LoopOnce : LoopRepeat, mode === 'once' ? 1 : Infinity)
    this.action.clampWhenFinished = mode === 'once'
    this.action.play()
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
    if (this.action) this.action.setEffectiveTimeScale(speed)
  }

  getTime(): number {
    return this.action?.time ?? 0
  }

  getDuration(): number {
    return this.action?.getClip().duration ?? this.clips[0]?.duration ?? 0
  }

  isPlaying(): boolean {
    return this.playing
  }

  update(deltaSeconds: number) {
    if (!this.mixer || !this.playing) return
    this.mixer.update(deltaSeconds)
  }

  restoreBindPose() {
    this.action?.stop()
    this.playing = false
    if (this.mixer && this.clips[0]) {
      const action = this.mixer.clipAction(this.clips[0])
      action.reset()
      action.time = 0
      action.paused = true
      action.play()
      this.mixer.update(0)
      action.stop()
    }
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
  }
}
