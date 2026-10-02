import { expect, test } from '@playwright/test'

// Regression for mobile users trapped after closing the scenario drawer.
test('can leave every running scenario with the drawer hidden, including full screen', async ({ page }) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await expect(page.getByTestId('startup-screen')).toBeHidden({ timeout: 60_000 })
  for (const scenario of [
    { toggle: 'scenario-drawer-toggle', start: 'impact-run', confirm: 'impact-confirm', prefix: 'impact' },
    { toggle: 'solar-fate-drawer-toggle', start: 'solar-evolution-start', prefix: 'solar-evolution' },
    { toggle: 'solar-fate-drawer-toggle', start: 'fictional-supernova-start', confirm: 'fictional-supernova-confirm', prefix: 'fictional-supernova' },
    { toggle: 'black-hole-encounter-drawer-toggle', start: 'black-hole-physics-start', confirm: 'black-hole-physics-confirm', prefix: 'black-hole-physics' },
    { toggle: 'black-hole-encounter-drawer-toggle', start: 'black-hole-cinematic-start', confirm: 'black-hole-cinematic-confirm', prefix: 'black-hole-cinematic' },
  ]) {
    await page.locator('#toggle-tools').click()
    await page.getByTestId(scenario.toggle).click()
    await page.getByTestId(scenario.start).click()
    if (scenario.confirm) await page.getByTestId(scenario.confirm).click()
    await page.getByTestId(`${scenario.prefix}-pause`).click()
    await page.getByTestId(`${scenario.prefix}-step`).click()
    await page.getByTestId(`${scenario.prefix}-resume`).click()
    await page.getByTestId(`${scenario.prefix}-replay`).click()
    await page.getByRole('button', { name: 'Close view', exact: true }).click()
    const fullscreen = scenario.prefix === 'fictional-supernova'
    if (fullscreen) await page.getByTestId('viewport-fullscreen-toggle').click()
    const exit = page.getByTestId('scenario-exit')
    await expect(exit).toBeEnabled()
    const bounds = await exit.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.width).toBeGreaterThanOrEqual(44)
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844)
    await exit.click()
    await expect(page.getByTestId('system-overview')).toBeEnabled()
    await expect(page.getByTestId('solar-system-app')).not.toHaveAttribute('data-active-scenario', /.+/)
    if (fullscreen) await page.getByTestId('viewport-fullscreen-toggle').click()
  }
  expect(errors).toEqual([])
})
