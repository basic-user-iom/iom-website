#!/usr/bin/env node
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
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
const MAX_SOURCE_BYTES = 800_000_000
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

function decodeScopeMap(encoded) {
  if (!encoded) return {}
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    fail('The live deployment has invalid scoped-snapshot metadata.')
  }
}

function productionState(deployment) {
  const meta = deployment?.meta || {}
  const base = meta.iomSnapshotBaseSha || meta.githubCommitSha
  ensureCommit(base, 'Production baseline')
  const overlays = decodeScopeMap(meta.iomScopeMap)
  for (const [scope, sha] of Object.entries(overlays)) {
    validateScopeName(scope)
    ensureCommit(sha, `Production overlay ${scope}`)
  }
  return { base, overlays }
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

function checkoutPaths(stage, commit, paths, suffix) {
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

function exportBase(stage, commit) {
  const { indexFile, env } = newAlternateIndex(stage, commit, 'base')
  const prefix = `${stage.replaceAll('\\', '/')}/`
  try {
    command('git', ['checkout-index', '--all', '--force', `--prefix=${prefix}`], { env })
  } finally {
    rmSync(indexFile, { force: true })
  }
}

function applyScope(stage, activeFiles, scope, commit, sequence) {
  const previous = [...activeFiles].filter((file) => matchesDeployScope(file, scope))
  for (const file of previous) {
    rmSync(join(stage, ...file.split('/')), { force: true })
    activeFiles.delete(file)
  }

  const next = listCommitFiles(commit).filter((file) => matchesDeployScope(file, scope))
  checkoutPaths(stage, commit, next, `overlay-${sequence}`)
  for (const file of next) activeFiles.add(file)
}

function composeSnapshot(state, scopes, head) {
  const stage = mkdtempSync(join(tmpdir(), 'iom-website-deploy-'))
  try {
    const fullSite = scopes.includes('site')
    const base = fullSite ? head : state.base
    const overlays = fullSite ? {} : { ...state.overlays }
    if (!fullSite) for (const scope of scopes) overlays[scope] = head

    exportBase(stage, base)
    const activeFiles = new Set(listCommitFiles(base))
    let sequence = 0
    for (const [scope, commit] of Object.entries(overlays)) {
      applyScope(stage, activeFiles, scope, commit, sequence++)
    }

    const projectFile = join(root, '.vercel', 'project.json')
    if (!existsSync(projectFile)) fail('Missing .vercel/project.json; link the project first.')
    mkdirSync(join(stage, '.vercel'), { recursive: true })
    copyFileSync(projectFile, join(stage, '.vercel', 'project.json'))

    return { stage, base, overlays }
  } catch (error) {
    cleanupStage(stage)
    throw error
  }
}

function buildSnapshot(stage) {
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
  try {
    packageCommand(npm, ['run', 'build'], { cwd: stage })
  } finally {
    rmSync(stageViewerModules, { force: true })
    rmSync(stageModules, { force: true })
  }
  if (!existsSync(join(stage, 'dist', 'index.html'))) fail('Isolated build did not produce dist/index.html.')
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

function verifyUploadManifest(stage, scopes) {
  const output = packageCommand(
    npx,
    ['--yes', 'vercel', 'deploy', '--dry', '--format=json', '--cwd', stage],
    { cwd: stage, capture: true },
  )
  const manifest = parseJsonOutput(output, 'Vercel deployment dry-run')
  if (manifest.totalSize > MAX_SOURCE_BYTES) {
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
  console.log(`\nUpload manifest: ${manifest.fileCount} files, ${(manifest.totalSize / 1_000_000).toFixed(1)} MB\n`)
}

function deploySnapshot(snapshot, head, scopes) {
  const scopeMap = Buffer.from(JSON.stringify(snapshot.overlays), 'utf8').toString('base64url')
  packageCommand(npx, [
    '--yes',
    'vercel',
    '--prod',
    '--yes',
    '--logs',
    '--cwd',
    snapshot.stage,
    '--meta',
    `githubCommitRef=master`,
    '--meta',
    `iomCommitSha=${head}`,
    '--meta',
    `iomDeployScope=${scopes.join(',')}`,
    '--meta',
    `iomSnapshotBaseSha=${snapshot.base}`,
    '--meta',
    `iomScopeMap=${scopeMap}`,
  ], { cwd: snapshot.stage })
}

function main() {
  const argv = process.argv.slice(2)
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
  const state = productionState(productionMetadata())
  const scopes = resolveScopes(requestedScopes(argv), state.base, head)
  const unpushed = validateUnpushedFiles(scopes, head)

  console.log(`\nProduction base:  ${state.base.slice(0, 8)}`)
  console.log(`Committed target: ${head.slice(0, 8)}`)
  if (workspaceHead !== head) console.log(`Workspace HEAD:    ${workspaceHead.slice(0, 8)} (newer commits remain local)`)
  console.log(`Release scope:    ${scopes.join(', ')}`)
  console.log(`Unpushed files:   ${unpushed.length}`)
  console.log('Workspace-only files are excluded from the release snapshot.\n')

  let snapshot
  try {
    snapshot = composeSnapshot(state, scopes, head)
    buildSnapshot(snapshot.stage)
    verifyUploadManifest(snapshot.stage, scopes)
    if (verifyOnly) {
      console.log('Verification complete. Nothing was pushed or deployed.\n')
      return
    }
    command('git', [
      '-c', 'http.version=HTTP/1.1',
      '-c', 'http.lowSpeedLimit=1',
      '-c', 'http.lowSpeedTime=30',
      'push', 'origin', `${head}:refs/heads/master`,
    ], { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
    deploySnapshot(snapshot, head, scopes)
  } finally {
    cleanupStage(snapshot?.stage)
  }
}

try {
  main()
} catch (error) {
  if (error?.name === 'DeployBlockedError') {
    console.error(`\nDeploy blocked: ${error.message}\n`)
  } else {
    console.error(error)
  }
  process.exitCode = 1
}
