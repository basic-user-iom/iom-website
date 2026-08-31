#!/usr/bin/env node
/**
 * Blocks production deploy when git state is unsafe. The deploy exports committed
 * HEAD into an isolated directory, so workspace-only changes remain local.
 */
import { execSync, spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, options = {}) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', ...options }).trim()
}

function runGit(args, { timeout = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: root,
      env: {
        ...process.env,
        GIT_HTTP_LOW_SPEED_LIMIT: '1',
        GIT_HTTP_LOW_SPEED_TIME: '30',
        GIT_TERMINAL_PROMPT: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let settled = false

    const finish = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(stdout.trim())
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', finish)
    child.on('close', (code, signal) => {
      if (code === 0) finish()
      else finish(new Error(`git ${args.join(' ')} exited with ${code ?? signal}: ${stderr.trim()}`))
    })

    const timer = setTimeout(() => {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      }
      child.kill('SIGKILL')
      finish(new Error(`git ${args.join(' ')} exceeded ${timeout} ms`))
    }, timeout)
  })
}

function fail(message) {
  console.error(`\n❌ Deploy blocked: ${message}\n`)
  console.error('See DEPLOY.md for the full checklist.\n')
  process.exit(1)
}

function warn(message) {
  console.warn(`⚠️  ${message}`)
}

if (!existsSync(join(root, 'package.json'))) {
  fail('Run this script from the iom_website repo root.')
}

let branch = 'unknown'
try {
  branch = run('git rev-parse --abbrev-ref HEAD')
} catch {
  fail('Not a git repository.')
}

if (branch !== 'master') fail(`Current branch is "${branch}", not master.`)

const head = run('git rev-parse HEAD')
const headShort = run('git rev-parse --short HEAD')
const headSubject = run('git log -1 --format=%s')

console.log(`\nPre-deploy check — ${headShort} ${headSubject}\n`)

// Workspace-only changes are excluded by deploy-production.mjs.
const porcelain = run('git status --porcelain')
const dirtyTracked = porcelain
  .split('\n')
  .filter(Boolean)
  .filter((line) => {
    const x = line[0]
    const y = line[1]
    return x !== '?' && y !== '?' && (x !== ' ' || y !== ' ')
  })

if (dirtyTracked.length > 0) {
  warn(`${dirtyTracked.length} uncommitted tracked change(s) will NOT be deployed:`)
  for (const line of dirtyTracked.slice(0, 8)) console.warn(`  ${line}`)
  if (dirtyTracked.length > 8) console.warn(`  ... and ${dirtyTracked.length - 8} more`)
}

// Untracked files — warn only (360/, probe scripts, etc.)
const untracked = porcelain.split('\n').filter((line) => line.startsWith('??'))
if (untracked.length > 0) {
  warn(`${untracked.length} untracked path(s) will NOT be deployed unless committed:`)
  for (const line of untracked.slice(0, 8)) console.warn(`  ${line.slice(3)}`)
  if (untracked.length > 8) console.warn(`  … and ${untracked.length - 8} more`)
}

// Refresh origin so a later scoped push cannot overwrite newer remote work.
try {
  await runGit(['fetch', 'origin', 'master', '--quiet'])
} catch {
  fail('Could not refresh origin/master within 120 seconds. Retry when GitHub is reachable; deployment was not started.')
}

let unpushed = 0
try {
  unpushed = run('git rev-list --count origin/master..HEAD')
    .split('\n')[0]
    .trim()
  unpushed = Number.parseInt(unpushed, 10) || 0
} catch {
  warn('No upstream tracking branch — push to origin/master before deploy.')
}

if (unpushed > 0) console.log(`${unpushed} committed change(s) will be pushed by the safe deploy.`)

let behind = 0
try {
  behind = Number.parseInt(run('git rev-list --count HEAD..origin/master'), 10) || 0
} catch {
  /* ignore */
}

if (behind > 0) {
  fail(`Local master is ${behind} commit(s) behind origin/master. Pull before deploying.`)
}

// Stash warning
const stashList = run('git stash list')
if (stashList) {
  warn('Git stash entries exist. Do not `stash pop` unless you know what they contain:')
  for (const line of stashList.split('\n').slice(0, 3)) console.warn(`  ${line}`)
}

// High-risk file reminder if recently changed in last commit
const lastFiles = run('git diff-tree --no-commit-id --name-only -r HEAD')
  .split('\n')
  .filter(Boolean)
const risky = [
  'src/data/projects.ts',
  'src/utils/createMusicPlayerVisualizer.ts',
  'src/utils/musicPlayerFftOceanVisualizer.ts',
  'public/demos/panorama-360/',
  'public/demos/ssr-denoise/index.html',
  'public/demos/volume-lighting/index.html',
  'src/crm/',
]
const touchedRisky = lastFiles.filter((f) => risky.some((r) => f.startsWith(r) || f === r))
if (touchedRisky.length > 0) {
  console.log('Latest commit touches high-risk paths — verify after deploy:')
  for (const f of touchedRisky) console.log(`  • ${f}`)
}

console.log(`\n✅ Git state OK for deploy (${headShort}).\n`)
console.log('Next: isolated snapshot build, scoped push, and Vercel deployment.\n')
