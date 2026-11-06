// Synchronous read-only privacy gate. The fixed inspector reports facts; this
// module decides. It has no skip switch, no caller-supplied allow list, and it
// never creates a directory or changes an ACL.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('./crm-needs-review-journal-inspector.ps1', import.meta.url))
const SCRIPT_SHA256 = "714b2f376737168ffd79de64233119b3000dcfc34224c6be2a140c80bebb8e11"
const POWERSHELL = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const FULL_CONTROL = 2032127
const CONTAINER_AND_OBJECT = 3
const INHERIT_ONLY = 2
const SYSTEM = 'S-1-5-18'
const ADMINISTRATORS = 'S-1-5-32-544'
// NT SERVICE\TrustedInstaller. Accepted only as the owner of a verified fixed
// local-disk root, never as a grant on the journal or its files.
const TRUSTED_INSTALLER = 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464'
const DRIVE_FIXED = 3
const driveTypeCache = new Map()
// FILE_ADD_SUBDIRECTORY (4) is excluded for distant ancestors: Authenticated
// Users can create a sibling of C:\Users without being able to replace it.
const DISTANT_REPLACEMENT = 0x2 | 0x10 | 0x40 | 0x100 | 0x10000 | 0x40000 | 0x80000 | 0x10000000 | 0x40000000
const PARENT_REPLACEMENT = DISTANT_REPLACEMENT | 0x4
const EVIDENCE_NAME = /^(approval\.json|consents\.json|state\.json|state-wal\.log|operation\.lock|hosted-[A-Za-z0-9._-]+\.json|state-[A-Za-z0-9._-]+\.tmp)$/i

const fail = code => { throw Object.assign(new Error(code), { code }) }
const pathKey = value => (process.platform === 'win32' ? value.toLowerCase() : value).replace(/[\\/]+$/, '')

function asArray(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return [value]
  fail('needs_review_journal_privacy_unverified')
}
function unsigned(value) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(number)) fail('needs_review_journal_privacy_unverified')
  return number >>> 0
}
function appliesToObject(ace) {
  return (Number(ace.propagation) & INHERIT_ONLY) === 0
}
function exactFullControl(ace) {
  return ace.type === 'Allow' && ace.rights === FULL_CONTROL &&
    ace.inheritance === CONTAINER_AND_OBJECT && ace.propagation === 0
}
function normalizeAce(ace) {
  if (!ace || typeof ace.sid !== 'string' || !/^S-1-[0-9-]+$/.test(ace.sid) ||
    (ace.type !== 'Allow' && ace.type !== 'Deny') || !Number.isInteger(Number(ace.inheritance)) ||
    !Number.isInteger(Number(ace.propagation))) fail('needs_review_journal_privacy_unverified')
  return {
    sid: ace.sid, type: ace.type, rights: unsigned(ace.rights),
    inheritance: Number(ace.inheritance), propagation: Number(ace.propagation),
  }
}
function normalizeNode(node) {
  if (!node || typeof node.path !== 'string' || typeof node.ownerSid !== 'string' ||
    !/^S-1-[0-9-]+$/.test(node.ownerSid) || typeof node.createdTicks !== 'string' ||
    !/^\d+$/.test(node.createdTicks) || typeof node.isDirectory !== 'boolean' ||
    typeof node.reparse !== 'boolean' || typeof node.protected !== 'boolean' ||
    typeof node.daclPresent !== 'boolean') {
    fail('needs_review_journal_privacy_unverified')
  }
  return {
    path: node.path, isDirectory: node.isDirectory, reparse: node.reparse,
    createdTicks: node.createdTicks, ownerSid: node.ownerSid, protected: node.protected,
    daclPresent: node.daclPresent, aces: node.daclPresent ? asArray(node.aces).map(normalizeAce) : [],
  }
}
function listedNames(value) {
  if (value == null) return []
  const names = typeof value === 'string' ? [value] : Array.isArray(value) ? value : null
  if (!names || names.some(name => typeof name !== 'string' || name.length === 0 || name.length > 255 ||
    name === '.' || name === '..' || /[\\/\u0000]/.test(name))) fail('needs_review_journal_privacy_unverified')
  return names
}
function normalizeFile(file) {
  if (!file || typeof file.name !== 'string' || !EVIDENCE_NAME.test(file.name) ||
    typeof file.isDirectory !== 'boolean' || typeof file.reparse !== 'boolean' ||
    typeof file.daclPresent !== 'boolean') fail('needs_review_journal_privacy_unverified')
  return {
    name: file.name, isDirectory: file.isDirectory, reparse: file.reparse, daclPresent: file.daclPresent,
    ownerSid: typeof file.ownerSid === 'string' ? file.ownerSid : '',
    aces: file.daclPresent ? asArray(file.aces).map(normalizeAce) : [],
  }
}
function logicalChain(directory) {
  const seen = []
  let current = resolve(directory)
  while (true) {
    let stat
    try { stat = lstatSync(current) } catch { fail('needs_review_journal_privacy_unverified') }
    if (stat.isSymbolicLink()) fail('needs_review_journal_redirected')
    if (!stat.isDirectory()) fail('needs_review_journal_privacy_unverified')
    seen.push(current)
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return seen
}
function chainDigest(user, chain) {
  const canonical = {
    user,
    chain: chain.map(node => ({
      path: pathKey(node.path), createdTicks: node.createdTicks, ownerSid: node.ownerSid,
      protected: node.protected, reparse: node.reparse, daclPresent: node.daclPresent,
      aces: node.aces.map(ace => ({ ...ace })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    })),
  }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}
function driveType(root) {
  const key = pathKey(root)
  if (driveTypeCache.has(key)) return driveTypeCache.get(key)
  pinnedScript()
  let stdout
  try {
    stdout = execFileSync(POWERSHELL, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', SCRIPT,
      '-VolumeRoot', root], {
      shell: false, windowsHide: true, encoding: 'utf8', timeout: 20000, maxBuffer: 1024,
      env: { ...process.env, PSModulePath: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch { fail('needs_review_journal_privacy_unverified') }
  const value = Number(String(stdout).replace(/^\uFEFF/, '').trim())
  if (!Number.isInteger(value)) fail('needs_review_journal_privacy_unverified')
  driveTypeCache.set(key, value)
  return value
}
function isVerifiedFixedVolumeRoot(node) {
  if (node.ownerSid !== TRUSTED_INSTALLER || node.reparse !== false || node.isDirectory !== true) return false
  if (typeof node.path !== 'string' || !/^[A-Za-z]:\\$/.test(node.path)) return false
  let stat
  try { stat = lstatSync(node.path) } catch { return false }
  if (stat.isSymbolicLink() || !stat.isDirectory()) return false
  let real
  try { real = realpathSync.native(node.path) } catch { return false }
  if (pathKey(real) !== pathKey(node.path) || dirname(node.path) !== node.path) return false
  return driveType(node.path) === DRIVE_FIXED
}
function assertLeaf(leaf, allowed) {
  if (leaf.daclPresent !== true || leaf.protected !== true) fail('needs_review_journal_dacl_unverified')
  for (const ace of leaf.aces) {
    if (!exactFullControl(ace) || !allowed.has(ace.sid)) fail('needs_review_journal_dacl_unverified')
  }
  for (const sid of allowed) {
    if (!leaf.aces.some(ace => ace.sid === sid && exactFullControl(ace))) fail('needs_review_journal_dacl_unverified')
  }
}
function assertAncestor(node, allowed, immediate) {
  if (!node.isDirectory || node.reparse) fail(node.reparse ? 'needs_review_journal_redirected' : 'needs_review_journal_privacy_unverified')
  // A NULL DACL grants everyone access. An owner outside the trusted set can
  // rewrite the DACL even when no write ACE is currently visible. TrustedInstaller
  // is not added to allowed: this exception is ownership of the fixed volume root only.
  if (node.daclPresent !== true || (!allowed.has(node.ownerSid) && !isVerifiedFixedVolumeRoot(node))) {
    fail('needs_review_journal_parent_unverified')
  }
  const mask = immediate ? PARENT_REPLACEMENT : DISTANT_REPLACEMENT
  for (const ace of node.aces) {
    if (!appliesToObject(ace)) continue
    if (ace.type !== 'Allow' || ((ace.rights & mask) !== 0 && !allowed.has(ace.sid))) {
      fail('needs_review_journal_parent_unverified')
    }
  }
}
function assertEvidenceFile(directory, fact, allowed) {
  if (fact.reparse || fact.isDirectory) fail('needs_review_journal_redirected')
  const full = join(directory, fact.name)
  let stat
  try { stat = lstatSync(full) } catch { fail('needs_review_journal_privacy_unverified') }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) fail('needs_review_journal_redirected')
  let real
  try { real = realpathSync.native(full) } catch { fail('needs_review_journal_privacy_unverified') }
  if (pathKey(real) !== pathKey(full)) fail('needs_review_journal_redirected')
  if (fact.daclPresent !== true) fail('needs_review_journal_dacl_unverified')
  if (!allowed.has(fact.ownerSid)) fail('needs_review_journal_owner_unverified')
  for (const ace of fact.aces) {
    if (ace.type !== 'Allow' || !allowed.has(ace.sid)) fail('needs_review_journal_dacl_unverified')
  }
}
function assertJournalFiles(directory, files, otherNames, allowed) {
  let entries
  try { entries = readdirSync(directory, { withFileTypes: true }) } catch { fail('needs_review_journal_privacy_unverified') }
  const evidence = []
  const unexpected = []
  for (const entry of entries) {
    if (EVIDENCE_NAME.test(entry.name)) evidence.push(entry.name)
    else unexpected.push(entry.name)
  }
  if (evidence.length !== files.length || unexpected.length !== otherNames.length) fail('needs_review_journal_privacy_unverified')
  const reported = new Map(files.map(file => [file.name.toLowerCase(), file]))
  for (const name of evidence) {
    const fact = reported.get(name.toLowerCase())
    if (!fact) fail('needs_review_journal_privacy_unverified')
    assertEvidenceFile(directory, fact, allowed)
  }
  if (unexpected.length > 0 || otherNames.length > 0) fail('needs_review_journal_privacy_unverified')
}

export function evaluateNeedsReviewJournalReport(directory, report) {
  if (process.platform !== 'win32' || typeof directory !== 'string' || !report ||
    typeof report.currentUserSid !== 'string' || !/^S-1-[0-9-]+$/.test(report.currentUserSid)) {
    fail('needs_review_journal_privacy_unverified')
  }
  const chain = asArray(report.chain).map(normalizeNode)
  const seen = logicalChain(directory)
  if (chain.length < 2 || chain.length !== seen.length) fail('needs_review_journal_privacy_unverified')
  for (let index = 0; index < chain.length; index++) {
    if (chain[index].reparse || pathKey(chain[index].path) !== pathKey(seen[index])) fail('needs_review_journal_redirected')
  }
  let real
  try { real = realpathSync.native(seen[0]) } catch { fail('needs_review_journal_privacy_unverified') }
  if (pathKey(real) !== pathKey(seen[0]) || !chain[0].isDirectory) fail('needs_review_journal_redirected')
  if (chain[0].ownerSid !== report.currentUserSid) fail('needs_review_journal_owner_unverified')
  const allowed = new Set([report.currentUserSid, SYSTEM, ADMINISTRATORS])
  assertLeaf(chain[0], allowed)
  const files = Number(report.fileCount) === 0 && (report.files == null || (Array.isArray(report.files) && report.files.length === 0))
    ? [] : asArray(report.files).map(normalizeFile)
  if (!Number.isInteger(Number(report.fileCount)) || files.length !== Number(report.fileCount)) fail('needs_review_journal_privacy_unverified')
  if (report.otherOverflow !== undefined && typeof report.otherOverflow !== 'boolean') fail('needs_review_journal_privacy_unverified')
  const otherNames = listedNames(report.otherNames)
  if (!Number.isInteger(Number(report.otherCount)) || report.otherOverflow === true || otherNames.length !== Number(report.otherCount)) {
    fail('needs_review_journal_privacy_unverified')
  }
  assertJournalFiles(seen[0], files, otherNames, allowed)
  for (let index = 1; index < chain.length; index++) assertAncestor(chain[index], allowed, index === 1)
  return chainDigest(report.currentUserSid, chain)
}

function pinnedScript() {
  let bytes
  try { bytes = readFileSync(SCRIPT) } catch { fail('needs_review_journal_privacy_unverified') }
  if (createHash('sha256').update(bytes).digest('hex') !== SCRIPT_SHA256) fail('needs_review_journal_privacy_unverified')
}

export function readNeedsReviewJournalReport(directory) {
  if (process.platform !== 'win32' || typeof directory !== 'string' || directory.includes('\0')) {
    fail('needs_review_journal_privacy_unverified')
  }
  pinnedScript()
  let stdout
  try {
    stdout = execFileSync(POWERSHELL, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', SCRIPT,
      '-Directory', resolve(directory)], {
      shell: false, windowsHide: true, encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024,
      env: { ...process.env, PSModulePath: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    fail(error?.status === 4 ? 'needs_review_journal_directory_missing' : 'needs_review_journal_privacy_unverified')
  }
  try { return JSON.parse(String(stdout).replace(/^\uFEFF/, '').trim()) }
  catch { fail('needs_review_journal_privacy_unverified') }
}

export function assertNeedsReviewJournalPrivate(directory) {
  return evaluateNeedsReviewJournalReport(directory, readNeedsReviewJournalReport(directory))
}
