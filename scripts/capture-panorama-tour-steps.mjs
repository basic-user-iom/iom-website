/**
 * Capture blog shots from the 4 Black Witness guided-tour steps on production.
 * Waits for the "Step N" UI label so frames match the walkthrough exactly.
 *
 * Usage: node scripts/capture-panorama-tour-steps.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'assets', 'blog')
const BASE = 'https://iobjectm.com/demos/panorama-360/'

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

async function waitForStep(page, n, timeoutMs = 45000) {
  await page.waitForFunction(
    (step) => {
      const text = document.body?.innerText || ''
      return new RegExp(`Step\\s*${step}\\b`, 'i').test(text)
    },
    n,
    { timeout: timeoutMs },
  )
  // Let camera + popup settle after the label flips
  await page.waitForTimeout(1800)
  await hideNoise(page)
}

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--disable-features=WebGPU,Vulkan', '--ignore-gpu-blocklist'],
  })

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const shots = []

  try {
    await page.goto(`${BASE}?mode=preview`, { waitUntil: 'networkidle', timeout: 120000 })
    await page.waitForTimeout(8000)
    await hideNoise(page)

    await page.getByRole('button', { name: /play guided tour/i }).first().click({ timeout: 15000 })
    console.log('tour started')

    for (let n = 1; n <= 4; n++) {
      await waitForStep(page, n)
      const label = await page.evaluate(() => {
        const m = (document.body.innerText || '').match(/Step\s*\d+[^\n]{0,40}/i)
        return m?.[0] ?? '?'
      })
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 })
      shots.push(buf)
      console.log(`  captured ${label.trim()} → ${buf.length} bytes`)
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

  // Blog: cover / view-a / view-b / view-c = steps 1–4
  const files = ['cover.jpg', 'view-a.jpg', 'view-b.jpg', 'view-c.jpg']
  for (const id of ['panorama-360-tour', 'panorama-suite']) {
    const dir = join(OUT, id)
    await mkdir(dir, { recursive: true })
    for (let i = 0; i < 4; i++) {
      await writeFile(join(dir, files[i]), shots[i])
      console.log(`wrote ${id}/${files[i]} (${shots[i].length})`)
    }
  }

  console.log('done — 4 walkthrough positions saved')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
