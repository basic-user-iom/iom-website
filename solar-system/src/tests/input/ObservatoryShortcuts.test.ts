// @vitest-environment jsdom

import {
  OBSERVATORY_SHORTCUT_DEFINITIONS,
  handleObservatoryShortcut,
  resolveObservatoryShortcut,
  type ObservatoryShortcutAction,
} from '../../input/ObservatoryShortcuts';

describe('Phase 7 observatory shortcuts', () => {
  it.each<readonly [string, ObservatoryShortcutAction]>([
    ['?', { type: 'toggle-help' }],
    ['I', { type: 'toggle-provenance' }],
    [' ', { type: 'toggle-playback' }],
    ['R', { type: 'toggle-direction' }],
    ['[', { type: 'select-relative-body', offset: -1 }],
    [']', { type: 'select-relative-body', offset: 1 }],
    ['f', { type: 'focus-selected-body' }],
    ['1', { type: 'set-camera-mode', mode: 'overview' }],
    ['2', { type: 'set-camera-mode', mode: 'free-orbit' }],
    ['3', { type: 'set-camera-mode', mode: 'body-follow' }],
    ['4', { type: 'set-camera-mode', mode: 'top-down-ecliptic' }],
    ['5', { type: 'set-camera-mode', mode: 'chase' }],
    ['6', { type: 'set-camera-mode', mode: 'earth-moon-system' }],
    ['s', { type: 'toggle-render-scale' }],
    ['L', { type: 'toggle-body-labels' }],
    ['o', { type: 'toggle-orbit-lines' }],
    ['Escape', { type: 'cancel-camera-motion' }],
  ])('maps %s to an explicit action', (key, expected) => {
    expect(resolveObservatoryShortcut(keydown(key))).toEqual(expected);
  });

  it('suppresses browser defaults only for dispatched commands', () => {
    const actions: ObservatoryShortcutAction[] = [];
    const recognized = keydown(' ');
    const unrecognized = keydown('x');

    expect(handleObservatoryShortcut(recognized, (action) => actions.push(action))).toBe(true);
    expect(recognized.defaultPrevented).toBe(true);
    expect(handleObservatoryShortcut(unrecognized, (action) => actions.push(action))).toBe(false);
    expect(unrecognized.defaultPrevented).toBe(false);
    expect(actions).toEqual([{ type: 'toggle-playback' }]);
  });

  it('does not steal keys from interactive or editable content', () => {
    for (const element of [
      document.createElement('input'),
      document.createElement('textarea'),
      document.createElement('select'),
      document.createElement('button'),
      Object.assign(document.createElement('a'), { href: '#test' }),
    ]) {
      document.body.append(element);
      let action: ObservatoryShortcutAction | null | undefined;
      element.addEventListener('keydown', (event) => {
        action = resolveObservatoryShortcut(event as KeyboardEvent);
      });
      element.dispatchEvent(keydown(' '));
      expect(action).toBeNull();
      element.remove();
    }

    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const nested = document.createElement('span');
    editor.append(nested);
    document.body.append(editor);
    let nestedAction: ObservatoryShortcutAction | null | undefined;
    nested.addEventListener('keydown', (event) => {
      nestedAction = resolveObservatoryShortcut(event);
    });
    nested.dispatchEvent(keydown('f'));
    expect(nestedAction).toBeNull();
  });

  it('allows Escape to cancel camera motion from interactive controls outside dialogs', () => {
    for (const element of [document.createElement('input'), document.createElement('button')]) {
      document.body.append(element);
      let action: ObservatoryShortcutAction | null | undefined;
      element.addEventListener('keydown', (event) => {
        action = resolveObservatoryShortcut(event as KeyboardEvent);
      });
      element.dispatchEvent(keydown('Escape'));
      expect(action).toEqual({ type: 'cancel-camera-motion' });
      element.remove();
    }

    const dialog = document.createElement('section');
    dialog.setAttribute('role', 'dialog');
    const dialogButton = document.createElement('button');
    dialog.append(dialogButton);
    document.body.append(dialog);
    let dialogAction: ObservatoryShortcutAction | null | undefined;
    dialogButton.addEventListener('keydown', (event) => {
      dialogAction = resolveObservatoryShortcut(event);
    });
    dialogButton.dispatchEvent(keydown('Escape'));
    expect(dialogAction).toBeNull();
  });

  it('ignores modifier chords, composition, repeated keys, and handled events', () => {
    expect(resolveObservatoryShortcut(keydown('f', { ctrlKey: true }))).toBeNull();
    expect(resolveObservatoryShortcut(keydown('f', { altKey: true }))).toBeNull();
    expect(resolveObservatoryShortcut(keydown('f', { metaKey: true }))).toBeNull();
    expect(resolveObservatoryShortcut(keydown('f', { repeat: true }))).toBeNull();
    expect(resolveObservatoryShortcut(keydown('f', { isComposing: true }))).toBeNull();
    const handled = keydown('f');
    handled.preventDefault();
    expect(resolveObservatoryShortcut(handled)).toBeNull();
  });

  it('supports a live enabled guard for modal overlays', () => {
    const event = keydown('?');
    const actions: ObservatoryShortcutAction[] = [];
    expect(
      handleObservatoryShortcut(event, (action) => actions.push(action), {
        enabled: () => false,
      }),
    ).toBe(false);
    expect(actions).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it('exports immutable help metadata for every command family', () => {
    expect(OBSERVATORY_SHORTCUT_DEFINITIONS).toHaveLength(16);
    expect(Object.isFrozen(OBSERVATORY_SHORTCUT_DEFINITIONS)).toBe(true);
    expect(
      OBSERVATORY_SHORTCUT_DEFINITIONS.every(
        (definition) => Object.isFrozen(definition) && Object.isFrozen(definition.keys),
      ),
    ).toBe(true);
    expect(
      OBSERVATORY_SHORTCUT_DEFINITIONS.find((definition) => definition.keys.includes('R')),
    ).toMatchObject({ label: 'Reverse' });
    expect(
      OBSERVATORY_SHORTCUT_DEFINITIONS.find((definition) => definition.keys.includes('6')),
    ).toMatchObject({
      label: 'Earth–Moon camera',
      description: 'Frame both bodies with linear orbital positions.',
    });
    expect(
      OBSERVATORY_SHORTCUT_DEFINITIONS.filter((definition) =>
        definition.keys.some((key) => key === '?' || key === 'I'),
      ).every((definition) => !definition.description.includes('close')),
    ).toBe(true);
  });
});

function keydown(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
}
