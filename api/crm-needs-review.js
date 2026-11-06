import {createCapabilityHttpHandlers,createCapabilityHttpRouter} from './_lib/crm-needs-review-http.mjs'
import {needsReviewHost} from './_lib/crm-needs-review-host.mjs'
export default createCapabilityHttpRouter({handlers:createCapabilityHttpHandlers({host:needsReviewHost})})
