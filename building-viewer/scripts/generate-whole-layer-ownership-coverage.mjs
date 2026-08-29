/**
 * Generates read-only whole-layer visual ownership evidence for icm-anim-2025.
 *
 * This command writes only to the selected report directory. It never edits a
 * production asset or manifest and never enables streaming.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildWholeLayerOwnershipContract,
  claimsFromOwnerLocalPilot,
  validateWholeLayerOwnershipContract,
  validateWholeLayerPackageClaims,
  verifyWholeLayerOwnershipSources,
  WHOLE_LAYER_VARIANTS,
} from './lib/whole-layer-ownership-contract.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const REPOSITORY_ROOT = resolve(VIEWER_ROOT, '..')
const MODEL_ROOT = resolve(REPOSITORY_ROOT, 'public', 'models', 'icm-anim-2025')

function parseArgs(argv) {
  const args = {
    outDir: resolve(VIEWER_ROOT, 'tmp', 'whole-layer-ownership-v1'),
    pilotIndex: null,
    claims: null,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--out') args.outDir = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--pilot-index') args.pilotIndex = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--claims') args.claims = resolve(VIEWER_ROOT, argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function projectPath(path) {
  const value = relative(VIEWER_ROOT, path).replaceAll('\\', '/')
  return value.startsWith('.') ? value : `./${value}`
}

function markdownTable(contract) {
  const rows = []
  for (const variantName of WHOLE_LAYER_VARIANTS) {
    for (const owner of contract.variants[variantName].owners) {
      rows.push(`| ${variantName} | ${owner.owner} | ${owner.animatedTarget ? 'yes' : 'no'} | ${owner.renderNodeCount.toLocaleString()} | ${owner.logicalInstanceCount.toLocaleString()} | ${owner.renderUnitCount.toLocaleString()} | ${owner.expandedTriangles.toLocaleString()} | ${owner.rendererDraws.toLocaleString()} |`)
    }
  }
  return rows.join('\n')
}

function summarize(contract, coverageReview) {
  return {
    schema: 'IOM_WHOLE_LAYER_VISUAL_OWNERSHIP_REPORT',
    version: 1,
    productionModified: false,
    activationStatus: coverageReview?.valid ? 'coverage-proven-but-routing-remains-disabled' : 'blocked-incomplete-whole-layer-coverage',
    coverageDigestSha256: contract.coverageDigestSha256,
    variants: Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variantName) => {
      const variant = contract.variants[variantName]
      return [variantName, {
        source: variant.source,
        activeScene: variant.activeScene,
        animation: {
          clipCount: variant.animation.clipCount,
          channelCount: variant.animation.channelCount,
          targetNames: variant.animation.targetNames,
          targetsSha256: variant.animation.targetsSha256,
        },
        inventory: {
          ...variant.inventory,
          nodes: undefined,
          instances: undefined,
          units: undefined,
        },
        coverageDigestSha256: variant.coverageDigestSha256,
        owners: variant.owners,
      }]
    })),
    candidateCoverage: coverageReview || null,
    nextCandidateContract: {
      schema: 'IOM_WHOLE_LAYER_VISUAL_OWNERSHIP_CLAIMS',
      version: 1,
      requirement: 'Each Web and Quest package declares one owner plus sourceNodeIds or sourceUnitIds. The exact union must equal the pinned inventory with multiplicity one.',
    },
  }
}

const args = parseArgs(process.argv.slice(2))
const sources = {
  web: resolve(MODEL_ROOT, 'model-web.glb'),
  quest: resolve(MODEL_ROOT, 'model-quest.glb'),
}
const contract = await buildWholeLayerOwnershipContract({
  modelId: 'icm-anim-2025',
  variants: {
    web: { filePath: sources.web, url: '/models/icm-anim-2025/model-web.glb' },
    quest: { filePath: sources.quest, url: '/models/icm-anim-2025/model-quest.glb' },
  },
})
const structure = validateWholeLayerOwnershipContract(contract)
const sourceVerification = await verifyWholeLayerOwnershipSources(contract, sources)
if (!structure.valid || !sourceVerification.valid) {
  throw new Error([...structure.errors, ...sourceVerification.errors].join('\n'))
}

let claims = null
let coverageReview = null
let coverageLabel = 'No package claims supplied; activation is blocked.'
if (args.pilotIndex) {
  const index = JSON.parse(await readFile(args.pilotIndex, 'utf8'))
  claims = claimsFromOwnerLocalPilot(contract, index)
  coverageReview = validateWholeLayerPackageClaims(contract, claims)
  coverageLabel = `Owner-local pilot ${projectPath(args.pilotIndex)} covers only its declared owner; whole-layer activation is ${coverageReview.valid ? 'unexpectedly valid' : 'correctly blocked'}.`
} else if (args.claims) {
  claims = JSON.parse(await readFile(args.claims, 'utf8'))
  coverageReview = validateWholeLayerPackageClaims(contract, claims)
  coverageLabel = `Candidate claims ${projectPath(args.claims)} are ${coverageReview.valid ? 'exactly complete' : 'incomplete or invalid'}. Runtime routing remains outside this tool.`
}

await mkdir(args.outDir, { recursive: true })
await writeFile(join(args.outDir, 'whole-layer-ownership-contract-v1.json'), `${JSON.stringify(contract, null, 2)}\n`)
if (claims) await writeFile(join(args.outDir, 'candidate-ownership-claims-v1.json'), `${JSON.stringify(claims, null, 2)}\n`)
if (coverageReview) await writeFile(join(args.outDir, 'candidate-coverage-review.json'), `${JSON.stringify(coverageReview, null, 2)}\n`)
const summary = summarize(contract, coverageReview)
await writeFile(join(args.outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
await writeFile(join(args.outDir, 'REPORT.md'), `# Whole-layer visual ownership coverage v1\n\n` +
  `This is fail-closed, read-only release evidence. Production assets and routing were not changed.\n\n` +
  `Contract digest: \`${contract.coverageDigestSha256}\`\n\n` +
  `${coverageLabel}\n\n` +
  `The atomic coverage unit is one mesh primitive at one logical instance. Every unit must appear exactly once in Web and Quest claims.\n\n` +
  `| Variant | Nearest owner | Animated target | Render nodes | Logical instances | Atomic units | Expanded triangles | Renderer draws |\n` +
  `|---|---|---|---:|---:|---:|---:|---:|\n${markdownTable(contract)}\n\n` +
  `Animation target names are pinned to: ${contract.animatedOwnerTargets.join(', ')}. Ground Floor is an explicit static owner and \`__unowned__\` is an explicit required partition.\n\n` +
  `A future candidate plugs in with an \`IOM_WHOLE_LAYER_VISUAL_OWNERSHIP_CLAIMS\` document. Each package declares exactly one owner and either complete source-node identities or atomic unit identities. Omission, duplication, wrong-owner assignment, a stale source hash, or a changed animation target digest makes the gate fail.\n`)

console.log('Whole-layer ownership contract: PASS')
console.log(`  output: ${args.outDir}`)
console.log(`  digest: ${contract.coverageDigestSha256}`)
for (const variantName of WHOLE_LAYER_VARIANTS) {
  const variant = contract.variants[variantName]
  console.log(`  ${variantName}: ${variant.inventory.renderNodeCount.toLocaleString()} nodes / ${variant.inventory.renderUnitCount.toLocaleString()} primitive-instances / ${variant.inventory.expandedTriangles.toLocaleString()} triangles`)
}
if (coverageReview) {
  for (const variantName of WHOLE_LAYER_VARIANTS) {
    const result = coverageReview.variants[variantName]
    console.log(`  ${variantName} candidate: ${result.claimedUniqueRenderUnits.toLocaleString()} / ${result.expectedRenderUnits.toLocaleString()} units; missing ${result.missingCount.toLocaleString()}; duplicate ${result.duplicateCount.toLocaleString()}`)
  }
  if (args.claims && !coverageReview.valid) process.exitCode = 1
}
