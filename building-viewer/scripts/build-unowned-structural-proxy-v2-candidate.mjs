/**
 * Finalize the second disabled __unowned__ structural proxy candidate.
 *
 * The script is intentionally fail-closed: it validates exact whole-path and
 * atomic-unit ownership, topology, dependency hygiene, opposing-side
 * visibility, and the 150k expanded-triangle ceiling before emitting isolated
 * evidence. It never changes production assets or routing.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prune } from '@gltf-transform/functions'
import { createGltfIO } from './lib/gltf-io.mjs'
import { stringListSha256 } from './lib/whole-layer-ownership-contract.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const OUT = resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-unowned-structural-proxy-v2')
const PREPARED_PATH = resolve(OUT, 'prepared-inputs.json')
const DCC_PATH = resolve(OUT, 'dcc', 'unowned-structural-proxy-v2.glb')
const DCC_REPORT_PATH = resolve(OUT, 'dcc', 'blender-proxy-report.json')
const PLAN_PATH = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v1', 'unowned-static-partition-plan-v1.json')
const CONTRACT_PATH = resolve(VIEWER_ROOT, 'tmp', 'whole-layer-ownership-v1', 'whole-layer-ownership-contract-v1.json')
const REPARTITION_PATH = resolve(OUT, 'ownership-repartition-v2.json')
const DEPENDENCY_PATH = resolve(OUT, 'dependency-audit-v2.json')
const TOPOLOGY_PATH = resolve(OUT, 'topology-audit-v2.json')
const CANDIDATE_PATH = resolve(OUT, 'candidate-index.json')
const OWNERSHIP_AUDIT_PATH = resolve(OUT, 'ownership-audit-v2.json')
const ASSET_PATHS = Object.freeze({
  web: resolve(OUT, 'hlod', 'web', 'unowned-structural-proxy-v2.glb'),
  quest: resolve(OUT, 'hlod', 'quest', 'unowned-structural-proxy-v2.glb'),
})
const VARIANTS = Object.freeze(['web', 'quest'])
const MAX_TRIANGLES = 150_000
const MATERIAL_EXTENSION_NAMES = Object.freeze([
  'KHR_materials_anisotropy',
  'KHR_materials_clearcoat',
  'KHR_materials_diffuse_transmission',
  'KHR_materials_dispersion',
  'KHR_materials_emissive_strength',
  'KHR_materials_ior',
  'KHR_materials_iridescence',
  'KHR_materials_sheen',
  'KHR_materials_specular',
  'KHR_materials_transmission',
  'KHR_materials_unlit',
  'KHR_materials_volume',
])

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function difference(left, right) {
  const rightSet = new Set(right)
  return left.filter((value) => !rightSet.has(value))
}

function intersection(left, right) {
  const rightSet = new Set(right)
  return left.filter((value) => rightSet.has(value))
}

function relativePath(path) {
  return relative(VIEWER_ROOT, path).replaceAll('\\', '/')
}

async function fileEvidence(path) {
  const [bytes, info] = await Promise.all([readFile(path), stat(path)])
  return { path: relativePath(path), bytes: info.size, sha256: sha256(bytes) }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
  return fileEvidence(path)
}

function activeNodes(root) {
  const scenes = root.listScenes()
  const scene = root.getDefaultScene() ?? scenes[0]
  assert.ok(scene, 'Proxy has no active scene')
  const nodes = []
  const visited = new Set()
  const visit = (node) => {
    assert.ok(!visited.has(node), 'Proxy active scene multiply references a node')
    visited.add(node)
    nodes.push(node)
    node.listChildren().forEach(visit)
  }
  scene.listChildren().forEach(visit)
  return nodes
}

function countAndValidatePrimitive(primitive) {
  assert.equal(primitive.getMode(), 4, 'Proxy primitive is not TRIANGLES')
  const position = primitive.getAttribute('POSITION')
  const normal = primitive.getAttribute('NORMAL')
  assert.ok(position, 'Proxy primitive is missing POSITION')
  assert.ok(normal, 'Proxy primitive is missing NORMAL')
  assert.equal(normal.getCount(), position.getCount(), 'POSITION/NORMAL counts differ')
  const positions = position.getArray()
  const normals = normal.getArray()
  for (const value of positions) assert.ok(Number.isFinite(value), 'POSITION contains a non-finite value')
  for (const value of normals) assert.ok(Number.isFinite(value), 'NORMAL contains a non-finite value')
  const indices = primitive.getIndices()?.getArray() ?? null
  const elementCount = indices?.length ?? position.getCount()
  assert.equal(elementCount % 3, 0, 'Triangle element count is not divisible by three')
  let zeroAreaTriangles = 0
  const indexAt = (offset) => indices ? indices[offset] : offset
  for (let offset = 0; offset < elementCount; offset += 3) {
    const ia = indexAt(offset) * 3
    const ib = indexAt(offset + 1) * 3
    const ic = indexAt(offset + 2) * 3
    const abx = positions[ib] - positions[ia]
    const aby = positions[ib + 1] - positions[ia + 1]
    const abz = positions[ib + 2] - positions[ia + 2]
    const acx = positions[ic] - positions[ia]
    const acy = positions[ic + 1] - positions[ia + 1]
    const acz = positions[ic + 2] - positions[ia + 2]
    const cx = aby * acz - abz * acy
    const cy = abz * acx - abx * acz
    const cz = abx * acy - aby * acx
    if (cx === 0 && cy === 0 && cz === 0) zeroAreaTriangles += 1
  }
  return { triangles: elementCount / 3, zeroAreaTriangles }
}

function stripExactDegenerateTriangles(document) {
  let removed = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const [primitiveIndex, primitive] of mesh.listPrimitives().entries()) {
      if (primitive.getMode() !== 4) continue
      const position = primitive.getAttribute('POSITION')
      if (!position) continue
      const positions = position.getArray()
      const sourceIndices = primitive.getIndices()?.getArray() ?? Uint32Array.from(
        { length: position.getCount() }, (_, index) => index)
      const kept = []
      for (let offset = 0; offset < sourceIndices.length; offset += 3) {
        const a = sourceIndices[offset]
        const b = sourceIndices[offset + 1]
        const c = sourceIndices[offset + 2]
        const ia = a * 3
        const ib = b * 3
        const ic = c * 3
        const abx = positions[ib] - positions[ia]
        const aby = positions[ib + 1] - positions[ia + 1]
        const abz = positions[ib + 2] - positions[ia + 2]
        const acx = positions[ic] - positions[ia]
        const acy = positions[ic + 1] - positions[ia + 1]
        const acz = positions[ic + 2] - positions[ia + 2]
        const cx = aby * acz - abz * acy
        const cy = abz * acx - abx * acz
        const cz = abx * acy - aby * acx
        if (cx === 0 && cy === 0 && cz === 0) {
          removed += 1
          continue
        }
        kept.push(a, b, c)
      }
      if (kept.length === sourceIndices.length) continue
      assert.ok(kept.length > 0, `${mesh.getName()}:${primitiveIndex} became empty after exact-degenerate cleanup`)
      const maximumIndex = Math.max(...kept)
      const array = maximumIndex <= 65_535 ? new Uint16Array(kept) : new Uint32Array(kept)
      primitive.setIndices(document.createAccessor(`${mesh.getName()}_${primitiveIndex}_clean_indices`)
        .setType('SCALAR')
        .setArray(array))
    }
  }
  return removed
}

function inspectDocument(document, expectedPaths) {
  const root = document.getRoot()
  const nodes = activeNodes(root)
  const meshNodes = nodes.filter((node) => node.getMesh())
  const pathTriangles = new Map()
  const embeddedClaimUnitIds = []
  let expandedTriangles = 0
  let zeroAreaTriangles = 0
  for (const node of meshNodes) {
    const path = node.getExtras().iomProxySourcePath
    assert.ok(typeof path === 'string' && expectedPaths.includes(path), `Unexpected proxy source path ${path}`)
    let nodeTriangles = 0
    for (const primitive of node.getMesh().listPrimitives()) {
      const result = countAndValidatePrimitive(primitive)
      nodeTriangles += result.triangles
      zeroAreaTriangles += result.zeroAreaTriangles
      assert.ok(primitive.getMaterial()?.getDoubleSided(), `${path}: material is not double-sided`)
    }
    assert.ok(nodeTriangles > 0, `${path}: claimed mesh node has zero triangles`)
    expandedTriangles += nodeTriangles
    pathTriangles.set(path, (pathTriangles.get(path) ?? 0) + nodeTriangles)
    const claimIds = node.getExtras().iomProxyClaimAtomicUnitIds ?? []
    assert.ok(Array.isArray(claimIds), `${path}: embedded claim IDs are not an array`)
    embeddedClaimUnitIds.push(...claimIds)
  }
  const representedPaths = [...pathTriangles.keys()].sort((left, right) => left.localeCompare(right))
  assert.deepEqual(representedPaths, expectedPaths, 'Final proxy does not represent every claimed whole source path')
  assert.ok(expandedTriangles <= MAX_TRIANGLES, `Proxy exceeds ${MAX_TRIANGLES} triangles`)
  assert.equal(zeroAreaTriangles, 0, 'Proxy contains zero-area triangles')

  const referencedMeshes = new Set(meshNodes.map((node) => node.getMesh()))
  const referencedMaterials = new Set([...referencedMeshes]
    .flatMap((mesh) => mesh.listPrimitives())
    .map((primitive) => primitive.getMaterial())
    .filter(Boolean))
  const allNodes = root.listNodes()
  const allMeshes = root.listMeshes()
  const allMaterials = root.listMaterials()
  const dependency = {
    activeNodeCount: nodes.length,
    meshNodeCount: meshNodes.length,
    meshCount: allMeshes.length,
    materialCount: allMaterials.length,
    textureCount: root.listTextures().length,
    animationCount: root.listAnimations().length,
    unreferencedNodeCount: difference(allNodes, nodes).length,
    unreferencedMeshCount: difference(allMeshes, [...referencedMeshes]).length,
    unreferencedMaterialCount: difference(allMaterials, [...referencedMaterials]).length,
    unreferencedTextureCount: root.listTextures().length,
    extensionsUsed: root.listExtensionsUsed().map((extension) => extension.extensionName).sort(),
  }
  return {
    expandedTriangles,
    zeroAreaTriangles,
    representedPaths,
    sourcePathCount: representedPaths.length,
    sourcePathsSha256: stringListSha256(representedPaths),
    pathTriangles: Object.fromEntries([...pathTriangles].sort(([left], [right]) => left.localeCompare(right))),
    embeddedClaimUnitIds,
    dependency,
    meshCount: allMeshes.length,
    materialCount: allMaterials.length,
    textureCount: root.listTextures().length,
    imageCount: root.listTextures().length,
  }
}

function staticSegments(plan, variant) {
  const repeatUnitIds = sortedUnique(plan.repeatCandidate.variants[variant].batches.flatMap((batch) => batch.sourceUnitIds))
  const fireUnitIds = sortedUnique(plan.fireHoseMigration.variants[variant].sourceUnitIds)
  const excluded = new Set([...repeatUnitIds, ...fireUnitIds])
  const staticUnits = plan.variants[variant].units.filter((unit) => !excluded.has(unit.id))
  assert.equal(staticUnits.length, 2_843, `${variant}: whole static unit count changed`)
  return { repeatUnitIds, fireUnitIds, staticUnits }
}

await mkdir(resolve(OUT, 'hlod', 'web'), { recursive: true })
await mkdir(resolve(OUT, 'hlod', 'quest'), { recursive: true })
const [preparedBytes, dccReportBytes, planBytes, contractBytes] = await Promise.all([
  readFile(PREPARED_PATH),
  readFile(DCC_REPORT_PATH),
  readFile(PLAN_PATH),
  readFile(CONTRACT_PATH),
])
const prepared = JSON.parse(preparedBytes)
const dccReport = JSON.parse(dccReportBytes)
const plan = JSON.parse(planBytes)
const contract = JSON.parse(contractBytes)
assert.equal(prepared.schema, 'IOM_UNOWNED_STRUCTURAL_PROXY_V2_PREPARED_INPUTS')
assert.equal(prepared.version, 2)
assert.equal(prepared.ready, false)
assert.equal(dccReport.schema, 'IOM_BLENDER_UNOWNED_STRUCTURAL_PROXY_V2')
assert.equal(dccReport.version, 2)
assert.equal(dccReport.angleDegrees, 1)
assert.equal(dccReport.globalRatioDecimationUsed, false)
assert.equal(dccReport.zeroAreaFacesAfter, 0)
assert.equal(dccReport.materialsOpposingSideVisible, true)
assert.equal(dccReport.inputSourcePathCount, dccReport.representedSourcePathCount)
assert.ok(dccReport.trianglesAfter <= MAX_TRIANGLES)
assert.equal(plan.schema, 'IOM_UNOWNED_STATIC_PARTITION_PLAN')
assert.equal(plan.wholeLayerCoverageDigestSha256, contract.coverageDigestSha256)

const expectedPaths = sortedUnique(prepared.proxySourcePaths)
assert.equal(expectedPaths.length, prepared.proxySourcePaths.length)
assert.deepEqual(dccReport.representedSourcePaths, expectedPaths)
const io = await createGltfIO({ encoder: true })
const document = await io.read(DCC_PATH)
const root = document.getRoot()
for (const animation of [...root.listAnimations()]) animation.dispose()
for (const texture of [...root.listTextures()]) texture.dispose()
for (const material of root.listMaterials()) {
  material.setBaseColorTexture(null)
  material.setMetallicRoughnessTexture(null)
  material.setNormalTexture(null)
  material.setOcclusionTexture(null)
  material.setEmissiveTexture(null)
  material.setDoubleSided(true)
  material.setAlphaMode('OPAQUE')
  for (const extensionName of MATERIAL_EXTENSION_NAMES) material.getExtension(extensionName)?.dispose()
}
for (const extension of [...root.listExtensionsUsed()]) {
  if (MATERIAL_EXTENSION_NAMES.includes(extension.extensionName)) extension.dispose()
}
const fallbackMaterial = document.createMaterial('IOM_PROXY_DEFAULT_DOUBLE_SIDED')
  .setBaseColorFactor([0.58, 0.65, 0.74, 1])
  .setMetallicFactor(0)
  .setRoughnessFactor(0.88)
  .setAlphaMode('OPAQUE')
  .setDoubleSided(true)
for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    if (!primitive.getMaterial()) primitive.setMaterial(fallbackMaterial)
  }
}
const finalExactDegenerateTrianglesRemoved = stripExactDegenerateTriangles(document)
await document.transform(prune({ keepAttributes: true, keepIndices: true, keepExtras: true }))
await io.write(ASSET_PATHS.web, document)
await copyFile(ASSET_PATHS.web, ASSET_PATHS.quest)

const variantDocuments = Object.fromEntries(await Promise.all(VARIANTS.map(async (variant) => [
  variant,
  await io.read(ASSET_PATHS[variant]),
])))
const inspections = Object.fromEntries(VARIANTS.map((variant) => [variant, inspectDocument(variantDocuments[variant], expectedPaths)]))
for (const variant of VARIANTS) {
  assert.equal(inspections[variant].expandedTriangles,
    dccReport.trianglesAfter - finalExactDegenerateTrianglesRemoved)
  assert.equal(inspections[variant].dependency.textureCount, 0)
  assert.equal(inspections[variant].dependency.animationCount, 0)
  assert.equal(inspections[variant].dependency.unreferencedNodeCount, 0)
  assert.equal(inspections[variant].dependency.unreferencedMeshCount, 0)
  assert.equal(inspections[variant].dependency.unreferencedMaterialCount, 0)
  assert.equal(inspections[variant].dependency.unreferencedTextureCount, 0)
}
const questSegments = staticSegments(plan, 'quest')
const questExpectedClaimIds = sortedUnique(questSegments.staticUnits
  .filter((unit) => expectedPaths.includes(unit.sourcePath))
  .map((unit) => unit.id))
assert.equal(inspections.quest.embeddedClaimUnitIds.length, new Set(inspections.quest.embeddedClaimUnitIds).size,
  'Quest embedded claim unit ID is duplicated')
assert.deepEqual(sortedUnique(inspections.quest.embeddedClaimUnitIds), questExpectedClaimIds,
  'Quest embedded claim IDs do not match the selected whole paths')

const repartitionVariants = {}
for (const variant of VARIANTS) {
  const { repeatUnitIds, fireUnitIds, staticUnits } = staticSegments(plan, variant)
  const sourcePaths = expectedPaths
  const proxyUnits = staticUnits.filter((unit) => sourcePaths.includes(unit.sourcePath))
  const sourceUnitIds = proxyUnits.map((unit) => unit.id).sort()
  const detailComplementUnitIds = staticUnits.filter((unit) => !sourcePaths.includes(unit.sourcePath)).map((unit) => unit.id).sort()
  const wholeStaticUnitIds = staticUnits.map((unit) => unit.id).sort()
  const overlap = intersection(sourceUnitIds, detailComplementUnitIds)
  const union = sortedUnique([...sourceUnitIds, ...detailComplementUnitIds])
  const omissions = difference(wholeStaticUnitIds, union)
  const repeats = intersection(sourceUnitIds, repeatUnitIds)
  const fire = intersection(sourceUnitIds, fireUnitIds)
  const duplicates = sourceUnitIds.length - new Set(sourceUnitIds).size
  assert.equal(overlap.length, 0, `${variant}: proxy/detail overlap`)
  assert.equal(omissions.length, 0, `${variant}: static ownership omission`)
  assert.equal(repeats.length, 0, `${variant}: repeat ownership overlap`)
  assert.equal(fire.length, 0, `${variant}: migrated-fire ownership overlap`)
  assert.equal(duplicates, 0, `${variant}: duplicate proxy claim`)
  assert.equal(union.length, wholeStaticUnitIds.length)
  assert.equal(sourceUnitIds.length, prepared.selectedSourceClaims[variant].atomicUnitCount)
  assert.equal(stringListSha256(sourceUnitIds), prepared.selectedSourceClaims[variant].sourceUnitIdsSha256)
  repartitionVariants[variant] = {
    proxy: {
      sourcePaths,
      sourcePathsSha256: stringListSha256(sourcePaths),
      sourceUnitIds,
      sourceUnitIdsSha256: stringListSha256(sourceUnitIds),
      sourceUnitCount: sourceUnitIds.length,
      sourceExpandedTriangles: proxyUnits.reduce((sum, unit) => sum + unit.triangles, 0),
    },
    detailComplement: {
      sourceUnitIds: detailComplementUnitIds,
      sourceUnitIdsSha256: stringListSha256(detailComplementUnitIds),
      sourceUnitCount: detailComplementUnitIds.length,
    },
    conservation: {
      wholeStaticUnitCount: wholeStaticUnitIds.length,
      unionUnitCount: union.length,
      overlapCount: overlap.length,
      omissionCount: omissions.length,
      duplicateCount: duplicates,
      repeatOverlapCount: repeats.length,
      fireOverlapCount: fire.length,
    },
  }
}

const generatedAt = new Date().toISOString()
const repartition = {
  schema: 'IOM_UNOWNED_STRUCTURAL_PROXY_REPARTITION',
  version: 2,
  generatedAt,
  modelId: 'icm-anim-2025',
  enabled: false,
  ready: false,
  activationApproved: false,
  sourceOwner: '__unowned__',
  atomicUnit: 'owner/source-path/primitive/instance',
  sourcePartitionPlan: prepared.evidencePins.sourcePartitionPlan,
  compositionGuard: {
    rejectedV1PreservedReadOnly: true,
    original122PayloadCandidateCompatible: false,
    currentFrozenV2DetailPlanCompatible: false,
    requiresSeparateShellAwareDetailRebuild: true,
    materialFidelity: {
      materialFidelityReady: false,
      nearLod0Required: true,
      nearLod0PackagePresent: false,
      explicitReplacementSemanticsValidated: false,
    },
  },
  variants: repartitionVariants,
}
repartition.repartitionDigestSha256 = sha256(JSON.stringify(repartition))
const repartitionEvidence = await writeJson(REPARTITION_PATH, repartition)

const dependencyAudit = {
  schema: 'IOM_UNOWNED_STRUCTURAL_PROXY_DEPENDENCY_AUDIT',
  version: 2,
  generatedAt,
  enabled: false,
  ready: false,
  activationApproved: false,
  variants: Object.fromEntries(VARIANTS.map((variant) => [variant, inspections[variant].dependency])),
  conclusions: {
    texturesStripped: true,
    animationsStripped: true,
    unreferencedDependencies: 0,
    sourcePbrMaterialFidelityPreserved: false,
  },
}
const dependencyEvidence = await writeJson(DEPENDENCY_PATH, dependencyAudit)

const topologyAudit = {
  schema: 'IOM_UNOWNED_STRUCTURAL_PROXY_TOPOLOGY_AUDIT',
  version: 2,
  generatedAt,
  enabled: false,
  ready: false,
  activationApproved: false,
  maximumExpandedTrianglesPerVariant: MAX_TRIANGLES,
  algorithm: dccReport.algorithm,
  angleDegrees: dccReport.angleDegrees,
  globalRatioDecimationUsed: false,
  finalExactDegenerateTrianglesRemoved,
  normalsRecalculated: dccReport.normalsRecalculated,
  opposingSideVisible: true,
  boundsBefore: dccReport.boundsBefore,
  boundsAfter: dccReport.boundsAfter,
  variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
    expandedTriangles: inspections[variant].expandedTriangles,
    headroomTriangles: MAX_TRIANGLES - inspections[variant].expandedTriangles,
    zeroAreaTriangles: inspections[variant].zeroAreaTriangles,
    representedSourcePathCount: inspections[variant].sourcePathCount,
    representedSourcePathsSha256: inspections[variant].sourcePathsSha256,
    allMaterialsDoubleSided: true,
    finitePositionsAndNormals: true,
  }])),
}
const topologyEvidence = await writeJson(TOPOLOGY_PATH, topologyAudit)
const assets = Object.fromEntries(await Promise.all(VARIANTS.map(async (variant) => [variant, await fileEvidence(ASSET_PATHS[variant])])))
assert.equal(assets.web.sha256, assets.quest.sha256, 'Web/Quest proxy bytes are not identical')
const sourceStaticEvidence = Object.fromEntries(await Promise.all(VARIANTS.map(async (variant) => [
  variant,
  await fileEvidence(resolve(VIEWER_ROOT, prepared.inputs.sourceStatic[variant].path)),
])))

const candidate = {
  schema: 'IOM_UNOWNED_STRUCTURAL_PROXY_CANDIDATE',
  version: 2,
  generatedAt,
  modelId: 'icm-anim-2025',
  enabled: false,
  ready: false,
  activationApproved: false,
  runtimeIntegrated: false,
  productionModified: false,
  productionRoutingChanged: false,
  owner: '__unowned__',
  role: 'texture-free-far-structural-proxy-evidence-only',
  selectionPolicy: {
    method: 'rejected-v1-plus-horizontal-footprint-ranked-whole-paths-with-material-priority',
    sourceNodePaths: expectedPaths,
    sourceNodePathsSha256: stringListSha256(expectedPaths),
    sourceNodePathCount: expectedPaths.length,
    planarFeaturePreservingPaths: dccReport.planarProxySourcePaths,
    boundedDissolveAngleDegrees: dccReport.angleDegrees,
    globalRatioDecimationUsed: false,
  },
  budgets: { maximumExpandedTrianglesPerVariant: MAX_TRIANGLES },
  evidencePins: {
    preparedInputs: await fileEvidence(PREPARED_PATH),
    blenderProxyReport: await fileEvidence(DCC_REPORT_PATH),
    rejectedV1Candidate: prepared.evidencePins.rejectedV1Candidate,
    rejectedV1Projection: prepared.evidencePins.rejectedV1Projection,
    rejectedV1Repartition: prepared.evidencePins.rejectedV1Repartition,
    sourcePartitionPlan: prepared.evidencePins.sourcePartitionPlan,
    wholeLayerContract: prepared.evidencePins.wholeLayerContract,
    ownershipRepartition: repartitionEvidence,
    dependencyAudit: dependencyEvidence,
    topologyAudit: topologyEvidence,
  },
  variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
    asset: {
      ...assets[variant],
      expandedTriangles: inspections[variant].expandedTriangles,
      sourcePathCount: inspections[variant].sourcePathCount,
      sourcePathsSha256: inspections[variant].sourcePathsSha256,
      meshCount: inspections[variant].meshCount,
      materialCount: inspections[variant].materialCount,
      textureCount: inspections[variant].textureCount,
      imageCount: inspections[variant].imageCount,
    },
    visualQaInputs: { sourceStatic: sourceStaticEvidence[variant], proxy: assets[variant] },
  }])),
  safety: {
    exactWholePathOwnership: true,
    opposingSideVisible: true,
    zeroAreaTriangles: 0,
    dependencyAuditPassed: true,
    topologyAuditPassed: true,
    materialFidelity: {
      materialFidelityReady: false,
      proxyTextureCount: 0,
      proxyImageCount: 0,
      nearLod0Required: true,
      nearLod0PackagePresent: false,
      releaseBlocked: true,
    },
  },
  visualQa: {
    projectionAuditRequired: true,
    thresholdsMayNotBeRelaxed: true,
    manualArchitecturalApprovalRequired: true,
  },
  blockers: [
    'Seven-view projection audit must pass unchanged thresholds.',
    'Texture-free proxy cannot replace close-range source PBR materials.',
    'Mutually exclusive near-LOD0 packages and explicit replacement semantics do not exist.',
    'Runtime integration and production routing are intentionally absent.',
  ],
}
candidate.candidateDigestSha256 = sha256(JSON.stringify(candidate))
const candidateEvidence = await writeJson(CANDIDATE_PATH, candidate)

const ownershipAudit = {
  schema: 'IOM_UNOWNED_STRUCTURAL_PROXY_OWNERSHIP_AUDIT',
  version: 2,
  generatedAt,
  candidateSchema: candidate.schema,
  candidateVersion: candidate.version,
  owner: '__unowned__',
  enabled: false,
  maximumExpandedTrianglesPerVariant: MAX_TRIANGLES,
  assertions: {
    wholePathMappingExact: true,
    zeroTriangleClaimedPaths: 0,
    proxyDetailOverlapAtomicUnits: 0,
    staticOwnershipOmissions: 0,
    repeatedOwnershipClaims: 0,
    migratedFireOwnershipClaims: 0,
    duplicateProxyClaims: 0,
    questEmbeddedClaimIdsExact: true,
  },
  variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
    sourcePathCount: repartitionVariants[variant].proxy.sourcePaths.length,
    proxyAtomicUnitCount: repartitionVariants[variant].proxy.sourceUnitCount,
    detailComplementAtomicUnitCount: repartitionVariants[variant].detailComplement.sourceUnitCount,
    wholeStaticAtomicUnitCount: repartitionVariants[variant].conservation.wholeStaticUnitCount,
    expandedTriangles: inspections[variant].expandedTriangles,
  }])),
  errors: [],
  passed: true,
  ready: false,
  activationApproved: false,
  limitation: 'Ownership correctness does not satisfy silhouette, material-fidelity, near-LOD0, or manual architectural release gates.',
  candidateIndex: candidateEvidence,
  ownershipRepartition: repartitionEvidence,
  dependencyAudit: dependencyEvidence,
  topologyAudit: topologyEvidence,
}
await writeJson(OWNERSHIP_AUDIT_PATH, ownershipAudit)

console.log(JSON.stringify({
  output: relativePath(OUT),
  candidate: relativePath(CANDIDATE_PATH),
  ownershipRepartition: relativePath(REPARTITION_PATH),
  sourcePathCount: expectedPaths.length,
  variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
    triangles: inspections[variant].expandedTriangles,
    bytes: assets[variant].bytes,
    sha256: assets[variant].sha256,
    textureCount: inspections[variant].textureCount,
  }])),
  ready: false,
  activationApproved: false,
}, null, 2))
