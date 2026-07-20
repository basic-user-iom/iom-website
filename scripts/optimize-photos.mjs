/**
 * Convert photography gallery PNGs → WebP and rewrite projects.ts paths.
 *
 * Card thumbs + lightbox share the same files; 1280px WebP is plenty for both
 * and cuts ~139 MB of PNG down to a few MB.
 *
 * Run: node scripts/optimize-photos.mjs
 */
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const photosRoot = join(root, 'public/assets/photos')
const projectsPath = join(root, 'src/data/projects.ts')

const MAX_WIDTH = 1280
const WEBP_QUALITY = 78

async function walkPngs(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await walkPngs(path, out)
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) out.push(path)
  }
  return out
}

async function main() {
  const pngs = await walkPngs(photosRoot)
  if (pngs.length === 0) {
    console.log('optimize-photos: no PNGs found')
    return
  }

  let saved = 0
  let before = 0
  let after = 0

  for (const pngPath of pngs) {
    const input = await readFile(pngPath)
    before += input.length

    const webpPath = pngPath.replace(/\.png$/i, '.webp')
    const buffer = await sharp(input)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toBuffer()

    await writeFile(webpPath, buffer)
    await unlink(pngPath)

    after += buffer.length
    saved += 1
    const rel = relative(photosRoot, pngPath).replace(/\\/g, '/')
    console.log(
      `${rel} → webp  ${(input.length / 1e6).toFixed(2)}→${(buffer.length / 1e6).toFixed(2)} MB`,
    )
  }

  let projects = await readFile(projectsPath, 'utf8')
  const next = projects.replace(/(\/assets\/photos\/[^'"]+)\.png/g, '$1.webp')
  if (next !== projects) {
    await writeFile(projectsPath, next)
    console.log('optimize-photos: updated src/data/projects.ts paths')
  }

  console.log(
    `optimize-photos: ${saved} files · ${(before / 1e6).toFixed(1)}→${(after / 1e6).toFixed(1)} MB` +
      ` (−${(((before - after) / before) * 100).toFixed(0)}%)`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
