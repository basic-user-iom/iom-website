import { emailDigest } from './crm-email-workflow.mjs'

// LOCAL CONTRACT ONLY. No route, DB connection, queue or sender is attached.
// A future adapter must authenticate/scopify the actor, store the trusted review,
// persist a unique owner/command receipt, and compare-and-set in one transaction.
export class ContactApprovalError extends Error {
  constructor(code) { super(code); this.code = code }
}
const fail = code => { throw new ContactApprovalError(code) }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const digestPattern = /^[a-f0-9]{64}$/
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
function fields(value, allowed, required = allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => value[key] === undefined)) fail('invalid_contact_arguments')
}
function text(value, max, code = 'invalid_contact_source') {
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) fail(code)
  return value
}
function address(value) {
  if (typeof value !== 'string' || value.length > 320 || !/^[^\s@<>,;\r\n]+@[^\s@<>,;\r\n]+\.[^\s@<>,;\r\n]+$/.test(value.trim())) fail('invalid_contact_recipient')
  return value.trim().toLowerCase()
}
// Match the existing UI tag semantics while preserving every unrelated tag byte.
const tagKey = tag => tag.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._+/-]/g, '').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 40)
const needsReview = tags => tags.some(tag => tagKey(tag) === 'needs-review')

function source({ ownerId, leadId, to }, lead) {
  if (!uuid.test(ownerId || '') || !uuid.test(leadId || '')) fail('invalid_contact_identity')
  if (!object(lead) || lead.owner_id !== ownerId || lead.id !== leadId) fail('contact_owner_or_selection_mismatch')
  // node-postgres returns timestamptz as Date; JSON/API callers use strings.
  const updatedAt = lead.updated_at instanceof Date && Number.isFinite(+lead.updated_at) ? lead.updated_at.toISOString() : lead.updated_at
  if (typeof updatedAt !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt))) fail('contact_revision_required')
  if (!Array.isArray(lead.tags) || lead.tags.length > 100 || lead.tags.some(tag => typeof tag !== 'string' || tag.length > 100 || tag.includes('\0'))) fail('contact_review_state_required')
  if (!Array.isArray(lead.emails) || lead.emails.length > 50) fail('invalid_contact_source')
  const recipients = [...new Set([lead.email, ...lead.emails.map(entry => {
    if (!object(entry)) fail('invalid_contact_source')
    return entry.email
  })].filter(value => value !== '' && value !== null && value !== undefined).map(address))].sort()
  const selectedRecipient = address(to)
  if (!recipients.includes(selectedRecipient)) fail('recipient_not_on_contact')
  const subject = text(lead.initial_email_subject, 998)
  if (/[\r\n]/.test(subject)) fail('invalid_contact_source')
  return {
    schemaVersion: 1,
    operation: 'approve_contact',
    ownerId, leadId, version: updatedAt,
    selectedRecipient,
    contact: {
      companyName: text(lead.company_name, 2000),
      contactName: text(lead.contact_name, 2000),
      recipients,
      status: text(lead.status, 100),
    },
    draft: { subject, body: text(lead.initial_email_body, 100000) },
    currentTags: [...lead.tags],
  }
}

/** Produce the exact selected contact/draft review, never a send authorization. */
export function createContactApprovalReview(args, lead) {
  fields(args, ['ownerId', 'leadId', 'to'])
  const snapshot = source(args, lead)
  if (!needsReview(snapshot.currentTags)) fail('contact_already_approved')
  return { ...snapshot, digest: emailDigest(snapshot) }
}

/**
 * Pure CAS descriptor. The adapter must resolve a prior committed command receipt
 * before checking a repeated request; a stale descriptor is never safe to replay.
 * It must compare the entire source digest under lock, then update tags only.
 */
export function prepareContactApproval(args, review, currentLead) {
  fields(args, ['ownerId', 'leadId', 'to', 'confirmed', 'digest'])
  if (args.confirmed !== true) fail('contact_confirmation_required')
  fields(review, ['schemaVersion', 'operation', 'ownerId', 'leadId', 'version', 'selectedRecipient', 'contact', 'draft', 'currentTags', 'digest'])
  const { digest, ...reviewSnapshot } = review
  if (!digestPattern.test(digest || '') || args.digest !== digest || emailDigest(reviewSnapshot) !== digest) fail('contact_review_digest_mismatch')
  const current = source(args, currentLead)
  if (emailDigest(current) !== digest) fail('contact_review_stale')
  if (!needsReview(current.currentTags)) fail('contact_already_approved')
  return {
    operation: 'approve_contact', ownerId: args.ownerId, leadId: args.leadId,
    commandKey: `contact-approval:${digest}`,
    expected: { updatedAt: current.version, sourceDigest: digest, tags: [...current.currentTags] },
    patch: { tags: current.currentTags.filter(tag => tagKey(tag) !== 'needs-review') },
    emailAction: 'none',
  }
}

/** Eligibility only; a caller still needs sender-bound message review/confirmation. */
export function assertApprovedContact(args, lead) {
  fields(args, ['ownerId', 'leadId', 'to', 'expectedUpdatedAt', 'expectedDigest'], ['ownerId', 'leadId', 'to'])
  const snapshot = source(args, lead)
  if (needsReview(snapshot.currentTags)) fail('contact_needs_review')
  const digest = emailDigest(snapshot)
  if ((args.expectedUpdatedAt !== undefined && args.expectedUpdatedAt !== snapshot.version) ||
      (args.expectedDigest !== undefined && (!digestPattern.test(args.expectedDigest) || args.expectedDigest !== digest))) fail('contact_review_stale')
  return { ...snapshot, digest }
}

function zone(value){
  if(typeof value!=='string'||value.length>80||(!value.includes('/')&&value!=='UTC'))fail('invalid_contact_source')
  try{new Intl.DateTimeFormat('en',{timeZone:value}).format(0);return value}catch{fail('invalid_contact_source')}
}
function storedZone(value){
  if(value===undefined||value===null||String(value).trim()==='')return ''
  return zone(value)
}
function tagList(value){
  if(value===undefined)return []
  if(!Array.isArray(value)||value.length>20||value.some(tag=>typeof tag!=='string'||tag.length>40||tag.includes('\0')))fail('invalid_contact_source')
  return value.map(tag=>tag.trim()).filter(Boolean)
}
/** Review a new contact. This is not a send and not a needs-review approval. */
export function prepareContactCreate(args){
  if(!object(args))fail('invalid_contact_arguments')
  const allowed=['companyName','contactName','email','subject','body','timezone','tags','identity']
  if(Object.keys(args).some(key=>!allowed.includes(key))||args.email===undefined)fail('invalid_contact_arguments')
  if(args.identity!==undefined && args.identity!=='projects' && args.identity!=='visual')fail('identity_required')
  const companyName=text(args.companyName??'',2000).trim()
  const contactName=text(args.contactName??'',2000).trim()
  if(!companyName&&!contactName)fail('invalid_contact_source')
  const email=address(args.email)
  const subject=text(args.subject??'',300).trim()
  const body=text(args.body??'',50000).trim()
  if(!!subject!==!!body||/[\r\n]/.test(subject))fail('invalid_contact_source')
  const listed=tagList(args.tags)
  const tags=listed.some(tag=>tagKey(tag)==='needs-review')?listed:[...listed,'needs-review']
  const identity=args.identity==='visual'?'visual':'projects'
  const draft={schemaVersion:1,operation:'create_contact',companyName,contactName,email,subject,body,timezone:storedZone(args.timezone),tags,identity}
  return {...draft,digest:emailDigest(draft)}
}
/** Duplicate addresses are reported. A new row is Under revision and is not a send. */
export function contactCreatePlan(existing, contact) {
  const email = String(contact?.email || '').trim().toLowerCase()
  const matches = (Array.isArray(existing) ? existing : []).filter(row => String(row?.email || '').trim().toLowerCase() === email)
  const listed = Array.isArray(contact?.tags) ? contact.tags.filter(tag => typeof tag === 'string' && tag.trim()) : []
  const tags = listed.some(tag => tagKey(tag) === 'needs-review') ? listed : [...listed, 'needs-review']
  if (matches.length) return {
    alreadyExists: true, inserted: false, emailAction: 'none', underRevision: false,
    leadId: matches.length === 1 ? matches[0].id : null, choiceRequired: matches.length > 1,
    matches: matches.map(row => {
      const account = accountByOwner(row.owner_id)
      return {leadId: row.id, company: row.company_name || null, contact: row.contact_name || null, status: row.status || null, ownerId: row.owner_id || null, identity: account?.identity || null}
    }),
  }
  return {alreadyExists: false, inserted: true, emailAction: 'none', status: 'new', tags, underRevision: true, choiceRequired: false, matches: []}
}
/** Explicit confirmation only. The caller inserts the row and must not send mail. */
export function confirmContactCreate(args,draft){
  if(!object(args)||args.confirmed!==true)fail('contact_confirmation_required')
  if(!digestPattern.test(args.digest||'')||!draft||args.digest!==draft.digest||emailDigest({...draft,digest:undefined})!==draft.digest)fail('contact_review_digest_mismatch')
  if(!/^[A-Za-z0-9_.:-]{8,120}$/.test(args.idempotencyKey||''))fail('invalid_confirmation')
  return {operation:'create_contact',emailAction:'none',commandKey:`contact-create:${draft.digest}`,idempotencyKey:args.idempotencyKey,contact:{...draft}}
}

// The two staff-pair logins. A lead stays on the owner that already holds it.
export const CRM_ACCOUNTS = Object.freeze({
  projects: Object.freeze({ identity: 'projects', ownerId: '1add2cb0-a00a-4f92-a20a-7d90cb23afdd', email: 'projects@iobjectm.com', fromHeader: 'IOM Projects <projects@iobjectm.com>' }),
  visual: Object.freeze({ identity: 'visual', ownerId: '1dd6199e-25b2-4def-b790-7ce6a372ae53', email: 'visual@iobjectm.com', fromHeader: 'IOM Visual <visual@iobjectm.com>' }),
})
export function accountByIdentity(identity) {
  return identity === 'projects' || identity === 'visual' ? CRM_ACCOUNTS[identity] : null
}
export function accountByOwner(ownerId) {
  return Object.values(CRM_ACCOUNTS).find(account => account.ownerId === ownerId) || null
}
// A job owner is only the account named by the requested identity.
// Projects never resolves to the visual owner, and an unknown identity resolves to none.
export function jobOwnerForIdentity(identity) {
  const account = accountByIdentity(identity)
  return account ? account.ownerId : null
}
// The published needs-review read uses l.owner_id = the projects principal and leaves
// iom.email_staff_pair empty. A visual-owned row then matches nothing, and the store
// reports lead_not_found. This names that miss. It does not grant a new owner.
export function leadLookupMiss(connectionOwnerId, leadOwnerId) {
  const lead = accountByOwner(leadOwnerId)
  const connection = accountByOwner(connectionOwnerId)
  if (!lead) return { found: false, reason: 'lead_not_found', cause: 'owner_outside_accounts' }
  if (connection && connection.ownerId === lead.ownerId) return { found: true, reason: null, identity: lead.identity, ownerId: lead.ownerId }
  return { found: false, reason: 'lead_not_found', cause: 'owner_id_filter', identity: lead.identity, ownerId: lead.ownerId, connectionIdentity: connection?.identity || null }
}
export function presentAccountMatches(leads, identity) {
  if (identity !== undefined && identity !== null && !accountByIdentity(identity)) fail('identity_required')
  const rows = (Array.isArray(leads) ? leads : []).map(row => {
    const stored = accountByOwner(row?.owner_id || row?.ownerId) || accountByIdentity(row?.account_identity)
    const account = stored || CRM_ACCOUNTS.projects
    return { row, identity: stored?.identity || row?.account_identity || account.identity, ownerId: row?.owner_id || row?.ownerId || account.ownerId, sender: account.email }
  }).filter(item => !identity || item.identity === identity)
  const accounts = [...new Set(rows.map(item => item.identity))]
  return { ambiguous: !identity && accounts.length > 1, accounts, rows }
}
// An oauth job cannot be stored for the visual owner with the current policies.
// Search can use the existing staff-pair read. Sending is not claimed.
export const VISUAL_JOB_BLOCK = Object.freeze({
  reason: 'visual_job_not_authorized',
  policy: 'crm_email_private.jobs credential_owner',
  staffPairPolicy: 'crm_email_private.jobs staff_pair_type',
  missingPrincipalOwnerId: CRM_ACCOUNTS.visual.ownerId,
  applied: false,
})

