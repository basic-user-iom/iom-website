import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const modelsDir = path.resolve(__dirname, '../public/models')

function hsl(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const d = max - min
  const luma = 0.2126 * rn + 0.7152 * gn + 0.0722 * bn
  const sat = max === 0 ? 0 : d / max
  let hue = 0
  if (d) {
    if (max === rn) hue = ((gn - bn) / d) % 6
    else if (max === gn) hue = (bn - rn) / d + 2
    else hue = (rn - gn) / d + 4
    hue = hue * 60
    if (hue < 0) hue += 360
  }
  return { hue, sat, luma }
}

const metal = await sharp(path.join(modelsDir, '10986_MT_Harp_MetallicSmoothness.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const albedo = await sharp(path.join(modelsDir, '19236_MT_Harp_AlbedoTransparency.jpg')).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const w = metal.info.width
const h = metal.info.height
const M = metal.data
const A = albedo.data

const buckets = {
  woodish: { n: 0, r: 0, g: 0, b: 0, a: 0, ar: 0, ag: 0, ab: 0 },
  gray: { n: 0, r: 0, g: 0, b: 0, a: 0, ar: 0, ag: 0, ab: 0 },
  dark: { n: 0, r: 0, g: 0, b: 0, a: 0, ar: 0, ag: 0, ab: 0 },
  other: { n: 0, r: 0, g: 0, b: 0, a: 0, ar: 0, ag: 0, ab: 0 },
}

for (let i = 0; i < w * h; i += 8) {
  const ao = i * 3
  const mo = i * 4
  const { hue, sat, luma } = hsl(A[ao], A[ao + 1], A[ao + 2])
  let key = 'other'
  if (luma < 0.06) key = 'dark'
  else if (sat > 0.18 && hue >= 8 && hue <= 60) key = 'woodish'
  else if (sat < 0.14 && luma > 0.2) key = 'gray'
  const b = buckets[key]
  b.n++
  b.r += M[mo]; b.g += M[mo + 1]; b.b += M[mo + 2]; b.a += M[mo + 3]
  b.ar += A[ao]; b.ag += A[ao + 1]; b.ab += A[ao + 2]
}

for (const [k, b] of Object.entries(buckets)) {
  if (!b.n) continue
  console.log(k, 'n', b.n, 'metalRGBA', (b.r/b.n).toFixed(1), (b.g/b.n).toFixed(1), (b.b/b.n).toFixed(1), (b.a/b.n).toFixed(1), 'albedo', (b.ar/b.n).toFixed(1), (b.ag/b.n).toFixed(1), (b.ab/b.n).toFixed(1))
}

// histogram of metallic R on woodish pixels
const hist = new Array(16).fill(0)
const woodR = []
for (let i = 0; i < w * h; i += 4) {
  const ao = i * 3
  const { hue, sat, luma } = hsl(A[ao], A[ao + 1], A[ao + 2])
  if (sat > 0.18 && hue >= 8 && hue <= 60 && luma > 0.06) {
    const r = M[i * 4]
    hist[Math.min(15, Math.floor(r / 16))]++
    if (woodR.length < 20) woodR.push(r)
  }
}
console.log('woodish metallic R histogram (16 bins)', hist)
console.log('sample wood R', woodR)
