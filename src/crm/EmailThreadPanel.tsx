import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createActivity,
  createLeadMessage,
  isLeadMessagesSchemaMissing,
  listLeadMessages,
  normalizeLeadEmails,
  updateLead,
} from './api'
import { formatClientLocalTime } from './clientWeather'
import { isCrmDemoMode } from './demoMode'
import { replyThreadingFromMessages, suggestReplySubject } from './emailThread'
import { useCrmI18n } from './i18n'
import {
  OUTREACH_FROM_IDENTITIES,
  readStoredOutreachFrom,
  writeStoredOutreachFrom,
  type OutreachFromIdentityId,
} from './outreachFromIdentities'
import {
  htmlForLeadMessage,
  renderOutreachEmailHtml,
} from './outreachEmailHtml'
import { persistOutboundMessage } from './persistOutboundMessage'
import { enqueuePingScheduledSends } from './pingScheduledSends'
import {
  buildScheduledSend,
  emptySchedulePickerParts,
  formatInContactZone,
  isInitialScheduleArmed,
  isReplyScheduleArmed,
  isScheduledSendExhausted,
  joinSchedulePickerParts,
  leadContactPlaceLabel,
  leadContactTimeZone,
  normalizeScheduledSend,
  retryScheduledSend,
  sanitizeSchedulePart,
  scheduleIsoToPickerValue,
  schedulePickerValueToIso,
  SCHEDULED_SEND_MAX_ATTEMPTS,
  splitSchedulePickerValue,
  type SchedulePickerParts,
} from './scheduledSend'
import { sendOutreachEmail } from './sendOutreachEmail'
import { useLiveCrmBackend } from './supabaseClient'
import { isValidIanaTimezone } from './timezones'
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

function ThreadHtmlPreview({
  html,
  title,
  interactive = false,
}: {
  html: string
  title: string
  interactive?: boolean
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !html) return

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
  }, [html])

  return (
    <iframe
      ref={frameRef}
      className={
        interactive
          ? 'crm-outreach-preview-frame crm-outreach-preview-frame--thread'
          : 'crm-outreach-preview-frame'
      }
      title={title}
      sandbox="allow-same-origin"
      srcDoc={html}
      scrolling={interactive ? 'auto' : 'no'}
    />
  )
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
  const [previewMessageId, setPreviewMessageId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [pingNote, setPingNote] = useState('')
  const [pingBusy, setPingBusy] = useState(false)
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

  const replySchedule = isReplyScheduleArmed(lead)
    ? normalizeScheduledSend(lead.scheduled_send)
    : null
  const replyScheduledArmed = !!replySchedule
  const replyScheduledExhausted =
    replyScheduledArmed && isScheduledSendExhausted(lead)
  const contactTz = leadContactTimeZone(lead)
  const contactPlace = leadContactPlaceLabel(lead)
  const hasContactTz = isValidIanaTimezone(contactTz)
  const [scheduleParts, setScheduleParts] = useState<SchedulePickerParts>(() =>
    replySchedule
      ? splitSchedulePickerValue(
          scheduleIsoToPickerValue(
            replySchedule.at,
            hasContactTz ? contactTz : null,
          ),
        )
      : emptySchedulePickerParts(),
  )
  const scheduleAtLocal = joinSchedulePickerParts(scheduleParts)
  const [contactNow, setContactNow] = useState(() => new Date())

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

  // Soft refresh so webhook-ingested replies appear without a hard reload.
  useEffect(() => {
    if (demoMode || !useLiveCrmBackend()) return
    const id = window.setInterval(() => {
      void listLeadMessages(lead.id)
        .then((rows) => {
          setMessages(rows)
          setSchemaMissing(false)
        })
        .catch(() => {
          /* ignore background poll errors */
        })
    }, 45_000)
    return () => window.clearInterval(id)
  }, [lead.id, demoMode])

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

  useEffect(() => {
    const next = isReplyScheduleArmed(lead)
      ? normalizeScheduledSend(lead.scheduled_send)
      : null
    setScheduleParts(
      next
        ? splitSchedulePickerValue(
            scheduleIsoToPickerValue(next.at, hasContactTz ? contactTz : null),
          )
        : emptySchedulePickerParts(),
    )
  }, [lead.id, lead.scheduled_send, contactTz, hasContactTz])

  useEffect(() => {
    if (!hasContactTz) return
    setContactNow(new Date())
    const id = window.setInterval(() => setContactNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [hasContactTz, lead.id])

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

  const openCompose = () => {
    setComposeOpen(true)
    setShowPreview(false)
    setError('')
    setPingNote('')
    if (replySchedule?.subject && replySchedule.body) {
      setSubject(replySchedule.subject)
      setBody(replySchedule.body)
      if (replySchedule.to) setToEmail(replySchedule.to)
      if (replySchedule.from) {
        setFromIdentity(replySchedule.from)
        writeStoredOutreachFrom(replySchedule.from)
      }
    } else {
      setSubject(suggestReplySubject(messages, lead.initial_email_subject))
      setBody('')
    }
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

  const canSend =
    sendUiOk &&
    !!toEmail.trim() &&
    !!subject.trim() &&
    !!body.trim() &&
    !schemaMissing

  const reportPing = async () => {
    setPingBusy(true)
    const ping = await enqueuePingScheduledSends()
    if (!ping.ok) {
      setPingNote(t('outreach.pingFailed', { error: ping.error || '—' }))
    } else if (ping.demo) {
      setPingNote(t('outreach.pingDemoOk'))
      onChanged()
    } else if (ping.sent > 0 || ping.failed > 0) {
      setPingNote(
        t('outreach.pingOkSent', {
          sent: ping.sent,
          failed: ping.failed,
          due: ping.due,
        }),
      )
      onChanged()
      await refresh()
    } else {
      setPingNote(
        t('outreach.pingOkQueued', {
          checked: ping.checked,
          when: formatContactWhen(replySchedule?.at || schedulePreviewIso || ''),
        }),
      )
    }
  }

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

      let threadLogged = !!result.storedMessageId
      try {
        const stored = await persistOutboundMessage({
          leadId: lead.id,
          subject: subj,
          body: text,
          bodyHtml: renderOutreachEmailHtml({ subject: subj, body: text }),
          sendResult: result,
          inReplyTo: threading.inReplyTo,
          references: threading.references,
          alreadyStored: !!result.storedMessageId,
        })
        if (stored) threadLogged = true
      } catch {
        threadLogged = !!result.storedMessageId
      }

      if (!threadLogged && !demoMode) {
        setError(t('outreach.persistWarning'))
      }

      const stamp = new Date().toISOString()
      const patch: Partial<LeadInput> = {
        scheduled_send: null,
      }
      if (!lead.initial_email_sent_at) {
        patch.initial_email_sent_at = stamp
        patch.contact_priority = false
      }
      if (!lead.initial_email_drafted_at) patch.initial_email_drafted_at = stamp
      if (lead.status === 'new') patch.status = 'contacted'
      const updated = await updateLead(lead.id, patch)

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

  const handleScheduleReply = async () => {
    const to = toEmail.trim()
    const subj = subject.trim()
    const text = body.trim()
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
    if (isInitialScheduleArmed(lead)) {
      if (!confirm(t('thread.scheduleReplaceConfirm'))) return
    }
    const whenContact = formatContactWhen(iso)
    const whenYours = formatWhen(iso)
    if (
      !confirm(
        t('thread.scheduleConfirm', {
          email: to,
          when: whenContact,
          tz: contactTz,
          whenYours,
        }),
      )
    ) {
      return
    }

    const threading = replyThreadingFromMessages(messages)
    setError('')
    setPingNote('')
    setBusy(true)
    try {
      const updated = await updateLead(lead.id, {
        scheduled_send: buildScheduledSend({
          at: iso,
          to,
          from: fromIdentity,
          kind: 'reply',
          subject: subj,
          body: text,
          inReplyTo: threading.inReplyTo,
          references: threading.references,
        }),
      })
      onChanged(updated)
      await reportPing()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('outreach.scheduleFailed'))
    } finally {
      setBusy(false)
      setPingBusy(false)
    }
  }

  const handleCancelSchedule = async () => {
    if (!confirm(t('thread.scheduleCancelConfirm'))) return
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

  const handleRetrySchedule = async () => {
    if (!replySchedule) return
    if (!confirm(t('outreach.scheduleRetryConfirm'))) return
    setError('')
    setPingNote('')
    setBusy(true)
    try {
      const next = retryScheduledSend(replySchedule)
      const updated = await updateLead(lead.id, { scheduled_send: next })
      onChanged(updated)
      await reportPing()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('outreach.scheduleFailed'))
    } finally {
      setBusy(false)
      setPingBusy(false)
    }
  }

  const handlePingScheduled = async () => {
    setError('')
    setPingNote('')
    try {
      await reportPing()
    } catch (err) {
      setPingNote(
        t('outreach.pingFailedOnly', {
          error: err instanceof Error ? err.message : '—',
        }),
      )
    } finally {
      setPingBusy(false)
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

  const scheduleControls = (
    <div className="crm-outreach-schedule crm-email-reply-schedule">
      <p className="crm-outreach-focus-label">{t('thread.scheduleHeading')}</p>
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

      {replyScheduledArmed && replySchedule ? (
        <div className="crm-outreach-schedule-armed" role="status">
          {replyScheduledExhausted ? (
            <p className="crm-outreach-schedule-exhausted">
              {t('outreach.scheduleExhausted', {
                attempts: String(SCHEDULED_SEND_MAX_ATTEMPTS),
              })}
            </p>
          ) : (
            <p>
              {t('thread.scheduleArmed', {
                when: formatContactWhen(replySchedule.at),
                email: replySchedule.to,
                tz: hasContactTz ? contactTz : t('outreach.scheduleYourTz'),
              })}
            </p>
          )}
          {replySchedule.subject ? (
            <p className="crm-muted">
              {t('thread.scheduledSubject', { subject: replySchedule.subject })}
            </p>
          ) : null}
          {hasContactTz && !replyScheduledExhausted && (
            <p className="crm-muted crm-outreach-schedule-yours">
              {t('outreach.scheduleYours', {
                when: formatWhen(replySchedule.at),
              })}
            </p>
          )}
          {replySchedule.error ? (
            <p className="crm-outreach-schedule-error">
              {t('outreach.scheduleError', { error: replySchedule.error })}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="crm-field crm-outreach-schedule-when">
          <span className="crm-label">
            {hasContactTz
              ? t('outreach.scheduleAtContact', { tz: contactTz })
              : t('outreach.scheduleAt')}
          </span>
          <div
            className="crm-schedule-parts"
            role="group"
            aria-label={
              hasContactTz
                ? t('outreach.scheduleAtContact', { tz: contactTz })
                : t('outreach.scheduleAt')
            }
          >
            <label className="crm-schedule-part">
              <span className="crm-schedule-part-label">
                {t('outreach.scheduleDay')}
              </span>
              <input
                className="crm-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="DD"
                maxLength={2}
                disabled={busy || !hasContactTz}
                value={scheduleParts.day}
                onChange={(e) =>
                  setScheduleParts((prev) => ({
                    ...prev,
                    day: sanitizeSchedulePart('day', e.target.value),
                  }))
                }
              />
            </label>
            <label className="crm-schedule-part">
              <span className="crm-schedule-part-label">
                {t('outreach.scheduleMonth')}
              </span>
              <input
                className="crm-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="MM"
                maxLength={2}
                disabled={busy || !hasContactTz}
                value={scheduleParts.month}
                onChange={(e) =>
                  setScheduleParts((prev) => ({
                    ...prev,
                    month: sanitizeSchedulePart('month', e.target.value),
                  }))
                }
              />
            </label>
            <label className="crm-schedule-part crm-schedule-part--year">
              <span className="crm-schedule-part-label">
                {t('outreach.scheduleYear')}
              </span>
              <input
                className="crm-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="YYYY"
                maxLength={4}
                disabled={busy || !hasContactTz}
                value={scheduleParts.year}
                onChange={(e) =>
                  setScheduleParts((prev) => ({
                    ...prev,
                    year: sanitizeSchedulePart('year', e.target.value),
                  }))
                }
              />
            </label>
            <span className="crm-schedule-parts-sep" aria-hidden="true">
              ·
            </span>
            <label className="crm-schedule-part crm-schedule-part--time">
              <span className="crm-schedule-part-label">
                {t('outreach.scheduleHour')}
              </span>
              <input
                className="crm-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="HH"
                maxLength={2}
                disabled={busy || !hasContactTz}
                value={scheduleParts.hour}
                onChange={(e) =>
                  setScheduleParts((prev) => ({
                    ...prev,
                    hour: sanitizeSchedulePart('hour', e.target.value),
                  }))
                }
              />
            </label>
            <span className="crm-schedule-parts-sep" aria-hidden="true">
              :
            </span>
            <label className="crm-schedule-part crm-schedule-part--time">
              <span className="crm-schedule-part-label">
                {t('outreach.scheduleMinute')}
              </span>
              <input
                className="crm-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="MM"
                maxLength={2}
                disabled={busy || !hasContactTz}
                value={scheduleParts.minute}
                onChange={(e) =>
                  setScheduleParts((prev) => ({
                    ...prev,
                    minute: sanitizeSchedulePart('minute', e.target.value),
                  }))
                }
              />
            </label>
          </div>
          <p className="crm-muted crm-outreach-schedule-format">
            {t('outreach.scheduleFormat')}
          </p>
        </div>
      )}

      {!replyScheduledArmed &&
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
  )

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
            const previewOn = previewMessageId === msg.id
            const formattedHtml = htmlForLeadMessage(msg)
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
                    {`${msg.from_email} → ${msg.to_email}`}
                    {' · '}
                    {formatWhen(msg.occurred_at)}
                  </span>
                </button>
                {!open && !previewOn && (
                  <pre className="crm-email-msg-snippet">
                    {formatSnippet(msg.body_text, 180)}
                  </pre>
                )}
                {open && !previewOn && (
                  <div className="crm-email-msg-body">
                    <pre className="crm-outreach-body">{msg.body_text}</pre>
                  </div>
                )}
                <div className="crm-email-msg-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={!formattedHtml}
                    onClick={() =>
                      setPreviewMessageId(previewOn ? null : msg.id)
                    }
                  >
                    {previewOn
                      ? t('outreach.hidePreview')
                      : t('outreach.showPreview')}
                  </button>
                </div>
                {previewOn && formattedHtml && (
                  <div className="crm-outreach-html-preview">
                    <p className="crm-outreach-focus-label">
                      {t('thread.previewTitle')}
                    </p>
                    <p className="crm-outreach-preview-subject">
                      <span className="crm-muted">{t('outreach.subject')}:</span>{' '}
                      <strong>{msg.subject || t('thread.noSubject')}</strong>
                    </p>
                    <ThreadHtmlPreview
                      html={formattedHtml}
                      title={msg.subject || t('thread.previewTitle')}
                      interactive
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {replyScheduledArmed && replySchedule && !composeOpen && sendUiOk && (
        <div className="crm-outreach-schedule crm-email-thread-schedule">
          <div className="crm-outreach-schedule-armed" role="status">
            {replyScheduledExhausted ? (
              <p className="crm-outreach-schedule-exhausted">
                {t('outreach.scheduleExhausted', {
                  attempts: String(SCHEDULED_SEND_MAX_ATTEMPTS),
                })}
              </p>
            ) : (
              <p>
                {t('thread.scheduleArmed', {
                  when: formatContactWhen(replySchedule.at),
                  email: replySchedule.to,
                  tz: hasContactTz ? contactTz : t('outreach.scheduleYourTz'),
                })}
              </p>
            )}
            {replySchedule.subject ? (
              <p className="crm-muted">
                {t('thread.scheduledSubject', {
                  subject: replySchedule.subject,
                })}
              </p>
            ) : null}
            {hasContactTz && (
              <p className="crm-muted crm-outreach-schedule-yours">
                {t('outreach.scheduleYours', {
                  when: formatWhen(replySchedule.at),
                })}
              </p>
            )}
            {replySchedule.error ? (
              <p className="crm-outreach-schedule-error">
                {t('outreach.scheduleError', { error: replySchedule.error })}
              </p>
            ) : null}
          </div>
          <div className="crm-detail-actions">
            {sendUiOk && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || pingBusy}
                onClick={() => void handlePingScheduled()}
                title={t('outreach.pingTitle')}
              >
                {pingBusy ? t('outreach.pinging') : t('outreach.ping')}
              </button>
            )}
            {replyScheduledExhausted && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || pingBusy}
                onClick={() => void handleRetrySchedule()}
              >
                {t('outreach.scheduleRetry')}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void handleCancelSchedule()}
            >
              {t('outreach.scheduleCancel')}
            </button>
          </div>
        </div>
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

          {scheduleControls}

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
            {replyScheduledArmed ? (
              <>
                {replyScheduledExhausted && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || pingBusy}
                    onClick={() => void handleRetrySchedule()}
                  >
                    {t('outreach.scheduleRetry')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => void handleCancelSchedule()}
                >
                  {t('outreach.scheduleCancel')}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || !canSend || !scheduleAtLocal || !hasContactTz}
                onClick={() => void handleScheduleReply()}
              >
                {t('thread.scheduleReply')}
              </button>
            )}
            {sendUiOk && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || pingBusy}
                onClick={() => void handlePingScheduled()}
                title={t('outreach.pingTitle')}
              >
                {pingBusy ? t('outreach.pinging') : t('outreach.ping')}
              </button>
            )}
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
              <ThreadHtmlPreview
                html={previewHtml}
                title={t('outreach.previewTitle')}
              />
            </div>
          )}
        </div>
      )}

      {(pingBusy || pingNote) && (
        <p className="crm-outreach-ping-note" role="status">
          {pingBusy && !pingNote ? t('outreach.pinging') : pingNote}
        </p>
      )}

      {error && (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
