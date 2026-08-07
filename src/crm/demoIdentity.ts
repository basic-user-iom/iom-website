import type { CrmUser, StaffProfile } from './types'

/** Public demo guide — not a real person / mailbox. */
export const DEMO_USER: CrmUser = {
  id: 'demo-user-iom',
  email: 'demo.guide@iom-showcase.example',
  avatar_url: null,
}

/** Second fictional teammate for “Added by” variety in the sandbox. */
export const DEMO_PARTNER: CrmUser = {
  id: 'demo-user-partner',
  email: 'demo.partner@iom-showcase.example',
  avatar_url: null,
}

export const DEMO_STAFF: StaffProfile = {
  id: DEMO_USER.id,
  email: DEMO_USER.email,
  display_name: 'Demo Guide',
  avatar_url: null,
}

export const DEMO_PARTNER_STAFF: StaffProfile = {
  id: DEMO_PARTNER.id,
  email: DEMO_PARTNER.email,
  display_name: 'Demo Partner',
  avatar_url: null,
}
