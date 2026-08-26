import { useCallback, useEffect, useRef, useState } from 'react'
import { useCrmI18n } from './i18n'
import type {
  BoardColumn,
  CrmProject,
  CrmTask,
  CrmUser,
  ResearchNote,
} from './types'
import {
  getResearchNote,
  listColumns,
  listProjects,
  listResearchNotes,
  listTasks,
} from './workspaceApi'
import { isCrmDemoMode } from './demoMode'

interface ClientPortalViewProps {
  user: CrmUser
}

/** Read-only portal for authenticated client members (live /client-login only). */
export function ClientPortalView({ user }: ClientPortalViewProps) {
  const { t } = useCrmI18n()
  const tRef = useRef(t)
  tRef.current = t
  const showProjectCosts = !isCrmDemoMode()
  const [projects, setProjects] = useState<CrmProject[]>([])
  const [notes, setNotes] = useState<ResearchNote[]>([])
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardError, setBoardError] = useState('')
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
      setOpenProjectId((prev) => {
        if (prev && projectRows.some((p) => p.id === prev)) return prev
        return projectRows[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : tRef.current('portal.errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!openProjectId) {
      setColumns([])
      setTasks([])
      setBoardError('')
      return
    }
    let alive = true
    setBoardLoading(true)
    setBoardError('')
    void Promise.all([listColumns(openProjectId), listTasks(openProjectId)])
      .then(([cols, taskRows]) => {
        if (!alive) return
        setColumns(cols)
        setTasks(taskRows)
      })
      .catch((err) => {
        if (!alive) return
        setColumns([])
        setTasks([])
        setBoardError(
          err instanceof Error ? err.message : tRef.current('portal.boardError'),
        )
      })
      .finally(() => {
        if (alive) setBoardLoading(false)
      })
    return () => {
      alive = false
    }
  }, [openProjectId])

  useEffect(() => {
    if (!openNoteId) return
    let alive = true
    void getResearchNote(openNoteId)
      .then((full) => {
        if (!alive || !full) return
        setNotes((prev) => prev.map((n) => (n.id === full.id ? full : n)))
      })
      .catch(() => {
        /* list titles still work if a single body fetch fails */
      })
    return () => {
      alive = false
    }
  }, [openNoteId])

  const openProject = projects.find((p) => p.id === openProjectId) ?? null

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
            {showProjectCosts && (
              <section className="crm-portal-resources" aria-labelledby="portal-resources-heading">
                <h3 className="crm-portal-section" id="portal-resources-heading">
                  {t('portal.resources')}
                </h3>
                <p className="crm-muted">{t('portal.resourcesLead')}</p>
                <a href="/project-costs" className="btn btn-primary">
                  {t('portal.projectCosts')}
                </a>
              </section>
            )}

            <h3 className="crm-portal-section">{t('portal.projects')}</h3>
            {projects.length === 0 ? (
              <p className="crm-muted">{t('portal.empty')}</p>
            ) : (
              <ul className="crm-portal-list">
                {projects.map((project) => {
                  const isOpen = project.id === openProjectId
                  return (
                    <li
                      key={project.id}
                      className={`crm-portal-card${isOpen ? ' is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className="crm-portal-card-toggle"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setOpenProjectId(isOpen ? null : project.id)
                        }
                      >
                        <span className="crm-portal-card-title">
                          <strong>{project.name}</strong>
                          <span className="crm-status-pill">
                            {t(`projStatus.${project.status}`)}
                          </span>
                        </span>
                        <span className="crm-muted">
                          {isOpen ? t('portal.collapse') : t('portal.expand')}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="crm-portal-detail">
                          {project.description ? (
                            <p className="crm-portal-description">
                              {project.description}
                            </p>
                          ) : (
                            <p className="crm-muted">{t('portal.noDescription')}</p>
                          )}

                          <h4 className="crm-portal-board-title">
                            {t('portal.board')}
                          </h4>
                          {boardLoading ? (
                            <p className="crm-muted">{t('boot.loading')}</p>
                          ) : boardError ? (
                            <p className="crm-error" role="alert">
                              {boardError}
                            </p>
                          ) : columns.length === 0 ? (
                            <p className="crm-muted">{t('portal.boardEmpty')}</p>
                          ) : (
                            <div className="crm-portal-board">
                              {columns.map((col) => {
                                const colTasks = tasks.filter(
                                  (task) => task.column_id === col.id,
                                )
                                return (
                                  <div
                                    key={col.id}
                                    className="crm-portal-board-col"
                                  >
                                    <div className="crm-portal-board-col-head">
                                      <span
                                        className="crm-board-dot"
                                        style={{
                                          background:
                                            col.color || 'var(--accent)',
                                        }}
                                      />
                                      <strong>{col.name}</strong>
                                      <span className="crm-muted">
                                        {colTasks.length}
                                      </span>
                                    </div>
                                    <ul className="crm-portal-task-list">
                                      {colTasks.length === 0 ? (
                                        <li className="crm-muted">
                                          {t('portal.noTasks')}
                                        </li>
                                      ) : (
                                        colTasks.map((task) => (
                                          <li
                                            key={task.id}
                                            className="crm-portal-task"
                                          >
                                            <strong>{task.title}</strong>
                                            {task.description ? (
                                              <p className="crm-muted">
                                                {task.description}
                                              </p>
                                            ) : null}
                                          </li>
                                        ))
                                      )}
                                    </ul>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            <h3 className="crm-portal-section">{t('portal.notes')}</h3>
            {notes.length === 0 ? (
              <p className="crm-muted">{t('portal.notesEmpty')}</p>
            ) : (
              <ul className="crm-portal-list">
                {notes.map((note) => {
                  const isOpen = note.id === openNoteId
                  return (
                    <li
                      key={note.id}
                      className={`crm-portal-card${isOpen ? ' is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className="crm-portal-card-toggle"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setOpenNoteId(isOpen ? null : note.id)
                        }
                      >
                        <strong>
                          {note.title || t('portal.untitledNote')}
                        </strong>
                        <span className="crm-muted">
                          {isOpen ? t('portal.collapse') : t('portal.expand')}
                        </span>
                      </button>
                      {isOpen && note.body ? (
                        <p className="crm-muted crm-portal-note-body">
                          {note.body}
                        </p>
                      ) : null}
                      {isOpen && !note.body ? (
                        <p className="crm-muted">{t('portal.notesEmpty')}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}

            {openProject && !openProject.description && columns.length === 0 && !boardLoading ? (
              <p className="crm-muted crm-portal-hint">{t('portal.hintEmpty')}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
