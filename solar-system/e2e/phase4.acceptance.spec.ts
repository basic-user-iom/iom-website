import { expect, test, type Locator, type Page } from '@playwright/test'

test('Earth uses real Sun direction, mapped night lights, moving oceans, and independent clouds', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseFour(page)
  await page.getByTestId('navigator-body-earth').click()

  await expect(canvas).toHaveAttribute('data-selected-body', 'earth')
  await expect(canvas).toHaveAttribute('data-visual-material', /Blue Marble.*ocean Fresnel\/glint.*terminator night lights/i)
  await expect(canvas).toHaveAttribute('data-asset-state', 'ready', { timeout: 15_000 })
  await expect(canvas).toHaveAttribute('data-atmosphere-path', 'lut')
  await expect(page.getByTestId('body-material-label')).toContainText(/Blue Marble.*ocean Fresnel\/glint/i)
  await expect(page.getByTestId('body-asset-state')).toHaveText('Authoritative map ready')
  await expect(page.getByTestId('body-solar-irradiance')).toContainText(/W\/m².*inverse-square/i)

  const solarIrradiance = await readFiniteDataNumber(canvas, 'earthSolarIrradiance')
  expect(solarIrradiance).toBeGreaterThan(1_200)
  expect(solarIrradiance).toBeLessThan(1_500)

  await setUtc(page, '2026-01-15T12:00:00')
  const januaryDirection = await readVector(canvas, 'earthSunDirection')
  const januaryCloudAngle = await readFiniteDataNumber(canvas, 'earthCloudAngle')
  const januaryFrame = await canvas.screenshot()

  await setUtc(page, '2026-07-15T12:00:00')
  await expect
    .poll(async () => vectorDistance(await readVector(canvas, 'earthSunDirection'), januaryDirection))
    .toBeGreaterThan(0.1)
  const julyDirection = await readVector(canvas, 'earthSunDirection')
  const julyCloudAngle = await readFiniteDataNumber(canvas, 'earthCloudAngle')
  const julyFrame = await canvas.screenshot()

  expect(vectorLength(januaryDirection)).toBeCloseTo(1, 4)
  expect(vectorLength(julyDirection)).toBeCloseTo(1, 4)
  expect(angularDistance(januaryCloudAngle, julyCloudAngle)).toBeGreaterThan(0.05)
  expect(julyFrame.equals(januaryFrame), 'seasonal sunlight and ocean glint should move').toBe(false)

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('Venus defaults to opaque clouds and exposes an authoritative radar data view', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseFour(page)
  const app = page.getByTestId('solar-system-app')
  const cloudsButton = page.getByTestId('venus-clouds-button')
  const radarButton = page.getByTestId('venus-radar-button')

  await expect(app).toHaveAttribute('data-venus-surface-mode', 'clouds')
  await expect(cloudsButton).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('navigator-body-venus').click()
  await expect(canvas).toHaveAttribute('data-selected-body', 'venus')
  await expect(canvas).toHaveAttribute('data-venus-surface-mode', 'clouds')
  await expect(canvas).toHaveAttribute(
    'data-visual-material',
    'Akatsuki/Hubble-informed procedural cloud tops · modeled 4-day superrotation',
  )
  await expect(canvas).toHaveAttribute('data-asset-state', 'procedural')

  await radarButton.click()
  await expect(app).toHaveAttribute('data-venus-surface-mode', 'radar')
  await expect(radarButton).toHaveAttribute('aria-pressed', 'true')
  await expect(canvas).toHaveAttribute('data-venus-surface-mode', 'radar')
  await expect(canvas).toHaveAttribute('data-visual-material', /Magellan radar/i)
  await expect(canvas).toHaveAttribute('data-asset-state', 'ready', { timeout: 15_000 })
  await expect(page.getByTestId('body-asset-state')).toHaveText('Authoritative map ready')

  await cloudsButton.click()
  await expect(canvas).toHaveAttribute('data-venus-surface-mode', 'clouds')
  await expect(canvas).toHaveAttribute('data-asset-state', 'procedural')

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('rocky-world maps load lazily with procedural fallbacks kept available', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseFour(page)

  for (const bodyId of ['mercury', 'moon', 'mars'] as const) {
    await page.getByTestId(`navigator-body-${bodyId}`).click()
    await expect(canvas).toHaveAttribute('data-selected-body', bodyId)
    await expect(canvas).toHaveAttribute('data-asset-state', 'ready', { timeout: 15_000 })
    await expect(page.getByTestId('body-asset-state')).toHaveText('Authoritative map ready')
  }

  await expect(canvas).toHaveAttribute('data-asset-fallback-count', '0')
  await expect(page.getByText(/procedural fallback remains available/i)).toBeVisible()
  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('visual quality switches between analytic and LUT atmosphere paths', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseFour(page)
  const app = page.getByTestId('solar-system-app')
  const quality = page.getByTestId('visual-quality-select')

  await expect(quality).toHaveValue('high')
  await expect(app).toHaveAttribute('data-visual-quality', 'high')
  await expect(canvas).toHaveAttribute('data-atmosphere-path', 'lut')
  await expect(canvas).toHaveAttribute('data-bloom-enabled', 'true')
  await expect(canvas).toHaveAttribute('data-bloom-strength', '0.30')

  await quality.selectOption('low')
  await expect(app).toHaveAttribute('data-visual-quality', 'low')
  await expect(canvas).toHaveAttribute('data-atmosphere-path', 'analytic')
  await expect(canvas).toHaveAttribute('data-bloom-enabled', 'false')

  await quality.selectOption('ultra')
  await expect(app).toHaveAttribute('data-visual-quality', 'ultra')
  await expect(canvas).toHaveAttribute('data-atmosphere-path', 'lut')

  const visibleFraction = await readFiniteDataNumber(canvas, 'occlusionVisibleFraction')
  expect(visibleFraction).toBeGreaterThanOrEqual(0)
  expect(visibleFraction).toBeLessThanOrEqual(1)
  await expect(canvas).toHaveAttribute('data-occlusion-kind', /^(none|partial|total|annular)$/)

  await page.getByTestId('navigator-body-sun').click()
  await expect(canvas).toHaveAttribute('data-exposure-preset', 'solar-closeup')
  await expect(canvas).toHaveAttribute('data-exposure', '0.62')

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

async function bootPhaseFour(page: Page): Promise<Locator> {
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

async function setUtc(page: Page, value: string): Promise<void> {
  const controls = page.getByTestId('simulation-time-controls')
  const input = controls.locator('input[type="datetime-local"]').first()
  await input.evaluate((element, nextValue) => {
    const dateTimeInput = element as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(dateTimeInput, nextValue)
    dateTimeInput.dispatchEvent(new Event('input', { bubbles: true }))
    dateTimeInput.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await controls.getByRole('button', { name: 'Set UTC' }).click()
  await expect(page.getByTestId('ephemeris-provider-badge')).toHaveText(
    /JPL Horizons .* generated offline bundle/i,
  )
}

async function readVector(canvas: Locator, property: string): Promise<readonly number[]> {
  const rawValue = await canvas.evaluate(
    (element, key) => (element as HTMLElement).dataset[key],
    property,
  )
  const values = rawValue?.split(',').map(Number) ?? []
  expect(values).toHaveLength(3)
  expect(values.every(Number.isFinite)).toBe(true)
  return values
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

function vectorLength(vector: readonly number[]): number {
  return Math.hypot(...vector)
}

function vectorDistance(left: readonly number[], right: readonly number[]): number {
  return Math.hypot(...left.map((value, index) => value - (right[index] ?? 0)))
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
