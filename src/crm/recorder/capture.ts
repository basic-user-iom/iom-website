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
  /** True when the current share includes live tab/system audio tracks. */
  hasShareAudio: () => boolean
}

const PIP_SIZE = 220
const PIP_MARGIN = 24

function displayMediaOptions(shareAudio: boolean): DisplayMediaStreamOptions {
  return {
    video: {
      frameRate: 30,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: shareAudio
      ? {
          // Prefer raw tab/system audio — don't "phone call" process it.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      : false,
  }
}

type RvfcVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    cb: (now: number, meta: unknown) => void,
  ) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

type TrackProcessorCtor = new (init: {
  track: MediaStreamTrack
}) => { readable: ReadableStream<VideoFrame> }

type CanvasCaptureTrack = MediaStreamTrack & {
  requestFrame?: () => void
}

/**
 * Screen + optional camera / static PiP + processed mic audio.
 *
 * Frame pump prefers MediaStreamTrackProcessor so compositing keeps running when
 * the CRM tab is in the background (e.g. user is watching the YouTube tab they
 * are recording). rAF alone freezes → “only one image” WebMs.
 */
export async function startCapture(
  options: CaptureOptions,
): Promise<ActiveCapture> {
  const wantShareAudio = Boolean(options.shareAudio)
  let display = await navigator.mediaDevices.getDisplayMedia(
    displayMediaOptions(wantShareAudio),
  )

  const appearanceMode = options.appearance
  const staticUrl = options.staticAvatarUrl?.trim() || ''
  const useStaticPip = appearanceMode === 'static' && Boolean(staticUrl)
  const wantLivePip =
    appearanceMode !== 'static' &&
    appearanceMode !== 'none' &&
    Boolean(options.camera)

  let cameraStream: MediaStream | null = null
  let cameraVideo: HTMLVideoElement | null = null
  let appearance: AppearanceRenderer | null = null
  let pipCanvas: HTMLCanvasElement | null = null
  let audio: AudioPipeline | null = null
  let mixCtx: AudioContext | null = null
  let mixDest: MediaStreamAudioDestinationNode | null = null
  let displayAudioNode: MediaStreamAudioSourceNode | null = null
  let micAudioNode: MediaStreamAudioSourceNode | null = null
  let running = false
  let screenVideo: HTMLVideoElement | null = null
  let canvasStream: MediaStream | null = null
  let canvasCaptureTrack: CanvasCaptureTrack | null = null
  let pipVisible = useStaticPip || wantLivePip
  let rvfcHandle: number | null = null
  let processorReader: ReadableStreamDefaultReader<VideoFrame> | null = null
  /** Set after the frame pump is created; used when swapping display sources. */
  let restartProcessorPump: () => void = () => undefined

  const canToggleCameraPip =
    appearanceMode === 'none'
      ? false
      : appearanceMode === 'static'
        ? Boolean(staticUrl)
        : true

  const teardownDisplayAudioNode = () => {
    try {
      displayAudioNode?.disconnect()
    } catch {
      /* ignore */
    }
    displayAudioNode = null
  }

  const connectDisplayAudio = () => {
    teardownDisplayAudioNode()
    if (!wantShareAudio || !mixCtx || !mixDest) return
    const tracks = display.getAudioTracks().filter((t) => t.readyState === 'live')
    if (!tracks.length) return
    displayAudioNode = mixCtx.createMediaStreamSource(new MediaStream(tracks))
    displayAudioNode.connect(mixDest)
  }

  const cleanup = () => {
    running = false
    if (processorReader) {
      void processorReader.cancel().catch(() => undefined)
      processorReader = null
    }
    const v = screenVideo as RvfcVideo | null
    if (rvfcHandle != null && v?.cancelVideoFrameCallback) {
      try {
        v.cancelVideoFrameCallback(rvfcHandle)
      } catch {
        /* ignore */
      }
      rvfcHandle = null
    }
    teardownDisplayAudioNode()
    try {
      micAudioNode?.disconnect()
    } catch {
      /* ignore */
    }
    micAudioNode = null
    if (mixCtx) {
      void mixCtx.close().catch(() => undefined)
      mixCtx = null
      mixDest = null
    }
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
    const next = await navigator.mediaDevices.getDisplayMedia(
      displayMediaOptions(wantShareAudio),
    )
    const prev = display
    display = next
    screenVideo.srcObject = display
    await screenVideo.play()
    prev.getTracks().forEach((t) => t.stop())
    wireDisplayEnded()
    restartProcessorPump()
    connectDisplayAudio()
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

    const hasDisplayAudio =
      wantShareAudio &&
      display.getAudioTracks().some((t) => t.readyState !== 'ended')

    let outputAudioTracks: MediaStreamTrack[] = []
    if (audio && hasDisplayAudio) {
      mixCtx = new AudioContext()
      if (mixCtx.state === 'suspended') {
        await mixCtx.resume().catch(() => undefined)
      }
      mixDest = mixCtx.createMediaStreamDestination()
      micAudioNode = mixCtx.createMediaStreamSource(audio.stream)
      micAudioNode.connect(mixDest)
      connectDisplayAudio()
      outputAudioTracks = mixDest.stream.getAudioTracks()
    } else if (audio) {
      outputAudioTracks = audio.stream.getAudioTracks()
    } else if (hasDisplayAudio) {
      mixCtx = new AudioContext()
      if (mixCtx.state === 'suspended') {
        await mixCtx.resume().catch(() => undefined)
      }
      mixDest = mixCtx.createMediaStreamDestination()
      connectDisplayAudio()
      outputAudioTracks = mixDest.stream.getAudioTracks()
    }

    screenVideo = document.createElement('video')
    screenVideo.srcObject = display
    screenVideo.muted = true
    screenVideo.playsInline = true
    await screenVideo.play()

    const canvas = document.createElement('canvas')
    const syncSize = (w: number, h: number) => {
      if (!w || !h) return
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }
    syncSize(screenVideo.videoWidth || 1280, screenVideo.videoHeight || 720)

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')

    const paintOverlays = () => {
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
      options.onFrame?.(canvas)
      // captureStream(0) only emits when requestFrame() is called after paint.
      canvasCaptureTrack?.requestFrame?.()
    }

    const paintFromElement = () => {
      if (!running || !screenVideo) return
      if (!screenVideo.videoWidth) {
        options.onFrame?.(canvas)
        return
      }
      syncSize(screenVideo.videoWidth, screenVideo.videoHeight)
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)
      paintOverlays()
    }

    const paintFromFrame = (frame: VideoFrame) => {
      if (!running) {
        frame.close()
        return
      }
      const w = frame.displayWidth || frame.codedWidth
      const h = frame.displayHeight || frame.codedHeight
      syncSize(w || canvas.width, h || canvas.height)
      try {
        ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
        paintOverlays()
      } finally {
        frame.close()
      }
    }

    const startLegacyPump = () => {
      const v = screenVideo as RvfcVideo
      const tick = () => {
        if (!running || !screenVideo) return
        paintFromElement()
        if (typeof v.requestVideoFrameCallback === 'function') {
          rvfcHandle = v.requestVideoFrameCallback(() => {
            rvfcHandle = null
            tick()
          })
        } else {
          requestAnimationFrame(tick)
        }
      }
      tick()
    }

    const startProcessorPump = () => {
      const Processor = (
        window as unknown as { MediaStreamTrackProcessor?: TrackProcessorCtor }
      ).MediaStreamTrackProcessor
      const track = display.getVideoTracks()[0]
      if (!Processor || !track) {
        startLegacyPump()
        return
      }
      try {
        const processor = new Processor({ track })
        const reader = processor.readable.getReader()
        processorReader = reader
        void (async () => {
          try {
            while (running) {
              const { value, done } = await reader.read()
              if (done || !running) break
              if (value) paintFromFrame(value)
            }
          } catch (err) {
            console.warn('[recorder] track processor stopped, falling back', err)
            if (running) startLegacyPump()
          }
        })()
      } catch (err) {
        console.warn('[recorder] MediaStreamTrackProcessor unavailable', err)
        startLegacyPump()
      }
    }

    restartProcessorPump = () => {
      if (!processorReader) return
      void processorReader.cancel().catch(() => undefined)
      processorReader = null
      startProcessorPump()
    }

    // frameRate 0 + requestFrame() after each paint: real frames while backgrounded.
    // (captureStream(30) alone can keep re-encoding a frozen bitmap.)
    canvasStream = canvas.captureStream(0)
    canvasCaptureTrack = canvasStream.getVideoTracks()[0] as CanvasCaptureTrack

    running = true
    startProcessorPump()

    const tracks: MediaStreamTrack[] = [
      ...canvasStream.getVideoTracks(),
      ...outputAudioTracks,
    ]
    const stream = new MediaStream(tracks)

    return {
      stream,
      canvas,
      changeDisplaySource,
      setCameraPip,
      isCameraPipOn,
      canToggleCameraPip,
      hasShareAudio: () =>
        wantShareAudio &&
        display.getAudioTracks().some((t) => t.readyState === 'live'),
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
