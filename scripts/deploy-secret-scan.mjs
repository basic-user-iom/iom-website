// Local release guard. Never executes scanned source or returns matched values.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parse as parseHtml } from 'parse5'
import { SaxesParser } from 'saxes'
import { publicLiteralReview } from './deploy-reviewed-public-data.mjs'
import { publicProtocolChallengeReview } from './deploy-reviewed-protocol-data.mjs'

const TEXT_LIMIT = 8 * 1024 * 1024
const FILE_LIMIT = 128 * 1024 * 1024
export const secretName = name => /password|passwd|(?:^|[_-])pwd(?:$|[_-])|secret|token|api[_-]?key|authorization|private[_-]?key/i.test(name)
export const credentialPath = name => name.split('/').some(part =>
  /^\.env(?:\..*)?$|^\.(?:npmrc|pypirc|netrc|aws|ssh|gnupg|git|vercel)$|^(?:credentials?|secrets?)(?:\..*)?$|^id_(?:rsa|dsa|ecdsa|ed25519)(?:\..*)?$|\.(?:pem|key|pfx|p12|jks|keystore)$/i.test(part))
export const binaryTypes = /\.(?:png|jpe?g|webp|gif|ico|avif|woff2?|ttf|otf|mp3|mp4|m4a|webm|ogg|wav|glb|bin|ktx2?|hdr|exr|wasm)$/i
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

export class SecretScanError extends Error {
  constructor(code) { super(code); this.name = 'SecretScanError'; this.code = code }
}
const requireSafe = (ok, code) => { if (!ok) throw new SecretScanError(code) }

export function knownValuesFromEnvironment(environment) {
  // Do not load .env or another tool's private configuration. Only values already
  // supplied to this process are covered. Names and values never leave the guard.
  return [...new Set(Object.entries(environment)
    .filter(([name, value]) => (secretName(name) || /^VITE_/i.test(name)) && typeof value === 'string' && value.length >= 4)
    .map(([, value]) => value))]
}

function staticValue(node, depth = 0) {
  if (!node || depth > 40) return undefined
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) return staticValue(node.expression, depth + 1)
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isNumericLiteral(node)) return node.text
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const a = staticValue(node.left, depth + 1), b = staticValue(node.right, depth + 1)
    if (a !== undefined && b !== undefined && a.length + b.length <= TEXT_LIMIT) return a + b
  }
  if (ts.isConditionalExpression(node)) return undefined
  return undefined
}
function nameOf(node) {
  if (!node) return ''
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) return nameOf(node.name)
  if (ts.isElementAccessExpression(node)) return staticValue(node.argumentExpression) ?? ''
  if (ts.isComputedPropertyName(node)) return staticValue(node.expression) ?? ''
  return ''
}
function containsLiteral(node, depth = 0) {
  if (!node || depth > 40) return false
  const value = staticValue(node)
  if (value !== undefined) return value.length > 0
  if (ts.isConditionalExpression(node)) return containsLiteral(node.whenTrue, depth + 1) || containsLiteral(node.whenFalse, depth + 1)
  if (ts.isPrefixUnaryExpression(node)) return containsLiteral(node.operand, depth + 1)
  return false
}

// Only a complete value that is provably a boolean constant qualifies. In
// particular +!0, ~!0, conditional strings, calls and identifiers do NOT qualify.
// Generic signatures and configured-value scans still visit every source byte
// and decoded literal; no filename, credential name or bundle is allowlisted.
function booleanConstant(node, depth = 0) {
  if (!node || depth > 40) return false
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node))
    return booleanConstant(node.expression, depth + 1)
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return true
  if (!ts.isPrefixUnaryExpression(node) || node.operator !== ts.SyntaxKind.ExclamationToken) return false
  let operand = node.operand
  while (ts.isParenthesizedExpression(operand) || ts.isAsExpression(operand) || ts.isNonNullExpression(operand)) {
    if (++depth > 40) return false
    operand = operand.expression
  }
  return (ts.isNumericLiteral(operand) && ['0', '1'].includes(operand.text)) || booleanConstant(operand, depth + 1)
}

export function scanReleaseFile(name, bytes, knownValues = []) {
  const rules = new Set(), errors = new Set()
  const result = () => ({ complete: errors.size === 0, rules: [...rules].sort(), errors: [...errors].sort() })
  if (!Buffer.isBuffer(bytes) || bytes.length > FILE_LIMIT) { errors.add('FILE_LIMIT'); return result() }
  if (!Array.isArray(knownValues) || knownValues.length > 1000 || knownValues.some(v => typeof v !== 'string' || v.length < 4 || v.length > 8192)) {
    errors.add('SCANNER_CONFIGURATION_INVALID'); return result()
  }
  if (credentialPath(name)) rules.add('credential_file')
  if (/\.(?:pdf|zip|gz|iomcar|360project|dat|tga)$/i.test(name)) {
    return scanContainerFile(name, bytes, knownValues)
  }
  const reviewedChallenge = publicProtocolChallengeReview(name, bytes)
  const generic = (value, originalSource = false) => {
    if (/-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/.test(value)) rules.add('private_key_pem')
    if (/\beyJ[A-Za-z0-9_-]{3,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\b/.test(value)) rules.add('jwt_shape')
    for (const match of value.matchAll(/\b([A-Za-z0-9_-]{2,4096})\.([A-Za-z0-9_-]{2,4096})\.([A-Za-z0-9_-]{2,4096})\b/g)) {
      try {
        const header = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'))
        if (header && typeof header === 'object' && ('alg' in header || 'typ' in header)) rules.add('jwt_shape')
      } catch { /* Ordinary dotted identifiers are not JWT headers. */ }
    }
    if (/\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/.test(value)) rules.add('credential_token_prefix')
    for (const match of value.matchAll(/\bBearer\s+[A-Za-z0-9_./+~=-]{8,}/gi)) {
      // Only one exact reviewed raw-source response challenge may qualify.
      // Decoded literals and every other signature/known-value check still run.
      if (!(originalSource && reviewedChallenge(match.index, match[0]))) rules.add('authorization_header')
    }
    // Basic credentials encode user:password as Base64. Ordinary prose such as
    // "basic lighting" is not an authorization header. Explicit Authorization
    // fields still fail even when their Basic payload is malformed.
    if (/\b(?:proxy-)?authorization["']?\s*[:=]\s*["']?\s*Basic\s+\S+/i.test(value)) rules.add('authorization_header')
    for (const match of value.matchAll(/\bBasic\s+([A-Za-z0-9_./+~=-]+)/gi)) {
      const encoded = match[1]
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) continue
      const plain = Buffer.from(encoded, 'base64')
      try {
        const canonical = plain.toString('base64')
        if ((encoded === canonical || encoded === canonical.replace(/=+$/, '')) && plain.includes(0x3a))
          rules.add('authorization_header')
      } finally { plain.fill(0) }
    }
    if (knownValues.some(secret => value.includes(secret))) rules.add('configured_secret_value')
  }
  // Entire bytes, including binary tails; no first-64-KiB shortcut. Media coverage
  // is raw UTF-8/ASCII signatures/known values, NOT decompression or steganography.
  for (const secret of knownValues) {
    if (bytes.includes(Buffer.from(secret)) || bytes.includes(Buffer.from(secret, 'utf16le'))) rules.add('configured_secret_value')
  }
  generic(bytes.toString('utf8'), true)
  if (binaryTypes.test(name)) return result()
  if (bytes.length > TEXT_LIMIT) { errors.add('TEXT_LIMIT'); return result() }
  let text
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { errors.add('INVALID_UTF8'); return result() }
  const reviewedPublicLiteral = publicLiteralReview(name, bytes)

  const javascript = (source, fileName = name) => {
    const kind = /\.tsx$/i.test(fileName) ? ts.ScriptKind.TSX : /\.jsx$/i.test(fileName) ? ts.ScriptKind.JSX : /\.(?:ts|mts|cts)$/i.test(fileName) ? ts.ScriptKind.TS : ts.ScriptKind.JS
    let tree
    try { tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, kind) }
    catch { errors.add('JAVASCRIPT_PARSE_FAILED'); return }
    if (tree.parseDiagnostics.length) { errors.add('JAVASCRIPT_PARSE_FAILED'); return }
    const queue = [tree]; let count = 0
    while (queue.length) {
      if (++count > 2_000_000) { errors.add('AST_LIMIT'); break }
      const node = queue.pop()
      let key, value
      if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isPropertyDeclaration(node) || ts.isBindingElement(node)) { key = node.name; value = node.initializer }
      if (ts.isBindingElement(node)) key = node.propertyName ?? node.name
      if (ts.isPropertyAssignment(node)) { key = node.name; value = node.initializer }
      if (ts.isJsxAttribute(node)) {
        key = node.name; value = node.initializer
        if (value && ts.isJsxExpression(value)) value = value.expression
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
        key = node.left; value = node.right
      }
      if (secretName(nameOf(key)) && containsLiteral(value) && !booleanConstant(value) &&
        !reviewedPublicLiteral(nameOf(key), staticValue(value))) rules.add('credential_literal_assignment')
      const decoded = staticValue(node)
      if (decoded) generic(decoded)
      ts.forEachChild(node, child => { queue.push(child) })
    }
  }
  const json = source => {
    let parsed
    try { parsed = JSON.parse(source) } catch { errors.add('JSON_PARSE_FAILED'); return }
    const queue = [parsed]; let count = 0
    while (queue.length) {
      if (++count > 2_000_000) { errors.add('JSON_NODE_LIMIT'); break }
      const item = queue.pop()
      if (typeof item === 'string') generic(item)
      else if (item && typeof item === 'object') for (const [key, value] of Object.entries(item)) {
        if (secretName(key) && ((typeof value === 'string' && value) || typeof value === 'number') &&
          !reviewedPublicLiteral(key, String(value))) rules.add('credential_literal_assignment')
        queue.push(value)
      }
    }
  }
  if (/\.(?:xml|xmp)$/i.test(name)) {
    const stack = []; let count = 0
    const parser = new SaxesParser({ xmlns: true })
    parser.on('error', () => { throw new Error('XML_PARSE_FAILED') })
    parser.on('doctype', () => { throw new Error('XML_DTD_REFUSED') })
    parser.on('processinginstruction', instruction => {
      // Adobe's fixed XMP packet envelope is metadata, not executable code.
      // This narrow grammar is only for XMP; arbitrary PIs remain refused.
      const packet = /^(?:begin\s*=\s*(["'])\uFEFF?\1\s+id\s*=\s*(["'])W5M0MpCehiHzreSzNTczkc9d\2|end\s*=\s*(["'])[rw]\3)$/
      if (!/\.xmp$/i.test(name) || instruction.target !== 'xpacket' || !packet.test(instruction.body.trim()))
        throw new Error('XML_PROCESSING_INSTRUCTION_REFUSED')
    })
    parser.on('opentag', node => {
      if (++count > 200000 || stack.length >= 128) throw new Error('XML_LIMIT')
      if (/^(?:script|iframe|object)$/i.test(node.local)) throw new Error('XML_ACTIVE_CONTENT_REFUSED')
      stack.push({ name: node.local, text: '' })
      for (const attr of Object.values(node.attributes)) {
        generic(attr.value)
        if (secretName(attr.local) && attr.value) rules.add('credential_xml_value')
        if (/^on[a-z]+$/i.test(attr.local)) throw new Error('XML_ACTIVE_CONTENT_REFUSED')
      }
    })
    const textNode = value => {
      generic(value)
      if (stack.length) stack.at(-1).text += value
    }
    parser.on('text', textNode); parser.on('cdata', textNode)
    parser.on('comment', generic)
    parser.on('closetag', () => {
      const node = stack.pop(); generic(node.text)
      if (secretName(node.name) && node.text.trim()) rules.add('credential_xml_value')
      if (stack.length) stack.at(-1).text += node.text
    })
    try { parser.write(text).close() } catch { errors.add('XML_REVIEW_FAILED') }
  } else if (/\.(?:[cm]?[jt]s|jsx|tsx)$/i.test(name)) javascript(text)
  else if (/\.(?:json|gltf|webmanifest)$/i.test(name)) json(text)
  else if (/\.(?:html?|svg)$/i.test(name)) {
    for (const scriptingEnabled of [true, false]) {
      const queue = [parseHtml(text, { scriptingEnabled })]; let count = 0
      while (queue.length) {
        if (++count > 200000) { errors.add('HTML_NODE_LIMIT'); break }
        const node = queue.pop(), attrs = Object.fromEntries((node.attrs ?? []).map(a => [a.name, a.value]))
        if (node.nodeName === '#text') generic(node.value)
        for (const [key, value] of Object.entries(attrs)) {
          generic(value)
          if (/^on[a-z]+$/.test(key)) javascript(`function handler(event){${value}\n}`, 'handler.js')
          if (key === 'srcdoc' || /^\s*(?:javascript:|data:(?:text\/html|text\/javascript|application\/javascript))/i.test(value)) errors.add('EMBEDDED_LANGUAGE_REVIEW_REQUIRED')
          if (/^data-/.test(key) && secretName(key.slice(5)) && value) rules.add('credential_html_attribute')
        }
        if (node.tagName === 'input' && attrs.value && (attrs.type === 'password' || secretName(attrs.name || attrs.id || ''))) rules.add('credential_html_attribute')
        if (node.tagName === 'meta' && attrs.content && secretName(attrs.name || attrs['http-equiv'] || '')) rules.add('credential_html_attribute')
        if (node.tagName === 'script') {
          const body = (node.childNodes ?? []).filter(n => n.nodeName === '#text').map(n => n.value).join('')
          if (body.trim()) {
            const type = (attrs.type ?? '').trim().toLowerCase()
            if (['application/json', 'application/ld+json', 'importmap', 'speculationrules'].includes(type)) json(body)
            else if (['', 'module', 'text/javascript', 'application/javascript'].includes(type)) javascript(body, 'inline.js')
            else if (type === 'application/octet-stream') {
              const encoded = body.replace(/\s/g, '')
              // Linear validation plus a canonical round trip avoids a deeply
              // repeated regex on large embedded downloads. No arbitrary data.
              if (!encoded.length || encoded.length > 44 * 1024 * 1024 || encoded.length % 4 || /[^A-Za-z0-9+/=]/.test(encoded)) errors.add('SCRIPT_DATA_FORMAT_REVIEW_REQUIRED')
              else {
                const decoded = Buffer.from(encoded, 'base64')
                try {
                  if (decoded.toString('base64') !== encoded || decoded.length < 4 || ![0x04034b50, 0x06054b50].includes(decoded.readUInt32LE(0))) errors.add('SCRIPT_DATA_FORMAT_REVIEW_REQUIRED')
                  else {
                    const report = scanContainerFile('embedded.zip', decoded, knownValues)
                    for (const rule of report.rules) rules.add(rule)
                    for (const error of report.errors) errors.add(error)
                  }
                } finally { decoded.fill(0) }
              }
            }
            else errors.add('SCRIPT_TYPE_REVIEW_REQUIRED')
          }
        }
        if (node.content) queue.push(node.content)
        queue.push(...(node.childNodes ?? []))
      }
    }
  } else if (/\.(?:css|txt|md|csv|glsl|vert|frag|obj|mtl|license)$/i.test(name) || !path.posix.extname(name) || credentialPath(name)) {
    for (const match of text.matchAll(/^\s*["']?([A-Za-z_][A-Za-z0-9_.-]*)["']?\s*(?:=(?!=)|:)\s*(\S[^\r\n]*)$/gm)) {
      if (secretName(match[1]) && !/^(?:""|'')\s*$/.test(match[2])) rules.add('credential_text_assignment')
    }
  } else errors.add('FILE_TYPE_REVIEW_REQUIRED')
  return result()
}

// Parsing compressed inputs is a separate, bounded local process, not an OS
// sandbox. Its stdout/stderr is captured and never forwarded. No keys in argv.
export function scanContainerFile(name, bytes, knownValues = []) {
  const denied = code => ({ complete: false, rules: credentialPath(name) ? ['credential_file'] : [], errors: [code] })
  if (process.env.IOM_SCAN_CONTAINER_WORKER === '1') return denied('CONTAINER_NESTED_WORKER_REFUSED')
  const inputLimit = /\.iomcar$/i.test(name) ? 64 * 1024 * 1024 : 32 * 1024 * 1024
  if (!Buffer.isBuffer(bytes) || bytes.length > inputLimit) return denied('CONTAINER_FILE_LIMIT')
  if (!Array.isArray(knownValues) || knownValues.length > 1000 || knownValues.some(v => typeof v !== 'string' || v.length < 4 || v.length > 8192)) return denied('SCANNER_CONFIGURATION_INVALID')
  try {
    const worker = fileURLToPath(new URL('./deploy-secret-containers.mjs', import.meta.url))
    const child = spawnSync(process.execPath, ['--max-old-space-size=384', worker], {
      input: JSON.stringify({ name, base64: bytes.toString('base64'), knownValues }), encoding: 'utf8',
      timeout: 20000, maxBuffer: 65536, shell: false, windowsHide: true,
      env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(?:SYSTEMROOT|WINDIR|PATH|PATHEXT|TEMP|TMP)$/i.test(key))), IOM_SCAN_CONTAINER_WORKER: '1' },
    })
    if (child.error?.code === 'ETIMEDOUT') return denied('CONTAINER_TIME_LIMIT')
    if (child.error || child.status !== 0) return denied('CONTAINER_PROCESS_FAILED')
    const report = JSON.parse(child.stdout)
    if (typeof report.complete !== 'boolean' || !Array.isArray(report.rules) || !Array.isArray(report.errors) ||
      [...report.rules, ...report.errors].some(code => typeof code !== 'string' || !/^[A-Za-z_]{1,80}$/.test(code))) return denied('CONTAINER_REPORT_INVALID')
    if (report.complete !== (report.errors.length === 0)) return denied('CONTAINER_REPORT_INVALID')
    return report
  } catch { return denied('CONTAINER_PROCESS_FAILED') }
}

export function safeRelative(name) {
  return typeof name === 'string' && name.length > 0 && !/[\\\x00-\x1f:*?"<>|]/.test(name) &&
    !path.isAbsolute(name) && name.split('/').every(p => p && p !== '.' && p !== '..' && !/[ .]$/.test(p))
}

export function assertReleaseManifestSecrets(stage, manifest, { knownValues = [], expectedIdentity = null, phase = 'upload' } = {}) {
  try {
    // The complete source is scanned before verified R2 media relocation. Only
    // this bounded phase has a larger aggregate budget; the final upload keeps
    // its original 1 GB limit. No file/content/path rule changes by phase.
    requireSafe(phase === 'upload' || phase === 'pre-r2', 'SCAN_PHASE_INVALID')
    const totalLimit = phase === 'pre-r2' ? 1_200_000_000 : 1_000_000_000
    requireSafe(path.isAbsolute(stage), 'SCAN_ROOT_INVALID')
    requireSafe(Array.isArray(manifest?.files) && manifest.files.length > 0 && manifest.files.length <= 15000 &&
      manifest.fileCount === manifest.files.length && Number.isSafeInteger(manifest.totalSize) && manifest.totalSize >= 0, 'SCAN_MANIFEST_INVALID')
    const entries = [], seen = new Set(); let total = 0
    // Validate every path before any payload read. Refuse symlinks/junctions,
    // hardlinks, traversal, duplicates and truncated/size-inconsistent manifests.
    for (const entry of manifest.files) {
      requireSafe(safeRelative(entry.path) && Number.isSafeInteger(entry.size) && entry.size >= 0 && entry.size <= FILE_LIMIT, 'SCAN_MANIFEST_INVALID')
      requireSafe(!seen.has(entry.path.toLowerCase()), 'SCAN_MANIFEST_DUPLICATE'); seen.add(entry.path.toLowerCase())
      requireSafe(!credentialPath(entry.path), 'SCAN_CREDENTIAL_PATH')
      const file = path.join(stage, entry.path)
      let current = file
      while (true) {
        const stat = fs.lstatSync(current)
        requireSafe(!stat.isSymbolicLink(), 'SCAN_LINK_REFUSED')
        if (current === path.dirname(current)) break
        current = path.dirname(current)
      }
      const stat = fs.lstatSync(file)
      // Vercel's dry manifest includes directory markers with size 0 and a
      // directory mode. They carry no uploaded bytes. Verify their actual type
      // and ancestors, retain them in the identity, and scan EVERY file entry.
      const declaredType = Number.isSafeInteger(entry.mode) ? entry.mode & 0o170000 : null
      if (stat.isDirectory() && declaredType === 0o040000 && entry.size === 0) {
        entries.push({ ...entry, file, directory: true })
        continue
      }
      requireSafe(declaredType === null || declaredType === 0o100000, 'SCAN_MANIFEST_TYPE')
      if (!stat.isFile() || stat.nlink !== 1 || stat.size !== entry.size) {
        const error = new SecretScanError('SCAN_FILE_CHANGED')
        error.fileCheck = {
          path: entry.path, regularFile: stat.isFile(), linkCount: stat.nlink,
          expectedBytes: entry.size, observedBytes: stat.size,
        }
        throw error
      }
      total += entry.size; entries.push({ ...entry, file })
    }
    requireSafe(total === manifest.totalSize && total <= totalLimit, 'SCAN_MANIFEST_SIZE')
    const records = [], failures = [], started = Date.now()
    for (const entry of entries) {
      requireSafe(Date.now() - started < 120000, 'SCAN_TIME_LIMIT')
      if (entry.directory) {
        records.push([entry.path, 0, 'directory'])
        continue
      }
      const bytes = fs.readFileSync(entry.file)
      try {
        requireSafe(bytes.length === entry.size, 'SCAN_FILE_CHANGED')
        const report = scanReleaseFile(entry.path, bytes, knownValues)
        if (!report.complete || report.rules.length > 0) {
          failures.push({ path: entry.path, rules: report.rules, errors: report.errors })
        }
        records.push([entry.path, entry.size, hash(bytes)])
      } finally { bytes.fill(0) }
    }
    requireSafe(Date.now() - started < 120000, 'SCAN_TIME_LIMIT')
    if (failures.length) {
      const error = new SecretScanError(failures.some(item => item.errors.length) ? 'SCAN_INCOMPLETE' : 'SECRET_DETECTED')
      error.contentCheck = failures[0]
      error.contentChecks = { checkedEntries: records.length, failureCount: failures.length,
        truncated: failures.length > 100, findings: failures.slice(0, 100) }
      throw error
    }
    records.sort((a, b) => a[0].localeCompare(b[0]))
    const identity = hash(JSON.stringify(records))
    requireSafe(expectedIdentity === null || expectedIdentity === identity, 'SCAN_RELEASE_CHANGED')
    // Internal digest only. Do not log this identity or raw findings.
    return { identity, fileCount: records.length, bytes: total, coverage: 'configured_rules_and_supplied_known_values' }
  } catch (error) {
    if (error instanceof SecretScanError) throw error
    // Parser and filesystem exceptions can include snippets/private filenames.
    throw new SecretScanError('SCAN_FAILED')
  }
}

// This sequencing helper is tested with inert callbacks. It does not grant
// permission, execute commands itself, or turn --verify-only into publication.
export function withScannedRelease({ scan, push, publish, verifyOnly }) {
  const first = scan(null)
  if (verifyOnly) return
  push()
  scan(first.identity)
  publish()
}
