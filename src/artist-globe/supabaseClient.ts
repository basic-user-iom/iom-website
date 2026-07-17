import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const isArtistGlobeSupabaseReady = Boolean(url && anonKey)

let client: SupabaseClient | null = null

/** Dedicated client (not CRM-demo gated) so the public demo can use live Supabase. */
export function getArtistGlobeSupabase(): SupabaseClient | null {
  if (!isArtistGlobeSupabaseReady) return null
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'artist-globe-auth',
      },
    })
  }
  return client
}
