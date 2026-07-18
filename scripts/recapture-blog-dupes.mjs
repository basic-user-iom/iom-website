/**
 * Recapture blog folders flagged as near-duplicate / identical shots.
 *
 * Usage:
 *   node scripts/recapture-blog-dupes.mjs [baseUrl]
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'assets', 'blog')
const POSTERS = join(ROOT, 'public', 'assets', 'posters')
const STEPS = join(OUT, '_panorama-tour-steps')
const baseUrl = (process.argv[2] ?? 'https://iobjectm.com').replace(/\/$/, '')
const WIDTH = 1280
const HEIGHT = 800
const CAPTURE_ARGS = ['--disable-features=WebGPU,Vulkan', '--ignore-gpu-blocklist']

async function hideChrome(page) {
  await page.evaluate(() => {
    for (const sel of [
      '.back-link',
      '.hint',
      '#hint',
      '#status',
      '.demo-attribution',
      '.demo-chrome',
    ]) {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.setProperty('display', 'none', 'important')
      })
    }
  })
}

async function orbit(page, dx, dy) {
  const box = await page.evaluate(() => {
    const c = document.querySelector('canvas, #container')
    if (!c) return null
    const r = c.getBoundingClientRect()
    return { x: r.left + r.width * 0.55, y: r.top + r.height * 0.5 }
  })
  if (!box) return
  await page.mouse.move(box.x, box.y)
  await page.mouse.down()
  await page.mouse.move(box.x + dx, box.y + dy, { steps: 24 })
  await page.mouse.up()
  await page.waitForTimeout(900)
}

async function saveShot(page, dir, name) {
  await mkdir(dir, { recursive: true })
  const buf = await page.screenshot({ type: 'jpeg', quality: 90, fullPage: false })
  await writeFile(join(dir, name), buf)
  const hash = createHash('md5').update(buf).digest('hex').slice(0, 10)
  console.log(`  → ${name} ${buf.length}b md5=${hash}`)
  return buf
}

async function posterVariants(id, posterName) {
  const src = join(POSTERS, posterName)
  if (!existsSync(src)) {
    console.warn('  missing poster', posterName)
    return
  }
  const dir = join(OUT, id)
  await mkdir(dir, { recursive: true })
  const meta = await sharp(src).metadata()
  const w = meta.width || 1280
  const h = meta.height || 800
  const jobs = [
    { name: 'cover.jpg', extract: null },
    {
      name: 'view-a.jpg',
      extract: {
        left: Math.floor(w * 0.08),
        top: Math.floor(h * 0.05),
        width: Math.floor(w * 0.84),
        height: Math.floor(h * 0.9),
      },
    },
    {
      name: 'view-b.jpg',
      extract: {
        left: Math.floor(w * 0.18),
        top: Math.floor(h * 0.12),
        width: Math.floor(w * 0.64),
        height: Math.floor(h * 0.76),
      },
    },
  ]
  for (const job of jobs) {
    let pipeline = sharp(src)
    if (job.extract) pipeline = pipeline.extract(job.extract)
    const buf = await pipeline.resize(WIDTH, HEIGHT, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer()
    await writeFile(join(dir, job.name), buf)
    console.log(`  → ${id}/${job.name} from poster (${buf.length})`)
  }
}

async function captureImagePrep(browser) {
  console.log('image-prep — distinct presets')
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
  const dir = join(OUT, 'image-prep')
  try {
    await page.goto(`${baseUrl}/tools/image-prep`, { waitUntil: 'networkidle', timeout: 90000 })
    await page.waitForTimeout(1200)

    // cover: Gallery selected
    await page.getByText('Gallery', { exact: true }).first().click().catch(() => {})
    await page.waitForTimeout(400)
    await saveShot(page, dir, 'cover.jpg')

    // view-a: Hero + scroll toward drop zone
    await page.getByText('Hero', { exact: true }).first().click().catch(() => {})
    await page.waitForTimeout(400)
    await page.mouse.wheel(0, 280)
    await page.waitForTimeout(400)
    await saveShot(page, dir, 'view-a.jpg')

    // view-b: Thumb + WebP format
    await page.getByText('Thumb', { exact: true }).first().click().catch(() => {})
    await page.waitForTimeout(300)
    const format = page.locator('select').first()
    if ((await format.count()) > 0) {
      await format.selectOption({ label: 'WebP' }).catch(async () => {
        await format.selectOption('webp').catch(() => {})
      })
    }
    await page.mouse.wheel(0, 420)
    await page.waitForTimeout(400)
    await saveShot(page, dir, 'view-b.jpg')
  } finally {
    await page.close()
  }
}

async function captureIomThree(browser) {
  console.log('iom-three — splash + after play')
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
  const dir = join(OUT, 'iom-three')
  try {
    await page.goto(`${baseUrl}/demos/dreams-iom/index.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    })
    await page.waitForTimeout(2500)
    await hideChrome(page)
    await saveShot(page, dir, 'cover.jpg')

    await page.locator('.intro-play-btn').click({ timeout: 5000 }).catch(async () => {
      await page.mouse.click(WIDTH / 2, HEIGHT / 2)
    })
    await page.waitForTimeout(4000)
    await hideChrome(page)
    // Pause UI chrome for cleaner still
    await page.evaluate(() => {
      document
        .querySelectorAll('.intro-controls, .intro-control-btn, .intro-audio-btn')
        .forEach((el) => el.style.setProperty('display', 'none', 'important'))
    })
    await saveShot(page, dir, 'view-a.jpg')

    await page.mouse.wheel(0, 900)
    await page.waitForTimeout(1500)
    await page.mouse.wheel(0, 900)
    await page.waitForTimeout(1500)
    await hideChrome(page)
    await saveShot(page, dir, 'view-b.jpg')
  } finally {
    await page.close()
  }
}

async function captureCss3d(browser) {
  console.log('css3d-sprites — morph + strong orbits')
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
  const dir = join(OUT, 'css3d-sprites')
  try {
    await page.goto(`${baseUrl}/demos/css3d-sprites/index.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    })
    await page.waitForTimeout(3500)
    await hideChrome(page)
    await saveShot(page, dir, 'cover.jpg')

    // Wait for auto morph toward next formation, then orbit hard
    await page.waitForTimeout(5500)
    await orbit(page, 380, 40)
    await hideChrome(page)
    await saveShot(page, dir, 'view-a.jpg')

    await page.waitForTimeout(5500)
    await orbit(page, -320, 120)
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(700)
    await hideChrome(page)
    await saveShot(page, dir, 'view-b.jpg')
  } finally {
    await page.close()
  }
}

async function capturePanoramaPair(browser) {
  console.log('panorama-suite — keep guided-tour step stills')
  const suite = join(OUT, 'panorama-suite')
  await mkdir(suite, { recursive: true })
  await copyFile(join(STEPS, 'step-1.jpg'), join(suite, 'cover.jpg'))
  await copyFile(join(STEPS, 'step-2.jpg'), join(suite, 'view-a.jpg'))
  await copyFile(join(STEPS, 'step-3.jpg'), join(suite, 'view-b.jpg'))
  if (existsSync(join(STEPS, 'step-4.jpg'))) {
    await copyFile(join(STEPS, 'step-4.jpg'), join(suite, 'view-c.jpg'))
  }
  console.log('  suite synced from _panorama-tour-steps')

  // Keep editor post on the same guided-step stills (effects on steps 2–4).
  // Idle preview orbits hide particles/birds/spout and confuse the blog story.
  console.log('panorama-360-tour — sync guided-tour step stills (same as suite)')
  const tour = join(OUT, 'panorama-360-tour')
  await mkdir(tour, { recursive: true })
  await copyFile(join(STEPS, 'step-1.jpg'), join(tour, 'cover.jpg'))
  await copyFile(join(STEPS, 'step-2.jpg'), join(tour, 'view-a.jpg'))
  await copyFile(join(STEPS, 'step-3.jpg'), join(tour, 'view-b.jpg'))
  if (existsSync(join(STEPS, 'step-4.jpg'))) {
    await copyFile(join(STEPS, 'step-4.jpg'), join(tour, 'view-c.jpg'))
  }
  console.log('  tour synced from _panorama-tour-steps')
}

async function captureComputeParticles() {
  console.log('compute-particles — poster crops (WebGPU screenshots black)')
  await posterVariants('compute-particles', 'compute-particles.jpg')
}

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || 'chrome',
    args: CAPTURE_ARGS,
  })
  try {
    await captureImagePrep(browser)
    await captureIomThree(browser)
    await captureCss3d(browser)
    await capturePanoramaPair(browser)
    await captureComputeParticles()
  } finally {
    await browser.close()
  }

  // Re-run perceptual check on fixed folders
  console.log('\n=== recheck ===')
  const { spawnSync } = await import('node:child_process')
  spawnSync(process.execPath, [join(__dirname, 'audit-blog-shots.mjs')], { stdio: 'inherit' })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
