import {NEEDS_REVIEW_SCOPE_FILES} from './crm-needs-review-scope.mjs'
// NeedsReview-only release protocol. No credentials or network implementation here.
// The npm deploy launcher supplies the existing scanned composition and CLI driver.
import { createHash } from 'node:crypto'
import { assertReleaseApproval, assertPhaseTransition, needsReviewReleaseDigest } from './crm-needs-review-release-guards.mjs'

export const NEEDS_REVIEW_SCOPE = 'crm-needs-review'
export const NEEDS_REVIEW_TARGET = Object.freeze({
  projectId: 'prj_fWUOXHiMmeE6RXfqgAAKJCi97nrv',
  teamId: 'team_9wCcYQpYqlDlPAaUpCqhWXj9', domain: 'iobjectm.com',
  initialDeploymentId: 'dpl_3htf1ivjg2ajpv1upExZ72GFwN9g',
  initialCommit: 'be1a50d5e410fdd9d3d9e78d72ee4155c7715c19',
})
const hash = value => createHash('sha256').update(value).digest('hex')
const fail = code => { throw Object.assign(Error(code), {code}) }
const requireValue = (ok, code) => { if (!ok) fail(code) }
const sha = value => /^[a-f0-9]{64}$/.test(value || '')
const commit = value => /^[a-f0-9]{40}$/.test(value || '')
export function parseNeedsReviewOperation(argv) {
  if (!argv.some(a => a.startsWith('--crm-needs-review-release'))) return null
  const operation = argv.find(a => a.startsWith('--crm-needs-review-release='))?.split('=')[1]
  requireValue(argv.length === 2 && argv.includes('--scope=crm-needs-review') &&
    argv.includes('--crm-needs-review-release='+operation) &&
    ['plan','verify-install','stage-install','inspect','inspect-journal','promote','rollback'].includes(operation), 'needs_review_release_options_invalid')
  return operation
}
export function verifyNeedsReviewFiles(profile, readFile) {
  requireValue(profile?.version === 1 && profile.scope === NEEDS_REVIEW_SCOPE &&
    profile.target?.projectId === NEEDS_REVIEW_TARGET.projectId &&
    profile.target?.teamId === NEEDS_REVIEW_TARGET.teamId && profile.target?.domain === NEEDS_REVIEW_TARGET.domain,
  'needs_review_profile_target_invalid')
  requireValue(profile.baseline?.id === NEEDS_REVIEW_TARGET.initialDeploymentId &&
    profile.baseline.commit === NEEDS_REVIEW_TARGET.initialCommit, 'needs_review_profile_baseline_invalid')
  requireValue(Array.isArray(profile.files) && profile.files.length > 0, 'needs_review_manifest_empty')
  const exact=NEEDS_REVIEW_SCOPE_FILES.filter(p=>p!=='config/crm-needs-review-release.json')
  requireValue(profile.files.length===exact.length&&profile.files.every(r=>exact.includes(r.path)), 'needs_review_exact_closure_required')
  const paths = new Set()
  for (const row of profile.files) {
    requireValue(typeof row.path === 'string' && !/[\\\x00-\x1f:*?"<>|]/.test(row.path) &&
      row.path.split('/').every(p => p && p !== '.' && p !== '..') && !paths.has(row.path.toLowerCase()) &&
      sha(row.sha256), 'needs_review_manifest_path_invalid')
    paths.add(row.path.toLowerCase())
    requireValue(hash(readFile(row.path)) === row.sha256, 'needs_review_source_digest_changed')
  }
  requireValue(profile.productionApproval === null, 'needs_review_embedded_approval_forbidden')
  return {scope:NEEDS_REVIEW_SCOPE, files:profile.files.length,
    manifestSha256:hash(JSON.stringify(profile)), productionApproved:false}
}
export function disabledNeedsReviewEnv() {
  return {IOM_SKIP_BLOG_SYNC:'true', CRM_NEEDS_REVIEW_ENABLED:'false', CRM_NEEDS_REVIEW_STARTS_ENABLED:'false', CRM_NEEDS_REVIEW_WORKER_ENABLED:'false'}
}
// The committed profile always has productionApproval:null. A separate, local,
// nonsecret owner approval binds its hash and the exact HEAD without self-hashing.
// expected.digests.inventory/provenance are checked again against prepared bytes.
function requireApproval(profile, approval, head, phase, baseline, now) {
  requireValue(approval && approval.expected, 'needs_review_production_approval_missing')
  requireValue(commit(head) && sha(profile.runtimeDigest) && sha(profile.configDigest), 'needs_review_approval_source_mismatch')
  const expected = {...approval.expected, phase, head, baselineDeploymentId:baseline.id,
    digests:{...approval.expected.digests, manifest:hash(JSON.stringify(profile)),
      runtime:profile.runtimeDigest,config:profile.configDigest}}
  requireValue(approval.expected.phase === phase && approval.expected.head === head &&
    approval.expected.baselineDeploymentId === baseline.id &&
    approval.expected.digests?.manifest === expected.digests.manifest &&
    approval.expected.digests?.runtime === expected.digests.runtime &&
    approval.expected.digests?.config === expected.digests.config, 'needs_review_approval_source_mismatch')
  assertReleaseApproval({approval,expected,now})
  requireValue(approval.phaseState?.phase === phase && approval.phaseState.ownerId === expected.ownerId,
    'needs_review_phase_approval_mismatch')
  return expected
}
function sameLive(actual, expected) {
  requireValue(actual?.id === expected.id && actual.projectId === NEEDS_REVIEW_TARGET.projectId &&
    actual.teamId === NEEDS_REVIEW_TARGET.teamId && actual.target === 'production' && actual.readyState === 'READY' &&
    actual.alias?.alias === NEEDS_REVIEW_TARGET.domain && actual.alias?.deploymentId === actual.id &&
    actual.alias?.projectId === NEEDS_REVIEW_TARGET.projectId && !actual.alias.redirect && !actual.alias.deletedAt,
  'needs_review_live_drift')
  requireValue(actual.meta?.iomCommitSha === expected.commit && actual.meta?.iomScopeMap === expected.scopeMap &&
    actual.meta?.iomSnapshotBaseSha === expected.base, 'needs_review_live_provenance_drift')
}
function evidence(record, result) {
  requireValue(result?.id === record.deploymentId && result.readyState === 'READY' &&
    result.projectId === NEEDS_REVIEW_TARGET.projectId && result.teamId === NEEDS_REVIEW_TARGET.teamId &&
    result.meta?.iomNeedsReviewRun === record.run &&
    result.meta?.iomNeedsReviewPhase === record.phase && result.meta?.iomCommitSha === record.head &&
    result.meta?.iomNeedsReviewArtifact === record.artifactDigest, 'needs_review_deployment_binding_invalid')
}
const copy = value => structuredClone(value)
const identity = record => ({id:record.deploymentId,commit:record.head,scopeMap:record.scopeMap,base:record.base})
function foundDeployment(matches) {
  requireValue(Array.isArray(matches) && matches.length === 1 && /^dpl_[A-Za-z0-9]+$/.test(matches[0]?.id || ''),
    'needs_review_creation_unknown_no_retry')
  return matches[0].id
}
function historicalApproval(approval) {
  // Copy only reviewed nonsecret binding/evidence fields, never arbitrary input.
  return Object.fromEntries(['kind','scope','approvalId','target','phase','head','baselineDeploymentId','ownerId',
    'digests','expected','notBefore','expiresAt','startsEnabled','runtimeApproval','planEligibility','senderReadiness',
    'phaseState','consents','evidenceSha256','hostedEvidenceSha256','rollbackCompatible']
    .filter(key => approval[key] !== undefined).map(key => [key,copy(approval[key])]))
}
function inspectionApproval(record, supplied) {
  const historical = {...record.approval,...(record.hostedEvidenceSha256 ? {hostedEvidenceSha256:record.hostedEvidenceSha256} : {})}
  if (!supplied) return historical
  // Hosted readback can only exist after creation. A later, local reviewed pin
  // may accompany inspect without extending the owner's mutation window or
  // changing any approved source/artifact/owner/phase binding.
  requireValue(supplied.expected && supplied.phaseState && record.approval?.expected &&
    needsReviewReleaseDigest(supplied.expected) === needsReviewReleaseDigest(record.approval.expected) &&
    needsReviewReleaseDigest(supplied.phaseState) === needsReviewReleaseDigest(record.phaseState),
    'needs_review_inspection_binding_changed')
  if (supplied.hostedEvidenceSha256 === undefined) return historical
  requireValue(sha(supplied.hostedEvidenceSha256), 'needs_review_hosted_evidence_pin_invalid')
  return {...historical,hostedEvidenceSha256:supplied.hostedEvidenceSha256}
}
function remember(driver,state,change,event,now) {
  const persisted = driver.loadState()
  const markerNames = ['pushInvoked','createInvoked','promoteInvoked','rollbackInvoked']
  const protocolState = value => value ? Object.fromEntries(Object.entries(value).filter(([key]) => !markerNames.includes(key))) : null
  requireValue(needsReviewReleaseDigest(protocolState(persisted)) === needsReviewReleaseDigest(protocolState(state)),
    'needs_review_journal_changed')
  const markers = Object.fromEntries(markerNames.filter(key => persisted?.[key] !== undefined).map(key => [key,persisted[key]]))
  const archived = change.candidate || change.previousCandidate
  const entry = {event,at:now,...(archived ? {record:copy(archived)} : {}),...(change.live ? {live:copy(change.live)} : {})}
  const next = {...copy(state || {}),...markers,...copy(change),history:[...copy(state?.history || []),entry]}
  driver.saveState(next)
  return next
}
function promotedState(driver,state,record,now) {
  return remember(driver,state,{pending:false,promoted:true,rolledBack:false,phase:record.phase,
    previousCandidate:record,candidate:null,live:identity(record),phaseState:record.phaseState},'PROMOTED',now)
}
function rolledBackState(driver,state,record,now) {
  // Preserve both the deployed candidate and all prior journal events. Never
  // make a rollback look like a fresh installation or an approved next phase.
  return remember(driver,state,{pending:false,rolledBack:true,promoted:false,candidate:null,
    previousCandidate:record,live:record.baseline},'ROLLED_BACK',now)
}
// The driver must reserve/persist state before each external mutation. Unknown
// results are reconciled through inspect; no deploy/promote/rollback is retried.
export function runNeedsReviewRelease({operation, profile, head, driver, approval=null, now, clock=Date.now}) {
  requireValue(['plan','verify-install','stage-install','inspect','promote','rollback'].includes(operation),
    'needs_review_release_operation_invalid')
  const local = verifyNeedsReviewFiles(profile, driver.readFile)
  if (operation === 'plan') return {...local, executed:false, baseline:profile.baseline,
    phases:['install-disabled'], blockers:[
      'owner_production_approval_missing',
      'fresh_baseline_and_inventory_required','sender_metadata_required','plan_eligibility_required',
      'this_adapter_cannot_enable_oauth_or_sending'], startsEnabled:false}
  // Fail before even reading provider metadata if mutation approval is absent.
  if (operation !== 'inspect' && !operation.startsWith('verify-')) requireValue(approval !== null, 'needs_review_production_approval_missing')
  requireValue(typeof driver.withLock === 'function', 'needs_review_exclusive_local_lock_required')
  const currentTime = () => now === undefined ? clock() : now
  return driver.withLock(() => runLocked({operation,profile,head,driver,approval,now:currentTime(),clock:currentTime}))
}
function runLocked({operation,profile,head,driver,approval,now,clock}) {
  const loaded = driver.loadState()
  let state = loaded ? copy(loaded) : null
  if (operation.startsWith('verify-')) {
    requireValue(commit(head) && sha(profile.runtimeDigest) && sha(profile.configDigest), 'needs_review_verification_source_invalid')
    requireValue(!state?.pending && !state?.failed && !state?.candidate, 'needs_review_existing_or_uncertain_operation')
    const phase = operation === 'verify-install' ? 'install-disabled' : 'bound-disabled'
    const expected = phase === 'install-disabled' ? profile.baseline : state?.live
    requireValue(expected && (phase === 'install-disabled' ? !state : state.phase === 'install-disabled' && state.promoted) &&
      !state?.rolledBack, 'needs_review_phase_sequence_invalid')
    const current = driver.live({verificationOnly:true})
    sameLive(current,expected)
    const artifact = driver.verifyArtifact({head,phase,baseline:current,env:disabledNeedsReviewEnv()})
    requireValue(artifact?.scope === NEEDS_REVIEW_SCOPE && artifact.checked === true &&
      ['digest','inventoryDigest','provenanceDigest','baselineInventoryDigest','baselineProvenanceDigest']
        .every(key => sha(artifact[key])), 'needs_review_artifact_unverified')
    const allowed = new Set([...profile.files.map(row=>row.path),'config/crm-needs-review-release.json'])
    const seen = new Set()
    requireValue(Array.isArray(artifact.uploadFiles) && artifact.uploadFiles.length > 0 && artifact.uploadFiles.every(row=>{
      if (!row || !allowed.has(row.path) || !/^[a-f0-9]{40}$/.test(row.sha1 || '') || seen.has(row.path.toLowerCase()) ||
          Object.keys(row).sort().join(',') !== 'path,sha1') return false
      seen.add(row.path.toLowerCase());return true
    }), 'needs_review_review_inventory_invalid')
    sameLive(driver.live({verificationOnly:true}),expected)
    // This is candidate evidence, not authorization. The runtime source pin can
    // still be null; reviewed materialization changes HEAD and requires a new
    // verification. No state reservation, push, upload or deploy occurs here.
    return {status:'VERIFIED_FOR_REVIEW',scope:NEEDS_REVIEW_SCOPE,phase,head,baseline:copy(expected),
      manifestSha256:hash(JSON.stringify(profile)),runtimeDigest:profile.runtimeDigest,configDigest:profile.configDigest,
      startsEnabled:false,productionApproved:false,mutationExecuted:false,artifact:copy(artifact),
      runtimeSourcePins:'requires_separate_review_before_install'}
  }
  if (operation.startsWith('stage-')) {
    requireValue(!state?.pending && !state?.failed && !state?.candidate, 'needs_review_existing_or_uncertain_operation')
    const phase = operation === 'stage-install' ? 'install-disabled' : 'bound-disabled'
    const expected = phase === 'install-disabled' ? profile.baseline : state?.live
    requireValue(expected && (phase === 'install-disabled' ? !state : state.phase === 'install-disabled' && state.promoted),
      'needs_review_phase_sequence_invalid')
    requireValue(!state?.rolledBack, 'needs_review_phase_sequence_invalid')
    const approved = requireApproval(profile,approval,head,phase,expected,now)
    const previousPhase = state?.phaseState || null
    assertPhaseTransition({previous:previousPhase,next:approval.phaseState,consents:approval.consents,now})
    const current = driver.live()
    sameLive(current, expected)
    if (phase === 'bound-disabled') requireValue(driver.verifyConsents(approval.consents,now) === true,
      'needs_review_live_consents_unverified')
    const preflight = driver.preflight({head, phase, approval, baseline:current})
    requireValue(preflight?.runtimeDigest === approved.digests.runtime && preflight?.configDigest === approved.digests.config,
      'needs_review_preflight_binding_mismatch')
    // prepare must run complete build/scanner/R2 checks and exact inventory delta,
    // then call submit with the sealed artifact. It may not deploy on its own.
    let submitted = false
    return driver.prepare({phase, head, baseline:current, env:disabledNeedsReviewEnv(), submit:artifact => {
      requireValue(!submitted, 'needs_review_submission_already_attempted')
      submitted = true // even a failed/uncertain attempt cannot be submitted again
      requireValue(sha(artifact.digest) && artifact.checked === true && artifact.scope === NEEDS_REVIEW_SCOPE,
        'needs_review_artifact_unverified')
      requireValue(artifact.inventoryDigest === approved.digests.inventory &&
        artifact.provenanceDigest === approved.digests.provenance &&
        sha(artifact.baselineInventoryDigest) && sha(artifact.baselineProvenanceDigest), 'needs_review_artifact_binding_mismatch')
      requireApproval(profile,approval,head,phase,expected,clock())
      assertPhaseTransition({previous:previousPhase,next:approval.phaseState,consents:approval.consents,now:clock()})
      sameLive(driver.live(), expected)
      const record = {version:1,run:driver.runId(),head,phase,baseline:expected,artifactDigest:artifact.digest,
        scopeMap:artifact.scopeMap,base:artifact.base,deploymentId:null,createdAt:now,
        inventoryDigest:artifact.inventoryDigest,provenanceDigest:artifact.provenanceDigest,
        baselineInventoryDigest:artifact.baselineInventoryDigest,baselineProvenanceDigest:artifact.baselineProvenanceDigest,
        manifestDigest:approved.digests.manifest,previousPhase,phaseState:copy(approval.phaseState),approval:historicalApproval(approval)}
      state = remember(driver,state,{candidate:record,pending:'CREATE_UNKNOWN'},'CREATE_RESERVED',now)
      driver.pushReviewed({head, artifact})
      requireApproval(profile,approval,head,phase,expected,clock())
      sameLive(driver.live(), expected)
      driver.create({record,artifact,env:disabledNeedsReviewEnv()})
      // Creation is reconciled by immutable metadata even on a successful CLI exit.
      record.deploymentId = foundDeployment(driver.findCreated(record))
      state = remember(driver,state,{candidate:record,pending:'VERIFY_REQUIRED'},'CREATED',now)
      return {status:'CREATED_NOT_PROMOTED',id:record.deploymentId,phase}
    }})
  }
  const savedRecord = state?.candidate || ((operation === 'rollback' || operation === 'inspect') && state?.previousCandidate)
  const record = savedRecord ? copy(savedRecord) : null
  requireValue(record, 'needs_review_record_missing')
  requireValue(record.head === head, 'needs_review_record_source_changed')
  requireValue(record.manifestDigest === hash(JSON.stringify(profile)), 'needs_review_record_manifest_changed')
  if (operation === 'inspect') {
    const readbackApproval = inspectionApproval(record,approval)
    const current = driver.live()
    if (!record.deploymentId) {
      record.deploymentId = foundDeployment(driver.findCreated(record))
    }
    const result = driver.deployment(record.deploymentId)
    evidence(record,result)
    if (state.pending === 'ROLLBACK_UNKNOWN') {
      sameLive(current,record.baseline)
      rolledBackState(driver,state,record,now)
      return {status:'ROLLED_BACK',id:current.id}
    }
    if (state.rolledBack) { sameLive(current,record.baseline); return {status:'ROLLED_BACK',id:current.id} }
    const promoted = state.pending === 'PROMOTE_UNKNOWN' || (state.promoted && !state.candidate)
    sameLive(current,promoted ? identity(record) : record.baseline)
    // Reconciliation reads historical bindings; expiry never authorizes a new
    // mutation and does not prevent discovering an already submitted outcome.
    requireValue(driver.verifyHosted({record,result,approval:readbackApproval}) === true, 'needs_review_hosted_evidence_missing')
    record.verified = true
    record.hostedEvidenceSha256 = readbackApproval.hostedEvidenceSha256
    if (promoted) {
      if (state.pending) promotedState(driver,state,record,now)
    } else remember(driver,state,{candidate:record,pending:false},'VERIFIED',now)
    return {status:promoted?'PROMOTED':'VERIFIED_NOT_PROMOTED',id:result.id}
  }
  requireValue(!state.pending && record.verified === true, 'needs_review_verification_required')
  requireValue(!state.rolledBack, 'needs_review_already_rolled_back')
  const approved = requireApproval(profile,approval,head,record.phase,record.baseline,now)
  requireValue(approved.digests.inventory === record.inventoryDigest && approved.digests.provenance === record.provenanceDigest,
    'needs_review_approval_artifact_mismatch')
  requireValue(hash(JSON.stringify(approval.phaseState)) === hash(JSON.stringify(record.phaseState)), 'needs_review_phase_approval_mismatch')
  // Restoring an already reviewed predecessor is not a new consent transition.
  // In particular, revoked/expired grants must not prevent a separately approved,
  // conditional rollback. New stage/promote operations still require live grants.
  if (operation === 'promote') {
    requireValue(sha(record.hostedEvidenceSha256) && approval.hostedEvidenceSha256 === record.hostedEvidenceSha256,
      'needs_review_promotion_evidence_pin_changed')
    assertPhaseTransition({previous:record.previousPhase,next:approval.phaseState,consents:approval.consents,now})
    if (record.phase === 'bound-disabled') requireValue(driver.verifyConsents(approval.consents,now) === true,
      'needs_review_live_consents_unverified')
  }
  const current = driver.live()
  if (operation === 'promote') {
    requireValue(state.candidate, 'needs_review_already_promoted')
    sameLive(current,record.baseline)
    const result = driver.deployment(record.deploymentId)
    evidence(record,result)
    requireValue(driver.verifyHosted({record,result,approval}) === true,
      'needs_review_hosted_evidence_missing')
    sameLive(driver.live(),record.baseline)
    requireApproval(profile,approval,head,record.phase,record.baseline,clock())
    state = remember(driver,state,{pending:'PROMOTE_UNKNOWN'},'PROMOTE_RESERVED',now)
    driver.promote(record.deploymentId)
    sameLive(driver.live(),identity(record))
    requireApproval(profile,approval,head,record.phase,record.baseline,clock())
    promotedState(driver,state,record,now)
    return {status:'PROMOTED_STARTS_DISABLED',id:record.deploymentId}
  }
  if (operation === 'rollback') {
    requireValue(approval.rollbackCompatible === true, 'needs_review_rollback_database_compatibility_unverified')
    requireValue(state.promoted && !state.candidate, 'needs_review_rollback_requires_promoted_record')
    sameLive(current,identity(record))
    evidence(record,driver.deployment(record.deploymentId))
    requireValue(driver.verifyRollbackTarget(record) === true, 'needs_review_rollback_target_unverified')
    sameLive(driver.live(),identity(record))
    requireApproval(profile,approval,head,record.phase,record.baseline,clock())
    state = remember(driver,state,{pending:'ROLLBACK_UNKNOWN'},'ROLLBACK_RESERVED',now)
    driver.rollback(record.baseline.id)
    sameLive(driver.live(),record.baseline)
    rolledBackState(driver,state,record,now)
    return {status:'ROLLED_BACK',id:record.baseline.id}
  }
  fail('needs_review_release_operation_invalid')
}
