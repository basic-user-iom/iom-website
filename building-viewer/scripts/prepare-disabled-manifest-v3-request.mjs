/**
 * Pin an existing package candidate and its independent evidence into the
 * request consumed by emit/review-disabled-manifest-v3-candidate.mjs.
 *
 * This command writes only the requested JSON file below building-viewer/tmp.
 * It never edits production manifests or assets.
 */
import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ANIMATION_PACKAGE_HARD_LIMITS } from './validate-animation-package-manifest-v3.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const REPOSITORY_ROOT = resolve(VIEWER_ROOT, '..')
const TMP_ROOT = resolve(VIEWER_ROOT, 'tmp')
const PUBLIC_ROOT = resolve(REPOSITORY_ROOT, 'public')

function fail(message) {
  throw new Error(message)
}

function inside(path, root) {
  const child = relative(root, path)
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child))
}

async function exists(path) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function parseArgs(argv) {
  const result = {
    modelId: null,
    index: null,
    audit: null,
    sharedEvidence: null,
    browserQa: null,
    shellReview: null,
    collisionContract: null,
    collisionCoverage: null,
    productionManifest: resolve(PUBLIC_ROOT, 'models', 'manifest.json'),
    output: null,
  }
  const keys = new Map([
    ['--model-id', 'modelId'],
    ['--index', 'index'],
    ['--audit', 'audit'],
    ['--shared-evidence', 'sharedEvidence'],
    ['--browser-qa', 'browserQa'],
    ['--shell-review', 'shellReview'],
    ['--collision-contract', 'collisionContract'],
    ['--collision-coverage', 'collisionCoverage'],
    ['--production-manifest', 'productionManifest'],
    ['--output', 'output'],
  ])
  for (let index = 2; index < argv.length; index += 1) {
    const key = keys.get(argv[index])
    if (!key) fail(`unknown argument: ${argv[index]}`)
    const value = argv[++index]
    if (!value) fail(`${argv[index - 1]} requires a value`)
    result[key] = key === 'modelId' ? value : resolve(value)
  }
  for (const key of ['modelId', 'index', 'audit', 'sharedEvidence', 'browserQa', 'shellReview', 'output']) {
    if (!result[key]) fail(`missing required argument for ${key}`)
  }
  const modelRoot = resolve(PUBLIC_ROOT, 'models', result.modelId)
  result.collisionContract ??= resolve(modelRoot, 'collision-activation-v1.json')
  result.collisionCoverage ??= resolve(modelRoot, 'collision-coverage-v1.json')
  return result
}

function publicAssetPath(url, label) {
  if (typeof url !== 'string' || !url.startsWith('/')) fail(`${label}: expected a public-root URL`)
  const path = resolve(PUBLIC_ROOT, url.replace(/^[/\\]+/, ''))
  if (!inside(path, PUBLIC_ROOT)) fail(`${label}: URL escapes public root`)
  return path
}

async function pinned(path, outputDirectory, url) {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink() || info.size < 1) fail(`not a regular pinned file: ${path}`)
  const bytes = await readFile(path)
  return {
    path: relative(outputDirectory, path).replaceAll('\\', '/'),
    ...(url ? { url } : {}),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
  }
}

const args = parseArgs(process.argv)
if (!inside(args.output, TMP_ROOT) || args.output === TMP_ROOT) fail('output must be a JSON file below building-viewer/tmp')
if (await exists(args.output)) fail(`output already exists: ${args.output}`)
for (const [label, path] of Object.entries(args).filter(([key]) => key !== 'modelId' && key !== 'output')) {
  if (!inside(path, REPOSITORY_ROOT)) fail(`${label}: input escapes repository root`)
}

const [index, productionManifest, collisionContract] = await Promise.all([
  readFile(args.index, 'utf8').then(JSON.parse),
  readFile(args.productionManifest, 'utf8').then(JSON.parse),
  readFile(args.collisionContract, 'utf8').then(JSON.parse),
])
const productionMatches = productionManifest.models?.filter((entry) => entry.id === args.modelId) ?? []
if (productionMatches.length !== 1) fail(`production manifest must contain exactly one ${args.modelId}`)
const production = productionMatches[0]
if (!production.web || !production.quest || !production.animation || !production.collision) {
  fail(`${args.modelId}: Web, Quest, animation, and collision production routes are required`)
}
if (collisionContract.collision?.url !== production.collision) fail('collision contract does not pin the production collision URL')

const outputDirectory = dirname(args.output)
const request = {
  schema: 'IOM_DISABLED_MANIFEST_V3_CANDIDATE_REQUEST',
  version: 1,
  enabled: false,
  modelId: args.modelId,
  packageIndex: await pinned(args.index, outputDirectory),
  packageAudit: await pinned(args.audit, outputDirectory),
  shellVisualApproval: await pinned(args.shellReview, outputDirectory),
  production: {
    manifest: await pinned(args.productionManifest, outputDirectory),
    sources: {
      web: await pinned(publicAssetPath(production.web, 'production.web'), outputDirectory, production.web),
      quest: await pinned(publicAssetPath(production.quest, 'production.quest'), outputDirectory, production.quest),
    },
    animationRig: await pinned(publicAssetPath(production.animation, 'production.animation'), outputDirectory, production.animation),
    collision: await pinned(publicAssetPath(production.collision, 'production.collision'), outputDirectory, production.collision),
  },
  streamRig: await pinned(resolve(dirname(args.index), index.rig?.url ?? ''), outputDirectory),
  collisionEvidence: {
    contract: await pinned(args.collisionContract, outputDirectory, `/models/${args.modelId}/collision-activation-v1.json`),
    coverageReport: await pinned(args.collisionCoverage, outputDirectory, collisionContract.coverageReport?.url),
  },
  sharedTextures: {
    evidence: await pinned(args.sharedEvidence, outputDirectory),
    browserQa: await pinned(args.browserQa, outputDirectory),
  },
  budgets: {
    maxDetailTriangles: Math.min(index.budgets?.maxDetailTriangles ?? 0, ANIMATION_PACKAGE_HARD_LIMITS.maxDetailTriangles),
    maxAlwaysResidentShellTriangles: Math.min(
      index.budgets?.maxAlwaysResidentShellTriangles ?? 0,
      ANIMATION_PACKAGE_HARD_LIMITS.maxAlwaysResidentShellTriangles,
    ),
    maxResident: ANIMATION_PACKAGE_HARD_LIMITS.maxResident,
    maxTransitionPeak: ANIMATION_PACKAGE_HARD_LIMITS.maxTransitionPeak,
  },
}
await mkdir(outputDirectory, { recursive: true })
await writeFile(args.output, `${JSON.stringify(request, null, 2)}\n`)
console.log(`Disabled manifest-v3 request pinned: ${args.output}`)
console.log(`  index=${request.packageIndex.sha256} / ${request.packageIndex.bytes} bytes`)
console.log(`  audit=${request.packageAudit.sha256} / ${request.packageAudit.bytes} bytes`)
console.log(`  shell review=${request.shellVisualApproval.sha256} / ${request.shellVisualApproval.bytes} bytes`)
console.log('  enabled=false; production files were read only')

