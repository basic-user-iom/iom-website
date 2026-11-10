import { fail, emailDigest, emailContentDigest, replyRecipientDecision } from './crm-email-workflow.mjs'
import { attachmentMeta, parseOutreachAttachments } from './email-attachments.js'
import { storedAttachmentRecord } from './crm-needs-review-attachments.mjs'
import { normalizeMessageId, buildReferencesHeader } from './crm-lead-messages.js'
import { assertApprovedContact, CRM_ACCOUNTS, extraAddressChange, jobOwnerForIdentity } from './crm-contact-approval.mjs'

export function sendFromCrmAllowed(row, snapshot) {
  const tags = Array.isArray(row?.tags) ? row.tags.map(tag => String(tag).trim().toLowerCase()) : []
  const underRevision = tags.includes('needs-review')
  const notContacted = !row?.initial_email_sent_at
  const thread = snapshot?.kind === 'reply' || snapshot?.kind === 'followup'
  return underRevision || notContacted || thread
}

const mapJob = row => row && ({id:row.id,ownerId:row.owner_id,reviewId:row.review_id,version:row.version,
  ...row.data,status:row.status,...(row.result || {}),
  ...(row.status==='sending' ? {warning:'delivery_in_progress_or_unknown_do_not_retry'} : {}),
})
function singleMessage(snapshot){
  // One recipient stays on the single-send path, including its files.
  // The campaign worker is a separate batch and does not upload those files.
  if(snapshot?.kind==='initial') return snapshot?.messageIntentId===undefined && !snapshot?.inReplyTo
  // One confirmed thread reply stays a single message. Group STARTS remains separate.
  return snapshot?.kind==='followup' && snapshot?.messageIntentId!==undefined
}
export function capabilityMutationRequiresStarts(review,actor,replace) {
  // A scheduled single message is gated by the schedule switch, not by group STARTS.
  if(replace===true || actor?.kind!=='oauth') return true
  if(review?.schedule!=null) return false
  return !singleMessage(review?.snapshot)
}
export function capabilityJobRequiresStarts(data) {
  return capabilityMutationRequiresStarts({snapshot:data?.snapshot,schedule:data?.schedule},data?.authorization,false)
}
// Immediate single reservations are already due for the reservation guard.
// Scheduled single work stays at positive infinity and fails that finite-time check.
export function capabilityReservationDue(review,single,now) {
  if(review?.schedule==null && single) return null
  return single ? 'infinity' : (review?.schedule?.at || new Date(now).toISOString())
}
export function createEmailStore(acquire,{staffPair=false,staffSender='',requireContactApproval=false,capabilityBinding=null,capabilityStartsEnabled=()=>false,capabilityScheduleEnabled=()=>false}={}) {
  const assertCapabilityStarts=()=>{if(capabilityBinding && capabilityStartsEnabled()!==true)fail('capability_starts_paused')}
  const guardStarts=(review,actor,replace)=>{if(capabilityMutationRequiresStarts(review,actor,replace))assertCapabilityStarts()}
  const guardSchedule=review=>{if(review?.schedule!=null && capabilityScheduleEnabled()!==true)fail('needs_review_schedule_paused')}
  async function transaction(owner,work) {
    const projectsOwner = CRM_ACCOUNTS.projects.ownerId
    const registeredJobOwner = owner === projectsOwner || owner === CRM_ACCOUNTS.visual.ownerId
    const bindingCanUseOwner = registeredJobOwner && capabilityBinding && (
      capabilityBinding.ownerId === owner ||
      (capabilityBinding.ownerId === projectsOwner && owner === CRM_ACCOUNTS.visual.ownerId)
    )
    if(capabilityBinding && (requireContactApproval!==true || !bindingCanUseOwner ||
      !['projects','visual'].includes(capabilityBinding.fromIdentity) || !/^[a-f0-9-]{36}$/i.test(capabilityBinding.grantFamily||'') ||
      typeof capabilityBinding.accessRevision!=='string' || !capabilityBinding.accessRevision)) fail('email_capability_binding_invalid')
    const c = await acquire()
    try {
      await c.query('begin')
      // Transaction-local server mode. Never accept this context from request JSON.
      // These independent settings all complete before work; none depends on SELECT evaluation order.
      await c.query("select set_config('iom.email_owner',$1,true),set_config('iom.email_staff_pair',$2,true),set_config('iom.email_staff_sender',$3,true),set_config('iom.email_receipt_job',$4,true),set_config('lock_timeout',$5,true),set_config('statement_timeout',$6,true)",[owner,staffPair?'v1':'',staffSender,'','5s','10s'])
      if(capabilityBinding) await c.query("select set_config('iom.capability_sender',$1,true),set_config('iom.capability_grant',$2,true),set_config('iom.capability_revision',$3,true)",
        [capabilityBinding.fromIdentity,capabilityBinding.grantFamily,capabilityBinding.accessRevision])
      const result=await work(c)
      await c.query('commit')
      return result
    } catch (e) { await c.query('rollback').catch(()=>{}); throw e }
    finally { c.release() }
  }
  const query = (owner,sql,values=[]) => transaction(owner,c=>c.query(sql,values))
  const visualOwner = CRM_ACCOUNTS.visual.ownerId
  async function seeVisual(c, actorOwner, targetOwner) {
    if (targetOwner === actorOwner) return
    const projectsOwner = CRM_ACCOUNTS.projects.ownerId
    const paired = (actorOwner === projectsOwner && targetOwner === visualOwner) || (actorOwner === visualOwner && targetOwner === projectsOwner)
    if (!paired) fail('identity_required')
    await c.query("select set_config('iom.email_staff_pair','v1',true), set_config('iom.email_staff_sender','visual',true)")
  }
  async function hideVisual(c, actorOwner, targetOwner) {
    if (targetOwner === actorOwner) return
    await c.query("select set_config('iom.email_staff_pair','',true), set_config('iom.email_staff_sender','',true)")
  }
  const lead = async (c,owner,id,lock=false,targetOwner=owner) => {
    await seeVisual(c, owner, targetOwner)
    try {
      return (await c.query(`select l.id,l.owner_id,l.email,l.emails,l.initial_email_subject,l.initial_email_body,
    l.initial_email_sent_at,l.initial_email_drafted_at,l.scheduled_send,l.status,l.contact_priority,l.updated_at,
    exists(select 1 from public.crm_lead_messages m where m.lead_id=l.id and m.direction='outbound') as has_outbound
    ${staffPair?",crm_email_private.staff_pair_scope(l.owner_id) as staff_scope":""}
    ${requireContactApproval?",l.tags,l.company_name,l.contact_name":""}
    from public.crm_leads l where ${staffPair?"($1::uuid IS NOT NULL AND crm_email_private.staff_pair_lead_allowed(l.id,l.owner_id))":"l.owner_id=$1"} and l.id=$2 ${lock?'for update of l':''}`,[staffPair?owner:targetOwner,id])).rows[0]
    } finally { await hideVisual(c, owner, targetOwner) }
  }
  async function readInbound(c, actorOwner, leadId, messageId, leadOwner) {
    if (!messageId) return null
    await seeVisual(c, actorOwner, leadOwner)
    try {
      const row = (await c.query(`/* nr:reply-inbound */ select m.lead_id, m.direction, m.from_email, m.message_id
        from public.crm_lead_messages m
        join public.crm_leads l on l.id=m.lead_id
        where ${staffPair?"($1::uuid IS NOT NULL AND crm_email_private.staff_pair_lead_allowed(l.id,l.owner_id))":"l.owner_id=$1"}
          and l.id=$2 and lower(m.message_id)=lower($3) and m.direction='inbound'
        limit 1`, [staffPair ? actorOwner : leadOwner, leadId, messageId])).rows[0]
      if (!row) return null
      return { leadId: row.lead_id, direction: row.direction, from: String(row.from_email || '').trim().toLowerCase(), messageId: row.message_id }
    } finally { await hideVisual(c, actorOwner, leadOwner) }
  }
  function validateLead(row,snapshot,inbound=null) {
    if (!row) fail('lead_not_found')
    if(requireContactApproval && !sendFromCrmAllowed(row,snapshot)) assertApprovedContact({ownerId:row.owner_id,leadId:snapshot.leadId,to:snapshot.to},row)
    if (snapshot.kind==='initial') {
      if (row.initial_email_sent_at || row.has_outbound) fail('initial_email_already_sent')
      if (String(row.initial_email_subject || '').trim()!==snapshot.subject || String(row.initial_email_body || '').trim()!==snapshot.body) fail('review_stale')
    }
    const decision = replyRecipientDecision({ to: snapshot.to, lead: row, inbound, threadReply: Boolean(snapshot.inReplyTo) })
    if (!decision.ok) fail(decision.code)
    if (row.scheduled_send && emailDigest(row.scheduled_send)!==emailDigest(snapshot.legacySchedule)) fail('legacy_schedule_requires_review')
  }
  const get = async(owner,id)=>mapJob((await query(owner,'select * from crm_email_private.jobs where owner_id=$1 and id=$2',[owner,id])).rows[0])
  async function replay(owner,key) {
    const row=(await query(owner,`select j.*,c.review_id as command_review_id from crm_email_private.commands c
      join crm_email_private.jobs j on j.id=c.job_id where c.owner_id=$1 and c.idempotency_key=$2`,[owner,key])).rows[0]
    return row && {...mapJob(row),commandReviewId:row.command_review_id}
  }
  async function mutate(owner,review,key,now,actor,replace) {
    const expectedOwner = jobOwnerForIdentity(review?.snapshot?.fromIdentity)
    const chosenName = review?.snapshot?.fromIdentity || 'none'
    if (!expectedOwner || owner !== expectedOwner) fail(`sender_not_authorized:chosen=${chosenName}:required_owner=${expectedOwner || 'none'}`)
    guardSchedule(review)
    guardStarts(review,actor,replace)
    const single=!capabilityMutationRequiresStarts(review,actor,replace)
    try { return await transaction(owner,async c=>{
      const leadOwner = review.snapshot.leadOwnerId || owner
      const row=await lead(c,owner,review.snapshot.leadId,true,leadOwner)
      const inbound=review.snapshot.inReplyTo ? await readInbound(c, owner, review.snapshot.leadId, review.snapshot.inReplyTo, leadOwner) : null
      const prior=(await c.query('select review_id,job_id from crm_email_private.commands where owner_id=$1 and idempotency_key=$2',[owner,key])).rows[0]
      if (prior) {
        if (prior.review_id!==review.id) fail('idempotency_conflict')
        return mapJob((await c.query('select * from crm_email_private.jobs where id=$1',[prior.job_id])).rows[0])
      }
      validateLead(row,review.snapshot,inbound)
      await validateIntent(c,owner,review.snapshot)
      if (Date.parse(review.expiresAt)<=now) fail('review_expired')
      const data={snapshot:review.snapshot,schedule:review.schedule,authorization:{kind:actor?.kind || 'staff',grantFamily:actor?.grantFamily,scopes:actor?.scopes,
        ...(actor?.kind==='staff'?{aal:actor.aal}:{}),...(actor?.accessRevision?{accessRevision:actor.accessRevision}:{})}}
      const due=capabilityReservationDue(review,single,now)
      let job
      if (replace) {
        job=(await c.query(`update crm_email_private.jobs set review_id=$3,data=$4::jsonb,due_at=coalesce($5::timestamptz,statement_timestamp()),version=version+1,updated_at=now()
          where owner_id=$1 and id=$2 and status='queued' and version=$6 returning *`,
        [owner,review.replaceJobId,review.id,JSON.stringify(data),due,review.expectedVersion])).rows[0]
        if (!job) fail('schedule_changed_or_delivery_started')
      } else {
        job=(await c.query(`insert into crm_email_private.jobs(owner_id,lead_id,review_id,status,due_at,data,delivery_key)
          values($1,$2,$3,'queued',coalesce($4::timestamptz,statement_timestamp()),$5::jsonb,$6) returning *`,[owner,review.snapshot.leadId,review.id,due,JSON.stringify(data),
          review.snapshot.kind==='initial' ? `initial:${review.snapshot.leadId}` : review.snapshot.kind==='followup'
            ? `followup:${owner}:${review.snapshot.messageIntentId}` : `reply:${review.snapshot.leadId}:${emailContentDigest(review.snapshot)}`])).rows[0]
      }
      await c.query('insert into crm_email_private.commands(owner_id,idempotency_key,review_id,job_id) values($1,$2,$3,$4)',[owner,key,review.id,job.id])
      if (row.scheduled_send) await c.query('update public.crm_leads set scheduled_send=null where owner_id=$1 and id=$2',[row.owner_id,row.id])
      return mapJob(job)
    }) } catch(e) {
      if (e.code!=='23505') throw e
      const old=await replay(owner,key)
      if (old?.commandReviewId===review.id) return old
      fail(old?'idempotency_conflict':'email_already_reserved')
    }
  }
  async function validateIntent(c,owner,snapshot) {
    if(snapshot.kind!=='followup')return
    const r=(await c.query('select snapshot from crm_email_private.message_intents where owner_id=$1 and id=$2',[owner,snapshot.messageIntentId])).rows[0]
    if(!r || emailContentDigest(r.snapshot)!==emailContentDigest(snapshot))fail('message_intent_content_mismatch')
  }
  async function planStoredAddresses(c, owner, leadId, emails, identity) {
    const projectsOwner = CRM_ACCOUNTS.projects.ownerId
    const wanted = identity === 'visual' ? visualOwner : identity === 'projects' ? projectsOwner : null
    let row = await lead(c, owner, leadId, false, wanted || owner)
    if (!row && !wanted && owner === projectsOwner) row = await lead(c, owner, leadId, false, visualOwner)
    if (!row) fail('lead_not_found')
    if (wanted && row.owner_id !== wanted) fail('address_account_mismatch')
    const matches = []
    const prepared = extraAddressChange({ lead: row, emails, matches: [] })
    if (!prepared.ok) fail(prepared.code)
    const list = prepared.emails.map(item => item.email)
    for (const target of [projectsOwner, visualOwner]) {
      await seeVisual(c, owner, target)
      try {
        const found = list.length ? await c.query(`/* nr:address-duplicates */ select id, owner_id from public.crm_leads l
          where l.owner_id=$1 and l.id<>$2 and (
            lower(btrim(l.email)) = any($3::text[])
            or exists (
              select 1 from jsonb_array_elements(case when jsonb_typeof(l.emails)='array' then l.emails else '[]'::jsonb end) extra
              where lower(btrim(coalesce(extra->>'email',''))) = any($3::text[])
            )
          )`, [target, row.id, list]) : { rows: [] }
        matches.push(...found.rows)
      } finally { await hideVisual(c, owner, target) }
    }
    const plan = extraAddressChange({ lead: row, emails, matches })
    if (!plan.ok) fail(plan.code)
    return { ...plan, leadId: row.id, ownerId: row.owner_id, identity: row.owner_id === visualOwner ? 'visual' : 'projects' }
  }
  return {
    contactApprovalRequired:requireContactApproval===true,
    forStaffPair:sender=>createEmailStore(acquire,{staffPair:true,staffSender:sender||'',requireContactApproval,capabilityBinding,capabilityStartsEnabled,capabilityScheduleEnabled}),
    async threadMessages(owner, window = {}) {
      // Fixed page. Dates, search text, and the older-page cursor are parameters, so the limit cannot grow.
      // Row visibility stays with the existing gateway policies; this statement does not change them.
      // Newest first. The stable key is occurred_at, then id.
      const from = window?.from ?? null
      const to = window?.to ?? null
      const beforeAt = window?.beforeOccurredAt ?? null
      const beforeId = window?.beforeId ?? null
      const company = window?.company ?? null
      const contact = window?.contact ?? null
      const email = window?.email ?? null
      const subject = window?.subject ?? null
      const identity = window?.identity ?? null
      if (identity !== null && identity !== 'projects' && identity !== 'visual') fail('identity_required')
      const targets = identity === 'visual' ? [visualOwner] : identity === 'projects' || owner !== CRM_ACCOUNTS.projects.ownerId ? [owner] : [owner, visualOwner]
      const rows=[]
      await transaction(owner, async c => {
        for (const target of targets) {
          await seeVisual(c, owner, target)
          try {
            const found=await c.query(`select m.id,m.lead_id,m.direction,m.from_email,m.subject,m.body_text,m.message_id,m.occurred_at,
        l.company_name,l.contact_name,l.owner_id,(m.raw_headers->>'autoReply')='true' as auto_reply,
        exists(select 1 from public.crm_lead_messages later
          where later.lead_id=m.lead_id and later.direction='outbound' and later.occurred_at>m.occurred_at) as later_outbound
        from public.crm_lead_messages m
        join public.crm_leads l on l.id=m.lead_id
        where ${staffPair?"($1::uuid IS NOT NULL AND crm_email_private.staff_pair_lead_allowed(l.id,l.owner_id))":"l.owner_id=$1"}
          and ($2::timestamptz is null or m.occurred_at>=$2::timestamptz)
          and ($3::timestamptz is null or m.occurred_at<$3::timestamptz)
          and ($4::timestamptz is null or m.occurred_at<$4::timestamptz or (m.occurred_at=$4::timestamptz and m.id<$5::uuid))
          and ($6::text is null or l.company_name ilike $6 escape '\\')
          and ($7::text is null or l.contact_name ilike $7 escape '\\')
          and ($8::text is null or m.from_email ilike $8 escape '\\' or l.email ilike $8 escape '\\' or exists (
            select 1 from jsonb_array_elements(case when jsonb_typeof(l.emails)='array' then l.emails else '[]'::jsonb end) extra
            where coalesce(extra->>'email','') ilike $8 escape '\\'))
          and ($9::text is null or m.subject ilike $9 escape '\\')
        order by m.occurred_at desc,m.id desc
        limit 401`,[target,from,to,beforeAt,beforeId,company,contact,email,subject])
            for (const row of found.rows) rows.push({...row, account_identity: target === visualOwner ? 'visual' : 'projects'})
          } finally { await hideVisual(c, owner, target) }
        }
      })
      const at=value=>value instanceof Date?value.getTime():Date.parse(value)
      rows.sort((left,right)=>at(right.occurred_at)-at(left.occurred_at)||String(right.id).localeCompare(String(left.id)))
      const result={rows}
      const page=result.rows.slice(0,400)
      const stamp=value=>value instanceof Date?value.toISOString():value
      const last=page[page.length-1]
      const messages=page.map(row=>({
        leadId:row.lead_id,
        direction:row.direction==='inbound'||row.direction==='outbound'?row.direction:'unknown',
        from:row.from_email,subject:row.subject,content:row.body_text,messageId:row.message_id,
        occurredAt:stamp(row.occurred_at),
        person:row.contact_name,company:row.company_name,identity:row.account_identity,ownerId:row.owner_id,autoReply:row.auto_reply===true,
        laterOutbound:row.later_outbound===true,
      }))
      const next=result.rows.length>400 && last?.id && stamp(last.occurred_at)
        ?{beforeOccurredAt:stamp(last.occurred_at),beforeId:String(last.id)}:undefined
      return {truncated:result.rows.length>400,messages,...(next?{next}:{})}
    },
    async findContacts(owner, search = {}) {
      const leadIds = Array.isArray(search.leadIds) && search.leadIds.length ? search.leadIds : null
      const company = search.company ?? null
      const contact = search.contact ?? null
      const email = search.email ?? null
      const identity = search.identity ?? null
      if (identity !== null && identity !== 'projects' && identity !== 'visual') fail('identity_required')
      const targets = identity === 'visual' ? [visualOwner] : identity === 'projects' || owner !== CRM_ACCOUNTS.projects.ownerId ? [owner] : [owner, visualOwner]
      const leads = []
      await transaction(owner, async c => {
        for (const target of targets) {
          await seeVisual(c, owner, target)
          try {
            const rows = (await c.query(`select l.id,l.owner_id,l.company_name,l.contact_name,l.email,l.emails,l.status,l.tags,l.client_timezone,
        l.initial_email_subject,l.initial_email_body,l.initial_email_drafted_at,l.initial_email_sent_at,
        l.contact_priority,l.scheduled_send,l.last_client_reply_at,l.updated_at,
        exists(select 1 from public.crm_lead_messages m where m.lead_id=l.id and m.direction='outbound') as has_outbound
        from public.crm_leads l
        where ${staffPair?"($1::uuid IS NOT NULL AND crm_email_private.staff_pair_lead_allowed(l.id,l.owner_id))":"l.owner_id=$1"}
          and ($2::uuid[] is null or l.id = any($2::uuid[]))
          and ($3::text is null or l.company_name ilike $3 escape '\\')
          and ($4::text is null or l.contact_name ilike $4 escape '\\')
          and ($5::text is null or l.email ilike $5 escape '\\' or exists (
            select 1 from jsonb_array_elements(case when jsonb_typeof(l.emails)='array' then l.emails else '[]'::jsonb end) extra
            where coalesce(extra->>'email','') ilike $5 escape '\\'))
        order by l.company_name asc,l.contact_name asc,l.id asc
        limit 21`,[target,leadIds,company,contact,email])).rows
            for (const row of rows) leads.push({ ...row, account_identity: target === visualOwner ? 'visual' : 'projects' })
          } finally { await hideVisual(c, owner, target) }
        }
      })
      return {leads:leads.slice(0,40),alreadyExists:leads.length>0,truncated:leads.length>40}
    },
    async correspondence(owner, search = {}) {
      // Read-only. Chronological pages use occurred_at then id ascending, so a newer
      // message arrives on a later page and is not repeated.
      const leadId = search?.leadId ?? null
      const company = search?.company ?? null
      const contact = search?.contact ?? null
      const email = search?.email ?? null
      const identity = search?.identity ?? null
      if (identity !== null && identity !== 'projects' && identity !== 'visual') fail('identity_required')
      const targets = identity === 'visual' ? [visualOwner] : identity === 'projects' || owner !== CRM_ACCOUNTS.projects.ownerId ? [owner] : [owner, visualOwner]
      const leads = []
      await transaction(owner, async c => {
        for (const target of targets) {
          await seeVisual(c, owner, target)
          try {
            const rows = (await c.query(`select l.id,l.owner_id,l.company_name,l.contact_name,l.email,l.emails,l.status,l.tags,l.client_timezone,
        l.initial_email_subject,l.initial_email_body,l.initial_email_drafted_at,l.initial_email_sent_at,
        l.contact_priority,l.scheduled_send,l.last_client_reply_at,l.updated_at
        from public.crm_leads l
        where ${staffPair?"($1::uuid IS NOT NULL AND crm_email_private.staff_pair_lead_allowed(l.id,l.owner_id))":"l.owner_id=$1"}
          and ($2::uuid is null or l.id=$2::uuid)
          and ($3::text is null or l.company_name ilike $3 escape '\\')
          and ($4::text is null or l.contact_name ilike $4 escape '\\')
          and ($5::text is null or l.email ilike $5 escape '\\' or exists (
            select 1 from jsonb_array_elements(case when jsonb_typeof(l.emails)='array' then l.emails else '[]'::jsonb end) extra
            where coalesce(extra->>'email','') ilike $5 escape '\\'))
        order by l.company_name asc,l.contact_name asc,l.id asc
        limit 21`,[target,leadId,company,contact,email])).rows
            for (const row of rows) leads.push({ ...row, account_identity: target === visualOwner ? 'visual' : 'projects' })
          } finally { await hideVisual(c, owner, target) }
        }
      })
      const choiceRequired = !leadId && leads.length !== 1
      const chosen = choiceRequired ? null : leads[0]
      if (!chosen) return { leads: leads.slice(0, 20), choiceRequired: true, truncated: leads.length > 20, messages: [] }
      const afterAt = search?.afterOccurredAt ?? null
      const afterId = search?.afterId ?? null
      const messageOwner = chosen.owner_id || owner
      const result=await transaction(owner, async c => {
        await seeVisual(c, owner, messageOwner)
        try { return await c.query(`select m.id,m.lead_id,m.direction,m.from_email,m.subject,m.body_text,m.message_id,m.occurred_at,
        (m.raw_headers->>'autoReply')='true' as auto_reply,
        m.raw_headers->'attachments' as attachments,
        m.raw_headers->>'to' as to_header,
        exists(select 1 from public.crm_lead_messages later
          where later.lead_id=m.lead_id and later.direction='outbound' and later.occurred_at>m.occurred_at) as later_outbound
        from public.crm_lead_messages m
        join public.crm_leads l on l.id=m.lead_id
        where ${staffPair?"($1::uuid IS NOT NULL AND crm_email_private.staff_pair_lead_allowed(l.id,l.owner_id))":"l.owner_id=$1"}
          and m.lead_id=$2::uuid
          and ($3::timestamptz is null or m.occurred_at>$3::timestamptz or (m.occurred_at=$3::timestamptz and m.id>$4::uuid))
        order by m.occurred_at asc,m.id asc
        limit 401`,[messageOwner,chosen.id,afterAt,afterId]) }
        finally { await hideVisual(c, owner, messageOwner) }
      })
      const stamp=value=>value instanceof Date?value.toISOString():value
      const page=result.rows.slice(0,400)
      const last=page[page.length-1]
      const messages=page.map(row=>({
        id:String(row.id),leadId:String(row.lead_id),
        direction:row.direction==='inbound'||row.direction==='outbound'?row.direction:'unknown',
        from:row.from_email,toHeader:row.to_header,subject:row.subject,content:row.body_text,messageId:row.message_id,
        occurredAt:stamp(row.occurred_at),autoReply:row.auto_reply===true,laterOutbound:row.later_outbound===true,
        attachments:Array.isArray(row.attachments)?row.attachments.map(item=>item&&typeof item==='object'?{filename:item.filename,contentType:item.contentType,size:item.size}:{}):[],
      }))
      const next=result.rows.length>400 && last?.id
        ?{afterOccurredAt:stamp(last.occurred_at),afterId:String(last.id)}:undefined
      return {leads:[chosen],choiceRequired:false,truncated:result.rows.length>400,messages,...(next?{next}:{})}
    },
    async addressPlan(owner, leadId, emails, identity) {
      if (!capabilityBinding) fail('address_change_unavailable')
      return transaction(owner, async c => planStoredAddresses(c, owner, leadId, emails, identity))
    },
    async addressCommit(owner, args) {
      if (!capabilityBinding) fail('address_change_unavailable')
      try { return await transaction(owner, async c => {
        const prior = (await c.query(`/* nr:address-replay */ select result from crm_capability_private.commands
          where owner_id=$1 and idempotency_key=$2 and from_identity=$3 and grant_family=$4 and access_revision=$5 and kind='address'`,
          [capabilityBinding.ownerId, args.idempotencyKey, capabilityBinding.fromIdentity, capabilityBinding.grantFamily, capabilityBinding.accessRevision])).rows[0]
        if (prior?.result) return { ...prior.result, replayed: true, emailAction: 'none', sent: false }
        const plan = await planStoredAddresses(c, owner, args.leadId, args.emails, args.identity)
        const digest = emailDigest({ leadId: plan.leadId, ownerId: plan.ownerId, emails: plan.emails })
        if (digest !== args.digest) fail('address_review_digest_mismatch')
        const saved = (await c.query(`/* nr:address-update */ update public.crm_leads set emails=$1::jsonb where id=$2 and owner_id=$3 returning id, owner_id`,
          [JSON.stringify(plan.emails), plan.leadId, plan.ownerId])).rows[0]
        if (!saved || saved.owner_id !== plan.ownerId) fail('address_not_saved')
        const result = { updated: true, leadId: plan.leadId, ownerId: saved.owner_id, identity: plan.identity, added: plan.added, edited: plan.edited, removed: plan.removed, emailAction: 'none', sent: false, replayed: false }
        await c.query(`/* nr:address-command */ insert into crm_capability_private.commands
          (owner_id,idempotency_key,from_identity,grant_family,access_revision,kind,request_digest,result)
          values($1,$2,$3,$4,$5,'address',$6,$7::jsonb)`,
          [capabilityBinding.ownerId, args.idempotencyKey, capabilityBinding.fromIdentity, capabilityBinding.grantFamily, capabilityBinding.accessRevision, digest, JSON.stringify(result)])
        return result
      }) } catch (error) {
        if (error?.code === '42501') return { updated: false, emailAction: 'none', sent: false, error: '42501', cause: 'emails_column_update_required', column: 'emails' }
        throw error
      }
    },
    async replyInbound(owner,leadId,messageId) {
      const ask = async target => transaction(owner, async c => readInbound(c, owner, leadId, messageId, target))
      const found = await ask(owner)
      if (found) return found
      const other = owner === CRM_ACCOUNTS.projects.ownerId ? visualOwner : owner === visualOwner ? CRM_ACCOUNTS.projects.ownerId : null
      return other ? ask(other) : null
    },
    async replyParent(owner,leadId,messageId) {
      const ask = async target => transaction(owner, async c => {
        await seeVisual(c, owner, target)
        try { return (await c.query(`select 1 from public.crm_lead_messages m
        join public.crm_leads l on l.id=m.lead_id
        where ${staffPair?"($1::uuid IS NOT NULL AND crm_email_private.staff_pair_lead_allowed(l.id,l.owner_id))":"l.owner_id=$1"} and l.id=$2 and lower(m.message_id)=$3 limit 1`,
        [target,leadId,messageId])).rows.length===1 }
        finally { await hideVisual(c, owner, target) }
      })
      if (await ask(owner)) return true
      const other = owner === CRM_ACCOUNTS.projects.ownerId ? visualOwner : owner === visualOwner ? CRM_ACCOUNTS.projects.ownerId : null
      return other ? ask(other) : false
    },
    async staffBinding(pin,revision) {
      return (await query(pin.ownerId,`select 1 from crm_email_private.staff_access
        where owner_id=$1 and revision=$2 and enabled and expires_at>statement_timestamp()
          and from_identity=$3 and from_email=$4 and from_header=$5`,
        [pin.ownerId,revision,pin.fromIdentity,pin.fromEmail,pin.fromHeader])).rows.length===1
    },
    async assertStaffDelivery(owner,id,revision) {
      const r=await query(owner,`select 1 from crm_email_private.jobs j where j.owner_id=$1 and j.id=$2
        and j.status='sending' and not j.delivery_started and j.data->'authorization'->>'accessRevision'=$3
        and crm_email_private.staff_job_authorized(j)`,[owner,id,revision])
      if(r.rows.length!==1)fail('email_delivery_authorization_changed')
    },
    async regularBinding(pin,url) {
      return (await query(pin.ownerId,`select 1 from crm_email_private.regular_access a
        join crm_email_private.target_binding t using(owner_id)
        where a.owner_id=$1 and a.revision=$2 and a.from_identity=$3 and a.from_email=$4
          and a.from_header=$5 and a.enabled and t.supabase_url=$6`,
        [pin.ownerId,pin.accessRevision,pin.fromIdentity,pin.fromEmail,pin.fromHeader,url])).rows.length===1
    },
    async assertRegularDelivery(owner,id,revision) {
      const r=await query(owner,`select 1 from crm_email_private.jobs j where j.owner_id=$1 and j.id=$2
        and j.status='sending' and not j.delivery_started and j.data->'authorization'->>'accessRevision'=$3
        and crm_email_private.regular_job_authorized(j)`,[owner,id,revision])
      if(r.rows.length!==1)fail('email_delivery_authorization_changed')
    },
    async productionBinding(pin,url) {
      if(pin.accessMode==='regular-projects')return this.regularBinding(pin,url)
      return (await query(pin.ownerId,`select 1 from crm_email_private.pilot p
        join crm_email_private.target_binding t on t.owner_id=p.owner_id
        where p.owner_id=$1 and p.lead_id=$2 and p.recipient=$3 and p.from_identity=$4 and p.from_email=$5
        and p.message_kind=$7 and p.message_intent_id is not distinct from $8::uuid
        and p.enabled and t.supabase_url=$6`,[pin.ownerId,pin.leadId,pin.recipient,pin.fromIdentity,pin.fromEmail,url,pin.messageKind||'initial',pin.messageIntentId||null])).rows.length===1
    },
    async assertProductionDelivery(owner,id) {
      const result=await query(owner,`select 1 from crm_email_private.jobs j join crm_email_private.pilot p on p.owner_id=j.owner_id and p.lead_id=j.lead_id
        join public.crm_staff_profiles s on s.id=j.owner_id and s.active
        where j.owner_id=$1 and j.id=$2 and p.enabled and j.status='sending' and not j.delivery_started
        and j.data->'snapshot'->>'to'=p.recipient and j.data->'snapshot'->>'from'=p.from_email
        and j.data->'snapshot'->>'kind'=p.message_kind
        and (p.message_kind='initial' or j.data->'snapshot'->>'messageIntentId'=p.message_intent_id::text)
        and (j.data->'authorization'->>'kind'='staff' or exists(
          select 1 from crm_email_private.grant_families g where g.id::text=j.data->'authorization'->>'grantFamily'
          and g.owner_id=j.owner_id and g.revoked_at is null and g.expires_at>statement_timestamp()
          and g.scopes @> array['iom:crm:email:read',case when j.data->'schedule'='null'::jsonb then 'iom:crm:email:send' else 'iom:crm:email:schedule' end]))`,[owner,id])
      if(result.rows.length!==1)fail('email_delivery_authorization_changed')
    },
    lead:(owner,id)=>transaction(owner,async c=>{
      const own=await lead(c,owner,id)
      if(own || owner!==CRM_ACCOUNTS.projects.ownerId) return own
      return lead(c,owner,id,false,visualOwner)
    }),get,replay,
    async review(owner,data) {
      return transaction(owner,async c=>{
        if(data.snapshot.kind==='followup') {
          await c.query('insert into crm_email_private.message_intents(owner_id,id,snapshot) values($1,$2,$3::jsonb) on conflict(owner_id,id) do nothing',[owner,data.snapshot.messageIntentId,JSON.stringify(data.snapshot)])
          await validateIntent(c,owner,data.snapshot)
        }
        const r=(await c.query('insert into crm_email_private.reviews(owner_id,data) values($1,$2::jsonb) returning id',[owner,JSON.stringify(data)])).rows[0]
        return {id:r.id,...data}
      })
    },
    async getReview(owner,id) {
      const r=(await query(owner,'select id,data from crm_email_private.reviews where owner_id=$1 and id=$2',[owner,id])).rows[0]
      return r && {id:r.id,...r.data}
    },
    enqueue:(owner,r,key,now,actor)=>mutate(owner,r,key,now,actor,false),
    reschedule:(owner,r,key,now,actor)=>mutate(owner,r,key,now,actor,true),
    async claim(owner,id,now,version) {
      return transaction(owner,async c=>{
        const before=(await c.query('select * from crm_email_private.jobs where owner_id=$1 and id=$2',[owner,id])).rows[0]
        if (!before) return undefined
        if(capabilityJobRequiresStarts(before.data))assertCapabilityStarts()
        const leadOwner = before.data?.snapshot?.leadOwnerId || owner
        const row=await lead(c,owner,before.lead_id,true,leadOwner)
        const current=(await c.query('select * from crm_email_private.jobs where owner_id=$1 and id=$2 for update',[owner,id])).rows[0]
        const dueMs=+new Date(current.due_at)
        const waiting=Number.isFinite(dueMs)&&dueMs>now
        if(current.status!=='queued' || current.version!==(version ?? before.version) || waiting) return undefined
        const inbound=current.data?.snapshot?.inReplyTo ? await readInbound(c, owner, current.lead_id, current.data.snapshot.inReplyTo, leadOwner) : null
        validateLead(row,current.data.snapshot,inbound)
        await validateIntent(c,owner,current.data.snapshot)
        return mapJob((await c.query("update crm_email_private.jobs set status='sending',version=version+1,updated_at=now() where id=$1 returning *",[id])).rows[0])
      })
    },
    async beginDelivery(owner,id,snapshot) {
      return transaction(owner,async c=>{
        // Capability mode closes the post-claim approval race. Use lead -> job
        // lock order like claim/finish; never require approval to save a receipt.
        const loaded=(await c.query('select lead_id,data from crm_email_private.jobs where owner_id=$1 and id=$2',[owner,id])).rows[0]
        if(!loaded) fail('delivery_claim_invalid_or_consumed')
        if(capabilityJobRequiresStarts(loaded.data))assertCapabilityStarts()
        let approvedLead
        const leadOwner = loaded.data?.snapshot?.leadOwnerId || owner
        if(requireContactApproval) approvedLead=await lead(c,owner,loaded.lead_id,true,leadOwner)
        const job=(await c.query("select * from crm_email_private.jobs where owner_id=$1 and id=$2 and status='sending' for update",[owner,id])).rows[0]
        if(!job || job.delivery_started || emailContentDigest(job.data.snapshot)!==emailContentDigest(snapshot)) fail('delivery_claim_invalid_or_consumed')
        if(requireContactApproval) {
          const inbound=job.data?.snapshot?.inReplyTo ? await readInbound(c, owner, loaded.lead_id, job.data.snapshot.inReplyTo, leadOwner) : null
          validateLead(approvedLead,job.data.snapshot,inbound)
        }
        await validateIntent(c,owner,snapshot)
        if(capabilityJobRequiresStarts(job.data))assertCapabilityStarts()
        await c.query('update crm_email_private.jobs set delivery_started=true where id=$1',[id])
        return true
      })
    },
    async finish(owner,id,status,result) {
      if(!['sent','unknown'].includes(status)) fail('invalid_status_transition')
      return transaction(owner,async c=>{
        // A revoked grant must not prevent recording an already-started attempt.
        if(staffPair)await c.query("select set_config('iom.email_receipt_job',$1,true)",[id])
        const before=(await c.query(`select lead_id${capabilityBinding?",data->>'batchId' as batch_id":""} from crm_email_private.jobs where owner_id=$1 and id=$2`,[owner,id])).rows[0]
        if(!before) fail('receipt_state_conflict')
        if(capabilityBinding && before.batch_id) {
          const lane=await c.query('select lane_id from crm_capability_private.batch_lane where lane_id=1 for update')
          if(lane.rows.length!==1)fail('receipt_state_conflict')
          // Match lane -> batch -> lead -> job lock order. A receipt after revocation binds the
          // existing batch identity; it never reauthorizes a send or a new job.
          const batch=await c.query(`select id from crm_capability_private.batches
            where id=$1::uuid and owner_id=$2 and from_identity=$3 and grant_family=$4::uuid and access_revision=$5 for update`,
            [before.batch_id,owner,capabilityBinding.fromIdentity,capabilityBinding.grantFamily,capabilityBinding.accessRevision])
          if(batch.rows.length!==1) fail('receipt_state_conflict')
        }
        await lead(c,owner,before.lead_id,true)
        const job=(await c.query("select * from crm_email_private.jobs where owner_id=$1 and id=$2 and status='sending' for update",[owner,id])).rows[0]
        if(!job) fail('receipt_state_conflict')
        let receipt={...result}
        if(status==='sent') {
          if(!job.delivery_started) fail('delivery_claim_invalid_or_consumed')
          const s=job.data.snapshot
          const parent=s.inReplyTo ? normalizeMessageId(s.inReplyTo) : null
          const references=parent ? buildReferencesHeader(s.references,parent) : s.references || null
          const parsedAttachments=Array.isArray(s.attachments)&&s.attachments.length?attachmentMeta(parseOutreachAttachments(s.attachments)).map((meta,index)=>storedAttachmentRecord({...meta,storageKey:s.attachments[index]?.storageKey,reason:s.attachments[index]?.storageKey?null:'bytes_not_stored'})):[]
          const headers={fromIdentity:s.fromIdentity,scheduled:!!job.data.schedule,kind:s.kind,messageIntentId:s.messageIntentId||null,
            attachments:parsedAttachments,simulated:result.simulated===true,publicUrl:null}
          // Stable job UUID is the thread UUID: no extra SELECT privilege or REST key.
          // Thread, sent receipt and lead flags commit together or all roll back.
          await c.query(`insert into public.crm_lead_messages(id,lead_id,direction,from_email,to_email,subject,
            body_text,body_html,message_id,in_reply_to,references_header,occurred_at,owner_id,raw_headers)
            values($1,$2,'outbound',$3,$4,$5,$6,$7,$8,$9,$10,now(),$11,$12::jsonb)`,
            [id,job.lead_id,s.from,s.to,s.subject,s.body,s.html,result.messageId || null,parent,references,owner,JSON.stringify(headers)])
          receipt={...receipt,storedMessageId:id,warning:null}
        }
        const r=(await c.query("update crm_email_private.jobs set status=$3,result=$4::jsonb,updated_at=now() where owner_id=$1 and id=$2 and status='sending' returning *",[owner,id,status,JSON.stringify(receipt)])).rows[0]
        if(status==='sent' && job.data.snapshot.kind==='initial') await c.query(`update public.crm_leads set initial_email_sent_at=coalesce(initial_email_sent_at,now()),
          initial_email_drafted_at=coalesce(initial_email_drafted_at,now()),contact_priority=false,
          status=case when status='new' then 'contacted' else status end,updated_at=now()
          where ${staffPair?"($1::uuid IS NOT NULL AND crm_email_private.staff_pair_receipt_lead(id,owner_id))":"owner_id=$1"} and id=$2`,[owner,before.lead_id])
        return mapJob(r)
      })
    },
    async block(owner,id,error,version) {
      const r=(await query(owner,`update crm_email_private.jobs set status='blocked',result=$3::jsonb,version=version+1${capabilityBinding?',updated_at=now()':''} where owner_id=$1 and id=$2 and status='queued' and version=$4 returning *`,[owner,id,JSON.stringify({error}),version])).rows[0]
      return mapJob(r)||get(owner,id)
    },
    async cancel(owner,id) {
      const r=(await query(owner,"update crm_email_private.jobs set status='cancelled',version=version+1,updated_at=now() where owner_id=$1 and id=$2 and status='queued' returning *",[owner,id])).rows[0]
      if(r) return mapJob(r)
      const old=await get(owner,id)
      if(!old) fail('job_not_found')
      if(old.status==='cancelled') return old
      fail('cannot_cancel_delivery_started_or_finished')
    },
    async list(owner) { return (await query(owner,'select * from crm_email_private.jobs where owner_id=$1 order by created_at desc,id desc limit 100',[owner])).rows.map(mapJob) },
    async due(owner,now) { return (await query(owner,"select * from crm_email_private.jobs where owner_id=$1 and status='queued' and due_at<=$2 order by due_at,id limit 25",[owner,new Date(now).toISOString()])).rows.map(mapJob) },
    async legacySchedules(owner) { return (await query(owner,"select id,scheduled_send from public.crm_leads where owner_id=$1 and scheduled_send is not null order by id limit 100",[owner])).rows },
    async staffActive(owner) { return (await query(owner,'select active from public.crm_staff_profiles where id=$1',[owner])).rows[0]?.active===true },
    async grant(owner,id) { return (await query(owner,'select * from crm_email_private.grant_families where owner_id=$1 and id=$2',[owner,id])).rows[0] },
    async binding(owner,url) { return (await query(owner,'select 1 from crm_email_private.target_binding where owner_id=$1 and supabase_url=$2',[owner,url])).rows.length===1 },
    async rateLimit(owner,bucket,max=30,windowMs=60000) {
      if(!['mcp','staff','worker'].includes(bucket) || !Number.isInteger(max) || max<1 || max>100 ||
        !Number.isInteger(windowMs) || windowMs<1000 || windowMs>3600000) fail('invalid_rate_limit')
      const r=(await query(owner,`insert into crm_email_private.rate_limits(owner_id,bucket,window_start,hits)
        values($1,$2,statement_timestamp(),1) on conflict(owner_id,bucket) do update set
        hits=case when crm_email_private.rate_limits.window_start <= statement_timestamp()-($3 * interval '1 millisecond')
          then 1 else least(crm_email_private.rate_limits.hits+1,1000000) end,
        window_start=case when crm_email_private.rate_limits.window_start <= statement_timestamp()-($3 * interval '1 millisecond')
          then statement_timestamp() else crm_email_private.rate_limits.window_start end returning hits`,[owner,bucket,windowMs])).rows[0]
      return r.hits<=max
    },
  }
}
