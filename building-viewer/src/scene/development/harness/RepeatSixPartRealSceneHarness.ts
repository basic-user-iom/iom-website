/** Standalone local Vite page; deliberately absent from production build inputs. */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  Material,
  Mesh,
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
import { ModelLoader } from '../../ModelLoader'
import { ModelAnimationPlayer } from '../../ModelAnimationPlayer'
import {
  REPEAT_SIX_PART_REAL_SCENE_ASSETS,
  assertLocalDevelopmentHost,
  loadDormantRealSceneEvidence,
  type DormantRealSceneEvidence,
} from './RepeatSixPartRealSceneEvidence'

const EXPECTED_SOURCE_MATERIALS = Object.freeze(new Map<string, number>([
  ['vray Stuhl_Plastik', 24_213],
  ['vray Stuhl_Plakete', 7_102],
  ['vray Stuhl_Metall', 14_041],
  ['vray Stuhl_Bezug', 15_913],
]))
const EXPECTED_INSTANCE_COUNT = 78

type Ui = Readonly<{
  stage: HTMLElement
  status: HTMLElement
  progress: HTMLProgressElement
  fps: HTMLElement
  modelPin: HTMLElement
  manifestPin: HTMLElement
  attestationPin: HTMLElement
  geometryPin: HTMLElement
  nodes: HTMLElement
  meshes: HTMLElement
  instances: HTMLElement
  triangles: HTMLElement
  webgl: HTMLElement
  memory: HTMLElement
  ownerHints: HTMLElement
  sourceHints: HTMLElement
  hintList: HTMLElement
  animation: HTMLElement
  timeline: HTMLInputElement
  play: HTMLButtonElement
  pause: HTMLButtonElement
  stop: HTMLButtonElement
  fit: HTMLButtonElement
}>

type SourceHint = Readonly<{
  path: string
  name: string
  material: string
  instances: number
  baseTriangles: number
  expandedTriangles: number
  beneathExpectedOwner: boolean
  visible: boolean
}>

type SceneDiagnostics = Readonly<{
  nodes: number
  meshes: number
  instancedMeshes: number
  logicalInstances: number
  expandedTriangles: number
  uniqueGeometries: number
  uniqueMaterials: number
  uniqueTextures: number
  ownerNameMatches: number
  sourceHints: readonly SourceHint[]
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
    progress: element<HTMLProgressElement>('progress'),
    fps: element('fps'),
    modelPin: element('model-pin'),
    manifestPin: element('manifest-pin'),
    attestationPin: element('attestation-pin'),
    geometryPin: element('geometry-pin'),
    nodes: element('nodes'),
    meshes: element('meshes'),
    instances: element('instances'),
    triangles: element('triangles'),
    webgl: element('webgl'),
    memory: element('memory'),
    ownerHints: element('owner-hints'),
    sourceHints: element('source-hints'),
    hintList: element('hint-list'),
    animation: element('animation'),
    timeline: element<HTMLInputElement>('timeline'),
    play: element<HTMLButtonElement>('play'),
    pause: element<HTMLButtonElement>('pause'),
    stop: element<HTMLButtonElement>('stop'),
    fit: element<HTMLButtonElement>('fit'),
  })
}

function setStatus(ui: Ui, message: string, state: 'loading' | 'ready' | 'error'): void {
  ui.status.textContent = message
  ui.status.dataset.state = state
}

function shortPin(sha256: string): string {
  return `${sha256.slice(0, 12)}...`
}

function triangleCount(geometry: BufferGeometry): number {
  return (geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3
}

function materialsOf(mesh: Mesh): readonly Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

function materialTextures(material: Material): readonly Texture[] {
  const textures: Texture[] = []
  for (const value of Object.values(material as Material & Record<string, unknown>)) {
    if (value instanceof Texture) textures.push(value)
  }
  return textures
}

function objectPath(object: Object3D, root: Object3D): string {
  const parts: string[] = []
  let current: Object3D | null = object
  while (current && current !== root) {
    const parent: Object3D | null = current.parent
    const index = parent ? parent.children.indexOf(current) : -1
    parts.push(String(index))
    current = parent
  }
  return `root/${parts.reverse().join('/')}`
}

function hasAncestorNamed(object: Object3D, name: string): boolean {
  let current: Object3D | null = object
  while (current) {
    if (current.name === name) return true
    current = current.parent
  }
  return false
}

function inspectScene(root: Object3D, evidence: DormantRealSceneEvidence): SceneDiagnostics {
  let nodes = 0
  let meshes = 0
  let instancedMeshes = 0
  let logicalInstances = 0
  let expandedTriangles = 0
  let ownerNameMatches = 0
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  const sourceHints: SourceHint[] = []

  root.updateMatrixWorld(true)
  root.traverse((object) => {
    nodes += 1
    if (object.name === evidence.ownerName) ownerNameMatches += 1
    if (!(object instanceof Mesh)) return
    meshes += 1
    geometries.add(object.geometry)
    const meshMaterials = materialsOf(object)
    for (const material of meshMaterials) {
      materials.add(material)
      for (const texture of materialTextures(material)) textures.add(texture)
    }
    const instances = object instanceof InstancedMesh ? object.count : 1
    if (object instanceof InstancedMesh) instancedMeshes += 1
    logicalInstances += instances
    const baseTriangles = triangleCount(object.geometry)
    expandedTriangles += baseTriangles * instances

    if (object instanceof InstancedMesh && object.count === EXPECTED_INSTANCE_COUNT && meshMaterials.length === 1) {
      const material = meshMaterials[0]
      const expectedTriangles = EXPECTED_SOURCE_MATERIALS.get(material.name)
      if (expectedTriangles === baseTriangles) {
        sourceHints.push(Object.freeze({
          path: objectPath(object, root),
          name: object.name || '(unnamed)',
          material: material.name,
          instances,
          baseTriangles,
          expandedTriangles: baseTriangles * instances,
          beneathExpectedOwner: hasAncestorNamed(object, evidence.ownerName),
          visible: object.visible,
        }))
      }
    }
  })

  sourceHints.sort((a, b) => a.material.localeCompare(b.material))
  return Object.freeze({
    nodes,
    meshes,
    instancedMeshes,
    logicalInstances,
    expandedTriangles,
    uniqueGeometries: geometries.size,
    uniqueMaterials: materials.size,
    uniqueTextures: textures.size,
    ownerNameMatches,
    sourceHints: Object.freeze(sourceHints),
  })
}

function fitCamera(camera: PerspectiveCamera, controls: OrbitControls, bounds: Box3): void {
  if (bounds.isEmpty()) throw new Error('Loaded production scene has empty bounds')
  const center = bounds.getCenter(new Vector3())
  const size = bounds.getSize(new Vector3())
  const radius = Math.max(size.length() * 0.5, 1)
  const distance = radius / Math.max(Math.sin(camera.fov * Math.PI / 360), 0.1) * 1.05
  camera.near = Math.max(distance / 10_000, 0.02)
  camera.far = Math.max(distance * 20, 2_000)
  camera.position.set(center.x + distance * 0.66, center.y + distance * 0.46, center.z + distance * 0.66)
  controls.target.copy(center)
  camera.updateProjectionMatrix()
  controls.update()
}

function renderSourceHints(ui: Ui, diagnostics: SceneDiagnostics, evidence: DormantRealSceneEvidence): void {
  ui.ownerHints.textContent = `${diagnostics.ownerNameMatches} read-only name match${diagnostics.ownerNameMatches === 1 ? '' : 'es'}`
  ui.sourceHints.textContent = `${diagnostics.sourceHints.length} / ${evidence.sourceRootSceneIndices.length} provisional hints`
  const fragment = document.createDocumentFragment()
  if (diagnostics.sourceHints.length === 0) {
    const item = document.createElement('li')
    item.textContent = 'No provisional source hint matched. This shell does not infer ownership.'
    fragment.append(item)
  } else {
    for (const hint of diagnostics.sourceHints) {
      const item = document.createElement('li')
      item.textContent = `${hint.material}: ${hint.instances} instances, ${hint.baseTriangles.toLocaleString()} base triangles, ${hint.path}, owner ancestor=${hint.beneathExpectedOwner}, visible=${hint.visible}`
      fragment.append(item)
    }
  }
  ui.hintList.replaceChildren(fragment)
}

function writeStaticDiagnostics(ui: Ui, diagnostics: SceneDiagnostics, evidence: DormantRealSceneEvidence): void {
  ui.modelPin.textContent = `${REPEAT_SIX_PART_REAL_SCENE_ASSETS.productionModel.bytes.toLocaleString()} B / ${shortPin(REPEAT_SIX_PART_REAL_SCENE_ASSETS.productionModel.sha256)}`
  ui.manifestPin.textContent = `${REPEAT_SIX_PART_REAL_SCENE_ASSETS.manifest.bytes.toLocaleString()} B / ${shortPin(REPEAT_SIX_PART_REAL_SCENE_ASSETS.manifest.sha256)}`
  ui.attestationPin.textContent = `${REPEAT_SIX_PART_REAL_SCENE_ASSETS.semanticAttestation.bytes.toLocaleString()} B / ${shortPin(REPEAT_SIX_PART_REAL_SCENE_ASSETS.semanticAttestation.sha256)}`
  ui.geometryPin.textContent = `${REPEAT_SIX_PART_REAL_SCENE_ASSETS.exactGeometry.bytes.toLocaleString()} B / ${shortPin(REPEAT_SIX_PART_REAL_SCENE_ASSETS.exactGeometry.sha256)}`
  ui.nodes.textContent = diagnostics.nodes.toLocaleString()
  ui.meshes.textContent = `${diagnostics.meshes.toLocaleString()} (${diagnostics.instancedMeshes.toLocaleString()} instanced)`
  ui.instances.textContent = diagnostics.logicalInstances.toLocaleString()
  ui.triangles.textContent = diagnostics.expandedTriangles.toLocaleString()
  renderSourceHints(ui, diagnostics, evidence)
}

function disposeSceneResources(root: Object3D): void {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    geometries.add(object.geometry)
    for (const material of materialsOf(object)) {
      materials.add(material)
      for (const texture of materialTextures(material)) textures.add(texture)
    }
  })
  for (const texture of textures) texture.dispose()
  for (const material of materials) material.dispose()
  for (const geometry of geometries) geometry.dispose()
  root.clear()
}

async function main(): Promise<void> {
  assertLocalDevelopmentHost(location.hostname)
  const ui = collectUi()
  setStatus(ui, 'Verifying disabled manifest and semantic attestation...', 'loading')
  const evidence = await loadDormantRealSceneEvidence()

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
  setStatus(ui, 'Downloading and verifying the pinned 97.55 MB production GLB...', 'loading')
  const result = await loader.loadUrlVerified(
    evidence.modelPin.url,
    { bytes: evidence.modelPin.bytes, sha256: evidence.modelPin.sha256 },
    (progress) => {
      setStatus(ui, progress.message, 'loading')
      if (progress.ratio === null) {
        ui.progress.removeAttribute('value')
      } else {
        ui.progress.value = Math.max(0, Math.min(1, progress.ratio))
      }
    },
  )
  ui.progress.value = 1

  if (result.root.name !== 'ModelRoot' || result.root.children.length !== 1) {
    throw new Error('ModelLoader did not preserve the required ModelRoot -> sole active glTF scene graph')
  }
  result.root.userData.layerId = 'icm-anim-2025'
  result.root.userData.developmentOnly = true
  result.root.userData.productionOwnershipIntegrated = false
  result.root.userData.sourceOwnershipMutationCapability = false
  scene.add(result.root)
  const bounds = new Box3().setFromObject(result.root, true)
  fitCamera(camera, controls, bounds)

  const diagnostics = inspectScene(result.root, evidence)
  writeStaticDiagnostics(ui, diagnostics, evidence)
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
  ui.animation.textContent = animation.isAvailable()
    ? `${animation.clipCount()} clip${animation.clipCount() === 1 ? '' : 's'} / ${duration.toFixed(3)} s / paused`
    : 'No embedded animation'
  ui.play.addEventListener('click', () => animation.play())
  ui.pause.addEventListener('click', () => animation.pause())
  ui.stop.addEventListener('click', () => animation.stop())
  ui.timeline.addEventListener('input', () => animation.seek(Number(ui.timeline.value)))
  ui.fit.addEventListener('click', () => fitCamera(camera, controls, bounds))

  const expectedHintCount = evidence.sourceRootSceneIndices.length
  const hintMessage = diagnostics.sourceHints.length === expectedHintCount
    ? `${expectedHintCount} provisional geometry/material hints observed; not ownership evidence.`
    : `${diagnostics.sourceHints.length}/${expectedHintCount} provisional hints observed; observer contract is still required.`
  setStatus(
    ui,
    `READ-ONLY REAL SCENE READY\n${hintMessage}\nNo candidate source root was hidden, reparented, replaced, or retired. activationApproved=false.`,
    'ready',
  )
  document.documentElement.dataset.realSceneHarness = 'ready-read-only'

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

  const clock = new Clock()
  let frames = 0
  let fpsStart = performance.now()
  let lastMetrics = 0
  renderer.setAnimationLoop((now) => {
    const delta = Math.min(clock.getDelta(), 0.1)
    animation.update(delta)
    controls.update()
    renderer.render(scene, camera)
    frames += 1
    const elapsed = now - fpsStart
    if (elapsed >= 500) {
      ui.fps.textContent = `${Math.round(frames * 1_000 / elapsed)} FPS`
      frames = 0
      fpsStart = now
    }
    if (now - lastMetrics >= 250) {
      const render = renderer.info.render
      const memory = renderer.info.memory
      ui.webgl.textContent = `${render.calls.toLocaleString()} calls / ${render.triangles.toLocaleString()} triangles`
      ui.memory.textContent = `${memory.geometries.toLocaleString()} geometries / ${memory.textures.toLocaleString()} textures`
      const state = animation.getState()
      ui.timeline.value = String(state.time)
      ui.animation.textContent = state.available
        ? `${animation.clipCount()} clip${animation.clipCount() === 1 ? '' : 's'} / ${state.time.toFixed(3)} of ${state.duration.toFixed(3)} s / ${state.playing ? 'playing' : 'paused'}`
        : 'No embedded animation'
      lastMetrics = now
    }
  })

  window.addEventListener('beforeunload', () => {
    renderer.setAnimationLoop(null)
    resizeObserver.disconnect()
    animation.dispose()
    controls.dispose()
    scene.remove(result.root)
    disposeSceneResources(result.root)
    environment.dispose()
    loader.dispose()
    renderer.dispose()
  }, { once: true })
}

void main().catch((error) => {
  const ui = collectUi()
  ui.progress.removeAttribute('value')
  setStatus(ui, error instanceof Error ? error.stack ?? error.message : String(error), 'error')
  document.documentElement.dataset.realSceneHarness = 'error'
})
