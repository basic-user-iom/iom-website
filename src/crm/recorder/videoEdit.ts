import {
  applyBlurRegions,
  type BlurRegion,
  type BlurStrength,
} from './blurRegions'

export interface VideoEditOptions {
  trimStartMs: number
  /** Exclusive end; 0 or <= start means use full duration. */
  trimEndMs: number
  /** Linear gain 0..2 (1 = original). */
  volume: number
  blurRegions: BlurRegion[]
  blurStrength: BlurStrength
  onProgress?: (ratio: number) => void
}

function pickRecorderMime(): string {
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
    return 'video/webm;codecs=vp9,opus'
  }
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
    return 'video/webm;codecs=vp8,opus'
  }
  return 'video/webm'
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve(video)
    video.onerror = () => reject(new Error('Video load failed'))
  })
}

function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onErr)
      resolve()
    }
    const onErr = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onErr)
      reject(new Error('Seek failed'))
    }
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onErr)
    const clamped = Math.max(0, Math.min(timeSec, video.duration || timeSec))
    if (Math.abs(video.currentTime - clamped) < 0.04) {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onErr)
      resolve()
      return
    }
    video.currentTime = clamped
  })
}

/**
 * Re-encode a video blob with optional trim, region blur, and volume gain.
 */
export async function processVideoBlob(
  source: Blob,
  options: VideoEditOptions,
): Promise<{ blob: Blob; durationMs: number }> {
  const url = URL.createObjectURL(source)
  let audioCtx: AudioContext | null = null
  let raf = 0

  try {
    const video = await loadVideo(url)
    const fullMs = Math.round((video.duration || 0) * 1000)
    const startMs = Math.max(0, Math.min(options.trimStartMs, fullMs))
    let endMs =
      options.trimEndMs > startMs
        ? Math.min(options.trimEndMs, fullMs)
        : fullMs
    if (endMs <= startMs) {
      endMs = fullMs
    }
    const durationMs = Math.max(0, endMs - startMs)
    if (durationMs < 50) {
      throw new Error('Trim range too short')
    }

    const needsBlur = options.blurRegions.length > 0
    const volume = Math.max(0, Math.min(2, options.volume))
    const needsVolume = Math.abs(volume - 1) > 0.01
    const needsTrim = startMs > 40 || endMs < fullMs - 40

    if (!needsBlur && !needsVolume && !needsTrim) {
      options.onProgress?.(1)
      return { blob: source, durationMs: fullMs || durationMs }
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')

    const vStream = canvas.captureStream(30)
    const tracks: MediaStreamTrack[] = [...vStream.getVideoTracks()]

    try {
      const media = (
        video as HTMLVideoElement & { captureStream?: () => MediaStream }
      ).captureStream?.()
      const audioTracks = media?.getAudioTracks() ?? []
      if (audioTracks.length) {
        if (volume <= 0.001) {
          // Mute: omit audio tracks
        } else if (needsVolume) {
          audioCtx = new AudioContext()
          const src = audioCtx.createMediaStreamSource(
            new MediaStream(audioTracks),
          )
          const gain = audioCtx.createGain()
          gain.gain.value = volume
          const dest = audioCtx.createMediaStreamDestination()
          src.connect(gain)
          gain.connect(dest)
          tracks.push(...dest.stream.getAudioTracks())
        } else {
          tracks.push(...audioTracks)
        }
      }
    } catch {
      /* no audio */
    }

    const combined = new MediaStream(tracks)
    const mime = pickRecorderMime()
    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(combined, {
      mimeType: mime,
      videoBitsPerSecond: 4_000_000,
    })
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime }))
      recorder.onerror = () => reject(new Error('MediaRecorder failed'))
    })

    const startSec = startMs / 1000
    const endSec = endMs / 1000

    await seekVideo(video, startSec)
    if (audioCtx?.state === 'suspended') await audioCtx.resume()

    recorder.start(250)

    const paint = () => {
      if (video.ended || video.paused) return
      if (video.currentTime >= endSec - 0.02) {
        video.pause()
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      if (needsBlur) {
        applyBlurRegions(
          ctx,
          canvas,
          options.blurRegions,
          options.blurStrength,
        )
      }
      const played = Math.max(0, video.currentTime * 1000 - startMs)
      options.onProgress?.(Math.min(0.99, played / durationMs))
      raf = requestAnimationFrame(paint)
    }

    await video.play()
    paint()

    await new Promise<void>((resolve) => {
      let settled = false
      let watchdog = 0
      let timeout = 0
      const finish = () => {
        if (settled) return
        settled = true
        video.removeEventListener('ended', finish)
        video.removeEventListener('pause', onPause)
        window.clearInterval(watchdog)
        window.clearTimeout(timeout)
        resolve()
      }
      const onPause = () => {
        if (video.currentTime >= endSec - 0.05 || video.ended) finish()
      }
      video.addEventListener('ended', finish)
      video.addEventListener('pause', onPause)
      watchdog = window.setInterval(() => {
        if (video.currentTime >= endSec - 0.02) {
          video.pause()
          finish()
        }
      }, 50)
      timeout = window.setTimeout(finish, durationMs + 4000)
    })

    cancelAnimationFrame(raf)
    if (recorder.state !== 'inactive') recorder.stop()
    video.pause()
    vStream.getTracks().forEach((t) => t.stop())
    tracks.forEach((t) => {
      if (t.readyState !== 'ended') t.stop()
    })

    const blob = await done
    options.onProgress?.(1)
    return { blob, durationMs }
  } finally {
    cancelAnimationFrame(raf)
    void audioCtx?.close().catch(() => undefined)
    URL.revokeObjectURL(url)
  }
}
