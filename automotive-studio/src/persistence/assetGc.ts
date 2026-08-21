import type { AutomotiveProject } from './schema'
import { migrateProject } from './migrations'
import { idbDeleteAssetBlob, idbListAssetBlobIds, idbListProjectIds, idbLoadProject } from './localDb'

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
  if (project.stage.cycloramaVideoAssetId) ids.add(project.stage.cycloramaVideoAssetId)

  for (const hotspot of project.hotspots) {
    for (const block of hotspot.blocks) {
      if (block.type === 'image' || block.type === 'video') ids.add(block.assetId)
      if (block.type === 'gallery') {
        for (const id of block.assetIds) ids.add(id)
      }
      if (block.type === 'video' && block.captionsAssetId) ids.add(block.captionsAssetId)
    }
  }

  for (const entry of project.vehicle?.materialOverrides ?? []) {
    const maps = entry.props.maps
    if (!maps) continue
    for (const key of Object.keys(maps) as Array<keyof typeof maps>) {
      const value = maps[key]
      if (typeof value === 'string' && value) ids.add(value)
    }
  }

  return ids
}

/** Union blob keys referenced by any of the given projects. */
export function unionReferencedAssetIds(projects: AutomotiveProject[]): Set<string> {
  const ids = new Set<string>()
  for (const project of projects) {
    for (const id of collectReferencedAssetIds(project)) ids.add(id)
  }
  return ids
}

/**
 * Build the referenced-asset set across every saved project in IndexedDB,
 * plus an optional in-memory active project (covers unsaved refs on Save).
 */
export async function collectReferencedAssetIdsFromAllProjects(
  activeProject?: AutomotiveProject,
): Promise<Set<string>> {
  const projects: AutomotiveProject[] = []
  if (activeProject) projects.push(activeProject)

  const seenIds = new Set(activeProject ? [activeProject.id] : [])
  const projectIds = await idbListProjectIds()
  for (const id of projectIds) {
    if (seenIds.has(id)) continue
    seenIds.add(id)
    const raw = await idbLoadProject(id)
    if (!raw) continue
    try {
      projects.push(migrateProject(raw))
    } catch (err) {
      console.warn('[automotive-studio] Skipping corrupt project during asset GC', id, err)
    }
  }

  return unionReferencedAssetIds(projects)
}

/**
 * Delete IndexedDB blobs that are not referenced by any saved project
 * (nor by the active in-memory project). Never call this on unload or
 * before Undo can restore metadata.
 */
export async function purgeOrphanAssetBlobs(project: AutomotiveProject): Promise<number> {
  const referenced = await collectReferencedAssetIdsFromAllProjects(project)
  const all = await idbListAssetBlobIds()
  let removed = 0
  for (const id of all) {
    if (referenced.has(id)) continue
    await idbDeleteAssetBlob(id)
    removed += 1
  }
  return removed
}

/** Pure helper for tests: which blob IDs would be deleted given known refs. */
export function orphanBlobIds(allBlobIds: string[], referenced: Set<string>): string[] {
  return allBlobIds.filter((id) => !referenced.has(id))
}
