import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateWholeLayerOwnershipContract } from './lib/whole-layer-ownership-contract.mjs'
import { composeWholeLayerOwnerClaims } from './lib/whole-layer-owner-claims-composer.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const CONTRACT_PATH = resolve(VIEWER_ROOT, 'tmp', 'whole-layer-ownership-v1', 'whole-layer-ownership-contract-v1.json')
const CANDIDATE_DIRS = [
  'hlod-pilot-first-floor-shell-candidate',
  'hlod-pilot-second-floor-shell-candidate',
  'hlod-pilot-mezzanine-shell-candidate',
  'hlod-pilot-ceiling-shell-candidate',
]

async function jsonFile(path) {
  const bytes = await readFile(path)
  return { bytes, value: JSON.parse(bytes.toString('utf8')) }
}

async function loadCandidate(directory) {
  const root = resolve(VIEWER_ROOT, 'tmp', directory)
  const index = await jsonFile(resolve(root, 'detail-package-index.json'))
  const audit = await jsonFile(resolve(root, 'shell-package-audit.json'))
  return {
    indexPath: `${directory}/detail-package-index.json`,
    indexBytes: index.bytes,
    index: index.value,
    auditPath: `${directory}/shell-package-audit.json`,
    auditBytes: audit.bytes,
    audit: audit.value,
  }
}

const contract = (await jsonFile(CONTRACT_PATH)).value
assert.equal(validateWholeLayerOwnershipContract(contract).valid, true)
const candidates = []
for (const directory of CANDIDATE_DIRS) candidates.push(await loadCandidate(directory))

const composed = composeWholeLayerOwnerClaims(contract, candidates)
assert.equal(composed.review.acceptedCandidates, true, composed.review.errors.join('\n'))
assert.equal(composed.review.noCrossCandidateOverlap, true)
assert.equal(composed.review.wholeLayerCoverageValid, false)
assert.equal(composed.review.releaseReady, false)
assert.equal(composed.review.errors.length, 0)
assert.equal(composed.review.coverage.variants.web.claimedUniqueRenderUnits, 2_970)
assert.equal(composed.review.coverage.variants.quest.claimedUniqueRenderUnits, 2_962)
assert.equal(composed.review.coverage.variants.web.missingCount, 3_445)
assert.equal(composed.review.coverage.variants.quest.missingCount, 3_445)
for (const variantName of ['web', 'quest']) {
  const missing = new Map(composed.review.missingByOwner[variantName].map((entry) => [entry.owner, entry.missingAtomicUnits]))
  assert.equal(missing.get('1st Floor._anim1'), 0)
  assert.equal(missing.get('2st Floor._anim1'), 0)
  assert.equal(missing.get('Mezzanine._anim1'), 0)
  assert.equal(missing.get('Ceiling._anim1'), 0)
  assert.equal(missing.get('Ground Floor._anim1'), 230)
  assert.equal(missing.get('__unowned__'), 3_215)
  for (const pkg of composed.claims.variants[variantName].packages) {
    assert.equal(Array.isArray(pkg.sourceUnitIds), true)
    assert.equal(Object.hasOwn(pkg, 'sourceNodeIds'), false)
  }
}

const duplicatedCandidate = composeWholeLayerOwnerClaims(contract, [candidates[0], candidates[0]])
assert.equal(duplicatedCandidate.review.releaseReady, false)
assert.equal(duplicatedCandidate.review.noCrossCandidateOverlap, false)
assert.equal(duplicatedCandidate.review.repeatedOwners.length, 1)
assert.equal(duplicatedCandidate.review.crossCandidateOverlaps.web.count, 1_087)
assert.equal(duplicatedCandidate.review.crossCandidateOverlaps.quest.count, 1_080)
assert.match(duplicatedCandidate.review.errors.join('\n'), /owners are supplied by multiple candidates/)

const staleCandidate = structuredClone(candidates[0])
staleCandidate.index.packages[0].variants.web.lod0.sha256 = '0'.repeat(64)
const staleComposition = composeWholeLayerOwnerClaims(contract, [staleCandidate])
assert.equal(staleComposition.review.acceptedCandidates, false)
assert.equal(staleComposition.review.releaseReady, false)
assert.match(staleComposition.review.errors.join('\n'), /audit payload-set digest is stale for this index/)

const staleSourceCandidate = structuredClone(candidates[1])
staleSourceCandidate.index.source.quest.sha256 = 'f'.repeat(64)
const staleSourceComposition = composeWholeLayerOwnerClaims(contract, [staleSourceCandidate])
assert.equal(staleSourceComposition.review.acceptedCandidates, false)
assert.match(staleSourceComposition.review.errors.join('\n'), /quest: index source hash is stale/)

console.log('Whole-layer owner claims composer: PASS')
console.log('  four audited owner candidates map to exact atomic unit IDs without overlap')
console.log('  Web: 2,970 / 6,415 claimed; Ground 230 + unowned 3,215 missing')
console.log('  Quest: 2,962 / 6,407 claimed; Ground 230 + unowned 3,215 missing')
console.log('  duplicate owner candidate: rejected with 1,087 Web / 1,080 Quest overlapping units')
console.log('  stale payload index and stale source pin: rejected')
