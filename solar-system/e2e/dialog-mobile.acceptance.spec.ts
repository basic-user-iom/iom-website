import { expect, test, type Page } from '@playwright/test'

const PREFERENCE_KEY = 'iom.solar-system.preferences'

test('keeps the fictional confirmation and both actions inside a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 399, height: 748 })
  await bootObservatory(page)
  await page.getByTestId('solar-fate-drawer-toggle').click()
  await expect(page.getByTestId('solar-fate-panel')).toBeVisible()
  await page.getByTestId('fictional-supernova-start').click()

  const backdrop = page.getByTestId('fictional-supernova-confirmation-backdrop')
  const dialog = page.getByTestId('fictional-supernova-confirmation')
  const cancel = page.getByTestId('fictional-supernova-confirm-cancel')
  const confirm = page.getByTestId('fictional-supernova-confirm')
  await expect(dialog).toBeVisible()
  await expect(cancel).toBeVisible()
  await expect(confirm).toBeVisible()

  const layout = await page.evaluate(() => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const box = (testId: string) => {
      const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
      if (element === null) throw new Error(`Missing ${testId}`)
      const bounds = element.getBoundingClientRect()
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      }
    }
    const confirmBox = box('fictional-supernova-confirm')
    const hit = document.elementFromPoint(
      confirmBox.left + confirmBox.width / 2,
      confirmBox.top + confirmBox.height / 2,
    ) as HTMLElement | null
    return {
      viewportWidth,
      viewportHeight,
      backdrop: box('fictional-supernova-confirmation-backdrop'),
      dialog: box('fictional-supernova-confirmation'),
      cancel: box('fictional-supernova-confirm-cancel'),
      confirm: confirmBox,
      confirmHitTestId: hit?.closest<HTMLElement>('[data-testid]')?.dataset.testid ?? null,
      backdropParent: document.querySelector(
        '[data-testid="fictional-supernova-confirmation-backdrop"]',
      )?.parentElement?.tagName,
    }
  })

  expect(layout.backdropParent).toBe('BODY')
  expect(layout.backdrop.left).toBeCloseTo(0, 1)
  expect(layout.backdrop.top).toBeCloseTo(0, 1)
  expect(layout.backdrop.right).toBeCloseTo(layout.viewportWidth, 1)
  expect(layout.backdrop.bottom).toBeCloseTo(layout.viewportHeight, 1)
  expect(layout.dialog.left).toBeGreaterThanOrEqual(0)
  expect(layout.dialog.top).toBeGreaterThanOrEqual(0)
  expect(layout.dialog.right).toBeLessThanOrEqual(layout.viewportWidth)
  expect(layout.dialog.bottom).toBeLessThanOrEqual(layout.viewportHeight)
  for (const action of [layout.cancel, layout.confirm]) {
    expect(action.top).toBeGreaterThanOrEqual(layout.dialog.top)
    expect(action.bottom).toBeLessThanOrEqual(layout.dialog.bottom)
    expect(action.left).toBeGreaterThanOrEqual(layout.dialog.left)
    expect(action.right).toBeLessThanOrEqual(layout.dialog.right)
    expect(action.top).toBeGreaterThanOrEqual(0)
    expect(action.bottom).toBeLessThanOrEqual(layout.viewportHeight)
  }
  expect(layout.confirmHitTestId).toBe('fictional-supernova-confirm')

  await page.mouse.click(
    layout.confirm.left + layout.confirm.width / 2,
    layout.confirm.top + layout.confirm.height / 2,
  )
  await expect(page.getByTestId('solar-system-app')).toHaveAttribute(
    'data-active-scenario',
    'fictional-supernova',
  )
  await expect(backdrop).toBeHidden()
})

async function bootObservatory(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await page.evaluate((key) => localStorage.removeItem(key), PREFERENCE_KEY)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('solar-system-app')).toBeVisible()
  await expect(page.getByTestId('ephemeris-provider-badge')).toHaveText(
    /JPL Horizons .* generated offline bundles/i,
    { timeout: 30_000 },
  )
  await expect(page.getByTestId('solar-fate-drawer-toggle')).toBeEnabled()
}
