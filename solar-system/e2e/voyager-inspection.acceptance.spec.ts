import { expect, test, type Locator, type Page } from '@playwright/test';

async function selectVoyager(page: Page, id: 'voyager-1' | 'voyager-2') {
  await page.locator('#body-search').fill(id.replace('-', ' '));
  await page.getByTestId('navigator-catalog-spacecraft-' + id).click();
  const canvas = page.getByTestId('solar-system-canvas');
  await expect(canvas).toHaveAttribute('data-space-object-detailed-inspection', id);
  await expect(canvas).toHaveAttribute('data-space-object-selected-on-screen', 'true');
  await expect(canvas).toHaveAttribute('data-scale-mode', 'true');
  return canvas;
}
const distance = async (canvas: Locator) => Number(await canvas.getAttribute('data-space-object-focus-distance-ratio'));

// An actual wheel event catches the app/runtime handoff as well as the renderer's
// former moon-framing clamp. Attribute-only unit tests miss both regressions.
test('both NASA Voyagers support persistent wheel/button zoom, orbit and clock tracking', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errors: string[] = [];
  let modelRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (request.url().endsWith('/voyager-nasa-web.glb')) modelRequests++; });
  await page.goto('./');
  const canvas = page.getByTestId('solar-system-canvas');
  await expect(canvas).toHaveAttribute('data-asset-state', 'ready', { timeout: 45_000 });
  expect(modelRequests).toBe(0);
  for (const id of ['voyager-1', 'voyager-2'] as const) {
    await selectVoyager(page, id);
    await expect(canvas).toHaveAttribute('data-voyager-model-state', 'ready', { timeout: 30_000 });
    await expect(canvas).toHaveAttribute('data-voyager-model-mesh-count', '4');
    await expect.poll(() => distance(canvas)).toBeGreaterThan(2);
    await page.getByTestId('viewport-fullscreen-toggle').click();
    await canvas.screenshot({ path: info.outputPath(id + '-full.png') });
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55);
    await page.mouse.wheel(0, -1100);
    await page.mouse.wheel(0, -1100);
    await expect.poll(() => distance(canvas)).toBeLessThan(1.1);
    const close = await distance(canvas);
    await page.waitForTimeout(700);
    expect(await distance(canvas)).toBeCloseTo(close, 2);
    await canvas.screenshot({ path: info.outputPath(id + '-detail.png') });
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.67, box.y + box.height * 0.60, { steps: 8 });
    await page.mouse.up();
    await expect(canvas).toHaveAttribute('data-space-object-selected-on-screen', 'true');
    await page.mouse.wheel(0, 2250);
    await page.mouse.wheel(0, 2250);
    await expect.poll(() => distance(canvas)).toBeGreaterThan(4.5);
    const far = await distance(canvas);
    await page.waitForTimeout(700);
    expect(await distance(canvas)).toBeCloseTo(far, 2);
    await page.getByTestId('viewport-fullscreen-toggle').click();
    await page.getByRole('button', { name: 'Frame selected spacecraft' }).click();
    await page.getByTestId('voyager-inspection-controls').getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(() => distance(canvas)).toBeLessThan(1.6);
    await page.getByTestId('voyager-inspection-controls').getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect.poll(() => distance(canvas)).toBeGreaterThan(2);
    const before = Number(await canvas.getAttribute('data-current-jd-tdb'));
    await page.locator('#time-preset').selectOption('forward-day');
    await expect.poll(async () => Number(await canvas.getAttribute('data-current-jd-tdb'))).toBeGreaterThan(before + 0.2);
    await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-space-object-selected-on-screen', 'true');
    expect(await distance(canvas)).toBeGreaterThan(2);
    expect(await distance(canvas)).toBeLessThan(2.4);
  }
  expect(modelRequests).toBe(1);
  await page.locator('#body-search').fill('Earth');
  await page.getByTestId('navigator-body-earth').click();
  await expect(canvas).toHaveAttribute('data-space-object-detailed-inspection', '');
  await expect(canvas).toHaveAttribute('data-selected-body', 'earth');
  expect(errors).toEqual([]);
});

test('a failed NASA model request preserves the Voyager locator and navigation', async ({ page }) => {
  test.setTimeout(60_000);
  await page.route('**/voyager-nasa-web.glb', route => route.abort());
  await page.goto('./');
  const canvas = await selectVoyager(page, 'voyager-2');
  await expect(canvas).toHaveAttribute('data-voyager-model-state', 'fallback');
  await expect(canvas).toHaveAttribute('data-space-object-selected-on-screen', 'true');
  await page.getByTestId('voyager-inspection-controls').getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect.poll(() => distance(canvas)).toBeLessThan(2);
});
