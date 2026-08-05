import type { Hotspot, HotspotAction, HotspotContentBlock } from '../persistence/schema'

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

export function withHotspotTitle(hotspot: Hotspot, title: string): Hotspot {
  const text = title.trim() || hotspot.name
  const blocks = replaceOrInsertBlock(hotspot.blocks, 'title', { type: 'title', text })
  return { ...hotspot, name: text, blocks }
}

export function withHotspotBody(hotspot: Hotspot, markdown: string): Hotspot {
  const trimmed = markdown.trim()
  const without: HotspotContentBlock[] = hotspot.blocks.filter((b) => b.type !== 'richtext')
  const blocks: HotspotContentBlock[] = trimmed
    ? insertAfterTitle(without, { type: 'richtext', markdown: trimmed })
    : without
  return { ...hotspot, blocks }
}

export function withHotspotDoorAction(
  hotspot: Hotspot,
  actionId: string | null,
  mode: 'play' | 'toggle' = 'toggle',
): Hotspot {
  const others = hotspot.actions.filter(
    (a) => a.type !== 'action.play' && a.type !== 'action.toggle',
  )
  if (!actionId) return { ...hotspot, actions: others }
  const action: HotspotAction =
    mode === 'play'
      ? { type: 'action.play', actionId }
      : { type: 'action.toggle', actionId }
  return { ...hotspot, actions: [action, ...others] }
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
