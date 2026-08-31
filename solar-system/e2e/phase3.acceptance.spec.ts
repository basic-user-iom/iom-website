import { expect, test, type Locator, type Page } from '@playwright/test'

const BODIES = [
  ['sun', 'Sun'],
  ['mercury', 'Mercury'],
  ['venus', 'Venus'],
  ['earth', 'Earth'],
  ['moon', 'Moon'],
  ['mars', 'Mars'],
  ['jupiter', 'Jupiter'],
  ['saturn', 'Saturn'],
  ['uranus', 'Uranus'],
  ['neptune', 'Neptune'],
] as const

const CAMERA_MODES = [
  ['overview', 'System overview'],
  ['free-orbit', 'Free orbit'],
  ['body-follow', 'Body follow'],
  ['earth-moon-system', 'Earth–Moon system'],
  ['top-down-ecliptic', 'Top-down ecliptic'],
  ['chase', 'Velocity chase'],
] as const

test('all generated bodies can be selected and focused', async ({ page }) => {
  test.slow()
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseThree(page)
  const inspector = page.getByTestId('body-inspector')
  const selectedMarker = page.getByTestId('selected-body-marker')

  for (const [bodyId, displayName] of BODIES) {
    const navigatorItem = page.getByTestId(`navigator-body-${bodyId}`)
    await navigatorItem.click()

    await expect(navigatorItem).toHaveRole('button')
    await expect(navigatorItem).toHaveAttribute('aria-pressed', 'true')
    await expect(inspector.getByRole('heading', { name: displayName, exact: true })).toBeVisible()
    await expect(canvas).toHaveAttribute('data-selected-body', bodyId)
    await expect(canvas).toHaveAttribute('data-camera-target', bodyId)
    await expect(canvas).toHaveAttribute('data-camera-mode', 'body-follow')
    await expect(selectedMarker).toHaveAttribute('data-body-id', bodyId)
    await expectFiniteClipping(canvas)
  }

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('all six camera modes expose finite dynamic clipping planes', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseThree(page)
  await page.getByTestId('navigator-body-earth').click()
  const cameraSelect = page.getByTestId('camera-mode-select')
  const inspector = page.getByTestId('body-inspector')

  for (const [mode, inspectorLabel] of CAMERA_MODES) {
    await cameraSelect.selectOption(mode)
    await expect(cameraSelect).toHaveValue(mode)
    await expect(canvas).toHaveAttribute('data-camera-mode', mode)
    await expect(inspector.getByText(inspectorLabel, { exact: true })).toBeVisible()
    await expectFiniteClipping(canvas)
  }

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('Earth and Moon stay separate and visible in presentation and system views', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseThree(page)

  await page.getByTestId('navigator-body-earth').click()
  await expect(canvas).toHaveAttribute('data-camera-mode', 'body-follow')
  await expect.poll(() => readFiniteDataNumber(canvas, 'presentationMix')).toBe(1)
  await expect(canvas).toHaveAttribute('data-earth-moon-non-intersecting', 'true')
  await expect(canvas).toHaveAttribute('data-moon-on-screen', 'true')
  await expect
    .poll(() => readFiniteDataNumber(canvas, 'earthMoonScreenSeparation'))
    .toBeGreaterThan(50)

  await page.getByTestId('camera-earth-moon-system').click()
  await expect(page.getByTestId('camera-mode-select')).toHaveValue('earth-moon-system')
  await expect(canvas).toHaveAttribute('data-camera-mode', 'earth-moon-system')
  await expect(canvas).toHaveAttribute('data-camera-target', 'earth')
  await expect(canvas).toHaveAttribute('data-selected-body', 'earth')
  await expect(canvas).toHaveAttribute('data-earth-on-screen', 'true')
  await expect(canvas).toHaveAttribute('data-moon-on-screen', 'true')
  await expect(canvas).toHaveAttribute('data-moon-label-visible', 'true')
  await expect
    .poll(() => readFiniteDataNumber(canvas, 'earthMoonScreenSeparation'))
    .toBeGreaterThan(100)
  await expectFiniteClipping(canvas)

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('mouse input hands automated cameras to free orbit on the first gesture', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const canvas = await bootPhaseThree(page)
  const hint = page.getByTestId('canvas-camera-hint')

  await page.getByTestId('navigator-body-earth').click()
  await expect(canvas).toHaveAttribute('data-camera-mode', 'body-follow')
  await expect(canvas).toHaveAttribute(
    'data-camera-interaction',
    'handoff-to-free-orbit',
  )
  await expect(hint).toContainText(/enter free orbit/i)

  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  const startX = bounds!.x + bounds!.width * 0.58
  const startY = bounds!.y + bounds!.height * 0.58
  const beforeDrag = await canvas.getAttribute('data-camera-position')

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 90, startY + 45, { steps: 8 })
  await page.mouse.up()

  await expect(canvas).toHaveAttribute('data-camera-mode', 'free-orbit')
  await expect(canvas).toHaveAttribute('data-camera-interaction', 'free-orbit')
  await expect(hint).toContainText(/^Free orbit:/i)
  await expect.poll(() => canvas.getAttribute('data-camera-position')).not.toBe(beforeDrag)

  await page.getByTestId('camera-mode-select').selectOption('body-follow')
  await expect(canvas).toHaveAttribute('data-camera-mode', 'body-follow')
  await expect(canvas).toHaveAttribute(
    'data-camera-interaction',
    'handoff-to-free-orbit',
  )
  const beforeWheel = await canvas.getAttribute('data-camera-position')
  await page.mouse.move(startX, startY)
  await page.mouse.wheel(0, -560)
  await expect(canvas).toHaveAttribute('data-camera-mode', 'free-orbit')
  await expect(canvas).toHaveAttribute('data-camera-interaction', 'free-orbit')
  await expect.poll(() => canvas.getAttribute('data-camera-position')).not.toBe(beforeWheel)
  await expectFiniteClipping(canvas)

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('true and presentation scales transition with a persistent warning', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseThree(page)
  const scaleControls = page.getByTestId('render-scale-controls')
  const trueScale = scaleControls.getByRole('button', { name: 'True scale' })
  const presentation = scaleControls.getByRole('button', { name: 'Presentation' })
  const panelWarning = page.getByTestId('presentation-scale-warning')
  const canvasWarning = page.getByTestId('presentation-scale-warning-badge')
  const inspectorWarning = page.getByTestId('body-inspector-scale-warning')

  await expect(presentation).toHaveAttribute('aria-pressed', 'true')
  await expect(panelWarning).toBeVisible()
  await expect(canvasWarning).toBeVisible()
  await expect(inspectorWarning).toBeVisible()
  await expect(canvas).toHaveAttribute('data-presentation-warning', 'true')

  await trueScale.click()
  await expect(trueScale).toHaveAttribute('aria-pressed', 'true')
  await expect(canvas).toHaveAttribute('data-scale-mode', 'true')

  // Exaggerated geometry remains present during the smooth transition, so the
  // warning must not disappear merely because true scale became the target.
  const intermediateMix = await readFiniteDataNumber(canvas, 'presentationMix')
  // On heavily parallelized workers the 0.7 s transition can finish before
  // the warning locators are resolved. If exaggerated geometry still contributes,
  // all three disclosure surfaces must still be present.
  expect(intermediateMix).toBeGreaterThanOrEqual(0)
  expect(intermediateMix).toBeLessThanOrEqual(1)
  if (intermediateMix > 0) {
    await expect(panelWarning).toBeVisible()
    await expect(canvasWarning).toBeVisible()
    await expect(inspectorWarning).toBeVisible()
  }

  await expect(canvas).toHaveAttribute('data-presentation-warning', 'false', {
    timeout: 4_000,
  })
  await expect.poll(() => readFiniteDataNumber(canvas, 'presentationMix')).toBe(0)
  await expect(page.getByTestId('true-scale-note')).toBeVisible()
  await expect(panelWarning).toHaveCount(0)
  await expect(canvasWarning).toHaveCount(0)
  await expect(inspectorWarning).toHaveCount(0)

  await presentation.click()
  await expect(presentation).toHaveAttribute('aria-pressed', 'true')
  await expect(panelWarning).toBeVisible()
  await expect(canvasWarning).toBeVisible()
  await expect(inspectorWarning).toBeVisible()
  await expect(canvas).toHaveAttribute('data-scale-mode', 'presentation')
  await expect(canvas).toHaveAttribute('data-presentation-warning', 'true')
  await expect.poll(() => readFiniteDataNumber(canvas, 'presentationMix')).toBe(1)

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('selected trails support previous and next intervals with honest coverage disclosure', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  await bootPhaseThree(page)
  const app = page.getByTestId('solar-system-app')
  const trailControls = page.getByTestId('trail-interval-controls')
  const previous = trailControls.getByRole('button', { name: 'Previous' })
  const next = trailControls.getByRole('button', { name: 'Next' })

  await expect(previous).toHaveAttribute('aria-pressed', 'true')
  await expect(app).toHaveAttribute('data-trail-interval', 'previous')
  await next.click()
  await expect(next).toHaveAttribute('aria-pressed', 'true')
  await expect(app).toHaveAttribute('data-trail-interval', 'next')
  await previous.click()
  await expect(app).toHaveAttribute('data-trail-interval', 'previous')

  await expect(page.getByTestId('orbit-coverage-warning-badge')).toContainText(
    /coverage-limited orbit arc.*none fabricated/i,
  )
  await page.getByTestId('navigator-body-neptune').click()
  await expect(page.getByTestId('body-inspector-path-warning')).toContainText(
    /truncated.*no missing arc was fabricated/i,
  )

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('Neptune follow remains centered while ephemeris time advances', async ({ page }) => {
  test.slow()
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseThree(page)
  const selectedMarker = page.getByTestId('selected-body-marker')
  await page.getByTestId('navigator-body-neptune').click()

  await expect(canvas).toHaveAttribute('data-camera-mode', 'body-follow')
  await expect(canvas).toHaveAttribute('data-camera-target', 'neptune')
  await expect(selectedMarker).toHaveAttribute('data-body-id', 'neptune')
  await expect.poll(() => readFollowError(canvas), { timeout: 8_000 }).toBeLessThan(5e-6)

  await page.getByTestId('simulation-time-controls').getByLabel('Speed preset').selectOption(
    'forward-day',
  )
  const followErrors: number[] = []
  const markerCenters: Array<{ x: number; y: number }> = []
  for (let sample = 0; sample < 20; sample += 1) {
    await page.waitForTimeout(50)
    followErrors.push(await readFollowError(canvas))
    const markerBox = await selectedMarker.boundingBox()
    expect(markerBox, 'selected Neptune marker should remain visible').not.toBeNull()
    if (markerBox !== null) {
      markerCenters.push({
        x: markerBox.x + markerBox.width / 2,
        y: markerBox.y + markerBox.height / 2,
      })
    }
  }

  expect(followErrors.every(Number.isFinite)).toBe(true)
  expect(Math.max(...followErrors)).toBeLessThan(5e-6)
  expect(range(followErrors)).toBeLessThan(1e-6)
  expect(range(markerCenters.map(({ x }) => x))).toBeLessThan(1.5)
  expect(range(markerCenters.map(({ y }) => y))).toBeLessThan(1.5)
  await expectFiniteClipping(canvas)

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('presentation warning remains visible without horizontal overflow on mobile', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const canvas = await bootPhaseThree(page)

  await expect(page.getByTestId('presentation-scale-warning-badge')).toBeVisible()
  await expect(page.getByTestId('presentation-scale-warning')).toBeVisible()
  await expect(canvas).toHaveAttribute('data-presentation-warning', 'true')
  await expect(page.getByTestId('camera-mode-select')).toBeVisible()

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(horizontalOverflow).toBeLessThanOrEqual(1)

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

async function bootPhaseThree(page: Page): Promise<Locator> {
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('solar-system-app')).toBeVisible()
  await expect(page.getByTestId('ephemeris-provider-badge')).toHaveText(
    /JPL Horizons .* generated offline bundle/i,
    { timeout: 15_000 },
  )
  const canvas = page.locator('canvas[data-testid="solar-system-canvas"]')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-camera-mode', /.+/)
  return canvas
}

async function expectFiniteClipping(canvas: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const near = await readFiniteDataNumber(canvas, 'cameraNear')
      const far = await readFiniteDataNumber(canvas, 'cameraFar')
      return near > 0 && far > near
    })
    .toBe(true)
}

async function readFollowError(canvas: Locator): Promise<number> {
  return readFiniteDataNumber(canvas, 'followError')
}

async function readFiniteDataNumber(canvas: Locator, property: string): Promise<number> {
  const rawValue = await canvas.evaluate(
    (element, key) => (element as HTMLElement).dataset[key],
    property,
  )
  const value = Number(rawValue)
  if (rawValue === undefined || rawValue.trim() === '' || !Number.isFinite(value)) {
    return Number.POSITIVE_INFINITY
  }
  return value
}

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    errors.push(`page: ${error.message}`)
  })
  return errors
}

async function settleBrowserErrors(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 200))
}

function range(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values)
}
