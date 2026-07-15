import { useState } from 'react'
import { createActivity, updateLead } from './api'
import { copyTextToClipboard } from './formatLeadText'
import { useCrmI18n } from './i18n'
import {
  buildMailtoUrl,
  hasInitialEmailDraft,
  initialEmailPending,
  initialEmailStatus,
} from './outreach'
import type { Lead } from './types'

interface InitialOutreachPanelProps {
  lead: Lead
  onChanged: (updated?: Lead) => void
  schemaMissing?: boolean
}

function formatDraftPreview(body: string, max = 280): string {
  const trimmed = body.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export function InitialOutreachPanel({
  lead,
  onChanged,
  schemaMissing = false,
}: InitialOutreachPanelProps) {
  const { t, locale } = useCrmI18n()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [subject, setSubject] = useState(lead.initial_email_subject)
  const [body, setBody] = useState(lead.initial_email_body)

  const status = initialEmailStatus(lead)
  const pending = initialEmailPending(lead)

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

  const handleMarkSent = async () => {
    if (!confirm(t('outreach.sentConfirm'))) return
    setError('')
    setBusy(true)
    try {
      const stamp = new Date().toISOString()
      const patch: Partial<import('./types').LeadInput> = { initial_email_sent_at: stamp }
      if (!lead.initial_email_drafted_at) {
        patch.initial_email_drafted_at = stamp
      }
      if (lead.status === 'new') {
        patch.status = 'contacted'
      }
      const updated = await updateLead(lead.id, patch)
      await createActivity({
        lead_id: lead.id,
        type: 'email',
        subject: lead.initial_email_subject.trim() || t('outreach.defaultActivitySubject'),
        body: t('outreach.sentActivityBody'),
        occurred_at: stamp,
      })
      onChanged(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('outreach.markFailed'))
    } finally {
      setBusy(false)
    }
  }

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

  const mailto = buildMailtoUrl(
    lead.email,
    editing ? subject : lead.initial_email_subject,
    editing ? body : lead.initial_email_body,
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
              <pre className="crm-outreach-body">{formatDraftPreview(lead.initial_email_body, 2000)}</pre>
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
            <div className="crm-detail-actions crm-outreach-actions">
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
              {!lead.initial_email_sent_at && (
                <>
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
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void handleMarkSent()}
                  >
                    {t('outreach.markSent')}
                  </button>
                </>
              )}
            </div>
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
