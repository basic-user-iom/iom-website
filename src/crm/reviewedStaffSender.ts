// UI routing only. Server authorization independently checks verified owner/MFA
// and the exact sender's revocable database capability.
export const REVIEWED_EMAIL_OWNER = '1add2cb0-a00a-4f92-a20a-7d90cb23afdd'
export const REVIEWED_EMAIL_VISUAL_OWNER = '1dd6199e-25b2-4def-b790-7ce6a372ae53'
export function usesReviewedStaffEmail(identity: string, ownerId?: string | null): boolean {
  return identity === 'projects' || (['visual','contact'].includes(identity) &&
    (ownerId === REVIEWED_EMAIL_OWNER || ownerId === REVIEWED_EMAIL_VISUAL_OWNER))
}
