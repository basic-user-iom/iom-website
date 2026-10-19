// Narrow, reviewed literal decisions, not whole-file or filename allowlists.
// A file mutation or new literal requires review. Other rules always still run.
import fs from 'node:fs'
import { createHash } from 'node:crypto'

const digest = value => createHash('sha256').update(value).digest('hex')
export function matchesReviewedLiteral(records, fileDigest, key, value) {
  if (value === undefined || !Array.isArray(records)) return false
  const literalDigest = digest(JSON.stringify([key, String(value)]))
  return records.some(record => record.fileDigest === fileDigest &&
    Array.isArray(record.literalDigests) && record.literalDigests.includes(literalDigest))
}

const registry = JSON.parse(fs.readFileSync(new URL('./deploy-reviewed-public-data.json', import.meta.url), 'utf8'))
if (registry.schema !== 1 || !registry.files || typeof registry.files !== 'object') throw new Error('PUBLIC_REVIEW_REGISTRY_INVALID')
export function publicLiteralReview(name, bytes) {
  const records = registry.files[name]
  let fileDigest
  return (key, value) => {
    if (!records || value === undefined) return false
    fileDigest ??= digest(bytes)
    return matchesReviewedLiteral(records, fileDigest, key, value)
  }
}
