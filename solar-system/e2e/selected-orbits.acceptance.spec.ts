import { test, expect } from '@playwright/test';

test('selected planets keep their full available orbit instead of a short trail', async ({ page, browserName }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.getByTestId('startup-screen')).toBeHidden({ timeout: 90_000 });
  const canvas = page.getByTestId('solar-system-canvas');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const id of ['earth', 'mars', 'jupiter', 'saturn', 'neptune', 'earth']) {
    await page.getByTestId('planets-menu-toggle').click();
    await page.getByTestId(`legend-body-${id}`).click();
    await expect(canvas).toHaveAttribute('data-selected-orbit-visible', 'true');
    await expect(canvas).toHaveAttribute('data-selected-trail-visible', 'false');
    if (id === 'neptune') await expect(canvas).toHaveAttribute('data-selected-orbit-span-days', '60190');
    await page.getByTestId('system-overview').click();
    await expect(canvas).toHaveAttribute('data-selected-orbit-visible', 'true');
  }
  if (browserName === 'chromium') {
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -1200);
    await page.waitForTimeout(400);
    await expect(canvas).toHaveAttribute('data-selected-orbit-visible', 'true');
  }
  await page.screenshot({ path: info.outputPath('earth-orbit-mobile.png') });
  await page.locator('#toggle-view').click();
  await page.getByTestId('render-scale-controls').getByRole('button', { name: 'Presentation', exact: true }).click();
  await page.getByRole('button', { name: 'Close view', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-selected-orbit-visible', 'true');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(canvas).toHaveAttribute('data-selected-orbit-visible', 'true');
  await page.screenshot({ path: info.outputPath('earth-orbit-landscape.png') });
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(canvas).toHaveAttribute('data-selected-orbit-visible', 'true');
  expect(errors).toEqual([]);
});


test('an unavailable Neptune extension leaves the original data and coverage warning usable', async ({page}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({width:390,height:844});
  await page.route('**/neptune-orbit/**', route => route.request().resourceType() === 'fetch' ? route.abort('failed') : route.continue());
  await page.goto('./');
  await expect(page.getByTestId('startup-screen')).toBeHidden({timeout:90_000});
  await page.getByTestId('planets-menu-toggle').click();
  await page.getByTestId('legend-body-neptune').click();
  const canvas = page.getByTestId('solar-system-canvas');
  await expect(canvas).toHaveAttribute('data-selected-orbit-span-days', '36525');
  await expect(canvas).toHaveAttribute('data-selected-orbit-visible', 'true');
});
