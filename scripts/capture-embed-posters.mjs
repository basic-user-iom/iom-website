/**
 * Capture static poster JPGs for embed project cards.
 * Usage: node scripts/capture-embed-posters.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'assets', 'posters')
const WIDTH = 1280
const HEIGHT = 800

const TARGETS = [
  {
    id: '3d-viewer',
    url: 'https://3dbviewer.com/',
    fallback: { bg: '#0a1018', accent: '#00e5ff', label: '3D Viewer' },
  },
  {
    id: 'iom-three',
    url: 'https://iom-three.vercel.app/',
    fallback: { bg: '#050810', accent: '#3d8bfd', label: 'IOM-Three' },
  },
  {
    id: 'ocean',
    url: 'https://iomwebsite.vercel.app/demos/ocean/',
    fallback: { bg: '#020408', accent: '#1a4a6e', label: 'Three.js Ocean' },
  },
  {
    id: 'ssr-denoise',
    url: 'https://iomwebsite.vercel.app/demos/ssr-denoise/',
    fallback: { bg: '#08060c', accent: '#6b4a8a', label: 'SSR + Denoise' },
  },
]

async function createPlaceholder({ bg, accent, label }) {
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.18"/>
      <stop offset="55%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="#000"/>
    </linearGradient>
    <radialGradient id="r" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="${bg}"/>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#r)"/>
  <text x="50%" y="52%" text-anchor="middle" font-family="system-ui,sans-serif" font-size="72" font-weight="800" fill="${accent}" fill-opacity="0.35" letter-spacing="4">${label}</text>
  <text x="50%" y="62%" text-anchor="middle" font-family="ui-monospace,monospace" font-size="18" fill="#ffffff" fill-opacity="0.25" letter-spacing="6">HOVER TO PREVIEW</text>
</svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer()
}

async function captureWithPlaywright(url) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(2500)
    return await page.screenshot({ type: 'jpeg', quality: 82, fullPage: false })
  } finally {
    await browser.close()
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  let playwrightAvailable = false
  try {
    await import('playwright')
    playwrightAvailable = true
  } catch {
    console.log('playwright not installed — using styled placeholders')
  }

  for (const target of TARGETS) {
    const outPath = join(OUT_DIR, `${target.id}.jpg`)
    let buffer

    if (playwrightAvailable) {
      try {
        console.log(`Capturing ${target.id} from ${target.url}…`)
        buffer = await captureWithPlaywright(target.url)
        console.log(`  ✓ screenshot saved`)
      } catch (err) {
        console.warn(`  ✗ screenshot failed (${err.message}) — placeholder`)
        buffer = await createPlaceholder(target.fallback)
      }
    } else {
      console.log(`Creating placeholder for ${target.id}…`)
      buffer = await createPlaceholder(target.fallback)
    }

    await writeFile(outPath, buffer)
    console.log(`  → ${outPath}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
