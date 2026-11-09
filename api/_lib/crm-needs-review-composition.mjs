import {createNeedsReviewPostgresStore} from './crm-needs-review-postgres.mjs'
import {createEmailStore} from './crm-needs-review-receipts.mjs'
import {createCrmBatchDispatcher} from './crm-capability-dispatcher.mjs'
import {recipientWindow} from './crm-email-batch-policy.mjs'
import {createNeedsReviewTools,needsReviewScheduleEnabled,needsReviewSingleSendEnabled} from './crm-needs-review-tools.mjs'
import {createEmailRuntime} from './crm-email-runtime.mjs'
import {fail} from './crm-email-workflow.mjs'

// Host integration point ONLY. No route/cron/credentials/configuration changes.
// The grant family arrives with the authenticated connection, never in the pin.
export function createNeedsReviewComposition({acquire,binding,enabled=()=>false,startsEnabled=()=>false,
  authorizeWorker,resolveBinding,providerDependencies,workerEnabled=()=>false,
  workerScheduleAllowed=()=>false,now=Date.now,singleMail,singleSendEnabled=needsReviewSingleSendEnabled,scheduleEnabled=needsReviewScheduleEnabled}={}){
  if(binding?.grantFamily!==undefined) fail('needs_review_grant_family_must_come_from_connection')
  const openStore=bound=>createNeedsReviewPostgresStore({acquire,binding:bound,enabled})
  const store={
    listDueBatches(){fail('capability_worker_paused')},
    claimBatch(){fail('capability_worker_paused')},
  }
  const dispatcher=createCrmBatchDispatcher({enabled,startsEnabled,workerEnabled,workerScheduleAllowed,store,
    authorizeWorker,resolveBinding,targets:[{ownerId:binding.ownerId,fromIdentity:binding.fromIdentity}],now,
    providerDependenciesFor:()=>providerDependencies,
    validateHandoff:(claim,at)=>at<Date.parse(claim.authorizationExpiresAt)&&
      recipientWindow(claim.localDate,claim.recipientTimeZone,at)==='open'})
  const openIndividual=bound=>createEmailRuntime({
    store:createEmailStore(acquire,{requireContactApproval:true,capabilityBinding:bound,capabilityStartsEnabled:()=>false,capabilityScheduleEnabled:scheduleEnabled}),
    ownerId:binding.ownerId,identities:()=>singleMail.identities(),enabled,now,providerDependencies:singleMail,
    authorizeAction:async(actor,action)=>{
      if(actor?.kind!=='oauth'||actor.ownerId!==binding.ownerId||actor.fromIdentity!==binding.fromIdentity||actor.accessRevision!==binding.accessRevision)return false
      if(action==='review')return true
      if(action==='schedule')return scheduleEnabled()===true
      return action==='send'&&singleSendEnabled()===true
    },
  }).workflow
  const openContacts=bound=>({create:(contact,key)=>openStore(bound).createContact(bound,contact,key)})
  const tools=createNeedsReviewTools({binding,enabled,startsEnabled,openStore,openIndividual:singleMail?openIndividual:undefined,openContacts,singleSendEnabled,scheduleEnabled})
  return Object.freeze({store,dispatcher,tools})
}
