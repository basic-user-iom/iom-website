import { fail, emailDigest, emailContentDigest } from './crm-email-workflow.mjs'
import { attachmentMeta, parseOutreachAttachments } from './email-attachments.js'
import { normalizeMessageId, buildReferencesHeader } from './crm-lead-messages.js'

const mapJob = row => row && ({id:row.id,ownerId:row.owner_id,reviewId:row.review_id,version:row.version,
  ...row.data,status:row.status,...(row.result || {}),
  ...(row.status==='sending' ? {warning:'delivery_in_progress_or_unknown_do_not_retry'} : {}),
})
export function createEmailStore(acquire) {
  async function transaction(owner,work) {
    const c = await acquire()
    try {
      await c.query('begin')
      await c.query("select set_config('iom.email_owner',$1,true)",[owner])
      await c.query("set local lock_timeout='5s'")
      await c.query("set local statement_timeout='10s'")
      const result=await work(c)
      await c.query('commit')
      return result
    } catch (e) { await c.query('rollback').catch(()=>{}); throw e }
    finally { c.release() }
  }
  const query = (owner,sql,values=[]) => transaction(owner,c=>c.query(sql,values))
  const lead = async (c,owner,id,lock=false) => (await c.query(`select l.id,l.owner_id,l.email,l.emails,l.initial_email_subject,l.initial_email_body,
    l.initial_email_sent_at,l.initial_email_drafted_at,l.scheduled_send,l.status,l.contact_priority,l.updated_at,
    exists(select 1 from public.crm_lead_messages m where m.lead_id=l.id and m.direction='outbound') as has_outbound
    from public.crm_leads l where l.owner_id=$1 and l.id=$2 ${lock?'for update of l':''}`,[owner,id])).rows[0]
  function validateLead(row,snapshot) {
    if (!row) fail('lead_not_found')
    if (snapshot.kind==='initial') {
      if (row.initial_email_sent_at || row.has_outbound) fail('initial_email_already_sent')
      if (String(row.initial_email_subject || '').trim()!==snapshot.subject || String(row.initial_email_body || '').trim()!==snapshot.body) fail('review_stale')
    }
    const recipients=[row.email,...(Array.isArray(row.emails)?row.emails.map(x=>x.email):[])].map(x=>String(x||'').trim().toLowerCase())
    if (!recipients.includes(snapshot.to)) fail('recipient_not_on_lead')
    if (row.scheduled_send && emailDigest(row.scheduled_send)!==emailDigest(snapshot.legacySchedule)) fail('legacy_schedule_requires_review')
  }
  const get = async(owner,id)=>mapJob((await query(owner,'select * from crm_email_private.jobs where owner_id=$1 and id=$2',[owner,id])).rows[0])
  async function replay(owner,key) {
    const row=(await query(owner,`select j.*,c.review_id as command_review_id from crm_email_private.commands c
      join crm_email_private.jobs j on j.id=c.job_id where c.owner_id=$1 and c.idempotency_key=$2`,[owner,key])).rows[0]
    return row && {...mapJob(row),commandReviewId:row.command_review_id}
  }
  async function mutate(owner,review,key,now,actor,replace) {
    try { return await transaction(owner,async c=>{
      const row=await lead(c,owner,review.snapshot.leadId,true)
      const prior=(await c.query('select review_id,job_id from crm_email_private.commands where owner_id=$1 and idempotency_key=$2',[owner,key])).rows[0]
      if (prior) {
        if (prior.review_id!==review.id) fail('idempotency_conflict')
        return mapJob((await c.query('select * from crm_email_private.jobs where id=$1',[prior.job_id])).rows[0])
      }
      validateLead(row,review.snapshot)
      await validateIntent(c,owner,review.snapshot)
      if (Date.parse(review.expiresAt)<=now) fail('review_expired')
      const data={snapshot:review.snapshot,schedule:review.schedule,authorization:{kind:actor?.kind || 'staff',grantFamily:actor?.grantFamily,scopes:actor?.scopes,...(actor?.accessRevision?{accessRevision:actor.accessRevision}:{})}}
      const due=review.schedule?.at || new Date(now).toISOString()
      let job
      if (replace) {
        job=(await c.query(`update crm_email_private.jobs set review_id=$3,data=$4::jsonb,due_at=$5,version=version+1,updated_at=now()
          where owner_id=$1 and id=$2 and status='queued' and version=$6 returning *`,
        [owner,review.replaceJobId,review.id,JSON.stringify(data),due,review.expectedVersion])).rows[0]
        if (!job) fail('schedule_changed_or_delivery_started')
      } else {
        job=(await c.query(`insert into crm_email_private.jobs(owner_id,lead_id,review_id,status,due_at,data,delivery_key)
          values($1,$2,$3,'queued',$4,$5::jsonb,$6) returning *`,[owner,review.snapshot.leadId,review.id,due,JSON.stringify(data),
          review.snapshot.kind==='initial' ? `initial:${review.snapshot.leadId}` : review.snapshot.kind==='followup'
            ? `followup:${owner}:${review.snapshot.messageIntentId}` : `reply:${review.snapshot.leadId}:${emailContentDigest(review.snapshot)}`])).rows[0]
      }
      await c.query('insert into crm_email_private.commands(owner_id,idempotency_key,review_id,job_id) values($1,$2,$3,$4)',[owner,key,review.id,job.id])
      if (row.scheduled_send) await c.query('update public.crm_leads set scheduled_send=null where owner_id=$1 and id=$2',[owner,row.id])
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
  return {
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
    lead:(owner,id)=>transaction(owner,c=>lead(c,owner,id)),get,replay,
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
        const row=await lead(c,owner,before.lead_id,true)
        const current=(await c.query('select * from crm_email_private.jobs where owner_id=$1 and id=$2 for update',[owner,id])).rows[0]
        if(current.status!=='queued' || current.version!==(version ?? before.version) || +new Date(current.due_at)>now) return undefined
        validateLead(row,current.data.snapshot)
        await validateIntent(c,owner,current.data.snapshot)
        return mapJob((await c.query("update crm_email_private.jobs set status='sending',version=version+1,updated_at=now() where id=$1 returning *",[id])).rows[0])
      })
    },
    async beginDelivery(owner,id,snapshot) {
      return transaction(owner,async c=>{
        const job=(await c.query("select * from crm_email_private.jobs where owner_id=$1 and id=$2 and status='sending' for update",[owner,id])).rows[0]
        if(!job || job.delivery_started || emailContentDigest(job.data.snapshot)!==emailContentDigest(snapshot)) fail('delivery_claim_invalid_or_consumed')
        await validateIntent(c,owner,snapshot)
        await c.query('update crm_email_private.jobs set delivery_started=true where id=$1',[id])
        return true
      })
    },
    async finish(owner,id,status,result) {
      if(!['sent','unknown'].includes(status)) fail('invalid_status_transition')
      return transaction(owner,async c=>{
        const before=(await c.query('select lead_id from crm_email_private.jobs where owner_id=$1 and id=$2',[owner,id])).rows[0]
        if(!before) fail('receipt_state_conflict')
        await lead(c,owner,before.lead_id,true)
        const job=(await c.query("select * from crm_email_private.jobs where owner_id=$1 and id=$2 and status='sending' for update",[owner,id])).rows[0]
        if(!job) fail('receipt_state_conflict')
        let receipt={...result}
        if(status==='sent') {
          if(!job.delivery_started) fail('delivery_claim_invalid_or_consumed')
          const s=job.data.snapshot
          const parent=s.inReplyTo ? normalizeMessageId(s.inReplyTo) : null
          const references=parent ? buildReferencesHeader(s.references,parent) : s.references || null
          const headers={fromIdentity:s.fromIdentity,scheduled:!!job.data.schedule,kind:s.kind,messageIntentId:s.messageIntentId||null,
            attachments:attachmentMeta(parseOutreachAttachments(s.attachments)),simulated:result.simulated===true}
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
          where owner_id=$1 and id=$2`,[owner,before.lead_id])
        return mapJob(r)
      })
    },
    async block(owner,id,error,version) {
      const r=(await query(owner,"update crm_email_private.jobs set status='blocked',result=$3::jsonb,version=version+1 where owner_id=$1 and id=$2 and status='queued' and version=$4 returning *",[owner,id,JSON.stringify({error}),version])).rows[0]
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
