import { createLeadMessage, isLeadMessagesSchemaMissing } from './api'
import type { LeadMessage } from './types'
import type { SendOutreachEmailResult } from './sendOutreachEmail'

export type PersistOutboundInput = {
  leadId: string
  subject: string
  body: string
  bodyHtml?: string | null
  sendResult: SendOutreachEmailResult
  inReplyTo?: string | null
  references?: string | null
  /** When API already stored the row, skip client insert. */
  alreadyStored?: boolean
}

/**
 * Persist an outbound CRM email into crm_lead_messages.
 * Skips when the send API already wrote the row; otherwise writes from the client
 * (demo/local, or live when API persist failed / table missing on server).
 */
export async function persistOutboundMessage(
  input: PersistOutboundInput,
): Promise<LeadMessage | null> {
  if (input.alreadyStored || input.sendResult.storedMessageId) {
    return null
  }

  try {
    return await createLeadMessage({
      lead_id: input.leadId,
      direction: 'outbound',
      from_email: input.sendResult.from,
      to_email: input.sendResult.to,
      subject: input.subject.trim(),
      body_text: input.body,
      body_html: input.bodyHtml ?? null,
      message_id: input.sendResult.messageId,
      in_reply_to: input.inReplyTo ?? input.sendResult.inReplyTo ?? null,
      references_header:
        input.references ?? input.sendResult.references ?? null,
      occurred_at: new Date().toISOString(),
    })
  } catch (err) {
    if (isLeadMessagesSchemaMissing(err)) return null
    console.warn('[crm] persist outbound message failed', err)
    return null
  }
}
