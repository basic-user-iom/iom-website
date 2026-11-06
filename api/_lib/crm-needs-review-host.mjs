import {createHash} from 'node:crypto'
import {createNeedsReviewComposition} from './crm-needs-review-composition.mjs'
import {createCrmBatchTriggerHandler} from './crm-capability-dispatcher.mjs'
import {createCapabilityWorkerAuth} from './crm-capability-worker-auth.mjs'
import {validateCapabilityOAuthPin} from './crm-capability-oauth.mjs'
import {EMAIL_PRODUCTION_APPROVAL,assertProductionTarget,productionDatabase,createSmtpDependencies} from './crm-email-production.mjs'

// A separate reviewed non-secret pin and explicit flags are required to activate.
export const NEEDS_REVIEW_PRODUCTION_APPROVAL=null
const SCOPES=Object.freeze(['iom:crm:email:read','iom:crm:email:send','iom:crm:email:batch:confirm'])
const RESOURCE='https://iobjectm.com/api/crm-capability-mcp'
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const fail=code=>{throw Object.assign(Error(code),{code})}
// Connection consent has a finite expiry of its own. Execution is a separate,
// optional pin; absence never authorizes a preview, confirmation, or worker.
export function validateNeedsReviewApproval(approval,now=Date.now()){
  const pin=validateCapabilityOAuthPin(approval?.pin,'projects')
  if(pin.ownerId!==EMAIL_PRODUCTION_APPROVAL.ownerId||pin.staffEmail!=='projects@iobjectm.com'||
    pin.scopes.length!==SCOPES.length||!SCOPES.every(s=>pin.scopes.includes(s))||
    (pin.workerGrantFamily!==undefined&&!UUID.test(pin.workerGrantFamily))||
    Date.parse(pin.grantExpiresAt)<=now||approval.localDate!==undefined||approval.until!==undefined)
    fail('needs_review_approval_invalid')
  const e=approval.execution
  if(e!==null&&e!==undefined){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(e.localDate||'')||
      !Number.isFinite(Date.parse(e.localDate+'T00:00:00Z'))||new Date(e.localDate+'T00:00:00Z').toISOString().slice(0,10)!==e.localDate||
      !Number.isFinite(Date.parse(e.until))||Date.parse(e.until)<=Date.parse(e.localDate+'T00:00:00Z')||
      Date.parse(e.until)>Date.parse(pin.grantExpiresAt)||
      Date.parse(e.until)>Date.parse(e.localDate+'T00:00:00Z')+86400000)
      fail('needs_review_execution_invalid')
  }
  return pin
}
async function oauthDependencies(){
  const [oauth,issuer,store,jose]=await Promise.all([import('./crm-capability-oauth.mjs'),
    import('./crm-needs-review-issuer.mjs'),import('./crm-needs-review-oauth-store.mjs'),import('jose')])
  return {config:oauth.createCapabilityOAuthConfig,verifier:oauth.createCapabilityVerifier,
    http:issuer.createEmailIssuerHttp,store:store.createProductionOAuthStore,keys:jwk=>jose.createLocalJWKSet({keys:[jwk]})}
}
// Reuse reviewed protocols; expose only bounded Needs review operations.
export function createNeedsReviewRuntimeHost({enabled=()=>false,startsEnabled=()=>false,workerEnabled=()=>false,
  workerScheduleAllowed=()=>false,configure,getWorkerAuth,loadOAuth=oauthDependencies,
  compositionFactory=createNeedsReviewComposition}={}){
  let cached
  const installed=()=>enabled()===true,starts=()=>installed()&&startsEnabled()===true
  const workerStarts=()=>starts()&&workerEnabled()===true
  async function auth(){if(!installed()||typeof getWorkerAuth!=='function')fail('needs_review_disabled');return getWorkerAuth()}
  async function assemble(){
    const c=await configure(),d=await loadOAuth(),pin=c.pin
    const issuer=d.config({enabled:installed,pins:{projects:pin},fromIdentity:'projects',signingJwk:c.signingJwk})
    if(issuer.resource!==RESOURCE||issuer.ownerId!==pin.ownerId||issuer.fromIdentity!=='projects')fail('needs_review_issuer_mismatch')
    const oauthStore=d.store(c.acquireOAuth,pin.ownerId,{accessRevision:pin.accessRevision,
      capability:{fromIdentity:'projects',grantExpiresAt:issuer.grantExpiresAt}})
    const {kty,crv,x,y}=issuer.signingJwk
    const verify=d.verifier(issuer,d.keys({kty,crv,x,y,kid:issuer.kid,alg:'ES256',use:'sig'}),{
      grantActive:actor=>actor.ownerId===pin.ownerId&&actor.fromIdentity==='projects'&&actor.accessRevision===pin.accessRevision
        ?oauthStore.grantActive(actor.grantFamily):false})
    const handler=d.http({configure:()=>{if(!installed())fail('needs_review_disabled');return issuer},storeFactory:()=>oauthStore})
    let app=null,trigger=null
    if(c.execution&&UUID.test(pin.workerGrantFamily||'')){
      const binding={ownerId:pin.ownerId,fromIdentity:'projects',accessRevision:pin.accessRevision,grantFamily:pin.workerGrantFamily,authorized:true}
      const worker=await auth()
      app=compositionFactory({acquire:c.acquire,binding,enabled:installed,startsEnabled:starts,workerEnabled:workerStarts,
        workerScheduleAllowed,authorizeWorker:worker.authorize,resolveBinding:async()=>binding,providerDependencies:c.providerDependencies})
      trigger=createCrmBatchTriggerHandler({dispatcher:app.dispatcher,enabled:installed,verifyWorker:worker.verify,
        workerTransport:'vercel-cron',workerEnabled:workerStarts})
    }
    return Object.freeze({
      resourceMetadata:{resource:RESOURCE,authorization_servers:[issuer.issuer],scopes_supported:[...SCOPES],bearer_methods_supported:['header']},
      oauthHandlers:{projects:handler},trigger,
      verifyAccessToken:async token=>{if(!installed())fail('needs_review_disabled');return verify(token)},
      rateLimit:()=>oauthStore.rateLimit(),
      tools:{listTools:()=>installed()&&app?app.tools.list():[],execute:async(actor,name,args)=>{
        if(!installed()||!app)return {isError:true,content:[{type:'text',text:'needs_review_connection_not_bound'}]}
        try{
          if(name==='crm_needs_review_batch_preview'&&args?.localDate!==c.execution.localDate)fail('needs_review_date_not_authorized')
          return {content:[{type:'text',text:JSON.stringify(await app.tools.call(actor,name,args))}]}}
        catch{return {isError:true,content:[{type:'text',text:'needs_review_request_failed_check_confirmation_status'}]}}
      }},
    })
  }
  return Object.freeze({enabled:installed,startsEnabled:starts,workerEnabled:workerStarts,workerTransport:'vercel-cron',workerScheduleAllowed,
    verifyWorkerRequest:async req=>{try{return await (await auth()).verify(req)}catch{return null}},
    get:async()=>{if(!installed())fail('needs_review_disabled');if(!cached)cached=assemble().catch(e=>{cached=undefined;throw e});return cached},
  })
}
export function createEnvironmentNeedsReviewHost({approval=NEEDS_REVIEW_PRODUCTION_APPROVAL,env=process.env,now=Date.now,
  loadDependencies=async()=>{const [{Pool},{default:mailer},identities]=await Promise.all([import('pg'),import('nodemailer'),import('./proton-identities.js')]);
    return {Pool,mailer,identities:identities.listProtonIdentities}},loadOAuth}={}){
  const enabled=()=>approval!==null&&env.CRM_NEEDS_REVIEW_ENABLED==='true'&&now()<Date.parse(approval.pin?.grantExpiresAt)
  const starts=()=>enabled()&&env.CRM_NEEDS_REVIEW_STARTS_ENABLED==='true'&&env.CRM_EMAIL_SEND_ENABLED==='true'&&!!approval.execution&&now()<Date.parse(approval.execution.until)
  const workerEnabled=()=>env.CRM_NEEDS_REVIEW_WORKER_ENABLED==='true'
  const calendar=()=>enabled()&&!!approval.execution&&now()<Date.parse(approval.execution.until)
  function pins(){const pin=validateNeedsReviewApproval(approval,now());assertProductionTarget(env);return pin}
  let worker
  const getWorkerAuth=async()=>{
    pins()
    if(!worker){const secret=env.CRON_SECRET;if(typeof secret!=='string'||!/^[A-Za-z0-9._~-]{32,512}$/.test(secret))fail('needs_review_worker_not_configured')
      worker=createCapabilityWorkerAuth({transport:'vercel-cron',expectedSha256:createHash('sha256').update(secret).digest('hex')})}
    return worker
  }
  return createNeedsReviewRuntimeHost({enabled,startsEnabled:starts,workerEnabled,workerScheduleAllowed:calendar,getWorkerAuth,loadOAuth,
    configure:async()=>{
      const pin=pins(),deps=await loadDependencies(),pools=new Map()
      const acquireFor=role=>async()=>{
        if(!enabled())fail('needs_review_disabled')
        let pool=pools.get(role)
        if(!pool){pool=new deps.Pool({...productionDatabase(env,role),max:4,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});pool.on('error',()=>{});pools.set(role,pool)}
        return pool.connect()
      }
      let signingJwk
      try{signingJwk=JSON.parse(env.CRM_EMAIL_OAUTH_SIGNING_JWK)}catch{fail('needs_review_issuer_not_configured')}
      const existing=approval.execution&&UUID.test(pin.workerGrantFamily||'')?createSmtpDependencies({env,identities:deps.identities,pin:EMAIL_PRODUCTION_APPROVAL,createTransport:options=>deps.mailer.createTransport(options)}):null
      const providerDependencies=existing?{...existing,createTransport:()=>{if(!starts())fail('needs_review_starts_paused');return existing.createTransport()}}:undefined
      return {pin,execution:approval.execution||null,signingJwk,acquire:acquireFor('iom_email_gateway'),acquireOAuth:acquireFor('iom_email_oauth'),providerDependencies}
    }})
}
export const needsReviewHost=createEnvironmentNeedsReviewHost()
