import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { matchesReviewedLiteral, publicLiteralReview } from './deploy-reviewed-public-data.mjs'
import { scanReleaseFile, assertReleaseManifestSecrets, knownValuesFromEnvironment, SecretScanError, withScannedRelease } from './deploy-secret-scan.mjs'

// All strings below are synthetic, not usable credentials. Never read .env,
// private configuration, real release files, or invoke build/deploy in this suite.
const fingerprint = '0123456789abcdef'.repeat(4)
const cv = 'cv-' + fingerprint.match(/.{8}/g).join('-')
const fake = 'synthetic-only-' + 'z'.repeat(32)
const pem = '-----BEGIN PRIVATE KEY-----\nSYNTHETIC\n-----END PRIVATE KEY-----'
const jwt = 'eyJhbGciOiJub25lIn0.' + Buffer.from('{"fixture":true}').toString('base64url') + '.synthetic'
const scan = (name, text, known) => scanReleaseFile(name, Buffer.isBuffer(text) ? text : Buffer.from(text), known)

test('public decisions require exact file bytes, key and value; filenames alone never pass', () => {
  const hash = value => createHash('sha256').update(value).digest('hex')
  const bytes = Buffer.from('const token="public-fixture";')
  const records = [{ fileDigest: hash(bytes), literalDigests: [hash(JSON.stringify(['token', 'public-fixture']))] }]
  assert.equal(matchesReviewedLiteral(records, hash(bytes), 'token', 'public-fixture'), true)
  for (const [file, key, value] of [
    [Buffer.concat([bytes, Buffer.from(' ')]), 'token', 'public-fixture'],
    [bytes, 'password', 'public-fixture'], [bytes, 'token', fake], [bytes, 'token', undefined],
  ]) assert.equal(matchesReviewedLiteral(records, hash(file), key, value), false)
  assert.equal(publicLiteralReview('unreviewed.js', bytes)('token', 'public-fixture'), false)
  assert.equal(publicLiteralReview('src/crm/DemosView.tsx', bytes)('token', 'public-fixture'), false)
  denies('src/crm/DemosView.tsx', `const token=${JSON.stringify(fake)};`, 'credential_literal_assignment')
  denies('src/crm/DemosView.tsx', `const data=${JSON.stringify(pem)};`, 'private_key_pem')
  denies('src/crm/DemosView.tsx', `const data=${JSON.stringify(jwt)};`, 'jwt_shape')
  denies('src/crm/DemosView.tsx', `const data=${JSON.stringify(fake)};`, 'configured_secret_value', [fake])
})
function passes(name, text, known) { const r = scan(name, text, known); assert.deepEqual(r, { complete: true, rules: [], errors: [] }) }
function denies(name, text, rule, known) { const r = scan(name, text, known); assert.ok(r.rules.includes(rule)); assert.ok(!JSON.stringify(r).includes(fake)); return r }

test('bare hashes and cv fingerprints, including a release manifest, pass', () => {
  passes('app.js', `const contentVersion="${fingerprint}"; const revision="${cv}";`)
  passes('release-manifest.json', JSON.stringify({ files: [{ path: 'a.js', sha256: fingerprint }, { path: 'b.css', sha256: fingerprint }], contentVersion: cv }))
  passes('hashes.txt', fingerprint + '\n' + cv)
})
test('comparison operators and ordinary ternaries are not assignments', () => {
  for (const name of ['password', 'token', 'secret']) for (const op of ['==', '===', '!=', '!==']) {
    passes('app.js', `const flag = "${name}" ${op} field.type;`)
    passes('app.js', `const flag = field.type ${op} "${name}";`)
    passes('app.js', `const flag = ${name} ${op} lexer.current;`)
  }
  passes('app.js', 'const label = ok ? "password" : "token"; const field = {type:"password"};')
})
test('credential assignments never receive hash/fingerprint exceptions', () => {
  for (const name of ['password', 'apiKey', 'token', 'VITE_API_SECRET', 'authorization']) {
    for (const value of [fake, fingerprint, cv]) {
      denies('app.js', `const ${name}=${JSON.stringify(value)};`, 'credential_literal_assignment')
      denies('settings.json', JSON.stringify({ [name]: value }), 'credential_literal_assignment')
    }
  }
  for (const js of [
    `config.password='${fake}';`, `const a={['pass'+'word']:'${fake}'};`,
    `function f(password='${fake}'){}`, `class A{password='${fake}';}`,
    `password = ok ? '${fake}' : supplied;`, 'const token=12345;',
    `config['pass'+'word'] = '${fake}';`, `password ||= '${fake}';`,
    `const password='synthetic-' + 'only';`, 'const password=`synthetic-only`;',
    `const {password='${fake}'} = settings;`,
    `const {password: p='${fake}'} = settings;`,
  ]) denies('app.js', js, 'credential_literal_assignment')
})
test('whole boolean constants in credential-named flags pass without a name allowlist', () => {
  for (const value of ['true', 'false', '!0', '!1', '!!0', '!!1', '!(0)', '!((1))', '(!!0)']) {
    passes('app.js', `const inputTypes={email:!0,password:${value},text:!0,tel:!0};`)
    passes('app.js', `const token=${value}; config.password=${value};`)
    passes('app.js', `function f({password: enabled=${value}}={}) {}`)
    passes('app.js', `const flags={['pass'+'word']:${value}};`)
    passes('component.tsx', `const field=<Widget password={${value}} />;`)
    passes('config.ts', `const secret=(${value} as boolean)!;`)
  }
})
test('boolean exemption never covers numeric coercions, strings or credential-bearing branches', () => {
  for (const value of ['0', '1', '12345', '+!0', '~!0', '!2', '!"public-demo"', 'ok ? !0 : "public-demo"']) {
    const result = denies('app.js', `const password=${value};`, 'credential_literal_assignment')
    assert.equal(result.complete, true)
  }
})
test('a harmless boolean flag never suppresses other findings in the file', () => {
  const prefix = 'const inputTypes={password:!0};'
  for (const [source, rule, known] of [
    [`const password=${JSON.stringify(fake)};`, 'credential_literal_assignment', []],
    [`const data=${JSON.stringify(pem)};`, 'private_key_pem', []],
    [`const data=${JSON.stringify(jwt)};`, 'jwt_shape', []],
    [`const data="sk-proj-${'a'.repeat(24)}";`, 'credential_token_prefix', []],
    [`const data=${JSON.stringify(fake)};`, 'configured_secret_value', [fake]],
  ]) {
    assert.equal(denies('app.js', prefix + source, rule, known).complete, true)
  }
  denies('.env', 'PASSWORD=synthetic-only', 'credential_file')
  assert.equal(scan('app.js', prefix + 'const = ;').complete, false)
  assert.equal(scan('app.js', Buffer.concat([Buffer.from(prefix), Buffer.from([0xff])])).complete, false)
})
test('synthetic cosmetic gate is not authentication and has no secret-scan exemption', () => {
  // Deliberately public, invented fixture; not the real Dukta unlock value.
  const demoValue = 'public-demo-fixture-only'
  const gate = value => `function demoCode(){return ${JSON.stringify(value)}}
    if(input.value===demoCode()) sessionStorage.setItem('demo-open','1');`
  passes('app.js', gate(demoValue))
  denies('app.js', gate(demoValue), 'configured_secret_value', [demoValue])
  denies('app.js', gate('sk-proj-' + 'a'.repeat(24)), 'credential_token_prefix')
  denies('app.js', `const password=${JSON.stringify(demoValue)};`, 'credential_literal_assignment')
})
test('TypeScript and JSX credential properties are checked without executing them', () => {
  denies('component.tsx', `const element = <Widget token="${fake}" />;`, 'credential_literal_assignment')
  denies('component.tsx', `const element = <Widget token={'${fake}'} />;`, 'credential_literal_assignment')
  denies('config.ts', `const password: string = '${fake}';`, 'credential_literal_assignment')
  passes('component.tsx', 'const element = <input type="password" />;')
})
test('PEM, JWT and provider-shaped fixtures fail, including escaped literals', () => {
  denies('app.js', `const data=${JSON.stringify(pem)};`, 'private_key_pem')
  denies('app.js', `const data=${JSON.stringify(jwt)};`, 'jwt_shape')
  denies('app.js', `const data="sk-proj-${'a'.repeat(24)}";`, 'credential_token_prefix')
  denies('app.js', `const data="\\x73k-proj-${'a'.repeat(24)}";`, 'credential_token_prefix')
  denies('headers.txt', 'Authorization: Bearer ' + fake, 'authorization_header')
  denies('key.txt', '-----BEGIN PGP PRIVATE KEY BLOCK-----', 'private_key_pem')
  const whitespaceHeader = Buffer.from('{ "alg": "none" }').toString('base64url')
  denies('data.txt', whitespaceHeader + '.eyJ4IjoxfQ.synthetic', 'jwt_shape')
})
test('configured values fail regardless of variable name or apparent content type', () => {
  denies('app.js', `const harmless=${JSON.stringify(fake)};`, 'configured_secret_value', [fake])
  denies('data.json', JSON.stringify({ data: fake }), 'configured_secret_value', [fake])
  denies('media.png', Buffer.concat([Buffer.alloc(70000), Buffer.from(fake)]), 'configured_secret_value', [fake])
  denies('media.bin', Buffer.from(fake, 'utf16le'), 'configured_secret_value', [fake])
  assert.deepEqual(knownValuesFromEnvironment({ PATH: 'ordinary', OPENAI_API_KEY: fake, VITE_CLIENT_VALUE: 'test-value', EMPTY_TOKEN: '' }), [fake, 'test-value'])
})
test('credential paths fail even when empty or described as templates', () => {
  for (const name of ['.env', '.env.example', 'config/.env.local', '.npmrc', 'id_rsa', 'client.p12', 'keys/private.pem', 'secrets.json', 'credentials.json']) {
    denies(name, name.endsWith('.json') ? '{}' : '', 'credential_file')
  }
})
test('HTML scripts, template/noscript bodies, attributes and encoded names are checked', () => {
  passes('index.html', '<input type="password"><script>const p = "password" === field.type;</script>')
  for (const html of [
    `<script>const password='${fake}';</script>`,
    `<template><script>const password='${fake}';</script></template>`,
    `<noscript><script>const password='${fake}';</script></noscript>`,
    `<script data-note=">">const password='${fake}';`,
    `<button onclick="password='${fake}'">ok</button>`,
  ]) denies('index.html', html, 'credential_literal_assignment')
  denies('index.html', `<input type="password" value="${fake}">`, 'credential_html_attribute')
  denies('index.html', `<meta name="api-key" content="${fake}">`, 'credential_html_attribute')
  denies('index.html', `<div data-token="${fake}"></div>`, 'credential_html_attribute')
  denies('index.html', `<script type="application/json">{"password":"${fake}"}</script>`, 'credential_literal_assignment')
})
test('malformed, unsupported, oversized or incomplete input cannot pass', () => {
  for (const [name, text] of [ ['app.js', 'const = ;'], ['a.json', '{'], ['x.yaml', 'public: value'], ['image.zip', 'unknown'],
    ['x.txt', Buffer.from([0xff, 0xfe])], ['a.txt', Buffer.alloc(8 * 1024 * 1024 + 1)],
    ['index.html', '<iframe srcdoc="&lt;p&gt;hello"></iframe>'], ['index.html', '<script type="text/x-custom">data</script>'] ]) {
    assert.equal(scan(name, text).complete, false)
  }
  assert.equal(scanReleaseFile('x.txt', Buffer.from('safe'), ['']).complete, false)
})
test('secrets past 64 KiB and combined benign hash/secret input still fail', () => {
  denies('app.js', ' '.repeat(70000) + `const password='${fake}';`, 'credential_literal_assignment')
  denies('data.json', JSON.stringify({ sha256: fingerprint, password: fake }), 'credential_literal_assignment')
})

function fixture(callback) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'iom-scan-test-'))
  try { callback(stage) } finally { fs.rmSync(stage, { recursive: true, force: true }) }
}
function write(stage, name, value) {
  const bytes = Buffer.from(value), target = path.join(stage, name)
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes)
  return { path: name, size: bytes.length }
}
const manifest = files => ({ files, fileCount: files.length, totalSize: files.reduce((sum, f) => sum + f.size, 0) })
function refused(callback, code) { assert.throws(callback, error => error instanceof SecretScanError && error.code === code && !error.message.includes(fake)) }

test('complete manifest passes; same-size mutation is rejected before publication', () => fixture(stage => {
  const files = [write(stage, 'app.js', 'const a = 1;'), write(stage, 'index.html', '<p>safe</p>')], input = manifest(files)
  const first = assertReleaseManifestSecrets(stage, input)
  assert.equal(first.fileCount, 2)
  assert.equal(assertReleaseManifestSecrets(stage, input, { expectedIdentity: first.identity }).identity, first.identity)
  fs.writeFileSync(path.join(stage, 'app.js'), 'const a = 2;')
  refused(() => assertReleaseManifestSecrets(stage, input, { expectedIdentity: first.identity }), 'SCAN_RELEASE_CHANGED')
}))
test('a secret anywhere in upload blocks; errors disclose neither values nor source', () => fixture(stage => {
  const files = [write(stage, 'app.js', `const password='${fake}';`)]
  refused(() => assertReleaseManifestSecrets(stage, manifest(files)), 'SECRET_DETECTED')
  assert.throws(() => assertReleaseManifestSecrets(stage, manifest(files)), error => {
    assert.deepEqual(error.contentCheck, { path: 'app.js', rules: ['credential_literal_assignment'], errors: [] })
    assert.ok(!JSON.stringify(error).includes(fake))
    return true
  })
  const broken = [write(stage, 'app.js', `const '${fake}' = ;`)]
  refused(() => assertReleaseManifestSecrets(stage, manifest(broken)), 'SCAN_INCOMPLETE')
}))
test('Vercel directory markers are type-checked and never suppress file scanning', () => fixture(stage => {
  fs.mkdirSync(path.join(stage, 'marker'))
  const marker = { path: 'marker', size: 0, mode: fs.lstatSync(path.join(stage, 'marker')).mode }
  const file = write(stage, 'app.js', 'const enabled=true;')
  const input = manifest([marker, file])
  const first = assertReleaseManifestSecrets(stage, input)
  assert.equal(first.fileCount, 2)
  assert.equal(assertReleaseManifestSecrets(stage, input, { expectedIdentity: first.identity }).identity, first.identity)
  refused(() => assertReleaseManifestSecrets(stage, manifest([{ ...marker, size: 1 }, file])), 'SCAN_MANIFEST_TYPE')
  refused(() => assertReleaseManifestSecrets(stage, manifest([{ ...marker, mode: 0o100644 }, file])), 'SCAN_FILE_CHANGED')
  refused(() => assertReleaseManifestSecrets(stage, manifest([{ ...file, mode: marker.mode }])), 'SCAN_MANIFEST_TYPE')
  refused(() => assertReleaseManifestSecrets(stage, manifest([file]), { expectedIdentity: first.identity }), 'SCAN_RELEASE_CHANGED')
  const secretFile = write(stage, 'app.js', `const password=${JSON.stringify(fake)};`)
  refused(() => assertReleaseManifestSecrets(stage, manifest([marker, secretFile])), 'SECRET_DETECTED')
}))
test('one denied manifest reports all failing entries without exposing fixture values', () => fixture(stage => {
  const files = [write(stage, 'first.js', `const password=${JSON.stringify(fake)};`),
    write(stage, 'second.js', 'const = ;'), write(stage, 'last.txt', 'safe')]
  assert.throws(() => assertReleaseManifestSecrets(stage, manifest(files)), error => {
    assert.equal(error.code, 'SCAN_INCOMPLETE')
    assert.deepEqual(error.contentChecks, { checkedEntries: 3, failureCount: 2, truncated: false, findings: [
      { path: 'first.js', rules: ['credential_literal_assignment'], errors: [] },
      { path: 'second.js', rules: [], errors: ['JAVASCRIPT_PARSE_FAILED'] },
    ] })
    assert.ok(!JSON.stringify(error).includes(fake))
    return true
  })
}))
test('invalid/missing manifest metadata and credential paths fail before content reads', () => fixture(stage => {
  const good = manifest([write(stage, 'a.txt', 'safe')])
  for (const bad of [{}, { files: [], fileCount: 0, totalSize: 0 }, { ...good, fileCount: 2 }, { ...good, totalSize: 5 },
    manifest([{ path: '../outside.txt', size: 1 }]), manifest([{ path: 'a\\b.txt', size: 1 }]),
    manifest([{ path: '.env.example', size: 0 }]), manifest([{ path: 'missing.txt', size: 0 }]),
    manifest([{ path: 'a.txt', size: 1 }]), manifest([{ path: 'a.txt', size: 4 }, { path: 'a.txt', size: 4 }])]) {
    assert.throws(() => assertReleaseManifestSecrets(stage, bad), SecretScanError)
  }
  assert.throws(() => assertReleaseManifestSecrets(stage, manifest([{ path: 'a.txt', size: 1 }])), error => {
    assert.equal(error.code, 'SCAN_FILE_CHANGED')
    assert.deepEqual(error.fileCheck, { path: 'a.txt', regularFile: true, linkCount: 1, expectedBytes: 1, observedBytes: 4 })
    assert.ok(!JSON.stringify(error).includes('safe'))
    return true
  })
}))
test('hard-linked payloads and junction directories are refused', () => fixture(stage => {
  write(stage, 'original.txt', 'safe'); fs.linkSync(path.join(stage, 'original.txt'), path.join(stage, 'linked.txt'))
  refused(() => assertReleaseManifestSecrets(stage, manifest([{ path: 'linked.txt', size: 4 }])), 'SCAN_FILE_CHANGED')
  fs.mkdirSync(path.join(stage, 'real')); write(stage, 'real/a.txt', 'safe')
  fs.symlinkSync(path.join(stage, 'real'), path.join(stage, 'alias'), process.platform === 'win32' ? 'junction' : 'dir')
  refused(() => assertReleaseManifestSecrets(stage, manifest([{ path: 'alias/a.txt', size: 4 }])), 'SCAN_LINK_REFUSED')
}))
test('deploy integration guards push and upload, preserves original size guard', () => {
  const source = fs.readFileSync(new URL('./deploy-production.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.ok(source.includes('withScannedRelease({\n      verifyOnly,'))
  assert.ok(source.includes('scan: expectedIdentity => verifyUploadManifest(snapshot.stage, scopes, { knownValues, expectedIdentity })'))
  assert.ok(source.includes("push: () => command('git', ["))
  assert.ok(source.includes('publish: () => deploySnapshot(snapshot, head, scopes, emailPhase)'))
  assert.ok(source.includes('const scan = assertReleaseManifestSecrets(stage, manifest, scanOptions)'))
  assert.ok(source.includes('const MAX_SOURCE_BYTES = 1_000_000_000'))
  assert.ok(!source.includes('--no-verify'))
  const preparation = fs.readFileSync(new URL('./incremental-r2-release.mjs', import.meta.url), 'utf8')
  assert.ok(preparation.includes("'/scripts/test-*.mjs'"))
})
test('verify-only and denied scans never call push or publish', () => {
  const calls = []
  const options = { scan: expected => { calls.push(['scan', expected]); return { identity: 'fixture-identity' } },
    push: () => calls.push(['push']), publish: () => calls.push(['publish']) }
  withScannedRelease({ ...options, verifyOnly: true })
  assert.deepEqual(calls, [['scan', null]])
  calls.length = 0
  refused(() => withScannedRelease({ ...options, verifyOnly: false, scan: () => { throw new SecretScanError('SECRET_DETECTED') } }), 'SECRET_DETECTED')
  assert.deepEqual(calls, [])
  withScannedRelease({ ...options, verifyOnly: false })
  assert.deepEqual(calls, [['scan', null], ['push'], ['scan', 'fixture-identity'], ['publish']])
})
test('mutation or scanner failure after push blocks upload and is not retried', () => {
  const calls = []
  refused(() => withScannedRelease({ verifyOnly: false,
    scan: expected => { calls.push('scan'); if (expected) throw new SecretScanError('SCAN_RELEASE_CHANGED'); return { identity: 'fixture-identity' } },
    push: () => calls.push('push'), publish: () => calls.push('publish'),
  }), 'SCAN_RELEASE_CHANGED')
  assert.deepEqual(calls, ['scan', 'push', 'scan'])
})
