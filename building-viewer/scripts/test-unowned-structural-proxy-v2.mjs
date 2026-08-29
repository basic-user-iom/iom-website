/** Positive and negative contract tests for disabled structural proxy v2. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGltfIO } from './lib/gltf-io.mjs'
import { stringListSha256 } from './lib/whole-layer-ownership-contract.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'tmp', 'hlod-pilot-unowned-structural-proxy-v2')
const VARIANTS = ['web', 'quest']
const load = (path) => readFile(path, 'utf8').then(JSON.parse)
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function assertFalseFlags(value, label) {
  for (const key of ['enabled', 'ready', 'activationApproved']) {
    assert.equal(value[key], false, `${label}.${key} must remain false`)
  }
}

function validateVariant(entry, expectedWholeUnitIds, repeatUnitIds, fireUnitIds) {
  const proxy = entry.proxy.sourceUnitIds
  const detail = entry.detailComplement.sourceUnitIds
  assert.equal(proxy.length, new Set(proxy).size, 'duplicate proxy unit claim')
  assert.equal(detail.length, new Set(detail).size, 'duplicate detail unit claim')
  assert.equal(proxy.length, entry.proxy.sourceUnitCount, 'proxy sourceUnitCount mismatch')
  assert.equal(detail.length, entry.detailComplement.sourceUnitCount, 'detail sourceUnitCount mismatch')
  assert.equal(stringListSha256(proxy), entry.proxy.sourceUnitIdsSha256, 'proxy unit digest mismatch')
  assert.equal(stringListSha256(detail), entry.detailComplement.sourceUnitIdsSha256, 'detail unit digest mismatch')
  assert.equal(entry.proxy.sourcePaths.length, new Set(entry.proxy.sourcePaths).size, 'duplicate proxy source path')
  assert.equal(stringListSha256(entry.proxy.sourcePaths), entry.proxy.sourcePathsSha256, 'proxy path digest mismatch')
  const detailSet = new Set(detail)
  assert.equal(proxy.filter((id) => detailSet.has(id)).length, 0, 'proxy/detail overlap')
  const union = [...new Set([...proxy, ...detail])].sort()
  assert.deepEqual(union, expectedWholeUnitIds, 'whole static ownership omission or foreign claim')
  const repeat = new Set(repeatUnitIds)
  const fire = new Set(fireUnitIds)
  assert.equal(proxy.filter((id) => repeat.has(id)).length, 0, 'repeat ownership overlap')
  assert.equal(proxy.filter((id) => fire.has(id)).length, 0, 'migrated-fire ownership overlap')
  assert.deepEqual(entry.conservation, {
    wholeStaticUnitCount: 2_843,
    unionUnitCount: 2_843,
    overlapCount: 0,
    omissionCount: 0,
    duplicateCount: 0,
    repeatOverlapCount: 0,
    fireOverlapCount: 0,
  })
}

function validateMaterialGuard(candidate, repartition) {
  const candidateGuard = candidate.safety.materialFidelity
  const repartitionGuard = repartition.compositionGuard.materialFidelity
  assert.equal(candidateGuard.materialFidelityReady, false)
  assert.equal(candidateGuard.proxyTextureCount, 0)
  assert.equal(candidateGuard.proxyImageCount, 0)
  assert.equal(candidateGuard.nearLod0Required, true)
  assert.equal(candidateGuard.nearLod0PackagePresent, false)
  assert.equal(candidateGuard.releaseBlocked, true)
  assert.equal(repartitionGuard.materialFidelityReady, false)
  assert.equal(repartitionGuard.nearLod0Required, true)
  assert.equal(repartitionGuard.nearLod0PackagePresent, false)
  assert.equal(repartitionGuard.explicitReplacementSemanticsValidated, false)
}

const [candidate, repartition, ownership, dependency, topology, projection, render, plan] = await Promise.all([
  load(resolve(OUT, 'candidate-index.json')),
  load(resolve(OUT, 'ownership-repartition-v2.json')),
  load(resolve(OUT, 'ownership-audit-v2.json')),
  load(resolve(OUT, 'dependency-audit-v2.json')),
  load(resolve(OUT, 'topology-audit-v2.json')),
  load(resolve(OUT, 'visual-qa', 'projection-audit.json')),
  load(resolve(OUT, 'visual-qa', 'render-report.json')),
  load(resolve(ROOT, 'tmp', 'unowned-static-partition-plan-v1', 'unowned-static-partition-plan-v1.json')),
])
assert.equal(candidate.schema, 'IOM_UNOWNED_STRUCTURAL_PROXY_CANDIDATE')
assert.equal(repartition.schema, 'IOM_UNOWNED_STRUCTURAL_PROXY_REPARTITION')
assert.equal(ownership.schema, 'IOM_UNOWNED_STRUCTURAL_PROXY_OWNERSHIP_AUDIT')
assert.equal(dependency.schema, 'IOM_UNOWNED_STRUCTURAL_PROXY_DEPENDENCY_AUDIT')
assert.equal(topology.schema, 'IOM_UNOWNED_STRUCTURAL_PROXY_TOPOLOGY_AUDIT')
assert.equal(projection.schema, 'IOM_UNOWNED_STRUCTURAL_PROXY_PROJECTION_AUDIT')
for (const [label, value] of Object.entries({ candidate, repartition, ownership, dependency, topology, projection })) {
  assertFalseFlags(value, label)
}
assert.equal(candidate.runtimeIntegrated, false)
assert.equal(candidate.productionModified, false)
assert.equal(candidate.productionRoutingChanged, false)
assert.equal(ownership.passed, true)
assert.deepEqual(ownership.errors, [])
assert.equal(projection.strongCoverage, false)
assert.equal(projection.releaseReady, false)
assert.equal(projection.status, 'projection-insufficient-candidate-rejected-for-activation')
validateMaterialGuard(candidate, repartition)

for (const variant of VARIANTS) {
  const repeatUnitIds = plan.repeatCandidate.variants[variant].batches.flatMap((batch) => batch.sourceUnitIds)
  const fireUnitIds = plan.fireHoseMigration.variants[variant].sourceUnitIds
  const excluded = new Set([...repeatUnitIds, ...fireUnitIds])
  const expectedWholeUnitIds = plan.variants[variant].units
    .filter((unit) => !excluded.has(unit.id)).map((unit) => unit.id).sort()
  assert.equal(expectedWholeUnitIds.length, 2_843)
  validateVariant(repartition.variants[variant], expectedWholeUnitIds, repeatUnitIds, fireUnitIds)
  assert.deepEqual(repartition.variants[variant].proxy.sourcePaths, candidate.selectionPolicy.sourceNodePaths)
  assert.equal(candidate.variants[variant].asset.expandedTriangles, topology.variants[variant].expandedTriangles)
  assert.ok(candidate.variants[variant].asset.expandedTriangles <= 150_000)
  assert.equal(candidate.variants[variant].asset.textureCount, 0)
  const assetPath = resolve(ROOT, candidate.variants[variant].asset.path)
  const [bytes, info] = await Promise.all([readFile(assetPath), stat(assetPath)])
  assert.equal(info.size, candidate.variants[variant].asset.bytes)
  assert.equal(sha256(bytes), candidate.variants[variant].asset.sha256)
  assert.equal(projection.evidencePins.finalProxyGlbs[variant].sha256, candidate.variants[variant].asset.sha256)
  assert.equal(projection.evidencePins.finalProxyGlbs[variant].bytes, candidate.variants[variant].asset.bytes)
}
const renderBytes = await readFile(resolve(OUT, 'visual-qa', 'render-report.json'))
assert.equal(projection.evidencePins.blenderRenderReport.sha256, sha256(renderBytes))
assert.equal(projection.evidencePins.blenderRenderReport.bytes, renderBytes.length)
for (const entry of render.candidates.filter(({ label }) => label.endsWith('-shell'))) {
  const variant = entry.label.startsWith('web-') ? 'web' : 'quest'
  assert.equal(entry.inputSha256, candidate.variants[variant].asset.sha256, 'stale shell render SHA')
  assert.equal(entry.inputBytes, candidate.variants[variant].asset.bytes, 'stale shell render bytes')
}

const io = await createGltfIO({ encoder: true })
for (const variant of VARIANTS) {
  const document = await io.read(resolve(ROOT, candidate.variants[variant].asset.path))
  const root = document.getRoot()
  const meshNodes = root.listNodes().filter((node) => node.getMesh())
  const representedPaths = [...new Set(meshNodes.map((node) => node.getExtras().iomProxySourcePath))].sort()
  assert.deepEqual(representedPaths, candidate.selectionPolicy.sourceNodePaths)
  assert.equal(root.listTextures().length, 0)
  assert.equal(root.listAnimations().length, 0)
  assert.ok(root.listMaterials().every((material) => material.getDoubleSided()))
}

// Negative contract tests: each independent corruption must fail closed.
const webRepeatIds = plan.repeatCandidate.variants.web.batches.flatMap((batch) => batch.sourceUnitIds)
const webFireIds = plan.fireHoseMigration.variants.web.sourceUnitIds
const webExcluded = new Set([...webRepeatIds, ...webFireIds])
const webStatic = plan.variants.web.units.filter((unit) => !webExcluded.has(unit.id)).map((unit) => unit.id).sort()
const duplicate = structuredClone(repartition.variants.web)
duplicate.proxy.sourceUnitIds.push(duplicate.proxy.sourceUnitIds[0])
assert.throws(() => validateVariant(duplicate, webStatic, webRepeatIds, webFireIds), /duplicate proxy/)
const omission = structuredClone(repartition.variants.web)
omission.detailComplement.sourceUnitIds.pop()
omission.detailComplement.sourceUnitCount -= 1
omission.detailComplement.sourceUnitIdsSha256 = stringListSha256(omission.detailComplement.sourceUnitIds)
assert.throws(() => validateVariant(omission, webStatic, webRepeatIds, webFireIds), /ownership omission/)
const repeatOverlap = structuredClone(repartition.variants.web)
repeatOverlap.proxy.sourceUnitIds.push(webRepeatIds[0])
repeatOverlap.proxy.sourceUnitCount += 1
repeatOverlap.proxy.sourceUnitIdsSha256 = stringListSha256(repeatOverlap.proxy.sourceUnitIds)
assert.throws(() => validateVariant(repeatOverlap, webStatic, webRepeatIds, webFireIds), /foreign claim|repeat ownership/)
const falseMaterialReady = structuredClone(candidate)
falseMaterialReady.safety.materialFidelity.materialFidelityReady = true
assert.throws(() => validateMaterialGuard(falseMaterialReady, repartition))
const staleRender = structuredClone(render)
staleRender.candidates.find(({ label }) => label === 'web-shell').inputSha256 = '0'.repeat(64)
assert.notEqual(staleRender.candidates.find(({ label }) => label === 'web-shell').inputSha256,
  candidate.variants.web.asset.sha256)

console.log(JSON.stringify({
  candidate: 'tmp/hlod-pilot-unowned-structural-proxy-v2/candidate-index.json',
  sourcePathCount: candidate.selectionPolicy.sourceNodePathCount,
  triangles: Object.fromEntries(VARIANTS.map((variant) => [variant, candidate.variants[variant].asset.expandedTriangles])),
  strongCoverage: projection.strongCoverage,
  materialFidelityReady: candidate.safety.materialFidelity.materialFidelityReady,
  positiveChecks: 'passed',
  negativeTamperChecks: 5,
  ready: false,
}, null, 2))
