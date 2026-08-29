#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  analyzeSpatialResidentResourceWindow,
  analyzeSpatialResidentWindow,
  evaluateSpatialBudget,
} from './lib/spatial-resident-window.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const DEFAULT_PLAN = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v1', 'unowned-static-partition-plan-v1.json')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-resident-window-plan-v1')
const VARIANTS = ['web', 'quest']
const METRIC_KEYS = ['triangles', 'draws', 'bytes', 'encodedTextureBytes', 'gpuTextureBytes']
const POLICY = {
  selectionMarginMeters: 1.5,
  exitMarginMeters: 3.5,
  budgets: {
    web: {
      triangles: 2_000_000,
      draws: 1_200,
      bytes: 512 * 1024 * 1024,
      encodedTextureBytes: 256 * 1024 * 1024,
      gpuTextureBytes: 768 * 1024 * 1024,
    },
    quest: {
      triangles: 800_000,
      draws: 500,
      bytes: 256 * 1024 * 1024,
      encodedTextureBytes: 64 * 1024 * 1024,
      gpuTextureBytes: 192 * 1024 * 1024,
    },
  },
}

function parseArgs(argv) {
  const result = {
    plan: DEFAULT_PLAN,
    out: DEFAULT_OUT,
    payloadIndex: null,
    payloadAudit: null,
    sharedTextureBrowserQa: null,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--plan') result.plan = resolve(argv[++index])
    else if (value === '--out') result.out = resolve(argv[++index])
    else if (value === '--payload-index') result.payloadIndex = resolve(argv[++index])
    else if (value === '--payload-audit') result.payloadAudit = resolve(argv[++index])
    else if (value === '--shared-texture-browser-qa') result.sharedTextureBrowserQa = resolve(argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return result
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function physicalPlanPackages(plan) {
  return [
    ...(plan?.staticPackages || []),
    ...(plan?.nearLod0Packages || []),
    ...(plan?.shellCandidate?.nearLod0Packages || []),
    ...(plan?.structuralProxy?.nearLod0Packages || []),
  ]
}

function toItems(plan, variant, payloadIndex) {
  const emittedById = payloadIndex
    ? new Map(payloadIndex.packages.map((pkg) => [pkg.id, pkg.variants?.[variant]]))
    : null
  return physicalPlanPackages(plan).map((pkg) => {
    const source = pkg.variants?.[variant]
    assert(source, `${pkg.id}: missing ${variant} planning record`)
    const emitted = emittedById?.get(pkg.id)
    if (emittedById) {
      assert(emitted, `${pkg.id}: missing ${variant} emitted payload record`)
      assert(emitted.sourceUnitIdsSha256 === sha256(JSON.stringify([...source.sourceUnitIds].sort())),
        `${pkg.id}: ${variant} emitted source-unit digest differs from plan`)
      assert(emitted.expandedTriangles === source.expandedTriangles,
        `${pkg.id}: ${variant} emitted triangle count differs from plan`)
    }
    const resources = emitted?.textureMemory?.sharedTextureResidency?.resources ?? []
    if (emitted) {
      assert(emitted.textureMemory?.sharedTextureResidency?.annotationComplete === true,
        `${pkg.id}: ${variant} shared-texture annotation is incomplete`)
      assert(new Set(resources.map((resource) => resource.keySha256)).size === resources.length,
        `${pkg.id}: ${variant} shared-texture resources are duplicated`)
    }
    return {
      id: pkg.id,
      bounds: source.bounds,
      resources: resources.map((resource) => ({
        key: resource.keySha256,
        estimate: { gpuTextureBytes: resource.conservativeDecodedRgba8Bytes },
      })),
      estimate: emitted
        ? {
            triangles: emitted.expandedTriangles,
            draws: emitted.payloadDraws,
            bytes: emitted.asset.bytes,
            encodedTextureBytes: emitted.textureMemory.embeddedEncodedImageBytes,
            gpuTextureBytes: emitted.textureMemory.conservativeDecodedImageBytesRgba8,
          }
        : {
            triangles: source.expandedTriangles,
            draws: source.projectedDraws,
            // Planning has no encoded GLB byte count. decodedDependencyBytes is
            // used as an explicit conservative proxy and never as release proof.
            bytes: source.decodedDependencyBytes,
            encodedTextureBytes: source.embeddedTextureBytes,
            gpuTextureBytes: source.decodedDependencyBytes,
          },
    }
  })
}

function headroom(evaluation) {
  return Object.fromEntries(Object.entries(evaluation.metrics).map(([key, metric]) => [key, {
    remaining: metric.budget - metric.value,
    utilization: metric.utilization,
  }]))
}

function compactWorst(analysis) {
  return Object.fromEntries(Object.entries(analysis.worstByMetric).map(([key, record]) => [key, {
    value: record.totals[key],
    focus: record.focus,
    packageCount: record.packageCount,
    packageIds: record.packageIds,
    ...(record.resourceCount === undefined ? {} : { resourceCount: record.resourceCount }),
    simultaneousTotals: record.totals,
  }]))
}

function applySharedGpuTexturePooling(additive, pooled) {
  return {
    ...additive,
    worstByMetric: { ...additive.worstByMetric, gpuTextureBytes: pooled.worstByMetric.gpuTextureBytes },
    stats: { additive: additive.stats, sharedGpuTextureResources: pooled.stats },
    sharedTexturePooling: {
      exact: pooled.exact,
      closedBounds: pooled.closedBounds,
      compatibilityResourceKeysUnique: pooled.uniqueResourceKeys,
      unpooledWorstGpuTextureBytes: additive.worstByMetric.gpuTextureBytes.totals.gpuTextureBytes,
      pooledWorstGpuTextureBytes: pooled.worstByMetric.gpuTextureBytes.totals.gpuTextureBytes,
      savedGpuTextureBytes: additive.worstByMetric.gpuTextureBytes.totals.gpuTextureBytes -
        pooled.worstByMetric.gpuTextureBytes.totals.gpuTextureBytes,
    },
  }
}

function reportMarkdown(result, planPath, outPath) {
  const rows = []
  for (const variant of VARIANTS) {
    const exit = result.variants[variant].exitHysteresis
    for (const key of METRIC_KEYS) {
      const metric = exit.budget.metrics[key]
      rows.push(`| ${variant} | ${key} | ${metric.value.toLocaleString('en-US')} | ${metric.budget.toLocaleString('en-US')} | ${(metric.utilization * 100).toFixed(1)}% | ${metric.passed ? 'pass' : 'FAIL'} |`)
    }
  }
  return `# Unowned static spatial residency planning gate\n\n` +
    `Status: **${result.spatialPlanningGatePassed ? 'spatial planning pass; activation blocked' : 'spatial planning failed; activation blocked'}**.\n\n` +
    `This is an exact closed-AABB overlap analysis of all ${result.packageCount} \`__unowned__\` static packages using **${result.metricEvidenceMode}** metrics. It evaluates both the 1.5 m entry margin and the conservative 3.5 m exit/hysteresis margin used by the manifest-v3 runtime. Touching bounds count as simultaneous residency.\n\n` +
    `| Variant | Metric | Worst exit-window value | Full-layer ceiling | Use | Result |\n` +
    `|---|---|---:|---:|---:|---|\n${rows.join('\n')}\n\n` +
    `The values above are not permission to activate streaming. They consume the full-layer ceilings without reserving space for the structural shell, five animated owners, Ground repeat geometry, migrated fire-safety payload, animation rig, or load-before-retire transitions. ${result.metricEvidenceMode.startsWith('physical-emitted-payloads') ? 'The payload values are physical and independently audited. GPU texture residency counts exact content/compatibility keys once because every image carries verified metadata consumed by the fail-closed shared-texture registry; embedded GLB/network bytes remain additive. The complete-layer reservation is still missing.' : 'Encoded GLB bytes and decoded GPU texture residency are planning proxies until a complete independently audited payload index is supplied.'}\n\n` +
    `Inputs and outputs:\n\n` +
    `- Plan: \`${relative(VIEWER_ROOT, planPath).replaceAll('\\', '/')}\`\n` +
    `- Evidence: \`${relative(VIEWER_ROOT, resolve(outPath, 'unowned-static-resident-window-plan-v1.json')).replaceAll('\\', '/')}\`\n` +
    `- Exact analyzer regression: \`npm run test:spatial-resident-window\`\n`
}

const args = parseArgs(process.argv.slice(2))
const raw = await readFile(args.plan, 'utf8')
const plan = JSON.parse(raw)
assert(
  plan.schema === 'IOM_UNOWNED_STATIC_PARTITION_PLAN' && (plan.version === 1 || plan.version === 2),
  'unexpected unowned partition plan schema/version',
)
assert(plan.enabled === false, 'unowned partition plan must remain disabled')
assert(Array.isArray(plan.staticPackages) && plan.staticPackages.length > 0, 'unowned partition plan has no packages')
const plannedPackages = physicalPlanPackages(plan)

let payloadIndex = null
let payloadEvidence = null
if (args.payloadIndex || args.payloadAudit) {
  assert(args.payloadIndex && args.payloadAudit, '--payload-index and --payload-audit must be supplied together')
  assert(args.sharedTextureBrowserQa,
    '--shared-texture-browser-qa is required when physical payload evidence enables GPU texture pooling')
  const [indexRaw, auditRaw, sharedTextureQaRaw] = await Promise.all([
    readFile(args.payloadIndex),
    readFile(args.payloadAudit),
    readFile(args.sharedTextureBrowserQa),
  ])
  payloadIndex = JSON.parse(indexRaw)
  const audit = JSON.parse(auditRaw)
  const sharedTextureQa = JSON.parse(sharedTextureQaRaw)
  assert(payloadIndex.schema === 'IOM_UNOWNED_STATIC_PAYLOAD_CANDIDATE' && payloadIndex.version === 1,
    'unexpected payload index schema/version')
  assert(payloadIndex.enabled === false && payloadIndex.activationApproved === false,
    'payload candidate must remain disabled')
  assert(payloadIndex.completePlannedPackageSet === true,
    'resident-window release evidence requires the complete planned package set')
  assert(payloadIndex.packageCount === plannedPackages.length,
    'payload candidate package count differs from plan')
  assert(payloadIndex.plan.sha256 === sha256(raw) && payloadIndex.plan.planDigestSha256 === plan.planDigestSha256,
    'payload candidate plan pin is stale')
  assert(audit.status === 'PASS' && audit.failureCount === 0 && audit.activationApproved === false,
    'payload candidate independent audit must pass and remain disabled')
  assert(audit.index.sha256 === sha256(indexRaw), 'payload audit index pin is stale')
  assert(audit.plan.sha256 === sha256(raw) && audit.plan.planDigestSha256 === plan.planDigestSha256,
    'payload audit plan pin is stale')
  assert(payloadIndex.sharedTextureResidency?.metadataVersion === 1 &&
    payloadIndex.sharedTextureResidency?.identity === 'exact-embedded-image-sha256' &&
    payloadIndex.sharedTextureResidency?.runtimeRegistryRequired === 'SharedTextureResidencyRegistry',
  'payload candidate shared-texture registry contract is missing')
  assert(sharedTextureQa.schema === 'IOM_UNOWNED_STATIC_SHARED_TEXTURE_BROWSER_QA' &&
    sharedTextureQa.version === 1 && sharedTextureQa.passed === true &&
    sharedTextureQa.enabled === false && sharedTextureQa.activationApproved === false &&
    sharedTextureQa.productionReferenced === false,
  'shared-texture browser QA is missing, failed, or not fail-closed')
  assert(sharedTextureQa.candidateIndex?.bytes === indexRaw.length &&
    sharedTextureQa.candidateIndex?.sha256 === sha256(indexRaw),
  'shared-texture browser QA candidate-index pin is stale')
  assert(sharedTextureQa.candidateAudit?.bytes === auditRaw.length &&
    sharedTextureQa.candidateAudit?.sha256 === sha256(auditRaw),
  'shared-texture browser QA candidate-audit pin is stale')
  assert(sharedTextureQa.result?.acquisitions?.[1]?.sharedTextures > 0 &&
    sharedTextureQa.result?.afterRelease?.entries === 0 &&
    sharedTextureQa.result?.afterRelease?.roots === 0 &&
    sharedTextureQa.result?.afterRelease?.references === 0,
  'shared-texture browser QA did not prove reuse and complete release')
  payloadEvidence = {
    index: { path: relative(args.out, args.payloadIndex).replaceAll('\\', '/'), bytes: indexRaw.length, sha256: sha256(indexRaw) },
    audit: { path: relative(args.out, args.payloadAudit).replaceAll('\\', '/'), bytes: auditRaw.length, sha256: sha256(auditRaw) },
    sharedTextureBrowserQa: {
      path: relative(args.out, args.sharedTextureBrowserQa).replaceAll('\\', '/'),
      bytes: sharedTextureQaRaw.length,
      sha256: sha256(sharedTextureQaRaw),
      selectedPayloadCount: sharedTextureQa.selected?.length ?? 0,
      reusedTextureCount: sharedTextureQa.result.acquisitions[1].sharedTextures,
      completeReleaseProven: true,
    },
  }
}

const result = {
  schema: 'IOM_UNOWNED_STATIC_RESIDENT_WINDOW_PLAN',
  version: 1,
  enabled: false,
  activationApproved: false,
  modelId: plan.modelId,
  owner: '__unowned__',
  sourcePlan: {
    path: relative(args.out, args.plan).replaceAll('\\', '/'),
    bytes: Buffer.byteLength(raw),
    sha256: sha256(raw),
    schema: plan.schema,
    version: plan.version,
    planDigestSha256: plan.planDigestSha256,
  },
  packageCount: plannedPackages.length,
  metricEvidenceMode: payloadIndex
    ? 'physical-emitted-payloads-shared-texture-registry'
    : 'planning-proxies',
  metricSources: payloadIndex
    ? {
        triangles: 'physical payload expanded triangles',
        draws: 'physical payload primitive draws',
        bytes: 'physical emitted GLB bytes',
        encodedTextureBytes: 'physical embedded encoded image bytes',
        gpuTextureBytes: 'exact compatible shared-texture resource union using conservative decoded RGBA8 mip bytes',
      }
    : {
        triangles: 'planned expanded triangles',
        draws: 'planned parity-safe draw groups',
        bytes: 'decodedDependencyBytes proxy; not encoded GLB bytes',
        encodedTextureBytes: 'planned embedded source image bytes',
        gpuTextureBytes: 'decodedDependencyBytes proxy; not physical GPU residency',
      },
  payloadEvidence,
  policy: POLICY,
  variants: {},
  unresolvedActivationGates: [
    ...(payloadIndex ? [] : ['Replace planning estimates with physical emitted-GLB bytes, exact encoded texture bytes, and decoded GPU residency evidence.']),
    'Reserve the same full-layer budget for the structural shell, all animated-owner packages, Ground repeat geometry, migrated fire-safety geometry, and the persistent rig.',
    'Prove complete-manifest steady-state and load-before-retire transition peaks along focus churn, cancellation, overview, and recovery paths.',
    ...(payloadIndex ? [
      'Validate shared-texture acquisition, reference counts, duplicate disposal, and GPU residency on physical desktop and Quest-class hardware.',
      'Externalize or atlas exact KTX2 content if duplicate package-local network bytes must also be removed; registry pooling only removes duplicate live GPU Texture objects.',
    ] : []),
  ],
}

let spatialPlanningGatePassed = true
for (const variant of VARIANTS) {
  const items = toItems(plan, variant, payloadIndex)
  const additiveEntry = analyzeSpatialResidentWindow({
    items,
    metricKeys: METRIC_KEYS,
    margin: POLICY.selectionMarginMeters,
  })
  const additiveExit = analyzeSpatialResidentWindow({
    items,
    metricKeys: METRIC_KEYS,
    margin: POLICY.exitMarginMeters,
  })
  const entry = payloadIndex ? applySharedGpuTexturePooling(additiveEntry,
    analyzeSpatialResidentResourceWindow({
      items,
      metricKeys: ['gpuTextureBytes'],
      margin: POLICY.selectionMarginMeters,
    })) : additiveEntry
  const exit = payloadIndex ? applySharedGpuTexturePooling(additiveExit,
    analyzeSpatialResidentResourceWindow({
      items,
      metricKeys: ['gpuTextureBytes'],
      margin: POLICY.exitMarginMeters,
    })) : additiveExit
  const entryBudget = evaluateSpatialBudget(entry, POLICY.budgets[variant])
  const exitBudget = evaluateSpatialBudget(exit, POLICY.budgets[variant])
  spatialPlanningGatePassed &&= entryBudget.passed && exitBudget.passed
  result.variants[variant] = {
    entry: {
      marginMeters: entry.margin,
      worstByMetric: compactWorst(entry),
      budget: entryBudget,
      headroom: headroom(entryBudget),
      stats: entry.stats,
      ...(entry.sharedTexturePooling ? { sharedTexturePooling: entry.sharedTexturePooling } : {}),
    },
    exitHysteresis: {
      marginMeters: exit.margin,
      worstByMetric: compactWorst(exit),
      budget: exitBudget,
      headroom: headroom(exitBudget),
      stats: exit.stats,
      ...(exit.sharedTexturePooling ? { sharedTexturePooling: exit.sharedTexturePooling } : {}),
    },
  }
}
result.spatialPlanningGatePassed = spatialPlanningGatePassed
result.releaseGatePassed = false
result.evidenceDigestSha256 = sha256(stableJson(result))

await mkdir(args.out, { recursive: true })
const jsonPath = resolve(args.out, 'unowned-static-resident-window-plan-v1.json')
const reportPath = resolve(args.out, 'README.md')
await writeFile(jsonPath, stableJson(result))
await writeFile(reportPath, reportMarkdown(result, args.plan, args.out))

console.log(`Unowned static spatial residency planning gate: ${spatialPlanningGatePassed ? 'PASS (activation still blocked)' : 'FAIL'}`)
for (const variant of VARIANTS) {
  const record = result.variants[variant].exitHysteresis
  console.log(`  ${variant}: triangles=${record.budget.metrics.triangles.value}; draws=${record.budget.metrics.draws.value}`)
}
console.log(`  evidence=${relative(VIEWER_ROOT, jsonPath).replaceAll('\\', '/')}`)
