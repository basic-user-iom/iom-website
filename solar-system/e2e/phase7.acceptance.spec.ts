import { expect, test, type Locator, type Page } from '@playwright/test'

const PREFERENCE_KEY = 'iom.solar-system.preferences'

test('production observatory workflow is readable and spatially ordered at 1280px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const canvas = await bootPhaseSeven(page)
  const navigator = page.getByTestId('object-navigator')
  const inspector = page.getByTestId('body-inspector')
  const timeline = page.getByTestId('epoch-timeline')

  await expect(navigator).toBeVisible()
  await expect(inspector).toBeVisible()
  await expect(timeline).toBeVisible()
  const [navigatorBox, canvasBox, inspectorBox] = await Promise.all([
    navigator.boundingBox(),
    canvas.boundingBox(),
    inspector.boundingBox(),
  ])
  expect(navigatorBox).not.toBeNull()
  expect(canvasBox).not.toBeNull()
  expect(inspectorBox).not.toBeNull()
  expect(navigatorBox!.x + navigatorBox!.width).toBeLessThan(canvasBox!.x)
  expect(canvasBox!.x + canvasBox!.width).toBeLessThan(inspectorBox!.x)

  await page.getByTestId('navigator-body-saturn').click()
  await expect(canvas).toHaveAttribute('data-selected-body', 'saturn')
  await page.getByTestId('camera-mode-select').selectOption('top-down-ecliptic')
  await expect(canvas).toHaveAttribute('data-camera-mode', 'top-down-ecliptic')
  await page.getByTestId('visual-quality-select').selectOption('medium')
  await expect(page.getByTestId('solar-system-app')).toHaveAttribute(
    'data-visual-quality',
    'medium',
  )

  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
  const badgeFontSize = await page
    .getByTestId('ephemeris-provider-badge')
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  expect(badgeFontSize).toBeGreaterThanOrEqual(11)
})

test('keyboard commands, dialog focus containment, and form guards work', async ({ page }) => {
  const canvas = await bootPhaseSeven(page)
  const helpButton = page.getByTestId('help-open')

  await helpButton.click()
  const help = page.getByTestId('help-overlay')
  await expect(help).toBeVisible()
  await expect(help.getByRole('heading', { name: 'Observatory controls' })).toBeVisible()
  await expect(help.locator(':focus')).toHaveAttribute('aria-label', /Close: Observatory controls/)
  const focusedOutline = await help.locator(':focus').evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  )
  expect(focusedOutline).not.toBe('none')
  await page.keyboard.press('Escape')
  await expect(help).toBeHidden()
  await expect(helpButton).toBeFocused()

  await page.getByTestId('navigator-body-earth').click()
  await canvas.focus()
  await page.keyboard.press(']')
  await expect(page.getByTestId('navigator-body-moon')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('5')
  await expect(canvas).toHaveAttribute('data-camera-mode', 'chase')

  const scaleControls = page.getByTestId('render-scale-controls')
  const initialScale = await scaleControls
    .getByRole('button', { name: 'Presentation' })
    .getAttribute('aria-pressed')
  await page.keyboard.press('s')
  await expect(scaleControls.getByRole('button', { name: 'Presentation' })).not.toHaveAttribute(
    'aria-pressed',
    initialScale ?? 'true',
  )

  const playback = page.getByTestId('simulation-time-controls').locator('.button-primary')
  const playbackLabel = await playback.getAttribute('aria-label')
  await canvas.focus()
  await page.keyboard.press('Space')
  await expect.poll(() => playback.getAttribute('aria-label')).not.toBe(playbackLabel)

  const reverse = page.getByRole('button', { name: 'Reverse' })
  await expect(reverse).toHaveAttribute('aria-pressed', 'false')
  await canvas.focus()
  await page.keyboard.press('r')
  await expect(reverse).toHaveAttribute('aria-pressed', 'true')

  const search = page.getByLabel('Search bodies')
  const guardedPlaybackLabel = await playback.getAttribute('aria-label')
  await search.focus()
  await page.keyboard.press('Space')
  await expect(playback).toHaveAttribute('aria-label', guardedPlaybackLabel ?? '')
})

test('validated observatory preferences persist without transient runtime state', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await page.evaluate((key) => localStorage.removeItem(key), PREFERENCE_KEY)
  await page.reload({ waitUntil: 'domcontentloaded' })
  const canvas = await waitForReady(page)

  await page.getByTestId('navigator-body-neptune').click()
  await page.getByTestId('camera-mode-select').selectOption('chase')
  await page.getByTestId('visual-quality-select').selectOption('ultra')
  await page.getByTestId('render-scale-controls').getByRole('button', { name: 'True scale' }).click()
  await page.getByTestId('sky-background-toggle').uncheck()
  await expect(canvas).toHaveAttribute('data-camera-mode', 'chase')

  const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), PREFERENCE_KEY)
  expect(persisted.state).toMatchObject({
    selectedBodyId: 'neptune',
    cameraMode: 'chase',
    renderScaleMode: 'true',
    visualQuality: 'ultra',
    skyBackgroundVisible: false,
  })
  expect(persisted.state).not.toHaveProperty('snapshot')
  expect(persisted.state).not.toHaveProperty('webglStatus')
  expect(persisted.state).not.toHaveProperty('reducedMotion')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForReady(page)
  await expect(page.getByTestId('navigator-body-neptune')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('camera-mode-select')).toHaveValue('chase')
  await expect(page.getByTestId('visual-quality-select')).toHaveValue('ultra')
  await expect(
    page.getByTestId('render-scale-controls').getByRole('button', { name: 'True scale' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('sky-background-toggle')).not.toBeChecked()
})

test('cinematic tour is disclosed and manual navigation or Escape wins immediately', async ({ page }) => {
  const canvas = await bootPhaseSeven(page)
  const app = page.getByTestId('solar-system-app')
  const tourToggle = page.getByTestId('tour-toggle')

  await tourToggle.click()
  await expect(app).toHaveAttribute('data-tour-state', 'running')
  await expect(page.getByTestId('cinematic-tour-status')).toContainText(
    /Cinematic camera movement.*simulation data unchanged/i,
  )
  await page.getByTestId('camera-mode-select').selectOption('top-down-ecliptic')
  await expect(app).toHaveAttribute('data-tour-state', 'cancelled')
  await expect(page.getByTestId('cinematic-tour-status')).toBeHidden()
  await expect(canvas).toHaveAttribute('data-selected-body', 'earth')
  await expect(canvas).toHaveAttribute('data-camera-mode', 'top-down-ecliptic')

  await tourToggle.click()
  await expect(app).toHaveAttribute('data-tour-state', 'running')
  await page.getByLabel('Target body').selectOption('mars')
  await expect(app).toHaveAttribute('data-tour-state', 'cancelled')
  await expect(canvas).toHaveAttribute('data-selected-body', 'mars')
  await expect(canvas).toHaveAttribute('data-camera-mode', 'top-down-ecliptic')

  await tourToggle.click()
  await expect(app).toHaveAttribute('data-tour-state', 'running')
  const persistedDuringTour = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{}'),
    PREFERENCE_KEY,
  )
  expect(persistedDuringTour.state).toMatchObject({
    selectedBodyId: 'mars',
    cameraMode: 'top-down-ecliptic',
  })
  await page.keyboard.press('Escape')
  await expect(app).toHaveAttribute('data-tour-state', 'cancelled')
  await expect(canvas).toHaveAttribute('data-camera-mode', 'free-orbit')
  const persistedAfterInterruption = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{}'),
    PREFERENCE_KEY,
  )
  expect(persistedAfterInterruption.state).toMatchObject({
    selectedBodyId: 'mars',
    cameraMode: 'free-orbit',
  })
})

test('provenance is coherent and responsive layouts never clip horizontally', async ({ page }) => {
  await page.route('**/*solar-system-ephemeris.manifest.json*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350))
    await route.continue()
  })
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('ephemeris-loading-state')).toBeVisible()
  await waitForReady(page)

  await page.getByTestId('provenance-open').click()
  const provenance = page.getByTestId('provenance-overlay')
  await expect(provenance).toBeVisible()
  await expect(provenance).toContainText(/JPL Horizons/i)
  await expect(provenance).toContainText(/Presentation geometry contributes/i)
  await expect(provenance.getByRole('link')).toHaveCount(3)
  await page.keyboard.press('Escape')
  await expect(provenance).toBeHidden()

  for (const width of [1280, 986, 960, 921, 620, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(50)
    expect(await horizontalOverflow(page), `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1)
  }
})

async function bootPhaseSeven(page: Page): Promise<Locator> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  return waitForReady(page)
}

async function waitForReady(page: Page): Promise<Locator> {
  await expect(page.getByTestId('solar-system-app')).toBeVisible()
  await expect(page.getByTestId('ephemeris-provider-badge')).toHaveText(
    /JPL Horizons .* generated offline bundles/i,
    { timeout: 30_000 },
  )
  await expect(page.getByTestId('tour-toggle')).toBeEnabled()
  const canvas = page.locator('canvas[data-testid="solar-system-canvas"]')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-camera-mode', /.+/)
  return canvas
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
}
