#!/usr/bin/env node

/**
 * Independent validator for the machine-only repeat-six-part current-target
 * rebase certificate.
 *
 * The tracked certificate is never treated as self-authenticating. This
 * validator reopens and decodes the current public Web GLB, revalidates the
 * immutable historical human certificate, recomputes every target and
 * compatibility fact, and then requires exact structural/value equality.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRepeatSixPartCurrentModelCompatibilityReport } from './audit-repeat-six-part-current-model-compatibility.mjs'

const HERE = resolve(import.meta.dirname)
const VIEWER_ROOT = resolve(HERE, '..')

export const CURRENT_TARGET_REBASE_CERTIFICATE_PATH = resolve(
  HERE,
  'fixtures/icm-anim-2025-ground-floor-repeat-current-target-rebase-v1.json',
)
export const CURRENT_TARGET_REBASE_MODEL_PATH = resolve(
  VIEWER_ROOT,
  '../public/models/icm-anim-2025/model-web.glb',
)

const HUMAN_CERTIFICATE_PATH = resolve(
  HERE,
  'fixtures/icm-anim-2025-ground-floor-repeat-logical-mapping-v1.json',
)
const MODEL_RELATIVE_PATH = '../public/models/icm-anim-2025/model-web.glb'
const REBASE_SCHEMA = 'IOM_REPEAT_SIX_PART_CURRENT_TARGET_REBASE_CERTIFICATE_V1'

export const TRACKED_CURRENT_TARGET_REBASE_CERTIFICATE_PIN = Object.freeze({
  bytes: 18_319,
  sha256: '1bb81536b0ef40c7a41756b90537224747e8394b792c0113692b72e57bd7d51d',
})

const HUMAN_CERTIFICATE_PIN = Object.freeze({
  relativePath: 'scripts/fixtures/icm-anim-2025-ground-floor-repeat-logical-mapping-v1.json',
  bytes: 28_050,
  sha256: 'a802f11c3f9798168d8339c4c786036d36b7486c0c83a5fdad5931d5cff94b60',
  schema: 'IOM_REPEAT_SIX_PART_LOGICAL_MAPPING_CERTIFICATE_V1',
  status: 'approved-authoritative-logical-mapping',
  approvalStatus: 'approved',
})

const CURRENT_MODEL_PIN = Object.freeze({
  relativePath: MODEL_RELATIVE_PATH,
  bytes: 96_803_896,
  sha256: '4786da86836ca2438196f2f4e216ec6188a21d8922612070e1c296d5c461596e',
})

const AUTHORITY = Object.freeze({
  humanCurrentTargetReapproval: false,
  developmentEvaluationAllowed: true,
  productionRuntimeIntegrationAllowed: false,
  activationAuthorized: false,
  activationCapability: null,
})

const POLICY = Object.freeze({
  matchingMethod: 'reciprocal-exhaustive-nearest-neighbor-owner-local-translation',
  maxMatchedDistanceMeters: 0.005,
  minRunnerUpMarginMeters: 0.5,
  maxBestToRunnerUpRatio: 0.01,
  requireBijection: true,
  requireReciprocalNearest: true,
  requireExpectedProductionInstanceIndex: true,
})

const ROOT_BASIS = Object.freeze([
  Object.freeze({ slot: 0, activeScenePath: 'scene/0/257', material: 'vray Stuhl_Plastik', triangles: 24_213 }),
  Object.freeze({ slot: 1, activeScenePath: 'scene/0/258', material: 'vray Stuhl_Plakete', triangles: 7_102 }),
  Object.freeze({ slot: 2, activeScenePath: 'scene/0/259', material: 'vray Stuhl_Metall', triangles: 14_041 }),
  Object.freeze({ slot: 3, activeScenePath: 'scene/0/260', material: 'vray Stuhl_Bezug', triangles: 15_913 }),
])

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

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

const sha256Stable = (value) => sha256(Buffer.from(JSON.stringify(stableValue(value))))

function parseJson(bytes, label) {
  assert.ok(Buffer.isBuffer(bytes), `${label}: input must be a Buffer`)
  let value
  try {
    value = JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    assert.fail(`${label}: invalid JSON (${error.message})`)
  }
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label}: root must be an object`)
  return value
}

function assertBytePin(bytes, pin, label) {
  assert.ok(Number.isSafeInteger(pin?.bytes) && pin.bytes > 0, `${label}: invalid expected byte pin`)
  assert.match(pin?.sha256 ?? '', /^[a-f0-9]{64}$/, `${label}: invalid expected SHA-256 pin`)
  assert.equal(bytes.length, pin.bytes, `${label}: byte pin changed`)
  assert.equal(sha256(bytes), pin.sha256, `${label}: SHA-256 pin changed`)
}

function assertExactTree(observed, expected, path) {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(observed), `${path}: must be an array`)
    assert.equal(observed.length, expected.length, `${path}: array length changed`)
    expected.forEach((entry, index) => assertExactTree(observed[index], entry, `${path}[${index}]`))
    return
  }
  if (expected && typeof expected === 'object') {
    assert.ok(observed && typeof observed === 'object' && !Array.isArray(observed), `${path}: must be an object`)
    const observedKeys = Object.keys(observed).sort()
    const expectedKeys = Object.keys(expected).sort()
    assert.deepEqual(observedKeys, expectedKeys, `${path}: keys changed`)
    for (const key of expectedKeys) assertExactTree(observed[key], expected[key], `${path}.${key}`)
    return
  }
  assert.ok(Object.is(observed, expected), `${path}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(observed)}`)
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

function rootRecord(root) {
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

function channelRecord(channel) {
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

function ownerRecord(owner) {
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
    targetedAnimationChannels: owner.targetedAnimationChannels.map(channelRecord),
  }
}

function assertIndependentReportFacts(report) {
  assert.equal(report.schema, 'IOM_REPEAT_SIX_PART_CURRENT_MODEL_COMPATIBILITY_AUDIT_V1')
  assert.equal(report.status, 'pass-physical-logical-compatible-rebase-required')
  assert.equal(report.mode, 'disabled-read-only-audit')
  assert.equal(report.physicalCompatibilityProven, true)
  assert.equal(report.logicalCompatibilityProven, true)
  assert.equal(report.integrationAllowed, false)
  assert.equal(report.rebaseRequired, true)
  assert.deepEqual(report.inputs.currentModel, CURRENT_MODEL_PIN)
  assert.equal(report.activeSceneIndex, 0)
  assert.equal(report.discovery.activeSceneRootCount, 402)
  assert.equal(report.discovery.expectedRootCount, 4)
  assert.equal(report.discovery.discoveredRootCount, 4)
  assert.equal(report.discovery.rootWorldTransformsIdentity, true)
  assert.equal(report.discovery.rootTransformRowsIdenticalAndOrdered, true)
  assert.equal(report.discovery.roots.length, ROOT_BASIS.length)
  ROOT_BASIS.forEach((basis, index) => {
    const root = report.discovery.roots[index]
    assert.equal(root.slot, basis.slot)
    assert.equal(root.activeScenePath, basis.activeScenePath)
    assert.equal(root.material, basis.material)
    assert.equal(root.geometry.triangles, basis.triangles)
    assert.equal(root.sceneRoot, true)
    assert.equal(root.animationChannelCount, 0)
  })
  assert.equal(report.owner.uniqueNamedNodeCount, 1)
  assert.equal(report.owner.nodeName, 'Ground Floor._anim1')
  assert.equal(report.owner.activeScenePath, 'scene/0/399')
  assert.equal(report.owner.sceneRoot, true)
  assert.equal(report.owner.identityRestMatrix, true)
  assert.equal(report.owner.identityWorldRestMatrix, true)
  assert.equal(report.owner.animationChannelCount, 1)
  assert.equal(report.owner.allTargetedChannelsNoOpAtRest, true)
  assert.equal(report.owner.targetedAnimationChannels.length, 1)
  assertExactTree(report.owner.targetedAnimationChannels[0].analysis, {
    constant: true,
    equalsRestTransform: true,
    cubicTangentsZero: true,
    noOpAtRest: true,
  }, 'decoded owner animation analysis')
  assert.equal(report.logicalMapping.mappings.length, 78)
  assert.equal(report.logicalMapping.orderCompatible, true)
  assert.equal(report.logicalMapping.parityCompatible, true)
  assert.equal(report.logicalMapping.reciprocalNearestCompatible, true)
  assert.equal(report.logicalMapping.bijective, true)
  assert.deepEqual(report.logicalMapping.parity, { positive: 40, mirrored: 38 })
  assert.deepEqual(report.logicalMapping.policy, POLICY)
  assert.ok(report.logicalMapping.metrics.maxMatchedDistanceMeters <= POLICY.maxMatchedDistanceMeters)
  assert.ok(report.logicalMapping.metrics.minRunnerUpMarginMeters >= POLICY.minRunnerUpMarginMeters)
  assert.ok(report.logicalMapping.metrics.maxBestToRunnerUpRatio <= POLICY.maxBestToRunnerUpRatio)
  assert.equal(
    report.logicalMapping.productionTransformSetSha256,
    'fe7adf799ecbfedbf84bcfcaa0557713728a36507573f846b52476891b66d36b',
  )
  assert.deepEqual(report.stalePinComparison.stalePins, [
    'productionModel',
    'productionInstancingRootPaths',
    'intendedOwner',
  ])
  assert.equal(report.safeguards.activationAuthorityEstablished, false)
  assert.equal(report.safeguards.integrationAllowed, false)
  assert.equal(report.safeguards.runtimeImportedOrEnabled, false)
  assert.equal(report.safeguards.publicRouteChanged, false)
  assert.equal(report.safeguards.sourceAssetsModified, false)
}

function expectedCertificateFromReport(report) {
  const roots = report.discovery.roots.map(rootRecord)
  const instanceAccessors = roots[0].instanceAccessors
  for (const root of roots.slice(1)) assert.deepEqual(root.instanceAccessors, instanceAccessors)
  const logical = report.logicalMapping
  const comparison = report.stalePinComparison.comparisons
  return stableValue({
    schema: REBASE_SCHEMA,
    version: 1,
    status: 'machine-verified-current-target-development-evaluation-only',
    modelId: 'icm-anim-2025',
    platform: 'web',
    baseAuthority: {
      logicalMappingCertificate: HUMAN_CERTIFICATE_PIN,
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
      intendedOwner: ownerRecord(report.owner),
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
    authority: AUTHORITY,
  })
}

async function validateBuffers({ certificateBytes, expectedCertificatePin, modelPath }) {
  assertBytePin(certificateBytes, expectedCertificatePin, 'current-target rebase certificate')
  const certificate = parseJson(certificateBytes, 'current-target rebase certificate')
  assertExactTree(certificate.authority, AUTHORITY, 'certificate.authority')

  const humanBytes = await readFile(HUMAN_CERTIFICATE_PATH)
  assertBytePin(humanBytes, HUMAN_CERTIFICATE_PIN, 'immutable human logical-mapping certificate')
  const human = parseJson(humanBytes, 'immutable human logical-mapping certificate')
  assert.equal(human.schema, HUMAN_CERTIFICATE_PIN.schema)
  assert.equal(human.status, HUMAN_CERTIFICATE_PIN.status)
  assert.equal(human.approval?.status, HUMAN_CERTIFICATE_PIN.approvalStatus)

  const modelBytes = await readFile(resolve(modelPath))
  assertBytePin(modelBytes, CURRENT_MODEL_PIN, 'current public Web model')
  const report = await buildRepeatSixPartCurrentModelCompatibilityReport({
    modelPath: resolve(modelPath),
    modelRelativePath: MODEL_RELATIVE_PATH,
  })
  assertIndependentReportFacts(report)
  const expected = expectedCertificateFromReport(report)
  assertExactTree(certificate, expected, 'certificate')

  return Object.freeze({
    schema: 'IOM_REPEAT_SIX_PART_CURRENT_TARGET_REBASE_VALIDATION_RESULT_V1',
    valid: true,
    certificateStatus: certificate.status,
    model: Object.freeze({ ...CURRENT_MODEL_PIN }),
    roots: Object.freeze(certificate.currentTarget.productionInstancingRoots.map((root) => root.activeScenePath)),
    owner: Object.freeze({
      nodeName: certificate.currentTarget.intendedOwner.nodeName,
      activeScenePath: certificate.currentTarget.intendedOwner.activeScenePath,
      animationChannelCount: certificate.currentTarget.intendedOwner.animationChannelCount,
      allTargetedChannelsNoOpAtRest: certificate.currentTarget.intendedOwner.allTargetedChannelsNoOpAtRest,
    }),
    authority: Object.freeze({ ...AUTHORITY }),
  })
}

export async function validateRepeatSixPartCurrentTargetRebaseCertificate({
  certificatePath = CURRENT_TARGET_REBASE_CERTIFICATE_PATH,
  modelPath = CURRENT_TARGET_REBASE_MODEL_PATH,
} = {}) {
  const certificateBytes = await readFile(resolve(certificatePath))
  return validateBuffers({
    certificateBytes,
    expectedCertificatePin: TRACKED_CURRENT_TARGET_REBASE_CERTIFICATE_PIN,
    modelPath,
  })
}

/** Test-only entry point: the supplied pin bypasses only the outer fixture byte pin. */
export async function validateRepeatSixPartCurrentTargetRebaseCertificateForTest({
  certificateBytes,
  expectedCertificatePin,
  modelPath = CURRENT_TARGET_REBASE_MODEL_PATH,
}) {
  return validateBuffers({ certificateBytes, expectedCertificatePin, modelPath })
}

async function main() {
  const result = await validateRepeatSixPartCurrentTargetRebaseCertificate()
  console.log('Repeat six-part current-target rebase certificate: PASS')
  console.log(`  ${result.model.bytes} bytes / ${result.model.sha256}`)
  console.log(`  roots: ${result.roots.join(', ')}`)
  console.log(`  owner: ${result.owner.activeScenePath} (${result.owner.animationChannelCount} exact no-op channel)`)
  console.log('  human current-target reapproval: false')
  console.log('  development evaluation: allowed')
  console.log('  production/runtime integration and activation: forbidden')
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
