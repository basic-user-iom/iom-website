import { useEffect, useState, type FormEvent } from 'react'
import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
} from './api'
import { ACTIVITY_TYPE_VALUES, useCrmI18n } from './i18n'
import type { Activity, ActivityType } from './types'

interface ActivityPanelProps {
  leadId: string
  /** Bump to reload the activity list (e.g. after CRM email send). */
  refreshToken?: number
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string {
  if (!value.trim()) return new Date().toISOString()
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return new Date().toISOString()
  return d.toISOString()
}

export function ActivityPanel({ leadId, refreshToken = 0 }: ActivityPanelProps) {
  const { t, activityLabel, locale } = useCrmI18n()
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [type, setType] = useState<ActivityType>('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editType, setEditType] = useState<ActivityType>('note')
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editWhen, setEditWhen] = useState('')
  const [editBusy, setEditBusy] = useState(false)

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
  }, [leadId, refreshToken])

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

  const startEdit = (activity: Activity) => {
    setEditingId(activity.id)
    setEditType(activity.type)
    setEditSubject(activity.subject)
    setEditBody(activity.body)
    setEditWhen(toDatetimeLocalValue(activity.occurred_at))
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditSubject('')
    setEditBody('')
    setEditWhen('')
  }

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingId || !editSubject.trim()) return
    setEditBusy(true)
    setError('')
    try {
      await updateActivity(editingId, {
        type: editType,
        subject: editSubject.trim(),
        body: editBody.trim(),
        occurred_at: fromDatetimeLocalValue(editWhen),
      })
      cancelEdit()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('act.editFailed'))
    } finally {
      setEditBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('act.deleteConfirm'))) return
    try {
      await deleteActivity(id)
      if (editingId === id) cancelEdit()
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
              {editingId === a.id ? (
                <form className="crm-form crm-activity-edit" onSubmit={handleSaveEdit}>
                  <div className="crm-form-grid crm-form-grid--compact">
                    <label className="crm-field">
                      <span className="crm-label">{t('act.type')}</span>
                      <select
                        className="crm-input"
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as ActivityType)}
                        disabled={editBusy}
                      >
                        {ACTIVITY_TYPE_VALUES.map((value) => (
                          <option key={value} value={value}>
                            {activityLabel(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="crm-field">
                      <span className="crm-label">{t('act.when')}</span>
                      <input
                        className="crm-input"
                        type="datetime-local"
                        value={editWhen}
                        onChange={(e) => setEditWhen(e.target.value)}
                        disabled={editBusy}
                        required
                      />
                    </label>
                    <label className="crm-field crm-field--span2">
                      <span className="crm-label">{t('act.subject')}</span>
                      <input
                        className="crm-input"
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        required
                        disabled={editBusy}
                      />
                    </label>
                  </div>
                  <label className="crm-field">
                    <span className="crm-label">{t('act.details')}</span>
                    <textarea
                      className="crm-input crm-textarea"
                      rows={3}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      disabled={editBusy}
                    />
                  </label>
                  <div className="crm-activity-item-actions">
                    <button type="submit" className="btn btn-primary" disabled={editBusy}>
                      {editBusy ? t('act.saving') : t('act.save')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={editBusy}
                      onClick={cancelEdit}
                    >
                      {t('act.cancel')}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="crm-activity-meta">
                    <span className={`crm-activity-type crm-activity-type--${a.type}`}>
                      {activityLabel(a.type)}
                    </span>
                    <time dateTime={a.occurred_at}>{formatWhen(a.occurred_at)}</time>
                  </div>
                  <strong className="crm-activity-subject">{a.subject}</strong>
                  {a.body && <p className="crm-activity-body">{a.body}</p>}
                  <div className="crm-activity-item-actions">
                    <button
                      type="button"
                      className="crm-link-btn"
                      onClick={() => startEdit(a)}
                    >
                      {t('act.edit')}
                    </button>
                    <button
                      type="button"
                      className="crm-link-btn"
                      onClick={() => void handleDelete(a.id)}
                    >
                      {t('act.delete')}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
