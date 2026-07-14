/**
 * Capture static poster JPGs for experiment embed cards (WebGPU / WebGL demos).
 * Usage: node scripts/capture-experiment-posters.mjs [baseUrl]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'assets', 'posters')
const WIDTH = 1280
const HEIGHT = 800
const baseUrl = process.argv[2] ?? 'https://iobjectm.com'

const TARGETS = [
  { id: 'buffergeometry-drawrange', path: '/demos/buffergeometry-drawrange/', settleMs: 2500 },
  { id: 'webgpu-compute-birds', path: '/demos/webgpu-compute-birds/', settleMs: 6000 },
  { id: 'webgpu-parallax-uv', path: '/demos/webgpu-parallax-uv/', settleMs: 6000 },
  { id: 'webgpu-spotlight', path: '/demos/webgpu-spotlight/', settleMs: 6000 },
  { id: 'webgpu-tsl-raging-sea', path: '/demos/webgpu-tsl-raging-sea/', settleMs: 6000 },
  {
    id: 'webgpu-tsl-linked-particles',
    path: '/demos/webgpu-tsl-linked-particles/index.html',
    settleMs: 8000,
  },
  {
    id: 'webgpu-custom-fog-scattering',
    path: '/demos/webgpu-custom-fog-scattering/',
    settleMs: 6000,
  },
  { id: 'webgpu-particles', path: '/demos/webgpu-particles/', settleMs: 8000 },
  {
    id: 'webgpu-modifier-curve',
    path: '/demos/webgpu-modifier-curve/',
    settleMs: 6000,
  },
  { id: 'spline-editor', path: '/demos/spline-editor/', settleMs: 2000 },
  { id: 'fft-ocean', path: '/demos/fft-ocean/', settleMs: 8000 },
  { id: 'spout', path: '/demos/spout/', settleMs: 5000, hideChrome: true },
  {
    id: 'raven-path',
    path: '/demos/raven-path/index.html',
    settleMs: 5000,
    hideChrome: true,
  },
  { id: 'compute-particles', path: '/demos/compute-particles/', settleMs: 3500 },
  { id: 'volume-lighting', path: '/demos/volume-lighting/', settleMs: 6000, pagani: true },
  { id: 'terrain-sandbox', path: '/demos/terrain-sandbox/', settleMs: 2500 },
  {
    id: 'procedural-gl',
    path: '/demos/procedural-gl/',
    settleMs: 3000,
    iframe: true,
    clip: { x: 0, y: 44, width: WIDTH, height: HEIGHT - 44 },
  },
  {
    id: 'streets-gl',
    path: '/demos/streets-gl/',
    settleMs: 10000,
    iframe: 'streets-gl',
    clip: { x: 0, y: 44, width: WIDTH, height: HEIGHT - 44 },
  },
]

const onlyId = process.argv[3] ?? process.env.ONLY

const WEBGPU_ARGS = [
  '--enable-unsafe-webgpu',
  '--enable-features=Vulkan,WebGPU',
  '--use-angle=vulkan',
  '--ignore-gpu-blocklist',
]

async function waitForCanvas(page) {
  await page.waitForFunction(
    () => {
      const fallback = document.getElementById('fallback')
      const canvas = document.querySelector('#container canvas')
      return (
        canvas instanceof HTMLCanvasElement &&
        canvas.width > 0 &&
        canvas.height > 0 &&
        (!fallback || !fallback.classList.contains('is-visible'))
      )
    },
    { timeout: 60000 },
  )
}

/** WebGPU compute birds — wait for flock simulation frames and visible sky/bird pixels. */
async function waitForWebGPUComputeBirds(page) {
  await waitForCanvas(page)
  await page.waitForFunction(
    () => {
      const status = document.getElementById('status')
      return status?.textContent?.includes('move mouse to disturb')
    },
    { timeout: 120000 },
  )
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('#container canvas')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 16) return false
      const tmp = document.createElement('canvas')
      tmp.width = 1
      tmp.height = 1
      const ctx = tmp.getContext('2d')
      if (!ctx) return false
      const sx = Math.floor(canvas.width * 0.5)
      const sy = Math.floor(canvas.height * 0.38)
      ctx.drawImage(canvas, sx, sy, 1, 1, 0, 0, 1, 1)
      const pixels = ctx.getImageData(0, 0, 1, 1).data
      return pixels[0] + pixels[1] + pixels[2] > 80
    },
    { timeout: 60000 },
  )
}

/** WebGPU fog scattering — wait for forest scene with visible fog pixels. */
async function waitForWebGPUCustomFogScattering(page) {
  await waitForCanvas(page)
  await page.waitForFunction(
    () => {
      const status = document.getElementById('status')
      return status?.textContent?.includes('WASD to walk')
    },
    { timeout: 120000 },
  )
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('#container canvas')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 16) return false
      const tmp = document.createElement('canvas')
      tmp.width = 1
      tmp.height = 1
      const ctx = tmp.getContext('2d')
      if (!ctx) return false
      const sx = Math.floor(canvas.width * 0.5)
      const sy = Math.floor(canvas.height * 0.45)
      ctx.drawImage(canvas, sx, sy, 1, 1, 0, 0, 1, 1)
      const pixels = ctx.getImageData(0, 0, 1, 1).data
      return pixels[0] + pixels[1] + pixels[2] > 120
    },
    { timeout: 60000 },
  )
}

/** WebGPU curve modifier — wait for font load (pixel check skipped: requires WebGPU). */
async function waitForWebGPUModifierCurve(page) {
  await waitForCanvas(page)
  await page.waitForFunction(
    () => {
      const status = document.getElementById('status')
      return status?.textContent?.includes('drag handles to reshape')
    },
    { timeout: 120000 },
  )
}

async function waitForWebGPUParticles(page) {
  await waitForCanvas(page)
  await page.waitForFunction(
    () => {
      const status = document.getElementById('status')
      return status?.textContent?.includes('orbit to explore')
    },
    { timeout: 120000 },
  )
}

/** WebGPU spotlight loads textures + Lucy PLY from threejs.org — wait for lit scene pixels. */
async function waitForWebGPUSpotlight(page) {
  await waitForCanvas(page)
  await page.waitForFunction(
    () => {
      const status = document.getElementById('status')
      return status?.textContent?.includes('orbit to explore')
    },
    { timeout: 120000 },
  )
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('#container canvas')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 16) return false
      const tmp = document.createElement('canvas')
      tmp.width = 1
      tmp.height = 1
      const ctx = tmp.getContext('2d')
      if (!ctx) return false
      const sx = Math.floor(canvas.width * 0.5)
      const sy = Math.floor(canvas.height * 0.42)
      ctx.drawImage(canvas, sx, sy, 1, 1, 0, 0, 1, 1)
      const pixels = ctx.getImageData(0, 0, 1, 1).data
      return pixels[0] + pixels[1] + pixels[2] > 48
    },
    { timeout: 60000 },
  )
}

async function waitForWebGPULinkedParticles(page) {
  await waitForCanvas(page)
  await page.waitForFunction(
    () => {
      const status = document.getElementById('status')
      return status?.textContent?.includes('move pointer to draw')
    },
    { timeout: 120000 },
  )
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('#container canvas')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 16) return false
      const tmp = document.createElement('canvas')
      tmp.width = 1
      tmp.height = 1
      const ctx = tmp.getContext('2d')
      if (!ctx) return false
      const sx = Math.floor(canvas.width * 0.5)
      const sy = Math.floor(canvas.height * 0.5)
      ctx.drawImage(canvas, sx, sy, 1, 1, 0, 0, 1, 1)
      const pixels = ctx.getImageData(0, 0, 1, 1).data
      return pixels[0] + pixels[1] + pixels[2] > 70
    },
    { timeout: 90000 },
  )
}

/** Raven path — large GLB + wing-flap animation; wait for loaded status and lit scene pixels. */
async function waitForRavenPath(page) {
  await waitForCanvas(page)
  await page.waitForFunction(
    () => {
      const status = document.getElementById('status')
      return status?.textContent?.includes('Raven loaded')
    },
    { timeout: 180000 },
  )
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('#container canvas')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 16) return false
      const tmp = document.createElement('canvas')
      tmp.width = 1
      tmp.height = 1
      const ctx = tmp.getContext('2d')
      if (!ctx) return false
      const sx = Math.floor(canvas.width * 0.42)
      const sy = Math.floor(canvas.height * 0.48)
      ctx.drawImage(canvas, sx, sy, 1, 1, 0, 0, 1, 1)
      const pixels = ctx.getImageData(0, 0, 1, 1).data
      return pixels[0] + pixels[1] + pixels[2] > 36
    },
    { timeout: 60000 },
  )
}

async function waitForTerrainSandbox(page) {
  await waitForCanvas(page)
  // Wait until terrain mesh has lit pixels (not just clear color).
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('#container canvas')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 16) return false
      const ctx = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      if (!ctx) return false
      const pixels = new Uint8Array(4)
      ctx.readPixels(
        Math.floor(canvas.width * 0.5),
        Math.floor(canvas.height * 0.45),
        1,
        1,
        ctx.RGBA,
        ctx.UNSIGNED_BYTE,
        pixels,
      )
      const lum = pixels[0] + pixels[1] + pixels[2]
      return lum > 24
    },
    { timeout: 60000 },
  )
}

async function waitForVolumeLightingPagani(page) {
  await waitForCanvas(page)
  await page.waitForFunction(
    () =>
      typeof window.__volumeLightingTest !== 'undefined' &&
      window.__volumeLightingTest.getState().hasPagani,
    { timeout: 120000 },
  )
}

async function waitForMapIframe(page) {
  await page.waitForSelector('#map-frame', { state: 'attached', timeout: 30000 })
  await page.waitForFunction(
    () => {
      const frame = document.getElementById('map-frame')
      return frame instanceof HTMLIFrameElement && frame.clientWidth > 0 && frame.clientHeight > 0
    },
    { timeout: 30000 },
  )
}

/** Streets GL loads slowly — wait for search UI or map canvas inside the cross-origin iframe. */
async function waitForStreetsGlIframe(page) {
  await waitForMapIframe(page)
  const frame = page.frameLocator('#map-frame')
  const searchBar = frame.locator(
    'input[type="search"], input[placeholder*="earch" i], [class*="search" i] input, [data-testid*="search" i]',
  )
  const mapCanvas = frame.locator('canvas')
  await Promise.race([
    searchBar.first().waitFor({ state: 'visible', timeout: 90000 }),
    mapCanvas.first().waitFor({ state: 'visible', timeout: 90000 }),
  ]).catch(() => {
    console.warn('  streets-gl: search bar / canvas not detected — continuing after settle')
  })
}

/** Spout — WebGL2 raymarch; wait until lit scene pixels (not clear color). */
async function waitForSpout(page) {
  await waitForCanvas(page)
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('#container canvas')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 16) return false
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      if (!gl) return false
      const pixels = new Uint8Array(4)
      gl.readPixels(
        Math.floor(canvas.width * 0.42),
        Math.floor(canvas.height * 0.52),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      )
      return pixels[0] + pixels[1] + pixels[2] > 40
    },
    { timeout: 90000 },
  )
}

/** FFT ocean — legacy three.js demo with ship model and skybox cubemap. */
async function waitForFftOcean(page) {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas')
      return canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0
    },
    { timeout: 120000 },
  )
  await page.waitForFunction(
    () => {
      const status = document.getElementById('status')
      return status?.textContent?.includes('orbit to explore')
    },
    { timeout: 120000 },
  )
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 16) return false
      const tmp = document.createElement('canvas')
      tmp.width = 1
      tmp.height = 1
      const ctx = tmp.getContext('2d')
      if (!ctx) return false
      const sx = Math.floor(canvas.width * 0.5)
      const sy = Math.floor(canvas.height * 0.42)
      ctx.drawImage(canvas, sx, sy, 1, 1, 0, 0, 1, 1)
      const pixels = ctx.getImageData(0, 0, 1, 1).data
      return pixels[0] + pixels[1] + pixels[2] > 24
    },
    { timeout: 60000 },
  )
}

async function capturePoster(browser, target) {
  const url = `${baseUrl.replace(/\/$/, '')}${target.path}`
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
  page.setDefaultTimeout(120000)

  try {
    console.log(`Capturing ${target.id} from ${url}…`)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 })

    if (target.iframe === 'streets-gl') {
      await waitForStreetsGlIframe(page)
    } else if (target.iframe) {
      await waitForMapIframe(page)
    } else if (target.id === 'webgpu-compute-birds') {
      await waitForWebGPUComputeBirds(page)
    } else if (target.id === 'webgpu-tsl-linked-particles') {
      await waitForWebGPULinkedParticles(page)
    } else if (target.id === 'webgpu-custom-fog-scattering') {
      await waitForWebGPUCustomFogScattering(page)
    } else if (target.id === 'webgpu-particles') {
      await waitForWebGPUParticles(page)
    } else if (target.id === 'webgpu-modifier-curve') {
      await waitForWebGPUModifierCurve(page)
    } else if (
      target.id === 'webgpu-spotlight' ||
      target.id === 'webgpu-parallax-uv' ||
      target.id === 'webgpu-tsl-raging-sea'
    ) {
      await waitForWebGPUSpotlight(page)
    } else if (target.id === 'raven-path') {
      await waitForRavenPath(page)
    } else if (target.id === 'terrain-sandbox') {
      await waitForTerrainSandbox(page)
    } else if (target.id === 'fft-ocean') {
      await waitForFftOcean(page)
    } else if (target.id === 'spout') {
      await waitForSpout(page)
    } else if (target.pagani) {
      await waitForVolumeLightingPagani(page)
    } else {
      await waitForCanvas(page)
    }

    await page.waitForTimeout(target.settleMs)

    if (target.hideChrome) {
      await page.evaluate(() => {
        for (const sel of ['.lil-gui', '.back-link', '.hint', '#status', '.demo-attribution']) {
          document.querySelectorAll(sel).forEach((el) => {
            el.style.display = 'none'
          })
        }
      })
    }

    const shotOpts = { type: 'jpeg', quality: 85, fullPage: false }
    if (target.clip) shotOpts.clip = target.clip
    return await page.screenshot(shotOpts)
  } finally {
    await page.close()
  }
}

async function main() {
  const { chromium } = await import('playwright')

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || 'chrome',
    args: WEBGPU_ARGS,
  })

  try {
    await mkdir(OUT_DIR, { recursive: true })

    const targets = onlyId ? TARGETS.filter((t) => t.id === onlyId) : TARGETS
    if (onlyId && targets.length === 0) {
      throw new Error(`Unknown poster id "${onlyId}" — valid: ${TARGETS.map((t) => t.id).join(', ')}`)
    }

    for (const target of targets) {
      const buffer = await capturePoster(browser, target)
      const outPath = join(OUT_DIR, `${target.id}.jpg`)
      await writeFile(outPath, buffer)
      console.log(`  → ${outPath} (${buffer.length} bytes)`)
    }
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
