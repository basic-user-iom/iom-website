/**
 * Composes audited, disabled owner-local package indices into whole-layer
 * ownership claims. It writes review evidence only and never emits a runtime
 * manifest or changes production routing.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  sha256,
  validateWholeLayerOwnershipContract,
  verifyWholeLayerOwnershipSources,
} from './lib/whole-layer-ownership-contract.mjs'
import { composeWholeLayerOwnerClaims } from './lib/whole-layer-owner-claims-composer.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const REPOSITORY_ROOT = resolve(VIEWER_ROOT, '..')
const MODEL_ROOT = resolve(REPOSITORY_ROOT, 'public', 'models', 'icm-anim-2025')

function parseArgs(argv) {
  const args = {
    contract: resolve(VIEWER_ROOT, 'tmp', 'whole-layer-ownership-v1', 'whole-layer-ownership-contract-v1.json'),
    outDir: resolve(VIEWER_ROOT, 'tmp', 'whole-layer-owner-claims-composition'),
    candidates: [],
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--contract') args.contract = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--out') args.outDir = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--candidate') args.candidates.push(resolve(VIEWER_ROOT, argv[++index]))
    else throw new Error(`Unknown argument: ${value}`)
  }
  if (!args.candidates.length) throw new Error('Fail closed: supply at least one --candidate package-index JSON file')
  return args
}

async function readJson(path) {
  const bytes = await readFile(path)
  return { bytes, value: JSON.parse(bytes.toString('utf8')) }
}

async function discoverAudit(indexPath) {
  const candidates = [
    resolve(dirname(indexPath), 'shell-package-audit.json'),
    resolve(dirname(indexPath), 'detail-package-audit.json'),
  ]
  for (const path of candidates) {
    try {
      const result = await readJson(path)
      return { path, ...result }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  throw new Error(`Fail closed: no shell-package-audit.json or detail-package-audit.json beside ${indexPath}`)
}

function projectPath(path) {
  return relative(VIEWER_ROOT, path).replaceAll('\\', '/')
}

function candidateTable(review) {
  return review.candidateReviews.map((candidate) =>
    `| ${candidate.owner} | ${candidate.accepted ? 'accepted for ownership evidence' : 'rejected'} | ${candidate.variants.web?.mappedAtomicUnits?.toLocaleString() ?? 0} | ${candidate.variants.quest?.mappedAtomicUnits?.toLocaleString() ?? 0} | ${candidate.audit.blockerCount} | \`${candidate.identity.indexSha256}\` |`,
  ).join('\n')
}

function missingTable(review) {
  const web = new Map(review.missingByOwner.web.map((entry) => [entry.owner, entry]))
  const quest = new Map(review.missingByOwner.quest.map((entry) => [entry.owner, entry]))
  return [...web].map(([owner, value]) =>
    `| ${owner} | ${value.claimedAtomicUnits.toLocaleString()} / ${value.expectedAtomicUnits.toLocaleString()} | ${value.missingAtomicUnits.toLocaleString()} | ${quest.get(owner).claimedAtomicUnits.toLocaleString()} / ${quest.get(owner).expectedAtomicUnits.toLocaleString()} | ${quest.get(owner).missingAtomicUnits.toLocaleString()} |`,
  ).join('\n')
}

const args = parseArgs(process.argv.slice(2))
const contractFile = await readJson(args.contract)
const contract = contractFile.value
const structure = validateWholeLayerOwnershipContract(contract)
const sourceVerification = await verifyWholeLayerOwnershipSources(contract, {
  web: resolve(MODEL_ROOT, 'model-web.glb'),
  quest: resolve(MODEL_ROOT, 'model-quest.glb'),
})
if (!structure.valid || !sourceVerification.valid) {
  throw new Error(`Fail closed: whole-layer contract is not exact:\n${[
    ...structure.errors,
    ...sourceVerification.errors,
  ].join('\n')}`)
}

const candidates = []
for (const indexPath of args.candidates) {
  const indexFile = await readJson(indexPath)
  const auditFile = await discoverAudit(indexPath)
  candidates.push({
    indexPath: projectPath(indexPath),
    indexBytes: indexFile.bytes,
    index: indexFile.value,
    auditPath: projectPath(auditFile.path),
    auditBytes: auditFile.bytes,
    audit: auditFile.value,
  })
}

const { claims, review } = composeWholeLayerOwnerClaims(contract, candidates)
review.contractPath = projectPath(args.contract)
review.contractFileSha256 = sha256(contractFile.bytes)
review.sourceVerification = sourceVerification
await mkdir(args.outDir, { recursive: true })
await writeFile(join(args.outDir, 'whole-layer-owner-claims-v1.json'), `${JSON.stringify(claims, null, 2)}\n`)
await writeFile(join(args.outDir, 'composition-review.json'), `${JSON.stringify(review, null, 2)}\n`)
await writeFile(join(args.outDir, 'REPORT.md'), `# Whole-layer owner claims composition\n\n` +
  `Status: **${review.status}**. Production assets, runtime manifests, and routing were not changed.\n\n` +
  `Coverage contract: \`${review.coverageContractSha256}\`\n\n` +
  `| Owner candidate | Ownership evidence | Web atomic units | Quest atomic units | Remaining audit blockers | Index SHA-256 |\n` +
  `|---|---|---:|---:|---:|---|\n${candidateTable(review)}\n\n` +
  `| Owner | Web claimed / expected | Web missing | Quest claimed / expected | Quest missing |\n` +
  `|---|---:|---:|---:|---:|\n${missingTable(review)}\n\n` +
  `Whole-layer coverage valid: ${review.wholeLayerCoverageValid}. Cross-candidate overlap free: ${review.noCrossCandidateOverlap}. Audit release blockers cleared: ${review.allAuditReleaseBlockersCleared}.\n\n` +
  `This composer maps each audited owner-relative source path to exactly one pinned source node, then expands that node's exact primitive-instance multiplicity into atomic unit IDs. Unknown paths, stale source or audit digests, duplicate candidates, and overlapping units fail closed.\n`)

console.log(`Whole-layer owner claims composition: ${review.releaseReady ? 'PASS' : 'BLOCKED'}`)
console.log(`  output: ${args.outDir}`)
console.log(`  candidates: ${review.candidateCount}; accepted ownership evidence: ${review.acceptedCandidates}`)
for (const variantName of ['web', 'quest']) {
  const coverage = review.coverage.variants[variantName]
  console.log(`  ${variantName}: ${coverage.claimedUniqueRenderUnits.toLocaleString()} / ${coverage.expectedRenderUnits.toLocaleString()} atomic units; missing ${coverage.missingCount.toLocaleString()}; overlaps ${coverage.duplicateCount.toLocaleString()}`)
  for (const owner of review.missingByOwner[variantName].filter((entry) => entry.missingAtomicUnits > 0)) {
    console.log(`    missing ${owner.owner}: ${owner.missingAtomicUnits.toLocaleString()}`)
  }
}
if (!review.releaseReady) process.exitCode = 1
