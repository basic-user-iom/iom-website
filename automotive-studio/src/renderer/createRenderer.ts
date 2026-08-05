import {
  AmbientLight,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  Scene,
  SpotLight,
  Vector3,
  type WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { probeRenderBackend, type BackendProbe, type RenderBackend } from './backend'
import { createIblCache, iblFamilyForPreset } from './createIbl'
import {
  applyEnvironment,
  attachEnvironmentDecor,
  resolveVisualPreset,
  stagePolicyForPreset,
  type EnvironmentHandles,
} from '../environment/applyEnvironment'
import type { AccentLightState, EnvironmentState, StageState, VehicleLightsState } from '../persistence/schema'
import { createEmptyProject } from '../persistence/schema'
import { createContactShadow } from './contactShadow'
import { infiniteFloorTextureOffset } from './infiniteFloorUv'
import { createBloomComposer } from './createBloomComposer'
import {
  applyStageSurfaceMaterial,
  disposeStageTextureCache,
  setStageTextureAnisotropy,
} from '../stage/stageMaterials'

export interface StudioRenderer {
  backend: RenderBackend
  probe: BackendProbe
  canvas: HTMLCanvasElement
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  controls: OrbitControls
  environment: EnvironmentHandles
  applyEnvironmentState: (env: EnvironmentState) => void
  applyStageState: (stage: StageState) => void
  applyAccentLights: (accent: AccentLightState) => void
  applyBloom: (cfg: Pick<VehicleLightsState, 'bloomEnabled' | 'bloomStrength' | 'bloomThreshold'>) => void
  bloomSupported: boolean
  /** Keep the sun shadow map centred on the vehicle so coverage stays even on large routes. */
  updateShadowFocus: (worldXz: Vector3 | null) => void
  updateContactShadow: (target: import('three').Object3D | null) => void
  /**
   * Free-drive: large plane that follows the vehicle so you never reach an edge.
   * Hides cyclorama / pedestal while active; restores stage geometry when off.
   */
  setInfiniteFloor: (enabled: boolean) => void
  updateFloorFollow: (worldXz: Vector3 | null) => void
  getEnvMap: () => import('three').Texture | null
  setOrbitEnabled: (enabled: boolean) => void
  isOrbitEnabled: () => boolean
  setFloorSize: (metres: number) => void
  getFloorSize: () => number
  frameTo: (center: Vector3, radius: number) => void
  setSize: (width: number, height: number) => void
  render: () => void
  dispose: () => void
}

/**
 * Prefer WebGPU when available; fall back to WebGL2.
 * ?forceWebGL2=1 forces the WebGL path.
 */
export async function createStudioRenderer(
  host: HTMLElement,
): Promise<StudioRenderer> {
  const probe = await probeRenderBackend()
  const canvas = document.createElement('canvas')
  canvas.className = 'as-canvas'
  canvas.setAttribute('aria-label', 'Automotive studio viewport')
  canvas.tabIndex = 0
  host.appendChild(canvas)

  const scene = new Scene()
  scene.background = new Color(0x0c0e12)

  const camera = new PerspectiveCamera(40, 1, 0.1, 800)
  camera.position.set(4.2, 1.8, 5.4)
  camera.lookAt(0, 0.6, 0)

  const floor: Mesh = new Mesh(
    new CircleGeometry(14, 96),
    new MeshStandardMaterial({
      color: 0x161a22,
      metalness: 0.35,
      roughness: 0.55,
    }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.name = 'StudioFloor'
  scene.add(floor)
  let floorSizeMetres = 24
  let infiniteFloor = false
  const INFINITE_FLOOR_METRES = 400

  const pedestal = new Mesh(
    new CircleGeometry(2.4, 64),
    new MeshStandardMaterial({
      color: 0x1c222c,
      metalness: 0.45,
      roughness: 0.4,
      // Avoid z-fighting with the floor circle (shared XY plane).
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  )
  pedestal.rotation.x = -Math.PI / 2
  pedestal.position.y = 0.012
  pedestal.receiveShadow = true
  pedestal.name = 'StudioPedestal'
  pedestal.renderOrder = 1
  scene.add(pedestal)

  // Open-backed cyclorama (half cylinder) for product-studio look.
  // Same radius as the floor so the pad meets the wall with no annular gap.
  const CYC_THETA_START = Math.PI * 0.15
  const CYC_THETA_LENGTH = Math.PI * 1.7
  let cycloramaHeightMetres = 10
  const cyclorama = new Mesh(
    new CylinderGeometry(14, 14, cycloramaHeightMetres, 48, 1, true, CYC_THETA_START, CYC_THETA_LENGTH),
    new MeshStandardMaterial({
      color: 0x1a1f28,
      metalness: 0.05,
      roughness: 0.92,
      side: DoubleSide,
    }),
  )
  cyclorama.position.set(0, cycloramaHeightMetres * 0.5, 0)
  cyclorama.receiveShadow = true
  cyclorama.name = 'StudioCyclorama'
  scene.add(cyclorama)

  const accentGroup = new Group()
  accentGroup.name = 'AccentLights'
  const accentKey = new SpotLight(0xffe8d0, 0, 28, Math.PI / 5, 0.45, 1.2)
  accentKey.position.set(3.5, 4.2, 4)
  accentKey.target.position.set(0, 0.8, 0)
  accentKey.castShadow = false
  const accentFill = new SpotLight(0xc8d8ff, 0, 24, Math.PI / 4.5, 0.5, 1.2)
  accentFill.position.set(-4, 3.2, 2.5)
  accentFill.target.position.set(0, 0.7, 0)
  const accentRim = new PointLight(0xfff0e0, 0, 18, 1.4)
  accentRim.position.set(0.5, 2.8, -5)
  accentGroup.add(accentKey, accentKey.target, accentFill, accentFill.target, accentRim)

  const volumetricGroup = new Group()
  volumetricGroup.name = 'AccentVolumetrics'
  volumetricGroup.visible = false
  const glowMat = new MeshBasicMaterial({
    color: 0xffe2c0,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
  })
  for (const [x, z, rot] of [
    [4.2, 3.2, -0.6],
    [-4.2, 2.6, 0.55],
    [0.2, -5.2, 0],
  ] as const) {
    const plane = new Mesh(new PlaneGeometry(2.4, 5.5), glowMat.clone())
    plane.position.set(x, 2.4, z)
    plane.rotation.y = rot
    volumetricGroup.add(plane)
  }
  accentGroup.add(volumetricGroup)
  scene.add(accentGroup)
  accentGroup.visible = false

  const hemi = new HemisphereLight(0xb8c0cc, 0x2a303a, 0.45)
  scene.add(hemi)

  const ambient = new AmbientLight(0xb8c0cc, 0.12)
  scene.add(ambient)

  const sun = new DirectionalLight(0xfff2e0, 1.15)
  sun.position.set(4, 8, 3)
  sun.castShadow = true
  sun.shadow.mapSize.set(4096, 4096)
  // Tight orthographic window around the focus point (vehicle) — not the whole floor.
  // Expanding with floor size made shadows vanish or pixelate far from the origin.
  const SHADOW_HALF = 16
  const SUN_DISTANCE = 36
  const FILL_DISTANCE = 24
  const RIM_DISTANCE = 22
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 90
  sun.shadow.camera.left = -SHADOW_HALF
  sun.shadow.camera.right = SHADOW_HALF
  sun.shadow.camera.top = SHADOW_HALF
  sun.shadow.camera.bottom = -SHADOW_HALF
  sun.shadow.bias = -0.00015
  sun.shadow.normalBias = 0.04
  sun.shadow.camera.updateProjectionMatrix()
  scene.add(sun)
  scene.add(sun.target)

  // Soft fill — also casts so cabin gets a second soft shade pass through open glass.
  const fill = new DirectionalLight(0xa8c0ff, 0.32)
  fill.position.set(-5, 3, -2)
  fill.castShadow = true
  fill.shadow.mapSize.set(1024, 1024)
  fill.shadow.camera.near = 0.5
  fill.shadow.camera.far = 60
  fill.shadow.camera.left = -10
  fill.shadow.camera.right = 10
  fill.shadow.camera.top = 10
  fill.shadow.camera.bottom = -10
  fill.shadow.bias = -0.0002
  fill.shadow.normalBias = 0.05
  scene.add(fill)
  scene.add(fill.target)

  const rim = new DirectionalLight(0xe8dcc8, 0.4)
  rim.position.set(2, 4, -6)
  scene.add(rim)

  const sunDir = new Vector3(4, 8, 3).normalize()
  const fillDir = new Vector3(-5, 3, -2).normalize()
  const rimDir = new Vector3(2, 4, -6).normalize()
  const shadowFocus = new Vector3(0, 0.4, 0)

  const celestial = attachEnvironmentDecor(scene)
  const contactShadow = createContactShadow()
  scene.add(contactShadow.mesh)
  contactShadow.mesh.visible = false

  const environment: EnvironmentHandles = {
    scene,
    sun,
    fill,
    rim,
    hemi,
    ambient,
    floor,
    pedestal,
    celestial,
    skyDome: celestial.skyDome,
    stars: celestial.stars,
    moon: celestial.moon,
    sunDisc: celestial.sunDisc,
  }

  let renderer: WebGLRenderer
  let backend: RenderBackend = probe.preferred

  if (probe.preferred === 'webgpu') {
    try {
      const { WebGPURenderer } = await import('three/webgpu')
      const gpuRenderer = new WebGPURenderer({
        canvas,
        antialias: true,
        forceWebGL: false,
      })
      await gpuRenderer.init()
      renderer = gpuRenderer as unknown as WebGLRenderer
      backend = 'webgpu'
    } catch (err) {
      console.warn('[automotive-studio] WebGPU init failed; falling back to WebGL2', err)
      const { WebGLRenderer } = await import('three')
      renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false })
      backend = 'webgl2'
      probe.note = `${probe.note} WebGPU init failed; using WebGL2.`
    }
  } else if (probe.preferred === 'webgl2') {
    const { WebGLRenderer } = await import('three')
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false })
    backend = 'webgl2'
  } else {
    const { WebGLRenderer } = await import('three')
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false })
    backend = 'unavailable'
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  setStageTextureAnisotropy(
    (renderer as WebGLRenderer).capabilities?.getMaxAnisotropy?.() ?? 1,
  )
  // Soft maps are a WebGL2 feature; skip on WebGPU to avoid odd clear/black frames.
  if (backend === 'webgl2') {
    try {
      const three = await import('three')
      if ('PCFSoftShadowMap' in three) {
        ;(renderer as WebGLRenderer & { shadowMap: { type: number } }).shadowMap.type =
          three.PCFSoftShadowMap
      }
    } catch {
      /* ignore */
    }
  }
  // Automotive paint needs filmic response; ACES is the default look for product shots.
  const anyRenderer = renderer as WebGLRenderer & {
    toneMapping?: number
    toneMappingExposure?: number
    outputColorSpace?: string
  }
  try {
    const three = await import('three')
    anyRenderer.toneMapping = three.ACESFilmicToneMapping
    anyRenderer.toneMappingExposure = 1
    if ('SRGBColorSpace' in three) {
      anyRenderer.outputColorSpace = three.SRGBColorSpace as unknown as string
    }
  } catch {
    /* WebGPU path may expose tone mapping differently — presets still drive lights. */
  }

  let iblCache: Awaited<ReturnType<typeof createIblCache>> | null = null
  try {
    iblCache = await createIblCache(renderer, backend)
    if (!iblCache.ok) {
      console.warn('[automotive-studio] IBL unavailable:', iblCache.error)
    } else {
      scene.environment = iblCache.get('studio')
      scene.environmentIntensity = 1
    }
  } catch (err) {
    console.warn('[automotive-studio] IBL init threw', err)
    iblCache = null
  }

  let lastStage: StageState = createEmptyProject().stage
  let lastEnv: EnvironmentState = createEmptyProject().environment

  const updateShadowFocus = (worldXz: Vector3 | null) => {
    if (worldXz) {
      shadowFocus.set(worldXz.x, 0.4, worldXz.z)
    } else {
      shadowFocus.set(0, 0.4, 0)
    }
    sun.target.position.copy(shadowFocus)
    sun.position.copy(sunDir).multiplyScalar(SUN_DISTANCE).add(shadowFocus)
    sun.target.updateMatrixWorld()
    fill.position.copy(fillDir).multiplyScalar(FILL_DISTANCE).add(shadowFocus)
    fill.target.position.copy(shadowFocus)
    fill.target.updateMatrixWorld()
    rim.position.copy(rimDir).multiplyScalar(RIM_DISTANCE).add(shadowFocus)
  }

  const applyEnvironmentState = (env: EnvironmentState) => {
    lastEnv = env
    applyEnvironment(environment, env)
    // Capture light directions after env apply (which places lights relative to origin).
    sunDir.copy(sun.position).sub(sun.target.position).normalize()
    fillDir.copy(fill.position).normalize()
    rimDir.copy(rim.position).normalize()
    updateShadowFocus(shadowFocus.x !== 0 || shadowFocus.z !== 0 ? shadowFocus : null)

    // Camera exposure only — light power is owned by the preset look.
    if (typeof anyRenderer.toneMappingExposure === 'number') {
      anyRenderer.toneMappingExposure = Math.max(0.4, Math.min(1.8, env.exposure))
    }

    const visual = resolveVisualPreset(env)
    const family = iblFamilyForPreset(visual)
    const map = iblCache?.get(family) ?? null
    if (map) {
      scene.environment = map
      scene.environmentIntensity = Math.max(0.2, Math.min(2.5, env.environmentIntensity))
    }

    const policy = stagePolicyForPreset(visual)
    // Correlate cyclorama with preset unless the author explicitly hid the floor stage.
    if (!infiniteFloor && lastStage.floorVisible !== false) {
      cyclorama.visible = policy.cycloramaVisible && lastStage.cycloramaVisible
    }
    if (infiniteFloor) cyclorama.visible = false
    contactShadow.setOpacity(policy.contactOpacity)
  }

  applyEnvironmentState(createEmptyProject().environment)

  const applyStageState = (stage: StageState) => {
    lastStage = stage
    floor.visible = stage.floorVisible
    const visual = resolveVisualPreset(lastEnv)
    const policy = stagePolicyForPreset(visual)

    if (infiniteFloor) {
      pedestal.visible = false
      cyclorama.visible = false
      void applyStageSurfaceMaterial(floor, stage.floor)
      syncInfiniteFloorTextures(0, 0)
      return
    }

    pedestal.visible = stage.pedestalVisible && stage.floorVisible
    cyclorama.visible = stage.cycloramaVisible && policy.cycloramaVisible

    const floorDiameter = Math.max(8, Math.min(500, stage.floorSize || 28))
    const pedestalDiameter = Math.max(0.5, Math.min(40, stage.pedestalSize || 4.8))
    const cycRadius = Math.max(6, Math.min(250, stage.cycloramaSize || 14))
    const cycHeight = Math.max(2, Math.min(80, stage.cycloramaHeight || 10))
    floorSizeMetres = floorDiameter
    cycloramaHeightMetres = cycHeight

    floor.geometry.dispose()
    floor.geometry = new CircleGeometry(Math.max(floorDiameter, cycRadius * 2 + 0.3) * 0.5, 96)
    floor.position.set(0, 0, 0)

    pedestal.geometry.dispose()
    pedestal.geometry = new CircleGeometry(pedestalDiameter * 0.5, 64)

    cyclorama.geometry.dispose()
    cyclorama.geometry = new CylinderGeometry(
      cycRadius,
      cycRadius,
      cycHeight,
      48,
      1,
      true,
      CYC_THETA_START,
      CYC_THETA_LENGTH,
    )
    cyclorama.position.y = cycHeight * 0.5

    void applyStageSurfaceMaterial(floor, stage.floor)
    void applyStageSurfaceMaterial(pedestal, stage.pedestal, { polygonOffset: true })
    void applyStageSurfaceMaterial(cyclorama, stage.cyclorama)
  }

  const syncInfiniteFloorTextures = (worldX: number, worldZ: number) => {
    const mat = floor.material as MeshStandardMaterial
    const size = INFINITE_FLOOR_METRES
    // Keep the tile size the user dialled on the finite floor, so switching to
    // free drive doesn't blow the texture up by the plane's size ratio.
    const stageFloorMetres = Math.max(8, Math.min(500, lastStage.floorSize || 28))
    const tiles = Math.max(0.0625, Math.min(1024, lastStage.floor.mapRepeat || 4))
    const repeat = Math.min(4096, (size / stageFloorMetres) * tiles)
    const maps = [
      mat.map,
      mat.normalMap,
      mat.roughnessMap,
      mat.metalnessMap,
      mat.aoMap,
      mat.emissiveMap,
      mat.displacementMap,
    ]
    for (const tex of maps) {
      if (!tex) continue
      tex.wrapS = RepeatWrapping
      tex.wrapT = RepeatWrapping
      tex.repeat.set(repeat, repeat)
      // Keep world-locked tiling while the plane follows the car.
      infiniteFloorTextureOffset(worldX, worldZ, repeat, size, tex.offset)
      tex.needsUpdate = true
    }
  }

  const setInfiniteFloor = (enabled: boolean) => {
    if (infiniteFloor === enabled) return
    infiniteFloor = enabled
    if (enabled) {
      floor.geometry.dispose()
      floor.geometry = new PlaneGeometry(INFINITE_FLOOR_METRES, INFINITE_FLOOR_METRES, 1, 1)
      floor.rotation.x = -Math.PI / 2
      pedestal.visible = false
      cyclorama.visible = false
      floorSizeMetres = INFINITE_FLOOR_METRES
      void applyStageSurfaceMaterial(floor, lastStage.floor)
      syncInfiniteFloorTextures(floor.position.x, floor.position.z)
    } else {
      floor.position.set(0, 0, 0)
      applyStageState(lastStage)
    }
  }

  const updateFloorFollow = (worldXz: Vector3 | null) => {
    if (!infiniteFloor || !worldXz) return
    floor.position.x = worldXz.x
    floor.position.z = worldXz.z
    syncInfiniteFloorTextures(worldXz.x, worldXz.z)
  }

  const applyAccentLights = (accent: AccentLightState) => {
    const on = Boolean(accent.enabled)
    accentGroup.visible = on
    const intensity = Math.max(0, Math.min(2, accent.intensity ?? 1))
    accentKey.intensity = on ? 1.35 * intensity : 0
    accentFill.intensity = on ? 0.85 * intensity : 0
    accentRim.intensity = on ? 0.55 * intensity : 0
    volumetricGroup.visible = on && Boolean(accent.volumetricEnabled)
    for (const child of volumetricGroup.children) {
      const mat = (child as Mesh).material as MeshBasicMaterial
      mat.opacity = 0.05 + 0.05 * intensity
    }
  }

  applyStageState(createEmptyProject().stage)
  applyAccentLights(createEmptyProject().accentLights)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.target.set(0, 0.6, 0)
  controls.minDistance = 1.2
  controls.maxDistance = 400
  controls.maxPolarAngle = Math.PI * 0.49
  controls.enablePan = true
  // Off until author toggles "Free camera" — avoids fighting inspector scrubbing.
  controls.enabled = false

  const bloom = createBloomComposer(renderer, scene, camera, backend)
  const defaults = createEmptyProject().vehicleLights
  bloom.apply({
    enabled: defaults.bloomEnabled,
    strength: defaults.bloomStrength,
    threshold: defaults.bloomThreshold,
    radius: 0.4,
  })

  const setSize = (width: number, height: number) => {
    const w = Math.max(1, Math.floor(width))
    const h = Math.max(1, Math.floor(height))
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
    bloom.setSize(w, h)
  }

  const render = () => {
    if (controls.enabled) controls.update()
    celestial.update(camera)
    bloom.render()
  }

  const dispose = () => {
    controls.dispose()
    bloom.dispose()
    contactShadow.dispose()
    floor.geometry.dispose()
    ;(floor.material as MeshStandardMaterial).dispose()
    pedestal.geometry.dispose()
    ;(pedestal.material as MeshStandardMaterial).dispose()
    cyclorama.geometry.dispose()
    ;(cyclorama.material as MeshStandardMaterial).dispose()
    for (const child of volumetricGroup.children) {
      const mesh = child as Mesh
      mesh.geometry.dispose()
      ;(mesh.material as MeshBasicMaterial).dispose()
    }
    glowMat.dispose()
    celestial.dispose()
    disposeStageTextureCache()
    iblCache?.dispose()
    renderer.dispose()
    canvas.remove()
  }

  return {
    backend,
    probe: { ...probe, preferred: backend },
    canvas,
    scene,
    camera,
    renderer,
    controls,
    environment,
    applyEnvironmentState,
    applyStageState,
    applyAccentLights,
    applyBloom(cfg) {
      bloom.apply({
        enabled: cfg.bloomEnabled,
        strength: cfg.bloomStrength,
        threshold: cfg.bloomThreshold,
        radius: 0.4,
      })
    },
    bloomSupported: bloom.supported,
    setOrbitEnabled(enabled) {
      controls.enabled = enabled
      canvas.style.cursor = enabled ? 'grab' : ''
      host.dataset.orbit = enabled ? 'on' : 'off'
    },
    isOrbitEnabled: () => controls.enabled,
    setFloorSize(metres: number) {
      // Route can expand the pad; Stage panel still owns absolute sizes via applyStageState.
      if (infiniteFloor) return
      const size = Math.max(12, Math.min(500, Math.round(metres)))
      if (size <= floorSizeMetres + 0.5) return
      floorSizeMetres = size
      const floorRadius = size * 0.5
      floor.geometry.dispose()
      floor.geometry = new CircleGeometry(floorRadius, 96)
      if (size * 0.5 > 14) {
        const cycRadius = Math.max(12, size * 0.5 - 0.15)
        cyclorama.geometry.dispose()
        cyclorama.geometry = new CylinderGeometry(
          cycRadius,
          cycRadius,
          cycloramaHeightMetres,
          48,
          1,
          true,
          CYC_THETA_START,
          CYC_THETA_LENGTH,
        )
        cyclorama.position.y = cycloramaHeightMetres * 0.5
      }
    },
    getFloorSize: () => floorSizeMetres,
    setInfiniteFloor,
    updateFloorFollow,
    frameTo(center, radius) {
      const r = Math.max(1.5, radius)
      camera.position.set(center.x + r * 1.4, center.y + r * 0.55, center.z + r * 1.6)
      controls.target.copy(center).setY(center.y + r * 0.08)
      controls.update()
    },
    setSize,
    render,
    dispose,
    updateShadowFocus,
    updateContactShadow: contactShadow.follow,
    getEnvMap: () => (scene.environment as import('three').Texture | null) ?? null,
  }
}
