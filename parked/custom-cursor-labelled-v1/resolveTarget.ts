import type { CursorMode, ResolvedCursor } from './types'
import { getProgrammaticCursor } from './api'

const LABELLED_MODES = new Set<CursorMode>([
  'view',
  'play',
  'pause',
  'explore',
  'drag',
  'look',
  'start',
])

const DEFAULT_LABELS: Partial<Record<CursorMode, string>> = {
  view: 'VIEW',
  play: 'PLAY',
  pause: 'PAUSE',
  explore: 'EXPLORE',
  drag: 'DRAG',
  look: 'LOOK',
  start: 'START',
}

const NATIVE_SELECTOR =
  'input, textarea, select, option, [contenteditable="true"], [contenteditable=""], [data-cursor="native"], .iom-cursor-native'

const CONTROL_SELECTOR =
  'a[href], button, summary, [role="button"], [role="link"], label[for]'

const CURSOR_HOST_SELECTOR = '[data-cursor]'

function isDisabled(el: Element): boolean {
  if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
    return el.disabled
  }
  if (el.getAttribute('aria-disabled') === 'true') return true
  return false
}

function iconForMode(mode: CursorMode): ResolvedCursor['icon'] {
  if (mode === 'external') return 'external'
  if (mode === 'drag') return 'drag'
  if (mode === 'look') return 'look'
  return 'none'
}

function resolveLabel(mode: CursorMode, custom: string | null, dragging: boolean): string | null {
  if (custom) return custom.toUpperCase()
  if (mode === 'drag' && dragging) return 'MOVE'
  if (!LABELLED_MODES.has(mode)) return null
  return DEFAULT_LABELS[mode] ?? null
}

function parseMode(raw: string | null): CursorMode | null {
  if (!raw) return null
  switch (raw) {
    case 'view':
    case 'play':
    case 'pause':
    case 'explore':
    case 'drag':
    case 'look':
    case 'start':
    case 'external':
    case 'link':
    case 'native':
    case 'default':
      return raw
    case 'none':
      return 'native'
    default:
      return null
  }
}

function finalize(
  mode: CursorMode,
  customLabel: string | null,
  dragging: boolean,
): ResolvedCursor {
  let next = mode
  if ((next === 'look' || next === 'explore') && dragging) {
    next = 'drag'
  }
  return {
    mode: next,
    label: resolveLabel(next, customLabel, dragging),
    icon: iconForMode(next),
  }
}

/**
 * Resolve the active cursor mode from the element under the pointer.
 * Programmatic overrides win. Nested buttons/links inside a data-cursor region
 * keep their own chrome behaviour unless they declare data-cursor.
 */
export function resolveCursorFromTarget(
  target: EventTarget | null,
  options: { dragging: boolean } = { dragging: false },
): ResolvedCursor {
  const prog = getProgrammaticCursor()

  if (prog.mode === 'native') {
    return { mode: 'native', label: null, icon: 'none' }
  }

  if (prog.mode && prog.mode !== 'default') {
    return finalize(prog.mode, prog.label, options.dragging)
  }

  const el = target instanceof Element ? target : null
  if (!el) {
    return { mode: 'default', label: prog.label, icon: 'none' }
  }

  if (el.closest(NATIVE_SELECTOR)) {
    return { mode: 'native', label: null, icon: 'none' }
  }

  const host = el.closest(CURSOR_HOST_SELECTOR)
  const control = el.closest(CONTROL_SELECTOR)

  // Nested chrome (HUD buttons, source links) inside a labelled region:
  // prefer the control when it has its own data-cursor, or when it is a
  // distinct interactive control that isn't the host itself.
  if (control && !isDisabled(control)) {
    const ownMode = parseMode(control.getAttribute('data-cursor'))
    if (ownMode === 'native' || ownMode === 'default') {
      return { mode: ownMode === 'native' ? 'native' : 'default', label: null, icon: 'none' }
    }
    if (ownMode) {
      let mode = ownMode
      if (mode === 'play' && control.getAttribute('data-cursor-playing') === 'true') {
        mode = 'pause'
      }
      const customLabel = control.getAttribute('data-cursor-label')
      return finalize(mode, customLabel || prog.label, options.dragging)
    }

    if (!host || host !== control) {
      // Inherit labelled parent for primary card actions / preview hit areas.
      const inherit =
        host &&
        (control.classList.contains('card-link') ||
          control.classList.contains('card-preview-open') ||
          control.classList.contains('hero-start-btn'))
      if (!inherit) {
        return { mode: 'link', label: null, icon: 'none' }
      }
    }
  }

  if (host && !isDisabled(host)) {
    const attrMode = parseMode(host.getAttribute('data-cursor'))
    if (attrMode === 'native' || attrMode === 'default') {
      return { mode: attrMode === 'native' ? 'native' : 'default', label: null, icon: 'none' }
    }
    if (attrMode) {
      let mode = attrMode
      if (mode === 'play' && host.getAttribute('data-cursor-playing') === 'true') {
        mode = 'pause'
      }
      const customLabel = host.getAttribute('data-cursor-label')
      return finalize(mode, customLabel || prog.label, options.dragging)
    }
  }

  if (control && !isDisabled(control)) {
    return { mode: 'link', label: null, icon: 'none' }
  }

  return { mode: 'default', label: prog.label, icon: 'none' }
}
