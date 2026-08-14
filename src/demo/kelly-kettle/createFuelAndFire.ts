import {
  AdditiveBlending,
  CanvasTexture,
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
  Vector3,
} from 'three'
import { BASE_R, COLORS, MAX_EMBER_PARTICLES, SEAT_Y } from './constants'
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
  const size = 64
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

function flameMaterial(map: CanvasTexture) {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uNoise: { value: map },
      uNarrow: { value: 0.0 },
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
      uniform sampler2D uNoise;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        float n = texture2D(uNoise, vec2(uv.x * 1.7, uv.y * 0.85 - uTime * 0.52)).r;
        float n2 = texture2D(uNoise, vec2(uv.x * 2.6 + 0.18, uv.y * 1.35 - uTime * 0.27)).r;
        float edge = mix(0.16, 0.28, uNarrow);
        float wobble = (n - 0.5) * 0.2;
        float shape = smoothstep(edge, edge + 0.12, uv.x + wobble) * smoothstep(1.0 - edge, 0.72 - uNarrow * 0.12, uv.x + wobble);
        float height = pow(max(0.0, 1.0 - uv.y), 0.42) * (0.38 + 0.62 * n) * (0.45 + 0.55 * n2);
        float flame = shape * height;
        vec3 col = mix(vec3(1.0, 0.94, 0.52), vec3(1.0, 0.36, 0.05), uv.y);
        col = mix(col, vec3(0.48, 0.05, 0.0), smoothstep(0.48, 1.0, uv.y + n * 0.12));
        float alpha = flame * uOpacity;
        if (alpha < 0.045) discard;
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
  const bark = new MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.94, metalness: 0 })
  const char = new MeshStandardMaterial({
    color: 0x14110f,
    roughness: 0.96,
    metalness: 0,
    emissive: new Color(0x4a1408),
    emissiveIntensity: 0,
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

  const floorR = BASE_R * 0.38
  const maxR = floorR * 0.86
  const twigCount = quality === 'high' ? 18 : 12
  const twigGeos = [
    new CylinderGeometry(1, 0.72, 1, 6),
    new CylinderGeometry(0.85, 1, 1, 5),
  ]
  for (let i = 0; i < twigCount; i++) {
    const len = 0.028 + rnd(i + 3) * 0.02
    const rad = 0.0018 + rnd(i + 9) * 0.0022
    const mat = i % 3 === 0 ? char : bark
    const twig = new Mesh(twigGeos[i % 2], mat)
    twig.scale.set(rad, len, rad)
    const reach = Math.min(maxR - 0.002, maxR - len * 0.38)
    const ring = Math.sqrt(rnd(i + 1)) * Math.max(0.004, reach)
    const theta = rnd(i + 4) * Math.PI * 2
    twig.position.set(Math.cos(theta) * ring, 0.008 + rnd(i + 7) * 0.01, Math.sin(theta) * ring)
    twig.rotation.set(0.2 + rnd(i + 2) * 0.85, rnd(i + 1) * Math.PI * 2, (rnd(i + 5) - 0.5) * 1.15)
    twig.castShadow = false
    twigsGroup.add(twig)
    if (i % 4 === 0) {
      const tip = new Mesh(new SphereGeometry(rad * 1.1, 6, 4), emberHot)
      tip.position.set(0, len * 0.48, 0)
      twig.add(tip)
    }
  }

  const emberCores: { mesh: Mesh; phase: number; kind: 'core' | 'crack' | 'spot' }[] = []
  for (let i = 0; i < 8; i++) {
    const core = new Mesh(new SphereGeometry(0.0032 + rnd(i + 8) * 0.002, 8, 6), emberCoreMat)
    const ring = Math.sqrt(rnd(i + 11)) * maxR * 0.45
    const theta = rnd(i + 15) * Math.PI * 2
    core.position.set(Math.cos(theta) * ring, 0.008 + rnd(i + 13) * 0.007, Math.sin(theta) * ring)
    emberGroup.add(core)
    emberCores.push({ mesh: core, phase: rnd(i + 19) * 6, kind: 'core' })
  }
  for (let i = 0; i < 5; i++) {
    const crack = new Mesh(new CylinderGeometry(0.00045, 0.0007, 0.01 + rnd(i) * 0.006, 5), emberHot)
    const ring = Math.sqrt(rnd(i + 21)) * maxR * 0.4
    const theta = rnd(i + 23) * Math.PI * 2
    crack.position.set(Math.cos(theta) * ring, 0.01, Math.sin(theta) * ring)
    crack.rotation.set(1.1, rnd(i + 25) * 6, 0.4)
    emberGroup.add(crack)
    emberCores.push({ mesh: crack, phase: rnd(i + 27) * 6, kind: 'crack' })
  }
  for (let i = 0; i < 3; i++) {
    const spot = new Mesh(new SphereGeometry(0.0013, 6, 4), hotspot)
    const ring = Math.sqrt(rnd(i + 31)) * maxR * 0.32
    const theta = rnd(i + 33) * Math.PI * 2
    spot.position.set(Math.cos(theta) * ring, 0.011, Math.sin(theta) * ring)
    emberGroup.add(spot)
    emberCores.push({ mesh: spot, phase: rnd(i + 35) * 6, kind: 'spot' })
  }

  const noise = noiseMap()
  const baseFlameMat = flameMaterial(noise)
  const chimneyFlameMat = flameMaterial(noise)

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
    const card = new Mesh(new PlaneGeometry(0.018 + rnd(i) * 0.01, h), baseFlameMat)
    card.position.set((i - 1.4) * 0.01, 0.016 + h * 0.35, ((i % 2) - 0.5) * 0.01)
    card.rotation.y = i * 0.7
    card.renderOrder = 2
    baseGroup.add(card)
    baseCards.push(card)
  }

  const chimneyCards: Mesh[] = []
  const chimCount = quality === 'high' ? 3 : 2
  const chimH = 0.112
  for (let i = 0; i < chimCount; i++) {
    const card = new Mesh(new PlaneGeometry(0.028, chimH), chimneyFlameMat)
    card.rotation.y = i === 0 ? 0 : (Math.PI * i) / chimCount
    card.position.set(0, 0.02 + chimH * 0.42, 0)
    card.renderOrder = 3
    chimneyGroup.add(card)
    chimneyCards.push(card)
  }
  chimneyFlameMat.uniforms.uNarrow.value = 0.18

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
    update: (fire, dt, reducedMotion, _cameraPos, opts) => {
      const chimneyAmt = Math.max(fire, (opts.cutaway ?? 0) * 0.55)
      const on = fire > 0.02
      flames.visible = on || chimneyAmt > 0.04
      const ember = fire * opts.emberIntensity
      const t = performance.now() * 0.001
      char.emissiveIntensity = 0.05 + ember * 0.1
      const slow = reducedMotion ? 1 : 0.72 + 0.28 * Math.sin(t * 0.55)
      emberCoreMat.emissiveIntensity = 0.12 + ember * (0.35 + 0.25 * slow)
      emberHot.emissiveIntensity = 0.16 + ember * (0.45 + 0.2 * slow)
      hotspot.emissiveIntensity = 0.1 + ember * (0.3 + 0.35 * slow)

      for (const item of emberCores) {
        const period = item.kind === 'core' ? 2.2 : item.kind === 'crack' ? 1.4 : 1.1
        const pulse = reducedMotion ? 1 : 0.55 + 0.45 * Math.sin((t + item.phase) * ((Math.PI * 2) / period))
        item.mesh.scale.setScalar(0.85 + pulse * 0.2)
      }

      light.intensity = 0.07 + (on ? 0.22 * fire * (reducedMotion ? 1 : 0.82 + 0.18 * Math.sin(t * 6.1)) : 0)
      chimneyLight.intensity = chimneyAmt > 0.04 ? 0.12 * chimneyAmt * opts.chimneyFlameHeight : 0
      chimneyLight.position.y = SEAT_Y + 0.08

      baseFlameMat.uniforms.uTime.value = t
      chimneyFlameMat.uniforms.uTime.value = t * 0.85
      baseFlameMat.uniforms.uOpacity.value = fire * (opts.mobile ? 0.42 : 0.7)
      chimneyFlameMat.uniforms.uOpacity.value = chimneyAmt * 0.88 * opts.chimneyFlameHeight

      for (let i = 0; i < baseCards.length; i++) {
        const card = baseCards[i]
        const local = reducedMotion ? 1 : 0.72 + Math.sin(t * (9.2 + i * 3.4) + i * 1.7) * 0.28
        card.scale.set(0.9, 0.65 + fire * 0.5 * local, 1)
        card.position.y = 0.013 + Math.sin(t * (5.8 + i * 1.3) + i) * (reducedMotion ? 0 : 0.0018)
      }

      const h = chimH * (0.82 + chimneyAmt * 0.28) * (reducedMotion ? 1 : 0.92 + 0.08 * Math.sin(t * 4.2))
      for (let i = 0; i < chimneyCards.length; i++) {
        const card = chimneyCards[i]
        card.visible = chimneyAmt > 0.04 && (!opts.mobile || i === 0)
        card.scale.set(0.88 + chimneyAmt * 0.18, h / chimH, 1)
        card.position.y = 0.02 + h * 0.42
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
            sparkPos[i].set((rnd(i + 61) - 0.5) * 0.04, 0.012, (rnd(i + 62) - 0.5) * 0.04)
          }
          sparkAge[i] += dt * (1.6 + rnd(i + 3) * 1.4)
          sparkPos[i].y += dt * (0.12 + rnd(i + 2) * 0.18)
          sparkPos[i].x += dt * (rnd(i + 8) - 0.5) * 0.02
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
