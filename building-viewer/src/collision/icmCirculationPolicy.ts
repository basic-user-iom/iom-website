import type { Mesh } from 'three'

/** ICM's interior floor skin is separate from the exterior shell/terrain.
 * Only authored circulation meshes may transfer support between these layers.
 * A Ground Floor ancestor alone is not a floor (it also contains furniture).
 */
export function isIcmCirculationCollider(mesh: Mesh, layerId?: string): boolean {
  if (!/^icm-anim-2025(?::proxy)?$/.test(layerId ?? '')) return false
  const local = `${mesh.name} ${mesh.parent?.name ?? ''}`
  const reject = /handlauf|handrail|gelaender|geländer|gelnder|gelander|railing|leiste|rahmen|unterbau|sockel|stuhl|chair|tisch|table|bnke|bank|bench|mbel|moebel|furniture|fenster|window|fassade|facade|decke|ceiling|roof|dach|tafel|schild|sign|electro|column|pillar|trger|traeger|kabine|door|tuer/i
  if (reject.test(local)) return false
  const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(m => m.name)
  const floorMaterial = materials.length > 0 && materials.every(name =>
    /^(?:Floor_Wood_Vray_001(?:\.\d+)?|fb_foyer(?:_\d+)?|boden_eg_technik(?:_\d+)?)$/i.test(name),
  )
  const owner = local.replace(/COLLIDER_/gi, '')
  const floorOwner = /(?:^|[\s/])(?:floor(?:_|$)|boden(?:_|$)|bd_holz|bd_absenkung|fb_og|fb_zwischen|bt\d_technik_boden|halle\d_technik_boden|treppe(?:_|$)|etagentreppen|tr_stufen|saal[^\s]*boden|laufband_boden|walk_)/i.test(owner)
  return floorMaterial || floorOwner
}
