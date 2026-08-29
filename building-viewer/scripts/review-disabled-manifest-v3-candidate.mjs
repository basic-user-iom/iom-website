/**
 * Read-only release review. This writes one report below building-viewer/tmp;
 * it cannot copy GLBs, emit manifests, alter routes, or enable streaming.
 *
 * Usage:
 *   node scripts/review-disabled-manifest-v3-candidate.mjs <request.json> <report.json>
 */
import { lstat, mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reviewDisabledManifestV3Candidate } from './lib/disabled-manifest-v3-candidate.mjs'

const VIEWER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TMP_ROOT = resolve(VIEWER_ROOT, 'tmp')

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

const requestPath = process.argv[2] ? resolve(process.argv[2]) : null
const reportPath = process.argv[3] ? resolve(process.argv[3]) : null
if (!requestPath || !reportPath || process.argv.length > 4) {
  console.error('usage: review-disabled-manifest-v3-candidate.mjs <request.json> <new-report.json>')
  process.exit(1)
}
if (!inside(reportPath, TMP_ROOT) || reportPath === TMP_ROOT) {
  console.error('review report must be a file below building-viewer/tmp')
  process.exit(1)
}
if (await exists(reportPath)) {
  console.error(`review report already exists: ${reportPath}`)
  process.exit(1)
}

const review = await reviewDisabledManifestV3Candidate(requestPath)
await mkdir(dirname(reportPath), { recursive: true })
await writeFile(reportPath, `${JSON.stringify(review, null, 2)}\n`)
console.log(`Disabled manifest-v3 review: ${review.status}`)
console.log(`  report=${reportPath}`)
if (review.blocker) console.log(`  blocker=${review.blocker.split('\n')[0]}`)
console.log('  manifestsEmitted=false; assetsCopied=false; productionReferenced=false')
