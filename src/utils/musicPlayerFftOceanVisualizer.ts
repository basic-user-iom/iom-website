import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getDeviceProfile } from './device'
import { FftOceanSimulation, supportsFloatTextures } from './fftOcean'
import { clamp, lerp, MusicPlayerAudioDriver } from './musicPlayerVisualizerAudio'
import type { MusicPlayerVisualizerLike } from './musicPlayerVisualizerTypes'

const RAVEN_LOD_VERSION = '20260711c'
/** Global scene darkening multiplier (30% darker sky/lights). */
const SCENE_DARKEN = 0.7
/** Extra darkening for ocean color, sky tint, and HDR exposure only. */
const OCEAN_DARKEN = 0.52
const OCEAN_TONE = SCENE_DARKEN * OCEAN_DARKEN
const ravenAsset = (path: string) => `${path}?v=${RAVEN_LOD_VERSION}`
const RAVEN_ANIM_BASE_TIME_SCALE = 0.92

type RavenPhase = 'hidden' | 'entering' | 'active' | 'exiting'

function easeOutCubic(t: number) {
  const x = clamp(t, 0, 1)
  return 1 - (1 - x) ** 3
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

/** Keep raven 1; hide the paired second bird in the GLTF. */
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

function prepareOceanRavenModel(model: THREE.Object3D, scale: number) {
  model.scale.setScalar(scale)
  // Raven mesh faces +X; +90° Y aligns +X with parent -Z (Three.js forward). Matches raven-path demo.
  model.rotation.set(0, Math.PI * 0.5, 0)
  hideSecondRaven(model)
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.frustumCulled = true
    const meshMaterials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of meshMaterials) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.envMapIntensity = 0.25
        material.roughness = Math.min(1, material.roughness + 0.1)
      }
    }
  })
}

function startRavenWingFlap(model: THREE.Object3D, gltf: GLTF): THREE.AnimationMixer | null {
  if (gltf.animations.length === 0) return null
  const mixer = new THREE.AnimationMixer(model)
  const clip =
    gltf.animations.find((animation) => animation.name.includes('animations')) ??
    gltf.animations[0]
  const action = mixer.clipAction(clip)
  action.setLoop(THREE.LoopRepeat, Infinity)
  action.timeScale = RAVEN_ANIM_BASE_TIME_SCALE
  action.play()
  return mixer
}

const SKYBOX_IMG_BASE = '/demos/fft-ocean/img'
/** Complete cubemap sets — each prefix has west/east/up/down/south/north face JPGs. */
export const FFT_OCEAN_SKYBOX_SETS = [
  'clouds',
  'grimmnight',
  'interstellar',
  'miramar',
  'sky',
  'sunset',
  'violent_days',
] as const
/** Start on grimmnight; cycling then continues to interstellar, miramar, … */
const FFT_OCEAN_INITIAL_SKYBOX_INDEX = FFT_OCEAN_SKYBOX_SETS.indexOf('grimmnight')
const EVENING_LIGHT = new THREE.Vector3(-0.28, 0.52, -0.38)
const SKYBOX_SIZE = 64

/** Twilight cube map — used when grimmnight JPGs are unavailable on deploy. */
function createProceduralEveningSkybox(): THREE.CubeTexture {
  const faces: HTMLCanvasElement[] = []
  const zenith = [0.04 * SCENE_DARKEN, 0.06 * SCENE_DARKEN, 0.12 * SCENE_DARKEN] as const
  const mid = [0.08 * SCENE_DARKEN, 0.1 * SCENE_DARKEN, 0.18 * SCENE_DARKEN] as const
  const horizon = [0.18 * SCENE_DARKEN, 0.14 * SCENE_DARKEN, 0.22 * SCENE_DARKEN] as const
  const glow = [0.32 * SCENE_DARKEN, 0.22 * SCENE_DARKEN, 0.18 * SCENE_DARKEN] as const

  for (let face = 0; face < 6; face += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = SKYBOX_SIZE
    canvas.height = SKYBOX_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) continue

    const image = ctx.createImageData(SKYBOX_SIZE, SKYBOX_SIZE)
    for (let y = 0; y < SKYBOX_SIZE; y += 1) {
      for (let x = 0; x < SKYBOX_SIZE; x += 1) {
        const u = x / (SKYBOX_SIZE - 1)
        const v = y / (SKYBOX_SIZE - 1)
        const nx = u * 2 - 1
        const ny = 1 - v * 2

        let elev = 0
        if (face === 2) elev = Math.max(0, ny)
        else if (face === 3) elev = Math.max(0, -ny)
        else elev = Math.max(0, 1 - Math.abs(ny) * 0.85)

        const horizonBand = Math.exp(-Math.pow(ny * 2.4, 2) * 0.55)
        const twilight = Math.pow(elev, 0.55)
        const tMid = twilight * 0.65 + horizonBand * 0.35

        let r = zenith[0] + (mid[0] - zenith[0]) * tMid + (horizon[0] - mid[0]) * horizonBand * 0.6
        let g = zenith[1] + (mid[1] - zenith[1]) * tMid + (horizon[1] - mid[1]) * horizonBand * 0.6
        let b = zenith[2] + (mid[2] - zenith[2]) * tMid + (horizon[2] - mid[2]) * horizonBand * 0.6

        const sunGlow =
          Math.exp(-((nx - 0.15) ** 2 + (ny + 0.55) ** 2) * 5.5) * (face === 4 ? 1 : 0.55)
        r += glow[0] * sunGlow * 0.55
        g += glow[1] * sunGlow * 0.55
        b += glow[2] * sunGlow * 0.55

        const idx = (y * SKYBOX_SIZE + x) * 4
        image.data[idx] = Math.round(clamp(r, 0, 1) * 255)
        image.data[idx + 1] = Math.round(clamp(g, 0, 1) * 255)
        image.data[idx + 2] = Math.round(clamp(b, 0, 1) * 255)
        image.data[idx + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
    faces.push(canvas)
  }

  const texture = new THREE.CubeTexture(faces as unknown as HTMLImageElement[])
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

type FftOceanOptions = {
  lowPower: boolean
  maxPixelRatio: number
  fftResolution: number
  geometryResolution: number
  mirrorTextureSize: number
}

export async function isFftOceanSupported(): Promise<boolean> {
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    if (!gl || !('getExtension' in gl)) return false
    return supportsFloatTextures(gl as WebGLRenderingContext)
  } catch {
    return false
  }
}

function skyboxUrlsForSet(setName: string): string[] {
  const base = `${SKYBOX_IMG_BASE}/${setName}`
  return [
    `${base}_west.jpg`,
    `${base}_east.jpg`,
    `${base}_up.jpg`,
    `${base}_down.jpg`,
    `${base}_south.jpg`,
    `${base}_north.jpg`,
  ]
}

async function loadSkyboxSet(setName: string): Promise<THREE.CubeTexture> {
  try {
    const texture = await new Promise<THREE.CubeTexture>((resolve, reject) => {
      new THREE.CubeTextureLoader().load(
        skyboxUrlsForSet(setName),
        (loaded) => {
          loaded.colorSpace = THREE.SRGBColorSpace
          resolve(loaded)
        },
        undefined,
        reject,
      )
    })
    return texture
  } catch {
    return createProceduralEveningSkybox()
  }
}

export class MusicPlayerFftOceanVisualizer implements MusicPlayerVisualizerLike {
  private renderer: THREE.WebGLRenderer | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private scene: THREE.Scene | null = null
  private ocean: FftOceanSimulation | null = null
  private eveningLight: THREE.DirectionalLight | null = null
  private skybox: THREE.CubeTexture | null = null
  private skyboxSetIndex = FFT_OCEAN_INITIAL_SKYBOX_INDEX
  private lastTrackId: string | null = null
  private skyboxLoadGeneration = 0
  private container: HTMLElement | null = null
  private audio = new MusicPlayerAudioDriver()
  private travelZ = 0
  /** Camera sits slightly below the raven for a grazing wave-top view. */
  private readonly chaseCamYOffset = -1.62
  /** Look-ahead point in front of the raven along -Z. */
  private readonly lookAheadZ = 14
  private readonly lookTargetYOffset = -3.78
  /** Cruise altitude — 10% above prior 13.53. */
  private readonly ravenFlyY = 14.883
  /** Chase distance base — camera breathes ±cameraFollowOscAmp behind raven. */
  private readonly cameraFollowBase = 22
  private readonly cameraFollowOscAmp = 4
  private readonly cameraFollowOscFreq = 0.38
  /** Raven drifts ahead/behind on the shared rail (secondary sine, smaller). */
  private readonly ravenLeadOscAmp = 2.8
  private readonly ravenLeadOscFreq = 0.55
  /**
   * Shared natural flight drift (raven + chase cam stay locked together).
   * Amplitudes stay small — gentle bob/sway, not wild banking.
   */
  private readonly flightBobYAmp = 0.36
  private readonly flightBobYAmp2 = 0.14
  private readonly flightBobYFreq = 0.52
  private readonly flightBobYFreq2 = 0.79
  private readonly flightSwayXAmp = 0.42
  private readonly flightSwayXAmp2 = 0.18
  private readonly flightSwayXFreq = 0.34
  private readonly flightSwayXFreq2 = 0.21
  /** Keep raven within a readable follow band so it never vanishes to the horizon. */
  private readonly minRavenFollowDist = 14
  private readonly maxRavenFollowDist = 28
  private readonly ravenScale = 1.15
  private flightRail = {
    cameraZ: 11,
    ravenRailZ: -11,
    followDist: 22,
  }
  /** Shared path offset — written once per frame for raven + chase cam. */
  private flightPathOffset = { x: 0, y: 0 }
  /** Minimum camera altitude above sea level (Y=0) — 10% above prior 9.9. */
  private readonly minCamY = 10.89
  /** Hard safety floor — never dip below this on chase cam (10% above prior 9.075). */
  private readonly absoluteMinCamY = 9.9825
  /** Look-at Y floor — keeps view ray above the water surface (Y=0). */
  private readonly minTargetY = 0.495
  /** Max downward look offset from camera — prevents steep dive into wave volume. */
  private readonly maxLookDown = 5.25
  private camPos = new THREE.Vector3(0, 12.705, 11)
  private camTarget = new THREE.Vector3(0, 7.623, -3)
  private ravenPos = new THREE.Vector3(0, 14.883, -11)
  private ravenPrevPos = new THREE.Vector3(0, 14.883, -11)
  private ravenLookTarget = new THREE.Vector3()
  private ravenTravelDir = new THREE.Vector3(0, 0, -1)
  private ravenPhase: RavenPhase = 'hidden'
  private ravenGroup: THREE.Group | null = null
  private ravenMixer: THREE.AnimationMixer | null = null
  private ravenEnterProgress = 0
  private ravenExitProgress = 0
  /** Cruise camera pose frozen when raven begins exit — no raven tracking. */
  private exitCamHold: { x: number; y: number; targetY: number } | null = null
  private readonly ravenEnterDuration = 1.6
  private readonly ravenExitDuration = 2.2
  private readonly ravenEnterStartFollowDist = 9.8
  /** NDC y for screen-top ray (>1 = above visible frame). */
  private readonly ravenEnterNdcY = 1.22
  private readonly ravenExitNdcY = 1.08
  private ravenEnterStartY = 30.8
  private screenRayNdc = new THREE.Vector3()
  private screenRayDir = new THREE.Vector3()
  private screenProjected = new THREE.Vector3()
  private ravenLoadStarted = false
  private tiltedCamTarget = new THREE.Vector3()
  private camForward = new THREE.Vector3()
  private camRight = new THREE.Vector3()
  private camUp = new THREE.Vector3()
  private worldUp = new THREE.Vector3(0, 1, 0)
  private targetTiltX = 0
  private targetTiltY = 0
  private smoothedTiltX = 0
  private smoothedTiltY = 0
  private pointerActive = false
  private deviceTiltX = 0
  private deviceTiltY = 0
  private deviceTiltActive = false
  private prefersReducedMotion = false
  private options: FftOceanOptions = {
    lowPower: true,
    maxPixelRatio: 1,
    fftResolution: 128,
    geometryResolution: 96,
    mirrorTextureSize: 256,
  }
  private baseMaxPixelRatio = 1
  private baseFftResolution = 128
  private baseGeometryResolution = 96
  private fullscreenMode = false
  private width = 1
  private height = 1
  private disposed = false
  private paused = false
  private savedPixelRatio: number | null = null
  private initPromise: Promise<void> | null = null
  private ready = false
  private baseWindX = 10
  private baseWindY = 10
  private baseSize = 200
  private baseChoppiness = 3.6
  private baseExposure = 0.1 * OCEAN_TONE
  private baseForwardSpeed = 5
  private baseIdleForwardSpeed = 0.325
  private skyboxRotation = new THREE.Euler(0, 0, 0)
  private prevReactiveWind = 0
  private prevReactiveSize = 0

  constructor() {
    const profile = getDeviceProfile()
    this.prefersReducedMotion = profile.prefersReducedMotion
    this.baseMaxPixelRatio = profile.visualizerMaxPixelRatio
    this.baseFftResolution = profile.isMobile ? 64 : profile.isLowPower ? 64 : 128
    this.baseGeometryResolution = profile.isMobile ? 72 : profile.isLowPower ? 84 : 96
    this.applyPerformanceOptions()
  }

  private applyPerformanceOptions() {
    const fs = this.fullscreenMode
    const profile = getDeviceProfile()
    this.options = {
      lowPower: profile.isLowPower,
      maxPixelRatio: fs
        ? Math.min(window.devicePixelRatio || 1, profile.isMobile ? 1 : 1.25)
        : this.baseMaxPixelRatio,
      fftResolution: fs ? 64 : this.baseFftResolution,
      geometryResolution: fs
        ? Math.max(48, Math.floor(this.baseGeometryResolution * (profile.isMobile ? 0.72 : 0.62)))
        : this.baseGeometryResolution,
      mirrorTextureSize: fs ? (profile.isMobile ? 128 : 192) : profile.isMobile ? 192 : 256,
    }
    if (this.renderer && this.container) {
      this.resize(this.width, this.height)
    }
  }

  setFullscreenMode(enabled: boolean) {
    if (this.fullscreenMode === enabled) return
    this.fullscreenMode = enabled
    this.applyPerformanceOptions()
  }

  setActiveTrackId(trackId: string) {
    if (trackId === this.lastTrackId) return
    const hadPreviousTrack = this.lastTrackId != null
    this.lastTrackId = trackId
    if (!hadPreviousTrack || !this.scene) return
    this.skyboxSetIndex = (this.skyboxSetIndex + 1) % FFT_OCEAN_SKYBOX_SETS.length
    void this.swapSkyboxSet(this.skyboxSetIndex)
  }

  private async loadCurrentSkybox(): Promise<THREE.CubeTexture> {
    const setName = FFT_OCEAN_SKYBOX_SETS[this.skyboxSetIndex] ?? FFT_OCEAN_SKYBOX_SETS[0]
    return loadSkyboxSet(setName)
  }

  private async swapSkyboxSet(index: number) {
    const generation = ++this.skyboxLoadGeneration
    const setName = FFT_OCEAN_SKYBOX_SETS[index] ?? FFT_OCEAN_SKYBOX_SETS[0]
    const nextSkybox = await loadSkyboxSet(setName)
    if (this.disposed || generation !== this.skyboxLoadGeneration || !this.scene) {
      nextSkybox.dispose()
      return
    }
    const previous = this.skybox
    this.skybox = nextSkybox
    this.scene.background = nextSkybox
    this.skyboxRotation.set(0, 0, 0)
    previous?.dispose()
  }

  async mount(container: HTMLElement) {
    if (this.container === container && this.renderer && this.ready) return
    this.dispose()
    this.disposed = false
    this.travelZ = 0
    this.ravenPhase = 'hidden'
    this.ravenEnterProgress = 0
    this.ravenExitProgress = 0
    this.exitCamHold = null
    this.ravenLoadStarted = false
    this.container = container

    const initPromise = this.buildScene(container)
    this.initPromise = initPromise
    try {
      await initPromise
    } catch (err) {
      if (this.initPromise === initPromise) this.initPromise = null
      throw err
    }
  }

  private async buildScene(container: HTMLElement) {
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: this.options.lowPower ? 'low-power' : 'high-performance',
    })

    const gl = renderer.getContext()
    gl.getExtension('EXT_color_buffer_float')
    gl.getExtension('EXT_color_buffer_half_float')
    if (!supportsFloatTextures(gl)) {
      renderer.dispose()
      throw new Error('FFT ocean requires float textures')
    }

    renderer.setClearColor(0x070b11, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.className = 'music-player-canvas'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    container.prepend(renderer.domElement)
    this.renderer = renderer

    const camera = new THREE.PerspectiveCamera(74, 1, 0.4, 1_000_000)
    camera.position.copy(this.camPos)
    this.camera = camera

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x070b11, 0.00105)
    this.scene = scene

    this.skyboxSetIndex = FFT_OCEAN_INITIAL_SKYBOX_INDEX
    this.lastTrackId = null
    this.skybox = await this.loadCurrentSkybox()
    if (this.disposed) return
    scene.background = this.skybox

    const eveningLight = new THREE.DirectionalLight(0x8898b8, 0.85 * SCENE_DARKEN)
    eveningLight.position.copy(EVENING_LIGHT).multiplyScalar(10)
    scene.add(eveningLight)
    this.eveningLight = eveningLight

    scene.add(new THREE.AmbientLight(0x1a2438, 0.42 * SCENE_DARKEN))
    scene.add(new THREE.HemisphereLight(0x283848, 0x080c14, 0.38 * SCENE_DARKEN))

    const ocean = new FftOceanSimulation(renderer, camera, scene, {
      initialSize: this.baseSize,
      initialWind: [this.baseWindX, this.baseWindY],
      initialChoppiness: this.baseChoppiness,
      exposure: this.baseExposure,
      resolution: this.options.fftResolution,
      geometryResolution: this.options.geometryResolution,
      mirrorTextureSize: this.options.mirrorTextureSize,
      oceanColor: new THREE.Vector3(0.06, 0.09, 0.12).multiplyScalar(OCEAN_TONE),
      skyColor: new THREE.Vector3(2.4, 2.9, 3.6).multiplyScalar(OCEAN_TONE),
      sunDirection: EVENING_LIGHT.clone(),
    })
    this.ocean = ocean

    void this.loadRaven(scene)

    this.ready = true
    this.resize(container.clientWidth, container.clientHeight)
  }

  private loadRaven(scene: THREE.Scene) {
    if (this.ravenLoadStarted || this.disposed) return
    this.ravenLoadStarted = true

    const profile = getDeviceProfile()
    const url = profile.isMobile
      ? ravenAsset('/assets/ravens/common-ravens-mobile.glb')
      : ravenAsset('/assets/ravens/common-ravens.gltf')

    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        if (this.disposed) return
        const group = new THREE.Group()
        const model = gltf.scene
        prepareOceanRavenModel(model, this.ravenScale)
        group.add(model)
        group.visible = false
        scene.add(group)
        this.ravenGroup = group
        this.ravenMixer = startRavenWingFlap(model, gltf)
      },
      undefined,
      () => {
        // Raven is optional — chase cam still works without the model.
      },
    )
  }

  setPointer(normalizedX: number, normalizedY: number) {
    if (this.prefersReducedMotion) return
    this.targetTiltX = clamp(normalizedX, -1, 1)
    this.targetTiltY = clamp(normalizedY, -1, 1)
    this.pointerActive = true
  }

  resetPointer() {
    this.pointerActive = false
    this.targetTiltX = 0
    this.targetTiltY = 0
  }

  setDeviceOrientation(beta: number | null, gamma: number | null) {
    if (this.prefersReducedMotion || beta == null || gamma == null) {
      this.deviceTiltActive = false
      return
    }
    this.deviceTiltY = clamp((beta - 45) / 38, -1, 1)
    this.deviceTiltX = clamp(gamma / 42, -1, 1)
    this.deviceTiltActive = true
  }

  clearDeviceOrientation() {
    this.deviceTiltActive = false
    this.deviceTiltX = 0
    this.deviceTiltY = 0
  }

  resize(width: number, height: number) {
    if (!this.renderer || !this.camera) return
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)

    const dpr = Math.min(window.devicePixelRatio || 1, this.options.maxPixelRatio)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(this.width, this.height, false)

    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  pause() {
    if (this.paused || this.disposed) return
    this.paused = true
    if (this.renderer) {
      this.savedPixelRatio = this.renderer.getPixelRatio()
      this.renderer.setPixelRatio(1)
    }
  }

  resume() {
    if (!this.paused || this.disposed) return
    this.paused = false
    if (this.renderer && this.savedPixelRatio != null) {
      this.renderer.setPixelRatio(this.savedPixelRatio)
      this.savedPixelRatio = null
    }
  }

  isPaused() {
    return this.paused
  }

  /** World Y on the flight path where a viewport NDC y value sits (1 = top edge). */
  private worldYAtScreenNdc(ndcY: number, worldZ: number): number {
    if (!this.camera) return this.ravenFlyY + 18
    this.screenRayNdc.set(0, ndcY, 0.5)
    this.screenRayNdc.unproject(this.camera)
    this.screenRayDir.copy(this.screenRayNdc).sub(this.camera.position)
    if (Math.abs(this.screenRayDir.z) < 1e-4) {
      return this.camera.position.y + (ndcY - 0.5) * 36
    }
    const t = (worldZ - this.camera.position.z) / this.screenRayDir.z
    if (t < 0) return this.camera.position.y + 24
    return this.camera.position.y + this.screenRayDir.y * t
  }

  /** True when a world position projects above the top of the viewport. */
  private isAboveViewportTop(worldPos: THREE.Vector3): boolean {
    if (!this.camera) return worldPos.y > this.ravenFlyY + 20
    this.screenProjected.copy(worldPos).project(this.camera)
    return this.screenProjected.y > this.ravenExitNdcY
  }

  /** Horizon look-at Y for cruise / exit — never tied to live raven altitude. */
  private horizonLookTargetY(camY: number): number {
    return Math.min(
      camY - this.maxLookDown,
      Math.max(this.minTargetY, this.ravenFlyY + this.lookTargetYOffset),
    )
  }

  /** Shared forward rail — raven and camera travel together along -Z. */
  private updateFlightRail(time: number) {
    const followOsc = Math.sin(time * this.cameraFollowOscFreq) * this.cameraFollowOscAmp
    const followDist = clamp(
      this.cameraFollowBase + followOsc,
      this.minRavenFollowDist,
      this.maxRavenFollowDist,
    )
    const leadOsc = Math.sin(time * this.ravenLeadOscFreq + 1.2) * this.ravenLeadOscAmp
    const ravenRailZ = this.travelZ - leadOsc
    const cameraZ = ravenRailZ + followDist
    this.flightRail = { cameraZ, ravenRailZ, followDist }
  }

  /**
   * Gentle bipolar bob (Y) + lateral sway (X) for the shared flight path.
   * Written once per frame into flightPathOffset so raven and chase cam stay locked.
   */
  private updateFlightPathOffset(time: number, motionScale: number) {
    const bobY =
      (Math.sin(time * this.flightBobYFreq) * this.flightBobYAmp +
        Math.sin(time * this.flightBobYFreq2 + 1.3) * this.flightBobYAmp2) *
      motionScale
    const swayX =
      (Math.sin(time * this.flightSwayXFreq + 0.4) * this.flightSwayXAmp +
        Math.sin(time * this.flightSwayXFreq2 + 2.1) * this.flightSwayXAmp2) *
      motionScale
    this.flightPathOffset.x = swayX
    this.flightPathOffset.y = bobY
  }

  /** Clamp raven Z so it stays inside the viewport while playing. */
  private clampRavenZForFrustum(ravenZ: number, ravenY: number): number {
    if (!this.camera || this.ravenPhase !== 'active') return ravenZ

    const cameraZ = this.flightRail.cameraZ
    let dist = clamp(cameraZ - ravenZ, this.minRavenFollowDist, this.maxRavenFollowDist)
    let z = cameraZ - dist

    this.screenProjected.set(0, ravenY, z)
    this.screenProjected.project(this.camera)

    if (this.screenProjected.y < -0.35) {
      z = cameraZ - this.minRavenFollowDist
    } else if (this.screenProjected.y > 0.92) {
      z = cameraZ - this.maxRavenFollowDist * 0.88
    }

    return z
  }

  private applyCameraTilt() {
    const maxYaw = 0.12
    const maxPitchUp = 0.05
    const maxPitchDown = 0.025
    const tiltYaw = this.smoothedTiltX * maxYaw
    const tiltPitch =
      this.smoothedTiltY >= 0
        ? this.smoothedTiltY * maxPitchDown
        : this.smoothedTiltY * maxPitchUp

    this.camForward.subVectors(this.camTarget, this.camPos).normalize()
    this.camRight.crossVectors(this.worldUp, this.camForward).normalize()
    this.camUp.crossVectors(this.camForward, this.camRight)

    this.tiltedCamTarget
      .copy(this.camTarget)
      .sub(this.camPos)
      .applyAxisAngle(this.camRight, tiltPitch)
      .applyAxisAngle(this.camUp, tiltYaw)
      .add(this.camPos)
  }

  private updateRavenState(delta: number, time: number, isPlaying: boolean, motionScale: number) {
    const flightY = this.ravenFlyY + this.flightPathOffset.y
    const flightX = this.flightPathOffset.x
    const flightZ = this.flightRail.ravenRailZ

    if (isPlaying && this.ravenPhase === 'hidden') {
      this.ravenPhase = 'entering'
      this.ravenEnterProgress = 0
      this.ravenExitProgress = 0
      const enterZ = this.flightRail.cameraZ - this.ravenEnterStartFollowDist
      this.ravenEnterStartY =
        this.worldYAtScreenNdc(this.ravenEnterNdcY, enterZ) + 2.5
      this.ravenPrevPos.set(flightX, this.ravenEnterStartY, enterZ)
      if (this.ravenGroup) this.ravenGroup.visible = true
    } else if (
      !isPlaying &&
      (this.ravenPhase === 'active' || this.ravenPhase === 'entering')
    ) {
      this.ravenPhase = 'exiting'
      this.ravenExitProgress = 0
      const holdY = this.camPos.y
      this.exitCamHold = {
        x: this.camPos.x,
        y: holdY,
        targetY: this.horizonLookTargetY(holdY),
      }
    }

    if (this.ravenPhase === 'entering') {
      this.ravenEnterProgress = Math.min(
        1,
        this.ravenEnterProgress + delta / this.ravenEnterDuration,
      )
      const t = easeOutCubic(this.ravenEnterProgress)
      const enterY = lerp(this.ravenEnterStartY, flightY, t)
      const enterFollow = lerp(
        this.ravenEnterStartFollowDist,
        this.flightRail.followDist,
        t,
      )
      const enterZ = this.flightRail.cameraZ - enterFollow
      this.ravenPos.set(flightX, enterY, enterZ)
      if (this.ravenEnterProgress >= 1) {
        this.ravenPhase = 'active'
      }
    } else if (this.ravenPhase === 'active') {
      this.ravenPos.set(flightX, flightY, flightZ)
    } else if (this.ravenPhase === 'exiting') {
      this.ravenExitProgress += delta
      const exitT = clamp(this.ravenExitProgress / this.ravenExitDuration, 0, 1)
      const ascend = lerp(8, 38, easeOutCubic(exitT))
      const forward = lerp(6, 16, exitT)
      this.ravenPos.y += delta * ascend
      this.ravenPos.z -= delta * forward
      this.ravenPos.x += Math.sin(this.ravenExitProgress * 2.4) * delta * 0.35
      if (
        this.isAboveViewportTop(this.ravenPos) ||
        this.ravenExitProgress >= this.ravenExitDuration
      ) {
        this.ravenPhase = 'hidden'
        if (this.ravenGroup) this.ravenGroup.visible = false
        this.ravenExitProgress = 0
        this.exitCamHold = null
      }
    } else {
      this.ravenPos.set(flightX, flightY, flightZ)
    }

    if (this.ravenGroup && this.ravenPhase !== 'hidden') {
      this.ravenGroup.position.copy(this.ravenPos)

      const velocity = this.ravenTravelDir
      velocity.subVectors(this.ravenPos, this.ravenPrevPos)
      if (delta > 1e-5) velocity.divideScalar(delta)
      const speed = velocity.length()
      if (speed > 0.35) {
        velocity.normalize()
      } else {
        velocity.set(0, 0, -1)
      }

      this.ravenLookTarget.copy(this.ravenPos).add(velocity)
      this.ravenGroup.lookAt(this.ravenLookTarget)

      // Soft heading lean only — no aggressive side roll.
      const bank = Math.sin(time * 0.14 + 2.0) * 0.04 * motionScale
      const enterBank =
        this.ravenPhase === 'entering'
          ? lerp(0.08, bank, easeOutCubic(this.ravenEnterProgress))
          : this.ravenPhase === 'exiting'
            ? lerp(bank, bank + 0.06, clamp(this.ravenExitProgress / this.ravenExitDuration, 0, 1))
            : bank
      this.ravenGroup.rotateZ(enterBank)

      this.ravenPrevPos.copy(this.ravenPos)
    }

    if (this.ravenMixer && this.ravenPhase !== 'hidden') {
      this.ravenMixer.update(delta)
    }
  }

  private updateChaseCamera(_time: number, _motionScale: number, _delta: number, _isPlaying: boolean) {
    const trackingRaven =
      this.ravenPhase === 'entering' || this.ravenPhase === 'active'
    const isExiting = this.ravenPhase === 'exiting'
    // When tracking, follow the raven's drifted path; otherwise use the same shared signal.
    const focusY = trackingRaven ? this.ravenPos.y : this.ravenFlyY + this.flightPathOffset.y
    const focusX = trackingRaven ? this.ravenPos.x : this.flightPathOffset.x
    const focusZ = trackingRaven ? this.ravenPos.z : this.flightRail.ravenRailZ

    if (isExiting) {
      const hold = this.exitCamHold ?? {
        x: this.camPos.x,
        y: this.camPos.y,
        targetY: this.horizonLookTargetY(this.camPos.y),
      }
      const camY = Math.max(this.minCamY, hold.y)
      const horizonTargetZ = this.flightRail.ravenRailZ - this.lookAheadZ

      // Exit: hold cruise pose — do not chase the raven upward.
      this.camPos.set(hold.x, camY, this.flightRail.cameraZ)
      this.camTarget.set(hold.x, hold.targetY, horizonTargetZ)
      return
    }

    // Playback: camera locked to raven's shared flight path (same X/Y drift).
    const camY = Math.max(this.minCamY, focusY + this.chaseCamYOffset)
    const targetY = Math.min(
      camY - this.maxLookDown,
      Math.max(this.minTargetY, focusY + this.lookTargetYOffset),
    )

    this.camPos.set(focusX, camY, this.flightRail.cameraZ)
    this.camTarget.set(focusX, targetY, focusZ - this.lookAheadZ)
  }

  update(delta: number, time: number, isPlaying: boolean, analyser: AnalyserNode | null) {
    if (
      !this.renderer ||
      !this.scene ||
      !this.camera ||
      !this.ocean ||
      this.disposed ||
      this.paused ||
      !this.ready
    ) {
      return
    }

    const audio = this.audio.update(delta, time, isPlaying, analyser)
    const ocean = this.ocean

    ocean.deltaTime = Math.min(delta, 0.05)
    ocean.windX = this.baseWindX + audio.bass * 6 + audio.energy * 2.5
    ocean.windY = this.baseWindY + audio.mids * 4 + audio.transient * 3
    ocean.size = Math.min(220, this.baseSize + audio.bass * 22 + audio.swell * 14)
    ocean.choppiness = this.baseChoppiness + audio.mids * 1.4 + audio.highs * 0.6
    ocean.exposure =
      this.baseExposure + audio.energy * 0.045 + audio.highs * 0.022

    const reactiveWind = ocean.windX + ocean.windY
    if (
      Math.abs(reactiveWind - this.prevReactiveWind) > 0.35 ||
      Math.abs(ocean.size - this.prevReactiveSize) > 1.5
    ) {
      ocean.changed = true
      this.prevReactiveWind = reactiveWind
      this.prevReactiveSize = ocean.size
    }

    ocean.materialOcean.uniforms.u_exposure.value = ocean.exposure

    ocean.renderSimulation()

    const motionScale = isPlaying ? 1 : 0.55
    const ravenSendOff =
      !isPlaying &&
      (this.ravenPhase === 'active' ||
        this.ravenPhase === 'entering' ||
        this.ravenPhase === 'exiting')
    const forwardSpeed = isPlaying
      ? this.baseForwardSpeed * (0.85 + audio.energy * 0.15)
      : ravenSendOff
        ? this.baseIdleForwardSpeed * 1.35
        : this.baseIdleForwardSpeed
    this.travelZ -= delta * forwardSpeed
    ocean.oceanScrollZ = this.travelZ

    if (this.scene) {
      this.skyboxRotation.y = this.travelZ * 0.012
      this.skyboxRotation.x = Math.sin(time * 0.05) * 0.008
      this.scene.backgroundRotation = this.skyboxRotation
      const fog = this.scene.fog
      if (fog instanceof THREE.FogExp2) {
        fog.density = 0.00105 + Math.abs(Math.sin(this.travelZ * 0.004)) * 0.00028
      }
    }

    const interactTargetX = this.pointerActive
      ? this.targetTiltX
      : this.deviceTiltActive
        ? this.deviceTiltX
        : 0
    const interactTargetY = this.pointerActive
      ? this.targetTiltY
      : this.deviceTiltActive
        ? this.deviceTiltY
        : 0
    const tiltLerp = this.pointerActive || this.deviceTiltActive ? 9 : 5
    this.smoothedTiltX = lerp(this.smoothedTiltX, interactTargetX, delta * tiltLerp)
    this.smoothedTiltY = lerp(this.smoothedTiltY, interactTargetY, delta * tiltLerp)

    this.updateFlightRail(time)
    this.updateFlightPathOffset(time, motionScale)
    this.updateRavenState(delta, time, isPlaying, motionScale)
    this.updateChaseCamera(time, motionScale, delta, isPlaying)

    this.applyCameraTilt()
    this.tiltedCamTarget.y = Math.max(
      this.minTargetY,
      Math.min(this.tiltedCamTarget.y, this.camPos.y - 0.8),
    )
    this.camPos.y = Math.max(this.absoluteMinCamY, Math.max(this.minCamY, this.camPos.y))
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.tiltedCamTarget)

    if (this.ravenPhase === 'active') {
      const clampedZ = this.clampRavenZForFrustum(this.ravenPos.z, this.ravenPos.y)
      if (clampedZ !== this.ravenPos.z) {
        this.ravenPos.z = clampedZ
        if (this.ravenGroup) this.ravenGroup.position.z = clampedZ
      }
    }

    ocean.update()

    if (typeof window !== 'undefined') {
      const win = window as Window & {
        __fftOceanCameraY?: number
        __fftOceanCameraZ?: number
        __fftOceanTravelZ?: number
        __fftOceanScrollZ?: number
        __fftOceanRavenY?: number
        __fftOceanRavenZ?: number
        __fftOceanRavenPhase?: string
        __fftOceanIsPlaying?: boolean
      }
      win.__fftOceanCameraY = this.camPos.y
      win.__fftOceanCameraZ = this.camPos.z
      win.__fftOceanTravelZ = this.travelZ
      win.__fftOceanScrollZ = this.travelZ * ocean.oceanScrollGain
      win.__fftOceanRavenY = this.ravenPhase !== 'hidden' ? this.ravenPos.y : undefined
      win.__fftOceanRavenZ = this.ravenPhase !== 'hidden' ? this.ravenPos.z : undefined
      win.__fftOceanRavenPhase = this.ravenPhase
      win.__fftOceanIsPlaying = isPlaying
    }

    if (this.eveningLight) {
      this.eveningLight.intensity =
        (0.72 + audio.mids * 0.18 + audio.energy * 0.12) * SCENE_DARKEN
    }

    try {
      this.renderer.setRenderTarget(null)
      this.renderer.render(this.scene, this.camera)
    } catch {
      // Skip frame on shader/runtime failure.
    }
  }

  getBandLevels() {
    return {
      bass: this.audio.smoothedBass,
      mids: this.audio.smoothedMids,
      highs: this.audio.smoothedHighs,
      phase: this.audio.phase,
    }
  }

  /** Debug hook for camera altitude regression checks. */
  getCameraAltitude() {
    return this.camPos.y
  }

  dispose() {
    this.disposed = true
    this.paused = false
    this.savedPixelRatio = null
    this.ready = false
    this.initPromise = null
    this.skyboxLoadGeneration += 1
    this.lastTrackId = null

    this.ocean?.dispose()
    this.ocean = null

    if (this.ravenMixer) {
      this.ravenMixer.stopAllAction()
      this.ravenMixer = null
    }
    if (this.ravenGroup) {
      this.ravenGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((material) => material.dispose())
        }
      })
      this.ravenGroup.parent?.remove(this.ravenGroup)
      this.ravenGroup = null
    }
    this.ravenPhase = 'hidden'
    this.exitCamHold = null
    this.ravenLoadStarted = false

    this.skybox?.dispose()
    this.skybox = null

    if (this.renderer) {
      this.renderer.dispose()
      if (this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
      }
      this.renderer = null
    }

    this.scene = null
    this.camera = null
    this.eveningLight = null
    this.container = null
  }
}
