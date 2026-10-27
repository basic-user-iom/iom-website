// Pure, local release preparation. No filesystem, network, credentials or deployment.
import { createHash } from 'node:crypto'

export const RELEASE_BINDING = Object.freeze({
  projectId: 'prj_fWUOXHiMmeE6RXfqgAAKJCi97nrv',
  currentId: 'dpl_C5o1HEzRTwe8F5T3APau2F4SWUA3',
  predecessorId: 'dpl_2wKobF1NFMj6X7hnA2YPyKK4Da1w',
  base: '0d518e0c907c2859cddcf90890d3cb780ea310ac',
  pluginCommit: '515d4b6eb54d7da53600d898828bcc802a5ec4d4',
  storeCommit: '62e0632538666658c95ef212b65209711c5b06ab',
  storePath: 'api/_lib/crm-email-store.mjs',
  storeSha256: '581e7f89834e0783c0c748986c2bdd2a01e389c2d31f6aa902a96b0963c1e523',
  storeSha1: 'ef44a08d1a0f723709eab6327a6957e3344521fa',
  previousStoreSha1: 'c19b97ec0f6f7f9342a3e78b97405ac880abcd61',
  storeBytes: 18539,
  beforeInventoryDigest: '14eebcbd75bac11d9a46fe4c0c2dd97336ff58c3794b4078dd2d73a180cb35f5',
  currentInventoryDigest: 'aca0727c8713315609383163d9613213f1a98b244b8122a9d83ba01b5d426aab',
  predecessorMapDigest: '6bf9ab131c34a6aa97d1af3499a422434709f9f667e7e89bdb84d49c2add4154',
  inventoryCount: 1191,
})
const B = RELEASE_BINDING
const sha = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest('hex')
const commitPattern = /^[a-f0-9]{40}$/
const digestPattern = /^[a-f0-9]{64}$/
const deploymentPattern = /^dpl_[A-Za-z0-9]+$/
function check(ok, code) { if (!ok) { const error = new Error(code); error.code = code; throw error } }
function keys(value, names, code = 'provenance_shape_invalid') {
  check(value && typeof value === 'object' && !Array.isArray(value), code)
  check(Object.keys(value).sort().join('\0') === [...names].sort().join('\0'), code)
}
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value
export const provenanceDigest = descriptor => sha(JSON.stringify(canonical(descriptor)))
function safePath(value) {
  return typeof value === 'string' && value.length <= 512 && !/[\\\x00-\x1f:*?"<>|]/.test(value) &&
    value.split('/').every(part => part && part !== '.' && part !== '..' && !/[ .]$/.test(part))
}
function scopeNames(allowedScopes) {
  check(Array.isArray(allowedScopes) && allowedScopes.length && new Set(allowedScopes).size === allowedScopes.length,
    'scope_registry_invalid')
  check(allowedScopes.every(s => typeof s === 'string' && /^(?:[a-z][a-z0-9-]*|(?:demo|project):[a-z0-9][a-z0-9-]*)$/.test(s)), 'scope_registry_invalid')
  return new Set(allowedScopes)
}
export function decodeScopeMap(encoded, allowedScopes) {
  const known = scopeNames(allowedScopes)
  check(typeof encoded === 'string' && encoded.length > 0 && encoded.length <= 16000 && /^[A-Za-z0-9_-]+$/.test(encoded), 'scope_map_missing_or_invalid')
  const bytes = Buffer.from(encoded, 'base64url')
  check(bytes.toString('base64url') === encoded, 'scope_map_noncanonical')
  let text, parsed
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); parsed = JSON.parse(text) }
  catch { check(false, 'scope_map_invalid_json') }
  check(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'scope_map_invalid_object')
  // Exact round-trip also rejects duplicate JSON keys and preserves overlay order.
  check(JSON.stringify(parsed) === text, 'scope_map_noncanonical')
  const entries = Object.entries(parsed)
  check(entries.length > 0 && entries.length <= 100, 'scope_map_empty_or_oversized')
  for (const [scope, commit] of entries) {
    check(known.has(scope), 'scope_map_unknown_scope')
    check(typeof commit === 'string' && commitPattern.test(commit), 'scope_map_invalid_commit')
  }
  return entries
}
export function encodeScopeMap(entries, allowedScopes) {
  check(Array.isArray(entries) && entries.every(e => Array.isArray(e) && e.length === 2) &&
    new Set(entries.map(e => e[0])).size === entries.length, 'scope_map_duplicate_scope')
  const encoded = Buffer.from(JSON.stringify(Object.fromEntries(entries))).toString('base64url')
  decodeScopeMap(encoded, allowedScopes)
  return encoded
}
function inventory(input) {
  check(Array.isArray(input) && input.length > 0 && input.length <= 15000, 'inventory_missing')
  const seen = new Set()
  const result = input.map(row => {
    keys(row, ['path', 'sha1'], 'inventory_row_invalid')
    check(safePath(row.path) && commitPattern.test(row.sha1), 'inventory_row_invalid')
    check(!seen.has(row.path.toLowerCase()), 'inventory_duplicate_path')
    seen.add(row.path.toLowerCase())
    return { path: row.path, sha1: row.sha1 }
  })
  return result.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}
export function compareInventories(beforeInput, afterInput) {
  const before = inventory(beforeInput), after = inventory(afterInput)
  const old = new Map(before.map(row => [row.path, row.sha1])), next = new Map(after.map(row => [row.path, row.sha1]))
  return {
    beforeCount: before.length, afterCount: after.length,
    beforeDigest: sha(JSON.stringify(before)), afterDigest: sha(JSON.stringify(after)),
    changed: [...new Set([...old.keys(), ...next.keys()])].filter(p => old.get(p) !== next.get(p)).sort()
      .map(path => ({ path, before: old.get(path) ?? null, after: next.get(path) ?? null })),
  }
}
function assertLive(deployment, expectedId) {
  check(deployment?.id === expectedId && deployment.projectId === B.projectId && deployment.target === 'production' &&
    deployment.readyState === 'READY', 'live_deployment_binding_mismatch')
  check(deployment.meta?.iomSnapshotBaseSha === B.base && deployment.meta.iomCommitSha === B.pluginCommit, 'live_source_binding_mismatch')
}
function assertDescriptor(descriptor, digest, allowedScopes) {
  keys(descriptor, ['version','projectId','deploymentId','parentDeploymentId','base','pluginCommit','scopeMap','inventory','store','parentRelease'])
  check(descriptor.version === 1 && descriptor.projectId === B.projectId && descriptor.deploymentId === B.currentId &&
    descriptor.parentDeploymentId === B.predecessorId && descriptor.base === B.base && descriptor.pluginCommit === B.pluginCommit, 'descriptor_binding_mismatch')
  keys(descriptor.inventory, ['beforeDigest','currentDigest','count'])
  check(descriptor.inventory.beforeDigest === B.beforeInventoryDigest && descriptor.inventory.currentDigest === B.currentInventoryDigest &&
    descriptor.inventory.count === B.inventoryCount, 'descriptor_inventory_mismatch')
  keys(descriptor.store, ['path','commit','sha1','sha256','bytes'])
  check(descriptor.store.path === B.storePath && descriptor.store.commit === B.storeCommit && descriptor.store.sha1 === B.storeSha1 &&
    descriptor.store.sha256 === B.storeSha256 && descriptor.store.bytes === B.storeBytes, 'descriptor_store_mismatch')
  keys(descriptor.parentRelease, ['deploymentId','kind','phase'])
  check(descriptor.parentRelease.deploymentId === B.predecessorId && descriptor.parentRelease.kind === 'upgrade' &&
    descriptor.parentRelease.phase === 'ACTIVE', 'descriptor_parent_release_mismatch')
  const entries = decodeScopeMap(descriptor.scopeMap, allowedScopes)
  check(entries.length === 21 && entries.at(-1)[0] === 'crm-email-store' && entries.at(-1)[1] === B.storeCommit, 'store_overlay_missing_or_reordered')
  check(sha(JSON.stringify(Object.fromEntries(entries.slice(0, -1)))) === B.predecessorMapDigest, 'descriptor_parent_map_mismatch')
  check(new Map(entries).get('crm-email') === B.pluginCommit, 'plugin_overlay_mismatch')
  check(digestPattern.test(digest || '') && provenanceDigest(descriptor) === digest, 'descriptor_digest_mismatch')
  return entries
}
export function reconstructCurrentRelease(input, allowedScopes) {
  const { current, predecessor, beforeInventory, currentInventory, storeCommit, storeCommitFiles, storeBytes } = input
  assertLive(current, B.currentId); assertLive(predecessor, B.predecessorId)
  check(current.meta.iomDeployScope === 'crm-store-file' && current.meta.iomRollbackDeployment === B.predecessorId &&
    ['iomScopeMap','iomReleaseKind','iomReleasePhase'].every(k => !Object.hasOwn(current.meta, k)), 'recovery_metadata_changed')
  check(predecessor.meta.iomDeployScope === 'crm-email' && predecessor.meta.iomReleaseKind === 'upgrade' &&
    predecessor.meta.iomReleasePhase === 'ACTIVE', 'parent_release_metadata_mismatch')
  const entries = decodeScopeMap(predecessor.meta.iomScopeMap, allowedScopes)
  check(entries.length === 20 && sha(JSON.stringify(Object.fromEntries(entries))) === B.predecessorMapDigest, 'parent_scope_map_mismatch')
  const delta = compareInventories(beforeInventory, currentInventory)
  check(delta.beforeCount === B.inventoryCount && delta.afterCount === B.inventoryCount &&
    delta.beforeDigest === B.beforeInventoryDigest && delta.afterDigest === B.currentInventoryDigest, 'recovery_inventory_binding_mismatch')
  check(delta.changed.length === 1 && delta.changed[0].path === B.storePath && delta.changed[0].before === B.previousStoreSha1 &&
    delta.changed[0].after === B.storeSha1, 'recovery_not_single_store_delta')
  check(storeCommit === B.storeCommit && Array.isArray(storeCommitFiles) && storeCommitFiles.length === 1 &&
    storeCommitFiles[0] === B.storePath, 'store_commit_scope_mismatch')
  check(Buffer.isBuffer(storeBytes) && storeBytes.length === B.storeBytes && sha(storeBytes) === B.storeSha256 &&
    sha(storeBytes, 'sha1') === B.storeSha1, 'store_committed_bytes_mismatch')
  const descriptor = {
    version: 1, projectId: B.projectId, deploymentId: B.currentId, parentDeploymentId: B.predecessorId,
    base: B.base, pluginCommit: B.pluginCommit, scopeMap: encodeScopeMap([...entries, ['crm-email-store', storeCommit]], allowedScopes),
    inventory: { beforeDigest: delta.beforeDigest, currentDigest: delta.afterDigest, count: delta.afterCount },
    store: { path: B.storePath, commit: storeCommit, sha1: B.storeSha1, sha256: B.storeSha256, bytes: B.storeBytes },
    parentRelease: { deploymentId: B.predecessorId, kind: 'upgrade', phase: 'ACTIVE' },
  }
  const digest = provenanceDigest(descriptor)
  assertDescriptor(descriptor, digest, allowedScopes)
  return { descriptor, digest }
}
function assertPreservedMap(base, encoded, descriptor, allowedScopes) {
  check(base === descriptor.base, 'composition_base_changed')
  const entries = decodeScopeMap(encoded, allowedScopes), map = new Map(entries)
  const inherited = decodeScopeMap(descriptor.scopeMap, allowedScopes).map(([scope]) => scope)
  const inheritedSet = new Set(inherited)
  check(entries.filter(([scope]) => inheritedSet.has(scope)).map(([scope]) => scope).join('\0') === inherited.join('\0'),
    'inherited_overlay_missing_or_reordered')
  check(map.get('crm-email') === B.pluginCommit, 'plugin_replacement_requires_review')
  check(map.get('crm-email-store') === B.storeCommit, 'store_replacement_requires_review')
  check(entries.findIndex(([scope]) => scope === 'crm-email-store') > entries.findIndex(([scope]) => scope === 'crm-email'), 'store_overlay_precedence_invalid')
  return entries
}
export function readComposition(deployment, { descriptor, descriptorDigest, allowedScopes }) {
  assertDescriptor(descriptor, descriptorDigest, allowedScopes)
  check(deployment?.projectId === B.projectId && deployment.readyState === 'READY' && deployment.target === 'production', 'live_deployment_binding_mismatch')
  let entries
  if (deployment.id === B.currentId) {
    assertLive(deployment, B.currentId)
    check(deployment.meta.iomDeployScope === 'crm-store-file' && deployment.meta.iomRollbackDeployment === B.predecessorId &&
      ['iomScopeMap','iomReleaseKind','iomReleasePhase'].every(k => !Object.hasOwn(deployment.meta, k)), 'recovery_metadata_changed')
    entries = decodeScopeMap(descriptor.scopeMap, allowedScopes)
  } else {
    check(deploymentPattern.test(deployment?.id || '') && deployment.meta?.iomProvenanceDigest === descriptorDigest &&
      deployment.meta.iomReleaseKind === 'scoped-update' && deployment.meta.iomReleasePhase === 'COMPOSED' &&
      deployment.meta.iomSourceCommitSha === B.pluginCommit &&
      commitPattern.test(deployment.meta.iomCommitSha || '') && deploymentPattern.test(deployment.meta.iomParentDeploymentId || ''), 'live_provenance_missing')
    entries = assertPreservedMap(deployment.meta.iomSnapshotBaseSha, deployment.meta.iomScopeMap, descriptor, allowedScopes)
  }
  return { base: descriptor.base, overlays: Object.fromEntries(entries), provenance: descriptor, provenanceDigest: descriptorDigest }
}
export function assertComposition({ descriptor, descriptorDigest, base, scopeMap, files }, allowedScopes) {
  assertDescriptor(descriptor, descriptorDigest, allowedScopes)
  assertPreservedMap(base, scopeMap, descriptor, allowedScopes)
  const rows = inventory(files)
  check(rows.find(row => row.path === B.storePath)?.sha1 === B.storeSha1, 'store_artifact_not_preserved')
  return true
}
export function buildReleaseMetadata({ descriptor, descriptorDigest, base, overlays, parentOverlays, head, scope, parentDeploymentId }, allowedScopes) {
  assertDescriptor(descriptor, descriptorDigest, allowedScopes)
  check(commitPattern.test(head || '') && typeof scope === 'string' && scope.length > 0 && scope.length <= 500 &&
    deploymentPattern.test(parentDeploymentId || ''), 'new_release_binding_invalid')
  const entries = Object.entries(overlays), scopeMap = encodeScopeMap(entries, allowedScopes)
  assertPreservedMap(base, scopeMap, descriptor, allowedScopes)
  const requested = scope.split(',')
  check(requested.every(s => scopeNames(allowedScopes).has(s)) && new Set(requested).size === requested.length, 'new_release_scope_invalid')
  check(requested.every(s => !['crm-email','crm-email-store','site'].includes(s)), 'protected_replacement_requires_review')
  check(requested.every(s => overlays[s] === head), 'new_release_head_binding_mismatch')
  check(parentOverlays && typeof parentOverlays === 'object' && !Array.isArray(parentOverlays), 'parent_overlays_missing')
  const parentMap = encodeScopeMap(Object.entries(parentOverlays), allowedScopes)
  assertPreservedMap(base, parentMap, descriptor, allowedScopes)
  const expected = Object.fromEntries(decodeScopeMap(parentMap, allowedScopes))
  for (const requestedScope of requested) expected[requestedScope] = head
  check(scopeMap === encodeScopeMap(Object.entries(expected), allowedScopes), 'unrequested_overlay_change')
  return {
    githubCommitRef: 'master', iomCommitSha: head, iomDeployScope: scope, iomSnapshotBaseSha: base, iomScopeMap: scopeMap,
    iomSourceCommitSha: B.pluginCommit, iomReleaseKind: 'scoped-update', iomReleasePhase: 'COMPOSED', iomParentDeploymentId: parentDeploymentId,
    iomRollbackDeployment: parentDeploymentId, iomProvenanceDigest: descriptorDigest,
  }
}
export function collectPreflight({ expectedCurrentId, currentId, checks = {}, testReuse = [] }) {
  const blockers = []
  const add = code => { if (!blockers.includes(code)) blockers.push(code) }
  if (!deploymentPattern.test(expectedCurrentId || '') || currentId !== expectedCurrentId) add('production_base_changed')
  const codes = { gitObjects: 'git_objects_missing', sourceBindings: 'source_bindings_invalid', candidateClean: 'candidate_dirty',
    tests: 'tests_not_passed', scanner: 'scanner_not_passed', r2: 'r2_not_verified', sitemap: 'sitemap_not_verified' }
  for (const [name, code] of Object.entries(codes)) if (checks[name] !== true) add(code)
  if (!Array.isArray(testReuse)) { add('test_receipt_invalid'); testReuse = [] }
  const reusableTests = []
  for (const item of testReuse) {
    if (typeof item?.name !== 'string' || !/^[a-zA-Z0-9_.:-]{1,120}$/.test(item.name) ||
      !digestPattern.test(item.inputDigest || '') || item.receipt?.passed !== true || item.receipt.inputDigest !== item.inputDigest) add('test_receipt_invalid')
    else reusableTests.push(item.name)
  }
  return { ok: blockers.length === 0, blockers, reusableTests, executed: false }
}
export function assertConditionalRollback({ projectId, currentDeploymentId, createdDeploymentId, predecessorDeploymentId, expectedPredecessorId }) {
  check(projectId === B.projectId && [currentDeploymentId, createdDeploymentId, predecessorDeploymentId, expectedPredecessorId]
    .every(id => deploymentPattern.test(id || '')), 'rollback_binding_invalid')
  check(currentDeploymentId === createdDeploymentId, 'rollback_would_undo_later_work')
  check(predecessorDeploymentId === expectedPredecessorId && predecessorDeploymentId !== createdDeploymentId, 'rollback_target_mismatch')
  return { deploymentId: predecessorDeploymentId, projectId, executed: false }
}
