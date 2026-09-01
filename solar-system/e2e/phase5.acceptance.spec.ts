import { expect, test, type Locator, type Page } from '@playwright/test'

test('close-up HUD preserves provenance and warnings without covering the feature view', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  await bootPhaseFive(page)
  const stage = page.locator('.canvas-section')

  await page.getByTestId('camera-preset-jupiter-great-red-spot').click()
  await expect(stage).toHaveAttribute('data-close-up-active', 'true')
  await expect(page.getByTestId('ephemeris-provider-badge')).toBeVisible()
  await expect(page.getByTestId('presentation-scale-warning-badge')).toBeVisible()
  await expect(page.locator('.canvas-topbar')).not.toContainText(/Phase\s+\d+/i)
  await expect(page.getByTestId('legend-body-jupiter')).toBeVisible()
  const compactLegendBox = await page.getByTestId('canvas-legend').boundingBox()
  expect(compactLegendBox).not.toBeNull()
  expect(compactLegendBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(42)

  await page.getByTestId('camera-mode-select').selectOption('free-orbit')
  await expect(stage).toHaveAttribute('data-close-up-active', 'false')
  await expect(page.locator('.canvas-topbar')).not.toContainText(/Phase\s+\d+/i)

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('Jupiter close-up tracks observed OPAL detail with modeled Great Red Spot flow', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseFive(page)
  const preset = page.getByTestId('camera-preset-jupiter-great-red-spot')

  await preset.click()
  await expect(preset).toHaveAttribute('aria-pressed', 'true')
  await expect(canvas).toHaveAttribute('data-selected-body', 'jupiter')
  await expect(canvas).toHaveAttribute('data-camera-target', 'jupiter')
  await expect(canvas).toHaveAttribute('data-camera-mode', 'body-follow')
  await expect(canvas).toHaveAttribute('data-close-up-preset', 'jupiter-great-red-spot')
  await expect(canvas).toHaveAttribute('data-asset-state', 'ready', { timeout: 15_000 })
  await expect(canvas).toHaveAttribute(
    'data-visual-material',
    /Hubble OPAL 2025 color.*JunoCam 2019 GRS detail.*modeled flow.*mixed-date visualization/i,
  )
  await expectCloseUpMarkerLayerHidden(page, 'jupiter')

  await setUtc(page, '2026-01-15T12:00:00')
  const firstFlowTime = await readFiniteDataNumber(canvas, 'atmosphereFlowTimeDays')
  const firstVortexPhase = await readFiniteDataNumber(canvas, 'greatRedSpotVortexPhase')
  const firstLongitude = await readFiniteDataNumber(canvas, 'greatRedSpotLongitude')
  const firstFrame = await canvas.screenshot()

  await setUtc(page, '2026-01-17T12:00:00')
  await expect(canvas).toHaveAttribute('data-close-up-preset', 'jupiter-great-red-spot')
  const secondFlowTime = await readFiniteDataNumber(canvas, 'atmosphereFlowTimeDays')
  const secondVortexPhase = await readFiniteDataNumber(canvas, 'greatRedSpotVortexPhase')
  const secondLongitude = await readFiniteDataNumber(canvas, 'greatRedSpotLongitude')
  const secondFrame = await canvas.screenshot()

  expect(secondFlowTime).not.toBe(firstFlowTime)
  expect(angularDistance(firstVortexPhase, secondVortexPhase)).toBeGreaterThan(0.1)
  expect(angularDistance(firstLongitude, secondLongitude)).toBeGreaterThan(0.001)
  expect(secondFrame.equals(firstFrame), 'modeled GRS detail should respond to time').toBe(false)

  await page.getByTestId('camera-mode-select').selectOption('free-orbit')
  await expect(canvas).toHaveAttribute('data-close-up-preset', '')
  await expect(page.getByTestId('body-label-jupiter')).toHaveCSS('opacity', '1')
  await expect(page.getByTestId('selected-body-marker')).toHaveCSS('opacity', '1')

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('Saturn close-up exposes translucent optical-depth rings, shadows, and quality-gated spokes', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseFive(page)
  const preset = page.getByTestId('camera-preset-saturn-rings')
  const quality = page.getByTestId('visual-quality-select')

  await preset.click()
  await expect(preset).toHaveAttribute('aria-pressed', 'true')
  await expect(canvas).toHaveAttribute('data-selected-body', 'saturn')
  await expect(canvas).toHaveAttribute('data-close-up-preset', 'saturn-rings')
  await expect(canvas).toHaveAttribute('data-ring-mesh-count', '1')
  await expect(canvas).toHaveAttribute('data-ring-shadow-enabled', 'true')
  await expect(canvas).toHaveAttribute('data-ring-spokes-enabled', 'true')
  await expect(canvas).toHaveAttribute('data-asset-state', 'ready', { timeout: 15_000 })
  await expect(canvas).toHaveAttribute(
    'data-visual-material',
    /Hubble OPAL 2025 color bands.*optical-depth rings and mutual shadows/i,
  )
  await expectCloseUpMarkerLayerHidden(page, 'saturn')

  await quality.selectOption('medium')
  await expect(canvas).toHaveAttribute('data-ring-spokes-enabled', 'false')
  await quality.selectOption('ultra')
  await expect(canvas).toHaveAttribute('data-ring-spokes-enabled', 'true')

  const frame = await canvas.screenshot()
  expect(frame.byteLength).toBeGreaterThan(10_000)
  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('Neptune dark spot is explicitly dated and disappears outside its observed era', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseFive(page)
  await page.getByTestId('navigator-body-neptune').click()
  await expect(canvas).toHaveAttribute('data-selected-body', 'neptune')
  await expect(canvas).toHaveAttribute('data-camera-target', 'neptune')

  await setUtc(page, '2020-06-01T00:00:00')
  await expect(canvas).toHaveAttribute('data-neptune-storm-active', 'true')

  await setUtc(page, '2026-06-01T00:00:00')
  await expect(canvas).toHaveAttribute('data-neptune-storm-active', 'false')
  await expect(canvas).toHaveAttribute('data-visual-material', /dated nonpermanent storm/i)

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

async function expectCloseUpMarkerLayerHidden(page: Page, selectedBodyId: string): Promise<void> {
  const labels = page.locator('.body-screen-label')
  await expect.poll(() => labels.count()).toBeGreaterThan(10)
  await expect.poll(async () => labels.evaluateAll((elements) => (
    elements.every((element) => getComputedStyle(element).opacity === '0')
  ))).toBe(true)
  await expect(page.getByTestId(`body-label-${selectedBodyId}`)).toHaveCSS('opacity', '0')
  await expect(page.getByTestId('body-label-earth')).toHaveCSS('opacity', '0')
  await expect(page.getByTestId('body-label-2p-encke')).toHaveCSS('opacity', '0')
  await expect(page.getByTestId('selected-body-marker')).toHaveCSS('opacity', '0')
}

async function bootPhaseFive(page: Page): Promise<Locator> {
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('solar-system-app')).toBeVisible()
  await expect(page.getByTestId('ephemeris-provider-badge')).toHaveText(
    /JPL Horizons .* generated offline bundle/i,
    { timeout: 15_000 },
  )
  await expect(page.locator('.canvas-topbar')).not.toContainText(/Phase\s+\d+/i)
  const canvas = page.locator('canvas[data-testid="solar-system-canvas"]')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-giant-profile-version', /phase5/i)
  return canvas
}

async function setUtc(page: Page, value: string): Promise<void> {
  const controls = page.getByTestId('simulation-time-controls')
  const input = controls.locator('input[type="datetime-local"]').first()
  const canvas = page.locator('canvas[data-testid="solar-system-canvas"]')
  const previousJdTdb = await readFiniteDataNumber(canvas, 'currentJdTdb')
  await input.evaluate((element, nextValue) => {
    const dateTimeInput = element as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(dateTimeInput, nextValue)
    dateTimeInput.dispatchEvent(new Event('input', { bubbles: true }))
    dateTimeInput.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await controls.getByRole('button', { name: 'Set UTC' }).click()
  await expect.poll(() => readFiniteDataNumber(canvas, 'currentJdTdb')).not.toBe(previousJdTdb)
}

async function readFiniteDataNumber(canvas: Locator, property: string): Promise<number> {
  const rawValue = await canvas.evaluate(
    (element, key) => (element as HTMLElement).dataset[key],
    property,
  )
  const value = Number(rawValue)
  expect(rawValue).toBeTruthy()
  expect(Number.isFinite(value)).toBe(true)
  return value
}

function angularDistance(left: number, right: number): number {
  const delta = Math.abs(left - right) % (Math.PI * 2)
  return Math.min(delta, Math.PI * 2 - delta)
}

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    const text = message.text()
    if (
      message.type() === 'error' ||
      /THREE\.WebGLProgram|Shader Error|VALIDATE_STATUS|GL_INVALID_OPERATION/i.test(text)
    ) {
      errors.push(`console ${message.type()}: ${text}`)
    }
  })
  page.on('pageerror', (error) => {
    errors.push(`page: ${error.message}`)
  })
  return errors
}

async function settleBrowserErrors(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 250))
}
