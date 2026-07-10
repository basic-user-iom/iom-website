import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://127.0.0.1:4188/demos/ssr-denoise/index.html'

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,WebGPU',
    '--use-angle=vulkan',
    '--ignore-gpu-blocklist',
  ],
})

const page = await browser.newPage()
const logs = []
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`))
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}\n${err.stack}`))

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(20000)

const state = await page.evaluate(() => ({
  fallbackVisible: document.getElementById('fallback')?.classList.contains('is-visible'),
  title: document.getElementById('fallback')?.querySelector('h1')?.textContent,
  msg: document.getElementById('fallback')?.querySelector('p')?.textContent,
  walkTest: typeof window.__walkTest,
  runtimeStatus: document.getElementById('runtime-status')?.textContent,
}))

console.log('STATE', JSON.stringify(state, null, 2))
console.log('INIT LOGS', logs.filter((l) => l.includes('[ssr-init]')).join('\n'))
console.log('LOGS', logs.slice(-10).join('\n'))
await browser.close()
