import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  PlaneGeometry,
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
import {
  QualityManager,
  detectBootQualityProfile,
  getQualityProfile,
  type QualityProfileId,
} from './performance/QualityManager'
import { PerformanceMonitor, type LiveRenderStats } from './performance/PerformanceMonitor'
import { RuntimeAntialias } from './performance/RuntimeAntialias'
import { XRManager, XRLocomotion } from './xr/XRManager'
import { prepareArchitecturalMeshes, applyMeshQuality } from './lighting/prepareArchitecturalMeshes'
import { dedupeSceneMaterials } from './scene/dedupeSceneMaterials'
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
import {
  allowsVisualCollisionFallback,
  validateDedicatedCollisionRoot,
} from './collision/dedicatedCollisionValidation'
import { disposeObject3D } from './utils/disposeScene'
import { InspectPicker, type InspectPickInfo } from './controls/InspectPicker'
import { isOrbitDuplicateMesh } from './scene/orbitDuplicatePolicy'
import {
  ICM_ANIMATED_AUDITORIUM_AISLE_SUPPLEMENTS,
  ICM_ANIMATED_STAIR_LANDING_SUPPLEMENTS,
  isIcmAnimatedWalkCollisionSupplement,
  isIcmBridgeCollisionSupplement,
} from './scene/assetSemantics'
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

type ModelLoadRequest = {
  generation: number
  controller: AbortController
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
  readonly runtimeAntialias: RuntimeAntialias
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
  private readonly streamFocusIntervalMs = 400
  private queuedStreamFocus: { x: number; y: number; z: number } | null = null
  private streamFocusDrain: Promise<void> | null = null
  private streamSceneRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private perfRouteBusy = false
  private pegmanDragging = false
  private pageVisible = true
  private autoQualityBusy = false
  private modelLoadGeneration = 0
  private activeModelLoad: ModelLoadRequest | null = null
  private contextLost = false
  private contextRestoreTimer: number | null = null
  private contextLossTimes: number[] = []
  private contextRecoveryNeedsModelReload = false
  private thumbnailTaskCancel: (() => void) | null = null
  private thumbnailCaptureAttempts = new Set<string>()
  private orbitOverview = false
  private orbitDedupeOn = false
  private orbitDupTagged = false
  private orbitDuplicateMeshes: Mesh[] = []
  private orbitAlwaysHiddenMeshes: Mesh[] = []
  private goldenPreviewMode: GoldenPreviewMode | null = null
  private xrLocomotion: XRLocomotion | null = null
  private preXrQuality: QualityProfileId | null = null
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

    this.models = new ModelManager(
      () => this.renderer,
      async (root, entry, _pkg, _level, signal) => {
        if (signal.aborted) throw new DOMException('Stream package preparation was superseded', 'AbortError')
        const packageBounds = computeSceneBounds(root)
        dedupeSceneMaterials(root)
        prepareArchitecturalMeshes(root, packageBounds, {
          freezeStatic: true,
          glassDepthBias: 0,
          lightmapped: Boolean(entry.lightmap),
        })
        if (entry.lightmap) await applyLightmaps(root, entry)
        if (signal.aborted) throw new DOMException('Stream package preparation was superseded', 'AbortError')
        applyMeshQuality(root, this.quality.getProfile())
        root.userData.animationPackagePrepared = true
      },
    )
    this.models.setStreamingFailoverHandler(async ({ layerId, error, attempts }) => {
      if (this.disposed) return
      const failedLayer = this.models.getLayer(layerId)
      if (!failedLayer?.streaming) return
      const entries = this.models.listLayers().map((layer) => layer.entry)
      if (!entries.length) return
      console.warn(
        `[Viewer] streamed package sync failed for ${layerId} after ${attempts} attempts; preparing atomic monolithic fallback`,
        error,
      )
      this.events.onLoading?.({
        stage: 'download',
        ratio: null,
        message: `Recovering ${failedLayer.entry.name} with the complete model`,
      })
      await this.loadModelSet(entries, undefined, { rethrowErrors: true })
    })
    this.lighting = new LightingSystem(this.scene)
    this.lighting.configureRenderer(this.renderer)
    this.lighting.applyQuality(initialQuality)
    this.runtimeAntialias = new RuntimeAntialias(this.renderer, this.scene, this.camera)
    this.runtimeAntialias.configure(initialQuality.runtimeAntialias)

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
        if (dragging) this.collision.setQueryLayer(null)
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
      const restoreQuality = this.preXrQuality
      this.preXrQuality = null
      this.xrLocomotion = null
      this.orbit.setEnabled(this.mode === 'orbit')
      // Restore locked full-scene shadows after VR — never leave local-region active on desktop.
      this.lighting.setXrShadowMode(false)
      this.shadowFramesLeft = 2
      if (!this.disposed && restoreQuality != null) {
        // Our listener may run before Three's own `end` listener. Defer renderer
        // changes until the event dispatch completes and isPresenting is false.
        queueMicrotask(() => {
          if (this.disposed || this.xr.isActive()) return
          void this.setQuality(restoreQuality).catch((err) => {
            console.warn('[Viewer] Failed to restore pre-XR quality', err)
            this.events.onError?.('VR exited, but the previous quality profile could not be restored.')
          })
        })
      }
    })
    this.controller.setWorld(this.collision)

    this.resize()
    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', this.onVisibility)
    options.canvas.addEventListener('webglcontextlost', this.onContextLost)
    options.canvas.addEventListener('webglcontextrestored', this.onContextRestored)

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
    // Collision BVHs are authored at the animation rest pose. Reset before
    // surface picking so animated ceilings/bridge decks cannot diverge from it.
    this.modelAnim.stop()
    this.emitAnimation()
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
    this.runtimeAntialias.configure(profile.runtimeAntialias)
    const canvas = this.renderer.domElement
    const parent = canvas.parentElement
    this.runtimeAntialias.resize(
      parent?.clientWidth || window.innerWidth,
      parent?.clientHeight || window.innerHeight,
      this.renderer.getPixelRatio(),
    )
    this.lighting.applyQuality(profile)
    applyMeshQuality(this.models.root, profile)
    this.detailLod.applyQuality(profile.id)
    this.character.setBlobShadow(profile.characterBlobShadow)
    this.lighting.requestShadowUpdate()
    this.shadowFramesLeft = 1
    this.applyXrFoveation(profile.xrFoveation)
  }

  private applyXrFoveation(level: number | null): void {
    this.xr.setFoveation(level)
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

  private async applyCameraViewDefaults(
    bounds: NonNullable<typeof this.bounds>,
    signal?: AbortSignal,
  ): Promise<void> {
    const shipped = await fetchShippedCameraViews()
    if (signal?.aborted) throw new DOMException('Model load was superseded', 'AbortError')
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

  /** Capture at most one thumbnail during idle time, never on the startup path. */
  private bakeNextCameraViewThumbnail(): boolean {
    const view = this.cameraViews
      .viewsMissingThumbnails()
      .find((candidate) => !this.thumbnailCaptureAttempts.has(candidate.id))
    if (!view) return false
    this.thumbnailCaptureAttempts.add(view.id)

    const savedPos = this.camera.position.clone()
    const savedTarget = this.orbit.controls.target.clone()
    const savedFov = this.camera.fov
    const orbitWasEnabled = this.orbit.controls.enabled
    this.orbit.setEnabled(false)

    this.camera.position.set(...view.cameraPosition)
    this.orbit.controls.target.set(...view.cameraTarget)
    this.camera.fov = view.fov
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(this.orbit.controls.target)
    this.orbit.controls.update()
    this.renderer.render(this.scene, this.camera)
    const thumb = this.captureViewportThumbnail()
    if (thumb) this.cameraViews.setThumbnail(view.id, thumb)

    this.camera.position.copy(savedPos)
    this.orbit.controls.target.copy(savedTarget)
    this.camera.fov = savedFov
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(this.orbit.controls.target)
    this.orbit.controls.update()
    this.orbit.setEnabled(orbitWasEnabled)
    this.emitCameraViews()
    return true
  }

  private cancelThumbnailTask(): void {
    this.thumbnailTaskCancel?.()
    this.thumbnailTaskCancel = null
  }

  private scheduleCameraViewThumbnails(delayMs = 250): void {
    this.cancelThumbnailTask()
    if (this.disposed) return

    const run = (): void => {
      this.thumbnailTaskCancel = null
      if (this.disposed) return
      // Do not steal a frame while the user is moving, in XR, or while WebGL
      // resources are unavailable. The timeout fallback retries later.
      if (
        this.contextLost ||
        !this.pageVisible ||
        this.xr.isActive() ||
        this.mode === 'walk' ||
        this.orbit.isAnimating()
      ) {
        this.scheduleCameraViewThumbnails(750)
        return
      }
      if (this.bakeNextCameraViewThumbnail()) {
        this.scheduleCameraViewThumbnails(100)
      }
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: Window['requestIdleCallback']
      cancelIdleCallback?: Window['cancelIdleCallback']
    }
    let idleId: number | null = null
    const timerId = window.setTimeout(() => {
      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleId = idleWindow.requestIdleCallback(run, { timeout: 1500 })
      } else {
        run()
      }
    }, delayMs)
    this.thumbnailTaskCancel = () => {
      window.clearTimeout(timerId)
      if (idleId != null) idleWindow.cancelIdleCallback?.(idleId)
    }
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
    // requestSession must be invoked while the click still has transient user
    // activation. Read the fixed Quest scale without mutating live quality,
    // then let XRManager apply it before Three installs the session.
    if (this.disposed) return
    const prevVariant = this.quality.getProfile().modelVariant
    if (this.preXrQuality == null) this.preXrQuality = this.quality.getPreferred()
    const questProfile = getQualityProfile('QUEST')
    const ok = await this.xr.enterVR(questProfile.xrFramebufferScale)
    if (!ok || this.disposed || !this.xr.isActive()) {
      this.preXrQuality = null
      if (this.disposed || ok) return
      this.events.onError?.('WebXR immersive-vr is not available on this device.')
      return
    }
    // Apply cheap render settings synchronously and mount the rig immediately.
    // If the asset variant must change, that cancellable load runs only after
    // the first XR frame can be presented.
    const xrProfile = this.quality.setPreferred('QUEST')
    this.applyQuality(xrProfile)
    this.events.onQuality?.(this.quality.getPreferred())
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

    if (xrProfile.modelVariant !== prevVariant && this.manifest) {
      const entries = this.models
        .listLayers()
        .map((layer) => this.manifest!.models.find((entry) => entry.id === layer.id))
        .filter((entry): entry is ModelManifestEntry => Boolean(entry))
      if (entries.length) void this.loadModelSet(entries)
    }
  }

  exitWalk(): void {
    if (this.mode !== 'walk') return
    this.walk.deactivate()
    this.collision.setQueryLayer(null)
    this.orbit.setEnabled(true)
    this.orbit.restoreState()
    this.mode = 'orbit'
    this.events.onMode?.('orbit')
    this.events.onWalkLock?.(false)
  }

  private async handlePegmanDrop(result: import('./controls/PegmanPlacement').PegmanDropResult): Promise<void> {
    this.orbit.setEnabled(this.mode === 'orbit')
    if (!result.ok) {
      this.collision.setQueryLayer(null)
      this.orbit.setEnabled(true)
      this.events.onError?.(result.reason ?? 'Cannot place character here')
      return
    }
    if (!placeCharacterFromPegman(this.controller, result)) {
      this.collision.setQueryLayer(null)
      this.orbit.setEnabled(true)
      return
    }
    this.collision.setQueryLayer(result.layerId ?? null)
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
    if (!visible && this.mode === 'walk' && this.collision.getQueryLayer() === id) {
      this.exitWalk()
    }
    for (const patch of this.patchesFor(id)) {
      this.models.setVisible(patch.id, visible)
    }
    this.refreshSceneAfterLayerChange()
    this.emitModels()
  }

  playAnimation(): void {
    if (this.mode === 'walk') {
      this.events.onError?.('Exit Walk mode before playing the building animation.')
      return
    }
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
    if (this.mode === 'walk') return
    this.modelAnim.seek(timeSeconds)
    this.emitAnimation()
  }

  seekAnimationNormalized(u: number): void {
    if (this.mode === 'walk') return
    this.modelAnim.seekNormalized(u)
    this.emitAnimation()
  }

  getAnimationState(): AnimationTransportState {
    return this.modelAnim.getState()
  }

  async loadLocalGlb(file: File): Promise<void> {
    const request = this.beginModelLoad()
    try {
      this.events.onLoading?.({ stage: 'download', ratio: 0, message: `Loading ${file.name}` })
      const layer = await this.models.loadLocalFile(
        file,
        (p) => {
          if (this.activeModelLoad?.generation === request.generation) {
            this.events.onLoading?.(p)
          }
        },
        request.controller.signal,
      )
      this.assertCurrentModelLoad(request)
      this.leaveWalkForReload()
      this.modelAnim.dispose()
      await this.afterLayersLoaded([layer], { loadRequest: request })
    } catch (err) {
      if (this.isSupersededLoad(err)) return
      const msg = err instanceof Error ? err.message : String(err)
      this.events.onError?.(`Failed to load GLB: ${msg}`)
      this.events.onLoading?.({ stage: 'error', ratio: null, message: msg })
    }
  }

  private async bootstrap(manifestUrl: string): Promise<void> {
    const request = this.beginModelLoad()
    try {
      const xr = await this.xr.checkSupport()
      this.assertCurrentModelLoad(request)
      this.events.onXrSupport?.(xr)

      await this.lighting.setPreset('daylight')
      this.assertCurrentModelLoad(request)
      this.events.onDaylight?.('daylight')
      this.events.onQuality?.(this.quality.getPreferred())
      this.shadowFramesLeft = 2

      void this.character.load(this.characterUrl).then(() => {
        this.character.setBlobShadow(this.quality.getProfile().characterBlobShadow)
      }).catch((err) => {
        console.warn('[Viewer] Character load failed', err)
      })

      const res = await fetch(manifestUrl, { signal: request.controller.signal })
      if (!res.ok) throw new Error(`Manifest HTTP ${res.status}`)
      const manifest = (await res.json()) as ModelManifest
      this.assertCurrentModelLoad(request)
      this.manifest = manifest
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

      if (entries.length) await this.loadModelSet(entries, request)
      else {
        this.events.onLoading?.({
          stage: 'ready',
          ratio: 1,
          message: 'Drop a GLB or import a model via npm run model:import',
        })
      }
    } catch (err) {
      if (this.isSupersededLoad(err)) return
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

  private beginModelLoad(): ModelLoadRequest {
    this.activeModelLoad?.controller.abort()
    this.cancelThumbnailTask()
    if (this.streamSceneRefreshTimer) {
      clearTimeout(this.streamSceneRefreshTimer)
      this.streamSceneRefreshTimer = null
    }
    const request = {
      generation: ++this.modelLoadGeneration,
      controller: new AbortController(),
    }
    this.activeModelLoad = request
    return request
  }

  private assertCurrentModelLoad(request: ModelLoadRequest): void {
    if (
      this.disposed ||
      request.controller.signal.aborted ||
      this.activeModelLoad?.generation !== request.generation
    ) {
      throw new DOMException('Model load was superseded', 'AbortError')
    }
  }

  private isSupersededLoad(err: unknown): boolean {
    return (
      (err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && err.name === 'AbortError')
    )
  }

  private async loadModelSet(
    entries: ModelManifestEntry[],
    existingRequest?: ModelLoadRequest,
    options?: { rethrowErrors?: boolean },
  ): Promise<void> {
    const request = existingRequest ?? this.beginModelLoad()
    try {
      this.assertCurrentModelLoad(request)
      const toLoad = this.expandWithPatches(entries)
      this.events.onLoading?.({
        stage: 'download',
        ratio: 0,
        message: `Loading ${toLoad.length} model${toLoad.length > 1 ? 's' : ''}`,
      })

      const variant: ModelVariantKey = this.quality.getProfile().modelVariant
      const primary = toLoad[0]!

      const layers = await this.models.loadLayers(
        toLoad,
        variant,
        (p) => {
          if (this.activeModelLoad?.generation === request.generation) {
            this.events.onLoading?.(p)
          }
        },
        this.currentStreamFocus(),
        request.controller.signal,
      )
      this.assertCurrentModelLoad(request)
      this.leaveWalkForReload()
      this.modelAnim.dispose()
      this.controller.setParams({
        ...DEFAULT_CHARACTER_PARAMS,
        playerHeight: primary.playerHeight ?? DEFAULT_CHARACTER_PARAMS.playerHeight,
        playerRadius: primary.playerRadius ?? DEFAULT_CHARACTER_PARAMS.playerRadius,
        eyeHeight: primary.eyeHeight ?? DEFAULT_CHARACTER_PARAMS.eyeHeight,
      })
      await this.afterLayersLoaded(layers, { loadRequest: request })
    } catch (err) {
      if (this.isSupersededLoad(err)) {
        if (options?.rethrowErrors) throw err
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      this.events.onError?.(`Failed to load models: ${msg}`)
      this.events.onLoading?.({ stage: 'error', ratio: null, message: msg })
      if (options?.rethrowErrors) throw err
    }
  }

  private async addModelLayer(entry: ModelManifestEntry): Promise<void> {
    const missing = this.expandWithPatches([entry]).filter((e) => !this.models.getLayer(e.id))
    if (missing.length === 0) return
    const request = this.beginModelLoad()
    try {
      this.events.onLoading?.({ stage: 'download', ratio: 0, message: `Loading ${entry.name}` })
      const variant: ModelVariantKey = this.quality.getProfile().modelVariant
      let focusNew: LoadedModelLayer | undefined
      for (const next of missing) {
        const layer = await this.models.addLayer(
          next,
          variant,
          (p) => {
            if (this.activeModelLoad?.generation === request.generation) {
              this.events.onLoading?.(p)
            }
          },
          this.currentStreamFocus(),
          request.controller.signal,
        )
        this.assertCurrentModelLoad(request)
        if (next.id === entry.id) focusNew = layer
      }
      await this.afterLayersLoaded(this.models.listLayers(), {
        focusNew: focusNew ?? this.models.getLayer(entry.id) ?? undefined,
        loadRequest: request,
      })
    } catch (err) {
      if (this.isSupersededLoad(err)) return
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
    signal?: AbortSignal,
  ): Promise<void> {
    const focusSeed =
      this.mode === 'walk' || this.xr.isActive()
        ? this.controller.position
        : this.orbit.controls.target
    try {
      for (const layer of targets) {
        await this.ensureLayerCollision(layer, { silent: true, signal })
      }
      if (signal?.aborted) return
      await this.collision.rebuildFromLayers(
        allLayers.map((l) => l.id),
        focusSeed,
      )
      this.collision.retainLayers(allLayers.map((l) => l.id))
      this.pegman.setWorld(this.collision, this.models.root)
      this.events.onLoading?.({ stage: 'ready', ratio: 1, message: 'Ready' })
    } catch (err) {
      if (signal?.aborted) return
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[Collision] deferred build failed', err)
      this.events.onError?.(`Walk collision update failed: ${msg}`)
    }
  }

  private async ensureLayerCollision(
    layer: LoadedModelLayer,
    opts?: { silent?: boolean; signal?: AbortSignal },
  ): Promise<void> {
    const prepared = this.models.takePreparedStreamingCollision(layer.id)
    if (prepared) {
      this.installDedicatedCollision(layer, prepared.chunks, prepared.report)
      return
    }

    if (layer.entry.collision) {
      let disposableCollision: import('three').Object3D | null = null
      let dedicatedFailure: unknown = null
      try {
        disposableCollision = await this.models.loadCollisionRoot(
          layer.entry,
          opts?.silent ? undefined : (p) => this.events.onLoading?.(p),
          opts?.signal,
        )
        if (disposableCollision) {
          const validation = validateDedicatedCollisionRoot(disposableCollision, layer.id, true)
          if (validation.valid && validation.collision) {
            this.installDedicatedCollision(
              layer,
              validation.collision.chunks,
              validation.collision.report,
            )
            return
          }
          dedicatedFailure = new Error(
            `Dedicated collision failed validation for ${layer.id}: ${validation.reason ?? 'unknown reason'}`,
          )
          console.warn(
            `[Collision] ${layer.id}: ${validation.reason ?? 'dedicated validation failed'}`,
          )
        }
      } catch (err) {
        if (opts?.signal?.aborted) throw err
        dedicatedFailure = err
        console.warn(`[Collision] dedicated GLB failed for ${layer.id}`, err)
      } finally {
        if (disposableCollision) disposeObject3D(disposableCollision)
      }

      if (!allowsVisualCollisionFallback(layer.streaming)) {
        const failure = dedicatedFailure ?? new Error(`Dedicated collision is unavailable for ${layer.id}`)
        await this.models.requestStreamingFailover(layer.id, failure, opts?.signal)
        throw failure
      }
    }

    // Visual geometry is a fallback only. Do not clone, retain, or rebuild it
    // when a valid dedicated collision file exists. Streamed shell/detail
    // geometry is intentionally never eligible because it is spatially incomplete.
    if (!allowsVisualCollisionFallback(layer.streaming)) {
      const failure = new Error(`Streaming layer ${layer.id} has no complete dedicated collision`)
      await this.models.requestStreamingFailover(layer.id, failure, opts?.signal)
      throw failure
    }
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
    layer: LoadedModelLayer,
    dedicated: CollisionChunkSource[],
    dedicatedReport: CollisionBuildReport,
  ): void {
    const dedicatedNames = dedicated.flatMap((chunk) => chunk.sourceNames ?? [])
    const missingBridgeDeck = (mesh: Mesh): boolean => {
      if (!isIcmBridgeCollisionSupplement(mesh)) return false
      const expected = mesh.name.toLowerCase()
      return !dedicatedNames.some((rawName) => {
        const authored = rawName.replace(/^COLLIDER_/i, '').toLowerCase()
        // Exact match only: generic authored floors such as floor_bt2_eg are
        // unrelated to the bridge mesh named Floor and must not suppress it.
        return authored === expected
      })
    }
    const missingAnimatedWalkSurface = (mesh: Mesh): boolean =>
      layer.id === 'icm-anim-2025' && isIcmAnimatedWalkCollisionSupplement(mesh)
    const needsVisualSupplement = (mesh: Mesh): boolean =>
      missingBridgeDeck(mesh) || missingAnimatedWalkSurface(mesh)
    const supplemental = buildCollisionChunks(layer.root, {
      layerId: layer.id,
      verbose: false,
      ignoreVisibility: true,
      walkSurfacesOnly: true,
      includeMesh: needsVisualSupplement,
      isExplicitWalkable: needsVisualSupplement,
      doubleSided: true,
    })
    let navigationSupplement: ReturnType<typeof buildCollisionChunks> | null = null
    if (layer.id === 'icm-anim-2025') {
      const navigationRoot = new Group()
      for (const spec of ICM_ANIMATED_STAIR_LANDING_SUPPLEMENTS) {
        // The omitted source floor spans the entire stairwell. Merging it
        // wholesale creates an invisible upper floor over both flights, so
        // cover only the verified 40.56..42.05 m exit gaps.
        const geometry = new PlaneGeometry(1.35, 1.49)
        geometry.rotateX(-Math.PI / 2)
        const landing = new Mesh(geometry)
        landing.name = `COLLIDER_stair_landing_${spec.name}`
        landing.position.set(spec.centerX, 10.00005, spec.centerZ)
        navigationRoot.add(landing)
      }
      for (const aisle of ICM_ANIMATED_AUDITORIUM_AISLE_SUPPLEMENTS) {
        for (let index = 0; index + 1 < aisle.points.length; index += 1) {
          const start = aisle.points[index]!
          const end = aisle.points[index + 1]!
          const dx = end[0] - start[0]
          const dz = end[2] - start[2]
          const length = Math.hypot(dx, dz)
          if (length < 1e-6) continue
          const sideX = (-dz / length) * aisle.width * 0.5
          const sideZ = (dx / length) * aisle.width * 0.5
          const rise = end[1] - start[1]
          const stepCount = Math.max(1, Math.ceil(Math.abs(rise) / 0.19))
          const overlap = Math.min(0.012, 0.04 / length)
          const lift = 0.025
          const vertices: number[] = []
          // Horizontal tread-only strips remove the exported riser snags while
          // retaining normal walking speed. A continuous ramp would trigger
          // look-ahead step-up every frame and accelerate the controller.
          for (let step = 0; step <= stepCount; step += 1) {
            const startT = Math.max(0, step / stepCount - overlap)
            const endT = Math.min(1 + 0.2 / length, (step + 1) / stepCount + overlap)
            const y = start[1] + rise * (step / stepCount) + lift
            const startX = start[0] + dx * startT
            const startZ = start[2] + dz * startT
            const endX = start[0] + dx * endT
            const endZ = start[2] + dz * endT
            vertices.push(
              startX + sideX, y, startZ + sideZ,
              endX + sideX, y, endZ + sideZ,
              endX - sideX, y, endZ - sideZ,
              startX + sideX, y, startZ + sideZ,
              endX - sideX, y, endZ - sideZ,
              startX - sideX, y, startZ - sideZ,
            )
          }
          const geometry = new BufferGeometry()
          geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
          const treads = new Mesh(geometry)
          // Keep this a normal walk surface, not a stair-volume zone: the
          // flight-wide AABB would otherwise latch the solid-volume fallback.
          treads.name = `COLLIDER_walk_${aisle.name}_${index}`
          navigationRoot.add(treads)
        }
      }
      navigationRoot.updateMatrixWorld(true)
      navigationSupplement = buildCollisionChunks(navigationRoot, {
        layerId: layer.id,
        verbose: false,
        ignoreVisibility: true,
        walkSurfacesOnly: true,
        isExplicitWalkable: () => true,
        doubleSided: true,
      })
      disposeObject3D(navigationRoot)
    }
    const supplementReports = [supplemental.report, navigationSupplement?.report].filter(
      (entry): entry is CollisionBuildReport => Boolean(entry),
    )
    const chunks = [
      ...dedicated,
      ...supplemental.chunks,
      ...(navigationSupplement?.chunks ?? []),
    ]
    const report = {
      ...dedicatedReport,
      preferredColliders: true,
      sourceMeshes:
        dedicatedReport.sourceMeshes +
        supplementReports.reduce((sum, entry) => sum + entry.sourceMeshes, 0),
      usedMeshes:
        dedicatedReport.usedMeshes +
        supplementReports.reduce((sum, entry) => sum + entry.usedMeshes, 0),
      chunks: chunks.length,
      triangles: chunks.reduce((s, c) => s + c.triangles, 0),
      selected: [
        ...dedicatedReport.selected,
        ...supplementReports.flatMap((entry) => entry.selected),
      ],
    }
    const supplementChunkCount = supplementReports.reduce((sum, entry) => sum + entry.chunks, 0)
    const supplementTriangles = supplementReports.reduce((sum, entry) => sum + entry.triangles, 0)
    const supplementLabel = supplementChunkCount
      ? ` + visual walk supplement ${supplementChunkCount} chunks/${Math.round(supplementTriangles)} tris`
      : ''
    console.info(
      `[Collision] ${layer.id}: dedicated · ` +
        `${chunks.length} chunks · ${Math.round(report.triangles)} tris${supplementLabel}`,
    )
    this.collision.setLayerChunks(layer.id, chunks, report)
  }

  private leaveWalkForReload(): void {
    this.collision.setQueryLayer(null)
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
    opts?: { focusNew?: LoadedModelLayer; loadRequest?: ModelLoadRequest },
  ): Promise<void> {
    const loadRequest = opts?.loadRequest
    if (loadRequest) this.assertCurrentModelLoad(loadRequest)
    this.events.onLoading?.({ stage: 'collision', ratio: 0.97, message: 'Preparing collision' })

    const combinedRoot = this.models.root
    const bounds = computeSceneBounds(combinedRoot)
    this.bounds = bounds
    this.applyCameraNearFar(bounds)

    const spatialMeta = await this.resolveSpatialMeta(
      layers,
      loadRequest?.controller.signal,
    )
    if (loadRequest) this.assertCurrentModelLoad(loadRequest)
    this.spatialMeta = spatialMeta
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
      const matDedupe = dedupeSceneMaterials(layer.root)
      if (matDedupe.merged > 0) {
        console.info(
          `[Viewer] ${layer.id}: merged ${matDedupe.merged} duplicate material${matDedupe.merged === 1 ? '' : 's'} (${matDedupe.before} → ${matDedupe.after})`,
        )
      }
      prepareArchitecturalMeshes(layer.root, bounds, {
        freezeStatic: true,
        animatedNodeNames: layerAnimatedNames.size ? layerAnimatedNames : undefined,
        // Separate coplanar glass when both exterior + animated are loaded.
        glassDepthBias: i,
        lightmapped: Boolean(layer.entry.lightmap),
      })
      if (layer.entry.lightmap) {
        await applyLightmaps(layer.root, layer.entry)
        if (loadRequest) this.assertCurrentModelLoad(loadRequest)
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
      // Keep rendering the newly selected layer while its collision is prepared,
      // but do not allow a drop into a partially rebuilt/single-layer world.
      // buildCollisionForLayers restores Pegman atomically when both layers are resident.
      this.pegman.setWorld(null, combinedRoot)
      void this.buildCollisionForLayers(
        collisionTargets,
        layers,
        loadRequest?.controller.signal,
      )
    } else {
      for (const layer of collisionTargets) {
        await this.ensureLayerCollision(layer, { signal: loadRequest?.controller.signal })
        if (loadRequest) this.assertCurrentModelLoad(loadRequest)
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
      if (loadRequest) this.assertCurrentModelLoad(loadRequest)
      this.collision.retainLayers(collisionLayerIds)
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

    await this.applyCameraViewDefaults(bounds, loadRequest?.controller.signal)
    if (loadRequest) this.assertCurrentModelLoad(loadRequest)

    const spawnEntry = layers.find((l) => l.entry.spawn)?.entry
    if (spawnEntry?.spawn && !this.xr.isActive()) {
      this.controller.setFeetPosition(new Vector3(...spawnEntry.spawn))
    }

    this.events.onLoading?.({ stage: 'scene', ratio: 0.99, message: 'Compiling shaders' })
    try {
      // Large architectural scenes can stall compileAsync indefinitely — bound it.
      await Promise.race([
        this.renderer.compileAsync(this.scene, this.camera),
        new Promise<void>((resolve) => window.setTimeout(resolve, 8000)),
      ])
      if (loadRequest) this.assertCurrentModelLoad(loadRequest)
    } catch (err) {
      if (this.isSupersededLoad(err)) throw err
      console.warn('[Viewer] compileAsync failed', err)
    }

    // Lazy-loaded layers should not yank the camera back to Overview.
    if (!opts?.focusNew && !this.xr.isActive()) {
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
    if (!opts?.focusNew && !this.xr.isActive()) {
      this.thumbnailCaptureAttempts.clear()
      this.scheduleCameraViewThumbnails()
    }
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

  private async resolveSpatialMeta(
    layers: LoadedModelLayer[],
    signal?: AbortSignal,
  ): Promise<SpatialMetaFile | null> {
    for (const layer of layers) {
      if (signal?.aborted) throw new DOMException('Model load was superseded', 'AbortError')
      const url = layer.entry.spatialMeta
      if (!url) continue
      const meta = await fetchSpatialMeta(url)
      if (signal?.aborted) throw new DOMException('Model load was superseded', 'AbortError')
      if (meta) {
        console.info(`[Spatial] loaded meta from ${url}`)
        return meta
      }
    }
    return null
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
   * Dual-layer orbit: hide only animated meshes with explicit exterior-layer
   * ownership (or the prepared façade-shutter role). Names, materials, and
   * low/large bounds are not ownership proof; those heuristics punched holes
   * through walkways and connector floors. Walk restores every tagged copy.
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
        const match = isOrbitDuplicateMesh(mesh)
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

    // Repacking or refreshed metadata can change classification. Restore
    // anything hidden by the previous cache but no longer explicitly owned.
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
          // Manifest-v3 package swaps never replace the persistent rig or its
          // clips, so keep the current mixer binding and transport untouched.
          this.scheduleStreamSceneRefresh()
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
    const generation = this.modelLoadGeneration
    const layers = this.models.listLayers()
    if (this.disposed) return
    const combinedRoot = this.models.root
    const bounds = computeSceneBounds(combinedRoot)
    if (bounds.box.isEmpty()) return
    this.bounds = bounds
    this.applyCameraNearFar(bounds)

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]!
      if (!layer.streaming) continue
      const layerAnimatedNames = collectAnimatedNodeNames(layer.result.animations ?? [])
      const matDedupe = dedupeSceneMaterials(layer.root)
      if (matDedupe.merged > 0) {
        console.info(
          `[Viewer] ${layer.id}: merged ${matDedupe.merged} duplicate material${matDedupe.merged === 1 ? '' : 's'} (${matDedupe.before} → ${matDedupe.after})`,
        )
      }
      prepareArchitecturalMeshes(layer.root, bounds, {
        freezeStatic: true,
        animatedNodeNames: layerAnimatedNames.size ? layerAnimatedNames : undefined,
        glassDepthBias: i,
        lightmapped: Boolean(layer.entry.lightmap),
      })
      if (layer.entry.lightmap) {
        await applyLightmaps(layer.root, layer.entry)
        if (
          this.disposed ||
          generation !== this.modelLoadGeneration ||
          this.models.getLayer(layer.id) !== layer
        ) {
          return
        }
      }
    }

    if (this.disposed || generation !== this.modelLoadGeneration) return

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
    applyMeshQuality(combinedRoot, q)
    this.tagOrbitDuplicates()
    this.refreshSpatialSystems(combinedRoot, bounds, floorBand)
    this.applyStreamingFloorPolicy()
    this.detailLod.update(this.camera)
    this.lighting.requestShadowUpdate()
    this.shadowFramesLeft = 2
  }

  /** Bind embedded GLB animation to the correct scene root (streaming shell or full layer). */
  private rebindModelAnimation(): void {
    const generation = this.modelLoadGeneration
    const animLayer = this.models
      .listLayers()
      .find((l) => l.visible && (l.result.animations?.length ?? 0) > 0)
    if (!animLayer?.result.animations.length) {
      this.modelAnim.dispose()
      this.emitAnimation()
      return
    }

    void this.models.refreshStreamingAnimations(
      animLayer.id,
      this.activeModelLoad?.controller.signal,
    ).then((clips) => {
      if (
        this.disposed ||
        generation !== this.modelLoadGeneration ||
        this.models.getLayer(animLayer.id) !== animLayer
      ) {
        return
      }
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
        preserveState: true,
        stateKey: animLayer.id,
      })
      this.emitAnimation()
    }).catch((err) => {
      if (!this.isSupersededLoad(err)) {
        console.warn(`[Viewer] animation rebind failed for ${animLayer.id}`, err)
      }
    })
  }

  private flushStreamingFocus(focus: import('three').Vector3): void {
    if (!this.models.hasStreamingLayers()) {
      this.queuedStreamFocus = null
      return
    }

    // The render loop can run much faster than package fetch/parse. Keep only
    // the newest focus while one serialized drain owns ModelManager syncing.
    this.queuedStreamFocus = { x: focus.x, y: focus.y, z: focus.z }
    this.startStreamingFocusDrain()
  }

  private startStreamingFocusDrain(): void {
    if (this.streamFocusDrain) return

    const drain = this.drainStreamingFocus()
    this.streamFocusDrain = drain
    void drain.finally(() => {
      if (this.streamFocusDrain !== drain) return
      this.streamFocusDrain = null
      if (!this.disposed && this.queuedStreamFocus && this.models.hasStreamingLayers()) {
        this.startStreamingFocusDrain()
      }
    })
  }

  private async drainStreamingFocus(): Promise<void> {
    while (!this.disposed && this.queuedStreamFocus && this.models.hasStreamingLayers()) {
      const remainingMs = this.streamFocusIntervalMs - (performance.now() - this.lastStreamSyncMs)
      if (remainingMs > 0) await this.sleep(remainingMs)
      if (this.disposed || !this.models.hasStreamingLayers()) return

      // Focus may have changed while throttling; consume the latest snapshot.
      const focus = this.queuedStreamFocus
      if (!focus) return
      this.queuedStreamFocus = null
      this.lastStreamSyncMs = performance.now()
      try {
        await this.models.updateStreamingFocus(
          focus,
          undefined,
          this.activeModelLoad?.controller.signal,
        )
      } catch (err) {
        if (!this.isSupersededLoad(err)) {
          const message = err instanceof Error ? err.message : String(err)
          console.warn('[Viewer] cell streaming update/recovery failed', err)
          this.events.onError?.(
            `Streaming recovery failed; the last resident scene remains active: ${message}`,
          )
        }
      }
    }
  }

  private refreshSceneAfterLayerChange(): void {
    const generation = this.modelLoadGeneration
    const signal = this.activeModelLoad?.controller.signal
    const combinedRoot = this.models.root
    const bounds = computeSceneBounds(combinedRoot)
    this.bounds = bounds
    this.applyCameraNearFar(bounds)
    const floorBand = this.models.listLayers()[0]?.entry.floorBandHeight
    this.refreshSpatialSystems(combinedRoot, bounds, floorBand)
    void this.applyCameraViewDefaults(bounds, signal)
      .then(() => {
        if (this.disposed || generation !== this.modelLoadGeneration) return
        if (this.cameraViews.viewsMissingThumbnails().length) {
          this.thumbnailCaptureAttempts.clear()
          this.scheduleCameraViewThumbnails()
        }
      })
      .catch((err) => {
        if (!this.isSupersededLoad(err)) console.warn('[Viewer] camera view refresh failed', err)
      })

    const allLayers = this.models.listLayers()
    const collisionLayerIds = allLayers.map((l) => l.id)
    const focusSeed =
      this.mode === 'walk' || this.xr.isActive()
        ? this.controller.position
        : this.orbit.controls.target

    // Re-bake any loaded layer that is missing / too thin (animated interior alone).
    void (async () => {
      try {
      for (const layer of allLayers) {
        if (this.disposed || signal?.aborted || generation !== this.modelLoadGeneration) return
        if (layer.entry.compareVisual) continue
        const tris = this.collision.layerTriangleCount(layer.id)
        if (layer.entry.lightmap && !layer.entry.collision) {
          if (!this.collision.hasLayerChunks(layer.id)) {
            this.events.onLoading?.({
              stage: 'collision',
              ratio: 0.97,
              message: `Preparing collision · ${layer.entry.name}`,
            })
            await this.ensureLayerCollision(layer, { signal })
          }
          continue
        }
        if (!this.collision.hasLayerChunks(layer.id) || tris < 500) {
          this.events.onLoading?.({
            stage: 'collision',
            ratio: 0.97,
            message: `Preparing collision · ${layer.entry.name}`,
          })
          await this.ensureLayerCollision(layer, { signal })
        }
      }
      if (this.disposed || signal?.aborted || generation !== this.modelLoadGeneration) return
      const info = await this.collision.rebuildFromLayers(collisionLayerIds, focusSeed)
      if (this.disposed || signal?.aborted || generation !== this.modelLoadGeneration) return
      this.collision.retainLayers(collisionLayerIds)
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
      } catch (err) {
        if (!this.isSupersededLoad(err)) {
          console.warn('[Viewer] layer visibility refresh failed', err)
          this.events.onError?.('Failed to refresh model visibility collision.')
        }
      }
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
  private readonly onContextLost = (event: Event): void => {
    event.preventDefault()
    this.contextLost = true
    this.cancelThumbnailTask()
    this.perf.attachRenderer(null)
    const now = performance.now()
    this.contextLossTimes = this.contextLossTimes.filter((time) => now - time < 60_000)
    this.contextLossTimes.push(now)
    this.events.onLoading?.({
      stage: 'error',
      ratio: null,
      message: 'Graphics context lost - recovering...',
    })

    if (this.contextRestoreTimer) window.clearTimeout(this.contextRestoreTimer)
    this.contextRestoreTimer = window.setTimeout(() => {
      this.contextRestoreTimer = null
      if (!this.contextLost || this.disposed) return
      if (this.contextLossTimes.length >= 2) {
        const previousVariant = this.quality.getProfile().modelVariant
        const recoveryProfile = this.quality.setPreferred('QUEST')
        if (recoveryProfile.modelVariant !== previousVariant) {
          this.contextRecoveryNeedsModelReload = true
        }
        this.events.onQuality?.(this.quality.getPreferred())
        console.warn('[Viewer] Repeated WebGL loss; recovery will use Performance quality')
        // applyQuality is deferred until a valid context is restored.
      }
      try {
        this.contextRestoreTimer = window.setTimeout(() => {
          this.contextRestoreTimer = null
          if (this.contextLost && !this.disposed) {
            this.events.onError?.('Graphics recovery timed out. Reload the page to continue.')
          }
        }, 8_000)
        this.renderer.forceContextRestore()
      } catch {
        if (this.contextRestoreTimer) window.clearTimeout(this.contextRestoreTimer)
        this.contextRestoreTimer = null
        this.events.onError?.('Graphics recovery failed. Reload the page to continue.')
      }
    }, 4_000)
  }

  private readonly onContextRestored = (): void => {
    if (this.disposed) return
    if (this.contextRestoreTimer) {
      window.clearTimeout(this.contextRestoreTimer)
      this.contextRestoreTimer = null
    }
    this.contextLost = false
    this.renderer.resetState()
    this.perf.attachRenderer(this.renderer.getContext())
    this.lighting.configureRenderer(this.renderer)
    this.applyQuality(this.quality.getProfile())
    this.runtimeAntialias.resetAfterContextRestore()
    this.resize()
    this.clock.last = performance.now()
    this.lighting.requestShadowUpdate()
    this.shadowFramesLeft = 3

    const recoveryGeneration = this.modelLoadGeneration
    const reloadEntries = this.contextRecoveryNeedsModelReload && this.manifest
      ? this.models
          .listLayers()
          .map((layer) => this.manifest!.models.find((entry) => entry.id === layer.id))
          .filter((entry): entry is ModelManifestEntry => Boolean(entry))
      : []
    this.contextRecoveryNeedsModelReload = false

    void Promise.race([
      this.renderer.compileAsync(this.scene, this.camera),
      new Promise<void>((resolve) => window.setTimeout(resolve, 8_000)),
    ])
      .catch((err) => console.warn('[Viewer] Shader rebuild after context restore failed', err))
      .then(async () => {
        if (
          reloadEntries.length &&
          !this.disposed &&
          !this.contextLost &&
          this.modelLoadGeneration === recoveryGeneration
        ) {
          await this.loadModelSet(reloadEntries)
        }
      })
      .finally(() => {
        if (!this.disposed && !this.contextLost) {
          this.events.onLoading?.({ stage: 'ready', ratio: 1, message: 'Graphics recovered' })
          this.scheduleCameraViewThumbnails(500)
        }
      })
  }

  resize(): void {
    const canvas = this.renderer.domElement
    const parent = canvas.parentElement
    const w = parent?.clientWidth || window.innerWidth
    const h = parent?.clientHeight || window.innerHeight
    this.camera.aspect = w / Math.max(h, 1)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
    this.runtimeAntialias.resize(w, h, this.renderer.getPixelRatio())
  }

  private readonly tick = (): void => {
    if (this.disposed) return
    const now = performance.now()
    const rawDt = (now - this.clock.last) / 1000
    const dt = Math.min(0.05, rawDt)
    this.clock.last = now

    if (this.contextLost) return

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
    this.runtimeAntialias.render(this.xr.isActive())
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
      const aa = this.runtimeAntialias.getMode(this.xr.isActive())
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
        qualityProfile: `${profile.id} · shadow ${this.lighting.shadows.isEnabled() ? `${this.lighting.shadows.getMapSize()} ${this.lighting.shadows.getFitMode()}` : 'off'} · AA ${aa}`,
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
      this.quality.notePerformance({
        fps: live.avgFps || live.fps,
        rafP95Ms: live.rafP95Ms,
        cpuP95Ms: live.cpuP95Ms,
        gpuP95Ms: live.gpuP95Ms,
        nowMs: now,
        xrActive: live.xrActive,
        xrFrameRate: live.xrFrameRate,
      })
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
    this.queuedStreamFocus = null
    this.activeModelLoad?.controller.abort()
    this.activeModelLoad = null
    this.cancelThumbnailTask()
    if (this.streamSceneRefreshTimer) {
      clearTimeout(this.streamSceneRefreshTimer)
      this.streamSceneRefreshTimer = null
    }
    if (this.contextRestoreTimer) {
      window.clearTimeout(this.contextRestoreTimer)
      this.contextRestoreTimer = null
    }
    this.renderer.setAnimationLoop(null)
    window.removeEventListener('resize', this.onResize)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost)
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored)
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
    this.runtimeAntialias.dispose()
    this.xr.dispose()
    this.renderer.dispose()
  }
}
