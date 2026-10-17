import { sendReviewedCrmEmail } from './crm-reviewed-send.js'

// Explicit target binding only. This factory does not select a database or load credentials.
// Call only from an approved server composition, never the existing import-only gateway.
export function createReviewedEmailProvider(dependencies) {
  return async (snapshot, context) => ({...await sendReviewedCrmEmail({
    to: snapshot.to, subject: snapshot.subject, body: snapshot.body,
    leadId: snapshot.leadId, fromIdentity: snapshot.fromIdentity,
    ownerId: context.ownerId, expectedReview: snapshot,
    inReplyTo:snapshot.inReplyTo,references:snapshot.references,attachments:snapshot.attachments,
  }, {...dependencies,beginDelivery:()=>dependencies?.beginDelivery?.(snapshot,context)}),simulated:dependencies?.simulated===true})
}
