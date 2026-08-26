import { getLead } from './api'
import { isCrmDemoMode } from './demoMode'
import { getSupabase, useLiveCrmBackend } from './supabaseClient'
import type { Lead } from './types'

export type PingScheduledSendsResult = {
  ok: boolean
  checked: number
  due: number
  processed: number
  sent: number
  failed: number
  leadIds: string[]
  trigger?: string
  error?: string
  demo?: boolean
}

const idleResult = (): PingScheduledSendsResult => ({
  ok: true,
  checked: 0,
  due: 0,
  processed: 0,
  sent: 0,
  failed: 0,
  leadIds: [],
})

/**
 * Serial queue: scheduling several leads in a row enqueues pings one after another.
 * A later ping never cancels an in-flight run (so one email cannot abort others).
 */
let queue: Promise<PingScheduledSendsResult> = Promise.resolve(idleResult())

export function enqueuePingScheduledSends(): Promise<PingScheduledSendsResult> {
  const run = queue.then(
    () => executePingScheduledSends(),
    () => executePingScheduledSends(),
  )
  queue = run.then(
    (r) => r,
    (err) => ({
      ...idleResult(),
      ok: false,
      error: err instanceof Error ? err.message : 'Ping failed',
    }),
  )
  return run
}

async function executePingScheduledSends(): Promise<PingScheduledSendsResult> {
  if (isCrmDemoMode()) {
    // Demo processes due schedules on list load (no real SMTP / Supabase).
    return { ...idleResult(), ok: true, demo: true, trigger: 'demo' }
  }

  if (!useLiveCrmBackend()) {
    return {
      ...idleResult(),
      ok: false,
      error: 'Live CRM backend is required to ping scheduled sends.',
    }
  }

  const supabase = getSupabase()
  if (!supabase) {
    return { ...idleResult(), ok: false, error: 'Supabase is not configured.' }
  }

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    return { ...idleResult(), ok: false, error: 'You must be signed in to ping.' }
  }

  const response = await fetch('/api/crm-scheduled-send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >

  if (!response.ok) {
    return {
      ...idleResult(),
      ok: false,
      error:
        typeof payload.error === 'string'
          ? payload.error
          : `Ping failed (${response.status})`,
    }
  }

  const leadIds = [...new Set(
    Array.isArray(payload.results)
      ? payload.results
          .map((row) =>
            row && typeof row === 'object' && 'id' in row
              ? String((row as { id?: unknown }).id || '')
              : '',
          )
          .filter(Boolean)
      : [],
  )]

  return {
    ok: true,
    checked: Number(payload.checked) || 0,
    due: Number(payload.due) || 0,
    processed: Number(payload.processed) || 0,
    sent: Number(payload.sent) || 0,
    failed: Number(payload.failed) || 0,
    leadIds,
    trigger: typeof payload.trigger === 'string' ? payload.trigger : 'staff',
  }
}

/** After Ping now / cron-from-UI: patch only the leads that actually changed. */
export async function applyPingLeadUpdates(
  ping: PingScheduledSendsResult,
  onChanged: (updated?: Lead) => void,
): Promise<void> {
  if (ping.demo) return
  if (ping.sent <= 0 && ping.failed <= 0) return
  if (ping.leadIds.length === 0) return
  for (const id of ping.leadIds) {
    try {
      const lead = await getLead(id)
      if (lead) onChanged(lead)
    } catch {
      /* keep applying other ids */
    }
  }
}
