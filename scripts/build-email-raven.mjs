/**
 * Build circular email raven logos from scratch (site video).
 * - Last video frame → static PNG + GIF opener (Outlook)
 * - Transparent outside the circle (no black square)
 * - Full-bleed photo in circle (no zoom-out — avoids clipping the ring)
 * - Thin cyan ring inset so top/bottom aren't sliced off
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import ffmpeg from 'ffmpeg-static'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'public', 'assets', 'email')
const video = path.join(root, 'public', 'assets', 'raven_crop.mp4')
const tmp = path.join(dir, '_build')

const SOURCE = 'crop=480:480:187:0,scale=200:200:flags=lanczos'
/** Fill the circle; no zoom-out (that was clipping the ring). */
const ZOOM = 1
const RING = 'rgba(0,229,255,0.45)'
/** Keep stroke inside the canvas so top/bottom aren't sliced off. */
const RING_INSET = 2.5

async function toCircleBadge(inputPathOrBuf, size) {
  const input = Buffer.isBuffer(inputPathOrBuf)
    ? inputPathOrBuf
    : fs.readFileSync(inputPathOrBuf)

  const photoSize = Math.round(size * ZOOM)
  const photo = await sharp(input)
    .resize(photoSize, photoSize, { fit: 'cover' })
    .ensureAlpha()
    .png()
    .toBuffer()

  const canvas = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: photo, gravity: 'centre' }])
    .png()
    .toBuffer()

  const cx = size / 2
  const cy = size / 2
  const clipR = size / 2 - 0.5
  const ringR = size / 2 - RING_INSET

  const maskSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${clipR}" fill="white"/>
    </svg>`,
  )
  const mask = await sharp(maskSvg).png().toBuffer()

  const clipped = await sharp(canvas)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const ringSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="${RING}" stroke-width="1.5"/>
    </svg>`,
  )
  const ring = await sharp(ringSvg).png().toBuffer()

  return sharp(clipped)
    .composite([{ input: ring, blend: 'over' }])
    .png()
    .toBuffer()
}

function cleanTmp() {
  if (fs.existsSync(tmp)) {
    for (const f of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, f))
    fs.rmdirSync(tmp)
  }
}

cleanTmp()
fs.mkdirSync(tmp, { recursive: true })
fs.mkdirSync(dir, { recursive: true })

const lastRaw = path.join(tmp, 'last_raw.png')
execFileSync(
  ffmpeg,
  ['-y', '-sseof', '-0.05', '-i', video, '-vf', SOURCE, '-frames:v', '1', '-update', '1', lastRaw],
  { stdio: 'pipe' },
)

fs.writeFileSync(path.join(dir, 'iom-raven.png'), await toCircleBadge(lastRaw, 160))
fs.writeFileSync(path.join(tmp, '000.png'), await toCircleBadge(lastRaw, 88))

execFileSync(
  ffmpeg,
  ['-y', '-ss', '5', '-i', video, '-t', '2.8', '-vf', `${SOURCE},fps=10`, path.join(tmp, 'raw_%03d.png')],
  { stdio: 'pipe' },
)

const raws = fs
  .readdirSync(tmp)
  .filter((f) => f.startsWith('raw_'))
  .sort()

let i = 1
for (const f of raws) {
  const badge = await toCircleBadge(path.join(tmp, f), 88)
  fs.writeFileSync(path.join(tmp, `${String(i).padStart(3, '0')}.png`), badge)
  i += 1
}

const end = await toCircleBadge(lastRaw, 88)
for (let h = 0; h < 3; h += 1) {
  fs.writeFileSync(path.join(tmp, `${String(i).padStart(3, '0')}.png`), end)
  i += 1
}

for (const f of [...raws, 'last_raw.png']) {
  const p = path.join(tmp, f)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

execFileSync(
  ffmpeg,
  [
    '-y',
    '-framerate',
    '10',
    '-i',
    path.join(tmp, '%03d.png'),
    '-vf',
    'split[s0][s1];[s0]palettegen=max_colors=128:reserve_transparent=1[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:alpha_threshold=128',
    '-loop',
    '0',
    path.join(dir, 'iom-raven.gif'),
  ],
  { stdio: 'pipe' },
)

cleanTmp()

const mark = path.join(dir, 'iom-raven-mark.png')
if (fs.existsSync(mark)) fs.unlinkSync(mark)

console.log('Rebuilt circular raven logos from scratch')
console.log('png', fs.statSync(path.join(dir, 'iom-raven.png')).size)
console.log('gif', fs.statSync(path.join(dir, 'iom-raven.gif')).size)
