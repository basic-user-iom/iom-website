/**
 * Coordinates project-card iframe embeds so at most one WebGL embed runs at a time.
 * Embeds activate on hover only (not scroll-into-view) to save GPU.
 * Hero clouds take priority: when the hero is ≥10% visible, no embed receives a slot.
 */
type SlotListener = (active: boolean) => void
type GateListener = (embedActive: boolean) => void

let activeEmbedId: string | null = null
let heroBlocksEmbeds = true
let hoveredEmbedId: string | null = null
const listeners = new Map<string, SlotListener>()
const gateListeners = new Set<GateListener>()

function notifyGate() {
  const embedActive = activeEmbedId !== null
  for (const listener of gateListeners) {
    listener(embedActive)
  }
}

function pickActiveEmbedId(): string | null {
  if (hoveredEmbedId && listeners.has(hoveredEmbedId)) return hoveredEmbedId
  return null
}

function reconcileActiveEmbed() {
  const nextActiveId = heroBlocksEmbeds ? null : pickActiveEmbedId()

  if (activeEmbedId === nextActiveId) return

  const previousActiveId = activeEmbedId
  activeEmbedId = nextActiveId

  if (previousActiveId) {
    listeners.get(previousActiveId)?.(false)
  }
  if (activeEmbedId) {
    listeners.get(activeEmbedId)?.(true)
  }
  notifyGate()
}

/** Hero reports whether it occupies ≥10% of the viewport (same threshold as useHeroScene). */
export function reportHeroVisibility(visible: boolean): void {
  if (heroBlocksEmbeds === visible) return
  heroBlocksEmbeds = visible
  reconcileActiveEmbed()
}

export function isEmbedSlotTaken(): boolean {
  return activeEmbedId !== null
}

export function subscribeEmbedGate(listener: GateListener): () => void {
  gateListeners.add(listener)
  listener(activeEmbedId !== null)
  return () => {
    gateListeners.delete(listener)
  }
}

export function subscribeEmbedSlot(id: string, onChange: SlotListener): () => void {
  listeners.set(id, onChange)
  onChange(activeEmbedId === id)
  return () => {
    listeners.delete(id)
    if (hoveredEmbedId === id) {
      hoveredEmbedId = null
    }
    onChange(false)
    reconcileActiveEmbed()
  }
}

/** Card reports hover intent; only one hovered embed is active at a time. */
export function reportEmbedHover(id: string, hovering: boolean): void {
  if (hovering) {
    hoveredEmbedId = id
  } else if (hoveredEmbedId === id) {
    hoveredEmbedId = null
  }
  reconcileActiveEmbed()
}
