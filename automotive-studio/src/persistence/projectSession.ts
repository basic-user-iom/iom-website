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
 * Prefer explicit `?project=`, then last-opened, then most recently saved.
 */
export function resolveBootProjectId(options: {
  queryProjectId: string | null
  lastProjectId: string | null
  summaries: Array<{ id: string; updatedAt: number }>
}): string | null {
  const { queryProjectId, lastProjectId, summaries } = options
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
  if (!summaries.length) return null
  return [...summaries].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null
}
