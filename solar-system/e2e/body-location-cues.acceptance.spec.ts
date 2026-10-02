import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

test('shows round location dots at true scale and fades them into resolved bodies', async ({ page }) => {
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  const canvas = page.getByTestId('solar-system-canvas')
  await expect(canvas).toHaveAttribute('data-asset-state', 'ready', { timeout: 60_000 })
  await expect(page.getByTestId('startup-screen')).toBeHidden()
  await page.getByTestId('system-overview').click()
  const dots = page.locator('.body-location-dot')
  await expect(dots).toHaveCount(10)
  await expect(page.getByTestId('body-location-earth')).toHaveCSS('opacity', '1')
  for (const dot of await dots.all()) {
    await expect(dot).toHaveCSS('border-radius', '50%')
    await expect(dot).toHaveCSS('pointer-events', 'none')
  }
  // An isolated outer body avoids the physically overlapping inner-system dots.
  const neptune = page.getByTestId('body-location-neptune')
  await expect(neptune).toHaveCSS('opacity', '1')
  const bounds = (await neptune.boundingBox())!
  await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await expect(canvas).toHaveAttribute('data-camera-target', 'neptune')
  await expect(neptune).toHaveCSS('opacity', '0')
  await page.getByTestId('system-overview').click()
  await expect(neptune).toHaveCSS('opacity', '1')
  await page.locator('#toggle-objects').click()
  await page.getByTestId('navigator-body-earth').tap()
  await expect(canvas).toHaveAttribute('data-camera-target', 'earth')
  await expect(page.getByTestId('body-location-earth')).toHaveCSS('opacity', '0')
})
