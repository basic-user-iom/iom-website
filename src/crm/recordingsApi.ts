import { getSupabase, useLiveCrmBackend } from './supabaseClient'
import type { CrmRecording } from './types'

const BUCKET = 'crm-screen-recordings'
/** Reject near-empty MediaRecorder shells (matches client heuristic floor). */
const MIN_VIDEO_BYTES = 8_000
const MIN_IMAGE_BYTES = 200
/** Soft cap when using Cloudflare R2 (10 GB free total storage). */
export const R2_CLIENT_MAX_UPLOAD_BYTES = 512 * 1024 * 1024
/** Soft cap for Supabase Free fallback (~50 MB global upload limit). */
const SUPABASE_FREE_SOFT_MAX_BYTES = 48 * 1024 * 1024

let schemaMissing = false
let r2EnabledCache: boolean | null = null

function assertUploadableBlob(blob: Blob): void {
  const mime = blob.type || ''
  if (mime.startsWith('image/')) {
    if (blob.size < MIN_IMAGE_BYTES) {
      throw new Error('Screenshot file is empty')
    }
    return
  }
  if (blob.size < MIN_VIDEO_BYTES) {
    throw new Error(
      'Recording file is empty or nearly empty. Keep screen sharing active until Stop.',
    )
  }
}

function friendlyStorageError(message: string, bytes: number): string {
  if (
    /maximum allowed size|Payload too large|entity too large|413|file size|FILE_TOO_LARGE/i.test(
      message,
    )
  ) {
    const mb = (bytes / (1024 * 1024)).toFixed(1)
    return `FILE_TOO_LARGE:${mb}`
  }
  return message
}

export function isUploadTooLargeError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return msg.startsWith('FILE_TOO_LARGE:')
}

export function isRecordingsSchemaMissing(err: unknown): boolean {
  if (schemaMissing) return true
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /crm_recordings|schema cache|does not exist|PGRST/i.test(msg)
}

function markSchemaMissing(): void {
  schemaMissing = true
}

function randomSlug(): string {
  const bytes = new Uint8Array(9)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 12)
}

/** SHA-256 hex matching SQL: password || ':' || id || ':iom-rec' */
export async function hashRecordingPassword(
  password: string,
  recordingId: string,
): Promise<string> {
  const raw = `${password}:${recordingId}:iom-rec`
  const data = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}

function mapRow(row: Record<string, unknown>): CrmRecording {
  return {
    id: String(row.id),
    owner_id: String(row.owner_id),
    title: String(row.title ?? 'Untitled'),
    storage_path: String(row.storage_path ?? ''),
    mime_type: String(row.mime_type ?? 'video/webm'),
    duration_ms: row.duration_ms == null ? null : Number(row.duration_ms),
    file_size: row.file_size == null ? null : Number(row.file_size),
    share_slug: String(row.share_slug),
    has_password: Boolean(
      row.password_hash && String(row.password_hash).length > 0,
    ),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function stripContentType(mime: string): string {
  return mime.split(';')[0].trim() || 'video/webm'
}

function extForContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('mp4')) return 'mp4'
  return 'webm'
}

async function getAccessToken(): Promise<string> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { data } = await sb.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  return token
}

export async function isR2RecordingsEnabled(): Promise<boolean> {
  if (r2EnabledCache != null) return r2EnabledCache
  try {
    const res = await fetch('/api/crm-recorder?action=r2-status')
    const json = (await res.json().catch(() => null)) as {
      enabled?: boolean
    } | null
    r2EnabledCache = Boolean(res.ok && json?.enabled)
  } catch {
    r2EnabledCache = false
  }
  return r2EnabledCache
}

/** Soft max for “Upload online” pre-check (depends on active backend). */
export async function getOnlineUploadSoftMaxBytes(): Promise<number> {
  return (await isR2RecordingsEnabled())
    ? R2_CLIENT_MAX_UPLOAD_BYTES
    : SUPABASE_FREE_SOFT_MAX_BYTES
}

async function uploadBlobToR2(
  path: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  const token = await getAccessToken()
  const presign = await fetch('/api/crm-recorder?action=r2-upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path,
      contentType,
      contentLength: blob.size,
    }),
  })
  const body = (await presign.json().catch(() => null)) as {
    uploadUrl?: string
    error?: string
    code?: string
  } | null
  if (presign.status === 503 && body?.code === 'r2_disabled') {
    r2EnabledCache = false
    throw new Error('R2_DISABLED')
  }
  if (!presign.ok || !body?.uploadUrl) {
    throw new Error(
      friendlyStorageError(body?.error || 'Could not start R2 upload', blob.size),
    )
  }

  const put = await fetch(body.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  })
  if (!put.ok) {
    const text = await put.text().catch(() => '')
    throw new Error(
      friendlyStorageError(
        text.slice(0, 180) || `R2 upload failed (${put.status})`,
        blob.size,
      ),
    )
  }
}

async function uploadBlob(
  path: string,
  blob: Blob,
  contentType: string,
): Promise<'r2' | 'supabase'> {
  if (await isR2RecordingsEnabled()) {
    try {
      await uploadBlobToR2(path, blob, contentType)
      return 'r2'
    } catch (err) {
      if (err instanceof Error && err.message === 'R2_DISABLED') {
        /* fall through to Supabase when R2 env is missing */
      } else {
        // Keep online saves on Cloudflare R2 when it is configured — no silent
        // Supabase fallback (those files would not match "Online (Cloudflare R2)").
        throw err instanceof Error
          ? err
          : new Error('Could not upload to Cloudflare R2')
      }
    }
  }

  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, blob, {
    contentType,
    upsert: false,
  })
  if (upErr) {
    if (isRecordingsSchemaMissing(upErr)) markSchemaMissing()
    throw new Error(friendlyStorageError(upErr.message, blob.size))
  }
  return 'supabase'
}

async function deleteBlobFromR2(paths: string[]): Promise<void> {
  if (!paths.length) return
  const token = await getAccessToken()
  const res = await fetch('/api/crm-recorder?action=r2-delete', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paths }),
  })
  if (res.status === 503) {
    r2EnabledCache = false
    return
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || 'Could not delete from R2')
  }
}

async function signedUrlFromR2(storagePath: string): Promise<string | null> {
  if (!(await isR2RecordingsEnabled())) return null
  try {
    const token = await getAccessToken()
    const res = await fetch('/api/crm-recorder?action=r2-sign', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: storagePath }),
    })
    if (res.status === 503) {
      r2EnabledCache = false
      return null
    }
    if (res.status === 404) return null
    const body = (await res.json().catch(() => null)) as {
      signedUrl?: string
      error?: string
    } | null
    if (!res.ok || !body?.signedUrl) return null
    return body.signedUrl
  } catch {
    return null
  }
}

async function removeBlob(path: string): Promise<void> {
  if (!path) return
  if (await isR2RecordingsEnabled()) {
    try {
      await deleteBlobFromR2([path])
    } catch {
      /* also try Supabase for legacy objects */
    }
  }
  const sb = getSupabase()
  if (!sb) return
  await sb.storage.from(BUCKET).remove([path]).catch(() => undefined)
}

export async function listRecordings(): Promise<CrmRecording[]> {
  if (!useLiveCrmBackend()) return []
  const sb = getSupabase()
  if (!sb) return []

  // password_hash is only used to derive has_password; never surface the hash in UI state.
  const { data, error } = await sb
    .from('crm_recordings')
    .select(
      'id, owner_id, title, storage_path, mime_type, duration_ms, file_size, share_slug, password_hash, created_at, updated_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    if (isRecordingsSchemaMissing(error)) markSchemaMissing()
    throw new Error(error.message)
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}

export async function uploadRecording(input: {
  blob: Blob
  title: string
  durationMs: number
  ownerId: string
}): Promise<CrmRecording> {
  if (!useLiveCrmBackend()) {
    throw new Error('Online save requires the live CRM')
  }
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')

  assertUploadableBlob(input.blob)

  const id = crypto.randomUUID()
  const slug = randomSlug()
  const contentType = stripContentType(input.blob.type || 'video/webm')
  const ext = extForContentType(contentType)
  const path = `${input.ownerId}/${id}.${ext}`
  const isImage = contentType.startsWith('image/')

  await uploadBlob(path, input.blob, contentType)

  const { data, error } = await sb
    .from('crm_recordings')
    .insert({
      id,
      owner_id: input.ownerId,
      title:
        input.title.trim() ||
        (isImage ? 'Untitled screenshot' : 'Untitled recording'),
      storage_path: path,
      mime_type: contentType,
      duration_ms: isImage ? 0 : Math.round(input.durationMs),
      file_size: input.blob.size,
      share_slug: slug,
    })
    .select(
      'id, owner_id, title, storage_path, mime_type, duration_ms, file_size, share_slug, password_hash, created_at, updated_at',
    )
    .single()

  if (error) {
    await removeBlob(path)
    if (isRecordingsSchemaMissing(error)) markSchemaMissing()
    throw new Error(error.message)
  }
  return mapRow(data as Record<string, unknown>)
}

export async function deleteRecording(rec: CrmRecording): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')

  await removeBlob(rec.storage_path)
  const { error } = await sb.from('crm_recordings').delete().eq('id', rec.id)
  if (error) throw new Error(error.message)
}

export async function setRecordingPassword(
  recordingId: string,
  password: string | null,
): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')

  let password_hash: string | null = null
  if (password && password.trim()) {
    password_hash = await hashRecordingPassword(password.trim(), recordingId)
  }

  const { error } = await sb
    .from('crm_recordings')
    .update({ password_hash, updated_at: new Date().toISOString() })
    .eq('id', recordingId)

  if (error) throw new Error(error.message)
}

export async function updateRecordingTitle(
  recordingId: string,
  title: string,
): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { error } = await sb
    .from('crm_recordings')
    .update({
      title: title.trim() || 'Untitled recording',
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordingId)
  if (error) throw new Error(error.message)
}

/**
 * Replace media for an existing recording.
 * Uploads to a new path first, then swaps the DB row (share slug / password stay).
 */
export async function replaceRecordingBlob(
  rec: CrmRecording,
  blob: Blob,
  durationMs: number,
): Promise<CrmRecording> {
  if (!useLiveCrmBackend()) {
    throw new Error('Online replace requires the live CRM')
  }
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')

  assertUploadableBlob(blob)

  const contentType = stripContentType(blob.type || rec.mime_type || 'video/webm')
  const ext = extForContentType(contentType)
  const oldPath = rec.storage_path
  const newPath = `${rec.owner_id}/${rec.id}-v${Date.now().toString(36)}.${ext}`

  await uploadBlob(newPath, blob, contentType)

  const { data, error } = await sb
    .from('crm_recordings')
    .update({
      storage_path: newPath,
      mime_type: contentType,
      file_size: blob.size,
      duration_ms: Math.round(durationMs),
      updated_at: new Date().toISOString(),
    })
    .eq('id', rec.id)
    .select(
      'id, owner_id, title, storage_path, mime_type, duration_ms, file_size, share_slug, password_hash, created_at, updated_at',
    )
    .single()

  if (error) {
    await removeBlob(newPath)
    if (isRecordingsSchemaMissing(error)) markSchemaMissing()
    throw new Error(error.message)
  }

  if (oldPath && oldPath !== newPath) {
    await removeBlob(oldPath)
  }

  return mapRow(data as Record<string, unknown>)
}

export async function getRecordingSignedUrl(
  storagePath: string,
): Promise<string> {
  const r2Url = await signedUrlFromR2(storagePath)
  if (r2Url) return r2Url

  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { data, error } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 2)
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Could not create signed URL')
  }
  return data.signedUrl
}

export function shareUrlForSlug(slug: string): string {
  return `${window.location.origin}/r/${slug}`
}

/**
 * Permanent image/file URL for blog covers and markdown.
 * Redirects to a fresh Cloudflare R2 (or Supabase) signed URL — the object
 * itself is not deleted; only direct R2 signed links expire.
 */
export function lastingMediaUrlForSlug(slug: string): string {
  return `${window.location.origin}/api/crm-recorder?action=media&slug=${encodeURIComponent(slug)}`
}

export function embedSnippetForSlug(
  slug: string,
  mimeType?: string | null,
): string {
  const src = `${window.location.origin}/r/${slug}?embed=1`
  const title = mimeType?.startsWith('image/') ? 'Screenshot' : 'Recording'
  // Share page is SPA HTML — always iframe (img src would load HTML, not the file).
  return `<iframe src="${src}" title="${title}" width="720" height="405" allow="autoplay; fullscreen" style="border:0;max-width:100%;aspect-ratio:16/9"></iframe>`
}
