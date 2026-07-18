/**
 * Capture blog shots from the 4 Black Witness guided-tour steps.
 * Waits for the "Step N" UI label, then extra settle so effect layers
 * (particles / spout / birds) have time to paint after enable.
 *
 * Prefers production (reliable WebGPU) but accepts a local base URL arg.
 *
 * Usage:
 *   node scripts/capture-panorama-tour-steps.mjs
 *   node scripts/capture-panorama-tour-steps.mjs http://localhost:5177
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'assets', 'blog')
const BASE = (process.argv[2] ?? 'https://iobjectm.com').replace(/\/$/, '')
const DEMO = `${BASE}/demos/panorama-360/`

/** Extra settle after Step N label — effects enable during camera, then need GPU warm-up. */
const SETTLE_BY_STEP = {
  1: 2200,
  2: 6500, // particles
  3: 5500, // particles + spout
  4: 2500, // birds — keep short so Step 4 label stays on screen
}

async function hideNoise(page) {
  await page.evaluate(() => {
    const kill = /webgpu is required|fell back to webgl|webgpu required/i
    document.querySelectorAll('div,p,span,aside,section,[role="alert"]').forEach((el) => {
      const t = (el.textContent || '').trim()
      if (t.length && t.length < 260 && kill.test(t)) {
        el.style.setProperty('display', 'none', 'important')
      }
    })
  })
}

async function waitForStep(page, n, timeoutMs = 60000) {
  await page.waitForFunction(
    (step) => {
      const text = document.body?.innerText || ''
      return new RegExp(`Step\\s*${step}\\b`, 'i').test(text)
    },
    n,
    { timeout: timeoutMs },
  )

  // Step 4: capture as soon as birds mount while the Step label is still up.
  if (n === 4) {
    await page
      .waitForFunction(() => {
        const text = document.body?.innerText || ''
        const onStep = /Step\s*4\b/i.test(text)
        const birds = !!document.querySelector('.panorama-360-birds-overlay')
        return onStep && birds
      }, { timeout: 15000 })
      .catch(() => {})
    await page.waitForTimeout(SETTLE_BY_STEP[4])
  } else {
    await page.waitForTimeout(SETTLE_BY_STEP[n] ?? 2500)
  }
  await hideNoise(page)
}

async function main() {
  const { chromium } = await import('playwright')
  // Keep WebGPU on so particles/birds can paint. Spout is WebGL either way.
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: [
      '--enable-features=Vulkan,WebGPU',
      '--ignore-gpu-blocklist',
      '--enable-webgpu-developer-features',
    ],
  })

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const shots = []

  try {
    await page.goto(`${DEMO}?mode=preview`, { waitUntil: 'networkidle', timeout: 120000 })
    await page.waitForTimeout(8000)
    await hideNoise(page)

    await page.getByRole('button', { name: /play guided tour/i }).first().click({ timeout: 15000 })
    console.log('tour started @', DEMO)

    for (let n = 1; n <= 4; n++) {
      await waitForStep(page, n)
      const label = await page.evaluate(() => {
        const m = (document.body.innerText || '').match(/Step\s*\d+[^\n]{0,40}/i)
        return m?.[0] ?? '?'
      })
      const effectHint = await page.evaluate(() => {
        const birds = !!document.querySelector('.panorama-360-birds-overlay')
        const particles = !!document.querySelector('.panorama-360-particles-overlay')
        const spout = !!document.querySelector('.panorama-360-spout-overlay')
        return { birds, particles, spout }
      })
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 })
      shots.push(buf)
      console.log(`  captured ${label.trim()} → ${buf.length} bytes`, JSON.stringify(effectHint))
    }
  } finally {
    await page.close()
    await browser.close()
  }

  if (shots.length !== 4 || shots.some((b) => b.length < 20000)) {
    throw new Error('Expected 4 visible walkthrough screenshots')
  }

  const raw = join(OUT, '_panorama-tour-steps')
  await mkdir(raw, { recursive: true })
  for (let i = 0; i < 4; i++) {
    await writeFile(join(raw, `step-${i + 1}.jpg`), shots[i])
  }

  // Blog: cover / view-a / view-b / view-c = steps 1–4 (effects visible on 2–4)
  const files = ['cover.jpg', 'view-a.jpg', 'view-b.jpg', 'view-c.jpg']
  for (const id of ['panorama-360-tour', 'panorama-suite']) {
    const dir = join(OUT, id)
    await mkdir(dir, { recursive: true })
    for (let i = 0; i < 4; i++) {
      await writeFile(join(dir, files[i]), shots[i])
      console.log(`wrote ${id}/${files[i]} (${shots[i].length})`)
    }
  }

  console.log('done — 4 walkthrough positions saved with effect settle')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
