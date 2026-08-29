import {
  sha256,
  stringListSha256,
  validateWholeLayerOwnershipContract,
  validateWholeLayerPackageClaims,
  WHOLE_LAYER_CLAIMS_SCHEMA,
  WHOLE_LAYER_OWNERSHIP_VERSION,
  WHOLE_LAYER_VARIANTS,
} from './whole-layer-ownership-contract.mjs'
import {
  composeWholeLayerOwnerClaims,
  ownerCandidatePayloadSetSha256,
} from './whole-layer-owner-claims-composer.mjs'
import { validateUnownedStaticPlan } from '../build-unowned-static-partition-plan.mjs'

export const WHOLE_LAYER_LOGICAL_PLAN_SCHEMA = 'IOM_WHOLE_LAYER_LOGICAL_OWNERSHIP_PLAN'
export const WHOLE_LAYER_LOGICAL_PLAN_REVIEW_SCHEMA = 'IOM_WHOLE_LAYER_LOGICAL_OWNERSHIP_PLAN_REVIEW'

const FOUR_EMITTED_OWNERS = Object.freeze([
  '1st Floor._anim1',
  '2st Floor._anim1',
  'Ceiling._anim1',
  'Mezzanine._anim1',
])
const GROUND_OWNER = 'Ground Floor._anim1'
const UNOWNED = '__unowned__'

function packageSources(index) {
  const packages = (index?.packages || []).map((pkg, packageIndex) => ({
    kind: 'detail',
    id: pkg.id || `detail-${packageIndex}`,
    content: pkg.content,
    sourcePaths: pkg.sourcePaths,
  }))
  const shell = index?.shellCompletion?.requiredAlwaysResidentShell ?? index?.alwaysResidentShell
  if (shell) packages.push({
    kind: 'always-resident-shell',
    id: shell.id || 'always-resident-shell',
    content: shell.content,
    sourcePaths: shell.sourcePaths,
  })
  return packages
}

function exactSetEqual(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value))
}

function duplicateIds(values) {
  const occurrences = new Map()
  for (const value of values) occurrences.set(value, (occurrences.get(value) || 0) + 1)
  return [...occurrences].filter(([, count]) => count !== 1).map(([id, count]) => ({ id, count }))
}

function validateMigration(contract, contractBytes, migration, migrationBytes, unownedPlan) {
  const errors = []
  const migrationHash = migrationBytes ? sha256(migrationBytes) : null
  if (!migration || !migrationBytes) errors.push('migration sidecar is required')
  if (migration?.schema !== 'IOM_GROUND_FLOOR_SOURCE_OWNERSHIP_MIGRATION' || migration?.version !== 2) {
    errors.push('migration sidecar must use IOM_GROUND_FLOOR_SOURCE_OWNERSHIP_MIGRATION v2')
  }
  if (migration?.enabled !== false || migration?.productionModified !== false) errors.push('migration sidecar must remain disabled and production-unmodified')
  if (migration?.owner !== GROUND_OWNER) errors.push('migration destination owner changed')
  if (migration?.atomicUnit !== 'mesh-primitive-instance' || migration?.identityPolicy !== 'pinned-active-scene-owner-relative-hierarchy-v1') {
    errors.push('migration atomic identity contract changed')
  }
  const evidence = unownedPlan?.fireHoseMigration?.evidence
  if (migrationHash !== evidence?.sha256 || migrationBytes?.length !== evidence?.bytes) {
    errors.push('migration sidecar bytes are missing or stale against the unowned plan')
  }
  const contractHash = contractBytes ? sha256(contractBytes) : null
  if (
    migration?.preprocessing?.wholeLayerContract?.sha256 !== contractHash ||
    migration?.preprocessing?.wholeLayerContract?.bytes !== contractBytes?.length ||
    migration?.preprocessing?.wholeLayerContract?.readOnlyCompatibilityPin !== true
  ) errors.push('migration sidecar whole-layer contract pin is stale')

  const variants = {}
  for (const variantName of WHOLE_LAYER_VARIANTS) {
    const source = contract.variants?.[variantName]
    const migrated = migration?.variants?.[variantName]
    const mappings = Array.isArray(migrated?.atomicMappings) ? migrated.atomicMappings : []
    if (migrated?.production?.sha256 !== source?.source?.sha256 || migrated?.production?.bytes !== source?.source?.bytes) {
      errors.push(`${variantName}: migration production pin is stale`)
    }
    const scope = migrated?.scope
    if (
      scope?.productionGroundOwnedAtomicUnits !== 230 ||
      scope?.migratedDetachedFireAtomicUnits !== 60 ||
      scope?.correctedGroundOwnedAtomicUnits !== 290 ||
      scope?.migratedDetachedFireMeshNodes !== 6 ||
      scope?.atomicMappingCount !== 290 || mappings.length !== 290
    ) errors.push(`${variantName}: migration scope is not exactly 230 + 60 = 290 atomic units`)
    const conservation = migrated?.conservation
    if (!conservation || Object.values(conservation).some((value) => value !== 0)) errors.push(`${variantName}: migration conservation proof changed`)
    const transforms = migrated?.transformEvidence
    if (
      transforms?.maxNodeWorldMatrixDelta !== 0 ||
      transforms?.maxFireInstanceWorldMatrixDelta !== 0 ||
      transforms?.maxAtomicWorldMatrixDelta !== 0
    ) errors.push(`${variantName}: migration transform proof changed`)

    const sourceUnits = new Map((source?.inventory?.units || []).map((unit) => [unit.id, unit]))
    const productionIds = []
    const correctedIds = []
    const fireIds = []
    const groundIds = []
    const byCorrectedPath = new Map()
    for (const mapping of mappings) {
      const productionId = mapping.productionAtomicId
      const unit = sourceUnits.get(productionId)
      if (!unit) errors.push(`${variantName}: migration references unknown production unit ${productionId}`)
      if (unit && mapping.productionOwnership !== unit.owner) errors.push(`${variantName}: migration source owner is stale for ${productionId}`)
      if (mapping.correctedOwnership !== GROUND_OWNER) errors.push(`${variantName}: corrected owner changed for ${productionId}`)
      if (mapping.instanceWorldMatrixDelta !== 0) errors.push(`${variantName}: migration has transform drift for ${productionId}`)
      productionIds.push(productionId)
      correctedIds.push(mapping.correctedAtomicId)
      if (!byCorrectedPath.has(mapping.correctedOwnerPath)) byCorrectedPath.set(mapping.correctedOwnerPath, [])
      byCorrectedPath.get(mapping.correctedOwnerPath).push(mapping)
      if (mapping.migration === 'reparented-fire-safety-batch') {
        fireIds.push(productionId)
        if (unit?.owner !== UNOWNED) errors.push(`${variantName}: migrated fire unit was not originally unowned`)
      } else if (mapping.migration === 'unchanged-ground-owner-unit') {
        groundIds.push(productionId)
        if (unit?.owner !== GROUND_OWNER) errors.push(`${variantName}: unchanged Ground unit has a different source owner`)
      } else errors.push(`${variantName}: unknown migration classification ${mapping.migration}`)
    }
    if (duplicateIds(productionIds).length || duplicateIds(correctedIds).length) errors.push(`${variantName}: migration atomic mappings are duplicated`)
    if (fireIds.length !== 60 || new Set(fireIds).size !== 60) errors.push(`${variantName}: migration must authorize exactly 60 fire units`)
    if (groundIds.length !== 230 || new Set(groundIds).size !== 230) errors.push(`${variantName}: migration must retain exactly 230 original Ground units`)
    const planFireIds = unownedPlan?.fireHoseMigration?.variants?.[variantName]?.sourceUnitIds || []
    if (!exactSetEqual(new Set(fireIds), new Set(planFireIds))) errors.push(`${variantName}: unowned plan fire set differs from the migration sidecar`)
    if (stringListSha256(fireIds) !== migrated?.wholeLayerCompatibility?.productionMigratedFireUnitIdsSha256) {
      errors.push(`${variantName}: migration fire identity digest is stale`)
    }
    for (const mappingsAtPath of byCorrectedPath.values()) {
      mappingsAtPath.sort((left, right) => left.correctedAtomicId.localeCompare(right.correctedAtomicId))
    }
    variants[variantName] = {
      correctedSource: migrated?.correctedPackagingInput,
      mappings,
      byCorrectedPath,
      productionIds: productionIds.sort(),
      fireIds: fireIds.sort(),
      groundIds: groundIds.sort(),
    }
  }
  const webFire = variants.web?.fireIds || []
  const questFire = variants.quest?.fireIds || []
  if (JSON.stringify(webFire) !== JSON.stringify(questFire)) errors.push('Web/Quest migration fire source IDs differ')
  return { valid: errors.length === 0, errors, sha256: migrationHash, bytes: migrationBytes?.length ?? 0, variants }
}

function validateGroundCandidate(contract, groundCandidate, migrationReview) {
  const errors = []
  const index = groundCandidate?.index
  const audit = groundCandidate?.audit
  if (!groundCandidate) errors.push('audited corrected Ground candidate is required')
  if (index?.schema !== 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_PILOT' || index?.version !== 1 || index?.enabled !== false) {
    errors.push('Ground index is not a disabled owner-local package pilot v1')
  }
  if (index?.owner?.nodeName !== GROUND_OWNER) errors.push('Ground index owner changed')
  if (audit?.schema !== 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_AUDIT' || audit?.version !== 1 || audit?.detailPayloadStatus !== 'passed') {
    errors.push('Ground audit has not passed')
  }
  if (!Array.isArray(audit?.failures) || audit.failures.length) errors.push('Ground audit contains failures')
  if (audit?.owner !== GROUND_OWNER || audit?.packageCount !== index?.packages?.length) errors.push('Ground audit is stale for the candidate')
  if (audit?.requireShell !== true) errors.push('Ground shell was not included in the audit')
  if (audit?.payloadSetSha256 !== ownerCandidatePayloadSetSha256(index)) errors.push('Ground audit payload-set digest is stale')
  if (index?.source?.preprocessing?.ownershipMigration?.sha256 !== migrationReview.sha256 ||
    index?.source?.preprocessing?.ownershipMigration?.bytes !== migrationReview.bytes) {
    errors.push('Ground index does not pin the supplied migration sidecar')
  }

  const claimsByVariant = {}
  const variants = {}
  for (const variantName of WHOLE_LAYER_VARIANTS) {
    const migration = migrationReview.variants?.[variantName]
    if (index?.source?.[variantName]?.sha256 !== migration?.correctedSource?.sha256) errors.push(`${variantName}: Ground corrected source hash is stale`)
    const packages = []
    const allPaths = []
    for (const sourcePackage of packageSources(index || {})) {
      const paths = sourcePackage.sourcePaths?.[variantName]
      if (!Array.isArray(paths) || !paths.length || paths.some((path) => typeof path !== 'string' || !path)) {
        errors.push(`${variantName}/${sourcePackage.id}: corrected Ground source paths are invalid`)
        continue
      }
      if (new Set(paths).size !== paths.length) errors.push(`${variantName}/${sourcePackage.id}: corrected Ground source paths duplicate`)
      if (sourcePackage.content?.[variantName]?.sourcePathCount !== paths.length ||
        sourcePackage.content?.[variantName]?.sourcePathsSha256 !== stringListSha256(paths)) {
        errors.push(`${variantName}/${sourcePackage.id}: corrected Ground source-path evidence is stale`)
      }
      const mappings = []
      for (const path of paths) {
        const exactMappings = migration?.byCorrectedPath?.get(path)
        if (!exactMappings?.length) errors.push(`${variantName}/${sourcePackage.id}: corrected path ${path} has no exact migration mapping`)
        else mappings.push(...exactMappings)
      }
      allPaths.push(...paths)
      packages.push({
        id: `ground-corrected:${sourcePackage.kind}:${sourcePackage.id}`,
        evidenceKind: 'audited-corrected-ground-payload',
        logicalOwner: GROUND_OWNER,
        sourceUnitIds: mappings.map((mapping) => mapping.productionAtomicId).sort(),
        migratedSourceUnitIds: mappings.filter((mapping) => mapping.migration === 'reparented-fire-safety-batch')
          .map((mapping) => mapping.productionAtomicId).sort(),
      })
    }
    const uniquePaths = new Set(allPaths)
    if (allPaths.length !== uniquePaths.size) errors.push(`${variantName}: corrected Ground candidate has overlapping paths`)
    const expectedPaths = new Set(migration?.byCorrectedPath?.keys() || [])
    if (!exactSetEqual(uniquePaths, expectedPaths)) errors.push(`${variantName}: corrected Ground path union is not the exact 149-node migration set`)
    const ownership = index?.completeOwnership?.[variantName]
    if (ownership?.pathCount !== uniquePaths.size || ownership?.pathsSha256 !== stringListSha256([...uniquePaths])) {
      errors.push(`${variantName}: corrected Ground completeOwnership evidence is stale`)
    }
    const audited = audit?.sourceCoverage?.[variantName]
    if (audited?.expectedMeshPaths !== 149 || audited?.completeMeshPaths !== 149 ||
      audited?.completePathsSha256 !== stringListSha256([...uniquePaths])) {
      errors.push(`${variantName}: corrected Ground audit coverage is stale`)
    }
    const sourceIds = packages.flatMap((pkg) => pkg.sourceUnitIds)
    if (sourceIds.length !== 290 || new Set(sourceIds).size !== 290 || !exactSetEqual(new Set(sourceIds), new Set(migration?.productionIds || []))) {
      errors.push(`${variantName}: corrected Ground candidate does not map exactly to 290 production atomic IDs`)
    }
    const migratedIds = packages.flatMap((pkg) => pkg.migratedSourceUnitIds)
    if (migratedIds.length !== 60 || new Set(migratedIds).size !== 60 || !exactSetEqual(new Set(migratedIds), new Set(migration?.fireIds || []))) {
      errors.push(`${variantName}: corrected Ground candidate does not map exactly to 60 authorized fire IDs`)
    }
    claimsByVariant[variantName] = packages
    variants[variantName] = {
      correctedSourcePaths: uniquePaths.size,
      productionAtomicUnits: sourceIds.length,
      originalGroundAtomicUnits: sourceIds.length - migratedIds.length,
      authorizedMigratedFireAtomicUnits: migratedIds.length,
    }
  }
  const blockerList = Array.isArray(audit?.blockers) ? audit.blockers : []
  return {
    accepted: migrationReview.valid && errors.length === 0,
    errors,
    indexSha256: groundCandidate?.indexBytes ? sha256(groundCandidate.indexBytes) : null,
    auditSha256: groundCandidate?.auditBytes ? sha256(groundCandidate.auditBytes) : null,
    payloadSetSha256: audit?.payloadSetSha256 ?? null,
    activationStatus: audit?.activationStatus ?? null,
    blockers: blockerList,
    variants,
    claimsByVariant,
  }
}

function baseWrongOwnerProbe(contract, migrationReview) {
  const claims = {
    schema: WHOLE_LAYER_CLAIMS_SCHEMA,
    version: WHOLE_LAYER_OWNERSHIP_VERSION,
    modelId: contract.modelId,
    coverageContractSha256: contract.coverageDigestSha256,
    variants: Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variantName) => [variantName, {
      sourceSha256: contract.variants[variantName].source.sha256,
      animationTargetsSha256: contract.variants[variantName].animation.targetsSha256,
      packages: [{
        id: `wrong-owner-probe-${variantName}`,
        owner: GROUND_OWNER,
        sourceUnitIds: migrationReview.variants?.[variantName]?.fireIds || [],
      }],
    }])),
  }
  const result = validateWholeLayerPackageClaims(contract, claims)
  return {
    rejected: result.valid === false && result.errors.some((error) => error.includes('wrong owner')),
    wrongOwnerErrorCount: result.errors.filter((error) => error.includes('wrong owner')).length,
    note: 'The unchanged base gate still rejects originally unowned fire IDs claimed directly by Ground; only this separate, pinned plan overlay can authorize the logical migration.',
  }
}

function unownedSegments(unownedPlan, variantName) {
  return {
    repeat: (unownedPlan?.repeatCandidate?.variants?.[variantName]?.batches || []).flatMap((batch) => batch.sourceUnitIds || []),
    fire: unownedPlan?.fireHoseMigration?.variants?.[variantName]?.sourceUnitIds || [],
    static: (unownedPlan?.staticPackages || []).flatMap((pkg) => pkg.variants?.[variantName]?.sourceUnitIds || []),
  }
}

function compactPlanDigest(plan) {
  return sha256(JSON.stringify({
    schema: plan.schema,
    version: plan.version,
    wholeLayerCoverageDigestSha256: plan.wholeLayerCoverageDigestSha256,
    migrationSidecarSha256: plan.migrationSidecarSha256,
    inputs: plan.inputs,
    variants: Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variantName) => [variantName,
      plan.variants[variantName].claims.map((claim) => [
        claim.id,
        claim.logicalOwner,
        stringListSha256(claim.sourceUnitIds),
      ]),
    ])),
  }))
}

export function composeWholeLayerOwnershipPlan({
  contract,
  contractBytes,
  ownerCandidates,
  groundCandidate,
  migration,
  migrationBytes,
  unownedPlan,
  unownedPlanBytes,
}) {
  const errors = []
  const contractBefore = sha256(JSON.stringify(contract))
  const contractValidation = validateWholeLayerOwnershipContract(contract)
  if (!contractValidation.valid) errors.push(...contractValidation.errors.map((error) => `contract: ${error}`))

  const ownerComposition = composeWholeLayerOwnerClaims(contract, ownerCandidates)
  const observedOwners = [...new Set(ownerComposition.review.candidateReviews.map((candidate) => candidate.owner))].sort()
  if (JSON.stringify(observedOwners) !== JSON.stringify([...FOUR_EMITTED_OWNERS].sort())) {
    errors.push('the plan requires exactly the four audited non-Ground animation-owner candidates')
  }
  if (!ownerComposition.review.acceptedCandidates || !ownerComposition.review.noCrossCandidateOverlap) {
    errors.push('four-owner candidate composition is invalid or overlapping')
  }

  const unownedValidation = validateUnownedStaticPlan(unownedPlan, contract)
  if (!unownedValidation.valid) errors.push(...unownedValidation.errors.map((error) => `unowned plan: ${error}`))
  const migrationReview = validateMigration(contract, contractBytes, migration, migrationBytes, unownedPlan)
  errors.push(...migrationReview.errors.map((error) => `migration: ${error}`))
  const groundReview = validateGroundCandidate(contract, groundCandidate, migrationReview)
  errors.push(...groundReview.errors.map((error) => `Ground candidate: ${error}`))
  const baseWrongOwnerGate = baseWrongOwnerProbe(contract, migrationReview)
  if (!baseWrongOwnerGate.rejected) errors.push('base wrong-owner gate no longer rejects direct Ground claims for originally unowned fire IDs')

  const plan = {
    schema: WHOLE_LAYER_LOGICAL_PLAN_SCHEMA,
    version: 1,
    modelId: contract.modelId,
    enabled: false,
    productionModified: false,
    productionRoutingChanged: false,
    runtimeManifestEmitted: false,
    scope: 'plan-level-logical-ownership-only',
    wholeLayerCoverageDigestSha256: contract.coverageDigestSha256,
    migrationSidecarSha256: migrationReview.sha256,
    inputs: {
      contractSha256: contractBytes ? sha256(contractBytes) : null,
      fourOwnerCandidateIndexSha256: ownerComposition.review.candidateReviews.map((candidate) => ({
        owner: candidate.owner,
        sha256: candidate.identity.indexSha256,
      })),
      correctedGroundCandidateIndexSha256: groundReview.indexSha256,
      correctedGroundAuditSha256: groundReview.auditSha256,
      unownedPlanSha256: unownedPlanBytes ? sha256(unownedPlanBytes) : null,
      unownedPlanDigestSha256: unownedPlan?.planDigestSha256 ?? null,
    },
    variants: {},
    planDigestSha256: '',
  }

  const coverageByVariant = {}
  for (const variantName of WHOLE_LAYER_VARIANTS) {
    const claims = []
    for (const pkg of ownerComposition.claims.variants[variantName].packages) claims.push({
      id: pkg.id,
      evidenceKind: 'audited-owner-payload',
      logicalOwner: pkg.owner,
      planOnly: false,
      sourceUnitIds: [...pkg.sourceUnitIds],
    })
    if (groundReview.accepted) claims.push(...groundReview.claimsByVariant[variantName])

    const segments = unownedSegments(unownedPlan, variantName)
    claims.push({
      id: `unowned-repeat-plan:${variantName}`,
      evidenceKind: 'unowned-repeat-plan-only',
      logicalOwner: UNOWNED,
      planOnly: true,
      sourceUnitIds: [...segments.repeat].sort(),
    })
    for (const pkg of unownedPlan?.staticPackages || []) claims.push({
      id: `unowned-static-plan:${pkg.id}:${variantName}`,
      evidenceKind: 'unowned-static-plan-only',
      logicalOwner: UNOWNED,
      planOnly: true,
      sourceUnitIds: [...(pkg.variants?.[variantName]?.sourceUnitIds || [])].sort(),
    })

    const sourceUnits = new Map(contract.variants[variantName].inventory.units.map((unit) => [unit.id, unit]))
    const authorizedFire = migrationReview.valid ? new Set(migrationReview.variants[variantName].fireIds) : new Set()
    const occurrences = new Map()
    const unauthorizedLogicalMoves = []
    const logicalOwnerCounts = new Map()
    for (const claim of claims) {
      logicalOwnerCounts.set(claim.logicalOwner, (logicalOwnerCounts.get(claim.logicalOwner) || 0) + claim.sourceUnitIds.length)
      for (const id of claim.sourceUnitIds) {
        if (!occurrences.has(id)) occurrences.set(id, [])
        occurrences.get(id).push(claim.id)
        const source = sourceUnits.get(id)
        if (!source) unauthorizedLogicalMoves.push({ id, reason: 'unknown-source-unit', claim: claim.id })
        else if (source.owner !== claim.logicalOwner && !(
          source.owner === UNOWNED && claim.logicalOwner === GROUND_OWNER && authorizedFire.has(id)
        )) unauthorizedLogicalMoves.push({ id, reason: `unauthorized-${source.owner}-to-${claim.logicalOwner}`, claim: claim.id })
      }
    }
    const missing = [...sourceUnits.keys()].filter((id) => !occurrences.has(id)).sort()
    const duplicate = [...occurrences].filter(([, claimIds]) => claimIds.length !== 1)
      .map(([id, claimIds]) => ({ id, claimIds })).sort((left, right) => left.id.localeCompare(right.id))
    const migratedInGround = [...authorizedFire].filter((id) =>
      claims.some((claim) => claim.logicalOwner === GROUND_OWNER && claim.sourceUnitIds.includes(id)))
    const migratedInUnowned = [...authorizedFire].filter((id) =>
      claims.some((claim) => claim.logicalOwner === UNOWNED && claim.sourceUnitIds.includes(id)))
    const repeatSet = new Set(segments.repeat)
    const staticSet = new Set(segments.static)
    const fireSet = new Set(segments.fire)
    const fireOverlap = [...fireSet].filter((id) => repeatSet.has(id) || staticSet.has(id))
    const planOnlyUnits = claims.filter((claim) => claim.planOnly).reduce((sum, claim) => sum + claim.sourceUnitIds.length, 0)
    coverageByVariant[variantName] = {
      valid: missing.length === 0 && duplicate.length === 0 && unauthorizedLogicalMoves.length === 0 &&
        migratedInGround.length === 60 && migratedInUnowned.length === 0 &&
        segments.repeat.length === 312 && segments.static.length === 2843 && fireOverlap.length === 0,
      expectedAtomicUnits: sourceUnits.size,
      claimedUniqueAtomicUnits: occurrences.size,
      claimOccurrences: [...occurrences.values()].reduce((sum, ids) => sum + ids.length, 0),
      missingCount: missing.length,
      duplicateCount: duplicate.length,
      unauthorizedLogicalMoveCount: unauthorizedLogicalMoves.length,
      missingSample: missing.slice(0, 20),
      duplicateSample: duplicate.slice(0, 20),
      unauthorizedLogicalMoveSample: unauthorizedLogicalMoves.slice(0, 20),
      originalPartitions: {
        fourAuditedOwners: ownerComposition.review.coverage.variants[variantName].claimedUniqueRenderUnits,
        originalGround: migrationReview.variants[variantName]?.groundIds?.length || 0,
        unownedRepeat: segments.repeat.length,
        migratedFire: segments.fire.length,
        remainingUnownedStatic: segments.static.length,
      },
      logicalOwners: Object.fromEntries([...logicalOwnerCounts].sort(([left], [right]) => left.localeCompare(right))),
      migratedFire: {
        authorizedBySidecar: authorizedFire.size,
        claimedByGround: migratedInGround.length,
        claimedByUnowned: migratedInUnowned.length,
        repeatOrStaticOverlap: fireOverlap.length,
        sourceUnitIdsSha256: stringListSha256([...authorizedFire]),
      },
      unownedPlan: {
        repeatAtomicUnits: segments.repeat.length,
        remainingStaticAtomicUnits: segments.static.length,
        logicalUnownedAtomicUnits: segments.repeat.length + segments.static.length,
        excludedMigratedFireAtomicUnits: migratedInUnowned.length === 0 ? authorizedFire.size : 0,
        planOnlyAtomicUnits: planOnlyUnits,
      },
    }
    plan.variants[variantName] = { claims }
  }
  plan.planDigestSha256 = compactPlanDigest(plan)
  const contractAfter = sha256(JSON.stringify(contract))
  const ownershipPlanComplete = contractValidation.valid && ownerComposition.review.acceptedCandidates &&
    ownerComposition.review.noCrossCandidateOverlap && unownedValidation.valid && migrationReview.valid &&
    groundReview.accepted && baseWrongOwnerGate.rejected &&
    WHOLE_LAYER_VARIANTS.every((variantName) => coverageByVariant[variantName].valid)
  const releaseBlockers = [
    'The unowned repeat and 2,843-unit static partition are plan-only; no self-contained payload GLBs or byte gates exist.',
    'The Ground and other owner shells still require manual multi-angle browser/DCC visual approval.',
    'Shared-texture/network duplication work is not release-complete for every owner payload.',
    'Resident-window, transition, and eviction behavior is not proven for the complete layer.',
    'Physical Web GPU and Quest-class hardware FPS/memory validation is still required.',
    'No runtime manifest was emitted; production routing remains the monolith.',
  ]
  const review = {
    schema: WHOLE_LAYER_LOGICAL_PLAN_REVIEW_SCHEMA,
    version: 1,
    productionModified: false,
    runtimeManifestEmitted: false,
    status: ownershipPlanComplete ? 'ownership-plan-complete-activation-blocked' : 'ownership-plan-invalid-fail-closed',
    ownershipPlanComplete,
    payloadCoverageComplete: false,
    releaseReady: false,
    errors,
    contractUnchanged: contractBefore === contractAfter,
    baseWrongOwnerGate,
    fourOwnerCandidates: ownerComposition.review,
    migration: {
      valid: migrationReview.valid,
      errors: migrationReview.errors,
      sha256: migrationReview.sha256,
      bytes: migrationReview.bytes,
      authorizedFireAtomicUnits: Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variantName) => [
        variantName,
        migrationReview.variants[variantName]?.fireIds?.length || 0,
      ])),
    },
    correctedGroundCandidate: {
      ...groundReview,
      claimsByVariant: undefined,
    },
    unownedPlan: {
      valid: unownedValidation.valid,
      errors: unownedValidation.errors,
      sha256: unownedPlanBytes ? sha256(unownedPlanBytes) : null,
      planDigestSha256: unownedPlan?.planDigestSha256 ?? null,
      activationStatus: unownedPlan?.activationStatus ?? null,
      emittedPayloadByteGateStatus: unownedPlan?.emittedPayloadByteGateStatus ?? null,
      unresolvedReleaseGates: unownedPlan?.unresolvedReleaseGates || [],
    },
    coverage: coverageByVariant,
    releaseBlockers,
  }
  return { plan, review }
}
