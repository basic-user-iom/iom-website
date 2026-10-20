import type { SendOutreachEmailInput, SendOutreachEmailResult } from './sendOutreachEmail'

type Snapshot = {
  to: string; from: string; fromIdentity: string; subject: string; body: string; html: string
  inReplyTo?: string; references?: string
  attachments?: { filename: string; contentType: string; content: string }[]
}
type Review = { id: string; digest: string; expiresAt: string; snapshot: Snapshot }
type Job = { id?: string; status: string; error?: string; messageId?: string; storedMessageId?: string; snapshot?: Snapshot }
type Pending = { intent: string; key: string; confirmed: boolean }

async function api<T>(token: string, name: string, args: object): Promise<T> {
  const response = await fetch('/api/crm-email-live-workflow', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, arguments: args }),
  })
  const payload = await response.json().catch(() => null) as { ok?: boolean; result?: T; error?: string } | null
  if (!response.ok || !payload?.ok || !payload.result) {
    const code = payload?.error || 'email_status_unavailable'
    throw new Error(code === 'email_access_denied'
      ? 'Reviewed CRM sending is not enabled for this staff account. No email was sent by this request.'
      : `Reviewed email request failed (${code}).`)
  }
  return payload.result
}

export function showReviewedEmail(review: Review): Promise<boolean> {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog')
    dialog.style.cssText = 'box-sizing:border-box;width:min(900px,94vw);max-width:94vw;max-height:92vh;padding:24px;color:#eee;background:#141922;border:1px solid #566070;border-radius:12px'
    const title = document.createElement('h2')
    title.textContent = 'Review email before sending'
    const details = document.createElement('pre')
    details.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere'
    details.textContent = `From: ${review.snapshot.from}\nTo: ${review.snapshot.to}\nSubject: ${review.snapshot.subject}` +
      (review.snapshot.inReplyTo ? `\nReply to: ${review.snapshot.inReplyTo}` : '') +
      `\nAttachments: ${review.snapshot.attachments?.map(a => a.filename).join(', ') || 'None'}`
    const frame = document.createElement('iframe')
    frame.title = 'Exact reviewed email'
    frame.setAttribute('sandbox', '')
    frame.style.cssText = 'display:block;width:100%;height:48vh;background:white;border:0'
    frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">` + review.snapshot.html
    const label = document.createElement('label')
    label.style.cssText = 'display:block;margin:16px 0'
    const checked = document.createElement('input')
    checked.type = 'checkbox'
    label.append(checked, ' I reviewed this recipient, sender, message and attachments.')
    const send = document.createElement('button')
    send.type = 'button'
    send.textContent = 'Confirm and send this email'
    send.disabled = true
    send.className = 'btn btn-primary'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = 'Cancel'
    cancel.className = 'btn btn-ghost'
    const finish = (accepted: boolean) => {
      dialog.remove()
      resolve(accepted)
    }
    checked.addEventListener('change', () => { send.disabled = !checked.checked })
    cancel.addEventListener('click', () => finish(false))
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false) })
    send.addEventListener('click', () => {
      if (checked.checked && Date.parse(review.expiresAt) > Date.now()) finish(true)
      else { send.disabled = true; title.textContent = 'Review expired. Cancel and review again.' }
    })
    dialog.append(title, details, frame, label, cancel, send)
    document.body.append(dialog)
    dialog.showModal()
    cancel.focus()
  })
}

function result(job: Job, fromIdentity: 'projects' | 'visual'): SendOutreachEmailResult {
  if (job.status !== 'sent' || !job.snapshot) {
    throw new Error(`Email status: ${job.status}. Delivery is not confirmed. Do not retry or create another send; inspect its status.${job.id ? ` Job: ${job.id}` : ''}`)
  }
  if (job.snapshot.fromIdentity !== fromIdentity || job.snapshot.from !== `${fromIdentity}@iobjectm.com`) {
    throw new Error('Email sender status mismatch. Stop and inspect the recorded job.')
  }
  return { ok: true, messageId: job.messageId || null, storedMessageId: job.storedMessageId || null,
    from: job.snapshot.from, fromIdentity, to: job.snapshot.to,
    inReplyTo: job.snapshot.inReplyTo || null, references: job.snapshot.references || null }
}

export async function sendReviewedStaffEmail(
  input: SendOutreachEmailInput, token: string, ownerId: string,
): Promise<SendOutreachEmailResult> {
  if (!input.leadId) throw new Error('A CRM lead is required for reviewed sending.')
  const fromIdentity = input.fromIdentity
  if (fromIdentity !== 'projects' && fromIdentity !== 'visual') throw new Error('Sender is not enabled for reviewed sending.')
  if (!navigator.locks) throw new Error('This browser cannot safely coordinate reviewed sending across tabs.')
  // Hash only identifies this local intent. Server authority comes solely from the
  // authenticated immutable review, never from this hash or browser storage.
  const normalized = {
    leadId: input.leadId, kind: input.reviewKind || 'followup', fromIdentity,
    to: input.to.trim().toLowerCase(), subject: input.subject.trim(), body: input.body.trim(),
    inReplyTo: input.inReplyTo || '', references: input.references || '',
    attachments: (input.attachments || []).map(a => ({
      filename: a.filename, contentType: a.contentType, content: a.content,
    })),
  }
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(normalized)))
  const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
  const storageKey = `crm-reviewed-email:${ownerId}:${fingerprint}`
  return navigator.locks.request(storageKey, async () => {
    const saved = localStorage.getItem(storageKey)
    const pending: Pending = saved ? JSON.parse(saved) as Pending
      : { intent: crypto.randomUUID(), key: crypto.randomUUID(), confirmed: false }
    if (!pending.intent || !pending.key || typeof pending.confirmed !== 'boolean') throw new Error('Invalid local email status. Stop and inspect before sending.')
    localStorage.setItem(storageKey, JSON.stringify(pending))
    if (pending.confirmed) {
      return result(await api<Job>(token, 'get_staff_email_status', { idempotencyKey: pending.key }), fromIdentity)
    }
    const kind = input.reviewKind || 'followup'
    const review = await api<Review>(token, 'preview_staff_email', {
      kind, leadId: input.leadId, to: normalized.to, fromIdentity,
      ...(kind === 'followup' ? { messageIntentId: pending.intent, subject: normalized.subject, body: normalized.body } : {}),
      ...(input.inReplyTo ? { inReplyTo: input.inReplyTo, references: input.references || '' } : {}),
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    })
    if (review.snapshot.to !== normalized.to || review.snapshot.fromIdentity !== fromIdentity ||
      review.snapshot.from !== `${fromIdentity}@iobjectm.com` ||
      review.snapshot.subject !== normalized.subject || review.snapshot.body !== normalized.body) {
      throw new Error('The saved CRM draft changed. Review the current draft before sending.')
    }
    if (!await showReviewedEmail(review)) throw new Error('Email cancelled before sending.')
    // Persist before POST. On loss of acknowledgement, every subsequent action
    // for this intent reads status; it never silently generates a new send key.
    pending.confirmed = true
    localStorage.setItem(storageKey, JSON.stringify(pending))
    let job: Job
    try {
      job = await api<Job>(token, 'confirm_staff_email', {
        reviewId: review.id, digest: review.digest, idempotencyKey: pending.key, confirmed: true,
      })
    } catch {
      try {
        job = await api<Job>(token, 'get_staff_email_status', { idempotencyKey: pending.key })
      } catch {
        throw new Error(`Email delivery is unconfirmed. Do not resend. Keep this status key: ${pending.key}`)
      }
    }
    return result(job, fromIdentity)
  })
}
