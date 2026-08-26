import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type RefObject,
} from 'react'
import { useCrmI18n } from './i18n'
import { joinRichNoteTitle, splitRichNoteTitle } from './formatNotePreview'
import { MindBoard } from './MindBoard'
import { NoteRichBody } from './NotePreview'
import type { CrmProject, Lead, MindMap, MindNode } from './types'
import { getCurrentUser } from './api'
import { lastingMediaUrlForSlug, uploadRecording } from './recordingsApi'
import { useLiveCrmBackend } from './supabaseClient'
import {
  createMindMap,
  createMindNode,
  deleteMindMap,
  isMindNodeStyleSchemaMissing,
  listMindMaps,
  listMindNodes,
  listProjects,
  updateMindNode,
} from './workspaceApi'

interface IdeasViewProps {
  leads: Lead[]
  initialLeadId?: string | null
  initialProjectId?: string | null
}

type TreeNode = MindNode & { children: TreeNode[] }

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

/** Detect ChatGPT / markdown pasted into a short node title by mistake. */
function looksLikeRichMarkdown(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/^\|/.test(t) || /\|[\t ]*[-:]+[\t ]*\|/.test(t)) return true
  if (/!\[[^\]]*\]\([^)]+\)/.test(t)) return true
  if (t.length > 160 && /\[[^\]]+\]\(https?:\/\//.test(t)) return true
  return false
}

const TABLE_SNIPPET = `| Model | Purpose | Analysis |
| --- | --- | --- |
| [Asset name](https://example.com) | Role | Notes |`

const MAX_PASTE_DATA_URL_BYTES = 1_800_000
const MD_IMAGE_FIND_RE = /!\[([^\]]*)\]\(([^)\n]+)\)/g

type MdImageHit = { alt: string; url: string; full: string; index: number }

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

function extractMdImages(body: string): MdImageHit[] {
  const out: MdImageHit[] = []
  const re = new RegExp(MD_IMAGE_FIND_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    out.push({ alt: m[1], url: m[2], full: m[0], index: m.index })
  }
  return out
}

function replaceMdImageAt(
  body: string,
  imageIndex: number,
  next: { alt: string; url: string },
): string {
  const images = extractMdImages(body)
  const hit = images[imageIndex]
  if (!hit) return body
  return (
    body.slice(0, hit.index) +
    `![${next.alt}](${next.url})` +
    body.slice(hit.index + hit.full.length)
  )
}

function removeMdImageAt(body: string, imageIndex: number): string {
  const images = extractMdImages(body)
  const hit = images[imageIndex]
  if (!hit) return body
  let start = hit.index
  let end = hit.index + hit.full.length
  if (body.slice(end, end + 2) === '\n\n') end += 2
  else if (body[end] === '\n') end += 1
  else if (start >= 2 && body.slice(start - 2, start) === '\n\n') start -= 2
  else if (start >= 1 && body[start - 1] === '\n') start -= 1
  return body.slice(0, start) + body.slice(end)
}

export function IdeasView({
  leads,
  initialLeadId = null,
  initialProjectId = null,
}: IdeasViewProps) {
  const { t } = useCrmI18n()
  const tRef = useRef(t)
  tRef.current = t
  const [maps, setMaps] = useState<MindMap[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<MindNode[]>([])
  const [projects, setProjects] = useState<CrmProject[]>([])
  const [title, setTitle] = useState('')
  const [linkLeadId, setLinkLeadId] = useState(initialLeadId ?? '')
  const [linkProjectId, setLinkProjectId] = useState(initialProjectId ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [focusEditId, setFocusEditId] = useState<string | null>(null)
  const [richPanelOpen, setRichPanelOpen] = useState(false)
  const [richNoteFocusToken, setRichNoteFocusToken] = useState(0)
  const richNoteRef = useRef<HTMLTextAreaElement>(null)
  const imageFileRef = useRef<HTMLInputElement>(null)

  const refreshMaps = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [mapRows, projectRows] = await Promise.all([
        listMindMaps(),
        listProjects(),
      ])
      setMaps(mapRows)
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
      setError(err instanceof Error ? err.message : tRef.current('ideas.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [initialLeadId, initialProjectId])

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
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  useEffect(() => {
    if (!selectedNodeId) return
    if (!nodes.some((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(null)
      setEditingNodeId(null)
    }
  }, [nodes, selectedNodeId])

  const openRichNote = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    setRichPanelOpen(true)
    setRichNoteFocusToken((n) => n + 1)
  }

  const closeRichNote = () => {
    setRichPanelOpen(false)
  }

  useEffect(() => {
    if (!richNoteFocusToken || !selectedNode || !richPanelOpen) return
    const id = window.setTimeout(() => {
      richNoteRef.current?.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(id)
  }, [richNoteFocusToken, selectedNode, richPanelOpen])

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
      setMaps((prev) => [map, ...prev.filter((m) => m.id !== map.id)])
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
                  <p className="crm-muted crm-mind-hint">{t('ideas.richHint')}</p>
                </div>
                <div className="crm-detail-actions">
                  {selectedNode ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => openRichNote(selectedNode.id)}
                    >
                      {selectedNode.notes.trim()
                        ? t('ideas.richEdit')
                        : t('ideas.richAdd')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      void createMindNode(selected.id, {
                        parent_id: null,
                        title: t('ideas.newNode'),
                      }).then((n) => afterNodeCreated(selected.id, n.id))
                    }}
                  >
                    {t('ideas.addFreeNote')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost crm-danger"
                    onClick={() => {
                      if (!confirm(t('ideas.deleteConfirm', { name: selected.title })))
                        return
                      void deleteMindMap(selected.id).then(() => {
                        const remaining = maps.filter((m) => m.id !== selected.id)
                        setMaps(remaining)
                        setSelectedId(remaining[0]?.id ?? null)
                      })
                    }}
                  >
                    {t('detail.delete')}
                  </button>
                </div>
              </header>

              <div
                className={`crm-mind-canvas crm-mind-canvas--board${richPanelOpen ? ' crm-mind-canvas--compact' : ''}`}
              >
                <MindBoard
                  mapId={selected.id}
                  tree={tree}
                  selectedNodeId={selectedNodeId}
                  editingNodeId={editingNodeId}
                  richEditingNodeId={richPanelOpen ? selectedNodeId : null}
                  focusEditId={focusEditId}
                  compact={richPanelOpen}
                  onSelect={setSelectedNodeId}
                  onEdit={setEditingNodeId}
                  onOpenRichNote={openRichNote}
                  onFocusEditConsumed={() => setFocusEditId(null)}
                  onChanged={() => void refreshNodes(selected.id)}
                  onCreated={(id) => void afterNodeCreated(selected.id, id)}
                  onError={(msg) => setError(msg)}
                />
              </div>

              {selectedNode && richPanelOpen ? (
                <MindRichNotePanel
                  node={selectedNode}
                  textareaRef={richNoteRef}
                  imageFileRef={imageFileRef}
                  onSaved={() => {
                    void refreshNodes(selected.id)
                    closeRichNote()
                  }}
                  onClose={closeRichNote}
                  onError={(msg) => setError(msg)}
                />
              ) : (
                <div className="crm-mind-rich-empty-row">
                  <p className="crm-muted crm-mind-rich-empty">
                    {selectedNode
                      ? selectedNode.notes.trim()
                        ? t('ideas.richEditHint')
                        : t('ideas.richSelectNode')
                      : t('ideas.richSelectNode')}
                  </p>
                  {selectedNode ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => openRichNote(selectedNode.id)}
                    >
                      {selectedNode.notes.trim()
                        ? t('ideas.richEdit')
                        : t('ideas.richAdd')}
                    </button>
                  ) : null}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function MindRichNotePanel({
  node,
  textareaRef,
  imageFileRef,
  onSaved,
  onClose,
  onError,
}: {
  node: MindNode
  textareaRef: RefObject<HTMLTextAreaElement | null>
  imageFileRef: RefObject<HTMLInputElement | null>
  onSaved: () => void
  onClose: () => void
  onError: (msg: string) => void
}) {
  const { t } = useCrmI18n()
  const initialSplit = splitRichNoteTitle(node.notes)
  const [noteTitle, setNoteTitle] = useState(initialSplit.title)
  const [draft, setDraft] = useState(initialSplit.body)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [replaceImageIndex, setReplaceImageIndex] = useState<number | null>(null)
  const titleLooksRich = looksLikeRichMarkdown(node.title)
  const composed = useMemo(
    () => joinRichNoteTitle(noteTitle, draft),
    [noteTitle, draft],
  )
  const images = useMemo(() => extractMdImages(draft), [draft])
  const isEditingExisting = Boolean(node.notes.trim())
  const isDirty = composed !== node.notes

  useEffect(() => {
    const next = splitRichNoteTitle(node.notes)
    setNoteTitle(next.title)
    setDraft(next.body)
    setReplaceImageIndex(null)
  }, [node.id, node.notes])

  const save = async (next: string) => {
    setSaving(true)
    try {
      await updateMindNode(node.id, { notes: next })
      onSaved()
    } catch (err) {
      if (isMindNodeStyleSchemaMissing(err)) {
        onError(t('ideas.styleSchemaMissing'))
      } else {
        onError(err instanceof Error ? err.message : t('ideas.saveFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  const insertSnippet = (snippet: string) => {
    const el = textareaRef.current
    const base = draft
    if (!el) {
      const next = base.trim() ? `${base.trim()}\n\n${snippet}` : snippet
      setDraft(next)
      return
    }
    const start = el.selectionStart ?? base.length
    const end = el.selectionEnd ?? base.length
    const next = `${base.slice(0, start)}${snippet}${base.slice(end)}`
    setDraft(next)
    window.setTimeout(() => {
      el.focus()
      const pos = start + snippet.length
      el.setSelectionRange(pos, pos)
    }, 0)
  }

  const resolveImageUrl = async (file: File): Promise<string> => {
    if (useLiveCrmBackend()) {
      const user = await getCurrentUser()
      if (!user?.id) throw new Error(t('ideas.richImageNeedAuth'))
      const rec = await uploadRecording({
        blob: file,
        title: file.name.replace(/\.[^.]+$/, '') || 'Idea image',
        durationMs: 0,
        ownerId: user.id,
      })
      return lastingMediaUrlForSlug(rec.share_slug)
    }
    if (file.size > MAX_PASTE_DATA_URL_BYTES) {
      throw new Error(t('ideas.richImageTooLarge'))
    }
    return fileToDataUrl(file)
  }

  const applyImageFile = async (file: File, replaceIndex: number | null) => {
    if (!file.type.startsWith('image/')) {
      onError(t('ideas.richImageBadType'))
      return
    }
    setUploading(true)
    try {
      const url = await resolveImageUrl(file)
      const alt = file.name.replace(/\.[^.]+$/, '') || 'Image'
      if (replaceIndex != null) {
        const existing = extractMdImages(draft)[replaceIndex]
        setDraft(replaceMdImageAt(draft, replaceIndex, { alt: existing?.alt || alt, url }))
      } else {
        insertSnippet(`![${alt}](${url})`)
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : t('ideas.richImageFailed'))
    } finally {
      setUploading(false)
      setReplaceImageIndex(null)
    }
  }

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items?.length) return
    for (const item of Array.from(items)) {
      if (!item.type.startsWith('image/')) continue
      const file = item.getAsFile()
      if (!file) continue
      e.preventDefault()
      void applyImageFile(file, replaceImageIndex)
      return
    }
  }

  const moveTitleIntoNote = async () => {
    const moved = node.title.trim()
    if (!moved) return
    const parsedMoved = looksLikeRichMarkdown(moved)
      ? splitRichNoteTitle(moved)
      : { title: '', body: moved }
    const finalTitle =
      noteTitle.trim() ||
      parsedMoved.title ||
      moved.split('\n')[0].replace(/^#\s+/, '').slice(0, 120)
    const movedBody = parsedMoved.body || (!parsedMoved.title ? moved : '')
    const finalBody = draft.trim()
      ? `${draft.trim()}\n\n${movedBody}`
      : movedBody
    const composedNotes = joinRichNoteTitle(finalTitle, finalBody)
    const shortTitle = t('ideas.richMovedTitle')
    setNoteTitle(finalTitle)
    setDraft(finalBody)
    setSaving(true)
    try {
      await updateMindNode(node.id, { title: shortTitle, notes: composedNotes })
      onSaved()
    } catch (err) {
      if (isMindNodeStyleSchemaMissing(err)) {
        onError(t('ideas.styleSchemaMissing'))
      } else {
        onError(err instanceof Error ? err.message : t('ideas.saveFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="crm-mind-rich-panel" aria-label={t('ideas.richTitle')}>
      <header className="crm-mind-rich-header">
        <div className="crm-mind-rich-heading">
          <h3 className="crm-mind-rich-title">
            {isEditingExisting ? t('ideas.richEditTitle') : t('ideas.richTitle')}
          </h3>
          <p className="crm-muted crm-mind-rich-blurb">
            {node.title.slice(0, 64)}
            {node.title.length > 64 ? '…' : ''}
            {' · '}
            {t('ideas.richPasteHint')}
          </p>
        </div>
        <div className="crm-mind-rich-inserts">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => insertSnippet(TABLE_SNIPPET)}
          >
            {t('ideas.insertTable')}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={uploading}
            onClick={() => {
              setReplaceImageIndex(null)
              imageFileRef.current?.click()
            }}
          >
            {uploading ? t('ideas.richImageUploading') : t('ideas.insertImage')}
          </button>
        </div>
      </header>

      <div className="crm-mind-rich-note-title-row">
        <label
          className="crm-mind-rich-editor-label"
          htmlFor={`idea-rich-title-${node.id}`}
        >
          {t('ideas.richNoteTitle')}
        </label>
        <input
          id={`idea-rich-title-${node.id}`}
          className="crm-input crm-mind-rich-note-title"
          value={noteTitle}
          placeholder={t('ideas.richNoteTitlePlaceholder')}
          onChange={(e) => setNoteTitle(e.target.value)}
        />
      </div>

      <input
        ref={imageFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          const idx = replaceImageIndex
          e.target.value = ''
          if (file) void applyImageFile(file, idx)
        }}
      />

      {titleLooksRich && (
        <div className="crm-mind-rich-migrate" role="status">
          <p>{t('ideas.richTitleLooksMarkdown')}</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => void moveTitleIntoNote()}
          >
            {t('ideas.richMoveTitle')}
          </button>
        </div>
      )}

      {images.length > 0 && (
        <div className="crm-mind-rich-images">
          <p className="crm-mind-rich-preview-label">{t('ideas.richImagesLabel')}</p>
          <ul className="crm-mind-rich-image-list">
            {images.map((img, i) => (
              <li key={`${img.index}-${i}`} className="crm-mind-rich-image-item">
                <img
                  src={img.url}
                  alt={img.alt || ''}
                  className="crm-mind-rich-image-thumb"
                />
                <div className="crm-mind-rich-image-meta">
                  <input
                    className="crm-input crm-input--xs"
                    value={img.alt}
                    aria-label={t('ideas.richImageCaption')}
                    placeholder={t('ideas.richImageCaption')}
                    onChange={(e) =>
                      setDraft(
                        replaceMdImageAt(draft, i, {
                          alt: e.target.value,
                          url: img.url,
                        }),
                      )
                    }
                  />
                  <div className="crm-mind-rich-image-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={uploading}
                      onClick={() => {
                        setReplaceImageIndex(i)
                        imageFileRef.current?.click()
                      }}
                    >
                      {t('ideas.richImageReplace')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost crm-danger"
                      onClick={() => setDraft(removeMdImageAt(draft, i))}
                    >
                      {t('ideas.richImageRemove')}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="crm-mind-rich-workspace">
        <div className="crm-mind-rich-pane">
          <label
            className="crm-mind-rich-editor-label"
            htmlFor={`idea-rich-${node.id}`}
          >
            {t('ideas.richEditorLabel')}
          </label>
          <textarea
            id={`idea-rich-${node.id}`}
            ref={textareaRef}
            className="crm-input crm-mind-rich-textarea"
            rows={10}
            placeholder={t('ideas.notePlaceholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={onPaste}
          />
        </div>
        <div className="crm-mind-rich-pane crm-mind-rich-pane--preview">
          <p className="crm-mind-rich-editor-label">{t('ideas.richPreview')}</p>
          {composed.trim() ? (
            <div className="crm-mind-rich-preview">
              <NoteRichBody body={composed} />
            </div>
          ) : (
            <p className="crm-muted crm-mind-rich-preview-empty">
              {t('ideas.richPreviewEmpty')}
            </p>
          )}
        </div>
      </div>

      <footer className="crm-mind-rich-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving || uploading}
          onClick={() => {
            if (!isDirty) {
              onClose()
              return
            }
            void save(composed)
          }}
        >
          {saving ? t('notes.saving') : t('ideas.richSaveClose')}
        </button>
        {isDirty && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const next = splitRichNoteTitle(node.notes)
              setNoteTitle(next.title)
              setDraft(next.body)
            }}
          >
            {t('ideas.richDiscard')}
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {t('ideas.richClose')}
        </button>
      </footer>
    </section>
  )
}

