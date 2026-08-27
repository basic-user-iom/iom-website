import {
  CanvasTexture,
  DoubleSide,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'
import {
  LINAR_BACKING_COLOURS,
  LINAR_MATERIAL_LOOKS,
  LINAR_VENEER_LOOKS,
  findFeltColour,
  findMdfColour,
  type LinarMaterialLook,
} from './materialData'
import type {
  LinarBacking,
  LinarFeltColourId,
  LinarMaterialId,
  LinarMdfColourId,
  LinarVeneerId,
} from './types'

const LOOKS = LINAR_MATERIAL_LOOKS
const VENEER_LOOKS = LINAR_VENEER_LOOKS
type VeneerId = Exclude<LinarVeneerId, 'none'>

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function smoothNoise(x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = x - x0
  const ty = y - y0
  const sx = tx * tx * (3 - 2 * tx)
  const sy = ty * ty * (3 - 2 * ty)
  const n00 = hash(x0 * 19.19 + y0 * 73.73)
  const n10 = hash((x0 + 1) * 19.19 + y0 * 73.73)
  const n01 = hash(x0 * 19.19 + (y0 + 1) * 73.73)
  const n11 = hash((x0 + 1) * 19.19 + (y0 + 1) * 73.73)
  const nx0 = n00 + (n10 - n00) * sx
  const nx1 = n01 + (n11 - n01) * sx
  return nx0 + (nx1 - nx0) * sy
}

function paintFace(look: LinarMaterialLook, baseColor: string): HTMLCanvasElement {
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
    const along = y / size
    // Slow phase drift keeps the grain continuous along a full slat. The
    // previous per-pixel jitter read as repeated horizontal noise.
    const rowJitter =
      Math.sin(along * Math.PI * 2 * 1.7 + 0.35) * 0.16 +
      Math.sin(along * Math.PI * 2 * 0.43 + 1.1) * 0.08
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const across = x / size
      let n = 0
      if (look.grain === 'fine') {
        const fine = smoothNoise(x * 0.22, y * 0.22) - 0.5
        const broad = smoothNoise(x * 0.035, y * 0.035) - 0.5
        n = fine * contrast * 0.58 + broad * contrast * 0.42
      } else if (look.grain === 'linear') {
        const vein = Math.sin(across * Math.PI * 10 + rowJitter)
        const broad = Math.sin(across * Math.PI * 3.4 + along * 0.24 + 0.7)
        const fibre = smoothNoise(x * 0.085, y * 0.018) - 0.5
        n = vein * contrast * 0.34 + broad * contrast * 0.2 + fibre * contrast * 0.34
      } else {
        const vein = Math.sin(across * Math.PI * 8 + along * 1.8 + rowJitter)
        const broad = Math.sin(across * Math.PI * 3.2 - along * 0.7 + 0.45)
        const fibre = smoothNoise(x * 0.065, y * 0.022) - 0.5
        const pore = smoothNoise(x * 0.34, y * 0.1) > 0.82 ? -0.028 : 0
        n = vein * contrast * 0.46 + broad * contrast * 0.24 + fibre * contrast * 0.34 + pore
      }
      data[i] = Math.max(0, Math.min(255, data[i] + n * 255))
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n * 215))
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 175))
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

type EdgeTextureKind = 'routed' | 'end'

function paintEdge(
  look: LinarMaterialLook,
  baseColor: string,
  kind: EdgeTextureKind,
): HTMLCanvasElement {
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
      // Routed walls expose fibres along the tool path; a sawn panel end has
      // shorter cross-fibre changes. Keeping those responses distinct stops
      // every exposed surface from reading as the same wrapped texture.
      const routedFibre =
        Math.sin(y * 0.038 + hash(Math.floor(x / 5) + 2.3) * 2.2) * 0.008
      const endFibre =
        Math.sin(x * 0.27 + smoothNoise(x * 0.08, y * 0.035) * 3.1) * 0.012
      const fibre = kind === 'routed' ? routedFibre : endFibre
      const dust =
        (smoothNoise(x * 0.24, y * 0.075) - 0.5) *
        (look.plyLayers > 0 ? 0.032 : 0.05)
      const endVariation =
        kind === 'end' ? (smoothNoise(x * 0.085 + 7.1, y * 0.12) - 0.5) * 0.018 : 0
      const n = fibre + dust + endVariation
      data[i] = Math.max(0, Math.min(255, data[i] + n * 255))
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n * 220))
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 180))
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function paintFeltDetail(): HTMLCanvasElement {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = '#e7e6e3'
  ctx.fillRect(0, 0, size, size)
  ctx.globalAlpha = 0.16
  for (let i = 0; i < 780; i += 1) {
    const seed = hash(i * 9.73 + 4.1)
    const x = hash(i * 17.19 + 8.3) * size
    const y = hash(i * 23.47 + 1.7) * size
    const length = 1.2 + seed * 4.2
    const angle = (hash(i * 31.17 + 2.9) - 0.5) * 1.25
    ctx.strokeStyle = seed > 0.52 ? '#ffffff' : '#5f5d59'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  return canvas
}

function paintMicroDetail(): HTMLCanvasElement {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const image = ctx.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4
      const fibre = Math.sin(y * 0.31 + smoothNoise(x * 0.08, y * 0.04) * 2.2)
      const dust = smoothNoise(x * 0.42, y * 0.42) - 0.5
      const value = Math.max(214, Math.min(252, 238 + fibre * 5 + dust * 17))
      image.data[index] = value
      image.data[index + 1] = value
      image.data[index + 2] = value
      image.data[index + 3] = 255
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
  map.anisotropy = 8
  map.needsUpdate = true
  return map
}

function makeDetailMap(canvas: HTMLCanvasElement): CanvasTexture {
  const map = new CanvasTexture(canvas)
  // Data maps intentionally retain Three.js' default linear/no-colour-space
  // interpretation. Only albedo maps created by `makeMap` use sRGB.
  map.wrapS = RepeatWrapping
  map.wrapT = RepeatWrapping
  map.repeat.set(5, 12)
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

/**
 * Reused instanced geometry otherwise samples the exact same texture pixels on
 * every slat and bridge. A stable instance-id phase breaks that repetition
 * without using the animated instance matrix, so the grain stays attached to
 * each manufactured element while the panel bends. Non-instanced solid bands
 * keep their continuous UVs.
 */
function attachInstanceGrainPhase(
  material: MeshStandardMaterial,
  sAmplitude: number,
  tAmplitude: number,
  salt: number,
): void {
  const previousCompile = material.onBeforeCompile
  const previousCacheKey = material.customProgramCacheKey()
  const s = sAmplitude.toFixed(4)
  const t = tAmplitude.toFixed(4)
  const shaderSalt = salt.toFixed(4)

  material.onBeforeCompile = (shader, renderer) => {
    previousCompile.call(material, shader, renderer)
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
       #if defined( USE_INSTANCING ) && defined( USE_MAP )
         float linarInstanceSeed = float( gl_InstanceID ) + 1.0 + ${shaderSalt};
         vec2 linarInstancePhase = fract(
           sin(vec2(linarInstanceSeed * 12.9898, linarInstanceSeed * 78.233)) * 43758.5453
         );
         vMapUv += (linarInstancePhase - 0.5) * vec2(${s}, ${t});
       #endif`,
    )
  }
  material.customProgramCacheKey = () =>
    `${previousCacheKey}|linar-instance-grain-v1:${s}:${t}:${shaderSalt}`
}

export type LinarMaterialSet = {
  face: MeshStandardMaterial
  reverse: MeshStandardMaterial
  cut: MeshStandardMaterial
  bridgeCut: MeshStandardMaterial
  end: MeshStandardMaterial
  backing: MeshStandardMaterial
  apply: (
    id: LinarMaterialId,
    veneer: LinarVeneerId,
    mdfColour: LinarMdfColourId,
    immediate?: boolean,
  ) => void
  applyBacking: (backing: LinarBacking, feltColour: LinarFeltColourId) => void
  prewarm: (id: LinarMaterialId, veneer: LinarVeneerId) => void
  tick: (dt: number) => boolean
  dispose: () => void
}

export function createLinarMaterials(): LinarMaterialSet {
  const microDetailMap = makeDetailMap(paintMicroDetail())
  const faceMaps = new Map<LinarMaterialId, Texture>()
  const reverseMaps = new Map<LinarMaterialId, Texture>()
  const edgeMaps = new Map<LinarMaterialId, Texture>()
  const endMaps = new Map<LinarMaterialId, Texture>()
  const veneerFaceMaps = new Map<VeneerId, Texture>()
  const veneerReverseMaps = new Map<VeneerId, Texture>()
  const getFace = (id: LinarMaterialId) => {
    let map = faceMaps.get(id)
    if (!map) {
      map = makeMap(paintFace(LOOKS[id], LOOKS[id].face))
      // A single procedural sample spans each complete lamella. Avoiding a
      // longitudinal repeat also avoids a visible join in close-up views.
      map.repeat.set(1, 1)
      faceMaps.set(id, map)
    }
    return map
  }
  const getReverse = (id: LinarMaterialId) => {
    let map = reverseMaps.get(id)
    if (!map) {
      map = makeMap(paintFace(LOOKS[id], LOOKS[id].reverse))
      map.repeat.set(1, 1)
      map.offset.set(0.19, 0.11)
      reverseMaps.set(id, map)
    }
    return map
  }
  const getEdge = (id: LinarMaterialId) => {
    let map = edgeMaps.get(id)
    if (!map) {
      map = makeMap(paintEdge(LOOKS[id], LOOKS[id].cut, 'routed'))
      map.repeat.set(1, 1)
      edgeMaps.set(id, map)
    }
    return map
  }
  const getEnd = (id: LinarMaterialId) => {
    let map = endMaps.get(id)
    if (!map) {
      map = makeMap(paintEdge(LOOKS[id], LOOKS[id].end, 'end'))
      map.repeat.set(1, 1)
      endMaps.set(id, map)
    }
    return map
  }
  const getVeneerFace = (id: VeneerId) => {
    let map = veneerFaceMaps.get(id)
    if (!map) {
      const look = VENEER_LOOKS[id]
      map = makeMap(paintFace(look, look.face))
      map.repeat.set(1, 1)
      veneerFaceMaps.set(id, map)
    }
    return map
  }
  const getVeneerReverse = (id: VeneerId) => {
    let map = veneerReverseMaps.get(id)
    if (!map) {
      const look = VENEER_LOOKS[id]
      map = makeMap(paintFace(look, look.reverse))
      map.repeat.set(1, 1)
      map.offset.set(0.19, 0.11)
      veneerReverseMaps.set(id, map)
    }
    return map
  }

  const face = new MeshStandardMaterial({
    color: 0xffffff,
    map: getFace('plywood'),
    roughness: LOOKS.plywood.roughness,
    roughnessMap: microDetailMap,
    bumpMap: microDetailMap,
    bumpScale: LOOKS.plywood.faceBumpScale,
    metalness: 0,
  })
  face.name = 'LinarFace'
  const reverse = new MeshStandardMaterial({
    color: 0xffffff,
    map: getReverse('plywood'),
    roughness: LOOKS.plywood.roughness + 0.06,
    roughnessMap: microDetailMap,
    bumpMap: microDetailMap,
    bumpScale: LOOKS.plywood.faceBumpScale * 0.85,
    metalness: 0,
    // The rear patterned layer is intentionally represented as a two-sided,
    // zero-thickness surface until its physical thickness is confirmed.
    side: DoubleSide,
  })
  reverse.name = 'LinarReverse'
  const cut = new MeshStandardMaterial({
    color: 0xffffff,
    map: getEdge('plywood'),
    roughness: LOOKS.plywood.cutRoughness,
    roughnessMap: microDetailMap,
    bumpMap: microDetailMap,
    bumpScale: LOOKS.plywood.cutBumpScale,
    metalness: 0,
  })
  cut.name = 'LinarCut'
  const bridgeCut = new MeshStandardMaterial({
    color: 0xffffff,
    map: getEdge('plywood'),
    roughness: LOOKS.plywood.cutRoughness,
    roughnessMap: microDetailMap,
    bumpMap: microDetailMap,
    bumpScale: LOOKS.plywood.cutBumpScale * 1.08,
    metalness: 0,
  })
  bridgeCut.name = 'LinarBridgeCut'
  const end = new MeshStandardMaterial({
    color: 0xffffff,
    map: getEnd('plywood'),
    roughness: LOOKS.plywood.cutRoughness,
    roughnessMap: microDetailMap,
    bumpMap: microDetailMap,
    bumpScale: LOOKS.plywood.cutBumpScale * 1.12,
    metalness: 0,
  })
  end.name = 'LinarEnd'
  const backing = new MeshStandardMaterial({
    color: LINAR_BACKING_COLOURS['acoustic-fleece'],
    map: makeMap(paintFeltDetail()),
    roughness: 0.98,
    metalness: 0,
    side: DoubleSide,
  })
  if (backing.map) backing.map.repeat.set(9, 28)
  backing.name = 'LinarBacking'

  const plyLayers = { value: LOOKS.plywood.plyLayers }
  const plyMix = { value: LOOKS.plywood.plyLayers > 0 ? 0.48 : 0 }
  const bridgePlyMix = { value: LOOKS.plywood.plyLayers > 0 ? 0.31 : 0 }
  attachThicknessLayers(cut, plyLayers, plyMix)
  attachThicknessLayers(bridgeCut, plyLayers, bridgePlyMix)
  attachThicknessLayers(end, plyLayers, plyMix)
  // Face grain shifts only across its width so no longitudinal repeat seam is
  // moved into view. Routed and end surfaces receive a smaller two-axis phase.
  attachInstanceGrainPhase(face, 0.78, 0, 0.17)
  attachInstanceGrainPhase(reverse, 0.78, 0, 7.31)
  attachInstanceGrainPhase(cut, 0.42, 0.28, 13.19)
  attachInstanceGrainPhase(bridgeCut, 0.58, 0.36, 19.73)
  attachInstanceGrainPhase(end, 0.36, 0.24, 29.11)

  let currentMaterial: LinarMaterialId = 'plywood'
  let currentVeneer: LinarVeneerId = 'none'
  let currentMdfColour: LinarMdfColourId = 'reference-01'
  let mix = 1
  let needsPaint = false

  const paintSet = (
    id: LinarMaterialId,
    veneer: LinarVeneerId,
    mdfColour: LinarMdfColourId,
    faceMap: Texture,
    reverseMap: Texture,
    edgeMap: Texture,
    endMap: Texture,
  ) => {
    const look = LOOKS[id]
    const surfaceLook = veneer === 'none' ? look : VENEER_LOOKS[veneer]
    const mdfSwatch = findMdfColour(mdfColour).swatch
    face.color.set(veneer === 'none' && id === 'mdf' ? mdfSwatch : '#ffffff')
    face.roughness = surfaceLook.roughness
    face.bumpScale = surfaceLook.faceBumpScale
    face.map = faceMap
    reverse.color.set(veneer === 'none' && id === 'mdf' ? mdfSwatch : '#ffffff')
    if (veneer === 'none' && id === 'mdf') reverse.color.multiplyScalar(0.93)
    reverse.roughness = Math.min(1, surfaceLook.roughness + 0.06)
    reverse.bumpScale = surfaceLook.faceBumpScale * 0.85
    reverse.map = reverseMap
    cut.color.set(id === 'mdf' ? mdfSwatch : '#ffffff')
    if (id === 'mdf') cut.color.multiplyScalar(0.88)
    cut.roughness = look.cutRoughness
    cut.bumpScale = look.cutBumpScale
    cut.map = edgeMap
    bridgeCut.color.set(id === 'mdf' ? mdfSwatch : '#ffffff')
    if (id === 'mdf') bridgeCut.color.multiplyScalar(0.84)
    else bridgeCut.color.setRGB(1.035, 1.025, 1.01)
    bridgeCut.roughness = look.cutRoughness
    bridgeCut.bumpScale = look.cutBumpScale * 1.08
    bridgeCut.map = edgeMap
    end.color.set(id === 'mdf' ? mdfSwatch : '#ffffff')
    if (id === 'mdf') end.color.multiplyScalar(0.9)
    end.roughness = look.cutRoughness
    end.bumpScale = look.cutBumpScale * 1.12
    end.map = endMap
    plyLayers.value = look.plyLayers
    plyMix.value = look.plyLayers > 3 ? 0.48 : look.plyLayers > 0 ? 0.36 : 0
    bridgePlyMix.value = look.plyLayers > 3 ? 0.31 : look.plyLayers > 0 ? 0.28 : 0
  }

  const apply = (
    id: LinarMaterialId,
    veneer: LinarVeneerId,
    mdfColour: LinarMdfColourId,
    immediate = false,
  ) => {
    currentMaterial = id
    currentVeneer = veneer
    currentMdfColour = mdfColour
    mix = immediate ? 1 : 0
    needsPaint = !immediate
    if (immediate) {
      const faceMap = veneer === 'none' ? getFace(id) : getVeneerFace(veneer)
      const reverseMap = veneer === 'none' ? getReverse(id) : getVeneerReverse(veneer)
      paintSet(id, veneer, mdfColour, faceMap, reverseMap, getEdge(id), getEnd(id))
    }
  }

  const tick = (dt: number): boolean => {
    if (mix >= 1) return false
    mix = Math.min(1, mix + dt * 5)
    if (needsPaint && mix >= 0.4) {
      const faceMap =
        currentVeneer === 'none'
          ? getFace(currentMaterial)
          : getVeneerFace(currentVeneer)
      const reverseMap =
        currentVeneer === 'none'
          ? getReverse(currentMaterial)
          : getVeneerReverse(currentVeneer)
      paintSet(
        currentMaterial,
        currentVeneer,
        currentMdfColour,
        faceMap,
        reverseMap,
        getEdge(currentMaterial),
        getEnd(currentMaterial),
      )
      needsPaint = false
    }
    return mix < 1
  }

  const applyBacking = (backingId: LinarBacking, feltColour: LinarFeltColourId) => {
    const colour =
      backingId === 'felt'
        ? findFeltColour(feltColour).swatch
        : backingId === 'none'
          ? LINAR_BACKING_COLOURS['acoustic-fleece']
          : LINAR_BACKING_COLOURS[backingId]
    backing.color.set(colour)
  }

  const prewarm = (id: LinarMaterialId, veneer: LinarVeneerId) => {
    if (veneer === 'none') {
      getFace(id)
      getReverse(id)
    } else {
      getVeneerFace(veneer)
      getVeneerReverse(veneer)
    }
    getEdge(id)
    getEnd(id)
  }

  const dispose = () => {
    face.dispose()
    reverse.dispose()
    cut.dispose()
    bridgeCut.dispose()
    end.dispose()
    backing.dispose()
    backing.map?.dispose()
    microDetailMap.dispose()
    for (const map of faceMaps.values()) map.dispose()
    for (const map of reverseMaps.values()) map.dispose()
    for (const map of edgeMaps.values()) map.dispose()
    for (const map of endMaps.values()) map.dispose()
    for (const map of veneerFaceMaps.values()) map.dispose()
    for (const map of veneerReverseMaps.values()) map.dispose()
    faceMaps.clear()
    reverseMaps.clear()
    edgeMaps.clear()
    endMaps.clear()
    veneerFaceMaps.clear()
    veneerReverseMaps.clear()
  }

  return {
    face,
    reverse,
    cut,
    bridgeCut,
    end,
    backing,
    apply,
    applyBacking,
    prewarm,
    tick,
    dispose,
  }
}
