import {createEmailMcpHandler,createEmailVerifier} from './crm-email-mcp.mjs'
import {assertProductionTarget,getProductionEmailRuntime,EMAIL_PRODUCTION_RESOURCE,EMAIL_PRODUCTION_ISSUER,EMAIL_PRODUCTION_ORIGIN} from './crm-email-production.mjs'
let handler
export default async function(req,res) {
  res.setHeader('Cache-Control','no-store')
  try {
    const pin=assertProductionTarget()
    if(process.env.CRM_EMAIL_LIVE_MCP_ENABLED!=='true')throw Error()
    if(!handler)handler=createEmailMcpHandler({live:true,reviewOnly:pin.accessMode==='review-only',
      resourceMetadata:EMAIL_PRODUCTION_ORIGIN+'/api/crm-email-oauth?action=resource',
      enabled:()=>{assertProductionTarget();return process.env.CRM_EMAIL_LIVE_MCP_ENABLED==='true'},
      verifyAccessToken:createEmailVerifier({resource:EMAIL_PRODUCTION_RESOURCE,issuer:EMAIL_PRODUCTION_ISSUER,
        jwks:EMAIL_PRODUCTION_ORIGIN+'/api/crm-email-oauth?action=keys',subject:pin.subject,clientId:pin.clientId,ownerId:pin.ownerId}),
      runtime:getProductionEmailRuntime,limit:async(_key,max,windowMs)=>(await getProductionEmailRuntime()).rateLimit('mcp',max,windowMs)})
    return await handler(req,res)
  }catch{if(!res.headersSent)return res.status(503).json({ok:false,error:'email_production_unavailable'})}
}
