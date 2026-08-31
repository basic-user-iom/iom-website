import { expect, test, type Locator, type Page } from '@playwright/test'

const PREFERENCE_KEY = 'iom.solar-system.preferences'

test.describe.serial('Phase 12 tide-ready extension', () => {
  test('keeps tidal sampling and disclosure absent without the developer flag', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseTwelve(page)

    await expect(page.getByTestId('experimental-tide-badge')).toHaveCount(0)
    await expect(canvas).toHaveAttribute('data-tide-debug-mode', 'off')
    await expect(canvas).toHaveAttribute('data-tide-overlay-active', 'false')
    await expect(canvas).toHaveAttribute('data-tide-sample-valid', 'false')

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('follows real Sun/Moon geometry at multiple epochs and hides during a scenario', async ({
    page,
  }) => {
    test.slow()
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseTwelve(page, '?experimentalTides=both')

    await expect(page.getByTestId('experimental-tide-badge')).toContainText(
      /experimental both equilibrium tides.*normalized.*not an ocean-tide prediction/i,
    )
    await expect(canvas).toHaveAttribute('data-tide-debug-mode', 'both')
    await expect(canvas).toHaveAttribute('data-tide-overlay-active', 'true')
    await expect(canvas).toHaveAttribute('data-tide-sample-valid', 'true')
    await expect(canvas).toHaveAttribute('data-tide-lunar-visible', 'true')
    await expect(canvas).toHaveAttribute('data-tide-solar-visible', 'true')

    const lunarAmplitude = await readFiniteNumber(canvas, 'tideLunarAmplitude')
    const solarAmplitude = await readFiniteNumber(canvas, 'tideSolarAmplitude')
    expect(lunarAmplitude).toBeGreaterThan(0)
    expect(solarAmplitude).toBeGreaterThan(0)
    expect(Math.max(lunarAmplitude, solarAmplitude)).toBeCloseTo(1, 6)
    expect(lunarAmplitude).toBeGreaterThan(solarAmplitude)

    await setUtc(page, '2000-01-01T00:00:00')
    const firstLunar = await readUnitVector(canvas, 'sublunarVisualDirection')
    const firstSolar = await readUnitVector(canvas, 'subsolarVisualDirection')
    await setUtc(page, '2000-01-01T06:00:00')
    const secondLunar = await readUnitVector(canvas, 'sublunarVisualDirection')
    const secondSolar = await readUnitVector(canvas, 'subsolarVisualDirection')
    expect(vectorDistance(firstLunar, secondLunar)).toBeGreaterThan(0.5)
    expect(vectorDistance(firstSolar, secondSolar)).toBeGreaterThan(0.5)

    await openPanel(page, 'impact-lab-panel', 'scenario-drawer-toggle')
    await page.getByTestId('impact-run').click()
    await expect(page.getByTestId('impact-confirmation')).toBeVisible()
    await page.getByTestId('impact-confirm').click()
    await expect(canvas).toHaveAttribute('data-impact-active', 'true')
    await expect(canvas).toHaveAttribute('data-tide-overlay-active', 'false')
    await expect(canvas).toHaveAttribute('data-tide-sample-valid', 'false')
    await page.getByTestId('impact-reset').click()
    await expect(canvas).toHaveAttribute('data-impact-active', 'false')
    await expect(canvas).toHaveAttribute('data-tide-overlay-active', 'true')
    await expect(canvas).toHaveAttribute('data-tide-sample-valid', 'true')

    await canvas.dispatchEvent('webglcontextlost')
    await expect(page.getByText('GPU lost', { exact: true })).toBeVisible()
    await canvas.dispatchEvent('webglcontextrestored')
    await expect(page.getByText('GPU ready', { exact: true })).toBeVisible()
    await expect(canvas).toHaveAttribute('data-tide-overlay-active', 'true')

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('renders the lunar and solar components independently', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page)
    const lunarCanvas = await bootPhaseTwelve(page, '?experimentalTides=lunar')
    await expect(lunarCanvas).toHaveAttribute('data-tide-debug-mode', 'lunar')
    await expect(lunarCanvas).toHaveAttribute('data-tide-lunar-visible', 'true')
    await expect(lunarCanvas).toHaveAttribute('data-tide-solar-visible', 'false')
    await expect(lunarCanvas).toHaveAttribute('data-tide-overlay-active', 'true')

    const solarCanvas = await bootPhaseTwelve(page, '?experimentalTides=solar')
    await expect(solarCanvas).toHaveAttribute('data-tide-debug-mode', 'solar')
    await expect(solarCanvas).toHaveAttribute('data-tide-lunar-visible', 'false')
    await expect(solarCanvas).toHaveAttribute('data-tide-solar-visible', 'true')
    await expect(solarCanvas).toHaveAttribute('data-tide-overlay-active', 'true')

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })
})

async function bootPhaseTwelve(page: Page, query = ''): Promise<Locator> {
  await page.goto(`./${query}`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((key) => localStorage.removeItem(key), PREFERENCE_KEY)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('solar-system-app')).toBeVisible()
  await expect(page.getByTestId('ephemeris-provider-badge')).toHaveText(
    /JPL Horizons .* generated offline bundles/i,
    { timeout: 30_000 },
  )
  const canvas = page.locator('canvas[data-testid="solar-system-canvas"]')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-tide-debug-mode', /.+/)
  return canvas
}

async function setUtc(page: Page, value: string): Promise<void> {
  const controls = page.getByTestId('simulation-time-controls')
  const input = controls.locator('input[type="datetime-local"]').first()
  const canvas = page.locator('canvas[data-testid="solar-system-canvas"]')
  const previousJdTdb = await readFiniteNumber(canvas, 'currentJdTdb')
  await input.evaluate((element, nextValue) => {
    const dateTimeInput = element as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(dateTimeInput, nextValue)
    dateTimeInput.dispatchEvent(new Event('input', { bubbles: true }))
    dateTimeInput.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await controls.getByRole('button', { name: 'Set UTC' }).click()
  await expect.poll(() => readFiniteNumber(canvas, 'currentJdTdb')).not.toBe(previousJdTdb)
}

async function openPanel(page: Page, panelTestId: string, toggleTestId: string): Promise<void> {
  const panel = page.getByTestId(panelTestId)
  if (await panel.isVisible().catch(() => false)) return
  await page.getByTestId(toggleTestId).first().click()
  await expect(panel).toBeVisible()
}

async function readFiniteNumber(canvas: Locator, property: string): Promise<number> {
  const raw = await canvas.getAttribute(`data-${camelToKebab(property)}`)
  const value = Number(raw)
  expect(raw, `${property} should be present`).not.toBeNull()
  expect(Number.isFinite(value), `${property} should be finite`).toBe(true)
  return value
}

async function readUnitVector(canvas: Locator, property: string): Promise<readonly number[]> {
  const raw = await canvas.getAttribute(`data-${camelToKebab(property)}`)
  expect(raw, `${property} should be present`).toBeTruthy()
  const vector = (raw ?? '').split(',').map(Number)
  expect(vector).toHaveLength(3)
  expect(vector.every(Number.isFinite)).toBe(true)
  expect(Math.hypot(...vector)).toBeCloseTo(1, 6)
  return vector
}

function vectorDistance(left: readonly number[], right: readonly number[]): number {
  return Math.hypot(
    (left[0] ?? 0) - (right[0] ?? 0),
    (left[1] ?? 0) - (right[1] ?? 0),
    (left[2] ?? 0) - (right[2] ?? 0),
  )
}

function camelToKebab(value: string): string {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)
}

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    const value = message.text()
    if (
      message.type() === 'error'
      || /THREE\.WebGLProgram|Shader Error|VALIDATE_STATUS|GL_INVALID_OPERATION/i.test(value)
    ) {
      errors.push(`console ${message.type()}: ${value}`)
    }
  })
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  return errors
}

async function settleBrowserErrors(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 50))
}
