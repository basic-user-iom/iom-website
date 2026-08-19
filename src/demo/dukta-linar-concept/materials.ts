import {
  CanvasTexture,
  Color,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'
import type { LinarMaterialId } from './types'

type MaterialLook = {
  color: string
  roughness: number
  edgeColor: string
  edgeStrength: number
  grain: 'fine' | 'linear' | 'open'
  grainContrast: number
}

const LOOKS: Record<LinarMaterialId, MaterialLook> = {
  mdf: {
    color: '#c9a882',
    roughness: 0.84,
    edgeColor: '#b08968',
    edgeStrength: 0.2,
    grain: 'fine',
    grainContrast: 0.04,
  },
  plywood: {
    color: '#e2d3b6',
    roughness: 0.6,
    edgeColor: '#d0b48a',
    edgeStrength: 0.86,
    grain: 'linear',
    grainContrast: 0.12,
  },
  'three-layer-spruce': {
    color: '#d2ab7a',
    roughness: 0.68,
    edgeColor: '#b88858',
    edgeStrength: 0.55,
    grain: 'open',
    grainContrast: 0.15,
  },
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function paintGrain(look: MaterialLook): HTMLCanvasElement {
  const size = look.grain === 'fine' ? 256 : 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = look.color
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
        n = (hash(x * 0.9 + y * 1.7) - 0.5) * contrast
      } else if (look.grain === 'linear') {
        const vein = Math.sin((x / size) * Math.PI * 14 + rowJitter * 0.8)
        n = vein * contrast * 0.55 + (hash(x * 0.2 + y * 3.1) - 0.5) * contrast * 0.4
      } else {
        const vein = Math.sin((x / size) * Math.PI * 9 + y * 0.012 + rowJitter)
        const pore = hash(x * 0.15 + y * 0.4) > 0.92 ? -0.08 : 0
        n = vein * contrast * 0.7 + (hash(x * 0.31 + y * 2.4) - 0.5) * contrast * 0.5 + pore
      }
      data[i] = Math.max(0, Math.min(255, data[i] + n * 255))
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n * 220))
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 180))
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas
}

function makeMap(look: MaterialLook): CanvasTexture {
  const map = new CanvasTexture(paintGrain(look))
  map.colorSpace = SRGBColorSpace
  map.wrapS = RepeatWrapping
  map.wrapT = RepeatWrapping
  map.anisotropy = 4
  map.needsUpdate = true
  return map
}

type EdgeUniforms = {
  uEdgeCol: { value: Color }
  uEdgeStr: { value: number }
}

function attachEdgeHint(material: MeshStandardMaterial, uniforms: EdgeUniforms): void {
  material.userData.linarEdge = uniforms
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uEdgeCol = uniforms.uEdgeCol
    shader.uniforms.uEdgeStr = uniforms.uEdgeStr
    shader.vertexShader = `varying vec3 vLinarObjPos;\nvarying vec3 vLinarObjNormal;\n${shader.vertexShader}`
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
       vLinarObjNormal = objectNormal;`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vLinarObjPos = position;`,
    )
    shader.fragmentShader = `uniform vec3 uEdgeCol;\nuniform float uEdgeStr;\nvarying vec3 vLinarObjPos;\nvarying vec3 vLinarObjNormal;\n${shader.fragmentShader}`
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       float edge = smoothstep(0.38, 0.78, abs(normalize(vLinarObjNormal).x));
       float layer = 0.5 + 0.5 * sin(vLinarObjPos.y * 92.0);
       vec3 layered = mix(uEdgeCol * 0.78, uEdgeCol * 1.08, layer);
       diffuseColor.rgb = mix(diffuseColor.rgb, layered, edge * uEdgeStr);`,
    )
  }
  material.customProgramCacheKey = () => 'linar-edge-v1'
}

export type LinarMaterialSet = {
  slat: MeshStandardMaterial
  connector: MeshStandardMaterial
  solid: MeshStandardMaterial
  apply: (id: LinarMaterialId, immediate?: boolean) => void
  tick: (dt: number) => boolean
  dispose: () => void
}

function darkenBridge(id: LinarMaterialId, color: Color): void {
  color.multiplyScalar(id === 'mdf' ? 0.62 : 0.58)
}

export function createLinarMaterials(): LinarMaterialSet {
  const maps = new Map<LinarMaterialId, Texture>()
  const getMap = (id: LinarMaterialId): Texture => {
    let map = maps.get(id)
    if (!map) {
      map = makeMap(LOOKS[id])
      maps.set(id, map)
    }
    return map
  }

  const slat = new MeshStandardMaterial({
    color: LOOKS.mdf.color,
    map: getMap('mdf'),
    roughness: LOOKS.mdf.roughness,
    metalness: 0,
    envMapIntensity: 0.35,
  })
  slat.name = 'LinarSlat'

  const connector = new MeshStandardMaterial({
    color: LOOKS.mdf.color,
    map: getMap('mdf'),
    roughness: Math.min(1, LOOKS.mdf.roughness + 0.08),
    metalness: 0,
    envMapIntensity: 0.28,
  })
  connector.name = 'LinarConnector'
  darkenBridge('mdf', connector.color)

  const solid = new MeshStandardMaterial({
    color: LOOKS.mdf.color,
    map: getMap('mdf'),
    roughness: LOOKS.mdf.roughness,
    metalness: 0,
    envMapIntensity: 0.35,
  })
  solid.name = 'LinarSolid'

  const slatEdge: EdgeUniforms = {
    uEdgeCol: { value: new Color(LOOKS.mdf.edgeColor) },
    uEdgeStr: { value: LOOKS.mdf.edgeStrength },
  }
  const connectorEdge: EdgeUniforms = {
    uEdgeCol: { value: new Color(LOOKS.mdf.edgeColor) },
    uEdgeStr: { value: LOOKS.mdf.edgeStrength * 0.45 },
  }
  const solidEdge: EdgeUniforms = {
    uEdgeCol: { value: new Color(LOOKS.mdf.edgeColor) },
    uEdgeStr: { value: LOOKS.mdf.edgeStrength },
  }
  attachEdgeHint(slat, slatEdge)
  attachEdgeHint(connector, connectorEdge)
  attachEdgeHint(solid, solidEdge)

  let current: LinarMaterialId = 'mdf'
  let fromColor = new Color(LOOKS.mdf.color)
  let toColor = new Color(LOOKS.mdf.color)
  let fromRough = LOOKS.mdf.roughness
  let toRough = LOOKS.mdf.roughness
  let mix = 1
  let pendingMap: Texture | null = null

  const paintSet = (color: Color, roughness: number, look: MaterialLook, map: Texture | null) => {
    slat.color.copy(color)
    slat.roughness = roughness
    connector.color.copy(color)
    darkenBridge(current, connector.color)
    connector.roughness = Math.min(1, roughness + 0.08)
    solid.color.copy(color)
    solid.roughness = roughness
    if (map) {
      slat.map = map
      connector.map = map
      solid.map = map
      slat.needsUpdate = true
      connector.needsUpdate = true
      solid.needsUpdate = true
    }
    slatEdge.uEdgeCol.value.set(look.edgeColor)
    slatEdge.uEdgeStr.value = look.edgeStrength
    connectorEdge.uEdgeCol.value.set(look.edgeColor)
    connectorEdge.uEdgeStr.value = look.edgeStrength * 0.45
    solidEdge.uEdgeCol.value.set(look.edgeColor)
    solidEdge.uEdgeStr.value = look.edgeStrength
  }

  const apply = (id: LinarMaterialId, immediate = false) => {
    const look = LOOKS[id]
    current = id
    fromColor.copy(slat.color)
    toColor.set(look.color)
    fromRough = slat.roughness
    toRough = look.roughness
    pendingMap = getMap(id)
    mix = immediate ? 1 : 0
    if (immediate) {
      paintSet(toColor, toRough, look, pendingMap)
      pendingMap = null
      mix = 1
    }
  }

  const tick = (dt: number): boolean => {
    if (mix >= 1) return false
    mix = Math.min(1, mix + dt * 4.2)
    slat.color.copy(fromColor).lerp(toColor, mix)
    slat.roughness = fromRough + (toRough - fromRough) * mix
    const look = LOOKS[current]
    const map = mix >= 0.45 ? pendingMap : null
    paintSet(slat.color, slat.roughness, look, map)
    if (mix >= 0.45) pendingMap = null
    return true
  }

  const dispose = () => {
    slat.dispose()
    connector.dispose()
    solid.dispose()
    for (const map of maps.values()) map.dispose()
    maps.clear()
  }

  return { slat, connector, solid, apply, tick, dispose }
}
