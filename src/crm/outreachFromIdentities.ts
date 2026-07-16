/** Shared CRM outbound From identities (mirrors api/lib/proton-identities.js). */

export type OutreachFromIdentityId = 'contact' | 'visual' | 'projects'

export type OutreachFromIdentity = {
  id: OutreachFromIdentityId
  label: string
  email: string
}

export const OUTREACH_FROM_IDENTITIES: OutreachFromIdentity[] = [
  {
    id: 'contact',
    label: 'Contact — general',
    email: 'contact@iobjectm.com',
  },
  {
    id: 'visual',
    label: 'Visual — photo, film, arts',
    email: 'visual@iobjectm.com',
  },
  {
    id: 'projects',
    label: 'Projects — clients & collabs',
    email: 'projects@iobjectm.com',
  },
]

export const DEFAULT_OUTREACH_FROM: OutreachFromIdentityId = 'contact'

const STORAGE_KEY = 'iom-crm-outreach-from'

export function readStoredOutreachFrom(): OutreachFromIdentityId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'contact' || raw === 'visual' || raw === 'projects') return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_OUTREACH_FROM
}

export function writeStoredOutreachFrom(id: OutreachFromIdentityId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}
