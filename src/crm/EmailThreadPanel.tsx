import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createActivity,
  createLeadMessage,
  isLeadMessagesSchemaMissing,
  listLeadMessages,
  normalizeLeadEmails,
  updateLead,
} from './api'
import { isCrmDemoMode } from './demoMode'
import { replyThreadingFromMessages, suggestReplySubject } from './emailThread'
import { useCrmI18n } from './i18n'
import {
  OUTREACH_FROM_IDENTITIES,
  readStoredOutreachFrom,
  writeStoredOutreachFrom,
  type OutreachFromIdentityId,
} from './outreachFromIdentities'
import { renderOutreachEmailHtml } from './outreachEmailHtml'
import { persistOutboundMessage } from './persistOutboundMessage'
import { sendOutreachEmail } from './sendOutreachEmail'
import { useLiveCrmBackend } from './supabaseClient'
import type { Lead, LeadInput, LeadMessage } from './types'

interface EmailThreadPanelProps {
  lead: Lead
  onChanged: (updated?: Lead) => void
  refreshToken?: number
}

function collectRecipients(lead: Lead): { value: string; label: string }[] {
  const seen = new Set<string>()
  const out: { value: string; label: string }[] = []
  const add = (email: string, label: string) => {
    const value = email.trim().toLowerCase()
    if (!value || seen.has(value)) return
    seen.add(value)
    out.push({ value: email.trim(), label })
  }
  if (lead.email.trim()) {
    add(lead.email, lead.contact_name.trim() || 'Primary')
  }
  for (const row of normalizeLeadEmails(lead.emails)) {
    add(row.email, row.label || row.email)
  }
  return out
}

function formatSnippet(body: string, max = 400): string {
  const trimmed = body.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export function EmailThreadPanel({
  lead,
  onChanged,
  refreshToken = 0,
}: EmailThreadPanelProps) {
  const { t, locale } = useCrmI18n()
  const [messages, setMessages] = useState<LeadMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [error, setError] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const previewFrameRef = useRef<HTMLIFrameElement>(null)
  const recipients = useMemo(() => collectRecipients(lead), [lead])
  const [toEmail, setToEmail] = useState(recipients[0]?.value ?? '')
  const [fromIdentity, setFromIdentity] = useState<OutreachFromIdentityId>(() =>
    readStoredOutreachFrom(),
  )
  const fromMeta =
    OUTREACH_FROM_IDENTITIES.find((i) => i.id === fromIdentity) ??
    OUTREACH_FROM_IDENTITIES[0]
  const demoMode = isCrmDemoMode()
  const sendUiOk = demoMode || useLiveCrmBackend()

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await listLeadMessages(lead.id)
      setMessages(rows)
      setSchemaMissing(false)
    } catch (err) {
      if (isLeadMessagesSchemaMissing(err)) {
        setSchemaMissing(true)
        setMessages([])
      } else {
        setError(err instanceof Error ? err.message : t('thread.loadFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [lead.id, refreshToken])

  useEffect(() => {
    const list = collectRecipients(lead)
    if (!list.length) {
      setToEmail('')
      return
    }
    if (!list.some((r) => r.value.toLowerCase() === toEmail.trim().toLowerCase())) {
      setToEmail(list[0].value)
    }
  }, [lead, toEmail])

  const formatWhen = (iso: string): string => {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  const openCompose = () => {
    setComposeOpen(true)
    setShowPreview(false)
    setError('')
    setSubject(suggestReplySubject(messages, lead.initial_email_subject))
    setBody('')
  }

  const closeCompose = () => {
    setComposeOpen(false)
    setShowPreview(false)
    setSubject('')
    setBody('')
    setError('')
  }

  // Preview shows ONLY the reply being composed — never the initial draft.
  const previewSubject = subject.trim()
  const previewBody = body.trim()
  const previewHtml =
    previewSubject && previewBody
      ? renderOutreachEmailHtml({ subject: previewSubject, body: previewBody })
      : ''

  useEffect(() => {
    if (!showPreview || !previewHtml) return
    const frame = previewFrameRef.current
    if (!frame) return

    const fitHeight = () => {
      try {
        const doc = frame.contentDocument
        if (!doc?.body) return
        const h = Math.ceil(
          Math.max(
            doc.body.scrollHeight,
            doc.documentElement?.scrollHeight ?? 0,
          ),
        )
        if (h > 0) frame.style.height = `${h + 8}px`
      } catch {
        /* ignore */
      }
    }

    frame.addEventListener('load', fitHeight)
    fitHeight()
    const t1 = window.setTimeout(fitHeight, 80)
    const t2 = window.setTimeout(fitHeight, 400)
    return () => {
      frame.removeEventListener('load', fitHeight)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [showPreview, previewHtml])

  const canSend =
    sendUiOk &&
    !!toEmail.trim() &&
    !!subject.trim() &&
    !!body.trim() &&
    !schemaMissing

  const handleSendReply = async () => {
    const to = toEmail.trim()
    const subj = subject.trim()
    const text = body.trim()
    if (!to || !subj || !text) {
      setError(t('outreach.sendMissing'))
      return
    }
    if (!demoMode && !useLiveCrmBackend()) {
      setError(t('outreach.sendLiveRequired'))
      return
    }

    const confirmKey = demoMode
      ? 'outreach.additionalDemoConfirm'
      : 'outreach.additionalConfirm'
    if (!confirm(t(confirmKey, { email: to, from: fromMeta.email }))) return

    const threading = replyThreadingFromMessages(messages)
    setError('')
    setBusy(true)
    try {
      const result = await sendOutreachEmail({
        to,
        subject: subj,
        body: text,
        leadId: lead.id,
        fromIdentity,
        inReplyTo: threading.inReplyTo,
        references: threading.references,
      })

      await persistOutboundMessage({
        leadId: lead.id,
        subject: subj,
        body: text,
        bodyHtml: renderOutreachEmailHtml({ subject: subj, body: text }),
        sendResult: result,
        inReplyTo: threading.inReplyTo,
        references: threading.references,
        alreadyStored: !!result.storedMessageId,
      })

      const stamp = new Date().toISOString()
      const patch: Partial<LeadInput> = {}
      if (!lead.initial_email_sent_at) {
        patch.initial_email_sent_at = stamp
        patch.contact_priority = false
      }
      if (!lead.initial_email_drafted_at) patch.initial_email_drafted_at = stamp
      if (lead.status === 'new') patch.status = 'contacted'
      const updated =
        Object.keys(patch).length > 0
          ? await updateLead(lead.id, patch)
          : undefined

      await createActivity({
        lead_id: lead.id,
        type: 'email',
        subject: subj,
        body: t('outreach.additionalActivityBody', {
          email: to,
          from: fromMeta.email,
        }),
        occurred_at: stamp,
      })

      closeCompose()
      await refresh()
      onChanged(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('outreach.sendFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleLogInbound = async () => {
    const from = window.prompt(t('thread.logInboundFromHint'), lead.email.trim())
    if (from == null) return
    const fromEmail = from.trim().toLowerCase()
    if (!fromEmail) return
    const subj = window.prompt(
      t('thread.logInboundSubjectHint'),
      suggestReplySubject(messages, lead.initial_email_subject),
    )
    if (subj == null) return
    const text = window.prompt(t('thread.logInboundBodyHint'), '')
    if (text == null || !text.trim()) return

    setBusy(true)
    setError('')
    try {
      const threading = replyThreadingFromMessages(messages)
      await createLeadMessage({
        lead_id: lead.id,
        direction: 'inbound',
        from_email: fromEmail,
        to_email: fromMeta.email,
        subject: subj.trim() || t('thread.inboundDefaultSubject'),
        body_text: text.trim(),
        body_html: null,
        message_id: `<manual-${Date.now()}@crm.local>`,
        in_reply_to: threading.inReplyTo,
        references_header: threading.references,
        occurred_at: new Date().toISOString(),
      })
      await createActivity({
        lead_id: lead.id,
        type: 'email',
        subject: subj.trim() || t('thread.inboundDefaultSubject'),
        body: t('thread.logInboundActivityBody', { email: fromEmail }),
        occurred_at: new Date().toISOString(),
      })
      await refresh()
      onChanged()
    } catch (err) {
      if (isLeadMessagesSchemaMissing(err)) {
        setSchemaMissing(true)
        setError(t('thread.schemaMissing'))
      } else {
        setError(err instanceof Error ? err.message : t('thread.logFailed'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="crm-offer-block crm-email-thread">
      <div className="crm-outreach-header">
        <h3 className="crm-panel-title">{t('thread.title')}</h3>
        <span className="crm-muted crm-email-thread-count">
          {loading
            ? t('thread.loading')
            : t('thread.count', { n: String(messages.length) })}
        </span>
      </div>
      <p className="crm-panel-blurb">{t('thread.blurb')}</p>

      {schemaMissing && (
        <p className="crm-feedback crm-feedback--error" role="status">
          {t('thread.schemaMissing')}
        </p>
      )}

      {!loading && messages.length === 0 && !schemaMissing && (
        <p className="crm-muted">{t('thread.empty')}</p>
      )}

      {messages.length > 0 && (
        <ul className="crm-email-thread-list">
          {messages.map((msg) => {
            const open = expandedId === msg.id
            return (
              <li
                key={msg.id}
                className={`crm-email-msg crm-email-msg--${msg.direction}`}
              >
                <button
                  type="button"
                  className="crm-email-msg-toggle"
                  onClick={() => setExpandedId(open ? null : msg.id)}
                >
                  <span className="crm-email-msg-dir">
                    {msg.direction === 'outbound'
                      ? t('thread.outbound')
                      : t('thread.inbound')}
                  </span>
                  <span className="crm-email-msg-subject">
                    {msg.subject || t('thread.noSubject')}
                  </span>
                  <span className="crm-email-msg-meta">
                    {msg.direction === 'outbound'
                      ? `${msg.from_email} → ${msg.to_email}`
                      : `${msg.from_email} → ${msg.to_email}`}
                    {' · '}
                    {formatWhen(msg.occurred_at)}
                  </span>
                </button>
                {!open && (
                  <pre className="crm-email-msg-snippet">
                    {formatSnippet(msg.body_text, 180)}
                  </pre>
                )}
                {open && (
                  <div className="crm-email-msg-body">
                    <pre className="crm-outreach-body">{msg.body_text}</pre>
                    {msg.direction === 'outbound' && msg.body_html && (
                      <iframe
                        className="crm-outreach-preview-frame"
                        title={msg.subject}
                        sandbox="allow-same-origin"
                        srcDoc={msg.body_html}
                        scrolling="no"
                      />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {sendUiOk && !schemaMissing && (
        <div className="crm-detail-actions crm-email-thread-actions">
          {!composeOpen ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !recipients.length}
                onClick={openCompose}
              >
                {t('thread.composeReply')}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => void handleLogInbound()}
              >
                {t('thread.logInbound')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={closeCompose}
            >
              {t('form.cancel')}
            </button>
          )}
        </div>
      )}

      {composeOpen && sendUiOk && !schemaMissing && (
        <div className="crm-form crm-outreach-form crm-email-reply-compose">
          <p className="crm-outreach-focus-label">{t('thread.replyTitle')}</p>
          {demoMode && (
            <p className="crm-muted crm-outreach-demo-note" role="note">
              {t('outreach.demoSendNote')}
            </p>
          )}
          <label className="crm-field crm-outreach-from">
            <span className="crm-label">{t('outreach.from')}</span>
            <select
              className="crm-input"
              value={fromIdentity}
              disabled={busy}
              onChange={(e) => {
                const next = e.target.value as OutreachFromIdentityId
                setFromIdentity(next)
                writeStoredOutreachFrom(next)
              }}
            >
              {OUTREACH_FROM_IDENTITIES.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label} ({i.email})
                </option>
              ))}
            </select>
          </label>
          {recipients.length > 0 ? (
            <label className="crm-field crm-outreach-recipient">
              <span className="crm-label">{t('outreach.recipient')}</span>
              <select
                className="crm-input"
                value={toEmail}
                disabled={busy}
                onChange={(e) => setToEmail(e.target.value)}
              >
                {recipients.map((r) => (
                  <option key={r.value.toLowerCase()} value={r.value}>
                    {r.label === r.value ? r.value : `${r.label} — ${r.value}`}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="crm-muted">{t('outreach.noRecipient')}</p>
          )}
          <label className="crm-field">
            <span className="crm-label">{t('outreach.subject')}</span>
            <input
              className="crm-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={busy}
              placeholder={t('outreach.additionalSubjectHint')}
            />
          </label>
          <label className="crm-field">
            <span className="crm-label">{t('outreach.body')}</span>
            <textarea
              className="crm-input crm-textarea"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="crm-detail-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || !previewHtml}
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview
                ? t('outreach.hidePreview')
                : t('outreach.showPreview')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !canSend}
              onClick={() => void handleSendReply()}
            >
              {busy ? t('outreach.sending') : t('thread.sendReply')}
            </button>
          </div>
          {showPreview && previewHtml && (
            <div className="crm-outreach-html-preview">
              <p className="crm-outreach-focus-label">
                {t('outreach.previewTitle')}
              </p>
              <p className="crm-outreach-preview-subject">
                <span className="crm-muted">{t('outreach.subject')}:</span>{' '}
                <strong>{previewSubject}</strong>
              </p>
              <iframe
                ref={previewFrameRef}
                className="crm-outreach-preview-frame"
                title={t('outreach.previewTitle')}
                sandbox="allow-same-origin"
                srcDoc={previewHtml}
                scrolling="no"
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
