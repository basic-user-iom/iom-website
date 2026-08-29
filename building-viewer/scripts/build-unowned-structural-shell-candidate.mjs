/**
 * Build a disabled, lossless structural-shell candidate from the exact
 * __unowned__ static remainder of icm-anim-2025.
 *
 * The candidate deliberately does not edit public assets, manifests, routes,
 * or runtime code. Selection is an explicit reviewed source-node allowlist;
 * every selected node is copied losslessly and remains traceable to the
 * mesh-primitive-instance ownership contract.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ExtensionProperty, Texture } from '@gltf-transform/core'
import { prune } from '@gltf-transform/functions'
import { Matrix4 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'
import { stringListSha256 } from './lib/whole-layer-ownership-contract.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const SITE_ROOT = resolve(VIEWER_ROOT, '..')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-unowned-structural-shell-candidate')
const PLAN_PATH = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v1', 'unowned-static-partition-plan-v1.json')
const CONTRACT_PATH = resolve(VIEWER_ROOT, 'tmp', 'whole-layer-ownership-v1', 'whole-layer-ownership-contract-v1.json')
const SOURCE_PATHS = Object.freeze({
  web: resolve(SITE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-web.glb'),
  quest: resolve(SITE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-quest.glb'),
})
const VARIANTS = Object.freeze(['web', 'quest'])
const MAX_EXPANDED_TRIANGLES = 150_000
const OWNER = '__unowned__'

// Explicit source-node review set. These are broad ground/floor, facade,
// wall, roof/ceiling and stair-envelope sheets with a high projected-area to
// triangle ratio. High-detail furniture, detached Fire content, glazing-only
// batches and the repeat candidate are intentionally absent.
const STRUCTURAL_SOURCE_PATHS = Object.freeze([
  'scene/0/10',
  'scene/0/17',
  'scene/0/20',
  'scene/0/21',
  'scene/0/23',
  'scene/0/24',
  'scene/0/25',
  'scene/0/28',
  'scene/0/57',
  'scene/0/59',
  'scene/0/66',
  'scene/0/67',
  'scene/0/68',
  'scene/0/71',
  'scene/0/73',
  'scene/0/93',
  'scene/0/110',
  'scene/0/125',
  'scene/0/131',
  'scene/0/137',
  'scene/0/140',
  'scene/0/143',
  'scene/0/148',
  'scene/0/166',
  'scene/0/175',
  'scene/0/194',
  'scene/0/195',
  'scene/0/213',
  'scene/0/217',
  'scene/0/220',
  'scene/0/221',
  'scene/0/228',
  'scene/0/229',
  'scene/0/234',
  'scene/0/235',
  'scene/0/236',
  'scene/0/245',
  'scene/0/246',
  'scene/0/262',
  'scene/0/264',
  'scene/0/266',
  'scene/0/267',
  'scene/0/268',
  'scene/0/274',
  'scene/0/275',
  'scene/0/276',
  'scene/0/283',
  'scene/0/285',
  'scene/0/293',
  'scene/0/314',
  'scene/0/315',
  'scene/0/316',
  'scene/0/317',
  'scene/0/321',
  'scene/0/336',
  'scene/0/398',
].sort((left, right) => left.localeCompare(right)))

const REQUIRED_GROUND_ENVELOPE_ANCHORS = Object.freeze([
  'scene/0/10',
  'scene/0/93',
  'scene/0/125',
  'scene/0/137',
  'scene/0/140',
])

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--out') args.out = resolve(argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function fileEvidence(path, url = null) {
  const [bytes, info] = await Promise.all([readFile(path), stat(path)])
  return {
    ...(url ? { url } : {}),
    path: relative(VIEWER_ROOT, path).replaceAll('\\', '/'),
    bytes: info.size,
    sha256: sha256(bytes),
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]))
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    if (Object.is(value, -0)) return 0
    return Number(value.toPrecision(9))
  }
  return value
}

function stableSha256(value) {
  return sha256(JSON.stringify(stableValue(value)))
}

function activeScenePaths(root) {
  const scenes = root.listScenes()
  const activeScene = root.getDefaultScene() ?? scenes[0]
  assert.ok(activeScene, 'Source GLB has no active scene')
  const sceneIndex = scenes.indexOf(activeScene)
  const paths = new Map()
  const visit = (node, path) => {
    assert.ok(!paths.has(node), `Active scene multiply references ${path}`)
    paths.set(node, path)
    node.listChildren().forEach((child, index) => visit(child, `${path}/${index}`))
  }
  activeScene.listChildren().forEach((node, index) => visit(node, `scene/${sceneIndex}/${index}`))
  return { activeScene, paths }
}

function instanceCount(node) {
  const extension = node.getExtension('EXT_mesh_gpu_instancing')
  if (!extension) return 1
  const counts = extension.listSemantics().map((semantic) => extension.getAttribute(semantic)?.getCount())
  const unique = [...new Set(counts)]
  assert.equal(unique.length, 1, 'Instancing attribute counts differ')
  assert.ok(Number.isSafeInteger(unique[0]) && unique[0] > 0, 'Instanced node count is invalid')
  return unique[0]
}

function triangleCount(primitive) {
  const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
  if (primitive.getMode() === 4) return Math.floor(count / 3)
  if (primitive.getMode() === 5 || primitive.getMode() === 6) return Math.max(0, count - 2)
  return 0
}

function matrixElements(node) {
  return new Matrix4().fromArray(node.getWorldMatrix()).elements.map((value) => Number(value.toPrecision(12)))
}

function maximumMatrixDelta(left, right) {
  let maximum = 0
  for (let index = 0; index < 16; index += 1) maximum = Math.max(maximum, Math.abs(left[index] - right[index]))
  return maximum
}

function materialSignature(material) {
  if (!material) return stableSha256({ defaultMaterial: true })
  return stableSha256({
    name: material.getName() || '',
    alphaMode: material.getAlphaMode(),
    alphaCutoff: material.getAlphaCutoff(),
    doubleSided: material.getDoubleSided(),
    baseColorFactor: material.getBaseColorFactor(),
    metallicFactor: material.getMetallicFactor(),
    roughnessFactor: material.getRoughnessFactor(),
    emissiveFactor: material.getEmissiveFactor(),
  })
}

function texturesForMaterial(material) {
  if (!material) return []
  const graph = material.getGraph()
  const textures = new Set()
  const visited = new Set()
  const visit = (property) => {
    if (visited.has(property)) return
    visited.add(property)
    for (const edge of graph.listChildEdges(property)) {
      const child = edge.getChild()
      if (child instanceof Texture) textures.add(child)
      else if (child instanceof ExtensionProperty) visit(child)
    }
  }
  visit(material)
  return [...textures]
}

function disposeUnreferencedRootResources(document) {
  const root = document.getRoot()
  const usedMeshes = new Set(root.listNodes().map((node) => node.getMesh()).filter(Boolean))
  for (const mesh of [...root.listMeshes()]) {
    if (!usedMeshes.has(mesh)) mesh.dispose()
  }
  const usedMaterials = new Set([...usedMeshes]
    .flatMap((mesh) => mesh.listPrimitives())
    .map((primitive) => primitive.getMaterial())
    .filter(Boolean))
  for (const material of [...root.listMaterials()]) {
    if (!usedMaterials.has(material)) material.dispose()
  }
  const usedTextures = new Set([...usedMaterials].flatMap(texturesForMaterial))
  for (const texture of [...root.listTextures()]) {
    if (!usedTextures.has(texture)) texture.dispose()
  }
}

async function dependencyFacts(document, outputPath) {
  const root = document.getRoot()
  const renderNodes = root.listNodes().filter((node) => node.getMesh())
  const usedMeshes = new Set(renderNodes.map((node) => node.getMesh()))
  const usedMaterials = new Set([...usedMeshes]
    .flatMap((mesh) => mesh.listPrimitives())
    .map((primitive) => primitive.getMaterial())
    .filter(Boolean))
  const usedTextures = new Set([...usedMaterials].flatMap(texturesForMaterial))
  const uniqueImages = new Map()
  for (const texture of usedTextures) {
    const image = texture.getImage()
    if (!image) continue
    const digest = sha256(image)
    if (!uniqueImages.has(digest)) uniqueImages.set(digest, image.byteLength)
  }
  const accessorArrays = new Set(root.listAccessors().map((accessor) => accessor.getArray()).filter(Boolean))
  return {
    output: await fileEvidence(outputPath),
    renderNodeCount: renderNodes.length,
    rootMeshCount: root.listMeshes().length,
    usedMeshCount: usedMeshes.size,
    unreferencedMeshCount: root.listMeshes().filter((mesh) => !usedMeshes.has(mesh)).length,
    rootMaterialCount: root.listMaterials().length,
    usedMaterialCount: usedMaterials.size,
    unreferencedMaterialCount: root.listMaterials().filter((material) => !usedMaterials.has(material)).length,
    rootTextureCount: root.listTextures().length,
    usedTextureCount: usedTextures.size,
    unreferencedTextureCount: root.listTextures().filter((texture) => !usedTextures.has(texture)).length,
    uniqueReferencedImageCount: uniqueImages.size,
    uniqueReferencedEncodedImageBytes: [...uniqueImages.values()].reduce((sum, bytes) => sum + bytes, 0),
    accessorCount: root.listAccessors().length,
    uniqueDecodedAccessorArrayBytes: [...accessorArrays].reduce((sum, array) => sum + array.byteLength, 0),
    pruning: 'gltf-transform-prune-after-explicit-node-disposal',
  }
}

function sourceNodeFacts(document, selectedPaths) {
  const { paths } = activeScenePaths(document.getRoot())
  const byPath = new Map([...paths].map(([node, path]) => [path, node]))
  return Object.fromEntries(selectedPaths.map((path) => {
    const node = byPath.get(path)
    assert.ok(node?.getMesh(), `Selected source path ${path} is not a mesh node`)
    const primitives = node.getMesh().listPrimitives()
    return [path, {
      worldMatrix: matrixElements(node),
      primitiveTriangles: primitives.map(triangleCount),
      materialSignatures: primitives.map((primitive) => materialSignature(primitive.getMaterial())),
      instanceCount: instanceCount(node),
    }]
  }))
}

function neutralizeMaterialForReview(material) {
  material.setBaseColorTexture(null)
  material.setMetallicRoughnessTexture(null)
  material.setNormalTexture(null)
  material.setOcclusionTexture(null)
  material.setEmissiveTexture(null)
  material.getExtension('KHR_materials_transmission')?.setTransmissionTexture?.(null)
  material.getExtension('KHR_materials_specular')?.setSpecularTexture?.(null)
  material.getExtension('KHR_materials_specular')?.setSpecularColorTexture?.(null)
  material.setBaseColorFactor([0.62, 0.68, 0.76, 1])
  material.setMetallicFactor(0)
  material.setRoughnessFactor(0.82)
  material.setEmissiveFactor([0.42, 0.48, 0.62])
}

async function retainSourcePaths(document, selectedPaths, { annotate = false, geometryReview = false } = {}) {
  const root = document.getRoot()
  const { paths } = activeScenePaths(root)
  const byPath = new Map([...paths].map(([node, path]) => [path, node]))
  const selectedNodes = selectedPaths.map((path) => {
    const node = byPath.get(path)
    assert.ok(node?.getMesh(), `Cannot retain missing mesh path ${path}`)
    return node
  })
  const previousScenes = [...root.listScenes()]
  const scene = document.createScene('DisabledUnownedStructuralShell')
  root.setDefaultScene(scene)
  selectedNodes.forEach((node, index) => {
    // Every __unowned__ render node is a scene-root path, but some are also
    // transform parents of animated owner subtrees. A shell claim owns only
    // the selected node's mesh, never its descendants. Keeping those children
    // would silently duplicate foreign-owner geometry in the shell GLB.
    for (const child of [...node.listChildren()]) node.removeChild(child)
    scene.addChild(node)
    if (annotate) {
      const sourcePath = selectedPaths[index]
      node.setExtras({
        ...node.getExtras(),
        iomUnownedStructuralShellSourcePath: sourcePath,
        iomUnownedStructuralShellSelection: 'reviewed-explicit-source-node-allowlist-v1',
      })
    }
  })
  for (const previous of previousScenes) previous.dispose()
  const retained = new Set(selectedNodes)
  for (const node of [...root.listNodes()]) {
    if (!retained.has(node)) node.dispose()
  }
  for (const animation of [...root.listAnimations()]) animation.dispose()
  if (geometryReview) {
    for (const material of root.listMaterials()) neutralizeMaterialForReview(material)
  }
  disposeUnreferencedRootResources(document)
  await document.transform(prune({ keepAttributes: true, keepIndices: true, keepExtras: true }))
  if (geometryReview) {
    for (const extension of [...root.listExtensionsUsed()]) {
      if (extension.extensionName === 'KHR_texture_basisu') extension.dispose()
    }
  }
  return document
}

async function prepareWholeDocumentReview(document) {
  const root = document.getRoot()
  for (const animation of [...root.listAnimations()]) animation.dispose()
  for (const material of root.listMaterials()) neutralizeMaterialForReview(material)
  disposeUnreferencedRootResources(document)
  await document.transform(prune({ keepAttributes: true, keepIndices: true, keepExtras: true }))
  for (const extension of [...root.listExtensionsUsed()]) {
    if (extension.extensionName === 'KHR_texture_basisu') extension.dispose()
  }
  return document
}

function outputNodeFacts(document) {
  const facts = {}
  const renderNodes = document.getRoot().listNodes().filter((node) => node.getMesh())
  for (const node of renderNodes) {
    const path = node.getExtras()?.iomUnownedStructuralShellSourcePath
    assert.ok(path, `Output contains an unclaimed render node ${node.getName() || '(unnamed)'}`)
    assert.ok(node.getMesh(), `Annotated output node ${path} has no mesh`)
    const primitives = node.getMesh().listPrimitives()
    facts[path] = {
      worldMatrix: matrixElements(node),
      primitiveTriangles: primitives.map(triangleCount),
      materialSignatures: primitives.map((primitive) => materialSignature(primitive.getMaterial())),
      instanceCount: instanceCount(node),
    }
  }
  assert.equal(Object.keys(facts).length, renderNodes.length, 'Output render-node ownership annotations are incomplete')
  return facts
}

function selectedUnitFacts(plan, variant, staticUnitIds) {
  const selectedPathSet = new Set(STRUCTURAL_SOURCE_PATHS)
  const selected = plan.variants[variant].units.filter((unit) => selectedPathSet.has(unit.sourcePath))
  const selectedIds = selected.map((unit) => unit.id).sort()
  assert.ok(selected.every((unit) => staticUnitIds.has(unit.id)), `${variant}: selection contains repeat or migrated Fire units`)
  assert.ok(REQUIRED_GROUND_ENVELOPE_ANCHORS.every((path) => selectedPathSet.has(path)), 'Required ground/envelope anchor is absent')
  const sourcePaths = [...new Set(selected.map((unit) => unit.sourcePath))].sort()
  assert.deepEqual(sourcePaths, STRUCTURAL_SOURCE_PATHS, `${variant}: selected source path set changed`)
  const nodeIds = [...new Set(selected.map((unit) => unit.nodeId))].sort()
  const instanceIds = [...new Set(selected.map((unit) => unit.instanceId))].sort()
  const materialNames = [...new Set(selected.map((unit) => unit.material.name))].sort()
  return {
    units: selected,
    sourcePaths,
    sourceUnitIds: selectedIds,
    nodeIds,
    instanceIds,
    materialNames,
    summary: {
      sourcePathCount: sourcePaths.length,
      sourcePathsSha256: stringListSha256(sourcePaths),
      renderNodeCount: nodeIds.length,
      nodeIdsSha256: stringListSha256(nodeIds),
      logicalInstanceCount: instanceIds.length,
      instanceIdsSha256: stringListSha256(instanceIds),
      atomicUnitCount: selectedIds.length,
      unitIdsSha256: stringListSha256(selectedIds),
      expandedTriangles: selected.reduce((sum, unit) => sum + unit.triangles, 0),
      sourceRendererDraws: new Set(selected.map((unit) => `${unit.nodeId}/primitive/${unit.primitiveIndex}`)).size,
      materialCount: materialNames.length,
      materialNamesSha256: stringListSha256(materialNames),
    },
  }
}

function segmentIds(plan, variant) {
  const repeat = plan.repeatCandidate.variants[variant].batches.flatMap((batch) => batch.sourceUnitIds)
  const fire = plan.fireHoseMigration.variants[variant].sourceUnitIds
  const all = plan.variants[variant].units.map((unit) => unit.id)
  const reserved = new Set([...repeat, ...fire])
  const staticRemainder = all.filter((id) => !reserved.has(id)).sort()
  assert.equal(repeat.length, 312, `${variant}: repeat segment changed`)
  assert.equal(fire.length, 60, `${variant}: Fire segment changed`)
  assert.equal(staticRemainder.length, 2_843, `${variant}: static remainder changed`)
  return { repeat, fire, staticRemainder, staticUnitIds: new Set(staticRemainder) }
}

async function buildVariant(io, out, plan, contract, variant) {
  const sourcePath = SOURCE_PATHS[variant]
  const sourceEvidence = await fileEvidence(sourcePath, plan.variants[variant].source.url)
  assert.equal(sourceEvidence.sha256, plan.variants[variant].source.sha256, `${variant}: partition-plan source hash is stale`)
  assert.equal(sourceEvidence.sha256, contract.variants[variant].source.sha256, `${variant}: whole-layer source hash is stale`)
  const segments = segmentIds(plan, variant)
  const selection = selectedUnitFacts(plan, variant, segments.staticUnitIds)
  assert.ok(selection.summary.expandedTriangles <= MAX_EXPANDED_TRIANGLES,
    `${variant}: ${selection.summary.expandedTriangles} exceeds ${MAX_EXPANDED_TRIANGLES} triangles`)

  const sourceDocument = await io.read(sourcePath)
  const before = sourceNodeFacts(sourceDocument, selection.sourcePaths)
  const outputPath = resolve(out, 'hlod', variant, 'unowned-structural-shell.glb')
  await mkdir(dirname(outputPath), { recursive: true })
  await io.write(outputPath, await retainSourcePaths(sourceDocument, selection.sourcePaths, { annotate: true }))
  const outputDocument = await io.read(outputPath)
  const after = outputNodeFacts(outputDocument)
  const dependencies = await dependencyFacts(outputDocument, outputPath)
  assert.equal(dependencies.unreferencedMeshCount, 0, `${variant}: unreferenced meshes remain in shell`)
  assert.equal(dependencies.unreferencedMaterialCount, 0, `${variant}: unreferenced materials remain in shell`)
  assert.equal(dependencies.unreferencedTextureCount, 0, `${variant}: unreferenced textures remain in shell`)
  assert.deepEqual(Object.keys(after).sort(), selection.sourcePaths, `${variant}: output source ownership paths changed`)
  let maxWorldMatrixDelta = 0
  for (const path of selection.sourcePaths) {
    assert.deepEqual(after[path].primitiveTriangles, before[path].primitiveTriangles, `${variant}:${path} topology changed`)
    assert.deepEqual(after[path].materialSignatures, before[path].materialSignatures, `${variant}:${path} material sidedness/factors changed`)
    assert.equal(after[path].instanceCount, before[path].instanceCount, `${variant}:${path} instance count changed`)
    maxWorldMatrixDelta = Math.max(maxWorldMatrixDelta, maximumMatrixDelta(after[path].worldMatrix, before[path].worldMatrix))
  }
  assert.ok(maxWorldMatrixDelta <= 1e-9, `${variant}: world-transform drift ${maxWorldMatrixDelta}`)

  const staticNodePaths = [...new Set(plan.variants[variant].units
    .filter((unit) => segments.staticUnitIds.has(unit.id))
    .map((unit) => unit.sourcePath))].sort()
  const reviewRoot = resolve(out, 'visual-qa', 'inputs')
  await mkdir(reviewRoot, { recursive: true })
  const sourceReviewPath = resolve(reviewRoot, `${variant}-source-static-geometry-review.glb`)
  const shellReviewPath = resolve(reviewRoot, `${variant}-shell-geometry-review.glb`)
  await io.write(sourceReviewPath, await retainSourcePaths(await io.read(sourcePath), staticNodePaths, { geometryReview: true }))
  await io.write(shellReviewPath, await prepareWholeDocumentReview(await io.read(outputPath)))

  const selectedSet = new Set(selection.sourceUnitIds)
  const detailComplement = segments.staticRemainder.filter((id) => !selectedSet.has(id))
  assert.equal(detailComplement.length + selection.sourceUnitIds.length, 2_843, `${variant}: shell/detail conservation failed`)
  assert.equal(new Set([...detailComplement, ...selection.sourceUnitIds]).size, 2_843, `${variant}: shell/detail overlap detected`)
  assert.equal(selection.sourceUnitIds.filter((id) => segments.fire.includes(id)).length, 0, `${variant}: Fire overlap detected`)
  assert.equal(selection.sourceUnitIds.filter((id) => segments.repeat.includes(id)).length, 0, `${variant}: repeat overlap detected`)

  return {
    source: sourceEvidence,
    shell: await fileEvidence(outputPath),
    visualQaInputs: {
      sourceStatic: await fileEvidence(sourceReviewPath),
      shell: await fileEvidence(shellReviewPath),
    },
    dependencies,
    selection: {
      ...selection.summary,
      sourcePaths: selection.sourcePaths,
      sourceUnitIds: selection.sourceUnitIds,
      materialNames: selection.materialNames,
      maxWorldMatrixDelta,
      topologyPreserved: true,
      materialSidednessAndFactorsPreserved: true,
      sourceNodeSelectionIsWholeNode: true,
    },
    ownership: {
      sourceOwner: OWNER,
      atomicUnit: 'mesh-primitive-instance',
      staticRemainderAtomicUnits: segments.staticRemainder.length,
      staticRemainderUnitIdsSha256: stringListSha256(segments.staticRemainder),
      shellAtomicUnits: selection.sourceUnitIds.length,
      shellUnitIdsSha256: selection.summary.unitIdsSha256,
      detailComplementAtomicUnits: detailComplement.length,
      detailComplementUnitIdsSha256: stringListSha256(detailComplement),
      repeatOverlapAtomicUnits: 0,
      migratedFireOverlapAtomicUnits: 0,
      foreignOwnerOverlapAtomicUnits: 0,
      unionAtomicUnits: new Set([...detailComplement, ...selection.sourceUnitIds]).size,
      multiplicityViolations: 0,
    },
  }
}

function buildOwnershipAudit(candidate, plan, repartition) {
  const variants = {}
  const errors = []
  for (const variant of VARIANTS) {
    const record = candidate.variants[variant]
    const selection = record.selection
    const ownership = record.ownership
    if (selection.expandedTriangles > MAX_EXPANDED_TRIANGLES) errors.push(`${variant}: triangle budget exceeded`)
    if (selection.sourcePathCount !== STRUCTURAL_SOURCE_PATHS.length) errors.push(`${variant}: source path count differs`)
    if (selection.sourcePathsSha256 !== stringListSha256(STRUCTURAL_SOURCE_PATHS)) errors.push(`${variant}: source path digest differs`)
    if (selection.maxWorldMatrixDelta > 1e-9) errors.push(`${variant}: transform drift`)
    if (!selection.topologyPreserved || !selection.materialSidednessAndFactorsPreserved) errors.push(`${variant}: lossless contract failed`)
    if (ownership.staticRemainderAtomicUnits !== 2_843 || ownership.unionAtomicUnits !== 2_843) errors.push(`${variant}: static remainder not conserved`)
    if (ownership.shellAtomicUnits + ownership.detailComplementAtomicUnits !== 2_843) errors.push(`${variant}: shell/detail count mismatch`)
    if (ownership.repeatOverlapAtomicUnits || ownership.migratedFireOverlapAtomicUnits ||
      ownership.foreignOwnerOverlapAtomicUnits || ownership.multiplicityViolations) errors.push(`${variant}: ownership overlap`)
    if (record.source.sha256 !== plan.variants[variant].source.sha256) errors.push(`${variant}: stale source pin`)
    const repartitionVariant = repartition.variants?.[variant]
    if (repartitionVariant?.shell?.sourceUnitIdsSha256 !== selection.unitIdsSha256 ||
      JSON.stringify(repartitionVariant?.shell?.sourceUnitIds) !== JSON.stringify(selection.sourceUnitIds)) {
      errors.push(`${variant}: repartition shell unit list differs from candidate`)
    }
    if (repartitionVariant?.detailComplement?.atomicUnitCount !== ownership.detailComplementAtomicUnits ||
      repartitionVariant?.detailComplement?.sourceUnitIdsSha256 !== ownership.detailComplementUnitIdsSha256) {
      errors.push(`${variant}: repartition detail-complement claim differs from candidate`)
    }
  }
  if (JSON.stringify(candidate.variants.web.selection.sourcePaths) !== JSON.stringify(candidate.variants.quest.selection.sourcePaths)) {
    errors.push('Web/Quest source path selections differ')
  }
  return {
    schema: 'IOM_UNOWNED_STRUCTURAL_SHELL_OWNERSHIP_AUDIT',
    version: 1,
    generatedAt: new Date().toISOString(),
    candidateSchema: candidate.schema,
    candidateVersion: candidate.version,
    owner: OWNER,
    maximumExpandedTrianglesPerVariant: MAX_EXPANDED_TRIANGLES,
    assertions: {
      sourceHashesPinned: true,
      selectedOnlyFromExactStaticRemainder: true,
      selectedWholeSourceNodesOnly: true,
      shellDetailUnionExactlyCoversStaticRemainder: true,
      repeatAndMigratedFireDisjoint: true,
      nonUnownedOwnerClaimsUntouched: true,
      connectorOwnersUntouched: true,
      requiredGroundEnvelopeAnchorsSelected: true,
      losslessTopologyAndMaterialSidedness: true,
      zeroWorldTransformDrift: true,
      productionManifestAndRoutesUntouched: true,
      original122PayloadCandidateExplicitlyIncompatible: true,
      explicitRepartitionListsPinned: true,
    },
    variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
      expandedTriangles: candidate.variants[variant].selection.expandedTriangles,
      sourcePathCount: candidate.variants[variant].selection.sourcePathCount,
      atomicUnitCount: candidate.variants[variant].selection.atomicUnitCount,
      detailComplementAtomicUnits: candidate.variants[variant].ownership.detailComplementAtomicUnits,
      maxWorldMatrixDelta: candidate.variants[variant].selection.maxWorldMatrixDelta,
    }])),
    errors,
    passed: errors.length === 0,
    ready: false,
    activationApproved: false,
    limitation: 'Exact ownership and lossless extraction do not prove architectural coverage; multi-angle visual QA is mandatory.',
  }
}

const args = parseArgs(process.argv)
await mkdir(args.out, { recursive: true })
const [planBytes, contractBytes] = await Promise.all([readFile(PLAN_PATH), readFile(CONTRACT_PATH)])
const plan = JSON.parse(planBytes)
const contract = JSON.parse(contractBytes)
assert.equal(plan.schema, 'IOM_UNOWNED_STATIC_PARTITION_PLAN')
assert.equal(plan.version, 1)
assert.equal(plan.enabled, false)
assert.equal(plan.productionModified, false)
assert.equal(plan.productionRoutingChanged, false)
assert.equal(contract.schema, 'IOM_WHOLE_LAYER_VISUAL_OWNERSHIP_CONTRACT')
assert.equal(contract.version, 1)
assert.equal(plan.wholeLayerCoverageDigestSha256, contract.coverageDigestSha256)
const io = await createGltfIO({ encoder: true })
const variants = {}
for (const variant of VARIANTS) variants[variant] = await buildVariant(io, args.out, plan, contract, variant)

const repartition = {
  schema: 'IOM_UNOWNED_STRUCTURAL_SHELL_REPARTITION',
  version: 1,
  generatedAt: new Date().toISOString(),
  modelId: 'icm-anim-2025',
  enabled: false,
  ready: false,
  activationApproved: false,
  sourceOwner: OWNER,
  atomicUnit: 'mesh-primitive-instance',
  identityPolicy: 'whole-layer-owner-relative-path-primitive-instance-v1',
  sourcePartitionPlan: {
    path: relative(VIEWER_ROOT, PLAN_PATH).replaceAll('\\', '/'),
    bytes: planBytes.length,
    sha256: sha256(planBytes),
    planDigestSha256: plan.planDigestSha256,
    originalStaticAtomicUnits: 2_843,
  },
  compositionGuard: {
    original122PayloadCandidateCompatible: false,
    reason: 'The original 122-package plan still claims all 2,843 static units, including this shell selection.',
    requiredAction: 'Rebuild payloads from each variant detailComplement.sourceUnitIds and pin requiredPayloadInputUnitIdsSha256 before composition.',
    failClosedOnOriginalPlanDigest: plan.planDigestSha256,
  },
  variants: {},
}
for (const variant of VARIANTS) {
  const segments = segmentIds(plan, variant)
  const shellIds = variants[variant].selection.sourceUnitIds
  const shellSet = new Set(shellIds)
  const detailComplementIds = segments.staticRemainder.filter((id) => !shellSet.has(id))
  assert.equal(new Set([...shellIds, ...detailComplementIds]).size, 2_843, `${variant}: repartition union is incomplete`)
  repartition.variants[variant] = {
    source: variants[variant].source,
    shell: {
      sourcePathCount: variants[variant].selection.sourcePathCount,
      sourcePathsSha256: variants[variant].selection.sourcePathsSha256,
      sourcePaths: variants[variant].selection.sourcePaths,
      atomicUnitCount: shellIds.length,
      sourceUnitIdsSha256: stringListSha256(shellIds),
      sourceUnitIds: shellIds,
    },
    detailComplement: {
      atomicUnitCount: detailComplementIds.length,
      sourceUnitIdsSha256: stringListSha256(detailComplementIds),
      requiredPayloadInputUnitIdsSha256: stringListSha256(detailComplementIds),
      sourceUnitIds: detailComplementIds,
    },
    conservation: {
      originalStaticAtomicUnits: segments.staticRemainder.length,
      shellPlusDetailAtomicUnits: shellIds.length + detailComplementIds.length,
      unionAtomicUnits: new Set([...shellIds, ...detailComplementIds]).size,
      overlapAtomicUnits: shellIds.filter((id) => detailComplementIds.includes(id)).length,
      omittedAtomicUnits: segments.staticRemainder.filter((id) => !shellSet.has(id) && !detailComplementIds.includes(id)).length,
      repeatOverlapAtomicUnits: shellIds.filter((id) => segments.repeat.includes(id)).length,
      migratedFireOverlapAtomicUnits: shellIds.filter((id) => segments.fire.includes(id)).length,
    },
  }
}
repartition.repartitionDigestSha256 = stableSha256({ ...repartition, generatedAt: null, repartitionDigestSha256: null })
const repartitionPath = resolve(args.out, 'ownership-repartition.json')
await writeFile(repartitionPath, `${JSON.stringify(repartition, null, 2)}\n`)
const repartitionEvidence = await fileEvidence(repartitionPath)

const dependencyAudit = {
  schema: 'IOM_UNOWNED_STRUCTURAL_SHELL_DEPENDENCY_AUDIT',
  version: 1,
  generatedAt: new Date().toISOString(),
  enabled: false,
  ready: false,
  activationApproved: false,
  variants: Object.fromEntries(VARIANTS.map((variant) => [variant, variants[variant].dependencies])),
  conclusions: [
    'All unreferenced nodes, meshes, materials and textures are explicitly disposed before the GLB is written.',
    'Remaining image bytes are reachable from selected source materials and were not downsampled or visually altered.',
    'Release activation remains blocked until immutable shared textures or a reviewed shell atlas removes cross-package duplication.',
  ],
}
const dependencyAuditPath = resolve(args.out, 'dependency-audit.json')
await writeFile(dependencyAuditPath, `${JSON.stringify(dependencyAudit, null, 2)}\n`)
const dependencyAuditEvidence = await fileEvidence(dependencyAuditPath)

const candidate = {
  schema: 'IOM_UNOWNED_STRUCTURAL_SHELL_CANDIDATE',
  version: 1,
  generatedAt: new Date().toISOString(),
  modelId: 'icm-anim-2025',
  enabled: false,
  ready: false,
  activationApproved: false,
  runtimeIntegrated: false,
  productionModified: false,
  productionRoutingChanged: false,
  owner: OWNER,
  role: 'always-resident-ground-exterior-structural-shell-candidate',
  selectionPolicy: {
    id: 'reviewed-explicit-source-node-allowlist-v1',
    sourceNodePaths: STRUCTURAL_SOURCE_PATHS,
    sourceNodePathsSha256: stringListSha256(STRUCTURAL_SOURCE_PATHS),
    requiredGroundEnvelopeAnchors: REQUIRED_GROUND_ENVELOPE_ANCHORS,
    automaticDecimation: false,
    topologyMode: 'lossless-whole-source-node-subset',
  },
  budgets: { maximumExpandedTrianglesPerVariant: MAX_EXPANDED_TRIANGLES },
  evidencePins: {
    unownedPartitionPlan: { path: relative(VIEWER_ROOT, PLAN_PATH).replaceAll('\\', '/'), bytes: planBytes.length, sha256: sha256(planBytes) },
    wholeLayerOwnershipContract: { path: relative(VIEWER_ROOT, CONTRACT_PATH).replaceAll('\\', '/'), bytes: contractBytes.length, sha256: sha256(contractBytes), coverageDigestSha256: contract.coverageDigestSha256 },
    ownershipRepartition: repartitionEvidence,
    dependencyAudit: dependencyAuditEvidence,
  },
  variants,
  safety: {
    fireHoseOwnership: 'excluded-by-exact-60-unit-migration-set',
    repeatFurnitureOwnership: 'excluded-by-exact-312-unit-repeat-set',
    connectorOwnership: 'unchanged-foreign-owner-claims-not-selected',
    groundEnvelope: 'required-source-anchors-selected-losslessly',
    transparentAndNonstructuralDetail: 'not-a-shell-coverage-requirement',
    fallback: 'production-monolithic-model-remains-the-only-live-route',
  },
  visualQa: {
    requiredViews: ['front', 'back', 'left', 'right', 'top', 'bottom', 'grazing'],
    requiredComparisons: ['source-static-vs-shell', 'web-shell-vs-quest-shell'],
    status: 'inputs-prepared-render-and-audit-required',
    projectionAudit: 'visual-qa/projection-audit.json',
    manualOpposingAngleApproval: false,
  },
  blockers: [
    'Multi-angle source-static versus shell projection audit and DCC review are not yet approved.',
    'The candidate is a lossless source subset, not an authored low-poly closure mesh; omitted structural pixels may still be holes.',
    'The original 122-payload candidate is explicitly incompatible because it still claims the shell units; payloads must be rebuilt from the pinned detail-complement IDs.',
    'Remaining reachable source textures require immutable sharing or a reviewed shell atlas before release.',
    'Physical desktop and Quest GPU acceptance has not been performed.',
  ],
}
candidate.candidateDigestSha256 = stableSha256({ ...candidate, generatedAt: null, candidateDigestSha256: null })
const candidatePath = resolve(args.out, 'candidate-index.json')
await writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`)
const audit = buildOwnershipAudit(candidate, plan, repartition)
audit.candidateIndex = await fileEvidence(candidatePath)
audit.ownershipRepartition = repartitionEvidence
audit.dependencyAudit = dependencyAuditEvidence
const auditPath = resolve(args.out, 'ownership-audit.json')
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`)
assert.ok(audit.passed, audit.errors.join('\n'))
console.log(JSON.stringify({
  candidate: relative(VIEWER_ROOT, candidatePath).replaceAll('\\', '/'),
  audit: relative(VIEWER_ROOT, auditPath).replaceAll('\\', '/'),
  variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
    triangles: variants[variant].selection.expandedTriangles,
    paths: variants[variant].selection.sourcePathCount,
    units: variants[variant].selection.atomicUnitCount,
    shellBytes: variants[variant].shell.bytes,
  }])),
  ready: false,
  activationApproved: false,
}, null, 2))
