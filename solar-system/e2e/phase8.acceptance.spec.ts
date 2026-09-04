import { expect, test, type Locator, type Page } from '@playwright/test'

const PREFERENCE_KEY = 'iom.solar-system.preferences'

test.describe.serial('Phase 8 Impact Lab', () => {
  test('reports coherent physical values and requires an accessible flash confirmation', async ({
    page,
  }) => {
    const browserErrors = captureBrowserErrors(page)
    await bootPhaseEight(page)
    await openImpactLab(page)
    await configureReferenceImpact(page)

    const radiusM = 50
    const expectedMassKg = (4 / 3) * Math.PI * radiusM ** 3 * 3_000
    const expectedEnergyJ = 0.5 * expectedMassKg * 20_000 ** 2
    const expectedTntMegatons = expectedEnergyJ / 4.184e15

    const massKg = await readOutputNumber(page.getByTestId('impact-mass'))
    const energyJ = await readOutputNumber(page.getByTestId('impact-energy'))
    const tntMegatons = await readOutputNumber(page.getByTestId('impact-tnt'))
    expect(massKg / expectedMassKg).toBeCloseTo(1, 10)
    expect(energyJ / expectedEnergyJ).toBeCloseTo(1, 10)
    expect(tntMegatons / expectedTntMegatons).toBeCloseTo(1, 10)

    const panel = page.getByTestId('impact-lab-panel')
    await expect(page.getByTestId('impact-educational-badge')).toContainText(
      /educational approximation/i,
    )
    await expect(page.getByTestId('impact-visual-caveat')).toContainText(
      /educational approximations.*exaggerated for visibility/i,
    )
    await expect(panel).toContainText(/not a research-grade impact forecast/i)

    const runButton = page.getByTestId('impact-run')
    await runButton.click()
    const confirmation = page.getByTestId('impact-confirmation')
    await expect(confirmation).toBeVisible()
    await expect(confirmation).toContainText(
      /photosensitivity warning.*impact flash.*exposure changes/i,
    )
    await expect(page.getByTestId('impact-confirm-cancel')).toBeFocused()
    await expect(
      confirmation.getByLabel('Reduce flashes and abrupt exposure changes'),
    ).toBeChecked()

    await page.keyboard.press('Escape')
    await expect(confirmation).toBeHidden()
    await expect(panel.getByRole('heading', { name: 'Earth Impact Lab' })).toBeFocused()
    await expect(page.getByTestId('impact-educational-badge')).toBeVisible()

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('shows a preview-only impact setup and switches cleanly into playback', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseEight(page)
    await openImpactLab(page)

    await expect(canvas).toHaveAttribute('data-impact-presentation-mode', 'preview')
    await expect(canvas).toHaveAttribute('data-impact-stage', 'preview')
    await expect(canvas).toHaveAttribute('data-impact-active', 'true')
    await expect(canvas).toHaveAttribute('data-impact-target-body', 'earth')
    await expect(canvas).toHaveAttribute('data-impact-preview-reticle-visible', 'true')
    await expect.poll(async () => (
      Number(await requiredAttribute(canvas, 'data-impact-preview-trajectory-points'))
    )).toBeGreaterThan(1)
    await expect(page.getByTestId('impact-size-exaggeration-badge')).toHaveCount(0)

    for (const attribute of [
      'data-impact-impactor-visible',
      'data-impact-bow-shock-visible',
      'data-impact-plasma-visible',
      'data-impact-entry-trail-visible',
      'data-impact-flash-visible',
      'data-impact-crater-visible',
      'data-impact-shockwave-visible',
      'data-impact-haze-visible',
    ] as const) {
      await expect(canvas).toHaveAttribute(attribute, 'false')
    }
    for (const attribute of [
      'data-impact-trail-points',
      'data-impact-fragments',
      'data-impact-ejecta-points',
      'data-impact-plume-points',
    ] as const) {
      await expect(canvas).toHaveAttribute(attribute, '0')
    }
    await expect(canvas).toHaveAttribute('data-impact-velocity-alignment', '0.000000')
    await expect(canvas).toHaveAttribute('data-impact-normalized-heating', '0.000000')
    await expect(canvas).toHaveAttribute('data-impact-impactor-size-exaggerated', 'false')
    await expect(canvas).toHaveAttribute('data-impact-entry-effect-profile', 'none')
    await expect(canvas).toHaveAttribute('data-impact-entry-effect-intensity', '0.000000')

    await page.getByTestId('impact-target-body').selectOption('moon')
    await expect(canvas).toHaveAttribute('data-impact-target-body', 'moon')
    await expect(canvas).toHaveAttribute('data-selected-body', 'moon')
    await expect(canvas).toHaveAttribute('data-impact-presentation-mode', 'preview')
    await expect(canvas).toHaveAttribute('data-impact-preview-reticle-visible', 'true')
    await expect.poll(async () => (
      Number(await requiredAttribute(canvas, 'data-impact-preview-trajectory-points'))
    )).toBeGreaterThan(1)

    await page.getByTestId('impact-lab-close').click()
    await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'idle')
    await expect(canvas).toHaveAttribute('data-impact-stage', 'idle')
    await expect(canvas).toHaveAttribute('data-impact-active', 'false')
    await expect(canvas).toHaveAttribute('data-impact-target-body', '')
    await expect(canvas).toHaveAttribute('data-impact-preview-reticle-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-preview-trajectory-points', '0')
    await expect(canvas).toHaveAttribute('data-selected-body', 'earth')

    await openImpactLab(page)
    await page.getByTestId('impact-target-body').selectOption('moon')
    await expect(canvas).toHaveAttribute('data-impact-target-body', 'moon')
    await expect(canvas).toHaveAttribute('data-impact-presentation-mode', 'preview')

    await page.getByTestId('impact-run').click()
    await expect(page.getByTestId('impact-confirmation')).toBeVisible()
    await page.getByTestId('impact-confirm').click()
    await expect(canvas).toHaveAttribute('data-impact-presentation-mode', 'playback')
    await expect(page.getByTestId('impact-size-exaggeration-badge')).toBeVisible()
    await expect(canvas).toHaveAttribute('data-impact-impactor-size-exaggerated', 'true')
    await expect(canvas).toHaveAttribute('data-impact-preview-reticle-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-preview-trajectory-points', '0')

    await page.getByTestId('impact-reset').click()
    await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'idle')
    await expect(canvas).toHaveAttribute('data-impact-stage', 'idle')
    await expect(canvas).toHaveAttribute('data-impact-active', 'false')
    await expect(canvas).toHaveAttribute('data-impact-target-body', '')
    await expect(canvas).toHaveAttribute('data-impact-preview-reticle-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-preview-trajectory-points', '0')

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('supports fixed stepping and deterministic replay while changed parameters produce a new run', async ({
    page,
  }) => {
    test.slow()
    test.setTimeout(180_000)
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseEight(page)
    await openImpactLab(page)
    await configureReferenceImpact(page)
    const firstCraterRadiusM = await readOutputNumber(
      page.getByTestId('impact-crater-radius'),
    )

    await confirmAndPauseImpact(page, canvas)
    const firstSignature = await requiredAttribute(canvas, 'data-impact-run-signature')
    expect(firstSignature).toMatch(/^impact-v2-[0-9a-f]{8}$/)
    await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'paused')

    const status = page.getByTestId('impact-event-status')
    const statusBeforeStep = await status.textContent()
    await page.getByTestId('impact-step').click()
    await expect.poll(() => status.textContent()).not.toBe(statusBeforeStep)
    await expect(canvas).toHaveAttribute('data-impact-run-signature', firstSignature)
    const earthPeakEntryIntensity = await stepThroughAtmosphericEntry(
      page,
      canvas,
      'dense',
    )
    expect(await activeEffectCount(canvas)).toBeGreaterThan(0)

    await page.getByTestId('impact-replay').click()
    await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'running')
    await pauseImpact(page, canvas)
    await expect(canvas).toHaveAttribute('data-impact-run-signature', firstSignature)

    await page.getByTestId('impact-reset').click()
    await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'idle')
    await openImpactLab(page)
    await configureReferenceImpact(page, { diameterM: 200 })
    const secondCraterRadiusM = await readOutputNumber(
      page.getByTestId('impact-crater-radius'),
    )
    expect(secondCraterRadiusM).toBeGreaterThan(firstCraterRadiusM)
    await expect(page.getByTestId('impact-crater-radius')).toBeVisible()

    const massKg = await readOutputNumber(page.getByTestId('impact-mass'))
    const referenceMassKg = (4 / 3) * Math.PI * 50 ** 3 * 3_000
    expect(massKg / referenceMassKg).toBeCloseTo(8, 8)

    await confirmAndPauseImpact(page, canvas)
    const secondSignature = await requiredAttribute(canvas, 'data-impact-run-signature')
    expect(secondSignature).not.toBe(firstSignature)
    await expect(canvas).toHaveAttribute('data-impact-active', 'true')
    expect(Number(await requiredAttribute(canvas, 'data-impact-fragments'))).toBeGreaterThanOrEqual(0)

    await page.getByTestId('impact-reset').click()
    await openImpactLab(page)
    await configureReferenceImpact(page)
    await page.getByTestId('impact-target-body').selectOption('mars')
    await expect(page.getByTestId('impact-atmosphere')).toBeEnabled()
    await page.getByTestId('impact-atmosphere').check()
    await confirmAndPauseImpact(page, canvas)
    const marsPeakEntryIntensity = await stepThroughAtmosphericEntry(
      page,
      canvas,
      'thin',
    )
    expect(marsPeakEntryIntensity).toBeLessThan(earthPeakEntryIntensity)
    await stepUntilSolidAftermath(page, canvas, 'solid-atmospheric', 'dusty-crater')
    await expect(page.getByTestId('impact-aftermath-badge'))
      .toHaveAttribute('data-aftermath-kind', 'dusty-crater')

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('runs selected Moon and Jupiter targets and never renders a crater on Jupiter', async ({
    page,
  }) => {
    test.slow()
    test.setTimeout(150_000)
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseEight(page)
    await openImpactLab(page)
    await configureReferenceImpact(page)

    const panel = page.getByTestId('impact-lab-panel')
    const target = page.getByTestId('impact-target-body')
    const azimuth = page.getByTestId('impact-azimuth')
    const atmosphere = page.getByTestId('impact-atmosphere')

    await target.selectOption('moon')
    await expect(target).toHaveValue('moon')
    await expect(panel.getByRole('heading', { name: 'Moon Impact Lab' })).toBeVisible()
    await setNumericInput(azimuth, 135)
    await setNumericInput(page.getByTestId('impact-speed'), 72)
    await setNumericInput(page.getByTestId('impact-angle'), 90)
    await expect(atmosphere).toBeDisabled()
    await expect(atmosphere).not.toBeChecked()

    await confirmAndPauseImpact(page, canvas)
    await expect(canvas).toHaveAttribute('data-selected-body', 'moon')
    await expect(canvas).toHaveAttribute('data-impact-target-body', 'moon')
    await expect(canvas).toHaveAttribute('data-impact-active', 'true')
    await assertAirlessEntryEffectsAbsent(canvas)
    await stepUntilSolidAftermath(page, canvas, 'solid-airless', 'crater')
    await expect(page.getByTestId('impact-aftermath-badge'))
      .toHaveAttribute('data-aftermath-kind', 'crater')

    await page.getByTestId('impact-reset').click()
    await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'idle')
    await expect(canvas).toHaveAttribute('data-impact-target-body', '')
    await expect(canvas).toHaveAttribute('data-selected-body', 'earth')
    await assertSurfaceDiagnosticsNeutral(canvas)

    await openImpactLab(page)
    await target.selectOption('jupiter')
    await expect(target).toHaveValue('jupiter')
    await expect(panel.getByRole('heading', { name: 'Jupiter Impact Lab' })).toBeVisible()
    await setNumericInput(azimuth, 270)
    await setNumericInput(page.getByTestId('impact-speed'), 72)
    await setNumericInput(page.getByTestId('impact-angle'), 90)
    await expect(atmosphere).toBeEnabled()
    await atmosphere.check()

    const craterRadius = page.getByTestId('impact-crater-radius')
    await expect(craterRadius).toHaveAttribute('data-value', '0')
    await expect(craterRadius).toContainText(/not applicable for Jupiter/i)

    await confirmAndPauseImpact(page, canvas)
    await expect(canvas).toHaveAttribute('data-selected-body', 'jupiter')
    await expect(canvas).toHaveAttribute('data-impact-target-body', 'jupiter')
    await stepThroughAtmosphericEntry(page, canvas, 'giant', true)
    await stepUntilGiantAftermath(page, canvas)
    await expect(page.getByTestId('impact-aftermath-badge'))
      .toHaveAttribute('data-aftermath-kind', 'cloud-scar')

    await page.getByTestId('impact-reset').click()
    await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'idle')
    await expect(canvas).toHaveAttribute('data-impact-target-body', '')
    await expect(canvas).toHaveAttribute('data-selected-body', 'earth')
    await assertSurfaceDiagnosticsNeutral(canvas)

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('event cameras work and an idempotent reset restores camera, exposure, time, and pristine Earth', async ({
    page,
  }) => {
    test.slow()
    test.setTimeout(150_000)
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseEight(page)
    await expect.poll(async () => {
      const exposure = Number(await requiredAttribute(canvas, 'data-exposure'))
      const target = Number(await requiredAttribute(canvas, 'data-target-exposure'))
      return Math.abs(exposure - target)
    }).toBeLessThanOrEqual(0.01)
    const original = await observatoryState(canvas)
    const originalExposure = Number(await requiredAttribute(canvas, 'data-exposure'))
    expect(original['data-selected-body']).toBe('earth')

    await openImpactLab(page)
    await configureReferenceImpact(page)
    await expect(page.getByTestId('impact-visibility-mode')).toHaveValue('enhanced')
    await expect(page.getByTestId('impact-visibility-badge')).toContainText(
      /enhanced event visibility/i,
    )
    await confirmAndPauseImpact(page, canvas)
    await expect(page.getByTestId('solar-system-app')).toHaveAttribute(
      'data-reduce-flashes',
      'true',
    )

    const cameraPositions = new Set<string>()
    for (const preset of ['orbital', 'horizon', 'chase', 'ground-observer'] as const) {
      const previousPosition = await requiredAttribute(canvas, 'data-camera-position')
      await page.getByTestId('impact-camera-preset').selectOption(preset)
      await expect(canvas).toHaveAttribute('data-impact-camera-preset', preset)
      if (preset !== 'orbital') {
        await expect
          .poll(() => canvas.getAttribute('data-camera-position'))
          .not.toBe(previousPosition)
      }
      cameraPositions.add(await requiredAttribute(canvas, 'data-camera-position'))
    }
    expect(cameraPositions.size).toBeGreaterThanOrEqual(3)

    await stepUntilSolidAftermath(page, canvas, 'solid-atmospheric', 'crater')
    await expect(canvas).toHaveAttribute('data-impact-crater-visible', 'true')
    await expect(canvas).toHaveAttribute('data-impact-visibility-mode', 'enhanced')
    expect(Number(await requiredAttribute(canvas, 'data-impact-visibility-multiplier')))
      .toBeGreaterThan(1)
    await expect(page.locator('.canvas-legend')).toHaveCount(0)
    await page.getByTestId('impact-visibility-mode').selectOption('physical')
    await expect(canvas).toHaveAttribute('data-impact-visibility-mode', 'physical')
    await expect(canvas).toHaveAttribute('data-impact-visibility-multiplier', '1.000')
    await page.getByTestId('impact-visibility-mode').selectOption('enhanced')
    expect(await activeEffectCount(canvas)).toBeGreaterThan(0)
    expect(
      Number(await requiredAttribute(canvas, 'data-impact-flash-intensity')),
    ).toBeLessThanOrEqual(0.72)

    // Two synchronous clicks exercise the reset's idempotence before React
    // removes the active-event controls from the document.
    await page.getByTestId('impact-reset').evaluate((element) => {
      const button = element as HTMLButtonElement
      button.click()
      button.click()
    })

    await expect(canvas).toHaveAttribute('data-impact-active', 'false')
    await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'idle')
    await expect(canvas).toHaveAttribute('data-impact-stage', 'idle')
    await expect(canvas).toHaveAttribute('data-impact-run-signature', '')
    await expect(canvas).toHaveAttribute('data-impact-camera-preset', '')
    await expect(canvas).toHaveAttribute('data-impact-visibility-mode', 'enhanced')
    await expect(canvas).toHaveAttribute('data-impact-trail-points', '0')
    await expect(canvas).toHaveAttribute('data-impact-fragments', '0')
    await expect(canvas).toHaveAttribute('data-impact-ejecta-points', '0')
    await expect(canvas).toHaveAttribute('data-impact-plume-points', '0')
    await expect(canvas).toHaveAttribute('data-impact-flash-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-crater-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-shockwave-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-haze-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-flash-intensity', '0.000')
    await expect(canvas).toHaveAttribute('data-impact-bow-shock-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-plasma-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-entry-trail-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-velocity-alignment', '0.000000')
    await expect(canvas).toHaveAttribute('data-impact-normalized-heating', '0.000000')
    await expect(canvas).toHaveAttribute('data-impact-impactor-size-exaggerated', 'false')
    await expect(canvas).toHaveAttribute('data-impact-entry-effect-profile', 'none')
    await expect(canvas).toHaveAttribute('data-impact-entry-effect-intensity', '0.000000')
    await assertSurfaceDiagnosticsNeutral(canvas)

    await expect.poll(() => observatoryState(canvas)).toEqual(original)
    await expect.poll(async () => Math.abs(
      Number(await requiredAttribute(canvas, 'data-exposure')) - originalExposure,
    )).toBeLessThanOrEqual(0.04)
    await expect(page.getByTestId('simulation-time-controls')).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(
      page.getByTestId('simulation-time-controls').getByLabel('Target body'),
    ).toBeEnabled()

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('the panel, confirmation, and active actions remain reachable at compact viewports', async ({
    page,
  }) => {
    const browserErrors = captureBrowserErrors(page)
    await bootPhaseEight(page)
    await openImpactLab(page)
    await configureReferenceImpact(page)
    await page.getByTestId('impact-run').click()

    const panel = page.getByTestId('impact-lab-panel')
    const confirmation = page.getByTestId('impact-confirmation')
    const viewports = [
      { width: 1280, height: 900 },
      { width: 986, height: 900 },
      { width: 960, height: 900 },
      { width: 921, height: 900 },
      { width: 620, height: 700 },
      { width: 390, height: 667 },
      { width: 320, height: 568 },
    ] as const
    for (const { width, height } of viewports) {
      await page.setViewportSize({ width, height })
      await expect(panel).toBeVisible()
      await expect(confirmation).toBeVisible()
      expect(await horizontalOverflow(page), `horizontal overflow at ${width}x${height}`)
        .toBeLessThanOrEqual(1)
      const dialogBox = await confirmation.boundingBox()
      expect(dialogBox).not.toBeNull()
      expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
      expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(width + 1)
      if (height < 900) {
        await expectActionReachable(page.getByTestId('impact-confirm-cancel'), height)
        await expectActionReachable(page.getByTestId('impact-confirm'), height)
      }
    }

    await page.getByTestId('impact-confirm').click()
    await expect(confirmation).toBeHidden()
    await expect(panel).toBeVisible()
    await expect(page.getByTestId('impact-reset')).toBeVisible()
    for (const { width, height } of viewports.slice(-3)) {
      await page.setViewportSize({ width, height })
      await expectActionReachable(page.getByTestId('impact-reset'), height)
      expect(await horizontalOverflow(page), `active horizontal overflow at ${width}x${height}`)
        .toBeLessThanOrEqual(1)
    }
    await page.getByTestId('impact-reset').click()
    await expect(page.getByTestId('impact-run')).toBeVisible()
    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })
})

interface ReferenceImpactOverrides {
  readonly diameterM?: number
  readonly densityKgM3?: number
  readonly entrySpeedKmps?: number
  readonly entryAngleDeg?: number
  readonly seed?: number
}

async function bootPhaseEight(page: Page): Promise<Locator> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await page.evaluate((key) => localStorage.removeItem(key), PREFERENCE_KEY)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('solar-system-app')).toBeVisible()
  await expect(page.getByTestId('ephemeris-provider-badge')).toHaveText(
    /JPL Horizons .* generated offline bundles/i,
    { timeout: 30_000 },
  )
  const canvas = page.locator('canvas[data-testid="solar-system-canvas"]')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-camera-mode', /.+/)
  await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'idle')
  return canvas
}

async function openImpactLab(page: Page): Promise<void> {
  const panel = page.getByTestId('impact-lab-panel')
  if (await panel.isVisible().catch(() => false)) return
  const toggle = page.getByTestId('scenario-drawer-toggle').first()
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(panel).toBeVisible()
}

async function configureReferenceImpact(
  page: Page,
  overrides: Readonly<ReferenceImpactOverrides> = {},
): Promise<void> {
  await setNumericInput(page.getByTestId('impact-diameter'), overrides.diameterM ?? 100)
  await page.getByTestId('impact-material').selectOption('stone')
  await setNumericInput(page.getByTestId('impact-density'), overrides.densityKgM3 ?? 3_000)
  await setNumericInput(page.getByTestId('impact-speed'), overrides.entrySpeedKmps ?? 20)
  await setNumericInput(page.getByTestId('impact-angle'), overrides.entryAngleDeg ?? 45)
  await setNumericInput(page.getByTestId('impact-latitude'), 12.5)
  await setNumericInput(page.getByTestId('impact-longitude'), -31.25)
  await setNumericInput(page.getByTestId('impact-seed'), overrides.seed ?? 42)
  await page.getByTestId('impact-fragmentation').check()
  await page.getByTestId('impact-atmosphere').check()
  await page.getByTestId('impact-camera-preset').selectOption('orbital')
  await expect(page.getByTestId('impact-run')).toBeEnabled()
}

async function confirmAndPauseImpact(page: Page, canvas: Locator): Promise<void> {
  await page.getByTestId('impact-run').click()
  await expect(page.getByTestId('impact-confirmation')).toBeVisible()
  await page.getByTestId('impact-confirm').click()
  await expect(canvas).toHaveAttribute('data-impact-active', 'true')
  await expect(canvas).toHaveAttribute('data-impact-lifecycle', /^(running|paused)$/)
  await pauseImpact(page, canvas)
}

async function pauseImpact(page: Page, canvas: Locator): Promise<void> {
  if ((await canvas.getAttribute('data-impact-lifecycle')) !== 'paused') {
    const pause = page.getByTestId('impact-pause')
    await expect(pause).toBeVisible()
    await pause.click()
  }
  await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'paused')
  await expect(page.getByTestId('impact-step')).toBeVisible()
}

async function stepThroughAtmosphericEntry(
  page: Page,
  canvas: Locator,
  expectedProfile: 'thin' | 'dense' | 'giant',
  stopAtFirstAlignedEffect = false,
): Promise<number> {
  const step = page.getByTestId('impact-step')
  const postEntryStage = /^(airburst|impact|impact-flash|ejecta|plume|haze|aftermath|complete)$/
  let peakIntensity = 0
  let sawAlignedEntryEffects = false
  for (let halfSecond = 0; halfSecond < 60; halfSecond += 1) {
    const stage = await requiredAttribute(canvas, 'data-impact-stage')
    await expect(canvas).toHaveAttribute('data-impact-entry-effect-profile', expectedProfile)
    const intensity = Number(
      await requiredAttribute(canvas, 'data-impact-entry-effect-intensity'),
    )
    expect(Number.isFinite(intensity)).toBe(true)
    peakIntensity = Math.max(peakIntensity, intensity)

    const bowShockVisible =
      await requiredAttribute(canvas, 'data-impact-bow-shock-visible') === 'true'
    const plasmaVisible =
      await requiredAttribute(canvas, 'data-impact-plasma-visible') === 'true'
    const entryTrailVisible =
      await requiredAttribute(canvas, 'data-impact-entry-trail-visible') === 'true'
    if (bowShockVisible && plasmaVisible && entryTrailVisible) {
      expect(stage).toMatch(/^(entry|atmospheric-entry|fragmentation)$/)
      expect(
        Number(await requiredAttribute(canvas, 'data-impact-velocity-alignment')),
      ).toBeGreaterThan(0.98)
      expect(
        Number(await requiredAttribute(canvas, 'data-impact-normalized-heating')),
      ).toBeGreaterThan(0)
      await expect(canvas).toHaveAttribute('data-impact-impactor-size-exaggerated', 'true')
      sawAlignedEntryEffects = true
      if (stopAtFirstAlignedEffect) return Math.max(peakIntensity, intensity)
    }

    if (postEntryStage.test(stage)) {
      expect(sawAlignedEntryEffects).toBe(true)
      expect(peakIntensity).toBeGreaterThan(0)
      return peakIntensity
    }
    await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'paused')
    await expect(canvas).toHaveAttribute('data-impact-crater-visible', 'false')
    await step.evaluate((element) => {
      const button = element as HTMLButtonElement
      for (let frame = 0; frame < 60; frame += 1) button.click()
    })
    await expect.poll(() => canvas.getAttribute('data-impact-stage')).not.toBe('idle')
  }
  throw new Error(
    `Impact did not show aligned ${expectedProfile} atmospheric-entry effects before its terminal event.`,
  )
}

async function stepUntilSolidAftermath(
  page: Page,
  canvas: Locator,
  expectedProfile: 'solid-airless' | 'solid-atmospheric',
  expectedAftermath: 'crater' | 'dusty-crater',
): Promise<void> {
  const step = page.getByTestId('impact-step')
  let sawAttachedFlash = false
  let sawEjecta = false
  let sawGroundWave = false
  let sawAtmosphericWave = false
  let sawPlume = false
  for (let halfSecond = 0; halfSecond < 40; halfSecond += 1) {
    await expect(canvas).toHaveAttribute('data-impact-outcome-kind', 'solid-surface-impact')
    await expect(canvas).toHaveAttribute('data-impact-surface-effect-profile', expectedProfile)
    await expect(canvas).toHaveAttribute('data-impact-solid-surface-effects-suppressed', 'false')
    await expect(canvas).toHaveAttribute('data-impact-cloud-scar-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-cloud-ripple-visible', 'false')
    if (expectedProfile === 'solid-airless') {
      await assertAirlessEntryEffectsAbsent(canvas)
      await expect(canvas).toHaveAttribute('data-impact-atmospheric-shockwave-visible', 'false')
    }

    if (await booleanAttribute(canvas, 'data-impact-flash-visible')) {
      await assertAttachedSurfaceFlash(canvas)
      sawAttachedFlash = true
    }
    if (Number(await requiredAttribute(canvas, 'data-impact-ejecta-active-count')) > 0) {
      sawEjecta = true
    }
    if (await booleanAttribute(canvas, 'data-impact-ground-shockwave-visible')) {
      expect(
        Number(await requiredAttribute(canvas, 'data-impact-ground-shockwave-angular-radius')),
      ).toBeGreaterThan(0)
      await expect(canvas).toHaveAttribute('data-impact-shockwave-surface-conforming', 'true')
      sawGroundWave = true
    }
    if (await booleanAttribute(canvas, 'data-impact-atmospheric-shockwave-visible')) {
      expect(
        Number(await requiredAttribute(canvas, 'data-impact-atmospheric-shockwave-angular-radius')),
      ).toBeGreaterThan(0)
      sawAtmosphericWave = true
    }
    if (await booleanAttribute(canvas, 'data-impact-plume-visible')) {
      expect(Number(await requiredAttribute(canvas, 'data-impact-plume-layer-count')))
        .toBeGreaterThan(0)
      sawPlume = true
    }

    if (await booleanAttribute(canvas, 'data-impact-crater-visible')) {
      expect(Number(await requiredAttribute(canvas, 'data-impact-crater-attachment-error-m')))
        .toBeLessThan(0.05)
      expect(Number(await requiredAttribute(canvas, 'data-impact-crater-angular-radius')))
        .toBeGreaterThan(0)
      expect(Number(await requiredAttribute(canvas, 'data-impact-crater-formation-progress')))
        .toBeGreaterThan(0)
      await expect(canvas).toHaveAttribute('data-impact-crater-persistent', 'true')
      await expect(canvas).toHaveAttribute('data-impact-aftermath-kind', expectedAftermath)
      await expect(canvas).toHaveAttribute('data-impact-aftermath-persistent', 'true')
      expect(Number(await requiredAttribute(canvas, 'data-impact-active-object-count')))
        .toBeGreaterThan(0)
      if (
        sawAttachedFlash &&
        sawEjecta &&
        sawGroundWave &&
        sawPlume &&
        (expectedProfile === 'solid-airless' || sawAtmosphericWave)
      ) return
    }

    await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'paused')
    await step.evaluate((element) => {
      const button = element as HTMLButtonElement
      for (let frame = 0; frame < 60; frame += 1) button.click()
    })
    await expect.poll(() => canvas.getAttribute('data-impact-stage')).not.toBe('idle')
  }
  throw new Error(`Solid impact did not produce the ${expectedAftermath} aftermath in 20 seconds.`)
}

async function stepUntilGiantAftermath(page: Page, canvas: Locator): Promise<void> {
  const step = page.getByTestId('impact-step')
  let sawAttachedFlash = false
  let sawAtmosphericWave = false
  let sawCloudRipple = false
  let sawPlume = false
  for (let halfSecond = 0; halfSecond < 50; halfSecond += 1) {
    await expect(canvas).toHaveAttribute('data-impact-outcome-kind', 'deep-atmosphere-breakup')
    await expect(canvas).toHaveAttribute('data-impact-surface-effect-profile', 'giant-atmospheric')
    await expect(canvas).toHaveAttribute('data-impact-solid-surface-effects-suppressed', 'true')
    await expect(canvas).toHaveAttribute('data-impact-crater-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-crater-persistent', 'false')
    await expect(canvas).toHaveAttribute('data-impact-ground-shockwave-visible', 'false')
    await expect(canvas).toHaveAttribute('data-impact-ejecta-active-count', '0')
    await expect(canvas).toHaveAttribute('data-impact-ejecta-points', '0')

    if (await booleanAttribute(canvas, 'data-impact-flash-visible')) {
      await assertAttachedSurfaceFlash(canvas)
      sawAttachedFlash = true
    }
    if (await booleanAttribute(canvas, 'data-impact-atmospheric-shockwave-visible')) {
      expect(
        Number(await requiredAttribute(canvas, 'data-impact-atmospheric-shockwave-angular-radius')),
      ).toBeGreaterThan(0)
      sawAtmosphericWave = true
    }
    if (await booleanAttribute(canvas, 'data-impact-cloud-ripple-visible')) {
      sawCloudRipple = true
    }
    if (await booleanAttribute(canvas, 'data-impact-plume-visible')) {
      sawPlume = true
    }

    if (await booleanAttribute(canvas, 'data-impact-cloud-scar-visible')) {
      expect(Number(await requiredAttribute(canvas, 'data-impact-cloud-scar-angular-radius')))
        .toBeGreaterThan(0)
      expect(Number(await requiredAttribute(canvas, 'data-impact-cloud-scar-opacity')))
        .toBeGreaterThan(0)
      await expect(canvas).toHaveAttribute('data-impact-aftermath-kind', 'cloud-scar')
      await expect(canvas).toHaveAttribute('data-impact-aftermath-persistent', 'true')
      if (sawAttachedFlash && sawAtmosphericWave && sawCloudRipple && sawPlume) {
        const advectionBefore = Number(
          await requiredAttribute(canvas, 'data-impact-cloud-scar-advection'),
        )
        await step.evaluate((element) => {
          const button = element as HTMLButtonElement
          for (let frame = 0; frame < 60; frame += 1) button.click()
        })
        await expect(canvas).toHaveAttribute('data-impact-cloud-scar-visible', 'true')
        expect(Number(await requiredAttribute(canvas, 'data-impact-cloud-scar-advection')))
          .not.toBe(advectionBefore)
        return
      }
    }

    await expect(canvas).toHaveAttribute('data-impact-lifecycle', 'paused')
    await step.evaluate((element) => {
      const button = element as HTMLButtonElement
      for (let frame = 0; frame < 60; frame += 1) button.click()
    })
    await expect.poll(() => canvas.getAttribute('data-impact-stage')).not.toBe('idle')
  }
  throw new Error('Jupiter did not produce an attached flash, ripple, plume, and cloud scar.')
}

async function assertAttachedSurfaceFlash(canvas: Locator): Promise<void> {
  expect(Number(await requiredAttribute(canvas, 'data-impact-flash-attachment-error-m')))
    .toBeLessThan(0.05)
  expect(Number(await requiredAttribute(canvas, 'data-impact-flash-normal-alignment')))
    .toBeGreaterThan(0.999999)
  expect(Number(await requiredAttribute(canvas, 'data-impact-flash-cap-angular-radius')))
    .toBeGreaterThan(0)
  await expect(canvas).toHaveAttribute('data-impact-flash-light-visible', 'true')
  await expect(canvas).toHaveAttribute('data-impact-flash-hdr-clamped', 'true')
}

async function assertSurfaceDiagnosticsNeutral(canvas: Locator): Promise<void> {
  await expect(canvas).toHaveAttribute('data-impact-outcome-kind', '')
  await expect(canvas).toHaveAttribute('data-impact-surface-effect-profile', 'none')
  await expect(canvas).toHaveAttribute('data-impact-aftermath-kind', 'none')
  for (const attribute of [
    'data-impact-flash-light-visible',
    'data-impact-flash-hdr-clamped',
    'data-impact-crater-persistent',
    'data-impact-ground-shockwave-visible',
    'data-impact-atmospheric-shockwave-visible',
    'data-impact-shockwave-surface-conforming',
    'data-impact-plume-visible',
    'data-impact-cloud-scar-visible',
    'data-impact-cloud-ripple-visible',
    'data-impact-solid-surface-effects-suppressed',
    'data-impact-aftermath-persistent',
  ] as const) {
    await expect(canvas).toHaveAttribute(attribute, 'false')
  }
  for (const attribute of [
    'data-impact-flash-attachment-error-m',
    'data-impact-crater-attachment-error-m',
    'data-impact-crater-formation-progress',
    'data-impact-plume-cooling-progress',
    'data-impact-cloud-scar-opacity',
  ] as const) {
    await expect(canvas).toHaveAttribute(attribute, '0.000000')
  }
  for (const attribute of [
    'data-impact-flash-normal-alignment',
    'data-impact-flash-cap-angular-radius',
    'data-impact-crater-angular-radius',
    'data-impact-ground-shockwave-angular-radius',
    'data-impact-atmospheric-shockwave-angular-radius',
    'data-impact-cloud-scar-angular-radius',
    'data-impact-cloud-scar-advection',
  ] as const) {
    await expect(canvas).toHaveAttribute(attribute, '0.000000000')
  }
  for (const attribute of [
    'data-impact-ejecta-active-count',
    'data-impact-ejecta-recontact-count',
    'data-impact-plume-layer-count',
    'data-impact-active-object-count',
  ] as const) {
    await expect(canvas).toHaveAttribute(attribute, '0')
  }
}

async function booleanAttribute(locator: Locator, name: string): Promise<boolean> {
  return await requiredAttribute(locator, name) === 'true'
}

async function assertAirlessEntryEffectsAbsent(canvas: Locator): Promise<void> {
  await expect(canvas).toHaveAttribute('data-impact-entry-effect-profile', 'none')
  await expect(canvas).toHaveAttribute('data-impact-entry-effect-intensity', '0.000000')
  await expect(canvas).toHaveAttribute('data-impact-bow-shock-visible', 'false')
  await expect(canvas).toHaveAttribute('data-impact-plasma-visible', 'false')
  await expect(canvas).toHaveAttribute('data-impact-entry-trail-visible', 'false')
  await expect(canvas).toHaveAttribute('data-impact-normalized-heating', '0.000000')
}

async function setNumericInput(input: Locator, value: number): Promise<void> {
  await input.fill(String(value))
  await expect(input).toHaveValue(String(value))
}

async function readOutputNumber(output: Locator): Promise<number> {
  await expect(output).toBeVisible()
  const raw = await output.getAttribute('data-value')
  const value = Number(raw)
  expect(raw).toBeTruthy()
  expect(Number.isFinite(value)).toBe(true)
  return value
}

async function requiredAttribute(locator: Locator, name: string): Promise<string> {
  const value = await locator.getAttribute(name)
  if (value === null) throw new Error(`Expected ${name} on ${await locator.getAttribute('data-testid')}`)
  return value
}

async function activeEffectCount(canvas: Locator): Promise<number> {
  const numericAttributes = [
    'data-impact-trail-points',
    'data-impact-fragments',
    'data-impact-ejecta-points',
    'data-impact-plume-points',
  ] as const
  let count = 0
  for (const attribute of numericAttributes) {
    const value = Number(await requiredAttribute(canvas, attribute))
    expect(Number.isFinite(value)).toBe(true)
    count += value
  }
  for (const attribute of [
    'data-impact-flash-visible',
    'data-impact-crater-visible',
    'data-impact-shockwave-visible',
    'data-impact-haze-visible',
  ] as const) {
    if ((await requiredAttribute(canvas, attribute)) === 'true') count += 1
  }
  return count
}

async function observatoryState(canvas: Locator): Promise<Readonly<Record<string, string>>> {
  const attributes = [
    'data-selected-body',
    'data-camera-mode',
    'data-camera-target',
    'data-camera-position',
    'data-exposure-preset',
    'data-current-jd-tdb',
  ] as const
  const state: Record<string, string> = {}
  for (const attribute of attributes) state[attribute] = await requiredAttribute(canvas, attribute)
  return state
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
}

async function expectActionReachable(action: Locator, viewportHeight: number): Promise<void> {
  await action.scrollIntoViewIfNeeded()
  await expect(action).toBeVisible()
  const box = await action.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight + 1)
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
