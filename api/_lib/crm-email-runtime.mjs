import { createEmailWorkflow, fail } from './crm-email-workflow.mjs'
import { createEmailStore } from './crm-email-store.mjs'
import { createReviewedEmailProvider } from './crm-email-provider.mjs'
import { assertEmailStagingTarget, stagingIdentities, fakeProviderDependencies } from './crm-email-staging.mjs'

export const EMAIL_SCOPES = Object.freeze({review:'iom:crm:email:read',send:'iom:crm:email:send',schedule:'iom:crm:email:schedule',cancel:'iom:crm:email:cancel'})
export const deliveryEnabled = (env=process.env) => env.CRM_EMAIL_DELIVERY_ENABLED==='true'
export function createEmailAuthorizer(store,ownerId,now=Date.now) {
  return async (actor,action) => {
    if(actor.ownerId!==ownerId || !(await store.staffActive(ownerId))) return false
    if(actor.kind==='worker') return action==='worker'
    if(actor.kind==='staff') return true // Only constructed after existing staff JWT + MFA verification.
    if(actor.kind!=='oauth' || !actor.grantFamily) return false
    const grant=await store.grant(ownerId,actor.grantFamily)
    const required=[EMAIL_SCOPES.review,EMAIL_SCOPES[action]]
    return !!grant && !grant.revoked_at && +new Date(grant.expires_at)>now() &&
      required.every(s=>s && actor.scopes?.includes(s) && grant.scopes?.includes(s))
  }
}
export function createEmailRuntime({store,ownerId,identities=stagingIdentities,enabled=()=>false,now=Date.now,providerDependencies,beforeDelivery,authorizeAction=()=>true,validateSchedule}) {
  const baseAuthorize=createEmailAuthorizer(store,ownerId,now)
  const authorize=async(actor,action)=>await authorizeAction(actor,action) && await baseAuthorize(actor,action)
  const send=createReviewedEmailProvider({...fakeProviderDependencies(identities),...providerDependencies,
    beginDelivery:async(snapshot,context)=>{await beforeDelivery?.(snapshot,context);return store.beginDelivery(context.ownerId,context.jobId,snapshot)}})
  const workflow=createEmailWorkflow({store,identities,send,authorize,enabled,now,validateSchedule})
  return {workflow,store,ownerId,authorize,rateLimit:(bucket,max,windowMs)=>store.rateLimit(ownerId,bucket,max,windowMs),
    async runDue() {
      const results=await workflow.runDue({ownerId,kind:'worker'})
      const held=(await store.legacySchedules(ownerId)).map(row=>({id:row.id,status:'blocked',error:'legacy_schedule_requires_review',scheduled_send:row.scheduled_send}))
      return {ok:true,processed:results.length,due:results.length+held.length,sent:results.filter(x=>x.status==='sent').length,
        failed:results.filter(x=>x.status!=='sent').length+held.length,results,heldLegacySchedules:held}
    },
  }
}
let runtime,pool
export async function getEmailRuntime() {
  if(!deliveryEnabled()) fail('email_workflow_disabled')
  const {connection,supabaseUrl}=assertEmailStagingTarget()
  if(runtime) return runtime
  const env=process.env
  const ownerId=env.CRM_EMAIL_OWNER_ID
  if(!/^[a-f0-9-]{36}$/i.test(ownerId || '')) fail('email_owner_not_configured')
  for(const key of ['sslmode','sslcert','sslkey','sslrootcert']) connection.searchParams.delete(key)
  if(!pool) {
    const {Pool}=await import('pg')
    pool=new Pool({connectionString:connection.toString(),max:4,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,
      ssl:{rejectUnauthorized:true,...(env.CRM_EMAIL_DATABASE_CA?{ca:env.CRM_EMAIL_DATABASE_CA}:{})}})
    pool.on('error',()=>{})
  }
  const store=createEmailStore(()=>pool.connect())
  if(!(await store.binding(ownerId,supabaseUrl))) fail('email_target_binding_mismatch')
  runtime=createEmailRuntime({store,ownerId,identities:stagingIdentities,enabled:deliveryEnabled,providerDependencies:fakeProviderDependencies()})
  return runtime
}
