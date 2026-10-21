import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { contactLead, catalogLead } from '../../tests/fixtures/crm-contact-leads.mjs'

const ts = createRequire(import.meta.url)('typescript')
const source = ts.transpileModule(
  await readFile(new URL('./leadFormHydration.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText
if (/^\s*import\s/m.test(source)) {
  throw new Error('leadFormHydration must stay free of imports')
}
const mod = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`)

const {
  applyDetailFetchResult,
  beginLeadEdit,
  buildLeadSubmit,
  buildLeadUpdate,
  LEAD_EDIT_FIELDS,
  canStartLeadEdit,
  isFullLeadRecord,
  leadTextReady,
  loadedLeadText,
  mergeFullLead,
  planDetailFetch,
  resolvedLeadText,
} = mod

function slim(id, extra = {}) { return catalogLead(id, extra) }
function full(id, extra = {}) { return contactLead(id, { company_name: 'Acme', ...extra }) }

function session(leads) {
  return {
    selectedId: null,
    status: {},
    token: {},
    leads: { ...leads },
    draft: null,
    draftDirty: false,
    editBase: null,
  }
}

function select(state, id) {
  const next = {
    ...state,
    status: { ...state.status },
    token: { ...state.token },
    leads: { ...state.leads },
  }
  if (next.selectedId && next.selectedId !== id) {
    next.token[next.selectedId] = (next.token[next.selectedId] ?? 0) + 1
    if (next.status[next.selectedId] === 'loading') next.status[next.selectedId] = 'idle'
    next.draft = null
    next.draftDirty = false
    next.editBase = null
  }
  next.selectedId = id
  return next
}

function start(state, options = {}) {
  const id = state.selectedId
  const plan = planDetailFetch({
    lead: state.leads[id],
    status: state.status[id],
    token: state.token[id] ?? 0,
    restart: options.restart === true,
    refresh: options.refresh === true,
  })
  if (!plan.start) {
    return {
      state: plan.status === 'ready' ? { ...state, status: { ...state.status, [id]: 'ready' } } : state,
      request: null,
    }
  }
  return {
    state: {
      ...state,
      status: { ...state.status, [id]: 'loading' },
      token: { ...state.token, [id]: plan.token },
    },
    request: { id, token: plan.token },
  }
}

function settle(state, request, result, options = {}) {
  const outcome = applyDetailFetchResult({
    requestId: request.id,
    selectedId: state.selectedId,
    token: request.token,
    activeToken: state.token[request.id] ?? 0,
    cancelled: options.cancelled === true,
    current: state.leads[request.id] ?? null,
    result,
    draft: state.draft,
    draftDirty: state.draftDirty,
  })
  if (outcome.ignored) return { state, outcome }
  const leads = { ...state.leads }
  if (outcome.status === 'ready' && outcome.lead) leads[request.id] = outcome.lead
  return {
    state: {
      ...state,
      status: { ...state.status, [request.id]: outcome.status },
      leads,
      draft: outcome.draft,
    },
    outcome,
  }
}

function open(state) {
  const base = beginLeadEdit(state.leads[state.selectedId])
  if (!base) return { state, opened: false }
  return {
    state: { ...state, editBase: base, draft: { ...base }, draftDirty: false },
    opened: true,
  }
}

function edit(state, key, value) {
  assert.ok(state.draft, 'form is open')
  return { ...state, draft: { ...state.draft, [key]: value }, draftDirty: true }
}

function close(state) {
  return { ...state, draft: null, draftDirty: false, editBase: null }
}

test('a catalog row is not editable until offer and notes are present', () => {
  const row = slim('a')
  assert.equal(isFullLeadRecord(row), false)
  assert.equal(canStartLeadEdit(row), false)
  assert.equal(beginLeadEdit(row), null)
  assert.equal(loadedLeadText(row, 'offer'), undefined)
  assert.equal(loadedLeadText(row, 'notes'), undefined)
  assert.equal(isFullLeadRecord({ ...row, offer: 'Only offer' }), false)
})

test('loaded null becomes an empty string and a loaded empty string stays editable', () => {
  assert.equal(loadedLeadText({ offer: null }, 'offer'), '')
  assert.equal(isFullLeadRecord(full('a', { offer: null, notes: null })), true)
  assert.equal(isFullLeadRecord(full('a', { offer: '', notes: '' })), true)
  const opened = beginLeadEdit(full('a', { offer: null, notes: '' }))
  assert.equal(opened.offer, '')
  assert.equal(opened.notes, '')
})

test('merging a slim row does not invent empty offer or notes', () => {
  const previous = slim('a')
  const merged = mergeFullLead(previous, { id: 'a', company_name: 'Renamed' })
  assert.equal('offer' in merged, false)
  assert.equal('notes' in merged, false)
  assert.equal(merged.company_name, 'Renamed')
  assert.equal(merged.contact_role, 'Director')
  assert.equal(isFullLeadRecord(merged), false)
})

test('merging keeps loaded text and replaces it only when the new row includes it', () => {
  const previous = full('a')
  const kept = mergeFullLead(previous, { id: 'a', company_name: 'Renamed' })
  assert.equal(kept.offer, 'Pavilion walkthrough')
  assert.equal(kept.notes, 'Call after 15:00')
  const replaced = mergeFullLead(previous, { id: 'a', offer: null, notes: 'Updated' })
  assert.equal(replaced.offer, '')
  assert.equal(replaced.notes, 'Updated')
})

test('early open while the detail request is in flight does not open a form', () => {
  let state = select(session({ a: slim('a') }), 'a')
  const started = start(state)
  state = started.state
  assert.equal(state.status.a, 'loading')
  assert.ok(started.request)
  const attempted = open(state)
  assert.equal(attempted.opened, false)
  assert.equal(attempted.state.draft, null)
  assert.equal('offer' in state.leads.a, false)
})

test('a slow response keeps editing closed until offer and notes arrive', () => {
  let state = select(session({ a: slim('a') }), 'a')
  const started = start(state)
  state = started.state
  assert.equal(open(state).opened, false)
  const settled = settle(state, started.request, {
    ok: true,
    lead: full('a', { offer: 'Server offer', notes: 'Server notes' }),
  })
  state = settled.state
  assert.equal(state.status.a, 'ready')
  const opened = open(state)
  assert.equal(opened.opened, true)
  assert.equal(opened.state.draft.offer, 'Server offer')
  assert.equal(opened.state.draft.notes, 'Server notes')
  assert.equal(opened.state.draft.contact_role, 'Director')
})

test('a failed load is not ready, does not blank fields, and retry can succeed', () => {
  let state = select(session({ a: slim('a') }), 'a')
  const first = start(state)
  state = first.state
  const failed = settle(state, first.request, { ok: false })
  state = failed.state
  assert.equal(failed.outcome.ignored, false)
  assert.equal(state.status.a, 'error')
  assert.equal(isFullLeadRecord(state.leads.a), false)
  assert.equal('offer' in state.leads.a, false)
  assert.equal('notes' in state.leads.a, false)
  assert.equal(open(state).opened, false)

  const blocked = start(state)
  assert.equal(blocked.request, null)
  assert.equal(blocked.state.status.a, 'error')

  const retry = start(state, { restart: true })
  state = retry.state
  assert.equal(state.status.a, 'loading')
  const lateFailure = settle(state, first.request, { ok: false })
  assert.equal(lateFailure.outcome.ignored, true)
  assert.equal(lateFailure.state.status.a, 'loading')
  assert.equal('offer' in lateFailure.state.leads.a, false)

  const recovered = settle(state, retry.request, {
    ok: true,
    lead: full('a', { offer: 'Recovered', notes: '' }),
  })
  state = recovered.state
  assert.equal(state.status.a, 'ready')
  assert.equal(state.leads.a.offer, 'Recovered')
  assert.equal(state.leads.a.notes, '')
  assert.equal(open(state).opened, true)
})

test('null and a foreign id are failures and do not become an empty save', () => {
  const current = slim('a')
  const missing = applyDetailFetchResult({
    requestId: 'a',
    selectedId: 'a',
    token: 1,
    activeToken: 1,
    cancelled: false,
    current,
    result: { ok: true, lead: null },
    draft: null,
    draftDirty: false,
  })
  assert.equal(missing.status, 'error')
  assert.equal(missing.lead, current)
  assert.equal('notes' in missing.lead, false)

  const foreign = applyDetailFetchResult({
    requestId: 'a',
    selectedId: 'a',
    token: 1,
    activeToken: 1,
    cancelled: false,
    current,
    result: { ok: true, lead: full('b') },
    draft: null,
    draftDirty: false,
  })
  assert.equal(foreign.status, 'error')
  assert.equal(foreign.lead, current)
  assert.equal(foreign.lead.company_name, 'Acme Mock')
})

test('closing and reopening uses the loaded lead, not the discarded draft', () => {
  let state = select(session({ a: full('a') }), 'a')
  state = start(state).state
  assert.equal(state.status.a, 'ready')
  state = open(state).state
  state = edit(state, 'company_name', 'Unsaved')
  state = close(state)
  assert.equal(state.status.a, 'ready')
  assert.notEqual(state.status.a, 'error')
  const reopened = open(state)
  assert.equal(reopened.opened, true)
  assert.equal(reopened.state.draft.company_name, 'Acme')
  assert.equal(reopened.state.draft.offer, 'Pavilion walkthrough')
  assert.equal(reopened.state.draft.notes, 'Call after 15:00')
})

test('a fast lead change ignores the previous response and does not cross the records', () => {
  let state = select(session({ a: slim('a'), b: slim('b', { company_name: 'Beta' }) }), 'a')
  const leadA = start(state)
  state = leadA.state
  state = select(state, 'b')
  const leadB = start(state)
  state = leadB.state
  assert.equal(state.status.b, 'loading')

  const stale = settle(state, leadA.request, {
    ok: true,
    lead: full('a', { offer: 'Offer A', notes: 'Notes A', company_name: 'Alpha' }),
  })
  assert.equal(stale.outcome.ignored, true)
  state = stale.state
  assert.equal(state.status.b, 'loading')
  assert.equal('offer' in state.leads.a, false)
  assert.equal('offer' in state.leads.b, false)
  assert.equal(state.leads.b.company_name, 'Beta')

  const current = settle(state, leadB.request, {
    ok: true,
    lead: full('b', { offer: 'Offer B', notes: 'Notes B', company_name: 'Beta' }),
  })
  state = current.state
  assert.equal(state.leads.b.offer, 'Offer B')
  assert.equal(state.leads.b.notes, 'Notes B')
  assert.equal('offer' in state.leads.a, false)
  assert.equal(state.leads.a.company_name, 'Acme Mock')
})

test('a later load keeps an open form even before the user types', () => {
  let state = select(session({ a: full('a') }), 'a')
  state = open(state).state
  const refresh = start(state, { refresh: true })
  const settled = settle(state, refresh.request, {
    ok: true,
    lead: full('a', { company_name: 'Server name', offer: 'Server offer', notes: 'Server notes' }),
  })
  assert.equal(settled.state.draft.company_name, 'Acme')
  assert.equal(settled.state.draft.offer, 'Pavilion walkthrough')
  assert.equal(settled.state.draft.notes, 'Call after 15:00')
  assert.equal(settled.state.draftDirty, false)
})

test('a later load does not replace an open unsaved draft', () => {
  let state = select(session({ a: full('a') }), 'a')
  state = open(state).state
  state = edit(state, 'company_name', 'Typed name')
  const refresh = start(state, { refresh: true })
  state = refresh.state
  assert.equal(state.draft.company_name, 'Typed name')
  const settled = settle(state, refresh.request, {
    ok: true,
    lead: full('a', {
      company_name: 'Server name',
      offer: 'Server offer',
      notes: 'Server notes',
    }),
  })
  state = settled.state
  assert.equal(settled.outcome.ignored, false)
  assert.equal(state.draft.company_name, 'Typed name')
  assert.equal(state.draft.offer, 'Pavilion walkthrough')
  assert.equal(state.draft.notes, 'Call after 15:00')
  assert.equal(state.draftDirty, true)
  const saved = buildLeadSubmit(state.draft, 'edit')
  assert.equal(saved.ok, true)
  assert.equal(saved.value.company_name, 'Typed name')
  assert.equal(saved.value.offer, 'Pavilion walkthrough')
  assert.equal(saved.value.notes, 'Call after 15:00')
  assert.equal(saved.value.contact_role, 'Director')
  assert.equal(saved.value.company_focus, 'Exhibits')
})

test('saving one edit keeps the other loaded fields', () => {
  const form = full('a', {
    company_name: 'Renamed',
    offer: '  Pavilion walkthrough  ',
    notes: 'Call after 15:00',
  })
  const saved = buildLeadSubmit(form, 'edit')
  assert.equal(saved.ok, true)
  assert.equal(saved.value.company_name, 'Renamed')
  assert.equal(saved.value.offer, 'Pavilion walkthrough')
  assert.equal(saved.value.notes, 'Call after 15:00')
  assert.equal(saved.value.contact_role, 'Director')
  assert.equal(saved.value.company_focus, 'Exhibits')
  assert.equal(saved.value.initial_email_body, 'Hello from the catalog')
  assert.equal(saved.value.email, 'ada@example.test')
})

test('an edit cannot save missing text as an empty string', () => {
  const saved = buildLeadSubmit(slim('a'), 'edit')
  assert.deepEqual(saved, { ok: false, reason: 'incomplete' })
  assert.equal('value' in saved, false)
  assert.equal(leadTextReady(undefined, 'notes', 'edit'), false)
  assert.equal(resolvedLeadText(undefined, 'edit').ok, false)
  const cleared = buildLeadSubmit(full('a', { notes: '   ' }), 'edit')
  assert.equal(cleared.ok, true)
  assert.equal(cleared.value.notes, '')
  assert.equal(cleared.value.offer, 'Pavilion walkthrough')
})

test('creating a lead still allows empty offer and notes', () => {
  const saved = buildLeadSubmit(
    { company_name: 'New', offer: '', notes: '', contact_role: '' },
    'create',
  )
  assert.equal(saved.ok, true)
  assert.equal(saved.value.offer, '')
  assert.equal(saved.value.notes, '')
  const missing = buildLeadSubmit({ company_name: 'New', offer: undefined, notes: null }, 'create')
  assert.equal(missing.ok, true)
  assert.equal(missing.value.offer, '')
  assert.equal(missing.value.notes, '')
  assert.equal(leadTextReady(undefined, undefined, 'create'), true)
})

test('contact form source waits for a full record and does not trim missing text', async () => {
  const [app, form, detail] = await Promise.all([
    readFile(new URL('./CrmApp.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./LeadForm.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./LeadDetail.tsx', import.meta.url), 'utf8'),
  ])
  assert.equal(app.includes('hydratedLeadIds'), false)
  assert.match(app, /planDetailFetch\(/)
  assert.match(app, /applyDetailFetchResult\(/)
  assert.match(app, /mergeFullLead\(/)
  assert.match(app, /if \(outcome\.ignored\) return/)
  assert.doesNotMatch(form, /form\.offer\.trim\(/)
  assert.doesNotMatch(form, /form\.notes\.trim\(/)
  assert.match(form, /buildLeadSubmit\(/)
  assert.match(form, /initial is read once/)
  assert.match(detail, /beginLeadEdit\(/)
  assert.match(detail, /if \(!base\) return/)
  assert.match(detail, /editBase/)
  assert.doesNotMatch(detail, /onClick=\{\(\) => setEditing\(true\)\}/)
  assert.match(detail, /editBase\.id !== lead\.id/)
})

test('offer and notes alone cannot authorize a payload with another missing field', () => {
  for (const key of LEAD_EDIT_FIELDS) {
    const stored = full('a')
    const incomplete = { ...stored }
    delete incomplete[key]
    assert.equal(canStartLeadEdit(incomplete), false, key)
    assert.equal(beginLeadEdit(incomplete), null, key)
    assert.equal(buildLeadSubmit(incomplete, 'edit').ok, false, key)
    assert.throws(() => buildLeadUpdate(incomplete, { ...incomplete, company_name: 'Changed' }, stored),
      /incomplete_lead_update/, key)
    assert.deepEqual(stored, full('a'), 'no update may replace the stored value')
    assert.equal(isFullLeadRecord({ ...stored, [key]: undefined }), false, key)
  }
})

test('normalizer default for a missing contact_role is never submitted by a company edit', () => {
  const stored = full('a', { contact_role: 'Keep this server value' })
  // Equivalent to the existing API normalizer when a read omits contact_role.
  const base = { ...stored, contact_role: '' }
  const draft = { ...base, company_name: 'Changed' }
  const prepared = { ...draft, initial_email_drafted_at: '2026-10-21T10:00:00Z' }
  const patch = buildLeadUpdate(base, draft, prepared)
  assert.deepEqual(patch, { company_name: 'Changed' })
  assert.equal({ ...stored, ...patch }.contact_role, 'Keep this server value')
})

test('unchanged normalized, trimmed and auto-derived values are absent from updates', () => {
  const base = full('a', { offer: '  keep spaces  ' })
  const draft = { ...base, company_name: 'Changed' }
  const prepared = { ...draft, offer: 'keep spaces', initial_email_drafted_at: 'new stamp' }
  assert.deepEqual(buildLeadUpdate(base, draft, prepared), { company_name: 'Changed' })
  assert.deepEqual(buildLeadUpdate(base, base, prepared), {})
})

test('explicit clearing and derived edits still work without sending untouched fields', () => {
  const base = full('a')
  const draft = { ...base, notes: '  ' }
  assert.deepEqual(buildLeadUpdate(base, draft, { ...draft, notes: '' }), { notes: '' })
  const place = { ...base, client_city: 'Novi Sad' }
  assert.deepEqual(buildLeadUpdate(base, place, { ...place, client_lat: 45.2, client_lon: 19.8 }),
    { client_city: 'Novi Sad', client_lat: 45.2, client_lon: 19.8 })
  const mail = { ...base, initial_email_body: 'Edited draft' }
  assert.deepEqual(buildLeadUpdate(base, mail, { ...mail, initial_email_drafted_at: 'new stamp' }),
    { initial_email_body: 'Edited draft', initial_email_drafted_at: 'new stamp' })
})

test('merge keeps missing or undefined non-text values without overwriting loaded data', () => {
  const base = full('a')
  const merged = mergeFullLead(base, { id: 'a', offer: 'New offer', notes: '', contact_role: undefined })
  assert.equal(merged.contact_role, 'Director')
  assert.equal(merged.client_address, 'Synthetic address')
})
