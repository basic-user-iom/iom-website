import { expect, test, type Locator, type Page } from '@playwright/test'

const PREFERENCE_KEY = 'iom.solar-system.preferences'
const CINEMATIC_WARNING =
  'Nonphysical cinematic mode: artificial orbital damping is applied to guarantee that every body spirals inward.'

const BLACK_HOLE_NUMERIC_DIAGNOSTICS = [
  'data-black-hole-event-horizon-radius',
  'data-black-hole-visual-radius',
  'data-black-hole-stream-points',
  'data-black-hole-captured-bodies',
  'data-black-hole-disrupted-bodies',
  'data-black-hole-base-body-overrides',
] as const

const PHYSICS_UI_DIAGNOSTICS = [
  'black-hole-kinetic-energy',
  'black-hole-potential-energy',
  'black-hole-total-energy',
  'black-hole-energy-drift',
  'black-hole-linear-momentum',
  'black-hole-linear-momentum-drift',
  'black-hole-angular-momentum',
  'black-hole-angular-momentum-drift',
  'black-hole-minimum-distance',
  'black-hole-chosen-substep',
  'black-hole-completed-substeps',
  'black-hole-physics-survivors',
  'black-hole-physics-ejected',
  'black-hole-physics-captured',
] as const

test.describe.serial('Phase 10 Black-Hole Encounters', () => {
  test('makes open-outcome Physics Flyby and guaranteed cinematic consumption unmistakably separate', async ({
    page,
  }) => {
    const browserErrors = captureBrowserErrors(page)
    await bootPhaseTen(page)
    await openBlackHoleEncounter(page)

    const panel = page.getByTestId('black-hole-encounter-panel')
    const physics = page.getByTestId('black-hole-physics-option')
    const cinematic = page.getByTestId('black-hole-cinematic-option')
    await expect(panel.getByRole('heading', { name: 'Black-Hole Encounter' })).toBeVisible()
    await expect(page.getByTestId('black-hole-mode-distinction')).toContainText(
      /mutually exclusive.*educational physics flyby.*nonphysical cinematic.*guarantees/i,
    )

    await expect(physics).toHaveAttribute('data-classification', 'educational-approximation')
    await expect(physics.getByRole('heading', { name: 'Physics Flyby', exact: true }))
      .toHaveText('Physics Flyby')
    await expect(physics).toContainText(/educational approximation.*deterministic N-body flyby/i)
    await expect(page.getByTestId('black-hole-physics-caveat')).toContainText(
      /Newtonian N-body gravity.*capture threshold.*not an orbital general-relativity solver/i,
    )
    await expect(page.getByTestId('black-hole-equal-mass-note')).toContainText(
      /equal-mass misconception.*would not by gravity alone make the planets fall in/i,
    )
    await expect(physics).toContainText(/survival, ejection, and capture.*never guaranteed/i)
    await expect(physics).not.toContainText(CINEMATIC_WARNING)

    for (const testId of [
      'black-hole-mass',
      'black-hole-position-x',
      'black-hole-position-y',
      'black-hole-position-z',
      'black-hole-velocity-x',
      'black-hole-velocity-y',
      'black-hole-velocity-z',
      'black-hole-target-x',
      'black-hole-target-y',
      'black-hole-target-z',
      'black-hole-closest-time',
      'black-hole-spin',
      'black-hole-accretion-disk',
      'black-hole-capture-radius-multiple',
      'black-hole-accuracy',
      'black-hole-seed',
    ]) {
      await expect(page.getByTestId(testId)).toBeEnabled()
    }
    await expect(page.getByTestId('black-hole-spin')).toHaveAttribute('min', '-1')
    await expect(page.getByTestId('black-hole-spin')).toHaveAttribute('max', '1')
    await expect(page.getByTestId('black-hole-capture-radius-multiple'))
      .toHaveAttribute('max', '10000')
    const schwarzschildRadius = await readOutputNumber(
      page.getByTestId('black-hole-schwarzschild-radius'),
    )
    const captureRadius = await readOutputNumber(page.getByTestId('black-hole-capture-radius'))
    expect(schwarzschildRadius).toBeGreaterThan(0)
    expect(captureRadius).toBeGreaterThanOrEqual(schwarzschildRadius)
    await expect(page.getByTestId('black-hole-capture-radius-note')).toContainText(
      /2GM\/c².*scenario removal threshold.*not.*orbital-GR/i,
    )

    await expect(cinematic).toHaveAttribute('data-classification', 'cinematic')
    await expect(cinematic.getByRole('heading', {
      name: 'Complete Consumption — Cinematic',
      exact: true,
    })).toHaveText('Complete Consumption — Cinematic')
    await expect(cinematic).toContainText(/cinematic.*deliberately nonphysical.*guaranteed/i)
    await expect(page.getByTestId('black-hole-cinematic-warning')).toHaveText(
      CINEMATIC_WARNING,
    )
    await expect(cinematic).toContainText(/damping.*ordering.*timing.*artistic/i)

    const physicsStart = page.getByTestId('black-hole-physics-start')
    await physicsStart.focus()
    expect(await physicsStart.evaluate((element) => getComputedStyle(element).outlineStyle))
      .not.toBe('none')
    await physicsStart.click()
    const physicsConfirmation = page.getByTestId('black-hole-physics-confirmation')
    await expect(physicsConfirmation).toBeVisible()
    await expect(physicsConfirmation).toHaveAttribute('role', 'dialog')
    await expect(physicsConfirmation).toHaveAttribute('aria-modal', 'true')
    await expect(physicsConfirmation).toContainText(/destructive scenario.*Reset restores.*ephemeris/i)
    await expect(page.getByTestId('black-hole-physics-confirm-cancel')).toBeFocused()
    await expect(page.getByTestId('solar-system-app')).toHaveAttribute('data-active-scenario', '')

    await page.keyboard.press('Escape')
    await expect(physicsConfirmation).toBeHidden()
    await expect(panel.getByRole('heading', { name: 'Black-Hole Encounter' })).toBeFocused()

    await page.getByTestId('black-hole-cinematic-start').click()
    const cinematicConfirmation = page.getByTestId('black-hole-cinematic-confirmation')
    await expect(cinematicConfirmation).toBeVisible()
    await expect(cinematicConfirmation).toContainText(
      /Photosensitivity warning.*accretion flares.*lensing pulses.*exposure changes/i,
    )
    await expect(page.getByTestId('black-hole-cinematic-confirmation-warning'))
      .toHaveText(CINEMATIC_WARNING)
    await expect(page.getByTestId('black-hole-cinematic-confirm-cancel')).toBeFocused()
    await expect(page.getByTestId('black-hole-cinematic-confirm-reduce-flashes')).toBeChecked()

    await page.keyboard.press('Tab')
    await expect(page.getByTestId('black-hole-cinematic-confirm')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
      cinematicConfirmation.getByRole('button', {
        name: 'Cancel: Confirm Complete Consumption — Cinematic',
      }),
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(cinematicConfirmation).toBeHidden()
    await expect(panel.getByRole('heading', { name: 'Black-Hole Encounter' })).toBeFocused()

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('Physics Flyby has finite conservation diagnostics, open outcomes, deterministic replay, and pristine reset', async ({
    page,
  }) => {
    test.slow()
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseTen(page)
    await waitForSettledExposure(canvas)
    const original = await observatoryState(canvas)
    const originalExposure = Number(await requiredAttribute(canvas, 'data-exposure'))
    const app = page.getByTestId('solar-system-app')

    await page.getByTestId('visual-quality-select').selectOption('medium')
    await expect(app).toHaveAttribute('data-visual-quality', 'medium')
    await page.getByTestId('tour-toggle').click()
    await expect(app).toHaveAttribute('data-tour-state', 'running')
    await openBlackHoleEncounter(page)
    await startPhysicsFlyby(page, canvas)

    await expect(app).toHaveAttribute('data-active-scenario', 'black-hole-physics-flyby')
    await expect(app).toHaveAttribute('data-black-hole-mode', 'physics-flyby')
    await expect(app).toHaveAttribute('data-black-hole-state', /^(running|paused)$/)
    await expect(app).toHaveAttribute('data-black-hole-stage', /^(approach|closest-approach|aftermath|complete)$/)
    await expect(app).toHaveAttribute('data-tour-state', 'cancelled')
    await expect(page.getByTestId('black-hole-physics-active')).toBeVisible()
    await expect(page.getByTestId('black-hole-physics-active')).not.toContainText(
      CINEMATIC_WARNING,
    )
    await expect(page.getByTestId('black-hole-physics-active-equal-mass-note')).toContainText(
      /equal-mass misconception.*would not by gravity alone make the planets fall in/i,
    )
    await expect(page.getByTestId('black-hole-physics-outcome-note')).toContainText(
      /may leave survivors, eject bodies, or capture bodies.*No particular result.*promised/i,
    )
    await expect(page.getByTestId('black-hole-physics-hud')).toBeVisible()
    await expect(page.getByTestId('black-hole-physics-hud')).toContainText(
      /Physics Flyby.*Educational approximation.*outcomes.*not guaranteed/i,
    )

    await expect(page.getByTestId('scenario-drawer-toggle')).toBeDisabled()
    await expect(page.getByTestId('solar-fate-drawer-toggle')).toBeDisabled()
    await expect(page.getByTestId('tour-toggle')).toBeDisabled()
    await expect(page.getByTestId('black-hole-encounter-close')).toBeDisabled()
    await expect(page.getByTestId('black-hole-cinematic-start')).toHaveCount(0)
    await expect(canvas).toHaveAttribute('data-black-hole-mode', 'physics-flyby')
    await expect(canvas).toHaveAttribute('data-black-hole-active', 'true')
    await expect(canvas).toHaveAttribute('data-black-hole-lifecycle', /^(running|paused)$/)
    await expect(canvas).toHaveAttribute('data-black-hole-stage', /.+/)
    const mediumHdrSupported =
      (await requiredAttribute(canvas, 'data-hdr-render-target')) === 'true'
    await expect(canvas).toHaveAttribute(
      'data-black-hole-lensing-path',
      mediumHdrSupported ? 'simplified' : 'off',
    )
    await expect(canvas).toHaveAttribute('data-black-hole-finite', 'true')
    await expect(canvas).toHaveAttribute('data-black-hole-accretion-disk-visible', 'true')
    await expect(canvas).toHaveAttribute('data-black-hole-suppressed-bodies', '5')
    await expect(canvas).toHaveAttribute('data-black-hole-ephemeris-paths-hidden', 'true')
    await expect(canvas).toHaveAttribute('data-black-hole-statistical-belts-hidden', 'true')

    await pauseBlackHoleScenario(page, 'black-hole-physics')
    await page.waitForTimeout(200)
    const pausedSubsteps = await requiredAttribute(
      page.getByTestId('black-hole-completed-substeps'),
      'data-value',
    )
    await page.waitForTimeout(350)
    await expect(page.getByTestId('black-hole-completed-substeps'))
      .toHaveAttribute('data-value', pausedSubsteps)
    const signature = await requiredAttribute(canvas, 'data-black-hole-run-signature')
    expect(signature.length).toBeGreaterThan(8)
    await assertFiniteCanvasDiagnostics(canvas, BLACK_HOLE_NUMERIC_DIAGNOSTICS)
    await assertFiniteCanvasDiagnostics(canvas, [
      'data-exposure',
      'data-target-exposure',
      'data-camera-near',
      'data-camera-far',
    ])
    await assertFiniteUiDiagnostics(page, PHYSICS_UI_DIAGNOSTICS)
    await expect(page.getByTestId('black-hole-physics-diagnostics'))
      .toHaveAttribute('data-finite', 'true')

    await page.getByTestId('black-hole-physics-step').click()
    await expect(app).toHaveAttribute('data-black-hole-state', 'paused')
    await expect(canvas).toHaveAttribute('data-black-hole-run-signature', signature)
    await assertFiniteUiDiagnostics(page, PHYSICS_UI_DIAGNOSTICS)

    await advanceBlackHoleToComplete(page, app, 'black-hole-physics')
    await expect(app).toHaveAttribute('data-black-hole-state', 'complete')
    const survivors = await readOutputNumber(page.getByTestId('black-hole-physics-survivors'))
    const ejected = await readOutputNumber(page.getByTestId('black-hole-physics-ejected'))
    const captured = await readOutputNumber(page.getByTestId('black-hole-physics-captured'))
    expect(survivors).toBeGreaterThan(0)
    expect(ejected).toBeGreaterThanOrEqual(0)
    expect(captured).toBeGreaterThanOrEqual(0)
    expect(survivors + ejected + captured).toBe(10)
    await expect(page.getByTestId('black-hole-physics-outcome-note')).toBeVisible()
    await expect(canvas).toHaveAttribute('data-black-hole-finite', 'true')
    await assertFiniteCanvasDiagnostics(canvas, BLACK_HOLE_NUMERIC_DIAGNOSTICS)
    await assertFiniteUiDiagnostics(page, PHYSICS_UI_DIAGNOSTICS)

    await page.getByTestId('black-hole-physics-replay').click()
    await expect(app).toHaveAttribute('data-black-hole-state', 'running')
    await expect(canvas).toHaveAttribute('data-black-hole-run-signature', signature)
    await pauseBlackHoleScenario(page, 'black-hole-physics')

    await page.getByTestId('black-hole-physics-reset').evaluate((element) => {
      const button = element as HTMLButtonElement
      button.click()
      button.click()
    })
    await expectBlackHoleReset(page, canvas)
    await expect.poll(() => observatoryState(canvas)).toEqual(original)
    await expect.poll(async () => Math.abs(
      Number(await requiredAttribute(canvas, 'data-exposure')) - originalExposure,
    )).toBeLessThanOrEqual(0.04)
    await expect(page.getByTestId('simulation-time-controls')).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(page.getByTestId('black-hole-physics-option')).toBeVisible()
    await expect(page.getByTestId('black-hole-cinematic-option')).toBeVisible()

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('Complete Consumption keeps its warning, captures every body, replays deterministically, and resets every override', async ({
    page,
  }) => {
    test.slow()
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseTen(page)
    await waitForSettledExposure(canvas)
    const original = await observatoryState(canvas)
    const originalExposure = Number(await requiredAttribute(canvas, 'data-exposure'))
    const app = page.getByTestId('solar-system-app')

    await page.getByTestId('visual-quality-select').selectOption('high')
    await expect(app).toHaveAttribute('data-visual-quality', 'high')
    await openBlackHoleEncounter(page)
    await startCompleteConsumption(page, canvas)

    await expect(app).toHaveAttribute('data-active-scenario', 'black-hole-complete-consumption')
    await expect(app).toHaveAttribute(
      'data-black-hole-mode',
      'complete-consumption-cinematic',
    )
    await expect(page.getByTestId('black-hole-cinematic-active-warning')).toHaveText(
      CINEMATIC_WARNING,
    )
    await expect(page.getByTestId('black-hole-cinematic-artistic-caveat')).toContainText(
      /angular-momentum damping.*order.*timing.*artistic.*compressed/i,
    )
    await expect(page.getByTestId('black-hole-cinematic-active-reduce-flashes'))
      .toBeChecked()
    const hud = page.getByTestId('black-hole-cinematic-hud')
    await expect(hud).toBeVisible()
    await expect(hud).toContainText(CINEMATIC_WARNING)
    await expect(hud).toContainText(/timing and damping are artistic/i)

    await expect(page.getByTestId('scenario-drawer-toggle')).toBeDisabled()
    await expect(page.getByTestId('solar-fate-drawer-toggle')).toBeDisabled()
    await expect(page.getByTestId('tour-toggle')).toBeDisabled()
    await expect(page.getByTestId('black-hole-encounter-close')).toBeDisabled()
    await expect(page.getByTestId('black-hole-physics-start')).toHaveCount(0)
    await expect(canvas).toHaveAttribute(
      'data-black-hole-mode',
      'complete-consumption-cinematic',
    )
    await expect(canvas).toHaveAttribute('data-black-hole-active', 'true')
    await expect(canvas).toHaveAttribute('data-black-hole-finite', 'true')
    await expect(canvas).toHaveAttribute('data-black-hole-accretion-disk-visible', 'true')
    const hdrSupported = (await requiredAttribute(canvas, 'data-hdr-render-target')) === 'true'
    await expect(canvas).toHaveAttribute(
      'data-black-hole-lensing-path',
      hdrSupported ? 'schwarzschild' : 'off',
    )

    await pauseBlackHoleScenario(page, 'black-hole-cinematic')
    const signature = await requiredAttribute(canvas, 'data-black-hole-run-signature')
    expect(signature.length).toBeGreaterThan(8)
    await assertFiniteCanvasDiagnostics(canvas, BLACK_HOLE_NUMERIC_DIAGNOSTICS)

    for (let transition = 0; transition < 9; transition += 1) {
      await expect(page.getByTestId('black-hole-cinematic-active-warning')).toHaveText(
        CINEMATIC_WARNING,
      )
      await expect(page.getByTestId('black-hole-cinematic-hud')).toContainText(
        CINEMATIC_WARNING,
      )
      await expect(canvas).toHaveAttribute('data-black-hole-finite', 'true')
      await assertFiniteCanvasDiagnostics(canvas, BLACK_HOLE_NUMERIC_DIAGNOSTICS)
      if ((await app.getAttribute('data-black-hole-state')) === 'complete') break
      await advanceBlackHoleStage(page, app, 'black-hole-cinematic')
    }

    await expect(app).toHaveAttribute('data-black-hole-state', 'complete')
    await expect(page.getByTestId('black-hole-cinematic-active-warning')).toHaveText(
      CINEMATIC_WARNING,
    )
    await expect(page.getByTestId('black-hole-all-bodies-captured')).toContainText(
      /Every staged body is captured.*complete/i,
    )
    await expect(page.getByTestId('black-hole-cinematic-captured')).toHaveAttribute(
      'data-value',
      '10',
    )
    const bodyStates = page.locator('[data-testid^="black-hole-body-state-"]')
    await expect(bodyStates).toHaveCount(10)
    for (let bodyIndex = 0; bodyIndex < 10; bodyIndex += 1) {
      const bodyState = bodyStates.nth(bodyIndex)
      await expect(bodyState).toHaveAttribute('data-outcome', 'captured')
      await expect(bodyState).toHaveAttribute('data-capture-progress', '1.000000')
    }
    await expect(canvas).toHaveAttribute('data-black-hole-captured-bodies', '10')
    await expect(canvas).toHaveAttribute('data-black-hole-base-body-overrides', '10')
    await expect(canvas).toHaveAttribute('data-black-hole-suppressed-bodies', '5')
    await expect(canvas).toHaveAttribute('data-black-hole-finite', 'true')

    await page.getByTestId('black-hole-cinematic-replay').click()
    await expect(app).toHaveAttribute('data-black-hole-state', 'running')
    await expect(canvas).toHaveAttribute('data-black-hole-run-signature', signature)
    await expect(page.getByTestId('black-hole-cinematic-active-warning')).toHaveText(
      CINEMATIC_WARNING,
    )
    await pauseBlackHoleScenario(page, 'black-hole-cinematic')

    await page.getByTestId('black-hole-cinematic-reset').evaluate((element) => {
      const button = element as HTMLButtonElement
      button.click()
      button.click()
    })
    await expectBlackHoleReset(page, canvas)
    await expect.poll(() => observatoryState(canvas)).toEqual(original)
    await expect.poll(async () => Math.abs(
      Number(await requiredAttribute(canvas, 'data-exposure')) - originalExposure,
    )).toBeLessThanOrEqual(0.04)

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('panel, confirmations, active status, and persistent HUD remain usable at 320px', async ({
    page,
  }) => {
    test.slow()
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseTen(page)
    await openBlackHoleEncounter(page)
    await page.getByTestId('black-hole-cinematic-start').click()

    const panel = page.getByTestId('black-hole-encounter-panel')
    const confirmation = page.getByTestId('black-hole-cinematic-confirmation')
    for (const width of [1280, 960, 820, 680, 430, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(panel).toBeVisible()
      await expect(confirmation).toBeVisible()
      await expect(page.getByTestId('black-hole-cinematic-confirmation-warning')).toBeVisible()
      expect(await horizontalOverflow(page), `confirmation overflow at ${width}px`)
        .toBeLessThanOrEqual(1)
      const dialogBox = await confirmation.boundingBox()
      expect(dialogBox).not.toBeNull()
      expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
      expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(width + 1)
      await page.getByTestId('black-hole-cinematic-confirm').scrollIntoViewIfNeeded()
      await expect(page.getByTestId('black-hole-cinematic-confirm')).toBeVisible()
    }

    await page.getByTestId('black-hole-cinematic-confirm').click()
    await expect(canvas).toHaveAttribute('data-black-hole-active', 'true')
    await pauseBlackHoleScenario(page, 'black-hole-cinematic')
    const hud = page.getByTestId('black-hole-cinematic-hud')
    for (const width of [1280, 960, 820, 680, 430, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(panel).toBeVisible()
      await expect(hud).toBeVisible()
      await expect(page.getByTestId('black-hole-cinematic-active-warning')).toHaveText(
        CINEMATIC_WARNING,
      )
      await expect(hud).toContainText(CINEMATIC_WARNING)
      expect(await horizontalOverflow(page), `active panel/HUD overflow at ${width}px`)
        .toBeLessThanOrEqual(1)
      const hudBox = await hud.boundingBox()
      expect(hudBox).not.toBeNull()
      expect(hudBox!.x).toBeGreaterThanOrEqual(0)
      expect(hudBox!.x + hudBox!.width).toBeLessThanOrEqual(width + 1)
      await page.getByTestId('black-hole-cinematic-reset').scrollIntoViewIfNeeded()
      await expect(page.getByTestId('black-hole-cinematic-reset')).toBeVisible()
    }

    await page.getByTestId('black-hole-cinematic-reset').click()
    await expectBlackHoleReset(page, canvas)
    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })
})

async function bootPhaseTen(page: Page): Promise<Locator> {
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
  await expect(page.getByTestId('black-hole-encounter-drawer-toggle')).toBeEnabled()
  await expect(app).toHaveAttribute('data-active-scenario', '')
  await expect(app).toHaveAttribute('data-black-hole-mode', 'idle')
  await expect(app).toHaveAttribute('data-black-hole-state', 'idle')
  await expect(app).toHaveAttribute('data-black-hole-stage', 'idle')
  const canvas = page.locator('canvas[data-testid="solar-system-canvas"]')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-camera-mode', /.+/)
  await expect(canvas).toHaveAttribute('data-black-hole-mode', 'none')
  await expect(canvas).toHaveAttribute('data-black-hole-active', 'false')
  await expect(canvas).toHaveAttribute('data-black-hole-lifecycle', 'idle')
  await expect(canvas).toHaveAttribute('data-black-hole-stage', 'idle')
  await expect(canvas).toHaveAttribute('data-black-hole-finite', 'true')
  return canvas
}

async function openBlackHoleEncounter(page: Page): Promise<void> {
  const panel = page.getByTestId('black-hole-encounter-panel')
  if (await panel.isVisible().catch(() => false)) return
  const toggle = page.getByTestId('black-hole-encounter-drawer-toggle')
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(panel).toBeVisible()
}

async function startPhysicsFlyby(page: Page, canvas: Locator): Promise<void> {
  await expect(page.getByTestId('black-hole-physics-start')).toBeEnabled()
  await page.getByTestId('black-hole-physics-start').click()
  const confirmation = page.getByTestId('black-hole-physics-confirmation')
  await expect(confirmation).toBeVisible()
  await page.getByTestId('black-hole-physics-confirm').click()
  await expect(canvas).toHaveAttribute('data-black-hole-mode', 'physics-flyby')
  await expect(canvas).toHaveAttribute('data-black-hole-active', 'true')
  await expectBlackHoleCameraCentered(page)
}

async function startCompleteConsumption(page: Page, canvas: Locator): Promise<void> {
  await page.getByTestId('black-hole-cinematic-start').click()
  const confirmation = page.getByTestId('black-hole-cinematic-confirmation')
  await expect(confirmation).toBeVisible()
  await expect(page.getByTestId('black-hole-cinematic-confirm-reduce-flashes')).toBeChecked()
  await page.getByTestId('black-hole-cinematic-confirm').click()
  await expect(canvas).toHaveAttribute(
    'data-black-hole-mode',
    'complete-consumption-cinematic',
  )
  await expect(canvas).toHaveAttribute('data-black-hole-active', 'true')
  await expectBlackHoleCameraCentered(page)
}

async function pauseBlackHoleScenario(
  page: Page,
  prefix: 'black-hole-physics' | 'black-hole-cinematic',
): Promise<void> {
  const app = page.getByTestId('solar-system-app')
  if ((await app.getAttribute('data-black-hole-state')) !== 'paused') {
    const pause = page.getByTestId(`${prefix}-pause`)
    await expect(pause).toBeVisible()
    await pause.click()
  }
  await expect(app).toHaveAttribute('data-black-hole-state', 'paused')
  await expect(page.getByTestId(`${prefix}-step`)).toBeVisible()
}

async function advanceBlackHoleStage(
  page: Page,
  app: Locator,
  prefix: 'black-hole-physics' | 'black-hole-cinematic',
): Promise<void> {
  const before = {
    stage: await requiredAttribute(app, 'data-black-hole-stage'),
    state: await requiredAttribute(app, 'data-black-hole-state'),
  }
  await page.getByTestId(`${prefix}-skip`).click()
  await expect.poll(async () => ({
    stage: await app.getAttribute('data-black-hole-stage'),
    state: await app.getAttribute('data-black-hole-state'),
  })).not.toEqual(before)
  await expectBlackHoleCameraCentered(page)
}

async function advanceBlackHoleToComplete(
  page: Page,
  app: Locator,
  prefix: 'black-hole-physics' | 'black-hole-cinematic',
): Promise<void> {
  for (let transition = 0; transition < 9; transition += 1) {
    if ((await app.getAttribute('data-black-hole-state')) === 'complete') return
    await advanceBlackHoleStage(page, app, prefix)
  }
  throw new Error(`${prefix} did not complete after nine deterministic advances`)
}

async function expectBlackHoleReset(page: Page, canvas: Locator): Promise<void> {
  const app = page.getByTestId('solar-system-app')
  await expect(app).toHaveAttribute('data-active-scenario', '')
  await expect(app).toHaveAttribute('data-black-hole-mode', 'idle')
  await expect(app).toHaveAttribute('data-black-hole-state', 'idle')
  await expect(app).toHaveAttribute('data-black-hole-stage', 'idle')
  await expect(page.getByTestId('black-hole-physics-hud')).toBeHidden()
  await expect(page.getByTestId('black-hole-cinematic-hud')).toBeHidden()
  await expect(canvas).toHaveAttribute('data-black-hole-mode', 'none')
  await expect(canvas).toHaveAttribute('data-black-hole-active', 'false')
  await expect(canvas).toHaveAttribute('data-black-hole-lifecycle', 'idle')
  await expect(canvas).toHaveAttribute('data-black-hole-stage', 'idle')
  await expect(canvas).toHaveAttribute('data-black-hole-run-signature', '')
  await expect(canvas).toHaveAttribute('data-black-hole-camera-framing', 'false')
  await expect(canvas).toHaveAttribute(
    'data-black-hole-camera-target-error',
    '0.000000e+0',
  )
  await expect(canvas).toHaveAttribute('data-black-hole-lensing-path', 'off')
  await expect(canvas).toHaveAttribute('data-black-hole-accretion-disk-visible', 'false')
  await expect(canvas).toHaveAttribute('data-black-hole-suppressed-bodies', '0')
  await expect(canvas).toHaveAttribute('data-black-hole-ephemeris-paths-hidden', 'false')
  await expect(canvas).toHaveAttribute('data-black-hole-statistical-belts-hidden', 'false')
  await expect(canvas).toHaveAttribute('data-black-hole-finite', 'true')
  await assertZeroCanvasDiagnostics(canvas, BLACK_HOLE_NUMERIC_DIAGNOSTICS)
}

async function expectBlackHoleCameraCentered(page: Page): Promise<void> {
  const canvas = page.getByTestId('solar-system-canvas')
  await expect(canvas).toHaveAttribute('data-black-hole-camera-framing', 'true')
  await expect.poll(async () => Number(
    await requiredAttribute(canvas, 'data-black-hole-camera-target-error'),
  ), { timeout: 8_000 }).toBeLessThanOrEqual(1e-6)
}

async function waitForSettledExposure(canvas: Locator): Promise<void> {
  await expect.poll(async () => {
    const exposure = Number(await requiredAttribute(canvas, 'data-exposure'))
    const target = Number(await requiredAttribute(canvas, 'data-target-exposure'))
    return Math.abs(exposure - target)
  }).toBeLessThanOrEqual(0.01)
}

async function assertFiniteUiDiagnostics(
  page: Page,
  testIds: readonly string[],
): Promise<void> {
  for (const testId of testIds) {
    const output = page.getByTestId(testId)
    await expect(output).toBeVisible()
    const raw = await output.getAttribute('data-value')
    expect(raw, `${testId} must expose data-value`).not.toBeNull()
    expect(raw, `${testId} must not contain NaN`).not.toMatch(/NaN/i)
    expect(raw, `${testId} must not contain Infinity`).not.toMatch(/Infinity/i)
    expect(Number.isFinite(Number(raw)), `${testId} must be finite; received ${raw}`).toBe(true)
  }
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

async function readOutputNumber(output: Locator): Promise<number> {
  await expect(output).toBeVisible()
  const raw = await output.getAttribute('data-value')
  const value = Number(raw)
  expect(raw).toBeTruthy()
  expect(Number.isFinite(value)).toBe(true)
  return value
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
