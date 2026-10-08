/** Standalone Vite development page; deliberately absent from build inputs. */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import {
  DevelopmentRepeatSixPartPersistentCatalogRendererAdapter,
  type DevelopmentRepeatSixPartPersistentCatalogAdapterSnapshot,
} from '../DevelopmentRepeatSixPartPersistentCatalogRendererAdapter'
import {
  DevelopmentRepeatSixPartThreeMonolithicFallbackVisibility,
  DevelopmentRepeatSixPartThreeRendererPort,
  type DevelopmentRepeatSixPartThreeGeometryTemplate,
} from '../DevelopmentRepeatSixPartThreeRendererPort'
import type {
  RepeatSixPartActiveListManifestInput,
  RepeatSixPartBounds,
  RepeatSixPartVec3,
} from '../../RepeatSixPartActiveListPlanner'

const MANIFEST_URL = '/tmp/repeat-six-part-cohort-v4/manifest-v4.disabled.json'
const MANIFEST_BYTES = 378_244
const MANIFEST_SHA256 = '98a7d17634fd4bd524dfbf926eeb8aae23b7abeb93267f0a132adaedbf45fb4b'
const GENERATION = 40_001
const DOMAIN_ID = 'development-local-repeat-six-part-visual-witness'

type DormantHarnessManifest = RepeatSixPartActiveListManifestInput & Readonly<{
  schema: 'IOM_REPEAT_SIX_PART_EXACT_COHORT_MANIFEST_V4'
  version: 4
  enabled: false
  modelId: 'icm-anim-2025'
  capabilities: Readonly<{
    persistentCatalog: true
    exactGeometry: true
    stableLogicalIdentity: true
    compactInstancing: true
    hlodSwaps: false
    quest: false
  }>
  payloads: Readonly<{
    geometry: Readonly<{
      order: 0
      role: 'exact-six-segment-geometry'
      mediaType: 'model/gltf-binary'
      url: string
      bytes: number
      sha256: string
    }>
  }>
  gates: Readonly<{
    exactGeometryPassed: true
    identityAndParityPassed: true
    transitionBudgetPassed: false
    runtimeIntegrationPassed: false
    runtimeConcurrencyPassed: false
    browserVisualWitnessPassed: false
    measuredPerformancePassed: false
    activationApproved: false
  }>
}>

type Axis = 'x' | 'y' | 'z'

type Ui = Readonly<{
  stage: HTMLElement
  status: HTMLElement
  fps: HTMLOutputElement
  persistentLists: HTMLElement
  inputUnits: HTMLElement
  activeUnits: HTMLElement
  activeLists: HTMLElement
  submittedDraws: HTMLElement
  submittedTriangles: HTMLElement
  catalogRevision: HTMLElement
  webglCounters: HTMLElement
  ranges: Readonly<Record<Axis, HTMLInputElement>>
  numbers: Readonly<Record<Axis, HTMLInputElement>>
  showCatalog: HTMLButtonElement
  showReference: HTMLButtonElement
  fitCamera: HTMLButtonElement
  testFailover: HTMLButtonElement
}>

type LocalVisualReference = Readonly<{
  root: Group
  segmentByUnitKey: ReadonlyMap<string, Object3D>
}>

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id)
  if (!value) throw new Error(`Missing development harness element #${id}`)
  return value as T
}

function collectUi(): Ui {
  return Object.freeze({
    stage: element('stage'),
    status: element('status'),
    fps: element<HTMLOutputElement>('fps'),
    persistentLists: element('persistent-lists'),
    inputUnits: element('input-units'),
    activeUnits: element('active-units'),
    activeLists: element('active-lists'),
    submittedDraws: element('submitted-draws'),
    submittedTriangles: element('submitted-triangles'),
    catalogRevision: element('catalog-revision'),
    webglCounters: element('webgl-counters'),
    ranges: Object.freeze({
      x: element<HTMLInputElement>('focus-x'),
      y: element<HTMLInputElement>('focus-y'),
      z: element<HTMLInputElement>('focus-z'),
    }),
    numbers: Object.freeze({
      x: element<HTMLInputElement>('focus-x-number'),
      y: element<HTMLInputElement>('focus-y-number'),
      z: element<HTMLInputElement>('focus-z-number'),
    }),
    showCatalog: element<HTMLButtonElement>('show-catalog'),
    showReference: element<HTMLButtonElement>('show-reference'),
    fitCamera: element<HTMLButtonElement>('fit-camera'),
    testFailover: element<HTMLButtonElement>('test-failover'),
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateDormantManifest(value: unknown): DormantHarnessManifest {
  if (!isRecord(value)) throw new Error('Manifest is not an object')
  const capabilities = value.capabilities
  const payloads = value.payloads
  const geometryPayload = isRecord(payloads) ? payloads.geometry : null
  const geometry = value.geometry
  const parity = value.parity
  const catalog = value.catalog
  const gates = value.gates
  if (
    value.schema !== 'IOM_REPEAT_SIX_PART_EXACT_COHORT_MANIFEST_V4' || value.version !== 4 ||
    value.enabled !== false || value.modelId !== 'icm-anim-2025' ||
    !isRecord(capabilities) || capabilities.persistentCatalog !== true ||
    capabilities.exactGeometry !== true || capabilities.stableLogicalIdentity !== true ||
    capabilities.compactInstancing !== true || capabilities.hlodSwaps !== false || capabilities.quest !== false ||
    !isRecord(gates) || gates.exactGeometryPassed !== true || gates.identityAndParityPassed !== true ||
    gates.transitionBudgetPassed !== false || gates.runtimeIntegrationPassed !== false ||
    gates.runtimeConcurrencyPassed !== false || gates.browserVisualWitnessPassed !== false ||
    gates.measuredPerformancePassed !== false ||
    gates.activationApproved !== false ||
    !isRecord(geometry) || geometry.materialSlots !== 4 || !Array.isArray(geometry.segments) || geometry.segments.length !== 6 ||
    !isRecord(parity) || parity.persistentRendererTemplates !== 48 ||
    !isRecord(catalog) || !Array.isArray(catalog.sources) || catalog.sources.length !== 78 ||
    !Array.isArray(catalog.units) || catalog.units.length !== 468 ||
    !isRecord(geometryPayload) || geometryPayload.order !== 0 ||
    geometryPayload.role !== 'exact-six-segment-geometry' || geometryPayload.mediaType !== 'model/gltf-binary' ||
    typeof geometryPayload.url !== 'string' || !geometryPayload.url.startsWith('/tmp/repeat-six-part-exact-pilot/') ||
    !Number.isSafeInteger(geometryPayload.bytes) || typeof geometryPayload.sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(geometryPayload.sha256)
  ) {
    throw new Error('Manifest is not the approved, disabled 78 × 6 exact development cohort')
  }
  return value as unknown as DormantHarnessManifest
}

function status(ui: Ui, message: string, state: 'loading' | 'ready' | 'error' = 'loading'): void {
  ui.status.textContent = message
  ui.status.dataset.state = state
}

async function loadManifest(): Promise<DormantHarnessManifest> {
  const response = await fetch(MANIFEST_URL, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Missing ignored v4 manifest (${response.status}). Run the prerequisite evidence command.`)
  }
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength !== MANIFEST_BYTES) {
    throw new Error(`Disabled v4 manifest byte mismatch: ${bytes.byteLength} !== ${MANIFEST_BYTES}`)
  }
  const digest = await digestHex(bytes)
  if (digest !== MANIFEST_SHA256) throw new Error(`Disabled v4 manifest SHA-256 mismatch: ${digest}`)
  let decoded: unknown
  try {
    decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch (error) {
    throw new Error('Pinned disabled v4 manifest is not valid UTF-8 JSON', { cause: error })
  }
  return validateDormantManifest(decoded)
}

function digestHex(value: ArrayBuffer): Promise<string> {
  return crypto.subtle.digest('SHA-256', value).then((digest) =>
    [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''))
}

async function loadPinnedGeometry(manifest: DormantHarnessManifest): Promise<GLTF> {
  const pin = manifest.payloads.geometry
  const response = await fetch(pin.url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Exact shared GLB is unavailable (${response.status})`)
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength !== pin.bytes) {
    throw new Error(`Exact shared GLB byte mismatch: ${bytes.byteLength} !== ${pin.bytes}`)
  }
  const digest = await digestHex(bytes)
  if (digest !== pin.sha256) throw new Error(`Exact shared GLB SHA-256 mismatch: ${digest}`)
  const baseUrl = new URL('.', new URL(pin.url, window.location.href)).href
  return new GLTFLoader().parseAsync(bytes, baseUrl)
}

function geometryTriangles(geometry: BufferGeometry): number {
  const count = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0
  return count / 3
}

function extractTemplates(
  gltf: GLTF,
  manifest: DormantHarnessManifest,
): readonly DevelopmentRepeatSixPartThreeGeometryTemplate[] {
  const templates: DevelopmentRepeatSixPartThreeGeometryTemplate[] = []
  const expectedMaterialNames: string[] = []
  const identity = new Matrix4()
  gltf.scene.updateMatrixWorld(true)

  for (const segment of manifest.geometry.segments) {
    const segmentRoot = gltf.scene.children.find((child) => child.userData.segment === segment.index)
    if (!segmentRoot || !segmentRoot.matrix.equals(identity)) {
      throw new Error(`Exact GLB segment ${segment.index} is missing or has an unmodeled node transform`)
    }
    const meshes: Mesh<BufferGeometry, Material | Material[]>[] = []
    segmentRoot.traverse((object) => {
      if (!object.matrix.equals(identity) || !object.matrixWorld.equals(identity)) {
        throw new Error(`Exact GLB segment ${segment.index} contains an unmodeled intermediate transform`)
      }
      if (object instanceof Mesh) meshes.push(object as Mesh<BufferGeometry, Material | Material[]>)
    })
    if (meshes.length !== 4) throw new Error(`Exact GLB segment ${segment.index} does not have four primitives`)

    let observedTriangles = 0
    meshes.forEach((mesh, materialIndex) => {
      if (Array.isArray(mesh.material) || !mesh.matrix.equals(identity)) {
        throw new Error(`Exact GLB segment ${segment.index} material ${materialIndex} is not a direct primitive`)
      }
      const materialName = mesh.material.name
      if (segment.index === 0) expectedMaterialNames.push(materialName)
      else if (materialName !== expectedMaterialNames[materialIndex]) {
        throw new Error(`Material slot ${materialIndex} changes between exact GLB segments`)
      }
      observedTriangles += geometryTriangles(mesh.geometry)
      templates.push(Object.freeze({ segmentIndex: segment.index, materialIndex, geometry: mesh.geometry, material: mesh.material }))
    })
    if (observedTriangles !== segment.triangles) {
      throw new Error(`Exact GLB segment ${segment.index} triangle mismatch: ${observedTriangles} !== ${segment.triangles}`)
    }
  }
  if (templates.length !== 24) throw new Error('Exact GLB did not produce the required 24 templates')
  return Object.freeze(templates)
}

function buildNonInstancedReference(gltf: GLTF, manifest: DormantHarnessManifest): LocalVisualReference {
  const root = new Group()
  root.name = 'DEV ONLY — local non-instanced exact visual reference'
  root.userData.developmentOnly = true
  root.userData.visualReferenceOnly = true
  root.userData.productionOwnershipIntegrated = false
  const rowBySourceId = new Map<string, Group>()
  const segmentRootByIndex = new Map<number, Object3D>()
  const segmentByUnitKey = new Map<string, Object3D>()
  for (const child of gltf.scene.children) {
    const segmentIndex = child.userData.segment
    if (Number.isInteger(segmentIndex)) segmentRootByIndex.set(segmentIndex, child)
  }
  for (const source of manifest.catalog.sources) {
    const row = new Group()
    row.name = `visual-reference:${source.id}`
    row.matrixAutoUpdate = false
    row.matrix.fromArray(source.canonicalMatrix.matrix)
    row.userData.sourceId = source.id
    row.userData.sourcePathEvidence = source.path
    root.add(row)
    rowBySourceId.set(source.id, row)
  }
  for (const unit of manifest.catalog.units) {
    const row = rowBySourceId.get(unit.sourceId)
    const segmentRoot = segmentRootByIndex.get(unit.segmentIndex)
    if (!row || !segmentRoot || segmentByUnitKey.has(unit.id)) {
      throw new Error(`Cannot assemble exact local reference unit ${unit.id}`)
    }
    const segment = segmentRoot.clone(true)
    segment.name = `visual-reference:${unit.id}`
    segment.visible = false
    segment.userData.unitKey = unit.id
    row.add(segment)
    segmentByUnitKey.set(unit.id, segment)
  }
  if (segmentByUnitKey.size !== 468) throw new Error('Local exact reference must contain 468 independently selectable units')
  return Object.freeze({ root, segmentByUnitKey })
}

function setReferenceSelection(
  reference: LocalVisualReference,
  activeUnitKeys: ReadonlySet<string> | null,
): void {
  for (const [unitKey, segment] of reference.segmentByUnitKey) {
    segment.visible = activeUnitKeys === null || activeUnitKeys.has(unitKey)
  }
}

function syncReferenceToCatalog(
  reference: LocalVisualReference,
  port: DevelopmentRepeatSixPartThreeRendererPort,
  expectedActiveUnits: number,
): void {
  const activeUnitKeys = new Set<string>()
  port.root.traverse((object) => {
    const mappings: unknown = object.userData.activeSlotToUnit
    if (!Array.isArray(mappings)) return
    for (const mapping of mappings) {
      if (typeof mapping?.unitKey !== 'string' || !reference.segmentByUnitKey.has(mapping.unitKey)) {
        throw new Error('Published exact catalog contains an unknown local-reference unit')
      }
      activeUnitKeys.add(mapping.unitKey)
    }
  })
  if (activeUnitKeys.size !== expectedActiveUnits) {
    throw new Error(`Reference/catalog selection mismatch: ${activeUnitKeys.size} !== ${expectedActiveUnits}`)
  }
  setReferenceSelection(reference, activeUnitKeys)
}

function disposeExactResources(templates: readonly DevelopmentRepeatSixPartThreeGeometryTemplate[]): void {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  for (const template of templates) {
    geometries.add(template.geometry)
    materials.add(template.material)
  }
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
}

function catalogBounds(manifest: DormantHarnessManifest): Box3 {
  const box = new Box3().makeEmpty()
  for (const source of manifest.catalog.sources) {
    box.expandByPoint(new Vector3(...source.bounds.min))
    box.expandByPoint(new Vector3(...source.bounds.max))
  }
  if (box.isEmpty()) throw new Error('Manifest catalog bounds are empty')
  return box
}

function centerOfBounds(bounds: RepeatSixPartBounds): RepeatSixPartVec3 {
  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ]
}

function fitCamera(camera: PerspectiveCamera, controls: OrbitControls, bounds: Box3): void {
  const center = bounds.getCenter(new Vector3())
  const size = bounds.getSize(new Vector3())
  const radius = Math.max(size.length() / 2, 1)
  const verticalFov = camera.fov * Math.PI / 180
  const distance = radius / Math.max(Math.sin(verticalFov / 2), 0.1) * 1.12
  camera.near = Math.max(distance / 2_000, 0.01)
  camera.far = distance * 12
  camera.position.set(center.x + distance * 0.62, center.y + distance * 0.46, center.z + distance * 0.62)
  controls.target.copy(center)
  camera.updateProjectionMatrix()
  controls.update()
}

function configureFocusInputs(ui: Ui, bounds: Box3, initial: RepeatSixPartVec3): void {
  const padding = Math.max(bounds.getSize(new Vector3()).length() * 0.08, 2)
  const axes: readonly Axis[] = ['x', 'y', 'z']
  axes.forEach((axis, index) => {
    const min = bounds.min.getComponent(index) - padding
    const max = bounds.max.getComponent(index) + padding
    for (const input of [ui.ranges[axis], ui.numbers[axis]]) {
      input.min = min.toFixed(2)
      input.max = max.toFixed(2)
      input.value = initial[index].toFixed(2)
    }
  })
}

function writeFocusInputs(ui: Ui, point: RepeatSixPartVec3): void {
  const axes: readonly Axis[] = ['x', 'y', 'z']
  axes.forEach((axis, index) => {
    const value = point[index].toFixed(2)
    ui.ranges[axis].value = value
    ui.numbers[axis].value = value
  })
}

function readFocusInputs(ui: Ui): RepeatSixPartVec3 {
  return ['x', 'y', 'z'].map((axis) => Number(ui.numbers[axis as Axis].value)) as unknown as RepeatSixPartVec3
}

function writeSnapshot(ui: Ui, snapshot: DevelopmentRepeatSixPartPersistentCatalogAdapterSnapshot): void {
  const counters = snapshot.counters
  ui.persistentLists.textContent = counters.persistentLists.toLocaleString()
  ui.inputUnits.textContent = counters.selectionInputUnits.toLocaleString()
  ui.activeUnits.textContent = `${counters.activeUnits.toLocaleString()} / ${counters.culledUnits.toLocaleString()}`
  ui.activeLists.textContent = `${counters.activeLists.toLocaleString()} / ${counters.hiddenLists.toLocaleString()}`
  ui.submittedDraws.textContent = counters.submittedDraws.toLocaleString()
  ui.submittedTriangles.textContent = counters.submittedTriangles.toLocaleString()
  ui.catalogRevision.textContent = `${snapshot.plannerRevision} / renderer ${snapshot.rendererRevision}`
}

async function main(): Promise<void> {
  const ui = collectUi()
  status(ui, 'Loading disabled manifest…')
  const manifest = await loadManifest()
  status(ui, 'Verifying pinned exact shared GLB…')
  const gltf = await loadPinnedGeometry(manifest)
  const templates = extractTemplates(gltf, manifest)

  const scene = new Scene()
  scene.background = new Color(0x9cabba)
  const camera = new PerspectiveCamera(48, 1, 0.05, 2_000)
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  ui.stage.append(renderer.domElement)

  const pmrem = new (await import('three')).PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04)
  scene.environment = environment.texture
  room.dispose()
  pmrem.dispose()

  scene.add(new HemisphereLight(0xcfe4ff, 0x504b42, 1.25))
  scene.add(new AmbientLight(0xffffff, 0.45))
  const sun = new DirectionalLight(0xfff2d6, 2.4)
  sun.position.set(50, 80, 30)
  scene.add(sun)

  const ownerRoot = new Group()
  ownerRoot.name = 'DEV ONLY — identity owner-local witness root'
  ownerRoot.userData.productionOwnershipIntegrated = false
  scene.add(ownerRoot)

  const reference = buildNonInstancedReference(gltf, manifest)
  ownerRoot.add(reference.root)
  const port = new DevelopmentRepeatSixPartThreeRendererPort({
    generation: GENERATION,
    parent: ownerRoot,
    parityHostMatrices: {
      positive: manifest.parity.hosts.positive.matrix,
      mirrored: manifest.parity.hosts.mirrored.matrix,
    },
    templates,
  })
  const fallback = new DevelopmentRepeatSixPartThreeMonolithicFallbackVisibility({
    exactCatalogRoot: port.root,
    localNonInstancedReferenceRoot: reference.root,
    onActivated: (reason) => {
      // Fail-stop restores the complete 78 × 6 non-instanced baseline. Normal
      // preview toggles remain selection-matched to the latest publication.
      setReferenceSelection(reference, null)
      ui.showCatalog.setAttribute('aria-pressed', 'false')
      ui.showReference.setAttribute('aria-pressed', 'true')
      ui.showCatalog.disabled = true
      ui.testFailover.disabled = true
      status(ui, `FAIL-STOP ${reason.code}\nNon-instanced exact reference is visible. Reload to reconstruct the catalog.`, 'error')
    },
  })
  const adapter = new DevelopmentRepeatSixPartPersistentCatalogRendererAdapter({
    generation: GENERATION,
    domainId: DOMAIN_ID,
    manifest,
    renderer: port,
    monolithicFallback: fallback,
  })

  const bounds = catalogBounds(manifest)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.075
  fitCamera(camera, controls, bounds)

  const size = bounds.getSize(new Vector3())
  const gridSize = Math.max(size.x, size.z) * 1.35
  const grid = new GridHelper(gridSize, Math.max(20, Math.round(gridSize / 2)), 0x566675, 0x73808d)
  grid.position.set(bounds.getCenter(new Vector3()).x, bounds.min.y - 0.025, bounds.getCenter(new Vector3()).z)
  scene.add(grid)

  const initialFocus = centerOfBounds(manifest.catalog.sources[0].bounds)
  configureFocusInputs(ui, bounds, initialFocus)
  const markerRadius = Math.max(gridSize * 0.006, 0.22)
  const focusMarker = new Mesh(
    new SphereGeometry(markerRadius, 20, 12),
    new MeshBasicMaterial({ color: 0xe253ff, depthTest: false }),
  )
  focusMarker.name = 'owner-local focus marker'
  focusMarker.renderOrder = 1_000
  focusMarker.position.fromArray(initialFocus)
  scene.add(focusMarker)

  let requestedFocus: RepeatSixPartVec3 | null = initialFocus
  let applyingFocus = false
  let lastAppliedFocus: RepeatSixPartVec3 = initialFocus
  const applyLatestFocus = async (): Promise<void> => {
    if (applyingFocus) return
    applyingFocus = true
    try {
      while (requestedFocus) {
        const next = requestedFocus
        requestedFocus = null
        const result = await adapter.updateFocus({
          generation: GENERATION,
          focus: { space: 'owner-local', point: next },
        })
        lastAppliedFocus = next
        syncReferenceToCatalog(reference, port, result.snapshot.counters.activeUnits)
        writeSnapshot(ui, result.snapshot)
        if (!fallback.isActivated()) {
          status(
            ui,
            `${result.kind.toUpperCase()} · pinned GLB ${manifest.payloads.geometry.sha256.slice(0, 12)}…\n` +
              `Local evidence only; activationApproved=false.`,
            'ready',
          )
        }
      }
    } catch (error) {
      if (!fallback.isActivated()) status(ui, error instanceof Error ? error.message : String(error), 'error')
    } finally {
      applyingFocus = false
      if (requestedFocus) void applyLatestFocus()
    }
  }
  const requestFocus = (point: RepeatSixPartVec3): void => {
    if (point.some((value) => !Number.isFinite(value))) return
    requestedFocus = Object.freeze([...point]) as unknown as RepeatSixPartVec3
    focusMarker.position.fromArray(point)
    writeFocusInputs(ui, point)
    void applyLatestFocus()
  }

  for (const axis of ['x', 'y', 'z'] as const) {
    ui.ranges[axis].addEventListener('input', () => {
      ui.numbers[axis].value = ui.ranges[axis].value
      requestFocus(readFocusInputs(ui))
    })
    ui.numbers[axis].addEventListener('change', () => {
      const value = Math.min(Number(ui.numbers[axis].max), Math.max(Number(ui.numbers[axis].min), Number(ui.numbers[axis].value)))
      ui.numbers[axis].value = value.toFixed(2)
      ui.ranges[axis].value = ui.numbers[axis].value
      requestFocus(readFocusInputs(ui))
    })
  }

  const raycaster = new Raycaster()
  const pointer = new Vector2()
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (!event.shiftKey || event.button !== 0 || fallback.isActivated()) return
    const rectangle = renderer.domElement.getBoundingClientRect()
    pointer.set(
      ((event.clientX - rectangle.left) / rectangle.width) * 2 - 1,
      -((event.clientY - rectangle.top) / rectangle.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    const point = new Vector3()
    if (raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -focusMarker.position.y), point)) {
      requestFocus([point.x, focusMarker.position.y, point.z])
    }
  })

  const setReferencePreview = (visible: boolean): void => {
    const changed = fallback.setLocalReferencePreview(visible)
    if (!changed) return
    ui.showCatalog.setAttribute('aria-pressed', String(!visible))
    ui.showReference.setAttribute('aria-pressed', String(visible))
  }
  ui.showCatalog.addEventListener('click', () => setReferencePreview(false))
  ui.showReference.addEventListener('click', () => setReferencePreview(true))
  ui.fitCamera.addEventListener('click', () => fitCamera(camera, controls, bounds))
  ui.testFailover.addEventListener('click', () => {
    if (fallback.isActivated() || !window.confirm('Deliberately fail the next renderer publication? Reload is required to recover.')) return
    port.failNextPublication()
    const counters = adapter.getSnapshot().counters
    const next: RepeatSixPartVec3 = counters.activeUnits > 0
      ? [bounds.max.x + gridSize * 2, bounds.max.y + gridSize * 2, bounds.max.z + gridSize * 2]
      : initialFocus
    requestFocus(next)
  })

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

  let fpsFrames = 0
  let fpsWindowStart = performance.now()
  let lastMetricUpdate = 0
  renderer.setAnimationLoop((now) => {
    controls.update()
    renderer.render(scene, camera)
    fpsFrames += 1
    const elapsed = now - fpsWindowStart
    if (elapsed >= 500) {
      ui.fps.textContent = `${Math.round(fpsFrames * 1_000 / elapsed)} FPS`
      fpsFrames = 0
      fpsWindowStart = now
    }
    if (now - lastMetricUpdate >= 250) {
      const info = renderer.info.render
      ui.webglCounters.textContent = `${info.calls.toLocaleString()} / ${info.triangles.toLocaleString()}`
      writeSnapshot(ui, adapter.getSnapshot())
      lastMetricUpdate = now
    }
  })

  window.addEventListener('beforeunload', () => {
    renderer.setAnimationLoop(null)
    resizeObserver.disconnect()
    controls.dispose()
    void adapter.dispose()
    focusMarker.geometry.dispose()
    ;(focusMarker.material as Material).dispose()
    grid.geometry.dispose()
    if (Array.isArray(grid.material)) {
      for (const material of grid.material) material.dispose()
    } else {
      grid.material.dispose()
    }
    disposeExactResources(templates)
    reference.root.clear()
    environment.dispose()
    renderer.dispose()
  }, { once: true })

  writeSnapshot(ui, adapter.getSnapshot())
  requestFocus(lastAppliedFocus)
}

void main().catch((error) => {
  const ui = collectUi()
  status(ui, error instanceof Error ? error.stack ?? error.message : String(error), 'error')
  ui.testFailover.disabled = true
})
