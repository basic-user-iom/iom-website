import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type { AppearanceMode } from './types'

let landmarkerPromise: Promise<FaceLandmarker | null> | null = null
/** Shared instance — do not .close() per recording or later sessions break. */
let sharedLandmarker: FaceLandmarker | null = null

async function loadFaceLandmarker(): Promise<FaceLandmarker | null> {
  if (sharedLandmarker) return sharedLandmarker
  if (landmarkerPromise) return landmarkerPromise
  landmarkerPromise = (async () => {
    try {
      const resolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      )
      const lm = await FaceLandmarker.createFromOptions(resolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
      })
      sharedLandmarker = lm
      return lm
    } catch (err) {
      console.warn('[recorder] MediaPipe load failed', err)
      landmarkerPromise = null
      return null
    }
  })()
  return landmarkerPromise
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Static avatar failed to load'))
    img.src = url
  })
}

function drawCoverCircle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return
  const scale = Math.max(w / iw, h / ih)
  const dw = iw * scale
  const dh = ih * scale
  const dx = (w - dw) / 2
  const dy = (h - dh) / 2
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2)
  ctx.stroke()
}

export interface AppearanceRenderer {
  draw: (
    video: HTMLVideoElement | null,
    pip: HTMLCanvasElement,
    mode: AppearanceMode,
  ) => void
  setStaticImageUrl: (url: string | null) => void
  dispose: () => void
}

export function createAppearanceRenderer(
  initialStaticUrl?: string | null,
): AppearanceRenderer {
  let landmarker: FaceLandmarker | null = null
  let lastDetect = 0
  let lastLandmarks: Array<{ x: number; y: number; z: number }> | null = null
  let blend: Record<string, number> = {}
  let staticImg: HTMLImageElement | null = null
  let staticUrl: string | null = initialStaticUrl?.trim() || null

  void loadFaceLandmarker().then((lm) => {
    landmarker = lm
  })

  if (staticUrl) {
    void loadImage(staticUrl)
      .then((img) => {
        staticImg = img
      })
      .catch((err) => console.warn('[recorder] static avatar', err))
  }

  const filterCanvas = document.createElement('canvas')
  const filterCtx = filterCanvas.getContext('2d')

  return {
    setStaticImageUrl(url) {
      staticUrl = url?.trim() || null
      staticImg = null
      if (!staticUrl) return
      void loadImage(staticUrl)
        .then((img) => {
          staticImg = img
        })
        .catch((err) => console.warn('[recorder] static avatar', err))
    },
    draw(video, pip, mode) {
      const w = pip.width
      const h = pip.height
      const ctx = pip.getContext('2d')
      if (!ctx) return

      if (mode === 'static') {
        ctx.clearRect(0, 0, w, h)
        if (staticImg?.complete && (staticImg.naturalWidth || staticImg.width)) {
          drawCoverCircle(ctx, staticImg, w, h)
        } else {
          ctx.fillStyle = '#1a1f28'
          ctx.beginPath()
          ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'rgba(255,255,255,0.45)'
          ctx.font = '600 14px system-ui,sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('No image', w / 2, h / 2)
        }
        return
      }

      if (!video?.videoWidth) return

      if (mode === 'real') {
        ctx.save()
        ctx.beginPath()
        ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()
        ctx.translate(w, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, w, h)
        ctx.restore()
        return
      }

      if (mode === 'filters') {
        if (!filterCtx) return
        filterCanvas.width = w
        filterCanvas.height = h
        filterCtx.save()
        filterCtx.translate(w, 0)
        filterCtx.scale(-1, 1)
        filterCtx.filter = 'contrast(1.1) saturate(1.15) brightness(1.05)'
        filterCtx.drawImage(video, 0, 0, w, h)
        filterCtx.restore()
        ctx.clearRect(0, 0, w, h)
        ctx.save()
        ctx.beginPath()
        ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(filterCanvas, 0, 0)
        const g = ctx.createRadialGradient(
          w / 2,
          h / 2,
          w * 0.2,
          w / 2,
          h / 2,
          w * 0.55,
        )
        g.addColorStop(0, 'rgba(0,0,0,0)')
        g.addColorStop(1, 'rgba(20,30,50,0.35)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
        ctx.restore()
        return
      }

      const now = performance.now()
      if (landmarker && now - lastDetect > 33) {
        try {
          const result: FaceLandmarkerResult = landmarker.detectForVideo(
            video,
            now,
          )
          lastLandmarks = result.faceLandmarks?.[0] ?? null
          const cats = result.faceBlendshapes?.[0]?.categories ?? []
          blend = {}
          for (const c of cats) blend[c.categoryName] = c.score
          lastDetect = now
        } catch {
          /* keep last */
        }
      }

      ctx.clearRect(0, 0, w, h)
      drawStylizedAvatar(ctx, w, h, lastLandmarks, blend)
    },
    dispose() {
      // Keep the shared FaceLandmarker alive for the next recording.
      // Closing it destroys the WebGL graph and breaks Filters/Avatar until reload.
      landmarker = null
      staticImg = null
      staticUrl = null
    },
  }
}

function drawStylizedAvatar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  landmarks: Array<{ x: number; y: number; z: number }> | null,
  blend: Record<string, number>,
) {
  const cx = w / 2
  const cy = h / 2
  const rx = w * 0.42
  const ry = h * 0.48

  const headGrad = ctx.createLinearGradient(0, cy - ry, 0, cy + ry)
  headGrad.addColorStop(0, '#e8c4a8')
  headGrad.addColorStop(1, '#c9956c')
  ctx.fillStyle = headGrad
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#2a2118'
  ctx.beginPath()
  ctx.ellipse(cx, cy - ry * 0.35, rx * 0.95, ry * 0.55, 0, Math.PI, 0)
  ctx.fill()

  const smile = Math.min(
    1,
    (blend.mouthSmileLeft || 0) + (blend.mouthSmileRight || 0),
  )
  const jaw = Math.min(1, blend.jawOpen || 0)
  const blink =
    Math.max(blend.eyeBlinkLeft || 0, blend.eyeBlinkRight || 0) > 0.5

  let leftEye = { x: cx - rx * 0.35, y: cy - ry * 0.1 }
  let rightEye = { x: cx + rx * 0.35, y: cy - ry * 0.1 }
  let mouth = { x: cx, y: cy + ry * 0.28 }

  if (landmarks && landmarks.length > 400) {
    const le = landmarks[33]
    const re = landmarks[263]
    const mo = landmarks[13]
    if (le && re && mo) {
      leftEye = { x: (1 - le.x) * w, y: le.y * h }
      rightEye = { x: (1 - re.x) * w, y: re.y * h }
      mouth = { x: (1 - mo.x) * w, y: mo.y * h }
    }
  }

  const eyeH = blink ? 2 : 8 + smile * 2
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.ellipse(leftEye.x, leftEye.y, 10, eyeH, 0, 0, Math.PI * 2)
  ctx.ellipse(rightEye.x, rightEye.y, 10, eyeH, 0, 0, Math.PI * 2)
  ctx.fill()

  if (!blink) {
    ctx.fillStyle = '#f5f5f5'
    ctx.beginPath()
    ctx.arc(leftEye.x + 3, leftEye.y - 2, 3, 0, Math.PI * 2)
    ctx.arc(rightEye.x + 3, rightEye.y - 2, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = '#5a3020'
  ctx.fillStyle = '#8b3a3a'
  ctx.lineWidth = 3
  ctx.beginPath()
  const mouthW = 28 + smile * 16
  const mouthOpen = 4 + jaw * 22
  if (jaw > 0.15) {
    ctx.ellipse(mouth.x, mouth.y, mouthW * 0.5, mouthOpen, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.moveTo(mouth.x - mouthW * 0.5, mouth.y)
    ctx.quadraticCurveTo(
      mouth.x,
      mouth.y + 8 + smile * 10,
      mouth.x + mouthW * 0.5,
      mouth.y,
    )
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx - 2, ry - 2, 0, 0, Math.PI * 2)
  ctx.stroke()
}
