/**
 * Read-only processing of the Unity/Sketchfab harp textures.
 * Copies live in public/models — originals in Downloads/harf are never touched.
 *
 * The metallic-smoothness export is Unity-packed and padding-heavy (R ≈ 1 everywhere,
 * G = 0, A = 1). Wood vs hardware is therefore classified from the albedo atlas.
 * ORM is synthesized: AO from albedo, roughness from the B channel + grain, metalness from the mask.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const modelsDir = path.join(root, 'public', 'models')
const sourceDir = path.join(root, 'source-copies')
const outDir = path.join(modelsDir, 'processed')

const FILES = {
  albedo: '19236_MT_Harp_AlbedoTransparency.jpg',
  metallic: '10986_MT_Harp_MetallicSmoothness.png',
  normalStub: '10982_MT_Harp_Normal.jpg',
}

function hueSatLuma(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  const luma = 0.2126 * rn + 0.7152 * gn + 0.0722 * bn
  const sat = max === 0 ? 0 : d / max
  let hue = 0
  if (d !== 0) {
    if (max === rn) hue = ((gn - bn) / d) % 6
    else if (max === gn) hue = (bn - rn) / d + 2
    else hue = (rn - gn) / d + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  return { hue, sat, luma }
}

function classify(ar, ag, ab) {
  const { hue, sat, luma } = hueSatLuma(ar, ag, ab)
  const woodHue = hue >= 6 && hue <= 62
  if (sat > 0.16 && woodHue && luma > 0.05 && luma < 0.92) return 'wood'
  if (sat < 0.13 && luma > 0.22 && luma < 0.95) return 'metal'
  if (luma >= 0.92 && sat < 0.2) return 'string'
  return 'preserve'
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  const metallicPath = path.join(sourceDir, FILES.metallic)
  const albedoPath = path.join(modelsDir, FILES.albedo)
  const stubPath = path.join(sourceDir, FILES.normalStub)

  const metallicMeta = await sharp(metallicPath).metadata()
  const albedoMeta = await sharp(albedoPath).metadata()
  const stubMeta = await sharp(stubPath).metadata()

  console.log('--- Source texture inspection ---')
  console.log('albedo', albedoMeta.width, 'x', albedoMeta.height, albedoMeta.format)
  console.log('metallicSmoothness', metallicMeta.width, 'x', metallicMeta.height, metallicMeta.format, 'channels', metallicMeta.channels)
  console.log('normal stub', stubMeta.width, 'x', stubMeta.height, '— unusable, generating from albedo')

  const metalRaw = await sharp(metallicPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const albedoRaw = await sharp(albedoPath)
    .resize(metalRaw.info.width, metalRaw.info.height, { kernel: 'lanczos3' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const w = metalRaw.info.width
  const h = metalRaw.info.height
  const metal = metalRaw.data
  const albedo = albedoRaw.data
  const count = w * h

  const orm = Buffer.alloc(count * 4)
  const masks = Buffer.alloc(count * 4)
  const height = Buffer.alloc(count)
  const coverage = { wood: 0, metal: 0, string: 0, preserve: 0 }

  for (let i = 0; i < count; i++) {
    const mo = i * 4
    const ao = i * 3
    const ar = albedo[ao]
    const ag = albedo[ao + 1]
    const ab = albedo[ao + 2]
    const { luma } = hueSatLuma(ar, ag, ab)
    const kind = classify(ar, ag, ab)
    coverage[kind]++

    const bRough = metal[mo + 2] / 255
    let roughness
    let metalness
    if (kind === 'metal') {
      roughness = 0.18 + bRough * 0.22
      metalness = 0.92
    } else if (kind === 'string') {
      roughness = 0.28
      metalness = 0.55
    } else {
      roughness = 0.34 + (1 - luma) * 0.22 + bRough * 0.12
      metalness = 0.02
    }

    const aoVal = Math.round(Math.min(255, luma * 140 + 95))
    orm[mo] = aoVal
    orm[mo + 1] = Math.round(Math.min(255, Math.max(0, roughness * 255)))
    orm[mo + 2] = Math.round(Math.min(255, Math.max(0, metalness * 255)))
    orm[mo + 3] = 255

    masks[mo] = kind === 'wood' ? 255 : 0
    masks[mo + 1] = kind === 'metal' ? 255 : 0
    masks[mo + 2] = kind === 'string' || kind === 'preserve' ? 255 : 0
    masks[mo + 3] = 255

    height[i] = Math.round(luma * 255)
  }

  // The albedo paints whole soundboard panels a flat desaturated grey, which
  // classifies as metal. At metalness ~0.9 a broad flat panel reflects only the
  // dark side of the environment and reads as a black patch, so panels have to
  // go back to wood. Real fittings are small, so a heavy low pass of the metal
  // mask separates them: a panel interior stays near 1, a pin averages to near 0.
  const PANEL_RADIUS = 20
  const PANEL_THRESHOLD = 0.5
  const isMetal = new Uint8Array(count)
  for (let i = 0; i < count; i++) isMetal[i] = masks[i * 4 + 1] ? 1 : 0

  // Summed-area table so local metal density is exact; sharp's blur silently
  // promotes a single-channel raw buffer to three channels.
  const sat = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    for (let x = 0; x < w; x++) {
      rowSum += isMetal[y * w + x]
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + rowSum
    }
  }
  const density = (x, y) => {
    const x0 = Math.max(0, x - PANEL_RADIUS)
    const y0 = Math.max(0, y - PANEL_RADIUS)
    const x1 = Math.min(w - 1, x + PANEL_RADIUS)
    const y1 = Math.min(h - 1, y + PANEL_RADIUS)
    const a = sat[y0 * (w + 1) + x0]
    const b = sat[y0 * (w + 1) + x1 + 1]
    const c = sat[(y1 + 1) * (w + 1) + x0]
    const d = sat[(y1 + 1) * (w + 1) + x1 + 1]
    return (d - b - c + a) / ((x1 - x0 + 1) * (y1 - y0 + 1))
  }

  let panelPixels = 0
  for (let i = 0; i < count; i++) {
    const mo = i * 4
    if (!isMetal[i]) continue
    if (density(i % w, (i / w) | 0) < PANEL_THRESHOLD) continue
    panelPixels++
    masks[mo] = 255
    masks[mo + 1] = 0
    const luma = height[i] / 255
    orm[mo + 1] = Math.round(Math.min(255, (0.34 + (1 - luma) * 0.22) * 255))
    orm[mo + 2] = Math.round(0.02 * 255)
  }
  console.log('grey panels reassigned to wood', `${((panelPixels / count) * 100).toFixed(1)}%`)

  console.log('mask coverage', {
    wood: `${((coverage.wood / count) * 100).toFixed(1)}%`,
    metal: `${((coverage.metal / count) * 100).toFixed(1)}%`,
    string: `${((coverage.string / count) * 100).toFixed(1)}%`,
    preserve: `${((coverage.preserve / count) * 100).toFixed(1)}%`,
  })

  const blurredMasks = await sharp(masks, { raw: { width: w, height: h, channels: 4 } })
    .blur(0.6)
    .raw()
    .toBuffer()

  await sharp(orm, { raw: { width: w, height: h, channels: 4 } })
    .resize(1024, 1024)
    .png({ compressionLevel: 9, effort: 8 })
    .toFile(path.join(outDir, 'harp_orm.png'))

  await sharp(blurredMasks, { raw: { width: w, height: h, channels: 4 } })
    .resize(1024, 1024)
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'harp_masks.png'))

  const normal = Buffer.alloc(count * 4)
  const strength = 1.85
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const left = height[y * w + Math.max(0, x - 1)]
      const right = height[y * w + Math.min(w - 1, x + 1)]
      const up = height[Math.max(0, y - 1) * w + x]
      const down = height[Math.min(h - 1, y + 1) * w + x]
      const dx = (right - left) / 255
      const dy = (down - up) / 255
      let nx = -dx * strength
      let ny = -dy * strength
      let nz = 1
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len
      ny /= len
      nz /= len
      const o = (y * w + x) * 4
      normal[o] = Math.round((nx * 0.5 + 0.5) * 255)
      normal[o + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      normal[o + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      normal[o + 3] = 255
    }
  }

  await sharp(normal, { raw: { width: w, height: h, channels: 4 } })
    .resize(1024, 1024)
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(outDir, 'harp_normal.jpg'))

  const report = {
    sourceCopies: {
      gltf: 'public/models/Unity2Skfb.gltf',
      albedo: FILES.albedo,
      metallicSmoothness: FILES.metallic,
      originalNormalStub: `${stubMeta.width}x${stubMeta.height}`,
    },
    processed: ['harp_orm.png', 'harp_masks.png', 'harp_normal.jpg'],
    dimensions: { width: w, height: h },
    coverage,
    notes: 'Wood/hardware masks derived from albedo. ORM synthesized because Unity packing is not glTF-standard.',
    originalsUntouched: 'C:\\Users\\Mirjan\\Downloads\\harf',
  }
  fs.writeFileSync(path.join(outDir, 'process-report.json'), JSON.stringify(report, null, 2))
  console.log('Wrote processed maps to', outDir)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
