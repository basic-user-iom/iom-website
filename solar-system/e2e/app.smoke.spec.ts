import { expect, test, type Locator } from '@playwright/test'

test('boots the generated ephemeris observatory without browser errors', async ({ page }) => {
  const browserErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    browserErrors.push(`page: ${error.message}`)
  })

  await page.goto('./', { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('solar-system-app')).toBeVisible()
  await expect(page.locator('canvas[data-testid="solar-system-canvas"]')).toBeVisible()
  await expect(page.getByTestId('ephemeris-provider-badge')).toHaveText(
    /JPL Horizons .* generated offline bundle/i,
    { timeout: 15_000 },
  )
  await expect(page.getByText('Positions linear · 1 AU / unit', { exact: true })).toBeVisible()
  await expect(page.locator('.canvas-topbar')).not.toContainText(/Phase\s+\d+/i)
  await expect(page.getByRole('heading', { name: /Watch real sunlight/i })).toBeVisible()

  const timeControls = page.getByTestId('simulation-time-controls')
  await expect(timeControls).toBeVisible()
  await expect(
    timeControls.getByRole('button', { name: /pause|resume|play|run/i }).first(),
  ).toBeVisible()
  await expect(
    timeControls.locator('input[type="datetime-local"], input[type="text"]').first(),
  ).toBeVisible()

  await timeControls.getByLabel('Target body').selectOption('earth')
  await timeControls.getByRole('button', { name: 'Rebase Earth' }).click()
  await expect(page.getByText(/earth .* revision [1-9]\d*/i)).toBeVisible()

  await timeControls.getByRole('button', { name: 'Reverse' }).click()
  await timeControls.getByRole('button', { name: 'Run simulation' }).click()
  await expect(timeControls.getByText('reverse', { exact: true })).toBeVisible()
  await timeControls.getByRole('button', { name: 'Pause simulation' }).click()

  const canvas = page.locator('canvas[data-testid="solar-system-canvas"]')
  const beforeDateChange = await canvas.screenshot()
  const exactDate = timeControls.locator('input[type="datetime-local"]').first()
  await exactDate.fill('2026-08-28T12:34:56')
  await timeControls.getByRole('button', { name: 'Set UTC' }).click()
  await expect(exactDate).toHaveValue('2026-08-28T12:34:56')
  await page.waitForTimeout(100)
  const afterDateChange = await canvas.screenshot()
  expect(afterDateChange.equals(beforeDateChange), 'date change should move ephemeris bodies').toBe(
    false,
  )

  await setDateTimeValue(exactDate, '1990-01-01T00:00:00')
  await timeControls.getByRole('button', { name: 'Set UTC' }).click()
  await expect(page.getByText(/outside the generated 2000.*2100 range/i)).toBeVisible()
  await expect(page.getByTestId('ephemeris-provider-badge')).toHaveText(/out-of-range/i)

  await setDateTimeValue(exactDate, '2026-08-28T12:34:56')
  await timeControls.getByRole('button', { name: 'Set UTC' }).click()
  await expect(page.getByTestId('ephemeris-provider-badge')).toHaveText(
    /JPL Horizons .* generated offline bundle/i,
  )

  await page.waitForTimeout(250)
  expect(browserErrors, browserErrors.join('\n')).toEqual([])
})

async function setDateTimeValue(
  input: Locator,
  value: string,
): Promise<void> {
  await input.evaluate((element, nextValue) => {
    const dateTimeInput = element as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(dateTimeInput, nextValue)
    dateTimeInput.dispatchEvent(new Event('input', { bubbles: true }))
    dateTimeInput.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  const normalizedValue = value.endsWith(':00') ? value.slice(0, -3) : value
  await expect(input).toHaveValue(normalizedValue)
}
