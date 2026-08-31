import { expect, test, type Locator, type Page } from '@playwright/test'

const PREFERENCE_KEY = 'iom.solar-system.preferences'

test.describe.serial('interactive canvas legend', () => {
  test('focuses planets and the Moon by pointer or keyboard and reveals a named comet', async ({
    page,
  }) => {
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootLegend(page)
    const legend = page.getByTestId('canvas-legend')

    await expect(legend).toHaveAttribute('role', 'group')
    await expect(legend).toHaveAttribute('aria-label', 'Solar System locations and overlays')
    await expect(legend.getByRole('button')).toHaveCount(11)
    await expect(page.getByTestId('legend-tide-lunar')).toHaveCount(0)
    await expect(page.getByTestId('legend-tide-solar')).toHaveCount(0)

    const jupiter = page.getByTestId('legend-body-jupiter')
    await jupiter.click()
    await expect(jupiter).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('navigator-body-jupiter')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(canvas).toHaveAttribute('data-selected-body', 'jupiter')
    await expect(canvas).toHaveAttribute('data-camera-target', 'jupiter')
    await expect(canvas).toHaveAttribute('data-camera-mode', 'body-follow')
    await expect(canvas).toHaveAttribute('data-camera-interaction', 'handoff-to-free-orbit')

    const moon = page.getByTestId('legend-body-moon')
    await moon.focus()
    await expect(moon).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(canvas).toHaveAttribute('data-selected-body', 'moon')
    await expect(canvas).toHaveAttribute('data-camera-target', 'moon')

    const earth = page.getByTestId('legend-body-earth')
    await earth.focus()
    await page.keyboard.press('Space')
    await expect(canvas).toHaveAttribute('data-selected-body', 'earth')
    await expect(canvas).toHaveAttribute('data-camera-target', 'earth')

    const cometsToggle = page.getByTestId('comets-toggle')
    await cometsToggle.uncheck()
    await expect(cometsToggle).not.toBeChecked()
    const comets = page.getByTestId('legend-comets')
    await comets.click()
    await expect(cometsToggle).toBeChecked()
    await expect(comets).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas).toHaveAttribute('data-selected-body', '1p-halley')
    await expect(canvas).toHaveAttribute('data-camera-target', '1p-halley')
    await expect(canvas).toHaveAttribute('data-camera-mode', 'body-follow')

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('keeps legend padding transparent to canvas wheel interaction', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootLegend(page)
    await page.getByTestId('legend-body-jupiter').click()
    await expect(canvas).toHaveAttribute('data-camera-mode', 'body-follow')

    const point = await page.getByTestId('canvas-legend').evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + 4 }
    })
    const hitTestId = await page.evaluate(({ x, y }) => {
      const target = document.elementFromPoint(x, y) as HTMLElement | null
      return target?.closest<HTMLElement>('[data-testid]')?.dataset.testid ?? null
    }, point)
    expect(hitTestId).toBe('solar-system-canvas')

    const beforePosition = await canvas.getAttribute('data-camera-position')
    expect(beforePosition).toBeTruthy()
    await page.mouse.move(point.x, point.y)
    await page.mouse.wheel(0, -560)
    await expect(canvas).toHaveAttribute('data-camera-mode', 'free-orbit')
    await expect(canvas).toHaveAttribute('data-camera-interaction', 'free-orbit')
    await expect
      .poll(() => canvas.getAttribute('data-camera-position'))
      .not.toBe(beforePosition)

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('keeps all shortcuts in one responsive rail on desktop and mobile', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await bootLegend(page, '?experimentalTides=both')
    const legend = page.getByTestId('canvas-legend')
    await expect(legend.getByRole('button')).toHaveCount(13)

    const desktopMetrics = await legend.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const buttonTops = [...element.querySelectorAll('button')]
        .map((button) => button.getBoundingClientRect().top)
      return {
        height: rect.height,
        topSpread: Math.max(...buttonTops) - Math.min(...buttonTops),
      }
    })
    expect(desktopMetrics.height).toBeLessThanOrEqual(46)
    expect(desktopMetrics.topSpread).toBeLessThan(1)

    await page.setViewportSize({ width: 390, height: 700 })
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(390)
    const mobileMetrics = await legend.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        height: rect.height,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }
    })
    expect(mobileMetrics.left).toBeGreaterThanOrEqual(0)
    expect(mobileMetrics.right).toBeLessThanOrEqual(390)
    expect(mobileMetrics.height).toBeLessThanOrEqual(46)
    expect(mobileMetrics.scrollWidth).toBeGreaterThan(mobileMetrics.clientWidth)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)

    const lastShortcut = page.getByTestId('legend-tide-solar')
    await lastShortcut.evaluate((element) => {
      element.scrollIntoView({ block: 'nearest', inline: 'end' })
    })
    await expect(lastShortcut).toBeInViewport({ ratio: 0.8 })
    expect(await legend.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })

  test('toggles lunar and solar overlays, frames Earth and the Moon, and respects scenario lockout', async ({
    page,
  }) => {
    test.slow()
    const browserErrors = captureBrowserErrors(page)
    const canvas = await bootLegend(page, '?experimentalTides=both')
    const lunar = page.getByTestId('legend-tide-lunar')
    const solar = page.getByTestId('legend-tide-solar')

    await expect(lunar).toHaveAttribute('aria-pressed', 'true')
    await expect(solar).toHaveAttribute('aria-pressed', 'true')

    await lunar.click()
    await expect(lunar).toHaveAttribute('aria-pressed', 'false')
    await expect(solar).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas).toHaveAttribute('data-tide-debug-mode', 'solar')
    await expect(canvas).toHaveAttribute('data-tide-lunar-visible', 'false')
    await expect(canvas).toHaveAttribute('data-tide-solar-visible', 'true')
    await expect(canvas).toHaveAttribute('data-selected-body', 'earth')
    await expect(canvas).toHaveAttribute('data-camera-target', 'earth')
    await expect(canvas).toHaveAttribute('data-camera-mode', 'earth-moon-system')
    await expect(canvas).toHaveAttribute('data-earth-on-screen', 'true')
    await expect(canvas).toHaveAttribute('data-moon-on-screen', 'true')

    await lunar.click()
    await expect(canvas).toHaveAttribute('data-tide-debug-mode', 'both')
    await expect(lunar).toHaveAttribute('aria-pressed', 'true')
    await solar.click()
    await expect(canvas).toHaveAttribute('data-tide-debug-mode', 'lunar')
    await expect(lunar).toHaveAttribute('aria-pressed', 'true')
    await expect(solar).toHaveAttribute('aria-pressed', 'false')

    await openPanel(page, 'impact-lab-panel', 'scenario-drawer-toggle')
    await page.getByTestId('impact-run').click()
    await expect(page.getByTestId('impact-confirmation')).toBeVisible()
    await page.getByTestId('impact-confirm').click()
    await expect(canvas).toHaveAttribute('data-impact-active', 'true')
    await expect(page.getByTestId('legend-body-earth')).toBeDisabled()
    await expect(page.getByTestId('legend-comets')).toBeDisabled()
    await expect(lunar).toBeDisabled()
    await expect(solar).toBeDisabled()

    await page.getByTestId('impact-reset').click()
    await expect(canvas).toHaveAttribute('data-impact-active', 'false')
    await expect(page.getByTestId('legend-body-earth')).toBeEnabled()
    await expect(page.getByTestId('legend-comets')).toBeEnabled()
    await expect(lunar).toBeEnabled()
    await expect(solar).toBeEnabled()

    await settleBrowserErrors()
    expect(browserErrors, browserErrors.join('\n')).toEqual([])
  })
})

async function bootLegend(page: Page, query = ''): Promise<Locator> {
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
  await expect(canvas).toHaveAttribute('data-camera-position', /.+/)
  await expect(page.getByTestId('legend-body-earth')).toBeEnabled()
  return canvas
}

async function openPanel(page: Page, panelTestId: string, toggleTestId: string): Promise<void> {
  const panel = page.getByTestId(panelTestId)
  if (await panel.isVisible().catch(() => false)) return
  await page.getByTestId(toggleTestId).first().click()
  await expect(panel).toBeVisible()
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
