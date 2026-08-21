import type { StudioRenderer } from './createRenderer'

const MAX_WIDTH = 320
const JPEG_QUALITY = 0.72

/**
 * Render the current viewport once and return a compact JPEG data URL.
 * Captures immediately after `render()` so we do not need preserveDrawingBuffer.
 */
export function captureViewportThumbnail(studio: StudioRenderer): string | null {
  try {
    studio.render()
    const source = studio.canvas
    const sw = source.width
    const sh = source.height
    if (sw < 2 || sh < 2) return null

    const scale = Math.min(1, MAX_WIDTH / sw)
    const dw = Math.max(1, Math.round(sw * scale))
    const dh = Math.max(1, Math.round(sh * scale))

    const off = document.createElement('canvas')
    off.width = dw
    off.height = dh
    const ctx = off.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(source, 0, 0, dw, dh)
    return off.toDataURL('image/jpeg', JPEG_QUALITY)
  } catch (err) {
    console.warn('[automotive-studio] Shot thumbnail capture failed', err)
    return null
  }
}
