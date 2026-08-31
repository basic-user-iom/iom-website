import { expect, test, type Page } from '@playwright/test'

const PREFERENCE_KEY = 'iom.solar-system.preferences'

test.describe.serial('Extension phases 2–4 acceptance', () => {
  test('frames a major moon and exposes its screen label', async ({ page }) => {
    const canvas = await boot(page)
    await expect(canvas).toHaveAttribute('data-space-object-propagation-execution', /module-worker|direct-fallback/)
    const naturalPanel = page.getByTestId('natural-satellite-panel')
    await naturalPanel.locator('#natural-satellite-parent').selectOption('jupiter')
    await naturalPanel.getByRole('option', { name: /Io/ }).click()
    await expect(page.getByTestId('natural-satellite-summary')).toContainText('Io')
    await page.getByTestId('natural-satellite-summary').getByRole('button', { name: 'Frame selected moon' }).click()
    await expect(canvas).toHaveAttribute('data-natural-satellite-selected', 'io')
    await expect(canvas).toHaveAttribute('data-natural-satellite-eclipsed-count', /^\d+$/)
    await expect(canvas).toHaveAttribute('data-natural-satellite-transit-shadow-count', /^\d+$/)
    await expect(canvas).toHaveAttribute('data-natural-satellite-visible-label-count', /^\d+$/)
    await expect(canvas).toHaveAttribute('data-natural-satellite-suppressed-label-count', /^\d+$/)
    await expect(canvas).toHaveAttribute('data-natural-satellite-official-texture-ready-count', '16', { timeout: 30_000 })
    await expect(canvas).toHaveAttribute('data-natural-satellite-official-texture-fallback-count', '0')
    await expect(canvas).toHaveAttribute('data-natural-satellite-procedural-texture-count', '7')
    await expect.poll(async () => Number(await canvas.getAttribute('data-natural-satellite-selected-radius-to-parent'))).toBeLessThanOrEqual(0.03)
    await expect.poll(() => canvas.getAttribute('data-camera-mode')).toBe('free-orbit')
    await expect(page.locator('.natural-satellite-screen-label[data-satellite-id="io"]')).toHaveCount(1)
  })

  test('guards stale OMM data and draws selected object trajectories', async ({ page }) => {
    const browserErrors: string[] = []
    page.on('pageerror', (error) => browserErrors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()) })
    const canvas = await boot(page)
    const panel = page.getByTestId('space-objects-panel')
    await expect(panel.getByRole('status')).toContainText('outside its hard validity window')
    await panel.getByRole('button', { name: 'Return to satellite epoch' }).click()
    await expect(canvas).toHaveAttribute('data-earth-satellite-rendered-count', '5')
    await panel.getByRole('option', { name: /ISS/ }).click()
    await expect(canvas).toHaveAttribute('data-space-object-selected', 'earth-satellite-25544')
    await expect(canvas).toHaveAttribute('data-space-object-trajectory-points', '96')
    await panel.getByRole('tab', { name: /Spacecraft/ }).click()
    await panel.getByRole('option', { name: /Voyager 1/ }).click()
    await expect(canvas).toHaveAttribute('data-space-object-selected', 'voyager-1')
    await expect(canvas).toHaveAttribute('data-space-object-trajectory-points', '128')
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('searches the complete catalog and navigates directly to hidden object families', async ({ page }) => {
    const canvas = await boot(page)
    const search = page.locator('#body-search')
    await search.fill('Io')
    await page.getByTestId('navigator-catalog-natural-satellite-io').click()
    await expect(canvas).toHaveAttribute('data-natural-satellite-selected', 'io')
    await expect.poll(() => canvas.getAttribute('data-camera-mode')).toBe('free-orbit')

    await search.fill('25544')
    await page.getByTestId('navigator-catalog-earth-satellite-earth-satellite-25544').click()
    await expect(canvas).toHaveAttribute('data-space-object-selected', 'earth-satellite-25544')
    await expect(canvas).toHaveAttribute('data-earth-satellite-rendered-count', '5', { timeout: 10_000 })
    await expect.poll(async () => Number(await canvas.getAttribute('data-space-object-trajectory-points'))).toBe(96)
  })
})

async function boot(page: Page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await page.evaluate((key) => localStorage.removeItem(key), PREFERENCE_KEY)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('solar-system-app')).toBeVisible()
  await expect(page.getByTestId('natural-satellite-panel')).toBeVisible()
  await expect(page.getByTestId('space-objects-panel')).toBeVisible()
  const canvas = page.locator('canvas[data-testid="solar-system-canvas"]')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-asset-state', 'ready', { timeout: 30_000 })
  await expect(canvas).toHaveAttribute('data-current-jd-tdb', /.+/, { timeout: 30_000 })
  return canvas
}
