import type { Object3D } from 'three'
import type {
  AssetRecord,
  SemanticNodeRef,
  VehicleRigManifest,
  WheelBinding,
} from '../persistence/schema'

export type VehicleQualityRole =
  | 'vehicle-master'
  | 'vehicle-high'
  | 'vehicle-balanced'
  | 'vehicle-mobile'

export const VEHICLE_QUALITY_ROLES: VehicleQualityRole[] = [
  'vehicle-master',
  'vehicle-high',
  'vehicle-balanced',
  'vehicle-mobile',
]

export function isVehicleQualityRole(role: string): role is VehicleQualityRole {
  return (VEHICLE_QUALITY_ROLES as string[]).includes(role)
}

export function qualityLabel(role: VehicleQualityRole): string {
  switch (role) {
    case 'vehicle-high':
      return 'High'
    case 'vehicle-balanced':
      return 'Balanced'
    case 'vehicle-mobile':
      return 'Mobile'
    default:
      return 'Master'
  }
}

/** Infer quality slot from offline pipeline filenames. */
export function inferQualityRoleFromFilename(filename: string): VehicleQualityRole {
  const n = filename.toLowerCase()
  if (n.includes('presentation-high') || /(^|[_\-.])high([_\-.]|$)/.test(n)) return 'vehicle-high'
  if (n.includes('balanced')) return 'vehicle-balanced'
  if (n.includes('mobile')) return 'vehicle-mobile'
  return 'vehicle-master'
}

/**
 * Multi-file import: largest → High, mid → Balanced, smallest → Mobile.
 * 2 files → High + Mobile. 1 file → Auto/filename (caller handles).
 * Extra files beyond 3 are tagged Master (largest leftover first).
 */
export function assignQualityRolesByFileSize(
  files: File[],
): Array<{ file: File; quality: VehicleQualityRole }> {
  const sorted = [...files].sort((a, b) => b.size - a.size)
  if (sorted.length === 0) return []
  if (sorted.length === 1) {
    return [{ file: sorted[0], quality: inferQualityRoleFromFilename(sorted[0].name) }]
  }
  if (sorted.length === 2) {
    return [
      { file: sorted[0], quality: 'vehicle-high' },
      { file: sorted[1], quality: 'vehicle-mobile' },
    ]
  }
  const roles: VehicleQualityRole[] = ['vehicle-high', 'vehicle-balanced', 'vehicle-mobile']
  return sorted.map((file, i) => ({
    file,
    quality: i < 3 ? roles[i] : 'vehicle-master',
  }))
}

export type VariantSlotInfo = {
  role: VehicleQualityRole
  assetId: string
  filename: string
  byteSize: number
}

export function parseRigManifestJson(raw: unknown): VehicleRigManifest {
  if (!raw || typeof raw !== 'object') throw new Error('Rig manifesto must be a JSON object')
  const o = raw as Record<string, unknown>
  const fingerprint = String(o.assetFingerprint ?? '')
  if (!fingerprint) throw new Error('Rig manifesto missing assetFingerprint')

  const wheelsRaw = Array.isArray(o.wheels) ? o.wheels : []
  const wheels: WheelBinding[] = wheelsRaw.map((w) => {
    const wheel = w as Record<string, unknown>
    const id = wheel.id as WheelBinding['id']
    if (id !== 'FL' && id !== 'FR' && id !== 'RL' && id !== 'RR') {
      throw new Error(`Invalid wheel id: ${String(wheel.id)}`)
    }
    return {
      id,
      steeringNode: asNodeRef(wheel.steeringNode),
      rollingNode: asNodeRef(wheel.rollingNode),
      staticBrakeGroup: asNodeRef(wheel.staticBrakeGroup),
      radiusMetres: typeof wheel.radiusMetres === 'number' ? wheel.radiusMetres : undefined,
      axleAxis: wheel.axleAxis === 'x' || wheel.axleAxis === 'y' || wheel.axleAxis === 'z' ? wheel.axleAxis : undefined,
      rollingDriver:
        wheel.rollingDriver === 'route-distance' ||
        wheel.rollingDriver === 'embedded-clip' ||
        wheel.rollingDriver === 'off'
          ? wheel.rollingDriver
          : 'off',
    }
  })

  return {
    assetFingerprint: fingerprint,
    primaryRoot: asNodeRef(o.primaryRoot) ?? { name: 'GLTF_SceneRootNode' },
    boundsExclusions: Array.isArray(o.boundsExclusions)
      ? (o.boundsExclusions.map(asNodeRef).filter(Boolean) as SemanticNodeRef[])
      : [],
    forwardAxis: String(o.forwardAxis ?? '+x'),
    upAxis: String(o.upAxis ?? '+y'),
    wheels,
    semanticActions: Array.isArray(o.semanticActions) ? (o.semanticActions as VehicleRigManifest['semanticActions']) : [],
    preservedNodes: Array.isArray(o.preservedNodes)
      ? (o.preservedNodes.map(asNodeRef).filter(Boolean) as SemanticNodeRef[])
      : [],
  }
}

function asNodeRef(value: unknown): SemanticNodeRef | undefined {
  if (!value || typeof value !== 'object') return undefined
  const o = value as Record<string, unknown>
  const ref: SemanticNodeRef = {}
  if (typeof o.iomId === 'string') ref.iomId = o.iomId
  if (typeof o.path === 'string') ref.path = o.path
  if (typeof o.name === 'string') ref.name = o.name
  return ref.iomId || ref.path || ref.name ? ref : undefined
}

/** Match Three.js GLTFLoader / PropertyBinding.sanitizeNodeName (strips []:./ ). */
export function sanitizeRuntimeNodeName(name: string): string {
  return name.replace(/\s/g, '_').replace(/[\[\].:/]/g, '')
}

export function findNamedNode(root: Object3D, name: string): Object3D | null {
  const exact = name
  const sanitized = sanitizeRuntimeNodeName(name)
  let found: Object3D | null = null
  root.traverse((obj) => {
    if (found || !obj.name) return
    if (obj.name === exact || obj.name === sanitized) found = obj
  })
  return found
}

export function validateRigBindings(
  root: Object3D,
  rig: VehicleRigManifest,
): { ok: boolean; missing: string[]; notes: string[] } {
  const missing: string[] = []
  const notes: string[] = []
  for (const wheel of rig.wheels) {
    for (const [label, ref] of [
      ['steering', wheel.steeringNode],
      ['rolling', wheel.rollingNode],
      ['brake', wheel.staticBrakeGroup],
    ] as const) {
      const name = ref?.name
      if (!name) continue
      if (!findNamedNode(root, name)) {
        const runtime = sanitizeRuntimeNodeName(name)
        missing.push(
          runtime !== name
            ? `${wheel.id} ${label}: ${name} (runtime ${runtime})`
            : `${wheel.id} ${label}: ${name}`,
        )
      }
    }
  }
  for (const node of rig.preservedNodes) {
    if (node.name && !findNamedNode(root, node.name)) {
      notes.push(`Preserved node missing: ${node.name}`)
    }
  }
  if (missing.length) {
    const onlyRolling = missing.every((m) => m.includes(' rolling:'))
    notes.push(
      onlyRolling
        ? 'Rolling pivots missing on this GLB — import lixiang-wheels-rigged.glb (or a pivoted variant) for Phase 4 tire roll.'
        : 'Wheel bindings incomplete — do not enable route rolling until remapped.',
    )
  }
  return { ok: missing.length === 0, missing, notes }
}

export function assetRoleForImport(
  quality: VehicleQualityRole | 'auto',
  filename: string,
  asProp: boolean,
): AssetRecord['role'] {
  if (asProp) return 'prop'
  if (quality === 'auto') return inferQualityRoleFromFilename(filename)
  return quality
}
