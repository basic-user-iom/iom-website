import type { AutomotiveProject } from './schema'
import { idbDeleteAssetBlob, idbListAssetBlobIds } from './localDb'

/** Collect every blob key referenced by a project document. */
export function collectReferencedAssetIds(project: AutomotiveProject): Set<string> {
  const ids = new Set<string>()
  for (const asset of project.assets) {
    ids.add(asset.id)
    if (asset.blobKey) ids.add(asset.blobKey)
  }
  if (project.activeVehicleId) ids.add(project.activeVehicleId)
  if (project.vehicle?.assetId) ids.add(project.vehicle.assetId)

  const surfaces = [project.stage.floor, project.stage.pedestal, project.stage.cyclorama]
  for (const surface of surfaces) {
    const maps = surface.maps
    for (const key of Object.keys(maps) as Array<keyof typeof maps>) {
      const value = maps[key]
      if (typeof value === 'string' && value) ids.add(value)
    }
  }

  for (const hotspot of project.hotspots) {
    for (const block of hotspot.blocks) {
      if (block.type === 'image' || block.type === 'video') ids.add(block.assetId)
      if (block.type === 'gallery') {
        for (const id of block.assetIds) ids.add(id)
      }
      if (block.type === 'video' && block.captionsAssetId) ids.add(block.captionsAssetId)
    }
  }

  return ids
}

/**
 * Delete IndexedDB blobs that are not referenced by the given project.
 * Never call this on unload or before Undo can restore metadata.
 */
export async function purgeOrphanAssetBlobs(project: AutomotiveProject): Promise<number> {
  const referenced = collectReferencedAssetIds(project)
  const all = await idbListAssetBlobIds()
  let removed = 0
  for (const id of all) {
    if (referenced.has(id)) continue
    await idbDeleteAssetBlob(id)
    removed += 1
  }
  return removed
}
