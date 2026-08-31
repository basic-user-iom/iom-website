import { defineConfig, devices } from '@playwright/test'

const port = Number.parseInt(process.env.SOLAR_SYSTEM_E2E_PORT ?? '5196', 10)
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('SOLAR_SYSTEM_E2E_PORT must be a valid TCP port.')
}
const browserChannel = process.env.SOLAR_SYSTEM_E2E_CHANNEL
const baseURL = `http://127.0.0.1:${port}/demos/solar-system/`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Each page decodes ~35 MB of Float64 ephemerides and drives a live WebGL
  // camera. Keep the release gate serial so concurrent GPU pages cannot add
  // frame jitter to precision camera assertions.
  workers: 1,
  reporter: 'line',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserChannel === undefined ? {} : { channel: browserChannel }),
      },
    },
  ],
})
