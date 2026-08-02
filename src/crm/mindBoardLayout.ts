export type BoardPoint = { x: number; y: number }

export const MIND_CARD_W = 300
export const MIND_CARD_H = 176
export const MIND_H_GAP = 56
export const MIND_V_GAP = 88
export const MIND_PAD = 88

type LayoutNode = {
  id: string
  children: LayoutNode[]
}

function layoutKey(mapId: string): string {
  return `iom-crm-mind-layout:${mapId}`
}

export function loadMindBoardLayout(mapId: string): Record<string, BoardPoint> {
  try {
    const raw = localStorage.getItem(layoutKey(mapId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, BoardPoint>
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, BoardPoint> = {}
    for (const [id, pt] of Object.entries(parsed)) {
      if (
        pt &&
        typeof pt.x === 'number' &&
        typeof pt.y === 'number' &&
        Number.isFinite(pt.x) &&
        Number.isFinite(pt.y)
      ) {
        out[id] = { x: pt.x, y: pt.y }
      }
    }
    return out
  } catch {
    return {}
  }
}

export function saveMindBoardLayout(
  mapId: string,
  layout: Record<string, BoardPoint>,
): void {
  try {
    localStorage.setItem(layoutKey(mapId), JSON.stringify(layout))
  } catch {
    /* ignore quota */
  }
}

export function clearMindBoardLayout(mapId: string): void {
  try {
    localStorage.removeItem(layoutKey(mapId))
  } catch {
    /* ignore */
  }
}

function collectIds(nodes: LayoutNode[], into: Set<string> = new Set()): Set<string> {
  for (const n of nodes) {
    into.add(n.id)
    collectIds(n.children, into)
  }
  return into
}

/** Classic mind-map layout: siblings side by side, children under parent. */
export function autoLayoutMindTree(tree: LayoutNode[]): Record<string, BoardPoint> {
  const out: Record<string, BoardPoint> = {}
  let leafCursor = MIND_PAD

  const place = (
    node: LayoutNode,
    depth: number,
  ): { minX: number; maxX: number } => {
    const y = MIND_PAD + depth * (MIND_CARD_H + MIND_V_GAP)
    if (node.children.length === 0) {
      const x = leafCursor
      leafCursor += MIND_CARD_W + MIND_H_GAP
      out[node.id] = { x, y }
      return { minX: x, maxX: x + MIND_CARD_W }
    }

    const bounds = node.children.map((c) => place(c, depth + 1))
    const minX = bounds[0].minX
    const maxX = bounds[bounds.length - 1].maxX
    const x = (minX + maxX) / 2 - MIND_CARD_W / 2
    out[node.id] = { x, y }
    return { minX, maxX }
  }

  for (const root of tree) {
    place(root, 0)
    leafCursor += MIND_H_GAP
  }

  return out
}

/** Prefer saved positions; fill gaps with auto layout. */
export function resolveMindBoardLayout(
  tree: LayoutNode[],
  saved: Record<string, BoardPoint>,
): Record<string, BoardPoint> {
  const auto = autoLayoutMindTree(tree)
  const ids = collectIds(tree)
  const merged: Record<string, BoardPoint> = {}
  for (const id of ids) {
    merged[id] = saved[id] ?? auto[id] ?? { x: MIND_PAD, y: MIND_PAD }
  }
  return merged
}

export function boardBounds(
  layout: Record<string, BoardPoint>,
): { width: number; height: number } {
  let maxX = MIND_PAD + MIND_CARD_W
  let maxY = MIND_PAD + MIND_CARD_H
  for (const pt of Object.values(layout)) {
    maxX = Math.max(maxX, pt.x + MIND_CARD_W)
    maxY = Math.max(maxY, pt.y + MIND_CARD_H)
  }
  return {
    width: maxX + MIND_PAD * 2,
    height: maxY + MIND_PAD * 2,
  }
}

export function connectorPath(
  from: BoardPoint,
  to: BoardPoint,
): string {
  const x1 = from.x + MIND_CARD_W / 2
  const y1 = from.y + MIND_CARD_H
  const x2 = to.x + MIND_CARD_W / 2
  const y2 = to.y
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
}
