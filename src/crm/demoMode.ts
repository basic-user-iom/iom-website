/**
 * Public CRM showcase mode — in-memory dummy data only.
 * When active, no Supabase Auth / PostgREST / Storage calls are made.
 */

import {
  clearDemoStore,
  ensureDemoSeeded,
  DEMO_USER as SeedDemoUser,
} from './demoStore'
import type { CrmUser } from './types'

export const DEMO_USER: CrmUser = SeedDemoUser

let demoEnabled = false

/** Enable before any CRM API call (App route mount). Seeds in-memory sandbox. */
export function enableCrmDemoMode(): void {
  demoEnabled = true
  ensureDemoSeeded()
}

export function disableCrmDemoMode(): void {
  demoEnabled = false
  clearDemoStore()
}

export function isCrmDemoMode(): boolean {
  return demoEnabled
}

/** Pathname helper for routing (`/crm-demo`). */
export function isCrmDemoPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/crm-demo'
}
