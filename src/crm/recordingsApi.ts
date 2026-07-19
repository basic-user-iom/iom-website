import { getSupabase, useLiveCrmBackend } from './supabaseClient'
import type { CrmRecording } from './types'

const BUCKET = 'crm-screen-recordings'

let schemaMissing = false

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

export async function listRecordings(): Promise<CrmRecording[]> {
  if (!useLiveCrmBackend()) return []
  const sb = getSupabase()
  if (!sb) return []

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

  const id = crypto.randomUUID()
  const slug = randomSlug()
  const ext = input.blob.type.includes('mp4') ? 'mp4' : 'webm'
  const path = `${input.ownerId}/${id}.${ext}`

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, input.blob, {
    contentType: input.blob.type || 'video/webm',
    upsert: false,
  })
  if (upErr) {
    if (isRecordingsSchemaMissing(upErr)) markSchemaMissing()
    throw new Error(upErr.message)
  }

  const { data, error } = await sb
    .from('crm_recordings')
    .insert({
      id,
      owner_id: input.ownerId,
      title: input.title.trim() || 'Untitled recording',
      storage_path: path,
      mime_type: input.blob.type || 'video/webm',
      duration_ms: Math.round(input.durationMs),
      file_size: input.blob.size,
      share_slug: slug,
    })
    .select(
      'id, owner_id, title, storage_path, mime_type, duration_ms, file_size, share_slug, password_hash, created_at, updated_at',
    )
    .single()

  if (error) {
    await sb.storage.from(BUCKET).remove([path]).catch(() => undefined)
    if (isRecordingsSchemaMissing(error)) markSchemaMissing()
    throw new Error(error.message)
  }
  return mapRow(data as Record<string, unknown>)
}

export async function deleteRecording(rec: CrmRecording): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')

  await sb.storage.from(BUCKET).remove([rec.storage_path]).catch(() => undefined)
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

/** Overwrite the video file in place; share slug / password stay the same. */
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

  const mime = blob.type || rec.mime_type || 'video/webm'
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(rec.storage_path, blob, {
      contentType: mime,
      upsert: true,
    })
  if (upErr) {
    if (isRecordingsSchemaMissing(upErr)) markSchemaMissing()
    throw new Error(upErr.message)
  }

  const { data, error } = await sb
    .from('crm_recordings')
    .update({
      mime_type: mime,
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
    if (isRecordingsSchemaMissing(error)) markSchemaMissing()
    throw new Error(error.message)
  }
  return mapRow(data as Record<string, unknown>)
}

export async function getRecordingSignedUrl(
  storagePath: string,
): Promise<string> {
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

export function embedSnippetForSlug(slug: string): string {
  const src = `${window.location.origin}/r/${slug}?embed=1`
  return `<iframe src="${src}" title="Recording" width="720" height="405" allow="autoplay; fullscreen" style="border:0;max-width:100%;aspect-ratio:16/9"></iframe>`
}
