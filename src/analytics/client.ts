import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AnalyticsEventInput } from './types'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

let client: SupabaseClient | null = null

export function isAnalyticsConfigured(): boolean {
  return Boolean(url && anonKey)
}

/** Lightweight client for public pageview inserts (no auth session). */
export function getAnalyticsClient(): SupabaseClient | null {
  if (!isAnalyticsConfigured()) return null
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

export async function insertPageview(event: AnalyticsEventInput): Promise<boolean> {
  const sb = getAnalyticsClient()
  if (!sb) return false
  const { error } = await sb.from('site_analytics_events').insert(event)
  if (error) {
    console.warn('[analytics] insert failed:', error.message)
    return false
  }
  return true
}
