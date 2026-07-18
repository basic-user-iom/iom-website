/**
 * One-off brighter UI overview for volume-lighting blog post.
 * Usage: node scripts/capture-blog-ui-shot.mjs [baseUrl]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'assets', 'blog', 'volume-lighting', 'ui.jpg')
const baseUrl = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')

const WEBGPU_ARGS = [
  '--enable-unsafe-webgpu',
  '--enable-features=Vulkan,WebGPU',
  '--use-angle=vulkan',
  '--ignore-gpu-blocklist',
]

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || 'chrome',
    args: WEBGPU_ARGS,
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(120000)

  try {
    await page.goto(`${baseUrl}/demos/volume-lighting/index.html`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
    await page.waitForFunction(
      () => window.__volumeLightingTest?.getState()?.hasPagani,
      { timeout: 120000 },
    )
    await page.waitForTimeout(7000)

    // Wait until rect lights spin into a bright side-lit frame (sample canvas luminance)
    for (let i = 0; i < 40; i++) {
      const bright = await page.evaluate(() => {
        const canvas = document.querySelector('#container canvas')
        if (!(canvas instanceof HTMLCanvasElement)) return false
        const tmp = document.createElement('canvas')
        tmp.width = 32
        tmp.height = 32
        const ctx = tmp.getContext('2d')
        if (!ctx) return false
        ctx.drawImage(canvas, 0, 0, 32, 32)
        const data = ctx.getImageData(0, 0, 32, 32).data
        let sum = 0
        for (let p = 0; p < data.length; p += 4) sum += data[p] + data[p + 1] + data[p + 2]
        return sum / (32 * 32) > 55
      })
      if (bright) break
      await page.waitForTimeout(250)
    }

    await page.evaluate(() => {
      const api = window.__volumeLightingTest
      api.setUiChromeVisible?.(true)
      // Same framing family as the bright profile.jpg still
      api.setCamera?.({
        position: [-22, 2.4, -12],
        target: [0, 1.7, -14],
        paganiYaw: 0.15,
        pauseTurntable: true,
      })
      api.setCaptureLook?.({
        pauseLights: true,
        fogIntensity: 1.25,
        smokeAmount: 2.1,
        exposure: 2.45,
      })

      const panel = document.getElementById('camera-views-panel')
      if (panel) {
        panel.classList.add('is-open')
        panel.querySelector('.panel-header')?.setAttribute('aria-expanded', 'true')
      }

      for (const sel of ['.back-link', '.demo-attribution', '#status']) {
        document.querySelectorAll(sel).forEach((el) => {
          el.style.display = 'none'
        })
      }
    })

    // Expand Volumetric Lighting so the right-side control is obvious
    await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('div, span, button, label')]
      for (const el of nodes) {
        const t = (el.textContent || '').trim()
        if (t === 'Volumetric Lighting' || t === '+ Volumetric Lighting') {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          break
        }
      }
    })

    await page.waitForTimeout(1200)

    await mkdir(dirname(OUT), { recursive: true })
    const buffer = await page.screenshot({ type: 'jpeg', quality: 92, fullPage: false })
    await writeFile(OUT, buffer)
    console.log(`→ ${OUT} (${buffer.length} bytes)`)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
