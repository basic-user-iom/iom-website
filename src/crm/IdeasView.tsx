import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { useCrmI18n } from './i18n'
import type { CrmProject, Lead, MindMap, MindNode, MindNodeEmphasis } from './types'
import { listLeads } from './api'
import {
  createMindMap,
  createMindNode,
  deleteMindMap,
  deleteMindNode,
  isMindNodeStyleSchemaMissing,
  listMindMaps,
  listMindNodes,
  listProjects,
  updateMindNode,
} from './workspaceApi'

interface IdeasViewProps {
  initialLeadId?: string | null
  initialProjectId?: string | null
}

type TreeNode = MindNode & { children: TreeNode[] }

const NODE_COLORS = [
  '',
  '#22d3ee',
  '#38bdf8',
  '#67e8f9',
  '#a5f3fc',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#c084fc',
  '#94a3b8',
] as const

function buildTree(nodes: MindNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  for (const n of nodes) map.set(n.id, { ...n, children: [] })
  const roots: TreeNode[] = []
  for (const n of nodes) {
    const node = map.get(n.id)!
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => a.position - b.position)
    list.forEach((c) => sortRec(c.children))
  }
  sortRec(roots)
  return roots
}

function toggleEmphasis(
  current: MindNodeEmphasis,
  flag: 'bold' | 'italic',
): MindNodeEmphasis {
  const bold = current === 'bold' || current === 'bold-italic'
  const italic = current === 'italic' || current === 'bold-italic'
  const nextBold = flag === 'bold' ? !bold : bold
  const nextItalic = flag === 'italic' ? !italic : italic
  if (nextBold && nextItalic) return 'bold-italic'
  if (nextBold) return 'bold'
  if (nextItalic) return 'italic'
  return 'normal'
}

function emphasisClass(e: MindNodeEmphasis): string {
  if (e === 'bold') return 'is-bold'
  if (e === 'italic') return 'is-italic'
  if (e === 'bold-italic') return 'is-bold is-italic'
  return ''
}

export function IdeasView({
  initialLeadId = null,
  initialProjectId = null,
}: IdeasViewProps) {
  const { t } = useCrmI18n()
  const [maps, setMaps] = useState<MindMap[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<MindNode[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [projects, setProjects] = useState<CrmProject[]>([])
  const [title, setTitle] = useState('')
  const [linkLeadId, setLinkLeadId] = useState(initialLeadId ?? '')
  const [linkProjectId, setLinkProjectId] = useState(initialProjectId ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [focusEditId, setFocusEditId] = useState<string | null>(null)

  const refreshMaps = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [mapRows, leadRows, projectRows] = await Promise.all([
        listMindMaps(),
        listLeads({
          search: '',
          status: 'all',
          temperature: 'all',
          owner: 'all',
          sort: 'updated',
        }),
        listProjects(),
      ])
      setMaps(mapRows)
      setLeads(leadRows)
      setProjects(projectRows)
      setSelectedId((prev) => {
        if (prev && mapRows.some((m) => m.id === prev)) return prev
        if (initialLeadId) {
          const linked = mapRows.find((m) => m.lead_id === initialLeadId)
          if (linked) return linked.id
        }
        if (initialProjectId) {
          const linked = mapRows.find((m) => m.project_id === initialProjectId)
          if (linked) return linked.id
        }
        return mapRows[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ideas.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [initialLeadId, initialProjectId, t])

  const refreshNodes = useCallback(async (mapId: string) => {
    setNodes(await listMindNodes(mapId))
  }, [])

  useEffect(() => {
    void refreshMaps()
  }, [refreshMaps])

  useEffect(() => {
    if (!selectedId) {
      setNodes([])
      setSelectedNodeId(null)
      setEditingNodeId(null)
      return
    }
    void refreshNodes(selectedId).catch((err) => {
      setError(err instanceof Error ? err.message : t('ideas.loadFailed'))
    })
  }, [selectedId, refreshNodes, t])

  const tree = useMemo(() => buildTree(nodes), [nodes])
  const selected = maps.find((m) => m.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedNodeId) return
    if (!nodes.some((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(null)
      setEditingNodeId(null)
    }
  }, [nodes, selectedNodeId])

  const handleCreate = async () => {
    const name = title.trim() || t('ideas.untitled')
    setError('')
    try {
      const map = await createMindMap({
        title: name,
        lead_id: linkLeadId || null,
        project_id: linkProjectId || null,
      })
      setTitle('')
      await refreshMaps()
      setSelectedId(map.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ideas.createFailed'))
    }
  }

  const afterNodeCreated = useCallback(async (mapId: string, nodeId: string) => {
    await refreshNodes(mapId)
    setSelectedNodeId(nodeId)
    setEditingNodeId(nodeId)
    setFocusEditId(nodeId)
  }, [refreshNodes])

  return (
    <div className="crm-tool-panel">
      <div className="crm-tool-toolbar crm-tool-toolbar--wrap">
        <input
          className="crm-input"
          placeholder={t('ideas.newPlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCreate()
          }}
        />
        <select
          className="crm-input"
          value={linkLeadId}
          aria-label={t('ideas.linkLead')}
          onChange={(e) => setLinkLeadId(e.target.value)}
        >
          <option value="">{t('ideas.noLead')}</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.company_name || l.contact_name || l.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <select
          className="crm-input"
          value={linkProjectId}
          aria-label={t('ideas.linkProject')}
          onChange={(e) => setLinkProjectId(e.target.value)}
        >
          <option value="">{t('ideas.noProject')}</option>
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
          {t('ideas.create')}
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
            <p className="crm-muted">{t('ideas.loading')}</p>
          ) : maps.length === 0 ? (
            <p className="crm-muted">{t('ideas.empty')}</p>
          ) : (
            <ul className="crm-lead-list">
              {maps.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`crm-lead-row${selectedId === m.id ? ' is-selected' : ''}`}
                    onClick={() => {
                      setSelectedId(m.id)
                      setSelectedNodeId(null)
                      setEditingNodeId(null)
                    }}
                  >
                    <div className="crm-lead-row-body">
                      <div className="crm-lead-row-top">
                        <span className="crm-lead-company">{m.title}</span>
                      </div>
                      <div className="crm-lead-row-meta">
                        <span>
                          {m.lead_id ? t('ideas.linkedLead') : ''}
                          {m.lead_id && m.project_id ? ' · ' : ''}
                          {m.project_id ? t('ideas.linkedProject') : ''}
                          {!m.lead_id && !m.project_id ? t('ideas.standalone') : ''}
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
            <p className="crm-empty crm-muted">{t('ideas.select')}</p>
          ) : (
            <>
              <header className="crm-detail-header">
                <div>
                  <p className="crm-kicker">{t('ideas.kicker')}</p>
                  <h2 className="crm-detail-title">{selected.title}</h2>
                  <p className="crm-muted crm-mind-hint">{t('ideas.shortcutsHint')}</p>
                </div>
                <div className="crm-detail-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      const root = nodes.find((n) => !n.parent_id)
                      void createMindNode(selected.id, {
                        parent_id: root?.id ?? null,
                        title: t('ideas.newNode'),
                      }).then((n) => afterNodeCreated(selected.id, n.id))
                    }}
                  >
                    {t('ideas.addChild')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost crm-danger"
                    onClick={() => {
                      if (!confirm(t('ideas.deleteConfirm', { name: selected.title })))
                        return
                      void deleteMindMap(selected.id).then(async () => {
                        setSelectedId(null)
                        await refreshMaps()
                      })
                    }}
                  >
                    {t('detail.delete')}
                  </button>
                </div>
              </header>

              <div
                className="crm-mind-canvas"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setSelectedNodeId(null)
                    setEditingNodeId(null)
                  }
                }}
              >
                <div className="crm-mind-tree">
                  {tree.map((node) => (
                    <MindNodeRow
                      key={node.id}
                      node={node}
                      depth={0}
                      mapId={selected.id}
                      selectedNodeId={selectedNodeId}
                      editingNodeId={editingNodeId}
                      focusEditId={focusEditId}
                      onSelect={setSelectedNodeId}
                      onEdit={setEditingNodeId}
                      onFocusEditConsumed={() => setFocusEditId(null)}
                      onChanged={() => void refreshNodes(selected.id)}
                      onCreated={(id) => void afterNodeCreated(selected.id, id)}
                      onError={(msg) => setError(msg)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function MindNodeRow({
  node,
  depth,
  mapId,
  selectedNodeId,
  editingNodeId,
  focusEditId,
  onSelect,
  onEdit,
  onFocusEditConsumed,
  onChanged,
  onCreated,
  onError,
}: {
  node: TreeNode
  depth: number
  mapId: string
  selectedNodeId: string | null
  editingNodeId: string | null
  focusEditId: string | null
  onSelect: (id: string | null) => void
  onEdit: (id: string | null) => void
  onFocusEditConsumed: () => void
  onChanged: () => void
  onCreated: (id: string) => void
  onError: (msg: string) => void
}) {
  const { t } = useCrmI18n()
  const [title, setTitle] = useState(node.title)
  const [notesDraft, setNotesDraft] = useState(node.notes)
  const [linkDraft, setLinkDraft] = useState(node.link_url)
  const [panel, setPanel] = useState<'none' | 'color' | 'link' | 'note'>('none')
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = selectedNodeId === node.id
  const editing = editingNodeId === node.id

  useEffect(() => {
    setTitle(node.title)
  }, [node.title])

  useEffect(() => {
    setNotesDraft(node.notes)
  }, [node.notes])

  useEffect(() => {
    setLinkDraft(node.link_url)
  }, [node.link_url])

  useEffect(() => {
    if (!selected) setPanel('none')
  }, [selected])

  useEffect(() => {
    if (focusEditId === node.id && editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
      onFocusEditConsumed()
    }
  }, [focusEditId, editing, node.id, onFocusEditConsumed])

  const saveTitle = async (nextTitle?: string) => {
    const next = (nextTitle ?? title).trim()
    if (!next) {
      setTitle(node.title)
      onEdit(null)
      return node.title
    }
    if (next !== node.title) {
      try {
        await updateMindNode(node.id, { title: next })
        onChanged()
      } catch (err) {
        onError(err instanceof Error ? err.message : t('ideas.saveFailed'))
      }
    }
    onEdit(null)
    return next
  }

  const addChild = async (currentTitle?: string) => {
    if (editing) await saveTitle(currentTitle)
    try {
      const created = await createMindNode(mapId, {
        parent_id: node.id,
        title: t('ideas.newNode'),
      })
      onCreated(created.id)
    } catch (err) {
      onError(err instanceof Error ? err.message : t('ideas.createFailed'))
    }
  }

  const addSibling = async (currentTitle?: string) => {
    if (editing) await saveTitle(currentTitle)
    if (!node.parent_id) {
      // Root has no sibling notion in our single-root model — add as child instead.
      await addChild(currentTitle)
      return
    }
    try {
      const created = await createMindNode(mapId, {
        parent_id: node.parent_id,
        title: t('ideas.newNode'),
        position: node.position + 1,
      })
      onCreated(created.id)
    } catch (err) {
      onError(err instanceof Error ? err.message : t('ideas.createFailed'))
    }
  }

  const patchStyle = async (
    patch: Partial<Pick<MindNode, 'color' | 'link_url' | 'emphasis' | 'notes'>>,
  ) => {
    try {
      await updateMindNode(node.id, patch)
      onChanged()
    } catch (err) {
      if (isMindNodeStyleSchemaMissing(err)) {
        onError(t('ideas.styleSchemaMissing'))
        return
      }
      const msg = err instanceof Error ? err.message : t('ideas.saveFailed')
      if (msg.includes('crm_mind_node_style_migration')) {
        onError(t('ideas.styleSchemaMissing'))
        return
      }
      onError(msg)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      void addChild(editing ? title : undefined)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void addSibling(editing ? title : undefined)
      return
    }
    if (e.key === 'Escape') {
      if (editing) {
        setTitle(node.title)
        onEdit(null)
      } else {
        onSelect(null)
      }
      setPanel('none')
    }
    if (!editing && (e.key === 'Delete' || e.key === 'Backspace') && node.parent_id) {
      e.preventDefault()
      if (!confirm(t('ideas.deleteNodeConfirm'))) return
      void deleteMindNode(node.id).then(() => {
        onSelect(null)
        onChanged()
      })
    }
    if (!editing && (e.key === 'F2' || e.key === ' ')) {
      e.preventDefault()
      onEdit(node.id)
    }
  }

  return (
    <div className="crm-mind-node" style={{ marginLeft: depth * 1.25 + 'rem' }}>
      <div
        className={`crm-mind-node-shell${selected ? ' is-selected' : ''}`}
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(node.id)
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          onSelect(node.id)
          onEdit(node.id)
        }}
        onKeyDown={onKeyDown}
      >
        {selected && (
          <div
            className="crm-mind-float-toolbar"
            role="toolbar"
            aria-label={t('ideas.toolbar')}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={`crm-mind-tb-btn${panel === 'color' ? ' is-active' : ''}`}
              title={t('ideas.styleColor')}
              aria-label={t('ideas.styleColor')}
              onClick={() => setPanel((p) => (p === 'color' ? 'none' : 'color'))}
            >
              ◐
            </button>
            <button
              type="button"
              className={`crm-mind-tb-btn${node.emphasis === 'bold' || node.emphasis === 'bold-italic' ? ' is-active' : ''}`}
              title={t('ideas.bold')}
              aria-label={t('ideas.bold')}
              onClick={() =>
                void patchStyle({ emphasis: toggleEmphasis(node.emphasis, 'bold') })
              }
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className={`crm-mind-tb-btn${node.emphasis === 'italic' || node.emphasis === 'bold-italic' ? ' is-active' : ''}`}
              title={t('ideas.italic')}
              aria-label={t('ideas.italic')}
              onClick={() =>
                void patchStyle({ emphasis: toggleEmphasis(node.emphasis, 'italic') })
              }
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className={`crm-mind-tb-btn${panel === 'link' || node.link_url ? ' is-active' : ''}`}
              title={t('ideas.link')}
              aria-label={t('ideas.link')}
              onClick={() => setPanel((p) => (p === 'link' ? 'none' : 'link'))}
            >
              ↗
            </button>
            <button
              type="button"
              className={`crm-mind-tb-btn${panel === 'note' || node.notes ? ' is-active' : ''}`}
              title={t('ideas.note')}
              aria-label={t('ideas.note')}
              onClick={() => setPanel((p) => (p === 'note' ? 'none' : 'note'))}
            >
              ≡
            </button>
            {node.parent_id && (
              <button
                type="button"
                className="crm-mind-tb-btn crm-mind-tb-btn--danger"
                title={t('ideas.deleteNode')}
                aria-label={t('ideas.deleteNode')}
                onClick={() => {
                  if (!confirm(t('ideas.deleteNodeConfirm'))) return
                  void deleteMindNode(node.id).then(() => {
                    onSelect(null)
                    onChanged()
                  })
                }}
              >
                ×
              </button>
            )}
          </div>
        )}

        {selected && panel === 'color' && (
          <div className="crm-mind-pop" onClick={(e) => e.stopPropagation()}>
            <div className="crm-mind-swatches" role="listbox" aria-label={t('ideas.styleColor')}>
              {NODE_COLORS.map((c) => (
                <button
                  key={c || 'default'}
                  type="button"
                  className={`crm-mind-swatch${(node.color || '') === c ? ' is-active' : ''}${!c ? ' is-default' : ''}`}
                  style={c ? { background: c } : undefined}
                  title={c || t('ideas.colorDefault')}
                  onClick={() => {
                    void patchStyle({ color: c })
                    setPanel('none')
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {selected && panel === 'link' && (
          <div className="crm-mind-pop crm-mind-pop--form" onClick={(e) => e.stopPropagation()}>
            <input
              className="crm-input crm-input--xs"
              type="url"
              placeholder={t('ideas.linkPlaceholder')}
              value={linkDraft}
              autoFocus
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  void patchStyle({ link_url: linkDraft.trim() }).then(() =>
                    setPanel('none'),
                  )
                }
                if (e.key === 'Escape') setPanel('none')
              }}
            />
            <button
              type="button"
              className="btn btn-primary crm-mind-save-btn"
              onClick={() =>
                void patchStyle({ link_url: linkDraft.trim() }).then(() =>
                  setPanel('none'),
                )
              }
            >
              {t('ideas.save')}
            </button>
          </div>
        )}

        {selected && panel === 'note' && (
          <div className="crm-mind-pop crm-mind-pop--form" onClick={(e) => e.stopPropagation()}>
            <textarea
              className="crm-input crm-mind-note"
              rows={3}
              placeholder={t('ideas.notePlaceholder')}
              value={notesDraft}
              autoFocus
              onChange={(e) => setNotesDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') setPanel('none')
              }}
            />
            <button
              type="button"
              className="btn btn-primary crm-mind-save-btn"
              onClick={() =>
                void patchStyle({ notes: notesDraft }).then(() => setPanel('none'))
              }
            >
              {t('ideas.save')}
            </button>
          </div>
        )}

        <div
          className="crm-mind-node-row"
          style={
            node.color
              ? ({
                  '--mind-node-accent': node.color,
                  borderColor: `${node.color}66`,
                  background: `${node.color}18`,
                } as CSSProperties)
              : undefined
          }
        >
          <span className="crm-mind-bullet" aria-hidden="true">
            ◆
          </span>
          {editing ? (
            <input
              ref={inputRef}
              className="crm-input crm-mind-edit"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => void saveTitle()}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Tab') {
                  e.preventDefault()
                  void addChild(title)
                  return
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void addSibling(title)
                  return
                }
                if (e.key === 'Escape') {
                  setTitle(node.title)
                  onEdit(null)
                }
              }}
            />
          ) : (
            <button
              type="button"
              className={`crm-mind-title ${emphasisClass(node.emphasis)}`}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(node.id)
              }}
            >
              {node.title}
            </button>
          )}
          {node.link_url ? (
            <a
              className="crm-mind-link-badge"
              href={node.link_url}
              target="_blank"
              rel="noopener noreferrer"
              title={node.link_url}
              onClick={(e) => e.stopPropagation()}
            >
              ↗
            </a>
          ) : null}
          {node.notes ? (
            <span className="crm-mind-note-badge" title={node.notes}>
              ≡
            </span>
          ) : null}
        </div>

        {selected && (
          <>
            <button
              type="button"
              className="crm-mind-add crm-mind-add--child"
              title={`${t('ideas.addChild')} (Tab)`}
              aria-label={t('ideas.addChild')}
              onClick={(e) => {
                e.stopPropagation()
                void addChild()
              }}
            >
              +
            </button>
            <button
              type="button"
              className="crm-mind-add crm-mind-add--sibling"
              title={`${t('ideas.addSibling')} (Enter)`}
              aria-label={t('ideas.addSibling')}
              onClick={(e) => {
                e.stopPropagation()
                void addSibling()
              }}
            >
              +
            </button>
          </>
        )}
      </div>

      {node.children.map((child) => (
        <MindNodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          mapId={mapId}
          selectedNodeId={selectedNodeId}
          editingNodeId={editingNodeId}
          focusEditId={focusEditId}
          onSelect={onSelect}
          onEdit={onEdit}
          onFocusEditConsumed={onFocusEditConsumed}
          onChanged={onChanged}
          onCreated={onCreated}
          onError={onError}
        />
      ))}
    </div>
  )
}
