import { useCallback, useEffect, useState } from 'react'
import { useCrmI18n } from './i18n'
import type {
  BoardColumn,
  CrmProject,
  CrmTask,
  CrmUser,
  StaffProfile,
  TaskPriority,
} from './types'
import { ownerDisplayName } from './types'
import {
  createColumn,
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  formatDuration,
  getRunningTimer,
  listColumns,
  listProjects,
  listTasks,
  moveTask,
  PROJECT_STATUS_VALUES,
  startTimer,
  stopTimer,
  TASK_PRIORITY_VALUES,
  updateProject,
  updateTask,
} from './workspaceApi'
import type { TimeEntry } from './types'

const BOARD_EXPANDED_KEY = 'iom-crm-project-board-expanded'

function readBoardExpanded(): boolean {
  try {
    const raw = localStorage.getItem(BOARD_EXPANDED_KEY)
    if (raw === '0') return false
    if (raw === '1') return true
  } catch {
    /* ignore */
  }
  return false
}

function writeBoardExpanded(expanded: boolean) {
  try {
    localStorage.setItem(BOARD_EXPANDED_KEY, expanded ? '1' : '0')
  } catch {
    /* ignore */
  }
}

interface ProjectsViewProps {
  user: CrmUser
  staffById: Map<string, StaffProfile>
  initialProjectId?: string | null
  onOpenIdeas?: (projectId: string) => void
  onOpenTime?: (projectId: string) => void
}

export function ProjectsView({
  user,
  staffById,
  initialProjectId = null,
  onOpenIdeas,
  onOpenTime,
}: ProjectsViewProps) {
  const { t } = useCrmI18n()
  const [projects, setProjects] = useState<CrmProject[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(initialProjectId)
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState<Record<string, string>>({})
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null)
  const [running, setRunning] = useState<TimeEntry | null>(null)
  const [tick, setTick] = useState(0)
  const [boardExpanded, setBoardExpanded] = useState(readBoardExpanded)

  const setBoardExpandedPref = (next: boolean) => {
    setBoardExpanded(next)
    writeBoardExpanded(next)
  }

  const refreshList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await listProjects()
      setProjects(rows)
      setSelectedId((prev) => {
        if (initialProjectId && rows.some((r) => r.id === initialProjectId)) {
          return initialProjectId
        }
        if (prev && rows.some((r) => r.id === prev)) return prev
        return rows[0]?.id ?? null
      })
      setRunning(await getRunningTimer())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('proj.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [initialProjectId, t])

  const refreshBoard = useCallback(async (projectId: string) => {
    const [cols, taskRows] = await Promise.all([
      listColumns(projectId),
      listTasks(projectId),
    ])
    setColumns(cols)
    setTasks(taskRows)
  }, [])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  useEffect(() => {
    if (!selectedId) {
      setColumns([])
      setTasks([])
      return
    }
    void refreshBoard(selectedId).catch((err) => {
      setError(err instanceof Error ? err.message : t('proj.loadFailed'))
    })
  }, [selectedId, refreshBoard, t])

  useEffect(() => {
    if (!running || running.ended_at) return
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [running])

  const selected = projects.find((p) => p.id === selectedId) ?? null

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    setError('')
    try {
      const project = await createProject({
        name,
        description: '',
        status: 'active',
        lead_id: null,
      })
      setNewName('')
      await refreshList()
      setSelectedId(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('proj.createFailed'))
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!selected) return
    if (!confirm(t('proj.deleteConfirm', { name: selected.name }))) return
    try {
      await deleteProject(selected.id)
      setSelectedId(null)
      await refreshList()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('proj.deleteFailed'))
    }
  }

  const handleAddTask = async (columnId: string) => {
    if (!selected) return
    const title = (newTaskTitle[columnId] || '').trim()
    if (!title) return
    try {
      await createTask(selected.id, {
        title,
        description: '',
        priority: 'medium',
        due_date: null,
        assignee_id: null,
        column_id: columnId,
      })
      setNewTaskTitle((m) => ({ ...m, [columnId]: '' }))
      await refreshBoard(selected.id)
      await refreshList()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('proj.taskFailed'))
    }
  }

  const handleMove = async (taskId: string, columnId: string) => {
    if (!selected) return
    try {
      await moveTask(taskId, columnId)
      await refreshBoard(selected.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('proj.taskFailed'))
    }
  }

  const handleTimer = async (task: CrmTask) => {
    try {
      if (running && !running.ended_at) {
        if (running.task_id === task.id) {
          await stopTimer(running.id)
          setRunning(null)
          return
        }
        await stopTimer(running.id)
      }
      const entry = await startTimer({
        project_id: task.project_id,
        task_id: task.id,
        notes: task.title,
      })
      setRunning(entry)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('time.timerFailed'))
    }
  }

  const runningSeconds =
    running && !running.ended_at
      ? Math.floor((Date.now() - new Date(running.started_at).getTime()) / 1000) +
        tick * 0
      : 0

  const staffOptions = [...staffById.values()]
  if (user && !staffById.has(user.id)) {
    staffOptions.unshift({
      id: user.id,
      email: user.email,
      display_name: ownerDisplayName(user.email),
      avatar_url: user.avatar_url,
    })
  }

  return (
    <div className="crm-tool-panel">
      <div className="crm-tool-toolbar">
        <input
          className="crm-input"
          placeholder={t('proj.newPlaceholder')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCreate()
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={creating || !newName.trim()}
          onClick={() => void handleCreate()}
        >
          {creating ? t('form.saving') : t('proj.create')}
        </button>
        {running && !running.ended_at && (
          <span className="crm-timer-chip" title={running.notes || undefined}>
            ● {formatDuration(runningSeconds)}
          </span>
        )}
      </div>

      {error && (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      )}

      <div
        className={`crm-workspace crm-workspace--projects${
          selected && !boardExpanded ? ' crm-workspace--board-collapsed' : ''
        }`}
      >
        <aside className="crm-sidebar">
          {loading ? (
            <p className="crm-muted">{t('proj.loading')}</p>
          ) : projects.length === 0 ? (
            <p className="crm-muted">{t('proj.empty')}</p>
          ) : (
            <ul className="crm-lead-list">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`crm-lead-row${selectedId === p.id ? ' is-selected' : ''}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <div className="crm-lead-row-body">
                      <div className="crm-lead-row-top">
                        <span className="crm-lead-company">{p.name}</span>
                        <span className="crm-status-pill">
                          {t(`projStatus.${p.status}`)}
                        </span>
                      </div>
                      <div className="crm-lead-row-meta">
                        {p.lead_id ? (
                          <span>{t('proj.fromLead')}</span>
                        ) : (
                          <span>{t('proj.standalone')}</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="crm-main">
          {!selected ? (
            <p className="crm-empty crm-muted">{t('proj.select')}</p>
          ) : !boardExpanded ? (
            <div className="crm-detail crm-detail--collapsed">
              <div className="crm-detail-summary">
                <div className="crm-detail-summary-main">
                  <div className="crm-detail-summary-body">
                    <div className="crm-detail-summary-top">
                      <span className="crm-lead-company">{selected.name}</span>
                    </div>
                    <div className="crm-lead-row-meta">
                      <span>{t('proj.taskCount', { count: tasks.length })}</span>
                      <span>
                        {t('proj.columnCount', { count: columns.length })}
                      </span>
                      {selected.lead_id ? <span>{t('proj.fromLead')}</span> : null}
                    </div>
                  </div>
                </div>
                <div className="crm-detail-actions crm-detail-actions--compact">
                  <span className="crm-status-pill">
                    {t(`projStatus.${selected.status}`)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost crm-collapse-btn"
                    aria-expanded={false}
                    aria-label={t('proj.expandAria')}
                    onClick={() => setBoardExpandedPref(true)}
                  >
                    {t('proj.expand')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="crm-detail crm-detail--expanded">
              <header className="crm-detail-header">
                <div>
                  <p className="crm-kicker">{t('proj.kicker')}</p>
                  <h2 className="crm-detail-title">{selected.name}</h2>
                  {selected.description && (
                    <p className="crm-muted">{selected.description}</p>
                  )}
                </div>
                <div className="crm-detail-actions">
                  <button
                    type="button"
                    className="btn btn-ghost crm-collapse-btn"
                    aria-expanded={true}
                    aria-label={t('proj.collapseAria')}
                    onClick={() => setBoardExpandedPref(false)}
                  >
                    {t('proj.collapse')}
                  </button>
                  <select
                    className="crm-input"
                    value={selected.status}
                    aria-label={t('proj.status')}
                    onChange={(e) => {
                      void updateProject(selected.id, {
                        status: e.target.value as CrmProject['status'],
                      }).then(() => refreshList())
                    }}
                  >
                    {PROJECT_STATUS_VALUES.map((s) => (
                      <option key={s} value={s}>
                        {t(`projStatus.${s}`)}
                      </option>
                    ))}
                  </select>
                  {onOpenTime && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => onOpenTime(selected.id)}
                    >
                      {t('proj.openTime')}
                    </button>
                  )}
                  {onOpenIdeas && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => onOpenIdeas(selected.id)}
                    >
                      {t('proj.openIdeas')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      const name = prompt(t('proj.columnPrompt'))
                      if (!name?.trim()) return
                      void createColumn(selected.id, name.trim()).then(() =>
                        refreshBoard(selected.id),
                      )
                    }}
                  >
                    {t('proj.addColumn')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost crm-danger"
                    onClick={() => void handleDeleteProject()}
                  >
                    {t('detail.delete')}
                  </button>
                </div>
              </header>

              <div className="crm-board">
                {columns.map((col) => {
                  const colTasks = tasks.filter((task) => task.column_id === col.id)
                  return (
                    <div key={col.id} className="crm-board-col">
                      <div className="crm-board-col-head">
                        <span
                          className="crm-board-dot"
                          style={{ background: col.color || 'var(--accent)' }}
                        />
                        <strong>{col.name}</strong>
                        <span className="crm-muted">{colTasks.length}</span>
                      </div>
                      <div className="crm-board-cards">
                        {colTasks.map((task) => {
                          const assignee = task.assignee_id
                            ? staffById.get(task.assignee_id)
                            : null
                          const isTiming =
                            running &&
                            !running.ended_at &&
                            running.task_id === task.id
                          return (
                            <article key={task.id} className="crm-card">
                              <button
                                type="button"
                                className="crm-card-title-btn"
                                onClick={() => setEditingTask(task)}
                              >
                                {task.title}
                              </button>
                              <div className="crm-card-meta">
                                <span className={`crm-prio crm-prio--${task.priority}`}>
                                  {t(`prio.${task.priority}`)}
                                </span>
                                {task.due_date && (
                                  <span className="crm-muted">{task.due_date}</span>
                                )}
                                {assignee && (
                                  <span className="crm-muted">
                                    {assignee.display_name ||
                                      ownerDisplayName(assignee.email)}
                                  </span>
                                )}
                              </div>
                              <div className="crm-card-actions">
                                <select
                                  className="crm-input crm-input--xs"
                                  value={task.column_id ?? ''}
                                  aria-label={t('proj.move')}
                                  onChange={(e) =>
                                    void handleMove(task.id, e.target.value)
                                  }
                                >
                                  {columns.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className={`btn btn-ghost crm-timer-btn${isTiming ? ' is-live' : ''}`}
                                  onClick={() => void handleTimer(task)}
                                >
                                  {isTiming ? t('time.stop') : t('time.start')}
                                </button>
                              </div>
                            </article>
                          )
                        })}
                      </div>
                      <div className="crm-board-add">
                        <input
                          className="crm-input"
                          placeholder={t('proj.taskPlaceholder')}
                          value={newTaskTitle[col.id] ?? ''}
                          onChange={(e) =>
                            setNewTaskTitle((m) => ({
                              ...m,
                              [col.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleAddTask(col.id)
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void handleAddTask(col.id)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {editingTask && selected && (
        <TaskEditor
          task={editingTask}
          columns={columns}
          staffOptions={staffOptions}
          onClose={() => setEditingTask(null)}
          onSaved={async () => {
            setEditingTask(null)
            await refreshBoard(selected.id)
          }}
          onDeleted={async () => {
            setEditingTask(null)
            await refreshBoard(selected.id)
          }}
        />
      )}
    </div>
  )
}

function TaskEditor({
  task,
  columns,
  staffOptions,
  onClose,
  onSaved,
  onDeleted,
}: {
  task: CrmTask
  columns: BoardColumn[]
  staffOptions: StaffProfile[]
  onClose: () => void
  onSaved: () => void | Promise<void>
  onDeleted: () => void | Promise<void>
}) {
  const { t } = useCrmI18n()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '')
  const [columnId, setColumnId] = useState(task.column_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await updateTask(task.id, {
        title: title.trim() || task.title,
        description,
        priority,
        due_date: dueDate || null,
        assignee_id: assigneeId || null,
        column_id: columnId || null,
      })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('proj.taskFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="crm-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="crm-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="crm-detail-title">{t('proj.editTask')}</h3>
        {error && (
          <p className="crm-feedback crm-feedback--error" role="alert">
            {error}
          </p>
        )}
        <label className="crm-field">
          <span>{t('proj.taskTitle')}</span>
          <input
            className="crm-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="crm-field">
          <span>{t('form.notes')}</span>
          <textarea
            className="crm-input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="crm-form-row">
          <label className="crm-field">
            <span>{t('proj.priority')}</span>
            <select
              className="crm-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {TASK_PRIORITY_VALUES.map((p) => (
                <option key={p} value={p}>
                  {t(`prio.${p}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span>{t('proj.due')}</span>
            <input
              className="crm-input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>
        <div className="crm-form-row">
          <label className="crm-field">
            <span>{t('proj.assignee')}</span>
            <select
              className="crm-input"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">{t('proj.unassigned')}</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name || ownerDisplayName(s.email)}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span>{t('proj.column')}</span>
            <select
              className="crm-input"
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="crm-detail-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('form.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-ghost crm-danger"
            onClick={() => {
              if (!confirm(t('proj.deleteTaskConfirm'))) return
              void deleteTask(task.id).then(() => onDeleted())
            }}
          >
            {t('detail.delete')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? t('form.saving') : t('form.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
