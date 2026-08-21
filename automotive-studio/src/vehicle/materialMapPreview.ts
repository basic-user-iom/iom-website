import type { Texture } from 'three'

const previewByTexture = new Map<string, string>()

/**
 * Build a thumbnail URL from a live Three.js texture (GLB-embedded maps).
 * Uploaded maps should use IndexedDB previews instead.
 */
export function texturePreviewUrl(texture: Texture | null | undefined): string | null {
  if (!texture) return null
  const cached = previewByTexture.get(texture.uuid)
  if (cached) return cached

  const image = texture.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | OffscreenCanvas
    | { data?: ArrayBufferView; width?: number; height?: number }
    | null
    | undefined
  if (!image) return null

  try {
    if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
      if (image.src) {
        previewByTexture.set(texture.uuid, image.src)
        return image.src
      }
    }
    if (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) {
      const url = image.toDataURL('image/jpeg', 0.72)
      previewByTexture.set(texture.uuid, url)
      return url
    }

    const w =
      'width' in image && typeof image.width === 'number' && image.width > 0 ? image.width : 0
    const h =
      'height' in image && typeof image.height === 'number' && image.height > 0 ? image.height : 0
    if (!w || !h) return null

    const canvas = document.createElement('canvas')
    const max = 128
    const scale = Math.min(1, max / Math.max(w, h))
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(image as CanvasImageSource, 0, 0, canvas.width, canvas.height)
    const url = canvas.toDataURL('image/jpeg', 0.72)
    previewByTexture.set(texture.uuid, url)
    return url
  } catch {
    return null
  }
}

export function disposeMaterialMapPreviews() {
  previewByTexture.clear()
}
