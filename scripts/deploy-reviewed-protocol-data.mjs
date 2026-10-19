// Proposal only: reviewed source ranges for one public MCP response challenge.
// This does not whitelist a file, arbitrary OAuth text, or credentials.
import fs from 'node:fs'
import {createHash} from 'node:crypto'
const digest = value => createHash('sha256').update(value).digest('hex')
const approvedPath = 'api/_lib/crm-email-mcp.mjs'
// Fixed hashes of the exact reviewed signature and full setHeader expression.
// Their readable public source is recorded in reviewed-values.json.
const signatureDigest = 'b365789ef9bf38ab991c4bf59297cd755b9fb5630be3b8bafff77399b58b1995'
const signatureLength = 25
const contextDigest = 'a073e378a3a93c9c2ea4c79ca9ebd0aa666b0cd97c7065d1effa6f8612278e54'

export function reviewedProtocolChallenge(records, name, bytes) {
  const denied = () => false
  if (name !== approvedPath || !Buffer.isBuffer(bytes) || !Array.isArray(records)) return denied
  // Hash once per file, never once per regex match. Unknown bytes fail early.
  const fileDigest = digest(bytes)
  const candidates = records.filter(record => record?.fileDigest === fileDigest)
  if (!candidates.length) return denied
  const source = bytes.toString('utf8')
  const offsets = new Set()
  for (const record of candidates) {
    const {sourceOffset: offset, contextStart: start, contextEnd: end} = record
    if (Number.isSafeInteger(offset) && offset >= 0 &&
        Number.isSafeInteger(start) && Number.isSafeInteger(end) &&
        start >= 0 && start <= offset && end >= offset + signatureLength && end <= source.length &&
        digest(source.slice(start, end)) === contextDigest &&
        digest(source.slice(offset, offset + signatureLength)) === signatureDigest) offsets.add(offset)
  }
  return (offset, value) => offsets.has(offset) && typeof value === 'string' &&
    value.length === signatureLength && digest(value) === signatureDigest
}

export function matchesReviewedProtocolChallenge(records, name, bytes, offset, value) {
  return reviewedProtocolChallenge(records, name, bytes)(offset, value)
}

const registry = JSON.parse(fs.readFileSync(new URL('./deploy-reviewed-protocol-data.json', import.meta.url), 'utf8'))
if (registry.schema !== 1 || !registry.files || typeof registry.files !== 'object') throw new Error('PROTOCOL_REVIEW_REGISTRY_INVALID')
export function publicProtocolChallengeReview(name, bytes) {
  return reviewedProtocolChallenge(registry.files[name], name, bytes)
}
