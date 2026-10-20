import {isProtectedEmailTarget,getProductionEmailRuntime} from './crm-email-production.mjs'
import {fail} from './crm-email-workflow.mjs'
import {isStaffPairAccount} from './crm-email-staff-pair.mjs'

export async function routeReviewedLegacyEmail(input,actor,{protect=isProtectedEmailTarget,runtime=getProductionEmailRuntime}={}) {
  // Immediate browser route only; shared scheduler classification stays unchanged.
  // Revocation/feature pause must never reopen either login's direct sender.
  if(actor?.kind==='staff' && isStaffPairAccount(actor.ownerId))
    fail('email_explicit_review_required')
  if(!protect(input))return null
  const service=await runtime() // Any failure is terminal. NEVER fall back to SMTP.
  if(actor?.kind!=='staff' || actor.ownerId!==service.ownerId) fail('email_access_denied')
  if(!await service.rateLimit('staff',30,60000))fail('rate_limited')
  const job=await service.workflow.sendLegacy(actor,input)
  if(job.status!=='sent') fail(job.error||'delivery_in_progress_or_unknown_do_not_retry')
  return {ok:true,messageId:job.messageId,storedMessageId:job.storedMessageId,persistWarning:null,
    from:job.snapshot.from,fromIdentity:job.snapshot.fromIdentity,to:job.snapshot.to,simulated:job.simulated===true}
}
export function rejectProtectedLegacySchedule(input,protect=isProtectedEmailTarget) {
  if(protect(input))fail('email_pilot_schedule_requires_review')
}
export async function runReviewedEmailQueue({runtime=getProductionEmailRuntime}={}) {
  // Disabled defaults never affect existing cron. A pinned pilot remains blocked
  // in legacy routes even when these flags are switched off for rollback.
  if(process.env.CRM_EMAIL_PRODUCTION_ENABLED!=='true' || process.env.CRM_EMAIL_SEND_ENABLED!=='true')return null
  return (await runtime()).runDue()
}
