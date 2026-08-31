// @vitest-environment jsdom

import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { ObservatoryDialog } from '../../ui/observatory/ObservatoryDialog';

const reactTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('Phase 7 ObservatoryDialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'root';
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.getElementById('observatory-viewport')?.remove();
  });

  it('exposes modal naming and moves focus to a requested initial control', () => {
    act(() => root.render(<DialogHarness initiallyOpen />));

    const dialog = requiredElement<HTMLElement>('[role="dialog"]');
    const backdrop = dialog.parentElement;
    const descriptionId = dialog.getAttribute('aria-describedby');
    expect(backdrop?.classList.contains('observatory-dialog-backdrop')).toBe(true);
    expect(backdrop?.parentElement).toBe(document.body);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(
      'Keyboard help',
    );
    expect(document.getElementById(descriptionId ?? '')?.textContent).toBe('Dialog description');
    expect(document.activeElement).toBe(requiredElement('#dialog-first'));
  });

  it('wraps Tab and Shift+Tab within the dialog', () => {
    act(() => root.render(<DialogHarness initiallyOpen />));
    const close = requiredElement<HTMLButtonElement>('[aria-label="Close: Keyboard help"]');
    const last = requiredElement<HTMLButtonElement>('#dialog-last');

    last.focus();
    act(() => document.dispatchEvent(keydown('Tab')));
    expect(document.activeElement).toBe(close);

    close.focus();
    act(() => document.dispatchEvent(keydown('Tab', { shiftKey: true })));
    expect(document.activeElement).toBe(last);
  });

  it('closes on Escape and restores focus to the opener', () => {
    act(() => root.render(<DialogHarness />));
    const opener = requiredElement<HTMLButtonElement>('#dialog-opener');
    opener.focus();
    act(() => opener.click());
    expect(requiredElement('[role="dialog"]')).not.toBeNull();

    act(() => document.dispatchEvent(keydown('Escape')));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('portals into the expanded space view so dialogs remain visible in fullscreen', () => {
    const viewport = document.createElement('section');
    viewport.id = 'observatory-viewport';
    viewport.dataset.fullscreenActive = 'true';
    document.body.append(viewport);

    act(() => root.render(<DialogHarness initiallyOpen />));

    const dialog = requiredElement<HTMLElement>('[role="dialog"]');
    expect(dialog.parentElement?.parentElement).toBe(viewport);
  });
});

function DialogHarness({ initiallyOpen = false }: { readonly initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button id="dialog-opener" type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <ObservatoryDialog
        open={open}
        title="Keyboard help"
        description="Dialog description"
        onClose={() => setOpen(false)}
        initialFocusRef={initialFocusRef}
      >
        <button id="dialog-first" ref={initialFocusRef} type="button">
          First
        </button>
        <a href="#source">Source</a>
        <button id="dialog-last" type="button">
          Last
        </button>
      </ObservatoryDialog>
    </>
  );
}

function requiredElement<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Expected element matching ${selector}.`);
  return element;
}

function keydown(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
}
