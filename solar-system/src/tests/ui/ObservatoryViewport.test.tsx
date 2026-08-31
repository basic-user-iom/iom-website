// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { ObservatoryViewport } from '../../ui/observatory/ObservatoryViewport';

const reactTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('ObservatoryViewport fullscreen control', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fullscreenElement: Element | null;
  let rejectFullscreenRequest: boolean;
  let requestFullscreen: ReturnType<typeof vi.fn>;
  let exitFullscreen: ReturnType<typeof vi.fn>;
  let originalFullscreenElement: PropertyDescriptor | undefined;
  let originalFullscreenEnabled: PropertyDescriptor | undefined;
  let originalRequestFullscreen: PropertyDescriptor | undefined;
  let originalExitFullscreen: PropertyDescriptor | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'root';
    document.body.append(container);
    root = createRoot(container);
    fullscreenElement = null;
    rejectFullscreenRequest = false;

    originalFullscreenElement = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'fullscreenElement',
    );
    originalFullscreenEnabled = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'fullscreenEnabled',
    );
    originalRequestFullscreen = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'requestFullscreen',
    );
    originalExitFullscreen = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'exitFullscreen',
    );

    requestFullscreen = vi.fn((target: HTMLElement) => {
      if (rejectFullscreenRequest) {
        return Promise.reject(new DOMException('Fullscreen denied', 'NotAllowedError'));
      }
      fullscreenElement = target;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    });
    exitFullscreen = vi.fn(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    });

    Object.defineProperty(Document.prototype, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: function requestFullscreenMock(this: HTMLElement) {
        return requestFullscreen(this);
      },
    });
    Object.defineProperty(Document.prototype, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.classList.remove('observatory-viewport-expanded');
    restoreProperty(Document.prototype, 'fullscreenElement', originalFullscreenElement);
    restoreProperty(Document.prototype, 'fullscreenEnabled', originalFullscreenEnabled);
    restoreProperty(HTMLElement.prototype, 'requestFullscreen', originalRequestFullscreen);
    restoreProperty(Document.prototype, 'exitFullscreen', originalExitFullscreen);
  });

  it('exposes an accessible toggle and enters and exits native fullscreen on the whole stage', async () => {
    renderViewport();
    const viewport = requiredElement<HTMLElement>('[data-testid="observatory-viewport"]');
    const toggle = requiredElement<HTMLButtonElement>('[data-testid="viewport-fullscreen-toggle"]');

    expect(toggle.getAttribute('aria-controls')).toBe(viewport.id);
    expect(toggle.getAttribute('aria-label')).toBe('Open full screen space view');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      toggle.click();
      await Promise.resolve();
    });

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(requestFullscreen).toHaveBeenCalledWith(viewport);
    expect(viewport.dataset.fullscreenMode).toBe('native');
    expect(viewport.dataset.fullscreenActive).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Exit full screen space view');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      toggle.click();
      await Promise.resolve();
    });

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(viewport.dataset.fullscreenMode).toBe('idle');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('synchronizes its pressed state when the browser exits with Escape', async () => {
    renderViewport();
    const viewport = requiredElement<HTMLElement>('[data-testid="observatory-viewport"]');
    const toggle = requiredElement<HTMLButtonElement>('[data-testid="viewport-fullscreen-toggle"]');

    await act(async () => {
      toggle.click();
      await Promise.resolve();
    });
    toggle.focus();

    await act(async () => {
      fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    expect(viewport.dataset.fullscreenMode).toBe('idle');
    expect(toggle.getAttribute('aria-label')).toBe('Open full screen space view');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('uses an Escape-dismissable viewport fallback when native fullscreen is denied', async () => {
    rejectFullscreenRequest = true;
    renderViewport();
    const viewport = requiredElement<HTMLElement>('[data-testid="observatory-viewport"]');
    const toggle = requiredElement<HTMLButtonElement>('[data-testid="viewport-fullscreen-toggle"]');

    await act(async () => {
      toggle.click();
      await Promise.resolve();
    });

    expect(viewport.dataset.fullscreenMode).toBe('fallback');
    expect(viewport.dataset.fullscreenActive).toBe('true');
    expect(document.body.classList.contains('observatory-viewport-expanded')).toBe(true);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });

    expect(viewport.dataset.fullscreenMode).toBe('idle');
    expect(document.body.classList.contains('observatory-viewport-expanded')).toBe(false);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  function renderViewport() {
    act(() => {
      root.render(
        <ObservatoryViewport closeUpActive={false} ariaLabel="Interactive space view">
          <div data-testid="viewport-child">Space</div>
        </ObservatoryViewport>,
      );
    });
  }
});

function requiredElement<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Expected element matching ${selector}.`);
  return element;
}

function restoreProperty(
  target: object,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor === undefined) {
    Reflect.deleteProperty(target, property);
    return;
  }
  Object.defineProperty(target, property, descriptor);
}
