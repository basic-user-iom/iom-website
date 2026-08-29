/**
 * Plan-level composition only. This command never emits a runtime manifest,
 * package payload, or production route.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  validateWholeLayerOwnershipContract,
  verifyWholeLayerOwnershipSources,
} from './lib/whole-layer-ownership-contract.mjs'
import { composeWholeLayerOwnershipPlan } from './lib/whole-layer-plan-composer.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const REPOSITORY_ROOT = resolve(VIEWER_ROOT, '..')
const MODEL_ROOT = resolve(REPOSITORY_ROOT, 'public', 'models', 'icm-anim-2025')

function parseArgs(argv) {
  const args = {
    contract: resolve(VIEWER_ROOT, 'tmp', 'whole-layer-ownership-v1', 'whole-layer-ownership-contract-v1.json'),
    outDir: resolve(VIEWER_ROOT, 'tmp', 'whole-layer-logical-ownership-plan-v1'),
    ownerCandidates: [],
    groundCandidate: null,
    migration: resolve(VIEWER_ROOT, 'tmp', 'fire-hose-ownership-candidate', 'source-ownership-migration-v1.json'),
    unownedPlan: resolve(VIEWER_ROOT, 'tmp', 'unowned-static-partition-plan-v1', 'unowned-static-partition-plan-v1.json'),
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--contract') args.contract = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--out') args.outDir = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--candidate') args.ownerCandidates.push(resolve(VIEWER_ROOT, argv[++index]))
    else if (value === '--ground-candidate') args.groundCandidate = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--migration') args.migration = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--unowned-plan') args.unownedPlan = resolve(VIEWER_ROOT, argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  if (args.ownerCandidates.length !== 4) throw new Error('Fail closed: exactly four non-Ground --candidate indices are required')
  if (!args.groundCandidate) throw new Error('Fail closed: --ground-candidate is required')
  return args
}

async function jsonFile(path) {
  const bytes = await readFile(path)
  return { bytes, value: JSON.parse(bytes.toString('utf8')) }
}

async function auditedCandidate(indexPath) {
  const index = await jsonFile(indexPath)
  const auditPath = resolve(dirname(indexPath), 'shell-package-audit.json')
  const audit = await jsonFile(auditPath)
  return {
    indexPath: relative(VIEWER_ROOT, indexPath).replaceAll('\\', '/'),
    indexBytes: index.bytes,
    index: index.value,
    auditPath: relative(VIEWER_ROOT, auditPath).replaceAll('\\', '/'),
    auditBytes: audit.bytes,
    audit: audit.value,
  }
}

function logicalOwnerTable(review) {
  const web = review.coverage.web.logicalOwners
  const quest = review.coverage.quest.logicalOwners
  return [...new Set([...Object.keys(web), ...Object.keys(quest)])].sort().map((owner) =>
    `| ${owner} | ${(web[owner] || 0).toLocaleString()} | ${(quest[owner] || 0).toLocaleString()} |`,
  ).join('\n')
}

const args = parseArgs(process.argv.slice(2))
const contractFile = await jsonFile(args.contract)
const contract = contractFile.value
const contractValidation = validateWholeLayerOwnershipContract(contract)
const sourceValidation = await verifyWholeLayerOwnershipSources(contract, {
  web: resolve(MODEL_ROOT, 'model-web.glb'),
  quest: resolve(MODEL_ROOT, 'model-quest.glb'),
})
if (!contractValidation.valid || !sourceValidation.valid) {
  throw new Error(`Fail closed: whole-layer contract is stale:\n${[
    ...contractValidation.errors,
    ...sourceValidation.errors,
  ].join('\n')}`)
}

const ownerCandidates = []
for (const path of args.ownerCandidates) ownerCandidates.push(await auditedCandidate(path))
const groundCandidate = await auditedCandidate(args.groundCandidate)
const migrationFile = await jsonFile(args.migration)
const unownedPlanFile = await jsonFile(args.unownedPlan)
const { plan, review } = composeWholeLayerOwnershipPlan({
  contract,
  contractBytes: contractFile.bytes,
  ownerCandidates,
  groundCandidate,
  migration: migrationFile.value,
  migrationBytes: migrationFile.bytes,
  unownedPlan: unownedPlanFile.value,
  unownedPlanBytes: unownedPlanFile.bytes,
})
review.inputPaths = {
  contract: relative(VIEWER_ROOT, args.contract).replaceAll('\\', '/'),
  migration: relative(VIEWER_ROOT, args.migration).replaceAll('\\', '/'),
  unownedPlan: relative(VIEWER_ROOT, args.unownedPlan).replaceAll('\\', '/'),
  ownerCandidates: ownerCandidates.map((candidate) => candidate.indexPath),
  correctedGroundCandidate: groundCandidate.indexPath,
}

await mkdir(args.outDir, { recursive: true })
await writeFile(resolve(args.outDir, 'whole-layer-logical-ownership-plan-v1.json'), `${JSON.stringify(plan, null, 2)}\n`)
await writeFile(resolve(args.outDir, 'plan-composition-review.json'), `${JSON.stringify(review, null, 2)}\n`)
await writeFile(resolve(args.outDir, 'REPORT.md'), `# Whole-layer logical ownership plan v1\n\n` +
  `Ownership-plan status: **${review.ownershipPlanComplete ? 'COMPLETE' : 'INVALID'}**. Activation status: **BLOCKED**. No runtime manifest or production route was emitted.\n\n` +
  `Contract: \`${plan.wholeLayerCoverageDigestSha256}\`. Plan: \`${plan.planDigestSha256}\`. Migration: \`${plan.migrationSidecarSha256}\`.\n\n` +
  `| Variant | Claimed / required | Missing | Duplicate | Migrated fire in Ground | Migrated fire left in unowned | Plan-only unowned |\n` +
  `|---|---:|---:|---:|---:|---:|---:|\n` +
  ['web', 'quest'].map((variantName) => {
    const value = review.coverage[variantName]
    return `| ${variantName} | ${value.claimedUniqueAtomicUnits.toLocaleString()} / ${value.expectedAtomicUnits.toLocaleString()} | ${value.missingCount} | ${value.duplicateCount} | ${value.migratedFire.claimedByGround} | ${value.migratedFire.claimedByUnowned} | ${value.unownedPlan.logicalUnownedAtomicUnits.toLocaleString()} |`
  }).join('\n') + `\n\n` +
  `| Logical owner | Web units | Quest units |\n|---|---:|---:|\n${logicalOwnerTable(review)}\n\n` +
  `The unchanged source contract still classifies the 60 fire units as \`__unowned__\`, and its base wrong-owner gate still rejects a direct Ground claim. This separate plan recognizes the exact migration sidecar as the sole authorization to assign those same source IDs logically to Ground.\n\n` +
  `The unowned plan contributes exactly 312 repeat units plus 2,843 remaining-static units and excludes all 60 migrated fire IDs. Ground contributes 230 original Ground units plus the 60 authorized fire units.\n\n` +
  `## Activation blockers\n\n${review.releaseBlockers.map((blocker) => `- ${blocker}`).join('\n')}\n`)

console.log(`Whole-layer logical ownership plan: ${review.ownershipPlanComplete ? 'COMPLETE' : 'INVALID'}; ACTIVATION BLOCKED`)
console.log(`  output: ${args.outDir}`)
console.log(`  base wrong-owner gate unchanged: ${review.baseWrongOwnerGate.rejected}`)
for (const variantName of ['web', 'quest']) {
  const coverage = review.coverage[variantName]
  console.log(`  ${variantName}: ${coverage.claimedUniqueAtomicUnits.toLocaleString()} / ${coverage.expectedAtomicUnits.toLocaleString()} exactly once; missing ${coverage.missingCount}; duplicate ${coverage.duplicateCount}`)
  console.log(`    Ground logical: ${coverage.logicalOwners['Ground Floor._anim1']}; unowned logical: ${coverage.logicalOwners.__unowned__}`)
  console.log(`    unowned plan: ${coverage.unownedPlan.repeatAtomicUnits} repeat + ${coverage.unownedPlan.remainingStaticAtomicUnits} static; fire excluded ${coverage.migratedFire.claimedByUnowned === 0}`)
}
if (!review.releaseReady) process.exitCode = 1
