import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isCrmDemoMode } from './demoMode'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
/** Publishable (`sb_publishable_…`) or legacy anon JWT — both work with createClient. */
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

const supabaseEnvReady = Boolean(url && anonKey)

/**
 * Env has Supabase credentials. Prefer `useLiveCrmBackend()` for data/auth paths
 * so the public `/crm-demo` never hits production.
 */
export const isSupabaseConfigured = supabaseEnvReady

/** True when CRM should talk to live Supabase (never in sandboxed demo). */
export function useLiveCrmBackend(): boolean {
  return supabaseEnvReady && !isCrmDemoMode()
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!useLiveCrmBackend()) return null
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
