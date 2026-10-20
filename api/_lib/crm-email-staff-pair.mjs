// Approved login IDs. Sender aliases never confer login identity.
export const STAFF_PAIR_ACCOUNTS=Object.freeze([
  '1add2cb0-a00a-4f92-a20a-7d90cb23afdd',
  '1dd6199e-25b2-4def-b790-7ce6a372ae53',
])
export const isStaffPairAccount=id=>STAFF_PAIR_ACCOUNTS.includes(id)
