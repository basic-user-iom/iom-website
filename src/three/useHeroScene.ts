import { useEffect } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinnedScene } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getDeviceProfile } from '../utils/device'
import { createDeviceOrientationParallax } from '../utils/deviceOrientationParallax'
import { subscribeEmbedGate } from '../utils/embedVisibility'
import { buildHeroCloudFragmentShader } from './buildCloudFragmentShader'
import {
  HERO_CLOUD_TRAVEL_X,
  HERO_CLOUD_TRAVEL_Y,
  HERO_CLOUD_TRAVEL_Z,
  HERO_CLOUD_VERTEX_SHADER,
  HERO_ORBIT_RADIUS_X,
  HERO_ORBIT_RADIUS_Y,
  HERO_ORBIT_RADIUS_Z,
  HERO_ORBIT_SPEED,
  HERO_PARALLAX_ANGLE_BASE,
  HERO_PARALLAX_ANGLE_MOUSE,
  HERO_RAVEN_CLOUD_Y_CENTER,
  HERO_RAVEN_CLOUD_Y_SPREAD,
  HERO_TRAVEL_AMPLITUDE,
  HERO_TRAVEL_DIR_X,
  HERO_TRAVEL_DIR_Y,
  HERO_TRAVEL_DIR_Z,
  HERO_TRAVEL_SPEED,
} from './heroCloudShader'

/** Bump when LOD GLBs change — busts immutable CDN cache (max-age=1y). */
const RAVEN_LOD_VERSION = '20260710b'
const ravenAsset = (path: string) => `${path}?v=${RAVEN_LOD_VERSION}`

const RAVEN_MODEL_URL = ravenAsset('/assets/ravens/common-ravens.gltf')
const RAVEN_MODEL_URL_MOBILE = ravenAsset('/assets/ravens/common-ravens-mobile.glb')
/** Abort raven load on mobile if still pending after this (clouds-only fallback). */
const RAVEN_LOAD_TIMEOUT_MS = 5000
const RAVEN_SCALE_BASE = 0.0468

/** Father · largest in the family flock. */
const FATHER_SCALE = RAVEN_SCALE_BASE * 1.375
/** Son · middle (reference scale). */
const SON_SCALE = RAVEN_SCALE_BASE
/** Mother · smallest. */
const MOTHER_SCALE = RAVEN_SCALE_BASE * 0.775

type FlockOffset = {
  phase: number
  offsetX: number
  offsetY: number
  offsetZ: number
  zDepthAmp: number
  rollAmp: number
}

type SharedOrbit = {
  radiusX: number
  radiusY: number
  radiusZ: number
  yBase: number
  speed: number
}

type FlockMember = {
  group: THREE.Group
  materials: THREE.MeshStandardMaterial[]
  baseColors: THREE.Color[]
  phase: number
  offset: FlockOffset
}

const SHARED_ORBIT: SharedOrbit = {
  radiusX: HERO_ORBIT_RADIUS_X,
  radiusY: HERO_ORBIT_RADIUS_Y,
  radiusZ: HERO_ORBIT_RADIUS_Z,
  yBase: HERO_RAVEN_CLOUD_Y_CENTER,
  speed: HERO_ORBIT_SPEED,
}

/** Mobile single-raven scale multiplier (father base × this). 33.12 = 6× prior 5.52 mobile size. */
const MOBILE_RAVEN_SCALE_MUL = 33.12

/** Tighter orbit for single mobile raven — keeps enlarged bird inside cloud band. */
const MOBILE_ORBIT: SharedOrbit = {
  radiusX: HERO_ORBIT_RADIUS_X * 0.06,
  radiusY: HERO_ORBIT_RADIUS_Y * 0.08,
  radiusZ: HERO_ORBIT_RADIUS_Z * 0.05,
  yBase: HERO_RAVEN_CLOUD_Y_CENTER,
  speed: HERO_ORBIT_SPEED * 0.72,
}

const MOBILE_FLOCK_OFFSET: FlockOffset = {
  phase: 0,
  offsetX: 0,
  offsetY: 0.006,
  offsetZ: -0.004,
  zDepthAmp: 0.004,
  rollAmp: 0.005,
}

const FLOCK_OFFSETS: FlockOffset[] = [
  { phase: 0, offsetX: 0, offsetY: 0.01, offsetZ: 0, zDepthAmp: 0.06, rollAmp: 0.045 },
  { phase: 0.42, offsetX: 0.05, offsetY: -0.015, offsetZ: -0.035, zDepthAmp: 0.09, rollAmp: 0.035 },
  { phase: 0.84, offsetX: -0.045, offsetY: 0.02, offsetZ: 0.03, zDepthAmp: 0.07, rollAmp: 0.03 },
]

const BLIT_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const BLIT_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tDiffuse, vUv);
}
`

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

/**
 * Bounded smooth ping-pong travel for the flock.
 *
 * Problem history:
 *  - Raw sin swing bursted: at each reversal velocity was max in the reverse
 *    direction (~2× relative to the linear cloud drift) → looked like teleports.
 *  - Unbounded `elapsed * speed` never reverses but drifts ravens off-screen.
 *
 * Fix: advance a linear distance `d = elapsed * speed`, fold it into a triangle
 * wave of peak `amp`, then shape each leg with smoothstep so velocity is ZERO at
 * both turnarounds (no burst, ever) and ramps in/out symmetrically. On the
 * forward leg the flock moves in the same direction as the clouds; on the return
 * leg it eases back slowly, always staying within ±amp of the orbit center.
 */
function driftTravelScalar(elapsed: number, speed: number, amp = HERO_TRAVEL_AMPLITUDE): number {
  if (speed <= 0 || amp <= 0) return 0
  // One full ping-pong (0 → +amp → 0 → -amp → 0) covers a distance of 4·amp.
  const period = 4 * amp
  const d = ((elapsed * speed) % period + period) % period
  const leg = d / amp // 0..4
  if (leg < 1) return amp * smoothstep(0, 1, leg) // rise 0 → +amp
  if (leg < 2) return amp * smoothstep(0, 1, 2 - leg) // fall +amp → 0
  if (leg < 3) return -amp * smoothstep(0, 1, leg - 2) // fall 0 → -amp
  return -amp * smoothstep(0, 1, 4 - leg) // rise -amp → 0
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function easeOutCubic(t: number) {
  const u = clamp01(t)
  return 1 - (1 - u) ** 3
}

function easeInCubic(t: number) {
  return clamp01(t) ** 3
}

/** Approximate iq map() density from raven world coords (mirrors shader cloud band ~1.0–2.0). */
function estimateCloudDensity(y: number, z: number, time: number): number {
  const layerCenter = HERO_RAVEN_CLOUD_Y_CENTER + Math.sin(time * 0.22) * 0.035
  const yBand = smoothstep(
    layerCenter - HERO_RAVEN_CLOUD_Y_SPREAD,
    layerCenter + HERO_RAVEN_CLOUD_Y_SPREAD * 0.55,
    y,
  )
  const zRipple = 0.5 + 0.5 * Math.sin(z * 4.2 + time * 0.19)
  const noiseRipple =
    0.5 +
    0.5 *
      Math.sin(time * 0.31 + y * 14 + z * 6.5) *
      Math.cos(time * 0.17 - z * 3.1 + y * 8)
  const density = yBand * (0.5 + 0.5 * zRipple) * (0.6 + 0.4 * noiseRipple)
  return clamp01(density)
}

function applyCinematicRavenMaterials(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const materials: THREE.MeshStandardMaterial[] = []
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.frustumCulled = true
    const meshMaterials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of meshMaterials) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.envMapIntensity = 0.25
        material.roughness = Math.min(1, material.roughness + 0.1)
        material.transparent = true
        material.depthWrite = true
        materials.push(material)
      }
    }
  })
  return materials
}

const MIN_RAVEN_OPACITY = 0.55

/** Base wing-flap playback speed (matches prior constant feel). */
const RAVEN_ANIM_BASE_TIME_SCALE = 0.92
/** Slow the final stretch before loop wrap so the restart feels less abrupt. */
const LOOP_EASE_OUT_SEC = 4
/** Gentle ramp back to full speed after loop restart. */
const LOOP_EASE_IN_SEC = 0.8
/** Minimum timeScale reached at the loop boundary. */
const LOOP_MIN_TIME_SCALE = 0.28

type RavenAnimationState = {
  action: THREE.AnimationAction
  duration: number
  baseTimeScale: number
}

function collectSkinnedMeshes(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const skinnedMeshes: THREE.SkinnedMesh[] = []
  root.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      skinnedMeshes.push(child)
    }
  })
  return skinnedMeshes.sort((a, b) => a.name.localeCompare(b.name))
}

/** Keep raven 1 (Object_1279–1287); hide raven 2 (.001). */
function hideSecondRaven(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child.name.includes('.001')) {
      child.visible = false
      return
    }
    if (child.name.startsWith('raven_')) {
      child.visible = true
    }
  })

  const skinnedMeshes = collectSkinnedMeshes(root)
  if (skinnedMeshes.length === 10) {
    skinnedMeshes.slice(0, 5).forEach((mesh) => {
      mesh.visible = true
    })
    skinnedMeshes.slice(5).forEach((mesh) => {
      mesh.visible = false
    })
  }
}

/** Keep raven 2 (.001 / Object_1290–1298); hide raven 1. */
function hideFirstRaven(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child.name.includes('.001')) {
      child.visible = true
      return
    }
    if (child.name.startsWith('raven_')) {
      child.visible = false
    }
  })

  const skinnedMeshes = collectSkinnedMeshes(root)
  if (skinnedMeshes.length === 10) {
    skinnedMeshes.slice(0, 5).forEach((mesh) => {
      mesh.visible = false
    })
    skinnedMeshes.slice(5).forEach((mesh) => {
      mesh.visible = true
    })
  }
}

function prepareRavenModel(model: THREE.Object3D, scale: number) {
  model.scale.setScalar(scale)
  model.rotation.set(0, Math.PI * 0.5, 0)
  return applyCinematicRavenMaterials(model)
}

/** Ease playback speed near loop boundaries so wing flap restarts feel natural. */
function updateRavenAnimationTimeScale(state: RavenAnimationState) {
  const { action, duration, baseTimeScale } = state
  if (duration <= 0) return

  const t = action.time
  const minFactor = LOOP_MIN_TIME_SCALE / baseTimeScale
  let factor = 1

  if (t >= duration - LOOP_EASE_OUT_SEC) {
    const u = (t - (duration - LOOP_EASE_OUT_SEC)) / LOOP_EASE_OUT_SEC
    factor = 1 - easeOutCubic(u) * (1 - minFactor)
  }

  if (t <= LOOP_EASE_IN_SEC) {
    const u = t / LOOP_EASE_IN_SEC
    const easeIn = minFactor + easeInCubic(u) * (1 - minFactor)
    factor = Math.min(factor, easeIn)
  }

  action.timeScale = baseTimeScale * factor
}

function createAnimationMixer(
  model: THREE.Object3D,
  gltf: GLTF,
  mixers: THREE.AnimationMixer[],
  ravenAnimations: RavenAnimationState[],
  timeOffset = 0,
) {
  if (gltf.animations.length === 0) return

  const mixer = new THREE.AnimationMixer(model)
  const clip =
    gltf.animations.find((animation) => animation.name.includes('animations')) ??
    gltf.animations[0]
  const action = mixer.clipAction(clip)
  action.setLoop(THREE.LoopRepeat, Infinity)
  action.timeScale = RAVEN_ANIM_BASE_TIME_SCALE
  action.time = timeOffset
  action.play()
  mixers.push(mixer)
  ravenAnimations.push({
    action,
    duration: clip.duration,
    baseTimeScale: RAVEN_ANIM_BASE_TIME_SCALE,
  })
}

function applyCloudBlend(
  materials: THREE.MeshStandardMaterial[],
  baseColors: THREE.Color[],
  density: number,
  z: number,
  time: number,
) {
  const inCloud = density
  const zDepthFade = 0.55 + 0.45 * smoothstep(-0.35, 0.15, z + Math.sin(time * 0.24) * 0.04)
  const opacity = Math.max(
    MIN_RAVEN_OPACITY,
    clamp01(0.32 + 0.68 * (1 - inCloud * 0.78) * zDepthFade),
  )
  const fogMix = inCloud * 0.55

  materials.forEach((material, i) => {
    material.opacity = opacity
    material.depthWrite = opacity > 0.55
    const base = baseColors[i]
    material.color.setRGB(
      base.r * (1 - fogMix * 0.15) + fogMix * 0.55,
      base.g * (1 - fogMix * 0.1) + fogMix * 0.62,
      base.b * (1 - fogMix * 0.05) + fogMix * 0.68,
    )
  })
}

function updateFlockMember(
  member: FlockMember,
  elapsed: number,
  orbit: SharedOrbit,
  mouseX: number,
  mouseY: number,
) {
  const { group, materials, baseColors, phase, offset } = member
  const t = elapsed * orbit.speed + phase

  const orbitDriftX = Math.cos(HERO_PARALLAX_ANGLE_BASE - HERO_PARALLAX_ANGLE_MOUSE * mouseX) * 0.09
  const orbitDriftZ = Math.sin(HERO_PARALLAX_ANGLE_BASE - HERO_PARALLAX_ANGLE_MOUSE * mouseX) * 0.09
  const parallaxX = mouseX * 0.11
  const parallaxY = mouseY * 0.05
  const travel = driftTravelScalar(elapsed, HERO_TRAVEL_SPEED)

  const x =
    Math.sin(t) * orbit.radiusX +
    offset.offsetX +
    parallaxX +
    orbitDriftX +
    travel * HERO_TRAVEL_DIR_X
  const y =
    orbit.yBase +
    Math.sin(t * 1.7 + offset.phase * 0.3) * orbit.radiusY +
    offset.offsetY +
    parallaxY +
    travel * HERO_TRAVEL_DIR_Y
  const z =
    Math.cos(t * 0.85 + offset.phase * 0.15) * orbit.radiusZ +
    Math.sin(t * 1.3 + phase) * offset.zDepthAmp +
    offset.offsetZ +
    orbitDriftZ -
    0.12 +
    travel * HERO_TRAVEL_DIR_Z

  group.position.set(x, y, z)
  group.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * 0.85)) + Math.PI * 0.5
  group.rotation.z = Math.sin(t * 2.1 + offset.phase) * offset.rollAmp

  const density = estimateCloudDensity(y, z, elapsed)
  applyCloudBlend(materials, baseColors, density, z, elapsed)
}

export function useHeroScene(containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const profile = getDeviceProfile()
    const prefersReduced = profile.prefersReducedMotion
    if (prefersReduced) return
    const clock = new THREE.Clock()
    let isVisible = !document.hidden
    let isIntersecting = true
    let embedActive = false
    let animationId = 0
    let resizeQueued = false

    const cloudScene = new THREE.Scene()
    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const ravenScene = new THREE.Scene()
    ravenScene.fog = new THREE.FogExp2(0x0a1018, 0.38)
    const perspCamera = new THREE.PerspectiveCamera(profile.isMobile ? 58 : 42, 1, 0.1, profile.isMobile ? 120 : 80)
    perspCamera.position.set(0, profile.isMobile ? 0.08 : 0.15, profile.isMobile ? 22.5 : 3.6)
    perspCamera.lookAt(0, profile.isMobile ? 0.06 : 0.05, 0)

    const renderer = new THREE.WebGLRenderer({
      antialias: !profile.isLowPower,
      alpha: false,
      powerPreference: profile.isLowPower ? 'low-power' : 'high-performance',
    })
    renderer.setPixelRatio(profile.maxPixelRatio)
    renderer.setClearColor(0x08080a, 1)
    container.appendChild(renderer.domElement)

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2(1, 1) },
      iMouse: { value: new THREE.Vector2(0, 0) },
      iTravel: {
        value: new THREE.Vector3(HERO_CLOUD_TRAVEL_X, HERO_CLOUD_TRAVEL_Y, HERO_CLOUD_TRAVEL_Z),
      },
    }

    const cloudMaterial = new THREE.ShaderMaterial({
      vertexShader: HERO_CLOUD_VERTEX_SHADER,
      fragmentShader: buildHeroCloudFragmentShader(
        profile.cloudRaySteps,
        profile.cloudSimpleLighting,
      ),
      uniforms,
      depthWrite: false,
      depthTest: false,
    })

    const cloudQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cloudMaterial)
    cloudScene.add(cloudQuad)

    const cloudScale = profile.cloudRenderScale
    let cloudRT: THREE.WebGLRenderTarget | null = null
    let blitScene: THREE.Scene | null = null
    let blitMaterial: THREE.ShaderMaterial | null = null
    let blitQuad: THREE.Mesh | null = null

    if (cloudScale < 1) {
      blitScene = new THREE.Scene()
      blitMaterial = new THREE.ShaderMaterial({
        vertexShader: BLIT_VERTEX_SHADER,
        fragmentShader: BLIT_FRAGMENT_SHADER,
        uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
        depthWrite: false,
        depthTest: false,
      })
      blitQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMaterial)
      blitScene.add(blitQuad)
    }

    const ambient = new THREE.AmbientLight(0x1a2430, 0.55)
    const keyLight = new THREE.DirectionalLight(0x9ec8e8, 1.1)
    keyLight.position.set(2.5, 4, 3)
    const rimLight = new THREE.DirectionalLight(0x00e5ff, 0.45)
    rimLight.position.set(-3, 1.5, -2)
    ravenScene.add(ambient, keyLight, rimLight)

    const mixers: THREE.AnimationMixer[] = []
    const ravenAnimations: RavenAnimationState[] = []
    const flockMembers: FlockMember[] = []

    const ravenModelUrl = profile.isMobile ? RAVEN_MODEL_URL_MOBILE : RAVEN_MODEL_URL
    const ravenOrbit = profile.isMobile ? MOBILE_ORBIT : SHARED_ORBIT
    let ravenLoadStarted = false
    let ravenLoadAborted = false
    let cloudFirstFrameDone = false
    let ravenLoadTimeout: ReturnType<typeof setTimeout> | null = null

    const loadingManager = new THREE.LoadingManager()
    loadingManager.onError = (url) => {
      console.error('Hero raven asset failed to load:', url)
    }

    const loader = new GLTFLoader(loadingManager)

    const onRavenGltfLoaded = (gltf: GLTF) => {
      if (ravenLoadAborted) return

      const addMember = (
        model: THREE.Object3D,
        scale: number,
        offset: FlockOffset,
        timeOffset: number,
      ) => {
        const group = new THREE.Group()
        const materials = prepareRavenModel(model, scale)
        group.add(model)
        ravenScene.add(group)
        createAnimationMixer(model, gltf, mixers, ravenAnimations, timeOffset)
        flockMembers.push({
          group,
          materials,
          baseColors: materials.map((m) => m.color.clone()),
          phase: offset.phase,
          offset,
        })
      }

      if (profile.ravenCount === 1) {
        const fatherModel = cloneSkinnedScene(gltf.scene)
        hideSecondRaven(fatherModel)
        const mobileScale = profile.isMobile ? FATHER_SCALE * MOBILE_RAVEN_SCALE_MUL : SON_SCALE
        const mobileOffset = profile.isMobile ? MOBILE_FLOCK_OFFSET : FLOCK_OFFSETS[1]
        addMember(fatherModel, mobileScale, mobileOffset, 0)
        return
      }

      const fatherModel = cloneSkinnedScene(gltf.scene)
      const sonModel = cloneSkinnedScene(gltf.scene)
      hideSecondRaven(fatherModel)
      hideSecondRaven(sonModel)
      addMember(fatherModel, FATHER_SCALE, FLOCK_OFFSETS[0], 0)
      addMember(sonModel, SON_SCALE, FLOCK_OFFSETS[1], 1.2)

      if (profile.ravenCount < 3) return

      const motherModel = cloneSkinnedScene(gltf.scene)
      hideFirstRaven(motherModel)
      addMember(motherModel, MOTHER_SCALE, FLOCK_OFFSETS[2], 2.4)
    }

    const startRavenLoad = () => {
      if (ravenLoadStarted || profile.ravenCount === 0 || prefersReduced) return
      ravenLoadStarted = true

      ravenLoadTimeout = setTimeout(() => {
        ravenLoadAborted = true
        console.warn('Hero raven load timed out — clouds-only fallback')
      }, RAVEN_LOAD_TIMEOUT_MS)

      loader.load(
        ravenModelUrl,
        (gltf) => {
          if (ravenLoadTimeout) {
            clearTimeout(ravenLoadTimeout)
            ravenLoadTimeout = null
          }
          onRavenGltfLoaded(gltf)
        },
        undefined,
        (error) => {
          if (ravenLoadTimeout) {
            clearTimeout(ravenLoadTimeout)
            ravenLoadTimeout = null
          }
          ravenLoadAborted = true
          console.error('Hero raven model failed to load:', ravenModelUrl, error)
        },
      )
    }

    const shouldAnimate = () => isVisible && isIntersecting && !embedActive

    const stopAnimation = () => {
      if (!animationId) return
      cancelAnimationFrame(animationId)
      animationId = 0
    }

    const startAnimation = () => {
      if (animationId || !shouldAnimate()) return
      clock.getDelta()
      animationId = requestAnimationFrame(animate)
    }

    let width = 1
    let height = 1

    const syncCloudResolution = (w: number, h: number, dpr: number) => {
      if (cloudScale < 1) {
        const rw = Math.max(1, Math.floor(w * dpr * cloudScale))
        const rh = Math.max(1, Math.floor(h * dpr * cloudScale))
        if (!cloudRT || cloudRT.width !== rw || cloudRT.height !== rh) {
          cloudRT?.dispose()
          cloudRT = new THREE.WebGLRenderTarget(rw, rh, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
          })
          if (blitMaterial) {
            blitMaterial.uniforms.tDiffuse.value = cloudRT.texture
          }
        }
        uniforms.iResolution.value.set(rw, rh)
      } else {
        uniforms.iResolution.value.set(w * dpr, h * dpr)
      }
    }

    const applyResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      width = w
      height = h
      renderer.setSize(w, h, false)
      perspCamera.aspect = w / h
      perspCamera.updateProjectionMatrix()
      syncCloudResolution(w, h, renderer.getPixelRatio())
    }

    const resize = () => {
      if (resizeQueued) return
      resizeQueued = true
      requestAnimationFrame(() => {
        resizeQueued = false
        applyResize()
      })
    }

    applyResize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    window.addEventListener('resize', resize)

    const onFullscreenChange = () => resize()
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)

    renderer.domElement.style.touchAction = 'none'

    let mouseX = 0
    let mouseY = 0
    let targetMouseX = 0
    let targetMouseY = 0

    const parallaxGain = profile.isMobile ? 0.14 : 1

    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      targetMouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2 * parallaxGain
      targetMouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2 * parallaxGain
    }
    if (!profile.isMobile) {
      container.addEventListener('pointermove', onMove)
    }

    const motionParallax =
      profile.isMobile && !prefersReduced
        ? createDeviceOrientationParallax({
            enabled: true,
            onTargetUpdate: (x, y) => {
              targetMouseX = x
              targetMouseY = y
            },
          })
        : null

    const onVisibility = () => {
      isVisible = !document.hidden
      if (shouldAnimate()) {
        startAnimation()
      } else {
        stopAnimation()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const frameInterval = profile.targetFps < 60 ? 1000 / profile.targetFps : 0
    let lastRenderTime = 0

    const frozenTime = 0

    const animate = (timestamp: number) => {
      if (!shouldAnimate()) {
        animationId = 0
        return
      }
      animationId = requestAnimationFrame(animate)

      if (frameInterval > 0) {
        const elapsed = timestamp - lastRenderTime
        if (elapsed < frameInterval) return
        lastRenderTime = timestamp - (elapsed % frameInterval)
      }

      const delta = clock.getDelta()
      const elapsed = clock.getElapsedTime()

      if (!prefersReduced) {
        uniforms.iTime.value = elapsed
        const useParallaxSmoothing =
          !profile.isMobile || (motionParallax?.isActive() ?? false)
        if (useParallaxSmoothing) {
          mouseX += (targetMouseX - mouseX) * 0.06
          mouseY += (targetMouseY - mouseY) * 0.06
        }

        for (const state of ravenAnimations) {
          updateRavenAnimationTimeScale(state)
        }
        for (const mixer of mixers) {
          mixer.update(delta)
        }

        for (const member of flockMembers) {
          updateFlockMember(member, elapsed, ravenOrbit, mouseX, mouseY)
        }
      } else {
        uniforms.iTime.value = frozenTime
      }

      const dpr = renderer.getPixelRatio()
      const resX = width * dpr
      const resY = height * dpr
      uniforms.iMouse.value.set(
        (mouseX * 0.5 + 0.5) * resX,
        (1.0 - (mouseY * 0.5 + 0.5)) * resY,
      )

      renderer.autoClear = true
      if (cloudRT && blitScene) {
        renderer.setRenderTarget(cloudRT)
        renderer.render(cloudScene, orthoCamera)
        renderer.setRenderTarget(null)
        renderer.render(blitScene, orthoCamera)
      } else {
        renderer.render(cloudScene, orthoCamera)
      }

      if (!cloudFirstFrameDone) {
        cloudFirstFrameDone = true
        requestAnimationFrame(() => startRavenLoad())
      }

      if (flockMembers.length > 0) {
        renderer.autoClear = false
        renderer.clearDepth()
        renderer.render(ravenScene, perspCamera)
      }
    }

    const unsubscribeEmbedGate = subscribeEmbedGate((active) => {
      embedActive = active
      if (shouldAnimate()) {
        startAnimation()
      } else {
        stopAnimation()
      }
    })

    const onContextLost = (event: Event) => {
      event.preventDefault()
      stopAnimation()
    }

    const onContextRestored = () => {
      applyResize()
      if (shouldAnimate()) startAnimation()
    }

    renderer.domElement.addEventListener('webglcontextlost', onContextLost)
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored)

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry?.intersectionRatio ?? 0
        isIntersecting = Boolean(entry?.isIntersecting && ratio >= 0.1)
        if (shouldAnimate()) {
          startAnimation()
        } else {
          stopAnimation()
        }
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    )
    intersectionObserver.observe(container)

    startAnimation()

    return () => {
      stopAnimation()
      unsubscribeEmbedGate()
      ro.disconnect()
      window.removeEventListener('resize', resize)
      intersectionObserver.disconnect()
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
      document.removeEventListener('visibilitychange', onVisibility)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored)
      if (!profile.isMobile) {
        container.removeEventListener('pointermove', onMove)
      }
      motionParallax?.dispose()
      if (ravenLoadTimeout) clearTimeout(ravenLoadTimeout)
      ravenLoadAborted = true
      cloudRT?.dispose()
      blitMaterial?.dispose()
      blitQuad?.geometry.dispose()
      cloudMaterial.dispose()
      cloudQuad.geometry.dispose()
      for (const member of flockMembers) {
        member.group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            for (const mat of mats) mat.dispose()
          }
        })
      }
      for (const mixer of mixers) {
        mixer.stopAllAction()
      }
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [containerRef])
}
