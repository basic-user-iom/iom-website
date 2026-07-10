/**
 * Capture WebGPU SSR + Denoise demo poster (requires GPU / WebGPU in Chromium).
 * Usage: node scripts/capture-ssr-denoise-poster.mjs [baseUrl]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'assets', 'posters')
const OUT_PATH = join(OUT_DIR, 'ssr-denoise.jpg')
const WIDTH = 1280
const HEIGHT = 800
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const url = `${baseUrl.replace(/\/$/, '')}/demos/ssr-denoise/`

async function main() {
  const { chromium } = await import('playwright')

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
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })

    // Wait until WebGPU canvas is rendering (fallback stays hidden).
    await page.waitForFunction(
      () => {
        const fallback = document.getElementById('fallback')
        const canvas = document.querySelector('#container canvas')
        return (
          canvas instanceof HTMLCanvasElement &&
          canvas.width > 0 &&
          canvas.height > 0 &&
          !fallback?.classList.contains('is-visible')
        )
      },
      { timeout: 45000 },
    )

    // Let SSR/denoise passes settle.
    await page.waitForTimeout(4000)

    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false })
    await mkdir(OUT_DIR, { recursive: true })
    await writeFile(OUT_PATH, buffer)
    console.log(`Saved poster → ${OUT_PATH}`)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
