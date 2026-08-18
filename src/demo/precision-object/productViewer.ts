import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CAMERA_PRESETS, HOTSPOTS, PRODUCT } from './productConfig'
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
  isWatchMetalMaterial,
  loadPbrMapsPartial,
  type PbrMapSet,
  type PbrMapUrls,
} from './pbrTextures'
import {
  DEFAULT_HDR_ID,
  FALLBACK_HDR_ID,
  MATERIAL_GROUPS,
  TEXTURE_SETS,
  clampAccentPitch,
  clampSunPitch,
  customMapCache,
  defaultLook,
  hdrUrlFor,
  isHdrId,
  materialGroupId,
  parseCameraLook,
  parseNamedViews,
  roundCameraLook,
  textureSetUrls,
  type CameraLook,
  type HdrId,
  type MaterialLook,
  type SavedLook,
  type TextureTargetLook,
} from './lookStudio'
import type {
  CameraPresetId,
  LightingPresetId,
  LoadState,
  ModelCapabilities,
  ScreenHotspot,
  ViewerApi,
} from './types'

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

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
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
          metalness: spec?.metalness ?? 0,
          roughness: spec?.roughness ?? 0,
          transmission: spec?.transmission ?? 0.94,
          thickness: 0.38,
          ior: spec?.ior ?? 1,
          specularIntensity: 1,
          transparent: true,
          opacity: 1,
          envMapIntensity: spec?.envMapIntensity ?? 3,
          side: THREE.FrontSide,
          depthWrite: false,
        })
        mat.dispose()
        return phys
      }

      mat.metalness = spec?.metalness ?? 0
      mat.roughness = spec?.roughness ?? 0.05
      mat.transparent = true
      mat.opacity = Math.max(mat.opacity, 0.22)
      mat.depthWrite = false
      mat.side = THREE.FrontSide
      mat.envMapIntensity = spec?.envMapIntensity ?? 2.1
      if (spec) mat.color.set(spec.color)
      return mat
    })
    obj.material = Array.isArray(obj.material) ? next : next[0]
  })
}

function prepareSkinning(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true)
  const rebound = new Set<THREE.Skeleton>()
  root.traverse((obj) => {
    if (!(obj instanceof THREE.SkinnedMesh) || !obj.skeleton) return
    if (!rebound.has(obj.skeleton)) {
      obj.skeleton.calculateInverses()
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
      mat.color.set(spec.color)
      mat.metalness = spec.metalness
      mat.roughness = spec.roughness
      mat.envMapIntensity = spec.envMapIntensity
      if (mat instanceof THREE.MeshPhysicalMaterial) {
        if (spec.transmission != null) mat.transmission = spec.transmission
        if (spec.ior != null) mat.ior = spec.ior
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
    if (obj.material instanceof THREE.MeshPhysicalMaterial && obj.material.transmission > 0) {
      obj.castShadow = false
      obj.material.side = THREE.FrontSide
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

function aimAccentLight(light: THREE.DirectionalLight, yaw: number, pitch: number): void {
  const el = clampAccentPitch(pitch)
  const cy = Math.cos(el)
  light.position.set(
    Math.sin(yaw) * cy * ACCENT_RADIUS,
    ACCENT_TARGET_Y + Math.sin(el) * ACCENT_RADIUS,
    Math.cos(yaw) * cy * ACCENT_RADIUS,
  )
}

export function createProductViewer(
  mount: HTMLElement,
  options: ViewerOptions,
): { api: ViewerApi; dispose: () => void } {
  const { reducedMotion, mobile, onLoad, onReady, onInteract, onHotspots, onUnavailable, onMaterials, onHotspotPlaced, initialLook } = options
  const HERO_BIAS_X = mobile ? 0 : 0.16

  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !mobile,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: true,
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

  applyKeyLights(key, hemi, 'studio')
  placeAccentLights(fill, rim, 'studio')
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

  const hotspotAnchors = new Map<string, THREE.Object3D>()
  const screen = new THREE.Vector3()
  const boxSize = new THREE.Vector3(1, 1, 1)
  const boxCenter = new THREE.Vector3()
  let radius = 0.6
  let heroBias = true
  let active = true
  let disposed = false
  let interacting = false
  let autoRotateWanted = !reducedMotion
  let resumeRotateAt = 0
  let parts: PartRest[] = []
  let tween: CamTween | null = null
  let mixer: THREE.AnimationMixer | null = null
  let motionAction: THREE.AnimationAction | null = null
  let motionWanted = !reducedMotion
  let lightingPreset: LightingPresetId = 'studio'
  let currentLook: SavedLook = initialLook ?? defaultLook()
  let placeMode = false
  let placeHotspotId: string | null = null
  const sourceCache = new Map<string, PbrMapSet>()
  let floorPbrMaps: PbrMapSet | null = null
  let watchPbrMaps: PbrMapSet | null = null
  let watchPbrReady = false
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

  const applySize = () => {
    const w = mount.clientWidth || 1
    const h = mount.clientHeight || 1
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap))
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(h, 1)
    camera.updateProjectionMatrix()
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
    const cam = parseCameraLook(currentLook.camera)
    if (cam) applySavedCamera(cam, instant)
    else applyPose('hero', instant)
  }

  const captureLiveCamera = (): CameraLook =>
    roundCameraLook({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      fov: camera.fov,
    })

  const projectHotspots = () => {
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
    onHotspots(points)
  }

  const markerWorld = new THREE.Vector3()
  const setMarkerFromFraction = (
    marker: THREE.Object3D,
    position: [number, number, number],
  ) => {
    markerWorld.set(
      boxCenter.x + position[0] * (boxSize.x * 0.5),
      boxCenter.y + position[1] * (boxSize.y * 0.5),
      boxCenter.z + position[2] * (boxSize.z * 0.5),
    )
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
    sizeGround()
  }

  const sizeGround = () => {
    const ground = Math.max(boxSize.x, boxSize.z, 0.4)
    const standOn = currentLook.stand.enabled && currentLook.stand.setId !== 'none'
    contact.mesh.scale.setScalar(ground * (standOn ? 0.7 : 0.95))
    contact.mesh.visible = currentLook.shadows.contact
    floor.scale.setScalar(standOn ? Math.max(1.35, ground * 2.35) : Math.max(0.55, ground * 0.72))
    const span = Math.max(4.5, ground * 3.2)
    key.shadow.camera.left = -span
    key.shadow.camera.right = span
    key.shadow.camera.top = span
    key.shadow.camera.bottom = -span * 0.7
    key.shadow.camera.updateProjectionMatrix()
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
    fill.intensity = on ? spec.fill : 0
    rim.intensity = on ? spec.rim : 0
    const accentOn = accentSpec?.enabled !== false
    accent.intensity = accentOn ? (accentSpec?.intensity ?? 0) : 0
    if (accentSpec) aimAccentLight(accent, accentSpec.yaw, accentSpec.pitch)
  }

  const lightingLook = (preset: LightingPresetId) => {
    lightingPreset = preset
    applyKeyLights(key, hemi, preset)
    placeAccentLights(fill, rim, preset)
    applyAccentLights()
    applySun()
    const hdr = studioEnv.background instanceof THREE.Texture
    scene.environmentIntensity = preset === 'detail' ? (hdr ? 1.45 : 1.15) : hdr ? 1.28 : 0.95
    renderer.toneMappingExposure = preset === 'detail' ? (hdr ? 1.28 : 1.28) : hdr ? 1.18 : 1.05
  }

  const hdrApplyOpts = () => ({
    environmentIntensity: lightingPreset === 'detail' ? 1.45 : 1.28,
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

  const applyMotion = (value: boolean) => {
    motionWanted = value
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
  }
  applySun()

  const applyShadows = () => {
    const { enabled, contact: contactBlob, intensity, softness } = currentLook.shadows
    renderer.shadowMap.enabled = enabled
    key.castShadow = enabled
    floor.receiveShadow = enabled
    modelRoot.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      if (obj.material instanceof THREE.MeshPhysicalMaterial && obj.material.transmission > 0) {
        obj.castShadow = false
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
      key.shadow.radius = 2 + t * 36
      key.shadow.blurSamples = Math.round(8 + t * 8)
    }
    key.shadow.intensity = intensity
    key.shadow.bias = -0.0001
    key.shadow.normalBias = 0.02
    key.shadow.needsUpdate = true
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
      floorMat.displacementMap = spec.displacementScale > 0 ? floorPbrMaps.displacement : null
      floorMat.metalness = currentLook.shadows.enabled ? 0.78 : 1
      floorMat.roughness = 1
      floorMat.displacementScale = spec.displacementScale
      floorMat.displacementBias = -spec.displacementScale * 0.35
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
        const img = nrm.image as { width?: number; height?: number } | undefined
        if (img && img.width && img.height) {
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
      rest.mat.color.set(spec.color)
      rest.mat.metalness = spec.metalness
      rest.mat.roughness = spec.roughness
      rest.mat.roughnessMap = null
      rest.mat.metalnessMap = null
      rest.mat.envMapIntensity = spec.envMapIntensity
      if (rest.mat instanceof THREE.MeshPhysicalMaterial) {
        if (spec.transmission != null) rest.mat.transmission = spec.transmission
        if (spec.ior != null) rest.mat.ior = spec.ior
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

  const textureUrlsFor = (spec: TextureTargetLook, target: 'stand' | 'watch'): PbrMapUrls | Partial<PbrMapUrls> | null => {
    if (!spec.enabled || spec.setId === 'none') return null
    if (spec.setId === 'custom') return customMapCache[target] ?? null
    return textureSetUrls(spec.setId, target) ?? TEXTURE_SETS.find((set) => set.id === spec.setId)?.urls ?? PRODUCT.pbrMaps
  }

  const mapsForTarget = async (spec: TextureTargetLook, target: 'stand' | 'watch') => {
    const urls = textureUrlsFor(spec, target)
    if (!urls) return null
    const key = spec.setId === 'custom'
      ? `custom-${target}-${spec.customFiles?.color ?? ''}:${spec.customFiles?.normal ?? ''}`
      : `${target}:${spec.setId}:${'normal' in urls ? urls.normal ?? '' : ''}`
    let source = sourceCache.get(key)
    if (!source) {
      source = await loadPbrMapsPartial(urls, anisotropy)
      sourceCache.set(key, source)
    }
    return clonePbrMaps(source, spec.repeat, anisotropy)
  }

  const mapsKey = (spec: TextureTargetLook, target: 'stand' | 'watch') => {
    const urls = textureUrlsFor(spec, target)
    const normalUrl = urls && 'normal' in urls ? urls.normal ?? '' : ''
    return `${target}:${spec.enabled}:${spec.setId}:${spec.repeat}:${spec.customFiles?.color ?? ''}:${spec.customFiles?.normal ?? ''}:${normalUrl}`
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
      views: parseNamedViews(look.views),
    }
    applySun()
    void applyHdrId(currentLook.hdrId)
    applyShadows()
    applyAccentLights()
    const nextKey = `${mapsKey(look.stand, 'stand')}|${mapsKey(look.watch, 'watch')}`
    if (nextKey !== lastMapKey) {
      lastMapKey = nextKey
      try {
        if (look.stand.enabled && look.stand.setId !== 'none') {
          floorPbrMaps?.dispose()
          floorPbrMaps = await mapsForTarget(look.stand, 'stand')
        } else {
          floorPbrMaps?.dispose()
          floorPbrMaps = null
        }
        if (look.watch.enabled && look.watch.setId !== 'none') {
          watchPbrMaps?.dispose()
          watchPbrMaps = await mapsForTarget(look.watch, 'watch')
        } else {
          watchPbrMaps?.dispose()
          watchPbrMaps = null
        }
      } catch (err) {
        console.warn('[precision-object] look maps failed', err)
      }
    }
    if (disposed) return
    applyFloorPbr()
    applyWatchPbr()
    applyMaterials()
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

    if (motionClip) {
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
      hasMotion: Boolean(motionClip),
      motionClipName: motionClip?.name ?? null,
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
    projectHotspots()
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

  const tick = (now: number) => {
    if (disposed) return
    raf = requestAnimationFrame(tick)
    if (!visible || !active) {
      lastT = now
      return
    }
    const dt = Math.min(0.05, (now - lastT) / 1000)
    lastT = now

    if (mixer && motionWanted) mixer.update(dt)

    if (!interacting && autoRotateWanted && !reducedMotion && now > resumeRotateAt && !tween) {
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

    controls.update()
    renderer.render(scene, camera)
    projectHotspots()
  }

  const onVisibility = () => {
    visible = document.visibilityState !== 'hidden'
    if (visible) lastT = performance.now()
  }
  document.addEventListener('visibilitychange', onVisibility)

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const PLACE_UI = 'button, input, textarea, select, a, .pov-studio, .pov-controls, .pov-detail, .pov-mechanism'
  const onPlacePointer = (event: PointerEvent) => {
    if (!placeMode || !placeHotspotId || event.button !== 0) return
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
    const hx = boxSize.x > 1e-5 ? (hit.point.x - boxCenter.x) / (boxSize.x * 0.5) : 0
    const hy = boxSize.y > 1e-5 ? (hit.point.y - boxCenter.y) / (boxSize.y * 0.5) : 0
    const hz = boxSize.z > 1e-5 ? (hit.point.z - boxCenter.z) / (boxSize.z * 0.5) : 0
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

  raf = requestAnimationFrame(tick)

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
    setPbr: (value) => {
      currentLook = {
        ...currentLook,
        stand: { ...currentLook.stand, enabled: value },
        watch: { ...currentLook.watch, enabled: value },
      }
      void applyLook(currentLook)
    },
    setLook: (look) => {
      void applyLook(look)
    },
    captureCamera: () => captureLiveCamera(),
    setPlaceHotspots: (value) => {
      placeMode = value
      controls.enableRotate = !value
      controls.autoRotate = !value && autoRotateWanted && !interacting && !tween
      renderer.domElement.style.cursor = value ? 'crosshair' : ''
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
      if (value) lastT = performance.now()
    },
    resetCamera: () => {
      const hero = parseCameraLook(currentLook.views?.hero)
      const front = parseCameraLook(currentLook.views?.front)
      if (hero) applySavedCamera(hero, reducedMotion)
      else if (front) applySavedCamera(front, reducedMotion)
      else applyPose('front', reducedMotion)
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
    cancelAnimationFrame(raf)
    ro.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    mount.removeEventListener('pointerdown', onPlacePointer, true)
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
    setPbr: noop,
    setLook: noop,
    captureCamera: () => null,
    setPlaceHotspots: noop,
    setPlaceHotspotId: noop,
    setExploded: noop,
    setHeroBias: noop,
    setActive: noop,
    resetCamera: noop,
    goToPreset: noop,
    focusHotspot: noop,
    enterFullscreen: async () => undefined,
    exitFullscreen: async () => undefined,
  }
}
