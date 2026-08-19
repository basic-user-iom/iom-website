import {
  CanvasTexture,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'
import type { LinarMaterialId } from './types'

type MaterialLook = {
  face: string
  reverse: string
  cut: string
  end: string
  roughness: number
  cutRoughness: number
  grain: 'fine' | 'linear' | 'open'
  grainContrast: number
  plyLayers: number
}

const LOOKS: Record<LinarMaterialId, MaterialLook> = {
  mdf: {
    face: '#d7c4a6',
    reverse: '#cbb89c',
    cut: '#b39472',
    end: '#c4ad8c',
    roughness: 0.9,
    cutRoughness: 0.96,
    grain: 'fine',
    grainContrast: 0.035,
    plyLayers: 0,
  },
  plywood: {
    face: '#ead9bc',
    reverse: '#e0d0b2',
    cut: '#d0ad78',
    end: '#ddc198',
    roughness: 0.68,
    cutRoughness: 0.86,
    grain: 'linear',
    grainContrast: 0.045,
    plyLayers: 7,
  },
  'three-layer-spruce': {
    face: '#dfbd8c',
    reverse: '#d2af7d',
    cut: '#c69561',
    end: '#d2a774',
    roughness: 0.72,
    cutRoughness: 0.84,
    grain: 'open',
    grainContrast: 0.09,
    plyLayers: 3,
  },
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function paintFace(look: MaterialLook, baseColor: string): HTMLCanvasElement {
  const size = look.grain === 'fine' ? 256 : 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, size, size)
  const image = ctx.getImageData(0, 0, size, size)
  const data = image.data
  const contrast = look.grainContrast
  for (let y = 0; y < size; y++) {
    const rowJitter = hash(y * 0.37) * 2 - 1
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      let n = 0
      if (look.grain === 'fine') {
        n = (hash(x * 1.1 + y * 1.4) - 0.5) * contrast
      } else if (look.grain === 'linear') {
        // Grain follows the long axis of the slats. Variation is therefore
        // mostly across x, with subtle longitudinal noise along y.
        const vein = Math.sin((x / size) * Math.PI * 14 + rowJitter * 0.6)
        n = vein * contrast * 0.5 + (hash(x * 0.22 + y * 2.8) - 0.5) * contrast * 0.38
      } else {
        const vein = Math.sin((x / size) * Math.PI * 9 + y * 0.012 + rowJitter)
        const pore = hash(x * 0.18 + y * 0.33) > 0.91 ? -0.07 : 0
        n = vein * contrast * 0.72 + (hash(x * 0.28 + y * 2.1) - 0.5) * contrast * 0.45 + pore
      }
      data[i] = Math.max(0, Math.min(255, data[i] + n * 255))
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n * 215))
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 175))
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function paintEdge(look: MaterialLook, baseColor: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, 64, 256)
  const image = ctx.getImageData(0, 0, 64, 256)
  const data = image.data
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4
      const fibre = Math.sin(y * 0.17 + hash(x * 2.3) * 4) * 0.012
      const dust = (hash(x * 0.61 + y * 1.87) - 0.5) * (look.plyLayers > 0 ? 0.045 : 0.075)
      const n = fibre + dust
      data[i] = Math.max(0, Math.min(255, data[i] + n * 255))
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n * 220))
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 180))
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function makeMap(canvas: HTMLCanvasElement): CanvasTexture {
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  map.wrapS = RepeatWrapping
  map.wrapT = RepeatWrapping
  map.anisotropy = 4
  map.needsUpdate = true
  return map
}

function attachThicknessLayers(
  material: MeshStandardMaterial,
  layers: { value: number },
  mix: { value: number },
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPlyLayers = layers
    shader.uniforms.uPlyMix = mix
    shader.vertexShader = `varying vec3 vLinarObjPos;\nvarying vec3 vLinarObjNormal;\n${shader.vertexShader}`
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>\n vLinarObjNormal = objectNormal;`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n vLinarObjPos = position;`,
    )
    shader.fragmentShader = `uniform float uPlyLayers;\nuniform float uPlyMix;\nvarying vec3 vLinarObjPos;\nvarying vec3 vLinarObjNormal;\n${shader.fragmentShader}`
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       float count = max(uPlyLayers, 1.0);
       float layerPhase = fract((vLinarObjPos.z + 0.5) * count);
       float alternating = 0.5 + 0.5 * sin((vLinarObjPos.z + 0.5) * 6.283185 * count + 0.7);
       float seamDistance = min(layerPhase, 1.0 - layerPhase);
       float seam = smoothstep(0.025, 0.11, seamDistance);
       vec3 ply = diffuseColor.rgb * mix(0.88, 1.06, alternating);
       ply *= mix(0.9, 1.0, seam);
       diffuseColor.rgb = mix(diffuseColor.rgb, ply, uPlyMix);`,
    )
  }
  material.customProgramCacheKey = () => 'linar-ply-layers-v2'
}

export type LinarMaterialSet = {
  face: MeshStandardMaterial
  reverse: MeshStandardMaterial
  cut: MeshStandardMaterial
  end: MeshStandardMaterial
  backing: MeshStandardMaterial
  apply: (id: LinarMaterialId, immediate?: boolean) => void
  tick: (dt: number) => boolean
  dispose: () => void
}

export function createLinarMaterials(): LinarMaterialSet {
  const faceMaps = new Map<LinarMaterialId, Texture>()
  const reverseMaps = new Map<LinarMaterialId, Texture>()
  const edgeMaps = new Map<LinarMaterialId, Texture>()
  const endMaps = new Map<LinarMaterialId, Texture>()
  const getFace = (id: LinarMaterialId) => {
    let map = faceMaps.get(id)
    if (!map) {
      map = makeMap(paintFace(LOOKS[id], LOOKS[id].face))
      map.repeat.set(1.1, 4)
      faceMaps.set(id, map)
    }
    return map
  }
  const getReverse = (id: LinarMaterialId) => {
    let map = reverseMaps.get(id)
    if (!map) {
      map = makeMap(paintFace(LOOKS[id], LOOKS[id].reverse))
      map.repeat.set(1.1, 4)
      map.offset.set(0.19, 0.11)
      reverseMaps.set(id, map)
    }
    return map
  }
  const getEdge = (id: LinarMaterialId) => {
    let map = edgeMaps.get(id)
    if (!map) {
      map = makeMap(paintEdge(LOOKS[id], LOOKS[id].cut))
      map.repeat.set(1, 1)
      edgeMaps.set(id, map)
    }
    return map
  }
  const getEnd = (id: LinarMaterialId) => {
    let map = endMaps.get(id)
    if (!map) {
      map = makeMap(paintEdge(LOOKS[id], LOOKS[id].end))
      map.repeat.set(1, 1)
      endMaps.set(id, map)
    }
    return map
  }

  const face = new MeshStandardMaterial({
    color: 0xffffff,
    map: getFace('plywood'),
    roughness: LOOKS.plywood.roughness,
    metalness: 0,
  })
  face.name = 'LinarFace'
  const reverse = new MeshStandardMaterial({
    color: 0xffffff,
    map: getReverse('plywood'),
    roughness: LOOKS.plywood.roughness + 0.06,
    metalness: 0,
  })
  reverse.name = 'LinarReverse'
  const cut = new MeshStandardMaterial({
    color: 0xffffff,
    map: getEdge('plywood'),
    roughness: LOOKS.plywood.cutRoughness,
    metalness: 0,
  })
  cut.name = 'LinarCut'
  const end = new MeshStandardMaterial({
    color: 0xffffff,
    map: getEnd('plywood'),
    roughness: LOOKS.plywood.cutRoughness,
    metalness: 0,
  })
  end.name = 'LinarEnd'
  const backing = new MeshStandardMaterial({
    color: 0xd8d2c8,
    roughness: 0.95,
    metalness: 0,
  })
  backing.name = 'LinarBacking'

  const plyLayers = { value: LOOKS.plywood.plyLayers }
  const plyMix = { value: LOOKS.plywood.plyLayers > 0 ? 0.48 : 0 }
  attachThicknessLayers(cut, plyLayers, plyMix)
  attachThicknessLayers(end, plyLayers, plyMix)

  let current: LinarMaterialId = 'plywood'
  let mix = 1

  const paintSet = (
    id: LinarMaterialId,
    faceMap: Texture,
    reverseMap: Texture,
    edgeMap: Texture,
    endMap: Texture,
  ) => {
    const look = LOOKS[id]
    face.color.setHex(0xffffff)
    face.roughness = look.roughness
    face.map = faceMap
    reverse.color.setHex(0xffffff)
    reverse.roughness = Math.min(1, look.roughness + 0.06)
    reverse.map = reverseMap
    cut.color.setHex(0xffffff)
    cut.roughness = look.cutRoughness
    cut.map = edgeMap
    end.color.setHex(0xffffff)
    end.roughness = look.cutRoughness
    end.map = endMap
    plyLayers.value = look.plyLayers
    plyMix.value = look.plyLayers > 3 ? 0.48 : look.plyLayers > 0 ? 0.36 : 0
    face.needsUpdate = true
    reverse.needsUpdate = true
    cut.needsUpdate = true
    end.needsUpdate = true
  }

  const apply = (id: LinarMaterialId, immediate = false) => {
    current = id
    mix = immediate ? 1 : 0
    if (immediate) paintSet(id, getFace(id), getReverse(id), getEdge(id), getEnd(id))
  }

  const tick = (dt: number): boolean => {
    if (mix >= 1) return false
    mix = Math.min(1, mix + dt * 5)
    if (mix >= 0.4) {
      paintSet(current, getFace(current), getReverse(current), getEdge(current), getEnd(current))
    }
    return mix < 1
  }

  const dispose = () => {
    face.dispose()
    reverse.dispose()
    cut.dispose()
    end.dispose()
    backing.dispose()
    for (const map of faceMaps.values()) map.dispose()
    for (const map of reverseMaps.values()) map.dispose()
    for (const map of edgeMaps.values()) map.dispose()
    for (const map of endMaps.values()) map.dispose()
    faceMaps.clear()
    reverseMaps.clear()
    edgeMaps.clear()
    endMaps.clear()
  }

  return { face, reverse, cut, end, backing, apply, tick, dispose }
}
