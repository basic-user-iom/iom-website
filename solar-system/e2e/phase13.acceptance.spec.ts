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
    await expect(canvas).toHaveAttribute('data-natural-satellite-selected-on-screen', 'true')
    await expect(canvas).toHaveAttribute('data-natural-satellite-selection-cue-opacity', '0.000')
    await expect(canvas).toHaveAttribute('data-natural-satellite-selection-halo-visible', 'false')
    await expect(page.getByTestId('selected-natural-satellite-marker')).toHaveCSS('opacity', '0')
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
    await expect(canvas).toHaveAttribute('data-iss-model-asset-id', 'iss-nasa-jsc-igoal-2026-web')
    await expect(canvas).toHaveAttribute('data-iss-model-state', 'ready', { timeout: 45_000 })
    await expect.poll(async () => Number(await canvas.getAttribute('data-iss-model-mesh-count'))).toBeGreaterThan(0)
    await expect.poll(async () => Number(await canvas.getAttribute('data-iss-model-triangle-count'))).toBeGreaterThan(500_000)
    await expect(canvas).toHaveAttribute('data-space-object-selected-render-radius', '3.600000e-5')
    await panel.getByRole('button', { name: 'Frame selected satellite' }).click()
    await expect(canvas).toHaveAttribute('data-camera-mode', 'free-orbit')
    await expect.poll(async () => {
      const target = (await canvas.getAttribute('data-camera-world-target'))?.split(',').map(Number) ?? []
      return target.length === 3 ? Math.hypot(target[0] ?? 0, target[1] ?? 0, target[2] ?? 0) : 0
    }).toBeGreaterThan(0.001)
    await expect.poll(async () => {
      const position = (await canvas.getAttribute('data-camera-position'))?.split(',').map(Number) ?? []
      const target = (await canvas.getAttribute('data-camera-world-target'))?.split(',').map(Number) ?? []
      return position.length === 3 && target.length === 3
        ? Math.hypot(
            (position[0] ?? 0) - (target[0] ?? 0),
            (position[1] ?? 0) - (target[1] ?? 0),
            (position[2] ?? 0) - (target[2] ?? 0),
          )
        : Number.POSITIVE_INFINITY
    }).toBeLessThan(0.001)
    await expect(canvas).toHaveAttribute('data-space-object-selected-on-screen', 'true')
    await expect(page.locator('.space-object-screen-label[data-object-id="earth-satellite-25544"]')).toBeVisible()
    await expect(page.getByTestId('selected-space-object-marker')).toBeVisible()
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

  test('keeps compact moons and historical probes visibly locatable', async ({ page }) => {
    test.setTimeout(60_000)
    const canvas = await boot(page)
    const search = page.locator('#body-search')

    await search.fill('Saturn minor moon 001')
    await page.getByTestId('navigator-catalog-natural-satellite-saturn-minor-001').click()
    await expect(canvas).toHaveAttribute('data-natural-satellite-selected', 'saturn-minor-001')
    await expect(canvas).toHaveAttribute('data-natural-satellite-selected-on-screen', 'true')
    await expect(page.locator('.compact-satellite-selection-label[data-satellite-id="saturn-minor-001"]')).toBeVisible()
    await expect(page.getByTestId('selected-natural-satellite-marker')).toBeVisible()

    await search.fill('25544')
    await page.getByTestId('navigator-catalog-earth-satellite-earth-satellite-25544').click()
    await expect(canvas).toHaveAttribute('data-earth-satellite-rendered-count', '5', { timeout: 10_000 })
    await expect.poll(async () => Number(await canvas.getAttribute('data-current-jd-tdb'))).toBeGreaterThan(2_461_000)

    await search.fill('Cassini')
    await page.getByTestId('navigator-catalog-spacecraft-cassini').click()
    await expect(canvas).toHaveAttribute('data-space-object-selected', 'cassini')
    await expect(canvas).toHaveAttribute('data-space-object-trajectory-points', '128', { timeout: 15_000 })
    await expect.poll(async () => Number(await canvas.getAttribute('data-current-jd-tdb'))).toBeLessThan(2_458_011.5)
    await expect(canvas).toHaveAttribute('data-space-object-selected-on-screen', 'true')
    await expect(page.locator('.space-object-screen-label[data-object-id="cassini"]')).toBeVisible()
  })

  test('restores the comet layer and visibly frames every named comet', async ({ page }) => {
    test.setTimeout(60_000)
    const canvas = await boot(page)
    const search = page.locator('#body-search')
    const cometToggle = page.getByTestId('comets-toggle')
    await cometToggle.uncheck()
    await expect(cometToggle).not.toBeChecked()

    for (const [id, query] of [
      ['1p-halley', '1P/Halley'],
      ['2p-encke', '2P/Encke'],
      ['67p-churyumov-gerasimenko', '67P/Churyumov'],
      ['c-1995-o1-hale-bopp', 'Hale-Bopp'],
      ['c-2020-f3-neowise', 'NEOWISE'],
    ] as const) {
      await search.fill(query)
      await page.getByTestId(`navigator-body-${id}`).click()
      await expect(cometToggle).toBeChecked()
      await expect(canvas).toHaveAttribute('data-selected-body', id)
      await expect(page.getByTestId('selected-body-marker')).toHaveAttribute('data-body-id', id)
      await expect(page.getByTestId('selected-body-marker')).toBeVisible()
    }
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
