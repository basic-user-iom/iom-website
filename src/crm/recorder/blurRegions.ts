/** Normalized blur box (0–1 relative to frame width/height). */
export interface BlurRegion {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export type BlurStrength = 'light' | 'medium' | 'strong'

const BLUR_PX: Record<BlurStrength, number> = {
  light: 8,
  medium: 16,
  strong: 28,
}

/**
 * Blur rectangular regions on an already-drawn frame.
 * Regions are normalized 0–1.
 */
export function applyBlurRegions(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  regions: BlurRegion[],
  strength: BlurStrength = 'medium',
): void {
  if (!regions.length) return
  const blurPx = BLUR_PX[strength]
  const cw = canvas.width
  const ch = canvas.height
  if (!cw || !ch) return

  // Per-call scratch — avoid races between live preview and export.
  const scratch = document.createElement('canvas')

  for (const r of regions) {
    const x = Math.max(0, Math.floor(r.x * cw))
    const y = Math.max(0, Math.floor(r.y * ch))
    const w = Math.max(1, Math.floor(r.w * cw))
    const h = Math.max(1, Math.floor(r.h * ch))
    if (x >= cw || y >= ch) continue
    const rw = Math.min(w, cw - x)
    const rh = Math.min(h, ch - y)
    if (rw < 2 || rh < 2) continue

    scratch.width = rw
    scratch.height = rh
    const sctx = scratch.getContext('2d')
    if (!sctx) continue
    sctx.clearRect(0, 0, rw, rh)
    sctx.drawImage(canvas, x, y, rw, rh, 0, 0, rw, rh)

    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, rw, rh)
    ctx.clip()
    ctx.filter = `blur(${blurPx}px)`
    // Draw slightly larger so blur softens at edges inside the clip
    const pad = Math.ceil(blurPx * 1.5)
    ctx.drawImage(scratch, x - pad, y - pad, rw + pad * 2, rh + pad * 2)
    ctx.restore()
  }
}

/** Draw dashed outlines so the operator sees active blur boxes. */
export function strokeBlurRegions(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  regions: BlurRegion[],
  draft?: { x: number; y: number; w: number; h: number } | null,
): void {
  const cw = canvas.width
  const ch = canvas.height
  if (!cw || !ch) return

  const drawBox = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ) => {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(2, Math.round(cw / 600))
    ctx.setLineDash([8, 6])
    ctx.strokeRect(x * cw, y * ch, w * cw, h * ch)
    ctx.fillStyle = 'rgba(0, 140, 255, 0.12)'
    ctx.fillRect(x * cw, y * ch, w * cw, h * ch)
    ctx.restore()
  }

  for (const r of regions) drawBox(r.x, r.y, r.w, r.h, 'rgba(80, 180, 255, 0.95)')
  if (draft && draft.w > 0.005 && draft.h > 0.005) {
    drawBox(draft.x, draft.y, draft.w, draft.h, 'rgba(255, 200, 60, 0.95)')
  }
}

export function normalizeRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Omit<BlurRegion, 'id'> {
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  const w = Math.abs(x1 - x0)
  const h = Math.abs(y1 - y0)
  return {
    x: clamp01(x),
    y: clamp01(y),
    w: clamp01(w),
    h: clamp01(h),
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/**
 * Map pointer position on a displayed canvas to normalized 0–1 coords
 * (handles CSS scaling / object-fit: contain).
 */
export function pointerToNormalized(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return null
  const cw = canvas.width || 1
  const ch = canvas.height || 1
  const scale = Math.min(rect.width / cw, rect.height / ch)
  const dispW = cw * scale
  const dispH = ch * scale
  const offsetX = rect.left + (rect.width - dispW) / 2
  const offsetY = rect.top + (rect.height - dispH) / 2
  const px = (clientX - offsetX) / dispW
  const py = (clientY - offsetY) / dispH
  if (px < 0 || py < 0 || px > 1 || py > 1) return null
  return { x: px, y: py }
}

/**
 * Re-encode a recorded video with blur regions applied (post-production).
 */
export async function applyBlurToVideoBlob(
  videoBlob: Blob,
  regions: BlurRegion[],
  strength: BlurStrength = 'medium',
): Promise<Blob> {
  if (!regions.length) return videoBlob
  try {
    const { processVideoBlob } = await import('./videoEdit')
    const { blob } = await processVideoBlob(videoBlob, {
      trimStartMs: 0,
      trimEndMs: 0,
      volume: 1,
      blurRegions: regions,
      blurStrength: strength,
    })
    return blob
  } catch {
    return videoBlob
  }
}
