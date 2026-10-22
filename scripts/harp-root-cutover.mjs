/** Inactive proposal: no deploy, network, credential lookup, or deletion. */
import { lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

export const HARP_PREFIX = '/demos/harp-configurator-demo'
export const HARP_SOURCE = 'public' + HARP_PREFIX
export const CUTOVER_CONFIG = 'config/harp-root-cutover.json'
export const REMOTE_ASSERTION = ' && node scripts/harp-root-cutover.mjs --assert-stage'
export const harpPolicyDigest = policy => createHash('sha256').update(JSON.stringify(policy)).digest('hex')
const ROOT_PROJECT = 'prj_fWUOXHiMmeE6RXfqgAAKJCi97nrv'
const ROOT_TEAM = 'team_9wCcYQpYqlDlPAaUpCqhWXj9'
export const INACTIVE = Object.freeze({ enabled: false })
const block = code => { throw new Error('Harp root cutover blocked: ' + code) }
const boundary = (value, prefix) => value === prefix || value.startsWith(prefix + '/')
const normalized = value => String(value).replaceAll('\\', '/').toLowerCase()

export function isHarpSource(value) {
  return boundary(normalized(value), HARP_SOURCE)
}
export function isHarpUrl(value) {
  return boundary(normalized(value), HARP_PREFIX)
}
function isHarpPayload(value) {
  const path = normalized(value)
  return isHarpSource(path) || isHarpUrl(path) ||
    boundary(path, 'dist' + HARP_PREFIX) ||
    boundary(path, '.vercel/output/static' + HARP_PREFIX)
}
export function expectedHarpRewrites(origin) {
  return [
    { source: HARP_PREFIX, destination: origin + HARP_PREFIX + '/' },
    { source: HARP_PREFIX + '/:path*', destination: origin + HARP_PREFIX + '/:path*' },
  ]
}
export function assertHarpRootProjectBinding(project, policy) {
  if (!policy.enabled) return
  if (project?.projectId !== ROOT_PROJECT || project?.orgId !== ROOT_TEAM) block('root_project_mismatch')
}
export function parseHarpCutover(config) {
  if (config === null || config === undefined) return INACTIVE
  if (config.version !== 1 || typeof config.cutover?.enabled !== 'boolean') block('invalid_configuration')
  if (!config.cutover.enabled) return INACTIVE
  const child = config.child, approval = config.approval
  if (!child || !approval || approval.approved !== true) block('approval_missing')
  if (child.teamId !== ROOT_TEAM || !/^prj_[A-Za-z0-9]+$/.test(child.projectId || '') ||
      child.projectId === ROOT_PROJECT) block('child_binding_invalid')
  let url
  try { url = new URL(child.origin) } catch { block('child_origin_missing') }
  if (url.protocol !== 'https:' || url.origin !== child.origin ||
      !/^[a-z0-9][a-z0-9-]*\.vercel\.app$/.test(url.hostname) ||
      url.username || url.password || url.port || url.search || url.hash ||
      !['', '/'].includes(url.pathname)) block('child_origin_invalid')
  if (approval.rootProjectId !== ROOT_PROJECT || approval.childProjectId !== child.projectId ||
      approval.childTeamId !== child.teamId || approval.childOrigin !== child.origin ||
      !/^dpl_[A-Za-z0-9]+$/.test(approval.childDeploymentId || '') ||
      !/^dpl_[A-Za-z0-9]+$/.test(approval.rootRollbackDeploymentId || '') ||
      approval.childDeploymentId === approval.rootRollbackDeploymentId) block('approval_binding_mismatch')
  return Object.freeze({ enabled: true, origin: child.origin, childProjectId: child.projectId,
    childTeamId: child.teamId, childDeploymentId: approval.childDeploymentId,
    rootRollbackDeploymentId: approval.rootRollbackDeploymentId })
}
// Conservative overlap check: only a different literal first path segment, or
// a different literal demo slug, proves that a preceding rule cannot shadow Harp.
function mayMatchHarp(source) {
  if (typeof source !== 'string' || !source.startsWith('/')) return true
  const segments = source.slice(1).split('/')
  if (!/^[A-Za-z0-9._~-]+$/.test(segments[0])) return true
  if (segments[0].toLowerCase() !== 'demos') return false
  return !/^[A-Za-z0-9._~-]+$/.test(segments[1] || '') ||
    segments[1].toLowerCase() === 'harp-configurator-demo'
}
export function assertHarpRoutes(config, policy) {
  if (!policy.enabled) return
  if (config.routes || !Array.isArray(config.rewrites)) block('routes_missing_or_legacy')
  const expected = expectedHarpRewrites(policy.origin)
  const indices = expected.map(route => config.rewrites.findIndex(item =>
    JSON.stringify(item) === JSON.stringify(route)))
  if (indices.some(index => index < 0) || indices[1] !== indices[0] + 1) block('exact_route_pair_missing')
  for (let index = 0; index < config.rewrites.length; index++) {
    if (indices.includes(index)) continue
    const item = config.rewrites[index]
    if (isHarpUrl(item.source) ||
        (index < indices[1] && mayMatchHarp(item.source))) block('conflicting_rewrite')
  }
  if ((config.redirects || []).some(item => mayMatchHarp(item.source))) block('conflicting_redirect')
}
function json(text) {
  try { return JSON.parse(text) } catch { block('invalid_json') }
}
export function cutoverFromSnapshot(files, readCommittedText) {
  const entry = files.get(CUTOVER_CONFIG)
  if (!entry) return INACTIVE
  if (entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode) ||
      !/^[a-f0-9]{40}$/.test(entry.oid || '')) block('config_not_committed_regular_file')
  const policy = parseHarpCutover(json(readCommittedText(entry)))
  if (policy.enabled) {
    const routes = files.get('vercel.json')
    if (!routes || routes.type !== 'blob' || !['100644', '100755'].includes(routes.mode) ||
        !/^[a-f0-9]{40}$/.test(routes.oid || '')) block('routes_not_committed_regular_file')
    assertHarpRoutes(json(readCommittedText(routes)), policy)
  }
  return policy
}
export function filterHarpSourceFiles(files, policy) {
  if (!policy.enabled) return files
  return new Map([...files].filter(([path]) => !isHarpSource(path)))
}
// Used by both exportBase and checkoutPaths, so even historical/overlay paths
// absent from the final map are omitted before payload checkout.
export function harpOmissions(existing, policy) {
  if (!policy.enabled) return new Set(existing)
  return new class extends Set {
    has(value) { return super.has(value) || isHarpSource(value) }
  }(existing)
}
export function assertNoHarpManifest(manifest, policy) {
  if (!policy.enabled) return
  if (!Array.isArray(manifest?.files)) block('manifest_invalid')
  if (manifest.files.some(entry => isHarpPayload(entry.path))) block('harp_payload_in_manifest')
}
export function freshHarpReusePlan(plan, policy) {
  if (!policy.enabled) return plan
  assertNoHarpManifest(plan, policy)
  return { ...plan, legacyPaths: (plan.legacyPaths || []).filter(path => !isHarpUrl(path)) }
}
function present(path) {
  try { lstatSync(path); return true } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}
export function assertHarpStage(stage, policy) {
  if (!policy.enabled) return
  if (present(join(stage, HARP_SOURCE)) ||
      present(join(stage, 'dist', HARP_PREFIX.slice(1))) ||
      present(join(stage, '.vercel/output/static', HARP_PREFIX.slice(1)))) block('harp_directory_reappeared')
  assertHarpRoutes(json(readFileSync(join(stage, 'vercel.json'), 'utf8')), policy)
  // A builder must not turn off/change the committed policy after composition.
  const observed = parseHarpCutover(json(readFileSync(join(stage, CUTOVER_CONFIG), 'utf8')))
  if (JSON.stringify(observed) !== JSON.stringify(policy)) block('policy_changed_in_stage')
  for (const name of ['.iom-r2-reuse.json', '.iom-r2-release.json']) {
    const file = join(stage, name)
    if (!present(file)) continue
    const manifest = json(readFileSync(file, 'utf8'))
    assertNoHarpManifest(manifest, policy)
    if ((manifest.legacyPaths || []).some(isHarpUrl)) block('harp_legacy_reuse_path')
  }
}
// Seal only the isolated upload configuration after R2 preparation. The same
// read-only assertion runs last after Vercel rebuilds; unchanged guards remain.
export function sealHarpRemoteBuild(stage, policy) {
  if (!policy.enabled) return
  const file = join(stage, 'vercel.json'), config = json(readFileSync(file, 'utf8'))
  assertHarpStage(stage, policy)
  const accepted = ['npm run build', 'npm run build && node scripts/finalize-r2-build.mjs']
  const assertion = REMOTE_ASSERTION + ' ' + harpPolicyDigest(policy)
  if (accepted.some(command => config.buildCommand === command + assertion)) return
  if (!accepted.includes(config.buildCommand)) block('remote_build_command_changed')
  config.buildCommand += assertion
  writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== '--assert-stage' ||
      !/^[a-f0-9]{64}$/.test(process.argv[3])) block('assert_only_cli')
  const stage = process.cwd()
  const policy = parseHarpCutover(json(readFileSync(join(stage, CUTOVER_CONFIG), 'utf8')))
  if (!policy.enabled) block('remote_assertion_requires_active_policy')
  if (harpPolicyDigest(policy) !== process.argv[3]) block('remote_policy_changed')
  assertHarpStage(stage, policy)
}

