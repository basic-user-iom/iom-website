import { EmailWorkflowError } from './crm-email-workflow.mjs'

const str = { type: 'string', maxLength: 120 }
const schema = (properties, required = Object.keys(properties)) => ({ type:'object', properties, required, additionalProperties:false })
const definitions = [
  ['iom_crm_preview_email','preview','Review an existing initial draft or an explicit NEW follow-up with subject/body and a stable messageIntentId UUID. Reuse that UUID for the same message across retries; changing its content requires a genuinely new intent and confirmation. Uses the CRM template and optional Europe/Belgrade schedule. Does not send.',
    schema({kind:{type:'string',enum:['initial','followup']},messageIntentId:{type:'string',format:'uuid'},subject:{type:'string',maxLength:300},body:{type:'string',maxLength:50000},leadId:str,to:{type:'string',maxLength:320},fromIdentity:{type:'string',enum:['contact','visual','projects']},scheduledLocal:{type:'string',description:'YYYY-MM-DDTHH:mm in Europe/Belgrade'},utcOffset:{type:'string',enum:['+01:00','+02:00']},replaceLegacySchedule:{type:'boolean',description:'Explicitly review and replace an old unverified legacy schedule; confirmation atomically transfers it.'}},['leadId','to','fromIdentity'])],
  ['iom_crm_confirm_email','confirm','Send or schedule the immutable reviewed email only after explicit human confirmation of recipient, sender, content and time. Reuse the same idempotencyKey after interruptions; never retry an unknown delivery.',
    schema({reviewId:str,digest:{type:'string',pattern:'^[a-f0-9]{64}$'},idempotencyKey:str,confirmed:{type:'boolean',const:true}})],
  ['iom_crm_list_email_jobs','list','List the latest 100 email jobs including scheduled, sent, cancelled and uncertain attempts.',schema({})],
  ['iom_crm_cancel_email','cancel','Cancel a queued email. Cannot cancel after delivery has started.',schema({jobId:str})],
  ['iom_crm_preview_email_reschedule','previewReschedule','Review a new Europe/Belgrade time for a queued message. Confirm this new review to change the time; old confirmations cannot restore old times.',
    schema({jobId:str,scheduledLocal:{type:'string'},utcOffset:{type:'string',enum:['+01:00','+02:00']}},['jobId','scheduledLocal'])],
]
// Registered only on the separately gated email resource, never on import Preview.
export const emailTools = (live=false)=>definitions.map(([name,operation,description,inputSchema]) => ({
  name,description:(live?'LIVE EMAIL: confirmation may deliver a real email to the approved pilot recipient. ':'STAGING SIMULATION ONLY: no real email is delivered. ')+description,inputSchema, annotations:{readOnlyHint:operation==='list',destructiveHint:['confirm','cancel'].includes(operation),idempotentHint:!['preview','previewReschedule'].includes(operation),openWorldHint:operation==='confirm'},
  securitySchemes:(operation==='confirm'?['send','schedule']: [operation==='cancel'?'cancel':operation==='previewReschedule'?'schedule':'read'])
    .map(action=>({type:'oauth2',scopes:[...new Set(['iom:crm:email:read',`iom:crm:email:${action}`])]})),
}))
export const EMAIL_TOOLS=emailTools()
export function createEmailToolExecutor(workflow,{live=false}={}) {
  return async (actor, name, args) => {
    const operation = definitions.find(d => d[0] === name)?.[1]
    try {
      if (!operation) throw new EmailWorkflowError('email_tool_not_allowed')
      const result = await workflow[operation](actor,args ?? {})
      return {isError:false,content:[{type:'text',text:JSON.stringify(result)}],structuredContent:{ok:true,deliveryMode:live?'live':'simulation',result}}
    } catch (error) {
      const code = error instanceof EmailWorkflowError ? error.code : 'email_temporarily_unavailable'
      return {isError:true,content:[{type:'text',text:code}],structuredContent:{ok:false,error:code}}
    }
  }
}
