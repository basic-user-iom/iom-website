/**
 * Capture CRM Demo card poster showing the sandbox UI (not the login screen).
 * Usage: node scripts/capture-crm-demo-poster.mjs [baseUrl]
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const OUT = 'public/assets/posters/crm-demo.jpg'
const WIDTH = 1280
const HEIGHT = 800

async function waitForVite(port, ms = 90000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error('Vite did not become ready')
}

async function main() {
  mkdirSync('public/assets/posters', { recursive: true })
  const port = 5193
  const viteProc = spawn(
    'npx',
    ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: process.cwd(), shell: true, stdio: 'ignore' },
  )
  await waitForVite(port)
  const base = `http://127.0.0.1:${port}`

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'],
  })
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })

  await page.goto(`${base}/crm-demo`, { waitUntil: 'networkidle', timeout: 90000 })

  // If login still appears, force-click demo CTA or hard-navigate again after flag settle.
  const loginCta = page.locator('a[href="/crm-demo"]')
  const demoShell = page.locator('.crm-shell--demo')
  try {
    await demoShell.waitFor({ timeout: 8000 })
  } catch {
    if (await loginCta.count()) {
      await loginCta.first().click()
      await page.waitForURL('**/crm-demo', { timeout: 10000 })
    } else {
      await page.goto(`${base}/crm-demo`, { waitUntil: 'networkidle', timeout: 60000 })
    }
    await demoShell.waitFor({ timeout: 20000 })
  }

  await page.waitForSelector('.crm-lead-list, .crm-list, [class*="lead"]', {
    timeout: 20000,
  })
  // Prefer selecting the hotspot lead for a richer detail pane
  const northwind = page.getByText('Northwind Arcade Labs').first()
  if (await northwind.count()) {
    await northwind.click()
    await page.waitForTimeout(800)
  }

  await page.evaluate(() => {
    const banner = document.querySelector('.crm-demo-banner')
    if (banner instanceof HTMLElement) banner.style.display = 'none'
    const header = document.querySelector('header.site-header, .site-header, header')
    // Keep CRM chrome; hide main marketing header if present for a clean product shot
    if (header instanceof HTMLElement && !header.classList.contains('crm-topbar')) {
      header.style.display = 'none'
    }
  })
  await page.waitForTimeout(600)

  await page.screenshot({ path: OUT, type: 'jpeg', quality: 90 })
  const bytes = readFileSync(OUT)
  console.log('wrote', OUT, bytes.length, 'magic', bytes.slice(0, 3).toString('hex'))
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Poster is not a JPEG')
  // Sanity: file should be larger than a mostly-empty login card crop
  if (bytes.length < 50000) {
    console.warn('Poster unexpectedly small — check capture quality')
  }

  await browser.close()
  viteProc.kill()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
