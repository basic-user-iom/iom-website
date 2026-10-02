import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 358, height: 660 }, hasTouch: true })

test('planet menu fits the phone, focuses every target, and yields space to drawers', async ({ page }) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  const canvas = page.getByTestId('solar-system-canvas')
  await expect(canvas).toHaveAttribute('data-asset-state', 'ready', { timeout: 60_000 })
  await expect(page.getByTestId('startup-screen')).toBeHidden()
  const toggle = page.getByTestId('planets-menu-toggle')
  const menu = page.getByTestId('planets-menu-content')
  await toggle.tap()
  const bounds = (await menu.boundingBox())!
  expect(bounds.width).toBeGreaterThan(330)
  await expect(menu.getByRole('button')).toHaveCount(11)
  for (const button of await menu.getByRole('button').all()) {
    const box = (await button.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.y).toBeGreaterThanOrEqual(bounds.y)
    expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height)
  }
  expect((await canvas.boundingBox())!.height).toBeGreaterThan(150)
  await toggle.tap()
  for (const body of ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
    await toggle.tap()
    await page.getByTestId(`legend-body-${body}`).tap()
    await expect(menu).toBeHidden()
    await expect(canvas).toHaveAttribute('data-camera-target', body)
    await toggle.tap()
    await expect(page.getByTestId(`legend-body-${body}`)).toHaveAttribute('aria-pressed', 'true')
    await toggle.tap()
  }
  await toggle.tap()
  await page.getByTestId('legend-comets').tap()
  await expect(menu).toBeHidden()
  await expect(canvas).toHaveAttribute('data-camera-target', /halley/i)
  for (const drawer of ['objects', 'time', 'view', 'tools']) {
    await toggle.tap()
    await page.locator(`#toggle-${drawer}`).tap()
    await expect(menu).toBeHidden()
    expect((await canvas.boundingBox())!.height).toBeGreaterThan(50)
    // Opening the menu also closes the drawer without moving keyboard focus away.
    await toggle.tap()
    await expect(page.locator(`#toggle-${drawer}`)).toHaveAttribute('aria-expanded', 'false')
    await expect(menu).toBeVisible()
    await toggle.tap()
  }
  await toggle.focus()
  await page.keyboard.press('Enter')
  await page.getByTestId('legend-body-earth').focus()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(toggle).toBeFocused()
  await page.keyboard.press('Enter')
  await page.getByTestId('legend-body-earth').focus()
  await page.keyboard.press('Enter')
  await expect(canvas).toHaveAttribute('data-camera-target', 'earth')
  await expect(menu).toBeHidden()
  await page.getByTestId('viewport-fullscreen-toggle').tap()
  await toggle.tap()
  await page.getByTestId('legend-body-saturn').tap()
  await expect(canvas).toHaveAttribute('data-camera-target', 'saturn')
  await expect(menu).toBeHidden()
  await page.getByTestId('viewport-fullscreen-toggle').tap()
  for (const viewport of [{ width: 844, height: 390 }, { width: 568, height: 320 }]) {
    await page.setViewportSize(viewport)
    await toggle.tap()
    expect((await canvas.boundingBox())!.height).toBeGreaterThan(0)
    await page.getByTestId('legend-body-neptune').scrollIntoViewIfNeeded()
    await page.getByTestId('legend-body-neptune').tap()
    await expect(canvas).toHaveAttribute('data-camera-target', 'neptune')
    await expect(menu).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(errors).toEqual([])
})
