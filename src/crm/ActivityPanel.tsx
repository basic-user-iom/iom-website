import { useEffect, useState, type FormEvent } from 'react'
import { createActivity, deleteActivity, listActivities } from './api'
import { ACTIVITY_TYPE_VALUES, useCrmI18n } from './i18n'
import type { Activity, ActivityType } from './types'

interface ActivityPanelProps {
  leadId: string
}

export function ActivityPanel({ leadId }: ActivityPanelProps) {
  const { t, activityLabel, locale } = useCrmI18n()
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [type, setType] = useState<ActivityType>('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  const formatWhen = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listActivities(leadId))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('act.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [leadId])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!subject.trim()) return
    setBusy(true)
    setError('')
    try {
      await createActivity({
        lead_id: leadId,
        type,
        subject: subject.trim(),
        body: body.trim(),
        occurred_at: new Date().toISOString(),
      })
      setSubject('')
      setBody('')
      setType('note')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('act.logFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('act.deleteConfirm'))) return
    try {
      await deleteActivity(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('act.deleteFailed'))
    }
  }

  return (
    <section className="crm-activities">
      <h3 className="crm-panel-title">{t('act.title')}</h3>
      <p className="crm-panel-blurb">{t('act.blurb')}</p>

      <form className="crm-form crm-activity-form" onSubmit={handleAdd}>
        <div className="crm-form-grid crm-form-grid--compact">
          <label className="crm-field">
            <span className="crm-label">{t('act.type')}</span>
            <select
              className="crm-input"
              value={type}
              onChange={(e) => setType(e.target.value as ActivityType)}
              disabled={busy}
            >
              {ACTIVITY_TYPE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {activityLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field crm-field--span2">
            <span className="crm-label">{t('act.subject')}</span>
            <input
              className="crm-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              disabled={busy}
              placeholder={t('act.subjectPlaceholder')}
            />
          </label>
        </div>
        <label className="crm-field">
          <span className="crm-label">{t('act.details')}</span>
          <textarea
            className="crm-input crm-textarea"
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={busy}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('act.logging') : t('act.log')}
        </button>
      </form>

      {error && (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="crm-muted">{t('act.loading')}</p>
      ) : items.length === 0 ? (
        <p className="crm-muted">{t('act.empty')}</p>
      ) : (
        <ul className="crm-activity-list">
          {items.map((a) => (
            <li key={a.id} className="crm-activity-item">
              <div className="crm-activity-meta">
                <span className={`crm-activity-type crm-activity-type--${a.type}`}>
                  {activityLabel(a.type)}
                </span>
                <time dateTime={a.occurred_at}>{formatWhen(a.occurred_at)}</time>
              </div>
              <strong className="crm-activity-subject">{a.subject}</strong>
              {a.body && <p className="crm-activity-body">{a.body}</p>}
              <button
                type="button"
                className="crm-link-btn"
                onClick={() => void handleDelete(a.id)}
              >
                {t('act.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
