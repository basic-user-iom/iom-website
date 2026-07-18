import { extensionForFormat, type OutputFormat } from './presets'

export type ProcessOptions = {
  /** Longest edge in CSS pixels. Null = keep source size (no upscale either way). */
  maxEdge: number | null
  format: OutputFormat
  /** 0–1; ignored for PNG */
  quality: number
}

export type ProcessResult = {
  blob: Blob
  width: number
  height: number
  bytes: number
  filename: string
  /** True when EXIF / metadata is dropped by canvas re-encode */
  exifStripped: true
}

function scaleToMaxEdge(
  srcW: number,
  srcH: number,
  maxEdge: number | null,
): { width: number; height: number } {
  if (!maxEdge || maxEdge <= 0) {
    return { width: srcW, height: srcH }
  }
  const longest = Math.max(srcW, srcH)
  if (longest <= maxEdge) {
    return { width: srcW, height: srcH }
  }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  }
}

function buildFilename(originalName: string, format: OutputFormat, width: number, height: number): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'image'
  const safe = base.replace(/[^\w.-]+/g, '_').slice(0, 80)
  return `${safe}_${width}x${height}.${extensionForFormat(format)}`
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode image'))
          return
        }
        resolve(blob)
      },
      format,
      format === 'image/png' ? undefined : Math.min(1, Math.max(0.05, quality)),
    )
  })
}

/**
 * Load → optionally downscale → re-encode.
 * Canvas re-encode drops EXIF / IPTC / XMP. Orientation is applied via createImageBitmap.
 */
async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, {
      // Honour EXIF orientation, then strip metadata on export
      imageOrientation: 'from-image',
    })
  } catch {
    return createImageBitmap(file)
  }
}

export async function processImage(file: File, options: ProcessOptions): Promise<ProcessResult> {
  const bitmap = await loadBitmap(file)

  try {
    const { width, height } = scaleToMaxEdge(bitmap.width, bitmap.height, options.maxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: options.format === 'image/png' })
    if (!ctx) throw new Error('Canvas not available')

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await canvasToBlob(canvas, options.format, options.quality)
    return {
      blob,
      width,
      height,
      bytes: blob.size,
      filename: buildFilename(file.name, options.format, width, height),
      exifStripped: true,
    }
  } finally {
    bitmap.close()
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
