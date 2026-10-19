import {requireStaffUser,setAllowedOriginCors} from './blog-helpers.js'
import {assertProductionTarget,getProductionEmailRuntime} from './crm-email-production.mjs'
import {createEmailToolExecutor} from './crm-email-tools.mjs'
export default async function(req,res) {
  setAllowedOriginCors(res,req.headers.origin,{allowAuth:true,methods:'POST, OPTIONS'})
  res.setHeader('Cache-Control','no-store')
  if(req.method==='OPTIONS')return res.status(204).end()
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'})
  try {
    const pin=assertProductionTarget()
    const auth=await requireStaffUser(req)
    if(!auth.ok)return res.status(auth.status).json({ok:false,error:auth.code})
    const runtime=await getProductionEmailRuntime(),actor={kind:'staff',ownerId:auth.user.id}
    if(!await runtime.authorize(actor,'review'))return res.status(403).json({ok:false,error:'email_access_denied'})
    if(!await runtime.rateLimit('staff',30,60000))return res.status(429).json({ok:false,error:'rate_limited'})
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body
    if(!body || typeof body.name!=='string' || Object.keys(body).some(k=>!['name','arguments'].includes(k)))return res.status(400).json({ok:false,error:'invalid_request'})
    const result=await createEmailToolExecutor(runtime.workflow,{live:true,reviewOnly:pin.accessMode==='review-only'})(actor,body.name,body.arguments)
    return res.status(result.isError?409:200).json(result.structuredContent)
  }catch{return res.status(503).json({ok:false,error:'email_production_unavailable'})}
}
