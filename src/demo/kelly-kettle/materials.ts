import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'
import { COLORS } from './constants'

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

/** Vertical brushed grain: streaks run along kettle height. */
function brushedCanvas(size = 128): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = '#8a8a8a'
  ctx.fillRect(0, 0, size, size)
  const image = ctx.getImageData(0, 0, size, size)
  const data = image.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const streak = (hash(x * 0.55) - 0.5) * 18
      const jitter = (hash(x * 1.7 + y * 0.08) - 0.5) * 5
      const v = 142 + streak + jitter
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

/** Pale axial fibres for a simple untreated dowel. Grain runs along V (cylinder length). */
function woodCanvas(size = 128): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const image = ctx.createImageData(size, size)
  const data = image.data
  for (let y = 0; y < size; y++) {
    const fibre = (hash(y * 0.37) - 0.5) * 10
    const band = Math.sin(y * 0.11 + hash(y * 0.04) * 1.4) * 5
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const pore = hash(x * 2.1 + y * 0.9) > 0.93 ? -9 : 0
      const dent = hash(x * 0.08 + y * 0.05) > 0.97 ? -7 : 0
      const n = fibre + band + pore + dent + (hash(x * 0.6 + y) - 0.5) * 3
      data[i] = 226 + n * 0.35
      data[i + 1] = 210 + n * 0.28
      data[i + 2] = 180 + n * 0.18
      data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function woodBumpCanvas(size = 128): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const image = ctx.createImageData(size, size)
  const data = image.data
  for (let y = 0; y < size; y++) {
    const ridge = Math.sin(y * 0.55) * 18 + (hash(y * 0.2) - 0.5) * 14
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const speckle = (hash(x * 3.1 + y * 1.7) - 0.5) * 22
      const dent = hash(x * 0.09 + y * 0.07) > 0.96 ? -40 : 0
      const v = 148 + ridge + speckle + dent
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function sootCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const g = ctx.createLinearGradient(0, 0, 0, 64)
  g.addColorStop(0, '#1a1614')
  g.addColorStop(0.18, '#2e2824')
  g.addColorStop(0.5, '#3a342e')
  g.addColorStop(0.82, '#2a2420')
  g.addColorStop(1, '#161210')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 8, 64)
  return canvas
}

export type KettleMaterials = {
  steel: MeshStandardMaterial
  steelBase: MeshStandardMaterial
  steelSmooth: MeshStandardMaterial
  steelSatin: MeshStandardMaterial
  chimneyInner: MeshStandardMaterial
  water: MeshStandardMaterial
  whistle: MeshStandardMaterial
  whistleDark: MeshStandardMaterial
  wood: MeshStandardMaterial
  textures: Texture[]
  dispose: () => void
}

export function createKettleMaterials(): KettleMaterials {
  const brush = new CanvasTexture(brushedCanvas())
  brush.wrapS = RepeatWrapping
  brush.wrapT = RepeatWrapping
  brush.repeat.set(6, 1)
  brush.anisotropy = 4

  const woodMap = new CanvasTexture(woodCanvas())
  woodMap.wrapS = RepeatWrapping
  woodMap.wrapT = RepeatWrapping
  woodMap.repeat.set(1, 2)
  woodMap.colorSpace = SRGBColorSpace
  const woodBump = new CanvasTexture(woodBumpCanvas())
  woodBump.wrapS = RepeatWrapping
  woodBump.wrapT = RepeatWrapping
  woodBump.repeat.set(1, 2)

  const soot = new CanvasTexture(sootCanvas())
  soot.colorSpace = SRGBColorSpace
  soot.wrapS = RepeatWrapping
  soot.wrapT = RepeatWrapping

  const steel = new MeshStandardMaterial({
    color: COLORS.steel,
    metalness: 0.97,
    roughness: 0.48,
    roughnessMap: brush,
    envMapIntensity: 0.18,
  })

  const steelBase = new MeshStandardMaterial({
    color: COLORS.steelBase,
    metalness: 0.94,
    roughness: 0.56,
    roughnessMap: brush,
    envMapIntensity: 0.16,
  })

  const steelSmooth = new MeshStandardMaterial({
    color: COLORS.steel,
    metalness: 0.98,
    roughness: 0.32,
    envMapIntensity: 0.22,
  })

  const steelSatin = new MeshStandardMaterial({
    color: 0xc5c9cc,
    metalness: 0.92,
    roughness: 0.4,
    envMapIntensity: 0.18,
  })

  const chimneyInner = new MeshStandardMaterial({
    color: 0x4a453e,
    map: soot,
    metalness: 0.18,
    roughness: 0.88,
    side: DoubleSide,
    envMapIntensity: 0.1,
    emissive: new Color(0x2a1208),
    emissiveIntensity: 0,
  })

  const water = new MeshStandardMaterial({
    color: COLORS.water,
    metalness: 0.04,
    roughness: 0.18,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    side: DoubleSide,
    envMapIntensity: 0.25,
  })

  const whistle = new MeshStandardMaterial({
    color: new Color(0x3ea84a),
    metalness: 0,
    roughness: 0.86,
    envMapIntensity: 0.05,
    transparent: false,
    opacity: 1,
    depthWrite: true,
  })

  const whistleDark = new MeshStandardMaterial({
    color: new Color(COLORS.whistleDark),
    metalness: 0.08,
    roughness: 0.7,
    envMapIntensity: 0.1,
  })

  const wood = new MeshStandardMaterial({
    color: COLORS.wood,
    map: woodMap,
    bumpMap: woodBump,
    bumpScale: 0.0004,
    metalness: 0,
    roughness: 0.84,
    envMapIntensity: 0.03,
  })

  const textures = [brush, soot, woodMap, woodBump]

  return {
    steel,
    steelBase,
    steelSmooth,
    steelSatin,
    chimneyInner,
    water,
    whistle,
    whistleDark,
    wood,
    textures,
    dispose: () => {
      steel.dispose()
      steelBase.dispose()
      steelSmooth.dispose()
      steelSatin.dispose()
      chimneyInner.dispose()
      water.dispose()
      whistle.dispose()
      whistleDark.dispose()
      wood.dispose()
      for (const tex of textures) tex.dispose()
    },
  }
}
