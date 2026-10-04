import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
for (const textOnly of [false, true]) {
  test(`seasons and lunar lessons complete, restore state and restart (${textOnly ? 'text' : '3D'})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    if (textOnly) await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, options?: unknown) {
        return type === 'webgl2' ? null : Reflect.apply(original, this, [type, options]);
      } as typeof original;
    });
    await page.goto('./');
    await expect(page.getByTestId('startup-screen')).toBeHidden({ timeout: 60_000 });
    await expect(page.getByTestId('learn-start')).toBeEnabled();
    if (textOnly) await expect(page.getByTestId('data-mode-panel')).toContainText('Distance from Sun');
    else await expect(page.getByTestId('solar-system-canvas')).toHaveAttribute('data-asset-state', 'ready', { timeout: 60_000 });
    await page.waitForTimeout(300);
    const capture = () => page.evaluate(() => ({
      utc: (document.querySelector('#exact-utc-time') as HTMLInputElement).value,
      rate: document.querySelector('output[for="log-speed"]')?.textContent,
      scale: document.querySelector('[data-testid="render-scale-controls"] [aria-pressed="true"]')?.textContent,
      camera: (document.querySelector('canvas') as HTMLCanvasElement).dataset.cameraPosition,
      target: (document.querySelector('canvas') as HTMLCanvasElement).dataset.cameraWorldTarget,
    }));
    const before = await capture();
    await page.getByTestId('learn-start').tap();
    await expect(page.getByTestId('lesson-picker')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('learn-start')).toBeFocused();
    expect(await capture()).toEqual(before);
    for (const id of ['seasons', 'moon'] as const) {
      await page.getByTestId('learn-start').tap();
      await page.getByTestId(`learn-${id}`).tap();
      const panel = page.getByTestId('lesson-panel');
      await expect(panel).toHaveAttribute('data-lesson-id', id);
      await expect(page.getByTestId('lesson-step-title')).toBeFocused();
      await expect(panel.locator('.lesson-date-notice')).toContainText(id === 'seasons' ? '2026-06-21' : '2026-01-26');
      if (id === 'seasons') {
        await expect(page.getByTestId('solar-declination')).toHaveText('23.4° N');
        await expect(page.getByTestId('season-readout')).toContainText('15.4 h daylight');
        await page.getByRole('button', { name: 'Next', exact: true }).tap();
        await expect(page.getByTestId('solar-declination')).toHaveText('23.4° S');
        await page.getByRole('button', { name: 'Next', exact: true }).tap();
        await expect(page.getByTestId('season-readout')).toContainText('12.0 h daylight');
        await page.getByRole('button', { name: 'Next', exact: true }).tap();
        await expect(page.getByTestId('season-readout')).toContainText('0.983 AU');
        await page.getByRole('button', { name: 'Next', exact: true }).tap();
      } else {
        await expect(page.getByTestId('moon-illuminated')).toContainText('waxing');
        await page.getByRole('button', { name: 'Next', exact: true }).tap();
        expect(parseFloat(await page.getByTestId('moon-illuminated').innerText())).toBeLessThan(1);
        await page.getByRole('button', { name: 'Next', exact: true }).tap();
        expect(parseFloat(await page.getByTestId('moon-illuminated').innerText())).toBeGreaterThan(99);
        await page.getByRole('button', { name: 'Next', exact: true }).tap();
        await expect(page.getByTestId('moon-illuminated')).toContainText('waning');
        await page.getByRole('button', { name: 'Next', exact: true }).tap();
        await expect(panel.locator('figcaption')).toContainText('No prediction');
        await page.getByRole('button', { name: 'Next', exact: true }).tap();
      }
      await page.getByTestId('lesson-answer-0-0').tap();
      await expect(panel).toContainText('Not quite.');
      await page.getByTestId('lesson-answer-0-1').tap();
      await page.getByTestId('lesson-answer-1-0').tap();
      await expect(panel.getByRole('status')).toHaveCount(2);
      await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Restart', exact: true }).tap();
      await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
      if (!textOnly) {
        const dateBefore = await panel.locator('.lesson-date-notice').innerText();
        await page.getByRole('button', { name: 'Play time · 1 day/s', exact: true }).tap();
        await expect(panel.locator('.lesson-date-notice')).not.toHaveText(dateBefore);
        await page.getByRole('button', { name: 'Pause time', exact: true }).tap();
      }
      await page.getByTestId('lesson-exit').tap();
      await expect(panel).toBeHidden();
      await page.waitForTimeout(300);
      expect(await capture()).toEqual(before);
      await expect(page.getByTestId('learn-start')).toBeFocused();
      await page.getByTestId('viewport-fullscreen-toggle').tap();
      await page.getByTestId('learn-start').tap();
      await page.getByTestId(`learn-${id}`).tap();
      await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
      await page.getByTestId('lesson-exit').tap();
      await page.getByTestId('viewport-fullscreen-toggle').tap();
    }
    expect(errors).toEqual([]);
  });
}

test('seasons and Moon explanations remain honest when orbital data cannot load', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, options?: unknown) {
      return type === 'webgl2' ? null : Reflect.apply(original, this, [type, options]);
    } as typeof original;
  });
  await page.route('**/*ephemeris.v1*.bin', route => route.abort('failed'));
  await page.goto('./');
  await expect(page.getByTestId('data-mode-panel')).toContainText('Orbital data unavailable');
  for (const id of ['seasons', 'moon']) {
    await page.getByTestId('learn-start').tap();
    await page.getByTestId(`learn-${id}`).tap();
    await expect(page.getByTestId('lesson-panel').locator('.lesson-date-notice')).toContainText('data unavailable');
    await expect(page.getByTestId('lesson-panel')).toContainText('measurements are unavailable without orbital data');
    await expect(page.getByTestId(id === 'moon' ? 'moon-readout' : 'season-readout')).toHaveCount(0);
    await page.getByTestId('lesson-exit').tap();
  }
});
