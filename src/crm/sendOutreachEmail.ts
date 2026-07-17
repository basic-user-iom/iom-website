import { getSupabase, useLiveCrmBackend } from './supabaseClient'
import { isCrmDemoMode } from './demoMode'
import {
  OUTREACH_FROM_IDENTITIES,
  type OutreachFromIdentityId,
} from './outreachFromIdentities'

export type SendOutreachEmailInput = {
  to: string
  subject: string
  body: string
  leadId?: string
  fromIdentity?: OutreachFromIdentityId
  /** Parent Message-ID for replies (In-Reply-To). */
  inReplyTo?: string | null
  /** Prior References chain (space-separated Message-IDs). */
  references?: string | null
  /** When false, API skips writing crm_lead_messages (client will persist). */
  persistMessage?: boolean
}

export type SendOutreachEmailResult = {
  ok: true
  messageId: string | null
  storedMessageId?: string | null
  from: string
  fromIdentity?: OutreachFromIdentityId
  to: string
  inReplyTo?: string | null
  references?: string | null
}

function resolveFromEmail(id: OutreachFromIdentityId | undefined): string {
  const found = OUTREACH_FROM_IDENTITIES.find((i) => i.id === (id || 'contact'))
  return found?.email ?? 'contact@iobjectm.com'
}

/** Simulated CRM send for /crm-demo — never hits Proton SMTP. */
async function sendDemoOutreachEmail(
  input: SendOutreachEmailInput,
): Promise<SendOutreachEmailResult> {
  await new Promise((r) => window.setTimeout(r, 350))
  const fromIdentity = input.fromIdentity || 'contact'
  const parent = input.inReplyTo?.trim() || null
  return {
    ok: true,
    messageId: `<demo-${Date.now()}@iom-showcase.example>`,
    from: resolveFromEmail(fromIdentity),
    fromIdentity,
    to: input.to.trim(),
    inReplyTo: parent,
    references: parent
      ? [input.references?.trim(), parent].filter(Boolean).join(' ')
      : input.references?.trim() || null,
  }
}

export async function sendOutreachEmail(
  input: SendOutreachEmailInput,
): Promise<SendOutreachEmailResult> {
  if (isCrmDemoMode()) {
    return sendDemoOutreachEmail(input)
  }
  if (!useLiveCrmBackend()) {
    throw new Error('Live CRM backend is required to send email.')
  }

  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('You must be signed in to send email.')

  const fromIdentity = input.fromIdentity || 'contact'

  const response = await fetch('/api/crm-send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: input.to.trim(),
      subject: input.subject.trim(),
      body: input.body.trim(),
      leadId: input.leadId,
      fromIdentity,
      inReplyTo: input.inReplyTo || undefined,
      references: input.references || undefined,
      persistMessage: input.persistMessage,
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | SendOutreachEmailResult
    | { error?: string; detail?: string }
    | null

  if (!response.ok) {
    const detail =
      payload && 'detail' in payload && payload.detail
        ? ` (${payload.detail})`
        : ''
    const message =
      payload && 'error' in payload && payload.error
        ? `${payload.error}${detail}`
        : `Send failed (${response.status})`
    throw new Error(message)
  }

  if (!payload || !('ok' in payload) || !payload.ok) {
    throw new Error('Unexpected response from send API.')
  }

  return payload
}
