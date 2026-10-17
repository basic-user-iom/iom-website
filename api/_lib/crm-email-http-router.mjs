import mcp from './crm-email-live-mcp-handler.mjs'
import staff from './crm-email-live-workflow-handler.mjs'
import {emailIssuerHttp} from './crm-email-oauth-issuer.mjs'

// Exact original public pathname only. Query, body and forwarding headers never
// select an authentication boundary. Each handler retains its own authorization.
export function createEmailHttpRouter({mcpHandler=mcp,staffHandler=staff,issuerHandler=emailIssuerHttp}={}) {
  return function emailHttp(req,res) {
    const raw=typeof req.url==='string'?req.url:''
    const pathname=raw.split('?')[0]
    if(pathname==='/api/crm-email-live-mcp')return mcpHandler(req,res)
    if(pathname==='/api/crm-email-live-workflow')return staffHandler(req,res)
    if(pathname==='/api/crm-email-oauth'||
       pathname==='/.well-known/oauth-authorization-server/crm-email-identity'||
       pathname==='/.well-known/oauth-protected-resource/api/crm-email-live-mcp')return issuerHandler(req,res)
    res.setHeader('Cache-Control','no-store')
    return res.status(404).json({ok:false,error:'not_found'})
  }
}
export default createEmailHttpRouter()
