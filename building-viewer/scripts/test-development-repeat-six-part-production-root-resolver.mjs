import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
} from 'three'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')
const MODEL_ID = 'icm-anim-2025'
const ROOT_PINS = [
  { ordinal: 258, runtimeName: 'mesh_1127', material: 'vray Stuhl_Plastik', triangles: 24_213 },
  { ordinal: 259, runtimeName: 'mesh_1128', material: 'vray Stuhl_Plakete', triangles: 7_102 },
  { ordinal: 260, runtimeName: 'mesh_1129', material: 'vray Stuhl_Metall', triangles: 14_041 },
  { ordinal: 261, runtimeName: 'mesh_1130', material: 'vray Stuhl_Bezug', triangles: 15_913 },
]

function geometryWithTriangles(triangles) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ]), 3))
  geometry.setIndex(new BufferAttribute(new Uint32Array(triangles * 3), 1))
  return geometry
}

function instanceMatrix(index) {
  const matrix = new Matrix4()
  if (index >= 40) matrix.makeScale(-1, 1, 1)
  matrix.setPosition(index * 1.75, (index % 6) * 0.25, -index * 0.4)
  return matrix
}

function pinnedMesh(pin) {
  const material = new MeshBasicMaterial()
  material.name = pin.material
  const mesh = new InstancedMesh(geometryWithTriangles(pin.triangles), material, 78)
  mesh.name = pin.runtimeName
  for (let index = 0; index < 78; index += 1) mesh.setMatrixAt(index, instanceMatrix(index))
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

function fixture() {
  const modelRoot = new Group()
  modelRoot.name = `Model:${MODEL_ID}`
  modelRoot.userData.layerId = MODEL_ID
  const activeScene = new Group()
  activeScene.name = 'Scene'
  modelRoot.add(activeScene)

  for (let ordinal = 0; ordinal < 258; ordinal += 1) {
    const child = new Group()
    child.name = `ordinary-${ordinal}`
    activeScene.add(child)
  }
  // A deliberately attractive name-search decoy. Correct resolution must
  // ignore it and bind only the direct active-scene ordinals 258..261.
  const nameSearchDecoy = pinnedMesh(ROOT_PINS[0])
  nameSearchDecoy.name = 'scene/0/258 vray Stuhl_Plastik'
  activeScene.remove(activeScene.children[10])
  activeScene.add(nameSearchDecoy)
  activeScene.children.splice(10, 0, activeScene.children.pop())

  const roots = ROOT_PINS.map((pin) => pinnedMesh(pin))
  for (const root of roots) activeScene.add(root)

  const entry = {
    id: MODEL_ID,
    name: 'ICM 2025 Animated',
    web: '/models/icm-anim-2025/model-web.glb',
  }
  const result = {
    root: modelRoot,
    url: entry.web,
    transferredBytes: null,
    downloadMs: 0,
    parseMs: 0,
    fileSizeBytes: null,
    animations: [],
  }
  const layer = {
    id: MODEL_ID,
    entry,
    root: modelRoot,
    result,
    visible: true,
    streaming: false,
  }
  return { modelRoot, activeScene, roots, nameSearchDecoy, layer }
}

function setInstance(mesh, index, matrix) {
  mesh.setMatrixAt(index, matrix)
  mesh.instanceMatrix.needsUpdate = true
}

const vite = await createServer({
  root: PROJECT_DIR,
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
})

try {
  const module = await vite.ssrLoadModule(
    '/src/scene/development/DevelopmentRepeatSixPartProductionRootResolver.ts',
  )
  const {
    resolveDevelopmentRepeatSixPartProductionRoots: resolve,
    isIssuedDevelopmentRepeatSixPartProductionRootResolution: isIssued,
    getIssuedDevelopmentRepeatSixPartProductionRootLiveBinding: getBinding,
    DevelopmentRepeatSixPartProductionRootResolverError: ResolverError,
  } = module

  const baseline = fixture()
  const beforeChildren = [...baseline.activeScene.children]
  const beforeVersions = baseline.roots.map((root) => root.instanceMatrix.version)
  const resolution = resolve(baseline.layer)

  assert.equal(isIssued(resolution), true)
  assert.equal(Object.isFrozen(resolution), true)
  assert.equal(Object.isFrozen(resolution.metadata), true)
  assert.equal(Object.isFrozen(resolution.metadata.roots), true)
  assert.equal(Object.isFrozen(resolution.metadata.roots[0]), true)
  assert.deepEqual(resolution.metadata.sourceRootIds, [
    'scene/0/258', 'scene/0/259', 'scene/0/260', 'scene/0/261',
  ])
  assert.equal(resolution.metadata.activeSceneChildCount, 262)
  assert.equal(resolution.metadata.instances, 78)
  assert.equal(resolution.metadata.positiveInstances, 40)
  assert.equal(resolution.metadata.mirroredInstances, 38)
  assert.equal('roots' in resolution, false, 'live roots leaked into enumerable resolution metadata')
  assert.equal(JSON.stringify(resolution).includes('uuid'), false)

  const binding = getBinding(resolution)
  assert.equal(Object.isFrozen(binding), true)
  assert.equal(Object.isFrozen(binding.roots), true)
  assert.equal(binding.modelRoot, baseline.modelRoot)
  assert.equal(binding.activeScene, baseline.activeScene)
  assert.deepEqual(binding.roots, baseline.roots)
  assert.deepEqual(baseline.activeScene.children, beforeChildren, 'resolver mutated active-scene ordering')
  assert.deepEqual(
    baseline.roots.map((root) => root.instanceMatrix.version),
    beforeVersions,
    'resolver mutated instance buffers',
  )

  // A raw monolithic model root is accepted through the same physical proof.
  const raw = fixture()
  const rawResolution = resolve(raw.modelRoot)
  assert.equal(isIssued(rawResolution), true)
  assert.deepEqual(getBinding(rawResolution).roots, raw.roots)

  const forged = { ...resolution }
  assert.equal(isIssued(forged), false)
  assert.throws(
    () => getBinding(forged),
    (error) => error instanceof ResolverError && error.code === 'FORGED_RESOLUTION',
  )
  const forgedMetadata = Object.freeze({
    kind: resolution.kind,
    developmentOnly: true,
    metadata: resolution.metadata,
  })
  assert.equal(isIssued(forgedMetadata), false)
  assert.throws(
    () => getBinding(forgedMetadata),
    (error) => error instanceof ResolverError && error.code === 'FORGED_RESOLUTION',
  )

  const invalidCases = [
    ['wrong layer id', (value) => { value.layer.id = 'icm-ext' }, 'WRONG_MODEL'],
    ['wrong entry id', (value) => { value.layer.entry.id = 'icm-ext' }, 'WRONG_MODEL'],
    ['streaming layer', (value) => { value.layer.streaming = true }, 'STREAMING_LAYER'],
    ['result root alias mismatch', (value) => { value.layer.result.root = new Group() }, 'INVALID_GRAPH'],
    ['wrong model-root name', (value) => { value.modelRoot.name = 'Model:decoy' }, 'INVALID_GRAPH'],
    ['extra glTF scene', (value) => { value.modelRoot.add(new Group()) }, 'INVALID_GRAPH'],
    ['transformed glTF scene', (value) => { value.activeScene.position.x = 1; value.activeScene.updateMatrix() }, 'INVALID_GRAPH'],
    ['wrong runtime mesh name', (value) => { value.roots[0].name = 'scene/0/258' }, 'INVALID_PRODUCTION_ROOT'],
    ['transformed pinned host', (value) => { value.roots[0].position.y = 1; value.roots[0].updateMatrix() }, 'INVALID_PRODUCTION_ROOT'],
    ['wrong direct ordinal', (value) => { value.activeScene.remove(value.roots[0]); value.activeScene.add(value.roots[0]) }, 'INVALID_PRODUCTION_ROOT'],
    ['wrong parent', (value) => {
      const holder = new Group()
      value.activeScene.remove(value.roots[0])
      holder.add(value.roots[0])
      value.activeScene.add(holder)
    }, 'INVALID_PRODUCTION_ROOT'],
    ['wrong count', (value) => { value.roots[0].count = 77 }, 'INVALID_INSTANCE_SET'],
    ['wrong material', (value) => { value.roots[2].material.name = 'decoy metal' }, 'INVALID_PRODUCTION_ROOT'],
    ['material array', (value) => { value.roots[1].material = [value.roots[1].material] }, 'INVALID_PRODUCTION_ROOT'],
    ['wrong triangles', (value) => { value.roots[3].geometry = geometryWithTriangles(15_912) }, 'INVALID_GEOMETRY'],
    ['matrix order mismatch', (value) => {
      const changed = instanceMatrix(7)
      changed.elements[12] += 0.125
      setInstance(value.roots[1], 7, changed)
    }, 'INVALID_INSTANCE_SET'],
    ['non-finite matrix', (value) => {
      const changed = instanceMatrix(9)
      changed.elements[5] = Number.NaN
      setInstance(value.roots[0], 9, changed)
    }, 'INVALID_INSTANCE_SET'],
    ['singular parity matrix', (value) => {
      const changed = new Matrix4().makeScale(0, 1, 1)
      for (const root of value.roots) setInstance(root, 12, changed)
    }, 'INVALID_INSTANCE_SET'],
    ['wrong parity census', (value) => {
      const changed = new Matrix4().makeTranslation(40 * 1.75, 4 * 0.25, -40 * 0.4)
      for (const root of value.roots) setInstance(root, 40, changed)
    }, 'INVALID_INSTANCE_SET'],
  ]

  for (const [label, mutate, expectedCode] of invalidCases) {
    const value = fixture()
    mutate(value)
    assert.throws(
      () => resolve(value.layer),
      (error) => error instanceof ResolverError && error.code === expectedCode,
      label,
    )
  }

  const wrongRawId = fixture()
  wrongRawId.modelRoot.userData.layerId = 'icm-ext'
  assert.throws(
    () => resolve(wrongRawId.modelRoot),
    (error) => error instanceof ResolverError && error.code === 'WRONG_MODEL',
  )
  const streamingRaw = fixture()
  streamingRaw.modelRoot.userData.streaming = true
  assert.throws(
    () => resolve(streamingRaw.modelRoot),
    (error) => error instanceof ResolverError && error.code === 'STREAMING_LAYER',
  )

  // Issuance is not a stale capability: graph mutation is detected again at
  // bridge retrieval time before any caller receives the live references.
  baseline.roots[0].count = 77
  assert.throws(
    () => getBinding(resolution),
    (error) => error instanceof ResolverError && error.code === 'STALE_RESOLUTION',
  )

  console.log(JSON.stringify({
    status: 'PASS',
    contract: 'development-repeat-six-part-production-root-resolver',
    exactRoots: 4,
    instancesPerRoot: 78,
    parity: { positive: 40, mirrored: 38 },
    adversarialRejections: invalidCases.length + 5,
    proofs: [
      'exact-active-scene-ordinals',
      'name-search-decoy-rejected-by-design',
      'identity-host-and-ancestry',
      'material-and-triangle-pins',
      'ordered-finite-matrix-equality',
      'parity-census',
      'non-mutating-resolution',
      'weak-issued-evidence',
      'stale-live-binding-revalidation',
    ],
  }, null, 2))
} finally {
  await vite.close()
}
