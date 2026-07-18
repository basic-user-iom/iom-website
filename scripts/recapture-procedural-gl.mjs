/**
 * Capture distinct, high-quality procedural-gl blog stills from procedural.eu
 * (direct page — iframe embeds often stay blank in headless Chromium).
 */
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'assets', 'blog', 'procedural-gl')
const TMP = join(tmpdir(), `procedural-gl-capture-${Date.now()}`)
const MAP = 'https://www.procedural.eu/map/'

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

async function hideChrome(page) {
  await page.evaluate(() => {
    const kill = /cookie|consent|newsletter|subscribe|accept all/i
    document.querySelectorAll('button, a, div, aside, section').forEach((el) => {
      const t = (el.textContent || '').trim()
      if (t.length && t.length < 80 && kill.test(t)) {
        el.style.setProperty('display', 'none', 'important')
      }
    })
  })
}

async function waitForTerrain(page) {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 64) return false
      const tmp = document.createElement('canvas')
      tmp.width = 32
      tmp.height = 32
      const ctx = tmp.getContext('2d')
      if (!ctx) return false
      ctx.drawImage(canvas, 0, 0, 32, 32)
      const d = ctx.getImageData(0, 0, 32, 32).data
      let sum = 0
      let greens = 0
      for (let i = 0; i < d.length; i += 4) {
        sum += d[i] + d[i + 1] + d[i + 2]
        if (d[i + 1] > d[i] + 8 && d[i + 1] > 40) greens++
      }
      const avg = sum / (32 * 32)
      return avg > 55 && greens > 40
    },
    { timeout: 120000 },
  )
}

async function shot(page, name) {
  // Prefer canvas-only crop if large enough; else full page
  const clip = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!(canvas instanceof HTMLCanvasElement)) return null
    const r = canvas.getBoundingClientRect()
    if (r.width < 400 || r.height < 300) return null
    return {
      x: Math.max(0, r.left),
      y: Math.max(0, r.top),
      width: Math.min(r.width, window.innerWidth - Math.max(0, r.left)),
      height: Math.min(r.height, window.innerHeight - Math.max(0, r.top)),
    }
  })
  const raw =
    clip && clip.width > 200 && clip.height > 200
      ? await page.screenshot({ type: 'jpeg', quality: 92, clip })
      : await page.screenshot({ type: 'jpeg', quality: 92 })
  // Normalize to 1280×800
  const buf = await sharp(raw)
    .resize(1280, 800, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 90 })
    .toBuffer()
  const finalPath = join(TMP, `final-${name}`)
  await writeFile(finalPath, buf)
  console.log(`  ${name} ${buf.length}`)
  return buf
}

async function clickRotate(page, times = 1) {
  const selectors = [
    'button[aria-label*="Rotate" i]',
    'button[title*="Rotate" i]',
    'button[aria-label*="orbit" i]',
    '[class*="rotate"] button',
    'button:has-text("↻")',
    'button:has-text("↺")',
  ]
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first()
      if ((await btn.count()) === 0) continue
      for (let i = 0; i < times; i++) {
        await btn.click({ timeout: 1500 })
        await page.waitForTimeout(900)
      }
      return true
    } catch {
      /* next */
    }
  }
  // Fallback: drag orbit
  const box = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    if (!c) return null
    const r = c.getBoundingClientRect()
    return { x: r.left + r.width * 0.55, y: r.top + r.height * 0.5 }
  })
  if (!box) return false
  for (let i = 0; i < times; i++) {
    await page.mouse.move(box.x, box.y)
    await page.mouse.down()
    await page.mouse.move(box.x + 240, box.y + (i % 2 === 0 ? 20 : -30), { steps: 28 })
    await page.mouse.up()
    await page.waitForTimeout(1200)
  }
  return true
}

async function zoom(page, delta) {
  const box = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    if (!c) return null
    const r = c.getBoundingClientRect()
    return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 }
  })
  if (!box) return
  await page.mouse.move(box.x, box.y)
  await page.mouse.wheel(0, delta)
  await page.waitForTimeout(2000)
  await waitForTerrain(page).catch(() => {})
}

async function main() {
  console.log('procedural-gl — live capture from', MAP)
  await mkdir(TMP, { recursive: true })
  await mkdir(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--enable-webgl'],
  })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  try {
    await page.goto(MAP, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForTimeout(4000)
    await hideChrome(page)
    console.log('  waiting for terrain tiles…')
    await waitForTerrain(page)
    await page.waitForTimeout(5000) // let LOD refine
    await hideChrome(page)

    const cover = await shot(page, 'cover.jpg')

    await zoom(page, -1200)
    await page.waitForTimeout(3000)
    await clickRotate(page, 2)
    await page.waitForTimeout(2500)
    const viewA = await shot(page, 'view-a.jpg')

    await zoom(page, 800)
    await clickRotate(page, 3)
    // Pan to a different region
    const box = await page.evaluate(() => {
      const c = document.querySelector('canvas')
      if (!c) return null
      const r = c.getBoundingClientRect()
      return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.55 }
    })
    if (box) {
      await page.mouse.move(box.x, box.y)
      await page.mouse.down()
      await page.mouse.move(box.x - 280, box.y + 140, { steps: 30 })
      await page.mouse.up()
      await page.waitForTimeout(3000)
    }
    await waitForTerrain(page).catch(() => {})
    const viewB = await shot(page, 'view-b.jpg')

    const dCA = await meanAbsDiff(cover, viewA)
    const dAB = await meanAbsDiff(viewA, viewB)
    const dCB = await meanAbsDiff(cover, viewB)
    console.log(`  diffs cover↔a=${dCA.toFixed(1)} a↔b=${dAB.toFixed(1)} cover↔b=${dCB.toFixed(1)}`)
    if (dAB < 10 || cover.length < 80000) {
      console.warn('  WARNING: stills may still be weak — check visually')
    }

    // Copy tmp → public (avoids Windows locks on live assets)
    for (const name of ['cover.jpg', 'view-a.jpg', 'view-b.jpg']) {
      await copyFile(join(TMP, `final-${name}`), join(OUT, name))
    }
  } finally {
    await page.close()
    await browser.close()
  }
  console.log('done →', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
