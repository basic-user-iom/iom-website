import { basename } from 'node:path'
import {
  sha256,
  stringListSha256,
  validateWholeLayerOwnershipContract,
  validateWholeLayerPackageClaims,
  WHOLE_LAYER_CLAIMS_SCHEMA,
  WHOLE_LAYER_OWNERS,
  WHOLE_LAYER_OWNERSHIP_VERSION,
  WHOLE_LAYER_VARIANTS,
} from './whole-layer-ownership-contract.mjs'

export const OWNER_CLAIMS_COMPOSITION_REVIEW_SCHEMA = 'IOM_WHOLE_LAYER_OWNER_CLAIMS_COMPOSITION_REVIEW'

function nonEmptyStrings(value) {
  return Array.isArray(value) && value.length > 0 && value.every((entry) =>
    typeof entry === 'string' && entry.length > 0)
}

function payloadHash(payload) {
  return payload?.sha256 ?? payload?.metrics?.sha256 ?? null
}

export function ownerCandidatePayloadEntries(index) {
  const entries = []
  for (const pkg of index?.packages || []) {
    for (const variant of WHOLE_LAYER_VARIANTS) {
      const dccSource = pkg?.dccSources?.[variant]
      const dccHash = payloadHash(dccSource)
      if (dccSource?.url && dccHash) entries.push(`${dccSource.url}:${dccHash}`)
      for (const payload of Object.values(pkg?.variants?.[variant] || {})) {
        const hash = payloadHash(payload)
        if (payload?.url && hash) entries.push(`${payload.url}:${hash}`)
      }
    }
  }
  const shell = index?.shellCompletion?.requiredAlwaysResidentShell ?? index?.alwaysResidentShell
  if (shell) {
    for (const variant of WHOLE_LAYER_VARIANTS) {
      const payload = shell.variants?.[variant]
      const url = shell.outputs?.[variant] ?? payload?.url
      const hash = payloadHash(payload)
      if (url && hash) entries.push(`${url}:${hash}`)
    }
  }
  if (index?.rig?.url && index.rig.sha256) entries.push(`${index.rig.url}:${index.rig.sha256}`)
  return entries.sort()
}

export function ownerCandidatePayloadSetSha256(index) {
  return sha256(ownerCandidatePayloadEntries(index).join('\n'))
}

function packageSources(index) {
  const sources = (index?.packages || []).map((pkg, packageIndex) => ({
    kind: 'detail',
    id: pkg.id || `detail-${packageIndex}`,
    content: pkg.content,
    sourcePaths: pkg.sourcePaths,
  }))
  const shell = index?.shellCompletion?.requiredAlwaysResidentShell ?? index?.alwaysResidentShell
  if (shell) {
    sources.push({
      kind: 'always-resident-shell',
      id: shell.id || 'always-resident-shell',
      content: shell.content,
      sourcePaths: shell.sourcePaths,
    })
  }
  return sources
}

function exactListEqual(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
}

function candidateIdentity(candidate, index, ordinal) {
  const rawHash = candidate.indexBytes ? sha256(candidate.indexBytes) : sha256(JSON.stringify(index))
  return {
    id: `owner-candidate-${ordinal}-${rawHash.slice(0, 12)}`,
    indexPath: candidate.indexPath || `(candidate-${ordinal})`,
    indexSha256: rawHash,
    auditPath: candidate.auditPath || `(audit-${ordinal})`,
    auditSha256: candidate.auditBytes ? sha256(candidate.auditBytes) : sha256(JSON.stringify(candidate.audit)),
  }
}

function validateCandidate(contract, candidate, ordinal) {
  const index = candidate.index
  const audit = candidate.audit
  const identity = candidateIdentity(candidate, index, ordinal)
  const errors = []
  const warnings = []
  const owner = index?.owner?.nodeName
  if (index?.schema !== 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_PILOT' || index?.version !== 1) {
    errors.push('index schema/version is not an owner-local package pilot v1')
  }
  if (index?.enabled !== false) errors.push('index.enabled must remain false')
  if (!WHOLE_LAYER_OWNERS.includes(owner)) errors.push(`unknown owner ${owner}`)
  if (!Array.isArray(index?.packages) || index.packages.length === 0) errors.push('index has no detail packages')

  if (audit?.schema !== 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_AUDIT' || audit?.version !== 1) {
    errors.push('audit schema/version is not IOM_OWNER_LOCAL_DETAIL_PACKAGE_AUDIT v1')
  }
  if (audit?.detailPayloadStatus !== 'passed') errors.push('audit detailPayloadStatus is not passed')
  if (!Array.isArray(audit?.failures) || audit.failures.length !== 0) errors.push('audit contains failures or has no failure list')
  if (audit?.owner !== owner) errors.push('audit owner does not match index owner')
  if (audit?.packageCount !== index?.packages?.length) errors.push('audit package count is stale')
  if (audit?.index && basename(candidate.indexPath || 'detail-package-index.json') !== basename(audit.index)) {
    errors.push('audit points to a different package index filename')
  }
  const observedPayloadSet = ownerCandidatePayloadSetSha256(index)
  if (audit?.payloadSetSha256 !== observedPayloadSet) errors.push('audit payload-set digest is stale for this index')

  const shell = index?.shellCompletion?.requiredAlwaysResidentShell ?? index?.alwaysResidentShell
  if (shell && audit?.requireShell !== true) errors.push('shell candidate was not audited with requireShell=true')
  const auditBlockers = Array.isArray(audit?.blockers) ? [...audit.blockers] : []
  if (audit?.activationStatus !== 'ready-for-visual-review' && audit?.activationStatus !== 'ready') {
    warnings.push(`audit activation status remains ${audit?.activationStatus || 'unknown'}`)
  }

  const claimsByVariant = {}
  const variantReviews = {}
  for (const variantName of WHOLE_LAYER_VARIANTS) {
    const source = contract.variants?.[variantName]
    const expectedOwnerNodes = (source?.inventory?.nodes || []).filter((node) => node.owner === owner)
    const nodeByPath = new Map(expectedOwnerNodes.map((node) => [node.ownerRelativePath, node]))
    const unitsByNode = new Map()
    for (const unit of source?.inventory?.units || []) {
      if (!unitsByNode.has(unit.nodeId)) unitsByNode.set(unit.nodeId, [])
      unitsByNode.get(unit.nodeId).push(unit.id)
    }
    for (const values of unitsByNode.values()) values.sort()

    if (index?.source?.[variantName]?.sha256 !== source?.source?.sha256) {
      errors.push(`${variantName}: index source hash is stale`)
    }
    const outputPackages = []
    const allPaths = []
    let mappedAtomicUnits = 0
    for (const sourcePackage of packageSources(index)) {
      const paths = sourcePackage.sourcePaths?.[variantName]
      if (!nonEmptyStrings(paths)) {
        errors.push(`${variantName}/${sourcePackage.id}: source paths are missing or invalid`)
        continue
      }
      if (new Set(paths).size !== paths.length) errors.push(`${variantName}/${sourcePackage.id}: duplicate source paths`)
      const declaredContent = sourcePackage.content?.[variantName]
      if (declaredContent?.sourcePathCount !== paths.length) {
        errors.push(`${variantName}/${sourcePackage.id}: declared source path count is stale`)
      }
      if (declaredContent?.sourcePathsSha256 !== stringListSha256(paths)) {
        errors.push(`${variantName}/${sourcePackage.id}: declared source path digest is stale`)
      }
      const atomicUnitIds = []
      for (const path of paths) {
        const node = nodeByPath.get(path)
        if (!node) {
          errors.push(`${variantName}/${sourcePackage.id}: source path ${path} does not resolve exactly under ${owner}`)
          continue
        }
        const nodeUnits = unitsByNode.get(node.id) || []
        if (nodeUnits.length !== node.renderUnitCount) {
          errors.push(`${variantName}/${sourcePackage.id}: primitive multiplicity is stale for ${path}`)
          continue
        }
        atomicUnitIds.push(...nodeUnits)
      }
      allPaths.push(...paths)
      mappedAtomicUnits += atomicUnitIds.length
      outputPackages.push({
        id: `${identity.id}:${sourcePackage.kind}:${sourcePackage.id}`,
        owner,
        sourceUnitIds: atomicUnitIds.sort(),
      })
    }

    const pathOccurrences = new Map()
    for (const path of allPaths) pathOccurrences.set(path, (pathOccurrences.get(path) || 0) + 1)
    const duplicatePaths = [...pathOccurrences].filter(([, count]) => count > 1).map(([path]) => path).sort()
    if (duplicatePaths.length) errors.push(`${variantName}: ${duplicatePaths.length} source paths overlap inside the candidate`)
    const uniquePaths = [...pathOccurrences.keys()].sort()
    const expectedPaths = expectedOwnerNodes.map((node) => node.ownerRelativePath).sort()
    const missingPaths = expectedPaths.filter((path) => !pathOccurrences.has(path))
    const unknownPaths = uniquePaths.filter((path) => !nodeByPath.has(path))
    if (missingPaths.length) errors.push(`${variantName}: owner candidate omits ${missingPaths.length} source paths`)
    if (unknownPaths.length) errors.push(`${variantName}: owner candidate has ${unknownPaths.length} unknown source paths`)
    if (!exactListEqual(uniquePaths, expectedPaths)) errors.push(`${variantName}: owner path union is not exact`)

    const ownership = index?.completeOwnership?.[variantName]
    if (ownership?.mode !== 'disjoint-additive') errors.push(`${variantName}: completeOwnership mode is not disjoint-additive`)
    if (ownership?.pathCount !== uniquePaths.length) errors.push(`${variantName}: completeOwnership path count is stale`)
    if (ownership?.pathsSha256 !== stringListSha256(uniquePaths)) errors.push(`${variantName}: completeOwnership path digest is stale`)

    const audited = audit?.sourceCoverage?.[variantName]
    if (audited?.expectedMeshPaths !== expectedPaths.length) errors.push(`${variantName}: audit expected path count is stale`)
    if (audited?.completeMeshPaths !== uniquePaths.length) errors.push(`${variantName}: audit complete path count is stale`)
    if (audited?.completePathsSha256 !== stringListSha256(uniquePaths)) errors.push(`${variantName}: audit complete path digest is stale`)

    claimsByVariant[variantName] = outputPackages
    variantReviews[variantName] = {
      expectedSourcePaths: expectedPaths.length,
      claimedSourcePaths: uniquePaths.length,
      expectedAtomicUnits: expectedOwnerNodes.reduce((sum, node) => sum + node.renderUnitCount, 0),
      mappedAtomicUnits,
      duplicateSourcePathCount: duplicatePaths.length,
      missingSourcePathCount: missingPaths.length,
      unknownSourcePathCount: unknownPaths.length,
      sourcePathsSha256: stringListSha256(uniquePaths),
    }
  }

  return {
    identity,
    owner,
    accepted: errors.length === 0,
    errors,
    warnings,
    audit: {
      detailPayloadStatus: audit?.detailPayloadStatus ?? null,
      activationStatus: audit?.activationStatus ?? null,
      blockerCount: auditBlockers.length,
      blockers: auditBlockers,
      payloadSetSha256: audit?.payloadSetSha256 ?? null,
    },
    variants: variantReviews,
    claimsByVariant,
  }
}

function missingByOwner(contract, claims, variantName) {
  const expectedByOwner = new Map(WHOLE_LAYER_OWNERS.map((owner) => [owner, new Set()]))
  for (const unit of contract.variants[variantName].inventory.units) expectedByOwner.get(unit.owner).add(unit.id)
  const claimedByOwner = new Map(WHOLE_LAYER_OWNERS.map((owner) => [owner, new Set()]))
  for (const pkg of claims.variants[variantName].packages) {
    for (const unitId of pkg.sourceUnitIds || []) claimedByOwner.get(pkg.owner)?.add(unitId)
  }
  return WHOLE_LAYER_OWNERS.map((owner) => {
    const expected = expectedByOwner.get(owner)
    const claimed = claimedByOwner.get(owner)
    const missing = [...expected].filter((id) => !claimed.has(id))
    return {
      owner,
      expectedAtomicUnits: expected.size,
      claimedAtomicUnits: claimed.size,
      missingAtomicUnits: missing.length,
      missingSample: missing.sort().slice(0, 10),
    }
  })
}

export function composeWholeLayerOwnerClaims(contract, candidates) {
  const errors = []
  const contractReview = validateWholeLayerOwnershipContract(contract)
  if (!contractReview.valid) errors.push(...contractReview.errors.map((error) => `contract: ${error}`))
  if (!Array.isArray(candidates) || candidates.length === 0) errors.push('at least one audited owner candidate is required')
  const candidateReviews = (candidates || []).map((candidate, index) => validateCandidate(contract, candidate, index))
  for (const review of candidateReviews) {
    errors.push(...review.errors.map((error) => `${review.identity.indexPath}: ${error}`))
  }

  const claims = {
    schema: WHOLE_LAYER_CLAIMS_SCHEMA,
    version: WHOLE_LAYER_OWNERSHIP_VERSION,
    modelId: contract.modelId,
    coverageContractSha256: contract.coverageDigestSha256,
    variants: Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variantName) => [variantName, {
      sourceSha256: contract.variants[variantName].source.sha256,
      animationTargetsSha256: contract.variants[variantName].animation.targetsSha256,
      packages: candidateReviews.flatMap((review) => review.claimsByVariant[variantName] || []),
    }])),
  }

  const ownerOccurrences = new Map()
  for (const review of candidateReviews) {
    if (!ownerOccurrences.has(review.owner)) ownerOccurrences.set(review.owner, [])
    ownerOccurrences.get(review.owner).push(review.identity.id)
  }
  const repeatedOwners = [...ownerOccurrences]
    .filter(([owner, ids]) => WHOLE_LAYER_OWNERS.includes(owner) && ids.length > 1)
    .map(([owner, candidateIds]) => ({ owner, candidateIds }))
  if (repeatedOwners.length) errors.push(`${repeatedOwners.length} owners are supplied by multiple candidates`)

  const crossCandidateOverlaps = {}
  for (const variantName of WHOLE_LAYER_VARIANTS) {
    const occurrences = new Map()
    for (const pkg of claims.variants[variantName].packages) {
      for (const id of pkg.sourceUnitIds || []) {
        if (!occurrences.has(id)) occurrences.set(id, [])
        occurrences.get(id).push(pkg.id)
      }
    }
    crossCandidateOverlaps[variantName] = [...occurrences]
      .filter(([, packages]) => packages.length > 1)
      .map(([unitId, packages]) => ({ unitId, packages }))
      .sort((left, right) => left.unitId.localeCompare(right.unitId))
    if (crossCandidateOverlaps[variantName].length) {
      errors.push(`${variantName}: ${crossCandidateOverlaps[variantName].length} atomic units overlap across candidates`)
    }
  }

  const coverage = validateWholeLayerPackageClaims(contract, claims)
  const missing = Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variantName) => [
    variantName,
    missingByOwner(contract, claims, variantName),
  ]))
  const auditBlockers = candidateReviews.flatMap((review) => review.audit.blockers.map((blocker) => ({
    candidateId: review.identity.id,
    owner: review.owner,
    blocker,
  })))
  const acceptedCandidates = candidateReviews.every((review) => review.accepted)
  const noOverlaps = repeatedOwners.length === 0 && WHOLE_LAYER_VARIANTS.every((variantName) =>
    crossCandidateOverlaps[variantName].length === 0)
  const review = {
    schema: OWNER_CLAIMS_COMPOSITION_REVIEW_SCHEMA,
    version: 1,
    productionModified: false,
    runtimeManifestEmitted: false,
    coverageContractSha256: contract.coverageDigestSha256,
    candidateCount: candidateReviews.length,
    acceptedCandidates,
    noCrossCandidateOverlap: noOverlaps,
    wholeLayerCoverageValid: coverage.valid,
    allAuditReleaseBlockersCleared: auditBlockers.length === 0,
    releaseReady: contractReview.valid && acceptedCandidates && noOverlaps && coverage.valid && auditBlockers.length === 0,
    status: contractReview.valid && acceptedCandidates && noOverlaps && coverage.valid && auditBlockers.length === 0
      ? 'ownership-complete-audits-clear-runtime-still-disabled'
      : 'blocked-fail-closed',
    errors,
    repeatedOwners,
    crossCandidateOverlaps: Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variantName) => [variantName, {
      count: crossCandidateOverlaps[variantName].length,
      sample: crossCandidateOverlaps[variantName].slice(0, 20),
    }])),
    candidateReviews: candidateReviews.map(({ claimsByVariant, ...candidateReview }) => candidateReview),
    coverage,
    missingByOwner: missing,
    auditBlockers,
  }
  return { claims, review }
}
