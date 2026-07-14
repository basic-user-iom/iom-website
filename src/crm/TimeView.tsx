import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCrmI18n } from './i18n'
import type { CrmProject, CrmUser, TimeEntry } from './types'
import {
  createManualTimeEntry,
  deleteTimeEntry,
  formatDuration,
  getRunningTimer,
  listProjects,
  listTimeEntries,
  reportTimeByDay,
  reportTimeByProject,
  reportTimeByUser,
  startTimer,
  stopTimer,
} from './workspaceApi'

interface TimeViewProps {
  user: CrmUser
  initialProjectId?: string | null
}

export function TimeView({ user, initialProjectId = null }: TimeViewProps) {
  const { t, locale } = useCrmI18n()
  const [projects, setProjects] = useState<CrmProject[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [running, setRunning] = useState<TimeEntry | null>(null)
  const [projectId, setProjectId] = useState(initialProjectId ?? '')
  const [notes, setNotes] = useState('')
  const [manualHours, setManualHours] = useState('1')
  const [manualNotes, setManualNotes] = useState('')
  const [manualProjectId, setManualProjectId] = useState(initialProjectId ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [reportMode, setReportMode] = useState<'project' | 'user' | 'day'>(
    'project',
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [projRows, entryRows, timer] = await Promise.all([
        listProjects(),
        listTimeEntries(),
        getRunningTimer(),
      ])
      setProjects(projRows)
      setEntries(entryRows)
      setRunning(timer)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('time.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (initialProjectId) {
      setProjectId(initialProjectId)
      setManualProjectId(initialProjectId)
    }
  }, [initialProjectId])

  useEffect(() => {
    if (!running || running.ended_at) return
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [running])

  const runningSeconds =
    running && !running.ended_at
      ? Math.floor((Date.now() - new Date(running.started_at).getTime()) / 1000) +
        tick * 0
      : 0

  const reportRows = useMemo(() => {
    if (reportMode === 'user') return reportTimeByUser(entries)
    if (reportMode === 'day') return reportTimeByDay(entries)
    return reportTimeByProject(entries, projects)
  }, [entries, projects, reportMode])

  const handleStart = async () => {
    setError('')
    try {
      const entry = await startTimer({
        project_id: projectId || null,
        task_id: null,
        notes,
      })
      setRunning(entry)
      setNotes('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('time.timerFailed'))
    }
  }

  const handleStop = async () => {
    if (!running) return
    setError('')
    try {
      await stopTimer(running.id)
      setRunning(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('time.timerFailed'))
    }
  }

  const handleManual = async () => {
    const hours = Number(manualHours)
    if (!Number.isFinite(hours) || hours <= 0) {
      setError(t('time.invalidHours'))
      return
    }
    const ended = new Date()
    const started = new Date(ended.getTime() - hours * 3600 * 1000)
    setError('')
    try {
      await createManualTimeEntry({
        project_id: manualProjectId || null,
        task_id: null,
        notes: manualNotes,
        started_at: started.toISOString(),
        ended_at: ended.toISOString(),
        duration_seconds: Math.round(hours * 3600),
      })
      setManualNotes('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('time.manualFailed'))
    }
  }

  return (
    <div className="crm-tool-panel">
      <div className="crm-time-grid">
        <section className="crm-offer-block">
          <h2 className="crm-panel-title">{t('time.timerTitle')}</h2>
          <p className="crm-muted">{t('time.timerBlurb')}</p>
          {running && !running.ended_at ? (
            <div className="crm-timer-live">
              <span className="crm-timer-live-value">
                {formatDuration(runningSeconds)}
              </span>
              <span className="crm-muted">
                {running.notes ||
                  projects.find((p) => p.id === running.project_id)?.name ||
                  t('time.noProject')}
              </span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleStop()}
              >
                {t('time.stop')}
              </button>
            </div>
          ) : (
            <div className="crm-form-stack">
              <label className="crm-field">
                <span>{t('nav.projects')}</span>
                <select
                  className="crm-input"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">{t('time.noProject')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="crm-field">
                <span>{t('act.details')}</span>
                <input
                  className="crm-input"
                  value={notes}
                  placeholder={t('time.notesPlaceholder')}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleStart()}
              >
                {t('time.start')}
              </button>
            </div>
          )}
        </section>

        <section className="crm-offer-block">
          <h2 className="crm-panel-title">{t('time.manualTitle')}</h2>
          <div className="crm-form-stack">
            <label className="crm-field">
              <span>{t('nav.projects')}</span>
              <select
                className="crm-input"
                value={manualProjectId}
                onChange={(e) => setManualProjectId(e.target.value)}
              >
                <option value="">{t('time.noProject')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="crm-field">
              <span>{t('time.hours')}</span>
              <input
                className="crm-input"
                type="number"
                min="0.25"
                step="0.25"
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value)}
              />
            </label>
            <label className="crm-field">
              <span>{t('act.details')}</span>
              <input
                className="crm-input"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleManual()}
            >
              {t('time.addManual')}
            </button>
          </div>
        </section>
      </div>

      {error && (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      )}

      <section className="crm-offer-block">
        <div className="crm-detail-header">
          <h2 className="crm-panel-title">{t('time.reports')}</h2>
          <div className="crm-detail-actions">
            {(['project', 'user', 'day'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`btn btn-ghost${reportMode === mode ? ' is-active-tab' : ''}`}
                onClick={() => setReportMode(mode)}
              >
                {t(`time.by${mode[0].toUpperCase()}${mode.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>
        {reportRows.length === 0 ? (
          <p className="crm-muted">{t('time.noReport')}</p>
        ) : (
          <ul className="crm-report-list">
            {reportRows.map((row) => (
              <li key={row.key}>
                <span>{row.label}</span>
                <strong>{formatDuration(row.seconds)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="crm-offer-block">
        <h2 className="crm-panel-title">{t('time.entries')}</h2>
        {loading ? (
          <p className="crm-muted">{t('time.loading')}</p>
        ) : entries.length === 0 ? (
          <p className="crm-muted">{t('time.empty')}</p>
        ) : (
          <ul className="crm-activity-list">
            {entries.map((e) => {
              const projectName =
                projects.find((p) => p.id === e.project_id)?.name ||
                t('time.noProject')
              const secs =
                e.ended_at
                  ? e.duration_seconds ||
                    Math.round(
                      (new Date(e.ended_at).getTime() -
                        new Date(e.started_at).getTime()) /
                        1000,
                    )
                  : Math.floor(
                      (Date.now() - new Date(e.started_at).getTime()) / 1000,
                    )
              return (
                <li key={e.id} className="crm-activity-item">
                  <div>
                    <strong>
                      {e.ended_at ? formatDuration(secs) : `● ${formatDuration(secs)}`}
                    </strong>
                    <span className="crm-muted">
                      {' '}
                      · {projectName} · {e.user_email || user.email}
                    </span>
                    {e.notes && <p className="crm-offer-text">{e.notes}</p>}
                    <p className="crm-muted">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(e.started_at))}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost crm-danger"
                    onClick={() => {
                      if (!confirm(t('time.deleteConfirm'))) return
                      void deleteTimeEntry(e.id).then(() => refresh())
                    }}
                  >
                    {t('act.delete')}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
