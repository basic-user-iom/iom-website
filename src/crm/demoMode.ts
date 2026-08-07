/**
 * Public CRM showcase mode — in-memory dummy data only.
 * When active, no Supabase Auth / PostgREST / Storage calls are made.
 *
 * Intentionally does NOT statically import demoStore (blog seed catalog).
 * Seed/clear happen via dynamic import so the homepage entry stays lean.
 */

import type { CrmUser } from './types'
import { DEMO_USER as SeedDemoUser } from './demoIdentity'
import { isCrmDemoPath } from './demoPaths'

export { isCrmDemoPath }
export const DEMO_USER: CrmUser = SeedDemoUser

let demoEnabled = false

/** Enable before any CRM API call (App route mount). Seeds in-memory sandbox. */
export function enableCrmDemoMode(): void {
  demoEnabled = true
  void import('./demoStore').then((m) => {
    m.ensureDemoSeeded()
  })
}

export function disableCrmDemoMode(): void {
  demoEnabled = false
  void import('./demoStore').then((m) => {
    m.clearDemoStore()
  })
}

export function isCrmDemoMode(): boolean {
  return demoEnabled
}
