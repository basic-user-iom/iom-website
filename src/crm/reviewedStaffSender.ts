// UI routing only. Server authorization independently checks verified owner/MFA
// and the exact sender's revocable database capability.
export const REVIEWED_EMAIL_OWNER = '1add2cb0-a00a-4f92-a20a-7d90cb23afdd'
export function usesReviewedStaffEmail(identity: string, ownerId?: string | null): boolean {
  return identity === 'projects' || (identity === 'visual' && ownerId === REVIEWED_EMAIL_OWNER)
}
