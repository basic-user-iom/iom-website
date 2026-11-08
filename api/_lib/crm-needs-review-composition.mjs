import {createNeedsReviewPostgresStore} from './crm-needs-review-postgres.mjs'
import {createCrmBatchDispatcher} from './crm-capability-dispatcher.mjs'
import {recipientWindow} from './crm-email-batch-policy.mjs'
import {createNeedsReviewTools} from './crm-needs-review-tools.mjs'
import {fail} from './crm-email-workflow.mjs'

// Host integration point ONLY. No route/cron/credentials/configuration changes.
// The grant family arrives with the authenticated connection, never in the pin.
export function createNeedsReviewComposition({acquire,binding,enabled=()=>false,startsEnabled=()=>false,
  authorizeWorker,resolveBinding,providerDependencies,workerEnabled=()=>false,
  workerScheduleAllowed=()=>false,now=Date.now}={}){
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
  const tools=createNeedsReviewTools({binding,enabled,startsEnabled,openStore})
  return Object.freeze({store,dispatcher,tools})
}
