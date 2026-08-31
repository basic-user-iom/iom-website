import { expect, test, type Locator, type Page } from '@playwright/test'

const PREFERENCE_KEY = 'iom.solar-system.preferences'

interface ResourceSnapshot {
  readonly geometries: number
  readonly textures: number
  readonly programs: number
}

test.describe.serial('Phase 11 production hardening', () => {
  test('profiles all quality tiers with meaningful geometry, particle, and post-process differences', async ({
    page,
  }, testInfo) => {
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseEleven(page)
    const app = page.getByTestId('solar-system-app')
    const qualitySelect = page.getByTestId('visual-quality-select')
    const report: Array<Record<string, string | number>> = []

    for (const quality of ['low', 'medium', 'high', 'ultra'] as const) {
      await qualitySelect.selectOption(quality)
      await expect(app).toHaveAttribute('data-visual-quality', quality)
      await expect(canvas).toHaveAttribute('data-visual-quality', quality)
      await expect.poll(async () => numericAttribute(canvas, 'data-performance-samples'))
        .toBeGreaterThanOrEqual(5)

      report.push({
        quality,
        surfaceVertices: await numericAttribute(canvas, 'data-surface-vertex-count'),
        asteroidInstances: await numericAttribute(canvas, 'data-asteroid-belt-instances'),
        kuiperInstances: await numericAttribute(canvas, 'data-kuiper-belt-instances'),
        maximumTierDpr: await numericAttribute(canvas, 'data-maximum-tier-pixel-ratio'),
        effectiveDpr: await numericAttribute(canvas, 'data-effective-pixel-ratio'),
        medianFrameMs: await numericAttribute(canvas, 'data-performance-median-frame-ms'),
        p95FrameMs: await numericAttribute(canvas, 'data-performance-p95-frame-ms'),
        drawCalls: await numericAttribute(canvas, 'data-draw-calls'),
        triangles: await numericAttribute(canvas, 'data-rendered-triangles'),
        geometries: await numericAttribute(canvas, 'data-gpu-geometries'),
        textures: await numericAttribute(canvas, 'data-gpu-textures'),
        programs: await numericAttribute(canvas, 'data-gpu-programs'),
      })
    }

    expect(strictlyIncreasing(report.map((entry) => Number(entry.surfaceVertices)))).toBe(true)
    expect(strictlyIncreasing(report.map((entry) => Number(entry.asteroidInstances)))).toBe(true)
    expect(report.map((entry) => entry.maximumTierDpr)).toEqual([1, 1, 1.5, 2])
    await testInfo.attach('phase11-quality-profile.json', {
      body: JSON.stringify({
        note: 'Frame intervals are smoke-run telemetry, not a hardware benchmark guarantee.',
        tiers: report,
      }, null, 2),
      contentType: 'application/json',
    })

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('degrades a sustained heavy effect, freezes it on context loss, and restores cleanly', async ({
    page,
  }) => {
    test.slow()
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseEleven(page)
    await page.getByTestId('visual-quality-select').selectOption('ultra')
    await openPanel(page, 'solar-fate-panel', 'solar-fate-drawer-toggle')
    await page.getByTestId('solar-evolution-start').click()
    await expect(canvas).toHaveAttribute('data-heavy-render-effect', 'solar-evolution')
    await expect(canvas).toHaveAttribute('data-adaptive-resolution-state', /monitoring|degraded/)

    await createSustainedFramePressure(page)
    await expect.poll(async () => numericAttribute(canvas, 'data-resolution-scale'))
      .toBeLessThan(1)
    const minimumScale = await numericAttribute(canvas, 'data-minimum-resolution-scale')
    expect(await numericAttribute(canvas, 'data-resolution-scale')).toBeGreaterThanOrEqual(
      minimumScale,
    )

    const progress = page.getByLabel('Scientific Solar Evolution progress')
    await expect(progress).toBeVisible()
    await expect.poll(() => progress.getAttribute('value')).not.toBe('0')
    await canvas.dispatchEvent('webglcontextlost')
    await expect(page.getByText('GPU lost', { exact: true })).toBeVisible()
    const lostProgress = await progress.getAttribute('value')
    await page.waitForTimeout(450)
    expect(await progress.getAttribute('value')).toBe(lostProgress)

    await canvas.dispatchEvent('webglcontextrestored')
    await expect(page.getByText('GPU ready', { exact: true })).toBeVisible()
    await expect.poll(() => progress.getAttribute('value')).not.toBe(lostProgress)
    await page.getByTestId('solar-evolution-reset').click()
    await expect(canvas).toHaveAttribute('data-heavy-render-effect', 'none')
    await expect(canvas).toHaveAttribute('data-resolution-scale', '1.00')
    await expect(canvas).toHaveAttribute('data-adaptive-resolution-state', 'inactive')

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('keeps WebGL resource counts bounded across repeated resets of every scenario family', async ({
    page,
  }, testInfo) => {
    test.slow()
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootPhaseEleven(page)
    await page.getByTestId('visual-quality-select').selectOption('high')
    const snapshots: ResourceSnapshot[] = []

    for (let pass = 0; pass < 3; pass += 1) {
      await runAndResetImpact(page, canvas)
      await runAndResetSolarEvolution(page, canvas)
      await runAndResetFictionalSupernova(page, canvas)
      await runAndResetBlackHolePhysics(page, canvas)
      await page.waitForTimeout(300)
      snapshots.push(await resourceSnapshot(canvas))
      await expect(canvas).toHaveAttribute('data-heavy-render-effect', 'none')
      await expect(canvas).toHaveAttribute('data-resolution-scale', '1.00')
    }

    const warm = snapshots[0]
    expect(warm).toBeDefined()
    for (const snapshot of snapshots.slice(1)) {
      expect(snapshot.geometries).toBeLessThanOrEqual((warm?.geometries ?? 0) + 2)
      expect(snapshot.textures).toBeLessThanOrEqual((warm?.textures ?? 0) + 2)
      expect(snapshot.programs).toBeLessThanOrEqual((warm?.programs ?? 0) + 3)
    }
    await testInfo.attach('phase11-resource-reset-profile.json', {
      body: JSON.stringify({
        cyclesPerScenarioFamily: 3,
        snapshots,
        allowedOneTimeCacheGrowth: { geometries: 2, textures: 2, programs: 3 },
      }, null, 2),
      contentType: 'application/json',
    })

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })
})

async function bootPhaseEleven(page: Page): Promise<Locator> {
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
  await expect(canvas).toHaveAttribute('data-adaptive-resolution-state', /.+/)
  await expect(canvas).toHaveAttribute('data-gpu-geometries', /\d+/)
  return canvas
}

async function openPanel(page: Page, panelTestId: string, toggleTestId: string): Promise<void> {
  const panel = page.getByTestId(panelTestId)
  if (await panel.isVisible().catch(() => false)) return
  await page.getByTestId(toggleTestId).first().click()
  await expect(panel).toBeVisible()
}

async function runAndResetImpact(page: Page, canvas: Locator): Promise<void> {
  await openPanel(page, 'impact-lab-panel', 'scenario-drawer-toggle')
  await expect(page.getByTestId('impact-run')).toBeEnabled()
  await page.getByTestId('impact-run').click()
  await expect(page.getByTestId('impact-confirmation')).toBeVisible()
  await page.getByTestId('impact-confirm').click()
  await expect(canvas).toHaveAttribute('data-impact-active', 'true')
  await page.getByTestId('impact-reset').click()
  await expect(canvas).toHaveAttribute('data-impact-active', 'false')
}

async function runAndResetSolarEvolution(page: Page, canvas: Locator): Promise<void> {
  await openPanel(page, 'solar-fate-panel', 'solar-fate-drawer-toggle')
  await page.getByTestId('solar-evolution-start').click()
  await expect(canvas).toHaveAttribute('data-solar-evolution-active', 'true')
  await page.getByTestId('solar-evolution-reset').click()
  await expect(canvas).toHaveAttribute('data-solar-evolution-active', 'false')
}

async function runAndResetFictionalSupernova(page: Page, canvas: Locator): Promise<void> {
  await openPanel(page, 'solar-fate-panel', 'solar-fate-drawer-toggle')
  await page.getByTestId('fictional-supernova-start').click()
  await expect(page.getByTestId('fictional-supernova-confirmation')).toBeVisible()
  await page.getByTestId('fictional-supernova-confirm').click()
  await expect(canvas).toHaveAttribute('data-fictional-supernova-active', 'true')
  await page.getByTestId('fictional-supernova-reset').click()
  await expect(canvas).toHaveAttribute('data-fictional-supernova-active', 'false')
}

async function runAndResetBlackHolePhysics(page: Page, canvas: Locator): Promise<void> {
  await openPanel(page, 'black-hole-encounter-panel', 'black-hole-encounter-drawer-toggle')
  await page.getByTestId('black-hole-physics-start').click()
  await expect(page.getByTestId('black-hole-physics-confirmation')).toBeVisible()
  await page.getByTestId('black-hole-physics-confirm').click()
  await expect(canvas).toHaveAttribute('data-black-hole-active', 'true')
  await page.getByTestId('black-hole-physics-reset').click()
  await expect(canvas).toHaveAttribute('data-black-hole-active', 'false')
}

async function createSustainedFramePressure(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const nextFrame = () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
    for (let frame = 0; frame < 36; frame += 1) {
      const start = performance.now()
      while (performance.now() - start < 42) {
        // Intentionally occupy this test frame to exercise the real governor.
      }
      await nextFrame()
    }
  })
}

async function resourceSnapshot(canvas: Locator): Promise<ResourceSnapshot> {
  return {
    geometries: await numericAttribute(canvas, 'data-gpu-geometries'),
    textures: await numericAttribute(canvas, 'data-gpu-textures'),
    programs: await numericAttribute(canvas, 'data-gpu-programs'),
  }
}

async function numericAttribute(locator: Locator, name: string): Promise<number> {
  const raw = await locator.getAttribute(name)
  const value = Number(raw)
  expect(raw, `${name} should be present`).not.toBeNull()
  expect(Number.isFinite(value), `${name} should be finite`).toBe(true)
  return value
}

function strictlyIncreasing(values: readonly number[]): boolean {
  return values.every((value, index) => index === 0 || value > (values[index - 1] ?? value))
}

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    const value = message.text()
    if (
      message.type() === 'error' ||
      /THREE\.WebGLProgram|Shader Error|VALIDATE_STATUS|GL_INVALID_OPERATION/i.test(value)
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
