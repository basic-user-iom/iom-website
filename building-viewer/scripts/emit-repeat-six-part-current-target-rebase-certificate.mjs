#!/usr/bin/env node

/**
 * Emits a deterministic, machine-only compatibility certificate for the
 * current Web target of the dormant repeat-six-part exact catalog.
 *
 * This certificate deliberately does not extend the historical human
 * approval to a new production binary. It can authorize local development
 * evaluation only; it cannot authorize runtime integration or activation.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRepeatSixPartCurrentModelCompatibilityReport } from './audit-repeat-six-part-current-model-compatibility.mjs'

const HERE = resolve(import.meta.dirname)
const VIEWER_ROOT = resolve(HERE, '..')

export const REBASE_CERTIFICATE_SCHEMA = 'IOM_REPEAT_SIX_PART_CURRENT_TARGET_REBASE_CERTIFICATE_V1'
export const REBASE_CERTIFICATE_VERSION = 1
export const DEFAULT_CURRENT_TARGET_MODEL_PATH = resolve(VIEWER_ROOT, '../public/models/icm-anim-2025/model-web.glb')
export const DEFAULT_CURRENT_TARGET_MODEL_RELATIVE_PATH = '../public/models/icm-anim-2025/model-web.glb'
export const DEFAULT_REBASE_CERTIFICATE_OUTPUT_PATH = resolve(
  VIEWER_ROOT,
  'tmp/repeat-six-part-current-target-rebase/certificate-v1.json',
)

const EXPECTED_HUMAN_CERTIFICATE = Object.freeze({
  relativePath: 'scripts/fixtures/icm-anim-2025-ground-floor-repeat-logical-mapping-v1.json',
  bytes: 28_050,
  sha256: 'a802f11c3f9798168d8339c4c786036d36b7486c0c83a5fdad5931d5cff94b60',
  schema: 'IOM_REPEAT_SIX_PART_LOGICAL_MAPPING_CERTIFICATE_V1',
  status: 'approved-authoritative-logical-mapping',
  approvalStatus: 'approved',
})

const EXPECTED_CURRENT_MODEL = Object.freeze({
  relativePath: DEFAULT_CURRENT_TARGET_MODEL_RELATIVE_PATH,
  bytes: 96_803_584,
  sha256: 'a9ddb5030af1a1aa087aeb87aaf1fc66c1a868cf6fd797400617d90a1061ad28',
})

const EXPECTED_ROOTS = Object.freeze([
  Object.freeze({ slot: 0, activeScenePath: 'scene/0/257', material: 'vray Stuhl_Plastik', triangles: 24_213 }),
  Object.freeze({ slot: 1, activeScenePath: 'scene/0/258', material: 'vray Stuhl_Plakete', triangles: 7_102 }),
  Object.freeze({ slot: 2, activeScenePath: 'scene/0/259', material: 'vray Stuhl_Metall', triangles: 14_041 }),
  Object.freeze({ slot: 3, activeScenePath: 'scene/0/260', material: 'vray Stuhl_Bezug', triangles: 15_913 }),
])

export const CURRENT_TARGET_REBASE_AUTHORITY = Object.freeze({
  humanCurrentTargetReapproval: false,
  developmentEvaluationAllowed: true,
  productionRuntimeIntegrationAllowed: false,
  activationAuthorized: false,
  activationCapability: null,
})

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]))
  }
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}

export function stableCertificateStringify(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function sha256Stable(value) {
  return sha256Bytes(Buffer.from(JSON.stringify(stableValue(value))))
}

function accessorSignature(record) {
  return {
    type: record.type,
    componentType: record.componentType,
    normalized: record.normalized,
    count: record.count,
    sha256: record.sha256,
  }
}

function compactRoot(root) {
  return {
    slot: root.slot,
    activeScenePath: root.activeScenePath,
    nodeName: root.nodeName,
    sceneRoot: root.sceneRoot,
    localRestMatrix: root.localRestMatrix,
    worldRestMatrix: root.worldRestMatrix,
    animationChannelCount: root.animationChannelCount,
    material: root.materialRecord,
    geometry: {
      triangles: root.geometry.triangles,
      semantics: root.geometry.semantics,
      position: accessorSignature(root.geometry.position),
      normal: accessorSignature(root.geometry.normal),
      indices: accessorSignature(root.geometry.indices),
    },
    instanceAccessors: Object.fromEntries(
      Object.entries(root.instanceAccessors).map(([semantic, record]) => [semantic, accessorSignature(record)]),
    ),
  }
}

function compactAnimationChannel(channel) {
  return {
    animationIndex: channel.animationIndex,
    animationName: channel.animationName,
    channelIndex: channel.channelIndex,
    samplerIndex: channel.samplerIndex,
    targetPath: channel.targetPath,
    interpolation: channel.interpolation,
    input: accessorSignature(channel.input),
    output: accessorSignature(channel.output),
    keyframes: channel.keyframes,
    analysis: channel.analysis,
  }
}

function compactOwner(owner) {
  return {
    uniqueNamedNodeCount: owner.uniqueNamedNodeCount,
    nodeName: owner.nodeName,
    activeScenePath: owner.activeScenePath,
    sceneRoot: owner.sceneRoot,
    localRestMatrix: owner.localRestMatrix,
    worldRestMatrix: owner.worldRestMatrix,
    identityRestMatrix: owner.identityRestMatrix,
    identityWorldRestMatrix: owner.identityWorldRestMatrix,
    translationRestValue: owner.translationRestValue,
    rotationRestValue: owner.rotationRestValue,
    scaleRestValue: owner.scaleRestValue,
    animationChannelCount: owner.animationChannelCount,
    allTargetedChannelsNoOpAtRest: owner.allTargetedChannelsNoOpAtRest,
    translationTrackAssessment: owner.translationTrackAssessment,
    targetedAnimationChannels: owner.targetedAnimationChannels.map(compactAnimationChannel),
  }
}

function assertExpectedReport(report) {
  assert.equal(report?.schema, 'IOM_REPEAT_SIX_PART_CURRENT_MODEL_COMPATIBILITY_AUDIT_V1')
  assert.equal(report?.status, 'pass-physical-logical-compatible-rebase-required')
  assert.equal(report?.mode, 'disabled-read-only-audit')
  assert.equal(report?.physicalCompatibilityProven, true)
  assert.equal(report?.logicalCompatibilityProven, true)
  assert.equal(report?.integrationAllowed, false)
  assert.equal(report?.rebaseRequired, true)
  assert.deepEqual(report?.inputs?.currentModel, EXPECTED_CURRENT_MODEL)
  assert.deepEqual({
    relativePath: report?.inputs?.trackedLogicalMappingCertificate?.relativePath,
    bytes: report?.inputs?.trackedLogicalMappingCertificate?.bytes,
    sha256: report?.inputs?.trackedLogicalMappingCertificate?.sha256,
    schema: report?.inputs?.trackedLogicalMappingCertificate?.schema,
    status: report?.inputs?.trackedLogicalMappingCertificate?.status,
    approvalStatus: report?.inputs?.trackedLogicalMappingCertificate?.approval?.status,
  }, EXPECTED_HUMAN_CERTIFICATE)
  assert.equal(report?.activeSceneIndex, 0)
  assert.equal(report?.discovery?.activeSceneRootCount, 402)
  assert.equal(report?.discovery?.expectedRootCount, 4)
  assert.equal(report?.discovery?.discoveredRootCount, 4)
  assert.equal(report?.discovery?.rootWorldTransformsIdentity, true)
  assert.equal(report?.discovery?.rootTransformRowsIdenticalAndOrdered, true)
  assert.equal(report?.discovery?.roots?.length, EXPECTED_ROOTS.length)
  for (const expected of EXPECTED_ROOTS) {
    const observed = report.discovery.roots[expected.slot]
    assert.equal(observed?.slot, expected.slot)
    assert.equal(observed?.activeScenePath, expected.activeScenePath)
    assert.equal(observed?.material, expected.material)
    assert.equal(observed?.geometry?.triangles, expected.triangles)
    assert.equal(observed?.sceneRoot, true)
    assert.equal(observed?.animationChannelCount, 0)
  }
  assert.equal(report?.owner?.uniqueNamedNodeCount, 1)
  assert.equal(report?.owner?.nodeName, 'Ground Floor._anim1')
  assert.equal(report?.owner?.activeScenePath, 'scene/0/399')
  assert.equal(report?.owner?.sceneRoot, true)
  assert.equal(report?.owner?.identityRestMatrix, true)
  assert.equal(report?.owner?.identityWorldRestMatrix, true)
  assert.equal(report?.owner?.animationChannelCount, 1)
  assert.equal(report?.owner?.allTargetedChannelsNoOpAtRest, true)
  assert.equal(report?.owner?.targetedAnimationChannels?.length, 1)
  const ownerChannel = report.owner.targetedAnimationChannels[0]
  assert.equal(ownerChannel?.animationIndex, 0)
  assert.equal(ownerChannel?.animationName, 'Animation')
  assert.equal(ownerChannel?.channelIndex, 3)
  assert.equal(ownerChannel?.samplerIndex, 3)
  assert.equal(ownerChannel?.targetPath, 'translation')
  assert.equal(ownerChannel?.interpolation, 'STEP')
  assert.deepEqual(ownerChannel?.keyframes, [{ time: 0, value: [0, 0, 0] }])
  assert.deepEqual(ownerChannel?.analysis, {
    constant: true,
    equalsRestTransform: true,
    cubicTangentsZero: true,
    noOpAtRest: true,
  })
  assert.equal(report?.logicalMapping?.orderCompatible, true)
  assert.equal(report?.logicalMapping?.parityCompatible, true)
  assert.equal(report?.logicalMapping?.reciprocalNearestCompatible, true)
  assert.equal(report?.logicalMapping?.bijective, true)
  assert.deepEqual(report?.logicalMapping?.parity, { positive: 40, mirrored: 38 })
  assert.equal(report?.logicalMapping?.mappings?.length, 78)
  assert.equal(
    report?.logicalMapping?.productionTransformSetSha256,
    'fe7adf799ecbfedbf84bcfcaa0557713728a36507573f846b52476891b66d36b',
  )
  assert.deepEqual(report?.stalePinComparison?.stalePins, [
    'productionModel',
    'productionInstancingRootPaths',
    'intendedOwner',
  ])
  assert.equal(report?.safeguards?.activationAuthorityEstablished, false)
  assert.equal(report?.safeguards?.integrationAllowed, false)
  assert.equal(report?.safeguards?.runtimeImportedOrEnabled, false)
  assert.equal(report?.safeguards?.publicRouteChanged, false)
  assert.equal(report?.safeguards?.sourceAssetsModified, false)
}

export function createRepeatSixPartCurrentTargetRebaseCertificate(report) {
  assertExpectedReport(report)
  const logical = report.logicalMapping
  const comparison = report.stalePinComparison.comparisons
  const roots = report.discovery.roots.map(compactRoot)
  const instanceAccessors = roots[0].instanceAccessors
  for (const root of roots.slice(1)) assert.deepEqual(root.instanceAccessors, instanceAccessors)

  return stableValue({
    schema: REBASE_CERTIFICATE_SCHEMA,
    version: REBASE_CERTIFICATE_VERSION,
    status: 'machine-verified-current-target-development-evaluation-only',
    modelId: 'icm-anim-2025',
    platform: 'web',
    baseAuthority: {
      logicalMappingCertificate: EXPECTED_HUMAN_CERTIFICATE,
      approvedTarget: {
        productionModel: comparison.productionModel.pinned,
        activeSceneIndex: 0,
        productionInstancingRootPaths: comparison.productionInstancingRootPaths.pinned,
        intendedOwner: comparison.intendedOwner.pinned,
        instanceAccessors: comparison.instanceAccessors.pinned,
        productionTransformSetSha256: comparison.productionTransformSetSha256.pinned,
      },
      scope: 'historical-approved-target-only',
    },
    currentTarget: {
      productionModel: report.inputs.currentModel,
      activeSceneIndex: report.activeSceneIndex,
      activeSceneRootCount: report.discovery.activeSceneRootCount,
      productionInstancingRoots: roots,
      intendedOwner: compactOwner(report.owner),
      instanceAccessors,
      productionTransformSetSha256: logical.productionTransformSetSha256,
    },
    compatibility: {
      physicalCompatibilityProven: report.physicalCompatibilityProven,
      logicalCompatibilityProven: report.logicalCompatibilityProven,
      rebaseRequired: report.rebaseRequired,
      staleApprovedTargetPins: report.stalePinComparison.stalePins,
      rootWorldTransformsIdentity: report.discovery.rootWorldTransformsIdentity,
      rootTransformRowsIdenticalAndOrdered: report.discovery.rootTransformRowsIdenticalAndOrdered,
      mapping: {
        sourceCount: logical.mappings.length,
        orderCompatible: logical.orderCompatible,
        parityCompatible: logical.parityCompatible,
        reciprocalNearestCompatible: logical.reciprocalNearestCompatible,
        bijective: logical.bijective,
        parity: logical.parity,
        metrics: logical.metrics,
        policy: logical.policy,
        mappingRowsSha256: sha256Stable(logical.mappings),
      },
    },
    authority: CURRENT_TARGET_REBASE_AUTHORITY,
  })
}

export async function emitRepeatSixPartCurrentTargetRebaseCertificate({
  modelPath = DEFAULT_CURRENT_TARGET_MODEL_PATH,
  outputPath = DEFAULT_REBASE_CERTIFICATE_OUTPUT_PATH,
} = {}) {
  const report = await buildRepeatSixPartCurrentModelCompatibilityReport({
    modelPath,
    modelRelativePath: DEFAULT_CURRENT_TARGET_MODEL_RELATIVE_PATH,
  })
  const certificate = createRepeatSixPartCurrentTargetRebaseCertificate(report)
  const text = stableCertificateStringify(certificate)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, text)
  return {
    certificate,
    output: {
      path: outputPath,
      bytes: Buffer.byteLength(text),
      sha256: sha256Bytes(Buffer.from(text)),
    },
  }
}

async function main() {
  const outputIndex = process.argv.indexOf('--out')
  const outputPath = outputIndex >= 0
    ? resolve(process.argv[outputIndex + 1] ?? '')
    : DEFAULT_REBASE_CERTIFICATE_OUTPUT_PATH
  const result = await emitRepeatSixPartCurrentTargetRebaseCertificate({ outputPath })
  console.log('Repeat six-part current-target rebase certificate: EMITTED (machine-only)')
  console.log(`  ${result.output.bytes} bytes / ${result.output.sha256}`)
  console.log(`  ${result.output.path}`)
  console.log('  development evaluation allowed; production/runtime/activation remain forbidden')
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (IS_MAIN) {
  try {
    await main()
  } catch (error) {
    console.error(`Repeat six-part current-target rebase certificate: FAIL\n  ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
