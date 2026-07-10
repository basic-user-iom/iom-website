export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function bandAverage(data: Uint8Array, start: number, end: number) {
  const from = Math.max(0, Math.floor(start))
  const to = Math.min(data.length, Math.ceil(end))
  if (to <= from) return 0
  let sum = 0
  for (let i = from; i < to; i += 1) sum += data[i]
  return sum / (to - from) / 255
}

export type MusicPlayerAudioState = {
  phase: number
  bass: number
  mids: number
  highs: number
  energy: number
  anim: number
  detail: number
  transient: number
  swell: number
}

export class MusicPlayerAudioDriver {
  phase = 0
  smoothedBass = 0
  smoothedMids = 0
  smoothedHighs = 0
  smoothedTransient = 0
  smoothedSwell = 0
  private prevInstantEnergy = 0
  private freqData: Uint8Array | null = null

  private ensureBuffers(analyser: AnalyserNode | null) {
    if (!analyser) {
      this.freqData = null
      return
    }
    if (!this.freqData || this.freqData.length !== analyser.frequencyBinCount) {
      this.freqData = new Uint8Array(analyser.frequencyBinCount)
    }
  }

  update(
    delta: number,
    time: number,
    isPlaying: boolean,
    analyser: AnalyserNode | null,
  ): MusicPlayerAudioState {
    this.ensureBuffers(analyser)

    const targetPhase = isPlaying ? 1 : 0
    const phaseRate = isPlaying ? 7.5 : 9
    this.phase = clamp(this.phase + (targetPhase - this.phase) * delta * phaseRate, 0, 1)

    const idleBreath = 0.14 + Math.sin(time * 0.35) * 0.05
    const liveEnergy =
      0.28 + this.phase * 0.55 + this.smoothedBass * 0.22 + this.smoothedTransient * 0.12
    const energy = isPlaying ? liveEnergy : Math.max(0.16, idleBreath)
    const anim = isPlaying ? 0.06 + this.phase * 0.72 : 0.05 + idleBreath * 0.12

    let bass = 0
    let mids = 0
    let highs = 0
    let transient = 0

    if (analyser && this.freqData && isPlaying) {
      analyser.getByteFrequencyData(this.freqData)
      const len = this.freqData.length
      const rawBass = bandAverage(this.freqData, 0, len * 0.1)
      const rawMids = bandAverage(this.freqData, len * 0.08, len * 0.48)
      const rawHighs = bandAverage(this.freqData, len * 0.42, len)

      bass = Math.pow(rawBass, 0.82) * 1.6
      mids = Math.pow(rawMids, 0.85) * 1.3
      highs = Math.pow(rawHighs, 0.88) * 1.5

      const instant = rawBass * 1.35 + rawMids * 0.55 + rawHighs * 0.95
      transient = Math.max(0, instant - this.prevInstantEnergy)
      this.prevInstantEnergy = lerp(this.prevInstantEnergy, instant, delta * 14)
    } else {
      bass = idleBreath * 0.22 + Math.sin(time * 0.9) * 0.04
      mids = idleBreath * 0.18 + Math.sin(time * 1.3 + 1.1) * 0.03
      highs = idleBreath * 0.14 + Math.sin(time * 1.8 + 2.2) * 0.025
      transient = 0
      this.prevInstantEnergy = lerp(this.prevInstantEnergy, 0, delta * 8)
    }

    const smooth = isPlaying ? 20 : 12
    this.smoothedBass = lerp(this.smoothedBass, bass, delta * smooth)
    this.smoothedMids = lerp(this.smoothedMids, mids, delta * smooth)
    this.smoothedHighs = lerp(this.smoothedHighs, highs, delta * smooth)
    this.smoothedTransient = lerp(this.smoothedTransient, transient, delta * (isPlaying ? 24 : 10))
    const swellRate = isPlaying ? 2.2 : 1.6
    this.smoothedSwell = lerp(
      this.smoothedSwell,
      this.smoothedBass * 0.7 + this.smoothedMids * 0.3,
      delta * swellRate,
    )

    const detail =
      0.06 + this.phase * 0.04 + this.smoothedMids * 0.28 + this.smoothedHighs * 0.18

    return {
      phase: this.phase,
      bass: this.smoothedBass,
      mids: this.smoothedMids,
      highs: this.smoothedHighs,
      energy,
      anim,
      detail,
      transient: this.smoothedTransient,
      swell: this.smoothedSwell,
    }
  }
}
