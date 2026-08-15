import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { BASE_R, CHIMNEY_BOT_R, CHIMNEY_TOP_R, COLORS, KETTLE_H, MAX_EMBER_PARTICLES, SEAT_Y, WALL } from './constants'
import { collectGeometriesAndMaterials, disposeTracked } from './dispose'

export type FireHandle = {
  fuel: Group
  flames: Group
  light: PointLight
  chimneyLight: PointLight
  update: (
    fire: number,
    dt: number,
    reducedMotion: boolean,
    cameraPos: Vector3,
    opts: { emberIntensity: number; chimneyFlameHeight: number; mobile: boolean; cutaway?: number },
  ) => void
  dispose: () => void
}

function rnd(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function noiseMap() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const image = ctx.createImageData(size, size)
    for (let i = 0; i < size * size; i++) {
      const n = Math.floor(rnd(i * 0.31 + 2.7) * 255)
      const o = i * 4
      image.data[o] = n
      image.data[o + 1] = n
      image.data[o + 2] = n
      image.data[o + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
  }
  const map = new CanvasTexture(canvas)
  map.wrapS = RepeatWrapping
  map.wrapT = RepeatWrapping
  return map
}

function canvasMap(size: number, paint: (data: Uint8ClampedArray, size: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const image = ctx.createImageData(size, size)
    paint(image.data, size)
    ctx.putImageData(image, 0, 0)
  }
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  map.wrapS = RepeatWrapping
  map.wrapT = RepeatWrapping
  return map
}

function barkMap() {
  return canvasMap(128, (data, size) => {
    for (let y = 0; y < size; y++) {
      const ridge = Math.sin(y * 0.41) * 10 + (rnd(y * 0.17) - 0.5) * 16
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        const furrow = Math.sin(x * 0.9 + rnd(x * 0.08) * 2) * 14
        const flake = rnd(x * 1.9 + y * 0.7) > 0.88 ? -18 : 0
        const n = ridge + furrow + flake + (rnd(x * 0.4 + y * 1.1) - 0.5) * 8
        data[i] = 86 + n * 0.7
        data[i + 1] = 58 + n * 0.45
        data[i + 2] = 36 + n * 0.28
        data[i + 3] = 255
      }
    }
  })
}

function splitWoodMap() {
  return canvasMap(128, (data, size) => {
    for (let y = 0; y < size; y++) {
      const fibre = (rnd(y * 0.33) - 0.5) * 14
      const ring = Math.sin(y * 0.19 + rnd(y * 0.05) * 1.2) * 8
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        const pore = rnd(x * 2.2 + y * 0.8) > 0.94 ? -12 : 0
        const n = fibre + ring + pore + (rnd(x * 0.55 + y) - 0.5) * 5
        data[i] = 148 + n * 0.55
        data[i + 1] = 108 + n * 0.4
        data[i + 2] = 68 + n * 0.22
        data[i + 3] = 255
      }
    }
  })
}

function endGrainMap() {
  return canvasMap(64, (data, size) => {
    const cx = size * 0.48
    const cy = size * 0.52
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        const dx = x - cx
        const dy = y - cy
        const d = Math.hypot(dx, dy)
        const ring = Math.sin(d * 0.85 + rnd(d * 0.2) * 0.8) * 16
        const pith = Math.max(0, 8 - d)
        data[i] = 150 + ring * 0.4 - pith
        data[i + 1] = 112 + ring * 0.28 - pith * 0.6
        data[i + 2] = 72 + ring * 0.12
        data[i + 3] = 255
      }
    }
  })
}

function makeStickGeometry(seed: number, radial: number, rows: number) {
  const top = 0.7 + rnd(seed + 0.2) * 0.32
  const bot = 0.76 + rnd(seed + 0.41) * 0.3
  const geo = new CylinderGeometry(top, bot, 1, radial, rows)
  const pos = geo.attributes.position
  const bend = (rnd(seed + 2.1) - 0.5) * 0.18
  const twist = (rnd(seed + 3.4) - 0.5) * 0.12
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i)
    let y = pos.getY(i)
    let z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r > 1e-5) {
      const ang = Math.atan2(z, x)
      const lump = 1 + (rnd(seed * 11.7 + ang * 4.8 + y * 8.6) - 0.5) * 0.3
      const waist = 1 - 0.1 * Math.sin((y + 0.5) * Math.PI)
      x *= lump * waist
      z *= lump * waist
    }
    const t = y + 0.5
    x += bend * t * t
    z += twist * t * (1 - t)
    if (y > 0.44) {
      x += (rnd(seed + i * 0.19) - 0.5) * 0.1
      z += (rnd(seed + i * 0.27) - 0.5) * 0.1
      y -= rnd(seed + i * 0.13) * 0.045
    }
    if (y < -0.44) {
      x += (rnd(seed + i * 0.41) - 0.5) * 0.07
      z += (rnd(seed + i * 0.53) - 0.5) * 0.07
    }
    pos.setXYZ(i, x, y, z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

function flameMaterial(map: CanvasTexture, chimney = false) {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uNoise: { value: map },
      uNarrow: { value: chimney ? 0.22 : 0.0 },
      uChimney: { value: chimney ? 1.0 : 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uNarrow;
      uniform float uChimney;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        float n = texture2D(uNoise, vec2(uv.x * 1.7, uv.y * 0.85 - uTime * 0.52)).r;
        float n2 = texture2D(uNoise, vec2(uv.x * 2.6 + 0.18, uv.y * 1.35 - uTime * 0.27)).r;
        float nTip = texture2D(uNoise, vec2(uv.x * 4.2 + uTime * 0.11, uv.y * 2.4 - uTime * 0.78)).r;
        float nLift = texture2D(uNoise, vec2(uv.x * 6.0, uv.y * 0.55 - uTime * 1.05)).r;
        float edge = mix(0.16, 0.28, uNarrow);
        float wobble = (n - 0.5) * 0.2;
        float shape = smoothstep(edge, edge + 0.12, uv.x + wobble) * smoothstep(1.0 - edge, 0.72 - uNarrow * 0.12, uv.x + wobble);
        float height = pow(max(0.0, 1.0 - uv.y), 0.42) * (0.38 + 0.62 * n) * (0.45 + 0.55 * n2);
        if (uChimney > 0.5) {
          float cx = uv.x - 0.5 + wobble * 0.18;
          float halfW = mix(0.38, 0.07, pow(uv.y, 1.15)) * (0.72 + 0.4 * n);
          shape = smoothstep(halfW + 0.1, halfW * 0.35, abs(cx));
          float tip = 0.58 + nTip * 0.34 + nLift * 0.16;
          float fade = 1.0 - smoothstep(tip - 0.28, tip, uv.y);
          float tongues = mix(1.0, 0.2 + n2 * 0.95, smoothstep(0.4, 0.82, uv.y));
          height = pow(max(0.0, 1.0 - uv.y), 1.15) * (0.28 + 0.72 * n) * fade * tongues;
        }
        float flame = shape * height;
        vec3 col = mix(vec3(1.0, 0.94, 0.52), vec3(1.0, 0.36, 0.05), uv.y);
        col = mix(col, vec3(0.48, 0.05, 0.0), smoothstep(0.48, 1.0, uv.y + n * 0.12));
        float alpha = flame * uOpacity;
        if (alpha < 0.04) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  })
}

export function createFuelAndFire(quality: 'high' | 'mobile'): FireHandle {
  const barkTex = barkMap()
  const splitTex = splitWoodMap()
  const endTex = endGrainMap()
  const bark = new MeshStandardMaterial({
    map: barkTex,
    color: 0xc4a078,
    roughness: 0.92,
    metalness: 0,
  })
  const splitWood = new MeshStandardMaterial({
    map: splitTex,
    color: 0xe2c090,
    roughness: 0.78,
    metalness: 0,
  })
  const char = new MeshStandardMaterial({
    color: 0x1c1612,
    roughness: 0.96,
    metalness: 0,
    emissive: new Color(0x4a1408),
    emissiveIntensity: 0,
  })
  const endGrain = new MeshStandardMaterial({
    map: endTex,
    color: 0xd8b07a,
    roughness: 0.82,
    metalness: 0,
  })
  const emberHot = new MeshStandardMaterial({
    color: 0x1a0804,
    roughness: 0.62,
    metalness: 0,
    emissive: new Color(0xff4a12),
    emissiveIntensity: 0.8,
  })
  const emberCoreMat = new MeshStandardMaterial({
    color: 0x120604,
    roughness: 0.7,
    metalness: 0,
    emissive: new Color(0xff2208),
    emissiveIntensity: 0.55,
  })
  const hotspot = new MeshStandardMaterial({
    color: 0x2a1208,
    roughness: 0.5,
    metalness: 0,
    emissive: new Color(0xffe08a),
    emissiveIntensity: 0.4,
  })

  const fuel = new Group()
  fuel.name = 'fuel_group'
  const twigsGroup = new Group()
  twigsGroup.name = 'fuel_twigs'
  const emberGroup = new Group()
  emberGroup.name = 'ember_core'
  fuel.add(twigsGroup, emberGroup)

  const panInnerR = BASE_R * 0.855 - 0.01
  const floorY = 0.0065
  const maxR = panInnerR * 0.72
  const endA = new Vector3()
  const endB = new Vector3()
  const radial = quality === 'high' ? 11 : 8
  const rows = quality === 'high' ? 6 : 4
  const capGeo = new CircleGeometry(1, radial)

  const containInPan = (mesh: Mesh, halfLocalY: number, radius: number) => {
    mesh.updateMatrix()
    endA.set(0, -halfLocalY, 0).applyMatrix4(mesh.matrix)
    endB.set(0, halfLocalY, 0).applyMatrix4(mesh.matrix)
    const minY = Math.min(endA.y, endB.y) - radius
    if (minY < floorY) mesh.position.y += floorY - minY
    mesh.updateMatrix()
    endA.set(0, -halfLocalY, 0).applyMatrix4(mesh.matrix)
    endB.set(0, halfLocalY, 0).applyMatrix4(mesh.matrix)
    const pad = panInnerR - radius
    for (const point of [endA, endB]) {
      const r = Math.hypot(point.x, point.z)
      if (r > pad) {
        const extra = r - pad
        mesh.position.x -= (point.x / r) * extra
        mesh.position.z -= (point.z / r) * extra
      }
    }
    mesh.updateMatrix()
    endA.set(0, -halfLocalY, 0).applyMatrix4(mesh.matrix)
    endB.set(0, halfLocalY, 0).applyMatrix4(mesh.matrix)
    const minY2 = Math.min(endA.y, endB.y) - radius
    if (minY2 < floorY) mesh.position.y += floorY - minY2
  }

  const addCap = (stick: Mesh, y: number, mat: MeshStandardMaterial, scale = 0.96) => {
    const cap = new Mesh(capGeo, mat)
    cap.rotation.x = y > 0 ? -Math.PI / 2 : Math.PI / 2
    cap.position.y = y
    cap.scale.setScalar(scale)
    stick.add(cap)
  }

  type StickKind = 'split' | 'round' | 'chunk' | 'twig'
  const recipe: { kind: StickKind; count: number }[] =
    quality === 'high'
      ? [
          { kind: 'split', count: 7 },
          { kind: 'round', count: 6 },
          { kind: 'chunk', count: 5 },
          { kind: 'twig', count: 9 },
        ]
      : [
          { kind: 'split', count: 5 },
          { kind: 'round', count: 4 },
          { kind: 'chunk', count: 3 },
          { kind: 'twig', count: 6 },
        ]

  let stickIndex = 0
  for (const batch of recipe) {
    for (let k = 0; k < batch.count; k++) {
      const i = stickIndex++
      const kind = batch.kind
      const charred = kind === 'chunk' || (kind === 'split' && k % 3 === 2) || (kind === 'round' && k % 4 === 0)
      const bodyMat = charred ? char : kind === 'split' ? splitWood : bark
      const stick = new Mesh(makeStickGeometry(i + 3.7, radial, rows), bodyMat)
      let len = 0.022
      let radX = 0.0024
      let radZ = 0.0024
      let tilt = 0.85
      let ring = 0.4
      const theta = (k / batch.count) * Math.PI * 2 + rnd(i + 4) * 0.38 + (kind === 'twig' ? 0.22 : 0)
      if (kind === 'split') {
        len = 0.03 + rnd(i + 3) * 0.016
        radX = 0.0036 + rnd(i + 9) * 0.0018
        radZ = radX * (0.42 + rnd(i + 11) * 0.16)
        tilt = 1.12 + rnd(i + 2) * 0.26
        ring = (0.38 + rnd(i + 1) * 0.4) * Math.max(0.01, maxR - len * 0.28)
      } else if (kind === 'round') {
        len = 0.024 + rnd(i + 3) * 0.014
        radX = 0.0026 + rnd(i + 9) * 0.0014
        radZ = radX * (0.78 + rnd(i + 12) * 0.18)
        tilt = 0.72 + rnd(i + 2) * 0.4
        ring = (0.22 + rnd(i + 1) * 0.5) * Math.max(0.01, maxR - len * 0.32)
      } else if (kind === 'chunk') {
        len = 0.011 + rnd(i + 3) * 0.009
        radX = 0.0034 + rnd(i + 9) * 0.0018
        radZ = radX * (0.7 + rnd(i + 8) * 0.25)
        tilt = 0.55 + rnd(i + 2) * 0.7
        ring = (0.08 + rnd(i + 1) * 0.32) * maxR * 0.7
      } else {
        len = 0.018 + rnd(i + 3) * 0.02
        radX = 0.0012 + rnd(i + 9) * 0.0011
        radZ = radX * (0.82 + rnd(i + 6) * 0.2)
        tilt = 0.48 + rnd(i + 2) * 0.55
        ring = (0.18 + rnd(i + 1) * 0.58) * Math.max(0.008, maxR - len * 0.3)
      }
      stick.scale.set(radX, len, radZ)
      stick.position.set(Math.cos(theta) * ring, floorY + Math.max(radX, radZ) + 0.002, Math.sin(theta) * ring)
      stick.rotation.set(tilt, theta + rnd(i + 1) * 0.55 + (kind === 'split' ? 0.35 : 0), (rnd(i + 5) - 0.5) * 0.45)
      stick.castShadow = false
      containInPan(stick, 0.5, Math.max(radX, radZ))
      addCap(stick, 0.48, charred ? emberHot : endGrain, charred ? 0.78 : 0.94)
      addCap(stick, -0.48, charred ? char : endGrain, 0.9)
      if (kind === 'twig' && k % 3 === 0) {
        const fork = new Mesh(makeStickGeometry(i + 40, Math.max(6, radial - 3), 3), bark)
        fork.scale.set(0.52, 0.38, 0.52)
        fork.position.set(0.12, 0.08, 0)
        fork.rotation.z = 0.62 + rnd(i + 7) * 0.35
        stick.add(fork)
      }
      twigsGroup.add(stick)
    }
  }

  const emberCores: { mesh: Mesh; phase: number; kind: 'core' | 'crack' | 'spot'; rest: Vector3 }[] = []
  for (let i = 0; i < 10; i++) {
    const size = 0.0028 + rnd(i + 8) * 0.0016
    const core = new Mesh(new SphereGeometry(size, 8, 6), emberCoreMat)
    const ring = (0.1 + Math.pow(rnd(i + 11), 0.7) * 0.82) * maxR * 0.72
    const theta = rnd(i + 15) * Math.PI * 2
    core.position.set(Math.cos(theta) * ring, floorY + size + 0.001, Math.sin(theta) * ring)
    containInPan(core, 0, size)
    emberGroup.add(core)
    emberCores.push({ mesh: core, phase: rnd(i + 19) * 6, kind: 'core', rest: core.scale.clone() })
  }
  for (let i = 0; i < 6; i++) {
    const crackLen = 0.007 + rnd(i) * 0.004
    const crack = new Mesh(new CylinderGeometry(0.0004, 0.0006, 1, 5), emberHot)
    crack.scale.set(1, crackLen, 1)
    const ring = (0.16 + Math.pow(rnd(i + 21), 0.65) * 0.7) * maxR * 0.65
    const theta = rnd(i + 23) * Math.PI * 2
    crack.position.set(Math.cos(theta) * ring, 0.012, Math.sin(theta) * ring)
    crack.rotation.set(0.7, rnd(i + 25) * 6, 0.25)
    containInPan(crack, 0.5, 0.0007)
    emberGroup.add(crack)
    emberCores.push({ mesh: crack, phase: rnd(i + 27) * 6, kind: 'crack', rest: crack.scale.clone() })
  }
  for (let i = 0; i < 4; i++) {
    const spot = new Mesh(new SphereGeometry(0.0012, 6, 4), hotspot)
    const ring = (0.12 + Math.pow(rnd(i + 31), 0.7) * 0.75) * maxR * 0.58
    const theta = rnd(i + 33) * Math.PI * 2
    spot.position.set(Math.cos(theta) * ring, floorY + 0.0024, Math.sin(theta) * ring)
    containInPan(spot, 0, 0.0012)
    emberGroup.add(spot)
    emberCores.push({ mesh: spot, phase: rnd(i + 35) * 6, kind: 'spot', rest: spot.scale.clone() })
  }

  const noise = noiseMap()
  const baseFlameMat = flameMaterial(noise)
  const chimneyFlameMat = flameMaterial(noise, true)

  const flames = new Group()
  flames.name = 'flame_group'
  const baseGroup = new Group()
  baseGroup.name = 'base_flames'
  const chimneyGroup = new Group()
  chimneyGroup.name = 'chimney_flame'
  flames.add(baseGroup, chimneyGroup)

  const baseCards: Mesh[] = []
  const baseCount = quality === 'high' ? 4 : 3
  for (let i = 0; i < baseCount; i++) {
    const h = 0.022 + rnd(i + 4) * 0.016
    const card = new Mesh(new PlaneGeometry(0.014 + rnd(i) * 0.008, h), baseFlameMat)
    card.position.set((i - 1.4) * 0.008, 0.016 + h * 0.35, ((i % 2) - 0.5) * 0.008)
    card.rotation.y = i * 0.7
    baseGroup.add(card)
    baseCards.push(card)
  }

  const chimneyCards: Mesh[] = []
  const chimCount = quality === 'high' ? 3 : 2
  const chimH = 0.138
  const chimMul = [1, 0.86, 1.12]
  for (let i = 0; i < chimCount; i++) {
    const h = chimH * chimMul[i]
    const card = new Mesh(new PlaneGeometry(0.024 + (i % 2) * 0.006, h), chimneyFlameMat)
    card.rotation.y = i === 0 ? 0.12 : (Math.PI * i) / chimCount
    card.position.set((i - 1) * 0.002, 0.018 + h * 0.42, ((i % 2) - 0.5) * 0.002)
    chimneyGroup.add(card)
    chimneyCards.push(card)
  }

  const sparkGeo = new SphereGeometry(0.0007, 5, 4)
  const sparkMat = new MeshBasicMaterial({
    color: COLORS.flame,
    transparent: true,
    toneMapped: false,
    opacity: 0,
    depthWrite: false,
  })
  const sparkCount = quality === 'high' ? MAX_EMBER_PARTICLES : 10
  const sparks = new InstancedMesh(sparkGeo, sparkMat, sparkCount)
  sparks.name = 'ember_sparks'
  sparks.instanceMatrix.setUsage(DynamicDrawUsage)
  sparks.count = sparkCount
  const sparkDummy = new Matrix4()
  const sparkPos: Vector3[] = []
  const sparkAge: number[] = []
  const sparkWait: number[] = []
  const q = new Quaternion()
  const sparkScale = new Vector3(1, 1, 1)
  for (let i = 0; i < sparkCount; i++) {
    sparkPos.push(new Vector3())
    sparkAge.push(1)
    sparkWait.push(rnd(i + 40) * 2.5)
    sparkDummy.compose(new Vector3(0, -2, 0), q, sparkScale)
    sparks.setMatrixAt(i, sparkDummy)
  }
  flames.add(sparks)

  const light = new PointLight(0xff6a24, 0, 0.13, 2.2)
  light.name = 'fire_light_base'
  light.position.set(0.0, 0.022, 0.0)
  const chimneyLight = new PointLight(0xff7a30, 0, 0.16, 2)
  chimneyLight.name = 'fire_light_chimney'
  chimneyLight.position.set(0, SEAT_Y + 0.08, 0)

  const trackedFuel = collectGeometriesAndMaterials(fuel)
  const trackedFlames = collectGeometriesAndMaterials(flames)

  return {
    fuel,
    flames,
    light,
    chimneyLight,
    update: (fire, dt, reducedMotion, cameraPos, opts) => {
      const chimneyAmt = Math.max(fire, (opts.cutaway ?? 0) * 0.55)
      const on = fire > 0.02
      const downBore = cameraPos.y > SEAT_Y + 0.05 && Math.hypot(cameraPos.x, cameraPos.z) < 0.055
      flames.visible = on || chimneyAmt > 0.04
      const ember = fire * opts.emberIntensity
      const t = performance.now() * 0.001
      char.emissiveIntensity = 0.16 + ember * 0.12
      const slow = reducedMotion ? 1 : 0.72 + 0.28 * Math.sin(t * 0.55)
      emberCoreMat.emissiveIntensity = 0.22 + ember * (0.35 + 0.25 * slow)
      emberHot.emissiveIntensity = 0.24 + ember * (0.45 + 0.2 * slow)
      hotspot.emissiveIntensity = 0.16 + ember * (0.3 + 0.35 * slow)

      for (const item of emberCores) {
        const period = item.kind === 'core' ? 2.2 : item.kind === 'crack' ? 1.4 : 1.1
        const pulse = reducedMotion ? 1 : 0.55 + 0.45 * Math.sin((t + item.phase) * ((Math.PI * 2) / period))
        item.mesh.scale.copy(item.rest).multiplyScalar(0.85 + pulse * 0.2)
      }

      light.intensity = 0.11 + (on ? 0.22 * fire * (reducedMotion ? 1 : 0.82 + 0.18 * Math.sin(t * 6.1)) : 0)
      chimneyLight.intensity = 0.1 + (chimneyAmt > 0.04 ? 0.14 * chimneyAmt * opts.chimneyFlameHeight : 0)
      chimneyLight.position.y = SEAT_Y + 0.1

      baseFlameMat.uniforms.uTime.value = t
      chimneyFlameMat.uniforms.uTime.value = t * 0.85
      baseFlameMat.uniforms.uOpacity.value = fire * (opts.mobile ? 0.42 : 0.7)
      chimneyFlameMat.uniforms.uOpacity.value = chimneyAmt * 0.88 * opts.chimneyFlameHeight
      baseGroup.visible = on && !downBore

      for (let i = 0; i < baseCards.length; i++) {
        const card = baseCards[i]
        const local = reducedMotion ? 1 : 0.72 + Math.sin(t * (9.2 + i * 3.4) + i * 1.7) * 0.28
        card.scale.set(0.9, 0.65 + fire * 0.5 * local, 1)
        card.position.y = 0.013 + Math.sin(t * (5.8 + i * 1.3) + i) * (reducedMotion ? 0 : 0.0018)
      }

      for (let i = 0; i < chimneyCards.length; i++) {
        const card = chimneyCards[i]
        const flicker = reducedMotion ? 1 : 0.88 + 0.14 * Math.sin(t * (3.6 + i * 2.1) + i * 1.4)
        const h = chimH * chimMul[i] * (0.78 + chimneyAmt * 0.3) * flicker
        card.visible = chimneyAmt > 0.04 && !downBore && (!opts.mobile || i === 0)
        card.scale.set(0.78 + chimneyAmt * 0.16 + (i % 2) * 0.06, h / (chimH * chimMul[i]), 1)
        card.position.y = 0.018 + h * 0.42
      }

      sparkMat.opacity = on && !reducedMotion ? 0.85 * ember : 0
      if (on && !reducedMotion) {
        for (let i = 0; i < sparkCount; i++) {
          if (sparkAge[i] >= 1) {
            sparkWait[i] -= dt
            if (sparkWait[i] > 0) {
              sparkDummy.compose(new Vector3(0, -2, 0), q, sparkScale)
              sparks.setMatrixAt(i, sparkDummy)
              continue
            }
            sparkAge[i] = 0
            sparkWait[i] = 0.6 + rnd(i + 51 + Math.floor(t)) * 2.8
            sparkPos[i].set((rnd(i + 61) - 0.5) * 0.018, 0.012, (rnd(i + 62) - 0.5) * 0.018)
          }
          sparkAge[i] += dt * (1.6 + rnd(i + 3) * 1.4)
          sparkPos[i].y += dt * (0.12 + rnd(i + 2) * 0.18)
          sparkPos[i].x += dt * (rnd(i + 8) - 0.5) * 0.008
          const chimneyT = Math.max(0, Math.min(1, (sparkPos[i].y - SEAT_Y) / KETTLE_H))
          const maxR =
            sparkPos[i].y < SEAT_Y
              ? 0.026
              : (CHIMNEY_BOT_R + (CHIMNEY_TOP_R - CHIMNEY_BOT_R) * chimneyT - WALL) * 0.72
          const sparkR = Math.hypot(sparkPos[i].x, sparkPos[i].z)
          if (sparkR > maxR) {
            sparkPos[i].x *= maxR / sparkR
            sparkPos[i].z *= maxR / sparkR
          }
          sparkPos[i].y = Math.min(sparkPos[i].y, SEAT_Y + KETTLE_H * 0.9)
          const s = 1 - sparkAge[i]
          sparkScale.setScalar(Math.max(0.15, s))
          sparkDummy.compose(sparkPos[i], q, sparkScale)
          sparks.setMatrixAt(i, sparkDummy)
        }
        sparks.instanceMatrix.needsUpdate = true
      }
    },
    dispose: () => {
      disposeTracked(trackedFuel.geos, trackedFuel.mats)
      disposeTracked(trackedFlames.geos, trackedFlames.mats)
      light.dispose()
      chimneyLight.dispose()
      noise.dispose()
      baseFlameMat.dispose()
      chimneyFlameMat.dispose()
    },
  }
}
