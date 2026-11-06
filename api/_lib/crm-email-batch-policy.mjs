import {createHash} from 'node:crypto'
import {renderOutreachEmailHtml,renderOutreachPlainText} from './outreach-email-html.js'

// Inactive policy kernel, NOT an authorization endpoint or an email transport.
// No production module imports this file. A future durable adapter must serialize
// every transition, reserve the existing delivery key, and verify authorization.
export const BATCH_POLICY=Object.freeze({revision:'needs-review-batch-v1',maxAttempts:150,
  minimumGapMs:30000,startMinute:7*60+45,endMinute:11*60,fromIdentity:'projects'})
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const address=/^[^\s@<>,;\r\n]+@[^\s@<>,;\r\n]+\.[^\s@<>,;\r\n]+$/
const fail=code=>{throw Object.assign(new Error(code),{code})}
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'
  ?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x
const hash=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex')
const frozen=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x)}return x}
const normEmail=x=>typeof x==='string'&&address.test(x.trim())?x.trim().toLowerCase():null
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x
const validZone=x=>{
  if(typeof x!=='string'||(!x.includes('/')&&x!=='UTC'))return false
  try{new Intl.DateTimeFormat('en',{timeZone:x}).format(0);return true}catch{return false}
}
export function recipientWindow(localDate,timeZone,now){
  if(!validDate(localDate)||!validZone(timeZone)||!Number.isFinite(now))fail('invalid_window')
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]))
  const date=`${parts.year}-${parts.month}-${parts.day}`,minute=Number(parts.hour)*60+Number(parts.minute)
  if(date>localDate||(date===localDate&&minute>=BATCH_POLICY.endMinute))return 'expired'
  if(date<localDate||minute<BATCH_POLICY.startMinute)return 'waiting'
  return 'open'
}
function snapshot(row,ownerId){
  if(!row||!uuid.test(row.id||'')||row.owner_id!==ownerId)fail('owner_or_lead_mismatch')
  const tags=Array.isArray(row.tags)?row.tags.map(x=>String(x).trim().toLowerCase()):[]
  if(!tags.includes('needs-review'))fail('not_needs_review')
  if(row.status!=='new'||row.initial_email_sent_at||row.last_client_reply_at)fail('not_unsent_initial')
  // Adapter must obtain both booleans from authoritative history, never default
  // absent history to false. Existing unknown/sending reservations count as used.
  if(row.has_outbound!==false||row.has_delivery_reservation!==false)fail('delivery_history_not_clear')
  if(row.scheduled_send)fail('already_scheduled')
  const to=normEmail(row.email);if(!to)fail('invalid_primary_recipient')
  if(!validZone(row.client_timezone))fail('missing_or_invalid_recipient_timezone')
  const subject=row.initial_email_subject,body=row.initial_email_body
  if(typeof subject!=='string'||!subject.trim()||subject.length>300||/[\r\n]/.test(subject)||
    typeof body!=='string'||!body.trim()||body.length>50000||!Number.isFinite(Date.parse(row.initial_email_drafted_at)))fail('invalid_existing_draft')
  // The existing reviewed transport trims these fields. Do not silently change
  // an approved draft here; such rows need correction outside this batch.
  if(subject!==subject.trim()||body!==body.trim())fail('draft_requires_normalization_review')
  return {leadId:row.id,ownerId,to,fromIdentity:'projects',from:'projects@iobjectm.com',fromHeader:'IOM Projects <projects@iobjectm.com>',
    subject,body,html:renderOutreachEmailHtml({subject,body}),text:renderOutreachPlainText(body),template:'crm-outreach-v1',
    kind:'initial',timezone:row.client_timezone,draftedAt:row.initial_email_drafted_at}
}
function assertPlan(plan){
  if(!plan||plan.revision!==BATCH_POLICY.revision||!uuid.test(plan.ownerId||'')||!validDate(plan.localDate)||
    !Array.isArray(plan.items)||!plan.items.length||plan.items.length>BATCH_POLICY.maxAttempts||
    hash(plan.policy)!==hash(BATCH_POLICY))fail('invalid_plan')
  const {digest,...body}=plan
  if(hash(body)!==digest)fail('manifest_changed')
}
export function prepareNeedsReviewBatch({ownerId,localDate,rows,now}){
  if(!uuid.test(ownerId||'')||!validDate(localDate)||!Array.isArray(rows)||!Number.isFinite(now))fail('invalid_batch_request')
  const candidates=[],excluded=[],seenIds=new Set(),seenEmails=new Set()
  // A repeated database ID is an ambiguous export, not an invitation to choose one.
  const counts=new Map();for(const row of rows)counts.set(row?.id,(counts.get(row?.id)||0)+1)
  for(const row of rows){
    try{
      if(counts.get(row?.id)>1)fail('duplicate_lead_id')
      const item=snapshot(row,ownerId)
      if(recipientWindow(localDate,item.timezone,now)==='expired')fail('recipient_window_missed')
      candidates.push(item)
    }catch(error){excluded.push({leadId:row?.id||null,reason:error.code||'invalid_row'})}
  }
  candidates.sort((a,b)=>Date.parse(a.draftedAt)-Date.parse(b.draftedAt)||(a.leadId<b.leadId?-1:1))
  const items=[]
  for(const item of candidates){
    if(seenIds.has(item.leadId)||seenEmails.has(item.to)){excluded.push({leadId:item.leadId,reason:'duplicate_recipient'});continue}
    seenIds.add(item.leadId);seenEmails.add(item.to)
    if(items.length===BATCH_POLICY.maxAttempts){excluded.push({leadId:item.leadId,reason:'approval_cap'});continue}
    items.push({...item,deliveryKey:`initial:${item.leadId}`,contentDigest:hash(item)})
  }
  if(!items.length)return {plan:null,excluded}
  const body={revision:BATCH_POLICY.revision,ownerId,localDate,createdAt:new Date(now).toISOString(),policy:{...BATCH_POLICY},items}
  return {plan:frozen({...body,digest:hash(body)}),excluded}
}
export function initialBatchState(plan){
  assertPlan(plan)
  return {manifestDigest:plan.digest,status:'prepared',authorizationId:null,version:0,attempts:0,sent:0,
    nextAllowedAt:0,inFlight:null,items:Object.fromEntries(plan.items.map(x=>[x.leadId,'pending'])),events:[]}
}
function validAuthorization(plan,state,auth,now){
  return auth?.revision===BATCH_POLICY.revision&&uuid.test(auth.id||'')&&auth.ownerId===plan.ownerId&&
    auth.manifestDigest===plan.digest&&auth.localDate===plan.localDate&&auth.maxAttempts===BATCH_POLICY.maxAttempts&&
    auth.approved===true&&auth.revoked===false&&Date.parse(auth.expiresAt)>now&&
    (!state.authorizationId||state.authorizationId===auth.id)
}
function validateState(plan,state){
  assertPlan(plan)
  if(state?.manifestDigest!==plan.digest||!Number.isInteger(state.attempts)||state.attempts<0||state.attempts>150||
    !Number.isInteger(state.sent)||state.sent<0||state.sent>state.attempts||!Number.isInteger(state.version)||
    !Number.isFinite(state.nextAllowedAt)||!state.items||!Array.isArray(state.events))fail('invalid_batch_state')
}
// Pure decision only. Persist returned state and globally reserve deliveryKey in
// ONE database transaction before executing an attempt. Never send on a failed
// or uncertain commit. A repeated wake-up must reread the committed state.
export function claimBatchAttempt(plan,state,rows,{now,authorization}={}){
  validateState(plan,state)
  if(!Number.isFinite(now)||!Array.isArray(rows))fail('invalid_tick')
  const next=structuredClone(state),result=action=>({state:next,action})
  if(!['prepared','running'].includes(next.status))return result({kind:'stop',reason:next.status})
  if(!validAuthorization(plan,next,authorization,now))return result({kind:'blocked',reason:'batch_authorization_required'})
  if(next.inFlight)return result({kind:'blocked',reason:'in_flight_do_not_retry'})
  if(next.attempts>=BATCH_POLICY.maxAttempts){next.status='limit_reached';return result({kind:'stop',reason:next.status})}
  if(now<next.nextAllowedAt)return result({kind:'wait',notBefore:next.nextAllowedAt})
  next.authorizationId=authorization.id;next.status='running'
  const byId=new Map(),duplicates=new Set()
  for(const row of rows){if(byId.has(row?.id))duplicates.add(row.id);byId.set(row?.id,row)}
  for(const item of plan.items){
    if(next.items[item.leadId]!=='pending')continue
    let current
    try{
      if(duplicates.has(item.leadId))fail('ambiguous_current_lead')
      current=snapshot(byId.get(item.leadId),plan.ownerId)
      if(hash(current)!==item.contentDigest)fail('recipient_draft_or_timezone_changed')
    }catch(error){next.items[item.leadId]='blocked';next.events.push({type:'item_blocked',leadId:item.leadId,reason:error.code||'invalid_current_row'});continue}
    const window=recipientWindow(plan.localDate,item.timezone,now)
    if(window==='expired'){next.items[item.leadId]='expired';continue}
    if(window==='waiting')continue
    next.attempts++;next.version++;next.items[item.leadId]='sending'
    const attemptId=hash({authorizationId:authorization.id,manifestDigest:plan.digest,leadId:item.leadId})
    next.inFlight={attemptId,leadId:item.leadId,startedAt:now}
    return result({kind:'attempt',attemptId,deliveryKey:item.deliveryKey,snapshot:structuredClone(item)})
  }
  if(!Object.values(next.items).includes('pending')){
    next.status='complete';next.events.push({type:'batch_complete',sent:next.sent,attempts:next.attempts})
    return result({kind:'stop',reason:'complete'})
  }
  return result({kind:'wait',reason:'recipient_windows'})
}
// Call immediately before irreversible handoff as a second check; this is not
// authorization by itself. The adapter must recheck owner grant and lead under
// its delivery fence, and enforce one outstanding handoff across all batches.
export function canHandoffBatchAttempt(plan,state,row,{now,authorization,attemptId}={}){
  validateState(plan,state)
  if(!Number.isFinite(now)||state.status!=='running'||!state.inFlight||state.inFlight.attemptId!==attemptId||
    !validAuthorization(plan,state,authorization,now))return false
  const item=plan.items.find(x=>x.leadId===state.inFlight.leadId)
  // The reservation must be this exact committed attempt, not another batch's.
  if(row?.has_delivery_reservation!==true||row?.reservation_attempt_id!==attemptId)return false
  try{return !!item&&hash(snapshot({...row,has_delivery_reservation:false},plan.ownerId))===item.contentDigest&&
    recipientWindow(plan.localDate,item.timezone,now)==='open'}catch{return false}
}
export function finishBatchAttempt(plan,state,{attemptId,outcome,now}={}){
  validateState(plan,state)
  if(!state.inFlight||state.inFlight.attemptId!==attemptId||state.status!=='running')fail('attempt_not_in_flight')
  if(!Number.isFinite(now)||now<state.inFlight.startedAt||!['sent','unknown','not_sent'].includes(outcome))fail('invalid_outcome')
  const next=structuredClone(state),leadId=next.inFlight.leadId
  next.version++;next.items[leadId]=outcome;next.inFlight=null;next.nextAllowedAt=now+BATCH_POLICY.minimumGapMs
  if(outcome==='sent')next.sent++
  // No automatic retry even for a conclusively unsubmitted item. A receipt-loss,
  // timeout, process crash or provider error is unknown, NEVER not_sent.
  if(outcome==='unknown'){
    next.status='paused_unknown';next.events.push({type:'batch_paused_unknown',leadId,attemptId})
  }else if(next.attempts===BATCH_POLICY.maxAttempts){
    next.status='limit_reached';next.events.push({type:'batch_limit_reached',sent:next.sent,attempts:next.attempts})
  }else if(!Object.values(next.items).includes('pending')){
    next.status='complete';next.events.push({type:'batch_complete',sent:next.sent,attempts:next.attempts})
  }
  return next
}
