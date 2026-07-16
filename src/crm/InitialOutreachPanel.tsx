import { useEffect, useMemo, useRef, useState } from 'react'
import { createActivity, normalizeLeadEmails, updateLead } from './api'
import { isCrmDemoMode } from './demoMode'
import { copyTextToClipboard } from './formatLeadText'
import { useCrmI18n } from './i18n'
import {
  buildMailtoUrl,
  hasInitialEmailDraft,
  initialEmailPending,
  initialEmailStatus,
} from './outreach'
import { renderOutreachEmailHtml } from './outreachEmailHtml'
import { sendOutreachEmail } from './sendOutreachEmail'
import { useLiveCrmBackend } from './supabaseClient'
import type { Lead, LeadInput } from './types'

interface InitialOutreachPanelProps {
  lead: Lead
  onChanged: (updated?: Lead) => void
  schemaMissing?: boolean
}

type SendMode = 'initial' | 'resend' | 'additional'

function formatDraftPreview(body: string, max = 280): string {
  const trimmed = body.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
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

export function InitialOutreachPanel({
  lead,
  onChanged,
  schemaMissing = false,
}: InitialOutreachPanelProps) {
  const { t, locale } = useCrmI18n()
  const [editing, setEditing] = useState(false)
  const [composeExtra, setComposeExtra] = useState(false)
  const [showHtmlPreview, setShowHtmlPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [subject, setSubject] = useState(lead.initial_email_subject)
  const [body, setBody] = useState(lead.initial_email_body)
  const [extraSubject, setExtraSubject] = useState('')
  const [extraBody, setExtraBody] = useState('')
  const previewFrameRef = useRef<HTMLIFrameElement>(null)
  const recipients = useMemo(() => collectRecipients(lead), [lead])
  const [toEmail, setToEmail] = useState(recipients[0]?.value ?? '')

  const status = initialEmailStatus(lead)
  const pending = initialEmailPending(lead)
  const alreadySent = !!lead.initial_email_sent_at
  const demoMode = isCrmDemoMode()
  /** Live Proton send, or simulated send in /crm-demo (fake data only). */
  const sendUiOk = demoMode || useLiveCrmBackend()

  useEffect(() => {
    setSubject(lead.initial_email_subject)
    setBody(lead.initial_email_body)
  }, [lead.id, lead.initial_email_subject, lead.initial_email_body])

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

  const formatWhen = (iso: string | null): string => {
    if (!iso) return '—'
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  const statusLabel = () => {
    switch (status) {
      case 'sent':
        return t('outreach.statusSent')
      case 'drafted':
        return t('outreach.statusDrafted')
      case 'pending':
        return t('outreach.statusPending')
      default:
        return t('outreach.statusNone')
    }
  }

  const handleSaveDraft = async () => {
    setError('')
    setBusy(true)
    try {
      const updated = await updateLead(lead.id, {
        initial_email_subject: subject.trim(),
        initial_email_body: body.trim(),
      })
      setEditing(false)
      onChanged(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('outreach.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleMarkDrafted = async () => {
    setError('')
    setBusy(true)
    try {
      const updated = await updateLead(lead.id, {
        initial_email_drafted_at: new Date().toISOString(),
      })
      onChanged(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('outreach.markFailed'))
    } finally {
      setBusy(false)
    }
  }

  const logEmailActivity = async (
    subj: string,
    activityBody: string,
    stamp: string,
  ) => {
    await createActivity({
      lead_id: lead.id,
      type: 'email',
      subject: subj.trim() || t('outreach.defaultActivitySubject'),
      body: activityBody,
      occurred_at: stamp,
    })
  }

  const markSentLocally = async (activityBody: string, emailSubject: string) => {
    const stamp = new Date().toISOString()
    const patch: Partial<LeadInput> = { initial_email_sent_at: stamp }
    if (!lead.initial_email_drafted_at) {
      patch.initial_email_drafted_at = stamp
    }
    if (lead.status === 'new') {
      patch.status = 'contacted'
    }
    const updated = await updateLead(lead.id, patch)
    await logEmailActivity(emailSubject, activityBody, stamp)
    onChanged(updated)
  }

  const handleMarkSent = async () => {
    if (!confirm(t('outreach.sentConfirm'))) return
    setError('')
    setBusy(true)
    try {
      await markSentLocally(
        t('outreach.sentActivityBody'),
        lead.initial_email_subject,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : t('outreach.markFailed'))
    } finally {
      setBusy(false)
    }
  }

  const sendViaCrm = async (mode: SendMode) => {
    const to = toEmail.trim()
    const subj =
      mode === 'additional'
        ? extraSubject.trim()
        : lead.initial_email_subject.trim()
    const text =
      mode === 'additional' ? extraBody.trim() : lead.initial_email_body.trim()

    if (!to || !subj || !text) {
      setError(t('outreach.sendMissing'))
      return
    }
    if (!demoMode && !useLiveCrmBackend()) {
      setError(t('outreach.sendLiveRequired'))
      return
    }

    const confirmKey = demoMode
      ? mode === 'resend'
        ? 'outreach.resendDemoConfirm'
        : mode === 'additional'
          ? 'outreach.additionalDemoConfirm'
          : 'outreach.sendDemoConfirm'
      : mode === 'resend'
        ? 'outreach.resendConfirm'
        : mode === 'additional'
          ? 'outreach.additionalConfirm'
          : 'outreach.sendConfirm'
    if (!confirm(t(confirmKey, { email: to }))) return

    setError('')
    setBusy(true)
    try {
      await sendOutreachEmail({
        to,
        subject: subj,
        body: text,
        leadId: lead.id,
      })

      const stamp = new Date().toISOString()
      if (mode === 'additional') {
        const patch: Partial<LeadInput> = {}
        if (!lead.initial_email_sent_at) patch.initial_email_sent_at = stamp
        if (!lead.initial_email_drafted_at) patch.initial_email_drafted_at = stamp
        if (lead.status === 'new') patch.status = 'contacted'
        const updated =
          Object.keys(patch).length > 0
            ? await updateLead(lead.id, patch)
            : undefined
        await logEmailActivity(
          subj,
          t('outreach.additionalActivityBody', { email: to }),
          stamp,
        )
        setComposeExtra(false)
        setExtraSubject('')
        setExtraBody('')
        onChanged(updated)
      } else if (mode === 'resend') {
        const updated = await updateLead(lead.id, {
          initial_email_sent_at: stamp,
        })
        await logEmailActivity(
          subj,
          t('outreach.resendActivityBody', { email: to }),
          stamp,
        )
        onChanged(updated)
      } else {
        await markSentLocally(
          t('outreach.sentViaCrmActivityBody'),
          subj,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('outreach.sendFailed'))
    } finally {
      setBusy(false)
    }
  }

  const canSendDraft =
    sendUiOk &&
    !!toEmail.trim() &&
    hasInitialEmailDraft(lead)

  const canSendAdditional =
    sendUiOk &&
    !!toEmail.trim() &&
    !!extraSubject.trim() &&
    !!extraBody.trim()

  const handleCopy = async () => {
    setError('')
    try {
      const text = `${lead.initial_email_subject.trim()}\n\n${lead.initial_email_body.trim()}`
      await copyTextToClipboard(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('detail.copyFailed'))
    }
  }

  const previewSubject = composeExtra
    ? extraSubject.trim() || lead.initial_email_subject.trim()
    : editing
      ? subject.trim()
      : lead.initial_email_subject.trim()
  const previewBody = composeExtra
    ? extraBody.trim() || lead.initial_email_body.trim()
    : editing
      ? body.trim()
      : lead.initial_email_body.trim()
  const previewHtml =
    previewSubject && previewBody
      ? renderOutreachEmailHtml({ subject: previewSubject, body: previewBody })
      : ''

  useEffect(() => {
    if (!showHtmlPreview || !previewHtml) return
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
        /* cross-origin / sandbox — keep CSS fallback height */
      }
    }

    frame.addEventListener('load', fitHeight)
    // srcDoc may already be loaded when effect runs
    fitHeight()
    const t1 = window.setTimeout(fitHeight, 80)
    const t2 = window.setTimeout(fitHeight, 400)
    return () => {
      frame.removeEventListener('load', fitHeight)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [showHtmlPreview, previewHtml])

  const mailto = buildMailtoUrl(
    toEmail || lead.email,
    editing ? subject : lead.initial_email_subject,
    editing ? body : lead.initial_email_body,
  )

  const recipientSelect =
    recipients.length > 0 ? (
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
    )

  return (
    <section className="crm-offer-block crm-outreach">
      <div className="crm-outreach-header">
        <h3 className="crm-panel-title">{t('outreach.title')}</h3>
        <span className={`crm-outreach-status crm-outreach-status--${status}`}>
          {statusLabel()}
        </span>
      </div>

      {schemaMissing && (
        <p className="crm-feedback crm-feedback--error" role="status">
          {t('error.outreachSchemaMissing')}
        </p>
      )}

      {pending && (
        <p className="crm-outreach-alert" role="status">
          {t('outreach.pendingAlert')}
        </p>
      )}

      {lead.contact_role?.trim() && (
        <p className="crm-muted crm-outreach-meta">
          {t('outreach.contactRole')}: <strong>{lead.contact_role}</strong>
        </p>
      )}

      {lead.company_focus?.trim() && (
        <div className="crm-outreach-focus">
          <p className="crm-outreach-focus-label">{t('outreach.companyFocus')}</p>
          <p className="crm-offer-text">{lead.company_focus}</p>
        </div>
      )}

      {hasInitialEmailDraft(lead) || editing ? (
        <>
          {editing ? (
            <div className="crm-form crm-outreach-form">
              <label className="crm-field">
                <span className="crm-label">{t('outreach.subject')}</span>
                <input
                  className="crm-input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={busy}
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
                  className="btn btn-primary"
                  disabled={busy || !subject.trim() || !body.trim()}
                  onClick={() => void handleSaveDraft()}
                >
                  {busy ? t('form.saving') : t('outreach.saveDraft')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    setEditing(false)
                    setSubject(lead.initial_email_subject)
                    setBody(lead.initial_email_body)
                  }}
                >
                  {t('form.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="crm-outreach-subject">
                <span className="crm-muted">{t('outreach.subject')}:</span>{' '}
                <strong>{lead.initial_email_subject}</strong>
              </p>
              {!showHtmlPreview && (
                <pre className="crm-outreach-body">
                  {formatDraftPreview(lead.initial_email_body, 2000)}
                </pre>
              )}
              {(lead.initial_email_drafted_at || lead.initial_email_sent_at) && (
                <dl className="crm-facts crm-facts--compact">
                  <div>
                    <dt>{t('outreach.draftedAt')}</dt>
                    <dd>{formatWhen(lead.initial_email_drafted_at)}</dd>
                  </div>
                  <div>
                    <dt>{t('outreach.sentAt')}</dt>
                    <dd>{formatWhen(lead.initial_email_sent_at)}</dd>
                  </div>
                </dl>
              )}
            </>
          )}

          {!editing && (
            <>
              {sendUiOk && recipientSelect}

              {demoMode && sendUiOk && (
                <p className="crm-muted crm-outreach-demo-note" role="note">
                  {t('outreach.demoSendNote')}
                </p>
              )}

              <div className="crm-detail-actions crm-outreach-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy || !previewHtml}
                  onClick={() => setShowHtmlPreview((v) => !v)}
                >
                  {showHtmlPreview
                    ? t('outreach.hidePreview')
                    : t('outreach.showPreview')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => void handleCopy()}
                >
                  {copied ? t('detail.copied') : t('outreach.copyEmail')}
                </button>
                {mailto && (
                  <a className="btn btn-ghost" href={mailto}>
                    {t('outreach.openMail')}
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => setEditing(true)}
                >
                  {t('detail.edit')}
                </button>

                {!alreadySent && (
                  <>
                    {canSendDraft && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => void sendViaCrm('initial')}
                      >
                        {busy ? t('outreach.sending') : t('outreach.sendFromCrm')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => void handleMarkDrafted()}
                    >
                      {t('outreach.markDrafted')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => void handleMarkSent()}
                    >
                      {t('outreach.markSent')}
                    </button>
                  </>
                )}

                {alreadySent && canSendDraft && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void sendViaCrm('resend')}
                  >
                    {busy ? t('outreach.sending') : t('outreach.resend')}
                  </button>
                )}

                {sendUiOk && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => {
                      setComposeExtra((v) => !v)
                      setError('')
                    }}
                  >
                    {composeExtra
                      ? t('form.cancel')
                      : t('outreach.composeAdditional')}
                  </button>
                )}
              </div>

              {showHtmlPreview && previewHtml && (
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

              {composeExtra && sendUiOk && (
                <div className="crm-form crm-outreach-form crm-outreach-additional">
                  <p className="crm-outreach-focus-label">
                    {t('outreach.additionalTitle')}
                  </p>
                  {recipientSelect}
                  <label className="crm-field">
                    <span className="crm-label">{t('outreach.subject')}</span>
                    <input
                      className="crm-input"
                      value={extraSubject}
                      onChange={(e) => setExtraSubject(e.target.value)}
                      disabled={busy}
                      placeholder={t('outreach.additionalSubjectHint')}
                    />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">{t('outreach.body')}</span>
                    <textarea
                      className="crm-input crm-textarea"
                      rows={8}
                      value={extraBody}
                      onChange={(e) => setExtraBody(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <div className="crm-detail-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy || !canSendAdditional}
                      onClick={() => void sendViaCrm('additional')}
                    >
                      {busy
                        ? t('outreach.sending')
                        : t('outreach.sendAdditional')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setEditing(true)}
        >
          {t('outreach.addDraft')}
        </button>
      )}

      {error && (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
