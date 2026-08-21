import type { Lead, LeadInput } from './types'
import { hasNeedsReview, withoutNeedsReview } from './leadTags'

/** Clear Needs review when staff send or schedule outreach. */
export function needsReviewClearPatch(
  lead: Pick<Lead, 'tags'>,
): Pick<LeadInput, 'tags'> | Record<string, never> {
  if (!hasNeedsReview(lead.tags)) return {}
  return { tags: withoutNeedsReview(lead.tags) }
}
