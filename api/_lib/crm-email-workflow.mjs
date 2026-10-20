import { createHash } from 'node:crypto'
import { renderOutreachEmailHtml, renderOutreachPlainText } from './outreach-email-html.js'
import { normalizeMessageId, buildReferencesHeader } from './crm-lead-messages.js'
import { parseOutreachAttachments } from './email-attachments.js'

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
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const email = value => {
  if (typeof value !== 'string' || !/^[^\s@<>,;\r\n]+@[^\s@<>,;\r\n]+\.[^\s@<>,;\r\n]+$/.test(value.trim())) fail('invalid_recipient')
  return value.trim().toLowerCase()
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
    const to = email(args.to)
    const recipients = [lead.email, ...(Array.isArray(lead.emails) ? lead.emails.map(e => e.email) : [])]
      .filter(v => typeof v === 'string').map(v => v.trim().toLowerCase())
    if (!recipients.includes(to)) fail('recipient_not_on_lead')
    const identity = (await identities()).find(i => i.id === args.fromIdentity && i.configured)
    if (!identity) fail('sender_not_configured')
    const from = email(identity.email)
    if (!identity.fromHeader || /[\r\n]/.test(identity.fromHeader)) fail('invalid_sender')
    const subject = String(kind !== 'initial' ? (legacyInput || args).subject : lead.initial_email_subject || '').trim()
    const body = String(kind !== 'initial' ? (legacyInput || args).body : lead.initial_email_body || '').trim()
    if (!subject || subject.length > 300 || /[\r\n]/.test(subject) || !body || body.length > 50000) fail('invalid_draft')
    const staffHeaders = staffReviewMode && actor.kind === 'staff' && !legacyInput
    if (staffHeaders && [args.inReplyTo,args.references].some(v=>v !== undefined && (typeof v !== 'string' || /[\r\n]/.test(v)))) fail('invalid_reply')
    const parent = staffHeaders && args.inReplyTo ? normalizeMessageId(args.inReplyTo) : ''
    if (staffHeaders && args.inReplyTo && !parent) fail('invalid_reply')
    if (staffHeaders && args.references && !parent) fail('invalid_reply')
    const messageIdPattern=/^<[^<>\s@]+@[^<>\s@]+>$/
    if(parent && (!messageIdPattern.test(parent) || String(args.references||'').split(/\s+/).filter(Boolean).some(v=>!messageIdPattern.test(v))))fail('invalid_reply')
    if(parent && !await store.replyParent(actor.ownerId,lead.id,parent))fail('reply_parent_not_on_lead')
    // Replies use a stable followup intent, preserving the DB delivery-key contract.
    if (parent && kind !== 'followup') fail('invalid_message_kind')
    const attachments = staffHeaders && args.attachments !== undefined
      ? parseOutreachAttachments(args.attachments).map(a=>({filename:a.filename,contentType:a.contentType,content:a.content.toString('base64')}))
      : (legacyInput || args).attachments
    return {
      leadId: lead.id, to, from, fromHeader: identity.fromHeader, fromIdentity: identity.id,
      subject, body, text: renderOutreachPlainText(body), html: renderOutreachEmailHtml({subject, body}),
      template: 'crm-outreach-v1', kind,
      ...(kind === 'followup' ? {messageIntentId:args.messageIntentId.toLowerCase()} : {}),
      ...(kind === 'reply' ? {inReplyTo:(legacyInput || args).inReplyTo,references:(legacyInput || args).references || ''} : {}),
      ...(parent ? {inReplyTo:parent,references:buildReferencesHeader(args.references || '',parent)} : {}),
      ...(attachments?.length ? {attachments} : {}),
      ...(lead.scheduled_send ? {legacySchedule:lead.scheduled_send} : {}),
    }
  }
  async function deliver(actor, id) {
    let job = await store.get(actor.ownerId, id)
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
      return store.block(actor.ownerId, id, error.code, job.version)
    }
    job = await store.claim(actor.ownerId, id, now(), job.version)
    if (!job) return store.get(actor.ownerId, id)
    // The sending claim commits BEFORE SMTP. Never reclaim, even after a crash.
    let result
    try {
      result = await send(job.snapshot, { ownerId: actor.ownerId, jobId: job.id })
      if (result?.ok !== true) throw new Error('provider_acceptance_unconfirmed')
    }
    catch {
      try { return await store.finish(actor.ownerId, id, 'unknown', { error: 'delivery_outcome_unknown_do_not_retry' }) }
      catch { return {...job,status:'unknown',error:'delivery_outcome_unknown_do_not_retry'} }
    }
    try {
      return await store.finish(actor.ownerId, id, 'sent', {
        messageId: result?.messageId || null,
        simulated: result?.simulated === true,
      })
    } catch {
      // SMTP accepted; a lost DB acknowledgement must never become a retriable send failure.
      return { ...job, status: 'unknown', error: 'delivery_accepted_receipt_unconfirmed_do_not_retry' }
    }
  }
  return {
    async preview(actor, args) {
      await gate(actor, 'review')
      fields(args, ['leadId','to','fromIdentity','scheduledLocal','utcOffset','replaceLegacySchedule','kind','messageIntentId','subject','body',
        ...(staffReviewMode && actor.kind==='staff'?['inReplyTo','references','attachments']:[])], ['leadId','to','fromIdentity'])
      if (args.kind !== undefined && !['initial','followup'].includes(args.kind)) fail('invalid_message_kind')
      if (args.kind === 'followup') {
        if (typeof args.subject !== 'string' || typeof args.body !== 'string') fail('invalid_draft')
      } else if (['messageIntentId','subject','body'].some(k=>args[k]!==undefined)) fail('invalid_arguments')
      if (args.replaceLegacySchedule !== undefined && typeof args.replaceLegacySchedule !== 'boolean') fail('invalid_arguments')
      if (args.utcOffset !== undefined && args.scheduledLocal === undefined) fail('offset_requires_schedule')
      const content = await snapshot(actor, args)
      const schedule = args.scheduledLocal === undefined ? null : belgradeSchedule(args.scheduledLocal, args.utcOffset, now())
      await validateSchedule(actor,schedule)
      const reviewed = { snapshot: content, schedule,
        ...(staffReviewMode && actor.kind==='staff'?{principal:{kind:'staff',ownerId:actor.ownerId,accessRevision:actor.accessRevision}}:{}) }
      const digest = hash(reviewed)
      const review = await store.review(actor.ownerId, { ...reviewed, digest, expiresAt: new Date(now() + 15 * 60000).toISOString() })
      return { ...review, requiresExplicitConfirmation: true, status: 'review', note: 'Confirm the exact recipient, sender, subject, rendered content and schedule.' }
    },
    async confirm(actor, args) {
      fields(args, ['reviewId','digest','idempotencyKey','confirmed'])
      if (!UUID.test(args.reviewId || '') || !/^[a-f0-9]{64}$/.test(args.digest || '') || !/^[A-Za-z0-9_.:-]{8,120}$/.test(args.idempotencyKey || '') || args.confirmed !== true) fail('invalid_confirmation')
      await gate(actor, 'review')
      const review = await store.getReview(actor.ownerId, args.reviewId)
      if (!review || review.digest !== args.digest) fail('review_not_found_or_mismatch')
      if ((staffReviewMode && actor.kind==='staff' && (!review.principal || review.principal.kind!=='staff' ||
        review.principal.ownerId!==actor.ownerId || review.principal.accessRevision!==actor.accessRevision)) ||
        (actor.kind!=='staff' && review.principal?.kind==='staff')) fail('review_principal_mismatch')
      if (review.principal && hash({snapshot:review.snapshot,schedule:review.schedule,principal:review.principal})!==review.digest) fail('review_not_found_or_mismatch')
      await gate(actor, review.schedule ? 'schedule' : 'send')
      const existing = await store.replay(actor.ownerId, args.idempotencyKey)
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
        const raced=await store.replay(actor.ownerId,args.idempotencyKey)
        if(raced && (raced.commandReviewId || raced.reviewId)===review.id) return raced
        throw error
      }
      const job = review.replaceJobId
        ? await store.reschedule(actor.ownerId,review,args.idempotencyKey,now(),actor)
        : await store.enqueue(actor.ownerId, review, args.idempotencyKey, now(),actor)
      return review.schedule ? job : deliver(actor, job.id)
    },
    async list(actor, args = {}) {
      fields(args, [], [])
      await gate(actor, 'review')
      return store.list(actor.ownerId)
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
}
