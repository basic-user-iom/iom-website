/**
 * Assemble evidence for the complete disabled Phase A candidate.
 *
 * This command reads only existing disabled candidates and writes only below
 * building-viewer/tmp. It never emits a runtime manifest and never touches the
 * production model route.
 */
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  evaluatePhaseACompleteCandidate,
  phaseAStableEvidenceDigest,
} from './lib/phase-a-complete-candidate-gate.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', 'phase-a-complete-disabled-candidate-v1')
const DEFAULT_UNOWNED_PLAN = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v1', 'unowned-static-partition-plan-v1.json')
const DEFAULT_STATIC_INDEX = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-payload-candidate-v1', 'payload-index.json')
const DEFAULT_STATIC_AUDIT = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-payload-candidate-v1', 'payload-audit.json')
const DEFAULT_STRUCTURAL_ROOT = resolve(VIEWER_ROOT, 'tmp', 'hlod-pilot-unowned-structural-shell-candidate')
const DEFAULT_RESIDENT = resolve(VIEWER_ROOT, 'tmp', 'unowned-static-resident-window-plan-v1', 'unowned-static-resident-window-plan-v1.json')
const FINAL_FLAGS = Object.freeze([
  'structuralCandidate',
  'structuralRepartition',
  'structuralProjectionAudit',
  'shellAwarePlan',
  'staticPayloadIndex',
  'staticPayloadAudit',
  'physicalResidentWindow',
  'repeatSpatialIndex',
  'repeatSpatialAudit',
])
const OWNER_DIRECTORIES = [
  'hlod-pilot-first-floor-shell-candidate',
  'hlod-pilot-second-floor-shell-candidate',
  'hlod-pilot-mezzanine-shell-candidate',
  'hlod-pilot-ceiling-shell-candidate',
  'hlod-pilot-ground-floor-shell-candidate',
]

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function jsonFile(path) {
  const bytes = await readFile(path)
  return { path, bytes, value: JSON.parse(bytes.toString('utf8')) }
}

function inside(path, root) {
  const child = relative(resolve(root), resolve(path))
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child))
}

function viewerPath(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} requires a non-empty path`)
  const path = resolve(VIEWER_ROOT, value)
  if (!inside(path, VIEWER_ROOT)) throw new Error(`${label} must stay below ${VIEWER_ROOT}`)
  return path
}

export function parsePhaseAArgs(argv) {
  const args = {
    out: DEFAULT_OUT,
    finalMode: false,
    structuralCandidate: null,
    structuralRepartition: null,
    structuralProjectionAudit: null,
    shellAwarePlan: null,
    staticPayloadIndex: null,
    staticPayloadAudit: null,
    physicalResidentWindow: null,
    repeatSpatialIndex: null,
    repeatSpatialAudit: null,
  }
  const flagNames = {
    '--out': 'out',
    '--structural-candidate': 'structuralCandidate',
    '--structural-repartition': 'structuralRepartition',
    '--structural-projection-audit': 'structuralProjectionAudit',
    '--shell-aware-plan': 'shellAwarePlan',
    '--static-payload-index': 'staticPayloadIndex',
    '--static-payload-audit': 'staticPayloadAudit',
    '--physical-resident-window': 'physicalResidentWindow',
    '--repeat-spatial-index': 'repeatSpatialIndex',
    '--repeat-spatial-audit': 'repeatSpatialAudit',
  }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const key = flagNames[flag]
    if (!key) throw new Error(`Unknown argument: ${flag}`)
    if (index + 1 >= argv.length) throw new Error(`${flag} requires a path`)
    args[key] = viewerPath(argv[++index], flag)
  }
  const supplied = FINAL_FLAGS.filter((key) => args[key])
  if (supplied.length) {
    const missing = FINAL_FLAGS.filter((key) => !args[key])
    if (missing.length) throw new Error(`Fail closed: final evidence mode requires all explicit inputs; missing ${missing.join(', ')}`)
    args.finalMode = true
  }
  if (!inside(args.out, resolve(VIEWER_ROOT, 'tmp'))) throw new Error('--out must stay below building-viewer/tmp')
  return args
}

async function addPayload(map, root, record) {
  const url = record?.url ?? record?.path
  if (typeof url !== 'string' || !url.toLowerCase().endsWith('.glb') || map[url]) return
  const path = resolve(root, url)
  if (!inside(path, root)) throw new Error(`Payload reference escapes candidate root: ${url}`)
  map[url] = await readFile(path)
}

async function addViewerRootPinnedPayload(map, candidateRoot, record) {
  const url = record?.url ?? record?.path
  if (typeof url !== 'string' || !url.toLowerCase().endsWith('.glb') || map[url]) return
  const projectRelative = url.replaceAll('\\', '/').startsWith('tmp/')
  const path = projectRelative ? resolve(VIEWER_ROOT, url) : resolve(candidateRoot, url)
  if (!inside(path, candidateRoot)) throw new Error(`Structural payload reference escapes candidate root: ${url}`)
  map[url] = await readFile(path)
}

async function ownerCandidate(directory) {
  const root = resolve(VIEWER_ROOT, 'tmp', directory)
  const indexFile = await jsonFile(resolve(root, 'detail-package-index.json'))
  const auditFile = await jsonFile(resolve(root, 'shell-package-audit.json'))
  const index = indexFile.value
  const payloadBytes = {}
  await addPayload(payloadBytes, root, index.rig)
  for (const pkg of index.packages || []) {
    for (const variant of ['web', 'quest']) await addPayload(payloadBytes, root, pkg.variants?.[variant]?.lod0)
  }
  const shell = index.shellCompletion?.requiredAlwaysResidentShell ?? index.alwaysResidentShell
  if (shell) for (const variant of ['web', 'quest']) await addPayload(payloadBytes, root, shell.variants?.[variant])
  return {
    indexPath: relative(VIEWER_ROOT, indexFile.path).replaceAll('\\', '/'),
    indexBytes: indexFile.bytes,
    index,
    auditPath: relative(VIEWER_ROOT, auditFile.path).replaceAll('\\', '/'),
    auditBytes: auditFile.bytes,
    audit: auditFile.value,
    payloadBytes,
  }
}

async function repeatCandidate() {
  const root = resolve(VIEWER_ROOT, 'tmp', 'repeat-geometry-release-candidate')
  const manifest = await jsonFile(resolve(root, 'manifest.disabled.json'))
  const report = await jsonFile(resolve(root, 'report.json'))
  const browserQa = await jsonFile(resolve(root, 'browser-runtime-qa.json'))
  const payloadBytes = {}
  for (const variant of Object.values(manifest.value.variants || {})) {
    for (const payload of Object.values(variant || {})) await addPayload(payloadBytes, root, payload)
  }
  return {
    manifest: manifest.value,
    manifestBytes: manifest.bytes,
    report: report.value,
    reportBytes: report.bytes,
    browserQa: browserQa.value,
    browserQaBytes: browserQa.bytes,
    payloadBytes,
  }
}

async function unownedPayloadCandidate(indexPath = DEFAULT_STATIC_INDEX, auditPath = DEFAULT_STATIC_AUDIT) {
  const root = dirname(indexPath)
  if (!await exists(indexPath) || !await exists(auditPath)) return null
  const index = await jsonFile(indexPath)
  const audit = await jsonFile(auditPath)
  const payloadBytes = {}
  for (const pkg of index.value.packages || []) {
    for (const variant of ['web', 'quest']) await addPayload(payloadBytes, root, pkg.variants?.[variant]?.asset)
  }
  return {
    indexPath: relative(VIEWER_ROOT, index.path).replaceAll('\\', '/'),
    index: index.value,
    indexBytes: index.bytes,
    audit: audit.value,
    auditBytes: audit.bytes,
    auditPath: relative(VIEWER_ROOT, audit.path).replaceAll('\\', '/'),
    payloadBytes,
  }
}

async function structuralShellReview({
  candidatePath = resolve(DEFAULT_STRUCTURAL_ROOT, 'candidate-index.json'),
  repartitionPath = resolve(DEFAULT_STRUCTURAL_ROOT, 'ownership-repartition.json'),
  projectionPath = resolve(DEFAULT_STRUCTURAL_ROOT, 'visual-qa', 'projection-audit.json'),
  finalMode = false,
} = {}) {
  const root = dirname(candidatePath)
  const indexPath = candidatePath
  const auditCandidates = finalMode
    ? [resolve(root, 'ownership-audit-v2.json'), resolve(root, 'ownership-audit.json')]
    : [resolve(root, 'ownership-audit.json')]
  const auditPath = (await Promise.all(auditCandidates.map(async (path) => [path, await exists(path)])))
    .find(([, present]) => present)?.[0]
  if (!await exists(indexPath) || !auditPath) return null
  const index = await jsonFile(indexPath)
  const audit = await jsonFile(auditPath)
  const dependencyAuditCandidates = finalMode
    ? [resolve(root, 'dependency-audit-v2.json'), resolve(root, 'dependency-audit.json')]
    : [resolve(root, 'dependency-audit.json')]
  const topologyAuditCandidates = finalMode
    ? [resolve(root, 'topology-audit-v2.json'), resolve(root, 'topology-audit.json')]
    : []
  const dependencyAuditPath = (await Promise.all(dependencyAuditCandidates.map(async (path) => [path, await exists(path)])))
    .find(([, present]) => present)?.[0]
  const topologyAuditPath = (await Promise.all(topologyAuditCandidates.map(async (path) => [path, await exists(path)])))
    .find(([, present]) => present)?.[0]
  const repartition = await exists(repartitionPath) ? await jsonFile(repartitionPath) : null
  const dependencyAudit = dependencyAuditPath ? await jsonFile(dependencyAuditPath) : null
  const topologyAudit = topologyAuditPath ? await jsonFile(topologyAuditPath) : null
  const projection = await exists(projectionPath) ? await jsonFile(projectionPath) : null
  const payloadBytes = {}
  if (finalMode) for (const variant of ['web', 'quest']) {
    await addViewerRootPinnedPayload(payloadBytes, root, index.value.variants?.[variant]?.asset)
  }
  const digest = (bytes) => bytes?.length ? createHash('sha256').update(bytes).digest('hex') : null
  const v2 = index.value.schema === 'IOM_UNOWNED_STRUCTURAL_PROXY_CANDIDATE'
  return {
    finalMode,
    schema: index.value.schema,
    version: index.value.version,
    accepted: audit.value.passed === true && Array.isArray(audit.value.errors) && audit.value.errors.length === 0,
    activationApproved: index.value.activationApproved === true && audit.value.activationApproved === true &&
      projection?.value?.activationApproved === true,
    indexSha256: digest(index.bytes),
    auditSha256: digest(audit.bytes),
    projectionAuditPresent: Boolean(projection),
    projectionAuditSha256: projection ? digest(projection.bytes) : null,
    ownershipRepartitionSha256: repartition ? digest(repartition.bytes) : null,
    dependencyAuditSha256: dependencyAudit ? digest(dependencyAudit.bytes) : null,
    topologyAuditSha256: topologyAudit ? digest(topologyAudit.bytes) : null,
    originalPayloadCandidateCompatible: repartition?.value?.compositionGuard?.original122PayloadCandidateCompatible ?? null,
    requiredRepartitionAction: repartition?.value?.compositionGuard?.requiredAction ?? null,
    blockers: index.value.blockers || [],
    payloadBytes,
    materialFidelity: v2 ? {
      materialFidelityReady: index.value.safety?.materialFidelity?.materialFidelityReady,
      proxyTextureCount: index.value.safety?.materialFidelity?.proxyTextureCount,
      proxyImageCount: index.value.safety?.materialFidelity?.proxyImageCount,
      nearLod0Required: index.value.safety?.materialFidelity?.nearLod0Required,
      nearLod0PackagePresent: index.value.safety?.materialFidelity?.nearLod0PackagePresent,
      releaseBlocked: index.value.safety?.materialFidelity?.releaseBlocked,
      explicitReplacementSemanticsValidated:
        repartition?.value?.compositionGuard?.materialFidelity?.explicitReplacementSemanticsValidated,
    } : null,
    raw: {
      candidate: index.value,
      candidateBytes: index.bytes,
      ownershipAudit: audit.value,
      ownershipAuditBytes: audit.bytes,
      repartition: repartition?.value ?? null,
      repartitionBytes: repartition?.bytes ?? null,
      dependencyAudit: dependencyAudit?.value ?? null,
      dependencyAuditBytes: dependencyAudit?.bytes ?? null,
      topologyAudit: topologyAudit?.value ?? null,
      topologyAuditBytes: topologyAudit?.bytes ?? null,
      projectionAudit: projection?.value ?? null,
      projectionAuditBytes: projection?.bytes ?? null,
    },
    variants: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
      sourcePaths: repartition?.value?.variants?.[variant]?.proxy?.sourcePaths ??
        index.value.variants?.[variant]?.selection?.sourcePaths ?? [],
      sourcePathsSha256: repartition?.value?.variants?.[variant]?.proxy?.sourcePathsSha256 ??
        index.value.variants?.[variant]?.selection?.sourcePathsSha256 ?? null,
      sourceUnitIds: repartition?.value?.variants?.[variant]?.proxy?.sourceUnitIds ??
        repartition?.value?.variants?.[variant]?.shell?.sourceUnitIds ??
        index.value.variants?.[variant]?.selection?.sourceUnitIds ?? [],
      sourceUnitIdsSha256: repartition?.value?.variants?.[variant]?.proxy?.sourceUnitIdsSha256 ??
        repartition?.value?.variants?.[variant]?.shell?.sourceUnitIdsSha256 ??
        index.value.variants?.[variant]?.selection?.unitIdsSha256 ?? null,
      sourceUnitCount: repartition?.value?.variants?.[variant]?.proxy?.sourceUnitCount ??
        repartition?.value?.variants?.[variant]?.shell?.atomicUnitCount ?? null,
      requiredDetailComplementAtomicUnits: repartition?.value?.variants?.[variant]?.detailComplement?.atomicUnitCount ?? null,
      requiredPayloadInputUnitIdsSha256: repartition?.value?.variants?.[variant]?.detailComplement?.requiredPayloadInputUnitIdsSha256 ?? null,
    }])),
  }
}

async function residentWindowReview(path = DEFAULT_RESIDENT, { finalMode = false } = {}) {
  if (!await exists(path)) return null
  const evidence = await jsonFile(path)
  let sharedTextureBrowserQa = null
  const qaPin = evidence.value.payloadEvidence?.sharedTextureBrowserQa
  if (typeof qaPin?.path === 'string') {
    const qaPath = resolve(dirname(path), qaPin.path)
    if (inside(qaPath, VIEWER_ROOT) && await exists(qaPath)) {
      const file = await jsonFile(qaPath)
      sharedTextureBrowserQa = {
        value: file.value,
        bytes: file.bytes,
        sha256: createHash('sha256').update(file.bytes).digest('hex'),
      }
    }
  }
  return {
    finalMode,
    schema: evidence.value.schema,
    version: evidence.value.version,
    accepted: evidence.value.releaseGatePassed === true,
    spatialPlanningGatePassed: evidence.value.spatialPlanningGatePassed === true,
    releaseGatePassed: evidence.value.releaseGatePassed === true,
    activationApproved: evidence.value.activationApproved === true,
    evidenceDigestSha256: evidence.value.evidenceDigestSha256 ?? null,
    variants: evidence.value.variants ?? null,
    blockers: evidence.value.unresolvedActivationGates || [],
    raw: evidence.value,
    sharedTextureBrowserQa,
    bytes: evidence.bytes,
    sha256: createHash('sha256').update(evidence.bytes).digest('hex'),
  }
}

async function shellAwarePlanEvidence(path) {
  if (!path || !await exists(path)) return null
  const file = await jsonFile(path)
  return {
    path: relative(VIEWER_ROOT, path).replaceAll('\\', '/'),
    value: file.value,
    bytes: file.bytes,
    sha256: createHash('sha256').update(file.bytes).digest('hex'),
  }
}

async function repeatSpatialCandidate(indexPath, auditPath) {
  if (!indexPath || !auditPath || !await exists(indexPath) || !await exists(auditPath)) return null
  const root = dirname(indexPath)
  const index = await jsonFile(indexPath)
  const audit = await jsonFile(auditPath)
  const payloadBytes = {}
  for (const pkg of index.value.packages || []) for (const variant of ['web', 'quest']) {
    const levels = pkg.variants?.[variant]?.levels ?? pkg.variants?.[variant] ?? {}
    for (const level of Object.values(levels)) await addPayload(payloadBytes, root, level?.asset ?? level)
  }
  return {
    index: index.value,
    indexBytes: index.bytes,
    indexPath: relative(VIEWER_ROOT, indexPath).replaceAll('\\', '/'),
    audit: audit.value,
    auditBytes: audit.bytes,
    auditPath: relative(VIEWER_ROOT, auditPath).replaceAll('\\', '/'),
    payloadBytes,
  }
}

export async function loadPhaseAInputs(options = {}) {
  const finalMode = options.finalMode === true
  const contract = await jsonFile(resolve(VIEWER_ROOT, 'tmp', 'whole-layer-ownership-v1', 'whole-layer-ownership-contract-v1.json'))
  const migration = await jsonFile(resolve(VIEWER_ROOT, 'tmp', 'fire-hose-ownership-candidate', 'source-ownership-migration-v1.json'))
  const unownedPlan = await jsonFile(DEFAULT_UNOWNED_PLAN)
  const ownerCandidates = []
  for (const directory of OWNER_DIRECTORIES) ownerCandidates.push(await ownerCandidate(directory))
  const structural = finalMode ? await structuralShellReview({
    candidatePath: options.structuralCandidate,
    repartitionPath: options.structuralRepartition,
    projectionPath: options.structuralProjectionAudit,
    finalMode: true,
  }) : await structuralShellReview()
  const shellPlan = finalMode ? await shellAwarePlanEvidence(options.shellAwarePlan) : null
  return {
    finalMode,
    contract: contract.value,
    contractBytes: contract.bytes,
    ownerCandidates,
    migration: migration.value,
    migrationBytes: migration.bytes,
    unownedPlan: unownedPlan.value,
    unownedPlanBytes: unownedPlan.bytes,
    repeatCandidate: await repeatCandidate(),
    repeatSpatialCandidate: finalMode
      ? await repeatSpatialCandidate(options.repeatSpatialIndex, options.repeatSpatialAudit)
      : null,
    shellAwarePlanEvidence: shellPlan,
    unownedPayloadCandidate: finalMode
      ? await unownedPayloadCandidate(options.staticPayloadIndex, options.staticPayloadAudit)
      : await unownedPayloadCandidate(),
    commonRigBytes: ownerCandidates[0].payloadBytes[ownerCandidates[0].index.rig.url],
    groundRigBytes: ownerCandidates[4].payloadBytes[ownerCandidates[4].index.rig.url],
    structuralShellReview: structural,
    residentWindowReview: finalMode
      ? await residentWindowReview(options.physicalResidentWindow, { finalMode: true })
      : await residentWindowReview(),
  }
}

function reportMarkdown(candidate, review, stableEvidenceDigestSha256) {
  const rows = ['web', 'quest'].map((variant) => {
    const value = review.coverage[variant]
    return `| ${variant} | ${value.physicallyClaimedUniqueAtomicUnits.toLocaleString()} / ${value.expectedAtomicUnits.toLocaleString()} | ${value.missingCount} | ${value.duplicateCount} | ${value.physicalPayloads.toLocaleString()} | ${value.verifiedPayloadBytes.toLocaleString()} | ${value.partitions.fiveOwnerPayloadAtomicUnits.toLocaleString()} + ${value.partitions.repeatPayloadAtomicUnits.toLocaleString()} + ${value.partitions.unownedStaticPayloadAtomicUnits.toLocaleString()} |`
  }).join('\n')
  const rig = candidate.combinedRig
  return `# Phase A complete disabled whole-layer candidate v1\n\n` +
    `Integration evidence: **${review.integrationEvidenceComplete ? 'COMPLETE' : 'INCOMPLETE / FAIL-CLOSED'}**. Activation: **BLOCKED**. Production routing changed: **NO**. Runtime manifest emitted: **NO**.\n\n` +
    `Candidate digest: \`${candidate.candidateDigestSha256}\`. Stable evidence digest: \`${stableEvidenceDigestSha256}\`. Whole-layer contract: \`${candidate.wholeLayerCoverageDigestSha256}\`.\n\n` +
    `| Variant | Exact physical coverage | Missing | Duplicate | Verified payloads | Verified bytes | Five owners + repeat + static |\n` +
    `|---|---:|---:|---:|---:|---:|---:|\n${rows}\n\n` +
    `## Combined persistent rig\n\n` +
    (rig ? `A deterministic disabled combined rig was built at \`${rig.url}\`: ${rig.bytes.toLocaleString()} bytes, SHA-256 \`${rig.sha256}\`, ${rig.ownerNodeNames.length} unique persistent anchors, ${rig.channelCount} unchanged animated-owner channels, and zero meshes/cameras/lights. Ground and \`__unowned__\` are identity anchors.\n\n` : 'No valid combined rig could be built.\n\n') +
    `## Activation blockers\n\n${review.activationBlockers.map((entry) => `- **${entry.code}** (${entry.source}): ${entry.description}`).join('\n')}\n\n` +
    `This evidence is intentionally not a runtime manifest. The production monolithic route remains the only live route.\n`
}

export async function auditPhaseACompleteCandidate(options = {}) {
  const out = options.out ?? DEFAULT_OUT
  const inputs = await loadPhaseAInputs(options)
  const result = evaluatePhaseACompleteCandidate(inputs)
  const stableEvidenceDigestSha256 = phaseAStableEvidenceDigest(result.candidate, result.review)
  await mkdir(out, { recursive: true })
  await writeFile(resolve(out, 'candidate.json'), `${JSON.stringify({
    ...result.candidate,
    stableEvidenceDigestSha256,
  }, null, 2)}\n`)
  await writeFile(resolve(out, 'review.json'), `${JSON.stringify({
    ...result.review,
    ownerPayloads: {
      ...result.review.ownerPayloads,
      claims: undefined,
    },
    repeatPayloads: {
      ...result.review.repeatPayloads,
      claims: undefined,
    },
    unownedPayloads: {
      ...result.review.unownedPayloads,
      claims: undefined,
    },
  }, null, 2)}\n`)
  if (result.combinedRigBytes) await writeFile(resolve(out, 'combined-persistent-rig.glb'), result.combinedRigBytes)
  await writeFile(resolve(out, 'REPORT.md'), reportMarkdown(result.candidate, result.review, stableEvidenceDigestSha256))
  return { ...result, out, stableEvidenceDigestSha256 }
}

async function main() {
  const args = parsePhaseAArgs(process.argv.slice(2))
  const result = await auditPhaseACompleteCandidate(args)
  console.log(`Phase A complete disabled candidate: ${result.review.integrationEvidenceComplete ? 'PAYLOAD INTEGRATION COMPLETE; ACTIVATION BLOCKED' : 'INCOMPLETE; FAIL-CLOSED'}`)
  console.log(`  output: ${result.out}`)
  for (const variant of ['web', 'quest']) {
    const value = result.review.coverage[variant]
    console.log(`  ${variant}: ${value.physicallyClaimedUniqueAtomicUnits.toLocaleString()} / ${value.expectedAtomicUnits.toLocaleString()} exact physical units; ${value.physicalPayloads} verified payloads`)
  }
  console.log(`  combined rig: ${result.review.combinedRigComplete ? 'PASS' : 'BLOCKED'}`)
  console.log(`  activation blockers: ${result.review.activationBlockers.length}`)
  if (!result.review.integrationEvidenceComplete) process.exitCode = 1
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main()
