import { chromium } from 'playwright'

const url = process.argv[2] ?? 'https://iomwebsite.vercel.app/demos/ssr-denoise/'

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
await page.route('**/demos/ssr-denoise/index.html', async (route) => {
  const response = await route.fetch()
  let body = await response.text()
  body = body.replace(
    'init().catch((error) => {',
    'init().catch((error) => { window.__initStack = error?.stack;',
  )
  await route.fulfill({
    response,
    body,
    headers: { ...response.headers(), 'content-type': 'text/html' },
  })
})

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(15000)

const stack = await page.evaluate(() => window.__initStack)
const fallback = await page.evaluate(() => document.getElementById('fallback')?.querySelector('p')?.textContent)

console.log('Fallback:', fallback)
console.log('Stack:\n', stack ?? '(none)')

await browser.close()
