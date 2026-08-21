import type { Hotspot, HotspotAction, HotspotContentBlock, SemanticNodeRef } from '../persistence/schema'

export function hotspotTitle(hotspot: Hotspot): string {
  return hotspot.blocks.find((b) => b.type === 'title')?.text ?? hotspot.name
}

export function hotspotBody(hotspot: Hotspot): string {
  return hotspot.blocks.find((b) => b.type === 'richtext')?.markdown ?? ''
}

export function hotspotVideoAssetId(hotspot: Hotspot): string | null {
  const block = hotspot.blocks.find((b) => b.type === 'video')
  return block?.type === 'video' ? block.assetId : null
}

/** Primary door / clip action (first play or toggle). */
export function hotspotDoorActionId(hotspot: Hotspot): string | null {
  const action = hotspot.actions.find(
    (a) => a.type === 'action.play' || a.type === 'action.toggle',
  )
  return action && (action.type === 'action.play' || action.type === 'action.toggle')
    ? action.actionId
    : null
}

export function hotspotDoorPlayRange(hotspot: Hotspot): {
  startSeconds?: number
  endSeconds?: number
} {
  const action = hotspot.actions.find(
    (a) => a.type === 'action.play' || a.type === 'action.toggle',
  )
  if (!action || (action.type !== 'action.play' && action.type !== 'action.toggle')) {
    return {}
  }
  return {
    startSeconds: action.startSeconds,
    endSeconds: action.endSeconds,
  }
}

export function withHotspotTitle(hotspot: Hotspot, title: string): Hotspot {
  const text = title.trim() || hotspot.name
  const blocks = replaceOrInsertBlock(hotspot.blocks, 'title', { type: 'title', text })
  return { ...hotspot, name: text, markerLabel: text, blocks }
}

export function withHotspotBody(hotspot: Hotspot, markdown: string): Hotspot {
  const trimmed = markdown.trim()
  const without: HotspotContentBlock[] = hotspot.blocks.filter((b) => b.type !== 'richtext')
  const blocks: HotspotContentBlock[] = trimmed
    ? insertAfterTitle(without, { type: 'richtext', markdown: trimmed })
    : without
  return { ...hotspot, blocks }
}

export type DoorActionOpts = {
  mode?: 'play' | 'toggle'
  startSeconds?: number | null
  endSeconds?: number | null
}

export function withHotspotDoorAction(
  hotspot: Hotspot,
  actionId: string | null,
  opts: DoorActionOpts = {},
): Hotspot {
  const others = hotspot.actions.filter(
    (a) => a.type !== 'action.play' && a.type !== 'action.toggle',
  )
  if (!actionId) return { ...hotspot, actions: others }

  const prev = hotspot.actions.find(
    (a) => a.type === 'action.play' || a.type === 'action.toggle',
  )
  const mode = opts.mode ?? (prev?.type === 'action.play' ? 'play' : 'toggle')
  const startSeconds =
    opts.startSeconds === null
      ? undefined
      : opts.startSeconds !== undefined
        ? opts.startSeconds
        : prev && (prev.type === 'action.play' || prev.type === 'action.toggle')
          ? prev.startSeconds
          : undefined
  const endSeconds =
    opts.endSeconds === null
      ? undefined
      : opts.endSeconds !== undefined
        ? opts.endSeconds
        : prev && (prev.type === 'action.play' || prev.type === 'action.toggle')
          ? prev.endSeconds
          : undefined

  const range: { startSeconds?: number; endSeconds?: number } = {}
  if (startSeconds != null && Number.isFinite(startSeconds) && startSeconds > 0) {
    range.startSeconds = startSeconds
  } else if (startSeconds === 0) {
    // Explicit 0 = from beginning — omit field
  }
  if (endSeconds != null && Number.isFinite(endSeconds) && endSeconds > 0) {
    range.endSeconds = endSeconds
  }

  const action: HotspotAction =
    mode === 'play'
      ? { type: 'action.play', actionId, ...range }
      : { type: 'action.toggle', actionId, ...range }
  return { ...hotspot, actions: [action, ...others] }
}

export function withHotspotMarkerRotation(
  hotspot: Hotspot,
  rotationDeg: [number, number, number] | null,
): Hotspot {
  if (!rotationDeg) {
    return { ...hotspot, markerRotationDeg: [0, 0, 0] }
  }
  return {
    ...hotspot,
    markerRotationDeg: [
      Number(rotationDeg[0]) || 0,
      Number(rotationDeg[1]) || 0,
      Number(rotationDeg[2]) || 0,
    ],
  }
}

/** Default title-plate offset (local Y = along door, Z = out from paint). */
export const DEFAULT_MARKER_LABEL_OFFSET: [number, number, number] = [0, 2.4, 0.04]
export const DEFAULT_MARKER_LABEL_SCALE = 1

export function withHotspotMarkerLabelLayout(
  hotspot: Hotspot,
  layout: { scale?: number | null; offset?: [number, number, number] | null } | null,
): Hotspot {
  if (!layout) {
    return {
      ...hotspot,
      markerLabelScale: DEFAULT_MARKER_LABEL_SCALE,
      markerLabelOffset: [...DEFAULT_MARKER_LABEL_OFFSET],
    }
  }
  const next: Hotspot = { ...hotspot }
  if (layout.scale != null && Number.isFinite(layout.scale)) {
    next.markerLabelScale = Math.max(0.2, Math.min(4, layout.scale))
  }
  if (layout.offset) {
    next.markerLabelOffset = [
      Number(layout.offset[0]) || 0,
      Number(layout.offset[1]) || 0,
      Number(layout.offset[2]) || 0,
    ]
  }
  return next
}

export type MeshVisibilityMode = 'show' | 'hide' | 'toggle'

export function withHotspotMeshVisibility(
  hotspot: Hotspot,
  opts: { node: SemanticNodeRef; mode: MeshVisibilityMode } | null,
): Hotspot {
  const others = hotspot.actions.filter(
    (a) => a.type !== 'mesh.setVisible' && a.type !== 'mesh.toggleVisible',
  )
  if (!opts) return { ...hotspot, actions: others }
  const action: HotspotAction =
    opts.mode === 'toggle'
      ? { type: 'mesh.toggleVisible', node: { ...opts.node } }
      : { type: 'mesh.setVisible', node: { ...opts.node }, visible: opts.mode === 'show' }
  return { ...hotspot, actions: [...others, action] }
}

export function hotspotMeshVisibility(
  hotspot: Hotspot,
): { node: SemanticNodeRef; mode: MeshVisibilityMode } | null {
  const action = hotspot.actions.find(
    (a) => a.type === 'mesh.setVisible' || a.type === 'mesh.toggleVisible',
  )
  if (!action) return null
  if (action.type === 'mesh.toggleVisible') return { node: action.node, mode: 'toggle' }
  return { node: action.node, mode: action.visible ? 'show' : 'hide' }
}

/** Stable select value for a SemanticNodeRef used by mesh visibility actions. */
export function encodeHotspotMeshKey(node: SemanticNodeRef): string {
  if (node.path) return `path:${node.path}`
  if (node.name) return `name:${node.name}`
  if (node.iomId) return `iom:${node.iomId}`
  return ''
}

export function decodeHotspotMeshKey(key: string): SemanticNodeRef | null {
  if (!key) return null
  if (key.startsWith('path:')) return { path: key.slice(5) }
  if (key.startsWith('name:')) return { name: key.slice(5) }
  if (key.startsWith('iom:')) return { iomId: key.slice(4) }
  return null
}

export function withHotspotVideo(hotspot: Hotspot, assetId: string | null): Hotspot {
  const without: HotspotContentBlock[] = hotspot.blocks.filter((b) => b.type !== 'video')
  const blocks: HotspotContentBlock[] = assetId
    ? [...without, { type: 'video', assetId }]
    : without
  return { ...hotspot, blocks }
}

function replaceOrInsertBlock(
  blocks: HotspotContentBlock[],
  type: HotspotContentBlock['type'],
  next: HotspotContentBlock,
): HotspotContentBlock[] {
  const index = blocks.findIndex((b) => b.type === type)
  if (index >= 0) {
    const copy = [...blocks]
    copy[index] = next
    return copy
  }
  if (type === 'title') return [next, ...blocks]
  return insertAfterTitle(blocks, next)
}

function insertAfterTitle(
  blocks: HotspotContentBlock[],
  next: HotspotContentBlock,
): HotspotContentBlock[] {
  const titleIndex = blocks.findIndex((b) => b.type === 'title')
  if (titleIndex < 0) return [...blocks, next]
  const copy = [...blocks]
  copy.splice(titleIndex + 1, 0, next)
  return copy
}
