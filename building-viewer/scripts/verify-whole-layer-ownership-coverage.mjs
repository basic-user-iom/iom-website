/** Fail-closed release check for a generated whole-layer contract and package claims. */
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  validateWholeLayerOwnershipContract,
  validateWholeLayerPackageClaims,
  verifyWholeLayerOwnershipSources,
} from './lib/whole-layer-ownership-contract.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const REPOSITORY_ROOT = resolve(VIEWER_ROOT, '..')
const MODEL_ROOT = resolve(REPOSITORY_ROOT, 'public', 'models', 'icm-anim-2025')

function parseArgs(argv) {
  const args = { contract: null, claims: null }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--contract') args.contract = resolve(VIEWER_ROOT, argv[++index])
    else if (value === '--claims') args.claims = resolve(VIEWER_ROOT, argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  if (!args.contract || !args.claims) {
    throw new Error('Fail closed: both --contract and --claims are required')
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const contract = JSON.parse(await readFile(args.contract, 'utf8'))
const claims = JSON.parse(await readFile(args.claims, 'utf8'))
const structure = validateWholeLayerOwnershipContract(contract)
const sources = await verifyWholeLayerOwnershipSources(contract, {
  web: resolve(MODEL_ROOT, 'model-web.glb'),
  quest: resolve(MODEL_ROOT, 'model-quest.glb'),
})
const coverage = validateWholeLayerPackageClaims(contract, claims)
const errors = [
  ...structure.errors.map((error) => `contract: ${error}`),
  ...sources.errors.map((error) => `source: ${error}`),
  ...coverage.errors.map((error) => `coverage: ${error}`),
]
if (errors.length) {
  console.error('Whole-layer ownership release gate: BLOCKED')
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}
console.log('Whole-layer ownership release gate: PASS')
console.log(`  contract: ${contract.coverageDigestSha256}`)
for (const variant of ['web', 'quest']) {
  console.log(`  ${variant}: ${coverage.variants[variant].expectedRenderUnits.toLocaleString()} units, exactly once`)
}
