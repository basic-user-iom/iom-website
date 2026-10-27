#!/usr/bin/env node
import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { knownDeployScopes } from './deploy-scope.mjs'
import { validateManifest, objectKey, PUBLIC_ORIGIN } from './r2-release-manifest.mjs'
import { requestedEmailReleasePhase } from './crm-email-release-phase.mjs'
import { publicLiteralReview } from './deploy-reviewed-public-data.mjs'
import { assertReleaseManifestSecrets, knownValuesFromEnvironment, scanReleaseFile, secretName, withScannedRelease } from './deploy-secret-scan.mjs'
import {
  inferDeployScope,
  invalidFilesForScope,
  isValidProjectSlug,
  matchesDeployScope,
} from './deploy-scope.mjs'

assert.equal(
  inferDeployScope([
    'automotive-studio/src/studio-main.ts',
    'public/demos/automotive-studio/index.html',
  ]),
  'automotive-studio',
)

assert.equal(
  inferDeployScope([
    'public/demos/ssr-denoise/index.html',
    'public/demos/ssr-denoise/assets/scene.glb',
  ]),
  'demo:ssr-denoise',
)

assert.equal(
  inferDeployScope([
    'trail-designs-prototype/src/app.js',
    'public/demos/trail-designs-prototype/index.html',
    'scripts/build-trail-designs-prototype.mjs',
  ]),
  'project:trail-designs-prototype',
)

assert.equal(
  inferDeployScope([
    'automotive-studio/src/studio-main.ts',
    'src/crm/DemosView.tsx',
  ]),
  null,
)

assert.deepEqual(
  invalidFilesForScope([
    'public/demos/automotive-studio/index.html',
    'src/data/projects.ts',
  ], 'automotive-studio'),
  ['src/data/projects.ts'],
)

assert.equal(matchesDeployScope('trail-designs-prototype/src/app.js', 'project:trail-designs-prototype'), true)
assert.equal(matchesDeployScope('public/demos/trail-designs-prototype/index.html', 'project:trail-designs-prototype'), true)
assert.equal(isValidProjectSlug('trail-designs-prototype'), true)
assert.equal(isValidProjectSlug('src'), false)
assert.equal(matchesDeployScope('src/crm/DemosView.tsx', 'project:src'), false)
assert.equal(matchesDeployScope('src/crm/DemosView.tsx', 'site'), true)
assert.equal(matchesDeployScope('public/demos/foo/index.html', 'demo:../foo'), false)
assert.equal(matchesDeployScope('src/crm/emailAttachments.ts', 'crm'), true)
assert.equal(matchesDeployScope('api/_lib/email-attachments.js', 'crm'), true)
assert.equal(matchesDeployScope('api/crm-send-email.js', 'crm'), true)
assert.equal(matchesDeployScope('src/data/projects.ts', 'crm'), false)
assert.equal(matchesDeployScope('solar-system/src/app/AppShell.tsx', 'project:solar-system'), true)
assert.equal(matchesDeployScope('public/demos/solar-system/index.html', 'project:solar-system'), true)
assert.equal(matchesDeployScope('.vercelignore', 'project:solar-system'), true)
assert.equal(matchesDeployScope('scripts/deploy-production.mjs', 'project:solar-system'), true)
assert.equal(matchesDeployScope('scripts/pre-deploy-check.mjs', 'project:solar-system'), true)
assert.equal(matchesDeployScope('public/models/icm-ext-v2/model-web.glb', 'project:solar-system'), false)
assert.equal(
  inferDeployScope([
    '.vercelignore',
    'solar-system/src/app/AppShell.tsx',
    'public/demos/solar-system/index.html',
    'scripts/deploy-production.mjs',
    'scripts/deploy-scope.mjs',
    'scripts/pre-deploy-check.mjs',
    'scripts/test-deploy-safety.mjs',
  ]),
  'project:solar-system',
)
assert.equal(
  inferDeployScope([
    'src/crm/emailAttachments.ts',
    'src/crm/EmailAttachmentsField.tsx',
    'api/_lib/email-attachments.js',
    'api/crm-send-email.js',
    'scripts/deploy-scope.mjs',
  ]),
  'crm',
)

for (const file of ['src/data/projects.ts', ...['de', 'nl', 'fr', 'it', 'es'].map(lang => 'src/i18n/projects/' + lang + '.ts'), 'public/assets/posters/solar-system.webp', 'public/assets/posters/solar-system-400.webp']) {
  assert.equal(matchesDeployScope(file, 'project:solar-system'), true)
}
for (const file of ['src/crm/DemosView.tsx', 'public/assets/posters/streets-gl.webp', 'public/demos/automotive-studio/index.html']) {
  assert.equal(matchesDeployScope(file, 'project:solar-system'), false)
}


// Solar System article release includes its editorial, screenshots and generated SEO pages.
for (const file of ['src/blog/posts/solar-system/en.md', 'src/blog/posts/solarSystemPost.ts', 'src/blog/posts/index.ts', 'src/blog/sitePublishedPosts.ts', 'src/blog/publicApi.ts', 'src/blog/BlogApp.tsx', 'public/assets/blog/solar-system/earth.webp', 'scripts/emit-solar-system-blog.mjs', 'vercel.json', 'scripts/test-solar-system-blog.mjs', 'vite.config.ts']) {
  assert.equal(matchesDeployScope(file, 'project:solar-system'), true)
}
assert.equal(matchesDeployScope('src/blog/posts/unrelated.ts', 'project:solar-system'), false)



// Night Grid can ship without unrelated homepage, CRM or demo work.
assert.equal(matchesDeployScope('src/components/GalleryLightbox.tsx', 'project:night-grid'), true)
assert.equal(matchesDeployScope('src/components/GalleryLightbox.css', 'project:night-grid'), true)
assert.equal(matchesDeployScope('src/components/Hero.tsx', 'project:night-grid'), false)
assert.equal(matchesDeployScope('src/index.css', 'project:night-grid'), false)
assert.equal(matchesDeployScope('src/crm/CrmApp.tsx', 'project:night-grid'), false)
assert.equal(matchesDeployScope('solar-system/src/app/AppShell.tsx', 'project:night-grid'), false)
assert.equal(inferDeployScope(['src/components/GalleryLightbox.tsx', 'src/components/GalleryLightbox.css']), 'project:night-grid')
assert.equal(inferDeployScope(['src/components/GalleryLightbox.tsx', 'solar-system/src/app/AppShell.tsx']), null)

console.log('Deploy scope safety tests passed.')

// Real launcher functions, inert command/metadata adapters; no entry-point import,
// subprocess, network, private state or external release fixture in this suite.
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const digest = value => createHash('sha256').update(value).digest('hex')
const launcher = ts.createSourceFile('deploy.mjs', read('scripts/deploy-production.mjs'), ts.ScriptTarget.Latest, true)
function declaration(tree, name) {
  const found = tree.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert.equal(found.length, 1, 'Expected one ' + name)
  return found[0]
}
const crmFiles = [
  'src/crm/CrmApp.tsx', 'src/crm/LeadDetail.tsx', 'src/crm/LeadForm.tsx',
  'src/crm/i18n.tsx', 'src/crm/leadFormHydration.ts', 'src/crm/leadFormHydration.test.mjs',
  'tests/crm-contact-form.browser.test.mjs', 'tests/fixtures/crm-contact-leads.mjs',
  'scripts/deploy-scope.mjs', 'scripts/deploy-production.mjs',
  'scripts/deploy-reviewed-public-data.json', 'scripts/test-deploy-safety.mjs', 'scripts/test-deploy-secret-scan.mjs',
  'scripts/incremental-r2-release.mjs',
]

test('CRM accepts exact form/test/control paths and rejects unrelated paths', () => {
  assert.deepEqual(invalidFilesForScope(crmFiles, 'crm'), [])
  assert.equal(inferDeployScope(crmFiles), 'crm')
  for (const file of ['tests/other.test.mjs', 'tests/fixtures/other.mjs',
    'scripts/incremental-r2-release-other.mjs', 'scripts/incremental-r2-release.mjs/other',
    'scripts/other-release.mjs', 'src/blog/posts/other.ts', 'public/demos/lobo-mobo-study/index.html']) {
    assert.equal(matchesDeployScope(file, 'crm'), false, file)
  }
  assert.equal(inferDeployScope([...crmFiles, 'src/blog/posts/other.ts']), null)
  for (const file of ['lobo-mobo-study/src/main.ts', 'public/demos/lobo-mobo-study/index.html',
    'scripts/build-lobo-mobo-study.mjs']) assert.equal(matchesDeployScope(file, 'project:lobo-mobo-study'), true)
})

// Execute the real plan and its nested budget gate. Only Git payload reads,
// content scanning and policy-file reads are inert; sizes are metadata, not allocations.
function mediaBudgetHarness(sizes, elapsed = 0) {
  const tree = ts.createSourceFile('media.mjs', read('scripts/incremental-r2-release.mjs'), ts.ScriptTarget.Latest, true)
  const fileLimit = tree.statements.find(n => ts.isVariableStatement(n) &&
    n.declarationList.declarations.some(d => d.name.getText(tree) === 'MAX_FILE'))
  assert.ok(fileLimit)
  const payload = Buffer.from('synthetic media'), hash = digest(payload), files = new Map()
  const entries = sizes.map((bytes, i) => {
    const name = '/fixture/' + i + '.bin'
    files.set('public' + name, { path: 'public' + name, type: 'blob', mode: '100644', oid: 'a'.repeat(40), bytes })
    return { path: name, bytes, sha256: hash, key: objectKey(name, hash), access: 'public', delivery: 'legacy' }
  })
  let reads = 0, ticks = 0
  const context = vm.createContext({
    validateManifest, PUBLIC_ORIGIN, scanPolicy: () => 'b'.repeat(64), console: { log() {} },
    Date: { now: () => 1000 + (ticks++ === 0 ? 0 : elapsed) },
    git: (_root, args) => { assert.deepEqual(Array.from(args), ['cat-file', 'blob', 'a'.repeat(40)]); reads++; return payload },
    assessReuse: (entry, _identity, readSource) => { assert.equal(readSource(), payload); return entry },
  })
  vm.runInContext(fileLimit.getText(tree) + '\n' + declaration(tree, 'createReusePlan').getText(tree).replace(/^export\s+/, ''), context)
  return {
    run: () => context.createReusePlan({ root: '/synthetic', deploymentId: 'dpl_fixture',
      manifest: { version: 1, origin: PUBLIC_ORIGIN, files: entries }, files, previousFiles: files }),
    get reads() { return reads },
  }
}

test('real media gate accepts 1300000000 bytes and refuses the next byte before reading', () => {
  const sizes = Array(10).fill(130_000_000), exact = mediaBudgetHarness(sizes)
  assert.equal(exact.run().reusedBytes, 1_300_000_000)
  assert.equal(exact.reads, 10)
  sizes[9]++
  const excess = mediaBudgetHarness(sizes)
  assert.throws(excess.run, { message: 'Fresh media scan byte budget exceeded' })
  assert.equal(excess.reads, 9)
})

test('real media gate accepts 15000 files and refuses file 15001 before reading', () => {
  const exact = mediaBudgetHarness(Array(15000).fill(1))
  assert.equal(exact.run().files.length, 15000)
  assert.equal(exact.reads, 15000)
  const excess = mediaBudgetHarness(Array(15001).fill(1))
  assert.throws(excess.run, { message: 'Fresh media scan file count budget exceeded' })
  assert.equal(excess.reads, 15000)
})

test('real media gate keeps the 120000 ms boundary with a controlled clock', () => {
  const exact = mediaBudgetHarness([1], 120000)
  assert.equal(exact.run().files.length, 1)
  assert.equal(exact.reads, 1)
  const excess = mediaBudgetHarness([1], 120001)
  assert.throws(excess.run, { message: 'Fresh media scan time budget exceeded' })
  assert.equal(excess.reads, 0)
})

function harness(t, { scope = 'crm', verifyOnly = false, inheritedSkip = 'false', fault = '' } = {}) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'iom-deploy-control-test-'))
  t.after(() => {
    assert.equal(path.dirname(stage), os.tmpdir())
    assert.ok(path.basename(stage).startsWith('iom-deploy-control-test-'))
    fs.rmSync(stage, { recursive: true, force: true })
  })
  fs.writeFileSync(path.join(stage, 'app.js'), 'export const fixture = true;\n')
  const events = [], local = [], remote = [], r2 = []
  const env = { IOM_SKIP_BLOG_SYNC: inheritedSkip, CRM_EMAIL_RELEASE_PHASE: 'PREPARED' }
  const manifest = () => {
    const files = fs.readdirSync(stage).map(file => ({ path: file, size: fs.statSync(path.join(stage, file)).size }))
    return { files, fileCount: files.length, totalSize: files.reduce((n, file) => n + file.size, 0) }
  }
  const context = vm.createContext({
    root: '/synthetic-repository', join: path.join, Buffer, createHash, readFileSync: fs.readFileSync, writeVerificationAudit() {},
    process: { env, execPath: '/synthetic-node', platform: 'win32',
      argv: ['node', 'deploy', '--scope', scope, ...(verifyOnly ? ['--verify-only'] : [])] },
    console: { log() {}, error() {}, warn() {} }, npm: { name: 'npm' }, npx: { name: 'npx' },
    MAX_SOURCE_BYTES: 1_000_000_000, FORBIDDEN_UPLOAD_PREFIXES: ['.env', '.qa-out/'],
    knownDeployScopes, matchesDeployScope, inferDeployScope, isValidProjectSlug,
    isValidDemoSlug: () => false, requestedEmailReleasePhase, knownValuesFromEnvironment, withScannedRelease,
    releaseOperation: () => null, parseHarpOperation: () => null, ensureCommit() {}, ensureAncestor() {},
    // This fixture exercises build/scan/push orchestration, not external HARP or
    // provenance providers. Their production implementations remain unchanged.
    assertHarpStage() {}, assertNoHarpManifest() {}, sealHarpRemoteBuild() {},
    assertRetainedStore() { if (fault === 'store') throw new Error('synthetic retained store mismatch') },
    assertProductionUnchanged() { if (fault === 'production') throw new Error('synthetic production changed') },
    buildReleaseMetadata: () => ({}), provenanceScopes: () => [],
    git: args => args.includes('origin/master') ? 'a'.repeat(40) : 'b'.repeat(40),
    changedFiles: () => scope === 'crm' ? crmFiles : [scope === 'crm-email'
      ? 'api/_lib/crm-email-tools.mjs' : scope === 'storm-publication' ? 'src/data/stormPublication.json' : 'lobo-mobo-study/src/main.ts'],
    productionMetadata: () => ({ id: 'synthetic-deployment' }),
    productionState: () => ({ base: 'a'.repeat(40), overlays: { 'project:lobo-mobo-study': 'c'.repeat(40) } }),
    readProductionManifest: () => ({}),
    composeSnapshot: state => ({ stage, base: state.base, overlays: state.overlays, reuse: { runtimeComplete: true }, reuseIdentity: 'fixture' }),
    existsSync: file => !file.replaceAll('\\', '/').includes('public/demos/'), symlinkSync() {}, rmSync() {},
    cleanupStage: () => events.push('cleanup'), parseJsonOutput: output => JSON.parse(output),
    assertReleaseManifestSecrets: (...args) => { events.push('scan'); return assertReleaseManifestSecrets(...args) },
    command: (file, args) => {
      if (args.some(arg => String(arg).endsWith('prepare-r2-release.mjs'))) {
        events.push('r2'); r2.push(Array.from(args))
        if (fault === 'r2') throw new Error('synthetic missing R2 object')
      } else if (file === 'git' && args.includes('push')) {
        events.push('push')
        if (fault === 'after-push') fs.writeFileSync(path.join(stage, 'unexpected.js'), 'export const extra = true;')
      } else assert.ok(args.some(arg => String(arg).endsWith('pre-deploy-check.mjs')))
    },
    packageCommand: (tool, args, options) => {
      if (tool.name === 'npm') {
        events.push('build'); local.push({ ...options.env })
        if (fault === 'build') throw new Error('synthetic build failed')
        if (fault === 'scan') fs.writeFileSync(path.join(stage, 'app.js'), 'const token="synthetic-not-a-credential";')
      } else if (args.includes('--dry')) return JSON.stringify(manifest())
      else {
        assert.ok(args.includes('--prod')); events.push('publish'); remote.push(Array.from(args))
        if (fault === 'unclear') throw new Error('synthetic unknown publication outcome')
      }
      return ''
    },
  })
  for (const name of ['fail', 'requestedScopes', 'requestedTarget', 'validateScopeName', 'resolveScopes',
    'validateUnpushedFiles', 'buildSnapshot', 'demoSlugForScope', 'verifyUploadManifest', 'deploySnapshot', 'main']) {
    vm.runInContext(declaration(launcher, name).getText(launcher), context)
  }
  return { run: () => context.main(), events, local, remote, r2, env }
}

test('real CRM launcher forces blog skip in both builds and only verifies R2', t => {
  const h = harness(t); h.run()
  assert.equal(h.local[0].IOM_SKIP_BLOG_SYNC, 'true')
  assert.equal(h.local[0].CRM_EMAIL_RELEASE_PHASE, 'PREPARED')
  assert.equal(h.env.IOM_SKIP_BLOG_SYNC, 'false')
  const args = h.remote[0]
  assert.equal(args.filter(x => x === 'IOM_SKIP_BLOG_SYNC=true').length, 1)
  assert.equal(args[args.indexOf('IOM_SKIP_BLOG_SYNC=true') - 1], '--build-env')
  assert.ok(!args.some(x => x.startsWith('CRM_EMAIL_RELEASE_PHASE=')))
  assert.equal(h.r2[0].filter(x => x === '--verify-only').length, 1)
  assert.deepEqual(h.events, ['build', 'scan', 'r2', 'scan', 'push', 'scan', 'publish', 'cleanup'])
})

test('CRM verify-only runs the gates without push or publication', t => {
  const h = harness(t, { verifyOnly: true }); h.run()
  assert.equal(h.local[0].IOM_SKIP_BLOG_SYNC, 'true')
  assert.equal(h.r2[0].filter(x => x === '--verify-only').length, 1)
  assert.deepEqual(h.events, ['build', 'scan', 'r2', 'scan', 'cleanup'])
})

test('LOBO retains its explicit blog-skip forwarding and existing R2 policy', t => {
  for (const inheritedSkip of ['true', 'false']) {
    const h = harness(t, { scope: 'project:lobo-mobo-study', inheritedSkip }); h.run()
    assert.equal(h.local[0].IOM_SKIP_BLOG_SYNC, inheritedSkip)
    assert.equal(h.remote[0].includes('IOM_SKIP_BLOG_SYNC=true'), inheritedSkip === 'true')
    assert.ok(!h.r2[0].includes('--verify-only'))
  }
})

test('existing email production gate and build phase remain intact', t => {
  const blocked = harness(t, { scope: 'crm-email' })
  assert.throws(blocked.run, /CRM release requires/)
  assert.deepEqual(blocked.events, [])
  const check = harness(t, { scope: 'crm-email', verifyOnly: true }); check.run()
  assert.equal(check.local[0].IOM_SKIP_BLOG_SYNC, 'true')
  assert.equal(check.local[0].CRM_EMAIL_RELEASE_PHASE, 'ACTIVE')
  assert.ok(!check.events.includes('push') && !check.events.includes('publish'))
})

test('build, R2 and scanner failures stop publication; post-push drift is refused', t => {
  for (const fault of ['build', 'r2', 'scan', 'after-push']) {
    const h = harness(t, { fault })
    assert.throws(h.run, fault === 'after-push' ? /SCAN_RELEASE_CHANGED/ : /synthetic|SECRET_DETECTED/)
    assert.ok(!h.events.includes('publish'))
    assert.equal(h.events.includes('push'), fault === 'after-push')
    assert.equal(h.events.at(-1), 'cleanup')
  }
})

test('unclear publication propagates failure with one attempt and no rollback', t => {
  const h = harness(t, { fault: 'unclear' })
  assert.throws(h.run, /unknown publication outcome/)
  assert.equal(h.remote.length, 1)
  assert.equal(h.events.filter(x => x === 'push').length, 1)
  assert.match(launcher.text, /catch \(error\)[\s\S]*process\.exitCode = 1/)
})

test('provenance guard failures stop orchestration before any push or publication', t => {
  for (const fault of ['store', 'production']) {
    const h = harness(t, { fault })
    assert.throws(h.run, /synthetic retained store mismatch|synthetic production changed/)
    assert.ok(!h.events.includes('push') && !h.events.includes('publish'))
    assert.equal(h.events.at(-1), 'cleanup')
  }
})

test('real R2 worker refuses a missing object before reading bytes or requesting PUT', async () => {
  const tree = ts.createSourceFile('r2.mjs', read('scripts/prepare-r2-release.mjs'), ts.ScriptTarget.Latest, true)
  const worker = declaration(tree, 'prepare').body.statements.filter(n =>
    ts.isExpressionStatement(n) && n.getText(tree).startsWith('await Promise.all('))
  assert.equal(worker.length, 1)
  const methods = [], context = vm.createContext({
    objects: [{ key: 'synthetic', path: '/synthetic' }], cursor: 0, failure: null,
    verifyOnly: true, client: { request: async method => { methods.push(method); return { status: 404 } } },
    readAsset: () => assert.fail('Unexpected asset read'),
  })
  const failure = await vm.runInContext('(async()=>{' + worker[0].getText(tree) + ';return failure})()', context)
  assert.match(failure.message, /missing in verification-only mode/)
  assert.deepEqual(methods, ['HEAD'])
})

test('real blog skip exits before configuration, database or network access', () => {
  const tree = ts.createSourceFile('blog.mjs', read('scripts/sync-3d-viewer-blog.mjs'), ts.ScriptTarget.Latest, true)
  const first = tree.statements.find(n => !ts.isImportDeclaration(n))
  assert.ok(ts.isIfStatement(first), 'Blog skip must precede configuration access')
  const executable = first.getText(tree)
  assert.match(executable, /IOM_SKIP_BLOG_SYNC/)
  const stopped = new Error('expected skip'), forbidden = () => assert.fail('Unexpected operation before blog skip')
  assert.throws(() => vm.runInNewContext(executable, {
    process: { env: { IOM_SKIP_BLOG_SYNC: 'true' }, exit: code => { assert.equal(code, 0); throw stopped } },
    console: { log() {} }, readFileSync: forbidden, createClient: forbidden, fetch: forbidden,
  }), error => error === stopped)
})

function reviewedAssignments(file) {
  const source = read(file), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JS), rows = []
  function visit(node) {
    if (ts.isPropertyAssignment(node) && (ts.isStringLiteralLike(node.name) || ts.isIdentifier(node.name)) && secretName(node.name.text) &&
      (ts.isStringLiteralLike(node.initializer) || ts.isNumericLiteral(node.initializer))) {
      rows.push({ key: node.name.text, value: node.initializer.text, numeric: ts.isNumericLiteral(node.initializer),
        start: node.initializer.getStart(tree), end: node.initializer.end })
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return { source, rows, bytes: Buffer.from(source) }
}

test('public reviews pin unchanged UI literals and four numeric request counters', () => {
  const registry = JSON.parse(read('scripts/deploy-reviewed-public-data.json')).files
  for (const file of ['src/crm/i18n.tsx', 'src/crm/leadFormHydration.test.mjs']) {
    const { source, bytes, rows } = reviewedAssignments(file)
    const record = registry[file].find(r => r.fileDigest === digest(bytes))
    assert.ok(record, 'Checked-in source needs its exact reviewed digest')
    assert.deepEqual([...new Set(rows.map(r => digest(JSON.stringify([r.key, r.value]))))].sort(), [...record.literalDigests].sort())
    if (file.endsWith('.tsx')) {
      assert.equal(rows.length, 20)
      assert.ok(registry[file].some(r => r !== record && JSON.stringify([...r.literalDigests].sort()) === JSON.stringify([...record.literalDigests].sort())))
    } else {
      assert.equal(rows.length, 4)
      for (const row of rows) assert.ok(row.numeric && row.value === '1' && ['token', 'activeToken'].includes(row.key))
      assert.match(source, /next\.token\[next\.selectedId\] = \(next\.token\[next\.selectedId\] \?\? 0\) \+ 1/)
      assert.match(read('src/crm/leadFormHydration.ts'), /token: number/)
    }
    for (const eol of ['\n', '\r\n']) {
      const checkoutBytes = Buffer.from(source.replace(/\r\n/g, '\n').replace(/\n/g, eol))
      assert.deepEqual(scanReleaseFile(file, checkoutBytes), { complete: true, rules: [], errors: [] })
    }
  }
})

test('changed hashes/literals, copied paths, signatures and configured values stay denied', () => {
  for (const file of ['src/crm/i18n.tsx', 'src/crm/leadFormHydration.test.mjs']) {
    const { source, bytes, rows } = reviewedAssignments(file)
    const denied = (name, text) => assert.ok(scanReleaseFile(name, Buffer.from(text)).rules.includes('credential_literal_assignment'))
    denied(file, source + '\n')
    denied(file.endsWith('.tsx') ? 'unreviewed-copy.tsx' : 'unreviewed-copy.mjs', source)
    for (const row of rows) {
      const changed = row.numeric ? '2' : JSON.stringify(row.value + ' synthetic-change')
      denied(file, source.slice(0, row.start) + changed + source.slice(row.end))
      assert.equal(publicLiteralReview(file, bytes)(row.key, row.value + 'changed'), false)
    }
    const known = file.endsWith('.tsx') ? rows.find(r => r.value.length >= 4).value : 'Acme'
    assert.ok(scanReleaseFile(file, bytes, [known]).rules.includes('configured_secret_value'))
    const prefixed = source + '\nconst fixture="sk-proj-' + 'a'.repeat(24) + '";'
    assert.ok(scanReleaseFile(file, Buffer.from(prefixed)).rules.includes('credential_token_prefix'))
  }
})

test('Storm forces blog sync off in local and remote builds without changing other scope policy', t => {
  for (const inheritedSkip of ['false', 'true']) {
    const h = harness(t, {scope:'storm-publication', inheritedSkip}); h.run()
    assert.equal(h.local[0].IOM_SKIP_BLOG_SYNC,'true')
    assert.equal(h.env.IOM_SKIP_BLOG_SYNC,inheritedSkip)
    assert.equal(h.remote[0].filter(x=>x==='IOM_SKIP_BLOG_SYNC=true').length,1)
    assert.equal(h.remote[0][h.remote[0].indexOf('IOM_SKIP_BLOG_SYNC=true')-1],'--build-env')
    assert.ok(!h.remote[0].some(x=>x.startsWith('CRM_EMAIL_RELEASE_PHASE=')))
  }
  const h=harness(t,{scope:'storm-publication',verifyOnly:true});h.run()
  assert.equal(h.local[0].IOM_SKIP_BLOG_SYNC,'true')
  assert.ok(h.r2[0].includes('--verify-only'))
  assert.ok(!h.events.includes('push') && !h.events.includes('publish'))
})

test('verification-only R2 client permits public HEAD and refuses mutations without credentials', async () => {
  const tree=ts.createSourceFile('r2.mjs',read('scripts/prepare-r2-release.mjs'),ts.ScriptTarget.Latest,true)
  const requests=[]
  const context=vm.createContext({publicRequest:async(key,method)=>{requests.push({key,method});return {status:200}}})
  vm.runInContext(declaration(tree,'verificationAssetsClient').getText(tree),context)
  const client=context.verificationAssetsClient()
  assert.equal((await client.request('HEAD','test-key')).status,200)
  await assert.rejects(client.request('PUT','test-key'),/Read-only verification/)
  assert.deepEqual(requests,[{key:'test-key',method:'HEAD'}])
  assert.match(read('scripts/prepare-r2-release.mjs'),/const client = verifyOnly \? verificationAssetsClient\(\) : await createAssetsClient\(\)/)
})
