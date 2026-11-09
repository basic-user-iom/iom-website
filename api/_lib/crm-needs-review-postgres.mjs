import {randomUUID} from 'node:crypto'
import {emailDigest, fail} from './crm-email-workflow.mjs'
import {BATCH_POLICY, prepareNeedsReviewBatch, recipientWindow} from './crm-email-batch-policy.mjs'
import {createEmailStore} from './crm-needs-review-receipts.mjs'

// Local, inactive adapter for the EXISTING capability tables and shared jobs.
// No Pool, environment, credential, timer or route. The accompanying SQL proposal
// and explicit finite access authorization are prerequisites, never fallbacks.
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const id=x=>{if(!uuid.test(x||''))fail('invalid_id');return x}
const iso=x=>x instanceof Date?x.toISOString():x
const stamp=x=>{const t=Date.parse(iso(x));if(!Number.isFinite(t))fail('invalid_database_time');return t}
const marker='needs-review-batch-v1'
export const GROUP_CONFIRMATION_MS=30*60*1000
// Keep the existing transport snapshot shape exactly. Extra metadata here would
// change the shared exact-content dedup index and weaken cross-mode duplicates.
const snapshotOf=({deliveryKey,contentDigest,ownerId,timezone,draftedAt,...snapshot})=>snapshot
const eligibilityOf=({ownerId,timezone,draftedAt})=>({ownerId,timezone,draftedAt})
const same=(x,y)=>emailDigest(x)===emailDigest(y)

export function createNeedsReviewPostgresStore({acquire,binding,enabled=()=>false,emailStoreFactory=createEmailStore}={}) {
  if(!binding||binding.fromIdentity!=='projects'||!binding.accessRevision)fail('needs_review_binding_required')
  id(binding.ownerId);id(binding.grantFamily)
  const pin=structuredClone(binding)
  function bound(b){
    if(!b||b.authorized!==true||['ownerId','grantFamily','accessRevision','fromIdentity'].some(k=>b[k]!==pin[k]))fail('batch_access_denied')
  }
  async function transaction(b,action,work){
    if(enabled()!==true)fail('needs_review_disabled')
    bound(b)
    if(typeof acquire!=='function')fail('database_unavailable')
    const c=await acquire()
    try{
      await c.query('begin')
      await c.query(`/* nr:context */ select set_config('iom.email_owner',$1,true),
        set_config('iom.capability_sender',$2,true),set_config('iom.capability_grant',$3,true),
        set_config('iom.capability_revision',$4,true),set_config('iom.email_staff_pair','',true),
        set_config('iom.email_staff_sender','',true),set_config('iom.capability_batch','',true),
        set_config('lock_timeout','5s',true),set_config('statement_timeout','10s',true)`,
        [b.ownerId,b.fromIdentity,b.grantFamily,b.accessRevision])
      if(action){
        const auth=(await c.query(`/* nr:authorize */ select least(a.expires_at,g.expires_at,a.needs_review_until) as expires_at
          from crm_capability_private.access a join crm_email_private.grant_families g on g.owner_id=a.owner_id and g.id=$3
          where crm_capability_private.context_bound(a.owner_id,a.from_identity,g.id,a.revision)
            and a.owner_id=$1 and a.from_identity=$2 and a.revision=$4
            and a.needs_review_until>clock_timestamp() and a.needs_review_date is not null
            and a.actions @> array['needs_review_batch']::text[] and crm_capability_private.allowed($5)`,
          [b.ownerId,b.fromIdentity,b.grantFamily,b.accessRevision,action])).rows[0]
        if(!auth)fail('needs_review_authorization_required')
      }
      const result=await work(c)
      await c.query('commit') // Never return a claim before commit acknowledgement.
      return result
    }catch(error){await c.query('rollback').catch(()=>{});throw error}finally{c.release()}
  }
  const clock=async c=>stamp((await c.query('/* nr:clock */ select clock_timestamp() as at')).rows[0]?.at)
  async function leads(c,ids,{lock=false,batchId=null}={}){
    return (await c.query(`/* nr:leads */ select l.id,l.owner_id,l.email,l.tags,l.status,l.client_timezone,l.last_client_reply_at,
      l.initial_email_subject,l.initial_email_body,
      to_char(l.initial_email_drafted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as initial_email_drafted_at,
      l.initial_email_sent_at,l.scheduled_send,
      exists(select 1 from public.crm_lead_messages m where m.lead_id=l.id and m.direction='outbound') as has_outbound,
      exists(select 1 from crm_email_private.jobs j where j.delivery_key='initial:'||l.id::text
        and (j.delivery_started or j.status in ('queued','sending','sent','unknown'))
        and not coalesce((j.owner_id=$1 and j.data->>'batchId'=$3 and j.status in ('queued','sending')
          and exists(select 1 from crm_capability_private.batch_items i where i.job_id=j.id and i.batch_id=$3::uuid)),false)) as has_delivery_reservation
      from public.crm_leads l where l.owner_id=$1 and l.id=any($2::uuid[]) order by l.id ${lock?'for update of l':''}`,
      [pin.ownerId,ids,batchId])).rows.map(r=>({...r,initial_email_drafted_at:iso(r.initial_email_drafted_at)}))
  }
  function validateReview(r){
    const p=r?.plan,n=p?.needsReview
    if(!p||p.kind!=='crm-finite-batch-v1'||n?.revision!==marker||n.maxAttempts!==BATCH_POLICY.maxAttempts||
      p.ownerId!==pin.ownerId||p.fromIdentity!==pin.fromIdentity||p.grantFamily!==pin.grantFamily||p.accessRevision!==pin.accessRevision||
      p.intervalSeconds!==30||!Array.isArray(p.items)||!p.items.length||p.items.length>BATCH_POLICY.maxAttempts||
      emailDigest({plan:p,expiresAt:r.expiresAt})!==r.digest)fail('needs_review_manifest_invalid')
    if(new Set(p.items.map(x=>x.snapshot.to)).size!==p.items.length||new Set(p.items.map(x=>x.deliveryKey)).size!==p.items.length)fail('batch_duplicate_message')
    p.items.forEach((x,i)=>{if(x.index!==i||x.snapshot.kind!=='initial'||x.deliveryKey!==`initial:${x.snapshot.leadId}`||
      emailDigest({snapshot:x.snapshot,schedule:null})!==x.messageDigest)fail('needs_review_manifest_invalid')})
    return p
  }
  function currentItem(p,item,rows,now){
    const {plan}=prepareNeedsReviewBatch({ownerId:pin.ownerId,localDate:p.needsReview.localDate,rows,now})
    return plan?.items.some(x=>x.leadId===item.snapshot.leadId&&same(snapshotOf(x),item.snapshot)&&same(eligibilityOf(x),item.eligibility))===true
  }
  async function batch(c,batchId,lock=false){
    const row=(await c.query(`/* nr:batch */ select * from crm_capability_private.batches
      where owner_id=$1 and from_identity=$2 and grant_family=$3 and access_revision=$4 and id=$5 ${lock?'for update':''}`,
      [pin.ownerId,pin.fromIdentity,pin.grantFamily,pin.accessRevision,id(batchId)])).rows[0]
    if(!row)fail('batch_not_found')
    const p=validateReview(row.data)
    const jobs=(await c.query(`/* nr:jobs */ select i.position,i.message_digest,i.job_id,j.status,j.delivery_started,j.data,j.review_id,j.delivery_key
      from crm_capability_private.batch_items i join crm_email_private.jobs j on j.id=i.job_id and j.owner_id=i.owner_id
      where i.owner_id=$1 and i.batch_id=$2 order by i.position`,[pin.ownerId,batchId])).rows
    if(jobs.length!==p.items.length)fail('batch_durable_state_mismatch')
    jobs.forEach((j,i)=>{const item=p.items[i]
      const remainder=j.delivery_key===`remainder:${j.job_id}`&&j.data?.remainder===true&&j.status==='queued'&&j.delivery_started!==true
      if(j.position!==i||j.review_id!==item.reviewId||j.message_digest!==item.messageDigest||
      (!remainder&&j.delivery_key!==item.deliveryKey)||j.data?.batchId!==batchId||j.data.authorization?.kind!=='batch'||
      j.data.authorization.grantFamily!==pin.grantFamily||j.data.authorization.accessRevision!==pin.accessRevision||
      !same(j.data.snapshot,item.snapshot))fail('batch_durable_state_mismatch')})
    return {row,p,jobs}
  }
  async function lane(c){
    const r=(await c.query('/* nr:lane */ select * from crm_capability_private.batch_lane where lane_id=1 for update')).rows
    if(r.length!==1||r[0].lane_id!==1)fail('batch_global_lane_unavailable')
    return r[0]
  }
  async function unacknowledged(c,batchId){
    return (await c.query(`/* nr:unacknowledged */ select j.id from crm_capability_private.batch_items i
      join crm_email_private.jobs j on j.id=i.job_id and j.owner_id=i.owner_id
      where i.owner_id=$1 and i.batch_id=$2 and j.status='sent'
        and not exists(select 1 from crm_capability_private.commands a where a.owner_id=$1
          and a.idempotency_key='needs-review-receipt:'||j.id::text
          and a.from_identity=$3 and a.grant_family=$4 and a.access_revision=$5
          and a.kind='batch' and a.result=jsonb_build_object('jobId',j.id::text,'batchId',$2::text,'status','sent')) limit 1`,
      [pin.ownerId,batchId,pin.fromIdentity,pin.grantFamily,pin.accessRevision])).rows.length!==0
  }
  async function closeIfTerminal(c,batchId,jobs){
    if(jobs.every(j=>['sent','cancelled'].includes(j.status)))await c.query(`/* nr:close */ update crm_capability_private.batches
      set status=$3,updated_at=clock_timestamp() where owner_id=$1 and id=$2 and status='active'`,
      [pin.ownerId,batchId,jobs.every(j=>j.status==='sent')?'complete':'expired'])
  }
  const active=(r,p,now)=>r.status==='active'&&!r.cancelled_at&&now>=stamp(p.startsAt)&&now<stamp(p.endsAt)&&now<stamp(p.authorizationExpiresAt)
  return Object.freeze({
    // Technical snapshots of existing drafts; no per-message human approval.
    // Only a later, exact finite confirmation creates batch jobs.
    review: (b,{leadIds,localDate})=>transaction(b,'batch_review',async c=>{
      if(leadIds===undefined)leadIds=(await c.query(`/* nr:selection */ select id from public.crm_leads l
        where owner_id=$1 and status='new' and initial_email_sent_at is null and scheduled_send is null
          and last_client_reply_at is null and exists(select 1 from jsonb_array_elements_text(
            case when jsonb_typeof(l.tags)='array' then l.tags else '[]'::jsonb end) tag where lower(btrim(tag))='needs-review')
        order by initial_email_drafted_at nulls last,id limit 1000`,[pin.ownerId])).rows.map(r=>r.id)
      if(!Array.isArray(leadIds)||!leadIds.length||leadIds.length>1000||new Set(leadIds).size!==leadIds.length)fail('invalid_selection')
      leadIds.forEach(id)
      const now=await clock(c),rows=await leads(c,leadIds)
      const {plan:kernel,excluded}=prepareNeedsReviewBatch({ownerId:pin.ownerId,localDate,rows,now})
      if(!kernel)fail('no_eligible_drafts')
      const auth=(await c.query(`/* nr:expiry */ select least(a.expires_at,g.expires_at,a.needs_review_until) as expires_at
        from crm_capability_private.access a join crm_email_private.grant_families g on g.owner_id=a.owner_id and g.id=$3
        where a.owner_id=$1 and a.from_identity=$2 and a.revision=$4`,[pin.ownerId,pin.fromIdentity,pin.grantFamily,pin.accessRevision])).rows[0]
      const dayStart=Date.parse(`${localDate}T00:00:00Z`)
      const expiry=stamp(auth?.expires_at)
      if(!/^\d{4}-\d{2}-\d{2}$/.test(localDate||'')||!Number.isFinite(dayStart)||new Date(dayStart).toISOString().slice(0,10)!==localDate||dayStart>=expiry)
        fail('needs_review_date_not_authorized')
      const end=Math.min(dayStart+86400000,expiry)
      const starts=now+60000,expiresAt=new Date(now+GROUP_CONFIRMATION_MS).toISOString()
      if(end<=starts)fail('batch_window_expired')
      // Confirmation stays open long enough to read the list. It does not start delivery.
      // Message snapshots use the same read window and do not extend access or the OAuth grant.
      const messageExpiresAt=new Date(Math.min(end,now+GROUP_CONFIRMATION_MS)).toISOString()
      const items=[]
      for(const s of kernel.items){
        const snapshot=snapshotOf(s),reviewId=randomUUID(),messageDigest=emailDigest({snapshot,schedule:null})
        const message={snapshot,schedule:null,digest:messageDigest,expiresAt:messageExpiresAt}
        await c.query('/* nr:email-review */ insert into crm_email_private.reviews(id,owner_id,data) values($1,$2,$3::jsonb)',[reviewId,pin.ownerId,JSON.stringify(message)])
        items.push({index:items.length,reviewId,messageDigest,deliveryKey:s.deliveryKey,snapshot,eligibility:eligibilityOf(s)})
      }
      const plan={kind:'crm-finite-batch-v1',ownerId:pin.ownerId,grantFamily:pin.grantFamily,accessRevision:pin.accessRevision,
        fromIdentity:pin.fromIdentity,batchIntentId:randomUUID(),startsAt:new Date(starts).toISOString(),endsAt:new Date(end).toISOString(),
        authorizationExpiresAt:iso(auth.expires_at),intervalSeconds:30,needsReview:{revision:marker,localDate,maxAttempts:BATCH_POLICY.maxAttempts},items}
      const review={plan,expiresAt,digest:emailDigest({plan,expiresAt})},reviewId=randomUUID()
      await c.query(`/* nr:save-review */ insert into crm_capability_private.reviews
        (id,owner_id,from_identity,grant_family,access_revision,kind,data) values($1,$2,$3,$4,$5,'batch',$6::jsonb)`,
        [reviewId,pin.ownerId,pin.fromIdentity,pin.grantFamily,pin.accessRevision,JSON.stringify(review)])
      return {reviewId,...review,excluded,requiresFiniteConfirmation:true}
    }),
    confirm: (b,{reviewId,digest,confirmed})=>transaction(b,'batch_confirm',async c=>{
      id(reviewId);if(confirmed!==true||!/^[a-f0-9]{64}$/.test(digest||''))fail('finite_confirmation_required')
      await lane(c)
      const saved=(await c.query(`/* nr:review */ select data from crm_capability_private.reviews
        where owner_id=$1 and id=$2 and from_identity=$3 and grant_family=$4 and access_revision=$5 and kind='batch'`,
        [pin.ownerId,reviewId,pin.fromIdentity,pin.grantFamily,pin.accessRevision])).rows[0]
      if(!saved||saved.data.digest!==digest)fail('review_mismatch')
      const p=validateReview(saved.data)
      const prior=(await c.query('/* nr:replay */ select id,digest from crm_capability_private.batches where owner_id=$1 and intent_id=$2',[pin.ownerId,p.batchIntentId])).rows[0]
      if(prior){if(prior.digest!==digest)fail('idempotency_conflict');return {batchId:prior.id,replayed:true}}
      const now=await clock(c)
      if(now>=stamp(saved.data.expiresAt))fail('review_expired')
      const rows=await leads(c,p.items.map(x=>x.snapshot.leadId),{lock:true})
      if(p.items.some(x=>!currentItem(p,x,rows.filter(r=>r.id===x.snapshot.leadId),now)))fail('review_stale')
      const batchId=randomUUID()
      await c.query(`/* nr:insert-batch */ insert into crm_capability_private.batches
        (id,owner_id,from_identity,grant_family,access_revision,intent_id,review_id,digest,data,confirmed_at,status)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,statement_timestamp(),'active')`,
        [batchId,pin.ownerId,pin.fromIdentity,pin.grantFamily,pin.accessRevision,p.batchIntentId,reviewId,digest,JSON.stringify(saved.data)])
      // One bounded INSERT per table avoids replanning the deeply nested RLS
      // predicates 150 times. Every row still runs all existing guards/indexes.
      // Deferred membership FK is checked at the same atomic transaction commit.
      const members=p.items.map(x=>({job_id:randomUUID(),position:x.index,message_digest:x.messageDigest,
        lead_id:x.snapshot.leadId,review_id:x.reviewId,delivery_key:x.deliveryKey,
        data:{snapshot:x.snapshot,schedule:null,batchId,authorization:{kind:'batch',grantFamily:pin.grantFamily,accessRevision:pin.accessRevision}}}))
      const payload=JSON.stringify(members)
      await c.query(`/* nr:items-bulk */ insert into crm_capability_private.batch_items(owner_id,from_identity,batch_id,position,job_id,message_digest)
        select $1::uuid,$2,$3::uuid,x.position,x.job_id,x.message_digest from jsonb_to_recordset($4::jsonb)
        as x(position integer,job_id uuid,message_digest text) order by x.position`,[pin.ownerId,pin.fromIdentity,batchId,payload])
      // The measured 150-row guarded statement takes about nine seconds locally.
      // Give only this atomic reservation statement bounded headroom; other
      // queries and lock waits retain their existing 10s/5s limits.
      await c.query("set local statement_timeout='25s'")
      await c.query(`/* nr:jobs-bulk */ insert into crm_email_private.jobs(id,owner_id,lead_id,review_id,status,due_at,data,delivery_key)
        select x.job_id,$1::uuid,x.lead_id,x.review_id,'queued','infinity'::timestamptz,x.data,x.delivery_key
        from jsonb_to_recordset($2::jsonb) as x(position integer,job_id uuid,lead_id uuid,review_id uuid,data jsonb,delivery_key text)
        order by x.position`,[pin.ownerId,payload])
      await c.query("set local statement_timeout='10s'")
      return {batchId,replayed:false,count:p.items.length}
    }),
    confirmationStatus:(b,{reviewId,digest})=>transaction(b,null,async c=>{
      id(reviewId);if(!/^[a-f0-9]{64}$/.test(digest||''))fail('review_mismatch')
      const saved=(await c.query(`/* nr:review */ select data from crm_capability_private.reviews
        where owner_id=$1 and id=$2 and from_identity=$3 and grant_family=$4 and access_revision=$5 and kind='batch'`,
        [pin.ownerId,reviewId,pin.fromIdentity,pin.grantFamily,pin.accessRevision])).rows[0]
      if(!saved||saved.data.digest!==digest)fail('review_mismatch')
      const p=validateReview(saved.data)
      const prior=(await c.query('/* nr:replay */ select id,digest from crm_capability_private.batches where owner_id=$1 and intent_id=$2',[pin.ownerId,p.batchIntentId])).rows[0]
      if(prior&&prior.digest!==digest)fail('idempotency_conflict')
      return prior?{status:'confirmed',batchId:prior.id,automaticRetryAllowed:false}:
        {status:'unconfirmed_or_in_progress',automaticRetryAllowed:false}
    }),
    listDueBatches:(b)=>transaction(b,'batch_worker',async c=>(await c.query(`/* nr:due */ select id from crm_capability_private.batches
      where owner_id=$1 and from_identity=$2 and grant_family=$3 and access_revision=$4 and status='active' and cancelled_at is null
        and data->'plan'->'needsReview'->>'revision'=$5 and (data->'plan'->>'startsAt')::timestamptz<=clock_timestamp()
        order by confirmed_at,id limit 1`,
      [pin.ownerId,pin.fromIdentity,pin.grantFamily,pin.accessRevision,marker])).rows.map(x=>x.id)),
    claimBatch:(b,batchId)=>transaction(b,'batch_worker',async c=>{
      const l=await lane(c),{row,p,jobs}=await batch(c,batchId,true),now=await clock(c)
      if(await unacknowledged(c,batchId))return null
      if(row.status==='active'&&!jobs.some(j=>['sending','unknown'].includes(j.status))&&now>=stamp(p.endsAt)){
        await c.query(`/* nr:remainder */ update crm_email_private.jobs
          set delivery_key='remainder:'||id::text,data=jsonb_set(data,'{remainder}','true'::jsonb,true),updated_at=transaction_timestamp()
          where owner_id=$1 and data->>'batchId'=$2 and status='queued' and not delivery_started and delivery_key not like 'remainder:%'`,
          [pin.ownerId,batchId])
        return null
      }
      await closeIfTerminal(c,batchId,jobs)
      if(!active(row,p,now)||l.pending_job_id!==null||jobs.some(j=>['sending','unknown'].includes(j.status)))return null
      if(l.last_accepted_at!==null&&now<stamp(l.last_accepted_at)+Math.max(30,Number(l.last_interval_seconds))*1000)return null
      for(let i=0;i<jobs.length;i++){
        const j=jobs[i],x=p.items[i]
        if(j.status!=='queued'||j.delivery_started||recipientWindow(p.needsReview.localDate,x.eligibility.timezone,now)!=='open')continue
        const rows=await leads(c,[x.snapshot.leadId],{lock:true,batchId})
        if(!currentItem(p,x,rows,await clock(c)))continue
        await c.query("select set_config('iom.capability_batch',$1,true)",[batchId])
        const claimed=await c.query(`/* nr:claim */ update crm_email_private.jobs set status='sending',version=version+1,updated_at=transaction_timestamp()
          where owner_id=$1 and id=$2 and status='queued' and not delivery_started returning id`,[pin.ownerId,j.job_id])
        if(claimed.rows.length!==1)fail('claim_conflict')
        return {batchId,jobId:j.job_id,snapshot:x.snapshot,recipientTimeZone:x.eligibility.timezone,localDate:p.needsReview.localDate,authorizationExpiresAt:p.authorizationExpiresAt}
      }
      return null
    }),
    beginBatchDelivery:(b,{batchId,jobId,snapshot})=>transaction(b,'batch_worker',async c=>{
      const l=await lane(c),{row,p,jobs}=await batch(c,batchId,true),now=await clock(c)
      const index=jobs.findIndex(x=>x.job_id===jobId),j=jobs[index],x=p.items[index]
      if(await unacknowledged(c,batchId))fail('receipt_acknowledgement_missing')
      if(!active(row,p,now)||!j||j.status!=='sending'||j.delivery_started||!same(snapshot,x.snapshot)||
        l.pending_job_id!==jobId||l.delivery_started||Number(l.pending_interval_seconds)!==30)fail('claim_not_available')
      const rows=await leads(c,[x.snapshot.leadId],{lock:true,batchId})
      const at=await clock(c)
      if(!currentItem(p,x,rows,at)||recipientWindow(p.needsReview.localDate,x.eligibility.timezone,at)!=='open')fail('recipient_or_window_changed')
      await c.query("select set_config('iom.capability_batch',$1,true)",[batchId])
      const r=await c.query(`/* nr:begin */ update crm_email_private.jobs set delivery_started=true where owner_id=$1 and id=$2
        and status='sending' and not delivery_started returning id`,[pin.ownerId,id(jobId)])
      if(r.rows.length!==1)fail('claim_consumed')
      return true
    }),
    async finishBatch(b,{batchId,jobId,status,result={}}){
      if(!['sent','unknown'].includes(status))fail('invalid_receipt')
      const prior=await transaction(b,null,async c=>{
        const {jobs}=await batch(c,batchId),j=jobs.find(x=>x.job_id===jobId)
        if(!j)fail('receipt_binding_mismatch')
        if(['sent','unknown'].includes(j.status))return {status:j.status,replayed:true}
        if(j.status!=='sending'||(status==='sent'&&!j.delivery_started))fail('receipt_state_conflict')
        return null
      })
      if(prior)return prior
      // Existing atomic thread + receipt + lead flags; never a second transport.
      const receipt=await emailStoreFactory(acquire,{requireContactApproval:true,capabilityBinding:pin}).finish(pin.ownerId,jobId,status,
        status==='sent'?{messageId:typeof result.messageId==='string'?result.messageId:null,simulated:result.simulated===true}
          :{error:'delivery_outcome_unknown_do_not_retry'})
      // Separate durable acknowledgement only AFTER the receipt commit is known.
      // A lost finish acknowledgement leaves this absent and prevents every next
      // claim. Re-reading a sent row is deliberately not an automatic resume.
      if(status==='sent')await transaction(b,'batch_confirm',async c=>{
        await lane(c)
        const {jobs}=await batch(c,batchId,true)
        if(!jobs.some(j=>j.job_id===jobId&&j.status==='sent'&&j.delivery_started))fail('receipt_state_conflict')
        const result={jobId,batchId,status:'sent'}
        await c.query(`/* nr:acknowledge */ insert into crm_capability_private.commands
          (owner_id,idempotency_key,from_identity,grant_family,access_revision,kind,request_digest,result)
          values($1,$2,$3,$4,$5,'batch',$6,$7::jsonb)`,
          [pin.ownerId,`needs-review-receipt:${jobId}`,pin.fromIdentity,pin.grantFamily,pin.accessRevision,emailDigest(result),JSON.stringify(result)])
        await closeIfTerminal(c,batchId,jobs)
      })
      return receipt
    },
    status:(b,batchId)=>transaction(b,null,async c=>{
      const {row,p,jobs}=await batch(c,batchId),now=await clock(c)
      const sent=jobs.filter(j=>j.status==='sent').length,uncertain=jobs.some(j=>['sending','unknown'].includes(j.status))
      const missingAck=await unacknowledged(c,batchId)
      const remainder=jobs.some(j=>j.status==='queued'&&j.delivery_started!==true&&j.data?.remainder===true)
      return {batchId,localDate:p.needsReview.localDate,total:jobs.length,sent,
        status:uncertain?'paused_unknown':missingAck?'paused_receipt_unconfirmed':sent===jobs.length?'complete':remainder?'remainder_ready_for_new_preview':now>=stamp(p.endsAt)?'expired':row.status,
        limitReached:sent===BATCH_POLICY.maxAttempts,additionalMessagesRequireNewDecision:true}
    }),
    async createContact(b,contact,idempotencyKey){
      if(!contact||contact.operation!=='create_contact'||(contact.emailAction!==undefined&&contact.emailAction!=='none'))fail('invalid_contact_arguments')
      if(!/^[A-Za-z0-9_.:-]{8,120}$/.test(idempotencyKey||''))fail('invalid_confirmation')
      return transaction(b,null,async c=>{
        const prior=(await c.query(`/* nr:contact-replay */ select result from crm_capability_private.commands
          where owner_id=$1 and idempotency_key=$2 and from_identity=$3 and grant_family=$4 and access_revision=$5 and kind='contact'`,
          [pin.ownerId,idempotencyKey,pin.fromIdentity,pin.grantFamily,pin.accessRevision])).rows[0]
        if(prior?.result?.leadId)return {leadId:prior.result.leadId,replayed:true,emailAction:'none'}
        const created=(await c.query(`/* nr:contact */ insert into public.crm_leads(
          owner_id,company_name,contact_name,email,status,temperature,tags,links,emails,
          initial_email_subject,initial_email_body,initial_email_drafted_at,initial_email_sent_at,scheduled_send,
          contact_priority,client_timezone,website,phone,offer,company_focus,notes,contact_role,value_emoji)
          values($1,$2,$3,$4,'new','warm',$5::jsonb,'[]'::jsonb,'[]'::jsonb,$6,$7,
            case when length(btrim($6))>0 and length(btrim($7))>0 then clock_timestamp() else null end,
            null,null,false,$8,'','','','','','','')
          returning id`,[pin.ownerId,contact.companyName,contact.contactName,contact.email,JSON.stringify(contact.tags||[]),
            contact.subject||'',contact.body||'',contact.timezone])).rows[0]
        if(!created?.id)fail('invalid_contact_source')
        const result={leadId:created.id,emailAction:'none'}
        await c.query(`/* nr:contact-command */ insert into crm_capability_private.commands
          (owner_id,idempotency_key,from_identity,grant_family,access_revision,kind,request_digest,result)
          values($1,$2,$3,$4,$5,'contact',$6,$7::jsonb)`,
          [pin.ownerId,idempotencyKey,pin.fromIdentity,pin.grantFamily,pin.accessRevision,contact.digest,JSON.stringify(result)])
        return {...result,replayed:false}
      })
    },
  })
}
