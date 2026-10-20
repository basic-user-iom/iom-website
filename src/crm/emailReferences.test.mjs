import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import net from 'node:net'
import tls from 'node:tls'
import vm from 'node:vm'
import { normalizeEmailReferences } from './emailReferences.mjs'
import { ingestInboundEmail, headerValue } from '../../api/_lib/crm-inbound-ingest.js'
import { createEmailWorkflow } from '../../api/_lib/crm-email-workflow.mjs'

const deny = () => { throw new Error('NETWORK_DISABLED_IN_LOCAL_TESTS') }
net.Socket.prototype.connect = deny
net.connect = net.createConnection = tls.connect = deny
globalThis.fetch = deny
syncBuiltinESMExports()
const ts = createRequire(import.meta.url)('typescript')
const uiSource = ts.transpileModule(await readFile(new URL('./emailThread.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const context = vm.createContext({})
const ui = new vm.SourceTextModule(uiSource, { context })
await ui.link(async specifier => {
  assert.equal(specifier, './emailReferences.mjs')
  return new vm.SyntheticModule(['normalizeEmailReferences'], function () {
    this.setExport('normalizeEmailReferences', normalizeEmailReferences)
  }, { context })
})
await ui.evaluate()
const threading = ui.namespace.replyThreadingFromMessages
const ids = ['<first@example.test>', '<Second@example.test>', '<third@example.test>', '<fourth@example.test>']
const parent = '<parent@example.test>'
const leadId = '22222222-2222-4222-8222-222222222222'

for (const input of [ids.join(' '), ids.join('\t'), ids, JSON.stringify(ids)]) {
  test(`canonical References: ${Array.isArray(input) ? 'array' : String(input)[0] === '[' ? 'JSON' : 'plain'}`, () => {
    assert.equal(normalizeEmailReferences(input), ids.join(' '))
  })
}
test('deduplicates exact IDs case-insensitively while retaining order and spelling', () => {
  assert.equal(normalizeEmailReferences([ids[0], ids[1], ids[1].toLowerCase(), ids[0]]), ids.slice(0, 2).join(' '))
})
for (const input of [null, undefined, '', ' \t ', [], '[]']) {
  test(`empty References ${JSON.stringify(input)}`, () => assert.equal(normalizeEmailReferences(input), ''))
}
for (const input of [
  '["<x@example.test>"', '[null]', '[42]', '[["<x@example.test>"]]', '{}',
  'bare@example.test', '<x@example.test> junk', '<missing-at>', '<x@@example.test>',
  '<x@example.test>\r\nBcc: victim@example.test', '<x@example.test>\n<y@example.test>',
  JSON.stringify(['<x@example.test>\r\nBcc: victim@example.test']),
  JSON.stringify(['<x@example.test>\u0000']), ['<x@example.test>', {}],
]) {
  test(`rejects malformed or injected References ${JSON.stringify(input)}`, () => {
    assert.throws(() => normalizeEmailReferences(input), /^Error: Invalid reply references$/)
  })
}
test('Frits-shaped stored JSON chain yields four ancestors plus real parent', () => {
  const result = threading([{ message_id: parent, references_header: JSON.stringify(ids) }])
  assert.equal(result.inReplyTo, parent)
  assert.equal(result.references, [...ids, parent].join(' '))
})
test('threading uses exact parent tokens and never duplicates an existing parent', () => {
  assert.equal(threading([{ message_id: parent, references_header: JSON.stringify([...ids, parent]) }]).references,
    [...ids, parent].join(' '))
})
test('invalid stored chain stays invalid for the server, never silently becomes a fresh message', () => {
  const bad = '["<x@example.test>",null]'
  const result = threading([{ message_id: parent, references_header: bad }])
  assert.equal(result.inReplyTo, parent)
  assert.equal(result.references, `${bad} ${parent}`)
})
test('missing parent leaves the existing unthreaded behavior unchanged', () => {
  const result = threading([])
  assert.equal(result.inReplyTo, null)
  assert.equal(result.references, null)
})
test('headerValue preserves every References array item, without changing unrelated headers', () => {
  assert.equal(headerValue({ References: ids }, 'references'), ids.join(' '))
  assert.equal(headerValue({ Subject: ['one', 'two'] }, 'subject'), 'one')
})

function workflow(parentExists = true) {
  const state = { reviews: 0, sends: 0, parents: [] }
  const actor = { kind: 'staff', ownerId: '11111111-1111-4111-8111-111111111111' }
  const flow = createEmailWorkflow({
    staffReviewMode: true, enabled: () => true, authorize: async () => true,
    identities: async () => [{ id: 'projects', configured: true, email: 'projects@example.test', fromHeader: 'Fixture <projects@example.test>' }],
    send: async () => { state.sends++; throw new Error('send must not run during preview') },
    store: {
      lead: async () => ({ id: leadId, email: 'recipient@example.test', emails: [] }),
      replyParent: async (owner, lead, id) => { state.parents.push({ owner, lead, id }); return parentExists },
      review: async (owner, review) => { state.reviews++; return { id: 'local-review', ...review } },
    },
  })
  const args = { kind: 'followup', leadId, messageIntentId: '33333333-3333-4333-8333-333333333333',
    to: 'recipient@example.test', fromIdentity: 'projects', subject: 'Local fixture', body: 'Local fixture only' }
  return { flow, state, actor, args }
}
test('actual workflow previews canonical JSON-derived thread without sending or enqueueing', async () => {
  const f = workflow()
  const refs = threading([{ message_id: parent, references_header: JSON.stringify(ids) }])
  const preview = await f.flow.preview(f.actor, { ...f.args, ...refs })
  assert.equal(preview.snapshot.references, [...ids, parent].join(' ').toLowerCase())
  assert.equal(f.state.reviews, 1)
  assert.equal(f.state.sends, 0)
  assert.equal(f.state.parents[0].lead, leadId)
  assert.equal(f.state.parents[0].id, parent)
})
test('actual workflow still rejects a parent from another lead', async () => {
  const f = workflow(false)
  const refs = threading([{ message_id: parent, references_header: JSON.stringify(ids) }])
  await assert.rejects(f.flow.preview(f.actor, { ...f.args, ...refs }), /reply_parent_not_on_lead/)
  assert.equal(f.state.reviews, 0)
  assert.equal(f.state.sends, 0)
})
test('actual workflow still rejects injected and malformed UI chains before review creation', async () => {
  for (const bad of ['["<x@example.test>",null]', '<x@example.test>\r\nBcc: victim@example.test']) {
    const f = workflow()
    const refs = threading([{ message_id: parent, references_header: bad }])
    await assert.rejects(f.flow.preview(f.actor, { ...f.args, ...refs }), /invalid_reply/)
    assert.equal(f.state.reviews, 0)
    assert.equal(f.state.sends, 0)
  }
})

test('future ingest stores canonical References and preserves inbound deduplication', async () => {
  const rows = []
  let existing = false
  globalThis.fetch = async (url, options = {}) => {
    assert.ok(String(url).startsWith('https://fixture.invalid/rest/v1/'))
    const method = options.method || 'GET'
    if (method === 'GET') return { ok: true, text: async () => JSON.stringify(existing ? [{ id: 'local-inbound', lead_id: leadId }] : []) }
    if (method === 'POST' && String(url).endsWith('/crm_lead_messages')) {
      rows.push(JSON.parse(options.body))
      return { ok: true, text: async () => JSON.stringify([{ id: 'local-inbound' }]) }
    }
    assert.ok(method === 'PATCH' || String(url).endsWith('/crm_activities'))
    return { ok: true, text: async () => '[]' }
  }
  try {
    const input = { supabaseUrl: 'https://fixture.invalid', serviceKey: 'local-fixture-only',
      message: { from: 'recipient@example.test', to: 'projects@example.test', leadId, text: 'Local fixture',
        messageId: parent, references: JSON.stringify(ids) } }
    assert.equal((await ingestInboundEmail(input)).status, 200)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].references_header, ids.join(' '))
    assert.equal(rows[0].message_id, parent)
    existing = true
    assert.equal((await ingestInboundEmail(input)).body.duplicate, true)
    assert.equal(rows.length, 1)
  } finally { globalThis.fetch = deny }
})
test('malformed future inbound References are rejected before any network or storage action', async () => {
  const result = await ingestInboundEmail({ supabaseUrl: 'https://fixture.invalid', serviceKey: 'local-fixture-only',
    message: { from: 'recipient@example.test', text: 'Local fixture', references: '["<id@example.test>",null]' } })
  assert.equal(result.status, 400)
  assert.equal(result.body.code, 'invalid_reply_references')
})
