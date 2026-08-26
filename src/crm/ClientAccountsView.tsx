import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCrmI18n } from './i18n'
import type { CrmClientAccount, CrmClientMembership, CrmProject, Lead } from './types'
import {
  addClientMemberByEmail,
  createClientAccount,
  deleteClientAccount,
  listClientAccounts,
  listClientMemberships,
  setClientMemberActive,
  updateClientAccount,
} from './clientTenancyApi'
import { listProjects, updateProject } from './workspaceApi'

interface ClientAccountsViewProps {
  leads: Lead[]
}

export function ClientAccountsView({ leads }: ClientAccountsViewProps) {
  const { t } = useCrmI18n()
  const tRef = useRef(t)
  tRef.current = t
  const [accounts, setAccounts] = useState<CrmClientAccount[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [members, setMembers] = useState<CrmClientMembership[]>([])
  const [projects, setProjects] = useState<CrmProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [newLeadId, setNewLeadId] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [addProjectId, setAddProjectId] = useState('')
  const [busy, setBusy] = useState(false)

  const refreshAccounts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rows, projectRows] = await Promise.all([
        listClientAccounts(),
        listProjects().catch(() => [] as CrmProject[]),
      ])
      setAccounts(rows)
      setProjects(projectRows)
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev
        return rows[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : tRef.current('clients.errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshMembers = useCallback(async (accountId: string | null) => {
    if (!accountId) {
      setMembers([])
      return
    }
    try {
      setMembers(await listClientMemberships(accountId))
    } catch (err) {
      setError(err instanceof Error ? err.message : tRef.current('clients.errorMembers'))
    }
  }, [])

  useEffect(() => {
    void refreshAccounts()
  }, [refreshAccounts])

  useEffect(() => {
    void refreshMembers(selectedId)
  }, [selectedId, refreshMembers])

  const selected = accounts.find((a) => a.id === selectedId) ?? null

  const linkedProjects = useMemo(
    () =>
      projects.filter((p) => selectedId && p.client_account_id === selectedId),
    [projects, selectedId],
  )

  const availableProjects = useMemo(
    () =>
      projects.filter(
        (p) => !selectedId || p.client_account_id !== selectedId,
      ),
    [projects, selectedId],
  )

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError('')
    try {
      const row = await createClientAccount({
        name,
        lead_id: newLeadId || null,
      })
      setNewName('')
      setNewLeadId('')
      setAccounts((prev) => [row, ...prev.filter((a) => a.id !== row.id)])
      setSelectedId(row.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clients.errorCreate'))
    } finally {
      setBusy(false)
    }
  }

  const handleAddMember = async () => {
    if (!selectedId || !memberEmail.trim()) return
    setBusy(true)
    setError('')
    try {
      await addClientMemberByEmail(selectedId, memberEmail)
      setMemberEmail('')
      await refreshMembers(selectedId)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clients.errorMember'))
    } finally {
      setBusy(false)
    }
  }

  const handleAttachProject = async () => {
    if (!selectedId || !addProjectId) return
    setBusy(true)
    setError('')
    try {
      const updated = await updateProject(addProjectId, {
        client_account_id: selectedId,
        client_visible: true,
      })
      setAddProjectId('')
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clients.errorProjects'))
    } finally {
      setBusy(false)
    }
  }

  const handleUnlinkProject = async (projectId: string) => {
    if (!confirm(t('clients.unlinkProjectConfirm'))) return
    setBusy(true)
    setError('')
    try {
      const updated = await updateProject(projectId, {
        client_account_id: null,
        client_visible: false,
      })
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clients.errorProjects'))
    } finally {
      setBusy(false)
    }
  }

  const handleToggleProjectVisible = async (project: CrmProject) => {
    setBusy(true)
    setError('')
    try {
      const updated = await updateProject(project.id, {
        client_visible: !project.client_visible,
      })
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clients.errorProjects'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="crm-main crm-clients">
      <div className="crm-panel">
        <header className="crm-panel-head">
          <div>
            <p className="crm-kicker">{t('clients.kicker')}</p>
            <h2 className="crm-panel-title">{t('clients.title')}</h2>
            <p className="crm-muted">{t('clients.intro')}</p>
          </div>
        </header>

        {error && (
          <p className="crm-error" role="alert">
            {error}
          </p>
        )}

        <div className="crm-clients-create">
          <input
            className="crm-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('clients.namePlaceholder')}
            aria-label={t('clients.namePlaceholder')}
          />
          <select
            className="crm-input"
            value={newLeadId}
            onChange={(e) => setNewLeadId(e.target.value)}
            aria-label={t('clients.linkLead')}
          >
            <option value="">{t('clients.linkLeadNone')}</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.company_name || lead.contact_name || lead.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !newName.trim()}
            onClick={() => void handleCreate()}
          >
            {t('clients.create')}
          </button>
        </div>

        {loading ? (
          <p className="crm-muted">{t('boot.loading')}</p>
        ) : accounts.length === 0 ? (
          <p className="crm-muted">{t('clients.empty')}</p>
        ) : (
          <div className="crm-clients-layout">
            <ul className="crm-clients-list">
              {accounts.map((account) => (
                <li key={account.id}>
                  <button
                    type="button"
                    className={`crm-clients-item${
                      account.id === selectedId ? ' is-active' : ''
                    }${!account.active ? ' is-inactive' : ''}`}
                    onClick={() => setSelectedId(account.id)}
                  >
                    <strong>{account.name || t('clients.unnamed')}</strong>
                    <span className="crm-muted">
                      {account.active ? t('clients.active') : t('clients.inactive')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {selected && (
              <div className="crm-clients-detail">
                <div className="crm-clients-detail-head">
                  <h3>{selected.name}</h3>
                  <div className="crm-clients-detail-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => {
                        void updateClientAccount(selected.id, {
                          active: !selected.active,
                        })
                          .then((updated) => {
                            setAccounts((prev) =>
                              prev.map((a) => (a.id === updated.id ? updated : a)),
                            )
                          })
                          .catch((err) =>
                            setError(
                              err instanceof Error ? err.message : t('clients.errorUpdate'),
                            ),
                          )
                      }}
                    >
                      {selected.active
                        ? t('clients.deactivate')
                        : t('clients.activate')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost crm-danger"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !confirm(
                            t('clients.deleteConfirm', {
                              name: selected.name || t('clients.unnamed'),
                            }),
                          )
                        ) {
                          return
                        }
                        setBusy(true)
                        setError('')
                        void deleteClientAccount(selected.id)
                          .then(() => {
                            const id = selected.id
                            setAccounts((prev) => prev.filter((a) => a.id !== id))
                            setSelectedId(null)
                          })
                          .catch((err) =>
                            setError(
                              err instanceof Error ? err.message : t('clients.errorDelete'),
                            ),
                          )
                          .finally(() => setBusy(false))
                      }}
                    >
                      {t('clients.delete')}
                    </button>
                  </div>
                </div>

                <p className="crm-muted crm-clients-id">
                  {t('clients.id')}: {selected.id}
                </p>

                <h4 className="crm-clients-members-title">{t('clients.members')}</h4>
                <div className="crm-clients-add-member">
                  <input
                    className="crm-input"
                    type="email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder={t('clients.memberEmail')}
                    aria-label={t('clients.memberEmail')}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !memberEmail.trim()}
                    onClick={() => void handleAddMember()}
                  >
                    {t('clients.addMember')}
                  </button>
                </div>
                <p className="crm-muted">{t('clients.memberHint')}</p>

                {members.length === 0 ? (
                  <p className="crm-muted">{t('clients.noMembers')}</p>
                ) : (
                  <ul className="crm-clients-members">
                    {members.map((m) => (
                      <li key={m.id}>
                        <div className="crm-clients-member-meta">
                          <strong>{m.email || t('clients.unknownEmail')}</strong>
                          <code>{m.user_id}</code>
                        </div>
                        <span className="crm-muted">
                          {m.active ? t('clients.active') : t('clients.inactive')}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() => {
                            void setClientMemberActive(m.id, !m.active)
                              .then(() => refreshMembers(selected.id))
                              .catch((err) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : t('clients.errorMember'),
                                ),
                              )
                          }}
                        >
                          {m.active
                            ? t('clients.deactivate')
                            : t('clients.activate')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <h4 className="crm-clients-members-title">{t('clients.projects')}</h4>
                <p className="crm-muted">{t('clients.projectsHint')}</p>
                <div className="crm-clients-add-member">
                  <select
                    className="crm-input"
                    value={addProjectId}
                    onChange={(e) => setAddProjectId(e.target.value)}
                    aria-label={t('clients.addProject')}
                  >
                    <option value="">{t('clients.addProjectNone')}</option>
                    {availableProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.id.slice(0, 8)}
                        {p.client_account_id
                          ? ` (${t('clients.projectLinkedOther')})`
                          : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !addProjectId}
                    onClick={() => void handleAttachProject()}
                  >
                    {t('clients.addProject')}
                  </button>
                </div>

                {linkedProjects.length === 0 ? (
                  <p className="crm-muted">{t('clients.noProjects')}</p>
                ) : (
                  <ul className="crm-clients-members">
                    {linkedProjects.map((project) => (
                      <li key={project.id}>
                        <div className="crm-clients-member-meta">
                          <strong>{project.name || t('clients.unnamed')}</strong>
                          <span className="crm-muted">
                            {t(`projStatus.${project.status}`)}
                            {' · '}
                            {project.client_visible
                              ? t('clients.projectVisible')
                              : t('clients.projectHidden')}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() => void handleToggleProjectVisible(project)}
                        >
                          {project.client_visible
                            ? t('clients.hideProject')
                            : t('clients.showProject')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost crm-danger"
                          disabled={busy}
                          onClick={() => void handleUnlinkProject(project.id)}
                        >
                          {t('clients.unlinkProject')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
