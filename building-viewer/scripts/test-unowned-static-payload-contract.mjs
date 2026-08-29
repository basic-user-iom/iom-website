/** Adversarial compatibility tests for v1/v2 unowned static payload inputs. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildUnownedStaticPayloadCandidate,
  parseArgs,
  validatePartitionPlanInput,
} from './build-unowned-static-payload-candidate.mjs'
import { auditUnownedStaticPayloadCandidate } from './audit-unowned-static-payload-candidate.mjs'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const V1_PATH = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v1', 'unowned-static-partition-plan-v1.json')
const V2_PATH = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v2', 'unowned-static-partition-plan-v2.json')
const OUT = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-payload-contract-tests')
const BASELINE_OUT = resolve(OUT, 'baseline-v2-smoke')

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stableValue(value, precision = 12) {
  if (Array.isArray(value)) return value.map((child) => stableValue(child, precision))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child, precision)]))
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    if (Object.is(value, -0)) return 0
    return Number(value.toPrecision(precision))
  }
  return value
}

function stableSha256(value, precision = 12) {
  return sha256(JSON.stringify(stableValue(value, precision)))
}

function refreshPlanDigest(plan) {
  const value = structuredClone(plan)
  delete value.planDigestSha256
  plan.planDigestSha256 = stableSha256(value, 9)
  return plan
}

function refreshIndexDigest(index) {
  const value = structuredClone(index)
  delete value.indexDigestSha256
  index.indexDigestSha256 = stableSha256(value)
  return index
}

function projectPath(path) {
  const value = relative(VIEWER_ROOT, path).replaceAll('\\', '/')
  return value.startsWith('.') ? value : `./${value}`
}

async function writeJson(path, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
  return { bytes: bytes.length, sha256: sha256(bytes) }
}

async function expectEmitterBlocked(plan, pattern, label) {
  await assert.rejects(() => validatePartitionPlanInput(plan), pattern, `${label}: emitter validation unexpectedly passed`)
}

const v1 = JSON.parse(await readFile(V1_PATH, 'utf8'))
const v2 = JSON.parse(await readFile(V2_PATH, 'utf8'))
const parsedCli = parseArgs(['--plan', 'tmp/unowned-static-partition-plan-v2/unowned-static-partition-plan-v2.json'])
assert.equal(parsedCli.planPath, V2_PATH, '--plan must populate the builder planPath option')
assert.equal(Object.hasOwn(parsedCli, 'plan'), false, '--plan must not create an ignored plan option')
const v1Validation = await validatePartitionPlanInput(v1, { planPath: V1_PATH })
const v2Validation = await validatePartitionPlanInput(v2, { planPath: V2_PATH })
assert.equal(v1Validation.version, 1)
assert.equal(v2Validation.version, 2)
assert.equal(v1Validation.packageCount, 122)
assert.equal(v2Validation.packageCount, 117)
assert.notEqual(v1Validation.packageCount, v2Validation.packageCount,
  'Dynamic package-count fixture no longer exercises different counts')

const unsupported = structuredClone(v2)
unsupported.version = 3
refreshPlanDigest(unsupported)
await expectEmitterBlocked(unsupported, /Unsupported partition plan version/, 'unsupported version')

const stalePin = structuredClone(v2)
stalePin.evidencePins.sourcePartitionPlan.sha256 = '0'.repeat(64)
refreshPlanDigest(stalePin)
await expectEmitterBlocked(stalePin, /source partition plan: pinned SHA-256 is stale/, 'stale v2 evidence pin')

const staleInherited = structuredClone(v2)
staleInherited.correspondence.inheritedV1.semanticStaticMapping.policy += '-tampered'
refreshPlanDigest(staleInherited)
await expectEmitterBlocked(staleInherited, /inherited correspondence differs|inherited semantic mapping differs/,
  'stale inherited semantic mapping')

const unconservedDynamicCount = structuredClone(v2)
unconservedDynamicCount.staticPackages.pop()
unconservedDynamicCount.staticPackagesDigestSha256 = stableSha256(unconservedDynamicCount.staticPackages, 9)
for (const variant of ['web', 'quest']) {
  unconservedDynamicCount.projection[variant].detail.packageCount = unconservedDynamicCount.staticPackages.length
}
refreshPlanDigest(unconservedDynamicCount)
await expectEmitterBlocked(unconservedDynamicCount, /ownership conservation failed|detail complement count is stale/,
  'unconserved dynamic package count')

const baselinePackageId = v2.staticPackages[0].id
await buildUnownedStaticPayloadCandidate({
  planPath: V2_PATH,
  out: BASELINE_OUT,
  force: true,
  packageId: baselinePackageId,
  skipReview: true,
})
const baselineIndexPath = resolve(BASELINE_OUT, 'payload-index.json')
const baselineIndex = JSON.parse(await readFile(baselineIndexPath, 'utf8'))
const baselineWebAsset = resolve(BASELINE_OUT, baselineIndex.packages[0].variants.web.asset.path)
const baselineDocument = await (await createGltfIO()).read(baselineWebAsset)
assert.ok(baselineDocument.getRoot().listBuffers().length <= 1,
  'emitted GLB must consolidate copied geometry and instance attributes into at most one buffer')
const baselineAudit = await auditUnownedStaticPayloadCandidate({
  indexPath: baselineIndexPath,
  outPath: resolve(OUT, 'audits', 'baseline.json'),
  allowSubset: true,
})
assert.equal(baselineAudit.status, 'PASS', baselineAudit.failures.join('\n'))

async function expectAuditorBlocked(plan, pattern, label) {
  const slug = label.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()
  const planPath = resolve(OUT, 'plans', `${slug}.json`)
  const planFile = await writeJson(planPath, plan)
  const index = structuredClone(baselineIndex)
  const mapping = plan.version === 2
    ? plan.correspondence?.inheritedV1?.semanticStaticMapping
    : plan.correspondence?.semanticStaticMapping
  index.plan = {
    ...index.plan,
    path: projectPath(planPath),
    bytes: planFile.bytes,
    sha256: planFile.sha256,
    schema: plan.schema,
    version: plan.version,
    planDigestSha256: plan.planDigestSha256,
    wholeLayerCoverageDigestSha256: plan.wholeLayerCoverageDigestSha256,
    staticPackageCount: plan.staticPackages.length,
    staticPackagesDigestSha256: plan.staticPackagesDigestSha256 ?? stableSha256(plan.staticPackages, 9),
    semanticStaticMappingSha256: mapping?.primitiveMappingsSha256 ?? null,
    evidencePinsSha256: plan.version === 2 ? stableSha256(plan.evidencePins, 9) : null,
  }
  refreshIndexDigest(index)
  const indexPath = resolve(BASELINE_OUT, `payload-index-negative-${slug}.json`)
  await writeJson(indexPath, index)
  const audit = await auditUnownedStaticPayloadCandidate({
    indexPath,
    outPath: resolve(OUT, 'audits', `${slug}.json`),
    allowSubset: true,
  })
  assert.equal(audit.status, 'FAIL', `${label}: auditor unexpectedly passed`)
  assert.ok(audit.failures.some((failure) => pattern.test(failure)),
    `${label}: expected ${pattern}, got ${audit.failures.join(' | ')}`)
}

await expectAuditorBlocked(unsupported, /Unsupported partition plan version/, 'unsupported version')
await expectAuditorBlocked(stalePin, /source partition plan: pinned SHA-256 is stale/, 'stale v2 evidence pin')
await expectAuditorBlocked(staleInherited, /inherited correspondence differs|inherited semantic mapping differs/,
  'stale inherited semantic mapping')
await expectAuditorBlocked(unconservedDynamicCount, /ownership conservation failed|detail complement count is stale/,
  'unconserved dynamic package count')

const result = {
  schema: 'IOM_UNOWNED_STATIC_PAYLOAD_CONTRACT_TEST',
  version: 1,
  status: 'PASS',
  productionModified: false,
  productionRoutingChanged: false,
  positive: {
    v1: { version: 1, packageCount: v1Validation.packageCount },
    v2: { version: 2, packageCount: v2Validation.packageCount },
    v2SmokeAuditAssertions: baselineAudit.assertionCount,
  },
  adversarial: {
    unsupportedVersion: 'BLOCKED_BY_EMITTER_AND_AUDITOR',
    staleEvidencePin: 'BLOCKED_BY_EMITTER_AND_AUDITOR',
    staleInheritedSemanticMapping: 'BLOCKED_BY_EMITTER_AND_AUDITOR',
    unconservedDynamicPackageCount: 'BLOCKED_BY_EMITTER_AND_AUDITOR',
  },
}
result.testDigestSha256 = stableSha256(result)
await writeJson(resolve(OUT, 'contract-test.json'), result)

console.log('Unowned static payload v1/v2 contract tests: PASS')
console.log(`  v1 dynamic package count: ${v1Validation.packageCount}`)
console.log(`  v2 dynamic package count: ${v2Validation.packageCount}`)
console.log(`  v2 smoke audit assertions: ${baselineAudit.assertionCount.toLocaleString()}`)
console.log('  unsupported version: BLOCKED (emitter + auditor)')
console.log('  stale evidence pin: BLOCKED (emitter + auditor)')
console.log('  stale inherited semantic mapping: BLOCKED (emitter + auditor)')
console.log('  unconserved dynamic package count: BLOCKED (emitter + auditor)')
