// Isolated reviewed sender. Transport is injected explicitly; no environment,
// service-role key, REST persistence, or fallback to a live SMTP transport.
import {normalizeMessageId,buildReferencesHeader} from './crm-lead-messages.js'
import {parseOutreachAttachments,toNodemailerAttachments} from './email-attachments.js'
import {renderOutreachEmailHtml,renderOutreachPlainText} from './outreach-email-html.js'

export async function sendReviewedCrmEmail(opts,dependencies={}) {
  const expected=opts.expectedReview
  if(!expected || typeof dependencies.beginDelivery!=='function' ||
    typeof dependencies.resolveIdentity!=='function' || typeof dependencies.createTransport!=='function') throw Error('Reviewed transport required')
  const identity=await dependencies.resolveIdentity(opts.fromIdentity)
  const to=String(opts.to || '').trim().toLowerCase(),subject=String(opts.subject || '').trim(),body=String(opts.body || '').trim()
  const html=renderOutreachEmailHtml({subject,body}),text=renderOutreachPlainText(body)
  if(!identity?.configured || identity.id!==expected.fromIdentity || identity.email!==expected.from ||
    identity.fromHeader!==expected.fromHeader || to!==expected.to || subject!==expected.subject || body!==expected.body ||
    html!==expected.html || text!==expected.text) throw Error('Reviewed email changed; review again before sending')
  const attachments=toNodemailerAttachments(parseOutreachAttachments(opts.attachments))
  const inReplyTo=opts.inReplyTo?normalizeMessageId(opts.inReplyTo):''
  const references=inReplyTo?buildReferencesHeader(opts.references,inReplyTo):opts.references || ''
  if(await dependencies.beginDelivery()!==true) throw Error('Durable delivery claim required')
  const transport=dependencies.createTransport()
  const info=await transport.sendMail({from:identity.fromHeader,to,subject,text,html,
    inReplyTo:inReplyTo || undefined,references:references || undefined,
    attachments:attachments.length?attachments:undefined,
    headers:{'X-IOM-CRM-Lead':opts.leadId,'X-IOM-CRM-User':opts.ownerId,'X-IOM-CRM-From':identity.id}})
  return {ok:true,messageId:info.messageId?normalizeMessageId(info.messageId):null,
    from:identity.email,fromIdentity:identity.id,to,inReplyTo:inReplyTo || null,references:references || null}
}
