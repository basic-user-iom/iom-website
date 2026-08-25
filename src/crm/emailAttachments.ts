import type { LeadMessage } from './types'

export const EMAIL_ATTACH_MAX_FILES = 5
export const EMAIL_ATTACH_MAX_FILE_BYTES = 2.5 * 1024 * 1024
export const EMAIL_ATTACH_MAX_TOTAL_BYTES = 2.5 * 1024 * 1024

const MAX_FILENAME = 180

const IMAGE_EXT = new Set([
  'png',
  'jpg',
  'jpeg',
  'jpe',
  'jfif',
  'gif',
  'webp',
  'bmp',
  'tif',
  'tiff',
  'heic',
  'heif',
  'avif',
])

const ALLOWED_EXT = new Set([
  'pdf',
  ...IMAGE_EXT,
  'txt',
  'csv',
  'md',
  'json',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'zip',
])

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jfif: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  zip: 'application/zip',
}

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
}

const IMAGE_MIME = new Set(Object.keys(MIME_TO_EXT).filter((m) => m.startsWith('image/')))

const COMPRESS_EXT = new Set(['png', 'jpg', 'jpeg', 'jpe', 'jfif', 'webp', 'bmp', 'tif', 'tiff', 'avif'])

/** Prefer images and PDFs in the OS picker; other allowed types remain selectable. */
export const EMAIL_ATTACH_ACCEPT = [
  'image/*',
  'application/pdf',
  ...[...ALLOWED_EXT].map((ext) => `.${ext}`),
].join(',')

export type OutreachEmailAttachment = {
  filename: string
  contentType: string
  content: string
  size: number
}

export type OutreachAttachmentMeta = {
  filename: string
  contentType: string
  size: number
}

export type AttachValidationIssue = {
  key:
    | 'outreach.attachTooMany'
    | 'outreach.attachFileTooLarge'
    | 'outreach.attachTotalTooLarge'
    | 'outreach.attachTypeBlocked'
    | 'outreach.attachEmptyFile'
  vars: Record<string, string>
}

export function formatAttachBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function sanitizeAttachmentFilename(name: string): string {
  const base = String(name || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
  const cleaned = String(base || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .trim()
    .slice(0, MAX_FILENAME)
  return cleaned || 'attachment'
}

export function attachmentExtension(filename: string): string {
  const base = sanitizeAttachmentFilename(filename)
  const i = base.lastIndexOf('.')
  if (i <= 0 || i === base.length - 1) return ''
  return base.slice(i + 1).toLowerCase()
}

export function isAllowedAttachmentName(filename: string): boolean {
  const ext = attachmentExtension(filename)
  return !!ext && ALLOWED_EXT.has(ext)
}

function stripMime(type: string | undefined): string {
  return String(type || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
}

export function isImageAttachment(file: { name: string; type?: string }): boolean {
  const ext = attachmentExtension(file.name)
  if (ext && IMAGE_EXT.has(ext)) return true
  return IMAGE_MIME.has(stripMime(file.type))
}

export function isPdfAttachment(file: { name: string; type?: string }): boolean {
  if (attachmentExtension(file.name) === 'pdf') return true
  return stripMime(file.type) === 'application/pdf'
}

export function isAllowedAttachmentFile(file: { name: string; type?: string }): boolean {
  const name = sanitizeAttachmentFilename(file.name)
  const ext = attachmentExtension(name)
  if (ext) return ALLOWED_EXT.has(ext)
  const mime = stripMime(file.type)
  return mime === 'application/pdf' || IMAGE_MIME.has(mime)
}

export function resolveAttachmentContentType(
  filename: string,
  contentType?: string,
): string {
  const ext = attachmentExtension(filename)
  if (ext && MIME_BY_EXT[ext]) return MIME_BY_EXT[ext]
  const raw = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (raw && raw !== 'application/octet-stream') return raw
  return 'application/octet-stream'
}

export function validateOutgoingFiles(
  existing: File[],
  incoming: File[],
): AttachValidationIssue | null {
  const merged: File[] = []
  const seen = new Set<string>()
  for (const file of [...existing, ...incoming]) {
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(file)
  }
  if (merged.length > EMAIL_ATTACH_MAX_FILES) {
    return {
      key: 'outreach.attachTooMany',
      vars: { max: String(EMAIL_ATTACH_MAX_FILES) },
    }
  }
  let total = 0
  for (const file of merged) {
    const name = sanitizeAttachmentFilename(file.name)
    if (!isAllowedAttachmentFile({ name, type: file.type })) {
      return { key: 'outreach.attachTypeBlocked', vars: { name } }
    }
    if (file.size <= 0) {
      return { key: 'outreach.attachEmptyFile', vars: { name } }
    }
    if (file.size > EMAIL_ATTACH_MAX_FILE_BYTES) {
      return {
        key: 'outreach.attachFileTooLarge',
        vars: { name, max: formatAttachBytes(EMAIL_ATTACH_MAX_FILE_BYTES) },
      }
    }
    total += file.size
    if (total > EMAIL_ATTACH_MAX_TOTAL_BYTES) {
      return {
        key: 'outreach.attachTotalTooLarge',
        vars: { max: formatAttachBytes(EMAIL_ATTACH_MAX_TOTAL_BYTES) },
      }
    }
  }
  return null
}

export function mergeOutgoingFiles(existing: File[], incoming: File[]): File[] {
  const merged: File[] = []
  const seen = new Set<string>()
  for (const file of [...existing, ...incoming]) {
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(file)
  }
  return merged
}

function extFromMime(type: string | undefined): string {
  return MIME_TO_EXT[stripMime(type)] || ''
}

function canCompressRaster(file: File): boolean {
  const ext = attachmentExtension(file.name)
  if (ext) return COMPRESS_EXT.has(ext)
  const mime = stripMime(file.type)
  return (
    mime === 'image/jpeg' ||
    mime === 'image/png' ||
    mime === 'image/webp' ||
    mime === 'image/bmp' ||
    mime === 'image/tiff' ||
    mime === 'image/avif'
  )
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

async function compressRasterImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const maxEdge = 1920
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Canvas unavailable')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let quality = 0.86
  let blob: Blob | null = null
  while (quality >= 0.52) {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    if (blob && blob.size <= EMAIL_ATTACH_MAX_FILE_BYTES) break
    quality -= 0.08
  }
  if (!blob || blob.size > EMAIL_ATTACH_MAX_FILE_BYTES) {
    throw new Error('Compressed image is still too large')
  }
  const stem =
    sanitizeAttachmentFilename(file.name).replace(/\.[^.]+$/, '') || 'image'
  return new File([blob], `${stem}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

/** Rename clipboard/screenshot files and shrink oversized photos to the send cap. */
export async function prepareEmailAttachmentFile(file: File): Promise<File> {
  let name = sanitizeAttachmentFilename(file.name || '')
  let ext = attachmentExtension(name)
  if (!ext) {
    const fromMime = extFromMime(file.type)
    if (fromMime) {
      const stem =
        name && name !== 'attachment'
          ? name
          : stripMime(file.type).startsWith('image/')
            ? 'image'
            : fromMime === 'pdf'
              ? 'document'
              : 'attachment'
      name = `${stem}.${fromMime}`
      ext = fromMime
    }
  }
  const type = file.type || (ext ? MIME_BY_EXT[ext] : '') || file.type
  let next =
    name !== file.name
      ? new File([file], name, { type, lastModified: file.lastModified })
      : file

  if (next.size > EMAIL_ATTACH_MAX_FILE_BYTES && canCompressRaster(next)) {
    try {
      next = await compressRasterImage(next)
    } catch {
      /* keep original; validateOutgoingFiles reports the size error */
    }
  }
  return next
}

export function filesFromClipboard(event: Event): File[] {
  const data = (event as { clipboardData?: DataTransfer | null }).clipboardData
  const fromList = Array.from(data?.files || [])
  if (fromList.length) return fromList
  const out: File[] = []
  for (const item of Array.from(data?.items || [])) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file) out.push(file)
  }
  return out
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export async function filesToOutreachAttachments(
  files: File[],
): Promise<OutreachEmailAttachment[]> {
  const issue = validateOutgoingFiles([], files)
  if (issue) {
    throw new Error(
      issue.key === 'outreach.attachTooMany'
        ? `You can attach at most ${issue.vars.max} files.`
        : issue.key === 'outreach.attachFileTooLarge'
          ? `${issue.vars.name} is too large (max ${issue.vars.max}).`
          : issue.key === 'outreach.attachTotalTooLarge'
            ? `Attachments are too large in total (max ${issue.vars.max}).`
            : issue.key === 'outreach.attachEmptyFile'
              ? `${issue.vars.name} is empty.`
              : `${issue.vars.name} is not an allowed file type.`,
    )
  }
  const out: OutreachEmailAttachment[] = []
  for (const file of files) {
    const filename = sanitizeAttachmentFilename(file.name)
    const content = await fileToBase64(file)
    out.push({
      filename,
      contentType: resolveAttachmentContentType(filename, file.type),
      content,
      size: file.size,
    })
  }
  return out
}

export function attachmentMetaFromPayload(
  attachments: OutreachEmailAttachment[],
): OutreachAttachmentMeta[] {
  return attachments.map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    size: a.size,
  }))
}

export function messageAttachmentMeta(
  msg: LeadMessage | { raw_headers?: Record<string, unknown> },
): OutreachAttachmentMeta[] {
  const raw = msg.raw_headers?.attachments
  if (!Array.isArray(raw)) return []
  const out: OutreachAttachmentMeta[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const rec = item as Record<string, unknown>
    const filename = sanitizeAttachmentFilename(String(rec.filename || rec.name || ''))
    if (!filename) continue
    const size =
      typeof rec.size === 'number' && Number.isFinite(rec.size)
        ? Math.max(0, Math.floor(rec.size))
        : 0
    out.push({
      filename,
      contentType: resolveAttachmentContentType(
        filename,
        String(rec.contentType || rec.type || ''),
      ),
      size,
    })
  }
  return out
}
