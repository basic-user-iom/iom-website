import type { Material, Mesh, Object3D } from 'three'

export const IOM_MATERIAL_ROLE_KEY = 'iomMaterialRole'
export const IOM_DOUBLE_SIDED_REASON_KEY = 'iomDoubleSidedReason'
export const IOM_EXPLICIT_WALKABLE_KEY = 'iomExplicitWalkable'
export type IomMaterialRole = 'fire-safety-opaque' | 'fire-safety-glass'

const ICM_BRIDGE_FLOOR_NAMES = new Set(['Floor', 'Floor001', 'Floor_Mitte'])
const ICM_BRIDGE_FLOOR_MATERIAL = 'vray Bruecke_Gitter'
const ICM_GANGWAY_NAME = 'Gangway_Raster'
const ICM_GANGWAY_MATERIAL = 'vray Bruecke_Gitter_saal_14'

function materialNames(mesh: Mesh): string[] {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return materials
    .map((material) => material?.name || '')
    .filter(Boolean)
}

/**
 * Exact ICM bridge semantics. Generic `gitter` / grille matching is unsafe:
 * most such meshes are railings, while these four are authored walking decks.
 */
export function isIcmWalkableBridgeGrating(
  object: Object3D,
  material?: Material | null,
): boolean {
  if (!(object as Mesh).isMesh) return false
  const mesh = object as Mesh
  const names = material ? [material.name || ''] : materialNames(mesh)
  if (ICM_BRIDGE_FLOOR_NAMES.has(mesh.name)) {
    return names.includes(ICM_BRIDGE_FLOOR_MATERIAL)
  }
  return mesh.name === ICM_GANGWAY_NAME && names.includes(ICM_GANGWAY_MATERIAL)
}

/** Bridge decks missing from the current dedicated collision GLB (302 tris). */
export function isIcmBridgeCollisionSupplement(object: Object3D): boolean {
  if (!(object as Mesh).isMesh) return false
  const mesh = object as Mesh
  return (
    ICM_BRIDGE_FLOOR_NAMES.has(mesh.name) &&
    materialNames(mesh).includes(ICM_BRIDGE_FLOOR_MATERIAL)
  )
}

// Dedicated collision currently omits these authored circulation owners (or
// covers only a small fraction of their visible tread faces). Keep this list
// intentionally ICM-specific: generic ancestor matching can otherwise turn
// handrails and decorative stair hardware into blocking collision.
const ICM_MISSING_STAIR_COLLISION_RE =
  /treppen_aussen|treppe_stufen_holz_001|bu_treppe_links001|(?:^|[\s._-])treppe_og(?:$|[\s._-])|treppen all\.001/i
const ICM_STAIR_COLLISION_REJECT_RE =
  /handlauf|handrail|gelaender|gel[aä]nder|balustrade|baluster|railing|banister|guardrail|gitter|grille|unterbau|sockel|schraube|tr[aä]ger/i

export const ICM_ANIMATED_STAIR_LANDING_SUPPLEMENTS = [
  { name: 'TR_Stufen004_2OG_landing', centerX: -35.962, centerZ: 41.3 },
  { name: 'TR_Stufen005_2OG_landing', centerX: -74.16, centerZ: 41.3 },
] as const

/** Known rendered stair surfaces missing from icm-anim-2025 collision.glb. */
export function isIcmAnimatedWalkCollisionSupplement(object: Object3D): boolean {
  if (!(object as Mesh).isMesh) return false
  const mesh = object as Mesh
  const materialLabel = materialNames(mesh).join(' ')
  const label = `${objectPathLabel(mesh)} ${materialLabel}`

  return (
    ICM_MISSING_STAIR_COLLISION_RE.test(label) &&
    !ICM_STAIR_COLLISION_REJECT_RE.test(label)
  )
}

export function isExplicitWalkableSurface(
  object: Object3D,
  material?: Material | null,
): boolean {
  return (
    object.userData?.[IOM_EXPLICIT_WALKABLE_KEY] === true ||
    isIcmWalkableBridgeGrating(object, material)
  )
}

const FORBIDDEN_WALK_SURFACE_RE =
  /water|wasser|pool|pond|fountain|brunnen|roof|dach|ceiling|decke|soffit|skylight|oberlicht|facade|fassade|wall|wand|window|fenster|glazing|scheib|railing|handrail|handlauf|balustrade/i
const POSITIVE_WALK_SURFACE_RE =
  /floor|ground|walkway|path|pavement|sidewalk|plaza|platform|corridor|hallway|gangway|gang|boden|flur|diele|podest|landing|stair|step|tread|treppe|stufe|ramp|seeweg/i

/** Reject rendered roofs, water and vertical architectural sheets as spawn floors. */
export function isForbiddenWalkSurface(
  object: Object3D,
  material?: Material | null,
): boolean {
  if (object.userData?.waterSurface) return true
  const localLabel = `${object.name || ''} ${material?.name || ''}`
  if (FORBIDDEN_WALK_SURFACE_RE.test(localLabel)) return true
  // A floor can legitimately live below an exporter group named Ceiling or
  // Facade. Strong local floor semantics take precedence over ancestor names.
  if (POSITIVE_WALK_SURFACE_RE.test(localLabel)) return false
  return FORBIDDEN_WALK_SURFACE_RE.test(objectPathLabel(object))
}

export function getIomMaterialRole(material: Material | null | undefined): IomMaterialRole | null {
  const value = material?.userData?.[IOM_MATERIAL_ROLE_KEY]
  return value === 'fire-safety-opaque' || value === 'fire-safety-glass' ? value : null
}

export function isFireSafetyMaterial(material: Material | null | undefined): boolean {
  return getIomMaterialRole(material) != null
}

export function isFireSafetyOpaqueMaterial(material: Material | null | undefined): boolean {
  return getIomMaterialRole(material) === 'fire-safety-opaque'
}

export function isFireSafetyGlassMaterial(material: Material | null | undefined): boolean {
  return getIomMaterialRole(material) === 'fire-safety-glass'
}

export function hasAuthoredDoubleSidedReason(material: Material | null | undefined): boolean {
  return typeof material?.userData?.[IOM_DOUBLE_SIDED_REASON_KEY] === 'string'
}

/**
 * Assemblies whose visibility is part of the building's safety/circulation model.
 * These must never be removed by an inferred duplicate, ground, or detail rule.
 */
const FIRE_SAFETY_ASSEMBLY_RE =
  /(?:^|[\s._-])fire(?=$|[\s._-])|fire[\s._-]*hose|firehose|fire[\s._-]*cabinet|feuerwehr|feuerl(?:o|\u00f6)sch|hydrant|brandschutz/i

const STRUCTURAL_CONNECTION_RE =
  /verbindung|walkway|footbridge|skybridge|connector|passage|uebergang|\u00fcbergang/i

export function objectPathLabel(obj: Object3D, depth = 8): string {
  const names: string[] = []
  let current: Object3D | null = obj
  for (let i = 0; i < depth && current; i++) {
    if (current.name) names.push(current.name)
    current = current.parent
  }
  return names.join(' ')
}

export function isFireSafetyAssembly(obj: Object3D): boolean {
  if (FIRE_SAFETY_ASSEMBLY_RE.test(objectPathLabel(obj))) return true
  const material = (obj as Mesh).material
  const materials = Array.isArray(material) ? material : [material]
  return materials.some((entry) => isFireSafetyMaterial(entry))
}

export function isStructuralConnection(obj: Object3D): boolean {
  return STRUCTURAL_CONNECTION_RE.test(objectPathLabel(obj))
}

export function isVisibilityCriticalAssembly(obj: Object3D): boolean {
  return isFireSafetyAssembly(obj) || isStructuralConnection(obj)
}
