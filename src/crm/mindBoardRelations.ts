import type { MindNode } from './types'
import { updateMindNode } from './workspaceApi'

export type MindLinkRelation = 'child' | 'sibling' | 'parent'

export function wouldCreateCycle(
  nodes: MindNode[],
  nodeId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false
  if (newParentId === nodeId) return true
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let cur: string | null = newParentId
  const seen = new Set<string>()
  while (cur) {
    if (cur === nodeId) return true
    if (seen.has(cur)) return true
    seen.add(cur)
    cur = byId.get(cur)?.parent_id ?? null
  }
  return false
}

/** Attach `sourceId` relative to `targetId`. */
export async function linkMindNodes(
  nodes: MindNode[],
  sourceId: string,
  targetId: string,
  relation: MindLinkRelation,
): Promise<void> {
  if (sourceId === targetId) throw new Error('same_node')
  const source = nodes.find((n) => n.id === sourceId)
  const target = nodes.find((n) => n.id === targetId)
  if (!source || !target) throw new Error('missing_node')

  if (relation === 'child') {
    if (wouldCreateCycle(nodes, sourceId, targetId)) throw new Error('cycle')
    await updateMindNode(sourceId, { parent_id: targetId })
    return
  }

  if (relation === 'sibling') {
    if (wouldCreateCycle(nodes, sourceId, target.parent_id)) throw new Error('cycle')
    await updateMindNode(sourceId, {
      parent_id: target.parent_id,
      position: target.position + 1,
    })
    return
  }

  // parent: source becomes parent of target (higher in hierarchy)
  if (wouldCreateCycle(nodes, sourceId, target.parent_id)) throw new Error('cycle')
  if (wouldCreateCycle(nodes, targetId, sourceId)) throw new Error('cycle')
  await updateMindNode(sourceId, {
    parent_id: target.parent_id,
    position: target.position,
  })
  await updateMindNode(targetId, { parent_id: sourceId, position: 0 })
}

export async function detachMindNode(nodeId: string): Promise<void> {
  await updateMindNode(nodeId, { parent_id: null })
}
