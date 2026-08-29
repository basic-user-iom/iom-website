/**
 * Usage:
 *   node scripts/emit-disabled-manifest-v3-candidate.mjs \
 *     tmp/<request>/disabled-manifest-v3-request.json \
 *     tmp/manifest-v3-release-candidate
 *
 * The output directory must not already exist. Both generated manifests and
 * the generated HLOD entry remain disabled; this command never edits public/.
 */
import { resolve } from 'node:path'
import {
  emitDisabledManifestV3Candidate,
} from './lib/disabled-manifest-v3-candidate.mjs'

const requestPath = process.argv[2]
const outputDirectory = process.argv[3]
if (!requestPath || !outputDirectory || process.argv.length > 4) {
  console.error('usage: emit-disabled-manifest-v3-candidate.mjs <request.json> <new-output-directory>')
  process.exit(1)
}

try {
  const result = await emitDisabledManifestV3Candidate(resolve(requestPath), resolve(outputDirectory))
  console.log('Disabled manifest-v3 release candidate: PASS')
  console.log(`  output=${result.outputRoot}`)
  console.log(`  packages=${result.report.packageCount}; payloads=${result.report.payloadCount}`)
  console.log(`  web manifest=${result.report.manifests.web.sha256} / ${result.report.manifests.web.bytes} bytes`)
  console.log(`  quest manifest=${result.report.manifests.quest.sha256} / ${result.report.manifests.quest.bytes} bytes`)
  console.log('  enabled=false; productionReferenced=false; public/models/manifest.json unchanged')
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
