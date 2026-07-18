/**
 * Recapture Spout blog shots with distinct camera angles.
 *
 * Spout's shader only applies iMouse while z >= 0.5 (button down).
 * On pointerup it snaps back to the default orbit — so cover/view-a/view-b
 * must be screenshotted mid-drag, not after release.
 *
 * Usage:
 *   node scripts/recapture-spout-blog.mjs [baseUrl]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'public', 'assets', 'blog', 'spout')
const WIDTH = 1280
const HEIGHT = 800
const baseUrl = (process.argv[2] ?? 'https://iobjectm.com').replace(/\/$/, '')

/** Canvas UV targets (x,y in 0–1). Shader maps these to heading/elevation. */
const ANGLES = [
  { name: 'cover.jpg', uv: [0.2, 0.8], settleMs: 5500 },
  { name: 'view-a.jpg', uv: [0.55, 0.55], settleMs: 1200 },
  { name: 'view-b.jpg', uv: [0.88, 0.35], settleMs: 1200 },
]

async function hideChrome(page) {
  await page.evaluate(() => {
    for (const sel of ['.back-link', '.hint', '.demo-attribution']) {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.setProperty('display', 'none', 'important')
      })
    }
  })
}

async function canvasBox(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#container canvas')
    if (!canvas) return null
    const r = canvas.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  })
}

/**
 * Hold mouse at a canvas UV so iMouse.z stays positive for the screenshot.
 */
async function holdAtUv(page, uvX, uvY) {
  const box = await canvasBox(page)
  if (!box) throw new Error('no canvas')
  const x = box.x + box.w * uvX
  const y = box.y + box.h * (1 - uvY) // shader Y is bottom-up; pointerPos flips it
  await page.mouse.move(x, y)
  await page.mouse.down()
  // Tiny nudge so pointermove fires after pointerdown
  await page.mouse.move(x + 2, y + 1, { steps: 2 })
  await page.waitForTimeout(400)
}

async function main() {
  const { chromium } = await import('playwright')
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || 'chrome',
    args: ['--ignore-gpu-blocklist'],
  })

  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
  page.setDefaultTimeout(120000)

  try {
    const url = `${baseUrl}/demos/spout/index.html`
    console.log('Opening', url)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForSelector('#container canvas', { timeout: 30000 })
    await page.waitForTimeout(ANGLES[0].settleMs)
    await hideChrome(page)

    for (const shot of ANGLES) {
      await holdAtUv(page, shot.uv[0], shot.uv[1])
      await page.waitForTimeout(shot.settleMs)
      await hideChrome(page)
      const buf = await page.screenshot({ type: 'jpeg', quality: 88, fullPage: false })
      await page.mouse.up()
      await writeFile(join(OUT_DIR, shot.name), buf)
      const hash = createHash('md5').update(buf).digest('hex').slice(0, 10)
      console.log(`  → ${shot.name}  uv=${shot.uv.join(',')}  ${buf.length}b  md5=${hash}`)
    }
  } finally {
    await browser.close()
  }

  // Quick uniqueness check
  const { readFile } = await import('node:fs/promises')
  const hashes = []
  for (const shot of ANGLES) {
    const b = await readFile(join(OUT_DIR, shot.name))
    hashes.push(createHash('md5').update(b).digest('hex'))
  }
  const unique = new Set(hashes).size
  console.log(`Unique hashes: ${unique}/${hashes.length}`)
  if (unique < 3) {
    console.error('Still not distinct — camera hold may have failed')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
