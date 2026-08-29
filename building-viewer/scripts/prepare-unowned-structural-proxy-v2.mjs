/**
 * Prepare a texture-free Quest-derived DCC input for the second, distinct
 * __unowned__ structural proxy iteration. V1 artifacts are read-only pins.
 * No production assets or routing are modified.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prune, uninstance } from '@gltf-transform/functions'
import { createGltfIO } from './lib/gltf-io.mjs'
import { stringListSha256 } from './lib/whole-layer-ownership-contract.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const SITE_ROOT = resolve(VIEWER_ROOT, '..')
const OUT = resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-unowned-structural-proxy-v2')
const V1_ROOT = resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-unowned-structural-shell-candidate')
const PLAN_PATH = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v1', 'unowned-static-partition-plan-v1.json')
const CONTRACT_PATH = resolve(VIEWER_ROOT, 'tmp', 'whole-layer-ownership-v1', 'whole-layer-ownership-contract-v1.json')
const SOURCE_PATHS = Object.freeze({
  web: resolve(SITE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-web.glb'),
  quest: resolve(SITE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-quest.glb'),
})
const ADDED_PROXY_PATHS = Object.freeze([
  // Initial largest omitted structural contributors from the rejected v1 audit.
  'scene/0/5',
  'scene/0/18',
  'scene/0/249',
  'scene/0/394',
  // Broad omitted ground/roof paths ranked by horizontal source bounds. These
  // remain exact whole-path ownership claims; no primitive-level cherry-pick.
  'scene/0/0',
  'scene/0/2',
  'scene/0/7',
  'scene/0/16',
  'scene/0/30',
  'scene/0/41',
  'scene/0/89',
  'scene/0/90',
  'scene/0/91',
  'scene/0/92',
  'scene/0/162',
  'scene/0/184',
  'scene/0/247',
  'scene/0/248',
  'scene/0/257',
  'scene/0/281',
  'scene/0/318',
  'scene/0/327',
  'scene/0/331',
  'scene/0/341',
  'scene/0/345',
  'scene/0/346',
  'scene/0/348',
  'scene/0/351',
  'scene/0/355',
  'scene/0/356',
  'scene/0/357',
  'scene/0/358',
  'scene/0/366',
  'scene/0/367',
  'scene/0/370',
  'scene/0/372',
  // Final lossless additions maximize remaining horizontal footprint within
  // the post-proxy triangle headroom.
  'scene/0/65',
  'scene/0/280',
  'scene/0/286',
  'scene/0/237',
  'scene/0/344',
  'scene/0/347',
  'scene/0/349',
  'scene/0/350',
  'scene/0/352',
  'scene/0/359',
  'scene/0/360',
  'scene/0/363',
  'scene/0/365',
  // Material inspection promotes three true architectural receivers and drops
  // the similarly sized glass-only path 138 to keep the safer 1-degree pass.
  'scene/0/34',
  'scene/0/157',
  'scene/0/178',
])

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function fileEvidence(path) {
  const [bytes, info] = await Promise.all([readFile(path), stat(path)])
  return { path: relative(VIEWER_ROOT, path).replaceAll('\\', '/'), bytes: info.size, sha256: sha256(bytes) }
}

function activeScenePaths(root) {
  const scenes = root.listScenes()
  const activeScene = root.getDefaultScene() ?? scenes[0]
  assert.ok(activeScene, 'Source has no active scene')
  const sceneIndex = scenes.indexOf(activeScene)
  const paths = new Map()
  const visit = (node, path) => {
    assert.ok(!paths.has(node), `Scene multiply references ${path}`)
    paths.set(node, path)
    node.listChildren().forEach((child, index) => visit(child, `${path}/${index}`))
  }
  activeScene.listChildren().forEach((node, index) => visit(node, `scene/${sceneIndex}/${index}`))
  return { activeScene, paths }
}

function removeTextureBindings(material) {
  material.setBaseColorTexture(null)
  material.setMetallicRoughnessTexture(null)
  material.setNormalTexture(null)
  material.setOcclusionTexture(null)
  material.setEmissiveTexture(null)
  const transmission = material.getExtension('KHR_materials_transmission')
  transmission?.setTransmissionTexture?.(null)
  const specular = material.getExtension('KHR_materials_specular')
  specular?.setSpecularTexture?.(null)
  specular?.setSpecularColorTexture?.(null)
  material.setBaseColorFactor([0.58, 0.65, 0.74, 1])
  material.setMetallicFactor(0)
  material.setRoughnessFactor(0.88)
  material.setEmissiveFactor([0.16, 0.19, 0.24])
  material.setAlphaMode('OPAQUE')
  material.setDoubleSided(true)
}

function sourceSegments(plan, variant) {
  const repeat = new Set(plan.repeatCandidate.variants[variant].batches.flatMap((batch) => batch.sourceUnitIds))
  const fire = new Set(plan.fireHoseMigration.variants[variant].sourceUnitIds)
  const staticUnits = plan.variants[variant].units.filter((unit) => !repeat.has(unit.id) && !fire.has(unit.id))
  assert.equal(staticUnits.length, 2_843, `${variant}: static unit count changed`)
  return { repeat, fire, staticUnits }
}

async function retainPaths(document, selectedPaths, unitsByPath = null) {
  const root = document.getRoot()
  const { paths } = activeScenePaths(root)
  const byPath = new Map([...paths].map(([node, path]) => [path, node]))
  const selectedNodes = selectedPaths.map((path) => {
    const node = byPath.get(path)
    assert.ok(node?.getMesh(), `Missing selected mesh path ${path}`)
    return { path, node }
  })
  const previousScenes = [...root.listScenes()]
  const scene = document.createScene('UnownedStructuralProxyV2Input')
  root.setDefaultScene(scene)
  for (const { path, node } of selectedNodes) {
    for (const child of [...node.listChildren()]) node.removeChild(child)
    node.setName(`IOM_PROXY_SOURCE__${path.replaceAll('/', '__')}`)
    node.setExtras({
      iomProxySourcePath: path,
      iomProxySourceOwner: '__unowned__',
      iomProxyClaimAtomicUnitIds: unitsByPath?.get(path)?.map((unit) => unit.id).sort() ?? [],
      iomProxyInputVariant: unitsByPath ? 'quest' : 'source-static-reference',
    })
    scene.addChild(node)
  }
  for (const previous of previousScenes) previous.dispose()
  const retained = new Set(selectedNodes.map(({ node }) => node))
  for (const node of [...root.listNodes()]) {
    if (!retained.has(node)) node.dispose()
  }
  for (const animation of [...root.listAnimations()]) animation.dispose()
  const usedMeshes = new Set(selectedNodes.map(({ node }) => node.getMesh()))
  for (const mesh of [...root.listMeshes()]) {
    if (!usedMeshes.has(mesh)) mesh.dispose()
  }
  const usedMaterials = new Set([...usedMeshes]
    .flatMap((mesh) => mesh.listPrimitives())
    .map((primitive) => primitive.getMaterial())
    .filter(Boolean))
  for (const material of [...root.listMaterials()]) {
    if (!usedMaterials.has(material)) material.dispose()
    else removeTextureBindings(material)
  }
  for (const texture of [...root.listTextures()]) texture.dispose()
  if (unitsByPath) {
    await document.transform(uninstance())
    for (const { path, node } of selectedNodes) {
      const meshChildren = node.listChildren().filter((child) => child.getMesh())
      if (!meshChildren.length) continue
      meshChildren.forEach((child, instanceIndex) => {
        const instanceUnitIds = (unitsByPath.get(path) || [])
          .filter((unit) => unit.instanceIndex === instanceIndex)
          .map((unit) => unit.id)
          .sort()
        child.setName(`IOM_PROXY_SOURCE__${path.replaceAll('/', '__')}__instance__${instanceIndex}`)
        child.setExtras({
          ...child.getExtras(),
          iomProxySourcePath: path,
          iomProxySourceOwner: '__unowned__',
          iomProxyClaimAtomicUnitIds: instanceUnitIds,
          iomProxyInputVariant: 'quest',
          iomProxyInstanceIndex: instanceIndex,
        })
      })
    }
  }
  await document.transform(prune({ keepAttributes: true, keepIndices: true, keepExtras: true }))
  for (const extension of [...root.listExtensionsUsed()]) {
    if (extension.extensionName === 'KHR_texture_basisu') extension.dispose()
  }
  return document
}

await mkdir(resolve(OUT, 'source'), { recursive: true })
const [v1CandidateBytes, v1ProjectionBytes, v1RepartitionBytes, planBytes, contractBytes] = await Promise.all([
  readFile(resolve(V1_ROOT, 'candidate-index.json')),
  readFile(resolve(V1_ROOT, 'visual-qa', 'projection-audit.json')),
  readFile(resolve(V1_ROOT, 'ownership-repartition.json')),
  readFile(PLAN_PATH),
  readFile(CONTRACT_PATH),
])
const v1Candidate = JSON.parse(v1CandidateBytes)
const v1Projection = JSON.parse(v1ProjectionBytes)
const v1Repartition = JSON.parse(v1RepartitionBytes)
const plan = JSON.parse(planBytes)
const contract = JSON.parse(contractBytes)
assert.equal(v1Candidate.schema, 'IOM_UNOWNED_STRUCTURAL_SHELL_CANDIDATE')
assert.equal(v1Candidate.ready, false)
assert.equal(v1Projection.strongCoverage, false)
assert.equal(v1Projection.status, 'projection-insufficient-candidate-rejected-for-activation')
assert.equal(v1Repartition.schema, 'IOM_UNOWNED_STRUCTURAL_SHELL_REPARTITION')
assert.equal(plan.schema, 'IOM_UNOWNED_STATIC_PARTITION_PLAN')
assert.equal(plan.wholeLayerCoverageDigestSha256, contract.coverageDigestSha256)

const proxySourcePaths = [...new Set([...v1Candidate.selectionPolicy.sourceNodePaths, ...ADDED_PROXY_PATHS])]
  .sort((left, right) => left.localeCompare(right))
assert.equal(proxySourcePaths.length, v1Candidate.selectionPolicy.sourceNodePaths.length + ADDED_PROXY_PATHS.length)
for (const path of ADDED_PROXY_PATHS) assert.ok(!v1Candidate.selectionPolicy.sourceNodePaths.includes(path))

const io = await createGltfIO({ encoder: true })
const questSegments = sourceSegments(plan, 'quest')
const questUnitsByPath = new Map()
for (const unit of questSegments.staticUnits.filter((unit) => proxySourcePaths.includes(unit.sourcePath))) {
  const values = questUnitsByPath.get(unit.sourcePath) || []
  values.push(unit)
  questUnitsByPath.set(unit.sourcePath, values)
}
assert.deepEqual([...questUnitsByPath.keys()].sort(), proxySourcePaths, 'Quest proxy source-path claim is incomplete')

const proxyInputPath = resolve(OUT, 'source', 'quest-feature-preserving-proxy-input.glb')
await io.write(proxyInputPath, await retainPaths(await io.read(SOURCE_PATHS.quest), proxySourcePaths, questUnitsByPath))

const sourceStaticInputs = {}
for (const variant of ['web', 'quest']) {
  const segments = sourceSegments(plan, variant)
  const staticPaths = [...new Set(segments.staticUnits.map((unit) => unit.sourcePath))].sort()
  const output = resolve(OUT, 'source', `${variant}-source-static-geometry-review.glb`)
  await io.write(output, await retainPaths(await io.read(SOURCE_PATHS[variant]), staticPaths))
  sourceStaticInputs[variant] = await fileEvidence(output)
}

const selectedSourceClaims = {}
for (const variant of ['web', 'quest']) {
  const segments = sourceSegments(plan, variant)
  const units = segments.staticUnits.filter((unit) => proxySourcePaths.includes(unit.sourcePath))
  selectedSourceClaims[variant] = {
    sourcePathCount: proxySourcePaths.length,
    sourcePathsSha256: stringListSha256(proxySourcePaths),
    atomicUnitCount: units.length,
    sourceUnitIdsSha256: stringListSha256(units.map((unit) => unit.id)),
    sourceExpandedTriangles: units.reduce((sum, unit) => sum + unit.triangles, 0),
  }
}

const prepared = {
  schema: 'IOM_UNOWNED_STRUCTURAL_PROXY_V2_PREPARED_INPUTS',
  version: 2,
  generatedAt: new Date().toISOString(),
  enabled: false,
  ready: false,
  activationApproved: false,
  modelId: 'icm-anim-2025',
  sourceOwner: '__unowned__',
  derivation: 'quest-source-feature-preserving-planar-proxy-shared-by-web-and-quest',
  proxySourcePaths,
  proxySourcePathsSha256: stringListSha256(proxySourcePaths),
  addedToRejectedV1: ADDED_PROXY_PATHS,
  selectedSourceClaims,
  inputs: {
    questProxySource: await fileEvidence(proxyInputPath),
    sourceStatic: sourceStaticInputs,
  },
  evidencePins: {
    rejectedV1Candidate: { path: relative(VIEWER_ROOT, resolve(V1_ROOT, 'candidate-index.json')).replaceAll('\\', '/'), bytes: v1CandidateBytes.length, sha256: sha256(v1CandidateBytes) },
    rejectedV1Projection: { path: relative(VIEWER_ROOT, resolve(V1_ROOT, 'visual-qa', 'projection-audit.json')).replaceAll('\\', '/'), bytes: v1ProjectionBytes.length, sha256: sha256(v1ProjectionBytes) },
    rejectedV1Repartition: { path: relative(VIEWER_ROOT, resolve(V1_ROOT, 'ownership-repartition.json')).replaceAll('\\', '/'), bytes: v1RepartitionBytes.length, sha256: sha256(v1RepartitionBytes) },
    sourcePartitionPlan: { path: relative(VIEWER_ROOT, PLAN_PATH).replaceAll('\\', '/'), bytes: planBytes.length, sha256: sha256(planBytes), planDigestSha256: plan.planDigestSha256 },
    wholeLayerContract: { path: relative(VIEWER_ROOT, CONTRACT_PATH).replaceAll('\\', '/'), bytes: contractBytes.length, sha256: sha256(contractBytes), coverageDigestSha256: contract.coverageDigestSha256 },
    sources: {
      web: await fileEvidence(SOURCE_PATHS.web),
      quest: await fileEvidence(SOURCE_PATHS.quest),
    },
  },
  dccContract: {
    planarDissolveOnly: true,
    materialBoundariesPreserved: true,
    sourcePathObjectExtrasRequired: true,
    normalsRecalculated: true,
    outputMaterialsDoubleSided: true,
    texturesRequired: false,
    maximumExpandedTrianglesPerVariant: 150_000,
  },
}
await writeFile(resolve(OUT, 'prepared-inputs.json'), `${JSON.stringify(prepared, null, 2)}\n`)
console.log(JSON.stringify({
  output: relative(VIEWER_ROOT, OUT).replaceAll('\\', '/'),
  proxySourcePaths: proxySourcePaths.length,
  selectedSourceClaims,
  proxyInput: prepared.inputs.questProxySource,
}, null, 2))
