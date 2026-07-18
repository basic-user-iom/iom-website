/**
 * Capture blog screenshots for demo posts (multi-angle camera shots).
 * Usage:
 *   node scripts/capture-blog-demo-shots.mjs [baseUrl] [demoId]
 * Example:
 *   node scripts/capture-blog-demo-shots.mjs http://localhost:5173 volume-lighting
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_ROOT = join(__dirname, '..', 'public', 'assets', 'blog')
const WIDTH = 1280
const HEIGHT = 800
const baseUrl = process.argv[2] ?? 'http://localhost:5173'
const onlyId = process.argv[3] ?? process.env.ONLY ?? 'volume-lighting'

const WEBGPU_ARGS = [
  '--enable-unsafe-webgpu',
  '--enable-features=Vulkan,WebGPU',
  '--use-angle=vulkan',
  '--ignore-gpu-blocklist',
]

/** Car sits near z=-14 after auto-frame; lights on +Z. */
const CAR_TARGET = [0, 1.65, -14]

/** @typedef {{ id: string, path: string, settleMs: number, shots: { name: string, position: number[], target: number[], paganiYaw?: number, showUi?: boolean, captureLook?: { fogIntensity?: number, smokeAmount?: number, exposure?: number } }[] }} BlogDemoTarget */

/** @type {BlogDemoTarget[]} */
const TARGETS = [
  {
    id: 'volume-lighting',
    // Use index.html — Vite SPA fallback serves the React app for directory URLs.
    path: '/demos/volume-lighting/index.html',
    settleMs: 7000,
    shots: [
      {
        name: 'hero',
        position: [10, 4.2, -28],
        target: CAR_TARGET,
        paganiYaw: 0.55,
      },
      {
        name: 'beams',
        position: [2.5, 5.5, 8],
        target: [0, 2.2, -14],
        paganiYaw: -0.35,
      },
      {
        name: 'profile',
        position: [-22, 2.4, -12],
        target: [0, 1.7, -14],
        paganiYaw: 0.15,
      },
      {
        name: 'ui',
        position: [-22, 2.4, -12],
        target: [0, 1.7, -14],
        paganiYaw: 0.15,
        showUi: true,
        captureLook: {
          pauseLights: true,
          fogIntensity: 1.25,
          smokeAmount: 2.1,
          exposure: 2.45,
        },
      },
    ],
  },
]

async function waitForVolumeLightingReady(page) {
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
  await page.waitForFunction(
    () =>
      typeof window.__volumeLightingTest !== 'undefined' &&
      window.__volumeLightingTest.getState().hasPagani,
    { timeout: 120000 },
  )
}

async function hideDemoChrome(page) {
  await page.evaluate(() => {
    const api = window.__volumeLightingTest
    api?.setUiChromeVisible?.(false)

    const selectors = [
      '.back-link',
      '#hint',
      '#status',
      '.demo-attribution',
      '#camera-views-panel',
      '.inspector-side-panel',
      '.tsl-inspector',
      '.renderer-inspector',
      '[class*="inspector"]',
    ]
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.setProperty('display', 'none', 'important')
        el.style.setProperty('visibility', 'hidden', 'important')
        el.style.setProperty('opacity', '0', 'important')
      })
    }

    // Hide Three.js WebGPU inspector chrome injected under body
    document.querySelectorAll('body > div, body > aside, body > button').forEach((el) => {
      if (el.id === 'container' || el.id === 'fallback') return
      const cls = String(el.className || '')
      const id = el.id || ''
      if (
        id === 'hint' ||
        id === 'status' ||
        id === 'camera-views-panel' ||
        cls.includes('attribution') ||
        cls.includes('inspector') ||
        cls.includes('back-link') ||
        el.tagName === 'ASIDE'
      ) {
        el.style.setProperty('display', 'none', 'important')
      }
    })

    const style = document.createElement('style')
    style.textContent = `
      .back-link, #hint, #status, .demo-attribution, #camera-views-panel,
      .inspector-side-panel, body.demo-ui-chrome-hidden #camera-views-panel { display: none !important; }
    `
    document.head.appendChild(style)
  })
}

async function applyShot(page, shot) {
  await page.evaluate((opts) => {
    const api = window.__volumeLightingTest
    if (!api?.setCamera) return false
    return api.setCamera({
      position: opts.position,
      target: opts.target,
      paganiYaw: opts.paganiYaw,
      pauseTurntable: true,
    })
  }, shot)
}

async function prepareUiShot(page, shot) {
  await page.evaluate((look) => {
    const api = window.__volumeLightingTest
    api?.setUiChromeVisible?.(true)
    if (look) api?.setCaptureLook?.(look)
    const panel = document.getElementById('camera-views-panel')
    if (panel) {
      panel.classList.add('is-open')
      panel.querySelector('.panel-header')?.setAttribute('aria-expanded', 'true')
      panel.style.removeProperty('display')
      panel.style.removeProperty('visibility')
      panel.style.removeProperty('opacity')
    }
    for (const sel of ['.back-link', '.demo-attribution', '#status']) {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.display = 'none'
      })
    }
  }, shot.captureLook || null)
}

async function captureDemo(browser, target) {
  const url = `${baseUrl.replace(/\/$/, '')}${target.path}`
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
  page.setDefaultTimeout(120000)
  const outDir = join(OUT_ROOT, target.id)
  await mkdir(outDir, { recursive: true })

  try {
    console.log(`Capturing blog shots for ${target.id} from ${url}…`)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 })
    await waitForVolumeLightingReady(page)
    await page.waitForTimeout(target.settleMs)

    const results = []
    for (const shot of target.shots) {
      await applyShot(page, shot)
      if (shot.showUi) {
        await prepareUiShot(page, shot)
      } else {
        await hideDemoChrome(page)
      }
      await page.waitForTimeout(1500)
      const buffer = await page.screenshot({ type: 'jpeg', quality: 90, fullPage: false })
      const outPath = join(outDir, `${shot.name}.jpg`)
      await writeFile(outPath, buffer)
      console.log(`  → ${outPath} (${buffer.length} bytes)`)
      results.push({ name: shot.name, path: outPath, bytes: buffer.length })
    }

    const hero = results.find((r) => r.name === 'hero')
    if (hero) {
      const coverBuf = await readFile(hero.path)
      const coverPath = join(outDir, 'cover.jpg')
      await writeFile(coverPath, coverBuf)
      console.log(`  → ${coverPath} (copy of hero)`)
    }

    return results
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
    const targets = TARGETS.filter((t) => t.id === onlyId)
    if (targets.length === 0) {
      throw new Error(
        `Unknown demo id "${onlyId}" — valid: ${TARGETS.map((t) => t.id).join(', ')}`,
      )
    }
    for (const target of targets) {
      await captureDemo(browser, target)
    }
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
