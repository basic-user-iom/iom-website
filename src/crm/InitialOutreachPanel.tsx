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
import {
  OUTREACH_FROM_IDENTITIES,
  readStoredOutreachFrom,
  writeStoredOutreachFrom,
  type OutreachFromIdentityId,
} from './outreachFromIdentities'
import { renderOutreachEmailHtml } from './outreachEmailHtml'
import { persistOutboundMessage } from './persistOutboundMessage'
import { formatClientLocalTime } from './clientWeather'
import {
  buildScheduledSend,
  formatInContactZone,
  isScheduledSendArmed,
  leadContactPlaceLabel,
  leadContactTimeZone,
  normalizeScheduledSend,
  scheduleIsoToPickerValue,
  schedulePickerValueToIso,
} from './scheduledSend'
import { sendOutreachEmail } from './sendOutreachEmail'
import { useLiveCrmBackend } from './supabaseClient'
import { isValidIanaTimezone } from './timezones'
import type { Lead, LeadInput } from './types'

interface InitialOutreachPanelProps {
  lead: Lead
  onChanged: (updated?: Lead) => void
  schemaMissing?: boolean
}

type SendMode = 'initial' | 'resend'

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
  const [showHtmlPreview, setShowHtmlPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [subject, setSubject] = useState(lead.initial_email_subject)
  const [body, setBody] = useState(lead.initial_email_body)
  const previewFrameRef = useRef<HTMLIFrameElement>(null)
  const recipients = useMemo(() => collectRecipients(lead), [lead])
  const [toEmail, setToEmail] = useState(recipients[0]?.value ?? '')
  const [fromIdentity, setFromIdentity] = useState<OutreachFromIdentityId>(() =>
    readStoredOutreachFrom(),
  )
  const schedule = normalizeScheduledSend(lead.scheduled_send)
  const scheduledArmed = isScheduledSendArmed(lead)
  const contactTz = leadContactTimeZone(lead)
  const contactPlace = leadContactPlaceLabel(lead)
  const hasContactTz = isValidIanaTimezone(contactTz)
  const [scheduleAtLocal, setScheduleAtLocal] = useState(() =>
    schedule
      ? scheduleIsoToPickerValue(schedule.at, hasContactTz ? contactTz : null)
      : '',
  )
  const [contactNow, setContactNow] = useState(() => new Date())
  const fromMeta =
    OUTREACH_FROM_IDENTITIES.find((i) => i.id === fromIdentity) ??
    OUTREACH_FROM_IDENTITIES[0]

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
    const next = normalizeScheduledSend(lead.scheduled_send)
    setScheduleAtLocal(
      next
        ? scheduleIsoToPickerValue(next.at, hasContactTz ? contactTz : null)
        : '',
    )
  }, [lead.id, lead.scheduled_send, contactTz, hasContactTz])

  useEffect(() => {
    if (!hasContactTz) return
    setContactNow(new Date())
    const id = window.setInterval(() => setContactNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [hasContactTz, lead.id])

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

  const formatContactWhen = (iso: string | null): string => {
    if (!iso) return '—'
    if (!hasContactTz) return formatWhen(iso)
    return formatInContactZone(iso, contactTz, locale)
  }

  const contactNowLabel = hasContactTz
    ? formatClientLocalTime(contactNow, contactTz, locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : ''

  const schedulePreviewIso = scheduleAtLocal
    ? schedulePickerValueToIso(scheduleAtLocal, hasContactTz ? contactTz : null)
    : null

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
    const patch: Partial<LeadInput> = {
      initial_email_sent_at: stamp,
      contact_priority: false,
      scheduled_send: null,
    }
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

  const handleMarkNotSent = async () => {
    if (!confirm(t('outreach.notSentConfirm'))) return
    setError('')
    setBusy(true)
    try {
      const updated = await updateLead(lead.id, { initial_email_sent_at: null })
      onChanged(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('outreach.markFailed'))
    } finally {
      setBusy(false)
    }
  }

  const sendViaCrm = async (mode: SendMode) => {
    const to = toEmail.trim()
    const subj = lead.initial_email_subject.trim()
    const text = lead.initial_email_body.trim()

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
        : 'outreach.sendDemoConfirm'
      : mode === 'resend'
        ? 'outreach.resendConfirm'
        : 'outreach.sendConfirm'
    if (!confirm(t(confirmKey, { email: to, from: fromMeta.email }))) return

    setError('')
    setBusy(true)
    try {
      const result = await sendOutreachEmail({
        to,
        subject: subj,
        body: text,
        leadId: lead.id,
        fromIdentity,
      })

      await persistOutboundMessage({
        leadId: lead.id,
        subject: subj,
        body: text,
        bodyHtml: renderOutreachEmailHtml({ subject: subj, body: text }),
        sendResult: result,
        alreadyStored: !!result.storedMessageId,
      })

      const stamp = new Date().toISOString()
      if (mode === 'resend') {
        const updated = await updateLead(lead.id, {
          initial_email_sent_at: stamp,
          contact_priority: false,
          scheduled_send: null,
        })
        await logEmailActivity(
          subj,
          t('outreach.resendActivityBody', {
            email: to,
            from: fromMeta.email,
          }),
          stamp,
        )
        onChanged(updated)
      } else {
        await markSentLocally(
          t('outreach.sentViaCrmActivityBody', { from: fromMeta.email }),
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
    sendUiOk && !!toEmail.trim() && hasInitialEmailDraft(lead)

  const handleScheduleSend = async () => {
    const to = toEmail.trim()
    const subj = lead.initial_email_subject.trim()
    const text = lead.initial_email_body.trim()
    if (!to || !subj || !text) {
      setError(t('outreach.sendMissing'))
      return
    }
    if (!hasContactTz) {
      setError(t('outreach.scheduleNeedTimezone'))
      return
    }
    const iso = schedulePickerValueToIso(scheduleAtLocal, contactTz)
    if (!iso) {
      setError(t('outreach.scheduleInvalid'))
      return
    }
    if (new Date(iso).getTime() <= Date.now() - 30_000) {
      setError(t('outreach.schedulePast'))
      return
    }
    const whenContact = formatContactWhen(iso)
    const whenYours = formatWhen(iso)
    if (
      !confirm(
        t('outreach.scheduleConfirm', {
          email: to,
          when: whenContact,
          tz: contactTz,
          whenYours,
        }),
      )
    ) {
      return
    }
    setError('')
    setBusy(true)
    try {
      const updated = await updateLead(lead.id, {
        scheduled_send: buildScheduledSend({
          at: iso,
          to,
          from: fromIdentity,
        }),
        initial_email_drafted_at:
          lead.initial_email_drafted_at || new Date().toISOString(),
      })
      onChanged(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('outreach.scheduleFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleCancelSchedule = async () => {
    if (!confirm(t('outreach.scheduleCancelConfirm'))) return
    setError('')
    setBusy(true)
    try {
      const updated = await updateLead(lead.id, { scheduled_send: null })
      onChanged(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('outreach.scheduleFailed'))
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

  // Initial outreach preview: draft fields only (never reply composer).
  const previewSubject = editing
    ? subject.trim()
    : lead.initial_email_subject.trim()
  const previewBody = editing ? body.trim() : lead.initial_email_body.trim()
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

  const fromSelect = (
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
              {sendUiOk && (
                <>
                  {fromSelect}
                  {recipientSelect}
                </>
              )}

              {demoMode && sendUiOk && (
                <p className="crm-muted crm-outreach-demo-note" role="note">
                  {t('outreach.demoSendNote')}
                </p>
              )}

              {!alreadySent && canSendDraft && (
                <div className="crm-outreach-schedule">
                  {hasContactTz ? (
                    <p className="crm-outreach-schedule-clock" role="status">
                      <span className="crm-outreach-schedule-clock-label">
                        {t('outreach.scheduleContactNow')}
                      </span>{' '}
                      <strong>{contactNowLabel}</strong>
                      <span className="crm-muted">
                        {' '}
                        · {contactPlace || contactTz}
                      </span>
                    </p>
                  ) : (
                    <p className="crm-feedback crm-feedback--error" role="status">
                      {t('outreach.scheduleNeedTimezone')}
                    </p>
                  )}

                  {scheduledArmed && schedule ? (
                    <div className="crm-outreach-schedule-armed" role="status">
                      <p>
                        {t('outreach.scheduleArmed', {
                          when: formatContactWhen(schedule.at),
                          email: schedule.to,
                          tz: hasContactTz ? contactTz : t('outreach.scheduleYourTz'),
                        })}
                      </p>
                      {hasContactTz && (
                        <p className="crm-muted crm-outreach-schedule-yours">
                          {t('outreach.scheduleYours', {
                            when: formatWhen(schedule.at),
                          })}
                        </p>
                      )}
                      {schedule.error ? (
                        <p className="crm-outreach-schedule-error">
                          {t('outreach.scheduleError', { error: schedule.error })}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <label className="crm-field crm-outreach-schedule-when">
                      <span className="crm-label">
                        {hasContactTz
                          ? t('outreach.scheduleAtContact', { tz: contactTz })
                          : t('outreach.scheduleAt')}
                      </span>
                      <input
                        type="datetime-local"
                        className="crm-input"
                        value={scheduleAtLocal}
                        disabled={busy || !hasContactTz}
                        onChange={(e) => setScheduleAtLocal(e.target.value)}
                      />
                    </label>
                  )}

                  {!scheduledArmed &&
                    hasContactTz &&
                    schedulePreviewIso &&
                    scheduleAtLocal && (
                      <p className="crm-muted crm-outreach-schedule-preview">
                        {t('outreach.schedulePreview', {
                          when: formatContactWhen(schedulePreviewIso),
                          tz: contactTz,
                          whenYours: formatWhen(schedulePreviewIso),
                        })}
                      </p>
                    )}

                  <p className="crm-muted crm-outreach-schedule-hint">
                    {demoMode
                      ? t('outreach.scheduleDemoHint')
                      : t('outreach.scheduleHint')}
                  </p>
                </div>
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
                    {canSendDraft &&
                      (scheduledArmed ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() => void handleCancelSchedule()}
                        >
                          {t('outreach.scheduleCancel')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busy || !scheduleAtLocal || !hasContactTz}
                          onClick={() => void handleScheduleSend()}
                        >
                          {t('outreach.schedule')}
                        </button>
                      ))}
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

                {alreadySent && (
                  <>
                    {canSendDraft && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => void sendViaCrm('resend')}
                      >
                        {busy ? t('outreach.sending') : t('outreach.resend')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => void handleMarkNotSent()}
                    >
                      {t('outreach.markNotSent')}
                    </button>
                  </>
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
