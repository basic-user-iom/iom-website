import {
  Box3,
  Mesh,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Vector3,
} from 'three'
import { ModelManager } from './scene/ModelManager'
import { computeSceneBounds, nearFarFromBounds, type SceneBounds } from './scene/SceneBounds'
import { analyzeScene, type StaticSceneStats } from './scene/SceneAnalyzer'
import type {
  AnimationTransportState,
  LoadProgress,
  LoadedModelLayer,
  ModelManifest,
  ModelManifestEntry,
  ModelVariantKey,
} from './scene/types'
import { LightingSystem } from './lighting/LightingSystem'
import { OrbitMode } from './controls/OrbitMode'
import { WalkMode } from './controls/WalkMode'
import { PegmanPlacement, placeCharacterFromPegman } from './controls/PegmanPlacement'
import { CharacterVisual } from './controls/CharacterVisual'
import { CollisionWorld } from './collision/CollisionWorld'
import { CharacterController } from './collision/CharacterController'
import { DEFAULT_CHARACTER_PARAMS } from './collision/types'
import { QualityManager, detectBootQualityProfile, type QualityProfileId } from './performance/QualityManager'
import { PerformanceMonitor, type LiveRenderStats } from './performance/PerformanceMonitor'
import { XRManager, XRLocomotion } from './xr/XRManager'
import { prepareArchitecturalMeshes, applyMeshQuality } from './lighting/prepareArchitecturalMeshes'
import { applyLightmaps } from './lighting/applyLightmaps'
import { clipTrianglesInAabb } from './scene/clipCampusPatch'
import {
  cameraForGoldenPreview,
  goldenPreviewEntries,
  parseGoldenOverlayId,
  parseGoldenPreviewMode,
  type GoldenPreviewMode,
} from './scene/goldenSlicePreview'
import type { DaylightPresetId } from './lighting/DaylightPresets'
import { ModelAnimationPlayer } from './scene/ModelAnimationPlayer'
import {
  applyProceduralInstancing,
  collectAnimatedNodeNames,
  type InstancingReport,
} from './scene/ProceduralInstancing'
import { DetailLodController } from './performance/DetailLodController'
import { FloorZoneController } from './performance/FloorZoneController'
import { QuestTestHarness } from './performance/QuestTestHarness'
import { DEFAULT_FLOOR_BAND_HEIGHT, SPATIAL_CELL_XZ } from './performance/spatial'
import { fetchSpatialMeta, spatialConfigFromMeta, type SpatialMetaFile } from './performance/loadSpatialMeta'
import { buildCollisionChunks, type CollisionBuildReport, type CollisionChunkSource } from './collision/buildCollisionChunks'
import { disposeObject3D } from './utils/disposeScene'
import { InspectPicker, type InspectPickInfo } from './controls/InspectPicker'
import {
  CameraViewsManager,
  buildDefaultCameraViews,
  fetchShippedCameraViews,
  downloadCameraViewsJson,
  type CameraViewListItem,
} from './controls/CameraViews'

export type ViewerMode = 'orbit' | 'walk'

export type ViewerEngineOptions = {
  canvas: HTMLCanvasElement
  manifestUrl?: string
  characterUrl?: string
  debug?: boolean
}

export type ViewerEngineEvents = {
  onLoading?: (p: LoadProgress) => void
  onStats?: (stats: StaticSceneStats | null) => void
  onLiveStats?: (stats: LiveRenderStats) => void
  onMode?: (mode: ViewerMode) => void
  onWalkLock?: (locked: boolean) => void
  onError?: (message: string) => void
  onModels?: (models: ModelManifestEntry[], visibleIds: string[]) => void
  onAnimation?: (state: AnimationTransportState) => void
  onXrSupport?: (supported: boolean) => void
  onDaylight?: (id: DaylightPresetId) => void
  onQuality?: (id: QualityProfileId) => void
  onCameraViews?: (views: CameraViewListItem[], activeId: string | null) => void
  onInspect?: (info: InspectPickInfo | null) => void
}

const OUTDOOR_PROP_RE =
  /fahne|flag|hedge|hecke|banner|grass|rasen|zaun|fence|tree|baum|bush|strauch|pflanz/i

const GROUND_RE =
  /kopfstein|steinboden|pflaster|betonboden|plaza|pavement|asphalt|strasse|straß|fu[sß]?weg|fuweg|terrain|ground|bodenplatte|aussenanlage|parkplatz/i

const SHUTTER_RE = /lamelle|jalousie|raffstore|louver|shutter|rollladen/i

const _dupBox = new Box3()
const _dupSize = new Vector3()

function meshLabel(mesh: Mesh): string {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const matNames = mats.map((m) => m?.name || '').join(' ')
  return `${mesh.name || ''} ${matNames}`
}

const INTERIOR_FLOOR_RE =
  /foyer|garderobe|saal|halle|innen|interior|flur|diele|gang|cloak|^fb_/i

/** Plaza / terrain copies only — never roofs, walls, glass, or interior floors. */
function isLowGroundDuplicate(mesh: Mesh, bounds: SceneBounds): boolean {
  const label = `${mesh.name || ''} ${mesh.parent?.name || ''}`
  if (INTERIOR_FLOOR_RE.test(label)) return false
  _dupBox.setFromObject(mesh)
  if (_dupBox.isEmpty()) return false
  _dupBox.getSize(_dupSize)
  if (_dupSize.y >= 2.6) return false
  if (_dupBox.max.y > bounds.box.min.y + 8) return false
  const footprint = _dupSize.x * _dupSize.z
  return footprint >= Math.max(40, bounds.size.x * bounds.size.z * 0.008)
}

function isOrbitDuplicateMesh(mesh: Mesh, bounds: SceneBounds | null): boolean {
  if (mesh.userData?.architecturalGlass || mesh.userData?.cadOverlay) return false
  const parentName = mesh.parent?.name || ''
  if (INTERIOR_FLOOR_RE.test(mesh.name || '') || INTERIOR_FLOOR_RE.test(parentName)) return false
  const label = meshLabel(mesh)
  if (OUTDOOR_PROP_RE.test(label)) return true
  if (GROUND_RE.test(label)) return true
  // Interior blinds sit in the same plane as the exterior façade — hide the
  // animated copies in dual-layer orbit. Walk / single-layer restores them.
  if (mesh.userData?.shutter || SHUTTER_RE.test(label)) return true
  return Boolean(bounds && isLowGroundDuplicate(mesh, bounds))
}

export class ViewerEngine {
  readonly scene = new Scene()
  readonly camera: PerspectiveCamera
  readonly renderer: WebGLRenderer
  readonly models: ModelManager
  readonly lighting: LightingSystem
  readonly orbit: OrbitMode
  readonly collision = new CollisionWorld()
  readonly controller = new CharacterController()
  readonly character = new CharacterVisual()
  readonly quality: QualityManager
  readonly perf = new PerformanceMonitor()
  readonly xr: XRManager
  readonly modelAnim = new ModelAnimationPlayer()
  readonly detailLod = new DetailLodController()
  readonly floorZones = new FloorZoneController()
  readonly questTest = new QuestTestHarness()
  readonly cameraViews = new CameraViewsManager()
  readonly inspect: InspectPicker

  private walk: WalkMode
  private pegman: PegmanPlacement
  private mode: ViewerMode = 'orbit'
  private bounds: SceneBounds | null = null
  private staticStats: StaticSceneStats | null = null
  private manifest: ModelManifest | null = null
  private events: ViewerEngineEvents = {}
  private disposed = false
  private lastUiStats = 0
  private shadowFramesLeft = 0
  private lastAnimUi = 0
  private shadowFocusScratch = new Vector3()
  private instancingReport: InstancingReport | null = null
  private spatialMeta: SpatialMetaFile | null = null
  private lastStreamSyncMs = 0
  private streamSyncBusy = false
  private streamSceneRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private perfRouteBusy = false
  private pegmanDragging = false
  private pageVisible = true
  private autoQualityBusy = false
  private orbitOverview = false
  private orbitDedupeOn = false
  private orbitDupTagged = false
  private orbitDuplicateMeshes: Mesh[] = []
  private orbitAlwaysHiddenMeshes: Mesh[] = []
  private goldenPreviewMode: GoldenPreviewMode | null = null
  private xrLocomotion: XRLocomotion | null = null
  private readonly xrWish = new Vector3()
  private readonly xrForward = new Vector3()
  private readonly xrRight = new Vector3()
  readonly debug: boolean
  private characterUrl: string
  private readonly clock = { last: performance.now() }

  constructor(options: ViewerEngineOptions) {
    this.debug = Boolean(options.debug)
    this.characterUrl =
      options.characterUrl ?? '/demos/ssr-denoise/models/Xbot.glb'

    const bootProfileId = detectBootQualityProfile()
    this.quality = new QualityManager(bootProfileId)
    const initialQuality = this.quality.getProfile()

    this.camera = new PerspectiveCamera(55, 1, 0.1, 2000)
    this.camera.position.set(8, 6, 10)

    // MSAA + log-depth are context flags — pick once from boot profile (near/far is bounds-tight).
    this.renderer = new WebGLRenderer({
      canvas: options.canvas,
      antialias: initialQuality.antialias,
      powerPreference: 'high-performance',
      alpha: false,
      logarithmicDepthBuffer: initialQuality.logarithmicDepth,
    })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, initialQuality.pixelRatioMax))
    this.renderer.setSize(options.canvas.clientWidth || 1, options.canvas.clientHeight || 1, false)
    this.renderer.info.autoReset = true
    this.perf.attachRenderer(this.renderer.getContext())

    this.models = new ModelManager(() => this.renderer)
    this.lighting = new LightingSystem(this.scene)
    this.lighting.configureRenderer(this.renderer)
    this.lighting.applyQuality(initialQuality)

    this.scene.add(this.models.root)
    this.scene.add(this.character.root)
    this.scene.add(this.collision.debugRoot)
    if (this.debug || new URLSearchParams(location.search).get('collisionDebug') === '1') {
      this.collision.setDebugVisible(true)
      this.controller.debugSteps = true
      console.info('[Viewer] Collision debug wireframes ON (?collisionDebug=1)')
    }

    this.orbit = new OrbitMode(this.camera, this.renderer.domElement)
    this.walk = new WalkMode(
      this.camera,
      this.renderer.domElement,
      this.controller,
      this.character,
      (locked) => this.events.onWalkLock?.(locked),
    )
    this.pegman = new PegmanPlacement(
      this.camera,
      this.renderer.domElement,
      () => this.controller.params,
      (result) => {
        void this.handlePegmanDrop(result)
      },
      (dragging) => {
        this.pegmanDragging = dragging
        this.orbit.setEnabled(!dragging && this.mode === 'orbit')
        this.collision.setPlacementMode(dragging)
      },
    )
    this.scene.add(this.pegman.preview)

    this.inspect = new InspectPicker(
      this.camera,
      this.renderer.domElement,
      this.scene,
      () => this.models.root,
      (info) => this.events.onInspect?.(info),
      () => this.pegmanDragging || this.xr.isActive(),
    )

    this.xr = new XRManager(this.renderer)
    this.xr.setSessionEndHandler(() => {
      this.xrLocomotion = null
      this.orbit.setEnabled(this.mode === 'orbit')
      // Restore locked full-scene shadows after VR — never leave local-region active on desktop.
      this.lighting.setXrShadowMode(false)
      this.shadowFramesLeft = 2
    })
    this.controller.setWorld(this.collision)

    this.resize()
    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', this.onVisibility)

    this.renderer.setAnimationLoop(this.tick)
    void this.bootstrap(options.manifestUrl ?? '/models/manifest.json')
  }

  setEvents(events: ViewerEngineEvents): void {
    this.events = events
  }

  getMode(): ViewerMode {
    return this.mode
  }

  getStaticStats(): StaticSceneStats | null {
    return this.staticStats
  }

  getBounds(): SceneBounds | null {
    return this.bounds
  }

  beginPegmanDrag(e: PointerEvent): void {
    if (this.mode !== 'orbit') this.exitWalk()
    this.orbit.setEnabled(false)
    this.pegman.beginDrag(e)
  }

  setPegmanStatusElement(el: HTMLElement | null): void {
    this.pegman.setStatusElement(el)
  }

  setInspectEnabled(on: boolean): void {
    if (on && this.mode === 'walk') this.exitWalk()
    this.inspect.setEnabled(on)
  }

  isInspectEnabled(): boolean {
    return this.inspect.isEnabled()
  }

  hideInspected(): void {
    this.inspect.hideSelected()
  }

  isolateInspected(): void {
    this.inspect.isolateSelected()
  }

  restoreInspected(): void {
    this.inspect.restoreHidden()
  }

  async setQuality(id: QualityProfileId): Promise<void> {
    const prevVariant = this.quality.getProfile().modelVariant
    const profile = this.quality.setPreferred(id)
    this.applyQuality(profile)
    this.events.onQuality?.(this.quality.getPreferred())

    // Performance uses the lighter quest GLB — reload layers when the variant flips.
    if (profile.modelVariant !== prevVariant && this.manifest) {
      const layerIds = this.models.listLayers().map((l) => l.id)
      const entries = layerIds
        .map((lid) => this.manifest!.models.find((m) => m.id === lid))
        .filter((m): m is ModelManifestEntry => Boolean(m))
      if (entries.length) {
        this.events.onLoading?.({
          stage: 'download',
          ratio: 0,
          message: `Switching to ${profile.modelVariant.toUpperCase()} models`,
        })
        await this.loadModelSet(entries)
      }
    }
  }

  async setDaylightPreset(id: DaylightPresetId): Promise<void> {
    await this.lighting.setPreset(id)
    this.shadowFramesLeft = 2
    this.events.onDaylight?.(id)
  }

  getDaylightPreset(): DaylightPresetId {
    return this.lighting.getPresetId()
  }

  private applyQuality(profile: ReturnType<QualityManager['getProfile']>): void {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, profile.pixelRatioMax))
    this.lighting.applyQuality(profile)
    applyMeshQuality(this.models.root, profile)
    this.detailLod.applyQuality(profile.id)
    this.character.setBlobShadow(profile.characterBlobShadow)
    this.lighting.requestShadowUpdate()
    this.shadowFramesLeft = 1
    this.applyXrFoveation(profile.xrFoveation)
    this.applyXrFramebufferScale(profile.xrFramebufferScale)
  }

  private applyXrFoveation(level: number | null): void {
    this.xr.setFoveation(level)
  }

  private applyXrFramebufferScale(scale: number | null): void {
    this.xr.setFramebufferScale(scale)
  }

  resetView(): void {
    if (!this.bounds) return
    if (this.mode === 'walk') this.exitWalk()
    const overview = this.cameraViews.get('builtin-overview')
    if (overview) {
      this.goToCameraView('builtin-overview')
      return
    }
    this.orbit.frameBounds(this.bounds, true)
    this.cameraViews.setActiveId(this.cameraViews.list()[0]?.id ?? null)
    this.emitCameraViews()
  }

  goToCameraView(id: string): void {
    const view = this.cameraViews.get(id)
    if (!view) {
      this.events.onError?.(`Camera view not found: ${id}`)
      return
    }
    if (this.mode === 'walk') this.exitWalk()
    this.orbit.setEnabled(true)
    this.orbit.goTo(view.cameraPosition, view.cameraTarget, {
      fov: view.fov,
      duration: view.transitionSeconds,
    })
    this.cameraViews.setActiveId(id)
    this.emitCameraViews()
  }

  /**
   * Fly every saved camera view while the Quest harness records, then download JSON.
   * Desktop baseline — not a Quest 72 Hz acceptance result.
   */
  async runPerfRoute(opts?: { dwellMs?: number; download?: boolean }): Promise<ReturnType<QuestTestHarness['stop']> | null> {
    if (this.perfRouteBusy) {
      console.warn('[QuestTest] route already running')
      return this.questTest.getLastReport()
    }
    const views = this.cameraViews.list()
    if (!views.length) {
      this.events.onError?.('No camera views to record')
      return null
    }
    this.perfRouteBusy = true
    const dwellMs = opts?.dwellMs ?? 2500
    const download = opts?.download !== false
    if (this.mode === 'walk') this.exitWalk()
    this.questTest.start('views-route')
    console.info(`[QuestTest] flying ${views.length} views · dwell ${dwellMs}ms`)
    try {
      for (const view of views) {
        this.goToCameraView(view.id)
        await this.waitWhile(() => this.orbit.isAnimating())
        await this.sleep(dwellMs)
      }
      await this.sleep(400)
      const report = this.questTest.stop()
      if (download) this.questTest.download(report)
      return report
    } finally {
      this.perfRouteBusy = false
    }
  }

  isPerfRouteRunning(): boolean {
    return this.perfRouteBusy
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async waitWhile(pred: () => boolean, timeoutMs = 8000): Promise<void> {
    const t0 = performance.now()
    while (pred()) {
      if (performance.now() - t0 > timeoutMs) return
      await this.sleep(40)
    }
  }

  captureCameraView(name?: string): void {
    if (this.mode === 'walk') this.exitWalk()
    // Ensure the current frame is in the canvas before thumbnail read.
    this.renderer.render(this.scene, this.camera)
    const thumbnailDataUrl = this.captureViewportThumbnail()
    this.cameraViews.capture({
      name,
      cameraPosition: this.camera.position.toArray() as [number, number, number],
      cameraTarget: this.orbit.controls.target.toArray() as [number, number, number],
      fov: this.camera.fov,
      thumbnailDataUrl: thumbnailDataUrl ?? undefined,
      transitionSeconds: 1,
    })
    this.emitCameraViews()
  }

  deleteCameraView(id: string): void {
    if (!this.cameraViews.remove(id)) {
      this.events.onError?.('Built-in views cannot be deleted')
      return
    }
    this.emitCameraViews()
  }

  /** Download camera views JSON (for shipping as `/models/camera-views.json`). */
  exportCameraViews(): void {
    const payload = this.cameraViews.toExport({ onlyUser: true })
    if (payload.views.length === 0) {
      this.events.onError?.('No camera views to export — capture one first')
      return
    }
    downloadCameraViewsJson(payload)
  }

  private async applyCameraViewDefaults(bounds: NonNullable<typeof this.bounds>): Promise<void> {
    const shipped = await fetchShippedCameraViews()
    if (shipped?.length) {
      this.cameraViews.setBuiltIns(shipped, { shipped: true })
    } else if (!this.cameraViews.hasShippedDefaults()) {
      this.cameraViews.setBuiltIns(buildDefaultCameraViews(bounds, this.camera.fov), { shipped: false })
    }
    const firstId = this.cameraViews.get('builtin-overview')?.id ?? this.cameraViews.list()[0]?.id ?? null
    if (!this.cameraViews.getActiveId()) {
      this.cameraViews.setActiveId(firstId)
    }
    this.emitCameraViews()
  }

  /**
   * Render a small JPEG for each view that lacks a thumbnail.
   * Runs under the loading overlay so the camera hops are not visible.
   */
  private bakeCameraViewThumbnails(): void {
    const missing = this.cameraViews.viewsMissingThumbnails()
    if (missing.length === 0) return

    const savedPos = this.camera.position.clone()
    const savedTarget = this.orbit.controls.target.clone()
    const savedFov = this.camera.fov
    const orbitWasEnabled = this.orbit.controls.enabled
    this.orbit.setEnabled(false)

    for (const view of missing) {
      this.camera.position.set(...view.cameraPosition)
      this.orbit.controls.target.set(...view.cameraTarget)
      this.camera.fov = view.fov
      this.camera.updateProjectionMatrix()
      this.camera.lookAt(this.orbit.controls.target)
      this.orbit.controls.update()
      this.renderer.render(this.scene, this.camera)
      const thumb = this.captureViewportThumbnail()
      if (thumb) this.cameraViews.setThumbnail(view.id, thumb)
    }

    this.camera.position.copy(savedPos)
    this.orbit.controls.target.copy(savedTarget)
    this.camera.fov = savedFov
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(this.orbit.controls.target)
    this.orbit.controls.update()
    this.orbit.setEnabled(orbitWasEnabled)
    this.emitCameraViews()
  }

  private captureViewportThumbnail(): string | null {
    try {
      const source = this.renderer.domElement
      const sw = source.width
      const sh = source.height
      if (sw < 2 || sh < 2) return null
      const maxW = 160
      const scale = Math.min(1, maxW / sw)
      const dw = Math.max(1, Math.round(sw * scale))
      const dh = Math.max(1, Math.round(sh * scale))
      const off = document.createElement('canvas')
      off.width = dw
      off.height = dh
      const ctx = off.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(source, 0, 0, dw, dh)
      return off.toDataURL('image/jpeg', 0.72)
    } catch (err) {
      console.warn('[Viewer] View thumbnail capture failed', err)
      return null
    }
  }

  private emitCameraViews(): void {
    this.events.onCameraViews?.(this.cameraViews.listForUi(), this.cameraViews.getActiveId())
  }

  async enterVr(): Promise<void> {
    // Quest path: force Quest quality so BasicShadowMap + cheaper settings engage.
    await this.setQuality('QUEST')
    const ok = await this.xr.enterVR()
    if (!ok) {
      this.events.onError?.('WebXR immersive-vr is not available on this device.')
      return
    }
    this.applyXrFoveation(this.quality.getProfile().xrFoveation)
    this.applyXrFramebufferScale(this.quality.getProfile().xrFramebufferScale)
    const feet =
      this.mode === 'walk'
        ? this.controller.position.clone()
        : new Vector3(
            this.camera.position.x,
            this.bounds?.box.min.y ?? this.controller.position.y,
            this.camera.position.z,
          )
    let yaw = this.controller.yaw
    if (this.mode !== 'walk') {
      this.xrForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion)
      yaw = Math.atan2(-this.xrForward.x, -this.xrForward.z)
    }
    this.controller.setFeetPosition(feet, yaw)
    this.orbit.setEnabled(false)
    this.xr.mountRig(this.scene, this.camera, feet, yaw)

    this.xrLocomotion = new XRLocomotion(this.xr.rig, (fwd, strafe, dt) => {
      const yawNow = this.xr.rig.root.rotation.y
      this.xrForward.set(-Math.sin(yawNow), 0, -Math.cos(yawNow))
      this.xrRight.set(Math.cos(yawNow), 0, -Math.sin(yawNow))
      this.xrWish.set(0, 0, 0)
      this.xrWish.addScaledVector(this.xrForward, fwd)
      this.xrWish.addScaledVector(this.xrRight, strafe)
      const mag = Math.hypot(this.xrWish.x, this.xrWish.z)
      const speed = this.controller.params.walkSpeed
      if (mag > 1e-6) this.xrWish.multiplyScalar(1 / mag)
      this.controller.yaw = yawNow
      this.controller.update(dt, this.xrWish, mag > 1e-6 ? speed : 0)
      this.xr.rig.root.position.copy(this.controller.position)
    })

    this.lighting.setXrShadowMode(true, feet)
    this.shadowFramesLeft = 2
  }

  exitWalk(): void {
    if (this.mode !== 'walk') return
    this.walk.deactivate()
    this.orbit.setEnabled(true)
    this.orbit.restoreState()
    this.mode = 'orbit'
    this.events.onMode?.('orbit')
    this.events.onWalkLock?.(false)
  }

  private async handlePegmanDrop(result: import('./controls/PegmanPlacement').PegmanDropResult): Promise<void> {
    this.orbit.setEnabled(this.mode === 'orbit')
    if (!result.ok) {
      this.orbit.setEnabled(true)
      this.events.onError?.(result.reason ?? 'Cannot place character here')
      return
    }
    if (!placeCharacterFromPegman(this.controller, result)) {
      this.orbit.setEnabled(true)
      return
    }
    this.collision.setFocus(this.controller.position)
    this.orbit.saveState()
    this.orbit.setEnabled(false)
    this.walk.activate(true)
    this.mode = 'walk'
    if (this.inspect.isEnabled()) this.inspect.setEnabled(false)
    this.events.onMode?.('walk')
  }

  async selectModel(id: string): Promise<void> {
    // Toggle visibility of a layer; load it if missing.
    const entry = this.manifest?.models.find((m) => m.id === id)
    if (!entry) {
      this.events.onError?.(`Model not found: ${id}`)
      return
    }
    const existing = this.models.getLayer(id)
    if (existing) {
      this.setLayerVisible(id, !existing.visible)
      return
    }
    await this.addModelLayer(entry)
  }

  /** Load layer if needed, then set visibility (for checkbox UI). */
  async ensureLayer(id: string, visible: boolean): Promise<void> {
    const entry = this.manifest?.models.find((m) => m.id === id)
    if (!entry) {
      this.events.onError?.(`Model not found: ${id}`)
      return
    }
    const existing = this.models.getLayer(id)
    if (!existing) {
      if (!visible) return
      await this.addModelLayer(entry)
      return
    }
    this.setLayerVisible(id, visible)
  }

  setLayerVisible(id: string, visible: boolean): void {
    if (!this.models.setVisible(id, visible)) return
    for (const patch of this.patchesFor(id)) {
      this.models.setVisible(patch.id, visible)
    }
    this.refreshSceneAfterLayerChange()
    this.emitModels()
  }

  playAnimation(): void {
    this.modelAnim.play()
    this.emitAnimation()
  }

  pauseAnimation(): void {
    this.modelAnim.pause()
    this.emitAnimation()
  }

  stopAnimation(): void {
    this.modelAnim.stop()
    this.emitAnimation()
  }

  /** Scrub animation to an absolute time in seconds. */
  seekAnimation(timeSeconds: number): void {
    this.modelAnim.seek(timeSeconds)
    this.emitAnimation()
  }

  seekAnimationNormalized(u: number): void {
    this.modelAnim.seekNormalized(u)
    this.emitAnimation()
  }

  getAnimationState(): AnimationTransportState {
    return this.modelAnim.getState()
  }

  async loadLocalGlb(file: File): Promise<void> {
    try {
      this.leaveWalkForReload()
      this.modelAnim.dispose()
      this.collision.clearAllLayers()
      this.events.onLoading?.({ stage: 'download', ratio: 0, message: `Loading ${file.name}` })
      const layer = await this.models.loadLocalFile(file, (p) => this.events.onLoading?.(p))
      await this.afterLayersLoaded([layer])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.events.onError?.(`Failed to load GLB: ${msg}`)
      this.events.onLoading?.({ stage: 'error', ratio: null, message: msg })
    }
  }

  private async bootstrap(manifestUrl: string): Promise<void> {
    try {
      const xr = await this.xr.checkSupport()
      this.events.onXrSupport?.(xr)

      await this.lighting.setPreset('daylight')
      this.events.onDaylight?.('daylight')
      this.events.onQuality?.(this.quality.getPreferred())
      this.shadowFramesLeft = 2

      void this.character.load(this.characterUrl).then(() => {
        this.character.setBlobShadow(this.quality.getProfile().characterBlobShadow)
      }).catch((err) => {
        console.warn('[Viewer] Character load failed', err)
      })

      const res = await fetch(manifestUrl)
      if (!res.ok) throw new Error(`Manifest HTTP ${res.status}`)
      this.manifest = (await res.json()) as ModelManifest
      const models = this.manifest.models ?? []
      this.emitModels()

      this.goldenPreviewMode = parseGoldenPreviewMode()
      const overlayId = parseGoldenOverlayId()

      let entries: ModelManifestEntry[]
      if (this.goldenPreviewMode) {
        entries = goldenPreviewEntries(this.goldenPreviewMode, models)
        if (entries.length === 0) {
          throw new Error(`Golden preview "${this.goldenPreviewMode}" — slice not in manifest`)
        }
      } else {
        const initialIds =
          this.manifest.initialModelIds?.length
            ? this.manifest.initialModelIds
            : this.manifest.defaultModelId
              ? [this.manifest.defaultModelId]
              : models[0]
                ? [models[0].id]
                : []

        entries = initialIds
          .map((id) => models.find((m) => m.id === id))
          .filter((m): m is ModelManifestEntry => Boolean(m))

        if (overlayId) {
          const overlay = models.find((m) => m.id === overlayId)
          if (overlay && !entries.some((e) => e.id === overlayId)) {
            entries.push(overlay)
            console.info(`[Golden] overlay ${overlayId} (no CAD clip)`)
          }
        }
      }

      if (entries.length) await this.loadModelSet(entries)
      else {
        this.events.onLoading?.({
          stage: 'ready',
          ratio: 1,
          message: 'Drop a GLB or import a model via npm run model:import',
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.events.onError?.(msg)
      this.events.onLoading?.({
        stage: 'ready',
        ratio: 1,
        message: 'No models yet — drag a GLB onto the viewer',
      })
    }
  }

  private patchesFor(hostId: string): ModelManifestEntry[] {
    return (this.manifest?.models ?? []).filter(
      (m) => m.replaces === hostId && Boolean(m.replaceAabb),
    )
  }

  private expandWithPatches(entries: ModelManifestEntry[]): ModelManifestEntry[] {
    const seen = new Set(entries.map((e) => e.id))
    const out = [...entries]
    for (const entry of entries) {
      for (const patch of this.patchesFor(entry.id)) {
        if (seen.has(patch.id)) continue
        seen.add(patch.id)
        out.push(patch)
      }
    }
    return out
  }

  private clipHostPatches(layers: LoadedModelLayer[]): void {
    for (const layer of layers) {
      if (layer.root.userData.goldenPatchesApplied) continue
      const patches = this.patchesFor(layer.id).filter(
        (patch) => patch.replaceAabb && this.models.getLayer(patch.id),
      )
      if (patches.length === 0) continue
      for (const patch of patches) {
        const stats = clipTrianglesInAabb(layer.root, patch.replaceAabb!)
        if (stats.dropped > 0) {
          console.info(
            `[Golden] clipped ${stats.dropped} tris in ${stats.meshes} meshes from ${layer.id} for ${patch.id}`,
          )
        }
      }
      layer.root.userData.goldenPatchesApplied = true
    }
    this.hidePatchRoofs(layers)
  }

  /** Golden remodel roofs use a different UV than CAD wellblech — keep CAD. */
  private hidePatchRoofs(layers: LoadedModelLayer[]): void {
    for (const layer of layers) {
      if (!layer.entry.replaces) continue
      layer.root.traverse((obj) => {
        const mesh = obj as Mesh
        if (!mesh.isMesh) return
        if (!/^IOM_(Roof|Grass|Ceiling)/i.test(mesh.name || '')) return
        mesh.visible = false
        mesh.userData.inspectHidden = true
      })
    }
  }

  private async loadModelSet(entries: ModelManifestEntry[]): Promise<void> {
    try {
      const toLoad = this.expandWithPatches(entries)
      this.leaveWalkForReload()
      this.modelAnim.dispose()
      this.collision.clearAllLayers()
      this.events.onLoading?.({
        stage: 'download',
        ratio: 0,
        message: `Loading ${toLoad.length} model${toLoad.length > 1 ? 's' : ''}`,
      })

      const variant: ModelVariantKey = this.quality.getProfile().modelVariant
      const primary = toLoad[0]!
      this.controller.setParams({
        ...DEFAULT_CHARACTER_PARAMS,
        playerHeight: primary.playerHeight ?? DEFAULT_CHARACTER_PARAMS.playerHeight,
        playerRadius: primary.playerRadius ?? DEFAULT_CHARACTER_PARAMS.playerRadius,
        eyeHeight: primary.eyeHeight ?? DEFAULT_CHARACTER_PARAMS.eyeHeight,
      })

      const layers = await this.models.loadLayers(
        toLoad,
        variant,
        (p) => this.events.onLoading?.(p),
        this.currentStreamFocus(),
      )
      await this.afterLayersLoaded(layers)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.events.onError?.(`Failed to load models: ${msg}`)
      this.events.onLoading?.({ stage: 'error', ratio: null, message: msg })
    }
  }

  private async addModelLayer(entry: ModelManifestEntry): Promise<void> {
    try {
      const missing = this.expandWithPatches([entry]).filter((e) => !this.models.getLayer(e.id))
      if (missing.length === 0) return
      this.events.onLoading?.({ stage: 'download', ratio: 0, message: `Loading ${entry.name}` })
      const variant: ModelVariantKey = this.quality.getProfile().modelVariant
      let focusNew: LoadedModelLayer | undefined
      for (const next of missing) {
        const layer = await this.models.addLayer(
          next,
          variant,
          (p) => this.events.onLoading?.(p),
          this.currentStreamFocus(),
        )
        if (next.id === entry.id) focusNew = layer
      }
      await this.afterLayersLoaded(this.models.listLayers(), {
        focusNew: focusNew ?? this.models.getLayer(entry.id) ?? undefined,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.events.onError?.(`Failed to load ${entry.name}: ${msg}`)
      this.events.onLoading?.({ stage: 'error', ratio: null, message: msg })
    }
  }

  private applyCameraNearFar(bounds: SceneBounds, overview = this.orbitOverview): void {
    const { near: walkNear, far: boundsFar } = nearFarFromBounds(bounds)
    let near = walkNear
    let far = boundsFar
    if (this.mode === 'orbit' && !this.xr.isActive()) {
      const dist = this.camera.position.distanceTo(this.orbit.controls.target)
      near = overview
        ? Math.max(1.25, Math.min(8, dist * 0.02))
        : Math.max(0.2, Math.min(3, dist * 0.016))
      // Wide far/near makes coplanar CAD (plazas, fascia, dual-layer walls) z-fight
      // and flash black at some zoom levels.
      far = Math.min(boundsFar, Math.max(dist * 14, near * 350, 160))
    }
    if (Math.abs(this.camera.near - near) > 0.04 || Math.abs(this.camera.far - far) > 1) {
      this.camera.near = near
      this.camera.far = far
      this.camera.updateProjectionMatrix()
    }
  }

  private async buildCollisionForLayers(
    targets: LoadedModelLayer[],
    allLayers: LoadedModelLayer[],
  ): Promise<void> {
    const focusSeed =
      this.mode === 'walk' || this.xr.isActive()
        ? this.controller.position
        : this.orbit.controls.target
    try {
      for (const layer of targets) {
        await this.ensureLayerCollision(layer, { silent: true })
      }
      await this.collision.rebuildFromLayers(
        allLayers.map((l) => l.id),
        focusSeed,
      )
      this.pegman.setWorld(this.collision, this.models.root)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[Collision] deferred build failed', err)
      this.events.onError?.(`Walk collision update failed: ${msg}`)
    }
  }

  private async ensureLayerCollision(
    layer: LoadedModelLayer,
    opts?: { silent?: boolean },
  ): Promise<void> {
    const MIN_DEDICATED_TRIANGLES = 1000
    const COARSE_DEDICATED_MAX = 500_000

    if (layer.entry.collision) {
      let disposableCollision: import('three').Object3D | null = null
      try {
        disposableCollision = await this.models.loadCollisionRoot(
          layer.entry,
          opts?.silent ? undefined : (p) => this.events.onLoading?.(p),
        )
        if (disposableCollision) {
          const dedicated = buildCollisionChunks(disposableCollision, {
            layerId: `${layer.id}:proxy`,
            verbose: true,
            ignoreVisibility: true,
            walkSurfacesOnly: true,
          })
          const tris = dedicated.chunks.reduce((s, c) => s + c.triangles, 0)
          const ok =
            dedicated.chunks.length > 0 &&
            tris >= MIN_DEDICATED_TRIANGLES &&
            dedicated.report.preferredColliders &&
            tris <= COARSE_DEDICATED_MAX
          if (ok) {
            this.installDedicatedCollision(layer.id, dedicated.chunks, dedicated.report)
            return
          }
          console.warn(
            `[Collision] ${layer.id}: dedicated failed validation ` +
              `(chunks=${dedicated.chunks.length}, tris=${Math.round(tris)}, preferred=${dedicated.report.preferredColliders}); using visual`,
          )
        }
      } catch (err) {
        console.warn(`[Collision] dedicated GLB failed for ${layer.id}, using visual`, err)
      } finally {
        if (disposableCollision) disposeObject3D(disposableCollision)
      }
    }

    // Visual geometry is a fallback only. Do not clone, retain, or rebuild it
    // when a valid dedicated collision file exists.
    const visualBuilt = buildCollisionChunks(layer.root, {
      layerId: layer.id,
      verbose: true,
      ignoreVisibility: true,
      includeProcedural: true,
    })
    console.info(
      `[Collision] ${layer.id}: visual-fallback · ${visualBuilt.chunks.length} chunks · ${Math.round(visualBuilt.report.triangles)} tris`,
    )
    if (visualBuilt.chunks.length === 0) {
      console.warn(`[Collision] no walk geometry for layer ${layer.id}`)
    }
    this.collision.setLayerChunks(layer.id, visualBuilt.chunks, visualBuilt.report)
  }

  private installDedicatedCollision(
    layerId: string,
    dedicated: CollisionChunkSource[],
    dedicatedReport: CollisionBuildReport,
  ): void {
    const report = {
      ...dedicatedReport,
      preferredColliders: true,
      chunks: dedicated.length,
      triangles: dedicated.reduce((s, c) => s + c.triangles, 0),
    }
    console.info(
      `[Collision] ${layerId}: dedicated-only · ` +
        `${dedicated.length} chunks · ${Math.round(report.triangles)} tris`,
    )
    this.collision.setLayerChunks(layerId, dedicated, report)
  }

  private leaveWalkForReload(): void {
    if (this.mode !== 'walk') return
    this.walk.deactivate()
    this.orbit.setEnabled(true)
    this.orbit.restoreState()
    this.mode = 'orbit'
    this.events.onMode?.('orbit')
    this.events.onWalkLock?.(false)
  }

  private async afterLayersLoaded(
    layers: LoadedModelLayer[],
    opts?: { focusNew?: LoadedModelLayer },
  ): Promise<void> {
    this.events.onLoading?.({ stage: 'collision', ratio: 0.97, message: 'Preparing collision' })

    const combinedRoot = this.models.root
    const bounds = computeSceneBounds(combinedRoot)
    this.bounds = bounds
    this.applyCameraNearFar(bounds)

    await this.resolveSpatialMeta(layers)
    this.wireStreamLoaders(layers)

    this.clipHostPatches(layers)

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]!
      if (layer.entry.compareVisual) {
        layer.root.userData.compareVisual = true
        layer.root.traverse((obj) => {
          obj.userData.compareVisual = true
        })
        continue
      }
      const layerAnimatedNames = collectAnimatedNodeNames(layer.result.animations ?? [])
      prepareArchitecturalMeshes(layer.root, bounds, {
        freezeStatic: true,
        animatedNodeNames: layerAnimatedNames.size ? layerAnimatedNames : undefined,
        // Separate coplanar glass when both exterior + animated are loaded.
        glassDepthBias: i,
        lightmapped: Boolean(layer.entry.lightmap),
      })
      if (layer.entry.lightmap) {
        await applyLightmaps(layer.root, layer.entry)
      }
    }

    // Extract walk geometry BEFORE visual packing (independent of LOD/instancing).
    const lazyLayer = opts?.focusNew
    const collisionTargets = layers.filter((layer) => {
      if (layer.entry.compareVisual) return false
      if (lazyLayer) return layer.id === lazyLayer.id
      return true
    })
    if (lazyLayer) {
      void this.buildCollisionForLayers(collisionTargets, layers)
    } else {
      for (const layer of collisionTargets) {
        await this.ensureLayerCollision(layer)
      }
    }

    // Procedural / instancing pass: collapse repeating + batch unique static parts.
    this.events.onLoading?.({ stage: 'scene', ratio: 0.98, message: 'Instancing / batching' })
    const animatedNames = new Set<string>()
    for (const layer of layers) {
      for (const clip of layer.result.animations ?? []) {
        for (const name of collectAnimatedNodeNames([clip])) animatedNames.add(name)
      }
    }
    const q = this.quality.getProfile()
    const floorBand = layers[0]?.entry.floorBandHeight
    this.instancingReport = applyProceduralInstancing(combinedRoot, {
      minInstances: q.minInstances,
      minBatchSize: q.minBatchSize,
      animatedNodeNames: animatedNames.size ? animatedNames : undefined,
      spatial: this.spatialInstancingOpts(bounds, floorBand),
    })
    if (this.instancingReport.groupsConverted > 0) {
      console.info('[Viewer]', this.instancingReport.note, this.instancingReport.topGroups)
    }

    applyMeshQuality(combinedRoot, this.quality.getProfile())
    this.tagOrbitDuplicates()
    this.detailLod.applyQuality(this.quality.getProfile().id)
    this.refreshSpatialSystems(combinedRoot, bounds, floorBand)
    this.applyStreamingFloorPolicy()

    // Keep collision for every loaded layer (visibility only affects rendering).
    // Hiding exterior must not strip plaza/entry colliders the interior still needs.
    const collisionLayerIds = layers.map((l) => l.id)
    const focusSeed =
      this.mode === 'walk' || this.xr.isActive()
        ? this.controller.position
        : this.orbit.controls.target
    let collisionInfo = { ms: 0 }
    if (!lazyLayer) {
      collisionInfo = await this.collision.rebuildFromLayers(collisionLayerIds, focusSeed)
      this.pegman.setWorld(this.collision, combinedRoot)
    }
    this.floorZones.update(focusSeed.y, focusSeed.x, focusSeed.z)
    this.detailLod.update(this.camera)

    this.events.onLoading?.({ stage: 'scene', ratio: 0.985, message: 'Preparing scene' })
    this.lighting.fitToBounds(bounds)
    this.lighting.requestShadowUpdate()
    this.shadowFramesLeft = 2

    // Bind animation from the first layer that has clips (typically ICM 2025 Animated).
    this.rebindModelAnimation()

    let fileBytes = 0
    let transferred = 0
    let downloadMs = 0
    let parseMs = 0
    let animCount = 0
    for (const layer of layers) {
      fileBytes += layer.result.fileSizeBytes ?? 0
      transferred += layer.result.transferredBytes ?? 0
      downloadMs += layer.result.downloadMs
      parseMs += layer.result.parseMs
      animCount += layer.result.animations.length
    }

    this.staticStats = analyzeScene(combinedRoot, bounds, {
      fileSizeBytes: fileBytes || null,
      transferredBytes: transferred || null,
      downloadMs,
      parseMs,
      collisionMs: collisionInfo.ms,
      animations: animCount,
      instancing: this.instancingReport,
    })
    this.events.onStats?.(this.staticStats)

    await this.applyCameraViewDefaults(bounds)

    const spawnEntry = layers.find((l) => l.entry.spawn)?.entry
    if (spawnEntry?.spawn) {
      this.controller.setFeetPosition(new Vector3(...spawnEntry.spawn))
    }

    this.events.onLoading?.({ stage: 'scene', ratio: 0.99, message: 'Compiling shaders' })
    try {
      // Large architectural scenes can stall compileAsync indefinitely — bound it.
      await Promise.race([
        this.renderer.compileAsync(this.scene, this.camera),
        new Promise<void>((resolve) => window.setTimeout(resolve, 8000)),
      ])
    } catch (err) {
      console.warn('[Viewer] compileAsync failed', err)
    }

    // Lazy-loaded layers should not yank the camera back to Overview.
    if (!opts?.focusNew) {
      this.events.onLoading?.({ stage: 'scene', ratio: 0.995, message: 'Capturing view thumbnails' })
      this.bakeCameraViewThumbnails()

      if (this.goldenPreviewMode) {
        const cam = cameraForGoldenPreview(this.goldenPreviewMode)
        this.orbit.goTo(cam.position, cam.target, { fov: cam.fov ?? 55, duration: 0.01 })
      } else {
        const overview = this.cameraViews.get('builtin-overview')
        if (overview) {
          this.orbit.goTo(overview.cameraPosition, overview.cameraTarget, {
            fov: overview.fov,
            duration: 0.01,
          })
          this.cameraViews.setActiveId(overview.id)
          this.emitCameraViews()
        } else {
          this.orbit.frameBounds(bounds, true)
        }
      }
    }

    this.lighting.requestShadowUpdate()
    this.shadowFramesLeft = 3

    this.events.onLoading?.({ stage: 'ready', ratio: 1, message: 'Ready' })
    this.emitModels()
  }

  private applySpatialScene(bounds: SceneBounds, floorBandHeight?: number): void {
    const band = floorBandHeight ?? this.spatialMeta?.bandHeight ?? DEFAULT_FLOOR_BAND_HEIGHT
    const fromMeta = this.spatialMeta ? spatialConfigFromMeta(this.spatialMeta) : null
    // Scene origin always from live loaded bounds (correct world space after load).
    this.floorZones.setBandHeight(band)
    this.floorZones.setSpatialConfig({
      sceneMinY: bounds.box.min.y,
      sceneMinX: bounds.box.min.x,
      sceneMinZ: bounds.box.min.z,
      bandHeight: band,
      cellSizeXz: fromMeta?.cellSizeXz ?? SPATIAL_CELL_XZ,
      neighborCells: fromMeta?.neighborCells ?? 1,
    })
  }

  private spatialInstancingOpts(bounds: SceneBounds, floorBandHeight?: number) {
    const fromMeta = this.spatialMeta ? spatialConfigFromMeta(this.spatialMeta) : null
    const band = floorBandHeight ?? fromMeta?.bandHeight ?? DEFAULT_FLOOR_BAND_HEIGHT
    return {
      sceneMinY: bounds.box.min.y,
      sceneMinX: bounds.box.min.x,
      sceneMinZ: bounds.box.min.z,
      bandHeight: band,
      cellSizeXz: fromMeta?.cellSizeXz ?? SPATIAL_CELL_XZ,
    }
  }

  private async resolveSpatialMeta(layers: LoadedModelLayer[]): Promise<void> {
    for (const layer of layers) {
      const url = layer.entry.spatialMeta
      if (!url) continue
      const meta = await fetchSpatialMeta(url)
      if (meta) {
        this.spatialMeta = meta
        console.info(`[Spatial] loaded meta from ${url}`)
        return
      }
    }
  }

  private applyStreamingFloorPolicy(): void {
    this.applyVisualCullingPolicy(this.orbit.controls.target)
  }

  /** Orbit overview / dual-layer — disable aggressive hide culling that pops on zoom. */
  private isOrbitOverview(focus: Vector3): boolean {
    if (this.mode !== 'orbit' || this.xr.isActive() || !this.bounds) return false
    const cam = this.camera.position
    const height = cam.y - focus.y
    const distCenter = cam.distanceTo(this.bounds.center)
    const distFocus = cam.distanceTo(focus)
    const farFocus = Math.max(35, this.bounds.radius * 0.45)
    const enter =
      height > 26 || distCenter > this.bounds.radius * 0.62 || distFocus > farFocus * 1.2
    const leave =
      height < 14 && distCenter < this.bounds.radius * 0.4 && distFocus < farFocus * 0.8
    if (this.orbitOverview) return !leave
    return enter
  }

  private applyVisualCullingPolicy(focus: Vector3): void {
    const visibleLayers = this.models.listLayers().filter((l) => l.visible)
    const dualLayer = visibleLayers.length > 1
    const streaming = this.models.hasStreamingLayers()
    const overview = this.isOrbitOverview(focus)

    // Floor bands + horizontal cells fight orbit zoom — off unless walking a single layer.
    const floorOn =
      !overview &&
      !streaming &&
      !dualLayer &&
      this.mode === 'walk' &&
      (this.bounds?.box.max.y ?? 0) - (this.bounds?.box.min.y ?? 0) >=
        DEFAULT_FLOOR_BAND_HEIGHT * 2.2
    this.floorZones.setEnabled(floorOn)
    // Horizontal cells cut a moving line across floors as you walk. Band-only
    // residency still hides other storeys.
    this.floorZones.setHorizontalCull(false)

    // Screen-size hide pops when zooming large shells — only full hide while walking.
    const hideDistant = !overview && this.mode === 'walk' && !dualLayer
    this.detailLod.setHideDistant(hideDistant)
    // Orbit hide/show of CAD caused flicker and made floors vanish at grazing angles.
    this.detailLod.setHideTiny(false)
    this.detailLod.setOverviewMassOnly(overview)
    if (this.orbitOverview !== overview) {
      this.orbitOverview = overview
      if (this.bounds) this.applyCameraNearFar(this.bounds, overview)
      this.lighting.requestShadowUpdate()
      this.shadowFramesLeft = 2
    } else {
      this.orbitOverview = overview
    }

    for (const layer of this.models.listLayers()) {
      layer.root.visible = layer.visible
    }

    for (const stream of this.models.listLayers()) {
      const loader = this.models.getStreamLoader(stream.id)
      loader?.setOverviewMode(overview)
    }
  }

  /**
   * Dual-layer orbit: hide only plaza/terrain copies and outdoor props on the
   * animated layer. Never hide roofs, walls, or glass — that punched holes in
   * the shell. Walk restores everything.
   */
  private applyOrbitDuplicateHide(): void {
    if (!this.orbitDupTagged) this.tagOrbitDuplicates()
    const layers = this.models.listLayers()
    const extOn = layers.some((l) => l.visible && l.id === 'icm-ext')
    const otherOn = layers.some((l) => l.visible && l.id !== 'icm-ext')
    const hide = this.mode === 'orbit' && extOn && otherOn
    for (const mesh of this.orbitAlwaysHiddenMeshes) {
      if (mesh.visible) mesh.visible = false
    }

    if (this.orbitDedupeOn === hide) {
      // Other culling systems can reveal a duplicate while dual-layer hiding
      // is active. Re-enforce only the cached matches, not the whole scene.
      if (hide) {
        for (const mesh of this.orbitDuplicateMeshes) {
          if (mesh.visible) mesh.visible = false
        }
      }
      return
    }

    this.orbitDedupeOn = hide
    this.lighting.requestShadowUpdate()
    this.shadowFramesLeft = 2
    for (const mesh of this.orbitDuplicateMeshes) {
      if (hide) {
        if (mesh.userData.orbitDupBase === undefined) {
          mesh.userData.orbitDupBase = mesh.visible
        }
        mesh.visible = false
      } else {
        const restore = Boolean(mesh.userData.orbitDupBase)
        mesh.visible = mesh.userData?.inspectHidden ? false : restore
        mesh.userData.orbitDupBase = undefined
      }
    }
  }

  private tagOrbitDuplicates(): void {
    const bounds = this.bounds
    const previousMatches = new Set(this.orbitDuplicateMeshes)
    const nextMatches: Mesh[] = []
    this.orbitDupTagged = true
    this.orbitAlwaysHiddenMeshes = []
    for (const layer of this.models.listLayers()) {
      if (layer.id === 'icm-ext' || layer.entry.compareVisual) continue
      layer.root.traverse((obj) => {
        if (!(obj as Mesh).isMesh) return
        const mesh = obj as Mesh
        if (mesh.userData?.collisionOnly) return
        if (mesh.userData?.cadOverlay) {
          this.orbitAlwaysHiddenMeshes.push(mesh)
          return
        }
        const match = isOrbitDuplicateMesh(mesh, bounds)
        mesh.userData.orbitDupKind = match
        mesh.userData.orbitDuplicate = undefined
        if (match) {
          previousMatches.delete(mesh)
          if (this.orbitDedupeOn && mesh.userData.orbitDupBase === undefined) {
            mesh.userData.orbitDupBase = mesh.visible
          }
          nextMatches.push(mesh)
        }
      })
    }

    // Bounds changes / repacking can change classification. Restore anything
    // that was hidden by the previous cache but no longer belongs to it.
    for (const mesh of previousMatches) {
      if (mesh.userData.orbitDupBase === undefined) continue
      const restore = Boolean(mesh.userData.orbitDupBase)
      mesh.visible = mesh.userData?.cadOverlay || mesh.userData?.inspectHidden ? false : restore
      mesh.userData.orbitDupBase = undefined
    }
    this.orbitDuplicateMeshes = nextMatches
  }

  private refreshSpatialSystems(combinedRoot: import('three').Object3D, bounds: SceneBounds, floorBandHeight?: number): void {
    this.applySpatialScene(bounds, floorBandHeight)
    this.detailLod.rebuild(combinedRoot, bounds.radius)
    this.floorZones.rebuild(
      combinedRoot,
      bounds.box.min.y,
      bounds.radius,
      bounds.box.max.y - bounds.box.min.y,
      bounds.box.min.x,
      bounds.box.min.z,
    )
  }

  private currentStreamFocus(): { x: number; y: number; z: number } {
    const p =
      this.mode === 'walk' || this.xr.isActive()
        ? this.controller.position
        : this.orbit.controls.target
    return { x: p.x, y: p.y, z: p.z }
  }

  private wireStreamLoaders(layers: LoadedModelLayer[]): void {
    for (const layer of layers) {
      const stream = this.models.getStreamLoader(layer.id)
      if (!stream) continue
      stream.setOnChange((ev) => {
        if (ev.loaded.length || ev.unloaded.length) {
          void this.models.refreshStreamingAnimations(ev.layerId).then(() => {
            this.rebindModelAnimation()
          })
          if (ev.loaded.length || ev.unloaded.length) this.scheduleStreamSceneRefresh()
        }
      })
    }
  }

  private scheduleStreamSceneRefresh(): void {
    if (this.streamSceneRefreshTimer) clearTimeout(this.streamSceneRefreshTimer)
    this.streamSceneRefreshTimer = setTimeout(() => {
      this.streamSceneRefreshTimer = null
      void this.refreshStreamScene()
    }, 320)
  }

  private async refreshStreamScene(): Promise<void> {
    const combinedRoot = this.models.root
    const bounds = computeSceneBounds(combinedRoot)
    if (bounds.box.isEmpty()) return
    this.bounds = bounds
    this.applyCameraNearFar(bounds)

    for (let i = 0; i < this.models.listLayers().length; i++) {
      const layer = this.models.listLayers()[i]!
      if (!layer.streaming) continue
      const layerAnimatedNames = collectAnimatedNodeNames(layer.result.animations ?? [])
      prepareArchitecturalMeshes(layer.root, bounds, {
        freezeStatic: true,
        animatedNodeNames: layerAnimatedNames.size ? layerAnimatedNames : undefined,
        glassDepthBias: i,
        lightmapped: Boolean(layer.entry.lightmap),
      })
      if (layer.entry.lightmap) {
        await applyLightmaps(layer.root, layer.entry)
      }
    }

    const animatedNames = new Set<string>()
    for (const layer of this.models.listLayers()) {
      for (const clip of layer.result.animations ?? []) {
        for (const name of collectAnimatedNodeNames([clip])) animatedNames.add(name)
      }
    }
    const q = this.quality.getProfile()
    const floorBand = this.models.listLayers()[0]?.entry.floorBandHeight
    this.instancingReport = applyProceduralInstancing(combinedRoot, {
      minInstances: q.minInstances,
      minBatchSize: q.minBatchSize,
      animatedNodeNames: animatedNames.size ? animatedNames : undefined,
      spatial: this.spatialInstancingOpts(bounds, floorBand),
    })
    applyMeshQuality(combinedRoot, q)
    this.tagOrbitDuplicates()
    this.refreshSpatialSystems(combinedRoot, bounds, floorBand)
    this.applyStreamingFloorPolicy()
    this.detailLod.update(this.camera)
    this.lighting.requestShadowUpdate()
    this.shadowFramesLeft = 2
    this.rebindModelAnimation()
  }

  /** Bind embedded GLB animation to the correct scene root (streaming shell or full layer). */
  private rebindModelAnimation(): void {
    const animLayer = this.models
      .listLayers()
      .find((l) => l.visible && (l.result.animations?.length ?? 0) > 0)
    if (!animLayer?.result.animations.length) {
      this.modelAnim.dispose()
      this.emitAnimation()
      return
    }

    void this.models.refreshStreamingAnimations(animLayer.id).then((clips) => {
      const active = clips.length ? clips : animLayer.result.animations
      if (!active.length) {
        this.modelAnim.dispose()
        this.emitAnimation()
        return
      }
      animLayer.result.animations = active
      const bindRoot = this.models.getAnimationBindRoot(animLayer.id) ?? animLayer.root
      const autoPlay = animLayer.entry.autoPlayAnimation === true
      this.modelAnim.bind(bindRoot, active, {
        autoPlay,
        loop: false,
        label: animLayer.entry.name,
      })
      this.emitAnimation()
    })
  }

  private async flushStreamingFocus(focus: import('three').Vector3): Promise<void> {
    if (this.streamSyncBusy || !this.models.hasStreamingLayers()) return
    const now = performance.now()
    if (now - this.lastStreamSyncMs < 400) return
    this.streamSyncBusy = true
    this.lastStreamSyncMs = now
    try {
      await this.models.updateStreamingFocus(focus)
    } finally {
      this.streamSyncBusy = false
    }
  }

  private refreshSceneAfterLayerChange(): void {
    const combinedRoot = this.models.root
    const bounds = computeSceneBounds(combinedRoot)
    this.bounds = bounds
    this.applyCameraNearFar(bounds)
    const floorBand = this.models.listLayers()[0]?.entry.floorBandHeight
    this.refreshSpatialSystems(combinedRoot, bounds, floorBand)
    void this.applyCameraViewDefaults(bounds).then(() => {
      if (this.cameraViews.viewsMissingThumbnails().length) {
        this.bakeCameraViewThumbnails()
      }
    })

    const allLayers = this.models.listLayers()
    const collisionLayerIds = allLayers.map((l) => l.id)
    const focusSeed =
      this.mode === 'walk' || this.xr.isActive()
        ? this.controller.position
        : this.orbit.controls.target

    // Re-bake any loaded layer that is missing / too thin (animated interior alone).
    void (async () => {
      for (const layer of allLayers) {
        if (layer.entry.compareVisual) continue
        const tris = this.collision.layerTriangleCount(layer.id)
        if (layer.entry.lightmap && !layer.entry.collision) {
          if (!this.collision.hasLayerChunks(layer.id)) {
            this.events.onLoading?.({
              stage: 'collision',
              ratio: 0.97,
              message: `Preparing collision · ${layer.entry.name}`,
            })
            await this.ensureLayerCollision(layer)
          }
          continue
        }
        if (!this.collision.hasLayerChunks(layer.id) || tris < 500) {
          this.events.onLoading?.({
            stage: 'collision',
            ratio: 0.97,
            message: `Preparing collision · ${layer.entry.name}`,
          })
          await this.ensureLayerCollision(layer)
        }
      }
      const info = await this.collision.rebuildFromLayers(collisionLayerIds, focusSeed)
      this.pegman.setWorld(this.collision, combinedRoot)
      this.floorZones.update(focusSeed.y, focusSeed.x, focusSeed.z)
      this.lighting.fitToBounds(bounds)
      this.lighting.requestShadowUpdate()
      this.shadowFramesLeft = 2
      this.staticStats = analyzeScene(combinedRoot, bounds, {
        fileSizeBytes: this.models.getCombinedFileBytes(),
        transferredBytes: null,
        downloadMs: 0,
        parseMs: 0,
        collisionMs: info.ms,
        animations: this.modelAnim.clipCount(),
        instancing: this.instancingReport,
      })
      this.events.onStats?.(this.staticStats)
      this.events.onLoading?.({ stage: 'ready', ratio: 1, message: 'Ready' })
    })()
  }

  private emitModels(): void {
    const visibleIds = this.models.listLayers().filter((l) => l.visible).map((l) => l.id)
    this.events.onModels?.(this.manifest?.models ?? [], visibleIds)
  }

  private emitAnimation(): void {
    this.events.onAnimation?.(this.modelAnim.getState())
  }

  private readonly onResize = (): void => this.resize()
  private readonly onVisibility = (): void => {
    this.pageVisible = document.visibilityState !== 'hidden'
    if (this.pageVisible) this.clock.last = performance.now()
  }

  resize(): void {
    const canvas = this.renderer.domElement
    const parent = canvas.parentElement
    const w = parent?.clientWidth || window.innerWidth
    const h = parent?.clientHeight || window.innerHeight
    this.camera.aspect = w / Math.max(h, 1)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  private readonly tick = (): void => {
    if (this.disposed) return
    const now = performance.now()
    const rawDt = (now - this.clock.last) / 1000
    const dt = Math.min(0.05, rawDt)
    this.clock.last = now

    // Tab hidden: skip GPU work (battery + thermal).
    if (!this.pageVisible && !this.xr.isActive()) {
      this.perf.endFrame(dt, now, rawDt)
      return
    }

    this.perf.beginFrame(now)
    this.collision.beginFrame()

    if (this.xr.isActive() && this.xrLocomotion) {
      this.xrLocomotion.update(dt, this.xr.readThumbsticks())
    } else if (this.mode === 'walk') {
      this.walk.update(dt)
    } else {
      this.orbit.update(dt)
      if (this.bounds) this.applyCameraNearFar(this.bounds)
    }
    this.perf.markSection('walk')

    // Nearby collision + floor residency follow the player (walk/XR) or orbit target.
    {
      const focus =
        this.mode === 'walk' || this.xr.isActive()
          ? this.controller.position
          : this.orbit.controls.target
      const overview = this.isOrbitOverview(focus)
      this.applyVisualCullingPolicy(focus)
      this.collision.setFocus(focus)
      if (this.floorZones.isEnabled()) {
        this.floorZones.update(focus.y, focus.x, focus.z, now)
      }
      void this.flushStreamingFocus(overview ? this.camera.position : focus)
    }

    this.modelAnim.update(dt)
    this.perf.markSection('anim')

    this.detailLod.update(this.camera, now)
    this.applyOrbitDuplicateHide()
    this.inspect.update()
    this.perf.markSection('lod')

    // Local-region shadows: only recenter in active WebXR — never while walking on desktop
    // (following the character makes building shadows crawl).
    if (this.lighting.shadows.getFitMode() === 'localRegion' && this.xr.isActive()) {
      this.shadowFocusScratch.copy(this.camera.position)
      this.shadowFocusScratch.y = this.bounds?.box.min.y ?? this.shadowFocusScratch.y
      if (this.lighting.updateShadowFocus(this.shadowFocusScratch)) {
        this.shadowFramesLeft = 2
      }
    }

    this.perf.beginGpu()
    this.renderer.render(this.scene, this.camera)
    this.perf.endGpu()

    if (this.shadowFramesLeft > 0) {
      this.shadowFramesLeft -= 1
      if (this.shadowFramesLeft === 0) this.lighting.shadows.markCached()
    }
    this.perf.markSection('render')

    this.perf.endFrame(dt, now, rawDt)

    if (now - this.lastAnimUi > 100) {
      this.lastAnimUi = now
      if (this.modelAnim.isAvailable()) this.emitAnimation()
    }

    if (now - this.lastUiStats > 250) {
      this.lastUiStats = now
      const info = this.renderer.info
      const profile = this.quality.getProfile()
      const aa = this.renderer.capabilities.isWebGL2
        ? (this.renderer.getContext() as WebGL2RenderingContext).getContextAttributes()?.antialias
        : this.renderer.getContext().getContextAttributes()?.antialias
      const live = this.perf.getSnapshot({
        width: this.renderer.domElement.width,
        height: this.renderer.domElement.height,
        pixelRatio: this.renderer.getPixelRatio(),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        points: info.render.points,
        lines: info.render.lines,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        qualityProfile: `${profile.id} · shadow ${this.lighting.shadows.isEnabled() ? `${this.lighting.shadows.getMapSize()} ${this.lighting.shadows.getFitMode()}` : 'off'}${aa ? ' · MSAA' : ''}`,
        detailLod: (() => {
          const lod = this.detailLod.getStats()
          const fz = this.floorZones.getStats()
          const lodPart = lod.enabled
            ? `${lod.visible}/${lod.tracked + lod.packed} vis (${lod.hidden} hide${lod.geometric ? `, ${lod.lowDetail} low` : ''}${lod.packed ? `, ${lod.packed} packed` : ''})`
            : 'off'
          const floorPart = fz.enabled
            ? ` · floor ${fz.activeBand ?? '-'} cell ${fz.activeCellX ?? '-'},${fz.activeCellZ ?? '-'} (${fz.hidden} off)`
            : ''
          const streamPart = this.models.getStreamingSummary()
          return lodPart + floorPart + (streamPart ? ` · stream ${streamPart}` : '')
        })(),
        collision: (() => {
          const c = this.collision.getFrameStats()
          return `${c.cpuMs.toFixed(2)}ms · ${c.activeChunks} active / ${c.residentChunks} resident chunks · ${c.capsuleQueries} cap · ${c.raycasts} ray · ${c.triangles.toLocaleString()} active / ${c.residentTriangles.toLocaleString()} resident tris`
        })(),
        renderer: this.renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL',
        xrActive: this.xr.isActive(),
        xrFrameRate: this.xr.getFrameRate(),
        xrFoveation: this.xr.isActive() ? this.xr.getFoveation() : null,
      })
      this.quality.noteFps(live.avgFps || live.fps)
      if (this.quality.getPreferred() === 'AUTO' && !this.autoQualityBusy) {
        const next = this.quality.getProfile()
        if (next.id !== profile.id) {
          this.autoQualityBusy = true
          const prevVariant = profile.modelVariant
          this.applyQuality(next)
          this.events.onQuality?.(this.quality.getPreferred())
          if (next.modelVariant !== prevVariant && this.manifest) {
            const layerIds = this.models.listLayers().map((l) => l.id)
            const entries = layerIds
              .map((lid) => this.manifest!.models.find((m) => m.id === lid))
              .filter((m): m is ModelManifestEntry => Boolean(m))
            if (entries.length) {
              void this.loadModelSet(entries)
                .catch(() => undefined)
                .finally(() => {
                  this.autoQualityBusy = false
                })
            } else {
              this.autoQualityBusy = false
            }
          } else {
            this.autoQualityBusy = false
          }
        }
      }
      this.events.onLiveStats?.(live)
      if (this.questTest.isActive()) {
        this.questTest.setContext({
          qualityProfile: live.qualityProfile,
          xrActive: live.xrActive,
        })
        const c = this.collision.getFrameStats()
        this.questTest.tick(live, c.triangles, now, {
          collisionResidentTris: c.residentTriangles,
          xrFrameRate: live.xrFrameRate,
        })
      }
    }
  }

  dispose(): void {
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    window.removeEventListener('resize', this.onResize)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.walk.dispose()
    this.orbit.dispose()
    this.pegman.dispose()
    this.inspect.dispose()
    this.character.dispose()
    this.collision.dispose()
    this.modelAnim.dispose()
    this.detailLod.dispose()
    this.floorZones.dispose()
    this.models.dispose()
    this.lighting.dispose()
    this.xr.dispose()
    this.renderer.dispose()
  }
}
