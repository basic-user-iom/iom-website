// Synchronous adapter used only by the existing npm deploy launcher. All Git,
// provider, build, scanner and R2 operations are injected existing helpers.
// This module has no credential client and never reads environment variables.
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { NEEDS_REVIEW_TARGET as TARGET, NEEDS_REVIEW_SCOPE as SCOPE, disabledNeedsReviewEnv } from './crm-needs-review-release.mjs'
import { NEEDS_REVIEW_RUNTIME_FILES, NEEDS_REVIEW_SCOPE_FILES } from './crm-needs-review-scope.mjs'
import { assertOverlayPreservation, assertScopedInventory, needsReviewReleaseDigest as digest } from './crm-needs-review-release-guards.mjs'
import { openNeedsReviewJournal, adoptNeedsReviewJournal } from './crm-needs-review-journal-session.mjs'
import {isPrivateReleaseSource,resolvePrivateJournal,assertPrivateBindingBytes} from './crm-needs-review-source-binding.mjs'

const hash = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest('hex')
const RECEIPT_SHA256 = /^[a-f0-9]{64}$/
const SOURCE_IDENTITY = /^(?:git:[a-f0-9]{40}|gzip:[a-f0-9]{64})$/

function receiptOf(entry) {
  if (!entry?.reuse || !RECEIPT_SHA256.test(entry.reuse.policyId || '') || !SOURCE_IDENTITY.test(entry.reuse.sourceIdentity || '')) fail('media_receipt_mismatch')
  return entry.reuse
}
function parseStableManifest(bytes) {
  const raw = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes)
  if (raw.includes('\u0000')) fail('media_manifest_delta_forbidden')
  let manifest
  try { manifest = JSON.parse(raw) } catch { fail('media_manifest_delta_forbidden') }
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.files) || manifest.files.length === 0) fail('media_manifest_delta_forbidden')
  if (raw !== JSON.stringify(manifest, null, 2) + '\n') fail('media_manifest_round_trip_unstable')
  return manifest
}
// The scanned reuse plan may replace only its policy id. Path, size, content
// hash, source identity, content type and every other field stay production bytes.
export function applyVerifiedReceipt(productionRaw, scan) {
  if (!RECEIPT_SHA256.test(scan?.policyId || '') || !Array.isArray(scan.files)) fail('media_receipt_mismatch')
  const manifest = parseStableManifest(productionRaw)
  if (scan.files.length !== manifest.files.length) fail('media_receipt_mismatch')
  const seen = new Set(), byPath = new Map()
  for (const item of scan.files) {
    if (!item || seen.has(item.path) || !RECEIPT_SHA256.test(item.sha256 || '') || !Number.isSafeInteger(item.bytes) || item.bytes < 1 || !SOURCE_IDENTITY.test(item.sourceIdentity || '')) fail('media_receipt_mismatch')
    seen.add(item.path)
    byPath.set(item.path, item)
  }
  for (const entry of manifest.files) {
    const item = byPath.get(entry.path)
    const receipt = receiptOf(entry)
    if (!item || entry.path !== item.path || entry.bytes !== item.bytes || entry.sha256 !== item.sha256 || receipt.sourceIdentity !== item.sourceIdentity) fail('media_receipt_mismatch')
    receipt.policyId = scan.policyId
  }
  const next = Buffer.from(JSON.stringify(manifest, null, 2) + '\n')
  assertReceiptOnlyChange(productionRaw, next, scan.policyId)
  return next
}
export function assertReceiptOnlyChange(beforeRaw, afterRaw, policyId) {
  if (!RECEIPT_SHA256.test(policyId || '')) fail('media_manifest_delta_forbidden')
  const before = parseStableManifest(beforeRaw), after = parseStableManifest(afterRaw)
  if (before.files.length !== after.files.length || before.origin !== after.origin) fail('media_manifest_delta_forbidden')
  for (let index = 0; index < before.files.length; index++) {
    const left = before.files[index], right = after.files[index]
    if (left.path !== right.path) fail('media_receipt_mismatch')
    const leftReceipt = receiptOf(left), rightReceipt = receiptOf(right)
    if (leftReceipt.sourceIdentity !== rightReceipt.sourceIdentity || rightReceipt.policyId !== policyId) fail('media_receipt_mismatch')
    if (JSON.stringify({ ...left, reuse: { ...leftReceipt, policyId } }) !== JSON.stringify(right)) fail('media_manifest_delta_forbidden')
  }
  return true
}
function sitemapLocations(value) {
  return [...value.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
}
// Restore production sitemap bytes only when every URL matches and the sole
// text difference is lastmod. Any added, removed or rewritten URL stops.
export function restoreUnchangedSitemap(productionRaw, generatedRaw) {
  const production = Buffer.isBuffer(productionRaw) ? productionRaw.toString('utf8') : String(productionRaw)
  const generated = Buffer.isBuffer(generatedRaw) ? generatedRaw.toString('utf8') : String(generatedRaw)
  const before = sitemapLocations(production), after = sitemapLocations(generated)
  if (before.length === 0 || before.length !== after.length || before.some((loc, index) => loc !== after[index])) fail('sitemap_urls_changed')
  const strip = value => value.replace(/<lastmod>[^<]+<\/lastmod>/g, '<lastmod></lastmod>')
  if (strip(production) !== strip(generated)) fail('sitemap_body_changed')
  return Buffer.from(production)
}
const fail = code => { throw Object.assign(Error(code), { code }) }
const pathIdentity = value => process.platform === 'win32' ? value.toLowerCase() : value
const outsideCheckout = (candidate, boundary) => {
  const value = pathIdentity(candidate), root = pathIdentity(boundary)
  const prefix = root.endsWith(sep) ? root : root + sep
  return value !== root && !value.startsWith(prefix)
}
// Resolve an existing ancestor without creating anything. A dangling junction or
// inaccessible path fails closed instead of being treated as an absent directory.
function physicalPath(value) {
  let current = resolve(value)
  const suffix = []
  while (true) {
    try { lstatSync(current); break } catch (error) {
      if (error.code !== 'ENOENT') fail('needs_review_journal_path_unverifiable')
      const parent = dirname(current)
      if (parent === current) fail('needs_review_journal_path_unverifiable')
      suffix.unshift(basename(current)); current = parent
    }
  }
  try { return resolve(realpathSync.native(current), ...suffix) }
  catch { fail('needs_review_journal_path_unverifiable') }
}
function journalEntries(dir) {
  try {
    const stat = lstatSync(dir)
    check(stat.isDirectory() && !stat.isSymbolicLink(), 'needs_review_journal_path_unverifiable')
    return readdirSync(dir)
  } catch (error) {
    if (error.code === 'ENOENT') return []
    fail('needs_review_journal_path_unverifiable')
  }
}
// Conservative transition barrier, not an automatic migrator. No override or
// migration receipt is accepted here. Existing evidence requires separate review.
function assertJournalTransition(root, dir) {
  const legacy = join(root, '.qa-out', 'crm-needs-review-release')
  check(pathIdentity(physicalPath(legacy)) === pathIdentity(legacy), 'needs_review_journal_redirected')
  check(journalEntries(legacy).length === 0, 'needs_review_legacy_journal_review_required')
  // There is no reverse identity registry for sibling journals. Never assume
  // another bucket is unrelated, and never choose/merge history by timestamp.
  check(journalEntries(dirname(dir)).every(name => pathIdentity(name) === pathIdentity(basename(dir))),
    'needs_review_journal_identity_review_required')
  const names = journalEntries(dir)
  check(!names.some(name => /^state-.*\.tmp$/i.test(name)), 'needs_review_journal_incomplete_write_review_required')
  if (!names.includes('state.json')) {
    check(names.every(name => ['approval.json', 'consents.json', 'operation.lock', 'state-wal.log'].includes(name)),
      'needs_review_journal_orphan_evidence_review_required')
  }
}
// Physical checkout identity keeps Windows case/junction aliases on the same
// lock. This isolated proposal never changes git status or provisions a location.
export function needsReviewReleaseJournalDir(root) {
  if(isPrivateReleaseSource(root))return resolvePrivateJournal(root).directory
  let resolvedRoot
  try {
    resolvedRoot = realpathSync.native(resolve(root))
    if (!statSync(resolvedRoot).isDirectory()) fail('needs_review_checkout_directory_required')
  } catch { fail('needs_review_checkout_directory_required') }
  let checkout = resolvedRoot, current = resolvedRoot
  while (true) {
    if (existsSync(join(current, '.git'))) checkout = current
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  const dir = resolve(dirname(checkout), 'iom-crm-needs-review-release', hash(`iom-crm-needs-review-release\n${pathIdentity(resolvedRoot)}`))
  check(outsideCheckout(dir, resolvedRoot) && outsideCheckout(dir, checkout), 'needs_review_journal_inside_checkout')
  check(pathIdentity(physicalPath(dir)) === pathIdentity(dir), 'needs_review_journal_redirected')
  for (let current = dir; ; current = dirname(current)) {
    check(!existsSync(join(current, '.git')), 'needs_review_journal_inside_checkout')
    if (dirname(current) === current) break
  }
  assertJournalTransition(resolvedRoot, dir)
  return dir
}
const check = (ok, code) => { if (!ok) fail(code) }
const sha = value => /^[a-f0-9]{64}$/.test(value || '')
const commit = value => /^[a-f0-9]{40}$/.test(value || '')
const deploymentId = value => /^dpl_[A-Za-z0-9]+$/.test(value || '')
const safePath = path => typeof path === 'string' && !/[\\\x00-\x1f:*?"<>|]/.test(path) &&
  path.split('/').every(part => part && part !== '.' && part !== '..' && !/[ .]$/.test(part))
const parse = value => typeof value === 'string' ? JSON.parse(value) : value
const phases = ['install-disabled']
const same = (a, b) => digest(a) === digest(b)
const sourceMap = value => ({ base: value.base, overlays: Object.entries(value.overlays) })
const sortedInventory = rows => {
  assertScopedInventory({ baseline: rows, candidate: rows, allowedFiles: rows })
  return rows.map(row => ({ path: row.path, sha1: row.sha1 })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}

// Vercel's file tree includes src and possibly out. Only the complete src tree
// is an upload-source inventory. No flattening of build outputs into src.
export function needsReviewSourceInventory(tree, { expectedCount, expectedDigest } = {}) {
  check(Array.isArray(tree) && tree.length > 0, 'needs_review_source_tree_invalid')
  check(expectedCount === undefined || Number.isSafeInteger(expectedCount) && expectedCount > 0,
    'needs_review_source_count_pin_invalid')
  check(expectedDigest === undefined || sha(expectedDigest), 'needs_review_source_digest_pin_invalid')
  const source = tree.filter(row => row?.name === 'src')
  check(source.length === 1 && source[0].type === 'directory' && Array.isArray(source[0].children), 'needs_review_source_tree_missing')
  const rows = [], seen = new Set()
  let omittedChildren = false
  function walk(nodes, prefix) {
    check(Array.isArray(nodes), 'needs_review_source_tree_incomplete')
    for (const node of nodes) {
      check(typeof node?.name === 'string' && !node.name.includes('/'), 'needs_review_source_tree_path_invalid')
      const path = prefix + node.name
      check(safePath(path) && !seen.has(path.toLowerCase()), 'needs_review_source_tree_path_invalid')
      seen.add(path.toLowerCase())
      check(node.truncated !== true, 'needs_review_source_tree_incomplete')
      if (node.type === 'directory') {
        if (node.children === undefined) omittedChildren = true
        else {
          check(Array.isArray(node.children), 'needs_review_source_tree_incomplete')
          walk(node.children, path + '/')
        }
      } else {
        check(node.type === 'file' && node.children === undefined && /^[a-f0-9]{40}$/.test(node.uid || ''), 'needs_review_source_tree_file_invalid')
        rows.push({ path, sha1: node.uid })
      }
    }
  }
  check(source[0].truncated !== true, 'needs_review_source_tree_incomplete')
  walk(source[0].children, '')
  check(rows.length > 0, 'needs_review_source_tree_empty')
  rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  // Some provider responses omit children for empty directories. Accept that
  // representation only with an independent complete inventory pin. A supplied
  // pin must always match, including when all children arrays are present.
  check(expectedCount === undefined || rows.length === expectedCount, 'needs_review_source_count_mismatch')
  check(expectedDigest === undefined || digest(rows) === expectedDigest, 'needs_review_source_digest_mismatch')
  check(!omittedChildren || expectedCount !== undefined || expectedDigest !== undefined, 'needs_review_source_tree_incomplete')
  return rows
}

// Helpers: git, readCommittedFile(Buffer), cli, live, productionState,
// readProductionManifest, composeSnapshot, buildSnapshot(snapshot,phase,env),
// prepareR2(snapshot,{verifyOnly:true}), scan(snapshot,expectedIdentity),
// uploadInventory(stage), withScannedRelease, pushReviewed, releaseMetadata,
// assertProductionUnchanged, cleanupStage, preflight, readHostedEvidence.
// Helpers must be synchronous. Build/R2 wrappers retain existing enforcement;
// their explicit receipts prevent accidentally wiring an upload/build variant.
export function createNeedsReviewReleaseDriver({ root, profile, approval = null, helpers, now = Date.now, journalSession = null }) {
  check(typeof root === 'string' && profile?.scope === SCOPE && helpers, 'needs_review_driver_options_invalid')
  const resolvedRoot = resolve(root), journalDir = needsReviewReleaseJournalDir(resolvedRoot)
  let session = journalSession === null ? null : adoptNeedsReviewJournal(journalSession, journalDir)
  let active = null, approvedPreflight = null
  // Directory and evidence handles remain in one local helper until completion.
  // No path-based journal reads/writes or automatic stale-lock recovery.
  function proveJournal() {
    check(pathIdentity(needsReviewReleaseJournalDir(resolvedRoot)) === pathIdentity(journalDir),
      'needs_review_journal_identity_review_required')
    if (session !== null) {
      session.verify()
      if(isPrivateReleaseSource(resolvedRoot))assertPrivateBindingBytes(session.read('source-binding.json'),resolvePrivateJournal(resolvedRoot))
    }
  }
  const fn = name => { check(typeof helpers[name] === 'function', 'needs_review_driver_helper_missing_' + name); return helpers[name] }
  const call = (name, ...args) => {
    try {
      if(session!==null)session.verify()
      const value = fn(name)(...args)
      check(!value || typeof value.then !== 'function', 'needs_review_driver_async_helper_forbidden')
      if(session!==null)session.verify()
      return value
    } catch(error) {
      if(session!==null){try{session.abandon()}finally{session=null}}
      throw error
    }
  }
  const localPath = path => {
    check(safePath(path), 'needs_review_driver_path_invalid')
    const value = resolve(resolvedRoot, ...path.split('/'))
    check(value.startsWith(resolvedRoot + sep), 'needs_review_driver_path_invalid')
    return value
  }
  function acquire() {
    proveJournal()
    if (session === null) {
      try { session = openNeedsReviewJournal(journalDir) }
      catch(error) { if(error.code==='journal_locked_no_automatic_recovery')fail('needs_review_release_locked_no_automatic_recovery'); throw error }
    }
    proveJournal()
  }
  function loadState() {
    acquire()
    return session.load()
  }
  function saveState(state) {
    acquire()
    session.save(state)
  }
  function authorized() {
    // The protocol verifies the precise approval bindings/window. This second
    // barrier prevents accidental direct provider mutations with no approval.
    check(approval && phases.includes(approval.phase) && commit(approval.head), 'needs_review_driver_approval_missing')
    check(Date.parse(approval.notBefore) <= now() && now() < Date.parse(approval.expiresAt), 'needs_review_driver_approval_expired')
    acquire()
  }
  function api(route) { return typeof helpers.api === 'function' ? call('api', route) : parse(call('cli', ['api', route])) }
  function sourceFileBytes(id, filePath) {
    check(deploymentId(id) && safePath(filePath), 'needs_review_preserved_file_missing')
    const tree = api(`/v6/deployments/${id}/files`)
    const nodes = Array.isArray(tree) ? tree : tree?.files
    const source = Array.isArray(nodes) ? nodes.find(row => row?.name === 'src') : null
    check(source?.type === 'directory' && Array.isArray(source.children), 'needs_review_source_tree_missing')
    let list = source.children
    const parts = filePath.split('/')
    let node = null
    for (const part of parts) {
      node = (list || []).find(item => item?.name === part)
      check(node, 'needs_review_preserved_file_missing')
      list = node.children
    }
    check(node.type === 'file' && /^[a-f0-9]{40}$/.test(node.uid || ''), 'needs_review_preserved_file_missing')
    const body = api(`/v8/deployments/${id}/files/${node.uid}`)
    const bytes = Buffer.from(body?.data || '', 'base64')
    check(hash(bytes, 'sha1') === node.uid, 'needs_review_preserved_file_mismatch')
    return bytes
  }
  function restoreProductionSitemap(stage, productionBytes) {
    const file = join(stage, 'public', 'sitemap.xml')
    writeFileSync(file, restoreUnchangedSitemap(productionBytes, readFileSync(file)))
  }
  function writeVerifiedManifest(stage, productionBytes) {
    const plan = JSON.parse(readFileSync(join(stage, '.iom-r2-reuse.json'), 'utf8'))
    check(RECEIPT_SHA256.test(plan?.policyId || '') && Array.isArray(plan.files) && plan.files.length > 0, 'media_receipt_mismatch')
    const scan = { policyId: plan.policyId, files: plan.files.map(entry => {
      check(entry?.reuse?.policyId === plan.policyId, 'media_receipt_mismatch')
      return { path: entry.path, bytes: entry.bytes, sha256: entry.sha256, sourceIdentity: entry.reuse.sourceIdentity }
    }) }
    writeFileSync(join(stage, '.iom-r2-release.json'), applyVerifiedReceipt(productionBytes, scan))
  }
  function readInventory(id, expectedDigest) {
    check(deploymentId(id), 'needs_review_deployment_id_invalid')
    check(expectedDigest === undefined || sha(expectedDigest), 'needs_review_source_digest_pin_invalid')
    const expectedCount = id === TARGET.initialDeploymentId ? profile.baseline.sourceCount : undefined
    if (typeof helpers.readDeploymentInventory === 'function') {
      const rows = sortedInventory(call('readDeploymentInventory', { id, expectedDigest }))
      check(expectedCount === undefined || rows.length === expectedCount, 'needs_review_source_count_mismatch')
      check(expectedDigest === undefined || digest(rows) === expectedDigest, 'needs_review_source_digest_mismatch')
      return rows
    }
    return needsReviewSourceInventory(api(`/v6/deployments/${id}/files?teamId=${TARGET.teamId}`), { expectedCount, expectedDigest })
  }
  function assertSnapshotUnchanged(artifact) {
    check(active && artifact === active.artifact, 'needs_review_prepared_artifact_required')
    const rows = sortedInventory(call('uploadInventory', active.snapshot.stage))
    check(digest(rows) === artifact.inventoryDigest, 'needs_review_prepared_inventory_changed')
    call('assertProductionUnchanged', active.snapshot)
  }
  function sourcePreflight({ head, phase, baseline }, mutationApproval) {
    check(commit(head) && phases.includes(phase) && deploymentId(baseline?.id), 'needs_review_verification_target_invalid')
    check(String(call('git', ['rev-parse', `${head}^{commit}`])).trim() === head, 'needs_review_committed_head_missing')
    const runtime = [], runtimePaths = new Set(NEEDS_REVIEW_RUNTIME_FILES)
    for (const row of profile.files) {
      const bytes = call('readCommittedFile', head, row.path)
      check(Buffer.isBuffer(bytes) && hash(bytes) === row.sha256, 'needs_review_committed_source_changed')
      if (runtimePaths.has(row.path)) runtime.push({ path: row.path, sha1: hash(bytes, 'sha1') })
    }
    check(runtime.length === runtimePaths.size, 'needs_review_runtime_closure_incomplete')
    runtime.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    const host=call('readCommittedFile',head,'api/_lib/crm-needs-review-host.mjs')
    check(Buffer.isBuffer(host)&&/export const NEEDS_REVIEW_PRODUCTION_APPROVAL\s*=\s*null(?:\s|;)/.test(host.toString('utf8')), 'needs_review_runtime_must_be_unpinned')
    const config = call('readCommittedFile', head, 'vercel.json')
    check(Buffer.isBuffer(config), 'needs_review_committed_config_bytes_required')
    const result = { runtimeDigest: digest(runtime), configDigest: hash(config) }
    check(result.runtimeDigest === profile.runtimeDigest && result.configDigest === profile.configDigest &&
      (!mutationApproval || result.runtimeDigest === mutationApproval.digests?.runtime && result.configDigest === mutationApproval.digests?.config),
    'needs_review_runtime_config_binding_changed')
    check(call('preflight', { head, phase, baseline, profile, approval: mutationApproval }) === true, 'needs_review_existing_preflight_failed')
    return result
  }
  function buildArtifact({ head, phase, baseline, env, allowedFiles }, consume) {
    check(same(env, disabledNeedsReviewEnv()), 'needs_review_disabled_runtime_required')
    const liveState = call('productionState', baseline)
    const beforeInventory = readInventory(baseline.id, baseline.meta?.iomNeedsReviewInventory)
    const media = call('readProductionManifest', resolvedRoot, baseline, api)
    const productionManifestBytes = sourceFileBytes(baseline.id, '.iom-r2-release.json')
    const productionSitemapBytes = sourceFileBytes(baseline.id, 'public/sitemap.xml')
    const snapshot = call('composeSnapshot', liveState, [SCOPE], head, media, baseline.id)
    try {
      const composition = assertOverlayPreservation({ baseline: sourceMap(liveState), candidate: sourceMap(snapshot), head })
      const built = call('buildSnapshot', snapshot, phase, env)
      check(built?.complete === true && same(built.env, env), 'needs_review_disabled_build_receipt_required')
      restoreProductionSitemap(snapshot.stage, productionSitemapBytes)
      const r2 = call('prepareR2', snapshot, { verifyOnly: true })
      check(r2?.complete === true && r2.mode === 'verify-only', 'needs_review_r2_verify_only_required')
      writeVerifiedManifest(snapshot.stage, productionManifestBytes)
      const scan = call('scan', snapshot, null)
      check(sha(scan?.identity), 'needs_review_secret_scan_required')
      const afterInventory = sortedInventory(call('uploadInventory', snapshot.stage))
      // Verification discovers exact scope output bytes for subsequent review;
      // mutation preparation instead requires those already approved exact bytes.
      const uploadFiles = allowedFiles ?? afterInventory.filter(row => NEEDS_REVIEW_SCOPE_FILES.includes(row.path))
      const checked = assertScopedInventory({ baseline: beforeInventory, candidate: afterInventory, allowedFiles: uploadFiles })
      const artifact = Object.freeze({ scope: SCOPE, checked: true, base: snapshot.base,
        scopeMap: Buffer.from(JSON.stringify(snapshot.overlays)).toString('base64url'),
        inventoryDigest: checked.afterDigest, baselineInventoryDigest: checked.beforeDigest,
        provenanceDigest: composition.digest, baselineProvenanceDigest: digest(sourceMap(liveState)),
        digest: digest({ head, phase, inventory: checked.afterDigest, provenance: composition.digest,
          runtime: profile.runtimeDigest, config: profile.configDigest, scan: scan.identity }) })
      check(digest(sortedInventory(call('uploadInventory', snapshot.stage))) === artifact.inventoryDigest,
        'needs_review_prepared_inventory_changed')
      call('assertProductionUnchanged', snapshot)
      return consume({ snapshot, artifact, uploadFiles, scanIdentity: scan.identity })
    } finally { call('cleanupStage', snapshot.stage) }
  }
  const driver = {
    readFile: path => readFileSync(localPath(path)),
    loadState, saveState,
    runId: () => randomUUID(),
    withLock(work) { acquire(); try { return work() } catch(error) { driver.abandon(); throw error } finally { driver.close() } },
    abandon() { if(session!==null) { try { session.abandon() } finally { session=null } } },
    close() {
      if (session === null) return
      try { proveJournal(); session.close() }
      catch(error) { session.abandon(); throw error }
      finally { session=null }
    },
    live({ verificationOnly = false } = {}) {
      // Expired approvals may inspect persisted state, never authorize mutations.
      if (verificationOnly === true) return call('live')
      check(approval || loadState()?.candidate || loadState()?.previousCandidate, 'needs_review_driver_approval_missing')
      acquire(); return call('live')
    },
    preflight({ head, phase, baseline }) {
      authorized()
      check(head === approval.head && phase === approval.phase, 'needs_review_driver_approval_mismatch')
      const result = sourcePreflight({ head, phase, baseline }, approval)
      approvedPreflight = { head, phase, baselineId: baseline.id }
      return result
    },
    verifyArtifact({ head, phase, baseline, env }) {
      check(active === null && approvedPreflight === null, 'needs_review_prepare_reentry')
      const source = sourcePreflight({ head, phase, baseline }, null)
      return buildArtifact({ head, phase, baseline, env }, ({ artifact, uploadFiles }) =>
        Object.freeze({ ...artifact, ...source, uploadFiles: uploadFiles.map(row => ({ ...row })) }))
    },
    verifyConsents(consents, at) {
      // Pure phase guards in the protocol validate actual reviewed readbacks.
      // This helper may perform a supported read, never create/update a grant.
      proveJournal()
      check(call('verifyConsents', consents, at) === true, 'needs_review_consent_readback_missing')
      return true
    },
    prepare({ head, phase, baseline, env, submit }) {
      authorized()
      check(approvedPreflight && same(approvedPreflight, { head, phase, baselineId: baseline.id }), 'needs_review_preflight_required')
      check(active === null && typeof submit === 'function', 'needs_review_prepare_reentry')
      check(Array.isArray(approval.uploadFiles) && approval.uploadFiles.length > 0 &&
        approval.uploadFiles.every(row => NEEDS_REVIEW_SCOPE_FILES.includes(row.path)), 'needs_review_reviewed_upload_manifest_required')
      try {
        return buildArtifact({ head, phase, baseline, env, allowedFiles: approval.uploadFiles }, ({ snapshot, artifact, scanIdentity }) => {
          active = { snapshot, artifact, head, phase, scanIdentity, pushed: false }
          return submit(artifact)
        })
      } finally { active = null; approvedPreflight = null }
    },
    pushReviewed({ head, artifact }) {
      authorized(); assertSnapshotUnchanged(artifact)
      const state = loadState()
      check(state?.pending === 'CREATE_UNKNOWN' && state.candidate?.head === head &&
        state.candidate.artifactDigest === artifact.digest && state.createInvoked !== state.candidate.run && state.pushInvoked !== state.candidate.run,
      'needs_review_push_reservation_required')
      saveState({ ...state, pushInvoked: state.candidate.run })
      call('withScannedRelease', {
        verifyOnly: false,
        scan: expected => {
          assertSnapshotUnchanged(artifact)
          const result = call('scan', active.snapshot, expected || active.scanIdentity)
          check(result?.identity === active.scanIdentity, 'needs_review_scan_identity_changed')
          return result
        },
        push: () => call('pushReviewed', { head, artifact }),
        publish: () => { active.pushed = true },
      })
      check(active.pushed, 'needs_review_scanned_push_incomplete')
    },
    create({ record, artifact, env }) {
      authorized(); assertSnapshotUnchanged(artifact)
      check(active.pushed && same(env, disabledNeedsReviewEnv()), 'needs_review_scanned_push_required')
      const state = loadState()
      check(state?.pending === 'CREATE_UNKNOWN' && state.candidate?.run === record.run &&
        state.candidate.artifactDigest === artifact.digest && state.createInvoked !== record.run &&
        record.head === active.head && record.phase === active.phase,
      'needs_review_create_reserved_or_already_attempted')
      const metadata = call('releaseMetadata', active.snapshot, active.head, active.phase)
      check(metadata?.iomScopeMap === artifact.scopeMap && metadata.iomSnapshotBaseSha === artifact.base &&
        metadata.iomCommitSha === active.head, 'needs_review_release_metadata_incomplete')
      const bound = { ...metadata, iomNeedsReviewRun: record.run, iomNeedsReviewPhase: record.phase,
        iomNeedsReviewArtifact: artifact.digest, iomNeedsReviewInventory: artifact.inventoryDigest,
        iomNeedsReviewStarts: 'false' }
      saveState({ ...state, createInvoked: record.run }) // a throw below remains uncertain; never repeat
      return call('cli', ['deploy', '--prod', '--skip-domain', '--yes', '--cwd', active.snapshot.stage,
        ...Object.entries(env).flatMap(([key, value]) => ['--build-env', `${key}=${value}`, '--env', `${key}=${value}`]),
        ...Object.entries(bound).flatMap(([key, value]) => ['--meta', `${key}=${value}`])], { cwd: active.snapshot.stage })
    },
    findCreated(record) {
      acquire(); check(record?.run && Number.isSafeInteger(record.createdAt), 'needs_review_creation_record_invalid')
      const matches = [], seen = new Set(); let until = null
      for (let page = 0; page < 20; page++) {
        const result = api(`/v6/deployments?projectId=${TARGET.projectId}&teamId=${TARGET.teamId}&limit=100&since=${record.createdAt - 1000}${until === null ? '' : `&until=${until}`}`)
        check(Array.isArray(result?.deployments), 'needs_review_creation_lookup_incomplete')
        for (const item of result.deployments) {
          if (item.meta?.iomNeedsReviewRun !== record.run) continue
          const id = item.uid || item.id
          check(deploymentId(id) && !seen.has(id), 'needs_review_creation_lookup_duplicate')
          seen.add(id); matches.push({ ...item, id })
        }
        const next = result.pagination?.next
        if (next === null || next === undefined) return matches
        check(Number.isSafeInteger(next) && (until === null || next < until), 'needs_review_creation_lookup_incomplete')
        until = next
      }
      fail('needs_review_creation_lookup_incomplete')
    },
    deployment(id) {
      acquire(); check(deploymentId(id), 'needs_review_deployment_id_invalid')
      if (typeof helpers.deployment === 'function') return call('deployment', id)
      return api(`/v13/deployments/${id}?teamId=${TARGET.teamId}`)
    },
    verifyHosted({ record, result, approval: evidenceApproval }) {
      acquire()
      check(result?.id === record.deploymentId && result.projectId === TARGET.projectId && result.readyState === 'READY' &&
        result.meta?.iomNeedsReviewArtifact === record.artifactDigest && result.meta?.iomNeedsReviewStarts === 'false',
      'needs_review_hosted_metadata_mismatch')
      const rows = readInventory(record.deploymentId, record.inventoryDigest)
      check(sha(record.inventoryDigest) && digest(rows) === record.inventoryDigest, 'needs_review_hosted_inventory_mismatch')
      proveJournal()
      const value = call('readHostedEvidence', record)
      check(sha(evidenceApproval?.hostedEvidenceSha256) && digest(value) === evidenceApproval.hostedEvidenceSha256,
        'needs_review_hosted_review_binding_missing')
      const at = now()
      check(value?.version === 1 && value.source === 'reviewed-hosted-readback' && value.deploymentId === record.deploymentId &&
        value.artifactDigest === record.artifactDigest && value.inventoryDigest === record.inventoryDigest &&
        value.head === record.head && value.phase === record.phase && value.startsEnabled === false && value.needsReviewEnabled === false &&
        Number.isSafeInteger(value.observedAt) && Number.isSafeInteger(value.expiresAt) && value.observedAt <= at &&
        at - value.observedAt <= 30 * 60_000 && value.expiresAt > at && value.checks?.disabledRuntime === true &&
        value.checks?.routeBinding === true && value.checks?.noEmailSent === true,
      'needs_review_hosted_review_missing_or_stale')
      return true
    },
    verifyRollbackTarget(record) {
      check(deploymentId(record?.baseline?.id) && sha(record.baselineInventoryDigest), 'needs_review_rollback_target_record_invalid')
      const expected = record.baseline, target = driver.deployment(expected.id)
      check(target?.id === expected.id && target.projectId === TARGET.projectId && target.teamId === TARGET.teamId &&
        target.target === 'production' && target.readyState === 'READY' && target.meta?.iomCommitSha === expected.commit &&
        target.meta?.iomScopeMap === expected.scopeMap && target.meta?.iomSnapshotBaseSha === expected.base,
      'needs_review_rollback_target_changed')
      readInventory(expected.id, record.baselineInventoryDigest)
      return true
    },
    promote(id) {
      authorized()
      const state = loadState()
      check(state?.pending === 'PROMOTE_UNKNOWN' && state.candidate?.deploymentId === id &&
        state.candidate.verified === true && state.promoteInvoked !== id, 'needs_review_promotion_reservation_required')
      saveState({ ...state, promoteInvoked: id })
      return call('cli', ['promote', id, '--yes'])
    },
    rollback(id) {
      authorized()
      const state = loadState(), record = state?.candidate || state?.previousCandidate
      check(state?.pending === 'ROLLBACK_UNKNOWN' && record?.baseline?.id === id &&
        state.rollbackInvoked !== id, 'needs_review_rollback_reservation_required')
      saveState({ ...state, rollbackInvoked: id })
      return call('cli', ['rollback', id, '--yes'])
    },
  }
  return driver
}
