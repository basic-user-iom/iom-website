/**
 * Raise crm-screen-recordings bucket file size limit (requires service role).
 * Usage: node --env-file=.env scripts/raise-recordings-bucket-limit.mjs
 *    or: node --env-file=.env.local scripts/raise-recordings-bucket-limit.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = (
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ''
).trim()
const key = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''
).trim()

if (!url || !key) {
  console.error(
    'Missing VITE_SUPABASE_URL / SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
  )
  process.exit(1)
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const LIMIT = 524_288_000 // 500 MB
const { data, error } = await sb.storage.updateBucket('crm-screen-recordings', {
  public: false,
  fileSizeLimit: LIMIT,
  allowedMimeTypes: [
    'video/webm',
    'video/mp4',
    'video/quicktime',
    'audio/webm',
    'audio/mpeg',
    'audio/wav',
    'image/png',
    'image/jpeg',
    'image/webp',
  ],
})

if (error) {
  console.error('updateBucket failed:', error.message)
  console.error(
    'Fallback: run supabase/crm_recordings_raise_size_limit.sql in the Supabase SQL editor.',
  )
  process.exit(1)
}

console.log('Updated crm-screen-recordings fileSizeLimit to', LIMIT, '(500 MB)')
console.log(data)
