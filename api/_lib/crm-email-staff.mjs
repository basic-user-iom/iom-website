import {fail,fields} from './crm-email-workflow.mjs'
import {createEmailRuntime} from './crm-email-runtime.mjs'
import {EMAIL_REGULAR_APPROVAL,EMAIL_PRODUCTION_REF,assertProductionTarget,getProductionEmailRuntime} from './crm-email-production.mjs'
import {listProtonIdentities} from './proton-identities.js'
import {isStaffPairAccount} from './crm-email-staff-pair.mjs'

// Browser staff only. These identities confer no OAuth scope or scheduler rights.
export const STAFF_SENDERS=Object.freeze({
  contact:Object.freeze({ownerId:EMAIL_REGULAR_APPROVAL.ownerId,revision:'staff-contact-v1',
    fromIdentity:'contact',fromEmail:'contact@iobjectm.com',fromHeader:'IOM <contact@iobjectm.com>'}),
  projects:Object.freeze({...EMAIL_REGULAR_APPROVAL,revision:'staff-projects-v1'}),
  visual:Object.freeze({ownerId:EMAIL_REGULAR_APPROVAL.ownerId,revision:'staff-visual-v1',
    fromIdentity:'visual',fromEmail:'visual@iobjectm.com',fromHeader:'IOM Visual <visual@iobjectm.com>'}),
})
const senderFor=id=>Object.hasOwn(STAFF_SENDERS,id||'')?STAFF_SENDERS[id]:undefined
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export function createStaffSmtpDependencies({env,sender,identities=listProtonIdentities,createTransport}) {
  if(senderFor(sender?.fromIdentity)!==sender)fail('email_sender_binding_mismatch')
  const selected=()=>{
    const identity=identities().find(i=>i.id===sender.fromIdentity)
    if(!identity?.configured || identity.email!==sender.fromEmail || identity.fromHeader!==sender.fromHeader)fail('email_sender_binding_mismatch')
    return identity
  }
  return {simulated:false,resolveIdentity:async id=>id===sender.fromIdentity?selected():undefined,
    identities:()=>{const {id,email,fromHeader,configured}=selected();return [{id,email,fromHeader,configured}]},
    createTransport:()=>{
      assertProductionTarget(env)
      if(env.CRM_EMAIL_SEND_ENABLED!=='true'||env.CRM_EMAIL_STAFF_REVIEW_ENABLED!=='true')fail('email_delivery_paused')
      const identity=selected(),port=Number(env.PROTON_SMTP_PORT||587)
      if(!env.PROTON_SMTP_HOST || ![465,587].includes(port))fail('email_smtp_not_configured')
      return createTransport({host:env.PROTON_SMTP_HOST,port,secure:port===465,requireTLS:true,
        tls:{rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:30000,
        auth:{user:identity.user,pass:identity.pass}})
    }}
}
export function createStaffEmailRuntime({store,env,dependenciesFor,now=Date.now}) {
  const pairStore=store.forStaffPair(),flows=new Map()
  const binding=()=>store.regularBinding(EMAIL_REGULAR_APPROVAL,`https://${EMAIL_PRODUCTION_REF}.supabase.co`)
  const base=async(actor,action)=>{
    assertProductionTarget(env)
    return actor?.kind==='staff' && isStaffPairAccount(actor.ownerId) && actor.verifiedStaff===true && actor.aal==='aal2' &&
      env.CRM_EMAIL_STAFF_REVIEW_ENABLED==='true' && ['review','send'].includes(action) &&
      (action!=='send'||env.CRM_EMAIL_SEND_ENABLED==='true') && await binding() && await pairStore.staffActive(actor.ownerId)
  }
  const authorize=async(actor,action)=>{
    if(!await base(actor,action))return false
    for(const sender of Object.values(STAFF_SENDERS))
      if(await pairStore.staffBinding({...sender,ownerId:actor.ownerId},sender.revision))return true
    return false
  }
  const gate=async actor=>{if(!await authorize(actor,'review'))fail('email_access_denied')}
  const flowFor=(ownerId,id)=>{
    const sender=senderFor(id)
    if(!sender)fail('email_staff_sender_not_allowed')
    const key=ownerId+':'+id,actorSender={...sender,ownerId},senderStore=store.forStaffPair(id)
    if(!flows.has(key)){
      const scopedStore={...senderStore,lead:async(owner,leadId)=>{
        if(owner!==ownerId)fail('email_access_denied')
        const lead=await senderStore.lead(owner,leadId)
        if(lead?.scheduled_send)fail('legacy_schedule_requires_separate_review')
        return lead
      }}
      const dependencies=dependenciesFor(sender)
      const runtime=createEmailRuntime({store:scopedStore,ownerId,now,staffReviewMode:true,
        identities:dependencies.identities,providerDependencies:dependencies,
        enabled:()=>{assertProductionTarget(env);return true},
        authorizeAction:async(actor,action)=>actor.ownerId===ownerId && await base(actor,action) && await senderStore.staffBinding(actorSender,sender.revision),
        beforeDelivery:async(snapshot,context)=>{
          assertProductionTarget(env)
          if(env.CRM_EMAIL_STAFF_REVIEW_ENABLED!=='true'||env.CRM_EMAIL_SEND_ENABLED!=='true'||
            !await binding()||!await senderStore.staffBinding(actorSender,sender.revision))fail('email_access_denied')
          const job=await senderStore.get(context.ownerId,context.jobId)
          if(job?.authorization?.kind!=='staff'||job.authorization.accessRevision!==sender.revision||job.schedule ||
            snapshot.fromIdentity!==sender.fromIdentity||snapshot.from!==sender.fromEmail||snapshot.fromHeader!==sender.fromHeader ||
            !['initial','followup'].includes(snapshot.kind))fail('email_sender_binding_mismatch')
          await senderStore.assertStaffDelivery(context.ownerId,context.jobId,sender.revision)
        }})
      flows.set(key,runtime.workflow)
    }
    return {flow:flows.get(key),bound:actor=>({...actor,accessRevision:sender.revision})}
  }
  return {authorize,rateLimit:(bucket,max,window,actor)=>isStaffPairAccount(actor?.ownerId)
    ?pairStore.rateLimit(actor.ownerId,bucket,max,window):false,
    workflow:{
      async preview(actor,args){
        await gate(actor)
        if(['scheduledLocal','utcOffset','replaceLegacySchedule'].some(k=>args?.[k]!==undefined))fail('email_staff_immediate_only')
        const {flow,bound}=flowFor(actor.ownerId,args?.fromIdentity)
        return flow.preview(bound(actor),args)
      },
      async confirm(actor,args){
        fields(args,['reviewId','digest','idempotencyKey','confirmed'])
        if(!uuid.test(args.reviewId||''))fail('invalid_confirmation')
        await gate(actor)
        const review=await pairStore.getReview(actor.ownerId,args.reviewId)
        if(!review || review.principal?.kind!=='staff'||review.principal.ownerId!==actor.ownerId)fail('review_not_found_or_mismatch')
        // Sender comes from the stored immutable review, never confirmation input.
        const {flow,bound}=flowFor(actor.ownerId,review.snapshot?.fromIdentity)
        return flow.confirm(bound(actor),args)
      },
      async status(actor,args){
        fields(args,['idempotencyKey'])
        if(!/^[A-Za-z0-9_.:-]{8,120}$/.test(args.idempotencyKey||''))fail('invalid_arguments')
        await gate(actor)
        const job=await pairStore.replay(actor.ownerId,args.idempotencyKey)
        if(!job)return {status:'not_found'}
        const {flow,bound}=flowFor(actor.ownerId,job.snapshot?.fromIdentity)
        return flow.status(bound(actor),args)
      },
    }}
}
let staffRuntime
export async function getStaffEmailRuntime(){
  if(staffRuntime)return staffRuntime
  const base=await getProductionEmailRuntime()
  const {default:nodemailer}=await import('nodemailer')
  staffRuntime=createStaffEmailRuntime({store:base.store,env:process.env,
    dependenciesFor:sender=>createStaffSmtpDependencies({env:process.env,sender,createTransport:options=>nodemailer.createTransport(options)})})
  return staffRuntime
}
