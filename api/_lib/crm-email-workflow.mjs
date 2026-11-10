import { createHash } from 'node:crypto'
import { renderOutreachEmailHtml, renderOutreachPlainText } from './outreach-email-html.js'
import { normalizeMessageId, buildReferencesHeader } from './crm-lead-messages.js'
import { parseOutreachAttachments } from './email-attachments.js'
import { describeNamedAttachments, messageApprovalFingerprint, storedAttachmentRecord } from './crm-needs-review-attachments.mjs'
import { accountByIdentity, accountByOwner, jobOwnerForIdentity, presentAccountMatches, resolveSenderChoice } from './crm-contact-approval.mjs'
import { recipientWindow } from './crm-email-batch-policy.mjs'

export class EmailWorkflowError extends Error {
  constructor(code) { super(code); this.code = code }
}
export const fail = code => { throw new EmailWorkflowError(code) }
// PostgreSQL jsonb may reorder object keys. Hash semantic content, not insertion order.
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value
export const emailDigest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
const hash = emailDigest
export const emailContentDigest = ({legacySchedule, ...content}) => hash(content)
const knownDirection = value => value === 'inbound' || value === 'outbound'
export function classifyInboundReplies(messages, {truncated = false} = {}) {
  if (!Array.isArray(messages)) fail('reply_thread_unavailable')
  const byLead = new Map()
  for (const row of messages) {
    if (!row || typeof row !== 'object') fail('reply_thread_unavailable')
    const list = byLead.get(row.leadId) || []
    list.push(row)
    byLead.set(row.leadId, list)
  }
  const replies = []
  for (const row of messages) {
    if (row.direction !== 'inbound' || row.autoReply === true) continue
    const thread = byLead.get(row.leadId) || []
    const inboundAt = Date.parse(row.occurredAt)
    const outboundTimes = thread.filter(item => item.direction === 'outbound').map(item => Date.parse(item.occurredAt))
    const laterKnown = row.laterOutbound === true || row.laterOutbound === false
    const unclearDirection = thread.some(item => !knownDirection(item.direction))
    // A newest-page or date window can omit older mail. laterOutbound is the database
    // fact for any later stored outbound, so truncation alone does not hide a new reply.
    const unreliable = (!laterKnown && truncated) || unclearDirection || !Number.isFinite(inboundAt) || outboundTimes.some(time => !Number.isFinite(time))
    const answered = !unreliable && (laterKnown ? row.laterOutbound === true : outboundTimes.some(time => time > inboundAt))
    const parent = typeof row.messageId === 'string' ? row.messageId : ''
    const threadReady = /^<[^<>\s@]+@[^<>\s@]+>$/.test(parent)
    replies.push({
      leadId: row.leadId, messageId: parent || null, occurredAt: row.occurredAt || null,
      person: typeof row.person === 'string' && row.person.trim() ? row.person.trim() : null,
      company: typeof row.company === 'string' && row.company.trim() ? row.company.trim() : null,
      subject: typeof row.subject === 'string' && row.subject.trim() ? row.subject.trim() : null,
      recipient: typeof row.from === 'string' && row.from.trim() ? row.from.trim() : null,
      content: typeof row.content === 'string' && row.content.trim() ? row.content : null,
      contentState: typeof row.content === 'string' && row.content.trim() ? 'present' : 'unavailable',
      answerState: unreliable ? 'unreliable' : answered ? 'answered' : 'waiting',
      threadState: threadReady ? 'ready' : 'unreliable',
      identity: row.identity === 'projects' || row.identity === 'visual' ? row.identity : null,
      ownerId: typeof row.ownerId === 'string' ? row.ownerId : null,
      linked: thread.map(item => ({
        direction: knownDirection(item.direction) ? item.direction : 'unknown',
        occurredAt: item.occurredAt || null,
        subject: typeof item.subject === 'string' && item.subject.trim() ? item.subject.trim() : null,
        content: typeof item.content === 'string' && item.content.trim() ? item.content : null,
        messageId: typeof item.messageId === 'string' && item.messageId ? item.messageId : null,
      })),
    })
  }
  replies.sort((left, right) => String(right.occurredAt || '').localeCompare(String(left.occurredAt || '')))
  return {replies, truncated: truncated === true}
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const email = value => {
  if (typeof value !== 'string' || !/^[^\s@<>,;\r\n]+@[^\s@<>,;\r\n]+\.[^\s@<>,;\r\n]+$/.test(value.trim())) fail('invalid_recipient')
  return value.trim().toLowerCase()
}
export function cardRecipientAddresses(lead) {
  const raw = [lead?.email, ...(Array.isArray(lead?.emails) ? lead.emails.map(item => item?.email ?? item) : [])]
  return [...new Set(raw.filter(value => typeof value === 'string').map(value => value.trim().toLowerCase()).filter(Boolean))]
}
// A reply address is the card, or the From column of the inbound message named by this thread.
// Subject and body are intentionally not arguments: text inside the message is not a recipient.
export function replyRecipientDecision({ to, lead, inbound = null, threadReply = false } = {}) {
  const card = cardRecipientAddresses(lead)
  const target = String(to || '').trim().toLowerCase()
  const sameLead = inbound && String(inbound.leadId || inbound.lead_id || '') === String(lead?.id || lead?.leadId || '')
  const messageFrom = sameLead && inbound.direction === 'inbound' ? String(inbound.from || inbound.from_email || '').trim().toLowerCase() : ''
  if (card.includes(target)) return { ok: true, source: 'card', card, messageFrom: messageFrom || null }
  if (!threadReply || !messageFrom) return { ok: false, code: threadReply ? 'reply_sender_not_linked' : 'recipient_not_on_lead', card, messageFrom: messageFrom || null }
  if (messageFrom === target) return { ok: true, source: 'inbound', card, messageFrom }
  return { ok: false, code: 'recipient_not_on_lead', card, messageFrom }
}
export function fields(args, allowed, required = allowed) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(k => !allowed.includes(k))) fail('invalid_arguments')
  if (required.some(k => args[k] === undefined)) fail('missing_arguments')
}
const dateParts = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
export function belgradeSchedule(local, offset, now) {
  if (typeof local !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) fail('invalid_local_time')
  if (offset !== undefined && !['+01:00', '+02:00'].includes(offset)) fail('invalid_utc_offset')
  const candidates = ['+01:00', '+02:00'].map(o => ({ o, date: new Date(`${local}:00${o}`) }))
    .filter(({date}) => Number.isFinite(+date) && dateParts.format(date).replace(' ', 'T') === local)
  if (!candidates.length) fail('nonexistent_local_time')
  if (candidates.length > 1 && !offset) fail('ambiguous_local_time_choose_offset')
  const selected = candidates.find(c => !offset || c.o === offset)
  if (!selected) fail('offset_does_not_match_belgrade')
  if (+selected.date <= now) fail('schedule_must_be_future')
  if (+selected.date > now + 366 * 86400000) fail('schedule_too_far')
  return { at: selected.date.toISOString(), local, offset: selected.o, timezone: 'Europe/Belgrade' }
}
const belgradeStamp = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
function belgradeMidnight(day) {
  const matches = ['+01:00', '+02:00'].map(offset => new Date(`${day}T00:00:00${offset}`))
    .filter(date => {
      if (!Number.isFinite(+date)) return false
      const parts = Object.fromEntries(belgradeStamp.formatToParts(date).map(part => [part.type, part.value]))
      return `${parts.year}-${parts.month}-${parts.day}` === day && parts.hour === '00' && parts.minute === '00'
    })
  if (matches.length !== 1) fail('invalid_reply_window')
  return matches[0]
}
function shiftDay(day, amount) {
  const [year, month, date] = day.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, date + amount))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}
function replyInstant(value) {
  if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) fail('invalid_reply_window')
  const date = new Date(value)
  if (!Number.isFinite(+date)) fail('invalid_reply_window')
  return date.toISOString()
}
function replyBound(value, edge) {
  if (value === undefined) return null
  if (typeof value !== 'string' || value.length > 40) fail('invalid_reply_window')
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const start = belgradeMidnight(value)
    return edge === 'to' ? belgradeMidnight(shiftDay(value, 1)).toISOString() : start.toISOString()
  }
  return replyInstant(value)
}
const plainObject = value => value && typeof value === 'object' && !Array.isArray(value)
function contains(value, max) {
  if (value === undefined) return null
  if (typeof value !== 'string' || value.length > max) fail('invalid_arguments')
  const text = value.trim()
  if (!text) return null
  return `%${text.replace(/[\\%_]/g, char => `\\${char}`)}%`
}
function sameOptional(left, right) {
  if (left === undefined || right === undefined || left === right) return
  fail('invalid_reply_window')
}
function periodOf(value) {
  if (value === undefined) return {}
  if (!plainObject(value) || Object.keys(value).some(key => !['from', 'to'].includes(key))) fail('invalid_reply_window')
  return value
}
function cursorOf(value, keys) {
  if (value === undefined) return {}
  if (!plainObject(value) || Object.keys(value).some(key => !keys.includes(key))) fail('invalid_reply_window')
  return value
}
// from is inclusive and to is exclusive. A calendar date uses Europe/Belgrade midnight.
// The older-page cursor is occurred_at then id, newest first. A newer message that
// arrives while paging stays on the first page, so an older page neither skips nor repeats it.
export function normalizeReplyListWindow(args = {}) {
  fields(args, ['from', 'to', 'beforeOccurredAt', 'beforeId', 'company', 'contact', 'email', 'subject', 'period', 'cursor', 'identity'], [])
  if (args.identity !== undefined && !accountByIdentity(args.identity)) fail('identity_required')
  const period = periodOf(args.period)
  const cursor = cursorOf(args.cursor, ['beforeOccurredAt', 'beforeId'])
  sameOptional(args.from, period.from)
  sameOptional(args.to, period.to)
  sameOptional(args.beforeOccurredAt, cursor.beforeOccurredAt)
  sameOptional(args.beforeId, cursor.beforeId)
  const from = replyBound(args.from ?? period.from, 'from')
  const to = replyBound(args.to ?? period.to, 'to')
  if (from && to && Date.parse(from) >= Date.parse(to)) fail('invalid_reply_window')
  const beforeOccurredAt = args.beforeOccurredAt ?? cursor.beforeOccurredAt
  const beforeId = args.beforeId ?? cursor.beforeId
  const paging = beforeOccurredAt !== undefined || beforeId !== undefined
  if (paging && (beforeOccurredAt === undefined || beforeId === undefined || !UUID.test(beforeId || ''))) fail('invalid_reply_window')
  return {
    from, to,
    beforeOccurredAt: paging ? replyInstant(beforeOccurredAt) : null,
    beforeId: paging ? beforeId.toLowerCase() : null,
    company: contains(args.company, 200),
    contact: contains(args.contact, 200),
    email: contains(args.email, 320),
    subject: contains(args.subject, 300),
    identity: args.identity || null,
  }
}
export function normalizeCorrespondenceQuery(args = {}) {
  fields(args, ['leadId', 'company', 'contact', 'email', 'cursor', 'identity'], [])
  if (args.identity !== undefined && !accountByIdentity(args.identity)) fail('identity_required')
  if (args.leadId !== undefined && !UUID.test(args.leadId || '')) fail('invalid_arguments')
  const cursor = cursorOf(args.cursor, ['afterOccurredAt', 'afterId'])
  const paging = cursor.afterOccurredAt !== undefined || cursor.afterId !== undefined
  if (paging && (cursor.afterOccurredAt === undefined || cursor.afterId === undefined || !UUID.test(cursor.afterId || ''))) fail('invalid_reply_window')
  const company = contains(args.company, 200)
  const contact = contains(args.contact, 200)
  const email = contains(args.email, 320)
  if (args.leadId === undefined && !company && !contact && !email) fail('missing_arguments')
  return {
    leadId: args.leadId ? args.leadId.toLowerCase() : null,
    company, contact, email,
    afterOccurredAt: paging ? replyInstant(cursor.afterOccurredAt) : null,
    afterId: paging ? cursor.afterId.toLowerCase() : null,
    identity: args.identity || null,
  }
}
function zoneOffset(zone, date) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset', hour: '2-digit' })
    .formatToParts(date).find(item => item.type === 'timeZoneName')?.value || ''
  const match = part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  return match ? `${match[1]}${match[2].padStart(2, '0')}:${match[3] || '00'}` : null
}
function ianaZone(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 80) return null
  const name = value.trim()
  try { new Intl.DateTimeFormat('en-US', { timeZone: name }).format(0) } catch { return null }
  return name
}
// A stored IANA name is known. A city or country is only a guess and is never shown as known.
// The offset comes from the platform zone database, including daylight saving.
export function describeContactZone({ timezone, city, country } = {}, now = Date.now()) {
  const stored = ianaZone(timezone)
  if (stored) {
    const date = new Date(now)
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: stored, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map(part => [part.type, part.value]))
    return { timezone: stored, source: 'stored', localTime: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`, offset: zoneOffset(stored, date) }
  }
  const place = [city, country].some(value => typeof value === 'string' && value.trim())
  if (place) return { timezone: null, source: 'inferred', localTime: null, offset: null }
  return { timezone: null, source: 'unknown', localTime: null, offset: null }
}
const textState = value => {
  if (typeof value !== 'string' || !value.trim()) return { state: 'empty', value: null }
  return { state: 'present', value: value.trim() }
}
function attachmentViews(value) {
  if (!Array.isArray(value) || value.length === 0) return { attachments: [], attachmentRecord: 'not_stored', publicUrl: null }
  const attachments = value.map(item => storedAttachmentRecord(item))
  return {
    attachmentRecord: attachments.some(item => item.content === 'stored_private') ? 'stored_private' : 'metadata_only',
    attachments, publicUrl: null,
  }
}
export function shapeContactCard(row, now = Date.now()) {
  const account = accountByOwner(row?.owner_id || row?.ownerId) || accountByIdentity(row?.account_identity) || accountByIdentity('projects')
  const emails = Array.isArray(row?.emails) ? row.emails.filter(item => item && typeof item === 'object').map(item => ({
    label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : null,
    email: typeof item.email === 'string' && item.email.trim() ? item.email.trim() : null,
  })) : []
  const tags = Array.isArray(row?.tags) ? row.tags.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()) : []
  const draftSubject = textState(row?.initial_email_subject)
  const draftBody = textState(row?.initial_email_body)
  return {
    leadId: row?.id || null,
    identity: row?.account_identity || account.identity,
    ownerId: row?.owner_id || row?.ownerId || account.ownerId,
    sender: account.email,
    company: textState(row?.company_name),
    contact: textState(row?.contact_name),
    email: textState(row?.email),
    otherEmails: emails.length ? { state: 'present', value: emails } : { state: 'empty', value: [] },
    status: textState(row?.status),
    tags: tags.length ? { state: 'present', value: tags } : { state: 'empty', value: [] },
    localTime: describeContactZone({ timezone: row?.client_timezone }, now),
    drafts: {
      subject: draftSubject,
      body: draftBody,
      draftedAt: row?.initial_email_drafted_at || null,
      sentAt: row?.initial_email_sent_at || null,
      state: draftSubject.state === 'present' || draftBody.state === 'present' || row?.initial_email_drafted_at || row?.initial_email_sent_at ? 'present' : 'empty',
    },
    scheduledSend: row?.scheduled_send ? { state: 'present' } : { state: 'empty' },
    lastClientReplyAt: row?.last_client_reply_at || null,
    contactPriority: row?.contact_priority === true,
    updatedAt: row?.updated_at || null,
    unavailable: ['website', 'links', 'phone', 'notes', 'location', 'contactRole', 'companyFocus', 'offer', 'nextFollowUp', 'campaigns', 'activities'],
  }
}
export function shapeStoredMessage(row) {
  const direction = row?.direction === 'inbound' || row?.direction === 'outbound' ? row.direction : 'unknown'
  const sender = typeof row?.from === 'string' && row.from.trim() ? row.from.trim() : null
  const recipient = typeof row?.toHeader === 'string' && row.toHeader.trim() ? row.toHeader.trim() : null
  const content = typeof row?.content === 'string' && row.content.trim() ? row.content : null
  const files = attachmentViews(row?.attachments)
  return {
    id: row?.id || null,
    leadId: row?.leadId || null,
    direction,
    occurredAt: row?.occurredAt || null,
    sender,
    senderState: sender ? 'stored' : 'unavailable',
    recipient,
    recipientState: recipient ? 'stored_header' : 'unavailable',
    subject: typeof row?.subject === 'string' && row.subject.trim() ? row.subject.trim() : null,
    content,
    contentState: content ? 'present' : 'unavailable',
    replyStatus: direction === 'outbound' ? 'stored_outbound' : row?.autoReply === true ? 'auto_reply' : row?.laterOutbound === true ? 'answered' : direction === 'inbound' ? 'waiting' : 'unknown',
    messageId: typeof row?.messageId === 'string' && row.messageId ? row.messageId : null,
    ...files,
  }
}

const APPROVAL_KEY = /^[A-Za-z0-9_.:-]{8,40}$/
const OBLIGATION = /\b(invoice|payment|wire transfer|bank account|contract|we accept|we agree|purchase order|quoted price|plaćanje|placanje|ugovor|faktura|prihvatamo)\b/i
const ACKNOWLEDGMENTS = new Set([
  'We received your message and will reply soon.',
  'Primili smo poruku i javićemo se uskoro.',
])
export function dispatchReplay(previous) {
  if (!previous) return { send: true, retry: false }
  const status = previous.status === 'sending' ? 'unknown' : (previous.status || 'unknown')
  if (status === 'unknown') return { send: false, status: 'unknown', retry: false, reason: 'unknown_not_retried' }
  return { send: false, status, retry: false, reason: 'duplicate_not_resent' }
}
export function normalizeContactFind(args = {}) {
  fields(args, ['company', 'contact', 'email', 'leadIds', 'identity'], [])
  if (args.identity !== undefined && !accountByIdentity(args.identity)) fail('identity_required')
  const company = contains(args.company, 200)
  const contact = contains(args.contact, 200)
  const email = contains(args.email, 320)
  let leadIds = null
  if (args.leadIds !== undefined) {
    if (!Array.isArray(args.leadIds) || args.leadIds.length < 1 || args.leadIds.length > 200 || args.leadIds.some(id => !UUID.test(id || ''))) fail('invalid_arguments')
    leadIds = args.leadIds.map(id => id.toLowerCase())
  }
  if (!leadIds && !company && !contact && !email) fail('missing_arguments')
  return { company, contact, email, leadIds, identity: args.identity || null }
}
function approvalText(value) {
  return typeof value === 'string' ? value.trim() : ''
}
// One explicit list and purpose. This does not send. A later single call may
// queue or send only the rows this plan marks. Same intent key, unknown, and
// an unknown zone never become another send.
export function planApprovedSend(args, contacts = [], now = Date.now()) {
  const preview = args.preview === true && args.confirmed !== true
  fields(args, ['purpose', 'confirmed', 'idempotencyKey', 'localDate', 'allowReplySoon', 'recipients', 'preview'], preview ? ['purpose', 'idempotencyKey', 'recipients'] : ['purpose', 'confirmed', 'idempotencyKey', 'recipients'])
  if (!preview && args.confirmed !== true) fail('list_approval_required')
  if (typeof args.purpose !== 'string' || args.purpose.trim().length < 8 || args.purpose.length > 500) fail('purpose_required')
  if (!APPROVAL_KEY.test(args.idempotencyKey || '')) fail('invalid_confirmation')
  if (args.allowReplySoon !== undefined && typeof args.allowReplySoon !== 'boolean') fail('invalid_arguments')
  if (args.localDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(args.localDate)) fail('invalid_arguments')
  const list = args.recipients
  if (!Array.isArray(list) || list.length < 1 || list.length > 200) fail('invalid_selection')
  const byId = new Map()
  for (const row of contacts) {
    const id = String(row?.leadId || row?.id || '').toLowerCase()
    if (id) byId.set(id, row)
  }
  const seen = new Set()
  const recipients = []
  let blocked = null
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) { blocked = 'unclear_recipient'; break }
    const leadId = String(item.leadId || '').toLowerCase()
    if (!UUID.test(leadId) || seen.has(leadId)) { blocked = 'unclear_recipient'; break }
    seen.add(leadId)
    const kind = item.kind
    if (!['initial', 'followup', 'reply'].includes(kind)) { blocked = 'unclear_recipient'; break }
    const contact = byId.get(leadId)
    if (!contact) { blocked = 'unclear_recipient'; break }
    const to = approvalText(item.to).toLowerCase()
    const addresses = [contact.email, ...(Array.isArray(contact.emails) ? contact.emails.map(entry => entry?.email || entry) : [])]
      .map(value => approvalText(value).toLowerCase()).filter(Boolean)
    if (!to || !addresses.includes(to)) { blocked = 'unclear_recipient'; break }
    const subject = approvalText(item.subject)
    const body = approvalText(item.body)
    if (!subject || subject.length > 300 || /[\r\n]/.test(subject) || !body || body.length > 50000) { blocked = 'invalid_draft'; break }
    if (OBLIGATION.test(subject) || OBLIGATION.test(body)) { blocked = 'obligation_not_accepted'; break }
    if (ACKNOWLEDGMENTS.has(body) && args.allowReplySoon !== true) { blocked = 'acknowledgment_not_approved'; break }
    const zone = describeContactZone({ timezone: contact.client_timezone }, now)
    const knownZone = zone.source === 'stored' ? zone.timezone : null
    const leadAccount = accountByOwner(contact.owner_id || contact.ownerId) || accountByIdentity(contact.account_identity)
    if (item.identity !== undefined && item.identity !== 'projects' && item.identity !== 'visual') {
      recipients.push({
        leadId, to, kind, subject, body, retry: false, identity: null, ownerId: null,
        fromIdentity: null, sender: null, requestedIdentity: item.identity,
        action: 'hold', status: 'held', reason: `sender_not_approved:chosen=${item.identity}`, perFileConfirmRequired: false, publicUrl: null,
      })
      continue
    }
    const chosen = item.identity ? accountByIdentity(item.identity) : leadAccount
    if (!chosen) { blocked = 'sender_not_chosen'; break }
    if (kind === 'reply' && leadAccount && chosen.identity !== leadAccount.identity) {
      recipients.push({
        leadId, to, kind, subject, body, retry: false, identity: chosen.identity, ownerId: chosen.ownerId,
        fromIdentity: chosen.identity, sender: chosen.email, requestedIdentity: chosen.identity,
        contactOwnerId: leadAccount.ownerId, alternative: 'new_email',
        action: 'hold', status: 'held',
        reason: `cross_account_reply_needs_new_email:chosen=${chosen.identity}:required_owner=${chosen.ownerId}:contact_owner=${leadAccount.ownerId}`,
        perFileConfirmRequired: false, publicUrl: null,
      })
      continue
    }
    const account = chosen
    const files = describeNamedAttachments(item.attachments)
    const attachmentView = files.files.map(file => ({ filename: file.filename, contentType: file.contentType, size: file.size, content: file.content, reason: file.reason, publicUrl: null }))
    const base = {
      leadId, to, kind, subject, body, acknowledgment: ACKNOWLEDGMENTS.has(body),
      zone: knownZone, zoneSource: zone.source, retry: false,
      identity: account.identity, ownerId: account.ownerId, fromIdentity: account.identity, sender: account.email,
      attachments: attachmentView, attachmentFingerprint: files.fingerprint, perFileConfirmRequired: false, publicUrl: null,
      ...(files.ok && files.payload.length ? { attachmentPayload: files.payload } : {}),
    }
    if (!files.ok) {
      const idempotencyKey = `${args.idempotencyKey}:${kind}:${leadId}`
      recipients.push({ ...base, action: 'hold', status: 'held', reason: files.reason, idempotencyKey })
      continue
    }
    if (item.scheduledLocal !== undefined) {
      recipients.push({ ...base, action: 'hold', status: 'held', reason: knownZone ? 'schedule_not_activated' : 'unknown_zone', window: null, scheduledLocal: item.scheduledLocal })
      continue
    }
    if (kind === 'initial') {
      const idempotencyKey = `${args.idempotencyKey}:initial:${leadId}`
      if (contact.initial_email_sent_at || contact.has_outbound) {
        recipients.push({ ...base, action: 'hold', status: 'held', reason: 'initial_already_sent', idempotencyKey })
        continue
      }
      if (!knownZone) {
        recipients.push({ ...base, action: 'hold', status: 'held', reason: 'unknown_zone', window: null, idempotencyKey })
        continue
      }
      if (!args.localDate) { blocked = 'invalid_arguments'; break }
      const storedSubject = approvalText(contact.initial_email_subject)
      const storedBody = approvalText(contact.initial_email_body)
      if (storedSubject !== subject || storedBody !== body) {
        recipients.push({ ...base, action: 'hold', status: 'held', reason: 'content_not_stored', idempotencyKey })
        continue
      }
      const window = recipientWindow(args.localDate, knownZone, now)
      if (window === 'expired') {
        recipients.push({ ...base, action: 'hold', status: 'held', reason: 'recipient_window_missed', window, idempotencyKey })
        continue
      }
      const queued = { ...base, action: base.attachments.length ? 'send' : 'queue', status: base.attachments.length ? 'ready' : 'queued', reason: null, window, idempotencyKey, deliveryKey: `initial:${leadId}` }
      recipients.push(queued)
      continue
    }
    if (!UUID.test(item.messageIntentId || '') || (kind === 'reply' && !approvalText(item.inReplyTo))) { blocked = 'unclear_recipient'; break }
    const intent = item.messageIntentId.toLowerCase()
    recipients.push({
      ...base, action: 'send', status: 'ready', reason: null, messageIntentId: intent, inReplyTo: approvalText(item.inReplyTo) || null,
      idempotencyKey: `${args.idempotencyKey}:${kind}:${leadId}:${intent}`,
      deliveryKey: `${kind}:${leadId}:${intent}`,
    })
  }
  if (blocked) {
    return {
      purpose: args.purpose.trim(), idempotencyKey: args.idempotencyKey, confirmed: true,
      perMessageConfirmRequired: false, blocked, sent: false,
      recipients: list.map(item => ({ leadId: typeof item?.leadId === 'string' ? item.leadId.toLowerCase() : null, status: 'not_sent', reason: blocked, retry: false })),
      counts: { queue: 0, send: 0, hold: 0, reject: list.length },
    }
  }
  return {
    purpose: args.purpose.trim(), idempotencyKey: args.idempotencyKey, confirmed: preview ? false : true, preview,
    perMessageConfirmRequired: false, blocked: null, sent: false, publicUrl: null, recipients,
    allowReplySoon: args.allowReplySoon === true,
    counts: {
      queue: recipients.filter(item => item.action === 'queue').length,
      send: recipients.filter(item => item.action === 'send').length,
      hold: recipients.filter(item => item.action === 'hold').length,
      reject: 0,
    },
  }
}

// No credentials, network, environment loading, or production fallback in this module.
// authorize is REQUIRED on each operation and again before a worker claims a job.
export function createEmailWorkflow({ store, identities, send, authorize, enabled = () => false, now = Date.now, validateSchedule = async()=>{}, staffReviewMode = false }) {
  async function gate(actor, action) {
    if (!enabled()) fail('email_workflow_disabled')
    if (!actor || !UUID.test(actor.ownerId || '') || typeof authorize !== 'function' || await authorize(actor, action) !== true) fail('email_access_denied')
  }
  async function snapshot(actor, args, legacyInput) {
    if (!UUID.test(args.leadId || '')) fail('invalid_lead_id')
    const lead = await store.lead(actor.ownerId, args.leadId)
    if (!lead) fail('lead_not_found')
    const kind = legacyInput?.inReplyTo ? 'reply' : args.kind || 'initial'
    if (!['initial','reply','followup'].includes(kind)) fail('invalid_message_kind')
    if (kind === 'followup' && !UUID.test(args.messageIntentId || '')) fail('invalid_message_intent')
    if (kind === 'initial' && (lead.initial_email_sent_at || lead.has_outbound)) fail('initial_email_already_sent')
    if (lead.scheduled_send && !args.replaceLegacySchedule && !args.legacySchedule) fail('legacy_schedule_requires_review')
    const choice = resolveSenderChoice({
      fromIdentity: args.fromIdentity, leadOwnerId: lead.owner_id || lead.ownerId,
      actorKind: actor.kind, actorFromIdentity: actor.fromIdentity,
      reply: Boolean(args.inReplyTo) || kind === 'reply',
    })
    if (!choice.ok) fail(choice.code)
    const senderId = choice.identity
    const to = email(args.to)
    const identity = (await identities()).find(i => i.id === senderId && i.configured)
    if (!identity) fail(`sender_not_authorized:chosen=${senderId}:required_owner=${choice.ownerId}`)
    const from = email(identity.email)
    if (!identity.fromHeader || /[\r\n]/.test(identity.fromHeader)) fail('invalid_sender')
    const subject = String(kind !== 'initial' ? (legacyInput || args).subject : lead.initial_email_subject || '').trim()
    const body = String(kind !== 'initial' ? (legacyInput || args).body : lead.initial_email_body || '').trim()
    if (!subject || subject.length > 300 || /[\r\n]/.test(subject) || !body || body.length > 50000) fail('invalid_draft')
    const staffHeaders = staffReviewMode && actor.kind === 'staff' && !legacyInput
    const threadHeaders = !legacyInput && (staffHeaders || actor.kind === 'oauth')
    if (threadHeaders && [args.inReplyTo,args.references].some(v=>v !== undefined && (typeof v !== 'string' || /[\r\n]/.test(v)))) fail('invalid_reply')
    const parent = threadHeaders && args.inReplyTo ? normalizeMessageId(args.inReplyTo) : ''
    if (threadHeaders && args.inReplyTo && !parent) fail('invalid_reply')
    if (threadHeaders && args.references && !parent) fail('invalid_reply')
    const messageIdPattern=/^<[^<>\s@]+@[^<>\s@]+>$/
    if(parent && (!messageIdPattern.test(parent) || String(args.references||'').split(/\s+/).filter(Boolean).some(v=>!messageIdPattern.test(v))))fail('invalid_reply')
    if(parent && !await store.replyParent(actor.ownerId,lead.id,parent)){
      const leadOwner = lead.owner_id || lead.ownerId
      if (leadOwner && choice.ownerId !== leadOwner) fail(`cross_account_reply_needs_new_email:chosen=${choice.identity}:required_owner=${choice.ownerId}:contact_owner=${leadOwner}`)
      fail('reply_parent_not_on_lead')
    }
    const canUseInbound = typeof store.replyInbound === 'function'
    const inbound = parent && canUseInbound ? await store.replyInbound(actor.ownerId, lead.id, parent) : null
    const recipient = replyRecipientDecision({ to, lead, inbound, threadReply: Boolean(parent && canUseInbound) })
    if (!recipient.ok) fail(recipient.code)
    // Replies use a stable followup intent, preserving the DB delivery-key contract.
    if (parent && kind !== 'followup') fail('invalid_message_kind')
    const attachments = actor.kind === 'oauth' && args.attachments !== undefined
      ? (() => { const checked = describeNamedAttachments(args.attachments); if (!checked.ok) fail(checked.reason || 'attachment_invalid'); return checked.payload })()
      : staffHeaders && args.attachments !== undefined
        ? parseOutreachAttachments(args.attachments).map(a=>({filename:a.filename,contentType:a.contentType,content:a.content.toString('base64')}))
        : (legacyInput || args).attachments
    return {
      leadId: lead.id, to, from, fromHeader: identity.fromHeader, fromIdentity: identity.id,
      subject, body, text: renderOutreachPlainText(body), html: renderOutreachEmailHtml({subject, body}),
      template: 'crm-outreach-v1', kind,
      ...(lead.staff_scope ? {staffScope:lead.staff_scope} : {}),
      ...(kind === 'followup' ? {messageIntentId:args.messageIntentId.toLowerCase()} : {}),
      ...(kind === 'reply' ? {inReplyTo:(legacyInput || args).inReplyTo,references:(legacyInput || args).references || ''} : {}),
      ...(parent ? {inReplyTo:parent,references:buildReferencesHeader(args.references || '',parent)} : {}),
      ...(attachments?.length ? {attachments} : {}),
      ...(args.approvalFingerprint ? { approvalFingerprint: args.approvalFingerprint } : {}),
      ...(lead.owner_id || lead.ownerId ? { leadOwnerId: lead.owner_id || lead.ownerId } : {}),
      chosenSenderOwner: choice.ownerId,
      ...(lead.scheduled_send ? {legacySchedule:lead.scheduled_send} : {}),
    }
  }
  async function deliver(actor, id, jobOwner = actor.ownerId) {
    let job = await store.get(jobOwner, id)
    if (!job) fail('job_not_found')
    if (job.status !== 'queued') return job
    // Workers re-check the original grant/staff authorization, not a cron super-grant.
    const principal = actor.kind === 'worker' ? {...job.authorization,ownerId:job.ownerId} : actor
    await gate(principal, job.schedule ? 'schedule' : 'send')
    // Revalidate before an irreversible SMTP attempt. Never silently update the reviewed snapshot.
    try {
      const current = await snapshot(actor, job.snapshot)
      if (emailContentDigest(current) !== emailContentDigest(job.snapshot)) fail('review_stale')
    } catch (error) {
      if (!(error instanceof EmailWorkflowError)) throw error
      return store.block(jobOwner, id, error.code, job.version)
    }
    job = await store.claim(jobOwner, id, now(), job.version)
    if (!job) return store.get(jobOwner, id)
    // The sending claim commits BEFORE SMTP. Never reclaim, even after a crash.
    let result
    try {
      result = await send(job.snapshot, { ownerId: jobOwner, jobId: job.id })
      if (result?.ok !== true) throw new Error('provider_acceptance_unconfirmed')
    }
    catch {
      try { return await store.finish(jobOwner, id, 'unknown', { error: 'delivery_outcome_unknown_do_not_retry' }) }
      catch { return {...job,status:'unknown',error:'delivery_outcome_unknown_do_not_retry'} }
    }
    try {
      return await store.finish(jobOwner, id, 'sent', {
        messageId: result?.messageId || null,
        simulated: result?.simulated === true,
      })
    } catch {
      // SMTP accepted; a lost DB acknowledgement must never become a retriable send failure.
      return { ...job, status: 'unknown', error: 'delivery_accepted_receipt_unconfirmed_do_not_retry' }
    }
  }
  async function replyAddressView(actor, content) {
    const lead = await store.lead(actor.ownerId, content.leadId)
    const parent = content?.inReplyTo || ''
    const inbound = parent && lead && typeof store.replyInbound === 'function' ? await store.replyInbound(actor.ownerId, lead.id, parent) : null
    const decision = replyRecipientDecision({ to: content.to, lead, inbound, threadReply: Boolean(parent) })
    const primary = String(lead?.email || '').trim().toLowerCase() || null
    return { primary, additional: decision.card.filter(value => value !== primary), messageFrom: decision.messageFrom, source: decision.source }
  }
  const api = {
    async preview(actor, args) {
      await gate(actor, 'review')
      fields(args, ['leadId','to','fromIdentity','scheduledLocal','utcOffset','replaceLegacySchedule','kind','messageIntentId','subject','body','inReplyTo','references','attachments','approvalFingerprint'], ['leadId','to'])
      if (args.kind !== undefined && !['initial','followup'].includes(args.kind)) fail('invalid_message_kind')
      if (args.kind === 'followup') {
        if (typeof args.subject !== 'string' || typeof args.body !== 'string') fail('invalid_draft')
      } else if (['messageIntentId','subject','body'].some(k=>args[k]!==undefined)) fail('invalid_arguments')
      if (args.replaceLegacySchedule !== undefined && typeof args.replaceLegacySchedule !== 'boolean') fail('invalid_arguments')
      if (args.utcOffset !== undefined && args.scheduledLocal === undefined) fail('offset_requires_schedule')
      const content = await snapshot(actor, args)
      const addresses = await replyAddressView(actor, content)
      const schedule = args.scheduledLocal === undefined ? null : belgradeSchedule(args.scheduledLocal, args.utcOffset, now())
      await validateSchedule(actor,schedule)
      const reviewed = { snapshot: content, schedule,
        ...(staffReviewMode && actor.kind==='staff'?{principal:{kind:'staff',ownerId:actor.ownerId,accessRevision:actor.accessRevision}}:{}) }
      const digest = hash(reviewed)
      const review = await store.review(actor.ownerId, { ...reviewed, digest, expiresAt: new Date(now() + 15 * 60000).toISOString() })
      return { ...review, addresses, requiresExplicitConfirmation: true, status: 'review', sent: false, note: 'Confirm the exact recipient, sender, subject, rendered content and schedule.' }
    },
    async addressPreview(actor, args) {
      await gate(actor, 'review')
      fields(args, ['leadId','identity','emails'], ['leadId','emails'])
      if (!UUID.test(args.leadId || '')) fail('invalid_lead_id')
      if (args.identity !== undefined && args.identity !== 'projects' && args.identity !== 'visual') fail('identity_required')
      if (typeof store.addressPlan !== 'function') fail('address_change_unavailable')
      const plan = await store.addressPlan(actor.ownerId, args.leadId, args.emails, args.identity)
      return { ...plan, digest: emailDigest({ leadId: plan.leadId, ownerId: plan.ownerId, emails: plan.emails }), emailAction: 'none', requiresExplicitConfirmation: true, sent: false }
    },
    async addressConfirm(actor, args) {
      await gate(actor, 'review')
      fields(args, ['leadId','identity','emails','digest','idempotencyKey','confirmed'], ['leadId','digest','idempotencyKey','confirmed'])
      if (args.confirmed !== true || !/^[a-f0-9]{64}$/.test(args.digest || '') || !/^[A-Za-z0-9_.:-]{8,120}$/.test(args.idempotencyKey || '')) fail('invalid_confirmation')
      if (typeof store.addressCommit !== 'function') fail('address_change_unavailable')
      return store.addressCommit(actor.ownerId, args)
    },
    async confirm(actor, args) {
      fields(args, ['reviewId','digest','idempotencyKey','confirmed'])
      if (!UUID.test(args.reviewId || '') || !/^[a-f0-9]{64}$/.test(args.digest || '') || !/^[A-Za-z0-9_.:-]{8,120}$/.test(args.idempotencyKey || '') || args.confirmed !== true) fail('invalid_confirmation')
      await gate(actor, 'review')
      const review = await store.getReview(actor.ownerId, args.reviewId)
      if (!review || review.digest !== args.digest) fail('review_not_found_or_mismatch')
      const chosenOwner = jobOwnerForIdentity(review.snapshot?.fromIdentity)
      const chosenName = review.snapshot?.fromIdentity || 'none'
      if (!chosenOwner) fail(`sender_not_authorized:chosen=${chosenName}:required_owner=none`)
      const staffJob = staffReviewMode && actor.kind === 'staff'
      const jobOwner = staffJob ? actor.ownerId : chosenOwner
      if ((staffReviewMode && actor.kind==='staff' && (!review.principal || review.principal.kind!=='staff' ||
        review.principal.ownerId!==actor.ownerId || review.principal.accessRevision!==actor.accessRevision)) ||
        (actor.kind!=='staff' && review.principal?.kind==='staff')) fail('review_principal_mismatch')
      if (review.principal && hash({snapshot:review.snapshot,schedule:review.schedule,principal:review.principal})!==review.digest) fail('review_not_found_or_mismatch')
      await gate(actor, review.schedule ? 'schedule' : 'send')
      const existing = await store.replay(jobOwner, args.idempotencyKey)
      if (existing) {
        if ((existing.commandReviewId || existing.reviewId) !== args.reviewId) fail('idempotency_conflict')
        return existing
      }
      await validateSchedule(actor,review.schedule)
      if (+new Date(review.expiresAt) <= now()) fail('review_expired')
      if (review.schedule && +new Date(review.schedule.at) <= now()) fail('schedule_must_be_future')
      try {
        if (emailContentDigest(await snapshot(actor, review.snapshot)) !== emailContentDigest(review.snapshot)) fail('review_stale')
      } catch (error) {
        const raced=await store.replay(jobOwner,args.idempotencyKey)
        if(raced && (raced.commandReviewId || raced.reviewId)===review.id) return raced
        throw error
      }
      const job = review.replaceJobId
        ? await store.reschedule(jobOwner,review,args.idempotencyKey,now(),actor)
        : await store.enqueue(jobOwner, review, args.idempotencyKey, now(),actor)
      return review.schedule ? job : deliver(actor, job.id, jobOwner)
    },
    async list(actor, args = {}) {
      fields(args, [], [])
      await gate(actor, 'review')
      return store.list(actor.ownerId)
    },
    async replies(actor, args = {}) {
      await gate(actor, 'review')
      const window = normalizeReplyListWindow(args)
      if (typeof store.threadMessages !== 'function') fail('reply_thread_unavailable')
      const loaded = await store.threadMessages(actor.ownerId, window)
      const messages = Array.isArray(loaded) ? loaded : loaded?.messages
      const classified = classifyInboundReplies(messages, {truncated: loaded?.truncated === true})
      const raw = loaded?.next
      const next = raw && typeof raw.beforeOccurredAt === 'string' && UUID.test(raw.beforeId || '')
        ? { beforeOccurredAt: raw.beforeOccurredAt, beforeId: raw.beforeId } : null
      return {
        ...classified, truncated: classified.truncated === true, incomplete: classified.truncated === true,
        next, cursor: next, sort: { keys: ['occurred_at', 'id'], direction: 'desc' },
      }
    },
    async correspondence(actor, args = {}) {
      await gate(actor, 'review')
      const query = normalizeCorrespondenceQuery(args)
      if (typeof store.correspondence !== 'function') fail('reply_thread_unavailable')
      const loaded = await store.correspondence(actor.ownerId, query)
      const nowAt = now()
      const cards = (Array.isArray(loaded?.leads) ? loaded.leads : []).map(row => shapeContactCard(row, nowAt))
      const rawNext = loaded?.next
      const next = rawNext && typeof rawNext.afterOccurredAt === 'string' && UUID.test(rawNext.afterId || '')
        ? { afterOccurredAt: rawNext.afterOccurredAt, afterId: rawNext.afterId } : null
      const presented = presentAccountMatches(loaded?.leads || [], query.identity)
      const opened = cards.length === 1 && loaded?.choiceRequired !== true && !presented.ambiguous
      const messages = opened ? (Array.isArray(loaded?.messages) ? loaded.messages : []).map(shapeStoredMessage) : []
      const truncated = loaded?.truncated === true
      return {
        contact: opened ? cards[0] : null,
        matches: cards,
        messages,
        truncated, incomplete: truncated, next, cursor: next,
        choiceRequired: !opened,
        ...(presented.ambiguous ? { question: 'Which account should be used?', accounts: presented.accounts } : { accounts: presented.accounts }),
        sort: { keys: ['occurred_at', 'id'], direction: 'asc' },
        history: {
          complete: false,
          mailbox: 'not_verified',
          olderMessages: 'unknown',
          storedMessages: !opened ? 'not_opened' : truncated ? 'partial_page' : 'all_stored_rows_returned',
        },
      }
    },
    async status(actor,args) {
      fields(args,['idempotencyKey'])
      if(!/^[A-Za-z0-9_.:-]{8,120}$/.test(args.idempotencyKey||''))fail('invalid_arguments')
      await gate(actor,'review')
      const job=await store.replay(actor.ownerId,args.idempotencyKey)
      if(!job)return {status:'not_found'}
      if(job.authorization?.kind!==actor.kind ||
        (actor.kind==='staff' && job.authorization.accessRevision!==actor.accessRevision))fail('email_access_denied')
      return job
    },
    async cancel(actor, args) {
      fields(args, ['jobId'])
      if (!UUID.test(args.jobId || '')) fail('invalid_job_id')
      await gate(actor, 'cancel')
      return store.cancel(actor.ownerId, args.jobId)
    },
    async previewReschedule(actor,args) {
      fields(args,['jobId','scheduledLocal','utcOffset'],['jobId','scheduledLocal'])
      if (!UUID.test(args.jobId || '')) fail('invalid_job_id')
      await gate(actor,'schedule')
      const job = await store.get(actor.ownerId,args.jobId)
      if (!job) fail('job_not_found')
      if (job.status !== 'queued') fail('cannot_reschedule_delivery_started_or_finished')
      if (emailContentDigest(await snapshot(actor,job.snapshot)) !== emailContentDigest(job.snapshot)) fail('review_stale')
      const schedule = belgradeSchedule(args.scheduledLocal,args.utcOffset,now())
      await validateSchedule(actor,schedule)
      const reviewed = {snapshot:job.snapshot,schedule,replaceJobId:job.id,expectedVersion:job.version}
      return {...await store.review(actor.ownerId,{...reviewed,digest:hash(reviewed),expiresAt:new Date(now()+15*60000).toISOString()}),status:'review',requiresExplicitConfirmation:true}
    },
    // Called only by the authenticated existing CRM send route. Its submitted content
    // is the human-approved draft; no caller can provide internal claim/job credentials.
    async sendLegacy(actor,args) {
      await gate(actor,'send')
      fields(args,['to','subject','body','leadId','fromIdentity','inReplyTo','references','persistMessage','attachments'],['to','subject','body','leadId'])
      if (args.inReplyTo && (typeof args.inReplyTo !== 'string' || /[\r\n]/.test(args.inReplyTo))) fail('invalid_reply')
      if (args.references && (typeof args.references !== 'string' || /[\r\n]/.test(args.references))) fail('invalid_reply')
      const key = 'legacy:'+hash({...args,persistMessage:undefined,to:email(args.to),subject:String(args.subject).trim(),body:String(args.body).trim(),fromIdentity:args.fromIdentity || 'contact'})
      const previous = await store.replay(actor.ownerId,key)
      if (previous) return previous
      let content
      try {content = await snapshot(actor,{...args,fromIdentity:args.fromIdentity || 'contact'},args)}
      catch(error) {const raced=await store.replay(actor.ownerId,key);if(raced)return raced;throw error}
      if (content.subject !== String(args.subject).trim() || content.body !== String(args.body).trim()) fail('review_stale')
      const reviewed = {snapshot:content,schedule:null}
      const review = await store.review(actor.ownerId,{...reviewed,digest:hash(reviewed),expiresAt:new Date(now()+15*60000).toISOString()})
      let job
      try { job = await store.enqueue(actor.ownerId,review,key,now(),actor) }
      catch (error) {
        if (error.code !== 'idempotency_conflict') throw error
        return store.replay(actor.ownerId,key)
      }
      return deliver(actor,job.id)
    },
    async runDue(actor) {
      await gate(actor, actor.kind === 'worker' ? 'worker' : 'send')
      const jobs = await store.due(actor.ownerId, now())
      const results = []
      for (const job of jobs) {
        try { results.push(await deliver(actor, job.id)) }
        catch (error) { results.push({id: job.id, error: error instanceof EmailWorkflowError ? error.code : 'email_store_unavailable'}) }
      }
      return results
    },
  }
  api.contacts = async (actor, args = {}) => {
    await gate(actor, 'review')
    const query = normalizeContactFind(args)
    if (typeof store.findContacts !== 'function') fail('reply_thread_unavailable')
    const loaded = await store.findContacts(actor.ownerId, query)
    const nowAt = now()
    const presented = presentAccountMatches(loaded?.leads || [], query.identity)
    const cards = presented.rows.map(item => shapeContactCard({ ...item.row, account_identity: item.identity, owner_id: item.ownerId }, nowAt))
    if (presented.ambiguous) return { alreadyExists: true, matches: cards, choiceRequired: true, question: 'Which account should be used?', accounts: presented.accounts, emailAction: 'none', truncated: loaded?.truncated === true }
    return { alreadyExists: cards.length > 0, matches: cards, choiceRequired: cards.length !== 1, accounts: presented.accounts, emailAction: 'none', truncated: loaded?.truncated === true }
  }
  api.contactsForDispatch = async (actor, args = {}) => {
    await gate(actor, 'review')
    const query = normalizeContactFind(args)
    if (typeof store.findContacts !== 'function') fail('reply_thread_unavailable')
    return store.findContacts(actor.ownerId, query)
  }
  api.approvedSingle = async (actor, item) => {
    await gate(actor, 'send')
    const jobOwner = jobOwnerForIdentity(item.identity || item.fromIdentity)
    if (!jobOwner) fail('identity_required')
    const previous = await store.replay(jobOwner, item.idempotencyKey)
    const approvalFingerprint = messageApprovalFingerprint({
      to: item.to, subject: item.subject, body: item.body, identity: item.identity || 'projects',
      inReplyTo: item.inReplyTo || '', files: (item.attachmentPayload || []).map(file => ({ filename: file.filename, contentType: file.contentType, size: file.size, sha256: file.sha256 || null })),
    })
    if (previous?.snapshot?.approvalFingerprint && previous.snapshot.approvalFingerprint !== approvalFingerprint) {
      return { send: false, status: 'approval_changed', reason: 'recipient_or_attachment_changed', retry: false, sent: false }
    }
    const decision = dispatchReplay(previous)
    if (!decision.send) return { ...(previous || {}), ...decision, sent: false }
    const preview = await api.preview(actor, {
      leadId: item.leadId, to: item.to, fromIdentity: item.identity === 'visual' ? 'visual' : 'projects', kind: item.kind === 'initial' ? undefined : 'followup',
      ...(item.kind === 'initial' ? {} : { messageIntentId: item.messageIntentId, subject: item.subject, body: item.body }),
      ...(item.inReplyTo ? { inReplyTo: item.inReplyTo } : {}),
      ...(item.attachmentPayload?.length ? { attachments: item.attachmentPayload } : {}),
      approvalFingerprint,
    })
    return api.confirm(actor, { reviewId: preview.id, digest: preview.digest, idempotencyKey: item.idempotencyKey, confirmed: true })
  }
  return api
}
