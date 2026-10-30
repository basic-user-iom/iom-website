import { cutoverFromSnapshot, filterHarpSourceFiles, harpOmissions, freshHarpReusePlan, assertHarpStage, assertNoHarpManifest, assertHarpRootProjectBinding, sealHarpRemoteBuild } from './harp-root-cutover.mjs'
import { snapshotFiles, readProductionManifest, createReusePlan, prepareStagedReuse } from './incremental-r2-release.mjs'
import { requestedEmailReleasePhase } from './crm-email-release-phase.mjs'
import {protectedRelease, releaseOperation, releaseRecordName, operationPhase, RELEASE_TARGET} from './crm-email-protected-release.mjs'
import {parseHarpOperation, runHarpRelease} from './independent-harp-release.mjs'
import {createHarpCliAdapter} from './independent-harp-cli.mjs'
import { readComposition, assertComposition, buildReleaseMetadata, collectPreflight } from './release-provenance.mjs'
import { createHash } from 'node:crypto'
/**
 * Scoped production deployment.
 *
 * Vercel deployments are atomic, so this script composes a complete snapshot:
 * the files currently live in production plus only the requested scope(s) from
 * committed HEAD. Uncommitted and untracked workspace files are never copied.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertReleaseManifestSecrets, knownValuesFromEnvironment, SecretScanError, withScannedRelease } from './deploy-secret-scan.mjs'
import {
  inferDeployScope,
  isValidDemoSlug,
  isValidProjectSlug,
  knownDeployScopes,
  matchesDeployScope,
} from './deploy-scope.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nodeBin = dirname(process.execPath)
const npm = process.platform === 'win32'
  ? { file: process.execPath, prefix: [join(nodeBin, 'node_modules', 'npm', 'bin', 'npm-cli.js')] }
  : { file: 'npm', prefix: [] }
const npx = process.platform === 'win32'
  ? { file: process.execPath, prefix: [join(nodeBin, 'node_modules', 'npm', 'bin', 'npx-cli.js')] }
  : { file: 'npx', prefix: [] }
const MAX_SOURCE_BYTES = 1_000_000_000
const FORBIDDEN_UPLOAD_PREFIXES = [
  '.env',
  '.qa-out/',
  '.coverage-check.local/',
  '.linar-backups.local/',
  'automotive-studio/',
  'building-viewer/',
  'debug.log',
  'vendor/',
]

function fail(message) {
  const error = new Error(message)
  error.name = 'DeployBlockedError'
  throw error
}

function command(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    encoding: 'utf8',
    input: options.input,
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.capture ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    shell: false,
  })
  if (result.status !== 0) {
    if (options.capture && result.stderr) process.stderr.write(result.stderr)
    const detail = result.error ? ` (${result.error.message})` : ''
    fail(`${file} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}${detail}.`)
  }
  return options.capture ? String(result.stdout || '').trim() : ''
}

function git(args, options = {}) {
  return command('git', args, { ...options, capture: options.capture ?? true })
}

function packageCommand(tool, args, options = {}) {
  return command(tool.file, [...tool.prefix, ...args], options)
}

function cleanupStage(stage) {
  if (!stage) return
  try {
    rmSync(stage, {
      recursive: true,
      force: true,
      maxRetries: 12,
      retryDelay: 250,
    })
  } catch (error) {
    console.warn(`Warning: could not remove temporary deploy folder ${stage}: ${error.message}`)
    const cleanup = spawn(
      process.execPath,
      [join(root, 'scripts', 'cleanup-deploy-stage.mjs'), stage],
      { detached: true, stdio: 'ignore', windowsHide: true },
    )
    cleanup.unref()
  }
}

function parseJsonOutput(output, label) {
  const start = output.indexOf('{')
  if (start === -1) fail(`${label} did not return JSON.`)
  try {
    return JSON.parse(output.slice(start))
  } catch (error) {
    fail(`${label} returned invalid JSON: ${error.message}`)
  }
}

function requestedScopes(argv) {
  const values = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--verify-only') continue
    if (arg === '--crm-email-access-phase') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) fail('--crm-email-access-phase requires PREPARED or ACTIVE.')
      index += 1
      continue
    }
    if (arg.startsWith('--crm-email-access-phase=')) {
      if (!arg.slice('--crm-email-access-phase='.length)) fail('--crm-email-access-phase requires PREPARED or ACTIVE.')
      continue
    }
    if (arg === '--target') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) fail('--target requires a commit SHA.')
      index += 1
      continue
    }
    if (arg.startsWith('--target=')) {
      if (!arg.slice('--target='.length)) fail('--target requires a commit SHA.')
      continue
    }
    if (arg === '--scope') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) fail('--scope requires a value.')
      values.push(argv[++index])
    }
    else if (arg.startsWith('--scope=')) values.push(arg.slice('--scope='.length))
    else fail(`Unknown deploy option "${arg}".`)
  }
  return [...new Set(values.flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean))]
}

function requestedTarget(argv) {
  const values = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--target') values.push(argv[++index])
    else if (arg.startsWith('--target=')) values.push(arg.slice('--target='.length))
  }
  const unique = [...new Set(values.filter(Boolean))]
  if (unique.length > 1) fail('Specify only one --target commit SHA.')
  return unique[0] || ''
}

function validateScopeName(scope) {
  const named = knownDeployScopes().filter((value) => !value.includes('<'))
  if (named.includes(scope)) return
  if (scope.startsWith('demo:') && isValidDemoSlug(scope.slice('demo:'.length))) return
  if (scope.startsWith('project:') && isValidProjectSlug(scope.slice('project:'.length))) return
  fail(`Unknown deploy scope "${scope}". Known scopes: ${knownDeployScopes().join(', ')}`)
}

function changedFiles(fromSha, toSha) {
  const output = git(['diff', '--name-only', '--diff-filter=ACDMRTUXB', `${fromSha}..${toSha}`])
  return output.split(/\r?\n/).map((file) => file.trim()).filter(Boolean)
}

function resolveScopes(explicit, productionBase, head) {
  if (explicit.length > 0) {
    for (const scope of explicit) validateScopeName(scope)
    return explicit.includes('site') ? ['site'] : explicit
  }

  const origin = git(['rev-parse', 'origin/master'])
  const unpushedFiles = changedFiles(origin, head)
  const candidates = unpushedFiles.length > 0 ? unpushedFiles : changedFiles(productionBase, head)
  const inferred = inferDeployScope(candidates)
  if (!inferred || inferred === 'redeploy') {
    console.error('Could not safely infer one project/demo scope from these committed files:')
    for (const file of candidates.slice(0, 30)) console.error(`  ${file}`)
    fail('Specify --scope <demo-or-project>. Use --scope site only for an explicitly requested full-site release.')
  }
  return [inferred]
}

function validateUnpushedFiles(scopes, head) {
  const origin = git(['rev-parse', 'origin/master'])
  const files = changedFiles(origin, head)
  if (files.length === 0 || scopes.includes('site')) return files

  const invalid = files.filter((file) => !scopes.some((scope) => matchesDeployScope(file, scope)))
  if (invalid.length > 0) {
    console.error('Unpushed committed files outside the requested scope(s):')
    for (const file of invalid.slice(0, 30)) console.error(`  ${file}`)
    fail('Refusing to push unrelated committed work to master.')
  }
  return files
}

function productionMetadata() {
  const output = packageCommand(
    npx,
    ['--yes', 'vercel', 'api', '/v13/deployments/iobjectm.com'],
    { capture: true },
  )
  return parseJsonOutput(output, 'Vercel production lookup')
}

function ensureCommit(sha, label) {
  if (!/^[0-9a-f]{40}$/i.test(String(sha || ''))) fail(`${label} is not a Git commit SHA.`)
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: root, stdio: 'ignore' })
  } catch {
    fail(`${label} commit ${sha} is not available in this repository.`)
  }
}

function ensureAncestor(ancestor, descendant, message) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
    cwd: root,
    stdio: 'ignore',
    windowsHide: true,
  })
  if (result.status !== 0) fail(message)
}

function productionState(deployment) {
  // Read the reviewed committed record, never an unrelated working-tree edit.
  const {descriptor, descriptorDigest} = JSON.parse(git(['show', 'HEAD:config/release-provenance.json']))
  const allowedScopes = provenanceScopes(descriptor.scopeMap, deployment.meta?.iomScopeMap)
  const state = readComposition(deployment, {descriptor, descriptorDigest, allowedScopes})
  const missing = missingCompositionCommits(state)
  if (missing.length) fail(`Required composition commits unavailable: ${missing.join(', ')}`)
  return state
}

function provenanceScopes(...encodedMaps) {
  const scopes = new Set(knownDeployScopes().filter(scope => !scope.includes('<')))
  for (const encoded of encodedMaps.filter(Boolean)) {
    const map = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    for (const scope of Object.keys(map)) { validateScopeName(scope); scopes.add(scope) }
  }
  return [...scopes]
}

function missingCompositionCommits(state) {
  return [...new Set([state.base, ...Object.values(state.overlays)])].filter(sha =>
    spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], {cwd:root, stdio:'ignore', windowsHide:true}).status !== 0)
}

function readOnlyPreflight() {
  const details = [], checks = {}, expectedCurrentId = 'dpl_C5o1HEzRTwe8F5T3APau2F4SWUA3'
  let currentId, state
  try {
    const {descriptor, descriptorDigest} = JSON.parse(git(['show', 'HEAD:config/release-provenance.json']))
    const deployment = productionMetadata()
    currentId = deployment.id
    state = readComposition(deployment, {descriptor, descriptorDigest,
      allowedScopes:provenanceScopes(descriptor.scopeMap, deployment.meta?.iomScopeMap)})
    checks.sourceBindings = true
  } catch (error) { details.push({check:'sourceBindings', code:error.code || 'committed_provenance_unavailable'}) }
  if (state) {
    const missing = missingCompositionCommits(state)
    checks.gitObjects = missing.length === 0
    if (missing.length) details.push({check:'gitObjects', missing})
  }
  try { checks.candidateClean = !git(['status', '--porcelain']) }
  catch { checks.candidateClean = false }
  // These gates require the exact prepared artifact; this cheap read-only pass
  // reports them as pending, never substitutes a cached PASS for their checks.
  const result = collectPreflight({expectedCurrentId:currentId && state ? currentId : expectedCurrentId,
    currentId, checks, testReuse:[]})
  console.log(JSON.stringify({...result, details, pending:['tests','scanner','r2','sitemap']}, null, 2))
  return result
}

function assertRetainedStore(snapshot) {
  const bytes = readFileSync(join(snapshot.stage, 'api', '_lib', 'crm-email-store.mjs'))
  const expected = execFileSync('git', ['show', `${snapshot.provenance.store.commit}:api/_lib/crm-email-store.mjs`], {cwd:root})
  // Exact bytes prevent a later overlapping scope or build from undoing it.
  if (!bytes.equals(expected)) fail('retained_store_bytes_changed')
  assertComposition({descriptor:snapshot.provenance, descriptorDigest:snapshot.provenanceDigest,
    base:snapshot.base, scopeMap:Buffer.from(JSON.stringify(snapshot.overlays)).toString('base64url'),
    files:[{path:'api/_lib/crm-email-store.mjs',sha1:createHash('sha1').update(bytes).digest('hex')}]},
    provenanceScopes(Buffer.from(JSON.stringify(snapshot.overlays)).toString('base64url')))
}

function listCommitFiles(commit) {
  const output = git(['ls-tree', '-r', '--name-only', commit])
  return output.split(/\r?\n/).map((file) => file.trim()).filter(Boolean)
}

function newAlternateIndex(stage, commit, suffix) {
  const indexFile = join(stage, `.git-index-${suffix}`)
  const env = { ...process.env, GIT_INDEX_FILE: indexFile }
  command('git', ['read-tree', commit], { env })
  return { indexFile, env }
}

function checkoutPaths(stage, commit, paths, suffix, omitted = new Set()) {
  paths = paths.filter(path => !omitted.has(path))
  if (paths.length === 0) return
  const { indexFile, env } = newAlternateIndex(stage, commit, suffix)
  const prefix = `${stage.replaceAll('\\', '/')}/`
  try {
    for (let index = 0; index < paths.length; index += 100) {
      command('git', [
        'checkout-index',
        '--force',
        `--prefix=${prefix}`,
        '--',
        ...paths.slice(index, index + 100),
      ], { env })
    }
  } finally {
    rmSync(indexFile, { force: true })
  }
}

function exportBase(stage, commit, omitted = new Set()) {
  const { indexFile, env } = newAlternateIndex(stage, commit, 'base')
  const prefix = `${stage.replaceAll('\\', '/')}/`
  try {
    // Development configuration is not a release asset. Remove the env template
    // and editor/CI tooling from the isolated export BEFORE reading their bytes.
    // The real repository/index remain untouched; credential-path scanning of
    // the complete upload manifest remains mandatory and has no exception.
    const developmentOnly = listCommitFiles(commit).filter(file =>
      omitted.has(file) || file === '.env.example' || file.startsWith('.cursor/') || file.startsWith('.github/'))
    for (let offset = 0; offset < developmentOnly.length; offset += 100)
      command('git', ['update-index', '--force-remove', '--', ...developmentOnly.slice(offset, offset + 100)], { env })
    command('git', ['checkout-index', '--all', '--force', `--prefix=${prefix}`], { env })
  } finally {
    rmSync(indexFile, { force: true })
  }
}

function applyScope(stage, activeFiles, scope, commit, sequence, omitted = new Set()) {
  const previous = [...activeFiles].filter((file) => matchesDeployScope(file, scope))
  for (const file of previous) {
    rmSync(join(stage, ...file.split('/')), { force: true })
    activeFiles.delete(file)
  }

  const next = listCommitFiles(commit).filter((file) => matchesDeployScope(file, scope))
  checkoutPaths(stage, commit, next, `overlay-${sequence}`, omitted)
  for (const file of next) activeFiles.add(file)
}

function composeSnapshot(state, scopes, head, productionManifest, deploymentId) {
  const stage = mkdtempSync(join(tmpdir(), 'iom-website-deploy-'))
  try {
    const fullSite = scopes.includes('site')
    const base = fullSite ? head : state.base
    const overlays = fullSite ? {} : { ...state.overlays }
    if (!fullSite) for (const scope of scopes) {
      // Replace in place: inherited precedence is part of release provenance.
      overlays[scope] = head
    }
    const currentFiles = snapshotFiles(root, base, overlays)
    const cutover = cutoverFromSnapshot(currentFiles, entry => git(['cat-file', 'blob', entry.oid]))
    const reuse = freshHarpReusePlan(createReusePlan({ root, deploymentId, manifest: productionManifest,
      files: filterHarpSourceFiles(currentFiles, cutover), previousFiles: snapshotFiles(root, state.base, state.overlays),
      knownValues: knownValuesFromEnvironment(process.env) }), cutover)
    const omitted = harpOmissions(reuse.omitted, cutover)
    console.log(`Reusing ${reuse.files.length} media paths (${(reuse.reusedBytes / 1_000_000).toFixed(2)} MB) without staging their payloads.`)
    exportBase(stage, base, omitted)
    const activeFiles = new Set(listCommitFiles(base))
    let sequence = 0
    for (const [scope, commit] of Object.entries(overlays)) {
      applyScope(stage, activeFiles, scope, commit, sequence++, omitted)
    }

    assertHarpStage(stage, cutover)
    const projectFile = join(root, '.vercel', 'project.json')
    if (!existsSync(projectFile)) fail('Missing .vercel/project.json; link the project first.')
    if (cutover.enabled) assertHarpRootProjectBinding(JSON.parse(readFileSync(projectFile, 'utf8')), cutover)
    mkdirSync(join(stage, '.vercel'), { recursive: true })
    copyFileSync(projectFile, join(stage, '.vercel', 'project.json'))

    const reuseIdentity = prepareStagedReuse(stage, reuse)
    assertHarpStage(stage, cutover)
    const snapshot = { stage, base, overlays, reuse, reuseIdentity, cutover,
      provenance:state.provenance, provenanceDigest:state.provenanceDigest,
      parentOverlays:{...state.overlays}, parentDeploymentId:deploymentId }
    assertRetainedStore(snapshot)
    return snapshot
  } catch (error) {
    cleanupStage(stage)
    throw error
  }
}

function buildSnapshot(stage, scopes, reuse, emailPhase, cutover, emailKind = '') {
  assertHarpStage(stage, cutover)
  const emailOnly = scopes.length === 1 && scopes[0] === 'crm-email'
  const crmOnly = scopes.length === 1 && scopes[0] === 'crm'
  // Restore the exact committed ICM GLB before the static build and R2 upload.
  const viewerAssets = join(stage, 'building-viewer', 'scripts', 'prepare-runtime-assets.mjs')
  if (existsSync(viewerAssets) && !reuse?.runtimeComplete) command(process.execPath, [viewerAssets], { cwd: stage })
  const sourceModules = join(root, 'node_modules')
  if (!existsSync(sourceModules)) fail('Root node_modules is missing. Run npm install first.')
  const stageModules = join(stage, 'node_modules')
  const sourceViewerModules = join(root, 'building-viewer', 'node_modules')
  const stageViewerModules = join(stage, 'building-viewer', 'node_modules')
  symlinkSync(sourceModules, stageModules, process.platform === 'win32' ? 'junction' : 'dir')
  if (!existsSync(sourceViewerModules)) {
    fail('Building Viewer node_modules is missing. Run npm --prefix building-viewer install first.')
  }
  symlinkSync(
    sourceViewerModules,
    stageViewerModules,
    process.platform === 'win32' ? 'junction' : 'dir',
  )
  const emailEnv = emailOnly ? { ...process.env, IOM_SKIP_BLOG_SYNC: 'true', CRM_EMAIL_RELEASE_PHASE: emailPhase } : null
  if (emailEnv) {
    if (emailKind) emailEnv.CRM_EMAIL_RELEASE_KIND = emailKind
    else delete emailEnv.CRM_EMAIL_RELEASE_KIND
  }
  try {
    packageCommand(npm, ['run', 'build'], { cwd: stage,
      env: emailOnly ? emailEnv : (crmOnly || (scopes.length === 1 && ['storm-publication', 'iom-featured-work'].includes(scopes[0]))) ? { ...process.env, IOM_SKIP_BLOG_SYNC: 'true' } : process.env })
  } finally {
    rmSync(stageViewerModules, { force: true })
    rmSync(stageModules, { force: true })
  }
  if (!existsSync(join(stage, 'dist', 'index.html'))) fail('Isolated build did not produce dist/index.html.')
  assertHarpStage(stage, cutover)
}

function demoSlugForScope(scope) {
  if (scope === 'building-viewer') return 'icm-building'
  if (['automotive-studio', 'panorama-360', 'streets-gl'].includes(scope)) {
    return scope
  }
  if (scope.startsWith('demo:')) return scope.slice('demo:'.length)
  if (scope.startsWith('project:')) return scope.slice('project:'.length)
  return null
}

function writeVerificationAudit(name, value) {
  if (!process.argv.includes('--verify-only') || !requestedScopes(process.argv.slice(2)).includes('storm-publication')) return
  const directory = join(root, '.qa-out', 'storm-verification')
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, name + '.json'), JSON.stringify(value, null, 2) + '\n')
}

function verifyUploadManifest(stage, scopes, scanOptions, preparingAssets = false, cutover) {
  if (!preparingAssets) sealHarpRemoteBuild(stage, cutover)
  assertHarpStage(stage, cutover)
  scanOptions = { ...scanOptions, phase: preparingAssets ? 'pre-r2' : 'upload' }
  const output = packageCommand(
    npx,
    ['--yes', 'vercel', 'deploy', '--dry', '--format=json', '--cwd', stage],
    { cwd: stage, capture: true },
  )
  const manifest = parseJsonOutput(output, 'Vercel deployment dry-run')
  if (manifest.totalSize > MAX_SOURCE_BYTES && !preparingAssets) {
    console.error('\nLargest deployment directories:')
    for (const directory of (manifest.directories || []).slice(0, 20)) {
      console.error(`  ${(Number(directory.size || 0) / 1_000_000).toFixed(1).padStart(7)} MB  ${directory.path} (${directory.fileCount} files)`)
    }
    console.error('\nLargest deployment files:')
    for (const file of (manifest.largestFiles || []).slice(0, 20)) {
      console.error(`  ${(Number(file.size || 0) / 1_000_000).toFixed(1).padStart(7)} MB  ${file.path}`)
    }
    fail(`Deployment source is ${(manifest.totalSize / 1_000_000).toFixed(1)} MB; safety limit is ${(MAX_SOURCE_BYTES / 1_000_000).toFixed(0)} MB.`)
  }
  if (manifest.fileCount > 15_000) fail(`Deployment contains ${manifest.fileCount} files; limit is 15,000.`)

  const included = (manifest.files || []).map((entry) => String(entry.path || '').replaceAll('\\', '/'))
  const forbidden = included.filter((file) =>
    FORBIDDEN_UPLOAD_PREFIXES.some((prefix) =>
      prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix,
    ),
  )
  if (forbidden.length > 0) {
    console.error('Forbidden local/source paths in upload manifest:')
    for (const file of forbidden.slice(0, 30)) console.error(`  ${file}`)
    fail('Deployment manifest contains files that must stay local.')
  }

  for (const scope of scopes) {
    const slug = demoSlugForScope(scope)
    if (!slug) continue
    const publishedIndex = `public/demos/${slug}/index.html`
    if (existsSync(join(stage, ...publishedIndex.split('/'))) && !included.includes(publishedIndex)) {
      fail(`${publishedIndex} is missing from the upload manifest for scope "${scope}".`)
    }
  }
  assertNoHarpManifest(manifest, cutover)
  const scan = assertReleaseManifestSecrets(stage, manifest, scanOptions)
  if (process.argv.includes('--verify-only') && scopes.length === 1 && scopes[0] === 'storm-publication') {
    writeVerificationAudit(preparingAssets ? 'pre-r2-upload' : 'final-upload', {
      fileCount: manifest.fileCount, totalSize: manifest.totalSize,
      files: manifest.files.map(entry => ({path: entry.path.replaceAll('\\', '/'), size: entry.size,
        directory: (entry.mode & 0o170000) === 0o040000,
        sha1: (entry.mode & 0o170000) === 0o040000 ? null : createHash('sha1').update(readFileSync(join(stage, entry.path))).digest('hex')}))
    })
  }
  console.log(`\nUpload manifest: ${manifest.fileCount} files, ${(manifest.totalSize / 1_000_000).toFixed(1)} MB; configured secret checks passed.\n`)
  console.log(JSON.stringify({ phase: preparingAssets ? 'pre-r2' : 'upload', files: manifest.fileCount, bytes: manifest.totalSize }))
  return scan
}

function assertProductionUnchanged(snapshot) {
  const current = productionMetadata()
  if (current.id !== snapshot.parentDeploymentId || current.projectId !== snapshot.provenance.projectId ||
      current.target !== 'production' || current.readyState !== 'READY') fail('production_changed_after_preparation')
  const state = productionState(current)
  if (JSON.stringify(state.overlays) !== JSON.stringify(snapshot.parentOverlays)) fail('production_composition_changed_after_preparation')
}

function deploySnapshot(snapshot, head, scopes, emailPhase) {
  assertProductionUnchanged(snapshot)
  assertHarpStage(snapshot.stage, snapshot.cutover)
  assertRetainedStore(snapshot)
  const emailOnly = scopes.length === 1 && scopes[0] === 'crm-email'
  const crmOnly = scopes.length === 1 && scopes[0] === 'crm'
  const metadata = buildReleaseMetadata({descriptor:snapshot.provenance, descriptorDigest:snapshot.provenanceDigest,
    base:snapshot.base, overlays:snapshot.overlays, parentOverlays:snapshot.parentOverlays,
    head, scope:scopes.join(','), parentDeploymentId:snapshot.parentDeploymentId},
    provenanceScopes(Buffer.from(JSON.stringify(snapshot.overlays)).toString('base64url')))
  packageCommand(npx, [
    '--yes',
    'vercel',
    '--prod',
    '--yes',
    '--logs',
    '--cwd',
    snapshot.stage,
    ...(emailOnly ? ['--build-env', 'IOM_SKIP_BLOG_SYNC=true', '--build-env', `CRM_EMAIL_RELEASE_PHASE=${emailPhase}`] : []),
    ...(crmOnly ? ['--build-env', 'IOM_SKIP_BLOG_SYNC=true'] : []),
    ...(scopes.length === 1 && ['release-provenance', 'storm-publication', 'iom-featured-work'].includes(scopes[0]) ? ['--build-env', 'IOM_SKIP_BLOG_SYNC=true'] : []),
    ...(scopes.length === 1 && scopes[0] === 'project:lobo-mobo-study' && process.env.IOM_SKIP_BLOG_SYNC === 'true'
      ? ['--build-env', 'IOM_SKIP_BLOG_SYNC=true'] : []),
    ...Object.entries(metadata).flatMap(([key, value]) => ['--meta', `${key}=${value}`]),
  ], { cwd: snapshot.stage })
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 1 && argv[0] === '--preflight') {
    if (!readOnlyPreflight().ok) process.exitCode = 1
    return
  }
  const harpOperation = parseHarpOperation(argv)
  if (harpOperation) {
    const result = runHarpRelease({root,args:harpOperation,adapter:createHarpCliAdapter(root)})
    console.log('[harp-independent-release] '+JSON.stringify(result))
    return
  }
  const protectedOperation = releaseOperation(argv)
  if(protectedOperation) return runProtectedRelease(protectedOperation)
  const verifyOnly = argv.includes('--verify-only')
  command(process.execPath, [join(root, 'scripts', 'pre-deploy-check.mjs')])
  const workspaceHead = git(['rev-parse', 'HEAD'])
  const target = requestedTarget(argv)
  const head = target ? git(['rev-parse', `${target}^{commit}`]) : workspaceHead
  ensureCommit(head, 'Target')
  if (target) {
    const origin = git(['rev-parse', 'origin/master'])
    ensureAncestor(origin, head, 'Target must be a descendant of origin/master; refusing a non-fast-forward release.')
    ensureAncestor(head, workspaceHead, 'Target must be an ancestor of the current local master branch.')
  }
  const deployment = productionMetadata()
  const state = productionState(deployment)
  const productionManifest = readProductionManifest(root, deployment, route => {
    const output = packageCommand(npx, ['--no-install', 'vercel', 'api', route], { capture: true })
    const parsed = JSON.parse(output.slice(Math.min(...[output.indexOf('['), output.indexOf('{')].filter(n => n >= 0))))
    if (route.endsWith('/files')) writeVerificationAudit('production-files', parsed)
    return parsed
  })
  const scopes = resolveScopes(requestedScopes(argv), state.base, head)
  if(!verifyOnly && scopes.includes('crm-email'))fail('CRM release requires --scope=crm-email --crm-email-release=stage|inspect|promote|prepared|active')
  const emailPhase = requestedEmailReleasePhase(argv, scopes)
  const unpushed = validateUnpushedFiles(scopes, head)

  console.log(`\nProduction base:  ${state.base.slice(0, 8)}`)
  console.log(`Committed target: ${head.slice(0, 8)}`)
  if (workspaceHead !== head) console.log(`Workspace HEAD:    ${workspaceHead.slice(0, 8)} (newer commits remain local)`)
  console.log(`Release scope:    ${scopes.join(', ')}`)
  if(scopes.length===1 && scopes[0]==='crm-email')console.log(`CRM access phase: ${emailPhase}`)
  console.log(`Unpushed files:   ${unpushed.length}`)
  console.log('Workspace-only files are excluded from the release snapshot.\n')

  let snapshot
  try {
    snapshot = composeSnapshot(state, scopes, head, productionManifest, deployment.id)
    buildSnapshot(snapshot.stage, scopes, snapshot.reuse, emailPhase, snapshot.cutover)
    assertRetainedStore(snapshot)
    writeVerificationAudit('composition', {base: snapshot.base, overlays: snapshot.overlays,
      parentOverlays: snapshot.parentOverlays, productionId: snapshot.parentDeploymentId,
      target: head, retainedStoreVerified: true})
    if (existsSync(join(snapshot.stage, 'config/website-r2.json'))) {
      // Check the complete source before moving public media out of the package.
      // The final reduced upload still passes the normal size and content gates.
      verifyUploadManifest(snapshot.stage, scopes, { knownValues: knownValuesFromEnvironment(process.env) }, true, snapshot.cutover)
      command(process.execPath, [
        join(root, 'scripts/prepare-r2-release.mjs'), '--stage', snapshot.stage,
        ...(snapshot.reuseIdentity ? ['--reuse-identity', snapshot.reuseIdentity] : []),
        ...(verifyOnly || (scopes.length === 1 && ['crm', 'storm-publication', 'iom-featured-work'].includes(scopes[0])) ? ['--verify-only'] : []),
      ])
    }
    const knownValues = knownValuesFromEnvironment(process.env)
    withScannedRelease({
      verifyOnly,
      // Git hooks may run during push. Re-enumerate and re-scan the exact upload
      // before publication; changed paths/bytes refuse instead of reusing a pass.
      scan: expectedIdentity => verifyUploadManifest(snapshot.stage, scopes, { knownValues, expectedIdentity }, false, snapshot.cutover),
      push: () => { assertProductionUnchanged(snapshot); return command('git', [
        '-c', 'http.version=HTTP/1.1',
        '-c', 'http.postBuffer=209715200',
        '-c', 'http.lowSpeedLimit=1',
        '-c', 'http.lowSpeedTime=30',
        'push', 'origin', `${head}:refs/heads/master`,
      ], { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }) },
      publish: () => deploySnapshot(snapshot, head, scopes, emailPhase),
    })
    if (verifyOnly) console.log('Verification complete. Nothing was pushed or deployed.\n')
  } finally {
    cleanupStage(snapshot?.stage)
  }
}

function runProtectedRelease(operation) {
  const workspaceHead=git(['rev-parse','HEAD'])
  const record=join(root,'.qa-out',releaseRecordName(operation),'state.json')
  const applicationHead=operation==='stage'||operation==='upgrade'?workspaceHead:JSON.parse(readFileSync(record,'utf8')).head
  ensureCommit(applicationHead,'Pinned CRM application')
  ensureAncestor(applicationHead,workspaceHead,'Pinned application is not an ancestor of the launcher.')
  const launcherFiles=['scripts/deploy-production.mjs','scripts/crm-email-protected-release.mjs']
  if(changedFiles(applicationHead,workspaceHead).some(path=>!launcherFiles.includes(path)))
    fail('Runtime source changed after build A; pinned checks cannot continue.')
  // Existing local authentication only. Suppress raw remote errors/logs, which
  // can contain private source or environment diagnostics.
  const cli = (args, options={}) => {
    const result=spawnSync(npx.file,[...npx.prefix,'--no-install','vercel',...args,
      '--scope',RELEASE_TARGET.team,'--non-interactive'],{
      cwd:options.cwd||root,env:{...process.env,NO_UPDATE_NOTIFIER:'1'},
      encoding:'utf8',stdio:['ignore','pipe','pipe'],shell:false,
      timeout:args[0]==='deploy'?300_000:args[0]==='promote'?190_000:60_000,maxBuffer:32*1024*1024})
    if(result.status!==0)fail('protected_cli_failed_or_unknown; inspect existing operation before retrying')
    return args[0]==='inspect'?String(result.stdout||'')+'\n'+String(result.stderr||''):String(result.stdout||'')
  }
  const api = route => parseJsonOutput(cli(['api',route]),'Protected metadata')
  const result=protectedRelease({root,operation,head:applicationHead,api,cli,
    preflight:()=>command(process.execPath,[join(root,'scripts','pre-deploy-check.mjs')]),
    checkUrl:url=>{
      const r=spawnSync(process.platform==='win32'?'curl.exe':'curl',
        ['--disable','--head','--silent','--max-time','15','--output',process.platform==='win32'?'NUL':'/dev/null',
          '--write-out','%{http_code}\n%{redirect_url}','https://'+url],
        {encoding:'utf8',shell:false,timeout:20_000,stdio:['ignore','pipe','pipe']})
      if(r.status!==0)return {status:0}
      const [status,location]=String(r.stdout).split(/\r?\n/)
      let redirect
      try{redirect=new URL(location)}catch{}
      return {status:Number(status),locationOrigin:redirect?.origin,locationPath:redirect?.pathname}
    },
    prepare:({baseline,state:releaseState,publish})=>{
      const head=applicationHead,scopes=['crm-email']
      const liveState=productionState(baseline)
      const phase=operationPhase(operation)
      const unpushed=validateUnpushedFiles(scopes,workspaceHead)
      if(releaseState && unpushed.some(path=>!launcherFiles.includes(path)))fail('protected_check_cannot_push_new_source')
      const manifest=readProductionManifest(root,baseline,route=>JSON.parse(cli(['api',route])))
      let snapshot,publicationResult
      try {
        snapshot=composeSnapshot(liveState,scopes,head,manifest,baseline.id)
        // Preserve the current complete configuration, including cable routing
        // and cron definitions. A CRM scope must not replace a newer config.
        const configCommit=Object.entries(liveState.overlays).reduce((chosen,[scope,commit])=>
          matchesDeployScope('vercel.json',scope)?commit:chosen,liveState.base)
        const oldConfig=execFileSync('git',['show',`${configCommit}:vercel.json`],{cwd:root})
        const newConfig=execFileSync('git',['show',`${head}:vercel.json`],{cwd:root})
        if(!oldConfig.equals(newConfig))fail('protected_vercel_config_drift')
        buildSnapshot(snapshot.stage,scopes,snapshot.reuse,phase,snapshot.cutover,operation==='upgrade'?'upgrade':'')
        if(existsSync(join(snapshot.stage,'config/website-r2.json'))) {
          verifyUploadManifest(snapshot.stage,scopes,{knownValues:knownValuesFromEnvironment(process.env)},true,snapshot.cutover)
          command(process.execPath,[join(root,'scripts/prepare-r2-release.mjs'),'--stage',snapshot.stage,
            ...(snapshot.reuseIdentity?['--reuse-identity',snapshot.reuseIdentity]:[])])
        }
        const knownValues=knownValuesFromEnvironment(process.env)
        withScannedRelease({verifyOnly:false,
          scan:expectedIdentity=>verifyUploadManifest(snapshot.stage,scopes,{knownValues,expectedIdentity},false,snapshot.cutover),
          push:()=>command('git',['-c','http.version=HTTP/1.1','-c','http.postBuffer=209715200',
            '-c','http.lowSpeedLimit=1','-c','http.lowSpeedTime=30',
            'push','origin',`${workspaceHead}:refs/heads/master`],{env:{...process.env,GIT_TERMINAL_PROMPT:'0'}}),
          publish:()=>{publicationResult=publish(snapshot)},
        })
        return publicationResult
      } finally {cleanupStage(snapshot?.stage)}
    },
  })
  console.log('[crm-protected-release] '+JSON.stringify(result))
}

try {
  main()
} catch (error) {
  if (error instanceof SecretScanError) {
    console.error(`\nDeploy blocked: ${error.code}. No matched content was printed.\n`)
    if (error.fileCheck) console.error(JSON.stringify({ fileCheck: error.fileCheck }))
    if (error.contentChecks) console.error(JSON.stringify({ contentChecks: error.contentChecks }))
    else if (error.contentCheck) console.error(JSON.stringify({ contentCheck: error.contentCheck }))
  } else if (error?.name === 'DeployBlockedError') {
    console.error(`\nDeploy blocked: ${error.message}\n`)
  } else {
    console.error(error)
  }
  process.exitCode = 1
}
