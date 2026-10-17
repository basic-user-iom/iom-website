import { randomUUID } from 'node:crypto'
import { fail } from './crm-email-workflow.mjs'

// No online target has been approved. Pin a newly approved project in a future reviewed change.
export const EMAIL_STAGING_REF=null
const EXISTING_REFS=['werfdsobddsijqckymip','ijjnstbwvuwwznfagxut']
// This candidate cannot activate delivery in the production CRM. A future
// production cutover is a separate reviewed code change, not an env toggle.
export function assertEmailStagingTarget(env=process.env,approvedRef=EMAIL_STAGING_REF) {
  if(!/^[a-z]{20}$/.test(approvedRef || '') || EXISTING_REFS.includes(approvedRef)) fail('email_online_target_not_approved')
  const expectedUrl=`https://${approvedRef}.supabase.co`
  if(env.VERCEL_ENV==='production' || env.VERCEL_TARGET_ENV==='production' ||
      env.CRM_EMAIL_PROVIDER!=='fake' || env.CRM_EMAIL_SUPABASE_URL!==expectedUrl) fail('email_staging_only')
  for(const [key,value] of Object.entries(env)) {
    if(!value) continue
    if(/^PROTON_SMTP_/.test(key) || /SERVICE_ROLE|SERVICE_KEY/.test(key)) fail('email_staging_secret_inheritance_rejected')
    if(/^(CRM_EMAIL_|VITE_SUPABASE_|SUPABASE_)/.test(key) && EXISTING_REFS.some(ref=>String(value).includes(ref))) fail('email_staging_only')
  }
  for(const key of ['VITE_SUPABASE_URL','SUPABASE_URL']) if(env[key] && env[key]!==expectedUrl) fail('email_staging_auth_target_mismatch')
  let url
  try {url=new URL(env.CRM_EMAIL_DATABASE_URL)} catch {fail('email_target_not_configured')}
  const user=decodeURIComponent(url.username)
  const direct=url.hostname===`db.${approvedRef}.supabase.co` && user==='iom_email_gateway'
  const pooler=/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && user===`iom_email_gateway.${approvedRef}`
  if(!['postgres:','postgresql:'].includes(url.protocol) || !(direct || pooler) || url.pathname!=='/postgres' || url.hash) fail('email_staging_database_mismatch')
  return {connection:url,supabaseUrl:expectedUrl}
}

// No sockets, nodemailer or SMTP credentials. Fake acceptance is explicitly
// labelled in the tool response and durable receipt. Only the test DB is writable.
export const stagingIdentities=()=>[
  {id:'visual',email:'visual@iobjectm.com',fromHeader:'IOM Visual <visual@iobjectm.com>',configured:true},
]
export function fakeProviderDependencies(identities=stagingIdentities) {
  return {simulated:true,
    resolveIdentity:async id=>(await identities()).find(i=>i.id===id && i.configured),
    createTransport:()=>({sendMail:async()=>({messageId:`<simulation-${randomUUID()}@iom.example.test>`})})}
}
