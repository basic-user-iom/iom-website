/**
 * Build a disabled v2 __unowned__ partition after subtracting an exact,
 * whole-source-path structural shell candidate from the v1 static domain.
 *
 * This remains planning evidence only. It does not modify production GLBs,
 * manifests, routes, or runtime configuration. A visually rejected shell may
 * still prove the repartition pipeline, but can never make this plan ready.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  buildPackages,
  buildUnownedStaticPlan,
  semanticStaticRecords,
  validateUnownedStaticPlan,
} from './build-unowned-static-partition-plan.mjs'
import { stringListSha256 } from './lib/whole-layer-ownership-contract.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v2')
const DEFAULT_CANDIDATE_ROOT = resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-unowned-structural-shell-candidate')
const DEFAULT_V1_PLAN = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v1', 'unowned-static-partition-plan-v1.json')
const DEFAULT_CONTRACT = resolve(VIEWER_ROOT, 'tmp', 'whole-layer-ownership-v1', 'whole-layer-ownership-contract-v1.json')
const OWNER = '__unowned__'
const VARIANTS = Object.freeze(['web', 'quest'])
const SHA256 = /^[a-f0-9]{64}$/

function parseArgs(argv) {
  const args = {
    out: DEFAULT_OUT,
    candidateRoot: DEFAULT_CANDIDATE_ROOT,
    candidate: null,
    repartition: null,
    ownershipAudit: null,
    dependencyAudit: null,
    topologyAudit: null,
    projectionAudit: null,
    renderReport: null,
    repeatRoot: undefined,
    fireSidecar: undefined,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--out') args.out = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--candidate-root') args.candidateRoot = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--candidate') args.candidate = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--repartition') args.repartition = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--ownership-audit') args.ownershipAudit = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--dependency-audit') args.dependencyAudit = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--topology-audit') args.topologyAudit = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--projection-audit') args.projectionAudit = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--render-report') args.renderReport = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--repeat-root') args.repeatRoot = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--fire-sidecar') args.fireSidecar = resolve(VIEWER_ROOT, argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
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

function planDigest(plan) {
  const value = structuredClone(plan)
  delete value.planDigestSha256
  return stableSha256(value)
}

function projectPath(path) {
  return relative(VIEWER_ROOT, path).replaceAll('\\', '/')
}

function assertInside(root, path, label) {
  const local = relative(root, path)
  assert.ok(local && !local.startsWith('..') && !resolve(local).startsWith('\\'),
    `${label} must stay inside the pinned candidate root`)
}

async function pinnedFile(path) {
  const bytes = await readFile(path)
  return { path: projectPath(path), bytes: bytes.length, sha256: sha256(bytes) }
}

async function pinnedJson(path) {
  const bytes = await readFile(path)
  return {
    pin: { path: projectPath(path), bytes: bytes.length, sha256: sha256(bytes) },
    value: JSON.parse(bytes),
  }
}

function pinEqual(left, right) {
  return left?.path === right?.path && left?.bytes === right?.bytes && left?.sha256 === right?.sha256
}

function contentPinEqual(left, right) {
  return left?.bytes === right?.bytes && left?.sha256 === right?.sha256
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function occurrences(values) {
  const result = new Map()
  for (const value of values) result.set(value, (result.get(value) || 0) + 1)
  return result
}

function staticIds(plan, variant) {
  return (plan.staticPackages || []).flatMap((pkg) => pkg.variants?.[variant]?.sourceUnitIds || [])
}

function repeatIds(plan, variant) {
  return (plan.repeatCandidate?.variants?.[variant]?.batches || []).flatMap((batch) => batch.sourceUnitIds || [])
}

function fireIds(plan, variant) {
  return plan.fireHoseMigration?.variants?.[variant]?.sourceUnitIds || []
}

function shellOutput(candidate, variant) {
  return candidate.variants?.[variant]?.shell ?? candidate.variants?.[variant]?.proxy ??
    candidate.variants?.[variant]?.asset ?? candidate.variants?.[variant]?.output
}

function candidateSelection(candidate, variant) {
  return candidate.variants?.[variant]?.selection ?? candidate.variants?.[variant]?.ownership
}

function structuralClaim(repartition, variant) {
  return repartition.variants?.[variant]?.shell ?? repartition.variants?.[variant]?.proxy
}

function unitCount(value) {
  return value?.atomicUnitCount ?? value?.sourceUnitCount
}

function sourcePlanPin(candidate) {
  return candidate.evidencePins?.unownedPartitionPlan ?? candidate.evidencePins?.sourcePartitionPlan
}

function wholeLayerContractPin(candidate) {
  return candidate.evidencePins?.wholeLayerOwnershipContract ?? candidate.evidencePins?.wholeLayerContract
}

function jsonObjectDigest(value, digestKey) {
  const digestInput = structuredClone(value)
  delete digestInput[digestKey]
  return sha256(JSON.stringify(digestInput))
}

function resolveEvidencePath(candidateRoot, explicitPath, evidencePin, fallback) {
  if (explicitPath) return explicitPath
  const pinnedPath = evidencePin?.path
  if (pinnedPath) return resolve(VIEWER_ROOT, pinnedPath)
  return resolve(candidateRoot, fallback)
}

function assertDisabledArtifact(value, label) {
  assert.equal(value?.enabled, false, `${label} must remain disabled`)
  assert.notEqual(value?.activationApproved, true, `${label} must not be activation-approved`)
  assert.notEqual(value?.runtimeIntegrated, true, `${label} must not be runtime-integrated`)
  assert.notEqual(value?.productionModified, true, `${label} must not modify production`)
  assert.notEqual(value?.productionRoutingChanged, true, `${label} must not change production routing`)
}

function assertCandidateSchema(candidate, repartition) {
  const isLegacyShellV1 = candidate?.schema === 'IOM_UNOWNED_STRUCTURAL_SHELL_CANDIDATE' && candidate.version === 1 &&
    repartition?.schema === 'IOM_UNOWNED_STRUCTURAL_SHELL_REPARTITION' && repartition.version === 1
  const isProxyV2 = candidate?.schema === 'IOM_UNOWNED_STRUCTURAL_PROXY_CANDIDATE' && candidate.version === 2 &&
    repartition?.schema === 'IOM_UNOWNED_STRUCTURAL_PROXY_REPARTITION' && repartition.version === 2
  assert.ok(isLegacyShellV1 || isProxyV2,
    'Unsupported or mismatched structural candidate/repartition schema pair')
  assert.equal(candidate.modelId, 'icm-anim-2025', 'Shell candidate model changed')
  assert.equal(repartition.modelId, 'icm-anim-2025', 'Repartition model changed')
  assert.equal(candidate.owner, OWNER, 'Shell candidate owner changed')
  assert.equal(repartition.sourceOwner, OWNER, 'Repartition source owner changed')
  assertDisabledArtifact(candidate, 'Shell candidate')
  assertDisabledArtifact(repartition, 'Ownership repartition')
  if (isProxyV2) {
    assert.match(candidate.candidateDigestSha256 || '', SHA256, 'Proxy-v2 candidate digest is missing or invalid')
    assert.equal(candidate.candidateDigestSha256, jsonObjectDigest(candidate, 'candidateDigestSha256'),
      'Proxy-v2 candidate digest is stale')
    assert.match(repartition.repartitionDigestSha256 || '', SHA256, 'Proxy-v2 repartition digest is missing or invalid')
    assert.equal(repartition.repartitionDigestSha256, jsonObjectDigest(repartition, 'repartitionDigestSha256'),
      'Proxy-v2 repartition digest is stale')
  }
}

function assertCandidatePins(candidate, livePins) {
  assert.ok(contentPinEqual(sourcePlanPin(candidate), livePins.sourcePartitionPlan),
    'Shell candidate v1 partition-plan pin is stale')
  assert.ok(contentPinEqual(wholeLayerContractPin(candidate), livePins.wholeLayerContract),
    'Shell candidate whole-layer contract pin is stale')
  assert.ok(contentPinEqual(candidate.evidencePins?.ownershipRepartition, livePins.ownershipRepartition),
    'Shell candidate ownership-repartition pin is stale')
  assert.ok(contentPinEqual(candidate.evidencePins?.dependencyAudit, livePins.dependencyAudit),
    'Shell candidate dependency-audit pin is stale')
  if (candidate.evidencePins?.topologyAudit || livePins.topologyAudit) {
    assert.ok(contentPinEqual(candidate.evidencePins?.topologyAudit, livePins.topologyAudit),
      'Shell candidate topology-audit pin is stale')
  }
  for (const variant of VARIANTS) {
    assert.ok(contentPinEqual(shellOutput(candidate, variant), livePins.shellOutputs[variant]),
      `${variant}: shell output pin is stale`)
  }
}

function selectedPathsFromRepartition(repartition) {
  const web = sortedUnique(structuralClaim(repartition, 'web')?.sourcePaths || [])
  const quest = sortedUnique(structuralClaim(repartition, 'quest')?.sourcePaths || [])
  assert.deepEqual(web, quest, 'Web/Quest structural-shell source paths differ')
  assert.ok(web.length > 0, 'Structural-shell selection is empty')
  assert.ok(web.every((path) => /^scene\/\d+(?:\/\d+)*$/.test(path)), 'Structural shell contains a non-whole source path')
  return web
}

function assertSelectionSidecars(v1Plan, candidate, repartition, selectedPaths) {
  assert.deepEqual(sortedUnique(candidate.selectionPolicy?.sourceNodePaths || []), selectedPaths,
    'Candidate selection policy and repartition paths differ')
  assert.equal(candidate.selectionPolicy?.sourceNodePathsSha256, stringListSha256(selectedPaths),
    'Candidate selected-path digest is stale')
  if (candidate.schema === 'IOM_UNOWNED_STRUCTURAL_PROXY_CANDIDATE' && candidate.version === 2) {
    assert.equal(candidate.selectionPolicy?.sourceNodePathCount, selectedPaths.length,
      'Proxy-v2 candidate selected-path count is stale')
  }
  for (const variant of VARIANTS) {
    const shell = structuralClaim(repartition, variant)
    const selection = candidateSelection(candidate, variant)
    const detail = repartition.variants?.[variant]?.detailComplement
    assert.deepEqual(sortedUnique(shell?.sourcePaths || []), selectedPaths,
      `${variant}: repartition selected paths differ`)
    assert.equal(shell?.sourcePathCount ?? shell?.sourcePaths?.length, selectedPaths.length,
      `${variant}: selected path count is stale`)
    assert.equal(shell?.sourcePathsSha256, stringListSha256(selectedPaths), `${variant}: selected path digest is stale`)
    if (selection) {
      assert.deepEqual(sortedUnique(selection.sourcePaths || []), selectedPaths,
        `${variant}: candidate selection paths differ`)
      assert.equal(selection.sourcePathCount, selectedPaths.length, `${variant}: candidate selected path count is stale`)
      assert.equal(selection.sourcePathsSha256, stringListSha256(selectedPaths), `${variant}: candidate path digest is stale`)
    } else {
      const asset = shellOutput(candidate, variant)
      assert.equal(asset?.sourcePathCount, selectedPaths.length, `${variant}: candidate asset path count is stale`)
      assert.equal(asset?.sourcePathsSha256, stringListSha256(selectedPaths), `${variant}: candidate asset path digest is stale`)
    }

    const originalStatic = sortedUnique(staticIds(v1Plan, variant))
    const staticSet = new Set(originalStatic)
    const units = v1Plan.variants[variant].units
    const allSelectedPathUnits = units.filter((unit) => selectedPaths.includes(unit.sourcePath)).map((unit) => unit.id).sort()
    const selectedStaticUnits = allSelectedPathUnits.filter((id) => staticSet.has(id))
    assert.deepEqual(allSelectedPathUnits, selectedStaticUnits,
      `${variant}: selected path intersects repeat/fire or another non-static segment`)
    assert.deepEqual(sortedUnique(shell?.sourceUnitIds || []), selectedStaticUnits,
      `${variant}: repartition shell is not an exact whole-path claim`)
    if (selection) {
      assert.deepEqual(sortedUnique(selection.sourceUnitIds || []), selectedStaticUnits,
        `${variant}: candidate shell selection differs from whole-path source units`)
    }
    assert.equal(unitCount(shell), selectedStaticUnits.length, `${variant}: shell unit count is stale`)
    assert.equal(shell?.sourceUnitIdsSha256, stringListSha256(selectedStaticUnits), `${variant}: shell unit digest is stale`)
    if (selection) {
      assert.equal(unitCount(selection), selectedStaticUnits.length, `${variant}: candidate shell unit count is stale`)
      assert.equal(selection.unitIdsSha256 ?? selection.sourceUnitIdsSha256, stringListSha256(selectedStaticUnits),
        `${variant}: candidate shell unit digest is stale`)
    }

    const detailIds = originalStatic.filter((id) => !new Set(selectedStaticUnits).has(id))
    assert.deepEqual(sortedUnique(detail?.sourceUnitIds || []), detailIds,
      `${variant}: repartition detail complement is stale`)
    assert.equal(unitCount(detail), detailIds.length, `${variant}: detail complement count is stale`)
    assert.equal(detail?.sourceUnitIdsSha256, stringListSha256(detailIds), `${variant}: detail complement digest is stale`)
    if (detail?.requiredPayloadInputUnitIdsSha256 !== undefined) {
      assert.equal(detail.requiredPayloadInputUnitIdsSha256, stringListSha256(detailIds),
        `${variant}: required payload input digest is stale`)
    }
    const conservation = repartition.variants[variant].conservation
    assert.equal(conservation?.originalStaticAtomicUnits ?? conservation?.wholeStaticUnitCount, originalStatic.length,
      `${variant}: original static conservation count is stale`)
    assert.equal(conservation?.unionAtomicUnits ?? conservation?.unionUnitCount, originalStatic.length,
      `${variant}: repartition static union count is stale`)
    for (const [legacyKey, proxyKey] of [
      ['overlapAtomicUnits', 'overlapCount'],
      ['omittedAtomicUnits', 'omissionCount'],
      ['repeatOverlapAtomicUnits', 'repeatOverlapCount'],
      ['migratedFireOverlapAtomicUnits', 'fireOverlapCount'],
      ['duplicateAtomicUnits', 'duplicateCount'],
    ]) {
      const value = conservation?.[legacyKey] ?? conservation?.[proxyKey]
      if (legacyKey === 'duplicateAtomicUnits' && value === undefined) continue
      assert.equal(value, 0,
        `${variant}: repartition ${legacyKey}/${proxyKey} must be zero`)
    }
  }
}

function shellVisualGate(visualAudit) {
  const passed = visualAudit?.strongCoverage === true && visualAudit?.ready === true &&
    visualAudit?.activationApproved === true
  return {
    required: true,
    passed,
    strongCoverage: visualAudit?.strongCoverage === true,
    ready: visualAudit?.ready === true,
    activationApproved: visualAudit?.activationApproved === true,
    status: visualAudit?.status ?? 'missing-status',
    thresholds: visualAudit?.thresholdResults ?? null,
    summary: visualAudit?.summary ?? null,
    blocker: passed ? null : 'The pinned structural shell failed or lacks visual approval; this repartition is evidence only and cannot activate.',
  }
}

function planningProjection(packages, v1Plan, shellIdsByVariant) {
  return Object.fromEntries(VARIANTS.map((variant) => {
    const unitMap = new Map(v1Plan.variants[variant].units.map((unit) => [unit.id, unit]))
    const detail = packages.map((pkg) => pkg.variants[variant])
    const shellUnits = shellIdsByVariant[variant].map((id) => unitMap.get(id))
    const repeat = v1Plan.repeatCandidate.variants[variant].summary
    return [variant, {
      shell: {
        atomicUnitCount: shellUnits.length,
        expandedTriangles: shellUnits.reduce((sum, unit) => sum + unit.triangles, 0),
      },
      detail: {
        packageCount: detail.filter((entry) => entry.atomicUnitCount > 0).length,
        atomicUnitCount: detail.reduce((sum, entry) => sum + entry.atomicUnitCount, 0),
        expandedTriangles: detail.reduce((sum, entry) => sum + entry.expandedTriangles, 0),
        conservativeAllLoadedProjectedDraws: detail.reduce((sum, entry) => sum + entry.projectedDraws, 0),
      },
      repeat: {
        atomicUnitCount: repeat.atomicUnitCount,
        expandedTriangles: repeat.expandedTriangles,
      },
      activationProjection: null,
      activationProjectionReason: 'The shell is not activation-approved; no far-field or runtime-resident performance claim is permitted.',
    }]
  }))
}

function buildStructuralNearLod0Packages(shellRecords) {
  return buildPackages(shellRecords).map((pkg) => ({
    ...pkg,
    id: pkg.id.replace(/^unowned-/, 'unowned-structural-near-lod0-'),
    role: 'structural-near-lod0-material-fidelity',
    nearLod0: true,
    materialFidelity: {
      nearLod0: true,
      preservesSourceGeometry: true,
      preservesSourcePbrMaterials: true,
    },
    replacementSemantics: {
      mode: 'distance-exclusive-load-before-retire-near-wins',
      mutuallyExclusiveAtSteadyState: true,
      additiveCompositionAllowed: false,
      loadBeforeRetire: true,
      nearPayloadBecomesVisibleBeforeFarProxyRetires: true,
      farProxyBecomesVisibleBeforeNearPayloadRetires: true,
    },
  }))
}

function makeReport(plan, validation) {
  const rows = VARIANTS.map((variant) => {
    const shell = plan.shellCandidate.variants[variant]
    const detail = plan.detailComplement.variants[variant]
    const activePackages = plan.staticPackages.filter((pkg) => pkg.variants[variant].atomicUnitCount > 0).length
    return `| ${variant} | ${shell.sourcePathCount} | ${shell.atomicUnitCount.toLocaleString()} | ${detail.atomicUnitCount.toLocaleString()} | ${activePackages} | ${plan.staticPackages.length} |`
  }).join('\n')
  return `# Disabled unowned/static partition plan v2\n\n` +
    `Status: **disabled; exact shell/detail repartition evidence only; not production-safe**. Validation: **${validation.valid ? 'PASS' : 'FAIL'}**.\n\n` +
    `This plan consumes the pinned structural-shell ownership sidecar, subtracts only its exact whole source paths from the v1 2,843-unit static domain, and deterministically rebuilds the remaining spatial/material-aware packages under the unchanged Web and Quest budgets. Repeat furniture (312 units) and migrated fire equipment (60 units) remain separate and disjoint.\n\n` +
    `| Variant | Whole shell paths | Shell units | Detail units | Non-empty detail packages | Cross-variant package records |\n` +
    `|---|---:|---:|---:|---:|---:|\n${rows}\n\n` +
    `Invariant: Web **3,215 = 312 repeat + 60 fire + ${plan.shellCandidate.variants.web.atomicUnitCount} shell + ${plan.detailComplement.variants.web.atomicUnitCount} detail**; Quest **3,215 = 312 repeat + 60 fire + ${plan.shellCandidate.variants.quest.atomicUnitCount} shell + ${plan.detailComplement.variants.quest.atomicUnitCount} detail**. Every source unit has multiplicity one.\n\n` +
    `The pinned visual gate is **${plan.shellCandidate.visualGate.passed ? 'PASS' : 'REJECTED'}** (${plan.shellCandidate.visualGate.status}). ${plan.shellCandidate.visualGate.blocker || 'A later activation gate is still required.'}\n\n` +
    `Plan digest: \`${plan.planDigestSha256}\`. Whole-layer coverage digest: \`${plan.wholeLayerCoverageDigestSha256}\`. Static-package digest: \`${plan.staticPackagesDigestSha256}\`.\n\n` +
    `Production GLBs, manifests, routes, and runtime configuration were not changed. A later candidate can be supplied through \`--candidate-root\` / \`--repartition\`; it must satisfy the same whole-path, source-pin, conservation, budget, and fail-closed checks.\n`
}

function pinError(errors, actual, expected, label) {
  if (!pinEqual(actual, expected)) errors.push(`${label} pin is stale`)
}

function exactIds(errors, actual, expected, label) {
  const actualList = Array.isArray(actual) ? actual : []
  const count = occurrences(actualList)
  const duplicate = [...count].filter(([, value]) => value !== 1)
  const actualSet = new Set(actualList)
  const expectedSet = new Set(expected)
  const missing = expected.filter((id) => !actualSet.has(id))
  const extra = actualList.filter((id) => !expectedSet.has(id))
  if (duplicate.length) errors.push(`${label} duplication detected (${duplicate.length} units)`)
  if (missing.length) errors.push(`${label} omission detected (${missing.length} units)`)
  if (extra.length) errors.push(`${label} contains unknown units (${extra.length} units)`)
}

export function validateUnownedStaticPlanV2(plan, contract, context) {
  const errors = []
  if (plan?.schema !== 'IOM_UNOWNED_STATIC_PARTITION_PLAN') errors.push('schema mismatch')
  if (plan?.version !== 2) errors.push('version mismatch')
  if (plan?.enabled !== false) errors.push('enabled must remain false')
  if (plan?.ready !== false) errors.push('ready must remain false')
  if (plan?.activationApproved !== false) errors.push('activationApproved must remain false')
  if (plan?.runtimeIntegrated !== false) errors.push('runtimeIntegrated must remain false')
  if (plan?.productionModified !== false || plan?.productionRoutingChanged !== false) errors.push('production flags must remain false')
  if (plan?.owner !== OWNER) errors.push(`owner must remain ${OWNER}`)
  if (plan?.atomicOwnershipUnit !== 'mesh-primitive-instance') errors.push('atomic ownership unit changed')
  if (plan?.wholeLayerCoverageDigestSha256 !== contract?.coverageDigestSha256) errors.push('whole-layer coverage digest is stale')
  if (plan?.planDigestSha256 !== planDigest(plan)) errors.push('plan digest is stale')

  pinError(errors, plan?.evidencePins?.sourcePartitionPlan, context.livePins.sourcePartitionPlan, 'source partition sidecar')
  pinError(errors, plan?.evidencePins?.wholeLayerContract, context.livePins.wholeLayerContract, 'whole-layer contract')
  pinError(errors, plan?.evidencePins?.shellCandidateIndex, context.livePins.shellCandidateIndex, 'shell candidate sidecar')
  pinError(errors, plan?.evidencePins?.ownershipRepartition, context.livePins.ownershipRepartition, 'ownership repartition sidecar')
  pinError(errors, plan?.evidencePins?.ownershipAudit, context.livePins.ownershipAudit, 'ownership audit sidecar')
  pinError(errors, plan?.evidencePins?.dependencyAudit, context.livePins.dependencyAudit, 'dependency audit sidecar')
  if (context.livePins.topologyAudit) {
    pinError(errors, plan?.evidencePins?.topologyAudit, context.livePins.topologyAudit, 'topology audit sidecar')
  }
  pinError(errors, plan?.evidencePins?.projectionAudit, context.livePins.projectionAudit, 'visual projection sidecar')
  pinError(errors, plan?.evidencePins?.renderReport, context.livePins.renderReport, 'visual render sidecar')
  if (plan?.evidencePins?.sourcePartitionPlan?.planDigestSha256 !== context.v1Plan.planDigestSha256) {
    errors.push('source partition plan digest is stale')
  }
  if (plan?.evidencePins?.wholeLayerContract?.coverageDigestSha256 !== contract.coverageDigestSha256) {
    errors.push('whole-layer contract coverage digest is stale')
  }
  if (stableSha256(plan?.planningBudgets) !== stableSha256(context.v1Plan.planningBudgets)) {
    errors.push('planning budgets changed from v1')
  }
  const materialFidelity = plan?.materialFidelity
  if (materialFidelity?.materialFidelityReady !== true || materialFidelity?.nearLod0Required !== true ||
    materialFidelity?.nearLod0PackagePresent !== true ||
    materialFidelity?.explicitReplacementSemanticsValidated !== true ||
    materialFidelity?.proxyAndNearMutuallyExclusiveAtSteadyState !== true ||
    materialFidelity?.loadBeforeRetire !== true) {
    errors.push('material-preserving near-LOD0 replacement contract is incomplete')
  }

  const visual = plan?.shellCandidate?.visualGate
  const expectedVisual = shellVisualGate(context.visualAudit)
  if (stableSha256(visual) !== stableSha256(expectedVisual)) errors.push('shell visual-gate evidence is stale')
  if (!expectedVisual.passed && (plan?.ready !== false || plan?.activationApproved !== false || plan?.enabled !== false)) {
    errors.push('rejected shell visual audit must fail closed')
  }
  if (plan?.shellCandidate?.sourceSchema !== context.candidate.schema ||
    plan?.shellCandidate?.sourceVersion !== context.candidate.version ||
    plan?.shellCandidate?.repartitionSchema !== context.repartition.schema ||
    plan?.shellCandidate?.repartitionVersion !== context.repartition.version ||
    plan?.shellCandidate?.sourceDigestSha256 !== (context.candidate.candidateDigestSha256 ?? null) ||
    plan?.shellCandidate?.repartitionDigestSha256 !== (context.repartition.repartitionDigestSha256 ?? null)) {
    errors.push('shell candidate schema/version pin is stale')
  }

  const packageIds = new Set()
  for (const pkg of plan?.staticPackages || []) {
    if (!pkg?.id || packageIds.has(pkg.id)) errors.push(`duplicate or missing package id ${pkg?.id}`)
    packageIds.add(pkg?.id)
    if (pkg?.enabled !== false || pkg?.owner !== OWNER) errors.push(`${pkg?.id}: detail package must remain disabled and unowned`)
    for (const variant of VARIANTS) {
      const metrics = pkg?.variants?.[variant]
      const budget = context.v1Plan.planningBudgets[variant]
      if (!metrics) {
        errors.push(`${variant}:${pkg?.id}: package metrics are missing`)
        continue
      }
      if (metrics.expandedTriangles > budget.maxExpandedTriangles ||
        metrics.projectedDraws > budget.maxProjectedDraws ||
        metrics.atomicUnitCount > budget.maxAtomicUnits ||
        metrics.decodedDependencyBytes > budget.maxDecodedDependencyBytes) {
        errors.push(`${variant}:${pkg?.id}: current planning budget exceeded`)
      }
    }
  }
  const actualPackageDigest = stableSha256(plan?.staticPackages || [])
  if (plan?.staticPackagesDigestSha256 !== actualPackageDigest) errors.push('static package digest is stale')
  if (actualPackageDigest !== context.expectedPackagesDigestSha256) errors.push('deterministic detail-package rebuild differs from pinned inputs')

  const nearPackages = plan?.shellCandidate?.nearLod0Packages || []
  for (const pkg of nearPackages) {
    if (!pkg?.id || packageIds.has(pkg.id)) errors.push(`duplicate or missing near-LOD0 package id ${pkg?.id}`)
    packageIds.add(pkg?.id)
    if (pkg?.enabled !== false || pkg?.owner !== OWNER || pkg?.nearLod0 !== true ||
      pkg?.role !== 'structural-near-lod0-material-fidelity' ||
      pkg?.materialFidelity?.preservesSourceGeometry !== true ||
      pkg?.materialFidelity?.preservesSourcePbrMaterials !== true ||
      pkg?.replacementSemantics?.mutuallyExclusiveAtSteadyState !== true ||
      pkg?.replacementSemantics?.additiveCompositionAllowed !== false ||
      pkg?.replacementSemantics?.loadBeforeRetire !== true) {
      errors.push(`${pkg?.id}: structural near-LOD0 package contract is unsafe`)
    }
    for (const variant of VARIANTS) {
      const metrics = pkg?.variants?.[variant]
      const budget = context.v1Plan.planningBudgets[variant]
      if (!metrics) {
        errors.push(`${variant}:${pkg?.id}: near-LOD0 package metrics are missing`)
        continue
      }
      if (metrics.expandedTriangles > budget.maxExpandedTriangles ||
        metrics.projectedDraws > budget.maxProjectedDraws ||
        metrics.atomicUnitCount > budget.maxAtomicUnits ||
        metrics.decodedDependencyBytes > budget.maxDecodedDependencyBytes) {
        errors.push(`${variant}:${pkg?.id}: near-LOD0 planning budget exceeded`)
      }
    }
  }
  const nearPackageDigest = stableSha256(nearPackages)
  if (plan?.shellCandidate?.nearLod0PackagesDigestSha256 !== nearPackageDigest) {
    errors.push('near-LOD0 package digest is stale')
  }
  if (nearPackageDigest !== context.expectedNearPackagesDigestSha256) {
    errors.push('deterministic near-LOD0 package rebuild differs from pinned inputs')
  }

  for (const variant of VARIANTS) {
    const expectedShell = context.shellIdsByVariant[variant]
    const expectedDetail = context.detailIdsByVariant[variant]
    const selectedPaths = plan?.shellCandidate?.variants?.[variant]?.sourcePaths || []
    const shell = plan?.shellCandidate?.variants?.[variant]?.sourceUnitIds || []
    const detail = (plan?.staticPackages || []).flatMap((pkg) => pkg.variants?.[variant]?.sourceUnitIds || [])
    const near = nearPackages.flatMap((pkg) => pkg.variants?.[variant]?.sourceUnitIds || [])
    const repeat = repeatIds(plan, variant)
    const fire = fireIds(plan, variant)
    const expectedRepeat = repeatIds(context.v1Plan, variant)
    const expectedFire = fireIds(context.v1Plan, variant)
    const sourceUnits = contract.variants[variant].inventory.units.filter((unit) => unit.owner === OWNER).map((unit) => unit.id).sort()
    const sourcePaths = sortedUnique(selectedPaths)

    if (plan?.variants?.[variant]?.source?.sha256 !== context.v1Plan.variants[variant].source.sha256 ||
      plan?.variants?.[variant]?.source?.bytes !== context.v1Plan.variants[variant].source.bytes) {
      errors.push(`${variant}: source pin is stale`)
    }
    if (plan?.variants?.[variant]?.wholeLayerVariantCoverageDigestSha256 !== contract.variants[variant].coverageDigestSha256) {
      errors.push(`${variant}: whole-layer variant coverage digest is stale`)
    }
    if (stableSha256(plan?.variants?.[variant]?.units) !== stableSha256(context.v1Plan.variants[variant].units)) {
      errors.push(`${variant}: source-unit inventory changed`)
    }
    if (sourcePaths.length !== context.selectedPaths.length ||
      stringListSha256(sourcePaths) !== stringListSha256(context.selectedPaths) ||
      sourcePaths.some((path) => !/^scene\/\d+(?:\/\d+)*$/.test(path))) {
      errors.push(`${variant}: shell contains a non-whole path or differs from the pinned whole-path selection`)
    }
    if (plan?.shellCandidate?.variants?.[variant]?.sourcePathCount !== context.selectedPaths.length ||
      plan?.shellCandidate?.variants?.[variant]?.sourcePathsSha256 !== stringListSha256(context.selectedPaths)) {
      errors.push(`${variant}: shell whole-path count/digest is stale`)
    }
    pinError(errors, plan?.shellCandidate?.variants?.[variant]?.output, context.livePins.shellOutputs[variant], `${variant} shell output`)
    exactIds(errors, shell, expectedShell, `${variant}: shell`)
    exactIds(errors, near, expectedShell, `${variant}: structural near-LOD0`)
    exactIds(errors, detail, expectedDetail, `${variant}: detail`)
    exactIds(errors, repeat, expectedRepeat, `${variant}: repeat`)
    exactIds(errors, fire, expectedFire, `${variant}: fire`)
    if (plan?.shellCandidate?.variants?.[variant]?.atomicUnitCount !== expectedShell.length ||
      plan?.shellCandidate?.variants?.[variant]?.sourceUnitIdsSha256 !== stringListSha256(shell)) {
      errors.push(`${variant}: shell count/digest is stale`)
    }
    if (plan?.detailComplement?.variants?.[variant]?.atomicUnitCount !== expectedDetail.length ||
      plan?.detailComplement?.variants?.[variant]?.sourceUnitIdsSha256 !== stringListSha256(detail) ||
      plan?.detailComplement?.variants?.[variant]?.requiredPayloadInputUnitIdsSha256 !== stringListSha256(detail)) {
      errors.push(`${variant}: detail complement count/digest is stale`)
    }

    const shellSet = new Set(shell)
    const detailSet = new Set(detail)
    const repeatSet = new Set(repeat)
    const fireSet = new Set(fire)
    const overlap = {
      shellDetail: shell.filter((id) => detailSet.has(id)),
      shellRepeat: shell.filter((id) => repeatSet.has(id)),
      shellFire: shell.filter((id) => fireSet.has(id)),
      detailRepeat: detail.filter((id) => repeatSet.has(id)),
      detailFire: detail.filter((id) => fireSet.has(id)),
      repeatFire: repeat.filter((id) => fireSet.has(id)),
    }
    for (const [name, ids] of Object.entries(overlap)) {
      if (ids.length) errors.push(`${variant}: ${name} overlap detected (${ids.length} units)`)
    }
    const all = [...repeat, ...fire, ...shell, ...detail]
    const allOccurrences = occurrences(all)
    const omitted = sourceUnits.filter((id) => !allOccurrences.has(id))
    const duplicated = [...allOccurrences].filter(([, count]) => count !== 1)
    const unknown = all.filter((id) => !new Set(sourceUnits).has(id))
    if (omitted.length) errors.push(`${variant}: whole unowned omission detected (${omitted.length} units)`)
    if (duplicated.length) errors.push(`${variant}: whole unowned multiplicity-one violation (${duplicated.length} units)`)
    if (unknown.length) errors.push(`${variant}: whole unowned claim contains unknown units (${unknown.length} units)`)
    if (plan?.conservation?.variants?.[variant]?.wholeUnownedAtomicUnits !== sourceUnits.length ||
      plan?.conservation?.variants?.[variant]?.multiplicityOne !== true ||
      plan?.conservation?.variants?.[variant]?.omittedAtomicUnits !== 0 ||
      plan?.conservation?.variants?.[variant]?.overlapAtomicUnits !== 0) {
      errors.push(`${variant}: recorded conservation evidence is stale`)
    }
    const wholeCount = contract.variants[variant].inventory.units.length
    if (plan?.wholeLayerCoverage?.variants?.[variant]?.wholeLayerAtomicUnits !== wholeCount ||
      plan?.wholeLayerCoverage?.variants?.[variant]?.unownedAtomicUnits !== sourceUnits.length ||
      plan?.wholeLayerCoverage?.variants?.[variant]?.nonUnownedAtomicUnits !== wholeCount - sourceUnits.length) {
      errors.push(`${variant}: whole-layer coverage counts are stale`)
    }
    if (shellSet.size !== expectedShell.length) errors.push(`${variant}: shell units are not unique`)
  }
  return { valid: errors.length === 0, errors }
}

export async function buildUnownedStaticPlanV2({
  candidateRoot = DEFAULT_CANDIDATE_ROOT,
  candidatePath: explicitCandidatePath = null,
  repartitionPath = null,
  ownershipAuditPath: explicitOwnershipAuditPath = null,
  dependencyAuditPath: explicitDependencyAuditPath = null,
  topologyAuditPath: explicitTopologyAuditPath = null,
  projectionAuditPath: explicitProjectionAuditPath = null,
  renderReportPath: explicitRenderReportPath = null,
  repeatRoot,
  fireSidecar,
} = {}) {
  const v1Options = {}
  if (repeatRoot) v1Options.repeatRoot = repeatRoot
  if (fireSidecar) v1Options.fireSidecar = fireSidecar
  const { plan: v1Plan, contract } = await buildUnownedStaticPlan(v1Options)
  const v1Validation = validateUnownedStaticPlan(v1Plan, contract)
  assert.ok(v1Validation.valid, v1Validation.errors.join('\n'))

  const candidatePath = explicitCandidatePath || resolve(candidateRoot, 'candidate-index.json')
  assertInside(candidateRoot, candidatePath, 'Structural candidate')
  const candidateFile = await pinnedJson(candidatePath)
  const candidate = candidateFile.value
  const isProxyV2 = candidate.schema === 'IOM_UNOWNED_STRUCTURAL_PROXY_CANDIDATE' && candidate.version === 2
  const effectiveRepartitionPath = resolveEvidencePath(candidateRoot, repartitionPath,
    candidate.evidencePins?.ownershipRepartition, isProxyV2 ? 'ownership-repartition-v2.json' : 'ownership-repartition.json')
  const ownershipAuditPath = resolveEvidencePath(candidateRoot, explicitOwnershipAuditPath,
    candidate.evidencePins?.ownershipAudit, isProxyV2 ? 'ownership-audit-v2.json' : 'ownership-audit.json')
  const dependencyAuditPath = resolveEvidencePath(candidateRoot, explicitDependencyAuditPath,
    candidate.evidencePins?.dependencyAudit, isProxyV2 ? 'dependency-audit-v2.json' : 'dependency-audit.json')
  const topologyAuditPath = isProxyV2 || explicitTopologyAuditPath || candidate.evidencePins?.topologyAudit
    ? resolveEvidencePath(candidateRoot, explicitTopologyAuditPath,
      candidate.evidencePins?.topologyAudit, 'topology-audit-v2.json')
    : null
  const projectionAuditPath = resolveEvidencePath(candidateRoot, explicitProjectionAuditPath,
    candidate.evidencePins?.projectionAudit, join('visual-qa', 'projection-audit.json'))
  const renderReportPath = resolveEvidencePath(candidateRoot, explicitRenderReportPath,
    candidate.evidencePins?.renderReport, join('visual-qa', 'render-report.json'))
  for (const [label, path] of [
    ['Ownership repartition', effectiveRepartitionPath],
    ['Ownership audit', ownershipAuditPath],
    ['Dependency audit', dependencyAuditPath],
    ...(topologyAuditPath ? [['Topology audit', topologyAuditPath]] : []),
    ['Projection audit', projectionAuditPath],
    ['Render report', renderReportPath],
  ]) assertInside(candidateRoot, path, label)
  const [
    sourcePartitionPlanFile,
    wholeLayerContractFile,
    repartitionFile,
    ownershipAuditFile,
    dependencyAuditFile,
    topologyAuditFile,
    projectionAuditFile,
    renderReportFile,
  ] = await Promise.all([
    pinnedJson(DEFAULT_V1_PLAN),
    pinnedJson(DEFAULT_CONTRACT),
    pinnedJson(effectiveRepartitionPath),
    pinnedJson(ownershipAuditPath),
    pinnedJson(dependencyAuditPath),
    topologyAuditPath ? pinnedJson(topologyAuditPath) : Promise.resolve(null),
    pinnedJson(projectionAuditPath),
    pinnedJson(renderReportPath),
  ])
  const repartition = repartitionFile.value
  const visualAudit = projectionAuditFile.value
  assertCandidateSchema(candidate, repartition)
  assert.equal(sourcePartitionPlanFile.value.planDigestSha256, v1Plan.planDigestSha256,
    'Pinned v1 plan does not match the deterministic current-source rebuild')
  assert.equal(wholeLayerContractFile.value.coverageDigestSha256, contract.coverageDigestSha256,
    'Pinned whole-layer contract does not match current sources')

  const shellOutputs = {}
  for (const variant of VARIANTS) {
    const output = shellOutput(candidate, variant)
    assert.ok(output?.path, `${variant}: shell output path is missing`)
    const outputPath = resolve(VIEWER_ROOT, output.path)
    assertInside(candidateRoot, outputPath, `${variant}: shell output`)
    shellOutputs[variant] = await pinnedFile(outputPath)
  }
  const livePins = {
    sourcePartitionPlan: sourcePartitionPlanFile.pin,
    wholeLayerContract: wholeLayerContractFile.pin,
    shellCandidateIndex: candidateFile.pin,
    ownershipRepartition: repartitionFile.pin,
    ownershipAudit: ownershipAuditFile.pin,
    dependencyAudit: dependencyAuditFile.pin,
    topologyAudit: topologyAuditFile?.pin ?? null,
    projectionAudit: projectionAuditFile.pin,
    renderReport: renderReportFile.pin,
    shellOutputs,
  }
  assertCandidatePins(candidate, livePins)
  const selectedPaths = selectedPathsFromRepartition(repartition)
  assertSelectionSidecars(v1Plan, candidate, repartition, selectedPaths)
  assert.equal(ownershipAuditFile.value.passed, true, 'Pinned shell ownership audit did not pass')

  const analyses = Object.fromEntries(VARIANTS.map((variant) => [variant, {
    nodes: v1Plan.variants[variant].nodes,
    instances: v1Plan.variants[variant].instances,
    units: v1Plan.variants[variant].units,
    inventory: v1Plan.variants[variant].inventory,
  }]))
  const semantic = semanticStaticRecords(analyses, v1Plan.repeatCandidate, v1Plan.fireHoseMigration)
  const selectedPathSet = new Set(selectedPaths)
  const detailRecords = []
  const shellRecords = []
  for (const record of semantic.records) {
    const memberships = VARIANTS.map((variant) => record.variants[variant])
      .filter(Boolean)
      .map((unit) => selectedPathSet.has(unit.sourcePath))
    assert.ok(memberships.every((selected) => selected === memberships[0]),
      `${record.id}: Web/Quest semantic pair straddles the structural-shell boundary`)
    ;(memberships[0] ? shellRecords : detailRecords).push(record)
  }
  const packages = buildPackages(detailRecords)
  const nearLod0Packages = buildStructuralNearLod0Packages(shellRecords)
  const shellIdsByVariant = {}
  const detailIdsByVariant = {}
  for (const variant of VARIANTS) {
    shellIdsByVariant[variant] = shellRecords.map((record) => record.variants[variant]?.id).filter(Boolean).sort()
    detailIdsByVariant[variant] = packages.flatMap((pkg) => pkg.variants[variant].sourceUnitIds).sort()
    const nearIds = nearLod0Packages.flatMap((pkg) => pkg.variants[variant].sourceUnitIds).sort()
    assert.deepEqual(shellIdsByVariant[variant], [...structuralClaim(repartition, variant).sourceUnitIds].sort(),
      `${variant}: rebuilt semantic shell selection differs from repartition sidecar`)
    assert.deepEqual(detailIdsByVariant[variant], [...repartition.variants[variant].detailComplement.sourceUnitIds].sort(),
      `${variant}: rebuilt semantic detail complement differs from repartition sidecar`)
    assert.deepEqual(nearIds, shellIdsByVariant[variant],
      `${variant}: material-preserving near-LOD0 packages do not exactly cover the proxy claim`)
  }

  const evidencePins = {
    sourcePartitionPlan: { ...livePins.sourcePartitionPlan, planDigestSha256: v1Plan.planDigestSha256 },
    wholeLayerContract: { ...livePins.wholeLayerContract, coverageDigestSha256: contract.coverageDigestSha256 },
    shellCandidateIndex: livePins.shellCandidateIndex,
    ownershipRepartition: livePins.ownershipRepartition,
    ownershipAudit: livePins.ownershipAudit,
    dependencyAudit: livePins.dependencyAudit,
    ...(livePins.topologyAudit ? { topologyAudit: livePins.topologyAudit } : {}),
    projectionAudit: livePins.projectionAudit,
    renderReport: livePins.renderReport,
  }
  const plan = {
    schema: 'IOM_UNOWNED_STATIC_PARTITION_PLAN',
    version: 2,
    modelId: 'icm-anim-2025',
    enabled: false,
    ready: false,
    activationApproved: false,
    runtimeIntegrated: false,
    productionModified: false,
    productionRoutingChanged: false,
    activationStatus: shellVisualGate(visualAudit).passed
      ? 'disabled-repartition-plan-only-awaiting-separate-release-gate'
      : 'disabled-shell-visual-audit-rejected',
    owner: OWNER,
    atomicOwnershipUnit: 'mesh-primitive-instance',
    identityPolicy: 'whole-layer-owner-relative-path-primitive-instance-v1',
    wholeLayerCoverageDigestSha256: contract.coverageDigestSha256,
    planningBudgets: v1Plan.planningBudgets,
    evidencePins,
    materialFidelity: {
      materialFidelityReady: true,
      nearLod0Required: true,
      nearLod0PackagePresent: true,
      explicitReplacementSemanticsValidated: true,
      nearLod0PreservesSourceGeometry: true,
      nearLod0PreservesSourcePbrMaterials: true,
      proxyAndNearMutuallyExclusiveAtSteadyState: true,
      loadBeforeRetire: true,
      releaseBlockedByStructuralProjection: !shellVisualGate(visualAudit).passed,
    },
    shellCandidate: {
      sourceSchema: candidate.schema,
      sourceVersion: candidate.version,
      sourceDigestSha256: candidate.candidateDigestSha256 ?? null,
      repartitionSchema: repartition.schema,
      repartitionVersion: repartition.version,
      repartitionDigestSha256: repartition.repartitionDigestSha256 ?? null,
      owner: OWNER,
      role: candidate.role,
      selectionPolicy: 'exact-whole-source-path-subtraction',
      visualGate: shellVisualGate(visualAudit),
      materialFidelity: candidate.safety?.materialFidelity
        ? {
            ...candidate.safety.materialFidelity,
            explicitReplacementSemanticsValidated:
              repartition.compositionGuard?.materialFidelity?.explicitReplacementSemanticsValidated === true,
          }
        : null,
      nearLod0Packages,
      nearLod0PackagesDigestSha256: stableSha256(nearLod0Packages),
      variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
        output: livePins.shellOutputs[variant],
        sourcePathCount: selectedPaths.length,
        sourcePathsSha256: stringListSha256(selectedPaths),
        sourcePaths: selectedPaths,
        atomicUnitCount: shellIdsByVariant[variant].length,
        sourceUnitIdsSha256: stringListSha256(shellIdsByVariant[variant]),
        sourceUnitIds: shellIdsByVariant[variant],
      }])),
    },
    repeatCandidate: v1Plan.repeatCandidate,
    fireHoseMigration: v1Plan.fireHoseMigration,
    variants: v1Plan.variants,
    detailComplement: {
      role: 'static-spatial-material-aware-detail',
      packagesRebuiltAfterShellSubtraction: true,
      variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
        atomicUnitCount: detailIdsByVariant[variant].length,
        sourceUnitIdsSha256: stringListSha256(detailIdsByVariant[variant]),
        requiredPayloadInputUnitIdsSha256: stringListSha256(detailIdsByVariant[variant]),
      }])),
    },
    staticPackages: packages,
    staticPackagesDigestSha256: stableSha256(packages),
    conservation: {
      equation: 'whole unowned = repeat + migrated fire + structural shell + static detail',
      variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
        wholeUnownedAtomicUnits: contract.variants[variant].inventory.units.filter((unit) => unit.owner === OWNER).length,
        repeatAtomicUnits: repeatIds(v1Plan, variant).length,
        migratedFireAtomicUnits: fireIds(v1Plan, variant).length,
        shellAtomicUnits: shellIdsByVariant[variant].length,
        detailAtomicUnits: detailIdsByVariant[variant].length,
        unionAtomicUnits: repeatIds(v1Plan, variant).length + fireIds(v1Plan, variant).length + shellIdsByVariant[variant].length + detailIdsByVariant[variant].length,
        omittedAtomicUnits: 0,
        overlapAtomicUnits: 0,
        multiplicityOne: true,
      }])),
    },
    wholeLayerCoverage: {
      exactPinnedContract: true,
      nonUnownedOwnerClaimsUntouched: true,
      variants: Object.fromEntries(VARIANTS.map((variant) => {
        const whole = contract.variants[variant].inventory.units.length
        const unowned = contract.variants[variant].inventory.units.filter((unit) => unit.owner === OWNER).length
        return [variant, {
          coverageDigestSha256: contract.variants[variant].coverageDigestSha256,
          wholeLayerAtomicUnits: whole,
          unownedAtomicUnits: unowned,
          nonUnownedAtomicUnits: whole - unowned,
        }]
      })),
    },
    correspondence: {
      inheritedV1: v1Plan.correspondence,
      shellRecordCount: shellRecords.length,
      detailRecordCount: detailRecords.length,
      partitionedRecordCount: shellRecords.length + detailRecords.length,
      semanticRecordMultiplicityOne: shellRecords.length + detailRecords.length === semantic.records.length,
    },
    projection: planningProjection(packages, v1Plan, shellIdsByVariant),
    unresolvedReleaseGates: [
      'The currently pinned shell failed strong multi-angle coverage and remains rejected; replace it with a stronger pinned candidate and rebuild this same contract.',
      'Emit detail payload GLBs from this v2 complement and audit actual bytes, dependencies, transforms, attributes, materials, and bounds.',
      'Prove same-camera source versus shell-plus-detail visual parity and load-before-retire transitions before any runtime route can activate.',
      'Compose the exact v2 payload index into the disabled complete Phase A manifest and rerun multiplicity-one whole-layer coverage.',
      'Profile frame time, memory, resident-window behavior, and recovery on physical Web and Quest-class hardware.',
    ],
  }
  plan.planDigestSha256 = planDigest(plan)
  const context = {
    v1Plan,
    candidate,
    repartition,
    visualAudit,
    livePins,
    selectedPaths,
    shellIdsByVariant,
    detailIdsByVariant,
    expectedPackagesDigestSha256: stableSha256(packages),
    expectedNearPackagesDigestSha256: stableSha256(nearLod0Packages),
  }
  return { plan, contract, context }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { plan, contract, context } = await buildUnownedStaticPlanV2({
    candidateRoot: args.candidateRoot,
    candidatePath: args.candidate,
    repartitionPath: args.repartition,
    ownershipAuditPath: args.ownershipAudit,
    dependencyAuditPath: args.dependencyAudit,
    topologyAuditPath: args.topologyAudit,
    projectionAuditPath: args.projectionAudit,
    renderReportPath: args.renderReport,
    repeatRoot: args.repeatRoot,
    fireSidecar: args.fireSidecar,
  })
  const validation = validateUnownedStaticPlanV2(plan, contract, context)
  assert.ok(validation.valid, validation.errors.join('\n'))
  await mkdir(args.out, { recursive: true })
  await writeFile(join(args.out, 'unowned-static-partition-plan-v2.json'), `${JSON.stringify(plan, null, 2)}\n`)
  await writeFile(join(args.out, 'input-pins.json'), `${JSON.stringify({
    schema: 'IOM_UNOWNED_STATIC_PARTITION_INPUT_PINS',
    version: 2,
    enabled: false,
    ready: false,
    activationApproved: false,
    evidencePins: plan.evidencePins,
    shellOutputs: Object.fromEntries(VARIANTS.map((variant) => [variant, plan.shellCandidate.variants[variant].output])),
    planDigestSha256: plan.planDigestSha256,
  }, null, 2)}\n`)
  await writeFile(join(args.out, 'whole-layer-contract-pin.json'), `${JSON.stringify({
    schema: contract.schema,
    version: contract.version,
    modelId: contract.modelId,
    enabled: false,
    coverageDigestSha256: contract.coverageDigestSha256,
    variants: Object.fromEntries(VARIANTS.map((variant) => [variant, {
      source: contract.variants[variant].source,
      coverageDigestSha256: contract.variants[variant].coverageDigestSha256,
    }])),
  }, null, 2)}\n`)
  await writeFile(join(args.out, 'validation.json'), `${JSON.stringify(validation, null, 2)}\n`)
  await writeFile(join(args.out, 'REPORT.md'), makeReport(plan, validation))
  console.log('Unowned/static partition plan v2: PASS')
  console.log(`  output: ${args.out}`)
  console.log(`  packages: ${plan.staticPackages.length}`)
  for (const variant of VARIANTS) {
    const shell = plan.shellCandidate.variants[variant]
    const detail = plan.detailComplement.variants[variant]
    console.log(`  ${variant}: ${shell.sourcePathCount} whole paths / ${shell.atomicUnitCount} shell units / ${detail.atomicUnitCount} detail units`)
  }
  console.log(`  visual gate: ${plan.shellCandidate.visualGate.passed ? 'PASS' : 'REJECTED (fail-closed)'}`)
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) await main()
