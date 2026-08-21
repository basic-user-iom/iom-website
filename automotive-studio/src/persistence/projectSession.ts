/** Local session keys for Automotive Studio project reopen. */

export const LAST_PROJECT_ID_KEY = 'iom-automotive-last-project-id'

export function readLastProjectId(): string | null {
  try {
    const id = localStorage.getItem(LAST_PROJECT_ID_KEY)
    return id && id.length > 0 ? id : null
  } catch {
    return null
  }
}

export function writeLastProjectId(id: string): void {
  try {
    localStorage.setItem(LAST_PROJECT_ID_KEY, id)
  } catch {
    // Quota / private mode — reopen falls back to IDB list.
  }
}

export function clearLastProjectId(): void {
  try {
    localStorage.removeItem(LAST_PROJECT_ID_KEY)
  } catch {
    // ignore
  }
}

/**
 * Resolve which project to open on Studio/Present boot.
 * Prefer explicit `?project=`, then last-opened, then bundled default, then newest.
 */
export function resolveBootProjectId(options: {
  queryProjectId: string | null
  lastProjectId: string | null
  summaries: Array<{ id: string; updatedAt: number }>
  /** Packaged starter id — used when nothing else is selected. */
  bundledDefaultProjectId?: string | null
}): string | null {
  const { queryProjectId, lastProjectId, summaries, bundledDefaultProjectId } = options
  if (queryProjectId && summaries.some((s) => s.id === queryProjectId)) {
    return queryProjectId
  }
  if (queryProjectId && summaries.length === 0) {
    // May still exist if list failed partially — try load anyway.
    return queryProjectId
  }
  if (lastProjectId && summaries.some((s) => s.id === lastProjectId)) {
    return lastProjectId
  }
  if (
    bundledDefaultProjectId &&
    summaries.some((s) => s.id === bundledDefaultProjectId)
  ) {
    return bundledDefaultProjectId
  }
  if (!summaries.length) return bundledDefaultProjectId ?? null
  return [...summaries].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null
}
