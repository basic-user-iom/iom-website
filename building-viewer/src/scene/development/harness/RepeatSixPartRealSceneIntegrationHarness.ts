/** Standalone mutating Vite witness; deliberately absent from production inputs. */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Material,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Object3D,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { ModelAnimationPlayer } from '../../ModelAnimationPlayer'
import { ModelLoader } from '../../ModelLoader'
import { DevelopmentRepeatSixPartPersistentCatalogRendererAdapter } from '../DevelopmentRepeatSixPartPersistentCatalogRendererAdapter'
import { resolveDevelopmentRepeatSixPartProductionRoots } from '../DevelopmentRepeatSixPartProductionRootResolver'
import { DevelopmentRepeatSixPartRealSceneOwnershipBridge } from '../DevelopmentRepeatSixPartRealSceneOwnershipBridge'
import { DevelopmentRepeatSixPartThreeRendererPort } from '../DevelopmentRepeatSixPartThreeRendererPort'
import {
  REPEAT_SIX_PART_REAL_SCENE_ASSETS,
  assertLocalDevelopmentHost,
  loadDormantRealSceneEvidence,
} from './RepeatSixPartRealSceneEvidence'
import {
  disposeExactSixPartTemplateResources,
  exactCatalogBounds,
  exactCatalogManifest,
  extractExactSixPartTemplates,
  loadPinnedExactSixPartGeometry,
} from './RepeatSixPartExactGeometryHarness'
import {
  runDevelopmentRepeatSixPartBoundaryRollbackWitness,
  type DevelopmentRepeatSixPartBoundaryRollbackWitnessEvidence,
} from './RepeatSixPartBoundaryRollbackWitness'
import type { RepeatSixPartActiveListManifestInput, RepeatSixPartVec3 } from '../../RepeatSixPartActiveListPlanner'

const GENERATION = 42_001
const DOMAIN_ID = 'development-local-repeat-six-part-real-scene-integration'
const PREFLIGHT_GENERATION = 42_000
const PREFLIGHT_DOMAIN_ID = 'development-local-repeat-six-part-boundary-rollback-preflight'
const HEADLESS_SOFTWARE_WITNESS = /HeadlessChrome/i.test(navigator.userAgent)
// The interactive route uses a useful steady-state window. SwiftShader smoke
// only proves the transition/counter plumbing; thousands of baseline draws
// make a long software-raster benchmark both slow and non-representative.
const WARMUP_FRAMES = HEADLESS_SOFTWARE_WITNESS ? 2 : 20
const SAMPLE_FRAMES = HEADLESS_SOFTWARE_WITNESS ? 4 : 60

type Ui = Readonly<{
  stage: HTMLElement
  status: HTMLElement
  progress: HTMLProgressElement
  fps: HTMLOutputElement
  modelPin: HTMLElement
  manifestPin: HTMLElement
  attestationPin: HTMLElement
  geometryPin: HTMLElement
  resolverState: HTMLElement
  ownershipState: HTMLElement
  visibleOwner: HTMLElement
  originalRoots: HTMLElement
  replacementLists: HTMLElement
  observerSamples: HTMLElement
  activationAuthority: HTMLElement
  boundaryWitness: HTMLElement
  churnWitness: HTMLElement
  rollbackWitness: HTMLElement
  webgl: HTMLElement
  memory: HTMLElement
  baselineSample: HTMLElement
  replacementSample: HTMLElement
  activeUnits: HTMLElement
  catalogSubmission: HTMLElement
  animation: HTMLElement
  timeline: HTMLInputElement
  play: HTMLButtonElement
  pause: HTMLButtonElement
  stop: HTMLButtonElement
  fit: HTMLButtonElement
}>

type BenchmarkSample = Readonly<{
  averageFrameMs: number
  p95FrameMs: number
  averageRenderMs: number
  calls: number
  triangles: number
  geometries: number
  textures: number
}>

type IntegrationWitness = Readonly<{
  kind: 'repeat-six-part-real-scene-integration-witness'
  state: 'committed-replacement-owner'
  sourceRootIds: readonly string[]
  rootOrdinals: readonly number[]
  attachedOriginalRoots: 4
  visibleOriginalRoots: 0
  catalogMounted: true
  catalogVisible: true
  observerEvidenceReceipts: 7
  activeUnits: number
  activeLists: number
  selectorRollback: DevelopmentRepeatSixPartBoundaryRollbackWitnessEvidence
  currentPhysicalOwner: 'replacement-persistent-catalog'
  ownershipEvidenceStatus: 'observer-receipt-current'
  priorCommittedReceiptInvalidated: false
  emergencyFailCloseReason: null
  activationAuthorized: false
  activationCapability: null
  baseline: BenchmarkSample
  replacement: BenchmarkSample
}>

declare global {
  interface Window {
    __repeatSixPartRealSceneIntegrationWitness?: IntegrationWitness
  }
}

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id)
  if (!value) throw new Error(`Missing development integration element #${id}`)
  return value as T
}

function collectUi(): Ui {
  return Object.freeze({
    stage: element('stage'),
    status: element('status'),
    progress: element<HTMLProgressElement>('progress'),
    fps: element<HTMLOutputElement>('fps'),
    modelPin: element('model-pin'),
    manifestPin: element('manifest-pin'),
    attestationPin: element('attestation-pin'),
    geometryPin: element('geometry-pin'),
    resolverState: element('resolver-state'),
    ownershipState: element('ownership-state'),
    visibleOwner: element('visible-owner'),
    originalRoots: element('original-roots'),
    replacementLists: element('replacement-lists'),
    observerSamples: element('observer-samples'),
    activationAuthority: element('activation-authority'),
    boundaryWitness: element('boundary-witness'),
    churnWitness: element('churn-witness'),
    rollbackWitness: element('rollback-witness'),
    webgl: element('webgl'),
    memory: element('memory'),
    baselineSample: element('baseline-sample'),
    replacementSample: element('replacement-sample'),
    activeUnits: element('active-units'),
    catalogSubmission: element('catalog-submission'),
    animation: element('animation'),
    timeline: element<HTMLInputElement>('timeline'),
    play: element<HTMLButtonElement>('play'),
    pause: element<HTMLButtonElement>('pause'),
    stop: element<HTMLButtonElement>('stop'),
    fit: element<HTMLButtonElement>('fit'),
  })
}

function setStatus(ui: Ui, value: string, state: 'loading' | 'ready' | 'error'): void {
  ui.status.textContent = value
  ui.status.dataset.state = state
}

function shortPin(value: string): string {
  return `${value.slice(0, 12)}...`
}

function writePins(ui: Ui): void {
  const { productionModel, manifest, semanticAttestation, exactGeometry } = REPEAT_SIX_PART_REAL_SCENE_ASSETS
  ui.modelPin.textContent = `${productionModel.bytes.toLocaleString()} B / ${shortPin(productionModel.sha256)}`
  ui.manifestPin.textContent = `${manifest.bytes.toLocaleString()} B / ${shortPin(manifest.sha256)}`
  ui.attestationPin.textContent = `${semanticAttestation.bytes.toLocaleString()} B / ${shortPin(semanticAttestation.sha256)}`
  ui.geometryPin.textContent = `${exactGeometry.bytes.toLocaleString()} B / ${shortPin(exactGeometry.sha256)}`
}

function fitCamera(camera: PerspectiveCamera, controls: OrbitControls, bounds: Box3): void {
  const center = bounds.getCenter(new Vector3())
  const size = bounds.getSize(new Vector3())
  const radius = Math.max(size.length() * 0.5, 1)
  const distance = radius / Math.max(Math.sin(camera.fov * Math.PI / 360), 0.1) * 1.05
  camera.near = Math.max(distance / 10_000, 0.02)
  camera.far = Math.max(distance * 25, 2_000)
  camera.position.set(center.x + distance * 0.68, center.y + distance * 0.48, center.z + distance * 0.68)
  controls.target.copy(center)
  camera.updateProjectionMatrix()
  controls.update()
}

function centerOfBounds(bounds: { min: RepeatSixPartVec3; max: RepeatSixPartVec3 }): RepeatSixPartVec3 {
  return Object.freeze([
    (bounds.min[0] + bounds.max[0]) * 0.5,
    (bounds.min[1] + bounds.max[1]) * 0.5,
    (bounds.min[2] + bounds.max[2]) * 0.5,
  ]) as RepeatSixPartVec3
}

function centralSourceFocus(manifest: RepeatSixPartActiveListManifestInput): RepeatSixPartVec3 {
  const catalogCenter = exactCatalogBounds(manifest).getCenter(new Vector3())
  let closest = manifest.catalog.sources[0]
  let closestDistance = Number.POSITIVE_INFINITY
  for (const source of manifest.catalog.sources) {
    const center = centerOfBounds(source.bounds)
    const distance = new Vector3(...center).distanceToSquared(catalogCenter)
    if (distance < closestDistance) {
      closest = source
      closestDistance = distance
    }
  }
  if (!closest) throw new Error('Exact catalog has no source focus')
  return centerOfBounds(closest.bounds)
}

function focusWitnessBounds(manifest: RepeatSixPartActiveListManifestInput, focus: RepeatSixPartVec3): Box3 {
  const result = new Box3().makeEmpty()
  const margin = manifest.selector.exitMarginMeters
  for (const source of manifest.catalog.sources) {
    const dx = Math.max(source.bounds.min[0] - focus[0], 0, focus[0] - source.bounds.max[0])
    const dy = Math.max(source.bounds.min[1] - focus[1], 0, focus[1] - source.bounds.max[1])
    const dz = Math.max(source.bounds.min[2] - focus[2], 0, focus[2] - source.bounds.max[2])
    if (Math.max(dx, dy, dz) > margin) continue
    result.expandByPoint(new Vector3(...source.bounds.min))
    result.expandByPoint(new Vector3(...source.bounds.max))
  }
  if (result.isEmpty()) result.setFromCenterAndSize(new Vector3(...focus), new Vector3(12, 8, 12))
  return result.expandByScalar(2)
}

function materialTextures(material: Material): readonly Texture[] {
  const textures: Texture[] = []
  for (const value of Object.values(material as Material & Record<string, unknown>)) {
    if (value instanceof Texture) textures.push(value)
  }
  return textures
}

function disposeProductionResources(root: Object3D): void {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  root.traverse((object) => {
    const candidate = object as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] }
    if (candidate.geometry) geometries.add(candidate.geometry)
    const values = candidate.material ? (Array.isArray(candidate.material) ? candidate.material : [candidate.material]) : []
    for (const material of values) {
      materials.add(material)
      for (const texture of materialTextures(material)) textures.add(texture)
    }
  })
  for (const texture of textures) texture.dispose()
  for (const material of materials) material.dispose()
  for (const geometry of geometries) geometry.dispose()
  root.clear()
}

function percentile95(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1)] ?? 0
}

function summarizeSample(
  frameTimes: readonly number[],
  renderTimes: readonly number[],
  renderer: WebGLRenderer,
): BenchmarkSample {
  const average = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
  return Object.freeze({
    averageFrameMs: average(frameTimes),
    p95FrameMs: percentile95(frameTimes),
    averageRenderMs: average(renderTimes),
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  })
}

function sampleText(sample: BenchmarkSample): string {
  return `${sample.averageFrameMs.toFixed(2)} ms avg / ${sample.p95FrameMs.toFixed(2)} ms p95 / ${sample.calls.toLocaleString()} calls / ${sample.triangles.toLocaleString()} tris`
}

async function main(): Promise<void> {
  assertLocalDevelopmentHost(location.hostname)
  const ui = collectUi()
  writePins(ui)
  setStatus(ui, 'Verifying dormant evidence and pinned exact geometry...', 'loading')
  const evidence = await loadDormantRealSceneEvidence()
  const manifest = exactCatalogManifest(evidence)

  const scene = new Scene()
  scene.background = new Color(0xa6b6c3)
  const camera = new PerspectiveCamera(48, 1, 0.05, 5_000)
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.04
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35))
  ui.stage.append(renderer.domElement)

  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04)
  room.dispose()
  pmrem.dispose()
  scene.environment = environment.texture
  scene.add(new HemisphereLight(0xd9ecff, 0x5b5349, 1.15))
  scene.add(new AmbientLight(0xffffff, 0.35))
  const sun = new DirectionalLight(0xfff0d2, 2.15)
  sun.position.set(75, 120, 55)
  scene.add(sun)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.075
  const loader = new ModelLoader(() => renderer)
  setStatus(ui, 'Downloading the pinned 97.55 MB production GLB and exact catalog...', 'loading')
  const [result, exactGltf] = await Promise.all([
    loader.loadUrlVerified(
      evidence.modelPin.url,
      { bytes: evidence.modelPin.bytes, sha256: evidence.modelPin.sha256 },
      (progress) => {
        setStatus(ui, progress.message, 'loading')
        if (progress.ratio === null) ui.progress.removeAttribute('value')
        else ui.progress.value = Math.max(0, Math.min(1, progress.ratio))
      },
    ),
    loadPinnedExactSixPartGeometry(REPEAT_SIX_PART_REAL_SCENE_ASSETS.exactGeometry),
  ])
  result.root.userData.layerId = 'icm-anim-2025'
  result.root.userData.streaming = false
  const resolution = resolveDevelopmentRepeatSixPartProductionRoots(result.root)
  ui.resolverState.textContent = 'issued / exact roots 258-261'
  scene.add(result.root)

  const templates = extractExactSixPartTemplates(exactGltf, manifest)
  setStatus(ui, 'Proving exact selector boundaries, rapid sequential churn, and physical rollback before ownership handoff...', 'loading')
  const preflightStage = new Group()
  preflightStage.name = 'DEV ONLY - detached selector rollback preflight'
  const preflightPort = new DevelopmentRepeatSixPartThreeRendererPort({
    generation: PREFLIGHT_GENERATION,
    parent: preflightStage,
    parityHostMatrices: {
      positive: manifest.parity.hosts.positive.matrix,
      mirrored: manifest.parity.hosts.mirrored.matrix,
    },
    templates,
  })
  const preflightFallbackReasons: string[] = []
  const preflightAdapter = new DevelopmentRepeatSixPartPersistentCatalogRendererAdapter({
    generation: PREFLIGHT_GENERATION,
    domainId: PREFLIGHT_DOMAIN_ID,
    manifest,
    renderer: preflightPort,
    monolithicFallback: Object.freeze({
      activateMonolithicFallback: (reason: { code: string }): void => {
        preflightStage.visible = false
        preflightFallbackReasons.push(reason.code)
      },
    }),
  })
  const selectorRollback = await (async (): Promise<DevelopmentRepeatSixPartBoundaryRollbackWitnessEvidence> => {
    try {
      return await runDevelopmentRepeatSixPartBoundaryRollbackWitness({
        generation: PREFLIGHT_GENERATION,
        manifest,
        adapter: preflightAdapter,
        rendererPort: preflightPort,
      })
    } finally {
      await preflightAdapter.dispose()
    }
  })()
  if (preflightFallbackReasons.length !== 0) {
    throw new Error(`Detached selector preflight unexpectedly requested fallback: ${preflightFallbackReasons.join(', ')}`)
  }
  ui.boundaryWitness.textContent = `${selectorRollback.boundarySteps.length}/9 steps / closed 3.5 m in, 5.5 m out`
  ui.churnWitness.textContent = `${selectorRollback.rapidSequentialChurn.updates} sequential / ${selectorRollback.rapidSequentialChurn.committed} commits / ${selectorRollback.rapidSequentialChurn.noOp} no-op`
  ui.rollbackWitness.textContent = `cancelled after publish / 48/48 lists restored / identities retained / renderer +${selectorRollback.afterPublishCancellation.rendererRevisionAdvance}`

  const catalogStage = new Group()
  catalogStage.name = 'DEV ONLY - atomic repeat-six-part catalog gate'
  catalogStage.visible = false
  catalogStage.userData.developmentOnly = true
  const port = new DevelopmentRepeatSixPartThreeRendererPort({
    generation: GENERATION,
    parent: catalogStage,
    parityHostMatrices: {
      positive: manifest.parity.hosts.positive.matrix,
      mirrored: manifest.parity.hosts.mirrored.matrix,
    },
    templates,
  })

  let bridge: DevelopmentRepeatSixPartRealSceneOwnershipBridge | null = null
  const fallback = Object.freeze({
    activateMonolithicFallback: (reason: { code: string }): void => {
      if (bridge) bridge.failClosedToOriginals(`Adapter fail-stop: ${reason.code}`)
      else {
        catalogStage.visible = false
        catalogStage.removeFromParent()
      }
    },
  })
  const adapter = new DevelopmentRepeatSixPartPersistentCatalogRendererAdapter({
    generation: GENERATION,
    domainId: DOMAIN_ID,
    manifest,
    renderer: port,
    monolithicFallback: fallback,
  })
  const focus = centralSourceFocus(manifest)
  const initialUpdate = await adapter.updateFocus({
    generation: GENERATION,
    focus: { space: 'owner-local', point: focus },
  })
  if (initialUpdate.kind !== 'committed' || initialUpdate.snapshot.counters.activeUnits < 1) {
    throw new Error('Initial exact-catalog publication did not produce a non-empty committed selection')
  }
  bridge = new DevelopmentRepeatSixPartRealSceneOwnershipBridge({
    generation: GENERATION,
    resolution,
    adapter,
    rendererPort: port,
    catalogStage,
  })

  const witnessBounds = focusWitnessBounds(manifest, focus)
  fitCamera(camera, controls, witnessBounds)
  ui.activeUnits.textContent = `${initialUpdate.snapshot.counters.activeUnits.toLocaleString()} / 468`
  ui.catalogSubmission.textContent = `${initialUpdate.snapshot.counters.submittedDraws.toLocaleString()} draws / ${initialUpdate.snapshot.counters.submittedTriangles.toLocaleString()} tris`
  ui.replacementLists.textContent = `${initialUpdate.snapshot.counters.activeLists} active / 48 persistent`
  ui.activationAuthority.textContent = 'absent (false / null)'

  const animation = new ModelAnimationPlayer()
  animation.bind(result.root, result.animations, {
    autoPlay: false,
    loop: false,
    label: 'ICM 2025 embedded animation',
    stateKey: REPEAT_SIX_PART_REAL_SCENE_ASSETS.productionModel.sha256,
  })
  const duration = animation.getDuration()
  ui.timeline.max = String(Math.max(duration, 0))
  ui.timeline.disabled = !animation.isAvailable()
  ui.play.disabled = !animation.isAvailable()
  ui.pause.disabled = !animation.isAvailable()
  ui.stop.disabled = !animation.isAvailable()
  ui.play.addEventListener('click', () => animation.play())
  ui.pause.addEventListener('click', () => animation.pause())
  ui.stop.addEventListener('click', () => animation.stop())
  ui.timeline.addEventListener('input', () => animation.seek(Number(ui.timeline.value)))
  ui.fit.addEventListener('click', () => fitCamera(camera, controls, witnessBounds))

  const resize = (): void => {
    const width = Math.max(ui.stage.clientWidth, 1)
    const height = Math.max(ui.stage.clientHeight, 1)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(ui.stage)
  resize()

  let phase: 'baseline-warmup' | 'baseline-sample' | 'replacement-warmup' | 'replacement-sample' | 'complete' = 'baseline-warmup'
  let phaseFrames = 0
  let frameTimes: number[] = []
  let renderTimes: number[] = []
  let baseline: BenchmarkSample | null = null
  let replacement: BenchmarkSample | null = null
  let lastFrameAt = performance.now()
  let fpsFrames = 0
  let fpsStartedAt = lastFrameAt
  const clock = new Clock()
  ui.ownershipState.textContent = 'original baseline'
  setStatus(ui, 'Measuring the original-root baseline before the one-way local handoff...', 'loading')
  document.documentElement.dataset.realSceneIntegrationHarness = 'measuring-baseline'

  const failRuntime = (error: unknown): void => {
    renderer.setAnimationLoop(null)
    delete window.__repeatSixPartRealSceneIntegrationWitness
    let message = error instanceof Error ? error.stack ?? error.message : String(error)
    if (bridge) {
      try {
        const restored = bridge.failClosedToOriginals('Real-scene harness runtime failure')
        message += `\nFail-closed physical owner: ${restored.currentPhysicalOwner}`
      } catch (restorationError) {
        const restorationMessage = restorationError instanceof Error
          ? restorationError.stack ?? restorationError.message
          : String(restorationError)
        message += `\nEMERGENCY RESTORATION FAILED: ${restorationMessage}`
      }
    }
    setStatus(ui, message, 'error')
    document.documentElement.dataset.realSceneIntegrationHarness = 'error'
  }

  renderer.setAnimationLoop((now) => {
    try {
      const frameMs = Math.min(now - lastFrameAt, 1_000)
      lastFrameAt = now
      const delta = Math.min(clock.getDelta(), 0.1)
      animation.update(delta)
      controls.update()
      const renderStartedAt = performance.now()
      renderer.render(scene, camera)
      const renderMs = performance.now() - renderStartedAt

      fpsFrames += 1
      const fpsElapsed = now - fpsStartedAt
      if (fpsElapsed >= 500) {
        ui.fps.textContent = `${Math.round(fpsFrames * 1_000 / fpsElapsed)} FPS`
        fpsFrames = 0
        fpsStartedAt = now
      }
      ui.webgl.textContent = `${renderer.info.render.calls.toLocaleString()} calls / ${renderer.info.render.triangles.toLocaleString()} triangles`
      ui.memory.textContent = `${renderer.info.memory.geometries.toLocaleString()} geometries / ${renderer.info.memory.textures.toLocaleString()} textures`
      const animationState = animation.getState()
      ui.timeline.value = String(animationState.time)
      ui.animation.textContent = animationState.available
        ? `${animation.clipCount()} clip${animation.clipCount() === 1 ? '' : 's'} / ${animationState.time.toFixed(3)} of ${animationState.duration.toFixed(3)} s / ${animationState.playing ? 'playing' : 'paused'}`
        : 'No embedded animation'

      if (phase === 'complete') return
      phaseFrames += 1
      const warming = phase === 'baseline-warmup' || phase === 'replacement-warmup'
      if (warming) {
        if (phaseFrames < WARMUP_FRAMES) return
        phase = phase === 'baseline-warmup' ? 'baseline-sample' : 'replacement-sample'
        phaseFrames = 0
        frameTimes = []
        renderTimes = []
        return
      }
      frameTimes.push(frameMs)
      renderTimes.push(renderMs)
      if (phaseFrames < SAMPLE_FRAMES) return

      const completed = summarizeSample(frameTimes, renderTimes, renderer)
      if (phase === 'baseline-sample') {
        baseline = completed
        ui.baselineSample.textContent = sampleText(completed)
        const committed = bridge!.commit()
        if (
          committed.state !== 'committed-replacement-owner' ||
          !committed.retainedRootsAttachedAtExactOrdinals ||
          committed.retainedRootAttachedCount !== 4 ||
          committed.retainedRootRendererVisibleCount !== 0 ||
          !committed.catalogStageMountedUnderActiveScene ||
          !committed.catalogVisible ||
          committed.evidenceReceiptCount !== 7 ||
          committed.currentPhysicalOwner !== 'replacement-persistent-catalog' ||
          committed.ownershipEvidenceStatus !== 'observer-receipt-current' ||
          committed.priorCommittedReceiptInvalidated !== false ||
          committed.emergencyFailCloseReason !== null ||
          committed.activationAuthorized !== false ||
          committed.activationCapability !== null
        ) throw new Error('Atomic bridge did not prove the exact replacement-only committed state')
        ui.ownershipState.textContent = `committed / revision ${committed.handoff.ownershipRevision}`
        ui.visibleOwner.textContent = 'replacement persistent catalog'
        ui.originalRoots.textContent = '4 attached / 0 renderer-visible'
        ui.observerSamples.textContent = `${committed.evidenceReceiptCount} accepted`
        phase = 'replacement-warmup'
        phaseFrames = 0
        frameTimes = []
        renderTimes = []
        document.documentElement.dataset.realSceneIntegrationHarness = 'measuring-replacement'
        setStatus(ui, 'Atomic handoff committed. Warming GPU buffers before the replacement sample...', 'loading')
        return
      }

      replacement = completed
      ui.replacementSample.textContent = sampleText(completed)
      const committed = bridge!.getSnapshot()
      const adapterSnapshot = adapter.getSnapshot()
      const witness: IntegrationWitness = Object.freeze({
        kind: 'repeat-six-part-real-scene-integration-witness' as const,
        state: 'committed-replacement-owner' as const,
        sourceRootIds: Object.freeze([...committed.sourceRootIds]),
        rootOrdinals: Object.freeze([...committed.retainedRootOrdinals]),
        attachedOriginalRoots: committed.retainedRootAttachedCount as 4,
        visibleOriginalRoots: committed.retainedRootRendererVisibleCount as 0,
        catalogMounted: committed.catalogStageMountedUnderActiveScene as true,
        catalogVisible: committed.catalogVisible as true,
        observerEvidenceReceipts: committed.evidenceReceiptCount as 7,
        activeUnits: adapterSnapshot.counters.activeUnits,
        activeLists: adapterSnapshot.counters.activeLists,
        selectorRollback,
        currentPhysicalOwner: committed.currentPhysicalOwner as 'replacement-persistent-catalog',
        ownershipEvidenceStatus: committed.ownershipEvidenceStatus as 'observer-receipt-current',
        priorCommittedReceiptInvalidated: committed.priorCommittedReceiptInvalidated as false,
        emergencyFailCloseReason: committed.emergencyFailCloseReason as null,
        activationAuthorized: false as const,
        activationCapability: null,
        baseline: baseline!,
        replacement,
      })
      window.__repeatSixPartRealSceneIntegrationWitness = witness
      phase = 'complete'
      ui.progress.value = 1
      setStatus(
        ui,
        `ATOMIC REAL-SCENE WITNESS PASS\n9/9 exact boundary steps, 16 rapid sequential updates, and 48/48-list rollback passed.\n7/7 ownership samples accepted; exact roots remain attached at 258-261 and renderer-hidden.\nactivationAuthorized=false; production routing unchanged.`,
        'ready',
      )
      document.documentElement.dataset.realSceneIntegrationHarness = 'ready-atomic-integration'
    } catch (error) {
      failRuntime(error)
    }
  })

  window.addEventListener('beforeunload', () => {
    renderer.setAnimationLoop(null)
    resizeObserver.disconnect()
    animation.dispose()
    controls.dispose()
    const teardown = bridge?.teardownForBeforeUnload() ?? adapter.dispose()
    void teardown.finally(() => {
      disposeExactSixPartTemplateResources(templates)
      scene.remove(result.root)
      disposeProductionResources(result.root)
      environment.dispose()
      loader.dispose()
      renderer.dispose()
    })
  }, { once: true })
}

void main().catch((error) => {
  const ui = collectUi()
  ui.progress.removeAttribute('value')
  setStatus(ui, error instanceof Error ? error.stack ?? error.message : String(error), 'error')
  document.documentElement.dataset.realSceneIntegrationHarness = 'error'
})
