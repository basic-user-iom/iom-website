import {fields,fail} from './crm-email-workflow.mjs'

// Registration remains the host's explicit responsibility. No send/worker tool:
// the authenticated host worker invokes the separately supplied dispatcher.
const FAMILY=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export const NEEDS_REVIEW_SINGLE_TOOLS=Object.freeze(['crm_needs_review_email_preview','crm_needs_review_email_confirm','crm_needs_review_email_status'])
export function needsReviewSingleSendEnabled(env=process.env){return env?.CRM_NEEDS_REVIEW_SINGLE_SEND_ENABLED==='true'}
export function needsReviewSingleSendView(env,allowed){
  return new Proxy(env,{get(target,prop,receiver){
    if(prop==='CRM_EMAIL_SEND_ENABLED')return allowed()===true?'true':'false'
    return Reflect.get(target,prop,receiver)
  }})
}
export function needsReviewToolFailure(name,error){
  return NEEDS_REVIEW_SINGLE_TOOLS.includes(name)?(error?.code||'needs_review_single_send_failed'):'needs_review_request_failed_check_confirmation_status'
}
export function createNeedsReviewTools({binding,enabled=()=>false,startsEnabled=()=>false,openStore,openIndividual,singleSendEnabled=needsReviewSingleSendEnabled}={}){
  const common=['iom:crm:email:read'],send=[...common,'iom:crm:email:send','iom:crm:email:batch:confirm'],one=[...common,'iom:crm:email:send']
  const definitions=[
    {name:'crm_needs_review_batch_preview',description:'Prepare a finite list of up to 150 existing Needs review initial drafts for an explicit recipient-local date; minimum 30 seconds, only 07:45–11:00. Sends nothing. No individual message approval required.',
      inputSchema:{type:'object',properties:{localDate:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}},required:['localDate'],additionalProperties:false}},
    {name:'crm_needs_review_batch_confirm',description:'Confirm the exact finite manifest once. Requires explicit group authorization. Reserves existing shared jobs for the separately authorized worker; no immediate delivery. Stops at the approved list, never adds another 50.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},confirmed:{type:'boolean',const:true}},required:['reviewId','digest','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_batch_status',description:'Read counts and paused, expired or complete state for this authorized owner/sender. Does not retry or resume an uncertain delivery.',
      inputSchema:{type:'object',properties:{batchId:{type:'string',format:'uuid'}},required:['batchId'],additionalProperties:false}},
    {name:'crm_needs_review_confirmation_status',description:'Reconcile a slow or lost confirmation response using the exact original review ID and digest. Never create a replacement group or retry automatically.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'}},required:['reviewId','digest'],additionalProperties:false}},
    {name:'crm_needs_review_email_preview',description:'Review one existing initial draft and one recipient already stored on that contact. Shows the final sender, subject and rendered content. Sends nothing and does not schedule.',
      inputSchema:{type:'object',properties:{leadId:{type:'string',format:'uuid'},to:{type:'string',maxLength:320},fromIdentity:{type:'string',enum:['projects']}},required:['leadId','to','fromIdentity'],additionalProperties:false}},
    {name:'crm_needs_review_email_confirm',description:'Send the exact reviewed message only after explicit confirmation of its review id and digest. Reuse the same idempotency key after an interruption. An unknown outcome is not retried.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},idempotencyKey:{type:'string',minLength:8,maxLength:120},confirmed:{type:'boolean',const:true}},required:['reviewId','digest','idempotencyKey','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_email_status',description:'Read the status of one confirmed message by its idempotency key. Does not send, retry, or resume an uncertain delivery.',
      inputSchema:{type:'object',properties:{idempotencyKey:{type:'string',minLength:8,maxLength:120}},required:['idempotencyKey'],additionalProperties:false}},
  ]
  return Object.freeze({
    list:()=>enabled()===true?structuredClone(definitions):[],
    async call(actor,name,args){
      if(enabled()!==true)fail('needs_review_disabled')
      if(!definitions.some(d=>d.name===name))fail('unknown_tool')
      const scopes=name==='crm_needs_review_batch_confirm'?send:name==='crm_needs_review_email_confirm'?one:common
      if(binding?.grantFamily!==undefined)fail('needs_review_grant_family_must_come_from_connection')
      if(actor?.kind!=='oauth'||['ownerId','fromIdentity','accessRevision'].some(k=>actor[k]!==binding[k])||
        !FAMILY.test(actor?.grantFamily||'')||!Array.isArray(actor.scopes)||!scopes.every(s=>actor.scopes.includes(s)))fail('needs_review_access_denied')
      if(name==='crm_needs_review_batch_confirm'&&startsEnabled()!==true)fail('capability_starts_paused')
      const bound={...binding,grantFamily:actor.grantFamily,authorized:true}
      if(NEEDS_REVIEW_SINGLE_TOOLS.includes(name)){
        if(typeof openIndividual!=='function')fail('needs_review_connection_not_bound')
        const workflow=openIndividual(bound)
        if(name==='crm_needs_review_email_preview'){
          fields(args,['leadId','to','fromIdentity'])
          if(args.fromIdentity!==binding.fromIdentity)fail('needs_review_single_message_only')
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
      if(typeof openStore!=='function')fail('needs_review_connection_not_bound')
      const store=openStore(bound)
      if(name==='crm_needs_review_batch_preview'){
        fields(args,['localDate'])
        const review=await store.review(bound,args)
        return {reviewId:review.reviewId,digest:review.digest,expiresAt:review.expiresAt,count:review.plan.items.length,
          fromIdentity:review.plan.fromIdentity,localDate:review.plan.needsReview.localDate,
          minimumIntervalSeconds:30,recipientLocalWindow:'07:45–11:00',requiresFiniteConfirmation:true,excludedCount:review.excluded.length}
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
