import { useCallback, useEffect, useState } from 'react'
import { useCrmI18n } from './i18n'
import type { CrmProject, CrmUser } from './types'
import { listProjects } from './workspaceApi'

interface ClientPortalViewProps {
  user: CrmUser
}

/** Read-only portal for authenticated client members. */
export function ClientPortalView({ user }: ClientPortalViewProps) {
  const { t } = useCrmI18n()
  const [projects, setProjects] = useState<CrmProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setProjects(await listProjects())
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
        ) : projects.length === 0 ? (
          <p className="crm-muted">{t('portal.empty')}</p>
        ) : (
          <ul className="crm-portal-list">
            {projects.map((project) => (
              <li key={project.id} className="crm-portal-card">
                <div>
                  <strong>{project.name}</strong>
                  <span className="crm-status-pill">{t(`projStatus.${project.status}`)}</span>
                </div>
                {project.description ? (
                  <p className="crm-muted">{project.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
