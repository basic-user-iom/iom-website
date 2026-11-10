import {fields,fail,planApprovedSend} from './crm-email-workflow.mjs'
import {retainPrivateAttachments} from './crm-needs-review-attachments.mjs'
import {BATCH_POLICY,groupWindowLabel} from './crm-email-batch-policy.mjs'
import {confirmContactCreate,prepareContactCreate} from './crm-contact-approval.mjs'

// Registration remains the host's explicit responsibility. No send/worker tool:
// the authenticated host worker invokes the separately supplied dispatcher.
const FAMILY=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const EXPLICIT=Object.freeze(['crm_needs_review_email_preview','crm_needs_review_email_confirm','crm_needs_review_email_status',
  'crm_needs_review_followup_preview','crm_needs_review_followup_confirm','crm_needs_review_contact_preview','crm_needs_review_contact_confirm',
  'crm_needs_review_contact_find','crm_needs_review_approved_send',
  'crm_needs_review_reply_list','crm_needs_review_reply_preview','crm_needs_review_reply_confirm','crm_needs_review_reply_status',
  'crm_needs_review_address_preview','crm_needs_review_address_confirm',
  'crm_needs_review_correspondence_open'])
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
export function createNeedsReviewTools({binding,enabled=()=>false,startsEnabled=()=>false,openStore,openIndividual,openContacts,attachmentStore=null,singleSendEnabled=needsReviewSingleSendEnabled,scheduleEnabled=needsReviewScheduleEnabled}={}){
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
      inputSchema:{type:'object',properties:{leadId:{type:'string',format:'uuid'},to:{type:'string',maxLength:320},fromIdentity:{type:'string',enum:['projects','visual']},scheduledLocal:{type:'string'},utcOffset:{type:'string',enum:['+01:00','+02:00']}},required:['leadId','to','fromIdentity'],additionalProperties:false}},
    {name:'crm_needs_review_email_confirm',description:'Send the exact reviewed message only after explicit confirmation of its review id and digest. Reuse the same idempotency key after an interruption. An unknown outcome is not retried. A scheduled confirmation stays closed until schedule approval.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},idempotencyKey:{type:'string',minLength:8,maxLength:120},confirmed:{type:'boolean',const:true}},required:['reviewId','digest','idempotencyKey','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_email_status',description:'Read the status of one confirmed message by its idempotency key. Does not send, retry, or resume an uncertain delivery.',
      inputSchema:{type:'object',properties:{idempotencyKey:{type:'string',minLength:8,maxLength:120}},required:['idempotencyKey'],additionalProperties:false}},
    {name:'crm_needs_review_followup_preview',description:'Review one follow-up to an existing contact. Shows the final recipient, subject and content. Sends nothing and does not schedule while schedule approval is closed.',
      inputSchema:{type:'object',properties:{leadId:{type:'string',format:'uuid'},to:{type:'string',maxLength:320},fromIdentity:{type:'string',enum:['projects','visual']},messageIntentId:{type:'string',format:'uuid'},subject:{type:'string',maxLength:300},body:{type:'string',maxLength:50000},scheduledLocal:{type:'string'},utcOffset:{type:'string',enum:['+01:00','+02:00']}},required:['leadId','to','fromIdentity','messageIntentId','subject','body'],additionalProperties:false}},
    {name:'crm_needs_review_followup_confirm',description:'Send one reviewed follow-up only after explicit confirmation of its review id and digest. Uses its own idempotency key. An unknown outcome is not retried. Does not open group sending.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},idempotencyKey:{type:'string',minLength:8,maxLength:120},confirmed:{type:'boolean',const:true}},required:['reviewId','digest','idempotencyKey','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_contact_preview',description:'Review a new contact. Shows the name, address and optional draft. identity is projects or visual; an omitted identity stays on projects. Sends nothing and does not insert the contact.',
      inputSchema:{type:'object',properties:{companyName:{type:'string',maxLength:2000},contactName:{type:'string',maxLength:2000},email:{type:'string',maxLength:320},subject:{type:'string',maxLength:300},body:{type:'string',maxLength:50000},timezone:{type:'string',maxLength:80},tags:{type:'array',items:{type:'string',maxLength:40}},identity:{type:'string',enum:['projects','visual']}},required:['email'],additionalProperties:false}},
    {name:'crm_needs_review_contact_confirm',description:'Insert one reviewed contact only after explicit confirmation of its digest. identity must match the preview. A projects contact stays on the projects owner and a visual contact stays on the visual owner. Does not send mail. Creating a contact and sending mail remain separate confirmations.',
      inputSchema:{type:'object',properties:{companyName:{type:'string',maxLength:2000},contactName:{type:'string',maxLength:2000},email:{type:'string',maxLength:320},subject:{type:'string',maxLength:300},body:{type:'string',maxLength:50000},timezone:{type:'string',maxLength:80},tags:{type:'array',items:{type:'string',maxLength:40}},identity:{type:'string',enum:['projects','visual']},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},idempotencyKey:{type:'string',minLength:8,maxLength:120},confirmed:{type:'boolean',const:true}},required:['email','digest','idempotencyKey','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_reply_list',description:'Search stored incoming replies, newest page first (at most 400). identity projects or visual limits the list to that account. An omitted identity returns both accounts, and each reply names its own account. A visual reply is not listed as a projects reply. Filter by company, contact, email, subject, or period. A calendar date is a Europe/Belgrade day; period.to and to are exclusive for a timestamp. The stable page key is occurred_at then id. Pass cursor.beforeOccurredAt and cursor.beforeId, or next.beforeOccurredAt and next.beforeId, for the next older page. A newer message that arrives while paging stays on the first page and is not repeated. The result includes truncated, incomplete, and next. Answered means any stored outbound message is later than that reply. Older mail outside this stored page is not marked complete. Sends nothing and writes nothing.',
      inputSchema:{type:'object',properties:{
        company:{type:'string',maxLength:200,description:'Company name contains this text'},
        contact:{type:'string',maxLength:200,description:'Contact name contains this text'},
        email:{type:'string',maxLength:320,description:'Email address contains this text'},
        subject:{type:'string',maxLength:300,description:'Subject contains this text'},
        identity:{type:'string',enum:['projects','visual'],description:'Account that owns the contact. Omit to label both accounts.'},
        period:{type:'object',description:'Inclusive from and exclusive to. A calendar date is a Europe/Belgrade day.',properties:{from:{type:'string',maxLength:40},to:{type:'string',maxLength:40}},additionalProperties:false},
        cursor:{type:'object',description:'Older page. Stable key is occurred_at then id, newest first.',properties:{beforeOccurredAt:{type:'string',maxLength:40},beforeId:{type:'string',format:'uuid'}},additionalProperties:false},
        from:{type:'string',maxLength:40},to:{type:'string',maxLength:40},beforeOccurredAt:{type:'string',maxLength:40},beforeId:{type:'string',format:'uuid'},
      },additionalProperties:false}},
    {name:'crm_needs_review_correspondence_open',description:'Open one stored conversation and its contact card. Pass leadId, or company, contact, or email. If several contacts match, returns those cards and no messages until leadId is passed. Messages are chronological. The stable page key is occurred_at then id, oldest first; pass cursor.afterOccurredAt and cursor.afterId for the next newer page. Shows date, sender, recipient when a stored header has it, reply status, and attachment name, type, and size when that metadata is stored. Attachment bytes are marked unavailable. Mailbox history before the CRM sync is not claimed complete. Local time uses a stored IANA time zone only; an unknown zone is labeled unknown. Sends nothing and writes nothing.',
      inputSchema:{type:'object',properties:{
        leadId:{type:'string',format:'uuid'},
        company:{type:'string',maxLength:200,description:'Company name contains this text'},
        contact:{type:'string',maxLength:200,description:'Contact name contains this text'},
        email:{type:'string',maxLength:320,description:'Email address contains this text'},
        cursor:{type:'object',description:'Newer page. Stable key is occurred_at then id, oldest first.',properties:{afterOccurredAt:{type:'string',maxLength:40},afterId:{type:'string',format:'uuid'}},additionalProperties:false},
      },additionalProperties:false}},
    {name:'crm_needs_review_address_preview',description:'Prepare an edit of the additional addresses already stored on one contact. Shows the resulting list and checks duplicates on both accounts. Sends nothing and does not change the contact.',
      inputSchema:{type:'object',properties:{leadId:{type:'string',format:'uuid'},identity:{type:'string',enum:['projects','visual']},emails:{type:'array',maxItems:50,items:{type:'object',properties:{label:{type:'string',maxLength:80},email:{type:'string',maxLength:320}},required:['email'],additionalProperties:false}}},required:['leadId','emails'],additionalProperties:false}},
    {name:'crm_needs_review_address_confirm',description:'Confirm one additional-address edit. Requires the preview digest and its own key. Does not send mail. A repeated key does not write a second change.',
      inputSchema:{type:'object',properties:{leadId:{type:'string',format:'uuid'},identity:{type:'string',enum:['projects','visual']},emails:{type:'array',maxItems:50,items:{type:'object',properties:{label:{type:'string',maxLength:80},email:{type:'string',maxLength:320}},required:['email'],additionalProperties:false}},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},idempotencyKey:{type:'string',minLength:8,maxLength:120},confirmed:{type:'boolean',const:true}},required:['leadId','emails','digest','idempotencyKey','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_reply_preview',description:'Prepare one reply in an existing stored thread. Shows the card addresses, the stored message From address, the recipient, subject, and final content. Sends nothing and does not schedule.',
      inputSchema:{type:'object',properties:{leadId:{type:'string',format:'uuid'},to:{type:'string',maxLength:320},fromIdentity:{type:'string',enum:['projects','visual']},messageIntentId:{type:'string',format:'uuid'},subject:{type:'string',maxLength:300},body:{type:'string',maxLength:50000},inReplyTo:{type:'string',maxLength:998},references:{type:'string',maxLength:8000}},required:['leadId','to','fromIdentity','messageIntentId','subject','body','inReplyTo'],additionalProperties:false}},
    {name:'crm_needs_review_reply_confirm',description:'Send the exact reviewed thread reply only after explicit confirmation of its review id and digest. Reuse the same idempotency key. An unknown outcome is reported and not retried. Does not open group sending.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},idempotencyKey:{type:'string',minLength:8,maxLength:120},confirmed:{type:'boolean',const:true}},required:['reviewId','digest','idempotencyKey','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_reply_status',description:'Read the real status of one confirmed thread reply by its idempotency key. Unknown or in-progress delivery is reported and not retried.',
      inputSchema:{type:'object',properties:{idempotencyKey:{type:'string',minLength:8,maxLength:120}},required:['idempotencyKey'],additionalProperties:false}},
    {name:'crm_needs_review_contact_find',description:'Find an existing contact by company, contact, or email on projects or visual. If the account is not given and both accounts match, asks which account. Sends nothing and inserts nothing.',
      inputSchema:{type:'object',properties:{company:{type:'string',maxLength:200},contact:{type:'string',maxLength:200},email:{type:'string',maxLength:320},identity:{type:'string',enum:['projects','visual']}},additionalProperties:false}},
    {name:'crm_needs_review_approved_send',description:`One explicit approval of this list and purpose. Queues each approved initial message for the campaign worker, including Under revision and Not contacted, or sends a clear reply or follow-up. No second per-message confirmation. Returns each recipient, the content, and status queued, sent, held, or unknown. The same intent key does not send again. Unknown is not retried. An unknown time zone is held and is not placed in ${windowLabel}. A requested clock time needs a stored IANA zone and is not scheduled in this approval. A payment, contract, or new obligation is not accepted.`,
      inputSchema:{type:'object',properties:{
        purpose:{type:'string',minLength:8,maxLength:500},
        confirmed:{type:'boolean',const:true},
        idempotencyKey:{type:'string',minLength:8,maxLength:40},
        localDate:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},
        allowReplySoon:{type:'boolean'},
        preview:{type:'boolean'},
        recipients:{type:'array',minItems:1,maxItems:200,items:{type:'object',properties:{
          leadId:{type:'string',format:'uuid'},to:{type:'string',maxLength:320},kind:{type:'string',enum:['initial','followup','reply']},
          identity:{type:'string',enum:['projects','visual']},
          subject:{type:'string',maxLength:300},body:{type:'string',maxLength:50000},messageIntentId:{type:'string',format:'uuid'},
          inReplyTo:{type:'string',maxLength:998},scheduledLocal:{type:'string',maxLength:40},
          attachments:{type:'array',maxItems:5,items:{type:'object',properties:{
            filename:{type:'string',maxLength:180},contentType:{type:'string',maxLength:160},size:{type:'integer',minimum:1},contentBase64:{type:'string'},
          },required:['filename','contentType','size'],additionalProperties:false}},
        },required:['leadId','to','kind','subject','body'],additionalProperties:false}},
      },required:['purpose','idempotencyKey','recipients'],additionalProperties:false}},
  ]
  return Object.freeze({
    list:()=>enabled()===true?structuredClone(definitions):[],
    async call(actor,name,args){
      if(enabled()!==true)fail('needs_review_disabled')
      if(!definitions.some(d=>d.name===name))fail('unknown_tool')
      const scopes=name==='crm_needs_review_batch_confirm'||name==='crm_needs_review_approved_send'?send:name==='crm_needs_review_email_confirm'||name==='crm_needs_review_followup_confirm'||name==='crm_needs_review_reply_confirm'?one:common
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
          if(args.fromIdentity!=='projects'&&args.fromIdentity!=='visual')fail('identity_required')
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
          if(args.fromIdentity!=='projects'&&args.fromIdentity!=='visual')fail('identity_required')
          closedSchedule(args,scheduleEnabled)
          return workflow.preview(actor,{...args,kind:'followup'})
        }
        fields(args,['reviewId','digest','idempotencyKey','confirmed'])
        if(args.confirmed!==true||!/^[a-f0-9]{64}$/.test(args.digest||''))fail('invalid_confirmation')
        if(singleSendEnabled()!==true)fail('needs_review_single_send_paused')
        return workflow.confirm(actor,args)
      }
      if(name==='crm_needs_review_correspondence_open'){
        if(typeof openIndividual!=='function')fail('needs_review_connection_not_bound')
        const workflow=openIndividual(bound)
        const read=args&&typeof args==='object'&&!Array.isArray(args)?args:{}
        fields(read,['leadId','company','contact','email','cursor','identity'],[])
        return workflow.correspondence(actor,read)
      }
      if(name==='crm_needs_review_reply_list'||name==='crm_needs_review_reply_preview'||name==='crm_needs_review_reply_confirm'||name==='crm_needs_review_reply_status'){
        if(typeof openIndividual!=='function')fail('needs_review_connection_not_bound')
        const workflow=openIndividual(bound)
        if(name==='crm_needs_review_reply_list'){
          const empty=args&&typeof args==='object'&&!Array.isArray(args)?args:{}
          fields(empty,['from','to','beforeOccurredAt','beforeId','company','contact','email','subject','period','cursor','identity'],[])
          return workflow.replies(actor,empty)
        }
        if(name==='crm_needs_review_reply_preview'){
          fields(args,['leadId','to','fromIdentity','messageIntentId','subject','body','inReplyTo','references'],['leadId','to','fromIdentity','messageIntentId','subject','body','inReplyTo'])
          if(args.fromIdentity!=='projects'&&args.fromIdentity!=='visual')fail('identity_required')
          const review=await workflow.preview(actor,{...args,kind:'followup'})
          return {reviewId:review.id,digest:review.digest,expiresAt:review.expiresAt,recipient:review.snapshot.to,subject:review.snapshot.subject,
            content:review.snapshot.text,body:review.snapshot.body,inReplyTo:review.snapshot.inReplyTo,references:review.snapshot.references||'',
            fromIdentity:review.snapshot.fromIdentity,leadOwnerId:review.snapshot.leadOwnerId||null,
            addresses:review.addresses||null,requiresExplicitConfirmation:true,status:'review',sent:false}
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
      if(name==='crm_needs_review_address_preview'||name==='crm_needs_review_address_confirm'){
        if(typeof openIndividual!=='function')fail('needs_review_connection_not_bound')
        const workflow=openIndividual(bound)
        if(name==='crm_needs_review_address_preview'){
          fields(args,['leadId','identity','emails'],['leadId','emails'])
          return workflow.addressPreview(actor,args)
        }
        fields(args,['leadId','identity','emails','digest','idempotencyKey','confirmed'],['leadId','emails','digest','idempotencyKey','confirmed'])
        if(args.confirmed!==true)fail('invalid_confirmation')
        return workflow.addressConfirm(actor,args)
      }
      if(name==='crm_needs_review_contact_preview'||name==='crm_needs_review_contact_confirm'){
        const contactArgs=['companyName','contactName','email','subject','body','timezone','tags','identity']
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
        return {leadId:saved?.leadId||null,status:saved?.status||null,identity:saved?.identity||null,ownerId:saved?.ownerId||null,alreadyExists:saved?.alreadyExists===true,inserted:saved?.inserted===true,replayed:saved?.replayed===true,emailAction:'none',underRevision:saved?.underRevision===true,choiceRequired:saved?.choiceRequired===true,question:saved?.question||null,matches:Array.isArray(saved?.matches)?saved.matches:[],digest:draft.digest,error:saved?.error||null,cause:saved?.cause||null}
      }
      if(name==='crm_needs_review_contact_find'){
        if(typeof openIndividual!=='function')fail('needs_review_connection_not_bound')
        const workflow=openIndividual(bound)
        fields(args,['company','contact','email','identity'],[])
        return workflow.contacts(actor,args)
      }
      if(name==='crm_needs_review_approved_send'){
        if(typeof openIndividual!=='function'||typeof openStore!=='function')fail('needs_review_connection_not_bound')
        const previewOnly=args?.preview===true&&args?.confirmed!==true
        fields(args,['purpose','confirmed','idempotencyKey','localDate','allowReplySoon','recipients','preview'],previewOnly?['purpose','idempotencyKey','recipients']:['purpose','confirmed','idempotencyKey','recipients'])
        const workflow=openIndividual(bound)
        const leadIds=Array.isArray(args.recipients)?args.recipients.map(item=>item?.leadId).filter(Boolean):[]
        const loaded=await workflow.contactsForDispatch(actor,{leadIds})
        const plan=planApprovedSend(args,loaded?.leads||[])
        const expose=value=>{
          const recipients=(value.recipients||[]).map(item=>{
            const {attachmentPayload,...rest}=item
            return rest
          })
          return {...value,recipients,publicUrl:null}
        }
        if(previewOnly||plan.blocked)return expose({...plan,sent:false,perMessageConfirmRequired:false})
        const queued=plan.recipients.filter(item=>item.action==='queue')
        const sends=plan.recipients.filter(item=>item.action==='send')
        let batch=null
        if(queued.length){
          if(startsEnabled()!==true){
            for(const item of queued){item.status='capability_starts_paused';item.sent=false;item.retry=false}
          }else{
            const store=openStore(bound)
            let review
            try{review=await store.review(bound,{leadIds:queued.map(item=>item.leadId),localDate:args.localDate})}
            catch(error){
              if(error?.code!=='no_eligible_drafts')throw error
              for(const item of queued){item.status='held';item.reason='not_queued';item.sent=false;item.retry=false}
              review=null
            }
            if(review){
            const confirmed=await store.confirm(bound,{reviewId:review.reviewId,digest:review.digest,confirmed:true})
            batch={batchId:confirmed?.batchId||null,status:confirmed?.status||'queued',count:queued.length,replayed:confirmed?.replayed===true}
            const excluded=new Map((review.excluded||[]).map(row=>[row.leadId,row.reason||'held']))
            for(const item of queued){
              if(excluded.has(item.leadId)){item.status='held';item.reason=excluded.get(item.leadId)==='missing_or_invalid_recipient_timezone'?'unknown_zone':excluded.get(item.leadId);item.sent=false}
              else {item.status='queued';item.sent=false}
              item.retry=false
            }
            }
          }
        }
        let paused=false
        let immediate=0
        for(const item of sends){
          if(paused||immediate>=8){
            item.status=paused?'paused_after_unknown':'remainder_ready_for_new_preview'
            item.sent=false
            item.retry=false
            continue
          }
          if(item.attachments?.length){
            const retained=await retainPrivateAttachments(attachmentStore,{ownerId:actor.ownerId,messageId:item.idempotencyKey,files:item.attachmentPayload||[]})
            if(!retained.stored){
              item.status='held'
              item.reason=retained.reason||'private_store_not_approved'
              item.sent=false
              item.retry=false
              item.attachments=retained.links
              item.storageProposal=retained.proposal||null
              item.publicUrl=null
              continue
            }
            item.attachmentPayload=(item.attachmentPayload||[]).map((file,index)=>({...file,storageKey:retained.links[index].storageKey}))
            item.attachments=retained.links
            item.publicUrl=null
          }
          try{
            const result=await workflow.approvedSingle(actor,item)
            if(result?.status==='approval_changed'||result?.reason==='recipient_or_attachment_changed'){
              item.status='approval_changed'
              item.sent=false
              item.retry=false
              item.reason=result.reason||'recipient_or_attachment_changed'
              continue
            }
            if(result?.send===false||result?.reason==='duplicate_not_resent'||result?.reason==='unknown_not_retried'){
              item.status=result.reason==='unknown_not_retried'?'unknown':'duplicate_not_resent'
              item.sent=false
              item.retry=false
              item.reason=result.reason||null
              if(item.status==='unknown')paused=true
              continue
            }
            const status=result?.status==='sending'?'unknown':(result?.status||'unknown')
            item.status=status
            item.sent=status==='sent'
            item.retry=false
            item.reason=result?.error||null
            immediate+=1
            if(status==='unknown')paused=true
          }catch(error){
            item.status='unknown'
            item.sent=false
            item.retry=false
            item.reason=error?.code||'delivery_outcome_unknown_do_not_retry'
            paused=true
          }
        }
        const counts={
          queued:plan.recipients.filter(item=>item.status==='queued').length,
          sent:plan.recipients.filter(item=>item.status==='sent').length,
          held:plan.recipients.filter(item=>item.status==='held'||item.status==='capability_starts_paused').length,
          failed:plan.recipients.filter(item=>item.status==='unknown'||item.status==='not_sent').length,
          waiting:plan.recipients.filter(item=>item.status==='paused_after_unknown'||item.status==='remainder_ready_for_new_preview'||item.status==='capability_starts_paused').length,
        }
        return expose({...plan,batch,sent:counts.sent>0,perMessageConfirmRequired:false,counts:{...plan.counts,...counts}})
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
