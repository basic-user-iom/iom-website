import type { CursorMode, ProgrammaticCursor } from './types'

const listeners = new Set<() => void>()

const programmatic: ProgrammaticCursor = {
  mode: null,
  label: null,
}

function notify() {
  listeners.forEach((fn) => fn())
}

/** Subscribe to programmatic cursor changes (used by the mount loop). */
export function subscribeCursorApi(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getProgrammaticCursor(): ProgrammaticCursor {
  return programmatic
}

/**
 * Override the cursor mode from complex surfaces (WebGL viewers, orbit controls).
 * Pass `"default"` or `null` to clear the override.
 */
export function setCursorState(mode: CursorMode | 'default' | null): void {
  const next = mode === 'default' || mode == null ? null : mode
  if (programmatic.mode === next) return
  programmatic.mode = next
  notify()
}

/** Optional label override (e.g. `ENTER 3D`). Pass `null` to clear. */
export function setCursorLabel(label: string | null): void {
  const next = label && label.trim() ? label.trim() : null
  if (programmatic.label === next) return
  programmatic.label = next
  notify()
}

export function clearCursorOverride(): void {
  if (programmatic.mode == null && programmatic.label == null) return
  programmatic.mode = null
  programmatic.label = null
  notify()
}
