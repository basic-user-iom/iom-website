/**
 * Distinct stills for webgpu-tsl-linked-particles.
 * Tries live pointer-drawn trails; falls back to aggressive poster region crops.
 */
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'assets', 'blog', 'webgpu-tsl-linked-particles')
const POSTER = join(__dirname, '..', 'public', 'assets', 'posters', 'webgpu-tsl-linked-particles.jpg')
const TMP = join(tmpdir(), `linked-particles-${Date.now()}`)
const base = (process.argv[2] ?? 'https://iobjectm.com').replace(/\/$/, '')

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
    for (const sel of ['.back-link', '.hint', '#hint', '#status', '.demo-attribution', '.demo-chrome', '.lil-gui']) {
      document.querySelectorAll(sel).forEach((el) => el.style.setProperty('display', 'none', 'important'))
    }
  })
}

async function waitBright(page) {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 32) return false
      const tmp = document.createElement('canvas')
      tmp.width = 32
      tmp.height = 32
      const ctx = tmp.getContext('2d')
      if (!ctx) return false
      ctx.drawImage(canvas, 0, 0, 32, 32)
      const d = ctx.getImageData(0, 0, 32, 32).data
      let s = 0
      for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]
      return s / (32 * 32) > 12
    },
    { timeout: 90000 },
  )
}

async function shot(page, name) {
  await hideChrome(page)
  const raw = await page.screenshot({ type: 'jpeg', quality: 92 })
  const buf = await sharp(raw).resize(1280, 800, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer()
  await writeFile(join(TMP, name), buf)
  console.log(`  live ${name} ${buf.length}`)
  return buf
}

async function drawTrail(page, points) {
  if (!points.length) return
  await page.mouse.move(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) {
    await page.mouse.move(points[i][0], points[i][1], { steps: 8 })
    await page.waitForTimeout(40)
  }
  await page.waitForTimeout(600)
}

async function seedAggressiveCrops() {
  if (!existsSync(POSTER)) throw new Error('missing poster')
  await mkdir(OUT, { recursive: true })
  const meta = await sharp(POSTER).metadata()
  const w = meta.width || 1600
  const h = meta.height || 900
  // Three clearly different regions + slight resize crops
  const specs = [
    { left: 0, top: 0, width: Math.floor(w * 0.62), height: Math.floor(h * 0.78) },
    { left: Math.floor(w * 0.38), top: Math.floor(h * 0.08), width: Math.floor(w * 0.62), height: Math.floor(h * 0.78) },
    {
      left: Math.floor(w * 0.18),
      top: Math.floor(h * 0.22),
      width: Math.floor(w * 0.64),
      height: Math.floor(h * 0.58),
    },
  ]
  const names = ['cover.jpg', 'view-a.jpg', 'view-b.jpg']
  const bufs = []
  for (let i = 0; i < 3; i++) {
    const c = specs[i]
    const buf = await sharp(POSTER)
      .extract({
        left: Math.max(0, c.left),
        top: Math.max(0, c.top),
        width: Math.min(c.width, w - c.left),
        height: Math.min(c.height, h - c.top),
      })
      .resize(1280, 800, { fit: 'cover', position: i === 2 ? 'centre' : i === 0 ? 'left' : 'right' })
      .jpeg({ quality: 90 })
      .toBuffer()
    await writeFile(join(OUT, names[i]), buf)
    bufs.push(buf)
    console.log(`  crop ${names[i]} ${buf.length}`)
  }
  console.log(
    `  crop diffs a=${(await meanAbsDiff(bufs[0], bufs[1])).toFixed(1)} b=${(await meanAbsDiff(bufs[1], bufs[2])).toFixed(1)} c=${(await meanAbsDiff(bufs[0], bufs[2])).toFixed(1)}`,
  )
}

async function main() {
  console.log('linked-particles from', base)
  await mkdir(TMP, { recursive: true })
  await mkdir(OUT, { recursive: true })

  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-gl=angle'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  let ok = false
  try {
    await page.goto(`${base}/demos/webgpu-tsl-linked-particles/`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    })
    await page.waitForTimeout(4000)
    await waitBright(page)
    await page.waitForTimeout(2000)

    // Cover — horizontal sweep trail
    await drawTrail(page, [
      [200, 500],
      [400, 350],
      [650, 480],
      [900, 320],
      [1150, 450],
    ])
    const cover = await shot(page, 'cover.jpg')

    // view-a — vertical + loop on the left
    await drawTrail(page, [
      [250, 700],
      [280, 500],
      [320, 280],
      [480, 220],
      [420, 400],
      [300, 550],
    ])
    const viewA = await shot(page, 'view-a.jpg')

    // view-b — dense scribble on the right + wait for bloom
    await drawTrail(page, [
      [900, 250],
      [1100, 300],
      [1000, 450],
      [1200, 520],
      [950, 600],
      [1150, 700],
      [1050, 400],
    ])
    await page.waitForTimeout(1200)
    const viewB = await shot(page, 'view-b.jpg')

    const dCA = await meanAbsDiff(cover, viewA)
    const dAB = await meanAbsDiff(viewA, viewB)
    const dCB = await meanAbsDiff(cover, viewB)
    console.log(`  live diffs cover↔a=${dCA.toFixed(1)} a↔b=${dAB.toFixed(1)} cover↔b=${dCB.toFixed(1)}`)

    if (cover.length > 30000 && dAB > 10 && dCA > 8) {
      for (const n of ['cover.jpg', 'view-a.jpg', 'view-b.jpg']) {
        await copyFile(join(TMP, n), join(OUT, n))
      }
      ok = true
    } else {
      console.warn('  live too similar / dark — poster crops')
    }
  } catch (err) {
    console.warn('live failed:', err.message || err)
  } finally {
    await page.close()
    await browser.close()
  }

  if (!ok) await seedAggressiveCrops()
  console.log('done →', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
