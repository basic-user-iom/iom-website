import { expect, test, type Page } from '@playwright/test';

test('fullscreen control targets the complete observatory viewport and follows browser Escape', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page);
  await installFullscreenMock(page, false);
  await page.goto('./', { waitUntil: 'domcontentloaded' });

  const viewport = page.getByTestId('observatory-viewport');
  const toggle = page.getByTestId('viewport-fullscreen-toggle');
  await expect(viewport).toBeVisible();
  await expect(toggle).toHaveAccessibleName('Open full screen space view');
  await expect(toggle).toHaveAttribute('aria-controls', 'observatory-viewport');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(viewport.locator(toggle)).toHaveCount(1);

  await toggle.focus();
  await page.keyboard.press('Enter');

  await expect(viewport).toHaveAttribute('data-fullscreen-mode', 'native');
  await expect(viewport).toHaveAttribute('data-fullscreen-active', 'true');
  await expect(toggle).toHaveAccessibleName('Exit full screen space view');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => fullscreenMockState(page))
    .toMatchObject({ requests: 1, requestedTestId: 'observatory-viewport' });

  await page.keyboard.press('Escape');

  await expect(viewport).toHaveAttribute('data-fullscreen-mode', 'idle');
  await expect(toggle).toHaveAccessibleName('Open full screen space view');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toBeFocused();
  expect(browserErrors, browserErrors.join('\n')).toEqual([]);
});

test('denied native fullscreen falls back to a clean desktop space view that resizes WebGL', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await installFullscreenMock(page, true);
  await page.goto('./', { waitUntil: 'domcontentloaded' });

  const viewport = page.getByTestId('observatory-viewport');
  const canvas = page.getByTestId('solar-system-canvas');
  const toggle = page.getByTestId('viewport-fullscreen-toggle');
  const legend = page.locator('.canvas-legend');
  await expect(page.getByTestId('ephemeris-provider-badge')).toContainText(
    /generated offline bundle/i,
    { timeout: 15_000 },
  );
  const initialCanvasHeight = await canvas.evaluate((element) => element.getBoundingClientRect().height);

  await toggle.click();

  await expect(viewport).toHaveAttribute('data-fullscreen-mode', 'fallback');
  await expect(viewport).toHaveAttribute('data-fullscreen-active', 'true');
  await expect(page.locator('body')).toHaveClass(/observatory-viewport-expanded/);
  await expect(page.locator('.canvas-topbar')).not.toContainText(/Phase\s+\d+/i);
  await expect(toggle).toBeVisible();
  await expect(legend).toBeVisible();
  await expect.poll(() => legend.evaluate((element) => element.getBoundingClientRect().height))
    .toBeLessThanOrEqual(46);

  await expect.poll(() => rectFor(viewport)).toMatchObject({
    x: 0,
    y: 0,
    width: 1280,
    height: 800,
  });
  await expect.poll(() => canvas.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(
    initialCanvasHeight,
  );
  await expect.poll(() => canvasBackingBufferCoversLayout(canvas)).toBe(true);
  await expect.poll(() => elementIsInsideViewport(toggle, page)).toBe(true);
  await expect.poll(() => elementIsInsideViewport(legend, page)).toBe(true);
  await expect.poll(() => legend.evaluate((element) => element.getBoundingClientRect().height))
    .toBeLessThanOrEqual(46);
  await expect.poll(() => toggleReceivesHitTest(page)).toBe(true);

  await toggle.click();
  await expect(viewport).toHaveAttribute('data-fullscreen-mode', 'idle');
  await expect(page.locator('body')).not.toHaveClass(/observatory-viewport-expanded/);
  expect(browserErrors, browserErrors.join('\n')).toEqual([]);
});

test('fallback fullscreen keeps its exit control reachable on a narrow screen', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page);
  await page.setViewportSize({ width: 390, height: 700 });
  await installFullscreenMock(page, true);
  await page.goto('./', { waitUntil: 'domcontentloaded' });

  const viewport = page.getByTestId('observatory-viewport');
  const toggle = page.getByTestId('viewport-fullscreen-toggle');
  const legend = page.locator('.canvas-legend');
  await expect(toggle).toBeVisible();
  await toggle.click();

  await expect(viewport).toHaveAttribute('data-fullscreen-mode', 'fallback');
  await expect.poll(() => rectFor(viewport)).toMatchObject({
    x: 0,
    y: 0,
    width: 390,
    height: 700,
  });
  const toggleBox = await toggle.boundingBox();
  expect(toggleBox?.width).toBeGreaterThanOrEqual(44);
  expect(toggleBox?.height).toBeGreaterThanOrEqual(44);
  await expect.poll(() => elementIsInsideViewport(toggle, page)).toBe(true);
  await expect.poll(() => elementIsInsideViewport(legend, page)).toBe(true);
  await expect.poll(() => legend.evaluate((element) => element.getBoundingClientRect().height))
    .toBeLessThanOrEqual(46);
  await expect.poll(() => legend.evaluate((element) => element.scrollWidth > element.clientWidth))
    .toBe(true);
  await expect.poll(() => toggleReceivesHitTest(page)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(viewport).toHaveAttribute('data-fullscreen-mode', 'idle');
  expect(browserErrors, browserErrors.join('\n')).toEqual([]);
});

async function installFullscreenMock(page: Page, rejectRequest: boolean) {
  await page.addInitScript(
    ({ reject }) => {
      let activeElement: Element | null = null;
      const state = {
        requests: 0,
        exits: 0,
        requestedTestId: null as string | null,
      };
      Object.defineProperty(window, '__observatoryFullscreenMock', { value: state });
      Object.defineProperty(Document.prototype, 'fullscreenElement', {
        configurable: true,
        get: () => activeElement,
      });
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', {
        configurable: true,
        get: () => true,
      });
      const requestFullscreen = (target: HTMLElement) => {
        state.requests += 1;
        state.requestedTestId = target.dataset.testid ?? null;
        if (reject) return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
        activeElement = target;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      };
      Object.defineProperty(Element.prototype, 'requestFullscreen', {
        configurable: true,
        value: function requestFullscreenMock(this: HTMLElement) {
          return requestFullscreen(this);
        },
      });
      Object.defineProperty(Document.prototype, 'exitFullscreen', {
        configurable: true,
        value: function exitFullscreenMock() {
          state.exits += 1;
          activeElement = null;
          document.dispatchEvent(new Event('fullscreenchange'));
          return Promise.resolve();
        },
      });
      window.addEventListener(
        'keydown',
        (event) => {
          if (event.key !== 'Escape' || activeElement === null) return;
          activeElement = null;
          document.dispatchEvent(new Event('fullscreenchange'));
        },
        true,
      );
    },
    { reject: rejectRequest },
  );
}

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  return errors;
}

async function fullscreenMockState(page: Page) {
  return page.evaluate(() => {
    return (
      window as typeof window & {
        __observatoryFullscreenMock: {
          requests: number;
          exits: number;
          requestedTestId: string | null;
        };
      }
    ).__observatoryFullscreenMock;
  });
}

async function rectFor(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

async function canvasBackingBufferCoversLayout(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return canvas.width >= Math.floor(rect.width) && canvas.height >= Math.floor(rect.height);
  });
}

async function elementIsInsideViewport(locator: ReturnType<Page['locator']>, page: Page) {
  const rect = await rectFor(locator);
  const viewport = page.viewportSize();
  if (viewport === null) return false;
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= viewport.width + 0.5 &&
    rect.y + rect.height <= viewport.height + 0.5
  );
}

async function toggleReceivesHitTest(page: Page) {
  return page.getByTestId('viewport-fullscreen-toggle').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit === element || (hit !== null && element.contains(hit));
  });
}
