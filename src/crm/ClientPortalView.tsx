import { useCallback, useEffect, useState } from 'react'
import { useCrmI18n } from './i18n'
import type { CrmProject, CrmUser, ResearchNote } from './types'
import { listProjects, listResearchNotes } from './workspaceApi'

interface ClientPortalViewProps {
  user: CrmUser
}

/** Read-only portal for authenticated client members. */
export function ClientPortalView({ user }: ClientPortalViewProps) {
  const { t } = useCrmI18n()
  const [projects, setProjects] = useState<CrmProject[]>([])
  const [notes, setNotes] = useState<ResearchNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [projectRows, noteRows] = await Promise.all([
        listProjects(),
        listResearchNotes().catch(() => [] as ResearchNote[]),
      ])
      setProjects(projectRows)
      setNotes(noteRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('portal.errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="crm-main crm-portal">
      <div className="crm-panel">
        <header className="crm-panel-head">
          <div>
            <p className="crm-kicker">{t('portal.kicker')}</p>
            <h2 className="crm-panel-title">{t('portal.title')}</h2>
            <p className="crm-muted">
              {t('portal.signedInAs', { email: user.email || user.id })}
            </p>
          </div>
        </header>

        {error && (
          <p className="crm-error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="crm-muted">{t('boot.loading')}</p>
        ) : (
          <>
            <h3 className="crm-portal-section">{t('portal.projects')}</h3>
            {projects.length === 0 ? (
              <p className="crm-muted">{t('portal.empty')}</p>
            ) : (
              <ul className="crm-portal-list">
                {projects.map((project) => (
                  <li key={project.id} className="crm-portal-card">
                    <div>
                      <strong>{project.name}</strong>
                      <span className="crm-status-pill">
                        {t(`projStatus.${project.status}`)}
                      </span>
                    </div>
                    {project.description ? (
                      <p className="crm-muted">{project.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <h3 className="crm-portal-section">{t('portal.notes')}</h3>
            {notes.length === 0 ? (
              <p className="crm-muted">{t('portal.notesEmpty')}</p>
            ) : (
              <ul className="crm-portal-list">
                {notes.map((note) => (
                  <li key={note.id} className="crm-portal-card">
                    <strong>{note.title || t('portal.untitledNote')}</strong>
                    {note.body ? (
                      <p className="crm-muted crm-portal-note-body">{note.body}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
