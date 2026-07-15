import { useCallback, useEffect, useRef, useState } from 'react'
import { listLeads } from './api'
import { renderNoteBody } from './formatNotePreview'
import { useCrmI18n } from './i18n'
import type { CrmProject, Lead, ResearchNote } from './types'
import {
  createResearchNote,
  deleteResearchNote,
  isResearchNotesSchemaMissing,
  listProjects,
  listResearchNotes,
  updateResearchNote,
} from './workspaceApi'

interface NotesViewProps {
  initialLeadId?: string | null
  initialProjectId?: string | null
}

export function NotesView({
  initialLeadId = null,
  initialProjectId = null,
}: NotesViewProps) {
  const { t } = useCrmI18n()
  const [notes, setNotes] = useState<ResearchNote[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [projects, setProjects] = useState<CrmProject[]>([])
  const [title, setTitle] = useState('')
  const [linkLeadId, setLinkLeadId] = useState(initialLeadId ?? '')
  const [linkProjectId, setLinkProjectId] = useState(initialProjectId ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  )
  const saveTimer = useRef<number | null>(null)
  const skipSave = useRef(false)

  const refreshNotes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [noteRows, leadRows, projectRows] = await Promise.all([
        listResearchNotes(),
        listLeads({
          search: '',
          status: 'all',
          temperature: 'all',
          owner: 'all',
          sort: 'updated',
        }),
        listProjects(),
      ])
      setNotes(noteRows)
      setLeads(leadRows)
      setProjects(projectRows)
      setSelectedId((prev) => {
        if (prev && noteRows.some((n) => n.id === prev)) return prev
        if (initialLeadId) {
          const linked = noteRows.find((n) => n.lead_id === initialLeadId)
          if (linked) return linked.id
        }
        if (initialProjectId) {
          const linked = noteRows.find((n) => n.project_id === initialProjectId)
          if (linked) return linked.id
        }
        return noteRows[0]?.id ?? null
      })
    } catch (err) {
      if (isResearchNotesSchemaMissing(err)) {
        setError(t('notes.schemaMissing'))
      } else {
        setError(err instanceof Error ? err.message : t('notes.loadFailed'))
      }
    } finally {
      setLoading(false)
    }
  }, [initialLeadId, initialProjectId, t])

  useEffect(() => {
    void refreshNotes()
  }, [refreshNotes])

  const selected = notes.find((n) => n.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) {
      setDraftTitle('')
      setDraftBody('')
      setSaveState('idle')
      return
    }
    skipSave.current = true
    setDraftTitle(selected.title)
    setDraftBody(selected.body)
    setSaveState('idle')
    window.setTimeout(() => {
      skipSave.current = false
    }, 0)
  }, [selected?.id, selected?.title, selected?.body])

  useEffect(() => {
    if (!selected || skipSave.current) return
    if (draftTitle === selected.title && draftBody === selected.body) return

    setSaveState('saving')
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void updateResearchNote(selected.id, {
        title: draftTitle.trim() || t('notes.untitled'),
        body: draftBody,
        lead_id: selected.lead_id,
        project_id: selected.project_id,
      })
        .then((updated) => {
          setNotes((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          )
          setSaveState('saved')
        })
        .catch((err) => {
          if (isResearchNotesSchemaMissing(err)) {
            setError(t('notes.schemaMissing'))
          } else {
            setError(err instanceof Error ? err.message : t('notes.saveFailed'))
          }
          setSaveState('error')
        })
    }, 700)

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [
    draftBody,
    draftTitle,
    selected,
    t,
  ])

  const handleCreate = async () => {
    const name = title.trim() || t('notes.untitled')
    setError('')
    try {
      const note = await createResearchNote({
        title: name,
        body: '',
        lead_id: linkLeadId || null,
        project_id: linkProjectId || null,
      })
      setTitle('')
      await refreshNotes()
      setSelectedId(note.id)
      setMode('edit')
    } catch (err) {
      if (isResearchNotesSchemaMissing(err)) {
        setError(t('notes.schemaMissing'))
      } else {
        setError(err instanceof Error ? err.message : t('notes.createFailed'))
      }
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(t('notes.deleteConfirm', { name: selected.title }))) return
    setError('')
    try {
      await deleteResearchNote(selected.id)
      setSelectedId(null)
      await refreshNotes()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notes.deleteFailed'))
    }
  }

  const handleLinksChange = async (leadId: string, projectId: string) => {
    if (!selected) return
    try {
      const updated = await updateResearchNote(selected.id, {
        title: draftTitle.trim() || t('notes.untitled'),
        body: draftBody,
        lead_id: leadId || null,
        project_id: projectId || null,
      })
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notes.saveFailed'))
    }
  }

  return (
    <div className="crm-tool-panel">
      <div className="crm-tool-toolbar crm-tool-toolbar--wrap">
        <input
          className="crm-input"
          placeholder={t('notes.newPlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCreate()
          }}
        />
        <select
          className="crm-input"
          value={linkLeadId}
          aria-label={t('notes.linkLead')}
          onChange={(e) => setLinkLeadId(e.target.value)}
        >
          <option value="">{t('notes.noLead')}</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.company_name || l.contact_name || l.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <select
          className="crm-input"
          value={linkProjectId}
          aria-label={t('notes.linkProject')}
          onChange={(e) => setLinkProjectId(e.target.value)}
        >
          <option value="">{t('notes.noProject')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleCreate()}
        >
          {t('notes.create')}
        </button>
      </div>

      {error && (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      )}

      <div className="crm-workspace crm-workspace--projects">
        <aside className="crm-sidebar">
          {loading ? (
            <p className="crm-muted">{t('notes.loading')}</p>
          ) : notes.length === 0 ? (
            <p className="crm-muted">{t('notes.empty')}</p>
          ) : (
            <ul className="crm-lead-list">
              {notes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`crm-lead-row${selectedId === n.id ? ' is-selected' : ''}`}
                    onClick={() => {
                      setSelectedId(n.id)
                      setMode('edit')
                    }}
                  >
                    <div className="crm-lead-row-body">
                      <div className="crm-lead-row-top">
                        <span className="crm-lead-company">
                          {n.title || t('notes.untitled')}
                        </span>
                      </div>
                      <div className="crm-lead-row-meta">
                        <span className="crm-note-sidebar-preview">
                          {n.body.trim().split('\n')[0] || t('notes.noBody')}
                        </span>
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
            <p className="crm-empty crm-muted">{t('notes.select')}</p>
          ) : (
            <>
              <header className="crm-detail-header">
                <div className="crm-notes-header-main">
                  <p className="crm-kicker">{t('notes.kicker')}</p>
                  {mode === 'edit' ? (
                    <input
                      className="crm-input crm-notes-title-input"
                      value={draftTitle}
                      placeholder={t('notes.titlePlaceholder')}
                      aria-label={t('notes.titlePlaceholder')}
                      onChange={(e) => setDraftTitle(e.target.value)}
                    />
                  ) : (
                    <h2 className="crm-detail-title">{draftTitle || t('notes.untitled')}</h2>
                  )}
                  <p className="crm-muted crm-notes-save-hint" role="status">
                    {saveState === 'saving'
                      ? t('notes.saving')
                      : saveState === 'saved'
                        ? t('notes.saved')
                        : saveState === 'error'
                          ? t('notes.saveFailed')
                          : t('notes.autosaveHint')}
                  </p>
                </div>
                <div className="crm-detail-actions crm-notes-actions">
                  <div className="crm-notes-mode-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'edit'}
                      className={`crm-notes-mode-tab${mode === 'edit' ? ' is-active' : ''}`}
                      onClick={() => setMode('edit')}
                    >
                      {t('notes.edit')}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'preview'}
                      className={`crm-notes-mode-tab${mode === 'preview' ? ' is-active' : ''}`}
                      onClick={() => setMode('preview')}
                    >
                      {t('notes.preview')}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost crm-danger"
                    onClick={() => void handleDelete()}
                  >
                    {t('detail.delete')}
                  </button>
                </div>
              </header>

              <div className="crm-notes-links">
                <select
                  className="crm-input"
                  value={selected.lead_id ?? ''}
                  aria-label={t('notes.linkLead')}
                  onChange={(e) =>
                    void handleLinksChange(e.target.value, selected.project_id ?? '')
                  }
                >
                  <option value="">{t('notes.noLead')}</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.company_name || l.contact_name || l.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
                <select
                  className="crm-input"
                  value={selected.project_id ?? ''}
                  aria-label={t('notes.linkProject')}
                  onChange={(e) =>
                    void handleLinksChange(selected.lead_id ?? '', e.target.value)
                  }
                >
                  <option value="">{t('notes.noProject')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {mode === 'edit' ? (
                <textarea
                  className="crm-input crm-notes-body"
                  value={draftBody}
                  placeholder={t('notes.bodyPlaceholder')}
                  aria-label={t('notes.bodyPlaceholder')}
                  onChange={(e) => setDraftBody(e.target.value)}
                />
              ) : (
                <div className="crm-notes-preview">{renderNoteBody(draftBody)}</div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
