/**
 * Recompress blog stills + build a lean 3D Viewer walkthrough clip.
 * Usage: node scripts/optimize-blog-media.mjs
 */
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import ffmpegPath from 'ffmpeg-static'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const blogRoot = path.join(root, 'public', 'assets', 'blog')
const viewerDir = path.join(blogRoot, '3d-viewer')
const walkthroughOut = path.join(viewerDir, 'walkthrough.webm')
const walkthroughTmp = path.join(viewerDir, 'walkthrough.tmp.webm')
const sourceWebm = path.join(viewerDir, '_source-walkthrough.webm')

const RECORDING_MEDIA =
  'https://iobjectm.com/api/crm-recorder?action=media&slug=0r5s5i2l3m0e'

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited ${code}`))
    })
  })
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status}`)
  await pipeline(res.body, createWriteStream(dest))
}

async function* walkImages(dir) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) yield* walkImages(p)
    else if (/\.jpe?g$/i.test(ent.name) && !ent.name.startsWith('_')) yield p
  }
}

async function optimizeStill(file) {
  const base = path.basename(file).toLowerCase()
  const isCover = base === 'cover.jpg' || base.startsWith('cover-')
  const before = (await stat(file)).size
  // Cards show ~360px CSS; 800px covers 2x screens. Body stills up to 1200.
  const maxWidth = isCover ? 800 : 1200
  const quality = isCover ? 74 : 76
  const tmp = `${file}.opt.jpg`
  const info = await sharp(file)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
    .toFile(tmp)
  const after = (await stat(tmp)).size
  if (after < before * 0.98) {
    await rename(tmp, file)
    return {
      file: path.relative(blogRoot, file),
      before,
      after,
      w: info.width,
      h: info.height,
      saved: before - after,
    }
  }
  await unlink(tmp)
  return null
}

async function optimizeStills() {
  const results = []
  for await (const file of walkImages(blogRoot)) {
    const hit = await optimizeStill(file)
    if (hit) results.push(hit)
  }
  results.sort((a, b) => b.saved - a.saved)
  const saved = results.reduce((n, r) => n + r.saved, 0)
  console.log(
    `Stills: recompressed ${results.length} files, saved ${(saved / 1024 / 1024).toFixed(2)} MB`,
  )
  for (const r of results.slice(0, 12)) {
    console.log(
      `  -${(r.saved / 1024).toFixed(0)}KB  ${(r.before / 1024).toFixed(0)}→${(r.after / 1024).toFixed(0)}KB  ${r.w}x${r.h}  ${r.file}`,
    )
  }
}

async function buildWalkthrough() {
  if (!ffmpegPath) throw new Error('ffmpeg-static path missing')
  await mkdir(viewerDir, { recursive: true })

  let needDownload = true
  try {
    const s = await stat(sourceWebm)
    if (s.size > 1_000_000) needDownload = false
  } catch {
    /* download */
  }
  if (needDownload) {
    console.log('Downloading source walkthrough…')
    await download(RECORDING_MEDIA, sourceWebm)
  }
  const srcSize = (await stat(sourceWebm)).size
  console.log(`Source ${(srcSize / 1024 / 1024).toFixed(2)} MB`)

  // Keep first 45s, 720p, VP9/Opus — preload=none on the page so bytes wait for play.
  console.log('Encoding lean walkthrough (45s / 720p)…')
  await run(ffmpegPath, [
    '-y',
    '-i',
    sourceWebm,
    '-t',
    '45',
    '-vf',
    'scale=-2:720',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '0',
    '-crf',
    '36',
    '-row-mt',
    '1',
    '-an',
    walkthroughTmp,
  ])
  await rename(walkthroughTmp, walkthroughOut)
  const outSize = (await stat(walkthroughOut)).size
  console.log(
    `Walkthrough → ${(outSize / 1024 / 1024).toFixed(2)} MB (${walkthroughOut})`,
  )
  // Keep source for re-runs; ignore failure if locked.
  try {
    await unlink(sourceWebm)
  } catch {
    /* keep */
  }
}

await optimizeStills()
await buildWalkthrough()
console.log('Done.')
