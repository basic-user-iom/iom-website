import {
  AdditiveBlending,
  AmbientLight,
  CanvasTexture,
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
  Raycaster,
  RepeatWrapping,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Vector2,
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
import {
  createInfiniteFloorGeometry,
  createTessellatedCircleGeometry,
  stageSurfaceNeedsDisplacement,
} from '../stage/stageGeometry'
import {
  bindCycloramaVideoToMesh,
  disposeCycloramaVideoHandle,
  loadCycloramaVideoHandle,
  toggleCycloramaPlayback,
  type CycloramaVideoHandle,
} from '../stage/cycloramaVideo'

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
  /** Lite: fill shadow off + softer sun map. Full restores Present-quality shadows. */
  applyLightsBudget: (opts: { lite: boolean }) => void
  bloomSupported: boolean
  /** Compile materials/lights now so first lamp toggle does not hitch. */
  warmGpu: () => void
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
  /** Click-to-play when interactive video is bound; returns true if handled. */
  tryCycloramaClick: (clientX: number, clientY: number) => Promise<boolean>
  /** Pointer cursor when hovering interactive cyclorama video. */
  updateCycloramaHover: (clientX: number, clientY: number) => void
  hasCycloramaVideo: () => boolean
  frameTo: (center: Vector3, radius: number) => void
  setSize: (width: number, height: number) => void
  render: () => void
  dispose: () => void
}

/** Radial falloff so the accent glow cards fade out instead of showing their edges. */
function createSoftGlowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.45)')
  g.addColorStop(0.8, 'rgba(255,255,255,0.1)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  return map
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
  floor.renderOrder = 0
  // Lose depth contests against pedestal / contact blob / cyclorama skirts.
  ;(floor.material as MeshStandardMaterial).polygonOffset = true
  ;(floor.material as MeshStandardMaterial).polygonOffsetFactor = 2
  ;(floor.material as MeshStandardMaterial).polygonOffsetUnits = 2
  scene.add(floor)
  let floorSizeMetres = 24
  let infiniteFloor = false
  const INFINITE_FLOOR_METRES = 400
  /** When true, floor/pedestal/cyc use dense meshes so height maps have verts to move. */
  let floorDisplaceTessellated = false
  let pedestalDisplaceTessellated = false
  let cycloramaDisplaceTessellated = false

  const floorRadiusForStage = (floorDiameter: number, cycRadius: number) =>
    Math.max(floorDiameter, cycRadius * 2 + 0.3) * 0.5

  const buildFloorGeometry = (radius: number, displace: boolean) =>
    displace ? createTessellatedCircleGeometry(radius, 96, 48) : new CircleGeometry(radius, 96)

  const buildPedestalGeometry = (radius: number, height: number, displace: boolean) =>
    new CylinderGeometry(radius, radius, height, displace ? 96 : 64, displace ? 16 : 1)

  const buildCycloramaGeometry = (
    radius: number,
    height: number,
    displace: boolean,
  ) =>
    new CylinderGeometry(
      radius,
      radius,
      height,
      displace ? 96 : 48,
      displace ? 32 : 1,
      true,
      CYC_THETA_START,
      CYC_THETA_LENGTH,
    )

  let pedestalHeightMetres = 0.12
  let pedestalDiameterMetres = 4.8
  const pedestal = new Mesh(
    new CylinderGeometry(2.4, 2.4, pedestalHeightMetres, 64),
    new MeshStandardMaterial({
      color: 0x1c222c,
      metalness: 0.45,
      roughness: 0.4,
      // Win over the floor when nearly coplanar (displacement makes this worse).
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  )
  // Cylinder is Y-up — sit clearly above the floor + contact shadow so bottoms
  // never share a plane (z-fight / flicker, worse while the video wall updates).
  const STAGE_Z_EPS = 0.02
  pedestal.position.y = pedestalHeightMetres * 0.5 + STAGE_Z_EPS
  pedestal.receiveShadow = true
  pedestal.castShadow = true
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
  cyclorama.position.set(0, cycloramaHeightMetres * 0.5 + STAGE_Z_EPS, 0)
  // Video wall updates every frame — receiving sun shadows on it + coplanar floor
  // skirts reads as flicker on the pad. Keep the wall unshadowed.
  cyclorama.receiveShadow = false
  cyclorama.castShadow = false
  cyclorama.name = 'StudioCyclorama'
  scene.add(cyclorama)

  // Soft additive glow sheets along the open cyclorama (volume-lighting vibe, WebGL-safe).
  const cycloramaVolGroup = new Group()
  cycloramaVolGroup.name = 'CycloramaVolumetrics'
  cycloramaVolGroup.visible = false
  const cycGlowMat = new MeshBasicMaterial({
    map: createSoftGlowTexture(),
    color: 0xffe8d4,
    transparent: true,
    opacity: 0.04,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
  let cycGlowGeo = new PlaneGeometry(4, 7)
  let cycloramaRadiusMetres = 14
  scene.add(cycloramaVolGroup)

  const rebuildCycloramaVolumetrics = (radius: number, height: number) => {
    for (const child of [...cycloramaVolGroup.children]) {
      cycloramaVolGroup.remove(child)
      child.traverse((obj) => {
        const mesh = obj as Mesh
        if (!mesh.isMesh) return
        const mat = mesh.material as MeshBasicMaterial
        if (mat?.isMeshBasicMaterial && mat !== cycGlowMat) mat.dispose()
      })
    }
    cycGlowGeo.dispose()
    const sheetW = Math.max(2.2, Math.min(10, radius * 0.42))
    const sheetH = Math.max(3, Math.min(28, height * 0.72))
    cycGlowGeo = new PlaneGeometry(sheetW, sheetH)
    const seats = 5
    const inset = Math.max(0.35, radius * 0.04)
    for (let i = 0; i < seats; i++) {
      const t = (i + 0.5) / seats
      const theta = CYC_THETA_START + t * CYC_THETA_LENGTH
      const r = Math.max(1, radius - inset)
      const seat = new Group()
      seat.position.set(Math.sin(theta) * r, height * 0.42, Math.cos(theta) * r)
      // Plane faces +Z locally; point inward toward stage centre.
      seat.rotation.y = theta + Math.PI
      const a = new Mesh(cycGlowGeo, cycGlowMat.clone())
      const b = new Mesh(cycGlowGeo, cycGlowMat.clone())
      b.rotation.y = Math.PI / 2
      seat.add(a, b)
      cycloramaVolGroup.add(seat)
    }
  }
  rebuildCycloramaVolumetrics(14, cycloramaHeightMetres)

  const syncCycloramaVolumetrics = (stage: StageState, cycVisible: boolean) => {
    // Soft glow sheets sit just inside the wall — together with a playing video
    // they shimmer / z-fight. Prefer the media wall alone while video is active.
    const on =
      Boolean(stage.cycloramaVolumeGlow) &&
      cycVisible &&
      !infiniteFloor &&
      !stage.cycloramaVideoAssetId
    cycloramaVolGroup.visible = on
    if (!on) return
    const intensity = Math.max(0, Math.min(2, stage.cycloramaVolumeIntensity ?? 1))
    const cardOpacity = 0.028 + 0.045 * intensity
    cycloramaVolGroup.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as MeshBasicMaterial
      if (mat?.isMeshBasicMaterial) mat.opacity = cardOpacity
    })
  }

  let cycloramaVideo: CycloramaVideoHandle | null = null
  let cycloramaVideoGen = 0
  let cycloramaCropTop = 0
  const cycloramaRaycaster = new Raycaster()
  const cycloramaPointer = new Vector2()

  const cycloramaWallAspect = (radius: number, height: number) =>
    (radius * CYC_THETA_LENGTH) / Math.max(0.01, height)

  const resolveCycloramaHeights = (stage: StageState) => {
    const mediaH = Math.max(2, Math.min(80, stage.cycloramaHeight || 10))
    const crop = Math.max(0, Math.min(0.75, stage.cycloramaCropTop ?? 0))
    return { mediaH, crop, visibleH: Math.max(1.5, mediaH * (1 - crop)) }
  }

  const clearCycloramaVideo = () => {
    disposeCycloramaVideoHandle(cycloramaVideo)
    cycloramaVideo = null
  }

  const syncCycloramaVideo = async (stage: StageState) => {
    const gen = ++cycloramaVideoGen
    const assetId = stage.cycloramaVideoAssetId
    if (!assetId) {
      clearCycloramaVideo()
      return
    }
    if (!cycloramaVideo || cycloramaVideo.assetId !== assetId) {
      clearCycloramaVideo()
      try {
        const handle = await loadCycloramaVideoHandle(assetId)
        if (gen !== cycloramaVideoGen) {
          disposeCycloramaVideoHandle(handle)
          return
        }
        if (!handle) return
        cycloramaVideo = handle
      } catch {
        if (gen !== cycloramaVideoGen) return
        clearCycloramaVideo()
        return
      }
    }
    if (gen !== cycloramaVideoGen || !cycloramaVideo) return
    const { crop, visibleH } = resolveCycloramaHeights(stage)
    bindCycloramaVideoToMesh(cyclorama, cycloramaVideo, {
      muted: stage.cycloramaVideoMuted !== false,
      loop: stage.cycloramaVideoLoop !== false,
      fit: stage.cycloramaVideoFit === 'contain' ? 'contain' : 'cover',
      wallAspect: cycloramaWallAspect(cycloramaRadiusMetres, visibleH),
      cropTop: crop,
    })
  }

  const hitCyclorama = (clientX: number, clientY: number): boolean => {
    if (!cyclorama.visible || infiniteFloor) return false
    const rect = canvas.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return false
    cycloramaPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    cycloramaPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    cycloramaRaycaster.setFromCamera(cycloramaPointer, camera)
    const hits = cycloramaRaycaster.intersectObject(cyclorama, false)
    return hits.length > 0
  }

  const accentGroup = new Group()
  accentGroup.name = 'AccentLights'
  // Keep accents always in the visible light list (intensity floor when off).
  // Flipping accentGroup.visible changes NUM_SPOT/POINT_LIGHTS and recompiles
  // every MeshStandardMaterial — multi-second hitch on this car.
  const ACCENT_INTENSITY_FLOOR = 1e-4
  const accentKey = new SpotLight(0xffe8d0, ACCENT_INTENSITY_FLOOR, 28, Math.PI / 5, 0.45, 1.2)
  accentKey.name = 'iom-accent-key'
  accentKey.position.set(3.5, 4.2, 4)
  accentKey.target.position.set(0, 0.8, 0)
  accentKey.castShadow = false
  const accentFill = new SpotLight(0xc8d8ff, ACCENT_INTENSITY_FLOOR, 24, Math.PI / 4.5, 0.5, 1.2)
  accentFill.name = 'iom-accent-fill'
  accentFill.position.set(-4, 3.2, 2.5)
  accentFill.target.position.set(0, 0.7, 0)
  accentFill.castShadow = false
  const accentRim = new PointLight(0xfff0e0, ACCENT_INTENSITY_FLOOR, 18, 1.4)
  accentRim.name = 'iom-accent-rim'
  accentRim.position.set(0.5, 2.8, -5)
  accentGroup.add(accentKey, accentKey.target, accentFill, accentFill.target, accentRim)

  const volumetricGroup = new Group()
  volumetricGroup.name = 'AccentVolumetrics'
  volumetricGroup.visible = false
  // Cheap fake volume: two additive cards crossed at 90° per seat so an edge-on
  // camera never collapses the glow to a single vertical line.
  const glowMat = new MeshBasicMaterial({
    map: createSoftGlowTexture(),
    color: 0xffe2c0,
    transparent: true,
    opacity: 0.045,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
  const glowGeo = new PlaneGeometry(2.4, 5.5)
  for (const [x, z, yaw] of [
    [4.2, 3.2, -0.6],
    [-4.2, 2.6, 0.55],
    [0.2, -5.2, 0],
  ] as const) {
    const seat = new Group()
    seat.position.set(x, 2.4, z)
    seat.rotation.y = yaw
    const a = new Mesh(glowGeo, glowMat.clone())
    const b = new Mesh(glowGeo, glowMat.clone())
    b.rotation.y = Math.PI / 2
    seat.add(a, b)
    volumetricGroup.add(seat)
  }
  accentGroup.add(volumetricGroup)
  scene.add(accentGroup)
  accentGroup.visible = true

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
    syncCycloramaVolumetrics(lastStage, cyclorama.visible)
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
      syncCycloramaVolumetrics(stage, false)
      const floorDisplace = stageSurfaceNeedsDisplacement(stage.floor)
      if (floorDisplace !== floorDisplaceTessellated) {
        floorDisplaceTessellated = floorDisplace
        floor.geometry.dispose()
        floor.geometry = createInfiniteFloorGeometry(INFINITE_FLOOR_METRES, floorDisplace)
        floor.rotation.x = -Math.PI / 2
      }
      void applyStageSurfaceMaterial(floor, stage.floor).then(() => {
        syncInfiniteFloorTextures(floor.position.x, floor.position.z)
      })
      return
    }

    pedestal.visible = stage.pedestalVisible && stage.floorVisible
    cyclorama.visible = stage.cycloramaVisible && policy.cycloramaVisible

    const floorDiameter = Math.max(8, Math.min(500, stage.floorSize || 28))
    const pedestalDiameter = Math.max(0.5, Math.min(40, stage.pedestalSize || 4.8))
    const pedestalHeight = Math.max(0.02, Math.min(1.5, stage.pedestalHeight ?? 0.12))
    const cycRadius = Math.max(6, Math.min(250, stage.cycloramaSize || 14))
    const { crop: cycCrop, visibleH: cycHeight } = resolveCycloramaHeights(stage)
    const floorDisplace = stageSurfaceNeedsDisplacement(stage.floor)
    const pedestalDisplace = stageSurfaceNeedsDisplacement(stage.pedestal)
    const cycDisplace = stageSurfaceNeedsDisplacement(stage.cyclorama)

    const sizesChanged =
      floorSizeMetres !== floorDiameter ||
      pedestalHeightMetres !== pedestalHeight ||
      pedestalDiameterMetres !== pedestalDiameter ||
      cycloramaHeightMetres !== cycHeight ||
      cycloramaRadiusMetres !== cycRadius ||
      cycloramaCropTop !== cycCrop
    const floorTessChanged = floorDisplace !== floorDisplaceTessellated
    const pedTessChanged = pedestalDisplace !== pedestalDisplaceTessellated
    const cycTessChanged = cycDisplace !== cycloramaDisplaceTessellated

    floorSizeMetres = floorDiameter
    cycloramaHeightMetres = cycHeight
    cycloramaRadiusMetres = cycRadius
    cycloramaCropTop = cycCrop
    pedestalHeightMetres = pedestalHeight
    pedestalDiameterMetres = pedestalDiameter
    floorDisplaceTessellated = floorDisplace
    pedestalDisplaceTessellated = pedestalDisplace
    cycloramaDisplaceTessellated = cycDisplace

    if (sizesChanged || floorTessChanged) {
      floor.geometry.dispose()
      floor.geometry = buildFloorGeometry(floorRadiusForStage(floorDiameter, cycRadius), floorDisplace)
      floor.position.set(0, 0, 0)
    }
    if (sizesChanged || pedTessChanged) {
      pedestal.geometry.dispose()
      const pedR = pedestalDiameter * 0.5
      pedestal.geometry = buildPedestalGeometry(pedR, pedestalHeight, pedestalDisplace)
      pedestal.rotation.set(0, 0, 0)
      pedestal.position.y = pedestalHeight * 0.5 + STAGE_Z_EPS
    } else {
      pedestal.position.y = pedestalHeight * 0.5 + STAGE_Z_EPS
    }
    if (sizesChanged || cycTessChanged) {
      cyclorama.geometry.dispose()
      cyclorama.geometry = buildCycloramaGeometry(cycRadius, cycHeight, cycDisplace)
      cyclorama.position.y = cycHeight * 0.5 + STAGE_Z_EPS
      rebuildCycloramaVolumetrics(cycRadius, cycHeight)
    }
    syncCycloramaVolumetrics(stage, cyclorama.visible)

    void applyStageSurfaceMaterial(floor, stage.floor)
    void applyStageSurfaceMaterial(pedestal, stage.pedestal, { polygonOffset: true })
    void applyStageSurfaceMaterial(cyclorama, stage.cyclorama).then(() => {
      void syncCycloramaVideo(stage)
    })
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
      mat.displacementMap,
      mat.aoMap,
      mat.emissiveMap,
    ]
    const world = infiniteFloorTextureOffset(worldX, worldZ, repeat, size)
    maps.forEach((tex) => {
      if (!tex) return
      tex.wrapS = RepeatWrapping
      tex.wrapT = RepeatWrapping
      tex.repeat.set(repeat, repeat)
      tex.center.set(0.5, 0.5)
      // Break-tiling UV spin/offset rotates the road relative to the car while the
      // plane follows — world-lock only. Shader detile (uTileVariation) still runs.
      tex.rotation = 0
      tex.offset.copy(world)
      tex.needsUpdate = true
    })
  }

  const setInfiniteFloor = (enabled: boolean) => {
    if (infiniteFloor === enabled) return
    infiniteFloor = enabled
    if (enabled) {
      const displace = stageSurfaceNeedsDisplacement(lastStage.floor)
      floorDisplaceTessellated = displace
      floor.geometry.dispose()
      floor.geometry = createInfiniteFloorGeometry(INFINITE_FLOOR_METRES, displace)
      floor.rotation.x = -Math.PI / 2
      pedestal.visible = false
      cyclorama.visible = false
      syncCycloramaVolumetrics(lastStage, false)
      floorSizeMetres = INFINITE_FLOOR_METRES
      void applyStageSurfaceMaterial(floor, lastStage.floor).then(() => {
        syncInfiniteFloorTextures(floor.position.x, floor.position.z)
      })
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
    // Never hide accentGroup — Three.js traverseVisible would drop the spots
    // from NUM_*_LIGHTS and recompile the whole car.
    accentGroup.visible = true
    accentKey.visible = true
    accentFill.visible = true
    accentRim.visible = true
    const intensity = Math.max(0, Math.min(2, accent.intensity ?? 1))
    accentKey.intensity = on ? 1.35 * intensity : ACCENT_INTENSITY_FLOOR
    accentFill.intensity = on ? 0.85 * intensity : ACCENT_INTENSITY_FLOOR
    accentRim.intensity = on ? 0.55 * intensity : ACCENT_INTENSITY_FLOOR
    // Volumetric cards are meshes only — visibility toggle is fine.
    volumetricGroup.visible = on && Boolean(accent.volumetricEnabled)
    // Per-plane opacity is lower: crossed pair stacks additively at 45°.
    const cardOpacity = 0.035 + 0.04 * intensity
    volumetricGroup.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as MeshBasicMaterial
      if (mat?.isMeshBasicMaterial) mat.opacity = cardOpacity
    })
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
    radius: 0.18,
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
    clearCycloramaVideo()
    for (const child of volumetricGroup.children) {
      child.traverse((obj) => {
        const mesh = obj as Mesh
        if (!mesh.isMesh) return
        const mat = mesh.material as MeshBasicMaterial
        if (mat?.isMeshBasicMaterial) mat.dispose()
      })
    }
    for (const child of [...cycloramaVolGroup.children]) {
      cycloramaVolGroup.remove(child)
      child.traverse((obj) => {
        const mesh = obj as Mesh
        if (!mesh.isMesh) return
        const mat = mesh.material as MeshBasicMaterial
        if (mat?.isMeshBasicMaterial && mat !== cycGlowMat) mat.dispose()
      })
    }
    cycGlowGeo.dispose()
    cycGlowMat.map?.dispose()
    cycGlowMat.dispose()
    glowGeo.dispose()
    glowMat.map?.dispose()
    glowMat.dispose()
    celestial.dispose()
    disposeStageTextureCache()
    iblCache?.dispose()
    renderer.dispose()
    canvas.remove()
  }

  const applyLightsBudget = (opts: { lite: boolean }) => {
    fill.castShadow = !opts.lite
    const sunSize = opts.lite ? 2048 : 4096
    if (sun.shadow.mapSize.x !== sunSize) {
      sun.shadow.mapSize.set(sunSize, sunSize)
      const map = sun.shadow.map
      if (map) {
        map.dispose()
        sun.shadow.map = null as unknown as typeof map
      }
    }
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
        radius: 0.18,
      })
    },
    applyLightsBudget,
    bloomSupported: bloom.supported,
    warmGpu() {
      try {
        // Compile with the same light-count mask used at runtime: all iom-lamp-*
        // and iom-accent-* proxies visible with a tiny non-zero intensity
        // (Three skips intensity===0 from shading but still counts visible lights).
        scene.traverse((obj) => {
          const name = obj.name || ''
          const isStudio =
            name.startsWith('iom-lamp-') || name.startsWith('iom-accent-')
          if (!isStudio) return
          const spot = obj as SpotLight
          if (spot.isSpotLight) {
            spot.visible = true
            if (spot.intensity < 1e-3) spot.intensity = 1e-3
            return
          }
          const point = obj as PointLight
          if (point.isPointLight) {
            point.visible = true
            if (point.intensity < 1e-3) point.intensity = 1e-3
          }
        })
        renderer.compile(scene, camera)
        scene.traverse((obj) => {
          const name = obj.name || ''
          const isStudio =
            name.startsWith('iom-lamp-') || name.startsWith('iom-accent-')
          if (!isStudio) return
          const spot = obj as SpotLight
          if (spot.isSpotLight) {
            spot.visible = true
            if (spot.intensity <= 1e-3) spot.intensity = 1e-4
            return
          }
          const point = obj as PointLight
          if (point.isPointLight) {
            point.visible = true
            if (point.intensity <= 1e-3) point.intensity = 1e-4
          }
        })
      } catch {
        /* compile is best-effort */
      }
    },
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
      const floorDisplace = stageSurfaceNeedsDisplacement(lastStage.floor)
      floorDisplaceTessellated = floorDisplace
      floor.geometry.dispose()
      floor.geometry = buildFloorGeometry(floorRadius, floorDisplace)
      if (size * 0.5 > 14) {
        const cycRadius = Math.max(12, size * 0.5 - 0.15)
        cycloramaRadiusMetres = cycRadius
        const cycDisplace = stageSurfaceNeedsDisplacement(lastStage.cyclorama)
        cycloramaDisplaceTessellated = cycDisplace
        cyclorama.geometry.dispose()
        cyclorama.geometry = buildCycloramaGeometry(cycRadius, cycloramaHeightMetres, cycDisplace)
        cyclorama.position.y = cycloramaHeightMetres * 0.5 + STAGE_Z_EPS
        rebuildCycloramaVolumetrics(cycRadius, cycloramaHeightMetres)
        syncCycloramaVolumetrics(lastStage, cyclorama.visible)
        if (cycloramaVideo) {
          void syncCycloramaVideo(lastStage)
        }
      }
    },
    getFloorSize: () => floorSizeMetres,
    setInfiniteFloor,
    updateFloorFollow,
    async tryCycloramaClick(clientX, clientY) {
      if (!lastStage.cycloramaInteractive || !cycloramaVideo) return false
      if (!hitCyclorama(clientX, clientY)) return false
      // First gesture: unmute path when author left muted for autoplay policy.
      return toggleCycloramaPlayback(cycloramaVideo)
    },
    updateCycloramaHover(clientX, clientY) {
      if (controls.enabled) return
      if (!lastStage.cycloramaInteractive || !cycloramaVideo || !cyclorama.visible) {
        if (canvas.style.cursor === 'pointer') canvas.style.cursor = ''
        return
      }
      canvas.style.cursor = hitCyclorama(clientX, clientY) ? 'pointer' : ''
    },
    hasCycloramaVideo: () => Boolean(cycloramaVideo),
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
