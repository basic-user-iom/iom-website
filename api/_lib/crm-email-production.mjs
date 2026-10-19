import {fail,emailDigest} from './crm-email-workflow.mjs'
import {createEmailStore} from './crm-email-store.mjs'
import {createEmailRuntime} from './crm-email-runtime.mjs'
import {listProtonIdentities} from './proton-identities.js'

// Secure handoff: only a separately approved code change may populate this pin.
// Required fields: ownerId, leadId, recipient, fromIdentity, fromEmail, fromHeader,
// staffEmail, clientId, redirectUri, subject (OAuth subject). No secrets belong here.
// Non-secret proposal; inactive until the separate activation patch is approved.
export const EMAIL_REVIEW_APPROVAL = Object.freeze({
  accessMode:'review-only',ownerId:'1add2cb0-a00a-4f92-a20a-7d90cb23afdd',
  leadId:'5e474e0e-2bbf-4233-97f8-9a71428e6aa8',recipient:'mirjan.foto@gmail.com',
  fromIdentity:'projects',fromEmail:'projects@iobjectm.com',fromHeader:'IOM Projects <projects@iobjectm.com>',
  staffEmail:'projects@iobjectm.com',clientId:'https://chatgpt.com/oauth/client.json',
  redirectUri:'https://chatgpt.com/connector_platform_oauth_redirect',
  subject:'iom-crm-email-review:1add2cb0-a00a-4f92-a20a-7d90cb23afdd',
  messageKind:'followup',messageIntentId:'ae0811f0-869e-49ac-80cc-8516940559fa',
})
// Candidate only: publishing this pin and enabling SEND require explicit owner approval.
export const EMAIL_SINGLE_SEND_APPROVAL = Object.freeze({...EMAIL_REVIEW_APPROVAL,
  accessMode:'single-send',reviewDigest:'a8004fa84d190566be72ad01b2753f1f039790b4696043c084d468343392fbc4',
  sendExpiresAt:'2026-10-19T19:00:00.000Z',
})
export const singleSendApproval = pin => pin?.accessMode === 'single-send'
export const reviewOnlyApproval = pin => pin?.accessMode === 'review-only'
export const EMAIL_PRODUCTION_APPROVAL = EMAIL_SINGLE_SEND_APPROVAL
export const EMAIL_PRODUCTION_REF = 'werfdsobddsijqckymip'
export const EMAIL_PRODUCTION_ORIGIN = 'https://iobjectm.com'
export const EMAIL_PRODUCTION_RESOURCE = EMAIL_PRODUCTION_ORIGIN+'/api/crm-email-live-mcp'
export const EMAIL_PRODUCTION_ISSUER = EMAIL_PRODUCTION_ORIGIN+'/crm-email-identity'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const address=/^[^\s@<>,;\r\n]+@[^\s@<>,;\r\n]+\.[^\s@<>,;\r\n]+$/
export function productionApproval(pin=EMAIL_PRODUCTION_APPROVAL) {
  if(pin?.accessMode!==undefined && !reviewOnlyApproval(pin) && !singleSendApproval(pin)) fail('email_production_not_approved')
  if(!pin || !uuid.test(pin.ownerId||'') || !uuid.test(pin.leadId||'') || !address.test(pin.recipient||'') ||
    !address.test(pin.fromEmail||'') || !['contact','visual','projects'].includes(pin.fromIdentity) ||
    !pin.fromHeader || /[\r\n]/.test(pin.fromHeader) || !address.test(pin.staffEmail||'') || !pin.clientId || !pin.subject) fail('email_production_not_approved')
  if(!['initial','followup'].includes(pin.messageKind||'initial') ||
    ((pin.messageKind==='followup') ? !uuid.test(pin.messageIntentId||'') : pin.messageIntentId!==undefined)) fail('email_production_not_approved')
  if(singleSendApproval(pin) && (pin.messageKind!=='followup' || !/^[a-f0-9]{64}$/.test(pin.reviewDigest||'') ||
    !Number.isFinite(Date.parse(pin.sendExpiresAt)))) fail('email_production_not_approved')
  let redirect
  try {redirect=new URL(pin.redirectUri)} catch {fail('email_production_not_approved')}
  if(redirect.protocol!=='https:' || redirect.username || redirect.password || redirect.hash || pin.redirectUri.includes('*')) fail('email_production_not_approved')
  return pin
}
// Pin-based, not flag-based: disabling delivery must NEVER reopen the legacy sender.
export function isProtectedEmailTarget(input,pin=EMAIL_PRODUCTION_APPROVAL) {
  if(!pin) return false
  return input?.leadId===pin.leadId || String(input?.to||'').trim().toLowerCase()===String(pin.recipient).toLowerCase()
}
export function productionDatabase(env,role) {
  let connection
  try {connection=new URL(env[role==='iom_email_gateway'?'CRM_EMAIL_DATABASE_URL':'CRM_EMAIL_OAUTH_DATABASE_URL'])} catch {fail('email_database_not_configured')}
  const user=decodeURIComponent(connection.username),ref=EMAIL_PRODUCTION_REF
  const direct=connection.hostname===`db.${ref}.supabase.co` && user===role
  const pooler=/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(connection.hostname) && user===`${role}.${ref}`
  if(!['postgres:','postgresql:'].includes(connection.protocol) || !(direct||pooler) || connection.pathname!=='/postgres' || connection.hash || connection.search) fail('email_database_target_rejected')
  return {connectionString:connection.toString(),ssl:{rejectUnauthorized:true,...(env.CRM_EMAIL_DATABASE_CA?{ca:env.CRM_EMAIL_DATABASE_CA}:{})}}
}
export function assertProductionTarget(env=process.env,pin=EMAIL_PRODUCTION_APPROVAL) {
  productionApproval(pin)
  if(reviewOnlyApproval(pin) && env.CRM_EMAIL_SEND_ENABLED!=='false') fail('email_review_only')
  if(env.CRM_EMAIL_PRODUCTION_ENABLED!=='true' || env.VERCEL_ENV!=='production' || env.CRM_EMAIL_PROVIDER!=='smtp') fail('email_production_disabled')
  const expected=`https://${EMAIL_PRODUCTION_REF}.supabase.co`
  if(env.CRM_EMAIL_SUPABASE_URL!==expected || (env.VITE_SUPABASE_URL||env.SUPABASE_URL)!==expected ||
    (env.VITE_SUPABASE_URL&&env.SUPABASE_URL&&env.VITE_SUPABASE_URL!==env.SUPABASE_URL)) fail('email_production_target_mismatch')
  return pin
}
export function createSmtpDependencies({env,identities=listProtonIdentities,createTransport,pin}) {
  productionApproval(pin)
  const selected=()=>{
    const identity=identities().find(i=>i.id===pin.fromIdentity)
    if(!identity?.configured || identity.email!==pin.fromEmail || identity.fromHeader!==pin.fromHeader) fail('email_sender_binding_mismatch')
    return identity
  }
  return {simulated:false,resolveIdentity:async id=>id===pin.fromIdentity?selected():undefined,
    createTransport:()=>{
      if(reviewOnlyApproval(pin)) fail('email_review_only')
      if(singleSendApproval(pin) && Date.now()>=Date.parse(pin.sendExpiresAt)) fail('email_single_send_expired')
      assertProductionTarget(env,pin)
      if(env.CRM_EMAIL_SEND_ENABLED!=='true') fail('email_delivery_paused')
      const identity=selected(),port=Number(env.PROTON_SMTP_PORT||587)
      if(!env.PROTON_SMTP_HOST || ![465,587].includes(port)) fail('email_smtp_not_configured')
      return createTransport({host:env.PROTON_SMTP_HOST,port,secure:port===465,requireTLS:true,
        tls:{rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:30000,
        auth:{user:identity.user,pass:identity.pass}})
    },identities:()=>{const {id,email,fromHeader,configured}=selected();return [{id,email,fromHeader,configured}]},
  }
}
export function createProductionRuntime({store,pin,dependencies,env,now=Date.now}) {
  const enabled=()=>{assertProductionTarget(env,pin);return true}
  const exactReview=review=>{
    if(singleSendApproval(pin) && (review.schedule!==null || review.replaceJobId ||
      emailDigest({snapshot:review.snapshot,schedule:null})!==pin.reviewDigest)) fail('email_pilot_content_mismatch')
    return review
  }
  const scopedStore={...store,
    review:(owner,review)=>store.review(owner,exactReview(review)),
    getReview:async(owner,id)=>{const review=await store.getReview(owner,id);return review?exactReview(review):review},
    enqueue:(owner,review,...rest)=>store.enqueue(owner,exactReview(review),...rest),
    lead:async(owner,id)=>{
    if(owner!==pin.ownerId || id!==pin.leadId) fail('email_pilot_only')
    const lead=await store.lead(owner,id)
    if(lead?.scheduled_send) fail('legacy_schedule_requires_separate_review')
    return lead
  }}
  const service=createEmailRuntime({store:scopedStore,ownerId:pin.ownerId,identities:dependencies.identities,enabled,now,
    providerDependencies:dependencies,
    authorizeAction:(actor,action)=>reviewOnlyApproval(pin) ? action==='review'
      : singleSendApproval(pin) ? action==='review' || (action==='send' && actor.kind==='oauth' && env.CRM_EMAIL_SEND_ENABLED==='true' && now()<Date.parse(pin.sendExpiresAt))
      : !['send','schedule','worker'].includes(action)||env.CRM_EMAIL_SEND_ENABLED==='true',
    beforeDelivery:async(snapshot,context)=>{
      if(reviewOnlyApproval(pin)) fail('email_review_only')
      enabled()
      if(singleSendApproval(pin)){
        if(now()>=Date.parse(pin.sendExpiresAt)) fail('email_single_send_expired')
        exactReview({snapshot,schedule:null})
      }
      if(env.CRM_EMAIL_SEND_ENABLED!=='true') fail('email_delivery_paused')
      if(snapshot.leadId!==pin.leadId || snapshot.to!==pin.recipient || snapshot.from!==pin.fromEmail || snapshot.kind!==(pin.messageKind||'initial') || (snapshot.kind==='followup' && snapshot.messageIntentId!==pin.messageIntentId)) fail('email_pilot_only')
      await store.assertProductionDelivery(context.ownerId,context.jobId)
    }})
  const workflow=service.workflow
  // Restrict every preview and old-route send, including reply and recipient overrides.
  service.workflow={...workflow,
    preview:(actor,args)=>{
      if((reviewOnlyApproval(pin)||singleSendApproval(pin)) && ['scheduledLocal','utcOffset','replaceLegacySchedule'].some(key=>args?.[key]!==undefined)) fail('email_review_only')
      if(args?.leadId!==pin.leadId || args?.to!==pin.recipient || args?.fromIdentity!==pin.fromIdentity || args?.replaceLegacySchedule || (args?.kind||'initial')!==(pin.messageKind||'initial') || (pin.messageKind==='followup' && args?.messageIntentId!==pin.messageIntentId)) fail('email_pilot_only')
      return workflow.preview(actor,args)
    },
    sendLegacy:(actor,args)=>{
      if(pin.messageKind==='followup' || args?.leadId!==pin.leadId || String(args?.to||'').trim().toLowerCase()!==pin.recipient || args?.fromIdentity!==pin.fromIdentity || args?.inReplyTo || args?.attachments?.length) fail('email_pilot_only')
      return workflow.sendLegacy(actor,args)
    }}
  // createEmailRuntime's runDue closes over the original workflow; both share the
  // same scoped store and beforeDelivery boundary. No cron gets a send super-grant.
  return service
}
let service,pool
export async function getProductionEmailRuntime() {
  const pin=assertProductionTarget()
  if(service)return service
  const [{Pool},{default:nodemailer}]=await Promise.all([import('pg'),import('nodemailer')])
  if(!pool){pool=new Pool({...productionDatabase(process.env,'iom_email_gateway'),max:4,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});pool.on('error',()=>{})}
  const store=createEmailStore(()=>pool.connect())
  if(!await store.productionBinding(pin,`https://${EMAIL_PRODUCTION_REF}.supabase.co`)) fail('email_production_binding_mismatch')
  const dependencies=createSmtpDependencies({env:process.env,pin,createTransport:options=>nodemailer.createTransport(options)})
  service=createProductionRuntime({store,pin,dependencies,env:process.env})
  return service
}
