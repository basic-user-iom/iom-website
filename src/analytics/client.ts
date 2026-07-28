import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnalyticsEventInput } from './types'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

let client: SupabaseClient | null = null
let clientPromise: Promise<SupabaseClient | null> | null = null

export function isAnalyticsConfigured(): boolean {
  return Boolean(url && anonKey)
}

/** Lazy-load @supabase/supabase-js so it stays out of the homepage critical path. */
async function getAnalyticsClient(): Promise<SupabaseClient | null> {
  if (!isAnalyticsConfigured()) return null
  if (client) return client
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      client = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
      return client
    })
  }
  return clientPromise
}

export async function insertPageview(event: AnalyticsEventInput): Promise<boolean> {
  const sb = await getAnalyticsClient()
  if (!sb) return false
  const { error } = await sb.from('site_analytics_events').insert(event)
  if (error) {
    console.warn('[analytics] insert failed:', error.message)
    return false
  }
  return true
}
