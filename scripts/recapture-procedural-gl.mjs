/**
 * Recapture procedural-gl blog stills with clearly different camera angles.
 * Falls back to aggressive poster crops if iframe orbit stays near-identical.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'assets', 'blog', 'procedural-gl')
const POSTER = join(__dirname, '..', 'public', 'assets', 'posters', 'procedural-gl.jpg')
const base = (process.argv[2] ?? 'https://iobjectm.com').replace(/\/$/, '')

async function hideChrome(page) {
  await page.evaluate(() => {
    for (const sel of ['.back-link', '.hint', '#hint', '.demo-chrome', '.demo-attribution']) {
      document.querySelectorAll(sel).forEach((el) => el.style.setProperty('display', 'none', 'important'))
    }
  })
}

async function shot(page, name) {
  const path = join(OUT, name)
  await page.screenshot({ path, type: 'jpeg', quality: 88 })
  const buf = await readFile(path)
  console.log(`  ${name} ${buf.length}`)
  return buf
}

/** Mean absolute RGB diff on a small resample — higher = more different. */
async function meanAbsDiff(a, b) {
  const size = 64
  const [ra, rb] = await Promise.all([
    sharp(a).resize(size, size, { fit: 'fill' }).raw().toBuffer(),
    sharp(b).resize(size, size, { fit: 'fill' }).raw().toBuffer(),
  ])
  let sum = 0
  for (let i = 0; i < ra.length; i++) sum += Math.abs(ra[i] - rb[i])
  return sum / ra.length
}

async function seedAggressiveCrops() {
  if (!existsSync(POSTER)) throw new Error('missing poster')
  await mkdir(OUT, { recursive: true })
  const meta = await sharp(POSTER).metadata()
  const w = meta.width || 1600
  const h = meta.height || 900
  // Three clearly different regions of the poster
  const crops = [
    { left: 0, top: 0, width: Math.floor(w * 0.72), height: Math.floor(h * 0.78) },
    { left: Math.floor(w * 0.28), top: Math.floor(h * 0.08), width: Math.floor(w * 0.72), height: Math.floor(h * 0.78) },
    { left: Math.floor(w * 0.12), top: Math.floor(h * 0.22), width: Math.floor(w * 0.76), height: Math.floor(h * 0.72) },
  ]
  const names = ['cover.jpg', 'view-a.jpg', 'view-b.jpg']
  for (let i = 0; i < 3; i++) {
    const c = crops[i]
    const buf = await sharp(POSTER)
      .extract({
        left: Math.max(0, c.left),
        top: Math.max(0, c.top),
        width: Math.min(c.width, w - c.left),
        height: Math.min(c.height, h - c.top),
      })
      .resize(1280, 800, { fit: 'cover' })
      .jpeg({ quality: 88 })
      .toBuffer()
    await writeFile(join(OUT, names[i]), buf)
    console.log(`  crop ${names[i]} ${buf.length}`)
  }
}

async function captureLive(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await mkdir(OUT, { recursive: true })
  try {
    await page.goto(`${base}/demos/procedural-gl/`, {
      waitUntil: 'networkidle',
      timeout: 120000,
    })
    await page.waitForTimeout(10000)
    await hideChrome(page)

    const iframe = page.locator('iframe').first()
    const box = await iframe.boundingBox()
    if (!box) throw new Error('no iframe')

    const cover = await shot(page, 'cover.jpg')

    // Prefer official rotate controls inside the embed (top-right stack).
    const frame = page.frameLocator('iframe').first()
    let rotated = false
    for (const sel of [
      'button:has-text("↻")',
      'button[aria-label*="rotate" i]',
      'button[title*="rotate" i]',
      '[class*="rotate"]',
    ]) {
      try {
        const btn = frame.locator(sel).first()
        if ((await btn.count()) > 0) {
          await btn.click({ timeout: 2000 })
          await page.waitForTimeout(1500)
          rotated = true
          break
        }
      } catch {
        /* try next */
      }
    }

    const cx = box.x + box.width * 0.55
    const cy = box.y + box.height * 0.5

    // Strong orbit + zoom for view-a
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 320, cy + 20, { steps: 28 })
    await page.mouse.up()
    await page.mouse.wheel(0, -900)
    await page.waitForTimeout(1800)
    if (!rotated) {
      // Second rotate via drag if UI buttons unavailable
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      await page.mouse.move(cx + 280, cy - 40, { steps: 24 })
      await page.mouse.up()
      await page.waitForTimeout(1200)
    }
    const viewA = await shot(page, 'view-a.jpg')

    // Opposite orbit + zoom out for view-b
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx - 360, cy + 120, { steps: 30 })
    await page.mouse.up()
    await page.mouse.wheel(0, 1200)
    await page.waitForTimeout(1800)
    const viewB = await shot(page, 'view-b.jpg')

    const dCoverA = await meanAbsDiff(cover, viewA)
    const dAB = await meanAbsDiff(viewA, viewB)
    const dCoverB = await meanAbsDiff(cover, viewB)
    console.log(`  diffs cover↔a=${dCoverA.toFixed(1)} a↔b=${dAB.toFixed(1)} cover↔b=${dCoverB.toFixed(1)}`)
    return { dCoverA, dAB, dCoverB }
  } finally {
    await page.close()
  }
}

async function main() {
  console.log('procedural-gl recapture from', base)
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--ignore-gpu-blocklist'],
  })
  let diffs
  try {
    diffs = await captureLive(browser)
  } catch (err) {
    console.warn('live capture failed:', err.message || err)
    diffs = null
  } finally {
    await browser.close()
  }

  const tooSimilar = !diffs || diffs.dAB < 8 || diffs.dCoverA < 6 || diffs.dCoverB < 6
  if (tooSimilar) {
    console.warn('live angles too similar — using aggressive poster crops')
    await seedAggressiveCrops()
    const [c, a, b] = await Promise.all([
      readFile(join(OUT, 'cover.jpg')),
      readFile(join(OUT, 'view-a.jpg')),
      readFile(join(OUT, 'view-b.jpg')),
    ])
    console.log(
      `  crop diffs cover↔a=${(await meanAbsDiff(c, a)).toFixed(1)} a↔b=${(await meanAbsDiff(a, b)).toFixed(1)} cover↔b=${(await meanAbsDiff(c, b)).toFixed(1)}`,
    )
  }
  console.log('done →', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
