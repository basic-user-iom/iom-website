import {fields,fail} from './crm-email-workflow.mjs'

// Registration remains the host's explicit responsibility. No send/worker tool:
// the authenticated host worker invokes the separately supplied dispatcher.
export function createNeedsReviewTools({store,binding,enabled=()=>false,startsEnabled=()=>false}={}){
  const common=['iom:crm:email:read'],send=[...common,'iom:crm:email:send','iom:crm:email:batch:confirm']
  const definitions=[
    {name:'crm_needs_review_batch_preview',description:'Prepare a finite list of up to 150 existing Needs review initial drafts for an explicit recipient-local date; minimum 30 seconds, only 07:45–11:00. Sends nothing. No individual message approval required.',
      inputSchema:{type:'object',properties:{localDate:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}},required:['localDate'],additionalProperties:false}},
    {name:'crm_needs_review_batch_confirm',description:'Confirm the exact finite manifest once. Requires explicit group authorization. Reserves existing shared jobs for the separately authorized worker; no immediate delivery. Stops at the approved list, never adds another 50.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},confirmed:{type:'boolean',const:true}},required:['reviewId','digest','confirmed'],additionalProperties:false}},
    {name:'crm_needs_review_batch_status',description:'Read counts and paused, expired or complete state for this authorized owner/sender. Does not retry or resume an uncertain delivery.',
      inputSchema:{type:'object',properties:{batchId:{type:'string',format:'uuid'}},required:['batchId'],additionalProperties:false}},
    {name:'crm_needs_review_confirmation_status',description:'Reconcile a slow or lost confirmation response using the exact original review ID and digest. Never create a replacement group or retry automatically.',
      inputSchema:{type:'object',properties:{reviewId:{type:'string',format:'uuid'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'}},required:['reviewId','digest'],additionalProperties:false}},
  ]
  return Object.freeze({
    list:()=>enabled()===true?structuredClone(definitions):[],
    async call(actor,name,args){
      if(enabled()!==true)fail('needs_review_disabled')
      if(!definitions.some(d=>d.name===name))fail('unknown_tool')
      const scopes=name==='crm_needs_review_batch_confirm'?send:common
      if(actor?.kind!=='oauth'||['ownerId','fromIdentity','grantFamily','accessRevision'].some(k=>actor[k]!==binding[k])||
        !Array.isArray(actor.scopes)||!scopes.every(s=>actor.scopes.includes(s)))fail('needs_review_access_denied')
      if(name==='crm_needs_review_batch_preview'){
        fields(args,['localDate'])
        const review=await store.review(binding,args)
        return {reviewId:review.reviewId,digest:review.digest,expiresAt:review.expiresAt,count:review.plan.items.length,
          fromIdentity:review.plan.fromIdentity,localDate:review.plan.needsReview.localDate,
          minimumIntervalSeconds:30,recipientLocalWindow:'07:45–11:00',requiresFiniteConfirmation:true,excludedCount:review.excluded.length}
      }
      if(name==='crm_needs_review_batch_confirm'){
        if(startsEnabled()!==true)fail('capability_starts_paused')
        fields(args,['reviewId','digest','confirmed']);return store.confirm(binding,args)
      }
      if(name==='crm_needs_review_confirmation_status'){
        fields(args,['reviewId','digest']);return store.confirmationStatus(binding,args)
      }
      fields(args,['batchId']);return store.status(binding,args.batchId)
    },
  })
}
