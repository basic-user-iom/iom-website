/**
 * Capture cover + view-a + view-b for demo blog posts.
 * Also seeds cover from posters when capture fails.
 *
 * Usage:
 *   node scripts/capture-all-blog-shots.mjs [baseUrl] [onlyId]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_ROOT = join(ROOT, 'public', 'assets', 'blog')
const POSTER_DIR = join(ROOT, 'public', 'assets', 'posters')
const WIDTH = 1280
const HEIGHT = 800
const baseUrl = (process.argv[2] ?? 'http://localhost:5174').replace(/\/$/, '')
const onlyId = process.argv[3] ?? process.env.ONLY ?? ''

// Disable WebGPU for captures: Playwright screenshots WebGPU canvases as black.
// Demos fall back to WebGL, which composites correctly (hide any fallback toast).
const CAPTURE_ARGS = [
  '--disable-features=WebGPU,Vulkan',
  '--ignore-gpu-blocklist',
]

/** @type {{ id: string, path: string, settleMs: number, hideChrome?: boolean, poster?: string, orbit?: boolean, spa?: boolean }[]} */
const TARGETS = [
  // Prefer local 3D Viewer app (F:\\3d-viever-backup\\v3.18 → npm run dev:open), not the marketing site.
  { id: '3d-viewer', path: 'http://localhost:3000/', settleMs: 12000, orbit: true, poster: '3d-viewer.jpg' },
  { id: 'streets-gl-bridge', path: 'https://iobjectm.com/demos/streets-gl/', settleMs: 10000, poster: 'streets-gl.jpg', hideChrome: true, orbit: true },
  { id: 'panorama-360-tour', path: 'https://iobjectm.com/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6', settleMs: 7000, poster: 'panorama-360-tour.jpg', hideChrome: true, orbit: true },
  { id: 'crm-demo', path: '/crm-demo', settleMs: 2500, poster: 'crm-demo.jpg', spa: true },
  { id: 'image-prep', path: '/tools/image-prep', settleMs: 2000, poster: 'image-prep.jpg', spa: true },
  { id: 'raven-path', path: '/demos/raven-path/index.html', settleMs: 6000, poster: 'raven-path.jpg', hideChrome: true, orbit: true },
  { id: 'artist-globe', path: '/artist-globe', settleMs: 4000, poster: 'artist-globe.jpg', spa: true, orbit: true },
  { id: 'ssr-denoise', path: '/demos/ssr-denoise/index.html', settleMs: 6000, poster: 'ssr-denoise.jpg', hideChrome: true, orbit: true },
  { id: 'iom-three', path: '/demos/dreams-iom/index.html', settleMs: 5000, poster: 'iom-three.jpg', hideChrome: true, orbit: true },
  { id: 'threejs-ocean', path: '/demos/ocean/index.html', settleMs: 5000, poster: 'ocean.jpg', hideChrome: true, orbit: true },
  { id: 'panorama-suite', path: 'https://iobjectm.com/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6', settleMs: 7000, poster: 'panorama-360-tour.jpg', hideChrome: true, orbit: true },
  { id: 'css3d-sprites', path: '/demos/css3d-sprites/index.html', settleMs: 3000, poster: 'css3d-sprites.png', hideChrome: true, orbit: true },
  { id: 'compute-particles', path: '/demos/compute-particles/index.html', settleMs: 4000, poster: 'compute-particles.jpg', hideChrome: true, orbit: true },
  { id: 'webgpu-spotlight', path: '/demos/webgpu-spotlight/index.html', settleMs: 6000, poster: 'webgpu-spotlight.jpg', hideChrome: true, orbit: true },
  { id: 'webgpu-compute-birds', path: '/demos/webgpu-compute-birds/index.html', settleMs: 6000, poster: 'webgpu-compute-birds.jpg', hideChrome: true, orbit: true },
  { id: 'webgpu-parallax-uv', path: '/demos/webgpu-parallax-uv/index.html', settleMs: 6000, poster: 'webgpu-parallax-uv.jpg', hideChrome: true, orbit: true },
  { id: 'webgpu-tsl-raging-sea', path: '/demos/webgpu-tsl-raging-sea/index.html', settleMs: 6000, poster: 'webgpu-tsl-raging-sea.jpg', hideChrome: true, orbit: true },
  { id: 'webgpu-tsl-linked-particles', path: '/demos/webgpu-tsl-linked-particles/index.html', settleMs: 8000, poster: 'webgpu-tsl-linked-particles.jpg', hideChrome: true, orbit: true },
  { id: 'webgpu-custom-fog-scattering', path: '/demos/webgpu-custom-fog-scattering/index.html', settleMs: 6000, poster: 'webgpu-custom-fog-scattering.jpg', hideChrome: true, orbit: true },
  { id: 'webgpu-modifier-curve', path: '/demos/webgpu-modifier-curve/index.html', settleMs: 6000, poster: 'webgpu-modifier-curve.jpg', hideChrome: true, orbit: true },
  { id: 'webgpu-particles', path: '/demos/webgpu-particles/index.html', settleMs: 8000, poster: 'webgpu-particles.jpg', hideChrome: true, orbit: true },
  { id: 'buffergeometry-drawrange', path: '/demos/buffergeometry-drawrange/index.html', settleMs: 3000, poster: 'buffergeometry-drawrange.jpg', hideChrome: true, orbit: true },
  { id: 'spline-editor', path: '/demos/spline-editor/index.html', settleMs: 2500, poster: 'spline-editor.jpg', hideChrome: true, orbit: true },
  { id: 'terrain-sandbox', path: '/demos/terrain-sandbox/index.html', settleMs: 3000, poster: 'terrain-sandbox.jpg', hideChrome: true, orbit: true },
  { id: 'procedural-gl', path: '/demos/procedural-gl/index.html', settleMs: 4000, poster: 'procedural-gl.jpg', hideChrome: true },
  { id: 'spout', path: '/demos/spout/index.html', settleMs: 5000, poster: 'spout.jpg', hideChrome: true, orbit: true },
]

async function seedFromPoster(id, posterName) {
  const outDir = join(OUT_ROOT, id)
  await mkdir(outDir, { recursive: true })
  const posterPath = join(POSTER_DIR, posterName)
  if (!existsSync(posterPath)) {
    console.warn(`  no poster for ${id}: ${posterName}`)
    return false
  }
  const { default: sharp } = await import('sharp')
  const jpeg = await sharp(posterPath).jpeg({ quality: 88 }).toBuffer()
  for (const name of ['cover.jpg', 'view-a.jpg', 'view-b.jpg']) {
    await writeFile(join(outDir, name), jpeg)
  }
  return true
}

async function hideChrome(page) {
  await page.evaluate(() => {
    for (const sel of [
      '.lil-gui',
      '.back-link',
      '.hint',
      '#hint',
      '#status',
      '.demo-attribution',
      '#camera-views-panel',
      '.inspector-side-panel',
    ]) {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.setProperty('display', 'none', 'important')
      })
    }
    const kill = /webgpu is required|fell back to webgl|webgpu required/i
    document.querySelectorAll('div,p,span,aside,section,[role="alert"]').forEach((el) => {
      const t = (el.textContent || '').trim()
      if (t.length && t.length < 260 && kill.test(t)) {
        el.style.setProperty('display', 'none', 'important')
      }
    })
  })
}

async function orbitDrag(page, dx = 220, dy = 40, { hold = false } = {}) {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return null
    const r = canvas.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  if (!box) return
  await page.mouse.move(box.x, box.y)
  await page.mouse.down()
  await page.mouse.move(box.x + dx, box.y + dy, { steps: 18 })
  if (!hold) {
    await page.mouse.up()
    await page.waitForTimeout(700)
  } else {
    // Shadertoy-style demos (e.g. Spout) only keep the orbit while iMouse.z > 0.
    await page.waitForTimeout(400)
  }
}

/**
 * Spout resets the camera when the mouse is released (shader default UV).
 * Park the pointer at a canvas UV and keep the button down for the shot.
 */
async function holdSpoutUv(page, uvX, uvY) {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector('#container canvas, canvas')
    if (!canvas) return null
    const r = canvas.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  })
  if (!box) return
  // Match spout pointerPos: GL Y is bottom-up.
  const x = box.x + box.w * uvX
  const y = box.y + box.h * (1 - uvY)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 2, y + 1, { steps: 2 })
  await page.waitForTimeout(400)
}

async function captureTarget(browser, target) {
  const outDir = join(OUT_ROOT, target.id)
  await mkdir(outDir, { recursive: true })
  await seedFromPoster(target.id, target.poster)

  const url = target.path.startsWith('http')
    ? target.path
    : `${baseUrl}${target.path.startsWith('/') ? '' : '/'}${target.path}`

  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
  page.setDefaultTimeout(120000)

  try {
    console.log(`Capturing ${target.id}…`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForTimeout(target.settleMs)

    if (target.hideChrome) await hideChrome(page)

    const shots = ['cover.jpg', 'view-a.jpg', 'view-b.jpg']
    // Spout: hold distinct UVs while shooting — release snaps camera to default.
    const spoutUvs = [
      [0.2, 0.8],
      [0.55, 0.55],
      [0.88, 0.35],
    ]
    for (let i = 0; i < shots.length; i++) {
      if (target.id === 'spout') {
        await holdSpoutUv(page, spoutUvs[i][0], spoutUvs[i][1])
        if (target.hideChrome) await hideChrome(page)
        await page.waitForTimeout(i === 0 ? 800 : 500)
      } else if (i > 0 && target.orbit) {
        await orbitDrag(page, i === 1 ? 240 : -180, i === 1 ? 30 : 70)
        if (target.hideChrome) await hideChrome(page)
      } else if (i > 0 && target.spa) {
        await page.mouse.wheel(0, 400)
        await page.waitForTimeout(600)
      }
      const buf = await page.screenshot({ type: 'jpeg', quality: 88, fullPage: false })
      if (target.id === 'spout') await page.mouse.up()
      await writeFile(join(outDir, shots[i]), buf)
      console.log(`  → ${shots[i]} (${buf.length} bytes)`)
    }
  } catch (err) {
    console.warn(`  capture failed for ${target.id}: ${err.message || err} (poster seed kept)`)
  } finally {
    await page.close()
  }
}

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || 'chrome',
    args: CAPTURE_ARGS,
  })

  try {
    const list = onlyId ? TARGETS.filter((t) => t.id === onlyId) : TARGETS
    if (onlyId && list.length === 0) {
      throw new Error(`Unknown id ${onlyId}`)
    }
    for (const target of list) {
      await captureTarget(browser, target)
    }
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
