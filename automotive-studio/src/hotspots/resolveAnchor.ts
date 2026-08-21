import { Box3, Object3D, Vector3 } from 'three'
import type { HotspotAnchor, SemanticNodeRef, Vec3 } from '../persistence/schema'
import { findNamedNode } from '../vehicle/qualityVariants'

const _box = new Box3()
const _center = new Vector3()
const _size = new Vector3()
const _world = new Vector3()
const _local = new Vector3()

/** Build a stable slash path from the vehicle model root down to `node`. */
export function objectPathFromRoot(root: Object3D, node: Object3D): string {
  const parts: string[] = []
  let cur: Object3D | null = node
  while (cur && cur !== root) {
    parts.unshift(cur.name || cur.uuid.slice(0, 8))
    cur = cur.parent
  }
  return parts.join('/')
}

export function resolveSemanticNode(root: Object3D, ref: SemanticNodeRef | null | undefined): Object3D | null {
  if (!ref) return null
  if (ref.iomId) {
    let found: Object3D | null = null
    root.traverse((obj) => {
      if (found) return
      if (obj.userData?.iomId === ref.iomId || obj.uuid === ref.iomId) found = obj
    })
    if (found) return found
  }
  if (ref.path) {
    const byPath = resolvePath(root, ref.path)
    if (byPath) return byPath
  }
  if (ref.name) {
    const byName = findNamedNode(root, ref.name)
    if (byName) return byName
  }
  return null
}

function resolvePath(root: Object3D, path: string): Object3D | null {
  const parts = path.split('/').filter(Boolean)
  if (!parts.length) return null
  let cur: Object3D = root
  for (const part of parts) {
    const next = cur.children.find((c) => c.name === part)
    if (!next) {
      // Fallback: search by leaf name under root (GLB reparenting can break exact paths).
      return findNamedNode(root, parts[parts.length - 1])
    }
    cur = next
  }
  return cur
}

export function refFromObject(root: Object3D, node: Object3D): SemanticNodeRef {
  return {
    name: node.name || undefined,
    path: objectPathFromRoot(root, node),
    iomId: typeof node.userData?.iomId === 'string' ? node.userData.iomId : undefined,
  }
}

/** Heuristic attach candidates: doors, lids, glass, mirrors, etc. */
export function listAttachCandidates(root: Object3D, limit = 40): Array<{ node: Object3D; label: string; score: number }> {
  const scored: Array<{ node: Object3D; label: string; score: number }> = []
  root.traverse((obj) => {
    if (!obj.name || obj.name === 'Scene' || obj.name.startsWith('Hotspot_')) return
    const score = scoreAttachName(obj.name)
    if (score <= 0) return
    // Prefer mesh-bearing nodes or groups with children.
    const hasMesh = Boolean((obj as { isMesh?: boolean }).isMesh) || obj.children.some((c) => (c as { isMesh?: boolean }).isMesh)
    if (!hasMesh && obj.children.length === 0) return
    scored.push({ node: obj, label: obj.name, score })
  })
  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
  const seen = new Set<string>()
  const unique: typeof scored = []
  for (const item of scored) {
    if (seen.has(item.label)) continue
    seen.add(item.label)
    unique.push(item)
    if (unique.length >= limit) break
  }
  return unique
}

function scoreAttachName(name: string): number {
  const n = name.toLowerCase()
  if (/door|porte|tuer|tür/.test(n)) return 100
  if (/hood|bonnet|trunk|boot|hatch|tailgate|liftgate/.test(n)) return 90
  if (/mirror|wing|fender|bumper|grille/.test(n)) return 70
  if (/wheel|rim|tire|tyre/.test(n)) return 60
  if (/glass|window|windshield|roof|seat|steering|dash|console/.test(n)) return 50
  if (/body|chassis|cabin|exterior/.test(n)) return 20
  return 0
}

/**
 * Local-space point near the outside of a mesh/group, suitable as a marker rest pose.
 * Uses bounding-box center + outward nudge along the larger horizontal extent.
 */
export function defaultLocalAnchorOnNode(node: Object3D): { localPosition: Vec3; localNormal: Vec3 } {
  node.updateWorldMatrix(true, true)
  _box.setFromObject(node)
  if (_box.isEmpty()) {
    return { localPosition: [0, 0.15, 0], localNormal: [0, 1, 0] }
  }
  _box.getCenter(_center)
  _box.getSize(_size)
  // Prefer outward along the wider horizontal axis so door markers sit on the outer face.
  // Box center/size are world-space — convert both the nudged point and the normal into
  // node-local space (same approach as mesh-pick in HotspotSession).
  const outwardWorld =
    Math.abs(_size.x) >= Math.abs(_size.z)
      ? new Vector3(Math.sign(_center.x) || 1, 0, 0)
      : new Vector3(0, 0, Math.sign(_center.z) || 1)
  const nudge = Math.max(0.05, Math.min(_size.x, _size.z, _size.y) * 0.15)
  _world.copy(_center).addScaledVector(outwardWorld, nudge)
  node.worldToLocal(_local.copy(_world))
  const localPos: Vec3 = [_local.x, _local.y, _local.z]
  _world.add(outwardWorld)
  node.worldToLocal(_center.copy(_world))
  _center.sub(_local)
  if (_center.lengthSq() > 1e-8) _center.normalize()
  else _center.set(0, 0, 1)
  return {
    localPosition: localPos,
    localNormal: [_center.x, _center.y, _center.z],
  }
}

export function resolveAnchorParent(
  placement: Object3D | null,
  modelRoot: Object3D | null,
  anchor: HotspotAnchor,
): Object3D | null {
  const searchRoot = modelRoot ?? placement
  if (searchRoot) {
    const node = resolveSemanticNode(searchRoot, anchor.node)
    if (node) return node
  }
  return placement ?? modelRoot
}
