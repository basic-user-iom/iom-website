import { expect, test } from '@playwright/test'

interface CloudSample {
  zonalSpread: number
  longitudinalRms: number
  seamMax: number
  hash: number
  meanRgb: [number, number, number]
  glError: number
}
interface CloudFixture {
  ready: boolean
  sampleIceClouds(id: string, quality: number, days: number): CloudSample
}

test('ice giants retain visible, restrained cloud structure at every quality', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('e2e/fixtures/ice-giant-clouds.html')
  await page.waitForFunction(() => (window as unknown as CloudFixture).ready)
  const samples = await page.evaluate(() => {
    const fixture = window as unknown as CloudFixture
    return ['uranus', 'neptune'].flatMap(id => [0, 1, 2, 3].map(quality => ({
      id, quality, ...fixture.sampleIceClouds(id, quality, 0),
    })))
  })
  for (const sample of samples) {
    // Display-space regression bounds, not a claim of calibrated radiometry.
    expect(sample.glError).toBe(0)
    expect(sample.zonalSpread).toBeGreaterThan(sample.id === 'neptune' ? 7 : 3)
    expect(sample.zonalSpread).toBeLessThan(sample.id === 'neptune' ? 25 : 12)
    expect(sample.longitudinalRms).toBeGreaterThan(sample.id === 'neptune' ? 0.4 : 0.07)
    expect(sample.longitudinalRms).toBeLessThan(3)
    expect(sample.seamMax).toBeLessThan(6)
    const blueGreen = sample.meanRgb[2] / sample.meanRgb[1]
    expect(blueGreen).toBeGreaterThan(0.95)
    expect(blueGreen).toBeLessThan(1.12)
  }
  expect(errors).toEqual([])
})

test('advected ice-giant clouds replay deterministically without a longitude seam', async ({ page }) => {
  await page.goto('e2e/fixtures/ice-giant-clouds.html')
  await page.waitForFunction(() => (window as unknown as CloudFixture).ready)
  for (const id of ['uranus', 'neptune']) {
    const samples = await page.evaluate(id => {
      const fixture = window as unknown as CloudFixture
      return [0, 37.5, 0].map(days => fixture.sampleIceClouds(id, 2, days))
    }, id)
    expect(samples[0]!.hash).not.toBe(samples[1]!.hash)
    expect(samples[0]).toEqual(samples[2])
    for (const sample of samples) {
      expect(sample.glError).toBe(0)
      expect(sample.seamMax).toBeLessThan(6)
    }
  }
})
