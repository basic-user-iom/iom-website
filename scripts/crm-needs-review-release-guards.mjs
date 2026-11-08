import { createHash } from 'node:crypto'

// Pure validators only: no filesystem, environment, clock, service or deployment.
// The orchestrator must obtain genuine observations/approval through supported
// access. Checking an attestation's bindings does NOT authenticate its origin or
// turn synthetic metadata into live proof. Every time check receives explicit now.
export const NEEDS_REVIEW_RELEASE_TARGET = Object.freeze({
  projectId: 'prj_fWUOXHiMmeE6RXfqgAAKJCi97nrv',
  teamId: 'team_9wCcYQpYqlDlPAaUpCqhWXj9', domain: 'iobjectm.com',
})
export const NEEDS_REVIEW_RELEASE_SCOPE = 'crm-needs-review'
export const NEEDS_REVIEW_RELEASE_PHASES = Object.freeze(['install-disabled'])
export const NEEDS_REVIEW_RELEASE_SCOPES=Object.freeze(['iom:crm:email:read','iom:crm:email:send','iom:crm:email:batch:confirm'])
const SENDERS=['projects']
const SHA1 = /^[a-f0-9]{40}$/, SHA256 = /^[a-f0-9]{64}$/
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const DEPLOYMENT = /^dpl_[A-Za-z0-9]+$/
const DIGESTS = ['manifest', 'inventory', 'provenance', 'runtime', 'config']
const fail = code => { throw Object.assign(Error(code), { code }) }
const check = (value, code) => { if (!value) fail(code) }
const plain = value => value && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))
const exactKeys = (value, names) => plain(value) && Object.keys(value).sort().join('\0') === [...names].sort().join('\0')
const canonical = value => Array.isArray(value) ? value.map(canonical) : plain(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
export const needsReviewReleaseDigest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
function time(value) {
  check(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'needs_review_release_time_invalid')
  return Date.parse(value)
}
function clock(now) { check(Number.isSafeInteger(now) && now > 0, 'needs_review_release_explicit_now_required'); return now }
function fresh(evidence, now) {
  check(plain(evidence) && SHA256.test(evidence.evidenceSha256 || ''), 'needs_review_release_evidence_required')
  const observed = time(evidence.observedAt), expires = time(evidence.expiresAt)
  check(observed <= now && now - observed <= 30 * 60_000 && expires > now && expires > observed,
    'needs_review_release_evidence_stale')
}
function target(value) {
  check(plain(value) && Object.entries(NEEDS_REVIEW_RELEASE_TARGET).every(([key, expected]) => value[key] === expected),
    'needs_review_release_wrong_target')
}
function deployment(value) {
  target(value)
  check(DEPLOYMENT.test(value.id || '') && value.target === 'production' && value.readyState === 'READY',
    'needs_review_release_ready_production_required')
}
function safePath(value) {
  return typeof value === 'string' && value.length <= 512 && !/[\\\x00-\x1f:*?"<>|]/.test(value) &&
    value.split('/').every(part => part && part !== '.' && part !== '..' && !/[ .]$/.test(part))
}
function inventory(rows) {
  check(Array.isArray(rows) && rows.length > 0 && rows.length <= 15000, 'needs_review_release_inventory_required')
  const seen = new Set()
  const normalized = rows.map(row => {
    check(exactKeys(row, ['path', 'sha1']) && safePath(row.path) && SHA1.test(row.sha1), 'needs_review_release_inventory_row_invalid')
    check(!seen.has(row.path.toLowerCase()), 'needs_review_release_duplicate_path')
    seen.add(row.path.toLowerCase()); return { path: row.path, sha1: row.sha1 }
  })
  return normalized.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}

const RECEIPT_PATH = '.iom-r2-release.json'
function provenReceipt(value) {
  if (value === undefined) return null
  check(exactKeys(value, ['path', 'baselineSha1', 'candidateSha1']) && value.path === RECEIPT_PATH &&
    SHA1.test(value.baselineSha1) && SHA1.test(value.candidateSha1), 'needs_review_release_receipt_proof_invalid')
  return value
}

// All three arrays contain {path,sha1}. allowedFiles is the exact reviewed output
// manifest, not a glob/permission expansion; every listed file must match bytes.
// receipt, when present, is the sha1 pair of buffers that already passed the
// field-by-field media proof. It can excuse only that one path.
export function assertScopedInventory({ baseline, candidate, allowedFiles, receipt }) {
  const before = inventory(baseline), after = inventory(candidate), allowed = inventory(allowedFiles)
  const old = new Map(before.map(row => [row.path, row.sha1])), next = new Map(after.map(row => [row.path, row.sha1]))
  const permits = new Map(allowed.map(row => [row.path, row.sha1]))
  const proof = provenReceipt(receipt)
  if (proof) check(old.get(proof.path) === proof.baselineSha1 && next.get(proof.path) === proof.candidateSha1,
    'needs_review_release_receipt_proof_invalid')
  for (const [path, sha1] of old) {
    check(next.has(path), 'needs_review_release_removal_forbidden')
    if (!permits.has(path)) {
      const proven = proof && path === proof.path && sha1 === proof.baselineSha1 && next.get(path) === proof.candidateSha1
      check(next.get(path) === sha1 || proven, 'needs_review_release_unrelated_file_changed')
    }
  }
  for (const [path] of next) check(old.has(path) || permits.has(path), 'needs_review_release_unlisted_file_added')
  for (const [path, sha1] of permits) check(next.get(path) === sha1, 'needs_review_release_manifest_bytes_mismatch')
  return { beforeDigest: needsReviewReleaseDigest(before), afterDigest: needsReviewReleaseDigest(after),
    manifestDigest: needsReviewReleaseDigest(allowed),
    changed: after.filter(row => old.get(row.path) !== row.sha1).map(row => row.path) }
}

function composition(value) {
  check(plain(value) && SHA1.test(value.base || '') && Array.isArray(value.overlays) && value.overlays.length > 0,
    'needs_review_release_composition_required')
  const names = new Set()
  for (const entry of value.overlays) {
    check(Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' &&
      /^(?:[a-z][a-z0-9-]*|(?:demo|project):[a-z0-9][a-z0-9-]*)$/.test(entry[0]) && entry[0] !== 'site' &&
      SHA1.test(entry[1]) && !names.has(entry[0]), 'needs_review_release_overlay_invalid')
    names.add(entry[0])
  }
}
// Ordered [scope,commit] arrays preserve inherited precedence, including Storm.
export function assertOverlayPreservation({ baseline, candidate, head }) {
  composition(baseline); composition(candidate)
  check(SHA1.test(head || ''), 'needs_review_release_head_invalid')
  check(candidate.base === baseline.base, 'needs_review_release_base_changed')
  const expected = baseline.overlays.map(([scope, commit]) => [scope, scope === NEEDS_REVIEW_RELEASE_SCOPE ? head : commit])
  if (!expected.some(([scope]) => scope === NEEDS_REVIEW_RELEASE_SCOPE)) expected.push([NEEDS_REVIEW_RELEASE_SCOPE, head])
  check(equal(candidate.overlays, expected), 'needs_review_release_inherited_overlay_changed')
  return { base: candidate.base, overlays: candidate.overlays.map(entry => [...entry]), digest: needsReviewReleaseDigest(candidate) }
}

// current is normalized fresh provider metadata; expected.id is the reviewed alias.
export function assertCurrentBaseline({ expected, current }) {
  check(plain(expected) && DEPLOYMENT.test(expected.id || ''), 'needs_review_release_baseline_required')
  deployment(current)
  check(current.id === expected.id, 'needs_review_release_baseline_changed')
  return current.id
}

// expected: {phase,head,baselineDeploymentId,ownerId,digests:{manifest,inventory,
// provenance,runtime,config}}. Approval also supplies target/scope, approvalId,
// notBefore/expiresAt, startsEnabled:false and fresh evidence described in tests.
export function assertReleaseApproval({ approval, expected, now }) {
  clock(now)
  check(plain(expected) && NEEDS_REVIEW_RELEASE_PHASES.includes(expected.phase) && SHA1.test(expected.head || '') &&
    DEPLOYMENT.test(expected.baselineDeploymentId || '') && UUID.test(expected.ownerId || '') &&
    exactKeys(expected.digests, DIGESTS) && Object.values(expected.digests).every(value => SHA256.test(value)),
    'needs_review_release_expected_binding_invalid')
  check(plain(approval) && approval.kind === 'crm-needs-review-release-approval-v1' &&
    approval.scope === NEEDS_REVIEW_RELEASE_SCOPE && typeof approval.approvalId === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(approval.approvalId), 'needs_review_release_specific_approval_required')
  target(approval.target)
  check(approval.phase === expected.phase && approval.head === expected.head &&
    approval.baselineDeploymentId === expected.baselineDeploymentId && approval.ownerId === expected.ownerId &&
    exactKeys(approval.digests, DIGESTS) && equal(approval.digests, expected.digests), 'needs_review_release_approval_binding_mismatch')
  const start = time(approval.notBefore), end = time(approval.expiresAt)
  check(start <= now && now < end && end > start && end-start <= 30*60_000, 'needs_review_release_approval_expired_or_pending')
  check(approval.startsEnabled === false, 'needs_review_release_starts_must_remain_disabled')
  const runtime = approval.runtimeApproval
  fresh(runtime, now)
  check(runtime.present === false && runtime.nonsecret === true && runtime.validated === true &&
    runtime.sha256 === expected.digests.runtime, 'needs_review_release_runtime_approval_required')
  const plan = approval.planEligibility
  fresh(plan, now)
  check(plan.planEligible === true && plan.noPaidChange === true &&
    ['owner-confirmation', 'provider-metadata'].includes(plan.source), 'needs_review_release_plan_eligibility_required')
  target(plan.target)
  check(Array.isArray(approval.senderReadiness) && approval.senderReadiness.length === 1, 'needs_review_release_both_senders_required')
  for (const sender of SENDERS) {
    const matches = approval.senderReadiness.filter(row => row?.fromIdentity === sender)
    check(matches.length === 1, 'needs_review_release_both_senders_required')
    const row = matches[0]; fresh(row, now)
    check(row.source === 'metadata-only-sender-check' && row.ownerId === expected.ownerId && row.configured === true &&
      row.fromEmail === `${sender}@iobjectm.com` &&
      row.fromHeader === `IOM ${sender === 'projects' ? 'Projects' : 'Visual'} <${sender}@iobjectm.com>`,
      'needs_review_release_sender_not_ready')
  }
  return { phase: approval.phase, approvalId: approval.approvalId, expiresAt: approval.expiresAt,
    evidenceValidatedAsAttestationsOnly: true }
}

// First install has previous null. A later site update may continue only from the
// same inactive install shape. Starts, consents, and any other phase stay refused.
function inactiveInstall(value) {
  return exactKeys(value, ['phase','startsEnabled','ownerId']) && value.phase==='install-disabled' &&
    value.startsEnabled===false && UUID.test(value.ownerId||'')
}
export function assertPhaseTransition({previous,next,consents,now}) {
  clock(now)
  const nextOk = inactiveInstall(next) && consents===undefined
  const first = previous===null
  const successor = inactiveInstall(previous) && previous.ownerId===next?.ownerId
  check(nextOk && (first || successor), 'needs_review_inactive_install_only')
  return {phase:next.phase,startsEnabled:false}
}

// No rollback side effect. The caller must inspect uncertain outcomes first.
// A newer alias, even in the same project, always blocks this recorded rollback.
export function assertConditionalRollback({ record, current, restoreTarget }) {
  check(plain(record) && record.scope === NEEDS_REVIEW_RELEASE_SCOPE && NEEDS_REVIEW_RELEASE_PHASES.includes(record.phase) &&
    DEPLOYMENT.test(record.activationDeploymentId || '') && DEPLOYMENT.test(record.rollbackDeploymentId || '') &&
    record.activationDeploymentId !== record.rollbackDeploymentId && SHA1.test(record.activationHead || '') &&
    SHA256.test(record.activationInventoryDigest || '') && SHA256.test(record.rollbackInventoryDigest || '') &&
    SHA256.test(record.activationProvenanceDigest || '') && SHA256.test(record.rollbackProvenanceDigest || ''),
    'needs_review_release_rollback_record_invalid')
  target(record.target); deployment(current); deployment(restoreTarget)
  check(current.id === record.activationDeploymentId && current.head === record.activationHead &&
    current.scope === NEEDS_REVIEW_RELEASE_SCOPE && current.phase === record.phase &&
    current.inventoryDigest === record.activationInventoryDigest && current.provenanceDigest === record.activationProvenanceDigest,
    'needs_review_release_rollback_current_changed')
  check(restoreTarget.id === record.rollbackDeploymentId && restoreTarget.inventoryDigest === record.rollbackInventoryDigest &&
    restoreTarget.provenanceDigest === record.rollbackProvenanceDigest, 'needs_review_release_rollback_target_changed')
  return { conditional: true, from: current.id, to: restoreTarget.id }
}
