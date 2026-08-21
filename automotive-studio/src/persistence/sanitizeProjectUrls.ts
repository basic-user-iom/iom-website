import type { AutomotiveProject, Hotspot, HotspotAction, HotspotContentBlock } from './schema'
import { sanitizeExternalUrl } from './safeUrls'

/** Strip unsafe schemes from hotspot CTAs and link.open actions (in place). */
export function sanitizeProjectUrls(project: AutomotiveProject): AutomotiveProject {
  for (const hotspot of project.hotspots ?? []) {
    sanitizeHotspotUrls(hotspot)
  }
  for (const credit of project.credits ?? []) {
    const safe = sanitizeExternalUrl(credit.url)
    credit.url = safe ?? ''
  }
  return project
}

function sanitizeHotspotUrls(hotspot: Hotspot) {
  hotspot.blocks = (hotspot.blocks ?? []).map((block) => sanitizeBlock(block))
  hotspot.actions = (hotspot.actions ?? [])
    .map((action) => sanitizeAction(action))
    .filter((action): action is HotspotAction => action != null)
}

function sanitizeBlock(block: HotspotContentBlock): HotspotContentBlock {
  if (block.type !== 'cta') return block
  const safe = sanitizeExternalUrl(block.url)
  return { ...block, url: safe ?? '' }
}

function sanitizeAction(action: HotspotAction): HotspotAction | null {
  if (action.type !== 'link.open') return action
  const safe = sanitizeExternalUrl(action.url)
  if (!safe) return null
  return { ...action, url: safe }
}
