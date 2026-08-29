/**
 * Validate a dormant collision activation bundle against exact local bytes.
 *
 * Usage:
 *   node scripts/validate-collision-activation-contract.mjs \
 *     --contract tmp/collision-activation.json \
 *     --coverage tmp/collision-coverage.json \
 *     --collision ../public/models/icm-anim-2025/collision.glb
 *
 * Add --print-pins and omit --contract to print the observed byte/SHA/runtime
 * pin skeleton without creating or modifying any asset.
 */
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  disposeLoadedRoot,
  inspectPinnedFile,
  loadCollisionGlbRoot,
  readPinnedJson,
} from './lib/collision-activation-assets.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')

function parseArgs(argv) {
  const args = { contract: null, coverage: null, collision: null, printPins: false }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--contract') args.contract = resolve(argv[++index])
    else if (value === '--coverage') args.coverage = resolve(argv[++index])
    else if (value === '--collision') args.collision = resolve(argv[++index])
    else if (value === '--print-pins') args.printPins = true
    else throw new Error(`Unknown argument: ${value}`)
  }
  if (!args.coverage) throw new Error('Required: --coverage <coverage-report.json>')
  if (!args.collision) throw new Error('Required: --collision <collision.glb>')
  if (!args.printPins && !args.contract) throw new Error('Required: --contract <activation-contract.json>')
  return args
}

function disposeChunks(chunks) {
  for (const chunk of chunks) chunk.geometry.dispose()
}

async function main() {
  const args = parseArgs(process.argv)
  const [collisionFile, coverageFile] = await Promise.all([
    inspectPinnedFile(args.collision),
    readPinnedJson(args.coverage),
  ])
  const vite = await createServer({
    root: PROJECT_DIR,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  })
  let root = null
  let collision = null
  try {
    const activationModule = await vite.ssrLoadModule('/src/collision/collisionActivationContract.ts')
    const dedicatedModule = await vite.ssrLoadModule('/src/collision/dedicatedCollisionValidation.ts')
    root = await loadCollisionGlbRoot(args.collision)
    const validation = dedicatedModule.validateDedicatedCollisionRoot(
      root,
      'activation-packaging',
      false,
    )
    if (!validation.valid || !validation.collision) {
      throw new Error(`Collision GLB failed the cheap runtime gate: ${validation.reason}`)
    }
    collision = validation.collision

    const evidence = {
      collisionSha256: collisionFile.sha256,
      collisionBytes: collisionFile.bytes,
      coverageReportSha256: coverageFile.sha256,
      coverageReportBytes: coverageFile.bytes,
      runtime: collision.runtimeMetrics,
    }

    if (args.printPins) {
      console.log(JSON.stringify({
        collision: { ...collisionFile, runtime: collision.runtimeMetrics },
        coverageReport: { sha256: coverageFile.sha256, bytes: coverageFile.bytes },
      }, null, 2))
      return
    }

    const contractFile = await readPinnedJson(args.contract)
    const result = activationModule.validateCollisionActivationEvidence(
      contractFile.value,
      coverageFile.value,
      evidence,
    )
    if (!result.valid) {
      throw new Error(
        `Collision activation rejected:\n${result.errors.map((error) => `  - ${error}`).join('\n')}`,
      )
    }
    console.log(
      `Collision activation contract OK: ${result.summary.triangles.toLocaleString()} triangles, ` +
      `${result.summary.chunks} chunks, ${(result.summary.horizontalCoverageRatio * 100).toFixed(1)}% broad coverage, ` +
      `${result.summary.coveredElevationBands} elevation bands, ${result.summary.validatedProbes} probes, ` +
      `${result.summary.validatedStairs} named stairs`,
    )
  } finally {
    if (collision) disposeChunks(collision.chunks)
    if (root) disposeLoadedRoot(root)
    await vite.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
