import {fields,fail} from './crm-email-workflow.mjs'
import {BATCH_POLICY,groupWindowLabel} from './crm-email-batch-policy.mjs'
import {confirmContactCreate,prepareContactCreate} from './crm-contact-approval.mjs'

// Registration remains the host's explicit responsibility. No send/worker tool:
// the authenticated host worker invokes the separately supplied dispatcher.
const FAMILY=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const EXPLICIT=Object.freeze(['crm_needs_review_email_preview','crm_needs_review_email_confirm','crm_needs_review_email_status',
  'crm_needs_review_followup_preview','crm_needs_review_followup_confirm','crm_needs_review_contact_preview','crm_needs_review_contact_confirm',
  'crm_needs_review_reply_list','crm_needs_review_reply_preview','crm_needs_review_reply_confirm','crm_needs_review_reply_status'])
export const NEEDS_REVIEW_SINGLE_TOOLS=Object.freeze(['crm_needs_review_email_preview','crm_needs_review_email_confirm','crm_needs_review_email_status'])
export function needsReviewSingleSendEnabled(env=process.env){return env?.CRM_NEEDS_REVIEW_SINGLE_SEND_ENABLED==='true'}
export function needsReviewScheduleEnabled(env=process.env){return env?.CRM_NEEDS_REVIEW_SCHEDULE_ENABLED==='true'}
export function needsReviewSingleSendView(env,allowed){
  return new Proxy(env,{get(target,prop,receiver){
    if(prop==='CRM_EMAIL_SEND_ENABLED')return allowed()===true?'true':'false'
    return Reflect.get(target,prop,receiver)
  }})
}
export function needsReviewToolFailure(name,error){
  return EXPLICIT.includes(name)?(error?.code||'needs_review_request_failed'):'needs_review_request_failed_check_confirmation_status'
}
const closedSchedule=(args,scheduleEnabled)=>{
  if((args?.scheduledLocal!==undefined||args?.utcOffset!==undefined)&&scheduleEnabled()!==true)fail('needs_review_schedule_paused')
}
export function createNeedsReviewTools({binding,enabled=()=>false,startsEnabled=()=>false,openStore,openIndividual,openContacts,singleSendEnabled=needsReviewSingleSendEnabled,scheduleEnabled=needsReviewScheduleEnabled}={}){
  const common=['iom:crm:email:read'],send=[...common,'iom:crm:email:send','iom:crm:email:batch:confirm'],one=[...common,'iom:crm:email:send']
  const windowLabel=groupWindowLabel()
  const definitions=[
    {name:'crm_needs_review_batch_preview',description:`Prepare a finite list of up to ${BATCH_POLICY.maxAttempts} existing Needs review initial drafts for an explicit recipient-local date; minimum 30 seconds, only ${windowLabel}. Returns each recipient and the message content. Sends nothing.`,
      inputSchema:{type:'object',properties:{localDate:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}},required:['localDate'],additionalProperties:false}},
    {name:'crm_needs_review_batch_confirm',description:'Confirm the exact finite manifest once. Requires explicit group authorization. Reserves existing shared jobs for the separately authorized worker; no immediate delivery. Stops at the approved list and does not add another group.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},confirmed:{type:'boolean',const:true}},required:['reviewId','digest','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_batch_status',description:'Read counts and paused, expired or complete state for this authorized owner/sender. Does not retry or resume an uncertain delivery.',
      inputSchema:{type:'object',properties:{batchId:{type:'string',format:'uuid'}},required:['batchId'],additionalProperties:false}},
    {name:'crm_needs_review_confirmation_status',description:'Reconcile a slow or lost confirmation response using the exact original review ID and digest. Never create a replacement group or retry automatically.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'}},required:['reviewId','digest'],additionalProperties:false}},
    {name:'crm_needs_review_email_preview',description:'Review one existing initial draft and one recipient already stored on that contact. Shows the final sender, subject and rendered content. Sends nothing. A future time stays closed until schedule approval.',
      inputSchema:{type:'object',properties:{leadId:{type:'string',format:'uuid'},to:{type:'string',maxLength:320},fromIdentity:{type:'string',enum:['projects']},scheduledLocal:{type:'string'},utcOffset:{type:'string',enum:['+01:00','+02:00']}},required:['leadId','to','fromIdentity'],additionalProperties:false}},
    {name:'crm_needs_review_email_confirm',description:'Send the exact reviewed message only after explicit confirmation of its review id and digest. Reuse the same idempotency key after an interruption. An unknown outcome is not retried. A scheduled confirmation stays closed until schedule approval.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},idempotencyKey:{type:'string',minLength:8,maxLength:120},confirmed:{type:'boolean',const:true}},required:['reviewId','digest','idempotencyKey','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_email_status',description:'Read the status of one confirmed message by its idempotency key. Does not send, retry, or resume an uncertain delivery.',
      inputSchema:{type:'object',properties:{idempotencyKey:{type:'string',minLength:8,maxLength:120}},required:['idempotencyKey'],additionalProperties:false}},
    {name:'crm_needs_review_followup_preview',description:'Review one follow-up to an existing contact. Shows the final recipient, subject and content. Sends nothing and does not schedule while schedule approval is closed.',
      inputSchema:{type:'object',properties:{leadId:{type:'string',format:'uuid'},to:{type:'string',maxLength:320},fromIdentity:{type:'string',enum:['projects']},messageIntentId:{type:'string',format:'uuid'},subject:{type:'string',maxLength:300},body:{type:'string',maxLength:50000},scheduledLocal:{type:'string'},utcOffset:{type:'string',enum:['+01:00','+02:00']}},required:['leadId','to','fromIdentity','messageIntentId','subject','body'],additionalProperties:false}},
    {name:'crm_needs_review_followup_confirm',description:'Send one reviewed follow-up only after explicit confirmation of its review id and digest. Uses its own idempotency key. An unknown outcome is not retried. Does not open group sending.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},idempotencyKey:{type:'string',minLength:8,maxLength:120},confirmed:{type:'boolean',const:true}},required:['reviewId','digest','idempotencyKey','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_contact_preview',description:'Review a new contact. Shows the name, address and optional draft. Sends nothing and does not insert the contact.',
      inputSchema:{type:'object',properties:{companyName:{type:'string',maxLength:2000},contactName:{type:'string',maxLength:2000},email:{type:'string',maxLength:320},subject:{type:'string',maxLength:300},body:{type:'string',maxLength:50000},timezone:{type:'string',maxLength:80},tags:{type:'array',items:{type:'string',maxLength:40}}},required:['email'],additionalProperties:false}},
    {name:'crm_needs_review_contact_confirm',description:'Insert one reviewed contact only after explicit confirmation of its digest. Does not send mail. Creating a contact and sending mail remain separate confirmations.',
      inputSchema:{type:'object',properties:{companyName:{type:'string',maxLength:2000},contactName:{type:'string',maxLength:2000},email:{type:'string',maxLength:320},subject:{type:'string',maxLength:300},body:{type:'string',maxLength:50000},timezone:{type:'string',maxLength:80},tags:{type:'array',items:{type:'string',maxLength:40}},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},idempotencyKey:{type:'string',minLength:8,maxLength:120},confirmed:{type:'boolean',const:true}},required:['email','digest','idempotencyKey','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_reply_list',description:'List stored incoming replies, newest page first (at most 400). Optional from/to dates are filtered in the database; a calendar date is a Europe/Belgrade day, and to is exclusive for a timestamp. Pass next.beforeOccurredAt and next.beforeId for the next older page. Shows date, person, company, content, and correspondence loaded in that page. Answered means any stored outbound message is later than that reply, including one outside the page. A CRM replied flag is not used. Sends nothing.',
      inputSchema:{type:'object',properties:{from:{type:'string',maxLength:40},to:{type:'string',maxLength:40},beforeOccurredAt:{type:'string',maxLength:40},beforeId:{type:'string',format:'uuid'}},additionalProperties:false}},
    {name:'crm_needs_review_reply_preview',description:'Prepare one reply in an existing stored thread. Shows the recipient, subject, and final content. Sends nothing and does not schedule.',
      inputSchema:{type:'object',properties:{leadId:{type:'string',format:'uuid'},to:{type:'string',maxLength:320},fromIdentity:{type:'string',enum:['projects']},messageIntentId:{type:'string',format:'uuid'},subject:{type:'string',maxLength:300},body:{type:'string',maxLength:50000},inReplyTo:{type:'string',maxLength:998},references:{type:'string',maxLength:8000}},required:['leadId','to','fromIdentity','messageIntentId','subject','body','inReplyTo'],additionalProperties:false}},
    {name:'crm_needs_review_reply_confirm',description:'Send the exact reviewed thread reply only after explicit confirmation of its review id and digest. Reuse the same idempotency key. An unknown outcome is reported and not retried. Does not open group sending.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},idempotencyKey:{type:'string',minLength:8,maxLength:120},confirmed:{type:'boolean',const:true}},required:['reviewId','digest','idempotencyKey','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_reply_status',description:'Read the real status of one confirmed thread reply by its idempotency key. Unknown or in-progress delivery is reported and not retried.',
      inputSchema:{type:'object',properties:{idempotencyKey:{type:'string',minLength:8,maxLength:120}},required:['idempotencyKey'],additionalProperties:false}},
  ]
  return Object.freeze({
    list:()=>enabled()===true?structuredClone(definitions):[],
    async call(actor,name,args){
      if(enabled()!==true)fail('needs_review_disabled')
      if(!definitions.some(d=>d.name===name))fail('unknown_tool')
      const scopes=name==='crm_needs_review_batch_confirm'?send:name==='crm_needs_review_email_confirm'||name==='crm_needs_review_followup_confirm'||name==='crm_needs_review_reply_confirm'?one:common
      if(binding?.grantFamily!==undefined)fail('needs_review_grant_family_must_come_from_connection')
      if(actor?.kind!=='oauth'||['ownerId','fromIdentity','accessRevision'].some(k=>actor[k]!==binding[k])||
        !FAMILY.test(actor?.grantFamily||'')||!Array.isArray(actor.scopes)||!scopes.every(s=>actor.scopes.includes(s)))fail('needs_review_access_denied')
      if(name==='crm_needs_review_batch_confirm'&&startsEnabled()!==true)fail('capability_starts_paused')
      const bound={...binding,grantFamily:actor.grantFamily,authorized:true}
      if(NEEDS_REVIEW_SINGLE_TOOLS.includes(name)){
        if(typeof openIndividual!=='function')fail('needs_review_connection_not_bound')
        const workflow=openIndividual(bound)
        if(name==='crm_needs_review_email_preview'){
          fields(args,['leadId','to','fromIdentity','scheduledLocal','utcOffset'],['leadId','to','fromIdentity'])
          if(args.fromIdentity!==binding.fromIdentity)fail('needs_review_single_message_only')
          closedSchedule(args,scheduleEnabled)
          return workflow.preview(actor,args)
        }
        if(name==='crm_needs_review_email_confirm'){
          if(singleSendEnabled()!==true)fail('needs_review_single_send_paused')
          fields(args,['reviewId','digest','idempotencyKey','confirmed'])
          return workflow.confirm(actor,args)
        }
        fields(args,['idempotencyKey'])
        return workflow.status(actor,args)
      }
      if(name==='crm_needs_review_followup_preview'||name==='crm_needs_review_followup_confirm'){
        if(typeof openIndividual!=='function')fail('needs_review_connection_not_bound')
        const workflow=openIndividual(bound)
        if(name==='crm_needs_review_followup_preview'){
          fields(args,['leadId','to','fromIdentity','messageIntentId','subject','body','scheduledLocal','utcOffset'],['leadId','to','fromIdentity','messageIntentId','subject','body'])
          if(args.fromIdentity!==binding.fromIdentity)fail('needs_review_single_message_only')
          closedSchedule(args,scheduleEnabled)
          return workflow.preview(actor,{...args,kind:'followup'})
        }
        fields(args,['reviewId','digest','idempotencyKey','confirmed'])
        if(args.confirmed!==true||!/^[a-f0-9]{64}$/.test(args.digest||''))fail('invalid_confirmation')
        if(singleSendEnabled()!==true)fail('needs_review_single_send_paused')
        return workflow.confirm(actor,args)
      }
      if(name==='crm_needs_review_reply_list'||name==='crm_needs_review_reply_preview'||name==='crm_needs_review_reply_confirm'||name==='crm_needs_review_reply_status'){
        if(typeof openIndividual!=='function')fail('needs_review_connection_not_bound')
        const workflow=openIndividual(bound)
        if(name==='crm_needs_review_reply_list'){
          const empty=args&&typeof args==='object'&&!Array.isArray(args)?args:{}
          fields(empty,['from','to','beforeOccurredAt','beforeId'],[])
          return workflow.replies(actor,empty)
        }
        if(name==='crm_needs_review_reply_preview'){
          fields(args,['leadId','to','fromIdentity','messageIntentId','subject','body','inReplyTo','references'],['leadId','to','fromIdentity','messageIntentId','subject','body','inReplyTo'])
          if(args.fromIdentity!==binding.fromIdentity)fail('needs_review_single_message_only')
          const review=await workflow.preview(actor,{...args,kind:'followup'})
          return {reviewId:review.id,digest:review.digest,expiresAt:review.expiresAt,recipient:review.snapshot.to,subject:review.snapshot.subject,
            content:review.snapshot.text,body:review.snapshot.body,inReplyTo:review.snapshot.inReplyTo,references:review.snapshot.references||'',
            requiresExplicitConfirmation:true,status:'review',sent:false}
        }
        if(name==='crm_needs_review_reply_confirm'){
          fields(args,['reviewId','digest','idempotencyKey','confirmed'])
          if(args.confirmed!==true||!/^[a-f0-9]{64}$/.test(args.digest||''))fail('invalid_confirmation')
          if(singleSendEnabled()!==true)fail('needs_review_single_send_paused')
          return workflow.confirm(actor,args)
        }
        fields(args,['idempotencyKey'])
        const job=await workflow.status(actor,args)
        const known=['queued','sending','sent','unknown','blocked','cancelled','not_found']
        if(!known.includes(job?.status))return {status:'unreliable',retry:false}
        return {status:job.status,error:job.error||null,warning:job.status==='sending'?'delivery_in_progress_or_unknown_do_not_retry':job.warning||null,retry:false}
      }
      if(name==='crm_needs_review_contact_preview'||name==='crm_needs_review_contact_confirm'){
        const contactArgs=['companyName','contactName','email','subject','body','timezone','tags']
        if(name==='crm_needs_review_contact_preview'){
          fields(args,contactArgs,['email'])
          const draft=prepareContactCreate(args)
          return {digest:draft.digest,contact:{companyName:draft.companyName,contactName:draft.contactName,email:draft.email,subject:draft.subject,body:draft.body,timezone:draft.timezone,tags:draft.tags},emailAction:'none',requiresExplicitConfirmation:true}
        }
        fields(args,[...contactArgs,'digest','idempotencyKey','confirmed'],['email','digest','idempotencyKey','confirmed'])
        const draft=prepareContactCreate(Object.fromEntries(contactArgs.filter(key=>args[key]!==undefined).map(key=>[key,args[key]])))
        const decision=confirmContactCreate(args,draft)
        if(typeof openContacts!=='function')fail('needs_review_connection_not_bound')
        const saved=await openContacts(bound).create(decision.contact,decision.idempotencyKey)
        return {leadId:saved?.leadId||null,replayed:saved?.replayed===true,emailAction:'none',digest:draft.digest}
      }
      if(typeof openStore!=='function')fail('needs_review_connection_not_bound')
      const store=openStore(bound)
      if(name==='crm_needs_review_batch_preview'){
        fields(args,['localDate'])
        const review=await store.review(bound,args)
        const messages=(review.plan?.items||[]).map(item=>({leadId:item.snapshot.leadId,to:item.snapshot.to,subject:item.snapshot.subject,body:item.snapshot.body,text:item.snapshot.text}))
        return {reviewId:review.reviewId,digest:review.digest,expiresAt:review.expiresAt,count:messages.length,messages,
          fromIdentity:review.plan.fromIdentity,localDate:review.plan.needsReview.localDate,
          minimumIntervalSeconds:BATCH_POLICY.minimumGapMs/1000,recipientLocalWindow:windowLabel,maxAttempts:BATCH_POLICY.maxAttempts,
          scheduleGated:scheduleEnabled()!==true,requiresFiniteConfirmation:true,excludedCount:review.excluded.length,excluded:review.excluded}
      }
      if(name==='crm_needs_review_batch_confirm'){
        if(startsEnabled()!==true)fail('capability_starts_paused')
        fields(args,['reviewId','digest','confirmed']);return store.confirm(bound,args)
      }
      if(name==='crm_needs_review_confirmation_status'){
        fields(args,['reviewId','digest']);return store.confirmationStatus(bound,args)
      }
      fields(args,['batchId']);return store.status(bound,args.batchId)
    },
  })
}
