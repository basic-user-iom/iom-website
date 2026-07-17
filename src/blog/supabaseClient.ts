import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const isBlogSupabaseReady = Boolean(url && anonKey)

let client: SupabaseClient | null = null

/** Public blog client — independent of CRM demo sandbox flag. */
export function getBlogSupabase(): SupabaseClient | null {
  if (!isBlogSupabaseReady) return null
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return client
}
