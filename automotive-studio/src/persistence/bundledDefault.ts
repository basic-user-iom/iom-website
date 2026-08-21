/**
 * Bundled starter .iomcar shipped under public/defaults/starter.iomcar.
 * Seeded into IndexedDB once per seed version so Studio/Present boot with a real project.
 */

import { importIomcar } from './iomcar'
import { idbLoadProject, idbPutAssetBlob, idbSaveProject } from './localDb'
import { writeLastProjectId } from './projectSession'

/** Stable id from the packaged manifest (Untitled_Automotive_Project (4).iomcar). */
export const BUNDLED_DEFAULT_PROJECT_ID = '5f48ef60-a8a9-4843-84ad-a5a18c92a23e'

/** Bump when replacing public/defaults/starter.iomcar so clients re-import. */
export const BUNDLED_DEFAULT_SEED_VERSION = '2026-08-21-starter-4'

export const BUNDLED_DEFAULT_SEED_KEY = 'iom-automotive-default-seed-version'

export function bundledDefaultIomcarUrl(): string {
  const base = import.meta.env.BASE_URL || '/demos/automotive-studio/'
  return new URL('defaults/starter.iomcar', base.endsWith('/') ? base : `${base}/`).href
}

function readSeedVersion(): string | null {
  try {
    return localStorage.getItem(BUNDLED_DEFAULT_SEED_KEY)
  } catch {
    return null
  }
}

function writeSeedVersion(version: string): void {
  try {
    localStorage.setItem(BUNDLED_DEFAULT_SEED_KEY, version)
  } catch {
    // ignore
  }
}

export type EnsureBundledDefaultResult = {
  projectId: string
  seeded: boolean
  reason: 'cached' | 'imported' | 'skipped-missing-asset' | 'failed'
  error?: string
}

/**
 * Ensure the bundled starter exists in IndexedDB.
 * Re-imports when the seed version changes or `force` is true.
 */
export async function ensureBundledDefaultProject(options?: {
  force?: boolean
}): Promise<EnsureBundledDefaultResult> {
  const force = options?.force === true || new URLSearchParams(location.search).has('seedDefault')
  const cachedVersion = readSeedVersion()
  if (!force && cachedVersion === BUNDLED_DEFAULT_SEED_VERSION) {
    const existing = await idbLoadProject(BUNDLED_DEFAULT_PROJECT_ID)
    if (existing) {
      return { projectId: BUNDLED_DEFAULT_PROJECT_ID, seeded: false, reason: 'cached' }
    }
  }

  try {
    const url = bundledDefaultIomcarUrl()
    const res = await fetch(url)
    if (!res.ok) {
      return {
        projectId: BUNDLED_DEFAULT_PROJECT_ID,
        seeded: false,
        reason: 'skipped-missing-asset',
        error: `HTTP ${res.status} for ${url}`,
      }
    }
    const file = await res.blob()
    const { project, blobs, warnings } = await importIomcar(file)
    for (const entry of blobs) {
      await idbPutAssetBlob(entry.assetId, entry.blob, { filename: entry.filename })
    }
    await idbSaveProject(project)
    writeSeedVersion(BUNDLED_DEFAULT_SEED_VERSION)
    writeLastProjectId(project.id)
    if (warnings.length > 0) {
      console.warn('[automotive-studio] bundled default warnings:', warnings)
    }
    return { projectId: project.id, seeded: true, reason: 'imported' }
  } catch (err) {
    return {
      projectId: BUNDLED_DEFAULT_PROJECT_ID,
      seeded: false,
      reason: 'failed',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
