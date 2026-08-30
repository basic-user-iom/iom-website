import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinnedScene } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getDeviceProfile } from '../utils/device'
import { createDeviceOrientationParallax } from '../utils/deviceOrientationParallax'
import { subscribeEmbedGate } from '../utils/embedVisibility'
import { buildHeroCloudFragmentShader } from './buildCloudFragmentShader'
import {
  HERO_CAMERA_FOCAL_LENGTH,
  HERO_CAMERA_INPUT_Y_BASE,
  HERO_CAMERA_RADIUS,
  HERO_CAMERA_TARGET_Y,
  HERO_CLOUD_VERTEX_SHADER,
} from './heroCloudShader'

/** Bump when LOD GLBs change — busts immutable CDN cache (max-age=1y). */
const RAVEN_LOD_VERSION = '20260720a'
const ravenAsset = (path: string) => `${path}?v=${RAVEN_LOD_VERSION}`

/** Desktop: single-file medium LOD. Mid/low power uses coarse. Avoids ~41 MB GLTF+PNG fan-out. */
const RAVEN_MODEL_URL = ravenAsset('/assets/ravens/common-ravens-medium.glb')
const RAVEN_MODEL_URL_MOBILE = ravenAsset('/assets/ravens/common-ravens-mobile.glb')
const RAVEN_MODEL_URL_COARSE = ravenAsset('/assets/ravens/common-ravens-coarse.glb')
/** Soft deadline for raven load; clouds stay visible if exceeded. */
const RAVEN_LOAD_TIMEOUT_MS = 20000
const RAVEN_SCALE_BASE = 0.0468
/** Preserve the former desktop screen size after adopting the wider shared cloud camera. */
const DESKTOP_RAVEN_SCALE_MUL = 1.47

/** Father · largest in the family flock. */
const FATHER_SCALE = RAVEN_SCALE_BASE * 1.375
/** Son · middle (reference scale). */
const SON_SCALE = RAVEN_SCALE_BASE
/** Mother · smallest. */
const MOTHER_SCALE = RAVEN_SCALE_BASE * 0.775

type FlockOffset = {
  /** Independent motion phase keeps the family from moving in lockstep. */
  phase: number
  offsetX: number
  offsetY: number
  offsetZ: number
  /** Low-amplitude independent lift prevents rigid formation movement. */
  zDepthAmp: number
  rollAmp: number
}

type FlightMotionProfile = {
  scale: number
  sway: number
}

type FlockMember = {
  group: THREE.Group
  anchorLocal: THREE.Vector3
  materials: THREE.MeshStandardMaterial[]
  baseColors: THREE.Color[]
  offset: FlockOffset
}

/** The flock holds a chase-camera formation while the cloud volume streams past. */
const SHARED_FLIGHT_MOTION: FlightMotionProfile = {
  scale: 1,
  sway: 0.055,
}

/** Shared camera removes the old z=22.5 mobile compensation; restore the original scale. */
const MOBILE_RAVEN_SCALE_MUL = 5.52

/** Keep the enlarged single mobile raven calm and centered in the phone frame. */
const MOBILE_FLIGHT_MOTION: FlightMotionProfile = {
  scale: 0.32,
  sway: 0.024,
}

const MOBILE_FLOCK_OFFSET: FlockOffset = {
  phase: 0,
  offsetX: 0,
  offsetY: 0.006,
  offsetZ: -0.004,
  zDepthAmp: 0.006,
  rollAmp: 0.012,
}

const FLOCK_OFFSETS: FlockOffset[] = [
  { phase: 0, offsetX: 0, offsetY: 0.012, offsetZ: 0, zDepthAmp: 0.012, rollAmp: 0.026 },
  { phase: -0.018, offsetX: 0.1721, offsetY: -0.0446, offsetZ: -0.081, zDepthAmp: 0.01, rollAmp: 0.021 },
  { phase: -0.036, offsetX: -0.158, offsetY: 0.0547, offsetZ: -0.1316, zDepthAmp: 0.009, rollAmp: 0.018 },
]

const FLIGHT_FORWARD = new THREE.Vector3(0, 0, -1)
const FLIGHT_UP = new THREE.Vector3(0, 1, 0)
const FLIGHT_DIRECTION = new THREE.Vector3()
const FLIGHT_HEADING = new THREE.Vector3()
const FLIGHT_RIGHT = new THREE.Vector3()
const FLIGHT_CENTER = new THREE.Vector3()
const CAMERA_PATH_LOOK_AHEAD = new THREE.Vector3()
const CAMERA_PATH_RIGHT = new THREE.Vector3()
const CAMERA_UP = new THREE.Vector3()
const CAMERA_PATH_SPEED = 0.12
const CAMERA_LOOK_AHEAD_DISTANCE = 4.1
const RAVEN_LEAD_DISTANCE = 2.8
/** Original iq cloud flow direction vec3(0, 0.1, 1), slowed for the hero frame. */
const CLOUD_WIND_Y = 0.0081
const CLOUD_WIND_Z = 0.081
/** Cloud cover changes slowly; 15 Hz sampling is visually continuous after material blending. */
const CLOUD_VISIBILITY_SAMPLE_HZ = 15
/** Reticle tracking is UI work, so avoid invalidating styles on every WebGL frame. */
const RAVEN_ANCHOR_SYNC_HZ = 30

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

function sampleHeroCameraPath(distance: number, target: THREE.Vector3) {
  target.set(
    HERO_CAMERA_RADIUS - distance,
    HERO_CAMERA_INPUT_Y_BASE +
      Math.sin(distance * 0.31) * 0.11 +
      Math.sin(distance * 0.13 + 1.2) * 0.045,
    Math.sin(distance * 0.43) * 0.32 + Math.sin(distance * 0.17 + 1.1) * 0.12,
  )
  return target
}

function fract(value: number) {
  return value - Math.floor(value)
}

function cloudHash(value: number) {
  return fract(Math.sin(value) * 43758.5453)
}

/** CPU twin of the shader's value-noise function. */
function cloudNoise(x: number, y: number, z: number) {
  const px = Math.floor(x)
  const py = Math.floor(y)
  const pz = Math.floor(z)
  const fx0 = fract(x)
  const fy0 = fract(y)
  const fz0 = fract(z)
  const fx = fx0 * fx0 * (3 - 2 * fx0)
  const fy = fy0 * fy0 * (3 - 2 * fy0)
  const fz = fz0 * fz0 * (3 - 2 * fz0)
  const n = px + py * 57 + 113 * pz
  const x00 = THREE.MathUtils.lerp(cloudHash(n), cloudHash(n + 1), fx)
  const x10 = THREE.MathUtils.lerp(cloudHash(n + 57), cloudHash(n + 58), fx)
  const x01 = THREE.MathUtils.lerp(cloudHash(n + 113), cloudHash(n + 114), fx)
  const x11 = THREE.MathUtils.lerp(cloudHash(n + 170), cloudHash(n + 171), fx)
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(x00, x10, fy),
    THREE.MathUtils.lerp(x01, x11, fy),
    fz,
  )
}

/** Exact CPU equivalent of the fragment shader's map().w cloud density. */
function sampleCloudDensity(position: THREE.Vector3, travel: THREE.Vector3) {
  let qx = position.x - travel.x
  let qy = position.y - travel.y
  let qz = position.z - travel.z
  let f = 0.5 * cloudNoise(qx, qy, qz)
  qx *= 2.02
  qy *= 2.02
  qz *= 2.02
  f += 0.25 * cloudNoise(qx, qy, qz)
  qx *= 2.03
  qy *= 2.03
  qz *= 2.03
  f += 0.125 * cloudNoise(qx, qy, qz)
  qx *= 2.01
  qy *= 2.01
  qz *= 2.01
  f += 0.0625 * cloudNoise(qx, qy, qz)
  return clamp01(0.2 - position.y + 3 * f)
}

const CLOUD_VISIBILITY_SAMPLE = new THREE.Vector3()

/** Approximate transmittance through the same volume between camera and raven. */
function estimateCloudOcclusion(
  cameraPosition: THREE.Vector3,
  ravenPosition: THREE.Vector3,
  travel: THREE.Vector3,
) {
  let transmission = 1
  const sampleCount = 7
  for (let index = 1; index <= sampleCount; index += 1) {
    CLOUD_VISIBILITY_SAMPLE.lerpVectors(cameraPosition, ravenPosition, index / sampleCount)
    const density = sampleCloudDensity(CLOUD_VISIBILITY_SAMPLE, travel)
    transmission *= 1 - density * 0.22
  }
  return clamp01(1 - transmission)
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

const MIN_RAVEN_OPACITY = 0.16

/** Constant playback preserves the source clip's measured seamless 11-second cycle. */
const RAVEN_ANIM_BASE_TIME_SCALE = 1.13

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

function createAnimationMixer(
  model: THREE.Object3D,
  gltf: GLTF,
  mixers: THREE.AnimationMixer[],
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
  action.time = clip.duration > 0 ? ((timeOffset % clip.duration) + clip.duration) % clip.duration : 0
  action.zeroSlopeAtStart = false
  action.zeroSlopeAtEnd = false
  action.play()
  mixers.push(mixer)
}

function applyCloudBlend(
  materials: THREE.MeshStandardMaterial[],
  baseColors: THREE.Color[],
  occlusion: number,
  localDensity: number,
) {
  const cloudCover = clamp01(occlusion * 0.9 + localDensity * 0.24)
  const opacity = Math.max(MIN_RAVEN_OPACITY, 1 - cloudCover * 0.94)
  const fogMix = clamp01(occlusion * 0.78 + localDensity * 0.28)

  materials.forEach((material, i) => {
    material.opacity = opacity
    material.depthWrite = opacity > 0.62
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
  flightDirection: THREE.Vector3,
  flightCenter: THREE.Vector3,
  motionProfile: FlightMotionProfile,
  cameraPosition: THREE.Vector3,
  cloudTravel: THREE.Vector3,
  refreshCloudVisibility: boolean,
) {
  const { group, materials, baseColors, offset } = member
  const phase = offset.phase * Math.PI * 12
  const swayPhase = elapsed * 0.38 + phase
  const sway = Math.sin(swayPhase) * motionProfile.sway
  const swayVelocity = Math.cos(swayPhase) * motionProfile.sway * 0.38
  const lift =
    Math.sin(elapsed * 0.54 + phase) * offset.zDepthAmp +
    Math.sin(elapsed * 0.23 + phase * 0.7) * offset.zDepthAmp * 0.35

  // A chase-camera composition: the flock always advances along the same
  // heading while the cloud volume supplies the strong forward-motion cue.
  group.position.copy(flightCenter)
  FLIGHT_RIGHT.crossVectors(flightDirection, FLIGHT_UP).normalize()
  group.position.addScaledVector(
    FLIGHT_RIGHT,
    (offset.offsetX + sway) * motionProfile.scale,
  )
  group.position.addScaledVector(
    flightDirection,
    offset.offsetZ * motionProfile.scale,
  )
  group.position.y +=
    offset.offsetY * motionProfile.scale + lift

  FLIGHT_HEADING.copy(flightDirection)
    .addScaledVector(FLIGHT_RIGHT, swayVelocity * 1.25)
    .normalize()
  group.quaternion.setFromUnitVectors(FLIGHT_FORWARD, FLIGHT_HEADING)
  const bank = THREE.MathUtils.clamp(
    -swayVelocity * 1.8 + Math.sin(elapsed * 0.47 + phase) * offset.rollAmp,
    -0.085,
    0.085,
  )
  group.rotateZ(bank)

  if (refreshCloudVisibility) {
    const localDensity = sampleCloudDensity(group.position, cloudTravel)
    const occlusion = estimateCloudOcclusion(cameraPosition, group.position, cloudTravel)
    applyCloudBlend(materials, baseColors, occlusion, localDensity)
  }
}

export type HeroSceneLoadStatus = {
  /** 0–1 approximate load progress for UI */
  progress: number
  phase: 'boot' | 'clouds' | 'ravens' | 'ready'
}

export type UseHeroSceneOptions = {
  onStatus?: (status: HeroSceneLoadStatus) => void
}

export function useHeroScene(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options?: UseHeroSceneOptions,
) {
  const onStatusRef = useRef(options?.onStatus)
  onStatusRef.current = options?.onStatus

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const report = (progress: number, phase: HeroSceneLoadStatus['phase']) => {
      onStatusRef.current?.({ progress: Math.min(1, Math.max(0, progress)), phase })
    }
    report(0.05, 'boot')

    const profile = getDeviceProfile()
    const prefersReduced = profile.prefersReducedMotion
    if (prefersReduced) {
      report(1, 'ready')
      return
    }
    const clock = new THREE.Clock()
    let isVisible = !document.hidden
    let isIntersecting = true
    let embedActive = false
    let contextLost = false
    let animationId = 0
    let animationReady = false
    let resizeQueued = false
    let resizeAnimationId = 0
    let resizeSettleAnimationId = 0

    const cloudScene = new THREE.Scene()
    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const ravenScene = new THREE.Scene()
    ravenScene.fog = new THREE.FogExp2(0x0a1018, 0.38)
    const sharedCameraFov = THREE.MathUtils.radToDeg(
      2 * Math.atan(1 / HERO_CAMERA_FOCAL_LENGTH),
    )
    const perspCamera = new THREE.PerspectiveCamera(sharedCameraFov, 1, 0.1, 80)
    const sharedCameraPosition = new THREE.Vector3()
    const sharedCameraTarget = new THREE.Vector3(0, HERO_CAMERA_TARGET_Y, 0)
    const updateSharedCamera = (elapsed: number, pointerX: number, pointerY: number) => {
      const pathDistance = elapsed * CAMERA_PATH_SPEED
      sampleHeroCameraPath(pathDistance, sharedCameraPosition)
      sampleHeroCameraPath(
        pathDistance + CAMERA_LOOK_AHEAD_DISTANCE,
        CAMERA_PATH_LOOK_AHEAD,
      )
      CAMERA_PATH_LOOK_AHEAD.y =
        HERO_CAMERA_TARGET_Y + Math.sin(pathDistance * 0.19) * 0.05

      FLIGHT_DIRECTION
        .subVectors(CAMERA_PATH_LOOK_AHEAD, sharedCameraPosition)
        .normalize()
      CAMERA_PATH_RIGHT.crossVectors(FLIGHT_DIRECTION, FLIGHT_UP).normalize()
      sharedCameraTarget
        .copy(CAMERA_PATH_LOOK_AHEAD)
        .addScaledVector(CAMERA_PATH_RIGHT, pointerX * 0.42)
      sharedCameraTarget.y -= pointerY * 0.28

      FLIGHT_DIRECTION
        .subVectors(sharedCameraTarget, sharedCameraPosition)
        .normalize()
      FLIGHT_RIGHT.crossVectors(FLIGHT_DIRECTION, FLIGHT_UP).normalize()
      CAMERA_UP.crossVectors(FLIGHT_RIGHT, FLIGHT_DIRECTION).normalize()
      FLIGHT_CENTER
        .copy(sharedCameraPosition)
        .addScaledVector(FLIGHT_DIRECTION, RAVEN_LEAD_DISTANCE)
      perspCamera.position.copy(sharedCameraPosition)
      perspCamera.lookAt(sharedCameraTarget)
    }
    updateSharedCamera(0, 0, 0)

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
      iTravel: { value: new THREE.Vector3() },
      iCameraPosition: { value: sharedCameraPosition },
      iCameraForward: { value: FLIGHT_DIRECTION },
      iCameraRight: { value: FLIGHT_RIGHT },
      iCameraUp: { value: CAMERA_UP },
      iCameraFocalLength: { value: HERO_CAMERA_FOCAL_LENGTH },
      iProjectionAspect: { value: 1 },
    }

    // Cheap first paint (compile + first raymarch), then ramp to device profile quality.
    const BOOT_CLOUD_STEPS = 18
    const BOOT_CLOUD_SCALE = 0.45
    const targetCloudScale = profile.cloudRenderScale
    const targetCloudSteps = profile.cloudRaySteps
    const targetSimpleLighting = profile.cloudSimpleLighting
    // The clouds are deliberately soft and are composited beneath full-resolution ravens.
    // Bounding only this raymarched pass prevents 4K/Retina fullscreen from multiplying
    // shader work by 10-20x without reducing the sharpness of the foreground or HUD.
    const maxCloudRenderWidth = profile.isLowPower
      ? 640
      : profile.isMidTier
        ? 800
        : 960
    const maxCloudRenderHeight = profile.isLowPower
      ? 600
      : profile.isMidTier
        ? 720
        : 900
    const maxCompositePixels = profile.isLowPower
      ? 1_500_000
      : profile.isMidTier
        ? 2_500_000
        : 4_000_000
    let cloudQualityReady = false
    let cloudUpgradeHandle: number | null = null
    let framesSinceCloudVisible = 0

    const cloudMaterial = new THREE.ShaderMaterial({
      vertexShader: HERO_CLOUD_VERTEX_SHADER,
      fragmentShader: buildHeroCloudFragmentShader(BOOT_CLOUD_STEPS, true),
      uniforms,
      depthWrite: false,
      depthTest: false,
    })

    const cloudQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cloudMaterial)
    cloudScene.add(cloudQuad)

    let cloudScale = Math.min(BOOT_CLOUD_SCALE, targetCloudScale)
    let cloudRT: THREE.WebGLRenderTarget | null = null
    let blitScene: THREE.Scene | null = null
    let blitMaterial: THREE.ShaderMaterial | null = null
    let blitQuad: THREE.Mesh | null = null

    // Always blit from an RT during boot so we can start below full resolution.
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

    const ambient = new THREE.AmbientLight(0x1a2430, 0.55)
    const keyLight = new THREE.DirectionalLight(0x9ec8e8, 1.1)
    keyLight.position.set(2.5, 4, 3)
    const rimLight = new THREE.DirectionalLight(0x00e5ff, 0.45)
    rimLight.position.set(-3, 1.5, -2)
    ravenScene.add(ambient, keyLight, rimLight)

    const mixers: THREE.AnimationMixer[] = []
    const flockMembers: FlockMember[] = []
    const ravenAnchorNdc = new THREE.Vector3()
    let ravenAnchorVisible = false
    let nextRavenAnchorSync = 0

    const syncRavenScreenAnchor = (elapsed: number) => {
      if (elapsed < nextRavenAnchorSync) return
      nextRavenAnchorSync = elapsed + 1 / RAVEN_ANCHOR_SYNC_HZ
      if (!container.querySelector('.raven-facts--scan')) return

      const trackedRaven = flockMembers[0]
      if (!trackedRaven) {
        if (ravenAnchorVisible) {
          ravenAnchorVisible = false
          container.dataset.ravenAnchorVisible = 'false'
        }
        return
      }

      ravenAnchorNdc.copy(trackedRaven.anchorLocal)
      trackedRaven.group.localToWorld(ravenAnchorNdc)
      ravenAnchorNdc.project(perspCamera)
      const visible =
        ravenAnchorNdc.z >= -1 &&
        ravenAnchorNdc.z <= 1 &&
        ravenAnchorNdc.x >= -1.08 &&
        ravenAnchorNdc.x <= 1.08 &&
        ravenAnchorNdc.y >= -1.08 &&
        ravenAnchorNdc.y <= 1.08

      const anchorX = clamp01(ravenAnchorNdc.x * 0.5 + 0.5) * 100
      const anchorY = clamp01(-ravenAnchorNdc.y * 0.5 + 0.5) * 100
      container.style.setProperty('--raven-anchor-x', `${anchorX.toFixed(3)}%`)
      container.style.setProperty('--raven-anchor-y', `${anchorY.toFixed(3)}%`)

      if (visible !== ravenAnchorVisible) {
        ravenAnchorVisible = visible
        container.dataset.ravenAnchorVisible = visible ? 'true' : 'false'
      }
    }

    const ravenModelUrl = profile.isMobile
      ? RAVEN_MODEL_URL_MOBILE
      : profile.isLowPower || profile.isMidTier
        ? RAVEN_MODEL_URL_COARSE
        : RAVEN_MODEL_URL
    const ravenFlightMotion = profile.isMobile
      ? MOBILE_FLIGHT_MOTION
      : SHARED_FLIGHT_MOTION
    let ravenLoadStarted = false
    let ravenLoadAborted = false
    let cloudFirstFrameDone = false
    let ravenLoadTimeout: ReturnType<typeof setTimeout> | null = null
    let ravenAbortController: AbortController | null = null
    let ravenIdleHandle: number | null = null

    const loadingManager = new THREE.LoadingManager()
    loadingManager.onProgress = (_url, loaded, total) => {
      if (total <= 0) return
      report(0.45 + (loaded / total) * 0.5, 'ravens')
    }
    loadingManager.onError = (url) => {
      console.error('Hero raven asset failed to load:', url)
    }

    const loader = new GLTFLoader(loadingManager)

    const onRavenGltfLoaded = (gltf: GLTF) => {
      if (ravenLoadAborted) return
      report(0.95, 'ravens')

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
        group.updateWorldMatrix(true, true)
        // The source scene origin sits well outside the bird. Center the mesh on
        // the flight pivot before applying tangent heading, otherwise a full
        // turn makes the raven orbit that hidden origin and sweep across screen.
        const modelCenter = new THREE.Box3()
          .setFromObject(model, true)
          .getCenter(new THREE.Vector3())
        model.position.sub(modelCenter)
        group.updateWorldMatrix(true, true)
        const anchorLocal = new THREE.Vector3()
        createAnimationMixer(model, gltf, mixers, timeOffset)
        flockMembers.push({
          group,
          anchorLocal,
          materials,
          baseColors: materials.map((m) => m.color.clone()),
          offset,
        })
      }

      // LOD GLBs are already single-raven; dual-bird hide helpers only apply to full GLTF.
      const isSingleRavenLod = ravenModelUrl.includes('.glb')

      if (profile.ravenCount === 1) {
        const fatherModel = cloneSkinnedScene(gltf.scene)
        if (!isSingleRavenLod) hideSecondRaven(fatherModel)
        const mobileScale = profile.isMobile
          ? FATHER_SCALE * MOBILE_RAVEN_SCALE_MUL
          : SON_SCALE * DESKTOP_RAVEN_SCALE_MUL
        const mobileOffset = profile.isMobile ? MOBILE_FLOCK_OFFSET : FLOCK_OFFSETS[1]
        addMember(fatherModel, mobileScale, mobileOffset, 0)
        report(1, 'ready')
        return
      }

      const fatherModel = cloneSkinnedScene(gltf.scene)
      const sonModel = cloneSkinnedScene(gltf.scene)
      if (!isSingleRavenLod) {
        hideSecondRaven(fatherModel)
        hideSecondRaven(sonModel)
      }
      addMember(fatherModel, FATHER_SCALE * DESKTOP_RAVEN_SCALE_MUL, FLOCK_OFFSETS[0], 0)
      addMember(sonModel, SON_SCALE * DESKTOP_RAVEN_SCALE_MUL, FLOCK_OFFSETS[1], 3.4)

      if (profile.ravenCount < 3) {
        report(1, 'ready')
        return
      }

      const motherModel = cloneSkinnedScene(gltf.scene)
      if (!isSingleRavenLod) hideFirstRaven(motherModel)
      addMember(motherModel, MOTHER_SCALE * DESKTOP_RAVEN_SCALE_MUL, FLOCK_OFFSETS[2], 6.8)
      report(1, 'ready')
    }

    const startRavenLoad = () => {
      if (ravenLoadStarted || profile.ravenCount === 0 || prefersReduced) return
      ravenLoadStarted = true

      ravenAbortController = new AbortController()
      const abortController = ravenAbortController

      ravenLoadTimeout = setTimeout(() => {
        ravenLoadAborted = true
        abortController.abort()
        console.warn('Hero raven load timed out — clouds-only fallback')
        report(1, 'ready')
      }, RAVEN_LOAD_TIMEOUT_MS)
      report(0.4, 'ravens')

      const clearRavenTimeout = () => {
        if (ravenLoadTimeout) {
          clearTimeout(ravenLoadTimeout)
          ravenLoadTimeout = null
        }
      }

      const failRavenLoad = (error: unknown) => {
        clearRavenTimeout()
        ravenLoadAborted = true
        report(1, 'ready')
        if (abortController.signal.aborted) return
        console.error('Hero raven model failed to load:', ravenModelUrl, error)
      }

      // GLB is a single file — fetch+abort avoids leaving a multi-MB download running after timeout.
      const basePath = ravenModelUrl.slice(0, ravenModelUrl.lastIndexOf('/') + 1)
      void fetch(ravenModelUrl, { signal: abortController.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return response.arrayBuffer()
        })
        .then((buffer) => {
          if (ravenLoadAborted) return
          loader.parse(
            buffer,
            basePath,
            (gltf) => {
              clearRavenTimeout()
              onRavenGltfLoaded(gltf)
            },
            failRavenLoad,
          )
        })
        .catch(failRavenLoad)
    }

    const scheduleRavenLoad = () => {
      // Let card thumbs claim bandwidth first on cold loads (incognito).
      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        cancelIdleCallback?: (id: number) => void
      }
      if (typeof win.requestIdleCallback === 'function') {
        ravenIdleHandle = win.requestIdleCallback(() => startRavenLoad(), { timeout: 1200 })
      } else {
        ravenIdleHandle = window.setTimeout(() => startRavenLoad(), 400) as unknown as number
      }
    }

    const isContainerFullscreen = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null }
      return (
        document.fullscreenElement === container ||
        doc.webkitFullscreenElement === container ||
        document.fullscreenElement === document.documentElement ||
        doc.webkitFullscreenElement === document.documentElement ||
        container.classList.contains('hero-canvas-wrap--pseudo-fs')
      )
    }

    const shouldAnimate = () => {
      const fullscreen = isContainerFullscreen()
      return (
        isVisible &&
        (isIntersecting || fullscreen) &&
        (!embedActive || fullscreen) &&
        !contextLost
      )
    }

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
      // Do not replace a healthy volumetric framebuffer during fullscreen entry.
      // Rebinding this heavy WebGL target in the transition can leave some Chrome/
      // driver combinations rendering sky-only frames. The soft cloud layer
      // upscales cleanly while ravens and UI use the full-size default framebuffer.
      if (isContainerFullscreen() && cloudRT) {
        uniforms.iResolution.value.set(cloudRT.width, cloudRT.height)
        uniforms.iProjectionAspect.value = cloudRT.width / cloudRT.height
        return
      }
      const rawWidth = Math.max(1, w * dpr * cloudScale)
      const rawHeight = Math.max(1, h * dpr * cloudScale)
      // Keep the proven near-square volume buffer in wide fullscreen layouts.
      // The soft background can upscale cleanly; foreground ravens stay crisp.
      const rw = Math.max(1, Math.floor(Math.min(rawWidth, maxCloudRenderWidth)))
      const rh = Math.max(1, Math.floor(Math.min(rawHeight, maxCloudRenderHeight)))
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
    }

    const upgradeCloudQuality = () => {
      if (cloudQualityReady) return
      cloudQualityReady = true
      cloudScale = targetCloudScale
      cloudMaterial.fragmentShader = buildHeroCloudFragmentShader(
        targetCloudSteps,
        targetSimpleLighting,
      )
      cloudMaterial.needsUpdate = true
      syncCloudResolution(width, height, renderer.getPixelRatio())
    }

    const scheduleCloudQualityUpgrade = () => {
      if (cloudQualityReady || cloudUpgradeHandle !== null) return
      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      }
      if (typeof win.requestIdleCallback === 'function') {
        cloudUpgradeHandle = win.requestIdleCallback(() => upgradeCloudQuality(), { timeout: 900 })
      } else {
        cloudUpgradeHandle = window.setTimeout(() => upgradeCloudQuality(), 350) as unknown as number
      }
    }

    const applyResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      // Keep the proven drawing surface alive while the CSS viewer expands.
      // Resizing the main WebGL buffer during fullscreen is the trigger for the
      // Chrome/driver sky-only failure and the large raymarch stall. DOM chrome
      // remains native-resolution and the cinematic scene upscales smoothly.
      if (isContainerFullscreen() && width > 1 && height > 1) {
        const fullscreenAspect = w / h
        perspCamera.aspect = fullscreenAspect
        perspCamera.updateProjectionMatrix()
        uniforms.iProjectionAspect.value = fullscreenAspect
        return
      }
      width = w
      height = h
      const pixelRatio = Math.min(
        profile.maxPixelRatio,
        Math.sqrt(maxCompositePixels / Math.max(1, w * h)),
      )
      if (Math.abs(renderer.getPixelRatio() - pixelRatio) > 0.001) {
        renderer.setPixelRatio(pixelRatio)
      }
      renderer.setSize(w, h, false)
      perspCamera.aspect = w / h
      perspCamera.updateProjectionMatrix()
      // Preserve the designed cloud composition on ultrawide/fullscreen canvases.
      // The soft volumetric background tolerates this subtle horizontal expansion;
      // the ravens continue using the true perspective aspect above.
      uniforms.iProjectionAspect.value = Math.min(w / h, 1.2)
      syncCloudResolution(w, h, pixelRatio)
      if (animationReady && shouldAnimate()) startAnimation()
    }

    const resize = () => {
      if (resizeQueued) return
      resizeQueued = true
      // Fullscreen transitions can emit several intermediate sizes. Keep rendering
      // the existing texture for two frames, then allocate once at the settled size.
      resizeAnimationId = requestAnimationFrame(() => {
        resizeAnimationId = 0
        resizeSettleAnimationId = requestAnimationFrame(() => {
          resizeSettleAnimationId = 0
          resizeQueued = false
          applyResize()
        })
      })
    }

    applyResize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    window.addEventListener('resize', resize)

    const onFullscreenChange = () => {
      resize()
      if (!isContainerFullscreen()) {
        const rect = container.getBoundingClientRect()
        const visibleWidth = Math.max(
          0,
          Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0),
        )
        const visibleHeight = Math.max(
          0,
          Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
        )
        const visibleRatio =
          rect.width > 0 && rect.height > 0
            ? (visibleWidth * visibleHeight) / (rect.width * rect.height)
            : 0
        isIntersecting = visibleRatio >= 0.1
      }
      if (shouldAnimate()) startAnimation()
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)

    renderer.domElement.style.touchAction = 'none'

    let mouseX = 0
    let mouseY = 0
    let targetMouseX = 0
    let targetMouseY = 0

    const parallaxGain = profile.isMobile ? 0.14 : 1

    const onMove = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest('.viewer-chrome, .raven-fact-card')) {
        targetMouseX = 0
        targetMouseY = 0
        return
      }
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
    let sceneElapsed = 0
    let nextCloudVisibilityUpdate = 0

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

      // Maintain simulation time ourselves: startAnimation() discards time spent
      // hidden/offscreen, avoiding a large camera/cloud jump when rendering resumes.
      const delta = Math.min(clock.getDelta(), 0.25)
      sceneElapsed += delta
      const elapsed = sceneElapsed

      if (!prefersReduced) {
        uniforms.iTime.value = elapsed
        const useParallaxSmoothing =
          !profile.isMobile || (motionParallax?.isActive() ?? false)
        if (useParallaxSmoothing) {
          mouseX += (targetMouseX - mouseX) * 0.06
          mouseY += (targetMouseY - mouseY) * 0.06
        }

        for (const mixer of mixers) {
          mixer.update(delta)
        }

        updateSharedCamera(elapsed, mouseX, mouseY)
        // Preserve iq's fixed cloud-flow vector while the camera itself follows
        // a separate forward rail through the volume.
        uniforms.iTravel.value.set(
          0,
          elapsed * CLOUD_WIND_Y,
          elapsed * CLOUD_WIND_Z,
        )

        const refreshCloudVisibility = elapsed >= nextCloudVisibilityUpdate
        if (refreshCloudVisibility) {
          nextCloudVisibilityUpdate = elapsed + 1 / CLOUD_VISIBILITY_SAMPLE_HZ
        }
        for (const member of flockMembers) {
          updateFlockMember(
            member,
            elapsed,
            FLIGHT_DIRECTION,
            FLIGHT_CENTER,
            ravenFlightMotion,
            sharedCameraPosition,
            uniforms.iTravel.value,
            refreshCloudVisibility,
          )
        }
      } else {
        uniforms.iTime.value = frozenTime
      }

      syncRavenScreenAnchor(elapsed)

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
        report(0.35, 'clouds')
        if (profile.ravenCount === 0) {
          report(1, 'ready')
        } else {
          requestAnimationFrame(() => scheduleRavenLoad())
        }
      } else if (!cloudQualityReady) {
        framesSinceCloudVisible += 1
        if (framesSinceCloudVisible >= 2) scheduleCloudQualityUpgrade()
      }

      if (flockMembers.length > 0) {
        renderer.autoClear = false
        renderer.clearDepth()
        renderer.render(ravenScene, perspCamera)
      }
    }

    animationReady = true

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
      contextLost = true
      stopAnimation()
    }

    const onContextRestored = () => {
      contextLost = false
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
      if (resizeAnimationId) cancelAnimationFrame(resizeAnimationId)
      if (resizeSettleAnimationId) cancelAnimationFrame(resizeSettleAnimationId)
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
      if (cloudUpgradeHandle !== null) {
        const win = window as Window & { cancelIdleCallback?: (id: number) => void }
        if (typeof win.cancelIdleCallback === 'function') win.cancelIdleCallback(cloudUpgradeHandle)
        else window.clearTimeout(cloudUpgradeHandle)
        cloudUpgradeHandle = null
      }
      if (ravenIdleHandle !== null) {
        const win = window as Window & {
          cancelIdleCallback?: (id: number) => void
        }
        if (typeof win.cancelIdleCallback === 'function') win.cancelIdleCallback(ravenIdleHandle)
        else window.clearTimeout(ravenIdleHandle)
        ravenIdleHandle = null
      }
      if (ravenLoadTimeout) clearTimeout(ravenLoadTimeout)
      ravenAbortController?.abort()
      ravenLoadAborted = true
      delete container.dataset.ravenAnchorVisible
      container.style.removeProperty('--raven-anchor-x')
      container.style.removeProperty('--raven-anchor-y')
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
