import type { CameraMode } from '../rendering/camera';

export type ObservatoryShortcutAction =
  | Readonly<{ type: 'toggle-help' }>
  | Readonly<{ type: 'toggle-provenance' }>
  | Readonly<{ type: 'toggle-playback' }>
  | Readonly<{ type: 'toggle-direction' }>
  | Readonly<{ type: 'select-relative-body'; offset: -1 | 1 }>
  | Readonly<{ type: 'focus-selected-body' }>
  | Readonly<{ type: 'set-camera-mode'; mode: CameraMode }>
  | Readonly<{ type: 'toggle-render-scale' }>
  | Readonly<{ type: 'toggle-body-labels' }>
  | Readonly<{ type: 'toggle-orbit-lines' }>
  | Readonly<{ type: 'cancel-camera-motion' }>;

export interface ObservatoryShortcutDefinition {
  readonly keys: readonly string[];
  readonly label: string;
  readonly description: string;
}

export const OBSERVATORY_SHORTCUT_DEFINITIONS: readonly ObservatoryShortcutDefinition[] =
  Object.freeze([
    shortcut(['?'], 'Help', 'Open keyboard help.'),
    shortcut(['I'], 'Data sources', 'Open data-provider and provenance details.'),
    shortcut(['Space'], 'Run / pause', 'Toggle the simulation clock.'),
    shortcut(['R'], 'Reverse', 'Toggle forward and reverse simulation direction.'),
    shortcut(['[', ']'], 'Previous / next object', 'Select the adjacent observatory object.'),
    shortcut(['F'], 'Focus object', 'Focus the camera on the selected object.'),
    shortcut(['1'], 'Overview camera', 'Frame the planetary system.'),
    shortcut(['2'], 'Free-orbit camera', 'Orbit, pan, and dolly around the target.'),
    shortcut(['3'], 'Follow camera', 'Follow the selected object.'),
    shortcut(['4'], 'Top-down camera', 'Look down from ecliptic north.'),
    shortcut(['5'], 'Chase camera', 'Follow the selected object along its velocity.'),
    shortcut(['6'], 'Earth–Moon camera', 'Frame both bodies with linear orbital positions.'),
    shortcut(['S'], 'Scale mode', 'Toggle true and presentation render scales.'),
    shortcut(['L'], 'Object labels', 'Show or hide screen-space object labels.'),
    shortcut(['O'], 'Orbit lines', 'Show or hide ephemeris orbit lines.'),
    shortcut(['Escape'], 'Stop camera motion', 'Stop the tour and hand the current view to free orbit.'),
  ]);

export interface ObservatoryShortcutOptions {
  /** Evaluated for every keydown so modal overlays can suspend global commands. */
  readonly enabled?: () => boolean;
}

/**
 * Resolves a keydown without mutating browser state. Form fields, links,
 * buttons, editable content, modifier chords, composition, and held-key
 * repeats are intentionally ignored.
 */
export function resolveObservatoryShortcut(
  event: KeyboardEvent,
): ObservatoryShortcutAction | null {
  const key = normalizeKey(event.key);
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    isDialogShortcutTarget(event.target) ||
    (key !== 'Escape' && isInteractiveShortcutTarget(event.target))
  ) {
    return null;
  }

  switch (key) {
    case '?':
      return { type: 'toggle-help' };
    case 'i':
      return { type: 'toggle-provenance' };
    case ' ':
      return { type: 'toggle-playback' };
    case 'r':
      return { type: 'toggle-direction' };
    case '[':
      return { type: 'select-relative-body', offset: -1 };
    case ']':
      return { type: 'select-relative-body', offset: 1 };
    case 'f':
      return { type: 'focus-selected-body' };
    case '1':
      return { type: 'set-camera-mode', mode: 'overview' };
    case '2':
      return { type: 'set-camera-mode', mode: 'free-orbit' };
    case '3':
      return { type: 'set-camera-mode', mode: 'body-follow' };
    case '4':
      return { type: 'set-camera-mode', mode: 'top-down-ecliptic' };
    case '5':
      return { type: 'set-camera-mode', mode: 'chase' };
    case '6':
      return { type: 'set-camera-mode', mode: 'earth-moon-system' };
    case 's':
      return { type: 'toggle-render-scale' };
    case 'l':
      return { type: 'toggle-body-labels' };
    case 'o':
      return { type: 'toggle-orbit-lines' };
    case 'Escape':
      return { type: 'cancel-camera-motion' };
    default:
      return null;
  }
}

/** Returns true only when a command was dispatched and browser defaults were suppressed. */
export function handleObservatoryShortcut(
  event: KeyboardEvent,
  onAction: (action: ObservatoryShortcutAction) => void,
  options: ObservatoryShortcutOptions = {},
): boolean {
  if (options.enabled?.() === false) return false;

  const action = resolveObservatoryShortcut(event);
  if (action === null) return false;

  event.preventDefault();
  onAction(action);
  return true;
}

/** Creates the stable listener shape expected by window.addEventListener. */
export function createObservatoryShortcutHandler(
  onAction: (action: ObservatoryShortcutAction) => void,
  options: ObservatoryShortcutOptions = {},
): (event: KeyboardEvent) => void {
  return (event) => {
    handleObservatoryShortcut(event, onAction, options);
  };
}

export function isInteractiveShortcutTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== 'object') return false;
  const candidate = target as Partial<Element>;
  if (typeof candidate.closest !== 'function') return false;
  return candidate.closest(
    'input, textarea, select, button, a[href], summary, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="textbox"], [role="combobox"], [role="slider"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"], [role="dialog"]',
  ) !== null;
}

function isDialogShortcutTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== 'object') return false;
  const candidate = target as Partial<Element>;
  return typeof candidate.closest === 'function' && candidate.closest('[role="dialog"]') !== null;
}

function normalizeKey(key: string): string {
  if (key === 'Spacebar') return ' ';
  return key.length === 1 ? key.toLowerCase() : key;
}

function shortcut(
  keys: readonly string[],
  label: string,
  description: string,
): Readonly<ObservatoryShortcutDefinition> {
  return Object.freeze({ keys: Object.freeze([...keys]), label, description });
}
