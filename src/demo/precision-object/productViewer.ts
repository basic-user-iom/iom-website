import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { CAMERA_PRESETS, EXPLORE_CUE_ID, HOTSPOTS, PRODUCT } from './productConfig'
import { loadGltf } from './ModelLoader'
import {
  aimHdrSunLight,
  applyEnvironmentOrientation,
  applyStudioEnvironment,
  createHdrEnvironment,
  createRoomFallback,
  loadExrEnvironment,
  type StudioEnvironment,
} from './studioEnvironment'
import {
  clonePbrMaps,
  isDialMaterial,
  isWatchMetalMaterial,
  loadPbrMapsPartial,
  type PbrMapKind,
  type PbrMapSet,
  type PbrMapUrls,
} from './pbrTextures'
import {
  DEFAULT_HDR_ID,
  DEFAULT_MATERIAL_LIGHTNESS,
  FALLBACK_HDR_ID,
  MATERIAL_GROUPS,
  TEXTURE_SETS,
  clampAccentPitch,
  clampMaterialLightness,
  clampSunPitch,
  customMapCache,
  defaultLook,
  hdrUrlFor,
  isHdrId,
  materialGroupId,
  parseCameraLook,
  parseNamedViews,
  parseHandsLook,
  parseModelLook,
  resolveInitialCamera,
  roundCameraLook,
  roundModelLook,
  textureSetUrls,
  type CameraLook,
  type HdrId,
  type MaterialLook,
  type ModelLook,
  type SavedLook,
  type TextureTargetLook,
} from './lookStudio'
import {
  analogHandRadians,
  berlinCivilTime,
  crownWindDelta,
  getTimeZone,
  setHandCalibration,
  setTimeZone as setWatchTimeZone,
  zoneHandDeltas,
  ZONE_HAND_TWEEN_SEC,
  WATCH_CROWN_BONES,
  WATCH_HAND_BONES,
  type AnalogHandRadians,
  type BerlinCivilTime,
} from './cetWatchHands'
import {
  DEFAULT_LIGHTING_PRESET,
  type CameraPresetId,
  type LightingPresetId,
  type LoadState,
  type ModelCapabilities,
  type ScreenHotspot,
  type ViewerApi,
} from './types'

const HAND_AXIS_X = new THREE.Vector3(1, 0, 0)
const CROWN_AXIS_FALLBACK = new THREE.Vector3(0, 1, 0)
/** Pure #000000 cannot multiply brighter, so lightness > 1 lifts toward graphite. */
const BLACK_PLATE_LIFT = 0.45
const MATERIAL_ENV_MAX = 2
const SAPPHIRE_IOR = 1.76
const SAPPHIRE_ROUGHNESS = 0.035
const SAPPHIRE_THICKNESS = 0.18
const SHADOW_MOTION_INTERVAL_MS = 100
const HOTSPOT_INTERVAL_MS = 1000 / 30
const HOTSPOT_POSITION_EPSILON = 0.25
const crownQuatScratch = new THREE.Quaternion()
const handQuatScratch = new THREE.Quaternion()
const crownVertexScratch = new THREE.Vector3()

export type ViewerOptions = {
  reducedMotion: boolean
  mobile: boolean
  onLoad: (state: LoadState) => void
  onReady: (capabilities: ModelCapabilities) => void
  onInteract: () => void
  onHotspots: (points: ScreenHotspot[]) => void
  onUnavailable: () => void
  onMaterials?: (materials: MaterialLook[]) => void
  onHotspotPlaced?: (id: string, position: [number, number, number]) => void
  onModelChange?: (model: ModelLook) => void
  initialLook?: SavedLook
}

type CamTween = {
  fromPos: THREE.Vector3
  toPos: THREE.Vector3
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
  fromFov: number
  toFov: number
  elapsed: number
  duration: number
}

type PartRest = {
  object: THREE.Object3D
  origin: THREE.Vector3
  direction: THREE.Vector3
}

const TARGET_SIZE = PRODUCT.targetSize
const IDLE_ROTATE_SPEED = 0.35
const VIEW_PAN_SPEED = 1.15
const VIEW_DOLLY_SPEED = 1.35
const VIEW_PAN_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyQ',
  'KeyE',
  'KeyR',
  'KeyF',
  'PageUp',
  'PageDown',
  'KeyZ',
  'KeyX',
  'Minus',
  'Equal',
  'NumpadSubtract',
  'NumpadAdd',
])

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function easeOutCubic(t: number): number {
  const u = Math.min(1, Math.max(0, t))
  return 1 - (1 - u) ** 3
}

function meshBounds(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3()
  root.updateWorldMatrix(true, true)
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.geometry) return
    const geom = obj.geometry
    if (!geom.boundingBox) geom.computeBoundingBox()
    if (!geom.boundingBox) return
    const meshBox = geom.boundingBox.clone().applyMatrix4(obj.matrixWorld)
    if (Number.isFinite(meshBox.min.x) && Number.isFinite(meshBox.max.x)) box.union(meshBox)
  })
  return box
}

function createContactShadow(): { mesh: THREE.Mesh; dispose: () => void } {
  const geo = new THREE.PlaneGeometry(2.4, 2.4)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 124)
    g.addColorStop(0, 'rgba(6, 6, 8, 0.55)')
    g.addColorStop(0.35, 'rgba(6, 6, 8, 0.18)')
    g.addColorStop(0.7, 'rgba(6, 6, 8, 0.05)')
    g.addColorStop(1, 'rgba(6, 6, 8, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.002
  mesh.renderOrder = -1
  mesh.frustumCulled = false
  mesh.name = 'ContactShadow'
  return {
    mesh,
    dispose: () => {
      geo.dispose()
      mat.dispose()
      map.dispose()
    },
  }
}

function colorFromTintLightness(hex: string, lightness?: number): THREE.Color {
  const color = new THREE.Color(hex)
  const L = clampMaterialLightness(lightness)
  if (Math.abs(L - 1) < 1e-6) return color

  const lum = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
  if (lum < 1 / 255) {
    color.setScalar(Math.max(0, L - 1) * BLACK_PLATE_LIFT)
    return color
  }
  color.multiplyScalar(L)
  color.r = Math.min(1, color.r)
  color.g = Math.min(1, color.g)
  color.b = Math.min(1, color.b)
  return color
}

function applyMaterialTint(mat: THREE.MeshStandardMaterial, spec: MaterialLook): void {
  if (spec.id === 'black') {
    mat.color.copy(colorFromTintLightness(spec.color, spec.lightness))
    return
  }
  mat.color.set(spec.color)
}

function effectiveMaterialMetalness(spec: MaterialLook): number {
  return spec.id === 'black' ? Math.min(spec.metalness, 0.6) : spec.metalness
}

function effectiveMaterialRoughness(spec: MaterialLook): number {
  if (spec.id === 'glass') return Math.max(spec.roughness, SAPPHIRE_ROUGHNESS)
  if (spec.id === 'black') return Math.max(spec.roughness, 0.12)
  if (spec.id === 'metal') return Math.max(spec.roughness, 0.04)
  if (spec.id === 'metalDark') return Math.max(spec.roughness, 0.05)
  if (spec.id === 'metalRough') return Math.max(spec.roughness, 0.08)
  return spec.roughness
}

function effectiveMaterialEnv(spec: MaterialLook): number {
  return Math.min(spec.envMapIntensity, MATERIAL_ENV_MAX)
}

function effectiveGlassIor(spec?: MaterialLook): number {
  return THREE.MathUtils.clamp(Math.max(spec?.ior ?? SAPPHIRE_IOR, SAPPHIRE_IOR), SAPPHIRE_IOR, 2)
}

function hasTransmission(material: THREE.Material | THREE.Material[]): boolean {
  const materials = Array.isArray(material) ? material : [material]
  return materials.some(
    (mat) => mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0,
  )
}

function glassLook(): MaterialLook | undefined {
  return defaultLook().materials.find((item) => item.id === 'glass')
}

function prepareGlass(root: THREE.Object3D, physical: boolean): void {
  const spec = glassLook()
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    const next = mats.map((mat) => {
      if (!(mat instanceof THREE.MeshStandardMaterial)) return mat
      const name = (mat.name || obj.name || '').toLowerCase()
      const isGlass = name.includes('glass') || (mat.transparent && mat.opacity < 0.4)
      if (!isGlass) return mat

      if (physical) {
        const phys = new THREE.MeshPhysicalMaterial({
          name: mat.name,
          color: spec ? new THREE.Color(spec.color) : mat.color,
          metalness: spec ? effectiveMaterialMetalness(spec) : 0,
          roughness: spec ? effectiveMaterialRoughness(spec) : SAPPHIRE_ROUGHNESS,
          transmission: spec?.transmission ?? 0.94,
          thickness: SAPPHIRE_THICKNESS,
          ior: effectiveGlassIor(spec),
          specularIntensity: 1,
          transparent: true,
          opacity: 1,
          envMapIntensity: spec ? effectiveMaterialEnv(spec) : MATERIAL_ENV_MAX,
          side: THREE.FrontSide,
          depthWrite: false,
        })
        mat.dispose()
        return phys
      }

      mat.metalness = spec?.metalness ?? 0
      mat.roughness = spec ? effectiveMaterialRoughness(spec) : 0.05
      mat.transparent = true
      mat.opacity = Math.max(mat.opacity, 0.22)
      mat.depthWrite = false
      mat.side = THREE.FrontSide
      mat.envMapIntensity = spec ? effectiveMaterialEnv(spec) : MATERIAL_ENV_MAX
      if (spec) mat.color.set(spec.color)
      return mat
    })
    obj.material = Array.isArray(obj.material) ? next : next[0]
  })
}

/**
 * Bone.008 origin sits in the case, not the knurled center. Local +Y is ~1.7°
 * off the stem, so a Y spin orbits the crown in the recess. Axis is bind-pose
 * origin → weighted mesh centroid (the stem through the geometric center).
 */
function measureCrownStemAxis(bone: THREE.Object3D, root: THREE.Object3D): THREE.Vector3 {
  root.updateWorldMatrix(true, true)
  const centroid = new THREE.Vector3()
  let count = 0
  root.traverse((obj) => {
    if (!(obj instanceof THREE.SkinnedMesh) || !obj.skeleton) return
    const index = obj.skeleton.bones.indexOf(bone as THREE.Bone)
    if (index < 0) return
    const pos = obj.geometry.getAttribute('position')
    const joints = obj.geometry.getAttribute('skinIndex')
    const weights = obj.geometry.getAttribute('skinWeight')
    if (!pos || !joints || !weights) return
    for (let i = 0; i < pos.count; i++) {
      let w = 0
      if (joints.getX(i) === index) w += weights.getX(i)
      if (joints.getY(i) === index) w += weights.getY(i)
      if (joints.getZ(i) === index) w += weights.getZ(i)
      if (joints.getW(i) === index) w += weights.getW(i)
      if (w < 0.5) continue
      crownVertexScratch.fromBufferAttribute(pos, i)
      obj.localToWorld(crownVertexScratch)
      centroid.add(crownVertexScratch)
      count++
    }
  })
  if (count === 0) return CROWN_AXIS_FALLBACK.clone()
  centroid.multiplyScalar(1 / count)
  bone.worldToLocal(centroid)
  if (centroid.lengthSq() < 1e-12) return CROWN_AXIS_FALLBACK.clone()
  return centroid.normalize()
}

/** Detached bind from current world pose. Call after wrapper scale/rotation, with bones at rest. */
function prepareSkinning(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true)
  const rebound = new Set<THREE.Skeleton>()
  root.traverse((obj) => {
    if (!(obj instanceof THREE.SkinnedMesh) || !obj.skeleton) return
    if (!rebound.has(obj.skeleton)) {
      obj.skeleton.calculateInverses()
      obj.skeleton.update()
      rebound.add(obj.skeleton)
    }
    obj.bind(obj.skeleton, obj.matrixWorld)
    obj.bindMode = THREE.DetachedBindMode
    obj.frustumCulled = false
  })
}

function polishMaterials(root: THREE.Object3D): void {
  const looks = defaultLook().materials
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue
      const spec = looks.find(
        (item) => item.id === (materialGroupId(mat.name) ?? materialGroupId(obj.name)),
      )
      if (!spec) {
        mat.envMapIntensity = 1.15
        continue
      }
      applyMaterialTint(mat, spec)
      mat.metalness = effectiveMaterialMetalness(spec)
      mat.roughness = effectiveMaterialRoughness(spec)
      mat.envMapIntensity = effectiveMaterialEnv(spec)
      if (mat instanceof THREE.MeshPhysicalMaterial) {
        if (spec.transmission != null) mat.transmission = spec.transmission
        if (spec.id === 'glass') {
          mat.ior = effectiveGlassIor(spec)
          mat.thickness = SAPPHIRE_THICKNESS
        } else if (spec.ior != null) mat.ior = spec.ior
      }
    }
  })
}

function enableShadows(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    obj.castShadow = true
    obj.receiveShadow = true
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      if (mat && 'side' in mat && !(mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0)) {
        mat.side = THREE.DoubleSide
      }
    }
    if (hasTransmission(obj.material)) {
      obj.castShadow = false
      obj.receiveShadow = false
      for (const mat of mats) {
        if (mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0) {
          mat.side = THREE.FrontSide
        }
      }
    }
  })
}

function framingDistance(camera: THREE.PerspectiveCamera, radius: number, padding: number): number {
  const fov = (camera.fov * Math.PI) / 180
  return (radius * padding) / Math.sin(fov / 2)
}

function applyKeyLights(
  key: THREE.DirectionalLight,
  hemi: THREE.HemisphereLight,
  preset: LightingPresetId,
): void {
  if (preset === 'detail') {
    key.color.set(0xfff3e4)
    key.intensity = 1.85
    hemi.intensity = 0.12
    return
  }

  key.color.set(0xfff1e2)
  key.intensity = 1.35
  hemi.intensity = 0.16
}

/** Positions only — intensities come from look.lights. None of these cast shadows. */
function placeAccentLights(
  fill: THREE.DirectionalLight,
  rim: THREE.DirectionalLight,
  preset: LightingPresetId,
): void {
  fill.color.set(0xdce8f5)
  rim.color.set(0xf7f4ee)
  if (preset === 'detail') {
    fill.position.set(-2.2, 1.9, 3.0)
    rim.position.set(-1.1, 2.8, -3.4)
    return
  }
  fill.position.set(-2.6, 2.2, 3.4)
  rim.position.set(-1.6, 3.2, -3.8)
}

const ACCENT_RADIUS = 3.2
const ACCENT_TARGET_Y = 0.36
const ACCENT_MIN_Y = 0.18
const FILL_ENERGY_SCALE = 0.8
const RIM_ENERGY_SCALE = 0.78
const ACCENT_ENERGY_SCALE = 0.7

function aimAccentLight(light: THREE.DirectionalLight, yaw: number, pitch: number): void {
  const el = clampAccentPitch(pitch)
  const cy = Math.cos(el)
  light.position.set(
    Math.sin(yaw) * cy * ACCENT_RADIUS,
    Math.max(ACCENT_MIN_Y, ACCENT_TARGET_Y + Math.sin(el) * ACCENT_RADIUS),
    Math.cos(yaw) * cy * ACCENT_RADIUS,
  )
}

export function createProductViewer(
  mount: HTMLElement,
  options: ViewerOptions,
): { api: ViewerApi; dispose: () => void } {
  const { reducedMotion, mobile, onLoad, onReady, onInteract, onHotspots, onUnavailable, onMaterials, onHotspotPlaced, onModelChange, initialLook } = options
  const HERO_BIAS_X = mobile ? 0 : 0.16

  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !mobile,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: false,
    })
    if (!renderer.getContext()) throw new Error('WebGL unavailable')
  } catch {
    onUnavailable()
    return {
      api: emptyApi(),
      dispose: () => undefined,
    }
  }

  const pixelCap = mobile ? 1.25 : 1.6
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap))
  renderer.setClearColor(0x0c0c0e, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.VSMShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.touchAction = 'none'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  mount.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 80)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minPolarAngle = 0.18
  controls.maxPolarAngle = Math.PI / 2 - 0.04
  controls.rotateSpeed = 0.68
  controls.zoomSpeed = 0.8
  controls.autoRotate = !reducedMotion
  controls.autoRotateSpeed = IDLE_ROTATE_SPEED
  controls.touches.ONE = THREE.TOUCH.ROTATE
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE
  controls.enabled = false
  controls.enableRotate = false
  controls.enableZoom = false

  let studioEnv: StudioEnvironment = createRoomFallback(renderer)
  let usingCachedHdr = false
  let activeHdrId: HdrId | null = null
  let hdrLoadGen = 0
  const hdrCache = new Map<HdrId, StudioEnvironment>()
  const hdrPending = new Map<HdrId, Promise<StudioEnvironment | null>>()
  applyStudioEnvironment(scene, studioEnv, {
    environmentIntensity: 0.95,
    backgroundIntensity: 1,
    backgroundBlurriness: 0,
  })
  scene.background = new THREE.Color(0x0c0c0e)

  const hemi = new THREE.HemisphereLight(0xf3ead8, 0x1a1c22, 0.08)
  scene.add(hemi)

  const key = new THREE.DirectionalLight(0xfff1e2, 2.15)
  key.name = 'HdrSun'
  key.castShadow = true
  const shadowSize = mobile ? 1024 : 2048
  key.shadow.mapSize.set(shadowSize, shadowSize)
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 16
  key.shadow.camera.left = -5
  key.shadow.camera.right = 5
  key.shadow.camera.top = 5
  key.shadow.camera.bottom = -4
  key.shadow.camera.far = 24
  key.shadow.bias = -0.0001
  key.shadow.normalBias = 0.02
  key.shadow.radius = 0
  key.shadow.blurSamples = 1
  key.shadow.intensity = 0.85
  key.shadow.autoUpdate = false
  key.shadow.needsUpdate = true
  scene.add(key)
  scene.add(key.target)
  key.target.position.set(0, 0.35, 0)

  const fill = new THREE.DirectionalLight(0xdce8f5, 0)
  fill.castShadow = false
  fill.name = 'FillLight'
  scene.add(fill)
  scene.add(fill.target)
  fill.target.position.set(0, 0.38, 0)

  const rim = new THREE.DirectionalLight(0xf7f4ee, 0)
  rim.castShadow = false
  rim.name = 'RimLight'
  scene.add(rim)
  scene.add(rim.target)
  rim.target.position.set(0, 0.42, 0)

  const accent = new THREE.DirectionalLight(0xeef3ff, 0)
  accent.castShadow = false
  accent.name = 'AccentLight'
  scene.add(accent)
  scene.add(accent.target)
  accent.target.position.set(0, ACCENT_TARGET_Y, 0)

  applyKeyLights(key, hemi, DEFAULT_LIGHTING_PRESET)
  placeAccentLights(fill, rim, DEFAULT_LIGHTING_PRESET)
  fill.castShadow = false
  rim.castShadow = false
  accent.castShadow = false

  const floorGeo = new THREE.CircleGeometry(2.6, 128)
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x16161a,
    roughness: 0.38,
    metalness: 0.18,
    envMapIntensity: 0.9,
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.castShadow = false
  floor.name = 'StudioFloor'
  scene.add(floor)

  const contact = createContactShadow()
  scene.add(contact.mesh)

  const modelRoot = new THREE.Group()
  modelRoot.name = 'NormalizedModel'
  const [rx, ry, rz] = PRODUCT.modelRotation
  modelRoot.rotation.set(rx, ry, rz)
  scene.add(modelRoot)

  const transformControls = new TransformControls(camera, renderer.domElement)
  transformControls.setMode('translate')
  transformControls.setSize(0.85)
  transformControls.enabled = false
  transformControls.attach(modelRoot)
  const gizmoHelper = transformControls.getHelper()
  gizmoHelper.visible = false
  gizmoHelper.traverse((obj) => {
    obj.castShadow = false
    obj.receiveShadow = false
  })
  scene.add(gizmoHelper)

  const restPosition = new THREE.Vector3()
  const restRotation = new THREE.Euler()
  const restMatrix = new THREE.Matrix4()
  const restWorldInv = new THREE.Matrix4()
  let restCaptured = false
  let gizmoDragging = false
  let gizmoWanted = false

  const hotspotAnchors = new Map<string, THREE.Object3D>()
  const exploreAnchor = new THREE.Object3D()
  exploreAnchor.name = EXPLORE_CUE_ID
  const screen = new THREE.Vector3()
  let lastHotspotProjectionAt = -Infinity
  let lastHotspotPoints: ScreenHotspot[] = []
  const boxSize = new THREE.Vector3(1, 1, 1)
  const boxCenter = new THREE.Vector3()
  let radius = 0.6
  let heroBias = true
  let active = true
  let disposed = false
  let interacting = false
  let interactionEnabled = false
  let cameraPanEnabled = true
  const heldPanCodes = new Set<string>()
  let ctrlPanHeld = false
  let keyboardPanning = false
  const panRight = new THREE.Vector3()
  const panForward = new THREE.Vector3()
  const panWorldUp = new THREE.Vector3(0, 1, 0)
  const panOffset = new THREE.Vector3()
  let autoRotateWanted = !reducedMotion
  let resumeRotateAt = 0
  let parts: PartRest[] = []
  let tween: CamTween | null = null
  let mixer: THREE.AnimationMixer | null = null
  let motionAction: THREE.AnimationAction | null = null
  let motionWanted = !reducedMotion
  type CetHands = {
    hour: THREE.Object3D
    minute: THREE.Object3D
    second: THREE.Object3D | null
    hourRest: THREE.Quaternion
    minuteRest: THREE.Quaternion
    secondRest: THREE.Quaternion | null
  }
  type CetCrown = {
    bone: THREE.Object3D
    rest: THREE.Quaternion
    axis: THREE.Vector3
  }
  let cetHands: CetHands | null = null
  let cetCrown: CetCrown | null = null
  let appliedWatchZone = getTimeZone()
  let lastHandAngles: AnalogHandRadians | null = null
  let handsFrozen = false
  let frozenCivil: BerlinCivilTime | null = null
  let pendingZoneSweep = false
  let shadowPoseDirty = true
  let lastShadowUpdate = 0
  let handTween: {
    from: AnalogHandRadians
    delta: AnalogHandRadians
    crownDelta: number
    elapsed: number
    duration: number
  } | null = null
  let lightingPreset: LightingPresetId = DEFAULT_LIGHTING_PRESET
  let currentLook: SavedLook = initialLook ?? defaultLook()
  setHandCalibration(parseHandsLook(currentLook.hands))
  let placeMode = false
  let placeHotspotId: string | null = null
  const sourceCache = new Map<string, PbrMapSet>()
  const mapKindsByTarget: Record<'stand' | 'watch' | 'dial', readonly PbrMapKind[]> = {
    watch: ['color', 'normal'],
    dial: ['color', 'roughness', 'metalness', 'normal'],
    stand: ['color', 'roughness', 'metalness', 'normal'],
  }
  let floorPbrMaps: PbrMapSet | null = null
  let watchPbrMaps: PbrMapSet | null = null
  let dialPbrMaps: PbrMapSet | null = null
  let watchPbrReady = false
  let lookMapGeneration = 0
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const floorRest = {
    color: floorMat.color.clone(),
    roughness: floorMat.roughness,
    metalness: floorMat.metalness,
    envMapIntensity: floorMat.envMapIntensity,
  }
  type WatchMatRest = {
    mat: THREE.MeshStandardMaterial
    groupId: string | null
    meshName: string
    color: THREE.Color
    roughness: number
    metalness: number
    envMapIntensity: number
    normalScale: THREE.Vector2
    transmission: number
    ior: number
  }
  const watchMatRest: WatchMatRest[] = []
  let capabilities: ModelCapabilities = {
    loaded: false,
    hasMotion: false,
    motionClipName: null,
    hasExploded: PRODUCT.explodePartNames.length > 0,
    animations: [],
    materials: [],
    meshes: [],
    size: [1, 1, 1],
  }

  const markInteract = () => {
    interacting = true
    controls.autoRotate = false
    onInteract()
  }
  const endInteract = () => {
    interacting = false
    resumeRotateAt = performance.now() + 1400
  }
  controls.addEventListener('start', markInteract)
  controls.addEventListener('end', endInteract)

  transformControls.addEventListener('dragging-changed', (event) => {
    gizmoDragging = Boolean(event.value)
    syncOrbitEnabled()
    if (gizmoDragging) {
      controls.autoRotate = false
      markInteract()
      return
    }
    endInteract()
    onModelChange?.(captureLiveModel())
    rebindSkinnedMeshes()
  })
  transformControls.addEventListener('axis-changed', () => {
    if (!gizmoDragging) syncOrbitEnabled()
  })
  transformControls.addEventListener('objectChange', () => {
    shadowPoseDirty = true
  })

  const applyCanvasPointerLock = () => {
    const canvas = renderer.domElement
    if (interactionEnabled) {
      canvas.style.pointerEvents = ''
      canvas.style.touchAction = 'none'
      mount.style.pointerEvents = ''
      mount.style.touchAction = ''
    } else {
      canvas.style.pointerEvents = 'none'
      canvas.style.touchAction = 'pan-y'
      mount.style.pointerEvents = 'none'
      mount.style.touchAction = 'pan-y'
    }
  }

  const syncOrbitEnabled = () => {
    if (!interactionEnabled) {
      controls.enabled = false
      controls.enableRotate = false
      controls.enablePan = false
      controls.enableZoom = false
      transformControls.enabled = false
      return
    }
    controls.enabled = !gizmoDragging && (!gizmoWanted || !transformControls.axis)
    controls.enableRotate = !placeMode && !gizmoDragging
    controls.enablePan = cameraPanEnabled && !gizmoDragging
    controls.enableZoom = true
  }

  applyCanvasPointerLock()

  const onCameraKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'ControlLeft' || event.code === 'ControlRight' || event.key === 'Control') {
      ctrlPanHeld = true
    }
    if (isTypingTarget(event.target)) return
    if (VIEW_PAN_CODES.has(event.code)) heldPanCodes.add(event.code)
    if (!interactionEnabled || !cameraPanEnabled || gizmoDragging || disposed || !active) return
    if (!event.ctrlKey) return
    if (!VIEW_PAN_CODES.has(event.code)) return
    event.preventDefault()
    tween = null
    keyboardPanning = true
    markInteract()
  }

  const onCameraKeyUp = (event: KeyboardEvent) => {
    if (event.code === 'ControlLeft' || event.code === 'ControlRight' || event.key === 'Control') {
      ctrlPanHeld = false
    }
    heldPanCodes.delete(event.code)
    if (keyboardPanning && (!ctrlPanHeld || heldPanCodes.size === 0)) {
      keyboardPanning = false
      endInteract()
    }
  }

  const onCameraBlur = () => {
    heldPanCodes.clear()
    ctrlPanHeld = false
    if (keyboardPanning) {
      keyboardPanning = false
      endInteract()
    }
  }

  window.addEventListener('keydown', onCameraKeyDown, { capture: true })
  window.addEventListener('keyup', onCameraKeyUp, { capture: true })
  window.addEventListener('blur', onCameraBlur)

  const applyKeyboardPan = (dt: number) => {
    if (!interactionEnabled || !cameraPanEnabled || !ctrlPanHeld || heldPanCodes.size === 0 || gizmoDragging) return
    camera.updateMatrixWorld()
    camera.getWorldDirection(panForward)
    panForward.y = 0
    if (panForward.lengthSq() < 1e-8) {
      panForward.set(0, 0, -1).applyQuaternion(camera.quaternion)
      panForward.y = 0
    }
    if (panForward.lengthSq() < 1e-8) return
    panForward.normalize()
    panRight.crossVectors(panForward, panWorldUp).normalize()

    let right = 0
    let up = 0
    let forward = 0
    let dolly = 0
    if (heldPanCodes.has('KeyD') || heldPanCodes.has('ArrowRight')) right += 1
    if (heldPanCodes.has('KeyA') || heldPanCodes.has('ArrowLeft')) right -= 1
    if (heldPanCodes.has('KeyW') || heldPanCodes.has('ArrowUp')) forward += 1
    if (heldPanCodes.has('KeyS') || heldPanCodes.has('ArrowDown')) forward -= 1
    if (heldPanCodes.has('KeyE') || heldPanCodes.has('KeyR') || heldPanCodes.has('PageUp')) up += 1
    if (heldPanCodes.has('KeyQ') || heldPanCodes.has('KeyF') || heldPanCodes.has('PageDown')) up -= 1
    if (heldPanCodes.has('KeyZ') || heldPanCodes.has('Equal') || heldPanCodes.has('NumpadAdd')) dolly -= 1
    if (heldPanCodes.has('KeyX') || heldPanCodes.has('Minus') || heldPanCodes.has('NumpadSubtract')) dolly += 1
    if (right === 0 && up === 0 && forward === 0 && dolly === 0) return

    if (!keyboardPanning) {
      keyboardPanning = true
      tween = null
      markInteract()
    }

    const dist = Math.max(camera.position.distanceTo(controls.target), 0.2)
    if (right !== 0 || up !== 0 || forward !== 0) {
      const step = dist * dt * VIEW_PAN_SPEED
      panOffset
        .copy(panRight)
        .multiplyScalar(right * step)
        .addScaledVector(panWorldUp, up * step)
        .addScaledVector(panForward, forward * step)
      camera.position.add(panOffset)
      controls.target.add(panOffset)
    }
    if (dolly !== 0) {
      const offset = panOffset.copy(camera.position).sub(controls.target)
      const length = offset.length()
      const next = THREE.MathUtils.clamp(
        length * Math.exp(dolly * dt * VIEW_DOLLY_SPEED),
        controls.minDistance,
        controls.maxDistance,
      )
      offset.setLength(next)
      camera.position.copy(controls.target).add(offset)
    }
  }

  function invalidateShadows(): void {
    if (!renderer.shadowMap.enabled || !key.castShadow) return
    renderer.shadowMap.needsUpdate = true
    key.shadow.needsUpdate = true
  }

  const applySize = () => {
    const w = mount.clientWidth || 1
    const h = mount.clientHeight || 1
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap))
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(h, 1)
    camera.updateProjectionMatrix()
    invalidateShadows()
  }
  applySize()
  const ro = new ResizeObserver(applySize)
  ro.observe(mount)

  const worldHotspot = (id: string, target: THREE.Vector3) => {
    const anchor = hotspotAnchors.get(id)
    if (anchor) {
      anchor.getWorldPosition(target)
      return
    }
    const spec = HOTSPOTS.find((h) => h.id === id)
    if (!spec) {
      target.copy(boxCenter)
      return
    }
    target.set(
      boxCenter.x + spec.position[0] * (boxSize.x * 0.5),
      boxCenter.y + spec.position[1] * (boxSize.y * 0.5),
      boxCenter.z + spec.position[2] * (boxSize.z * 0.5),
    )
  }

  const poseForPreset = (id: CameraPresetId) => {
    const preset = CAMERA_PRESETS.find((p) => p.id === id) ?? CAMERA_PRESETS[0]
    camera.fov = preset.fov
    camera.updateProjectionMatrix()
    const dist = framingDistance(camera, radius, 1.15) * preset.distanceMul
    const target = new THREE.Vector3(
      boxCenter.x + preset.targetOffset[0] * boxSize.x + (heroBias && id === 'hero' ? HERO_BIAS_X : 0),
      Math.max(boxCenter.y + preset.targetOffset[1] * boxSize.y, 0.08),
      boxCenter.z + preset.targetOffset[2] * boxSize.z,
    )
    const dir = new THREE.Vector3(...preset.direction).normalize()
    const position = target.clone().addScaledVector(dir, dist)
    return { position, target, fov: preset.fov, dist }
  }

  const applyPose = (id: CameraPresetId, instant: boolean) => {
    const pose = poseForPreset(id)
    controls.minDistance = pose.dist * 0.45
    controls.maxDistance = pose.dist * 2.4
    if (instant || reducedMotion) {
      tween = null
      camera.position.copy(pose.position)
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
      controls.target.copy(pose.target)
      controls.update()
      return
    }
    tween = {
      fromPos: camera.position.clone(),
      toPos: pose.position,
      fromTarget: controls.target.clone(),
      toTarget: pose.target,
      fromFov: camera.fov,
      toFov: pose.fov,
      elapsed: 0,
      duration: 1.05,
    }
  }

  const applySavedCamera = (cam: CameraLook, instant: boolean) => {
    const position = new THREE.Vector3(...cam.position)
    const target = new THREE.Vector3(...cam.target)
    const dist = Math.max(position.distanceTo(target), 0.35)
    controls.minDistance = dist * 0.45
    controls.maxDistance = dist * 2.4
    const fov = cam.fov
    if (instant || reducedMotion) {
      tween = null
      camera.position.copy(position)
      camera.fov = fov
      camera.updateProjectionMatrix()
      controls.target.copy(target)
      controls.update()
      return
    }
    tween = {
      fromPos: camera.position.clone(),
      toPos: position,
      fromTarget: controls.target.clone(),
      toTarget: target,
      fromFov: camera.fov,
      toFov: fov,
      elapsed: 0,
      duration: 1.05,
    }
  }

  const applyHeroCamera = (instant: boolean) => {
    const cam = resolveInitialCamera(currentLook)
    if (cam) applySavedCamera(cam, instant)
    else applyPose('hero', instant)
  }

  const applyScrollCamera = (instant: boolean) => {
    const cam = parseCameraLook(currentLook.scrollCamera)
    if (cam) applySavedCamera(cam, instant)
  }

  const restoreCameraForScroll = (inHero: boolean, instant = reducedMotion) => {
    controls.autoRotate = false
    if (inHero) {
      applyHeroCamera(instant)
      return
    }
    const scroll = parseCameraLook(currentLook.scrollCamera)
    if (scroll) applySavedCamera(scroll, instant)
    else applyHeroCamera(instant)
  }

  const captureLiveCamera = (): CameraLook =>
    roundCameraLook({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      fov: camera.fov,
    })

  const captureLiveModel = (): ModelLook =>
    roundModelLook({
      position: [modelRoot.position.x, modelRoot.position.y, modelRoot.position.z],
      rotation: [modelRoot.rotation.x, modelRoot.rotation.y, modelRoot.rotation.z],
    })

  const captureRestPose = () => {
    modelRoot.updateWorldMatrix(true, true)
    restPosition.copy(modelRoot.position)
    restRotation.copy(modelRoot.rotation)
    restMatrix.copy(modelRoot.matrixWorld)
    restWorldInv.copy(restMatrix).invert()
    restCaptured = true
  }

  const applyModelTransform = (spec?: ModelLook) => {
    if (gizmoDragging) return
    if (spec) {
      modelRoot.position.set(spec.position[0], spec.position[1], spec.position[2])
      modelRoot.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2], 'XYZ')
      rebindSkinnedMeshes()
      return
    }
    if (!restCaptured) return
    modelRoot.position.copy(restPosition)
    modelRoot.rotation.copy(restRotation)
    rebindSkinnedMeshes()
  }

  const projectHotspots = (force = false, now = performance.now()) => {
    if (!force && now - lastHotspotProjectionAt < HOTSPOT_INTERVAL_MS) return
    lastHotspotProjectionAt = now
    const w = mount.clientWidth || 1
    const h = mount.clientHeight || 1
    const points: ScreenHotspot[] = HOTSPOTS.map((spec) => {
      worldHotspot(spec.id, screen)
      screen.project(camera)
      const visible = screen.z > -1 && screen.z < 1
      return {
        id: spec.id,
        x: (screen.x * 0.5 + 0.5) * w,
        y: (-screen.y * 0.5 + 0.5) * h,
        visible,
      }
    })
    if (exploreAnchor.parent) {
      exploreAnchor.getWorldPosition(screen)
      screen.project(camera)
      points.push({
        id: EXPLORE_CUE_ID,
        x: (screen.x * 0.5 + 0.5) * w,
        y: (-screen.y * 0.5 + 0.5) * h,
        visible: screen.z > -1 && screen.z < 1,
      })
    }
    const changed =
      points.length !== lastHotspotPoints.length ||
      points.some((point, index) => {
        const previous = lastHotspotPoints[index]
        return (
          !previous ||
          point.id !== previous.id ||
          point.visible !== previous.visible ||
          Math.abs(point.x - previous.x) > HOTSPOT_POSITION_EPSILON ||
          Math.abs(point.y - previous.y) > HOTSPOT_POSITION_EPSILON
        )
      })
    if (!force && !changed) return
    lastHotspotPoints = points
    onHotspots(points)
  }

  const markerWorld = new THREE.Vector3()
  const restWorldPoint = new THREE.Vector3()
  const setMarkerFromFraction = (
    marker: THREE.Object3D,
    position: [number, number, number],
  ) => {
    markerWorld.set(
      boxCenter.x + position[0] * (boxSize.x * 0.5),
      boxCenter.y + position[1] * (boxSize.y * 0.5),
      boxCenter.z + position[2] * (boxSize.z * 0.5),
    )
    if (restCaptured) {
      marker.position.copy(markerWorld).applyMatrix4(restWorldInv)
      return
    }
    modelRoot.worldToLocal(markerWorld)
    marker.position.copy(markerWorld)
  }

  const buildHotspotAnchors = () => {
    for (const spec of HOTSPOTS) {
      const marker = new THREE.Object3D()
      marker.name = `hotspot-${spec.id}`
      setMarkerFromFraction(marker, spec.position)
      modelRoot.add(marker)
      hotspotAnchors.set(spec.id, marker)
    }
    setMarkerFromFraction(exploreAnchor, PRODUCT.exploreCue.position)
    if (!exploreAnchor.parent) modelRoot.add(exploreAnchor)
  }

  const normalizeModel = (inner: THREE.Object3D) => {
    modelRoot.position.set(0, 0, 0)
    modelRoot.scale.set(1, 1, 1)
    inner.updateWorldMatrix(true, true)

    const box = meshBounds(inner)
    if (box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 0.0001)
    const s = TARGET_SIZE / maxDim

    modelRoot.scale.setScalar(s)
    modelRoot.position.set(-center.x * s, -box.min.y * s, -center.z * s)
    modelRoot.updateWorldMatrix(true, true)
    prepareSkinning(inner)

    const finalBox = meshBounds(modelRoot)
    finalBox.getSize(boxSize)
    finalBox.getCenter(boxCenter)
    radius = Math.max(finalBox.getBoundingSphere(new THREE.Sphere()).radius, 0.2)
    captureRestPose()
    sizeGround()
  }

  const sizeGround = () => {
    const ground = Math.max(boxSize.x, boxSize.z, 0.4)
    const standOn = currentLook.stand.enabled && currentLook.stand.setId !== 'none'
    contact.mesh.scale.setScalar(ground * (standOn ? 0.7 : 0.95))
    contact.mesh.visible = currentLook.shadows.contact
    floor.scale.setScalar(standOn ? Math.max(1.35, ground * 2.35) : Math.max(0.55, ground * 0.72))
    const liveBounds = meshBounds(modelRoot)
    let span = Math.max(0.9, ground * (standOn ? 1.05 : 0.92))
    if (!liveBounds.isEmpty()) {
      const sphere = liveBounds.getBoundingSphere(new THREE.Sphere())
      const target = key.target.position
      span = Math.max(span, sphere.radius + sphere.center.distanceTo(target))
    }
    span *= 1.18
    key.shadow.camera.left = -span
    key.shadow.camera.right = span
    key.shadow.camera.top = span
    key.shadow.camera.bottom = -span
    key.shadow.camera.updateProjectionMatrix()
    invalidateShadows()
  }

  const collectParts = (root: THREE.Object3D) => {
    const names = PRODUCT.explodePartNames
    if (names.length === 0) return
    const center = boxCenter.clone()
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      if (!names.some((n) => obj.name.includes(n) || (obj.parent?.name ?? '').includes(n))) return
      const origin = obj.position.clone()
      const world = new THREE.Vector3()
      obj.getWorldPosition(world)
      const direction = world.sub(center)
      if (direction.lengthSq() < 1e-6) direction.set(0, 1, 0)
      direction.normalize()
      parts.push({ object: obj, origin, direction })
    })
    capabilities.hasExploded = parts.length > 1
  }

  const applyAccentLights = () => {
    const spec = currentLook.lights
    const on = spec?.enabled !== false
    const accentSpec = spec?.accent
    fill.castShadow = false
    rim.castShadow = false
    accent.castShadow = false
    fill.intensity = on ? spec.fill * FILL_ENERGY_SCALE : 0
    rim.intensity = on ? spec.rim * RIM_ENERGY_SCALE : 0
    const accentOn = accentSpec?.enabled !== false
    accent.intensity = on && accentOn
      ? (accentSpec?.intensity ?? 0) * ACCENT_ENERGY_SCALE
      : 0
    if (accentSpec) aimAccentLight(accent, accentSpec.yaw, accentSpec.pitch)
  }

  const lightingLook = (preset: LightingPresetId) => {
    lightingPreset = preset
    applyKeyLights(key, hemi, preset)
    placeAccentLights(fill, rim, preset)
    applyAccentLights()
    applySun()
    const hdr = studioEnv.background instanceof THREE.Texture
    scene.environmentIntensity = preset === 'detail' ? (hdr ? 1.22 : 1.12) : hdr ? 1.15 : 0.95
    renderer.toneMappingExposure = preset === 'detail' ? (hdr ? 1.28 : 1.28) : hdr ? 1.18 : 1.05
  }

  const hdrApplyOpts = () => ({
    environmentIntensity: lightingPreset === 'detail' ? 1.22 : 1.15,
    backgroundIntensity: 0.72,
    backgroundBlurriness: 0.05,
    yaw: currentLook.sun.yaw,
    pitch: currentLook.sun.pitch,
  })

  const ensureHdr = async (id: HdrId): Promise<StudioEnvironment | null> => {
    const cached = hdrCache.get(id)
    if (cached) return cached
    const pending = hdrPending.get(id)
    if (pending) return pending
    const load = (async () => {
      try {
        const equirect = await loadExrEnvironment(hdrUrlFor(id))
        if (disposed) {
          equirect.dispose()
          return null
        }
        const env = createHdrEnvironment(equirect)
        hdrCache.set(id, env)
        return env
      } catch (err) {
        console.warn('[precision-object] HDR failed', id, err)
        return null
      } finally {
        hdrPending.delete(id)
      }
    })()
    hdrPending.set(id, load)
    return load
  }

  const applyHdrEnv = (env: StudioEnvironment, id: HdrId) => {
    if (!usingCachedHdr) studioEnv.dispose()
    studioEnv = env
    usingCachedHdr = true
    activeHdrId = id
    applyStudioEnvironment(scene, studioEnv, hdrApplyOpts())
    lightingLook(lightingPreset)
  }

  const applyHdrId = async (requested: HdrId) => {
    const gen = ++hdrLoadGen
    const preferred = isHdrId(requested) ? requested : DEFAULT_HDR_ID
    if (preferred === activeHdrId && studioEnv.background instanceof THREE.Texture) {
      applyStudioEnvironment(scene, studioEnv, hdrApplyOpts())
      lightingLook(lightingPreset)
      return
    }
    let id = preferred
    let env = await ensureHdr(id)
    if (disposed || gen !== hdrLoadGen) return
    if (!env && id !== FALLBACK_HDR_ID) {
      id = FALLBACK_HDR_ID
      env = await ensureHdr(id)
    }
    if (disposed || gen !== hdrLoadGen || !env) return
    applyHdrEnv(env, id)
  }

  const setExplodedVisual = (value: boolean) => {
    const dist = PRODUCT.explodeDistance
    for (const part of parts) {
      if (value) {
        part.object.position.copy(part.origin).addScaledVector(part.direction, dist)
      } else {
        part.object.position.copy(part.origin)
      }
    }
    if (value) {
      scene.background = new THREE.Color(0x101114)
      scene.backgroundBlurriness = 0
      scene.backgroundIntensity = 1
    } else if (studioEnv.background instanceof THREE.Texture) {
      applyStudioEnvironment(scene, studioEnv, hdrApplyOpts())
    } else {
      scene.background = new THREE.Color(0x0c0c0e)
    }
  }

  const applyHandAngles = (angles: AnalogHandRadians) => {
    if (!cetHands) return
    lastHandAngles = angles
    handQuatScratch.setFromAxisAngle(HAND_AXIS_X, angles.hour)
    cetHands.hour.quaternion.copy(cetHands.hourRest).multiply(handQuatScratch)
    handQuatScratch.setFromAxisAngle(HAND_AXIS_X, angles.minute)
    cetHands.minute.quaternion.copy(cetHands.minuteRest).multiply(handQuatScratch)
    if (cetHands.second && cetHands.secondRest) {
      handQuatScratch.setFromAxisAngle(HAND_AXIS_X, angles.second)
      cetHands.second.quaternion.copy(cetHands.secondRest).multiply(handQuatScratch)
    }
    shadowPoseDirty = true
  }

  const applyCrownAngle = (angle: number) => {
    if (!cetCrown) return
    if (!Number.isFinite(angle) || Math.abs(angle) < 1e-10) {
      cetCrown.bone.quaternion.copy(cetCrown.rest)
      shadowPoseDirty = true
      return
    }
    crownQuatScratch.setFromAxisAngle(cetCrown.axis, angle)
    cetCrown.bone.quaternion.copy(cetCrown.rest).multiply(crownQuatScratch)
    shadowPoseDirty = true
  }

  const restoreCrown = () => {
    applyCrownAngle(0)
  }

  const applyCetClock = () => {
    if (!cetHands) return
    applyHandAngles(analogHandRadians(berlinCivilTime()))
  }

  const applyDisplayedHands = () => {
    if (!cetHands) return
    if (handsFrozen && frozenCivil) {
      applyHandAngles(analogHandRadians(frozenCivil))
      return
    }
    applyCetClock()
  }

  /** Bind after wrapper pose so hand bones stay on the spindle. Reset rest first so inverses are not the live CET pose. */
  function rebindSkinnedMeshes() {
    if (cetHands) {
      cetHands.hour.quaternion.copy(cetHands.hourRest)
      cetHands.minute.quaternion.copy(cetHands.minuteRest)
      if (cetHands.second && cetHands.secondRest) cetHands.second.quaternion.copy(cetHands.secondRest)
    }
    if (cetCrown) cetCrown.bone.quaternion.copy(cetCrown.rest)
    prepareSkinning(modelRoot)
    if (cetHands && !handTween && (handsFrozen || motionWanted)) applyDisplayedHands()
    shadowPoseDirty = true
  }

  const applyHandsFreeze = (value: boolean) => {
    if (value === handsFrozen) return
    if (value) {
      handsFrozen = true
      frozenCivil = berlinCivilTime()
      handTween = null
      restoreCrown()
      applyDisplayedHands()
      return
    }
    handsFrozen = false
    frozenCivil = null
    if (!cetHands) {
      pendingZoneSweep = false
      restoreCrown()
      return
    }
    if (pendingZoneSweep && motionWanted) {
      pendingZoneSweep = false
      if (reducedMotion) {
        restoreCrown()
        applyCetClock()
      } else beginZoneHandTween()
      return
    }
    pendingZoneSweep = false
    restoreCrown()
    if (motionWanted) applyCetClock()
  }

  const beginZoneHandTween = () => {
    if (!cetHands) return
    const to = analogHandRadians(berlinCivilTime())
    const from = lastHandAngles ?? to
    const delta = zoneHandDeltas(from, to)
    restoreCrown()
    handTween = {
      from,
      delta,
      crownDelta: cetCrown ? crownWindDelta(delta) : 0,
      elapsed: 0,
      duration: ZONE_HAND_TWEEN_SEC,
    }
  }

  const tickZoneHandTween = (dt: number) => {
    if (!handTween || !cetHands) return false
    handTween.elapsed += dt
    const t = Math.min(1, Math.max(0, handTween.elapsed / handTween.duration))
    const u = easeOutCubic(t)
    applyHandAngles({
      hour: handTween.from.hour + handTween.delta.hour * u,
      minute: handTween.from.minute + handTween.delta.minute * u,
      second: handTween.from.second + handTween.delta.second * u,
    })
    if (cetCrown) {
      applyCrownAngle(handTween.crownDelta * easeInOutCubic(t))
    }
    if (handTween.elapsed >= handTween.duration) {
      handTween = null
      restoreCrown()
      applyCetClock()
    }
    return true
  }

  const commitWatchTimeZone = (timeZone: string) => {
    setWatchTimeZone(timeZone)
    const next = getTimeZone()
    if (next === appliedWatchZone) return
    appliedWatchZone = next
    if (!cetHands) return
    if (!motionWanted) {
      handTween = null
      restoreCrown()
      return
    }
    if (handsFrozen) {
      handTween = null
      restoreCrown()
      pendingZoneSweep = true
      return
    }
    if (reducedMotion) {
      handTween = null
      restoreCrown()
      applyCetClock()
      return
    }
    beginZoneHandTween()
  }

  const applyMotion = (value: boolean) => {
    motionWanted = value
    if (cetHands) {
      if (!motionWanted) {
        handTween = null
        restoreCrown()
        return
      }
      if (handsFrozen) return
      applyCetClock()
      return
    }
    if (!motionAction) return
    if (motionWanted) {
      motionAction.paused = false
      motionAction.play()
      return
    }
    motionAction.paused = true
  }

  const captureWatchMaterials = (root: THREE.Object3D) => {
    watchMatRest.length = 0
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of mats) {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue
        const physical = mat instanceof THREE.MeshPhysicalMaterial ? mat : null
        watchMatRest.push({
          mat,
          groupId: materialGroupId(mat.name) ?? materialGroupId(obj.name),
          meshName: obj.name,
          color: mat.color.clone(),
          roughness: mat.roughness,
          metalness: mat.metalness,
          envMapIntensity: mat.envMapIntensity,
          normalScale: mat.normalScale.clone(),
          transmission: physical?.transmission ?? 0,
          ior: physical?.ior ?? 1.5,
        })
      }
    })
    watchPbrReady = true
    const grouped: MaterialLook[] = []
    for (const group of MATERIAL_GROUPS) {
      const first = watchMatRest.find((item) => item.groupId === group.id)
      if (!first) continue
      grouped.push({
        id: group.id,
        label: group.label,
        metalness: first.mat.metalness,
        roughness: first.mat.roughness,
        envMapIntensity: first.mat.envMapIntensity,
        color: `#${first.mat.color.getHexString()}`,
        lightness: group.id === 'black' ? DEFAULT_MATERIAL_LIGHTNESS : undefined,
        transmission: group.glass ? first.transmission || 0.86 : undefined,
        ior: group.glass ? first.ior : undefined,
      })
    }
    onMaterials?.(grouped)
  }

  const applySun = () => {
    currentLook = {
      ...currentLook,
      sun: { yaw: currentLook.sun.yaw, pitch: clampSunPitch(currentLook.sun.pitch) },
    }
    applyEnvironmentOrientation(scene, currentLook.sun.yaw, currentLook.sun.pitch)
    aimHdrSunLight(key, currentLook.sun.yaw, currentLook.sun.pitch)
    sizeGround()
    invalidateShadows()
  }
  applySun()

  const applyShadows = () => {
    const { enabled, contact: contactBlob, intensity, softness } = currentLook.shadows
    renderer.shadowMap.enabled = enabled
    key.castShadow = enabled
    floor.receiveShadow = enabled
    modelRoot.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      if (hasTransmission(obj.material)) {
        obj.castShadow = false
        obj.receiveShadow = false
        return
      }
      obj.castShadow = enabled
      obj.receiveShadow = enabled
    })
    contact.mesh.visible = contactBlob
    // PCFSoftShadowMap ignores shadow.radius. VSM blur is in shadow-map pixels.
    const t = Math.min(1, Math.max(0, softness))
    if (t <= 0.001) {
      key.shadow.radius = 0
      key.shadow.blurSamples = 1
    } else {
      key.shadow.radius = 2 + t * 16
      key.shadow.blurSamples = Math.round(4 + t * 4)
    }
    key.shadow.intensity = intensity
    key.shadow.bias = -0.0001
    key.shadow.normalBias = 0.02
    shadowPoseDirty = true
    invalidateShadows()
    sizeGround()
  }

  const applyFloorPbr = () => {
    const spec = currentLook.stand
    const on = spec.enabled && spec.setId !== 'none' && Boolean(floorPbrMaps)
    if (on && floorPbrMaps) {
      floorMat.color.set(spec.useAlbedo ? 0xffffff : floorRest.color)
      floorMat.map = spec.useAlbedo ? floorPbrMaps.color : null
      floorMat.roughnessMap = floorPbrMaps.roughness
      floorMat.metalnessMap = floorPbrMaps.metalness
      floorMat.normalMap = floorPbrMaps.normal
      // CircleGeometry only has a subdivided perimeter, so displacement cannot
      // produce useful interior relief and is intentionally left disabled.
      floorMat.displacementMap = null
      floorMat.metalness = 0.82
      floorMat.roughness = 1
      floorMat.displacementScale = 0
      floorMat.displacementBias = 0
      floorMat.normalScale.set(spec.normalScale, spec.normalScale)
      floorMat.envMapIntensity = 1.55
      floor.receiveShadow = currentLook.shadows.enabled
    } else {
      floorMat.color.copy(floorRest.color)
      floorMat.map = null
      floorMat.roughnessMap = null
      floorMat.metalnessMap = null
      floorMat.normalMap = null
      floorMat.displacementMap = null
      floorMat.metalness = floorRest.metalness
      floorMat.roughness = floorRest.roughness
      floorMat.displacementScale = 0
      floorMat.normalScale.set(1, 1)
      floorMat.envMapIntensity = floorRest.envMapIntensity
      floor.receiveShadow = currentLook.shadows.enabled
    }
    floorMat.needsUpdate = true
  }

  const applyWatchPbr = () => {
    if (!watchPbrReady) return
    const spec = currentLook.watch
    const on = spec.enabled && spec.setId !== 'none' && Boolean(watchPbrMaps)
    for (const rest of watchMatRest) {
      const metal = isWatchMetalMaterial(rest.mat, rest.meshName)
      if (on && metal && watchPbrMaps) {
        rest.mat.map = spec.useAlbedo ? watchPbrMaps.color : null
        // metal049a roughness is ~black, so roughness * map stays chrome and kills the slider.
        // Normal (and optional albedo) keep the PBR detail; sliders own roughness/metalness.
        rest.mat.roughnessMap = null
        rest.mat.metalnessMap = null
        // Do not computeTangents() on this skinned GLB: degenerate UVs leave 0-length
        // tangents, GLSL normalize(0) is NaN, and metal goes black. Three.js then uses
        // screen-space TBN (getTangentFrame). DirectX maps flip via normalScale.y.
        const nrm = watchPbrMaps.normal
        const img = nrm?.image as { width?: number; height?: number } | undefined
        if (nrm && img && img.width && img.height) {
          rest.mat.normalMap = nrm
          rest.mat.normalMapType = THREE.TangentSpaceNormalMap
          const flipY = nrm.userData.directX === true ? -1 : 1
          rest.mat.normalScale.set(spec.normalScale, spec.normalScale * flipY)
        } else {
          rest.mat.normalMap = null
          rest.mat.normalScale.set(1, 1)
        }
      } else {
        rest.mat.map = null
        rest.mat.roughnessMap = null
        rest.mat.metalnessMap = null
        rest.mat.normalMap = null
        rest.mat.normalScale.copy(rest.normalScale)
      }
      rest.mat.needsUpdate = true
    }
  }

  const applyMaterials = () => {
    if (!watchPbrReady) return
    for (const rest of watchMatRest) {
      if (!rest.groupId) continue
      const spec = currentLook.materials.find((item) => item.id === rest.groupId)
      if (!spec) continue
      applyMaterialTint(rest.mat, spec)
      rest.mat.metalness = effectiveMaterialMetalness(spec)
      rest.mat.roughness = effectiveMaterialRoughness(spec)
      rest.mat.roughnessMap = null
      rest.mat.metalnessMap = null
      rest.mat.envMapIntensity = effectiveMaterialEnv(spec)
      if (rest.mat instanceof THREE.MeshPhysicalMaterial) {
        if (spec.transmission != null) rest.mat.transmission = spec.transmission
        if (spec.id === 'glass') {
          rest.mat.ior = effectiveGlassIor(spec)
          rest.mat.thickness = SAPPHIRE_THICKNESS
        } else if (spec.ior != null) rest.mat.ior = spec.ior
      }
      rest.mat.needsUpdate = true
    }
  }

  const applyDialPbr = () => {
    if (!watchPbrReady) return
    const spec = currentLook.dial
    const on = spec.enabled && spec.setId !== 'none' && Boolean(dialPbrMaps)
    for (const rest of watchMatRest) {
      if (!isDialMaterial(rest.mat, rest.meshName)) continue
      if (on && dialPbrMaps) {
        rest.mat.map = spec.useAlbedo ? dialPbrMaps.color : null
        rest.mat.roughnessMap = dialPbrMaps.roughness
        rest.mat.metalnessMap = dialPbrMaps.metalness
        const nrm = dialPbrMaps.normal
        const img = nrm?.image as { width?: number; height?: number } | undefined
        if (nrm && img && img.width && img.height) {
          rest.mat.normalMap = nrm
          rest.mat.normalMapType = THREE.TangentSpaceNormalMap
          const flipY = nrm.userData.directX === true ? -1 : 1
          rest.mat.normalScale.set(spec.normalScale, spec.normalScale * flipY)
        } else {
          rest.mat.normalMap = null
          rest.mat.normalScale.set(1, 1)
        }
      } else {
        rest.mat.map = null
        rest.mat.roughnessMap = null
        rest.mat.metalnessMap = null
        rest.mat.normalMap = null
        rest.mat.normalScale.copy(rest.normalScale)
      }
      rest.mat.needsUpdate = true
    }
  }

  const applyHotspotOverrides = () => {
    for (const spec of currentLook.hotspots) {
      const marker = hotspotAnchors.get(spec.id)
      if (!marker) continue
      setMarkerFromFraction(marker, spec.position)
    }
  }

  const textureUrlsFor = (spec: TextureTargetLook, target: 'stand' | 'watch' | 'dial'): PbrMapUrls | Partial<PbrMapUrls> | null => {
    if (!spec.enabled || spec.setId === 'none') return null
    if (spec.setId === 'custom') return customMapCache[target] ?? null
    return textureSetUrls(spec.setId, target) ?? TEXTURE_SETS.find((set) => set.id === spec.setId)?.urls ?? PRODUCT.pbrMaps
  }

  const mapsForTarget = async (spec: TextureTargetLook, target: 'stand' | 'watch' | 'dial') => {
    const urls = textureUrlsFor(spec, target)
    if (!urls) return null
    const kinds = mapKindsByTarget[target]
    const urlKey = kinds.map((kind) => `${kind}:${urls[kind] ?? ''}`).join('|')
    const key = `${target}:${spec.setId}:${urlKey}`
    let source = sourceCache.get(key)
    if (!source) {
      const loaded = await loadPbrMapsPartial(urls, anisotropy, kinds)
      if (disposed) {
        loaded.dispose()
        return null
      }
      source = loaded
      sourceCache.set(key, source)
    }
    return clonePbrMaps(source, spec.repeat, anisotropy)
  }

  const mapsKey = (spec: TextureTargetLook, target: 'stand' | 'watch' | 'dial') => {
    const urls = textureUrlsFor(spec, target)
    const urlKey = urls
      ? mapKindsByTarget[target].map((kind) => `${kind}:${urls[kind] ?? ''}`).join('|')
      : ''
    return `${target}:${spec.enabled}:${spec.setId}:${spec.repeat}:${urlKey}`
  }

  let lastMapKey = ''

  const applyLook = async (look: SavedLook) => {
    currentLook = {
      ...look,
      hdrId: isHdrId(look.hdrId) ? look.hdrId : DEFAULT_HDR_ID,
      sun: { yaw: look.sun.yaw, pitch: clampSunPitch(look.sun.pitch) },
      lights: {
        enabled: look.lights?.enabled ?? true,
        fill: look.lights?.fill ?? defaultLook().lights.fill,
        rim: look.lights?.rim ?? defaultLook().lights.rim,
        accent: {
          ...defaultLook().lights.accent,
          ...look.lights?.accent,
          pitch: clampAccentPitch(look.lights?.accent?.pitch ?? defaultLook().lights.accent.pitch),
        },
      },
      camera: parseCameraLook(look.camera) ?? currentLook.camera,
      scrollCamera: parseCameraLook(look.scrollCamera) ?? currentLook.scrollCamera,
      views: parseNamedViews(look.views),
      model: parseModelLook(look.model),
      hands: parseHandsLook(look.hands) ?? currentLook.hands,
    }
    setHandCalibration(currentLook.hands)
    if (cetHands && !handTween && (handsFrozen || motionWanted)) applyDisplayedHands()
    applySun()
    void applyHdrId(currentLook.hdrId)
    applyShadows()
    applyAccentLights()
    const nextKey = `${mapsKey(look.stand, 'stand')}|${mapsKey(look.watch, 'watch')}|${mapsKey(look.dial, 'dial')}`
    if (nextKey !== lastMapKey) {
      const generation = ++lookMapGeneration
      lastMapKey = nextKey
      let nextFloorMaps: PbrMapSet | null = null
      let nextWatchMaps: PbrMapSet | null = null
      let nextDialMaps: PbrMapSet | null = null
      const discardLoadedMaps = () => {
        nextFloorMaps?.dispose()
        nextWatchMaps?.dispose()
        nextDialMaps?.dispose()
      }
      try {
        if (look.stand.enabled && look.stand.setId !== 'none') {
          nextFloorMaps = await mapsForTarget(look.stand, 'stand')
        }
        if (disposed || generation !== lookMapGeneration) {
          discardLoadedMaps()
          return
        }
        if (look.watch.enabled && look.watch.setId !== 'none') {
          nextWatchMaps = await mapsForTarget(look.watch, 'watch')
        }
        if (disposed || generation !== lookMapGeneration) {
          discardLoadedMaps()
          return
        }
        if (look.dial.enabled && look.dial.setId !== 'none') {
          nextDialMaps = await mapsForTarget(look.dial, 'dial')
        }
        if (disposed || generation !== lookMapGeneration) {
          discardLoadedMaps()
          return
        }
        floorPbrMaps?.dispose()
        watchPbrMaps?.dispose()
        dialPbrMaps?.dispose()
        floorPbrMaps = nextFloorMaps
        watchPbrMaps = nextWatchMaps
        dialPbrMaps = nextDialMaps
      } catch (err) {
        discardLoadedMaps()
        if (disposed || generation !== lookMapGeneration) return
        console.warn('[precision-object] look maps failed', err)
      }
    }
    if (disposed) return
    applyFloorPbr()
    applyWatchPbr()
    applyMaterials()
    applyDialPbr()
    applyModelTransform(currentLook.model)
    applyHotspotOverrides()
    sizeGround()
  }

  onLoad({ status: 'loading', progress: 0.04 })

  const mountGltf = (gltf: Awaited<ReturnType<typeof loadGltf>>) => {
    if (disposed) return
    prepareGlass(gltf.scene, !mobile)
    polishMaterials(gltf.scene)
    enableShadows(gltf.scene)
    modelRoot.add(gltf.scene)
    normalizeModel(gltf.scene)
    applyModelTransform(parseModelLook(currentLook.model))
    captureWatchMaterials(gltf.scene)
    void applyLook(currentLook)

    const materials = new Set<string>()
    const meshes: string[] = []
    gltf.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      meshes.push(obj.name || '(unnamed mesh)')
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of mats) {
        if (mat && 'name' in mat && mat.name) materials.add(String(mat.name))
      }
    })

    const clips = gltf.animations ?? []
    const motionClip =
      clips.find((clip) => /action|second|hand|tick/i.test(clip.name)) ?? clips[0] ?? null

    const bones = new Map<string, THREE.Object3D>()
    gltf.scene.traverse((obj) => {
      if (obj.name) bones.set(obj.name, obj)
    })
    const pickBone = (names: readonly string[]) => {
      for (const name of names) {
        const bone = bones.get(name)
        if (bone) return bone
      }
      return null
    }
    const hourBone = pickBone(WATCH_HAND_BONES.hour)
    const minuteBone = pickBone(WATCH_HAND_BONES.minute)
    const secondBone = pickBone(WATCH_HAND_BONES.second)
    const crownBone = pickBone(WATCH_CROWN_BONES)
    if (hourBone && minuteBone) {
      cetHands = {
        hour: hourBone,
        minute: minuteBone,
        second: secondBone,
        hourRest: hourBone.quaternion.clone(),
        minuteRest: minuteBone.quaternion.clone(),
        secondRest: secondBone?.quaternion.clone() ?? null,
      }
    }
    if (crownBone) {
      cetCrown = {
        bone: crownBone,
        rest: crownBone.quaternion.clone(),
        axis: measureCrownStemAxis(crownBone, gltf.scene),
      }
    }

    if (cetHands) {
      applyMotion(motionWanted)
    } else if (motionClip) {
      mixer = new THREE.AnimationMixer(gltf.scene)
      motionAction = mixer.clipAction(motionClip)
      motionAction.clampWhenFinished = false
      motionAction.setLoop(THREE.LoopRepeat, Infinity)
      applyMotion(motionWanted)
    }

    collectParts(gltf.scene)
    buildHotspotAnchors()

    capabilities = {
      loaded: true,
      hasMotion: Boolean(cetHands || motionClip),
      motionClipName: cetHands ? 'CET Europe/Berlin' : motionClip?.name ?? null,
      hasExploded: parts.length > 1,
      animations: clips.map((c) => c.name),
      materials: [...materials],
      meshes,
      size: [boxSize.x, boxSize.y, boxSize.z],
    }

    applyHeroCamera(true)
    onLoad({ status: 'ready' })
    onReady(capabilities)
    renderer.render(scene, camera)
    projectHotspots(true)
  }

  void loadGltf(PRODUCT.modelUrl, (progress) => {
    if (!disposed) onLoad({ status: 'loading', progress })
  }).then(mountGltf, (err: unknown) => {
    if (disposed) return
    const missing = String(err).includes('404') || /Not Found/i.test(String(err))
    onLoad({
      status: 'error',
      message: missing ? PRODUCT.missingModel : PRODUCT.loadError,
    })
    applyHeroCamera(true)
    onReady(capabilities)
  })

  void applyLook(currentLook)

  let raf = 0
  let lastT = performance.now()
  let visible = document.visibilityState !== 'hidden'

  const scheduleTick = () => {
    if (disposed || !visible || !active || raf !== 0) return
    raf = requestAnimationFrame(tick)
  }

  const pauseTick = () => {
    if (raf === 0) return
    cancelAnimationFrame(raf)
    raf = 0
  }

  const tick = (now: number) => {
    raf = 0
    if (disposed) return
    if (!visible || !active) {
      lastT = now
      return
    }
    const dt = Math.min(0.05, (now - lastT) / 1000)
    lastT = now

    if (cetHands && motionWanted && !handsFrozen) {
      if (handTween) tickZoneHandTween(dt)
      else applyCetClock()
    } else if (mixer && motionWanted) {
      mixer.update(dt)
      shadowPoseDirty = true
    }

    if (!interacting && autoRotateWanted && !gizmoWanted && !gizmoDragging && !reducedMotion && now > resumeRotateAt && !tween) {
      controls.autoRotate = true
    }

    if (tween) {
      tween.elapsed += dt
      const u = easeInOutCubic(Math.min(1, tween.elapsed / tween.duration))
      camera.position.lerpVectors(tween.fromPos, tween.toPos, u)
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, u)
      camera.fov = tween.fromFov + (tween.toFov - tween.fromFov) * u
      camera.updateProjectionMatrix()
      if (u >= 1) tween = null
    }

    applyKeyboardPan(dt)
    controls.update()
    const shadowMotionActive =
      motionWanted && !handsFrozen && Boolean(cetHands || mixer)
    if (
      renderer.shadowMap.enabled &&
      key.castShadow &&
      shadowPoseDirty &&
      (!shadowMotionActive || now - lastShadowUpdate >= SHADOW_MOTION_INTERVAL_MS)
    ) {
      invalidateShadows()
      shadowPoseDirty = false
      lastShadowUpdate = now
    }
    renderer.render(scene, camera)
    projectHotspots(false, now)
    scheduleTick()
  }

  const onVisibility = () => {
    visible = document.visibilityState !== 'hidden'
    if (visible) {
      lastT = performance.now()
      scheduleTick()
    } else {
      pauseTick()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const PLACE_UI = 'button, input, textarea, select, a, .pov-studio, .pov-controls, .pov-detail, .pov-mechanism'
  const onPlacePointer = (event: PointerEvent) => {
    if (!interactionEnabled || !placeMode || !placeHotspotId || event.button !== 0) return
    if (event.ctrlKey || event.metaKey || event.shiftKey) return
    if (gizmoDragging || (gizmoWanted && transformControls.axis)) return
    if (event.target instanceof Element && event.target.closest(PLACE_UI)) return
    const rect = renderer.domElement.getBoundingClientRect()
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      return
    }
    pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    modelRoot.updateWorldMatrix(true, true)
    modelRoot.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh && obj.skeleton) {
        obj.skeleton.update()
        obj.computeBoundingSphere()
      }
    })
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObject(modelRoot, true)
    const hit = hits.find((item) => {
      const name = item.object.name
      return name !== 'StudioFloor' && name !== 'ContactShadow' && !name.startsWith('hotspot-')
    })
    if (!hit) return
    event.preventDefault()
    event.stopPropagation()
    restWorldPoint.copy(hit.point)
    if (restCaptured) {
      modelRoot.worldToLocal(restWorldPoint)
      restWorldPoint.applyMatrix4(restMatrix)
    }
    const hx = boxSize.x > 1e-5 ? (restWorldPoint.x - boxCenter.x) / (boxSize.x * 0.5) : 0
    const hy = boxSize.y > 1e-5 ? (restWorldPoint.y - boxCenter.y) / (boxSize.y * 0.5) : 0
    const hz = boxSize.z > 1e-5 ? (restWorldPoint.z - boxCenter.z) / (boxSize.z * 0.5) : 0
    const position: [number, number, number] = [
      Number(hx.toFixed(3)),
      Number(hy.toFixed(3)),
      Number(hz.toFixed(3)),
    ]
    const existing = currentLook.hotspots.find((item) => item.id === placeHotspotId)
    currentLook = {
      ...currentLook,
      hotspots: existing
        ? currentLook.hotspots.map((item) => (item.id === placeHotspotId ? { ...item, position } : item))
        : [...currentLook.hotspots, { id: placeHotspotId, position }],
    }
    applyHotspotOverrides()
    onHotspotPlaced?.(placeHotspotId, position)
    onInteract()
  }
  mount.addEventListener('pointerdown', onPlacePointer, true)

  scheduleTick()

  const api: ViewerApi = {
    setAutoRotate: (value) => {
      autoRotateWanted = value && !reducedMotion
      controls.autoRotate = autoRotateWanted && !interacting && !tween
    },
    setLighting: (preset) => {
      lightingLook(preset)
    },
    setMotion: (value) => {
      applyMotion(value)
    },
    setHandsFrozen: (value) => {
      applyHandsFreeze(value)
    },
    setTimeZone: (timeZone) => {
      commitWatchTimeZone(timeZone)
    },
    setPbr: (value) => {
      currentLook = {
        ...currentLook,
        stand: { ...currentLook.stand, enabled: value },
        watch: { ...currentLook.watch, enabled: value },
        dial: { ...currentLook.dial, enabled: value },
      }
      void applyLook(currentLook)
    },
    setLook: (look) => {
      void applyLook(look)
    },
    captureCamera: () => captureLiveCamera(),
    captureModel: () => captureLiveModel(),
    setGizmoVisible: (value) => {
      gizmoWanted = value
      transformControls.enabled = value && interactionEnabled
      gizmoHelper.visible = value && interactionEnabled
      if (!value) {
        gizmoDragging = false
        transformControls.axis = null
        controls.autoRotate = autoRotateWanted && !interacting && !tween
      } else {
        controls.autoRotate = false
      }
      syncOrbitEnabled()
    },
    setGizmoMode: (mode) => {
      transformControls.setMode(mode)
      transformControls.space = mode === 'rotate' ? 'local' : 'world'
    },
    setPlaceHotspots: (value) => {
      placeMode = value
      controls.autoRotate = !value && autoRotateWanted && !interacting && !tween && !gizmoDragging
      renderer.domElement.style.cursor = value && interactionEnabled ? 'crosshair' : ''
      syncOrbitEnabled()
    },
    setPlaceHotspotId: (id) => {
      placeHotspotId = id
    },
    setExploded: (value) => {
      if (!capabilities.hasExploded) return
      setExplodedVisual(value)
    },
    setHeroBias: (value) => {
      heroBias = value
    },
    setActive: (value) => {
      active = value
      if (value) {
        lastT = performance.now()
        scheduleTick()
      } else {
        pauseTick()
      }
    },
    setInteractionEnabled: (value) => {
      interactionEnabled = value
      if (!value) {
        interacting = false
        renderer.domElement.style.cursor = ''
        heldPanCodes.clear()
        keyboardPanning = false
        ctrlPanHeld = false
        gizmoDragging = false
        transformControls.axis = null
        transformControls.enabled = false
        gizmoHelper.visible = false
      } else if (gizmoWanted) {
        transformControls.enabled = true
        gizmoHelper.visible = true
      }
      applyCanvasPointerLock()
      syncOrbitEnabled()
    },
    setCameraPan: (value) => {
      cameraPanEnabled = value
      if (!value) {
        heldPanCodes.clear()
        keyboardPanning = false
      }
      syncOrbitEnabled()
    },
    resetCamera: () => {
      const hero = parseCameraLook(currentLook.views?.hero)
      const front = parseCameraLook(currentLook.views?.front)
      if (hero) applySavedCamera(hero, reducedMotion)
      else if (front) applySavedCamera(front, reducedMotion)
      else applyPose('front', reducedMotion)
    },
    goToInitialCamera: () => {
      controls.autoRotate = false
      applyHeroCamera(reducedMotion)
    },
    goToScrollCamera: () => {
      controls.autoRotate = false
      applyScrollCamera(reducedMotion)
    },
    restoreCameraForScroll: (inHero: boolean) => {
      restoreCameraForScroll(inHero)
    },
    goToPreset: (id) => {
      controls.autoRotate = false
      const assigned = parseCameraLook(currentLook.views?.[id])
      if (assigned) applySavedCamera(assigned, reducedMotion)
      else if (id === 'hero') applyHeroCamera(reducedMotion)
      else applyPose(id, reducedMotion)
    },
    focusHotspot: (id) => {
      const spec = HOTSPOTS.find((h) => h.id === id)
      if (!spec) return
      controls.autoRotate = false
      const assigned = parseCameraLook(currentLook.hotspots.find((item) => item.id === id)?.camera)
      if (assigned) {
        applySavedCamera(assigned, reducedMotion)
        return
      }
      const presetId = spec.cameraPreset ?? 'detail'
      const pose = poseForPreset(presetId)
      const look = new THREE.Vector3()
      worldHotspot(id, look)
      if (spec.cameraTarget) {
        look.set(
          boxCenter.x + spec.cameraTarget[0] * (boxSize.x * 0.5),
          boxCenter.y + spec.cameraTarget[1] * (boxSize.y * 0.5),
          boxCenter.z + spec.cameraTarget[2] * (boxSize.z * 0.5),
        )
      }
      const closer = Math.max(pose.dist * 0.72, controls.minDistance)
      const toPos = look.clone().addScaledVector(
        pose.position.clone().sub(pose.target).normalize(),
        closer,
      )
      tween = {
        fromPos: camera.position.clone(),
        toPos,
        fromTarget: controls.target.clone(),
        toTarget: look,
        fromFov: camera.fov,
        toFov: pose.fov,
        elapsed: 0,
        duration: reducedMotion ? 0.01 : 0.95,
      }
    },
    enterFullscreen: async () => {
      if (!document.fullscreenElement) await mount.requestFullscreen()
    },
    exitFullscreen: async () => {
      if (document.fullscreenElement) await document.exitFullscreen()
    },
  }

  const dispose = () => {
    disposed = true
    lookMapGeneration++
    pauseTick()
    ro.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('keydown', onCameraKeyDown, true)
    window.removeEventListener('keyup', onCameraKeyUp, true)
    window.removeEventListener('blur', onCameraBlur)
    mount.removeEventListener('pointerdown', onPlacePointer, true)
    transformControls.dispose()
    scene.remove(gizmoHelper)
    controls.removeEventListener('start', markInteract)
    controls.removeEventListener('end', endInteract)
    controls.dispose()
    contact.dispose()
    floorGeo.dispose()
    floorMat.dispose()
    mixer?.stopAllAction()
    for (const env of hdrCache.values()) env.dispose()
    hdrCache.clear()
    if (!usingCachedHdr) studioEnv.dispose()
    floorPbrMaps?.dispose()
    watchPbrMaps?.dispose()
    dialPbrMaps?.dispose()
    for (const set of sourceCache.values()) set.dispose()
    sourceCache.clear()
    modelRoot.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.geometry.dispose()
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of mats) mat.dispose()
    })
    renderer.dispose()
    if (renderer.domElement.parentElement === mount) {
      mount.removeChild(renderer.domElement)
    }
  }

  return { api, dispose }
}

function emptyApi(): ViewerApi {
  const noop = () => undefined
  return {
    setAutoRotate: noop,
    setLighting: noop,
    setMotion: noop,
    setHandsFrozen: noop,
    setTimeZone: noop,
    setPbr: noop,
    setLook: noop,
    captureCamera: () => null,
    captureModel: () => null,
    setGizmoVisible: noop,
    setGizmoMode: noop,
    setPlaceHotspots: noop,
    setPlaceHotspotId: noop,
    setExploded: noop,
    setHeroBias: noop,
    setActive: noop,
    setInteractionEnabled: noop,
    setCameraPan: noop,
    resetCamera: noop,
    goToInitialCamera: noop,
    goToScrollCamera: noop,
    restoreCameraForScroll: noop,
    goToPreset: noop,
    focusHotspot: noop,
    enterFullscreen: async () => undefined,
    exitFullscreen: async () => undefined,
  }
}
