/** Circular crop + compress helpers for staff profile photos. */

export const AVATAR_SOURCE_MAX_BYTES = 12 * 1024 * 1024
export const AVATAR_OUTPUT_SIZE = 512
export const AVATAR_JPEG_QUALITY = 0.82

export function validateAvatarSource(file: File): 'invalid' | 'tooLarge' | null {
  if (!file.type.startsWith('image/')) return 'invalid'
  if (file.size > AVATAR_SOURCE_MAX_BYTES) return 'tooLarge'
  return null
}

/** Loads via data URL so the image stays usable during crop preview. */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('load'))
        return
      }
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('load'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('load'))
    reader.readAsDataURL(file)
  })
}

export function releaseImageSource(_img: HTMLImageElement | null | undefined): void {
  // Data URLs need no revoke; kept for API symmetry if we switch back to blob:.
}

/**
 * Export a circular avatar as compressed WebP (preferred) or JPEG.
 * Preview offsets/zoom match AvatarCropDialog viewport math.
 */
export async function exportCircularAvatar(opts: {
  image: HTMLImageElement
  offsetX: number
  offsetY: number
  zoom: number
  viewSize?: number
  size?: number
}): Promise<File> {
  const viewSize = opts.viewSize ?? 280
  const size = opts.size ?? AVATAR_OUTPUT_SIZE
  const img = opts.image
  const minDim = Math.min(img.naturalWidth, img.naturalHeight)
  const displayScale = (viewSize / minDim) * Math.max(0.5, opts.zoom)
  const ratio = size / viewSize

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  const drawW = img.naturalWidth * displayScale * ratio
  const drawH = img.naturalHeight * displayScale * ratio
  const cx = size / 2 + opts.offsetX * ratio
  const cy = size / 2 + opts.offsetY * ratio

  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
  ctx.restore()

  const webp = await canvasToBlob(canvas, 'image/webp', AVATAR_JPEG_QUALITY)
  if (webp && webp.size > 0) {
    return new File([webp], 'avatar.webp', { type: 'image/webp' })
  }

  // JPEG has no alpha — paint dark fill behind the clipped circle.
  const jpgCanvas = document.createElement('canvas')
  jpgCanvas.width = size
  jpgCanvas.height = size
  const jctx = jpgCanvas.getContext('2d')
  if (!jctx) throw new Error('canvas')
  jctx.fillStyle = '#0a121c'
  jctx.fillRect(0, 0, size, size)
  jctx.save()
  jctx.beginPath()
  jctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  jctx.closePath()
  jctx.clip()
  jctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
  jctx.restore()

  const jpeg = await canvasToBlob(jpgCanvas, 'image/jpeg', AVATAR_JPEG_QUALITY)
  if (!jpeg) throw new Error('encode')
  return new File([jpeg], 'avatar.jpg', { type: 'image/jpeg' })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}
