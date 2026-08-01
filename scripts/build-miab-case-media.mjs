/**
 * Build case-study stage stills for Message in a Bottle.
 * Usage: node scripts/build-miab-case-media.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const POSTERS = join(ROOT, 'public/assets/posters')
const BLOG = join(ROOT, 'public/assets/blog/message-in-a-bottle')
const DEMO_SHOT =
  'C:/Users/Mirjan/.cursor/projects/f-iom-website/assets/c__Users_Mirjan_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-025a3e85-34fe-4ab5-98b0-453eb3e2b63d.png'

const W = 1280
const H = 800

async function main() {
  await mkdir(BLOG, { recursive: true })

  const DEMO_SHOT =
    process.env.MIAB_SHOT ||
    'C:/Users/Mirjan/.cursor/projects/f-iom-website/assets/c__Users_Mirjan_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-025a3e85-34fe-4ab5-98b0-453eb3e2b63d.png'

  // Clean MIAB plate (crop demo HUD), never fft-ocean / ship posters.
  const shotMeta = await sharp(DEMO_SHOT).metadata()
  const crop = {
    left: 0,
    top: Math.round((shotMeta.height || 500) * 0.12),
    width: Math.round((shotMeta.width || 1000) * 0.68),
    height: Math.round((shotMeta.height || 500) * 0.82),
  }
  const master = await sharp(DEMO_SHOT)
    .extract(crop)
    .resize(1600, 1000, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
  await sharp(master).toFile(join(POSTERS, 'message-in-a-bottle.jpg'))
  await sharp(master).webp({ quality: 85 }).toFile(join(POSTERS, 'message-in-a-bottle.webp'))
  await sharp(master)
    .resize(800, 500, { fit: 'cover' })
    .webp({ quality: 82 })
    .toFile(join(POSTERS, 'message-in-a-bottle-400.webp'))

  // 01 brief — open horizon mood
  await sharp(master)
    .resize(W, H, { fit: 'cover', position: 'north' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(join(BLOG, 'brief.jpg'))

  // 02 wire — composition: MIAB ocean + letter panel + sky controls
  const bg = await sharp(master)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .modulate({ brightness: 0.82, saturation: 0.95 })
    .toBuffer()

  const letterW = 460
  const letterH = 580
  const letterSvg = Buffer.from(`<svg width="${letterW}" height="${letterH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#efe4c8"/>
      <stop offset="45%" stop-color="#e2d2ae"/>
      <stop offset="100%" stop-color="#c9b48a"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0.12 0"/>
    </filter>
  </defs>
  <rect width="${letterW}" height="${letterH}" rx="8" fill="url(#paper)"/>
  <rect width="${letterW}" height="${letterH}" rx="8" filter="url(#grain)" opacity="0.55"/>
  <rect x="18" y="18" width="${letterW - 36}" height="${letterH - 36}" rx="4" fill="none" stroke="#8a7348" stroke-opacity="0.25"/>
  <text x="44" y="86" font-family="Georgia, 'Times New Roman', serif" font-size="26" fill="#2a1c0c" fill-opacity="0.72">For you,</text>
  <text x="44" y="150" font-family="Georgia, 'Times New Roman', serif" font-size="17" fill="#2a1c0c" fill-opacity="0.55">The water has been kind today.</text>
  <text x="44" y="182" font-family="Georgia, 'Times New Roman', serif" font-size="17" fill="#2a1c0c" fill-opacity="0.48">Flat light, a long swell, and nothing</text>
  <text x="44" y="214" font-family="Georgia, 'Times New Roman', serif" font-size="17" fill="#2a1c0c" fill-opacity="0.42">on the horizon but more horizon.</text>
  <text x="44" y="270" font-family="Georgia, 'Times New Roman', serif" font-size="17" fill="#2a1c0c" fill-opacity="0.36">I am writing this because it seemed</text>
  <text x="44" y="302" font-family="Georgia, 'Times New Roman', serif" font-size="17" fill="#2a1c0c" fill-opacity="0.3">a waste to think it and let it go.</text>
  <line x1="44" y1="350" x2="390" y2="350" stroke="#2a1c0c" stroke-opacity="0.14" stroke-width="1"/>
  <text x="44" y="500" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-style="italic" fill="#2a1c0c" fill-opacity="0.5">— across the water</text>
</svg>`)

  const panelSvg = Buffer.from(`<svg width="268" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="268" height="300" rx="10" fill="rgba(8,18,28,0.82)" stroke="rgba(200,220,235,0.2)"/>
  <text x="18" y="34" font-family="Georgia, serif" font-size="15" fill="rgba(220,232,240,0.92)">Sea &amp; sky</text>
  <text x="18" y="68" font-family="system-ui,sans-serif" font-size="11" fill="rgba(200,220,230,0.55)">Time of day</text>
  <rect x="18" y="78" width="232" height="4" rx="2" fill="rgba(200,220,235,0.14)"/>
  <rect x="18" y="78" width="148" height="4" rx="2" fill="rgba(212,181,106,0.8)"/>
  <text x="18" y="114" font-family="system-ui,sans-serif" font-size="11" fill="rgba(200,220,230,0.55)">Cloud amount</text>
  <rect x="18" y="124" width="232" height="4" rx="2" fill="rgba(200,220,235,0.14)"/>
  <rect x="18" y="124" width="92" height="4" rx="2" fill="rgba(212,181,106,0.8)"/>
  <text x="18" y="160" font-family="system-ui,sans-serif" font-size="11" fill="rgba(200,220,230,0.55)">Atmospheric haze</text>
  <rect x="18" y="170" width="232" height="4" rx="2" fill="rgba(200,220,235,0.14)"/>
  <rect x="18" y="170" width="78" height="4" rx="2" fill="rgba(212,181,106,0.8)"/>
  <text x="18" y="206" font-family="system-ui,sans-serif" font-size="11" fill="rgba(200,220,230,0.55)">Quality</text>
  <rect x="18" y="220" width="70" height="26" rx="6" fill="rgba(200,220,235,0.1)" stroke="rgba(200,220,235,0.22)"/>
  <text x="34" y="237" font-family="system-ui,sans-serif" font-size="11" fill="rgba(220,232,240,0.75)">High</text>
  <text x="18" y="274" font-family="Georgia, serif" font-size="12" fill="rgba(168,136,74,0.9)">Narrative stays primary</text>
</svg>`)

  const shadow = await sharp({
    create: {
      width: letterW + 48,
      height: letterH + 48,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${letterW + 48}" height="${letterH + 48}"><rect x="18" y="22" width="${letterW}" height="${letterH}" rx="10" fill="black" fill-opacity="0.5"/></svg>`,
        ),
      },
    ])
    .blur(16)
    .png()
    .toBuffer()

  const left = Math.round((W - letterW) / 2) - 90
  const top = Math.round((H - letterH) / 2)
  await sharp(bg)
    .composite([
      { input: shadow, left: left - 6, top: top + 4 },
      { input: letterSvg, left, top },
      { input: panelSvg, left: W - 292, top: Math.round((H - 300) / 2) },
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(join(BLOG, 'wire.jpg'))

  // 03 engineering + 04 final — same clean MIAB plate
  await sharp(master)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(join(BLOG, 'engineering.jpg'))
  await sharp(master)
    .resize(W, H, { fit: 'cover', position: 'south' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(join(BLOG, 'final.jpg'))

  console.log('MIAB case media rebuilt →', BLOG)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
