/**
 * Validate CRM outreach attachments for Proton SMTP (nodemailer).
 * Limits stay under Vercel’s ~4.5 MB request body after base64 encoding.
 */

export const EMAIL_ATTACH_MAX_FILES = 5
export const EMAIL_ATTACH_MAX_FILE_BYTES = 2.5 * 1024 * 1024
export const EMAIL_ATTACH_MAX_TOTAL_BYTES = 2.5 * 1024 * 1024
const MAX_FILENAME = 180
const MAX_B64_CHARS = Math.ceil(EMAIL_ATTACH_MAX_FILE_BYTES * (4 / 3)) + 128

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

const MIME_BY_EXT = {
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

const IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/avif',
])

export class OutreachAttachmentError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   */
  constructor(message, code) {
    super(message)
    this.name = 'OutreachAttachmentError'
    this.code = code
  }
}

/**
 * @param {string} name
 */
export function sanitizeAttachmentFilename(name) {
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

/**
 * @param {string} filename
 */
export function attachmentExtension(filename) {
  const base = sanitizeAttachmentFilename(filename)
  const i = base.lastIndexOf('.')
  if (i <= 0 || i === base.length - 1) return ''
  return base.slice(i + 1).toLowerCase()
}

/**
 * @param {string} filename
 * @param {string} [contentType]
 */
export function resolveAttachmentContentType(filename, contentType) {
  const ext = attachmentExtension(filename)
  const fromExt = ext ? MIME_BY_EXT[ext] : ''
  const raw = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (fromExt) return fromExt
  if (raw && raw !== 'application/octet-stream') return raw
  return 'application/octet-stream'
}

function stripDataUrl(raw) {
  const s = String(raw || '').trim()
  const comma = s.indexOf(',')
  if (/^data:/i.test(s) && comma >= 0) return s.slice(comma + 1)
  return s.replace(/\s+/g, '')
}

/**
 * @param {unknown} raw
 * @returns {{
 *   filename: string,
 *   contentType: string,
 *   size: number,
 *   content: Buffer,
 * }[]}
 */
export function parseOutreachAttachments(raw) {
  if (raw == null) return []
  if (!Array.isArray(raw)) {
    throw new OutreachAttachmentError('Attachments must be an array.', 'ATTACHMENT_INVALID')
  }
  if (raw.length > EMAIL_ATTACH_MAX_FILES) {
    throw new OutreachAttachmentError(
      `You can attach at most ${EMAIL_ATTACH_MAX_FILES} files.`,
      'ATTACHMENT_TOO_MANY',
    )
  }

  const out = []
  let total = 0
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new OutreachAttachmentError('Invalid attachment.', 'ATTACHMENT_INVALID')
    }
    const rec = /** @type {Record<string, unknown>} */ (item)
    const filename = sanitizeAttachmentFilename(String(rec.filename || rec.name || ''))
    const ext = attachmentExtension(filename)
    const mime = String(rec.contentType || rec.type || '')
      .split(';')[0]
      .trim()
      .toLowerCase()
    const allowedExt = ext && ALLOWED_EXT.has(ext)
    const allowedMime = mime === 'application/pdf' || IMAGE_MIME.has(mime)
    if (!allowedExt && !( !ext && allowedMime )) {
      throw new OutreachAttachmentError(
        `${filename} is not an allowed file type.`,
        'ATTACHMENT_TYPE_BLOCKED',
      )
    }
    const b64 = stripDataUrl(String(rec.content || rec.contentBase64 || ''))
    if (!b64 || b64.length > MAX_B64_CHARS) {
      throw new OutreachAttachmentError(
        `${filename} is too large or unreadable.`,
        'ATTACHMENT_TOO_LARGE',
      )
    }
    let buf
    try {
      buf = Buffer.from(b64, 'base64')
    } catch {
      throw new OutreachAttachmentError(
        `${filename} could not be decoded.`,
        'ATTACHMENT_INVALID',
      )
    }
    if (!buf.length) {
      throw new OutreachAttachmentError(`${filename} is empty.`, 'ATTACHMENT_INVALID')
    }
    if (buf.length > EMAIL_ATTACH_MAX_FILE_BYTES) {
      throw new OutreachAttachmentError(
        `${filename} is too large.`,
        'ATTACHMENT_TOO_LARGE',
      )
    }
    total += buf.length
    if (total > EMAIL_ATTACH_MAX_TOTAL_BYTES) {
      throw new OutreachAttachmentError(
        'Attachments are too large in total.',
        'ATTACHMENT_TOO_LARGE',
      )
    }
    out.push({
      filename,
      contentType: resolveAttachmentContentType(
        filename,
        String(rec.contentType || rec.type || ''),
      ),
      size: buf.length,
      content: buf,
    })
  }
  return out
}

/**
 * @param {{ filename: string, contentType: string, size: number, content: Buffer }[]} attachments
 */
export function toNodemailerAttachments(attachments) {
  return attachments.map((a) => ({
    filename: a.filename,
    content: a.content,
    contentType: a.contentType,
  }))
}

/**
 * Metadata only — never persist file bytes in crm_lead_messages.
 * @param {{ filename: string, contentType: string, size: number }[]} attachments
 */
export function attachmentMeta(attachments) {
  return attachments.map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    size: a.size,
  }))
}
