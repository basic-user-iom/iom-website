import { expect, test, type Locator, type Page } from '@playwright/test'

const PREFERENCE_KEY = 'iom.solar-system.preferences'
const FICTIONAL_WARNING =
  'Cinematic scenario: the real Sun is not massive enough to explode as a supernova.'

const EVOLUTION_NUMERIC_DIAGNOSTICS = [
  'data-solar-evolution-stellar-radius',
  'data-solar-evolution-bounding-radius',
  'data-solar-evolution-particles',
  'data-solar-evolution-heated-bodies',
] as const

const FICTIONAL_NUMERIC_DIAGNOSTICS = [
  'data-fictional-supernova-core-radius',
  'data-fictional-supernova-bounding-radius',
  'data-fictional-supernova-debris-points',
  'data-fictional-supernova-heated-bodies',
  'data-fictional-supernova-flash-intensity',
] as const

test.describe.serial('Phase 9 Solar Fate', () => {
  test('makes the scientific narrative and fictional cinematic unmistakably separate', async ({
    page,
  }) => {
    const browserErrors = captureBrowserErrors(page)
    await bootPhaseNine(page)
    await openSolarFate(page)

    const panel = page.getByTestId('solar-fate-panel')
    const scientific = page.getByTestId('solar-evolution-option')
    const fictional = page.getByTestId('fictional-supernova-option')
    await expect(panel.getByRole('heading', { name: 'Solar Fate' })).toBeVisible()
    await expect(page.getByTestId('solar-fate-distinction')).toContainText(
      /mutually exclusive.*compressed educational.*deliberately fictional cinema/i,
    )

    await expect(scientific).toHaveAttribute('data-classification', 'scientific')
    await expect(scientific.getByRole('heading')).toHaveText('Scientific Solar Evolution')
    await expect(scientific).toContainText(/Scientific.*compressed educational visualization/i)
    await expect(scientific).toContainText(/not a detailed stellar-evolution solver/i)
    await expect(scientific).not.toContainText(/supernova/i)
    await expect(scientific.getByRole('button')).toHaveAccessibleName(
      'Scientific Solar Evolution',
    )

    await expect(fictional).toHaveAttribute('data-classification', 'fictional-cinematic')
    await expect(fictional.getByRole('heading')).toHaveText('Fictional Solar Supernova')
    await expect(fictional).toContainText(/Fictional.*cinematic.*impossible for the Sun/i)
    await expect(page.getByTestId('fictional-supernova-warning')).toHaveText(FICTIONAL_WARNING)
    await expect(fictional.getByRole('button')).toHaveAccessibleName(
      'Fictional Solar Supernova',
    )

    const fictionalStart = page.getByTestId('fictional-supernova-start')
    await fictionalStart.focus()
    expect(await fictionalStart.evaluate((element) => getComputedStyle(element).outlineStyle))
      .not.toBe('none')
    await fictionalStart.click()

    const confirmation = page.getByTestId('fictional-supernova-confirmation')
    await expect(confirmation).toBeVisible()
    await expect(confirmation).toHaveAttribute('role', 'dialog')
    await expect(confirmation).toHaveAttribute('aria-modal', 'true')
    await expect(confirmation).toContainText(
      /Photosensitivity warning.*pulsing light.*intense flash.*abrupt exposure changes/i,
    )
    await expect(page.getByTestId('fictional-supernova-confirmation-warning'))
      .toHaveText(FICTIONAL_WARNING)
    await expect(page.getByTestId('fictional-supernova-confirm-cancel')).toBeFocused()
    await expect(page.getByTestId('fictional-supernova-confirm-reduce-flashes')).toBeChecked()

    await page.keyboard.press('Tab')
    await expect(page.getByTestId('fictional-supernova-confirm')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
      confirmation.getByRole('button', {
        name: 'Cancel: Confirm Fictional Solar Supernova',
      }),
    ).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(confirmation).toBeHidden()
    await expect(panel.getByRole('heading', { name: 'Solar Fate' })).toBeFocused()
    await expect(page.getByTestId('solar-system-app')).toHaveAttribute(
      'data-active-scenario',
      '',
    )

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('scientific evolution supports deterministic transport and pristine reset', async ({
    page,
  }) => {
    test.slow()
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseNine(page)
    await waitForSettledExposure(canvas)
    const original = await observatoryState(canvas)
    const originalExposure = Number(await requiredAttribute(canvas, 'data-exposure'))
    const app = page.getByTestId('solar-system-app')

    await page.getByTestId('tour-toggle').click()
    await expect(app).toHaveAttribute('data-tour-state', 'running')
    await openSolarFate(page)
    await page.getByTestId('solar-evolution-start').click()

    await expect(app).toHaveAttribute('data-active-scenario', 'scientific-solar-evolution')
    await expect(app).toHaveAttribute('data-solar-fate-mode', 'scientific-evolution')
    await expect(app).toHaveAttribute('data-solar-fate-state', /^(running|paused)$/)
    await expect(app).toHaveAttribute('data-tour-state', 'cancelled')
    await expect(page.getByTestId('solar-evolution-active')).toBeVisible()
    await expect(page.getByTestId('solar-evolution-active')).not.toContainText(/supernova/i)
    await expect(page.getByTestId('solar-evolution-active-caveat')).toContainText(
      /not a detailed stellar-evolution solver.*qualitative\/compressed/i,
    )
    await expect(page.getByTestId('solar-evolution-time-compression')).toContainText(
      /billions of years.*compressed.*planetary geometry.*held fixed/i,
    )
    await expect(page.getByTestId('solar-evolution-profile-caveats')).toContainText(
      /source-informed educational narrative/i,
    )
    const hud = page.getByTestId('solar-evolution-hud')
    await expect(hud).toBeVisible()
    await expect(hud).toContainText(/Scientific Solar Evolution.*compressed/i)
    await expect(hud).not.toContainText(/supernova/i)

    await expect(page.getByTestId('scenario-drawer-toggle')).toBeDisabled()
    await expect(page.getByTestId('tour-toggle')).toBeDisabled()
    await expect(page.getByTestId('solar-fate-close')).toBeDisabled()
    await expect(page.getByTestId('fictional-supernova-start')).toHaveCount(0)
    await expect(canvas).toHaveAttribute('data-solar-fate-mode', 'scientific-solar-evolution')
    await expect(canvas).toHaveAttribute('data-selected-body', 'sun')
    await expect(canvas).toHaveAttribute('data-camera-mode', 'body-follow')
    await expect(canvas).toHaveAttribute('data-solar-evolution-active', 'true')
    await expect(canvas).toHaveAttribute('data-solar-evolution-phase', /.+/)
    await expect(canvas).toHaveAttribute('data-fictional-supernova-active', 'false')
    await expect(canvas).toHaveAttribute('data-solar-evolution-base-sun-hidden', /^(true|false)$/)

    await pauseSolarFate(page, 'solar-evolution')
    const signature = await requiredAttribute(canvas, 'data-solar-evolution-run-signature')
    expect(signature.length).toBeGreaterThan(8)
    await assertFiniteCanvasDiagnostics(canvas, EVOLUTION_NUMERIC_DIAGNOSTICS)
    await assertFiniteCanvasDiagnostics(canvas, [
      'data-exposure',
      'data-target-exposure',
      'data-camera-near',
      'data-camera-far',
    ])

    await page.getByTestId('solar-evolution-step').click()
    await expect(app).toHaveAttribute('data-solar-fate-state', 'paused')
    await expect(canvas).toHaveAttribute('data-solar-evolution-run-signature', signature)

    const stageBeforeSkip = await requiredAttribute(app, 'data-solar-fate-stage')
    await page.getByTestId('solar-evolution-skip').click()
    await expect.poll(() => app.getAttribute('data-solar-fate-stage')).not.toBe(stageBeforeSkip)
    await expect(page.getByTestId('solar-evolution-active-caveat')).toBeVisible()
    await assertFiniteCanvasDiagnostics(canvas, EVOLUTION_NUMERIC_DIAGNOSTICS)

    await skipScientificStage(page, app)
    await expect(page.getByTestId('solar-evolution-uncertainty')).toContainText(
      /explicitly uncertain.*Earth/i,
    )
    await skipScientificStage(page, app)
    await skipScientificStage(page, app)
    await expect(page.getByTestId('solar-evolution-remnant-scale-note')).toContainText(
      /close-up camera.*physical-radius geometry.*no display-size floor/i,
    )

    await page.getByTestId('solar-evolution-replay').click()
    await expect(app).toHaveAttribute('data-solar-fate-state', 'running')
    await expect(canvas).toHaveAttribute('data-solar-evolution-run-signature', signature)
    await expect(page.getByTestId('solar-evolution-hud')).toBeVisible()

    await page.getByTestId('solar-evolution-reset').evaluate((element) => {
      const button = element as HTMLButtonElement
      button.click()
      button.click()
    })
    await expectSolarFateReset(page, canvas)
    await expect.poll(() => observatoryState(canvas)).toEqual(original)
    await expect.poll(async () => Math.abs(
      Number(await requiredAttribute(canvas, 'data-exposure')) - originalExposure,
    )).toBeLessThanOrEqual(0.04)
    await expect(page.getByTestId('simulation-time-controls')).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(page.getByTestId('solar-evolution-option')).toBeVisible()
    await expect(page.getByTestId('fictional-supernova-option')).toBeVisible()

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('fictional supernova keeps its warning, clamps flashes, and resets every effect', async ({
    page,
  }) => {
    test.slow()
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseNine(page)
    await waitForSettledExposure(canvas)
    const original = await observatoryState(canvas)
    const originalExposure = Number(await requiredAttribute(canvas, 'data-exposure'))
    const app = page.getByTestId('solar-system-app')

    await openSolarFate(page)
    await startFictionalSupernova(page, canvas)
    await expect(app).toHaveAttribute('data-active-scenario', 'fictional-supernova')
    await expect(app).toHaveAttribute('data-solar-fate-mode', 'fictional-supernova')
    await expect(page.getByTestId('fictional-supernova-active-warning')).toHaveText(
      FICTIONAL_WARNING,
    )
    const hud = page.getByTestId('fictional-supernova-hud')
    await expect(hud).toBeVisible()
    await expect(hud).toContainText(FICTIONAL_WARNING)
    await expect(hud).toContainText(/timing.*propagation.*compressed/i)
    await expect(page.getByTestId('fictional-supernova-active-reduce-flashes')).toBeChecked()

    await expect(page.getByTestId('scenario-drawer-toggle')).toBeDisabled()
    await expect(page.getByTestId('tour-toggle')).toBeDisabled()
    await expect(page.getByTestId('solar-fate-close')).toBeDisabled()
    await expect(page.getByTestId('solar-evolution-start')).toHaveCount(0)
    await expect(canvas).toHaveAttribute('data-solar-fate-mode', 'fictional-supernova')
    await expect(canvas).toHaveAttribute('data-fictional-supernova-active', 'true')
    await expect(canvas).toHaveAttribute('data-fictional-supernova-phase', /.+/)
    await expect(canvas).toHaveAttribute('data-solar-evolution-active', 'false')
    await expect(canvas).toHaveAttribute('data-fictional-supernova-base-sun-hidden', 'true')
    await expect(canvas).toHaveAttribute('data-reduce-flashes', 'true')

    await pauseSolarFate(page, 'fictional-supernova')
    const signature = await requiredAttribute(canvas, 'data-fictional-supernova-run-signature')
    expect(signature.length).toBeGreaterThan(8)
    await assertFiniteCanvasDiagnostics(canvas, FICTIONAL_NUMERIC_DIAGNOSTICS)

    for (let transition = 0; transition < 8; transition += 1) {
      await expect(page.getByTestId('fictional-supernova-active-warning')).toHaveText(
        FICTIONAL_WARNING,
      )
      await expect(page.getByTestId('fictional-supernova-hud')).toContainText(FICTIONAL_WARNING)
      await assertFiniteCanvasDiagnostics(canvas, FICTIONAL_NUMERIC_DIAGNOSTICS)
      const flashIntensity = Number(
        await requiredAttribute(canvas, 'data-fictional-supernova-flash-intensity'),
      )
      expect(flashIntensity).toBeLessThanOrEqual(0.68)

      if ((await app.getAttribute('data-solar-fate-state')) === 'complete') break
      const stageBeforeSkip = await requiredAttribute(app, 'data-solar-fate-stage')
      await page.getByTestId('fictional-supernova-skip').click()
      await expect.poll(async () => ({
        stage: await app.getAttribute('data-solar-fate-stage'),
        state: await app.getAttribute('data-solar-fate-state'),
      })).not.toEqual({ stage: stageBeforeSkip, state: 'paused' })
    }

    await expect(app).toHaveAttribute('data-solar-fate-state', 'complete')
    await expect(page.getByTestId('fictional-supernova-active-warning')).toHaveText(
      FICTIONAL_WARNING,
    )
    await expect(page.getByTestId('fictional-supernova-hud')).toContainText(FICTIONAL_WARNING)
    await expect(page.getByTestId('fictional-supernova-replay')).toBeVisible()
    await expect(page.getByTestId('fictional-supernova-reset')).toBeVisible()

    await page.getByTestId('fictional-supernova-replay').click()
    await expect(app).toHaveAttribute('data-solar-fate-state', 'running')
    await expect(canvas).toHaveAttribute('data-fictional-supernova-run-signature', signature)
    await pauseSolarFate(page, 'fictional-supernova')
    await expect(page.getByTestId('fictional-supernova-active-warning')).toHaveText(
      FICTIONAL_WARNING,
    )

    await page.getByTestId('fictional-supernova-reset').evaluate((element) => {
      const button = element as HTMLButtonElement
      button.click()
      button.click()
    })
    await expectSolarFateReset(page, canvas)
    await expect.poll(() => observatoryState(canvas)).toEqual(original)
    await expect.poll(async () => Math.abs(
      Number(await requiredAttribute(canvas, 'data-exposure')) - originalExposure,
    )).toBeLessThanOrEqual(0.04)

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('Solar Fate panel, confirmation, and persistent HUD never overflow responsive layouts', async ({
    page,
  }) => {
    test.slow()
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseNine(page)
    await openSolarFate(page)
    await page.getByTestId('fictional-supernova-start').click()

    const panel = page.getByTestId('solar-fate-panel')
    const confirmation = page.getByTestId('fictional-supernova-confirmation')
    for (const width of [1280, 1120, 820, 680, 430, 390, 320]) {
      await page.setViewportSize({ width, height: 720 })
      await expect(panel).toBeVisible()
      await expect(confirmation).toBeVisible()
      await expect(page.getByTestId('fictional-supernova-confirmation-warning')).toBeVisible()
      expect(await horizontalOverflow(page), `confirmation overflow at ${width}px`)
        .toBeLessThanOrEqual(1)
      const dialogBox = await confirmation.boundingBox()
      expect(dialogBox).not.toBeNull()
      expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
      expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(width + 1)
      await page.getByTestId('fictional-supernova-confirm').scrollIntoViewIfNeeded()
      await expect(page.getByTestId('fictional-supernova-confirm')).toBeVisible()
    }

    await page.getByTestId('fictional-supernova-confirm').click()
    await expect(canvas).toHaveAttribute('data-fictional-supernova-active', 'true')
    await pauseSolarFate(page, 'fictional-supernova')
    const hud = page.getByTestId('fictional-supernova-hud')
    for (const width of [1280, 1120, 820, 680, 430, 390, 320]) {
      await page.setViewportSize({ width, height: 720 })
      await expect(panel).toBeVisible()
      await expect(hud).toBeVisible()
      await expect(hud).toContainText(FICTIONAL_WARNING)
      expect(await horizontalOverflow(page), `active HUD overflow at ${width}px`)
        .toBeLessThanOrEqual(1)
      const hudBox = await hud.boundingBox()
      expect(hudBox).not.toBeNull()
      expect(hudBox!.x).toBeGreaterThanOrEqual(0)
      expect(hudBox!.x + hudBox!.width).toBeLessThanOrEqual(width + 1)
    }

    await page.getByTestId('fictional-supernova-reset').click()
    await expectSolarFateReset(page, canvas)
    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })
})

async function bootPhaseNine(page: Page): Promise<Locator> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await page.evaluate((key) => localStorage.removeItem(key), PREFERENCE_KEY)
  await page.reload({ waitUntil: 'domcontentloaded' })
  const app = page.getByTestId('solar-system-app')
  await expect(app).toBeVisible()
  await expect(page.getByTestId('ephemeris-provider-badge')).toHaveText(
    /JPL Horizons .* generated offline bundles/i,
    { timeout: 30_000 },
  )
  await expect(page.getByTestId('solar-fate-drawer-toggle')).toBeEnabled()
  await expect(app).toHaveAttribute('data-active-scenario', '')
  await expect(app).toHaveAttribute('data-solar-fate-mode', 'idle')
  await expect(app).toHaveAttribute('data-solar-fate-state', 'idle')
  await expect(app).toHaveAttribute('data-solar-fate-stage', 'idle')
  const canvas = page.locator('canvas[data-testid="solar-system-canvas"]')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-camera-mode', /.+/)
  await expect(canvas).toHaveAttribute('data-solar-fate-mode', 'none')
  await expect(canvas).toHaveAttribute('data-solar-evolution-active', 'false')
  await expect(canvas).toHaveAttribute('data-fictional-supernova-active', 'false')
  return canvas
}

async function openSolarFate(page: Page): Promise<void> {
  const panel = page.getByTestId('solar-fate-panel')
  if (await panel.isVisible().catch(() => false)) return
  const toggle = page.getByTestId('solar-fate-drawer-toggle')
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(panel).toBeVisible()
}

async function startFictionalSupernova(page: Page, canvas: Locator): Promise<void> {
  await page.getByTestId('fictional-supernova-start').click()
  const confirmation = page.getByTestId('fictional-supernova-confirmation')
  await expect(confirmation).toBeVisible()
  await expect(page.getByTestId('fictional-supernova-confirm-reduce-flashes')).toBeChecked()
  await page.getByTestId('fictional-supernova-confirm').click()
  await expect(canvas).toHaveAttribute('data-solar-fate-mode', 'fictional-supernova')
  await expect(canvas).toHaveAttribute('data-fictional-supernova-active', 'true')
}

async function pauseSolarFate(
  page: Page,
  prefix: 'solar-evolution' | 'fictional-supernova',
): Promise<void> {
  const app = page.getByTestId('solar-system-app')
  if ((await app.getAttribute('data-solar-fate-state')) !== 'paused') {
    const pause = page.getByTestId(`${prefix}-pause`)
    await expect(pause).toBeVisible()
    await pause.click()
  }
  await expect(app).toHaveAttribute('data-solar-fate-state', 'paused')
  await expect(page.getByTestId(`${prefix}-step`)).toBeVisible()
}

async function skipScientificStage(page: Page, app: Locator): Promise<void> {
  const stageBeforeSkip = await requiredAttribute(app, 'data-solar-fate-stage')
  await page.getByTestId('solar-evolution-skip').click()
  await expect.poll(() => app.getAttribute('data-solar-fate-stage')).not.toBe(stageBeforeSkip)
}

async function expectSolarFateReset(page: Page, canvas: Locator): Promise<void> {
  const app = page.getByTestId('solar-system-app')
  await expect(app).toHaveAttribute('data-active-scenario', '')
  await expect(app).toHaveAttribute('data-solar-fate-mode', 'idle')
  await expect(app).toHaveAttribute('data-solar-fate-state', 'idle')
  await expect(app).toHaveAttribute('data-solar-fate-stage', 'idle')
  await expect(page.getByTestId('solar-evolution-hud')).toBeHidden()
  await expect(page.getByTestId('fictional-supernova-hud')).toBeHidden()
  await expect(canvas).toHaveAttribute('data-solar-fate-mode', 'none')
  await expect(canvas).toHaveAttribute('data-solar-evolution-active', 'false')
  await expect(canvas).toHaveAttribute('data-fictional-supernova-active', 'false')
  await expect(canvas).toHaveAttribute('data-solar-evolution-run-signature', '')
  await expect(canvas).toHaveAttribute('data-fictional-supernova-run-signature', '')
  await expect(canvas).toHaveAttribute('data-solar-evolution-base-sun-hidden', 'false')
  await expect(canvas).toHaveAttribute('data-fictional-supernova-base-sun-hidden', 'false')
  await expect(canvas).toHaveAttribute('data-fictional-supernova-flash-visible', 'false')
  await assertZeroCanvasDiagnostics(canvas, EVOLUTION_NUMERIC_DIAGNOSTICS)
  await assertZeroCanvasDiagnostics(canvas, FICTIONAL_NUMERIC_DIAGNOSTICS)
}

async function waitForSettledExposure(canvas: Locator): Promise<void> {
  await expect.poll(async () => {
    const exposure = Number(await requiredAttribute(canvas, 'data-exposure'))
    const target = Number(await requiredAttribute(canvas, 'data-target-exposure'))
    return Math.abs(exposure - target)
  }).toBeLessThanOrEqual(0.01)
}

async function assertFiniteCanvasDiagnostics(
  canvas: Locator,
  attributes: readonly string[],
): Promise<void> {
  for (const attribute of attributes) {
    const raw = await requiredAttribute(canvas, attribute)
    expect(raw, `${attribute} must not contain NaN`).not.toMatch(/NaN/i)
    expect(raw, `${attribute} must not contain Infinity`).not.toMatch(/Infinity/i)
    const values = raw.split(',').map(Number)
    expect(values.length, `${attribute} must expose at least one number`).toBeGreaterThan(0)
    expect(
      values.every(Number.isFinite),
      `${attribute} must contain only finite numbers; received ${raw}`,
    ).toBe(true)
  }
}

async function assertZeroCanvasDiagnostics(
  canvas: Locator,
  attributes: readonly string[],
): Promise<void> {
  await assertFiniteCanvasDiagnostics(canvas, attributes)
  for (const attribute of attributes) {
    const values = (await requiredAttribute(canvas, attribute)).split(',').map(Number)
    expect(values.every((value) => value === 0), `${attribute} must reset to zero`).toBe(true)
  }
}

async function observatoryState(canvas: Locator): Promise<Readonly<Record<string, string>>> {
  const attributes = [
    'data-selected-body',
    'data-camera-mode',
    'data-camera-target',
    'data-camera-position',
    'data-scale-mode',
    'data-exposure-preset',
    'data-current-jd-tdb',
  ] as const
  const state: Record<string, string> = {}
  for (const attribute of attributes) state[attribute] = await requiredAttribute(canvas, attribute)
  return state
}

async function requiredAttribute(locator: Locator, name: string): Promise<string> {
  const value = await locator.getAttribute(name)
  if (value === null) throw new Error(`Expected ${name} on ${await locator.getAttribute('data-testid')}`)
  return value
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
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
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  return errors
}

async function settleBrowserErrors(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 50))
}
