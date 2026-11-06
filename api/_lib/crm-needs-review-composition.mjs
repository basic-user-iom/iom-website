import {createNeedsReviewPostgresStore} from './crm-needs-review-postgres.mjs'
import {createCrmBatchDispatcher} from './crm-capability-dispatcher.mjs'
import {recipientWindow} from './crm-email-batch-policy.mjs'
import {createNeedsReviewTools} from './crm-needs-review-tools.mjs'

// Host integration point ONLY. No route/cron/credentials/configuration changes.
// Existing worker verifier and explicit server-owned binding are required.
export function createNeedsReviewComposition({acquire,binding,enabled=()=>false,startsEnabled=()=>false,
  authorizeWorker,resolveBinding,providerDependencies,workerEnabled=()=>false,
  workerScheduleAllowed=()=>false,now=Date.now}={}){
  const store=createNeedsReviewPostgresStore({acquire,binding,enabled})
  const dispatcher=createCrmBatchDispatcher({enabled,startsEnabled,workerEnabled,workerScheduleAllowed,store,
    authorizeWorker,resolveBinding,targets:[{ownerId:binding.ownerId,fromIdentity:binding.fromIdentity}],now,
    providerDependenciesFor:()=>providerDependencies,
    validateHandoff:(claim,at)=>at<Date.parse(claim.authorizationExpiresAt)&&
      recipientWindow(claim.localDate,claim.recipientTimeZone,at)==='open'})
  const tools=createNeedsReviewTools({store,binding,enabled,startsEnabled})
  return Object.freeze({store,dispatcher,tools})
}
