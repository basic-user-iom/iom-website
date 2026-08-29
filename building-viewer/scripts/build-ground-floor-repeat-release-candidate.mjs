/**
 * Build a fail-closed, disabled release candidate for the dominant repeated
 * Ground Floor chair/table family.
 *
 * Inputs are the current-production-profile, parity/spatial pilots produced by
 * build-ground-floor-repeat-instancing-pilot.mjs. Final payloads are static:
 * they contain neither animation clips nor a node duplicating the persistent
 * Ground Floor rig owner. The stream loader may therefore attach them beneath
 * that owner without hierarchy or mixer conflicts.
 *
 * This script writes only below tmp/. It never edits public assets, production
 * manifests, or runtime routing.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compactPrimitive, prune } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'
import {
  accessorAsFloat32,
  attributeContract,
  boundaryGeometrySignature,
  candidateAttributeAudit,
  primitiveMaterialHash,
  simplificationPlan,
  topologyStats,
  triangleCount,
} from './build-ground-floor-selective-repeat-lod-pilot.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const WORKSPACE_ROOT = resolve(VIEWER_ROOT, '..')
const DEFAULT_SOURCE = resolve(VIEWER_ROOT, 'tmp', 'repeat-instancing-ground-floor')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', 'repeat-geometry-release-candidate')
const WEB_PRODUCTION = resolve(WORKSPACE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-web.glb')
const QUEST_PRODUCTION = resolve(WORKSPACE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-quest.glb')

const OWNER = 'Ground Floor._anim1'
const INSTANCE_COUNT = 78
const MATERIAL_SLOTS = 4
const EXPECTED_BATCHES = 52
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const LEVELS = Object.freeze([
  Object.freeze({ id: 'lod0', role: 'near', ratio: 1, error: 0 }),
  Object.freeze({ id: 'lod1-mid', role: 'mid', ratio: 0.72, error: 0.00075 }),
])
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024
const MAX_CANDIDATE_BYTES = 6 * 1024 * 1024

function parseArgs(argv) {
  const args = { source: DEFAULT_SOURCE, out: DEFAULT_OUT }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--source') args.source = resolve(argv[++index])
    else if (value === '--out') args.out = resolve(argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    )
  }
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function sha256File(path) {
  return sha256Bytes(await readFile(path))
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function normalizedValue(accessor, index) {
  const value = accessor.getArray()[index]
  if (!accessor.getNormalized()) return value
  const componentType = accessor.getComponentType()
  if (componentType === 5120) return Math.max(-1, value / 127)
  if (componentType === 5121) return value / 255
  if (componentType === 5122) return Math.max(-1, value / 32767)
  if (componentType === 5123) return value / 65535
  return value
}

function instanceMatrices(node) {
  const extension = node.getExtension('EXT_mesh_gpu_instancing')
  assert.ok(extension, `${node.getName()} lacks EXT_mesh_gpu_instancing`)
  const translation = extension.getAttribute('TRANSLATION')
  const rotation = extension.getAttribute('ROTATION')
  const scale = extension.getAttribute('SCALE')
  const count = translation?.getCount() ?? rotation?.getCount() ?? scale?.getCount() ?? 0
  assert.ok(count > 0, `${node.getName()} has no instances`)
  const matrices = []
  for (let index = 0; index < count; index += 1) {
    const t = new Vector3(
      translation ? normalizedValue(translation, index * 3) : 0,
      translation ? normalizedValue(translation, index * 3 + 1) : 0,
      translation ? normalizedValue(translation, index * 3 + 2) : 0,
    )
    const q = new Quaternion(
      rotation ? normalizedValue(rotation, index * 4) : 0,
      rotation ? normalizedValue(rotation, index * 4 + 1) : 0,
      rotation ? normalizedValue(rotation, index * 4 + 2) : 0,
      rotation ? normalizedValue(rotation, index * 4 + 3) : 1,
    ).normalize()
    const s = new Vector3(
      scale ? normalizedValue(scale, index * 3) : 1,
      scale ? normalizedValue(scale, index * 3 + 1) : 1,
      scale ? normalizedValue(scale, index * 3 + 2) : 1,
    )
    matrices.push(new Matrix4().compose(t, q, s))
  }
  return matrices
}

function batchNodes(document) {
  return document.getRoot().listNodes()
    .filter((node) => node.getExtras()?.prepartitionedRepeatBatch === true)
    .sort((left, right) => left.getName().localeCompare(right.getName()))
}

function slotPrimitives(document) {
  const nodes = batchNodes(document)
  assert.equal(nodes.length, EXPECTED_BATCHES, `Expected ${EXPECTED_BATCHES} instanced primitive nodes`)
  return Array.from({ length: MATERIAL_SLOTS }, (_, slot) => {
    const slotNodes = nodes.filter((node) => node.getExtras()?.materialSlot === slot)
    assert.equal(slotNodes.length, EXPECTED_BATCHES / MATERIAL_SLOTS, `Material slot ${slot} batch count changed`)
    const meshes = new Set(slotNodes.map((node) => node.getMesh()))
    assert.equal(meshes.size, 1, `Material slot ${slot} must share one mesh`)
    const primitive = slotNodes[0].getMesh()?.listPrimitives()[0]
    assert.ok(primitive, `Material slot ${slot} lacks a primitive`)
    return primitive
  })
}

function canonicalTransformRecord(document) {
  const canonicalNumber = (value) => Number(Number(value).toPrecision(9))
  return batchNodes(document).map((node) => {
    const extras = node.getExtras()
    const matrices = instanceMatrices(node)
    return {
      materialSlot: extras.materialSlot,
      parity: extras.instanceParity,
      spatialPartition: extras.spatialPartition,
      sourceIds: extras.sourceIds,
      hostMatrix: node.getMatrix().map(canonicalNumber),
      instanceMatrices: matrices.map((matrix) => matrix.toArray().map(canonicalNumber)),
    }
  })
}

function transformSha256(document) {
  return sha256Bytes(Buffer.from(stableStringify(canonicalTransformRecord(document))))
}

function sourcePaths(instanceMap) {
  const records = [...instanceMap.instances].sort((left, right) => left.sourceIndex - right.sourceIndex)
  assert.deepEqual(records.map((record) => record.sourceIndex), Array.from({ length: INSTANCE_COUNT }, (_, index) => index))
  const paths = records.map((record) => record.sourcePath)
  assert.equal(new Set(paths).size, INSTANCE_COUNT, 'Source paths must be unique')
  return paths
}

function makeStaticPayload(document, variant, level, paths) {
  for (const animation of [...document.getRoot().listAnimations()]) animation.dispose()
  const owners = document.getRoot().listNodes().filter((node) => node.getName() === OWNER)
  assert.equal(owners.length, 1, `${variant}:${level}: expected exactly one legacy owner staging node`)
  const payloadRoot = owners[0]
  payloadRoot.setName(`GroundFloorRepeatPayload:${variant}:${level}`)
  const ownerExtras = { ...(payloadRoot.getExtras() || {}) }
  delete ownerExtras.disabledPilotOwner
  delete ownerExtras.persistentAnimationOwner
  payloadRoot.setExtras({
    ...ownerExtras,
    disabledReleaseCandidate: true,
    runtimeIntegrated: false,
    containsPersistentOwner: false,
    attachToPersistentOwner: OWNER,
    iomPackageSourcePaths: paths,
  })
  for (const node of batchNodes(document)) {
    const extras = node.getExtras()
    node.setExtras({
      ...extras,
      disabledReleaseCandidate: true,
      runtimeIntegrated: false,
      releaseCandidateLevel: level,
      instanceIdentityGroup:
        `ground-floor-chair-table:${variant}:${extras.instanceParity}:${extras.spatialPartition}`,
    })
  }
}

function applyLevel(document, spec) {
  const primitives = slotPrimitives(document)
  const plans = simplificationPlan({ primitives }, spec)
  if (spec.ratio < 1) {
    for (let slot = 0; slot < primitives.length; slot += 1) {
      primitives[slot].getIndices().setArray(new Uint32Array(plans[slot].indices))
      compactPrimitive(primitives[slot])
    }
  }
  return plans
}

function primitiveAudit(sourcePrimitive, candidatePrimitive, plan, slot) {
  const sourceIndices = sourcePrimitive.getIndices()?.getArray()
  assert.ok(sourceIndices, `Material slot ${slot} source is not indexed`)
  const sourcePositions = accessorAsFloat32(sourcePrimitive.getAttribute('POSITION'))
  const sourceTopology = topologyStats(sourceIndices, sourcePositions)
  const indices = candidatePrimitive.getIndices()?.getArray()
  assert.ok(indices, `Material slot ${slot} candidate is not indexed`)
  const positions = accessorAsFloat32(candidatePrimitive.getAttribute('POSITION'))
  const topology = topologyStats(indices, positions)
  const boundary = boundaryGeometrySignature(candidatePrimitive)
  const sourceBoundary = boundaryGeometrySignature(sourcePrimitive)
  const attributes = candidateAttributeAudit(sourcePrimitive, candidatePrimitive)
  const record = {
    materialSlot: slot,
    sourceTriangles: triangleCount(sourcePrimitive),
    triangles: triangleCount(candidatePrimitive),
    material: candidatePrimitive.getMaterial()?.getName() ?? null,
    materialPreserved: primitiveMaterialHash(candidatePrimitive) === primitiveMaterialHash(sourcePrimitive),
    attributeContract: attributeContract(candidatePrimitive),
    attributeContractPreserved: attributes.contractPreserved,
    retainedAttributeTuplesExact: attributes.retainedTuplesExact,
    boundaryGeometryPreserved: boundary.hash === sourceBoundary.hash && boundary.count === sourceBoundary.count,
    topologyPreserved:
      plan.outputTopology.boundaryEdges === topology.boundaryEdges &&
      plan.outputTopology.connectedComponents === topology.connectedComponents &&
      plan.outputTopology.eulerCharacteristic === topology.eulerCharacteristic &&
      sourceTopology.boundaryEdges === topology.boundaryEdges &&
      sourceTopology.connectedComponents === topology.connectedComponents &&
      sourceTopology.eulerCharacteristic === topology.eulerCharacteristic &&
      topology.nonManifoldEdges <= sourceTopology.nonManifoldEdges &&
      topology.degenerateTriangles <= sourceTopology.degenerateTriangles &&
      topology.zeroAreaTriangles <= sourceTopology.zeroAreaTriangles,
    sourceTopologyBaseline: {
      nonManifoldEdges: sourceTopology.nonManifoldEdges,
      degenerateTriangles: sourceTopology.degenerateTriangles,
      zeroAreaTriangles: sourceTopology.zeroAreaTriangles,
    },
    actualRatio: plan.actualRatio,
    maxError: plan.actualError,
    approximateAbsoluteErrorSourceUnits: plan.approximateAbsoluteErrorSourceUnits,
    simplifierFallbackToExact: plan.safetyAudit.fallbackToExactSource,
  }
  const failedPreservation = Object.entries(record)
    .filter(([key, value]) => key.endsWith('Preserved') && value !== true)
    .map(([key]) => key)
  assert.deepEqual(failedPreservation, [], `Material slot ${slot} failed ${failedPreservation.join(', ')}`)
  assert.equal(record.triangles, plan.outputTriangles, `Material slot ${slot} triangle count drifted after write`)
  return record
}

function sourceIdAudit(nodes) {
  const perSlot = Array.from({ length: MATERIAL_SLOTS }, () => [])
  for (const node of nodes) {
    const extras = node.getExtras()
    assert.ok(Array.isArray(extras.sourceIds), `${node.getName()} lacks sourceIds`)
    assert.equal(extras.sourceIds.length, instanceMatrices(node).length)
    perSlot[extras.materialSlot].push(...extras.sourceIds)
  }
  for (let slot = 0; slot < MATERIAL_SLOTS; slot += 1) {
    assert.deepEqual(
      perSlot[slot].sort((left, right) => left - right),
      Array.from({ length: INSTANCE_COUNT }, (_, index) => index),
      `Material slot ${slot} source IDs are not bijective`,
    )
  }
  return sha256Bytes(Buffer.from(stableStringify(perSlot)))
}

async function auditWritten(io, path, variant, spec, sourceDocument, plans, expectedTransformSha, paths) {
  const document = await io.read(path)
  const nodes = batchNodes(document)
  assert.equal(document.getRoot().listAnimations().length, 0, `${variant}:${spec.id} illegally contains clips`)
  assert.equal(document.getRoot().listNodes().filter((node) => node.getName() === OWNER).length, 0, `${variant}:${spec.id} duplicates persistent owner`)
  assert.equal(nodes.length, EXPECTED_BATCHES)
  assert.equal(transformSha256(document), expectedTransformSha, `${variant}:${spec.id} changed instance transforms`)
  const rootsWithOwnership = document.getRoot().listNodes().filter((node) => Array.isArray(node.getExtras()?.iomPackageSourcePaths))
  assert.equal(rootsWithOwnership.length, 1)
  assert.deepEqual(rootsWithOwnership[0].getExtras().iomPackageSourcePaths, paths)

  const domains = new Map()
  let unsafeLocalMatrices = 0
  let mirroredHosts = 0
  for (const node of nodes) {
    const extras = node.getExtras()
    assert.equal(extras.releaseCandidateLevel, spec.id)
    assert.equal(extras.repeatVariant, variant)
    const matrices = instanceMatrices(node)
    unsafeLocalMatrices += matrices.filter((matrix) => matrix.determinant() <= 0).length
    const hostSign = Math.sign(new Matrix4().fromArray(node.getMatrix()).determinant())
    assert.equal(hostSign, extras.instanceParity === 'mirrored' ? -1 : 1)
    if (hostSign < 0) mirroredHosts += 1
    const group = domains.get(extras.instanceIdentityGroup) ?? []
    group.push(node)
    domains.set(extras.instanceIdentityGroup, group)
  }
  assert.equal(unsafeLocalMatrices, 0, `${variant}:${spec.id} retained a non-positive per-instance determinant`)
  assert.ok(mirroredHosts > 0, `${variant}:${spec.id} lost mirrored host batches`)
  assert.equal(domains.size, EXPECTED_BATCHES / MATERIAL_SLOTS)
  for (const [domain, members] of domains) {
    assert.equal(members.length, MATERIAL_SLOTS, `${domain} must contain four material-slot cohorts`)
    assert.deepEqual(
      members.map((node) => node.getExtras().materialSlot).sort(),
      [0, 1, 2, 3],
    )
    const referenceIds = members[0].getExtras().sourceIds
    for (const member of members.slice(1)) assert.deepEqual(member.getExtras().sourceIds, referenceIds)
  }

  const sourcePrimitives = slotPrimitives(sourceDocument)
  const candidatePrimitives = slotPrimitives(document)
  const primitives = candidatePrimitives.map((primitive, slot) =>
    primitiveAudit(sourcePrimitives[slot], primitive, plans[slot], slot))
  const uniqueTriangles = primitives.reduce((sum, primitive) => sum + primitive.triangles, 0)
  const expandedTriangles = nodes.reduce((sum, node) =>
    sum + triangleCount(node.getMesh().listPrimitives()[0]) * instanceMatrices(node).length, 0)
  const file = await stat(path)
  const attributes = [...new Set(candidatePrimitives.flatMap((primitive) => primitive.listSemantics()))].sort()
  assert.ok(attributes.includes('POSITION') && attributes.includes('NORMAL'))
  return {
    url: relative(dirname(resolve(DEFAULT_OUT, 'manifest.disabled.json')), path).replaceAll('\\', '/'),
    file: path,
    sha256: await sha256File(path),
    bytes: file.size,
    byteBudget: MAX_PAYLOAD_BYTES,
    byteBudgetPassed: file.size <= MAX_PAYLOAD_BYTES,
    animations: 0,
    duplicatePersistentOwners: 0,
    instancedPrimitiveDraws: nodes.length,
    paritySpatialGroups: domains.size,
    logicalInstances: INSTANCE_COUNT,
    instancedPrimitiveInstances: nodes.reduce((sum, node) => sum + instanceMatrices(node).length, 0),
    unsafeLocalMatrices,
    mirroredHostBatches: mirroredHosts,
    sourceIdsSha256: sourceIdAudit(nodes),
    sourcePathCount: paths.length,
    sourcePathsSha256: sha256Bytes(Buffer.from(stableStringify([...paths].sort()))),
    transformSha256: expectedTransformSha,
    attributes,
    uniqueTriangles,
    expandedTriangles,
    primitives,
  }
}

function markdown(report) {
  const rows = []
  for (const variant of ['web', 'quest']) {
    const production = report.production[variant]
    for (const level of report.payloads[variant]) {
      rows.push(
        `| ${variant} | ${level.level} | ${level.uniqueTriangles.toLocaleString()} | ` +
        `${level.expandedTriangles.toLocaleString()} | ${level.instancedPrimitiveDraws} | ` +
        `${level.bytes.toLocaleString()} |`,
      )
    }
    rows.push(
      `| ${variant} production runtime projection | current | ${production.uniqueTriangles.toLocaleString()} | ` +
      `${production.expandedTriangles.toLocaleString()} | ${production.expectedRuntimeDrawsAfterSafetyAndSpatialSplit} | ` +
      `${production.bytes.toLocaleString()} |`,
    )
  }
  return `# Ground Floor repeat-geometry release candidate\n\n` +
    `Status: **disabled; automated asset/runtime gates passed, physical target profiling and transition QA remain**.\n\n` +
    `This candidate is built from the current production Web/Quest GLBs and only targets the 78-instance ` +
    `chair/table family. It does not modify production assets or routing.\n\n` +
    `| Variant | Level | Unique tris | Submitted tris | Safe draws | Bytes |\n` +
    `| --- | --- | ---: | ---: | ---: | ---: |\n${rows.join('\n')}\n\n` +
    `## Release-critical contracts\n\n` +
    `- Final payloads contain zero animation clips and no node named \`${OWNER}\`; the persistent rig remains the sole owner.\n` +
    `- Thirteen deterministic parity/spatial identity groups each contain four material-slot batches. ` +
    `Every slot has the exact source-ID bijection 0..77, and mirrored transforms live on negative host nodes only.\n` +
    `- LOD1 uses the topology-locked conservative simplifier. Authored boundaries, connected components, materials, ` +
    `POSITION/NORMAL contracts, and retained vertex tuples are fail-closed.\n` +
    `- A farther Web LOD is not composed into this release artifact. Its isolated geometry pilot passed prior ` +
    `opposing-angle review, but the final parity/spatial payload still needs its own render and transition evidence.\n\n` +
    `## Still required before production activation\n\n` +
    report.blockers.map((item) => `- ${item}`).join('\n') + '\n'
}

async function main() {
  const args = parseArgs(process.argv)
  await mkdir(resolve(args.out, 'payloads', 'web'), { recursive: true })
  await mkdir(resolve(args.out, 'payloads', 'quest'), { recursive: true })
  await MeshoptSimplifier.ready
  const io = await createGltfIO({ encoder: true })
  const [legacyReport, instanceMap, webHash, questHash] = await Promise.all([
    readJson(resolve(args.source, 'report.json')),
    readJson(resolve(args.source, 'instance-map.json')),
    sha256File(WEB_PRODUCTION),
    sha256File(QUEST_PRODUCTION),
  ])
  assert.equal(legacyReport.production.web.sha256, webHash, 'Web production pin changed; rebuild the instancing pilot first')
  assert.equal(legacyReport.production.quest.sha256, questHash, 'Quest production pin changed; rebuild the instancing pilot first')
  const paths = sourcePaths(instanceMap)
  const sourceFiles = {
    web: resolve(args.source, 'Mesh.13786-web-owner-local-parity-spatial-instanced.glb'),
    quest: resolve(args.source, 'Mesh.13786-quest-owner-local-parity-spatial-instanced.glb'),
  }
  const payloads = { web: [], quest: [] }

  for (const variant of ['web', 'quest']) {
    const sourceDocument = await io.read(sourceFiles[variant])
    const sourceTransformSha = transformSha256(sourceDocument)
    for (const spec of LEVELS) {
      const document = await io.read(sourceFiles[variant])
      makeStaticPayload(document, variant, spec.id, paths)
      const expectedTransformSha = transformSha256(document)
      assert.equal(expectedTransformSha, sourceTransformSha)
      const plans = applyLevel(document, spec)
      await document.transform(prune({ keepAttributes: true, keepIndices: true, keepExtras: true }))
      const output = resolve(args.out, 'payloads', variant, `ground-floor-repeat-${spec.id}.glb`)
      await io.write(output, document)
      const audit = await auditWritten(
        io,
        output,
        variant,
        spec,
        sourceDocument,
        plans,
        expectedTransformSha,
        paths,
      )
      payloads[variant].push({ level: spec.id, role: spec.role, ...audit })
      console.log(
        `${variant}:${spec.id} ${audit.uniqueTriangles.toLocaleString()} unique / ` +
        `${audit.expandedTriangles.toLocaleString()} submitted tris, ${audit.instancedPrimitiveDraws} draws, ` +
        `${audit.bytes.toLocaleString()} bytes`,
      )
    }
  }

  for (const variant of ['web', 'quest']) {
    const exact = payloads[variant].find((payload) => payload.level === 'lod0')
    for (const payload of payloads[variant]) {
      payload.selectable = payload.level === 'lod0' || payload.expandedTriangles < exact.expandedTriangles
      if (!payload.selectable) {
        payload.exclusionReason = 'Topology-safe simplification fell back to exact geometry; a duplicate level has no runtime value.'
      }
    }
  }

  const candidateBytes = [...payloads.web, ...payloads.quest].reduce((sum, payload) => sum + payload.bytes, 0)
  assert.ok(payloads.web.every((payload) => payload.byteBudgetPassed))
  assert.ok(payloads.quest.every((payload) => payload.byteBudgetPassed))
  assert.ok(candidateBytes <= MAX_CANDIDATE_BYTES, 'Combined candidate exceeds offline byte budget')

  const reductions = Object.fromEntries(['web', 'quest'].map((variant) => {
    const production = legacyReport.production[variant]
    const lod0 = payloads[variant].find((payload) => payload.level === 'lod0')
    const lod1 = payloads[variant].find((payload) => payload.level === 'lod1-mid')
    return [variant, {
      safeDraws: {
        productionRuntimeProjection: production.expectedRuntimeDrawsAfterSafetyAndSpatialSplit,
        candidate: lod0.instancedPrimitiveDraws,
        saved: production.expectedRuntimeDrawsAfterSafetyAndSpatialSplit - lod0.instancedPrimitiveDraws,
        percent: Number(((1 - lod0.instancedPrimitiveDraws / production.expectedRuntimeDrawsAfterSafetyAndSpatialSplit) * 100).toFixed(2)),
      },
      lod1SubmittedTriangles: {
        production: production.expandedTriangles,
        candidate: lod1.expandedTriangles,
        saved: production.expandedTriangles - lod1.expandedTriangles,
        percent: Number(((1 - lod1.expandedTriangles / production.expandedTriangles) * 100).toFixed(2)),
      },
    }]
  }))

  const blockers = [
    'The candidate is an isolated family payload, not a complete replacement for the animated monolith; global source ownership must be composed into a validated manifest-v3 release.',
    'Run load-before-retire LOD transition reversal QA after the selector is integrated; this candidate intentionally does not enable a selector.',
    'Profile frame time, culling, and memory on physical Web and Quest-class hardware before activation.',
  ]
  const report = {
    schema: 'iom-ground-floor-repeat-geometry-release-candidate-v1',
    generatedAt: new Date().toISOString(),
    status: 'disabled-automated-asset-gates-passed-runtime-qa-pending',
    enabled: false,
    productionManifestChanged: false,
    productionRoutingChanged: false,
    source: {
      legacyAudit: resolve(args.source, 'report.json'),
      cleaned: {
        sha256: legacyReport.source.sha256,
        transformSetSha256: legacyReport.source.transformSetSha256,
      },
    },
    production: legacyReport.production,
    payloads,
    reductions,
    budgets: {
      perPayloadBytes: MAX_PAYLOAD_BYTES,
      combinedCandidateBytes: MAX_CANDIDATE_BYTES,
      actualCombinedBytes: candidateBytes,
      passed: true,
    },
    gates: {
      currentProductionPins: true,
      deterministicSpatialParityGroups: true,
      mirroredTransformsSafe: true,
      exactSourceIdBijection: true,
      noPackageEmbeddedAnimation: true,
      noPersistentOwnerDuplication: true,
      materialsAndAttributesPreserved: true,
      noNewTopologyHoles: true,
      byteBudgets: true,
      webMidBlenderEvidenceFromPriorGeometryPilot: 'passed-seven-views',
      webFarBlenderEvidenceFromPriorGeometryPilot: 'passed-seven-views-not-composed-into-this-candidate',
      combinedPayloadBlenderEvidence: 'pending',
      actualPayloadBrowserRuntime: 'pending',
      physicalHardwarePerformance: false,
      questMidSelection: 'excluded-no-safe-triangle-reduction',
    },
    excluded: {
      farLod: {
        reason: 'Not composed in this bounded release candidate; prior isolated LOD geometry passed, but final combined parity/spatial render and transition evidence is not present.',
        evidence: 'tmp/repeat-lod-ground-floor/visual-qa/visual-approval.json',
      },
      questMidLod: {
        reason: 'The conservative topology gate fell back to exact Quest geometry, so the diagnostic artifact is not selectable.',
      },
    },
    blockers,
  }
  const manifest = {
    schema: 'iom-ground-floor-repeat-geometry-disabled-manifest-v1',
    enabled: false,
    runtimeIntegrated: false,
    productionManifestChanged: false,
    ownerId: 'rig-owner:ground-floor-anim1',
    ownerNodeName: OWNER,
    transform: { space: 'owner-local', matrix: IDENTITY },
    sourcePaths: paths,
    requiredAttributes: ['POSITION', 'NORMAL'],
    selection: {
      web: {
        lod0: { projectedHeightPx: '>=180' },
        lod1: { projectedHeightPx: '<180', hysteresis: '>=15%' },
        note: 'No farther level is included until the final combined parity/spatial payload has render and transition evidence.',
      },
      quest: {
        lod0: { projectedHeightPx: 'all' },
        note: 'The topology-safe mid attempt produced no triangle reduction and is excluded.',
      },
    },
    variants: Object.fromEntries(['web', 'quest'].map((variant) => [variant, Object.fromEntries(
      payloads[variant].filter((payload) => payload.selectable).map((payload) => [payload.level, {
        url: relative(args.out, payload.file).replaceAll('\\', '/'),
        sha256: payload.sha256,
        bytes: payload.bytes,
        triangles: payload.expandedTriangles,
        draws: payload.instancedPrimitiveDraws,
        sourceIdsSha256: payload.sourceIdsSha256,
        transformSha256: payload.transformSha256,
      }]),
    )])),
    blockers,
  }
  await Promise.all([
    writeFile(resolve(args.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`),
    writeFile(resolve(args.out, 'manifest.disabled.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(resolve(args.out, 'README.md'), markdown(report)),
  ])
  console.log(`Disabled release candidate: ${args.out}`)
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error)
    process.exitCode = 1
  })
}
