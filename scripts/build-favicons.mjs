/**
 * Generate IOM favicons: dark gradient, circular raven portrait, cyan IOM text.
 * Run: node scripts/build-favicons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')
const ravenPath = join(publicDir, 'assets/raven_crop_last_frame.png')

const ACCENT = '#00e5ff'
const BG = '#08080a'

/** @param {number} size */
function roundedBackgroundSvg(size) {
  const rx = Math.round(size * 0.21875)
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e1218"/>
      <stop offset="45%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="#0a1620"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="32%" r="55%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#glow)"/>
</svg>`)
}

/** @param {number} diameter */
async function circularRaven(diameter) {
  const square = await sharp(ravenPath)
    .resize(diameter, diameter, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()

  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}">
      <circle cx="${diameter / 2}" cy="${diameter / 2}" r="${diameter / 2}" fill="white"/>
    </svg>`,
  )

  return sharp(square)
    .composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }])
    .png()
    .toBuffer()
}

/** @param {number} diameter */
function circleRingSvg(diameter) {
  const r = diameter / 2 - 0.5
  const stroke = Math.max(1, diameter * 0.006)
  const glow = Math.max(2, diameter * 0.04)
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}">
  <defs>
    <filter id="g" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${glow}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="${diameter / 2}" cy="${diameter / 2}" r="${r}" fill="none"
    stroke="${ACCENT}" stroke-opacity="0.35" stroke-width="${stroke}" filter="url(#g)"/>
</svg>`)
}

/**
 * @param {number} size
 * @param {{ showText?: boolean }} [opts]
 */
async function composeIcon(size, opts = {}) {
  const showText = opts.showText !== false && size >= 64
  const circleSize = Math.round(size * (showText ? 0.52 : 0.72))
  const circleTop = Math.round(size * (showText ? 0.1 : 0.14))
  const circleLeft = Math.round((size - circleSize) / 2)

  const bg = await sharp(roundedBackgroundSvg(size)).png().toBuffer()
  const raven = await circularRaven(circleSize)
  const ring = await sharp(circleRingSvg(circleSize)).png().toBuffer()

  const layers = [
    { input: raven, left: circleLeft, top: circleTop },
    { input: ring, left: circleLeft, top: circleTop },
  ]

  if (showText) {
    const fontSize = Math.round(size * 0.155)
    const textY = Math.round(size * 0.88)
    const textSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <text x="50%" y="${textY}" text-anchor="middle"
        font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
        font-size="${fontSize}" font-weight="700" letter-spacing="0.06em"
        fill="${ACCENT}">IOM</text>
    </svg>`)
    layers.push({ input: await sharp(textSvg).png().toBuffer(), left: 0, top: 0 })
  }

  return sharp(bg).composite(layers).png().toBuffer()
}

/** @param {number} size */
async function buildFaviconSvg(size) {
  const showText = size >= 64
  const circleSize = Math.round(size * (showText ? 0.52 : 0.72))
  const circleCx = size / 2
  const circleCy = Math.round(size * (showText ? 0.1 : 0.14) + circleSize / 2)
  const rx = Math.round(size * 0.21875)
  const fontSize = Math.round(size * 0.155)
  const textY = Math.round(size * 0.88)

  const thumb = await sharp(ravenPath)
    .resize(circleSize, circleSize, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82 })
    .toBuffer()
  const b64 = thumb.toString('base64')

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size} ${size}" fill="none">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e1218"/>
      <stop offset="45%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="#0a1620"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="32%" r="55%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="raven-clip">
      <circle cx="${circleCx}" cy="${circleCy}" r="${circleSize / 2}"/>
    </clipPath>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#glow)"/>
  <image href="data:image/jpeg;base64,${b64}" x="${circleCx - circleSize / 2}" y="${circleCy - circleSize / 2}"
    width="${circleSize}" height="${circleSize}" clip-path="url(#raven-clip)" preserveAspectRatio="xMidYMid slice"/>
  <circle cx="${circleCx}" cy="${circleCy}" r="${circleSize / 2 - 0.5}" fill="none"
    stroke="${ACCENT}" stroke-opacity="0.35" stroke-width="${Math.max(1, size * 0.006)}"/>
  ${showText ? `<text x="50%" y="${textY}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="0.06em" fill="${ACCENT}">IOM</text>` : ''}
</svg>`
}

async function main() {
  const png512 = await composeIcon(512)
  const png180 = await composeIcon(180)
  const png32 = await composeIcon(32, { showText: false })
  const svg32 = await buildFaviconSvg(32)

  await writeFile(join(publicDir, 'favicon.png'), png512)
  await writeFile(join(publicDir, 'apple-touch-icon.png'), png180)
  await writeFile(join(publicDir, 'favicon-32x32.png'), png32)
  await writeFile(join(publicDir, 'favicon.svg'), svg32)

  console.log('Wrote public/favicon.png (512x512)')
  console.log('Wrote public/apple-touch-icon.png (180x180)')
  console.log('Wrote public/favicon-32x32.png (32x32)')
  console.log('Wrote public/favicon.svg')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
