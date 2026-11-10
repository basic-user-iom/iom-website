import { createHash } from 'node:crypto'
import {
  EMAIL_ATTACH_MAX_FILES,
  EMAIL_ATTACH_MAX_FILE_BYTES,
  EMAIL_ATTACH_MAX_TOTAL_BYTES,
  resolveAttachmentContentType,
  sanitizeAttachmentFilename,
} from './email-attachments.js'

// The code cap is the CRM request limit. Proton publishes a 25 MB mailbox limit;
// this account's SMTP plan was not verified, so it is not used as a second cap.
export const ATTACHMENT_LIMITS = Object.freeze({
  maxFiles: EMAIL_ATTACH_MAX_FILES,
  maxFileBytes: EMAIL_ATTACH_MAX_FILE_BYTES,
  maxTotalBytes: EMAIL_ATTACH_MAX_TOTAL_BYTES,
  source: 'code',
  providerMailboxBytes: null,
  providerPlan: 'unverified',
})

// Private object store that does not exist yet. Nothing here creates it.
export const PROPOSED_PRIVATE_ATTACHMENT_STORE = Object.freeze({
  bucket: 'crm-message-attachments',
  public: false,
  created: false,
  path: '{ownerId}/{messageId}/{sha256}',
  grant: 'iom_email_gateway may insert and select only objects whose name starts with the message owner id. No public read policy and no table-wide storage read.',
})

const MAX_B64 = Math.ceil(EMAIL_ATTACH_MAX_FILE_BYTES * (4 / 3)) + 128

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}
function canonical(value) {
  return Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
}
export function messageApprovalFingerprint(value) {
  return sha256(JSON.stringify(canonical(value)))
}

function named(value) {
  const raw = String(value || '').trim()
  if (!raw || raw === '.' || raw === '..' || /[\\/]/.test(raw)) return null
  const cleaned = sanitizeAttachmentFilename(raw)
  if (!cleaned || cleaned === 'attachment' && raw.toLowerCase() !== 'attachment') return null
  return cleaned
}

function oneFile(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { filename: null, contentType: null, size: null, content: 'unavailable', reason: 'attachment_invalid', publicUrl: null }
  }
  const filename = named(item.filename || item.name)
  if (!filename) {
    return { filename: null, contentType: null, size: null, content: 'unavailable', reason: 'attachment_unnamed', publicUrl: null }
  }
  const declared = String(item.contentType || item.type || '').split(';')[0].trim().toLowerCase()
  const resolved = resolveAttachmentContentType(filename, declared)
  if (!declared || declared !== resolved || resolved === 'application/octet-stream') {
    return { filename, contentType: declared || null, size: null, content: 'unavailable', reason: 'attachment_type_blocked', publicUrl: null }
  }
  const size = item.size
  if (!Number.isSafeInteger(size) || size < 1) {
    return { filename, contentType: declared, size: null, content: 'unavailable', reason: 'attachment_invalid', publicUrl: null }
  }
  if (size > EMAIL_ATTACH_MAX_FILE_BYTES) {
    return { filename, contentType: declared, size, content: 'unavailable', reason: 'attachment_too_large', publicUrl: null }
  }
  const encoded = item.contentBase64 ?? item.content
  if (encoded === undefined || encoded === null || encoded === '') {
    return { filename, contentType: declared, size, content: 'unavailable', reason: 'attachment_unavailable', sha256: null, publicUrl: null }
  }
  const b64 = String(encoded).trim().replace(/^data:[^,]+,/, '').replace(/\s+/g, '')
  if (!b64 || b64.length > MAX_B64) {
    return { filename, contentType: declared, size, content: 'unavailable', reason: 'attachment_too_large', publicUrl: null }
  }
  const bytes = Buffer.from(b64, 'base64')
  if (!bytes.length || bytes.length !== size || bytes.length > EMAIL_ATTACH_MAX_FILE_BYTES) {
    return { filename, contentType: declared, size, content: 'unavailable', reason: bytes.length > EMAIL_ATTACH_MAX_FILE_BYTES || size > EMAIL_ATTACH_MAX_FILE_BYTES ? 'attachment_too_large' : 'attachment_invalid', publicUrl: null }
  }
  const storageKey = typeof item.storageKey === 'string' && item.storageKey && !item.storageKey.includes('://') && !item.storageKey.includes('?') ? item.storageKey : null
  return {
    filename, contentType: declared, size, content: storageKey ? 'stored_private' : 'supplied', reason: null,
    sha256: sha256(bytes), bytes, contentBase64: b64, storageKey, publicUrl: null,
  }
}

export function describeNamedAttachments(raw) {
  if (raw == null || (Array.isArray(raw) && raw.length === 0)) {
    return { ok: true, reason: null, files: [], payload: [], fingerprint: 'none', publicUrl: null }
  }
  if (!Array.isArray(raw)) {
    return { ok: false, reason: 'attachment_invalid', files: [], payload: [], fingerprint: 'invalid', publicUrl: null }
  }
  if (raw.length > EMAIL_ATTACH_MAX_FILES) {
    const files = raw.slice(0, EMAIL_ATTACH_MAX_FILES).map(oneFile).map(publicFile)
    return { ok: false, reason: 'attachment_too_many', files, payload: [], fingerprint: messageApprovalFingerprint(files), publicUrl: null }
  }
  const parsed = raw.map(oneFile)
  let total = 0
  for (const file of parsed) if (Number.isSafeInteger(file.size)) total += file.size
  const tooBig = total > EMAIL_ATTACH_MAX_TOTAL_BYTES
  const reason = tooBig ? 'attachment_too_large' : parsed.find(file => file.reason)?.reason || null
  const files = parsed.map(publicFile)
  return {
    ok: !reason, reason, files, publicUrl: null,
    payload: reason ? [] : parsed.map(file => ({
      filename: file.filename, contentType: file.contentType, size: file.size, content: file.contentBase64,
      sha256: file.sha256, ...(file.storageKey ? { storageKey: file.storageKey } : {}),
    })),
    fingerprint: messageApprovalFingerprint(files.map(file => ({ filename: file.filename, contentType: file.contentType, size: file.size, sha256: file.sha256 || null }))),
  }
}

function publicFile(file) {
  return {
    filename: file.filename, contentType: file.contentType, size: file.size,
    content: file.content === 'stored_private' || file.content === 'supplied' ? file.content : 'unavailable',
    reason: file.reason, sha256: file.sha256 || null, storageKey: file.storageKey || null, publicUrl: null,
  }
}

export function storedAttachmentRecord(item) {
  const storageKey = typeof item?.storageKey === 'string' && item.storageKey && !item.storageKey.includes('://') && !item.storageKey.includes('?') ? item.storageKey : null
  return {
    filename: typeof item?.filename === 'string' ? item.filename : null,
    contentType: typeof item?.contentType === 'string' ? item.contentType : null,
    size: Number.isFinite(item?.size) ? item.size : null,
    storageKey, content: storageKey ? 'stored_private' : 'unavailable',
    reason: storageKey ? null : (item?.reason || 'bytes_not_stored'), publicUrl: null,
  }
}

export async function retainPrivateAttachments(store, { ownerId, messageId, files }) {
  if (!files?.length) return { stored: true, links: [], publicUrl: null }
  if (!store || typeof store.putPrivateObject !== 'function') {
    return {
      stored: false, reason: 'private_store_not_approved', proposal: PROPOSED_PRIVATE_ATTACHMENT_STORE, publicUrl: null,
      links: files.map(file => ({ filename: file.filename, contentType: file.contentType, size: file.size, sha256: file.sha256 || null, messageId, storageKey: null, content: 'unavailable', reason: 'private_store_not_approved', publicUrl: null })),
    }
  }
  const links = []
  for (const file of files) {
    const storageKey = `${PROPOSED_PRIVATE_ATTACHMENT_STORE.bucket}/${ownerId}/${messageId}/${file.sha256}`
    if (storageKey.includes('://')) return { stored: false, reason: 'public_url_forbidden', links, publicUrl: null }
    const saved = await store.putPrivateObject({ ownerId, messageId, storageKey, filename: file.filename, contentType: file.contentType, bytes: Buffer.from(file.content, 'base64') })
    if (saved?.publicUrl || saved?.url || saved?.signedUrl) return { stored: false, reason: 'public_url_forbidden', links, publicUrl: null }
    links.push({ filename: file.filename, contentType: file.contentType, size: file.size, sha256: file.sha256, messageId, storageKey, content: 'stored_private', reason: null, publicUrl: null })
  }
  return { stored: true, links, publicUrl: null }
}
