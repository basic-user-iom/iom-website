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
export const emailTools = (live=false,{reviewOnly=false,singleSend=false,immediateOnly=false}={})=>definitions.filter(([,operation])=>reviewOnly?['preview','list'].includes(operation):!(singleSend||immediateOnly)||['preview','list','confirm'].includes(operation)).map(([name,operation,description,inputSchema]) => ({
  name,description:(reviewOnly?'DRAFT REVIEW ONLY: saves a private review; cannot send, schedule, reschedule or cancel email. ':singleSend?'ONE APPROVED MESSAGE ONLY: confirmation may deliver the immutable pilot once before its deadline; no scheduling. ':immediateOnly?'INDIVIDUAL APPROVED EMAIL: review and explicitly approve each distinct message before one immediate delivery. No bulk or scheduled sending. ':live?'LIVE EMAIL: confirmation may deliver a real email within the approved sender and contact scope. ':'STAGING SIMULATION ONLY: no real email is delivered. ')+(singleSend&&operation==='confirm'?'Send the one immutable reviewed pilot only after explicit human confirmation. No scheduling; never retry an uncertain delivery.':immediateOnly&&operation==='confirm'?'Send the exact reviewed recipient, sender, subject and content only after explicit human confirmation of this unchanged message. Reuse its idempotencyKey after interruptions; never retry an uncertain delivery.':(reviewOnly||singleSend||immediateOnly)&&operation==='preview'?'Review the approved contact and sender with the exact subject and body using the CRM template. Keep the same messageIntentId for the same content.'+(immediateOnly?' Each different message needs a new intent, review and explicit confirmation.':''):description),
  inputSchema:(reviewOnly||singleSend||immediateOnly)&&operation==='preview'?{...inputSchema,properties:Object.fromEntries(Object.entries(inputSchema.properties).filter(([key])=>!['scheduledLocal','utcOffset','replaceLegacySchedule'].includes(key)))}:inputSchema, annotations:{readOnlyHint:operation==='list',destructiveHint:['confirm','cancel'].includes(operation),idempotentHint:!['preview','previewReschedule'].includes(operation),openWorldHint:operation==='confirm'},
  securitySchemes:(operation==='confirm'?(singleSend||immediateOnly?['send']:['send','schedule']): [operation==='cancel'?'cancel':operation==='previewReschedule'?'schedule':'read'])
    .map(action=>({type:'oauth2',scopes:[...new Set(['iom:crm:email:read',`iom:crm:email:${action}`])]})),
}))
export const EMAIL_TOOLS=emailTools()
export function createEmailToolExecutor(workflow,{live=false,reviewOnly=false,singleSend=false,immediateOnly=false}={}) {
  return async (actor, name, args) => {
    const operation = definitions.find(d => d[0] === name)?.[1]
    try {
      if (!operation) throw new EmailWorkflowError('email_tool_not_allowed')
      if(reviewOnly && !['preview','list'].includes(operation)) throw new EmailWorkflowError('email_review_only')
      if(singleSend && !['preview','list','confirm'].includes(operation)) throw new EmailWorkflowError('email_single_send_only')
      if(immediateOnly && (!['preview','list','confirm'].includes(operation) ||
        (operation==='preview' && ['scheduledLocal','utcOffset','replaceLegacySchedule'].some(key=>args?.[key]!==undefined)))) throw new EmailWorkflowError('email_immediate_only')
      const result = await workflow[operation](actor,args ?? {})
      return {isError:false,content:[{type:'text',text:JSON.stringify(result)}],structuredContent:{ok:true,deliveryMode:reviewOnly?'review-only':singleSend?'single-send':immediateOnly?'individual-immediate':live?'live':'simulation',result}}
    } catch (error) {
      const code = error instanceof EmailWorkflowError ? error.code : 'email_temporarily_unavailable'
      return {isError:true,content:[{type:'text',text:code}],structuredContent:{ok:false,error:code}}
    }
  }
}
