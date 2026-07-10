/**
 * Smoke test for WebGPU compute particles demo.
 * Usage: node scripts/smoke-compute-particles.mjs [baseUrl]
 */
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const url = `${baseUrl.replace(/\/$/, '')}/demos/compute-particles/`

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,WebGPU',
      '--use-angle=vulkan',
      '--ignore-gpu-blocklist',
    ],
  })

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 })

    await page.waitForFunction(
      () => {
        const fallback = document.getElementById('fallback')
        const canvas = document.querySelector('#container canvas')
        return (
          canvas instanceof HTMLCanvasElement &&
          canvas.width > 0 &&
          !fallback?.classList.contains('is-visible') &&
          typeof window.__computeParticlesTest !== 'undefined'
        )
      },
      { timeout: 60000 },
    )

    await page.waitForTimeout(2000)

    const before = await page.evaluate(() => window.__computeParticlesTest.getState())
    if (before.released) throw new Error('particles should start unreleased')

    await page.evaluate(() => window.__computeParticlesTest.release())
    await page.waitForTimeout(2500)

    const afterRelease = await page.evaluate(() => window.__computeParticlesTest.getState())
    if (!afterRelease.released) throw new Error('release did not set released flag')

    await page.evaluate(() => window.__computeParticlesTest.reset())
    await page.waitForTimeout(1500)

    const afterReset = await page.evaluate(() => window.__computeParticlesTest.getState())
    if (afterReset.released) throw new Error('reset did not clear released flag')

    console.log(
      JSON.stringify(
        {
          ok: true,
          url,
          particleCount: before.particleCount,
          shape: before.shape,
        },
        null,
        2,
      ),
    )
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
