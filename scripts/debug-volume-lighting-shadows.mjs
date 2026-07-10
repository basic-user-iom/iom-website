/**
 * Debug shadow visibility on volume-lighting demo.
 * Usage: node scripts/debug-volume-lighting-shadows.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const url = `${baseUrl.replace(/\/$/, '')}/demos/volume-lighting/`
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.debug')

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
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 })

    await page.waitForFunction(
      () => {
        const fallback = document.getElementById('fallback')
        const canvas = document.querySelector('#container canvas')
        return (
          canvas instanceof HTMLCanvasElement &&
          canvas.width > 0 &&
          !fallback?.classList.contains('is-visible') &&
          typeof window.__volumeLightingTest !== 'undefined' &&
          window.__volumeLightingTest.getState().hasPagani
        )
      },
      { timeout: 90000 },
    )

    await page.waitForTimeout(6000)

    const state = await page.evaluate(() => window.__volumeLightingTest.getState())

    const shotPath = join(outDir, 'volume-lighting-shadow-debug.png')
    mkdirSync(outDir, { recursive: true })
    await page.screenshot({ path: shotPath, type: 'png' })

    const { data, info } = await sharp(shotPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width: w, height: h } = info

    const sample = (nx, ny) => {
      const x = Math.min(w - 1, Math.max(0, Math.floor(nx * w)))
      const y = Math.min(h - 1, Math.max(0, Math.floor(ny * h)))
      const i = (y * w + x) * 4
      return [data[i], data[i + 1], data[i + 2], data[i + 3]]
    }

    const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

    const carCenter = sample(0.5, 0.55)
    const carLeft = sample(0.42, 0.55)
    const carRight = sample(0.58, 0.55)
    const floorShadow = sample(0.5, 0.68)
    const floorLitLeft = sample(0.28, 0.7)
    const floorLitRight = sample(0.72, 0.7)
    const floor = sample(0.5, 0.72)
    const sky = sample(0.5, 0.15)

    const diagnostics = {
      state,
      samples: {
        carCenter: { rgb: carCenter, lum: luminance(carCenter) },
        carLeft: { rgb: carLeft, lum: luminance(carLeft) },
        carRight: { rgb: carRight, lum: luminance(carRight) },
        floorShadow: { rgb: floorShadow, lum: luminance(floorShadow) },
        floorLitLeft: { rgb: floorLitLeft, lum: luminance(floorLitLeft) },
        floorLitRight: { rgb: floorLitRight, lum: luminance(floorLitRight) },
        floor: { rgb: floor, lum: luminance(floor) },
        sky: { rgb: sky, lum: luminance(sky) },
      },
      contrast: {
        carLR: Math.abs(luminance(carLeft) - luminance(carRight)),
        floorShadowVsLit:
          (luminance(floorLitLeft) + luminance(floorLitRight)) / 2 - luminance(floorShadow),
      },
    }

    console.log(JSON.stringify({ ok: true, url, diagnostics }, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
