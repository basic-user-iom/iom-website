import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three'
import type { EnvironmentState } from '../persistence/schema'

const CELESTIAL_DISTANCE = 90
/** Real mean angular diameter ≈ 0.53°. */
export const DEFAULT_ANGULAR_DIAMETER_DEG = 0.53

const STAR_SEED = 0x10a571
const STAR_COUNT = 3200

export type CelestialHandles = {
  group: Group
  skyDome: Mesh
  stars: Points
  moon: Mesh
  sunDisc: Mesh
  sunAureole: Mesh
  update: (camera: PerspectiveCamera) => void
  apply: (
    env: EnvironmentState,
    skyColors: { top: Color; horizon: Color; ground: Color; softSky: boolean; sunColor?: number },
  ) => void
  dispose: () => void
}

/**
 * Camera-relative sky / sun / moon / stars — no translational parallax when the route moves.
 */
export function createCelestialLayer(scene: Scene): CelestialHandles {
  const group = new Group()
  group.name = 'iom-celestial-layer'
  scene.add(group)

  const skyDome = createSkyDome()
  const stars = createStarField(STAR_SEED, STAR_COUNT)
  const moon = createMoonMesh()
  const sunDisc = createSunDiscMesh()
  const sunAureole = createSunAureoleMesh()
  group.add(skyDome, stars, moon, sunAureole, sunDisc)

  void loadMoonTexture(moon)

  const _dir = new Vector3()

  return {
    group,
    skyDome,
    stars,
    moon,
    sunDisc,
    sunAureole,
    update(camera) {
      group.position.copy(camera.position)
    },
    apply(env, skyColors) {
      setSkyDomeColors(skyDome, skyColors.top, skyColors.horizon, skyColors.ground, skyColors.softSky)

      const showStars = Boolean(env.starsEnabled)
      stars.visible = showStars
      const starMat = stars.material as ShaderMaterial
      if (starMat.uniforms?.uOpacity) {
        starMat.uniforms.uOpacity.value = showStars ? 1 : 0
      }

      const sunUp = env.sunElevationDeg > -2
      const showSun = Boolean(env.sunDiscVisible) && Boolean(env.sunEnabled !== false) && sunUp
      sunDisc.visible = showSun
      // Soft aureole is an artistic fallback; keep it small so it never fills the frame.
      sunAureole.visible = showSun
      if (showSun) {
        directionFromAzEl(env.sunAzimuthDeg, env.sunElevationDeg, _dir)
        const scale =
          angularScale(env.sunAngularDiameterDeg ?? DEFAULT_ANGULAR_DIAMETER_DEG) *
          Math.max(0.2, Math.min(4, env.sunDiscScale ?? 1))
        sunDisc.scale.setScalar(scale)
        sunDisc.position.copy(_dir).multiplyScalar(CELESTIAL_DISTANCE)
        sunAureole.scale.setScalar(scale * 1.85)
        sunAureole.position.copy(sunDisc.position)
        if (skyColors.sunColor != null) {
          const c = skyColors.sunColor
          ;(sunDisc.material as MeshBasicMaterial).color.setHex(c)
          // Dim aureole so it cannot dominate the sky or bloom extract.
          ;(sunAureole.material as MeshBasicMaterial).color.setHex(c)
          ;(sunAureole.material as MeshBasicMaterial).opacity = 0.07
        }
      }

      const moonUp = (env.moonElevationDeg ?? 20) > -2
      const showMoon = Boolean(env.moonEnabled) && moonUp
      moon.visible = showMoon
      if (showMoon) {
        directionFromAzEl(env.moonAzimuthDeg ?? 0, env.moonElevationDeg ?? 28, _dir)
        const scale =
          angularScale(env.moonAngularDiameterDeg ?? DEFAULT_ANGULAR_DIAMETER_DEG) *
          Math.max(0.2, Math.min(4, env.moonScale ?? 1))
        moon.scale.setScalar(scale)
        moon.position.copy(_dir).multiplyScalar(CELESTIAL_DISTANCE)
        applyMoonShading(moon, env)
      }
    },
    dispose() {
      scene.remove(group)
      group.traverse((obj) => {
        if ((obj as Points).isPoints) {
          const pts = obj as Points
          pts.geometry.dispose()
          ;(pts.material as ShaderMaterial).dispose()
          return
        }
        const mesh = obj as Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
        const mat = mesh.material as MeshBasicMaterial
        mat.map?.dispose()
        mat.dispose()
      })
    },
  }
}

export function directionFromAzEl(azimuthDeg: number, elevationDeg: number, out = new Vector3()): Vector3 {
  const az = (azimuthDeg * Math.PI) / 180
  const el = (elevationDeg * Math.PI) / 180
  const cosEl = Math.cos(el)
  return out.set(Math.sin(az) * cosEl, Math.sin(el), Math.cos(az) * cosEl).normalize()
}

function angularScale(angularDiameterDeg: number): number {
  const alpha = (Math.max(0.1, Math.min(8, angularDiameterDeg)) * Math.PI) / 180
  return Math.tan(alpha * 0.5) * CELESTIAL_DISTANCE
}

function createSkyDome(): Mesh {
  const geo = new SphereGeometry(CELESTIAL_DISTANCE + 20, 48, 32)
  const pos = geo.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = 0.08
    colors[i * 3 + 1] = 0.09
    colors[i * 3 + 2] = 0.11
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  const mat = new MeshBasicMaterial({
    side: BackSide,
    depthWrite: false,
    vertexColors: true,
    fog: false,
  })
  const dome = new Mesh(geo, mat)
  dome.name = 'iom-sky-dome'
  dome.renderOrder = -3
  dome.frustumCulled = false
  dome.userData.selectiveBloom = false
  return dome
}

function createStarField(seed: number, count: number): Points {
  const rng = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)

  // Fibonacci sphere on the upper hemisphere → even coverage, no banding.
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    // Bias toward upper sky; keep a soft cut near the horizon.
    const y01 = Math.pow(t, 0.72) // more stars high, fewer near horizon
    const y = y01 * 0.98 + 0.02 // stay slightly above horizon
    const radiusXY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = i * golden + rng() * 0.35
    // Mild galactic-band density boost around a tilted plane.
    const band = Math.exp(-Math.pow(y - 0.35 + 0.15 * Math.sin(theta), 2) / 0.08)
    const keep = rng() < 0.55 + 0.45 * band
    if (!keep && i > count * 0.15) {
      // Resample sparsely into the band / high sky instead of leaving holes as empty.
      const y2 = 0.25 + rng() * 0.7
      const r2 = Math.sqrt(Math.max(0, 1 - y2 * y2))
      const th2 = rng() * Math.PI * 2
      placeStar(positions, i, r2 * Math.cos(th2), y2, r2 * Math.sin(th2))
    } else {
      placeStar(positions, i, radiusXY * Math.cos(theta), y, radiusXY * Math.sin(theta))
    }

    // Magnitude: many faint, few bright (power-law).
    const magRoll = Math.pow(rng(), 2.8)
    const bright = 0.12 + 0.88 * magRoll

    // Horizon atmospheric fade.
    const elev = positions[i * 3 + 1]
    const horizonFade = smoothstep(0.04, 0.28, elev)

    // Spectral type: cool blue → white → warm yellow/orange.
    const temp = rng()
    let rC: number
    let gC: number
    let bC: number
    if (temp < 0.55) {
      // white / blue-white
      const cool = (temp / 0.55) * 0.35
      rC = 0.78 + cool * 0.1
      gC = 0.84 + cool * 0.08
      bC = 0.95 + cool * 0.05
    } else if (temp < 0.85) {
      // warm white / yellow
      const w = (temp - 0.55) / 0.3
      rC = 0.95
      gC = 0.88 - w * 0.08
      bC = 0.72 - w * 0.18
    } else {
      // rare orange / red giants
      const w = (temp - 0.85) / 0.15
      rC = 1.0
      gC = 0.62 - w * 0.15
      bC = 0.42 - w * 0.2
    }

    const intensity = bright * horizonFade
    colors[i * 3] = Math.min(1, rC * intensity)
    colors[i * 3 + 1] = Math.min(1, gC * intensity)
    colors[i * 3 + 2] = Math.min(1, bC * intensity)

    // Pixel size: faint tiny cores, bright ones get a soft halo radius.
    sizes[i] = (1.1 + bright * bright * 6.5) * (0.75 + 0.25 * horizonFade)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))

  const material = new ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1 },
      uPixelRatio: { value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vCore;
      uniform float uPixelRatio;
      void main() {
        vColor = color;
        vCore = clamp(aSize / 8.0, 0.15, 1.0);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // Stars sit on a fixed celestial shell — use stable pixel sizing.
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vCore;
      uniform float uOpacity;
      void main() {
        vec2 p = gl_PointCoord - vec2(0.5);
        float d = length(p);
        if (d > 0.5) discard;
        // Soft disc: tight bright core + gentle falloff (not a hard square).
        float core = smoothstep(0.22, 0.0, d) * vCore;
        float halo = smoothstep(0.5, 0.08, d);
        float alpha = (core * 0.95 + halo * 0.35) * uOpacity;
        if (alpha < 0.01) discard;
        vec3 col = vColor * (0.55 + 1.35 * core);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    fog: false,
  })

  const points = new Points(geometry, material)
  points.name = 'iom-stars'
  points.visible = false
  points.renderOrder = -2
  points.frustumCulled = false
  points.userData.selectiveBloom = false
  return points
}

function placeStar(positions: Float32Array, i: number, x: number, y: number, z: number) {
  const len = Math.hypot(x, y, z) || 1
  const r = CELESTIAL_DISTANCE - 2
  positions[i * 3] = (x / len) * r
  positions[i * 3 + 1] = (y / len) * r
  positions[i * 3 + 2] = (z / len) * r
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function createMoonMesh(): Mesh {
  const moon = new Mesh(
    new SphereGeometry(1, 48, 32),
    new MeshBasicMaterial({ color: 0xe8eef8, fog: false }),
  )
  moon.name = 'iom-moon'
  moon.visible = false
  moon.renderOrder = -1
  moon.frustumCulled = false
  moon.userData.selectiveBloom = false
  return moon
}

function createSunDiscMesh(): Mesh {
  const sun = new Mesh(
    new SphereGeometry(1, 32, 24),
    new MeshBasicMaterial({ color: 0xfff0c8, fog: false }),
  )
  sun.name = 'iom-sun-disc'
  sun.visible = true
  sun.renderOrder = -1
  sun.frustumCulled = false
  sun.userData.selectiveBloom = false
  return sun
}

function createSunAureoleMesh(): Mesh {
  const aureole = new Mesh(
    new SphereGeometry(1, 24, 16),
    new MeshBasicMaterial({
      color: 0xffe8b0,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      fog: false,
    }),
  )
  aureole.name = 'iom-sun-aureole'
  aureole.visible = false
  aureole.renderOrder = -1.5
  aureole.frustumCulled = false
  aureole.userData.selectiveBloom = false
  return aureole
}

async function loadMoonTexture(moon: Mesh) {
  try {
    const loader = new TextureLoader()
    const url = `${import.meta.env.BASE_URL}textures/moon-lroc-2k.jpg`
    const tex = await loader.loadAsync(url)
    tex.colorSpace = SRGBColorSpace
    const mat = moon.material as MeshBasicMaterial
    mat.map = tex
    mat.color.set(0xffffff)
    mat.needsUpdate = true
  } catch (err) {
    console.warn('[automotive-studio] Moon texture unavailable', err)
  }
}

function applyMoonShading(moon: Mesh, env: EnvironmentState) {
  const mat = moon.material as MeshBasicMaterial
  const intensity = Math.max(0.1, Math.min(3, env.moonIntensity ?? 1))
  const phase = ((env.moonPhase ?? 0.5) % 1 + 1) % 1
  const lit = 0.25 + 0.75 * (1 - Math.abs(phase - 0.5) * 2)
  const g = Math.min(1, lit * intensity)
  if (mat.map) mat.color.setRGB(g, g, g)
  else mat.color.setRGB(g, Math.min(1, g * 1.02), Math.min(1, g * 1.06))
  // Face the texture toward the camera (celestial group origin).
  moon.quaternion.setFromUnitVectors(
    new Vector3(0, 0, 1),
    moon.position.lengthSq() > 0 ? moon.position.clone().normalize().negate() : new Vector3(0, 0, -1),
  )
}

function setSkyDomeColors(
  dome: Mesh,
  top: Color,
  horizon: Color,
  ground: Color,
  softSky: boolean,
) {
  const geo = dome.geometry as BufferGeometry
  const pos = geo.getAttribute('position')
  let colorAttr = geo.getAttribute('color') as BufferAttribute
  if (!colorAttr || colorAttr.count !== pos.count) {
    colorAttr = new BufferAttribute(new Float32Array(pos.count * 3), 3)
    geo.setAttribute('color', colorAttr)
  }
  const mid = softSky ? horizon.clone().lerp(top, 0.35) : horizon
  const radius = CELESTIAL_DISTANCE + 20
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const t = (y / radius + 1) * 0.5
    let c: Color
    if (t > 0.55) c = mid.clone().lerp(top, (t - 0.55) / 0.45)
    else if (t > 0.45) c = horizon.clone().lerp(mid, (t - 0.45) / 0.1)
    else c = ground.clone().lerp(horizon, Math.max(0, t) / 0.45)
    colorAttr.setXYZ(i, c.r, c.g, c.b)
  }
  colorAttr.needsUpdate = true
  dome.visible = true
}

function mulberry32(a: number) {
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
