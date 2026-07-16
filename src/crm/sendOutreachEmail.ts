import { getSupabase, useLiveCrmBackend } from './supabaseClient'
import { isCrmDemoMode } from './demoMode'

export type SendOutreachEmailInput = {
  to: string
  subject: string
  body: string
  leadId?: string
}

export type SendOutreachEmailResult = {
  ok: true
  messageId: string | null
  from: string
  to: string
}

export async function sendOutreachEmail(
  input: SendOutreachEmailInput,
): Promise<SendOutreachEmailResult> {
  if (isCrmDemoMode()) {
    throw new Error('Sending email is disabled in CRM demo mode.')
  }
  if (!useLiveCrmBackend()) {
    throw new Error('Live CRM backend is required to send email.')
  }

  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('You must be signed in to send email.')

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
