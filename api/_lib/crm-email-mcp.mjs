import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema,ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createRemoteJWKSet,jwtVerify } from 'jose'
import { emailTools,createEmailToolExecutor } from './crm-email-tools.mjs'
import { EMAIL_SCOPES } from './crm-email-runtime.mjs'
import { fail } from './crm-email-workflow.mjs'

export const emailMcpEnabled=(env=process.env)=>env.CRM_EMAIL_DELIVERY_ENABLED==='true' && env.CRM_EMAIL_MCP_ENABLED==='true'
export function emailMcpConfig(env=process.env) {
  try {
    const resource=new URL(env.CRM_EMAIL_MCP_RESOURCE_URL),issuer=new URL(env.CRM_EMAIL_OAUTH_ISSUER),jwks=new URL(env.CRM_EMAIL_OAUTH_JWKS_URL)
    for(const u of [resource,issuer,jwks]) if(u.protocol!=='https:' || u.username || u.password || u.search || u.hash) throw Error()
    if(resource.pathname!=='/api/crm-email-mcp' || issuer.origin!==jwks.origin || issuer.hostname.endsWith('.supabase.co') || /\/auth\/v1\/?$/.test(issuer.pathname)) throw Error()
    if(!env.CRM_EMAIL_OAUTH_SUBJECT || !env.CRM_EMAIL_OAUTH_CLIENT_ID || !/^[a-f0-9-]{36}$/i.test(env.CRM_EMAIL_OWNER_ID || '')) throw Error()
    return {resource:resource.href,issuer:env.CRM_EMAIL_OAUTH_ISSUER,jwks:jwks.href,subject:env.CRM_EMAIL_OAUTH_SUBJECT,clientId:env.CRM_EMAIL_OAUTH_CLIENT_ID,ownerId:env.CRM_EMAIL_OWNER_ID}
  } catch { fail('email_oauth_not_configured') }
}
export function createEmailVerifier(config,keys=createRemoteJWKSet(new URL(config.jwks))) {
  return async token=>{
    try {
      const {payload:p}=await jwtVerify(token,keys,{issuer:config.issuer,audience:config.resource,subject:config.subject,algorithms:['ES256','RS256'],
        requiredClaims:['sub','iss','aud','exp','iat','client_id','scope','iom_crm_access','grant_family','owner_id'],maxTokenAge:'10m',clockTolerance:5})
      if(p.aud!==config.resource || p.client_id!==config.clientId || p.iom_crm_access!=='email_workflow' || p.owner_id!==config.ownerId ||
        p.role!=='iom_email_oauth' || p.exp-p.iat>600 || typeof p.scope!=='string' || !/^[a-f0-9-]{36}$/i.test(p.grant_family || '')) throw Error()
      const scopes=p.scope.split(' ').filter(Boolean)
      if(!scopes.includes(EMAIL_SCOPES.review) || scopes.some(s=>!Object.values(EMAIL_SCOPES).includes(s))) throw Error()
      return {kind:'oauth',ownerId:config.ownerId,grantFamily:p.grant_family,scopes}
    } catch { fail('invalid_email_access') }
  }
}
export function createEmailMcpHandler({enabled=()=>false,verifyAccessToken,runtime,limit,live=false,reviewOnly=false,singleSend=false,resourceMetadata}) {
  return async (req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff')
    let server,transport
    const reply=(status,error)=>{res.statusCode=status;if(status===401 && resourceMetadata)res.setHeader('WWW-Authenticate',`Bearer resource_metadata="${resourceMetadata}"`);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:false,error}))}
    try {
      if(!enabled()) return reply(503,'email_workflow_disabled')
      if(req.method!=='POST') return reply(405,'method_not_allowed')
      if(req.headers.origin) return reply(403,'server_access_only')
      if(Number(req.headers['content-length'])>1000000) return reply(413,'payload_too_large')
      if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return reply(415,'json_required')
      const auth=req.headers.authorization
      if(typeof auth!=='string' || !/^Bearer [A-Za-z0-9._~-]{1,16384}$/.test(auth)) return reply(401,'invalid_email_access')
      const actor=await verifyAccessToken(auth.slice(7))
      const service=await runtime()
      if(!(await service.authorize(actor,'review'))) return reply(403,'email_access_denied')
      if(!limit || !(await limit(`crm-email-mcp:${actor.ownerId}`,30,60000,{failClosed:true}))) return reply(429,'rate_limited')
      let body=req.body
      if(body===undefined) { const parts=[];let size=0;for await(const b of req){size+=b.length;if(size>1000000)return reply(413,'payload_too_large');parts.push(b)} body=Buffer.concat(parts).toString('utf8') }
      if(Buffer.isBuffer(body)) body=body.toString('utf8')
      if(typeof body==='string') {
        if(Buffer.byteLength(body)>1000000)return reply(413,'payload_too_large')
        try {body=JSON.parse(body)} catch {return reply(400,'invalid_json')}
      }
      if(!body || Array.isArray(body) || typeof body!=='object' || Buffer.byteLength(JSON.stringify(body))>1000000) return reply(400,'invalid_request')
      server=new Server({name:'iom-reviewed-crm-email',version:'1.0.0'},{capabilities:{tools:{}}})
      server.setRequestHandler(ListToolsRequestSchema,async()=>{
        if(!(await service.authorize(actor,'review'))) throw Error('email_access_denied')
        return {tools:emailTools(live,{reviewOnly,singleSend})}
      })
      const execute=createEmailToolExecutor(service.workflow,{live,reviewOnly,singleSend})
      server.setRequestHandler(CallToolRequestSchema,async request=>{
        if(!enabled() || !(await service.authorize(actor,'review'))) return {isError:true,content:[{type:'text',text:'email_access_denied'}]}
        return execute(actor,request.params.name,request.params.arguments)
      })
      transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true})
      res.once('close',()=>{void transport?.close();void server?.close()})
      await server.connect(transport);await transport.handleRequest(req,res,body)
    } catch(e) {
      if(!res.headersSent) reply(e.code==='invalid_email_access'?401:503,e.code==='invalid_email_access'?'invalid_email_access':'email_temporarily_unavailable')
      await transport?.close();await server?.close()
    }
  }
}
