import { expect, test, type Locator, type Page } from '@playwright/test'

const COMETS = [
  ['1p-halley', '1P/Halley'],
  ['2p-encke', '2P/Encke'],
  ['67p-churyumov-gerasimenko', '67P/Churyumov-Gerasimenko'],
  ['c-1995-o1-hale-bopp', 'C/1995 O1 (Hale-Bopp)'],
  ['c-2020-f3-neowise', 'C/2020 F3 (NEOWISE)'],
] as const

test('five named comets are selectable from offline bundles without runtime JPL requests', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  const jplRequests = captureRuntimeJplRequests(page)
  const canvas = await bootPhaseSix(page)

  for (const [bodyId, displayName] of COMETS) {
    const button = page.getByTestId(`navigator-body-${bodyId}`)
    await expect(button).toBeVisible()
    await expect(button).toBeEnabled()
    await expect(button.getByText(displayName, { exact: true })).toBeVisible()
    await expect(button.locator('small')).toHaveText('Comet')

    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas).toHaveAttribute('data-selected-body', bodyId)
    await expect(canvas).toHaveAttribute('data-camera-target', bodyId)
  }

  await expect(canvas).toHaveAttribute('data-comet-trusted-ephemeris', 'true')
  await settleBrowserErrors()
  expect(jplRequests, `runtime must use bundled data, not JPL/SBDB:\n${jplRequests.join('\n')}`).toEqual([])
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('comet diagnostics expose changing unit anti-solar direction and curved dust history', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseSix(page)
  await pauseSimulation(page)
  await setUtc(page, '2005-01-15T12:00:00')
  await page.getByTestId('navigator-body-2p-encke').click()
  await expect(canvas).toHaveAttribute('data-selected-body', '2p-encke')
  await expect(canvas).toHaveAttribute('data-comet-trusted-ephemeris', 'true')
  await expect(canvas).toHaveAttribute(
    'data-visual-material',
    /soft radial-density coma.*tapered ion ribbon.*curved multi-grain dust fan/i,
  )
  await expect(canvas).toHaveAttribute('data-comet-coma-rendering', 'soft radial density')
  await expect(canvas).toHaveAttribute(
    'data-comet-tail-rendering',
    'continuous faded ribbons with soft particles',
  )
  await expect(page.getByTestId('comet-approximation-warning')).toContainText(
    /Horizons vector is \d+ years from JPL orbit solution K273\/11;.*uncertain/i,
  )
  const coverageDisclosure = page.getByTestId('orbit-coverage-warning-badge')
  await expect(coverageDisclosure).toContainText(
    /coverage-limited orbit arcs?.*none fabricated/i,
  )
  await expect(coverageDisclosure).toHaveAttribute(
    'title',
    /path is truncated.*bundled ephemeris coverage.*no missing arc was fabricated/i,
  )

  await setUtc(page, '2026-01-15T12:00:00')
  await expect(page.getByTestId('comet-approximation-warning')).toBeHidden()
  await expect.poll(async () => vectorLength(await readVector(canvas, 'cometIonDirection')))
    .toBeGreaterThan(0.99)
  const firstDirection = await readVector(canvas, 'cometIonDirection')
  expect(vectorLength(firstDirection)).toBeCloseTo(1, 4)

  const ionPointCount = await readFiniteDataNumber(canvas, 'cometIonPointCount')
  const dustPointCount = await readFiniteDataNumber(canvas, 'cometDustPointCount')
  const dustHistoryDays = await readFiniteDataNumber(canvas, 'cometDustHistoryDays')
  const dustCurvatureM = await readFiniteDataNumber(canvas, 'cometDustCurvatureM')
  expect(ionPointCount).toBeGreaterThan(1)
  expect(dustPointCount).toBeGreaterThan(1)
  expect(dustPointCount).not.toBe(ionPointCount)
  expect(dustHistoryDays).toBeGreaterThan(0)
  expect(dustCurvatureM).toBeGreaterThan(0)

  await setUtc(page, '2027-07-15T12:00:00')
  await expect
    .poll(async () =>
      vectorDistance(await readVector(canvas, 'cometIonDirection'), firstDirection),
    )
    .toBeGreaterThan(0.05)
  const secondDirection = await readVector(canvas, 'cometIonDirection')
  expect(vectorLength(secondDirection)).toBeCloseTo(1, 4)

  const activity = await readFiniteDataNumber(canvas, 'cometActivity')
  expect(activity).toBeGreaterThanOrEqual(0)
  expect(activity).toBeLessThanOrEqual(1)
  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('camera-centered background has zero translation delta and quality selects the sky tier', async ({
  page,
}) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseSix(page)
  const quality = page.getByTestId('visual-quality-select')
  const app = page.getByTestId('solar-system-app')

  await expectBackgroundCentered(canvas)
  const initialCamera = await readVector(canvas, 'cameraPosition')
  await page.getByTestId('navigator-body-c-1995-o1-hale-bopp').click()
  await expect(canvas).toHaveAttribute('data-camera-target', 'c-1995-o1-hale-bopp')
  await expect
    .poll(async () => vectorDistance(await readVector(canvas, 'cameraPosition'), initialCamera))
    .toBeGreaterThan(0.01)
  await expectBackgroundCentered(canvas)

  for (const qualityTier of ['low', 'medium', 'high'] as const) {
    await quality.selectOption(qualityTier)
    await expect(app).toHaveAttribute('data-visual-quality', qualityTier)
    await expect(canvas).toHaveAttribute('data-sky-texture-tier', '4k')
  }

  const maximumTextureSize = await canvas.evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext('webgl2')
    return context === null ? 0 : Number(context.getParameter(context.MAX_TEXTURE_SIZE))
  })
  expect(maximumTextureSize).toBeGreaterThan(0)
  await quality.selectOption('ultra')
  await expect(app).toHaveAttribute('data-visual-quality', 'ultra')
  await expect(canvas).toHaveAttribute(
    'data-sky-texture-tier',
    maximumTextureSize >= 8_192 ? '8k' : '4k',
  )
  await expect(canvas).toHaveAttribute('data-sky-asset-state', /^(ready|fallback)$/, {
    timeout: 15_000,
  })

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

test('statistical belt toggles retain an explicit non-catalog disclosure', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page)
  const canvas = await bootPhaseSix(page)
  const asteroidToggle = page.getByTestId('asteroid-belt-toggle')
  const kuiperToggle = page.getByTestId('kuiper-belt-toggle')
  const warning = page.getByTestId('statistical-belt-warning')

  await expect(canvas).toHaveAttribute('data-statistical-belt-label', 'Statistical visualization')
  await expect(asteroidToggle).toBeChecked()
  await expect(kuiperToggle).not.toBeChecked()
  await expect(warning).toContainText(/Statistical visualization.*not one-to-one real objects/i)
  expect(await readFiniteDataNumber(canvas, 'asteroidBeltInstances')).toBeGreaterThan(0)
  expect(await readFiniteDataNumber(canvas, 'kuiperBeltInstances')).toBe(0)
  expect(await readFiniteDataNumber(canvas, 'asteroidBeltMaximumMarkerPx')).toBeLessThanOrEqual(2.2)
  expect(await readFiniteDataNumber(canvas, 'kuiperBeltMaximumMarkerPx')).toBeLessThanOrEqual(2)

  await asteroidToggle.uncheck()
  await expect(warning).toBeHidden()
  await expect(canvas).toHaveAttribute('data-asteroid-belt-instances', '0')
  await expect(canvas).toHaveAttribute('data-statistical-belt-label', 'Statistical visualization')
  await kuiperToggle.check()
  await expect(warning).toContainText(/Statistical visualization/i)
  await expect
    .poll(() => readFiniteDataNumber(canvas, 'kuiperBeltInstances'))
    .toBeGreaterThan(0)

  await page.getByTestId('visual-quality-select').selectOption('ultra')
  await expect(warning).toContainText(/not one-to-one real objects/i)
  await expect(canvas).toHaveAttribute('data-statistical-belt-label', 'Statistical visualization')

  await settleBrowserErrors()
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

async function bootPhaseSix(page: Page): Promise<Locator> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('solar-system-app')).toBeVisible()
  await expect(page.getByTestId('ephemeris-provider-badge')).toHaveText(
    /JPL Horizons .* generated offline bundles/i,
    { timeout: 30_000 },
  )
  await expect(page.locator('.canvas-topbar')).not.toContainText(/Phase\s+\d+/i)
  await expect(page.getByTestId('navigator-body-1p-halley')).toBeEnabled()
  const canvas = page.locator('canvas[data-testid="solar-system-canvas"]')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-camera-mode', /.+/)
  await expect(canvas).toHaveAttribute('data-bright-star-count', /[1-9]\d*/)
  return canvas
}

async function pauseSimulation(page: Page): Promise<void> {
  const controls = page.getByTestId('simulation-time-controls')
  const pause = controls.getByRole('button', { name: 'Pause simulation' })
  if (await pause.isVisible()) await pause.click()
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

async function expectBackgroundCentered(canvas: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const background = await readVector(canvas, 'backgroundCenter')
      const camera = await readVector(canvas, 'cameraPosition')
      return vectorDistance(background, camera)
    })
    .toBe(0)
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

function captureRuntimeJplRequests(page: Page): string[] {
  const requests: string[] = []
  page.on('request', (request) => {
    const hostname = new URL(request.url()).hostname.toLocaleLowerCase()
    if (hostname === 'ssd.jpl.nasa.gov' || hostname === 'ssd-api.jpl.nasa.gov') {
      requests.push(request.url())
    }
  })
  return requests
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
