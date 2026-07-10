import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localHtml = readFileSync(join(__dirname, '../public/demos/ssr-denoise/index.html'), 'utf8')
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
  await route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: localHtml,
  })
})

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(15000)

const state = await page.evaluate(() => ({
  fallback: document.getElementById('fallback')?.classList.contains('is-visible'),
  msg: document.getElementById('fallback')?.querySelector('p')?.textContent,
  walkTest: typeof window.__walkTest,
}))

console.log(state)
await browser.close()
