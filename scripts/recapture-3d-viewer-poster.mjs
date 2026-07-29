/**
 * Fresh high-res 3D Viewer product poster for homepage cards.
 * Usage: node scripts/recapture-3d-viewer-poster.mjs [viewerUrl]
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const POSTERS = join(ROOT, 'public', 'assets', 'posters')
const viewerUrl = process.argv[2] || 'https://3dbviewer.com/'

async function canvasBright(page, minAvg = 18, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const avg = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      if (!canvas) return 0
      try {
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return 0
        const w = Math.min(64, canvas.width)
        const h = Math.min(40, canvas.height)
        if (w < 2 || h < 2) return 0
        const data = ctx.getImageData(0, 0, w, h).data
        let sum = 0
        for (let i = 0; i < data.length; i += 4) {
          sum += (data[i] + data[i + 1] + data[i + 2]) / 3
        }
        return sum / (data.length / 4)
      } catch {
        return -1
      }
    })
    if (avg < 0 || avg >= minAvg) return avg
    await page.waitForTimeout(400)
  }
  return 0
}

async function main() {
  await mkdir(POSTERS, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-webgpu', '--use-gl=angle', '--use-angle=swiftshader'],
  })
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  })

  try {
    console.log('opening', viewerUrl)
    await page.goto(viewerUrl, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForSelector('canvas', { timeout: 120000 })
    await page.waitForTimeout(8000)
    const avg = await canvasBright(page, 20).catch(() => 0)
    console.log('canvas avg luminance', avg)

    // Prefer product UI visible for the software card.
    await page.evaluate(() => {
      document.querySelectorAll('button, [role="button"]').forEach((el) => {
        const t = (el.textContent || '').trim().toLowerCase()
        if (t === 'show menu' || t.includes('show menu')) el.click()
      })
    })
    await page.waitForTimeout(600)

    const raw = await page.screenshot({ type: 'png', fullPage: false })
    console.log('raw png bytes', raw.length)

    const master = await sharp(raw)
      .resize(1600, 1000, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer()
    await writeFile(join(POSTERS, '3d-viewer.jpg'), master)

    const webp = await sharp(master)
      .resize(1280, 800, { fit: 'cover', position: 'centre' })
      .webp({ quality: 86, effort: 5 })
      .toBuffer()
    await writeFile(join(POSTERS, '3d-viewer.webp'), webp)

    const mobile = await sharp(master)
      .resize(800, 500, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82, effort: 5 })
      .toBuffer()
    await writeFile(join(POSTERS, '3d-viewer-400.webp'), mobile)

    console.log('wrote posters', {
      jpg: master.length,
      webp: webp.length,
      mobile: mobile.length,
    })
  } finally {
    await page.close()
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
