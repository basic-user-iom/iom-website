// TSL node callbacks are not fully typed in three@0.181.
// @ts-nocheck
import type { WebGPURenderer } from 'three/webgpu'
import type { MusicPlayerVisualizerLike } from './musicPlayerVisualizerTypes'
import { MusicPlayerAudioDriver, clamp, lerp } from './musicPlayerVisualizerAudio'
import { getDeviceProfile } from './device'

const EVENING_LIGHT_DIR = { x: -0.28, y: 0.52, z: -0.38 }

type SeaOptions = {
  lowPower: boolean
  maxPixelRatio: number
  seaSegments: number
  smallWaveIterations: number
}

type SeaUniforms = {
  emissiveColor: { value: { set: (hex: number) => void } }
  emissiveLow: { value: number }
  emissiveHigh: { value: number }
  emissivePower: { value: number }
  largeWavesFrequency: { value: { x: number; y: number } }
  largeWavesSpeed: { value: number }
  largeWavesMultiplier: { value: number }
  smallWavesIterations: { value: number }
  smallWavesFrequency: { value: number }
  smallWavesSpeed: { value: number }
  smallWavesMultiplier: { value: number }
  uBass: { value: number }
  uMids: { value: number }
  uHighs: { value: number }
  uEnergy: { value: number }
}

export class MusicPlayerRagingSeaVisualizer implements MusicPlayerVisualizerLike {
  private renderer: WebGPURenderer | null = null
  private camera: import('three').PerspectiveCamera | null = null
  private scene: import('three').Scene | null = null
  private seaMesh: import('three').Mesh | null = null
  private eveningLight: import('three').DirectionalLight | null = null
  private seaUniforms: SeaUniforms | null = null
  private container: HTMLElement | null = null
  private audio = new MusicPlayerAudioDriver()
  private travelZ = 0
  private camPos = { x: 0, y: 0.95, z: 2.4 }
  private camTarget = { x: 0, y: 0.08, z: -2.8 }
  private targetTiltX = 0
  private targetTiltY = 0
  private smoothedTiltX = 0
  private smoothedTiltY = 0
  private pointerActive = false
  private deviceTiltX = 0
  private deviceTiltY = 0
  private deviceTiltActive = false
  private prefersReducedMotion = false
  private options: SeaOptions = {
    lowPower: true,
    maxPixelRatio: 1,
    seaSegments: 160,
    smallWaveIterations: 3,
  }
  private baseMaxPixelRatio = 1
  private baseSeaSegments = 160
  private fullscreenMode = false
  private width = 1
  private height = 1
  private disposed = false
  private paused = false
  private savedPixelRatio: number | null = null
  private initPromise: Promise<void> | null = null
  private webgpuReady = false
  private planeExtent = 6

  constructor() {
    const profile = getDeviceProfile()
    this.prefersReducedMotion = profile.prefersReducedMotion
    this.baseMaxPixelRatio = profile.visualizerMaxPixelRatio
    this.baseSeaSegments = profile.isMobile ? 128 : profile.isLowPower ? 144 : 192
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
      seaSegments: fs
        ? Math.max(96, Math.floor(this.baseSeaSegments * (profile.isMobile ? 0.68 : 0.58)))
        : this.baseSeaSegments,
      smallWaveIterations: fs ? (profile.isMobile ? 2 : 3) : profile.isMobile ? 3 : 4,
    }
    if (this.seaUniforms) {
      this.seaUniforms.smallWavesIterations.value = this.options.smallWaveIterations
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

  async mount(container: HTMLElement) {
    if (this.container === container && this.renderer && this.webgpuReady) return
    this.dispose()
    this.disposed = false
    this.travelZ = 0
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
    if (!navigator.gpu) {
      throw new Error('WebGPU unavailable')
    }

    const THREE = await import('three/webgpu')
    const {
      float,
      mx_noise_float,
      Loop,
      color,
      positionLocal,
      positionWorld,
      sin,
      vec2,
      vec3,
      mul,
      time,
      uniform,
      Fn,
      transformNormalToView,
      dot,
      normalize,
      cross,
      pow,
      max,
      reflect,
      add,
      cameraPosition,
    } = await import('three/tsl')

    const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 40)
    camera.position.set(this.camPos.x, this.camPos.y, this.camPos.z)
    this.camera = camera

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x101828)
    scene.fog = new THREE.FogExp2(0x101828, 0.028)
    this.scene = scene

    const eveningLight = new THREE.DirectionalLight(0x8898b8, 1.15)
    eveningLight.position.set(
      EVENING_LIGHT_DIR.x * 8,
      EVENING_LIGHT_DIR.y * 8,
      EVENING_LIGHT_DIR.z * 8,
    )
    scene.add(eveningLight)
    this.eveningLight = eveningLight

    const ambient = new THREE.AmbientLight(0x2a3548, 0.95)
    scene.add(ambient)

    const hemi = new THREE.HemisphereLight(0x3a4558, 0x0a1420, 0.62)
    scene.add(hemi)

    const material = new THREE.MeshStandardNodeMaterial({
      color: '#1e3458',
      roughness: 0.14,
      metalness: 0.08,
    })

    const emissiveColor = uniform(color('#e0ecff'))
    const emissiveLow = uniform(-0.18)
    const emissiveHigh = uniform(0.22)
    const emissivePower = uniform(4.8)
    const largeWavesFrequency = uniform(vec2(2.8, 1.05))
    const largeWavesSpeed = uniform(1.05)
    const largeWavesMultiplier = uniform(0.07)
    const smallWavesIterations = uniform(this.options.smallWaveIterations)
    const smallWavesFrequency = uniform(2.1)
    const smallWavesSpeed = uniform(0.26)
    const smallWavesMultiplier = uniform(0.09)
    const normalComputeShift = uniform(0.01)
    const uBass = uniform(0)
    const uMids = uniform(0)
    const uHighs = uniform(0)
    const uEnergy = uniform(0)
    const keyLightDir = uniform(
      normalize(vec3(EVENING_LIGHT_DIR.x, EVENING_LIGHT_DIR.y, EVENING_LIGHT_DIR.z)),
    )

    this.seaUniforms = {
      emissiveColor,
      emissiveLow,
      emissiveHigh,
      emissivePower,
      largeWavesFrequency,
      largeWavesSpeed,
      largeWavesMultiplier,
      smallWavesIterations,
      smallWavesFrequency,
      smallWavesSpeed,
      smallWavesMultiplier,
      uBass,
      uMids,
      uHighs,
      uEnergy,
    }

    const wavesElevation = Fn(([position]) => {
      const elevation = mul(
        sin(position.x.mul(largeWavesFrequency.x).add(time.mul(largeWavesSpeed))),
        sin(position.z.mul(largeWavesFrequency.y).add(time.mul(largeWavesSpeed))),
        largeWavesMultiplier,
      ).toVar()

      Loop({ start: float(1), end: smallWavesIterations.add(1) }, ({ i }) => {
        const noiseInput = vec3(
          position.xz.add(2).mul(smallWavesFrequency).mul(i),
          time.mul(smallWavesSpeed),
        )
        const wave = mx_noise_float(noiseInput, 1, 0)
          .mul(smallWavesMultiplier)
          .div(i)
          .abs()
        elevation.subAssign(wave)
      })

      return elevation
    })

    const elevation = wavesElevation(positionLocal)
    const position = positionLocal.add(vec3(0, elevation, 0))
    material.positionNode = position

    let positionA = positionLocal.add(vec3(normalComputeShift, 0, 0))
    let positionB = positionLocal.add(vec3(0, 0, normalComputeShift.negate()))
    positionA = positionA.add(vec3(0, wavesElevation(positionA), 0))
    positionB = positionB.add(vec3(0, wavesElevation(positionB), 0))

    const toA = positionA.sub(position).normalize()
    const toB = positionB.sub(position).normalize()
    const surfaceNormal = toA.cross(toB)
    material.normalNode = transformNormalToView(surfaceNormal)

    const crestEmissive = elevation
      .remap(emissiveHigh, emissiveLow)
      .pow(emissivePower)
      .mul(emissiveColor)

    const viewDir = normalize(cameraPosition.sub(positionWorld))
    const lightDir = keyLightDir
    const spec = pow(
      max(dot(reflect(lightDir.negate(), surfaceNormal), viewDir), float(0.0)),
      float(48),
    )
    const specTint = vec3(0.52, 0.58, 0.68).mul(spec).mul(0.22).mul(uHighs.mul(0.35).add(0.28))

    material.emissiveNode = add(crestEmissive, specTint)

    const segments = this.options.seaSegments
    const geometry = new THREE.PlaneGeometry(this.planeExtent, this.planeExtent, segments, segments)
    geometry.rotateX(-Math.PI * 0.5)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    this.seaMesh = mesh

    const renderer = new THREE.WebGPURenderer({
      antialias: !this.options.lowPower,
      alpha: false,
      powerPreference: this.options.lowPower ? 'low-power' : 'high-performance',
    })
    renderer.setClearColor(0x101828, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.className = 'music-player-canvas'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    container.prepend(renderer.domElement)
    this.renderer = renderer

    await renderer.init()
    if (this.disposed) return
    this.webgpuReady = true

    this.resize(container.clientWidth, container.clientHeight)
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

  update(
    delta: number,
    time: number,
    isPlaying: boolean,
    analyser: AnalyserNode | null,
  ) {
    if (!this.renderer || !this.scene || !this.camera || this.disposed || this.paused || !this.webgpuReady) {
      return
    }

    const audio = this.audio.update(delta, time, isPlaying, analyser)
    const uniforms = this.seaUniforms
    if (uniforms) {
      uniforms.uBass.value = audio.bass
      uniforms.uMids.value = audio.mids
      uniforms.uHighs.value = audio.highs
      uniforms.uEnergy.value = audio.energy
      uniforms.largeWavesSpeed.value = 0.85 + audio.energy * 1.1 + audio.bass * 0.35
      uniforms.largeWavesMultiplier.value = 0.06 + audio.bass * 0.09 + audio.energy * 0.025
      uniforms.smallWavesMultiplier.value = 0.07 + audio.mids * 0.065 + audio.detail * 0.03
      uniforms.smallWavesSpeed.value = 0.2 + audio.anim * 0.22
      uniforms.emissiveHigh.value = 0.04 + audio.highs * 0.08 + audio.energy * 0.03
      uniforms.emissivePower.value = 5.5 + audio.highs * 2.5
    }

    const bobScale = isPlaying ? 0.55 + audio.swell * 0.22 : 0.35
    const forwardSpeed = isPlaying ? 0.42 : 0.28
    this.travelZ -= delta * forwardSpeed

    const heave =
      (Math.sin(time * 0.24) * 0.028 + Math.sin(time * 0.37 + 1.3) * 0.01) * bobScale
    const pitch =
      Math.sin(time * 0.18 + 0.6) * 0.012 * bobScale +
      Math.sin(time * 0.24 + 0.3) * 0.018 * bobScale
    const roll = Math.sin(time * 0.14 + 2.0) * 0.012 * bobScale
    const swayX = Math.sin(time * 0.08 + 0.4) * 0.018 * bobScale
    const swayZ = Math.sin(time * 0.06 + 1.1) * 0.012 * bobScale

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

    const maxYaw = 0.16
    const maxPitch = 0.11
    const tiltYaw = this.smoothedTiltX * maxYaw
    const tiltPitch = this.smoothedTiltY * maxPitch

    this.camPos.x = swayX + Math.sin(tiltYaw) * 0.08
    this.camPos.y = 0.92 + heave
    this.camPos.z = 2.2 + this.travelZ + swayZ

    this.camTarget.x = roll * 0.35 + tiltYaw * 0.4
    this.camTarget.y = 0.06 + pitch * 1.4 + tiltPitch * 0.25
    this.camTarget.z = -2.6 + this.travelZ + roll * 0.06

    this.camera.position.set(this.camPos.x, this.camPos.y, this.camPos.z)
    this.camera.lookAt(this.camTarget.x, this.camTarget.y, this.camTarget.z)

    if (this.seaMesh) {
      const half = this.planeExtent * 0.5
      this.seaMesh.position.x = Math.floor(this.camPos.x / half) * half
      this.seaMesh.position.z = Math.floor(this.camPos.z / half) * half
    }

    if (this.eveningLight) {
      this.eveningLight.intensity = 0.85 + audio.mids * 0.28 + audio.energy * 0.18
    }

    try {
      this.renderer.render(this.scene, this.camera)
    } catch {
      // Shader/runtime failure — skip frame instead of breaking the player loop.
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

  dispose() {
    this.disposed = true
    this.paused = false
    this.savedPixelRatio = null
    this.webgpuReady = false
    this.initPromise = null
    this.seaUniforms = null

    this.seaMesh?.geometry.dispose()
    ;(this.seaMesh?.material as import('three').Material | undefined)?.dispose()
    this.seaMesh = null

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

export async function isWebGPUSupported(): Promise<boolean> {
  if (!navigator.gpu) return false
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter != null
  } catch {
    return false
  }
}
