import { createAppearanceRenderer, type AppearanceRenderer } from './appearance'
import { createAudioPipeline, type AudioPipeline } from './audioPipeline'
import { applyBlurRegions } from './blurRegions'
import type { CaptureOptions } from './types'

export interface ActiveCapture {
  stream: MediaStream
  canvas: HTMLCanvasElement
  stop: () => void
  /** Pick a new tab/window/screen (typically while paused). Keeps mic/camera. */
  changeDisplaySource: () => Promise<void>
  /** Show/hide camera or static PiP overlay while recording. */
  setCameraPip: (on: boolean) => Promise<void>
  isCameraPipOn: () => boolean
  canToggleCameraPip: boolean
}

const PIP_SIZE = 220
const PIP_MARGIN = 24

const DISPLAY_CONSTRAINTS: DisplayMediaStreamOptions = {
  video: {
    frameRate: 30,
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
}

/**
 * Screen + optional camera / static PiP + processed mic audio.
 */
export async function startCapture(
  options: CaptureOptions,
): Promise<ActiveCapture> {
  let display = await navigator.mediaDevices.getDisplayMedia(DISPLAY_CONSTRAINTS)

  const appearanceMode = options.appearance
  const staticUrl = options.staticAvatarUrl?.trim() || ''
  const useStaticPip = appearanceMode === 'static' && Boolean(staticUrl)
  const wantLivePip =
    appearanceMode !== 'static' && Boolean(options.camera)

  let cameraStream: MediaStream | null = null
  let cameraVideo: HTMLVideoElement | null = null
  let appearance: AppearanceRenderer | null = null
  let pipCanvas: HTMLCanvasElement | null = null
  let audio: AudioPipeline | null = null
  let running = false
  let screenVideo: HTMLVideoElement | null = null
  let canvasStream: MediaStream | null = null
  let pipVisible = useStaticPip || wantLivePip

  const canToggleCameraPip =
    appearanceMode === 'static' ? Boolean(staticUrl) : true

  const cleanup = () => {
    running = false
    display.getTracks().forEach((t) => t.stop())
    cameraStream?.getTracks().forEach((t) => t.stop())
    audio?.stop()
    appearance?.dispose()
    canvasStream?.getTracks().forEach((t) => t.stop())
    if (screenVideo) screenVideo.srcObject = null
    if (cameraVideo) cameraVideo.srcObject = null
  }

  const ensureAppearance = () => {
    if (!appearance) {
      appearance = createAppearanceRenderer(staticUrl || null)
    }
    if (!pipCanvas) {
      pipCanvas = document.createElement('canvas')
      pipCanvas.width = PIP_SIZE
      pipCanvas.height = PIP_SIZE
    }
  }

  const ensureLiveCamera = async () => {
    if (cameraStream && cameraVideo) {
      cameraStream.getVideoTracks().forEach((t) => {
        t.enabled = true
      })
      return
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    })
    cameraVideo = document.createElement('video')
    cameraVideo.srcObject = cameraStream
    cameraVideo.muted = true
    cameraVideo.playsInline = true
    await cameraVideo.play()
    ensureAppearance()
  }

  const changeDisplaySource = async () => {
    if (!running || !screenVideo) {
      throw new Error('Capture is not active')
    }
    const next = await navigator.mediaDevices.getDisplayMedia(DISPLAY_CONSTRAINTS)
    const prev = display
    display = next
    screenVideo.srcObject = display
    await screenVideo.play()
    prev.getTracks().forEach((t) => t.stop())
    wireDisplayEnded()
  }

  const wireDisplayEnded = () => {
    const track = display.getVideoTracks()[0]
    if (!track) return
    track.onended = () => {
      options.onDisplayEnded?.()
    }
  }
  wireDisplayEnded()

  const setCameraPip = async (on: boolean) => {
    if (!canToggleCameraPip) return
    if (appearanceMode === 'static') {
      ensureAppearance()
      pipVisible = on
      return
    }
    if (on) {
      await ensureLiveCamera()
      pipVisible = true
    } else {
      pipVisible = false
      cameraStream?.getVideoTracks().forEach((t) => {
        t.enabled = false
      })
    }
  }

  const isCameraPipOn = () => {
    if (!pipVisible) return false
    if (appearanceMode === 'static') return Boolean(staticUrl)
    return Boolean(
      cameraStream?.getVideoTracks().some((t) => t.enabled && t.readyState === 'live'),
    )
  }

  try {
    if (wantLivePip) {
      await ensureLiveCamera()
    } else if (useStaticPip) {
      ensureAppearance()
    }

    if (options.mic) {
      audio = await createAudioPipeline(options.voice, {
        noiseSuppression: options.noiseSuppression !== false,
      })
    }

    screenVideo = document.createElement('video')
    screenVideo.srcObject = display
    screenVideo.muted = true
    screenVideo.playsInline = true
    await screenVideo.play()

    const canvas = document.createElement('canvas')
    const syncSize = () => {
      canvas.width = screenVideo!.videoWidth || 1280
      canvas.height = screenVideo!.videoHeight || 720
    }
    syncSize()

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')

    running = true

    const draw = () => {
      if (!running || !screenVideo) return
      if (screenVideo.videoWidth) {
        if (
          canvas.width !== screenVideo.videoWidth ||
          canvas.height !== screenVideo.videoHeight
        ) {
          syncSize()
        }
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)

        const showPip =
          pipVisible &&
          appearance &&
          pipCanvas &&
          (appearanceMode === 'static' || Boolean(cameraVideo))

        if (showPip) {
          appearance!.draw(cameraVideo, pipCanvas!, appearanceMode)
          const x = canvas.width - PIP_SIZE - PIP_MARGIN
          const y = canvas.height - PIP_SIZE - PIP_MARGIN
          ctx.save()
          ctx.shadowColor = 'rgba(0,0,0,0.45)'
          ctx.shadowBlur = 18
          ctx.beginPath()
          ctx.ellipse(
            x + PIP_SIZE / 2,
            y + PIP_SIZE / 2,
            PIP_SIZE / 2,
            PIP_SIZE / 2,
            0,
            0,
            Math.PI * 2,
          )
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(pipCanvas!, x, y, PIP_SIZE, PIP_SIZE)
          ctx.restore()
          ctx.strokeStyle = 'rgba(255,255,255,0.85)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.ellipse(
            x + PIP_SIZE / 2,
            y + PIP_SIZE / 2,
            PIP_SIZE / 2,
            PIP_SIZE / 2,
            0,
            0,
            Math.PI * 2,
          )
          ctx.stroke()
        }

        const regions = options.getBlurRegions?.() ?? []
        if (regions.length) {
          applyBlurRegions(
            ctx,
            canvas,
            regions,
            options.getBlurStrength?.() ?? 'medium',
          )
        }
      }
      options.onFrame?.(canvas)
      requestAnimationFrame(draw)
    }
    requestAnimationFrame(draw)

    canvasStream = canvas.captureStream(30)
    const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()]
    if (audio) tracks.push(...audio.stream.getAudioTracks())
    const stream = new MediaStream(tracks)

    return {
      stream,
      canvas,
      changeDisplaySource,
      setCameraPip,
      isCameraPipOn,
      canToggleCameraPip,
      stop: () => {
        running = false
        stream.getTracks().forEach((t) => t.stop())
        cleanup()
      },
    }
  } catch (err) {
    cleanup()
    throw err
  }
}
