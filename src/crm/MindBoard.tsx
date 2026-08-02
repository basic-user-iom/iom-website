import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useCrmI18n } from './i18n'
import { extractFirstBlockImage, splitRichNoteTitle } from './formatNotePreview'
import type { MindNode, MindNodeEmphasis } from './types'
import {
  createMindNode,
  deleteMindNode,
  isMindNodeStyleSchemaMissing,
  updateMindNode,
} from './workspaceApi'
import {
  boardBounds,
  clearMindBoardLayout,
  connectorPath,
  loadMindBoardLayout,
  MIND_CARD_H,
  MIND_CARD_W,
  resolveMindBoardLayout,
  saveMindBoardLayout,
  type BoardPoint,
} from './mindBoardLayout'

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

function looksLikeRichMarkdown(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/^\|/.test(t) || /\|[\t ]*[-:]+[\t ]*\|/.test(t)) return true
  if (/!\[[^\]]*\]\([^)]+\)/.test(t)) return true
  if (t.length > 160 && /\[[^\]]+\]\(https?:\/\//.test(t)) return true
  return false
}

function noteSnippet(notes: string): { title: string; text: string; image: string | null } {
  const { title, body } = splitRichNoteTitle(notes)
  const { imageLine, bodyWithout } = extractFirstBlockImage(body)
  let image: string | null = null
  if (imageLine) {
    const md = imageLine.trim().match(/^!\[[^\]]*\]\(([^)\n]+)\)$/)
    if (md) image = md[1]
    else if (/^https?:\/\//i.test(imageLine.trim())) image = imageLine.trim()
  }
  const text = bodyWithout
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\|/g, ' ')
    .replace(/[#*_`>-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 96)
  return { title, text, image }
}

function flattenEdges(tree: TreeNode[]): Array<{ from: string; to: string }> {
  const edges: Array<{ from: string; to: string }> = []
  const walk = (node: TreeNode) => {
    for (const child of node.children) {
      edges.push({ from: node.id, to: child.id })
      walk(child)
    }
  }
  tree.forEach(walk)
  return edges
}

function flattenNodes(tree: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (node: TreeNode) => {
    out.push(node)
    node.children.forEach(walk)
  }
  tree.forEach(walk)
  return out
}

export function MindBoard({
  mapId,
  tree,
  selectedNodeId,
  editingNodeId,
  richEditingNodeId,
  focusEditId,
  compact,
  onSelect,
  onEdit,
  onOpenRichNote,
  onFocusEditConsumed,
  onChanged,
  onCreated,
  onError,
}: {
  mapId: string
  tree: TreeNode[]
  selectedNodeId: string | null
  editingNodeId: string | null
  richEditingNodeId: string | null
  focusEditId: string | null
  compact?: boolean
  onSelect: (id: string | null) => void
  onEdit: (id: string | null) => void
  onOpenRichNote: (id: string) => void
  onFocusEditConsumed: () => void
  onChanged: () => void
  onCreated: (id: string) => void
  onError: (msg: string) => void
}) {
  const { t } = useCrmI18n()
  const [saved, setSaved] = useState(() => loadMindBoardLayout(mapId))
  const [dragId, setDragId] = useState<string | null>(null)
  const dragRef = useRef<{
    id: string
    startX: number
    startY: number
    orig: BoardPoint
  } | null>(null)

  useEffect(() => {
    setSaved(loadMindBoardLayout(mapId))
  }, [mapId])

  const layout = useMemo(
    () => resolveMindBoardLayout(tree, saved),
    [tree, saved],
  )
  const bounds = useMemo(() => boardBounds(layout), [layout])
  const edges = useMemo(() => flattenEdges(tree), [tree])
  const flat = useMemo(() => flattenNodes(tree), [tree])

  const resetLayout = () => {
    clearMindBoardLayout(mapId)
    setSaved({})
  }

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    setSaved((prev) => ({
      ...prev,
      [d.id]: {
        x: Math.max(16, d.orig.x + dx),
        y: Math.max(16, d.orig.y + dy),
      },
    }))
  }, [])

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return
    setSaved((prev) => {
      saveMindBoardLayout(mapId, prev)
      return prev
    })
    dragRef.current = null
    setDragId(null)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }, [mapId, onPointerMove])

  const startDrag = (nodeId: string, e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const seeded = { ...layout }
    setSaved(seeded)
    const orig = seeded[nodeId] ?? { x: 56, y: 56 }
    dragRef.current = {
      id: nodeId,
      startX: e.clientX,
      startY: e.clientY,
      orig,
    }
    setDragId(nodeId)
    onSelect(nodeId)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [onPointerMove, onPointerUp])

  return (
    <div className={`crm-mind-board${compact ? ' is-compact' : ''}`}>
      <div className="crm-mind-board-toolbar">
        <p className="crm-muted crm-mind-board-hint">{t('ideas.boardHint')}</p>
        <button type="button" className="btn btn-ghost" onClick={resetLayout}>
          {t('ideas.boardResetLayout')}
        </button>
      </div>
      <div
        className="crm-mind-board-scroll"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onSelect(null)
            onEdit(null)
          }
        }}
      >
        <div
          className="crm-mind-board-surface"
          style={{ width: bounds.width, height: bounds.height }}
        >
          <svg
            className="crm-mind-board-links"
            width={bounds.width}
            height={bounds.height}
            aria-hidden="true"
          >
            {edges.map(({ from, to }) => {
              const a = layout[from]
              const b = layout[to]
              if (!a || !b) return null
              return (
                <path
                  key={`${from}-${to}`}
                  className="crm-mind-board-link"
                  d={connectorPath(a, b)}
                  fill="none"
                />
              )
            })}
          </svg>

          {flat.map((node) => {
            const pt = layout[node.id] ?? { x: 56, y: 56 }
            return (
              <MindBoardCard
                key={node.id}
                node={node}
                point={pt}
                mapId={mapId}
                selected={selectedNodeId === node.id}
                editing={editingNodeId === node.id}
                richEditing={richEditingNodeId === node.id}
                dragging={dragId === node.id}
                focusEdit={focusEditId === node.id}
                onSelect={onSelect}
                onEdit={onEdit}
                onOpenRichNote={onOpenRichNote}
                onFocusEditConsumed={onFocusEditConsumed}
                onChanged={onChanged}
                onCreated={onCreated}
                onError={onError}
                onDragStart={startDrag}
                onPlaceNear={(id, near) => {
                  setSaved((prev) => {
                    const next = {
                      ...prev,
                      [id]: near,
                    }
                    saveMindBoardLayout(mapId, next)
                    return next
                  })
                }}
                layout={layout}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MindBoardCard({
  node,
  point,
  mapId,
  selected,
  editing,
  richEditing,
  dragging,
  focusEdit,
  onSelect,
  onEdit,
  onOpenRichNote,
  onFocusEditConsumed,
  onChanged,
  onCreated,
  onError,
  onDragStart,
  onPlaceNear,
  layout,
}: {
  node: TreeNode
  point: BoardPoint
  mapId: string
  selected: boolean
  editing: boolean
  richEditing: boolean
  dragging: boolean
  focusEdit: boolean
  onSelect: (id: string | null) => void
  onEdit: (id: string | null) => void
  onOpenRichNote: (id: string) => void
  onFocusEditConsumed: () => void
  onChanged: () => void
  onCreated: (id: string) => void
  onError: (msg: string) => void
  onDragStart: (id: string, e: ReactPointerEvent) => void
  onPlaceNear: (id: string, near: BoardPoint) => void
  layout: Record<string, BoardPoint>
}) {
  const { t } = useCrmI18n()
  const [title, setTitle] = useState(node.title)
  const [linkDraft, setLinkDraft] = useState(node.link_url)
  const [panel, setPanel] = useState<'none' | 'color' | 'link'>('none')
  const inputRef = useRef<HTMLInputElement>(null)
  const titleLooksRich = looksLikeRichMarkdown(node.title)
  const snippet = useMemo(
    () => (node.notes.trim() ? noteSnippet(node.notes) : null),
    [node.notes],
  )

  useEffect(() => {
    setTitle(node.title)
  }, [node.title])

  useEffect(() => {
    setLinkDraft(node.link_url)
  }, [node.link_url])

  useEffect(() => {
    if (!selected) setPanel('none')
  }, [selected])

  useEffect(() => {
    if (focusEdit && editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
      onFocusEditConsumed()
    }
  }, [focusEdit, editing, onFocusEditConsumed])

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

  const placeCreated = (created: MindNode, kind: 'child' | 'sibling') => {
    const base = layout[node.id] ?? point
    const near =
      kind === 'child'
        ? { x: base.x, y: base.y + MIND_CARD_H + 80 }
        : { x: base.x + MIND_CARD_W + 48, y: base.y }
    onPlaceNear(created.id, near)
    onCreated(created.id)
  }

  const addChild = async (currentTitle?: string) => {
    if (editing) await saveTitle(currentTitle)
    try {
      const created = await createMindNode(mapId, {
        parent_id: node.id,
        title: t('ideas.newNode'),
      })
      placeCreated(created, 'child')
    } catch (err) {
      onError(err instanceof Error ? err.message : t('ideas.createFailed'))
    }
  }

  const addSibling = async (currentTitle?: string) => {
    if (editing) await saveTitle(currentTitle)
    if (!node.parent_id) {
      await addChild(currentTitle)
      return
    }
    try {
      const created = await createMindNode(mapId, {
        parent_id: node.parent_id,
        title: t('ideas.newNode'),
        position: node.position + 1,
      })
      placeCreated(created, 'sibling')
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
      onError(err instanceof Error ? err.message : t('ideas.saveFailed'))
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      void addChild(editing ? title : undefined)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !editing) {
      e.preventDefault()
      void addSibling()
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
    if ((e.key === 'Delete' || e.key === 'Backspace') && !editing && selected) {
      if (node.parent_id && confirm(t('ideas.deleteNodeConfirm'))) {
        void deleteMindNode(node.id).then(() => {
          onSelect(null)
          onChanged()
        })
      }
    }
  }

  return (
    <div
      className={`crm-mind-board-card${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}${richEditing ? ' is-rich-editing' : ''}`}
      style={
        {
          left: point.x,
          top: point.y,
          width: MIND_CARD_W,
          height: MIND_CARD_H,
          ...(node.color
            ? {
                '--mind-node-accent': node.color,
                borderColor: `${node.color}88`,
              }
            : {}),
        } as CSSProperties
      }
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
          className="crm-mind-board-tools"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="crm-mind-board-toolbar"
            role="toolbar"
            aria-label={t('ideas.toolbar')}
          >
            <button
              type="button"
              className={`crm-mind-tb-btn${panel === 'color' ? ' is-active' : ''}`}
              title={t('ideas.styleColor')}
              onClick={() => setPanel((p) => (p === 'color' ? 'none' : 'color'))}
            >
              ◐
            </button>
            <button
              type="button"
              className={`crm-mind-tb-btn${node.emphasis === 'bold' || node.emphasis === 'bold-italic' ? ' is-active' : ''}`}
              title={t('ideas.bold')}
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
              onClick={() =>
                void patchStyle({
                  emphasis: toggleEmphasis(node.emphasis, 'italic'),
                })
              }
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className={`crm-mind-tb-btn${panel === 'link' || node.link_url ? ' is-active' : ''}`}
              title={t('ideas.link')}
              onClick={() => setPanel((p) => (p === 'link' ? 'none' : 'link'))}
            >
              ↗
            </button>
            {node.parent_id && (
              <button
                type="button"
                className="crm-mind-tb-btn crm-mind-tb-btn--danger"
                title={t('ideas.deleteNode')}
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

          {panel === 'color' && (
            <div className="crm-mind-board-pop">
              <div className="crm-mind-swatches" role="listbox">
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

          {panel === 'link' && (
            <div className="crm-mind-board-pop crm-mind-board-pop--form">
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
        </div>
      )}

      <div className="crm-mind-board-card-body">
        <button
          type="button"
          className="crm-mind-board-drag"
          title={t('ideas.boardDrag')}
          aria-label={t('ideas.boardDrag')}
          onPointerDown={(e) => onDragStart(node.id, e)}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(node.id)
          }}
        >
          <span aria-hidden="true">⋮⋮</span>
        </button>

        <div className="crm-mind-board-card-main">
          <div className="crm-mind-board-card-head">
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
                onPointerDown={(e) => e.stopPropagation()}
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
                className={`crm-mind-title ${emphasisClass(node.emphasis)}${
                  titleLooksRich ? ' is-rich-paste' : ''
                }`}
                title={t('ideas.boardRenameHint')}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(node.id)
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  onSelect(node.id)
                  onEdit(node.id)
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {titleLooksRich ? t('ideas.richTitleTruncated') : node.title}
              </button>
            )}
            <button
              type="button"
              className="crm-mind-board-rename"
              title={t('ideas.boardRename')}
              aria-label={t('ideas.boardRename')}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(node.id)
                onEdit(node.id)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              ✎
            </button>
          </div>

          {richEditing ? (
            <p className="crm-mind-board-card-hint">{t('ideas.richEditingHere')}</p>
          ) : (
            <button
              type="button"
              className={`crm-mind-board-preview${node.notes.trim() ? '' : ' is-empty'}`}
              onClick={(e) => {
                e.stopPropagation()
                onOpenRichNote(node.id)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className="crm-mind-board-edit-chip">
                {node.notes.trim() ? t('ideas.richEdit') : t('ideas.richAdd')}
              </span>
              {snippet?.image ? (
                <img
                  src={snippet.image}
                  alt=""
                  className="crm-mind-board-thumb"
                  loading="lazy"
                />
              ) : null}
              {node.notes.trim() ? (
                <span className="crm-mind-board-preview-text">
                  {snippet?.title || snippet?.text || t('ideas.richEdit')}
                </span>
              ) : null}
            </button>
          )}
        </div>
      </div>

      {selected && (
        <>
          <button
            type="button"
            className="crm-mind-add crm-mind-add--sibling"
            title={`${t('ideas.addSibling')} (Enter)`}
            aria-label={t('ideas.addSibling')}
            onClick={(e) => {
              e.stopPropagation()
              void addSibling()
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            +
          </button>
          <button
            type="button"
            className="crm-mind-add crm-mind-add--child"
            title={`${t('ideas.addChild')} (Tab)`}
            aria-label={t('ideas.addChild')}
            onClick={(e) => {
              e.stopPropagation()
              void addChild()
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            +
          </button>
        </>
      )}
    </div>
  )
}
